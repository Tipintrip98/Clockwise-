// Apprendimento dai casi reali: come il punteggio dei commissari simulati viene corretto con ciò che le Commissioni
// vere hanno fatto. Due passi, entrambi dichiarati nel report criterio per criterio:
//
//  1. REGOLE — per ogni criterio a giudizio il voto è una media pesata tra i commissari simulati (leggono i documenti)
//     e il centro della fascia che il motore di regole ricava dai casi reali (core/ragionamento.js). Sono due stime
//     indipendenti dello stesso numero: dove la regola ha un riscontro diretto in un caso reale pesa quanto i commissari,
//     dove è un'estrapolazione pesa un quarto.
//
//  2. CASI — per ogni sezione si aggiunge una parte dello scarto medio (reale − stima) osservato nei dossier di cui si
//     conosce il punteggio vero: quelli incorporati nel programma e quelli che l'utente salva dal Report. Con pochi casi
//     la correzione è prudente (n ÷ (n + 1) dello scarto medio) e ha un tetto.
//
// I criteri calcolati e quelli con una tabella di punteggi nel bando non si toccano mai: lì decide la tabella.
// La lettura rigorosa non viene corretta: resta lo scenario peggiore previsto dal testo del bando.

/**
 * Scarti osservati nei casi reali incorporati: per ogni sezione, (punteggio della Commissione − stima di Clockwise) ÷ massimo
 * della sezione, misurati con la versione indicata dopo la correzione con le regole. Servono al secondo passo
 * dell'apprendimento. Nessun dato del progetto: solo frazioni.
 */
export const SCARTI_REALI = [
  // lungometraggio finanziato: dopo la correzione con le regole restava uno scarto quasi solo nella sezione dei soggetti
  { id: 'incorporato-1', bandoId: 'sicilia-2025-2027', griglia: 'A', versione: '2.0.3', sezioni: { A: 0.004, B: 0.035, D: 0.004 } },
];

const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const VERSIONE_APPRENDIMENTO = 1;
/** Peso della fascia reale rispetto ai commissari: regola con riscontro in un caso reale / estrapolazione. */
export const PESO_REGOLA = { caso: 0.5, altro: 0.25 };
/** Tetto della correzione appresa dai casi, in frazione del massimo della sezione. */
export const TETTO_CASI = 0.08;

/** Un criterio si corregge solo se è un giudizio puro: niente tabelle del bando, niente criteri bloccati. */
const correggibile = (a) => !!a && a.tipo === 'qualitativo' && !a.bloccante && !a.tabella && a.modo !== 'tabella' && Array.isArray(a.regole) && a.regole.length > 0 && Number.isFinite(a.centro);

/** Quanto pesa il centro della fascia per questo criterio (0 = non si corregge). */
export function pesoRegole(ancora) {
  if (!correggibile(ancora)) return 0;
  const diretto = ancora.regole.every((r) => r.riscontro === 'caso') && ancora.fiducia !== 'bassa' && ancora.modo !== 'inviluppo-possibili';
  return diretto ? PESO_REGOLA.caso : PESO_REGOLA.altro;
}

/**
 * Scarto medio per sezione dai casi reali di questo bando e di questa griglia.
 * casi: [{ bandoId, griglia, sezioni: { A: frazione (reale − stima) ÷ massimo } }]
 * @returns {{ [sezioneId]: { n, media, frazione } }}  frazione = quella applicata, già ridotta e con il tetto
 */
export function scartiAppresi(casi, bandoId, griglia) {
  const somme = {};
  for (const c of casi || []) {
    if (!c || c.bandoId !== bandoId || (c.griglia && griglia && c.griglia !== griglia)) continue;
    for (const [sid, f] of Object.entries(c.sezioni || {})) {
      if (!Number.isFinite(f)) continue;
      const s = (somme[sid] = somme[sid] || { n: 0, tot: 0 });
      s.n++; s.tot += clamp(f, -0.5, 0.5);
    }
  }
  const out = {};
  for (const [sid, s] of Object.entries(somme)) {
    const media = s.tot / s.n;
    out[sid] = { n: s.n, media: r3(media), frazione: r3(clamp(media * (s.n / (s.n + 1)), -TETTO_CASI, TETTO_CASI)) };
  }
  return out;
}

/** Casi incorporati nel programma più quelli salvati dall'utente (questi ultimi sostituiscono un incorporato con lo stesso id). */
export function tuttiICasi(utente = []) {
  const ids = new Set((utente || []).map((c) => c.id));
  return [...SCARTI_REALI.filter((c) => !ids.has(c.id)), ...(utente || [])];
}

/**
 * La correzione da applicare a una valutazione: si calcola quando la valutazione viene fatta e resta salvata con lei,
 * così il punteggio di un dossier non cambia da solo quando arrivano casi nuovi.
 * @param {object} ancore   risultato completo di ancoreTaratura()
 * @param {object} griglia  griglia della categoria (per i massimi di sezione)
 * @param {object[]} casi   casi reali (tuttiICasi)
 */
export function correzioneValutazione(ancore, griglia, casi = [], idGriglia = null) {
  if (!ancore?.criteri) return null;
  const appresi = scartiAppresi(casi, ancore.bandoId, idGriglia);
  const criteri = {};
  const sezioni = {};
  for (const sez of griglia?.sezioni || []) {
    const ids = sez.criteri.map((c) => c.id).filter((id) => correggibile(ancore.criteri[id]));
    const sommaMax = ids.reduce((a, id) => a + ancore.criteri[id].massimo, 0);
    const ap = appresi[sez.id];
    const puntiCasi = ap && sommaMax ? ap.frazione * sez.max : 0;
    if (ap && sommaMax) sezioni[sez.id] = { n: ap.n, media: ap.media, frazione: ap.frazione, punti: r1(puntiCasi) };
    for (const id of ids) {
      const a = ancore.criteri[id];
      const peso = pesoRegole(a);
      const casiCriterio = sommaMax ? puntiCasi * (a.massimo / sommaMax) : 0;
      if (peso || casiCriterio) criteri[id] = { centro: a.centro, peso, casi: r3(casiCriterio) };
    }
  }
  return Object.keys(criteri).length ? { versione: VERSIONE_APPRENDIMENTO, criteri, sezioni } : null;
}

/**
 * Applica la correzione alla media dei commissari di un criterio.
 * @returns {{ punti, grezzo, regole, casi }}  regole e casi sono le due parti della correzione, in punti
 */
export function correggi(grezzo, t, massimo) {
  if (!t || !Number.isFinite(grezzo)) return { punti: grezzo, grezzo, regole: 0, casi: 0 };
  const regole = (t.peso || 0) * ((Number.isFinite(t.centro) ? t.centro : grezzo) - grezzo);
  const dopoRegole = clamp(grezzo + regole, 0, massimo);
  const punti = r1(clamp(dopoRegole + (t.casi || 0), 0, massimo));
  return { punti, grezzo, regole: r3(dopoRegole - grezzo), casi: r3(punti - dopoRegole) };
}

/**
 * Il caso reale di un dossier, da salvare: per ogni sezione lo scarto tra il punteggio vero e la stima PRIMA della
 * correzione appresa dai casi (altrimenti la correzione imparerebbe da sé stessa).
 * @param {object} ris   risultato di componiRisultato()
 * @param {object} reale { [sezioneId]: punteggio della Commissione }
 */
export function casoDaDossier({ id, bandoId, griglia, categoriaId, anno, versione, ris, reale }) {
  const sezioni = {}; const dettaglio = {};
  for (const s of ris?.sezioni || []) {
    const v = reale?.[s.id];
    if (typeof v !== 'number' || !s.completo || !s.massimo) continue;
    if (!s.criteri.some((c) => c.fonte === 'commissione')) continue; // sezioni solo calcolate: niente da imparare
    const base = r1(s.punti - s.criteri.reduce((a, c) => a + (c.taratura?.casi || 0), 0));
    sezioni[s.id] = r3((v - base) / s.massimo);
    dettaglio[s.id] = { stima: base, reale: v, massimo: s.massimo };
  }
  if (!Object.keys(sezioni).length) return null;
  return { id: `dossier-${id}`, bandoId, griglia: griglia || null, categoriaId, anno: anno || null, versione: versione || null, data: new Date().toISOString().slice(0, 10), sezioni, dettaglio };
}

/** Testo breve per il report: da dove viene la correzione di una valutazione. */
export function descriviCorrezione(correzione, ris) {
  if (!correzione) return null;
  let grezzo = 0, regole = 0, casi = 0, n = 0;
  for (const s of ris?.sezioni || []) for (const c of s.criteri) if (c.taratura) { grezzo += c.taratura.grezzo; regole += c.taratura.regole; casi += c.taratura.casi; n++; }
  if (!n) return null;
  const nCasi = Math.max(0, ...Object.values(correzione.sezioni || {}).map((s) => s.n));
  return { criteri: n, regole: r1(regole), casi: r1(casi), totale: r1(regole + casi), nCasi };
}
