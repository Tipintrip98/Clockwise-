// Aggiornamento automatico dei bandi (parte pura: nessun accesso alla rete o all'archivio).
import { sanificaBando, validaBando } from './bandi/schema.js';

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
