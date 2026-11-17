// Produzione › Green Film: scelta dei criteri del disciplinare (Edizione 03 – 2024), punti, minimo,
// documenti da preparare e scadenze. Le scelte restano nel dossier (p.produzione.greenFilm).
import { h, metti, svuota, fmt, toast, salvaFile, nomeFilePulito, dataBreve } from './dom.js';
import { salvaPresto } from './app.js';
import { getCategoria } from '../core/scoring.js';
import { SEZIONI_GREEN, PREREQUISITO, FONTE_GREEN, MINIMO_GREEN, RIDUZIONE_EMAS, TOTALE_GREEN, EDIZIONE_PRECEDENTE,
  calcolaGreen, suggerimentiGreen, scadenzeGreen, leggiRichiestaGreen, csvGreen, puntiCriterio } from '../core/greenfilm.js';

export function vistaGreenFilm(area, ctx) {
  const { p, bando, prod } = ctx;
  prod.greenFilm = prod.greenFilm || { scelte: {}, prerequisito: {}, emas: false, inizio: '', fine: '' };
  const g = prod.greenFilm;
  g.scelte = g.scelte || {}; g.prerequisito = g.prerequisito || {};
  const cat = (() => { try { return getCategoria(bando, p.categoriaId); } catch { return null; } })();
  const richiesto = !!cat?.greenFilm && !p.dati?.animazione;
  const richiesta = p.documenti.filter((d) => d.tipo === 'green_film' && d.testo).map((d) => ({ nome: d.nome, ...leggiRichiestaGreen(d.testo) })).find((x) => x.edizione) || null;

  const cambia = (id, valore) => { if (valore == null || valore === '' || valore === false || (Array.isArray(valore) && !valore.length)) delete g.scelte[id]; else g.scelte[id] = valore; salvaPresto(); disegna(id); };

  function controllo(c) {
    const s = g.scelte[c.id];
    if (c.tipo === 'fisso') {
      return h('label.gf-voce', h('input', { type: 'checkbox', id: `gf-${c.id}`, checked: s === true, onchange: (e) => cambia(c.id, e.target.checked) }), h('span', `Sì, il requisito sarà rispettato (${fmt(c.max)} ${c.max === 1 ? 'punto' : 'punti'})`));
    }
    if (c.tipo === 'giudizio') {
      return h('label.gf-voce', h('span', 'Punti previsti (li assegna l’organismo di verifica)'),
        h('select', { id: `gf-${c.id}`, onchange: (e) => cambia(c.id, e.target.value === '' ? null : Number(e.target.value)) },
          h('option', { value: '', selected: !s }, 'Non scelto'), Array.from({ length: c.max }, (_, i) => h('option', { value: String(i + 1), selected: Number(s) === i + 1 }, `${i + 1}`))));
    }
    if (c.tipo === 'somma') {
      const attuali = Array.isArray(s) ? s : [];
      return h('div.gf-somma', c.voci.map((v) => h('label.gf-voce', h('input', { type: 'checkbox', id: `gf-${c.id}-${v.id}`, checked: attuali.includes(v.id),
        onchange: (e) => cambia(c.id, e.target.checked ? [...attuali, v.id] : attuali.filter((x) => x !== v.id)) }), h('span', `${v.etichetta} (${fmt(v.punti)})`))));
    }
    return h('select', { id: `gf-${c.id}`, 'aria-label': c.nome, onchange: (e) => cambia(c.id, e.target.value) },
      h('option', { value: '', selected: !s }, 'Non scelto'), c.livelli.map((l) => h('option', { value: l.id, selected: s === l.id }, `${l.etichetta} — ${fmt(l.punti)} ${l.punti === 1 ? 'punto' : 'punti'}`)));
  }

  function disegna(fuoco = null) {
    const k = calcolaGreen(g);
    const sugg = k.solido ? [] : suggerimentiGreen(g, 5);
    const scad = scadenzeGreen(g.inizio, g.fine);
    const pct = Math.min(100, (k.totale / TOTALE_GREEN) * 100), pctMin = (k.minimo / TOTALE_GREEN) * 100;
    metti(svuota(area),
      h('div.panel.stack',
        h('div.spread',
          h('div', h('div.label', 'Certificazione ambientale'), h('h2', 'Green Film')),
          h('div.row', h(`span.tag.${k.raggiunto ? (k.solido ? 'ok' : 'warn') : 'bad'}`, { id: 'gf-esito' }, k.raggiunto ? (k.solido ? 'Minimo raggiunto con margine' : 'Minimo raggiunto, margine stretto') : 'Sotto il minimo'),
            h('span.tag.x', `Edizione ${k.edizione}`))),
        h('p', { style: { maxWidth: '82ch' } }, richiesto
          ? 'Per questo bando e questa categoria la certificazione ambientale è un requisito di ammissibilità: al dossier va allegato il contratto o l’accordo pre-contrattuale per ottenerla, e a rendiconto va documentata la certificazione ottenuta. '
          : 'Per questa categoria il bando non chiede la certificazione ambientale; resta utile per altri bandi e per i criteri di sostenibilità. ',
          'Qui scegli i criteri del disciplinare ufficiale, vedi i punti e ottieni l’elenco dei documenti e delle prove sul set da preparare.'),
        h('div.gf-totale',
          h('div.gf-numero', h('b', { id: 'gf-totale' }, fmt(k.totale)), h('span', ` su ${TOTALE_GREEN} · minimo ${k.minimo}`)),
          h('div.gf-barra', { role: 'img', 'aria-label': `${fmt(k.totale)} punti dichiarati, minimo ${k.minimo}` }, h('i', { style: { width: `${pct}%` }, class: k.raggiunto ? 'ok' : 'bad' }), h('u', { style: { left: `${pctMin}%` } }))),
        h('label.gf-voce', h('input', { type: 'checkbox', id: 'gf-emas', checked: !!g.emas, onchange: (e) => { g.emas = e.target.checked; salvaPresto(); disegna('emas'); } }),
          h('span', `La società di produzione è registrata EMAS (il minimo scende di ${RIDUZIONE_EMAS} punti: da ${MINIMO_GREEN} a ${MINIMO_GREEN - RIDUZIONE_EMAS})`)),
        k.avvisi.map((a) => h(`div.notice.${a.livello === 'critico' ? 'bad' : 'warn'}`, a.testo)),
        richiesta?.avviso ? h('div.notice.warn', { id: 'gf-richiesta' }, h('strong', `«${richiesta.nome}»: `), richiesta.avviso, richiesta.organismo ? ` Organismo di verifica indicato: ${richiesta.organismo}.` : '') : null,
        sugg.length ? h('div.small', h('strong', 'Criteri che darebbero più punti: '), sugg.map((x) => `${x.id} ${x.nome} (+${fmt(x.guadagno)}${x.certo ? '' : ', a giudizio'})`).join(' · '), '.') : null),

      h('div.panel.stack',
        h('div.spread', h('h2', `Prerequisito ${PREREQUISITO.id} · ${PREREQUISITO.nome}`), h(`span.tag.${k.prerequisito.completo ? 'ok' : 'warn'}`, k.prerequisito.completo ? 'Completo' : 'Obbligatorio, da completare')),
        h('p.muted.small', { style: { maxWidth: '85ch' } }, PREREQUISITO.requisito),
        h('div.gf-somma', k.prerequisito.voci.map((v) => h('label.gf-voce', h('input', { type: 'checkbox', id: `gf-pr-${v.id}`, checked: v.fatto, onchange: (e) => { g.prerequisito[v.id] = e.target.checked; salvaPresto(); disegna(`pr-${v.id}`); } }),
          h('span', v.testo, h('span.muted.small', v.quando === 'prima' ? ' · prima delle riprese' : ' · a fine riprese'))))),
        h('p.muted.small', PREREQUISITO.set)),

      SEZIONI_GREEN.map((s) => {
        const sk = k.sezioni.find((x) => x.id === s.id);
        return h('div.panel.stack', { id: `gf-sezione-${s.id}` },
          h('div.spread', h('h2', `${s.id} · ${s.nome}`), h('span.tag.x.num', `${fmt(sk.punti)} / ${fmt(sk.max)}`)),
          s.criteri.map((c) => {
            const punti = puntiCriterio(c, g.scelte[c.id]);
            return h(`div.gf-criterio${punti ? '.scelto' : ''}`,
              h('div.gf-testa', h('span.id', c.id), h('strong', c.nome), h('span.num', punti ? `${fmt(punti)} / ${fmt(c.max)}` : `max ${fmt(c.max)}`)),
              h('p.muted.small', c.requisito),
              controllo(c),
              punti ? h('div.small.gf-prove', h('strong', 'Da presentare: '), c.documenti.join(' · '), '.', c.set ? h('div', h('strong', 'Sul set: '), c.set) : null) : null);
          }));
      }),

      h('div.panel.stack',
        h('h2', 'Scadenze della procedura'),
        h('div.grid.w',
          h('label.field', h('span', 'Inizio delle riprese'), h('input', { type: 'date', id: 'gf-inizio', value: g.inizio || '', onchange: (e) => { g.inizio = e.target.value; salvaPresto(); disegna('inizio'); } })),
          h('label.field', h('span', 'Ultimo giorno di riprese'), h('input', { type: 'date', id: 'gf-fine', value: g.fine || '', onchange: (e) => { g.fine = e.target.value; salvaPresto(); disegna('fine'); } }))),
        scad.length ? h('ul.gf-scadenze', scad.map((x) => h('li', h('strong.num', dataBreve(`${x.data}T12:00:00Z`)), ' — ', x.testo)))
          : h('p.muted.small', 'Inserisci le date delle riprese per vedere quando inviare la richiesta e quando consegnare i documenti.'),
        h('ol.how',
          h('li', 'Nomina il/la Sustainability Manager e l’organismo di verifica.'),
          h('li', 'Scegli i criteri e compila la richiesta online sul sito green.film almeno 15 giorni prima dell’inizio delle riprese.'),
          h('li', 'Durante le riprese l’organismo di verifica visita il set, anche senza preavviso.'),
          h('li', 'A fine riprese consegna i documenti e il report finale; con verifica positiva il soggetto certificatore rilascia il certificato.'),
          h('li', 'Il logo Green Film va nei titoli e nei materiali pubblicitari: «[titolo] è un [logo Green Film]».')),
        richiesto ? h('div.notice.info', 'Per il bando: all’invio basta il contratto o l’accordo pre-contrattuale per la certificazione (in un caso reale è stata accettata la domanda di abilitazione all’uso del marchio, firmata, con la scheda di scelta dei criteri e l’organismo di verifica indicato). A rendiconto va documentata la certificazione ottenuta e la sua visibilità nei titoli e nei materiali promozionali; le spese per ottenerla sono ammissibili se sostenute nel territorio.') : null,
        h('p.muted.small', `Edizione precedente del disciplinare: minimo ${EDIZIONE_PRECEDENTE.minimo} punti su ${EDIZIONE_PRECEDENTE.totale}, con criteri diversi. Le richieste compilate allora non valgono per una nuova domanda.`)),

      h('div.row',
        h('button.btn', { type: 'button', id: 'gf-csv', onclick: async () => { await salvaFile(nomeFilePulito(`green-film-${p.dati.titolo || p.nome}`, 'csv'), csvGreen(g, p.dati.titolo || p.nome), 'text/csv'); toast('Scheda Green Film salvata'); } }, 'Scarica la scheda (CSV)'),
        h('a.btn.s', { href: FONTE_GREEN.url, target: '_blank', rel: 'noopener' }, 'Disciplinare ufficiale'),
        h('a.btn.s', { href: FONTE_GREEN.procedura, target: '_blank', rel: 'noopener' }, 'Procedura di certificazione')),
      h('p.muted.small', { style: { maxWidth: '85ch' } }, `Fonte: ${FONTE_GREEN.titolo}, ${FONTE_GREEN.ente}. I punti dichiarati qui sono una previsione: quelli validi li conferma l’organismo di verifica.`));
    if (fuoco) document.getElementById(`gf-${fuoco}`)?.focus();
  }
  disegna();
}
