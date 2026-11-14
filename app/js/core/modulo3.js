// Lettura del Modulo III ufficiale ("Dati di produzione", .xls) della Sicilia Film Commission.
// Lavora su un workbook SheetJS. Le righe si cercano per codice (P.3, Q.1, A.4.17, 1.2 …)
// e non per posizione fissa, così regge anche a revisioni del modello.

const cella = (ws, col, riga) => ws?.[`${col}${riga}`];
const val = (ws, col, riga) => { const c = cella(ws, col, riga); return c == null ? null : c.v; };
const testo = (ws, col, riga) => {
  const c = cella(ws, col, riga);
  if (c == null || c.v == null) return '';
  return String(c.w != null && typeof c.v === 'number' && c.t === 'n' && /[\/\-]/.test(c.w) ? c.w : c.v).trim();
};
const numero = (ws, col, riga) => {
  const v = val(ws, col, riga);
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const pulito = v.replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const n = parseFloat(pulito);
    return Number.isFinite(n) && /\d/.test(pulito) ? n : null;
  }
  return null;
};
const maxRiga = (ws) => {
  const ref = ws?.['!ref'];
  const m = ref && /:[A-Z]+(\d+)$/.exec(ref);
  return m ? Math.min(parseInt(m[1], 10), 400) : 150;
};
const trovaFoglio = (wb, re) => {
  const nome = wb.SheetNames.find((n) => re.test(n));
  return nome ? wb.Sheets[nome] : null;
};
const SUGGERIMENTI = /^(indicare|specificare|campo automatico)/i;

const MAPPA_DOC = [
  [/contratt/i, 'contratto'],
  [/deal\s*memo/i, 'deal_memo'],
  [/deliber|decret/i, 'delibera'],
  [/referenz/i, 'referenze'],
];
function tipoDocumento(s) {
  for (const [re, k] of MAPPA_DOC) if (re.test(s || '')) return k;
  return 'nessuno';
}

export function eModuloIII(wb) {
  return !!(wb && wb.SheetNames && trovaFoglio(wb, /III\.?\s*3/i) && trovaFoglio(wb, /III\.?\s*4/i));
}

export function leggiModuloIII(wb) {
  const avvisi = [];
  const s1 = trovaFoglio(wb, /III\.?\s*1/i), s2 = trovaFoglio(wb, /III\.?\s*2/i);
  const s3 = trovaFoglio(wb, /III\.?\s*3/i), s4 = trovaFoglio(wb, /III\.?\s*4/i);
  const dati = { giorni: {}, professionisti: {}, economici: {}, piano: [] };
  const accordi = {};

  // --- Sez. III.1: anagrafica, giorni di lavorazione, legame con il territorio
  if (s1) {
    const perCodice = {};
    for (let r = 1; r <= maxRiga(s1); r++) { const c = testo(s1, 'B', r); if (c) perCodice[c.toUpperCase()] = r; }
    const campo = (cod) => { const r = perCodice[cod]; if (!r) return ''; const t = testo(s1, 'D', r); return SUGGERIMENTI.test(t) ? '' : t; };
    const giorni = (cod) => { const r = perCodice[cod]; return r ? numero(s1, 'K', r) : null; };
    dati.titolo = campo('A');
    dati.proponente = campo('C');
    dati.regia = campo('E');
    dati.tipologiaOpera = campo('H');
    dati.genere = campo('I');
    const durata = /(\d+([.,]\d+)?)/.exec(campo('L'));
    dati.durataMin = durata ? parseFloat(durata[1].replace(',', '.')) : null;
    dati.dataInizioRiprese = campo('P.1');
    dati.dataFineRiprese = campo('P.2');
    Object.assign(dati.giorni, {
      prepTot: giorni('P.3'), ripreseTot: giorni('P.4'), postTot: giorni('P.5'),
      prepSicilia: giorni('Q.1'), ripreseSicilia: giorni('Q.2'), postSicilia: giorni('Q.3'),
    });
    for (const [cod, chiave] of [['N.1', 'coproduzioneItalia'], ['N.2', 'coproduzioneEstero'], ['N.3', 'distribuzione'], ['N.4', 'produttoreEsecutivo'], ['N.5', 'finanziatoriEsterni']]) {
      const r = perCodice[cod];
      if (!r) continue;
      const si = /^s[iì]$/i.test(testo(s1, 'D', r));
      accordi[chiave] = { presente: si, ragioneSociale: testo(s1, 'H', r) };
    }
  } else avvisi.push('Foglio “SEZ. III.1” non trovato.');

  // --- Sez. III.2: cast e troupe
  if (s2) {
    let rA = 0, rB = 0, rS = 0;
    for (let r = 1; r <= maxRiga(s2); r++) {
      const a = testo(s2, 'A', r), b = testo(s2, 'B', r);
      if (a === 'A' && /COMPONENTE ARTISTICA/i.test(b)) rA = r;
      if (a === 'B' && /CAST TECNICO/i.test(b)) rB = r;
      if (/QUADRO DI SINTESI/i.test(b)) rS = r;
    }
    const conta = (da, a) => {
      let tot = 0, sic = 0; const righe = [];
      for (let r = da; r <= a; r++) {
        const ruolo = testo(s2, 'B', r), cognome = testo(s2, 'C', r), nome = testo(s2, 'D', r);
        if (!ruolo && !cognome && !nome) continue;
        if (/^ruolo$/i.test(ruolo)) continue;
        const sicilia = /^s[iì]$/i.test(testo(s2, 'E', r));
        tot++; if (sicilia) sic++;
        righe.push({ ruolo, nome: [nome, cognome].filter(Boolean).join(' '), sicilia });
      }
      return { tot, sic, righe };
    };
    const tabA = rA && rB ? conta(rA + 2, rB - 2) : { tot: 0, sic: 0, righe: [] };
    const tabB = rB ? conta(rB + 2, (rS || maxRiga(s2)) - 1) : { tot: 0, sic: 0, righe: [] };
    let sintesi = {};
    if (rS) {
      for (let r = rS + 1; r <= rS + 6; r++) {
        const c = testo(s2, 'C', r);
        if (/COMPONENTE ARTISTICA/i.test(c)) sintesi.art = [numero(s2, 'E', r), numero(s2, 'F', r)];
        if (/CAST TECNICO/i.test(c)) sintesi.crew = [numero(s2, 'E', r), numero(s2, 'F', r)];
      }
    }
    const scegli = (sint, tab, nome) => {
      if (sint && sint[0] != null) {
        if (tab.tot && tab.tot !== sint[0]) avvisi.push(`${nome}: il quadro di sintesi indica ${sint[0]} professionisti, la tabella ne elenca ${tab.tot}.`);
        if (tab.tot && sint[1] != null && tab.sic !== sint[1]) avvisi.push(`${nome}: il quadro di sintesi indica ${sint[1]} siciliani, la tabella ne segna ${tab.sic}.`);
        return [sint[0], sint[1] ?? 0];
      }
      if (tab.tot) { avvisi.push(`${nome}: quadro di sintesi vuoto, valori contati dalla tabella. Compila il quadro prima dell'invio.`); return [tab.tot, tab.sic]; }
      return [null, null];
    };
    const [artTot, artSicilia] = scegli(sintesi.art, tabA, 'Componente artistica');
    const [crewTot, crewSicilia] = scegli(sintesi.crew, tabB, 'Cast tecnico');
    Object.assign(dati.professionisti, { artTot, artSicilia, crewTot, crewSicilia });
    dati.elencoArtistico = tabA.righe;
    dati.elencoTecnico = tabB.righe;
  } else avvisi.push('Foglio “SEZ. III.2” non trovato.');

  // --- Sez. III.3: budget a preventivo
  if (s3) {
    const gruppi = {}; let rTot = 0, rAmm = 0;
    for (let r = 1; r <= maxRiga(s3); r++) {
      const cod = testo(s3, 'C', r);
      const m = /^A\.(\d+)\.(\d+)$/.exec(cod);
      if (m) {
        const g = parseInt(m[1], 10);
        gruppi[g] = gruppi[g] || { e: 0, f: 0, voci: {} };
        const e = numero(s3, 'E', r) || 0, f = numero(s3, 'F', r) || 0;
        gruppi[g].e += e; gruppi[g].f += f; gruppi[g].voci[cod] = { e, f };
      }
      const b = testo(s3, 'B', r);
      if (b === 'A.' && /TOTALE GENERALE/i.test(cod)) rTot = r;
      if (b === 'B.' && /COSTO AMMISSIBILE/i.test(cod)) rAmm = r;
    }
    const sum = (ids, k) => ids.reduce((a, i) => a + (gruppi[i]?.[k] || 0), 0);
    const fee1 = gruppi[9]?.voci['A.9.1'] || { e: 0, f: 0 }, fee2 = gruppi[9]?.voci['A.9.2'] || { e: 0, f: 0 };
    const costo = sum([1, 2, 3, 4, 5, 6, 7, 8], 'e') + fee1.e + fee2.e;
    const ammissibile = sum([1, 2, 3, 4, 5, 6, 7], 'e') + fee1.e;
    const sicilia = sum([1, 2, 3, 4, 5, 6, 7], 'f') + fee1.f;
    if (costo > 0) {
      Object.assign(dati.economici, { costoProduzione: costo, costoAmmissibile: ammissibile, spesaSicilia: sicilia, producerFee: fee1.e + fee2.e });
      const totFoglio = rTot ? numero(s3, 'E', rTot) : null;
      if (totFoglio != null && Math.abs(totFoglio - costo) > 1) avvisi.push(`Budget: il totale salvato nel foglio (${Math.round(totFoglio).toLocaleString('it-IT')} €) non coincide con la somma delle voci (${Math.round(costo).toLocaleString('it-IT')} €). Riapri il file in Excel e ricalcola.`);
      if (sicilia > ammissibile + 1) avvisi.push('Budget: la spesa in Sicilia supera il costo ammissibile complessivo.');
      for (const g of Object.values(gruppi)) for (const [cod, v] of Object.entries(g.voci)) if (v.f > v.e + 0.5) avvisi.push(`Budget ${cod}: la quota in Sicilia supera l'importo complessivo della voce.`);
    } else avvisi.push('Budget (Sez. III.3) non compilato.');
  } else avvisi.push('Foglio “SEZ. III.3” non trovato.');

  // --- Sez. III.4: piano finanziario
  if (s4) {
    let voce = '', etichetta = '', gruppo = '';
    for (let r = 8; r <= maxRiga(s4); r++) {
      const b = testo(s4, 'B', r), c = testo(s4, 'C', r);
      if (/^TOTALE/i.test(c)) break;
      if (/^\d$/.test(b)) { gruppo = c; voce = ''; etichetta = ''; continue; }
      if (/^\d\.\d$/.test(b)) { voce = b; etichetta = c.replace(/^specificare:?$/i, '').trim(); }
      else if (c && !b) etichetta = c;
      const importo = numero(s4, 'L', r);
      if (!voce || importo == null || importo === 0) continue;
      const den = testo(s4, 'D', r);
      dati.piano.push({
        voce, gruppo, etichetta: etichetta || gruppo,
        denominazione: SUGGERIMENTI.test(den) ? '' : den,
        tipologia: testo(s4, 'G', r),
        importo,
        documento: voce === '1.1' ? 'nessuno' : tipoDocumento(testo(s4, 'N', r)),
      });
    }
    const richiesta = dati.piano.find((p) => p.voce === '1.1');
    if (richiesta) dati.economici.contributoRichiesto = richiesta.importo;
    else avvisi.push('Piano finanziario: manca la voce 1.1 (contributo richiesto con questo bando).');
    if (!dati.piano.length) avvisi.push('Piano finanziario (Sez. III.4) non compilato.');
  } else avvisi.push('Foglio “SEZ. III.4” non trovato.');

  return { dati, accordi, avvisi };
}
