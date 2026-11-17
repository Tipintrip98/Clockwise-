// Server locale: file dell'interfaccia (da cartella e incorporati), stato, uscita, scelta della porta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// I test non devono avviare Claude Code: il comando punta a un file che non esiste.
// Va impostato prima di caricare il server, che legge la variabile all'importazione.
process.env.CLOCKWISE_CLAUDE_BIN = path.join(os.tmpdir(), 'clockwise-claude-inesistente');
delete process.env.ANTHROPIC_API_KEY;
const { creaServer, chiudiServer } = await import('../server/servizio.js');
const { fornitoreCartella, fornitoreIncorporato, percorsoRelativo } = await import('../server/statici.js');
const { cartellaDatiEseguibile, comandoBrowser, apriBrowser, ascolta, avviaSuPortaLibera, clockwiseGiaAvviato } = await import('../server/avvio.js');

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cartellaDati = fs.mkdtempSync(path.join(os.tmpdir(), 'clockwise-test-'));
process.on('exit', () => fs.rmSync(cartellaDati, { recursive: true, force: true }));

/** Avvia un server su una porta libera scelta dal sistema e restituisce il suo indirizzo. */
async function avvia(opzioni = {}) {
  const server = creaServer({ fornitore: fornitoreCartella(path.join(radice, 'app')), cartellaDati, versione: '9.9.9', ...opzioni });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { server, porta: server.address().port, base: `http://127.0.0.1:${server.address().port}` };
}
const altroProgramma = () => http.createServer((_, res) => { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('non sono Clockwise'); });

test('percorsoRelativo: solo percorsi dentro la cartella dell’interfaccia', () => {
  assert.equal(percorsoRelativo('/'), 'index.html');
  assert.equal(percorsoRelativo('/js/main.js'), 'js/main.js');
  assert.equal(percorsoRelativo('/js/./ui/../main.js'), 'js/main.js');
  assert.equal(percorsoRelativo('/..%2f..%2fpackage.json'), undefined);
  assert.equal(percorsoRelativo('/..%5c..%5cpackage.json'), undefined);
  assert.equal(percorsoRelativo('/C:/Windows/win.ini'), undefined);
  assert.equal(percorsoRelativo('/%E0%A4%A'), null);
  assert.equal(percorsoRelativo('/a%00b'), null);
});

test('serve l’interfaccia dalla cartella app/', async () => {
  const { server, base } = await avvia();
  try {
    const pagina = await fetch(`${base}/`);
    assert.equal(pagina.status, 200);
    assert.match(pagina.headers.get('content-type'), /^text\/html/);
    assert.match(await pagina.text(), /Clockwise/);

    for (const [percorso, tipo] of [['/css/app.css', 'text/css'], ['/js/main.js', 'text/javascript'], ['/vendor/xlsx.full.min.js', 'text/javascript']]) {
      const r = await fetch(base + percorso);
      assert.equal(r.status, 200, percorso);
      assert.ok(r.headers.get('content-type').startsWith(tipo), percorso);
      const corpo = Buffer.from(await r.arrayBuffer());
      assert.ok(corpo.equals(fs.readFileSync(path.join(radice, 'app', percorso))), `${percorso} identico al file`);
    }
    assert.equal((await fetch(`${base}/vendor/xlsx.full.min.js`)).headers.get('cache-control'), 'max-age=86400');
    assert.equal((await fetch(`${base}/js/main.js`)).headers.get('cache-control'), 'no-cache');

    assert.equal((await fetch(`${base}/js/non-esiste.js`)).status, 404);
    assert.equal((await fetch(`${base}/js/`)).status, 404);
    assert.equal((await fetch(`${base}/..%2f..%2fpackage.json`)).status, 403);
    assert.equal((await fetch(`${base}/%E0%A4%A`)).status, 400);
    assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
  } finally { await chiudiServer(server); }
});

test('serve l’interfaccia incorporata nell’eseguibile (asset SEA)', async () => {
  const asset = { 'app/index.html': '<title>Clockwise incorporato</title>', 'app/js/main.js': 'export const x = 1;', 'app/vendor/lib.js': '/* lib */' };
  const chieste = [];
  const sea = { getRawAsset(chiave) { chieste.push(chiave); const t = asset[chiave]; if (t === undefined) throw new Error('asset mancante'); return new TextEncoder().encode(t).buffer; } };
  const fornitore = fornitoreIncorporato(sea, ['index.html', 'js/main.js', 'vendor/lib.js', 'elencato-ma-assente.js']);
  const { server, base } = await avvia({ fornitore, eseguibile: true });
  try {
    assert.match(await (await fetch(`${base}/`)).text(), /Clockwise incorporato/);
    const modulo = await fetch(`${base}/js/main.js`);
    assert.equal(modulo.status, 200);
    assert.match(modulo.headers.get('content-type'), /^text\/javascript/);
    assert.equal(await modulo.text(), asset['app/js/main.js']);
    assert.equal((await fetch(`${base}/vendor/lib.js`)).headers.get('cache-control'), 'max-age=86400');
    assert.equal((await fetch(`${base}/css/app.css`)).status, 404, 'non in elenco');
    assert.equal((await fetch(`${base}/elencato-ma-assente.js`)).status, 404, 'in elenco ma senza asset');
    assert.ok(!chieste.includes('app/css/app.css'), 'i file fuori elenco non vengono nemmeno cercati');
    assert.equal((await (await fetch(`${base}/api/stato`)).json()).eseguibile, true);
  } finally { await chiudiServer(server); }
});

test('/api/stato: versione, eseguibile e nessuna chiave in chiaro', async () => {
  const { server, base } = await avvia();
  try {
    const r = await fetch(`${base}/api/stato`);
    assert.equal(r.status, 200);
    const stato = await r.json();
    assert.equal(stato.versione, '9.9.9');
    assert.equal(stato.eseguibile, false);
    assert.deepEqual(stato.api, { configurata: false, origine: null, chiave: null });
    assert.equal(stato.claudeCode.installato, false);
    assert.equal((await fetch(`${base}/api/non-esiste`)).status, 404);
    // richieste arrivate da un altro sito aperto nel browser: rifiutate
    assert.equal((await fetch(`${base}/api/stato`, { headers: { origin: 'http://esempio.invalid' } })).status, 403);
  } finally { await chiudiServer(server); }
});

test('POST /api/esci: risponde, poi chiude; da un altro sito non chiude niente', async () => {
  let chiamate = 0;
  const { server, base } = await avvia({ suEsci: () => { chiamate++; } });
  try {
    assert.equal((await fetch(`${base}/api/esci`, { method: 'POST', headers: { origin: 'http://esempio.invalid' } })).status, 403);
    assert.equal((await fetch(`${base}/api/esci`)).status, 404, 'solo POST');
    assert.equal(chiamate, 0);
    const r = await fetch(`${base}/api/esci`, { method: 'POST' });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal(chiamate, 1);
  } finally { await chiudiServer(server); }

  // senza `suEsci` il server si ferma da solo
  const secondo = await avvia();
  assert.equal((await fetch(`${secondo.base}/api/esci`, { method: 'POST' })).status, 200);
  for (let i = 0; i < 100 && secondo.server.listening; i++) await new Promise((ok) => setTimeout(ok, 20));
  assert.equal(secondo.server.listening, false);
});

test('cartella dati dell’eseguibile: CLOCKWISE_DATA, poi %APPDATA%\\Clockwise, poi ~/.clockwise', () => {
  assert.equal(cartellaDatiEseguibile({ CLOCKWISE_DATA: '/dati/miei', APPDATA: '/roaming' }, '/casa'), '/dati/miei');
  assert.equal(cartellaDatiEseguibile({ APPDATA: '/roaming' }, '/casa'), path.join('/roaming', 'Clockwise'));
  assert.equal(cartellaDatiEseguibile({}, '/casa'), path.join('/casa', '.clockwise'));
});

test('apertura del browser: comando per ogni sistema, mai con CLOCKWISE_NO_BROWSER=1', () => {
  const url = 'http://localhost:5757';
  // su Windows un programma senza console (rundll32): Clockwise gira in background e non deve aprire finestre nere
  const win = comandoBrowser(url, 'win32', { SystemRoot: 'C:\\Windows' });
  assert.equal(win.comando, 'C:\\Windows\\System32\\rundll32.exe');
  assert.deepEqual(win.args, ['url.dll,FileProtocolHandler', url]);
  assert.equal(win.opzioni.windowsHide, true);
  assert.deepEqual(comandoBrowser(url, 'darwin'), { comando: 'open', args: [url], opzioni: {} });
  assert.deepEqual(comandoBrowser(url, 'linux'), { comando: 'xdg-open', args: [url], opzioni: {} });
  assert.equal(apriBrowser(url, { CLOCKWISE_NO_BROWSER: '1' }), false);
  assert.equal(apriBrowser('http://esempio.invalid/', {}), false, 'solo l’indirizzo locale di Clockwise');
  assert.equal(apriBrowser('http://localhost:5757/x & calc', {}), false);
});

test('porta: libera -> la usa; occupata da Clockwise -> già avviato; occupata da altro -> la successiva', async () => {
  const dati = { fornitore: fornitoreCartella(path.join(radice, 'app')), cartellaDati, versione: '9.9.9' };

  // 1) Clockwise già in ascolto: il secondo avvio non apre un altro server
  const primo = await avvia();
  const doppione = creaServer(dati);
  try {
    assert.equal((await clockwiseGiaAvviato(primo.porta)).versione, '9.9.9');
    const esito = await avviaSuPortaLibera(doppione, primo.porta);
    assert.equal(esito.giaAvviato, true);
    assert.equal(esito.porta, primo.porta);
    assert.equal(doppione.listening, false);
  } finally { await chiudiServer(primo.server); await chiudiServer(doppione); }

  // 2) porta occupata da un altro programma: Clockwise passa oltre
  const altro = altroProgramma();
  await new Promise((ok) => altro.listen(0, '127.0.0.1', ok));
  const occupata = altro.address().port;
  const server = creaServer(dati);
  try {
    assert.equal(await clockwiseGiaAvviato(occupata), null);
    assert.equal(await ascolta(creaServer(dati), occupata), false);
    const esito = await avviaSuPortaLibera(server, occupata);
    assert.equal(esito.giaAvviato, false);
    assert.ok(esito.porta > occupata && esito.porta <= occupata + 30, `porta scelta: ${esito.porta}`);
    assert.equal((await (await fetch(`http://127.0.0.1:${esito.porta}/api/stato`)).json()).versione, '9.9.9');
  } finally { await chiudiServer(server); await new Promise((ok) => altro.close(ok)); }

  // 3) nessuno in ascolto: nessun Clockwise
  assert.equal(await clockwiseGiaAvviato(occupata, 1000), null);
});

test('aggiornamento: una versione diversa rimasta aperta viene chiusa e sostituita; la stessa versione resta', async () => {
  const { avviaSostituendo } = await import('../server/avvio.js');
  const base = { fornitore: fornitoreCartella(path.join(radice, 'app')), cartellaDati };
  // vecchia versione in ascolto, con la sua uscita su richiesta (come l'eseguibile)
  const vecchio = creaServer({ ...base, versione: '2.0.0', suEsci: () => chiudiServer(vecchio) });
  assert.equal(await ascolta(vecchio, 0), true);
  const porta = vecchio.address().port;
  const nuovo = creaServer({ ...base, versione: '2.0.3' });
  try {
    const esito = await avviaSostituendo(nuovo, porta, '2.0.3', { pausaMs: 100 });
    assert.equal(esito.giaAvviato, false);
    assert.equal(esito.sostituita, '2.0.0');
    assert.equal(esito.porta, porta);
    assert.equal((await (await fetch(`http://127.0.0.1:${porta}/api/stato`)).json()).versione, '2.0.3');
    // stessa versione: il secondo avvio riapre quella che c'è, senza chiuderla
    const doppione = creaServer({ ...base, versione: '2.0.3' });
    const e2 = await avviaSostituendo(doppione, porta, '2.0.3', { pausaMs: 100 });
    assert.equal(e2.giaAvviato, true);
    assert.equal(e2.sostituita, undefined);
    assert.equal(nuovo.listening, true);
  } finally { await chiudiServer(nuovo); await chiudiServer(vecchio).catch(() => {}); }
});
