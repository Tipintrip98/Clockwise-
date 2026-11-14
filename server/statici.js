// Da dove arrivano i file dell'interfaccia (index.html, css, js, vendor).
// In sviluppo dalla cartella app/ su disco; nell'eseguibile per Windows dagli asset
// incorporati nel file .exe (Node SEA). Il server vede solo `leggi(rel)`.
import fs from 'node:fs';
import path from 'node:path';

/**
 * Trasforma il percorso della richiesta in un percorso relativo sicuro ("js/main.js").
 * Restituisce null se l'URL è malformato, undefined se prova a uscire dalla cartella.
 */
export function percorsoRelativo(percorso) {
  let rel;
  try { rel = decodeURIComponent(percorso); } catch { return null; }
  if (rel.includes('\0')) return null;
  rel = rel.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel) return 'index.html';
  const pulito = path.posix.normalize(rel);
  if (pulito === '..' || pulito.startsWith('../') || /^[a-zA-Z]:/.test(pulito)) return undefined;
  return pulito;
}

/** File letti dal disco: `npm start` e sviluppo. */
export function fornitoreCartella(cartellaApp) {
  const base = path.resolve(cartellaApp);
  return {
    origine: 'cartella',
    async leggi(rel) {
      const file = path.resolve(base, rel);
      if (file !== base && !file.startsWith(base + path.sep)) return null;
      try { return await fs.promises.readFile(file); } catch { return null; }
    },
  };
}

/**
 * File incorporati nell'eseguibile. `sea` è il modulo `node:sea`; l'elenco arriva dal
 * manifesto scritto da scripts/build-windows.mjs (chiave dell'asset = "app/<percorso>").
 */
export function fornitoreIncorporato(sea, elenco) {
  const presenti = new Set(elenco);
  return {
    origine: 'incorporato',
    async leggi(rel) {
      if (!presenti.has(rel)) return null;
      // getRawAsset non copia i dati: il Buffer è una vista di sola lettura sull'eseguibile.
      try { return Buffer.from(sea.getRawAsset(`app/${rel}`)); } catch { return null; }
    },
  };
}
