// Collegamento a Claude: account (app o Claude Code) oppure chiave API.
import { h, metti, svuota, toast, scelta, bottoneConferma } from './dom.js';
import { S, impostazione, ricontrollaAmbiente, llmAttivo, aggiornaPillola } from './app.js';
import { MODELLI, IMPEGNI } from '../core/llm.js';

function preferenze() {
  return h('div.panel.stack',
    h('h2', 'Come deve leggere Claude'),
    h('div.grid.w',
      scelta('Modello', MODELLI.map((m) => ({ id: m.id, nome: `${m.nome} — ${m.nota}` })), S.imp.modello, (v) => impostazione({ modello: v }), { id: 'pref-modello' }),
      scelta('Lettura', IMPEGNI, S.imp.impegno, (v) => impostazione({ impegno: v }), { id: 'pref-impegno' })),
    h('p.muted.small', { style: { maxWidth: '75ch' } }, 'Fable 5.2 è il modello più capace e quello consigliato per giudicare una sceneggiatura. Se non è disponibile per il tuo account, il collegamento usa il modello più vicino e lo indica nel report.'));
}

function schedaApp() {
  return h('div.panel.stack',
    h('div.spread', h('h2', 'Account Claude'), h('span.tag.ok', h('span.dot.ok'), 'Collegato')),
    h('p', { style: { maxWidth: '70ch' } }, 'Questa pagina gira dentro l’app Claude e usa il tuo account: nessuna chiave da configurare. Alla prima valutazione Claude ti chiede di autorizzare la pagina; ogni lettura consuma il tuo utilizzo, come un messaggio in chat.'),
    h('p.muted.small', { style: { maxWidth: '70ch' } }, 'In questa modalità Claude legge al massimo circa 250.000 caratteri per volta: le sceneggiature più lunghe vengono lette in più parti e riassunte in una scheda con estratti. Per letture integrali senza limiti usa la versione installata sul computer.'));
}

function schedaLocale(ridisegna) {
  const s = S.ambiente.server;
  const cc = s.claudeCode || {}, api = s.api || {};
  const attivo = llmAttivo()?.tipo;
  const esito = h('div');
  const campo = h('input', { id: 'chiave-api', type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', 'aria-label': 'Chiave API Anthropic' });
  const chiama = async (metodo, corpo) => {
    const r = await fetch('api/chiave', { method: metodo, headers: { 'content-type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.messaggio || 'Operazione non riuscita.');
    S.ambiente = { ambiente: 'locale', server: j };
  };
  const usa = (tipo) => impostazione({ collegamento: tipo }).then(ridisegna);

  return h('div.stack',
    h('div.panel.stack',
      h('div.spread', h('div', h('div.label', 'Abbonamento Claude'), h('h2', 'Account Claude')),
        h(`span.tag.${cc.pronto ? 'ok' : cc.installato ? 'warn' : 'x'}`, cc.pronto ? 'Collegato' : cc.installato ? 'Accesso da fare' : 'Claude Code non trovato')),
      h('p', { style: { maxWidth: '70ch' } }, 'Usa il tuo abbonamento Claude (Pro, Max, Team) attraverso Claude Code installato su questo computer: le valutazioni rientrano nell’utilizzo dell’abbonamento, senza costi a consumo.'),
      cc.pronto ? h('div.muted.small', `${cc.versione || 'Claude Code'} · accesso attivo`)
        : h('ol.how',
          !cc.installato && h('li', 'Installa Claude Code: apri un terminale ed esegui ', h('code', 'npm install -g @anthropic-ai/claude-code')),
          h('li', 'Nel terminale esegui ', h('code', 'claude'), ' e poi il comando ', h('code', '/login'), ': accedi con l’account del tuo abbonamento.'),
          h('li', 'Torna qui e premi “Ricontrolla”.')),
      h('div.row',
        cc.pronto && (attivo === 'claude-code' ? h('span.tag.accent', 'In uso') : h('button.btn.s.primary', { type: 'button', onclick: () => usa('claude-code') }, 'Usa questo collegamento')),
        h('button.btn.s', { type: 'button', onclick: async (e) => { e.currentTarget.disabled = true; try { const r = await fetch('api/ricontrolla', { method: 'POST' }); S.ambiente = { ambiente: 'locale', server: await r.json() }; } catch { toast('Server locale non raggiungibile'); } ridisegna(); } }, 'Ricontrolla'))),

    h('div.panel.stack',
      h('div.spread', h('div', h('div.label', 'A consumo'), h('h2', 'Chiave API Anthropic')),
        h(`span.tag.${api.configurata ? 'ok' : 'x'}`, api.configurata ? 'Configurata' : 'Non configurata')),
      h('p', { style: { maxWidth: '70ch' } }, 'Paghi solo le letture che fai, dal credito del tuo account API. È il collegamento più adatto alle sceneggiature lunghe e a più commissari in parallelo; i documenti riletti da più commissari costano una frazione grazie alla cache.'),
      api.configurata
        ? h('div.row', h('span.num.small', api.chiave), h('span.muted.small', api.origine === 'ambiente' ? 'dalla variabile ANTHROPIC_API_KEY' : 'salvata solo su questo computer'),
          api.origine === 'salvata' && bottoneConferma('Rimuovi', 'Conferma rimozione', async () => { try { await chiama('DELETE'); toast('Chiave rimossa'); } catch (e) { toast(e.message); } ridisegna(); }))
        : h('div.stack-s',
          h('div.row', h('div.grow', campo), h('button.btn.primary', { type: 'button', onclick: async (e) => {
            const b = e.currentTarget; b.disabled = true;
            metti(svuota(esito), h('div.notice', h('span.spin'), ' Verifica della chiave…'));
            try { await chiama('POST', { chiave: campo.value }); if (!S.imp.collegamento) await impostazione({ collegamento: 'api' }); toast('Chiave API collegata'); ridisegna(); }
            catch (err) { metti(svuota(esito), h('div.notice.bad', err.message)); b.disabled = false; }
          } }, 'Collega')),
          h('p.muted.small', 'La chiave si crea su console.anthropic.com → API keys. Resta in un file leggibile solo da te nella cartella ', h('code', 'data/'), ' di Clockwise e non viene inviata a nessun altro servizio.')),
      esito,
      api.configurata && h('div.row', attivo === 'api' ? h('span.tag.accent', 'In uso') : h('button.btn.s.primary', { type: 'button', onclick: () => usa('api') }, 'Usa questo collegamento'))));
}

function schedaNessuno() {
  const inApp = !!globalThis.claude;
  return h('div.panel.stack',
    h('div.spread', h('h2', 'Claude non è collegato'), h('span.tag.bad', 'Non collegato')),
    inApp
      ? h('p', { style: { maxWidth: '70ch' } }, 'Questa vista non permette alla pagina di usare Claude. Apri l’artifact dall’app Claude (claude.ai) con il tuo account e riprova.')
      : h('div.stack-s',
        h('p', { style: { maxWidth: '70ch' } }, 'La pagina è stata aperta senza il server di Clockwise. Per collegare Claude:'),
        h('ol.how',
          h('li', 'apri un terminale nella cartella di Clockwise ed esegui ', h('code', 'npm install'), ' (solo la prima volta) e poi ', h('code', 'npm start'), ';'),
          h('li', 'apri ', h('code', 'http://localhost:5757'), ' nel browser;'),
          h('li', 'in questa pagina scegli se usare l’account Claude o una chiave API.'))),
    h('p.muted.small', 'Senza collegamento restano disponibili il calcolo dei punti dai numeri, i controlli di ammissibilità e la lettura del Modulo III.'),
    h('div', h('button.btn.s', { type: 'button', onclick: () => ricontrollaAmbiente() }, 'Ricontrolla')));
}

export function vistaCollegamento(main) {
  const corpo = h('div.stack');
  const ridisegna = () => {
    const amb = S.ambiente.ambiente;
    metti(svuota(corpo), 
      amb === 'attesa' ? h('div.panel', h('span.spin'), ' Verifica del collegamento a Claude…')
        : amb === 'app' ? schedaApp() : amb === 'locale' ? schedaLocale(ridisegna) : schedaNessuno(),
      amb === 'app' || amb === 'locale' ? preferenze() : null,
      h('p.muted.small', { style: { maxWidth: '80ch' } }, 'Riservatezza: i file del dossier restano su questo dispositivo. A Claude viene inviato il testo dei documenti che servono a ciascuna valutazione, attraverso il collegamento scelto qui sopra e a nessun altro servizio. Il documento d’identità non viene mai inviato.'));
    aggiornaPillola();
  };
  metti(main, 
    h('div.page-head', h('div', h('h1', 'Collegamento a Claude'),
      h('p', 'Clockwise fa leggere il dossier a Claude con il tuo accesso: l’account Claude oppure una chiave API. Puoi configurarli entrambi e scegliere quale usare.'))),
    corpo);
  ridisegna();
}
