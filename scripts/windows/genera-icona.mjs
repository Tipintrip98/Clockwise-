// Disegna installer/clockwise.ico: il marchio di Clockwise (arco di strumento in senso orario
// con la lancetta, lo stesso dell'intestazione dell'app) in blu #2441C2 su una tessera bianca.
// Nessuna dipendenza: i pixel si calcolano qui e il file .ico si scrive a mano.
//   node scripts/windows/genera-icona.mjs            -> installer/clockwise.ico
//   node scripts/windows/genera-icona.mjs --png f.png -> anche un'anteprima PNG a 256 px
// Il file .ico è versionato: questo script serve solo se si vuole ritoccare il disegno.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MISURE = [16, 20, 24, 32, 40, 48, 64, 256];
const BLU = [0x24, 0x41, 0xC2];
const BIANCO = [0xFF, 0xFF, 0xFF];
const BORDO = [0xC9, 0xD2, 0xF0];

const limita = (v) => Math.max(0, Math.min(1, v));
const copertura = (distanza) => limita(0.5 - distanza); // distanza in pixel, negativa dentro la forma

// Distanze con segno dalle forme del marchio (coordinate in pixel).
function distRettangoloTondo(x, y, cx, cy, mezzo, raggio) {
  const dx = Math.abs(x - cx) - (mezzo - raggio), dy = Math.abs(y - cy) - (mezzo - raggio);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - raggio;
}
function distSegmento(x, y, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = limita(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy));
  return Math.hypot(x - ax - t * vx, y - ay - t * vy);
}
// Arco di raggio r aperto in basso: `apertura` è il semiangolo (radianti) del vuoto sotto il centro.
function distArco(x, y, cx, cy, r, apertura) {
  const dx = x - cx, dy = y - cy;
  const daBasso = Math.abs(Math.atan2(dx, dy)); // 0 = dritto sotto il centro
  if (daBasso >= apertura) return Math.abs(Math.hypot(dx, dy) - r);
  const ex = r * Math.sin(apertura), ey = r * Math.cos(apertura);
  return Math.min(Math.hypot(dx - ex, dy - ey), Math.hypot(dx + ex, dy - ey));
}

/** Pixel RGBA (non premoltiplicati) dell'icona di lato n. */
function disegna(n) {
  const px = Buffer.alloc(n * n * 4);
  const piccolo = n <= 24;
  // Il marchio vive in una griglia 24x24 (come l'SVG dell'app): centro (12,12), arco r=9.
  const scala = (piccolo ? 0.80 : 0.70) * n / 20.6;
  const tratto = Math.max(2.6 * scala, piccolo ? 1.9 : 0);
  const cx = n / 2, cy = n / 2 + 1.75 * scala; // il disegno pesa verso l'alto: lo si abbassa per centrarlo
  const r = 9 * scala;
  const apertura = 51.4 * Math.PI / 180;
  const punta = [cx + 4.2 * scala, cy - 4.6 * scala];
  const perno = Math.max(1.9 * scala, piccolo ? 1.4 : 0);
  const margine = n >= 64 ? n / 32 : (n >= 32 ? 1 : 0);
  const mezzo = n / 2 - margine, raggioTessera = mezzo * 0.44;
  const spessoreBordo = Math.max(1, n / 128);

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const X = x + 0.5, Y = y + 0.5;
      const dTessera = distRettangoloTondo(X, Y, n / 2, n / 2, mezzo, raggioTessera);
      const aTessera = copertura(dTessera);
      const aInterno = copertura(dTessera + spessoreBordo); // la tessera senza il suo filo di bordo
      const dMarchio = Math.min(
        distArco(X, Y, cx, cy, r, apertura) - tratto / 2,
        distSegmento(X, Y, cx, cy, punta[0], punta[1]) - tratto / 2,
        Math.hypot(X - cx, Y - cy) - perno,
      );
      const aMarchio = copertura(dMarchio);
      const quotaBianco = aTessera > 0 ? Math.min(1, aInterno / aTessera) : 0;
      let c = BORDO.map((v, i) => v + (BIANCO[i] - v) * quotaBianco);
      c = c.map((v, i) => v + (BLU[i] - v) * aMarchio);
      const i = (y * n + x) * 4;
      px[i] = Math.round(c[0]); px[i + 1] = Math.round(c[1]); px[i + 2] = Math.round(c[2]);
      px[i + 3] = Math.round(255 * aTessera);
    }
  }
  return px;
}

// --- PNG (RGBA 8 bit) scritto a mano: firma, IHDR, IDAT, IEND
const TABELLA_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = TABELLA_CRC[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function blocco(tipo, dati) {
  const testa = Buffer.alloc(8); testa.writeUInt32BE(dati.length, 0); testa.write(tipo, 4, 'latin1');
  const coda = Buffer.alloc(4); coda.writeUInt32BE(crc32(Buffer.concat([testa.subarray(4), dati])), 0);
  return Buffer.concat([testa, dati, coda]);
}
function png(px, n) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  const righe = Buffer.alloc(n * (n * 4 + 1));
  for (let y = 0; y < n; y++) px.copy(righe, y * (n * 4 + 1) + 1, y * n * 4, (y + 1) * n * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), blocco('IHDR', ihdr), blocco('IDAT', zlib.deflateSync(righe, { level: 9 })), blocco('IEND', Buffer.alloc(0))]);
}

// --- immagine "DIB" dentro il .ico: BITMAPINFOHEADER, pixel BGRA dal basso, poi maschera a 1 bit
function dib(px, n) {
  const testa = Buffer.alloc(40);
  testa.writeUInt32LE(40, 0); testa.writeInt32LE(n, 4); testa.writeInt32LE(n * 2, 8);
  testa.writeUInt16LE(1, 12); testa.writeUInt16LE(32, 14);
  const colore = Buffer.alloc(n * n * 4);
  const larghezzaMaschera = Math.ceil(n / 32) * 4;
  const maschera = Buffer.alloc(larghezzaMaschera * n);
  for (let y = 0; y < n; y++) {
    const riga = n - 1 - y;
    for (let x = 0; x < n; x++) {
      const s = (y * n + x) * 4, d = (riga * n + x) * 4;
      colore[d] = px[s + 2]; colore[d + 1] = px[s + 1]; colore[d + 2] = px[s]; colore[d + 3] = px[s + 3];
      if (px[s + 3] === 0) maschera[riga * larghezzaMaschera + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  testa.writeUInt32LE(colore.length + maschera.length, 20);
  return Buffer.concat([testa, colore, maschera]);
}

function ico(immagini) {
  const testa = Buffer.alloc(6 + 16 * immagini.length);
  testa.writeUInt16LE(1, 2); testa.writeUInt16LE(immagini.length, 4);
  let posizione = testa.length;
  immagini.forEach(({ n, dati }, i) => {
    const v = 6 + 16 * i;
    testa[v] = n >= 256 ? 0 : n; testa[v + 1] = n >= 256 ? 0 : n;
    testa.writeUInt16LE(1, v + 4); testa.writeUInt16LE(32, v + 6);
    testa.writeUInt32LE(dati.length, v + 8); testa.writeUInt32LE(posizione, v + 12);
    posizione += dati.length;
  });
  return Buffer.concat([testa, ...immagini.map((m) => m.dati)]);
}

const immagini = MISURE.map((n) => { const px = disegna(n); return { n, dati: n >= 256 ? png(px, n) : dib(px, n) }; });
const uscita = path.join(radice, 'installer', 'clockwise.ico');
fs.mkdirSync(path.dirname(uscita), { recursive: true });
fs.writeFileSync(uscita, ico(immagini));
console.log(`installer/clockwise.ico — ${MISURE.join(', ')} px — ${(fs.statSync(uscita).size / 1024).toFixed(0)} KB`);

const iPng = process.argv.indexOf('--png');
if (iPng > 0 && process.argv[iPng + 1]) {
  const m = Number(process.argv[iPng + 2]) || 256;
  fs.writeFileSync(process.argv[iPng + 1], png(disegna(m), m));
  console.log(`anteprima ${m} px: ${process.argv[iPng + 1]}`);
}
