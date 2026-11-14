// Area di lavoro di un dossier: Cruscotto, Documenti, Dati chiave, Valutazione, Report, più gli strumenti.
import { h, metti, svuota, fmt, euro, toast, dimensione, campoNumero, campoTesto, scelta, elencoControlli, bottoneConferma } from './dom.js';
import { S, bandoDi, risultatoDi, salva, salvaPresto, llmAttivo, vai, annoPredefinito, impostazione, nomeModello, dritaVista, guidaInCorso } from './app.js';
import { TIPI, tipoPerId, estraiTesto, riconosciTipo, immaginiScansione } from '../core/docs.js';
import { trascriviScansione, AVVISO_TRASCRIZIONE } from '../core/scansioni.js';
import { getCategoria, getGriglia, verificheAmmissibilita, suggerimentiQuantitativi, valutaQuantitativo, coperturaPiano, ETICHETTE_DOC, datiVuoti } from '../core/scoring.js';
import { MODELLI, IMPEGNI } from '../core/llm.js';
import { pianoValutazione, eseguiValutazione, estraiDati } from '../core/engine.js';
import { nuovoId } from '../core/store.js';
import { schedaReport } from './report.js';
import { schedaProduzione } from './produzione.js';
import { schedaLegale } from './legale.js';
import { schedaFinanza } from './finanza.js';
import { schedaGestione } from './gestione.js';
import { schedaCruscotto } from './cruscotto.js';
import { suggerimento } from './tutorial.js';
import { controlliFormato, controlliIncrociati } from '../core/invio.js';

// Il cruscotto riassume lo stato; le quattro schede numerate sono i passi della valutazione;
// Produzione e Legale sono strumenti di lavoro sul dossier.
const SCHEDE = [['documenti', 'Documenti'], ['dati', 'Dati chiave'], ['valutazione', 'Valutazione'], ['report', 'Report']];
const STRUMENTI = [['produzione', 'Produzione'], ['finanza', 'Finanza'], ['gestione', 'Gestione bando'], ['legale', 'Legale']];
const VISTE = { cruscotto: schedaCruscotto, documenti: schedaDocumenti, dati: schedaDati, valutazione: schedaValutazione, report: schedaReport, produzione: schedaProduzione, finanza: schedaFinanza, gestione: schedaGestione, legale: schedaLegale };
// Suggerimenti mostrati la prima volta che si apre una scheda.
const DRITTE = {
  documenti: ['Trascina tutti i file insieme.', 'Il tipo di ciascun documento viene riconosciuto dal nome e puoi correggerlo nella tabella. Il Modulo III in Excel compila da solo i Dati chiave.'],
  dati: ['I punti a destra si aggiornano mentre scrivi.', 'Prova a cambiare un numero per vedere quanto vale salire di fascia: il file originale non viene toccato.'],
  valutazione: ['Per una prima prova basta un commissario.', 'Costa una frazione delle letture. Per la stima da usare prima dell’invio scegli tre commissari: il punteggio è la media, come nella Commissione vera.'],
  report: ['Apri un criterio per leggere le motivazioni.', 'In fondo alla pagina puoi inserire il punteggio reale di un dossier già presentato: serve a misurare quanto la stima è vicina e a tararla.'],
  produzione: ['Si parte dallo spoglio.', 'Piano di lavorazione, ordine del giorno, storyboard e adempimenti si riempiono dalle scene lette nella sceneggiatura. Il preventivo è indipendente: puoi importarlo subito.'],
  finanza: ['I numeri partono dai Dati chiave.', 'Piano finanziario, limite degli aiuti pubblici, tax credit, piano di cassa e recupero si calcolano dal costo e dalle fonti già inseriti: qui provi le alternative senza toccare il dossier.'],
  gestione: ['Serve dopo la concessione.', 'Tappe e scadenze, quote di erogazione, registro delle spese e rendiconto: tieni sotto controllo gli impegni che hanno generato il punteggio, perché a consuntivo vengono verificati.'],
  legale: ['Ogni risposta cita l’articolo dell’avviso.', 'Apri il testo ufficiale e controlla il punto indicato prima di decidere: è un supporto, non un parere legale.'],
};

// I file caricati in questa sessione: servono a rileggere le scansioni come immagini (dopo una ricarica vanno riselezionati).
const FILE_SESSIONE = new Map();

// Ciò che del Modulo III serve ai controlli incrociati (accordi dichiarati, nominativi, date).
function estrattoModulo(m) {
  const d = m.dati || {};
  return { accordi: m.accordi || {}, proponente: d.proponente || '', regia: d.regia || '', dataInizioRiprese: d.dataInizioRiprese || '', dataFineRiprese: d.dataFineRiprese || '', elencoArtistico: d.elencoArtistico || [], elencoTecnico: d.elencoTecnico || [] };
}

export function vistaProgetto(main) {
  const p = S.progetto;
  const bando = bandoDi(p);
  const corpo = h('div');
  const mostra = (id) => {
    S.scheda = id;
    for (const b of barra.children) b.setAttribute('aria-selected', String(b.dataset.id === id));
    svuota(corpo);
    const dritta = DRITTE[id] && !guidaInCorso() ? suggerimento(id, S.guida.dritte, DRITTE[id][0], DRITTE[id][1], dritaVista) : null;
    if (dritta) corpo.append(dritta);
    (VISTE[id] || VISTE.cruscotto)(corpo, p, bando, mostra);
    window.scrollTo(0, 0);
  };
  const barra = h('div.tabs', { role: 'tablist' },
    h('button', { type: 'button', role: 'tab', dataset: { id: 'cruscotto' }, onclick: () => mostra('cruscotto') }, 'Cruscotto'),
    SCHEDE.map(([id, nome], i) => h('button', { type: 'button', role: 'tab', dataset: { id }, onclick: () => mostra(id) }, h('span.n', String(i + 1)), nome)),
    STRUMENTI.map(([id, nome], i) => h(`button${i === 0 ? '.sep' : ''}`, { type: 'button', role: 'tab', dataset: { id }, onclick: () => mostra(id) }, nome)));
  const cambiaBando = (id) => {
    const b = S.bandi.find((x) => x.id === id);
    p.bandoId = id; p.categoriaId = b.categorie[0].id; p.anno = annoPredefinito(b); p.valutazione = null;
    salva().then(() => vai('progetto', true));
  };
  metti(main, 
    h('div.stack-s',
      h('a.small.muted', { href: '#dossier' }, '← Tutti i dossier'),
      h('input.title-input', { id: 'nome-dossier', type: 'text', value: p.nome, 'aria-label': 'Nome del dossier', oninput: (e) => { p.nome = e.target.value || 'Senza nome'; salvaPresto(); } }),
      p.esempio && h('div.notice.info', h('strong', 'Dossier di esempio. '), 'I numeri sono d’invenzione e servono a mostrare come funziona il simulatore. Modificali liberamente o crea un nuovo dossier.'),
      h('div.grid.w', { style: { marginTop: '6px' } },
        scelta('Bando', S.bandi.map((b) => ({ id: b.id, nome: b.nomeBreve || b.nome })), p.bandoId, cambiaBando, { id: 'sel-bando' }),
        scelta('Categoria dell’opera', bando.categorie.map((c) => ({ id: c.id, nome: c.nome })), p.categoriaId, (v) => { p.categoriaId = v; p.valutazione = null; salva().then(() => mostra(S.scheda)); }, { id: 'sel-categoria' }),
        scelta('Finestra', (bando.finestre?.length ? bando.finestre.map((f) => f.anno) : [p.anno]).map((a) => ({ id: a, nome: String(a) })), p.anno, (v) => { p.anno = Number(v); salva().then(() => mostra(S.scheda)); }, { id: 'sel-anno' }))),
    barra, corpo);
  mostra(VISTE[S.scheda] ? S.scheda : 'cruscotto');
}

/* ------------------------------------------------------------------ Documenti */

function unisciDatiModulo(p, dati) {
  const d = p.dati;
  for (const k of ['titolo', 'tipologiaOpera']) if (dati[k]) d[k] = dati[k];
  if (dati.durataMin != null) d.durataMin = dati.durataMin;
  for (const gruppo of ['giorni', 'professionisti', 'economici']) {
    for (const [k, v] of Object.entries(dati[gruppo] || {})) if (v != null) d[gruppo][k] = v;
  }
  if (dati.piano?.length) d.piano = dati.piano.map((r) => ({ voce: r.voce, etichetta: r.etichetta, denominazione: r.denominazione, importo: r.importo, documento: r.documento }));
}

function schedaDocumenti(corpo, p, bando, mostra) {
  const stato = h('div');
  const tabella = h('div');
  const lista = h('div');

  async function aggiungi(files) {
    const elenco = [...files];
    if (!elenco.length) return;
    let fatto = 0, letto3 = null;
    for (const file of elenco) {
      metti(svuota(stato), h('div.notice', h('span.spin'), ` Lettura di «${file.name}» (${++fatto} di ${elenco.length})…`));
      const doc = { id: nuovoId(), nome: file.name, dimensione: file.size, tipo: 'altro', testo: '', pagine: null, avvisi: [] };
      try {
        const r = await estraiTesto(file);
        Object.assign(doc, { testo: r.testo, pagine: r.pagine, avvisi: r.avvisi, scansione: !!r.scansione });
        doc.tipo = r.modulo3 ? 'modulo3' : riconosciTipo(file.name, r.testo);
        if (r.modulo3) { unisciDatiModulo(p, r.modulo3.dati); p.modulo3 = estrattoModulo(r.modulo3); p.origineDati = { tipo: 'modulo3', file: file.name, avvisi: r.modulo3.avvisi }; letto3 = file.name; }
      } catch (e) {
        doc.avvisi.push(`Impossibile leggere il file: ${e.message}`);
        doc.tipo = riconosciTipo(file.name, '');
      }
      if (doc.tipo === 'identita') doc.testo = ''; // mai inviato a Claude
      // ricaricare un file già presente conserva il tipo scelto a mano e, per le scansioni, la lettura già fatta
      const prima = p.documenti.find((d) => d.nome === doc.nome);
      if (prima) {
        doc.id = prima.id;
        if (doc.tipo !== 'modulo3') doc.tipo = prima.tipo;
        if (prima.trascritto && doc.scansione && prima.dimensione === doc.dimensione) Object.assign(doc, { testo: prima.testo, trascritto: true, avvisi: prima.avvisi });
      }
      if (doc.scansione) FILE_SESSIONE.set(doc.id, file);
      p.documenti = p.documenti.filter((d) => d.nome !== doc.nome);
      p.documenti.push(doc);
    }
    svuota(stato);
    await salva();
    disegna();
    toast(letto3 ? `Dati chiave compilati dal Modulo III «${letto3}»` : `${elenco.length} ${elenco.length === 1 ? 'file aggiunto' : 'file aggiunti'}`);
  }

  const ingresso = h('input', { id: 'file-dossier', type: 'file', multiple: true, hidden: true, accept: '.pdf,.docx,.doc,.xls,.xlsx,.txt,.rtf,.fdx,.fountain,.md,.jpg,.jpeg,.png', onchange: (e) => { aggiungi(e.target.files); e.target.value = ''; } });
  const zona = h('div.drop', {
    role: 'button', tabindex: '0', 'aria-label': 'Aggiungi documenti',
    onclick: () => ingresso.click(), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ingresso.click(); } },
    ondragover: (e) => { e.preventDefault(); zona.classList.add('over'); }, ondragleave: () => zona.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); zona.classList.remove('over'); aggiungi(e.dataTransfer.files); },
  }, h('strong', 'Trascina qui i documenti del dossier'), h('span.muted', 'Moduli I, II e III, sceneggiatura, curriculum, contratti, deal memo, lettere di intento · PDF, DOCX, XLS'), h('span.btn.s', 'Scegli i file'));

  const daLeggere = () => p.documenti.filter((d) => d.scansione && !d.testo && d.tipo !== 'identita');
  let lettura = null; // { controller, nome, fatte, totale }

  async function leggiScansioni(elenco) {
    const llm = llmAttivo();
    if (!llm) { toast('Claude non è collegato'); return; }
    lettura = { controller: new AbortController(), nome: '', fatte: 0, totale: 0 };
    let lette = 0;
    const errori = [];
    for (const d of elenco) {
      if (lettura.controller.signal.aborted) break;
      const file = FILE_SESSIONE.get(d.id);
      if (!file) { errori.push(`«${d.nome}»: ricarica il file per poterlo leggere`); continue; }
      Object.assign(lettura, { nome: d.nome, fatte: 0, totale: d.pagine || 1 });
      disegna();
      try {
        const { immagini, troncato } = await immaginiScansione(file);
        const r = await trascriviScansione({
          nome: d.nome, tipo: d.tipo, immagini, llm, signal: lettura.controller.signal, opzioni: { modello: S.imp.modello, impegno: 'low' },
          onEvento: (e) => { Object.assign(lettura, e); const el = document.getElementById('avanzamento-scansioni'); if (el) el.textContent = `Lettura di «${d.nome}»: pagina ${e.fatte} di ${e.totale}`; },
        });
        Object.assign(d, { testo: r.testo, trascritto: true, avvisi: [AVVISO_TRASCRIZIONE, ...(troncato ? [`Lette solo le prime ${immagini.length} pagine.`] : [])] });
        if (d.tipo === 'altro') d.tipo = riconosciTipo(d.nome, r.testo);
        // un file dal nome generico può rivelarsi un documento d'identità: il testo letto non si conserva
        if (d.tipo === 'identita') Object.assign(d, { testo: '', trascritto: false, avvisi: ['Riconosciuto come documento d’identità: il testo letto è stato scartato e non viene usato.'] });
        lette++;
        await salva();
      } catch (e) {
        if (e?.codice === 'cancelled') break;
        errori.push(`«${d.nome}»: ${e.message || 'lettura non riuscita'}`);
        if (e?.codice === 'images_unavailable') break;
      }
    }
    lettura = null;
    disegna();
    toast(errori.length ? errori[0] : `${lette} ${lette === 1 ? 'scansione letta' : 'scansioni lette'}`);
  }

  function disegna() {
    svuota(tabella);
    const scansioni = daLeggere();
    if (scansioni.length || lettura) {
      const llm = llmAttivo();
      const pag = scansioni.reduce((a, d) => a + (d.pagine || 1), 0);
      const inMemoria = scansioni.filter((d) => FILE_SESSIONE.has(d.id));
      const daRicaricare = scansioni.length - inMemoria.length;
      metti(tabella, h('div.notice.info', { id: 'avviso-scansioni', style: { marginBottom: '12px' } },
        lettura ? h('div.row', h('span.spin'), h('span', { id: 'avanzamento-scansioni' }, `Lettura di «${lettura.nome}»…`), h('button.btn.s.danger', { type: 'button', onclick: () => lettura.controller.abort() }, 'Interrompi'))
          : h('div.spread',
            h('div', h('strong', `${scansioni.length} ${scansioni.length === 1 ? 'documento è una scansione' : 'documenti sono scansioni'} senza testo. `), `Claude può leggerle come immagini e trascriverle (${pag} ${pag === 1 ? 'pagina' : 'pagine'}), segnalando firme e timbri: senza, contratti e curriculum scansionati non contano nella valutazione.`),
            inMemoria.length ? h('button.btn.primary', { type: 'button', id: 'btn-scansioni', disabled: !llm || !llm.immagini, onclick: () => leggiScansioni(daLeggere().filter((d) => FILE_SESSIONE.has(d.id))) }, inMemoria.length === 1 ? 'Leggi la scansione con Claude' : `Leggi le ${inMemoria.length} scansioni con Claude`) : null),
        !lettura && daRicaricare ? h('div.small', { style: { marginTop: '6px' } }, `${daRicaricare === scansioni.length ? 'Per leggerle' : `Per leggerne ${daRicaricare}`} serve di nuovo il file: dopo la riapertura della pagina le scansioni non restano in memoria. Trascina qui sopra gli stessi file: tipo e letture già fatte si conservano.`) : null,
        !lettura && llm && !llm.immagini ? h('div.small', { style: { marginTop: '6px' } }, 'In questa vista Claude non può ricevere immagini: usa il programma installato sul computer.') : null,
        !lettura && !llm ? h('div.small', { style: { marginTop: '6px' } }, h('a', { href: '#collegamento' }, 'Collega Claude'), ' per leggere le scansioni.') : null));
    }
    if (p.documenti.length) {
      metti(tabella, h('div.tablewrap', h('table',
        h('thead', h('tr', h('th', 'File'), h('th', 'Tipo di documento'), h('th.r', 'Contenuto'), h('th', ''))),
        h('tbody', p.documenti.map((d) => h('tr',
          h('td.fname', d.nome, d.avvisi.map((a) => h('div.small', { style: { color: 'var(--warn)', fontWeight: 400 } }, a))),
          h('td', scelta(null, TIPI, d.tipo, (v) => { d.tipo = v; if (v === 'identita') d.testo = ''; salva().then(disegna); }, { id: `tipo-${d.id}` })),
          h('td.r.num.small', d.tipo === 'identita' ? 'non letto' : d.testo ? `${d.pagine ? `${d.pagine} pag. · ` : ''}${fmt(d.testo.length / 1000, 0)}k caratteri${d.trascritto ? ' · letto da Claude' : ''}` : d.scansione ? `scansione · ${d.pagine || 1} pag.` : dimensione(d.dimensione)),
          h('td.r', h('button.btn.s.ghost', { type: 'button', 'aria-label': `Rimuovi ${d.nome}`, onclick: () => { p.documenti = p.documenti.filter((x) => x.id !== d.id); FILE_SESSIONE.delete(d.id); if (!p.documenti.some((x) => x.tipo === 'modulo3')) p.modulo3 = null; salva().then(disegna); } }, 'Rimuovi'))))))));
    }
    const allegati = verificheAmmissibilita(bando, p.categoriaId, p.anno, p.dati, p.documenti.map((d) => d.tipo)).filter((c) => c.id.startsWith('all_'));
    const mancanti = allegati.filter((c) => c.esito === 'critico').length;
    metti(svuota(lista), h('div.panel',
      h('div.spread', h('h2', 'Allegati previsti dal bando'), h(`span.tag.${mancanti ? 'bad' : 'ok'}`, mancanti ? `${mancanti} obbligatori mancanti` : 'Obbligatori presenti')),
      h('p.muted.small', { style: { margin: '4px 0 8px' } }, 'Il tipo viene riconosciuto dal nome del file: correggilo nella tabella se è sbagliato.'),
      elencoControlli(allegati)));
    const altri = [...controlliFormato(bando, p.documenti), ...controlliIncrociati(bando, p)];
    if (altri.length) lista.append(h('div.panel', { style: { marginTop: '16px' } },
      h('div.spread', h('h2', 'Formato dei file e coerenza con il Modulo III'), h(`span.tag.${altri.some((c) => c.esito === 'critico') ? 'bad' : altri.some((c) => c.esito === 'attenzione') ? 'warn' : 'ok'}`, altri.some((c) => c.esito !== 'ok') ? `${altri.filter((c) => c.esito !== 'ok').length} da sistemare` : 'A posto')),
      elencoControlli(altri)));
  }

  metti(corpo, h('div.stack', ingresso, zona, stato, tabella, lista,
    h('div.row', h('button.btn.primary', { type: 'button', onclick: () => mostra('dati') }, 'Avanti: dati chiave →'))));
  disegna();
}

/* ------------------------------------------------------------------ Dati chiave */

function pannelloLive(p, bando) {
  const griglia = getGriglia(bando, p.categoriaId), cat = getCategoria(bando, p.categoriaId);
  const blocchi = [];
  for (const sez of griglia.sezioni) {
    const quant = sez.criteri.filter((c) => c.tipo === 'fasce');
    if (!quant.length) continue;
    const ris = quant.map((c) => ({ c, r: valutaQuantitativo(c, p.dati, bando) }));
    const tot = ris.reduce((a, x) => a + x.r.punti, 0), max = quant.reduce((a, c) => a + c.max, 0);
    blocchi.push(h('div',
      h('div.spread', h('h3', `Sezione ${sez.id}`), h('span.num', h('strong', fmt(tot)), ` / ${fmt(max)}`)),
      quant.length === sez.criteri.length && cat.soglie?.[sez.id] != null && h(`div.small.${tot >= cat.soglie[sez.id] ? 'muted' : ''}`, { style: tot >= cat.soglie[sez.id] ? {} : { color: 'var(--bad)' } }, `Minimo di sezione ${cat.soglie[sez.id]}: ${tot >= cat.soglie[sez.id] ? 'raggiunto' : 'non raggiunto'}`),
      h('ul.live', ris.map(({ c, r }) => h('li',
        h('div', h('span.num.muted.small', `${c.id} `), c.nome),
        h('div.pts', h('b', r.mancante ? '—' : fmt(r.punti)), ` / ${fmt(c.max)}`),
        !r.mancante && h('div.sub', `${r.valoreTesto}${r.dettaglio ? ` (${r.dettaglio})` : ''} → ${r.fascia}${c.giudizio ? ' · provvisorio' : ''}`),
        r.avvisi.map((a) => h('div.sub.w', a)))))));
  }
  const sugg = suggerimentiQuantitativi(bando, p.categoriaId, p.dati);
  const numerici = verificheAmmissibilita(bando, p.categoriaId, p.anno, p.dati, p.documenti.map((d) => d.tipo)).filter((c) => !c.id.startsWith('all_') && !c.id.startsWith('req_') && c.esito !== 'ok' && c.esito !== 'da_verificare');
  return h('div.stack',
    h('div.panel.stack', h('div', h('div.label', 'Calcolo in tempo reale'), h('h2', 'Punti dai numeri')), blocchi),
    numerici.length ? h('div.panel', h('h3', 'Problemi di ammissibilità'), elencoControlli(numerici)) : null,
    sugg.length ? h('div.panel', h('h3', 'Per salire di fascia'), h('ul.actions', sugg.slice(0, 5).map((x) => h('li', h('div', x.azione), h('div.g', `+${fmt(x.guadagno)}`), h('div.w', `${x.criterio} · ${x.nome}`))))) : null);
}

function schedaDati(corpo, p, bando, mostra) {
  const d = p.dati, terr = bando.territorio || 'regione';
  const laterale = h('div.sticky');
  const aggiorna = () => { metti(svuota(laterale), pannelloLive(p, bando)); salvaPresto(); };
  const n = (et, ogg, k, extra) => campoNumero(et, ogg, k, aggiorna, extra);
  const pianoEl = h('div');

  function disegnaPiano() {
    const cop = coperturaPiano(d);
    const costo = d.economici.costoProduzione;
    metti(svuota(pianoEl), 
      d.piano.length ? h('div.tablewrap', h('table',
        h('thead', h('tr', h('th', 'Voce'), h('th', 'Fonte'), h('th.r', 'Importo €'), h('th', 'Documento nel dossier'), h('th', ''))),
        h('tbody', d.piano.map((r, i) => h('tr',
          h('td', { style: { width: '74px' } }, h('input', { id: `pv-${i}`, type: 'text', value: r.voce || '', 'aria-label': 'Codice voce', oninput: (e) => { r.voce = e.target.value.trim(); aggiorna(); } })),
          h('td', { style: { minWidth: '180px' } }, h('input', { id: `pe-${i}`, type: 'text', value: [r.etichetta, r.denominazione].filter(Boolean).join(' — '), 'aria-label': 'Fonte', oninput: (e) => { r.etichetta = e.target.value; r.denominazione = ''; salvaPresto(); } })),
          h('td.r', { style: { width: '130px' } }, h('input', { id: `pi-${i}`, type: 'number', min: '0', value: r.importo ?? '', 'aria-label': 'Importo', oninput: (e) => { r.importo = e.target.value === '' ? null : Number(e.target.value); aggiorna(); aggiornaTotali(); } })),
          h('td', { style: { minWidth: '170px' } }, r.voce === '1.1' ? h('span.muted.small', 'contributo richiesto') : scelta(null, Object.entries(ETICHETTE_DOC).map(([id, nome]) => ({ id, nome })), r.documento || 'nessuno', (v) => { r.documento = v; aggiorna(); aggiornaTotali(); }, { id: `pd-${i}` })),
          h('td.r', h('button.btn.s.ghost', { type: 'button', 'aria-label': 'Rimuovi fonte', onclick: () => { d.piano.splice(i, 1); disegnaPiano(); aggiorna(); } }, '✕'))))))) : h('div.muted.small', 'Nessuna fonte inserita.'),
      h('div.spread', { style: { marginTop: '10px' } },
        h('button.btn.s', { type: 'button', onclick: () => { d.piano.push({ voce: '', etichetta: '', denominazione: '', importo: null, documento: 'nessuno' }); disegnaPiano(); } }, '+ Aggiungi fonte'),
        h('div.small.num', { id: 'totali-piano' })));
    aggiornaTotali();
    function aggiornaTotali() {
      const c = coperturaPiano(d);
      const el = pianoEl.querySelector('#totali-piano');
      if (el) el.textContent = c.righe ? `Totale piano ${euro(c.totalePiano)}${costo ? ` · costo ${euro(costo)}` : ''} · documentato ${euro(c.documentato)}` : '';
    }
    void cop;
  }

  const origine = p.origineDati;
  const llm = llmAttivo();
  const statoEstr = h('div');
  const compila = async (btn) => {
    btn.disabled = true;
    metti(svuota(statoEstr), h('div.notice', h('span.spin'), ' Claude sta leggendo i documenti per estrarre i dati…'));
    try {
      const r = await estraiDati({ bando, progetto: p, llm, opzioni: { modello: S.imp.modello } });
      unisciDatiModulo(p, r.dati);
      if (r.dati.ripreseIniziate) d.ripreseIniziate = true;
      p.origineDati = { tipo: 'claude', avvisi: r.note };
      await salva(); mostra('dati');
      toast('Dati compilati: controllali prima di proseguire');
    } catch (e) {
      metti(svuota(statoEstr), h('div.notice.bad', e.message));
      btn.disabled = false;
    }
  };

  const modulo = h('div.stack',
    origine?.tipo === 'modulo3' ? h('div.notice.ok', h('strong', 'Dati letti dal Modulo III '), `«${origine.file}». Puoi correggerli qui per simulare scenari diversi: il file originale non viene modificato.`)
      : origine?.tipo === 'claude' ? h('div.notice.info', h('strong', 'Dati compilati da Claude dai documenti. '), 'Controlla ogni valore: i punti della sezione C dipendono da questi numeri.')
        : h('div.notice', h('strong', 'Carica il Modulo III (.xls) nella scheda Documenti '), 'per compilare questi dati in automatico, oppure inseriscili a mano.',
          llm && p.documenti.some((x) => x.testo) ? h('div', { style: { marginTop: '8px' } }, h('button.btn.s', { type: 'button', onclick: (e) => compila(e.currentTarget) }, 'Compila con Claude dai documenti caricati')) : null),
    origine?.avvisi?.length ? h('div.notice.warn', h('strong', origine.tipo === 'modulo3' ? 'Da controllare nel Modulo III:' : 'Note di Claude:'), h('ul', { style: { margin: '6px 0 0', paddingLeft: '18px' } }, origine.avvisi.map((a) => h('li', a)))) : null,
    statoEstr,
    h('div.panel.stack', h('h2', 'Opera'),
      h('div.grid.w', campoTesto('Titolo', d, 'titolo', salvaPresto), campoTesto('Tipologia', d, 'tipologiaOpera', salvaPresto), n('Durata (minuti)', d, 'durataMin')),
      h('label.check', h('input', { id: 'chk-animazione', type: 'checkbox', checked: d.animazione, onchange: (e) => { d.animazione = e.target.checked; aggiorna(); } }), h('span', 'Opera in animazione'))),
    h('div.panel.stack', h('h2', 'Giorni di lavorazione'),
      h('div.grid', n('Pre-produzione, totale', d.giorni, 'prepTot'), n(`Pre-produzione in ${terr}`, d.giorni, 'prepSicilia'), n('Riprese, totale', d.giorni, 'ripreseTot'), n(`Riprese in ${terr}`, d.giorni, 'ripreseSicilia'), n('Post-produzione, totale', d.giorni, 'postTot'), n(`Post-produzione in ${terr}`, d.giorni, 'postSicilia'))),
    h('div.panel.stack', h('h2', 'Cast e troupe'),
      h('p.muted.small', `Solo le figure elencate nel Modulo III; “${terr}” = nati o residenti da almeno sei mesi. Figuranti e comparse non contano.`),
      h('div.grid', n('Componente artistica, totale', d.professionisti, 'artTot'), n(`Artistici di ${terr}`, d.professionisti, 'artSicilia'), n('Cast tecnico, totale', d.professionisti, 'crewTot'), n(`Tecnici di ${terr}`, d.professionisti, 'crewSicilia'))),
    h('div.panel.stack', h('h2', 'Budget e contributo'),
      h('div.grid.w', n('Costo di produzione €', d.economici, 'costoProduzione'), n('Costo ammissibile €', d.economici, 'costoAmmissibile'), n('Contributo richiesto €', d.economici, 'contributoRichiesto'), n(`Spesa ammissibile in ${terr} €`, d.economici, 'spesaSicilia'), n('Producer fee €', d.economici, 'producerFee'))),
    h('div.panel.stack', h('h2', 'Piano finanziario'),
      h('p.muted.small', 'Per ogni fonte indica il documento che la sostiene ed è allegato al dossier. Le risorse proprie contano solo con referenze bancarie; tax credit e contributi pubblici solo se già concessi con atto formale.'),
      pianoEl,
      h('label.check', h('input', { id: 'chk-riprese', type: 'checkbox', checked: d.ripreseIniziate, onchange: (e) => { d.ripreseIniziate = e.target.checked; aggiorna(); } }),
        h('span', `Le riprese in ${terr} sono già iniziate (dopo l’invio dell’istanza): il criterio 5.1 vale il massimo`))),
    h('div.panel.stack', h('h2', 'Requisiti da confermare'),
      h('p.muted.small', 'Il software non può verificarli dai documenti: spuntali quando li hai controllati.'),
      (bando.requisiti || []).map((r) => h('label.check', h('input', { id: `req-${r.id}`, type: 'checkbox', checked: !!d.requisiti[r.id], onchange: (e) => { d.requisiti[r.id] = e.target.checked; salvaPresto(); } }), h('span', r.testo)))),
    h('div.row', h('button.btn.primary', { type: 'button', onclick: () => mostra('valutazione') }, 'Avanti: valutazione →'), h('button.btn', { type: 'button', onclick: () => mostra('report') }, 'Vedi il report')));

  metti(corpo, h('div.cols', modulo, laterale));
  disegnaPiano();
  metti(svuota(laterale), pannelloLive(p, bando));
}

/* ------------------------------------------------------------------ Valutazione */

const STATI = { attesa: ['', 'In attesa'], in_corso: ['accent', 'In lettura'], fatto: ['ok', 'Completato'], errore: ['bad', 'Errore'], interrotto: ['warn', 'Interrotto'] };

function schedaValutazione(corpo, p, bando, mostra) {
  const llm = llmAttivo();
  const griglia = getGriglia(bando, p.categoriaId);
  const area = h('div.stack');
  metti(corpo, area);

  function disegna() {
    const corsa = S.corsa?.progettoId === p.id ? S.corsa : null;
    const piano = pianoValutazione(bando, p, S.imp.commissari);
    const attiva = !!corsa?.attiva;
    const falliti = p.valutazione?.errori?.length || 0;
    const letture = piano.passi.length;
    metti(svuota(area), 
      !llm && S.ambiente.ambiente !== 'attesa' && h('div.notice.warn', h('strong', 'Claude non è collegato. '), 'Per avviare la valutazione ', h('a', { href: '#collegamento' }, 'configura il collegamento'), '. I punti che dipendono dai numeri sono già calcolati nel report.'),
      h('div.panel.stack',
        h('div', h('h2', 'Commissione simulata'),
          h('p.muted', { style: { maxWidth: '70ch', marginTop: '4px' } }, bando.commissione?.descrizione || 'Ogni commissario legge i documenti e assegna i punteggi; il risultato è la media.')),
        h('div.grid.w',
          scelta('Commissari', [{ id: 1, nome: '1 — lettura rapida' }, { id: 3, nome: '3 — i tre esperti esterni' }, { id: 5, nome: '5 — commissione completa' }], S.imp.commissari, (v) => impostazione({ commissari: Number(v) }).then(disegna), { id: 'sel-commissari', disabled: attiva }),
          scelta('Modello', MODELLI.map((m) => ({ id: m.id, nome: `${m.nome} — ${m.nota}` })), S.imp.modello, (v) => impostazione({ modello: v }).then(disegna), { id: 'sel-modello', disabled: attiva }),
          scelta('Lettura', IMPEGNI, S.imp.impegno, (v) => impostazione({ impegno: v }).then(disegna), { id: 'sel-impegno', disabled: attiva })),
        piano.saltate.map((sz) => h('div.notice.warn', h('strong', `Sezione ${sz.id} — ${sz.nome}: `), 'nessun documento leggibile per questa sezione, non verrà valutata. Carica i documenti corrispondenti nella scheda Documenti.')),
        letture ? h('div.muted.small', `${letture} ${letture === 1 ? 'lettura' : 'letture'} di Claude: ${piano.commissari.length} ${piano.commissari.length === 1 ? 'commissario' : 'commissari'} per ${new Set(piano.passi.filter((x) => x.sezione).map((x) => x.sezione)).size} sezioni${piano.passi.some((x) => x.tipo === 'verifica') ? ', più la verifica formale' : ''}. Con sceneggiature lunghe ogni lettura può richiedere alcuni minuti.`)
          : h('div.notice', 'Carica almeno la sceneggiatura, i curriculum o i documenti finanziari per avere qualcosa da valutare.'),
        h('div.row',
          attiva ? h('button.btn.danger', { type: 'button', id: 'btn-stop', onclick: () => corsa.controller.abort() }, 'Interrompi')
            : h('button.btn.primary', { type: 'button', id: 'btn-avvia', disabled: !llm || !letture, onclick: () => lancia(false) }, p.valutazione ? 'Rivaluta da capo' : 'Avvia la valutazione'),
          !attiva && falliti > 0 && llm && h('button.btn', { type: 'button', onclick: () => lancia(true) }, `Riprova ${falliti === 1 ? 'la lettura fallita' : `le ${falliti} letture fallite`}`),
          !attiva && p.valutazione && h('button.btn', { type: 'button', onclick: () => mostra('report') }, 'Vai al report →'))),
      corsa && h('div.stack-s', { id: 'avanzamento' },
        corsa.note.map((nota) => h('div.notice.info', nota)),
        h('ul.steps', corsa.passi.map((x) => {
          const [classe, etichetta] = STATI[x.stato] || STATI.attesa;
          return h('li', h('div.h', h('span', x.etichetta), h(`span.tag.${classe || 'x'}`, x.stato === 'in_corso' && h('span.spin'), etichetta)),
            x.stato === 'errore' && h('div.small', { style: { color: 'var(--bad)', marginTop: '6px' } }, x.messaggio),
            x.stato === 'in_corso' && x.anteprima && h('pre', { 'aria-hidden': 'true' }, h('span', x.anteprima.slice(-600))));
        }))),
      !corsa && p.valutazione && h('div.notice', `Ultima valutazione: ${new Date(p.valutazione.data).toLocaleString('it-IT')} · ${nomeModello(p.valutazione.modello)} · ${p.valutazione.commissari.length} ${p.valutazione.commissari.length === 1 ? 'commissario' : 'commissari'}.`));
    void griglia;
  }

  async function lancia(soloMancanti) {
    const piano = pianoValutazione(bando, p, S.imp.commissari);
    const corsa = S.corsa = {
      progettoId: p.id, attiva: true, controller: new AbortController(), note: [],
      passi: piano.passi.map((x) => ({ id: x.id, etichetta: x.etichetta, stato: 'attesa', anteprima: '' })),
    };
    let inCoda = false;
    const ridisegna = () => { if (inCoda) return; inCoda = true; requestAnimationFrame(() => { inCoda = false; if (S.progetto?.id === p.id && S.scheda === 'valutazione' && area.isConnected) disegna(); }); };
    disegna();
    try {
      const val = await eseguiValutazione({
        bando, progetto: p, llm, signal: corsa.controller.signal,
        opzioni: { commissari: S.imp.commissari, modello: S.imp.modello, impegno: S.imp.impegno },
        precedente: soloMancanti ? p.valutazione : null,
        onEvento: (ev) => {
          if (ev.nota) corsa.note.push(ev.nota);
          const passo = corsa.passi.find((x) => x.id === ev.passo);
          if (passo) {
            passo.stato = ev.stato; if (ev.messaggio) passo.messaggio = ev.messaggio;
            if (ev.testo) passo.anteprima = ev.testo; else if (ev.pensiero) passo.anteprima = ev.pensiero;
          }
          ridisegna();
        },
      });
      const utile = Object.values(val.giudizi).some((l) => l.length) || val.verifica;
      if (utile || !p.valutazione) p.valutazione = val;
      await salva(p);
      corsa.attiva = false;
      if (S.progetto?.id !== p.id) return;
      if (val.interrotta) { toast('Valutazione interrotta'); disegna(); }
      else if (val.errori.length) { toast(`${val.errori.length} ${val.errori.length === 1 ? 'lettura non riuscita' : 'letture non riuscite'}`); disegna(); }
      else { S.corsa = null; toast('Valutazione completata'); mostra('report'); }
    } catch (e) {
      corsa.attiva = false;
      toast(e.message || 'Errore durante la valutazione');
      disegna();
    }
  }
  disegna();
}

export { datiVuoti };
