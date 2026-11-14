// Stato dell'applicazione, barra superiore e navigazione tra le viste.
import { h, metti, s, svuota } from './dom.js';
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
import { avviaTutorial, tutorialAttivo } from './tutorial.js';
import { apriSceltaBando } from './scelta-bando.js';

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
export function salvaPresto() { clearTimeout(timerSalva); timerSalva = setTimeout(() => salva(), 500); }

// Dei documenti d'identità non si conserva mai il testo, comunque sia arrivato.
function senzaIdentita(p) {
  let tolto = false;
  for (const d of p.documenti || []) if (d.tipo === 'identita' && d.testo) { d.testo = ''; d.trascritto = false; tolto = true; }
  return tolto;
}

export async function apriProgetto(id, scheda) {
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
      h('a.brand', { href: '#dossier', 'aria-label': 'Clockwise, elenco dossier' }, logo(), 'Clockwise'),
      h('nav.nav', { 'aria-label': 'Sezioni' }, voce('dossier', 'Dossier'), voce('bandi', 'Bandi'), voce('collegamento', 'Collegamento')),
      h('div.top-fine',
        pillola,
        h('button.btn.s.aiuto', { type: 'button', id: 'btn-aiuto', title: 'Guida, novità e crediti', onclick: () => apriAiuto(AZIONI_AIUTO) }, h('span', { 'aria-hidden': 'true' }, '?'), h('span.et', 'Aiuto')),
        S.ambiente.server?.eseguibile && h('button.btn.s.ghost', { type: 'button', id: 'btn-esci', title: 'Chiudi il programma', onclick: () => apriAiuto(AZIONI_AIUTO, 'info') }, 'Esci')))),
    main);
  VISTE[r](main);
  window.scrollTo(0, 0);
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

// Dossier dimostrativo: numeri d'invenzione, per mostrare subito come lavora il simulatore.
function progettoEsempio() {
  const p = nuovoProgetto('Esempio — L’ultima tonnara', { bandoId: 'sicilia-2025-2027', categoriaId: 'film' });
  p.esempio = true;
  p.dati = {
    ...datiVuoti(), titolo: 'L’ultima tonnara', tipologiaOpera: 'Film di produzione cinematografica', durataMin: 100,
    giorni: { prepTot: 30, prepSicilia: 24, ripreseTot: 28, ripreseSicilia: 28, postTot: 60, postSicilia: 20 },
    professionisti: { artTot: 10, artSicilia: 6, crewTot: 20, crewSicilia: 15 },
    economici: { costoProduzione: 470000, costoAmmissibile: 460000, contributoRichiesto: 120000, spesaSicilia: 270000, producerFee: 30000 },
    piano: [
      { voce: '1.1', etichetta: 'Contributo richiesto con questo bando', denominazione: '', importo: 120000, documento: 'nessuno' },
      { voce: '1.2', etichetta: 'Tax credit', denominazione: '', importo: 100000, documento: 'nessuno' },
      { voce: '2.1', etichetta: 'Apporto societario diretto', denominazione: '', importo: 80000, documento: 'referenze' },
      { voce: '2.2', etichetta: 'Produttori indipendenti', denominazione: 'Coproduttore d’esempio', importo: 110000, documento: 'contratto' },
      { voce: '5.2', etichetta: 'Prevendite Italia — Free TV', denominazione: 'Emittente d’esempio', importo: 60000, documento: 'deal_memo' },
    ],
  };
  return p;
}

export async function avvia(el) {
  radice = el;
  const salvate = await store.impostazioni();
  Object.assign(S.imp, Object.fromEntries(Object.entries(salvate).filter(([k]) => k in S.imp)));
  await caricaBandi();
  S.progetti = await store.elencoProgetti();
  if (!salvate.esempioCreato) {
    await store.salvaProgetto(progettoEsempio(), {});
    const p = await store.caricaProgetto((await store.elencoProgetti())[0].id);
    await store.salvaProgetto(p, riepilogo(p));
    await store.salvaImpostazioni({ esempioCreato: true });
    S.progetti = await store.elencoProgetti();
  }
  if (rotta() === 'progetto' && salvate.ultimoProgetto) {
    const p = await store.caricaProgetto(salvate.ultimoProgetto);
    if (p) { p.dati = { ...datiVuoti(), ...p.dati }; if (senzaIdentita(p)) await store.salvaProgetto(p, riepilogo(p)); S.progetto = p; S.scheda = 'cruscotto'; }
  }
  window.addEventListener('hashchange', render);
  render();
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
