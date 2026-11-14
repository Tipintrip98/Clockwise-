// Lettura delle scansioni: gruppi di pagine, rifiuti, passaggio delle immagini a Claude Code e al server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { trascriviScansione, AVVISO_TRASCRIZIONE } from '../app/js/core/scansioni.js';

// Claude Code finto: riporta come ha ricevuto il messaggio (argomenti e contenuto di stdin).
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'clockwise-cli-'));
process.on('exit', () => fs.rmSync(cartella, { recursive: true, force: true }));
const finto = path.join(cartella, 'claude-finto');
fs.writeFileSync(finto, `#!/usr/bin/env node
let b = ''; process.stdin.on('data', (d) => { b += d; }).on('end', () => {
  const a = process.argv.slice(2);
  let immagini = 0, testo = b, formato = 'testo';
  if (a.includes('--input-format')) { const m = JSON.parse(b.trim()); formato = a[a.indexOf('--input-format') + 1]; immagini = m.message.content.filter((c) => c.type === 'image' && c.source.type === 'base64' && c.source.data).length; testo = m.message.content.find((c) => c.type === 'text').text; }
  console.log(JSON.stringify({ type: 'result', subtype: 'success', result: JSON.stringify({ formato, immagini, senzaStrumenti: a[a.indexOf('--tools') + 1] === '', testo: testo.slice(0, 40) }), usage: {} }));
});
`, { mode: 0o755 });
process.env.CLOCKWISE_CLAUDE_BIN = finto;
delete process.env.ANTHROPIC_API_KEY;
const { chiamaClaudeCode } = await import('../server/claude-code.js');
const { creaServer, chiudiServer } = await import('../server/servizio.js');
const { fornitoreCartella } = await import('../server/statici.js');

const pagine = (n) => Array.from({ length: n }, (_, i) => ({ tipo: 'image/jpeg', dati: Buffer.from(`pagina ${i + 1}`).toString('base64') }));

test('trascrizione a gruppi di pagine, nell’ordine', async () => {
  const chiamate = [];
  const llm = { immagini: { max: 2 }, async chiama(r) { chiamate.push(r); return { testo: r.immagini.map((im) => `[pagina ${Buffer.from(im.dati, 'base64').toString().split(' ')[1]}]\nTesto della pagina. [firma autografa di Mario Rossi]`).join('\n'), modello: 'finto' }; } };
  const eventi = [];
  const r = await trascriviScansione({ nome: 'contratto.pdf', tipo: 'coproduzione', immagini: pagine(5), llm, opzioni: { modello: 'm' }, onEvento: (e) => eventi.push(e.fatte) });
  assert.deepEqual(chiamate.map((c) => c.immagini.length), [2, 2, 1]);
  assert.ok(chiamate[1].documenti.includes('da 3 a 4 di 5') && chiamate[2].documenti.includes('della pagina 5 di 5'));
  assert.ok(chiamate[0].compito.includes('firma autografa') && chiamate[0].schema === null && chiamate[0].impegno === 'low');
  assert.deepEqual(eventi, [0, 2, 4, 5]);
  assert.equal(r.pagine, 5);
  assert.deepEqual([...r.testo.matchAll(/\[pagina (\d)\]/g)].map((m) => m[1]), ['1', '2', '3', '4', '5']);
  assert.ok(AVVISO_TRASCRIZIONE.includes('controlla'));
});

test('niente lettura per i documenti d’identità, senza immagini o senza un collegamento adatto', async () => {
  const llm = { immagini: { max: 4 }, async chiama() { return { testo: '[pagina bianca]' }; } };
  await assert.rejects(trascriviScansione({ nome: 'ci.pdf', tipo: 'identita', immagini: pagine(1), llm, opzioni: {} }), (e) => e.codice === 'rifiutato');
  await assert.rejects(trascriviScansione({ nome: 'a.pdf', tipo: 'altro', immagini: [], llm, opzioni: {} }), (e) => e.codice === 'nessun_documento');
  await assert.rejects(trascriviScansione({ nome: 'a.pdf', tipo: 'altro', immagini: pagine(1), llm: { immagini: null }, opzioni: {} }), (e) => e.codice === 'images_unavailable');
  await assert.rejects(trascriviScansione({ nome: 'a.pdf', tipo: 'altro', immagini: pagine(1), llm, opzioni: {} }), (e) => e.codice === 'empty_completion', 'una pagina senza testo non diventa una trascrizione');
});

test('Claude Code: con le immagini il messaggio viaggia come JSON, senza strumenti', { skip: process.platform === 'win32' }, async () => {
  const base = { modello: 'claude-prova', impegno: 'low', system: 'Sistema.', documenti: 'Documenti.', compito: 'Compito.' };
  const con = JSON.parse((await chiamaClaudeCode({ ...base, immagini: pagine(3) })).testo);
  assert.deepEqual(con, { formato: 'stream-json', immagini: 3, senzaStrumenti: true, testo: 'Sistema.\n\nDocumenti.\n\nCompito.' });
  const senza = JSON.parse((await chiamaClaudeCode(base)).testo);
  assert.deepEqual(senza, { formato: 'testo', immagini: 0, senzaStrumenti: true, testo: 'Sistema.\n\nDocumenti.\n\nCompito.' });
});

test('server: immagini accettate solo se poche e in JPEG o PNG', { skip: process.platform === 'win32' }, async () => {
  const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const server = creaServer({ fornitore: fornitoreCartella(path.join(radice, 'app')), cartellaDati: cartella, versione: '9.9.9' });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const chiedi = (immagini) => fetch(`${base}/api/llm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'claude-code', modello: 'claude-prova', impegno: 'low', system: 's', documenti: 'd', compito: 'c', immagini }) });
  try {
    assert.equal((await chiedi(pagine(21))).status, 400);
    assert.equal((await chiedi([{ tipo: 'image/svg+xml', dati: 'AAAA' }])).status, 400);
    assert.equal((await chiedi([{ tipo: 'image/png', dati: '<script>' }])).status, 400);
    assert.equal((await chiedi('tante')).status, 400);
    const ok = await chiedi(pagine(2));
    assert.equal(ok.status, 200);
    const flusso = await ok.text();
    assert.ok(flusso.includes('event: fine') && flusso.includes('\\"immagini\\":2'), 'le immagini arrivano a Claude Code');
  } finally { await chiudiServer(server); }
});
