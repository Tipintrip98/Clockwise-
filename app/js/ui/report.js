// Report: esito, sezioni e criteri, ammissibilità, piano di miglioramento, esportazione.
import { h, metti, svuota, fmt, euro, toast, elencoControlli } from './dom.js';
import { S, risultatoDi, salvaPresto, nomeModello, aggiungiConoscenza } from './app.js';
import { quadrante, barreSezioni } from './grafici.js';
import { getCategoria, getGriglia, elencoCriteri, verificheAmmissibilita, suggerimentiQuantitativi, stimaContributo, statisticheEsiti, posizioneEsiti, r1 } from '../core/scoring.js';

const TITOLI = {
  ammissibile: 'Sopra tutte le soglie',
  a_rischio: 'Ammissibile, con margine ridotto',
  sotto_soglia: 'Sotto soglia: così non è finanziabile',
  parziale: 'Stima parziale',
};

function spiegazione(ris, p) {
  if (ris.esito === 'parziale') {
    const mancano = ris.sezioni.reduce((a, s) => a + s.daValutare, 0);
    return `Finora sono assegnati ${fmt(ris.totale)} punti; ne restano ${fmt(mancano)} da valutare con la lettura dei documenti${p.valutazione ? ' (sezioni senza documenti o letture non riuscite)' : ': avvia la valutazione'}.`;
  }
  if (ris.esito === 'ammissibile') return `Punteggio stimato ${fmt(ris.totale)} su ${ris.massimo}, con ogni sezione sopra il minimo. Anche nella lettura più severa (${fmt(ris.min)}) il dossier resta ammissibile.`;
  if (ris.esito === 'a_rischio') return `La media dei commissari supera le soglie, ma nella lettura più severa (${fmt(ris.min)}) il totale o una sezione scendono sotto il minimo. Basta poco per restare fuori.`;
  return ris.motivi.join(' ');
}

// Interventi ordinati per punti recuperabili: prima i blocchi di ammissibilità, poi numeri e contenuti.
function pianoMiglioramento(p, bando, ris, controlli) {
  const voci = [];
  for (const c of controlli.filter((x) => x.esito === 'critico')) voci.push({ tipo: 'blocco', testo: `${c.titolo}: ${c.dettaglio}`, dove: 'Ammissibilità' });
  for (const c of (p.valutazione?.verifica?.controlli || []).filter((x) => x.esito === 'critico')) voci.push({ tipo: 'blocco', testo: `${c.titolo}: ${c.azione || c.dettaglio}`, dove: 'Verifica formale' });
  for (const s of suggerimentiQuantitativi(bando, p.categoriaId, p.dati)) voci.push({ tipo: 'punti', testo: s.azione, punti: s.guadagno, dove: `${s.criterio} · ${s.nome}` });
  for (const sez of ris.sezioni) for (const c of sez.criteri) {
    const proposte = c.giudizi.flatMap((g) => (g.miglioramenti || []).map((m) => ({ ...m, chi: g.commissario })));
    const margine = c.massimo - (c.punti ?? 0);
    proposte.sort((a, b) => b.punti - a.punti);
    const viste = new Set();
    for (const m of proposte) {
      const chiave = m.azione.toLowerCase().slice(0, 40);
      if (viste.has(chiave) || viste.size >= 2) continue;
      viste.add(chiave);
      voci.push({ tipo: 'punti', testo: m.azione, punti: Math.min(Math.max(m.punti, 0), margine), dove: `${c.id} · ${c.nome} — ${m.chi}` });
    }
  }
  const blocchi = voci.filter((v) => v.tipo === 'blocco');
  const punti = voci.filter((v) => v.tipo === 'punti' && v.punti > 0).sort((a, b) => b.punti - a.punti).slice(0, 12);
  return { blocchi, punti };
}

function schedaCriterio(c, def) {
  const forbice = c.min != null && c.max != null && c.max - c.min >= 0.1;
  const corpo = [];
  if (def.descrizione) corpo.push(h('p.muted.small', def.descrizione));
  if (c.fonte === 'calcolo' || c.fonte === 'dichiarato') {
    corpo.push(c.mancante ? h('div.notice.warn', 'Dato mancante: compila i Dati chiave.')
      : h('div', h('strong', c.valoreTesto), c.dettaglio ? ` (${c.dettaglio})` : '', ' → fascia “', c.fascia, '”', h('div.muted.small', `Calcolo: ${c.formula}.`)));
  }
  if (c.fonte === 'non_valutato') corpo.push(h('div.notice', 'Non ancora valutato: serve la lettura dei documenti da parte di Claude (scheda Valutazione).'));
  for (const a of c.avvisi || []) corpo.push(h('div.notice.warn', a));
  if (def.principio) corpo.push(h('div.small', h('strong', 'Come attribuisce i punti la Commissione: '), def.principio));
  for (const g of c.giudizi) {
    corpo.push(h('div.judge',
      h('h4', h('span', g.commissario), h('span.num', def.tipo === 'fasce' ? `${fmt(g.valore)}% → ${fmt(g.punti)}` : fmt(g.punti))),
      h('p', g.motivazione),
      g.evidenze?.length ? h('ul.ev', g.evidenze.map((e) => h('li', e))) : null,
      g.criticita?.length ? h('ul', g.criticita.map((e) => h('li', e))) : null));
  }
  const pct = c.punti != null ? (c.punti / c.massimo) * 100 : 0;
  return h('details.crit',
    h('summary',
      h('span.id', c.id), h('span.nm', c.nome),
      h('span.pt', h('b', c.punti == null ? '—' : fmt(c.punti)), ` / ${fmt(c.massimo)}`, forbice && h('div.muted.small', `${fmt(c.min)} – ${fmt(c.max)}`))),
    h('div.meter', h('i', { style: { width: `${pct}%` } })),
    h('div.body', corpo));
}

export function schedaReport(corpo, p, bando) {
  const ris = risultatoDi(p);
  const cat = getCategoria(bando, p.categoriaId);
  const definizioni = Object.fromEntries(elencoCriteri(getGriglia(bando, p.categoriaId)).map((c) => [c.id, c]));
  let controlli = verificheAmmissibilita(bando, p.categoriaId, p.anno, p.dati, p.documenti.map((d) => d.tipo));
  // senza file caricati, l'elenco degli allegati mancanti sarebbe solo rumore: un'unica voce
  if (!p.documenti.length) {
    controlli = [{ id: 'all_nessuno', esito: 'da_verificare', titolo: 'Allegati del dossier', dettaglio: 'Nessun file caricato: aggiungi i documenti nella scheda Documenti per verificare gli allegati obbligatori.' }, ...controlli.filter((c) => !c.id.startsWith('all_'))];
  }
  const val = p.valutazione;
  const piano = pianoMiglioramento(p, bando, ris, controlli);
  const conta = (e) => controlli.filter((c) => c.esito === e).length;

  // stima del contributo
  const richiesto = p.dati.economici?.contributoRichiesto;
  const stimaEl = h('div');
  const st = statisticheEsiti(bando, p.categoriaId);
  const primo = () => p.punteggioPrimo || st?.primo || 85;
  const disegnaStima = () => {
    const stima = stimaContributo(richiesto, ris.totale, primo());
    metti(svuota(stimaEl), richiesto == null ? h('p.muted', 'Indica il contributo richiesto nei Dati chiave.')
      : h('div.row', h('div', h('div.label', 'Contributo stimato'), h('div.num', { style: { fontSize: '1.5rem', fontWeight: 600 } }, euro(stima))),
        h('div.muted.small', { style: { maxWidth: '46ch' } }, `${fmt(ris.totale)} ÷ ${fmt(Math.max(ris.totale, primo()))} × ${euro(richiesto)} richiesti. Vale solo se il dossier supera le soglie e la dotazione della categoria non è esaurita.`)));
  };

  const report = h('div.stack', { id: 'report' },
    h('div.panel', h('div.verdict',
      quadrante(ris),
      h('div.stack-s',
        h('div.label', `${bando.nomeBreve || bando.nome} · ${cat.nome} · finestra ${p.anno}`),
        h('h2', TITOLI[ris.esito]),
        h('p', spiegazione(ris, p)),
        ris.bloccanti.map((b) => h('div.notice.bad', b)),
        conta('critico') > 0 && h('div.notice.bad', h('strong', `${conta('critico')} ${conta('critico') === 1 ? 'problema' : 'problemi'} di ammissibilità: `), 'il punteggio conta solo se l’istanza è ammessa alla valutazione.'),
        h('div', { style: { marginTop: '8px' } }, barreSezioni(ris))))),

    (piano.blocchi.length || piano.punti.length) ? h('div.panel',
      h('h2', 'Che cosa sistemare prima dell’invio'),
      piano.blocchi.length ? h('ul.actions', piano.blocchi.map((v) => h('li', h('div', v.testo), h('span.tag.bad', 'Bloccante'), h('div.w', v.dove)))) : null,
      piano.punti.length ? h('ul.actions', piano.punti.map((v) => h('li', h('div', v.testo), h('div.g', `+${fmt(v.punti)}`), h('div.w', v.dove)))) : null,
      piano.punti.length ? h('p.muted.small', { style: { marginTop: '8px' } }, 'I punti indicati sono stime per singolo intervento e non si sommano automaticamente.') : null) : null,

    ris.sezioni.map((sez) => h('section',
      h('div.sec-h',
        h('h3', `Sezione ${sez.id} — ${sez.nome}`),
        h('div.row', h('span.num', h('strong', fmt(sez.punti)), ` / ${fmt(sez.massimo)}`),
          sez.soglia != null && h(`span.tag.${!sez.completo ? (sez.raggiungibile ? 'x' : 'bad') : sez.superata ? 'ok' : 'bad'}`, !sez.completo ? (sez.raggiungibile ? `minimo ${fmt(sez.soglia)} · da completare` : `minimo ${fmt(sez.soglia)} irraggiungibile`) : sez.superata ? `minimo ${fmt(sez.soglia)} superato` : `sotto il minimo di ${fmt(sez.soglia)}`))),
      (val?.giudizi?.[sez.id] || []).filter((g) => g.sintesi).length ? h('details.more', { style: { marginBottom: '10px' } }, h('summary', 'Giudizio di sintesi dei commissari'),
        h('div.stack-s', val.giudizi[sez.id].filter((g) => g.sintesi).map((g) => h('div.judge', h('h4', g.commissario.nome), h('p', g.sintesi))))) : null,
      sez.criteri.map((c) => schedaCriterio(c, definizioni[c.id] || {})))),

    h('section',
      h('div.sec-h', h('h3', 'Ammissibilità e completezza'),
        h('div.row', conta('critico') > 0 && h('span.tag.bad', `${conta('critico')} bloccanti`), conta('attenzione') > 0 && h('span.tag.warn', `${conta('attenzione')} da sistemare`), conta('da_verificare') > 0 && h('span.tag.x', `${conta('da_verificare')} da confermare`), h('span.tag.ok', `${conta('ok')} a posto`))),
      h('div.panel', elencoControlli([...controlli].sort((a, b) => ['critico', 'attenzione', 'da_verificare', 'ok'].indexOf(a.esito) - ['critico', 'attenzione', 'da_verificare', 'ok'].indexOf(b.esito)))),
      val?.verifica ? h('div.panel', { style: { marginTop: '10px' } },
        h('h3', 'Verifica formale di Claude sui moduli'),
        val.verifica.sintesi && h('p.muted', { style: { marginBottom: '6px' } }, val.verifica.sintesi),
        elencoControlli(val.verifica.controlli)) : null),

    st ? confrontoGraduatoria(st, ris, bando, p) : null,
    confrontoReale(p, bando, ris),

    h('section',
      h('div.sec-h', h('h3', 'Quanto potresti ottenere')),
      h('div.panel.stack',
        h('p.muted.small', { style: { maxWidth: '75ch' } }, 'Il primo in graduatoria riceve il 100% del contributo richiesto; gli altri una quota pari al rapporto tra il proprio punteggio e quello del primo.'),
        h('label.field.no-print', { for: 'punteggio-primo', style: { maxWidth: '300px' } }, h('span', st ? `Punteggio del primo in graduatoria (nel ${st.anno}: ${fmt(st.primo)})` : 'Punteggio ipotizzato del primo in graduatoria'),
          h('input', { id: 'punteggio-primo', type: 'number', min: '1', max: '100', step: '0.1', value: primo(), oninput: (e) => { p.punteggioPrimo = Number(e.target.value) || null; salvaPresto(); disegnaStima(); } })),
        stimaEl)),

    h('p.muted.small', { style: { maxWidth: '85ch' } },
      val ? `Valutazione del ${new Date(val.data).toLocaleString('it-IT')} · ${val.collegamento} · ${val.modelliUsati?.length ? val.modelliUsati.map(nomeModello).join(', ') : nomeModello(val.modello)} · ${val.commissari.map((c) => c.nome).join(', ')}${val.uso?.ingresso ? ` · ${fmt((val.uso.ingresso + val.uso.cacheLetta + val.uso.cacheScritta) / 1000, 0)}k token letti, ${fmt(val.uso.uscita / 1000, 0)}k scritti` : ''}. ` : '',
      'Stima prodotta da un modello di intelligenza artificiale applicando la griglia del bando: serve a trovare i punti deboli prima dell’invio e non anticipa né vincola il giudizio della Commissione.',
      val?.note?.length ? h('span', ' ', val.note.join(' ')) : null,
      val?.errori?.length ? h('span', { style: { color: 'var(--bad)' } }, ` Letture non riuscite: ${val.errori.map((e) => e.etichetta).join(', ')}.`) : null));

  disegnaStima();
  metti(corpo, 
    h('div.spread.no-print', { style: { marginBottom: '14px' } },
      h('div.muted.small', bando.verificato === false ? h('span.tag.warn', 'Griglia del bando non ancora verificata a mano') : ''),
      h('div.row',
        h('button.btn.s', { type: 'button', onclick: () => copia(riepilogoTesto(p, bando, ris, piano)) }, 'Copia riepilogo'),
        h('button.btn.s', { type: 'button', onclick: () => scarica(p, report) }, 'Scarica report'),
        !globalThis.claude && h('button.btn.s', { type: 'button', onclick: () => { report.querySelectorAll('details').forEach((d) => { d.open = true; }); window.print(); } }, 'Stampa / PDF'))),
    report);
}

const ordinale = (n) => `${n}°`;

// Dove si colloca la stima rispetto ai punteggi reali dell'ultima finestra conclusa.
function confrontoGraduatoria(st, ris, bando, p) {
  const pos = ris.completo && ris.esito !== 'sotto_soglia' ? posizioneEsiti(bando, p.categoriaId, ris.totale) : null;
  const causa = Object.entries(st.esclusiPer).sort((a, b) => b[1] - a[1])[0];
  const esclusi = st.valutati - st.ammissibili;
  return h('section',
    h('div.sec-h', h('h3', `Confronto con la graduatoria reale ${st.anno}`)),
    h('div.panel.stack',
      h('p', { style: { maxWidth: '80ch' } },
        `Nella finestra ${st.anno} la Commissione ha valutato ${st.valutati} progetti di questa categoria: ${st.ammissibili} hanno superato tutte le soglie e ${st.finanziati} sono stati finanziati. Primo in graduatoria ${fmt(st.primo)}, ultimo finanziato ${fmt(st.ultimoFinanziato)}.`,
        esclusi && causa?.[1] ? ` Dei ${esclusi} esclusi, ${causa[1]} non hanno raggiunto il minimo della sezione ${causa[0]}.` : ''),
      pos ? h(`div.notice.${pos.finanziabile ? 'ok' : 'warn'}`, h('strong', `Con ${fmt(ris.totale)} punti saresti ${ordinale(pos.posizione)} su ${pos.su} ammissibili. `),
        pos.finanziabile ? `Sopra l'ultimo finanziato del ${st.anno} (${fmt(pos.ultimoFinanziato)}).` : `Sotto l'ultimo finanziato del ${st.anno} (${fmt(pos.ultimoFinanziato)}): ammissibile, ma con la stessa concorrenza resteresti senza contributo.`) : null,
      h('div.tablewrap', h('table',
        h('thead', h('tr', h('th', 'Sezione'), h('th.r', 'Tua stima'), h('th.r', `Mediana ${st.anno}`), h('th.r', 'Metà dei progetti'), h('th.r', 'Minimo – massimo'))),
        h('tbody', ris.sezioni.filter((s) => st.sezioni[s.id]).map((s) => {
          const d = st.sezioni[s.id];
          return h('tr', h('td', h('strong', s.id), ` · ${s.nome}`),
            h('td.r.num', s.completo ? h('strong', { style: { color: s.punti >= d.mediana ? 'var(--ok)' : 'var(--warn)' } }, fmt(s.punti)) : h('span.muted', `${fmt(s.punti)} parz.`)),
            h('td.r.num', fmt(d.mediana)), h('td.r.num', `${fmt(d.q1)} – ${fmt(d.q3)}`), h('td.r.num', `${fmt(d.min)} – ${fmt(d.max)}`));
        })))),
      h('p.muted.small', 'Fonte: ', st.url ? h('a', { href: st.url, target: '_blank', rel: 'noopener' }, st.fonte) : st.fonte, '. Questi punteggi reali sono anche il metro con cui Claude tara i giudizi.')));
}

// Prova del nove: il dossier è già stato presentato e se ne conosce il punteggio reale.
function confrontoReale(p, bando, ris) {
  p.reale = p.reale || {};
  const tabella = h('div');
  const disegna = () => {
    const righe = ris.sezioni.map((s) => ({ s, reale: typeof p.reale[s.id] === 'number' ? p.reale[s.id] : null }));
    const complete = righe.filter((x) => x.reale != null && x.s.completo);
    const totReale = righe.every((x) => x.reale != null) ? r1(righe.reduce((a, x) => a + x.reale, 0)) : null;
    const scartoMedio = complete.length ? r1(complete.reduce((a, x) => a + Math.abs(x.s.punti - x.reale), 0) / complete.length) : null;
    const segno = (v) => (v > 0 ? `+${fmt(v)}` : fmt(v));
    metti(svuota(tabella),
      h('div.tablewrap', h('table',
        h('thead', h('tr', h('th', 'Sezione'), h('th.r', 'Stima'), h('th.r', 'Punteggio reale'), h('th.r', 'Scarto'))),
        h('tbody', righe.map(({ s, reale }) => h('tr',
          h('td', h('strong', s.id), ` · ${s.nome}`),
          h('td.r.num', s.completo ? fmt(s.punti) : h('span.muted', `${fmt(s.punti)} parz.`)),
          h('td.r', { style: { width: '120px' } }, h('input', { id: `reale-${s.id}`, type: 'number', min: '0', max: String(s.massimo), step: '0.1', value: reale ?? '', 'aria-label': `Punteggio reale sezione ${s.id}`,
            oninput: (e) => { p.reale[s.id] = e.target.value === '' ? null : Number(e.target.value); salvaPresto(); aggiornaEsito(); } })),
          h('td.r.num', { id: `scarto-${s.id}` }, reale != null && s.completo ? segno(r1(s.punti - reale)) : '—'))),
        h('tr', h('td', h('strong', 'Totale')), h('td.r.num', h('strong', fmt(ris.totale))), h('td.r.num', h('strong', totReale == null ? '—' : fmt(totReale))), h('td.r.num', h('strong', totReale != null && ris.completo ? segno(r1(ris.totale - totReale)) : '—')))))),
      scartoMedio != null ? h(`div.notice.${scartoMedio <= 1.5 ? 'ok' : scartoMedio <= 3 ? 'info' : 'warn'}`, h('strong', `Scarto medio per sezione: ${fmt(scartoMedio)} punti. `),
        scartoMedio <= 1.5 ? 'La stima è allineata al giudizio reale.' : scartoMedio <= 3 ? 'La stima è vicina al giudizio reale; salva il caso per affinare le prossime.' : 'La stima si discosta dal giudizio reale: salva il caso, così le prossime valutazioni ne tengono conto.') : null,
      complete.length ? h('div', h('button.btn.s', { type: 'button', onclick: async () => {
        const val = p.valutazione;
        const testo = [
          `CASO REALE DI TARATURA — dossier «${p.dati.titolo || p.nome}», ${getCategoria(bando, p.categoriaId).nome}, finestra ${p.anno}.`,
          `Punteggi assegnati dalla Commissione: ${righe.filter((x) => x.reale != null).map((x) => `sezione ${x.s.id} ${fmt(x.reale)} su ${fmt(x.s.massimo)}`).join('; ')}${totReale != null ? `; totale ${fmt(totReale)}` : ''}.`,
          `Stima di Clockwise sugli stessi documenti: ${complete.map((x) => `sezione ${x.s.id} ${fmt(x.s.punti)}`).join('; ')}.`,
          `Scarti (stima meno reale): ${complete.map((x) => `${x.s.id} ${segno(r1(x.s.punti - x.reale))}`).join('; ')}. Dove lo scarto è positivo la stima era troppo generosa, dove è negativo troppo severa: tienine conto per dossier di livello simile.`,
          ...Object.entries(val?.giudizi || {}).flatMap(([sid, lista]) => lista.filter((g) => g.sintesi).slice(0, 1).map((g) => `Profilo del dossier, sezione ${sid}: ${g.sintesi}`)),
        ].join('\n');
        await aggiungiConoscenza(bando, { id: `taratura-${p.id}`, nome: `Caso reale — ${p.dati.titolo || p.nome} (${p.anno})`, testo, caratteri: testo.length });
        toast('Caso salvato nella conoscenza del bando');
      } }, 'Salva come caso di taratura'), h('span.muted.small', ' Claude lo leggerà nelle prossime valutazioni di questo bando.')) : null);
  };
  const aggiornaEsito = () => { clearTimeout(aggiornaEsito.t); aggiornaEsito.t = setTimeout(() => { const attivo = document.activeElement?.id; disegna(); if (attivo) { const el = document.getElementById(attivo); if (el) { el.focus(); const v = el.value; el.value = ''; el.value = v; } } }, 600); };
  disegna();
  return h('section.no-print',
    h('div.sec-h', h('h3', 'Prova con un punteggio reale')),
    h('div.panel.stack',
      h('p.muted', { style: { maxWidth: '80ch' } }, 'Se questo dossier è già stato presentato, inserisci i punteggi che la Commissione gli ha assegnato per sezione (sono pubblicati nel decreto di graduatoria): vedi subito quanto la stima si avvicina e puoi usare il caso per tarare le valutazioni successive.'),
      tabella));
}

function riepilogoTesto(p, bando, ris, piano) {
  const righe = [
    `${p.nome} — ${bando.nomeBreve || bando.nome}, finestra ${p.anno}`,
    `Punteggio stimato: ${fmt(ris.totale)} / ${ris.massimo}${ris.completo ? '' : ' (parziale)'}${ris.max > ris.min ? ` — forbice ${fmt(ris.min)}-${fmt(ris.max)}` : ''} — soglia ${ris.sogliaTotale}`,
    `Esito: ${TITOLI[ris.esito]}`,
    ...ris.sezioni.map((s) => `Sezione ${s.id} ${s.nome}: ${fmt(s.punti)} / ${fmt(s.massimo)}${s.soglia != null ? ` (minimo ${fmt(s.soglia)})` : ''}`),
  ];
  if (piano.blocchi.length) righe.push('', 'Bloccanti:', ...piano.blocchi.map((v) => `- ${v.testo}`));
  if (piano.punti.length) righe.push('', 'Da migliorare:', ...piano.punti.map((v) => `- ${v.testo} (+${fmt(v.punti)}, ${v.dove})`));
  return righe.join('\n');
}

async function copia(testo) {
  try { await navigator.clipboard.writeText(testo); toast('Riepilogo copiato'); }
  catch {
    const area = h('textarea', { style: { position: 'fixed', opacity: '0' } }, testo);
    document.body.append(area); area.select();
    toast('Copia non consentita qui: usa “Scarica report”.');
    setTimeout(() => area.remove(), 100);
  }
}

function cssCorrente() {
  let css = '';
  for (const foglio of document.styleSheets) {
    try { for (const r of foglio.cssRules) css += `${r.cssText}\n`; } catch { /* foglio esterno (font) */ }
  }
  return css;
}

async function scarica(p, report) {
  const copiaDom = report.cloneNode(true);
  copiaDom.querySelectorAll('.no-print').forEach((el) => el.remove());
  copiaDom.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
  const titolo = `Clockwise — ${p.nome}`.replace(/[<>&]/g, '');
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titolo}</title>`
    + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">'
    + `<style>${cssCorrente()}</style></head><body><main class="wrap"><h1 style="margin-bottom:18px">${titolo}</h1>${copiaDom.outerHTML}</main></body></html>`;
  const nomeFile = `clockwise-${p.nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'report'}.html`;
  const download = globalThis.claude?.use ? await globalThis.claude.use('downloads').catch(() => null) : null;
  if (download) {
    try { await download.save({ filename: nomeFile, data: html }); toast('Report salvato'); }
    catch (e) { if (e?.code !== 'declined') toast('Salvataggio non disponibile in questa vista.'); }
    return;
  }
  if (globalThis.claude) { toast('Salvataggio non disponibile in questa vista: usa “Copia riepilogo”.'); return; }
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = h('a', { href: url, download: nomeFile });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  void S;
}
