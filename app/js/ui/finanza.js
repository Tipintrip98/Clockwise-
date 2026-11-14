// Scheda Finanza del dossier (segnaposto).
import { h, metti } from './dom.js';
export function schedaFinanza(corpo) { metti(corpo, h('div.panel.flat.empty', h('strong', 'Finanza'), 'In preparazione.')); }
