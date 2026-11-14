// Genera, a partire dalle schede in bandi/dati/*.json:
//   - app/js/core/bandi/dati.js   i bandi che fanno parte del programma;
//   - bandi/catalogo.json         lo stesso contenuto per il canale di aggiornamento (vedi core/aggiornamenti.js).
// Ogni scheda viene ripulita e controllata: se una non è valida lo script si ferma e dice perché.
// Uso: node scripts/genera-bandi.mjs [--controlla]   (--controlla: non scrive, fallisce se i file generati non sono aggiornati)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sanificaBando, validaBando } from '../app/js/core/bandi/schema.js';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cartella = path.join(radice, 'bandi/dati');
const soloControllo = process.argv.includes('--controlla');

const file = fs.existsSync(cartella) ? fs.readdirSync(cartella).filter((f) => f.endsWith('.json')).sort() : [];
const bandi = [], problemi = [];
for (const f of file) {
  let grezzo;
  try { grezzo = JSON.parse(fs.readFileSync(path.join(cartella, f), 'utf8')); } catch (e) { problemi.push(`${f}: JSON non valido (${e.message})`); continue; }
  const b = sanificaBando(grezzo);
  const v = validaBando(b);
  if (!v.ok) { problemi.push(`${f}: ${v.errori.join(' ')}`); continue; }
  if (!b.revisione) problemi.push(`${f}: manca "revisione" (AAAA-MM-GG).`);
  if (bandi.some((x) => x.id === b.id)) problemi.push(`${f}: identificativo ripetuto (${b.id}).`);
  bandi.push(b);
}
if (problemi.length) { console.error(`Schede da correggere:\n- ${problemi.join('\n- ')}`); process.exit(1); }

const revisione = bandi.map((b) => b.revisione).sort().at(-1) || '';
const modulo = `// FILE GENERATO da scripts/genera-bandi.mjs a partire da bandi/dati/*.json — non modificare a mano.
export const REVISIONE_DATI = ${JSON.stringify(revisione)};
export const BANDI_DATI = ${JSON.stringify(bandi, null, 1)};
`;
const impronta = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const catalogo = `${JSON.stringify({
  schema: 1, revisione,
  bandi: bandi.map((b) => ({ id: b.id, revisione: b.revisione, sha256: impronta(b), bando: b })),
}, null, 1)}\n`;

const uscite = [[path.join(radice, 'app/js/core/bandi/dati.js'), modulo], [path.join(radice, 'bandi/catalogo.json'), catalogo]];
if (soloControllo) {
  const vecchi = uscite.filter(([p, t]) => !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== t).map(([p]) => path.relative(radice, p));
  if (vecchi.length) { console.error(`File generati non aggiornati: ${vecchi.join(', ')}. Esegui: npm run bandi`); process.exit(1); }
  console.log(`Bandi: ${bandi.length} schede, file generati aggiornati.`);
} else {
  for (const [p, t] of uscite) fs.writeFileSync(p, t);
  const sim = bandi.filter((b) => validaBando(b).simulabile).length;
  console.log(`Bandi: ${bandi.length} schede (${sim} con griglia a punti) → app/js/core/bandi/dati.js, bandi/catalogo.json`);
}
