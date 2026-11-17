// Documenti del dossier: tipi, riconoscimento automatico, estrazione del testo nel browser.
import { eModuloIII, leggiModuloIII } from './modulo3.js';

export const TIPI = [
  { id: 'modulo1', nome: 'Modulo I — Istanza', sezioni: ['V'], famiglie: [] },
  { id: 'modulo2', nome: 'Modulo II — Scheda di produzione', sezioni: ['A', 'B', 'V'], famiglie: ['scrittura', 'visione', 'territorio_contenuto', 'societa', 'artistica', 'tecnica'] },
  { id: 'modulo3', nome: 'Modulo III — Dati di produzione', sezioni: ['B', 'D', 'V'], famiglie: ['artistica', 'tecnica', 'ricaduta_lavoro', 'ricaduta_spesa', 'piano_finanziario', 'distribuzione', 'internazionale'] },
  { id: 'sceneggiatura', nome: 'Sceneggiatura o trattamento', sezioni: ['A'], famiglie: ['scrittura', 'visione', 'territorio_contenuto'] },
  { id: 'cv_societa', nome: 'CV della società proponente', sezioni: ['B'], famiglie: ['societa'] },
  { id: 'cv_regista', nome: 'CV regista', sezioni: ['B'], famiglie: ['artistica'] },
  { id: 'cv_autori', nome: 'CV sceneggiatore / autore / consulente', sezioni: ['B'], famiglie: ['artistica'] },
  { id: 'cv_artistico', nome: 'CV componente artistica (fotografia, musiche, interpreti)', sezioni: ['B'], famiglie: ['artistica'] },
  { id: 'cv_tecnico', nome: 'CV cast tecnico', sezioni: ['B'], famiglie: ['tecnica'] },
  { id: 'accordi_cast', nome: 'Contratti / lettere di intento con artisti e tecnici', sezioni: ['B'], famiglie: ['artistica', 'tecnica'] },
  { id: 'coproduzione', nome: 'Coproduzione: CV, deal memo, contratti', sezioni: ['D'], famiglie: ['piano_finanziario', 'internazionale'] },
  { id: 'distribuzione', nome: 'Distribuzione: deal memo, contratti', sezioni: ['D'], famiglie: ['piano_finanziario', 'distribuzione', 'internazionale'] },
  { id: 'finanziamenti', nome: 'Altri finanziamenti pubblici (decreti, delibere)', sezioni: ['D'], famiglie: ['piano_finanziario'] },
  { id: 'referenze_bancarie', nome: 'Referenze bancarie', sezioni: ['D'], famiglie: ['piano_finanziario'] },
  { id: 'finanziatori_esterni', nome: 'Finanziatori esterni (tax credit esterno, product placement)', sezioni: ['D'], famiglie: ['piano_finanziario'] },
  { id: 'produttore_esecutivo', nome: 'Produttore esecutivo: CV, accordi', sezioni: ['B', 'D'], famiglie: ['societa', 'piano_finanziario'] },
  { id: 'green_film', nome: 'Certificazione Green Film', sezioni: ['V'], famiglie: ['sostenibilita'] },
  { id: 'piano_lavorazione', nome: 'Piano di lavorazione', sezioni: ['A', 'V'], famiglie: ['territorio_contenuto', 'ricaduta_lavoro', 'ricaduta_spesa'] },
  { id: 'identita', nome: 'Documento d’identità', sezioni: [], famiglie: [] },
  { id: 'altro', nome: 'Altro', sezioni: [], famiglie: ['altro', 'sostenibilita', 'formazione'] },
];
export const tipoPerId = (id) => TIPI.find((t) => t.id === id) || TIPI[TIPI.length - 1];

const REGOLE = [
  ['modulo3', /modulo[\s_\-]*(iii|3)\b|dati[\s_\-]*di[\s_\-]*produzione/],
  ['modulo2', /modulo[\s_\-]*(ii|2)\b|scheda[\s_\-]*di[\s_\-]*produzione/],
  ['modulo1', /modulo[\s_\-]*(i|1)\b|istanza/],
  ['identita', /carta[\s_\-]*(d.?[\s_\-]*)?identit|documento[\s_\-]*(d.?[\s_\-]*)?identit|\bc\.?i\.?[\s_\-]+legale|passaporto|patente/],
  ['green_film', /green[\s_\-]*film|certificazione[\s_\-]*ambientale|abilitazione[\s_\-]*all.?uso[\s_\-]*del[\s_\-]*marchio|scelta[\s_\-]*dei[\s_\-]*criteri|piano[\s_\-]*di[\s_\-]*sostenibilit|edenred|eco[\s_\-]*muvi/],
  ['referenze_bancarie', /referenz\w*[\s_\-]*bancari|lettera[\s_\-]*(della[\s_\-]*)?banca/],
  ['piano_lavorazione', /piano[\s_\-]*di[\s_\-]*lavorazione|\bpdl\b|calendario[\s_\-]*riprese/],
  ['sceneggiatura', /sceneggiatura|screenplay|\bscript\b|trattamento|treatment|soggetto/],
  ['distribuzione', /distribuzion|distribution|sales[\s_\-]*agent|minimo[\s_\-]*garantito/],
  ['coproduzione', /co[\s_\-]*produ[zc]|produzione[\s_\-]*associata/],
  ['finanziatori_esterni', /tax[\s_\-]*credit[\s_\-]*estern|product[\s_\-]*placement|sponsor/],
  ['produttore_esecutivo', /produ\w+[\s_\-]*esecutiv/],
  ['finanziamenti', /decreto|delibera|concessione|contributo[\s_\-]*selettivo|\bmic\b|dgca|eurimages|media[\s_\-]*creative/],
  ['accordi_cast', /lettera[\s_\-]*d.?(i[\s_\-]*)?intent|\bloi\b|deal[\s_\-]*memo|contratto|scrittura/],
];
const REGOLE_CV = [
  ['cv_regista', /regist|regia|director/],
  ['cv_autori', /sceneggiat|autor|consulente|writer/],
  ['cv_societa', /societ|produzione|company|s\.?r\.?l|profilo[\s_\-]*aziendale/],
  ['cv_artistico', /fotografia|\bdop\b|compositor|musich|colonna|attor|attric|interpret|cast[\s_\-]*artistic/],
  ['cv_tecnico', /montat|scenograf|costum|fonico|truccat|parrucch|operator|location|tecnic|crew|troupe/],
];

// Riconoscimento dal nome del file, con l'inizio del testo come secondo indizio.
export function riconosciTipo(nomeFile, testo = '') {
  const nome = nomeFile.toLowerCase().replace(/\.[a-z0-9]+$/, '');
  const inizio = testo.slice(0, 2500).toLowerCase();
  if (/\b(cv|c\.v\.)\b|curricul|filmograf|biograf/.test(nome)) {
    for (const [tipo, re] of REGOLE_CV) if (re.test(nome)) return tipo;
    for (const [tipo, re] of REGOLE_CV) if (re.test(inizio)) return tipo;
    return 'cv_artistico';
  }
  for (const [tipo, re] of REGOLE) if (re.test(nome)) return tipo;
  if (/modulo iii\b|dati di produzione/.test(inizio)) return 'modulo3';
  if (/modulo ii\b|scheda di produzione/.test(inizio)) return 'modulo2';
  if (/modulo i\b[\s\S]{0,200}istanza/.test(inizio)) return 'modulo1';
  if (/curriculum|filmografia/.test(inizio)) {
    for (const [tipo, re] of REGOLE_CV) if (re.test(inizio)) return tipo;
  }
  if (/\b(int\.|est\.)\s|scena\s+\d+|dissolvenza|fade in/.test(inizio)) return 'sceneggiatura';
  for (const [tipo, re] of REGOLE.slice(3)) if (re.test(inizio)) return tipo;
  return 'altro';
}

// Le librerie di lettura (PDF, Word, Excel) si caricano solo quando serve il primo file di quel tipo.
const inCaricamento = {};
function caricaScript(url) {
  inCaricamento[url] = inCaricamento[url] || new Promise((ok, ko) => {
    const el = document.createElement('script');
    el.src = url; el.onload = ok;
    el.onerror = () => { delete inCaricamento[url]; ko(new Error('Lettore non caricato: controlla la connessione e riprova.')); };
    document.head.append(el);
  });
  return inCaricamento[url];
}
export async function assicura(globale) {
  if (globalThis[globale]) return;
  for (const url of globalThis.CLOCKWISE_LIBS?.[globale] || []) await caricaScript(url);
}

const estensione = (n) => (/\.([a-z0-9]+)$/i.exec(n)?.[1] || '').toLowerCase();

async function testoPdf(buffer) {
  const lib = globalThis.pdfjsLib;
  if (!lib) throw new Error('Lettore PDF non disponibile.');
  const pdf = await lib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
  const pagine = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n);
    const contenuto = await pagina.getTextContent();
    let riga = '', ultimaY = null; const righe = [];
    for (const it of contenuto.items) {
      if (!('str' in it)) continue;
      const y = it.transform ? Math.round(it.transform[5]) : null;
      if (ultimaY != null && y != null && Math.abs(y - ultimaY) > 2) { righe.push(riga.trimEnd()); riga = ''; }
      riga += it.str;
      if (it.hasEOL) { righe.push(riga.trimEnd()); riga = ''; ultimaY = null; } else { ultimaY = y; }
    }
    if (riga.trim()) righe.push(riga.trimEnd());
    pagine.push(righe.join('\n'));
  }
  const numPagine = pdf.numPages;
  try { await pdf.destroy(); } catch { /* niente da liberare */ }
  return { testo: pagine.map((p, i) => `[pagina ${i + 1}]\n${p}`).join('\n\n'), pagine: numPagine };
}

function testoFoglio(wb) {
  const XLSX = globalThis.XLSX;
  return wb.SheetNames.map((n) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: ' | ', blankrows: false })
      .split('\n').map((r) => r.replace(/(\s\|\s)+$/g, '').replace(/(\s\|\s){2,}/g, ' | ')).filter((r) => r.replace(/[\s|]/g, '')).join('\n');
    return `--- Foglio: ${n} ---\n${csv}`;
  }).join('\n\n');
}

/**
 * Estrae il testo da un file caricato.
 * Restituisce { testo, pagine, avvisi, modulo3, scansione } — modulo3 è presente se il file è il Modulo III ufficiale;
 * scansione è vero per i PDF senza testo e per le fotografie, che Claude può leggere come immagini.
 */
export async function estraiTesto(file) {
  const est = estensione(file.name);
  const avvisi = [];
  let testo = '', pagine = null, modulo3 = null, scansione = false;
  const buffer = await file.arrayBuffer();
  if (est === 'pdf') {
    await assicura('pdfjsLib');
    const r = await testoPdf(buffer);
    testo = r.testo; pagine = r.pagine;
    const utile = testo.replace(/\[pagina \d+\]/g, '').replace(/\s/g, '').length;
    if (utile < 40 * pagine) { scansione = true; testo = ''; avvisi.push('PDF senza testo selezionabile (scansione): per leggerlo usa “Leggi la scansione con Claude”, oppure carica la versione esportata da Word o Final Draft.'); }
  } else if (est === 'docx') {
    await assicura('mammoth');
    if (!globalThis.mammoth) throw new Error('Lettore DOCX non disponibile.');
    testo = (await globalThis.mammoth.extractRawText({ arrayBuffer: buffer })).value;
  } else if (est === 'xls' || est === 'xlsx' || est === 'ods' || est === 'csv') {
    await assicura('XLSX');
    if (!globalThis.XLSX) throw new Error('Lettore Excel non disponibile.');
    const wb = globalThis.XLSX.read(new Uint8Array(buffer), { type: 'array' });
    testo = testoFoglio(wb);
    if (eModuloIII(wb)) modulo3 = leggiModuloIII(wb);
  } else if (['txt', 'md', 'fountain', 'rtf', 'fdx', 'html', 'htm'].includes(est)) {
    testo = new TextDecoder('utf-8').decode(buffer);
    if (est === 'fdx' || est === 'html' || est === 'htm') testo = testo.replace(/<\/(Paragraph|p|div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    if (est === 'rtf') testo = testo.replace(/\\par[d]?/g, '\n').replace(/\{\\\*[^}]*\}/g, '').replace(/\\'[0-9a-f]{2}/gi, '?').replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '');
  } else if (est === 'doc') {
    avvisi.push('Il vecchio formato .doc non è leggibile: salva il file come PDF o DOCX e ricaricalo.');
  } else if (['jpg', 'jpeg', 'png', 'heic', 'tif', 'tiff'].includes(est)) {
    if (ESTENSIONI_IMMAGINE.includes(est)) scansione = true;
    avvisi.push(scansione ? 'Immagine: per leggerne il contenuto usa “Leggi la scansione con Claude”.' : 'Immagine: conta come allegato presente, ma il contenuto non viene letto.');
  } else {
    avvisi.push(`Formato .${est || '?'} non leggibile: conta solo come allegato presente.`);
  }
  testo = testo.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  return { testo, pagine, avvisi, modulo3, scansione };
}

export const ESTENSIONI_IMMAGINE = ['jpg', 'jpeg', 'png'];
const LATO_MASSIMO = 1568; // oltre questa misura Claude riduce comunque l'immagine

const inBase64 = (tela, qualita = 0.72) => tela.toDataURL('image/jpeg', qualita).split(',')[1];

/**
 * Pagine di un documento scansionato come immagini JPEG ({ tipo, dati in base64 }), pronte per essere lette da Claude.
 * Accetta PDF (una immagine per pagina) e fotografie JPG/PNG. Restituisce { immagini, pagine, troncato }.
 */
export async function immaginiScansione(file, { massimo = 30 } = {}) {
  const est = estensione(file.name);
  const tela = document.createElement('canvas');
  const immagini = [];
  if (est === 'pdf') {
    await assicura('pdfjsLib');
    const lib = globalThis.pdfjsLib;
    if (!lib) throw new Error('Lettore PDF non disponibile.');
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const quante = Math.min(pdf.numPages, massimo);
    for (let n = 1; n <= quante; n++) {
      const pagina = await pdf.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const vista = pagina.getViewport({ scale: LATO_MASSIMO / Math.max(base.width, base.height) });
      tela.width = Math.round(vista.width); tela.height = Math.round(vista.height);
      const ctx = tela.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tela.width, tela.height);
      await pagina.render({ canvasContext: ctx, viewport: vista }).promise;
      immagini.push({ tipo: 'image/jpeg', dati: inBase64(tela) });
    }
    const pagine = pdf.numPages;
    try { await pdf.destroy(); } catch { /* niente da liberare */ }
    return { immagini, pagine, troncato: pagine > quante };
  }
  if (ESTENSIONI_IMMAGINE.includes(est)) {
    const bitmap = await createImageBitmap(file);
    const scala = Math.min(1, LATO_MASSIMO / Math.max(bitmap.width, bitmap.height));
    tela.width = Math.round(bitmap.width * scala); tela.height = Math.round(bitmap.height * scala);
    tela.getContext('2d').drawImage(bitmap, 0, 0, tela.width, tela.height);
    return { immagini: [{ tipo: 'image/jpeg', dati: inBase64(tela, 0.8) }], pagine: 1, troncato: false };
  }
  throw new Error('Si possono leggere come scansione solo i PDF e le immagini JPG o PNG.');
}

// Apre un file Excel come workbook SheetJS (per gli importatori: preventivo, Master Budget).
export async function apriFoglio(file) {
  await assicura('XLSX');
  if (!globalThis.XLSX) throw new Error('Lettore Excel non disponibile.');
  return globalThis.XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
}

export const byteLen = (s) => new TextEncoder().encode(s).length;

// Famiglie di criteri presenti in una sezione della griglia (vedi core/bandi/schema.js).
export const famiglieSezione = (sezione) => [...new Set((sezione?.criteri || []).filter((c) => c.tipo !== 'fasce' || c.giudizio).map((c) => c.famiglia).filter(Boolean))];

// Documenti che una sezione di valutazione deve leggere, nell'ordine dei tipi.
// «sezione» è la sezione della griglia (oggetto): i documenti si scelgono dalle famiglie dei suoi criteri, così la regola
// vale per qualunque bando. Con una stringa ('V' = verifica formale, oppure la lettera di una sezione) vale l'elenco fisso.
export function documentiPerSezione(documenti, sezione) {
  const ordine = TIPI.map((t) => t.id);
  const famiglie = typeof sezione === 'object' ? famiglieSezione(sezione) : [];
  const id = typeof sezione === 'object' ? sezione?.id : sezione;
  const serve = (tipo) => (famiglie.length ? tipo.famiglie.some((f) => famiglie.includes(f)) : tipo.sezioni.includes(id));
  return documenti
    .filter((d) => d.testo && serve(tipoPerId(d.tipo)))
    .sort((a, b) => ordine.indexOf(a.tipo) - ordine.indexOf(b.tipo));
}

export function blocchiDocumenti(documenti) {
  return documenti.map((d, i) => {
    const tipo = tipoPerId(d.tipo).nome;
    const nota = d.condensato ? ' — SCHEDA DI LETTURA: il testo integrale superava il limite, questa è una sintesi analitica con estratti' : '';
    return `=== DOCUMENTO ${i + 1} — ${tipo} — file «${d.nome}»${d.pagine ? ` — ${d.pagine} pagine` : ''}${nota} ===\n${d.condensato || d.testo}\n=== FINE DOCUMENTO ${i + 1} ===`;
  }).join('\n\n');
}
