// Test del motore di ragionamento e della taratura. Tutti i dossier sono d’invenzione: nomi, società e importi non
// corrispondono a nessun progetto reale. Il primo dossier riproduce soltanto la STRUTTURA documentale del caso reale
// su cui sono state tarate le regole (frazioni di sezione arrotondate in CASO_REALE).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BANDO_SICILIA as B } from '../app/js/core/bando-sicilia.js';
import { datiVuoti, componiRisultato, valutaQuantitativo, statisticheEsiti, getGriglia } from '../app/js/core/scoring.js';
import { eseguiValutazione, valutazioniPerCriterio } from '../app/js/core/engine.js';
import { promptSezione } from '../app/js/core/prompts.js';
import { REGOLE, FATTI, FAMIGLIE_TARATE, CASO_REALE, SCALA_RIFERIMENTO, ERRORI_DA_EVITARE, COMPOSIZIONE } from '../app/js/core/taratura-dati.js';
import {
  fattiDossier, valutaRegola, componiRegole, regoleFamiglia, ancoreTaratura, testoAncore, scostamenti, stimaDaRegole, firmeDocumento,
  righePiano, allegatiPerRiga, domandeAperte, ancoreCompatte, criterioAGiudizio, OPERATORI_AMMESSI, taraturaDossier,
} from '../app/js/core/ragionamento.js';

/* ------------------------------------------------------------------ dossier d’invenzione */

const doc = (nome, tipo, testo, extra = {}) => ({ id: nome, nome, tipo, testo, avvisi: [], ...extra });
const ripeti = (s, n) => Array.from({ length: n }, (_, i) => s.replace(/#/g, String(i + 1))).join('\n');

const NOTE_REGIA = 'La regia segue i personaggi da vicino, con macchina a mano nelle scene di lavoro e inquadrature fisse e lunghe per i momenti di attesa. '.repeat(6);
const MODULO2 = `MODULO II — SCHEDA DI PRODUZIONE
Soggetto proponente: Libeccio Film S.r.l. — anno di costituzione 2023
II.1 Soggetto dell'opera
Una famiglia di pescatori affronta la chiusura dell’ultima attività del paese. Il racconto è ispirato a fatti realmente accaduti.
II.2 Note di regia
${NOTE_REGIA}
II.3 Regista
Teresa Vinci — tre cortometraggi (2019, 2021, 2024); questo è il suo primo lungometraggio.
II.4 Sceneggiatore
Andrea Moro — due cortometraggi.
II.5 Impresa — opere prodotte negli ultimi 5 anni
2023 | Il varco | cortometraggio | 100% | festival di quartiere
2024 | Sale | documentario | 60% | rassegna regionale
2025 | Correnti | serie web | 100% | —
II.6 Professionisti della componente artistica
Marco Lanza, Giulia Serra, Pietro Galli, Anna Ruggeri
II.7 Professionisti del cast tecnico
vedi Modulo III`;

const SCENEGGIATURA = [
  'Soggetto ispirato a fatti realmente accaduti.',
  ripeti('#. EST. PORTO DI TRAPANI - ALBA\nI pescatori preparano le reti. Si parla di Favignana e di Marsala.', 3),
  '7. INT. CASA DI ROSA, TRAPANI - NOTTE\nRosa conta i debiti.',
  '11. EST. MOLO DI PALERMO - GIORNO\nIl compratore arriva da Palermo.',
  '15. EST. TONNARA - TRAMONTO\nUltima mattanza davanti a Trapani.',
  ripeti('INT. BARCA - GIORNO\nDialogo lungo sul mare di Trapani.', 4),
].join('\n\n');

function dossierStrutturale({ senzaFinanza = false, confermati = true } = {}) {
  const documenti = [
    doc('modulo1.pdf', 'modulo1', 'MODULO I — ISTANZA. Stato dell’opera: non ancora in fase di riprese.'),
    doc('modulo2.pdf', 'modulo2', MODULO2),
    doc('modulo3.xls', 'modulo3', 'MODULO III — DATI DI PRODUZIONE'),
    doc('sceneggiatura.pdf', 'sceneggiatura', SCENEGGIATURA, { pagine: 125 }),
    doc('cv_societa.pdf', 'cv_societa', 'Libeccio Film S.r.l., costituita nel 2023.\n2023 Il varco, cortometraggio\n2024 Sale, documentario\n2025 Correnti, serie web'),
    doc('cv_regista.pdf', 'cv_regista', 'Teresa Vinci. Cortometraggi selezionati in rassegne regionali. Il progetto è il suo primo lungometraggio.'),
    doc('cv_artistico.pdf', 'cv_artistico', 'Marco Lanza — David di Donatello come attore non protagonista.\nGiulia Serra — Nastro d’Argento, protagonista di film usciti in sala.'),
    doc('cv_tecnico.pdf', 'cv_tecnico', 'Luca Neri, direttore della fotografia: film in concorso alla Mostra del Cinema di Venezia.'),
    doc('lettera_lanza.pdf', 'accordi_cast', 'Lettera di intenti per la partecipazione di Marco Lanza al film.\n[firma autografa di Paolo Ferri]'),
    doc('dealmemo_serra.pdf', 'accordi_cast', 'Deal memo con Giulia Serra per il ruolo di Rosa.\n[firma autografa di Paolo Ferri]\n[firma autografa di Giulia Serra]'),
    doc('piano_lavorazione.pdf', 'piano_lavorazione', 'Piano di lavorazione — location: porto di Trapani, tonnara di Favignana, molo di Palermo.'),
  ];
  if (!senzaFinanza) documenti.push(
    doc('accordo_coproduzione.pdf', 'coproduzione', 'Accordo di coproduzione tra Libeccio Film S.r.l., Halde Pictures GmbH e Norrsken Film ApS. Apporto dei coproduttori esteri: € 350.000 (35%).\n[firma autografa di Paolo Ferri]\n[firma autografa di Jonas Albrecht]\n[firma autografa di Mette Lund]'),
    doc('lettera_finanziatore.pdf', 'finanziatori_esterni', 'Manifestazione di interesse. Capitale Mediterraneo S.p.A. comunica che si può ipotizzare un apporto di € 250.000.\n[firma autografa di Livia Conte]'),
    doc('contratto_distribuzione.pdf', 'distribuzione', 'Contratto di distribuzione cinematografica tra Libeccio Film S.r.l. e Arcobaleno Distribuzione S.r.l. per l’Italia, minimo garantito € 10.000.\n[firma autografa di Paolo Ferri]\n[firma autografa di Sergio Bassi]\n[timbro Arcobaleno Distribuzione]'),
  );
  const artistici = [['Regista', 'Teresa Vinci'], ['Sceneggiatore', 'Andrea Moro'], ['Compositore', 'Elio Sanna'], ['Interprete principale', 'Marco Lanza'], ['Interprete principale', 'Giulia Serra'], ['Interprete secondario', 'Pietro Galli'], ['Interprete secondario', 'Anna Ruggeri']];
  const tecnici = [['Direttore della fotografia', 'Luca Neri'], ['Montatore', 'Sara Fontana'], ['Scenografo', 'Dario Costa'], ['Costumista', 'Irene Villa'], ['Fonico di presa diretta', 'Bruno Leone'], ['Aiuto regia', 'Chiara Bruno'],
    ['Operatore di macchina', 'Fabio Greco'], ['Truccatrice', 'Nadia Riva'], ['Capo elettricista', 'Ugo Marini'], ['Macchinista', 'Ivo Rossetti'], ['Segretaria di edizione', 'Lia Ferraro'], ['Organizzatore', 'Gino Pace']];
  return {
    id: 'twin', nome: 'Dossier d’invenzione', bandoId: B.id, categoriaId: 'film', anno: 2027,
    dati: {
      ...datiVuoti(), titolo: 'Opera d’invenzione', durataMin: 100,
      giorni: { prepTot: 20, prepSicilia: 20, ripreseTot: 30, ripreseSicilia: 30, postTot: 40, postSicilia: 25 },
      professionisti: { artTot: 7, artSicilia: 4, crewTot: 12, crewSicilia: 10 },
      economici: { costoProduzione: 1000000, costoAmmissibile: 950000, contributoRichiesto: 300000, spesaSicilia: 950000, producerFee: 50000 },
      piano: [
        { voce: '1.1', etichetta: 'Contributo richiesto con questo bando', importo: 300000, documento: 'nessuno' },
        { voce: '1.2', etichetta: 'Tax credit', importo: 50000, documento: 'nessuno' },
        { voce: '2.1', etichetta: 'Apporto societario diretto', importo: 50000, documento: 'referenze' },
        { voce: '3.1', etichetta: 'Coproduttori esteri', denominazione: 'Halde Pictures GmbH', importo: 350000, documento: 'contratto' },
        { voce: '4.1', etichetta: 'Apporto di terzi', denominazione: 'Capitale Mediterraneo', importo: 250000, documento: 'contratto' },
      ],
    },
    modulo3: {
      accordi: { coproduzioneEstero: { presente: true }, distribuzione: { presente: true }, finanziatoriEsterni: { presente: true } },
      elencoArtistico: artistici.map(([ruolo, nome]) => ({ ruolo, nome, sicilia: false })),
      elencoTecnico: tecnici.map(([ruolo, nome]) => ({ ruolo, nome, sicilia: true })),
    },
    // risposte del produttore alle domande chiuse sui fatti di giudizio, come nel caso reale
    fattiConfermati: confermati ? { societa_riconoscimenti_rilievo: false, incoerenze_cv_moduli: true, difetti_formali_testo: true } : {},
    documenti,
  };
}

const frazioni = (anc, sid) => { const s = anc.sezioni[sid]; return { a: [s.atteso.min / s.massimo, s.atteso.max / s.massimo], r: [s.rigoroso.min / s.massimo, s.rigoroso.max / s.massimo] }; };
const CHIAVE = { A: 'qualita', B: 'soggetti', D: 'finanza' };

/* ------------------------------------------------------------------ (a) taratura sul gemello strutturale */

test('(a) il gemello strutturale del caso reale ricade nelle fasce: attese con le frazioni reali, rigorose vicine alla lettura alla lettera', () => {
  const p = dossierStrutturale();
  const anc = ancoreTaratura(B, 'film', p);
  for (const sid of ['A', 'B', 'D']) {
    const { a, r } = frazioni(anc, sid);
    const caso = CASO_REALE[CHIAVE[sid]];
    assert.ok(a[0] - 0.005 <= caso.reale && caso.reale <= a[1] + 0.005, `sezione ${sid}: frazione reale ${caso.reale} fuori dalla fascia attesa ${a.map((x) => x.toFixed(3))}`);
    const distanza = caso.cieca < r[0] ? r[0] - caso.cieca : caso.cieca > r[1] ? caso.cieca - r[1] : 0;
    assert.ok(distanza <= 0.05, `sezione ${sid}: lettura alla lettera osservata ${caso.cieca} lontana dalla fascia rigorosa ${r.map((x) => x.toFixed(3))}`);
    // la fascia attesa non è un intervallo di comodo: resta stretta (al più 15 punti percentuali della sezione)
    assert.ok(a[1] - a[0] <= 0.15, `sezione ${sid}: fascia attesa troppo larga (${(a[1] - a[0]).toFixed(3)})`);
  }
  // le regole applicate sono quelle osservate nel caso reale
  const regola = (id) => anc.criteri[id].regole.map((x) => x.id);
  assert.deepEqual(regola('1.2'), ['scrittura-soggetto-forte-testo-non-rifinito']);
  assert.deepEqual(regola('2.1'), ['territorio-legame-strutturale-luoghi-documentati']);
  assert.deepEqual(regola('3.1'), ['societa-attiva-curriculum-incoerente']);
  assert.deepEqual(regola('3.2'), ['artistica-dichiarati-cast-di-rilievo-regista-esordiente']);
  assert.deepEqual(regola('3.3'), ['tecnica-dichiarata-completa-con-figura-di-rilievo']);
  assert.deepEqual(regola('5.1'), ['piano-copertura-piena-solo-nella-lettura-attesa']);
  assert.deepEqual(regola('5.2'), ['distribuzione-contratto-firmato-qualifica-non-provata']);
  assert.deepEqual(regola('5.3'), ['internazionale-piu-coproduttori-esteri-rilevanza-non-provata']);
  // tabella e punteggi fissi: 5.1 dalla tabella (oltre l’80% → 9 × 1,6), 5.2 al valore ammesso pieno
  assert.deepEqual(anc.criteri['5.1'].atteso, { min: 14.4, max: 14.4 });
  assert.deepEqual(anc.criteri['5.1'].rigoroso, { min: 0, max: 0 });
  assert.deepEqual(anc.criteri['5.2'].atteso, { min: 5, max: 5 });
  assert.equal(anc.criteri['5.2'].rigoroso.max, 0);
});

test('(a) anche senza le risposte del produttore le fasce contengono le frazioni reali (inviluppo, fiducia più bassa)', () => {
  const p = dossierStrutturale({ confermati: false });
  const anc = ancoreTaratura(B, 'film', p);
  for (const sid of ['A', 'B', 'D']) {
    const { a } = frazioni(anc, sid);
    const reale = CASO_REALE[CHIAVE[sid]].reale;
    assert.ok(a[0] - 0.005 <= reale && reale <= a[1] + 0.005, `sezione ${sid}: ${reale} fuori da ${a.map((x) => x.toFixed(3))}`);
  }
  assert.equal(anc.criteri['3.1'].modo, 'inviluppo-possibili');
  assert.equal(anc.criteri['3.1'].fiducia, 'bassa');
  assert.ok(anc.domande.some((d) => d.fatto === 'incoerenze_cv_moduli'), 'la domanda chiusa sul curriculum è proposta');
});

test('(a) la stima senza Claude del gemello strutturale è vicina ai punteggi reali di sezione', () => {
  const p = dossierStrutturale();
  const st = stimaDaRegole(B, 'film', p);
  for (const sid of ['A', 'B', 'D']) {
    const s = st.sezioni.find((x) => x.id === sid);
    const reale = CASO_REALE[CHIAVE[sid]].reale * s.massimo;
    assert.ok(Math.abs(s.punti - reale) <= 0.08 * s.massimo, `sezione ${sid}: stima ${s.punti} contro ${reale.toFixed(1)}`);
    assert.ok(s.min <= s.punti && s.punti <= s.max);
    assert.ok(s.rigoroso <= s.punti);
  }
  assert.equal(st.esito, 'a_rischio', 'sopra le soglie nella lettura attesa, sotto in quella rigorosa');
  assert.ok(st.sezioni.find((x) => x.id === 'D').fragile);
});

/* ------------------------------------------------------------------ (b) senza documenti finanziari */

test('(b) lo stesso dossier senza alcun documento a supporto del piano scende sotto il minimo della sezione D', () => {
  const p = dossierStrutturale({ senzaFinanza: true });
  const anc = ancoreTaratura(B, 'film', p);
  const soglia = B.categorie.find((c) => c.id === 'film').soglie.D;
  assert.ok(anc.sezioni.D.atteso.max < soglia, `massimo atteso ${anc.sezioni.D.atteso.max} contro un minimo di ${soglia}`);
  assert.deepEqual(anc.criteri['5.1'].regole.map((r) => r.id), ['piano-fonti-solo-dichiarate']);
  assert.deepEqual(anc.criteri['5.2'].regole.map((r) => r.id), ['distribuzione-dichiarata-senza-documento']);
  const st = stimaDaRegole(B, 'film', p);
  assert.ok(st.sotto.includes('D'));
  assert.equal(st.esito, 'sotto_soglia');
});

/* ------------------------------------------------------------------ (c) coerenza tra regole e fatti */

test('(c) ogni regola usa fatti definiti, operatori ammessi e fasce valide', () => {
  const ids = new Set();
  for (const r of REGOLE) {
    assert.ok(!ids.has(r.id), `id ripetuto: ${r.id}`); ids.add(r.id);
    for (const [fatto, op, valore] of [...r.tutti, ...r.almenoUno]) {
      assert.ok(fatto in FATTI, `${r.id}: fatto non definito «${fatto}»`);
      assert.ok(OPERATORI_AMMESSI.includes(op), `${r.id}: operatore «${op}»`);
      const tipo = FATTI[fatto].tipo;
      assert.equal(typeof valore, tipo === 'booleano' ? 'boolean' : 'number', `${r.id}: valore di tipo sbagliato per ${fatto}`);
      if (tipo === 'booleano') assert.ok(['=', '!='].includes(op), `${r.id}: confronto d’ordine su un booleano`);
    }
    for (const k of ['attesa', 'rigorosa']) {
      const [a, b] = r[k];
      assert.ok(a >= 0 && b <= 1 && a <= b, `${r.id}: fascia ${k} non valida`);
    }
    assert.ok(r.rigorosa[0] <= r.attesa[0] && r.rigorosa[1] <= r.attesa[1], `${r.id}: la lettura rigorosa supera quella attesa`);
    assert.ok(['forte', 'media', 'debole'].includes(r.forza), `${r.id}: forza`);
    assert.ok(['caso', 'distribuzione', 'bando', 'estrapolazione'].includes(r.riscontro), `${r.id}: riscontro`);
    for (const k of ['quando', 'perche', 'evidenza']) assert.ok(typeof r[k] === 'string' && r[k].length > 20, `${r.id}: ${k} mancante`);
  }
  for (const [k, f] of Object.entries(FATTI)) {
    assert.ok(['booleano', 'numero', 'frazione'].includes(f.tipo), k);
    assert.ok(['documentale', 'giudizio'].includes(f.natura), k);
    if (f.natura === 'giudizio') assert.ok(f.domanda, `${k}: un fatto di giudizio ha bisogno della domanda chiusa`);
  }
  for (const e of ERRORI_DA_EVITARE) for (const f of e.famiglie) assert.ok(FAMIGLIE_TARATE.includes(f), `errore riferito a una famiglia senza regole: ${f}`);
  assert.ok(COMPOSIZIONE.length >= 5);
});

// Valori di prova per ogni fatto usato da una famiglia: i due booleani, le soglie numeriche e i loro intorni.
function candidati(famiglia) {
  const regole = regoleFamiglia(famiglia);
  const per = {};
  for (const r of regole) for (const [f, , v] of [...r.tutti, ...r.almenoUno]) {
    if (FATTI[f].tipo === 'booleano') per[f] = [true, false];
    else { const d = FATTI[f].tipo === 'frazione' ? 0.01 : 1; per[f] = [...new Set([...(per[f] || []), v - d, v, v + d].map((x) => Math.round(x * 1000) / 1000))].filter((x) => x >= 0); }
  }
  return per;
}
function* prodotto(per) {
  const chiavi = Object.keys(per);
  const idx = chiavi.map(() => 0);
  while (true) {
    yield Object.fromEntries(chiavi.map((k, i) => [k, per[k][idx[i]]]));
    let i = 0;
    while (i < chiavi.length && ++idx[i] === per[chiavi[i]].length) idx[i++] = 0;
    if (i === chiavi.length) return;
  }
}
// combinazioni impossibili in un dossier reale (lo garantisce il modo in cui fattiDossier calcola i fatti)
function possibile(f) {
  if (f.copertura_attesa_fascia_massima && f.copertura_attesa_fascia_nulla) return false;
  if (f.copertura_rigorosa_fascia_massima && f.copertura_rigorosa_fascia_nulla) return false;
  if (f.copertura_attesa_fascia_nulla === true && f.copertura_rigorosa_fascia_nulla === false) return false;
  if (f.copertura_attesa_fascia_massima === false && f.copertura_rigorosa_fascia_massima === true) return false;
  if (f.copertura_attesa_fascia_nulla === false && f.copertura_attesa != null && f.copertura_attesa <= 0) return false;
  if (f.copertura_attesa != null && f.copertura_dichiarata != null && f.copertura_attesa > f.copertura_dichiarata) return false;
  for (const g of ['artistici', 'tecnici']) if (f[`quota_${g}_accordo_firmato`] > f[`quota_${g}_accordo_allegato`]) return false;
  if (f.accordo_coproduzione_estera_firmato && f.documento_coproduzione_estera_allegato === false) return false;
  if (f.documento_distribuzione_allegato === false && (f.distribuzione_contratto || f.distribuzione_firmata)) return false;
  if (f.testo_opera_presente === false && f.testo_opera_integrale) return false;
  return true;
}

test('(c) dentro ogni famiglia, a fatti tutti noti si applica una e una sola regola', () => {
  for (const fam of [...FAMIGLIE_TARATE, 'generica']) {
    let casi = 0;
    for (const f of prodotto(candidati(fam))) {
      if (!possibile(f)) continue;
      casi++;
      const certe = regoleFamiglia(fam).filter((r) => valutaRegola(r, f).esito === 'certa').map((r) => r.id);
      // senza testo dell’opera vale la sola regola dell’allegato mancante, qualunque cosa dicano gli altri fatti
      assert.equal(certe.length, 1, `${fam}: ${certe.length} regole (${certe.join(', ')}) per ${JSON.stringify(f)}`);
    }
    assert.ok(casi > 0, fam);
  }
});

test('(c) la scala di riferimento delle regole coincide con le graduatorie caricate nel programma', () => {
  const st = statisticheEsiti(B, 'film');
  for (const [sid, k] of Object.entries(CHIAVE)) {
    const max = getGriglia(B, 'film').sezioni.find((s) => s.id === sid).max;
    for (const q of ['min', 'q1', 'mediana', 'q3', 'max']) {
      assert.ok(Math.abs(st.sezioni[sid][q] / max - SCALA_RIFERIMENTO[k][q]) <= 0.011, `${sid}.${q}: graduatorie ${(st.sezioni[sid][q] / max).toFixed(3)}, taratura ${SCALA_RIFERIMENTO[k][q]}: aggiornate gli esiti, rivedete la taratura`);
    }
  }
});

test('(c) per il bando di riferimento un dossier medio cade attorno alla mediana reale e nessuna fascia supera il massimo osservato', () => {
  // dossier medio d’invenzione: testo integrale e pulito, soggetto non distintivo, figure dichiarate senza nomi di rilievo
  const p = dossierStrutturale();
  p.fattiConfermati = { soggetto_distintivo: false, difetti_formali_testo: false, legame_territorio_strutturale: false, cast_rilievo_nazionale: false, capo_reparto_di_rilievo: false, societa_riconoscimenti_rilievo: false, incoerenze_cv_moduli: false, regista_esordiente: false, rapporto_pagine_minuti: 1 };
  const anc = ancoreTaratura(B, 'film', p);
  const st = statisticheEsiti(B, 'film');
  const stima = stimaDaRegole(B, 'film', p, anc);
  for (const sid of ['A', 'B']) {
    const s = stima.sezioni.find((x) => x.id === sid);
    assert.ok(s.punti >= st.sezioni[sid].min && s.punti <= st.sezioni[sid].q3 + 0.5, `sezione ${sid}: ${s.punti} fuori dalla parte centrale della scala reale (${st.sezioni[sid].min}–${st.sezioni[sid].q3})`);
  }
  // tetto: anche il dossier migliore possibile resta entro il massimo mai osservato
  const ottimo = dossierStrutturale();
  ottimo.fattiConfermati = { soggetto_distintivo: true, difetti_formali_testo: false, rapporto_pagine_minuti: 1, riconoscimenti_scrittura: true, societa_riconoscimenti_rilievo: true, anni_attivita_societa: 10, cast_rilievo_nazionale: true, quota_artistici_accordo_firmato: 1, quota_artistici_accordo_allegato: 1, capo_reparto_di_rilievo: true, quota_tecnici_accordo_firmato: 1, quota_tecnici_accordo_allegato: 1 };
  const a2 = ancoreTaratura(B, 'film', ottimo);
  for (const sid of ['A', 'B']) assert.ok(a2.sezioni[sid].atteso.max <= a2.sezioni[sid].tetto + 0.05, `sezione ${sid}: ${a2.sezioni[sid].atteso.max} oltre il massimo osservato ${a2.sezioni[sid].tetto}`);
  assert.ok(Object.values(a2.criteri).some((c) => c.ridotta > 0), 'l’eccedenza sul massimo osservato viene tolta dai criteri qualitativi');
});

/* ------------------------------------------------------------------ (d) un bando d’invenzione con famiglie diverse */

const BANDO_INVENZIONE = {
  id: 'invenzione', nome: 'Bando d’invenzione', territorio: 'Liguria', regione: 'Liguria', sogliaTotale: 60, punteggioMassimo: 100,
  categorie: [{ id: 'lungo', nome: 'Lungometraggi', griglia: 'G', soglie: { Q: 20 }, testoQualita: 'sceneggiatura', durataMin: 70 }],
  griglie: {
    G: {
      sezioni: [
        { id: 'Q', nome: 'Qualità', max: 40, criteri: [
          { id: 'q1', nome: 'Sceneggiatura', max: 15, tipo: 'qualitativo', famiglia: 'scrittura' },
          { id: 'q2', nome: 'Visione registica', max: 10, tipo: 'qualitativo', famiglia: 'visione' },
          { id: 'q3', nome: 'Sostenibilità', max: 5, tipo: 'qualitativo', famiglia: 'sostenibilita' },
          { id: 'q4', nome: 'Opere prime e giovani', max: 10, tipo: 'qualitativo', famiglia: 'formazione' },
        ] },
        { id: 'M', nome: 'Mercato', max: 60, criteri: [
          { id: 'm1', nome: 'Distribuzione', max: 20, tipo: 'qualitativo', famiglia: 'distribuzione' },
          { id: 'm2', nome: 'Coproduzione internazionale', max: 10, tipo: 'discreto', famiglia: 'internazionale', valori: [{ punti: 10, etichetta: 'Sì' }, { punti: 5, etichetta: 'In parte' }, { punti: 0, etichetta: 'No' }] },
          { id: 'm3', nome: 'Occupazione locale', max: 10, tipo: 'qualitativo', famiglia: 'ricaduta_lavoro' },
          { id: 'm4', nome: 'Copertura', max: 10, tipo: 'qualitativo', famiglia: 'piano_finanziario' },
          { id: 'm5', nome: 'Giorni sul territorio', max: 10, tipo: 'fasce', famiglia: 'ricaduta_spesa', metrica: 'lavorazioneSicilia', peso: 1, fasce: [{ oltre: 50, punti: 10, etichetta: 'oltre metà' }, { da: 0, punti: 0, etichetta: 'meno' }] },
        ] },
      ],
    },
  },
};

test('(d) in un bando d’invenzione ogni criterio a giudizio ha la sua ancora, anche per famiglie senza casi reali', () => {
  const p = { ...dossierStrutturale(), bandoId: 'invenzione', categoriaId: 'lungo' };
  const anc = ancoreTaratura(BANDO_INVENZIONE, 'lungo', p);
  const attesi = BANDO_INVENZIONE.griglie.G.sezioni.flatMap((s) => s.criteri).filter(criterioAGiudizio).map((c) => c.id);
  assert.deepEqual(Object.keys(anc.criteri).sort(), attesi.sort());
  assert.ok(!anc.criteri.m5, 'il criterio a fasce puro resta al calcolo');
  for (const a of Object.values(anc.criteri)) {
    assert.ok(a.atteso.min >= 0 && a.atteso.max <= a.massimo && a.atteso.min <= a.atteso.max, a.id);
    assert.ok(a.rigoroso.max <= a.atteso.max && a.rigoroso.min <= a.atteso.min, a.id);
    assert.ok(a.regole.length >= 1 && a.spiegazione, a.id);
  }
  assert.equal(anc.criteri.q3.famigliaRegole, 'generica');
  assert.equal(anc.criteri.m3.famigliaRegole, 'generica');
  assert.equal(anc.criteri.q2.regole[0].id, 'visione-solo-note-di-regia');
  // punteggi fissi: la fascia si riduce ai valori ammessi
  assert.ok([0, 5, 10].includes(anc.criteri.m2.atteso.min) && [0, 5, 10].includes(anc.criteri.m2.atteso.max));
  // senza graduatorie reali non c’è tetto
  assert.equal(anc.sezioni.Q.tetto, null);
  // la tabella generica (50% / 80%) sostituisce quella che il criterio qualitativo non ha
  assert.equal(anc.criteri.m4.regole[0].id, 'piano-copertura-piena-solo-nella-lettura-attesa');
  const testo = testoAncore(anc, BANDO_INVENZIONE.griglie.G.sezioni[1]);
  assert.match(testo, /Criterio m1/);
  assert.match(testo, /Fuori fascia:/);
});

/* ------------------------------------------------------------------ funzioni */

test('firmeDocumento: firme nominative, non leggibili, digitali e timbri', () => {
  assert.equal(firmeDocumento('').soggetti, 0);
  const f = firmeDocumento('[firma autografa di Ada Neri]\n[firma autografa di Ada Neri]\n[firma autografa non leggibile]\n[timbro Società X]');
  assert.equal(f.nominative.length, 1);
  assert.equal(f.soggetti, 2, 'la stessa firma ripetuta conta una volta; il timbro accompagna una firma già contata');
  assert.ok(f.daControllare);
  assert.equal(firmeDocumento('Documento firmato digitalmente ai sensi del CAD').soggetti, 1);
  assert.equal(firmeDocumento('[firma digitale] [firma digitale di Ugo]').digitali, 2);
});

test('valutaRegola: tre esiti, con i fatti che decidono', () => {
  const r = { tutti: [['a', '=', true], ['n', '>=', 3]], almenoUno: [['b', '=', true], ['m', '>', 1]] };
  assert.equal(valutaRegola(r, { a: true, n: 3, b: true }).esito, 'certa');
  assert.equal(valutaRegola(r, { a: false, n: 3, b: true }).esito, 'esclusa');
  assert.deepEqual(valutaRegola(r, { a: false }).esclusaDa, ['a']);
  const p = valutaRegola(r, { a: true, n: 5, b: false, m: null });
  assert.equal(p.esito, 'possibile'); assert.deepEqual(p.ignoti, ['m']);
  assert.equal(valutaRegola(r, { a: true, n: 5, b: false, m: 0 }).esito, 'esclusa', 'almeno uno: tutte false');
  assert.equal(valutaRegola({ tutti: [], almenoUno: [] }, {}).esito, 'certa');
});

test('componiRegole: una regola, inviluppo delle possibili, centro con i fatti presunti, rigorosa mai sopra l’attesa', () => {
  const unica = componiRegole('distribuzione', { documento_distribuzione_allegato: false, distribuzione_dichiarata: false });
  assert.equal(unica.modo, 'unica'); assert.deepEqual(unica.attesa, [0, 0]); assert.equal(unica.fiducia, 'alta');
  const inv = componiRegole('societa', { opere_societa_quinquennio: 4, anni_attivita_societa: 3 });
  assert.equal(inv.modo, 'inviluppo-possibili');
  assert.ok(inv.attesa[0] <= 0.65 && inv.attesa[1] >= 0.8);
  assert.equal(inv.fiducia, 'bassa');
  assert.deepEqual(inv.regolaPresunta, ['societa-attiva-senza-riconoscimenti'], 'centro dalla regola con i valori presunti');
  assert.ok(inv.centro >= 0.68 && inv.centro <= 0.8);
  // famiglia senza regole proprie → generiche
  assert.equal(componiRegole('sostenibilita', { documenti_del_criterio: 0 }).regole[0].id, 'generica-senza-documenti');
  for (const fam of FAMIGLIE_TARATE) {
    const c = componiRegole(fam, {});
    assert.ok(c.rigorosa[0] <= c.attesa[0] && c.rigorosa[1] <= c.attesa[1], fam);
    assert.ok(c.centro >= c.attesa[0] && c.centro <= c.attesa[1], fam);
  }
});

test('fattiDossier: documenti, persone, piano finanziario e risposte del produttore', () => {
  const p = dossierStrutturale();
  const f = fattiDossier(B, p).valori;
  assert.equal(f.testo_opera_presente, true);
  assert.equal(f.testo_opera_integrale, true);
  assert.equal(f.rapporto_pagine_minuti, 1.25);
  assert.equal(f.soggetto_distintivo, true, 'indizio: storia vera');
  assert.equal(f.legame_territorio_strutturale, true, 'indizio: luoghi del territorio nelle intestazioni');
  assert.equal(f.location_reali_documentate, true);
  assert.equal(f.note_regia_presenti, true);
  assert.equal(f.opere_societa_quinquennio, 3);
  assert.equal(f.anni_attivita_societa, 4);
  assert.equal(f.figure_artistiche_dichiarate, true);
  assert.equal(f.quota_artistici_accordo_allegato, 0.29);
  assert.equal(f.quota_artistici_accordo_firmato, 0.14, 'firmato dalla sola interprete che ha siglato il deal memo');
  assert.equal(f.cast_rilievo_nazionale, true);
  assert.equal(f.regista_esordiente, true);
  assert.equal(f.capireparto_coperti, true);
  assert.equal(f.capo_reparto_di_rilievo, true);
  assert.equal(f.quota_tecnici_accordo_allegato, 0);
  assert.equal(f.copertura_dichiarata, 0.929);
  assert.equal(f.copertura_attesa, 0.857);
  assert.equal(f.copertura_rigorosa, 0);
  assert.equal(f.distribuzione_contratto, true);
  assert.equal(f.distribuzione_firmata, true);
  assert.equal(f.distributore_qualifica_provata, false);
  assert.equal(f.coproduttori_esteri_n, 2);
  assert.equal(f.accordo_coproduzione_estera_firmato, true);
  assert.equal(f.coproduttori_esteri_rilevanza_provata, false);
  assert.equal(f.incoerenze_cv_moduli, true, 'confermato dal produttore');
  // un dossier vuoto non rompe nulla e dà fatti prudenti
  const vuoto = fattiDossier(B, { categoriaId: 'film', anno: 2027, dati: datiVuoti(), documenti: [] });
  assert.equal(vuoto.valori.testo_opera_presente, false);
  assert.equal(vuoto.valori.copertura_attesa, null);
  assert.equal(vuoto.valori.figure_artistiche_dichiarate, false);
  assert.ok(Object.keys(FATTI).every((k) => k in vuoto.valori), 'ogni fatto ha un valore o null');
  // le risposte con il tipo sbagliato si ignorano
  const strano = fattiDossier(B, { ...p, fattiConfermati: { cast_rilievo_nazionale: 'sì', inventato: true } }).valori;
  assert.equal(strano.cast_rilievo_nazionale, true);
  assert.ok(!('inventato' in strano));
});

test('righePiano: lettura dichiarata, attesa e rigorosa riga per riga', () => {
  const p = dossierStrutturale();
  const righe = righePiano(p.dati, p.documenti);
  assert.equal(righe.length, 4, 'esclusa la richiesta al bando');
  const r = (voce) => righe.find((x) => x.voce === voce);
  assert.equal(r('2.1').attesa, false, 'referenze dichiarate ma non allegate');
  assert.equal(r('3.1').attesa, true);
  assert.equal(r('3.1').rigorosa, false);
  assert.match(r('3.1').motivo, /curriculum societario/);
  assert.match(r('4.1').motivo, /non vincolanti/);
  assert.deepEqual(allegatiPerRiga({ voce: '', etichetta: 'Minimo garantito Italia' }), ['distribuzione']);
  assert.deepEqual(allegatiPerRiga({ voce: '2.1' }), ['referenze_bancarie']);
  // con firme di tutte le parti, importo e curriculum del coproduttore la riga regge alla lettura rigorosa
  p.documenti.push(doc('cv_halde.pdf', 'coproduzione', 'Halde Pictures GmbH, Germania — company profile e filmografia.'));
  assert.equal(righePiano(p.dati, p.documenti).find((x) => x.voce === '3.1').rigorosa, true);
});

test('testoAncore: fasce, ragioni e regola per uscire dalla fascia; vuoto senza ancore', () => {
  const anc = ancoreTaratura(B, 'film', dossierStrutturale());
  const sezB = getGriglia(B, 'film').sezioni.find((s) => s.id === 'B');
  const t = testoAncore(anc, sezB);
  assert.match(t, /TARATURA SUI CASI REALI/);
  assert.match(t, /Criterio 3\.2 — Componente artistica \(massimo 10\): ATTESA 8,3–9,3 punti · RIGOROSA 2–3,5 punti/);
  assert.match(t, /Fuori fascia:/);
  assert.match(t, /ERRORI DI LETTURA DA NON RIPETERE/);
  assert.ok(!t.includes('Errore: Calcolare la copertura'), 'solo gli errori delle famiglie della sezione');
  const tD = testoAncore(anc, 'D');
  assert.match(tD, /Copertura attesa 86%/);
  assert.equal(testoAncore(anc, 'C'), '', 'la sezione C è tutta calcolata');
  assert.equal(testoAncore(null, sezB), '');
});

test('scostamenti: segnala i criteri fuori fascia senza toccare i punteggi', () => {
  const p = dossierStrutturale();
  const anc = ancoreTaratura(B, 'film', p);
  const val = { '3.2': [{ commissario: 'X', punteggio: 3, rigoroso: 2, motivazione: 'Lettere mancanti.' }, { commissario: 'Y', punteggio: 3.4, rigoroso: 2, motivazione: 'Fuori fascia: modulo II, sezione II.6.' }], '1.2': [{ commissario: 'X', punteggio: 9, rigoroso: 8, motivazione: '' }] };
  const ris = componiRisultato(B, 'film', p.dati, val);
  const s = scostamenti(ris, anc);
  assert.equal(s.valutati, 2);
  assert.equal(s.fuori, 1);
  const c = s.criteri.find((x) => x.id === '3.2');
  assert.equal(c.stato, 'sotto');
  assert.equal(c.scarto, -5.1, 'media 3,2 contro il minimo atteso 8,3');
  assert.equal(c.gravita, 'marcato');
  assert.equal(c.motivati, 1);
  assert.match(c.spiegazione, /1 commissario motiva/);
  assert.equal(s.criteri.find((x) => x.id === '1.2').stato, 'dentro');
  assert.equal(ris.sezioni.find((x) => x.id === 'B').criteri.find((x) => x.id === '3.2').punti, 3.2, 'il punteggio dei commissari resta il loro');
  // funziona anche con le ancore compatte salvate nella valutazione
  assert.equal(scostamenti(ris, ancoreCompatte(anc)).fuori, 1);
  assert.equal(scostamenti(componiRisultato(B, 'film', p.dati, {}), anc).valutati, 0);
});

test('stimaDaRegole: quantitativi dal calcolo esistente, dossier vuoto segnalato come incompleto', () => {
  const p = dossierStrutturale();
  const st = stimaDaRegole(B, 'film', p);
  const c = st.sezioni.find((s) => s.id === 'C');
  for (const cr of c.criteri) {
    const def = getGriglia(B, 'film').sezioni.find((s) => s.id === 'C').criteri.find((x) => x.id === cr.id);
    assert.equal(cr.punti, valutaQuantitativo(def, p.dati, B).punti);
    assert.equal(cr.fonte, 'calcolo');
  }
  assert.ok(st.min <= st.totale && st.totale <= st.max && st.rigoroso <= st.totale);
  const vuoto = stimaDaRegole(B, 'film', { categoriaId: 'film', anno: 2027, dati: datiVuoti(), documenti: [] });
  assert.equal(vuoto.esito, 'incompleta');
  assert.ok(vuoto.bloccanti.some((b) => b.startsWith('1.1')));
  assert.ok(vuoto.datiMancanti.length > 0);
});

test('domandeAperte: solo fatti di giudizio non determinati, con la domanda', () => {
  const f = fattiDossier(B, dossierStrutturale({ confermati: false }));
  const d = domandeAperte(f);
  assert.ok(d.length > 0);
  assert.ok(d.every((x) => FATTI[x.fatto].natura === 'giudizio' && f.valori[x.fatto] == null && x.domanda.endsWith('?')));
});

test('taraturaDossier: ancore della valutazione, scostamenti e stima a seconda dello stato del dossier', () => {
  const p = dossierStrutturale();
  const senza = taraturaDossier(B, p, componiRisultato(B, 'film', p.dati, {}));
  assert.equal(senza.scostamenti, null);
  assert.ok(senza.stima && senza.stima.totale > 0);
  p.valutazione = { data: '2027-01-10T10:00:00Z', giudizi: { B: [{ commissario: { id: 'u', nome: 'U' }, criteri: [{ id: '3.2', punteggio: 9, rigoroso: 3, motivazione: '' }] }] }, taratura: ancoreCompatte(ancoreTaratura(B, 'film', p)) };
  const con = taraturaDossier(B, p, componiRisultato(B, 'film', p.dati, valutazioniPerCriterio(p.valutazione)));
  assert.equal(con.daValutazione, true);
  assert.equal(con.scostamenti.fuori, 0);
  assert.equal(con.cambiate, false);
  p.documenti = p.documenti.filter((d) => d.tipo !== 'distribuzione');
  assert.equal(taraturaDossier(B, p, componiRisultato(B, 'film', p.dati, valutazioniPerCriterio(p.valutazione))).cambiate, true, 'i fatti del dossier sono cambiati dopo la valutazione');
});

/* ------------------------------------------------------------------ collegamento con il motore */

function llmFinto() {
  const richieste = [];
  return {
    richieste, tipo: 'finto', etichetta: 'Finto', limiteByte: 2_000_000, paralleli: 3, cacheCondivisa: true,
    async chiama(p) {
      richieste.push(p);
      const ids = (/Valuta i criteri ([\d., ]+) della sezione/.exec(p.compito)?.[1] || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!ids.length) return { json: { controlli: [], sintesi: 's' }, modello: 'finto' };
      // un commissario un po’ severo sulla componente artistica, come la lettura alla cieca
      return { json: { criteri: ids.map((id) => ({ id, punteggio: id === '3.2' ? 4 : id === '5.1' ? 0 : 5, rigoroso: 1, valore: id === '5.1' ? 86 : null, motivazione: 'm', evidenze: [], criticita: [], miglioramenti: [] })), sintesi: 's' }, modello: 'finto' };
    },
  };
}

test('motore: le ancore entrano nelle istruzioni di ogni sezione e l’esito della taratura si salva nella valutazione', async () => {
  const p = dossierStrutturale();
  const llm = llmFinto();
  const val = await eseguiValutazione({ bando: B, progetto: p, llm, opzioni: { commissari: 3, modello: 'm', impegno: 'high' } });
  assert.equal(val.errori.length, 0);
  const sezB = llm.richieste.filter((r) => r.compito.includes('della sezione B'));
  assert.equal(sezB.length, 3);
  assert.ok(sezB.every((r) => r.system.includes('TARATURA SUI CASI REALI') && r.system.includes('Criterio 3.2')));
  assert.equal(new Set(sezB.map((r) => r.system + r.documenti)).size, 1, 'stesso prefisso per tutti i commissari (cache)');
  assert.ok(val.taratura, 'campo taratura nella valutazione');
  assert.equal(val.taratura.versione, '2026.1');
  assert.ok(val.taratura.criteri['3.2'].atteso.min > 4);
  const s = val.taratura.scostamenti;
  assert.ok(s.criteri.some((x) => x.id === '3.2' && x.stato === 'sotto'));
  assert.ok(s.sintesi.includes('3.2'));
  // il prompt accetta anche il brano vuoto (sezione senza ancore)
  const sezC = getGriglia(B, 'film').sezioni.find((x) => x.id === 'C');
  assert.ok(!promptSezione({ bando: B, categoriaId: 'film', anno: 2027, sezione: sezC, documenti: [], dati: p.dati, commissario: { nome: 'U', descrizione: 'd' }, ancore: '' }).system.includes('TARATURA SUI CASI'));
});

/* ------------------------------------------------------------------ riservatezza */

test('riservatezza: nel codice della taratura nessun importo, anno o numero d’istanza del caso reale', () => {
  for (const f of ['app/js/core/taratura-dati.js', 'app/js/core/ragionamento.js']) {
    const t = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.ok(!/€\s?\d|\d[\d.]{3,}\s?(?:€|euro)/i.test(t), `${f}: contiene un importo`);
    assert.ok(!/istanza\s+n\.?\s*\d|protocollo\s+n\.?\s*\d/i.test(t), `${f}: contiene un numero d’istanza`);
    assert.ok(!/\b20(1\d|2[0-5])\b/.test(t), `${f}: contiene un anno che potrebbe identificare il caso`);
  }
});
