// La conoscenza fissa del bando Sicilia: testo ufficiale, moduli, punteggi reali della finestra 2026.
// Questi test legano la griglia trascritta ai documenti ufficiali: se non tornano, la griglia è sbagliata.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BANDO_SICILIA as B } from '../app/js/core/bando-sicilia.js';
import { getGriglia, getCategoria, statisticheEsiti, posizioneEsiti, stimaContributo, datiVuoti, r1 } from '../app/js/core/scoring.js';
import { promptSezione, promptVerifica } from '../app/js/core/prompts.js';

const articolo = (n) => B.testi.find((a) => a.id === `art${n}`).testo;
const esiti = B.esiti[0].categorie;

test('il testo ufficiale conferma soglie, massimali e finestre della griglia', () => {
  assert.equal(B.testi.length, 16, 'articoli 3-18');
  assert.match(articolo(10), /almeno 65\/100/);
  assert.match(articolo(10), /media aritmetica di quelli attribuiti dai singoli membri/);
  assert.match(articolo(10), /A 17, B 13, C 20, D 15/);
  assert.match(articolo(6), /30% del costo di produzione, entro il limite massimo di € 750\.000 per la finestra del 2025 ed € 1\.000\.000/);
  assert.match(articolo(6), /35% del costo di produzione entro il limite massimo di € 150\.000/);
  assert.match(articolo(6), /limite massimo di € 15\.000/);
  assert.match(articolo(5), /almeno il 150% del contributo richiesto/);
  assert.match(articolo(8), /ANNO 2027: dal 01 febbraio al 15 marzo/);
  assert.match(articolo(11), /rapporto tra il punteggio attribuito al progetto medesimo e quello conseguito dal progetto primo in graduatoria/);
  const film = getCategoria(B, 'film');
  assert.deepEqual([film.contributo.percentuale, film.contributo.massimali[2027], B.sogliaTotale, B.spesaTerritorioMinPct], [30, 1000000, 65, 150]);
  assert.deepEqual(B.finestre.find((f) => f.anno === 2027), { anno: 2027, dal: '2027-02-01', al: '2027-03-15' });
});

test('graduatorie 2026 e 2025: i 152 progetti reali rispettano le regole trascritte', () => {
  assert.deepEqual(B.esiti.map((e) => e.anno), [2026, 2025]);
  assert.deepEqual(Object.values(esiti).map((r) => r.length), [38, 25, 12]);
  assert.deepEqual(Object.values(B.esiti[1].categorie).map((r) => r.length), [47, 23, 7]);
  for (const edizione of B.esiti) for (const [cat, righe] of Object.entries(edizione.categorie)) {
    const soglie = getCategoria(B, cat).soglie;
    const sezC = getGriglia(B, cat).sezioni.find((s) => s.id === 'C');
    // tutti i punteggi ottenibili nella sezione C combinando le fasce
    let somme = new Set([0]);
    for (const c of sezC.criteri) { const n = new Set(); for (const s of somme) for (const f of c.fasce) n.add(r1(s + f.punti * c.peso)); somme = n; }
    // il primo della graduatoria finale: le istanze uscite dopo la pubblicazione ('R') non contano
    const primo = Math.max(...righe.filter((r) => r.stato === 'F' || r.stato === 'N').map((r) => r.totale));
    const id = `${edizione.anno} ${cat} istanza`;
    for (const r of righe) {
      assert.ok(['F', 'N', 'X', 'R'].includes(r.stato), `${id} ${r.n}: stato`);
      assert.ok(somme.has(r.sezioni.C), `${id} ${r.n}: C = ${r.sezioni.C} non ottenibile dalle fasce trascritte`);
      const sottoSoglia = r.totale < B.sogliaTotale || Object.entries(soglie).some(([k, v]) => r.sezioni[k] < v);
      assert.equal(sottoSoglia, r.stato === 'X', `${id} ${r.n}: esito reale e soglie non coincidono`);
      for (const [k, v] of Object.entries(r.sezioni)) assert.ok(v >= 0 && v <= getGriglia(B, cat).sezioni.find((s) => s.id === k).max);
      if (!(edizione.anno === 2026 && cat === 'documentario' && r.n === 91)) assert.ok(Math.abs(r1(r.sezioni.A + r.sezioni.B + r.sezioni.C + r.sezioni.D) - r.totale) < 0.05, `${id} ${r.n}: somma delle sezioni`);
      // art. 11.1: contributo = richiesto × punteggio ÷ punteggio del primo (salvo le quote residue, marcate «ridotto»)
      if (r.concedibile && !r.ridotto) assert.ok(Math.abs(stimaContributo(r.richiesto, r.totale, primo) - r.concedibile) < 0.02, `${id} ${r.n}: contributo`);
      if (r.stato === 'F') assert.ok(r.concedibile > 0, `${id} ${r.n}: un finanziato ha un contributo`);
      if (r.stato === 'R') assert.ok(r.nota && r.concedibile == null, `${id} ${r.n}: un’istanza uscita dice perché e non ha contributo`);
    }
  }
  // rettifica del D.D.G. 2469 e scorrimento del D.D.G. 3304 (documentari 2026)
  const doc = Object.fromEntries(esiti.documentario.map((r) => [r.n, r]));
  assert.deepEqual([doc[15].sezioni.D, doc[15].totale, doc[99].totale], [0, 61.1, 75.1]);
  assert.deepEqual([doc[89].stato, doc[91].stato, doc[7].stato, doc[7].concedibile], ['R', 'R', 'F', 25685.13]);
  const somma = (cat) => Math.round(esiti[cat].filter((r) => r.stato === 'F').reduce((a, r) => a + r.concedibile, 0) * 100) / 100;
  assert.deepEqual([somma('film'), somma('documentario'), somma('cortometraggio')], [5076653.29, 498995.42, 28583.91], 'importi consolidati del D.D.G. 3304');
  // 2025 dopo lo scorrimento del D.D.G. 3542: tutti i film ammissibili finanziati, per € 9.636.080,55
  const f25 = B.esiti[1].categorie.film.filter((r) => r.stato === 'F');
  assert.equal(f25.length, 22);
  assert.equal(Math.round(f25.reduce((a, r) => a + r.concedibile, 0) * 100) / 100, 9636080.55);
});

test('statistiche e posizione in graduatoria', () => {
  const f = statisticheEsiti(B, 'film');
  assert.deepEqual([f.anno, f.valutati, f.ammissibili, f.finanziati, f.primo, f.ultimoFinanziato], [2026, 38, 11, 11, 86.1, 77.1]);
  assert.deepEqual([f.sezioni.A.min, f.sezioni.A.mediana, f.sezioni.A.max], [16, 19.5, 21.7]);
  assert.equal(f.esclusiPer.D, 26, 'la sezione D è la causa di quasi tutte le esclusioni');
  const d = statisticheEsiti(B, 'documentario');
  assert.deepEqual([d.anno, d.ammissibili, d.finanziati, d.ultimoFinanziato], [2026, 12, 8, 79]);
  assert.deepEqual([d.esclusiPer.C, d.esclusiPer.D], [8, 10], 'documentari 2026 rettificati');
  assert.deepEqual(posizioneEsiti(B, 'film', 79), { posizione: 9, su: 12, finanziabile: true, ultimoFinanziato: 77.1 });
  assert.equal(posizioneEsiti(B, 'documentario', 78.5).finanziabile, false, 'ammissibile ma sotto l’ultimo finanziato');
  assert.equal(posizioneEsiti(B, 'documentario', 79).finanziabile, true, 'dopo lo scorrimento l’ultimo finanziato ha 79 punti');
});

test('ogni lettura di Claude riceve testo ufficiale e taratura', () => {
  const dati = datiVuoti();
  const sez = (id) => getGriglia(B, 'film').sezioni.find((s) => s.id === id);
  const a = promptSezione({ bando: B, categoriaId: 'film', anno: 2027, sezione: sez('A'), documenti: [], dati, commissario: { nome: 'X', descrizione: 'y' } });
  assert.match(a.system, /METRO REALE DELLA COMMISSIONE — finestra 2026/);
  assert.match(a.system, /Tra i 42 progetti finanziati nelle finestre 2024, 2025, 2026/);
  assert.match(a.system, /PRASSI OSSERVATA/);
  assert.match(a.system, /«rigoroso»/, 'ogni commissario dà la lettura attesa e quella rigorosa');
  assert.match(a.system, /da 16 a 21,7 su 25/);
  assert.match(a.system, /TESTO UFFICIALE DELL'AVVISO/);
  assert.match(a.system, /Art\. 10 — /);
  assert.ok(!a.system.includes('Art. 7 — '), 'la sezione A non riceve gli articoli sulle spese');
  const d = promptSezione({ bando: B, categoriaId: 'film', anno: 2027, sezione: sez('D'), documenti: [], dati, commissario: { nome: 'X', descrizione: 'y' } });
  assert.match(d.system, /Art\. 7 — /);
  assert.match(d.system, /referenze bancarie/);
  const v = promptVerifica({ bando: B, categoriaId: 'film', anno: 2027, documenti: [], tutti: [], dati });
  assert.match(v.system, /STRUTTURA DEI MODULI UFFICIALI/);
  assert.match(v.system, /900 battute/);
  assert.match(v.system, /Art\. 5 — /);
  assert.match(v.system, /Art\. 18 — /);
  // con l'account Claude nell'app una lettura non può superare 256 KiB: deve restare spazio per la sceneggiatura
  assert.ok(new TextEncoder().encode(a.system).length < 30000);
  assert.ok(new TextEncoder().encode(v.system).length < 110000);
});
