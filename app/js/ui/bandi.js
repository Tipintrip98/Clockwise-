// Bandi: il catalogo dei fondi (stato, scadenze, regole), il dettaglio di ciascuno con griglia, fonti e
// conoscenza, gli aggiornamenti e la lettura di un nuovo bando da PDF.
import { h, metti, svuota, fmt, euro, toast, bottoneConferma } from './dom.js';
import { S, caricaBandi, llmAttivo, impostazione, salva, apriProgetto } from './app.js';
import { pannelloConfronto } from './confronto.js';
import * as store from '../core/store.js';
import { estraiTesto } from '../core/docs.js';
import { leggiBando } from '../core/engine.js';
import { statisticheEsiti } from '../core/scoring.js';
import { catalogo } from '../core/bandi/indice.js';
import {
  statoBando, simulabilita, etichettaValutazione, riepilogoCatalogo, collegati, calendarioEdizioni, schedaCategoria, areaBando,
  dataEstesa, dataCorta, NOTA_PREVISTA, raggruppaPerStato,
} from '../core/bandi/catalogo.js';
import { elencoBandi, nuovoDossierGuidato, linkEsterno, spiegaNonSimulabile, quandoBando } from './scelta-bando.js';
import { pannelloAggiornamenti, avvisoBando } from './aggiornamenti.js';

const TIPO_CRITERIO = { qualitativo: 'Giudizio della Commissione', fasce: 'Calcolato a fasce', discreto: 'Punteggi fissi' };
const PROVENIENZA = {
  testo_ufficiale: ['ok', 'Griglia trascritta dal testo ufficiale dell’avviso'],
  fonte_secondaria: ['warn', 'Griglia nota da una fonte secondaria, non dal testo ufficiale'],
  non_disponibile: ['x', 'Griglia non disponibile in un testo ufficiale'],
};
const ESITO_VERIFICA = { confermata: ['ok', 'Confermata alla rilettura'], corretta: ['ok', 'Corretta alla rilettura'], dubbia: ['warn', 'Rilettura con dubbi'], respinta: ['bad', 'Non confermata'] };
const CONDIZIONE = { passata: ['x', 'Chiusa'], aperta: ['ok', 'Aperta'], futura: ['accent', 'In arrivo'], prevista: ['warn', 'Prevista'] };
const AMBITO = { nazionale: 'Bando nazionale', europeo: 'Bando europeo', personale: 'Bando aggiunto da te' };

// Ciò che della pagina deve sopravvivere ai ridisegni e al cambio di vista: ricerca, filtro, sezione aperta.
const vista = { ricerca: { testo: '', filtro: 'tutti', ordine: 'stato' }, sezione: 'scheda', pannello: 'elenco', visto: null };

const maiuscola = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');
// I segnaposto e gli altri moduli possono non avere nulla da mostrare (o fallire): la pagina resta in piedi.
const prova = (fn) => { try { return fn() || null; } catch { return null; } };

// Regole di soglia particolari: soglia complessiva su alcune sezioni, minimi su somme di criteri o sezioni, penalità.
function regoleSoglia(b, c) {
  const righe = [];
  if (b.sogliaSuSezioni?.length) righe.push(`soglia complessiva calcolata sulle sezioni ${b.sogliaSuSezioni.join(', ')}`);
  for (const sc of c.soglieCombinate || b.soglieCombinate || []) righe.push(`${sc.etichetta || [...sc.criteri.map((x) => `criterio ${x}`), ...sc.sezioni.map((x) => `sezione ${x}`)].join(' + ')} ≥ ${fmt(sc.minimo)}`);
  for (const p of b.penalita || []) righe.push(`${p.testo}: ${fmt(p.punti)}`);
  return righe.length ? h('div.muted.small', righe.map((r) => h('div', r))) : null;
}

function regola(c) {
  if (c.tipo === 'fasce') return h('div.small.muted', c.fasce.map((f) => `${f.etichetta} → ${fmt(f.punti * c.peso)}`).join(' · '));
  if (c.tipo === 'discreto') return h('div.small.muted', c.valori.map((v) => `${fmt(v.punti)}: ${v.etichetta}`).join(' · '));
  return h('div.small.muted', c.descrizione);
}

const perAnno = (mappa, formato = euro) => {
  const anni = Object.keys(mappa || {}).sort();
  return anni.length ? anni.map((a) => h('div.cat-anno-valore', h('span.muted', `${a} `), formato(mappa[a]))) : null;
};

/* ------------------------------------------------------------------ sezioni del dettaglio */

function sezioneScheda(b, oggi) {
  const calendario = calendarioEdizioni(b, oggi);
  const categorie = b.categorie || [];
  const anno = statoBando(b, oggi).anno || calendario.at(-1)?.anno || Number(oggi.slice(0, 4));
  const simulabile = simulabilita(b).simulabile;
  const griglie = Object.keys(b.griglie || {}).length;
  const periodo = (e) => {
    if (e.condizione === 'prevista') return simulabile ? NOTA_PREVISTA : 'date non ancora pubblicate';
    if (e.dal && e.al) return `dal ${dataCorta(e.dal, e.dal.slice(0, 4) !== e.al.slice(0, 4))} al ${dataEstesa(e.al)}`;
    if (e.al) return `scadenza ${dataEstesa(e.al)}`;
    return 'date non note';
  };
  return [
    categorie.length ? h('div.panel', h('h3', griglie ? 'Categorie, contributo e punteggi minimi' : 'Categorie e contributo'),
      h('div.tablewrap', h('table.cat-categorie',
        h('thead', h('tr', h('th', 'Categoria'), h('th', 'Contributo massimo'), h('th', 'Dotazione'), griglie ? h('th', 'Punteggi minimi') : null)),
        h('tbody', categorie.map((c) => {
          const sc = schedaCategoria(b, c, anno);
          return h('tr',
            h('td', h('div.cat-forte', c.nome),
              sc.durata && h('div.small.muted', `Durata: ${sc.durata}`),
              griglie > 1 && h('div.small.muted', b.griglie[c.griglia]?.nome || `Griglia ${c.griglia}`)),
            h('td.num.small', c.contributo?.percentuale ? `${fmt(c.contributo.percentuale)}% del costo` : '—', perAnno(c.contributo?.massimali), c.contributo?.nota && h('div.muted.cat-prosa', c.contributo.nota)),
            h('td.num.small', perAnno(c.dotazione) || '—'),
            griglie ? h('td.num.small',
              sc.sogliaTotale ? h('div', `${fmt(sc.sogliaTotale)} su ${fmt(sc.punteggioMassimo)} in totale`) : null,
              sc.soglie.length ? h('div.muted', sc.soglie.map((x) => `${x.id} ≥ ${fmt(x.min)}`).join(' · ')) : null,
              regoleSoglia(b, c),
              !sc.sogliaTotale && !sc.soglie.length && !regoleSoglia(b, c) ? '—' : null) : null);
        }))))) : null,

    h('div.panel', h('h3', 'Calendario delle edizioni'),
      calendario.length ? h('ol.cat-cal', calendario.map((e) => h('li', { dataset: { condizione: e.condizione } },
        h('span.anno', String(e.anno)),
        h(`span.tag.${CONDIZIONE[e.condizione][0]}`, CONDIZIONE[e.condizione][1]),
        h('div.d', h('div', maiuscola(periodo(e))),
          e.pubblicato && h('div.small.muted', `Avviso pubblicato il ${dataEstesa(e.pubblicato)}`),
          e.nota && h('div.small.muted', maiuscola(e.nota))))))
        : h('p.muted.small', 'Per questo fondo non sono note date di apertura o di scadenza: controlla la pagina ufficiale.')),

    b.commissione?.descrizione || b.invio || b.spesaTerritorioMinPct ? h('div.panel.stack-s', h('h3', 'Regole in breve'),
      h('dl.guida',
        b.commissione?.descrizione ? [h('dt', 'Commissione'), h('dd', b.commissione.descrizione)] : null,
        b.spesaTerritorioMinPct ? [h('dt', `Spesa minima in ${b.territorio || 'regione'}`), h('dd', `${fmt(b.spesaTerritorioMinPct)}% del contributo richiesto`)] : null,
        b.spesaTerritorioMinSuCostoPct ? [h('dt', `Spesa minima in ${b.territorio || 'regione'}`), h('dd', `${fmt(b.spesaTerritorioMinSuCostoPct)}% del costo di produzione`)] : null,
        b.producerFeeMaxPct ? [h('dt', 'Producer fee'), h('dd', `ammissibile fino al ${fmt(b.producerFeeMaxPct)}% del costo di produzione`)] : null,
        b.invio ? [h('dt', `Invio${b.invio.canale ? ` via ${b.invio.canale}` : ''}`), h('dd', h('div.cat-spezza', b.invio.indirizzo), (b.invio.regole || []).length ? h('ul.cat-punti.small.muted', b.invio.regole.map((r) => h('li', r))) : null)] : null)) : null,

    b.note?.length ? h('div.panel', h('h3', 'Da ricordare'), h('ul.cat-punti', b.note.map((n) => h('li', n)))) : null,
  ];
}

function sezioneGriglia(b) {
  const sim = simulabilita(b);
  return [
    !sim.simulabile ? h('div.notice.warn', h('strong', 'Griglia solo in consultazione. '), sim.spiegazione) : null,
    Object.values(b.griglie || {}).map((g) => h('div.panel', h('h3', g.nome),
      g.sezioni.map((sez) => h('div.cat-sezione',
        h('div.spread', h('h4', `${sez.id} · ${sez.nome}`), h('span.num.small', `fino a ${fmt(sez.max)}`)),
        h('div.tablewrap', h('table.cat-griglia',
          h('tbody', sez.criteri.map((c) => h('tr',
            h('td.num.small', c.id),
            h('td', h('div.cat-forte', c.nome), regola(c)),
            h('td.small.muted', TIPO_CRITERIO[c.tipo]),
            h('td.r.num', fmt(c.max))))))))))),
  ];
}

function sezioneFonti(b, voci, apri) {
  const aff = b.affidabilita || {};
  const ver = b.verifica;
  const [tonoProv, testoProv] = PROVENIENZA[aff.griglia] || (b.predefinito === false ? ['warn', 'Griglia letta da Claude dal PDF che hai caricato'] : PROVENIENZA.non_disponibile);
  const stessoEnte = collegati(voci, b);
  const esiti = [...(b.esitiPubblici || []), ...(b.esiti || []).filter((e) => e.url).map((e) => ({ anno: e.anno, titolo: e.fonte || `Graduatoria ${e.anno}`, url: e.url, contienePunteggi: true }))];
  const collegamenti = [
    b.paginaUfficiale ? { titolo: 'Pagina ufficiale del fondo', url: b.paginaUfficiale, tipo: 'pagina' } : null,
    ...(b.fontiUrl || []).filter((f) => f.url !== b.paginaUfficiale),
  ].filter(Boolean);
  const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  return [
    h('div.panel.stack-s', h('h3', 'Fonti ufficiali'),
      b.fonte && h('p.small', h('strong', 'Testo di riferimento: '), b.fonte),
      collegamenti.length ? h('ul.cat-fonti', collegamenti.map((f) => h('li',
        linkEsterno(f.url, f.titolo || dominio(f.url)),
        h('div.small.muted', [dominio(f.url), f.tipo && f.tipo !== 'pagina' ? f.tipo : null, f.consultato ? `consultata il ${dataEstesa(f.consultato)}` : null].filter(Boolean).join(' · ')))))
        : h('p.muted.small', 'Nessun indirizzo ufficiale registrato per questo bando.'),
      esiti.length ? h('div.stack-s', h('h4', 'Graduatorie pubblicate'),
        h('ul.cat-fonti', esiti.map((e) => h('li', linkEsterno(e.url, e.titolo || `Graduatoria ${e.anno}`) || h('span', e.titolo || `Graduatoria ${e.anno}`),
          h('div.small.muted', [String(e.anno), e.contienePunteggi ? (e.perSezione ? 'con i punteggi per sezione' : 'con i punteggi') : 'senza punteggi'].join(' · ')))))) : null,
      b.revisione && h('p.small.muted', `Scheda aggiornata al ${dataEstesa(b.revisione)}.`)),

    h('div.panel.stack-s', h('h3', 'Come è stata verificata la griglia'),
      h('div.row', h(`span.tag.${tonoProv}`, testoProv), ver?.esito && h(`span.tag.${(ESITO_VERIFICA[ver.esito] || ['x'])[0]}`, `${(ESITO_VERIFICA[ver.esito] || [null, `Verifica: ${ver.esito}`])[1]}${ver.data ? ` · ${dataEstesa(ver.data)}` : ''}`)),
      aff.griglia === 'testo_ufficiale' ? h('p.small.muted.cat-prosa', 'Ogni punteggio massimo, fascia e soglia è stato confrontato con il testo dell’avviso. Qui sotto i passaggi che lo provano.') : null,
      (aff.citazioni || []).map((c) => h('blockquote.cat-citazione', h('cite', c.riferimento || 'Dal testo dell’avviso'), h('p', `«${c.testo}»`))),
      ver?.correzioni?.length ? h('div', h('h4', 'Correzioni fatte alla rilettura'), h('ul.cat-punti.small', ver.correzioni.map((x) => h('li', x)))) : null,
      [...(aff.dubbi || []), ...(ver?.dubbi || [])].length ? h('div.notice.warn', h('strong', 'Punti rimasti dubbi'), h('ul.cat-punti', [...(aff.dubbi || []), ...(ver?.dubbi || [])].map((d) => h('li', d))))
        : aff.griglia === 'testo_ufficiale' ? h('p.small.muted', 'Nessun punto dubbio segnalato.') : null,
      !(aff.citazioni || []).length && !aff.griglia && b.predefinito === false ? h('p.small.muted.cat-prosa', 'Questa griglia è stata ricavata da Claude dal documento che hai caricato: confrontala con il bando prima di fidarti dei punteggi (sezione «Conoscenza»).') : null),

    stessoEnte.length || b.altriBandi?.length ? h('div.panel.stack-s', h('h3', 'Altri bandi dello stesso ente'),
      stessoEnte.length ? h('div.row', stessoEnte.map((x) => h('button.btn.s', { type: 'button', onclick: () => apri(x.id) }, x.nomeBreve || x.nome))) : null,
      b.altriBandi?.length ? h('ul.cat-fonti', b.altriBandi.map((x) => h('li', linkEsterno(x.url, x.nome) || h('strong', x.nome), x.descrizione && h('div.small.muted', maiuscola(x.descrizione))))) : null) : null,
  ];
}

function sezioneConoscenza(b, ridisegna) {
  const stato = h('div');
  const salvaConoscenza = async (lista) => {
    if (b.predefinito) await store.salvaConoscenza(b.id, lista);
    else await store.salvaBando({ ...b, conoscenza: lista });
    await caricaBandi(); ridisegna();
  };
  const aggiungiConoscenza = async (files) => {
    const lista = [...(b.conoscenza || [])];
    for (const f of files) {
      metti(svuota(stato), h('div.notice', h('span.spin'), ` Lettura di «${f.name}»…`));
      try {
        const r = await estraiTesto(f);
        if (!r.testo) { toast(`«${f.name}»: nessun testo leggibile`); continue; }
        lista.push({ id: store.nuovoId(), nome: f.name, testo: r.testo, caratteri: r.testo.length });
      } catch (e) { toast(`«${f.name}»: ${e.message}`); }
    }
    svuota(stato);
    await salvaConoscenza(lista);
  };
  const ingresso = h('input', { id: 'file-conoscenza', type: 'file', multiple: true, hidden: true, accept: '.pdf,.docx,.txt,.md,.xls,.xlsx,.csv', onchange: (e) => { aggiungiConoscenza(e.target.files); e.target.value = ''; } });
  const totCaratteri = (b.conoscenza || []).reduce((a, k) => a + (k.caratteri || 0), 0);
  const jsonArea = h('textarea', { id: 'json-bando', spellcheck: 'false', 'aria-label': 'Griglia del bando in formato JSON' });
  const conEsiti = (b.categorie || []).filter((c) => statisticheEsiti(b, c.id));

  return [
    b.fonti?.length ? h('div.panel.stack',
      h('div.spread', h('h3', 'Conoscenza fissa del programma'), h('span.tag.ok', 'Sempre attiva')),
      h('p.muted.small.cat-prosa', 'Questi documenti ufficiali fanno parte di Clockwise: a ogni valutazione Claude riceve gli articoli dell’avviso che riguardano la sezione in esame e i punteggi reali della graduatoria come metro di giudizio. Non serve caricarli.'),
      h('ul.checklist', b.fonti.map((f) => h('li', h('span.ico.ok', { 'aria-hidden': 'true' }, '✓'), h('div', h('div.t', f.nome), h('div.d', f.dettaglio))))),
      conEsiti.length ? h('div.stack-s',
        h('h4', `Punteggi reali della finestra ${statisticheEsiti(b, conEsiti[0].id).anno}`),
        h('div.tablewrap', h('table',
          h('thead', h('tr', h('th', 'Categoria'), h('th.r', 'Valutati'), h('th.r', 'Finanziati'), h('th.r', 'Primo'), h('th.r', 'Ultimo finanziato'), h('th.r', 'Mediane A · B · C · D'))),
          h('tbody', conEsiti.map((c) => { const st = statisticheEsiti(b, c.id); return h('tr', h('td', c.nome), h('td.r.num', st.valutati), h('td.r.num', st.finanziati), h('td.r.num', fmt(st.primo)), h('td.r.num', fmt(st.ultimoFinanziato)), h('td.r.num.small', Object.values(st.sezioni).map((d) => fmt(d.mediana)).join(' · '))); }))))) : null,
      b.testi?.length ? h('details.more', h('summary', `Leggi il testo dell’avviso (${b.testi.length} articoli)`),
        h('div.stack-s', b.testi.map((a) => h('details.more', h('summary.cat-articolo', a.titolo), h('p.small.cat-testo', a.testo))))) : null) : null,

    h('div.panel.stack',
      h('div', h('h3', 'Conoscenza aggiuntiva'),
        h('p.muted.small.cat-prosa', 'FAQ, verbali, schede di valutazione ricevute, decreti di modifica, graduatorie di altri anni: Claude li legge a ogni valutazione insieme alla conoscenza fissa. Qui finiscono anche i casi reali salvati dal report di un dossier già presentato.')),
      ingresso, stato,
      (b.conoscenza || []).length ? h('div.tablewrap', h('table', h('tbody', b.conoscenza.map((k) => h('tr',
        h('td.fname', k.nome), h('td.r.num.small', `${fmt((k.caratteri || 0) / 1000, 0)}k caratteri`),
        h('td.r', h('button.btn.s.ghost', { type: 'button', onclick: () => salvaConoscenza(b.conoscenza.filter((x) => x.id !== k.id)) }, 'Rimuovi'))))))) : h('div.muted.small', 'Nessun documento aggiuntivo: la valutazione usa solo il testo dell’avviso.'),
      totCaratteri > 60000 && h('div.notice.warn', `Conoscenza molto estesa (${fmt(totCaratteri / 1000, 0)}k caratteri): ogni lettura diventa più lenta${S.ambiente.ambiente === 'app' ? ' e lascia meno spazio alla sceneggiatura' : ' e costosa'}. Tieni solo i documenti utili.`),
      h('div', h('button.btn.s', { type: 'button', onclick: () => ingresso.click() }, '+ Aggiungi documenti'))),

    !b.predefinito ? h('div.panel.stack',
      h('h3', 'Gestione della griglia'),
      b.avvisi?.length ? h('div.notice.warn', h('strong', 'Segnalazioni dalla lettura automatica:'), h('ul.cat-punti', b.avvisi.map((a) => h('li', a)))) : null,
      h('p.muted.small', 'Questa griglia è stata letta da Claude: confrontala con il bando prima di fidarti dei punteggi.'),
      h('div.row',
        h('button.btn.s', { type: 'button', onclick: async () => { await store.salvaBando({ ...b, verificato: b.verificato === false }); await caricaBandi(); ridisegna(); } }, b.verificato === false ? 'Segna come verificata' : 'Segna come da verificare'),
        bottoneConferma('Elimina bando', 'Conferma eliminazione', async () => { await store.eliminaBando(b.id); S.bandoAperto = null; vista.pannello = 'elenco'; await caricaBandi(); toast('Bando eliminato'); ridisegna(); }, 'btn.s.danger')),
      h('details.more', { ontoggle: (e) => { if (e.target.open && !jsonArea.value) { const { conoscenza, ...senza } = b; jsonArea.value = JSON.stringify(senza, null, 2); } } },
        h('summary', 'Correggi la griglia (JSON)'),
        h('div.stack-s', jsonArea,
          h('div', h('button.btn.s', { type: 'button', onclick: async () => {
            try {
              const nuovo = JSON.parse(jsonArea.value);
              if (!nuovo.griglie || !nuovo.categorie) throw new Error('mancano griglie o categorie');
              await store.salvaBando({ ...nuovo, id: b.id, predefinito: false, conoscenza: b.conoscenza || [] });
              await caricaBandi(); toast('Griglia aggiornata'); ridisegna();
            } catch (e) { toast(`JSON non valido: ${e.message}`); }
          } }, 'Salva modifiche'))))) : null,
  ];
}

/* ------------------------------------------------------------------ dettaglio di un bando */

function dettaglio(b, voci, ridisegna, apri, tornaAllElenco) {
  const oggi = new Date().toISOString().slice(0, 10);
  const st = statoBando(b, oggi), sim = simulabilita(b);
  const haGriglia = Object.keys(b.griglie || {}).length > 0;
  const preferito = S.imp.bandoPreferito === b.id;
  const area = areaBando(b);
  const sezioni = [
    ['scheda', 'Scheda', () => sezioneScheda(b, oggi)],
    haGriglia ? ['griglia', 'Griglia di valutazione', () => sezioneGriglia(b)] : null,
    ['fonti', 'Fonti e verifica', () => sezioneFonti(b, voci, apri)],
    sim.simulabile ? ['conoscenza', 'Conoscenza', () => sezioneConoscenza(b, ridisegna)] : null,
  ].filter(Boolean);
  const corpo = h('div.stack', { role: 'tabpanel' });
  const mostra = (id) => {
    const voce = sezioni.find((x) => x[0] === id) || sezioni[0];
    vista.sezione = voce[0];
    for (const t of linguette.children) t.setAttribute('aria-selected', String(t.dataset.id === voce[0]));
    metti(svuota(corpo), voce[2]());
  };
  const linguette = h('div.subnav', { role: 'tablist', 'aria-label': 'Sezioni del bando' }, sezioni.map(([id, nome]) => h('button', { type: 'button', role: 'tab', dataset: { id }, onclick: () => mostra(id) }, nome)));

  const nodo = h('div.stack',
    tornaAllElenco && h('div.cat-indietro', h('button.btn.s.ghost', { type: 'button', id: 'cat-indietro', onclick: tornaAllElenco }, '← Tutti i bandi')),
    h('div.panel.stack.cat-testata', { dataset: { stato: st.codice } },
      h('div.spread.cat-testata-alto',
        h('div', h('div.label', AMBITO[area] || b.regione), h('h2', { id: 'cat-nome-bando', tabindex: '-1' }, b.nome)),
        preferito && h('span.tag.accent', '★ Bando preferito')),
      h('div.row.cat-etichette',
        h(`span.tag.${st.tono}`, st.etichetta),
        quandoBando(st),
        h('span.tag', etichettaValutazione(b)),
        h(`span.tag.${sim.tono}`, sim.simulabile ? `✓ ${sim.etichetta}` : sim.etichetta),
        sim.simulabile && b.verificato !== false && h('span.tag.ok', 'Griglia verificata sul testo ufficiale')),
      (b.ente || b.fonte) && h('div.muted.small', [b.ente, b.fonte].filter(Boolean).join(' · ')),
      b.descrizione && h('p.cat-prosa', b.descrizione),
      sim.simulabile && sim.spiegazione ? h('div.notice.warn', sim.spiegazione) : null,
      spiegaNonSimulabile(b),
      haGriglia || b.sogliaTotale ? h('div.grid.cat-numeri',
        h('div', h('div.label', 'Soglia complessiva'), h('div.num', `${fmt(b.sogliaTotale)} su ${fmt(b.punteggioMassimo || 100)}`)),
        h('div', h('div.label', 'Categorie'), h('div.num', String((b.categorie || []).length))),
        b.commissione?.componenti ? h('div', h('div.label', 'Commissione'), h('div.num', `${fmt(b.commissione.componenti)} componenti`)) : null,
        b.spesaTerritorioMinPct ? h('div', h('div.label', `Spesa minima in ${b.territorio || 'regione'}`), h('div.num', `${fmt(b.spesaTerritorioMinPct)}% del contributo`)) : null) : null,
      h('div.row',
        sim.simulabile && h('button.btn.primary', { type: 'button', id: 'cat-simula', onclick: () => nuovoDossierGuidato({ bandoId: b.id }) }, 'Simula questo bando →'),
        linkEsterno(b.paginaUfficiale, 'Pagina ufficiale', 'btn'),
        sim.simulabile && !preferito && h('button.btn.ghost', { type: 'button', id: 'cat-preferito', onclick: async () => { await impostazione({ bandoPreferito: b.id }); toast(`«${b.nomeBreve || b.nome}» è ora il bando proposto per i nuovi dossier`); ridisegna(); } }, '☆ Usa come bando preferito'))),
    prova(() => avvisoBando(b, ridisegna)),
    sezioni.length > 1 ? linguette : null,
    corpo);
  mostra(vista.sezione);
  return nodo;
}

/* ------------------------------------------------------------------ pagina */

export function vistaBandi(main) {
  const llm = llmAttivo();
  const stato = h('div');
  const zona = h('div.stack');
  let elenco = null;

  const voci = () => catalogo(S.bandi, S.schede);
  // in apertura: il bando chiesto, poi il preferito, poi il primo simulabile nell'ordine in cui l'elenco li mostra
  const predefinito = (v) => v.find((b) => b.id === S.bandoAperto) || v.find((b) => b.id === S.imp.bandoPreferito)
    || raggruppaPerStato(v).flatMap((g) => g.voci).find((b) => b.simulabile !== false) || v[0];

  // Il riquadro degli aggiornamenti sta chiuso in una riga: si apre da solo quando c'è una novità da guardare.
  const scatolaAggiornamenti = (pannello) => {
    if (!pannello) return null;
    const esito = h('span.tag.x');
    const scatola = h('details.more.cat-agg', { id: 'cat-aggiornamenti' }, h('summary', h('span', 'Aggiornamento dei bandi'), esito), pannello);
    const allinea = () => {
      const tag = pannello.querySelector('.agg-testata .tag');
      esito.textContent = tag?.textContent || ''; esito.className = tag?.className || 'tag x'; esito.hidden = !tag;
      if (pannello.querySelector('.agg-novita')) scatola.open = true;
    };
    allinea();
    if (globalThis.MutationObserver) new MutationObserver(allinea).observe(pannello, { childList: true, subtree: true });
    return scatola;
  };

  // Ridisegna tutta la pagina sotto l'intestazione: serve dopo un aggiornamento dei bandi o una modifica alla conoscenza.
  const ridisegna = () => {
    const v = voci();
    const oggi = new Date().toISOString().slice(0, 10);
    const aperto = predefinito(v);
    const unico = v.length <= 1;
    const r = riepilogoCatalogo(v, oggi);
    const colonna = h('div.cat-dettaglio');
    // un bando aperto da un'altra vista (la scelta guidata, un avviso) si mostra subito, anche sugli schermi stretti
    if (S.bandoAperto && S.bandoAperto !== vista.visto) vista.pannello = 'dettaglio';
    vista.visto = aperto?.id || null;
    const cornice = h(`div.catalogo${unico ? '.solo' : ''}`, { dataset: { pannello: unico ? 'dettaglio' : vista.pannello } });
    const stretto = () => !!globalThis.matchMedia?.('(max-width: 900px)').matches;
    const apri = (id) => {
      S.bandoAperto = id; vista.visto = id; vista.pannello = 'dettaglio'; vista.sezione = 'scheda';
      cornice.dataset.pannello = 'dettaglio';
      elenco?.aggiorna({ scelto: id });
      disegnaDettaglio(v.find((b) => b.id === id));
      // su schermo stretto l'elenco lascia il posto alla scheda: lo sguardo (e il fuoco) vanno al nome del bando;
      // su schermo largo il fuoco resta nell'elenco, per scorrere i bandi uno dopo l'altro
      if (stretto()) colonna.querySelector('#cat-nome-bando')?.focus({ preventScroll: true });
      if (stretto() || colonna.getBoundingClientRect().top < 0) window.scrollTo(0, Math.max(0, cornice.getBoundingClientRect().top + window.scrollY - 70));
    };
    const tornaAllElenco = unico ? null : () => { vista.pannello = 'elenco'; cornice.dataset.pannello = 'elenco'; elenco?.focalizza(); };
    const disegnaDettaglio = (b) => metti(svuota(colonna), b ? dettaglio(b, v, ridisegna, apri, tornaAllElenco) : h('div.panel.flat.empty', h('strong', 'Nessun bando'), 'Aggiungi il primo bando dal PDF dell’avviso.'));

    elenco = unico ? null : elencoBandi({ voci: v, scelto: aperto?.id || null, stato: vista.ricerca, id: 'cat', attributo: 'aria-current', ordini: true, alScegli: (b) => apri(b.id) });
    metti(cornice,
      elenco && h('aside.cat-colonna', { 'aria-label': 'Catalogo dei bandi' }, elenco.nodo),
      colonna);
    disegnaDettaglio(aperto);
    metti(svuota(zona),
      scatolaAggiornamenti(prova(() => pannelloAggiornamenti(async () => { await caricaBandi(); ridisegna(); }))),
      !unico && h('p.cat-sintesi', { id: 'cat-sintesi' },
        h('span', h('strong.num', String(r.totale)), ' fondi in catalogo'),
        h('span', h('strong.num', String(r.simulabili)), r.simulabili === 1 ? ' simulabile' : ' simulabili'),
        h('span', h('strong.num', String(r.aperti)), r.aperti === 1 ? ' aperto adesso' : ' aperti adesso'),
        r.inArrivo ? h('span', h('strong.num', String(r.inArrivo)), ' in arrivo') : null),
      cornice);
  };

  const leggi = async (file) => {
    if (!file) return;
    metti(svuota(stato), h('div.notice', h('span.spin'), ` Lettura di «${file.name}»…`));
    try {
      const r = await estraiTesto(file);
      if (!r.testo || r.testo.length < 2000) throw new Error('Nel file non c’è abbastanza testo leggibile: serve il PDF dell’avviso, non una scansione.');
      metti(svuota(stato), h('div.notice', h('span.spin'), ' Claude sta ricavando la griglia di valutazione dal bando: può richiedere qualche minuto…'));
      const { bando, avvisi } = await leggiBando({ testo: r.testo, nomeFile: file.name, llm, opzioni: { modello: S.imp.modello } });
      bando.avvisi = avvisi;
      bando.conoscenza = [{ id: store.nuovoId(), nome: file.name, testo: r.testo, caratteri: r.testo.length }];
      await store.salvaBando(bando);
      await caricaBandi();
      S.bandoAperto = bando.id; vista.pannello = 'dettaglio'; vista.sezione = 'griglia';
      svuota(stato);
      toast('Bando aggiunto: verifica la griglia');
      ridisegna();
    } catch (e) {
      metti(svuota(stato), h('div.notice.bad', e.message || 'Lettura non riuscita.'));
    }
  };
  const ingresso = h('input', { id: 'file-bando', type: 'file', hidden: true, accept: '.pdf,.docx,.txt', onchange: (e) => { leggi(e.target.files[0]); e.target.value = ''; } });

  metti(main,
    h('div.page-head',
      h('div', h('h1', 'Bandi'),
        h('p', 'Il catalogo dei fondi per il cinema e l’audiovisivo: stato, scadenze, categorie e griglie di valutazione, la regola con cui Clockwise calcola i punteggi. Se un bando manca, carica l’avviso: Claude ne ricava criteri, fasce e soglie.')),
      h('div', ingresso, h('button.btn.primary', { type: 'button', id: 'btn-aggiungi-bando', disabled: !llm, title: llm ? '' : 'Collega Claude per leggere un nuovo bando', onclick: () => ingresso.click() }, '+ Aggiungi un bando da PDF'))),
    stato,
    pannelloConfronto(S.progetto, S.bandi, { suDuplica: async (copia) => { await salva(copia); await apriProgetto(copia.id, 'dati'); } }),
    zona);
  ridisegna();
}
