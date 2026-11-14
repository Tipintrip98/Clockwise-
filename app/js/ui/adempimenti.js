// Produzione › Adempimenti: l'elenco di ciò che una produzione italiana deve fare, fase per fase,
// con in evidenza le voci che riguardano questo film (ricavate dallo spoglio e dal dossier).
import { h, metti, svuota, salvaFile, nomeFilePulito } from './dom.js';
import { salvaPresto } from './app.js';
import { ADEMPIMENTI } from '../core/adempimenti.js';
import { condizioniProduzione } from '../core/condizioni.js';

const elenco = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const aggiornato = (v) => { const m = /^(\d{4})-(\d{2})/.exec(String(v)); return m ? `${MESI[Number(m[2]) - 1]} ${m[1]}` : String(v); };

export function vistaAdempimenti(area, ctx) {
  const { p, bando, prod } = ctx;
  prod.adempimenti = prod.adempimenti || {};
  const fatti = prod.adempimenti;
  const cond = condizioniProduzione(p, bando);
  let tutte = false;

  const pertinente = (v) => { const c = elenco(v.condizione); return !c.length || c.some((id) => cond[id]); };
  const motivo = (v) => elenco(v.condizione).filter((id) => cond[id]).map((id) => {
    const c = cond[id];
    return c.scene.length ? `${c.nome}: ${c.scene.length === 1 ? 'scena' : 'scene'} ${c.scene.slice(0, 8).join(', ')}${c.scene.length > 8 ? '…' : ''}` : `${c.nome}${c.motivo ? `: ${c.motivo}` : ''}`;
  }).join(' · ');

  function testo() {
    const righe = [`ADEMPIMENTI DI PRODUZIONE — ${p.dati.titolo || p.nome}`, ''];
    for (const fase of ADEMPIMENTI.fasi) {
      const voci = fase.voci.filter(pertinente);
      if (!voci.length) continue;
      righe.push(fase.nome.toUpperCase());
      for (const v of voci) righe.push(`${fatti[v.id] ? '[x]' : '[ ]'} ${v.titolo}${v.quando ? ` — ${v.quando}` : ''}`, `    ${v.cosa}${v.riferimento ? ` (${v.riferimento})` : ''}`);
      righe.push('');
    }
    return righe.join('\n');
  }

  function disegna() {
    const tutteLeVoci = ADEMPIMENTI.fasi.flatMap((f) => f.voci);
    const sue = tutteLeVoci.filter(pertinente);
    const completate = sue.filter((v) => fatti[v.id]).length;
    const rilevate = Object.entries(cond).filter(([, c]) => c.scene.length);
    metti(svuota(area),
      h('div.panel.stack',
        h('div.spread',
          h('div', h('h2', 'Adempimenti di produzione'),
            h('p.muted', { style: { maxWidth: '74ch', marginTop: '4px' } }, 'Che cosa serve per girare in regola in Italia, dalla preparazione alla consegna: permessi, lavoro, sicurezza, diritti, assicurazioni, contributi. Le voci legate a minori, animali, armi, droni, acqua o luoghi pubblici compaiono solo se lo spoglio le ha trovate in sceneggiatura.')),
          h('div.row', h('span.num', h('strong', `${completate} / ${sue.length}`), ' fatti'),
            h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`adempimenti-${p.dati.titolo || p.nome}`, 'txt'), testo()) }, 'Scarica l’elenco'))),
        h('div.bar', { role: 'img', 'aria-label': `${completate} adempimenti fatti su ${sue.length}` }, h('i.ok', { style: { width: `${sue.length ? (completate / sue.length) * 100 : 0}%` } })),
        !prod.spoglio && h('div.notice.info', 'Senza lo spoglio della sceneggiatura vedi solo gli adempimenti comuni a ogni produzione: avvialo dalla sezione Spoglio per aggiungere quelli richiesti dalle scene.'),
        rilevate.length ? h('div.small', h('strong', 'Rilevato in sceneggiatura: '), rilevate.map(([, c]) => `${c.nome} (${c.scene.length === 1 ? 'scena' : 'scene'} ${c.scene.slice(0, 6).join(', ')}${c.scene.length > 6 ? '…' : ''})`).join(' · ')) : null,
        h('label.check', h('input', { id: 'ademp-tutte', type: 'checkbox', checked: tutte, onchange: (e) => { tutte = e.target.checked; disegna(); } }), h('span', `Mostra anche le ${tutteLeVoci.length - sue.length} voci che non riguardano questo film`))),

      ADEMPIMENTI.fasi.map((fase) => {
        const voci = fase.voci.filter((v) => tutte || pertinente(v));
        if (!voci.length) return null;
        const ok = voci.filter((v) => fatti[v.id]).length;
        return h('div.panel.stack',
          h('div.spread', h('h2', fase.nome), h(`span.tag.${ok === voci.length ? 'ok' : 'x'}`, `${ok} / ${voci.length}`)),
          h('ul.todo', voci.map((v) => {
            const suo = pertinente(v), perche = motivo(v);
            return h('li', { style: suo ? {} : { opacity: 0.6 } },
              h('input', { type: 'checkbox', id: `ad-${v.id}`, checked: !!fatti[v.id], 'aria-label': `Fatto: ${v.titolo}`, style: { marginTop: '4px', accentColor: 'var(--accent)' }, onchange: (e) => { if (e.target.checked) fatti[v.id] = true; else delete fatti[v.id]; salvaPresto(); disegna(); } }),
              h('div',
                h('label.t', { for: `ad-${v.id}`, style: { cursor: 'pointer' } }, v.titolo, v.quando ? h('span.muted', { style: { fontWeight: 400 } }, ` — ${v.quando}`) : null),
                h('div.d', v.cosa),
                v.nota && h('div.d', h('em', v.nota)),
                perche && h('div.d', { style: { color: 'var(--accent)' } }, `Riguarda questo film — ${perche}`),
                !suo && h('div.d', 'Non rilevato in questo film.'),
                (v.riferimento || v.link || v.daVerificare) && h('div.d', v.riferimento || '', v.link ? [v.riferimento ? ' · ' : '', h('a', { href: v.link, target: '_blank', rel: 'noopener' }, 'fonte')] : null,
                  v.daVerificare ? h('span.tag.warn', { style: { marginLeft: '8px' } }, 'da verificare con il consulente') : null)),
              h('span'));
          })));
      }),
      h('p.muted.small', { style: { maxWidth: '85ch' } }, ADEMPIMENTI.avvertenza || 'Elenco orientativo: norme, importi e termini cambiano. Verifica ogni adempimento con il consulente del lavoro, il commercialista e gli enti competenti.', ADEMPIMENTI.aggiornato ? ` Aggiornato a ${aggiornato(ADEMPIMENTI.aggiornato)}.` : ''));
  }
  disegna();
}
