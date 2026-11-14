// Confronto dello stesso progetto su più bandi: «Dove conviene presentare questo progetto?».
// Una scheda per bando, con le stesse colonne nello stesso ordine: stato, contributo ottenibile, punti che si
// calcolano dai numeri, profilo del bando. Ogni numero ha la sua spiegazione (al passaggio del puntatore e, per chi
// usa il telefono, nella riga sotto il numero e nella sezione «Come sono calcolati questi numeri»).
import { h, metti, svuota, fmt, euro, toast } from './dom.js';
import { confrontaBandi, duplicaPerBando } from '../core/confronto.js';
import { nuovoId } from '../core/store.js';

const giorno = (iso) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
const pct = (v) => `${fmt(v)}%`;
const urlWeb = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);
let contatore = 0;

const CLASSE_STATO = { aperta: 'ok', futura: 'accent', attesa: 'x', chiusa: 'x', sconosciuta: 'x' };
const ORIGINE_STIMA = { valutazione: 'dalla valutazione del dossier', media: 'media del dossier (famiglia non valutata dal bando di partenza)', numeri: 'calcolato dai numeri' };

function etichette(r) {
  const f = r.finestra;
  const classe = f.condizione === 'aperta' && f.giorni != null && f.giorni <= 7 ? 'warn' : CLASSE_STATO[f.condizione] || 'x';
  return h('div.cfr-tag',
    h(`span.tag.${classe}`, f.testo),
    r.proprio && h('span.tag.accent', 'Bando di questo dossier'),
    !r.categoria.compatibile && h('span.tag.bad', 'Fuori dai limiti di durata'),
    r.categoria.compatibile && r.categoria.ambigua && h('span.tag.warn', { title: r.categoria.motivo }, 'Categoria da confermare'),
    r.daVerificare && h('span.tag.warn', 'Griglia da verificare'));
}

function periodo(f) {
  if (f.dal && f.al) return `Finestra ${f.anno}: dal ${giorno(f.dal)} al ${giorno(f.al)}`;
  if (f.al) return `Finestra ${f.anno}: fino al ${giorno(f.al)}`;
  return f.prossima ? `Edizione ${f.prossima.anno}${f.prossima.periodoAtteso ? `, attesa: ${f.prossima.periodoAtteso}` : ''}` : 'Date non pubblicate';
}

/* ------------------------------------------------------------------ grafici */

/** Barra dei punti: quanti ne arrivano dai numeri (ottenuti e ancora ottenibili) e quanti restano al giudizio. */
function barraPunti(r) {
  const tot = r.profilo.massimo || 1;
  const ottenuti = r.numeri.punti, altri = Math.max(0, r.numeri.massimo - r.numeri.punti), giudizio = Math.max(0, tot - r.numeri.massimo);
  const soglia = r.soglie.totale;
  const descrizione = `Su ${fmt(tot)} punti: ${fmt(ottenuti)} ottenuti dai numeri, altri ${fmt(altri)} calcolabili dai numeri, ${fmt(giudizio)} a giudizio della Commissione${soglia > 0 ? `; soglia complessiva ${fmt(soglia)}` : ''}.`;
  const tratto = (classe, punti, testo) => (punti > 0 ? h(`i.${classe}`, { style: { width: `${(punti / tot) * 100}%` }, title: testo }) : null);
  return h('div.cfr-punti', { role: 'img', 'aria-label': descrizione, title: descrizione },
    tratto('ott', ottenuti, `${fmt(ottenuti)} punti ottenuti dai numeri`),
    tratto('calc', altri, `${fmt(altri)} punti calcolabili dai numeri ma non ottenuti`),
    tratto('giud', giudizio, `${fmt(giudizio)} punti a giudizio della Commissione`),
    soglia > 0 && soglia < tot ? h('u', { style: { left: `${(soglia / tot) * 100}%` }, title: `Soglia complessiva ${fmt(soglia)}` }) : null);
}

/** Elenco di barre allineate (nome, barra, percentuale): ogni barra è una quota del punteggio massimo, sempre su scala 0-100. */
function elencoBarre(voci, classe = '') {
  return h(`ul.cfr-barre${classe}`, voci.map((v) => h('li', { title: v.titolo || null },
    h('span.n', v.nome),
    h('span.b', { 'aria-hidden': 'true' }, v.quota > 0 ? h('i', { style: { width: `${Math.min(100, v.quota)}%` } }) : null),
    h('span.v.num', v.valore || pct(v.quota)))));
}

function legenda() {
  const voce = (classe, testo) => h('span', h(`i.${classe}`, { 'aria-hidden': 'true' }), testo);
  return h('div.cfr-legenda', { 'aria-label': 'Legenda della barra dei punti' },
    voce('ott', 'punti ottenuti dai numeri'), voce('calc', 'calcolabili dai numeri, non ottenuti'), voce('giud', 'a giudizio della Commissione'), voce('soglia', 'soglia complessiva'));
}

/* ------------------------------------------------------------------ parti della scheda */

function datoContributo(r, breve = false) {
  const c = r.contributo;
  let sotto;
  if (c.ottenibile != null) {
    if (breve) sotto = `${pct(c.quotaSulCosto)} del costo${c.limitatoDa === 'massimale' ? ` · massimale ${c.annoMassimale}` : ''}`;
    else if (c.limitatoDa === 'massimale') sotto = `${pct(c.quotaSulCosto)} del costo: vale il massimale ${c.annoMassimale} (la percentuale del ${pct(c.percentuale)} darebbe ${euro(c.teorico)})`;
    else sotto = c.massimale != null ? `${pct(c.percentuale)} del costo, entro il massimale ${c.annoMassimale} di ${euro(c.massimale)}` : `${pct(c.percentuale)} del costo, senza massimale indicato`;
  } else {
    sotto = c.percentuale != null ? `Fino al ${pct(c.percentuale)} del costo${c.massimale != null ? `, entro ${euro(c.massimale)}` : ''}: per l’importo serve il costo di produzione.` : 'Per l’importo serve il costo di produzione.';
  }
  const sm = r.spesaMinima;
  const dove = r.territorio ? `in ${r.territorio}` : 'sul territorio';
  return h('div.cfr-dato',
    h('div.label', 'Contributo ottenibile'),
    h('div.cfr-valore', { title: c.spiegazione }, c.ottenibile != null ? euro(c.ottenibile) : '—'),
    h('div.small.muted', sotto),
    sm ? h('div.small', { title: sm.spiegazione },
      `Spesa minima ${dove}: `, h('strong', sm.euro != null ? euro(sm.euro) : `${pct(sm.percentuale)} ${sm.regola === 'sul_costo' ? 'del costo' : 'del contributo'}`),
      sm.coperta === true && h('span.cfr-esito.ok', breve ? ' ✓ coperta' : ' ✓ coperta dai tuoi numeri'),
      sm.coperta === false && h('span.cfr-esito.bad', breve ? ' ! non coperta' : ' ! sopra la spesa indicata'))
      : breve ? null : h('div.small.muted', `Spesa minima ${dove}: non indicata dal bando.`));
}

function datoPunti(r, breve = false) {
  const n = r.numeri, pr = r.profilo;
  const titolo = n.massimo > 0
    ? `Somma dei punti dei ${n.criteri.length} criteri a fasce che si calcolano dai numeri (${n.criteri.map((c) => c.id).join(', ')}), nell’ipotesi dichiarata.${n.min < n.max ? ` Con la lettura alternativa del bando: da ${fmt(n.min)} a ${fmt(n.max)}.` : ''}`
    : 'In questa griglia nessun criterio si calcola dai numeri.';
  const mancano = n.mancanti.length ? (n.mancanti.length === 1 ? 'manca un dato' : `mancano ${n.mancanti.length} dati`) : '';
  return h('div.cfr-dato',
    h('div.label', 'Punti dai numeri'),
    h('div.cfr-valore', { title: titolo }, n.massimo > 0 && n.calcolati > 0 ? fmt(n.punti) : '—', n.massimo > 0 ? h('small', ` / ${fmt(n.massimo)} calcolabili`) : null),
    barraPunti(r),
    h('div.small.muted',
      n.massimo > 0 ? `${fmt(pr.giudizio.punti)} ${breve ? '' : 'punti '}su ${fmt(pr.massimo)} ${breve ? 'a giudizio' : 'dipendono dal giudizio'}` : `Tutti i ${fmt(pr.massimo)} punti dipendono dal giudizio`,
      r.soglie.totale > 0 ? ` · soglia ${fmt(r.soglie.totale)}` : (breve ? '' : ' · nessuna soglia complessiva'),
      mancano ? ` · ${n.calcolati > 0 ? 'parziale: ' : ''}${mancano}` : ''));
}

function datoProfilo(r, aree) {
  const voci = aree.map((id) => r.profilo.aree.find((a) => a.id === id)).map((a) => ({
    nome: a.nome, quota: a.quota,
    titolo: `${a.nome}: ${fmt(a.punti)} punti su ${fmt(r.profilo.massimo)}${a.famiglie.length ? ` (${a.famiglie.join(', ')})` : ''}`,
  }));
  return h('div.cfr-dato', h('div.label', 'Che cosa premia'), elencoBarre(voci));
}

function rigaStima(r, breve = false) {
  const s = r.stima;
  if (!s || !r.categoria.compatibile) return null;
  const quanto = h('strong', `${fmt(s.totale)} su ${fmt(s.massimo)}`);
  const soglia = s.sogliaTotale > 0 ? ` · soglia ${fmt(s.sogliaTotale)}` : '';
  if (s.reale) {
    return h('div.cfr-stima', { title: s.spiegazione },
      h('span.tag.accent', 'Dalla valutazione del dossier'),
      h('span', 'Punteggio stimato ', quanto, s.completa ? '' : ' (parziale)', soglia));
  }
  return h('div.cfr-stima.ipotesi', { title: s.spiegazione },
    h('span.tag.warn', 'Stima indicativa'),
    h('span', quanto, soglia,
      h('span.muted', breve ? ` — ipotesi: stessa resa della valutazione su «${s.base.nome}».`
        : ` — ipotesi: stessa resa, famiglia per famiglia, ottenuta nella valutazione su «${s.base.nome}». Non è una valutazione.`)));
}

function dettagli(r) {
  const c = r.contributo, n = r.numeri, pr = r.profilo, so = r.soglie, s = r.stima, f = r.finestra;
  const voce = (titolo, ...contenuto) => [h('dt', titolo), h('dd', contenuto)];
  const famiglie = pr.famiglie.map((x) => ({ nome: x.nome, quota: x.quota, valore: `${fmt(x.punti)} · ${pct(x.quota)}`, titolo: `${x.nome} (${x.descrizione}): ${fmt(x.punti)} punti su ${fmt(pr.massimo)}` }));
  return h('details.more.cfr-dettagli',
    h('summary', 'Come sono calcolati questi numeri'),
    h('dl.guida',
      voce('Categoria', h('strong', r.categoria.nome), '. ', r.categoria.motivo),
      voce('Finestra', `${periodo(f)}. ${f.testo}.`, f.nota ? ` ${f.nota}` : '', ` I massimali sono quelli del ${r.anno}.`),
      voce('Contributo ottenibile', c.spiegazione,
        c.regola === 'proporzionale_al_primo' ? ' È il tetto: il primo in graduatoria riceve tutto il contributo richiesto, gli altri una quota in proporzione al punteggio.' : '',
        c.nota ? ` ${c.nota}` : ''),
      voce('Spesa minima sul territorio', r.spesaMinima ? r.spesaMinima.spiegazione : 'Il bando non indica una spesa minima sul territorio.'),
      voce('Contributo richiesto ipotizzato', r.ipotesi.contributoRichiesto != null
        ? `${euro(r.ipotesi.contributoRichiesto)}: ${r.ipotesi.origine === 'dossier' ? 'quello indicato nei Dati chiave' : 'il massimo ottenibile da questo bando'}. Serve ai criteri che rapportano spesa o copertura al contributo.`
        : 'Non calcolabile senza il costo di produzione.'),
      voce('Punti dai numeri', n.massimo > 0 ? [
        h('ul.live', n.criteri.map((x) => h('li',
          h('div', h('span.num.muted', `${x.id} `), x.nome),
          h('div.pts', x.mancante ? '—' : h('b', fmt(x.punti)), ` / ${fmt(x.massimo)}`),
          h(`div.sub${x.mancante ? '.w' : ''}`, x.mancante ? 'Dato mancante nei Dati chiave.' : `${x.valoreTesto} (${x.formula}) → fascia «${x.fascia}»`)))),
        n.min < n.max ? h('p.small.muted', `Dove il testo del bando si presta a due letture, i punti vanno da ${fmt(n.min)} a ${fmt(n.max)}.`) : null,
      ] : 'Nessun criterio di questa griglia si calcola dai numeri: decide tutto il giudizio della Commissione.'),
      voce('Soglie',
        so.totale > 0 ? `Soglia complessiva ${fmt(so.totale)} su ${fmt(so.massimo)}.` : 'Nessuna soglia complessiva.',
        so.dalGiudizio ? ` Con i punti dai numeri servono almeno ${fmt(so.dalGiudizio.punti)} dei ${fmt(so.dalGiudizio.su)} punti a giudizio (${pct(so.dalGiudizio.quota)}).` : '',
        so.sezioni.some((x) => x.minimo != null)
          ? h('ul.cfr-elenco', so.sezioni.filter((x) => x.minimo != null).map((x) => h('li', `Sezione ${x.id} — ${x.nome}: minimo ${fmt(x.minimo)} su ${fmt(x.massimo)}`,
            x.numeri.massimo > 0 ? ` (dai numeri ${fmt(x.numeri.punti)} su ${fmt(x.numeri.massimo)})` : '', x.raggiungibile ? '' : h('strong', ' — non raggiungibile con questi numeri'))))
          : ' Nessun minimo di sezione.'),
      voce('Profilo del bando',
        h('p.small.muted', `Peso di ogni famiglia di criteri sul punteggio massimo. ${fmt(pr.numeri.punti)} punti (${pct(pr.numeri.quota)}) dipendono dai numeri, ${fmt(pr.giudizio.punti)} (${pct(pr.giudizio.quota)}) dal giudizio${pr.fissi.punti > 0 ? `, di cui ${fmt(pr.fissi.punti)} a punteggi fissi (presenza di contratti o accordi)` : ''}.`),
        elencoBarre(famiglie, '.larghe')),
      s && !s.reale ? voce('Stima indicativa',
        h('p.small', s.spiegazione),
        h('ul.live', s.famiglie.map((x) => h('li',
          h('div', x.nome),
          h('div.pts', h('b', fmt(x.punti)), ` / ${fmt(x.massimo)}`),
          h('div.sub', `${pct(x.frazione)} del massimo — ${ORIGINE_STIMA[x.origine]}`)))),
        h('p.small.muted', `Per sezione: ${s.sezioni.map((x) => `${x.id} ${fmt(x.punti)}${x.minimo != null ? ` (minimo ${fmt(x.minimo)})` : ''}`).join(' · ')}.`)) : null,
      s && s.reale ? voce('Punteggio del dossier', s.spiegazione) : null,
      r.note.length ? voce('Da ricordare', h('ul.cfr-elenco', r.note.map((x) => h('li', x)))) : null));
}

/** Pulsante «Crea un dossier per questo bando»: non c'è per il bando che il dossier ha già. */
function azioneDossier(r, ctx) {
  const { progetto, bandi, suDuplica } = ctx;
  const bando = bandi.find((b) => b?.id === r.bandoId);
  if (r.proprio || typeof suDuplica !== 'function' || !bando) return null;
  const b = h(`button.btn.s${r.categoria.compatibile ? '.primary' : ''}`, { type: 'button', dataset: { bando: r.bandoId }, onclick: async () => {
    b.disabled = true;
    try {
      const copia = duplicaPerBando(progetto, bando, r.categoria.id, r.anno, nuovoId);
      await suDuplica(copia);
      b.textContent = 'Dossier creato';
      toast(`Dossier «${copia.nome}» creato: controlla contributo richiesto e requisiti.`);
    } catch (e) {
      b.disabled = false;
      toast(`Dossier non creato: ${e?.message || 'errore imprevisto'}`);
    }
  } }, 'Crea un dossier per questo bando');
  return b;
}

const sottotitolo = (r) => [r.regione && r.regione !== r.nomeBreve ? r.regione : null, r.categoria.nome].filter(Boolean).join(' · ');
const avviso = (testo) => [h('span.ico.attenzione', { 'aria-hidden': 'true' }, '!'), h('span', testo)];

function scheda(r, ctx) {
  const pagina = urlWeb(r.paginaUfficiale);
  return h('li.cfr-scheda', { dataset: { stato: r.finestra.condizione, bando: r.bandoId } },
    h('div.cfr-testa',
      h('span.cfr-pos.num', { 'aria-hidden': 'true' }, String(r.posizione)),
      h('div.cfr-nome', h('h3', r.nomeBreve), h('div.small.muted', sottotitolo(r))),
      etichette(r)),
    h('div.cfr-corpo', datoContributo(r), datoPunti(r), datoProfilo(r, ctx.aree)),
    h('p.cfr-perche', h('span.label', 'Perché'), ' ', r.perche),
    rigaStima(r),
    r.avvertenze.length ? h('ul.cfr-avvisi', r.avvertenze.map((a) => h('li', avviso(a)))) : null,
    h('div.cfr-azioni', azioneDossier(r, ctx), pagina && h('a.btn.s.ghost', { href: pagina, target: '_blank', rel: 'noopener noreferrer' }, 'Pagina ufficiale ↗')),
    dettagli(r));
}

/** Scheda stretta per il cruscotto: nome, contributo, punti e pulsante su una riga; sotto il perché. */
function schedaCompatta(r, ctx) {
  return h('li.cfr-scheda.compatta', { dataset: { stato: r.finestra.condizione, bando: r.bandoId } },
    h('div.cfr-testa',
      h('span.cfr-pos.num', { 'aria-hidden': 'true' }, String(r.posizione)),
      h('div.cfr-nome', h('h3', r.nomeBreve), h('div.small.muted', sottotitolo(r)), etichette(r))),
    datoContributo(r, true), datoPunti(r, true),
    h('p.cfr-perche', h('span.label', 'Perché'), ' ', r.perche),
    rigaStima(r, true),
    r.avvertenze.length ? h('div.small.cfr-nota', avviso([r.avvertenze[0], r.avvertenze.length > 1 ? ` (altre ${r.avvertenze.length - 1} nel confronto completo)` : ''])) : null,
    h('div.cfr-azioni', azioneDossier(r, ctx)));
}

/* ------------------------------------------------------------------ pannello */

/**
 * Riquadro «Dove conviene presentare questo progetto»: lo stesso dossier su tutti i bandi simulabili a catalogo.
 * @param {object} progetto dossier aperto
 * @param {object[]} bandi bandi a catalogo (S.bandi)
 * @param {{ suDuplica?: (copia: object) => any, compatto?: boolean, oggi?: string|Date }} [opzioni]
 *   suDuplica riceve la copia del dossier per il bando scelto (va salvata e, se serve, aperta da chi integra);
 *   compatto mostra i primi tre bandi su una riga ciascuno, con il pulsante per aprire il confronto completo.
 * @returns {HTMLElement|null} null se non c'è un dossier o nessun bando simulabile
 */
export function pannelloConfronto(progetto, bandi, opzioni = {}) {
  if (!progetto || !Array.isArray(bandi)) return null;
  let cfr;
  try { cfr = confrontaBandi(progetto, bandi, opzioni.oggi || new Date()); } catch (e) { console.warn('Confronto tra bandi non disponibile:', e); return null; }
  if (!cfr.righe.length) return null;

  const idTitolo = `cfr-titolo-${++contatore}`;
  const righe = cfr.righe;
  const unico = righe.length === 1;
  // le stesse aree, nello stesso ordine, in tutte le schede: solo così i profili si confrontano a occhio
  const aree = righe[0].profilo.aree.map((a) => a.id).filter((id) => righe.some((r) => r.profilo.aree.find((a) => a.id === id).punti > 0));
  const ctx = { aree, progetto, bandi, suDuplica: opzioni.suDuplica };
  const corpo = h('div.stack');
  let compatto = !!opzioni.compatto;
  const LIMITE = 3;

  const disegna = () => {
    const visibili = compatto ? righe.slice(0, LIMITE) : righe;
    const nascosti = righe.length - visibili.length;
    metti(svuota(corpo),
      unico ? h('div.notice',
        h('strong', 'A catalogo c’è un solo bando simulabile. '),
        'Il confronto si attiva quando ce ne sono almeno due: nuovi bandi arrivano con gli aggiornamenti automatici, oppure puoi aggiungerne uno dalla pagina Bandi caricando il PDF dell’avviso. Intanto, ecco che cosa può dare questo bando al progetto.') : null,
      cfr.avvisi.length ? h('div.notice.warn', cfr.avvisi.join(' ')) : null,
      h('div.notice.info.cfr-ipotesi', h('strong', 'Ipotesi del confronto. '),
        'Il progetto porta in ogni territorio le stesse quote di giorni, professionisti e spesa dei Dati chiave e chiede agli altri bandi il contributo massimo. È un orientamento per scegliere dove presentare, non una valutazione.',
        compatto ? null : h('details', h('summary', 'Leggi le ipotesi per esteso'), h('ul', cfr.ipotesi.map((t) => h('li', t))))),
      legenda(),
      h(`ol.cfr-lista${typeof opzioni.suDuplica === 'function' ? '' : '.senza-azioni'}`, { role: 'list' }, visibili.map((r) => (compatto ? schedaCompatta(r, ctx) : scheda(r, ctx)))),
      compatto ? h('div.row',
        h('button.btn.s', { type: 'button', id: `${idTitolo}-tutti`, onclick: () => { compatto = false; disegna(); } },
          nascosti > 0 ? `Mostra tutti i ${righe.length} bandi con profilo e dettagli` : 'Mostra profilo e dettagli'),
        nascosti > 0 ? h('span.muted.small', `${nascosti === 1 ? 'Resta fuori' : 'Restano fuori'}: ${righe.slice(LIMITE).map((r) => r.nomeBreve).join(', ')}`) : null) : null,
      cfr.esclusi.length && !compatto ? h('p.muted.small', `Non confrontati perché senza griglia a punti: ${cfr.esclusi.map((e) => e.nome).join(', ')}.`) : null);
  };
  disegna();

  const quando = giorno(cfr.oggi);
  return h('section.panel.stack.cfr', { 'aria-labelledby': idTitolo },
    h('div.spread',
      h('div',
        h('h2', { id: idTitolo }, 'Dove conviene presentare questo progetto'),
        h('p.muted', { style: { marginTop: '4px', maxWidth: '78ch' } },
          cfr.progetto.titolo ? `«${cfr.progetto.titolo}»` : 'Questo dossier',
          cfr.progetto.costo != null ? `, costo di produzione ${euro(cfr.progetto.costo)}` : '',
          unico ? `. Situazione al ${quando}.` : `. ${cfr.ordinamento} Situazione al ${quando}.`)),
      h('span.tag.accent', unico ? '1 bando' : `${righe.length} bandi a confronto`)),
    corpo);
}
