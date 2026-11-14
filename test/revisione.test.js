// Difetti trovati nella revisione indipendente di Clockwise 2.0: ogni prova riproduce un caso che prima falliva.
import test from 'node:test';
import assert from 'node:assert/strict';
import { componiRisultato, verificheAmmissibilita, datiVuoti } from '../app/js/core/scoring.js';
import { stimaDaRegole } from '../app/js/core/ragionamento.js';
import { controlliFormato } from '../app/js/core/invio.js';
import { normalizzaBando } from '../app/js/core/prompts.js';
import { sanificaBando, preparaBando } from '../app/js/core/bandi/schema.js';
import { indicatori } from '../app/js/core/finanza.js';
import { punteggioDaMantenere } from '../app/js/core/gestione.js';
import { confrontaBandi } from '../app/js/core/confronto.js';

// Bando d'invenzione: soglia combinata sulle sezioni 1+2, soglia complessiva solo su 1-3 (la 4 è premialità),
// un criterio a fasce a giudizio misurato in giorni, un allegato «punteggio» senza criteri indicati.
const GREZZO = {
  id: 'utopia-fondo-2026', revisione: '2026-11-01', nome: 'Utopia — Fondo cinema 2026', nomeBreve: 'Utopia 2026', regione: 'Utopia', territorio: 'Utopia',
  stato: 'aperto', tipoValutazione: 'punteggio', finestre: [{ anno: 2026, dal: '2026-10-01', al: '2026-12-31' }],
  sogliaTotale: 50, punteggioMassimo: 100, sogliaSuSezioni: ['1', '2', '3'], spesaTerritorioMinSuCostoPct: 25,
  soglieCombinate: [{ etichetta: 'Sezioni 1 + 2 almeno 40', minimo: 40, sezioni: ['1', '2'] }, { etichetta: 'Criterio di un’altra griglia', minimo: 5, criteri: ['zz'] }],
  categorie: [{ id: 'film', nome: 'Film', griglia: 'U', soglie: {}, contributo: { percentuale: 50, massimali: { 2026: 300000 } } }],
  griglie: { U: { id: 'U', nome: 'Unica', sezioni: [
    { id: '1', nome: 'Qualità', max: 40, criteri: [{ id: 'a', nome: 'Scrittura', max: 40, tipo: 'qualitativo', famiglia: 'scrittura', descrizione: 'd' }] },
    { id: '2', nome: 'Territorio', max: 20, criteri: [{ id: 'b', nome: 'Giorni di riprese', max: 20, tipo: 'fasce', giudizio: true, metrica: 'giorniRipreseTerritorio', peso: 1, famiglia: 'ricaduta_spesa', fasce: [{ da: 20, punti: 20, etichetta: '20 o più' }, { da: 0, punti: 0, etichetta: 'meno' }] }] },
    { id: '3', nome: 'Fattibilità', max: 20, criteri: [{ id: 'c', nome: 'Piano', max: 20, tipo: 'qualitativo', famiglia: 'piano_finanziario', descrizione: 'd' }] },
    { id: '4', nome: 'Premialità', max: 20, criteri: [{ id: 'zz', nome: 'Premio', max: 20, tipo: 'qualitativo', famiglia: 'altro', descrizione: 'd' }] },
  ] } },
  allegati: [{ tipo: 'distribuzione', nome: 'Contratti di distribuzione', obbligo: 'punteggio' }, { tipo: 'modulo1', nome: 'Domanda', obbligo: 'sempre', formati: ['pdf'] }],
  affidabilita: { griglia: 'testo_ufficiale' },
};
const B = preparaBando(GREZZO);
const dati = () => ({ ...datiVuoti(), durataMin: 95, giorni: { prepTot: 10, prepSicilia: 5, ripreseTot: 30, ripreseSicilia: 12, postTot: 20, postSicilia: 0 },
  economici: { costoProduzione: 1000000, costoAmmissibile: 900000, contributoRichiesto: 200000, spesaSicilia: 200000, producerFee: 0 } });

test('allegato «punteggio» senza criteri indicati: nessun «undefined» nel testo', () => {
  const c = verificheAmmissibilita(B, 'film', 2026, dati(), []).find((x) => x.id === 'all_distribuzione');
  assert.equal(c.esito, 'attenzione');
  assert.doesNotMatch(c.dettaglio, /undefined/);
});

test('costo di produzione zero: niente «NaN%» e nessun «ok» sul contributo', () => {
  const d = dati(); d.economici.costoProduzione = 0; d.economici.contributoRichiesto = 0;
  const out = verificheAmmissibilita(B, 'film', 2026, d, []);
  assert.ok(out.every((x) => !/NaN|Infinity/.test(x.dettaglio)), JSON.stringify(out));
  assert.equal(out.find((x) => x.id === 'contributo').esito, 'da_verificare');
  assert.equal(out.find((x) => x.id === 'spesa').esito, 'da_verificare');
});

test('criterio a fasce con giudizio misurato in giorni: il valore dei commissari si scrive in giorni, non in %', () => {
  const ris = componiRisultato(B, 'film', dati(), { b: [{ valore: 22 }, { valore: 24 }] });
  const b = ris.sezioni[1].criteri[0];
  assert.equal(b.fonte, 'commissione');
  assert.equal(b.valoreTesto, '23 giorni');
});

test('soglia combinata su un criterio di un’altra griglia: ignorata, non blocca il dossier', () => {
  const ris = componiRisultato(B, 'film', dati(), { a: [{ punteggio: 35 }], b: [{ valore: 25 }], c: [{ punteggio: 15 }], zz: [{ punteggio: 0 }] });
  // il criterio zz esiste in questa griglia: la combinata vale; tolta la griglia del criterio, sparisce
  assert.ok(ris.combinate.some((x) => x.nome === 'Criterio di un’altra griglia'));
  const altro = { ...B, soglieCombinate: [{ etichetta: 'Fantasma', minimo: 5, criteri: ['inesistente'], sezioni: [] }] };
  const r2 = componiRisultato(altro, 'film', dati(), { a: [{ punteggio: 35 }], b: [{ valore: 25 }], c: [{ punteggio: 15 }], zz: [{ punteggio: 10 }] });
  assert.equal(r2.combinate.length, 0);
  assert.equal(r2.esito === 'sotto_soglia', false, r2.motivi.join(' '));
});

test('stima dalle regole: rispetta soglie combinate, soglia su alcune sezioni e penalità', () => {
  const p = { id: 'x', bandoId: B.id, categoriaId: 'film', anno: 2026, dati: dati(), documenti: [{ id: '1', nome: 'sceneggiatura.pdf', tipo: 'sceneggiatura', testo: 'SCENA 1. INT. CASA - GIORNO\n'.repeat(300) }] };
  const s = stimaDaRegole(B, 'film', p);
  const s12 = s.sezioni[0].punti + s.sezioni[1].punti;
  assert.ok(s12 < 40, `sezioni 1+2 stimate: ${s12}`);
  assert.equal(s.esito, 'sotto_soglia');
  assert.ok(s.combinateMancate.includes('Sezioni 1 + 2 almeno 40'));
  // soglia complessiva solo sulle sezioni 1-3
  assert.deepEqual(s.sogliaSuSezioni, ['1', '2', '3']);
  assert.equal(s.totaleSoglia, Math.round((s.sezioni[0].punti + s.sezioni[1].punti + s.sezioni[2].punti) * 10) / 10);
  // penalità confermata: si sottrae al totale come nel motore
  const conPen = { ...B, penalita: [{ id: 'legalita', testo: 'Senza rating', punti: -1 }] };
  const s2 = stimaDaRegole(conPen, 'film', { ...p, dati: { ...p.dati, penalita: { legalita: true } } });
  assert.equal(s2.totale, Math.round((s.totale - 1) * 10) / 10);
});

test('confronto tra bandi: la stima indicativa rispetta le soglie combinate', () => {
  const casa = preparaBando({ ...GREZZO, id: 'casa-2026', nome: 'Casa 2026', soglieCombinate: [], sogliaSuSezioni: [] });
  const p = { id: 'x', bandoId: casa.id, categoriaId: 'film', anno: 2026, dati: dati(), documenti: [],
    valutazione: { giudizi: { 1: [{ commissario: { id: 'u' }, criteri: [{ id: 'a', punteggio: 20 }] }], 3: [{ commissario: { id: 'u' }, criteri: [{ id: 'c', punteggio: 10 }] }], 4: [{ commissario: { id: 'u' }, criteri: [{ id: 'zz', punteggio: 10 }] }] } } };
  const r = confrontaBandi(p, [casa, B], '2026-11-14');
  const riga = r.righe.find((x) => x.bandoId === B.id);
  assert.ok(riga.stima && riga.stima.indicativa);
  assert.equal(riga.stima.sopraSoglia, false);
  assert.ok(riga.stima.combinateMancate.length >= 1);
});

test('formato dei file: il riferimento all’art. 8.1 vale solo per la Sicilia', () => {
  const out = controlliFormato(B, [{ id: '1', nome: 'domanda.docx', tipo: 'modulo1' }]);
  assert.equal(out.length, 1);
  assert.doesNotMatch(out[0].dettaglio, /8\.1/);
});

test('bando letto da Claude: numeri e date passano dalla stessa pulizia dei bandi del catalogo', () => {
  const { bando } = normalizzaBando({ nome: 'Letto', finestre: [{ anno: 2027, dal: '1 marzo', al: null }, { anno: 2026, dal: '2026-01-10', al: '2026-02-28' }],
    allegati: [{ tipo: 'sconosciuto', nome: 'Altro' }], categorie: [{ id: 'u', nome: 'U', griglia: 'G', soglie: { A: 'venti' }, contributo: { percentuale: 50, massimali: { 2027: '300.000' } } }],
    griglie: { G: { sezioni: [{ id: 'A', max: 100, criteri: [{ id: '1', nome: 'Uno', max: 100, tipo: 'qualitativo', famiglia: 'visione' }] }] } } }, 'avviso.pdf');
  assert.deepEqual(bando.finestre, [{ anno: 2026, dal: '2026-01-10', al: '2026-02-28' }]);
  assert.equal(bando.categorie[0].contributo.massimali['2027'], 300000);
  assert.deepEqual(bando.categorie[0].soglie, {});
  assert.equal(bando.allegati[0].tipo, 'altro');
  assert.equal(bando.verificato, false);
  const d = { ...datiVuoti(), durataMin: 90, economici: { costoProduzione: 1000000, contributoRichiesto: 200000 } };
  assert.equal(verificheAmmissibilita(bando, 'u', 2027, d, []).find((x) => x.id === 'contributo').esito, 'ok');
});

test('numeri scritti all’italiana nei dati di un bando', () => {
  const b = sanificaBando({ sogliaTotale: '60', categorie: [{ id: 'a', contributo: { percentuale: '12,5', massimali: { 2026: '1.500.000', 2027: '1.5', 2028: '250000' } } }] });
  assert.equal(b.sogliaTotale, 60);
  assert.equal(b.categorie[0].contributo.percentuale, 12.5);
  assert.deepEqual(b.categorie[0].contributo.massimali, { 2026: 1500000, 2027: 1.5, 2028: 250000 });
});

test('finanza: l’indicatore della spesa sul costo controlla il minimo del bando (es. 25% del costo)', () => {
  const ind = indicatori({ dati: dati(), bando: B }).find((x) => x.id === 'spesa_territorio');
  assert.equal(ind.valore, 20);
  assert.equal(ind.esito, 'critico');
  assert.match(ind.riferimento.etichetta, /25% del costo/);
});

test('punteggio da mantenere: con la soglia su alcune sezioni conta la loro somma, non il totale', () => {
  const bando = preparaBando({ ...GREZZO, soglieCombinate: [], griglie: { U: { ...GREZZO.griglie.U, sezioni: GREZZO.griglie.U.sezioni.map((s) => (s.id === '2' ? { ...s, criteri: [{ ...s.criteri[0], giudizio: false }] } : s)) } } });
  const consuntivo = { ...dati(), giorni: { ...dati().giorni, ripreseSicilia: 5 } };
  const dichiarati = { ...dati(), giorni: { ...dati().giorni, ripreseSicilia: 25 } };
  // 30+20+5 = 55 sulle sezioni 1-3 (+ 20 di premialità = 75): perdendo i 20 punti del criterio b si scende a 35 < 50
  const r = punteggioDaMantenere({ bando, categoriaId: 'film', dati: dichiarati, consuntivo, punteggi: { origine: 'stima', totale: 75, sezioni: { 1: 30, 2: 20, 3: 5, 4: 20 } } });
  assert.equal(r.persi, 20);
  assert.equal(r.totale.prima, 55);
  assert.equal(r.totale.dopo, 35);
  assert.equal(r.totale.sotto, true);
  assert.equal(r.rischio, 'soglie');
});
