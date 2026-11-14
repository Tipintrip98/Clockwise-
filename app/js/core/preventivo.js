// Preventivo allineato alle voci del Modulo III (Sez. III.3, budget a preventivo): ogni riga di costo è
// assegnata a una voce A.x.y e ha una quota spesa sul territorio. Dai totali si ricavano costo di
// produzione, costo ammissibile, spesa sul territorio e producer fee da riportare nei Dati chiave.
// Importa il «Master Budget film» in Excel (foglio BUDGET) convertendo i lordi in costo per la produzione.

export const GRUPPI = [
  { id: 1, nome: 'Soggetto e sceneggiatura', sopraLinea: true },
  { id: 2, nome: 'Direzione', sopraLinea: true },
  { id: 3, nome: 'Componente artistica', sopraLinea: true },
  { id: 4, nome: 'Produzione' },
  { id: 5, nome: 'Animazione' },
  { id: 6, nome: 'Post-produzione e lavorazioni tecniche' },
  { id: 7, nome: 'Spese varie' },
  { id: 8, nome: 'Spese generali (non ammissibili)', nonAmmissibile: true },
  { id: 9, nome: 'Producer fee' },
];

const V = (codice, nome) => ({ codice, nome, gruppo: Number(codice.split('.')[1]) });
export const VOCI = [
  V('A.1.1', 'Soggetto e sceneggiatura'), V('A.1.2', 'Diritti di scrittura e/o sceneggiatura'), V('A.1.3', 'Diritti musicali'), V('A.1.4', 'Altro'),
  V('A.2.1', 'Compenso per regista'), V('A.2.2', 'Altro'),
  V('A.3.1', 'Attori principali'), V('A.3.2', 'Altri costi relativi al cast artistico'), V('A.3.3', 'Compositore della colonna sonora originale'), V('A.3.4', 'Altro'),
  V('A.4.1', 'Reparto produzione'), V('A.4.2', 'Reparto regia'), V('A.4.3', 'Scenografo'), V('A.4.4', 'Scenografia, teatri e costruzioni'), V('A.4.5', 'Reparto location'),
  V('A.4.6', 'Reparto props'), V('A.4.7', 'Effetti speciali, stunt, comparse'), V('A.4.8', 'Costumista'), V('A.4.9', 'Truccatore'), V('A.4.10', 'Costumi, truccatori, parrucchieri'),
  V('A.4.11', 'Direttore della fotografia'), V('A.4.12', 'Mezzi tecnici (camera e supporti)'), V('A.4.13', 'Elettricisti e reparto luci'), V('A.4.14', 'Macchinisti'),
  V('A.4.15', 'Fonico presa diretta'), V('A.4.16', 'Reparto sonoro'), V('A.4.17', 'Vitto e alloggio'), V('A.4.18', 'Trasporti'), V('A.4.19', 'Altro'),
  V('A.5.1', 'Scenografia, sviluppo visivo e pre-produzione'), V('A.5.2', 'Autore della grafica'), V('A.5.3', 'Disegnatori e storyboardisti'), V('A.5.4', 'Storyboard, lay-out e animatics'),
  V('A.5.5', 'Supervisore animazione'), V('A.5.6', 'Animation, modelli e lighting'), V('A.5.7', 'Color, composite e VFX'), V('A.5.8', 'Production pipeline e management'), V('A.5.9', 'Altro'),
  V('A.6.1', 'Laboratori sviluppo e stampa'), V('A.6.2', 'Post-produzione visiva'), V('A.6.3', 'Post-produzione sonora'), V('A.6.4', 'Montatore'), V('A.6.5', 'Montaggio'),
  V('A.6.6', 'VFX - Effetti speciali visivi'), V('A.6.7', 'Musica'), V('A.6.8', 'Spese di trasporto post-produzione'), V('A.6.9', 'Costi per strumenti di fruizione dell’opera'), V('A.6.10', 'Altro'),
  V('A.7.1', 'Costi di amministrazione'), V('A.7.2', 'Oneri assicurativi, finanziari, di garanzia'), V('A.7.3', 'Spese legali'), V('A.7.4', 'Promozione e marketing'),
  V('A.7.5', 'Spese per il rispetto dei protocolli sanitari'), V('A.7.6', 'Certificazione ambientale'), V('A.7.7', 'Altro'),
  V('A.8.1', 'Personale dipendente non coinvolto nella produzione'), V('A.8.2', 'Collaboratori autonomi non coinvolti nella produzione'), V('A.8.3', 'Locali strumentali non di produzione'), V('A.8.4', 'Altro'),
  V('A.9.1', 'Producer fee'),
];
const PER_CODICE = new Map(VOCI.map((v) => [v.codice, v]));
export const voce = (codice) => PER_CODICE.get(codice) || PER_CODICE.get('A.4.19');
export const PCT_FEE = 7.5;

// Regole di assegnazione: [espressione sul nome della riga, espressione sulla sezione (o null), voce del Modulo III]
const REGOLE = [
  [/producer fee/, null, 'A.9.1'],
  [/^soggetto|sceneggiatura/, null, 'A.1.1'],
  [/diritti music/, null, 'A.1.3'],
  [/registi seconda|reparto regia|aiuto regist|assistente regia|segretari[ao] di edizione|edizione|coaching|altre figure/, null, 'A.4.2'],
  [/immagine regista/, null, 'A.2.2'],
  [/^regist/, null, 'A.2.1'],
  [/^(co)?protagonist/, null, 'A.3.1'],
  [/attor[ei] principal/, null, 'A.3.1'],
  [/capo gruppo comparse|comparse|stunt|effetti speciali/, null, 'A.4.7'],
  [/attor[ei] secondari|generic|casting|diritti d.agenzia|agenzia/, null, 'A.3.2'],
  [/autore delle musiche|compositor/, null, 'A.3.3'],
  [/musicist|musica/, null, 'A.6.7'],
  [/location manager|noleggio location|location/, null, 'A.4.5'],
  [/noleggio studio|teatr|costruzion|aiuto scenografo|assistente scenografo|arredator|materiale scenografia|fabbisogno scena/, null, 'A.4.4'],
  [/^scenografo/, null, 'A.4.3'],
  [/attrezzist|props/, null, 'A.4.6'],
  [/^costumista/, null, 'A.4.8'],
  [/capo truccator|^truccator/, null, 'A.4.9'],
  [/costum|sart|trucc|parrucc|calzature/, null, 'A.4.10'],
  [/direttore (della )?fotografia/, null, 'A.4.11'],
  [/assistente montator|montaggio/, null, 'A.6.5'],
  [/^montator/, null, 'A.6.4'],
  [/doppiaggio|post.?produzione sonora|mix/, null, 'A.6.3'],
  [/vfx|effetti visivi/, null, 'A.6.6'],
  [/post.?produzione|montaggio grafico|color/, null, 'A.6.2'],
  [/attrezzatura tecnica|video-luci/, null, 'A.4.12'],
  [/elettricist|luci/, null, 'A.4.13'],
  [/macchinist/, null, 'A.4.14'],
  [/microfonist|attrezzatura audio/, null, 'A.4.16'],
  [/^fonico/, null, 'A.4.15'],
  [/noleggio/, /audio/, 'A.4.16'],
  [/operatore|steady|data manager|video assist|hard disk|materiale fotografia|noleggio|attrezzatura/, null, 'A.4.12'],
  [/viaggi/, null, 'A.4.18'],
  [/hotel|vitto|alloggio|caffetteria|lavanderia|pranzo|catering/, null, 'A.4.17'],
  [/camper|auto |pulmin|mezzo|gasolio|autostrada|autist|trasport|spostament/, null, 'A.4.18'],
  [/medico|sanitar/, null, 'A.7.5'],
  [/assicuraz|fideiussion|garanzi/, null, 'A.7.2'],
  [/legale/, null, 'A.7.3'],
  [/consulenz|amministraz|cancelleria/, null, 'A.7.1'],
  [/pubblicitar|distributiv|promozion|marketing/, null, 'A.7.4'],
  [/green|ambiental/, null, 'A.7.6'],
  [/sicurezza|spese varie|spese sul set|forfett/, null, 'A.7.7'],
  [/produttore esecutivo|organizzator|direttore di produzione|ispettore|segretari[oa] di produzione|runner|fotografo di scena/, null, 'A.4.1'],
];
const semplice = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Voce del Modulo III proposta per una riga di costo, dal nome e dalla sezione del budget. */
export function voceProposta(nome, sezione = '') {
  const n = semplice(nome), s = semplice(sezione);
  for (const [reNome, reSezione, codice] of REGOLE) if (reNome.test(n) && (!reSezione || reSezione.test(s))) return codice;
  if (/vitto|alloggio/.test(s)) return 'A.4.17';
  if (/mezzi|trasport/.test(s)) return 'A.4.18';
  if (/assicuraz/.test(s)) return 'A.7.2';
  if (/post/.test(s)) return 'A.6.10';
  return 'A.4.19';
}

const cella = (ws, col, riga) => ws[`${col}${riga}`];
const numero = (c) => (c && typeof c.v === 'number' && Number.isFinite(c.v) ? c.v : null);
const testo = (c) => (c && c.v != null && typeof c.v !== 'number' ? String(c.v).replace(/\s+/g, ' ').trim() : '');
const fattore = (c) => { const m = /\*\s*(0?\.\d+)/.exec(c?.f || ''); return m ? Number(m[1]) : null; };

export function eMasterBudget(wb) {
  const ws = wb?.Sheets?.BUDGET;
  if (!ws) return false;
  for (let r = 1; r <= 60; r++) for (const col of ['A', 'B', 'D']) if (/SOPRA LINEA|LORDO TRATTEN|LORDO FATTURA/i.test(testo(cella(ws, col, r)))) return true;
  return false;
}

/**
 * Legge il Master Budget (foglio BUDGET). Gli importi in colonna D sono lordi: per le paghe il lordo in busta,
 * per le fatture il totale IVA inclusa. Il Modulo III chiede il costo IVA esclusa, quindi:
 *   paga    → lordo + oneri a carico della ditta (F24) + TFR
 *   fattura → lordo ÷ (1 + aliquota IVA della riga)
 * Restituisce { righe, avvisi, totaleLordo }.
 */
export function leggiMasterBudget(wb) {
  const ws = wb.Sheets.BUDGET;
  const ultima = Math.min(Number(/:[A-Z]+(\d+)$/.exec(ws['!ref'] || '')?.[1]) || 260, 400);
  const righe = [], avvisi = [];
  let sezione = '', dopoAgenzia = false;
  for (let r = 1; r <= ultima; r++) {
    const a = testo(cella(ws, 'A', r)), b = testo(cella(ws, 'B', r)), dTesto = testo(cella(ws, 'D', r));
    if (/CONTO ECONOMICO/i.test(b) || /CONTO ECONOMICO/i.test(a)) break;
    let lordo = numero(cella(ws, 'D', r));
    const nome = b || a;
    if (/^producer fee/i.test(nome)) {
      const importo = numero(cella(ws, 'E', r)) ?? lordo;
      if (importo) righe.push({ sezione: 'Producer fee', nome: 'Producer fee', lordo: importo, costo: importo, tipo: 'fee', voce: 'A.9.1', quota: 0 });
      continue;
    }
    const intestazione = !!nome && (lordo == null || cella(ws, 'D', r)?.f) && (dTesto || (a && !b));
    if (intestazione || (nome && lordo == null && !/^TOTAL/i.test(nome) && /LORDO/i.test(dTesto))) {
      // le righe con le sole etichette di colonna («Denominazione», «Nome») non cambiano sezione
      const titolo = a && !/^UN\.?$/i.test(a) ? a : b;
      if (titolo && !/^(COSTO DEL NOLEGGIO|DENOMINAZIONE|NOME)$/i.test(titolo) && !/^TOTAL/i.test(titolo)) { sezione = titolo; dopoAgenzia = /AGENZIA/i.test(titolo); }
      continue;
    }
    if (!nome || lordo == null || lordo <= 0 || cella(ws, 'D', r)?.f) continue;
    const eTotale = /^TOTAL/i.test(nome);
    if (eTotale && !dopoAgenzia) continue;
    const g = cella(ws, 'G', r), k = cella(ws, 'K', r), f = cella(ws, 'F', r);
    const pIva = /^s[iì]$/i.test(testo(cella(ws, 'E', r)));
    let costo = lordo, tipo = 'altro';
    if (g?.f && !pIva) { // paga: oneri ditta e TFR dalle stesse formule del foglio
      const oneri = fattore(g) ?? 0.2797;
      const tfr = k?.f ? (fattore(k) ?? 0) : 0;
      costo = lordo * (1 + oneri + tfr); tipo = 'paga';
    } else if (pIva) { costo = lordo / 1.22; tipo = 'fattura'; }
    else if (k && !k.f && typeof k.v === 'number' && k.v >= 0 && k.v < 1) { costo = lordo / (1 + k.v); tipo = 'fattura'; }
    else { const m = /\/\s*(1\.\d+)/.exec(f?.f || ''); if (m) { costo = lordo / Number(m[1]); tipo = 'fattura'; } }
    const etichetta = /^COSTO DEL NOLEGGIO$/i.test(nome) ? `Noleggio — ${sezione.toLowerCase()}` : eTotale ? 'Diritti d’agenzia' : nome;
    const unita = numero(cella(ws, 'A', r));
    righe.push({ sezione, nome: unita && unita > 1 ? `${etichetta} (×${unita})` : etichetta, lordo, costo: Math.round(costo * 100) / 100, tipo, voce: voceProposta(etichetta, sezione), quota: 0 });
  }
  if (!righe.length) avvisi.push('Nel foglio BUDGET non ci sono importi: compila la colonna D (celle gialle) e ricarica il file.');
  const quadratura = [testo(cella(ws, 'H', 219)), testo(cella(ws, 'G', 219))].join(' ');
  if (/ERRORE/i.test(quadratura)) avvisi.push('Il foglio segnala ERRORE nel controllo di quadratura: una formula è stata alterata. Verifica il file prima di usarne i totali.');
  const altro = righe.filter((x) => x.voce === 'A.4.19').length;
  if (altro) avvisi.push(`${altro} ${altro === 1 ? 'riga è finita' : 'righe sono finite'} in “A.4.19 Altro”: assegnale alla voce giusta del Modulo III.`);
  return { righe: righe.map((x, i) => ({ id: `r${i + 1}`, ...x })), avvisi, totaleLordo: Math.round(righe.reduce((s, x) => s + x.lordo, 0) * 100) / 100 };
}

const arrot = (n) => Math.round(n * 100) / 100;

/** Totali per voce e per gruppo, con i quattro numeri che servono al dossier. */
export function totaliPreventivo(righe) {
  const perVoce = new Map();
  for (const r of righe || []) {
    const importo = Number(r.costo) || 0;
    if (!importo) continue;
    const v = perVoce.get(r.voce) || { codice: r.voce, nome: voce(r.voce).nome, gruppo: voce(r.voce).gruppo, importo: 0, sicilia: 0 };
    v.importo += importo; v.sicilia += (importo * Math.max(0, Math.min(100, Number(r.quota) || 0))) / 100;
    perVoce.set(r.voce, v);
  }
  const voci = [...perVoce.values()].map((v) => ({ ...v, importo: arrot(v.importo), sicilia: arrot(v.sicilia) })).sort((a, b) => a.gruppo - b.gruppo || Number(a.codice.split('.')[2]) - Number(b.codice.split('.')[2]));
  const gruppi = GRUPPI.map((g) => { const sue = voci.filter((v) => v.gruppo === g.id); return { ...g, importo: arrot(sue.reduce((a, v) => a + v.importo, 0)), sicilia: arrot(sue.reduce((a, v) => a + v.sicilia, 0)) }; });
  const somma = (ids, k) => gruppi.filter((g) => ids.includes(g.id)).reduce((a, g) => a + g[k], 0);
  const fee = gruppi[8].importo, quotaFee = fee ? gruppi[8].sicilia / fee : 0;
  const costoProduzione = arrot(somma([1, 2, 3, 4, 5, 6, 7, 8], 'importo') + fee);
  const feeAmmissibile = arrot(Math.min(fee, (costoProduzione * PCT_FEE) / 100));
  const costoAmmissibile = arrot(somma([1, 2, 3, 4, 5, 6, 7], 'importo') + feeAmmissibile);
  const spesaSicilia = arrot(somma([1, 2, 3, 4, 5, 6, 7], 'sicilia') + feeAmmissibile * quotaFee);
  const sopraLinea = arrot(somma([1, 2, 3], 'importo'));
  const avvisi = [];
  if (fee > feeAmmissibile + 0.5) avvisi.push(`Producer fee: ${Math.round(fee - feeAmmissibile).toLocaleString('it-IT')} € oltre il ${String(PCT_FEE).replace('.', ',')}% del costo di produzione non sono ammissibili (voce A.9.2).`);
  if (gruppi[7].importo > 0) avvisi.push('Le spese generali (A.8) fanno parte del costo di produzione ma non del costo ammissibile.');
  if (costoProduzione && !spesaSicilia) avvisi.push('Nessuna quota di spesa sul territorio indicata: imposta la percentuale spesa in regione per ciascuna riga.');
  return {
    voci, gruppi, costoProduzione, costoAmmissibile, spesaSicilia, producerFee: fee, feeAmmissibile, feeEccedente: arrot(fee - feeAmmissibile),
    sopraLinea, pctSopraLinea: costoProduzione ? arrot((sopraLinea / costoProduzione) * 100) : null, avvisi,
  };
}

/** Valori da riportare nei Dati chiave del dossier. */
export function datiDalPreventivo(totali) {
  return { costoProduzione: Math.round(totali.costoProduzione), costoAmmissibile: Math.round(totali.costoAmmissibile), spesaSicilia: Math.round(totali.spesaSicilia), producerFee: Math.round(totali.producerFee) };
}

const csv = (righe) => righe.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
const it = (n) => (Math.round(n * 100) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

/** Riepilogo per voce da ricopiare nel Modulo III, Sez. III.3 (importo complessivo e quota in regione, IVA esclusa). */
export function csvModuloIII(totali, territorio = 'Sicilia') {
  const righe = [['Voce', 'Descrizione', 'Importo complessivo (IVA esclusa)', `Di cui spesa ammissibile in ${territorio}`]];
  for (const g of totali.gruppi) {
    if (!g.importo) continue;
    righe.push([`A.${g.id}`, g.nome.toUpperCase(), it(g.importo), it(g.sicilia)]);
    if (g.id === 9) {
      righe.push(['A.9.1', 'Producer fee (ammissibile fino al 7,5%)', it(totali.feeAmmissibile), it(g.importo ? (g.sicilia / g.importo) * totali.feeAmmissibile : 0)]);
      if (totali.feeEccedente > 0) righe.push(['A.9.2', 'Ulteriore producer fee (non ammissibile)', it(totali.feeEccedente), it(0)]);
    } else for (const v of totali.voci.filter((x) => x.gruppo === g.id)) righe.push([v.codice, v.nome, it(v.importo), it(v.sicilia)]);
  }
  righe.push(['A.', 'TOTALE GENERALE PRODUZIONE', it(totali.costoProduzione), ''], ['B.', 'TOTALE COSTO AMMISSIBILE', it(totali.costoAmmissibile), it(totali.spesaSicilia)]);
  return `﻿${csv(righe)}`;
}
