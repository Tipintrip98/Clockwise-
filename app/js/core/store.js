// Salvataggio locale nel browser (IndexedDB). I dossier restano su questo dispositivo:
// se il browser nega l'archivio la pagina funziona lo stesso, ma solo fino alla chiusura.
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
        tx.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
        tx.onerror = tx.onabort = () => { persistente = false; ok(undefined); };
      } catch { persistente = false; ok(undefined); }
    });
  });
}

export async function leggi(chiave) {
  const v = await transazione('readonly', (s) => (s ? s.get(chiave) : null));
  return v === undefined || v === null ? (memoria.has(chiave) ? memoria.get(chiave) : null) : v;
}
export async function scrivi(chiave, valore) {
  memoria.set(chiave, valore);
  await transazione('readwrite', (s) => (s ? s.put(valore, chiave) : null));
}
export async function elimina(chiave) {
  memoria.delete(chiave);
  await transazione('readwrite', (s) => (s ? s.delete(chiave) : null));
}

export const nuovoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// --- progetti: indice leggero + un record per progetto (i testi dei documenti pesano)
export async function elencoProgetti() { return (await leggi('progetti')) || []; }
export async function caricaProgetto(id) { return leggi(`progetto:${id}`); }
export async function salvaProgetto(p, riepilogo = {}) {
  p.aggiornato = new Date().toISOString();
  await scrivi(`progetto:${p.id}`, p);
  const indice = (await elencoProgetti()).filter((x) => x.id !== p.id);
  indice.unshift({ id: p.id, nome: p.nome, bandoId: p.bandoId, categoriaId: p.categoriaId, anno: p.anno, aggiornato: p.aggiornato, esempio: !!p.esempio, documenti: p.documenti.length, ...riepilogo });
  await scrivi('progetti', indice);
}
export async function eliminaProgetto(id) {
  await elimina(`progetto:${id}`);
  await scrivi('progetti', (await elencoProgetti()).filter((x) => x.id !== id));
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

export async function impostazioni() { return (await leggi('impostazioni')) || {}; }
export async function salvaImpostazioni(patch) { const v = { ...(await impostazioni()), ...patch }; await scrivi('impostazioni', v); return v; }

// Aggiornamenti dei bandi arrivati dal canale automatico: { bandi: { [id]: bando }, registro: [...], ultimoControllo, sorgenti: {...}, proposte: {...} }
export async function aggiornamentiBandi() { return { bandi: {}, registro: [], sorgenti: {}, proposte: {}, ultimoControllo: null, ...((await leggi('aggiornamenti')) || {}) }; }
export async function salvaAggiornamentiBandi(patch) { const v = { ...(await aggiornamentiBandi()), ...patch }; await scrivi('aggiornamenti', v); return v; }
