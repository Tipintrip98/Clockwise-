// Stato dell'applicazione, barra superiore e navigazione tra le viste.
import { h, metti, s, svuota, toast, salvaFile, nomeFilePulito } from './dom.js';
import { rilevaAmbiente, creaLlm, MODELLI } from '../core/llm.js';
import { BANDI_PREDEFINITI, SCHEDE_BANDI } from '../core/bandi/indice.js';
import { applicaAggiornamenti } from '../core/aggiornamenti.js';
import { controlloSilenzioso } from './aggiornamenti.js';
import * as store from '../core/store.js';
import { datiVuoti, componiRisultato, getCategoria } from '../core/scoring.js';
import { valutazioniPerCriterio } from '../core/engine.js';
import { vistaHome } from './home.js';
import { vistaProgetto } from './progetto.js';
import { vistaBandi } from './bandi.js';
import { vistaCollegamento } from './collegamento.js';
import { apriAiuto } from './aiuto.js';
import { APP } from '../core/versione.js';
import { avviaTutorial, tutorialAttivo } from './tutorial.js';
import { apriSceltaBando } from './scelta-bando.js';
import { apriProgramma } from './programma.js';
import { compilaEsempio, VERSIONE_ESEMPIO, NOME_ESEMPIO } from '../core/esempio.js';
import { pacchettoDossier, leggiPacchetto, preparaImportato, ESTENSIONE } from '../core/scambio.js';

export const S = {
  ambiente: { ambiente: 'attesa' },
  imp: { collegamento: null, modello: 'claude-fable-5-2', impegno: 'high', commissari: 3, bandoPreferito: null, aggiornaBandi: true, leggiNuoviAvvisi: true },
  bandi: [], schede: [], progetti: [], progetto: null, scheda: 'cruscotto', corsa: null, bandoAperto: null,
  sotto: { produzione: 'spoglio', legale: 'chiedi' },
  guida: { tutorialVisto: false, dritte: {} },
};

export const llmAttivo = () => creaLlm(S.ambiente, S.imp.collegamento);
export const bandoDi = (p) => S.bandi.find((b) => b.id === p.bandoId) || S.bandi[0];
export const risultatoDi = (p) => componiRisultato(bandoDi(p), p.categoriaId, p.dati, valutazioniPerCriterio(p.valutazione));
export const nomeModello = (id) => MODELLI.find((m) => m.id === id)?.nome || id;

// Bandi in uso: quelli del programma, con sopra gli aggiornamenti arrivati dal canale automatico, più quelli
// aggiunti dall'utente. S.schede elenca i fondi noti che non si possono simulare (senza griglia a punti).
export async function caricaBandi() {
  const { bandi, schede } = applicaAggiornamenti(BANDI_PREDEFINITI, SCHEDE_BANDI, (await store.aggiornamentiBandi()).bandi);
  const predefiniti = await Promise.all(bandi.map(async (b) => ({ ...b, conoscenza: await store.conoscenzaBando(b.id) })));
  S.bandi = [...predefiniti, ...(await store.bandiPersonali())];
  S.schede = schede;
}
export const bandoPreferito = () => S.bandi.find((b) => b.id === S.imp.bandoPreferito) || S.bandi[0];

export function annoPredefinito(bando) {
  const oggi = new Date().toISOString().slice(0, 10);
  const prossima = (bando.finestre || []).find((f) => f.al >= oggi);
  return prossima?.anno || bando.finestre?.at(-1)?.anno || new Date().getFullYear();
}

export function nuovoProgetto(nome = 'Nuovo dossier', scelta = {}) {
  const bando = S.bandi.find((b) => b.id === scelta.bandoId) || bandoPreferito();
  const categoria = bando.categorie.find((c) => c.id === scelta.categoriaId) || bando.categorie[0];
  return {
    id: store.nuovoId(), nome, bandoId: bando.id, categoriaId: categoria.id, anno: Number(scelta.anno) || annoPredefinito(bando),
    creato: new Date().toISOString(), documenti: [], dati: datiVuoti(), origineDati: null, valutazione: null, punteggioPrimo: null, reale: {},
  };
}

function riepilogo(p) {
  try {
    const r = risultatoDi(p);
    return { totale: r.totale, massimo: r.massimo, esito: r.esito, completo: r.completo, categoria: getCategoria(bandoDi(p), p.categoriaId).nome, bando: bandoDi(p).nomeBreve || bandoDi(p).nome };
  } catch { return {}; }
}
export async function salva(p = S.progetto) {
  if (!p) return;
  await store.salvaProgetto(p, riepilogo(p));
  S.progetti = await store.elencoProgetti();
}
let timerSalva = null;
export function salvaPresto() { clearTimeout(timerSalva); timerSalva = setTimeout(() => { timerSalva = null; salva(); }, 500); }
/** Salva adesso ciò che era in attesa (alla chiusura della pagina, al cambio di scheda del browser, prima di «Esci»). */
export function salvaSubito() {
  const inAttesa = timerSalva != null;
  clearTimeout(timerSalva); timerSalva = null;
  return inAttesa ? salva() : Promise.resolve();
}

/* ------------------------------------------------------------------ sessione di lavoro */
// Dove si era rimasti (pagina, dossier, scheda, sezioni interne): si salva a ogni spostamento e alla chiusura,
// e alla riapertura del programma si riparte da lì.
let timerSessione = null, sessioneAttiva = false;
const fotoSessione = () => ({ rotta: rotta(), progetto: S.progetto?.id || null, scheda: S.scheda, sotto: { ...S.sotto }, bandoAperto: S.bandoAperto || null, quando: new Date().toISOString() });
export function ricordaSessione(subito = false) {
  if (!sessioneAttiva) return Promise.resolve();
  clearTimeout(timerSessione); timerSessione = null;
  if (subito) return store.salvaSessione(fotoSessione()).catch(() => {});
  timerSessione = setTimeout(() => { timerSessione = null; store.salvaSessione(fotoSessione()).catch(() => {}); }, 400);
  return Promise.resolve();
}
/** Tutto su disco, adesso: dossier in modifica e sessione. Restituisce true se non resta niente in sospeso. */
export async function salvaTutto() {
  await salvaSubito();
  await ricordaSessione(true);
  return store.scrittureConcluse();
}

// Dei documenti d'identità non si conserva mai il testo, comunque sia arrivato.
function senzaIdentita(p) {
  let tolto = false;
  for (const d of p.documenti || []) if (d.tipo === 'identita' && d.testo) { d.testo = ''; d.trascritto = false; tolto = true; }
  return tolto;
}

export async function apriProgetto(id, scheda) {
  await salvaSubito(); // il dossier che si lascia va su disco prima di aprire l'altro
  const p = await store.caricaProgetto(id);
  if (!p) return vai('dossier');
  p.dati = { ...datiVuoti(), ...p.dati };
  if (senzaIdentita(p)) await store.salvaProgetto(p, riepilogo(p));
  S.progetto = p;
  S.scheda = scheda || 'cruscotto';
  S.sotto = { produzione: 'spoglio', legale: 'chiedi' };
  await store.salvaImpostazioni({ ultimoProgetto: id });
  vai('progetto', true);
}

const VISTE = { dossier: vistaHome, progetto: vistaProgetto, bandi: vistaBandi, collegamento: vistaCollegamento };
const rotta = () => { const r = location.hash.replace(/^#/, ''); return VISTE[r] ? r : 'dossier'; };

export function vai(nome, forza = false) {
  if (rotta() === nome) { if (forza) render(); return; }
  location.hash = nome;
}

let radice = null;
export function render() {
  if (!radice) return;
  let r = rotta();
  if (r === 'progetto' && !S.progetto) r = 'dossier';
  const llm = llmAttivo();
  const pillola = h('a.link-pill', { href: '#collegamento', title: 'Collegamento a Claude' },
    h(`span.dot.${statoPillola(llm)[0]}`),
    h('span', statoPillola(llm)[1]));
  const voce = (id, testo) => h('a', { href: `#${id}`, 'aria-current': r === id || (id === 'dossier' && r === 'progetto') ? 'page' : null }, testo);
  const main = h('main.wrap');
  metti(svuota(radice), 
    h('header.top', h('div.wrap',
      h('a.brand', { href: '#dossier', 'aria-label': `Clockwise ${APP.versione}, elenco dossier` }, logo(), 'Clockwise', h('span.versione', { title: `Versione ${APP.versione}` }, APP.versione)),
      h('nav.nav', { 'aria-label': 'Sezioni' }, voce('dossier', 'Dossier'), voce('bandi', 'Bandi'), voce('collegamento', 'Collegamento')),
      h('div.top-fine',
        pillola,
        h('button.btn.s.aiuto', { type: 'button', id: 'btn-aiuto', title: 'Guida, novità e crediti', onclick: () => apriAiuto(AZIONI_AIUTO) }, h('span', { 'aria-hidden': 'true' }, '?'), h('span.et', 'Aiuto')),
        S.ambiente.ambiente === 'locale' && h('button.btn.s.ghost', { type: 'button', id: 'btn-esci', title: 'Salvataggio, dati sul computer e chiusura del programma', onclick: () => apriProgramma() }, S.ambiente.server?.eseguibile ? 'Esci' : 'Dati')))),
    main);
  VISTE[r](main);
  window.scrollTo(0, 0);
  ricordaSessione();
}

// Marchio: il quadrante di Clockwise su una tessera cobalto, con la lancetta ambra (i colori sono variabili di app.css).
function logo() {
  const tratto = { fill: 'none', 'stroke-width': 2.7, 'stroke-linecap': 'round' };
  return s('svg', { class: 'marchio', viewBox: '0 0 32 32', width: 30, height: 30, 'aria-hidden': 'true' },
    s('defs', null, s('linearGradient', { id: 'cw-marchio', x1: 0, y1: 0, x2: 1, y2: 1 },
      s('stop', { offset: '0', style: 'stop-color: var(--marchio-1, #6883FF)' }), s('stop', { offset: '1', style: 'stop-color: var(--marchio-2, #1F35C9)' }))),
    s('rect', { width: 32, height: 32, rx: 9, fill: 'url(#cw-marchio)' }),
    s('path', { d: 'M9.9 22.7A8.6 8.6 0 1 1 22.1 22.7', stroke: '#FFFFFF', ...tratto }),
    s('path', { d: 'M16 16.6l3.9-4.3', stroke: 'var(--marchio-lancetta, #FFC233)', ...tratto }),
    s('circle', { cx: 16, cy: 16.6, r: 1.9, fill: '#FFFFFF' }));
}

// Dossier dimostrativo: «L'insabbiato», con i soli dati chiave e i punteggi (core/esempio.js).
function progettoEsempio() { return compilaEsempio(nuovoProgetto('Esempio', { bandoId: 'sicilia-2025-2027', categoriaId: 'film' })); }

// L'esempio delle versioni precedenti (numeri d'invenzione) lascia il posto a quello nuovo, ma solo se nessuno
// ci ha lavorato: un esempio a cui sono stati aggiunti documenti o una valutazione resta dov'è.
async function aggiornaEsempio(salvate) {
  if (salvate.esempioCreato && salvate.esempioVersione === VERSIONE_ESEMPIO) return;
  for (const voce of (await store.elencoProgetti()).filter((x) => x.esempio)) {
    const vecchio = await store.caricaProgetto(voce.id);
    if (vecchio && (vecchio.esempioVersione === VERSIONE_ESEMPIO || vecchio.documenti?.length || (vecchio.valutazione && !vecchio.esempioVersione))) continue;
    await store.eliminaProgetto(voce.id);
  }
  if (!(await store.elencoProgetti()).some((x) => x.esempio && x.nome === NOME_ESEMPIO)) {
    const p = progettoEsempio();
    await store.salvaProgetto(p, riepilogo(p));
  }
  await store.salvaImpostazioni({ esempioCreato: true, esempioVersione: VERSIONE_ESEMPIO });
}

export async function avvia(el) {
  radice = el;
  // nel programma installato i dati stanno su disco: va collegato prima di leggere qualsiasi cosa
  await store.collegaDisco();
  const salvate = await store.impostazioni();
  Object.assign(S.imp, Object.fromEntries(Object.entries(salvate).filter(([k]) => k in S.imp)));
  await caricaBandi();
  await aggiornaEsempio(salvate);
  S.progetti = await store.elencoProgetti();
  // si riparte da dove si era rimasti: senza un indirizzo preciso vale la sessione salvata
  const ses = await store.sessione();
  const senzaIndirizzo = !location.hash || location.hash === '#';
  const daRiaprire = rotta() === 'progetto' ? (ses?.progetto || salvate.ultimoProgetto) : senzaIndirizzo && ses?.rotta === 'progetto' ? ses.progetto : null;
  let ripresa = null;
  if (daRiaprire) {
    const p = await store.caricaProgetto(daRiaprire);
    if (p) {
      p.dati = { ...datiVuoti(), ...p.dati }; if (senzaIdentita(p)) await store.salvaProgetto(p, riepilogo(p));
      S.progetto = p; S.scheda = ses?.progetto === p.id && ses.scheda ? ses.scheda : 'cruscotto';
      if (ses?.progetto === p.id && ses.sotto) S.sotto = { ...S.sotto, ...ses.sotto };
      if (senzaIndirizzo) { ripresa = p.nome; history.replaceState(null, '', '#progetto'); }
    }
  } else if (senzaIndirizzo && ses?.rotta && VISTE[ses.rotta] && ses.rotta !== 'progetto' && ses.rotta !== 'dossier') {
    S.bandoAperto = ses.bandoAperto || null;
    history.replaceState(null, '', `#${ses.rotta}`);
  }
  sessioneAttiva = true;
  window.addEventListener('hashchange', render);
  // alla chiusura della pagina, o quando passa in secondo piano, ciò che è in attesa va salvato subito
  window.addEventListener('pagehide', () => { salvaSubito(); ricordaSessione(true); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { salvaSubito(); ricordaSessione(true); } });
  render();
  if (ripresa && salvate.tutorialVisto) toast(`Sessione ripresa: «${ripresa}»`);
  S.guida = { tutorialVisto: !!salvate.tutorialVisto, dritte: { ...(salvate.dritte || {}) } };
  // il collegamento a Claude arriva dopo: la pagina è già utilizzabile
  S.ambiente = await rilevaAmbiente();
  // le schede con pulsanti che dipendono da Claude si ridisegnano; in Dati chiave no, per non interrompere chi sta scrivendo
  if (rotta() !== 'progetto' || S.scheda !== 'dati' || S.ambiente.server?.eseguibile) render(); else aggiornaPillola();
  // la guida parte solo dall'elenco dei dossier: chi ha già aperto un dossier non viene riportato indietro
  if (!S.guida.tutorialVisto && rotta() === 'dossier') guidaIniziale();
  // controllo silenzioso degli aggiornamenti dei bandi: non blocca e non disturba se non c'è nulla di nuovo
  controlloSilenzioso().catch(() => {});
}

/* ------------------------------------------------------------------ esporta e importa un dossier */

async function inBase64(blob) {
  const b = new Uint8Array(await blob.arrayBuffer());
  let testo = '';
  for (let i = 0; i < b.length; i += 0x8000) testo += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(testo);
}
function daBase64(base64, nome, tipo) {
  const testo = atob(base64);
  const b = new Uint8Array(testo.length);
  for (let i = 0; i < testo.length; i++) b[i] = testo.charCodeAt(i);
  return new File([b], nome, { type: tipo || 'application/octet-stream' });
}

/** Salva tutto il dossier in un file .clockwise, con i file originali se sono nell'archivio del computer. */
export async function esportaDossier(p) {
  await salvaSubito();
  const originali = [];
  let pesanti = 0;
  for (const d of p.documenti) {
    if (!d.originale || d.tipo === 'identita') continue;
    if (pesanti + (d.dimensione || 0) > 250 * 1024 * 1024) continue; // oltre, il file diventerebbe ingestibile
    const f = await store.leggiOriginale(p.id, d.id, d.nome);
    if (f) { originali.push({ id: d.id, nome: d.nome, tipo: f.type, base64: await inBase64(f) }); pesanti += f.size; }
  }
  const pacchetto = pacchettoDossier(p, { versioneApp: APP.versione, originali });
  await salvaFile(nomeFilePulito(`dossier-${p.dati?.titolo || p.nome}`, ESTENSIONE), JSON.stringify(pacchetto), 'application/json');
  const mancanti = p.documenti.filter((d) => d.tipo !== 'identita').length - originali.length;
  toast(originali.length ? `Dossier esportato con ${originali.length} file originali${mancanti > 0 ? ` (${mancanti} senza originale)` : ''}` : 'Dossier esportato (testi e dati, senza i file originali)');
}

/** Carica un dossier esportato: non sovrascrive mai un dossier esistente (se c'è già, ne crea una copia). */
export async function importaDossier(file) {
  let letto;
  try { letto = leggiPacchetto(await file.text()); } catch (e) { toast(e.message); return null; }
  const { progetto: p, copia } = preparaImportato(letto.progetto, { idEsistenti: S.progetti.map((x) => x.id), nuovoId: store.nuovoId });
  p.dati = { ...datiVuoti(), ...p.dati };
  let salvati = 0;
  for (const o of letto.originali) {
    const d = p.documenti.find((x) => x.id === o.id);
    if (!d || d.tipo === 'identita') continue;
    let r = null;
    try { r = await store.salvaOriginale(p.id, d.id, daBase64(o.base64, o.nome, o.tipo)); } catch { r = null; }
    if (r) { d.originale = { nome: r.nome, byte: r.byte }; salvati++; }
  }
  for (const d of p.documenti) if (!letto.originali.some((o) => o.id === d.id) || !store.statoDisco().attivo) delete d.originale;
  await store.salvaProgetto(p, riepilogo(p));
  S.progetti = await store.elencoProgetti();
  toast(`Dossier «${p.nome}» importato${copia ? ' come copia' : ''}${salvati ? ` con ${salvati} file originali` : ''}`);
  await apriProgetto(p.id, 'cruscotto');
  return p;
}

/* ------------------------------------------------------------------ guida al primo utilizzo */

const attendi = (selettore, ms = 1500) => new Promise((fatto) => {
  const inizio = Date.now();
  const prova = () => (document.querySelector(selettore) || Date.now() - inizio > ms ? fatto() : requestAnimationFrame(prova));
  prova();
});

export function guidaIniziale() {
  const esempio = () => S.progetti.find((x) => x.esempio) || S.progetti[0];
  const apriEsempio = async () => {
    const e = esempio();
    if (!e) return;
    if (S.progetto?.id !== e.id || rotta() !== 'progetto' || S.scheda !== 'cruscotto') await apriProgetto(e.id, 'cruscotto');
    await attendi('#cruscotto-stato');
  };
  const elenco = async () => { vai('dossier', true); await attendi('.page-head'); };
  // «Quale bando vuoi simulare?»: si propone una sola volta per giro. La guida aspetta la scelta ma non si blocca mai:
  // prosegue comunque se la finestra viene chiusa, saltata o non riesce ad aprirsi.
  let bandoProposto = false;
  const proponiBando = async () => {
    await elenco();
    if (bandoProposto) return;
    bandoProposto = true;
    await new Promise((fatto) => { try { apriSceltaBando({ primoAvvio: true, alTermine: () => fatto() }); } catch { fatto(); } });
  };
  const testoBando = () => {
    const scelto = S.bandi.find((b) => b.id === S.imp.bandoPreferito);
    return `${scelto ? `Bando preferito: «${scelto.nomeBreve || scelto.nome}». Clockwise lo propone ogni volta che crei un dossier.` : 'Non hai scelto un bando: lo farai quando crei il primo dossier.'} Nella pagina Bandi trovi il catalogo completo, con stato, scadenze, griglia e fonti di ogni fondo; da lì cambi il bando preferito quando vuoi.`;
  };
  avviaTutorial([
    { titolo: 'Benvenuto in Clockwise', testo: 'Clockwise legge il dossier di candidatura a un bando per il cinema e stima il punteggio che la Commissione gli darebbe, prima dell’invio. Si comincia dal bando che vuoi simulare; poi, in un minuto, ti mostro dove trovare le cose.', prima: elenco },
    { bersaglio: '.nav a[href="#bandi"]', titolo: 'Il tuo bando', get testo() { return testoBando(); }, prima: proponiBando },
    { bersaglio: '.link-pill', titolo: 'Il collegamento a Claude', testo: 'I documenti li legge Claude. Qui vedi se è collegato: toccalo per scegliere tra il tuo abbonamento Claude e una chiave API. I punti che dipendono dai numeri si calcolano anche senza.', prima: elenco },
    { bersaglio: '.cards .card', titolo: 'Un dossier per ogni candidatura', testo: 'Ogni progetto ha il suo dossier, salvato su questo dispositivo. Questo è un esempio già compilato: apriamolo.', prima: elenco },
    { bersaglio: '#cruscotto-stato', titolo: 'Il cruscotto', testo: 'Dice a che punto sei: semaforo, punteggio stimato, quanto manca alla finestra del bando e il prossimo passo da fare. Più sotto trovi i problemi da sistemare, ognuno con il pulsante che porta al punto giusto.', prima: apriEsempio },
    { bersaglio: '.passi', titolo: 'Quattro passi', testo: 'Documenti, Dati chiave, Valutazione, Esito. Ogni riquadro dice che cosa manca e apre la scheda corrispondente.', prima: apriEsempio },
    { bersaglio: '.tabs', titolo: 'Le schede del dossier', testo: 'Le stesse tappe sono sempre qui. A destra gli strumenti: Produzione (spoglio, piano, storyboard, ordine del giorno, preventivo, adempimenti) e Legale (domande sul bando, contratti, bozze, fascicolo).', prima: apriEsempio },
    { bersaglio: '#btn-aiuto', titolo: 'Aiuto, sempre a portata', testo: 'Guida, novità della versione e crediti. Da qui puoi rivedere questa presentazione quando vuoi. La prima volta che apri una scheda trovi anche un suggerimento su come usarla.' },
  ], () => {
    S.guida.tutorialVisto = true;
    store.salvaImpostazioni({ tutorialVisto: true });
  });
}

export async function dritaVista(id) {
  S.guida.dritte[id] = true;
  await store.salvaImpostazioni({ dritte: S.guida.dritte });
}
export const guidaInCorso = () => tutorialAttivo();

const AZIONI_AIUTO = {
  tutorial: () => guidaIniziale(),
  suggerimenti: async () => { S.guida.dritte = {}; await store.salvaImpostazioni({ dritte: {} }); },
};

// Aggiunge (o sostituisce) un documento nella conoscenza aggiuntiva di un bando.
export async function aggiungiConoscenza(bando, voce) {
  const lista = [...(bando.conoscenza || []).filter((k) => k.id !== voce.id), voce];
  if (bando.predefinito) await store.salvaConoscenza(bando.id, lista);
  else await store.salvaBando({ ...bando, conoscenza: lista });
  await caricaBandi();
}

export async function ricontrollaAmbiente() { S.ambiente = await rilevaAmbiente(); render(); }

function statoPillola(llm) {
  if (llm) return ['ok', `${llm.etichetta} · ${nomeModello(S.imp.modello)}`];
  return S.ambiente.ambiente === 'attesa' ? ['x', 'Verifica del collegamento…'] : ['bad', 'Claude non collegato'];
}
export function aggiornaPillola() {
  const el = document.querySelector('.link-pill');
  if (!el) return;
  const [classe, testo] = statoPillola(llmAttivo());
  el.querySelector('.dot').className = `dot ${classe}`;
  el.lastElementChild.textContent = testo;
}

export async function impostazione(patch) {
  Object.assign(S.imp, patch);
  await store.salvaImpostazioni(patch);
  aggiornaPillola();
}
