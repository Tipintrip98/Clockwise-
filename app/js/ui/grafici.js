// Quadrante del punteggio e barre di sezione.
import { h, s, fmt } from './dom.js';

const CX = 120, CY = 120, R = 98, INIZIO = 135, AMPIEZZA = 270;
const angolo = (v, max) => INIZIO + (AMPIEZZA * Math.min(Math.max(v, 0), max)) / max;
const punto = (gradi, r = R) => { const a = (gradi * Math.PI) / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; };
function arco(v1, v2, max, r = R) {
  const a1 = angolo(v1, max), a2 = angolo(v2, max);
  const [x1, y1] = punto(a1, r), [x2, y2] = punto(a2, r);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

const COLORE = { ammissibile: 'var(--ok)', a_rischio: 'var(--signal)', sotto_soglia: 'var(--bad)', parziale: 'var(--accent)' };

/** Quadrante 0-100 letto in senso orario: arco del punteggio, forbice min-max, tacca della soglia. */
export function quadrante(ris) {
  const max = ris.massimo || 100;
  const colore = COLORE[ris.esito] || 'var(--accent)';
  const [tx1, ty1] = punto(angolo(ris.sogliaTotale, max), R - 15), [tx2, ty2] = punto(angolo(ris.sogliaTotale, max), R + 15);
  const [lx, ly] = punto(angolo(ris.sogliaTotale, max), R - 30);
  const svg = s('svg', { viewBox: '0 0 240 240', role: 'img', 'aria-label': `Punteggio stimato ${fmt(ris.totale)} su ${max}, soglia ${ris.sogliaTotale}` },
    s('path', { d: arco(0, max, max), fill: 'none', stroke: 'var(--surface-2)', 'stroke-width': 16, 'stroke-linecap': 'round' }),
    ris.max > ris.min + 0.05 && s('path', { d: arco(ris.min, ris.max, max, R - 13), fill: 'none', stroke: colore, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.45 }),
    ris.totale > 0 && s('path', { d: arco(0, ris.totale, max), fill: 'none', stroke: colore, 'stroke-width': 16, 'stroke-linecap': 'round' }),
    ris.sogliaTotale > 0 && s('line', { x1: tx1, y1: ty1, x2: tx2, y2: ty2, stroke: 'var(--signal)', 'stroke-width': 4, 'stroke-linecap': 'round' }),
    ris.sogliaTotale > 0 && s('text', { x: lx, y: ly + 4, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 11, 'font-family': 'var(--font-mono)' }, String(ris.sogliaTotale)),
  );
  return h('div.dial', svg, h('div.c',
    h('div.v', fmt(ris.totale)),
    h('div.of', `su ${max}${ris.completo ? '' : ' · parziale'}`),
    ris.max > ris.min + 0.05 && h('div.rg', `${fmt(ris.min)} – ${fmt(ris.max)}`),
  ));
}

/** Barre per sezione con la tacca del minimo richiesto. */
export function barreSezioni(ris) {
  return h('div.bars', ris.sezioni.map((sez) => {
    const classe = !sez.completo ? (sez.raggiungibile ? 'idle' : 'bad') : sez.superata ? 'ok' : 'bad';
    return h('div',
      h('div.bar-h',
        h('span', h('strong', `${sez.id} · `), sez.nome),
        h('span.n', h('strong', fmt(sez.punti)), ` / ${fmt(sez.massimo)}`, sez.soglia != null && h('span.muted', ` · min ${fmt(sez.soglia)}`))),
      h('div.bar', { role: 'img', 'aria-label': `Sezione ${sez.id}: ${fmt(sez.punti)} su ${fmt(sez.massimo)}${sez.soglia != null ? `, minimo ${fmt(sez.soglia)}` : ''}` },
        h(`i.${classe}`, { style: { width: `${(sez.punti / sez.massimo) * 100}%` } }),
        sez.daValutare > 0 && h('em', { style: { left: `${(sez.punti / sez.massimo) * 100}%`, width: `${(sez.daValutare / sez.massimo) * 100}%` }, title: 'Punti ancora da valutare' }),
        sez.soglia != null && h('u', { style: { left: `${(sez.soglia / sez.massimo) * 100}%` }, title: `Minimo ${fmt(sez.soglia)}` })),
    );
  }));
}
