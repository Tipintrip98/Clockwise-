// Punto d'ingresso di Clockwise.exe (Node.js Single Executable Application).
// scripts/build-windows.mjs impacchetta questo file con esbuild in un unico CommonJS e lo
// incorpora in node.exe insieme ai file dell'interfaccia: doppio clic -> server locale + browser.
// In sviluppo NON si usa: `npm start` parte da server/index.js.
import sea from 'node:sea';
import { creaServer, chiudiServer } from './servizio.js';
import { fornitoreIncorporato } from './statici.js';
import { PORTA_PREDEFINITA, cartellaDatiEseguibile, avviaSostituendo, apriBrowser } from './avvio.js';

const WIN = process.platform === 'win32';
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
let server = null;
let inChiusura = false;

// Su Windows la finestra sparisce appena il processo termina: prima di uscire per un errore
// si aspetta un tasto, così il messaggio si può leggere (o fotografare per chiedere aiuto).
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
  console.error('\n  Clockwise si è fermato per un errore imprevisto.');
  console.error(`\n  Dettaglio: ${e?.stack || e?.message || e}`);
  console.error('\n  Riavvia il programma. Se l’errore si ripete, reinstalla Clockwise o segnala il dettaglio qui sopra.');
  await attendiTasto();
  process.exit(1);
}
process.on('uncaughtException', fatale);
process.on('unhandledRejection', fatale);

async function esci(codice = 0) {
  if (inChiusura) return;
  inChiusura = true;
  console.log('\n  Clockwise è stato chiuso.\n');
  const limite = setTimeout(() => process.exit(codice), 3000); // mai appesi a una connessione che non si chiude
  limite.unref();
  if (server) await chiudiServer(server);
  setImmediate(() => process.exit(codice));
}
for (const segnale of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(segnale, () => esci(0));

async function avvia() {
  if (!sea.isSea()) throw new Error('Questo file funziona solo dentro l’eseguibile: in sviluppo avvia Clockwise con "npm start".');
  const manifesto = JSON.parse(sea.getAsset('manifesto.json', 'utf8'));
  const versione = manifesto.versione;
  try { process.title = 'Clockwise'; } catch { /* titolo della finestra non modificabile */ }

  server = creaServer({
    fornitore: fornitoreIncorporato(sea, manifesto.file),
    cartellaDati: cartellaDatiEseguibile(),
    versione,
    eseguibile: true,
    suEsci: () => esci(0),
  });

  const preferita = Number(process.env.PORT) || PORTA_PREDEFINITA;
  // una versione diversa rimasta aperta (dopo un aggiornamento) viene chiusa e sostituita da questa
  const esito = await avviaSostituendo(server, preferita, versione);
  const indirizzo = `http://localhost:${esito.porta}`;

  if (esito.giaAvviato) {
    console.log(`\n  Clockwise è già in esecuzione: ${indirizzo}`);
    console.log(apriBrowser(indirizzo) ? '  Lo apro nel browser. Questa finestra si chiude da sola.\n' : '  Aprilo nel browser. Questa finestra si chiude da sola.\n');
    await pausa(2500);
    process.exit(0);
  }

  console.log(`\n  Clockwise ${versione} — simulatore di punteggio bandi cinema`);
  console.log(`  Clockwise è in esecuzione:  ${indirizzo}\n`);
  if (esito.sostituita) console.log(`  Era ancora aperta la versione ${esito.sostituita}: l’ho chiusa e ho avviato la ${versione}.\n`);
  if (esito.porta !== preferita) {
    console.log(`  Attenzione: la porta ${preferita} è occupata da un altro programma, uso la ${esito.porta}.`);
    console.log(`  I dossier salvati nel browser sono legati all’indirizzo: quelli creati su`);
    console.log(`  http://localhost:${preferita} torneranno visibili quando quella porta sarà di nuovo libera.\n`);
  }
  console.log('  Lascia aperta questa finestra mentre usi Clockwise. Per chiudere il programma chiudi questa finestra.\n');
  if (!apriBrowser(indirizzo) && process.env.CLOCKWISE_NO_BROWSER !== '1') console.log(`  Apri il browser e vai su ${indirizzo}\n`);
}

avvia().catch(fatale);
