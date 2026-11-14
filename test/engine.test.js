import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BANDO_SICILIA as B } from '../app/js/core/bando-sicilia.js';
import { datiVuoti, componiRisultato } from '../app/js/core/scoring.js';
import { eseguiValutazione, valutazioniPerCriterio, pianoValutazione } from '../app/js/core/engine.js';
import { estraiJson } from '../app/js/core/llm.js';
import { normalizzaBando } from '../app/js/core/prompts.js';
import { riconosciTipo } from '../app/js/core/docs.js';

const doc = (nome, tipo, testo) => ({ id: nome, nome, tipo, testo, avvisi: [] });
function progetto() {
  return {
    id: 'p', nome: 'Prova', bandoId: B.id, categoriaId: 'film', anno: 2027,
    dati: { ...datiVuoti(), titolo: 'Prova', durataMin: 100, economici: { costoProduzione: 400000, costoAmmissibile: 400000, contributoRichiesto: 100000, spesaSicilia: 320000, producerFee: 0 }, piano: [{ voce: '1.1', importo: 100000, documento: 'nessuno' }, { voce: '2.2', importo: 300000, documento: 'contratto' }] },
    documenti: [doc('sceneggiatura.pdf', 'sceneggiatura', 'SCENA 1. EST. MARE - ALBA\n'.repeat(50)), doc('cv_societa.pdf', 'cv_societa', 'Curriculum'), doc('distribuzione.pdf', 'distribuzione', 'Deal memo'), doc('modulo1.pdf', 'modulo1', 'Istanza')],
  };
}

// Claude simulato: risponde con i criteri richiesti; registra ogni richiesta.
function llmFinto({ limiteByte = 2_000_000, errorePer = null } = {}) {
  const richieste = [];
  return {
    richieste, tipo: 'finto', etichetta: 'Finto', limiteByte, paralleli: 3, cacheCondivisa: true,
    async chiama(p) {
      richieste.push(p);
      if (!p.schema) return { testo: `Scheda di lettura sintetica (${p.documenti.length} caratteri letti).`, modello: 'finto' };
      if (errorePer && p.compito.includes(errorePer)) throw Object.assign(new Error('Errore simulato'), { codice: 'upstream_error' });
      const ids = (/Valuta i criteri ([\d., ]+) della sezione/.exec(p.compito)?.[1] || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!ids.length) return { json: { controlli: [{ titolo: 'Firma mancante', esito: 'critico', dettaglio: 'd', azione: 'a' }], sintesi: 's' }, modello: 'finto', uso: { ingresso: 10, uscita: 5 } };
      const base = p.compito.includes('Esperta di sceneggiatura') ? 5 : p.compito.includes('Esperto di produzione') ? 6 : 7;
      return { json: { criteri: ids.map((id) => ({ id, punteggio: id === '5.2' ? 2.4 : base, valore: id === '5.1' ? 75 : null, motivazione: 'm', evidenze: ['e'], criticita: [], miglioramenti: [{ azione: 'x', punti: 1 }] })), sintesi: 's' }, modello: 'finto', uso: { ingresso: 100, uscita: 20 } };
    },
  };
}

test('valutazione completa: tre commissari, media e verifica formale', async () => {
  const p = progetto(), llm = llmFinto();
  assert.equal(pianoValutazione(B, p, 3).passi.length, 10);
  const val = await eseguiValutazione({ bando: B, progetto: p, llm, opzioni: { commissari: 3, modello: 'm', impegno: 'high' } });
  assert.equal(val.errori.length, 0);
  assert.equal(val.uso.chiamate, 10);
  assert.equal(val.verifica.controlli[0].esito, 'critico');
  const ris = componiRisultato(B, 'film', p.dati, valutazioniPerCriterio(val));
  const cr = (id) => ris.sezioni.flatMap((s) => s.criteri).find((c) => c.id === id);
  assert.equal(cr('1.1').punti, 6, 'media di 5, 6 e 7');
  assert.equal(cr('1.1').min, 5);
  assert.equal(cr('5.1').punti, 12.8, 'copertura riconosciuta 75% → fascia 71-80');
  assert.equal(cr('5.2').punti, 2, '2,4 riportato al valore ammesso più vicino');
  assert.equal(cr('5.3').punti, 4, 'limitato al massimo');
  // i documenti sono il prefisso identico per tutti i commissari della stessa sezione (cache)
  const sezA = llm.richieste.filter((r) => r.compito.includes('della sezione A'));
  assert.equal(sezA.length, 3);
  assert.equal(new Set(sezA.map((r) => r.system + r.documenti)).size, 1);
  assert.equal(new Set(sezA.map((r) => r.compito)).size, 3);
  assert.ok(!sezA[0].documenti.includes('Curriculum'), 'la sezione A non riceve i curriculum');
});

test('una lettura fallita non blocca le altre e si può riprovare', async () => {
  const p = progetto();
  const val = await eseguiValutazione({ bando: B, progetto: p, llm: llmFinto({ errorePer: 'Esperto di produzione' }), opzioni: { commissari: 3, modello: 'm', impegno: 'high' } });
  assert.equal(val.errori.length, 3);
  assert.equal(val.giudizi.A.length, 2);
  const llm2 = llmFinto();
  const val2 = await eseguiValutazione({ bando: B, progetto: p, llm: llm2, opzioni: { commissari: 3, modello: 'm', impegno: 'high' }, precedente: val });
  assert.equal(val2.errori.length, 0);
  assert.equal(val2.giudizi.A.length, 3);
  assert.equal(llm2.richieste.length, 3, 'rifatte solo le tre letture mancanti');
});

test('documenti oltre il limite: scheda di lettura, testo integrale conservato', async () => {
  const p = progetto();
  p.documenti[0].testo = 'INT. CASA - NOTTE. Dialogo lungo.\n'.repeat(3000); // ~100k caratteri
  const llm = llmFinto({ limiteByte: 60000 });
  const note = [];
  const val = await eseguiValutazione({ bando: B, progetto: p, llm, opzioni: { commissari: 1, modello: 'm', impegno: 'high' }, onEvento: (e) => { if (e.nota) note.push(e.nota); } });
  assert.equal(val.errori.length, 0);
  assert.equal(note.length, 1);
  assert.ok(p.documenti[0].scheda.includes('Scheda di lettura'));
  assert.equal(p.documenti[0].condensato, undefined);
  const sezA = llm.richieste.find((r) => r.schema && r.compito.includes('della sezione A'));
  assert.ok(sezA.documenti.includes('SCHEDA DI LETTURA') && sezA.documenti.length < 60000);
  // con un collegamento senza limiti torna il testo integrale
  const grande = llmFinto();
  await eseguiValutazione({ bando: B, progetto: p, llm: grande, opzioni: { commissari: 1, modello: 'm', impegno: 'high' } });
  assert.ok(grande.richieste.find((r) => r.compito.includes('della sezione A')).documenti.length > 90000);
});

test('sezioni senza documenti restano da valutare', async () => {
  const p = progetto();
  p.documenti = p.documenti.filter((d) => d.tipo === 'sceneggiatura');
  const val = await eseguiValutazione({ bando: B, progetto: p, llm: llmFinto(), opzioni: { commissari: 1, modello: 'm', impegno: 'high' } });
  assert.deepEqual(Object.keys(val.giudizi), ['A']);
  assert.equal(val.note.length, 2);
  assert.equal(componiRisultato(B, 'film', p.dati, valutazioniPerCriterio(val)).esito, 'parziale');
});

test('lettura tollerante del JSON e riconoscimento dei file', () => {
  assert.deepEqual(estraiJson('{"a":1}'), { a: 1 });
  assert.deepEqual(estraiJson('Ecco:\n```json\n{"a":[1,2]}\n```\nfine'), { a: [1, 2] });
  assert.deepEqual(estraiJson('Risposta: {"a":{"b":2}} ok'), { a: { b: 2 } });
  assert.equal(estraiJson('nessun json'), undefined);
  const casi = { 'Modulo-III-Dati-di-produzione-2025-2027_REV (1).xls': 'modulo3', 'Modulo-II-Scheda-di-produzione-2025-2027-1.doc': 'modulo2', 'Modulo-I-Istanza-2025-2027-1.xls': 'modulo1', 'CV regista Rossi.pdf': 'cv_regista', 'Sceneggiatura_definitiva.pdf': 'sceneggiatura', 'deal memo distribuzione 01.pdf': 'distribuzione', 'Lettera di intenti DOP.pdf': 'accordi_cast', 'carta identità legale rappresentante.pdf': 'identita', 'Contratto Green Film.pdf': 'green_film', 'referenze bancarie.pdf': 'referenze_bancarie' };
  for (const [nome, tipo] of Object.entries(casi)) assert.equal(riconosciTipo(nome), tipo, nome);
});

test('griglia di un nuovo bando: normalizzazione e segnalazioni', () => {
  const { bando, avvisi } = normalizzaBando({
    nome: 'Bando di prova', regione: 'Prova', sogliaTotale: 60,
    categorie: [{ id: 'Film', nome: 'Film', griglia: 'U', soglie: { A: 10 }, contributo: { percentuale: 40, massimali: { 2027: 200000 } } }],
    griglie: { U: { nome: 'Unica', sezioni: [
      { id: 'A', nome: 'Qualità', max: 60, criteri: [{ id: '1', nome: 'Qualità', max: 50, tipo: 'qualitativo', descrizione: 'd' }] },
      { id: 'B', nome: 'Territorio', max: 40, criteri: [{ id: '2', nome: 'Spesa', max: 40, tipo: 'fasce', metrica: 'spesaSicilia', peso: 4, fasce: [{ oltre: 200, punti: 10, etichetta: 'oltre 200%' }, { da: 0, punti: 0, etichetta: 'altro' }] }, { id: '3', nome: 'Altro', max: 0, tipo: 'fasce', metrica: 'inesistente', fasce: [] }] },
    ] } },
  }, 'bando.pdf');
  assert.equal(bando.verificato, false);
  assert.equal(bando.categorie[0].id, 'film');
  assert.equal(bando.griglie.U.sezioni[1].criteri[1].tipo, 'qualitativo');
  assert.ok(avvisi.some((a) => a.includes('Sezione A')), 'somma dei criteri diversa dal massimo di sezione');
  const ris = componiRisultato(bando, 'film', { ...datiVuoti(), economici: { contributoRichiesto: 100, spesaSicilia: 250 } }, {});
  assert.equal(ris.sezioni[1].criteri[0].punti, 40);
  assert.throws(() => normalizzaBando({ nome: 'x' }, 'x.pdf'));
});
