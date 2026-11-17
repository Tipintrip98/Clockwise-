// Collegamento a Claude. Tre strade, stessa interfaccia:
//  - "app":          la pagina gira dentro l'app Claude (artifact) e usa l'account di chi la guarda
//  - "claude-code":  server locale → Claude Code installato sul computer (abbonamento Claude)
//  - "api":          server locale → API Anthropic con chiave propria
import { byteLen } from './docs.js';

export const MODELLI = [
  { id: 'claude-fable-5-2', nome: 'Claude Fable 5.2', nota: 'il più capace: consigliato per la valutazione' },
  { id: 'claude-opus-5-5', nome: 'Claude Opus 5.5', nota: 'ottimo, costa circa la metà' },
  { id: 'claude-sonnet-5-5', nome: 'Claude Sonnet 5.5', nota: 'veloce ed economico' },
  { id: 'claude-haiku-5-5', nome: 'Claude Haiku 5.5', nota: 'solo per prove rapide' },
];
export const IMPEGNI = [
  { id: 'high', nome: 'Approfondito' },
  { id: 'medium', nome: 'Bilanciato' },
  { id: 'low', nome: 'Rapido' },
];

export class ErroreLlm extends Error {
  constructor(codice, messaggio) { super(messaggio); this.codice = codice; }
}

// Estrae un valore JSON da una risposta testuale: intero testo, blocco ``` oppure dalla prima { all'ultima }.
export function estraiJson(testo) {
  if (testo == null) return undefined;
  const prove = [testo.trim()];
  const recinto = /```(?:json)?\s*([\s\S]*?)```/.exec(testo);
  if (recinto) prove.push(recinto[1].trim());
  const a = testo.search(/[{[]/), b = Math.max(testo.lastIndexOf('}'), testo.lastIndexOf(']'));
  if (a >= 0 && b > a) prove.push(testo.slice(a, b + 1));
  for (const p of prove) { try { return JSON.parse(p); } catch { /* prova la successiva */ } }
  return undefined;
}

const MESSAGGI_APP = {
  not_granted: 'Non hai autorizzato questa pagina a usare Claude. Ricarica la pagina e consenti l’uso per avviare la valutazione.',
  sampling_disabled: 'Claude non è disponibile per questo account o organizzazione.',
  rate_limited: 'Limite di utilizzo raggiunto. Attendi qualche minuto e riprova.',
  session_expired: 'Sessione scaduta: accedi di nuovo a Claude.',
  refused: 'Claude ha rifiutato questa richiesta.',
  prompt_too_large: 'Documenti troppo lunghi per una singola lettura.',
  empty_completion: 'Claude non ha prodotto una risposta. Riprova.',
  upstream_error: 'Errore temporaneo del servizio. Riprova.',
  cancelled: 'Valutazione interrotta.',
  images_unavailable: 'In questa vista Claude non può ricevere immagini: per leggere le scansioni usa il programma installato sul computer.',
  image_rejected: 'Claude non ha accettato una delle pagine (formato o dimensione).',
};

// Un'immagine { tipo, dati in base64 } come Blob, per l'app Claude.
function inBlob(im) {
  const bin = atob(im.dati);
  const byte = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) byte[i] = bin.charCodeAt(i);
  return new Blob([byte], { type: im.tipo });
}

function llmApp(sample, limiti) {
  return {
    tipo: 'app',
    etichetta: 'Account Claude (app)',
    limiteByte: Math.max(60000, (limiti?.maxPromptBytes || 262144) - 6000),
    paralleli: 2,
    // immagini: quante pagine scansionate può ricevere una lettura (null = questa vista non può inviarne)
    immagini: limiti?.images ? { max: Math.max(1, Math.min(limiti.images.maxCount || 1, 8)) } : null,
    async chiama({ system, documenti, compito, schema, modello, impegno, immagini, onTesto, signal }) {
      const input = `${system}\n\n${documenti}\n\n${compito}`;
      let ris;
      try {
        ris = await sample(input, {
          model: modello, modelTier: 'complex', effort: ['low', 'medium', 'high'].includes(impegno) ? impegno : 'high',
          cache: false, signal,
          ...(immagini?.length ? { images: immagini.map(inBlob) } : {}),
          onText: onTesto ? ({ text }) => onTesto(text) : undefined,
        });
      } catch (e) {
        throw new ErroreLlm(e?.code || 'upstream_error', MESSAGGI_APP[e?.code] || e?.message || 'Errore del servizio.');
      }
      const json = schema ? estraiJson(ris.text) : undefined;
      if (schema && json === undefined) throw new ErroreLlm('invalid_json', ris.truncated ? 'Risposta troncata prima della fine. Riprova con meno documenti.' : 'La risposta non era nel formato atteso. Riprova.');
      return { json, testo: ris.text, modello: ris.modelApplied || `livello ${ris.modelTierApplied}`, troncato: ris.truncated, uso: null };
    },
  };
}

// Legge una risposta Server-Sent Events da fetch().
async function* leggiSse(risposta) {
  const lettore = risposta.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await lettore.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const blocco = buf.slice(0, i); buf = buf.slice(i + 2);
      let evento = 'message', dati = '';
      for (const riga of blocco.split('\n')) {
        if (riga.startsWith('event:')) evento = riga.slice(6).trim();
        else if (riga.startsWith('data:')) dati += riga.slice(5).trim();
      }
      if (dati) { try { yield { evento, dati: JSON.parse(dati) }; } catch { /* riga incompleta */ } }
    }
  }
}

function llmServer(tipo) {
  return {
    tipo,
    etichetta: tipo === 'api' ? 'API Anthropic' : 'Account Claude (Claude Code)',
    limiteByte: 2400000,
    paralleli: tipo === 'api' ? 4 : 2,
    cacheCondivisa: tipo === 'api',
    immagini: { max: 8 },
    async chiama({ system, documenti, compito, schema, modello, impegno, immagini, onTesto, onPensiero, signal }) {
      let risposta;
      try {
        risposta = await fetch('api/llm', {
          method: 'POST', signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider: tipo, modello, impegno, system, documenti, compito, schema, ...(immagini?.length ? { immagini } : {}) }),
        });
      } catch (e) {
        if (e?.name === 'AbortError') throw new ErroreLlm('cancelled', MESSAGGI_APP.cancelled);
        throw new ErroreLlm('server', 'Il server locale di Clockwise non risponde. Controlla che sia ancora avviato.');
      }
      if (!risposta.ok) {
        const e = await risposta.json().catch(() => ({}));
        throw new ErroreLlm(e.codice || 'server', e.messaggio || `Errore del server (${risposta.status}).`);
      }
      let testo = '', pensiero = '', fine = null;
      try {
        for await (const { evento, dati } of leggiSse(risposta)) {
          if (evento === 'pensiero') { pensiero += dati.delta; onPensiero?.(pensiero); }
          else if (evento === 'testo') { testo += dati.delta; onTesto?.(testo); }
          else if (evento === 'fine') fine = dati;
          else if (evento === 'errore') throw new ErroreLlm(dati.codice || 'server', dati.messaggio || 'Errore durante la risposta.');
        }
      } catch (e) {
        if (e instanceof ErroreLlm) throw e;
        if (e?.name === 'AbortError') throw new ErroreLlm('cancelled', MESSAGGI_APP.cancelled);
        throw new ErroreLlm('server', 'Connessione con il server locale interrotta.');
      }
      if (!fine) throw new ErroreLlm('server', 'Risposta interrotta prima della fine.');
      const json = schema ? (fine.json ?? estraiJson(fine.testo || testo)) : undefined;
      if (schema && json === undefined) throw new ErroreLlm('invalid_json', 'La risposta non era nel formato atteso. Riprova.');
      return { json, testo: fine.testo || testo, modello: fine.modello, troncato: !!fine.troncato, uso: fine.uso || null, ripiego: fine.ripiego || null };
    },
  };
}

/**
 * Scopre come questa pagina può raggiungere Claude.
 * { ambiente: 'app'|'locale'|'nessuno', server, app }
 */
export async function rilevaAmbiente() {
  if (globalThis.claude?.use) {
    const sample = await globalThis.claude.use('sample').catch(() => null);
    if (sample) {
      const limiti = await sample.limits().catch(() => null);
      return { ambiente: 'app', app: { sample, limiti } };
    }
    return { ambiente: 'nessuno', motivo: 'app_non_disponibile' };
  }
  try {
    const r = await fetch('api/stato', { cache: 'no-store' });
    if (r.ok) return { ambiente: 'locale', server: await r.json() };
  } catch { /* nessun server locale */ }
  return { ambiente: 'nessuno', motivo: 'nessun_server' };
}

export function creaLlm(stato, scelta) {
  if (stato.ambiente === 'app') return llmApp(stato.app.sample, stato.app.limiti);
  if (stato.ambiente === 'locale') {
    const s = stato.server;
    const disponibili = [s.claudeCode?.pronto && 'claude-code', s.api?.configurata && 'api'].filter(Boolean);
    const tipo = disponibili.includes(scelta) ? scelta : disponibili[0];
    return tipo ? llmServer(tipo) : null;
  }
  return null;
}

export const stimaByte = (p) => byteLen(p.system) + byteLen(p.documenti) + byteLen(p.compito);
