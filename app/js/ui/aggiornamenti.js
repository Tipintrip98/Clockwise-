// Aggiornamenti dei bandi nell'interfaccia: controllo silenzioso, riquadro della pagina Bandi, avviso nel dettaglio di un bando.
// Il protocollo è descritto in core/aggiornamenti.js; qui lo si fa girare e lo si mostra. Regola d'oro: silenzio finché
// non c'è una novità vera — nessuna finestra, nessun toast, nessun ridisegno della pagina per un controllo andato liscio.
import { h, metti, svuota, fmt, toast, bottoneConferma } from './dom.js';
import { S, caricaBandi, llmAttivo, impostazione } from './app.js';
import * as store from '../core/store.js';
import { BANDI_PREDEFINITI, SCHEDE_BANDI, REVISIONE_CATALOGO } from '../core/bandi/indice.js';
import { urlSicuro } from '../core/bandi/schema.js';
import {
  ORE_ALL_AVVIO, ORE_A_PROGRAMMA_APERTO, potaSalvati, revisioniInUso, verificaCatalogo, aggiornaSorgente, segnaControllato,
  candidatoAvviso, scaricabile, confrontaGriglie, unisciRegistro, controlloDovuto, nomeDaUrl, sorgenteVuota,
} from '../core/aggiornamenti.js';
import { estraiTesto } from '../core/docs.js';
import { leggiBando } from '../core/engine.js';

/* ------------------------------------------------------------------ stato */

let memo = null;           // copia in memoria dell'archivio: { bandi, registro, sorgenti, proposte, ultimoControllo, ultimoTentativo, canale }
let inCorso = null;        // promessa del controllo in corso (uno alla volta)
let fase = '';             // che cosa sta facendo, per il riquadro
let esitoManuale = null;   // esito dell'ultimo «Controlla ora»: { tono, testo }
const letture = new Set(); // bandi per cui Claude sta leggendo un documento
let orologio = null;
const vivi = new Set();    // parti dell'interfaccia da ridisegnare quando lo stato cambia: { nodo, disegna, ridisegna }

const chiaveTesto = (id) => `aggiornamenti:testo:${id}`;
async function carica() { if (!memo) memo = await store.aggiornamentiBandi(); return memo; }
async function salva(patch) { memo = await store.salvaAggiornamentiBandi(patch); return memo; }

const tuttiIBandi = () => [...S.bandi, ...S.schede];
const nomeBando = (id) => { const b = tuttiIBandi().find((x) => x.id === id); return b ? (b.nomeBreve || b.nome) : id; };
const noto = (id) => BANDI_PREDEFINITI.some((b) => b.id === id) || SCHEDE_BANDI.some((b) => b.id === id); // fa parte del programma
const inUso = (id) => S.imp.bandoPreferito === id || S.progetti.some((p) => p.bandoId === id && !p.esempio);

const giorno = (iso) => { const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }); };
function quando(iso) {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return 'mai';
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const mezzanotte = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const giorni = Math.round((mezzanotte(new Date()) - mezzanotte(d)) / 86400000);
  return giorni === 0 ? `oggi alle ${ora}` : giorni === 1 ? `ieri alle ${ora}` : `${giorno(iso)}, ${ora}`;
}
const quanti = (n, uno, molti) => `${fmt(n, 0)} ${n === 1 ? uno : molti}`;

// Ridisegna sul posto riquadri e avvisi ancora in pagina; quelli usciti dalla pagina si dimenticano.
// Chi sta usando il riquadro non deve accorgersene: restano aperto ciò che era aperto e il fuoco dov'era.
function ridisegnaVivi() {
  for (const v of [...vivi]) {
    if (!v.nodo.isConnected) { if (v.montato || Date.now() - v.creato > 10000) vivi.delete(v); continue; }
    v.montato = true;
    const aperti = [...v.nodo.querySelectorAll('details[open]')].map((d) => d.className);
    const fuoco = v.nodo.contains(document.activeElement) ? document.activeElement.id : '';
    try { v.disegna(); } catch { /* un riquadro che non si disegna non deve fermare gli altri */ }
    for (const d of v.nodo.querySelectorAll('details')) if (aperti.includes(d.className)) d.open = true;
    if (fuoco) v.nodo.querySelector(`#${CSS.escape(fuoco)}`)?.focus({ preventScroll: true });
  }
}
// Quando cambiano i bandi stessi (non solo il riquadro) serve ridisegnare la pagina che li mostra.
function ridisegnaPagine() {
  const fatte = new Set();
  for (const v of [...vivi]) if (v.nodo.isConnected && v.ridisegna && !fatte.has(v.ridisegna)) { fatte.add(v.ridisegna); try { v.ridisegna(); } catch { /* la pagina è cambiata nel frattempo */ } }
}
function registra(nodo, disegna, ridisegna) {
  const voce = { nodo, disegna, ridisegna, montato: false, creato: Date.now() };
  vivi.add(voce);
  if (vivi.size > 30) for (const v of [...vivi]) if (v !== voce && !v.nodo.isConnected) vivi.delete(v);
  return voce;
}

/* ------------------------------------------------------------------ il controllo */

const chiedi = (ids) => fetch('api/bandi/controlla', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ids ? { ids } : {}) });

function eventoCanale(canale, istante) {
  const base = { quando: istante, tipo: 'canale', gruppo: 'canale', chiave: canale.esito };
  if (canale.esito === 'ok') return { ...base, quieto: true, testo: 'Canale del catalogo di nuovo raggiungibile.' };
  if (canale.esito === 'disattivato') return { ...base, testo: 'Canale del catalogo spento dalla configurazione del programma.' };
  if (canale.esito === 'non_valido') return { ...base, chiave: `non_valido:${canale.dettaglio}`, testo: `Catalogo ricevuto ma non utilizzabile: ${canale.dettaglio || 'formato non valido'}` };
  return { ...base, chiave: 'non_raggiungibile', testo: `Canale del catalogo non raggiungibile${canale.dettaglio ? ` (${canale.dettaglio})` : ''}.` };
}

async function controlla({ manuale = false } = {}) {
  await carica();
  const adesso = new Date().toISOString();
  fase = 'Controllo del catalogo e delle pagine ufficiali…';
  ridisegnaVivi();
  let r;
  try {
    const risposta = await chiedi(null);
    if (!risposta.ok) throw new Error(`risposta ${risposta.status}`);
    r = await risposta.json();
  } catch {
    await salva({ ultimoTentativo: adesso });
    if (manuale) esitoManuale = { tono: 'bad', testo: 'Controllo non riuscito: il programma non risponde. Riprova tra poco.' };
    return { riuscito: false };
  }
  const istante = typeof r.quando === 'string' && !Number.isNaN(Date.parse(r.quando)) ? r.quando : adesso;
  const eventi = [];
  const novita = { bandi: [], pagine: [] };

  // A. catalogo: ogni voce passa dalla verifica; ciò che non la supera finisce nel registro con il motivo
  const bandi = potaSalvati(BANDI_PREDEFINITI, SCHEDE_BANDI, memo.bandi);
  let canale = memo.canale || null;
  if (r.canale && r.canale.esito !== 'saltato') {
    canale = { url: urlSicuro(r.canale.url), esito: String(r.canale.esito || 'non_raggiungibile'), dettaglio: String(r.canale.dettaglio || '').slice(0, 300), quando: istante, revisione: canale?.revisione || '' };
    if (r.catalogo) {
      const v = await verificaCatalogo(r.catalogo, revisioniInUso(BANDI_PREDEFINITI, SCHEDE_BANDI, bandi));
      if (!v.ok) { canale.esito = 'non_valido'; canale.dettaglio = v.motivo; }
      else {
        canale.revisione = v.revisione;
        for (const b of v.accettati) {
          bandi[b.id] = b;
          novita.bandi.push(b);
          eventi.push({ quando: istante, tipo: 'catalogo', bando: b.id, testo: `${noto(b.id) ? 'Scheda aggiornata dal catalogo' : 'Nuovo bando arrivato dal catalogo'}: ${b.nomeBreve || b.nome} (revisione del ${giorno(b.revisione)}).` });
        }
        for (const s of v.scartati) eventi.push({ quando: istante, tipo: 'scarto', bando: s.id, gruppo: `scarto:${s.id}`, chiave: `${s.revisione}:${s.motivo}`, testo: `Voce del catalogo scartata (${s.id}): ${s.motivo}.` });
      }
    }
    eventi.push(eventoCanale(canale, istante));
  }

  // B. pagine ufficiali: la prima rilevazione fa da base, poi contano solo i documenti mai visti
  const sorgenti = { ...memo.sorgenti };
  let lette = 0;
  for (const [id, rilevazione] of Object.entries(r.sorgenti && typeof r.sorgenti === 'object' ? r.sorgenti : {})) {
    const esito = aggiornaSorgente(sorgenti[id], rilevazione, istante);
    sorgenti[id] = esito.stato;
    if (esito.riuscita) lette++;
    if (esito.nuovi.length) {
      novita.pagine.push({ id, nuovi: esito.nuovi });
      eventi.push({ quando: istante, tipo: 'novita', bando: id, testo: `Novità sulla pagina ufficiale di ${nomeBando(id)}: ${quanti(esito.nuovi.length, 'documento nuovo', 'documenti nuovi')}.` });
    }
    eventi.push(esito.riuscita
      ? { quando: istante, tipo: 'pagina', bando: id, gruppo: `pagina:${id}`, chiave: 'ok', quieto: true, testo: `Pagina ufficiale di ${nomeBando(id)} di nuovo raggiungibile.` }
      : { quando: istante, tipo: 'pagina', bando: id, gruppo: `pagina:${id}`, chiave: 'ferma', testo: `Pagina ufficiale di ${nomeBando(id)} non raggiungibile: ${esito.errore}.` });
  }

  const raggiunto = canale?.esito === 'ok' || lette > 0;
  const protocolli = Array.isArray(r.protocolli) && r.protocolli.every((x) => x === 'https:' || x === 'http:') && r.protocolli.length ? r.protocolli : ['https:'];
  await salva({ bandi, sorgenti, canale, protocolli, registro: unisciRegistro(memo.registro, eventi), ultimoTentativo: adesso, ...(raggiunto ? { ultimoControllo: istante } : {}) });
  if (novita.bandi.length) await caricaBandi(); // integrazione automatica: i bandi aggiornati sono già quelli in uso

  // un toast solo quando qualcosa è cambiato davvero
  const frasi = [];
  if (novita.bandi.length) frasi.push(novita.bandi.length > 1 ? `${novita.bandi.length} schede aggiornate dal catalogo` : `${noto(novita.bandi[0].id) ? 'scheda aggiornata' : 'nuovo bando in catalogo'}: «${novita.bandi[0].nomeBreve || novita.bandi[0].nome}»`);
  if (novita.pagine.length) frasi.push(novita.pagine.length === 1 ? `novità sulla pagina ufficiale di «${nomeBando(novita.pagine[0].id)}»` : `novità sulle pagine ufficiali di ${novita.pagine.length} bandi`);
  if (frasi.length) toast(`Bandi: ${frasi.join(' e ')}`);
  if (manuale) {
    esitoManuale = !raggiunto ? { tono: 'bad', testo: 'Nessun sito ha risposto: controlla la connessione a Internet.' }
      : frasi.length ? { tono: 'warn', testo: `Trovato: ${frasi.join(' e ')}.` }
        : { tono: 'ok', testo: 'Nessuna novità: catalogo e pagine ufficiali sono come all’ultimo controllo.' };
  }
  fase = '';
  ridisegnaVivi();
  if (novita.bandi.length || novita.pagine.length) ridisegnaPagine();

  // C. un nuovo avviso? Se l'utente lo vuole e Claude è collegato, lo si fa leggere: ne nasce una proposta, mai una sostituzione
  if (raggiunto) await letturaAutomatica();
  return { riuscito: raggiunto, novita };
}

/** Avvia il controllo (o si aggancia a quello già in corso). */
function esegui(opzioni) {
  if (inCorso) return inCorso;
  inCorso = controlla(opzioni).catch(() => ({ riuscito: false })).finally(() => { inCorso = null; fase = ''; ridisegnaVivi(); });
  ridisegnaVivi();
  return inCorso;
}

/** Controllo silenzioso all'avvio: non blocca, non mostra nulla se non c'è niente di nuovo. Poi ogni 6 ore a programma aperto. */
export async function controlloSilenzioso() {
  await carica();
  ridisegnaVivi();
  if (!S.ambiente?.server) return; // nell'app Claude non c'è un server che possa scaricare: lì gli aggiornamenti arrivano con la pagina
  if (!orologio) {
    // ogni dieci minuti si guarda l'ora: regge anche il computer che va in sospensione e si risveglia
    orologio = setInterval(() => { if (S.imp.aggiornaBandi && S.ambiente?.server && memo && controlloDovuto(memo, ORE_A_PROGRAMMA_APERTO)) esegui({}); }, 10 * 60 * 1000);
  }
  if (S.imp.aggiornaBandi && controlloDovuto(memo, ORE_ALL_AVVIO)) await esegui({});
}

/* ------------------------------------------------------------------ lettura di un nuovo avviso con Claude */

async function scaricaDocumento(id, d) {
  const indirizzo = `api/bandi/documento?id=${encodeURIComponent(id)}&url=${encodeURIComponent(d.url)}`;
  let risposta = await fetch(indirizzo);
  if (risposta.status === 404) {
    // il programma è stato riavviato dopo il controllo: l'elenco dei documenti va rilevato di nuovo, poi si riprova
    await chiedi([id]).catch(() => null);
    risposta = await fetch(indirizzo);
  }
  if (!risposta.ok) {
    const e = await risposta.json().catch(() => ({}));
    throw new Error(e.messaggio || 'Il documento non è più scaricabile dal sito dell’ente.');
  }
  const estensione = d.tipo === 'docx' ? 'docx' : 'pdf';
  let nome = (nomeDaUrl(d.url) || 'avviso').replace(/[^\w.\- ]+/g, '_');
  if (!nome.toLowerCase().endsWith(`.${estensione}`)) nome += `.${estensione}`;
  return new File([await risposta.blob()], nome);
}

async function leggiDocumento(id, d, { automatica = false } = {}) {
  const llm = llmAttivo();
  if (!llm) throw new Error('Collega Claude per far leggere il documento.');
  await carica();
  letture.add(id);
  // mai due volte lo stesso documento: lo si segna prima di cominciare, così un errore non fa ripetere la lettura a ogni controllo
  const sorgente = sorgenteVuota(memo.sorgenti[id]);
  await salva({ sorgenti: { ...memo.sorgenti, [id]: { ...sorgente, letti: [...new Set([...sorgente.letti, d.url])].slice(-200) } } });
  ridisegnaVivi();
  const istante = new Date().toISOString();
  try {
    fase = `Scarico «${d.titolo}»…`; ridisegnaVivi();
    const file = await scaricaDocumento(id, d);
    const r = await estraiTesto(file);
    if (!r.testo || r.testo.length < 2000) throw new Error('Nel documento non c’è abbastanza testo leggibile: forse è una scansione, o non è il testo dell’avviso.');
    fase = `Claude sta leggendo «${d.titolo}»: può richiedere qualche minuto…`; ridisegnaVivi();
    const { bando, avvisi } = await leggiBando({ testo: r.testo, nomeFile: file.name, llm, opzioni: { modello: S.imp.modello } });
    await store.scrivi(chiaveTesto(id), r.testo);
    await salva({
      proposte: { ...memo.proposte, [id]: { quando: istante, documento: { url: d.url, titolo: d.titolo }, nomeFile: file.name, caratteri: r.testo.length, automatica, bando, avvisi } },
      registro: unisciRegistro(memo.registro, [{ quando: istante, tipo: 'proposta', bando: id, testo: `Claude ha letto «${d.titolo}» (${nomeBando(id)}): proposta di nuova griglia da esaminare.` }]),
    });
    toast(`Nuovo avviso di «${nomeBando(id)}» letto da Claude: c’è una proposta di griglia`);
    return true;
  } catch (e) {
    await salva({ registro: unisciRegistro(memo.registro, [{ quando: istante, tipo: 'lettura', bando: id, testo: `Lettura di «${d.titolo}» non riuscita: ${e?.message || 'errore'}` }]) });
    if (!automatica) throw e;
    return false;
  } finally {
    letture.delete(id);
    fase = '';
    ridisegnaVivi();
  }
}

// Al massimo una lettura per controllo, solo per i bandi in uso (un dossier vero o il bando preferito), mai due volte lo stesso documento.
async function letturaAutomatica() {
  if (!S.imp.leggiNuoviAvvisi || !llmAttivo()) return;
  for (const [id, grezza] of Object.entries(memo.sorgenti || {})) {
    if (!inUso(id) || memo.proposte?.[id] || letture.has(id)) continue;
    const sorgente = sorgenteVuota(grezza);
    const candidato = candidatoAvviso(sorgente.nuovi, sorgente.letti, memo.protocolli);
    if (!candidato) continue;
    const fatta = await leggiDocumento(id, candidato, { automatica: true });
    if (fatta) ridisegnaPagine();
    return;
  }
}

async function attivaProposta(id, ridisegna) {
  await carica();
  const p = memo.proposte?.[id];
  if (!p?.bando) return;
  const testo = await store.leggi(chiaveTesto(id));
  const breve = p.bando.nomeBreve || p.bando.nome || nomeBando(id);
  const nuovo = {
    ...p.bando, nomeBreve: `${breve} (nuovo avviso)`.slice(0, 80), verificato: false, predefinito: false, avvisi: p.avvisi || [],
    conoscenza: testo ? [{ id: store.nuovoId(), nome: p.nomeFile || 'avviso.pdf', testo, caratteri: testo.length }] : [],
    origine: { bando: id, documento: p.documento?.url || '', letto: p.quando },
  };
  await store.salvaBando(nuovo);
  const proposte = { ...memo.proposte }; delete proposte[id];
  await salva({ proposte, registro: unisciRegistro(memo.registro, [{ quando: new Date().toISOString(), tipo: 'attivata', bando: id, testo: `Proposta attivata come bando da verificare: ${nuovo.nomeBreve}.` }]) });
  await store.elimina(chiaveTesto(id));
  await caricaBandi();
  S.bandoAperto = nuovo.id;
  toast('Aggiunto come bando «da verificare»: confronta la griglia con l’avviso prima di usarla');
  ridisegna?.();
}

async function scartaProposta(id) {
  await carica();
  const proposte = { ...memo.proposte }; delete proposte[id];
  await salva({ proposte, registro: unisciRegistro(memo.registro, [{ quando: new Date().toISOString(), tipo: 'scartata', bando: id, testo: `Proposta di griglia scartata (${nomeBando(id)}).` }]) });
  await store.elimina(chiaveTesto(id));
  ridisegnaVivi();
}

async function segna(id) {
  await carica();
  const n = sorgenteVuota(memo.sorgenti[id]).nuovi.length;
  await salva({
    sorgenti: { ...memo.sorgenti, [id]: segnaControllato(memo.sorgenti[id]) },
    registro: unisciRegistro(memo.registro, [{ quando: new Date().toISOString(), tipo: 'controllato', bando: id, testo: `Novità di ${nomeBando(id)} segnate come controllate (${quanti(n, 'documento', 'documenti')}).` }]),
  });
  ridisegnaVivi();
}

/* ------------------------------------------------------------------ riquadro della pagina Bandi */

function interruttore(id, etichetta, nota, attivo, alCambio, disabilitato = false) {
  const ingresso = h('input', { id, type: 'checkbox', role: 'switch', checked: attivo, disabled: disabilitato, 'aria-describedby': `${id}-nota`, onchange: (e) => alCambio(e.target.checked) });
  return h('label.agg-interruttore', { for: id }, ingresso, h('span', h('span.agg-voce', etichetta), h('span.agg-nota', { id: `${id}-nota` }, nota)));
}

const ESITI_CANALE = {
  ok: ['ok', 'raggiungibile'],
  non_raggiungibile: ['x', 'canale non raggiungibile'],
  non_valido: ['warn', 'catalogo ricevuto ma non valido'],
  disattivato: ['x', 'spento dalla configurazione'],
};

function disegnaPannello(nodo, ridisegna) {
  const m = memo || { bandi: {}, registro: [], sorgenti: {}, proposte: {} };
  const locale = !!S.ambiente?.server;
  const aggiornati = Object.values(potaSalvati(BANDI_PREDEFINITI, SCHEDE_BANDI, m.bandi));
  const revisione = [REVISIONE_CATALOGO, ...aggiornati.map((b) => b.revisione)].filter(Boolean).sort().at(-1);
  const sorgenti = Object.entries(m.sorgenti || {}).map(([id, s]) => [id, sorgenteVuota(s)]).filter(([id]) => tuttiIBandi().some((b) => b.id === id));
  const conNovita = sorgenti.filter(([, s]) => s.nuovi.length);
  const ferme = sorgenti.filter(([, s]) => s.errore);
  const proposte = Object.keys(m.proposte || {}).filter((id) => tuttiIBandi().some((b) => b.id === id));
  const apri = (id) => { S.bandoAperto = id; ridisegna?.(); };

  const testata = (stato) => h('div.spread.agg-testata', h('h3', { id: 'agg-titolo' }, 'Aggiornamento dei bandi'), stato);
  if (!locale) {
    // dentro l'app Claude (o prima che il programma abbia risposto) non c'è niente da scaricare
    const dove = S.ambiente?.ambiente;
    metti(svuota(nodo),
      testata(h('span.tag', dove === 'attesa' ? 'Verifica in corso…' : dove === 'app' ? 'Aggiornato con la pagina' : 'Controllo non disponibile')),
      h('div.agg-fatti', h('div', h('div.label', 'Catalogo'), h('div.agg-valore', revisione ? `revisione del ${giorno(revisione)}` : 'del programma'))),
      dove === 'app' ? h('p.small.muted.agg-prosa', 'In questa versione, aperta dentro l’app Claude, gli aggiornamenti dei bandi arrivano insieme alla pagina: quando viene ripubblicata, il catalogo è già quello nuovo. Il controllo automatico delle pagine ufficiali degli enti funziona nel programma installato sul computer.')
        : dove === 'attesa' ? null : h('p.small.muted.agg-prosa', 'Il controllo automatico degli aggiornamenti ha bisogno del programma avviato su questo computer: riavvia Clockwise e ricarica la pagina.'));
    return;
  }

  const stato = inCorso ? h('span.tag.accent', h('span.spin', { 'aria-hidden': 'true' }), 'Controllo in corso')
    : conNovita.length || proposte.length ? h('span.tag.warn', 'Novità da guardare')
      : m.ultimoControllo ? h('span.tag.ok', 'Nessuna novità') : h('span.tag', 'Mai controllato');
  const [tonoCanale, testoCanale] = ESITI_CANALE[m.canale?.esito] || ['x', 'non ancora controllato'];
  const registro = (m.registro || []).slice(-20).reverse();

  metti(svuota(nodo),
    testata(stato),
    h('div.agg-fatti',
      h('div', h('div.label', 'Catalogo'),
        h('div.agg-valore', revisione ? `revisione del ${giorno(revisione)}` : 'del programma'),
        h('div.small.muted', aggiornati.length ? `${quanti(aggiornati.length, 'scheda aggiornata', 'schede aggiornate')} dal canale` : 'quello del programma')),
      h('div', h('div.label', 'Ultimo controllo'),
        h('div.agg-valore', quando(m.ultimoControllo)),
        h('div.small.muted', S.imp.aggiornaBandi ? `all’avvio e ogni ${ORE_A_PROGRAMMA_APERTO} ore` : 'solo a mano')),
      h('div', h('div.label', 'Canale del catalogo'),
        h('div.agg-valore', h(`span.agg-punto.${tonoCanale}`, { 'aria-hidden': 'true' }), testoCanale),
        m.canale?.esito === 'non_raggiungibile' ? h('div.small.muted', 'resta in uso il catalogo del programma') : m.canale?.dettaglio && m.canale.esito !== 'ok' ? h('div.small.muted', m.canale.dettaglio) : null),
      h('div', h('div.label', 'Pagine ufficiali'),
        h('div.agg-valore', sorgenti.length ? quanti(sorgenti.length, 'sorvegliata', 'sorvegliate') : 'nessuna ancora letta'),
        h('div.small.muted', [conNovita.length ? `${fmt(conNovita.length, 0)} con novità` : null, ferme.length ? `${fmt(ferme.length, 0)} non raggiungibili` : null].filter(Boolean).join(' · ') || (sorgenti.length ? 'tutte raggiunte' : '')))),

    conNovita.length || proposte.length ? h('div.notice.warn.agg-novita', { role: 'status' },
      h('strong', 'Da guardare: '),
      [...new Set([...conNovita.map(([id]) => id), ...proposte])].map((id) => h('button.btn.s', { type: 'button', dataset: { bando: id }, onclick: () => apri(id) },
        nomeBando(id), h('span.agg-conta', proposte.includes(id) ? 'proposta di griglia' : quanti(sorgenteVuota(m.sorgenti[id]).nuovi.length, 'documento nuovo', 'documenti nuovi'))))) : null,

    h('div.agg-interruttori',
      interruttore('agg-auto', 'Controlla da solo gli aggiornamenti', `All’avvio (se sono passate ${ORE_ALL_AVVIO} ore) e poi ogni ${ORE_A_PROGRAMMA_APERTO} ore, in silenzio: vedi qualcosa solo quando c’è una novità.`, S.imp.aggiornaBandi,
        async (v) => { await impostazione({ aggiornaBandi: v }); ridisegnaVivi(); if (v && controlloDovuto(memo || {}, ORE_ALL_AVVIO)) esegui({}); }),
      interruttore('agg-leggi', 'Fai leggere a Claude i nuovi avvisi', 'Solo per i bandi che usi (un dossier o il bando preferito), al massimo una lettura per controllo. Ne nasce una proposta: la griglia verificata non cambia da sola.', S.imp.leggiNuoviAvvisi,
        async (v) => { await impostazione({ leggiNuoviAvvisi: v }); ridisegnaVivi(); })),

    h('div.row.agg-azioni',
      h('button.btn.s', { type: 'button', id: 'agg-controlla', disabled: !!inCorso, onclick: () => { esitoManuale = null; esegui({ manuale: true }); } }, inCorso ? 'Controllo in corso…' : 'Controlla ora'),
      h('span.small.agg-esito', { id: 'agg-esito', role: 'status', 'aria-live': 'polite', class: inCorso ? 'muted' : esitoManuale ? esitoManuale.tono : 'muted' },
        inCorso ? (fase || 'Controllo in corso…') : fase ? fase : esitoManuale ? esitoManuale.testo : '')),

    h('details.more.agg-registro',
      h('summary', `Registro degli aggiornamenti${registro.length ? ` (${registro.length === 20 ? 'ultimi 20 eventi' : quanti(registro.length, 'evento', 'eventi')})` : ''}`),
      registro.length ? h('ol.agg-eventi', registro.map((e) => h('li', h('time.num.small.muted', { datetime: e.quando }, quando(e.quando)), h('span', e.testo))))
        : h('p.small.muted', 'Ancora nessun evento: qui compaiono le schede aggiornate, le voci scartate con il motivo, le novità sulle pagine ufficiali e le letture di Claude.')));
}

/** Riquadro per la pagina Bandi: stato del catalogo, ultimo controllo, registro. Restituisce un nodo o null. */
export function pannelloAggiornamenti(ridisegna) {
  const nodo = h('section.panel.agg', { 'aria-labelledby': 'agg-titolo' });
  registra(nodo, () => disegnaPannello(nodo, ridisegna), ridisegna);
  disegnaPannello(nodo, ridisegna);
  if (!memo) carica().then(ridisegnaVivi, () => {});
  return nodo;
}

/* ------------------------------------------------------------------ avviso nel dettaglio di un bando */

const numero = (v) => (v == null ? '—' : fmt(v));
const TIPO_RIGA = { nuovo: ['accent', 'nuovo'], tolto: ['bad', 'tolto'], cambiato: ['warn', 'cambiato'] };

function tabellaConfronto(c) {
  const righe = [
    ...c.generali.map((g) => ['Regole generali', g.voce, g.prima, g.dopo, 'cambiato', false]),
    ...c.sezioni.map((s) => [s.griglia || 'Sezioni', `Sezione ${s.id} · ${s.nome || ''}`, s.prima, s.dopo, s.tipo, false]),
    ...c.criteri.map((x) => [x.griglia || 'Criteri', `${x.id} · ${x.nome || ''}`, x.prima, x.dopo, x.tipo, x.regola]),
    ...c.categorie.map((x) => [x.categoria || 'Categorie', x.voce, x.prima, x.dopo, x.prima == null && x.dopo == null ? 'nuovo' : 'cambiato', false]),
  ];
  return h('div.tablewrap.agg-confronto', h('table',
    h('caption.agg-sr', 'Differenze tra la griglia in uso e quella proposta'),
    h('thead', h('tr', h('th', { scope: 'col' }, 'Voce'), h('th.r', { scope: 'col' }, 'In uso'), h('th.r', { scope: 'col' }, 'Proposta'), h('th', { scope: 'col' }, 'Che cosa cambia'))),
    h('tbody', righe.map(([ambito, voce, prima, dopo, tipo, regola]) => h('tr',
      h('th.agg-voce-riga', { scope: 'row' }, h('span.small.muted', ambito), h('span', voce)),
      h('td.r.num', numero(prima)), h('td.r.num', numero(dopo)),
      h('td', h(`span.tag.${TIPO_RIGA[tipo][0]}`, TIPO_RIGA[tipo][1]), regola ? h('span.small.muted', prima === dopo ? ' regola di calcolo diversa' : ' anche la regola di calcolo') : null))))));
}

function disegnaAvviso(nodo, bando, ridisegna) {
  svuota(nodo);
  const m = memo;
  const sorgente = m?.sorgenti?.[bando.id] ? sorgenteVuota(m.sorgenti[bando.id]) : null;
  const proposta = m?.proposte?.[bando.id] || null;
  const predefinito = [...BANDI_PREDEFINITI, ...SCHEDE_BANDI].find((b) => b.id === bando.id);
  const aggiornato = bando.aggiornato && predefinito && bando.aggiornato > (predefinito.revisione || '') ? confrontaGriglie(predefinito, bando) : null;
  const leggendo = letture.has(bando.id);
  const llm = llmAttivo();
  const pezzi = [];

  if (bando.aggiornato && !predefinito) {
    pezzi.push(h('div.notice.info.agg-avviso', { role: 'status' }, h('strong', 'Bando arrivato con l’aggiornamento automatico. '), `Scheda del ${giorno(bando.aggiornato)}, aggiunta dal catalogo dopo l’installazione del programma.`));
  }
  if (aggiornato) {
    pezzi.push(h('div.notice.info.agg-avviso', { role: 'status' },
      h('div', h('strong', 'Scheda aggiornata dal catalogo. '), `Revisione del ${giorno(bando.aggiornato)}, arrivata con l’aggiornamento automatico e già in uso al posto di quella del programma (${giorno(predefinito.revisione)}).`),
      aggiornato.uguale ? h('div.small', 'La griglia di valutazione non è cambiata: l’aggiornamento riguarda stato, date o note del bando.')
        : h('details.more', h('summary', `Che cosa è cambiato nella griglia (${quanti(aggiornato.generali.length + aggiornato.sezioni.length + aggiornato.criteri.length + aggiornato.categorie.length, 'voce', 'voci')})`), tabellaConfronto(aggiornato))));
  }

  if (sorgente?.nuovi.length) {
    const piu = sorgente.nuovi.length > 12;
    const voce = (d) => {
      const leggibile = llm && (d.tipo === 'pdf' || d.tipo === 'docx') && scaricabile(d.url, m.protocolli) && !sorgente.letti.includes(d.url);
      return h('li',
        h('span.tag.agg-tipo', d.tipo === 'pagina' ? 'pagina' : d.tipo.toUpperCase()),
        h('div.agg-doc',
          h('a', { href: urlSicuro(d.url), target: '_blank', rel: 'noopener noreferrer' }, d.titolo, h('span', { 'aria-hidden': 'true' }, ' ↗'), h('span.agg-sr', ' (si apre in una nuova scheda)')),
          h('div.small.muted', [nomeDaUrl(d.url) !== d.titolo ? nomeDaUrl(d.url) : null, `comparso ${quando(d.rilevato)}`, sorgente.letti.includes(d.url) ? 'già letto da Claude' : null].filter(Boolean).join(' · '))),
        leggibile ? h('button.btn.s', { type: 'button', disabled: leggendo || !!inCorso, title: 'Claude ricava la griglia da questo documento e la propone qui sotto: quella in uso non cambia', onclick: () => leggiDocumento(bando.id, d).catch((e) => toast(e?.message || 'Lettura non riuscita')) }, 'Fai leggere a Claude') : null);
    };
    const elenco = h('ul.agg-documenti', sorgente.nuovi.slice(0, 12).map(voce));
    pezzi.push(h('div.notice.warn.agg-avviso', { role: 'status', id: 'agg-novita-bando' },
      h('div', h('strong', 'Novità sulla pagina ufficiale. '), `${sorgente.nuovi.length === 1 ? 'È comparso un documento nuovo' : `Sono comparsi ${fmt(sorgente.nuovi.length, 0)} documenti nuovi`}: aprili per capire se cambiano regole, scadenze o modulistica. La griglia in uso non è stata toccata.`),
      elenco,
      piu ? h('details.more', h('summary', `Altri ${fmt(sorgente.nuovi.length - 12, 0)}`), h('ul.agg-documenti', sorgente.nuovi.slice(12).map(voce))) : null,
      leggendo ? h('div.small', h('span.spin', { 'aria-hidden': 'true' }), ` ${fase || 'Claude sta leggendo il documento…'}`) : null,
      h('div.row',
        h('button.btn.s', { type: 'button', id: 'agg-segna', onclick: () => segna(bando.id) }, 'Segna come controllato'),
        urlSicuro(sorgente.url) ? h('a.btn.s.ghost', { href: urlSicuro(sorgente.url), target: '_blank', rel: 'noopener noreferrer' }, 'Apri la pagina ufficiale', h('span', { 'aria-hidden': 'true' }, ' ↗'), h('span.agg-sr', ' (si apre in una nuova scheda)')) : null)));
  } else if (leggendo) {
    pezzi.push(h('div.notice.agg-avviso', { role: 'status' }, h('span.spin', { 'aria-hidden': 'true' }), ` ${fase || 'Claude sta leggendo il documento…'}`));
  }

  if (proposta?.bando) {
    const c = confrontaGriglie(bando, proposta.bando);
    pezzi.push(h('section.panel.stack.agg-proposta', { 'aria-labelledby': 'agg-proposta-titolo', id: 'agg-proposta' },
      h('div.spread', h('h3', { id: 'agg-proposta-titolo' }, 'Proposta di nuova griglia'), h('span.tag.warn', 'Da verificare')),
      h('p.agg-prosa', 'Claude ha letto ',
        urlSicuro(proposta.documento?.url) ? h('a', { href: urlSicuro(proposta.documento.url), target: '_blank', rel: 'noopener noreferrer' }, `«${proposta.documento.titolo || proposta.nomeFile}»`, h('span.agg-sr', ' (si apre in una nuova scheda)')) : `«${proposta.nomeFile || 'il nuovo avviso'}»`,
        ` ${quando(proposta.quando)} e ne ha ricavato questa griglia. `, h('strong', 'Non sostituisce quella verificata'), ': se la attivi diventa un bando a sé, segnato «da verificare», da confrontare con il testo dell’avviso prima di fidarsi dei punteggi.'),
      c.uguale ? h('div.notice.ok', 'Criteri, massimi e soglie coincidono con la griglia in uso: il nuovo documento non sembra cambiare la valutazione.')
        : h('div.stack-s',
          h('div.small', h('strong', 'Rispetto alla griglia in uso: '), [c.totali.cambiati ? quanti(c.totali.cambiati, 'criterio cambiato', 'criteri cambiati') : null, c.totali.nuovi ? quanti(c.totali.nuovi, 'criterio nuovo', 'criteri nuovi') : null, c.totali.tolti ? quanti(c.totali.tolti, 'criterio tolto', 'criteri tolti') : null,
            c.sezioni.length ? quanti(c.sezioni.length, 'sezione con un massimo diverso', 'sezioni con un massimo diverso') : null, c.generali.length || c.categorie.length ? 'soglie o regole generali diverse' : null].filter(Boolean).join(', ') || 'differenze nelle regole', '.'),
          tabellaConfronto(c)),
      proposta.avvisi?.length ? h('div.notice.warn', h('strong', 'Segnalazioni dalla lettura: '), h('ul.agg-punti', proposta.avvisi.slice(0, 12).map((a) => h('li', String(a))))) : null,
      h('div.row',
        h('button.btn.primary', { type: 'button', id: 'agg-attiva', onclick: () => attivaProposta(bando.id, ridisegna).catch((e) => toast(e?.message || 'Attivazione non riuscita')) }, 'Attiva come bando «da verificare»'),
        bottoneConferma('Scarta la proposta', 'Conferma: scarta', () => scartaProposta(bando.id), 'btn.ghost.danger'))));
  }

  nodo.hidden = pezzi.length === 0;
  metti(nodo, pezzi);
}

/** Avviso da mostrare nel dettaglio di un bando quando la pagina ufficiale è cambiata o c'è una proposta. Nodo o null. */
export function avvisoBando(bando, ridisegna) {
  if (!bando?.id) return null;
  const nodo = h('div.stack.agg-avvisi', { hidden: true });
  registra(nodo, () => disegnaAvviso(nodo, bando, ridisegna), ridisegna);
  disegnaAvviso(nodo, bando, ridisegna);
  if (!memo) carica().then(ridisegnaVivi, () => {});
  return nodo;
}
