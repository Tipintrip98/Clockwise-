// Motore di calcolo deterministico: metriche, fasce di punteggio, soglie, esito.
// Non usa l'AI: tutto ciò che il bando definisce con numeri si calcola qui.

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

// Ogni metrica ha un valore principale e, dove il testo del bando è ambiguo, una lettura alternativa.
export function calcolaMetriche(dati) {
  const g = dati.giorni || {}, p = dati.professionisti || {}, e = dati.economici || {};
  const lavSic = somma(g.prepSicilia, g.ripreseSicilia);
  const lavTot = somma(g.prepTot, g.ripreseTot);
  const totGiorni = somma(g.prepTot, g.ripreseTot, g.postTot);
  const cop = coperturaPiano(dati);
  return {
    lavorazioneSicilia: {
      valore: pct(lavSic, lavTot),
      alternativa: pct(lavSic, totGiorni),
      formula: 'giorni in Sicilia di pre-produzione e riprese ÷ giorni totali di pre-produzione e riprese',
      formulaAlternativa: 'stessi giorni in Sicilia ÷ giorni totali comprensivi di post-produzione',
      dettaglio: lavSic != null && lavTot != null ? `${lavSic} giorni su ${lavTot}` : null,
    },
    postSicilia: {
      valore: pct(g.postSicilia, g.postTot),
      alternativa: pct(g.postSicilia, totGiorni),
      formula: 'giorni di post-produzione in Sicilia ÷ giorni totali di post-produzione',
      formulaAlternativa: 'giorni di post-produzione in Sicilia ÷ giorni totali di lavorazione',
      dettaglio: num(g.postSicilia) != null && num(g.postTot) != null ? `${g.postSicilia} giorni su ${g.postTot}` : null,
    },
    artisticiSiciliani: {
      valore: pct(p.artSicilia, p.artTot),
      formula: 'professionisti siciliani della componente artistica ÷ totale componente artistica',
      dettaglio: num(p.artSicilia) != null && num(p.artTot) != null ? `${p.artSicilia} su ${p.artTot}` : null,
    },
    tecniciSiciliani: {
      valore: pct(p.crewSicilia, p.crewTot),
      formula: 'professionisti siciliani del cast tecnico ÷ totale cast tecnico',
      dettaglio: num(p.crewSicilia) != null && num(p.crewTot) != null ? `${p.crewSicilia} su ${p.crewTot}` : null,
    },
    professionistiSiciliani: {
      valore: pct(somma(p.artSicilia, p.crewSicilia), somma(p.artTot, p.crewTot)),
      formula: 'professionisti siciliani (artistici e tecnici) ÷ totale professionisti',
      dettaglio: somma(p.artSicilia, p.crewSicilia) != null && somma(p.artTot, p.crewTot) != null
        ? `${p.artSicilia + p.crewSicilia} su ${p.artTot + p.crewTot}` : null,
    },
    spesaSicilia: {
      valore: pct(e.spesaSicilia, e.contributoRichiesto),
      formula: 'spesa ammissibile sostenuta in Sicilia ÷ contributo richiesto',
      dettaglio: null,
    },
    copertura: {
      valore: cop.sulCosto,
      alternativa: cop.sulFabbisogno,
      formula: 'fonti documentate (contratti, deal memo, delibere, referenze bancarie) ÷ costo di produzione',
      formulaAlternativa: 'fonti documentate ÷ costo di produzione al netto del contributo richiesto',
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
export function puntiFascia(criterio, valore, flags) {
  const i = indiceFascia(criterio.fasce, valore, flags);
  if (i < 0) return { punti: 0, mancante: true, fascia: null, indice: -1, prossima: null, vicinoSoglia: false };
  const f = criterio.fasce[i];
  const punti = r1(f.punti * criterio.peso);
  // fascia migliore successiva raggiungibile con un valore numerico
  let prossima = null;
  for (let j = i - 1; j >= 0; j--) {
    const s = criterio.fasce[j];
    if (s.flag) continue;
    prossima = {
      soglia: s.oltre != null ? s.oltre : s.da,
      stretta: s.oltre != null,
      etichetta: s.etichetta,
      guadagno: r1(s.punti * criterio.peso - punti),
    };
    break;
  }
  const vicinoSoglia = !f.flag && prossima != null && valore != null && prossima.soglia - valore <= 1.5;
  return { punti, mancante: false, fascia: f.etichetta, indice: i, prossima, vicinoSoglia };
}

const fmtPct = (v) => (v == null ? '—' : `${(Math.round(v * 10) / 10).toLocaleString('it-IT')}%`);

// Risultato dei criteri quantitativi sulla base dei dati dichiarati.
export function valutaQuantitativo(criterio, dati) {
  const m = calcolaMetriche(dati)[criterio.metrica];
  const flags = { ripreseIniziate: !!dati.ripreseIniziate };
  const base = puntiFascia(criterio, m?.valore ?? null, flags);
  const avvisi = [];
  let min = base.punti, max = base.punti;
  if (base.mancante) {
    avvisi.push('Dato mancante: inserisci i valori nei Dati chiave.');
  } else {
    if (m.alternativa != null && !(criterio.fasce[base.indice] || {}).flag) {
      const alt = puntiFascia(criterio, m.alternativa, flags);
      if (alt.punti !== base.punti) {
        min = Math.min(min, alt.punti); max = Math.max(max, alt.punti);
        avvisi.push(`Lettura alternativa del bando (${m.formulaAlternativa}): ${fmtPct(m.alternativa)} → ${alt.punti.toLocaleString('it-IT')} punti.`);
      }
    }
    if (base.vicinoSoglia) {
      avvisi.push(`Valore a ridosso della soglia: serve ${base.prossima.stretta ? 'più del' : 'almeno il'} ${base.prossima.soglia}% per la fascia “${base.prossima.etichetta}” (+${base.prossima.guadagno.toLocaleString('it-IT')}).`);
    }
  }
  return {
    id: criterio.id, punti: base.punti, min, max, mancante: base.mancante,
    valore: m?.valore ?? null, valoreTesto: fmtPct(m?.valore ?? null), dettaglio: m?.dettaglio || null,
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
        r = valutaQuantitativo(c, dati);
      } else if (giudizi.length) {
        const pts = giudizi.map((g) => g.punti);
        r = { id: c.id, punti: r1(media(pts)), min: Math.min(...pts), max: Math.max(...pts), fonte: 'commissione', avvisi: [], mancante: false };
        if (c.tipo === 'fasce') {
          const dich = valutaQuantitativo(c, dati);
          r.dichiarato = dich;
          const vals = giudizi.map((g) => num(g.valore)).filter((v) => v != null);
          if (vals.length) r.valoreTesto = fmtPct(media(vals));
          if (!dich.mancante && Math.abs(dich.punti - r.punti) >= 0.1) {
            r.avvisi.push(`Dal piano finanziario dichiarato risulterebbero ${dich.punti.toLocaleString('it-IT')} punti (${dich.valoreTesto}); la commissione simulata riconosce una copertura diversa.`);
          }
        }
      } else if (c.tipo === 'fasce') {
        r = { ...valutaQuantitativo(c, dati), fonte: 'dichiarato' };
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
    const soglia = categoria.soglie?.[sez.id] ?? null;
    const daValutare = r1(criteri.filter((c) => c.punti == null).reduce((a, c) => a + c.massimo, 0));
    return {
      id: sez.id, nome: sez.nome, massimo: sez.max, soglia, punti, min, max, criteri,
      completo: valutati.length === criteri.length, datiCompleti: completo, daValutare,
      superata: soglia == null ? true : punti >= soglia,
      raggiungibile: soglia == null ? true : punti + daValutare >= soglia,
    };
  });
  const totale = r1(sezioni.reduce((a, s) => a + s.punti, 0));
  const min = r1(sezioni.reduce((a, s) => a + s.min, 0));
  const max = r1(sezioni.reduce((a, s) => a + s.max, 0));
  const completo = sezioni.every((s) => s.completo);
  const sotto = sezioni.filter((s) => !s.superata);
  const motivi = [];
  if (completo) {
    if (totale < bando.sogliaTotale) motivi.push(`Punteggio complessivo ${fmt(totale)} sotto la soglia di ${bando.sogliaTotale}.`);
    for (const s of sotto) motivi.push(`Sezione ${s.id} a ${fmt(s.punti)}: minimo richiesto ${s.soglia}.`);
  }
  let esito = 'parziale';
  if (completo) esito = motivi.length ? 'sotto_soglia' : (min < bando.sogliaTotale || sezioni.some((s) => s.soglia != null && s.min < s.soglia) ? 'a_rischio' : 'ammissibile');
  const irraggiungibili = sezioni.filter((s) => !s.raggiungibile);
  return {
    categoria: categoria.nome, sogliaTotale: bando.sogliaTotale, massimo: bando.punteggioMassimo || 100,
    sezioni, totale, min, max, completo, esito, motivi,
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
  if (costo == null || rich == null) add('contributo', 'da_verificare', 'Contributo richiesto', 'Indica costo di produzione e contributo richiesto.');
  else {
    const tetto = Math.min((costo * cat.contributo.percentuale) / 100, massimale ?? Infinity);
    if (rich > tetto + 0.5) add('contributo', 'critico', 'Contributo richiesto', `${euro(rich)} supera il massimo concedibile di ${euro(tetto)} (${cat.contributo.percentuale}% del costo di produzione${massimale ? `, tetto ${euro(massimale)}` : ''}).`);
    else add('contributo', 'ok', 'Contributo richiesto', `${euro(rich)}, pari al ${fmt((rich / costo) * 100)}% del costo di produzione (massimo ${cat.contributo.percentuale}%${massimale ? `, tetto ${euro(massimale)}` : ''}).`);
  }

  // spesa sul territorio
  const spesa = num(e.spesaSicilia), minPct = bando.spesaTerritorioMinPct || 150;
  if (spesa == null || rich == null) add('spesa', 'da_verificare', `Spesa in ${bando.territorio || 'regione'}`, 'Indica la spesa ammissibile sul territorio.');
  else {
    const p = (spesa / rich) * 100;
    if (p < minPct) add('spesa', 'critico', `Spesa in ${bando.territorio || 'regione'}`, `${fmt(p)}% del contributo: il minimo di ammissibilità è ${minPct}% (servono almeno ${euro((rich * minPct) / 100)}).`);
    else if (p < minPct + 1) add('spesa', 'attenzione', `Spesa in ${bando.territorio || 'regione'}`, `${fmt(p)}% del contributo: ammissibile, ma al minimo esatto il criterio di spesa vale 0 punti e ogni scostamento a consuntivo porta alla revoca.`);
    else add('spesa', 'ok', `Spesa in ${bando.territorio || 'regione'}`, `${fmt(p)}% del contributo richiesto (minimo ${minPct}%).`);
  }

  // quadratura budget / piano finanziario
  const cop = coperturaPiano(dati);
  if (cop.righe && costo != null) {
    const diff = costo - cop.totalePiano;
    if (Math.abs(diff) > 1) add('quadratura', 'critico', 'Quadratura budget e piano finanziario', `Il piano finanziario (${euro(cop.totalePiano)}) non coincide con il costo di produzione (${euro(costo)}): differenza ${euro(diff)}.`);
    else add('quadratura', 'ok', 'Quadratura budget e piano finanziario', 'Il piano finanziario copre esattamente il costo di produzione.');
  } else add('quadratura', 'da_verificare', 'Quadratura budget e piano finanziario', 'Inserisci le fonti del piano finanziario per verificare la quadratura.');

  // producer fee
  if (num(e.producerFee) != null && costo) {
    const p = (e.producerFee / costo) * 100;
    if (p > 7.5 + 0.01) add('fee', 'attenzione', 'Producer fee', `${fmt(p)}% del costo: la quota oltre il 7,5% non è ammissibile.`);
    else add('fee', 'ok', 'Producer fee', `${fmt(p)}% del costo di produzione (ammissibile fino al 7,5%).`);
  }

  // fattibilità sezione D
  if (cop.righe && costo != null && !dati.ripreseIniziate && cop.sulCosto != null && cop.sulCosto <= 50 && (cop.sulFabbisogno ?? 0) <= 50) {
    add('copertura', 'critico', 'Copertura finanziaria documentata', `Solo il ${fmt(cop.sulCosto)}% del costo ha un documento a supporto: fino al 50% il criterio 5.1 vale 0 punti e la sezione D non può raggiungere il minimo.`);
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
      if (!presente) add(`all_${a.tipo}`, 'attenzione', a.nome, `Non caricato: senza questi documenti ${a.criteri?.length > 1 ? 'i criteri' : 'il criterio'} ${a.criteri?.join(' e ')} non ${a.criteri?.length > 1 ? 'ricevono' : 'riceve'} punteggio pieno.`);
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
  for (const c of elencoCriteri(griglia).filter((x) => x.tipo === 'fasce')) {
    const r = valutaQuantitativo(c, dati);
    if (r.mancante || !r.prossima || r.prossima.guadagno <= 0) continue;
    const { soglia, stretta, guadagno, etichetta } = r.prossima;
    let azione = null;
    if (c.metrica === 'tecniciSiciliani' && num(p.crewTot)) {
      const n = serve(p.crewTot, soglia, stretta);
      if (n <= p.crewTot) azione = `Porta i tecnici siciliani da ${p.crewSicilia} a ${n} su ${p.crewTot}.`;
    } else if (c.metrica === 'artisticiSiciliani' && num(p.artTot)) {
      const n = serve(p.artTot, soglia, stretta);
      if (n <= p.artTot) azione = `Porta i professionisti siciliani della componente artistica da ${p.artSicilia} a ${n} su ${p.artTot}.`;
    } else if (c.metrica === 'professionistiSiciliani' && num(p.artTot) != null && num(p.crewTot) != null) {
      const tot = p.artTot + p.crewTot, n = serve(tot, soglia, stretta);
      if (n <= tot) azione = `Porta i professionisti siciliani da ${p.artSicilia + p.crewSicilia} a ${n} su ${tot}.`;
    } else if (c.metrica === 'lavorazioneSicilia' && num(g.prepTot) != null && num(g.ripreseTot) != null) {
      const tot = g.prepTot + g.ripreseTot, n = serve(tot, soglia, stretta);
      if (n <= tot) azione = `Porta i giorni in Sicilia di pre-produzione e riprese da ${g.prepSicilia + g.ripreseSicilia} a ${n} su ${tot}.`;
    } else if (c.metrica === 'postSicilia' && num(g.postTot)) {
      const n = serve(g.postTot, soglia, stretta);
      if (n <= g.postTot) azione = `Porta i giorni di post-produzione in Sicilia da ${g.postSicilia} a ${n} su ${g.postTot}.`;
    } else if (c.metrica === 'spesaSicilia' && num(e.contributoRichiesto)) {
      const target = (e.contributoRichiesto * soglia) / 100;
      azione = `Porta la spesa ammissibile in Sicilia da ${euro(e.spesaSicilia)} a ${stretta ? 'oltre' : 'almeno'} ${euro(target)}, oppure riduci il contributo richiesto sotto ${euro((e.spesaSicilia / soglia) * 100)}.`;
    } else if (c.metrica === 'copertura' && num(e.costoProduzione)) {
      const target = (e.costoProduzione * soglia) / 100;
      azione = `Documenta fonti per ${stretta ? 'più di' : 'almeno'} ${euro(target)} (${stretta ? 'oltre il' : ''} ${soglia}% del costo): contratti, deal memo, delibere o referenze bancarie.`;
    }
    if (azione) out.push({ criterio: c.id, nome: c.nome, azione, guadagno, fascia: etichetta });
  }
  return out.sort((a, b) => b.guadagno - a.guadagno);
}

// Art. 11.1: il primo in graduatoria ottiene il 100% del richiesto, gli altri in proporzione al punteggio.
export function stimaContributo(richiesto, punteggio, punteggioPrimo) {
  if (num(richiesto) == null || num(punteggio) == null || !punteggioPrimo) return null;
  return Math.min(richiesto, (richiesto * punteggio) / Math.max(punteggio, punteggioPrimo));
}

export const formati = { fmt, euro, fmtPct };
