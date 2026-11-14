// Motore di ragionamento: dai fatti verificabili del dossier alle fasce di punteggio attese, senza Claude.
//
// Tre passi, tutti deterministici e testabili:
//  1. fattiDossier()     — i fatti che si ricavano da documenti, moduli e numeri (tipi di allegato, firme nelle trascrizioni,
//                          righe del piano con il loro documento, figure dichiarate…). I fatti «di giudizio» restano non
//                          determinati, salvo indizi testuali forti o una risposta del produttore (progetto.fattiConfermati).
//  2. ancoreTaratura()   — per ogni criterio valutato da Claude applica le regole della sua famiglia (core/taratura-dati.js)
//                          e compone le fasce ATTESA e RIGOROSA in punti, con le regole usate, il perché e la fiducia.
//                          La composizione è quella dichiarata in COMPOSIZIONE, applicata alla lettera.
//  3. testoAncore() → istruzioni a Claude; scostamenti() → controllo dei punteggi dei commissari dopo la valutazione;
//     stimaDaRegole() → previsione senza Claude.
// Le regole non correggono mai i punteggi dei commissari: li confrontano e segnalano.

import { REGOLE, FATTI, FORZE, FIDUCIE, FAMIGLIE_TARATE, ERRORI_DA_EVITARE, LIMITI, VERSIONE_TARATURA, LESSICO, REPARTI,
  ALLEGATI_PER_VOCE, ALLEGATI_PER_ETICHETTA, LUOGHI, COMPOSIZIONE } from './taratura-dati.js';
import { getCategoria, getGriglia, calcolaMetriche, coperturaPiano, puntiFascia, valutaQuantitativo, statisticheEsiti, statisticheFinanziati,
  DOC_VALIDI, r1 } from './scoring.js';
import { tipoPerId } from './docs.js';

export { COMPOSIZIONE, LIMITI, VERSIONE_TARATURA };

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arrot = (v, d = 2) => (v == null ? null : Math.round((v + Number.EPSILON) * 10 ** d) / 10 ** d);
const minuscolo = (s) => String(s || '').toLowerCase();
const fmt = (n, dec = 1) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: dec }));
const pctTesto = (f) => (f == null ? '—' : `${fmt(f * 100, 0)}%`);
const conta = (re, testo) => { re.lastIndex = 0; let n = 0; while (re.exec(testo)) n++; re.lastIndex = 0; return n; };
const tutte = (re, testo) => { re.lastIndex = 0; const out = []; let m; while ((m = re.exec(testo))) out.push(m); re.lastIndex = 0; return out; };
const prova = (re, testo) => { re.lastIndex = 0; const ok = re.test(testo); re.lastIndex = 0; return ok; };

/** Un criterio è valutato da Claude (e quindi ha un’ancora) se non è un calcolo a fasce puro. */
export const criterioAGiudizio = (c) => c.tipo !== 'fasce' || !!c.giudizio;

/* ================================================================== 1. fatti */

const testoUtile = (d) => String(d?.testo || '').replace(/\[[^\]]*\]/g, '').trim();
// Pagine di un documento: quelle dichiarate dall’estrazione, altrimenti una stima dalla lunghezza (circa 1.800 caratteri a cartella).
const paginePer = (d) => num(d?.pagine) || (testoUtile(d).length ? Math.max(1, Math.round(testoUtile(d).length / 1800)) : 0);

/** Firme e timbri riconoscibili nel testo di un documento (marcatori delle trascrizioni o diciture della firma digitale). */
export function firmeDocumento(testo) {
  const t = String(testo || '');
  const nominative = tutte(LESSICO.firmaAutografa, t).map((m) => minuscolo(m[1]).replace(/\s+/g, ' ').trim());
  const distinte = new Set(nominative);
  const nonLeggibili = conta(LESSICO.firmaNonLeggibile, t);
  const digitali = conta(LESSICO.firmaDigitale, t) + (prova(LESSICO.firmaNelTesto, t) ? 1 : 0);
  const timbri = new Set(tutte(LESSICO.timbro, t).map((m) => minuscolo(m[1]).trim()));
  return {
    nominative: [...distinte], nonLeggibili, digitali, timbri: timbri.size,
    // soggetti diversi che hanno firmato o timbrato: i timbri contano solo oltre le firme (spesso accompagnano la stessa firma)
    soggetti: distinte.size + nonLeggibili + digitali + Math.max(0, timbri.size - distinte.size - nonLeggibili),
    daControllare: nonLeggibili > 0,
  };
}

// Persone dichiarate nei moduli (Modulo III, tabelle della componente artistica e del cast tecnico).
function persone(elenco) {
  const viste = new Map();
  for (const r of Array.isArray(elenco) ? elenco : []) {
    const nome = String(r?.nome || '').trim();
    if (!nome) continue;
    const chiave = minuscolo(nome).replace(/\s+/g, ' ');
    if (!viste.has(chiave)) viste.set(chiave, { nome, ruolo: String(r?.ruolo || ''), cognome: minuscolo(nome.split(/\s+/).filter((x) => x.length >= 3).pop() || nome) });
  }
  return [...viste.values()];
}
const nomina = (testo, persona) => persona.cognome.length >= 3 && minuscolo(testo).includes(persona.cognome);
const firmataDa = (testo, persona) => {
  const f = firmeDocumento(testo);
  return f.nominative.some((n) => n.includes(persona.cognome)) || f.digitali > 0;
};
const RE_ARTISTICO = /attor|attric|interpret|regist|sceneggiat|compositor|autor|musich/i;
const RE_TECNICO = /fotografia|montaggio|montat|scenograf|costum|suono|fonic|operatore|truccat|elettricist|macchinist|aiuto regia|organizzator/i;

// Quote di figure con profilo, con un accordo allegato e con un accordo firmato da loro.
function quotePersone(lista, totaleDichiarato, docs, tipiCv, reClasse) {
  const accordi = docs.filter((d) => d.tipo === 'accordi_cast' && testoUtile(d));
  const cv = docs.filter((d) => tipiCv.includes(d.tipo) && testoUtile(d));
  if (lista.length) {
    const n = lista.length;
    const conProfilo = lista.filter((p) => cv.some((d) => nomina(d.testo, p))).length;
    const allegato = lista.filter((p) => accordi.some((d) => nomina(d.testo, p))).length;
    const firmato = lista.filter((p) => accordi.some((d) => nomina(d.testo, p) && firmataDa(d.testo, p))).length;
    return { n, profilo: conProfilo / n, allegato: allegato / n, firmato: firmato / n, nominativo: true };
  }
  const n = num(totaleDichiarato);
  if (!n) return { n: 0, profilo: 0, allegato: 0, firmato: 0, nominativo: false };
  // senza nominativi: un documento per figura, attribuito alla componente dalle parole che usa
  const propri = accordi.filter((d) => reClasse.test(d.testo));
  const firmati = propri.filter((d) => firmeDocumento(d.testo).soggetti >= 2);
  return { n, profilo: Math.min(1, cv.length / n), allegato: Math.min(1, propri.length / n), firmato: Math.min(1, firmati.length / n), nominativo: false };
}

// Tipi di allegato che sostengono una riga del piano: prima dal codice della voce, poi dalle parole dell’etichetta.
export function allegatiPerRiga(riga) {
  const voce = String(riga?.voce || '').trim();
  for (const [re, tipi] of ALLEGATI_PER_VOCE) if (voce && re.test(voce)) return tipi;
  const et = minuscolo(`${riga?.etichetta || ''} ${riga?.denominazione || ''}`);
  for (const [re, tipi] of ALLEGATI_PER_ETICHETTA) if (re.test(et)) return tipi;
  return [];
}
const RICHIESTA = (r) => String(r?.voce || '').trim() === '1.1' || /richiest[oa] con (?:questo|il presente) (?:bando|avviso)/i.test(r?.etichetta || '');

// Perché una riga non regge alla lettura rigorosa (vuoto = regge).
function difettiRigorosi(doc, tipo, docs) {
  const t = String(doc.testo || '');
  const out = [];
  if (firmeDocumento(t).soggetti < 2) out.push('non porta le firme di tutte le parti');
  if (prova(LESSICO.nonVincolante, t)) out.push('contiene formule non vincolanti');
  if (!prova(LESSICO.importo, t)) out.push('non indica un importo o una quota');
  if (tipo === 'finanziamenti' && !prova(LESSICO.concessione, t)) out.push('non risulta un atto di concessione');
  if (tipo === 'distribuzione' && !docs.some((d) => ['distribuzione', 'altro'].includes(d.tipo) && prova(LESSICO.elencoTitoli, d.testo)) && !prova(LESSICO.emittenti, t)) out.push('la qualifica del distributore non è provata');
  if (tipo === 'coproduzione' && !docs.some((d) => d.tipo === 'coproduzione' && prova(LESSICO.curriculumSocietario, d.testo))) out.push('la qualifica del coproduttore non è provata (manca il curriculum societario)');
  if (tipo === 'finanziatori_esterni' && prova(LESSICO.dealMemo, t) && !prova(LESSICO.contratto, t)) out.push('è una lettera e non un contratto');
  return out;
}

/** Righe del piano finanziario con la loro lettura: dichiarata, attesa (allegato presente), rigorosa (allegato firmato e completo). */
export function righePiano(dati, docs) {
  const righe = [];
  for (const r of dati?.piano || []) {
    const importo = num(r.importo);
    if (!importo || importo <= 0 || RICHIESTA(r)) continue;
    const tipi = allegatiPerRiga(r);
    const dichiarata = DOC_VALIDI.includes(r.documento);
    let candidati = docs.filter((d) => tipi.includes(d.tipo) && testoUtile(d));
    // con più allegati dello stesso tipo, si preferisce quello che nomina la controparte
    const parola = minuscolo(r.denominazione).split(/[^\p{L}\d]+/u).find((x) => x.length >= 4 && !/^(film|production|productions|societ|s\.r\.l)/.test(x));
    if (parola && candidati.some((d) => minuscolo(d.testo).includes(parola))) candidati = candidati.filter((d) => minuscolo(d.testo).includes(parola));
    const attesa = dichiarata && candidati.length > 0;
    let rigorosa = false, motivo = '';
    if (attesa) {
      const esiti = candidati.map((d) => ({ d, difetti: difettiRigorosi(d, d.tipo, docs) }));
      const buono = esiti.find((e) => !e.difetti.length);
      rigorosa = !!buono;
      if (!buono) motivo = `«${esiti[0].d.nome}» ${esiti[0].difetti.join(', ')}`;
    } else motivo = !dichiarata ? 'nel piano non è indicato un documento a supporto' : `tra gli allegati manca un documento del tipo ${tipi.map((t) => tipoPerId(t).nome).join(' o ') || 'previsto'}`;
    righe.push({ voce: r.voce || '', etichetta: r.etichetta || '', denominazione: r.denominazione || '', importo, documento: r.documento || 'nessuno', tipi, dichiarata, attesa, rigorosa, allegati: candidati.map((d) => d.nome), motivo });
  }
  return righe;
}

function fasceCopertura(criterio, f, flags) {
  if (f == null) return { massima: null, nulla: null };
  if (criterio?.fasce?.length) {
    const numeriche = criterio.fasce.filter((x) => !x.flag);
    const i = puntiFascia({ ...criterio, fasce: numeriche, peso: 1 }, f * 100, {});
    if (i.mancante) return { massima: false, nulla: true };
    const f0 = numeriche[i.indice];
    return { massima: i.indice === 0, nulla: f0.punti === 0 };
  }
  return { massima: f > 0.8, nulla: f <= 0.5 };
}

const DOC = (docs, tipo) => docs.filter((d) => d.tipo === tipo && testoUtile(d));
const inTesti = (lista, re) => lista.some((d) => prova(re, d.testo));

// Sezione del Modulo II tra un’intestazione e la successiva (ricerca tollerante, il testo arriva da un PDF).
function sezioneModulo(testo, inizio, fine) {
  const t = String(testo || '');
  const m = inizio.exec(t);
  if (!m) return '';
  const resto = t.slice(m.index + m[0].length);
  const f = fine.exec(resto);
  return (f ? resto.slice(0, f.index) : resto.slice(0, 4000)).trim();
}

/**
 * I fatti verificabili sul dossier, calcolati senza Claude.
 * Restituisce { valori, origini, indizi, documenti, piano, persone }: `valori` ha un valore per ogni fatto di FATTI
 * (null = non determinabile senza una lettura nel merito), `origini` dice da dove viene ciascun valore.
 * I fatti confermati dal produttore (progetto.fattiConfermati: { fatto: valore }) prevalgono su tutto.
 */
export function fattiDossier(bando, progetto) {
  const p = progetto || {};
  const dati = p.dati || {};
  const docs = (p.documenti || []).filter((d) => d && typeof d === 'object');
  const leggibili = docs.filter((d) => testoUtile(d));
  const categoria = getCategoria(bando, p.categoriaId);
  const griglia = getGriglia(bando, p.categoriaId);
  const anno = num(p.anno) || new Date().getFullYear();
  const v = {}, o = {};
  const metti = (k, valore, origine) => { v[k] = valore; o[k] = origine; };

  // --- testo dell’opera
  const testi = DOC(docs, 'sceneggiatura').sort((a, b) => paginePer(b) - paginePer(a));
  const testo = testi[0];
  const durata = num(dati.durataMin) || num(categoria?.durataMin) || null;
  metti('testo_opera_presente', !!testo, testo ? `«${testo.nome}», ${paginePer(testo)} pagine` : 'nessun documento di tipo sceneggiatura o trattamento con testo leggibile');
  if (testo) {
    const pag = paginePer(testo);
    const vuoleSceneggiatura = categoria?.testoQualita !== 'trattamento';
    const titoloSbagliato = vuoleSceneggiatura && /soggetto|sinossi|synopsis/i.test(testo.nome) && !/sceneggiatura|script/i.test(testo.nome);
    const integrale = !titoloSbagliato && (vuoleSceneggiatura ? (durata ? pag >= 0.6 * durata : pag >= 40) : pag >= 8);
    metti('testo_opera_integrale', integrale, titoloSbagliato ? 'il file sembra un soggetto o una sinossi, la categoria chiede la sceneggiatura'
      : `${pag} pagine ${vuoleSceneggiatura ? `per ${durata ? `${fmt(durata, 0)} minuti dichiarati (servono almeno ${fmt(Math.ceil(0.6 * durata), 0)})` : 'durata non dichiarata (soglia: 40 pagine)'}` : '(per un trattamento ne servono almeno 8)'}`);
    metti('rapporto_pagine_minuti', durata ? arrot(pag / durata) : 1, durata ? `${pag} pagine ÷ ${fmt(durata, 0)} minuti` : 'durata non dichiarata: si usa 1');
  } else {
    metti('testo_opera_integrale', false, 'manca il testo dell’opera');
    metti('rapporto_pagine_minuti', 1, 'manca il testo dell’opera: si usa 1');
  }
  // difetti formali: controllo meccanico su codifica e numerazione delle scene; senza riscontri resta da leggere
  if (testo) {
    const t = String(testo.testo);
    const codifica = conta(/Ã.|â€|�/g, t);
    const numeri = tutte(/^\s*(\d{1,3})[.)]?\s+(?:INT|EST|EXT|I\/E)\b/gim, t).map((m) => Number(m[1]));
    let salti = 0;
    for (let i = 1; i < numeri.length; i++) if (numeri[i] !== numeri[i - 1] + 1 && numeri[i] !== numeri[i - 1]) salti++;
    if (codifica >= 5 || salti >= 3) metti('difetti_formali_testo', true, `controllo meccanico: ${codifica >= 5 ? `${codifica} caratteri con codifica errata` : ''}${codifica >= 5 && salti >= 3 ? ', ' : ''}${salti >= 3 ? `${salti} salti nella numerazione delle scene` : ''}`);
    else metti('difetti_formali_testo', null, 'nessun difetto rilevato dal controllo meccanico: refusi e impaginazione vanno giudicati leggendo');
  } else metti('difetti_formali_testo', null, 'manca il testo dell’opera');

  const modulo2 = DOC(docs, 'modulo2');
  const presentazione = [...modulo2, ...DOC(docs, 'modulo1'), ...DOC(docs, 'altro')];
  // soggetto distintivo: indizio forte se il testo dichiara una storia vera; altrimenti è un giudizio
  const storiaVera = [...modulo2, ...testi].find((d) => prova(LESSICO.storiaVera, d.testo));
  metti('soggetto_distintivo', storiaVera ? true : null, storiaVera ? `indizio: «${storiaVera.nome}» dichiara una storia vera o fatti realmente accaduti` : 'giudizio: va letto il soggetto');
  const premiati = [...presentazione, ...DOC(docs, 'cv_autori'), ...testi].find((d) => prova(LESSICO.riconoscimentiScrittura, String(d.testo).slice(0, d.tipo === 'sceneggiatura' ? 3000 : undefined)));
  metti('riconoscimenti_scrittura', !!premiati, premiati ? `«${premiati.nome}» cita un premio, un fondo di sviluppo o un laboratorio` : 'nessun riconoscimento della scrittura nei moduli e negli allegati');

  // note di regia: sezione del Modulo II o documento dedicato, almeno 500 caratteri
  let note = '';
  for (const d of modulo2) { const s = sezioneModulo(d.testo, /note di regia/i, /\n\s*(?:II\.?\s*3|regista\b|3\.\s)/i); if (s.length > note.length) note = s; }
  const dedicate = leggibili.find((d) => /note[\s_-]*di[\s_-]*regia|director'?s?[\s_-]*statement/i.test(d.nome) || /^\s*note di regia/i.test(testoUtile(d).slice(0, 80)));
  if (dedicate && testoUtile(dedicate).length > note.length) note = testoUtile(dedicate);
  metti('note_regia_presenti', note.length >= 500, note ? `${fmt(note.length, 0)} caratteri di note di regia` : 'note di regia non trovate nel Modulo II né in un documento dedicato');
  const visivo = docs.find((d) => ['altro', 'piano_lavorazione'].includes(d.tipo) && (prova(LESSICO.materialiVisivi, d.nome || '') || prova(LESSICO.materialiVisivi, String(d.testo || '').slice(0, 400))));
  metti('materiali_visivi_presenti', !!visivo, visivo ? `«${visivo.nome}»` : 'nessuno storyboard, moodboard o teaser tra gli allegati');

  // --- territorio
  const regione = minuscolo(bando.territorio || bando.regione).replace(/'/g, '’');
  const luoghi = [regione, ...(LUOGHI[regione] || [])].filter(Boolean);
  const reLuoghi = luoghi.length ? new RegExp(`\\b(?:${luoghi.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/’/g, '[’\']')).join('|')})\\b`, 'gi') : null;
  if (testo && reLuoghi) {
    const occorrenze = conta(reLuoghi, testo.testo);
    const intestazioni = tutte(/^\s*(?:\d{1,3}[.)]?\s+)?(?:INT|EST|EXT|I\/E)\b[^\n]*/gim, testo.testo).filter((m) => prova(reLuoghi, m[0])).length;
    if (occorrenze >= 8 && intestazioni >= 2) metti('legame_territorio_strutturale', true, `indizio: ${occorrenze} citazioni di luoghi del territorio, ${intestazioni} nelle intestazioni di scena`);
    else if (occorrenze === 0) metti('legame_territorio_strutturale', false, 'il testo non nomina mai luoghi del territorio del bando');
    else metti('legame_territorio_strutturale', null, `giudizio: ${occorrenze} citazioni di luoghi del territorio nel testo, da leggere`);
  } else metti('legame_territorio_strutturale', null, testo ? 'territorio del bando non riconosciuto: da leggere' : 'manca il testo dell’opera');
  const piani = DOC(docs, 'piano_lavorazione');
  const pianoConLuoghi = piani.find((d) => (reLuoghi && prova(reLuoghi, d.testo)) || prova(LESSICO.location, d.testo));
  metti('location_reali_documentate', !!pianoConLuoghi, pianoConLuoghi ? `«${pianoConLuoghi.nome}»` : piani.length ? 'il piano di lavorazione non nomina luoghi del territorio' : 'nessun piano di lavorazione o elenco delle location');
  const lav = calcolaMetriche(dati, bando).lavorazioneSicilia?.valore;
  metti('quota_lavorazione_territorio', lav == null ? null : arrot(lav / 100), lav == null ? 'giorni di lavorazione non dichiarati' : `${fmt(lav, 0)}% dei giorni di pre-produzione e riprese`);

  // --- società
  const cvSoc = DOC(docs, 'cv_societa');
  const fontiSoc = [...modulo2.map((d) => ({ ...d, testo: sezioneModulo(d.testo, /(?:II\.?\s*5|opere prodotte|impresa)/i, /\n\s*(?:II\.?\s*6|professionisti)/i) })).filter((d) => d.testo), ...cvSoc];
  if (fontiSoc.length) {
    const titoli = new Set();
    for (const d of fontiSoc) for (const riga of String(d.testo).split('\n')) {
      const anni = tutte(/\b(19\d\d|20\d\d)\b/g, riga).map((m) => Number(m[1]));
      if (anni.some((a) => a >= anno - 5 && a <= anno)) titoli.add(minuscolo(riga).replace(/\s+/g, ' ').trim().slice(0, 80));
    }
    metti('opere_societa_quinquennio', titoli.size, `${titoli.size} righe con un’opera degli anni ${anno - 5}-${anno} nei moduli o nel curriculum`);
  } else metti('opere_societa_quinquennio', null, 'né curriculum della società né sezione del Modulo II sulle opere prodotte');
  const fondazione = [...modulo2, ...cvSoc].map((d) => /(?:costituit[ao]|fondat[ao]|anno di costituzione|nata|attiva dal)\D{0,25}((?:19|20)\d\d)/i.exec(d.testo)).find(Boolean);
  metti('anni_attivita_societa', fondazione ? Math.max(0, anno - Number(fondazione[1])) : null, fondazione ? `costituita nel ${fondazione[1]}` : 'anno di costituzione non trovato');
  const socRilievo = cvSoc.find((d) => prova(LESSICO.premiMaggiori, d.testo) || prova(LESSICO.festivalMaggiori, d.testo) || prova(LESSICO.uscitaNazionale, d.testo) || prova(LESSICO.emittenti, d.testo));
  metti('societa_riconoscimenti_rilievo', socRilievo ? true : null, socRilievo ? `indizio: «${socRilievo.nome}» cita festival, premi, uscite in sala o emittenti nazionali` : 'giudizio: da verificare sul curriculum');
  const incoerenza = (p.valutazione?.verifica?.controlli || []).find((c) => c.esito !== 'ok' && /curricul|incoeren|difform|contradd/i.test(`${c.titolo} ${c.dettaglio}`));
  metti('incoerenze_cv_moduli', incoerenza ? true : null, incoerenza ? `verifica formale: «${incoerenza.titolo}»` : 'giudizio: confronto tra curriculum e moduli da fare leggendo');

  // --- persone
  const m3 = p.modulo3 || {};
  const artistici = persone(m3.elencoArtistico);
  const tecnici = persone(m3.elencoTecnico);
  const artTot = artistici.length || num(dati.professionisti?.artTot) || 0;
  const crewTot = tecnici.length || num(dati.professionisti?.crewTot) || 0;
  const oltreRegista = artistici.length ? artistici.filter((x) => !/regi/i.test(x.ruolo)).length : Math.max(0, artTot - 1);
  metti('figure_artistiche_dichiarate', oltreRegista >= 2, artistici.length ? `${artistici.length} figure nominative nel Modulo III` : artTot ? `${artTot} figure nel quadro di sintesi, senza nominativi` : 'nessuna figura artistica dichiarata');
  const qa = quotePersone(artistici, artTot, docs, ['cv_regista', 'cv_autori', 'cv_artistico'], RE_ARTISTICO);
  metti('quota_artistici_con_profilo', arrot(qa.profilo), `${fmt(qa.profilo * 100, 0)}% delle figure con un curriculum allegato${qa.nominativo ? '' : ' (stima senza nominativi)'}`);
  metti('quota_artistici_accordo_allegato', arrot(qa.allegato), `${fmt(qa.allegato * 100, 0)}% con un accordo allegato`);
  metti('quota_artistici_accordo_firmato', arrot(qa.firmato), `${fmt(qa.firmato * 100, 0)}% con un accordo firmato dall’interessato`);
  const cvArt = [...DOC(docs, 'cv_artistico'), ...DOC(docs, 'cv_regista'), ...DOC(docs, 'cv_autori'), ...modulo2.map((d) => ({ ...d, testo: sezioneModulo(d.testo, /(?:II\.?\s*6|componente artistica)/i, /\n\s*(?:II\.?\s*7|cast tecnico)/i) }))];
  const segniRilievo = new Set(cvArt.flatMap((d) => [...tutte(LESSICO.premiMaggiori, d.testo), ...tutte(LESSICO.festivalMaggiori, d.testo)].map((m) => `${d.nome}|${minuscolo(m[0])}`)));
  metti('cast_rilievo_nazionale', segniRilievo.size >= 2 ? true : null, segniRilievo.size >= 2 ? `indizio: ${segniRilievo.size} premi o festival di primo piano nei curriculum artistici` : 'giudizio: da verificare sui curriculum');
  const cvReg = [...DOC(docs, 'cv_regista'), ...modulo2.map((d) => ({ ...d, testo: sezioneModulo(d.testo, /(?:II\.?\s*3|\bregista\b)/i, /\n\s*(?:II\.?\s*4|sceneggiatore)/i) }))];
  const esordio = cvReg.find((d) => prova(LESSICO.esordio, d.testo));
  metti('regista_esordiente', esordio ? true : null, esordio ? `indizio: «${esordio.nome}» parla di opera prima o esordio` : 'giudizio: da verificare sul curriculum del regista');
  metti('troupe_dichiarata', crewTot >= 3, tecnici.length ? `${tecnici.length} tecnici nominativi nel Modulo III` : crewTot ? `${crewTot} tecnici nel quadro di sintesi` : 'nessun tecnico dichiarato');
  if (tecnici.length) {
    const coperti = Object.entries(REPARTI).filter(([, re]) => tecnici.some((t) => re.test(t.ruolo))).map(([k]) => k);
    metti('capireparto_coperti', coperti.length >= 4, `reparti coperti: ${coperti.join(', ') || 'nessuno'}`);
  } else metti('capireparto_coperti', crewTot ? null : false, crewTot ? 'ruoli dei tecnici non disponibili' : 'nessun tecnico dichiarato');
  const cvTec = DOC(docs, 'cv_tecnico');
  const tecRilievo = cvTec.find((d) => prova(LESSICO.premiMaggiori, d.testo) || prova(LESSICO.festivalMaggiori, d.testo) || prova(LESSICO.emittenti, d.testo));
  metti('capo_reparto_di_rilievo', tecRilievo ? true : null, tecRilievo ? `indizio: «${tecRilievo.nome}» cita premi, festival o emittenti nazionali` : 'giudizio: da verificare sui curriculum dei capi reparto');
  const qt = quotePersone(tecnici, crewTot, docs, ['cv_tecnico'], RE_TECNICO);
  metti('quota_tecnici_accordo_allegato', arrot(qt.allegato), `${fmt(qt.allegato * 100, 0)}% dei tecnici con un accordo allegato`);
  metti('quota_tecnici_accordo_firmato', arrot(qt.firmato), `${fmt(qt.firmato * 100, 0)}% con un accordo firmato dall’interessato`);

  // --- piano finanziario
  metti('riprese_iniziate', !!dati.ripreseIniziate, dati.ripreseIniziate ? 'dichiarate iniziate nei Dati chiave' : 'non iniziate');
  const cop = coperturaPiano(dati);
  const costo = num(dati.economici?.costoProduzione), richiesto = num(dati.economici?.contributoRichiesto) || 0;
  const fabbisogno = costo != null && costo - richiesto > 0 ? costo - richiesto : null;
  const righe = righePiano(dati, docs);
  const somma = (k) => righe.filter((r) => r[k]).reduce((a, r) => a + r.importo, 0);
  const fr = (x) => (fabbisogno ? arrot(x / fabbisogno, 3) : null);
  metti('copertura_dichiarata', cop.sulFabbisogno == null ? null : arrot(cop.sulFabbisogno / 100, 3), cop.sulFabbisogno == null ? 'costo o piano finanziario non compilati' : `${pctTesto(cop.sulFabbisogno / 100)} del costo al netto del contributo richiesto, secondo le etichette del piano`);
  metti('copertura_attesa', fr(somma('attesa')), fabbisogno ? `${pctTesto(fr(somma('attesa')))}: fonti con documento indicato nel piano e allegato della controparte` : 'costo o contributo richiesto non compilati');
  metti('copertura_rigorosa', fr(somma('rigorosa')), fabbisogno ? `${pctTesto(fr(somma('rigorosa')))}: solo fonti con documento firmato da tutte le parti, importo e controparte qualificata` : 'costo o contributo richiesto non compilati');
  const critPiano = griglia.sezioni.flatMap((s) => s.criteri).find((c) => c.famiglia === 'piano_finanziario');
  const fa = fasceCopertura(critPiano, v.copertura_attesa), frg = fasceCopertura(critPiano, v.copertura_rigorosa);
  const etichettaTab = critPiano?.fasce?.length ? 'tabella del criterio' : 'soglie generiche 50% e 80%';
  metti('copertura_attesa_fascia_massima', fa.massima, `${etichettaTab} applicata alla copertura attesa`);
  metti('copertura_attesa_fascia_nulla', fa.nulla, `${etichettaTab} applicata alla copertura attesa`);
  metti('copertura_rigorosa_fascia_massima', frg.massima, `${etichettaTab} applicata alla copertura rigorosa`);
  metti('copertura_rigorosa_fascia_nulla', frg.nulla, `${etichettaTab} applicata alla copertura rigorosa`);

  // --- distribuzione
  const accordi = m3.accordi || {};
  const righeDistr = (dati.piano || []).filter((r) => num(r.importo) > 0 && allegatiPerRiga(r).includes('distribuzione') && !/^2\.[45]/.test(String(r.voce || '')));
  metti('distribuzione_dichiarata', !!accordi.distribuzione?.presente || righeDistr.length > 0, accordi.distribuzione?.presente ? 'dichiarata nel Modulo III' : righeDistr.length ? 'prevendite o minimi garantiti nel piano finanziario' : 'nessun accordo di distribuzione dichiarato');
  const distr = DOC(docs, 'distribuzione');
  const nazionale = distr.find((d) => !prova(LESSICO.venditeEstere, d.testo)) || distr[0];
  metti('documento_distribuzione_allegato', !!nazionale, nazionale ? `«${nazionale.nome}»` : 'nessun documento di distribuzione tra gli allegati');
  const tDistr = String(nazionale?.testo || '');
  const eDealMemo = prova(LESSICO.dealMemo, tDistr) || prova(LESSICO.dealMemo, nazionale?.nome || '');
  metti('distribuzione_contratto', !!nazionale && !eDealMemo && prova(LESSICO.contratto, `${nazionale?.nome || ''} ${tDistr}`), nazionale ? (eDealMemo ? 'deal memo o lettera di intenti' : prova(LESSICO.contratto, tDistr) ? 'contratto' : 'tipo di documento non riconosciuto') : 'nessun documento');
  const firmeDistr = firmeDocumento(tDistr);
  metti('distribuzione_firmata', !!nazionale && firmeDistr.soggetti >= 2, nazionale ? `${firmeDistr.soggetti} firme o timbri di soggetti diversi${firmeDistr.daControllare ? ' (firme non leggibili: controlla l’originale)' : ''}` : 'nessun documento');
  const elenco = [...distr, ...DOC(docs, 'altro')].find((d) => prova(LESSICO.elencoTitoli, d.testo));
  metti('distributore_qualifica_provata', !!elenco || (!!nazionale && prova(LESSICO.emittenti, tDistr)), elenco ? `elenco dei titoli in «${elenco.nome}»` : nazionale && prova(LESSICO.emittenti, tDistr) ? 'controparte emittente o piattaforma nazionale' : 'manca l’elenco dei titoli distribuiti');

  // --- internazionale
  const righeEstere = (dati.piano || []).filter((r) => num(r.importo) > 0 && (/^3/.test(String(r.voce || '')) || /ester|internazional/i.test(r.etichetta || '')) && !/^[68]/.test(String(r.voce || '')));
  metti('coproduzione_estera_dichiarata', !!accordi.coproduzioneEstero?.presente || righeEstere.length > 0, accordi.coproduzioneEstero?.presente ? 'dichiarata nel Modulo III' : righeEstere.length ? 'coproduttori esteri nel piano finanziario' : 'nessuna coproduzione estera dichiarata');
  const coprod = DOC(docs, 'coproduzione');
  const estereIn = (t) => new Set(tutte(LESSICO.formeEstere, t).map((m) => minuscolo(`${m[1]} ${m[2]}`).replace(/\s+/g, ' ').trim()));
  const accordoEstero = coprod.filter((d) => estereIn(d.testo).size || prova(LESSICO.paesiEsteri, d.testo)).sort((a, b) => firmeDocumento(b.testo).soggetti - firmeDocumento(a.testo).soggetti)[0];
  metti('documento_coproduzione_estera_allegato', !!accordoEstero, accordoEstero ? `«${accordoEstero.nome}»` : 'nessun accordo che nomini una società estera');
  const nEstere = accordoEstero ? estereIn(accordoEstero.testo).size : 0;
  const parti = Math.max(2, 1 + nEstere);
  const firmeCop = firmeDocumento(accordoEstero?.testo);
  metti('accordo_coproduzione_estera_firmato', !!accordoEstero && firmeCop.soggetti >= parti, accordoEstero ? `${firmeCop.soggetti} firme per ${parti} parti${firmeCop.daControllare ? ' (firme non leggibili: controlla l’originale)' : ''}` : 'nessun accordo');
  metti('coproduttori_esteri_n', nEstere || (righeEstere.length ? new Set(righeEstere.map((r) => minuscolo(r.denominazione) || r.voce)).size : 0), nEstere ? `${nEstere} società estere parti dell’accordo` : righeEstere.length ? 'dalle righe del piano finanziario' : 'nessuna');
  const cvEstero = coprod.find((d) => d !== accordoEstero && prova(LESSICO.curriculumSocietario, d.testo) && (estereIn(d.testo).size || prova(LESSICO.paesiEsteri, d.testo)));
  metti('coproduttori_esteri_rilevanza_provata', !!cvEstero, cvEstero ? `«${cvEstero.nome}»` : 'manca il curriculum societario del coproduttore estero');
  const estero = distr.find((d) => prova(LESSICO.venditeEstere, d.testo));
  metti('distribuzione_internazionale_firmata', !!estero && firmeDocumento(estero.testo).soggetti >= 2, estero ? `«${estero.nome}»` : 'nessun contratto con un venditore estero');
  metti('venditore_estero_qualifica_provata', !!estero && [...distr, ...DOC(docs, 'altro')].some((d) => prova(LESSICO.venditeEstere, d.testo) && prova(LESSICO.elencoTitoli, d.testo)), estero ? 'listino del venditore estero' : 'nessun venditore estero');
  metti('documenti_del_criterio', null, 'si conta criterio per criterio');

  // --- risposte del produttore alle domande chiuse
  const confermati = p.fattiConfermati && typeof p.fattiConfermati === 'object' ? p.fattiConfermati : {};
  for (const [k, valore] of Object.entries(confermati)) {
    if (!(k in FATTI) || valore == null) continue;
    const tipo = FATTI[k].tipo;
    if ((tipo === 'booleano' && typeof valore === 'boolean') || (tipo !== 'booleano' && num(valore) != null)) metti(k, valore, 'confermato dal produttore');
  }

  return {
    valori: v, origini: o,
    documenti: { totale: docs.length, leggibili: leggibili.length, tipi: [...new Set(leggibili.map((d) => d.tipo))], pagine: leggibili.reduce((a, d) => a + paginePer(d), 0) },
    piano: { righe, fabbisogno, documentato: cop.documentato },
    persone: { artistici: artistici.length || artTot, tecnici: tecnici.length || crewTot, nominativi: artistici.length + tecnici.length > 0 },
  };
}

/** Fatti di giudizio non ancora determinati, con la domanda chiusa da porre al produttore. */
export function domandeAperte(fatti, famiglie = null) {
  const usati = new Set(REGOLE.filter((r) => !famiglie || famiglie.includes(r.famiglia)).flatMap((r) => [...r.tutti, ...r.almenoUno].map((c) => c[0])));
  return Object.entries(FATTI).filter(([k, f]) => f.domanda && usati.has(k) && fatti.valori[k] == null).map(([k, f]) => ({ fatto: k, domanda: f.domanda, origine: fatti.origini[k] }));
}

/* ================================================================== 2. regole */

const OPERATORI = {
  '=': (a, b) => a === b, '!=': (a, b) => a !== b,
  '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
};
export const OPERATORI_AMMESSI = Object.keys(OPERATORI);

// Una condizione: true, false, o null se il fatto non è determinato.
function condizione([fatto, op, valore], valori) {
  const x = valori[fatto];
  if (x == null) return null;
  return OPERATORI[op](x, valore);
}

/** Valuta una regola sui fatti: esito «certa», «esclusa» o «possibile», con i fatti che la decidono. */
export function valutaRegola(regola, valori) {
  const t = regola.tutti.map((c) => [c, condizione(c, valori)]);
  const u = regola.almenoUno.map((c) => [c, condizione(c, valori)]);
  const ignoti = [...t, ...u].filter(([, e]) => e === null).map(([c]) => c[0]);
  const esclusaDa = t.filter(([, e]) => e === false).map(([c]) => c[0]);
  const uOk = !u.length || u.some(([, e]) => e === true);
  const uNo = u.length > 0 && u.every(([, e]) => e === false);
  let esito;
  if (esclusaDa.length || uNo) esito = 'esclusa';
  else if (t.every(([, e]) => e === true) && uOk) esito = 'certa';
  else esito = 'possibile';
  return { esito, ignoti: [...new Set(ignoti)], esclusaDa };
}

/** Regole che valgono per una famiglia: le sue, oppure quelle generiche se la famiglia non è tarata. */
export function regoleFamiglia(famiglia) {
  return FAMIGLIE_TARATE.includes(famiglia) ? REGOLE.filter((r) => r.famiglia === famiglia) : REGOLE.filter((r) => r.famiglia === 'generica');
}

const intersezione = (fasce) => [Math.max(...fasce.map((f) => f[0])), Math.min(...fasce.map((f) => f[1]))];
const inviluppo = (fasce) => [Math.min(...fasce.map((f) => f[0])), Math.max(...fasce.map((f) => f[1]))];

/**
 * Compone le regole di una famiglia sui fatti dati, secondo COMPOSIZIONE (punti 1-3, 5, 7).
 * Restituisce le fasce come frazioni del massimo, le regole usate, il modo di composizione, la fiducia e il centro.
 */
export function componiRegole(famiglia, valori) {
  const regole = regoleFamiglia(famiglia);
  const esiti = regole.map((r) => ({ regola: r, ...valutaRegola(r, valori) }));
  const certe = esiti.filter((e) => e.esito === 'certa');
  const possibili = esiti.filter((e) => e.esito === 'possibile');
  let usate, attesa, rigorosa, modo, gradi = 0;
  if (certe.length === 1) { usate = certe; attesa = certe[0].regola.attesa; rigorosa = certe[0].regola.rigorosa; modo = 'unica'; }
  else if (certe.length > 1) {
    usate = certe;
    const a = intersezione(certe.map((e) => e.regola.attesa)), b = intersezione(certe.map((e) => e.regola.rigorosa));
    if (a[0] <= a[1] && b[0] <= b[1]) { attesa = a; rigorosa = b; modo = 'intersezione'; }
    else { attesa = inviluppo(certe.map((e) => e.regola.attesa)); rigorosa = inviluppo(certe.map((e) => e.regola.rigorosa)); modo = 'inviluppo-certe'; gradi = 1; }
  } else if (possibili.length) {
    usate = possibili;
    attesa = inviluppo(possibili.map((e) => e.regola.attesa)); rigorosa = inviluppo(possibili.map((e) => e.regola.rigorosa));
    modo = possibili.length === 1 ? 'possibile' : 'inviluppo-possibili'; gradi = 1;
  } else {
    // nessuna regola della famiglia descrive il dossier (fatti incoerenti tra loro): si ricade sulla regola generica
    const g = componiRegole('generica', valori);
    return { ...g, modo: 'ricaduta-generica', fiducia: 'bassa' };
  }
  rigorosa = [Math.min(rigorosa[0], attesa[0]), Math.min(rigorosa[1], attesa[1])];
  const peso = Math.max(1, Math.min(...usate.map((e) => FORZE[e.regola.forza]?.peso || 1)) - gradi);
  // centro della stima: la regola che si applica dando ai fatti non determinati il valore presunto
  const presunti = { ...valori };
  for (const [k, f] of Object.entries(FATTI)) if (presunti[k] == null && f.presunto !== undefined) presunti[k] = f.presunto;
  const conPresunti = regole.filter((r) => valutaRegola(r, presunti).esito === 'certa');
  const base = conPresunti.length ? intersezione(conPresunti.map((r) => r.attesa)) : attesa;
  const baseR = conPresunti.length ? intersezione(conPresunti.map((r) => r.rigorosa)) : rigorosa;
  const centro = base[0] <= base[1] ? (base[0] + base[1]) / 2 : (attesa[0] + attesa[1]) / 2;
  const centroR = baseR[0] <= baseR[1] ? (baseR[0] + baseR[1]) / 2 : (rigorosa[0] + rigorosa[1]) / 2;
  const entro = (x, f) => Math.min(f[1], Math.max(f[0], x));
  return {
    famiglia: FAMIGLIE_TARATE.includes(famiglia) ? famiglia : 'generica',
    attesa, rigorosa, modo, fiducia: FIDUCIE[peso],
    centro: entro(centro, attesa), centroRigoroso: entro(Math.min(centroR, centro), rigorosa),
    regole: usate.map((e) => ({ id: e.regola.id, esito: e.esito, quando: e.regola.quando, perche: e.regola.perche, evidenza: e.regola.evidenza, forza: e.regola.forza, riscontro: e.regola.riscontro, attesa: e.regola.attesa, rigorosa: e.regola.rigorosa, ignoti: e.ignoti })),
    regolaPresunta: conPresunti.map((r) => r.id),
    ignoti: [...new Set(usate.flatMap((e) => e.ignoti))],
  };
}

/* ================================================================== 3. ancore */

// Documenti leggibili che riguardano un criterio: quelli che il bando gli assegna, altrimenti quelli della sua famiglia.
function documentiCriterio(criterio, docs) {
  return docs.filter((d) => testoUtile(d) && (criterio.documenti?.length ? criterio.documenti.includes(d.tipo) : tipoPerId(d.tipo).famiglie.includes(criterio.famiglia))).length;
}

const passo = (x) => r1(x);
function inPunti(frazioni, criterio) {
  const [a, b] = frazioni.map((f) => f * criterio.max);
  if (criterio.tipo === 'discreto' && criterio.valori?.length) {
    const ammessi = criterio.valori.map((x) => x.punti).sort((x, y) => x - y);
    const dentro = ammessi.filter((x) => x >= a - 1e-9 && x <= b + 1e-9);
    if (dentro.length) return { min: dentro[0], max: dentro[dentro.length - 1] };
    const vicino = ammessi.reduce((best, x) => (Math.abs(x - (a + b) / 2) < Math.abs(best - (a + b) / 2) ? x : best), ammessi[0]);
    return { min: vicino, max: vicino };
  }
  return { min: passo(a), max: passo(b) };
}
// Nei criteri a punteggi fissi il centro è il valore ammesso più alto che non supera il centro della fascia (prudente).
function centroPunti(frazione, criterio, fascia) {
  const x = frazione * criterio.max;
  if (criterio.tipo === 'discreto' && criterio.valori?.length) {
    const ammessi = criterio.valori.map((v) => v.punti).filter((v) => v >= fascia.min - 1e-9 && v <= fascia.max + 1e-9).sort((a, b) => a - b);
    return ammessi.filter((v) => v <= x + 1e-9).pop() ?? ammessi[0] ?? fascia.min;
  }
  return Math.min(fascia.max, Math.max(fascia.min, passo(x)));
}

// Il massimo mai osservato in una sezione nelle graduatorie reali caricate (ultima finestra e finanziati di tutte le finestre).
export function massimoOsservato(bando, categoriaId, sezioneId) {
  const a = statisticheEsiti(bando, categoriaId)?.sezioni?.[sezioneId]?.max;
  const b = statisticheFinanziati(bando, categoriaId)?.sezioni?.[sezioneId]?.max;
  const v = [a, b].filter((x) => num(x) != null);
  return v.length ? Math.max(...v) : null;
}

function spiegazioneAncora(a) {
  const prima = a.regole[0];
  const modo = {
    unica: `Regola «${prima.id}».`,
    intersezione: `Più regole valgono insieme: si usa la parte comune delle loro fasce (${a.regole.map((r) => r.id).join(', ')}).`,
    'inviluppo-certe': `Più regole valgono ma le fasce non si sovrappongono: si usa l’intervallo che le contiene tutte (${a.regole.map((r) => r.id).join(', ')}).`,
    possibile: `Regola «${prima.id}», che dipende da un fatto ancora da verificare.`,
    'inviluppo-possibili': `Dipende da fatti da verificare leggendo (${a.ignoti.map((k) => k.replace(/_/g, ' ')).join(', ')}): l’intervallo comprende tutte le situazioni possibili.`,
    'ricaduta-generica': 'Nessuna regola della famiglia descrive il dossier: si usa la regola generica.',
    tabella: 'Punti assegnati dalla tabella del criterio alla copertura di ciascuna lettura.',
  }[a.modo] || '';
  return `${modo} ${a.modo === 'unica' || a.modo === 'possibile' || a.modo === 'tabella' ? prima.perche : ''}`.trim();
}

/**
 * Ancore di taratura per ogni criterio valutato da Claude.
 * Restituisce { versione, bandoId, categoriaId, criteri: { [id]: ancora }, sezioni: { [id]: … }, domande, limiti, fatti }.
 * Un’ancora: { id, nome, sezione, famiglia, massimo, tipo, atteso:{min,max}, rigoroso:{min,max}, centro, centroRigoroso,
 *   frazioni, regole, modo, fiducia, spiegazione, tabella?, ridotta?, bloccante? } — tutto in punti tranne `frazioni`.
 */
export function ancoreTaratura(bando, categoriaId, progetto, fattiPronti = null) {
  const fatti = fattiPronti || fattiDossier(bando, { ...progetto, categoriaId });
  const griglia = getGriglia(bando, categoriaId);
  const categoria = getCategoria(bando, categoriaId);
  const docs = (progetto?.documenti || []).filter(Boolean);
  const dati = progetto?.dati || {};
  const criteri = {}, sezioni = {};
  for (const sez of griglia.sezioni) {
    const proprie = [];
    for (const c of sez.criteri.filter(criterioAGiudizio)) {
      const valori = { ...fatti.valori, documenti_del_criterio: documentiCriterio(c, docs) };
      const comp = componiRegole(c.famiglia, valori);
      const a = {
        id: c.id, nome: c.nome, sezione: sez.id, famiglia: c.famiglia, famigliaRegole: comp.famiglia, massimo: c.max, tipo: c.tipo,
        frazioni: { atteso: comp.attesa.map((x) => arrot(x)), rigoroso: comp.rigorosa.map((x) => arrot(x)) },
        atteso: inPunti(comp.attesa, c), rigoroso: inPunti(comp.rigorosa, c),
        regole: comp.regole, modo: comp.modo, fiducia: comp.fiducia, ignoti: comp.ignoti,
      };
      a.centro = centroPunti(comp.centro, c, a.atteso);
      a.centroRigoroso = centroPunti(comp.centroRigoroso, c, a.rigoroso);
      // tabella sulla copertura finanziaria: i punti vengono dalla tabella, la fascia della regola resta come controllo
      if (c.tipo === 'fasce' && c.metrica === 'copertura' && c.fasce?.length && (fatti.valori.copertura_attesa != null || dati.ripreseIniziate)) {
        const flags = { ripreseIniziate: !!dati.ripreseIniziate };
        const pa = puntiFascia(c, fatti.valori.copertura_attesa == null ? null : fatti.valori.copertura_attesa * 100, flags);
        const pr = puntiFascia(c, fatti.valori.copertura_rigorosa == null ? null : fatti.valori.copertura_rigorosa * 100, flags);
        const att = pa.mancante ? 0 : pa.punti, rig = Math.min(att, pr.mancante ? 0 : pr.punti);
        a.tabella = { coperturaAttesa: fatti.valori.copertura_attesa, coperturaRigorosa: fatti.valori.copertura_rigorosa, fasciaAttesa: pa.fascia, fasciaRigorosa: pr.fascia, controllo: { ...a.atteso } };
        a.atteso = { min: att, max: att }; a.rigoroso = { min: rig, max: rig }; a.centro = att; a.centroRigoroso = rig; a.modo = 'tabella';
      }
      a.rigoroso = { min: Math.min(a.rigoroso.min, a.atteso.min), max: Math.min(a.rigoroso.max, a.atteso.max) };
      a.centroRigoroso = Math.min(a.centroRigoroso, a.centro, a.rigoroso.max);
      if (comp.regole.some((r) => r.id === 'scrittura-testo-assente' && r.esito === 'certa')) a.bloccante = 'Manca il testo dell’opera: il criterio non si stima, va caricato l’allegato.';
      a.spiegazione = spiegazioneAncora(a);
      criteri[c.id] = a; proprie.push(a);
    }
    // punto 6: la somma dei massimi attesi non supera il massimo mai osservato nella sezione
    const tetto = massimoOsservato(bando, categoriaId, sez.id);
    const calcolati = sez.criteri.filter((c) => !criterioAGiudizio(c)).reduce((s, c) => s + (valutaQuantitativo(c, dati, bando).max || 0), 0);
    let eccedenza = tetto == null ? 0 : r1(proprie.reduce((s, a) => s + a.atteso.max, 0) + calcolati - tetto);
    if (eccedenza > 0) {
      const riducibili = proprie.filter((a) => a.tipo === 'qualitativo' && a.atteso.max > a.atteso.min);
      const larghezza = riducibili.reduce((s, a) => s + (a.atteso.max - a.atteso.min), 0);
      for (const a of riducibili) {
        const taglio = Math.min(a.atteso.max - a.atteso.min, r1((eccedenza * (a.atteso.max - a.atteso.min)) / larghezza));
        if (taglio <= 0) continue;
        a.atteso = { min: a.atteso.min, max: r1(a.atteso.max - taglio) };
        a.ridotta = taglio;
        a.rigoroso = { min: Math.min(a.rigoroso.min, a.atteso.min), max: Math.min(a.rigoroso.max, a.atteso.max) };
        a.centro = Math.min(a.centro, a.atteso.max); a.centroRigoroso = Math.min(a.centroRigoroso, a.centro, a.rigoroso.max);
      }
    }
    const somma = (f) => r1(proprie.reduce((s, a) => s + f(a), 0));
    sezioni[sez.id] = {
      id: sez.id, nome: sez.nome, massimo: sez.max, soglia: categoria.soglie?.[sez.id] ?? null, tetto,
      criteri: proprie.map((a) => a.id), punti: r1(calcolati),
      atteso: { min: somma((a) => a.atteso.min), max: somma((a) => a.atteso.max) },
      rigoroso: { min: somma((a) => a.rigoroso.min), max: somma((a) => a.rigoroso.max) },
    };
  }
  const famiglie = [...new Set(Object.values(criteri).map((a) => a.famiglia))];
  return {
    versione: VERSIONE_TARATURA, bandoId: bando.id, categoriaId,
    criteri, sezioni, domande: domandeAperte(fatti, famiglie), limiti: LIMITI,
    fatti: { valori: fatti.valori, origini: fatti.origini, piano: fatti.piano },
  };
}

/** Versione compatta delle ancore, da salvare nella valutazione. */
export function ancoreCompatte(ancore) {
  if (!ancore) return null;
  const criteri = {};
  for (const [id, a] of Object.entries(ancore.criteri)) {
    criteri[id] = { id, nome: a.nome, sezione: a.sezione, massimo: a.massimo, atteso: a.atteso, rigoroso: a.rigoroso, centro: a.centro, centroRigoroso: a.centroRigoroso,
      fiducia: a.fiducia, modo: a.modo, spiegazione: a.spiegazione, regole: a.regole.map((r) => ({ id: r.id, quando: r.quando, forza: r.forza, esito: r.esito })),
      ...(a.bloccante ? { bloccante: a.bloccante } : {}), ...(a.tabella ? { tabella: { coperturaAttesa: a.tabella.coperturaAttesa, coperturaRigorosa: a.tabella.coperturaRigorosa } } : {}) };
  }
  return { versione: ancore.versione, bandoId: ancore.bandoId, categoriaId: ancore.categoriaId, criteri, domande: (ancore.domande || []).map((d) => ({ fatto: d.fatto, domanda: d.domanda })) };
}

/* ================================================================== istruzioni a Claude */

const intervallo = (f) => (f.min === f.max ? `${fmt(f.min)} punti` : `${fmt(f.min)}–${fmt(f.max)} punti`);

/** Il brano da aggiungere alle istruzioni della sezione (parametro «ancore» di promptSezione). Vuoto se la sezione non ha ancore. */
export function testoAncore(ancore, sezione) {
  const sid = typeof sezione === 'object' ? sezione?.id : sezione;
  const lista = Object.values(ancore?.criteri || {}).filter((a) => a.sezione === sid);
  if (!lista.length) return '';
  const righe = lista.map((a) => {
    const usati = [...new Set(a.regole.flatMap((r) => { const reg = REGOLE.find((x) => x.id === r.id); return reg ? [...reg.tutti, ...reg.almenoUno].map((c) => c[0]) : []; }))];
    const fatti = usati.filter((k) => k !== 'documenti_del_criterio' && ancore.fatti?.valori?.[k] != null && ancore.fatti?.origini?.[k]).slice(0, 5).map((k) => `${k.replace(/_/g, ' ')}: ${ancore.fatti.origini[k]}`);
    const tab = a.tabella ? `\n  Copertura attesa ${pctTesto(a.tabella.coperturaAttesa)} (fascia «${a.tabella.fasciaAttesa || '—'}»), copertura rigorosa ${pctTesto(a.tabella.coperturaRigorosa)} (fascia «${a.tabella.fasciaRigorosa || '—'}»): il tuo «valore» atteso dovrebbe stare vicino alla prima.` : '';
    const domande = a.ignoti.length ? `\n  Da verificare leggendo: ${a.ignoti.map((k) => FATTI[k]?.domanda || FATTI[k]?.descrizione).filter(Boolean).join(' ')}` : '';
    return `- Criterio ${a.id} — ${a.nome} (massimo ${fmt(a.massimo)}): ATTESA ${intervallo(a.atteso)} · RIGOROSA ${intervallo(a.rigoroso)} · fiducia ${a.fiducia}.${tab}
  Perché: ${a.spiegazione}${fatti.length ? `\n  Fatti rilevati: ${fatti.join('; ')}.` : ''}${domande}${a.bloccante ? `\n  ${a.bloccante}` : ''}`;
  });
  const famiglie = new Set(lista.map((a) => a.famiglia));
  const errori = ERRORI_DA_EVITARE.filter((e) => e.famiglie.some((f) => famiglie.has(f))).map((e) => `- Errore: ${e.errore} Invece: ${e.correzione}`);
  return `\n\nTARATURA SUI CASI REALI — fasce per questo dossier (regole di Clockwise, versione ${ancore.versione})
Le fasce sono calcolate dai fatti verificabili del dossier con regole ricavate dal confronto tra simulazioni e punteggi reali della Commissione. Il «punteggio» di ogni criterio va nella fascia ATTESA, il «rigoroso» nella fascia RIGOROSA.
Puoi uscire da una fascia solo se nei documenti trovi un elemento preciso che la regola non considera: in quel caso scrivi nella motivazione «Fuori fascia:» seguito dal riferimento esatto (file, pagina, scena o voce) e dal motivo. Senza un riferimento preciso resta nella fascia.
${righe.join('\n')}${errori.length ? `\n\nERRORI DI LETTURA DA NON RIPETERE (osservati nella prova su un dossier reale)\n${errori.join('\n')}` : ''}`;
}

/* ================================================================== scostamenti */

const TOLLERANZA = 0.05;

/**
 * Dopo la valutazione: i criteri in cui la media dei commissari esce dalla fascia attesa.
 * risultato = componiRisultato(); ancore = ancoreTaratura() o ancoreCompatte(). Non modifica i punteggi.
 */
export function scostamenti(risultato, ancore) {
  const criteri = [];
  for (const sez of risultato?.sezioni || []) for (const c of sez.criteri) {
    const a = ancore?.criteri?.[c.id];
    if (!a || c.fonte !== 'commissione' || c.punti == null) continue;
    const sopra = c.punti > a.atteso.max + TOLLERANZA, sotto = c.punti < a.atteso.min - TOLLERANZA;
    const stato = sopra ? 'sopra' : sotto ? 'sotto' : 'dentro';
    const scarto = sopra ? r1(c.punti - a.atteso.max) : sotto ? r1(c.punti - a.atteso.min) : 0;
    const frazione = a.massimo ? arrot(Math.abs(scarto) / a.massimo) : 0;
    const rig = c.rigoroso ?? null;
    const statoRigoroso = rig == null ? null : rig > a.rigoroso.max + TOLLERANZA ? 'sopra' : rig < a.rigoroso.min - TOLLERANZA ? 'sotto' : 'dentro';
    const motivati = c.giudizi.filter((g) => /fuori fascia/i.test(g.motivazione || '')).length;
    let spiegazione;
    if (stato === 'dentro') spiegazione = `La media dei commissari (${fmt(c.punti)}) è nella fascia attesa ${intervallo(a.atteso)}.`;
    else {
      spiegazione = `La media dei commissari (${fmt(c.punti)}) è ${stato === 'sopra' ? 'sopra' : 'sotto'} la fascia attesa ${intervallo(a.atteso)} di ${fmt(Math.abs(scarto))} punti. `
        + (stato === 'sopra' ? 'Nei casi reali la Commissione non è andata così in alto con documenti di questo tipo: ' : 'Nei casi reali la Commissione non è scesa così in basso con documenti di questo tipo: ')
        + `${a.spiegazione} `
        + (motivati ? `${motivati} ${motivati === 1 ? 'commissario motiva' : 'commissari motivano'} l’uscita dalla fascia con un riferimento ai documenti: leggilo prima di decidere.` : 'Nessun commissario ha motivato l’uscita dalla fascia con un riferimento preciso: considera la fascia come la previsione più probabile.');
    }
    criteri.push({
      id: c.id, nome: c.nome, sezione: sez.id, massimo: a.massimo, media: c.punti, mediaRigorosa: rig,
      atteso: a.atteso, rigoroso: a.rigoroso, centro: a.centro, stato, statoRigoroso, scarto, frazione,
      gravita: stato === 'dentro' ? null : frazione > 0.1 ? 'marcato' : 'lieve',
      motivati, fiducia: a.fiducia, regole: (a.regole || []).map((r) => r.id), spiegazione,
    });
  }
  const fuori = criteri.filter((x) => x.stato !== 'dentro');
  const sezioni = {};
  for (const x of criteri) {
    const s = (sezioni[x.sezione] = sezioni[x.sezione] || { id: x.sezione, criteri: 0, fuori: 0, scarto: 0 });
    s.criteri++; if (x.stato !== 'dentro') { s.fuori++; s.scarto = r1(s.scarto + x.scarto); }
  }
  const sintesi = !criteri.length ? 'Nessun criterio valutato da confrontare con la taratura.'
    : !fuori.length ? `Tutti i ${criteri.length} criteri valutati sono nella fascia attesa dalle regole di taratura.`
      : `${fuori.length} ${fuori.length === 1 ? 'criterio' : 'criteri'} su ${criteri.length} fuori dalla fascia attesa: ${fuori.map((x) => `${x.id} ${x.stato === 'sopra' ? 'sopra' : 'sotto'} di ${fmt(Math.abs(x.scarto))}`).join(', ')}.`;
  return { versione: ancore?.versione || VERSIONE_TARATURA, criteri, fuori: fuori.length, valutati: criteri.length, marcati: fuori.filter((x) => x.gravita === 'marcato').length, sezioni, sintesi };
}

/* ================================================================== stima senza Claude */

/**
 * Previsione senza Claude: criteri a giudizio al centro della fascia attesa (regola con i fatti presunti), criteri quantitativi
 * con il calcolo esistente. Totale, minimo e massimo (estremi delle fasce), lettura rigorosa, sezioni sotto il minimo.
 */
export function stimaDaRegole(bando, categoriaId, progetto, ancorePronte = null) {
  const anc = ancorePronte || ancoreTaratura(bando, categoriaId, progetto);
  const griglia = getGriglia(bando, categoriaId);
  const categoria = getCategoria(bando, categoriaId);
  const dati = progetto?.dati || {};
  const sezioni = griglia.sezioni.map((sez) => {
    const criteri = sez.criteri.map((c) => {
      const a = anc.criteri[c.id];
      if (a) return { id: c.id, nome: c.nome, massimo: c.max, fonte: 'regole', punti: a.centro, min: a.atteso.min, max: a.atteso.max, rigoroso: a.centroRigoroso, fiducia: a.fiducia, bloccante: a.bloccante || null };
      const q = valutaQuantitativo(c, dati, bando);
      return { id: c.id, nome: c.nome, massimo: c.max, fonte: 'calcolo', punti: q.punti, min: q.min, max: q.max, rigoroso: q.punti, mancante: q.mancante };
    });
    const somma = (k) => r1(criteri.reduce((s, c) => s + (c[k] ?? 0), 0));
    const soglia = categoria.soglie?.[sez.id] ?? null;
    const s = { id: sez.id, nome: sez.nome, massimo: sez.max, soglia, punti: somma('punti'), min: somma('min'), max: somma('max'), rigoroso: somma('rigoroso'), criteri };
    s.superata = soglia == null || s.punti >= soglia;
    s.fragile = soglia != null && s.superata && s.rigoroso < soglia;
    return s;
  });
  const somma = (k) => r1(sezioni.reduce((s, x) => s + x[k], 0));
  const totale = somma('punti'), min = somma('min'), max = somma('max'), rigoroso = somma('rigoroso');
  const sotto = sezioni.filter((s) => !s.superata).map((s) => s.id);
  const bloccanti = Object.values(anc.criteri).filter((a) => a.bloccante).map((a) => `${a.id}: ${a.bloccante}`);
  const datiMancanti = sezioni.flatMap((s) => s.criteri).filter((c) => c.mancante).map((c) => c.id);
  const ammissibile = totale >= (bando.sogliaTotale || 0) && !sotto.length;
  const fiducie = Object.values(anc.criteri).map((a) => a.fiducia);
  return {
    versione: anc.versione, totale, min, max, rigoroso, sezioni, sotto, bloccanti, datiMancanti,
    esito: bloccanti.length ? 'incompleta' : !ammissibile ? 'sotto_soglia' : rigoroso < (bando.sogliaTotale || 0) || sezioni.some((s) => s.fragile) ? 'a_rischio' : 'ammissibile',
    ammissibile, sogliaTotale: bando.sogliaTotale || 0,
    fiducia: fiducie.includes('bassa') ? 'bassa' : fiducie.includes('media') ? 'media' : fiducie.length ? 'alta' : null,
    criteriBassaFiducia: Object.values(anc.criteri).filter((a) => a.fiducia === 'bassa').length,
    domande: anc.domande,
  };
}
