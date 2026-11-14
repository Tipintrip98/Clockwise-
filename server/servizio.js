// Il server HTTP di Clockwise, indipendente da come viene avviato: `npm start` (server/index.js)
// e l'eseguibile per Windows (server/eseguibile.js) gli passano cartella dati, versione e
// il fornitore dei file dell'interfaccia.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { creaClient, verificaChiave, chiamaApi, messaggioErrore } from './anthropic-api.js';
import { statoClaudeCode, chiamaClaudeCode } from './claude-code.js';
import { percorsoRelativo } from './statici.js';

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

/**
 * @param {object} o
 * @param {{leggi: (rel: string) => Promise<Buffer|null>}} o.fornitore  file dell'interfaccia
 * @param {string} o.cartellaDati   dove vive config.json (chiave API salvata)
 * @param {string} o.versione
 * @param {boolean} [o.eseguibile]  true quando gira come Clockwise.exe (la UI mostra "Esci")
 * @param {() => void} [o.suEsci]   chiamata dopo aver risposto a POST /api/esci
 * @returns {http.Server}
 */
export function creaServer({ fornitore, cartellaDati, versione, eseguibile = false, suEsci }) {
  const fileConfig = path.join(cartellaDati, 'config.json');

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

  async function stato() {
    const k = chiaveApi();
    return {
      versione,
      eseguibile: !!eseguibile,
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
    // pagine scansionate da far leggere a Claude: poche, solo JPEG o PNG, in base64
    const immagini = c.immagini == null ? [] : c.immagini;
    if (!Array.isArray(immagini) || immagini.length > 20 || immagini.some((im) => !im || !['image/jpeg', 'image/png'].includes(im.tipo) || typeof im.dati !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(im.dati.slice(0, 200)))) {
      return json(res, 400, { codice: 'richiesta', messaggio: 'Immagini non valide: al massimo 20, in formato JPEG o PNG.' });
    }
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
      modello: c.modello, impegno: c.impegno || 'high', system: c.system, documenti: c.documenti, compito: c.compito, schema: c.schema, immagini,
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
    if (percorso === '/api/esci' && req.method === 'POST') {
      // Prima la risposta, poi la chiusura: la pagina deve poter mostrare "Clockwise è stato chiuso".
      res.once('finish', () => { if (suEsci) suEsci(); else chiudiServer(server); });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', connection: 'close' });
      return res.end(JSON.stringify({ ok: true }));
    }
    return json(res, 404, { codice: 'non_trovato', messaggio: 'Percorso inesistente.' });
  }

  async function statico(req, res, percorso) {
    const rel = percorsoRelativo(percorso);
    if (rel === null) { res.writeHead(400); return res.end(); }
    if (rel === undefined) { res.writeHead(403); return res.end(); }
    const dati = await fornitore.leggi(rel);
    if (!dati) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Non trovato'); }
    res.writeHead(200, {
      'content-type': TIPI_MIME[path.posix.extname(rel)] || 'application/octet-stream',
      'cache-control': rel.startsWith('vendor/') ? 'max-age=86400' : 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    res.end(dati);
  }

  const server = http.createServer((req, res) => {
    const errore = (e) => { if (!res.headersSent) json(res, e.stato || 500, { codice: 'errore', messaggio: e.message || 'Errore interno.' }); else res.end(); };
    let percorso;
    try { percorso = new URL(req.url, 'http://localhost').pathname; } catch { res.writeHead(400); return res.end(); }
    if (percorso.startsWith('/api/')) api(req, res, percorso).catch(errore);
    else if (req.method === 'GET' || req.method === 'HEAD') statico(req, res, percorso).catch(errore);
    else { res.writeHead(405); res.end(); }
  });
  server.requestTimeout = 0; // le valutazioni possono durare molti minuti
  server.headersTimeout = 60000;
  return server;
}

/**
 * Chiusura pulita: niente nuove connessioni, quelle aperte (anche le valutazioni in corso,
 * che così vengono interrotte) vengono chiuse. La promessa si risolve a server fermo.
 */
export function chiudiServer(server) {
  return new Promise((ok) => {
    if (!server.listening) return ok();
    server.close(() => ok());
    server.closeAllConnections();
  });
}
