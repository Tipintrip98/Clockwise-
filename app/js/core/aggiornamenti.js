// Aggiornamento automatico dei bandi (parte pura: nessun accesso alla rete o all'archivio).
//
// Il protocollo ha due livelli, tutti e due silenziosi (si vede qualcosa solo quando c'è una novità):
//  A. CANALE DEL CATALOGO — il repository pubblica bandi/catalogo.json (lo genera scripts/genera-bandi.mjs).
//     Ogni voce entra nel programma solo se supera verificaCatalogo(): formato riconosciuto, impronta
//     sha256 corretta, sanificaBando + validaBando senza errori, revisione più recente di quella in uso.
//     Le voci accettate vengono sovrapposte ai bandi del programma da applicaAggiornamenti().
//  B. PAGINE UFFICIALI — per ogni bando il server locale scarica la pagina dell'ente e ne ricava l'elenco
//     dei documenti pubblicati (estraiDocumenti). La prima rilevazione è la base; alle successive i
//     documenti mai visti diventano una segnalazione (aggiornaSorgente). Niente di ciò che arriva dalle
//     pagine cambia da solo una griglia: al massimo nasce una PROPOSTA che l'utente decide se attivare.
//
// Chi scarica (server/aggiornamenti.js) e chi mostra (ui/aggiornamenti.js) usano le funzioni di questo file.
import { sanificaBando, validaBando, urlSicuro } from './bandi/schema.js';

/** Indirizzi da cui si scarica il catalogo, in ordine: vale il primo che risponde. */
export const CANALI_PREDEFINITI = ['https://raw.githubusercontent.com/Tipintrip98/Clockwise-/main/bandi/catalogo.json'];
export const SCHEMA_CATALOGO = 1;
/** Cadenza: all'avvio se sono passate almeno 12 ore dall'ultimo controllo, poi ogni 6 ore a programma aperto. */
export const ORE_ALL_AVVIO = 12;
export const ORE_A_PROGRAMMA_APERTO = 6;
export const MAX_REGISTRO = 200;
const MAX_VOCI_CATALOGO = 300;
const MAX_NOTI = 5000;
const MAX_NUOVI = 100;

/* ------------------------------------------------------------------ bandi in uso */

/**
 * Sovrappone ai bandi del programma quelli arrivati dal canale di aggiornamento.
 * Un aggiornamento vale solo se è valido e ha una revisione più recente del bando che sostituisce.
 * Del bando predefinito restano i campi che il catalogo non porta (testo dell'avviso, punteggi reali, prassi).
 * @returns {{ bandi: object[], schede: object[] }}
 */
export function applicaAggiornamenti(predefiniti, schede, salvati = {}) {
  const tutti = new Map([...predefiniti, ...schede].map((b) => [b.id, b]));
  for (const grezzo of Object.values(salvati || {})) {
    const nuovo = sanificaBando(grezzo);
    const v = validaBando(nuovo);
    if (!v.ok || !nuovo.revisione) continue;
    const attuale = tutti.get(nuovo.id);
    if (attuale && !(nuovo.revisione > (attuale.revisione || ''))) continue;
    const provata = nuovo.affidabilita.griglia === 'testo_ufficiale' && (!nuovo.verifica || ['confermata', 'corretta'].includes(nuovo.verifica.esito));
    tutti.set(nuovo.id, { ...(attuale || {}), ...nuovo, predefinito: true, simulabile: v.simulabile, verificato: v.simulabile && provata, aggiornato: nuovo.revisione });
  }
  const lista = [...tutti.values()];
  const ordine = new Map([...predefiniti, ...schede].map((b, i) => [b.id, i]));
  lista.sort((a, b) => (ordine.get(a.id) ?? 1e6) - (ordine.get(b.id) ?? 1e6));
  return { bandi: lista.filter((b) => b.simulabile && b.verificato), schede: lista.filter((b) => !(b.simulabile && b.verificato)) };
}

/** Revisione in uso per ogni bando, dopo aver sovrapposto gli aggiornamenti già salvati: { [id]: 'AAAA-MM-GG' }. */
export function revisioniInUso(predefiniti, schede, salvati = {}) {
  const { bandi, schede: altre } = applicaAggiornamenti(predefiniti, schede, salvati);
  const out = Object.create(null);
  for (const b of [...bandi, ...altre]) out[b.id] = b.revisione || '';
  return out;
}

/** Degli aggiornamenti salvati tiene solo quelli ancora utili: validi e più recenti del bando che il programma porta con sé. */
export function potaSalvati(predefiniti, schede, salvati = {}) {
  const base = new Map([...predefiniti, ...schede].map((b) => [b.id, b.revisione || '']));
  const out = {};
  for (const grezzo of Object.values(salvati || {})) {
    const b = sanificaBando(grezzo);
    if (!b.id || !b.revisione || !validaBando(b).ok) continue;
    if (base.has(b.id) && !(b.revisione > base.get(b.id))) continue;
    out[b.id] = b;
  }
  return out;
}

/* ------------------------------------------------------------------ impronte */

/** Impronta sha256 (64 cifre esadecimali) di un testo. Usa la crittografia del sistema: se manca, lancia. */
export async function impronta(testo) {
  const sottile = globalThis.crypto?.subtle;
  if (!sottile) throw new Error('Calcolo dell’impronta non disponibile in questo ambiente.');
  const byte = new Uint8Array(await sottile.digest('SHA-256', new TextEncoder().encode(String(testo))));
  let esa = '';
  for (const b of byte) esa += b.toString(16).padStart(2, '0');
  return esa;
}

/** Impronta di un elenco di documenti: dipende solo dagli indirizzi, non dai titoli (che cambiano per ragioni estetiche). */
export function improntaDocumenti(documenti) {
  return impronta((documenti || []).map((d) => d.url).join('\n'));
}

/* ------------------------------------------------------------------ A. canale del catalogo */

const eData = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const giornoDopo = (iso, giorni) => new Date(Date.parse(`${iso}T00:00:00Z`) + giorni * 86400000).toISOString().slice(0, 10);

/**
 * Controlla un catalogo scaricato dal canale. Non lancia mai: ciò che non va finisce in `scartati` con il motivo.
 * @param {unknown} grezzo            il JSON del catalogo così come è arrivato
 * @param {Record<string,string>} inUso  revisione in uso per ogni bando (vedi revisioniInUso)
 * @param {{ oggi?: string }} [opzioni]  data di oggi (AAAA-MM-GG), per rifiutare le revisioni datate nel futuro
 * @returns {Promise<{ ok: boolean, motivo: string, revisione: string, accettati: object[], invariati: number, scartati: {id: string, revisione: string, motivo: string}[] }>}
 */
export async function verificaCatalogo(grezzo, inUso = {}, { oggi = new Date().toISOString().slice(0, 10) } = {}) {
  const esito = { ok: false, motivo: '', revisione: '', accettati: [], invariati: 0, scartati: [] };
  if (!grezzo || typeof grezzo !== 'object' || Array.isArray(grezzo)) return { ...esito, motivo: 'Il catalogo non è un oggetto JSON.' };
  if (grezzo.schema !== SCHEMA_CATALOGO) {
    const futuro = Number.isInteger(grezzo.schema) && grezzo.schema > SCHEMA_CATALOGO;
    return { ...esito, motivo: futuro ? `Catalogo in un formato più recente (schema ${grezzo.schema}): serve una versione aggiornata di Clockwise.` : 'Formato del catalogo non riconosciuto.' };
  }
  if (!Array.isArray(grezzo.bandi)) return { ...esito, motivo: 'Nel catalogo manca l’elenco dei bandi.' };
  if (grezzo.bandi.length > MAX_VOCI_CATALOGO) return { ...esito, motivo: `Catalogo troppo esteso (${grezzo.bandi.length} voci).` };
  esito.ok = true;
  esito.revisione = eData(grezzo.revisione) ? grezzo.revisione : '';
  const limite = giornoDopo(oggi, 2); // tolleranza per i fusi orari e gli orologi poco precisi
  const visti = new Set();
  for (const voce of grezzo.bandi) {
    const id = typeof voce?.id === 'string' ? voce.id.slice(0, 80) : '';
    const revisione = eData(voce?.revisione) ? voce.revisione : '';
    const scarta = (motivo) => esito.scartati.push({ id: id || '?', revisione, motivo });
    if (!voce || typeof voce !== 'object' || !id || !voce.bando || typeof voce.bando !== 'object' || Array.isArray(voce.bando)) { scarta('voce incompleta'); continue; }
    if (visti.has(id)) { scarta('identificativo ripetuto nel catalogo'); continue; }
    visti.add(id);
    if (typeof voce.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(voce.sha256)) { scarta('impronta sha256 mancante'); continue; }
    let calcolata;
    try { calcolata = await impronta(JSON.stringify(voce.bando)); } catch { scarta('impronta non verificabile su questo dispositivo'); continue; }
    if (calcolata !== voce.sha256.toLowerCase()) { scarta('impronta sha256 non corrispondente: contenuto alterato o incompleto'); continue; }
    const b = sanificaBando(voce.bando);
    if (!b.id || b.id !== id) { scarta('identificativo diverso da quello dichiarato'); continue; }
    if (!b.revisione || b.revisione !== revisione) { scarta('revisione mancante o diversa da quella dichiarata'); continue; }
    if (b.revisione > limite) { scarta(`revisione datata nel futuro (${b.revisione})`); continue; }
    const v = validaBando(b);
    if (!v.ok) { scarta(`non supera il controllo della griglia: ${v.errori.slice(0, 3).join(' ')}`); continue; }
    if (Object.hasOwn(inUso, id)) {
      const attuale = inUso[id] || '';
      if (b.revisione === attuale) { esito.invariati++; continue; }
      if (b.revisione < attuale) { scarta(`revisione ${b.revisione} più vecchia di quella in uso (${attuale})`); continue; }
    }
    esito.accettati.push(b);
  }
  return esito;
}

/* ------------------------------------------------------------------ B. pagine ufficiali: elenco dei documenti */

export const ESTENSIONI_DOCUMENTO = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'odt', 'zip', 'p7m'];
// Parole che, nel testo di un link, indicano un atto del bando anche quando il link porta a una pagina e non a un file.
const PAROLE_ATTO = /(^|[^a-zà-ÿ0-9])(avvis[oi]|band[oi]|decret[oi]|graduatori[ae]|rettific(?:a|he)|prorog(?:a|he)|faq|modulistica|esit[oi])(?![a-zà-ÿ0-9])/i;
// Parametri che cambiano a ogni visita (sessione, tracciamento, anti-cache): tolti, altrimenti lo stesso documento sembrerebbe nuovo.
const PARAMETRI_VOLATILI = /^(utm_[a-z0-9_]+|fbclid|gclid|gclsrc|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|yclid|twclid|_ga|_gl|_hsenc|_hsmi|__hstc|__hssc|__hsfp|hsctatracking|mkt_tok|trk|phpsessid|jsessionid|aspsessionid[a-z0-9]*|asp\.net_sessionid|sessionid|session_id|sessid|sid|cfid|cftoken|nocache|no_cache|cachebuster|cache_buster|_|timestamp|ts)$/i;
const MAX_URL = 1000;
const MAX_ANCORE = 20000;

const ENTITA = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù', Agrave: 'À', Egrave: 'È', Eacute: 'É', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', euro: '€', deg: '°', ordm: 'º', ordf: 'ª' };
/** Entità HTML più comuni (&amp; &#232; &#xE8; …) riportate a carattere. */
export function decodificaEntita(testo) {
  return String(testo).replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (tutto, nome) => {
    if (nome[0] !== '#') return Object.hasOwn(ENTITA, nome) ? ENTITA[nome] : tutto;
    const codice = nome[1] === 'x' || nome[1] === 'X' ? parseInt(nome.slice(2), 16) : parseInt(nome.slice(1), 10);
    if (!Number.isFinite(codice) || codice <= 0 || codice > 0x10ffff || (codice >= 0xd800 && codice <= 0xdfff)) return ' ';
    return String.fromCodePoint(codice);
  });
}

/**
 * Indirizzo assoluto e stabile di un link: risolto rispetto alla pagina, senza ancora (#…), senza credenziali,
 * senza parametri di sessione o di tracciamento. Stringa vuota se non è un indirizzo http(s) utilizzabile.
 */
export function normalizzaUrl(href, base) {
  if (typeof href !== 'string') return '';
  const grezzo = href.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!grezzo || grezzo[0] === '#') return '';
  let u;
  try { u = new URL(grezzo, base || undefined); } catch { return ''; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  if (u.username || u.password) return '';
  u.hash = '';
  if (/;jsessionid=/i.test(u.pathname)) u.pathname = u.pathname.replace(/;jsessionid=[^/;]*/gi, '');
  if (u.search) {
    const tenuti = u.search.slice(1).split('&').filter((coppia) => {
      if (!coppia) return false;
      let chiave = coppia.split('=')[0];
      try { chiave = decodeURIComponent(chiave.replace(/\+/g, ' ')); } catch { /* chiave scritta male: resta com'è */ }
      return !PARAMETRI_VOLATILI.test(chiave);
    });
    u.search = tenuti.length ? `?${tenuti.join('&')}` : '';
  }
  return u.href.length <= MAX_URL ? u.href : '';
}

/** Estensione del file a cui punta un indirizzo ('pdf', 'docx', …) oppure '' se non è un documento riconosciuto. */
export function tipoDocumento(url) {
  let u;
  try { u = new URL(url); } catch { return ''; }
  const prova = (s) => { const e = /\.([a-z0-9]{2,5})$/i.exec(s)?.[1].toLowerCase(); return ESTENSIONI_DOCUMENTO.includes(e) ? e : ''; };
  let percorso = u.pathname.replace(/\/+$/, '');
  try { percorso = decodeURIComponent(percorso); } catch { /* percorso con codifica difettosa */ }
  const daPercorso = prova(percorso);
  if (daPercorso) return daPercorso;
  for (const [, valore] of u.searchParams) { const e = prova(valore); if (e) return e; }
  return '';
}

/** Nome leggibile del file a cui punta un indirizzo (ultima parte del percorso). */
export function nomeDaUrl(url) {
  try {
    const u = new URL(url);
    const ultimo = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
    try { return decodeURIComponent(ultimo).slice(0, 160); } catch { return ultimo.slice(0, 160); }
  } catch { return ''; }
}

// Toglie commenti, script e stili con una sola passata: su pagine malformate le espressioni regolari
// «pigre» (<!--[\s\S]*?-->) diventano lentissime, e una pagina scaricata dalla rete non è fidata.
function togliBlocchi(html) {
  const inizio = /<!--|<(script|style|template)(?=[\s>/])/gi;
  let out = '', i = 0;
  for (;;) {
    inizio.lastIndex = i;
    const m = inizio.exec(html);
    if (!m) { out += html.slice(i); break; }
    out += `${html.slice(i, m.index)} `;
    const fine = m[1] ? new RegExp(`</${m[1]}`, 'gi') : /-->/g;
    fine.lastIndex = m.index + m[0].length;
    const c = fine.exec(html);
    if (!c) break; // blocco mai chiuso: il resto non è contenuto della pagina
    i = c.index + c[0].length;
  }
  return out;
}

// Fine di un tag di apertura, senza farsi ingannare da un «>» dentro un valore tra virgolette.
function fineTag(testo) {
  let virgolette = '';
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (virgolette) { if (c === virgolette) virgolette = ''; } else if (c === '"' || c === '\'') virgolette = c;
    else if (c === '>') return i;
  }
  return -1;
}

function attributi(tag) {
  const out = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(tag))) { const nome = m[1].toLowerCase(); if (!(nome in out)) out[nome] = m[2] ?? m[3] ?? m[4] ?? ''; }
  return out;
}

const testoPulito = (v, max = 160) => decodificaEntita(String(v || '').replace(/<[^>]{0,2000}>/g, ' ')).replace(/[\u0000-\u001f\u007f\u00a0\u200b-\u200f\u2028-\u202f\ufeff]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Elenco dei documenti pubblicati in una pagina: link a file (pdf, doc, docx, xls, xlsx, odt, zip, p7m) e link il cui
 * testo parla di avviso, bando, decreto, graduatoria, rettifica, proroga, FAQ, modulistica, esiti.
 * Indirizzi assoluti e normalizzati, senza doppioni, in ordine alfabetico: lo stesso contenuto dà sempre lo stesso elenco.
 * @param {string} html
 * @param {string} urlPagina   indirizzo da cui la pagina è stata scaricata (dopo gli eventuali reindirizzamenti)
 * @returns {{ documenti: {url: string, titolo: string, tipo: string}[], troncato: boolean }}
 */
export function estraiDocumenti(html, urlPagina, { massimo = 400 } = {}) {
  if (typeof html !== 'string' || !html) return { documenti: [], troncato: false };
  const pagina = togliBlocchi(html);
  let base = urlPagina;
  const tagBase = /<base(?=[\s/])[^>]{0,2000}>/i.exec(pagina.slice(0, 30000));
  if (tagBase) { const href = attributi(tagBase[0].slice(5, -1)).href; const assoluto = href ? normalizzaUrl(decodificaEntita(href), urlPagina) : ''; if (assoluto) base = assoluto; }

  const trovati = new Map();
  const ancora = /<a(?=[\s>/])/gi;
  let m, contate = 0, troncato = false;
  while ((m = ancora.exec(pagina))) {
    if (++contate > MAX_ANCORE) { troncato = true; break; }
    const apertura = pagina.slice(m.index + 2, m.index + 4000);
    const fine = fineTag(apertura);
    if (fine < 0) continue;
    const attr = attributi(apertura.slice(0, fine));
    if (!attr.href) continue;
    const url = normalizzaUrl(decodificaEntita(attr.href), base);
    if (!url) continue;
    const dopo = pagina.slice(m.index + 2 + fine + 1, m.index + 2 + fine + 1 + 1500);
    const chiusura = /<\/a\s*>|<a(?=[\s>/])/i.exec(dopo);
    const interno = chiusura ? dopo.slice(0, chiusura.index) : dopo.slice(0, 300);
    const titolo = testoPulito(interno) || testoPulito(attr.title) || testoPulito(attr['aria-label']) || testoPulito(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(interno)?.slice(1).find(Boolean)) || nomeDaUrl(url);
    const estensione = tipoDocumento(url);
    if (!estensione && !PAROLE_ATTO.test(titolo)) continue;
    const gia = trovati.get(url);
    if (!gia) trovati.set(url, { url, titolo, tipo: estensione || 'pagina' });
    else if (titolo.length > gia.titolo.length && gia.titolo === nomeDaUrl(url)) gia.titolo = titolo;
  }
  const documenti = [...trovati.values()].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  if (documenti.length > massimo) { documenti.length = massimo; troncato = true; }
  return { documenti, troncato };
}

/* ------------------------------------------------------------------ B. pagine ufficiali: confronto tra rilevazioni */

const documentoPulito = (d) => {
  const url = urlSicuro(d?.url);
  if (!url || url.length > MAX_URL) return null;
  const tipo = typeof d.tipo === 'string' && (ESTENSIONI_DOCUMENTO.includes(d.tipo) || d.tipo === 'pagina') ? d.tipo : (tipoDocumento(url) || 'pagina');
  return { url, titolo: testoPulito(d.titolo, 200) || nomeDaUrl(url), tipo };
};

/** Stato di sorveglianza di un bando con tutti i campi al loro posto (anche partendo da niente). */
export function sorgenteVuota(precedente) {
  const p = precedente && typeof precedente === 'object' ? precedente : {};
  return {
    url: urlSicuro(p.url), impronta: typeof p.impronta === 'string' ? p.impronta : '',
    basi: p.basi && typeof p.basi === 'object' ? { ...p.basi } : {},
    noti: Array.isArray(p.noti) ? p.noti.filter((u) => typeof u === 'string') : [],
    nuovi: Array.isArray(p.nuovi) ? p.nuovi.filter((d) => d && typeof d.url === 'string') : [],
    letti: Array.isArray(p.letti) ? p.letti.filter((u) => typeof u === 'string') : [],
    documenti: Number(p.documenti) || 0,
    controllato: typeof p.controllato === 'string' ? p.controllato : null,
    errore: typeof p.errore === 'string' ? p.errore : '',
  };
}

/**
 * Confronta una rilevazione delle pagine di un bando con quanto già noto.
 * - La prima volta che una pagina viene letta fa da base: i suoi documenti sono «noti» e non generano avvisi.
 * - Alle volte successive è nuovo solo ciò che non è MAI stato visto (un documento tolto e rimesso non lo è).
 * - Una pagina che non risponde lascia tutto com'è: nessun falso allarme al suo ritorno.
 * @param {object|null} precedente   stato salvato (vedi sorgenteVuota)
 * @param {{ url?: string, impronta?: string, errore?: string, pagine?: {url: string, errore?: string, documenti?: object[]}[] }} rilevazione
 * @param {string} quando            data e ora del controllo (ISO)
 * @returns {{ stato: object, nuovi: object[], primaRilevazione: boolean, riuscita: boolean, errore: string }}
 */
export function aggiornaSorgente(precedente, rilevazione, quando) {
  const stato = sorgenteVuota(precedente);
  const noti = new Set(stato.noti);
  const inSospeso = new Set(stato.nuovi.map((d) => d.url));
  const nuovi = [];
  let riuscite = 0, basiNuove = 0, totale = 0, primoErrore = '';
  for (const pag of Array.isArray(rilevazione?.pagine) ? rilevazione.pagine : []) {
    const urlPagina = urlSicuro(pag?.url);
    if (!urlPagina) continue;
    if (pag.errore) { primoErrore ||= testoPulito(pag.errore, 300); continue; }
    riuscite++;
    const base = Object.hasOwn(stato.basi, urlPagina);
    for (const grezzo of Array.isArray(pag.documenti) ? pag.documenti : []) {
      const d = documentoPulito(grezzo);
      if (!d) continue;
      totale++;
      if (noti.has(d.url)) continue;
      noti.add(d.url);
      if (base && !inSospeso.has(d.url)) nuovi.push({ ...d, pagina: urlPagina, rilevato: quando });
    }
    if (!base) { stato.basi[urlPagina] = quando; basiNuove++; }
  }
  const primaRilevazione = riuscite > 0 && basiNuove === riuscite && !precedente?.controllato;
  if (riuscite) {
    stato.url = urlSicuro(rilevazione.url) || stato.url;
    stato.impronta = typeof rilevazione.impronta === 'string' ? rilevazione.impronta.slice(0, 64) : stato.impronta;
    stato.documenti = totale;
    stato.controllato = quando;
    stato.noti = [...noti].slice(-MAX_NOTI);
    stato.nuovi = [...stato.nuovi, ...nuovi].slice(-MAX_NUOVI);
  }
  // l'errore resta scritto solo se nessuna pagina ha risposto: una pagina secondaria ferma non è un allarme
  stato.errore = riuscite ? '' : (primoErrore || testoPulito(rilevazione?.errore, 300) || 'pagina non raggiungibile');
  return { stato, nuovi, primaRilevazione, riuscita: riuscite > 0, errore: stato.errore };
}

/** L'utente ha guardato le novità: l'avviso sparisce, i documenti restano tra quelli noti. */
export function segnaControllato(precedente) {
  return { ...sorgenteVuota(precedente), nuovi: [] };
}

/* ------------------------------------------------------------------ B. quale documento far leggere a Claude */

const INDIZI_AVVISO = [
  [/avviso[\s_-]*pubblico/, 6], [/\bavviso\b/, 4], [/\bbando\b/, 4], [/disciplinare/, 4], [/regolamento/, 3], [/linee[\s_-]*guida/, 3], [/testo[\s_-]*(coordinato|integrale)/, 3], [/\bcall\b/, 2],
  [/graduatori|esit[oi]\b|elenc[oh]|ammess|ammissibil|beneficiar|non[\s_-]*finanziat/, -8], [/rettific|errata|prorog/, -8], [/nomina|commissione|verbal/, -6], [/faq|domande[\s_-]*frequenti|chiariment/, -6],
  [/modul[oi]\b|modulistica|istanza|domanda[\s_-]*di|fac[\s_-]*simile|schema[\s_-]*di|dichiarazion|format\b/, -6], [/allegat[oi]/, -3], [/integrazion|modific/, -3],
  [/rendicont|liquidazion|erogazion|impegno[\s_-]*di[\s_-]*spesa|concessione/, -5], [/privacy|informativa|locandina|comunicato|brochure|presentazione|manuale|guida[\s_-]*alla/, -5],
];
/** Quanto un documento somiglia al testo di un avviso (più alto = più probabile; zero o meno = no). */
export function punteggioAvviso(documento) {
  if (!documento || documento.tipo !== 'pdf') return 0;
  const frase = `${documento.titolo || ''} ${nomeDaUrl(documento.url)}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // a favore conta l'indizio più forte (non la somma: «avviso pubblico» è un indizio solo), contro contano tutti
  let favore = 0, contro = 0;
  for (const [indizio, peso] of INDIZI_AVVISO) if (indizio.test(frase)) { if (peso > 0) favore = Math.max(favore, peso); else contro += peso; }
  return favore + contro;
}
/**
 * Tra i documenti nuovi sceglie quello che più probabilmente è il testo dell'avviso (o del bando, o del disciplinare)
 * in PDF. null se nessuno lo sembra: graduatorie, moduli, FAQ e proroghe non si fanno leggere come griglie.
 * @param {object[]} documenti
 * @param {string[]} [giaLetti]   indirizzi già fatti leggere: mai due volte lo stesso documento
 */
export function candidatoAvviso(documenti, giaLetti = []) {
  const esclusi = new Set(giaLetti);
  let migliore = null, massimo = 0;
  for (const d of documenti || []) {
    if (!d || esclusi.has(d.url) || !String(d.url).startsWith('https://')) continue;
    const punti = punteggioAvviso(d);
    if (punti > massimo || (punti === massimo && punti > 0 && migliore && d.url < migliore.url)) { migliore = d; massimo = punti; }
  }
  return massimo > 0 ? migliore : null;
}

/* ------------------------------------------------------------------ proposta di nuova griglia: confronto */

const numeroOnull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const stessa = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 0.0051);
const regolaDi = (c) => JSON.stringify(c.tipo === 'fasce' ? [c.metrica, c.peso ?? 1, (c.fasce || []).map((f) => [f.oltre ?? null, f.da ?? null, f.flag ?? null, f.punti])] : c.tipo === 'discreto' ? (c.valori || []).map((v) => v.punti) : []);

/**
 * Differenze tra la griglia in uso e quella proposta (letta da un nuovo avviso): soglie, massimi di sezione,
 * criteri cambiati, aggiunti o tolti. Le griglie si accoppiano per identificativo e, se non coincide, per posizione.
 * @returns {{ uguale: boolean, generali: object[], sezioni: object[], criteri: object[], categorie: object[], totali: {cambiati: number, nuovi: number, tolti: number} }}
 */
export function confrontaGriglie(attuale, proposta) {
  const generali = [], sezioni = [], criteri = [], categorie = [];
  const voce = (elenco, etichetta, prima, dopo) => { if (!stessa(numeroOnull(prima), numeroOnull(dopo))) elenco.push({ voce: etichetta, prima: numeroOnull(prima), dopo: numeroOnull(dopo) }); };
  voce(generali, 'Punteggio massimo', attuale?.punteggioMassimo, proposta?.punteggioMassimo);
  voce(generali, 'Soglia complessiva', attuale?.sogliaTotale, proposta?.sogliaTotale);
  voce(generali, 'Spesa minima sul territorio (% del contributo)', attuale?.spesaTerritorioMinPct || null, proposta?.spesaTerritorioMinPct || null);

  const grA = Object.values(attuale?.griglie || {}), grP = Object.values(proposta?.griglie || {});
  const usate = new Set();
  const piuGriglie = grA.length > 1 || grP.length > 1;
  grP.forEach((gp, i) => {
    const ga = grA.find((g) => g.id === gp.id && !usate.has(g)) || (grA[i] && !usate.has(grA[i]) ? grA[i] : null);
    if (ga) usate.add(ga);
    const nomeGriglia = piuGriglie ? (gp.nome || gp.id) : '';
    const sezA = new Map((ga?.sezioni || []).map((s) => [String(s.id), s]));
    for (const sp of gp.sezioni || []) {
      const sa = sezA.get(String(sp.id));
      sezA.delete(String(sp.id));
      if (!sa) sezioni.push({ griglia: nomeGriglia, id: sp.id, nome: sp.nome, prima: null, dopo: sp.max, tipo: 'nuovo' });
      else if (!stessa(sa.max, sp.max)) sezioni.push({ griglia: nomeGriglia, id: sp.id, nome: sp.nome, prima: sa.max, dopo: sp.max, tipo: 'cambiato' });
      const critA = new Map((sa?.criteri || []).map((c) => [String(c.id), c]));
      for (const cp of sp.criteri || []) {
        const ca = critA.get(String(cp.id));
        critA.delete(String(cp.id));
        if (!ca) criteri.push({ griglia: nomeGriglia, id: cp.id, nome: cp.nome, prima: null, dopo: cp.max, tipo: 'nuovo', regola: false });
        else {
          const regola = ca.tipo !== cp.tipo || regolaDi(ca) !== regolaDi(cp);
          if (!stessa(ca.max, cp.max) || regola) criteri.push({ griglia: nomeGriglia, id: cp.id, nome: cp.nome || ca.nome, prima: ca.max, dopo: cp.max, tipo: 'cambiato', regola });
        }
      }
      for (const ca of critA.values()) criteri.push({ griglia: nomeGriglia, id: ca.id, nome: ca.nome, prima: ca.max, dopo: null, tipo: 'tolto', regola: false });
    }
    for (const sa of sezA.values()) sezioni.push({ griglia: nomeGriglia, id: sa.id, nome: sa.nome, prima: sa.max, dopo: null, tipo: 'tolto' });
  });
  for (const ga of grA) if (!usate.has(ga)) sezioni.push({ griglia: ga.nome || ga.id, id: '—', nome: 'Intera griglia non più presente', prima: (ga.sezioni || []).reduce((a, s) => a + (s.max || 0), 0), dopo: null, tipo: 'tolto' });

  const catA = attuale?.categorie || [];
  (proposta?.categorie || []).forEach((cp, i) => {
    const ca = catA.find((c) => c.id === cp.id) || (catA.length === (proposta.categorie || []).length ? catA[i] : null);
    if (!ca) { categorie.push({ categoria: cp.nome, voce: 'Categoria nuova', prima: null, dopo: null }); return; }
    const chiavi = new Set([...Object.keys(ca.soglie || {}), ...Object.keys(cp.soglie || {})]);
    for (const k of chiavi) if (!stessa(numeroOnull(ca.soglie?.[k]), numeroOnull(cp.soglie?.[k]))) categorie.push({ categoria: cp.nome || ca.nome, voce: `Minimo della sezione ${k}`, prima: numeroOnull(ca.soglie?.[k]), dopo: numeroOnull(cp.soglie?.[k]) });
    if (!stessa(numeroOnull(ca.contributo?.percentuale), numeroOnull(cp.contributo?.percentuale))) categorie.push({ categoria: cp.nome || ca.nome, voce: 'Contributo massimo (% del costo)', prima: numeroOnull(ca.contributo?.percentuale), dopo: numeroOnull(cp.contributo?.percentuale) });
  });

  const totali = { cambiati: criteri.filter((c) => c.tipo === 'cambiato').length, nuovi: criteri.filter((c) => c.tipo === 'nuovo').length, tolti: criteri.filter((c) => c.tipo === 'tolto').length };
  return { uguale: !generali.length && !sezioni.length && !criteri.length && !categorie.length, generali, sezioni, criteri, categorie, totali };
}

/* ------------------------------------------------------------------ registro e cadenza */

/**
 * Aggiunge eventi al registro. Gli eventi con `gruppo` raccontano uno stato (il canale, una pagina, uno scarto):
 * si scrivono solo quando lo stato cambia, così un canale fermo non riempie il registro a ogni controllo.
 * @param {object[]} registro
 * @param {{quando: string, tipo: string, testo: string, bando?: string, gruppo?: string, chiave?: string, quieto?: boolean}[]} eventi
 *        `quieto`: stato «a posto», da scrivere solo se prima ce n'era uno diverso (il ritorno alla normalità)
 */
export function unisciRegistro(registro, eventi, massimo = MAX_REGISTRO) {
  const out = Array.isArray(registro) ? registro.filter((e) => e && typeof e.testo === 'string') : [];
  for (const e of eventi || []) {
    if (!e || typeof e.testo !== 'string') continue;
    if (e.gruppo) {
      let ultimo = null;
      for (let i = out.length - 1; i >= 0; i--) if (out[i].gruppo === e.gruppo) { ultimo = out[i]; break; }
      if (ultimo ? ultimo.chiave === (e.chiave || '') : e.quieto) continue;
    }
    out.push({ quando: e.quando, tipo: e.tipo, testo: e.testo.slice(0, 500), ...(e.bando ? { bando: e.bando } : {}), ...(e.gruppo ? { gruppo: e.gruppo, chiave: e.chiave || '' } : {}) });
  }
  return out.slice(-massimo);
}

/** È ora di controllare? `ore` = intervallo minimo dall'ultimo controllo riuscito; dopo un tentativo fallito si aspetta almeno un'ora. */
export function controlloDovuto({ ultimoControllo, ultimoTentativo } = {}, ore, adesso = Date.now()) {
  const t = (v) => { const n = Date.parse(v || ''); return Number.isFinite(n) ? n : null; };
  const riuscito = t(ultimoControllo), tentato = t(ultimoTentativo);
  if (tentato != null && tentato <= adesso && adesso - tentato < 3600000) return false;
  if (riuscito == null || riuscito > adesso) return true; // mai controllato, oppure orologio spostato all'indietro
  return adesso - riuscito >= ore * 3600000;
}
