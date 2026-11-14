// Catalogo dei bandi: funzioni pure per l'elenco, la ricerca, lo stato «con la data che conta» e la scelta
// guidata di bando, categoria e anno. Niente DOM: l'interfaccia sta in ui/scelta-bando.js e ui/bandi.js.
import { finestraDiRiferimento, anniBando } from './schema.js';

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const oggiIso = () => new Date().toISOString().slice(0, 10);
const eData = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** «16 marzo 2026» da «2026-03-16»; stringa vuota se la data non è valida. */
export function dataEstesa(iso) {
  if (!eData(iso)) return '';
  const [a, m, g] = iso.split('-').map(Number);
  return m >= 1 && m <= 12 ? `${g} ${MESI[m - 1]} ${a}` : '';
}
/** «16 mar» — per le tabelle strette. */
export function dataCorta(iso, conAnno = false) {
  if (!eData(iso)) return '';
  const [a, m, g] = iso.split('-').map(Number);
  return m >= 1 && m <= 12 ? `${g} ${MESI[m - 1].slice(0, 3)}${conAnno ? ` ${a}` : ''}` : '';
}
/** Giorni di calendario da una data all'altra (negativi se la seconda viene prima); null se una manca. */
export function giorniTra(da, a) {
  if (!eData(da) || !eData(a)) return null;
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86400000);
}
// Un bando letto da PDF può avere finestre senza date: qui restano solo quelle con una scadenza valida,
// perché finestraDiRiferimento() e anniBando() confrontano le date come testi.
const conDate = (b) => ({ ...(b || {}), finestre: (b?.finestre || []).filter((f) => f && Number.isFinite(Number(f.anno)) && eData(f.al) && (f.dal == null || eData(f.dal))) });
/** Testo senza maiuscole, accenti e punteggiatura: serve a cercare «puglia» e trovare «Puglia», «Città» ecc. */
export const normalizza = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/* ------------------------------------------------------------------ stato */

/**
 * Stato di un bando oggi, con la data che conta.
 * Le date delle finestre valgono più del campo `stato` (che fotografa il giorno della ricerca); fanno eccezione
 * «sospeso» e «non attivo», che sono decisioni dell'ente e non dipendono dal calendario.
 * @returns {{ codice: 'aperto'|'in_arrivo'|'atteso'|'chiuso'|'sospeso'|'non_attivo', etichetta: string, tono: string,
 *            quando: string, testo: string, giorni: number|null, anno: number|null, urgente: boolean }}
 */
export function statoBando(bando, oggi = oggiIso()) {
  const b = bando || {};
  const p = b.prossimaEdizione?.anno ? b.prossimaEdizione : null;
  const attesa = p ? `edizione ${p.anno} attesa${p.periodoAtteso ? `: ${p.periodoAtteso}` : ''}` : '';
  const esito = (codice, etichetta, tono, quando = '', extra = {}) => ({ codice, etichetta, tono, quando, testo: quando ? `${etichetta} · ${quando}` : etichetta, giorni: null, anno: null, urgente: false, ...extra });

  if (b.stato === 'sospeso') return esito('sospeso', 'Sospeso', 'bad', attesa);
  if (b.stato === 'non_trovato' || b.tipoValutazione === 'nessuna') return esito('non_attivo', 'Non attivo', 'x', attesa);

  const f = finestraDiRiferimento(conDate(b), oggi);
  if (f?.condizione === 'aperta') {
    const giorni = giorniTra(oggi, f.al);
    const quando = giorni === 0 ? 'scade oggi' : giorni === 1 ? 'scade domani' : `scade il ${dataEstesa(f.al)}`;
    return esito('aperto', 'Aperto', 'ok', quando, { giorni, anno: f.anno, urgente: giorni != null && giorni <= 14 });
  }
  if (f?.condizione === 'futura') return esito('in_arrivo', 'In arrivo', 'accent', `apre il ${dataEstesa(f.dal)}`, { giorni: giorniTra(oggi, f.dal), anno: f.anno });
  if (!f && b.stato === 'aperto') return esito('aperto', 'Aperto', 'ok', b.tipoValutazione === 'sportello' ? 'a sportello, senza scadenza fissa' : 'scadenza da verificare sulla pagina ufficiale');
  if (p || b.stato === 'atteso') return esito('atteso', 'Atteso', 'warn', attesa || 'nuova edizione non ancora annunciata', { anno: p?.anno ?? null });
  return esito('chiuso', 'Chiuso', 'x', f ? `scaduto il ${dataEstesa(f.al)}` : '', { anno: f?.anno ?? null });
}

/* ------------------------------------------------------------------ valutazione e simulabilità */

const TIPI_BREVI = { punteggio: 'Griglia a punti', automatico: 'Automatico', sportello: 'A sportello', misto: 'Misto', nessuna: 'Nessun bando attivo' };
const haGriglie = (b) => Object.keys(b?.griglie || {}).length > 0 && (b?.categorie || []).length > 0;

/** Etichetta breve del tipo di valutazione. Un bando senza tipo ma con una griglia è a punti. */
export const etichettaValutazione = (b) => TIPI_BREVI[b?.tipoValutazione] || (haGriglie(b) ? TIPI_BREVI.punteggio : 'Valutazione non indicata');
/** Vero se il fondo assegna il contributo con una graduatoria a punti (anche solo in parte). */
export const aPunti = (b) => (b?.tipoValutazione ? b.tipoValutazione === 'punteggio' || b.tipoValutazione === 'misto' : haGriglie(b));

/**
 * Dice se un bando si può simulare e, se no, perché e che cosa si può fare.
 * @returns {{ simulabile: boolean, etichetta: string, tono: string, motivo: string, spiegazione: string, alternative: {tipo: string, testo: string, url?: string}[] }}
 */
export function simulabilita(bando) {
  const b = bando || {};
  if (b.simulabile !== false && haGriglie(b)) {
    const daVerificare = b.verificato === false;
    return {
      simulabile: true, tono: daVerificare ? 'warn' : 'ok', etichetta: daVerificare ? 'Simulabile · griglia da verificare' : 'Simulabile',
      motivo: '', spiegazione: daVerificare ? 'La griglia è stata letta da Claude e non ancora confrontata con il testo ufficiale: controlla i punteggi prima di fidarti della stima.' : '', alternative: [],
    };
  }
  let motivo, spiegazione, daPdf = false;
  if (b.tipoValutazione === 'automatico') {
    motivo = 'Contributo automatico';
    spiegazione = 'Il contributo è riconosciuto in automatico a chi ha i requisiti: non c’è una Commissione che assegna punteggi, quindi non c’è una graduatoria da simulare.';
  } else if (b.tipoValutazione === 'sportello') {
    motivo = 'Bando a sportello';
    spiegazione = 'Le domande sono esaminate in ordine di arrivo fino a esaurimento dei fondi: conta presentare presto una domanda completa, non un punteggio.';
  } else if (b.tipoValutazione === 'nessuna' || b.stato === 'non_trovato') {
    motivo = 'Nessun bando attivo';
    spiegazione = 'Al momento non risulta un avviso attivo per questo fondo: non c’è una griglia su cui simulare.';
  } else if (!haGriglie(b)) {
    motivo = 'Griglia non disponibile';
    spiegazione = 'Il bando assegna punteggi, ma la griglia di valutazione non è stata trovata in un testo ufficiale: Clockwise non simula su regole che non ha potuto leggere.';
    daPdf = true;
  } else {
    motivo = 'Griglia non ancora verificata';
    spiegazione = b.affidabilita?.griglia === 'fonte_secondaria'
      ? 'La griglia nota viene da una fonte secondaria e non è stata confrontata con il testo ufficiale dell’avviso: Clockwise non simula su regole non provate.'
      : 'La griglia non ha superato la verifica sul testo ufficiale dell’avviso: Clockwise non simula su regole non provate.';
    daPdf = true;
  }
  const alternative = [];
  if (b.paginaUfficiale) alternative.push({ tipo: 'pagina', testo: 'Consulta la pagina ufficiale del fondo per regole, moduli e scadenze.', url: b.paginaUfficiale });
  if (daPdf) alternative.push({ tipo: 'pdf', testo: 'Se hai il PDF dell’avviso, nella pagina Bandi usa «Aggiungi un bando da PDF»: Claude ne ricava la griglia e potrai simularlo.' });
  for (const a of b.altriBandi || []) if (a?.nome) alternative.push({ tipo: 'altro', testo: `Dello stesso ente: ${a.nome}${a.descrizione ? ` — ${a.descrizione}` : ''}`, ...(a.url ? { url: a.url } : {}) });
  return { simulabile: false, tono: 'x', etichetta: 'Solo scheda informativa', motivo, spiegazione, alternative };
}

/* ------------------------------------------------------------------ elenco: gruppi, ricerca, filtri */

const AREE = { Italia: ['nazionale', 'Italia — bandi nazionali'], Europa: ['europeo', 'Europa'] };
const ORDINE_AREA = { regionale: 0, nazionale: 1, europeo: 2, personale: 3 };

/** Ambito di un bando: regionale, nazionale, europeo; «personale» se non ha regione (bando aggiunto da PDF). */
export function areaBando(b) {
  const r = String(b?.regione || '').trim();
  if (!r) return 'personale';
  return AREE[r]?.[0] || 'regionale';
}

/**
 * Raggruppa le voci del catalogo per regione: prima le regioni in ordine alfabetico, poi i bandi nazionali,
 * poi gli europei, in fondo quelli senza regione. Dentro ogni gruppo i simulabili vengono prima.
 * @returns {{ chiave: string, titolo: string, area: string, voci: object[], simulabili: number }[]}
 */
export function raggruppaPerRegione(voci) {
  const gruppi = new Map();
  for (const b of voci || []) {
    const area = areaBando(b);
    const regione = String(b.regione || '').trim();
    const chiave = area === 'personale' ? '~personale' : regione;
    if (!gruppi.has(chiave)) gruppi.set(chiave, { chiave, titolo: area === 'personale' ? 'Altri bandi' : AREE[regione]?.[1] || regione, area, voci: [], simulabili: 0 });
    const g = gruppi.get(chiave);
    g.voci.push(b);
    if (b.simulabile !== false) g.simulabili += 1;
  }
  const nome = (b) => String(b.nomeBreve || b.nome || '');
  for (const g of gruppi.values()) g.voci.sort((a, b) => Number(a.simulabile === false) - Number(b.simulabile === false) || nome(a).localeCompare(nome(b), 'it'));
  return [...gruppi.values()].sort((a, b) => ORDINE_AREA[a.area] - ORDINE_AREA[b.area] || a.titolo.localeCompare(b.titolo, 'it'));
}

const testoCercabile = (b) => normalizza([b.nome, b.nomeBreve, b.regione, b.territorio, b.ente, b.descrizione, etichettaValutazione(b), ...(b.categorie || []).map((c) => c.nome)].filter(Boolean).join(' '));

/** Ricerca immediata: tutte le parole scritte devono comparire (senza badare ad accenti e maiuscole). */
export function cercaBandi(voci, testo) {
  const parole = normalizza(testo).split(' ').filter(Boolean);
  if (!parole.length) return [...(voci || [])];
  return (voci || []).filter((b) => { const t = testoCercabile(b); return parole.every((p) => t.includes(p)); });
}

export const FILTRI = [
  { id: 'tutti', nome: 'Tutti' },
  { id: 'aperti', nome: 'Aperti adesso' },
  { id: 'punteggio', nome: 'Con griglia a punti' },
];
const PROVE = { tutti: () => true, aperti: (b, oggi) => statoBando(b, oggi).codice === 'aperto', punteggio: (b) => aPunti(b) };

/** Applica ricerca e filtro. Un filtro sconosciuto equivale a «Tutti». */
export function filtraBandi(voci, { testo = '', filtro = 'tutti' } = {}, oggi = oggiIso()) {
  const prova = PROVE[filtro] || PROVE.tutti;
  return cercaBandi(voci, testo).filter((b) => prova(b, oggi));
}
/** Quanti bandi restano con ciascun filtro, a parità di ricerca: i numeri accanto ai pulsanti. */
export function contaFiltri(voci, testo = '', oggi = oggiIso()) {
  const base = cercaBandi(voci, testo);
  return Object.fromEntries(FILTRI.map((f) => [f.id, base.filter((b) => PROVE[f.id](b, oggi)).length]));
}
/** Numeri di sintesi del catalogo. */
export function riepilogoCatalogo(voci, oggi = oggiIso()) {
  const v = voci || [];
  const stati = v.map((b) => statoBando(b, oggi).codice);
  return {
    totale: v.length, simulabili: v.filter((b) => b.simulabile !== false).length,
    aperti: stati.filter((s) => s === 'aperto').length, inArrivo: stati.filter((s) => s === 'in_arrivo').length,
    regioni: new Set(v.filter((b) => areaBando(b) === 'regionale').map((b) => b.regione)).size,
  };
}

/** Altre voci del catalogo dello stesso fondo o dello stesso ente (esclusa quella data). */
export function collegati(voci, bando) {
  const ente = normalizza(bando?.ente);
  return (voci || []).filter((b) => b.id !== bando?.id && ((bando?.fondoId && b.fondoId === bando.fondoId) || (ente && normalizza(b.ente) === ente)));
}

/* ------------------------------------------------------------------ anni ed edizioni */

/**
 * Anni tra cui scegliere: le finestre note più l'edizione successiva attesa, ciascuno con la sua condizione.
 * Un bando senza date offre l'anno in corso (o `annoCorrente`, se un dossier ne ha già uno).
 * @returns {{ anno: number, condizione: 'aperta'|'futura'|'chiusa'|'prevista'|'senza_date', prevista: boolean, chiusa: boolean, dal: string|null, al: string|null, dettaglio: string, nota: string }[]}
 */
export function opzioniAnno(bando, oggi = oggiIso(), annoCorrente = null) {
  const out = anniBando(conDate(bando), oggi).map((a) => {
    const condizione = a.prevista ? 'prevista' : a.chiusa ? 'chiusa' : a.dal && a.dal > oggi ? 'futura' : 'aperta';
    const dettaglio = { prevista: 'prevista', chiusa: `chiusa il ${dataEstesa(a.al)}`, futura: `apre il ${dataEstesa(a.dal)}`, aperta: `aperta fino al ${dataEstesa(a.al)}` }[condizione];
    return { ...a, condizione, dettaglio };
  });
  const senzaDate = (anno) => {
    const n = Number(anno);
    if (Number.isInteger(n) && n > 0 && !out.some((a) => a.anno === n)) out.push({ anno: n, dal: null, al: null, nota: '', prevista: false, chiusa: false, condizione: 'senza_date', dettaglio: 'date non note' });
  };
  for (const f of bando?.finestre || []) senzaDate(f?.anno); // finestre di cui si conosce solo l'anno
  senzaDate(annoCorrente);
  if (!out.length) senzaDate(oggi.slice(0, 4));
  return out.sort((a, b) => a.anno - b.anno);
}

/** Anno da proporre: la finestra aperta, poi la prossima, poi l'edizione prevista, infine l'ultima chiusa. */
export function annoConsigliato(bando, oggi = oggiIso()) {
  const anni = opzioniAnno(bando, oggi);
  const prima = (c) => anni.find((a) => a.condizione === c);
  return (prima('aperta') || prima('futura') || prima('prevista') || anni.filter((a) => a.condizione === 'chiusa').at(-1) || anni[0]).anno;
}

export const NOTA_PREVISTA = 'prevista: vale la griglia dell’ultima edizione finché non esce il nuovo avviso';

/**
 * Valore di una tabella per anno (massimali, dotazione): quello dell'anno chiesto, altrimenti l'ultimo noto
 * prima di quell'anno (o il primo disponibile), segnalato come ereditato.
 * @returns {{ valore: number, anno: number, ereditato: boolean }|null}
 */
export function valoreAnno(mappa, anno) {
  const anni = Object.keys(mappa || {}).map(Number).filter((a) => Number.isFinite(a) && typeof mappa[a] === 'number').sort((a, b) => a - b);
  if (!anni.length) return null;
  const n = Number(anno);
  if (anni.includes(n)) return { valore: mappa[n], anno: n, ereditato: false };
  const rif = anni.filter((a) => a < n).at(-1) ?? anni[0];
  return { valore: mappa[rif], anno: rif, ereditato: true };
}

/**
 * Ciò che serve sapere di una categoria per scegliere: contributo massimo, dotazione dell'anno, punteggi minimi.
 * @returns {{ id, nome, percentuale, massimale, dotazione, notaContributo, sogliaTotale, punteggioMassimo, soglie: {id, nome, min, max}[], durata: string, testoQualita: string }}
 */
export function schedaCategoria(bando, categoria, anno) {
  const c = categoria || {};
  const griglia = bando?.griglie?.[c.griglia];
  const soglie = Object.entries(c.soglie || {}).map(([id, min]) => { const s = griglia?.sezioni?.find((x) => x.id === id); return { id, nome: s?.nome || '', min, max: s?.max ?? null }; });
  const durata = c.durataMin != null && c.durataMaxEsclusa != null ? `da ${c.durataMin} a meno di ${c.durataMaxEsclusa} minuti`
    : c.durataMin != null ? `almeno ${c.durataMin} minuti` : c.durataMaxEsclusa != null ? `meno di ${c.durataMaxEsclusa} minuti` : '';
  return {
    id: c.id, nome: c.nome || '', percentuale: c.contributo?.percentuale ?? null,
    massimale: valoreAnno(c.contributo?.massimali, anno), dotazione: valoreAnno(c.dotazione, anno), notaContributo: c.contributo?.nota || '',
    sogliaTotale: bando?.sogliaTotale ?? null, punteggioMassimo: bando?.punteggioMassimo ?? 100, soglie, durata,
    testoQualita: c.testoQualita || '',
  };
}

/**
 * Calendario delle edizioni: storico, finestre note e prossima edizione attesa in un unico elenco per anno.
 * @returns {{ anno: number, condizione: 'passata'|'aperta'|'futura'|'prevista', pubblicato: string|null, dal: string|null, al: string|null, nota: string }[]}
 */
export function calendarioEdizioni(bando, oggi = oggiIso()) {
  const anni = new Map();
  const voce = (anno) => { if (!anni.has(anno)) anni.set(anno, { anno, condizione: 'passata', pubblicato: null, dal: null, al: null, note: [] }); return anni.get(anno); };
  for (const e of bando?.storicoEdizioni || []) {
    if (!e?.anno) continue;
    const v = voce(e.anno);
    if (eData(e.pubblicato)) v.pubblicato = e.pubblicato;
    if (eData(e.scadenza)) v.al = e.scadenza;
    if (e.nota) v.note.push(e.nota);
  }
  for (const f of bando?.finestre || []) {
    if (!f?.anno) continue;
    const v = voce(f.anno);
    if (eData(f.dal)) v.dal = f.dal;
    if (eData(f.al)) v.al = f.al;
    if (f.nota && !v.note.includes(f.nota)) v.note.push(f.nota);
  }
  for (const v of anni.values()) {
    if (v.al && v.al >= oggi) v.condizione = v.dal && v.dal > oggi ? 'futura' : 'aperta';
  }
  const p = bando?.prossimaEdizione;
  if (p?.anno && !anni.has(p.anno)) {
    const v = voce(p.anno);
    v.condizione = 'prevista';
    for (const t of [p.periodoAtteso && `attesa: ${p.periodoAtteso}`, p.base]) if (t) v.note.push(t);
  }
  return [...anni.values()].sort((a, b) => a.anno - b.anno).map(({ note, ...v }) => ({ ...v, nota: note.join(' — ') }));
}

/** Nome proposto per un nuovo dossier: «Dossier N», con N libero rispetto ai nomi già usati. */
export function nomeDossierProposto(nomiEsistenti = []) {
  const usati = new Set((nomiEsistenti || []).map((n) => String(n).trim().toLowerCase()));
  let n = usati.size ? (nomiEsistenti || []).length + 1 : 1;
  while (usati.has(`dossier ${n}`)) n += 1;
  return `Dossier ${n}`;
}
