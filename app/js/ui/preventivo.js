// Produzione › Preventivo: righe di costo assegnate alle voci del Modulo III, quota spesa sul territorio,
// totali da riportare nei Dati chiave. Importa il Master Budget in Excel.
import { h, metti, svuota, toast, euro, fmt, salvaFile, nomeFilePulito, bottoneConferma } from './dom.js';
import { salva, salvaPresto } from './app.js';
import { apriFoglio } from '../core/docs.js';
import { VOCI, GRUPPI, eMasterBudget, leggiMasterBudget, totaliPreventivo, datiDalPreventivo, csvModuloIII, voceProposta } from '../core/preventivo.js';
import { nuovoId } from '../core/store.js';
import { TARIFFE_ATTORI_RIFERIMENTO as ATTORI, TARIFFE_RIFERIMENTO as TROUPE } from '../core/tariffe-riferimento.js';

const TIPO = { paga: 'paga', fattura: 'fattura', fee: 'fee', altro: '' };

// Minimi contrattuali pubblicati, come termine di confronto per le righe del cast.
function minimi() {
  if (!ATTORI?.voci?.length) return null;
  const basso = new Map((ATTORI.vociOpereABassoBudget || []).map((v) => [v.livello, v.minimo]));
  return h('details.more.panel',
    h('summary', 'Minimi contrattuali di riferimento per gli attori'),
    h('div.stack-s',
      h('div.tablewrap', h('table',
        h('thead', h('tr', h('th', 'Ruolo'), h('th.r', `Minimo per ${ATTORI.unita || 'giornata'}`), h('th.r', 'Dall’ottava posa'), h('th.r', 'Opere a basso budget'))),
        h('tbody', ATTORI.voci.map((v) => h('tr', h('td', v.ruolo), h('td.r.num', euro(v.minimo)), h('td.r.num', v.dallaOttavaPosa ? euro(v.dallaOttavaPosa) : '—'), h('td.r.num', basso.has(v.livello) ? euro(basso.get(v.livello)) : '—')))))),
      h('p.muted.small', ATTORI.avvertenza || '', ' Fonte: ', h('a', { href: ATTORI.url, target: '_blank', rel: 'noopener' }, ATTORI.fonte), '.'),
      TROUPE?.url ? h('p.muted.small', 'Tecnici e maestranze: le ultime tabelle dei minimi pubblicate risalgono al ', String(TROUPE.anno), ' e non rappresentano i compensi correnti; il rinnovo del contratto era in trattativa a settembre 2026. ', h('a', { href: TROUPE.url, target: '_blank', rel: 'noopener' }, 'Archivio del contratto troupes'), '.') : null));
}

export function vistaPreventivo(area, ctx) {
  const { p, terr, mostra } = ctx;
  p.preventivo = p.preventivo || { righe: [], origine: null };
  const prev = p.preventivo;
  const stato = h('div'), tabella = h('div'), totali = h('div.sticky');

  async function importa(file) {
    if (!file) return;
    metti(svuota(stato), h('div.notice', h('span.spin'), ` Lettura di «${file.name}»…`));
    try {
      const wb = await apriFoglio(file);
      if (!eMasterBudget(wb)) throw new Error('Questo file non ha l’impaginazione del Master Budget (foglio “BUDGET” con le colonne dei lordi). Puoi inserire le righe a mano qui sotto.');
      const r = leggiMasterBudget(wb);
      if (!r.righe.length) throw new Error(r.avvisi[0] || 'Nessun importo trovato nel file.');
      // le quote già impostate si conservano per le righe con lo stesso nome e la stessa sezione
      const quote = new Map(prev.righe.map((x) => [`${x.sezione}|${x.nome}`, x]));
      prev.righe = r.righe.map((x) => { const v = quote.get(`${x.sezione}|${x.nome}`); return { ...x, id: nuovoId(), quota: v ? v.quota : 0, voce: v ? v.voce : x.voce }; });
      prev.origine = { file: file.name, data: new Date().toISOString(), avvisi: r.avvisi, totaleLordo: r.totaleLordo };
      await salva(p);
      svuota(stato); disegna();
      toast(`${r.righe.length} righe importate da «${file.name}»`);
    } catch (e) { metti(svuota(stato), h('div.notice.bad', e.message || 'File non leggibile.')); }
  }

  function disegnaTotali() {
    const t = totaliPreventivo(prev.righe);
    const e = p.dati.economici;
    const nuovi = datiDalPreventivo(t);
    const uguali = ['costoProduzione', 'costoAmmissibile', 'spesaSicilia', 'producerFee'].every((k) => Math.round(e[k] || 0) === nuovi[k]);
    const contributo = e.contributoRichiesto;
    const rapporto = contributo && t.spesaSicilia ? (t.spesaSicilia / contributo) * 100 : null;
    metti(svuota(totali), h('div.stack',
      h('div.panel.stack',
        h('div', h('div.label', 'Totali del preventivo'), h('h2', euro(t.costoProduzione))),
        h('ul.live',
          h('li', h('div', 'Costo ammissibile'), h('div.pts', h('b', euro(t.costoAmmissibile)))),
          h('li', h('div', `Spesa ammissibile in ${terr}`), h('div.pts', h('b', euro(t.spesaSicilia))), rapporto != null && h(`div.sub${rapporto < 150 ? '.w' : ''}`, `${fmt(rapporto)}% del contributo richiesto (${euro(contributo)}): minimo di ammissibilità 150%.`)),
          h('li', h('div', 'Producer fee'), h('div.pts', h('b', euro(t.producerFee))), t.feeEccedente > 0 && h('div.sub.w', `${euro(t.feeEccedente)} oltre il 7,5% non ammissibili.`)),
          h('li', h('div', 'Sopra la linea'), h('div.pts', h('b', t.pctSopraLinea == null ? '—' : `${fmt(t.pctSopraLinea)}%`)), h('div.sub', `${euro(t.sopraLinea)}: soggetto, direzione e componente artistica.`))),
        t.avvisi.map((a) => h('div.notice.warn', a)),
        !prev.righe.length ? null : uguali ? h('div.notice.ok', 'I Dati chiave riportano già questi totali.')
          : h('div.stack-s', h('div.muted.small', `Nei Dati chiave: costo ${euro(e.costoProduzione)}, spesa in ${terr} ${euro(e.spesaSicilia)}.`),
            bottoneConferma('Riporta nei Dati chiave', 'Conferma: sostituisci i quattro importi', () => { Object.assign(e, nuovi); salva(p).then(() => { toast('Totali riportati nei Dati chiave'); disegnaTotali(); }); }, 'btn.primary')),
        prev.righe.length ? h('div.row', h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`modulo-III-budget-${p.dati.titolo || p.nome}`, 'csv'), csvModuloIII(t, terr), 'text/csv') }, 'Riepilogo per il Modulo III (CSV)'),
          h('button.btn.s', { type: 'button', onclick: () => mostra('dati') }, 'Apri i Dati chiave →')) : null),
      t.costoProduzione ? h('div.panel', h('h3', 'Per voce del Modulo III'),
        h('div.tablewrap', h('table', h('thead', h('tr', h('th', 'Voce'), h('th.r', 'Importo'), h('th.r', `In ${terr}`))),
          h('tbody', t.gruppi.filter((g) => g.importo).map((g) => h('tr', h('td', h('strong', `A.${g.id}`), ` ${g.nome}`), h('td.r.num', euro(g.importo)), h('td.r.num', g.nonAmmissibile ? '—' : euro(g.sicilia)))))))) : null));
  }

  function riga(r) {
    const aggiorna = () => { salvaPresto(); disegnaTotali(); };
    return h('tr',
      h('td', { style: { minWidth: '210px' } }, h('input', { type: 'text', value: r.nome, 'aria-label': 'Descrizione', oninput: (e) => { r.nome = e.target.value; salvaPresto(); } }), r.sezione && h('div.muted.small', r.sezione)),
      h('td', { style: { minWidth: '230px' } }, h('select', { 'aria-label': 'Voce del Modulo III', onchange: (e) => { r.voce = e.target.value; aggiorna(); } },
        GRUPPI.map((g) => h('optgroup', { label: `A.${g.id} ${g.nome}` }, VOCI.filter((v) => v.gruppo === g.id).map((v) => h('option', { value: v.codice, selected: v.codice === r.voce }, `${v.codice} ${v.nome}`)))))),
      h('td.r', { style: { width: '128px' } }, h('input', { type: 'number', min: '0', step: 'any', value: r.costo ?? '', 'aria-label': 'Costo IVA esclusa', oninput: (e) => { r.costo = e.target.value === '' ? null : Number(e.target.value); aggiorna(); } }),
        r.lordo != null && r.tipo && r.tipo !== 'altro' && r.tipo !== 'fee' && h('div.muted.small.num', `${TIPO[r.tipo]}: lordo ${euro(r.lordo)}`)),
      h('td.r', { style: { width: '88px' } }, h('input', { type: 'number', min: '0', max: '100', step: '5', value: r.quota ?? 0, 'aria-label': `Quota spesa in ${terr} (%)`, oninput: (e) => { r.quota = Math.max(0, Math.min(100, Number(e.target.value) || 0)); aggiorna(); } })),
      h('td.r', h('button.btn.s.ghost', { type: 'button', 'aria-label': `Rimuovi ${r.nome}`, onclick: () => { prev.righe = prev.righe.filter((x) => x !== r); salva(p).then(disegna); } }, '✕')));
  }

  function disegna() {
    const quotaTutte = h('input', { id: 'quota-tutte', type: 'number', min: '0', max: '100', step: '5', placeholder: '%', style: { width: '90px' } });
    metti(svuota(tabella),
      prev.origine && h('div.notice.ok', h('strong', `Importato da «${prev.origine.file}» `), `il ${new Date(prev.origine.data).toLocaleDateString('it-IT')} · totale lordo ${euro(prev.origine.totaleLordo)}. I lordi sono convertiti in costo per la produzione: paghe con oneri e TFR, fatture senza IVA.`),
      (prev.origine?.avvisi || []).map((a) => h('div.notice.warn', a)),
      prev.righe.length ? h('div.row',
        h('label', { for: 'quota-tutte', class: 'small muted' }, `Quota spesa in ${terr} per tutte le righe`), quotaTutte,
        h('button.btn.s', { type: 'button', onclick: () => { const v = Number(quotaTutte.value); if (quotaTutte.value === '' || Number.isNaN(v)) return; for (const r of prev.righe) r.quota = Math.max(0, Math.min(100, v)); salva(p).then(disegna); } }, 'Applica')) : null,
      prev.righe.length ? h('div.tablewrap', h('table',
        h('thead', h('tr', h('th', 'Voce di costo'), h('th', 'Voce del Modulo III'), h('th.r', 'Costo IVA escl. €'), h('th.r', `In ${terr} %`), h('th', ''))),
        h('tbody', prev.righe.map(riga)))) : h('div.panel.flat.empty', h('strong', 'Preventivo vuoto'), 'Importa il Master Budget oppure aggiungi le righe a mano.'),
      h('div.spread',
        h('button.btn.s', { type: 'button', onclick: () => { prev.righe.push({ id: nuovoId(), sezione: '', nome: '', lordo: null, costo: null, tipo: 'altro', voce: voceProposta(''), quota: 0 }); salva(p).then(disegna); } }, '+ Aggiungi riga'),
        prev.righe.length ? bottoneConferma('Svuota il preventivo', 'Conferma: elimina tutte le righe', () => { prev.righe = []; prev.origine = null; salva(p).then(disegna); }) : null));
    disegnaTotali();
  }

  const ingresso = h('input', { id: 'file-budget', type: 'file', accept: '.xlsx,.xls', hidden: true, onchange: (e) => { importa(e.target.files[0]); e.target.value = ''; } });
  metti(area,
    h('div.panel.stack',
      h('div.spread',
        h('div', h('h2', 'Preventivo'),
          h('p.muted', { style: { maxWidth: '74ch', marginTop: '4px' } }, `Ogni riga di costo è assegnata a una voce del budget del Modulo III (Sez. III.3) e ha una quota spesa in ${terr}. Dai totali escono costo di produzione, costo ammissibile, spesa sul territorio e producer fee: i numeri da cui dipendono contributo massimo, minimo del 150% e criterio di spesa.`)),
        h('div', ingresso, h('button.btn.primary', { type: 'button', id: 'btn-importa-budget', onclick: () => ingresso.click() }, 'Importa il Master Budget (Excel)'))),
      stato),
    h('div.cols', h('div.stack', tabella, minimi()), totali));
  disegna();
}
