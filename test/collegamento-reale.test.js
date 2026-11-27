// Ripiego di modello, classificazione degli errori e prova reale del collegamento (senza rete: la chiamata è simulata).
import test from 'node:test';
import assert from 'node:assert/strict';
import { classificaErrore, modelliDaProvare, chiamaClaudeCode, provaClaudeCode, SCALA_MODELLI, ambienteInstallatore } from '../server/claude-code.js';
import { testoDiagnosi } from '../server/diagnosi.js';

const errore = (codice, messaggio = codice) => Object.assign(new Error(messaggio), { codice });

test('errori di Claude Code: modello, accesso, limite, sovraccarico, rete', () => {
  // testo reale di Claude Code per un modello non disponibile (stato 404)
  assert.equal(classificaErrore({ testo: "There's an issue with the selected model (claude-x). It may not exist or you may not have access to it.", stato: 404 }).codice, 'modello');
  assert.equal(classificaErrore({ testo: '[claude-code:unrecognized_model] {"model":"claude-x"}', codiceUscita: 1 }).codice, 'modello');
  assert.equal(classificaErrore({ testo: 'Not logged in · Please run /login' }).codice, 'login');
  assert.equal(classificaErrore({ testo: 'Invalid API key · Fix external API key', stato: 401 }).codice, 'login');
  assert.equal(classificaErrore({ testo: 'Claude usage limit reached. Your limit will reset at 3pm.' }).codice, 'limite');
  assert.equal(classificaErrore({ testo: 'API Error', stato: 429 }).codice, 'limite');
  assert.equal(classificaErrore({ testo: 'Overloaded', stato: 529 }).codice, 'sovraccarico');
  assert.equal(classificaErrore({ testo: 'API Error: fetch failed ENOTFOUND api.anthropic.com' }).codice, 'rete');
  const altro = classificaErrore({ testo: 'qualcosa di imprevisto', codiceUscita: 3 });
  assert.equal(altro.codice, 'claude_code');
  assert.match(altro.messaggio, /codice 3/);
  // il messaggio di accesso porta al pulsante, non al terminale
  assert.match(classificaErrore({ testo: 'Not logged in' }).messaggio, /Accedi/);
});

test('scala dei modelli: si scende, non si sale', () => {
  assert.deepEqual(modelliDaProvare('claude-fable-5-2'), SCALA_MODELLI);
  assert.deepEqual(modelliDaProvare('claude-sonnet-5-5'), ['claude-sonnet-5-5', 'claude-haiku-5-5']);
  assert.deepEqual(modelliDaProvare('claude-haiku-5-5'), ['claude-haiku-5-5']);
  assert.equal(modelliDaProvare('claude-altro-1')[0], 'claude-altro-1');
});

test('modello non disponibile: Clockwise ripiega sul successivo e lo dice', async () => {
  const chiesti = [];
  const chiama = async (p) => { chiesti.push(p.modello); if (p.modello !== 'claude-sonnet-5-5') throw errore('modello'); return { testo: 'OK', modello: p.modello, uso: {} }; };
  const r = await chiamaClaudeCode({ modello: 'claude-fable-5-2', system: 's', documenti: 'd', compito: 'c' }, { chiama });
  assert.deepEqual(chiesti, ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5']);
  assert.equal(r.modello, 'claude-sonnet-5-5');
  assert.deepEqual(r.ripiego, { richiesto: 'claude-fable-5-2', usato: 'claude-sonnet-5-5', scartati: ['claude-fable-5-2', 'claude-opus-5-5'] });
});

test('modello disponibile: nessun ripiego; altri errori non fanno cambiare modello', async () => {
  const r = await chiamaClaudeCode({ modello: 'claude-opus-5-5' }, { chiama: async (p) => ({ testo: 'OK', modello: p.modello }) });
  assert.equal(r.ripiego, undefined);
  let chiamate = 0;
  await assert.rejects(chiamaClaudeCode({ modello: 'claude-fable-5-2' }, { chiama: async () => { chiamate++; throw errore('login', 'non collegato'); } }), /non collegato/);
  assert.equal(chiamate, 1);
  await assert.rejects(chiamaClaudeCode({ modello: 'claude-fable-5-2' }, { chiama: async () => { throw errore('modello'); } }), (e) => e.codice === 'modello' && /Nessun modello/.test(e.message));
});

test('prova del collegamento: esito leggibile in tutti i casi', async () => {
  const ok = await provaClaudeCode({ modello: 'claude-fable-5-2' }, { chiama: async (p) => ({ testo: ' OK \n', modello: p.modello }) });
  assert.equal(ok.ok, true); assert.equal(ok.risposta, 'OK'); assert.equal(ok.ripiego, null); assert.ok(ok.ms >= 0);
  const rip = await provaClaudeCode({ modello: 'claude-fable-5-2' }, { chiama: async (p) => { if (p.modello === 'claude-fable-5-2') throw errore('modello'); return { testo: 'OK', modello: p.modello }; } });
  assert.equal(rip.ok, true); assert.equal(rip.modello, 'claude-opus-5-5'); assert.equal(rip.ripiego.richiesto, 'claude-fable-5-2');
  const no = await provaClaudeCode({ modello: 'claude-fable-5-2' }, { chiama: async () => { throw errore('login', 'Claude Code non è collegato a un account: apri «Collegamento» e premi «Accedi».'); } });
  assert.equal(no.ok, false); assert.equal(no.codice, 'login'); assert.match(no.messaggio, /Accedi/);
  // la prova manda una richiesta minima, a basso impegno
  let visto = null;
  await provaClaudeCode({ modello: 'claude-haiku-5-5' }, { chiama: async (p) => { visto = p; return { testo: 'OK', modello: p.modello }; } });
  assert.equal(visto.impegno, 'low'); assert.match(visto.compito, /OK/);
});

test('rapporto di diagnosi: riporta la richiesta reale di prova', () => {
  const base = { quando: '2026-11-17T10:00:00Z', programma: { versione: '2.0.3', eseguibile: true }, sistema: { nome: 'Windows', piattaforma: 'win32 10.0', architettura: 'x64', node: 'v22' }, problemi: [],
    claudeCode: { trovato: true, percorso: '~\\.local\\bin\\claude.exe', versione: '2.1.326', origine: 'installatore ufficiale di Claude Code', accesso: { collegato: true, metodo: 'claude.ai' }, cercatiIn: 20, fileTrovati: [] },
    appClaudeDesktop: [], path: { programma: [], registro: [] }, chiaveApi: { configurata: false }, rete: [], proxy: [] };
  assert.match(testoDiagnosi({ ...base, provaReale: { ok: true, ms: 6100, modello: 'claude-opus-5-5', richiesto: 'claude-fable-5-2', ripiego: { richiesto: 'claude-fable-5-2' } } }), /Richiesta reale di prova: riuscita in 6,?\.?1 s con claude-opus-5-5 \(claude-fable-5-2 non disponibile/);
  assert.match(testoDiagnosi({ ...base, provaReale: { ok: false, codice: 'rete', messaggio: 'Claude Code non raggiunge i server' } }), /NON riuscita \[rete\]/);
  assert.match(testoDiagnosi({ ...base, provaReale: null }), /Richiesta reale di prova: non eseguita/);
});

test('installatore di Claude Code: non eredita il PSModulePath di PowerShell 7 (trovato sulle prove reali su Windows)', () => {
  const env = ambienteInstallatore({ Path: 'C:\\Windows', PSModulePath: 'C:\\Program Files\\PowerShell\\7\\Modules', psmodulepath: 'x', USERPROFILE: 'C:\\Users\\a' });
  assert.deepEqual(Object.keys(env).sort(), ['Path', 'USERPROFILE']);
});

test('limite di un solo modello (caso reale «You’ve hit your Fable limit»): si passa al modello successivo', async () => {
  // testo reale restituito da Claude Code il 27/11/2026
  const reale = "You've hit your Fable limit · resets Dec 1, 3am (UTC). Switch to another model to continue.";
  assert.equal(classificaErrore({ testo: reale }).codice, 'limite_modello');
  assert.equal(classificaErrore({ testo: 'Claude usage limit reached. Your limit will reset at 3pm.' }).codice, 'limite', 'il limite generale dell’abbonamento resta un limite');
  const chiesti = [];
  const r = await chiamaClaudeCode({ modello: 'claude-fable-5-2' }, { chiama: async (p) => { chiesti.push(p.modello); if (p.modello === 'claude-fable-5-2') throw errore('limite_modello', reale); return { testo: 'OK', modello: p.modello }; } });
  assert.deepEqual(chiesti, ['claude-fable-5-2', 'claude-opus-5-5']);
  assert.equal(r.ripiego.usato, 'claude-opus-5-5');
  // tutti i modelli al limite: errore di limite, non «modello non disponibile»
  await assert.rejects(chiamaClaudeCode({ modello: 'claude-fable-5-2' }, { chiama: async () => { throw errore('limite_modello', reale); } }), (e) => e.codice === 'limite' && /tutti i modelli/.test(e.message));
});
