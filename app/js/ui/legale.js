// Scheda Legale: domande sul bando con citazioni, analisi dei contratti, bozze di documenti, fascicolo, scadenze.
import { h, metti, svuota, toast, scelta, salvaFile, copiaTesto, nomeFilePulito } from './dom.js';
import { S, salva, salvaPresto, llmAttivo } from './app.js';
import { chiediAlBando, analizzaContratti, redigiBozza, costruisciFascicolo, scadenzario, documentiContrattuali, MODELLI_BOZZA } from '../core/legale.js';
import { sottoNavigazione } from './sezioni.js';

const IDONEO = { si: ['ok', 'Regge così com’è'], parziale: ['warn', 'Da sistemare'], no: ['bad', 'Non produce effetto'] };
const FIRMA = { si: 'firmato', no: 'non firmato', non_verificabile: 'firma non verificabile dal testo' };
// Domande d'esempio adattate al bando in uso: territorio e criterio sulla copertura finanziaria, se c'è.
const esempi = (bando) => {
  const copertura = Object.values(bando?.griglie || {}).flatMap((g) => g.sezioni.flatMap((x) => x.criteri)).find((c) => c.metrica === 'copertura');
  return [
    copertura ? `Il tax credit conta nella copertura finanziaria del criterio ${copertura.id}?` : 'Il tax credit conta nella copertura finanziaria del progetto?',
    'Posso iniziare le riprese prima della graduatoria?',
    `Quali spese sostenute in ${bando?.territorio || 'regione'} sono ammissibili?`,
    'Che cosa succede se a consuntivo spendo meno del previsto?',
  ];
};
const dataIt = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const intro = (titolo, testo) => h('div', h('h2', titolo), h('p.muted', { style: { maxWidth: '75ch', marginTop: '4px' } }, testo));

const SEZIONI = [
  ['chiedi', 'Chiedi al bando', vistaChiedi],
  ['contratti', 'Contratti', vistaContratti],
  ['bozze', 'Bozze', vistaBozze],
  ['fascicolo', 'Fascicolo', vistaFascicolo],
  ['scadenze', 'Scadenze', vistaScadenze],
];

export function schedaLegale(corpo, p, bando) {
  const llm = llmAttivo();
  p.legale = p.legale || { domande: [], contratti: null, bozze: [], dataDecreto: '' };
  const contesto = { p, bando, llm, leg: p.legale, opzioni: () => ({ modello: S.imp.modello, impegno: S.imp.impegno }) };
  const area = h('div.stack');
  const { barra, apri } = sottoNavigazione('legale', SEZIONI, area, contesto);
  metti(corpo,
    barra,
    !llm && h('div.notice.warn', { style: { marginBottom: '14px' } }, h('strong', 'Claude non è collegato. '), h('a', { href: '#collegamento' }, 'Configura il collegamento'), ' per usare l’area legale.'),
    area,
    h('p.muted.small', { style: { maxWidth: '85ch', marginTop: '16px' } }, 'Supporto alla preparazione del dossier e dei documenti di produzione, non parere legale: risposte, analisi e bozze vanno verificate da un professionista prima della firma o dell’invio. Le risposte sul bando si fondano sul testo dell’avviso incluso nel programma; ciò che esce da quel testo è segnalato come da verificare.'));
  apri(S.sotto.legale);
}

function vistaChiedi(area, { p, bando, llm, leg, opzioni }) {
  const elenco = h('div.stack');
  const disegna = (inCorso = null) => metti(svuota(elenco),
    inCorso && h('div.judge', h('h4', inCorso.domanda), h('p.muted', { id: 'risposta-in-corso', style: { whiteSpace: 'pre-wrap' } }, h('span.spin'), ' Claude sta consultando l’avviso…')),
    [...leg.domande].reverse().map((d) => h('div.judge',
      h('h4', h('span', d.domanda), h('button.btn.s.ghost', { type: 'button', onclick: () => copiaTesto(d.risposta) }, 'Copia')),
      h('p', { style: { whiteSpace: 'pre-wrap', maxWidth: '85ch' } }, d.risposta))));
  const campo = h('textarea', { id: 'domanda-legale', rows: '2', style: { minHeight: '64px', fontFamily: 'var(--font-body)', fontSize: '.95rem' }, placeholder: 'Scrivi la domanda: requisiti, spese ammissibili, punteggi, scadenze, obblighi, revoca…' });
  const chiedi = async (btn) => {
    const domanda = campo.value.trim();
    if (!domanda) return;
    btn.disabled = true;
    disegna({ domanda });
    try {
      const r = await chiediAlBando({
        bando, progetto: p, domanda, storia: leg.domande, llm, opzioni: opzioni(),
        onTesto: (t) => { const el = document.getElementById('risposta-in-corso'); if (el) { el.textContent = t; el.classList.remove('muted'); } },
      });
      leg.domande.push({ domanda, risposta: r.risposta, data: new Date().toISOString() });
      campo.value = '';
      await salva(p);
    } catch (e) { toast(e.message || 'Risposta non riuscita'); }
    btn.disabled = false;
    disegna();
  };
  metti(area, h('div.panel.stack',
    intro('Chiedi al bando', 'Risposte fondate sul testo ufficiale dell’avviso, con l’articolo citato accanto a ogni affermazione e applicate ai dati di questo dossier.'),
    campo,
    h('div', h('button.btn.primary', { type: 'button', id: 'btn-chiedi', disabled: !llm, onclick: (e) => chiedi(e.currentTarget) }, 'Chiedi')),
    !leg.domande.length && h('div.stack-s', h('div.label', 'Per esempio'), h('div.row', esempi(bando).map((e) => h('button.btn.s.wrap', { type: 'button', onclick: () => { campo.value = e; campo.focus(); } }, e)))),
    elenco));
  disegna();
}

function vistaContratti(area, { p, bando, llm, leg, opzioni }) {
  const corpo = h('div.stack');
  const contratti = documentiContrattuali(p.documenti);
  const disegna = (stato = null) => {
    const c = leg.contratti;
    metti(svuota(corpo),
      stato,
      c && [
        c.sintesi && h('p', { style: { maxWidth: '85ch' } }, c.sintesi),
        c.documenti.map((d) => {
          const [classe, etichetta] = IDONEO[d.idoneo] || IDONEO.parziale;
          return h('details.crit', { open: d.idoneo !== 'si' },
            h('summary', h(`span.ico.${d.idoneo === 'si' ? 'ok' : d.idoneo === 'no' ? 'critico' : 'attenzione'}`, { 'aria-hidden': 'true' }, d.idoneo === 'si' ? '✓' : d.idoneo === 'no' ? '✕' : '!'),
              h('span.nm', d.file, h('div.muted.small', { style: { fontWeight: 400 } }, [d.natura, FIRMA[d.firmato], d.criteri.length ? `criteri ${d.criteri.join(', ')}` : ''].filter(Boolean).join(' · '))),
              h(`span.tag.${classe}`, etichetta)),
            h('div.body',
              h('div.small', [d.parti.length ? `Parti: ${d.parti.join('; ')}` : '', d.oggetto ? `Oggetto: ${d.oggetto}` : '', d.importo ? `Importo: ${d.importo}` : '', d.data ? `Data: ${d.data}` : ''].filter(Boolean).map((t) => h('div', t))),
              h('p', d.motivazione),
              d.rischi.length ? h('div', h('strong.small', 'Problemi'), h('ul', { style: { margin: '4px 0 0', paddingLeft: '18px' } }, d.rischi.map((r) => h('li', r)))) : null,
              d.correzioni.length ? h('div', h('strong.small', 'Da correggere prima dell’invio'), h('ul', { style: { margin: '4px 0 0', paddingLeft: '18px' } }, d.correzioni.map((r) => h('li', r)))) : null));
        }),
        h('p.muted.small', `Analisi del ${new Date(c.data).toLocaleString('it-IT')}.`),
      ]);
  };
  const analizza = async (btn) => {
    btn.disabled = true;
    disegna(h('div.notice', h('span.spin'), ` Claude sta esaminando ${contratti.length} ${contratti.length === 1 ? 'documento' : 'documenti'}…`));
    try { leg.contratti = await analizzaContratti({ bando, progetto: p, llm, opzioni: opzioni() }); await salva(p); disegna(); toast('Analisi dei contratti completata'); }
    catch (e) { disegna(h('div.notice.bad', e.message || 'Analisi non riuscita.')); }
    btn.disabled = false;
  };
  metti(area, h('div.panel.stack',
    h('div.spread', intro('Contratti e accordi del dossier', 'Contratti, deal memo, lettere di intento, referenze bancarie e atti di concessione letti uno per uno: che cosa sono, se sono firmati, quale criterio sostengono, che cosa manca perché la Commissione li riconosca.'),
      h('button.btn.primary', { type: 'button', id: 'btn-contratti', disabled: !llm || !contratti.length, onclick: (e) => analizza(e.currentTarget) }, leg.contratti ? 'Rianalizza' : `Analizza ${contratti.length || ''} ${contratti.length === 1 ? 'documento' : 'documenti'}`)),
    !contratti.length && h('div.notice', 'Nel dossier non ci sono ancora contratti, deal memo o lettere di intento: caricali nella scheda Documenti.'),
    corpo));
  disegna();
}

function vistaBozze(area, { p, bando, llm, leg, opzioni }) {
  const corpo = h('div.stack');
  let tipo = MODELLI_BOZZA[0].id;
  const guida = h('div.muted.small');
  const indicazioni = h('textarea', { id: 'indicazioni-bozza', rows: '3', style: { minHeight: '84px', fontFamily: 'var(--font-body)', fontSize: '.95rem' } });
  const aggiornaGuida = () => { const m = MODELLI_BOZZA.find((x) => x.id === tipo); guida.textContent = `Serve per: ${m.criteri}.`; indicazioni.placeholder = m.guida; };
  const disegna = (stato = null) => metti(svuota(corpo), stato,
    [...leg.bozze].reverse().map((b) => h('details.crit', { open: b === leg.bozze[leg.bozze.length - 1] },
      h('summary', h('span.ico', { 'aria-hidden': 'true' }, '§'), h('span.nm', b.nome, h('div.muted.small', { style: { fontWeight: 400 } }, new Date(b.data).toLocaleString('it-IT'))), h('span.tag.x', 'Bozza')),
      h('div.body',
        h('div.row', h('button.btn.s', { type: 'button', onclick: () => copiaTesto(b.testo) }, 'Copia'),
          h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`${b.nome}-${p.dati.titolo || p.nome}`, 'txt'), b.testo) }, 'Scarica (.txt)'),
          h('button.btn.s.ghost.danger', { type: 'button', onclick: () => { leg.bozze = leg.bozze.filter((x) => x !== b); salva(p).then(() => disegna()); } }, 'Elimina')),
        h('p', { id: `bozza-${b.data}`, style: { whiteSpace: 'pre-wrap', maxWidth: '85ch', fontSize: '.92rem' } }, b.testo)))));
  const redigi = async (btn) => {
    btn.disabled = true;
    disegna(h('div.notice', h('span.spin'), ' Claude sta redigendo la bozza…'));
    try {
      const b = await redigiBozza({ bando, progetto: p, tipo, indicazioni: indicazioni.value, llm, opzioni: opzioni() });
      leg.bozze.push(b); indicazioni.value = '';
      await salva(p); disegna();
    } catch (e) { disegna(h('div.notice.bad', e.message || 'Bozza non riuscita.')); }
    btn.disabled = false;
  };
  const gruppi = [['Per il dossier del bando', MODELLI_BOZZA.filter((m) => m.ambito !== 'produzione')], ['Per la produzione', MODELLI_BOZZA.filter((m) => m.ambito === 'produzione')]];
  metti(area, h('div.panel.stack',
    intro('Bozze di documenti', 'Documenti pronti da completare e far firmare: quelli da allegare al dossier sono scritti perché la Commissione li riconosca; quelli di produzione coprono diritti, liberatorie e riservatezza. I dati mancanti restano segnati tra parentesi quadre.'),
    h('label.field', { for: 'sel-bozza', style: { maxWidth: '560px' } }, h('span', 'Documento'),
      h('select', { id: 'sel-bozza', onchange: (e) => { tipo = e.target.value; aggiornaGuida(); } }, gruppi.map(([nome, lista]) => h('optgroup', { label: nome }, lista.map((m) => h('option', { value: m.id }, m.nome)))))),
    guida,
    h('label.field', { for: 'indicazioni-bozza' }, h('span', 'Dati essenziali (nomi, importi, date)'), indicazioni),
    h('div', h('button.btn.primary', { type: 'button', id: 'btn-bozza', disabled: !llm, onclick: (e) => redigi(e.currentTarget) }, 'Redigi la bozza')),
    corpo));
  aggiornaGuida(); disegna();
}

function vistaFascicolo(area, { p, bando, llm, leg, opzioni }) {
  const corpo = h('div.stack');
  const utili = p.documenti.filter((d) => d.testo && (documentiContrattuali([d]).length || /^modulo/.test(d.tipo)));
  const tabella = (intestazioni, righe) => h('div.tablewrap', h('table', h('thead', h('tr', intestazioni.map((t) => h('th', t)))), h('tbody', righe)));
  const testoFascicolo = (f) => [
    `FASCICOLO — ${p.dati.titolo || p.nome}`, f.sintesi, '',
    'PARTI', ...f.parti.map((x) => `- ${x.nome} — ${x.ruolo}${x.documenti.length ? ` (${x.documenti.join(', ')})` : ''}`), '',
    'IMPEGNI', ...f.impegni.map((x) => `- ${x.soggetto}: ${x.impegno}${x.importo ? ` — ${x.importo}` : ''}${x.scadenza ? ` — entro ${x.scadenza}` : ''} [${x.fonte}]`), '',
    'DATE', ...f.date.map((x) => `- ${x.data}: ${x.evento} [${x.fonte}]`),
    ...(f.incongruenze.length ? ['', 'INCONGRUENZE', ...f.incongruenze.map((x) => `- ${x}`)] : []),
  ].join('\n');
  const disegna = (stato = null) => {
    const f = leg.fascicolo;
    metti(svuota(corpo), stato, f && [
      f.sintesi && h('p', { style: { maxWidth: '85ch' } }, f.sintesi),
      f.ridotto && h('div.notice.warn', 'I documenti erano troppo lunghi per una sola lettura e sono stati accorciati: il fascicolo può essere incompleto. Con la chiave API la lettura è integrale.'),
      f.incongruenze.length ? h('div.notice.warn', h('strong', 'Da chiarire prima dell’invio'), h('ul', { style: { margin: '6px 0 0', paddingLeft: '18px' } }, f.incongruenze.map((x) => h('li', x)))) : h('div.notice.ok', 'Nessuna incongruenza rilevata tra i documenti.'),
      f.parti.length ? h('div', h('h3', { style: { marginBottom: '8px' } }, 'Parti'), tabella(['Soggetto', 'Ruolo', 'Compare in'], f.parti.map((x) => h('tr', h('td', { style: { fontWeight: 500 } }, x.nome), h('td', x.ruolo), h('td.small.muted', x.documenti.join(', ')))))) : null,
      f.impegni.length ? h('div', h('h3', { style: { marginBottom: '8px' } }, 'Impegni'), tabella(['Chi', 'Che cosa', 'Importo', 'Entro', 'Fonte'], f.impegni.map((x) => h('tr', h('td', { style: { fontWeight: 500 } }, x.soggetto), h('td', x.impegno), h('td.num.small', x.importo || '—'), h('td.small', x.scadenza || '—'), h('td.small.muted', x.fonte))))) : null,
      f.date.length ? h('div', h('h3', { style: { marginBottom: '8px' } }, 'Date chiave'), tabella(['Data', 'Evento', 'Fonte'], f.date.map((x) => h('tr', h('td.num.small', { style: { whiteSpace: 'nowrap' } }, x.data || '—'), h('td', x.evento), h('td.small.muted', x.fonte))))) : null,
      h('div.row', h('button.btn.s', { type: 'button', onclick: () => copiaTesto(testoFascicolo(f), 'Fascicolo copiato') }, 'Copia'),
        h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`fascicolo-${p.dati.titolo || p.nome}`, 'txt'), testoFascicolo(f)) }, 'Scarica (.txt)'),
        h('span.muted.small', `Aggiornato il ${new Date(f.data).toLocaleString('it-IT')} su ${f.documenti.length} documenti.`)),
    ]);
  };
  const costruisci = async (btn) => {
    btn.disabled = true;
    disegna(h('div.notice', h('span.spin'), ` Claude sta leggendo ${utili.length} ${utili.length === 1 ? 'documento' : 'documenti'}…`));
    try { leg.fascicolo = await costruisciFascicolo({ bando, progetto: p, llm, opzioni: opzioni() }); await salva(p); disegna(); toast('Fascicolo aggiornato'); }
    catch (e) { disegna(h('div.notice.bad', e.message || 'Fascicolo non riuscito.')); }
    btn.disabled = false;
  };
  metti(area, h('div.panel.stack',
    h('div.spread', intro('Fascicolo del progetto', 'Parti, impegni e date chiave ricavati dai moduli e dagli accordi del dossier, con il file di provenienza accanto a ogni voce e le incongruenze tra un documento e l’altro.'),
      h('button.btn.primary', { type: 'button', id: 'btn-fascicolo', disabled: !llm || !utili.length, onclick: (e) => costruisci(e.currentTarget) }, leg.fascicolo ? 'Aggiorna il fascicolo' : 'Costruisci il fascicolo')),
    !utili.length && h('div.notice', 'Carica nella scheda Documenti i moduli del dossier o gli accordi: il fascicolo si costruisce da lì.'),
    corpo));
  disegna();
}

function vistaScadenze(area, { bando, leg }) {
  const corpo = h('div');
  const disegna = () => {
    const voci = scadenzario(bando, leg.dataDecreto);
    metti(svuota(corpo),
      voci.length ? h('ul.checklist', voci.map((s) => h('li', h('span.ico', { 'aria-hidden': 'true' }, '⏱'), h('div',
        h('div.t', `${dataIt(s.data)} — ${s.etichetta}`),
        s.preavviso && h('div.d', `Eventuale richiesta di proroga entro il ${dataIt(s.preavviso)}.`),
        h('div.d', s.nota)))))
        : h('div.muted.small', bando.scadenze?.length ? 'Inserisci la data di notifica del decreto per calcolare le scadenze.' : 'Per questo bando non sono definite scadenze automatiche.'),
      (bando.scadenzeNote || []).length ? h('ul', { style: { margin: '10px 0 0', paddingLeft: '18px' } }, bando.scadenzeNote.map((n) => h('li.small.muted', n))) : null);
  };
  metti(area, h('div.panel.stack',
    intro('Scadenze dopo la concessione', 'I termini decorrono dalla notifica del decreto di concessione provvisoria.'),
    h('label.field', { for: 'data-decreto', style: { maxWidth: '260px' } }, h('span', 'Data di notifica del decreto'),
      h('input', { id: 'data-decreto', type: 'date', value: leg.dataDecreto || '', onchange: (e) => { leg.dataDecreto = e.target.value; salvaPresto(); disegna(); } })),
    corpo));
  disegna();
}
