// Scelta guidata del bando da simulare: «Quale bando vuoi simulare?» in tre passi (bando, categoria e anno, dossier).
// Qui stanno anche l'elenco del catalogo con ricerca e filtri (lo usa anche la pagina Bandi) e la scelta di
// bando, categoria e finestra nell'intestazione di un dossier.
import { h, metti, svuota, s, fmt, euro, toast } from './dom.js';
import { S, impostazione, nuovoProgetto, salva, apriProgetto, vai } from './app.js';
import { catalogo } from '../core/bandi/indice.js';
import { urlSicuro } from '../core/bandi/schema.js';
import {
  FILTRI, NOTA_PREVISTA, statoBando, simulabilita, etichettaValutazione, raggruppaPerRegione, filtraBandi, contaFiltri,
  opzioniAnno, annoConsigliato, schedaCategoria, nomeDossierProposto, dataEstesa, dataCorta, giorniTra,
} from '../core/bandi/catalogo.js';

const oggiIso = () => new Date().toISOString().slice(0, 10);
const maiuscola = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');
const bandi = (n) => (n === 1 ? '1 bando' : `${n} bandi`);

/** Collegamento a un sito esterno: si apre in una nuova scheda; null se l'indirizzo non è http(s). */
export function linkEsterno(url, testo, classe = '') {
  const href = urlSicuro(url);
  if (!href) return null;
  return h(`a${classe ? `.${classe}` : ''}`, { href, target: '_blank', rel: 'noopener' }, testo, h('span', { 'aria-hidden': 'true' }, ' ↗'), h('span.cat-sr', ' (si apre in una nuova scheda)'));
}

/** Riga «la data che conta» di un bando: scade il…, apre il…, edizione attesa… */
export function quandoBando(st) {
  if (!st.quando) return null;
  const mancano = st.codice === 'aperto' && st.giorni > 1 && st.giorni <= 60 ? ` — mancano ${st.giorni} giorni` : '';
  return h(`span.cat-voce-quando${st.urgente ? '.urgente' : ''}`, `${maiuscola(st.quando)}${mancano}`);
}

function lente() {
  return s('svg', { viewBox: '0 0 20 20', width: 16, height: 16, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' },
    s('circle', { cx: 8.5, cy: 8.5, r: 5.5 }), s('path', { d: 'M13 13l4.5 4.5' }));
}

/* ------------------------------------------------------------------ elenco del catalogo */

// Sotto questo numero di bandi ricerca e filtri sarebbero solo ingombro.
const SOGLIA_STRUMENTI = 6;

/**
 * Elenco dei bandi raggruppato per regione, con ricerca immediata e filtri.
 * `stato` = { testo, filtro } resta a chi chiama, così ricerca e filtro sopravvivono ai ridisegni.
 * Da tastiera: frecce su/giù, Inizio e Fine per scorrere; Invio sceglie; Invio su un bando già scelto conferma.
 * @returns {{ nodo: HTMLElement, cerca: HTMLInputElement, aggiorna: (o?: { voci?: object[], scelto?: string|null }) => void, azzera: () => void, focalizza: () => void }}
 */
export function elencoBandi({ voci, scelto = null, stato = { testo: '', filtro: 'tutti' }, alScegli, alConferma, espansione, id = 'cat', attributo = 'aria-pressed' }) {
  let correnti = voci || [], idScelto = scelto;
  const lista = h('div.cat-lista');
  const conta = h('p.cat-conta.small.muted', { role: 'status' });
  const bottoni = () => [...lista.querySelectorAll('button.cat-voce')];

  const cerca = h('input', {
    id: `${id}-cerca`, type: 'search', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search', placeholder: 'Cerca per regione, ente o nome', 'aria-label': 'Cerca un bando', value: stato.testo,
    oninput: (e) => { stato.testo = e.target.value; disegna(); },
    // freccia giù dalla ricerca: al primo risultato, nell'ordine in cui si vede
    onkeydown: (e) => { if (e.key === 'ArrowDown' && bottoni().length) { e.preventDefault(); const tutti = bottoni(); for (const b of tutti) b.tabIndex = b === tutti[0] ? 0 : -1; tutti[0].focus(); } },
  });
  const numeri = {};
  const filtri = h('div.cat-filtri', { role: 'group', 'aria-label': 'Filtra i bandi' }, FILTRI.map((f) => {
    numeri[f.id] = h('span.num');
    return h('button.cat-filtro', { type: 'button', dataset: { filtro: f.id }, onclick: () => { stato.filtro = f.id; disegna(); } }, f.nome, numeri[f.id]);
  }));
  const strumenti = h('div.cat-strumenti', h('div.cat-cerca', lente(), cerca), filtri);

  const voce = (b, oggi, attiva, sosta) => {
    const st = statoBando(b, oggi), sim = simulabilita(b);
    return h('li',
      h('button.cat-voce', {
        type: 'button', dataset: { id: b.id }, [attributo]: String(attiva), tabindex: sosta ? '0' : '-1',
        onclick: () => { if (idScelto !== b.id || !espansione) alScegli?.(b); },
        ondblclick: () => alConferma?.(b),
        onkeydown: (e) => { if (e.key === 'Enter' && idScelto === b.id && alConferma) { e.preventDefault(); alConferma(b); } },
      },
        h('span.cat-voce-nome', b.nomeBreve || b.nome),
        h(`span.tag.${st.tono}`, st.etichetta),
        quandoBando(st),
        h('span.cat-voce-meta', h('span', etichettaValutazione(b)), h(`span.cat-sim.${sim.tono}`, sim.simulabile ? '✓ ' : '', sim.etichetta))),
      attiva && espansione ? espansione(b) : null);
  };

  function disegna() {
    const oggi = oggiIso();
    const ricco = correnti.length >= SOGLIA_STRUMENTI;
    const fuoco = lista.contains(document.activeElement) ? document.activeElement.dataset?.id : null;
    strumenti.hidden = !ricco;
    if (!ricco) { stato.testo = ''; stato.filtro = 'tutti'; }
    const visibili = filtraBandi(correnti, stato, oggi);
    const quanti = contaFiltri(correnti, stato.testo, oggi);
    for (const b of filtri.children) { b.setAttribute('aria-pressed', String(b.dataset.filtro === stato.filtro)); numeri[b.dataset.filtro].textContent = String(quanti[b.dataset.filtro]); }
    conta.hidden = !ricco;
    conta.textContent = visibili.length === correnti.length ? `${bandi(correnti.length)} in catalogo` : `${visibili.length} su ${bandi(correnti.length)}`;
    const gruppi = raggruppaPerRegione(visibili);
    // il bando raggiungibile con Tab: quello scelto se è visibile, altrimenti il primo nell'ordine dei gruppi
    const sosta = visibili.some((b) => b.id === idScelto) ? idScelto : gruppi[0]?.voci[0]?.id;
    metti(svuota(lista), visibili.length
      ? gruppi.map((g) => h('section.cat-gruppo', { 'aria-label': g.titolo },
        h('h3', h('span', g.titolo), ricco && h('span.num', { 'aria-hidden': 'true' }, String(g.voci.length))),
        h('ul', g.voci.map((b) => voce(b, oggi, b.id === idScelto, b.id === sosta)))))
      : h('div.cat-vuoto', h('strong', 'Nessun bando corrisponde.'), h('span', stato.testo ? ` Nessun risultato per «${stato.testo}»${stato.filtro !== 'tutti' ? ' con questo filtro' : ''}.` : ' Nessun bando con questo filtro in questo momento.'),
        h('div', h('button.btn.s', { type: 'button', onclick: () => { azzera(); cerca.focus(); } }, 'Mostra tutti i bandi'))));
    if (fuoco) (bottoni().find((b) => b.dataset.id === fuoco) || bottoni()[0])?.focus();
  }
  const azzera = () => { stato.testo = ''; stato.filtro = 'tutti'; cerca.value = ''; disegna(); };

  lista.addEventListener('keydown', (e) => {
    const tutti = bottoni(), i = tutti.indexOf(document.activeElement);
    if (i < 0) return;
    const verso = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: tutti.length - 1 }[e.key];
    if (verso == null) return;
    e.preventDefault();
    if (verso < 0) { if (!strumenti.hidden) cerca.focus(); return; }
    const prossimo = tutti[Math.min(verso, tutti.length - 1)];
    for (const b of tutti) b.tabIndex = b === prossimo ? 0 : -1;
    prossimo.focus();
  });

  const nodo = h('div.cat-elenco', strumenti, conta, lista);
  disegna();
  return {
    nodo, cerca, azzera,
    aggiorna: (o = {}) => { if (o.voci) correnti = o.voci; if ('scelto' in o) idScelto = o.scelto; disegna(); },
    focalizza: () => (bottoni().find((b) => b.tabIndex === 0) || bottoni()[0])?.focus(),
  };
}

/* ------------------------------------------------------------------ pezzi comuni alla finestra e alla pagina Bandi */

/** Contributo massimo di una categoria in una riga: «30% del costo · fino a € 1.000.000». */
export function testoContributo(c) {
  const parti = [];
  if (c.percentuale != null && c.percentuale > 0) parti.push(`${fmt(c.percentuale)}% del costo`);
  if (c.massimale) parti.push(`fino a ${euro(c.massimale.valore)}${c.massimale.ereditato ? ` (dato ${c.massimale.anno})` : ''}`);
  return parti.join(' · ') || 'non indicato';
}
/** Punteggi minimi di una categoria in una riga: «65 su 100 in totale · A ≥ 17 · B ≥ 13». */
export function testoMinimi(c) {
  const parti = [];
  if (c.sogliaTotale) parti.push(`${fmt(c.sogliaTotale)} su ${fmt(c.punteggioMassimo)} in totale`);
  for (const x of c.soglie) parti.push(`${x.id}\u00a0≥\u00a0${fmt(x.min)}`);
  return parti.join(' · ') || 'nessun minimo indicato';
}

/** Perché una scheda non si può simulare e che cosa si può fare. `azioneBandi` porta alla pagina Bandi (facoltativa). */
export function spiegaNonSimulabile(b, azioneBandi = null) {
  const sim = simulabilita(b);
  if (sim.simulabile) return null;
  return h('div.cat-perche',
    h('div.notice', h('div.label', 'Non si può simulare'), h('strong', `${sim.motivo}. `), sim.spiegazione),
    sim.alternative.length || azioneBandi ? h('div.stack-s',
      h('div.label', 'Che cosa puoi fare'),
      h('ul.cat-alternative', sim.alternative.map((a) => h('li', a.testo, a.url ? [' ', linkEsterno(a.url, a.tipo === 'pagina' ? 'Apri la pagina ufficiale' : 'Apri')] : null))),
      azioneBandi && h('div', h('button.btn.s', { type: 'button', onclick: azioneBandi }, 'Apri la scheda nella pagina Bandi'))) : null);
}

/* ------------------------------------------------------------------ «Quale bando vuoi simulare?» */

const PASSI = [[1, 'Bando'], [2, 'Categoria e anno'], [3, 'Dossier']];
let aperta = null; // la finestra aperta, se c'è
let ricordo = null; // ultima scelta fatta in questa sessione: categoria e anno si ripropongono per lo stesso bando

/**
 * Apre la finestra «Quale bando vuoi simulare?».
 * alTermine({ bandoId, categoriaId, anno, nome }) a scelta fatta, alTermine(null) se la finestra viene chiusa.
 * primoAvvio: la scelta imposta il bando preferito e non chiede il nome del dossier; si può saltare.
 * bandoId: bando da proporre già scelto (ad esempio dalla pagina Bandi).
 */
export function apriSceltaBando({ alTermine, primoAvvio = false, bandoId = null } = {}) {
  aperta?.chiudi(null);
  const oggi = oggiIso();
  const voci = catalogo(S.bandi, S.schede);
  const simulabili = voci.filter((b) => b.simulabile !== false);
  const proposto = nomeDossierProposto(S.progetti.filter((x) => !x.esempio).map((x) => x.nome));
  const ricerca = { testo: '', filtro: 'tutti' };
  const st = { passo: 1, bando: null, categoriaId: null, anno: null, nome: proposto, preferito: false, preferitoToccato: false };
  const primaDi = document.activeElement;

  const imposta = (b) => {
    st.bando = b;
    if (!b || b.simulabile === false) return;
    const stesso = ricordo?.bandoId === b.id;
    st.categoriaId = stesso && b.categorie.some((c) => c.id === ricordo.categoriaId) ? ricordo.categoriaId : b.categorie[0]?.id;
    st.anno = stesso && opzioniAnno(b, oggi).some((a) => a.anno === ricordo.anno) ? ricordo.anno : annoConsigliato(b, oggi);
    if (!st.preferitoToccato) st.preferito = !S.imp.bandoPreferito || S.imp.bandoPreferito === b.id;
  };
  imposta([bandoId, S.imp.bandoPreferito].map((x) => x && simulabili.find((b) => b.id === x)).find(Boolean) || (simulabili.length === 1 ? simulabili[0] : null));
  const pronto = () => !!st.bando && st.bando.simulabile !== false;

  const annuncio = h('div.cat-sr', { 'aria-live': 'polite' });
  const passi = h('ol.sb-passi', { 'aria-label': 'Passi della scelta' });
  const corpo = h('div.sb-corpo');
  const piede = h('div.sb-piede');
  const titolo = h('h2', { id: 'sb-titolo', tabindex: '-1' }, 'Quale bando vuoi simulare?');
  const dialogo = h('div.dialogo.sb', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sb-titolo' },
    h('div.sb-testa', titolo, h('button.btn.s.ghost', { type: 'button', id: 'sb-chiudi', 'aria-label': primoAvvio ? 'Chiudi: sceglierò il bando più tardi' : 'Chiudi senza creare il dossier', onclick: () => chiudi(null) }, '✕')),
    passi, corpo, piede, annuncio);
  let premutoSulVelo = false;
  const velo = h('div.velo.sb-velo', { onmousedown: (e) => { premutoSulVelo = e.target === velo; }, onclick: (e) => { if (e.target === velo && premutoSulVelo) chiudi(null); } }, dialogo);
  let elenco = null;

  /* --- passo 1: il bando */
  const espansione = (b) => {
    const sim = simulabilita(b);
    if (!sim.simulabile) {
      return h('div.cat-espansa', b.descrizione && h('p.small', b.descrizione),
        spiegaNonSimulabile(b, primoAvvio ? null : () => { chiudi(null); S.bandoAperto = b.id; vai('bandi', true); }));
    }
    return h('div.cat-espansa',
      b.descrizione && h('p.small', b.descrizione),
      h('div.small.muted', [b.ente, `${b.categorie.length === 1 ? '1 categoria' : `${b.categorie.length} categorie`}`, b.sogliaTotale ? `soglia ${fmt(b.sogliaTotale)} su ${fmt(b.punteggioMassimo || 100)}` : null].filter(Boolean).join(' · ')),
      sim.spiegazione && h('div.notice.warn', sim.spiegazione),
      h('div.row',
        h('button.btn.s.primary', { type: 'button', onclick: () => vaiA(2) }, 'Scegli categoria e anno →'),
        linkEsterno(b.paginaUfficiale, 'Pagina ufficiale', 'small')));
  };
  const passoBando = () => {
    elenco = elencoBandi({
      voci, scelto: st.bando?.id || null, stato: ricerca, id: 'sb', espansione,
      alScegli: (b) => { imposta(b); elenco.aggiorna({ scelto: b.id }); disegnaPiede(); disegnaPassi(); },
      alConferma: (b) => { if (b.simulabile !== false) { if (st.bando?.id !== b.id) imposta(b); vaiA(2); } },
    });
    return [
      h('p.muted', primoAvvio
        ? 'Scegli il bando su cui lavorerai più spesso: Clockwise lo proporrà ogni volta che crei un dossier. Puoi cambiarlo quando vuoi, oppure saltare questo passo.'
        : 'Ogni bando ha la sua griglia, le sue categorie e le sue scadenze: scegli quello a cui candidare il progetto.'),
      elenco.nodo,
      h('p.small.muted', simulabili.length < voci.length ? 'I fondi segnati «Solo scheda informativa» non hanno una griglia a punti verificata: li trovi qui per stato e scadenze. ' : '',
        'Se il bando che cerchi non è in elenco, nella pagina Bandi puoi aggiungerlo dal PDF dell’avviso.'),
    ];
  };

  /* --- passo 2: categoria e anno */
  const passoCategoria = () => {
    const b = st.bando;
    const anni = opzioniAnno(b, oggi);
    const stato = statoBando(b, oggi);
    const notaAnno = h('div', { 'aria-live': 'polite' });
    const categorie = h('div.sb-categorie');
    const disegnaAnno = () => {
      const a = anni.find((x) => x.anno === st.anno) || anni[0];
      const giorni = a.condizione === 'aperta' ? giorniTra(oggi, a.al) : null;
      metti(svuota(notaAnno),
        a.condizione === 'prevista' ? h('div.notice.info', h('strong', `Edizione ${a.anno} ${NOTA_PREVISTA}.`), a.nota ? ` ${maiuscola(a.nota)}.` : '')
          : a.condizione === 'aperta' ? h('div.notice.ok', h('strong', `Finestra ${a.anno} aperta`), `${a.dal ? ` dal ${dataEstesa(a.dal)}` : ''} al ${dataEstesa(a.al)}${giorni != null ? ` — ${giorni === 0 ? 'scade oggi' : giorni === 1 ? 'manca 1 giorno' : `mancano ${giorni} giorni`}` : ''}.${a.nota ? ` ${maiuscola(a.nota)}.` : ''}`)
            : a.condizione === 'futura' ? h('div.notice', h('strong', `La finestra ${a.anno} apre il ${dataEstesa(a.dal)}`), ` e chiude il ${dataEstesa(a.al)}.${a.nota ? ` ${maiuscola(a.nota)}.` : ''}`)
              : a.condizione === 'chiusa' ? h('div.notice', h('strong', `La finestra ${a.anno} è chiusa dal ${dataEstesa(a.al)}. `), 'Puoi simulare lo stesso: serve, ad esempio, a confrontare un dossier già presentato con il punteggio ricevuto.')
                : h('div.notice', 'Le date di questa edizione non sono note: controlla la pagina ufficiale del bando.'));
      metti(svuota(categorie), b.categorie.map((cat) => {
        const c = schedaCategoria(b, cat, a.anno);
        return h('label.sb-cat',
          h('input', { type: 'radio', name: 'sb-categoria', value: cat.id, checked: cat.id === st.categoriaId, onchange: () => { st.categoriaId = cat.id; } }),
          h('span.sb-cat-corpo',
            h('span.sb-cat-nome', c.nome),
            h('span.sb-cat-dati',
              h('span', h('span.label', 'Contributo massimo'), h('span.num', testoContributo(c))),
              h('span', h('span.label', `Dotazione ${a.anno}`), h('span.num', c.dotazione ? `${euro(c.dotazione.valore)}${c.dotazione.ereditato ? ` (dato ${c.dotazione.anno})` : ''}` : 'non indicata')),
              h('span', h('span.label', 'Punteggi minimi'), h('span.num', testoMinimi(c))),
              c.durata && h('span', h('span.label', 'Durata dell’opera'), h('span.num', c.durata))),
            c.notaContributo && h('span.small.muted', c.notaContributo)));
      }));
    };
    const altroAnno = (d, a) => !!d && d.slice(0, 4) !== String(a.anno);
    const etichettaAnno = (a) => ({ aperta: `aperta fino al ${dataCorta(a.al, altroAnno(a.al, a))}`, futura: `apre il ${dataCorta(a.dal, altroAnno(a.dal, a))}`, chiusa: 'chiusa', prevista: 'prevista', senza_date: 'date non note' }[a.condizione]);
    disegnaAnno();
    return [
      h('div.sb-scelto',
        h('div', h('div.label', b.regione || 'Bando'), h('div.sb-scelto-nome', b.nome)),
        h(`span.tag.${stato.tono}`, stato.testo)),
      h('fieldset.sb-gruppo', h('legend', 'Anno della candidatura'),
        h('div.sb-anni', anni.map((a) => h(`label.sb-anno${a.prevista ? '.prevista' : ''}`,
          h('input', { type: 'radio', name: 'sb-anno', value: String(a.anno), checked: a.anno === st.anno, onchange: () => { st.anno = a.anno; disegnaAnno(); } }),
          h('span', h('span.sb-anno-n', String(a.anno)), h('span.sb-anno-d', etichettaAnno(a)))))),
        notaAnno),
      h('fieldset.sb-gruppo', h('legend', 'Categoria dell’opera'), categorie),
      anni.length > 1 ? h('details.more', h('summary', 'Confronta gli anni'),
        h('div.tablewrap', h('table',
          h('thead', h('tr', h('th', 'Categoria'), anni.map((a) => h('th.r', `${a.anno}${a.prevista ? ' (prevista)' : ''}`)))),
          h('tbody', b.categorie.map((cat) => h('tr', h('td', cat.nome), anni.map((a) => {
            const c = schedaCategoria(b, cat, a.anno);
            return h('td.r.num.small', c.massimale ? `${c.massimale.ereditato ? '≈ ' : ''}${euro(c.massimale.valore)}` : '—', h('div.muted', c.dotazione ? `dotazione ${c.dotazione.ereditato ? '≈ ' : ''}${euro(c.dotazione.valore)}` : 'dotazione —'));
          })))))),
        h('p.small.muted', 'Per ogni anno: contributo massimo per progetto e dotazione della categoria. Il segno ≈ indica un valore ripreso dall’ultimo anno pubblicato.')) : null,
    ];
  };

  /* --- passo 3: nome del dossier e riepilogo */
  const passoDossier = () => {
    const b = st.bando;
    const cat = b.categorie.find((c) => c.id === st.categoriaId) || b.categorie[0];
    const a = opzioniAnno(b, oggi, st.anno).find((x) => x.anno === st.anno);
    const c = schedaCategoria(b, cat, st.anno);
    const edizione = a.condizione === 'prevista' ? `${a.anno} — ${NOTA_PREVISTA}` : a.condizione === 'senza_date' ? `${a.anno}` : `${a.anno} — ${a.dettaglio}`;
    const riepilogo = h('dl.guida.sb-riepilogo',
      h('dt', 'Bando'), h('dd', b.nome, h('div.muted.small', [b.regione, b.ente].filter(Boolean).join(' · '))),
      h('dt', 'Categoria'), h('dd', c.nome),
      h('dt', 'Edizione'), h('dd', edizione),
      h('dt', 'Contributo massimo'), h('dd.num', testoContributo(c)),
      h('dt', 'Punteggi minimi'), h('dd.num', testoMinimi(c)));
    if (primoAvvio) {
      return [
        h('p', h('strong', 'Clockwise proporrà questo bando ogni volta che crei un dossier. '), 'Categoria e anno li confermi dossier per dossier; il bando preferito si cambia in ogni momento dalla pagina Bandi.'),
        riepilogo,
        h('p.small.muted', 'Dopo la conferma la guida prosegue con un giro di un minuto tra le aree del programma.'),
      ];
    }
    return [
      h('label.field', { for: 'sb-nome' }, h('span', 'Nome del dossier'),
        h('input', { id: 'sb-nome', type: 'text', value: st.nome, maxlength: '120', autocomplete: 'off', oninput: (e) => { st.nome = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); fine(); } } }),
        h('small.muted', 'Di solito è il titolo del film. Potrai cambiarlo in ogni momento.')),
      riepilogo,
      h('label.check', { for: 'sb-preferito' },
        h('input', { id: 'sb-preferito', type: 'checkbox', checked: st.preferito, onchange: (e) => { st.preferito = e.target.checked; st.preferitoToccato = true; } }),
        h('span', 'Usa questo bando per i prossimi dossier', h('div.small.muted', 'Lo troverai già scelto quando ne crei uno nuovo.'))),
      h('p.small.muted', 'Alla creazione si apre la scheda Documenti: lì trascini i file della candidatura.'),
    ];
  };

  /* --- struttura */
  const VISTE = { 1: passoBando, 2: passoCategoria, 3: passoDossier };
  const disegnaPassi = () => metti(svuota(passi), PASSI.map(([n, nome]) => {
    const etichetta = n === 3 && primoAvvio ? 'Conferma' : nome;
    const raggiungibile = n < st.passo;
    const interno = [h('span.n', { 'aria-hidden': 'true' }, n < st.passo ? '✓' : String(n)), h('span.t', etichetta)];
    return h(`li${n < st.passo ? '.fatto' : ''}`, { 'aria-current': n === st.passo ? 'step' : null },
      raggiungibile ? h('button.sb-passo', { type: 'button', 'aria-label': `Torna al passo ${n}: ${etichetta}`, onclick: () => vaiA(n) }, interno) : h('span.sb-passo', h('span.cat-sr', `Passo ${n}: `), interno));
  }));
  const disegnaPiede = () => {
    const indietro = st.passo > 1 ? h('button.btn', { type: 'button', id: 'sb-indietro', onclick: () => vaiA(st.passo - 1) }, '← Indietro')
      : h('button.btn.ghost', { type: 'button', id: 'sb-annulla', onclick: () => chiudi(null) }, primoAvvio ? 'Salta per ora' : 'Annulla');
    const avanti = st.passo < 3
      ? h('button.btn.primary', { type: 'button', id: 'sb-avanti', disabled: !pronto(), onclick: () => vaiA(st.passo + 1) }, 'Avanti →')
      : h('button.btn.primary', { type: 'button', id: 'sb-fine', onclick: fine }, primoAvvio ? 'Usa questo bando' : 'Crea il dossier');
    const suggerimento = st.passo === 1 && !pronto()
      ? h('span.small.muted.sb-suggerimento', st.bando ? 'Questa scheda non si può simulare: scegli un bando segnato «Simulabile».' : 'Scegli un bando dall’elenco per proseguire.') : null;
    metti(svuota(piede), indietro, h('div.row', suggerimento, avanti));
  };
  const vaiA = (n) => {
    if (n > 1 && !pronto()) return;
    st.passo = Math.min(Math.max(1, n), 3);
    const [, nome] = PASSI[st.passo - 1];
    annuncio.textContent = `Passo ${st.passo} di 3: ${st.passo === 3 && primoAvvio ? 'Conferma' : nome}`;
    disegnaPassi();
    metti(svuota(corpo), VISTE[st.passo]());
    disegnaPiede();
    corpo.scrollTop = 0;
    const bersaglio = st.passo === 1 ? (pronto() ? corpo.querySelector('button.cat-voce[tabindex="0"]') : null)
      : st.passo === 2 ? corpo.querySelector('input[name="sb-anno"]:checked') || corpo.querySelector('input[name="sb-anno"]')
        : corpo.querySelector('#sb-nome') || piede.querySelector('#sb-fine');
    (bersaglio || titolo).focus({ preventScroll: st.passo !== 1 });
    if (bersaglio?.id === 'sb-nome') bersaglio.select();
  };

  let inChiusura = false;
  async function fine() {
    if (!pronto() || inChiusura) return;
    inChiusura = true;
    const esito = { bandoId: st.bando.id, categoriaId: st.categoriaId, anno: st.anno, nome: primoAvvio ? '' : st.nome.trim() || proposto };
    ricordo = { bandoId: esito.bandoId, categoriaId: esito.categoriaId, anno: esito.anno };
    // la preferenza si salva prima di proseguire: chi riceve la scelta scrive a sua volta nelle impostazioni
    if (primoAvvio || st.preferito) { try { await impostazione({ bandoPreferito: esito.bandoId }); } catch { /* la scelta vale comunque per questo dossier */ } }
    chiudi(esito);
  }

  // Tasti: in fase di cattura sul documento, così Esc e le frecce non arrivano alla guida iniziale che può essere aperta sotto.
  const focalizzabili = () => [...dialogo.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]')].filter((el) => el.tabIndex >= 0 && el.getClientRects().length);
  const suTasto = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation(); e.preventDefault();
      if (st.passo === 1 && e.target === elenco?.cerca && elenco.cerca.value) elenco.azzera(); else chiudi(null);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.stopPropagation();
    } else if (e.key === 'Tab') {
      const f = focalizzabili();
      if (!f.length) return;
      const dentro = dialogo.contains(document.activeElement);
      if (e.shiftKey && (!dentro || document.activeElement === f[0] || document.activeElement === titolo)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (!dentro || document.activeElement === f[f.length - 1])) { e.preventDefault(); f[0].focus(); }
    }
  };

  function chiudi(esito) {
    if (aperta?.velo !== velo) return;
    aperta = null;
    velo.remove();
    document.removeEventListener('keydown', suTasto, true);
    document.body.classList.remove('sb-aperta');
    if (primaDi?.isConnected && primaDi !== document.body) primaDi.focus({ preventScroll: true });
    try { Promise.resolve(alTermine?.(esito)).catch((e) => toast(`Operazione non riuscita: ${e?.message || 'errore imprevisto'}`)); }
    catch (e) { toast(`Operazione non riuscita: ${e?.message || 'errore imprevisto'}`); }
  }

  aperta = { velo, chiudi };
  document.body.append(velo);
  document.body.classList.add('sb-aperta');
  document.addEventListener('keydown', suTasto, true);
  vaiA(1);
  // con il mouse si parte dalla ricerca; con il dito no, per non aprire subito la tastiera sullo schermo
  if (document.activeElement === titolo && elenco && !elenco.cerca.closest('[hidden]') && globalThis.matchMedia?.('(pointer: fine)').matches) elenco.cerca.focus();
}

/** Vero se la finestra di scelta è aperta. */
export const sceltaBandoAperta = () => !!aperta;

/** Apre la scelta guidata e, a scelta fatta, crea il dossier e lo apre sui documenti. */
export function nuovoDossierGuidato(preselezione = {}) {
  apriSceltaBando({
    ...preselezione,
    alTermine: async (scelta) => {
      if (!scelta) return;
      const p = nuovoProgetto(scelta.nome, scelta);
      await salva(p);
      await apriProgetto(p.id, 'documenti');
    },
  });
}

/* ------------------------------------------------------------------ nell'intestazione di un dossier */

/**
 * Scelta di bando, categoria e finestra dentro un dossier. Gli anni sono quelli noti più l'edizione successiva
 * attesa (marcata «prevista»); cambiare bando o categoria chiede conferma se c'è già una valutazione, perché la cancella.
 */
export function sceltaNelDossier(p, bando) {
  const oggi = oggiIso();
  const anni = opzioniAnno(bando, oggi, p.anno);
  const annoScelto = anni.find((a) => a.anno === Number(p.anno));
  const conferma = h('div');
  const applica = async (modifiche, idFuoco) => {
    Object.assign(p, modifiche);
    await salva();
    vai('progetto', true);
    requestAnimationFrame(() => document.getElementById(idFuoco)?.focus({ preventScroll: true }));
  };
  // Il browser dell'app non mostra finestre di conferma: la domanda compare sotto i campi. Il campo torna subito
  // al valore in uso, così ciò che si legge è sempre lo stato vero del dossier; il cambio avviene solo dopo la conferma.
  const chiedi = (select, valoreInUso, domanda, motivo, etichetta, azione) => {
    select.value = valoreInUso;
    const riquadro = h('div.notice.warn.cat-conferma', { role: 'group', 'aria-label': 'Conferma del cambio', tabindex: '-1' },
      h('div', h('strong', domanda), ' La valutazione già fatta verrà cancellata: ', motivo, ' Documenti e dati chiave restano.'),
      h('div.row', h('button.btn.s.danger', { type: 'button', id: 'conferma-cambio', onclick: azione }, etichetta),
        h('button.btn.s', { type: 'button', id: 'annulla-cambio', onclick: () => { svuota(conferma); select.focus(); } }, 'Annulla')));
    metti(svuota(conferma), riquadro);
    riquadro.focus();
  };

  const opzione = (b) => h('option', { value: b.id, selected: b.id === bando.id }, b.nomeBreve || b.nome);
  const gruppi = raggruppaPerRegione(S.bandi);
  const selBando = h('select', { id: 'sel-bando', onchange: (e) => {
    const nuovo = S.bandi.find((x) => x.id === e.target.value);
    if (!nuovo || nuovo.id === bando.id) return;
    const cambia = () => applica({ bandoId: nuovo.id, categoriaId: nuovo.categorie[0].id, anno: annoConsigliato(nuovo, oggi), valutazione: null }, 'sel-bando');
    if (p.valutazione) chiedi(selBando, bando.id, `Passare a «${nuovo.nomeBreve || nuovo.nome}»?`, 'il nuovo bando ha un’altra griglia e i punteggi assegnati da Claude non varrebbero più.', 'Cambia bando', cambia);
    else cambia();
  } }, gruppi.length > 1 ? gruppi.map((g) => h('optgroup', { label: g.titolo }, g.voci.map(opzione))) : S.bandi.map(opzione));

  const selCategoria = h('select', { id: 'sel-categoria', onchange: (e) => {
    const id = e.target.value;
    if (id === p.categoriaId) return;
    const cambia = () => applica({ categoriaId: id, valutazione: null }, 'sel-categoria');
    if (p.valutazione) chiedi(selCategoria, p.categoriaId, `Passare alla categoria «${bando.categorie.find((c) => c.id === id)?.nome || id}»?`, 'un’altra categoria può avere griglia e punteggi minimi diversi.', 'Cambia categoria', cambia);
    else cambia();
  } }, bando.categorie.map((c) => h('option', { value: c.id, selected: c.id === p.categoriaId }, c.nome)));

  const selAnno = h('select', { id: 'sel-anno', onchange: (e) => applica({ anno: Number(e.target.value) }, 'sel-anno') },
    anni.map((a) => h('option', { value: String(a.anno), selected: a.anno === Number(p.anno) }, a.condizione === 'senza_date' ? String(a.anno) : `${a.anno} — ${a.dettaglio}`)));

  const campo = (etichetta, select) => h('label.field', { for: select.id }, h('span', etichetta), select);
  return h('div.stack-s.cat-dossier',
    h('div.grid.w', campo('Bando', selBando), campo('Categoria dell’opera', selCategoria), campo('Finestra', selAnno)),
    annoScelto?.prevista ? h('div.notice.info.small', h('strong', `Edizione ${annoScelto.anno} ${NOTA_PREVISTA}.`), annoScelto.nota ? ` ${maiuscola(annoScelto.nota)}.` : '') : null,
    conferma);
}
