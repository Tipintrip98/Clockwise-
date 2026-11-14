// Report completo in PDF, confronto con il punteggio reale, date del Modulo III.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';

import { BANDO_SICILIA as B } from '../app/js/core/bando-sicilia.js';
import { datiVuoti, getGriglia } from '../app/js/core/scoring.js';
import { creaReportPdf, pulisci } from '../app/js/core/report-pdf.js';
import { raccogliReport, confrontoConReale } from '../app/js/core/report-dati.js';
import { dataDaExcel } from '../app/js/core/modulo3.js';
import { APP } from '../app/js/core/versione.js';

const commissari = [{ id: 'drammaturgia', nome: 'Esperta di sceneggiatura' }, { id: 'produzione', nome: 'Esperto di produzione' }, { id: 'territorio', nome: 'Esperta di film commission' }];
function dossier() {
  const dati = { ...datiVuoti(), titolo: 'L’ultima tonnara', tipologiaOpera: 'Film', durataMin: 100,
    giorni: { prepTot: 30, prepSicilia: 24, ripreseTot: 28, ripreseSicilia: 28, postTot: 60, postSicilia: 20 }, professionisti: { artTot: 10, artSicilia: 6, crewTot: 20, crewSicilia: 15 },
    economici: { costoProduzione: 470000, costoAmmissibile: 460000, contributoRichiesto: 120000, spesaSicilia: 270000, producerFee: 30000 },
    piano: [{ voce: '1.1', etichetta: 'Contributo richiesto', importo: 120000, documento: 'nessuno' }, { voce: '2.2', etichetta: 'Produttori indipendenti', denominazione: 'Coproduttore d’esempio', importo: 350000, documento: 'contratto' }] };
  const giudizi = {};
  for (const sez of getGriglia(B, 'film').sezioni) {
    const qual = sez.criteri.filter((c) => c.tipo !== 'fasce' || c.giudizio);
    if (qual.length) giudizi[sez.id] = commissari.map((c, i) => ({ commissario: c, sintesi: 'Giudizio complessivo della sezione.', criteri: qual.map((cr) => ({ id: cr.id, punteggio: cr.tipo === 'fasce' ? undefined : Math.round(cr.max * (0.7 + i * 0.05) * 10) / 10, valore: cr.tipo === 'fasce' ? 80 : undefined,
      motivazione: 'Motivazione del commissario con un riscontro nei documenti.', evidenze: ['Evidenza tratta dalla sceneggiatura'], criticita: ['Punto debole da correggere'], miglioramenti: [{ azione: 'Allegare la lettera di intento firmata', punti: 1.5 }] })) }));
  }
  return { id: 'x', nome: 'Dossier di prova', categoriaId: 'film', anno: 2027, dati, reale: { A: 19.8, B: 16.6, C: 30, D: 23.1 },
    documenti: [{ id: '1', nome: 'Modulo III.xls', tipo: 'modulo3', testo: 'x'.repeat(2000), avvisi: [] }, { id: '2', nome: 'contratto.pdf', tipo: 'coproduzione', testo: '', pagine: 8, scansione: true, avvisi: ['PDF senza testo selezionabile (scansione)'] }],
    valutazione: { data: '2026-11-14T10:00:00Z', modello: 'modello-di-prova', collegamento: 'Account Claude', commissari, giudizi, verifica: { sintesi: 'Moduli coerenti.', controlli: [{ titolo: 'Titolo dell’opera', esito: 'ok', dettaglio: 'Coincide.', azione: '' }] }, errori: [], note: [] },
    legale: { fascicolo: { data: '2026-11-14T11:00:00Z', sintesi: 'Quadro contrattuale.', incongruenze: ['Quota diversa tra contratto e modulo.'], parti: [{ nome: 'Esempio Film', ruolo: 'produttore', documenti: ['contratto.pdf'] }], impegni: [], date: [], documenti: [] } } };
}

test('testo per il PDF: solo caratteri che i font standard sanno scrivere', () => {
  assert.equal(pulisci('→ ✓ “ciao” l’€ 1 234 ≥ 3 ″ 😀 è — «x»'), '-> sì “ciao” l’€ 1 234 >= 3 " ? è — «x»');
  assert.equal(pulisci(null), '');
  assert.equal(pulisci('riga uno\nriga due'), 'riga uno\nriga due');
});

test('report completo in PDF: tutte le sezioni, crediti, numerazione', () => {
  const p = dossier();
  const { buffer, pagine } = creaReportPdf(jsPDF, B, p, { oggi: new Date('2026-11-14T12:00:00Z'), compressione: false });
  const pdf = Buffer.from(buffer).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-'));
  assert.ok(pagine >= 6, `pagine: ${pagine}`);
  for (const atteso of ['REPORT INTERNO COMPLETO', 'RISERVATO', '1. Che cosa sistemare prima', '2. Punteggio criterio per criterio', '3. Ammissibilit', '4. Confronto con la graduatoria reale 2026',
    '5. Prova con il punteggio reale', '6. Stima del contributo', '7. Dati del dossier', '8. Documenti caricati', '9. Come ', 'Appendice B', 'Esperta di sceneggiatura', 'Evidenza tratta dalla sceneggiatura',
    'Allegare la lettera di intento firmata', 'Piano finanziario', 'Quota diversa tra contratto e modulo', `Pagina 1 di ${pagine}`, `Pagina ${pagine} di ${pagine}`, `${APP.nome} ${APP.versione}`, APP.autore]) {
    assert.ok(pdf.includes(atteso), `nel PDF manca: ${atteso}`);
  }
  assert.ok(!pdf.includes('Appendice A'), 'senza spoglio né preventivo non c’è l’appendice di produzione');
  // punteggio reale e scarto riportati
  assert.ok(pdf.includes('(89,5)') || pdf.includes('89,5'), 'totale reale');
  // la versione compressa è lo stesso documento, più leggero
  const compresso = creaReportPdf(jsPDF, B, p, { oggi: new Date('2026-11-14T12:00:00Z') });
  assert.equal(compresso.pagine, pagine);
  assert.ok(compresso.buffer.byteLength < buffer.byteLength / 2);
});

test('report in PDF anche per un dossier vuoto', () => {
  const vuoto = { id: 'v', nome: 'Nuovo dossier', categoriaId: 'documentario', anno: 2027, dati: datiVuoti(), documenti: [] };
  const { buffer, pagine } = creaReportPdf(jsPDF, B, vuoto, { compressione: false });
  const pdf = Buffer.from(buffer).toString('latin1');
  assert.ok(pagine >= 3);
  assert.ok(pdf.includes('Nessun documento caricato') && pdf.includes('Stima parziale') && !pdf.includes('5. Prova con il punteggio reale'));
});

test('confronto con il punteggio reale e raccolta dei dati del report', () => {
  const p = dossier();
  const R = raccogliReport(B, p, new Date(2026, 10, 14));
  assert.ok(R.ris.completo);
  assert.equal(R.reale.totaleReale, 89.5);
  assert.equal(R.reale.righe.length, 4);
  assert.ok(R.reale.scartoMedio >= 0 && R.reale.scartoTotale === Math.round((R.ris.totale - 89.5) * 10) / 10);
  assert.ok(R.controlli.some((c) => c.id.startsWith('fmt_let_')), 'la scansione non letta è tra i controlli');
  assert.equal(confrontoConReale(R.ris, {}).presenti, false);
  assert.equal(confrontoConReale(R.ris, { A: 20 }).totaleReale, null, 'senza tutte le sezioni non c’è un totale reale');
});

test('date del Modulo III scritte come numero di serie di Excel', () => {
  assert.equal(dataDaExcel('45717'), '01/03/2025');
  assert.equal(dataDaExcel(45752), '05/04/2025');
  assert.equal(dataDaExcel('13/09/2027'), '13/09/2027');
  assert.equal(dataDaExcel('2027'), '2027');
  assert.equal(dataDaExcel(''), '');
});
