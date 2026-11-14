// Scheda Legale: domande sul bando con citazioni, analisi dei contratti, bozze di documenti, scadenze.
import { h, metti, svuota, toast, scelta, salvaFile, copiaTesto, nomeFilePulito } from './dom.js';
import { S, salva, salvaPresto, llmAttivo } from './app.js';
import { chiediAlBando, analizzaContratti, redigiBozza, scadenzario, documentiContrattuali, MODELLI_BOZZA } from '../core/legale.js';

const IDONEO = { si: ['ok', 'Regge così com’è'], parziale: ['warn', 'Da sistemare'], no: ['bad', 'Non produce effetto'] };
const FIRMA = { si: 'firmato', no: 'non firmato', non_verificabile: 'firma non verificabile dal testo' };
const ESEMPI = [
  'Il tax credit conta nella copertura finanziaria del criterio 5.1?',
  'Posso iniziare le riprese prima della graduatoria?',
  'Quali spese sostenute in Sicilia sono ammissibili?',
  'Che cosa succede se a consuntivo spendo meno del previsto?',
];
const dataIt = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

export function schedaLegale(corpo, p, bando) {
  const llm = llmAttivo();
  p.legale = p.legale || { domande: [], contratti: null, bozze: [], dataDecreto: '' };
  const leg = p.legale;
  const opzioni = () => ({ modello: S.imp.modello, impegno: S.imp.impegno });
  const senzaClaude = !llm && h('div.notice.warn', h('strong', 'Claude non è collegato. '), h('a', { href: '#collegamento' }, 'Configura il collegamento'), ' per usare l’area legale.');

  /* ---------------- domande sul bando */
  const elencoDomande = h('div.stack');
  const disegnaDomande = (inCorso = null) => metti(svuota(elencoDomande),
    inCorso && h('div.judge', h('h4', inCorso.domanda), h('p.muted', { id: 'risposta-in-corso', style: { whiteSpace: 'pre-wrap' } }, h('span.spin'), ' Claude sta consultando l’avviso…')),
    [...leg.domande].reverse().map((d) => h('div.judge',
      h('h4', h('span', d.domanda), h('button.btn.s.ghost', { type: 'button', onclick: () => copiaTesto(d.risposta) }, 'Copia')),
      h('p', { style: { whiteSpace: 'pre-wrap', maxWidth: '85ch' } }, d.risposta))));
  const campo = h('textarea', { id: 'domanda-legale', rows: '2', style: { minHeight: '64px', fontFamily: 'var(--font-body)', fontSize: '.95rem' }, placeholder: 'Scrivi la domanda: requisiti, spese ammissibili, punteggi, scadenze, obblighi, revoca…' });
  const chiedi = async (btn) => {
    const domanda = campo.value.trim();
    if (!domanda) return;
    btn.disabled = true;
    disegnaDomande({ domanda });
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
    disegnaDomande();
  };

  /* ---------------- contratti */
  const areaContratti = h('div.stack');
  const contratti = documentiContrattuali(p.documenti);
  const disegnaContratti = (stato = null) => {
    const c = leg.contratti;
    metti(svuota(areaContratti),
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
    disegnaContratti(h('div.notice', h('span.spin'), ` Claude sta esaminando ${contratti.length} ${contratti.length === 1 ? 'documento' : 'documenti'}…`));
    try { leg.contratti = await analizzaContratti({ bando, progetto: p, llm, opzioni: opzioni() }); await salva(p); disegnaContratti(); toast('Analisi dei contratti completata'); }
    catch (e) { disegnaContratti(h('div.notice.bad', e.message || 'Analisi non riuscita.')); }
    btn.disabled = false;
  };

  /* ---------------- bozze */
  const areaBozze = h('div.stack');
  let tipoBozza = MODELLI_BOZZA[0].id;
  const guida = h('div.muted.small');
  const indicazioni = h('textarea', { id: 'indicazioni-bozza', rows: '3', style: { minHeight: '84px', fontFamily: 'var(--font-body)', fontSize: '.95rem' } });
  const aggiornaGuida = () => { const m = MODELLI_BOZZA.find((x) => x.id === tipoBozza); guida.textContent = `Serve per: ${m.criteri}.`; indicazioni.placeholder = m.guida; };
  const disegnaBozze = (stato = null) => metti(svuota(areaBozze), stato,
    [...leg.bozze].reverse().map((b) => h('details.crit', { open: b === leg.bozze[leg.bozze.length - 1] },
      h('summary', h('span.ico', { 'aria-hidden': 'true' }, '§'), h('span.nm', b.nome, h('div.muted.small', { style: { fontWeight: 400 } }, new Date(b.data).toLocaleString('it-IT'))), h('span.tag.x', 'Bozza')),
      h('div.body',
        h('div.row', h('button.btn.s', { type: 'button', onclick: () => copiaTesto(b.testo) }, 'Copia'),
          h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`${b.nome}-${p.dati.titolo || p.nome}`, 'txt'), b.testo) }, 'Scarica (.txt)'),
          h('button.btn.s.ghost.danger', { type: 'button', onclick: () => { leg.bozze = leg.bozze.filter((x) => x !== b); salva(p).then(() => disegnaBozze()); } }, 'Elimina')),
        h('p', { id: `bozza-${b.data}`, style: { whiteSpace: 'pre-wrap', maxWidth: '85ch', fontSize: '.92rem' } }, b.testo)))));
  const redigi = async (btn) => {
    btn.disabled = true;
    disegnaBozze(h('div.notice', h('span.spin'), ' Claude sta redigendo la bozza…'));
    try {
      const b = await redigiBozza({ bando, progetto: p, tipo: tipoBozza, indicazioni: indicazioni.value, llm, opzioni: opzioni() });
      leg.bozze.push(b); indicazioni.value = '';
      await salva(p); disegnaBozze();
    } catch (e) { disegnaBozze(h('div.notice.bad', e.message || 'Bozza non riuscita.')); }
    btn.disabled = false;
  };

  /* ---------------- scadenze */
  const areaScadenze = h('div');
  const disegnaScadenze = () => {
    const voci = scadenzario(bando, leg.dataDecreto);
    metti(svuota(areaScadenze),
      voci.length ? h('ul.checklist', voci.map((s) => h('li', h('span.ico', { 'aria-hidden': 'true' }, '⏱'), h('div',
        h('div.t', `${dataIt(s.data)} — ${s.etichetta}`),
        s.preavviso && h('div.d', `Eventuale richiesta di proroga entro il ${dataIt(s.preavviso)}.`),
        h('div.d', s.nota)))))
        : h('div.muted.small', bando.scadenze?.length ? 'Inserisci la data di notifica del decreto per calcolare le scadenze.' : 'Per questo bando non sono definite scadenze automatiche.'),
      (bando.scadenzeNote || []).length ? h('ul', { style: { margin: '10px 0 0', paddingLeft: '18px' } }, bando.scadenzeNote.map((n) => h('li.small.muted', n))) : null);
  };

  metti(corpo, h('div.stack',
    senzaClaude,
    h('div.panel.stack',
      h('div', h('h2', 'Chiedi al bando'),
        h('p.muted', { style: { maxWidth: '75ch', marginTop: '4px' } }, 'Risposte fondate sul testo ufficiale dell’avviso, con l’articolo citato accanto a ogni affermazione e applicate ai dati di questo dossier.')),
      campo,
      h('div', h('button.btn.primary', { type: 'button', id: 'btn-chiedi', disabled: !llm, onclick: (e) => chiedi(e.currentTarget) }, 'Chiedi')),
      !leg.domande.length && h('div.stack-s', h('div.label', 'Per esempio'), h('div.row', ESEMPI.map((e) => h('button.btn.s.wrap', { type: 'button', onclick: () => { campo.value = e; campo.focus(); } }, e)))),
      elencoDomande),

    h('div.panel.stack',
      h('div.spread', h('div', h('h2', 'Contratti e accordi del dossier'),
        h('p.muted', { style: { maxWidth: '75ch', marginTop: '4px' } }, 'Contratti, deal memo, lettere di intento, referenze bancarie e atti di concessione letti uno per uno: che cosa sono, se sono firmati, quale criterio sostengono, che cosa manca perché la Commissione li riconosca.')),
        h('button.btn.primary', { type: 'button', id: 'btn-contratti', disabled: !llm || !contratti.length, onclick: (e) => analizza(e.currentTarget) }, leg.contratti ? 'Rianalizza' : `Analizza ${contratti.length || ''} ${contratti.length === 1 ? 'documento' : 'documenti'}`)),
      !contratti.length && h('div.notice', 'Nel dossier non ci sono ancora contratti, deal memo o lettere di intento: caricali nella scheda Documenti.'),
      areaContratti),

    h('div.panel.stack',
      h('div', h('h2', 'Bozze di documenti'),
        h('p.muted', { style: { maxWidth: '75ch', marginTop: '4px' } }, 'Documenti pronti da completare e far firmare, scritti perché la Commissione li riconosca. I dati mancanti restano segnati tra parentesi quadre.')),
      h('div.grid.w', scelta('Documento', MODELLI_BOZZA, tipoBozza, (v) => { tipoBozza = v; aggiornaGuida(); }, { id: 'sel-bozza' })),
      guida,
      h('label.field', { for: 'indicazioni-bozza' }, h('span', 'Dati essenziali (nomi, importi, date)'), indicazioni),
      h('div', h('button.btn.primary', { type: 'button', id: 'btn-bozza', disabled: !llm, onclick: (e) => redigi(e.currentTarget) }, 'Redigi la bozza')),
      areaBozze),

    h('div.panel.stack',
      h('div', h('h2', 'Scadenze dopo la concessione'),
        h('p.muted', { style: { maxWidth: '75ch', marginTop: '4px' } }, 'I termini decorrono dalla notifica del decreto di concessione provvisoria.')),
      h('label.field', { for: 'data-decreto', style: { maxWidth: '260px' } }, h('span', 'Data di notifica del decreto'),
        h('input', { id: 'data-decreto', type: 'date', value: leg.dataDecreto || '', style: { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', background: 'var(--surface)' }, onchange: (e) => { leg.dataDecreto = e.target.value; salvaPresto(); disegnaScadenze(); } })),
      areaScadenze),

    h('p.muted.small', { style: { maxWidth: '85ch' } }, 'Supporto alla preparazione del dossier, non parere legale: risposte, analisi e bozze vanno verificate da un professionista prima della firma o dell’invio. Le risposte si fondano sul testo dell’avviso incluso nel programma; ciò che esce da quel testo è segnalato come da verificare.')));

  aggiornaGuida(); disegnaDomande(); disegnaContratti(); disegnaBozze(); disegnaScadenze();
}
