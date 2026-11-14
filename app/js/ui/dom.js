// Piccoli strumenti per costruire l'interfaccia senza framework.
const NS = 'http://www.w3.org/2000/svg';

function applica(el, attrs, figli) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value' && 'value' in el) el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'open' || k === 'hidden' || k === 'multiple') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  const aggiungi = (c) => {
    if (c == null || c === false || c === '') return;
    if (Array.isArray(c)) c.forEach(aggiungi);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  figli.forEach(aggiungi);
  return el;
}

// h('div.panel.stack', { id: 'x', onclick }, figli…)
export function h(sel, attrs, ...figli) {
  if (attrs != null && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { figli.unshift(attrs); attrs = null; }
  const [tag, ...classi] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (classi.length) el.className = classi.join(' ');
  if (attrs?.class) { el.className = `${el.className} ${attrs.class}`.trim(); attrs = { ...attrs, class: undefined }; }
  return applica(el, attrs, figli);
}
export function s(tag, attrs, ...figli) { return applica(document.createElementNS(NS, tag), attrs, figli); }
export function svuota(el) { el.replaceChildren(); return el; }
// Come el.append(), ma salta null/false e accetta elenchi annidati.
export function metti(el, ...figli) { return applica(el, null, figli); }

export const fmt = (n, dec = 1) => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: dec }));
export const euro = (n) => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }));
export const dataBreve = (iso) => { try { return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };
export const dimensione = (b) => (b > 1048576 ? `${fmt(b / 1048576)} MB` : `${fmt(b / 1024, 0)} KB`);

let timerToast = null;
export function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = h('div.toast', { role: 'status' }, msg);
  document.body.append(el);
  clearTimeout(timerToast);
  timerToast = setTimeout(() => el.remove(), 4200);
}

// Campo numerico legato a una proprietà di un oggetto.
export function campoNumero(etichetta, oggetto, chiave, alCambio, extra = {}) {
  const id = extra.id || `f-${chiave}-${Math.random().toString(36).slice(2, 7)}`;
  const input = h('input', {
    id, type: 'number', inputmode: 'decimal', min: '0', step: extra.step || 'any', placeholder: extra.placeholder || '',
    value: oggetto[chiave] ?? '',
    oninput: (e) => { const v = e.target.value.trim(); oggetto[chiave] = v === '' ? null : Number(v); alCambio?.(); },
  });
  return h('label.field', { for: id }, h('span', etichetta), input);
}
export function campoTesto(etichetta, oggetto, chiave, alCambio, extra = {}) {
  const id = extra.id || `f-${chiave}-${Math.random().toString(36).slice(2, 7)}`;
  return h('label.field', { for: id }, h('span', etichetta), h('input', {
    id, type: 'text', value: oggetto[chiave] ?? '', placeholder: extra.placeholder || '',
    oninput: (e) => { oggetto[chiave] = e.target.value; alCambio?.(); },
  }));
}
export function scelta(etichetta, opzioni, valore, alCambio, extra = {}) {
  const id = extra.id || `s-${Math.random().toString(36).slice(2, 8)}`;
  const sel = h('select', { id, onchange: (e) => alCambio(e.target.value), disabled: extra.disabled },
    opzioni.map((o) => h('option', { value: o.id, selected: String(o.id) === String(valore) }, o.nome)));
  return etichetta ? h('label.field', { for: id }, h('span', etichetta), sel) : sel;
}

const SEGNI = { ok: '✓', attenzione: '!', critico: '✕', da_verificare: '?' };
export const segno = (esito) => h(`span.ico.${esito}`, { 'aria-hidden': 'true' }, SEGNI[esito] || '·');
export const ETICHETTE_ESITO = { ok: 'A posto', attenzione: 'Da sistemare', critico: 'Bloccante', da_verificare: 'Da confermare' };

export function elencoControlli(controlli) {
  return h('ul.checklist', controlli.map((c) => h('li',
    segno(c.esito),
    h('div', h('div.t', c.titolo, h('span', { class: 'sr', style: { position: 'absolute', left: '-9999px' } }, ` — ${ETICHETTE_ESITO[c.esito] || ''}`)), c.dettaglio && h('div.d', c.dettaglio), c.azione && h('div.d', h('strong', 'Da fare: '), c.azione)))));
}

// Conferma in due tempi: il browser dell'app non mostra finestre di conferma.
export function bottoneConferma(etichetta, conferma, azione, classe = 'btn.s.ghost.danger') {
  let armato = false, timer = null;
  const b = h(`button.${classe}`, { type: 'button', onclick: () => {
    if (armato) { clearTimeout(timer); azione(); return; }
    armato = true; b.textContent = conferma;
    timer = setTimeout(() => { armato = false; b.textContent = etichetta; }, 3500);
  } }, etichetta);
  return b;
}
