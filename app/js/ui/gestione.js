// Scheda «Gestione bando»: ciò che serve dopo la concessione del contributo — tappe e scadenze, erogazione,
// registro delle spese, rendiconto, punteggio da mantenere a consuntivo — più il cronoprogramma.
// I dati stanno in p.gestione; la data di notifica del decreto è quella della scheda Legale (p.legale.dataDecreto).
import { h, metti, svuota, s, toast, fmt, euro, salvaFile, nomeFilePulito, bottoneConferma, elencoControlli, segno } from './dom.js';
import { S, salva, salvaPresto, risultatoDi } from './app.js';
import { sottoNavigazione } from './sezioni.js';
import { apriFoglio } from '../core/docs.js';
import { r1 } from '../core/scoring.js';
import {
  eData, oggiIso, dataEstesa, dataCorta, assicuraGestione, citaBando, statoTappe,
  STATI_QUOTA, quoteDaBando, quoteInUso, pianoErogazione, costoFideiussione, mesiFideiussione,
  VOCI_SPESA, MEZZI, PROBLEMI, FILTRI_STATO, nomeVoce, nomeMezzo, nuovaSpesa, problemiSpesa, eBloccante, filtraSpese, ordinaSpese,
  numeroItaliano, voceDaDescrizione, leggiCsv, importaSpese, senzaDoppioni, csvRegistro, csvMatrice,
  rendiconto, CAMPI_EFFETTIVI, criteriQuantitativi, campiDaConfermare, datiConsuntivo, punteggioDaMantenere,
  fasiCronoprogramma, impostaFase, proponiCronoprogramma, segniCronoprogramma, geometriaGantt, controlliCronoprogramma, csvCronoprogramma,
} from '../core/gestione.js';

const SEZIONI = [
  ['tappe', 'Tappe e scadenze', vistaTappe],
  ['erogazione', 'Erogazione', vistaErogazione],
  ['spese', 'Registro spese', vistaSpese],
  ['rendiconto', 'Rendiconto', vistaRendiconto],
  ['punteggio', 'Punteggio da mantenere', vistaPunteggio],
  ['crono', 'Cronoprogramma', vistaCrono],
];

export function schedaGestione(corpo, p, bando, mostra) {
  p.gestione = assicuraGestione(p.gestione);
  p.legale = p.legale || { domande: [], contratti: null, bozze: [], dataDecreto: '' };
  const contesto = { p, bando, mostra, g: p.gestione, leg: p.legale, terr: bando.territorio || 'regione' };
  const area = h('div.stack');
  const { barra, apri } = sottoNavigazione('gestione', SEZIONI, area, contesto);
  metti(corpo, barra, area,
    h('p.muted.small.gst-piede', 'Termini, quote e minimi vengono dal bando in uso; dove il programma non ha il dato lo dice e rimanda all’avviso. Fanno fede l’avviso, il decreto di concessione e le comunicazioni dell’ente.'));
  apri(S.sotto.gestione || 'tappe');
}

/* ------------------------------------------------------------------ strumenti comuni */

const SEMAFORO = { rosso: ['bad', 'Urgente'], giallo: ['warn', 'Attenzione'], verde: ['ok', 'In regola'], fatto: ['ok', 'Fatto'], grigio: ['x', 'Da pianificare'] };
const soldi = (n) => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const importoTesto = (n) => (n == null ? '' : Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const dataBreve = (d) => (eData(d) ? new Date(`${d}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const giorniTesto = (n) => (n === 1 ? '1 giorno' : `${fmt(n, 0)} giorni`);
const mesiTesto = (n) => (n === 1 ? '1 mese' : `${n} mesi`);
const pct = (n) => (n == null ? '—' : `${fmt(n)}%`);
const idSicuro = (v) => String(v).replace(/[^a-zA-Z0-9_-]/g, '-');
const intro = (titolo, testo) => h('div', h('h2', titolo), h('p.muted.gst-intro', testo));
const citazione = (c) => h('blockquote.gst-cit', h('p', `«${c.testo}»`), h('footer', c.fonte));

// Ridisegna una sezione senza far perdere il posto a chi usa la tastiera: il fuoco torna al controllo con lo stesso id.
function conFuoco(radice, disegna) {
  const attivo = document.activeElement;
  const id = attivo && radice.contains(attivo) ? attivo.id : '';
  disegna();
  if (id) document.getElementById(id)?.focus({ preventScroll: true });
}

function campoData(etichetta, valore, alCambio, { id, aiuto } = {}) {
  return h('label.field', { for: id }, h('span', etichetta),
    h('input', { id, type: 'date', min: '1990-01-01', max: '2100-12-31', value: eData(valore) ? valore : '', onchange: (e) => alCambio(eData(e.target.value) ? e.target.value : '') }),
    aiuto && h('span', aiuto));
}
function menu(opzioni, valore, alCambio, attrs = {}) {
  return h('select', { ...attrs, onchange: (e) => alCambio(e.target.value) }, opzioni.map((o) => h('option', { value: o.id, selected: String(o.id) === String(valore ?? '') }, o.nome)));
}
function spunta(etichetta, valore, alCambio, attrs = {}) {
  return h('label.check', { for: attrs.id }, h('input', { type: 'checkbox', checked: !!valore, ...attrs, onchange: (e) => alCambio(e.target.checked) }), h('span', etichetta));
}
// Campo per gli importi: accetta la scrittura italiana («1.234,56») e la rimette in ordine quando si esce dal campo.
function ingressoImporto(valore, alCambio, attrs = {}) {
  return h('input', {
    type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'num', value: importoTesto(valore), ...attrs,
    onchange: (e) => {
      const testo = e.target.value.trim();
      const n = testo === '' ? null : numeroItaliano(testo);
      if (testo !== '' && n == null) { e.target.setAttribute('aria-invalid', 'true'); toast('Importo non riconosciuto: scrivilo come 1.234,56'); return; }
      e.target.removeAttribute('aria-invalid');
      e.target.value = importoTesto(n);
      alCambio(n);
    },
  });
}
const campoImporto = (etichetta, valore, alCambio, attrs = {}, aiuto = null) => h('label.field', { for: attrs.id }, h('span', etichetta), ingressoImporto(valore, alCambio, attrs), aiuto && h('span', aiuto));
const riquadro = (etichetta, valore, nota, classe = '') => h(`div.box.gst-kpi${classe ? `.${classe}` : ''}`, h('div.label', etichetta), h('div.gst-kpi-v', valore), nota && h('div.muted.small', nota));

/** Barra di avanzamento con la tacca del minimo: valore e minimo sulla stessa scala. */
function misura({ etichetta, valore, minimo, pieno, testo, nota, esito }) {
  const scala = Math.max(pieno || 0, valore || 0, (minimo || 0) * 1.15, 1);
  const classe = esito === 'ok' ? 'ok' : esito === 'critico' ? 'bad' : esito === 'attenzione' ? '' : 'idle';
  return h('div.gst-misura',
    h('div.bar-h', h('span', etichetta), h('span.n', testo)),
    h('div.bar', { role: 'img', 'aria-label': `${etichetta}: ${testo}` },
      h(`i${classe ? `.${classe}` : ''}`, { style: { width: `${Math.min(100, ((valore || 0) / scala) * 100)}%` } }),
      minimo ? h('u', { style: { left: `${(minimo / scala) * 100}%` }, title: 'Minimo' }) : null),
    nota && h('div.muted.small', nota));
}

/* ------------------------------------------------------------------ tappe e scadenze */

function vistaTappe(area, ctx) {
  const { p, bando, g, leg } = ctx;
  const cambia = () => { salvaPresto(); conFuoco(area, disegna); };

  function termine(t, mia) {
    if (t.id === 'concessione') return null;
    if (t.origine === 'bando') {
      const massimo = Math.max(t.prorogaMax ?? 12, t.prorogaMesi);
      const opzioni = [{ id: 0, nome: 'Nessuna' }, ...Array.from({ length: massimo }, (_, i) => ({ id: i + 1, nome: mesiTesto(i + 1) }))];
      const id = `gst-proroga-${idSicuro(t.id)}`;
      return h('div.gst-termine',
        h('div.label', 'Termine del bando'),
        h('div.gst-termine-data', t.termine ? dataEstesa(t.termine) : `${t.mesi} mesi dalla notifica del decreto`),
        t.termine && h('div.muted.small', `${t.mesi} mesi dalla notifica${t.prorogaMesi ? `, più ${mesiTesto(t.prorogaMesi)} di proroga` : ''}.`),
        h('label.field', { for: id }, h('span', 'Proroga concessa'), menu(opzioni, t.prorogaMesi, (v) => { g.proroghe[t.scadenzaId] = Number(v); cambia(); }, { id })),
        t.limiteProroga && !t.prorogaMesi && h('div.muted.small', `Va chiesta entro il ${dataEstesa(t.limiteProroga)}${t.prorogaMax ? `, per non più di ${mesiTesto(t.prorogaMax)}` : ''}.`));
    }
    if (t.origine === 'finestra') return h('div.gst-termine', h('div.label', 'Chiusura della finestra'), h('div.gst-termine-data', dataEstesa(t.termine)), h('div.muted.small', t.nota));
    return h('div.gst-termine', campoData('Termine, se l’avviso o il decreto lo fissa', mia.termine, (v) => { mia.termine = v; cambia(); }, { id: `gst-termine-${t.id}` }));
  }

  function tappa(t, i) {
    const mia = g.tappe[t.id];
    const [classe, etichetta] = SEMAFORO[t.semaforo];
    const stato = t.id === 'concessione' && !t.data ? 'In attesa' : etichetta;
    return h('li.gst-tappa', { dataset: { semaforo: t.semaforo } },
      h('span.gst-pallino', { 'aria-hidden': 'true' }, t.fatta ? '✓' : String(i + 1)),
      h('div.gst-tappa-corpo',
        h('div.gst-tappa-testa', h('h3', t.nome), h(`span.tag.${classe}`, stato)),
        h('p.small', { class: t.semaforo === 'rosso' ? 'gst-rosso' : 'muted' }, t.messaggio || t.guida),
        h('div.gst-tappa-campi',
          t.id === 'concessione'
            ? h('div.gst-termine', campoData('Data di notifica del decreto', leg.dataDecreto, (v) => { leg.dataDecreto = v; cambia(); }, { id: 'gst-decreto', aiuto: 'È la stessa data della scheda Legale › Scadenze.' }))
            : h('div.gst-termine',
              campoData(t.fatta ? 'Data' : 'Data prevista', mia.data, (v) => { mia.data = v; cambia(); }, { id: `gst-data-${t.id}` }),
              spunta(t.implicita ? 'Fatta: c’è già il decreto' : 'Fatto', t.fatta, (v) => { mia.fatta = v; cambia(); }, { id: `gst-fatta-${t.id}`, disabled: !!t.implicita })),
          termine(t, mia)),
        t.origine === 'bando' && t.nota ? h('details.more.small', h('summary', 'Che cosa dice il bando'), h('p.gst-intro', h('strong', `${t.etichettaBando}. `), t.nota)) : null));
  }

  function altra(x) {
    const [classe, etichetta] = SEMAFORO[x.semaforo];
    if (x.origine === 'bando') {
      const chiave = x.id;
      return h('li.gst-libera',
        h('div.gst-libera-testo', h('strong', x.nome), h('div.muted.small', x.termine ? `${dataEstesa(x.termine)} · ${x.messaggio}` : x.messaggio), x.nota && h('div.muted.small', x.nota)),
        h(`span.tag.${classe}`, etichetta),
        spunta('Fatto', x.fatta, (v) => { g.tappe[chiave] = { fatta: v }; cambia(); }, { id: `gst-fatta-${idSicuro(chiave)}` }));
    }
    const mia = g.scadenzeLibere.find((y) => y.id === x.id);
    return h('li.gst-libera.gst-libera-mia',
      h('label.field', { for: `gst-lib-n-${x.id}` }, h('span', 'Scadenza'), h('input', { id: `gst-lib-n-${x.id}`, type: 'text', value: mia.etichetta || '', placeholder: 'Per esempio: rinnovo della polizza', oninput: (e) => { mia.etichetta = e.target.value; salvaPresto(); } })),
      campoData('Entro il', mia.data, (v) => { mia.data = v; cambia(); }, { id: `gst-lib-d-${x.id}` }),
      h('div.gst-libera-stato', h(`span.tag.${classe}`, x.semaforo === 'grigio' ? 'Senza data' : etichetta), x.termine && !x.fatta ? h('span.muted.small', x.messaggio) : null),
      spunta('Fatto', mia.fatta, (v) => { mia.fatta = v; cambia(); }, { id: `gst-lib-f-${x.id}` }),
      h('button.btn.s.ghost', { type: 'button', 'aria-label': `Elimina la scadenza ${mia.etichetta || ''}`, onclick: () => { g.scadenzeLibere = g.scadenzeLibere.filter((y) => y !== mia); cambia(); } }, '✕'));
  }

  function disegna() {
    const st = statoTappe({ bando, anno: p.anno, gestione: g, dataDecreto: leg.dataDecreto, oggi: oggiIso() });
    const a = st.adesso;
    const proroga = bando.scadenze?.length ? citaBando(bando, 'proroga', 3).filter((c) => /Art\./.test(c.fonte)) : [];
    metti(svuota(area),
      h('div.panel.gst-adesso', { id: 'gst-adesso', dataset: { semaforo: a.semaforo } },
        h('div.stack-s',
          h('div.row', h(`span.semaforo${a.semaforo === 'grigio' ? '' : `.${a.semaforo}`}`, { 'aria-hidden': 'true' }), h('span.label', 'Che cosa fare adesso')),
          h('h2', a.titolo),
          h('p.gst-intro', a.dettaglio)),
        a.giorni != null && h('div.gst-conto',
          h('div.gst-conto-n', a.giorni < 0 ? `−${fmt(-a.giorni, 0)}` : fmt(a.giorni, 0)),
          h('div.small', a.giorni < 0 ? (a.giorni === -1 ? 'giorno di ritardo' : 'giorni di ritardo') : a.giorni === 1 ? 'giorno' : 'giorni'),
          h('div.muted.small', `${a.riferimento} · ${dataBreve(a.termine)}`))),

      h('div.panel.stack',
        intro('Dalla domanda all’uscita', bando.scadenze?.length
          ? 'I termini del bando decorrono dalla notifica del decreto di concessione. Per ogni tappa indica la data prevista e spuntala quando è fatta: il semaforo dice a che punto sei.'
          : 'Il bando in uso non ha termini calcolabili nel programma: per ogni tappa puoi indicare la data prevista e, se l’avviso o il decreto ne fissano uno, il termine.'),
        h('ol.gst-tappe', st.tappe.map(tappa))),

      h('div.panel.stack',
        h('div.spread', h('h2', 'Altre scadenze'),
          h('button.btn.s', { type: 'button', id: 'gst-nuova-scadenza', onclick: () => { g.scadenzeLibere.push({ id: `l${Date.now().toString(36)}`, etichetta: '', data: '', fatta: false, nota: '' }); salvaPresto(); disegna(); document.getElementById(`gst-lib-n-${g.scadenzeLibere.at(-1).id}`)?.focus(); } }, '+ Aggiungi scadenza')),
        st.altre.length ? h('ul.gst-libere', st.altre.map(altra)) : h('p.muted.small', 'Scadenze tue da tenere d’occhio: polizze, opzioni sui diritti, consegne, comunicazioni all’ente.'),
        st.note.length ? h('div.stack-s', h('div.label', 'Dal bando'), h('ul.gst-note', st.note.map((n) => h('li.small', n)))) : null,
        proroga.length ? h('details.more.small', h('summary', 'Proroghe: che cosa dice l’avviso'), h('div.stack-s', proroga.map(citazione))) : null));
  }
  disegna();
}

/* ------------------------------------------------------------------ erogazione */

function vistaErogazione(area, ctx) {
  const { p, bando, g } = ctx;
  const ero = g.erogazione;
  const cambia = () => { salvaPresto(); conFuoco(area, disegna); };
  const stato = (id) => (ero.stati[id] = ero.stati[id] || {});

  function quota(r, i, manuale) {
    const st = stato(r.id);
    const idr = `gst-q-${idSicuro(r.id)}`;
    return h('tr', { class: r.attiva ? '' : 'gst-spenta' },
      h('td.gst-q-nome', { dataset: { et: 'Quota' } },
        manuale ? h('div.stack-s',
          h('input', { id: `${idr}-nome`, type: 'text', value: r.nome, 'aria-label': `Nome della quota ${i + 1}`, oninput: (e) => { ero.quote[i].nome = e.target.value; salvaPresto(); } }),
          spunta('Richiede una fideiussione', r.garanzia, (v) => { ero.quote[i].garanzia = v; cambia(); }, { id: `${idr}-gar` }))
          : [h('strong', r.nome), r.condizione && h('div.muted.small', r.condizione)],
        !r.attiva && h('div.small.gst-rosso', 'Senza fideiussione non si può chiedere: la sua parte passa alla quota successiva.')),
      h('td.r.num', { dataset: { et: 'Quota %' } },
        manuale ? h('input.gst-stretto', { id: `${idr}-pct`, type: 'number', min: '0', max: '100', step: 'any', value: r.percentuale, 'aria-label': `Percentuale della quota ${r.nome}`, onchange: (e) => { ero.quote[i].percentuale = Math.max(0, Math.min(100, Number(e.target.value) || 0)); cambia(); } })
          : [pct(r.percentualeEffettiva), r.attiva && r.percentualeEffettiva !== r.percentuale ? h('div.muted.small', `era ${pct(r.percentuale)}`) : null]),
      h('td.r.num', { dataset: { et: 'Importo' } }, r.importo == null ? '—' : soldi(r.importo)),
      h('td', { dataset: { et: 'Stato' } }, menu(STATI_QUOTA, r.stato, (v) => { st.stato = v; cambia(); }, { id: `${idr}-stato`, 'aria-label': `Stato della quota ${r.nome}`, disabled: !r.attiva })),
      h('td.gst-q-data', { dataset: { et: r.stato === 'incassata' ? 'Incassata il' : 'Chiesta il' } },
        r.stato === 'da_chiedere' ? h('span.muted', '—')
          : r.stato === 'chiesta' ? h('input', { id: `${idr}-chiesta`, type: 'date', value: r.chiestaIl, 'aria-label': `Data della richiesta della quota ${r.nome}`, onchange: (e) => { st.chiestaIl = e.target.value; cambia(); } })
            : h('div.stack-s',
              h('input', { id: `${idr}-incassata`, type: 'date', value: r.incassataIl, 'aria-label': `Data di incasso della quota ${r.nome}`, onchange: (e) => { st.incassataIl = e.target.value; cambia(); } }),
              ingressoImporto(st.incassato ?? null, (n) => { st.incassato = n; cambia(); }, { id: `${idr}-importo`, placeholder: importoTesto(r.importo), 'aria-label': `Importo incassato della quota ${r.nome}, se diverso dal previsto` }))),
      manuale ? h('td.r', h('button.btn.s.ghost', { type: 'button', 'aria-label': `Elimina la quota ${r.nome}`, onclick: () => { ero.quote.splice(i, 1); cambia(); } }, '✕')) : null);
  }

  function disegna() {
    const quote = quoteInUso(bando, g);
    const manuale = ero.personalizzate;
    const fid = ero.fideiussione;
    const piano = pianoErogazione({ quote, contributo: g.contributoConcesso, fideiussione: fid.attiva, stati: ero.stati });
    const richiesto = p.dati.economici?.contributoRichiesto;
    const delBando = quoteDaBando(bando);
    const conGaranzia = quote.filter((q) => q.garanzia);
    const garantito = piano.righe.filter((r) => r.garanzia && r.attiva).reduce((a, r) => a + (r.importo || 0), 0);
    const mesi = fid.mesi ?? mesiFideiussione(bando);
    const stimato = costoFideiussione({ importo: garantito, tasso: fid.tasso, mesi });
    const incassatoPct = piano.contributo ? Math.max(0, Math.min(100, (piano.incassato / piano.contributo) * 100)) : 0;

    metti(svuota(area),
      h('div.panel.stack',
        intro('Erogazione del contributo', 'Gli importi si calcolano sul contributo concesso, che può essere più basso di quello richiesto: è quello scritto nel decreto di concessione.'),
        h('div.grid.w',
          campoImporto('Contributo concesso €', g.contributoConcesso, (n) => { g.contributoConcesso = n; cambia(); }, { id: 'gst-concesso', placeholder: 'dal decreto di concessione' },
            richiesto != null ? `Richiesto nel dossier: ${euro(richiesto)}.` : null),
          h('label.field', { for: 'gst-cup' }, h('span', 'CUP del progetto'), h('input', { id: 'gst-cup', type: 'text', value: g.cup || '', maxlength: '20', placeholder: 'dal decreto di concessione', oninput: (e) => { g.cup = e.target.value.trim().toUpperCase(); salvaPresto(); } }), h('span', 'Va riportato sui documenti di spesa e sulla rendicontazione.'))),
        g.contributoConcesso == null && richiesto != null ? h('div', h('button.btn.s', { type: 'button', id: 'gst-usa-richiesto', onclick: () => { g.contributoConcesso = richiesto; cambia(); } }, `Usa il contributo richiesto (${euro(richiesto)})`)) : null,
        piano.contributo != null && quote.length ? h('div.stack-s',
          h('div.grid.gst-kpi-griglia',
            riquadro('Previsto', soldi(piano.previsto), `${pct(piano.totalePct)} del concesso`),
            riquadro('Incassato', soldi(piano.incassato), `${pct(incassatoPct)} del concesso`, piano.incassato > 0 ? 'gst-ok' : ''),
            riquadro('Chiesto, in attesa', soldi(piano.chiesto)),
            riquadro('Residuo da incassare', soldi(piano.residuo))),
          h('div.bar', { role: 'img', 'aria-label': `Incassato il ${pct(incassatoPct)} del contributo concesso` }, h('i.ok', { style: { width: `${incassatoPct}%` } }))) : null),

      h('div.panel.stack',
        h('div.spread',
          h('div.row', h('h2', 'Quote'), quote.length ? h(`span.tag${manuale ? '' : '.accent'}`, manuale ? 'Definite a mano' : 'Dal bando') : null),
          quote.length ? (manuale
            ? (delBando.length ? bottoneConferma('Ripristina le quote del bando', 'Conferma: scarta le quote a mano', () => { ero.personalizzate = false; ero.quote = []; cambia(); }, 'btn.s.ghost') : null)
            : h('button.btn.s', { type: 'button', id: 'gst-personalizza', onclick: () => { ero.personalizzate = true; ero.quote = delBando.map((q) => ({ ...q })); cambia(); } }, 'Modifica le quote')) : null),
        !quote.length ? h('div.panel.flat.empty', h('strong', 'Quote non definite'), 'Il bando in uso non riporta nel programma le quote di erogazione. Definiscile come le indica il tuo avviso o il decreto di concessione.',
          h('div.gst-su', h('button.btn.primary', { type: 'button', id: 'gst-definisci', onclick: () => { ero.personalizzate = true; ero.quote = [{ id: 'm1', nome: 'Saldo', percentuale: 100, condizione: '', garanzia: false }]; cambia(); } }, 'Definisci le quote')))
          : h('div.tablewrap.gst-schede', h('table',
            h('thead', h('tr', h('th', 'Quota'), h('th.r', '%'), h('th.r', 'Importo'), h('th', 'Stato'), h('th', 'Data e incasso'), manuale ? h('th', '') : null)),
            h('tbody', piano.righe.map((r, i) => quota(r, i, manuale))))),
        manuale ? h('div', h('button.btn.s', { type: 'button', id: 'gst-nuova-quota', onclick: () => { ero.quote.push({ id: `m${Date.now().toString(36)}`, nome: 'Nuova quota', percentuale: 0, condizione: '', garanzia: false }); cambia(); } }, '+ Aggiungi quota')) : null,
        piano.avvisi.map((a) => h('div.notice.warn', a))),

      quote.length ? h('div.panel.stack',
        intro('Fideiussione', conGaranzia.length
          ? `${conGaranzia.map((q) => q.nome).join(', ')}: si può chiedere solo con una garanzia fideiussoria. Senza, la sua parte arriva con la quota successiva.`
          : 'Nessuna quota richiede una garanzia. Se l’ente ne chiede una, segna la quota come «Richiede una fideiussione» modificando le quote.'),
        conGaranzia.length ? [
          h('fieldset.gst-scelta', h('legend', 'Chiedi la quota con la fideiussione?'),
            h('label.check', { for: 'gst-fid-si' }, h('input', { id: 'gst-fid-si', type: 'radio', name: 'gst-fid', checked: fid.attiva, onchange: () => { fid.attiva = true; cambia(); } }), h('span', 'Sì')),
            h('label.check', { for: 'gst-fid-no' }, h('input', { id: 'gst-fid-no', type: 'radio', name: 'gst-fid', checked: !fid.attiva, onchange: () => { fid.attiva = false; cambia(); } }), h('span', 'No'))),
          fid.attiva ? h('div.stack-s',
            h('div.grid.w',
              h('div.field', h('span', 'Importo da garantire'), h('div.gst-kpi-v', g.contributoConcesso == null ? '—' : soldi(garantito)), h('span', 'La quota anticipata; l’avviso può chiedere di coprire anche interessi e spese.')),
              h('label.field', { for: 'gst-fid-tasso' }, h('span', 'Costo annuo %'), h('input', { id: 'gst-fid-tasso', type: 'number', min: '0', max: '20', step: '0.05', value: fid.tasso ?? '', onchange: (e) => { fid.tasso = e.target.value === '' ? null : Number(e.target.value); cambia(); } })),
              h('label.field', { for: 'gst-fid-mesi' }, h('span', 'Durata in mesi'), h('input', { id: 'gst-fid-mesi', type: 'number', min: '1', max: '120', step: '1', value: mesi, onchange: (e) => { fid.mesi = e.target.value === '' ? null : Number(e.target.value); cambia(); } })),
              campoImporto('Costo da preventivo €', fid.costo, (n) => { fid.costo = n; cambia(); }, { id: 'gst-fid-costo', placeholder: 'se lo hai già' })),
            h('div.notice', h('strong', `Costo ${fid.costo != null ? 'da preventivo' : 'stimato'}: ${soldi(fid.costo ?? stimato)}. `),
              fid.costo != null ? 'È l’importo che hai inserito.' : stimato == null ? 'Inserisci il contributo concesso per la stima.' : `${soldi(garantito)} × ${fmt(fid.tasso, 2)}% l’anno × ${mesiTesto(mesi)}. Il tasso è un’ipotesi, non un dato ufficiale: sostituiscilo con il preventivo della banca o della compagnia.`,
              ' Nel budget rientra tra gli oneri assicurativi, finanziari e di garanzia (voce A.7).')) : null,
        ] : null) : null);
  }
  disegna();
}

/* ------------------------------------------------------------------ registro delle spese */

const COLONNE_ORDINE = [{ id: 'data', nome: 'Data' }, { id: 'fornitore', nome: 'Fornitore' }, { id: 'voce', nome: 'Voce' }, { id: 'imponibile', nome: 'Imponibile' }, { id: 'pagataIl', nome: 'Pagamento' }];
const OPZIONI_VOCE = VOCI_SPESA.map((v) => ({ id: v.id, nome: `${v.id} ${v.nome}` }));

// IVA scritta come importo («220,00») o come aliquota («22%»): restituisce { iva, aliquota } oppure null se non si capisce.
function leggiIva(testo, imponibile) {
  const t = String(testo ?? '').trim();
  if (!t) return { iva: null, aliquota: null };
  if (/%$/.test(t)) { const a = numeroItaliano(t.slice(0, -1)); return a == null ? null : { aliquota: a, iva: imponibile == null ? null : Math.round(imponibile * a) / 100 }; }
  const n = numeroItaliano(t);
  return n == null ? null : { iva: n, aliquota: null };
}

async function tabelleDaFile(file) {
  const nome = file.name.toLowerCase();
  if (/\.(csv|txt|tsv)$/.test(nome)) {
    const byte = new Uint8Array(await file.arrayBuffer());
    let testo;
    try { testo = new TextDecoder('utf-8', { fatal: true }).decode(byte); } catch { testo = new TextDecoder('windows-1252').decode(byte); } // i CSV salvati da Excel in Italia sono spesso in Windows-1252
    return [leggiCsv(testo)];
  }
  const wb = await apriFoglio(file);
  return wb.SheetNames.map((n) => globalThis.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }));
}

function vistaSpese(area, ctx) {
  const { p, bando, g, leg, terr } = ctx;
  const vista = { testo: '', voce: '', stato: '', ordine: 'data', verso: 'desc', modifica: null, limite: 100 };
  const riepilogo = h('div.stack-s'), anteprima = h('div'), rapida = h('div'), filtri = h('div'), tabella = h('div.stack-s'), opzioni = h('div.stack-s');
  let bozza = { data: '', fornitore: '', descrizione: '', voce: '', imponibile: null, iva: null, aliquota: null, territorio: true, ammissibile: true, pagataIl: '', mezzo: '', documento: '', note: '' };
  const contesto = () => ({ periodo: g.periodo });
  const titolo = () => p.dati.titolo || p.nome;

  /* modulo di una spesa: lo stesso per l'inserimento rapido e per la modifica in riga */
  function modulo(v, pre, alCambio, { conAliquota = false } = {}) {
    const id = (k) => `${pre}-${k}`;
    const testo = (k, etichetta, extra = {}) => h(`label.field${extra.largo ? '.gst-largo' : ''}`, { for: id(k) }, h('span', etichetta),
      h('input', { id: id(k), type: 'text', value: v[k] || '', autocomplete: 'off', list: extra.lista, placeholder: extra.placeholder, oninput: (e) => { v[k] = e.target.value; alCambio(k); } }));
    const ivaTesto = () => (conAliquota && v.aliquota != null ? `${fmt(v.aliquota, 2)}%` : importoTesto(v.iva));
    // con un'aliquota scritta nel campo, l'importo calcolato compare qui sotto
    const calcolata = h('span', { id: id('iva-calcolata'), 'aria-live': 'polite' });
    const mostraCalcolata = () => { calcolata.textContent = conAliquota && v.aliquota != null && v.iva != null ? `= ${soldi(v.iva)}` : ''; };
    const campoIva = h('input', { id: id('iva'), type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'num', value: ivaTesto(), placeholder: 'importo o 22%',
      onchange: (e) => {
        const r = leggiIva(e.target.value, v.imponibile);
        if (!r) { e.target.setAttribute('aria-invalid', 'true'); toast('IVA non riconosciuta: scrivi un importo (220,00) o un’aliquota (22%)'); return; }
        e.target.removeAttribute('aria-invalid');
        v.iva = r.iva; if (conAliquota) v.aliquota = r.aliquota;
        if (!(conAliquota && r.aliquota != null)) e.target.value = importoTesto(r.iva);
        mostraCalcolata();
        alCambio('iva');
      } });
    mostraCalcolata();
    const ammissibile = h('input', { id: id('ammissibile'), type: 'checkbox', checked: !!v.ammissibile, onchange: (e) => { v.ammissibile = e.target.checked; alCambio('ammissibile'); } });
    return h('div.gst-modulo',
      h('datalist', { id: `${pre}-fornitori` }, [...new Set(g.spese.map((r) => r.fornitore).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it')).slice(0, 200).map((f) => h('option', { value: f }))),
      campoData('Data documento', v.data, (d) => { v.data = d; alCambio('data'); }, { id: id('data') }),
      testo('fornitore', 'Fornitore', { lista: `${pre}-fornitori` }),
      testo('descrizione', 'Descrizione', { largo: true }),
      h('label.field', { for: id('voce') }, h('span', 'Voce di budget'), menu([{ id: '', nome: conAliquota ? 'Proponi dalla descrizione' : 'Senza voce' }, ...OPZIONI_VOCE], v.voce, (x) => {
        v.voce = x;
        if (VOCI_SPESA.find((y) => y.id === x)?.nonAmmissibile) { v.ammissibile = false; ammissibile.checked = false; }
        alCambio('voce');
      }, { id: id('voce') })),
      h('label.field', { for: id('imponibile') }, h('span', 'Imponibile €'), ingressoImporto(v.imponibile, (n) => {
        v.imponibile = n;
        if (conAliquota && v.aliquota != null) v.iva = n == null ? null : Math.round(n * v.aliquota) / 100;
        mostraCalcolata();
        alCambio('imponibile');
      }, { id: id('imponibile'), placeholder: '0,00' })),
      h('label.field', { for: id('iva') }, h('span', 'IVA'), campoIva, conAliquota ? calcolata : null),
      testo('documento', 'N. documento', { placeholder: 'fattura, ricevuta…' }),
      campoData('Pagata il', v.pagataIl, (d) => { v.pagataIl = d; alCambio('pagataIl'); }, { id: id('pagataIl') }),
      h('label.field', { for: id('mezzo') }, h('span', 'Mezzo di pagamento'), menu([{ id: '', nome: '—' }, ...MEZZI], v.mezzo, (x) => { v.mezzo = x; alCambio('mezzo'); }, { id: id('mezzo') })),
      testo('note', 'Note', { largo: true }),
      h('div.gst-spunte',
        h('label.check', { for: id('territorio') }, h('input', { id: id('territorio'), type: 'checkbox', checked: !!v.territorio, onchange: (e) => { v.territorio = e.target.checked; alCambio('territorio'); } }), h('span', `Sostenuta in ${terr}`)),
        h('label.check', { for: id('ammissibile') }, ammissibile, h('span', 'Ammissibile'))));
  }

  function aggiungi() {
    if (rapida.querySelector('[aria-invalid="true"]')) { toast('Correggi il campo segnato prima di aggiungere.'); return; }
    if (bozza.imponibile == null && !bozza.fornitore.trim() && !bozza.descrizione.trim()) { toast('Scrivi almeno il fornitore o la descrizione e l’importo.'); document.getElementById('sp-nuova-fornitore')?.focus(); return; }
    const voce = bozza.voce || voceDaDescrizione(bozza.descrizione);
    const proposta = !bozza.voce && voce;
    const r = nuovaSpesa({ ...bozza, voce, ammissibile: bozza.ammissibile && !VOCI_SPESA.find((y) => y.id === voce)?.nonAmmissibile });
    g.spese.push(r);
    // restano data, aliquota, territorio e mezzo: di solito si registrano più documenti dello stesso periodo
    bozza = { ...bozza, fornitore: '', descrizione: '', voce: '', imponibile: null, iva: null, documento: '', note: '', ammissibile: true };
    salvaPresto();
    disegnaRapida(); disegnaRiepilogo(); disegnaElenco();
    document.getElementById('sp-nuova-fornitore')?.focus();
    toast(proposta ? `Spesa aggiunta alla voce ${r.voce} ${nomeVoce(r.voce)}: correggila se non è quella giusta` : 'Spesa aggiunta');
  }

  function disegnaRapida() {
    metti(svuota(rapida), h('div.gst-rapida', {
      id: 'sp-rapida',
      onkeydown: (e) => {
        if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'checkbox') return;
        e.preventDefault();
        e.target.dispatchEvent(new Event('change', { bubbles: true })); // il valore appena scritto entra prima dell'aggiunta
        aggiungi();
      },
    }, modulo(bozza, 'sp-nuova', () => {}, { conAliquota: true }),
    h('div.row', h('button.btn.primary', { type: 'button', id: 'sp-aggiungi', onclick: aggiungi }, 'Aggiungi'), h('span.muted.small', 'Invio aggiunge la riga e torna al fornitore. L’IVA si può scrivere come aliquota (22%).'))));
  }

  function disegnaRiepilogo() {
    const r = rendiconto({ progetto: p, bando, gestione: g, dataDecreto: leg.dataDecreto });
    const sotto = r.minimoTerritorio != null && r.spesaTerritorio < r.minimoTerritorio;
    metti(svuota(riepilogo),
      h('div.grid.gst-kpi-griglia',
        riquadro('Registrato', soldi(r.costoConsuntivo), `${fmt(r.totali.righe, 0)} ${r.totali.righe === 1 ? 'spesa' : 'spese'} · IVA ${soldi(r.totali.iva)}`),
        riquadro('Ammissibile', soldi(r.ammissibile), r.feeEccedente > 0 ? `al netto di ${soldi(r.feeEccedente)} di producer fee oltre il limite` : null),
        riquadro(`Ammissibile in ${terr}`, soldi(r.spesaTerritorio),
          r.minimoPct && r.contributo != null ? `${pct(r.pctTerritorio)} del contributo concesso · minimo ${pct(r.minimoPct)}` : r.minimoPct ? `minimo ${pct(r.minimoPct)} del contributo concesso` : null,
          r.minimoTerritorio == null || !g.spese.length ? '' : sotto ? 'gst-warn' : 'gst-ok'),
        riquadro('Da pagare', soldi(r.totali.daPagare), 'IVA compresa')));
  }

  function disegnaOpzioni() {
    const st = statoTappe({ bando, anno: p.anno, gestione: g, dataDecreto: leg.dataDecreto });
    const pres = st.tappe.find((t) => t.id === 'presentazione'), rend = st.tappe.find((t) => t.id === 'rendicontazione');
    const proposta = { dal: pres.data || '', al: rend.data || rend.termine || '' };
    const fontePeriodo = citaBando(bando, 'periodo', 1)[0], fonteIva = citaBando(bando, 'iva', 1)[0];
    const aggiorna = () => { salvaPresto(); conFuoco(opzioni, disegnaOpzioni); disegnaRiepilogo(); disegnaTabella(); };
    metti(svuota(opzioni),
      h('div.gst-periodo',
        campoData('Spese ammissibili dal', g.periodo.dal, (v) => { g.periodo.dal = v; aggiorna(); }, { id: 'sp-periodo-dal' }),
        campoData('al', g.periodo.al, (v) => { g.periodo.al = v; aggiorna(); }, { id: 'sp-periodo-al' }),
        (proposta.dal || proposta.al) && (proposta.dal !== g.periodo.dal || proposta.al !== g.periodo.al)
          ? h('button.btn.s', { type: 'button', id: 'sp-periodo-proponi', title: 'Dalla presentazione della domanda alla rendicontazione', onclick: () => { g.periodo = { dal: proposta.dal || g.periodo.dal, al: proposta.al || g.periodo.al }; aggiorna(); } }, 'Usa le date delle tappe') : null),
      h('p.muted.small.gst-intro', fontePeriodo ? `${fontePeriodo.fonte}: «${fontePeriodo.testo}»` : 'Il periodo di ammissibilità va di norma dalla presentazione della domanda alla rendicontazione: verifica sull’avviso.'),
      spunta('L’IVA è un costo per la società (non recuperabile): contala negli importi rendicontati', g.ivaCosto, (v) => { g.ivaCosto = v; aggiorna(); }, { id: 'sp-iva-costo' }),
      fonteIva ? h('p.muted.small.gst-intro', `${fonteIva.fonte}: «${fonteIva.testo}»`) : null);
  }

  /* elenco */
  function etichette(r, problemi) {
    return [
      r.territorio ? h('span.tag.accent', `In ${terr}`) : h('span.tag', 'Fuori'),
      !r.ammissibile && h('span.tag', 'Non ammissibile'),
      problemi.length ? h(`span.tag.${problemi.some(eBloccante) ? 'bad' : 'warn'}`, { title: problemi.map((x) => PROBLEMI[x]).join('; ') }, problemi.length === 1 ? PROBLEMI[problemi[0]] : `${problemi.length} cose da sistemare`) : null,
    ];
  }
  function riga(r) {
    const problemi = problemiSpesa(r, contesto());
    if (vista.modifica === r.id) {
      const chiudi = () => { vista.modifica = null; disegnaTabella(); document.getElementById(`sp-mod-${r.id}`)?.focus(); };
      const avvisi = h('div');
      const aggiorna = () => {
        salvaPresto(); disegnaRiepilogo();
        const ora = problemiSpesa(r, contesto());
        metti(svuota(avvisi), ora.length ? h('div.notice.warn.small', 'Da sistemare: ', ora.map((x) => PROBLEMI[x]).join('; '), '.') : null);
      };
      const cella = h('td.gst-in-modifica', { colspan: '7', onkeydown: (e) => { if (e.key === 'Escape' || (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox')) { e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true })); chiudi(); } } },
        modulo(r, `sp-${r.id}`, aggiorna), avvisi,
        h('div.spread',
          h('div.row', h('button.btn.s.primary', { type: 'button', id: `sp-chiudi-${r.id}`, onclick: chiudi }, 'Fatto'), h('span.muted.small', 'Le modifiche si salvano mentre scrivi. Invio o Esc per chiudere.')),
          bottoneConferma('Elimina la spesa', 'Conferma: elimina', () => { g.spese = g.spese.filter((x) => x !== r); vista.modifica = null; salva(p).then(() => { disegnaRiepilogo(); disegnaElenco(); toast('Spesa eliminata'); }); })));
      aggiorna();
      return h('tr.gst-riga-modifica', cella);
    }
    return h('tr',
      h('td.num.gst-c-data', { dataset: { et: 'Data' } }, r.data ? dataCorta(r.data) : '—'),
      h('td.gst-c-forn', { dataset: { et: 'Fornitore' } }, h('div.gst-forn', r.fornitore || '—'), r.descrizione && h('div.muted.small', r.descrizione), r.documento && h('div.muted.small', `n. ${r.documento}`)),
      h('td.gst-c-voce', { dataset: { et: 'Voce' } }, r.voce ? h('span', { title: nomeVoce(r.voce) }, r.voce, h('span.gst-solo-scheda', ` ${nomeVoce(r.voce)}`)) : h('span.muted', '—')),
      h('td.r.num.gst-c-imp', { dataset: { et: 'Imponibile' } }, soldi(r.imponibile), r.iva != null && h('div.muted.small', `IVA ${soldi(r.iva)}`)),
      h('td.gst-c-pag', { dataset: { et: 'Pagamento' } }, r.pagataIl ? [h('span.num', dataCorta(r.pagataIl)), r.mezzo && h('div.muted.small', nomeMezzo(r.mezzo))] : h('span.muted', 'Da pagare')),
      h('td.gst-c-stato', { dataset: { et: 'Stato' } }, h('div.gst-etichette', etichette(r, problemi))),
      h('td.r.gst-c-azioni', h('button.btn.s', { type: 'button', id: `sp-mod-${r.id}`, 'aria-label': `Modifica la spesa ${r.fornitore || r.descrizione || ''}`, onclick: () => { vista.modifica = r.id; disegnaTabella(); document.getElementById(`sp-${r.id}-fornitore`)?.focus(); } }, 'Modifica')));
  }
  function intestazione(col) {
    const attiva = vista.ordine === col.id;
    return h(`th${col.id === 'imponibile' ? '.r' : ''}`, { 'aria-sort': attiva ? (vista.verso === 'asc' ? 'ascending' : 'descending') : 'none' },
      h('button.gst-ordina', { type: 'button', id: `sp-ord-${col.id}`, onclick: () => { vista.verso = attiva && vista.verso === 'asc' ? 'desc' : 'asc'; vista.ordine = col.id; const sel = document.getElementById('sp-f-ordine'); if (sel) sel.value = `${vista.ordine}:${vista.verso}`; conFuoco(tabella, disegnaTabella); } }, col.nome, h('span', { 'aria-hidden': 'true' }, attiva ? (vista.verso === 'asc' ? ' ↑' : ' ↓') : '')));
  }
  function disegnaFiltri() {
    const aggiorna = () => { vista.limite = 100; disegnaTabella(); };
    metti(svuota(filtri), g.spese.length ? h('div.gst-filtri',
      h('label.field.gst-cerca', { for: 'sp-cerca' }, h('span', 'Cerca'), h('input', { id: 'sp-cerca', type: 'search', value: vista.testo, placeholder: 'fornitore, descrizione, numero, data…', oninput: (e) => { vista.testo = e.target.value; aggiorna(); } })),
      h('label.field', { for: 'sp-f-voce' }, h('span', 'Voce'), menu([{ id: '', nome: 'Tutte le voci' }, ...OPZIONI_VOCE, { id: 'nessuna', nome: 'Senza voce' }], vista.voce, (v) => { vista.voce = v; aggiorna(); }, { id: 'sp-f-voce' })),
      h('label.field', { for: 'sp-f-stato' }, h('span', 'Mostra'), menu(FILTRI_STATO.map((f) => (f.id === 'territorio' ? { ...f, nome: `In ${terr}` } : f.id === 'fuori' ? { ...f, nome: `Fuori da ${terr}` } : f)), vista.stato, (v) => { vista.stato = v; aggiorna(); }, { id: 'sp-f-stato' })),
      h('label.field', { for: 'sp-f-ordine' }, h('span', 'Ordina per'), menu(COLONNE_ORDINE.flatMap((c) => [{ id: `${c.id}:asc`, nome: `${c.nome} ↑` }, { id: `${c.id}:desc`, nome: `${c.nome} ↓` }]), `${vista.ordine}:${vista.verso}`, (v) => { [vista.ordine, vista.verso] = v.split(':'); aggiorna(); }, { id: 'sp-f-ordine' }))) : null);
  }
  function disegnaTabella() {
    if (!g.spese.length) {
      metti(svuota(tabella), h('div.panel.flat.empty', h('strong', 'Nessuna spesa registrata'), 'Inserisci la prima qui sopra oppure importa un file CSV o Excel: fatture, ricevute e buste paga, una riga per documento.'));
      return;
    }
    const filtrate = ordinaSpese(filtraSpese(g.spese, vista, contesto()), vista.ordine, vista.verso);
    const visibili = filtrate.slice(0, vista.limite);
    const somma = filtrate.reduce((a, r) => a + (r.imponibile || 0), 0);
    const filtroAttivo = vista.testo || vista.voce || vista.stato;
    metti(svuota(tabella),
      h('div.spread', h('div.muted.small', { id: 'sp-conteggio', role: 'status' }, filtroAttivo ? `${fmt(filtrate.length, 0)} di ${fmt(g.spese.length, 0)} spese · imponibile ${soldi(somma)}` : `${fmt(g.spese.length, 0)} ${g.spese.length === 1 ? 'spesa' : 'spese'} · imponibile ${soldi(somma)}`),
        filtroAttivo ? h('button.btn.s.ghost', { type: 'button', id: 'sp-azzera', onclick: () => { vista.testo = ''; vista.voce = ''; vista.stato = ''; disegnaElenco(); document.getElementById('sp-cerca')?.focus(); } }, 'Togli i filtri') : null),
      filtrate.length ? h('div.tablewrap.gst-schede.gst-registro', h('table',
        h('thead', h('tr', intestazione(COLONNE_ORDINE[0]), intestazione(COLONNE_ORDINE[1]), intestazione(COLONNE_ORDINE[2]), intestazione(COLONNE_ORDINE[3]), intestazione(COLONNE_ORDINE[4]), h('th', 'Stato'), h('th', h('span.gst-nascosto', 'Azioni')))),
        h('tbody', visibili.map(riga))))
        : h('div.panel.flat.empty', h('strong', 'Nessuna spesa con questi filtri'), 'Cambia la ricerca o togli i filtri.'),
      filtrate.length > visibili.length ? h('div', h('button.btn.s', { type: 'button', id: 'sp-altre', onclick: () => { vista.limite += 200; conFuoco(tabella, disegnaTabella); } }, `Mostra altre ${fmt(Math.min(200, filtrate.length - visibili.length), 0)} (${fmt(filtrate.length - visibili.length, 0)} nascoste)`)) : null,
      h('div.spread', h('span'), bottoneConferma('Svuota il registro', 'Conferma: elimina tutte le spese', () => { g.spese = []; vista.modifica = null; salva(p).then(() => { disegnaRiepilogo(); disegnaElenco(); }); })));
  }
  const disegnaElenco = () => { disegnaFiltri(); disegnaTabella(); };

  /* importazione */
  async function importa(file) {
    if (!file) return;
    metti(svuota(anteprima), h('div.notice', h('span.spin'), ` Lettura di «${file.name}»…`));
    try {
      const letture = (await tabelleDaFile(file)).map((t) => importaSpese(t, { territorio: terr }));
      const lettura = letture.sort((a, b) => b.righe.length - a.righe.length)[0];
      if (!lettura?.righe.length) throw new Error(lettura?.avvisi[0] || 'Nel file non ho trovato spese.');
      const { righe, doppie } = senzaDoppioni(g.spese, lettura.righe);
      const totale = righe.reduce((a, r) => a + (r.imponibile || 0), 0);
      const chiudi = () => { svuota(anteprima); document.getElementById('sp-importa')?.focus(); };
      metti(svuota(anteprima), h('div.panel.stack.gst-anteprima', { id: 'sp-anteprima' },
        h('div', h('h3', `«${file.name}»: ${fmt(righe.length, 0)} ${righe.length === 1 ? 'spesa da aggiungere' : 'spese da aggiungere'}`),
          h('p.muted.small', [`Imponibile complessivo ${soldi(totale)}.`, doppie ? ` ${fmt(doppie, 0)} già nel registro, lasciate fuori.` : '', lettura.saltate ? ` ${fmt(lettura.saltate, 0)} righe saltate (totali o vuote).` : ''].join(''))),
        h('div.small', h('strong', 'Colonne lette: '), Object.entries(lettura.colonne).map(([campo, col]) => `${campo} ← «${col}»`).join(' · '), lettura.ignorate.length ? h('span.muted', ` · non usate: ${lettura.ignorate.map((c) => `«${c}»`).join(', ')}`) : null),
        lettura.avvisi.map((a) => h('div.notice.warn.small', a)),
        righe.length ? h('div.tablewrap', h('table', h('thead', h('tr', h('th', 'Data'), h('th', 'Fornitore'), h('th', 'Voce'), h('th.r', 'Imponibile'), h('th.r', 'IVA'), h('th', `In ${terr}`))),
          h('tbody', righe.slice(0, 5).map((r) => h('tr', h('td.num', r.data ? dataCorta(r.data) : '—'), h('td', r.fornitore || r.descrizione || '—'), h('td', r.voce || '—'), h('td.r.num', soldi(r.imponibile)), h('td.r.num', r.iva == null ? '—' : soldi(r.iva)), h('td', r.territorio ? 'sì' : 'no'))),
            righe.length > 5 ? h('tr', h('td.muted.small', { colspan: '6' }, `…e altre ${fmt(righe.length - 5, 0)}.`)) : null))) : null,
        h('div.row',
          h('button.btn.primary', { type: 'button', id: 'sp-importa-conferma', disabled: !righe.length, onclick: () => { g.spese.push(...righe); salva(p).then(() => { chiudi(); disegnaRapida(); disegnaRiepilogo(); disegnaElenco(); toast(`${fmt(righe.length, 0)} ${righe.length === 1 ? 'spesa aggiunta' : 'spese aggiunte'} al registro`); }); } }, righe.length ? `Aggiungi ${fmt(righe.length, 0)} ${righe.length === 1 ? 'spesa' : 'spese'} al registro` : 'Niente da aggiungere'),
          h('button.btn', { type: 'button', id: 'sp-importa-annulla', onclick: chiudi }, 'Annulla'))));
      document.getElementById('sp-importa-conferma')?.focus();
    } catch (e) { metti(svuota(anteprima), h('div.notice.bad', { role: 'alert' }, h('strong', `«${file.name}» non è stato importato. `), e.message || 'File non leggibile.')); }
  }

  const ingresso = h('input', { id: 'sp-file', type: 'file', accept: '.csv,.txt,.tsv,.xlsx,.xls,.ods', hidden: true, onchange: (e) => { importa(e.target.files[0]); e.target.value = ''; } });
  const esporta = (nome, testo) => { if (!g.spese.length) { toast('Il registro è vuoto.'); return; } salvaFile(nomeFilePulito(`${nome}-${titolo()}`, 'csv'), testo(), 'text/csv'); };
  metti(area,
    h('div.panel.stack',
      h('div.spread.gst-testa',
        intro('Registro delle spese', `Una riga per documento di spesa. Da qui escono il consuntivo per voce, la spesa ammissibile sostenuta in ${terr} e la matrice di rendicontazione.`),
        h('div.row', ingresso,
          h('button.btn.primary', { type: 'button', id: 'sp-importa', onclick: () => ingresso.click() }, 'Importa da CSV o Excel'),
          h('button.btn', { type: 'button', id: 'sp-matrice', title: `Le sole spese ammissibili sostenute in ${terr}, per voce, con i totali`, onclick: () => esporta('matrice-rendicontazione', () => csvMatrice(g.spese, { titolo: titolo(), bando, cup: g.cup, territorio: terr, ivaCosto: g.ivaCosto })) }, 'Matrice di rendicontazione (CSV)'),
          h('button.btn', { type: 'button', id: 'sp-registro', title: 'Tutte le spese, base del conto consuntivo', onclick: () => esporta('registro-spese', () => csvRegistro(g.spese)) }, 'Registro completo (CSV)'))),
      riepilogo, anteprima,
      h('details.more', { id: 'sp-opzioni' }, h('summary', 'Periodo di ammissibilità e IVA'), opzioni),
      h('p.muted.small.gst-intro', 'L’importazione riconosce da sola le colonne (in qualunque ordine) e i numeri scritti all’italiana. La matrice esportata serve a compilare la modulistica dell’ente: non la sostituisce.')),
    h('div.panel.stack', h('h3', 'Inserimento rapido'), rapida),
    h('div.panel.stack', filtri, tabella));
  disegnaRapida(); disegnaRiepilogo(); disegnaOpzioni(); disegnaElenco();
}

/* ------------------------------------------------------------------ rendiconto */

function vistaRendiconto(area, ctx, apri) {
  const { p, bando, g, leg, terr, mostra } = ctx;
  const cambia = () => { salvaPresto(); conFuoco(area, disegna); };
  const scostamento = (v) => (v.scostamento == null ? h('span.muted', '—')
    : [h('span', { class: Math.abs(v.scostamento) < 0.005 ? 'muted' : '' }, `${v.scostamento > 0 ? '+' : ''}${soldi(v.scostamento)}`), v.scostamentoPct != null && Math.abs(v.scostamentoPct) >= 0.05 ? h('div.small', { class: Math.abs(v.scostamentoPct) > 20 ? 'gst-rosso' : 'muted' }, `${v.scostamentoPct > 0 ? '+' : ''}${fmt(v.scostamentoPct)}%`) : null]);

  function disegna() {
    const r = rendiconto({ progetto: p, bando, gestione: g, dataDecreto: leg.dataDecreto });
    const esito = (id) => r.controlli.find((c) => c.id === id)?.esito;
    const fatte = r.saldo.length - r.mancanti;
    const vociMostrate = r.voci.filter((v) => v.righe || v.preventivo);
    const fonteSaldo = r.quotaFinale?.condizione;
    metti(svuota(area),
      h('div.panel.stack',
        intro('Rendiconto', 'Il consuntivo si costruisce dal registro delle spese e si confronta con ciò che hai dichiarato nel dossier. I minimi sono quelli del bando in uso e si misurano sul contributo concesso.'),
        h('div.gst-misure',
          misura({ etichetta: 'Costo a consuntivo', valore: r.costoConsuntivo, minimo: r.minimoCosto, pieno: r.costoDichiarato, testo: `${euro(r.costoConsuntivo)}${r.costoDichiarato != null ? ` su ${euro(r.costoDichiarato)} dichiarati` : ''}`, esito: esito('consuntivo'),
            nota: r.minimoCosto != null ? `Minimo ${pct(r.minimoCostoPct)} del costo dichiarato: ${euro(r.minimoCosto)}. Ora sei al ${pct(r.pctCosto)}.` : r.minimoCostoPct == null ? 'Il bando in uso non riporta nel programma un minimo: verifica sull’avviso.' : 'Manca il costo dichiarato nei Dati chiave.' }),
          misura({ etichetta: `Spesa ammissibile in ${terr}`, valore: r.spesaTerritorio, minimo: r.minimoTerritorio, pieno: r.minimoTerritorio, testo: euro(r.spesaTerritorio), esito: esito('territorio'),
            nota: r.minimoTerritorio != null ? `Minimo ${r.minimoPct ? `${pct(r.minimoPct)} del contributo concesso` : `${pct(r.minimoSuCostoPct)} del costo`}: ${euro(r.minimoTerritorio)}.${r.pctTerritorio != null && r.minimoPct ? ` Ora sei al ${pct(r.pctTerritorio)}.` : ''}` : r.minimoPct ? 'Inserisci il contributo concesso in Erogazione per calcolare il minimo.' : 'Il bando in uso non riporta nel programma un minimo: verifica sull’avviso.' })),
        r.contributo == null ? h('div', h('button.btn.s', { type: 'button', onclick: () => apri('erogazione') }, 'Inserisci il contributo concesso →')) : null),

      h('div.panel.stack',
        h('div.spread', h('h2', 'Consuntivo contro preventivo'),
          h('span.tag', r.origine === 'preventivo' ? 'Preventivo: da Produzione › Preventivo' : r.origine === 'dati' ? 'Preventivo: solo il totale dei Dati chiave' : 'Preventivo non disponibile')),
        r.origine !== 'preventivo' ? h('div.notice', 'Per il confronto voce per voce serve il preventivo. ', h('button.btn.s', { type: 'button', onclick: () => { S.sotto.produzione = 'preventivo'; mostra('produzione'); } }, 'Apri il preventivo →')) : null,
        vociMostrate.length ? h('div.tablewrap', h('table.gst-consuntivo',
          h('thead', h('tr', h('th', 'Voce'), h('th.r', 'Preventivo'), h('th.r', 'Consuntivo'), h('th.r', 'Scostamento'), h('th.r', `Ammissibile in ${terr}`))),
          h('tbody', vociMostrate.map((v) => h('tr',
            h('td', v.id ? [h('strong', v.id), ` ${v.nome}`] : h('span.tag.warn', 'Senza voce'), v.righe ? h('div.muted.small', `${fmt(v.righe, 0)} ${v.righe === 1 ? 'spesa' : 'spese'}`) : null),
            h('td.r.num', v.preventivo == null ? '—' : soldi(v.preventivo)), h('td.r.num', soldi(v.consuntivo)), h('td.r.num', scostamento(v)), h('td.r.num', soldi(v.territorio))))),
          h('tfoot', h('tr', h('td', h('strong', 'Totale')), h('td.r.num', r.totali.preventivo == null ? '—' : soldi(r.totali.preventivo)), h('td.r.num', h('strong', soldi(r.totali.consuntivo))),
            h('td.r.num', r.totali.scostamento == null ? '—' : `${r.totali.scostamento > 0 ? '+' : ''}${soldi(r.totali.scostamento)}`), h('td.r.num', soldi(r.spesaTerritorio))))))
          : h('p.muted.small', 'Nessuna spesa registrata e nessun preventivo: la tabella si riempie dal Registro spese.'),
        g.ivaCosto ? h('p.muted.small', 'Importi con l’IVA non recuperabile, come scelto nel Registro spese.') : h('p.muted.small', 'Importi IVA esclusa, come nel budget del dossier.')),

      h('div.panel.stack', h('h2', 'Controlli'), elencoControlli(r.controlli),
        h('div', h('button.btn.s', { type: 'button', onclick: () => apri('spese') }, 'Apri il registro delle spese →'))),

      h('div.panel.stack',
        h('div.spread', h('h2', 'Che cosa manca per chiedere il saldo'), h(`span.tag.${r.mancanti ? 'warn' : 'ok'}`, r.mancanti ? `${r.mancanti} ${r.mancanti === 1 ? 'cosa da fare' : 'cose da fare'}` : 'Tutto pronto')),
        h('div.bar', { role: 'img', 'aria-label': `${fatte} voci fatte su ${r.saldo.length}` }, h('i.ok', { style: { width: `${(fatte / r.saldo.length) * 100}%` } })),
        h('ul.todo', r.saldo.filter((x) => !x.id.startsWith('adempimento:')).map((x) => h('li', segno(x.fatto ? 'ok' : 'attenzione'),
          h('div', h('div.t', x.testo, h('span.gst-nascosto', x.fatto ? ' — fatto' : ' — da fare')), x.dettaglio && h('div.d', x.dettaglio)),
          !x.fatto && x.vai ? h('button.btn.s', { type: 'button', onclick: () => apri(x.vai) }, 'Vai →') : h('span')))),
        h('div.stack-s',
          h('div', h('h3', 'Adempimenti dell’avviso'), h('p.muted.small.gst-intro', 'Voci tipiche dei bandi regionali, da spuntare a mano: adattale a ciò che chiede il tuo avviso.')),
          h('ul.gst-adempimenti', g.adempimenti.map((a, i) => h('li',
            spunta(a.testo || 'Voce senza nome', a.fatto, (v) => { a.fatto = v; cambia(); }, { id: `gst-ad-${a.id}` }),
            h('button.btn.s.ghost', { type: 'button', 'aria-label': `Togli «${a.testo}»`, onclick: () => { g.adempimenti.splice(i, 1); cambia(); } }, '✕')))),
          h('div.gst-nuovo-adempimento',
            h('label.field', { for: 'gst-ad-nuovo' }, h('span', 'Aggiungi una voce'), h('input', { id: 'gst-ad-nuovo', type: 'text', placeholder: 'Per esempio: cinque fotografie di scena', onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('gst-ad-aggiungi').click(); } } })),
            h('button.btn.s', { type: 'button', id: 'gst-ad-aggiungi', onclick: () => { const campo = document.getElementById('gst-ad-nuovo'); const testo = campo.value.trim(); if (!testo) { campo.focus(); return; } g.adempimenti.push({ id: `a${Date.now().toString(36)}`, testo, fatto: false }); salvaPresto(); disegna(); document.getElementById('gst-ad-nuovo')?.focus(); } }, 'Aggiungi'))),
        fonteSaldo ? h('details.more.small', h('summary', `Che cosa dice il bando sulla quota «${r.quotaFinale.nome}»`), h('p.gst-intro', fonteSaldo)) : h('p.muted.small', 'Il bando in uso non riporta nel programma le condizioni del saldo: verifica sull’avviso.')));
  }
  disegna();
}

/* ------------------------------------------------------------------ punteggio da mantenere */

// Punteggi di partenza per verificare le soglie: quelli della Commissione se sono stati inseriti nel Report, altrimenti la stima.
function punteggiNoti(p) {
  try {
    const ris = risultatoDi(p);
    const reali = ris.sezioni.map((x) => p.reale?.[x.id]);
    if (reali.length && reali.every((v) => typeof v === 'number')) return { origine: 'commissione', totale: r1(reali.reduce((a, b) => a + b, 0)), sezioni: Object.fromEntries(ris.sezioni.map((x, i) => [x.id, reali[i]])) };
    if (ris.completo) return { origine: 'stima', totale: ris.totale, sezioni: Object.fromEntries(ris.sezioni.map((x) => [x.id, x.punti])) };
  } catch { /* bando senza griglia */ }
  return null;
}

function vistaPunteggio(area, ctx, apri) {
  const { p, bando, g, leg, terr, mostra } = ctx;
  const eff = g.effettivi;
  const cambia = () => { salvaPresto(); conFuoco(area, disegna); };
  const leggi = (o, chiave) => { const [gruppo, k] = chiave.split('.'); return o?.[gruppo]?.[k] ?? null; };
  const NOTIZIA = { nessuno: 'ok', riduzione: 'warn', soglie: 'bad', da_completare: '', nessun_criterio: '' };
  const STATO = { confermato: ['ok', 'Confermato'], perso: ['bad', 'Punti persi'], guadagnato: ['accent', 'Meglio del dichiarato'], da_inserire: ['x', 'Da inserire'], non_dichiarato: ['x', 'Non dichiarato'] };

  function disegna() {
    const criteri = criteriQuantitativi(bando, p.categoriaId);
    const campi = campiDaConfermare(criteri);
    const r = rendiconto({ progetto: p, bando, gestione: g, dataDecreto: leg.dataDecreto });
    const consuntivo = datiConsuntivo({ dati: p.dati, effettivi: eff, spesaTerritorio: g.spese.length ? r.spesaTerritorio : null, costoConsuntivo: r.costoConsuntivo });
    const esito = punteggioDaMantenere({ bando, categoriaId: p.categoriaId, dati: p.dati, consuntivo, punteggi: punteggiNoti(p) });
    const nomiCampi = Object.fromEntries(CAMPI_EFFETTIVI);
    const etichettaCampo = (k) => nomiCampi[k].replace('nel territorio', `in ${terr}`).replace('del territorio', `di ${terr}`);
    const numerici = campi.filter((k) => k.includes('.'));
    const vuoti = numerici.filter((k) => leggi(eff, k) == null && leggi(p.dati, k) != null);

    if (!criteri.length) {
      metti(svuota(area), h('div.panel.stack', intro('Punteggio da mantenere', 'I parametri che hanno generato punteggio vanno rispettati a consuntivo.'),
        h('div.notice', esito.sintesi, ' Controlla comunque sull’avviso se la riduzione dei parametri dichiarati ha conseguenze sul contributo.')));
      return;
    }
    metti(svuota(area),
      h('div.panel.stack',
        intro('Punteggio da mantenere', 'Giorni di lavorazione, professionisti e spesa sul territorio hanno generato punteggio: a consuntivo vengono verificati. Inserisci i valori effettivi e Clockwise ricalcola i criteri con le stesse fasce del bando.'),
        h(`div.notice${NOTIZIA[esito.rischio] ? `.${NOTIZIA[esito.rischio]}` : ''}`, { id: 'gst-punti-sintesi', role: 'status' }, h('strong', esito.persi > 0 ? `${fmt(esito.persi)} ${esito.persi === 1 ? 'punto perso' : 'punti persi'}. ` : ''), esito.sintesi,
          esito.guadagnati > 0 ? ` In altri criteri risultano ${fmt(esito.guadagnati)} punti in più del dichiarato: per prudenza non compensano quelli persi.` : ''),
        esito.persi > 0 ? (esito.senzaRegola
          ? h('div.notice', h('strong', 'Che cosa comporta: '), 'il bando in uso non riporta nel programma che cosa succede se i parametri dichiarati non sono rispettati (riduzione o revoca del contributo). Verifica sull’avviso.')
          : h('div.stack-s', h('div.label', 'Che cosa dice il bando'), esito.citazioni.map(citazione))) : null,
        esito.persi > 0 && !esito.origine ? h('div', h('button.btn.s', { type: 'button', onclick: () => mostra('report') }, 'Inserisci nel Report i punteggi della Commissione →')) : null),

      h('div.panel.stack',
        h('div.spread', h('div', h('h2', 'Dati effettivi'), h('p.muted.small', 'Accanto a ogni campo il valore dichiarato nel dossier.')),
          vuoti.length ? h('button.btn.s', { type: 'button', id: 'gst-copia-dichiarati', onclick: () => { for (const k of vuoti) { const [gruppo, c] = k.split('.'); eff[gruppo][c] = leggi(p.dati, k); } cambia(); toast('Valori dichiarati copiati: correggi quelli cambiati'); } }, 'Parti dai valori dichiarati') : null),
        h('div.grid.w', numerici.map((k) => {
          const [gruppo, c] = k.split('.');
          const dich = leggi(p.dati, k), id = `gst-eff-${gruppo}-${c}`;
          return h('label.field', { for: id }, h('span', etichettaCampo(k)),
            h('input', { id, type: 'number', min: '0', step: '1', inputmode: 'numeric', value: eff[gruppo][c] ?? '', onchange: (e) => { eff[gruppo][c] = e.target.value === '' ? null : Math.max(0, Number(e.target.value)); cambia(); } }),
            h('span', dich == null ? 'non dichiarato' : `dichiarato: ${fmt(dich, 0)}`));
        })),
        campi.includes('spesa') ? h('div.grid.w',
          h('div.field', h('span', `Spesa ammissibile in ${terr}, dal registro`), h('div.gst-kpi-v', g.spese.length ? soldi(r.spesaTerritorio) : '—'), h('span', `dichiarata: ${euro(p.dati.economici?.spesaSicilia)}`)),
          campoImporto('Oppure indicala a mano €', eff.spesaTerritorio, (n) => { eff.spesaTerritorio = n; cambia(); }, { id: 'gst-eff-spesa', placeholder: 'se il registro non è completo' }, 'Se compilato, vale questo al posto del registro.')) : null),

      h('div.panel.stack',
        h('h2', 'Criteri ricalcolati'),
        h('div.tablewrap.gst-schede', h('table',
          h('thead', h('tr', h('th', 'Criterio'), h('th', 'Dichiarato'), h('th', 'Effettivo'), h('th.r', 'Punti'), h('th', 'Esito'))),
          h('tbody', esito.criteri.map((c) => {
            const [classe, etichetta] = STATO[c.stato];
            return h('tr',
              h('td', { dataset: { et: 'Criterio' } }, h('strong', c.id), ` ${c.nome}`, h('div.muted.small', `fino a ${fmt(c.max)} punti`)),
              h('td', { dataset: { et: 'Dichiarato' } }, h('span.num', c.dichiarato.valore), c.dichiarato.dettaglio && h('div.muted.small', c.dichiarato.dettaglio), c.dichiarato.fascia && h('div.muted.small', c.dichiarato.fascia)),
              h('td', { dataset: { et: 'Effettivo' } }, h('span.num', c.effettivo.valore), c.effettivo.dettaglio && h('div.muted.small', c.effettivo.dettaglio), c.effettivo.fascia && h('div.muted.small', c.effettivo.fascia)),
              h('td.r.num', { dataset: { et: 'Punti' } }, c.dichiarato.punti == null ? '—' : fmt(c.dichiarato.punti), ' → ', c.effettivo.punti == null ? '—' : h('strong', fmt(c.effettivo.punti))),
              h('td', { dataset: { et: 'Esito' } }, h(`span.tag.${classe}`, c.differenza ? `${etichetta}: ${c.differenza > 0 ? '+' : '−'}${fmt(Math.abs(c.differenza))}` : etichetta)));
          })))),
        esito.sezioni.some((x) => x.prima != null) ? h('div.stack-s',
          h('div.label', esito.origine === 'commissione' ? 'Soglie minime, sui punteggi della Commissione inseriti nel Report' : 'Soglie minime, sulla stima di Clockwise (i punteggi della Commissione non sono stati inseriti)'),
          h('ul.gst-note', [...esito.sezioni.filter((x) => x.prima != null).map((x) => h('li.small', { class: x.sotto ? 'gst-rosso' : '' }, `Sezione ${x.id}: ${fmt(x.prima)} → ${fmt(x.dopo)}${x.soglia != null ? ` (minimo ${fmt(x.soglia)})` : ''}`)),
            esito.totale.prima != null ? h('li.small', { class: esito.totale.sotto ? 'gst-rosso' : '' }, `Totale: ${fmt(esito.totale.prima)} → ${fmt(esito.totale.dopo)}${esito.totale.soglia != null ? ` (minimo ${fmt(esito.totale.soglia)})` : ''}`) : null])) : null,
        h('p.muted.small.gst-intro', 'Il ricalcolo riguarda i soli criteri che il bando calcola dai numeri; gli altri dipendono dal giudizio della Commissione.')));
  }
  disegna();
}

/* ------------------------------------------------------------------ cronoprogramma */

const COLORE_FASE = { sviluppo: 'var(--idle)', preparazione: 'var(--accent)', riprese: 'var(--accent)', post: 'var(--accent)', consegna: 'var(--signal)', uscita: 'var(--ok)' };
const OPACITA_FASE = { preparazione: 0.55, post: 0.75 };
const COLORE_SEGNO = { rosso: 'var(--bad)', giallo: 'var(--signal)', verde: 'var(--ok)', fatto: 'var(--muted)', grigio: 'var(--muted)' };

/** Diagramma di Gantt disegnato alla larghezza disponibile: sotto i 560 px i nomi delle fasi vanno sopra le barre. */
function gantt(geo, larghezza, idTabella) {
  const stretto = larghezza < 560;
  const sinistra = stretto ? 4 : 132, destra = 12, alto = 46, riga = stretto ? 44 : 34, barra = 16;
  const utile = Math.max(120, larghezza - sinistra - destra);
  const altezza = alto + geo.barre.length * riga + 10;
  const x = (f) => sinistra + f * utile;
  const pxMese = utile / geo.mesi.length;
  const passo = pxMese >= 30 ? 1 : pxMese >= 11 ? 3 : pxMese >= 5.5 ? 6 : 12;
  const testo = { 'font-size': 11, 'font-family': 'var(--font-body)', fill: 'var(--muted)' };
  const descrizione = [
    ...geo.barre.filter((b) => b.x != null).map((b) => `${b.nome}: ${b.dal && b.al ? `dal ${dataEstesa(b.dal)} al ${dataEstesa(b.al)}` : dataEstesa(b.dal || b.al)}`),
    ...geo.segni.map((g) => `${g.nome}: ${dataEstesa(g.data)}`),
  ].join('. ');
  return s('svg', { class: 'gst-gantt-svg', width: larghezza, height: altezza, viewBox: `0 0 ${larghezza} ${altezza}`, role: 'img', 'aria-labelledby': 'gst-gantt-titolo gst-gantt-desc', 'aria-describedby': idTabella },
    s('title', { id: 'gst-gantt-titolo' }, `Cronoprogramma dal ${dataEstesa(geo.dal)} al ${dataEstesa(geo.al)}`),
    s('desc', { id: 'gst-gantt-desc' }, descrizione || 'Nessuna fase con le date.'),
    // righe alterne e griglia dei mesi
    geo.barre.map((b, i) => (i % 2 ? null : s('rect', { x: 0, y: alto + i * riga, width: larghezza, height: riga, fill: 'var(--surface-2)', opacity: 0.5 }))),
    geo.mesi.map((m) => {
      const anno = m.mese === 1 || m === geo.mesi[0];
      const segnato = (m.mese - 1) % passo === 0;
      return [
        (segnato || anno) && s('line', { x1: x(m.x), y1: anno ? 6 : 26, x2: x(m.x), y2: altezza - 6, stroke: 'var(--line)', 'stroke-width': anno ? 1.5 : 1 }),
        anno && s('text', { x: x(m.x) + 4, y: 16, ...testo, 'font-weight': 600, fill: 'var(--ink)' }, String(m.anno)),
        segnato && passo < 12 && s('text', { x: x(m.x) + 4, y: 36, ...testo }, m.etichetta),
      ];
    }),
    // fasi
    geo.barre.map((b, i) => {
      const y = alto + i * riga;
      const yBarra = stretto ? y + 22 : y + (riga - barra) / 2;
      const titolo = b.x == null ? `${b.nome}: date da indicare` : `${b.nome}: ${b.dal && b.al ? `dal ${dataEstesa(b.dal)} al ${dataEstesa(b.al)} (${giorniTesto(b.giorni)})` : dataEstesa(b.dal || b.al)}`;
      return s('g', {},
        s('text', { x: stretto ? sinistra + 2 : 8, y: stretto ? y + 15 : y + riga / 2 + 4, 'font-size': 12, 'font-family': 'var(--font-body)', 'font-weight': 600, fill: b.x == null ? 'var(--muted)' : 'var(--ink)' }, b.nome),
        b.x == null ? null
          : b.puntuale ? s('path', { d: `M ${x(b.x)} ${yBarra - 1} l 7 9 l -7 9 l -7 -9 z`, fill: COLORE_FASE[b.id] || 'var(--accent)' }, s('title', {}, titolo))
            : s('rect', { x: x(b.x), y: yBarra, width: Math.max(3, b.w * utile), height: barra, rx: 4, fill: COLORE_FASE[b.id] || 'var(--accent)', opacity: OPACITA_FASE[b.id] || 1 }, s('title', {}, titolo)));
    }),
    // oggi
    geo.oggi != null && [
      s('line', { x1: x(geo.oggi), y1: alto - 6, x2: x(geo.oggi), y2: altezza - 4, stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }),
      s('text', { x: x(geo.oggi), y: alto - 9, ...testo, fill: 'var(--ink)', 'font-weight': 600, 'text-anchor': geo.oggi > 0.92 ? 'end' : geo.oggi < 0.08 ? 'start' : 'middle' }, 'oggi'),
    ],
    // scadenze: linea e numero, spiegati nella legenda sotto il diagramma
    geo.segni.map((g, i) => s('g', {},
      s('line', { x1: x(g.x), y1: alto - 2, x2: x(g.x), y2: altezza - 4, stroke: COLORE_SEGNO[g.semaforo], 'stroke-width': 2 }),
      s('circle', { cx: x(g.x), cy: altezza - 12, r: 8, fill: COLORE_SEGNO[g.semaforo] }),
      s('text', { x: x(g.x), y: altezza - 8.5, 'font-size': 10, 'font-weight': 700, 'font-family': 'var(--font-mono)', 'text-anchor': 'middle', fill: 'var(--surface)' }, String(i + 1)),
      s('title', {}, `${g.nome}: ${dataEstesa(g.data)}`))));
}

function vistaCrono(area, ctx, apri) {
  const { p, bando, g, leg } = ctx;
  const tela = h('div.gst-gantt'), sotto = h('div.stack');
  const titolo = () => p.dati.titolo || p.nome;
  const calcola = () => {
    const stato = statoTappe({ bando, anno: p.anno, gestione: g, dataDecreto: leg.dataDecreto });
    const fasi = fasiCronoprogramma(g), segni = segniCronoprogramma(stato);
    return { stato, fasi, segni, geo: geometriaGantt(fasi, segni) };
  };
  let larghezzaDisegnata = 0;
  function disegnaTela(dati = calcola()) {
    const larghezza = Math.max(280, Math.floor(tela.clientWidth) || 720);
    larghezzaDisegnata = larghezza;
    metti(svuota(tela), dati.geo && dati.fasi.some((f) => f.dal || f.al)
      ? gantt(dati.geo, larghezza, 'gst-crono-tabella')
      : h('div.panel.flat.empty', h('strong', 'Cronoprogramma da compilare'), 'Indica le date delle fasi nella tabella qui sotto, oppure parti dal primo giorno di riprese con «Proponi le date».'));
  }
  const cambia = () => { salvaPresto(); disegnaTela(); conFuoco(sotto, disegnaSotto); };

  function proponi() {
    const inizio = g.tappe.inizioRiprese.data;
    const proposta = proponiCronoprogramma({ inizioRiprese: inizio, giorni: p.dati.giorni });
    if (!proposta) { toast('Indica prima il giorno d’inizio delle riprese.'); document.getElementById('gst-fase-riprese-dal')?.focus(); return; }
    for (const [id, d] of Object.entries(proposta)) { impostaFase(g, id, 'dal', d.dal); impostaFase(g, id, 'al', d.al); }
    cambia();
    toast('Date proposte dalle giornate dei Dati chiave: correggile dove serve');
  }

  function disegnaSotto() {
    const { stato, fasi, segni } = calcola();
    const controlli = controlliCronoprogramma(fasi, stato);
    const conDate = fasi.some((f) => f.dal || f.al);
    metti(svuota(sotto),
      segni.length ? h('ol.gst-legenda', { 'aria-label': 'Scadenze segnate sul diagramma' }, segni.map((x, i) => h('li', h('span.gst-numero', { dataset: { semaforo: x.semaforo }, 'aria-hidden': 'true' }, String(i + 1)), h('span', h('strong', x.nome), h('span.muted', ` · ${dataBreve(x.data)}`), x.prorogaMesi ? h('span.muted', ` · con ${mesiTesto(x.prorogaMesi)} di proroga`) : null)))) : h('p.muted.small', bando.scadenze?.length ? 'Le scadenze del bando compaiono sul diagramma quando inserisci la data di notifica del decreto in Tappe e scadenze.' : 'Il bando in uso non ha scadenze calcolabili: i termini che inserisci in Tappe e scadenze compaiono qui.'),
      controlli.length ? h('ul.checklist', controlli.map((c) => h('li', segno(c.esito), h('div', h('div.t', c.testo))))) : conDate ? h('div.notice.ok', 'Nessuna incongruenza tra le fasi e i termini noti.') : null,
      h('div.tablewrap.gst-schede', h('table', { id: 'gst-crono-tabella' },
        h('caption.gst-nascosto', 'Fasi del cronoprogramma con le date di inizio e fine'),
        h('thead', h('tr', h('th', 'Fase'), h('th', 'Dal'), h('th', 'Al'), h('th.r', 'Durata'))),
        h('tbody', fasi.map((f) => h('tr',
          h('th.gst-fase', { scope: 'row', dataset: { et: 'Fase' } }, h('span.gst-campione', { style: { background: COLORE_FASE[f.id], opacity: OPACITA_FASE[f.id] || 1 }, 'aria-hidden': 'true' }), f.nome),
          h('td', { dataset: { et: 'Dal' } }, h('input', { id: `gst-fase-${f.id}-dal`, type: 'date', value: f.dal, 'aria-label': `${f.nome}: inizio`, onchange: (e) => { impostaFase(g, f.id, 'dal', e.target.value); cambia(); } })),
          h('td', { dataset: { et: 'Al' } }, h('input', { id: `gst-fase-${f.id}-al`, type: 'date', value: f.al, 'aria-label': `${f.nome}: fine`, 'aria-invalid': f.invertita ? 'true' : null, onchange: (e) => { impostaFase(g, f.id, 'al', e.target.value); cambia(); } })),
          h('td.r.num', { dataset: { et: 'Durata' } }, f.giorni ? giorniTesto(f.giorni) : f.invertita ? h('span.gst-rosso', 'date invertite') : '—')))))),
      h('p.muted.small.gst-intro', 'Le date delle riprese sono le stesse di Tappe e scadenze: cambiandole qui cambiano anche lì. La durata è in giorni di calendario.'),
      segni.length ? h('div.tablewrap', h('table',
        h('caption.gst-nascosto', 'Scadenze sovrapposte al cronoprogramma'),
        h('thead', h('tr', h('th', 'Scadenza'), h('th', 'Data'), h('th', 'Stato'))),
        h('tbody', segni.map((x) => h('tr', h('td', x.nome), h('td.num', dataCorta(x.data)), h('td', h(`span.tag.${SEMAFORO[x.semaforo][0]}`, x.tipo === 'decreto' ? 'Notificato' : SEMAFORO[x.semaforo][1]))))))) : null);
  }

  metti(area, h('div.panel.stack',
    h('div.spread.gst-testa',
      intro('Cronoprogramma', 'Le fasi della lavorazione, dallo sviluppo all’uscita, con sopra le scadenze del bando: si vede subito se riprese e consegna stanno dentro i termini.'),
      h('div.row',
        h('button.btn', { type: 'button', id: 'gst-proponi', title: 'Dal primo giorno di riprese e dalle giornate dei Dati chiave', onclick: proponi }, 'Proponi le date'),
        h('button.btn', { type: 'button', id: 'gst-crono-csv', onclick: () => { const d = calcola(); salvaFile(nomeFilePulito(`cronoprogramma-${titolo()}`, 'csv'), csvCronoprogramma(d.fasi, d.segni), 'text/csv'); } }, 'Scarica (CSV)'),
        h('button.btn.s.ghost', { type: 'button', onclick: () => apri('tappe') }, 'Tappe e scadenze →'))),
    tela, sotto));
  disegnaTela(); disegnaSotto();
  // il diagramma segue la larghezza della pagina; l'osservatore si spegne quando la sezione viene chiusa
  if (typeof ResizeObserver === 'function') {
    const osservatore = new ResizeObserver(() => {
      if (!tela.isConnected) { osservatore.disconnect(); return; }
      if (Math.abs(Math.floor(tela.clientWidth) - larghezzaDisegnata) > 2) disegnaTela();
    });
    osservatore.observe(tela);
  }
}
