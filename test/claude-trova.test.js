// Ricerca di Claude Code: posizioni controllate, PATH del registro di Windows, diagnosi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { candidati, pathDalRegistro, conShell, trovaClaude } from '../server/claude-trova.js';
import { diagnosi, testoDiagnosi } from '../server/diagnosi.js';

test('Windows: oltre al PATH si controllano registro, installatore ufficiale, npm, WinGet', () => {
  const env = { Path: 'C:\\Windows\\system32', USERPROFILE: 'C:\\Users\\Mario', APPDATA: 'C:\\Users\\Mario\\AppData\\Roaming', LOCALAPPDATA: 'C:\\Users\\Mario\\AppData\\Local', ProgramFiles: 'C:\\Program Files' };
  const c = candidati({ env, piattaforma: 'win32', home: 'C:\\Users\\Mario', registro: ['C:\\Users\\Mario\\.local\\bin', 'C:\\Strumenti'] });
  const percorsi = c.map((x) => x.percorso);
  assert.equal(percorsi[0], 'C:\\Windows\\system32\\claude.exe');
  assert.ok(percorsi.includes('C:\\Strumenti\\claude.exe'), 'PATH dal registro');
  assert.ok(percorsi.includes('C:\\Users\\Mario\\.local\\bin\\claude.exe'), 'installatore ufficiale');
  assert.ok(percorsi.includes('C:\\Users\\Mario\\AppData\\Roaming\\npm\\claude.cmd'), 'npm');
  assert.ok(percorsi.includes('C:\\Users\\Mario\\AppData\\Local\\Microsoft\\WinGet\\Links\\claude.exe'), 'WinGet');
  // la stessa cartella non compare due volte, anche se arriva da più origini
  assert.equal(percorsi.filter((p) => p.toLowerCase() === 'c:\\users\\mario\\.local\\bin\\claude.exe').length, 1);
  assert.equal(c.find((x) => x.percorso.endsWith('.local\\bin\\claude.exe')).origine, 'PATH dal registro di Windows');
});

test('PATH dal registro: utente e sistema, con le variabili espanse', () => {
  const finto = (args) => ({ stdout: args[1].startsWith('HKCU')
    ? '\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    %USERPROFILE%\\.local\\bin;C:\\Strumenti\r\n'
    : '\r\n    Path    REG_SZ    C:\\Windows\\system32;C:\\Windows\r\n' });
  const p = pathDalRegistro({ USERPROFILE: 'C:\\Users\\Mario', CLOCKWISE_TEST_REGISTRO: '1' }, finto);
  assert.deepEqual(p, ['C:\\Users\\Mario\\.local\\bin', 'C:\\Strumenti', 'C:\\Windows\\system32', 'C:\\Windows']);
});

test('macOS e Linux: installatore ufficiale, Homebrew, npm', () => {
  const c = candidati({ env: { PATH: '/usr/bin' }, piattaforma: 'linux', home: '/home/mario', registro: [] }).map((x) => x.percorso);
  assert.deepEqual(c.slice(0, 2), ['/usr/bin/claude', '/home/mario/.local/bin/claude']);
  assert.ok(c.includes('/opt/homebrew/bin/claude') && c.includes('/home/mario/.npm-global/bin/claude'));
});

test('shell solo per i .cmd e .bat', () => {
  assert.equal(conShell('C:\\x\\claude.exe'), false);
  assert.equal(conShell('C:\\x\\claude.cmd'), true);
  assert.equal(conShell('/usr/bin/claude'), false);
});

test('trovaClaude e diagnosi con un Claude Code finto fuori dal PATH', async () => {
  const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'clockwise-trova-'));
  const bin = path.join(cartella, '.local', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "9.9.9 (Claude Code)"; else echo \'{"loggedIn":false}\'; fi\n', { mode: 0o755 });
  try {
    if (process.platform !== 'win32') {
      const vecchiaHome = process.env.HOME;
      process.env.HOME = cartella;
      try {
        const t = await trovaClaude({ PATH: '/nessuna/cartella', HOME: cartella });
        // os.homedir() può ignorare HOME: in quel caso il file si trova solo con CLOCKWISE_CLAUDE_BIN
        const r = t.percorso ? t : await trovaClaude({ PATH: '/nessuna/cartella', CLOCKWISE_CLAUDE_BIN: path.join(bin, 'claude') });
        assert.equal(r.versione, '9.9.9 (Claude Code)');
      } finally { process.env.HOME = vecchiaHome; }
    }
    const vecchio = process.env.CLOCKWISE_CLAUDE_BIN;
    process.env.CLOCKWISE_CLAUDE_BIN = path.join(cartella, 'inesistente');
    try {
      const d = await diagnosi({ versione: '9.9.9', eseguibile: true, api: { configurata: false } });
      assert.equal(d.claudeCode.trovato, false);
      assert.ok(d.problemi.some((p) => /non è installato/.test(p)));
      const t = testoDiagnosi(d);
      assert.match(t, /DIAGNOSI DI CLOCKWISE 9\.9\.9 \(programma installato\)/);
      assert.match(t, /RETE/);
      assert.ok(!t.includes(os.homedir()) || os.homedir() === '/', 'la cartella dell’utente è anonimizzata');
    } finally { if (vecchio === undefined) delete process.env.CLOCKWISE_CLAUDE_BIN; else process.env.CLOCKWISE_CLAUDE_BIN = vecchio; }
  } finally { fs.rmSync(cartella, { recursive: true, force: true }); }
});
