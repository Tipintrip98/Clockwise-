// Collegamento "Chiave API": chiamate all'API Anthropic con l'SDK ufficiale, in streaming.
import Anthropic from '@anthropic-ai/sdk';

// Modelli per cui l'API offre il ripiego automatico lato server quando una richiesta viene declinata.
const CON_RIPIEGO = new Set(['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5']);

export function creaClient(chiave) {
  return chiave ? new Anthropic({ apiKey: chiave }) : new Anthropic();
}

// Verifica gratuita della chiave: elenco dei modelli, nessun token consumato.
export async function verificaChiave(chiave) {
  const client = creaClient(chiave);
  await client.models.list({ limit: 1 });
}

export function messaggioErrore(e) {
  if (e instanceof Anthropic.AuthenticationError) return { codice: 'chiave', messaggio: 'Chiave API non valida o revocata. Controllala nella console Anthropic.' };
  if (e instanceof Anthropic.PermissionDeniedError) return { codice: 'permesso', messaggio: 'La chiave API non ha accesso a questo modello.' };
  if (e instanceof Anthropic.NotFoundError) return { codice: 'modello', messaggio: 'Modello non disponibile per questo account. Scegline un altro.' };
  if (e instanceof Anthropic.RateLimitError) return { codice: 'limite', messaggio: 'Limite di richieste dell’API raggiunto. Attendi un minuto e riprova.' };
  if (e instanceof Anthropic.BadRequestError) return { codice: 'richiesta', messaggio: `L’API ha rifiutato la richiesta: ${e.message}` };
  if (e instanceof Anthropic.APIConnectionError) return { codice: 'rete', messaggio: 'Impossibile raggiungere l’API Anthropic. Controlla la connessione a internet.' };
  if (e instanceof Anthropic.APIError) return { codice: 'servizio', messaggio: `Errore del servizio Anthropic (${e.status ?? '—'}). Riprova tra poco.` };
  return { codice: 'errore', messaggio: e?.message || 'Errore sconosciuto.' };
}

/**
 * Una chiamata a Claude. I documenti sono il prefisso in cache: i commissari successivi
 * della stessa sezione rileggono lo stesso blocco a costo ridotto.
 */
export async function chiamaApi({ client, modello, impegno, system, documenti, compito, schema, onPensiero, onTesto, signal }) {
  const strutturato = !!(schema && schema.type);
  const parametri = (conFormato) => ({
    model: modello,
    max_tokens: 32000,
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: impegno || 'high', ...(conFormato ? { format: { type: 'json_schema', schema } } : {}) },
    system,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: documenti, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: compito },
      ],
    }],
  });
  // Dal più completo al più semplice: se l'API rifiuta un'opzione (400) si riprova senza.
  const tentativi = [];
  if (CON_RIPIEGO.has(modello)) tentativi.push({ ripiego: true, formato: strutturato });
  tentativi.push({ ripiego: false, formato: strutturato });
  if (strutturato) tentativi.push({ ripiego: false, formato: false });

  let ultimo = null;
  for (const t of tentativi) {
    try {
      const p = parametri(t.formato);
      const stream = t.ripiego
        ? client.beta.messages.stream({ ...p, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal })
        : client.messages.stream(p, { signal });
      for await (const ev of stream) {
        if (ev.type !== 'content_block_delta') continue;
        if (ev.delta.type === 'thinking_delta' && ev.delta.thinking) onPensiero?.(ev.delta.thinking);
        else if (ev.delta.type === 'text_delta' && ev.delta.text) onTesto?.(ev.delta.text);
      }
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') {
        const err = new Error(`Claude ha declinato la richiesta${msg.stop_details?.category ? ` (categoria: ${msg.stop_details.category})` : ''}.`);
        err.codice = 'rifiuto';
        throw err;
      }
      const testo = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      let json;
      if (strutturato) { try { json = JSON.parse(testo); } catch { json = undefined; } }
      return {
        testo, json, modello: msg.model, troncato: msg.stop_reason === 'max_tokens',
        uso: {
          ingresso: msg.usage?.input_tokens || 0, uscita: msg.usage?.output_tokens || 0,
          cacheLetta: msg.usage?.cache_read_input_tokens || 0, cacheScritta: msg.usage?.cache_creation_input_tokens || 0,
        },
      };
    } catch (e) {
      ultimo = e;
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
    }
  }
  throw ultimo;
}
