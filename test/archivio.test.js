// Archivio su disco (dossier, impostazioni e file originali nella cartella dei dati), programma in background,
// avvio all'accensione, registro su file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

process.env.CLOCKWISE_CLAUDE_BIN = path.join(os.tmpdir(), 'clockwise-claude-inesistente');
process.env.CLOCKWISE_NO_BROWSER = '1';
const { creaServer, chiudiServer } = await import('../server/servizio.js');
const { fornitoreCartella } = await import('../server/statici.js');
const { nomeSicuro } = await import('../server/archivio.js');
const { creaRegistro, statoAvvioAutomatico, impostaAvvioAutomatico } = await import('../server/avvio.js');

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cartellaDati = fs.mkdtempSync(path.join(os.tmpdir(), 'clockwise-archivio-'));
process.on('exit', () => fs.rmSync(cartellaDati, { recursive: true, force: true }));

async function avvia(opzioni = {}) {
  const server = creaServer({ fornitore: fornitoreCartella(path.join(radice, 'app')), cartellaDati, versione: '9.9.9', ...opzioni });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('archivio: i valori si scrivono su disco, si rileggono, si elencano e si eliminano', async () => {
  const { server, base } = await avvia();
  try {
    const vuoto = await (await fetch(`${base}/api/archivio`)).json();
    assert.equal(vuoto.attivo, true);
    assert.equal(vuoto.cartella, path.join(cartellaDati, 'archivio'));
    assert.deepEqual(vuoto.chiavi, []);

    const dossier = { id: 'abc123', nome: 'Prova «accenti» è', documenti: [{ testo: 'x'.repeat(200000) }] };
    const put = await fetch(`${base}/api/archivio/kv/${encodeURIComponent('progetto:abc123')}`, { method: 'PUT', body: JSON.stringify(dossier) });
    assert.equal(put.status, 200);
    // sul disco: un file leggibile, con un nome valido anche su Windows (niente «:»)
    const file = path.join(cartellaDati, 'archivio', 'kv', 'progetto~abc123.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), dossier);
    assert.deepEqual(await (await fetch(`${base}/api/archivio/kv/${encodeURIComponent('progetto:abc123')}`)).json(), dossier);
    assert.deepEqual((await (await fetch(`${base}/api/archivio`)).json()).chiavi.map((c) => c.chiave), ['progetto:abc123']);
    assert.ok(!fs.readdirSync(path.dirname(file)).some((n) => n.endsWith('.tmp')), 'nessun file temporaneo lasciato');

    assert.equal((await fetch(`${base}/api/archivio/kv/assente`)).status, 204, 'chiave mai scritta: nessun contenuto, non un errore');
    assert.equal((await fetch(`${base}/api/archivio/kv/x`, { method: 'PUT', body: '{non json' })).status, 400, 'non si salva ciò che non è JSON');
    for (const cattiva of ['..%2F..%2Fconfig', 'a%2Fb', '%00', '.nascosto']) assert.equal((await fetch(`${base}/api/archivio/kv/${cattiva}`, { method: 'PUT', body: '1' })).status >= 400, true, cattiva);
    assert.ok(!fs.existsSync(path.join(cartellaDati, 'config.json')), 'nessuna scrittura fuori dall’archivio');

    assert.equal((await fetch(`${base}/api/archivio/kv/${encodeURIComponent('progetto:abc123')}`, { method: 'DELETE' })).status, 200);
    assert.equal(fs.existsSync(file), false);
  } finally { await chiudiServer(server); }
});

test('archivio: i file originali restano sul computer con il loro nome; un HTML non viene mai eseguito', async () => {
  const { server, base } = await avvia();
  try {
    const pdf = Buffer.from('%PDF-1.4 contenuto di prova');
    const r = await (await fetch(`${base}/api/archivio/file/dossier1/doc1?nome=${encodeURIComponent('Contratto «firmato»: v2.pdf')}`, { method: 'PUT', body: pdf })).json();
    assert.equal(r.ok, true); assert.equal(r.byte, pdf.length);
    assert.equal(r.nome, 'Contratto «firmato»_ v2.pdf', 'i caratteri vietati nei nomi di file vengono sostituiti');
    assert.deepEqual(fs.readFileSync(path.join(cartellaDati, 'archivio', 'originali', 'dossier1', 'doc1', r.nome)), pdf);
    const letto = await fetch(`${base}/api/archivio/file/dossier1/doc1`);
    assert.equal(letto.headers.get('content-type'), 'application/pdf');
    assert.match(letto.headers.get('content-disposition'), /^inline/);
    assert.deepEqual(Buffer.from(await letto.arrayBuffer()), pdf);

    // ricaricare lo stesso documento sostituisce il file: ne resta uno solo
    await fetch(`${base}/api/archivio/file/dossier1/doc1?nome=nuovo.pdf`, { method: 'PUT', body: pdf });
    assert.deepEqual(fs.readdirSync(path.join(cartellaDati, 'archivio', 'originali', 'dossier1', 'doc1')), ['nuovo.pdf']);

    await fetch(`${base}/api/archivio/file/dossier1/doc2?nome=pagina.html`, { method: 'PUT', body: '<script>alert(1)</script>' });
    const html = await fetch(`${base}/api/archivio/file/dossier1/doc2`);
    assert.equal(html.headers.get('content-type'), 'application/octet-stream');
    assert.match(html.headers.get('content-disposition'), /^attachment/);
    assert.equal(html.headers.get('x-content-type-options'), 'nosniff');
    assert.match(html.headers.get('content-security-policy'), /sandbox/);

    assert.deepEqual((await (await fetch(`${base}/api/archivio/file/dossier1`)).json()).file.map((f) => f.id).sort(), ['doc1', 'doc2']);
    const stato = await (await fetch(`${base}/api/archivio`)).json();
    assert.equal(stato.originali, 2);
    // percorsi fuori dall'archivio: rifiutati
    for (const cattivo of ['..%2F..', 'a%2F..%2Fb', '%2e%2e']) assert.equal((await fetch(`${base}/api/archivio/file/${cattivo}/x?nome=a.txt`, { method: 'PUT', body: 'x' })).status >= 400, true, cattivo);
    // eliminare il dossier elimina i suoi file
    await fetch(`${base}/api/archivio/file/dossier1/doc2`, { method: 'DELETE' });
    assert.equal((await fetch(`${base}/api/archivio/file/dossier1/doc2`)).status, 404);
    await fetch(`${base}/api/archivio/file/dossier1`, { method: 'DELETE' });
    assert.equal(fs.existsSync(path.join(cartellaDati, 'archivio', 'originali', 'dossier1')), false);
  } finally { await chiudiServer(server); }
});

test('archivio: niente letture da altri siti aperti nel browser', async () => {
  const { server, base } = await avvia();
  try {
    assert.equal((await fetch(`${base}/api/archivio`, { headers: { origin: 'https://esempio.invalid' } })).status, 403);
    assert.equal((await fetch(`${base}/api/archivio`, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
    assert.equal((await fetch(`${base}/api/archivio`, { headers: { 'sec-fetch-site': 'same-origin' } })).status, 200);
  } finally { await chiudiServer(server); }
});

test('nomeSicuro: mai percorsi, nomi riservati di Windows o nomi vuoti', () => {
  assert.equal(nomeSicuro('../../etc/passwd'), 'passwd');
  assert.equal(nomeSicuro('C:\\Utenti\\io\\Modulo III.xlsx'), 'Modulo III.xlsx');
  assert.equal(nomeSicuro('con.txt'), '_con.txt');
  assert.equal(nomeSicuro('  '), 'file');
  assert.equal(nomeSicuro('nome. . '), 'nome');
  assert.equal(nomeSicuro(`${'a'.repeat(300)}.pdf`).length, 150);
  assert.ok(nomeSicuro(`${'a'.repeat(300)}.pdf`).endsWith('.pdf'));
});

test('programma: stato, cartella dei dati, avvio all’accensione (registro di Windows simulato)', async () => {
  let attivo = false; const aperte = [];
  const { server, base } = await avvia({ eseguibile: true, programma: { sfondo: true, registro: path.join(cartellaDati, 'clockwise.log'), apriCartella: (c) => aperte.push(c),
    avvioAutomatico: { stato: () => ({ disponibile: true, attivo }), imposta: (v) => { attivo = v; return { ok: true }; } } } });
  try {
    const p = await (await fetch(`${base}/api/programma`)).json();
    assert.equal(p.sfondo, true); assert.equal(p.eseguibile, true);
    assert.equal(p.archivio, path.join(cartellaDati, 'archivio'));
    assert.deepEqual(p.avvioAutomatico, { disponibile: true, attivo: false });
    const dopo = await (await fetch(`${base}/api/programma/avvio-automatico`, { method: 'POST', body: JSON.stringify({ attivo: true }) })).json();
    assert.equal(dopo.avvioAutomatico.attivo, true);
    await fetch(`${base}/api/programma/avvio-automatico`, { method: 'POST', body: JSON.stringify({ attivo: false }) });
    assert.equal(attivo, false);
    assert.equal((await (await fetch(`${base}/api/stato`)).json()).sfondo, true);
    await fetch(`${base}/api/archivio/apri`, { method: 'POST' });
    assert.deepEqual(aperte, [path.join(cartellaDati, 'archivio')]);
  } finally { await chiudiServer(server); }
  // fuori dal programma installato l'avvio all'accensione non si può impostare
  const dev = await avvia();
  try { assert.equal((await fetch(`${dev.base}/api/programma/avvio-automatico`, { method: 'POST', body: JSON.stringify({ attivo: true }) })).status, 400); } finally { await chiudiServer(dev.server); }
});

test('avvio all’accensione: voce nel registro dell’utente con --sfondo; togliere una voce assente non è un errore', () => {
  const chiamate = [];
  const esegui = (stato, stdout = '') => (args) => { chiamate.push(args); return { status: stato, stdout, stderr: '' }; };
  assert.deepEqual(statoAvvioAutomatico({ piattaforma: 'linux' }), { disponibile: false, attivo: false });
  assert.deepEqual(statoAvvioAutomatico({ piattaforma: 'win32', eseguibile: false }), { disponibile: false, attivo: false });
  assert.deepEqual(statoAvvioAutomatico({ piattaforma: 'win32', esegui: esegui(1) }), { disponibile: true, attivo: false });
  assert.deepEqual(statoAvvioAutomatico({ piattaforma: 'win32', esegui: esegui(0, '    Clockwise    REG_SZ    "C:\\x\\Clockwise.exe" --sfondo') }), { disponibile: true, attivo: true });
  chiamate.length = 0;
  assert.deepEqual(impostaAvvioAutomatico(true, { exe: 'C:\\Utenti\\Niccolò De Rossi\\Clockwise.exe', esegui: esegui(0) }), { ok: true });
  assert.deepEqual(chiamate[0].slice(0, 2), ['add', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run']);
  assert.ok(chiamate[0].includes('"C:\\Utenti\\Niccolò De Rossi\\Clockwise.exe" --sfondo'));
  assert.deepEqual(impostaAvvioAutomatico(false, { esegui: esegui(1) }), { ok: true });
  assert.equal(impostaAvvioAutomatico(true, { exe: 'x', esegui: () => ({ status: 1, stderr: 'Accesso negato' }) }).ok, false);
});

test('registro su file: righe con data, ripartenza oltre il limite, mai un errore', () => {
  const file = path.join(cartellaDati, 'registro', 'clockwise.log');
  const r = creaRegistro(file);
  r.scrivi('Clockwise 9.9.9 avviato'); r.scrivi('seconda riga');
  const righe = fs.readFileSync(file, 'utf8').trim().split('\n');
  assert.equal(righe.length, 2);
  assert.match(righe[0], /^\d{4}-\d\d-\d\dT[\d:.]+Z {2}Clockwise 9\.9\.9 avviato$/);
  fs.writeFileSync(file, 'x'.repeat(2000));
  creaRegistro(file, { massimo: 1000 }).scrivi('dopo il limite');
  assert.equal(fs.readFileSync(file, 'utf8').trim().split('\n').length, 1);
  assert.doesNotThrow(() => creaRegistro(path.join(cartellaDati, 'registro', 'clockwise.log', 'impossibile.log')).scrivi('x'));
});
