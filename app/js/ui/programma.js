// Finestra «Esci / Dati»: che cosa è salvato e dove, programma attivo in background, avvio all'accensione,
// «Salva ed esci». Si apre dal pulsante in alto a destra, solo quando la pagina è servita dal programma sul computer.
import { h, metti, svuota, toast } from './dom.js';
import { S, salvaTutto } from './app.js';
import * as store from '../core/store.js';

let aperta = null;
function chiudi() { aperta?.remove(); aperta = null; document.removeEventListener('keydown', suTasto); }
function suTasto(e) { if (e.key === 'Escape') chiudi(); }
const mb = (byte) => (byte < 1048576 ? `${Math.max(1, Math.round(byte / 1024)).toLocaleString('it-IT')} kB` : `${(byte / 1048576).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`);

export async function apriProgramma() {
  chiudi();
  const eseguibile = !!S.ambiente.server?.eseguibile;
  const corpo = h('div.stack', h('div.notice', h('span.spin'), ' Salvataggio in corso…'));
  aperta = h('div.velo', { onclick: (e) => { if (e.target === aperta) chiudi(); } },
    h('div.dialogo', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Salvataggio e chiusura' },
      h('div.spread', h('h2', eseguibile ? 'Salvataggio e chiusura' : 'Dati salvati'), h('button.btn.s.ghost', { type: 'button', 'aria-label': 'Chiudi', onclick: chiudi }, '✕')),
      corpo));
  document.body.append(aperta);
  document.addEventListener('keydown', suTasto);

  // aprire la finestra salva già tutto: quello che si legge sotto è lo stato vero
  const tuttoSalvato = await salvaTutto();
  let archivio = null, programma = null;
  try { archivio = await (await fetch('api/archivio', { cache: 'no-store' })).json(); } catch { archivio = null; }
  try { programma = await (await fetch('api/programma', { cache: 'no-store' })).json(); } catch { programma = null; }
  if (!aperta) return;
  const disco = store.statoDisco();
  const dossier = (archivio?.chiavi || []).filter((c) => c.chiave.startsWith('progetto:')).length;
  const byte = (archivio?.chiavi || []).reduce((a, c) => a + c.byte, 0) + (archivio?.byteOriginali || 0);
  const auto = programma?.avvioAutomatico || { disponibile: false, attivo: false };

  const esci = async (bottone) => {
    bottone.disabled = true; bottone.textContent = 'Salvataggio…';
    const ok = await salvaTutto();
    if (!ok) { bottone.disabled = false; bottone.textContent = 'Salva ed esci'; toast('Non tutto è arrivato al disco: riprova tra un momento.'); return; }
    try { await fetch('api/esci', { method: 'POST' }); } catch { /* il servizio si chiude mentre risponde */ }
    chiudi();
    metti(svuota(document.body), h('main.wrap', { style: { paddingTop: '18vh', textAlign: 'center' } }, h('h1', 'Clockwise è stato chiuso'),
      h('p.muted', { style: { marginTop: '8px' } }, 'Tutto è salvato sul computer. Puoi chiudere questa scheda: per riaprirlo usa l’icona Clockwise nel menu Start o sul desktop e ritroverai la sessione dove l’hai lasciata.')));
  };

  metti(svuota(corpo),
    h(`div.notice.${disco.attivo && tuttoSalvato ? 'ok' : 'warn'}`, { id: 'prg-stato' },
      disco.attivo
        ? (tuttoSalvato ? h('span', h('strong', 'Tutto salvato su questo computer. '), `${dossier} dossier, ${archivio?.originali || 0} file originali, ${mb(byte)} in totale.`)
          : h('span', h('strong', 'Alcune modifiche non sono ancora arrivate al disco. '), 'Restano nel browser e verranno recuperate: riapri questa finestra tra un momento.'))
        : h('span', h('strong', 'I dati sono salvati solo nel browser. '), 'L’archivio su disco non risponde: i dossier restano comunque in questo browser.')),
    disco.attivo ? h('div.stack-s',
      h('h3', 'Dove sono i dati'),
      h('p.small', 'Dossier, impostazioni, bandi aggiunti e file originali caricati stanno in questa cartella. Non dipendono dal browser: li ritrovi anche dopo averlo svuotato o cambiato.'),
      h('code', { id: 'prg-cartella' }, disco.cartella),
      h('div.row', h('button.btn.s', { type: 'button', id: 'prg-apri-cartella', onclick: async () => { try { await fetch('api/archivio/apri', { method: 'POST' }); } catch { toast('Cartella non raggiungibile'); } } }, 'Apri la cartella'),
        h('span.muted.small', 'Per una copia di sicurezza di un singolo dossier: «Esporta dossier», in alto nel dossier.'))) : null,
    h('div.stack-s',
      h('h3', 'La sessione'),
      h('p.small', 'Clockwise ricorda dove sei: dossier aperto, scheda e sezione. Alla riapertura riparti da lì, anche dopo aver chiuso il programma o spento il computer.')),
    eseguibile ? h('div.stack-s',
      h('h3', 'Attivo in background'),
      h('p.small', 'Clockwise non ha una finestra propria: resta attivo sul computer anche se chiudi questa scheda o il browser. Per riaprirlo basta l’icona nel menu Start o sul desktop; per fermarlo usa «Salva ed esci» qui sotto oppure «Chiudi Clockwise» nel menu Start.'),
      auto.disponibile ? h('label.gf-voce', h('input', { type: 'checkbox', id: 'prg-avvio-automatico', checked: auto.attivo, onchange: async (e) => {
        const voluto = e.target.checked;
        try {
          const r = await fetch('api/programma/avvio-automatico', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attivo: voluto }) });
          if (!r.ok) throw new Error((await r.json()).messaggio);
          toast(voluto ? 'Clockwise partirà da solo all’accensione del computer' : 'Avvio automatico disattivato');
        } catch (err) { e.target.checked = !voluto; toast(err.message || 'Impostazione non riuscita'); }
      } }), h('span', 'Avvia Clockwise all’accensione del computer (in background, senza aprire il browser)')) : null,
      programma?.registro ? h('p.small.muted', 'Registro del programma (avvio, chiusura, errori): ', h('code', programma.registro)) : null) : null,
    h('div.row', { style: { justifyContent: 'flex-end' } },
      h('button.btn', { type: 'button', onclick: chiudi }, eseguibile ? 'Continua a lavorare' : 'Chiudi'),
      eseguibile ? h('button.btn.primary', { type: 'button', id: 'prg-esci', onclick: (e) => esci(e.currentTarget) }, 'Salva ed esci') : null));
  aperta.querySelector('#prg-esci, button')?.focus();
}
