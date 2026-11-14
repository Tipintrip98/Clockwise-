// Produzione › Piano e ordine del giorno: piano di lavorazione, calendario, DOOD, ordine del giorno e stralci.
import { h, metti, svuota, toast, scelta, salvaFile, copiaTesto, nomeFilePulito, bottoneConferma } from './dom.js';
import { salva, salvaPresto } from './app.js';
import { pianoLavorazione, dood, pagine, csvPiano } from '../core/sceneggiatura.js';
import { calendarioRiprese, ordineDelGiorno, testoOdg, stralci, dataEstesa, csvCalendario } from '../core/odg.js';
import { serveSpoglio } from './sezioni.js';

const SETTIMANA = [{ id: 5, nome: '5 giorni (riposo sabato e domenica)' }, { id: 6, nome: '6 giorni (riposo la domenica)' }, { id: 7, nome: '7 giorni (nessun riposo)' }];

export function vistaPiano(area, ctx, apri) {
  const { p, prod, terr, copioni } = ctx;
  const sp = prod.spoglio;
  if (!sp) { metti(area, serveSpoglio(apri, 'Il piano di lavorazione e l’ordine del giorno si costruiscono dalle scene, dai set e dai personaggi rilevati.')); return; }
  prod.calendario = prod.calendario || { inizio: '', giorniSettimana: 6 };
  prod.odg = prod.odg || { giorno: 1, convocazione: '', oreLavoro: 10, produzione: '', note: '' };
  const cal = prod.calendario, o = prod.odg;
  const areaOdg = h('div');

  function disegnaOdg(piano) {
    o.giorno = Math.min(Math.max(1, o.giorno || 1), piano.totale);
    const odg = ordineDelGiorno(sp, piano, o.giorno, { ...cal, convocazione: o.convocazione, oreLavoro: o.oreLavoro });
    const opz = { titolo: p.dati.titolo || p.nome, produzione: o.produzione, note: o.note };
    const testo = testoOdg(odg, opz);
    const sides = stralci(copioni[0], sp, odg.scene.map((s) => s.numero));
    const reparti = Object.values(odg.reparti);
    metti(svuota(areaOdg),
      h('div.grid.w',
        scelta('Giornata', piano.giorni.map((d) => ({ id: d.n, nome: `Giorno ${d.n} — ${d.set.join(' / ').slice(0, 44)}` })), o.giorno, (v) => { o.giorno = Number(v); salvaPresto(); disegnaOdg(piano); }, { id: 'odg-giorno' }),
        h('label.field', { for: 'odg-conv' }, h('span', 'Convocazione troupe'), h('input', { id: 'odg-conv', type: 'time', value: o.convocazione || odg.orari.troupe, onchange: (e) => { o.convocazione = e.target.value; salvaPresto(); disegnaOdg(piano); } })),
        h('label.field', { for: 'odg-ore' }, h('span', 'Ore di lavorazione'), h('input', { id: 'odg-ore', type: 'number', min: '6', max: '12', step: '1', value: o.oreLavoro || 10, onchange: (e) => { o.oreLavoro = Number(e.target.value) || 10; salvaPresto(); disegnaOdg(piano); } })),
        h('label.field', { for: 'odg-prod' }, h('span', 'Produzione (intestazione)'), h('input', { id: 'odg-prod', type: 'text', value: o.produzione || '', placeholder: 'Ragione sociale', onchange: (e) => { o.produzione = e.target.value; salvaPresto(); disegnaOdg(piano); } }))),
      h('div.odg',
        h('div.spread', h('div', h('div.label', `Ordine del giorno n. ${odg.giorno} di ${odg.di}`), h('h3', { style: { fontSize: '1.15rem' } }, odg.data ? dataEstesa(odg.data) : 'Data da definire'), h('div.muted.small', odg.set.map((s) => `${s.nome}${s.luogo ? ` (${s.luogo})` : ''}`).join(' · '))),
          h(`span.tag.${odg.turno === 'NOTTE' ? 'accent' : 'x'}`, odg.turno === 'NOTTE' ? 'Turno di notte' : 'Turno di giorno')),
        h('div.orari', [['Trucco e costumi', odg.orari.trucco], ['Troupe', odg.orari.troupe], ['Pronti a girare', odg.orari.prontiAGirare], ['Pausa', odg.orari.pausa], ['Fine', odg.orari.fine]].map(([n, v]) => h('div', h('div.label', n), h('div.num', v)))),
        h('div.tablewrap', h('table',
          h('thead', h('tr', h('th', 'Scena'), h('th', 'Set'), h('th', 'Che cosa accade'), h('th', 'Cast'), h('th.r', 'Pagine'))),
          h('tbody', odg.scene.map((s) => h('tr', h('td.num', s.numero), h('td', h('div', { style: { fontWeight: 500 } }, `${s.intEst}. ${s.ambiente}`), h('div.muted.small', s.luce)), h('td.small', s.sinossi || '—', s.comparse ? h('div.muted', `Comparse: ${s.comparse}`) : null),
            h('td.small.num', s.personaggi.map((n) => odg.cast.find((c) => c.personaggio === n)?.n ?? n).join(', ') || '—'), h('td.r.num', pagine(s.ottavi))))))),
        h('div.cols', { style: { gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' } },
          h('div', h('h4', 'Cast convocato'), odg.cast.length ? h('ul.checklist', odg.cast.map((c) => h('li', h('span.ico', { 'aria-hidden': 'true' }, String(c.n ?? '·')), h('div', h('div.t', c.personaggio), h('div.d', `Trucco ${odg.orari.trucco} · sul set ${odg.orari.prontiAGirare} · scene ${c.scene.join(', ')}`))))) : h('div.muted.small', 'Nessun personaggio in scena.')),
          h('div', h('h4', 'Reparti e sicurezza'),
            reparti.length ? h('ul.small', { style: { margin: '6px 0 0', paddingLeft: '18px' } }, reparti.map((r) => h('li', h('strong', `${r.nome}: `), r.voci.map((v) => v.voce).join(', ')))) : h('div.muted.small', 'Nessun fabbisogno particolare.'),
            odg.sicurezza.length ? h('div.notice.warn', { style: { marginTop: '8px' } }, h('strong', 'Da preparare: '), odg.sicurezza.join('; ')) : null)),
        odg.domani ? h('div.muted.small', `Domani, giorno ${odg.domani.n}${odg.domani.data ? ` (${dataEstesa(odg.domani.data)})` : ''}: ${odg.domani.set.join(' / ')} · scene ${odg.domani.scene.join(', ')}.`) : null),
      h('label.field', { for: 'odg-note' }, h('span', 'Note per la troupe (punto di ritrovo, parcheggi, meteo, contatti)'),
        h('textarea', { id: 'odg-note', rows: '2', style: { minHeight: '60px', fontFamily: 'var(--font-body)', fontSize: '.92rem' }, value: o.note || '', onchange: (e) => { o.note = e.target.value; salvaPresto(); } })),
      h('div.row',
        h('button.btn.primary', { type: 'button', onclick: () => copiaTesto(testoOdg(odg, { ...opz, note: o.note }), 'Ordine del giorno copiato') }, 'Copia l’ordine del giorno'),
        h('button.btn', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`odg-${odg.giorno}-${p.dati.titolo || p.nome}`, 'txt'), testoOdg(odg, { ...opz, note: o.note })) }, 'Scarica (.txt)'),
        sides ? h('button.btn', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`stralci-giorno-${odg.giorno}-${p.dati.titolo || p.nome}`, 'txt'), `STRALCI — GIORNO ${odg.giorno}${odg.data ? ` — ${dataEstesa(odg.data)}` : ''}\n${p.dati.titolo || p.nome}\n\n${sides}`) }, 'Scarica gli stralci del giorno')
          : h('span.muted.small', copioni.length ? 'Stralci non disponibili: la sceneggiatura non ha intestazioni di scena riconoscibili.' : 'Per gli stralci serve la sceneggiatura tra i documenti.')));
    void testo;
  }

  function disegna() {
    const piano = pianoLavorazione(sp, { ottaviGiorno: prod.ottaviGiorno || 32 });
    const date = calendarioRiprese(piano.totale, cal);
    const giornate = dood(sp, piano);
    const g = p.dati.giorni;
    const allineato = g.ripreseTot === piano.totale && g.ripreseSicilia === piano.inSicilia;
    metti(svuota(area),
      h('div.panel.stack',
        h('div.spread', h('h2', 'Piano di lavorazione'),
          h('div.row',
            h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`piano-lavorazione-${p.nome}`, 'csv'), csvPiano(sp, piano, terr), 'text/csv') }, 'Scarica piano (CSV)'),
            date.length ? h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`calendario-riprese-${p.nome}`, 'csv'), csvCalendario(sp, piano, cal), 'text/csv') }, 'Scarica calendario (CSV)') : null)),
        h('div.grid.w',
          h('label.field', { for: 'pagine-giorno' }, h('span', 'Pagine girate al giorno'),
            h('input', { id: 'pagine-giorno', type: 'number', min: '1', max: '12', step: '0.5', value: (prod.ottaviGiorno || 32) / 8, onchange: (e) => { prod.ottaviGiorno = Math.max(8, Math.round((Number(e.target.value) || 4) * 8)); salvaPresto(); disegna(); } })),
          h('label.field', { for: 'inizio-riprese' }, h('span', 'Primo giorno di riprese'),
            h('input', { id: 'inizio-riprese', type: 'date', value: cal.inizio || '', onchange: (e) => { cal.inizio = e.target.value; salvaPresto(); disegna(); } })),
          scelta('Settimana lavorativa', SETTIMANA, cal.giorniSettimana, (v) => { cal.giorniSettimana = Number(v); salvaPresto(); disegna(); }, { id: 'sel-settimana' })),
        h('div.grid.w',
          h('div.box', h('div.label', 'Giorni di riprese'), h('div.num', { style: { fontSize: '1.5rem', fontWeight: 600 } }, String(piano.totale))),
          h('div.box', h('div.label', `Di cui in ${terr}`), h('div.num', { style: { fontSize: '1.5rem', fontWeight: 600 } }, String(piano.inSicilia), piano.daDefinire ? h('span.muted.small', ` + ${piano.daDefinire} da definire`) : null)),
          h('div.box', h('div.label', 'Ultimo giorno'), h('div', { style: { fontWeight: 600 } }, date.length ? dataEstesa(date[date.length - 1]) : '—'), !date.length && h('div.muted.small', 'Indica il primo giorno di riprese.'))),
        piano.daDefinire ? h('div.notice.warn', `Per ${piano.daDefinire} ${piano.daDefinire === 1 ? 'giornata' : 'giornate'} non è indicato se il set è in ${terr}: `, h('a', { href: '#', onclick: (e) => { e.preventDefault(); apri('spoglio'); } }, 'completa l’elenco dei set'), '.') : null,
        h(`div.notice.${allineato ? 'ok' : 'info'}`,
          allineato ? `I Dati chiave riportano già ${piano.totale} giorni di riprese, ${piano.inSicilia} in ${terr}.`
            : h('span', `Nei Dati chiave risultano ${g.ripreseTot ?? '—'} giorni di riprese, ${g.ripreseSicilia ?? '—'} in ${terr}; da questo piano ne risultano ${piano.totale}, ${piano.inSicilia} in ${terr}. `,
              piano.daDefinire ? 'Completa i set da definire per poterli riportare nei Dati chiave.'
                : bottoneConferma('Usa quelli del piano', 'Conferma: sostituisci nei Dati chiave', () => { g.ripreseTot = piano.totale; g.ripreseSicilia = piano.inSicilia; salva(p).then(() => { toast('Giorni di riprese riportati nei Dati chiave'); disegna(); }); }, 'btn.s'))),
        h('div.tablewrap', h('table',
          h('thead', h('tr', h('th', 'Giorno'), date.length ? h('th', 'Data') : null, h('th', 'Turno'), h('th', 'Set'), h('th', 'Scene'), h('th.r', 'Pagine'), h('th', `In ${terr}`), h('th', ''))),
          h('tbody', piano.giorni.map((d) => h('tr',
            h('td.num', String(d.n)), date.length ? h('td.small', dataEstesa(date[d.n - 1])) : null, h('td.small', d.turno === 'NOTTE' ? 'Notte' : 'Giorno'), h('td', d.set.join(' / ')), h('td.num.small', d.scene.join(', ')), h('td.r.num', pagine(d.ottavi)),
            h('td', h(`span.tag.${d.sicilia === true ? 'ok' : d.sicilia === false ? 'x' : 'warn'}`, d.sicilia === true ? 'Sì' : d.sicilia === false ? 'No' : d.sicilia === 'misto' ? 'In parte' : 'Da definire')),
            h('td.r', h('button.btn.s.ghost', { type: 'button', 'aria-label': `Ordine del giorno ${d.n}`, onclick: () => { o.giorno = d.n; salvaPresto(); disegnaOdg(piano); areaOdg.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 'ODG'))))))),
        h('p.muted.small', 'Bozza automatica: le scene sono raggruppate per set e per giorno/notte e distribuite fino alla quantità di pagine indicata. Va rifinita con disponibilità degli attori, spostamenti e meteo.')),

      h('div.panel.stack', { id: 'pannello-odg' },
        h('div', h('h2', 'Ordine del giorno'), h('p.muted.small', 'Per ogni giornata del piano: orari, scene, cast convocato, fabbisogni dei reparti e avvertenze di sicurezza, pronti da copiare o scaricare.')),
        areaOdg),

      h('div.panel.stack',
        h('h2', 'Personaggi e giornate (DOOD)'),
        h('div.tablewrap', h('table',
          h('thead', h('tr', h('th', 'N.'), h('th', 'Personaggio'), h('th.r', 'Scene'), h('th.r', 'Giorni di lavoro'), h('th.r', 'Primo'), h('th.r', 'Ultimo'), h('th.r', 'Giorni di attesa'))),
          h('tbody', giornate.map((x, i) => h('tr', h('td.num', String(i + 1)), h('td', { style: { fontWeight: 500 } }, x.nome), h('td.r.num', String(x.scene)), h('td.r.num', String(x.lavoro)), h('td.r.num', x.primo ?? '—'), h('td.r.num', x.ultimo ?? '—'), h('td.r.num', String(x.attesa))))))),
        h('p.muted.small', 'Giorni di attesa: giornate tra il primo e l’ultimo giorno di lavoro in cui il personaggio non gira. Molti giorni di attesa per un interprete principale sono un costo: conviene riordinare il piano.')));
    disegnaOdg(piano);
  }
  disegna();
}
