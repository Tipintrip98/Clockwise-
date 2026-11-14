// Bandi: griglie di valutazione, conoscenza aggiuntiva, lettura di un nuovo bando.
import { h, metti, svuota, fmt, euro, toast, bottoneConferma } from './dom.js';
import { S, caricaBandi, llmAttivo, render } from './app.js';
import * as store from '../core/store.js';
import { estraiTesto } from '../core/docs.js';
import { leggiBando } from '../core/engine.js';
import { normalizzaBando } from '../core/prompts.js';

const TIPO_CRITERIO = { qualitativo: 'Giudizio della Commissione', fasce: 'Calcolato a fasce', discreto: 'Punteggi fissi' };

function regola(c) {
  if (c.tipo === 'fasce') return h('div.small.muted', c.fasce.map((f) => `${f.etichetta} → ${fmt(f.punti * c.peso)}`).join(' · '));
  if (c.tipo === 'discreto') return h('div.small.muted', c.valori.map((v) => `${fmt(v.punti)}: ${v.etichetta}`).join(' · '));
  return h('div.small.muted', c.descrizione);
}

function dettaglio(b, ridisegna) {
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
  const jsonArea = h('textarea', { id: 'json-bando', spellcheck: 'false' });

  return h('div.stack',
    h('div.panel.stack',
      h('div.spread', h('div', h('div.label', b.regione || 'Bando'), h('h2', b.nome)),
        h(`span.tag.${b.verificato === false ? 'warn' : 'ok'}`, b.verificato === false ? 'Griglia da verificare' : 'Griglia verificata sul testo ufficiale')),
      h('div.muted.small', [b.ente, b.fonte].filter(Boolean).join(' · ')),
      h('div.grid.w',
        h('div', h('div.label', 'Soglia complessiva'), h('div.num', `${fmt(b.sogliaTotale)} / ${fmt(b.punteggioMassimo || 100)}`)),
        b.spesaTerritorioMinPct ? h('div', h('div.label', `Spesa minima in ${b.territorio}`), h('div.num', `${fmt(b.spesaTerritorioMinPct)}% del contributo`)) : null,
        b.finestre?.length ? h('div', h('div.label', 'Finestre'), b.finestre.map((f) => h('div.num.small', `${f.anno}: ${f.dal?.slice(5).split('-').reverse().join('/')} – ${f.al?.slice(5).split('-').reverse().join('/')}`))) : null,
        b.invio ? h('div', { style: { minWidth: 0 } }, h('div.label', `Invio via ${b.invio.canale || '—'}`), h('div.small', { style: { overflowWrap: 'anywhere' } }, b.invio.indirizzo)) : null),
      b.commissione?.descrizione && h('p.small', h('strong', 'Commissione: '), b.commissione.descrizione)),

    h('div.panel', h('h3', 'Categorie, contributo e punteggi minimi'),
      h('div.tablewrap', h('table',
        h('thead', h('tr', h('th', 'Categoria'), h('th', 'Contributo massimo'), h('th', 'Minimi di sezione'), h('th', 'Griglia'))),
        h('tbody', b.categorie.map((c) => h('tr',
          h('td', c.nome),
          h('td.num.small', `${fmt(c.contributo.percentuale)}% del costo`, Object.keys(c.contributo.massimali || {}).length ? h('div.muted', Object.entries(c.contributo.massimali).map(([a, v]) => `${a}: ${euro(v)}`).join(' · ')) : null),
          h('td.num.small', Object.entries(c.soglie || {}).map(([k, v]) => `${k} ≥ ${fmt(v)}`).join(' · ') || '—'),
          h('td.small', b.griglie[c.griglia]?.id || c.griglia))))))),

    Object.values(b.griglie).map((g) => h('div.panel', h('h3', g.nome),
      g.sezioni.map((sez) => h('div', { style: { marginTop: '14px' } },
        h('div.spread', h('h4', `${sez.id} · ${sez.nome}`), h('span.num.small', `fino a ${fmt(sez.max)}`)),
        h('div.tablewrap', { style: { marginTop: '8px' } }, h('table',
          h('tbody', sez.criteri.map((c) => h('tr',
            h('td.num.small', { style: { width: '48px' } }, c.id),
            h('td', h('div', { style: { fontWeight: 500 } }, c.nome), regola(c)),
            h('td.small.muted', { style: { width: '150px' } }, TIPO_CRITERIO[c.tipo]),
            h('td.r.num', { style: { width: '56px' } }, fmt(c.max))))))))))),

    b.note?.length ? h('div.panel', h('h3', 'Da ricordare'), h('ul', { style: { margin: 0, paddingLeft: '18px' } }, b.note.map((n) => h('li', n)))) : null,

    h('div.panel.stack',
      h('div', h('h3', 'Conoscenza aggiuntiva'),
        h('p.muted.small', { style: { maxWidth: '75ch' } }, 'FAQ, graduatorie degli anni scorsi con i punteggi, verbali, decreti di modifica: Claude li legge a ogni valutazione per calibrare severità e interpretazioni. Più materiale reale carichi, più la stima si avvicina al metro della Commissione.')),
      ingresso, stato,
      (b.conoscenza || []).length ? h('div.tablewrap', h('table', h('tbody', b.conoscenza.map((k) => h('tr',
        h('td.fname', k.nome), h('td.r.num.small', `${fmt((k.caratteri || 0) / 1000, 0)}k caratteri`),
        h('td.r', h('button.btn.s.ghost', { type: 'button', onclick: () => salvaConoscenza(b.conoscenza.filter((x) => x.id !== k.id)) }, 'Rimuovi'))))))) : h('div.muted.small', 'Nessun documento aggiuntivo: la valutazione usa solo il testo dell’avviso.'),
      totCaratteri > 60000 && h('div.notice.warn', `Conoscenza molto estesa (${fmt(totCaratteri / 1000, 0)}k caratteri): ogni lettura diventa più lenta${S.ambiente.ambiente === 'app' ? ' e lascia meno spazio alla sceneggiatura' : ' e costosa'}. Tieni solo i documenti utili.`),
      h('div', h('button.btn.s', { type: 'button', onclick: () => ingresso.click() }, '+ Aggiungi documenti'))),

    !b.predefinito ? h('div.panel.stack',
      h('h3', 'Gestione della griglia'),
      b.avvisi?.length ? h('div.notice.warn', h('strong', 'Segnalazioni dalla lettura automatica:'), h('ul', { style: { margin: '6px 0 0', paddingLeft: '18px' } }, b.avvisi.map((a) => h('li', a)))) : null,
      h('p.muted.small', 'Questa griglia è stata letta da Claude: confrontala con il bando prima di fidarti dei punteggi.'),
      h('div.row',
        h('button.btn.s', { type: 'button', onclick: async () => { await store.salvaBando({ ...b, verificato: b.verificato === false }); await caricaBandi(); ridisegna(); } }, b.verificato === false ? 'Segna come verificata' : 'Segna come da verificare'),
        bottoneConferma('Elimina bando', 'Conferma eliminazione', async () => { await store.eliminaBando(b.id); S.bandoAperto = null; await caricaBandi(); toast('Bando eliminato'); ridisegna(); }, 'btn.s.danger')),
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
          } }, 'Salva modifiche'))))) : null);
}

export function vistaBandi(main) {
  const colonna = h('div');
  const llm = llmAttivo();
  const stato = h('div');

  const ridisegna = () => {
    const aperto = S.bandi.find((b) => b.id === S.bandoAperto) || S.bandi[0];
    metti(svuota(colonna), 
      S.bandi.length > 1 ? h('div.row', { style: { marginBottom: '16px' } }, S.bandi.map((b) => h(`button.btn.s${b.id === aperto.id ? '.primary' : ''}`, { type: 'button', onclick: () => { S.bandoAperto = b.id; ridisegna(); } }, b.nomeBreve || b.nome))) : null,
      dettaglio(aperto, ridisegna));
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
      S.bandoAperto = bando.id;
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
        h('p', 'La griglia di valutazione è la regola con cui Clockwise calcola i punteggi. Per ogni nuovo bando carica l’avviso: Claude ne ricava criteri, fasce e soglie.')),
      h('div', ingresso, h('button.btn.primary', { type: 'button', disabled: !llm, title: llm ? '' : 'Collega Claude per leggere un nuovo bando', onclick: () => ingresso.click() }, '+ Aggiungi un bando da PDF'))),
    stato, colonna);
  ridisegna();
  void normalizzaBando; void render;
}
