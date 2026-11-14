import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import XLSX from 'xlsx';

import { BANDO_SICILIA as B } from '../app/js/core/bando-sicilia.js';
import {
  componiRisultato, puntiFascia, valutaQuantitativo, verificheAmmissibilita,
  suggerimentiQuantitativi, getGriglia, elencoCriteri, datiVuoti, stimaContributo, calcolaMetriche,
} from '../app/js/core/scoring.js';
import { leggiModuloIII, eModuloIII } from '../app/js/core/modulo3.js';

const qui = path.dirname(fileURLToPath(import.meta.url));
const criterio = (cat, id) => elencoCriteri(getGriglia(B, cat)).find((c) => c.id === id);

test('le griglie sommano a 100 e ogni sezione al proprio massimo', () => {
  for (const g of Object.values(B.griglie)) {
    let tot = 0;
    for (const s of g.sezioni) {
      const somma = s.criteri.reduce((a, c) => a + c.max, 0);
      assert.equal(somma, s.max, `sezione ${s.id} della griglia ${g.id}`);
      tot += s.max;
      for (const c of s.criteri.filter((x) => x.tipo === 'fasce')) {
        const top = Math.max(...c.fasce.map((f) => f.punti)) * c.peso;
        assert.ok(Math.abs(top - c.max) < 1e-9, `fascia massima del criterio ${c.id} = ${top}, attesa ${c.max}`);
      }
      for (const c of s.criteri.filter((x) => x.tipo === 'discreto')) {
        assert.equal(Math.max(...c.valori.map((v) => v.punti)), c.max);
      }
    }
    assert.equal(tot, 100);
  }
});

test('fasce del bando: valori di tabella e confini', () => {
  const c41 = criterio('film', '4.1');
  assert.equal(puntiFascia(c41, 80).punti, 8);
  assert.equal(puntiFascia(c41, 75).punti, 7.2, '75% non è “oltre il 75%”');
  assert.equal(puntiFascia(c41, 75.1).punti, 8);
  assert.equal(puntiFascia(c41, 51).punti, 7.2);
  assert.equal(puntiFascia(c41, 50.5).punti, 5.6, 'il vuoto 50-51 va alla fascia inferiore');
  assert.equal(puntiFascia(c41, 31).punti, 5.6);
  assert.equal(puntiFascia(c41, 10).punti, 4);
  const c42 = criterio('film', '4.2');
  assert.deepEqual([60, 40, 10, 0].map((v) => puntiFascia(c42, v).punti), [5, 4, 3, 0]);
  const c43 = criterio('film', '4.3');
  assert.deepEqual([80, 76, 60, 50, 0].map((v) => puntiFascia(c43, v).punti), [5, 4, 4, 3, 0]);
  const c44 = criterio('film', '4.4');
  assert.deepEqual([60, 40, 20, 10].map((v) => puntiFascia(c44, v).punti), [2, 1.6, 1.2, 0]);
  const c45 = criterio('film', '4.5');
  assert.deepEqual([301, 300, 251, 250, 151, 150].map((v) => puntiFascia(c45, v).punti), [10, 9, 9, 7, 7, 0]);
  const c51 = criterio('film', '5.1');
  assert.deepEqual([81, 80, 71, 61, 51, 50].map((v) => puntiFascia(c51, v).punti), [14.4, 12.8, 12.8, 11.2, 9.6, 0]);
  assert.equal(puntiFascia(c51, 10, { ripreseIniziate: true }).punti, 16);
  // tabella B
  assert.deepEqual([80, 60, 40, 10].map((v) => puntiFascia(criterio('documentario', '4.1'), v).punti), [10, 9, 7, 5]);
  assert.deepEqual([60, 40, 10, 0].map((v) => puntiFascia(criterio('documentario', '4.2'), v).punti), [7, 5.6, 4.2, 0]);
  assert.deepEqual([60, 40, 20, 5].map((v) => puntiFascia(criterio('documentario', '4.3'), v).punti), [3, 2.4, 1.8, 0]);
});

function datiEsempio() {
  const wb = XLSX.read(readFileSync(path.join(qui, 'fixtures/modulo3-esempio.xls')), { type: 'buffer' });
  assert.ok(eModuloIII(wb));
  return leggiModuloIII(wb);
}

test('lettura del Modulo III ufficiale (.xls)', () => {
  const { dati, accordi, avvisi } = datiEsempio();
  assert.equal(dati.titolo, "L'ultima tonnara");
  assert.equal(dati.tipologiaOpera, 'Film di produzione cinematografica');
  assert.equal(dati.durataMin, 100);
  assert.deepEqual(dati.giorni, { prepTot: 30, ripreseTot: 28, postTot: 60, prepSicilia: 24, ripreseSicilia: 28, postSicilia: 20 });
  assert.deepEqual(dati.professionisti, { artTot: 10, artSicilia: 6, crewTot: 20, crewSicilia: 15 });
  assert.equal(dati.economici.costoProduzione, 470000);
  assert.equal(dati.economici.costoAmmissibile, 460000);
  assert.equal(dati.economici.spesaSicilia, 270000);
  assert.equal(dati.economici.contributoRichiesto, 120000);
  assert.equal(dati.economici.producerFee, 30000);
  assert.equal(dati.piano.length, 5);
  assert.deepEqual(dati.piano.map((p) => [p.voce, p.importo, p.documento]), [
    ['1.1', 120000, 'nessuno'], ['1.2', 150000, 'nessuno'], ['2.1', 80000, 'nessuno'], ['2.2', 60000, 'contratto'], ['5.2', 60000, 'deal_memo'],
  ]);
  assert.equal(accordi.coproduzioneItalia.presente, true);
  assert.equal(accordi.distribuzione.ragioneSociale, 'Emittente Esempio');
  assert.deepEqual(avvisi, []);
});

test('il .xlsx senza valori calcolati dà gli stessi numeri (somme ricalcolate)', () => {
  const wb = XLSX.read(readFileSync(path.join(qui, 'fixtures/modulo3-esempio.xlsx')), { type: 'buffer' });
  const { dati } = leggiModuloIII(wb);
  assert.equal(dati.economici.costoProduzione, 470000);
  assert.equal(dati.economici.spesaSicilia, 270000);
  assert.equal(dati.professionisti.crewSicilia, 15);
});

test('punteggi quantitativi dell’esempio', () => {
  const dati = { ...datiVuoti(), ...datiEsempio().dati };
  const m = calcolaMetriche(dati);
  assert.ok(Math.abs(m.lavorazioneSicilia.valore - (52 / 58) * 100) < 1e-9);
  assert.equal(valutaQuantitativo(criterio('film', '4.1'), dati).punti, 8);
  assert.equal(valutaQuantitativo(criterio('film', '4.2'), dati).punti, 5);
  assert.equal(valutaQuantitativo(criterio('film', '4.3'), dati).punti, 4);
  const post = valutaQuantitativo(criterio('film', '4.4'), dati);
  assert.equal(post.punti, 1.6);
  assert.equal(post.min, 1.2, 'lettura alternativa sul totale dei giorni');
  assert.equal(valutaQuantitativo(criterio('film', '4.5'), dati).punti, 7);
  assert.equal(valutaQuantitativo(criterio('film', '5.1'), dati).punti, 0);
  const ris = componiRisultato(B, 'film', dati, {});
  const C = ris.sezioni.find((s) => s.id === 'C');
  assert.equal(C.punti, 25.6);
  assert.equal(C.superata, true);
  assert.equal(ris.esito, 'parziale');
  const D = ris.sezioni.find((s) => s.id === 'D');
  assert.equal(D.raggiungibile, false, 'con 5.1 a zero la sezione D non arriva a 15');
  assert.equal(ris.bloccanti.length, 1);
});

test('media dei commissari, arrotondamento e soglie', () => {
  const dati = { ...datiVuoti(), ...datiEsempio().dati };
  dati.piano = dati.piano.map((p) => (p.voce === '1.2' || p.voce === '2.1' ? { ...p, documento: 'delibera' } : p));
  const g = (v) => [1, 2, 3].map((i) => ({ commissario: `C${i}`, ...v(i) }));
  const val = {
    '1.1': g((i) => ({ punteggio: [5, 5.5, 6][i - 1] })),
    '1.2': g(() => ({ punteggio: 9 })),
    '2.1': g(() => ({ punteggio: 4.5 })),
    '3.1': g(() => ({ punteggio: 4 })),
    '3.2': g((i) => ({ punteggio: [7, 7, 8][i - 1] })),
    '3.3': g(() => ({ punteggio: 3 })),
    '5.1': g((i) => ({ valore: [74, 74, 62][i - 1] })),
    '5.2': g((i) => ({ punteggio: [2, 2, 1][i - 1] })),
    '5.3': g(() => ({ punteggio: 9 })),
  };
  const ris = componiRisultato(B, 'film', dati, val);
  const cr = (id) => ris.sezioni.flatMap((s) => s.criteri).find((c) => c.id === id);
  assert.equal(cr('1.1').punti, 5.5);
  assert.equal(cr('3.2').punti, 7.3);
  assert.equal(cr('5.1').punti, 12.3, '(12,8 + 12,8 + 11,2) / 3');
  assert.equal(cr('5.2').punti, 2, 'valori ammessi 0, 2, 5');
  assert.equal(cr('5.3').punti, 4, 'limitato al massimo del criterio');
  assert.equal(ris.completo, true);
  const tot = 5.5 + 9 + 4.5 + 4 + 7.3 + 3 + 25.6 + 12.3 + 2 + 4;
  assert.ok(Math.abs(ris.totale - tot) < 0.05);
  assert.equal(ris.esito, 'ammissibile');
  // sotto soglia di sezione anche con totale alto
  const basso = componiRisultato(B, 'film', dati, { ...val, '3.1': g(() => ({ punteggio: 2 })), '3.2': g(() => ({ punteggio: 6 })) });
  assert.equal(basso.esito, 'sotto_soglia');
  assert.match(basso.motivi.join(' '), /Sezione B/);
});

test('ammissibilità: spesa minima, tetto del contributo, allegati', () => {
  const dati = { ...datiVuoti(), ...datiEsempio().dati };
  let v = verificheAmmissibilita(B, 'film', 2027, dati, ['modulo3', 'sceneggiatura']);
  const by = (id) => v.find((x) => x.id === id);
  assert.equal(by('durata').esito, 'ok');
  assert.equal(by('contributo').esito, 'ok');
  assert.equal(by('spesa').esito, 'ok');
  assert.equal(by('quadratura').esito, 'ok');
  assert.equal(by('copertura').esito, 'critico');
  assert.equal(by('all_modulo1').esito, 'critico');
  assert.equal(by('all_green_film').esito, 'critico');
  assert.equal(by('all_coproduzione').esito, 'critico', 'coproduzione dichiarata nel piano ma senza documenti');
  assert.equal(by('req_ateco').esito, 'da_verificare');
  dati.economici.contributoRichiesto = 200000;
  v = verificheAmmissibilita(B, 'film', 2027, dati, []);
  assert.equal(v.find((x) => x.id === 'contributo').esito, 'critico', '200.000 supera il 30% di 470.000');
  assert.equal(v.find((x) => x.id === 'spesa').esito, 'critico', '270.000 è il 135% di 200.000');
  assert.equal(verificheAmmissibilita(B, 'cortometraggio', 2027, { ...dati, durataMin: 60 }, []).find((x) => x.id === 'durata').esito, 'critico');
});

test('suggerimenti e stima del contributo', () => {
  const dati = { ...datiVuoti(), ...datiEsempio().dati };
  const s = suggerimentiQuantitativi(B, 'film', dati);
  const crew = s.find((x) => x.criterio === '4.3');
  assert.match(crew.azione, /da 15 a 16 su 20/);
  assert.equal(crew.guadagno, 1);
  assert.equal(stimaContributo(120000, 72, 90), 96000);
  assert.equal(stimaContributo(120000, 90, 80), 120000);
});
