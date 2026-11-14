// Registro dei bandi che fanno parte del programma.
// - BANDI_PREDEFINITI: bandi con griglia a punti provata dal testo ufficiale: si possono simulare.
// - SCHEDE_BANDI: fondi senza griglia a punti (automatici, a sportello, non attivi) o con griglia non ancora
//   provata: compaiono nel catalogo con stato, pagina ufficiale e prossima edizione, ma non si simulano.
// La Sicilia ha un modulo a sé perché porta con sé testo integrale dell'avviso e punteggi reali delle graduatorie.
import { BANDO_SICILIA } from '../bando-sicilia.js';
import { BANDI_DATI, REVISIONE_DATI } from './dati.js';
import { preparaBando } from './schema.js';

// La Sicilia vive nel suo modulo: un'eventuale scheda con lo stesso identificativo tra i dati generati non la duplica.
const preparati = BANDI_DATI.filter((d) => d.id !== BANDO_SICILIA.id).map((d) => preparaBando(d));

export const REVISIONE_CATALOGO = REVISIONE_DATI || BANDO_SICILIA.revisione;
export const BANDI_PREDEFINITI = [BANDO_SICILIA, ...preparati.filter((b) => b.simulabile && b.verificato)];
export const SCHEDE_BANDI = preparati.filter((b) => !(b.simulabile && b.verificato));

const ORDINE_AREE = ['Italia', 'Europa'];
/** Tutti i fondi noti, simulabili e no, in ordine alfabetico di regione (nazionali ed europei in fondo). */
export function catalogo(bandi = BANDI_PREDEFINITI, schede = SCHEDE_BANDI) {
  const peso = (b) => (ORDINE_AREE.includes(b.regione) ? 1 + ORDINE_AREE.indexOf(b.regione) : 0);
  return [...bandi.map((b) => ({ ...b, simulabile: b.simulabile !== false })), ...schede.map((b) => ({ ...b, simulabile: false }))]
    .sort((a, b) => peso(a) - peso(b) || String(a.regione).localeCompare(String(b.regione), 'it') || String(a.nome).localeCompare(String(b.nome), 'it'));
}
