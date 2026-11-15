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

  const win = s.piattaforma === 'win32';
  const statoCC = h('div');
  const aggiornaStato = async () => { const r = await fetch('api/ricontrolla', { method: 'POST' }); S.ambiente = { ambiente: 'locale', server: await r.json() }; return S.ambiente.server.claudeCode || {}; };
  // Dopo «Accedi» si aspetta che l'accesso risulti fatto (al massimo 4 minuti), poi si passa al collegamento.
  const attendiAccesso = async () => {
    const fine = Date.now() + 4 * 60 * 1000;
    while (Date.now() < fine) {
      await new Promise((ok) => setTimeout(ok, 3000));
      if (!document.body.contains(statoCC)) return;
      let c; try { c = await aggiornaStato(); } catch { continue; }
      if (c.pronto) { await impostazione({ collegamento: 'claude-code' }); toast('Claude è collegato'); ridisegna(); return; }
    }
    metti(svuota(statoCC), h('div.notice.warn', 'Non risulta ancora l’accesso. Se hai completato l’accesso nel browser premi «Ricontrolla»; altrimenti premi di nuovo «Accedi».'));
  };
  const accedi = async (b) => {
    if (b) b.disabled = true;
    metti(svuota(statoCC), h('div.notice', h('span.spin'), ' Apro la pagina di accesso…'));
    try {
      const r = await fetch('api/claude/accedi', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.messaggio || 'Accesso non avviato.');
      metti(svuota(statoCC), h('div.notice.info', h('span.spin'), h('strong', ' Completa l’accesso nel browser. '), win ? 'Si è aperta anche una finestra «Accesso a Claude»: se il browser mostra un codice, incollalo lì. ' : '', 'Questa pagina si aggiorna da sola appena l’accesso è fatto.'));
      attendiAccesso();
    } catch (e) { metti(svuota(statoCC), h('div.notice.bad', e.message)); if (b) b.disabled = false; }
  };
  const installa = async (b) => {
    b.disabled = true;
    metti(svuota(statoCC), h('div.notice', h('span.spin'), ' Installazione di Claude Code in corso: scarico il programma ufficiale di Anthropic, di solito ci vogliono uno o due minuti…'));
    try {
      const r = await fetch('api/claude/installa', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (j.stato) S.ambiente = { ambiente: 'locale', server: j.stato };
      if (!r.ok || !j.ok) {
        metti(svuota(statoCC), h('div.notice.bad', h('strong', 'Installazione non riuscita. '), 'Prova la procedura a mano qui sotto oppure usa «Esegui la diagnosi» e mandami il rapporto.', j.uscita ? h('pre.diag', j.uscita) : null));
        b.disabled = false; return;
      }
      toast('Claude Code installato');
      if (!S.ambiente.server.claudeCode?.pronto) { ridisegna(); return accedi(); }
      ridisegna();
    } catch (e) { metti(svuota(statoCC), h('div.notice.bad', e.message)); b.disabled = false; }
  };
  const comandoInstalla = win ? 'irm https://claude.ai/install.ps1 | iex' : 'curl -fsSL https://claude.ai/install.sh | bash';

  return h('div.stack',
    h('div.panel.stack',
      h('div.spread', h('div', h('div.label', 'Abbonamento Claude · consigliato'), h('h2', 'Account Claude')),
        h(`span.tag.${cc.pronto ? 'ok' : cc.installato ? 'warn' : 'x'}`, cc.pronto ? 'Collegato' : cc.installato ? 'Accesso da fare' : 'Da installare')),
      h('p', { style: { maxWidth: '70ch' } }, 'Usa il tuo abbonamento Claude (Pro, Max, Team) attraverso Claude Code, il programma ufficiale di Anthropic: le valutazioni rientrano nell’utilizzo dell’abbonamento, senza costi a consumo.'),
      cc.pronto
        ? h('div.muted.small', `${cc.versione || 'Claude Code'} · accesso attivo${cc.origine && cc.origine !== 'PATH del programma' ? ` · trovato in: ${cc.origine}` : ''}`)
        : h('ol.passi-collegamento',
          h('li', { class: cc.installato ? 'fatto' : 'attivo' }, h('div', h('strong', 'Installa Claude Code'), h('div.muted.small', cc.installato ? `Fatto: ${cc.versione || 'installato'}` : 'Un clic: Clockwise scarica e installa il programma ufficiale di Anthropic.')),
            !cc.installato && h('button.btn.primary', { type: 'button', id: 'btn-installa-claude', onclick: (e) => installa(e.currentTarget) }, 'Installa Claude Code')),
          h('li', { class: cc.installato ? 'attivo' : '' }, h('div', h('strong', 'Accedi con il tuo account Claude'), h('div.muted.small', 'Si apre la pagina di accesso di Claude nel browser: entra con l’account del tuo abbonamento.')),
            cc.installato && h('button.btn.primary', { type: 'button', id: 'btn-accedi-claude', onclick: (e) => accedi(e.currentTarget) }, 'Accedi')),
          h('li', h('div', h('strong', 'Fatto'), h('div.muted.small', 'Clockwise se ne accorge da solo e usa il collegamento.')))),
      statoCC,
      h('div.row',
        cc.pronto && (attivo === 'claude-code' ? h('span.tag.accent', 'In uso') : h('button.btn.s.primary', { type: 'button', onclick: () => usa('claude-code') }, 'Usa questo collegamento')),
        h('button.btn.s', { type: 'button', onclick: async (e) => { e.currentTarget.disabled = true; try { await aggiornaStato(); } catch { toast('Server locale non raggiungibile'); } ridisegna(); } }, 'Ricontrolla')),
      !cc.pronto && h('details.more', h('summary', 'Preferisci farlo a mano?'),
        h('ol.how',
          h('li', win ? 'Apri PowerShell (menu Start → digita «PowerShell»)' : 'Apri il Terminale', ' ed esegui ', h('code', comandoInstalla)),
          h('li', 'Poi esegui ', h('code', 'claude auth login'), ' e completa l’accesso nel browser.'),
          h('li', 'Torna qui e premi «Ricontrolla». Non serve riavviare Clockwise.')))),

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

// Diagnosi del collegamento su questo computer: rapporto da leggere o da copiare per chi assiste.
function pannelloDiagnosi() {
  const area = h('div.stack-s');
  const esegui = async (b) => {
    b.disabled = true;
    metti(svuota(area), h('div.notice', h('span.spin'), ' Controllo di Claude Code, dell’accesso, della rete e del PATH…'));
    try {
      const r = await fetch('api/diagnosi');
      const d = await r.json();
      metti(svuota(area),
        d.problemi?.length ? h('div.notice.warn', h('strong', 'Che cosa ho trovato'), h('ul', { style: { margin: '6px 0 0', paddingLeft: '18px' } }, d.problemi.map((p) => h('li', p)))) : h('div.notice.info', 'Nessun problema rilevato.'),
        h('pre.diag', { id: 'testo-diagnosi' }, d.testo),
        h('div.row', h('button.btn.s', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(d.testo); toast('Rapporto copiato: incollalo nel messaggio'); } catch { toast('Copia non riuscita: seleziona il testo e copialo a mano'); } } }, 'Copia il rapporto')));
    } catch (e) { metti(svuota(area), h('div.notice.bad', `Diagnosi non riuscita: ${e.message}`)); }
    b.disabled = false;
  };
  return h('div.panel.stack',
    h('div.spread', h('div', h('div.label', 'Se qualcosa non va'), h('h2', 'Diagnosi del collegamento')),
      h('button.btn.s', { type: 'button', id: 'btn-diagnosi', onclick: (e) => esegui(e.currentTarget) }, 'Esegui la diagnosi')),
    h('p.muted.small', { style: { maxWidth: '75ch' } }, 'Controlla su questo computer dove è installato Claude Code, se risponde, se l’accesso è fatto, se la rete raggiunge Anthropic e quale PATH vede Clockwise. Il rapporto non contiene chiavi né documenti e la cartella dell’utente è anonimizzata: puoi copiarlo e mandarlo a chi ti assiste.'),
    area);
}

export function vistaCollegamento(main) {
  const corpo = h('div.stack');
  const ridisegna = () => {
    const amb = S.ambiente.ambiente;
    metti(svuota(corpo), 
      amb === 'attesa' ? h('div.panel', h('span.spin'), ' Verifica del collegamento a Claude…')
        : amb === 'app' ? schedaApp() : amb === 'locale' ? schedaLocale(ridisegna) : schedaNessuno(),
      amb === 'app' || amb === 'locale' ? preferenze() : null,
      amb === 'locale' ? pannelloDiagnosi() : null,
      h('p.muted.small', { style: { maxWidth: '80ch' } }, 'Riservatezza: i file del dossier restano su questo dispositivo. A Claude viene inviato il testo dei documenti che servono a ciascuna valutazione, attraverso il collegamento scelto qui sopra e a nessun altro servizio. Il documento d’identità non viene mai inviato.'));
    aggiornaPillola();
  };
  metti(main, 
    h('div.page-head', h('div', h('h1', 'Collegamento a Claude'),
      h('p', 'Clockwise fa leggere il dossier a Claude con il tuo accesso: l’account Claude oppure una chiave API. Puoi configurarli entrambi e scegliere quale usare.'))),
    corpo);
  ridisegna();
}
