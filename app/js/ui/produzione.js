// Scheda Produzione: spoglio della sceneggiatura e, da lì, piano e ordine del giorno, storyboard,
// preventivo e adempimenti. Ogni strumento ha la sua sezione, raggiungibile dalla barra in alto.
import { h, metti, svuota, toast, scelta, salvaFile, copiaTesto, nomeFilePulito } from './dom.js';
import { S, salva, salvaPresto, llmAttivo } from './app.js';
import { eseguiSpoglio, riepilogoSpoglio, elementiPerReparto, rischiPerScena, vfxPerScena, generaSinossi, pagine, csvSpoglio, CATEGORIE_ELEMENTI } from '../core/sceneggiatura.js';
import { sottoNavigazione } from './sezioni.js';
import { vistaPiano } from './piano.js';
import { vistaStoryboard } from './storyboard.js';
import { vistaPreventivo } from './preventivo.js';
import { vistaAdempimenti } from './adempimenti.js';
import { vistaGreenFilm } from './greenfilm.js';

const STATO_SICILIA = [{ id: 'si', nome: 'Sì' }, { id: 'no', nome: 'No' }, { id: '', nome: 'Da definire' }];
const aStato = (v) => (v === true ? 'si' : v === false ? 'no' : '');
const daStato = (v) => (v === 'si' ? true : v === 'no' ? false : null);

const SEZIONI = [
  ['spoglio', 'Spoglio', vistaSpoglio],
  ['piano', 'Piano e ordine del giorno', vistaPiano],
  ['storyboard', 'Storyboard', vistaStoryboard],
  ['preventivo', 'Preventivo', vistaPreventivo],
  ['adempimenti', 'Adempimenti', vistaAdempimenti],
  ['green', 'Green Film', vistaGreenFilm],
];

export function schedaProduzione(corpo, p, bando, mostra) {
  p.produzione = p.produzione || { ottaviGiorno: 32 };
  const contesto = {
    p, bando, mostra, prod: p.produzione, terr: bando.territorio || 'regione', llm: llmAttivo(),
    copioni: p.documenti.filter((d) => d.tipo === 'sceneggiatura' && d.testo).sort((a, b) => b.testo.length - a.testo.length),
  };
  const area = h('div.stack');
  const { barra, apri } = sottoNavigazione('produzione', SEZIONI, area, contesto);
  metti(corpo, barra, area);
  apri(S.sotto.produzione);
}

function vistaSpoglio(area, ctx, apri) {
  const { p, prod, terr, llm, copioni } = ctx;
  let corsa = null;

  async function avvia() {
    const documento = copioni[0];
    corsa = { controller: new AbortController() };
    disegna();
    try {
      const spoglio = await eseguiSpoglio({
        documento, titolo: p.dati.titolo, territorio: terr, llm, signal: corsa.controller.signal,
        opzioni: { modello: S.imp.modello, impegno: S.imp.impegno === 'high' ? 'medium' : S.imp.impegno },
        onEvento: (e) => { const el = area.querySelector('#avanzamento-spoglio'); if (el) el.textContent = `Lettura delle scene: ${e.fatto} di ${e.totale} parti`; },
      });
      Object.assign(spoglio, riepilogoSpoglio(spoglio.scene, prod.spoglio)); // conserva le scelte già fatte sui set
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
            h('p.muted', { style: { maxWidth: '72ch', marginTop: '4px' } }, 'Claude legge la sceneggiatura scena per scena e ne ricava personaggi, set, comparse, oggetti di scena, costumi, veicoli, stunt, effetti e VFX. Da lì Clockwise costruisce il piano di lavorazione, l’ordine del giorno, lo storyboard e l’elenco degli adempimenti, e calcola i giorni di riprese da riportare nel dossier.')),
          !copioni.length && h('div.notice.warn', h('strong', 'Manca la sceneggiatura. '), 'Caricala nella scheda Documenti (PDF con testo, DOCX, Final Draft o Fountain).'),
          copioni.length && !llm && h('div.notice.warn', h('strong', 'Claude non è collegato. '), h('a', { href: '#collegamento' }, 'Configura il collegamento'), ' per avviare lo spoglio.'),
          corsa ? h('div.row', h('span.spin'), h('span', { id: 'avanzamento-spoglio' }, 'Preparazione…'), h('button.btn.s.danger', { type: 'button', onclick: () => corsa.controller.abort() }, 'Interrompi'))
            : h('div', h('button.btn.primary', { type: 'button', id: 'btn-spoglio', disabled: !copioni.length || !llm, onclick: avvia }, 'Avvia lo spoglio'),
              copioni.length ? h('span.muted.small', ` «${copioni[0].nome}»${copioni[0].pagine ? ` · ${copioni[0].pagine} pagine` : ''}`) : null)));
      return;
    }
    const totOttavi = sp.scene.reduce((a, s) => a + s.ottavi, 0);
    const reparti = elementiPerReparto(sp), rischi = rischiPerScena(sp), vfx = vfxPerScena(sp);
    const daDefinire = sp.location.filter((l) => l.sicilia == null).length;

    metti(svuota(area),
      h('div.panel.stack',
        h('div.spread',
          h('div', h('div.label', `Spoglio di «${sp.file || 'sceneggiatura'}»`), h('h2', `${sp.scene.length} scene · ${pagine(totOttavi)} pagine · ${sp.personaggi.length} personaggi · ${sp.location.length} set`)),
          h('div.row',
            h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`spoglio-${p.nome}`, 'csv'), csvSpoglio(sp), 'text/csv') }, 'Scarica spoglio (CSV)'),
            corsa ? h('span', h('span.spin'), h('span', { id: 'avanzamento-spoglio' }, ' Lettura…')) : h('button.btn.s', { type: 'button', disabled: !llm || !copioni.length, onclick: avvia }, 'Rifai lo spoglio'))),
        !sp.formattata && h('div.notice.warn', 'La sceneggiatura non ha intestazioni di scena standard (INT./EST.): le scene sono state individuate da Claude e le pagine sono stimate.'),
        h('div.muted.small', `Pagine misurate in ottavi, come nei piani di lavorazione. ${sp.modello ? `Lettura: ${sp.modello}.` : ''}`),
        h('div.row',
          h('button.btn.s.primary', { type: 'button', onclick: () => apri('piano') }, 'Piano e ordine del giorno →'),
          h('button.btn.s', { type: 'button', onclick: () => apri('storyboard') }, 'Storyboard →'),
          h('button.btn.s', { type: 'button', onclick: () => apri('adempimenti') }, 'Adempimenti →'))),

      h('div.panel.stack',
        h('div.spread', h('h2', 'Set'), daDefinire ? h('span.tag.warn', `${daDefinire} da definire`) : h('span.tag.ok', 'Tutti definiti')),
        h('p.muted.small', `Indica quali set si girano in ${terr}: da qui dipendono i giorni di lavorazione sul territorio (criterio 4.1).`),
        h('div.tablewrap', h('table',
          h('thead', h('tr', h('th', 'Set'), h('th', 'Luogo'), h('th.r', 'Scene'), h('th.r', 'Pagine'), h('th', `Si gira in ${terr}`))),
          h('tbody', sp.location.map((l, i) => h('tr',
            h('td', h('div', { style: { fontWeight: 500 } }, l.nome), h('div.muted.small', l.intEst)),
            h('td.small', l.luogo || '—'), h('td.r.num', String(l.scene.length)), h('td.r.num', pagine(l.ottavi)),
            h('td', { style: { minWidth: '130px' } }, scelta(null, STATO_SICILIA, aStato(l.sicilia), (v) => { l.sicilia = daStato(v); salvaPresto(); disegna(); }, { id: `set-${i}` })))))))),

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

      h('div.panel.stack',
        h('h2', 'Fabbisogni per reparto'),
        CATEGORIE_ELEMENTI.filter(([k]) => reparti[k].length).map(([k, nome]) => h('details.more', h('summary', `${nome} (${reparti[k].length})`),
          h('ul', { style: { margin: 0, paddingLeft: '18px' } }, reparti[k].map((e) => h('li.small', e.voce, h('span.muted', ` — ${e.scene.length === 1 ? 'scena' : 'scene'} ${e.scene.join(', ')}`)))))),
        !CATEGORIE_ELEMENTI.some(([k]) => reparti[k].length) && h('div.muted.small', 'Nessun elemento particolare rilevato.')),

      h('div.cols', { style: { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' } },
        h('div.panel.stack', h('h2', `Rischi e preparazione (${rischi.length})`),
          rischi.length ? h('ul.checklist', rischi.map((r) => h('li', h('span.ico.attenzione', { 'aria-hidden': 'true' }, '!'), h('div', h('div.t', `Scena ${r.numero} · ${r.ambiente}`), h('div.d', r.rischi.join('; '))))))
            : h('div.muted.small', 'Nessuna scena con rischi particolari.')),
        h('div.panel.stack', h('h2', `VFX (${vfx.length} scene)`),
          vfx.length ? h('ul.checklist', vfx.map((v) => h('li', h('span.ico', { 'aria-hidden': 'true' }, '◆'), h('div', h('div.t', `Scena ${v.numero} · ${v.ambiente}`, h('span.muted', { style: { fontWeight: 400 } }, ` — ${pagine(v.ottavi)} pag.`)), h('div.d', v.vfx.join('; '))))))
            : h('div.muted.small', 'Nessuna scena richiede effetti visivi digitali.'))),

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
}
