// Quadrante del punteggio e barre di sezione.
// Colori e forme vengono dal foglio di stile (classi q-* e bar-*): qui c'è solo la geometria, disegnata in scala.
import { h, s, fmt } from './dom.js';

const CX = 120, CY = 120, R = 88, SPESSORE = 15, INIZIO = 135, AMPIEZZA = 270;
const angolo = (v, max) => INIZIO + (AMPIEZZA * Math.min(Math.max(v, 0), max)) / max;
const punto = (gradi, r = R) => { const a = (gradi * Math.PI) / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; };
const n2 = (v) => v.toFixed(2);
function arco(v1, v2, max, r = R) {
  const a1 = angolo(v1, max), a2 = angolo(v2, max);
  const [x1, y1] = punto(a1, r), [x2, y2] = punto(a2, r);
  return `M ${n2(x1)} ${n2(y1)} A ${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${n2(x2)} ${n2(y2)}`;
}
const raggio = (gradi, r1, r2) => { const [x1, y1] = punto(gradi, r1), [x2, y2] = punto(gradi, r2); return { x1: n2(x1), y1: n2(y1), x2: n2(x2), y2: n2(y2) }; };

let serie = 0; // ogni quadrante ha la sua sfumatura: gli id devono essere unici nella pagina

/**
 * Quadrante letto in senso orario, da 0 al massimo del bando su 270°: ghiera con una tacca ogni 5% della scala,
 * arco del punteggio nel colore dell'esito, forbice minimo–massimo all'interno, tacca della soglia.
 */
export function quadrante(ris) {
  const max = ris.massimo || 100;
  const id = `q-sfumatura-${++serie}`;
  const forbice = ris.max > ris.min + 0.05;
  const soglia = ris.sogliaTotale > 0 ? ris.sogliaTotale : null;
  const descrizione = `Punteggio stimato ${fmt(ris.totale)} su ${max}${soglia ? `, soglia ${soglia}` : ''}${forbice ? `, forbice ${fmt(ris.min)}–${fmt(ris.max)}` : ''}`;
  const tacche = Array.from({ length: 21 }, (_, k) => s('line', { class: `q-tacca${k % 2 ? '' : ' g'}`, ...raggio(angolo((max * k) / 20, max), R + 13, R + (k % 2 ? 17 : 20)), 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
  const [fx, fy] = punto(angolo(ris.totale, max));
  const [lx, ly] = soglia ? punto(angolo(soglia, max), R - 27) : [0, 0];
  const [zx, zy] = punto(INIZIO), [mx, my] = punto(INIZIO + AMPIEZZA);
  const svg = s('svg', { viewBox: '0 0 240 240', role: 'img', 'aria-label': descrizione },
    s('title', null, descrizione),
    s('defs', null, s('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: CX - R, y1: 0, x2: CX + R, y2: 0 },
      s('stop', { offset: '0', style: 'stop-color: var(--q-chiaro)' }), s('stop', { offset: '1', style: 'stop-color: var(--q)' }))),
    tacche,
    s('text', { class: 'q-scala', x: n2(zx), y: n2(zy + 26), 'text-anchor': 'middle', 'font-size': 11 }, '0'),
    s('text', { class: 'q-scala', x: n2(mx), y: n2(my + 26), 'text-anchor': 'middle', 'font-size': 11 }, String(max)),
    s('path', { class: 'q-pista', d: arco(0, max, max), fill: 'none', 'stroke-width': SPESSORE, 'stroke-linecap': 'round' }),
    forbice && s('path', { class: 'q-forbice', d: arco(ris.min, ris.max, max, R - 14), fill: 'none', 'stroke-width': 3.5, 'stroke-linecap': 'round' }),
    ris.totale > 0 && s('path', { class: 'q-arco', d: arco(0, ris.totale, max), pathLength: 100, fill: 'none', stroke: `url(#${id})`, 'stroke-width': SPESSORE, 'stroke-linecap': 'round' }),
    ris.totale > 0 && s('circle', { class: 'q-punta', cx: n2(fx), cy: n2(fy), r: 3.6 }),
    soglia && s('line', { class: 'q-soglia-bordo', ...raggio(angolo(soglia, max), R - 12, R + 21), 'stroke-width': 8, 'stroke-linecap': 'round' }),
    soglia && s('line', { class: 'q-soglia', ...raggio(angolo(soglia, max), R - 12, R + 21), 'stroke-width': 4, 'stroke-linecap': 'round' }),
    soglia && s('text', { class: 'q-soglia-n', x: n2(lx), y: n2(ly + 4), 'text-anchor': 'middle', 'font-size': 11.5 }, String(soglia)),
  );
  return h('div.dial', { dataset: { esito: ris.esito || 'parziale' } }, svg, h('div.c',
    h('div.v', fmt(ris.totale)),
    h('div.of', `su ${max}${ris.completo ? '' : ' · parziale'}`),
    forbice && h('div.rg', `${fmt(ris.min)} – ${fmt(ris.max)}`),
  ));
}

const pct = (v, max) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;

/**
 * Barre per sezione: il riempimento dice lo stato (minimo raggiunto, non raggiunto, stima parziale), il tratteggio i
 * punti ancora da valutare, la tacca il minimo richiesto. L'etichetta colorata identifica la sezione per posizione.
 */
export function barreSezioni(ris) {
  const classi = ris.sezioni.map((sez) => (!sez.completo ? (sez.raggiungibile ? 'parz' : 'bad') : sez.superata ? 'ok' : 'bad'));
  const conSoglia = ris.sezioni.some((sez) => sez.soglia != null);
  const voce = (classe, testo) => h('span', h(`i.${classe}`), testo);
  return h('div.bars',
    ris.sezioni.map((sez, i) => h('div',
      h('div.bar-h',
        h('span', h('b.sez-chip', { dataset: { sez: String(i + 1) } }, sez.id), h('span', sez.nome)),
        h('span.n', h('strong', fmt(sez.punti)), ` / ${fmt(sez.massimo)}`, sez.soglia != null && h('span.muted', ` · min ${fmt(sez.soglia)}`))),
      h('div.bar', { role: 'img', 'aria-label': `Sezione ${sez.id}: ${fmt(sez.punti)} su ${fmt(sez.massimo)}${sez.soglia != null ? `, minimo ${fmt(sez.soglia)}` : ''}` },
        h(`i.${classi[i]}`, { style: { width: pct(sez.punti, sez.massimo) }, title: `${fmt(sez.punti)} punti su ${fmt(sez.massimo)}` }),
        sez.daValutare > 0 && h('em', { style: { left: pct(sez.punti, sez.massimo), width: `calc(${pct(sez.daValutare, sez.massimo)} - 2px)` }, title: `${fmt(sez.daValutare)} punti ancora da valutare` }),
        sez.soglia != null && h('u', { style: { left: pct(sez.soglia, sez.massimo) }, title: `Minimo ${fmt(sez.soglia)}` })))),
    h('div.bar-leg', { 'aria-hidden': 'true' },
      classi.includes('ok') && voce('ok', conSoglia ? 'Minimo raggiunto' : 'Valutata'),
      classi.includes('bad') && voce('bad', 'Sotto il minimo'),
      classi.includes('parz') && voce('parz', 'Stima parziale'),
      ris.sezioni.some((sez) => sez.daValutare > 0) && voce('att', 'Da valutare'),
      conSoglia && voce('min', 'Minimo di sezione')));
}
