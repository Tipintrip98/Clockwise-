// Barra di sezioni interna a una scheda (Produzione, Legale) e avvisi comuni.
import { h, svuota } from './dom.js';
import { S } from './app.js';

/** sezioni: [[id, nome, vista(area, contesto, apri)]]. Restituisce { barra, apri }. */
export function sottoNavigazione(chiave, sezioni, area, contesto) {
  const apri = (id) => {
    const voce = sezioni.find((x) => x[0] === id) || sezioni[0];
    S.sotto[chiave] = voce[0];
    for (const b of barra.children) b.setAttribute('aria-selected', String(b.dataset.id === voce[0]));
    svuota(area);
    voce[2](area, contesto, apri);
  };
  const barra = h('div.subnav', { role: 'tablist', 'aria-label': 'Sezioni' }, sezioni.map(([id, nome]) => h('button', { type: 'button', role: 'tab', dataset: { id }, onclick: () => apri(id) }, nome)));
  return { barra, apri };
}

/** Avviso per le sezioni che partono dallo spoglio della sceneggiatura. */
export function serveSpoglio(apri, testo) {
  return h('div.panel.stack', h('div.notice', h('strong', 'Prima serve lo spoglio della sceneggiatura. '), testo),
    h('div', h('button.btn.primary', { type: 'button', onclick: () => apri('spoglio') }, 'Vai allo spoglio →')));
}
