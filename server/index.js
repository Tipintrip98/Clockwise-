// Server locale di Clockwise: serve l'interfaccia e fa da ponte verso Claude.
// Ascolta solo su 127.0.0.1: i documenti non lasciano il computer se non verso Anthropic.
// Questo è l'avvio da sorgenti (`npm start`): i file dell'interfaccia vengono letti da app/.
// L'eseguibile per Windows parte invece da server/eseguibile.js; il server vero è in servizio.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaServer, chiudiServer } from './servizio.js';
import { fornitoreCartella } from './statici.js';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cartellaDati = process.env.CLOCKWISE_DATA || path.join(radice, 'data');
const PORTA = Number(process.env.PORT) || 5757;
const versione = JSON.parse(fs.readFileSync(path.join(radice, 'package.json'), 'utf8')).version;

const server = creaServer({
  fornitore: fornitoreCartella(path.join(radice, 'app')),
  cartellaDati,
  versione,
  eseguibile: false,
  suEsci: () => { console.log('\n  Clockwise è stato chiuso.\n'); chiudiServer(server).then(() => process.exit(0)); },
});

server.listen(PORTA, '127.0.0.1', () => {
  console.log(`\n  Clockwise ${versione} — simulatore di punteggio bandi cinema`);
  console.log(`  Apri nel browser:  http://localhost:${PORTA}\n`);
  console.log('  Per chiudere: Ctrl+C\n');
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`\n  La porta ${PORTA} è già in uso: Clockwise è forse già avviato? Altrimenti avvia con PORT=5858 npm start\n`);
  else console.error(e);
  process.exit(1);
});
