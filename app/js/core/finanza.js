// Strumenti finanziari del dossier: struttura del piano e scenari, intensità degli aiuti pubblici,
// credito d'imposta alla produzione, piano di cassa mensile, recupero dei ricavi e indicatori.
// Logica pura (niente DOM): le norme stanno in finanza-regole.js e qui non si ripetono i numeri.
// Le fonti correnti sono sempre quelle del dossier (dati.piano): qui si calcola e si confronta soltanto.

import { REGOLE } from './finanza-regole.js';
import { coperturaPiano } from './scoring.js';
import { totaliPreventivo } from './preventivo.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pos = (v) => Math.max(0, num(v) ?? 0);
const pct = (a, b) => (num(a) != null && num(b) != null && b > 0 ? (a / b) * 100 : null);
const somma = (lista, f = (x) => x) => lista.reduce((a, x) => a + (num(f(x)) ?? 0), 0);

/** Arrotonda al centesimo (o al numero di decimali indicato) senza gli scarti della virgola mobile. */
export function arrot(n, decimali = 2) {
  if (num(n) == null) return null;
  const f = 10 ** decimali;
  return Math.round((Math.abs(n) + Number.EPSILON) * f) / f * Math.sign(n) || 0;
}
const cent = (n) => arrot(n, 2);

/** Divide un importo secondo dei pesi: i centesimi di resto vanno all'ultima parte, così la somma torna esatta. */
export function ripartisci(importo, pesi) {
  const p = pesi.map((w) => pos(w));
  const totale = somma(p);
  if (!(importo > 0) || !(totale > 0)) return p.map(() => 0);
  const parti = p.map((w) => cent((importo * w) / totale));
  const ultima = p.reduce((u, w, i) => (w > 0 ? i : u), 0);
  parti[ultima] = cent(parti[ultima] + importo - somma(parti));
  return parti;
}

/* ------------------------------------------------------------------ voci e gruppi del piano finanziario */

/** Gruppi di fonti nell'ordine del Modulo III: il pubblico, poi il privato dal più vicino al produttore al più lontano. */
export const GRUPPI_FONTI = [
  { id: 'pubblico', nome: 'Pubblico', descrizione: 'Contributi e crediti d’imposta (voci 1.x)' },
  { id: 'proprio', nome: 'Proprio', descrizione: 'Apporto societario e differimenti (voci 2.1 e 2.6)' },
  { id: 'coproduzioni', nome: 'Coproduzioni', descrizione: 'Coproduttori e produttori associati, italiani ed esteri (voci 2.2-2.5 e 3.x)' },
  { id: 'mercato', nome: 'Mercato', descrizione: 'Prevendite e minimi garantiti (voci da 5.x a 8.x)' },
  { id: 'terzi', nome: 'Terzi', descrizione: 'Investitori, sponsor, product placement, apporti in natura (voci 4.x)' },
  { id: 'altro', nome: 'Da classificare', descrizione: 'Fonti senza un codice voce riconosciuto' },
];

/** Voci del piano finanziario del Modulo III (Sez. III.4), per scegliere il codice senza scriverlo a mano. */
export const VOCI_PIANO = [
  ['1.1', 'Contributo richiesto con questo bando'], ['1.2', 'Tax credit'], ['1.3', 'Contributo MiC — DGCA'], ['1.4', 'Contributi da Regioni'],
  ['1.5', 'Finanziamenti europei'], ['1.6', 'Altri enti pubblici'],
  ['2.1', 'Apporto societario diretto'], ['2.2', 'Produttori indipendenti'], ['2.3', 'Produttori non indipendenti'], ['2.4', 'Emittenti TV'],
  ['2.5', 'Produttori OTT'], ['2.6', 'Differimenti'],
  ['3.1', 'Produttori esteri'], ['3.2', 'Emittenti TV estere'], ['3.3', 'Produttori OTT esteri'], ['3.4', 'Altri coproduttori esteri'],
  ['4.1', 'Capitale di rischio (investitori esterni)'], ['4.2', 'Sponsor e altri apporti di terzi'], ['4.3', 'Product placement'], ['4.4', 'Apporti in natura'], ['4.5', 'Altri apporti'],
  ['5.1', 'Prevendite Italia — Theatrical'], ['5.2', 'Prevendite Italia — Free TV'], ['5.3', 'Prevendite Italia — Pay TV'], ['5.4', 'Prevendite Italia — VOD'],
  ['5.5', 'Prevendite Italia — Home video'], ['5.6', 'Prevendite Italia — Altro'],
  ['6.1', 'Prevendite estero'],
  ['7.1', 'Minimo garantito Italia — tutti i diritti'], ['7.2', 'Minimo garantito Italia — Theatrical'], ['7.3', 'Minimo garantito Italia — Home video'],
  ['7.4', 'Minimo garantito Italia — Free TV'], ['7.5', 'Minimo garantito Italia — Pay TV'], ['7.6', 'Minimo garantito Italia — VOD'], ['7.7', 'Minimo garantito Italia — Altro'],
  ['8.1', 'Minimo garantito estero'],
].map(([codice, nome]) => ({ codice, nome }));

/** Codice voce ripulito: «1,2 » → «1.2». */
export const normalizzaVoce = (v) => String(v ?? '').trim().replace(',', '.');

/** Gruppo di una fonte dal codice voce del Modulo III. */
export function gruppoFonte(voce) {
  const m = /^(\d)(?:\.(\d+))?/.exec(normalizzaVoce(voce));
  if (!m) return 'altro';
  const capo = Number(m[1]), sotto = m[2] == null ? null : Number(m[2]);
  if (capo === 1) return 'pubblico';
  if (capo === 2) return sotto == null || sotto === 1 || sotto === 6 ? 'proprio' : 'coproduzioni';
  if (capo === 3) return 'coproduzioni';
  if (capo === 4) return 'terzi';
  return capo >= 5 && capo <= 8 ? 'mercato' : 'altro';
}

const righeConImporto = (piano) => (piano || []).filter((r) => num(r?.importo) != null && r.importo > 0);
const importoVoci = (piano, prova) => cent(somma(righeConImporto(piano).filter((r) => prova(normalizzaVoce(r.voce))), (r) => r.importo));

/** Copia di un piano con i soli campi del dossier (più la scelta «conta come aiuto», se c'è). */
export function copiaPiano(piano) {
  return (piano || []).map((r) => {
    const riga = { voce: normalizzaVoce(r.voce), etichetta: String(r.etichetta ?? ''), denominazione: String(r.denominazione ?? ''), importo: num(r.importo), documento: r.documento || 'nessuno' };
    if (typeof r.aiuto === 'boolean') riga.aiuto = r.aiuto;
    return riga;
  });
}

/** Chiave stabile di ogni riga del piano: codice voce più posizione tra le righe con lo stesso codice («2.2#1»). */
export function chiaviRighe(piano) {
  const visti = new Map();
  return (piano || []).map((r) => {
    const v = normalizzaVoce(r.voce) || '?';
    const n = visti.get(v) || 0;
    visti.set(v, n + 1);
    return `${v}#${n}`;
  });
}

/* ------------------------------------------------------------------ 1. piano finanziario e scenari */

const TOLLERANZA_EURO = 1;

/** Struttura delle fonti: importi per gruppo, totale, scoperto (costo − fonti) o eccedenza. */
export function strutturaPiano(piano, costo) {
  const righe = righeConImporto(piano);
  const totale = cent(somma(righe, (r) => r.importo));
  const c = num(costo) != null && costo > 0 ? costo : null;
  const gruppi = GRUPPI_FONTI.map((g) => {
    const sue = righe.filter((r) => gruppoFonte(r.voce) === g.id);
    const importo = cent(somma(sue, (r) => r.importo));
    return { ...g, importo, righe: sue.length, sulPiano: pct(importo, totale), sulCosto: pct(importo, c) };
  });
  const differenza = c == null ? null : cent(c - totale);
  return {
    righe: righe.length, totale, costo: c, gruppi,
    scoperto: differenza == null ? null : Math.max(0, differenza),
    eccedenza: differenza == null ? null : Math.max(0, -differenza),
    quadra: differenza != null && Math.abs(differenza) <= TOLLERANZA_EURO,
    coperto: pct(Math.min(totale, c ?? 0), c),
  };
}

/** Controlli sul piano del dossier: quadratura con il costo, voce 1.1 e contributo richiesto, righe senza codice. */
export function controlliPiano(dati) {
  const e = dati?.economici || {};
  const s = strutturaPiano(dati?.piano, e.costoProduzione);
  const euro = (n) => `${Math.round(n).toLocaleString('it-IT')} €`;
  const esiti = [];
  if (s.costo == null) esiti.push({ id: 'costo', esito: 'da_verificare', titolo: 'Manca il costo di produzione', dettaglio: 'Senza il costo non si possono calcolare scoperto, copertura e intensità degli aiuti.', azione: 'Inseriscilo nella scheda Dati chiave.' });
  if (!s.righe) esiti.push({ id: 'vuoto', esito: 'da_verificare', titolo: 'Il piano finanziario è vuoto', dettaglio: 'Nessuna fonte con un importo.', azione: 'Carica il Modulo III o aggiungi le fonti nei Dati chiave.' });
  if (s.costo != null && s.righe) {
    if (s.scoperto > TOLLERANZA_EURO) esiti.push({ id: 'scoperto', esito: 'critico', titolo: `Mancano ${euro(s.scoperto)} per coprire il costo`, dettaglio: `Fonti ${euro(s.totale)} contro un costo di ${euro(s.costo)}: nel Modulo III la differenza tra budget e piano finanziario deve essere zero.` });
    else if (s.eccedenza > TOLLERANZA_EURO) esiti.push({ id: 'eccedenza', esito: 'attenzione', titolo: `Le fonti superano il costo di ${euro(s.eccedenza)}`, dettaglio: `Fonti ${euro(s.totale)} contro un costo di ${euro(s.costo)}: riduci una fonte o aggiorna il costo, la differenza deve essere zero.` });
    else esiti.push({ id: 'quadra', esito: 'ok', titolo: 'Il piano copre esattamente il costo', dettaglio: `Fonti e costo coincidono: ${euro(s.costo)}.` });
  }
  const bando = importoVoci(dati?.piano, (v) => v === '1.1');
  const richiesto = num(e.contributoRichiesto);
  if (s.righe && richiesto != null && Math.abs(bando - richiesto) > TOLLERANZA_EURO) {
    esiti.push({ id: 'voce11', esito: 'attenzione', titolo: 'La voce 1.1 non coincide con il contributo richiesto', dettaglio: `Nel piano la voce 1.1 vale ${euro(bando)}, nei Dati chiave il contributo richiesto è ${euro(richiesto)}.`, azione: 'Allinea i due valori nella scheda Dati chiave.' });
  }
  const senzaCodice = righeConImporto(dati?.piano).filter((r) => gruppoFonte(r.voce) === 'altro').length;
  if (senzaCodice) esiti.push({ id: 'codici', esito: 'attenzione', titolo: `${senzaCodice} ${senzaCodice === 1 ? 'fonte non ha' : 'fonti non hanno'} un codice voce riconosciuto`, dettaglio: 'Senza il codice del Modulo III (1.1, 2.2, 5.2…) la fonte non entra in nessun gruppo e non viene contata tra gli aiuti pubblici.', azione: 'Indica il codice nella scheda Dati chiave.' });
  return esiti;
}

/** Scenario alternativo: una copia del piano con un nome. `id` e `creato` li decide chi chiama. */
export function creaScenario(nome, piano, { id = '', creato = '', nota = '' } = {}) {
  return { id, nome: String(nome || 'Scenario').trim() || 'Scenario', creato, nota, piano: copiaPiano(piano) };
}

const firmaPiano = (piano) => JSON.stringify(copiaPiano(righeConImporto(piano)));
/** Vero se due piani hanno le stesse fonti con gli stessi importi e documenti. */
export const pianiUguali = (a, b) => firmaPiano(a) === firmaPiano(b);

/** Riepilogo confrontabile di un piano: struttura, copertura documentata e intensità degli aiuti. */
export function riepilogoPiano(dati, piano, limitePct = null) {
  const d = { ...dati, piano };
  const struttura = strutturaPiano(piano, dati?.economici?.costoProduzione);
  const copertura = coperturaPiano(d);
  const aiuti = intensitaAiuti({ piano, costo: dati?.economici?.costoProduzione, limitePct });
  return {
    totale: struttura.totale, scoperto: struttura.scoperto, eccedenza: struttura.eccedenza, quadra: struttura.quadra,
    gruppi: Object.fromEntries(struttura.gruppi.map((g) => [g.id, g.importo])),
    documentato: copertura.documentato, documentatoSulCosto: copertura.sulCosto, documentatoSulFabbisogno: copertura.sulFabbisogno,
    aiuti: aiuti.aiuti, intensita: aiuti.intensita, statoAiuti: aiuti.stato,
  };
}

/** Confronto tra il piano del dossier e gli scenari salvati: una colonna per ciascuno, con lo scarto dal piano attuale. */
export function confrontaScenari(dati, scenari = [], limitePct = null) {
  const attuale = { id: 'attuale', nome: 'Piano del dossier', attuale: true, ...riepilogoPiano(dati, dati?.piano, limitePct) };
  const altri = (scenari || []).map((s) => {
    const r = riepilogoPiano(dati, s.piano, limitePct);
    return { id: s.id, nome: s.nome, attuale: false, ...r, scarto: cent(r.totale - attuale.totale), uguale: pianiUguali(s.piano, dati?.piano) };
  });
  return [attuale, ...altri];
}

/** Differenze voce per voce tra due piani (importi sommati per codice). */
export function differenzePiano(base, altro) {
  const perVoce = (piano) => {
    const m = new Map();
    for (const r of righeConImporto(piano)) {
      const v = normalizzaVoce(r.voce) || '?';
      const x = m.get(v) || { voce: v, etichetta: r.etichetta || '', importo: 0 };
      x.importo = cent(x.importo + r.importo);
      m.set(v, x);
    }
    return m;
  };
  const a = perVoce(base), b = perVoce(altro);
  const ordine = (v) => v.split('.').map((x) => Number(x) || 99);
  return [...new Set([...a.keys(), ...b.keys()])]
    .map((v) => ({ voce: v, etichetta: (b.get(v) || a.get(v)).etichetta, base: a.get(v)?.importo || 0, altro: b.get(v)?.importo || 0 }))
    .map((x) => ({ ...x, scarto: cent(x.altro - x.base) }))
    .filter((x) => Math.abs(x.scarto) > 0.005)
    .sort((x, y) => { const p = ordine(x.voce), q = ordine(y.voce); return p[0] - q[0] || (p[1] ?? 0) - (q[1] ?? 0); });
}

/** Piano da scrivere nel dossier quando si applica uno scenario (copia: lo scenario resta com'è). */
export const pianoDaScenario = (scenario) => copiaPiano(righeConImporto(scenario?.piano));

/* ------------------------------------------------------------------ 2. intensità degli aiuti pubblici */

const A = REGOLE.aiuti;

/** Tipologie che la norma italiana qualifica d'ufficio come «opere difficili» sotto una soglia di costo. */
export const CATEGORIE_DIFFICILI = [
  { id: 'documentario', nome: 'Documentario' },
  { id: 'opera_prima', nome: 'Opera prima' },
  { id: 'opera_seconda', nome: 'Opera seconda' },
  { id: 'giovani_autori', nome: 'Opera di giovani autori' },
  { id: 'cortometraggio', nome: 'Cortometraggio' },
];
const definizioneOggettiva = () => A.opereDifficiliDefinizioniItaliane.valore.find((x) => x.id === 'oggettive');

/** Soglia di costo sotto la quale la categoria è «opera difficile» d'ufficio. */
export function sogliaOperaDifficile(categoria) {
  const s = definizioneOggettiva().costoMassimoEuro;
  if (categoria === 'documentario') return s.documentari;
  if (categoria === 'cortometraggio') return s.cortometraggi;
  return s.default;
}

/** Categoria «difficile» che si può proporre dalla categoria del bando o dalla tipologia dell'opera (solo documentari e corti). */
export function categoriaDifficileProposta(testo) {
  const t = String(testo || '').toLowerCase();
  if (/cortometragg|\bcorti?\b/.test(t)) return 'cortometraggio';
  return /documentar/.test(t) ? 'documentario' : '';
}

/**
 * Qualifica di opera difficile secondo le definizioni italiane (D.I. 225/2024, art. 4, comma 3).
 * D'ufficio per le cinque categorie sotto soglia; negli altri casi serve la dichiarazione degli esperti.
 */
export function operaDifficile({ categoria = '', costo = null, dichiarata = false } = {}) {
  const voce = CATEGORIE_DIFFICILI.find((c) => c.id === categoria);
  const c = num(costo);
  if (voce) {
    const soglia = sogliaOperaDifficile(categoria);
    if (c != null && c > 0 && c < soglia) return { difficile: true, automatica: true, soglia, motivo: `${voce.nome} con costo inferiore a ${soglia.toLocaleString('it-IT')} €: la qualifica vale d’ufficio.` };
    if (dichiarata) return { difficile: true, automatica: false, soglia, motivo: 'Qualifica dichiarata dagli esperti: conserva il provvedimento.' };
    return { difficile: false, automatica: false, soglia, motivo: c == null || c <= 0 ? `${voce.nome}: la qualifica vale d’ufficio solo sotto ${soglia.toLocaleString('it-IT')} € di costo; manca il costo.` : `${voce.nome}, ma il costo non è inferiore a ${soglia.toLocaleString('it-IT')} €: la qualifica non è automatica.` };
  }
  if (dichiarata) return { difficile: true, automatica: false, soglia: null, motivo: 'Qualifica dichiarata dagli esperti: conserva il provvedimento.' };
  return { difficile: false, automatica: false, soglia: null, motivo: 'Nessuna qualifica di opera difficile.' };
}

/**
 * Limite di intensità applicabile: si parte dal limite generale e vale il più alto tra quelli di cui l'opera ha i requisiti.
 * coproduzione: 'nessuna' | 'ue' (più Stati membri) | 'dac' (Paesi dell'elenco DAC dell'OCSE).
 */
export function limiteAiuti({ coproduzione = 'nessuna', categoria = '', costo = null, dichiarata = false } = {}) {
  const candidati = [{ id: 'generale', pct: A.limiteGeneralePct.valore, nome: 'Limite generale', regola: A.limiteGeneralePct }];
  if (coproduzione === 'ue') candidati.push({ id: 'transfrontaliera', pct: A.produzioniTransfrontalierePct.valore, nome: 'Coproduzione tra Stati dell’Unione', regola: A.produzioniTransfrontalierePct });
  const difficile = operaDifficile({ categoria, costo, dichiarata });
  if (difficile.difficile) candidati.push({ id: 'difficile', pct: A.opereDifficiliLimiteItaliaPct.valore, nome: 'Opera difficile', regola: A.opereDifficiliLimiteItaliaPct });
  if (coproduzione === 'dac') candidati.push({ id: 'dac', pct: A.coproduzioniConPaesiDacPct.valore, nome: 'Coproduzione con Paesi dell’elenco DAC', regola: A.coproduzioniConPaesiDacPct });
  const scelto = candidati.reduce((m, x) => (x.pct > m.pct ? x : m));
  return { ...scelto, difficile, candidati };
}

/** Una fonte conta come aiuto pubblico se è una voce 1.x, salvo la scelta fatta a mano sulla riga (`aiuto`). */
export const aiutoPredefinito = (riga) => gruppoFonte(riga?.voce) === 'pubblico';
export const contaComeAiuto = (riga) => (typeof riga?.aiuto === 'boolean' ? riga.aiuto : aiutoPredefinito(riga));

/**
 * Piano con le scelte «conta come aiuto» fatte nella scheda Finanza (salvate per chiave di riga, non nel dossier:
 * così una nuova lettura del Modulo III non le cancella). Le scelte uguali al predefinito non cambiano nulla.
 */
export function applicaSceltaAiuti(piano, scelte = {}) {
  const chiavi = chiaviRighe(piano);
  return (piano || []).map((r, i) => (typeof scelte?.[chiavi[i]] === 'boolean' ? { ...r, aiuto: scelte[chiavi[i]] } : r));
}

/** Quota del costo coperta da risorse estere (voci 3.x, 6.1 e 8.1 del Modulo III): decide i tetti maggiorati del tax credit. */
export function risorseEstereSulCosto(piano, costo) {
  const estere = importoVoci(piano, (v) => /^3\./.test(v) || v === '6.1' || v === '8.1');
  return { importo: estere, pct: pct(estere, num(costo) != null && costo > 0 ? costo : null) };
}

/** Punti percentuali sotto il limite entro i quali si avvisa che ci si sta avvicinando (scelta del programma, non della norma). */
export const MARGINE_ATTENZIONE_PUNTI = 5;

function statoIntensita(intensita, limitePct, margine = MARGINE_ATTENZIONE_PUNTI) {
  if (intensita == null || limitePct == null) return 'nd';
  if (intensita > limitePct + 0.005) return 'superato';
  return limitePct - intensita <= margine ? 'vicino' : 'ok';
}

/**
 * Intensità dell'aiuto = somma degli aiuti pubblici ÷ costo dell'opera, contro il limite applicabile.
 * `margine` è quanto aiuto pubblico si può ancora aggiungere (negativo = eccedenza da togliere).
 */
export function intensitaAiuti({ piano, costo, limitePct = null, margineAttenzione = MARGINE_ATTENZIONE_PUNTI } = {}) {
  const c = num(costo) != null && costo > 0 ? costo : null;
  const limite = num(limitePct) ?? A.limiteGeneralePct.valore;
  const righe = (piano || []).map((r, indice) => ({ indice, voce: normalizzaVoce(r.voce), etichetta: r.etichetta || '', denominazione: r.denominazione || '', importo: pos(r.importo), aiuto: contaComeAiuto(r), predefinito: aiutoPredefinito(r), modificato: typeof r.aiuto === 'boolean' && r.aiuto !== aiutoPredefinito(r) }))
    .filter((r) => r.importo > 0);
  const aiuti = cent(somma(righe.filter((r) => r.aiuto), (r) => r.importo));
  const intensita = pct(aiuti, c);
  const limiteEuro = c == null ? null : cent((c * limite) / 100);
  return {
    costo: c, limitePct: limite, limiteEuro, aiuti, intensita, righe,
    margine: limiteEuro == null ? null : cent(limiteEuro - aiuti),
    marginePunti: intensita == null ? null : arrot(limite - intensita, 2),
    stato: statoIntensita(intensita, limite, margineAttenzione),
  };
}

/**
 * Effetto del contributo del bando in corso (voce 1.1) e del tax credit (voce 1.2) sul limite:
 * intensità a ogni passo, importo massimo di ciascuno compatibile con il limite e, se dato, la variante con il credito stimato.
 */
export function effettoAiuti({ piano, costo, limitePct = null, taxCreditStimato = null } = {}) {
  const base = intensitaAiuti({ piano, costo, limitePct });
  const aiuti = base.righe.filter((r) => r.aiuto);
  const bando = cent(somma(aiuti.filter((r) => r.voce === '1.1'), (r) => r.importo));
  const taxCredit = cent(somma(aiuti.filter((r) => r.voce === '1.2'), (r) => r.importo));
  const altri = cent(base.aiuti - bando - taxCredit);
  const passo = (id, etichetta, importo, cumulato) => ({ id, etichetta, importo, cumulato, intensita: pct(cumulato, base.costo), stato: statoIntensita(pct(cumulato, base.costo), base.limitePct) });
  const passi = [
    passo('altri', 'Altri aiuti pubblici', altri, altri),
    passo('bando', 'Contributo di questo bando (voce 1.1)', bando, cent(altri + bando)),
    passo('taxCredit', 'Tax credit (voce 1.2)', taxCredit, cent(altri + bando + taxCredit)),
  ];
  const stima = num(taxCreditStimato);
  const conStima = stima == null ? null : passo('stima', 'Con il tax credit stimato dal calcolatore', stima, cent(altri + bando + stima));
  return {
    ...base, bando, taxCredit, altri, passi, conStima,
    massimoBando: base.limiteEuro == null ? null : Math.max(0, cent(base.limiteEuro - altri - taxCredit)),
    massimoTaxCredit: base.limiteEuro == null ? null : Math.max(0, cent(base.limiteEuro - altri - bando)),
  };
}

/* ------------------------------------------------------------------ 3. credito d'imposta alla produzione */

const T = REGOLE.taxCredit;

/** Tipologie di opera del decreto tax credit produzione, con il canale che decide i tetti. */
export const OPERE_TAX_CREDIT = [
  { id: 'film', nome: 'Film (opera cinematografica di finzione)', canale: 'cinema', aliquota: 'film', copertura: 'film' },
  { id: 'tv', nome: 'Opera televisiva o web di finzione', canale: 'tvweb', aliquota: 'tv', copertura: 'tvWeb' },
  { id: 'documentario_cinema', nome: 'Documentario cinematografico', canale: 'cinema', aliquota: 'documentari', copertura: 'documentari' },
  { id: 'documentario_tv', nome: 'Documentario televisivo o web', canale: 'tvweb', aliquota: 'documentari', copertura: 'documentari' },
  { id: 'animazione_cinema', nome: 'Animazione cinematografica', canale: 'cinema', aliquota: 'animazione', copertura: 'animazione' },
  { id: 'animazione_tv', nome: 'Animazione televisiva o web', canale: 'tvweb', aliquota: 'animazione', copertura: 'animazione' },
  { id: 'cortometraggio', nome: 'Cortometraggio', canale: null, aliquota: 'cortometraggi', copertura: 'cortometraggi' },
  { id: 'videoclip', nome: 'Videoclip', canale: null, aliquota: 'videoclip', copertura: 'videoclip' },
];
export const IMPRESE_TAX_CREDIT = [
  { id: 'indipendente', nome: 'Produttore indipendente' },
  { id: 'elevata', nome: 'Indipendente ad elevata capacità produttiva e finanziaria' },
  { id: 'non_indipendente', nome: 'Non indipendente o non europea (solo film)' },
];

/** Tipologia da proporre in base alla categoria del bando, alla tipologia scritta nel dossier e al segno di animazione. */
export function operaTaxCreditProposta({ categoria = '', tipologia = '', animazione = false } = {}) {
  const t = `${categoria} ${tipologia}`.toLowerCase();
  const tv = /serie|\btv\b|televis|web/.test(t);
  if (/videoclip/.test(t)) return 'videoclip';
  if (/cortometragg|\bcorti?\b/.test(t)) return 'cortometraggio';
  if (animazione || /animazion/.test(t)) return tv ? 'animazione_tv' : 'animazione_cinema';
  if (/documentar/.test(t)) return tv ? 'documentario_tv' : 'documentario_cinema';
  return tv ? 'tv' : 'film';
}

const INFINITO = Number.POSITIVE_INFINITY;
const perRiduzione = (base, scaglioni) => {
  const fasce = [{ da: 0, a: scaglioni[0].daEuro, pct: base }];
  for (const s of scaglioni) fasce.push({ da: s.daEuro, a: s.aEuro ?? INFINITO, pct: base - s.riduzionePunti });
  return fasce;
};

/** Scaglioni di aliquota sul costo eleggibile per tipologia di opera e di impresa. */
export function scaglioniTaxCredit({ opera = 'film', impresa = 'indipendente', maggiorata = false, seriale = false } = {}) {
  const o = OPERE_TAX_CREDIT.find((x) => x.id === opera) || OPERE_TAX_CREDIT[0];
  const al = T.aliquote, elevata = impresa === 'elevata';
  const unica = (r) => ({ fasce: [{ da: 0, a: INFINITO, pct: r.valore }], regole: [r] });
  if (o.aliquota === 'film') {
    if (impresa === 'non_indipendente') return unica(al.filmNonIndipendentiENonEuropei);
    if (elevata) return { fasce: al.filmImpresaElevataCapacita.valore.map((s) => ({ da: s.daEuro, a: s.aEuro ?? INFINITO, pct: s.pct })), regole: [al.filmImpresaElevataCapacita] };
    return unica(al.film);
  }
  if (o.aliquota === 'tv') {
    const r = maggiorata ? al.tvWebMaggiorata : al.tvWebBase;
    return elevata ? { fasce: perRiduzione(r.valore, al.tvWebRiduzioneElevataCapacita.valore), regole: [r, al.tvWebRiduzioneElevataCapacita] } : unica(r);
  }
  if (o.aliquota === 'documentari' || o.aliquota === 'animazione') {
    const r = al[o.aliquota], rid = al[`${o.aliquota}RiduzioneElevataCapacita`];
    return elevata ? { fasce: perRiduzione(r.valore, rid.valore[seriale ? 'seriali' : 'nonSeriali']), regole: [r, rid] } : unica(r);
  }
  return unica(al[o.aliquota]);
}

/** Voci del preventivo (Modulo III) che servono al calcolatore: sopra la linea soggetto al limite, oneri, fee, spese generali. */
export function vociTaxCreditDaPreventivo(totali) {
  if (!totali?.voci) return null;
  const di = (codici) => cent(somma(totali.voci.filter((v) => codici.includes(v.codice)), (v) => v.importo));
  return {
    costoComplessivo: totali.costoProduzione,
    sopraLaLinea: di(['A.1.1', 'A.1.2', 'A.2.1', 'A.2.2', 'A.3.1']),
    oneri: di(['A.7.2', 'A.7.3']),
    producerFee: cent(totali.producerFee || 0),
    speseGenerali: cent(totali.gruppi?.find((g) => g.id === 8)?.importo || 0),
  };
}

/** Totali del preventivo del dossier, se è stato compilato (in produzione.preventivo o, nei dossier meno recenti, in preventivo). */
export function preventivoDelDossier(p) {
  const prev = p?.produzione?.preventivo?.righe?.length ? p.produzione.preventivo : p?.preventivo;
  return prev?.righe?.length ? totaliPreventivo(prev.righe) : null;
}

/**
 * Stima del credito d'imposta alla produzione (D.I. 225/2024 come modificato dal D.I. 281/2026).
 * Costo eleggibile = costo complessivo − producer fee − spese generali − altre spese non eleggibili
 *                    − costi sopra la linea oltre il limite − oneri finanziari, assicurativi e di garanzia oltre il limite.
 * Credito = minimo tra aliquota × costo eleggibile (per scaglioni), tetto per opera e residuo del tetto annuo d'impresa.
 * Gli importi non indicati (null) si considerano dentro i limiti: il controllo corrispondente resta «da confermare».
 */
export function calcolaTaxCredit(ingresso = {}) {
  const {
    opera = 'film', impresa = 'indipendente', maggiorata = false, seriale = false,
    costoComplessivo = null, sopraLaLinea = null, oneri = null, producerFee = null, speseGenerali = null, nonEleggibili = null,
    risorseEsterePct = null, creditiAnno = null, durataMin = null,
    coperturaSenzaCredito = null, apportoProduttore = null, altriAiuti = null, limiteAiutiPct = null,
  } = ingresso;
  const o = OPERE_TAX_CREDIT.find((x) => x.id === opera) || OPERE_TAX_CREDIT[0];
  const b = T.base, m = T.massimali;
  const C = pos(costoComplessivo);
  const controlli = [];
  const euro = (n) => `${Math.round(n).toLocaleString('it-IT')} €`;
  const perc = (n) => `${arrot(n, 1).toLocaleString('it-IT')}%`;

  // limiti sul costo complessivo
  const sottoSoglia = C > 0 && C < b.sogliaCostoSopraLaLinea.valore;
  const regolaSopra = sottoSoglia ? b.sopraLaLineaMaxPctOpereSotto3_5Milioni : b.sopraLaLineaMaxPct;
  const limiteSopra = cent((C * regolaSopra.valore) / 100);
  const sopra = pos(sopraLaLinea), sopraEccedente = cent(Math.max(0, sopra - limiteSopra));
  const limiteOneri = cent((C * b.oneriFinanziariAssicurativiGaranziaMaxPct.valore) / 100);
  const on = pos(oneri), oneriEccedenti = cent(Math.max(0, on - limiteOneri));
  const fee = pos(producerFee), generali = pos(speseGenerali), altre = pos(nonEleggibili);
  const limiteFee = cent((C * b.producerFeeMaxPctSulCostoComplessivo.valore) / 100);
  const limiteGenerali = cent((C * b.speseGeneraliMaxPctSulCostoComplessivo.valore) / 100);

  const detrazioni = [
    { id: 'fee', etichetta: 'Producer fee', importo: fee, regola: b.producerFeeEleggibile },
    { id: 'generali', etichetta: 'Spese generali', importo: generali, regola: b.speseGeneraliEleggibili },
    { id: 'altre', etichetta: 'Altre spese non eleggibili (estero, imprevisti, differimenti, spese istruttorie)', importo: altre, regola: b.speseEleggibiliTerritorio },
    { id: 'sopra', etichetta: `Sopra la linea oltre il ${regolaSopra.valore}% del costo complessivo`, importo: sopraEccedente, regola: regolaSopra },
    { id: 'oneri', etichetta: `Oneri finanziari, assicurativi e di garanzia oltre il ${String(b.oneriFinanziariAssicurativiGaranziaMaxPct.valore).replace('.', ',')}%`, importo: oneriEccedenti, regola: b.oneriFinanziariAssicurativiGaranziaMaxPct },
  ];
  let costoEleggibile = cent(Math.max(0, C - somma(detrazioni, (x) => x.importo)));
  let limiteCorto = null;
  if (o.id === 'cortometraggio' && costoEleggibile > b.cortometraggiCostoEleggibileMax.valore) {
    limiteCorto = b.cortometraggiCostoEleggibileMax.valore;
    detrazioni.push({ id: 'corto', etichetta: `Costo eleggibile oltre ${euro(limiteCorto)} (cortometraggi)`, importo: cent(costoEleggibile - limiteCorto), regola: b.cortometraggiCostoEleggibileMax });
    costoEleggibile = limiteCorto;
  }

  // aliquota per scaglioni
  const ammessa = !(impresa === 'non_indipendente' && o.aliquota !== 'film');
  const { fasce, regole: regoleAliquota } = scaglioniTaxCredit({ opera: o.id, impresa, maggiorata, seriale });
  const scaglioni = fasce.map((f) => {
    const baseFascia = cent(Math.max(0, Math.min(costoEleggibile, f.a) - f.da));
    return { da: f.da, a: f.a === INFINITO ? null : f.a, pct: f.pct, base: baseFascia, credito: cent((baseFascia * f.pct) / 100) };
  }).filter((s, i) => i === 0 || s.base > 0);
  const creditoTeorico = ammessa ? cent(somma(scaglioni, (s) => s.credito)) : 0;

  // tetti per opera e per impresa
  const estere = num(risorseEsterePct) != null && risorseEsterePct >= m.sogliaRisorseEsterePct.valore;
  let tettoOpera = null, tettoAnnuo = null, regolaOpera = null, regolaAnnuo = null;
  if (o.id === 'videoclip') { regolaOpera = m.videoclipPerOpera; tettoOpera = regolaOpera.valore; }
  else if (o.canale === 'cinema') {
    regolaOpera = estere ? m.perOperaCinemaConRisorseEstere : m.perOperaCinema; tettoOpera = regolaOpera.valore;
    regolaAnnuo = m.perImpresaAnnuoCinema; tettoAnnuo = regolaAnnuo.valore;
  } else if (o.canale === 'tvweb') {
    regolaOpera = estere ? m.perOperaTvWebConRisorseEstere : m.perOperaTvWeb; tettoOpera = regolaOpera.valore;
    regolaAnnuo = m.perImpresaAnnuoTvWeb; tettoAnnuo = regolaAnnuo.valore;
  }
  if (impresa === 'non_indipendente' && o.aliquota === 'film') { regolaAnnuo = m.filmNonIndipendentiAnnuoPerImpresaOGruppo; tettoAnnuo = regolaAnnuo.valore; }
  const residuoAnnuo = tettoAnnuo == null ? null : Math.max(0, cent(tettoAnnuo - pos(creditiAnno)));
  const credito = Math.max(0, Math.min(creditoTeorico, tettoOpera ?? INFINITO, residuoAnnuo ?? INFINITO));
  const limitatoDa = credito >= creditoTeorico - 0.005 ? null : (residuoAnnuo != null && residuoAnnuo < (tettoOpera ?? INFINITO) ? 'anno' : 'opera');

  // utilizzo in compensazione
  const u = T.utilizzo;
  const regolaQuota = impresa === 'elevata' ? u.quotaUtilizzabileDopoPreventivaElevataCapacitaPct : u.quotaUtilizzabileDopoPreventivaPct;
  const dopoPreventiva = cent((credito * regolaQuota.valore) / 100);
  const quote = { preventivaPct: regolaQuota.valore, dopoPreventiva, dopoDefinitiva: cent(credito - dopoPreventiva), regola: regolaQuota };

  // controlli
  if (!ammessa) controlli.push({ id: 'beneficiario', esito: 'critico', titolo: 'Tipologia non ammessa per questa impresa', dettaglio: 'I produttori non indipendenti e le imprese non europee accedono al credito solo per i film.', regola: T.quadro.beneficiari });
  if (sopraLaLinea == null) controlli.push({ id: 'sopra', esito: 'da_verificare', titolo: 'Costi sopra la linea non indicati', dettaglio: `Sono eleggibili fino al ${regolaSopra.valore}% del costo complessivo (${euro(limiteSopra)}): inseriscili per verificare il limite.`, regola: regolaSopra });
  else if (sopraEccedente > 0) controlli.push({ id: 'sopra', esito: 'attenzione', titolo: `Sopra la linea oltre il limite: ${euro(sopraEccedente)} non eleggibili`, dettaglio: `Soggetto e sceneggiatura, direzione e attori principali valgono ${euro(sopra)} (${perc(pct(sopra, C))} del costo); sono eleggibili fino al ${regolaSopra.valore}%, cioè ${euro(limiteSopra)}.`, regola: regolaSopra });
  else controlli.push({ id: 'sopra', esito: 'ok', titolo: 'Sopra la linea entro il limite', dettaglio: `${euro(sopra)} su un massimo eleggibile di ${euro(limiteSopra)} (${regolaSopra.valore}% del costo complessivo).`, regola: regolaSopra });
  if (oneriEccedenti > 0) controlli.push({ id: 'oneri', esito: 'attenzione', titolo: `Oneri finanziari, assicurativi e di garanzia oltre il limite: ${euro(oneriEccedenti)} non eleggibili`, dettaglio: `Eleggibili fino a ${euro(limiteOneri)}.`, regola: b.oneriFinanziariAssicurativiGaranziaMaxPct });
  if (fee > limiteFee + 0.5) controlli.push({ id: 'fee', esito: 'attenzione', titolo: 'Producer fee oltre il 7,5% del costo complessivo', dettaglio: `${euro(fee)} contro un massimo imputabile di ${euro(limiteFee)}: la parte eccedente non entra nemmeno nel costo complessivo.`, regola: b.producerFeeMaxPctSulCostoComplessivo });
  if (generali > limiteGenerali + 0.5) controlli.push({ id: 'generali', esito: 'attenzione', titolo: 'Spese generali oltre il 7,5% del costo complessivo', dettaglio: `${euro(generali)} contro un massimo imputabile di ${euro(limiteGenerali)}.`, regola: b.speseGeneraliMaxPctSulCostoComplessivo });
  if (limitatoDa === 'opera') controlli.push({ id: 'tetto_opera', esito: 'attenzione', titolo: `Credito ridotto dal tetto per opera di ${euro(tettoOpera)}`, dettaglio: `Il calcolo sull’aliquota darebbe ${euro(creditoTeorico)}.${estere ? '' : ` Con almeno il ${m.sogliaRisorseEsterePct.valore}% di risorse estere il tetto sale.`}`, regola: regolaOpera });
  if (limitatoDa === 'anno') controlli.push({ id: 'tetto_anno', esito: 'attenzione', titolo: `Credito ridotto dal tetto annuo dell’impresa (${euro(tettoAnnuo)})`, dettaglio: `Restano ${euro(residuoAnnuo)} dopo i crediti già riconosciuti nell’anno.`, regola: regolaAnnuo });

  const regolaCopertura = T.requisiti.coperturaFinanziariaMinimaPct;
  const sogliaCopertura = regolaCopertura.valore[o.copertura];
  const copertura = pct(num(coperturaSenzaCredito), C);
  if (C > 0 && copertura != null) {
    controlli.push(copertura + 0.005 >= sogliaCopertura
      ? { id: 'copertura', esito: 'ok', titolo: `Copertura finanziaria senza il credito: ${perc(copertura)}`, dettaglio: `Il minimo da comprovare è il ${sogliaCopertura}% del costo. Vanno documentate: contano solo le fonti con un atto o un contratto.`, regola: regolaCopertura }
      : { id: 'copertura', esito: 'attenzione', titolo: `Copertura finanziaria senza il credito: ${perc(copertura)}, sotto il ${sogliaCopertura}% richiesto`, dettaglio: `Mancano ${euro((C * sogliaCopertura) / 100 - coperturaSenzaCredito)} di fonti diverse dal credito. Il requisito non si applica alle opere che entrano con un contributo selettivo o sovranazionale.`, regola: regolaCopertura });
  }
  if (num(apportoProduttore) != null && credito > 0) {
    controlli.push(apportoProduttore + 0.5 >= credito
      ? { id: 'partecipazione', esito: 'ok', titolo: 'Partecipazione del produttore almeno pari al credito', dettaglio: `Apporto societario diretto ${euro(apportoProduttore)} contro un credito di ${euro(credito)}.`, regola: T.requisiti.partecipazioneMinimaDelProduttore }
      : { id: 'partecipazione', esito: 'da_verificare', titolo: 'Partecipazione del produttore inferiore al credito', dettaglio: `L’apporto societario diretto nel piano (${euro(apportoProduttore)}) è più basso del credito stimato (${euro(credito)}): il produttore deve partecipare alla copertura del costo in misura almeno pari al credito. Verifica con il commercialista come documentarla.`, regola: T.requisiti.partecipazioneMinimaDelProduttore });
  }
  let creditoCompatibile = credito;
  if (C > 0 && num(altriAiuti) != null) {
    const limite = num(limiteAiutiPct) ?? A.limiteGeneralePct.valore;
    const tetto = cent((C * limite) / 100);
    creditoCompatibile = Math.max(0, Math.min(credito, cent(tetto - altriAiuti)));
    controlli.push(credito + altriAiuti <= tetto + 0.5
      ? { id: 'cumulo', esito: 'ok', titolo: `Cumulo degli aiuti entro il ${limite}%`, dettaglio: `Credito più altri aiuti pubblici: ${euro(credito + altriAiuti)} su un massimo di ${euro(tetto)}.`, regola: A.limiteGeneralePct }
      : { id: 'cumulo', esito: 'critico', titolo: `Con gli altri aiuti pubblici si supera il limite del ${limite}%`, dettaglio: `Credito ${euro(credito)} più altri aiuti ${euro(altriAiuti)} = ${euro(credito + altriAiuti)}, contro un massimo di ${euro(tetto)}. Il credito compatibile con il limite è ${euro(creditoCompatibile)}.`, regola: A.limiteGeneralePct });
  }
  const durata = num(durataMin);
  if (o.id === 'film' && durata != null && durata <= T.requisiti.filmDurataMinima.valore) controlli.push({ id: 'durata', esito: 'critico', titolo: `Durata non superiore a ${T.requisiti.filmDurataMinima.valore} minuti`, dettaglio: 'I film ammessi sono opere di finzione di durata superiore a 52 minuti.', regola: T.requisiti.filmDurataMinima });
  if (o.id === 'tv' && durata != null && durata > 0 && C > 0 && C / durata < b.fictionTvWebCostoMinimoAlMinuto.valore) controlli.push({ id: 'costo_minuto', esito: 'attenzione', titolo: `Costo al minuto sotto ${euro(b.fictionTvWebCostoMinimoAlMinuto.valore)}`, dettaglio: `L’opera costa ${euro(C / durata)} al minuto: per la finzione tv e web il minimo è ${euro(b.fictionTvWebCostoMinimoAlMinuto.valore)}, salvo deroga del Direttore generale.`, regola: b.fictionTvWebCostoMinimoAlMinuto });
  if (limiteCorto != null) controlli.push({ id: 'corto', esito: 'attenzione', titolo: `Costo eleggibile limitato a ${euro(limiteCorto)}`, dettaglio: 'Per i cortometraggi il costo eleggibile non può superare questa soglia.', regola: b.cortometraggiCostoEleggibileMax });
  controlli.push({ id: 'tetto_spesa', esito: 'da_verificare', titolo: 'Il credito dipende dalla capienza della sessione', dettaglio: 'I crediti sono riconosciuti entro il tetto di spesa annuo, in ordine di data di avvio delle riprese: una domanda ammissibile che non trova capienza non riceve una quota ridotta e va ripresentata.', regola: T.quadro.tettoDiSpesa });

  return {
    valido: C > 0, opera: o, impresa, ammessa,
    costoComplessivo: C, detrazioni: detrazioni.filter((x) => x.importo > 0), costoEleggibile,
    sopra: { importo: sopra, limitePct: regolaSopra.valore, limite: limiteSopra, eccedente: sopraEccedente, indicato: sopraLaLinea != null, regola: regolaSopra },
    oneri: { importo: on, limite: limiteOneri, eccedente: oneriEccedenti },
    scaglioni, regoleAliquota, aliquota: fasce[0].pct, aliquotaEffettiva: pct(creditoTeorico, costoEleggibile),
    creditoTeorico, tettoOpera, tettoAnnuo, residuoAnnuo, regolaOpera, regolaAnnuo, risorseEstere: estere,
    credito: cent(credito), creditoCompatibile: cent(creditoCompatibile), limitatoDa, sulCosto: pct(credito, C),
    quote, controlli,
  };
}

/**
 * Ingresso del calcolatore: i valori scritti dall'utente dove ci sono, altrimenti quelli del preventivo, poi quelli del dossier.
 * `origine` dice da dove viene ogni importo ('utente' | 'preventivo' | 'dossier' | 'piano' | null).
 * Copertura senza credito = fonti del piano diverse dal tax credit (1.2); apporto del produttore = voce 2.1;
 * altri aiuti = aiuti pubblici del piano esclusa la voce 1.2.
 */
export function ingressoTaxCredit({ dati = {}, scelte = {}, preventivo = null, piano = dati.piano, limitePct = null, categoria = '' } = {}) {
  const e = dati.economici || {};
  const prev = vociTaxCreditDaPreventivo(preventivo);
  const origine = {};
  const da = (k, ...alternative) => {
    if (num(scelte[k]) != null) { origine[k] = 'utente'; return scelte[k]; }
    for (const [fonte, v] of alternative) if (num(v) != null) { origine[k] = fonte; return v; }
    origine[k] = null;
    return null;
  };
  const costoComplessivo = da('costoComplessivo', ['preventivo', prev?.costoComplessivo || null], ['dossier', num(e.costoProduzione) > 0 ? e.costoProduzione : null]);
  const estere = risorseEstereSulCosto(piano, costoComplessivo);
  const righe = righeConImporto(piano);
  return {
    opera: scelte.opera || operaTaxCreditProposta({ categoria, tipologia: dati.tipologiaOpera, animazione: dati.animazione }),
    impresa: scelte.impresa || 'indipendente', maggiorata: !!scelte.maggiorata, seriale: !!scelte.seriale,
    costoComplessivo,
    sopraLaLinea: da('sopraLaLinea', ['preventivo', prev?.sopraLaLinea]),
    oneri: da('oneri', ['preventivo', prev?.oneri]),
    producerFee: da('producerFee', ['preventivo', prev?.producerFee], ['dossier', e.producerFee]),
    speseGenerali: da('speseGenerali', ['preventivo', prev?.speseGenerali]),
    nonEleggibili: da('nonEleggibili'),
    risorseEsterePct: da('risorseEsterePct', ['piano', estere.importo > 0 ? estere.pct : null]),
    creditiAnno: da('creditiAnno'),
    durataMin: num(dati.durataMin),
    coperturaSenzaCredito: righe.length ? cent(somma(righe.filter((r) => normalizzaVoce(r.voce) !== '1.2'), (r) => r.importo)) : null,
    apportoProduttore: righe.length ? importoVoci(piano, (v) => v === '2.1') : null,
    altriAiuti: righe.length ? cent(somma(righe.filter((r) => normalizzaVoce(r.voce) !== '1.2' && contaComeAiuto(r)), (r) => r.importo)) : null,
    limiteAiutiPct: limitePct,
    origine,
  };
}

/**
 * Piano con il tax credit alla voce 1.2: aggiorna la prima riga 1.2 (azzerando le altre) o la aggiunge dopo le voci 1.x.
 * Restituisce un piano nuovo: quello passato non viene toccato.
 */
export function pianoConTaxCredit(piano, importo) {
  const nuovo = (piano || []).map((r) => ({ ...r }));
  const valore = Math.round(pos(importo));
  const righe = nuovo.filter((r) => normalizzaVoce(r.voce) === '1.2');
  if (righe.length) {
    righe[0].importo = valore;
    for (const r of righe.slice(1)) r.importo = 0;
    return nuovo.filter((r) => !(normalizzaVoce(r.voce) === '1.2' && r !== righe[0] && !r.importo));
  }
  const dopo = nuovo.reduce((u, r, i) => (gruppoFonte(r.voce) === 'pubblico' ? i : u), -1);
  nuovo.splice(dopo + 1, 0, { voce: '1.2', etichetta: 'Tax credit', denominazione: '', importo: valore, documento: 'nessuno' });
  return nuovo;
}

/* ------------------------------------------------------------------ 4. piano di cassa mensile */

const RE_MESE = /^(\d{4})-(\d{2})$/;
const NOMI_MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const inMesi = (mese) => { const m = RE_MESE.exec(mese); return Number(m[1]) * 12 + Number(m[2]) - 1; };

export const meseValido = (s) => { const m = RE_MESE.exec(String(s || '')); return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12; };
/** «2026-11» + 3 → «2027-02» (anche all'indietro). */
export function aggiungiMesi(mese, n) {
  if (!meseValido(mese)) return null;
  const t = inMesi(mese) + Math.trunc(n || 0);
  return `${String(Math.floor(t / 12)).padStart(4, '0')}-${String((((t % 12) + 12) % 12) + 1).padStart(2, '0')}`;
}
/** Mesi che separano due mesi (a − da). */
export const differenzaMesi = (da, a) => (meseValido(da) && meseValido(a) ? inMesi(a) - inMesi(da) : null);
/** «2027-01» → «gen 2027». */
export const etichettaMese = (mese) => (meseValido(mese) ? `${NOMI_MESI[Number(mese.slice(5)) - 1]} ${mese.slice(0, 4)}` : '');
/** Mese di una data scritta come gg/mm/aaaa (Modulo III), aaaa-mm-gg o aaaa-mm; null se non è una data. */
export function meseDaData(testo) {
  const s = String(testo || '').trim();
  let m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s);
  if (m) { const mese = `${m[3]}-${m[2].padStart(2, '0')}`; return meseValido(mese) ? mese : null; }
  m = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(s);
  return m && meseValido(`${m[1]}-${m[2]}`) ? `${m[1]}-${m[2]}` : null;
}

/** Giorni di lavorazione che stanno in un mese: convenzione del programma per passare dai giorni del dossier ai mesi. */
export const GIORNI_LAVORATIVI_MESE = 22;
export function mesiDaGiorni(giorni, giorniMese = GIORNI_LAVORATIVI_MESE) {
  const g = num(giorni);
  return g != null && g > 0 ? Math.max(1, Math.ceil(g / giorniMese)) : null;
}

/** Durate usate quando il dossier non ha ancora i giorni di lavorazione: solo per avere un calendario da correggere. */
export const MESI_DI_PARTENZA = { prep: 2, riprese: 2, post: 3 };

/**
 * Calendario proposto: durate dai giorni del dossier, mese d'inizio dalle date del Modulo III (inizio riprese − preparazione)
 * o, se mancano, dal mese successivo a `oggi` («aaaa-mm»).
 */
export function calendarioProposto({ giorni = {}, modulo3 = null, oggi = null } = {}) {
  const daGiorni = { prep: mesiDaGiorni(giorni.prepTot), riprese: mesiDaGiorni(giorni.ripreseTot), post: mesiDaGiorni(giorni.postTot) };
  const mesi = { prep: daGiorni.prep ?? MESI_DI_PARTENZA.prep, riprese: daGiorni.riprese ?? MESI_DI_PARTENZA.riprese, post: daGiorni.post ?? MESI_DI_PARTENZA.post };
  const origine = { prep: daGiorni.prep ? 'giorni' : 'partenza', riprese: daGiorni.riprese ? 'giorni' : 'partenza', post: daGiorni.post ? 'giorni' : 'partenza', inizio: 'oggi' };
  const inizioRiprese = meseDaData(modulo3?.dataInizioRiprese), fineRiprese = meseDaData(modulo3?.dataFineRiprese);
  let inizio = meseValido(oggi) ? aggiungiMesi(oggi, 1) : null;
  if (inizioRiprese) {
    if (fineRiprese && differenzaMesi(inizioRiprese, fineRiprese) >= 0) { mesi.riprese = differenzaMesi(inizioRiprese, fineRiprese) + 1; origine.riprese = 'modulo3'; }
    inizio = aggiungiMesi(inizioRiprese, -mesi.prep);
    origine.inizio = 'modulo3';
  }
  return { inizio, mesi, origine };
}

const interoTra = (v, min, max, altrimenti) => { const n = num(v); return n == null ? altrimenti : Math.min(max, Math.max(min, Math.round(n))); };

/** Calendario in uso: le scelte dell'utente dove ci sono, altrimenti quello proposto. */
export function calendarioInUso(scelte = {}, proposto = { inizio: null, mesi: MESI_DI_PARTENZA }) {
  const mesi = {
    prep: interoTra(scelte.mesi?.prep, 0, 60, proposto.mesi.prep),
    riprese: interoTra(scelte.mesi?.riprese, 0, 60, proposto.mesi.riprese),
    post: interoTra(scelte.mesi?.post, 0, 60, proposto.mesi.post),
  };
  if (mesi.prep + mesi.riprese + mesi.post === 0) mesi.riprese = 1;
  return { inizio: meseValido(scelte.inizio) ? scelte.inizio : proposto.inizio, mesi };
}

/** Tappe del calendario come indici di mese (0 = primo mese di preparazione). La consegna è il mese dopo la fine della post-produzione. */
export function tappeCalendario(mesi) {
  const prep = pos(mesi?.prep), riprese = pos(mesi?.riprese), post = pos(mesi?.post);
  const durata = prep + riprese + post;
  return { inizio: 0, riprese: prep, fine_riprese: Math.max(prep, prep + riprese - 1), consegna: durata, durata };
}
const faseDelMese = (i, mesi) => (i < mesi.prep ? 'prep' : i < mesi.prep + mesi.riprese ? 'riprese' : i < mesi.prep + mesi.riprese + mesi.post ? 'post' : 'dopo');
export const NOMI_FASI = { prep: 'Preparazione', riprese: 'Riprese', post: 'Post-produzione', dopo: 'Dopo la consegna' };

/** Curva delle uscite per fase (percentuali del costo): ipotesi di partenza del programma, da adattare al progetto. */
export const CURVA_USCITE = { prep: 20, riprese: 55, post: 25 };

/**
 * Peso di ciascun gruppo di voci del preventivo nelle tre fasi (ipotesi di partenza, modificabili):
 * scrittura in preparazione, cast e troupe sulle riprese, lavorazioni tecniche in post-produzione, fee alla fine.
 */
export const PESI_GRUPPI = {
  1: { prep: 100, riprese: 0, post: 0 },
  2: { prep: 20, riprese: 50, post: 30 },
  3: { prep: 10, riprese: 90, post: 0 },
  4: { prep: 15, riprese: 85, post: 0 },
  5: { prep: 30, riprese: 40, post: 30 },
  6: { prep: 0, riprese: 0, post: 100 },
  7: { prep: 25, riprese: 45, post: 30 },
  8: { prep: 34, riprese: 33, post: 33 },
  9: { prep: 0, riprese: 0, post: 100 },
};

/** Curva per fase ricavata dai gruppi del preventivo: media dei pesi di ogni gruppo, pesata sull'importo. */
export function curvaDaPreventivo(gruppi, pesi = {}) {
  const tot = somma(gruppi || [], (g) => g.importo);
  if (!(tot > 0)) return null;
  const out = { prep: 0, riprese: 0, post: 0 };
  for (const g of gruppi) {
    const w = { ...PESI_GRUPPI[g.id], ...(pesi[g.id] || {}) };
    const parti = ripartisci(pos(g.importo), [w.prep, w.riprese, w.post]);
    const neutre = somma(parti) > 0 ? parti : ripartisci(pos(g.importo), [1, 1, 1]);
    out.prep += neutre[0]; out.riprese += neutre[1]; out.post += neutre[2];
  }
  return { prep: arrot((out.prep / tot) * 100, 2), riprese: arrot((out.riprese / tot) * 100, 2), post: arrot((out.post / tot) * 100, 2) };
}

/**
 * Uscite mese per mese: la quota di ogni fase è divisa in parti uguali sui suoi mesi.
 * La quota di una fase senza mesi passa alle altre in proporzione. La somma è sempre il costo.
 */
export function distribuisciUscite(costo, mesi, curva = CURVA_USCITE) {
  const fasi = ['prep', 'riprese', 'post'];
  const durata = fasi.map((f) => pos(mesi?.[f]));
  const quote = fasi.map((f, i) => (durata[i] > 0 ? pos(curva?.[f]) : 0));
  const usabili = somma(quote) > 0 ? quote : durata.map((d) => (d > 0 ? 1 : 0));
  const perFase = ripartisci(pos(costo), usabili);
  const uscite = perFase.flatMap((importo, i) => (durata[i] > 0 ? ripartisci(importo, Array(durata[i]).fill(1)) : []));
  if (pos(costo) > 0 && uscite.length) uscite[uscite.length - 1] = cent(uscite[uscite.length - 1] + pos(costo) - somma(uscite));
  return uscite;
}

/** Modi in cui una fonte entra in cassa. `ritardo` = mesi dopo la tappa. */
export const TEMPISTICHE = [
  { id: 'inizio', nome: 'Alla firma (inizio preparazione)', ritardo: true },
  { id: 'riprese', nome: 'All’inizio delle riprese', ritardo: true },
  { id: 'fine_riprese', nome: 'A fine riprese', ritardo: true },
  { id: 'lavorazione', nome: 'Lungo tutta la lavorazione', ritardo: false },
  { id: 'consegna', nome: 'Alla consegna', ritardo: true },
  { id: 'quote', nome: 'Per quote di erogazione', ritardo: false },
  { id: 'tax_credit', nome: 'Tax credit in compensazione', ritardo: false },
  { id: 'escluso', nome: 'Non entra in cassa', ritardo: false },
];

/** Tempistica proposta per una voce del piano. I mesi di ritardo sono ipotesi di calendario, non termini di legge. */
export function tempisticaProposta(voce) {
  const v = normalizzaVoce(voce), g = gruppoFonte(v);
  if (v === '1.1') return { tipo: 'quote', ritardo: 0 };
  if (v === '1.2') return { tipo: 'tax_credit', ritardo: 0 };
  if (g === 'pubblico') return { tipo: 'consegna', ritardo: 3 };
  if (v === '2.1') return { tipo: 'inizio', ritardo: 0 };
  if (g === 'proprio' || g === 'coproduzioni' || v === '4.4') return { tipo: 'lavorazione', ritardo: 0 };
  if (g === 'terzi') return { tipo: 'inizio', ritardo: 0 };
  return { tipo: 'consegna', ritardo: 0 };
}

/**
 * Quote di erogazione del contributo dal bando ({ quota, percentuale, condizione }); se il bando non le indica
 * o non arrivano a 100, tutto a saldo: l'anticipo lo decide chi compila. Le tappe sono ipotesi di calendario.
 */
export function quoteBandoProposte(bando) {
  const elenco = (bando?.erogazione || []).filter((q) => num(q?.percentuale) != null && q.percentuale > 0);
  if (elenco.length && Math.abs(somma(elenco, (q) => q.percentuale) - 100) < 0.01) {
    const intermedie = elenco.length > 2;
    return {
      origine: 'bando',
      quote: elenco.map((q, i) => {
        const nome = String(q.quota || `Quota ${i + 1}`);
        const anticipo = /anticip|accont/i.test(nome), saldo = /saldo/i.test(nome) || i === elenco.length - 1;
        return { nome, pct: q.percentuale, condizione: q.condizione || '', anticipo, momento: anticipo ? 'riprese' : 'consegna', ritardo: anticipo ? 0 : saldo ? (intermedie ? 9 : 6) : 3 };
      }),
    };
  }
  return { origine: 'partenza', quote: [
    { nome: 'Anticipo', pct: 0, condizione: '', anticipo: true, momento: 'riprese', ritardo: 0 },
    { nome: 'Saldo', pct: 100, condizione: '', anticipo: false, momento: 'consegna', ritardo: 6 },
  ] };
}

/** Le stesse quote senza anticipo: la percentuale passa alla prima quota successiva. Serve al confronto «con e senza anticipo». */
export function quoteSenzaAnticipo(quote) {
  const q = (quote || []).map((x) => ({ ...x }));
  const prima = q.findIndex((x) => !x.anticipo);
  if (prima < 0) return q;
  for (const x of q) if (x.anticipo && x.pct > 0) { q[prima].pct = arrot(q[prima].pct + x.pct, 4); x.pct = 0; }
  return q;
}

/** Ipotesi di calendario del tax credit (mesi): prima quota dopo l'inizio delle riprese, saldo dopo la consegna. */
export const TAX_CREDIT_CASSA = { ritardoPrima: 3, ritardoSaldo: 6, assorbimento: 1 };

/** Incassi di una fonte: elenco di [indice del mese, importo]. */
export function incassiFonte(importo, tempistica, tappe, { quote = null, taxCredit = {} } = {}) {
  const imp = pos(importo), t = tempistica || {};
  if (!(imp > 0) || t.tipo === 'escluso') return [];
  const rit = Math.max(0, Math.round(pos(t.ritardo)));
  if (t.tipo === 'lavorazione') return ripartisci(imp, Array(Math.max(1, tappe.durata)).fill(1)).map((x, i) => [i, x]);
  if (t.tipo === 'quote') {
    const elenco = (quote || []).filter((q) => pos(q.pct) > 0);
    return elenco.map((q) => [(tappe[q.momento] ?? tappe.consegna) + Math.max(0, Math.round(pos(q.ritardo))), cent((imp * q.pct) / 100)]);
  }
  if (t.tipo === 'tax_credit') {
    const primaPct = Math.min(100, pos(taxCredit.primaPct ?? T.utilizzo.quotaUtilizzabileDopoPreventivaPct.valore));
    const mesiUso = Math.max(1, Math.round(pos(taxCredit.assorbimento ?? TAX_CREDIT_CASSA.assorbimento)));
    const prima = cent((imp * primaPct) / 100), saldo = cent(imp - prima);
    const da1 = tappe.riprese + Math.round(pos(taxCredit.ritardoPrima ?? TAX_CREDIT_CASSA.ritardoPrima));
    const da2 = tappe.consegna + Math.round(pos(taxCredit.ritardoSaldo ?? TAX_CREDIT_CASSA.ritardoSaldo));
    return [...ripartisci(prima, Array(mesiUso).fill(1)).map((x, i) => [da1 + i, x]), ...ripartisci(saldo, Array(mesiUso).fill(1)).map((x, i) => [da2 + i, x])].filter(([, x]) => x > 0);
  }
  return [[(tappe[t.tipo] ?? tappe.consegna) + rit, imp]];
}

const MESI_MASSIMI = 96;

/**
 * Piano di cassa mensile.
 * Uscite: il costo distribuito sulle fasi. Entrate: ogni fonte del piano con la sua tempistica.
 * Saldo cumulato = somma di (entrate − uscite); punta di fabbisogno = il saldo cumulato più negativo.
 * Costo del finanziamento ponte = somma, mese per mese, di saldo negativo × tasso annuo ÷ 12, più la commissione sulla punta.
 */
export function pianoDiCassa({ costo, piano, calendario, curva = CURVA_USCITE, tempi = {}, quote = null, taxCredit = {}, tasso = null, commissione = null } = {}) {
  const mesi = calendario?.mesi || MESI_DI_PARTENZA;
  const tappe = tappeCalendario(mesi);
  const uscite = distribuisciUscite(costo, mesi, curva);
  const chiavi = chiaviRighe(piano);
  const fonti = (piano || []).map((r, i) => {
    const tempistica = { ...tempisticaProposta(r.voce), ...(tempi[chiavi[i]] || {}) };
    const incassi = incassiFonte(r.importo, tempistica, tappe, { quote, taxCredit });
    const incassato = cent(somma(incassi, (x) => x[1]));
    return { chiave: chiavi[i], voce: normalizzaVoce(r.voce), etichetta: [r.etichetta, r.denominazione].filter(Boolean).join(' — ') || 'Fonte senza nome', importo: pos(r.importo), tempistica, incassi, incassato, nonIncassato: cent(pos(r.importo) - incassato) };
  }).filter((f) => f.importo > 0);
  const ultimo = Math.max(tappe.durata, ...fonti.flatMap((f) => f.incassi.map((x) => x[0])));
  const lunghezza = Math.min(MESI_MASSIMI, ultimo + 1);
  const righe = [];
  let cumulato = 0;
  for (let i = 0; i < lunghezza; i++) {
    const perFonte = {};
    for (const f of fonti) for (const [m, x] of f.incassi) if (Math.min(m, lunghezza - 1) === i) perFonte[f.chiave] = cent((perFonte[f.chiave] || 0) + x);
    const entrate = cent(somma(Object.values(perFonte)));
    const out = uscite[i] || 0;
    cumulato = cent(cumulato + entrate - out);
    const mese = calendario?.inizio ? aggiungiMesi(calendario.inizio, i) : null;
    righe.push({ indice: i, mese, etichetta: mese ? etichettaMese(mese) : `Mese ${i + 1}`, fase: faseDelMese(i, mesi), uscite: out, entrate, perFonte, saldo: cent(entrate - out), cumulato });
  }
  const minimo = righe.reduce((m, r) => (r.cumulato < m.cumulato ? r : m), { cumulato: 0, indice: -1 });
  const t = num(tasso);
  let interessi = 0;
  for (const r of righe) { r.interessi = t != null && r.cumulato < 0 ? cent((-r.cumulato * t) / 1200) : 0; interessi = cent(interessi + r.interessi); }
  const punta = Math.max(0, -minimo.cumulato);
  const quotaCommissione = num(commissione) != null ? cent((punta * commissione) / 100) : 0;
  const totUscite = cent(somma(righe, (r) => r.uscite)), totEntrate = cent(somma(righe, (r) => r.entrate));
  return {
    mesi: righe, fonti, tappe, calendario: { inizio: calendario?.inizio || null, mesi },
    totali: { uscite: totUscite, entrate: totEntrate, saldo: cent(totEntrate - totUscite) },
    punta: { importo: punta, indice: punta > 0 ? minimo.indice : null, mese: punta > 0 ? righe[minimo.indice].etichetta : null },
    mesiInRosso: righe.filter((r) => r.cumulato < -0.005).length,
    primoRosso: righe.find((r) => r.cumulato < -0.005)?.etichetta || null,
    ponte: { tasso: t, interessi, commissionePct: num(commissione), commissione: quotaCommissione, costo: cent(interessi + quotaCommissione), sulCosto: pct(cent(interessi + quotaCommissione), num(costo)) },
    nonIncassato: cent(somma(fonti, (f) => f.nonIncassato)),
  };
}

const csv = (righe) => righe.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
const it = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

/** Piano di cassa in CSV (punto e virgola, decimali con la virgola, una colonna per fonte). */
export function csvCassa(cassa) {
  const fonti = cassa.fonti.filter((f) => f.incassato > 0);
  const righe = [['Mese', 'Fase', 'Uscite', ...fonti.map((f) => `Entrata: ${f.voce} ${f.etichetta}`.trim()), 'Totale entrate', 'Saldo del mese', 'Saldo cumulato', 'Interessi sul finanziamento ponte']];
  for (const m of cassa.mesi) righe.push([m.etichetta, NOMI_FASI[m.fase], it(m.uscite), ...fonti.map((f) => it(m.perFonte[f.chiave] || 0)), it(m.entrate), it(m.saldo), it(m.cumulato), it(m.interessi)]);
  righe.push(['Totale', '', it(cassa.totali.uscite), ...fonti.map((f) => it(f.incassato)), it(cassa.totali.entrate), it(cassa.totali.saldo), '', it(cassa.ponte.interessi)]);
  return `﻿${csv(righe)}`;
}

/* ------------------------------------------------------------------ 5. recupero dei ricavi */

const R = REGOLE.recupero;
const medio = (r) => (r.valore.min + r.valore.max) / 2;

export const CANALI_RICAVO = [
  { id: 'sala', nome: 'Sala', nota: 'Incasso al botteghino al netto di IVA e diritti musicali' },
  { id: 'tv', nome: 'Televisione', nota: 'Licenze a emittenti, oltre le prevendite già nel piano' },
  { id: 'piattaforme', nome: 'Piattaforme', nota: 'Licenze a servizi a richiesta, oltre le prevendite già nel piano' },
  { id: 'estero', nome: 'Estero', nota: 'Vendite internazionali, oltre i minimi garantiti già nel piano' },
  { id: 'homevideo', nome: 'Home video', nota: 'Supporti fisici e noleggio o vendita digitale' },
];
export const SCENARI_RICAVO = [{ id: 'prudente', nome: 'Prudente' }, { id: 'atteso', nome: 'Atteso' }, { id: 'favorevole', nome: 'Favorevole' }];

/** Condizioni di partenza: punto medio degli intervalli indicativi della ricerca (stime di mercato, non norme). */
export const CONDIZIONI_RECUPERO = {
  quotaNoleggioPct: { valore: medio(R.quotaNoleggioSuIncassoNettoPct), regola: R.quotaNoleggioSuIncassoNettoPct },
  commissioneSalaPct: { valore: medio(R.commissioneDistribuzioneSalaPct), regola: R.commissioneDistribuzioneSalaPct },
  commissioneVenditePct: { valore: medio(R.commissioneVenditeEstereETvPct), regola: R.commissioneVenditeEstereETvPct },
  premioPct: { valore: medio(R.premioInvestitoriPct), regola: R.premioInvestitoriPct },
};

/** Importi che il piano del dossier suggerisce per il recupero: minimi garantiti, investitori, differimenti, apporto del produttore. */
export function recuperoDalPiano(piano) {
  return {
    minimoGarantito: importoVoci(piano, (v) => /^[78]\./.test(v)),
    investitori: importoVoci(piano, (v) => v === '4.1'),
    differiti: importoVoci(piano, (v) => v === '2.6'),
    daRecuperare: importoVoci(piano, (v) => v === '2.1'),
  };
}

/** Condizioni in uso: quelle scritte dall'utente, poi il piano del dossier, poi i valori indicativi. */
export function condizioniRecupero(scelte = {}, piano = []) {
  const dalPiano = recuperoDalPiano(piano);
  const sceltaO = (k, altrimenti) => (num(scelte[k]) != null ? Math.max(0, scelte[k]) : altrimenti);
  return {
    quotaNoleggioPct: Math.min(100, sceltaO('quotaNoleggioPct', CONDIZIONI_RECUPERO.quotaNoleggioPct.valore)),
    commissioneSalaPct: Math.min(100, sceltaO('commissioneSalaPct', CONDIZIONI_RECUPERO.commissioneSalaPct.valore)),
    commissioneVenditePct: Math.min(100, sceltaO('commissioneVenditePct', CONDIZIONI_RECUPERO.commissioneVenditePct.valore)),
    premioPct: sceltaO('premioPct', CONDIZIONI_RECUPERO.premioPct.valore),
    speseLancio: sceltaO('speseLancio', 0),
    debiti: sceltaO('debiti', 0),
    minimoGarantito: sceltaO('minimoGarantito', dalPiano.minimoGarantito),
    investitori: sceltaO('investitori', dalPiano.investitori),
    differiti: sceltaO('differiti', dalPiano.differiti),
    quotaProduttorePct: Math.min(100, sceltaO('quotaProduttorePct', 100)),
    daRecuperare: sceltaO('daRecuperare', dalPiano.daRecuperare),
  };
}

/**
 * Cascata di recupero su un unico conto (i ricavi di tutti i canali si compensano tra loro: è l'ipotesi più prudente per il produttore).
 * Ordine: quota degli esercenti → commissioni di distribuzione e di vendita → spese di lancio → minimo garantito →
 * finanziatori → investitori con premio → compensi differiti → produttore e coproduttori pro quota.
 * Gli aiuti pubblici a fondo perduto non entrano nella cascata.
 */
export function cascataRecupero(ricavi = {}, c = condizioniRecupero()) {
  const sala = pos(ricavi.sala);
  const altri = CANALI_RICAVO.filter((x) => x.id !== 'sala').map((x) => pos(ricavi[x.id]));
  const lordo = cent(sala + somma(altri));
  const noleggio = cent((sala * c.quotaNoleggioPct) / 100);
  const esercenti = cent(sala - noleggio);
  const commissioneSala = cent((noleggio * c.commissioneSalaPct) / 100);
  const commissioneVendite = cent((somma(altri) * c.commissioneVenditePct) / 100);
  let residuo = cent(lordo - esercenti - commissioneSala - commissioneVendite);
  const netto = residuo;
  const prendi = (dovuto) => { const x = cent(Math.min(residuo, Math.max(0, dovuto))); residuo = cent(residuo - x); return x; };
  const lancio = prendi(c.speseLancio);
  const minimoGarantito = prendi(c.minimoGarantito);
  const allaProduzione = residuo;
  const debiti = prendi(c.debiti);
  const dovutoInvestitori = cent(c.investitori * (1 + c.premioPct / 100));
  const investitori = prendi(dovutoInvestitori);
  const differiti = prendi(c.differiti);
  const daDividere = residuo;
  const produttore = cent((daDividere * c.quotaProduttorePct) / 100);
  const coproduttori = cent(daDividere - produttore);
  const passi = [
    { id: 'lordo', etichetta: 'Ricavi lordi', importo: lordo, segno: 1 },
    { id: 'esercenti', etichetta: 'Quota degli esercenti', importo: esercenti, segno: -1 },
    { id: 'commissioni', etichetta: 'Commissioni di distribuzione e di vendita', importo: cent(commissioneSala + commissioneVendite), segno: -1 },
    { id: 'lancio', etichetta: 'Spese di lancio recuperate dal distributore', importo: lancio, segno: -1, dovuto: c.speseLancio },
    { id: 'mg', etichetta: 'Minimo garantito recuperato dal distributore', importo: minimoGarantito, segno: -1, dovuto: c.minimoGarantito },
    { id: 'debiti', etichetta: 'Rimborso di banche e finanziatori', importo: debiti, segno: -1, dovuto: c.debiti },
    { id: 'investitori', etichetta: 'Investitori: capitale e premio', importo: investitori, segno: -1, dovuto: dovutoInvestitori },
    { id: 'differiti', etichetta: 'Compensi differiti', importo: differiti, segno: -1, dovuto: c.differiti },
    { id: 'coproduttori', etichetta: 'Quota dei coproduttori', importo: coproduttori, segno: -1 },
    { id: 'produttore', etichetta: 'Al produttore', importo: produttore, segno: 1 },
  ];
  return {
    lordo, noleggio, esercenti, commissioneSala, commissioneVendite, netto, lancio, minimoGarantito, allaProduzione, debiti,
    investitori, dovutoInvestitori, differiti, daDividere, produttore, coproduttori, passi,
    daRecuperare: c.daRecuperare, risultato: cent(produttore - c.daRecuperare), inPareggio: produttore + 0.005 >= c.daRecuperare,
    nonRecuperato: { lancio: cent(c.speseLancio - lancio), minimoGarantito: cent(c.minimoGarantito - minimoGarantito), debiti: cent(c.debiti - debiti), investitori: cent(dovutoInvestitori - investitori), differiti: cent(c.differiti - differiti) },
  };
}

/**
 * Punto di pareggio: di quanto devono crescere i ricavi (a parità di ripartizione tra i canali) perché il produttore
 * recuperi il proprio investimento. Restituisce il fattore sui ricavi dello scenario e i ricavi lordi necessari; null se irraggiungibile.
 */
export function puntoDiPareggio(ricavi = {}, c = condizioniRecupero()) {
  const scala = (k) => Object.fromEntries(CANALI_RICAVO.map((x) => [x.id, pos(ricavi[x.id]) * k]));
  const base = cascataRecupero(ricavi, c);
  if (c.daRecuperare <= 0) return { fattore: 0, lordo: 0, raggiunto: true };
  if (!(base.lordo > 0)) return null;
  const basta = (k) => cascataRecupero(scala(k), c).produttore + 0.005 >= c.daRecuperare;
  let alto = 1;
  while (!basta(alto)) { alto *= 2; if (alto > 1e6) return null; }
  let basso = alto === 1 ? 0 : alto / 2;
  for (let i = 0; i < 60; i++) { const mezzo = (basso + alto) / 2; if (basta(mezzo)) alto = mezzo; else basso = mezzo; }
  return { fattore: arrot(alto, 4), lordo: Math.ceil(base.lordo * alto - 0.005), raggiunto: base.inPareggio };
}

/** I tre scenari di incasso con cascata e punto di pareggio. */
export function scenariRecupero(ricavi = {}, scelte = {}, piano = []) {
  const condizioni = condizioniRecupero(scelte, piano);
  return {
    condizioni,
    scenari: SCENARI_RICAVO.map((s) => ({ ...s, ricavi: ricavi[s.id] || {}, ...cascataRecupero(ricavi[s.id] || {}, condizioni), pareggio: puntoDiPareggio(ricavi[s.id] || {}, condizioni) })),
  };
}

/* ------------------------------------------------------------------ 6. indicatori */

/**
 * Indicatori del progetto, ognuno con formula, conti e termine di confronto.
 * `preventivo` sono i totali del preventivo (totaliPreventivo) se c'è; `limiteAiutiPct` il limite d'intensità applicabile.
 */
export function indicatori({ dati = {}, bando = null, preventivo = null, limiteAiutiPct = null } = {}) {
  const e = dati.economici || {}, g = dati.giorni || {};
  const costo = num(e.costoProduzione) != null && e.costoProduzione > 0 ? e.costoProduzione : null;
  const terr = bando?.territorio || 'territorio';
  const euro = (n) => (n == null ? '—' : `${Math.round(n).toLocaleString('it-IT')} €`);
  const frazione = (a, b, ua = '', ub = '') => (num(a) != null && num(b) != null ? `${euro(a)}${ua} ÷ ${ub === ' €' ? euro(b) : `${b.toLocaleString('it-IT')}${ub}`}` : '');
  const b = T.base;
  const lista = [];
  const metti = (x) => lista.push({ esito: 'info', riferimento: null, nota: '', ...x, valore: num(x.valore) });

  metti({ id: 'costo_minuto', gruppo: 'Costo', nome: 'Costo al minuto', unita: 'euro', valore: costo != null && num(dati.durataMin) > 0 ? costo / dati.durataMin : null, formula: 'Costo di produzione ÷ durata in minuti', conti: frazione(costo, dati.durataMin, '', ' min'), manca: 'Servono costo di produzione e durata.' });
  metti({ id: 'costo_giorno', gruppo: 'Costo', nome: 'Costo per giorno di ripresa', unita: 'euro', valore: costo != null && num(g.ripreseTot) > 0 ? costo / g.ripreseTot : null, formula: 'Costo di produzione ÷ giorni di riprese', conti: frazione(costo, g.ripreseTot, '', ' giorni'), manca: 'Servono costo di produzione e giorni di riprese.' });
  metti({ id: 'ammissibile', gruppo: 'Costo', nome: 'Costo ammissibile sul costo di produzione', unita: 'pct', valore: pct(num(e.costoAmmissibile), costo), formula: 'Costo ammissibile ÷ costo di produzione', conti: frazione(e.costoAmmissibile, costo, '', ' €'), manca: 'Servono costo ammissibile e costo di produzione.' });

  if (preventivo && preventivo.costoProduzione > 0) {
    const tot = preventivo.costoProduzione;
    const sopra = preventivo.sopraLinea, sotto = cent(somma(preventivo.gruppi.filter((x) => x.id >= 4 && x.id <= 7), (x) => x.importo));
    const soggetto = vociTaxCreditDaPreventivo(preventivo);
    const limite = tot < b.sogliaCostoSopraLaLinea.valore ? b.sopraLaLineaMaxPctOpereSotto3_5Milioni : b.sopraLaLineaMaxPct;
    const quotaTc = pct(soggetto.sopraLaLinea, tot);
    metti({ id: 'sopra_linea', gruppo: 'Struttura del budget', nome: 'Sopra la linea', unita: 'pct', valore: pct(sopra, tot), formula: 'Soggetto e sceneggiatura, direzione e componente artistica (gruppi 1-3 del preventivo) ÷ costo del preventivo', conti: frazione(sopra, tot, '', ' €'),
      esito: quotaTc != null && quotaTc > limite.valore ? 'attenzione' : 'ok',
      riferimento: { etichetta: `Tax credit: le voci soggette al limite (soggetto e sceneggiatura, diritti, regista, attori principali) pesano ${arrot(quotaTc ?? 0, 1).toLocaleString('it-IT')}%; sono eleggibili fino al ${limite.valore}% del costo`, valore: limite.valore, regola: limite } });
    metti({ id: 'sotto_linea', gruppo: 'Struttura del budget', nome: 'Sotto la linea', unita: 'pct', valore: pct(sotto, tot), formula: 'Produzione, animazione, post-produzione e spese varie (gruppi 4-7 del preventivo) ÷ costo del preventivo', conti: frazione(sotto, tot, '', ' €') });
    const generali = soggetto.speseGenerali;
    metti({ id: 'spese_generali', gruppo: 'Struttura del budget', nome: 'Spese generali sul costo', unita: 'pct', valore: pct(generali, tot), formula: 'Spese generali (gruppo 8 del preventivo) ÷ costo del preventivo', conti: frazione(generali, tot, '', ' €'),
      esito: pct(generali, tot) > b.speseGeneraliMaxPctSulCostoComplessivo.valore ? 'attenzione' : 'ok',
      riferimento: { etichetta: 'Tax credit: imputabili al costo complessivo fino al 7,5%, mai eleggibili', valore: b.speseGeneraliMaxPctSulCostoComplessivo.valore, regola: b.speseGeneraliMaxPctSulCostoComplessivo } });
  } else {
    metti({ id: 'sopra_linea', gruppo: 'Struttura del budget', nome: 'Sopra e sotto la linea', unita: 'pct', valore: null, formula: 'Gruppi 1-3 e 4-7 del preventivo ÷ costo', conti: '', manca: 'Serve il preventivo per voci: compilalo in Produzione › Preventivo.' });
  }
  const fee = num(e.producerFee), feeMax = num(bando?.producerFeeMaxPct), quotaFee = pct(fee, costo);
  const limiteFee = feeMax ?? b.producerFeeMaxPctSulCostoComplessivo.valore;
  metti({ id: 'producer_fee', gruppo: 'Struttura del budget', nome: 'Producer fee sul costo', unita: 'pct', valore: quotaFee, formula: 'Producer fee ÷ costo di produzione', conti: frazione(fee, costo, '', ' €'), manca: 'Servono producer fee e costo di produzione.',
    esito: quotaFee == null ? 'info' : quotaFee > limiteFee + 0.005 ? 'attenzione' : 'ok',
    riferimento: feeMax != null
      ? { etichetta: `Limite del bando: ${String(feeMax).replace('.', ',')}% del costo${feeMax === b.producerFeeMaxPctSulCostoComplessivo.valore ? ' (lo stesso del tax credit)' : ''}`, valore: feeMax, regola: null }
      : { etichetta: 'Tax credit: imputabile al costo complessivo fino al 7,5%, mai eleggibile', valore: limiteFee, regola: b.producerFeeMaxPctSulCostoComplessivo } });

  const aiuti = intensitaAiuti({ piano: dati.piano, costo, limitePct: limiteAiutiPct });
  const struttura = strutturaPiano(dati.piano, costo);
  metti({ id: 'quota_pubblica', gruppo: 'Fonti', nome: 'Quota pubblica', unita: 'pct', valore: aiuti.intensita, formula: 'Aiuti pubblici ÷ costo di produzione', conti: frazione(aiuti.aiuti, costo, '', ' €'), manca: 'Servono piano finanziario e costo di produzione.',
    esito: aiuti.stato === 'superato' ? 'critico' : aiuti.stato === 'vicino' ? 'attenzione' : aiuti.stato === 'ok' ? 'ok' : 'info',
    riferimento: { etichetta: `Limite di intensità applicabile: ${aiuti.limitePct}% del costo`, valore: aiuti.limitePct, regola: A.limiteGeneralePct } });
  metti({ id: 'quota_privata', gruppo: 'Fonti', nome: 'Quota privata', unita: 'pct', valore: costo != null && struttura.righe ? pct(struttura.totale - aiuti.aiuti, costo) : null, formula: '(Totale delle fonti − aiuti pubblici) ÷ costo di produzione', conti: costo != null && struttura.righe ? `(${euro(struttura.totale)} − ${euro(aiuti.aiuti)}) ÷ ${euro(costo)}` : '', manca: 'Servono piano finanziario e costo di produzione.' });
  metti({ id: 'contributo', gruppo: 'Fonti', nome: 'Contributo richiesto sul costo', unita: 'pct', valore: pct(num(e.contributoRichiesto), costo), formula: 'Contributo richiesto con il bando ÷ costo di produzione', conti: frazione(e.contributoRichiesto, costo, '', ' €'), manca: 'Servono contributo richiesto e costo di produzione.' });
  const cop = coperturaPiano(dati);
  metti({ id: 'documentata', gruppo: 'Fonti', nome: 'Copertura documentata sul costo', unita: 'pct', valore: cop.sulCosto, formula: 'Fonti con un documento a supporto, escluso il contributo di questo bando ÷ costo di produzione', conti: cop.sulCosto == null ? '' : `${euro(cop.documentato)} ÷ ${euro(costo)}`, manca: 'Servono piano finanziario e costo di produzione.' });

  const spesa = num(e.spesaSicilia), minimo = num(bando?.spesaTerritorioMinPct) || null;
  const tettoBilancio = A.territorializzazioneMaxPctDelBilancio;
  metti({ id: 'spesa_territorio', gruppo: 'Territorio', nome: `Spesa in ${terr} sul costo`, unita: 'pct', valore: pct(spesa, costo), formula: `Spesa ammissibile in ${terr} ÷ costo di produzione`, conti: frazione(spesa, costo, '', ' €'), manca: `Servono spesa in ${terr} e costo di produzione.`,
    riferimento: { etichetta: `Regola europea: un bando non può imporre spesa sul territorio oltre l’${tettoBilancio.valore}% del bilancio di produzione`, valore: tettoBilancio.valore, regola: tettoBilancio } });
  const suContributo = pct(spesa, num(e.contributoRichiesto));
  metti({ id: 'spesa_contributo', gruppo: 'Territorio', nome: `Spesa in ${terr} sul contributo`, unita: 'pct', valore: suContributo, formula: `Spesa ammissibile in ${terr} ÷ contributo richiesto`, conti: frazione(spesa, e.contributoRichiesto, '', ' €'), manca: `Servono spesa in ${terr} e contributo richiesto.`,
    esito: suContributo == null || !minimo ? 'info' : suContributo + 0.005 >= minimo ? 'ok' : 'critico',
    riferimento: minimo ? { etichetta: `Minimo del bando: ${minimo}% del contributo`, valore: minimo, regola: null } : { etichetta: `Regola europea: l’obbligo di spesa non può superare il ${A.territorializzazioneMaxPctDellAiuto.valore}% dell’aiuto`, valore: A.territorializzazioneMaxPctDellAiuto.valore, regola: A.territorializzazioneMaxPctDellAiuto } });
  return lista;
}

/* ------------------------------------------------------------------ sintesi e dati salvati */

/**
 * Giudizio in una riga sul piano: «critico» se il costo non è coperto o gli aiuti superano il limite,
 * «attenzione» se qualcosa va sistemato, «ok» se sta in piedi, «nd» se mancano i dati.
 */
export function giudizioPiano({ struttura, aiuti, copertura, cassa = null } = {}) {
  const motivi = [];
  if (!struttura || struttura.costo == null || !struttura.righe) return { esito: 'nd', titolo: 'Mancano i dati per giudicare il piano', motivi: [struttura?.costo == null ? 'Manca il costo di produzione.' : 'Il piano finanziario è vuoto.'] };
  let esito = 'ok';
  const peggiora = (a) => { if (a === 'critico' || (a === 'attenzione' && esito === 'ok')) esito = a; };
  const euro = (n) => `${Math.round(n).toLocaleString('it-IT')} €`;
  if (struttura.scoperto > TOLLERANZA_EURO) { peggiora('critico'); motivi.push(`Mancano ${euro(struttura.scoperto)} per coprire il costo.`); }
  if (struttura.eccedenza > TOLLERANZA_EURO) { peggiora('attenzione'); motivi.push(`Le fonti superano il costo di ${euro(struttura.eccedenza)}.`); }
  if (aiuti?.stato === 'superato') { peggiora('critico'); motivi.push(`Gli aiuti pubblici superano il limite del ${aiuti.limitePct}% di ${euro(-aiuti.margine)}.`); }
  if (aiuti?.stato === 'vicino') { peggiora('attenzione'); motivi.push(`Gli aiuti pubblici sono a ${arrot(aiuti.marginePunti, 1).toLocaleString('it-IT')} punti dal limite del ${aiuti.limitePct}%.`); }
  if (copertura && copertura.righe && copertura.nonDocumentato > 0 && (copertura.sulFabbisogno ?? 0) < 50) { peggiora('attenzione'); motivi.push('Meno della metà del fabbisogno ha un documento a supporto.'); }
  if (cassa?.punta?.importo > 0 && struttura.costo > 0) motivi.push(`Punta di fabbisogno di cassa: ${euro(cassa.punta.importo)} a ${cassa.punta.mese}.`);
  const titolo = esito === 'critico' ? 'Il piano non sta in piedi' : esito === 'attenzione' ? 'Il piano regge, con punti da sistemare' : 'Il piano sta in piedi';
  if (!motivi.length) motivi.push('Il costo è coperto e gli aiuti pubblici restano sotto il limite.');
  return { esito, titolo, motivi };
}

const RICAVI_VUOTI = () => Object.fromEntries(SCENARI_RICAVO.map((s) => [s.id, Object.fromEntries(CANALI_RICAVO.map((c) => [c.id, null]))]));

/** Dati della scheda Finanza di un dossier nuovo: tutto ciò che è null usa il valore proposto dal programma. */
export function finanzaVuota() {
  return {
    scenari: [],
    aiuti: { coproduzione: 'nessuna', categoria: null, dichiarata: false, costoBase: null, righe: {} },
    taxCredit: { opera: null, impresa: 'indipendente', maggiorata: false, seriale: false, costoComplessivo: null, sopraLaLinea: null, oneri: null, producerFee: null, speseGenerali: null, nonEleggibili: null, risorseEsterePct: null, creditiAnno: null },
    cassa: { inizio: '', mesi: { prep: null, riprese: null, post: null }, modoUscite: 'curva', curva: { prep: null, riprese: null, post: null }, pesi: {}, tempi: {}, quote: null, taxCredit: { primaPct: null, ritardoPrima: null, ritardoSaldo: null, assorbimento: null }, tasso: null, commissione: null },
    recupero: { ricavi: RICAVI_VUOTI(), quotaNoleggioPct: null, commissioneSalaPct: null, commissioneVenditePct: null, premioPct: null, speseLancio: null, minimoGarantito: null, debiti: null, investitori: null, differiti: null, quotaProduttorePct: null, daRecuperare: null },
  };
}

const eOggetto = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
function completa(dato, modello) {
  if (!eOggetto(modello)) return dato === undefined ? modello : dato;
  const out = eOggetto(dato) ? dato : {};
  for (const [k, v] of Object.entries(modello)) out[k] = eOggetto(v) ? completa(out[k], v) : (out[k] === undefined ? v : out[k]);
  return out;
}

/** Assicura che il dossier abbia `finanza` con tutti i campi (i dossier salvati prima ne hanno meno) e lo restituisce. */
export function preparaFinanza(p) {
  p.finanza = completa(p.finanza, finanzaVuota());
  if (!Array.isArray(p.finanza.scenari)) p.finanza.scenari = [];
  return p.finanza;
}
