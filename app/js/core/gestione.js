// Gestione del bando dopo la concessione: tappe e scadenze, erogazione del contributo, registro delle spese,
// rendiconto, punteggio da mantenere a consuntivo e cronoprogramma. Logica pura: niente DOM, niente archivio.
// Le regole specifiche vengono sempre dal bando in uso (scadenze, erogazione, minimi); dove il bando non
// dice nulla il programma lo dichiara («verifica sull'avviso») invece di inventare una norma.
import { GRUPPI, voceProposta, totaliPreventivo } from './preventivo.js';
import { getCategoria, getGriglia, elencoCriteri, valutaQuantitativo, r1 } from './scoring.js';

/* ------------------------------------------------------------------ date */

const GIORNO = 86400000;
const due = (n) => String(n).padStart(2, '0');
const iso = (anno, mese, giorno) => `${String(anno).padStart(4, '0')}-${due(mese)}-${due(giorno)}`;
const ultimoDelMese = (anno, mese) => new Date(Date.UTC(anno, mese, 0)).getUTCDate();
const utc = (d) => { const [a, m, g] = d.split('-').map(Number); return Date.UTC(a, m - 1, g); };

/** Vero se la stringa è una data ISO (aaaa-mm-gg) che esiste davvero nel calendario. */
export function eData(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [a, m, g] = v.split('-').map(Number);
  return a >= 1900 && m >= 1 && m <= 12 && g >= 1 && g <= ultimoDelMese(a, m);
}
export const oggiIso = (d = new Date()) => iso(d.getFullYear(), d.getMonth() + 1, d.getDate());

/** Stesso giorno del mese dopo N mesi; se il mese d'arrivo è più corto, l'ultimo suo giorno (31 agosto + 6 mesi = 28 o 29 febbraio). */
export function aggiungiMesi(data, mesi) {
  if (!eData(data) || !Number.isFinite(Number(mesi))) return null;
  const [a, m, g] = data.split('-').map(Number);
  const indice = a * 12 + (m - 1) + Math.trunc(Number(mesi));
  const anno = Math.floor(indice / 12), mese = (indice % 12 + 12) % 12 + 1;
  return iso(anno, mese, Math.min(g, ultimoDelMese(anno, mese)));
}
export function aggiungiGiorni(data, giorni) {
  if (!eData(data) || !Number.isFinite(Number(giorni))) return null;
  return new Date(utc(data) + Math.trunc(Number(giorni)) * GIORNO).toISOString().slice(0, 10);
}
/** Giorni di calendario da «da» ad «a» (negativo se «a» viene prima). */
export function giorniTra(da, a) {
  return eData(da) && eData(a) ? Math.round((utc(a) - utc(da)) / GIORNO) : null;
}
export const dataEstesa = (d) => (eData(d) ? new Date(utc(d)).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
export const dataCorta = (d) => (eData(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
const quantiGiorni = (n) => (n === 1 ? '1 giorno' : `${n.toLocaleString('it-IT')} giorni`);

/* ------------------------------------------------------------------ dati della gestione */

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const cent = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
let contatore = 0;
const nuovoId = (prefisso) => `${prefisso}${Date.now().toString(36)}${(contatore++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const TAPPE = [
  { id: 'presentazione', nome: 'Presentazione della domanda', guida: 'Invio del dossier nella finestra del bando.' },
  { id: 'concessione', nome: 'Graduatoria e concessione', guida: 'Notifica del decreto di concessione: da questa data decorrono i termini.' },
  { id: 'accettazione', nome: 'Accettazione del contributo', guida: 'Accettazione formale e documenti chiesti dal decreto, se previsti.' },
  { id: 'inizioRiprese', nome: 'Inizio delle riprese', guida: 'Primo giorno di riprese (o di lavorazione, per l’animazione).' },
  { id: 'fineRiprese', nome: 'Fine delle riprese', guida: 'Ultimo giorno di riprese (o di lavorazione).' },
  { id: 'rendicontazione', nome: 'Rendicontazione', guida: 'Consegna del rendiconto finale e dei materiali chiesti dall’avviso.' },
  { id: 'saldo', nome: 'Saldo del contributo', guida: 'Richiesta e incasso dell’ultima quota.' },
  { id: 'uscita', nome: 'Uscita dell’opera', guida: 'Uscita in sala, messa in onda o prima fruizione pubblica.' },
];

export const ADEMPIMENTI_TIPICI = [
  'Rendiconto certificato o asseverato da un revisore, se l’avviso lo chiede',
  'Copia campione dell’opera e materiali da consegnare all’ente',
  'Loghi dell’ente nei titoli di testa e di coda, approvati dall’ente se richiesto',
  'Regolarità contributiva (DURC) valida alla data della richiesta',
  'Relazione finale e dichiarazioni sulla modulistica dell’avviso',
];

export function gestioneVuota() {
  return {
    contributoConcesso: null, cup: '',
    tappe: Object.fromEntries(TAPPE.map((t) => [t.id, { data: '', fatta: false, termine: '' }])),
    proroghe: {}, scadenzeLibere: [],
    erogazione: { personalizzate: false, quote: [], fideiussione: { attiva: true, tasso: 2, mesi: null, costo: null }, stati: {} },
    spese: [], ivaCosto: false, periodo: { dal: '', al: '' },
    effettivi: { giorni: {}, professionisti: {}, spesaTerritorio: null },
    adempimenti: null,
    crono: { fasi: {} },
  };
}

/** Completa in loco i campi mancanti di p.gestione (dossier nuovi o salvati da versioni precedenti). */
export function assicuraGestione(g) {
  const base = gestioneVuota();
  const out = g && typeof g === 'object' ? g : {};
  for (const [k, v] of Object.entries(base)) if (out[k] == null && k !== 'contributoConcesso' && k !== 'adempimenti') out[k] = v;
  if (!('contributoConcesso' in out)) out.contributoConcesso = null;
  for (const t of TAPPE) out.tappe[t.id] = { data: '', fatta: false, termine: '', ...(out.tappe[t.id] || {}) };
  out.erogazione = { ...base.erogazione, ...out.erogazione, fideiussione: { ...base.erogazione.fideiussione, ...(out.erogazione?.fideiussione || {}) } };
  out.erogazione.stati = out.erogazione.stati || {};
  out.erogazione.quote = Array.isArray(out.erogazione.quote) ? out.erogazione.quote : [];
  out.periodo = { dal: '', al: '', ...(out.periodo || {}) };
  out.effettivi = { spesaTerritorio: null, ...(out.effettivi || {}) };
  out.effettivi.giorni = out.effettivi.giorni || {};
  out.effettivi.professionisti = out.effettivi.professionisti || {};
  out.crono = { ...(out.crono || {}) };
  out.crono.fasi = out.crono.fasi || {};
  if (!Array.isArray(out.spese)) out.spese = [];
  if (!Array.isArray(out.scadenzeLibere)) out.scadenzeLibere = [];
  if (!Array.isArray(out.adempimenti)) out.adempimenti = ADEMPIMENTI_TIPICI.map((testo, i) => ({ id: `a${i + 1}`, testo, fatto: false }));
  return out;
}

/* ------------------------------------------------------------------ che cosa dice il bando */

const semplice = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]+/g, ' ').trim();

export const TEMI_BANDO = {
  punteggio: /(diminuzione|riduzione) del punteggio|parametri[^.\n]*punteggi|punteggi[^.\n]*(a consuntivo|rendicontazion)|parametri che hanno generato punteggio/i,
  contanti: /contanti|tracciabilit/i,
  periodo: /tra la data di presentazione|periodo di (eleggibilit|ammissibilit)/i,
  consuntivo: /consuntivo[^.\n]*non pu[oò]|non potr[aà] essere inferiore|costo di produzione inferiore/i,
  territorio: /spes[ae] ammissibil[ei][^.\n]*(inferiore|almeno)[^.\n]*%/i,
  iva: /\bIVA\b[^.\n]*recuperabil/i,
  proroga: /prorog/i,
};

/**
 * Frasi del bando in uso che parlano di un tema, riportate alla lettera con la fonte.
 * Cerca nel testo dell'avviso (bando.testi), poi in note, scadenze e condizioni di erogazione.
 * @returns {{ fonte: string, testo: string }[]}
 */
export function citaBando(bando, espressione, massimo = 2) {
  const data = espressione instanceof RegExp ? espressione : TEMI_BANDO[espressione];
  if (!data || !bando) return [];
  const re = new RegExp(data.source, data.flags.replace(/[gy]/g, ''));
  const out = [], viste = new Set();
  const aggiungi = (fonte, paragrafo) => {
    const testo = estratto(String(paragrafo || '').replace(/\s+/g, ' ').trim(), re);
    if (!testo || viste.has(testo) || out.length >= massimo) return;
    viste.add(testo);
    out.push({ fonte, testo });
  };
  // una voce d'elenco («- in cui la spesa…») si cita con la frase che la introduce («…revocato nei casi:»), altrimenti non si capisce
  for (const a of Array.isArray(bando.testi) ? bando.testi : []) {
    let introduzione = '';
    for (const riga of String(a?.testo || '').split('\n')) {
      const voce = riga.match(/^\s*[-–•]\s*(.*)$/);
      if (!voce) { introduzione = /:\s*$/.test(riga) ? riga.trim().replace(/\s+:$/, ':') : ''; aggiungi(a.titolo || 'Avviso', riga); continue; }
      aggiungi(a.titolo || 'Avviso', introduzione ? `${introduzione} […] ${voce[1]}` : voce[1]);
    }
  }
  const nome = bando.nomeBreve || bando.nome || 'Bando';
  for (const n of bando.note || []) aggiungi(`${nome} — note`, n);
  for (const s of bando.scadenze || []) aggiungi(`${nome} — scadenze`, s.nota);
  for (const n of bando.scadenzeNote || []) aggiungi(`${nome} — scadenze`, n);
  for (const q of bando.erogazione || []) aggiungi(`${nome} — erogazione`, q.condizione);
  return out;
}
// Il paragrafo che contiene il passo; se è lungo, la parte attorno al passo a partire dall'inizio della frase.
const LUNGHEZZA_CITAZIONE = 420;
function estratto(paragrafo, re) {
  const m = re.exec(paragrafo);
  if (!m) return '';
  if (paragrafo.length <= LUNGHEZZA_CITAZIONE) return paragrafo;
  let inizio = null;
  for (const x of paragrafo.slice(0, m.index).matchAll(/[.;:]\s+(?=[A-ZÀ-Ý])/g)) {
    const qui = x.index + x[0].length;
    if (m.index - qui <= 240) { inizio = qui; break; }
  }
  const daFrase = inizio != null || m.index <= 240;
  if (inizio == null) inizio = m.index <= 240 ? 0 : paragrafo.indexOf(' ', m.index - 200) + 1;
  let testo = paragrafo.slice(inizio, inizio + LUNGHEZZA_CITAZIONE);
  if (inizio + LUNGHEZZA_CITAZIONE < paragrafo.length) testo = `${testo.replace(/\s+\S*$/, '')}…`;
  return daFrase ? testo : `…${testo}`;
}

/* ------------------------------------------------------------------ tappe e scadenze */

const TAPPA_PER_ID = { riprese: 'fineRiprese', fineriprese: 'fineRiprese', 'fine-riprese': 'fineRiprese', rendiconto: 'rendicontazione', rendicontazione: 'rendicontazione', saldo: 'saldo', uscita: 'uscita', accettazione: 'accettazione', inizioriprese: 'inizioRiprese', 'inizio-riprese': 'inizioRiprese' };
const REGOLE_TAPPA = [
  ['rendicontazione', /rendicont|consuntiv/],
  ['inizioRiprese', /(inizio|avvio) (delle |della )?(riprese|lavorazion)/],
  ['accettazione', /accettazion/],
  ['saldo', /\bsaldo\b/],
  ['uscita', /uscita|messa in onda|fruizione|prima proiezione/],
  ['fineRiprese', /riprese|lavorazion/],
];
/** Tappa a cui si riferisce una scadenza del bando (null se è una scadenza a sé). */
export function tappaDellaScadenza(s) {
  const perId = TAPPA_PER_ID[String(s?.id || '').toLowerCase()];
  if (perId) return perId;
  const t = semplice(s?.etichetta);
  return REGOLE_TAPPA.find(([, re]) => re.test(t))?.[0] || null;
}

/** Proroga massima in mesi scritta nella nota della scadenza (null se la nota non la indica). */
export function prorogaMassima(s) {
  if (num(s?.prorogaMaxMesi) != null) return s.prorogaMaxMesi;
  const m = /prorog[^.]*?(?:non pi[uù] di|fino a|massimo|al massimo|non oltre|non superiore a)\s+(\d{1,2})\s+mes/i.exec(String(s?.nota || ''));
  return m ? Number(m[1]) : null;
}

const GRAVITA = { rosso: 3, giallo: 2, verde: 1, grigio: 0, fatto: 0 };
const SOGLIA_ROSSO = 14, SOGLIA_GIALLO = 90;

function valutaScadenza(v, oggi) {
  const giorni = v.termine ? giorniTra(oggi, v.termine) : null;
  let semaforo = 'grigio', messaggio = '';
  const finestraProroga = v.limiteProroga && !v.prorogaMesi ? (giorniTra(oggi, v.limiteProroga) >= 0 ? ` Per la proroga la richiesta va fatta entro il ${dataEstesa(v.limiteProroga)}.` : ' Il termine per chiedere la proroga è passato.') : '';
  if (v.fatta) { semaforo = 'fatto'; messaggio = v.data ? `Fatto il ${dataEstesa(v.data)}.` : 'Fatto.'; }
  else if (v.termine) {
    if (giorni < 0) { semaforo = 'rosso'; messaggio = `Termine scaduto da ${quantiGiorni(-giorni)}.`; }
    else if (v.data && v.data > v.termine) { semaforo = 'rosso'; messaggio = `La data prevista (${dataEstesa(v.data)}) supera il termine di ${quantiGiorni(giorniTra(v.termine, v.data))}.${finestraProroga}`; }
    else if (giorni <= SOGLIA_ROSSO) { semaforo = 'rosso'; messaggio = giorni === 0 ? 'Scade oggi.' : `Mancano ${quantiGiorni(giorni)}.`; }
    else if (giorni <= SOGLIA_GIALLO) { semaforo = 'giallo'; messaggio = `Mancano ${quantiGiorni(giorni)}.${finestraProroga}`; }
    else { semaforo = 'verde'; messaggio = `Mancano ${quantiGiorni(giorni)}.`; }
  } else if (v.data) {
    const g = giorniTra(oggi, v.data);
    if (g < 0) { semaforo = 'giallo'; messaggio = `Data prevista passata da ${quantiGiorni(-g)}: segna la tappa come fatta o aggiorna la data.`; }
    else messaggio = g === 0 ? 'Prevista per oggi.' : `Prevista tra ${quantiGiorni(g)}.`;
  } else if (v.attesa) messaggio = v.attesa;
  return { ...v, giorni, semaforo, messaggio };
}

/**
 * Stato di tappe e scadenze a una certa data.
 * dataDecreto è la notifica del decreto di concessione (p.legale.dataDecreto): da lì decorrono i termini del bando.
 * @returns {{ tappe: object[], altre: object[], semaforo: string, adesso: object, prossima: object|null, note: string[] }}
 */
export function statoTappe({ bando, anno, gestione, dataDecreto, oggi = oggiIso() }) {
  const g = assicuraGestione(gestione);
  const decreto = eData(dataDecreto) ? dataDecreto : '';
  const finestra = (bando?.finestre || []).find((f) => f.anno === Number(anno));
  const delBando = new Map(), sciolte = [];
  for (const s of bando?.scadenze || []) {
    const tappa = tappaDellaScadenza(s);
    if (tappa && !delBando.has(tappa)) delBando.set(tappa, s); else sciolte.push(s);
  }
  const daBando = (s) => {
    const originario = decreto ? aggiungiMesi(decreto, s.mesi) : null;
    const prorogaMesi = Math.max(0, Math.trunc(Number(g.proroghe[s.id]) || 0));
    return {
      scadenzaId: s.id, origine: 'bando', mesi: s.mesi, nota: s.nota || '', preavvisoGiorni: s.preavvisoGiorni ?? null,
      prorogaMax: prorogaMassima(s), prorogaMesi, termineOriginario: originario,
      termine: originario ? aggiungiMesi(originario, prorogaMesi) : null,
      limiteProroga: originario && s.preavvisoGiorni ? aggiungiGiorni(originario, -s.preavvisoGiorni) : null,
      attesa: originario ? '' : `Entro ${s.mesi} mesi dalla notifica del decreto: inserisci la data per calcolare il termine.`,
    };
  };
  const tappe = TAPPE.map((t) => {
    const mia = g.tappe[t.id];
    let v = { id: t.id, nome: t.nome, guida: t.guida, data: eData(mia.data) ? mia.data : '', fatta: !!mia.fatta, origine: null, termine: null, nota: '' };
    if (t.id === 'concessione') v = { ...v, data: decreto, fatta: !!decreto && decreto <= oggi, attesa: 'Quando arriva il decreto inserisci la data di notifica: da lì decorrono i termini.' };
    else if (delBando.has(t.id)) v = { ...v, etichettaBando: delBando.get(t.id).etichetta, ...daBando(delBando.get(t.id)) };
    else if (t.id === 'presentazione' && finestra?.al) v = { ...v, origine: 'finestra', termine: finestra.al, nota: `Finestra ${finestra.anno}${finestra.dal ? `: dal ${dataEstesa(finestra.dal)}` : ''} al ${dataEstesa(finestra.al)}.` };
    else if (eData(mia.termine)) v = { ...v, origine: 'manuale', termine: mia.termine };
    const esito = valutaScadenza(v, oggi);
    // con il decreto in mano la domanda è stata per forza presentata; a finestra chiusa non è un termine mancato ma un dato da confermare
    if (t.id === 'presentazione' && !esito.fatta && decreto) return { ...esito, fatta: true, implicita: true, semaforo: 'fatto', messaggio: 'Fatta: c’è già il decreto di concessione.' };
    if (t.id === 'presentazione' && !esito.fatta && esito.origine === 'finestra' && esito.giorni < 0) return { ...esito, semaforo: 'giallo', messaggio: `La finestra si è chiusa il ${dataEstesa(esito.termine)}: se hai presentato la domanda, segna la tappa come fatta.` };
    return esito;
  });
  const altre = [
    ...sciolte.map((s) => valutaScadenza({ id: `bando:${s.id}`, nome: s.etichetta, data: '', fatta: !!g.tappe[`bando:${s.id}`]?.fatta, ...daBando(s) }, oggi)),
    ...g.scadenzeLibere.map((s) => valutaScadenza({ id: s.id, nome: s.etichetta || 'Scadenza', data: '', fatta: !!s.fatta, origine: 'libera', termine: eData(s.data) ? s.data : null, nota: s.nota || '', attesa: 'Senza data.' }, oggi)),
  ];
  const tutte = [...tappe, ...altre];
  const aperte = tutte.filter((x) => !x.fatta && x.termine).sort((a, b) => a.termine.localeCompare(b.termine));
  const semaforo = tutte.reduce((peggiore, x) => (GRAVITA[x.semaforo] > GRAVITA[peggiore] ? x.semaforo : peggiore), 'grigio');
  return { tappe, altre, semaforo: semaforo === 'grigio' && tutte.every((x) => x.fatta) ? 'verde' : semaforo, prossima: aperte[0] || null, adesso: cosaFareAdesso({ tappe, altre, oggi }), note: [...(bando?.scadenzeNote || [])] };
}

const AZIONI = {
  presentazione: (t) => [t.termine ? `Presenta la domanda entro il ${dataEstesa(t.termine)}` : 'Presenta la domanda', 'Quando l’hai inviata, segna la tappa come fatta con la data di invio: da quella data possono decorrere le spese ammissibili.'],
  concessione: () => ['In attesa della graduatoria', 'Quando ricevi il decreto di concessione inserisci la data di notifica: i termini del bando decorrono da lì.'],
  accettazione: () => ['Accetta il contributo', 'Invia l’accettazione e i documenti chiesti dal decreto, nei modi e nei tempi che indica. Se l’avviso non la prevede, segna la tappa come fatta.'],
  inizioRiprese: () => ['Fissa l’inizio delle riprese', 'Indica la data prevista e, se l’avviso lo chiede, comunicala all’ente prima di cominciare.'],
  fineRiprese: (t) => [t.termine ? `Chiudi le riprese entro il ${dataEstesa(t.termine)}` : 'Chiudi le riprese', 'Indica la data prevista di fine riprese e comunicala all’ente quando sono concluse.'],
  rendicontazione: (t) => [t.termine ? `Presenta il rendiconto entro il ${dataEstesa(t.termine)}` : 'Prepara il rendiconto', 'Chiudi il registro delle spese e controlla nella sezione Rendiconto che cosa manca.'],
  saldo: () => ['Chiedi il saldo', 'Controlla nella sezione Rendiconto che cosa manca e aggiorna lo stato delle quote in Erogazione.'],
  uscita: (t) => [t.termine ? `Documenta l’uscita dell’opera entro il ${dataEstesa(t.termine)}` : 'Documenta l’uscita dell’opera', 'Uscita in sala, messa in onda o prima fruizione pubblica: conserva la prova da trasmettere all’ente.'],
};

/** Una sola indicazione: la cosa più urgente, altrimenti il prossimo passo nell'ordine delle tappe. */
export function cosaFareAdesso({ tappe, altre = [], oggi = oggiIso() }) {
  const urgenti = [...tappe, ...altre].filter((x) => x.semaforo === 'rosso').sort((a, b) => (a.giorni ?? 0) - (b.giorni ?? 0));
  if (urgenti.length) {
    const u = urgenti[0];
    return { id: u.id, semaforo: 'rosso', titolo: u.giorni != null && u.giorni < 0 ? `Termine scaduto: ${u.nome.toLowerCase()}` : `Urgente: ${u.nome.toLowerCase()}`, dettaglio: u.messaggio, termine: u.termine, giorni: u.giorni, riferimento: u.nome };
  }
  const prossima = tappe.find((t) => !t.fatta);
  if (!prossima) return { id: null, semaforo: 'verde', titolo: 'Tutte le tappe sono concluse', dettaglio: 'Conserva la documentazione del progetto per i controlli successivi.', termine: null, giorni: null, riferimento: null };
  const [titolo, dettaglio] = AZIONI[prossima.id](prossima);
  // accanto al prossimo passo si mostra il termine aperto più vicino, anche se riguarda un'altra tappa
  const rif = [...tappe, ...altre].filter((x) => !x.fatta && x.termine && x.termine >= oggi).sort((a, b) => a.termine.localeCompare(b.termine))[0] || null;
  const coda = rif && rif !== prossima ? ` Prossimo termine: ${rif.nome.toLowerCase()}, ${dataEstesa(rif.termine)}.` : '';
  const semaforo = prossima.semaforo !== 'grigio' ? prossima.semaforo : rif ? rif.semaforo : 'grigio';
  return { id: prossima.id, semaforo, titolo, dettaglio: `${dettaglio}${prossima.semaforo === 'giallo' && !prossima.termine && prossima.messaggio ? ` ${prossima.messaggio}` : ''}${coda}`, termine: rif?.termine || null, giorni: rif?.giorni ?? null, riferimento: rif ? rif.nome : null };
}

/* ------------------------------------------------------------------ erogazione */

export const STATI_QUOTA = [{ id: 'da_chiedere', nome: 'Da chiedere' }, { id: 'chiesta', nome: 'Chiesta' }, { id: 'incassata', nome: 'Incassata' }];

/** Quote previste dal bando (bando.erogazione). Una quota di anticipo subordinata a una garanzia è marcata «garanzia». */
export function quoteDaBando(bando) {
  return (bando?.erogazione || []).map((q, i) => ({
    id: `q${i + 1}`, nome: q.quota, percentuale: num(q.percentuale) ?? 0, condizione: q.condizione || '',
    garanzia: /anticip|acconto/i.test(q.quota) && /fideiuss|fidejuss|garanzia|polizza/i.test(q.condizione || ''),
  }));
}
export const quoteInUso = (bando, gestione) => (gestione?.erogazione?.personalizzate ? gestione.erogazione.quote : quoteDaBando(bando));

/**
 * Importi e stato delle quote sul contributo concesso.
 * Senza fideiussione le quote che la richiedono non si possono chiedere: la loro parte passa alla quota successiva
 * («fino alla concorrenza del…»). L'ultima quota attiva assorbe gli arrotondamenti al centesimo.
 */
export function pianoErogazione({ quote = [], contributo = null, fideiussione = true, stati = {} }) {
  const c = num(contributo);
  const avvisi = [];
  let riporto = 0, cumulata = 0;
  const righe = quote.map((q) => {
    const pct = Math.max(0, num(q.percentuale) ?? 0);
    const attiva = !(q.garanzia && !fideiussione);
    const effettiva = attiva ? pct + riporto : 0;
    riporto = attiva ? 0 : riporto + pct;
    cumulata += effettiva;
    const st = stati[q.id] || {};
    const stato = attiva && STATI_QUOTA.some((x) => x.id === st.stato) ? st.stato : 'da_chiedere';
    return { ...q, attiva, percentualeEffettiva: cent(effettiva), cumulata: cent(cumulata), stato, chiestaIl: eData(st.chiestaIl) ? st.chiestaIl : '', incassataIl: eData(st.incassataIl) ? st.incassataIl : '', importo: null, incassato: null };
  });
  const totalePct = cent(cumulata);
  if (riporto > 0) avvisi.push(`Il ${riporto.toLocaleString('it-IT')}% delle quote che richiedono la fideiussione non è assegnato a nessuna quota successiva.`);
  if (righe.length && Math.abs(totalePct - 100) > 0.005) avvisi.push(`Le quote sommano al ${totalePct.toLocaleString('it-IT')}% del contributo${totalePct < 100 ? `: il ${cent(100 - totalePct).toLocaleString('it-IT')}% restante non è assegnato` : ''}.`);
  let previsto = 0, incassato = 0, chiesto = 0;
  if (c != null) {
    const attive = righe.filter((r) => r.attiva && r.percentualeEffettiva > 0);
    const totale = cent((c * totalePct) / 100);
    let somma = 0;
    attive.forEach((r, i) => {
      r.importo = i === attive.length - 1 ? cent(totale - somma) : cent((c * r.percentualeEffettiva) / 100);
      somma = cent(somma + r.importo);
    });
    for (const r of righe) {
      if (r.importo == null) r.importo = 0;
      const st = stati[r.id] || {};
      if (r.stato === 'incassata') { r.incassato = num(st.incassato) ?? r.importo; incassato += r.incassato; }
      else if (r.stato === 'chiesta') chiesto += r.importo;
    }
    previsto = totale;
    if (incassato > c + 0.005) avvisi.push('L’incassato supera il contributo concesso: controlla gli importi.');
  }
  return { righe, totalePct, contributo: c, previsto: c == null ? null : previsto, incassato: c == null ? null : cent(incassato), chiesto: c == null ? null : cent(chiesto), residuo: c == null ? null : cent(c - incassato), avvisi };
}

/** Costo stimato di una fideiussione: importo garantito × tasso annuo × durata. È una stima: vale il preventivo del garante. */
export function costoFideiussione({ importo, tasso, mesi }) {
  const i = num(importo), t = num(tasso), m = num(mesi);
  return i != null && t != null && m != null && i >= 0 && t >= 0 && m >= 0 ? cent((i * t * m) / 1200) : null;
}

/** Durata proposta per la fideiussione: i mesi tra la concessione e la rendicontazione, se il bando li indica. */
export function mesiFideiussione(bando) {
  const s = (bando?.scadenze || []).find((x) => tappaDellaScadenza(x) === 'rendicontazione');
  return s?.mesi || 12;
}

/* ------------------------------------------------------------------ registro delle spese */

export const VOCI_SPESA = GRUPPI.map((g) => ({ id: `A.${g.id}`, nome: g.nome, nonAmmissibile: !!g.nonAmmissibile }));
const VOCE_PER_ID = new Map(VOCI_SPESA.map((v) => [v.id, v]));
export const nomeVoce = (id) => VOCE_PER_ID.get(id)?.nome || 'Senza voce';

export const MEZZI = [
  { id: 'bonifico', nome: 'Bonifico', tracciabile: true },
  { id: 'carta', nome: 'Carta o bancomat', tracciabile: true },
  { id: 'assegno', nome: 'Assegno non trasferibile', tracciabile: true },
  { id: 'addebito', nome: 'Addebito diretto', tracciabile: true },
  { id: 'f24', nome: 'F24', tracciabile: true },
  { id: 'altro', nome: 'Altro mezzo tracciabile', tracciabile: true },
  { id: 'contanti', nome: 'Contanti', tracciabile: false },
];
const MEZZO_PER_ID = new Map(MEZZI.map((m) => [m.id, m]));
export const nomeMezzo = (id) => MEZZO_PER_ID.get(id)?.nome || '';

const testoPulito = (v, max = 300) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Riga del registro con tutti i campi nei tipi giusti. Le spese generali (non ammissibili per definizione) nascono non ammissibili. */
export function nuovaSpesa(d = {}) {
  const voce = VOCE_PER_ID.has(d.voce) ? d.voce : '';
  return {
    id: d.id || nuovoId('s'),
    data: eData(d.data) ? d.data : '', fornitore: testoPulito(d.fornitore, 200), descrizione: testoPulito(d.descrizione, 400), voce,
    imponibile: num(d.imponibile), iva: num(d.iva),
    territorio: d.territorio === true, ammissibile: d.ammissibile == null ? !VOCE_PER_ID.get(voce)?.nonAmmissibile : d.ammissibile === true,
    pagataIl: eData(d.pagataIl) ? d.pagataIl : '', mezzo: MEZZO_PER_ID.has(d.mezzo) ? d.mezzo : '',
    documento: testoPulito(d.documento, 80), note: testoPulito(d.note, 400),
  };
}

/** Importo che conta per il rendiconto: l'imponibile, più l'IVA solo se per la società è un costo (non recuperabile). */
export const importoSpesa = (r, ivaCosto = false) => (num(r.imponibile) || 0) + (ivaCosto ? num(r.iva) || 0 : 0);

export const PROBLEMI = {
  senza_importo: 'manca l’importo', senza_data: 'manca la data del documento', senza_fornitore: 'manca il fornitore', senza_documento: 'manca il numero del documento',
  senza_voce: 'manca la voce di budget', non_pagata: 'non risulta pagata', senza_mezzo: 'manca il mezzo di pagamento', non_tracciabile: 'pagamento non tracciabile',
  fuori_periodo: 'fuori dal periodo di ammissibilità', pagata_prima: 'pagata prima della data del documento', generali_ammissibili: 'spesa generale segnata come ammissibile',
};
const BLOCCANTI = new Set(['non_tracciabile', 'fuori_periodo', 'generali_ammissibili']);

/** Che cosa non va in una riga, come elenco di codici (vedi PROBLEMI). I difetti bloccanti contano solo per le spese ammissibili. */
export function problemiSpesa(r, { periodo } = {}) {
  const out = [];
  if (num(r.imponibile) == null || r.imponibile === 0) out.push('senza_importo');
  if (!r.data) out.push('senza_data');
  if (!r.fornitore) out.push('senza_fornitore');
  if (!r.documento) out.push('senza_documento');
  if (!r.voce) out.push('senza_voce');
  if (!r.pagataIl) out.push('non_pagata');
  else if (!r.mezzo) out.push('senza_mezzo');
  if (r.pagataIl && r.data && r.pagataIl < r.data && giorniTra(r.pagataIl, r.data) > 60) out.push('pagata_prima');
  if (r.ammissibile) {
    if (r.mezzo && !MEZZO_PER_ID.get(r.mezzo)?.tracciabile) out.push('non_tracciabile');
    if (r.data && ((eData(periodo?.dal) && r.data < periodo.dal) || (eData(periodo?.al) && r.data > periodo.al))) out.push('fuori_periodo');
    if (VOCE_PER_ID.get(r.voce)?.nonAmmissibile) out.push('generali_ammissibili');
  }
  return out;
}
export const eBloccante = (codice) => BLOCCANTI.has(codice);

/** Totali del registro per voce di budget e complessivi. */
export function totaliSpese(spese, { ivaCosto = false } = {}) {
  const vuota = (id, nome) => ({ id, nome, righe: 0, imponibile: 0, iva: 0, costo: 0, ammissibile: 0, territorio: 0, pagato: 0, daPagare: 0 });
  const perVoce = new Map(VOCI_SPESA.map((v) => [v.id, vuota(v.id, v.nome)]));
  perVoce.set('', vuota('', 'Senza voce'));
  const totale = vuota('totale', 'Totale');
  for (const r of spese || []) {
    const v = perVoce.get(VOCE_PER_ID.has(r.voce) ? r.voce : '');
    const costo = importoSpesa(r, ivaCosto);
    for (const t of [v, totale]) {
      t.righe += 1; t.imponibile += num(r.imponibile) || 0; t.iva += num(r.iva) || 0; t.costo += costo;
      if (r.ammissibile) { t.ammissibile += costo; if (r.territorio) t.territorio += costo; }
      if (r.pagataIl) t.pagato += (num(r.imponibile) || 0) + (num(r.iva) || 0); else t.daPagare += (num(r.imponibile) || 0) + (num(r.iva) || 0);
    }
  }
  const tondo = (t) => ({ ...t, imponibile: cent(t.imponibile), iva: cent(t.iva), costo: cent(t.costo), ammissibile: cent(t.ammissibile), territorio: cent(t.territorio), pagato: cent(t.pagato), daPagare: cent(t.daPagare) });
  return { voci: [...perVoce.values()].filter((v) => v.id || v.righe).map(tondo), totale: tondo(totale) };
}

export const FILTRI_STATO = [
  { id: '', nome: 'Tutte le spese' }, { id: 'territorio', nome: 'Nel territorio' }, { id: 'fuori', nome: 'Fuori dal territorio' },
  { id: 'non_ammissibili', nome: 'Non ammissibili' }, { id: 'da_pagare', nome: 'Da pagare' }, { id: 'problemi', nome: 'Con qualcosa da sistemare' },
];

/** Filtro del registro: testo libero (fornitore, descrizione, numero, note), voce e stato. */
export function filtraSpese(spese, { testo = '', voce = '', stato = '' } = {}, contesto = {}) {
  const parole = String(testo ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return (spese || []).filter((r) => {
    if (voce === 'nessuna' ? r.voce : voce && r.voce !== voce) return false;
    if (stato === 'territorio' && !r.territorio) return false;
    if (stato === 'fuori' && r.territorio) return false;
    if (stato === 'non_ammissibili' && r.ammissibile) return false;
    if (stato === 'da_pagare' && r.pagataIl) return false;
    if (stato === 'problemi' && !problemiSpesa(r, contesto).length) return false;
    if (!parole.length) return true;
    // ogni parola va trovata com'è scritta («10/2026», «ft 114») oppure senza accenti e punteggiatura («caffè» trova «Caffetteria»)
    const grezzo = `${r.fornitore} ${r.descrizione} ${r.documento} ${r.note} ${r.voce} ${nomeVoce(r.voce)} ${dataCorta(r.data)}`.toLowerCase();
    const pulito = semplice(grezzo);
    return parole.every((p) => grezzo.includes(p) || (semplice(p) !== '' && pulito.includes(semplice(p))));
  });
}

const CHIAVI_ORDINE = {
  data: (r) => r.data || null, fornitore: (r) => semplice(r.fornitore) || null, descrizione: (r) => semplice(r.descrizione) || null, voce: (r) => (r.voce ? Number(r.voce.split('.')[1]) : null),
  imponibile: (r) => num(r.imponibile), iva: (r) => num(r.iva), pagataIl: (r) => r.pagataIl || null, documento: (r) => semplice(r.documento) || null,
  territorio: (r) => (r.territorio ? 1 : 0), ammissibile: (r) => (r.ammissibile ? 1 : 0),
};
/** Copia ordinata del registro; a parità di chiave resta l'ordine d'inserimento. Le righe senza valore vanno in fondo. */
export function ordinaSpese(spese, chiave = 'data', verso = 'asc') {
  const f = CHIAVI_ORDINE[chiave] || CHIAVI_ORDINE.data;
  const segno = verso === 'desc' ? -1 : 1;
  return (spese || []).map((r, i) => [f(r), i, r]).sort((a, b) => {
    if ((a[0] == null) !== (b[0] == null)) return a[0] == null ? 1 : -1;
    if (a[0] < b[0]) return -segno;
    if (a[0] > b[0]) return segno;
    return a[1] - b[1];
  }).map((x) => x[2]);
}

/* ------------------------------------------------------------------ importazione da CSV ed Excel */

/** Numero scritto all'italiana («1.234,56», «€ 1.234,56», «(120,00)») o all'inglese («1,234.56»). null se non è un numero. */
export function numeroItaliano(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
  s = s.replace(/eur[o]?/i, '').replace(/[€$£\s  '’]/g, '');
  if (/^[-−–]/.test(s)) { negativo = !negativo; s = s.slice(1); } else if (/[-−–]$/.test(s)) { negativo = !negativo; s = s.slice(0, -1); }
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const virgole = (s.match(/,/g) || []).length, punti = (s.match(/\./g) || []).length;
  let normale = s;
  if (virgole && punti) normale = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (virgole) normale = virgole === 1 ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (punti > 1 || /^[1-9]\d{0,2}\.\d{3}$/.test(s)) normale = s.replace(/\./g, ''); // «1.234» è milleduecentotrentaquattro
  const n = Number(normale);
  return Number.isFinite(n) ? (negativo ? -n : n) : null;
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
/** Data in formato ISO a partire da «31/12/2026», «31-12-26», «3 marzo 2026», «2026-12-31», un numero seriale di Excel o un oggetto Date. */
export function dataDaTesto(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  const seriale = (n) => (n >= 20000 && n < 80000 ? new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * GIORNO).toISOString().slice(0, 10) : '');
  if (typeof v === 'number') return seriale(v);
  const s = String(v).trim().replace(/[T\s]\d{1,2}[:.]\d{2}([:.]\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i, '').trim();
  if (/^\d{5}([.,]\d+)?$/.test(s)) return seriale(Number(s.replace(',', '.')));
  const valida = (a, m, g) => { const d = iso(a, m, g); return eData(d) ? d : ''; };
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return valida(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4}|\d{2})$/.exec(s);
  if (m) return valida(m[3].length === 2 ? (Number(m[3]) < 70 ? 2000 : 1900) + Number(m[3]) : Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[°º]?\s+([a-zà-ù]{3,})\.?\s+(\d{4})$/i.exec(s);
  if (m) { const mese = MESI.indexOf(semplice(m[2]).slice(0, 3)); return mese >= 0 ? valida(Number(m[3]), mese + 1, Number(m[1])) : ''; }
  return '';
}

/** Sì/no da una cella: «sì», «x», «1», «vero», un importo maggiore di zero → vero; «no», «0», «falso», vuoto riconosciuto → falso; altrimenti null. */
export function siNo(v) {
  if (v === true || v === false) return v;
  if (typeof v === 'number') return v > 0;
  const t = semplice(v);
  if (!t) return null;
  if (/^(si|s|x|y|yes|vero|true|ok|v|1)$/.test(t)) return true;
  if (/^(no|n|falso|false|0)$/.test(t) || t === '-') return false;
  const n = numeroItaliano(v);
  return n == null ? null : n > 0;
}

/** Voce di budget (A.1…A.9) da «A.4», «a4», «A.4.12», «4», oppure dal nome («Post-produzione»). */
export function voceDaTesto(v) {
  const grezzo = String(v ?? '').trim();
  if (!grezzo) return '';
  const m = /^a?[.\s-]*([1-9])(?:[.\s-]+\d{1,2})?\b/i.exec(grezzo);
  if (m && (/^a/i.test(grezzo) || /^\d(\.\d+)?$/.test(grezzo))) return `A.${m[1]}`;
  const t = semplice(grezzo);
  if (/producer fee|compenso (del )?produttore/.test(t)) return 'A.9';
  if (/spese generali|generali/.test(t)) return 'A.8';
  if (/spese varie|varie/.test(t)) return 'A.7';
  if (/post|lavorazioni tecniche/.test(t)) return 'A.6';
  if (/animazion/.test(t)) return 'A.5';
  if (/produzione/.test(t)) return 'A.4';
  if (/artistic|cast|attor/.test(t)) return 'A.3';
  if (/direzione|regist/.test(t)) return 'A.2';
  if (/soggetto|sceneggiatur|diritti/.test(t)) return 'A.1';
  return '';
}
/** Voce proposta dalla descrizione della spesa, con le stesse regole del preventivo; vuota se nessuna regola riconosce il testo. */
export function voceDaDescrizione(descrizione) {
  const codice = voceProposta(descrizione);
  return !descrizione || codice === 'A.4.19' ? '' : codice.split('.').slice(0, 2).join('.');
}

export function mezzoDaTesto(v) {
  const t = semplice(v);
  if (!t) return '';
  if (/contant|cash/.test(t)) return 'contanti';
  if (/bonific|sepa|giroconto|wire/.test(t)) return 'bonifico';
  if (/carta|bancomat|pos\b|credito|debito/.test(t)) return 'carta';
  if (/assegn/.test(t)) return 'assegno';
  if (/\b(rid|sdd)\b|addebito/.test(t)) return 'addebito';
  if (/f24/.test(t)) return 'f24';
  if (/tracciabil|riba|mav|pagopa|bollettino/.test(t)) return 'altro';
  return '';
}

// Il separatore è quello che compare lo stesso numero di volte nel maggior numero di righe (virgolette escluse).
// A parità vince il punto e virgola, poi la tabulazione: nei file italiani la virgola è quasi sempre il decimale.
function separatoreCsv(t) {
  const conteggi = { ';': [], '\t': [], ',': [] };
  let dentro = false, riga = { ';': 0, '\t': 0, ',': 0 }, vuota = true;
  const chiudi = () => { if (!vuota) for (const k of Object.keys(conteggi)) conteggi[k].push(riga[k]); riga = { ';': 0, '\t': 0, ',': 0 }; vuota = true; };
  for (let i = 0; i < t.length && conteggi[';'].length < 12; i++) {
    const c = t[i];
    if (c === '"') { dentro = !dentro; vuota = false; }
    else if (!dentro && c === '\n') chiudi();
    else { if (!dentro && c in riga) riga[c] += 1; if (c.trim()) vuota = false; }
  }
  chiudi();
  let migliore = ';', punteggio = 0;
  for (const [sep, lista] of Object.entries(conteggi)) {
    const frequenze = new Map();
    for (const n of lista) if (n > 0) frequenze.set(n, (frequenze.get(n) || 0) + 1);
    const regolari = Math.max(0, ...frequenze.values());
    if (regolari > punteggio) { migliore = sep; punteggio = regolari; }
  }
  return migliore;
}

/** Legge un CSV: separatore riconosciuto da solo (; , tabulazione), campi tra virgolette, virgolette raddoppiate, a capo dentro i campi. */
export function leggiCsv(testo) {
  const t = String(testo ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const sep = separatoreCsv(t);
  const righe = [];
  let riga = [], campo = '', virgolette = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (virgolette) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i += 1; } else virgolette = false; }
      else campo += c;
    } else if (c === '"' && campo.trim() === '') { campo = ''; virgolette = true; }
    else if (c === sep) { riga.push(campo.trim()); campo = ''; }
    else if (c === '\n') { riga.push(campo.trim()); righe.push(riga); riga = []; campo = ''; }
    else campo += c;
  }
  if (campo !== '' || riga.length) { riga.push(campo.trim()); righe.push(riga); }
  return righe.filter((r) => r.some((c) => c !== ''));
}

/** Campo del registro a cui corrisponde un'intestazione di colonna (null se non riconosciuta). */
export function campoDiColonna(intestazione, territorio = '') {
  const t = semplice(intestazione);
  if (!t) return null;
  if (/pagament|pagat|quietanz|valuta|bonific/.test(t)) return /mezzo|modalita|metodo|tipo|strumento|forma/.test(t) ? 'mezzo' : (/data|pagat[ao]|quietanz|valuta|quando/.test(t) ? 'pagataIl' : 'mezzo');
  if (/mezzo|modalita|metodo|strumento/.test(t)) return 'mezzo';
  if (/aliquota|iva %|% iva|percentuale iva/.test(t)) return 'ivaPct';
  if (/iva escl|senza iva|netto|imponibile|al netto/.test(t)) return 'imponibile';
  if (/iva incl|iva compres|con iva|lordo|totale/.test(t)) return 'totale';
  if (/\biva\b|imposta/.test(t)) return 'iva';
  if (/^data|^del$|emissione/.test(t)) return 'data';
  if (/ammissibil|eleggibil|rendicontabil/.test(t)) return 'ammissibile';
  if (/territori|regione|\blocale\b|in loco/.test(t) || (territorio && t.includes(semplice(territorio)))) return 'territorio';
  if (/voce|categoria|capitolo/.test(t)) return 'voce';
  if (/fornitore|ragione sociale|beneficiario|intestatario|percipiente|denominazione|controparte|nominativo|soggetto/.test(t)) return 'fornitore';
  if (/descrizione|causale|oggetto|dettaglio|prestazione|servizio/.test(t)) return 'descrizione';
  if (/^(n|nr|num|numero|progressivo|riga|id)$/.test(t)) return t === 'numero' || t === 'num' ? 'documento' : null; // «N.» da solo è il contatore delle righe
  if (/documento|fattura|ricevuta|protocollo|riferimento|\brif\b|estremi|^numero/.test(t)) return 'documento';
  if (/importo|costo|spesa|euro|prezzo/.test(t)) return 'imponibile';
  if (/^note?$|osservazion|comment|annotazion/.test(t)) return 'note';
  return null;
}

/** Mappa campo → indice di colonna per una riga di intestazioni; ogni campo prende la prima colonna che lo riconosce. */
export function mappaColonne(intestazioni, territorio = '') {
  const mappa = {}, ignorate = [];
  (intestazioni || []).forEach((etichetta, i) => {
    const campo = campoDiColonna(etichetta, territorio);
    if (campo && !(campo in mappa)) mappa[campo] = i;
    else if (String(etichetta ?? '').trim()) ignorate.push(String(etichetta).trim());
  });
  return { mappa, ignorate };
}

const CAMPI_NOME = { data: 'data', fornitore: 'fornitore', descrizione: 'descrizione', voce: 'voce di budget', imponibile: 'imponibile', iva: 'IVA', ivaPct: 'aliquota IVA', totale: 'totale', territorio: 'nel territorio', ammissibile: 'ammissibile', pagataIl: 'pagata il', mezzo: 'mezzo di pagamento', documento: 'numero documento', note: 'note' };

/**
 * Trasforma una tabella (righe di celle, da CSV o da un foglio Excel) in righe del registro.
 * Le intestazioni possono stare in qualunque ordine e in una delle prime righe; i numeri possono essere scritti all'italiana.
 * @returns {{ righe: object[], saltate: number, avvisi: string[], colonne: Record<string,string>, ignorate: string[] }}
 */
export function importaSpese(tabella, { territorio = '' } = {}) {
  const righeTabella = (tabella || []).filter((r) => Array.isArray(r));
  let migliore = null;
  righeTabella.slice(0, 15).forEach((riga, indice) => {
    const { mappa, ignorate } = mappaColonne(riga, territorio);
    const campi = Object.keys(mappa).length;
    const haImporto = 'imponibile' in mappa || 'totale' in mappa;
    if (campi >= 2 && haImporto && (!migliore || campi > migliore.campi)) migliore = { indice, mappa, ignorate, campi, riga };
  });
  if (!migliore) return { righe: [], saltate: 0, avvisi: ['Non trovo la riga delle intestazioni: servono almeno una colonna con l’importo (Imponibile, Importo o Totale) e un’altra riconoscibile (Data, Fornitore, Descrizione…).'], colonne: {}, ignorate: [] };
  const { mappa } = migliore;
  const cella = (riga, campo) => (campo in mappa ? riga[mappa[campo]] : undefined);
  const righe = [];
  let saltate = 0, senzaVoce = 0, vociProposte = 0, dateIllegibili = 0, mezziIgnoti = 0;
  for (const riga of righeTabella.slice(migliore.indice + 1)) {
    if (!riga.some((c) => String(c ?? '').trim() !== '')) continue;
    if (/^(sub)?total[ei]\b|^somma\b/i.test(String(riga.find((c) => String(c ?? '').trim() !== '') ?? '').trim())) { saltate += 1; continue; }
    let imponibile = numeroItaliano(cella(riga, 'imponibile'));
    const totale = numeroItaliano(cella(riga, 'totale'));
    const ivaGrezza = cella(riga, 'iva');
    let aliquota = numeroItaliano(String(cella(riga, 'ivaPct') ?? '').replace('%', ''));
    let iva = null;
    if (typeof ivaGrezza === 'string' && /%\s*$/.test(ivaGrezza)) aliquota = numeroItaliano(ivaGrezza.replace('%', ''));
    else iva = numeroItaliano(ivaGrezza);
    if (aliquota != null && aliquota > 0 && aliquota < 1) aliquota *= 100; // cella di Excel in formato percentuale
    if (imponibile == null && totale != null) imponibile = iva != null ? totale - iva : aliquota != null ? totale / (1 + aliquota / 100) : totale;
    if (iva == null && imponibile != null) iva = aliquota != null ? (imponibile * aliquota) / 100 : totale != null && totale > imponibile ? totale - imponibile : null;
    const fornitore = testoPulito(cella(riga, 'fornitore'), 200), descrizione = testoPulito(cella(riga, 'descrizione'), 400), documento = testoPulito(cella(riga, 'documento'), 80);
    const dataGrezza = cella(riga, 'data'), pagataGrezza = cella(riga, 'pagataIl');
    const data = dataDaTesto(dataGrezza), pagataIl = dataDaTesto(pagataGrezza);
    // una riga senza fornitore né descrizione è una spesa solo se ha almeno importo e data o numero: altrimenti è una somma o un rigo vuoto
    if (!fornitore && !descrizione && (imponibile == null || (!data && !documento))) { saltate += 1; continue; }
    if ((!data && String(dataGrezza ?? '').trim()) || (!pagataIl && String(pagataGrezza ?? '').trim() && siNo(pagataGrezza) == null)) dateIllegibili += 1;
    let voce = voceDaTesto(cella(riga, 'voce'));
    if (!voce) { voce = voceDaDescrizione(descrizione); if (voce) vociProposte += 1; else senzaVoce += 1; }
    const mezzoGrezzo = cella(riga, 'mezzo');
    const mezzo = mezzoDaTesto(mezzoGrezzo);
    if (!mezzo && String(mezzoGrezzo ?? '').trim()) mezziIgnoti += 1;
    const ammissibile = siNo(cella(riga, 'ammissibile'));
    righe.push(nuovaSpesa({
      data, fornitore, descrizione, voce, imponibile: imponibile == null ? null : cent(imponibile), iva: iva == null ? null : cent(iva),
      territorio: siNo(cella(riga, 'territorio')) === true, ammissibile: ammissibile == null ? undefined : ammissibile,
      pagataIl, mezzo, documento, note: testoPulito(cella(riga, 'note'), 400),
    }));
  }
  const avvisi = [];
  const n = (q, uno, molti) => `${q} ${q === 1 ? uno : molti}`;
  if (!righe.length) avvisi.push('Sotto le intestazioni non ci sono righe con un importo o una descrizione.');
  if (!('territorio' in mappa) && righe.length) avvisi.push('Manca la colonna «nel territorio»: le spese entrano come sostenute fuori dal territorio, correggile nel registro.');
  if (vociProposte) avvisi.push(`${n(vociProposte, 'voce di budget è stata proposta', 'voci di budget sono state proposte')} dalla descrizione: controllale.`);
  if (senzaVoce) avvisi.push(`${n(senzaVoce, 'riga è', 'righe sono')} senza voce di budget.`);
  if (dateIllegibili) avvisi.push(`${n(dateIllegibili, 'riga ha', 'righe hanno')} una data che non riesco a leggere: è rimasta vuota.`);
  if (mezziIgnoti) avvisi.push(`${n(mezziIgnoti, 'riga ha', 'righe hanno')} un mezzo di pagamento non riconosciuto: è rimasto vuoto.`);
  return { righe, saltate, avvisi, colonne: Object.fromEntries(Object.entries(mappa).map(([campo, i]) => [CAMPI_NOME[campo], String(migliore.riga[i]).trim()])), ignorate: migliore.ignorate };
}

const chiaveSpesa = (r) => [r.data, semplice(r.fornitore), semplice(r.documento), num(r.imponibile) ?? ''].join('|');
/** Separa le righe importate da quelle già presenti nel registro (stessa data, fornitore, numero e imponibile). */
export function senzaDoppioni(esistenti, nuove) {
  const viste = new Set((esistenti || []).map(chiaveSpesa));
  const righe = [];
  let doppie = 0;
  for (const r of nuove || []) { const k = chiaveSpesa(r); if (viste.has(k)) doppie += 1; else { viste.add(k); righe.push(r); } }
  return { righe, doppie };
}

/* ------------------------------------------------------------------ esportazione CSV */

const csv = (righe) => `﻿${righe.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')}`;
const importoCsv = (n) => (n == null ? '' : cent(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }));
const INTESTAZIONI_REGISTRO = ['Data documento', 'N. documento', 'Fornitore', 'Descrizione', 'Voce di budget', 'Imponibile', 'IVA', 'Nel territorio', 'Ammissibile', 'Pagata il', 'Mezzo di pagamento', 'Note'];
const rigaRegistro = (r) => [dataCorta(r.data), r.documento, r.fornitore, r.descrizione, r.voce ? `${r.voce} ${nomeVoce(r.voce)}` : '', importoCsv(r.imponibile), importoCsv(r.iva), r.territorio ? 'sì' : 'no', r.ammissibile ? 'sì' : 'no', dataCorta(r.pagataIl), nomeMezzo(r.mezzo), r.note];

/** Registro completo (base del conto consuntivo): tutte le spese in ordine di data, con le stesse colonne che l'importazione riconosce. */
export function csvRegistro(spese) {
  return csv([INTESTAZIONI_REGISTRO, ...ordinaSpese(spese, 'data').map(rigaRegistro)]);
}

/**
 * Matrice di rendicontazione per voce: le sole spese ammissibili sostenute nel territorio, una per riga,
 * raggruppate per voce di budget con i totali. Non è il modello ufficiale dell'ente: serve a compilarlo.
 */
export function csvMatrice(spese, { titolo = '', bando = null, cup = '', territorio = '', ivaCosto = false } = {}) {
  const luogo = territorio || bando?.territorio || 'territorio';
  const utili = ordinaSpese((spese || []).filter((r) => r.ammissibile && r.territorio), 'data');
  const righe = [
    [`Matrice di rendicontazione — spese ammissibili sostenute in ${luogo}`],
    ['Opera', titolo], ['Bando', bando?.nome || ''], ['CUP', cup], ['Importi', ivaCosto ? 'imponibile più IVA non recuperabile' : 'IVA esclusa'], [],
    ['Voce di budget', 'N.', 'Data documento', 'N. documento', 'Fornitore', 'Descrizione', 'Imponibile', 'IVA', 'Importo rendicontato', 'Pagata il', 'Mezzo di pagamento', 'Note'],
  ];
  let progressivo = 0, generale = 0;
  for (const v of [...VOCI_SPESA, { id: '', nome: 'Senza voce' }]) {
    const sue = utili.filter((r) => (VOCE_PER_ID.has(r.voce) ? r.voce : '') === v.id);
    if (!sue.length) continue;
    let somma = 0;
    for (const r of sue) {
      const importo = importoSpesa(r, ivaCosto);
      somma += importo; progressivo += 1;
      righe.push([v.id ? `${v.id} ${v.nome}` : v.nome, progressivo, dataCorta(r.data), r.documento, r.fornitore, r.descrizione, importoCsv(r.imponibile), importoCsv(r.iva), importoCsv(importo), dataCorta(r.pagataIl), nomeMezzo(r.mezzo), r.note]);
    }
    generale += somma;
    righe.push([`Totale ${v.id || 'senza voce'}`, '', '', '', '', '', '', '', importoCsv(somma), '', '', '']);
  }
  righe.push(['Totale generale', '', '', '', '', '', '', '', importoCsv(generale), '', '', '']);
  return csv(righe);
}

/* ------------------------------------------------------------------ rendiconto */

/** Preventivo per voce: dalle righe del preventivo (Produzione › Preventivo) oppure, in mancanza, i soli totali dei Dati chiave. */
export function preventivoPerVoce(progetto) {
  const righe = progetto?.preventivo?.righe?.length ? progetto.preventivo.righe : progetto?.produzione?.preventivo?.righe;
  const e = progetto?.dati?.economici || {};
  if (righe?.length) {
    const t = totaliPreventivo(righe);
    return { origine: 'preventivo', voci: new Map(t.gruppi.map((g) => [`A.${g.id}`, { importo: g.importo, territorio: g.sicilia }])), costo: t.costoProduzione, territorio: t.spesaSicilia };
  }
  if (num(e.costoProduzione) != null) return { origine: 'dati', voci: null, costo: e.costoProduzione, territorio: num(e.spesaSicilia) };
  return { origine: 'nessuno', voci: null, costo: null, territorio: null };
}

const pctDi = (a, b) => (num(a) != null && num(b) != null && b > 0 ? (a / b) * 100 : null);
const euro = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }));
const pct = (n) => (n == null ? '—' : `${(Math.round(n * 10) / 10).toLocaleString('it-IT')}%`);

/**
 * Consuntivo contro preventivo, controlli e ciò che manca per chiedere il saldo.
 * I minimi (spesa sul territorio, costo a consuntivo) sono quelli del bando in uso e si misurano sul contributo CONCESSO.
 */
export function rendiconto({ progetto, bando, gestione, dataDecreto = '', oggi = oggiIso() }) {
  const g = assicuraGestione(gestione);
  const e = progetto?.dati?.economici || {};
  const terr = bando?.territorio || 'territorio';
  const tot = totaliSpese(g.spese, { ivaCosto: g.ivaCosto });
  const prev = preventivoPerVoce(progetto);
  const stato = statoTappe({ bando, anno: progetto?.anno, gestione: g, dataDecreto, oggi });
  const tappa = (id) => stato.tappe.find((t) => t.id === id);

  // producer fee: ammissibile fino alla percentuale del bando sul costo a consuntivo
  const fee = tot.voci.find((v) => v.id === 'A.9');
  const tettoFee = num(bando?.producerFeeMaxPct) != null ? cent((tot.totale.costo * bando.producerFeeMaxPct) / 100) : null;
  const feeEccedente = tettoFee != null && fee.ammissibile > tettoFee ? cent(fee.ammissibile - tettoFee) : 0;
  const ammissibile = cent(tot.totale.ammissibile - feeEccedente);
  const spesaTerritorio = cent(tot.totale.territorio - (fee.ammissibile ? (feeEccedente * fee.territorio) / fee.ammissibile : 0));

  const voci = tot.voci.map((v) => {
    const p = prev.voci?.get(v.id)?.importo ?? null;
    return { id: v.id, nome: v.nome, righe: v.righe, preventivo: p, consuntivo: v.costo, territorio: v.territorio, ammissibile: v.ammissibile, scostamento: p == null ? null : cent(v.costo - p), scostamentoPct: p ? ((v.costo - p) / p) * 100 : null };
  });

  const costoDichiarato = num(e.costoProduzione) ?? prev.costo;
  const costoConsuntivo = tot.totale.costo;
  const contributo = num(g.contributoConcesso);
  const minimoPct = num(bando?.spesaTerritorioMinPct) || 0, minimoSuCostoPct = num(bando?.spesaTerritorioMinSuCostoPct) || 0;
  const minimoTerritorio = minimoPct && contributo != null ? cent((contributo * minimoPct) / 100) : minimoSuCostoPct && costoConsuntivo ? cent((costoConsuntivo * minimoSuCostoPct) / 100) : null;
  const minimoCostoPct = num(bando?.consuntivoMinPct);
  const minimoCosto = minimoCostoPct != null && costoDichiarato != null ? cent((costoDichiarato * minimoCostoPct) / 100) : null;
  const chiuso = tappa('rendicontazione').fatta || (tappa('rendicontazione').giorni != null && tappa('rendicontazione').giorni < 0);
  const sotto = chiuso ? 'critico' : 'attenzione';

  const conProblema = (codice) => g.spese.filter((r) => problemiSpesa(r, { periodo: g.periodo }).includes(codice));
  const sommaDi = (righe) => cent(righe.reduce((a, r) => a + importoSpesa(r, g.ivaCosto), 0));
  const quante = (n, uno, molti) => `${n.toLocaleString('it-IT')} ${n === 1 ? uno : molti}`;
  const fonte = (tema) => { const c = citaBando(bando, tema, 1)[0]; return c ? ` ${c.fonte}: «${c.testo}»` : ' Verifica sull’avviso.'; };
  const controlli = [];
  const aggiungi = (id, esito, titolo, dettaglio, azione) => controlli.push({ id, esito, titolo, dettaglio, azione });

  if (!g.spese.length) aggiungi('registro', 'da_verificare', 'Il registro delle spese è vuoto', 'Senza spese registrate non c’è un consuntivo da confrontare.', 'Inserisci o importa le spese nel Registro spese.');

  if (minimoPct) {
    if (contributo == null) aggiungi('territorio', 'da_verificare', `Spesa ammissibile in ${terr}: almeno il ${pct(minimoPct)} del contributo concesso`, 'Manca il contributo concesso: senza quello il minimo non si può calcolare.', 'Inserisci il contributo concesso nella sezione Erogazione.');
    else if (spesaTerritorio >= minimoTerritorio) aggiungi('territorio', 'ok', `Spesa ammissibile in ${terr} sopra il minimo`, `${euro(spesaTerritorio)} registrati, pari al ${pct(pctDi(spesaTerritorio, contributo))} del contributo concesso (${euro(contributo)}): il minimo è il ${pct(minimoPct)}, cioè ${euro(minimoTerritorio)}.`);
    else aggiungi('territorio', sotto, `Spesa ammissibile in ${terr} sotto il minimo`, `${euro(spesaTerritorio)} registrati, pari al ${pct(pctDi(spesaTerritorio, contributo))} del contributo concesso (${euro(contributo)}): servono almeno ${euro(minimoTerritorio)} (${pct(minimoPct)}). Mancano ${euro(minimoTerritorio - spesaTerritorio)}.${fonte('territorio')}`, chiuso ? 'Verifica di aver registrato tutte le spese ammissibili sostenute nel territorio.' : 'È normale a lavorazione in corso: tieni d’occhio la cifra mentre registri le spese.');
  } else if (minimoSuCostoPct) {
    if (!costoConsuntivo) aggiungi('territorio', 'da_verificare', `Spesa in ${terr}: almeno il ${pct(minimoSuCostoPct)} del costo`, 'Registra le spese per misurare la quota sostenuta nel territorio.');
    else aggiungi('territorio', spesaTerritorio >= minimoTerritorio ? 'ok' : sotto, `Spesa in ${terr} ${spesaTerritorio >= minimoTerritorio ? 'sopra' : 'sotto'} il minimo`, `${euro(spesaTerritorio)} su ${euro(costoConsuntivo)} di costo a consuntivo (${pct(pctDi(spesaTerritorio, costoConsuntivo))}): il minimo è il ${pct(minimoSuCostoPct)}.`);
  } else aggiungi('territorio', 'da_verificare', 'Minimo di spesa sul territorio', 'Il bando in uso non riporta nel programma un minimo di spesa sul territorio a consuntivo.', 'Verifica sull’avviso.');

  if (minimoCostoPct == null) aggiungi('consuntivo', 'da_verificare', 'Costo a consuntivo rispetto al costo dichiarato', 'Il bando in uso non riporta nel programma la riduzione massima del costo a consuntivo.', 'Verifica sull’avviso.');
  else if (costoDichiarato == null) aggiungi('consuntivo', 'da_verificare', `Costo a consuntivo: almeno il ${pct(minimoCostoPct)} del costo dichiarato`, 'Manca il costo di produzione dichiarato.', 'Inseriscilo nei Dati chiave.');
  else if (costoConsuntivo >= minimoCosto) aggiungi('consuntivo', 'ok', 'Costo a consuntivo sopra il minimo', `${euro(costoConsuntivo)} registrati, pari al ${pct(pctDi(costoConsuntivo, costoDichiarato))} del costo dichiarato (${euro(costoDichiarato)}): il minimo è il ${pct(minimoCostoPct)}, cioè ${euro(minimoCosto)}.`);
  else aggiungi('consuntivo', sotto, 'Costo a consuntivo sotto il minimo', `${euro(costoConsuntivo)} registrati, pari al ${pct(pctDi(costoConsuntivo, costoDichiarato))} del costo dichiarato (${euro(costoDichiarato)}): servono almeno ${euro(minimoCosto)} (${pct(minimoCostoPct)}). Mancano ${euro(minimoCosto - costoConsuntivo)}.${fonte('consuntivo')}`, chiuso ? 'Verifica di aver registrato tutte le spese di produzione.' : 'È normale a lavorazione in corso: il registro deve arrivare a questa cifra entro il rendiconto.');

  if (g.spese.length) {
    const contanti = conProblema('non_tracciabile');
    if (contanti.length) aggiungi('tracciabili', 'critico', `${quante(contanti.length, 'spesa ammissibile pagata', 'spese ammissibili pagate')} con un mezzo non tracciabile`, `Valgono ${euro(sommaDi(contanti))}.${fonte('contanti')}`, 'Toglile dalle spese ammissibili (restano nel costo complessivo) oppure correggi il mezzo di pagamento.');
    else aggiungi('tracciabili', 'ok', 'Nessuna spesa ammissibile pagata in contanti', 'I pagamenti registrati delle spese ammissibili sono tutti tracciabili.');

    const haPeriodo = eData(g.periodo.dal) || eData(g.periodo.al);
    const periodoTesto = eData(g.periodo.dal) && eData(g.periodo.al) ? `dal ${dataEstesa(g.periodo.dal)} al ${dataEstesa(g.periodo.al)}` : eData(g.periodo.dal) ? `dal ${dataEstesa(g.periodo.dal)} in poi` : `fino al ${dataEstesa(g.periodo.al)}`;
    const fuori = conProblema('fuori_periodo');
    if (!haPeriodo) aggiungi('periodo', 'da_verificare', 'Periodo di ammissibilità delle spese non indicato', `Senza le date di inizio e fine non si possono riconoscere le spese fuori periodo.${fonte('periodo')}`, 'Indica il periodo nel Registro spese.');
    else if (fuori.length) aggiungi('periodo', 'critico', `${quante(fuori.length, 'spesa ammissibile è', 'spese ammissibili sono')} fuori dal periodo`, `Valgono ${euro(sommaDi(fuori))}: la data del documento non rientra nel periodo ${periodoTesto}.`, 'Toglile dalle spese ammissibili oppure correggi la data del documento.');
    else aggiungi('periodo', 'ok', 'Tutte le spese ammissibili rientrano nel periodo', `Periodo ${periodoTesto}.`);

    const incompleti = g.spese.filter((r) => problemiSpesa(r).some((x) => ['senza_importo', 'senza_data', 'senza_fornitore', 'senza_documento'].includes(x)));
    if (incompleti.length) aggiungi('documenti', 'attenzione', `${quante(incompleti.length, 'spesa ha', 'spese hanno')} il documento incompleto`, 'Mancano importo, data, fornitore o numero del documento: ogni spesa a rendiconto deve corrispondere a un documento fiscale identificabile.', 'Filtra il registro su «Con qualcosa da sistemare».');
    else aggiungi('documenti', 'ok', 'Ogni spesa ha data, fornitore, importo e numero del documento', '');

    const nonPagate = conProblema('non_pagata'), senzaMezzo = conProblema('senza_mezzo');
    if (nonPagate.length || senzaMezzo.length) aggiungi('pagamenti', 'attenzione', [nonPagate.length ? `${quante(nonPagate.length, 'spesa non risulta pagata', 'spese non risultano pagate')}` : '', senzaMezzo.length ? `${quante(senzaMezzo.length, 'pagamento senza il mezzo indicato', 'pagamenti senza il mezzo indicato')}` : ''].filter(Boolean).join(' · '), nonPagate.length ? `Da pagare: ${euro(tot.totale.daPagare)} IVA compresa. A rendiconto contano le spese effettivamente sostenute, con la prova del pagamento.` : 'Indica come è stata pagata ogni spesa: serve per dimostrare la tracciabilità.', 'Completa data e mezzo di pagamento nel registro.');
    else aggiungi('pagamenti', 'ok', 'Tutte le spese risultano pagate, con il mezzo indicato', '');

    const senzaVoce = conProblema('senza_voce');
    if (senzaVoce.length) aggiungi('voci', 'attenzione', `${quante(senzaVoce.length, 'spesa è', 'spese sono')} senza voce di budget`, `Valgono ${euro(sommaDi(senzaVoce))} e non entrano nel confronto per voce.`, 'Assegna la voce nel registro.');
    const generali = conProblema('generali_ammissibili');
    if (generali.length) aggiungi('generali', 'attenzione', `${quante(generali.length, 'spesa generale è segnata', 'spese generali sono segnate')} come ammissibile`, `Valgono ${euro(sommaDi(generali))}: le spese generali (A.8) fanno parte del costo di produzione ma non del costo ammissibile.`, 'Togli la spunta «ammissibile».');
    if (feeEccedente > 0) aggiungi('fee', 'attenzione', 'Producer fee oltre il limite ammissibile', `${euro(feeEccedente)} superano il ${pct(bando.producerFeeMaxPct)} del costo a consuntivo (${euro(tettoFee)}) e non sono contati tra le spese ammissibili.`);
  }

  // che cosa manca per chiedere il saldo
  const piano = pianoErogazione({ quote: quoteInUso(bando, g), contributo, fideiussione: g.erogazione.fideiussione.attiva, stati: g.erogazione.stati });
  const attive = piano.righe.filter((r) => r.attiva && r.percentualeEffettiva > 0);
  const precedenti = attive.slice(0, -1);
  const esito = (id) => controlli.find((c) => c.id === id)?.esito;
  const saldo = [];
  const voce = (id, fatto, testo, dettaglio = '', vai = null) => saldo.push({ id, fatto, testo, dettaglio, vai });
  voce('decreto', eData(dataDecreto), 'Decreto di concessione notificato', eData(dataDecreto) ? `Notificato il ${dataEstesa(dataDecreto)}.` : 'Inserisci la data di notifica in Tappe e scadenze.', 'tappe');
  voce('contributo', contributo != null, 'Contributo concesso indicato', contributo != null ? euro(contributo) : 'Inseriscilo in Erogazione: i minimi si calcolano su quello, non sul richiesto.', 'erogazione');
  voce('riprese', tappa('fineRiprese').fatta, 'Riprese concluse', tappa('fineRiprese').fatta ? tappa('fineRiprese').messaggio : 'Segna la fine delle riprese in Tappe e scadenze.', 'tappe');
  voce('registro', g.spese.length > 0 && esito('documenti') === 'ok' && esito('pagamenti') === 'ok', 'Registro completo: ogni spesa documentata e pagata', !g.spese.length ? 'Il registro è vuoto.' : [esito('documenti') !== 'ok' ? 'documenti incompleti' : '', esito('pagamenti') !== 'ok' ? 'pagamenti da completare' : ''].filter(Boolean).join(', ') || `${quante(g.spese.length, 'spesa registrata', 'spese registrate')}.`, 'spese');
  voce('ammissibilita', g.spese.length > 0 && esito('tracciabili') === 'ok' && esito('periodo') === 'ok', 'Spese ammissibili tracciabili e dentro il periodo', !g.spese.length ? 'Il registro è vuoto.' : esito('periodo') === 'da_verificare' ? 'Indica il periodo di ammissibilità nel Registro spese.' : esito('tracciabili') === 'ok' && esito('periodo') === 'ok' ? '' : 'Ci sono spese ammissibili pagate in contanti o fuori periodo.', 'spese');
  if (minimoPct || minimoSuCostoPct) voce('territorio', esito('territorio') === 'ok', `Minimo di spesa in ${terr} raggiunto`, controlli.find((c) => c.id === 'territorio').dettaglio, 'rendiconto');
  if (minimoCostoPct != null) voce('consuntivo', esito('consuntivo') === 'ok', `Costo a consuntivo almeno al ${pct(minimoCostoPct)} del dichiarato`, controlli.find((c) => c.id === 'consuntivo').dettaglio, 'rendiconto');
  voce('rendicontazione', tappa('rendicontazione').fatta, 'Rendiconto presentato', tappa('rendicontazione').fatta ? tappa('rendicontazione').messaggio : tappa('rendicontazione').termine ? `Termine: ${dataEstesa(tappa('rendicontazione').termine)}.` : 'Segna la tappa quando lo hai inviato.', 'tappe');
  if (precedenti.length) voce('quote', precedenti.every((r) => r.stato === 'incassata'), 'Quote precedenti incassate', precedenti.map((r) => `${r.nome}: ${STATI_QUOTA.find((x) => x.id === r.stato).nome.toLowerCase()}`).join(' · '), 'erogazione');
  voce('uscita', tappa('uscita').fatta, 'Uscita dell’opera documentata', tappa('uscita').fatta ? tappa('uscita').messaggio : 'Se l’avviso lega il saldo all’uscita, segna la tappa quando è avvenuta.', 'tappe');
  for (const a of g.adempimenti) voce(`adempimento:${a.id}`, !!a.fatto, a.testo, '', null);

  return {
    origine: prev.origine, voci,
    totali: { preventivo: prev.costo, consuntivo: costoConsuntivo, scostamento: prev.costo == null ? null : cent(costoConsuntivo - prev.costo), righe: tot.totale.righe, imponibile: tot.totale.imponibile, iva: tot.totale.iva, pagato: tot.totale.pagato, daPagare: tot.totale.daPagare },
    costoDichiarato, costoConsuntivo, pctCosto: pctDi(costoConsuntivo, costoDichiarato), minimoCostoPct, minimoCosto,
    contributo, ammissibile, spesaTerritorio, pctTerritorio: pctDi(spesaTerritorio, contributo), minimoPct: minimoPct || null, minimoSuCostoPct: minimoSuCostoPct || null, minimoTerritorio,
    feeEccedente, controlli, saldo, mancanti: saldo.filter((x) => !x.fatto).length, quotaFinale: attive.at(-1) || null,
  };
}

/* ------------------------------------------------------------------ punteggio da mantenere */

const CAMPI_METRICA = {
  lavorazioneSicilia: ['giorni.prepTot', 'giorni.prepSicilia', 'giorni.ripreseTot', 'giorni.ripreseSicilia'],
  ripreseTerritorioPct: ['giorni.ripreseTot', 'giorni.ripreseSicilia'],
  giorniRipreseTerritorio: ['giorni.ripreseSicilia'],
  postSicilia: ['giorni.postTot', 'giorni.postSicilia'],
  artisticiSiciliani: ['professionisti.artTot', 'professionisti.artSicilia'],
  tecniciSiciliani: ['professionisti.crewTot', 'professionisti.crewSicilia'],
  professionistiSiciliani: ['professionisti.artTot', 'professionisti.artSicilia', 'professionisti.crewTot', 'professionisti.crewSicilia'],
  professionistiTerritorio: ['professionisti.artSicilia', 'professionisti.crewSicilia'],
  spesaSicilia: ['spesa'], spesaTerritorioSuCosto: ['spesa', 'costo'], spesaTerritorioEuro: ['spesa'], contributoSuCosto: ['costo'], costoProduzione: ['costo'],
};
export const CAMPI_EFFETTIVI = [
  ['giorni.prepTot', 'Giorni di preparazione, totali'], ['giorni.prepSicilia', 'Giorni di preparazione nel territorio'],
  ['giorni.ripreseTot', 'Giorni di riprese, totali'], ['giorni.ripreseSicilia', 'Giorni di riprese nel territorio'],
  ['giorni.postTot', 'Giorni di post-produzione, totali'], ['giorni.postSicilia', 'Giorni di post-produzione nel territorio'],
  ['professionisti.artTot', 'Componente artistica, totale'], ['professionisti.artSicilia', 'Componente artistica del territorio'],
  ['professionisti.crewTot', 'Cast tecnico, totale'], ['professionisti.crewSicilia', 'Cast tecnico del territorio'],
];

/** Criteri che il bando calcola dai numeri dichiarati (a fasce, senza giudizio della Commissione). */
export function criteriQuantitativi(bando, categoriaId) {
  try { return elencoCriteri(getGriglia(bando, categoriaId)).filter((c) => c.tipo === 'fasce' && !c.giudizio); } catch { return []; }
}
/** Campi da chiedere a consuntivo per ricalcolare quei criteri: ['giorni.prepTot', …, 'spesa', 'costo']. */
export function campiDaConfermare(criteri) {
  const tutti = new Set(criteri.flatMap((c) => CAMPI_METRICA[c.metrica] || []));
  return [...CAMPI_EFFETTIVI.map(([k]) => k), 'spesa', 'costo'].filter((k) => tutti.has(k));
}

/**
 * Dati a consuntivo nella stessa forma dei Dati chiave: giorni e professionisti effettivi, spesa e costo dal registro.
 * Il contributo resta quello richiesto: i criteri della griglia sono scritti su quello (es. Sicilia 4.5, «rispetto al
 * contributo richiesto»), mentre il minimo di spesa per la revoca si misura sul concesso nel rendiconto.
 */
export function datiConsuntivo({ dati, effettivi = {}, spesaTerritorio = null, costoConsuntivo = null }) {
  const e = dati?.economici || {};
  return {
    ...dati,
    giorni: Object.fromEntries(Object.keys(dati?.giorni || {}).map((k) => [k, num(effettivi.giorni?.[k])])),
    professionisti: Object.fromEntries(Object.keys(dati?.professionisti || {}).map((k) => [k, num(effettivi.professionisti?.[k])])),
    economici: { ...e, spesaSicilia: num(effettivi.spesaTerritorio) ?? num(spesaTerritorio), costoProduzione: num(costoConsuntivo) || null },
  };
}

/** Coppie in cui il valore nel territorio supera il totale (giorni o professionisti): sono errori di battitura, la percentuale supererebbe il 100%. */
export function incongruenzeEffettivi(effettivi = {}) {
  const out = [];
  for (const [tot, terr] of [['giorni.prepTot', 'giorni.prepSicilia'], ['giorni.ripreseTot', 'giorni.ripreseSicilia'], ['giorni.postTot', 'giorni.postSicilia'], ['professionisti.artTot', 'professionisti.artSicilia'], ['professionisti.crewTot', 'professionisti.crewSicilia']]) {
    const leggi = (k) => { const [g, c] = k.split('.'); return num(effettivi?.[g]?.[c]); };
    const t = leggi(tot), n = leggi(terr);
    if (t != null && n != null && n > t) out.push({ totale: tot, territorio: terr, valoreTotale: t, valoreTerritorio: n });
  }
  return out;
}

/**
 * Confronto tra i parametri dichiarati e quelli effettivi sui criteri quantitativi.
 * punteggi (facoltativo): { origine, totale, sezioni: { A: 21.5, … } } per verificare le soglie dopo i punti persi.
 * Il rischio riporta solo ciò che il bando dice; se il bando non dice nulla lo dichiara.
 */
export function punteggioDaMantenere({ bando, categoriaId, dati, consuntivo, punteggi = null }) {
  const criteri = criteriQuantitativi(bando, categoriaId).map((c) => {
    const dich = valutaQuantitativo(c, dati, bando), eff = valutaQuantitativo(c, consuntivo, bando);
    const differenza = dich.mancante || eff.mancante ? null : r1(eff.punti - dich.punti);
    return {
      id: c.id, nome: c.nome, sezione: c.sezione, max: c.max, metrica: c.metrica,
      dichiarato: { punti: dich.mancante ? null : dich.punti, valore: dich.valoreTesto, fascia: dich.fascia, dettaglio: dich.dettaglio },
      effettivo: { punti: eff.mancante ? null : eff.punti, valore: eff.valoreTesto, fascia: eff.fascia, dettaglio: eff.dettaglio },
      differenza, stato: dich.mancante ? 'non_dichiarato' : eff.mancante ? 'da_inserire' : differenza < 0 ? 'perso' : differenza > 0 ? 'guadagnato' : 'confermato',
    };
  });
  const validi = criteri.filter((c) => c.differenza != null);
  const persi = r1(validi.reduce((a, c) => a + Math.max(0, -c.differenza), 0));
  const guadagnati = r1(validi.reduce((a, c) => a + Math.max(0, c.differenza), 0));
  const completo = criteri.length > 0 && criteri.every((c) => c.stato !== 'da_inserire' && c.stato !== 'non_dichiarato');
  const categoria = bando?.categorie?.length ? getCategoria(bando, categoriaId) : null;
  let griglia = null;
  try { griglia = getGriglia(bando, categoriaId); } catch { /* bando senza griglia */ }
  const sezioni = (griglia?.sezioni || []).map((s) => {
    const p = r1(criteri.filter((c) => c.sezione === s.id && c.differenza != null).reduce((a, c) => a + Math.max(0, -c.differenza), 0));
    const prima = num(punteggi?.sezioni?.[s.id]);
    const soglia = num(categoria?.soglie?.[s.id]);
    const dopo = prima == null ? null : r1(prima - p);
    return { id: s.id, nome: s.nome, persi: p, prima, dopo, soglia, sotto: dopo != null && soglia != null && dopo < soglia };
  }).filter((s) => s.persi > 0 || s.prima != null);
  // soglia complessiva solo su alcune sezioni (es. esclusa una sezione di premialità): si confronta la loro somma, non il totale
  const suSezioni = bando?.sogliaSuSezioni?.length ? bando.sogliaSuSezioni : null;
  const noteTutte = suSezioni && suSezioni.every((id) => num(punteggi?.sezioni?.[id]) != null);
  const primaTot = suSezioni ? (noteTutte ? r1(suSezioni.reduce((a, id) => a + punteggi.sezioni[id], 0)) : null) : num(punteggi?.totale);
  const persiTot = suSezioni ? r1(criteri.filter((c) => suSezioni.includes(c.sezione) && c.differenza != null).reduce((a, c) => a + Math.max(0, -c.differenza), 0)) : persi;
  const dopoTot = primaTot == null ? null : r1(primaTot - persiTot);
  const totale = { prima: primaTot, dopo: dopoTot, soglia: num(bando?.sogliaTotale), sotto: dopoTot != null && num(bando?.sogliaTotale) != null && dopoTot < bando.sogliaTotale, ...(suSezioni ? { sezioni: [...suSezioni] } : {}) };
  const sottoSoglia = [...sezioni.filter((s) => s.sotto).map((s) => `sezione ${s.id} a ${s.dopo.toLocaleString('it-IT')} (minimo ${s.soglia})`), ...(totale.sotto ? [`${totale.sezioni ? `sezioni ${totale.sezioni.join(', ')}` : 'totale'} a ${totale.dopo.toLocaleString('it-IT')} (minimo ${totale.soglia})`] : [])];
  const citazioni = citaBando(bando, 'punteggio', 3);
  let rischio = 'da_completare', sintesi = 'Inserisci i dati effettivi per ricalcolare i criteri.';
  if (!criteri.length) { rischio = 'nessun_criterio'; sintesi = 'Questo bando non ha criteri calcolati dai numeri dichiarati: non c’è nulla da ricalcolare.'; }
  else if (validi.length) {
    if (persi === 0) { rischio = completo ? 'nessuno' : 'da_completare'; sintesi = completo ? 'I parametri dichiarati sono confermati: nessun punto perso.' : 'Nessun punto perso sui criteri già ricalcolati; completa i dati effettivi mancanti.'; }
    else if (sottoSoglia.length) { rischio = 'soglie'; sintesi = `A consuntivo si perdono ${persi.toLocaleString('it-IT')} punti e il punteggio scende sotto le soglie: ${sottoSoglia.join('; ')}.`; }
    else if (punteggi) { rischio = 'riduzione'; sintesi = `A consuntivo si perdono ${persi.toLocaleString('it-IT')} punti; il punteggio resta sopra le soglie minime.`; }
    else { rischio = 'riduzione'; sintesi = `A consuntivo si perdono ${persi.toLocaleString('it-IT')} punti. Per sapere se le soglie minime restano rispettate servono i punteggi assegnati dalla Commissione.`; }
  }
  return { criteri, persi, guadagnati, completo, sezioni, totale, rischio, sintesi, citazioni, senzaRegola: citazioni.length === 0, origine: punteggi?.origine || null };
}

/* ------------------------------------------------------------------ cronoprogramma */

export const FASI = [
  { id: 'sviluppo', nome: 'Sviluppo' }, { id: 'preparazione', nome: 'Preparazione' }, { id: 'riprese', nome: 'Riprese' },
  { id: 'post', nome: 'Post-produzione' }, { id: 'consegna', nome: 'Consegna' }, { id: 'uscita', nome: 'Uscita' },
];

/** Fasi con le date in uso. Le riprese coincidono con le tappe «inizio» e «fine riprese»: è lo stesso dato, non una copia. */
export function fasiCronoprogramma(gestione) {
  const g = assicuraGestione(gestione);
  return FASI.map((f) => {
    const mie = g.crono.fasi[f.id] || {};
    const d = f.id === 'riprese' ? { dal: g.tappe.inizioRiprese.data, al: g.tappe.fineRiprese.data } : mie;
    const dal = eData(d.dal) ? d.dal : '', al = eData(d.al) ? d.al : '';
    return { ...f, dal, al, giorni: dal && al && al >= dal ? giorniTra(dal, al) + 1 : null, invertita: !!(dal && al && al < dal) };
  });
}
/** Scrive una data di una fase nel posto giusto (le riprese vivono nelle tappe). */
export function impostaFase(gestione, id, campo, valore) {
  const g = assicuraGestione(gestione);
  const v = eData(valore) ? valore : '';
  if (id === 'riprese') g.tappe[campo === 'dal' ? 'inizioRiprese' : 'fineRiprese'].data = v;
  else g.crono.fasi[id] = { ...(g.crono.fasi[id] || {}), [campo]: v };
  return g;
}

const calendario = (giorniLavorativi) => Math.max(1, Math.ceil((giorniLavorativi * 7) / 5));
/**
 * Proposta di date a partire dal primo giorno di riprese e dai giorni di lavorazione dei Dati chiave
 * (giorni lavorativi portati a giorni di calendario su settimane di cinque giorni). È un punto di partenza da correggere.
 */
export function proponiCronoprogramma({ inizioRiprese, fineRiprese: fineNota = '', giorni = {}, sviluppoGiorni = 90, consegnaGiorni = 30, uscitaDopoGiorni = 120 }) {
  if (!eData(inizioRiprese)) return null;
  const prep = calendario(num(giorni.prepTot) || 20), riprese = calendario(num(giorni.ripreseTot) || 20), post = calendario(num(giorni.postTot) || 40);
  // una fine delle riprese già indicata (in Tappe e scadenze) si tiene: le fasi successive partono da lì
  const fineRiprese = eData(fineNota) && fineNota >= inizioRiprese ? fineNota : aggiungiGiorni(inizioRiprese, riprese - 1);
  const inizioPrep = aggiungiGiorni(inizioRiprese, -prep), inizioPost = aggiungiGiorni(fineRiprese, 1);
  const finePost = aggiungiGiorni(inizioPost, post - 1), inizioConsegna = aggiungiGiorni(finePost, 1);
  const fineConsegna = aggiungiGiorni(inizioConsegna, consegnaGiorni - 1), uscita = aggiungiGiorni(fineConsegna, uscitaDopoGiorni);
  return {
    sviluppo: { dal: aggiungiGiorni(inizioPrep, -sviluppoGiorni), al: aggiungiGiorni(inizioPrep, -1) },
    preparazione: { dal: inizioPrep, al: aggiungiGiorni(inizioRiprese, -1) },
    riprese: { dal: inizioRiprese, al: fineRiprese },
    post: { dal: inizioPost, al: finePost },
    consegna: { dal: inizioConsegna, al: fineConsegna },
    uscita: { dal: uscita, al: aggiungiGiorni(uscita, 29) },
  };
}

/** Segni da sovrapporre al diagramma: notifica del decreto e termini aperti o chiusi di tappe e scadenze. */
export function segniCronoprogramma(stato) {
  const out = [];
  const concessione = stato.tappe.find((t) => t.id === 'concessione');
  if (concessione?.data) out.push({ id: 'concessione', nome: 'Notifica del decreto', data: concessione.data, semaforo: 'fatto', tipo: 'decreto' });
  for (const x of [...stato.tappe, ...stato.altre]) if (x.termine && x.id !== 'concessione' && !(x.origine === 'finestra' && x.fatta)) out.push({ id: x.id, nome: x.origine === 'finestra' ? 'Chiusura della finestra' : `Termine: ${x.nome.toLowerCase()}`, data: x.termine, semaforo: x.semaforo, tipo: 'termine', prorogaMesi: x.prorogaMesi || 0 });
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Geometria del diagramma di Gantt, in frazioni della larghezza (0…1): dominio a mesi interi, barre delle fasi,
 * segni delle scadenze e posizione di oggi. null se non c'è nessuna data.
 */
export function geometriaGantt(fasi, segni = [], { oggi = oggiIso() } = {}) {
  const date = [...fasi.flatMap((f) => [f.dal, f.al]), ...segni.map((s) => s.data)].filter(eData).sort();
  if (!date.length) return null;
  const dal = `${date[0].slice(0, 7)}-01`;
  const ultima = date[date.length - 1];
  const al = iso(Number(ultima.slice(0, 4)), Number(ultima.slice(5, 7)), ultimoDelMese(Number(ultima.slice(0, 4)), Number(ultima.slice(5, 7))));
  const giorni = giorniTra(dal, al) + 1;
  const x = (d) => giorniTra(dal, d) / giorni;
  const mesi = [];
  for (let m = dal; m <= al; m = aggiungiMesi(m, 1)) {
    const fine = aggiungiMesi(m, 1);
    mesi.push({ data: m, anno: Number(m.slice(0, 4)), mese: Number(m.slice(5, 7)), etichetta: MESI[Number(m.slice(5, 7)) - 1], x: x(m), w: giorniTra(m, fine) / giorni });
  }
  return {
    dal, al, giorni, mesi,
    barre: fasi.map((f) => {
      const inizio = f.dal || f.al, fine = f.al || f.dal;
      if (!inizio || fine < inizio) return { ...f, x: null, w: null };
      return { ...f, x: x(inizio), w: (giorniTra(inizio, fine) + 1) / giorni, puntuale: !(f.dal && f.al) };
    }),
    segni: segni.filter((s) => eData(s.data)).map((s) => ({ ...s, x: x(s.data) + 0.5 / giorni })),
    oggi: oggi >= dal && oggi <= al ? x(oggi) + 0.5 / giorni : null,
  };
}

/** Incongruenze del cronoprogramma: date invertite, fasi fuori ordine, lavorazioni oltre i termini del bando. */
export function controlliCronoprogramma(fasi, stato) {
  const out = [];
  const f = Object.fromEntries(fasi.map((x) => [x.id, x]));
  for (const x of fasi) if (x.invertita) out.push({ esito: 'critico', testo: `${x.nome}: la data di fine precede quella di inizio.` });
  // sviluppo e preparazione, riprese e montaggio possono sovrapporsi: si segnalano solo gli ordini che non reggono
  for (const [a, b] of [['preparazione', 'riprese'], ['post', 'consegna'], ['consegna', 'uscita']]) {
    if (f[a].al && f[b].dal && f[b].dal < f[a].al) out.push({ esito: 'attenzione', testo: `${f[b].nome} comincia prima della fine di ${f[a].nome.toLowerCase()}.` });
  }
  const termine = (id) => stato?.tappe.find((t) => t.id === id)?.termine;
  if (f.riprese.al && termine('fineRiprese') && f.riprese.al > termine('fineRiprese')) out.push({ esito: 'critico', testo: `Le riprese finiscono il ${dataEstesa(f.riprese.al)}, oltre il termine del ${dataEstesa(termine('fineRiprese'))}.` });
  const fineLavori = f.consegna.al || f.post.al;
  if (fineLavori && termine('rendicontazione') && fineLavori > termine('rendicontazione')) out.push({ esito: 'critico', testo: `${f.consegna.al ? 'La consegna' : 'La post-produzione'} finisce il ${dataEstesa(fineLavori)}, oltre il termine per la rendicontazione del ${dataEstesa(termine('rendicontazione'))}.` });
  const presentazione = stato?.tappe.find((t) => t.id === 'presentazione');
  if (f.riprese.dal && presentazione?.data && f.riprese.dal < presentazione.data) out.push({ esito: 'attenzione', testo: `Le riprese cominciano il ${dataEstesa(f.riprese.dal)}, prima della presentazione della domanda (${dataEstesa(presentazione.data)}): verifica sull’avviso se è ammesso.` });
  return out;
}

/** Cronoprogramma in CSV: una riga per fase e una per scadenza. */
export function csvCronoprogramma(fasi, segni = []) {
  return csv([
    ['Tipo', 'Nome', 'Dal', 'Al', 'Giorni di calendario'],
    ...fasi.map((f) => ['Fase', f.nome, dataCorta(f.dal), dataCorta(f.al), f.giorni ?? '']),
    ...segni.map((s) => [s.tipo === 'decreto' ? 'Decreto' : 'Scadenza', s.nome, dataCorta(s.data), '', '']),
  ]);
}
