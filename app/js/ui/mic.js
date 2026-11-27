// Dossier › «Bandi MiC»: lo stesso progetto sulle griglie dei contributi selettivi del Ministero (bando 2026), con i
// punteggi in una sezione a parte rispetto alla valutazione sul bando del dossier, e il confronto con le graduatorie
// reali 2025. Le scelte restano nel dossier (p.mic).
import { h, metti, svuota, fmt, euro } from './dom.js';
import { S, salvaPresto } from './app.js';
import { lineeMic, lineaPredefinita, stimaMic } from '../core/mic.js';
import { NOMI_FAMIGLIA } from '../core/confronto.js';

const ORIGINE = {
  valutazione: ['ok', 'dalla valutazione'], media: ['warn', 'media dei criteri giudicati'], dichiarato: ['ok', 'dichiarato'],
  da_dichiarare: ['x', 'da dichiarare'], manca: ['x', 'serve la valutazione'],
};

export function schedaMic(corpo, p, bando, mostra) {
  const linee = lineeMic(S.bandi);
  if (!linee.length) {
    metti(corpo, h('div.panel.flat.empty', h('strong', 'Bandi MiC non disponibili'), 'Nel catalogo in uso non ci sono i contributi selettivi del Ministero della cultura. Controlla gli aggiornamenti dalla pagina Bandi.'));
    return;
  }
  p.mic = p.mic || {};
  p.mic.scelte = p.mic.scelte || {};
  if (!linee.some((l) => l.id === p.mic.linea)) p.mic.linea = lineaPredefinita(p, S.bandi);
  const area = h('div.stack');

  function disegna(fuoco = null) {
    const st = stimaMic(p, S.bandi, p.mic.linea, p.mic.scelte);
    const scegliLinea = h('select', { id: 'mic-linea', 'aria-label': 'Linea del bando MiC', onchange: (e) => { p.mic.linea = e.target.value; salvaPresto(); disegna('mic-linea'); } },
      linee.map((l) => h('option', { value: l.id, selected: l.id === p.mic.linea }, `${l.nome} — ${l.bando.nomeBreve || l.bando.nome}`)));
    const fissi = st.sezioni.filter((s) => s.fissa).flatMap((s) => s.criteri);

    const testa = h('div.panel.stack',
      h('div.spread',
        h('div', h('div.label', 'Ministero della cultura · contributi selettivi alla produzione'), h('h2', 'Il dossier sulle griglie MiC')),
        h('span.tag.warn', 'Stima indicativa, non una valutazione')),
      h('p', { style: { maxWidth: '84ch' } }, 'Qui vedi, separati dalla valutazione sul bando del dossier, i punti che lo stesso progetto otterrebbe sulla griglia del bando MiC 2026. ',
        'Per i criteri di qualità si riporta la stessa quota del massimo ottenuta nella valutazione del dossier, famiglia per famiglia; i tre criteri a punteggio fisso valgono per ciò che dichiari qui sotto.'),
      h('label.field', { style: { maxWidth: '70ch' } }, h('span', 'Linea di contributo'), scegliLinea),
      st.senzaValutazione
        ? h('div.notice.info', { id: 'mic-senza-valutazione' }, h('strong', 'Manca la valutazione del dossier. '), 'La stima parte dai punteggi dei commissari simulati: ', h('button.btn.s', { type: 'button', onclick: () => mostra('valutazione') }, 'Vai alla Valutazione'))
        : h('div.mic-totale',
          h('div.mic-numero', h('b', { id: 'mic-totale' }, fmt(st.totale)), h('span', ` su ${fmt(st.massimo)} · minimo ${fmt(st.sogliaTotale)}`)),
          h(`span.tag.${st.sopraSoglia ? 'ok' : 'bad'}`, { id: 'mic-esito' }, st.sopraSoglia ? 'Sopra i minimi del bando' : st.sezioniSotto.length ? `Sotto il minimo del criterio ${st.sezioniSotto.join(', ')}` : 'Sotto il minimo totale'),
          h('span.muted.small', `Qualità (A–E): ${fmt(st.qualita.punti)} su ${fmt(st.qualita.massimo)} · punteggi fissi (F–H): ${fmt(st.fissi.punti)} su ${fmt(st.fissi.massimo)} · base: ${st.base.nome}, ${fmt(st.base.totale)} su ${fmt(st.base.massimo)}`)),
      st.daDichiarare ? h('div.notice.warn', { id: 'mic-da-dichiarare' }, `${st.daDichiarare} ${st.daDichiarare === 1 ? 'criterio a punteggio fisso non è ancora dichiarato e vale' : 'criteri a punteggio fisso non sono ancora dichiarati e valgono'} 0 punti: sceglili qui sotto.`) : null);

    const dichiarazioni = h('div.panel.stack',
      h('h2', 'Criteri a punteggio fisso'),
      h('p.muted.small', { style: { maxWidth: '84ch' } }, 'Non dipendono dal giudizio della Commissione: il punteggio scatta se la condizione è soddisfatta e documentata. Scegli ciò che vale per il progetto.'),
      fissi.map((c) => h('label.field.mic-fisso', h('span', `${c.id} · ${c.nome} (fino a ${fmt(c.max)} ${c.max === 1 ? 'punto' : 'punti'})`),
        h('select', { id: `mic-${c.id}`, onchange: (e) => { if (e.target.value === '') delete p.mic.scelte[c.id]; else p.mic.scelte[c.id] = Number(e.target.value); salvaPresto(); disegna(`mic-${c.id}`); } },
          h('option', { value: '', selected: c.scelto == null }, 'Da dichiarare'),
          c.valori.map((v) => h('option', { value: String(v.punti), selected: c.scelto === v.punti }, `${v.etichetta} — ${fmt(v.punti)} ${v.punti === 1 ? 'punto' : 'punti'}`))),
        c.descrizione ? h('span.muted.small', c.descrizione) : null)));

    const tabella = h('div.panel.stack',
      h('h2', 'Punteggi sulla griglia MiC, criterio per criterio'),
      h('div.tablewrap.intera', h('table.mic-tab',
        h('thead', h('tr', h('th', 'Criterio'), h('th.r', 'Punti'), h('th.r', 'Massimo'), h('th.r', 'Minimo'), h('th', 'Da dove viene'))),
        h('tbody', st.sezioni.flatMap((s) => [
          h('tr.mic-sezione', { dataset: { sezione: s.id } }, h('td', h('strong', `${s.id} · ${s.nome}`)), h('td.r.num', h('strong', s.punti == null ? '—' : fmt(s.punti))), h('td.r.num', fmt(s.massimo)),
            h('td.r.num', s.minimo == null ? '—' : fmt(s.minimo)), h('td', s.sopra === false ? h('span.tag.bad', 'sotto il minimo') : s.sopra ? h('span.tag.ok', 'sopra il minimo') : '')),
          ...s.criteri.map((c) => { const [tono, testo] = ORIGINE[c.origine] || ORIGINE.manca; return h('tr', h('td.mic-voce', `${c.id} · ${c.nome}`), h('td.r.num', c.punti == null ? '—' : fmt(c.punti)), h('td.r.num', fmt(c.max)), h('td', ''),
            h('td.small', h(`span.tag.${tono}`, testo), c.origine === 'valutazione' && c.famiglia ? h('span.muted', ` ${NOMI_FAMIGLIA[c.famiglia] || ''}`) : '')); }),
        ])))),
      !st.senzaValutazione && st.senzaRiscontro ? h('p.small.muted', `${fmt(st.senzaRiscontro)} punti di massimo riguardano criteri che il bando del dossier non valuta: per questi si è usata la media dei criteri giudicati.`) : null);

    const reali = !st.senzaValutazione && st.confronti.length ? h('div.panel.stack', { id: 'mic-reali' },
      h('div.spread', h('h2', 'Rispetto alle graduatorie reali 2025'), h('span.tag.warn', 'Griglia 2025, diversa: confronto in quota del massimo')),
      h('p.muted.small', { style: { maxWidth: '84ch' } }, `La stima vale il ${fmt(st.quota)}% del massimo del bando 2026. Nelle graduatorie 2025 della stessa linea, con la stessa quota del massimo di allora:`),
      h('div.tablewrap', h('table',
        h('thead', h('tr', h('th', 'Sessione'), h('th.r', 'Progetti'), h('th.r', 'Finanziati'), h('th.r', 'Ultimo finanziato'), h('th.r', 'La stima varrebbe'), h('th.r', 'Posto'), h('th', 'Esito'))),
        h('tbody', st.confronti.map(({ atto, statistiche: x, collocazione: c }) => h('tr',
          h('td', h('a', { href: atto.url, target: '_blank', rel: 'noopener' }, atto.sessione)), h('td.r.num', x.presentati), h('td.r.num', x.finanziati),
          h('td.r.num', `${fmt(x.ultimoFinanziato)} su ${fmt(c.massimo)} (${fmt(x.quotaUltimo)}%)`), h('td.r.num', `${fmt(c.punti)} su ${fmt(c.massimo)}`), h('td.r.num', `${c.posizione}° su ${c.su}`),
          h('td', h(`span.tag.${c.finanziabile ? 'ok' : 'bad'}`, c.finanziabile ? 'in zona finanziamento' : 'sotto l’ultimo finanziato'))))))),
      st.concorrenza ? h('div.stack', { id: 'mic-concorrenza' },
        h('h3', 'Quanti punti servono per essere finanziati'),
        h('p.small', { style: { maxWidth: '84ch' } }, `La soglia di ${fmt(st.sogliaTotale)} punti rende il progetto ammissibile, non finanziato. Nel ${st.concorrenza.anno} la linea ha ${euro(st.concorrenza.perSessione)} per sessione; con il contributo mediano assegnato nelle graduatorie reali (${euro(st.concorrenza.assegnatoMediano)}) si finanziano circa ${st.concorrenza.finanziabili} progetti a sessione. Allora l'${st.concorrenza.finanziabili}° finanziato aveva ${st.concorrenza.quote.map((q) => `${fmt(q.punti)}/${fmt(q.massimo)} (${fmt(q.quota)}%)`).join(' e ')}: sulla griglia attuale vuol dire circa ${fmt(st.concorrenza.punti.min)}–${fmt(st.concorrenza.punti.max)} punti su ${fmt(st.massimo)}.`),
        h('p', h(`span.tag.${st.concorrenza.esito === 'dentro' ? 'ok' : st.concorrenza.esito === 'al_limite' ? 'warn' : 'bad'}`, st.concorrenza.esito === 'dentro' ? 'La stima è sopra questa soglia' : st.concorrenza.esito === 'al_limite' ? 'La stima è al limite di questa soglia' : 'La stima è sotto questa soglia'), ` ${fmt(st.totale)} su ${fmt(st.massimo)}.`)) : null,
      h('p.small.muted', { style: { maxWidth: '84ch' } }, 'È un ordine di grandezza: i criteri e i massimi del 2025 non sono quelli del 2026, le richieste cambiano da sessione a sessione e la stima non legge i documenti con gli occhi della Commissione ministeriale. I punteggi reali completi sono nella pagina Bandi, scheda del bando, sezione «Punteggi reali».')) : null;

    metti(svuota(area), testa, dichiarazioni, tabella, reali);
    if (fuoco) document.getElementById(fuoco)?.focus();
  }
  metti(corpo, area);
  disegna();
}
