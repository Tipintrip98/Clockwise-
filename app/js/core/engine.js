// Orchestrazione della valutazione: commissari simulati per sezione, verifica formale, aggregazione.
import { getGriglia } from './scoring.js';
import { documentiPerSezione, byteLen } from './docs.js';
import { PROFILI, promptSezione, promptVerifica, promptEstrazione, promptCondensa, promptBando, normalizzaBando } from './prompts.js';
import { stimaByte, ErroreLlm } from './llm.js';

const UNICO = { id: 'unico', nome: 'Commissario', descrizione: 'esperto con competenze trasversali su scrittura, produzione e politiche territoriali, abituato a valutare istanze per fondi regionali.' };

export function sceltaCommissari(n) {
  if (n <= 1) return [UNICO];
  if (n >= 5) return PROFILI.slice(0, 5);
  return PROFILI.slice(0, 3);
}

export const sezioniConGiudizio = (griglia) => griglia.sezioni.filter((s) => s.criteri.some((c) => c.tipo !== 'fasce' || c.giudizio));

// Elenco dei passi che la valutazione eseguirà, per mostrare l'avanzamento prima di partire.
export function pianoValutazione(bando, progetto, nCommissari) {
  const griglia = getGriglia(bando, progetto.categoriaId);
  const commissari = sceltaCommissari(nCommissari);
  const passi = [], saltate = [];
  for (const sez of sezioniConGiudizio(griglia)) {
    const docs = documentiPerSezione(progetto.documenti, sez);
    if (!docs.length) { saltate.push(sez); continue; }
    for (const c of commissari) passi.push({ id: `${sez.id}:${c.id}`, tipo: 'sezione', sezione: sez.id, commissario: c, etichetta: `Sezione ${sez.id} · ${c.nome}` });
  }
  if (documentiPerSezione(progetto.documenti, 'V').length) passi.push({ id: 'verifica', tipo: 'verifica', etichetta: 'Verifica formale del dossier' });
  return { passi, saltate, commissari };
}

function semaforo(n) {
  let liberi = n; const coda = [];
  return async (fn) => {
    if (liberi > 0) liberi--; else await new Promise((ok) => coda.push(ok));
    try { return await fn(); } finally { const prossimo = coda.shift(); if (prossimo) prossimo(); else liberi++; }
  };
}

function spezza(testo, max) {
  const parti = [];
  for (let i = 0; i < testo.length;) {
    let fine = Math.min(testo.length, i + max);
    if (fine < testo.length) { const taglio = testo.lastIndexOf('\n', fine); if (taglio > i + max * 0.6) fine = taglio; }
    parti.push(testo.slice(i, fine)); i = fine;
  }
  return parti;
}

// Se i documenti di una sezione non entrano in una sola lettura, i più lunghi diventano schede di lettura.
// Si lavora su copie: il testo integrale resta nel dossier e torna in uso appena il collegamento lo consente.
// La scheda viene conservata sul documento (campo "scheda") per non rifarla a ogni valutazione.
async function rientraNelLimite({ costruisci, documenti, llm, opzioni, signal, onNota }) {
  const copie = documenti.map((d) => ({ ...d, condensato: undefined, origine: d }));
  let guardia = 0;
  while (stimaByte(costruisci(copie)) > llm.limiteByte && guardia++ < 8) {
    const candidato = copie.filter((d) => !d.condensato && d.testo.length > 20000).sort((x, y) => y.testo.length - x.testo.length)[0];
    if (!candidato) throw new ErroreLlm('prompt_too_large', 'I documenti di questa sezione superano il limite di lettura anche dopo la sintesi. Rimuovi gli allegati non essenziali.');
    if (!candidato.origine.scheda) {
      const maxParte = Math.floor(Math.min(llm.limiteByte - 30000, 190000) * 0.9);
      const parti = spezza(candidato.testo, maxParte);
      onNota?.(`«${candidato.nome}» è troppo lungo per una sola lettura con questo collegamento: Claude lo legge in ${parti.length} ${parti.length === 1 ? 'parte' : 'parti'} e ne ricava una scheda con estratti.`);
      const schede = [];
      for (let i = 0; i < parti.length; i++) {
        const p = promptCondensa({ documento: candidato, parte: i + 1, parti: parti.length, testo: parti[i] });
        const r = await llm.chiama({ ...p, modello: opzioni.modello, impegno: 'medium', signal });
        schede.push(`[Scheda di lettura — parte ${i + 1} di ${parti.length}]\n${r.testo.trim()}`);
      }
      candidato.origine.scheda = schede.join('\n\n');
    } else onNota?.(`«${candidato.nome}» viene letto dalla scheda con estratti preparata in precedenza.`);
    candidato.condensato = candidato.origine.scheda;
  }
  return copie;
}

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : null));
const elenco = (v, n = 3) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, n) : []);

function pulisciGiudizio(json, sezione) {
  const attesi = new Set(sezione.criteri.filter((c) => c.tipo !== 'fasce' || c.giudizio).map((c) => c.id));
  const criteri = (Array.isArray(json?.criteri) ? json.criteri : []).filter((c) => c && attesi.has(String(c.id))).map((c) => ({
    id: String(c.id),
    punteggio: numero(c.punteggio),
    rigoroso: numero(c.rigoroso),
    valore: numero(c.valore),
    motivazione: typeof c.motivazione === 'string' ? c.motivazione.trim() : '',
    evidenze: elenco(c.evidenze), criticita: elenco(c.criticita),
    miglioramenti: (Array.isArray(c.miglioramenti) ? c.miglioramenti : []).filter((m) => m && typeof m.azione === 'string' && m.azione.trim()).slice(0, 3).map((m) => ({ azione: m.azione.trim(), punti: numero(m.punti) ?? 0 })),
  }));
  if (!criteri.length) throw new ErroreLlm('invalid_json', 'La risposta non contiene i punteggi dei criteri richiesti.');
  return { criteri, sintesi: typeof json.sintesi === 'string' ? json.sintesi.trim() : '' };
}

/**
 * Esegue (o completa) la valutazione di un progetto.
 * onEvento({ passo, stato: 'in_corso'|'fatto'|'errore', testo?, pensiero?, messaggio? }) e onEvento({ nota })
 */
export async function eseguiValutazione({ bando, progetto, llm, opzioni, onEvento = () => {}, signal, precedente = null }) {
  const griglia = getGriglia(bando, progetto.categoriaId);
  const { passi, saltate, commissari } = pianoValutazione(bando, progetto, opzioni.commissari);
  const val = {
    data: new Date().toISOString(), modello: opzioni.modello, impegno: opzioni.impegno, collegamento: llm.etichetta,
    commissari: commissari.map((c) => ({ id: c.id, nome: c.nome })),
    giudizi: {}, verifica: null, errori: [], note: [], modelliUsati: [],
    uso: { ingresso: 0, uscita: 0, cacheLetta: 0, cacheScritta: 0, chiamate: 0 },
  };
  // con "precedente" si riprovano solo i passi mancanti
  if (precedente) {
    for (const [sid, lista] of Object.entries(precedente.giudizi || {})) val.giudizi[sid] = lista.filter((g) => commissari.some((c) => c.id === g.commissario.id));
    val.verifica = precedente.verifica || null;
  }
  for (const s of saltate) val.note.push(`Sezione ${s.id} non valutata: nessun documento leggibile caricato per i suoi criteri.`);
  const limita = semaforo(llm.paralleli || 2);
  const conta = (r) => {
    val.uso.chiamate++;
    if (r.uso) { val.uso.ingresso += r.uso.ingresso || 0; val.uso.uscita += r.uso.uscita || 0; val.uso.cacheLetta += r.uso.cacheLetta || 0; val.uso.cacheScritta += r.uso.cacheScritta || 0; }
    if (r.modello && !val.modelliUsati.includes(r.modello)) val.modelliUsati.push(r.modello);
  };
  const esegui = (passo, fn) => limita(async () => {
    if (signal?.aborted) return;
    onEvento({ passo: passo.id, stato: 'in_corso' });
    try {
      await fn();
      onEvento({ passo: passo.id, stato: 'fatto' });
    } catch (e) {
      if (e?.codice === 'cancelled' || signal?.aborted) { onEvento({ passo: passo.id, stato: 'interrotto' }); return; }
      val.errori.push({ passo: passo.id, etichetta: passo.etichetta, messaggio: e?.message || 'Errore sconosciuto.' });
      onEvento({ passo: passo.id, stato: 'errore', messaggio: e?.message });
    }
  });

  const lavori = [];
  for (const sez of sezioniConGiudizio(griglia)) {
    const passiSez = passi.filter((p) => p.sezione === sez.id);
    if (!passiSez.length) continue;
    val.giudizi[sez.id] = val.giudizi[sez.id] || [];
    const daFare = passiSez.filter((p) => !val.giudizi[sez.id].some((g) => g.commissario.id === p.commissario.id));
    for (const p of passiSez) if (!daFare.includes(p)) onEvento({ passo: p.id, stato: 'fatto' });
    if (!daFare.length) continue;
    lavori.push((async () => {
      let docs = documentiPerSezione(progetto.documenti, sez);
      const costruisci = (d, commissario = daFare[0].commissario) => promptSezione({ bando, categoriaId: progetto.categoriaId, anno: progetto.anno, sezione: sez, documenti: d, dati: progetto.dati, commissario });
      try {
        docs = await limita(() => rientraNelLimite({ costruisci, documenti: docs, llm, opzioni, signal, onNota: (n) => { val.note.push(n); onEvento({ nota: n }); } }));
      } catch (e) {
        for (const p of daFare) { val.errori.push({ passo: p.id, etichetta: p.etichetta, messaggio: e.message }); onEvento({ passo: p.id, stato: 'errore', messaggio: e.message }); }
        return;
      }
      const unPasso = (passo) => esegui(passo, async () => {
        const p = costruisci(docs, passo.commissario);
        const r = await llm.chiama({
          ...p, modello: opzioni.modello, impegno: opzioni.impegno, signal,
          onPensiero: (t) => onEvento({ passo: passo.id, stato: 'in_corso', pensiero: t }),
          onTesto: (t) => onEvento({ passo: passo.id, stato: 'in_corso', testo: t }),
        });
        conta(r);
        val.giudizi[sez.id].push({ commissario: { id: passo.commissario.id, nome: passo.commissario.nome }, modello: r.modello, ...pulisciGiudizio(r.json, sez) });
      });
      // il primo commissario apre la lettura dei documenti; con l'API gli altri la ritrovano in cache
      if (llm.cacheCondivisa && daFare.length > 1) { await unPasso(daFare[0]); await Promise.all(daFare.slice(1).map(unPasso)); }
      else await Promise.all(daFare.map(unPasso));
    })());
  }

  const passoVerifica = passi.find((p) => p.tipo === 'verifica');
  if (passoVerifica) {
    if (val.verifica) onEvento({ passo: 'verifica', stato: 'fatto' });
    else lavori.push(esegui(passoVerifica, async () => {
      let docs = documentiPerSezione(progetto.documenti, 'V');
      const costruisci = (d) => promptVerifica({ bando, categoriaId: progetto.categoriaId, anno: progetto.anno, documenti: d, tutti: progetto.documenti, dati: progetto.dati });
      docs = await rientraNelLimite({ costruisci, documenti: docs, llm, opzioni, signal });
      const r = await llm.chiama({
        ...costruisci(docs), modello: opzioni.modello, impegno: opzioni.impegno, signal,
        onPensiero: (t) => onEvento({ passo: 'verifica', stato: 'in_corso', pensiero: t }),
        onTesto: (t) => onEvento({ passo: 'verifica', stato: 'in_corso', testo: t }),
      });
      conta(r);
      const controlli = (Array.isArray(r.json?.controlli) ? r.json.controlli : []).filter((c) => c && c.titolo).slice(0, 15).map((c) => ({
        titolo: String(c.titolo), esito: ['ok', 'attenzione', 'critico'].includes(c.esito) ? c.esito : 'attenzione',
        dettaglio: String(c.dettaglio || ''), azione: String(c.azione || ''),
      }));
      val.verifica = { controlli, sintesi: String(r.json?.sintesi || '') };
    }));
  }
  await Promise.all(lavori);
  val.interrotta = !!signal?.aborted;
  return val;
}

// Giudizi dei commissari raggruppati per criterio, nel formato atteso da componiRisultato().
export function valutazioniPerCriterio(valutazione) {
  const out = {};
  for (const lista of Object.values(valutazione?.giudizi || {})) {
    for (const g of lista) for (const c of g.criteri) (out[c.id] = out[c.id] || []).push({ commissario: g.commissario.nome, ...c });
  }
  return out;
}

// Compila i Dati chiave leggendo i documenti (quando manca il Modulo III in formato Excel).
export async function estraiDati({ bando, progetto, llm, opzioni, signal, onTesto }) {
  let docs = progetto.documenti.filter((d) => d.testo && !['sceneggiatura', 'identita', 'cv_regista', 'cv_autori', 'cv_artistico', 'cv_tecnico', 'cv_societa'].includes(d.tipo)).map((d) => ({ ...d }));
  if (!docs.length) throw new ErroreLlm('nessun_documento', 'Carica almeno un modulo, un budget o un piano finanziario da cui leggere i dati.');
  const costruisci = (d) => promptEstrazione({ bando, documenti: d });
  while (stimaByte(costruisci(docs)) > llm.limiteByte && docs.length > 1) docs = docs.sort((a, b) => a.testo.length - b.testo.length).slice(0, -1);
  if (stimaByte(costruisci(docs)) > llm.limiteByte) throw new ErroreLlm('prompt_too_large', 'Documento troppo lungo per l’estrazione dei dati: inserisci i valori a mano.');
  const r = await llm.chiama({ ...costruisci(docs), modello: opzioni.modello, impegno: 'medium', signal, onTesto });
  const j = r.json || {};
  const soloNumeri = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, numero(v)]).filter(([, v]) => v != null));
  return {
    dati: {
      ...(j.titolo ? { titolo: String(j.titolo) } : {}), ...(j.tipologiaOpera ? { tipologiaOpera: String(j.tipologiaOpera) } : {}),
      ...(numero(j.durataMin) != null ? { durataMin: numero(j.durataMin) } : {}),
      giorni: soloNumeri(j.giorni), professionisti: soloNumeri(j.professionisti), economici: soloNumeri(j.economici),
      piano: (Array.isArray(j.piano) ? j.piano : []).filter((p) => p && numero(p.importo) > 0).map((p) => ({
        voce: String(p.voce || ''), etichetta: String(p.etichetta || ''), denominazione: String(p.denominazione || ''), importo: numero(p.importo),
        documento: ['contratto', 'deal_memo', 'delibera', 'referenze', 'nessuno'].includes(p.documento) ? p.documento : 'nessuno',
      })),
      ripreseIniziate: j.ripreseIniziate === true,
    },
    note: elenco(j.note, 8), esclusi: progetto.documenti.length - docs.length,
  };
}

// Legge un nuovo bando e ne ricava la griglia di valutazione.
export async function leggiBando({ testo, nomeFile, llm, opzioni, signal, onTesto }) {
  if (byteLen(testo) > llm.limiteByte - 12000) throw new ErroreLlm('prompt_too_large', 'Il testo del bando è troppo lungo per una sola lettura. Carica soltanto l’avviso con i criteri di valutazione, senza allegati.');
  const p = promptBando({ testo, nomeFile });
  const r = await llm.chiama({ ...p, schema: {}, modello: opzioni.modello, impegno: 'high', signal, onTesto });
  return normalizzaBando(r.json, nomeFile);
}
