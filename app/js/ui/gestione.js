// Scheda Gestione del dossier (segnaposto).
import { h, metti } from './dom.js';
export function schedaGestione(corpo) { metti(corpo, h('div.panel.flat.empty', h('strong', 'Gestione'), 'In preparazione.')); }
