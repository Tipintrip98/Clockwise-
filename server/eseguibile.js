// Punto d'ingresso di Clockwise.exe (Node.js Single Executable Application).
// scripts/build-windows.mjs impacchetta questo file con esbuild in un unico CommonJS e lo
// incorpora in node.exe insieme ai file dell'interfaccia: doppio clic -> server locale + browser.
// In sviluppo NON si usa: `npm start` parte da server/index.js.
import sea from 'node:sea';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { creaServer, chiudiServer } from './servizio.js';
import { fornitoreIncorporato } from './statici.js';
import { PORTA_PREDEFINITA, cartellaDatiEseguibile, avviaSostituendo, apriBrowser, creaRegistro, clockwiseGiaAvviato, chiediChiusura } from './avvio.js';

const WIN = process.platform === 'win32';
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
const argomenti = process.argv.slice(2);
// Su Windows Clockwise.exe non ha finestra (scripts/build-windows.mjs lo marca come programma «a finestre»):
// resta attivo in background e ciò che prima si leggeva nella finestra nera finisce in clockwise.log.
const cartellaDati = cartellaDatiEseguibile();
const registro = creaRegistro(path.join(cartellaDati, 'clockwise.log'));
const dire = (testo) => { try { console.log(testo); } catch { /* nessuna console */ } for (const riga of String(testo).split('\n')) if (riga.trim()) registro.scrivi(riga); };
let server = null;
let inChiusura = false;

// Con una console vera (avvio da terminale, Linux) si aspetta un tasto, così il messaggio si può leggere.
function attendiTasto() {
  return new Promise((ok) => {
    if (!WIN || !process.stdin.isTTY) return ok();
    console.error('\n  Premi un tasto per chiudere questa finestra…');
    try { process.stdin.setRawMode(true); } catch { /* console senza modalità "raw" */ }
    process.stdin.resume();
    process.stdin.once('data', () => ok());
  });
}

async function fatale(e) {
  if (inChiusura) return;
  inChiusura = true;
  dire('\n  Clockwise si è fermato per un errore imprevisto.');
  dire(`\n  Dettaglio: ${e?.stack || e?.message || e}`);
  dire('\n  Riavvia il programma. Se l’errore si ripete, reinstalla Clockwise o segnala il dettaglio qui sopra.');
  // senza finestra l'errore resterebbe invisibile: si apre il registro nel Blocco note
  if (WIN && process.env.CLOCKWISE_NO_BROWSER !== '1' && !process.stdin.isTTY) {
    try { const f = spawn('notepad.exe', [registro.file], { stdio: 'ignore', detached: true }); f.on('error', () => {}); f.unref(); } catch { /* resta il file */ }
  }
  await attendiTasto();
  process.exit(1);
}
process.on('uncaughtException', fatale);
process.on('unhandledRejection', fatale);

async function esci(codice = 0) {
  if (inChiusura) return;
  inChiusura = true;
  dire('\n  Clockwise è stato chiuso.\n');
  const limite = setTimeout(() => process.exit(codice), 3000); // mai appesi a una connessione che non si chiude
  limite.unref();
  if (server) await chiudiServer(server);
  setImmediate(() => process.exit(codice));
}
for (const segnale of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(segnale, () => esci(0));

// «Clockwise.exe --esci» (collegamento «Chiudi Clockwise» del menu Start): chiude il Clockwise rimasto attivo in background.
async function chiudiQuelloAttivo(preferita) {
  let chiusi = 0;
  for (let porta = preferita; porta < preferita + 30; porta++) {
    if (await clockwiseGiaAvviato(porta, 1500)) { if (await chiediChiusura(porta)) chiusi++; } else if (porta > preferita + 3) break;
  }
  dire(chiusi ? '  Clockwise in background: chiuso su richiesta (--esci).' : '  --esci: nessun Clockwise attivo da chiudere.');
  process.exit(0);
}

async function avvia() {
  if (!sea.isSea()) throw new Error('Questo file funziona solo dentro l’eseguibile: in sviluppo avvia Clockwise con "npm start".');
  const manifesto = JSON.parse(sea.getAsset('manifesto.json', 'utf8'));
  const versione = manifesto.versione;
  try { process.title = 'Clockwise'; } catch { /* titolo non modificabile */ }
  const preferita = Number(process.env.PORT) || PORTA_PREDEFINITA;
  if (argomenti.includes('--esci')) return chiudiQuelloAttivo(preferita);
  // --sfondo: avvio all'accensione del computer, senza aprire il browser
  const sfondo = argomenti.includes('--sfondo');

  server = creaServer({
    fornitore: fornitoreIncorporato(sea, manifesto.file),
    cartellaDati,
    versione,
    eseguibile: true,
    suEsci: () => esci(0),
    programma: { sfondo: WIN, registro: registro.file },
  });

  // una versione diversa rimasta aperta (dopo un aggiornamento) viene chiusa e sostituita da questa
  const esito = await avviaSostituendo(server, preferita, versione);
  const indirizzo = `http://localhost:${esito.porta}`;

  if (esito.giaAvviato) {
    dire(`  Clockwise è già in esecuzione: ${indirizzo}${sfondo ? '' : ' — lo riapro nel browser.'}`);
    if (!sfondo) apriBrowser(indirizzo);
    await pausa(sfondo ? 0 : 1500);
    process.exit(0);
  }

  dire(`\n  Clockwise ${versione} — simulatore di punteggio bandi cinema`);
  dire(`  Clockwise è in esecuzione:  ${indirizzo}${sfondo ? '  (avvio all’accensione, senza browser)' : ''}`);
  dire(`  Dossier e file caricati: ${path.join(cartellaDati, 'archivio')}\n`);
  if (esito.sostituita) dire(`  Era ancora aperta la versione ${esito.sostituita}: l’ho chiusa e ho avviato la ${versione}.\n`);
  if (esito.porta !== preferita) dire(`  La porta ${preferita} è occupata da un altro programma: uso la ${esito.porta}. I dossier sono su disco e restano gli stessi.\n`);
  dire(WIN ? '  Clockwise resta attivo in background anche se chiudi il browser. Per chiuderlo: pulsante «Esci» nella pagina, oppure «Chiudi Clockwise» nel menu Start.\n'
    : '  Per chiudere il programma: pulsante «Esci» nella pagina oppure Ctrl+C.\n');
  if (!sfondo && !apriBrowser(indirizzo) && process.env.CLOCKWISE_NO_BROWSER !== '1') dire(`  Apri il browser e vai su ${indirizzo}\n`);
}

avvia().catch(fatale);
