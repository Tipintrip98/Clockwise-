// Server locale di Clockwise: serve l'interfaccia e fa da ponte verso Claude.
// Ascolta solo su 127.0.0.1: i documenti non lasciano il computer se non verso Anthropic.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaClient, verificaChiave, chiamaApi, messaggioErrore } from './anthropic-api.js';
import { statoClaudeCode, chiamaClaudeCode } from './claude-code.js';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cartellaApp = path.join(radice, 'app');
const cartellaDati = process.env.CLOCKWISE_DATA || path.join(radice, 'data');
const fileConfig = path.join(cartellaDati, 'config.json');
const PORTA = Number(process.env.PORT) || 5757;
const versione = JSON.parse(fs.readFileSync(path.join(radice, 'package.json'), 'utf8')).version;

// --- chiave API: variabile d'ambiente oppure file locale leggibile solo dall'utente
function leggiConfig() { try { return JSON.parse(fs.readFileSync(fileConfig, 'utf8')); } catch { return {}; } }
function scriviConfig(c) {
  fs.mkdirSync(cartellaDati, { recursive: true });
  fs.writeFileSync(fileConfig, JSON.stringify(c, null, 2), { mode: 0o600 });
  try { fs.chmodSync(fileConfig, 0o600); } catch { /* filesystem senza permessi POSIX */ }
}
function chiaveApi() {
  const salvata = leggiConfig().chiaveApi;
  if (salvata) return { chiave: salvata, origine: 'salvata' };
  if (process.env.ANTHROPIC_API_KEY) return { chiave: process.env.ANTHROPIC_API_KEY, origine: 'ambiente' };
  return { chiave: null, origine: null };
}
const maschera = (k) => (k ? `${k.slice(0, 10)}…${k.slice(-4)}` : null);

const TIPI_MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function json(res, stato, corpo) {
  res.writeHead(stato, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(corpo));
}
function leggiCorpo(req, max = 60 * 1024 * 1024) {
  return new Promise((ok, ko) => {
    const pezzi = []; let tot = 0;
    req.on('data', (c) => { tot += c.length; if (tot > max) { ko(Object.assign(new Error('Richiesta troppo grande.'), { stato: 413 })); req.destroy(); } else pezzi.push(c); });
    req.on('end', () => { try { ok(pezzi.length ? JSON.parse(Buffer.concat(pezzi).toString('utf8')) : {}); } catch { ko(Object.assign(new Error('JSON non valido.'), { stato: 400 })); } });
    req.on('error', ko);
  });
}

// Solo richieste dalla pagina servita da questo server: niente chiamate da altri siti aperti nel browser.
function origineValida(req) {
  const host = req.headers.host || '';
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return false;
  const origine = req.headers.origin;
  if (origine) { try { return new URL(origine).host === host; } catch { return false; } }
  return true;
}

async function stato() {
  const k = chiaveApi();
  return {
    versione,
    api: { configurata: !!k.chiave, origine: k.origine, chiave: maschera(k.chiave) },
    claudeCode: await statoClaudeCode(),
  };
}

async function gestisciLlm(req, res) {
  const c = await leggiCorpo(req);
  for (const campo of ['system', 'documenti', 'compito', 'modello']) {
    if (typeof c[campo] !== 'string' || !c[campo]) return json(res, 400, { codice: 'richiesta', messaggio: `Campo mancante: ${campo}.` });
  }
  if (!/^claude-[a-z0-9.-]+$/.test(c.modello)) return json(res, 400, { codice: 'richiesta', messaggio: 'Modello non valido.' });
  if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(c.impegno || 'high')) return json(res, 400, { codice: 'richiesta', messaggio: 'Livello di approfondimento non valido.' });
  let client = null;
  if (c.provider === 'api') {
    const k = chiaveApi();
    if (!k.chiave) return json(res, 400, { codice: 'chiave', messaggio: 'Nessuna chiave API configurata.' });
    client = creaClient(k.chiave);
  } else if (c.provider !== 'claude-code') return json(res, 400, { codice: 'richiesta', messaggio: 'Collegamento non valido.' });

  const controllo = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controllo.abort(); });
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  const invia = (evento, dati) => { if (!res.writableEnded) res.write(`event: ${evento}\ndata: ${JSON.stringify(dati)}\n\n`); };
  const battito = setInterval(() => { if (!res.writableEnded) res.write(': attivo\n\n'); }, 15000);
  const parametri = {
    modello: c.modello, impegno: c.impegno || 'high', system: c.system, documenti: c.documenti, compito: c.compito, schema: c.schema,
    onPensiero: (delta) => invia('pensiero', { delta }), onTesto: (delta) => invia('testo', { delta }), signal: controllo.signal,
  };
  try {
    const r = c.provider === 'api' ? await chiamaApi({ client, ...parametri }) : await chiamaClaudeCode(parametri);
    invia('fine', r);
  } catch (e) {
    if (!controllo.signal.aborted) invia('errore', e.codice ? { codice: e.codice, messaggio: e.message } : messaggioErrore(e));
  } finally {
    clearInterval(battito);
    res.end();
  }
}

async function api(req, res, percorso) {
  if (!origineValida(req)) return json(res, 403, { codice: 'origine', messaggio: 'Richiesta non consentita.' });
  if (percorso === '/api/stato' && req.method === 'GET') return json(res, 200, await stato());
  if (percorso === '/api/ricontrolla' && req.method === 'POST') { await statoClaudeCode(true); return json(res, 200, await stato()); }
  if (percorso === '/api/chiave' && req.method === 'POST') {
    const { chiave } = await leggiCorpo(req, 4096);
    if (typeof chiave !== 'string' || chiave.trim().length < 20) return json(res, 400, { codice: 'chiave', messaggio: 'Incolla la chiave completa (inizia con sk-ant-).' });
    try { await verificaChiave(chiave.trim()); } catch (e) { return json(res, 400, messaggioErrore(e)); }
    scriviConfig({ ...leggiConfig(), chiaveApi: chiave.trim() });
    return json(res, 200, await stato());
  }
  if (percorso === '/api/chiave' && req.method === 'DELETE') {
    const cfg = leggiConfig(); delete cfg.chiaveApi; scriviConfig(cfg);
    return json(res, 200, await stato());
  }
  if (percorso === '/api/llm' && req.method === 'POST') return gestisciLlm(req, res);
  return json(res, 404, { codice: 'non_trovato', messaggio: 'Percorso inesistente.' });
}

function statico(req, res, percorso) {
  const rel = percorso === '/' ? 'index.html' : decodeURIComponent(percorso).replace(/^\/+/, '');
  const file = path.resolve(cartellaApp, rel);
  if (file !== cartellaApp && !file.startsWith(cartellaApp + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, dati) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Non trovato'); }
    res.writeHead(200, {
      'content-type': TIPI_MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': rel.startsWith('vendor/') ? 'max-age=86400' : 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    res.end(dati);
  });
}

const server = http.createServer((req, res) => {
  const percorso = new URL(req.url, 'http://localhost').pathname;
  if (percorso.startsWith('/api/')) {
    api(req, res, percorso).catch((e) => { if (!res.headersSent) json(res, e.stato || 500, { codice: 'errore', messaggio: e.message || 'Errore interno.' }); else res.end(); });
  } else if (req.method === 'GET' || req.method === 'HEAD') statico(req, res, percorso);
  else { res.writeHead(405); res.end(); }
});
server.requestTimeout = 0; // le valutazioni possono durare molti minuti
server.headersTimeout = 60000;

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
