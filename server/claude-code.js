// Collegamento "Account Claude": usa Claude Code installato su questo computer, in modalità
// non interattiva (claude -p), con il login dell'abbonamento già fatto dall'utente.
import { spawn } from 'node:child_process';
import os from 'node:os';

const WIN = process.platform === 'win32';
const COMANDO = process.env.CLOCKWISE_CLAUDE_BIN || 'claude';

// Senza chiavi API nell'ambiente, Claude Code usa il login dell'account.
function ambiente() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

function esegui(args, { timeout = 15000 } = {}) {
  return new Promise((ok) => {
    let out = '', finito = false;
    const fine = (v) => { if (!finito) { finito = true; ok(v); } };
    let figlio;
    try { figlio = spawn(COMANDO, args, { env: ambiente(), shell: WIN, windowsHide: true }); } catch { return fine({ codice: -1, out: '' }); }
    const timer = setTimeout(() => { figlio.kill(); fine({ codice: -1, out }); }, timeout);
    figlio.stdout.on('data', (d) => { out += d; });
    figlio.on('error', () => { clearTimeout(timer); fine({ codice: -1, out: '' }); });
    figlio.on('close', (codice) => { clearTimeout(timer); fine({ codice, out }); });
  });
}

let cache = null;
export async function statoClaudeCode(forza = false) {
  if (cache && !forza && Date.now() - cache.quando < 30000) return cache.valore;
  const v = await esegui(['--version']);
  const valore = { installato: v.codice === 0, versione: v.codice === 0 ? v.out.trim().split('\n')[0] : null, loggato: false, pronto: false };
  if (valore.installato) {
    const s = await esegui(['auth', 'status', '--json']);
    try { const j = JSON.parse(s.out); valore.loggato = !!j.loggedIn; valore.metodo = j.authMethod || null; } catch { /* versione senza "auth status" */ }
    valore.pronto = valore.loggato;
  }
  cache = { quando: Date.now(), valore };
  return valore;
}

/**
 * Una chiamata a Claude tramite Claude Code. Tutto il contenuto viaggia su stdin
 * (nessun limite di lunghezza degli argomenti); nessuno strumento, nessuna personalizzazione.
 */
export function chiamaClaudeCode({ modello, impegno, system, documenti, compito, schema, onTesto, onPensiero, signal }) {
  return new Promise((ok, ko) => {
    const args = [
      '-p', '--safe-mode', '--strict-mcp-config', '--tools', WIN ? '""' : '',
      '--no-session-persistence', '--model', modello, '--effort', impegno || 'high',
      '--system-prompt', WIN ? '"Segui le istruzioni del messaggio."' : 'Segui con precisione le istruzioni contenute nel messaggio dell’utente.',
      '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    ];
    const strutturato = !!(schema && schema.type) && !WIN; // su Windows il JSON non passa pulito dalla shell
    if (strutturato) args.push('--json-schema', JSON.stringify(schema));
    let figlio;
    try { figlio = spawn(COMANDO, args, { env: ambiente(), cwd: os.tmpdir(), shell: WIN, windowsHide: true }); }
    catch (e) { return ko(Object.assign(new Error('Claude Code non è installato su questo computer.'), { codice: 'non_installato' })); }

    let buf = '', errOut = '', risultato = null, pensando = false, chiuso = false;
    const interrompi = () => { if (!chiuso) figlio.kill(); };
    signal?.addEventListener('abort', interrompi, { once: true });

    figlio.stdout.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const riga = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!riga) continue;
        let ev; try { ev = JSON.parse(riga); } catch { continue; }
        if (ev.type === 'stream_event') {
          const e = ev.event;
          if (e?.type === 'content_block_start' && e.content_block?.type === 'thinking' && !pensando) { pensando = true; onPensiero?.('Claude sta ragionando…\n'); }
          if (e?.type === 'content_block_delta') {
            if (e.delta?.type === 'text_delta' && e.delta.text) onTesto?.(e.delta.text);
            else if (e.delta?.type === 'thinking_delta' && e.delta.thinking) onPensiero?.(e.delta.thinking);
          }
        } else if (ev.type === 'result') risultato = ev;
      }
    });
    figlio.stderr.on('data', (d) => { errOut += d; });
    figlio.on('error', () => ko(Object.assign(new Error('Claude Code non è installato su questo computer (comando "claude" non trovato).'), { codice: 'non_installato' })));
    figlio.on('close', (codice) => {
      chiuso = true;
      signal?.removeEventListener('abort', interrompi);
      if (signal?.aborted) return ko(Object.assign(new Error('Valutazione interrotta.'), { codice: 'cancelled' }));
      if (!risultato) {
        const dettaglio = errOut.trim().split('\n').slice(-2).join(' ').slice(0, 300);
        const login = /log ?in|auth|credential/i.test(dettaglio);
        return ko(Object.assign(new Error(login ? 'Claude Code non è collegato a un account: apri un terminale, esegui "claude" e poi "/login".' : `Claude Code si è chiuso senza risposta (codice ${codice}). ${dettaglio}`), { codice: login ? 'login' : 'claude_code' }));
      }
      if (risultato.is_error || risultato.subtype !== 'success') {
        const testo = String(risultato.result || risultato.subtype || '');
        const limite = /limit|quota|usage/i.test(testo);
        return ko(Object.assign(new Error(limite ? `Limite di utilizzo dell'abbonamento Claude raggiunto. ${testo.slice(0, 200)}` : `Claude Code ha restituito un errore: ${testo.slice(0, 300)}`), { codice: limite ? 'limite' : 'claude_code' }));
      }
      const u = risultato.usage || {};
      ok({
        testo: typeof risultato.result === 'string' ? risultato.result : '',
        json: risultato.structured_output ?? undefined,
        modello: Object.keys(risultato.modelUsage || {})[0] || modello,
        troncato: risultato.stop_reason === 'max_tokens',
        uso: { ingresso: u.input_tokens || 0, uscita: u.output_tokens || 0, cacheLetta: u.cache_read_input_tokens || 0, cacheScritta: u.cache_creation_input_tokens || 0 },
      });
    });
    figlio.stdin.on('error', () => { /* processo chiuso prima di leggere tutto */ });
    figlio.stdin.end(`${system}\n\n${documenti}\n\n${compito}`);
  });
}
