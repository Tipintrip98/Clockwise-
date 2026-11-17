// Motore di calcolo deterministico: metriche, fasce di punteggio, soglie, esito.
// Non usa l'AI: tutto ciò che il bando definisce con numeri si calcola qui.

import { METRICHE } from './bandi/schema.js';
import { correggi } from './apprendimento.js';

export const r1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pct = (a, b) => (num(a) != null && num(b) != null && b > 0 ? (a / b) * 100 : null);
const somma = (...v) => (v.every((x) => num(x) != null) ? v.reduce((a, b) => a + b, 0) : null);

export const DOC_VALIDI = ['contratto', 'deal_memo', 'delibera', 'referenze'];
export const ETICHETTE_DOC = {
  contratto: 'Contratto',
  deal_memo: 'Deal memo',
  delibera: 'Delibera ente pubblico',
  referenze: 'Referenze bancarie',
  nessuno: 'Nessun documento',
};

export function getCategoria(bando, categoriaId) {
  return bando.categorie.find((c) => c.id === categoriaId) || bando.categorie[0];
}
export function getGriglia(bando, categoriaId) {
  return bando.griglie[getCategoria(bando, categoriaId).griglia];
}
export function elencoCriteri(griglia) {
  return griglia.sezioni.flatMap((s) => s.criteri.map((c) => ({ ...c, sezione: s.id })));
}

export function datiVuoti() {
  return {
    titolo: '', tipologiaOpera: '', durataMin: null, animazione: false,
    giorni: { prepTot: null, prepSicilia: null, ripreseTot: null, ripreseSicilia: null, postTot: null, postSicilia: null },
    professionisti: { artTot: null, artSicilia: null, crewTot: null, crewSicilia: null },
    economici: { costoProduzione: null, costoAmmissibile: null, contributoRichiesto: null, spesaSicilia: null, producerFee: null },
    piano: [],
    ripreseIniziate: false,
    requisiti: {},
  };
}

// Copertura documentata del piano finanziario: fonti con un documento a supporto,
// escluso il contributo richiesto con questo stesso bando (voce 1.1).
export function coperturaPiano(dati) {
  const piano = (dati.piano || []).filter((r) => num(r.importo) != null && r.importo > 0);
  const costo = num(dati.economici?.costoProduzione);
  const richiesto = num(dati.economici?.contributoRichiesto) || 0;
  const terzi = piano.filter((r) => r.voce !== '1.1');
  const documentato = terzi.filter((r) => DOC_VALIDI.includes(r.documento)).reduce((a, r) => a + r.importo, 0);
  const totalePiano = piano.reduce((a, r) => a + r.importo, 0);
  return {
    righe: piano.length,
    documentato,
    nonDocumentato: terzi.filter((r) => !DOC_VALIDI.includes(r.documento)).reduce((a, r) => a + r.importo, 0),
    totalePiano,
    sulCosto: piano.length && costo ? (documentato / costo) * 100 : null,
    sulFabbisogno: piano.length && costo && costo - richiesto > 0 ? (documentato / (costo - richiesto)) * 100 : null,
  };
}

// Unità di misura delle metriche: quasi tutte sono percentuali, alcune valori assoluti.
export const unitaMetrica = (id) => METRICHE[id]?.unita || 'pct';
export function testoValore(v, unita = 'pct') {
  if (v == null) return '—';
  if (unita === 'euro') return v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  if (unita === 'giorni') return `${v.toLocaleString('it-IT')} ${v === 1 ? 'giorno' : 'giorni'}`;
  if (unita === 'numero') return v.toLocaleString('it-IT');
  return `${(Math.round(v * 10) / 10).toLocaleString('it-IT')}%`;
}

// Ogni metrica ha un valore principale e, dove il testo del bando è ambiguo, una lettura alternativa.
// I campi con il suffisso «Sicilia» indicano, per ragioni storiche, il territorio del bando in uso.
export function calcolaMetriche(dati, bando = null) {
  const g = dati.giorni || {}, p = dati.professionisti || {}, e = dati.economici || {};
  const t = bando?.territorio || 'territorio';
  const nel = bando?.territorio ? `in ${t}` : 'sul territorio';
  const lavSic = somma(g.prepSicilia, g.ripreseSicilia);
  const lavTot = somma(g.prepTot, g.ripreseTot);
  const totGiorni = somma(g.prepTot, g.ripreseTot, g.postTot);
  const locali = somma(p.artSicilia, p.crewSicilia), tuttiProf = somma(p.artTot, p.crewTot);
  const cop = coperturaPiano(dati);
  return {
    lavorazioneSicilia: {
      valore: pct(lavSic, lavTot),
      alternativa: pct(lavSic, totGiorni),
      formula: `giorni ${nel} di pre-produzione e riprese ÷ giorni totali di pre-produzione e riprese`,
      formulaAlternativa: `stessi giorni ${nel} ÷ giorni totali comprensivi di post-produzione`,
      dettaglio: lavSic != null && lavTot != null ? `${lavSic} giorni su ${lavTot}` : null,
    },
    ripreseTerritorioPct: {
      valore: pct(g.ripreseSicilia, g.ripreseTot),
      formula: `giorni di riprese ${nel} ÷ giorni di riprese totali`,
      dettaglio: num(g.ripreseSicilia) != null && num(g.ripreseTot) != null ? `${g.ripreseSicilia} giorni su ${g.ripreseTot}` : null,
    },
    giorniRipreseTerritorio: {
      valore: num(g.ripreseSicilia), unita: 'giorni',
      formula: `giorni di riprese ${nel}`, dettaglio: null,
    },
    postSicilia: {
      valore: pct(g.postSicilia, g.postTot),
      alternativa: pct(g.postSicilia, totGiorni),
      formula: `giorni di post-produzione ${nel} ÷ giorni totali di post-produzione`,
      formulaAlternativa: `giorni di post-produzione ${nel} ÷ giorni totali di lavorazione`,
      dettaglio: num(g.postSicilia) != null && num(g.postTot) != null ? `${g.postSicilia} giorni su ${g.postTot}` : null,
    },
    artisticiSiciliani: {
      valore: pct(p.artSicilia, p.artTot),
      formula: `professionisti del territorio (${t}) nella componente artistica ÷ totale componente artistica`,
      dettaglio: num(p.artSicilia) != null && num(p.artTot) != null ? `${p.artSicilia} su ${p.artTot}` : null,
    },
    tecniciSiciliani: {
      valore: pct(p.crewSicilia, p.crewTot),
      formula: `professionisti del territorio (${t}) nel cast tecnico ÷ totale cast tecnico`,
      dettaglio: num(p.crewSicilia) != null && num(p.crewTot) != null ? `${p.crewSicilia} su ${p.crewTot}` : null,
    },
    professionistiSiciliani: {
      valore: pct(locali, tuttiProf),
      formula: `professionisti del territorio (${t}), artistici e tecnici ÷ totale professionisti`,
      dettaglio: locali != null && tuttiProf != null ? `${locali} su ${tuttiProf}` : null,
    },
    professionistiTerritorio: {
      valore: locali, unita: 'numero',
      formula: `numero di professionisti del territorio (${t}), artistici e tecnici`, dettaglio: null,
    },
    spesaSicilia: {
      valore: pct(e.spesaSicilia, e.contributoRichiesto),
      formula: `spesa ammissibile sostenuta ${nel} ÷ contributo richiesto`,
      dettaglio: null,
    },
    spesaTerritorioSuCosto: {
      valore: pct(e.spesaSicilia, e.costoProduzione),
      formula: `spesa sostenuta ${nel} ÷ costo di produzione`,
      dettaglio: null,
    },
    spesaTerritorioEuro: {
      valore: num(e.spesaSicilia), unita: 'euro',
      formula: `spesa sostenuta ${nel}`, dettaglio: null,
    },
    contributoSuCosto: {
      valore: pct(e.contributoRichiesto, e.costoProduzione),
      formula: 'contributo richiesto ÷ costo di produzione',
      dettaglio: null,
    },
    costoProduzione: {
      valore: num(e.costoProduzione), unita: 'euro',
      formula: 'costo di produzione', dettaglio: null,
    },
    // Lettura principale: sul fabbisogno al netto del contributo richiesto. In un dossier reale di cui si conoscono
    // documenti e punteggi il punteggio della sezione D è compatibile solo con questa lettura.
    copertura: {
      valore: cop.sulFabbisogno ?? cop.sulCosto,
      alternativa: cop.sulFabbisogno != null ? cop.sulCosto : null,
      formula: 'fonti documentate (contratti, deal memo, delibere, referenze bancarie) ÷ costo di produzione al netto del contributo richiesto',
      formulaAlternativa: 'fonti documentate ÷ costo di produzione, contributo richiesto compreso',
      dettaglio: null,
    },
  };
}

function indiceFascia(fasce, valore, flags) {
  for (let i = 0; i < fasce.length; i++) {
    const f = fasce[i];
    if (f.flag) { if (flags && flags[f.flag]) return i; continue; }
    if (valore == null) continue;
    if (f.oltre != null ? valore > f.oltre : valore >= f.da) return i;
  }
  return -1;
}

// Punteggio di un criterio a fasce per un dato valore percentuale.
export function puntiFascia(criterio, valore, flags, unita = 'pct') {
  const i = indiceFascia(criterio.fasce, valore, flags);
  if (i < 0) return { punti: 0, mancante: true, fascia: null, indice: -1, prossima: null, vicinoSoglia: false };
  const f = criterio.fasce[i];
  const punti = r1(f.punti * criterio.peso);
  // fascia migliore successiva raggiungibile con un valore numerico
  let prossima = null;
  for (let j = i - 1; j >= 0; j--) {
    const s = criterio.fasce[j];
    if (s.flag || s.punti <= f.punti) continue; // solo una fascia che vale davvero di più
    prossima = {
      soglia: s.oltre != null ? s.oltre : s.da,
      stretta: s.oltre != null,
      etichetta: s.etichetta,
      guadagno: r1(s.punti * criterio.peso - punti),
    };
    break;
  }
  const scarto = prossima != null && valore != null ? prossima.soglia - valore : null;
  const vicinoSoglia = !f.flag && scarto != null && (unita === 'pct' ? scarto <= 1.5 : unita === 'euro' ? scarto <= prossima.soglia * 0.03 : scarto <= 1);
  return { punti, mancante: false, fascia: f.etichetta, indice: i, prossima, vicinoSoglia };
}

const fmtPct = (v) => testoValore(v, 'pct');

// Risultato dei criteri quantitativi sulla base dei dati dichiarati.
export function valutaQuantitativo(criterio, dati, bando = null) {
  const m = calcolaMetriche(dati, bando)[criterio.metrica];
  const unita = m?.unita || criterio.unita || 'pct';
  const flags = { ripreseIniziate: !!dati.ripreseIniziate };
  const base = puntiFascia(criterio, m?.valore ?? null, flags, unita);
  const avvisi = [];
  let min = base.punti, max = base.punti;
  if (base.mancante) {
    avvisi.push('Dato mancante: inserisci i valori nei Dati chiave.');
  } else {
    if (m.alternativa != null && !(criterio.fasce[base.indice] || {}).flag) {
      const alt = puntiFascia(criterio, m.alternativa, flags, unita);
      if (alt.punti !== base.punti) {
        min = Math.min(min, alt.punti); max = Math.max(max, alt.punti);
        avvisi.push(`Lettura alternativa del bando (${m.formulaAlternativa}): ${testoValore(m.alternativa, unita)} → ${alt.punti.toLocaleString('it-IT')} punti.`);
      }
    }
    if (base.vicinoSoglia) {
      avvisi.push(`Valore a ridosso della soglia: serve ${base.prossima.stretta ? 'più di' : 'almeno'} ${testoValore(base.prossima.soglia, unita)} per la fascia “${base.prossima.etichetta}” (+${base.prossima.guadagno.toLocaleString('it-IT')}).`);
    }
  }
  return {
    id: criterio.id, punti: base.punti, min, max, mancante: base.mancante, unita,
    valore: m?.valore ?? null, valoreTesto: testoValore(m?.valore ?? null, unita), dettaglio: m?.dettaglio || null,
    fascia: base.fascia, prossima: base.prossima, formula: m?.formula, avvisi, fonte: 'calcolo',
  };
}

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function valoreDiscreto(criterio, v) {
  const ammessi = criterio.valori.map((x) => x.punti);
  return ammessi.reduce((best, x) => (Math.abs(x - v) < Math.abs(best - v) ? x : best), ammessi[0]);
}

// Converte il giudizio di un commissario nel punteggio previsto dal tipo di criterio.
export function puntiCommissario(criterio, giudizio, dati) {
  if (!giudizio) return null;
  if (criterio.tipo === 'fasce') {
    const flags = { ripreseIniziate: !!dati?.ripreseIniziate };
    const v = num(giudizio.valore);
    if (v == null && !flags.ripreseIniziate) return null;
    return puntiFascia(criterio, v, flags).punti;
  }
  const p = num(giudizio.punteggio);
  if (p == null) return null;
  if (criterio.tipo === 'discreto') return valoreDiscreto(criterio, p);
  return r1(clamp(p, 0, criterio.max));
}

/**
 * Compone il risultato completo.
 * valutazioni: { [criterioId]: [ { commissario, punteggio, valore, motivazione, evidenze, criticita, miglioramenti } ] }
 */
export function componiRisultato(bando, categoriaId, dati, valutazioni = {}) {
  const categoria = getCategoria(bando, categoriaId);
  const griglia = getGriglia(bando, categoriaId);
  const sezioni = griglia.sezioni.map((sez) => {
    const criteri = sez.criteri.map((c) => {
      const giudizi = (valutazioni[c.id] || []).map((g) => ({ ...g, punti: puntiCommissario(c, g, dati) })).filter((g) => g.punti != null);
      let r;
      if (c.tipo === 'fasce' && !c.giudizio) {
        r = valutaQuantitativo(c, dati, bando);
      } else if (giudizi.length) {
        const pts = giudizi.map((g) => g.punti);
        r = { id: c.id, punti: r1(media(pts)), min: Math.min(...pts), max: Math.max(...pts), fonte: 'commissione', avvisi: [], mancante: false };
        // apprendimento dai casi reali (core/apprendimento.js): solo giudizi puri, mai i criteri con una tabella del bando
        const t = c.tipo !== 'fasce' && c.tipo !== 'discreto' ? valutazioni.correzione?.criteri?.[c.id] : null;
        if (t) {
          const k = correggi(r.punti, t, c.max), d = k.punti - k.grezzo;
          r.taratura = { grezzo: k.grezzo, regole: k.regole, casi: k.casi };
          r.punti = k.punti; r.min = r1(clamp(r.min + d, 0, c.max)); r.max = r1(clamp(r.max + d, 0, c.max));
        }
        // lettura rigorosa: i punti che resterebbero applicando alla lettera i principi di attribuzione
        const rig = giudizi.map((g) => num(g.rigoroso)).filter((v) => v != null).map((v) => clamp(v, 0, c.max));
        if (rig.length) r.rigoroso = r1(Math.min(media(rig), r.punti));
        if (c.tipo === 'fasce') {
          const dich = valutaQuantitativo(c, dati, bando);
          r.dichiarato = dich;
          const vals = giudizi.map((g) => num(g.valore)).filter((v) => v != null);
          if (vals.length) r.valoreTesto = testoValore(media(vals), dich.unita);
          if (!dich.mancante && Math.abs(dich.punti - r.punti) >= 0.1) {
            r.avvisi.push(`Dal piano finanziario dichiarato risulterebbero ${dich.punti.toLocaleString('it-IT')} punti (${dich.valoreTesto}); la commissione simulata riconosce una copertura diversa.`);
          }
        }
      } else if (c.tipo === 'fasce') {
        r = { ...valutaQuantitativo(c, dati, bando), fonte: 'dichiarato' };
        if (!r.mancante) r.avvisi.push('Punteggio provvisorio dai dati dichiarati: la commissione verifica quali fonti sono davvero documentate.');
      } else {
        r = { id: c.id, punti: null, min: null, max: null, fonte: 'non_valutato', avvisi: [], mancante: true };
      }
      return { ...r, nome: c.nome, massimo: c.max, tipo: c.tipo, giudizi };
    });
    const valutati = criteri.filter((c) => c.punti != null);
    const completo = valutati.length === criteri.length && criteri.every((c) => !(c.mancante && c.fonte !== 'non_valutato'));
    const punti = r1(valutati.reduce((a, c) => a + c.punti, 0));
    const min = r1(valutati.reduce((a, c) => a + (c.min ?? c.punti), 0));
    const max = r1(valutati.reduce((a, c) => a + (c.max ?? c.punti), 0));
    const rigoroso = r1(valutati.reduce((a, c) => a + (c.rigoroso ?? c.punti), 0));
    const soglia = categoria.soglie?.[sez.id] ?? null;
    const daValutare = r1(criteri.filter((c) => c.punti == null).reduce((a, c) => a + c.massimo, 0));
    return {
      id: sez.id, nome: sez.nome, massimo: sez.max, soglia, punti, min, max, rigoroso, criteri,
      completo: valutati.length === criteri.length, datiCompleti: completo, daValutare,
      superata: soglia == null ? true : punti >= soglia,
      raggiungibile: soglia == null ? true : punti + daValutare >= soglia,
    };
  });
  // penalità del bando (es. −1 senza rating di legalità): si applicano quando il dossier le conferma
  const penalita = (bando.penalita || []).filter((x) => dati.penalita?.[x.id]).map((x) => ({ ...x }));
  const meno = penalita.reduce((a, x) => a + x.punti, 0);
  const totale = r1(sezioni.reduce((a, s) => a + s.punti, 0) + meno);
  const min = r1(sezioni.reduce((a, s) => a + s.min, 0) + meno);
  const max = r1(sezioni.reduce((a, s) => a + s.max, 0) + meno);
  const rigoroso = r1(sezioni.reduce((a, s) => a + s.rigoroso, 0) + meno);
  // soglia complessiva: sull'intero punteggio oppure solo sulle sezioni indicate dal bando
  const suSezioni = bando.sogliaSuSezioni?.length ? new Set(bando.sogliaSuSezioni) : null;
  const perSoglia = (k) => (suSezioni ? r1(sezioni.filter((s) => suSezioni.has(s.id)).reduce((a, s) => a + s[k], 0) + meno) : { punti: totale, min, rigoroso }[k]);
  const completo = sezioni.every((s) => s.completo);
  const sotto = sezioni.filter((s) => !s.superata);
  const motivi = [];
  if (completo) {
    if (perSoglia('punti') < bando.sogliaTotale) motivi.push(suSezioni ? `Punteggio delle sezioni ${[...suSezioni].join(', ')} ${fmt(perSoglia('punti'))} sotto la soglia di ${bando.sogliaTotale}.` : `Punteggio complessivo ${fmt(totale)} sotto la soglia di ${bando.sogliaTotale}.`);
    for (const s of sotto) motivi.push(`Sezione ${s.id} a ${fmt(s.punti)}: minimo richiesto ${s.soglia}.`);
  }
  // soglie combinate: somme di criteri o di sezioni con un minimo proprio
  const tuttiCriteri = sezioni.flatMap((s) => s.criteri);
  const combinate = (categoria.soglieCombinate || bando.soglieCombinate || []).map((sc) => {
    const parti = [...sc.criteri.map((id) => tuttiCriteri.find((c) => c.id === id)), ...sc.sezioni.map((id) => sezioni.find((s) => s.id === id))].filter(Boolean);
    if (!parti.length) return null; // soglia scritta per un'altra griglia del bando: non riguarda questa categoria
    const somma = (k) => r1(parti.reduce((a, x) => a + (x[k] ?? x.punti ?? 0), 0));
    const nome = sc.etichetta || [...sc.criteri.map((c) => `criterio ${c}`), ...sc.sezioni.map((x) => `sezione ${x}`)].join(' + ');
    return { ...sc, nome, punti: somma('punti'), min: somma('min'), rigoroso: somma('rigoroso'), completa: parti.every((x) => x.punti != null), superata: somma('punti') >= sc.minimo };
  }).filter(Boolean);
  if (completo) for (const sc of combinate) if (!sc.superata) motivi.push(`${sc.nome}: ${fmt(sc.punti)}, minimo richiesto ${fmt(sc.minimo)}.`);
  let esito = 'parziale';
  // «a rischio»: sopra le soglie nella lettura attesa, sotto nella più severa tra i commissari o in quella rigorosa
  const fragile = (k) => combinate.some((sc) => sc[k] < sc.minimo) || perSoglia(k) < bando.sogliaTotale || sezioni.some((s) => s.soglia != null && s[k] < s.soglia);
  if (completo) esito = motivi.length ? 'sotto_soglia' : (fragile('min') || fragile('rigoroso') ? 'a_rischio' : 'ammissibile');
  const sezioniFragili = completo && !motivi.length ? sezioni.filter((s) => s.soglia != null && s.rigoroso < s.soglia && s.punti >= s.soglia).map((s) => s.id) : [];
  const irraggiungibili = sezioni.filter((s) => !s.raggiungibile);
  return {
    categoria: categoria.nome, sogliaTotale: bando.sogliaTotale, massimo: bando.punteggioMassimo || 100,
    sezioni, totale, min, max, rigoroso, sezioniFragili, completo, esito, motivi, penalita, combinate, totaleSoglia: perSoglia('punti'), sogliaSuSezioni: suSezioni ? [...suSezioni] : null,
    bloccanti: irraggiungibili.map((s) => `Sezione ${s.id}: anche con il massimo nei criteri ancora da valutare non si raggiunge il minimo di ${s.soglia}.`),
  };
}

const fmt = (n) => (n == null ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: 1 }));
const euro = (n) => (n == null ? '—' : n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }));

// Controlli di ammissibilità ricavabili dai numeri e dall'elenco degli allegati.
export function verificheAmmissibilita(bando, categoriaId, anno, dati, tipiPresenti = []) {
  const cat = getCategoria(bando, categoriaId);
  const e = dati.economici || {};
  const out = [];
  const add = (id, esito, titolo, dettaglio) => out.push({ id, esito, titolo, dettaglio });
  const ha = (t) => tipiPresenti.includes(t);

  // durata
  if (num(dati.durataMin) == null) add('durata', 'da_verificare', 'Durata dell’opera', 'Durata non indicata.');
  else if (cat.durataMin && dati.durataMin < cat.durataMin) add('durata', 'critico', 'Durata dell’opera', `${dati.durataMin} minuti: per questa categoria servono almeno ${cat.durataMin} minuti.`);
  else if (cat.durataMaxEsclusa && dati.durataMin >= cat.durataMaxEsclusa) add('durata', 'critico', 'Durata dell’opera', `${dati.durataMin} minuti: un cortometraggio deve durare meno di ${cat.durataMaxEsclusa} minuti.`);
  else add('durata', 'ok', 'Durata dell’opera', `${dati.durataMin} minuti, coerente con la categoria.`);

  // contributo richiesto
  const costo = num(e.costoProduzione), rich = num(e.contributoRichiesto);
  const massimale = cat.contributo?.massimali?.[anno];
  if (costo == null || rich == null || costo <= 0) add('contributo', 'da_verificare', 'Contributo richiesto', 'Indica costo di produzione e contributo richiesto.');
  else {
    const tetto = Math.min((costo * cat.contributo.percentuale) / 100, massimale ?? Infinity);
    if (rich > tetto + 0.5) add('contributo', 'attenzione', 'Contributo richiesto', `${euro(rich)} supera il massimo concedibile di ${euro(tetto)} (${cat.contributo.percentuale}% del costo di produzione${massimale ? `, tetto ${euro(massimale)}` : ''}). Riduci la richiesta: oltre il tetto non viene concesso nulla e una richiesta più alta abbassa il rapporto tra spesa sul territorio e contributo.`);
    else add('contributo', 'ok', 'Contributo richiesto', `${euro(rich)}, pari al ${fmt((rich / costo) * 100)}% del costo di produzione (massimo ${cat.contributo.percentuale}%${massimale ? `, tetto ${euro(massimale)}` : ''}).`);
  }

  // spesa sul territorio (solo se il bando fissa un minimo in rapporto al contributo)
  const spesa = num(e.spesaSicilia), minPct = bando.spesaTerritorioMinPct || 0;
  const dove = `Spesa in ${bando.territorio || 'regione'}`;
  if (minPct > 0) {
    if (spesa == null || rich == null || rich <= 0) add('spesa', 'da_verificare', dove, 'Indica la spesa ammissibile sul territorio e il contributo richiesto.');
    else {
      const p = (spesa / rich) * 100;
      if (p < minPct) add('spesa', 'critico', dove, `${fmt(p)}% del contributo: il minimo di ammissibilità è ${minPct}% (servono almeno ${euro((rich * minPct) / 100)}).`);
      else if (p < minPct + 1) add('spesa', 'attenzione', dove, `${fmt(p)}% del contributo: ammissibile, ma al minimo esatto ogni scostamento a consuntivo espone alla revoca.`);
      else add('spesa', 'ok', dove, `${fmt(p)}% del contributo richiesto (minimo ${minPct}%).`);
    }
  } else if (bando.spesaTerritorioMinSuCostoPct > 0) {
    const minC = bando.spesaTerritorioMinSuCostoPct;
    if (spesa == null || costo == null || costo <= 0) add('spesa', 'da_verificare', dove, 'Indica la spesa sul territorio e il costo di produzione.');
    else {
      const p = (spesa / costo) * 100;
      if (p < minC) add('spesa', 'critico', dove, `${fmt(p)}% del costo di produzione: il minimo richiesto è ${minC}% (servono almeno ${euro((costo * minC) / 100)}).`);
      else add('spesa', 'ok', dove, `${fmt(p)}% del costo di produzione (minimo ${minC}%).`);
    }
  }

  // quadratura budget / piano finanziario
  const cop = coperturaPiano(dati);
  if (cop.righe && costo != null) {
    const diff = costo - cop.totalePiano;
    if (Math.abs(diff) > 1) add('quadratura', 'critico', 'Quadratura budget e piano finanziario', `Il piano finanziario (${euro(cop.totalePiano)}) non coincide con il costo di produzione (${euro(costo)}): differenza ${euro(diff)}.`);
    else add('quadratura', 'ok', 'Quadratura budget e piano finanziario', 'Il piano finanziario copre esattamente il costo di produzione.');
  } else add('quadratura', 'da_verificare', 'Quadratura budget e piano finanziario', 'Inserisci le fonti del piano finanziario per verificare la quadratura.');

  // producer fee (solo se il bando fissa un tetto)
  const tettoFee = num(bando.producerFeeMaxPct);
  if (tettoFee != null && num(e.producerFee) != null && costo) {
    const p = (e.producerFee / costo) * 100;
    if (p > tettoFee + 0.01) add('fee', 'attenzione', 'Producer fee', `${fmt(p)}% del costo: la quota oltre il ${fmt(tettoFee)}% non è ammissibile.`);
    else add('fee', 'ok', 'Producer fee', `${fmt(p)}% del costo di produzione (ammissibile fino al ${fmt(tettoFee)}%).`);
  }

  // fattibilità: un criterio sulla copertura finanziaria che vale zero può rendere irraggiungibile il minimo della sua sezione
  const criterioCopertura = elencoCriteri(getGriglia(bando, categoriaId)).find((c) => c.tipo === 'fasce' && c.metrica === 'copertura');
  if (criterioCopertura && cop.righe && costo != null && !dati.ripreseIniziate) {
    const rc = valutaQuantitativo(criterioCopertura, dati, bando);
    const sez = getGriglia(bando, categoriaId).sezioni.find((x) => x.id === criterioCopertura.sezione);
    const minimo = cat.soglie?.[criterioCopertura.sezione];
    if (!rc.mancante && rc.max === 0 && minimo != null && sez.max - criterioCopertura.max < minimo) {
      add('copertura', 'critico', 'Copertura finanziaria documentata', `Solo il ${fmt(cop.sulCosto)}% del costo ha un documento a supporto: il criterio ${criterioCopertura.id} vale 0 punti e la sezione ${sez.id} non può raggiungere il minimo di ${fmt(minimo)}.`);
    }
  }

  // allegati
  const piano = dati.piano || [];
  const dichiarati = {
    coproduzione: piano.some((r) => /^(2\.[2-5]|3\.)/.test(r.voce || '')),
    distribuzione: piano.some((r) => /^[5-8]\./.test(r.voce || '')),
    finanziamenti: piano.some((r) => /^1\.[3-6]/.test(r.voce || '') && r.documento === 'delibera'),
    finanziatori_esterni: piano.some((r) => /^4\./.test(r.voce || '')),
  };
  for (const a of bando.allegati || []) {
    const presente = ha(a.tipo);
    if (a.obbligo === 'sempre') add(`all_${a.tipo}`, presente ? 'ok' : 'critico', a.nome, presente ? 'Presente nel dossier.' : 'Allegato obbligatorio non caricato: senza, l’istanza è irricevibile.');
    else if (a.obbligo === 'green') {
      if (cat.greenFilm && !dati.animazione) add(`all_${a.tipo}`, presente ? 'ok' : 'critico', a.nome, presente ? 'Presente nel dossier.' : 'Requisito di ammissibilità per film e serie TV non in animazione.');
    } else if (a.obbligo === 'punteggio') {
      if (!presente) add(`all_${a.tipo}`, 'attenzione', a.nome, a.criteri?.length ? `Non caricato: senza questi documenti ${a.criteri.length > 1 ? 'i criteri' : 'il criterio'} ${a.criteri.join(' e ')} non ${a.criteri.length > 1 ? 'ricevono' : 'riceve'} punteggio pieno.` : 'Non caricato: senza questi documenti i criteri che li considerano non ricevono punteggio pieno.');
      else add(`all_${a.tipo}`, 'ok', a.nome, 'Presente nel dossier.');
    } else if (a.obbligo === 'se_dichiarato') {
      if (dichiarati[a.tipo] && !presente) add(`all_${a.tipo}`, 'critico', a.nome, 'Il piano finanziario dichiara queste fonti ma i documenti non sono nel dossier.');
      else if (presente) add(`all_${a.tipo}`, 'ok', a.nome, 'Presente nel dossier.');
    } else if (a.obbligo === 'consigliato' && !presente) {
      add(`all_${a.tipo}`, 'attenzione', a.nome, 'Facoltativo, ma aiuta la commissione a verificare i giorni di lavorazione dichiarati.');
    }
  }

  // requisiti dichiarativi
  for (const rq of bando.requisiti || []) {
    add(`req_${rq.id}`, dati.requisiti?.[rq.id] ? 'ok' : 'da_verificare', rq.testo, dati.requisiti?.[rq.id] ? 'Confermato.' : 'Da confermare a mano.');
  }
  return out;
}

// Mosse concrete per salire di fascia nei criteri quantitativi.
export function suggerimentiQuantitativi(bando, categoriaId, dati) {
  const griglia = getGriglia(bando, categoriaId);
  const g = dati.giorni || {}, p = dati.professionisti || {}, e = dati.economici || {};
  const out = [];
  const serve = (tot, soglia, stretta) => (stretta ? Math.floor((tot * soglia) / 100) + 1 : Math.ceil((tot * soglia) / 100));
  const nel = bando.territorio ? `in ${bando.territorio}` : 'sul territorio';
  const locali = bando.gentilizio || 'del territorio';
  for (const c of elencoCriteri(griglia).filter((x) => x.tipo === 'fasce')) {
    const r = valutaQuantitativo(c, dati, bando);
    if (r.mancante || !r.prossima || r.prossima.guadagno <= 0) continue;
    const { soglia, stretta, guadagno, etichetta } = r.prossima;
    let azione = null;
    const quanto = (v) => testoValore(v, r.unita);
    if (c.metrica === 'tecniciSiciliani' && num(p.crewTot)) {
      const n = serve(p.crewTot, soglia, stretta);
      if (n <= p.crewTot) azione = `Porta i tecnici ${locali} da ${p.crewSicilia} a ${n} su ${p.crewTot}.`;
    } else if (c.metrica === 'artisticiSiciliani' && num(p.artTot)) {
      const n = serve(p.artTot, soglia, stretta);
      if (n <= p.artTot) azione = `Porta i professionisti ${locali} della componente artistica da ${p.artSicilia} a ${n} su ${p.artTot}.`;
    } else if (c.metrica === 'professionistiSiciliani' && num(p.artTot) != null && num(p.crewTot) != null) {
      const tot = p.artTot + p.crewTot, n = serve(tot, soglia, stretta);
      if (n <= tot) azione = `Porta i professionisti ${locali} da ${p.artSicilia + p.crewSicilia} a ${n} su ${tot}.`;
    } else if (c.metrica === 'professionistiTerritorio') {
      azione = `Porta i professionisti ${locali} da ${quanto(r.valore)} a ${stretta ? 'più di' : 'almeno'} ${quanto(soglia)}.`;
    } else if (c.metrica === 'lavorazioneSicilia' && num(g.prepTot) != null && num(g.ripreseTot) != null) {
      const tot = g.prepTot + g.ripreseTot, n = serve(tot, soglia, stretta);
      if (n <= tot) azione = `Porta i giorni ${nel} di pre-produzione e riprese da ${g.prepSicilia + g.ripreseSicilia} a ${n} su ${tot}.`;
    } else if (c.metrica === 'ripreseTerritorioPct' && num(g.ripreseTot)) {
      const n = serve(g.ripreseTot, soglia, stretta);
      if (n <= g.ripreseTot) azione = `Porta i giorni di riprese ${nel} da ${g.ripreseSicilia} a ${n} su ${g.ripreseTot}.`;
    } else if (c.metrica === 'giorniRipreseTerritorio') {
      azione = `Porta i giorni di riprese ${nel} da ${quanto(r.valore)} a ${stretta ? 'più di' : 'almeno'} ${quanto(soglia)}.`;
    } else if (c.metrica === 'postSicilia' && num(g.postTot)) {
      const n = serve(g.postTot, soglia, stretta);
      if (n <= g.postTot) azione = `Porta i giorni di post-produzione ${nel} da ${g.postSicilia} a ${n} su ${g.postTot}.`;
    } else if (c.metrica === 'spesaSicilia' && num(e.contributoRichiesto)) {
      const target = (e.contributoRichiesto * soglia) / 100;
      azione = `Porta la spesa ammissibile ${nel} da ${euro(e.spesaSicilia)} a ${stretta ? 'oltre' : 'almeno'} ${euro(target)}, oppure riduci il contributo richiesto sotto ${euro((e.spesaSicilia / soglia) * 100)}.`;
    } else if (c.metrica === 'spesaTerritorioSuCosto' && num(e.costoProduzione)) {
      azione = `Porta la spesa ${nel} da ${euro(e.spesaSicilia)} a ${stretta ? 'oltre' : 'almeno'} ${euro((e.costoProduzione * soglia) / 100)} (${soglia}% del costo di produzione).`;
    } else if (c.metrica === 'spesaTerritorioEuro') {
      azione = `Porta la spesa ${nel} da ${euro(e.spesaSicilia)} a ${stretta ? 'oltre' : 'almeno'} ${euro(soglia)}.`;
    } else if (c.metrica === 'copertura' && num(e.costoProduzione)) {
      const target = ((e.costoProduzione - (num(e.contributoRichiesto) || 0)) * soglia) / 100;
      azione = `Documenta fonti per ${stretta ? 'più di' : 'almeno'} ${euro(target)} (${stretta ? 'oltre il' : ''} ${soglia}% del costo al netto del contributo richiesto): contratti, deal memo, delibere o referenze bancarie.`;
    }
    if (azione) out.push({ criterio: c.id, nome: c.nome, azione, guadagno, fascia: etichetta });
  }
  return out.sort((a, b) => b.guadagno - a.guadagno);
}

// Contributo atteso. Regola «proporzionale_al_primo» (Sicilia, art. 11.1): il primo in graduatoria ottiene il 100% del
// richiesto, gli altri in proporzione al punteggio. Senza regola il contributo concedibile coincide con il richiesto.
export function stimaContributo(richiesto, punteggio, punteggioPrimo, regola = 'proporzionale_al_primo') {
  if (num(richiesto) == null) return null;
  if (regola !== 'proporzionale_al_primo') return richiesto;
  if (num(punteggio) == null || !punteggioPrimo) return null;
  return Math.min(richiesto, (richiesto * punteggio) / Math.max(punteggio, punteggioPrimo));
}

// --- Esiti reali delle finestre precedenti (bando.esiti): metro della Commissione e posizione in graduatoria
const quantile = (ord, q) => { const i = (ord.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return ord[lo] + (ord[hi] - ord[lo]) * (i - lo); };
const distribuzione = (valori) => {
  const o = [...valori].sort((a, b) => a - b);
  return { min: o[0], q1: r1(quantile(o, 0.25)), mediana: r1(quantile(o, 0.5)), q3: r1(quantile(o, 0.75)), max: o[o.length - 1] };
};
// Edizione di riferimento: la più recente (anno più alto) che ha righe per la categoria. Le altre edizioni complete
// restano casi reali in più, letti da statisticheFinanziati e storicoFinanziamento.
const ultimaEdizione = (bando, categoriaId) => (bando.esiti || []).filter((e) => e.categorie?.[categoriaId]?.length)
  .reduce((a, e) => (!a || e.anno > a.anno ? e : a), null);

export function statisticheEsiti(bando, categoriaId) {
  const edizione = ultimaEdizione(bando, categoriaId);
  const righe = edizione?.categorie?.[categoriaId];
  if (!righe?.length) return null;
  const cat = getCategoria(bando, categoriaId);
  const finanziati = righe.filter((r) => r.stato === 'F');
  const sezioni = {}, esclusiPer = {};
  for (const k of Object.keys(righe[0].sezioni)) {
    sezioni[k] = distribuzione(righe.map((r) => r.sezioni[k]));
    esclusiPer[k] = righe.filter((r) => cat.soglie?.[k] != null && r.sezioni[k] < cat.soglie[k]).length;
  }
  return {
    anno: edizione.anno, fonte: edizione.fonte, url: edizione.url,
    valutati: righe.length, ammissibili: righe.filter((r) => r.stato !== 'X').length, finanziati: finanziati.length,
    primo: Math.max(...righe.map((r) => r.totale)),
    ultimoFinanziato: finanziati.length ? Math.min(...finanziati.map((r) => r.totale)) : null,
    totale: distribuzione(righe.map((r) => r.totale)), sezioni, esclusiPer,
  };
}

// Dove si sarebbe collocato un punteggio tra i progetti ammissibili dell'ultima finestra nota.
export function posizioneEsiti(bando, categoriaId, punteggio) {
  const edizione = ultimaEdizione(bando, categoriaId);
  const righe = edizione?.categorie?.[categoriaId];
  if (!righe?.length || num(punteggio) == null) return null;
  const ammissibili = righe.filter((r) => r.stato !== 'X');
  const finanziati = righe.filter((r) => r.stato === 'F');
  const ultimo = finanziati.length ? Math.min(...finanziati.map((r) => r.totale)) : null;
  return {
    posizione: ammissibili.filter((r) => r.totale > punteggio).length + 1,
    su: ammissibili.length + 1,
    finanziabile: ultimo == null ? null : punteggio >= ultimo,
    ultimoFinanziato: ultimo,
  };
}

// Come sono andati, sezione per sezione, i progetti finanziati in tutte le finestre note.
export function statisticheFinanziati(bando, categoriaId) {
  const edizioni = [...(bando.esitiFinanziati || []), ...(bando.esiti || [])];
  const righe = edizioni.flatMap((e) => (e.categorie?.[categoriaId] || []).filter((r) => r.stato === 'F'));
  if (!righe.length) return null;
  const sezioni = {};
  for (const k of Object.keys(righe[0].sezioni)) sezioni[k] = distribuzione(righe.map((r) => r.sezioni[k]));
  return { progetti: righe.length, anni: [...new Set(edizioni.filter((e) => (e.categorie?.[categoriaId] || []).some((r) => r.stato === 'F')).map((e) => e.anno))].sort(), sezioni, totale: distribuzione(righe.map((r) => r.totale)) };
}

// Storico della soglia di finanziamento: per ogni finestra nota, primo e ultimo progetto finanziato (a consuntivo).
export function storicoFinanziamento(bando, categoriaId) {
  return [...(bando.esitiFinanziati || []), ...(bando.esiti || [])].map((e) => {
    const fin = (e.categorie?.[categoriaId] || []).filter((r) => r.stato === 'F');
    if (!fin.length) return null;
    const tot = fin.map((r) => r.totale);
    return { anno: e.anno, fonte: e.fonte, url: e.url, finanziati: fin.length, primo: Math.max(...tot), ultimoFinanziato: Math.min(...tot), soloFinanziati: !!e.soloFinanziati,
      // prima graduatoria (prima di rinunce e scorrimenti) e quanti sono entrati dopo, per scorrimento
      ultimoInCapienza: e.ultimoInCapienza?.[categoriaId] ?? null, perScorrimento: fin.filter((r) => r.scorrimento).length };
  }).filter(Boolean).sort((a, b) => a.anno - b.anno);
}

/**
 * Previsione senza lettura dei documenti. Le sezioni già complete restano quelle calcolate; per le altre si usano
 * i punteggi che la Commissione ha realmente attribuito nell'ultima finestra completa, in due modi:
 *  - scenari: primo quartile, mediana e terzo quartile di ciascuna sezione mancante;
 *  - empirica: il dossier viene completato, di volta in volta, con i punteggi reali di ciascun progetto valutato
 *    (così resta la correlazione tra sezioni) e si conta in quanti casi supera le soglie e l'ultimo finanziato.
 * Ogni valore è riportato entro i limiti possibili per il dossier (punti già certi ÷ massimo ancora ottenibile).
 */
export function previsioneStatistica(bando, categoriaId, ris) {
  const edizione = ultimaEdizione(bando, categoriaId);
  const righe = edizione?.categorie?.[categoriaId];
  const st = statisticheEsiti(bando, categoriaId);
  if (!righe?.length || !st) return null;
  const stimate = ris.sezioni.filter((s) => !s.completo && st.sezioni[s.id]);
  const entro = (s, v) => r1(clamp(v, s.punti, s.punti + s.daValutare));
  const componi = (valori) => {
    const sezioni = ris.sezioni.map((s) => ({ id: s.id, punti: valori[s.id] ?? s.punti, soglia: s.soglia, stimata: s.id in valori }));
    const totale = r1(sezioni.reduce((a, s) => a + s.punti, 0));
    const sotto = sezioni.filter((s) => s.soglia != null && s.punti < s.soglia).map((s) => s.id);
    return { totale, sezioni, sotto, ammissibile: totale >= bando.sogliaTotale && !sotto.length };
  };
  const scenario = (k) => componi(Object.fromEntries(stimate.map((s) => [s.id, entro(s, st.sezioni[s.id][k])])));
  const casi = righe.map((r) => componi(Object.fromEntries(stimate.map((s) => [s.id, entro(s, r.sezioni[s.id])]))));
  const ammissibili = casi.filter((c) => c.ammissibile);
  const cadute = {};
  for (const c of casi) for (const id of c.sotto) cadute[id] = (cadute[id] || 0) + 1;
  const peggiore = Object.entries(cadute).sort((a, b) => b[1] - a[1])[0] || null;
  return {
    anno: edizione.anno, valutati: righe.length, completa: !stimate.length, sezioniStimate: stimate.map((s) => s.id),
    scenari: { basso: scenario('q1'), atteso: scenario('mediana'), alto: scenario('q3') },
    empirica: {
      casi: casi.length, ammissibili: ammissibili.length,
      finanziabili: st.ultimoFinanziato == null ? null : ammissibili.filter((c) => c.totale >= st.ultimoFinanziato).length,
      sezioneCritica: peggiore ? { id: peggiore[0], casi: peggiore[1] } : null,
    },
    ultimoFinanziato: st.ultimoFinanziato, sogliaTotale: bando.sogliaTotale,
  };
}

export const formati = { fmt, euro, fmtPct };
