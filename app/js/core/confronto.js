// Confronto dello stesso progetto su più bandi: «Dove conviene presentare questo progetto?».
// Logica pura: nessun accesso all'interfaccia, alla rete o all'archivio. Tutto ciò che esce da qui è un
// orientamento calcolato dai numeri del dossier e dalle regole dei bandi, con le ipotesi dichiarate per esteso.

import { FAMIGLIE, finestraDiRiferimento } from './bandi/schema.js';
import { componiRisultato, valutaQuantitativo, r1, formati } from './scoring.js';
import { valutazioniPerCriterio } from './engine.js';

const { fmt, euro } = formati;
const GIORNO = 86400000;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const semplice = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const giorniTra = (da, a) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / GIORNO);
const tra = (n) => (n === 0 ? 'oggi' : n === 1 ? 'domani' : `tra ${n} giorni`);
const quantiGiorni = (n) => (n === 1 ? '1 giorno' : `${n} giorni`);
const dataEstesa = (iso) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
const elencoE = (voci) => (voci.length <= 1 ? voci.join('') : `${voci.slice(0, -1).join(', ')} e ${voci.at(-1)}`);
const quota = (parte, tutto) => (tutto > 0 ? r1((parte / tutto) * 100) : 0);

/** Nomi brevi delle famiglie di criteri (il vocabolario completo è FAMIGLIE di bandi/schema.js). */
export const NOMI_FAMIGLIA = {
  scrittura: 'Scrittura', visione: 'Regia e visione', territorio_contenuto: 'Territorio nel racconto',
  societa: 'Società di produzione', artistica: 'Regista, autori e cast', tecnica: 'Troupe',
  ricaduta_lavoro: 'Professionisti del territorio', ricaduta_spesa: 'Spesa e giorni sul territorio',
  piano_finanziario: 'Piano finanziario', distribuzione: 'Distribuzione', internazionale: 'Estero',
  sostenibilita: 'Sostenibilità e parità', formazione: 'Giovani e opere prime', altro: 'Altri criteri',
};

/** Le famiglie raccolte in cinque aree, sempre nello stesso ordine: servono a confrontare i profili a colpo d'occhio. */
export const AREE = [
  { id: 'progetto', nome: 'Progetto artistico', famiglie: ['scrittura', 'visione', 'territorio_contenuto'] },
  { id: 'squadra', nome: 'Società e squadra', famiglie: ['societa', 'artistica', 'tecnica', 'formazione'] },
  { id: 'ricadute', nome: 'Ricadute sul territorio', famiglie: ['ricaduta_lavoro', 'ricaduta_spesa'] },
  { id: 'mercato', nome: 'Finanza e mercato', famiglie: ['piano_finanziario', 'distribuzione', 'internazionale'] },
  { id: 'altro', nome: 'Altri criteri', famiglie: ['sostenibilita', 'altro'] },
];

const famigliaDi = (c) => (FAMIGLIE[c?.famiglia] ? c.famiglia : 'altro');
// «Dai numeri»: criteri a fasce che il motore calcola da solo, senza il giudizio della Commissione.
const daiNumeri = (c) => c?.tipo === 'fasce' && !c.giudizio && Array.isArray(c.fasce) && c.fasce.length > 0 && !!c.metrica;
const simulabile = (b) => !!b && b.simulabile !== false && Array.isArray(b.categorie) && b.categorie.length > 0
  && b.categorie.some((c) => b.griglie?.[c.griglia]?.sezioni?.length);
const criteriDi = (griglia) => (griglia?.sezioni || []).flatMap((s) => (s.criteri || []).map((c) => ({ ...c, sezione: s.id })));

/* ------------------------------------------------------------------ categoria più adatta */

const TIPI_OPERA = [
  ['cortometraggio', /\bcort[oi]\b|cortometragg/],
  ['documentario', /document/],
  ['serie', /\bseri[ea]\b|\bserial|puntat|episod/],
  ['animazione', /animazion/],
  ['film', /\bfilm\b|lungometragg|\bfiction\b|cinematografic/],
];
const PESO_TIPO = { cortometraggio: 4, documentario: 4, animazione: 3, serie: 2, film: 2 };
// Tipologie che una categoria riserva a sé: un film di finzione non va tra i documentari né tra i cortometraggi.
const ESCLUSIVE = ['cortometraggio', 'documentario'];
const tipiIn = (testo) => { const t = semplice(testo); return TIPI_OPERA.filter(([, re]) => re.test(t)).map(([id]) => id); };

/** Tipologie riconosciute nel progetto: dalla «Tipologia» dei Dati chiave e, se manca, dalla categoria scelta nel dossier. */
export function tipiProgetto(progetto, bandi = []) {
  const d = progetto?.dati || {};
  let tipi = tipiIn(d.tipologiaOpera);
  if (!tipi.length) {
    const casa = (bandi || []).find((b) => b?.id === progetto?.bandoId);
    const cat = casa?.categorie?.find((c) => c.id === progetto?.categoriaId);
    if (cat) tipi = tipiIn(`${cat.id} ${cat.nome}`);
  }
  if (d.animazione && !tipi.includes('animazione')) tipi = [...tipi, 'animazione'];
  return tipi;
}

function limitiDurata(cat) {
  const v = [];
  if (num(cat.durataMin) != null && cat.durataMin > 0) v.push(`almeno ${fmt(cat.durataMin)} minuti`);
  if (num(cat.durataMaxEsclusa) != null && cat.durataMaxEsclusa > 0) v.push(`meno di ${fmt(cat.durataMaxEsclusa)} minuti`);
  return v.join(', ');
}
function durataAmmessa(cat, durata) {
  if (durata == null) return null; // non verificabile
  if (num(cat.durataMin) != null && cat.durataMin > 0 && durata < cat.durataMin) return false;
  if (num(cat.durataMaxEsclusa) != null && cat.durataMaxEsclusa > 0 && durata >= cat.durataMaxEsclusa) return false;
  return true;
}

/**
 * Categoria del bando più adatta al progetto. Per il bando del dossier vale quella già scelta; per gli altri contano
 * i limiti di durata (vincolo) e la tipologia dell'opera (preferenza). Se più categorie restano alla pari si prende
 * la prima compatibile e lo si dice (ambigua: true).
 * @returns {{ id, nome, compatibile: boolean, ambigua: boolean, scelta: 'dossier'|'automatica', motivo: string, alternative: {id,nome}[] } | null}
 */
export function categoriaAdatta(progetto, bando, bandi = []) {
  const categorie = (bando?.categorie || []).filter((c) => bando.griglie?.[c.griglia]?.sezioni?.length);
  if (!categorie.length) return null;
  const durata = num(progetto?.dati?.durataMin);
  if (progetto?.bandoId === bando.id) {
    const sua = categorie.find((c) => c.id === progetto.categoriaId);
    if (sua) {
      const ok = durataAmmessa(sua, durata);
      return {
        id: sua.id, nome: sua.nome, compatibile: ok !== false, ambigua: false, scelta: 'dossier', alternative: [],
        motivo: ok === false ? `È la categoria scelta nel dossier, ma chiede ${limitiDurata(sua)} e l’opera ne dura ${fmt(durata)}.` : 'È la categoria scelta nel dossier.',
      };
    }
  }
  const tipi = tipiProgetto(progetto, bandi);
  const valutate = categorie.map((c, i) => {
    const suoi = tipiIn(`${c.id} ${c.nome}`);
    const comuni = suoi.filter((t) => tipi.includes(t));
    const estranee = tipi.length ? suoi.filter((t) => ESCLUSIVE.includes(t) && !tipi.includes(t)) : [];
    return { c, i, durata: durataAmmessa(c, durata), comuni, suoi, affinita: comuni.reduce((a, t) => a + PESO_TIPO[t], 0) - 3 * estranee.length };
  });
  const ammesse = valutate.filter((v) => v.durata !== false);
  if (!ammesse.length) {
    const migliore = [...valutate].sort((a, b) => b.affinita - a.affinita || a.i - b.i)[0];
    return {
      id: migliore.c.id, nome: migliore.c.nome, compatibile: false, ambigua: false, scelta: 'automatica', alternative: [],
      motivo: `Nessuna categoria di questo bando ammette un’opera di ${fmt(durata)} minuti: «${migliore.c.nome}» chiede ${limitiDurata(migliore.c) || 'una durata diversa'}.`,
    };
  }
  const top = Math.max(...ammesse.map((v) => v.affinita));
  const pari = ammesse.filter((v) => v.affinita === top);
  const scelta = pari[0];
  const ambigua = pari.length > 1;
  const motivi = [];
  if (ambigua) {
    motivi.push(`${pari.length} categorie sono compatibili allo stesso modo (${pari.map((v) => `«${v.c.nome}»`).join(', ')}): è stata presa la prima. Controlla sull’avviso quale si applica.`);
  } else if (scelta.comuni.length) {
    motivi.push(`Corrisponde alla tipologia dell’opera${durata != null && limitiDurata(scelta.c) ? ` e ai limiti di durata (${limitiDurata(scelta.c)}; l’opera dura ${fmt(durata)} minuti)` : ''}.`);
  } else if (categorie.length === 1) {
    motivi.push('È l’unica categoria del bando.');
  } else if (ammesse.length === 1) {
    motivi.push(`È l’unica categoria che ammette un’opera di ${fmt(durata)} minuti (${limitiDurata(scelta.c)}).`);
  } else {
    motivi.push('È la categoria che più si avvicina alla tipologia dell’opera.');
  }
  if (!ambigua && tipi.length && scelta.suoi.length && !scelta.comuni.length) motivi.push('La tipologia indicata nei Dati chiave è diversa dal nome della categoria: verifica sull’avviso.');
  if (durata == null && categorie.some((c) => limitiDurata(c))) motivi.push('Durata dell’opera non indicata: i limiti di durata non sono stati verificati.');
  if (!tipi.length && categorie.length > 1) motivi.push('Tipologia dell’opera non indicata nei Dati chiave.');
  return {
    id: scelta.c.id, nome: scelta.c.nome, compatibile: true, ambigua, scelta: 'automatica', motivo: motivi.join(' '),
    alternative: ammesse.filter((v) => v !== scelta).map((v) => ({ id: v.c.id, nome: v.c.nome })),
  };
}

/* ------------------------------------------------------------------ stato e finestra */

const ORDINE_STATO = { aperta: 0, futura: 1, attesa: 2, chiusa: 3, sconosciuta: 4 };

/**
 * Stato del bando rispetto a oggi: finestra aperta, futura, attesa (chiusa ma con un'edizione successiva annunciata),
 * chiusa, oppure senza date. `giorni` sono quelli che mancano alla chiusura (aperta) o all'apertura (futura),
 * o quelli passati dalla chiusura (chiusa, attesa).
 */
export function statoFinestra(bando, oggi = new Date().toISOString().slice(0, 10)) {
  // i bandi letti da PDF possono avere finestre incomplete: si tengono solo quelle con una data di chiusura valida
  const dataValida = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const finestre = (Array.isArray(bando?.finestre) ? bando.finestre : []).filter((x) => x && dataValida(x.al)).map((x) => ({ ...x, dal: dataValida(x.dal) ? x.dal : null }));
  const f = finestraDiRiferimento({ finestre }, oggi);
  const p = bando?.prossimaEdizione?.anno ? { anno: bando.prossimaEdizione.anno, periodoAtteso: bando.prossimaEdizione.periodoAtteso || '' } : null;
  const attesa = (prossima) => `prossima edizione attesa nel ${prossima.anno}${prossima.periodoAtteso ? ` (${prossima.periodoAtteso})` : ''}`;
  if (!f) {
    if (bando?.stato === 'aperto') return { condizione: 'aperta', anno: null, dal: null, al: null, giorni: null, prossima: p, testo: 'Aperto: scadenza non indicata' };
    if (p || bando?.stato === 'atteso') return { condizione: 'attesa', anno: null, dal: null, al: null, giorni: null, prossima: p, testo: p ? `Atteso: ${attesa(p)}` : 'Atteso: date non ancora pubblicate' };
    if (bando?.stato === 'sospeso') return { condizione: 'chiusa', anno: null, dal: null, al: null, giorni: null, prossima: null, testo: 'Sospeso' };
    return { condizione: 'sconosciuta', anno: null, dal: null, al: null, giorni: null, prossima: null, testo: 'Date della finestra non disponibili' };
  }
  const base = { anno: f.anno, dal: f.dal || null, al: f.al, nota: f.nota || '', prossima: null };
  if (f.condizione === 'aperta') {
    const g = giorniTra(oggi, f.al);
    return { ...base, condizione: 'aperta', giorni: g, testo: g === 0 ? 'Aperto: chiude oggi' : `Aperto: chiude ${tra(g)}` };
  }
  if (f.condizione === 'futura') {
    const g = giorniTra(oggi, f.dal);
    return { ...base, condizione: 'futura', giorni: g, testo: `Apre ${tra(g)}` };
  }
  const g = giorniTra(f.al, oggi);
  if (p && p.anno > f.anno) return { ...base, condizione: 'attesa', giorni: g, prossima: p, testo: `Finestra ${f.anno} chiusa: ${attesa(p)}` };
  return { ...base, condizione: 'chiusa', giorni: g, testo: `Chiuso da ${quantiGiorni(g)}` };
}

/* ------------------------------------------------------------------ contributo e spesa minima */

/** Massimale del contributo per l'anno indicato; se quell'anno non c'è, l'ultimo noto prima (o il primo dopo). */
export function massimalePer(categoria, anno) {
  const m = categoria?.contributo?.massimali || {};
  const anni = Object.keys(m).map(Number).filter((a) => Number.isFinite(a) && num(m[a]) != null && m[a] > 0).sort((a, b) => a - b);
  if (!anni.length) return null;
  const a = num(Number(anno));
  if (a != null && anni.includes(a)) return { valore: m[a], anno: a, esatto: true };
  const scelto = a == null ? anni.at(-1) : (anni.filter((x) => x < a).at(-1) ?? anni[0]);
  return { valore: m[scelto], anno: scelto, esatto: false };
}

/**
 * Contributo massimo ottenibile = il minore tra (percentuale × costo di produzione) e il massimale dell'anno.
 * Se manca il costo non si calcola un importo: restano percentuale e massimale.
 */
export function contributoOttenibile(categoria, costoProduzione, anno) {
  const costo = num(costoProduzione) != null && costoProduzione > 0 ? costoProduzione : null;
  const percentuale = num(categoria?.contributo?.percentuale) != null && categoria.contributo.percentuale > 0 ? categoria.contributo.percentuale : null;
  const mass = massimalePer(categoria, anno);
  const teorico = costo != null && percentuale != null ? (costo * percentuale) / 100 : null;
  const ottenibile = teorico != null ? Math.min(teorico, mass?.valore ?? Infinity) : null;
  const limitatoDa = ottenibile == null ? null : (mass && mass.valore < teorico ? 'massimale' : 'percentuale');
  const parti = [];
  if (teorico != null) parti.push(`${fmt(percentuale)}% del costo di produzione (${euro(costo)}) = ${euro(teorico)}`);
  else if (percentuale != null) parti.push(`${fmt(percentuale)}% del costo di produzione: indica il costo nei Dati chiave per avere l’importo`);
  else parti.push('percentuale di contributo non indicata dal bando');
  if (mass) parti.push(`massimale ${mass.anno}${mass.esatto ? '' : ` (quello del ${anno} non è indicato)`}: ${euro(mass.valore)}`);
  else parti.push('nessun massimale indicato');
  if (ottenibile != null && mass) parti.push(`vale il minore dei due: ${euro(ottenibile)}`);
  return {
    percentuale, costo, teorico, massimale: mass?.valore ?? null, annoMassimale: mass?.anno ?? null, massimaleEsatto: mass ? mass.esatto : null,
    ottenibile, quotaSulCosto: ottenibile != null ? r1((ottenibile / costo) * 100) : null, limitatoDa,
    nota: categoria?.contributo?.nota || '', spiegazione: `${parti.join('; ')}.`,
  };
}

/** Spesa minima che il bando chiede sul proprio territorio, in euro, e confronto con quella indicata nei Dati chiave. */
export function spesaMinimaTerritorio(bando, costoProduzione, contributo, spesaIndicata) {
  const costo = num(costoProduzione), spesa = num(spesaIndicata);
  const dove = bando?.territorio ? `in ${bando.territorio}` : 'sul territorio';
  let regola = null, percentuale = null, minimo = null, testo = '';
  if (num(bando?.spesaTerritorioMinPct) > 0) {
    regola = 'sul_contributo'; percentuale = bando.spesaTerritorioMinPct;
    minimo = num(contributo) != null ? (contributo * percentuale) / 100 : null;
    testo = minimo != null ? `${fmt(percentuale)}% del contributo (${euro(contributo)}) = ${euro(minimo)}` : `${fmt(percentuale)}% del contributo: importo non calcolabile senza il costo di produzione`;
  } else if (num(bando?.spesaTerritorioMinSuCostoPct) > 0) {
    regola = 'sul_costo'; percentuale = bando.spesaTerritorioMinSuCostoPct;
    minimo = costo != null ? (costo * percentuale) / 100 : null;
    testo = minimo != null ? `${fmt(percentuale)}% del costo di produzione (${euro(costo)}) = ${euro(minimo)}` : `${fmt(percentuale)}% del costo di produzione: indica il costo nei Dati chiave`;
  }
  if (!regola) return null;
  const coperta = minimo != null && spesa != null ? spesa >= minimo : null;
  return {
    regola, percentuale, euro: minimo, spesaIpotizzata: spesa, coperta,
    oltreIlCosto: minimo != null && costo != null ? minimo > costo : false,
    spiegazione: `Spesa minima ${dove}: ${testo}.${spesa != null && minimo != null ? ` Nei Dati chiave la spesa sul territorio è ${euro(spesa)}: ${coperta ? 'basta' : 'non basta'}.` : ''}`,
  };
}

/* ------------------------------------------------------------------ profilo del bando */

/**
 * Profilo di una griglia: quanto pesa ogni famiglia di criteri sul punteggio massimo, raccolta anche per aree,
 * e quanta parte dei punti dipende dai numeri (calcolo) e quanta dal giudizio della Commissione.
 */
export function profiloGriglia(griglia) {
  const criteri = criteriDi(griglia);
  const massimo = r1(criteri.reduce((a, c) => a + (num(c.max) || 0), 0));
  const perFamiglia = new Map();
  for (const c of criteri) perFamiglia.set(famigliaDi(c), (perFamiglia.get(famigliaDi(c)) || 0) + (num(c.max) || 0));
  const famiglie = [...perFamiglia.entries()].map(([id, punti]) => ({ id, nome: NOMI_FAMIGLIA[id] || id, descrizione: FAMIGLIE[id] || '', punti: r1(punti), quota: quota(punti, massimo) }))
    .sort((a, b) => b.punti - a.punti || a.nome.localeCompare(b.nome, 'it'));
  const aree = AREE.map((a) => {
    const punti = r1(a.famiglie.reduce((s, f) => s + (perFamiglia.get(f) || 0), 0));
    return { id: a.id, nome: a.nome, punti, quota: quota(punti, massimo), famiglie: a.famiglie.filter((f) => perFamiglia.has(f)).map((f) => NOMI_FAMIGLIA[f]) };
  });
  const somma = (filtro) => r1(criteri.filter(filtro).reduce((a, c) => a + (num(c.max) || 0), 0));
  const numeri = somma(daiNumeri), fissi = somma((c) => c.tipo === 'discreto');
  const giudizio = r1(massimo - numeri);
  return {
    massimo, famiglie, aree,
    numeri: { punti: numeri, quota: quota(numeri, massimo) },
    giudizio: { punti: giudizio, quota: quota(giudizio, massimo) },
    fissi: { punti: fissi, quota: quota(fissi, massimo) },
  };
}

/* ------------------------------------------------------------------ punti dai numeri */

function calcolaNumeri(bando, griglia, dati) {
  const criteri = criteriDi(griglia).filter(daiNumeri).map((c) => {
    let r;
    try { r = valutaQuantitativo(c, dati, bando); } catch { r = { punti: 0, min: 0, max: 0, mancante: true, valoreTesto: '—', fascia: null, formula: '' }; }
    return {
      id: c.id, nome: c.nome, sezione: c.sezione, famiglia: famigliaDi(c), massimo: c.max, mancante: !!r.mancante,
      punti: r.mancante ? null : r.punti, min: r.mancante ? null : r.min, max: r.mancante ? null : r.max,
      valoreTesto: r.valoreTesto, fascia: r.fascia, formula: r.formula || '', prossima: r.prossima || null,
    };
  });
  const fatti = criteri.filter((c) => !c.mancante);
  const massimo = r1(criteri.reduce((a, c) => a + c.massimo, 0));
  const punti = r1(fatti.reduce((a, c) => a + c.punti, 0));
  return {
    punti, min: r1(fatti.reduce((a, c) => a + c.min, 0)), max: r1(fatti.reduce((a, c) => a + c.max, 0)),
    massimo, quota: quota(punti, massimo), criteri,
    principali: [...criteri].sort((a, b) => b.massimo - a.massimo).slice(0, 3),
    calcolati: fatti.length, mancanti: criteri.filter((c) => c.mancante).map((c) => c.id),
  };
}

function calcolaSoglie(bando, categoria, griglia, numeri) {
  const perId = new Map(numeri.criteri.map((c) => [c.id, c]));
  const massimo = num(bando.punteggioMassimo) || r1(criteriDi(griglia).reduce((a, c) => a + c.max, 0));
  const sezioni = (griglia.sezioni || []).map((s) => {
    const suoi = (s.criteri || []).filter((c) => perId.has(c.id)).map((c) => perId.get(c.id));
    const ottenuti = r1(suoi.reduce((a, c) => a + (c.punti || 0), 0));
    // per i dati mancanti si ragiona nel caso migliore: non si segnala un blocco che i numeri non dimostrano
    const casoMigliore = r1(suoi.reduce((a, c) => a + (c.mancante ? c.massimo : c.punti), 0));
    const maxNumeri = r1(suoi.reduce((a, c) => a + c.massimo, 0));
    const maxGiudizio = r1((s.criteri || []).filter((c) => !perId.has(c.id)).reduce((a, c) => a + (num(c.max) || 0), 0));
    const minimo = num(categoria.soglie?.[s.id]);
    return {
      id: s.id, nome: s.nome, massimo: s.max, minimo, numeri: { punti: ottenuti, massimo: maxNumeri }, giudizioMax: maxGiudizio,
      raggiungibile: minimo == null ? true : casoMigliore + maxGiudizio >= minimo,
    };
  });
  const totale = num(bando.sogliaTotale) || 0;
  const maxGiudizio = r1(sezioni.reduce((a, s) => a + s.giudizioMax, 0));
  const servono = Math.max(0, r1(totale - numeri.punti));
  const casoMigliore = r1(numeri.criteri.reduce((a, c) => a + (c.mancante ? c.massimo : c.punti), 0));
  return {
    totale, massimo, sezioni, irraggiungibili: sezioni.filter((s) => !s.raggiungibile).map((s) => s.id),
    // quanti punti a giudizio servono per arrivare alla soglia complessiva, dati i punti già certi dai numeri
    dalGiudizio: totale > 0 ? { punti: servono, su: maxGiudizio, quota: quota(servono, maxGiudizio), possibile: totale - casoMigliore <= maxGiudizio + 1e-9 } : null,
  };
}

/* ------------------------------------------------------------------ stima indicativa dalla valutazione del dossier */

/**
 * Frazione del massimo ottenuta per famiglia di criteri nella valutazione che il dossier ha già sul proprio bando.
 * @returns {{ bando, risultato, famiglie: Map<string,{punti,massimo,frazione}>, media: number } | null}
 */
export function frazioniDallaValutazione(progetto, bandi = []) {
  const casa = (bandi || []).find((b) => b?.id === progetto?.bandoId);
  if (!simulabile(casa) || !progetto?.valutazione) return null;
  let ris;
  try { ris = componiRisultato(casa, progetto.categoriaId, progetto.dati || {}, valutazioniPerCriterio(progetto.valutazione)); } catch { return null; }
  const cat = casa.categorie.find((c) => c.id === progetto.categoriaId) || casa.categorie[0];
  const famigliaPerId = new Map(criteriDi(casa.griglie[cat.griglia]).map((c) => [c.id, famigliaDi(c)]));
  const famiglie = new Map();
  let giudicati = 0, puntiGiudizio = 0, maxGiudizio = 0;
  for (const s of ris.sezioni) for (const c of s.criteri) {
    if (c.punti == null || c.mancante) continue;
    const f = famigliaPerId.get(c.id) || 'altro';
    const v = famiglie.get(f) || { punti: 0, massimo: 0 };
    v.punti += c.punti; v.massimo += c.massimo; famiglie.set(f, v);
    if (c.fonte === 'commissione') { giudicati++; puntiGiudizio += c.punti; maxGiudizio += c.massimo; }
  }
  if (!giudicati || !(maxGiudizio > 0)) return null; // senza almeno un criterio letto dai commissari non c'è nulla da riproiettare
  for (const v of famiglie.values()) v.frazione = v.massimo > 0 ? Math.min(1, v.punti / v.massimo) : 0;
  return { bando: casa, categoria: cat, risultato: ris, famiglie, media: Math.min(1, puntiGiudizio / maxGiudizio) };
}

/**
 * STIMA INDICATIVA: il punteggio per famiglia ottenuto sul bando del dossier viene riportato sul profilo di un altro
 * bando con la stessa frazione del massimo. I criteri che si calcolano dai numeri usano i punti calcolati; le famiglie
 * che il bando di partenza non valuta usano la frazione media dei criteri giudicati. Non è una valutazione.
 */
function stimaRiproiettata(base, bando, categoria, griglia, numeri, dati) {
  const perId = new Map(numeri.criteri.map((c) => [c.id, c]));
  const perFamiglia = new Map();
  let senzaRiscontro = 0, datiMancanti = 0;
  const puntiCriterio = new Map();
  const sezioni = (griglia.sezioni || []).map((s) => {
    let punti = 0;
    for (const c of s.criteri || []) {
      const fam = famigliaDi(c);
      let p, origine;
      const q = perId.get(c.id);
      if (q) {
        if (q.mancante) { p = 0; datiMancanti += c.max; origine = 'numeri'; } else { p = q.punti; origine = 'numeri'; }
      } else if (base.famiglie.has(fam)) { p = c.max * base.famiglie.get(fam).frazione; origine = 'valutazione'; }
      else {
        // famiglia che il bando di partenza non valuta: se il criterio ha comunque una regola a fasce si usano i dati
        // dichiarati, altrimenti la frazione media dei criteri giudicati
        let dichiarato = null;
        if (c.tipo === 'fasce' && c.metrica && Array.isArray(c.fasce) && c.fasce.length) {
          try { const r = valutaQuantitativo(c, dati, bando); if (!r.mancante) dichiarato = r.punti; } catch { dichiarato = null; }
        }
        if (dichiarato != null) { p = dichiarato; origine = 'numeri'; } else { p = c.max * base.media; origine = 'media'; senzaRiscontro += c.max; }
      }
      punti += p;
      puntiCriterio.set(c.id, p);
      const v = perFamiglia.get(fam) || { id: fam, nome: NOMI_FAMIGLIA[fam] || fam, massimo: 0, punti: 0, origini: new Set() };
      v.massimo += c.max; v.punti += p; v.origini.add(origine); perFamiglia.set(fam, v);
    }
    const minimo = num(categoria.soglie?.[s.id]);
    return { id: s.id, nome: s.nome, massimo: s.max, minimo, punti: r1(punti), sopra: minimo == null ? true : r1(punti) >= minimo };
  });
  const totale = r1(sezioni.reduce((a, s) => a + s.punti, 0));
  const soglia = num(bando.sogliaTotale) || 0;
  const sotto = sezioni.filter((s) => !s.sopra).map((s) => s.id);
  // come nel motore: soglia complessiva solo sulle sezioni indicate dal bando e minimi su somme di criteri o sezioni
  const suSezioni = Array.isArray(bando.sogliaSuSezioni) && bando.sogliaSuSezioni.length ? new Set(bando.sogliaSuSezioni) : null;
  const totaleSoglia = suSezioni ? r1(sezioni.filter((s) => suSezioni.has(s.id)).reduce((a, s) => a + s.punti, 0)) : totale;
  const combinateMancate = (categoria.soglieCombinate || bando.soglieCombinate || []).filter((sc) => {
    const parti = [...(sc.criteri || []).filter((id) => puntiCriterio.has(id)).map((id) => puntiCriterio.get(id)), ...(sc.sezioni || []).map((id) => sezioni.find((x) => x.id === id)?.punti).filter((v) => v != null)];
    return parti.length > 0 && r1(parti.reduce((a, v) => a + v, 0)) < sc.minimo;
  }).map((sc) => sc.etichetta || [...(sc.criteri || []), ...(sc.sezioni || [])].join(' + '));
  return {
    indicativa: true, reale: false, completa: true,
    totale, massimo: num(bando.punteggioMassimo) || r1(sezioni.reduce((a, s) => a + s.massimo, 0)), sogliaTotale: soglia, totaleSoglia, combinateMancate,
    sopraSoglia: totaleSoglia >= soglia && !sotto.length && !combinateMancate.length, sezioniSotto: sotto, sezioni,
    famiglie: [...perFamiglia.values()].map((v) => ({
      id: v.id, nome: v.nome, massimo: r1(v.massimo), punti: r1(v.punti), frazione: v.massimo > 0 ? r1((v.punti / v.massimo) * 100) : 0,
      origine: v.origini.has('media') ? 'media' : v.origini.has('valutazione') ? 'valutazione' : 'numeri',
    })).sort((a, b) => b.massimo - a.massimo),
    puntiSenzaRiscontro: r1(senzaRiscontro), puntiConDatiMancanti: r1(datiMancanti),
    base: { bandoId: base.bando.id, nome: base.bando.nomeBreve || base.bando.nome, totale: base.risultato.totale, completo: base.risultato.completo },
    spiegazione: `Stima indicativa, non una valutazione: per ogni famiglia di criteri si applica al massimo di questo bando la stessa frazione ottenuta nella valutazione del dossier su «${base.bando.nomeBreve || base.bando.nome}»; i criteri che si calcolano dai numeri usano i punti calcolati.${senzaRiscontro > 0 ? ` ${fmt(senzaRiscontro)} punti appartengono a famiglie che il bando di partenza non valuta: per quelli si usa la frazione media del dossier (${fmt(base.media * 100)}%).` : ''}${datiMancanti > 0 ? ` ${fmt(datiMancanti)} punti dipendono da dati che mancano nei Dati chiave e contano zero.` : ''} Commissioni diverse giudicano in modo diverso.`,
  };
}

/* ------------------------------------------------------------------ confronto */

const ETICHETTA_LIMITE = { massimale: 'limitato dal massimale', percentuale: 'pari alla percentuale massima' };

function perche(riga, tutte) {
  const frasi = [];
  if (!riga.categoria.compatibile) return riga.categoria.motivo;
  frasi.push(riga.finestra.testo);
  const c = riga.contributo;
  if (c.ottenibile != null) {
    const altri = tutte.filter((x) => x !== riga && x.categoria.compatibile && x.contributo.ottenibile != null);
    const primo = altri.length > 0 && altri.every((x) => x.contributo.ottenibile < c.ottenibile);
    frasi.push(`Fino a ${euro(c.ottenibile)}, il ${fmt(c.quotaSulCosto)}% del costo${primo ? ': il contributo più alto del confronto' : ''}`);
  } else if (c.massimale != null) frasi.push(`Contributo fino a ${euro(c.massimale)}: per l’importo serve il costo di produzione`);
  const n = riga.numeri;
  if (n.massimo > 0 && n.calcolati > 0) {
    const altri = tutte.filter((x) => x !== riga && x.categoria.compatibile && x.numeri.massimo > 0 && x.numeri.calcolati > 0);
    const primo = altri.length > 0 && altri.every((x) => x.numeri.quota < n.quota);
    frasi.push(`Dai numeri ${fmt(n.punti)} punti su ${fmt(n.massimo)} calcolabili${primo ? ', la resa migliore del confronto' : ''}`);
  } else if (n.massimo === 0) frasi.push('Nessun criterio si calcola dai numeri: decide tutto il giudizio della Commissione');
  const forti = riga.profilo.aree.filter((a) => a.punti > 0).sort((a, b) => b.punti - a.punti).slice(0, 2);
  if (forti.length) frasi.push(`Premia soprattutto ${elencoE(forti.map((a) => `${a.nome.toLowerCase()} (${fmt(a.quota)}%)`))}`);
  return `${frasi.join('. ')}.`;
}

/**
 * Confronta lo stesso progetto su tutti i bandi simulabili.
 * IPOTESI dichiarata: il progetto porta nel territorio di ciascun bando le stesse quote di giorni, professionisti e
 * spesa indicate nei Dati chiave; per i bandi diversi da quello del dossier si considera richiesto il contributo
 * massimo ottenibile (per il bando del dossier vale il contributo richiesto indicato, se c'è).
 * Ordine: prima le categorie compatibili, poi i bandi aperti, quelli in apertura, quelli attesi, quelli chiusi;
 * a parità, per contributo ottenibile decrescente, poi per resa dei punti calcolabili, poi per data più vicina.
 * @param {object} progetto dossier (bandoId, categoriaId, anno, dati, valutazione)
 * @param {object[]} bandi bandi a catalogo (si usano solo quelli simulabili)
 * @param {string|Date} [oggi] data di riferimento (AAAA-MM-GG)
 */
export function confrontaBandi(progetto, bandi, oggi = new Date()) {
  const giorno = oggi instanceof Date ? oggi.toISOString().slice(0, 10) : String(oggi).slice(0, 10);
  const tutti = Array.isArray(bandi) ? bandi.filter(Boolean) : [];
  const usabili = tutti.filter(simulabile);
  const dati = progetto?.dati || {};
  const eco = dati.economici || {};
  const costo = num(eco.costoProduzione) != null && eco.costoProduzione > 0 ? eco.costoProduzione : null;
  const base = progetto ? frazioniDallaValutazione(progetto, usabili) : null;

  const righe = !progetto ? [] : usabili.map((bando) => {
    const proprio = bando.id === progetto.bandoId;
    const scelta = categoriaAdatta(progetto, bando, usabili);
    const categoria = bando.categorie.find((c) => c.id === scelta.id);
    const griglia = bando.griglie[categoria.griglia];
    const finestra = statoFinestra(bando, giorno);
    const anno = finestra.prossima?.anno ?? finestra.anno ?? massimalePer(categoria, null)?.anno ?? (proprio && num(progetto.anno) != null ? progetto.anno : Number(giorno.slice(0, 4)));
    const contributo = contributoOttenibile(categoria, costo, anno);
    contributo.regola = bando.regolaContributo === 'proporzionale_al_primo' ? 'proporzionale_al_primo' : 'pieno';

    // ipotesi sul contributo richiesto: quello del dossier per il suo bando, altrimenti il massimo ottenibile
    const richiestoDossier = num(eco.contributoRichiesto);
    const ipotesi = proprio && richiestoDossier != null ? { contributoRichiesto: richiestoDossier, origine: 'dossier' }
      : contributo.ottenibile != null ? { contributoRichiesto: contributo.ottenibile, origine: 'massimo' }
        : richiestoDossier != null ? { contributoRichiesto: Math.min(richiestoDossier, contributo.massimale ?? Infinity), origine: 'dossier' }
          : { contributoRichiesto: null, origine: null };
    const datiIpotesi = { ...dati, economici: { ...eco, contributoRichiesto: ipotesi.contributoRichiesto } };

    const numeri = calcolaNumeri(bando, griglia, datiIpotesi);
    const profilo = profiloGriglia(griglia);
    const soglie = calcolaSoglie(bando, categoria, griglia, numeri);
    const spesaMinima = spesaMinimaTerritorio(bando, costo, ipotesi.contributoRichiesto, eco.spesaSicilia);

    let stima = null;
    if (base) {
      if (proprio && categoria.id === base.categoria.id) {
        const r = base.risultato;
        stima = {
          indicativa: false, reale: true, completa: r.completo, totale: r.totale, massimo: r.massimo, sogliaTotale: r.sogliaTotale,
          sopraSoglia: r.completo ? r.esito !== 'sotto_soglia' : null, sezioniSotto: r.sezioni.filter((s) => s.completo && !s.superata).map((s) => s.id),
          sezioni: r.sezioni.map((s) => ({ id: s.id, nome: s.nome, massimo: s.massimo, minimo: s.soglia, punti: s.punti, sopra: s.superata })),
          famiglie: [], puntiSenzaRiscontro: 0, puntiConDatiMancanti: 0,
          base: { bandoId: bando.id, nome: bando.nomeBreve || bando.nome, totale: r.totale, completo: r.completo },
          spiegazione: `È il punteggio stimato nella valutazione di questo dossier${r.completo ? '' : ' (ancora parziale: mancano dei criteri)'}: lo trovi nel Report.`,
        };
      } else stima = stimaRiproiettata(base, bando, categoria, griglia, numeri, datiIpotesi);
    }

    const avvertenze = [];
    // l'incompatibilità di durata non è un'avvertenza tra le altre: è il «perché» della riga
    if (scelta.compatibile && scelta.ambigua) avvertenze.push(`Categoria scelta in automatico: ${scelta.motivo}`);
    if (bando.verificato === false) avvertenze.push('Griglia letta in automatico e non ancora verificata sul testo ufficiale: controlla criteri e soglie prima di fidarti dei numeri.');
    if (contributo.massimale != null && contributo.massimaleEsatto === false) avvertenze.push(`Il massimale del ${anno} non è indicato: è stato usato quello del ${contributo.annoMassimale}.`);
    if (spesaMinima?.oltreIlCosto) avvertenze.push(`La spesa minima richiesta sul territorio (${euro(spesaMinima.euro)}) supera il costo di produzione: con il contributo massimo il requisito non si può rispettare, va chiesto meno.`);
    else if (spesaMinima && spesaMinima.coperta === false) avvertenze.push(`La spesa sul territorio indicata nei Dati chiave (${euro(spesaMinima.spesaIpotizzata)}) è sotto il minimo richiesto (${euro(spesaMinima.euro)}).`);
    if (numeri.mancanti.length) avvertenze.push(`${numeri.mancanti.length === 1 ? 'Manca un dato' : `Mancano ${numeri.mancanti.length} dati`} nei Dati chiave per ${numeri.mancanti.length === 1 ? 'il criterio' : 'i criteri'} ${numeri.mancanti.join(', ')}: i punti dai numeri sono parziali.`);
    for (const s of soglie.sezioni.filter((x) => !x.raggiungibile)) avvertenze.push(`Sezione ${s.id}: con questi numeri il minimo di ${fmt(s.minimo)} non si raggiunge nemmeno con il massimo nei criteri a giudizio.`);
    if (soglie.dalGiudizio && !soglie.dalGiudizio.possibile) avvertenze.push(`Soglia complessiva di ${fmt(soglie.totale)}: con questi numeri non si raggiunge nemmeno con il massimo nei criteri a giudizio.`);
    if (scelta.compatibile && stima && !stima.reale && !stima.sopraSoglia) avvertenze.push(stima.sezioniSotto.length ? `La stima indicativa resta sotto il minimo ${stima.sezioniSotto.length === 1 ? 'della sezione' : 'delle sezioni'} ${stima.sezioniSotto.join(', ')}.` : stima.combinateMancate?.length ? `La stima indicativa resta sotto il minimo richiesto: ${stima.combinateMancate.join('; ')}.` : `La stima indicativa (${fmt(stima.totaleSoglia ?? stima.totale)}${stima.totaleSoglia != null && stima.totaleSoglia !== stima.totale ? ' sulle sezioni che contano per la soglia' : ''}) resta sotto la soglia di ${fmt(stima.sogliaTotale)}.`);

    return {
      bandoId: bando.id, nome: bando.nome, nomeBreve: bando.nomeBreve || bando.nome, regione: bando.regione || '', territorio: bando.territorio || bando.regione || '',
      ente: bando.ente || '', proprio, daVerificare: bando.verificato === false, paginaUfficiale: bando.paginaUfficiale || '',
      categoria: scelta, anno, finestra, contributo, spesaMinima, ipotesi, numeri, profilo, soglie, stima,
      note: (bando.note || []).filter((n) => typeof n === 'string' && n.trim()).slice(0, 4),
      avvertenze, perche: '',
    };
  });

  righe.sort((a, b) => Number(b.categoria.compatibile) - Number(a.categoria.compatibile)
    || ORDINE_STATO[a.finestra.condizione] - ORDINE_STATO[b.finestra.condizione]
    || (b.contributo.ottenibile ?? -1) - (a.contributo.ottenibile ?? -1)
    || b.numeri.quota - a.numeri.quota
    || (a.finestra.giorni ?? Infinity) - (b.finestra.giorni ?? Infinity)
    || a.nome.localeCompare(b.nome, 'it'));
  righe.forEach((r, i) => { r.posizione = i + 1; r.perche = perche(r, righe); });

  const casa = usabili.find((b) => b.id === progetto?.bandoId) || null;
  const ipotesi = [
    'Il progetto porta nel territorio di ciascun bando le stesse quote di giorni di lavorazione, di professionisti locali e di spesa indicate nei Dati chiave.',
    `Per i bandi diversi da quello del dossier si considera richiesto il contributo massimo ottenibile${casa ? `; per «${casa.nomeBreve || casa.nome}» vale il contributo richiesto nei Dati chiave` : ''}.`,
    'I criteri a giudizio non entrano nei «punti dai numeri»: dipendono da come la Commissione di ciascun bando leggerà il dossier.',
  ];
  // ciò che manca al dossier e vale per tutti i bandi si dice una volta sola
  const avvisi = [];
  if (progetto && righe.length && costo == null) avvisi.push('Manca il costo di produzione nei Dati chiave: senza, il contributo ottenibile non si può calcolare per nessun bando.');
  return {
    oggi: giorno, righe, ipotesi, avvisi,
    progetto: { id: progetto?.id ?? null, titolo: dati.titolo || progetto?.nome || '', costo, bandoId: progetto?.bandoId ?? null, haValutazione: !!base },
    bandoDiPartenza: casa ? { id: casa.id, nome: casa.nomeBreve || casa.nome } : null,
    esclusi: tutti.filter((b) => !simulabile(b)).map((b) => ({ id: b.id, nome: b.nomeBreve || b.nome || b.id })),
    ordinamento: 'Prima i bandi aperti, poi quelli in apertura, attesi e chiusi; a parità di stato, per contributo ottenibile.',
  };
}

/* ------------------------------------------------------------------ copia del dossier per un altro bando */

const copiaProfonda = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

/**
 * Copia di un dossier per presentarlo a un altro bando: nuovo identificativo, stessi documenti e stessi Dati chiave;
 * si azzera ciò che vale solo per il bando di partenza (valutazione, punteggio reale e del primo in graduatoria,
 * requisiti confermati a mano, domande legali sull'avviso, gestione del contributo concesso).
 * @param {object} progetto dossier di partenza (non viene modificato)
 * @param {object} bando bando di destinazione
 * @param {string} [categoriaId] categoria del nuovo bando (se manca o non esiste: la più adatta)
 * @param {number} [anno] finestra (se manca: quella di riferimento a oggi)
 * @param {() => string} nuovoId funzione che genera l'identificativo del nuovo dossier (es. nuovoId di core/store.js)
 * @param {string} [adesso] data di creazione in formato ISO
 */
export function duplicaPerBando(progetto, bando, categoriaId, anno, nuovoId, adesso = new Date().toISOString()) {
  if (!progetto || !simulabile(bando)) throw new Error('Servono un dossier e un bando simulabile.');
  if (typeof nuovoId !== 'function') throw new Error('Serve la funzione che genera l’identificativo del nuovo dossier.');
  const categoria = bando.categorie.find((c) => c.id === categoriaId && bando.griglie?.[c.griglia]) || bando.categorie.find((c) => c.id === categoriaAdatta(progetto, bando)?.id) || bando.categorie[0];
  const f = statoFinestra(bando, String(adesso).slice(0, 10));
  const annoScelto = num(Number(anno)) != null && Number(anno) > 0 ? Number(anno) : (f.prossima?.anno ?? f.anno ?? progetto.anno ?? Number(String(adesso).slice(0, 4)));
  const copia = copiaProfonda(progetto);
  // copiando una copia non si accodano i nomi dei bandi uno dopo l'altro
  const nomeAttuale = String(progetto.nome || progetto.dati?.titolo || 'Dossier');
  const radice = progetto.duplicatoDa?.nomeBase;
  const base = radice && nomeAttuale.startsWith(radice) ? radice : nomeAttuale;
  Object.assign(copia, {
    id: nuovoId(), nome: `${base} — ${bando.nomeBreve || bando.nome}`,
    bandoId: bando.id, categoriaId: categoria.id, anno: annoScelto,
    creato: adesso, valutazione: null, punteggioPrimo: null, reale: {},
    duplicatoDa: { id: progetto.id ?? null, nome: progetto.nome || '', bandoId: progetto.bandoId ?? null, nomeBase: base },
  });
  delete copia.aggiornato;
  delete copia.esempio; // la copia è un dossier dell'utente: la guida iniziale continua ad aprire l'esempio originale
  delete copia.gestione; // tappe, quote e rendiconto riguardano il contributo concesso dal bando di partenza
  copia.documenti = Array.isArray(copia.documenti) ? copia.documenti : [];
  copia.dati = { ...(copia.dati || {}), requisiti: {} };
  if (copia.legale) copia.legale = { ...copia.legale, domande: [], dataDecreto: '' };
  return copia;
}
