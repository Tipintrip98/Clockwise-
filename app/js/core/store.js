// Salvataggio dei dati. Nel programma installato tutto finisce su disco, nella cartella dei dati dell'utente
// (vedi «archivio su disco» più sotto); nella pagina autonoma resta nel browser (IndexedDB) e, se il browser
// nega anche quello, solo in memoria fino alla chiusura.
const DB = 'clockwise', TABELLA = 'kv';
let dbPromessa = null;
const memoria = new Map();
export let persistente = true;

function apri() {
  if (dbPromessa) return dbPromessa;
  dbPromessa = new Promise((ok) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(TABELLA);
      req.onsuccess = () => ok(req.result);
      req.onerror = () => { persistente = false; ok(null); };
      req.onblocked = () => { persistente = false; ok(null); };
    } catch { persistente = false; ok(null); }
  });
  return dbPromessa;
}

function transazione(modo, fn) {
  return apri().then((db) => {
    if (!db) return fn(null);
    return new Promise((ok) => {
      try {
        const tx = db.transaction(TABELLA, modo);
        const r = fn(tx.objectStore(TABELLA));
        // conferma esplicita: una scrittura avviata mentre la pagina si chiude viene portata a termine
        if (modo === 'readwrite') { try { tx.commit?.(); } catch { /* browser senza commit esplicito */ } }
        tx.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
        tx.onerror = tx.onabort = () => { persistente = false; ok(undefined); };
      } catch { persistente = false; ok(undefined); }
    });
  });
}

async function leggiLocale(chiave) {
  const v = await transazione('readonly', (s) => (s ? s.get(chiave) : null));
  return v === undefined || v === null ? (memoria.has(chiave) ? memoria.get(chiave) : null) : v;
}
async function chiaviLocali() {
  const k = await transazione('readonly', (s) => (s ? s.getAllKeys() : null));
  return [...new Set([...(Array.isArray(k) ? k.map(String) : []), ...memoria.keys()])];
}

/* ------------------------------------------------------------------ archivio su disco */
// Con il programma installato (o `npm start`) ogni valore viene scritto anche nella cartella dei dati dell'utente
// (server/archivio.js): è quella la copia che conta. Il browser resta come copia di riserva e come tampone:
// una scrittura non arrivata al disco (pagina chiusa a metà, servizio fermo) resta segnata e viene recuperata al prossimo avvio.
let disco = null; // null = non ancora verificato · false = non disponibile · { cartella } = attivo
const code = new Map();
const SOSPESI = 'clockwise-sospesi', UNITO = 'clockwise-disco-unito';
const locale = {
  leggi(k) { try { return localStorage.getItem(k); } catch { return null; } },
  scrivi(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* archivio locale negato */ } },
};
const sospesi = () => { try { return JSON.parse(locale.leggi(SOSPESI) || '{}') || {}; } catch { return {}; } };
function segna(chiave, segno) {
  const s = sospesi();
  if (segno == null) delete s[chiave]; else s[chiave] = segno;
  locale.scrivi(SOSPESI, Object.keys(s).length ? JSON.stringify(s) : null);
}
const indirizzo = (chiave) => `api/archivio/kv/${encodeURIComponent(chiave)}`;
// le scritture della stessa chiave arrivano al disco nell'ordine in cui sono state chieste
function inCoda(chiave, fn) { const p = (code.get(chiave) || Promise.resolve()).then(fn, fn); code.set(chiave, p.catch(() => {})); return p; }
// valore === undefined vuol dire «elimina»
function invia(chiave, valore, segno) {
  return inCoda(chiave, async () => {
    try {
      const corpo = valore === undefined ? null : JSON.stringify(valore);
      const r = await fetch(indirizzo(chiave), corpo === null ? { method: 'DELETE' } : { method: 'PUT', headers: { 'content-type': 'application/json' }, body: corpo, keepalive: corpo.length < 60000 });
      if (!r.ok) return false;
      if (segno != null && sospesi()[chiave] === segno) segna(chiave, null);
      return true;
    } catch { return false; }
  });
}
// undefined = lettura non riuscita · null = non c'è
async function leggiDisco(chiave) {
  try {
    const r = await fetch(indirizzo(chiave), { cache: 'no-store' });
    if (r.status === 204 || r.status === 404) return null;
    return r.ok ? await r.json() : undefined;
  } catch { return undefined; }
}

// Primo contatto di questo browser con l'archivio: ciò che il browser ha e il disco no viene copiato su disco.
// Negli elenchi (dossier, bandi aggiunti, casi reali) si uniscono le voci; per tutto il resto vince il disco.
async function unisci(suDisco) {
  const elenchi = ['progetti', 'bandi', 'casi-reali'];
  for (const chiave of await chiaviLocali()) {
    if (elenchi.includes(chiave) || suDisco.has(chiave)) continue;
    const v = await leggiLocale(chiave);
    if (v != null) await invia(chiave, v);
  }
  for (const chiave of elenchi) {
    const mio = (await leggiLocale(chiave)) || [];
    if (!Array.isArray(mio) || !mio.length) continue;
    const suo = suDisco.has(chiave) ? await leggiDisco(chiave) : [];
    if (!Array.isArray(suo)) continue;
    const noti = new Set(suo.map((x) => x?.id));
    // il dossier di esempio non si duplica
    const nuovi = mio.filter((x) => x && !noti.has(x.id) && !(chiave === 'progetti' && x.esempio && suo.some((y) => y?.esempio)));
    if (nuovi.length || !suDisco.has(chiave)) await invia(chiave, [...suo, ...nuovi]);
  }
}

/** Collega l'archivio su disco, se la pagina è servita dal programma. Va chiamata una volta, prima di leggere i dati. */
export async function collegaDisco() {
  if (disco !== null) return disco;
  disco = false;
  if (typeof fetch !== 'function' || typeof location === 'undefined' || !/^https?:$/.test(location.protocol) || globalThis.claude?.use) return false;
  let stato = null;
  try { const r = await fetch('api/archivio', { cache: 'no-store' }); if (r.ok) stato = await r.json(); } catch { /* pagina autonoma: resta il browser */ }
  if (!stato?.attivo) return false;
  const suDisco = new Set((stato.chiavi || []).map((c) => c.chiave));
  // scritture rimaste a metà alla chiusura precedente
  for (const [chiave, segno] of Object.entries(sospesi())) {
    if (String(segno).startsWith('x')) { if (await invia(chiave, undefined, segno)) suDisco.delete(chiave); continue; }
    const v = await leggiLocale(chiave);
    if (v == null) segna(chiave, null); // la copia nel browser non c'è più: resta buona quella su disco
    else if (await invia(chiave, v, segno)) suDisco.add(chiave);
  }
  if (locale.leggi(UNITO) !== '1' || !suDisco.has('progetti')) { await unisci(suDisco); locale.scrivi(UNITO, '1'); }
  disco = { cartella: stato.cartella };
  persistente = true;
  return disco;
}
/** { attivo, cartella, sospesi }: sospesi = scritture non ancora arrivate al disco. */
export const statoDisco = () => ({ attivo: !!disco, cartella: disco ? disco.cartella : null, sospesi: disco ? Object.keys(sospesi()).length : 0 });
/** Aspetta che tutte le scritture avviate siano arrivate al disco (prima di chiudere il programma). */
export async function scrittureConcluse() { await Promise.all([...code.values()]); return statoDisco().sospesi === 0; }

export async function leggi(chiave) {
  if (disco && !(chiave in sospesi())) {
    const v = await leggiDisco(chiave);
    if (v !== undefined) { if (v !== null) memoria.set(chiave, v); return v; }
  }
  return leggiLocale(chiave);
}
// La scrittura su disco parte subito, senza aspettare la copia nel browser: alla chiusura della pagina c'è tempo
// solo per ciò che viene avviato all'istante (le richieste piccole proseguono anche a pagina chiusa).
export async function scrivi(chiave, valore) {
  memoria.set(chiave, valore);
  const segno = disco ? Date.now() : null;
  if (disco) segna(chiave, segno);
  const versoDisco = disco ? invia(chiave, valore, segno) : null;
  await transazione('readwrite', (s) => (s ? s.put(valore, chiave) : null));
  if (versoDisco) await versoDisco;
}
export async function elimina(chiave) {
  memoria.delete(chiave);
  const segno = disco ? `x${Date.now()}` : null;
  if (disco) segna(chiave, segno);
  const versoDisco = disco ? invia(chiave, undefined, segno) : null;
  await transazione('readwrite', (s) => (s ? s.delete(chiave) : null));
  if (versoDisco) await versoDisco;
}

// --- file originali: restano sul computer con il loro nome (cartella archivio/originali), mai nel browser
const indirizzoFile = (gruppo, id) => `api/archivio/file/${encodeURIComponent(gruppo)}${id ? `/${encodeURIComponent(id)}` : ''}`;
export const indirizzoOriginale = (gruppo, id) => (disco ? indirizzoFile(gruppo, id) : null);
export async function salvaOriginale(gruppo, id, file) {
  if (!disco) return null;
  try {
    const r = await fetch(`${indirizzoFile(gruppo, id)}?nome=${encodeURIComponent(file.name || 'file')}`, { method: 'PUT', body: file });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
export async function leggiOriginale(gruppo, id, nome = 'file') {
  if (!disco) return null;
  try {
    const r = await fetch(indirizzoFile(gruppo, id), { cache: 'no-store' });
    if (!r.ok) return null;
    const b = await r.blob();
    return new File([b], nome, { type: b.type });
  } catch { return null; }
}
export async function eliminaOriginale(gruppo, id) {
  if (!disco) return;
  try { await fetch(indirizzoFile(gruppo, id), { method: 'DELETE' }); } catch { /* resta un file in più sul disco */ }
}

// operazioni «leggi, modifica, riscrivi» sulla stessa chiave: una alla volta, per non perdere modifiche
const serie = new Map();
function inSerie(nome, fn) { const p = (serie.get(nome) || Promise.resolve()).then(fn, fn); serie.set(nome, p.catch(() => {})); return p; }

export const nuovoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// --- progetti: indice leggero + un record per progetto (i testi dei documenti pesano)
export async function elencoProgetti() { return (await leggi('progetti')) || []; }
export async function caricaProgetto(id) { return leggi(`progetto:${id}`); }
export function salvaProgetto(p, riepilogo = {}) {
  return inSerie('progetti', async () => {
    p.aggiornato = new Date().toISOString();
    await scrivi(`progetto:${p.id}`, p);
    const indice = (await elencoProgetti()).filter((x) => x.id !== p.id);
    indice.unshift({ id: p.id, nome: p.nome, bandoId: p.bandoId, categoriaId: p.categoriaId, anno: p.anno, aggiornato: p.aggiornato, esempio: !!p.esempio, documenti: p.documenti.length, ...riepilogo });
    await scrivi('progetti', indice);
  });
}
export function eliminaProgetto(id) {
  return inSerie('progetti', async () => {
    await elimina(`progetto:${id}`);
    await scrivi('progetti', (await elencoProgetti()).filter((x) => x.id !== id));
    await eliminaOriginale(id); // anche i file originali caricati nel dossier
  });
}

export async function bandiPersonali() { return (await leggi('bandi')) || []; }
export async function salvaBando(b) {
  const tutti = (await bandiPersonali()).filter((x) => x.id !== b.id);
  tutti.push(b); await scrivi('bandi', tutti);
}
export async function eliminaBando(id) { await scrivi('bandi', (await bandiPersonali()).filter((x) => x.id !== id)); }
// conoscenza aggiuntiva per i bandi predefiniti (che non vengono riscritti)
export async function conoscenzaBando(id) { return (await leggi(`conoscenza:${id}`)) || []; }
export async function salvaConoscenza(id, lista) { await scrivi(`conoscenza:${id}`, lista); }

// casi reali per l'apprendimento (core/apprendimento.js): un caso per dossier, l'ultimo salvato sostituisce il precedente
export async function casiReali() { return (await leggi('casi-reali')) || []; }
export async function salvaCasoReale(caso) { const lista = [...(await casiReali()).filter((c) => c.id !== caso.id), caso]; await scrivi('casi-reali', lista); return lista; }
export async function eliminaCasoReale(id) { const lista = (await casiReali()).filter((c) => c.id !== id); await scrivi('casi-reali', lista); return lista; }

export async function impostazioni() { return (await leggi('impostazioni')) || {}; }
export function salvaImpostazioni(patch) { return inSerie('impostazioni', async () => { const v = { ...(await impostazioni()), ...patch }; await scrivi('impostazioni', v); return v; }); }

// La sessione di lavoro: dove si era rimasti (pagina, dossier aperto, scheda), per ritrovarla alla riapertura.
export async function sessione() { return (await leggi('sessione')) || null; }
export async function salvaSessione(v) { await scrivi('sessione', v); }

// Aggiornamenti dei bandi arrivati dal canale automatico: { bandi: { [id]: bando }, registro: [...], ultimoControllo, sorgenti: {...}, proposte: {...} }
export async function aggiornamentiBandi() { return { bandi: {}, registro: [], sorgenti: {}, proposte: {}, ultimoControllo: null, ...((await leggi('aggiornamenti')) || {}) }; }
export async function salvaAggiornamentiBandi(patch) { const v = { ...(await aggiornamentiBandi()), ...patch }; await scrivi('aggiornamenti', v); return v; }
