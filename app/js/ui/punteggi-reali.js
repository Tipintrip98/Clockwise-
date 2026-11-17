// Scheda di un bando › «Punteggi reali»: le graduatorie pubblicate, con i punteggi attribuiti davvero dalle commissioni.
// Sicilia: bando.esiti (stessa griglia del bando in vigore, entra anche nelle stime). MiC: graduatorie 2025, che avevano
// una griglia diversa da quella del 2026 e quindi si leggono soltanto qui.
import { h, fmt, euro } from './dom.js';
import { statisticheEsiti, storicoFinanziamento, getGriglia } from '../core/scoring.js';
import { esitiStorici, statisticheStoriche, CRITERI_MIC_2025 } from '../core/bandi/esiti-mic.js';
import { NOMI_LINEA } from '../core/mic.js';

const collegamento = (url, testo) => (url ? h('a', { href: url, target: '_blank', rel: 'noopener' }, testo) : h('span', testo));

/** true se per questo bando ci sono punteggi reali da mostrare. */
export function haPunteggiReali(b) {
  return esitiStorici(b).length > 0 || (b.categorie || []).some((c) => statisticheEsiti(b, c.id));
}

function distribuzione(righe, massimo) {
  // righe finanziate e non, per fasce di 5 punti: una barra per fascia
  const conTotale = righe.filter((r) => r.totale != null);
  if (!conTotale.length) return null;
  const passo = 5, minimo = Math.floor(Math.min(...conTotale.map((r) => r.totale)) / passo) * passo;
  const fasce = [];
  for (let da = minimo; da < massimo; da += passo) {
    const dentro = conTotale.filter((r) => r.totale >= da && r.totale < da + passo);
    if (dentro.length || fasce.length) fasce.push({ da, fin: dentro.filter((r) => r.stato === 'F').length, altri: dentro.filter((r) => r.stato !== 'F').length });
  }
  while (fasce.length && !fasce.at(-1).fin && !fasce.at(-1).altri) fasce.pop();
  const alto = Math.max(...fasce.map((f) => f.fin + f.altri), 1);
  return h('div.pr-isto', { role: 'img', 'aria-label': 'Distribuzione dei punteggi totali per fasce di 5 punti' },
    fasce.map((f) => h('div.pr-col', { title: `${f.da}–${f.da + passo - 1} punti: ${f.fin} finanziati, ${f.altri} non finanziati` },
      h('div.pr-barre', h('i.no', { style: { height: `${(f.altri / alto) * 100}%` } }), h('i.si', { style: { height: `${(f.fin / alto) * 100}%` } })),
      h('span', String(f.da)))));
}

function bloccoMic(b) {
  const voci = esitiStorici(b);
  if (!voci.length) return null;
  const perAtto = new Map();
  for (const v of voci) perAtto.set(v.atto.id, [...(perAtto.get(v.atto.id) || []), v]);
  const nomeCat = (id) => NOMI_LINEA[id] || (b.categorie.find((c) => c.id === id)?.nome || id).replace(/^Produzione — /, '');
  const lettere = Object.keys(CRITERI_MIC_2025);
  return [
    h('div.panel.stack',
      h('div.spread', h('h3', 'Graduatorie reali 2025'), h('span.tag.warn', 'Griglia 2025, diversa da quella del 2026')),
      h('p.muted.small.cat-prosa', 'Punteggi attribuiti dalla Commissione nelle due sessioni 2025 dei contributi selettivi alla produzione, letti dai decreti ufficiali (solo numeri: nessun titolo o società). Nel 2025 i criteri erano sette e con massimi diversi: per questo i punteggi stanno in questa sezione a parte e non entrano nel calcolo delle stime sul bando 2026. Servono a capire quanto serve, in proporzione al massimo, per essere finanziati.'),
      h('details.more', h('summary', 'I sette criteri del 2025'), h('ul.small', lettere.map((k) => h('li', h('strong', `${k} · `), CRITERI_MIC_2025[k]))))),
    [...perAtto.values()].map((gruppo) => {
      const atto = gruppo[0].atto;
      return h('div.panel.stack', { dataset: { atto: atto.id } },
        h('div', h('h3', `${atto.sessione}`), h('div.small.muted', collegamento(atto.url, atto.decreto), ` · bando: ${atto.bando}`)),
        h('div.tablewrap.intera', h('table.pr-tab',
          h('thead', h('tr', h('th', 'Linea'), h('th.r', 'Progetti'), h('th.r', 'Finanziati'), h('th.r', 'Primo'), h('th.r', 'Ultimo finanziato'), h('th.r', 'Contributo mediano'))),
          h('tbody', gruppo.map(({ categoriaId, dati }) => {
            const st = statisticheStoriche(dati);
            return h('tr',
              h('td', nomeCat(categoriaId)), h('td.r.num', st.presentati), h('td.r.num', `${st.finanziati}`), h('td.r.num', `${fmt(st.primo)} su ${fmt(dati.massimoTotale)}`),
              h('td.r.num', h('strong', fmt(st.ultimoFinanziato)), ` su ${fmt(dati.massimoTotale)}`, h('span.muted.small', ` (${fmt(st.quotaUltimo)}%)`)), h('td.r.num', euro(st.assegnatoMediano)));
          })))),
        gruppo.map(({ categoriaId, dati }) => {
          const st = statisticheStoriche(dati);
          return h('details.more', h('summary', `${nomeCat(categoriaId)}: come sono distribuiti i punteggi`),
            h('div.stack-s',
              distribuzione(dati.righe, dati.massimoTotale),
              h('div.small.muted', h('span.pr-chiave.si'), ' finanziati ', h('span.pr-chiave.no'), ' valutati per intero ma sotto il minimo'),
              h('ul.small',
                h('li', `Minimo totale ${fmt(dati.minimoTotale)} su ${fmt(dati.massimoTotale)}; chi lo ha raggiunto è stato finanziato (nessun idoneo non finanziato).`),
                h('li', `${st.fermatiAlPrimoCriterio} progetti su ${st.presentati} si sono fermati al criterio A: sotto il minimo i criteri successivi non vengono valutati.`),
                h('li', `Mediana dei finanziati, criterio per criterio: ${lettere.map((k) => `${k} ${fmt(st.mediane[k])}/${dati.massimi[k]}`).join(' · ')}.`),
                h('li', `Punteggio più basso tra i finanziati, criterio per criterio: ${lettere.map((k) => `${k} ${fmt(st.minimiFinanziati[k])}/${dati.massimi[k]}`).join(' · ')}.`),
                h('li', `Contributi assegnati: ${euro(st.assegnato)} su una dotazione di ${euro(st.dotazione)}.`))));
        }));
    }),
  ];
}

function bloccoGriglia(b) {
  const categorie = (b.categorie || []).filter((c) => statisticheEsiti(b, c.id));
  if (!categorie.length) return null;
  return h('div.panel.stack',
    h('div.spread', h('h3', 'Punteggi reali delle finestre concluse'), h('span.tag.ok', 'Stessa griglia: usati nelle stime')),
    h('p.muted.small.cat-prosa', 'Punteggi attribuiti dalla Commissione ai progetti valutati, sezione per sezione (solo numeri). Clockwise li usa come metro: per tarare le letture dei commissari simulati e per dire dove si collocherebbe un dossier in graduatoria.'),
    categorie.map((c) => {
      const st = statisticheEsiti(b, c.id);
      const storico = storicoFinanziamento(b, c.id);
      const sezioni = getGriglia(b, c.id).sezioni;
      return h('div.stack-s', { dataset: { categoria: c.id } },
        h('h4', `${c.nome} · finestra ${st.anno}`),
        h('div.grid.cat-numeri',
          h('div', h('div.label', 'Valutati'), h('div.num', String(st.valutati))),
          h('div', h('div.label', 'Finanziati'), h('div.num', String(st.finanziati))),
          h('div', h('div.label', 'Primo'), h('div.num', fmt(st.primo))),
          h('div', h('div.label', 'Ultimo finanziato'), h('div.num', fmt(st.ultimoFinanziato)))),
        h('div.tablewrap', h('table.pr-tab',
          h('thead', h('tr', h('th', 'Sezione'), h('th.r', 'Massimo'), h('th.r', 'Minimo richiesto'), h('th.r', 'Più basso'), h('th.r', 'Mediana'), h('th.r', 'Più alto'), h('th.r', 'Sotto il minimo'))),
          h('tbody', sezioni.filter((s) => st.sezioni[s.id]).map((s) => h('tr', h('td', `${s.id} · ${s.nome}`), h('td.r.num', fmt(s.max)), h('td.r.num', c.soglie?.[s.id] != null ? fmt(c.soglie[s.id]) : '—'),
            h('td.r.num', fmt(st.sezioni[s.id].min)), h('td.r.num', h('strong', fmt(st.sezioni[s.id].mediana))), h('td.r.num', fmt(st.sezioni[s.id].max)), h('td.r.num', st.esclusiPer[s.id] ? `${st.esclusiPer[s.id]} progetti` : '—')))))),
        storico.length > 1 ? h('div.small', h('strong', 'Soglia di finanziamento negli anni: '), storico.map((x) => `${x.anno}: ultimo finanziato ${fmt(x.ultimoFinanziato)}, primo ${fmt(x.primo)} (${x.finanziati} finanziati)`).join(' · '), '.') : null,
        h('div.small.muted', 'Fonte: ', collegamento(st.url, st.fonte)));
    }));
}

export function sezionePunteggiReali(b) {
  return [bloccoGriglia(b), bloccoMic(b)].flat().filter(Boolean);
}
