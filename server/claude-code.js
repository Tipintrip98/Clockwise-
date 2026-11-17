// Collegamento "Account Claude": usa Claude Code installato su questo computer, in modalità
// non interattiva (claude -p), con il login dell'abbonamento già fatto dall'utente.
// Claude Code si cerca anche fuori dal PATH del programma (vedi claude-trova.js); da qui si possono
// anche avviare l'installatore ufficiale e l'accesso all'account.
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { trovaClaude, statoAccesso, avviaClaude, conShell } from './claude-trova.js';

const WIN = process.platform === 'win32';

// Senza chiavi API nell'ambiente, Claude Code usa il login dell'account. La cartella di Claude Code va nel PATH.
function ambiente(percorso) {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  if (percorso) {
    const chiave = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
    env[chiave] = [path.dirname(percorso), env[chiave] || ''].filter(Boolean).join(path.delimiter);
  }
  return env;
}

/**
 * Ambiente per l'installatore ufficiale. Su Windows l'installatore gira in Windows PowerShell 5.1: se Clockwise è stato
 * avviato da PowerShell 7 eredita un PSModulePath che punta ai moduli della 7 e i comandi di base (Get-FileHash)
 * non si trovano più. Senza la variabile, PowerShell 5.1 usa i suoi percorsi predefiniti.
 */
export function ambienteInstallatore(env = ambiente()) {
  const pulito = { ...env };
  for (const k of Object.keys(pulito)) if (k.toLowerCase() === 'psmodulepath') delete pulito[k];
  return pulito;
}

let cache = null, ricerca = null;
export async function statoClaudeCode(forza = false) {
  if (cache && !forza && Date.now() - cache.quando < 30000) return cache.valore;
  const t = await trovaClaude(ambiente());
  const valore = { installato: !!t.percorso, versione: t.versione, percorso: t.percorso, origine: t.origine, loggato: false, pronto: false };
  if (t.percorso) {
    const a = await statoAccesso(t.percorso, ambiente(t.percorso));
    valore.loggato = a.loggato; valore.metodo = a.metodo;
    valore.pronto = a.loggato;
  }
  ricerca = t;
  cache = { quando: Date.now(), valore };
  return valore;
}
export const ultimaRicerca = () => ricerca;
const percorsoClaude = async () => (await statoClaudeCode()).percorso;

/** Installa Claude Code con l'installatore ufficiale di Anthropic (richiede la rete). */
export function installaClaudeCode({ timeout = 10 * 60 * 1000 } = {}) {
  return new Promise((ok) => {
    const [cmd, args] = WIN
      ? ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://claude.ai/install.ps1 | iex']]
      : ['bash', ['-c', 'curl -fsSL https://claude.ai/install.sh | bash']];
    let out = '';
    let figlio;
    try { figlio = spawn(cmd, args, { env: ambienteInstallatore(), windowsHide: true }); } catch (e) { return ok({ ok: false, uscita: e.message }); }
    const timer = setTimeout(() => { figlio.kill(); out += '\n(tempo scaduto)'; }, timeout);
    figlio.stdout.on('data', (d) => { out += d; });
    figlio.stderr.on('data', (d) => { out += d; });
    figlio.on('error', (e) => { clearTimeout(timer); ok({ ok: false, uscita: `${out}\n${e.message}`.trim().slice(-3000) }); });
    figlio.on('close', async (codice) => {
      clearTimeout(timer);
      const stato = await statoClaudeCode(true);
      ok({ ok: codice === 0 && stato.installato, codice, uscita: out.trim().slice(-3000), stato });
    });
  });
}

/**
 * Avvia l'accesso all'account Claude (`claude auth login`): si apre il browser sulla pagina di accesso.
 * Su Windows in una finestra a parte, così l'eventuale codice da incollare si vede.
 */
export async function avviaAccesso() {
  const percorso = await percorsoClaude();
  if (!percorso) return { ok: false, messaggio: 'Claude Code non è installato su questo computer.' };
  try {
    if (WIN) {
      spawn('cmd.exe', ['/d', '/c', 'start', '"Accesso a Claude"', `"${percorso}"`, 'auth', 'login'], { env: ambiente(percorso), detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
    } else if (process.platform === 'darwin') {
      spawn('osascript', ['-e', `tell application "Terminal" to do script "'${percorso.replace(/'/g, "'\\''")}' auth login"`, '-e', 'tell application "Terminal" to activate'], { detached: true, stdio: 'ignore' }).unref();
    } else {
      const figlio = avviaClaude(percorso, ['auth', 'login'], { env: ambiente(percorso), detached: true, stdio: 'ignore' });
      figlio.unref();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, messaggio: e.message };
  }
}

/**
 * Che cosa è andato storto in una chiamata, dal testo dell'errore di Claude Code e dallo stato HTTP dell'API.
 * I codici guidano l'interfaccia: 'modello' fa scattare il ripiego su un altro modello, 'login' porta al pulsante «Accedi».
 */
export function classificaErrore({ testo = '', stato = null, codiceUscita = null } = {}) {
  const t = String(testo).replace(/\s+/g, ' ').trim();
  const breve = t.slice(0, 300);
  if (stato === 404 || /unrecognized_model|selected model|may not exist|not have access to (it|this model)|model.{0,40}(not (found|available|supported)|unavailable)|invalid model/i.test(t)) {
    return { codice: 'modello', messaggio: 'Il modello scelto non è disponibile per questo account.' };
  }
  if (stato === 401 || stato === 403 || /not logged in|log ?in|\/login|authenticat|unauthori[sz]ed|oauth|credential|invalid api key/i.test(t)) {
    return { codice: 'login', messaggio: 'Claude Code non è collegato a un account: apri «Collegamento» e premi «Accedi».' };
  }
  if (stato === 429 || /rate.?limit|usage limit|limit reached|quota|too many requests/i.test(t)) {
    return { codice: 'limite', messaggio: `Limite di utilizzo dell'abbonamento Claude raggiunto: riprova più tardi. ${breve.slice(0, 200)}`.trim() };
  }
  if (stato === 529 || (stato >= 500 && stato < 600) || /overloaded|temporarily unavailable|service unavailable/i.test(t)) {
    return { codice: 'sovraccarico', messaggio: 'I server di Claude sono momentaneamente sovraccarichi: riprova tra qualche minuto.' };
  }
  if (/ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network|fetch failed|certificate|proxy|unable to connect/i.test(t)) {
    return { codice: 'rete', messaggio: 'Claude Code non raggiunge i server di Anthropic: controlla la connessione, il firewall o il proxy.' };
  }
  return { codice: 'claude_code', messaggio: `Claude Code ha restituito un errore${codiceUscita != null ? ` (codice ${codiceUscita})` : ''}: ${breve || 'nessun dettaglio'}` };
}

// Dal modello più capace al più leggero: se quello scelto non è disponibile per l'account si scende di un gradino.
export const SCALA_MODELLI = ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
export function modelliDaProvare(modello) {
  const i = SCALA_MODELLI.indexOf(modello);
  return i < 0 ? [modello, ...SCALA_MODELLI.slice(1)] : SCALA_MODELLI.slice(i);
}

/**
 * Chiamata a Claude tramite Claude Code, con ripiego: se il modello scelto non è disponibile per l'account
 * (capita con alcuni abbonamenti) si riprova con il modello successivo della scala. Il risultato dice quale
 * modello ha risposto e, se diverso da quello chiesto, lo segnala in `ripiego`.
 */
export async function chiamaClaudeCode(parametri, { chiama = unaChiamata } = {}) {
  const provati = [];
  let ultimo = null;
  for (const modello of modelliDaProvare(parametri.modello)) {
    try {
      const r = await chiama({ ...parametri, modello });
      return modello === parametri.modello ? r : { ...r, ripiego: { richiesto: parametri.modello, usato: r.modello || modello, scartati: provati } };
    } catch (e) {
      if (e?.codice !== 'modello' || parametri.signal?.aborted) throw e;
      provati.push(modello); ultimo = e;
    }
  }
  throw Object.assign(new Error('Nessun modello di Claude è disponibile per questo account con Claude Code. Controlla l’abbonamento (serve almeno Claude Pro) oppure usa una chiave API.'), { codice: 'modello', causa: ultimo?.message });
}

/** Prova reale del collegamento: una richiesta minima a Claude, per sapere se tutto il percorso funziona davvero. */
export async function provaClaudeCode({ modello = SCALA_MODELLI[0], timeout = 120000 } = {}, opzioni) {
  const inizio = Date.now();
  const controllo = new AbortController();
  const timer = setTimeout(() => controllo.abort(), timeout);
  try {
    const r = await chiamaClaudeCode({ modello, impegno: 'low', system: 'Prova di collegamento di Clockwise.', documenti: '(nessun documento)', compito: 'Rispondi soltanto con la parola: OK', signal: controllo.signal }, opzioni);
    return { ok: true, richiesto: modello, modello: r.modello || modello, ripiego: r.ripiego || null, ms: Date.now() - inizio, risposta: String(r.testo || '').trim().slice(0, 80) };
  } catch (e) {
    const scaduto = controllo.signal.aborted;
    return { ok: false, richiesto: modello, ms: Date.now() - inizio, codice: scaduto ? 'tempo' : (e?.codice || 'claude_code'), messaggio: scaduto ? 'Claude non ha risposto entro due minuti: controlla la connessione e riprova.' : (e?.message || 'Errore sconosciuto.') };
  } finally { clearTimeout(timer); }
}

/**
 * Una chiamata a Claude tramite Claude Code. Tutto il contenuto viaggia su stdin
 * (nessun limite di lunghezza degli argomenti); nessuno strumento, nessuna personalizzazione.
 */
function unaChiamata({ modello, impegno, system, documenti, compito, schema, immagini, onTesto, onPensiero, signal }) {
  return new Promise((ok, ko) => {
  percorsoClaude().then((percorso) => {
    if (!percorso) return ko(Object.assign(new Error('Claude Code non è installato su questo computer.'), { codice: 'non_installato' }));
    // Un .exe si avvia direttamente e riceve gli argomenti così come sono; un .cmd passa dalla shell di Windows.
    const shell = conShell(percorso);
    const args = [
      '-p', '--safe-mode', '--strict-mcp-config', '--tools', '',
      '--no-session-persistence', '--model', modello, '--effort', impegno || 'high',
      '--system-prompt', shell ? 'Segui le istruzioni del messaggio.' : 'Segui con precisione le istruzioni contenute nel messaggio dell’utente.',
      '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    ];
    const strutturato = !!(schema && schema.type) && !shell; // attraverso la shell di Windows il JSON non passa pulito
    if (strutturato) args.push('--json-schema', JSON.stringify(schema));
    // Con le immagini il messaggio non è più testo semplice: viaggia su stdin come riga JSON.
    const conImmagini = Array.isArray(immagini) && immagini.length > 0;
    if (conImmagini) args.push('--input-format', 'stream-json');
    let figlio;
    try { figlio = avviaClaude(percorso, args, { env: ambiente(percorso), cwd: os.tmpdir() }); }
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
        const e = classificaErrore({ testo: `${errOut}`, codiceUscita: codice });
        return ko(Object.assign(new Error(e.codice === 'claude_code' ? `Claude Code si è chiuso senza risposta (codice ${codice}). ${dettaglio}` : e.messaggio), { codice: e.codice }));
      }
      if (risultato.is_error || risultato.subtype !== 'success') {
        const e = classificaErrore({ testo: `${risultato.result || risultato.subtype || ''} ${errOut}`, stato: risultato.api_error_status });
        return ko(Object.assign(new Error(e.messaggio), { codice: e.codice }));
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
    const testo = `${system}\n\n${documenti}\n\n${compito}`;
    if (!conImmagini) figlio.stdin.end(testo);
    else {
      const contenuto = [...immagini.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.tipo, data: im.dati } })), { type: 'text', text: testo }];
      figlio.stdin.end(`${JSON.stringify({ type: 'user', message: { role: 'user', content: contenuto } })}\n`);
    }
  }, ko);
  });
}
