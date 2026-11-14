// Scheda Produzione: spoglio della sceneggiatura, piano di lavorazione, DOOD, rischi, VFX, sinossi.
import { h, metti, svuota, fmt, toast, scelta, salvaFile, copiaTesto, nomeFilePulito, bottoneConferma } from './dom.js';
import { S, salva, salvaPresto, llmAttivo } from './app.js';
import { eseguiSpoglio, riepilogoSpoglio, pianoLavorazione, dood, elementiPerReparto, rischiPerScena, vfxPerScena, generaSinossi, pagine, csvSpoglio, csvPiano, CATEGORIE_ELEMENTI } from '../core/sceneggiatura.js';

const STATO_SICILIA = [{ id: 'si', nome: 'Sì' }, { id: 'no', nome: 'No' }, { id: '', nome: 'Da definire' }];
const aStato = (v) => (v === true ? 'si' : v === false ? 'no' : '');
const daStato = (v) => (v === 'si' ? true : v === 'no' ? false : null);

export function schedaProduzione(corpo, p, bando, mostra) {
  const terr = bando.territorio || 'regione';
  const llm = llmAttivo();
  const copioni = p.documenti.filter((d) => d.tipo === 'sceneggiatura' && d.testo);
  p.produzione = p.produzione || { ottaviGiorno: 32 };
  const prod = p.produzione;
  const area = h('div.stack');
  metti(corpo, area);
  let corsa = null;

  async function avvia() {
    const documento = copioni.sort((a, b) => b.testo.length - a.testo.length)[0];
    corsa = { controller: new AbortController(), fatto: 0, totale: 0 };
    disegna();
    try {
      const spoglio = await eseguiSpoglio({
        documento, titolo: p.dati.titolo, territorio: terr, llm, signal: corsa.controller.signal,
        opzioni: { modello: S.imp.modello, impegno: S.imp.impegno === 'high' ? 'medium' : S.imp.impegno },
        onEvento: (e) => { Object.assign(corsa, e); const el = area.querySelector('#avanzamento-spoglio'); if (el) el.textContent = `Lettura delle scene: ${e.fatto} di ${e.totale} parti`; },
      });
      // conserva le scelte già fatte sui set
      Object.assign(spoglio, riepilogoSpoglio(spoglio.scene, prod.spoglio));
      prod.spoglio = spoglio; prod.sinossi = null;
      corsa = null;
      await salva(p);
      toast(`Spoglio completato: ${spoglio.scene.length} scene`);
    } catch (e) {
      corsa = null;
      toast(e?.codice === 'cancelled' ? 'Spoglio interrotto' : e.message || 'Spoglio non riuscito');
    }
    if (S.progetto?.id === p.id && area.isConnected) disegna();
  }

  function disegna() {
    const sp = prod.spoglio;
    if (!sp) {
      metti(svuota(area),
        h('div.panel.stack',
          h('div', h('h2', 'Spoglio della sceneggiatura'),
            h('p.muted', { style: { maxWidth: '72ch', marginTop: '4px' } }, 'Claude legge la sceneggiatura scena per scena e ne ricava personaggi, set, comparse, oggetti di scena, costumi, veicoli, stunt, effetti e VFX. Da lì Clockwise costruisce il piano di lavorazione, il DOOD e l’elenco dei rischi, e calcola i giorni di riprese da riportare nel dossier.')),
          !copioni.length && h('div.notice.warn', h('strong', 'Manca la sceneggiatura. '), 'Caricala nella scheda Documenti (PDF con testo, DOCX, Final Draft o Fountain).'),
          copioni.length && !llm && h('div.notice.warn', h('strong', 'Claude non è collegato. '), h('a', { href: '#collegamento' }, 'Configura il collegamento'), ' per avviare lo spoglio.'),
          corsa ? h('div.row', h('span.spin'), h('span', { id: 'avanzamento-spoglio' }, 'Preparazione…'), h('button.btn.s.danger', { type: 'button', onclick: () => corsa.controller.abort() }, 'Interrompi'))
            : h('div', h('button.btn.primary', { type: 'button', id: 'btn-spoglio', disabled: !copioni.length || !llm, onclick: avvia }, 'Avvia lo spoglio'),
              copioni.length ? h('span.muted.small', ` «${copioni[0].nome}»${copioni[0].pagine ? ` · ${copioni[0].pagine} pagine` : ''}`) : null)));
      return;
    }
    const piano = pianoLavorazione(sp, { ottaviGiorno: prod.ottaviGiorno || 32 });
    const totOttavi = sp.scene.reduce((a, s) => a + s.ottavi, 0);
    const reparti = elementiPerReparto(sp), rischi = rischiPerScena(sp), vfx = vfxPerScena(sp), giornate = dood(sp, piano);
    const g = p.dati.giorni;
    const allineato = g.ripreseTot === piano.totale && g.ripreseSicilia === piano.inSicilia;

    metti(svuota(area),
      h('div.panel.stack',
        h('div.spread',
          h('div', h('div.label', `Spoglio di «${sp.file || 'sceneggiatura'}»`), h('h2', `${sp.scene.length} scene · ${pagine(totOttavi)} pagine · ${sp.personaggi.length} personaggi · ${sp.location.length} set`)),
          h('div.row',
            h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`spoglio-${p.nome}`, 'csv'), csvSpoglio(sp), 'text/csv') }, 'Scarica spoglio (CSV)'),
            corsa ? h('span', h('span.spin'), h('span', { id: 'avanzamento-spoglio' }, ' Lettura…')) : h('button.btn.s', { type: 'button', disabled: !llm || !copioni.length, onclick: avvia }, 'Rifai lo spoglio'))),
        !sp.formattata && h('div.notice.warn', 'La sceneggiatura non ha intestazioni di scena standard (INT./EST.): le scene sono state individuate da Claude e le pagine sono stimate.'),
        h('div.muted.small', `Pagine misurate in ottavi, come nei piani di lavorazione. ${sp.modello ? `Lettura: ${sp.modello}.` : ''}`)),

      // ------- piano di lavorazione
      h('div.panel.stack',
        h('div.spread', h('h2', 'Piano di lavorazione'),
          h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`piano-lavorazione-${p.nome}`, 'csv'), csvPiano(sp, piano, terr), 'text/csv') }, 'Scarica piano (CSV)')),
        h('div.grid.w',
          h('label.field', { for: 'pagine-giorno' }, h('span', 'Pagine girate al giorno'),
            h('input', { id: 'pagine-giorno', type: 'number', min: '1', max: '12', step: '0.5', value: (prod.ottaviGiorno || 32) / 8, onchange: (e) => { prod.ottaviGiorno = Math.max(8, Math.round((Number(e.target.value) || 4) * 8)); salvaPresto(); disegna(); } })),
          h('div', h('div.label', 'Giorni di riprese'), h('div.num', { style: { fontSize: '1.5rem', fontWeight: 600 } }, String(piano.totale))),
          h('div', h('div.label', `Di cui in ${terr}`), h('div.num', { style: { fontSize: '1.5rem', fontWeight: 600 } }, String(piano.inSicilia), piano.daDefinire ? h('span.muted.small', ` + ${piano.daDefinire} da definire`) : null))),
        piano.daDefinire ? h('div.notice.warn', `Per ${piano.daDefinire} ${piano.daDefinire === 1 ? 'giornata' : 'giornate'} non è indicato se il set è in ${terr}: completalo nell’elenco dei set qui sotto.`) : null,
        h(`div.notice.${allineato ? 'ok' : 'info'}`,
          allineato ? `I Dati chiave riportano già ${piano.totale} giorni di riprese, ${piano.inSicilia} in ${terr}.`
            : h('span', `Nei Dati chiave risultano ${g.ripreseTot ?? '—'} giorni di riprese, ${g.ripreseSicilia ?? '—'} in ${terr}; da questo piano ne risultano ${piano.totale}, ${piano.inSicilia} in ${terr}. `,
              piano.daDefinire ? 'Completa i set da definire per poterli riportare nei Dati chiave.'
                : bottoneConferma('Usa quelli del piano', 'Conferma: sostituisci nei Dati chiave', () => { g.ripreseTot = piano.totale; g.ripreseSicilia = piano.inSicilia; salva(p).then(() => { toast('Giorni di riprese riportati nei Dati chiave'); disegna(); }); }, 'btn.s'))),
        h('div.tablewrap', h('table',
          h('thead', h('tr', h('th', 'Giorno'), h('th', 'Turno'), h('th', 'Set'), h('th', 'Scene'), h('th.r', 'Pagine'), h('th', `In ${terr}`))),
          h('tbody', piano.giorni.map((d) => h('tr',
            h('td.num', String(d.n)), h('td.small', d.turno === 'NOTTE' ? 'Notte' : 'Giorno'), h('td', d.set.join(' / ')), h('td.num.small', d.scene.join(', ')), h('td.r.num', pagine(d.ottavi)),
            h('td', h(`span.tag.${d.sicilia === true ? 'ok' : d.sicilia === false ? 'x' : 'warn'}`, d.sicilia === true ? 'Sì' : d.sicilia === false ? 'No' : d.sicilia === 'misto' ? 'In parte' : 'Da definire'))))))),
        h('p.muted.small', 'Bozza automatica: le scene sono raggruppate per set e per giorno/notte e distribuite fino alla quantità di pagine indicata. Va rifinita con disponibilità degli attori, spostamenti e meteo.')),

      // ------- set
      h('div.panel.stack',
        h('h2', 'Set'),
        h('p.muted.small', `Indica quali set si girano in ${terr}: da qui dipendono i giorni di lavorazione sul territorio (criterio 4.1).`),
        h('div.tablewrap', h('table',
          h('thead', h('tr', h('th', 'Set'), h('th', 'Luogo'), h('th.r', 'Scene'), h('th.r', 'Pagine'), h('th', `Si gira in ${terr}`))),
          h('tbody', sp.location.map((l, i) => h('tr',
            h('td', h('div', { style: { fontWeight: 500 } }, l.nome), h('div.muted.small', l.intEst)),
            h('td.small', l.luogo || '—'), h('td.r.num', String(l.scene.length)), h('td.r.num', pagine(l.ottavi)),
            h('td', { style: { minWidth: '130px' } }, scelta(null, STATO_SICILIA, aStato(l.sicilia), (v) => { l.sicilia = daStato(v); salvaPresto(); disegna(); }, { id: `set-${i}` })))))))),

      // ------- scene
      h('div.panel.stack',
        h('h2', 'Scene'),
        h('div', sp.scene.map((s) => h('details.crit',
          h('summary', h('span.id', s.numero), h('span.nm', `${s.intEst}. ${s.ambiente}`, h('span.muted', { style: { fontWeight: 400 } }, ` — ${s.luce}`)), h('span.pt', pagine(s.ottavi))),
          h('div.body',
            s.sinossi && h('p', s.sinossi),
            s.personaggi.length ? h('div.small', h('strong', 'Personaggi: '), s.personaggi.join(', ')) : null,
            s.comparse ? h('div.small', h('strong', 'Comparse: '), s.comparse) : null,
            CATEGORIE_ELEMENTI.filter(([k]) => s.elementi[k]?.length).map(([k, nome]) => h('div.small', h('strong', `${nome}: `), s.elementi[k].join(', '))),
            s.rischi.length ? h('div.notice.warn', h('strong', 'Da preparare: '), s.rischi.join('; ')) : null))))),

      // ------- personaggi e DOOD
      h('div.panel.stack',
        h('h2', 'Personaggi e giornate (DOOD)'),
        h('div.tablewrap', h('table',
          h('thead', h('tr', h('th', 'Personaggio'), h('th.r', 'Scene'), h('th.r', 'Giorni di lavoro'), h('th.r', 'Primo'), h('th.r', 'Ultimo'), h('th.r', 'Giorni di attesa'))),
          h('tbody', giornate.map((x) => h('tr', h('td', { style: { fontWeight: 500 } }, x.nome), h('td.r.num', String(x.scene)), h('td.r.num', String(x.lavoro)), h('td.r.num', x.primo ?? '—'), h('td.r.num', x.ultimo ?? '—'), h('td.r.num', String(x.attesa))))))),
        h('p.muted.small', 'Giorni di attesa: giornate tra il primo e l’ultimo giorno di lavoro in cui il personaggio non gira. Molti giorni di attesa per un interprete principale sono un costo: conviene riordinare il piano.')),

      // ------- elementi per reparto
      h('div.panel.stack',
        h('h2', 'Fabbisogni per reparto'),
        CATEGORIE_ELEMENTI.filter(([k]) => reparti[k].length).map(([k, nome]) => h('details.more', h('summary', `${nome} (${reparti[k].length})`),
          h('ul', { style: { margin: 0, paddingLeft: '18px' } }, reparti[k].map((e) => h('li.small', e.voce, h('span.muted', ` — ${e.scene.length === 1 ? 'scena' : 'scene'} ${e.scene.join(', ')}`)))))),
        !CATEGORIE_ELEMENTI.some(([k]) => reparti[k].length) && h('div.muted.small', 'Nessun elemento particolare rilevato.')),

      // ------- rischi e VFX
      h('div.cols', { style: { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' } },
        h('div.panel.stack', h('h2', `Rischi e preparazione (${rischi.length})`),
          rischi.length ? h('ul.checklist', rischi.map((r) => h('li', h('span.ico.attenzione', { 'aria-hidden': 'true' }, '!'), h('div', h('div.t', `Scena ${r.numero} · ${r.ambiente}`), h('div.d', r.rischi.join('; '))))))
            : h('div.muted.small', 'Nessuna scena con rischi particolari.')),
        h('div.panel.stack', h('h2', `VFX (${vfx.length} scene)`),
          vfx.length ? h('ul.checklist', vfx.map((v) => h('li', h('span.ico', { 'aria-hidden': 'true' }, '◆'), h('div', h('div.t', `Scena ${v.numero} · ${v.ambiente}`, h('span.muted', { style: { fontWeight: 400 } }, ` — ${pagine(v.ottavi)} pag.`)), h('div.d', v.vfx.join('; '))))))
            : h('div.muted.small', 'Nessuna scena richiede effetti visivi digitali.'))),

      // ------- sinossi e soggetto per il Modulo II
      pannelloSinossi());
  }

  function pannelloSinossi() {
    const sin = prod.sinossi;
    const stato = h('div');
    const genera = async (btn) => {
      btn.disabled = true;
      metti(svuota(stato), h('div.notice', h('span.spin'), ' Claude sta scrivendo logline, soggetto e sinossi…'));
      try {
        prod.sinossi = await generaSinossi({ spoglio: prod.spoglio, titolo: p.dati.titolo, llm, opzioni: { modello: S.imp.modello } });
        await salva(p); disegna();
      } catch (e) { metti(svuota(stato), h('div.notice.bad', e.message)); btn.disabled = false; }
    };
    const blocco = (titolo, testo, limite) => h('div.stack-s',
      h('div.spread', h('h4', titolo), h('div.row', h(`span.small.num${limite && testo.length > limite ? '' : '.muted'}`, { style: limite && testo.length > limite ? { color: 'var(--bad)' } : {} }, `${testo.length}${limite ? ` / ${limite}` : ''} battute`), h('button.btn.s', { type: 'button', onclick: () => copiaTesto(testo) }, 'Copia'))),
      h('p', { style: { whiteSpace: 'pre-wrap', maxWidth: '80ch' } }, testo));
    return h('div.panel.stack',
      h('div.spread', h('div', h('h2', 'Sinossi e soggetto'), h('p.muted.small', 'Il Modulo II chiede il soggetto dell’opera in non più di 900 battute.')),
        h('button.btn.s', { type: 'button', disabled: !llm, onclick: (e) => genera(e.currentTarget) }, sin ? 'Riscrivi' : 'Scrivi con Claude')),
      stato,
      sin ? [blocco('Logline', sin.logline), blocco('Soggetto per il Modulo II', sin.soggetto, 900), blocco('Sinossi estesa', sin.sinossi)] : null);
  }

  disegna();
  void fmt; void mostra;
}
