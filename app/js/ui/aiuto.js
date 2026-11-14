// Pannello Aiuto: guida rapida, novità della versione, crediti. Si apre dal pulsante «?» nella barra in alto.
import { h, metti, svuota, s, bottoneConferma, toast } from './dom.js';
import { S } from './app.js';
import { APP, NOVITA } from '../core/versione.js';

const GUIDA = [
  ['Come si usa, in quattro passi', [
    ['1 · Documenti', 'Trascina nel dossier i Moduli I, II e III, la sceneggiatura, i curriculum e gli accordi. Il Modulo III in Excel compila da solo i Dati chiave.'],
    ['2 · Dati chiave', 'Controlla giorni di lavorazione, cast e troupe, budget e piano finanziario: a destra vedi subito i punti che ne derivano e come salire di fascia.'],
    ['3 · Valutazione', 'Claude legge i documenti come farebbero i commissari e assegna i punteggi dei criteri qualitativi. Puoi scegliere uno, tre o cinque commissari.'],
    ['4 · Report', 'Punteggio per criterio con le motivazioni, problemi di ammissibilità, interventi ordinati per punti recuperabili e confronto con la graduatoria reale.'],
  ]],
  ['Il cruscotto', [
    ['Semaforo', 'Rosso: c’è almeno un problema che rende l’istanza irricevibile o sotto soglia. Giallo: nessun blocco, ma restano cose da sistemare. Verde: pronto per l’invio.'],
    ['Da sistemare', 'Ogni problema ha il pulsante che porta al punto in cui correggerlo. Prima i bloccanti, poi il resto.'],
    ['Previsione', 'Prima ancora della lettura di Claude, il dossier viene completato con i punteggi che la Commissione ha dato davvero ai progetti dell’ultima finestra: vedi in quanti casi saresti ammissibile.'],
  ]],
  ['Strumenti', [
    ['Produzione', 'Dalla sceneggiatura: spoglio scena per scena, piano di lavorazione, calendario, ordine del giorno, stralci, storyboard, preventivo sulle voci del Modulo III e adempimenti.'],
    ['Legale', 'Domande sul bando con gli articoli citati, analisi di contratti e deal memo, bozze di documenti, fascicolo con parti e date, scadenze dopo la concessione.'],
    ['Bandi', 'Il testo dell’avviso, le griglie e le graduatorie reali fanno parte del programma. Puoi aggiungere altri bandi da PDF e altra conoscenza (FAQ, casi reali).'],
  ]],
  ['Dati e riservatezza', [
    ['Dove stanno i dossier', 'Su questo dispositivo, nel browser. Non vengono caricati su nessun server del programma.'],
    ['Che cosa riceve Claude', 'Solo il testo necessario a ciascuna lettura. Il documento d’identità non viene mai inviato.'],
    ['Che valore ha la stima', 'È un controllo di qualità prima dell’invio: non anticipa né vincola il giudizio della Commissione.'],
  ]],
];

function logoGrande() {
  const tratto = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.6, 'stroke-linecap': 'round' };
  return s('svg', { viewBox: '0 0 24 24', width: 44, height: 44, 'aria-hidden': 'true', style: 'color:var(--accent)' },
    s('path', { d: 'M5.1 17.5A9 9 0 1 1 18.9 17.5', ...tratto }), s('path', { d: 'M12 12l4.2-4.6', ...tratto }), s('circle', { cx: 12, cy: 12, r: 1.9, fill: 'currentColor' }));
}

let aperto = null;
export function chiudiAiuto() { aperto?.remove(); aperto = null; document.removeEventListener('keydown', suTasto); }
function suTasto(e) { if (e.key === 'Escape') chiudiAiuto(); }

/** Apre il pannello. `azioni` = { tutorial(), suggerimenti() } fornite dall'app. */
export function apriAiuto(azioni = {}, scheda = 'guida') {
  chiudiAiuto();
  const corpo = h('div.stack');
  const server = S.ambiente.server;
  const collegamento = S.ambiente.ambiente === 'app' ? 'dentro l’app Claude' : server?.eseguibile ? 'programma installato su questo computer' : S.ambiente.ambiente === 'locale' ? 'server locale' : 'pagina autonoma';

  const VISTE = {
    guida: () => [
      h('div.row', h('button.btn.primary', { type: 'button', id: 'aiuto-tutorial', onclick: () => { chiudiAiuto(); azioni.tutorial?.(); } }, 'Rivedi la guida iniziale'),
        h('button.btn', { type: 'button', onclick: () => { azioni.suggerimenti?.(); toast('I suggerimenti delle schede torneranno a comparire'); } }, 'Riattiva i suggerimenti')),
      GUIDA.map(([titolo, voci]) => h('div', h('h3', { style: { marginBottom: '6px' } }, titolo), h('dl.guida', voci.map(([t, d]) => [h('dt', t), h('dd', d)])))),
    ],
    novita: () => NOVITA.map((n) => h('div', h('h3', { style: { marginBottom: '6px' } }, `Versione ${n.versione}`, h('span.muted.small', { style: { fontWeight: 400 } }, ` · ${new Date(`${n.data}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`)),
      h('ul', { style: { margin: 0, paddingLeft: '18px' } }, n.voci.map((v) => h('li', v))))),
    info: () => [
      h('div.crediti',
        logoGrande(),
        h('div', h('div', { style: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-.02em' } }, APP.nome, h('span.muted', { style: { fontWeight: 600, fontSize: '1rem' } }, ` ${APP.sottotitolo}`)),
          h('div.num', `Versione ${APP.versione}`, h('span.muted', ` · ${new Date(`${APP.rilascio}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`)))),
      h('p', { style: { maxWidth: '62ch' } }, APP.descrizione),
      h('dl.guida',
        h('dt', 'Creato da'), h('dd', h('strong', { id: 'crediti-autore' }, APP.autore), h('div.muted', APP.ruoloAutore), h('div', h('a', { href: APP.sito, target: '_blank', rel: 'noopener' }, APP.sito.replace(/^https?:\/\/(www\.)?/, '')))),
        h('dt', 'Intelligenza artificiale'), h('dd', `${APP.motore}: letture dei documenti, commissione simulata, spoglio, storyboard e area legale.`),
        h('dt', 'Conoscenza inclusa'), h('dd', S.bandi.filter((b) => b.predefinito).map((b) => h('div', h('strong', b.nomeBreve || b.nome), (b.fonti || []).map((f) => h('div.muted.small', f.nome))))),
        h('dt', 'Questa installazione'), h('dd', `${collegamento}${server?.versione ? ` · servizio ${server.versione}` : ''}`),
        h('dt', 'Librerie'), h('dd.muted.small', 'PDF.js (Mozilla), SheetJS, Mammoth: lettura di PDF, Excel e Word sul dispositivo. Caratteri Archivo e IBM Plex.')),
      h('p.muted.small', { style: { maxWidth: '62ch' } }, `© ${APP.rilascio.slice(0, 4)} ${APP.autore}. Le stime sono uno strumento di controllo qualità e non sostituiscono il giudizio della Commissione né il parere di un professionista.`),
      server?.eseguibile ? h('div', bottoneConferma('Chiudi Clockwise', 'Conferma: arresta il programma', async () => {
        try { await fetch('api/esci', { method: 'POST' }); } catch { /* il servizio si chiude mentre risponde */ }
        chiudiAiuto();
        metti(svuota(document.body), h('main.wrap', { style: { paddingTop: '18vh', textAlign: 'center' } }, h('h1', 'Clockwise è stato chiuso'), h('p.muted', { style: { marginTop: '8px' } }, 'Puoi chiudere questa scheda. Per riaprirlo usa l’icona Clockwise nel menu Start o sul desktop.')));
      }, 'btn.danger')) : null,
    ],
  };
  const linguette = h('div.subnav', { role: 'tablist' }, [['guida', 'Guida'], ['novita', 'Novità'], ['info', 'Informazioni e crediti']].map(([id, nome]) => h('button', { type: 'button', role: 'tab', dataset: { id }, onclick: () => mostra(id) }, nome)));
  const mostra = (id) => { for (const b of linguette.children) b.setAttribute('aria-selected', String(b.dataset.id === id)); metti(svuota(corpo), VISTE[id]()); corpo.scrollTop = 0; };

  aperto = h('div.velo', { onclick: (e) => { if (e.target === aperto) chiudiAiuto(); } },
    h('div.dialogo', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Aiuto' },
      h('div.spread', h('h2', 'Aiuto'), h('button.btn.s.ghost', { type: 'button', 'aria-label': 'Chiudi', onclick: chiudiAiuto }, '✕')),
      linguette, corpo));
  document.body.append(aperto);
  document.addEventListener('keydown', suTasto);
  mostra(scheda);
  aperto.querySelector('button')?.focus();
}
