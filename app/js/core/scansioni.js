// Lettura delle scansioni: Claude guarda le pagine come immagini e ne trascrive il testo.
// Serve per i documenti firmati e scansionati (contratti, lettere, curriculum) che non hanno testo selezionabile.
import { ErroreLlm } from './llm.js';
import { tipoPerId } from './docs.js';

export const AVVISO_TRASCRIZIONE = 'Testo ricavato dalla lettura delle immagini da parte di Claude: controlla importi, date e firme sull’originale.';

/**
 * Trascrive un documento scansionato. immagini: [{ tipo, dati }] una per pagina.
 * Le pagine si leggono a gruppi (quante ne accetta il collegamento); onEvento({ fatte, totale }) segnala l'avanzamento.
 * Restituisce { testo, pagine, modello }.
 */
export async function trascriviScansione({ nome, tipo, immagini, llm, opzioni, signal, onEvento = () => {} }) {
  if (!llm?.immagini) throw new ErroreLlm('images_unavailable', 'Con questo collegamento Claude non può ricevere immagini: per leggere le scansioni usa il programma installato sul computer.');
  if (tipo === 'identita') throw new ErroreLlm('rifiutato', 'I documenti d’identità non vengono inviati a Claude.');
  if (!immagini?.length) throw new ErroreLlm('nessun_documento', 'Nessuna pagina da leggere.');
  const perVolta = Math.max(1, llm.immagini.max || 1);
  const parti = [];
  let modello = null;
  onEvento({ fatte: 0, totale: immagini.length });
  for (let i = 0; i < immagini.length; i += perVolta) {
    if (signal?.aborted) throw new ErroreLlm('cancelled', 'Lettura interrotta.');
    const gruppo = immagini.slice(i, i + perVolta);
    const da = i + 1, a = i + gruppo.length;
    const r = await llm.chiama({
      system: 'Trascrivi documenti scansionati per una società di produzione cinematografica che deve verificarli prima di allegarli a una domanda di contributo pubblico. La trascrizione sostituisce la lettura dell’originale: deve essere fedele e completa, senza riassunti né commenti.',
      documenti: `Documento: «${nome}» (${tipoPerId(tipo).nome}). In allegato ${gruppo.length === 1 ? `l'immagine della pagina ${da}` : `le immagini delle pagine da ${da} a ${a}`} di ${immagini.length}, nell'ordine.`,
      compito: `Trascrivi tutto il testo leggibile, pagina per pagina e nell'ordine di lettura.
- Comincia ogni pagina con una riga «[pagina N]», con N da ${da} a ${a}.
- Riporta nomi, ragioni sociali, importi, percentuali, date e numeri di protocollo esattamente come sono scritti.
- Le tabelle vanno riga per riga, con le celle separate da « | ».
- Ciò che non è testo va descritto tra parentesi quadre nel punto in cui si trova: [firma autografa di …], [firma autografa non leggibile], [timbro …], [firma digitale], [sigla a margine], [logo …], [fotografia]. Per un contratto conta sapere se le firme di tutte le parti ci sono.
- Se una parola non si legge scrivi [illeggibile]; non completarla a intuito. Se la pagina è bianca scrivi [pagina bianca].
Rispondi soltanto con la trascrizione.`,
      schema: null, immagini: gruppo, modello: opzioni.modello, impegno: opzioni.impegno || 'low', signal,
    });
    modello = r.modello || modello;
    parti.push(String(r.testo || '').trim());
    onEvento({ fatte: a, totale: immagini.length });
  }
  const testo = parti.filter(Boolean).join('\n\n').trim();
  if (testo.replace(/\[[^\]]*\]/g, '').replace(/\s/g, '').length < 20) throw new ErroreLlm('empty_completion', 'Nelle pagine non è stato trovato testo leggibile.');
  return { testo, pagine: immagini.length, modello };
}
