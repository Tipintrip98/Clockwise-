// Green Film: disciplinare Edizione 03 – 2024, calcolo dei punti, minimo, documenti, riconoscimento delle richieste.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SEZIONI_GREEN, CRITERI_GREEN, MINIMO_GREEN, RIDUZIONE_EMAS, TOTALE_GREEN, PREREQUISITO, EDIZIONE_PRECEDENTE,
  puntiCriterio, calcolaGreen, suggerimentiGreen, scadenzeGreen, leggiRichiestaGreen, csvGreen, criterioGreen } from '../app/js/core/greenfilm.js';
import { BANDO_SICILIA } from '../app/js/core/bando-sicilia.js';
import { promptVerifica } from '../app/js/core/prompts.js';
import { sanificaBando } from '../app/js/core/bandi/schema.js';
import { riconosciTipo } from '../app/js/core/docs.js';

const massimo = (c) => (c.tipo === 'fisso' ? true : c.tipo === 'giudizio' ? c.max : c.tipo === 'somma' ? c.voci.map((v) => v.id) : c.livelli[0].id);

test('disciplinare: sette sezioni, 65 punti in tutto, massimi per sezione come nel testo ufficiale', () => {
  assert.deepEqual(SEZIONI_GREEN.map((s) => s.id), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  const perSezione = Object.fromEntries(SEZIONI_GREEN.map((s) => [s.id, s.criteri.reduce((a, c) => a + c.max, 0)]));
  assert.deepEqual(perSezione, { A: 9, B: 16, C: 13, D: 9, E: 5, F: 9, G: 4 });
  assert.equal(CRITERI_GREEN.reduce((a, c) => a + c.max, 0), TOTALE_GREEN);
  assert.equal(TOTALE_GREEN, 65); assert.equal(MINIMO_GREEN, 25); assert.equal(RIDUZIONE_EMAS, 5);
  assert.equal(CRITERI_GREEN.length, 24);
  for (const c of CRITERI_GREEN) {
    assert.ok(c.documenti.length >= 1, `${c.id}: documenti da presentare`);
    assert.ok(c.requisito.length > 20, `${c.id}: requisito`);
    // il livello più alto di ogni criterio vale il suo massimo
    assert.equal(puntiCriterio(c, massimo(c)), c.max, `${c.id}: massimo`);
  }
  assert.equal(PREREQUISITO.voci.filter((v) => v.quando === 'prima').length, 6);
});

test('punti dei criteri: soglie, opzioni, somme, sì/no, giudizio', () => {
  assert.equal(puntiCriterio(criterioGreen('A1'), '100'), 4); assert.equal(puntiCriterio(criterioGreen('A1'), '75'), 3);
  assert.equal(puntiCriterio(criterioGreen('B2'), 'elettriche'), 3);
  assert.equal(puntiCriterio(criterioGreen('D1'), 'entrambi'), 3); assert.equal(puntiCriterio(criterioGreen('D1'), 'legno'), 1);
  assert.equal(puntiCriterio(criterioGreen('G1'), ['video', 'formazione', 'iniziativa']), 4);
  assert.equal(puntiCriterio(criterioGreen('F1'), ['carta']), 1);
  assert.equal(puntiCriterio(criterioGreen('E1'), true), 3); assert.equal(puntiCriterio(criterioGreen('E1'), false), 0);
  assert.equal(puntiCriterio(criterioGreen('D3'), 7), 3, 'il giudizio non supera il massimo');
  assert.equal(puntiCriterio(criterioGreen('A1'), 'inesistente'), 0);
  assert.equal(puntiCriterio(null, true), 0);
});

test('piano: sotto il minimo, minimo con margine stretto, minimo solido; EMAS abbassa la soglia', () => {
  const vuoto = calcolaGreen({});
  assert.equal(vuoto.totale, 0); assert.equal(vuoto.raggiunto, false); assert.equal(vuoto.minimo, 25);
  assert.equal(vuoto.avvisi[0].livello, 'critico'); assert.match(vuoto.avvisi[0].testo, /Mancano 25 punti/);

  const scelte = { A1: '100', A3: '100', B1: true, B4: '100', C1: 'rete', C2: 'ristoranti', C3: ['veg'], D4: true, F3: true, G1: ['formazione'] }; // 4+2+2+4+3+4+1+1+3+2 = 26
  const stretto = calcolaGreen({ scelte });
  assert.equal(stretto.totale, 26); assert.equal(stretto.raggiunto, true); assert.equal(stretto.solido, false);
  assert.match(stretto.avvisi.map((a) => a.testo).join(' '), /margine sul minimo è di soli 1 punti/);
  assert.match(stretto.avvisi.map((a) => a.testo).join(' '), /prerequisito PR1 è obbligatorio/);
  assert.equal(stretto.sezioni.find((s) => s.id === 'A').punti, 6);
  assert.deepEqual(stretto.documenti.map((d) => d.id), ['A1', 'A3', 'B1', 'B4', 'C1', 'C2', 'C3', 'D4', 'F3', 'G1']);

  const pre = Object.fromEntries(PREREQUISITO.voci.map((v) => [v.id, true]));
  const solido = calcolaGreen({ scelte: { ...scelte, E1: true, F2: true }, prerequisito: pre });
  assert.equal(solido.totale, 32); assert.equal(solido.solido, true); assert.equal(solido.avvisi.length, 0);

  // con la registrazione EMAS il minimo è 20
  const emas = calcolaGreen({ scelte: { A1: '100', B4: '100', C2: 'ristoranti', F3: true, F2: true, E1: true }, emas: true }); // 21
  assert.equal(emas.minimo, 20); assert.equal(emas.raggiunto, true);

  // il minimo raggiunto solo con punti a giudizio va segnalato
  const incerto = calcolaGreen({ scelte: { A1: '100', A2: '100', B4: '100', C2: 'ristoranti', F2: true, F3: true, D3: 3, E2: 2 } }); // 21 + 5 a giudizio
  assert.equal(incerto.totale, 26); assert.equal(incerto.sicuri, 21); assert.equal(incerto.incerti, 5);
  assert.match(incerto.avvisi[0].testo, /a sua discrezione/);
});

test('suggerimenti: prima i criteri dal punteggio certo e più alto', () => {
  const s = suggerimentiGreen({ scelte: { A1: '100' } }, 4);
  assert.equal(s.length, 4);
  assert.ok(s.every((x) => x.certo && x.id !== 'A1'));
  assert.ok(s[0].guadagno >= s[3].guadagno && s[0].guadagno === 4);
});

test('scadenze: richiesta 15 giorni prima delle riprese, documenti entro un mese dalla fine', () => {
  const s = scadenzeGreen('2027-03-01', '2027-04-05');
  assert.deepEqual(s.map((x) => [x.id, x.data]), [['richiesta', '2027-02-14'], ['prerequisito', '2027-03-01'], ['documenti', '2027-05-05']]);
  assert.deepEqual(scadenzeGreen('', ''), []);
});

test('richiesta Green Film: riconosce l’edizione precedente e lo dice; l’Edizione 03 non dà avvisi', () => {
  const vecchia = leggiRichiestaGreen('GREEN FILM DOMANDA DI ABILITAZIONE ALL’USO DEL MARCHIO DI CERTIFICAZIONE ... che l’Organismo di Verifica che si intende incaricare per il processo di verifica dell’Opera Audiovisiva è: VERIFICHE ESEMPIO SPA  allega la scheda di scelta dei Criteri. È necessario totalizzare almeno 20 punti. B1 Mezzi Euro 5 1 E1 Raccolta differenziata 4');
  assert.equal(vecchia.edizione, 'precedente'); assert.equal(vecchia.minimoDichiarato, 20);
  assert.equal(vecchia.organismo, 'VERIFICHE ESEMPIO SPA');
  assert.match(vecchia.avviso, /almeno 25 punti/);
  const nuova = leggiRichiestaGreen('Green Film Edizione 03 – 2024 … punteggio non inferiore a venticinque (25) punti … Sezione F Sostenibilità sociale');
  assert.equal(nuova.edizione, '03-2024'); assert.equal(nuova.avviso, null);
  assert.equal(leggiRichiestaGreen('Contratto di distribuzione').edizione, null);
  assert.equal(EDIZIONE_PRECEDENTE.minimo, 20);
  assert.equal(Object.values(EDIZIONE_PRECEDENTE.criteri).reduce((a, b) => a + b, 0), EDIZIONE_PRECEDENTE.totale);
});

test('scheda in CSV: tutti i criteri, prerequisito, scelte in chiaro', () => {
  const csv = csvGreen({ scelte: { A1: '75', G1: ['video', 'formazione'], D3: 2, B1: true }, prerequisito: { manager: true } }, 'Film di prova');
  const righe = csv.split('\r\n');
  assert.ok(csv.startsWith('﻿'));
  assert.match(righe[0], /Film di prova/);
  assert.equal(righe.filter((r) => /^"[A-G]\d"/.test(r)).length, 24);
  assert.match(csv, /"A1";"Energia elettrica dalla rete di distribuzione";"almeno il 75% delle giornate";"3";"4"/);
  assert.match(csv, /"D3";[^\r]*"previsti 2";"2";"3"/);
  assert.match(csv, /Nomina e curriculum[^\r]*";"fatto"/);
});

test('bando Sicilia: obblighi a pena di revoca, compresa la certificazione ambientale a rendiconto', () => {
  const o = BANDO_SICILIA.obblighi;
  assert.equal(o.length, 17);
  assert.equal(new Set(o.map((x) => x.id)).size, 17);
  assert.equal(o.find((x) => x.id === 'green').quando, 'rendiconto');
  assert.ok(o.every((x) => ['sempre', 'riprese', 'postproduzione', 'rendiconto', 'uscita'].includes(x.quando) && x.testo.length > 30));
  // lo schema li conserva e scarta quelli malformati
  const s = sanificaBando({ ...BANDO_SICILIA, obblighi: [...o, { id: 'x', testo: '' }, { testo: 'Obbligo senza fase', quando: 'boh' }] });
  assert.equal(s.obblighi.length, 18);
  assert.equal(s.obblighi.at(-1).quando, 'sempre');
  // nessun dato del caso reale negli atti riportati
  const testo = JSON.stringify([BANDO_SICILIA.obblighi, BANDO_SICILIA.scadenzeNote]);
  assert.ok(!/cinemaset|insabbiat|167\.508|05798610878/i.test(testo));
});

test('verifica formale: le regole Green Film entrano solo dove il bando le chiede; i documenti si riconoscono dal nome', () => {
  const dati = { giorni: {}, professionisti: {}, economici: {}, pianoFinanziario: [] };
  const film = promptVerifica({ bando: BANDO_SICILIA, categoriaId: 'film', anno: 2026, documenti: [], tutti: [], dati });
  assert.match(film.system, /Certificazione ambientale \(requisito di ammissibilità/);
  assert.match(film.system, /almeno pari al minimo \(25 con il disciplinare Edizione 03/);
  const doc = promptVerifica({ bando: BANDO_SICILIA, categoriaId: 'documentario', anno: 2026, documenti: [], tutti: [], dati });
  assert.ok(!/Certificazione ambientale \(requisito/.test(doc.system));
  const anim = promptVerifica({ bando: BANDO_SICILIA, categoriaId: 'film', anno: 2026, documenti: [], tutti: [], dati: { ...dati, animazione: true } });
  assert.ok(!/Certificazione ambientale \(requisito/.test(anim.system));
  for (const nome of ['RICHIESTA GREEN FILM - OPERA.pdf', 'Domanda abilitazione all’uso del marchio.pdf', 'Scheda di scelta dei criteri.pdf', 'Piano di sostenibilità.pdf']) assert.equal(riconosciTipo(nome), 'green_film', nome);
});
