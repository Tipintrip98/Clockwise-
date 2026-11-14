// Guida al primo utilizzo: un giro in pochi passi con un riquadro che indica ogni elemento,
// più i suggerimenti che compaiono la prima volta che si apre una scheda.
import { h } from './dom.js';

let attivo = null;

function chiudi(completato) {
  if (!attivo) return;
  const { nodi, alTermine, suTasto, suResize } = attivo;
  for (const n of nodi) n.remove();
  document.removeEventListener('keydown', suTasto);
  window.removeEventListener('resize', suResize);
  attivo = null;
  alTermine?.(completato);
}
export const tutorialAttivo = () => !!attivo;

/**
 * passi: [{ titolo, testo, bersaglio?: selettore CSS, prima?: async () => void }]
 * Il passo senza bersaglio (o con bersaglio assente) compare al centro.
 */
export function avviaTutorial(passi, alTermine) {
  chiudi(false);
  const foro = h('div.tour-foro', { 'aria-hidden': 'true' });
  const velo = h('div.tour-velo', { 'aria-hidden': 'true' });
  const scheda = h('div.tour-scheda', { role: 'dialog', 'aria-modal': 'true', 'aria-live': 'polite' });
  document.body.append(velo, foro, scheda);
  let indice = 0, token = 0;

  const colloca = () => {
    const passo = passi[indice];
    const el = passo.bersaglio ? document.querySelector(passo.bersaglio) : null;
    const r = el?.getBoundingClientRect();
    const visibile = r && r.width > 0 && r.height > 0;
    const lv = window.innerWidth, av = window.innerHeight;
    if (!visibile) {
      foro.style.cssText = 'opacity:0';
      scheda.style.left = `${Math.max(12, (lv - scheda.offsetWidth) / 2)}px`;
      scheda.style.top = `${Math.max(12, (av - scheda.offsetHeight) / 2)}px`;
      return;
    }
    const m = 6;
    foro.style.cssText = `opacity:1;left:${r.left - m}px;top:${r.top - m}px;width:${r.width + 2 * m}px;height:${r.height + 2 * m}px`;
    const sotto = av - r.bottom, sopra = r.top;
    const alto = scheda.offsetHeight, largo = scheda.offsetWidth;
    let top = sotto >= alto + 24 || sotto >= sopra ? r.bottom + 14 : r.top - alto - 14;
    top = Math.min(Math.max(12, top), Math.max(12, av - alto - 12));
    // bersaglio più alto dello schermo: la scheda va in basso, così l'inizio dell'elemento resta visibile
    if (r.height > av * 0.6) top = Math.max(12, av - alto - 12);
    const left = Math.min(Math.max(12, r.left + r.width / 2 - largo / 2), Math.max(12, lv - largo - 12));
    scheda.style.left = `${left}px`; scheda.style.top = `${top}px`;
  };

  const mostra = async (i) => {
    const mio = ++token;
    indice = Math.min(Math.max(0, i), passi.length - 1);
    const passo = passi[indice];
    try { await passo.prima?.(); } catch { /* il passo si mostra comunque, al centro */ }
    if (mio !== token || !attivo) return;
    const el = passo.bersaglio ? document.querySelector(passo.bersaglio) : null;
    if (el) el.scrollIntoView({ block: el.getBoundingClientRect().height > window.innerHeight * 0.6 ? 'start' : 'center', inline: 'nearest' });
    const ultimo = indice === passi.length - 1;
    scheda.replaceChildren(
      h('div.spread', h('span.label', `${indice + 1} di ${passi.length}`), h('button.btn.s.ghost', { type: 'button', id: 'tour-salta', onclick: () => chiudi(false) }, ultimo ? 'Chiudi' : 'Salta la guida')),
      h('h3', passo.titolo),
      h('p', passo.testo),
      h('div.tour-punti', { 'aria-hidden': 'true' }, passi.map((_, k) => h(`i${k === indice ? '.on' : ''}`))),
      h('div.row', { style: { justifyContent: 'flex-end' } },
        indice > 0 && h('button.btn.s', { type: 'button', onclick: () => mostra(indice - 1) }, '← Indietro'),
        h('button.btn.s.primary', { type: 'button', id: 'tour-avanti', onclick: () => (ultimo ? chiudi(true) : mostra(indice + 1)) }, ultimo ? 'Comincia' : 'Avanti →')));
    scheda.setAttribute('aria-label', passo.titolo);
    requestAnimationFrame(() => { if (mio === token && attivo) { colloca(); scheda.querySelector('#tour-avanti')?.focus({ preventScroll: true }); } });
  };

  const suTasto = (e) => {
    if (e.key === 'Escape') chiudi(false);
    else if (e.key === 'ArrowRight') { if (indice < passi.length - 1) mostra(indice + 1); }
    else if (e.key === 'ArrowLeft') { if (indice > 0) mostra(indice - 1); }
  };
  const suResize = () => colloca();
  attivo = { nodi: [velo, foro, scheda], alTermine, suTasto, suResize };
  document.addEventListener('keydown', suTasto);
  window.addEventListener('resize', suResize);
  mostra(0);
}

/**
 * Suggerimento contestuale, mostrato una sola volta: un riquadro in cima alla scheda con «Ho capito».
 * Restituisce il nodo oppure null se è già stato visto.
 */
export function suggerimento(id, visti, titolo, testo, alChiudi) {
  if (visti?.[id]) return null;
  const el = h('div.dritta', { role: 'note', dataset: { dritta: id } },
    h('div', h('strong', titolo), h('span', ` ${testo}`)),
    h('button.btn.s', { type: 'button', onclick: () => { el.remove(); alChiudi(id); } }, 'Ho capito'));
  return el;
}
