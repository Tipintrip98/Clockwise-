// Scheda Finanza del dossier: piano finanziario e scenari, intensità degli aiuti pubblici, tax credit alla produzione,
// piano di cassa, recupero dei ricavi e indicatori. I calcoli stanno in core/finanza.js, le norme in core/finanza-regole.js.
// Le fonti correnti sono sempre quelle del dossier (p.dati.piano): qui si leggono, si confrontano e, solo dopo una conferma,
// si riscrivono. Le scelte della scheda (scenari, ipotesi di cassa, parametri) stanno in p.finanza.
import { h, s, metti, svuota, fmt, euro, toast, campoNumero, campoTesto, scelta, salvaFile, nomeFilePulito, bottoneConferma, segno, ETICHETTE_ESITO } from './dom.js';
import { S, salva, salvaPresto } from './app.js';
import { sottoNavigazione } from './sezioni.js';
import * as F from '../core/finanza.js';
import { REGOLE, FONTI, AGGIORNATO_AL, INCERTEZZE, avvertenzaRegola, fonteRegola, statoRegola, regoleIncerte } from '../core/finanza-regole.js';
import { coperturaPiano, ETICHETTE_DOC } from '../core/scoring.js';
import { nuovoId } from '../core/store.js';

const SEZIONI = [
  ['piano', 'Piano finanziario', vistaPiano],
  ['aiuti', 'Aiuti pubblici', vistaAiuti],
  ['taxcredit', 'Tax credit', vistaTaxCredit],
  ['cassa', 'Cassa', vistaCassa],
  ['recupero', 'Recupero', vistaRecupero],
  ['indicatori', 'Indicatori', vistaIndicatori],
];

const R = REGOLE;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pc = (n, d = 1) => (num(n) == null ? '—' : `${fmt(n, d)}%`);
const dataIt = (iso) => { const [a, m, g] = String(iso).split('-'); return `${g}/${m}/${a}`; };
const medio = (r) => (r.valore.min + r.valore.max) / 2;
const intervallo = (r, u = '%') => `${fmt(r.valore.min)}–${fmt(r.valore.max)}${u}`;
const TAG_ESITO = { ok: 'ok', attenzione: 'warn', critico: 'bad', da_verificare: '', info: '', nd: '' };
const meseOggi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
let progressivo = 0;
const nuovoIdCampo = (base) => `fin-${base}-${++progressivo}`;

/* ------------------------------------------------------------------ pezzi comuni */

/** Fonte di una regola accanto al numero: atto (con collegamento), articolo e, se serve, l'avvertenza. */
function fonte(r, { soloAvviso = false } = {}) {
  if (!r) return null;
  const f = fonteRegola(r), avviso = avvertenzaRegola(r), stato = statoRegola(r);
  const tag = avviso && h(`span.tag.${stato === 'indicativo' ? 'accent' : 'warn'}`, avviso);
  if (soloAvviso) return tag || null;
  return h('span.fin-fonte',
    h('span', f ? ['Fonte: ', f.url ? h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer', title: f.titolo }, f.breve) : h('span', { title: f.titolo }, f.breve), f.articolo ? `, ${f.articolo}` : '']
      : 'Nessun atto ufficiale: stima di prassi'),
    tag);
}

/** Campo numerico: vuoto = si usa il valore proposto, che compare in grigio. */
function campo(etichetta, oggetto, chiave, alCambio, { proposto = null, unita = '', aiuto = null, step = 'any' } = {}) {
  const el = campoNumero(unita ? `${etichetta} (${unita})` : etichetta, oggetto, chiave, alCambio, { step, placeholder: num(proposto) != null ? fmt(proposto, 2) : '' });
  if (aiuto) el.append(h('span.fin-aiuto', aiuto));
  return el;
}

function casella(testo, valore, alCambio, extra = {}) {
  const input = h('input', { type: 'checkbox', checked: !!valore, disabled: extra.disabled, onchange: (e) => alCambio(e.target.checked) });
  return { el: h('label.check', input, h('span', testo)), input };
}

/** Riquadro con un numero in evidenza. */
function dato(etichetta, valore, { nota = null, esito = null, grande = false } = {}) {
  return h(`div.fin-dato${esito ? `.${esito}` : ''}${grande ? '.grande' : ''}`, h('span.label', etichetta), h('strong.num', valore), nota && h('span.fin-nota', nota));
}

/** Elenco di controlli con la fonte della regola sotto ciascuno. */
function controlliConFonte(controlli) {
  return h('ul.checklist', controlli.map((c) => h('li', segno(c.esito),
    h('div', h('div.t', c.titolo, h('span.fin-sr', ` — ${ETICHETTE_ESITO[c.esito] || ''}`)),
      c.dettaglio && h('div.d', c.dettaglio), c.azione && h('div.d', h('strong', 'Da fare: '), c.azione), c.regola && h('div.d', fonte(c.regola))))));
}

function tabella(intestazioni, righe, { classe = '', didascalia = '' } = {}) {
  return h('div.tablewrap.fin-tab', h(`table${classe ? `.${classe}` : ''}`,
    didascalia && h('caption.fin-sr', didascalia),
    h('thead', h('tr', intestazioni.map((x) => (typeof x === 'string' ? h('th', { scope: 'col' }, x) : h(`th.${x.c}`, { scope: 'col' }, x.t))))),
    h('tbody', righe)));
}

const titolo = (testo, sotto = null) => h('div.fin-testa', h('h2', testo), sotto && h('p.muted', sotto));

/* ------------------------------------------------------------------ calcoli condivisi */

function calcola(ctx) {
  const { p, bando, f } = ctx;
  const dati = p.dati;
  const e = dati.economici || {};
  const costo = num(e.costoProduzione) > 0 ? e.costoProduzione : null;
  const piano = F.applicaSceltaAiuti(dati.piano, f.aiuti.righe);
  const segni = `${p.categoriaId || ''} ${dati.tipologiaOpera || ''}`;
  const categoriaProposta = F.categoriaDifficileProposta(segni);
  const categoria = f.aiuti.categoria ?? categoriaProposta;
  const costoAiuti = num(f.aiuti.costoBase) > 0 ? f.aiuti.costoBase : costo;
  const limite = F.limiteAiuti({ coproduzione: f.aiuti.coproduzione, categoria, costo: costoAiuti, dichiarata: f.aiuti.dichiarata });
  const struttura = F.strutturaPiano(dati.piano, costo);
  const aiuti = F.intensitaAiuti({ piano, costo: costoAiuti, limitePct: limite.pct });
  const copertura = coperturaPiano(dati);
  const prev = F.preventivoDelDossier(p);
  const ingresso = F.ingressoTaxCredit({ dati, scelte: f.taxCredit, preventivo: prev, piano, limitePct: limite.pct, categoria: p.categoriaId || '' });
  const tc = F.calcolaTaxCredit(ingresso);
  const cassa = calcolaCassa(ctx, { costo, prev, tc });
  return { dati, costo, piano, categoria, categoriaProposta, costoAiuti, limite, struttura, aiuti, copertura, prev, ingresso, tc, cassa };
}

function ipotesiCassa(ctx, { prev, tc }) {
  const { p, bando, f } = ctx;
  const c = f.cassa;
  const proposto = F.calendarioProposto({ giorni: p.dati.giorni || {}, modulo3: p.modulo3, oggi: meseOggi() });
  const calendario = F.calendarioInUso(c, proposto);
  const curvaPrev = prev ? F.curvaDaPreventivo(prev.gruppi, c.pesi) : null;
  const curva = c.modoUscite === 'preventivo' && curvaPrev ? curvaPrev
    : { prep: num(c.curva.prep) ?? F.CURVA_USCITE.prep, riprese: num(c.curva.riprese) ?? F.CURVA_USCITE.riprese, post: num(c.curva.post) ?? F.CURVA_USCITE.post };
  const quoteBando = F.quoteBandoProposte(bando);
  const quote = Array.isArray(c.quote) ? c.quote : quoteBando.quote;
  const costi = R.erogazione.costi;
  const tasso = num(c.tasso) ?? medio(costi.finanziamentoPonteTassoAnnuoPct);
  const commissione = num(c.commissione) ?? medio(costi.finanziamentoPonteSpeseIstruttoriaPct);
  const taxCredit = {
    primaPct: num(c.taxCredit.primaPct) ?? tc.quote.preventivaPct,
    ritardoPrima: num(c.taxCredit.ritardoPrima) ?? F.TAX_CREDIT_CASSA.ritardoPrima,
    ritardoSaldo: num(c.taxCredit.ritardoSaldo) ?? F.TAX_CREDIT_CASSA.ritardoSaldo,
    assorbimento: num(c.taxCredit.assorbimento) ?? F.TAX_CREDIT_CASSA.assorbimento,
  };
  return { proposto, calendario, curva, curvaPrev, quoteBando, quote, tasso, commissione, taxCredit };
}

function calcolaCassa(ctx, { costo, prev, tc }) {
  const ip = ipotesiCassa(ctx, { prev, tc });
  const cassa = F.pianoDiCassa({ costo, piano: ctx.p.dati.piano, calendario: ip.calendario, curva: ip.curva, tempi: ctx.f.cassa.tempi, quote: ip.quote, taxCredit: ip.taxCredit, tasso: ip.tasso, commissione: ip.commissione });
  return { ...cassa, ipotesi: ip };
}

/* ------------------------------------------------------------------ scheda */

export function schedaFinanza(corpo, p, bando, mostra) {
  const f = F.preparaFinanza(p);
  const sintesi = h('section.fin-sintesi-box', { 'aria-label': 'Il piano in sintesi', 'aria-live': 'polite' });
  const ctx = { p, bando, f, mostra: null };
  const disegnaSintesi = () => metti(svuota(sintesi), pannelloSintesi(calcola(ctx)));
  ctx.cambia = () => { salvaPresto(); disegnaSintesi(); };
  ctx.mostra = (id) => (mostra ? mostra(id) : document.querySelector(`.tabs [data-id="${id}"]`)?.click());
  const area = h('div.stack');
  const { barra, apri } = sottoNavigazione('finanza', SEZIONI, area, ctx);
  ctx.apri = apri;
  metti(corpo, h('div.stack.fin', sintesi, h('div', barra, area), pannelloNorme()));
  disegnaSintesi();
  apri(S.sotto.finanza);
}

function pannelloSintesi(c) {
  const g = F.giudizioPiano({ struttura: c.struttura, aiuti: c.aiuti, copertura: c.copertura, cassa: c.cassa });
  const s = c.struttura;
  const differenza = s.costo == null ? '—' : s.scoperto > 1 ? euro(s.scoperto) : s.eccedenza > 1 ? `+${euro(s.eccedenza)}` : 'nessuno';
  const esitoAiuti = { superato: 'bad', vicino: 'warn', ok: 'ok' }[c.aiuti.stato] || null;
  return h(`div.panel.fin-sintesi.${g.esito}`,
    h('div.fin-sintesi-testa',
      h('div', h('span.label', 'Il piano in un minuto'), h('h2', g.titolo)),
      h(`span.tag${{ ok: '.ok', attenzione: '.warn', critico: '.bad' }[g.esito] || ''}`, g.esito === 'nd' ? 'Dati incompleti' : ETICHETTE_ESITO[g.esito])),
    h('div.fin-dati',
      dato('Costo di produzione', euro(s.costo)),
      dato('Fonti nel piano', euro(s.totale), { nota: s.costo ? `${pc(s.coperto, 0)} del costo` : null }),
      dato(s.eccedenza > 1 ? 'Eccedenza' : 'Scoperto', differenza, { esito: s.scoperto > 1 ? 'bad' : s.eccedenza > 1 ? 'warn' : s.quadra ? 'ok' : null }),
      dato('Aiuti pubblici', pc(c.aiuti.intensita), { nota: `limite ${c.limite.pct}%`, esito: esitoAiuti }),
      dato('Copertura documentata', pc(c.copertura.sulFabbisogno, 0), { nota: 'sul fabbisogno' }),
      dato('Punta di cassa', c.cassa.punta.importo > 0 ? euro(c.cassa.punta.importo) : '—', { nota: c.cassa.punta.mese || null }),
      dato('Tax credit stimato', c.tc.valido ? euro(c.tc.credito) : '—', { nota: c.tc.valido ? `nel piano ${euro(F.strutturaPiano((c.dati.piano || []).filter((r) => F.normalizzaVoce(r.voce) === '1.2'), null).totale)}` : null })),
    h('ul.fin-motivi', g.motivi.map((m) => h('li', m))));
}

function pannelloNorme() {
  const incerte = regoleIncerte();
  return h('details.more.fin-norme',
    h('summary', `Norme usate, fonti e punti da verificare (aggiornate al ${dataIt(AGGIORNATO_AL)})`),
    h('div.stack-s',
      h('p.small', 'I numeri vengono dagli atti ufficiali letti alla data indicata. Il tax credit segue il D.I. 225/2024 come modificato dal D.I. 281/2026, in vigore dal 24 settembre 2026; i limiti di cumulo seguono il Reg. (UE) 651/2014, art. 54. Le stime senza atto (costi di finanziamento, condizioni di distribuzione) sono marcate «valore indicativo di mercato» e vanno sostituite con i dati reali del progetto.'),
      h('h3', 'Punti aperti'),
      h('ul.fin-elenco', INCERTEZZE.map((x) => h('li', x))),
      h('h3', `Regole da verificare o indicative (${incerte.length})`),
      h('ul.fin-elenco', incerte.map((r) => h('li', h('span', r.descrizione), ' ', fonte(r, { soloAvviso: true })))),
      h('h3', 'Atti consultati'),
      h('ul.fin-elenco', Object.values(FONTI).map((x) => h('li', x.url ? h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer' }, x.titolo) : x.titolo))),
      h('p.small.muted', 'Strumento di stima: non sostituisce il parere del commercialista, del consulente del lavoro o degli uffici che gestiscono i fondi.')));
}

/* ------------------------------------------------------------------ 1. piano finanziario */

const CLASSE_GRUPPO = { pubblico: 'g1', proprio: 'g2', coproduzioni: 'g3', mercato: 'g4', terzi: 'g5', altro: 'g6', scoperto: 'gx' };

function pila(struttura) {
  const base = Math.max(struttura.totale, struttura.costo || 0);
  if (!(base > 0)) return h('p.muted', 'Nessuna fonte da mostrare: il piano è vuoto e manca il costo.');
  const segmenti = struttura.gruppi.filter((g) => g.importo > 0).map((g) => ({ id: g.id, nome: g.nome, importo: g.importo, nota: g.descrizione }));
  if (struttura.scoperto > 1) segmenti.push({ id: 'scoperto', nome: 'Scoperto', importo: struttura.scoperto, nota: 'Parte del costo senza fonte' });
  const quota = (x) => (x / base) * 100;
  const descrizione = `Struttura delle fonti su ${euro(base)}: ${segmenti.map((x) => `${x.nome} ${euro(x.importo)}, ${pc(quota(x.importo))}`).join('; ')}.`;
  const marcaCosto = struttura.eccedenza > 1 && struttura.costo ? quota(struttura.costo) : null;
  return h('figure.fin-pila-fig',
    h('div.fin-pila', { role: 'img', 'aria-label': descrizione },
      segmenti.map((x) => h(`span.fin-seg.${CLASSE_GRUPPO[x.id]}`, { style: { width: `${quota(x.importo)}%` }, title: `${x.nome}: ${euro(x.importo)}` })),
      marcaCosto != null && h('span.fin-marca', { style: { left: `${marcaCosto}%` }, 'aria-hidden': 'true' })),
    marcaCosto != null && h('figcaption.small.muted', 'La linea verticale segna il costo di produzione: oltre ci sono fonti in eccesso.'),
    h('ul.fin-legenda', segmenti.map((x) => h('li', h(`i.${CLASSE_GRUPPO[x.id]}`, { 'aria-hidden': 'true' }), h('span', h('strong', x.nome), h('span.muted.small', ` ${x.nota}`)), h('span.num', euro(x.importo)), h('span.num.muted', pc(quota(x.importo)))))));
}

function vistaPiano(area, ctx) {
  const { p, f } = ctx;
  const sopra = h('div.stack');
  const scenariBox = h('div.stack');
  const confrontoBox = h('div');
  const aperti = new Set();

  function disegnaSopra() {
    const c = calcola(ctx);
    const s = c.struttura, cop = c.copertura;
    const righe = (p.dati.piano || []).filter((r) => num(r.importo) > 0);
    metti(svuota(sopra),
      h('div.panel.stack',
        h('div.spread', titolo('Struttura delle fonti', 'Le fonti sono quelle dei Dati chiave: qui si leggono e si confrontano, non si duplicano.'),
          h('button.btn.s', { type: 'button', onclick: () => ctx.mostra('dati') }, 'Modifica le fonti nei Dati chiave')),
        pila(s),
        h('div.fin-dati',
          dato('Costo di produzione', euro(s.costo)),
          dato('Totale delle fonti', euro(s.totale)),
          dato(s.eccedenza > 1 ? 'Eccedenza (fonti − costo)' : 'Scoperto (costo − fonti)', s.costo == null ? '—' : euro(s.eccedenza > 1 ? s.eccedenza : s.scoperto), { esito: s.scoperto > 1 ? 'bad' : s.eccedenza > 1 ? 'warn' : s.quadra ? 'ok' : null }),
          dato('Copertura documentata sul fabbisogno', pc(cop.sulFabbisogno), { nota: 'fonti con documento, escluso il contributo, ÷ (costo − contributo richiesto)' }),
          dato('Copertura documentata sul costo', pc(cop.sulCosto), { nota: `${euro(cop.documentato)} con documento a supporto` }))),
      h('div.panel.stack-s', h('h2', 'Controlli'), controlliConFonte(F.controlliPiano(p.dati))),
      righe.length ? h('div.panel.stack-s', h('h2', 'Fonti del dossier'),
        tabella(['Voce', 'Fonte', 'Gruppo', { t: 'Importo', c: 'r' }, { t: 'Sul costo', c: 'r' }, 'Documento'],
          righe.map((r) => h('tr', h('td.num', F.normalizzaVoce(r.voce) || '—'), h('td', h('div', r.etichetta || '—'), r.denominazione && h('div.small.muted', r.denominazione)),
            h('td', F.GRUPPI_FONTI.find((g) => g.id === F.gruppoFonte(r.voce)).nome), h('td.num.r', euro(r.importo)), h('td.num.r', pc(s.costo ? (r.importo / s.costo) * 100 : null)),
            h('td', h(`span.tag${['contratto', 'delibera', 'referenze', 'deal_memo'].includes(r.documento) ? '.ok' : ''}`, ETICHETTE_DOC[r.documento] || 'Nessun documento')))),
          { didascalia: 'Fonti del piano finanziario del dossier' })) : null);
  }

  function disegnaConfronto() {
    const colonne = F.confrontaScenari(p.dati, f.scenari, calcola(ctx).limite.pct);
    if (colonne.length < 2) { svuota(confrontoBox); return; }
    const riga = (etichetta, valore, { evidenzia = null } = {}) => h('tr', h('th', { scope: 'row' }, etichetta), colonne.map((x) => h(`td.num.r${evidenzia?.(x) ? `.${evidenzia(x)}` : ''}`, valore(x))));
    metti(svuota(confrontoBox), h('div.stack-s', h('h3', 'Confronto'),
      h('div.tablewrap.fin-tab', h('table.fin-confronto',
        h('caption.fin-sr', 'Confronto tra il piano del dossier e gli scenari'),
        h('thead', h('tr', h('th', { scope: 'col' }, 'Indicatore'), colonne.map((x) => h('th.r', { scope: 'col' }, x.nome)))),
        h('tbody',
          riga('Totale delle fonti', (x) => euro(x.totale)),
          riga('Differenza dal piano del dossier', (x) => (x.attuale ? '—' : `${x.scarto > 0 ? '+' : ''}${euro(x.scarto)}`)),
          riga('Scoperto', (x) => euro(x.scoperto), { evidenzia: (x) => (x.scoperto > 1 ? 'fin-bad' : null) }),
          riga('Eccedenza', (x) => euro(x.eccedenza), { evidenzia: (x) => (x.eccedenza > 1 ? 'fin-warn' : null) }),
          F.GRUPPI_FONTI.filter((g) => g.id !== 'altro').map((g) => riga(g.nome, (x) => euro(x.gruppi[g.id]))),
          riga('Copertura documentata sul fabbisogno', (x) => pc(x.documentatoSulFabbisogno)),
          riga('Intensità degli aiuti', (x) => pc(x.intensita), { evidenzia: (x) => ({ superato: 'fin-bad', vicino: 'fin-warn' })[x.statoAiuti] || null }))))));
  }

  function editorScenario(sc) {
    const corpoRighe = h('tbody');
    const differenze = h('div');
    const aggiornaDiff = () => {
      const d = F.differenzePiano(p.dati.piano, sc.piano);
      metti(svuota(differenze), d.length
        ? h('ul.fin-elenco.small', d.map((x) => h('li', h('strong.num', x.voce), ` ${x.etichetta || ''}: ${euro(x.base)} → ${euro(x.altro)} (${x.scarto > 0 ? '+' : ''}${euro(x.scarto)})`)))
        : h('p.small.muted', 'Uguale al piano del dossier.'));
    };
    const cambia = () => { ctx.cambia(); disegnaConfronto(); aggiornaDiff(); };
    const disegnaRighe = () => {
      metti(svuota(corpoRighe), sc.piano.map((r, i) => h('tr',
        h('td', scelta(null, [{ id: '', nome: '—' }, ...F.VOCI_PIANO.map((v) => ({ id: v.codice, nome: `${v.codice} ${v.nome}` }))], F.normalizzaVoce(r.voce), (v) => {
          const vecchia = F.VOCI_PIANO.find((x) => x.codice === r.voce)?.nome;
          r.voce = v;
          if (!r.etichetta || r.etichetta === vecchia) r.etichetta = F.VOCI_PIANO.find((x) => x.codice === v)?.nome || '';
          disegnaRighe(); cambia();
        }, { id: nuovoIdCampo('voce') })),
        h('td', h('input', { type: 'text', value: r.denominazione || '', placeholder: r.etichetta || 'Denominazione', 'aria-label': `Denominazione della fonte, riga ${i + 1}`, oninput: (e) => { r.denominazione = e.target.value; ctx.cambia(); } })),
        h('td', h('input.num', { type: 'number', min: '0', step: 'any', inputmode: 'decimal', value: r.importo ?? '', 'aria-label': `Importo della riga ${i + 1} in euro`, oninput: (e) => { const v = e.target.value.trim(); r.importo = v === '' ? null : Number(v); cambia(); } })),
        h('td', scelta(null, Object.entries(ETICHETTE_DOC).map(([id, nome]) => ({ id, nome })), r.documento || 'nessuno', (v) => { r.documento = v; cambia(); }, { id: nuovoIdCampo('doc') })),
        h('td', h('button.btn.s.ghost.danger', { type: 'button', 'aria-label': `Togli la riga ${i + 1}`, onclick: () => { sc.piano.splice(i, 1); disegnaRighe(); cambia(); } }, 'Togli')))));
      for (const [k, sel] of corpoRighe.querySelectorAll('select').entries()) sel.setAttribute('aria-label', k % 2 === 0 ? `Voce del Modulo III, riga ${Math.floor(k / 2) + 1}` : `Documento a supporto, riga ${Math.floor(k / 2) + 1}`);
    };
    disegnaRighe(); aggiornaDiff();
    const det = h('details.fin-scenario', { open: aperti.has(sc.id), ontoggle: (e) => (e.target.open ? aperti.add(sc.id) : aperti.delete(sc.id)) },
      h('summary', h('strong', sc.nome), h('span.muted.small', ` · ${euro(F.strutturaPiano(sc.piano, null).totale)}`)),
      h('div.stack-s',
        campoTesto('Nome dello scenario', sc, 'nome', () => { det.querySelector('summary strong').textContent = sc.nome || 'Scenario'; ctx.cambia(); disegnaConfronto(); }, { id: nuovoIdCampo('nome') }),
        h('div.tablewrap.fin-tab', h('table.fin-editor', h('caption.fin-sr', `Fonti dello scenario ${sc.nome}`),
          h('thead', h('tr', h('th', { scope: 'col' }, 'Voce'), h('th', { scope: 'col' }, 'Denominazione'), h('th', { scope: 'col' }, 'Importo (€)'), h('th', { scope: 'col' }, 'Documento'), h('th', { scope: 'col' }, h('span.fin-sr', 'Azioni')))),
          corpoRighe)),
        h('div', h('button.btn.s', { type: 'button', onclick: () => { sc.piano.push({ voce: '', etichetta: '', denominazione: '', importo: null, documento: 'nessuno' }); disegnaRighe(); cambia(); } }, 'Aggiungi una fonte')),
        h('div.stack-s', h('span.label', 'Differenze dal piano del dossier'), differenze),
        h('div.row',
          bottoneConferma('Applica al dossier', 'Confermi? Il piano dei Dati chiave sarà sostituito', () => applica(sc), 'btn.s.primary'),
          h('button.btn.s', { type: 'button', onclick: () => { const copia = F.creaScenario(`${sc.nome} (copia)`, sc.piano, { id: nuovoId(), creato: new Date().toISOString() }); f.scenari.push(copia); aperti.add(copia.id); ctx.cambia(); disegnaScenari(); } }, 'Duplica'),
          bottoneConferma('Elimina', 'Confermi l’eliminazione?', () => { f.scenari = f.scenari.filter((x) => x !== sc); ctx.cambia(); disegnaScenari(); }))));
    return det;
  }

  async function applica(sc) {
    const nuovo = F.pianoDaScenario(sc);
    const chiavi = F.chiaviRighe(nuovo);
    p.dati.piano = nuovo.map(({ voce, etichetta, denominazione, importo, documento }) => ({ voce, etichetta: etichetta || F.VOCI_PIANO.find((v) => v.codice === voce)?.nome || '', denominazione, importo, documento }));
    f.aiuti.righe = Object.fromEntries(nuovo.map((r, i) => [chiavi[i], r.aiuto]).filter(([, v]) => typeof v === 'boolean'));
    await salva(p);
    toast(`Piano del dossier sostituito con «${sc.nome}»`);
    ctx.cambia(); disegnaSopra(); disegnaScenari();
  }

  function disegnaScenari() {
    const nome = { valore: '' };
    const campoNome = campoTesto('Nome del nuovo scenario', { v: '' }, 'v', null, { id: nuovoIdCampo('nuovo'), placeholder: `Scenario ${f.scenari.length + 1}` });
    campoNome.querySelector('input').addEventListener('input', (e) => { nome.valore = e.target.value; });
    metti(svuota(scenariBox),
      h('div.panel.stack',
        titolo('Scenari alternativi', 'Prova un piano diverso senza toccare il dossier: salva una copia, cambia gli importi e confronta. «Applica al dossier» sostituisce il piano dei Dati chiave solo dopo una conferma.'),
        h('div.fin-nuovo', campoNome,
          h('button.btn', { type: 'button', onclick: () => {
            const sc = F.creaScenario(nome.valore || `Scenario ${f.scenari.length + 1}`, F.applicaSceltaAiuti(p.dati.piano, f.aiuti.righe), { id: nuovoId(), creato: new Date().toISOString() });
            f.scenari.push(sc); aperti.add(sc.id); ctx.cambia(); disegnaScenari(); toast(`Scenario «${sc.nome}» salvato`);
          } }, 'Salva il piano attuale come scenario')),
        f.scenari.length ? h('div.stack-s', f.scenari.map(editorScenario)) : h('p.muted.small', 'Nessuno scenario salvato.'),
        confrontoBox));
    disegnaConfronto();
  }

  metti(area, sopra, scenariBox);
  disegnaSopra();
  disegnaScenari();
}

/* ------------------------------------------------------------------ 2. aiuti pubblici */

function misuratore(valore, limite, { etichetta = 'Intensità degli aiuti' } = {}) {
  const fondo = Math.max(100, Math.ceil(((valore || 0) + 5) / 10) * 10);
  const stato = valore == null ? 'nd' : valore > limite + 0.005 ? 'bad' : limite - valore <= F.MARGINE_ATTENZIONE_PUNTI ? 'warn' : 'ok';
  return h('div.fin-misura', { role: 'meter', 'aria-label': etichetta, 'aria-valuemin': '0', 'aria-valuemax': String(fondo), 'aria-valuenow': String(arrotonda(valore || 0)), 'aria-valuetext': `${pc(valore)} contro un limite del ${limite}%` },
    h('div.fin-misura-barra', h(`i.${stato}`, { style: { width: `${Math.min(100, ((valore || 0) / fondo) * 100)}%` } }),
      h('span.fin-misura-limite', { style: { left: `${(limite / fondo) * 100}%` } }, h('span', `limite ${limite}%`))),
    h('div.fin-misura-scala.small.muted', h('span', '0%'), h('span', `${fondo}%`)));
}
const arrotonda = (n) => Math.round(n * 10) / 10;

function vistaAiuti(area, ctx) {
  const { p, f } = ctx;
  const risultati = h('div.stack');
  const c0 = calcola(ctx);

  const impostazioni = h('div.panel.stack',
    titolo('Limite applicabile', 'Tutti gli aiuti pubblici alla stessa opera si sommano e non possono superare una quota del costo. Il limite sale per le coproduzioni e per le opere difficili: vale il più alto di cui l’opera ha i requisiti.'),
    h('div.grid.w',
      scelta('Coproduzione internazionale', [
        { id: 'nessuna', nome: 'Nessuna coproduzione internazionale' },
        { id: 'ue', nome: 'Con altri Stati dell’Unione (più Stati finanziano e producono)' },
        { id: 'dac', nome: 'Con Paesi dell’elenco DAC dell’OCSE' },
      ], f.aiuti.coproduzione, (v) => { f.aiuti.coproduzione = v; aggiorna(); }),
      scelta('Tipologia che può essere «opera difficile»', [{ id: '', nome: 'Nessuna di queste' }, ...F.CATEGORIE_DIFFICILI], c0.categoria, (v) => { f.aiuti.categoria = v; aggiorna(); }),
      campo('Costo su cui si misura l’intensità', f.aiuti, 'costoBase', () => aggiorna(), { unita: '€', proposto: c0.costo, aiuto: 'Vuoto: il costo di produzione dei Dati chiave. Nelle coproduzioni internazionali conta la quota italiana.' })),
    casella('La commissione degli esperti ha dichiarato l’opera difficile (conserva il provvedimento)', f.aiuti.dichiarata, (v) => { f.aiuti.dichiarata = v; aggiorna(); }).el,
    c0.categoria && f.aiuti.categoria == null ? h('p.small.muted', `Tipologia proposta dai dati del dossier: ${F.CATEGORIE_DIFFICILI.find((x) => x.id === c0.categoria)?.nome}. Cambiala se non è corretta.`) : null);

  // scelta riga per riga: la tabella resta ferma, si aggiornano solo i risultati
  const righe = F.intensitaAiuti({ piano: c0.piano, costo: c0.costoAiuti }).righe;
  const chiavi = F.chiaviRighe(p.dati.piano);
  const tabellaRighe = righe.length ? h('div.panel.stack-s',
    titolo('Quali fonti contano come aiuto pubblico', 'Di base contano le voci 1.x del piano (contributi e tax credit). Correggi riga per riga: per esempio una coproduzione con un ente pubblico conta, una voce 1.x già fuori dal cumulo no.'),
    tabella(['Conta', 'Voce', 'Fonte', { t: 'Importo', c: 'r' }, 'Scelta'], righe.map((r) => {
      const chiave = chiavi[r.indice];
      const stato = h('span.small', r.modificato ? h('span.tag.accent', 'scelta a mano') : h('span.muted', 'predefinita'));
      const box = h('input', { type: 'checkbox', checked: r.aiuto, 'aria-label': `${r.voce} ${r.etichetta || r.denominazione}: conta come aiuto pubblico`, onchange: (e) => {
        if (e.target.checked === r.predefinito) delete f.aiuti.righe[chiave]; else f.aiuti.righe[chiave] = e.target.checked;
        metti(svuota(stato), e.target.checked !== r.predefinito ? h('span.tag.accent', 'scelta a mano') : h('span.muted', 'predefinita'));
        aggiorna();
      } });
      return h('tr', h('td', box), h('td.num', r.voce || '—'), h('td', r.etichetta || '—', r.denominazione && h('div.small.muted', r.denominazione)), h('td.num.r', euro(r.importo)), h('td', stato));
    }), { didascalia: 'Fonti del piano e scelta se contano come aiuto pubblico' })) : null;

  function aggiorna() { ctx.cambia(); disegna(); }

  function disegna() {
    const c = calcola(ctx);
    const a = c.aiuti, lim = c.limite;
    const e = F.effettoAiuti({ piano: c.piano, costo: c.costoAiuti, limitePct: lim.pct, taxCreditStimato: c.tc.valido ? c.tc.credito : null });
    const avviso = a.stato === 'superato' ? h('div.notice.bad', h('strong', `Limite superato di ${euro(-a.margine)}. `), `Gli aiuti pubblici valgono il ${pc(a.intensita)} del costo contro un massimo del ${lim.pct}%: va ridotta una fonte pubblica o aumentato il costo coperto da fonti private, altrimenti l’aiuto in eccesso viene tagliato o revocato.`)
      : a.stato === 'vicino' ? h('div.notice.warn', h('strong', `Vicino al limite: restano ${euro(a.margine)}. `), `Siete a ${fmt(a.marginePunti, 1)} punti dal ${lim.pct}%. Un aumento del contributo o del tax credit, o un calo del costo a consuntivo, può far superare il limite.`)
        : a.stato === 'ok' ? h('div.notice.ok', h('strong', `Entro il limite: margine di ${euro(a.margine)}. `), `Si possono aggiungere aiuti pubblici fino a questo importo.`)
          : h('div.notice', 'Servono il costo di produzione e almeno una fonte del piano per calcolare l’intensità.');
    const passo = (x) => h('tr', h('th', { scope: 'row' }, x.etichetta), h('td.num.r', euro(x.importo)), h('td.num.r', euro(x.cumulato)), h('td.num.r', pc(x.intensita)),
      h('td', x.stato === 'nd' ? '—' : h(`span.tag.${{ superato: 'bad', vicino: 'warn', ok: 'ok' }[x.stato]}`, { superato: 'oltre il limite', vicino: 'vicino al limite', ok: 'entro il limite' }[x.stato])));
    metti(svuota(risultati),
      h('div.panel.stack',
        h('div.fin-grande', h('span.label', 'Intensità dell’aiuto'), h('strong.num', pc(a.intensita)), h('span.muted', `aiuti pubblici ${euro(a.aiuti)} ÷ costo ${euro(a.costo)}`)),
        misuratore(a.intensita, lim.pct),
        avviso,
        h('div.fin-dati',
          dato('Limite applicabile', `${lim.pct}%`, { nota: lim.nome }),
          dato('Massimo di aiuti pubblici', euro(a.limiteEuro)),
          dato(a.margine != null && a.margine < 0 ? 'Eccedenza da togliere' : 'Margine residuo', a.margine == null ? '—' : euro(Math.abs(a.margine)), { esito: a.margine != null && a.margine < 0 ? 'bad' : null }),
          dato('Distanza dal limite', a.marginePunti == null ? '—' : `${fmt(a.marginePunti, 1)} punti`)),
        h('div.stack-s', h('span.label', 'Limiti considerati'),
          h('ul.fin-limiti', lim.candidati.map((x) => h(`li${x.id === lim.id ? '.scelto' : ''}`, h('span', h('strong', `${x.pct}%`), ` ${x.nome}`, x.id === lim.id ? h('span.tag.ok', 'applicato') : null), fonte(x.regola)))),
          h('p.small.muted', lim.difficile.motivo, ' ', fonte(R.aiuti.opereDifficiliDefinizioniItaliane)))),
      h('div.panel.stack-s',
        titolo('Effetto del contributo del bando e del tax credit', 'Come cresce l’intensità aggiungendo, nell’ordine, gli altri aiuti, il contributo di questo bando (voce 1.1) e il tax credit (voce 1.2).'),
        tabella(['Passo', { t: 'Importo', c: 'r' }, { t: 'Cumulato', c: 'r' }, { t: 'Intensità', c: 'r' }, 'Esito'], [...e.passi.map(passo), e.conStima && passo({ ...e.conStima, etichetta: `Se il tax credit fosse quello stimato (${euro(c.tc.credito)}) invece della voce 1.2` })], { didascalia: 'Intensità degli aiuti passo per passo' }),
        h('div.fin-dati',
          dato('Contributo massimo compatibile', euro(e.massimoBando), { nota: `con gli altri aiuti e il tax credit del piano; richiesto ${euro(e.bando)}`, esito: e.massimoBando != null && e.bando > e.massimoBando + 1 ? 'bad' : null }),
          dato('Tax credit massimo compatibile', euro(e.massimoTaxCredit), { nota: `con gli altri aiuti e il contributo; nel piano ${euro(e.taxCredit)}`, esito: e.massimoTaxCredit != null && e.taxCredit > e.massimoTaxCredit + 1 ? 'bad' : null }))));
  }

  const regole = h('div.panel.stack-s', h('h2', 'Regole da tenere presenti'),
    h('ul.fin-regole', [R.aiuti.cumuloRegola, R.aiuti.baseDelCalcolo, R.aiuti.territorializzazioneMaxPctDellAiuto, R.aiuti.territorializzazioneMaxPctDelBilancio, R.aiuti.scadenzaRegolamento, R.aiuti.deMinimisEsempio].map((r) => h('li', h('span', r.descrizione), r.nota && h('span.small.muted', ` ${r.nota}`), fonte(r)))));
  metti(area, impostazioni, risultati, tabellaRighe, regole);
  disegna();
}

/* ------------------------------------------------------------------ 3. tax credit */

const ORIGINI = { preventivo: 'dal preventivo', dossier: 'dai Dati chiave', piano: 'dal piano finanziario', utente: 'scritto da te' };

function vistaTaxCredit(area, ctx) {
  const { p, f } = ctx;
  const t = f.taxCredit;
  const risultati = h('div.stack');
  const c0 = calcola(ctx);
  const ing0 = c0.ingresso;
  const maggiorata = casella('Aliquota maggiorata per le opere tv e web (coproduzione internazionale, 30% di risorse estere, preacquisto o licenza, associazione con diritti)', t.maggiorata, (v) => { t.maggiorata = v; aggiorna(); });
  const seriale = casella('Opera seriale (documentari e animazione delle imprese ad elevata capacità)', t.seriale, (v) => { t.seriale = v; aggiorna(); });
  const abilita = () => {
    const ing = calcola(ctx).ingresso;
    maggiorata.input.disabled = ing.opera !== 'tv';
    seriale.input.disabled = !(ing.impresa === 'elevata' && /documentario|animazione/.test(ing.opera));
  };
  const base0 = F.ingressoTaxCredit({ dati: p.dati, scelte: {}, preventivo: c0.prev, piano: c0.piano });
  const proposto = (k) => base0[k];
  const aiutoCampo = (k, testo) => `${testo}${base0.origine[k] ? ` Proposto ${ORIGINI[base0.origine[k]]}.` : ''}`;
  const b = R.taxCredit.base;

  const ingressi = h('div.panel.stack',
    titolo('Calcolatore del credito d’imposta alla produzione', 'Credito = aliquota × costo eleggibile, entro i tetti per opera e per impresa. I campi vuoti usano il valore proposto, in grigio.'),
    h('div.notice.info', h('strong', 'Regole del D.I. 225/2024 come modificato dal D.I. 281/2026, in vigore dal 24 settembre 2026. '), `Aggiornate al ${dataIt(AGGIORNATO_AL)}. ${R.taxCredit.aliquote.aliquotePrecedenti.nota.replace(/^Storico\.\s*/, '')}`),
    h('div.grid.w',
      scelta('Tipologia di opera', F.OPERE_TAX_CREDIT, ing0.opera, (v) => { t.opera = v; aggiorna(); }),
      scelta('Tipologia d’impresa', F.IMPRESE_TAX_CREDIT, ing0.impresa, (v) => { t.impresa = v; aggiorna(); })),
    maggiorata.el, seriale.el,
    h('div.grid.w',
      campo('Costo complessivo di produzione', t, 'costoComplessivo', aggiorna, { unita: '€', proposto: proposto('costoComplessivo'), aiuto: aiutoCampo('costoComplessivo', 'Comprende producer fee e spese generali.') }),
      campo('Costi sopra la linea soggetti al limite', t, 'sopraLaLinea', aggiorna, { unita: '€', proposto: proposto('sopraLaLinea'), aiuto: aiutoCampo('sopraLaLinea', 'Soggetto e sceneggiatura, diritti di adattamento, regista, attori principali.') }),
      campo('Oneri finanziari, assicurativi e di garanzia', t, 'oneri', aggiorna, { unita: '€', proposto: proposto('oneri'), aiuto: aiutoCampo('oneri', `Eleggibili fino al ${fmt(b.oneriFinanziariAssicurativiGaranziaMaxPct.valore)}% del costo.`) }),
      campo('Producer fee', t, 'producerFee', aggiorna, { unita: '€', proposto: proposto('producerFee'), aiuto: aiutoCampo('producerFee', 'Mai eleggibile.') }),
      campo('Spese generali', t, 'speseGenerali', aggiorna, { unita: '€', proposto: proposto('speseGenerali'), aiuto: aiutoCampo('speseGenerali', 'Mai eleggibili.') }),
      campo('Altre spese non eleggibili', t, 'nonEleggibili', aggiorna, { unita: '€', aiuto: 'Spese all’estero o verso soggetti non tassati in Italia, imprevisti, differimenti, spese istruttorie.' }),
      campo('Risorse estere sulla copertura', t, 'risorseEsterePct', aggiorna, { unita: '%', proposto: proposto('risorseEsterePct'), aiuto: aiutoCampo('risorseEsterePct', `Dal ${R.taxCredit.massimali.sogliaRisorseEsterePct.valore}% i tetti per opera salgono.`) }),
      campo('Crediti già riconosciuti all’impresa nell’anno', t, 'creditiAnno', aggiorna, { unita: '€', aiuto: 'Per il tetto annuo d’impresa (cinema e tv-web separati).' })));

  function aggiorna() { ctx.cambia(); abilita(); disegna(); }

  function disegna() {
    const c = calcola(ctx);
    const r = c.tc, ing = c.ingresso;
    if (!r.valido) {
      metti(svuota(risultati), h('div.panel.flat.empty', h('strong', 'Manca il costo complessivo.'), ' Inseriscilo qui sopra o nei Dati chiave.'), condizioni());
      return;
    }
    const nelPiano = F.strutturaPiano((p.dati.piano || []).filter((x) => F.normalizzaVoce(x.voce) === '1.2'), null).totale;
    const porta = async (importo) => {
      p.dati.piano = F.pianoConTaxCredit(p.dati.piano, importo);
      await salva(p);
      toast(`Tax credit di ${euro(importo)} portato nel piano finanziario (voce 1.2)`);
      ctx.cambia(); disegna();
    };
    const regoleAliquota = r.regoleAliquota;
    metti(svuota(risultati),
      h('div.panel.stack',
        h('div.fin-grande', h('span.label', 'Credito d’imposta stimato'), h('strong.num', euro(r.credito)),
          h('span.muted', `${pc(r.sulCosto)} del costo complessivo · aliquota ${r.scaglioni.length > 1 ? `per scaglioni (effettiva ${pc(r.aliquotaEffettiva)})` : `${r.aliquota}%`} sul costo eleggibile di ${euro(r.costoEleggibile)}`)),
        h('div.fin-fonti-riga', regoleAliquota.map((x) => fonte(x))),
        !r.ammessa && h('div.notice.bad', 'Questa tipologia di opera non è ammessa per l’impresa scelta: i non indipendenti accedono solo con i film.'),
        h('div.fin-dati',
          dato('Utilizzabile dopo la preventiva', euro(r.quote.dopoPreventiva), { nota: `${r.quote.preventivaPct}% del credito` }),
          dato('Dopo la definitiva', euro(r.quote.dopoDefinitiva)),
          dato('Tetto per opera', r.tettoOpera == null ? '—' : euro(r.tettoOpera), { nota: r.risorseEstere ? 'maggiorato per le risorse estere' : null }),
          dato('Tetto annuo d’impresa', r.tettoAnnuo == null ? '—' : euro(r.tettoAnnuo), { nota: r.residuoAnnuo != null ? `residuo ${euro(r.residuoAnnuo)}` : null }),
          dato('Nel piano finanziario (1.2)', euro(nelPiano), { esito: Math.abs(nelPiano - r.credito) > 1 ? 'warn' : 'ok' })),
        h('p.small.muted', 'Il credito non è denaro: si usa in compensazione con l’F24 dal giorno 15 del mese successivo al riconoscimento; si può cedere a una banca solo dopo la definitiva. ', fonte(R.taxCredit.utilizzo.modalitaDiUtilizzo)),
        h('div.row',
          bottoneConferma(`Porta nel piano finanziario (voce 1.2): ${euro(r.credito)}`, `Confermi? La voce 1.2 del dossier diventa ${euro(r.credito)}`, () => porta(r.credito), 'btn.primary'),
          r.creditoCompatibile < r.credito - 1 && bottoneConferma(`Porta il credito compatibile con il limite degli aiuti: ${euro(r.creditoCompatibile)}`, `Confermi? La voce 1.2 diventa ${euro(r.creditoCompatibile)}`, () => porta(r.creditoCompatibile), 'btn'))),
      h('div.panel.stack-s',
        titolo('Dal costo complessivo al costo eleggibile'),
        tabella(['Passaggio', { t: 'Importo', c: 'r' }, 'Regola'], [
          h('tr', h('th', { scope: 'row' }, 'Costo complessivo di produzione'), h('td.num.r', euro(r.costoComplessivo)), h('td', h('span.small.muted', ORIGINI[ing.origine.costoComplessivo] || ''))),
          ...r.detrazioni.map((d) => h('tr', h('th', { scope: 'row' }, `− ${d.etichetta}`), h('td.num.r', `− ${euro(d.importo)}`), h('td', fonte(d.regola)))),
          h('tr.fin-totale', h('th', { scope: 'row' }, '= Costo eleggibile'), h('td.num.r', euro(r.costoEleggibile)), h('td', fonte(R.taxCredit.base.base))),
        ], { didascalia: 'Calcolo del costo eleggibile' }),
        r.scaglioni.length > 1 && tabella(['Scaglione di costo eleggibile', { t: 'Aliquota', c: 'r' }, { t: 'Base', c: 'r' }, { t: 'Credito', c: 'r' }],
          r.scaglioni.map((x) => h('tr', h('td', `da ${euro(x.da)}${x.a != null ? ` a ${euro(x.a)}` : ' in su'}`), h('td.num.r', `${x.pct}%`), h('td.num.r', euro(x.base)), h('td.num.r', euro(x.credito)))), { didascalia: 'Credito per scaglioni' }),
        r.limitatoDa && h('p.small', `Il calcolo sull’aliquota darebbe ${euro(r.creditoTeorico)}: il credito è ridotto dal tetto ${r.limitatoDa === 'opera' ? 'per opera' : 'annuo d’impresa'}. `, fonte(r.limitatoDa === 'opera' ? r.regolaOpera : r.regolaAnnuo))),
      h('div.panel.stack-s', h('h2', 'Requisiti e controlli'), controlliConFonte(r.controlli)),
      condizioni());
  }

  function condizioni() {
    const tm = R.taxCredit.tempi, rq = R.taxCredit.requisiti, ob = R.taxCredit.obblighi, ut = R.taxCredit.utilizzo;
    const voce = (r, testo = null) => h('li', h('span', testo || r.descrizione), fonte(r));
    return h('div.panel.stack-s',
      titolo('Tempi e condizioni essenziali'),
      h('h3', 'Tempi'),
      h('ul.fin-regole', [
        voce(tm.preventivaNonPrimaDiGiorni, `Richiesta preventiva non prima di ${tm.preventivaNonPrimaDiGiorni.valore} giorni dall’avvio delle riprese (quattro settimane consecutive o metà delle giornate).`),
        voce(tm.rispostaDgcaGiorni, `La DGCA risponde entro ${tm.rispostaDgcaGiorni.valore} giorni dalla domanda o dalla chiusura della sessione.`),
        voce(tm.definitivaFilmEntroMesiDallaPreventiva, `Film: richiesta definitiva entro ${tm.definitivaFilmEntroMesiDallaPreventiva.valore} mesi dalla preventiva e non oltre ${tm.definitivaFilmEntroGiorni.valore} giorni dalla classificazione o dalla prima diffusione.`),
        voce(tm.definitivaTvWebEntroMesiDallaPreventiva, `Tv e web: definitiva entro ${tm.definitivaTvWebEntroMesiDallaPreventiva.valore} mesi dalla preventiva.`),
        voce(tm.animazioneMesiAggiuntivi, `Animazione: ${tm.animazioneMesiAggiuntivi.valore} mesi in più sui termini della definitiva.`),
        voce(tm.sessione2026, 'Sessione 2026: dal 30 settembre al 14 ottobre 2026, ora chiusa.'),
        voce(tm.prossimaSessione, 'Prossima sessione (2027): date non ancora pubblicate.'),
        voce(R.taxCredit.quadro.tettoDiSpesa, 'I crediti sono riconosciuti entro il tetto di spesa annuo, in ordine di data di avvio delle riprese: chi resta fuori non riceve una quota ridotta.'),
      ]),
      h('h3', 'Condizioni'),
      h('ul.fin-regole', [
        voce(rq.capitaleSocialeEPatrimonioNettoMin, `Società di capitali con capitale versato e patrimonio netto di almeno ${euro(rq.capitaleSocialeEPatrimonioNettoMin.valore)} (${euro(rq.capitaleSocialeEPatrimonioNettoMinCortometraggi.valore)} per i corti).`),
        voce(rq.eleggibilitaCulturalePunteggioMinimo, `Nazionalità italiana e almeno ${rq.eleggibilitaCulturalePunteggioMinimo.valore} punti su 100 nel test di eleggibilità culturale.`),
        voce(rq.coperturaFinanziariaMinimaPct, `Copertura finanziaria minima senza il credito: film ${rq.coperturaFinanziariaMinimaPct.valore.film}%, tv e web ${rq.coperturaFinanziariaMinimaPct.valore.tvWeb}%, documentari, animazione e corti ${rq.coperturaFinanziariaMinimaPct.valore.documentari}%.`),
        voce(rq.partecipazioneMinimaDelProduttore),
        voce(rq.filmAccordoDistribuzione, `Film: accordo di distribuzione con almeno ${euro(rq.filmAccordoDistribuzione.valore.costoOltreSoglia.investimentoPromozioneMinEuro)} di promozione e ${rq.filmAccordoDistribuzione.valore.costoOltreSoglia.proiezioniMin} proiezioni in ${rq.filmAccordoDistribuzione.valore.costoOltreSoglia.saleMin} sale oltre 3,5 milioni di costo; ${euro(rq.filmAccordoDistribuzione.valore.costoFinoASoglia.investimentoPromozioneMinEuro)}, ${rq.filmAccordoDistribuzione.valore.costoFinoASoglia.proiezioniMin} proiezioni e ${rq.filmAccordoDistribuzione.valore.costoFinoASoglia.saleMin} sale fino a 3,5 milioni.`),
        voce(rq.polizzaCatastrofale),
        voce(rq.speseIstruttorieEuro, 'Contributo per le spese istruttorie da versare con la domanda (da 200 a 10.000 euro secondo tipologia e costo), non restituito se la domanda non va a buon fine.'),
        voce(ut.cedibile),
        voce(ob.reinvestimentoEntroAnni),
        voce(ob.certificazioneDeiCosti),
        voce(b.tettoCompensoSingoloSoggetto),
      ]));
  }

  metti(area, ingressi, risultati);
  abilita();
  disegna();
}

/* ------------------------------------------------------------------ 4. cassa */

const MOMENTI = [{ id: 'inizio', nome: 'Inizio preparazione' }, { id: 'riprese', nome: 'Inizio riprese' }, { id: 'fine_riprese', nome: 'Fine riprese' }, { id: 'consegna', nome: 'Consegna' }];
const ORIGINE_CAL = { giorni: 'dai giorni dei Dati chiave', modulo3: 'dalle date del Modulo III', partenza: 'ipotesi di partenza: correggila', oggi: 'dal mese prossimo' };
const breve = (n) => { const a = Math.abs(n); return `${n < 0 ? '−' : ''}${a >= 1e6 ? `${fmt(a / 1e6, 1)} M` : a >= 1e3 ? `${fmt(a / 1e3, 0)} k` : fmt(a, 0)}`; };

function graficoCassa(cassa) {
  const m = cassa.mesi;
  if (!m.length) return null;
  const L = 64, Rm = 16, T = 18, B = 40, passo = Math.max(26, Math.min(56, 760 / m.length)), W = L + Rm + passo * m.length, H = 280;
  const valori = m.flatMap((x) => [x.entrate, -x.uscite, x.cumulato]);
  let max = Math.max(0, ...valori), min = Math.min(0, ...valori);
  if (max === min) max = 1;
  const pad = (max - min) * 0.06; max += pad; min -= max > 0 && min < 0 ? pad : 0;
  const y = (v) => T + ((max - v) / (max - min)) * (H - T - B);
  const x = (i) => L + passo * i + passo / 2;
  const tacche = Array.from({ length: 5 }, (_, k) => min + ((max - min) * k) / 4);
  const ogni = Math.ceil(m.length / Math.floor((W - L) / 54));
  const id = `fin-graf-${++progressivo}`;
  const linea = m.map((r, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(r.cumulato).toFixed(1)}`).join(' ');
  const punta = cassa.punta.indice;
  const descr = `Uscite ${euro(cassa.totali.uscite)} e entrate ${euro(cassa.totali.entrate)} su ${m.length} mesi${cassa.punta.importo > 0 ? `; punta di fabbisogno ${euro(cassa.punta.importo)} a ${cassa.punta.mese}` : '; il saldo cumulato non va mai sotto zero'}. I valori mese per mese sono nella tabella sotto il grafico.`;
  return h('div.fin-grafico',
    s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-labelledby': `${id}-t ${id}-d`, class: 'fin-svg' },
      s('title', { id: `${id}-t` }, 'Piano di cassa mensile'), s('desc', { id: `${id}-d` }, descr),
      tacche.map((v) => s('g', null, s('line', { x1: L, x2: W - Rm, y1: y(v), y2: y(v), class: 'fin-griglia' }), s('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'fin-asse' }, breve(v)))),
      s('line', { x1: L, x2: W - Rm, y1: y(0), y2: y(0), class: 'fin-zero' }),
      m.map((r, i) => s('g', null,
        r.entrate > 0 && s('rect', { x: x(i) - passo * 0.36, width: passo * 0.34, y: y(r.entrate), height: Math.max(0.5, y(0) - y(r.entrate)), class: 'fin-entrate', rx: 2 }, s('title', null, `${r.etichetta}: entrate ${euro(r.entrate)}`)),
        r.uscite > 0 && s('rect', { x: x(i) + passo * 0.02, width: passo * 0.34, y: y(0), height: Math.max(0.5, y(-r.uscite) - y(0)), class: 'fin-uscite', rx: 2 }, s('title', null, `${r.etichetta}: uscite ${euro(r.uscite)}`)),
        i % ogni === 0 && s('text', { x: x(i), y: H - B + 16, 'text-anchor': 'middle', class: 'fin-asse' }, r.etichetta.replace(/ (\d{2})(\d{2})$/, ' $2')))),
      s('path', { d: linea, class: 'fin-linea', fill: 'none' }),
      m.map((r, i) => s('circle', { cx: x(i), cy: y(r.cumulato), r: i === punta ? 5 : 2.6, class: i === punta ? 'fin-punto punta' : 'fin-punto' }, s('title', null, `${r.etichetta}: saldo cumulato ${euro(r.cumulato)}`))),
      punta != null && s('text', { x: x(punta) > W - 140 ? x(punta) - 10 : x(punta) + 10, y: Math.min(H - B - 6, y(m[punta].cumulato) + 4), 'text-anchor': x(punta) > W - 140 ? 'end' : 'start', class: 'fin-etichetta-punta' }, `punta ${breve(-cassa.punta.importo)} €`)),
    h('ul.fin-legenda.compatta', { 'aria-hidden': 'true' },
      h('li', h('i.fin-l-entrate'), 'Entrate'), h('li', h('i.fin-l-uscite'), 'Uscite'), h('li', h('i.fin-l-linea'), 'Saldo cumulato')));
}

function vistaCassa(area, ctx) {
  const { p, f } = ctx;
  const cs = f.cassa;
  const risultati = h('div.stack');
  const c0 = calcola(ctx);
  const ip0 = c0.cassa.ipotesi;
  const costi = R.erogazione.costi;
  const idInizio = nuovoIdCampo('inizio');

  const calendario = [
    titolo('Calendario', `Durate ${ORIGINE_CAL[ip0.proposto.origine.prep]}; inizio ${ORIGINE_CAL[ip0.proposto.origine.inizio]}. I campi vuoti usano la proposta, in grigio.`),
    h('div.grid',
      h('label.field', { for: idInizio }, h('span', 'Mese di inizio della preparazione'),
        h('input', { id: idInizio, type: 'month', value: cs.inizio || ip0.calendario.inizio || '', onchange: (e) => { cs.inizio = e.target.value; aggiorna(); } })),
      campo('Preparazione', cs.mesi, 'prep', aggiorna, { unita: 'mesi', proposto: ip0.proposto.mesi.prep, step: '1' }),
      campo('Riprese', cs.mesi, 'riprese', aggiorna, { unita: 'mesi', proposto: ip0.proposto.mesi.riprese, step: '1' }),
      campo('Post-produzione', cs.mesi, 'post', aggiorna, { unita: 'mesi', proposto: ip0.proposto.mesi.post, step: '1' })),
    h('p.small.muted', `Dai giorni ai mesi: ${F.GIORNI_LAVORATIVI_MESE} giorni di lavorazione per mese. La consegna è il mese dopo la fine della post-produzione.`)];

  const usciteBox = h('div.stack-s');
  const disegnaUscite = () => {
    const ip = calcola(ctx).cassa.ipotesi;
    metti(svuota(usciteBox),
      scelta('Come distribuire le uscite', [{ id: 'curva', nome: 'Curva per fase (percentuali del costo)' }, { id: 'preventivo', nome: c0.prev ? 'Dai gruppi di voci del preventivo' : 'Dai gruppi di voci del preventivo (serve il preventivo)' }],
        cs.modoUscite === 'preventivo' && c0.prev ? 'preventivo' : 'curva', (v) => { cs.modoUscite = v; ctx.cambia(); disegnaUscite(); disegna(); }),
      cs.modoUscite === 'preventivo' && c0.prev
        ? h('details.more', h('summary', `Curva dal preventivo: preparazione ${pc(ip.curva.prep)}, riprese ${pc(ip.curva.riprese)}, post ${pc(ip.curva.post)} — modifica i pesi per gruppo`),
          tabella(['Gruppo di voci', { t: 'Importo', c: 'r' }, 'Preparazione %', 'Riprese %', 'Post %'], c0.prev.gruppi.filter((g) => g.importo > 0).map((g) => {
            cs.pesi[g.id] = cs.pesi[g.id] || {};
            const peso = (fase) => h('td', h('input', { type: 'number', min: '0', step: 'any', inputmode: 'decimal', value: cs.pesi[g.id][fase] ?? '', placeholder: String(F.PESI_GRUPPI[g.id][fase]), 'aria-label': `${g.nome}: peso in ${F.NOMI_FASI[fase].toLowerCase()}`, oninput: (e) => { const v = e.target.value.trim(); if (v === '') delete cs.pesi[g.id][fase]; else cs.pesi[g.id][fase] = Number(v); ctx.cambia(); disegna(); } }));
            return h('tr', h('td', g.nome), h('td.num.r', euro(g.importo)), peso('prep'), peso('riprese'), peso('post'));
          }), { didascalia: 'Pesi delle fasi per gruppo di voci del preventivo' }))
        : h('div.grid',
          ['prep', 'riprese', 'post'].map((fase) => campo(F.NOMI_FASI[fase], cs.curva, fase, () => { ctx.cambia(); disegna(); }, { unita: '% del costo', proposto: F.CURVA_USCITE[fase] }))),
      h('p.small.muted', 'Ipotesi di partenza del programma, non una norma: la quota di ogni fase è divisa in parti uguali sui suoi mesi; se le percentuali non fanno 100 si riproporzionano.'));
  };

  // entrate per fonte
  const chiavi = F.chiaviRighe(p.dati.piano);
  const fonti = (p.dati.piano || []).map((r, i) => ({ r, chiave: chiavi[i] })).filter((x) => num(x.r.importo) > 0);
  const entrate = fonti.length ? tabella(['Voce', 'Fonte', { t: 'Importo', c: 'r' }, 'Quando entra in cassa', 'Mesi di ritardo'], fonti.map(({ r, chiave }) => {
    const proposta = F.tempisticaProposta(r.voce);
    const attuale = () => ({ ...proposta, ...(cs.tempi[chiave] || {}) });
    const imposta = (patch) => { cs.tempi[chiave] = { ...attuale(), ...patch }; ctx.cambia(); disegna(); };
    const rit = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', value: attuale().ritardo ?? 0, 'aria-label': `${r.voce}: mesi di ritardo`, disabled: !F.TEMPISTICHE.find((x) => x.id === attuale().tipo)?.ritardo, oninput: (e) => imposta({ ritardo: Math.max(0, Number(e.target.value) || 0) }) });
    const sel = scelta(null, F.TEMPISTICHE, attuale().tipo, (v) => { imposta({ tipo: v }); rit.disabled = !F.TEMPISTICHE.find((x) => x.id === v)?.ritardo; }, { id: nuovoIdCampo('temp') });
    sel.setAttribute('aria-label', `${r.voce} ${r.etichetta || ''}: quando entra in cassa`);
    return h('tr', h('td.num', F.normalizzaVoce(r.voce)), h('td', r.etichetta || '—', r.denominazione && h('div.small.muted', r.denominazione)), h('td.num.r', euro(r.importo)), h('td', sel), h('td', rit));
  }), { didascalia: 'Tempistica di incasso di ciascuna fonte' }) : h('p.muted', 'Il piano finanziario è vuoto: aggiungi le fonti nei Dati chiave per vedere le entrate.');

  // quote del contributo del bando
  const quoteBox = h('div.stack-s');
  const disegnaQuote = () => {
    const ip = calcola(ctx).cassa.ipotesi;
    const proprie = Array.isArray(cs.quote);
    const q = ip.quote;
    const totale = q.reduce((a, x) => a + (num(x.pct) || 0), 0);
    const modifica = (i, patch) => { if (!Array.isArray(cs.quote)) cs.quote = q.map((x) => ({ ...x })); Object.assign(cs.quote[i], patch); ctx.cambia(); disegna(); aggiornaTotale(); };
    const totaleEl = h('p.small');
    const aggiornaTotale = () => { const tot = (cs.quote || q).reduce((a, x) => a + (num(x.pct) || 0), 0); metti(svuota(totaleEl), Math.abs(tot - 100) > 0.01 ? h('span.fin-warn-testo', `Le quote fanno ${fmt(tot, 2)}%: il resto del contributo non entra in cassa.`) : h('span.muted', 'Le quote fanno 100%.')); };
    metti(svuota(quoteBox),
      h('p.small.muted', ip.quoteBando.origine === 'bando' ? 'Quote proposte dalle modalità di erogazione del bando; i momenti e i ritardi sono ipotesi di calendario da adattare.' : 'Il bando non indica quote complete: tutto a saldo. Inserisci l’anticipo se previsto.'),
      tabella(['Quota', { t: '% del contributo', c: 'r' }, 'Dopo', 'Mesi di ritardo'], q.map((x, i) => {
        const sel = scelta(null, MOMENTI, x.momento, (v) => modifica(i, { momento: v }), { id: nuovoIdCampo('mom') });
        sel.setAttribute('aria-label', `${x.nome}: momento`);
        return h('tr', h('td', h('div', x.nome), x.condizione && h('details.fin-cond', h('summary.small', 'condizione'), h('p.small.muted', x.condizione))),
          h('td', h('input.num', { type: 'number', min: '0', max: '100', step: 'any', value: x.pct, 'aria-label': `${x.nome}: percentuale`, oninput: (e) => modifica(i, { pct: Math.max(0, Number(e.target.value) || 0) }) })),
          h('td', sel),
          h('td', h('input', { type: 'number', min: '0', step: '1', value: x.ritardo, 'aria-label': `${x.nome}: mesi di ritardo`, oninput: (e) => modifica(i, { ritardo: Math.max(0, Number(e.target.value) || 0) }) })));
      }), { didascalia: 'Quote di erogazione del contributo del bando' }),
      totaleEl,
      proprie && h('div', h('button.btn.s.ghost', { type: 'button', onclick: () => { cs.quote = null; ctx.cambia(); disegnaQuote(); disegna(); } }, 'Ripristina le quote proposte')));
    aggiornaTotale();
  };

  const taxCreditBox = h('div.grid',
    campo('Quota del credito usata dopo la preventiva', cs.taxCredit, 'primaPct', () => { ctx.cambia(); disegna(); }, { unita: '%', proposto: ip0.taxCredit.primaPct }),
    campo('Mesi dall’inizio riprese alla prima quota', cs.taxCredit, 'ritardoPrima', () => { ctx.cambia(); disegna(); }, { unita: 'mesi', proposto: F.TAX_CREDIT_CASSA.ritardoPrima, step: '1' }),
    campo('Mesi dalla consegna al saldo', cs.taxCredit, 'ritardoSaldo', () => { ctx.cambia(); disegna(); }, { unita: 'mesi', proposto: F.TAX_CREDIT_CASSA.ritardoSaldo, step: '1' }),
    campo('Mesi per assorbire ogni quota in F24', cs.taxCredit, 'assorbimento', () => { ctx.cambia(); disegna(); }, { unita: 'mesi', proposto: F.TAX_CREDIT_CASSA.assorbimento, step: '1' }));

  const ponteBox = h('div.stack-s',
    h('div.grid',
      campo('Tasso annuo del finanziamento ponte', cs, 'tasso', () => { ctx.cambia(); disegna(); }, { unita: '%', proposto: medio(costi.finanziamentoPonteTassoAnnuoPct), aiuto: `Intervallo indicativo ${intervallo(costi.finanziamentoPonteTassoAnnuoPct)}.` }),
      campo('Commissioni sulla punta di fabbisogno', cs, 'commissione', () => { ctx.cambia(); disegna(); }, { unita: '%', proposto: medio(costi.finanziamentoPonteSpeseIstruttoriaPct), aiuto: `Intervallo indicativo ${intervallo(costi.finanziamentoPonteSpeseIstruttoriaPct)}.` })),
    h('div.fin-fonti-riga', fonte(costi.finanziamentoPonteTassoAnnuoPct), fonte(costi.finanziamentoPonteQuotaAnticipabilePct)));

  const ipotesi = h('div.panel.stack',
    calendario,
    h('h3', 'Uscite'), usciteBox,
    h('h3', 'Entrate per fonte'), entrate,
    h('h3', 'Quote del contributo del bando (voce 1.1)'), quoteBox,
    h('h3', 'Tax credit (voce 1.2)'), h('p.small.muted', 'Il credito non arriva in banca: riduce le imposte e i contributi da versare. Qui si conta come entrata nei mesi in cui lo si usa in compensazione. ', fonte(R.taxCredit.utilizzo.quotaUtilizzabileDopoPreventivaPct)), taxCreditBox,
    h('h3', 'Finanziamento ponte'), ponteBox);

  function aggiorna() { ctx.cambia(); disegnaUscite(); disegna(); }

  function disegna() {
    const c = calcola(ctx);
    const k = c.cassa, ip = k.ipotesi;
    const conAnticipo = ip.quote.some((x) => x.anticipo && x.pct > 0) && (p.dati.piano || []).some((r) => F.normalizzaVoce(r.voce) === '1.1' && r.importo > 0);
    const senza = conAnticipo ? F.pianoDiCassa({ costo: c.costo, piano: p.dati.piano, calendario: ip.calendario, curva: ip.curva, tempi: f.cassa.tempi, quote: F.quoteSenzaAnticipo(ip.quote), taxCredit: ip.taxCredit, tasso: ip.tasso, commissione: ip.commissione }) : null;
    if (!(c.costo > 0)) {
      metti(svuota(risultati), h('div.panel.flat.empty', h('strong', 'Manca il costo di produzione.'), ' Inseriscilo nei Dati chiave: le uscite si distribuiscono a partire da lì.'));
      return;
    }
    metti(svuota(risultati),
      h('div.panel.stack',
        titolo('Saldo mese per mese', `${k.calendario.inizio ? `Da ${F.etichettaMese(k.calendario.inizio)} ` : ''}per ${k.mesi.length} mesi: ${k.calendario.mesi.prep} di preparazione, ${k.calendario.mesi.riprese} di riprese, ${k.calendario.mesi.post} di post-produzione e i mesi degli ultimi incassi.`),
        h('div.fin-dati',
          dato('Punta massima di fabbisogno', k.punta.importo > 0 ? euro(k.punta.importo) : 'nessuna', { nota: k.punta.mese, esito: k.punta.importo > 0 ? 'warn' : 'ok', grande: true }),
          dato('Primo mese in rosso', k.primoRosso || '—', { nota: k.mesiInRosso ? `${k.mesiInRosso} mesi con saldo cumulato negativo` : null }),
          dato('Costo del finanziamento ponte', euro(k.ponte.costo), { nota: `${pc(k.ponte.sulCosto, 2)} del costo · interessi ${euro(k.ponte.interessi)} + commissioni ${euro(k.ponte.commissione)}` }),
          dato('Saldo finale', euro(k.totali.saldo), { nota: k.nonIncassato > 1 ? `${euro(k.nonIncassato)} di fonti non entrano in cassa` : 'tutte le fonti incassate', esito: k.totali.saldo < -1 ? 'bad' : null })),
        senza && h('p.small', `Senza l’anticipo del bando la punta sarebbe ${euro(senza.punta.importo)}${senza.punta.mese ? ` (${senza.punta.mese})` : ''} e il ponte costerebbe ${euro(senza.ponte.costo)}. L’anticipo di solito richiede una fideiussione: costo indicativo ${intervallo(costi.fideiussionePremioAnnuoPct)} l’anno dell’importo garantito. `, fonte(costi.fideiussionePremioAnnuoPct, { soloAvviso: true })),
        h('p.small.muted', 'Interessi = somma, mese per mese, del saldo cumulato negativo × tasso annuo ÷ 12; commissioni = percentuale × punta di fabbisogno.'),
        graficoCassa(k),
        h('div.row', h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`piano di cassa ${p.dati.titolo || p.nome}`, 'csv'), F.csvCassa(k), 'text/csv;charset=utf-8') }, 'Scarica il piano di cassa (CSV)'))),
      h('div.panel.stack-s', h('h2', 'Tabella mensile'),
        tabella(['Mese', 'Fase', { t: 'Uscite', c: 'r' }, { t: 'Entrate', c: 'r' }, { t: 'Saldo del mese', c: 'r' }, { t: 'Saldo cumulato', c: 'r' }, { t: 'Interessi', c: 'r' }],
          [...k.mesi.map((m) => h(`tr${m.indice === k.punta.indice ? '.fin-punta' : ''}`, h('th', { scope: 'row' }, m.etichetta), h('td', F.NOMI_FASI[m.fase]), h('td.num.r', euro(m.uscite)), h('td.num.r', euro(m.entrate)), h('td.num.r', euro(m.saldo)), h(`td.num.r${m.cumulato < -0.5 ? '.fin-bad' : ''}`, euro(m.cumulato)), h('td.num.r', euro(m.interessi)))),
            h('tr.fin-totale', h('th', { scope: 'row' }, 'Totale'), h('td', ''), h('td.num.r', euro(k.totali.uscite)), h('td.num.r', euro(k.totali.entrate)), h('td.num.r', euro(k.totali.saldo)), h('td', ''), h('td.num.r', euro(k.ponte.interessi)))],
          { classe: 'fin-mesi', didascalia: 'Piano di cassa mese per mese' })));
  }

  metti(area, risultati, ipotesi);
  disegnaUscite();
  disegnaQuote();
  disegna();
}

/* ------------------------------------------------------------------ 5. recupero */

function vistaRecupero(area, ctx) {
  const { p, f } = ctx;
  const rc = f.recupero;
  const risultati = h('div.stack');
  const rr = R.recupero;
  const dalPiano = F.recuperoDalPiano(p.dati.piano);
  const aggiorna = () => { ctx.cambia(); disegna(); };

  const condizioni = h('div.panel.stack',
    titolo('Condizioni', 'Le percentuali di partenza sono il punto medio degli intervalli di prassi trovati dalla ricerca: valori indicativi di mercato, da sostituire con quelli dei contratti. Gli importi vengono dal piano finanziario dove possibile.'),
    h('div.grid.w',
      campo('Quota di noleggio al distributore', rc, 'quotaNoleggioPct', aggiorna, { unita: '% dell’incasso di sala', proposto: F.CONDIZIONI_RECUPERO.quotaNoleggioPct.valore, aiuto: h('span', `Indicativo ${intervallo(rr.quotaNoleggioSuIncassoNettoPct)}. `, fonte(rr.quotaNoleggioSuIncassoNettoPct, { soloAvviso: true })) }),
      campo('Commissione di distribuzione in sala', rc, 'commissioneSalaPct', aggiorna, { unita: '% del noleggio', proposto: F.CONDIZIONI_RECUPERO.commissioneSalaPct.valore, aiuto: h('span', `Indicativo ${intervallo(rr.commissioneDistribuzioneSalaPct)}. `, fonte(rr.commissioneDistribuzioneSalaPct, { soloAvviso: true })) }),
      campo('Commissione su tv, piattaforme, estero, home video', rc, 'commissioneVenditePct', aggiorna, { unita: '% dei ricavi', proposto: F.CONDIZIONI_RECUPERO.commissioneVenditePct.valore, aiuto: h('span', `Indicativo ${intervallo(rr.commissioneVenditeEstereETvPct)}. `, fonte(rr.commissioneVenditeEstereETvPct, { soloAvviso: true })) }),
      campo('Spese di lancio anticipate dal distributore', rc, 'speseLancio', aggiorna, { unita: '€', proposto: 0, aiuto: `Il tax credit chiede almeno ${euro(R.taxCredit.requisiti.filmAccordoDistribuzione.valore.costoFinoASoglia.investimentoPromozioneMinEuro)} di promozione per i film fino a 3,5 milioni.` }),
      campo('Minimo garantito da recuperare', rc, 'minimoGarantito', aggiorna, { unita: '€', proposto: dalPiano.minimoGarantito, aiuto: 'Proposto dalle voci 7.x e 8.x del piano.' }),
      campo('Banche e finanziatori da rimborsare', rc, 'debiti', aggiorna, { unita: '€', proposto: 0, aiuto: 'Finanziamento ponte o gap non coperto da contributi.' }),
      campo('Capitale degli investitori', rc, 'investitori', aggiorna, { unita: '€', proposto: dalPiano.investitori, aiuto: 'Proposto dalla voce 4.1 del piano.' }),
      campo('Premio agli investitori', rc, 'premioPct', aggiorna, { unita: '% del capitale', proposto: F.CONDIZIONI_RECUPERO.premioPct.valore, aiuto: h('span', `Indicativo ${intervallo(rr.premioInvestitoriPct)}. `, fonte(rr.premioInvestitoriPct, { soloAvviso: true })) }),
      campo('Compensi differiti', rc, 'differiti', aggiorna, { unita: '€', proposto: dalPiano.differiti, aiuto: 'Proposto dalla voce 2.6 del piano.' }),
      campo('Quota del produttore sul residuo', rc, 'quotaProduttorePct', aggiorna, { unita: '%', proposto: 100, aiuto: 'Il resto va ai coproduttori.' }),
      campo('Investimento del produttore da recuperare', rc, 'daRecuperare', aggiorna, { unita: '€', proposto: dalPiano.daRecuperare, aiuto: 'Proposto dall’apporto societario diretto (voce 2.1).' })));

  const ricavi = h('div.panel.stack-s',
    titolo('Incassi stimati per canale', 'Oltre le prevendite e i minimi già nel piano. La ricerca non ha trovato valori di riferimento affidabili per i ricavi: inseriscili tu, per ciascuno dei tre scenari.'),
    tabella(['Canale', ...F.SCENARI_RICAVO.map((x) => ({ t: `${x.nome} (€)`, c: 'r' }))], F.CANALI_RICAVO.map((canale) => h('tr',
      h('th', { scope: 'row' }, h('div', canale.nome), h('div.small.muted', canale.nota)),
      F.SCENARI_RICAVO.map((sc) => h('td', h('input.num', { type: 'number', min: '0', step: 'any', inputmode: 'decimal', value: rc.ricavi[sc.id]?.[canale.id] ?? '', 'aria-label': `${canale.nome}, scenario ${sc.nome.toLowerCase()}, in euro`, oninput: (e) => { const v = e.target.value.trim(); rc.ricavi[sc.id][canale.id] = v === '' ? null : Math.max(0, Number(v)); aggiorna(); } }))))), { classe: 'fin-ricavi', didascalia: 'Incassi stimati per canale e scenario' }));

  function disegna() {
    const r = F.scenariRecupero(rc.ricavi, rc, p.dati.piano);
    const vuoti = r.scenari.every((x) => x.lordo === 0);
    const cella = (x, k) => h('td.num.r', x.passi.find((y) => y.id === k).importo ? `${x.passi.find((y) => y.id === k).segno < 0 ? '− ' : ''}${euro(x.passi.find((y) => y.id === k).importo)}` : '—');
    metti(svuota(risultati),
      vuoti ? h('div.notice.info', h('strong', 'Inserisci gli incassi stimati. '), 'Con almeno un canale compilato compaiono la cascata di recupero, la quota del produttore e il punto di pareggio per ciascuno scenario.')
        : h('div.panel.stack',
          titolo('Risultato per scenario', `Il produttore deve recuperare ${euro(r.condizioni.daRecuperare)}. Gli aiuti pubblici a fondo perduto non entrano nella cascata.`),
          h('div.fin-scenari', r.scenari.map((x) => h(`div.fin-scen.${x.lordo === 0 ? 'vuoto' : x.inPareggio ? 'ok' : 'bad'}`,
            h('div.spread', h('h3', x.nome), x.lordo > 0 && h(`span.tag.${x.inPareggio ? 'ok' : 'bad'}`, x.inPareggio ? 'in pareggio' : 'sotto il pareggio')),
            h('div.fin-dati.stretti',
              dato('Ricavi lordi', euro(x.lordo)),
              dato('Al produttore', euro(x.produttore)),
              dato('Risultato', x.lordo ? `${x.risultato > 0 ? '+' : ''}${euro(x.risultato)}` : '—', { esito: x.lordo ? (x.risultato >= 0 ? 'ok' : 'bad') : null }),
              dato('Pareggio a ricavi lordi di', x.pareggio ? euro(x.pareggio.lordo) : '—', { nota: x.pareggio ? (x.pareggio.fattore ? `${fmt(x.pareggio.fattore, 2)} volte lo scenario` : 'già coperto') : x.lordo ? 'irraggiungibile con queste condizioni' : null })))))),
      !vuoti && h('div.panel.stack-s',
        titolo('Cascata di recupero', 'Ordine tipico per un film italiano con distribuzione in sala: ogni passaggio si paga solo con ciò che resta dal precedente.'),
        tabella(['Passaggio', ...F.SCENARI_RICAVO.map((x) => ({ t: x.nome, c: 'r' }))],
          ['lordo', 'esercenti', 'commissioni', 'lancio', 'mg', 'debiti', 'investitori', 'differiti', 'coproduttori', 'produttore'].map((k) => h(`tr${k === 'produttore' ? '.fin-totale' : ''}`, h('th', { scope: 'row' }, r.scenari[0].passi.find((y) => y.id === k).etichetta), r.scenari.map((x) => cella(x, k)))),
          { didascalia: 'Cascata di recupero dei ricavi per scenario' }),
        h('p.small.muted', 'I ricavi di tutti i canali si sommano su un unico conto: è l’ipotesi più prudente per il produttore. ', fonte(rr.ordineTipico))),
      null);
  }

  const daSapere = h('div.panel.stack-s', h('h2', 'Da sapere'),
    h('ul.fin-regole', [rr.aiutiPubbliciNonRimborsabili, rr.obbligoReinvestimentoTaxCredit, rr.minimoGarantito, rr.contributiAutomaticiDaiRisultati].map((x) => h('li', h('span', x.descrizione), x.nota && h('span.small.muted', ` ${x.nota}`), fonte(x)))));
  metti(area, risultati, ricavi, condizioni, daSapere);
  disegna();
}

/* ------------------------------------------------------------------ 6. indicatori */

function vistaIndicatori(area, ctx) {
  const c = calcola(ctx);
  const lista = F.indicatori({ dati: ctx.p.dati, bando: ctx.bando, preventivo: c.prev, limiteAiutiPct: c.limite.pct });
  const gruppi = [...new Set(lista.map((x) => x.gruppo))];
  const valore = (x) => (x.valore == null ? '—' : x.unita === 'euro' ? euro(x.valore) : pc(x.valore));
  metti(area,
    h('p.muted', 'Ogni indicatore riporta la formula e i numeri usati. I valori vengono dai Dati chiave, dal piano finanziario e, se c’è, dal preventivo.'),
    gruppi.map((g) => h('div.panel.stack-s', h('h2', g),
      h('ul.fin-indicatori', lista.filter((x) => x.gruppo === g).map((x) => h(`li.${TAG_ESITO[x.esito] || 'neutro'}`,
        h('div.fin-ind-testa', h('span.fin-ind-nome', x.nome), h('strong.num', valore(x)), x.esito !== 'info' && x.valore != null && h(`span.tag.${TAG_ESITO[x.esito]}`, ETICHETTE_ESITO[x.esito] || '')),
        h('div.small', h('span.muted', 'Formula: '), x.formula),
        x.valore != null && x.conti && h('div.small.num', h('span.muted', 'Conti: '), x.conti),
        x.valore == null && x.manca && h('div.small.fin-warn-testo', x.manca),
        x.riferimento && h('div.small', h('span.muted', 'Confronto: '), x.riferimento.etichetta, x.riferimento.regola ? [' ', fonte(x.riferimento.regola)] : null)))))));
}
