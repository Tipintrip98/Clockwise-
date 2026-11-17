// Esporta e importa un dossier come file unico (.clockwise): serve a fare una copia di sicurezza, a spostare un dossier
// su un altro computer e a consegnare un dossier completo a chi deve lavorarci. Logica pura.
// Il file contiene tutto il dossier (dati, testi dei documenti, valutazione, strumenti) e, se richiesto, i file originali.
export const FORMATO = 'clockwise-dossier';
export const VERSIONE_FORMATO = 1;
export const ESTENSIONE = 'clockwise';

/** originali: [{ id, nome, tipo, base64 }] (id = id del documento nel dossier). */
export function pacchettoDossier(progetto, { versioneApp = '', originali = [], adesso = new Date().toISOString() } = {}) {
  const p = JSON.parse(JSON.stringify(progetto));
  // i documenti d'identità non viaggiano mai, nemmeno in un file esportato
  for (const d of p.documenti || []) if (d.tipo === 'identita') { d.testo = ''; d.trascritto = false; }
  const esclusi = new Set((p.documenti || []).filter((d) => d.tipo === 'identita').map((d) => d.id));
  return { formato: FORMATO, versione: VERSIONE_FORMATO, app: versioneApp, esportato: adesso, progetto: p, originali: originali.filter((o) => o?.id && o.base64 && !esclusi.has(o.id)) };
}

/** Controlla un file esportato. Lancia un errore con un messaggio da mostrare all'utente. */
export function leggiPacchetto(contenuto) {
  let j = contenuto;
  if (typeof contenuto === 'string') { try { j = JSON.parse(contenuto); } catch { throw new Error('Il file non è un dossier di Clockwise (non si riesce a leggerlo).'); } }
  if (!j || j.formato !== FORMATO) throw new Error('Il file non è un dossier esportato da Clockwise.');
  if (!(j.versione <= VERSIONE_FORMATO)) throw new Error('Questo dossier è stato esportato da una versione più recente di Clockwise: aggiorna il programma e riprova.');
  const p = j.progetto;
  if (!p || typeof p !== 'object' || typeof p.bandoId !== 'string' || !Array.isArray(p.documenti) || typeof p.dati !== 'object') throw new Error('Il file è incompleto: manca il dossier.');
  const originali = (Array.isArray(j.originali) ? j.originali : []).filter((o) => o && typeof o.id === 'string' && typeof o.base64 === 'string' && typeof o.nome === 'string');
  return { progetto: p, originali, app: j.app || '', esportato: j.esportato || '' };
}

/**
 * Prepara un dossier importato per entrare nell'archivio: se esiste già un dossier con lo stesso identificativo
 * diventa una copia con un identificativo nuovo (non si sovrascrive mai niente).
 */
export function preparaImportato(progetto, { idEsistenti = [], nuovoId, adesso = new Date().toISOString() } = {}) {
  const p = JSON.parse(JSON.stringify(progetto));
  const copia = !p.id || idEsistenti.includes(p.id);
  const idOriginale = p.id || null;
  if (copia) { p.id = nuovoId(); if (idOriginale) p.nome = `${p.nome || 'Dossier'} (importato)`; }
  p.nome = p.nome || 'Dossier importato';
  p.esempio = false; delete p.esempioVersione;
  p.importato = adesso;
  p.reale = p.reale || {};
  for (const d of p.documenti) { d.avvisi = Array.isArray(d.avvisi) ? d.avvisi : []; if (d.tipo === 'identita') { d.testo = ''; d.trascritto = false; } }
  return { progetto: p, copia, idOriginale };
}
