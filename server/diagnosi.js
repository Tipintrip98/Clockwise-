// Diagnosi del collegamento a Claude su questo computer: che cosa c'è, dove è stato cercato Claude Code,
// che cosa risponde, se la rete raggiunge i servizi di Anthropic. Serve all'utente (e a chi lo assiste) per capire
// perché il collegamento non funziona. Il rapporto non contiene chiavi né contenuti dei dossier; la cartella
// dell'utente è sostituita da ~ così il rapporto si può incollare senza dati personali.
import fs from 'node:fs';
import os from 'node:os';
import https from 'node:https';
import path from 'node:path';
import { candidati, pathDalRegistro, trovaClaude, statoAccesso } from './claude-trova.js';

const anonimo = (t) => {
  let s = String(t ?? '');
  const home = os.homedir();
  if (home) s = s.split(home).join('~');
  const utente = os.userInfo?.().username;
  if (utente && utente.length > 2) s = s.replace(new RegExp(`\\b${utente.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '<utente>');
  return s;
};

function raggiungibile(url, timeout = 6000) {
  return new Promise((ok) => {
    const inizio = Date.now();
    const req = https.request(url, { method: 'HEAD', timeout }, (res) => { res.resume(); ok({ url, esito: `HTTP ${res.statusCode}`, ms: Date.now() - inizio, ok: res.statusCode < 500 }); });
    req.on('timeout', () => { req.destroy(); ok({ url, esito: 'tempo scaduto', ok: false }); });
    req.on('error', (e) => ok({ url, esito: e.code || e.message, ok: false }));
    req.end();
  });
}

/** Rapporto completo, come oggetto. `api` = { configurata, origine }. */
export async function diagnosi({ versione, eseguibile, api }) {
  const env = process.env;
  const win = process.platform === 'win32';
  const chiavePath = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  const t = await trovaClaude(env);
  const accesso = t.percorso ? await statoAccesso(t.percorso, env) : null;
  const lista = env.CLOCKWISE_CLAUDE_BIN ? [] : candidati({ env });
  const esistenti = lista.filter((c) => fs.existsSync(c.percorso));
  const cartelleDesktop = win
    ? [env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'AnthropicClaude'), env.APPDATA && path.join(env.APPDATA, 'Claude')]
    : [path.join(os.homedir(), 'Library', 'Application Support', 'Claude'), '/Applications/Claude.app'];
  const rete = await Promise.all(['https://api.anthropic.com/', 'https://claude.ai/', 'https://downloads.claude.ai/'].map((u) => raggiungibile(u)));
  const proxy = ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy', 'NO_PROXY'].filter((k) => env[k]);

  const problemi = [];
  if (!t.percorso) {
    if (esistenti.length) problemi.push('Claude Code è presente ma non risponde: vedi «Esito dei file trovati». Prova a reinstallarlo con il pulsante «Installa Claude Code».');
    else problemi.push('Claude Code non è installato su questo computer. Usa «Installa Claude Code», oppure collega una chiave API.');
  } else if (t.origine !== 'PATH del programma' && t.origine !== 'CLOCKWISE_CLAUDE_BIN') {
    problemi.push(`Claude Code è installato ma non è nel PATH con cui è partito Clockwise (trovato in: ${t.origine}). Ora Clockwise lo usa lo stesso; per gli altri programmi basta riavviare il computer.`);
  }
  if (t.percorso && accesso && !accesso.loggato) problemi.push('Claude Code è installato ma non è collegato a un account: usa «Accedi con il tuo account Claude».');
  if (rete.some((r) => r.url.includes('api.anthropic.com') && !r.ok)) problemi.push('Questo computer non raggiunge api.anthropic.com: controlla la connessione, il firewall o il proxy aziendale.');
  if (!t.percorso && !api.configurata && !problemi.length) problemi.push('Nessun collegamento a Claude configurato.');

  return {
    quando: new Date().toISOString(),
    programma: { versione, eseguibile: !!eseguibile },
    sistema: { piattaforma: `${process.platform} ${os.release()}`, architettura: process.arch, node: process.version, nome: win ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux' },
    claudeCode: {
      trovato: !!t.percorso, percorso: anonimo(t.percorso), versione: t.versione, origine: t.origine,
      accesso: accesso ? { collegato: accesso.loggato, metodo: accesso.metodo, risposta: accesso.grezzo ? anonimo(accesso.grezzo) : null } : null,
      cercatiIn: t.cercati, fileTrovati: t.controllati.map((c) => ({ percorso: anonimo(c.percorso), origine: c.origine, funziona: c.funziona, versione: c.versione, errore: c.errore ? anonimo(c.errore) : null })),
      variabile: env.CLOCKWISE_CLAUDE_BIN ? 'CLOCKWISE_CLAUDE_BIN impostata' : null,
    },
    appClaudeDesktop: cartelleDesktop.filter(Boolean).map((c) => ({ cartella: anonimo(c), presente: fs.existsSync(c) })),
    path: {
      programma: (env[chiavePath] || '').split(path.delimiter).filter(Boolean).map(anonimo),
      registro: win ? pathDalRegistro(env).map(anonimo) : [],
    },
    chiaveApi: { configurata: !!api.configurata, origine: api.origine || null },
    rete, proxy,
    problemi,
  };
}

/** Il rapporto come testo semplice, da copiare e incollare. */
export function testoDiagnosi(d) {
  const r = [];
  r.push(`DIAGNOSI DI CLOCKWISE ${d.programma.versione}${d.programma.eseguibile ? ' (programma installato)' : ''} — ${d.quando}`);
  r.push(`Sistema: ${d.sistema.nome} (${d.sistema.piattaforma}, ${d.sistema.architettura}), Node ${d.sistema.node}`);
  r.push('', 'PROBLEMI RILEVATI', ...(d.problemi.length ? d.problemi.map((p) => `- ${p}`) : ['- nessuno']));
  const c = d.claudeCode;
  r.push('', 'CLAUDE CODE', `Trovato: ${c.trovato ? `sì — ${c.percorso} (${c.versione}, da: ${c.origine})` : 'no'}`);
  if (c.accesso) r.push(`Accesso all'account: ${c.accesso.collegato ? `sì (${c.accesso.metodo || 'metodo non indicato'})` : 'no'}${c.accesso.risposta ? ` — risposta: ${c.accesso.risposta}` : ''}`);
  r.push(`Posizioni controllate: ${c.cercatiIn}`);
  for (const f of c.fileTrovati) r.push(`- ${f.percorso} [${f.origine}]: ${f.funziona ? `funziona (${f.versione})` : `non risponde — ${f.errore}`}`);
  if (c.variabile) r.push(c.variabile);
  r.push('', 'APP CLAUDE DESKTOP', ...d.appClaudeDesktop.map((a) => `- ${a.cartella}: ${a.presente ? 'presente' : 'assente'}`));
  r.push('', `CHIAVE API: ${d.chiaveApi.configurata ? `configurata (${d.chiaveApi.origine})` : 'non configurata'}`);
  r.push('', 'RETE', ...d.rete.map((x) => `- ${x.url}: ${x.esito}${x.ms != null ? ` in ${x.ms} ms` : ''}`), `Proxy: ${d.proxy.length ? d.proxy.join(', ') : 'nessuno'}`);
  r.push('', 'PATH DEL PROGRAMMA', ...d.path.programma.map((p) => `- ${p}`));
  if (d.path.registro.length) r.push('', 'PATH NEL REGISTRO DI WINDOWS', ...d.path.registro.map((p) => `- ${p}`));
  return r.join('\n');
}
