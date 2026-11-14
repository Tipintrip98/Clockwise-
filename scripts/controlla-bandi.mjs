// Controlla le pagine ufficiali dei bandi e dice se è comparso qualche documento nuovo.
// È lo stesso controllo che il programma fa da solo (server/aggiornamenti.js), qui da riga di comando:
// il confronto è con bandi/sorgenti.lock.json, che conserva l'elenco dei documenti visti l'ultima volta.
//
// Uso:  node scripts/controlla-bandi.mjs [opzioni]
//   --aggiorna            riscrive bandi/sorgenti.lock.json con quanto rilevato (poi va fatto il commit)
//   --json                stampa un rapporto strutturato (JSON) invece di quello leggibile
//   --rapporto <file>     scrive anche il rapporto in Markdown (lo usa il workflow per la issue)
//   --solo <id,id,…>      controlla soltanto questi bandi
//   --url <https://…>     prova libera: rileva i documenti di una pagina qualsiasi, senza usare il lock (ripetibile)
//   --canale              controlla anche il canale del catalogo (bandi/catalogo.json pubblicato)
//   --lock <file>         usa un altro file di lock
// Esce con 0 anche quando trova novità (lo dice il rapporto); con 1 se nessuna pagina ha risposto; con 2 se le opzioni sono sbagliate.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { creaAggiornamenti } from '../server/aggiornamenti.js';
import { verificaCatalogo, revisioniInUso } from '../app/js/core/aggiornamenti.js';
import { BANDI_PREDEFINITI, SCHEDE_BANDI } from '../app/js/core/bandi/indice.js';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FILE_LOCK = path.join(radice, 'bandi/sorgenti.lock.json');
export const SCHEMA_LOCK = 1;

/** Legge il lock; se manca o è illeggibile restituisce un lock vuoto. */
export function leggiLock(file = FILE_LOCK) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (j && j.schema === SCHEMA_LOCK && j.sorgenti && typeof j.sorgenti === 'object') return j;
  } catch { /* nessun lock: tutte le pagine risultano «senza base» */ }
  return { schema: SCHEMA_LOCK, aggiornato: null, sorgenti: {} };
}

/**
 * Confronta quanto rilevato con il lock.
 * @param {object} lock
 * @param {{id: string, nome: string, pagine: string[]}[]} elenco   bandi controllati
 * @param {Record<string, {pagine: object[]}>} sorgenti              esito di rilevaPagine()
 * @param {string} quando
 * @returns {{ esito: object, lock: object }}   il rapporto e il lock come andrebbe riscritto
 */
export function confrontaConLock(lock, elenco, sorgenti, quando) {
  const novita = [], senzaBase = [], errori = [], rimossi = [];
  const nuovoLock = { schema: SCHEMA_LOCK, nota: 'Generato da scripts/controlla-bandi.mjs --aggiorna: elenco dei documenti visti sulle pagine ufficiali dei bandi. Non modificare a mano.', aggiornato: quando, sorgenti: {} };
  let pagine = 0, lette = 0;
  for (const b of [...elenco].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const prima = lock.sorgenti?.[b.id]?.pagine || {};
    const dopo = {};
    for (const pag of sorgenti[b.id]?.pagine || []) {
      pagine++;
      const base = Object.hasOwn(prima, pag.url) ? prima[pag.url] : null;
      if (pag.errore) {
        errori.push({ id: b.id, nome: b.nome, pagina: pag.url, errore: pag.errore });
        if (base) dopo[pag.url] = base; // una pagina ferma non cancella ciò che si sapeva
        continue;
      }
      lette++;
      const adesso = pag.documenti.map((d) => d.url);
      if (!base) senzaBase.push({ id: b.id, nome: b.nome, pagina: pag.url, documenti: adesso.length });
      else {
        const noti = new Set(base.documenti || []);
        const presenti = new Set(adesso);
        const nuovi = pag.documenti.filter((d) => !noti.has(d.url));
        const tolti = (base.documenti || []).filter((u) => !presenti.has(u));
        if (nuovi.length) novita.push({ id: b.id, nome: b.nome, pagina: pag.url, documenti: nuovi });
        if (tolti.length) rimossi.push({ id: b.id, nome: b.nome, pagina: pag.url, documenti: tolti });
      }
      dopo[pag.url] = { rilevato: base && base.impronta === pag.impronta ? base.rilevato : quando, impronta: pag.impronta, documenti: adesso };
    }
    if (Object.keys(dopo).length) nuovoLock.sorgenti[b.id] = { pagine: Object.fromEntries(Object.keys(dopo).sort().map((u) => [u, dopo[u]])) };
  }
  return {
    esito: { quando, novita: novita.length > 0, bandi: elenco.length, pagine, lette, conNovita: novita, senzaBase, errori, rimossi },
    lock: nuovoLock,
  };
}

const dataOra = (iso) => new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' });

/** Rapporto leggibile in console. */
export function rapportoTesto(e) {
  const r = [`Controllo delle pagine ufficiali dei bandi — ${dataOra(e.quando)}`,
    `Bandi: ${e.bandi} · pagine: ${e.pagine} (lette ${e.lette}) · con novità: ${e.conNovita.length} · senza base: ${e.senzaBase.length} · non raggiungibili: ${e.errori.length}`];
  if (e.conNovita.length) {
    r.push('', 'NOVITÀ SULLE PAGINE UFFICIALI');
    for (const n of e.conNovita) {
      r.push(`• ${n.nome} — ${n.pagina}`);
      for (const d of n.documenti) r.push(`    + [${d.tipo}] ${d.titolo}`, `      ${d.url}`);
    }
  } else r.push('', 'Nessun documento nuovo.');
  if (e.senzaBase.length) {
    r.push('', 'PAGINE SENZA BASE NEL LOCK (prima rilevazione: esegui con --aggiorna e fai il commit di bandi/sorgenti.lock.json)');
    for (const s of e.senzaBase) r.push(`• ${s.nome} — ${s.pagina} (${s.documenti} documenti)`);
  }
  if (e.rimossi.length) {
    r.push('', 'DOCUMENTI NON PIÙ PRESENTI');
    for (const n of e.rimossi) { r.push(`• ${n.nome} — ${n.pagina}`); for (const u of n.documenti) r.push(`    − ${u}`); }
  }
  if (e.errori.length) {
    r.push('', 'PAGINE NON RAGGIUNGIBILI');
    for (const x of e.errori) r.push(`• ${x.nome} — ${x.pagina}: ${x.errore}`);
  }
  return r.join('\n');
}

const md = (t) => String(t).replace(/[\\`*_[\]<>|]/g, '\\$&').replace(/@/g, '@&#8203;').replace(/\s+/g, ' ').trim();
/** Rapporto in Markdown per la issue «Bandi: novità sulle pagine ufficiali». I titoli arrivano da siti esterni: vengono resi innocui (niente link, HTML o menzioni). */
export function rapportoMarkdown(e) {
  const r = [`Controllo del ${dataOra(e.quando)} — ${e.bandi} bandi, ${e.pagine} pagine (${e.lette} lette).`, ''];
  if (e.conNovita.length) {
    r.push('## Documenti nuovi', '');
    for (const n of e.conNovita) {
      r.push(`### ${md(n.nome)}`, `Pagina: <${n.pagina}>`, '');
      for (const d of n.documenti.slice(0, 60)) r.push(`- \`${d.tipo}\` ${md(d.titolo)} — <${d.url}>`);
      if (n.documenti.length > 60) r.push(`- … e altri ${n.documenti.length - 60}`);
      r.push('');
    }
    r.push('**Che cosa fare**: aprire i documenti, aggiornare se serve la scheda in `bandi/dati/` (e la `revisione`), eseguire `npm run bandi` e poi `npm run bandi:controlla -- --aggiorna`, quindi fare il commit: il catalogo pubblicato raggiunge da solo i programmi installati.', '');
  } else r.push('Nessun documento nuovo.', '');
  if (e.rimossi.length) { r.push('## Documenti non più presenti', ''); for (const n of e.rimossi) { r.push(`- ${md(n.nome)} (<${n.pagina}>): ${n.documenti.length}`); } r.push(''); }
  if (e.senzaBase.length) { r.push('## Pagine senza base nel lock', '', 'Eseguire `npm run bandi:controlla -- --aggiorna` e fare il commit di `bandi/sorgenti.lock.json`.', ''); for (const s of e.senzaBase) r.push(`- ${md(s.nome)} — <${s.pagina}> (${s.documenti} documenti)`); r.push(''); }
  if (e.errori.length) { r.push('## Pagine non raggiungibili', ''); for (const x of e.errori) r.push(`- ${md(x.nome)} — <${x.pagina}>: ${md(x.errore)}`); r.push(''); }
  // impronta delle novità: il workflow ritocca la issue solo quando questo valore cambia
  const indirizzi = e.conNovita.flatMap((n) => n.documenti.map((d) => d.url)).sort();
  r.push(`<!-- clockwise-novita: ${crypto.createHash('sha256').update(indirizzi.join('\n')).digest('hex').slice(0, 32)} -->`, '');
  return r.join('\n');
}

function opzioni(argv) {
  const o = { aggiorna: false, json: false, canale: false, rapporto: null, solo: null, url: [], lock: FILE_LOCK };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valore = () => { const v = argv[++i]; if (v == null || v.startsWith('--')) throw new Error(`Dopo ${a} manca un valore.`); return v; };
    if (a === '--aggiorna') o.aggiorna = true;
    else if (a === '--json') o.json = true;
    else if (a === '--canale') o.canale = true;
    else if (a === '--rapporto') o.rapporto = valore();
    else if (a === '--solo') o.solo = valore().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--url') o.url.push(valore());
    else if (a === '--lock') o.lock = path.resolve(valore());
    else throw new Error(`Opzione non riconosciuta: ${a}`);
  }
  return o;
}

async function principale() {
  let o;
  try { o = opzioni(process.argv.slice(2)); } catch (e) { console.error(`${e.message}\nVedi le opzioni in cima a scripts/controlla-bandi.mjs.`); process.exit(2); }
  const versione = JSON.parse(fs.readFileSync(path.join(radice, 'package.json'), 'utf8')).version;
  const servizio = creaAggiornamenti({ versione });
  const quando = new Date().toISOString();

  if (o.url.length) {
    // prova libera: che cosa vede il controllo su una pagina qualsiasi
    const elenco = o.url.map((u, i) => ({ id: `prova-${i + 1}`, nome: u, pagine: [u] }));
    const sorgenti = await servizio.rilevaPagine(elenco);
    if (o.json) console.log(JSON.stringify({ quando, sorgenti }, null, 1));
    else for (const b of elenco) {
      const pag = sorgenti[b.id].pagine[0];
      console.log(`\n${b.nome}`);
      if (pag.errore) { console.log(`  non raggiungibile: ${pag.errore}`); continue; }
      if (pag.finale) console.log(`  reindirizzata a ${pag.finale}`);
      console.log(`  ${pag.documenti.length} documenti${pag.troncato ? ' (elenco troncato)' : ''} · impronta ${pag.impronta.slice(0, 16)}…`);
      for (const d of pag.documenti) console.log(`  [${d.tipo}] ${d.titolo}\n        ${d.url}`);
    }
    process.exit(Object.values(sorgenti).every((s) => s.errore) ? 1 : 0);
  }

  let canale = null;
  if (o.canale) {
    const r = await servizio.controlla({});
    canale = { ...r.canale };
    if (r.catalogo) {
      const v = await verificaCatalogo(r.catalogo, revisioniInUso(BANDI_PREDEFINITI, SCHEDE_BANDI));
      Object.assign(canale, { valido: v.ok, motivo: v.motivo, revisione: v.revisione, accettati: v.accettati.map((b) => b.id), invariati: v.invariati, scartati: v.scartati });
    }
  }

  let elenco = servizio.elencoPagine();
  if (o.solo) {
    const sconosciuti = o.solo.filter((id) => !elenco.some((b) => b.id === id));
    if (sconosciuti.length) { console.error(`Bandi sconosciuti o senza pagina ufficiale: ${sconosciuti.join(', ')}`); process.exit(2); }
    elenco = elenco.filter((b) => o.solo.includes(b.id));
  }
  const sorgenti = await servizio.rilevaPagine(elenco);
  const lockAttuale = leggiLock(o.lock);
  const { esito, lock } = confrontaConLock(lockAttuale, elenco, sorgenti, quando);
  if (o.solo) for (const [id, v] of Object.entries(lockAttuale.sorgenti || {})) if (!lock.sorgenti[id]) lock.sorgenti[id] = v; // controllo parziale: il resto del lock resta
  if (canale) esito.canale = canale;
  esito.lockAggiornato = false;
  if (o.aggiorna) {
    lock.sorgenti = Object.fromEntries(Object.keys(lock.sorgenti).sort().map((k) => [k, lock.sorgenti[k]]));
    fs.writeFileSync(o.lock, `${JSON.stringify(lock, null, 1)}\n`);
    esito.lockAggiornato = true;
  }
  if (o.rapporto) fs.writeFileSync(o.rapporto, rapportoMarkdown(esito));
  if (o.json) console.log(JSON.stringify(esito, null, 1));
  else {
    console.log(rapportoTesto(esito));
    if (canale) console.log(`\nCanale del catalogo: ${canale.url || '—'} → ${canale.esito}${canale.dettaglio ? ` (${canale.dettaglio})` : ''}${canale.valido ? `, revisione ${canale.revisione || '—'}: ${canale.accettati.length} voci più recenti, ${canale.invariati} invariate, ${canale.scartati.length} scartate` : canale.motivo ? ` — ${canale.motivo}` : ''}`);
    if (esito.lockAggiornato) console.log(`\nLock riscritto: ${path.relative(radice, o.lock)}`);
  }
  process.exit(esito.pagine > 0 && esito.lette === 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principale().catch((e) => { console.error(e?.stack || e); process.exit(1); });
