// Ricerca di Claude Code sul computer.
// Il problema tipico su Windows: Claude Code viene installato DOPO l'accesso a Windows, l'installatore aggiunge
// la sua cartella al PATH dell'utente nel registro, ma i programmi aperti dal menu Start ereditano il PATH vecchio
// e il comando «claude» non si trova. Per questo non ci si affida solo al PATH del processo: si rilegge il PATH dal
// registro e si guardano le cartelle in cui gli installatori ufficiali mettono il programma.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const WIN = process.platform === 'win32';

// %VARIABILE% di Windows espanse con l'ambiente indicato.
const espandi = (s, env) => s.replace(/%([^%]+)%/g, (t, k) => { const v = Object.entries(env).find(([n]) => n.toLowerCase() === k.toLowerCase()); return v ? v[1] : t; });

/** PATH dell'utente e di sistema letti dal registro di Windows (quello che vede un programma appena avviato). */
export function pathDalRegistro(env = process.env, eseguiReg = (args) => spawnSync('reg', args, { encoding: 'utf8', windowsHide: true })) {
  if (!WIN && !env.CLOCKWISE_TEST_REGISTRO) return [];
  const leggi = (chiave) => {
    try {
      const r = eseguiReg(['query', chiave, '/v', 'Path']);
      const riga = (r.stdout || '').split(/\r?\n/).find((l) => /\sPath\s+REG_(EXPAND_)?SZ\s/i.test(l));
      return riga ? riga.replace(/^\s*Path\s+REG_(EXPAND_)?SZ\s+/i, '') : '';
    } catch { return ''; }
  };
  return [leggi('HKCU\\Environment'), leggi('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment')]
    .flatMap((p) => espandi(p, env).split(';')).map((x) => x.trim()).filter(Boolean);
}

// Sottocartelle che contengono una versione di Claude Code dentro una cartella (es. quella dell'app Claude desktop).
function versioniIn(cartella, nome) {
  try {
    return fs.readdirSync(cartella, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(cartella, d.name, nome))
      .filter((f) => fs.existsSync(f)).sort().reverse();
  } catch { return []; }
}

/**
 * Elenco ordinato e senza doppioni dei file in cui cercare Claude Code.
 * @returns {{ percorso: string, origine: string }[]}
 */
export function candidati({ env = process.env, piattaforma = process.platform, home = os.homedir(), registro = pathDalRegistro(env) } = {}) {
  const win = piattaforma === 'win32';
  const nomi = win ? ['claude.exe', 'claude.cmd', 'claude.bat'] : ['claude'];
  const sep = win ? ';' : ':';
  const unisci = win ? path.win32.join : path.posix.join;
  const out = [];
  const aggiungi = (percorso, origine) => { if (percorso && !out.some((c) => c.percorso.toLowerCase() === percorso.toLowerCase())) out.push({ percorso, origine }); };
  const cartella = (dir, origine) => { if (dir) for (const n of nomi) aggiungi(unisci(dir, n), origine); };

  const pathVar = Object.entries(env).find(([k]) => k.toLowerCase() === 'path')?.[1] || '';
  for (const d of pathVar.split(sep).filter(Boolean)) cartella(d, 'PATH del programma');
  for (const d of registro) cartella(d, 'PATH dal registro di Windows');
  if (win) {
    const profilo = env.USERPROFILE || home, appdata = env.APPDATA, locale = env.LOCALAPPDATA;
    cartella(unisci(profilo, '.local', 'bin'), 'installatore ufficiale di Claude Code');
    if (appdata) cartella(unisci(appdata, 'npm'), 'npm (installazione globale)');
    if (locale) cartella(unisci(locale, 'Microsoft', 'WinGet', 'Links'), 'WinGet');
    if (locale) cartella(unisci(locale, 'Programs', 'claude'), 'cartella dei programmi dell’utente');
    cartella(unisci(profilo, 'scoop', 'shims'), 'Scoop');
    cartella(unisci(profilo, '.claude', 'local'), 'installazione locale di Claude Code');
    if (env.NVM_SYMLINK) cartella(env.NVM_SYMLINK, 'nvm per Windows');
    if (env.ProgramFiles) cartella(unisci(env.ProgramFiles, 'nodejs'), 'Node.js');
    // Claude Code scaricato dall'app Claude desktop
    if (appdata) for (const f of versioniIn(unisci(appdata, 'Claude', 'claude-code'), 'claude.exe')) aggiungi(f, 'app Claude desktop');
  } else {
    cartella(unisci(home, '.local', 'bin'), 'installatore ufficiale di Claude Code');
    cartella(unisci(home, '.claude', 'local'), 'installazione locale di Claude Code');
    cartella('/opt/homebrew/bin', 'Homebrew');
    cartella('/usr/local/bin', 'sistema');
    cartella(unisci(home, '.npm-global', 'bin'), 'npm (installazione globale)');
    cartella(unisci(home, '.volta', 'bin'), 'Volta');
    if (piattaforma === 'darwin') for (const f of versioniIn(unisci(home, 'Library', 'Application Support', 'Claude', 'claude-code'), 'claude')) aggiungi(f, 'app Claude desktop');
  }
  return out;
}

/** Come avviare il file trovato: un .exe o un binario direttamente, un .cmd/.bat attraverso la shell di Windows. */
export const conShell = (percorso) => /\.(cmd|bat)$/i.test(percorso);

/** Avvia Claude Code con i parametri dati: per i .cmd passa dalla shell, con gli argomenti tra virgolette. */
export function avviaClaude(percorso, args, opzioni = {}) {
  if (!conShell(percorso)) return spawn(percorso, args, { windowsHide: true, ...opzioni });
  const virgolette = (a) => (a === '' ? '""' : /[\s"&|<>^()%!]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
  return spawn(`"${percorso}"`, args.map(virgolette), { windowsHide: true, ...opzioni, shell: true });
}

function prova(percorso, args, env, timeout = 15000) {
  return new Promise((ok) => {
    let out = '', err = '', finito = false;
    const fine = (v) => { if (!finito) { finito = true; ok(v); } };
    let figlio;
    try { figlio = avviaClaude(percorso, args, { env }); } catch (e) { return fine({ codice: -1, out: '', err: e.message }); }
    const timer = setTimeout(() => { try { figlio.kill(); } catch { /* già chiuso */ } fine({ codice: -1, out, err: `${err}\n(tempo scaduto)` }); }, timeout);
    figlio.stdin?.on('error', () => {});
    figlio.stdin?.end(); // nessun input: un comando che aspettasse stdin non resta appeso
    figlio.stdout?.on('data', (d) => { out += d; });
    figlio.stderr?.on('data', (d) => { err += d; });
    figlio.on('error', (e) => { clearTimeout(timer); fine({ codice: -1, out: '', err: e.message }); });
    figlio.on('close', (codice) => { clearTimeout(timer); fine({ codice, out, err }); });
  });
}

/**
 * Cerca Claude Code. Con CLOCKWISE_CLAUDE_BIN si usa solo quel file.
 * @returns {Promise<{ percorso: string|null, versione: string|null, origine: string|null, controllati: object[] }>}
 */
export async function trovaClaude(env = process.env) {
  const lista = env.CLOCKWISE_CLAUDE_BIN ? [{ percorso: env.CLOCKWISE_CLAUDE_BIN, origine: 'CLOCKWISE_CLAUDE_BIN' }] : candidati({ env });
  const controllati = [];
  for (const c of lista) {
    if (!fs.existsSync(c.percorso)) continue;
    const r = await prova(c.percorso, ['--version'], env);
    const versione = r.codice === 0 ? r.out.trim().split('\n')[0] : null;
    controllati.push({ ...c, esiste: true, funziona: !!versione, versione, errore: versione ? null : (r.err || r.out).trim().slice(0, 300) || `codice ${r.codice}` });
    if (versione) return { percorso: c.percorso, versione, origine: c.origine, controllati, cercati: lista.length };
  }
  return { percorso: null, versione: null, origine: null, controllati, cercati: lista.length };
}

/** Stato dell'accesso: `claude auth status --json`. */
export async function statoAccesso(percorso, env = process.env) {
  const r = await prova(percorso, ['auth', 'status', '--json'], env);
  try { const j = JSON.parse(r.out); return { loggato: !!j.loggedIn, metodo: j.authMethod || null, grezzo: null }; } catch { return { loggato: false, metodo: null, grezzo: (r.out || r.err).trim().slice(0, 300) }; }
}
