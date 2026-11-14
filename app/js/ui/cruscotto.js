// Cruscotto del dossier: a che punto è l'invio, che cosa manca, che cosa fare adesso.
import { h, metti, svuota, fmt, dimensione, copiaTesto, segno } from './dom.js';
import { risultatoDi } from './app.js';
import { statoInvio } from '../core/invio.js';
import { previsioneStatistica, storicoFinanziamento, posizioneEsiti } from '../core/scoring.js';
import { quadrante } from './grafici.js';
import { scaricaReportPdf } from './pdf.js';

const NOMI_SCHEDA = { documenti: 'Documenti', dati: 'Dati chiave', valutazione: 'Valutazione', report: 'Report' };
const giorno = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const giorni = (n) => (n === 0 ? 'oggi' : n === 1 ? '1 giorno' : `${n} giorni`);

function titoloStato(st, ris) {
  if (st.semaforo === 'rosso') return [`Non inviare: ${st.critici} ${st.critici === 1 ? 'problema bloccante' : 'problemi bloccanti'}`, 'Finché restano, l’istanza rischia di essere irricevibile o di non superare le soglie.'];
  if (st.semaforo === 'verde') return ['Pronto per l’invio', `Documenti completi, requisiti confermati e punteggio stimato ${fmt(ris.totale)} sopra tutte le soglie.`];
  const cose = st.attenzioni + (st.daConfermare ? 1 : 0);
  if (!ris.completo) return ['In preparazione', cose ? `Nessun blocco, ${cose} ${cose === 1 ? 'cosa' : 'cose'} da sistemare e la stima del punteggio è ancora parziale.` : 'Nessun blocco finora: completa i passi per avere la stima definitiva.'];
  return [`Quasi pronto: ${cose} ${cose === 1 ? 'cosa' : 'cose'} da sistemare`, 'Nessun blocco, ma conviene chiudere i punti aperti prima di inviare.'];
}

function pannelloFinestra(st, p) {
  const f = st.finestra;
  if (!f) return h('div.box', h('div.label', `Finestra ${p.anno}`), h('div.muted.small', 'Date non disponibili per questo bando.'));
  const [classe, testo] = f.stato === 'aperta' ? [f.giorni <= 7 ? 'bad' : 'ok', f.giorni === 0 ? 'Chiude oggi' : `Aperta: chiude tra ${giorni(f.giorni)}`]
    : f.stato === 'futura' ? ['accent', `Apre tra ${giorni(f.giorni)}`] : ['x', `Chiusa da ${giorni(f.giorni)}`];
  return h('div.box',
    h('div.label', `Finestra ${f.anno}`),
    h('div', { style: { fontWeight: 600 } }, `${giorno(f.dal)} – ${giorno(f.al)}`),
    h('div', h(`span.tag.${classe}`, testo)),
    f.stato === 'chiusa' && h('div.muted.small', 'Scegli la finestra successiva nel menu “Finestra” qui sopra.'));
}

function pannelloPrevisione(prev, ris, bando, p) {
  const storico = storicoFinanziamento(bando, p.categoriaId);
  const rigaStorico = storico.length ? h('div.muted.small', 'Ultimo progetto finanziato: ', storico.map((x) => `${fmt(x.ultimoFinanziato)} nel ${x.anno}`).join(' · '), '. Primo in graduatoria: ', storico.map((x) => `${fmt(x.primo)} nel ${x.anno}`).join(' · '), '.') : null;
  if (!prev) return null;
  if (prev.completa) {
    const pos = ris.esito !== 'sotto_soglia' ? posizioneEsiti(bando, p.categoriaId, ris.totale) : null;
    return h('div.panel.stack',
      h('h2', 'Dove ti collocheresti'),
      pos ? h(`div.notice.${pos.finanziabile ? 'ok' : 'warn'}`, h('strong', `Con ${fmt(ris.totale)} punti saresti ${pos.posizione}° su ${pos.su} ammissibili nella graduatoria ${prev.anno}. `), pos.finanziabile ? `Sopra l’ultimo finanziato (${fmt(pos.ultimoFinanziato)}).` : `Sotto l’ultimo finanziato (${fmt(pos.ultimoFinanziato)}): ammissibile, ma con la stessa concorrenza senza contributo.`)
        : h('div.notice.bad', 'Con questi punteggi il dossier non entra in graduatoria: guarda nel report quali soglie non sono raggiunte.'),
      rigaStorico);
  }
  const { basso, atteso, alto } = prev.scenari;
  const scen = (nome, s, nota) => h('div.box', h('div.label', nome), h('div.num', { style: { fontSize: '1.6rem', fontWeight: 600, lineHeight: 1.1 } }, fmt(s.totale)),
    h('div', h(`span.tag.${s.ammissibile ? 'ok' : 'bad'}`, s.ammissibile ? 'Ammissibile' : s.sotto.length ? `Sotto il minimo: ${s.sotto.join(', ')}` : `Sotto ${prev.sogliaTotale}`)), h('div.muted.small', nota));
  const e = prev.empirica;
  return h('div.panel.stack',
    h('div', h('h2', 'Previsione prima della valutazione'),
      h('p.muted', { style: { maxWidth: '78ch', marginTop: '4px' } }, `Le sezioni ${prev.sezioniStimate.join(', ')} non sono ancora state lette da Claude. Qui sono completate con i punteggi che la Commissione ha realmente dato ai ${prev.valutati} progetti valutati nel ${prev.anno}; il resto viene dai tuoi numeri.`)),
    h('div.grid.w', scen('Scenario prudente', basso, 'un progetto su quattro ha preso meno'), scen('Scenario atteso', atteso, 'valore mediano della Commissione'), scen('Scenario favorevole', alto, 'un progetto su quattro ha preso di più')),
    h(`div.notice.${e.ammissibili === 0 ? 'bad' : e.finanziabili ? 'info' : 'warn'}`,
      h('strong', `Ammissibile in ${e.ammissibili} casi su ${e.casi}`), e.finanziabili != null ? `, sopra l’ultimo finanziato del ${prev.anno} (${fmt(prev.ultimoFinanziato)}) in ${e.finanziabili}. ` : '. ',
      e.sezioneCritica && e.sezioneCritica.casi > e.casi / 3 ? `Il punto debole è la sezione ${e.sezioneCritica.id}: resta sotto il minimo in ${e.sezioneCritica.casi} casi.` : ''),
    rigaStorico,
    h('p.muted.small', 'È una previsione statistica, utile per decidere dove lavorare: la valutazione di Claude sui tuoi documenti la sostituisce con una stima specifica.'));
}

function pannelloInvio(st, p) {
  const inv = st.invio;
  const totale = p.documenti.reduce((a, d) => a + (d.dimensione || 0), 0);
  const elenco = st.file.map((f) => `${f.file.length ? '[x]' : '[ ]'} ${f.nome}${f.file.length ? `: ${f.file.map((x) => x.nome).join(', ')}` : ''}`).join('\n');
  const copia = (testo, etichetta) => h('button.btn.s', { type: 'button', onclick: () => copiaTesto(testo, `${etichetta} copiato`) }, 'Copia');
  return h('div.panel.stack',
    h('div.spread', h('h2', 'Invio'), inv?.canale && h('span.tag.accent', `Via ${inv.canale}`)),
    inv ? h('div.stack-s',
      h('div.copyrow', h('div', h('div.label', 'Indirizzo'), h('div.num', { style: { overflowWrap: 'anywhere' } }, inv.indirizzo)), copia(inv.indirizzo, 'Indirizzo')),
      h('div.copyrow', h('div', h('div.label', 'Oggetto del messaggio'), h('div.small', { style: { overflowWrap: 'anywhere' } }, inv.oggetto)), copia(inv.oggetto, 'Oggetto')),
      inv.regole?.length ? h('ul.small', { style: { margin: '6px 0 0', paddingLeft: '18px' } }, inv.regole.map((r) => h('li', r))) : null)
      : h('div.muted.small', 'Modalità di invio non definite per questo bando: consulta l’avviso.'),
    h('div.spread', { style: { marginTop: '6px' } }, h('h3', 'File da allegare'), h('div.row', totale ? h('span.muted.small', `${p.documenti.length} file · ${dimensione(totale)}`) : null, h('button.btn.s', { type: 'button', onclick: () => copiaTesto(elenco, 'Elenco copiato') }, 'Copia elenco'))),
    h('ul.checklist', st.file.map((f) => h('li', segno(f.file.length ? 'ok' : !p.documenti.length ? 'da_verificare' : f.obbligo === 'sempre' || f.obbligo === 'green' || f.obbligo === 'se_dichiarato' ? 'critico' : 'attenzione'),
      h('div', h('div.t', f.nome), h('div.d', f.file.length ? f.file.map((x) => x.nome).join(' · ') : 'Non ancora caricato.'))))),
    totale > 25 * 1048576 ? h('div.notice.warn', `Gli allegati pesano ${dimensione(totale)}: molte caselle PEC non accettano messaggi oltre 30-50 MB. Verifica il limite della tua casella e riduci il peso dei PDF prima dell’invio, che deve essere unico.`) : null);
}

export function schedaCruscotto(corpo, p, bando, mostra) {
  const ris = risultatoDi(p);
  const st = statoInvio(bando, p, ris);
  const prev = previsioneStatistica(bando, p.categoriaId, ris);
  const [titolo, sotto] = titoloStato(st, ris);
  const problemi = h('div');
  let tutti = false;
  const disegnaProblemi = () => {
    const lista = tutti ? st.problemi : st.problemi.slice(0, 6);
    metti(svuota(problemi), st.problemi.length ? h('div.panel.stack',
      h('div.spread', h('h2', 'Da sistemare'), h('div.row', st.critici > 0 && h('span.tag.bad', `${st.critici} bloccanti`), st.attenzioni > 0 && h('span.tag.warn', `${st.attenzioni} da sistemare`))),
      h('ul.todo', lista.map((x) => h('li',
        segno(x.esito),
        h('div', h('div.t', x.titolo), h('div.d', x.dettaglio), x.origine && h('div.d', x.origine)),
        h('button.btn.s', { type: 'button', onclick: () => mostra(x.scheda) }, `Apri ${NOMI_SCHEDA[x.scheda] || 'scheda'} →`)))),
      st.problemi.length > 6 ? h('div', h('button.btn.s.ghost', { type: 'button', onclick: () => { tutti = !tutti; disegnaProblemi(); } }, tutti ? 'Mostra meno' : `Mostra tutti i ${st.problemi.length}`)) : null)
      : h('div.panel', !p.documenti.length
        ? h('div.notice', h('strong', 'Nessun problema nei numeri. '), 'I controlli su allegati, formati e coerenza con il Modulo III partono quando carichi i documenti.')
        : h('div.notice.ok', h('strong', 'Nessun problema rilevato dai controlli automatici. '), st.daConfermare ? `Restano ${st.daConfermare} requisiti da confermare a mano nei Dati chiave.` : 'Requisiti confermati.')));
  };

  metti(corpo, h('div.stack',
    h('div.panel', { id: 'cruscotto-stato' }, h('div.cruscotto',
      h('div.mini-dial', quadrante(ris)),
      h('div.stack-s',
        h('div.row', h(`span.semaforo.${st.semaforo}`, { 'aria-hidden': 'true' }), h('h2', { style: { fontSize: '1.45rem' } }, titolo)),
        h('p', { style: { maxWidth: '62ch' } }, sotto),
        st.prossimo && h('div.row', { style: { marginTop: '6px' } },
          h('button.btn.primary', { type: 'button', id: 'cruscotto-prossimo', onclick: () => mostra(st.prossimo.scheda) }, `${st.prossimo.testo} →`),
          ris.totale > 0 && h('button.btn', { type: 'button', onclick: () => mostra('report') }, 'Apri il report'),
          h('button.btn', { type: 'button', id: 'btn-pdf-cruscotto', onclick: (e) => scaricaReportPdf(p, bando, e.currentTarget) }, 'Report completo (PDF)'))),
      pannelloFinestra(st, p))),
    h('div.passi', st.passi.map((x, i) => h('button.passo', { type: 'button', dataset: { stato: x.stato }, onclick: () => mostra(x.id) },
      h('div.spread', h('span.label', `Passo ${i + 1}`), h(`span.tag.${x.stato === 'fatto' ? 'ok' : x.stato === 'attenzione' ? 'warn' : 'x'}`, x.stato === 'fatto' ? 'Fatto' : x.stato === 'attenzione' ? 'Da completare' : 'Da fare')),
      h('strong', x.titolo), h('span.muted.small', x.dettaglio)))),
    problemi,
    pannelloPrevisione(prev, ris, bando, p),
    pannelloInvio(st, p),
    h('div.panel.stack',
      h('h2', 'Strumenti del dossier'),
      h('div.grid.w',
        h('button.passo', { type: 'button', onclick: () => mostra('produzione') }, h('strong', 'Produzione'), h('span.muted.small', 'Spoglio della sceneggiatura, piano di lavorazione, storyboard, ordine del giorno, preventivo, adempimenti.')),
        h('button.passo', { type: 'button', onclick: () => mostra('legale') }, h('strong', 'Legale'), h('span.muted.small', 'Domande sul bando con gli articoli citati, analisi dei contratti, bozze di documenti, fascicolo e scadenze.'))))));
  disegnaProblemi();
}
