// Apprendimento dai casi reali: correzione con le regole, correzione appresa dai casi, caso da salvare.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pesoRegole, scartiAppresi, correzioneValutazione, correggi, casoDaDossier, tuttiICasi, descriviCorrezione, PESO_REGOLA, TETTO_CASI, SCARTI_REALI } from '../app/js/core/apprendimento.js';
import { BANDO_SICILIA } from '../app/js/core/bando-sicilia.js';
import { componiRisultato, getGriglia } from '../app/js/core/scoring.js';

const ancora = (o = {}) => ({ tipo: 'qualitativo', massimo: 10, centro: 8, fiducia: 'media', modo: 'unica', regole: [{ id: 'r', riscontro: 'caso' }], ...o });

test('peso delle regole: pieno con un riscontro reale, ridotto per le estrapolazioni, nullo per tabelle e criteri bloccati', () => {
  assert.equal(pesoRegole(ancora()), PESO_REGOLA.caso);
  assert.equal(pesoRegole(ancora({ regole: [{ riscontro: 'caso' }, { riscontro: 'distribuzione' }] })), PESO_REGOLA.altro);
  assert.equal(pesoRegole(ancora({ fiducia: 'bassa' })), PESO_REGOLA.altro);
  assert.equal(pesoRegole(ancora({ modo: 'inviluppo-possibili' })), PESO_REGOLA.altro);
  assert.equal(pesoRegole(ancora({ modo: 'tabella' })), 0);
  assert.equal(pesoRegole(ancora({ tabella: { coperturaAttesa: 81 } })), 0);
  assert.equal(pesoRegole(ancora({ tipo: 'discreto' })), 0);
  assert.equal(pesoRegole(ancora({ bloccante: 'manca il testo' })), 0);
  assert.equal(pesoRegole(ancora({ regole: [] })), 0);
  assert.equal(pesoRegole(null), 0);
});

test('correggi: media pesata verso il centro, più la parte appresa, sempre dentro il criterio', () => {
  assert.deepEqual(correggi(7.6, { centro: 8.8, peso: 0.5, casi: 0 }, 10), { punti: 8.2, grezzo: 7.6, regole: 0.6, casi: 0 });
  assert.equal(correggi(9, { centro: 7, peso: 0.25, casi: 0 }, 10).punti, 8.5, 'corregge anche verso il basso');
  assert.equal(correggi(9.8, { centro: 9.9, peso: 0.5, casi: 0.6 }, 10).punti, 10, 'non supera il massimo');
  assert.equal(correggi(0.2, { centro: 0, peso: 0.5, casi: -0.5 }, 4).punti, 0, 'non scende sotto zero');
  assert.deepEqual(correggi(5, null, 10), { punti: 5, grezzo: 5, regole: 0, casi: 0 });
});

test('scarti appresi: prudenza con pochi casi, tetto, solo stesso bando e stessa griglia', () => {
  const casi = [
    { bandoId: 'x', griglia: 'A', sezioni: { A: 0.04, B: 0.1 } },
    { bandoId: 'x', griglia: 'A', sezioni: { A: 0.0, B: 0.3 } },
    { bandoId: 'x', griglia: 'B', sezioni: { A: 0.5 } },
    { bandoId: 'altro', griglia: 'A', sezioni: { A: 0.5 } },
  ];
  const s = scartiAppresi(casi, 'x', 'A');
  assert.equal(s.A.n, 2); assert.equal(s.A.media, 0.02);
  assert.equal(s.A.frazione, 0.013, 'media × n/(n+1) = 0,02 × 2/3');
  assert.equal(s.B.frazione, TETTO_CASI, 'tetto');
  // un solo caso: metà dello scarto
  assert.equal(scartiAppresi([casi[0]], 'x', 'A').A.frazione, 0.02);
  assert.deepEqual(scartiAppresi([], 'x', 'A'), {});
});

test('correzione di una valutazione: criteri a giudizio sì, tabelle no; i punti dei casi si dividono per peso del criterio', () => {
  const griglia = { sezioni: [{ id: 'D', max: 25, criteri: [{ id: '5.1' }, { id: '5.2' }, { id: '5.3' }] }, { id: 'B', max: 20, criteri: [{ id: '3.1' }, { id: '3.2' }] }] };
  const ancore = { bandoId: 'x', criteri: {
    '5.1': ancora({ massimo: 16, modo: 'tabella', tabella: {}, tipo: 'fasce' }), '5.2': ancora({ massimo: 5, tipo: 'discreto' }), '5.3': ancora({ massimo: 4, centro: 3.7 }),
    '3.1': ancora({ massimo: 6, centro: 4.4, fiducia: 'bassa' }), '3.2': ancora({ massimo: 10, centro: 8.8 }),
  } };
  const c = correzioneValutazione(ancore, griglia, [{ bandoId: 'x', griglia: 'A', sezioni: { B: 0.08, D: 0.016 } }], 'A');
  assert.deepEqual(Object.keys(c.criteri).sort(), ['3.1', '3.2', '5.3']);
  assert.equal(c.criteri['3.2'].peso, 0.5); assert.equal(c.criteri['3.1'].peso, 0.25);
  // B: metà di 0,08 × 20 = 0,8 punti, divisi 6:10
  assert.equal(c.sezioni.B.punti, 0.8);
  assert.equal(c.criteri['3.1'].casi, 0.3); assert.equal(c.criteri['3.2'].casi, 0.5);
  // D: l'unico criterio a giudizio prende tutta la parte appresa
  assert.equal(c.criteri['5.3'].casi, 0.2);
  assert.equal(correzioneValutazione(null, griglia, []), null);
});

test('risultato: il voto corretto entra nei totali, la lettura rigorosa no; i criteri con tabella restano quelli', () => {
  const g = (id, punteggio, rigoroso, valore) => ({ commissario: 'c', id, punteggio, rigoroso, valore });
  const val = { '3.2': [g('3.2', 7.6, 3)], '5.1': [g('5.1', 0, 0, 81)], '5.2': [g('5.2', 5, 0)] };
  const dati = { giorni: {}, professionisti: {}, economici: {}, pianoFinanziario: [] };
  const semplice = componiRisultato(BANDO_SICILIA, 'film', dati, val);
  Object.defineProperty(val, 'correzione', { value: { criteri: { '3.2': { centro: 8.8, peso: 0.5, casi: 0.3 }, '5.1': { centro: 16, peso: 0.5, casi: 1 }, '5.2': { centro: 0, peso: 0.5, casi: 0 } } }, enumerable: false });
  const corretto = componiRisultato(BANDO_SICILIA, 'film', dati, val);
  const cr = (r, id) => r.sezioni.flatMap((s) => s.criteri).find((c) => c.id === id);
  assert.equal(cr(semplice, '3.2').punti, 7.6);
  assert.equal(cr(corretto, '3.2').punti, 8.5);
  assert.deepEqual(cr(corretto, '3.2').taratura, { grezzo: 7.6, regole: 0.6, casi: 0.3 });
  assert.equal(cr(corretto, '3.2').rigoroso, 3);
  assert.equal(cr(corretto, '5.1').punti, 14.4, 'tabella del bando: nessuna correzione');
  assert.equal(cr(corretto, '5.1').taratura, undefined);
  assert.equal(cr(corretto, '5.2').punti, 5);
  assert.equal(Math.round((corretto.totale - semplice.totale) * 10) / 10, 0.9);
  assert.deepEqual(descriviCorrezione({ sezioni: { B: { n: 1 } } }, corretto), { criteri: 1, regole: 0.6, casi: 0.3, totale: 0.9, nCasi: 1 });
});

test('caso da salvare: scarto sulla stima senza la parte appresa; le sezioni solo calcolate non insegnano nulla', () => {
  const ris = { sezioni: [
    { id: 'B', massimo: 20, punti: 15.5, completo: true, criteri: [{ fonte: 'commissione', taratura: { grezzo: 7, regole: 0.5, casi: 0.3 } }, { fonte: 'commissione', taratura: { grezzo: 4, regole: 0, casi: 0.2 } }] },
    { id: 'C', massimo: 30, punti: 30, completo: true, criteri: [{ fonte: 'calcolo' }] },
    { id: 'D', massimo: 25, punti: 20, completo: false, criteri: [{ fonte: 'commissione' }] },
  ] };
  const caso = casoDaDossier({ id: 'p1', bandoId: 'x', griglia: 'A', categoriaId: 'film', anno: 2026, versione: '2.0.3', ris, reale: { B: 16.6, C: 30, D: 23 } });
  assert.equal(caso.id, 'dossier-p1');
  assert.deepEqual(Object.keys(caso.sezioni), ['B']);
  assert.equal(caso.dettaglio.B.stima, 15, '15,5 meno 0,5 di parte appresa');
  assert.equal(caso.sezioni.B, 0.08);
  assert.equal(casoDaDossier({ id: 'p', bandoId: 'x', ris, reale: {} }), null);
});

test('casi incorporati: solo frazioni, nessun dato del progetto; un caso dell’utente con lo stesso id lo sostituisce', () => {
  for (const c of SCARTI_REALI) {
    assert.deepEqual(Object.keys(c).sort(), ['bandoId', 'griglia', 'id', 'sezioni', 'versione']);
    for (const f of Object.values(c.sezioni)) assert.ok(Number.isFinite(f) && Math.abs(f) < 0.3);
    assert.ok(getGriglia(BANDO_SICILIA, 'film') && c.bandoId === BANDO_SICILIA.id);
  }
  assert.ok(SCARTI_REALI.length >= 1);
  const sorgente = readFileSync(new URL('../app/js/core/apprendimento.js', import.meta.url), 'utf8');
  assert.ok(!/€\s?\d|\d[\d.]{3,}\s?(?:€|euro)/i.test(sorgente), 'nessun importo');
  assert.ok(!/istanza\s+n\.?\s*\d|protocollo\s+n\.?\s*\d/i.test(sorgente), 'nessun numero d’istanza');
  const mio = { id: SCARTI_REALI[0]?.id || 'x', bandoId: 'b', sezioni: { A: 0 } };
  const tutti = tuttiICasi([mio]);
  assert.equal(tutti.filter((c) => c.id === mio.id).length, 1);
  assert.equal(tutti.find((c) => c.id === mio.id).bandoId, 'b');
});
