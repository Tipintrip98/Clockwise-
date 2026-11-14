// Confronto dello stesso progetto su più bandi: bandi d'invenzione dalle regole diverse (percentuali, massimali,
// metriche in giorni, euro, numero e percentuale, soglie, finestre aperte, future, chiuse) più il bando Sicilia reale.
// Tutti i dati di progetto sono d'invenzione.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BANDO_SICILIA } from '../app/js/core/bando-sicilia.js';
import { preparaBando, FAMIGLIE } from '../app/js/core/bandi/schema.js';
import { componiRisultato, datiVuoti } from '../app/js/core/scoring.js';
import { valutazioniPerCriterio } from '../app/js/core/engine.js';
import {
  confrontaBandi, duplicaPerBando, categoriaAdatta, statoFinestra, contributoOttenibile, massimalePer,
  spesaMinimaTerritorio, profiloGriglia, frazioniDallaValutazione, tipiProgetto, AREE, NOMI_FAMIGLIA,
} from '../app/js/core/confronto.js';

const OGGI = '2026-11-14';
const qual = (id, nome, max, famiglia) => ({ id, nome, max, tipo: 'qualitativo', famiglia, descrizione: nome });
const fasce = (id, nome, max, famiglia, metrica, lista, extra = {}) => ({ id, nome, max, tipo: 'fasce', famiglia, metrica, peso: 1, fasce: lista, ...extra });

/* --- quattro bandi d'invenzione ------------------------------------------------------------------ */

// 1. Aperto oggi. Metriche in giorni, euro e numero; massimale più basso della percentuale; spesa minima sul costo.
const NORDOVIA = preparaBando({
  id: 'nordovia-2026', nome: 'Fondo Nordovia per l’audiovisivo 2026', nomeBreve: 'Nordovia 2026', regione: 'Nordovia', territorio: 'Nordovia',
  ente: 'Regione d’invenzione Nordovia', stato: 'aperto', tipoValutazione: 'punteggio', revisione: '2026-10-01',
  sogliaTotale: 60, punteggioMassimo: 100, spesaTerritorioMinSuCostoPct: 20,
  finestre: [{ anno: 2026, dal: '2026-10-01', al: '2026-12-15' }],
  categorie: [
    { id: 'lungometraggio', nome: 'Lungometraggi di finzione', griglia: 'G', durataMin: 75, soglie: { Q: 24, T: 15 }, contributo: { percentuale: 50, massimali: { 2026: 200000, 2027: 220000 } } },
    { id: 'documentario', nome: 'Documentari', griglia: 'G', durataMin: 45, soglie: { Q: 24 }, contributo: { percentuale: 60, massimali: { 2026: 80000 } } },
    { id: 'corto', nome: 'Cortometraggi', griglia: 'G', durataMaxEsclusa: 30, soglie: {}, contributo: { percentuale: 70, massimali: { 2026: 20000 } } },
  ],
  griglie: { G: { nome: 'Griglia unica', sezioni: [
    { id: 'Q', nome: 'Qualità artistica', max: 40, criteri: [qual('q1', 'Sceneggiatura', 25, 'scrittura'), qual('q2', 'Progetto di regia', 15, 'visione')] },
    { id: 'T', nome: 'Territorio', max: 35, criteri: [
      fasce('t1', 'Giorni di riprese in Nordovia', 15, 'ricaduta_spesa', 'giorniRipreseTerritorio', [{ da: 30, punti: 15, etichetta: '30 giorni o più' }, { da: 15, punti: 10, etichetta: 'Da 15 a 29 giorni' }, { da: 5, punti: 5, etichetta: 'Da 5 a 14 giorni' }, { da: 0, punti: 0, etichetta: 'Meno di 5 giorni' }]),
      fasce('t2', 'Spesa in Nordovia', 12, 'ricaduta_spesa', 'spesaTerritorioEuro', [{ oltre: 300000, punti: 12, etichetta: 'Oltre 300.000 €' }, { da: 150000, punti: 8, etichetta: 'Da 150.000 €' }, { da: 50000, punti: 4, etichetta: 'Da 50.000 €' }, { da: 0, punti: 0, etichetta: 'Sotto 50.000 €' }]),
      fasce('t3', 'Professionisti di Nordovia', 8, 'ricaduta_lavoro', 'professionistiTerritorio', [{ da: 20, punti: 8, etichetta: '20 o più' }, { da: 10, punti: 5, etichetta: 'Da 10 a 19' }, { da: 1, punti: 2, etichetta: 'Da 1 a 9' }, { da: 0, punti: 0, etichetta: 'Nessuno' }]),
    ] },
    { id: 'S', nome: 'Solidità', max: 25, criteri: [
      qual('s1', 'Piano finanziario', 15, 'piano_finanziario'),
      { id: 's2', nome: 'Distribuzione', max: 10, tipo: 'discreto', famiglia: 'distribuzione', valori: [{ punti: 10, etichetta: 'Contratto' }, { punti: 5, etichetta: 'Deal memo' }, { punti: 0, etichetta: 'Nessun accordo' }] },
    ] },
  ] } },
  note: ['Nota d’invenzione: una sola istanza per impresa.'],
  affidabilita: { griglia: 'testo_ufficiale' },
});

// 2. Finestra futura. Metriche in percentuale; spesa minima sul contributo; famiglie che la Sicilia non valuta.
const VALMAREA = preparaBando({
  id: 'valmarea-2027', nome: 'Bando Valmarea Cinema 2027', nomeBreve: 'Valmarea 2027', regione: 'Valmarea', territorio: 'Valmarea',
  stato: 'atteso', tipoValutazione: 'punteggio', revisione: '2026-10-01',
  sogliaTotale: 70, punteggioMassimo: 100, spesaTerritorioMinPct: 120,
  finestre: [{ anno: 2027, dal: '2027-01-10', al: '2027-02-28' }],
  categorie: [{ id: 'opere', nome: 'Opere audiovisive', griglia: 'U', soglie: { 2: 20 }, contributo: { percentuale: 40, massimali: { 2027: 100000 } } }],
  griglie: { U: { nome: 'Griglia', sezioni: [
    { id: '1', nome: 'Progetto', max: 30, criteri: [qual('a1', 'Scrittura', 20, 'scrittura'), qual('a2', 'Racconto del territorio', 10, 'territorio_contenuto')] },
    { id: '2', nome: 'Impatto', max: 40, criteri: [
      fasce('b1', 'Riprese in Valmarea', 15, 'ricaduta_spesa', 'ripreseTerritorioPct', [{ oltre: 80, punti: 15, etichetta: 'Oltre l’80%' }, { da: 50, punti: 10, etichetta: 'Dal 50%' }, { da: 0, punti: 3, etichetta: 'Sotto il 50%' }]),
      fasce('b2', 'Spesa in Valmarea sul costo', 15, 'ricaduta_spesa', 'spesaTerritorioSuCosto', [{ oltre: 60, punti: 15, etichetta: 'Oltre il 60%' }, { da: 40, punti: 10, etichetta: 'Dal 40%' }, { da: 20, punti: 5, etichetta: 'Dal 20%' }, { da: 0, punti: 0, etichetta: 'Sotto il 20%' }]),
      fasce('b3', 'Spesa in Valmarea sul contributo', 10, 'ricaduta_spesa', 'spesaSicilia', [{ oltre: 200, punti: 10, etichetta: 'Oltre il 200%' }, { da: 120, punti: 6, etichetta: 'Dal 120%' }, { da: 0, punti: 0, etichetta: 'Sotto il 120%' }]),
    ] },
    { id: '3', nome: 'Valori', max: 30, criteri: [
      qual('c1', 'Sostenibilità e parità', 12, 'sostenibilita'), qual('c2', 'Giovani autori', 8, 'formazione'),
      fasce('c3', 'Copertura finanziaria', 10, 'piano_finanziario', 'copertura', [{ oltre: 70, punti: 10, etichetta: 'Oltre il 70%' }, { da: 40, punti: 6, etichetta: 'Dal 40%' }, { da: 0, punti: 0, etichetta: 'Sotto il 40%' }], { giudizio: true }),
    ] },
  ] } },
  affidabilita: { griglia: 'testo_ufficiale' },
});

// 3. Finestra chiusa con edizione successiva attesa. Scala a 50 punti, due linee senza limiti di durata (ambiguo).
const ALTACOSTA = preparaBando({
  id: 'altacosta', nome: 'Fondo Altacosta', nomeBreve: 'Altacosta', regione: 'Altacosta', territorio: 'Altacosta',
  stato: 'chiuso', tipoValutazione: 'punteggio', revisione: '2026-10-01', sogliaTotale: 30, punteggioMassimo: 50,
  finestre: [{ anno: 2026, dal: '2026-03-01', al: '2026-04-30' }],
  prossimaEdizione: { anno: 2027, periodoAtteso: 'primavera', base: 'cadenza annuale' },
  categorie: [
    { id: 'linea-a', nome: 'Linea A', griglia: 'L', soglie: {}, contributo: { percentuale: 25, massimali: { 2026: 500000 } } },
    { id: 'linea-b', nome: 'Linea B', griglia: 'L', soglie: {}, contributo: { percentuale: 20, massimali: { 2026: 300000 } } },
  ],
  griglie: { L: { nome: 'Griglia', sezioni: [
    { id: 'X', nome: 'Soggetti', max: 30, criteri: [qual('x1', 'Società', 10, 'societa'), qual('x2', 'Cast artistico', 12, 'artistica'), qual('x3', 'Troupe', 8, 'tecnica')] },
    { id: 'Y', nome: 'Ricadute', max: 20, criteri: [
      { ...fasce('y1', 'Professionisti di Altacosta', 10, 'ricaduta_lavoro', 'professionistiSiciliani', [{ oltre: 50, punti: 5, etichetta: 'Oltre il 50%' }, { da: 25, punti: 3, etichetta: 'Dal 25%' }, { da: 0, punti: 1, etichetta: 'Sotto il 25%' }]), peso: 2 },
      { id: 'y2', nome: 'Coproduzione estera', max: 10, tipo: 'discreto', famiglia: 'internazionale', valori: [{ punti: 10, etichetta: 'Presente' }, { punti: 0, etichetta: 'Assente' }] },
    ] },
  ] } },
  affidabilita: { griglia: 'testo_ufficiale' },
});

// 4. Chiuso, senza edizioni attese, solo criteri a giudizio, durata minima che il progetto non rispetta.
const PIETRAFONDA = preparaBando({
  id: 'pietrafonda-2025', nome: 'Bando Pietrafonda 2025', nomeBreve: 'Pietrafonda 2025', regione: 'Pietrafonda', territorio: 'Pietrafonda',
  stato: 'chiuso', tipoValutazione: 'punteggio', revisione: '2025-06-01', sogliaTotale: 0, punteggioMassimo: 100,
  finestre: [{ anno: 2025, dal: '2025-05-01', al: '2025-06-30' }],
  categorie: [{ id: 'film', nome: 'Film lungometraggio', griglia: 'P', durataMin: 120, soglie: {}, contributo: { percentuale: 80, massimali: { 2025: 30000 } } }],
  griglie: { P: { nome: 'Griglia', sezioni: [{ id: 'U', nome: 'Qualità', max: 100, criteri: [qual('u1', 'Sceneggiatura', 60, 'scrittura'), qual('u2', 'Regia', 40, 'visione')] }] } },
  affidabilita: { griglia: 'testo_ufficiale' },
});

const SPORTELLO = preparaBando({ id: 'fondo-sportello', nome: 'Fondo a sportello d’invenzione', tipoValutazione: 'sportello', stato: 'aperto', revisione: '2026-01-01' });
const TUTTI = [BANDO_SICILIA, NORDOVIA, VALMAREA, ALTACOSTA, PIETRAFONDA];

/* --- progetto d'invenzione ----------------------------------------------------------------------- */

function progetto(extra = {}, dati = {}) {
  return {
    id: 'p-prova', nome: 'La casa sul molo', bandoId: BANDO_SICILIA.id, categoriaId: 'film', anno: 2027, creato: '2026-01-01T00:00:00.000Z',
    documenti: [{ id: 'd1', nome: 'sceneggiatura.pdf', tipo: 'sceneggiatura', testo: 'INT. CASA — GIORNO' }],
    valutazione: null, punteggioPrimo: 88, reale: { A: 20 },
    dati: {
      ...datiVuoti(), titolo: 'La casa sul molo', tipologiaOpera: 'Film di produzione cinematografica', durataMin: 100,
      giorni: { prepTot: 30, prepSicilia: 24, ripreseTot: 28, ripreseSicilia: 28, postTot: 60, postSicilia: 20 },
      professionisti: { artTot: 10, artSicilia: 6, crewTot: 20, crewSicilia: 15 },
      economici: { costoProduzione: 470000, costoAmmissibile: 460000, contributoRichiesto: 120000, spesaSicilia: 270000, producerFee: 30000 },
      piano: [
        { voce: '1.1', etichetta: 'Contributo richiesto', denominazione: '', importo: 120000, documento: 'nessuno' },
        { voce: '2.1', etichetta: 'Apporto societario', denominazione: '', importo: 150000, documento: 'referenze' },
        { voce: '2.2', etichetta: 'Coproduttore', denominazione: 'Società d’invenzione', importo: 200000, documento: 'contratto' },
      ],
      requisiti: { ateco: true, quota: true },
      ...dati,
    },
    ...extra,
  };
}

// Valutazione d'invenzione sul bando Sicilia: un solo commissario, frazioni diverse per famiglia.
const VALUTAZIONE = {
  data: '2026-11-01T10:00:00.000Z', commissari: [{ id: 'unico', nome: 'Commissario' }],
  giudizi: {
    A: [{ commissario: { id: 'unico', nome: 'Commissario' }, criteri: [{ id: '1.1', punteggio: 5.6 }, { id: '1.2', punteggio: 9.6 }, { id: '2.1', punteggio: 3 }] }],
    B: [{ commissario: { id: 'unico', nome: 'Commissario' }, criteri: [{ id: '3.1', punteggio: 6 }, { id: '3.2', punteggio: 5 }, { id: '3.3', punteggio: 3 }] }],
    D: [{ commissario: { id: 'unico', nome: 'Commissario' }, criteri: [{ id: '5.1', valore: 85 }, { id: '5.2', punteggio: 5 }, { id: '5.3', punteggio: 2 }] }],
  },
};
const riga = (r, id) => r.righe.find((x) => x.bandoId === id);

/* --- contributo, massimali, spesa minima --------------------------------------------------------- */

test('contributo ottenibile: il minore tra percentuale × costo e massimale dell’anno', () => {
  const film = BANDO_SICILIA.categorie.find((c) => c.id === 'film');
  const c = contributoOttenibile(film, 470000, 2027);
  assert.equal(c.ottenibile, 141000);
  assert.equal(c.quotaSulCosto, 30);
  assert.equal(c.limitatoDa, 'percentuale');
  assert.match(c.spiegazione, /30% del costo di produzione/);
  // sopra 3,33 milioni di costo vale il massimale: 1.000.000 € nel 2027, 750.000 € nel 2025
  assert.equal(contributoOttenibile(film, 5000000, 2027).ottenibile, 1000000);
  assert.equal(contributoOttenibile(film, 5000000, 2027).limitatoDa, 'massimale');
  assert.equal(contributoOttenibile(film, 5000000, 2027).quotaSulCosto, 20);
  assert.equal(contributoOttenibile(film, 5000000, 2025).ottenibile, 750000);
  // percentuali e massimali diversi per categoria
  const lungo = NORDOVIA.categorie[0];
  assert.equal(contributoOttenibile(lungo, 470000, 2026).ottenibile, 200000, '50% farebbe 235.000 €: vale il massimale');
  assert.equal(contributoOttenibile(lungo, 300000, 2026).ottenibile, 150000);
  assert.equal(contributoOttenibile(lungo, 470000, 2027).ottenibile, 220000, 'massimale dell’anno successivo');
});

test('contributo ottenibile: casi limite (costo mancante, nessun massimale, anno non indicato)', () => {
  const lungo = NORDOVIA.categorie[0];
  const senzaCosto = contributoOttenibile(lungo, null, 2026);
  assert.equal(senzaCosto.ottenibile, null);
  assert.equal(senzaCosto.massimale, 200000);
  assert.match(senzaCosto.spiegazione, /indica il costo/);
  assert.equal(contributoOttenibile(lungo, 0, 2026).ottenibile, null, 'costo zero = costo non indicato');
  const libero = contributoOttenibile({ contributo: { percentuale: 40, massimali: {} } }, 100000, 2026);
  assert.equal(libero.ottenibile, 40000);
  assert.equal(libero.massimale, null);
  assert.equal(contributoOttenibile({ contributo: { percentuale: 0, massimali: { 2026: 5000 } } }, 100000, 2026).ottenibile, null, 'senza percentuale non si inventa un importo');
  // anno non indicato tra i massimali: l'ultimo noto prima, dichiarato come non esatto
  assert.deepEqual(massimalePer(lungo, 2028), { valore: 220000, anno: 2027, esatto: false });
  assert.deepEqual(massimalePer(lungo, 2025), { valore: 200000, anno: 2026, esatto: false });
  assert.deepEqual(massimalePer(lungo, 2026), { valore: 200000, anno: 2026, esatto: true });
  assert.equal(massimalePer({ contributo: { massimali: { 2026: 0 } } }, 2026), null, 'un massimale a zero non è un massimale');
  assert.equal(massimalePer({}, 2026), null);
});

test('spesa minima sul territorio: sul contributo, sul costo, oppure assente', () => {
  const sic = spesaMinimaTerritorio(BANDO_SICILIA, 470000, 120000, 270000);
  assert.equal(sic.regola, 'sul_contributo');
  assert.equal(sic.euro, 180000);
  assert.equal(sic.coperta, true);
  assert.equal(spesaMinimaTerritorio(BANDO_SICILIA, 470000, 200000, 270000).coperta, false, '150% di 200.000 € = 300.000 €');
  const nord = spesaMinimaTerritorio(NORDOVIA, 470000, 200000, 90000);
  assert.equal(nord.regola, 'sul_costo');
  assert.equal(nord.euro, 94000);
  assert.equal(nord.coperta, false);
  assert.equal(spesaMinimaTerritorio(ALTACOSTA, 470000, 100000, 270000), null, 'il bando non prevede un minimo');
  assert.equal(spesaMinimaTerritorio(BANDO_SICILIA, 470000, 120000, null).coperta, null, 'spesa non indicata: non si dà un verdetto');
  assert.equal(spesaMinimaTerritorio(BANDO_SICILIA, 100000, 80000, 50000).oltreIlCosto, true, '150% di 80.000 € supera il costo di 100.000 €');
});

/* --- stato e finestra ---------------------------------------------------------------------------- */

test('stato e finestra: aperta, futura, attesa, chiusa, con i giorni che mancano', () => {
  const aperta = statoFinestra(NORDOVIA, OGGI);
  assert.equal(aperta.condizione, 'aperta');
  assert.equal(aperta.giorni, 31, 'dal 14 novembre al 15 dicembre');
  assert.match(aperta.testo, /chiude tra 31 giorni/);
  assert.equal(statoFinestra(NORDOVIA, '2026-12-15').giorni, 0);
  assert.match(statoFinestra(NORDOVIA, '2026-12-15').testo, /chiude oggi/);
  assert.match(statoFinestra(NORDOVIA, '2026-12-14').testo, /chiude domani/);
  assert.equal(statoFinestra(NORDOVIA, '2026-12-16').condizione, 'chiusa');
  assert.equal(statoFinestra(NORDOVIA, '2026-09-30').condizione, 'futura');
  assert.equal(statoFinestra(NORDOVIA, '2026-09-30').giorni, 1);
  const futura = statoFinestra(VALMAREA, OGGI);
  assert.equal(futura.condizione, 'futura');
  assert.equal(futura.giorni, 57);
  const attesa = statoFinestra(ALTACOSTA, OGGI);
  assert.equal(attesa.condizione, 'attesa');
  assert.equal(attesa.prossima.anno, 2027);
  assert.equal(attesa.giorni, 198, 'giorni passati dalla chiusura del 30 aprile');
  assert.match(attesa.testo, /prossima edizione attesa nel 2027 \(primavera\)/);
  const chiusa = statoFinestra(PIETRAFONDA, OGGI);
  assert.equal(chiusa.condizione, 'chiusa');
  assert.match(chiusa.testo, /Chiuso da \d+ giorni/);
  // bando Sicilia reale: il 14 novembre 2026 la finestra 2026 è chiusa e si guarda alla 2027
  const sicilia = statoFinestra(BANDO_SICILIA, OGGI);
  assert.deepEqual([sicilia.condizione, sicilia.anno, sicilia.giorni], ['futura', 2027, 79]);
  assert.deepEqual([statoFinestra(BANDO_SICILIA, '2027-03-01').condizione, statoFinestra(BANDO_SICILIA, '2027-03-01').giorni], ['aperta', 14]);
});

test('stato e finestra: bandi senza date o con finestre incomplete non fanno cadere il confronto', () => {
  assert.equal(statoFinestra({ stato: 'aperto', finestre: [] }, OGGI).condizione, 'aperta');
  assert.equal(statoFinestra({ stato: 'aperto', finestre: [] }, OGGI).giorni, null);
  assert.equal(statoFinestra({ stato: 'atteso' }, OGGI).condizione, 'attesa');
  assert.equal(statoFinestra({ stato: 'sospeso' }, OGGI).condizione, 'chiusa');
  assert.equal(statoFinestra({}, OGGI).condizione, 'sconosciuta');
  assert.equal(statoFinestra(null, OGGI).condizione, 'sconosciuta');
  // come può uscire dalla lettura automatica di un PDF: solo l'anno, oppure una data scritta male
  assert.equal(statoFinestra({ finestre: [{ anno: 2026 }, { anno: 2027, al: 'marzo' }] }, OGGI).condizione, 'sconosciuta');
  const senzaApertura = statoFinestra({ finestre: [{ anno: 2026, al: '2026-12-01' }] }, OGGI);
  assert.deepEqual([senzaApertura.condizione, senzaApertura.giorni], ['aperta', 17]);
});

/* --- categoria più adatta ------------------------------------------------------------------------ */

test('categoria più adatta: tipologia dell’opera e limiti di durata', () => {
  const p = progetto();
  // sul bando del dossier vale la categoria scelta
  assert.deepEqual([categoriaAdatta(p, BANDO_SICILIA).id, categoriaAdatta(p, BANDO_SICILIA).scelta], ['film', 'dossier']);
  // film di 100 minuti: lungometraggi (non documentari, che pure ammetterebbero la durata)
  const nord = categoriaAdatta(p, NORDOVIA, TUTTI);
  assert.equal(nord.id, 'lungometraggio');
  assert.equal(nord.ambigua, false);
  assert.equal(nord.compatibile, true);
  assert.match(nord.motivo, /almeno 75 minuti/);
  // documentario
  const doc = progetto({ bandoId: 'altro' }, { tipologiaOpera: 'Documentario', durataMin: 60 });
  assert.equal(categoriaAdatta(doc, NORDOVIA).id, 'documentario');
  assert.equal(categoriaAdatta(doc, BANDO_SICILIA).id, 'documentario');
  // serie documentaria: la categoria dei documentari batte «Film e Serie TV»
  assert.equal(categoriaAdatta(progetto({ bandoId: 'altro' }, { tipologiaOpera: 'Serie TV documentaria', durataMin: 240 }), BANDO_SICILIA).id, 'documentario');
  // cortometraggio di 15 minuti
  const corto = progetto({ bandoId: 'altro' }, { tipologiaOpera: 'Cortometraggio', durataMin: 15 });
  assert.equal(categoriaAdatta(corto, NORDOVIA).id, 'corto');
  assert.equal(categoriaAdatta(corto, BANDO_SICILIA).id, 'cortometraggio');
  // la durata è un vincolo: 51 minuti in Sicilia non è un film (minimo 52), 52 non è più un cortometraggio
  assert.equal(categoriaAdatta(progetto({ bandoId: 'altro' }, { tipologiaOpera: '', durataMin: 30 }), BANDO_SICILIA).id, 'cortometraggio', 'unica categoria che ammette 30 minuti');
  assert.equal(categoriaAdatta(progetto({ bandoId: 'altro' }, { tipologiaOpera: 'Film', durataMin: 52 }), BANDO_SICILIA).id, 'film');
});

test('categoria più adatta: ambiguità dichiarata, incompatibilità, dati mancanti', () => {
  const p = progetto();
  // due linee senza limiti né tipologia: la prima compatibile, e lo si dice
  const alta = categoriaAdatta(p, ALTACOSTA, TUTTI);
  assert.equal(alta.id, 'linea-a');
  assert.equal(alta.ambigua, true);
  assert.deepEqual(alta.alternative.map((a) => a.id), ['linea-b']);
  assert.match(alta.motivo, /2 categorie sono compatibili allo stesso modo/);
  // nessuna categoria ammette la durata
  const pietra = categoriaAdatta(p, PIETRAFONDA, TUTTI);
  assert.equal(pietra.compatibile, false);
  assert.match(pietra.motivo, /Nessuna categoria di questo bando ammette un’opera di 100 minuti/);
  // senza tipologia: 100 minuti stanno sia tra i film sia tra i documentari della Sicilia → ambiguo, prima compatibile
  const senzaTipo = categoriaAdatta(progetto({ bandoId: 'altro' }, { tipologiaOpera: '' }), BANDO_SICILIA);
  assert.deepEqual([senzaTipo.id, senzaTipo.ambigua], ['film', true]);
  // senza tipologia ma con la categoria scelta nel dossier (bando di partenza a catalogo) si usa quella
  const daDoc = progetto({ bandoId: NORDOVIA.id, categoriaId: 'documentario' }, { tipologiaOpera: '' });
  assert.deepEqual(tipiProgetto(daDoc, TUTTI), ['documentario']);
  assert.equal(categoriaAdatta(daDoc, BANDO_SICILIA, TUTTI).id, 'documentario');
  // senza durata: i limiti non si possono verificare e lo si dice
  const senzaDurata = categoriaAdatta(progetto({ bandoId: 'altro' }, { durataMin: null }), NORDOVIA);
  assert.equal(senzaDurata.id, 'lungometraggio');
  assert.match(senzaDurata.motivo, /i limiti di durata non sono stati verificati/);
  // categoria del dossier fuori durata: resta quella scelta, ma segnalata
  const fuori = categoriaAdatta(progetto({ categoriaId: 'cortometraggio' }), BANDO_SICILIA);
  assert.deepEqual([fuori.id, fuori.compatibile], ['cortometraggio', false]);
  assert.equal(categoriaAdatta(p, { categorie: [], griglie: {} }), null);
});

/* --- profilo del bando --------------------------------------------------------------------------- */

test('profilo del bando: peso di ogni famiglia, aree, numeri contro giudizio', () => {
  for (const b of TUTTI) for (const g of Object.values(b.griglie)) {
    const pr = profiloGriglia(g);
    assert.equal(pr.massimo, b.punteggioMassimo, `${b.id}: il profilo copre tutto il punteggio`);
    assert.ok(Math.abs(pr.famiglie.reduce((a, f) => a + f.punti, 0) - pr.massimo) < 1e-9);
    assert.ok(Math.abs(pr.aree.reduce((a, f) => a + f.punti, 0) - pr.massimo) < 1e-9, 'ogni famiglia sta in un’area');
    assert.ok(Math.abs(pr.famiglie.reduce((a, f) => a + f.quota, 0) - 100) < 0.5);
    assert.equal(pr.numeri.punti + pr.giudizio.punti, pr.massimo);
    assert.deepEqual(pr.aree.map((a) => a.id), AREE.map((a) => a.id), 'le aree sono sempre nello stesso ordine');
  }
  // Sicilia, tabella A: 30 punti dai numeri (4.1-4.5), 70 dal giudizio (di cui 5 a punteggi fissi)
  const a = profiloGriglia(BANDO_SICILIA.griglie.A);
  assert.deepEqual([a.numeri.punti, a.giudizio.punti, a.fissi.punti], [30, 70, 5]);
  assert.deepEqual(a.famiglie.slice(0, 3).map((f) => [f.id, f.quota]), [['ricaduta_spesa', 20], ['scrittura', 19], ['piano_finanziario', 16]]);
  assert.deepEqual(a.aree.map((x) => x.quota), [25, 20, 30, 25, 0]);
  // Sicilia, tabella B: i documentari pesano di più sulla scrittura
  const b = profiloGriglia(BANDO_SICILIA.griglie.B);
  assert.equal(b.famiglie.find((f) => f.id === 'scrittura').quota, 21);
  assert.equal(b.numeri.punti, 30);
  // scala a 50 punti: le quote restano percentuali del massimo
  const l = profiloGriglia(ALTACOSTA.griglie.L);
  assert.equal(l.famiglie.find((f) => f.id === 'artistica').quota, 24);
  assert.deepEqual([l.numeri.quota, l.giudizio.quota, l.fissi.quota], [20, 80, 20]);
  // solo giudizio
  assert.equal(profiloGriglia(PIETRAFONDA.griglie.P).numeri.punti, 0);
  // ogni famiglia del vocabolario ha un nome breve e sta in una sola area
  for (const f of Object.keys(FAMIGLIE)) {
    assert.ok(NOMI_FAMIGLIA[f], `nome breve per ${f}`);
    assert.equal(AREE.filter((x) => x.famiglie.includes(f)).length, 1, `${f} in una sola area`);
  }
  // famiglia sconosciuta o assente (bandi letti da PDF): finisce in «altro», non si perde
  const strano = profiloGriglia({ sezioni: [{ id: 'A', max: 10, criteri: [{ id: '1', max: 6, tipo: 'qualitativo', famiglia: 'inventata' }, { id: '2', max: 4, tipo: 'qualitativo' }] }] });
  assert.deepEqual(strano.famiglie, [{ id: 'altro', nome: 'Altri criteri', descrizione: 'altro', punti: 10, quota: 100 }]);
});

/* --- confronto completo -------------------------------------------------------------------------- */

test('confronto: ordinamento (aperti, poi in apertura, attesi, chiusi; incompatibili in fondo)', () => {
  const r = confrontaBandi(progetto(), [...TUTTI, SPORTELLO], OGGI);
  assert.deepEqual(r.righe.map((x) => x.bandoId), ['nordovia-2026', 'sicilia-2025-2027', 'valmarea-2027', 'altacosta', 'pietrafonda-2025']);
  assert.deepEqual(r.righe.map((x) => x.finestra.condizione), ['aperta', 'futura', 'futura', 'attesa', 'chiusa']);
  assert.deepEqual(r.righe.map((x) => x.posizione), [1, 2, 3, 4, 5]);
  // tra i due bandi in apertura decide il contributo ottenibile, non la data
  assert.ok(riga(r, 'sicilia-2025-2027').contributo.ottenibile > riga(r, 'valmarea-2027').contributo.ottenibile);
  assert.ok(riga(r, 'sicilia-2025-2027').finestra.giorni > riga(r, 'valmarea-2027').finestra.giorni);
  // i fondi senza griglia a punti non entrano nel confronto
  assert.deepEqual(r.esclusi.map((e) => e.id), ['fondo-sportello']);
  assert.equal(r.oggi, OGGI);
  assert.equal(r.bandoDiPartenza.id, BANDO_SICILIA.id);
  assert.equal(r.ipotesi.length, 3);
  assert.match(r.ipotesi[0], /stesse quote di giorni/);
  // un'altra data cambia lo stato e quindi l'ordine: a febbraio 2027 Sicilia e Valmarea sono aperti, Nordovia è chiuso
  const feb = confrontaBandi(progetto(), TUTTI, '2027-02-10');
  assert.deepEqual(feb.righe.map((x) => x.bandoId), ['sicilia-2025-2027', 'valmarea-2027', 'altacosta', 'nordovia-2026', 'pietrafonda-2025']);
  assert.equal(riga(feb, 'nordovia-2026').finestra.condizione, 'chiusa');
  // accetta anche un oggetto Date
  assert.equal(confrontaBandi(progetto(), TUTTI, new Date('2026-11-14T09:00:00Z')).oggi, OGGI);
});

test('confronto: contributo, anno di riferimento e spesa minima per ciascun bando', () => {
  const r = confrontaBandi(progetto(), TUTTI, OGGI);
  const nord = riga(r, 'nordovia-2026');
  assert.deepEqual([nord.anno, nord.contributo.ottenibile, nord.contributo.limitatoDa, nord.contributo.quotaSulCosto], [2026, 200000, 'massimale', 42.6]);
  assert.deepEqual([nord.spesaMinima.regola, nord.spesaMinima.euro, nord.spesaMinima.coperta], ['sul_costo', 94000, true]);
  const sic = riga(r, 'sicilia-2025-2027');
  assert.deepEqual([sic.anno, sic.contributo.ottenibile, sic.contributo.massimale, sic.contributo.regola], [2027, 141000, 1000000, 'proporzionale_al_primo']);
  assert.equal(sic.spesaMinima.euro, 180000, 'per il bando del dossier: 150% dei 120.000 € richiesti');
  const val = riga(r, 'valmarea-2027');
  assert.deepEqual([val.anno, val.contributo.ottenibile, val.contributo.limitatoDa], [2027, 100000, 'massimale']);
  assert.equal(val.spesaMinima.euro, 120000, 'per gli altri bandi: 120% del contributo massimo ottenibile');
  // edizione attesa nel 2027 senza massimale per quell'anno: si usa il 2026 e lo si segnala
  const alta = riga(r, 'altacosta');
  assert.deepEqual([alta.anno, alta.contributo.ottenibile, alta.contributo.annoMassimale, alta.contributo.massimaleEsatto], [2027, 117500, 2026, false]);
  assert.ok(alta.avvertenze.some((a) => /massimale del 2027 non è indicato/.test(a)));
  assert.ok(alta.avvertenze.some((a) => /Categoria scelta in automatico/.test(a)));
  assert.equal(alta.spesaMinima, null);
  assert.equal(riga(r, 'pietrafonda-2025').contributo.ottenibile, 30000);
});

test('confronto: punti dai numeri con metriche in giorni, euro, numero e percentuale', () => {
  const r = confrontaBandi(progetto(), TUTTI, OGGI);
  // Nordovia: 28 giorni di riprese → 10; 270.000 € di spesa → 8; 21 professionisti → 8
  const nord = riga(r, 'nordovia-2026').numeri;
  assert.deepEqual(nord.criteri.map((c) => [c.id, c.punti, c.massimo]), [['t1', 10, 15], ['t2', 8, 12], ['t3', 8, 8]]);
  assert.deepEqual([nord.punti, nord.massimo, nord.quota, nord.calcolati], [26, 35, 74.3, 3]);
  assert.deepEqual(nord.principali.map((c) => c.id), ['t1', 't2', 't3'], 'i criteri che pesano di più, dal più pesante');
  assert.equal(nord.criteri[0].valoreTesto, '28 giorni');
  assert.match(nord.criteri[1].valoreTesto, /270\.000/);
  // Valmarea: riprese 100% → 15; spesa sul costo 57,4% → 10; spesa sul contributo ipotizzato (100.000 €) 270% → 10
  const val = riga(r, 'valmarea-2027');
  assert.deepEqual(val.numeri.criteri.map((c) => c.punti), [15, 10, 10]);
  assert.deepEqual([val.numeri.punti, val.numeri.massimo], [35, 40]);
  assert.deepEqual(val.ipotesi, { contributoRichiesto: 100000, origine: 'massimo' });
  assert.ok(!val.numeri.criteri.some((c) => c.id === 'c3'), 'un criterio a fasce con giudizio non è «dai numeri»');
  // Altacosta: 21 professionisti locali su 30 = 70% → 5 × peso 2 = 10
  assert.deepEqual([riga(r, 'altacosta').numeri.punti, riga(r, 'altacosta').numeri.massimo], [10, 10]);
  // Pietrafonda: nessun criterio calcolabile
  assert.deepEqual([riga(r, 'pietrafonda-2025').numeri.massimo, riga(r, 'pietrafonda-2025').numeri.criteri.length], [0, 0]);
  assert.equal(riga(r, 'pietrafonda-2025').soglie.dalGiudizio, null, 'nessuna soglia complessiva');
});

test('confronto sul bando Sicilia reale: i punti dai numeri coincidono con il motore di calcolo', () => {
  const p = progetto();
  const sic = riga(confrontaBandi(p, TUTTI, OGGI), 'sicilia-2025-2027');
  const ris = componiRisultato(BANDO_SICILIA, 'film', p.dati, {});
  assert.equal(sic.proprio, true);
  assert.equal(sic.numeri.punti, ris.sezioni.find((s) => s.id === 'C').punti);
  assert.deepEqual(sic.numeri.criteri.map((c) => [c.id, c.punti]), [['4.1', 8], ['4.2', 5], ['4.3', 4], ['4.4', 1.6], ['4.5', 7]]);
  assert.deepEqual([sic.numeri.punti, sic.numeri.min, sic.numeri.massimo, sic.numeri.quota], [25.6, 22.8, 30, 85.3]);
  assert.deepEqual(sic.ipotesi, { contributoRichiesto: 120000, origine: 'dossier' });
  assert.deepEqual(sic.soglie.sezioni.map((s) => [s.id, s.minimo, s.raggiungibile]), [['A', 17, true], ['B', 13, true], ['C', 20, true], ['D', 15, true]]);
  assert.deepEqual(sic.soglie.dalGiudizio, { punti: 39.4, su: 70, quota: 56.3, possibile: true }, 'servono 65 − 25,6 punti dai 70 a giudizio');
  assert.equal(sic.soglie.totale, 65);
  assert.ok(sic.note.length > 0 && sic.note.length <= 4);
  // categoria documentario: tabella B, percentuale 35% e massimale 150.000 €
  const doc = riga(confrontaBandi(progetto({ categoriaId: 'documentario' }, { tipologiaOpera: 'Documentario' }), [BANDO_SICILIA], OGGI), 'sicilia-2025-2027');
  assert.deepEqual([doc.categoria.id, doc.contributo.ottenibile, doc.contributo.limitatoDa], ['documentario', 150000, 'massimale']);
  assert.deepEqual(doc.numeri.criteri.map((c) => c.id), ['4.1', '4.2', '4.3', '4.4']);
});

test('confronto: l’ipotesi sul contributo richiesto cambia i punti quando il progetto arriva da un altro bando', () => {
  // dossier nato su Nordovia con 100.000 € richiesti: sulla Sicilia si ipotizza il massimo ottenibile (141.000 €),
  // quindi la spesa vale il 191% del contributo (7 punti) e non il 270% (9 punti)
  const p = progetto({ bandoId: NORDOVIA.id, categoriaId: 'lungometraggio', anno: 2026 }, { tipologiaOpera: 'Lungometraggio di finzione', economici: { costoProduzione: 470000, contributoRichiesto: 100000, spesaSicilia: 270000 } });
  const r = confrontaBandi(p, TUTTI, OGGI);
  const sic = riga(r, 'sicilia-2025-2027');
  assert.equal(sic.proprio, false);
  assert.deepEqual([sic.categoria.id, sic.categoria.scelta, sic.categoria.ambigua], ['film', 'automatica', false]);
  assert.deepEqual(sic.ipotesi, { contributoRichiesto: 141000, origine: 'massimo' });
  assert.equal(sic.numeri.criteri.find((c) => c.id === '4.5').punti, 7);
  assert.equal(sic.spesaMinima.euro, 211500);
  assert.deepEqual(riga(r, 'nordovia-2026').ipotesi, { contributoRichiesto: 100000, origine: 'dossier' });
  assert.match(r.ipotesi[1], /Nordovia 2026/);
});

test('confronto: soglie irraggiungibili e spesa minima non coperta diventano avvertenze', () => {
  // quasi nulla sul territorio: sezione T di Nordovia (minimo 15, tutta calcolata) e sezione 2 di Valmarea (minimo 20)
  const p = progetto({}, {
    giorni: { prepTot: 30, prepSicilia: 0, ripreseTot: 28, ripreseSicilia: 2, postTot: 60, postSicilia: 0 },
    professionisti: { artTot: 10, artSicilia: 0, crewTot: 20, crewSicilia: 1 },
    economici: { costoProduzione: 470000, contributoRichiesto: 120000, spesaSicilia: 40000 },
  });
  const r = confrontaBandi(p, TUTTI, OGGI);
  const nord = riga(r, 'nordovia-2026');
  assert.deepEqual(nord.numeri.criteri.map((c) => c.punti), [0, 0, 2]);
  assert.deepEqual(nord.soglie.irraggiungibili, ['T']);
  assert.ok(nord.avvertenze.some((a) => /Sezione T: con questi numeri il minimo di 15 non si raggiunge/.test(a)));
  assert.ok(nord.avvertenze.some((a) => /sotto il minimo richiesto \(94\.000/.test(a)));
  const val = riga(r, 'valmarea-2027');
  assert.deepEqual(val.soglie.irraggiungibili, ['2'], '3 + 0 + 0 punti contro un minimo di 20');
  assert.equal(val.spesaMinima.coperta, false);
  // la Sicilia ha il minimo di 20 sulla sezione C, tutta calcolata dai numeri
  const sic = riga(r, 'sicilia-2025-2027');
  assert.deepEqual(sic.soglie.irraggiungibili, ['C']);
  // la soglia complessiva resta possibile finché i punti a giudizio bastano
  assert.equal(nord.soglie.dalGiudizio.possibile, true);
  assert.equal(nord.soglie.dalGiudizio.punti, 58);
  assert.equal(nord.soglie.dalGiudizio.su, 65);
});

test('confronto: dati mancanti e progetto vuoto non fanno cadere nulla e non inventano numeri', () => {
  const vuoto = { id: 'v', nome: 'Vuoto', bandoId: BANDO_SICILIA.id, categoriaId: 'film', anno: 2027, documenti: [], valutazione: null, dati: datiVuoti() };
  const r = confrontaBandi(vuoto, TUTTI, OGGI);
  assert.equal(r.righe.length, 5);
  for (const x of r.righe) {
    assert.equal(x.contributo.ottenibile, null);
    assert.equal(x.numeri.punti, 0);
    assert.equal(x.numeri.calcolati, 0);
    assert.equal(x.stima, null);
    assert.ok(x.perche.length > 10);
    assert.ok(!x.avvertenze.some((a) => /costo di produzione nei Dati chiave/.test(a)), 'ciò che vale per tutti i bandi si dice una volta sola');
    assert.equal(x.soglie.irraggiungibili.length, 0, 'un dato mancante non è un blocco dimostrato');
  }
  assert.equal(r.avvisi.length, 1);
  assert.match(r.avvisi[0], /Manca il costo di produzione/);
  assert.deepEqual(confrontaBandi(progetto(), TUTTI, OGGI).avvisi, []);
  // senza contributo né punti, tra due bandi in apertura viene prima quello che apre prima
  assert.deepEqual(r.righe.map((x) => x.bandoId), ['nordovia-2026', 'valmarea-2027', 'sicilia-2025-2027', 'altacosta', 'pietrafonda-2025']);
  assert.ok(riga(r, 'nordovia-2026').avvertenze.some((a) => /Mancano 3 dati/.test(a)));
  assert.deepEqual(riga(r, 'nordovia-2026').numeri.mancanti, ['t1', 't2', 't3']);
  assert.equal(riga(r, 'pietrafonda-2025').categoria.compatibile, true, 'senza durata non si può dire che sia fuori dai limiti');
  // ingressi degeneri
  assert.deepEqual(confrontaBandi(progetto(), [], OGGI).righe, []);
  assert.deepEqual(confrontaBandi(progetto(), null, OGGI).righe, []);
  assert.deepEqual(confrontaBandi(null, TUTTI, OGGI).righe, []);
  assert.equal(confrontaBandi({ id: 'x' }, TUTTI, OGGI).righe.length, 5, 'dossier senza dati');
  assert.equal(confrontaBandi(progetto(), [SPORTELLO], OGGI).righe.length, 0);
  assert.equal(confrontaBandi(progetto(), [BANDO_SICILIA], OGGI).righe.length, 1, 'un solo bando a catalogo');
  // bando letto da PDF e non verificato: entra nel confronto con l'avvertenza
  const personale = { ...NORDOVIA, id: 'personale', verificato: false, finestre: [{ anno: 2026 }], prossimaEdizione: undefined, stato: undefined };
  const rp = riga(confrontaBandi(progetto(), [personale], OGGI), 'personale');
  assert.equal(rp.daVerificare, true);
  assert.equal(rp.finestra.condizione, 'sconosciuta');
  assert.ok(rp.avvertenze.some((a) => /non ancora verificata/.test(a)));
});

test('confronto: ogni bando ha un «perché» leggibile', () => {
  const r = confrontaBandi(progetto(), TUTTI, OGGI);
  const nord = riga(r, 'nordovia-2026').perche;
  assert.match(nord, /^Aperto: chiude tra 31 giorni\./);
  assert.match(nord, /Fino a 200\.000\s€, il 42,6% del costo: il contributo più alto del confronto/);
  assert.match(nord, /Dai numeri 26 punti su 35 calcolabili/);
  assert.match(nord, /Premia soprattutto progetto artistico \(40%\) e ricadute sul territorio \(35%\)\.$/);
  assert.match(riga(r, 'altacosta').perche, /la resa migliore del confronto/, '10 punti su 10');
  assert.match(riga(r, 'sicilia-2025-2027').perche, /^Apre tra 79 giorni\. Fino a 141\.000\s€, il 30% del costo\./);
  assert.match(riga(r, 'pietrafonda-2025').perche, /Nessuna categoria di questo bando ammette/);
  // con un solo bando non ci sono primati da dichiarare
  assert.doesNotMatch(confrontaBandi(progetto(), [BANDO_SICILIA], OGGI).righe[0].perche, /più alto|migliore/);
});

/* --- stima indicativa dalla valutazione ---------------------------------------------------------- */

test('stima indicativa: stessa frazione del massimo per famiglia, riportata sul profilo dell’altro bando', () => {
  const p = progetto({ valutazione: VALUTAZIONE });
  const base = frazioniDallaValutazione(p, TUTTI);
  assert.equal(base.risultato.totale, 79.2);
  const fr = (f) => Math.round(base.famiglie.get(f).frazione * 1000) / 1000;
  assert.deepEqual(['scrittura', 'territorio_contenuto', 'societa', 'artistica', 'tecnica', 'piano_finanziario', 'distribuzione', 'internazionale', 'ricaduta_spesa', 'ricaduta_lavoro'].map(fr),
    [0.8, 0.5, 1, 0.5, 0.75, 0.9, 1, 0.5, 0.83, 0.9]);
  assert.equal(Math.round(base.media * 10000) / 10000, 0.7657, 'media dei soli criteri giudicati: 53,6 su 70');

  const r = confrontaBandi(p, TUTTI, OGGI);
  assert.equal(r.progetto.haValutazione, true);
  // sul bando del dossier non è una riproiezione: è il punteggio della valutazione
  const sic = riga(r, 'sicilia-2025-2027').stima;
  assert.deepEqual([sic.reale, sic.indicativa, sic.totale, sic.completa], [true, false, 79.2, true]);
  assert.deepEqual(sic.totale, componiRisultato(BANDO_SICILIA, 'film', p.dati, valutazioniPerCriterio(VALUTAZIONE)).totale);
  // Nordovia: scrittura 25×0,8 = 20; regia (famiglia che la Sicilia non valuta) 15×0,7657 = 11,5; numeri 26;
  // piano finanziario 15×0,9 = 13,5; distribuzione 10×1 = 10 → 81,0
  const nord = riga(r, 'nordovia-2026').stima;
  assert.deepEqual([nord.indicativa, nord.reale, nord.totale, nord.massimo, nord.sogliaTotale, nord.sopraSoglia], [true, false, 81, 100, 60, true]);
  assert.deepEqual(nord.sezioni.map((s) => [s.id, s.punti, s.sopra]), [['Q', 31.5, true], ['T', 26, true], ['S', 23.5, true]]);
  assert.equal(nord.puntiSenzaRiscontro, 15);
  assert.equal(nord.famiglie.find((f) => f.id === 'visione').origine, 'media');
  assert.deepEqual(nord.famiglie.find((f) => f.id === 'scrittura'), { id: 'scrittura', nome: 'Scrittura', massimo: 25, punti: 20, frazione: 80, origine: 'valutazione' });
  assert.equal(nord.famiglie.find((f) => f.id === 'ricaduta_spesa').origine, 'numeri');
  assert.match(nord.spiegazione, /^Stima indicativa, non una valutazione/);
  assert.match(nord.spiegazione, /15 punti appartengono a famiglie che il bando di partenza non valuta/);
  assert.equal(nord.base.bandoId, BANDO_SICILIA.id);
  // Valmarea: 16 + 5 | 15 + 10 + 10 | sostenibilità 12×0,7657 + giovani 8×0,7657 + copertura 10×0,9 → 80,3
  const val = riga(r, 'valmarea-2027').stima;
  assert.deepEqual(val.sezioni.map((s) => s.punti), [21, 35, 24.3]);
  assert.deepEqual([val.totale, val.puntiSenzaRiscontro, val.sopraSoglia], [80.3, 20, true]);
  // Altacosta, scala a 50: 10 + 6 + 6 | 10 + 5 → 37
  const alta = riga(r, 'altacosta').stima;
  assert.deepEqual([alta.totale, alta.massimo, alta.sogliaTotale, alta.sopraSoglia, alta.puntiSenzaRiscontro], [37, 50, 30, true, 0]);
});

test('stima indicativa: sotto soglia lo dice; senza criteri giudicati non c’è', () => {
  // valutazione severa: 20% su tutto ciò che è a giudizio
  const severa = { giudizi: {
    A: [{ commissario: { id: 'u', nome: 'C' }, criteri: [{ id: '1.1', punteggio: 1.4 }, { id: '1.2', punteggio: 2.4 }, { id: '2.1', punteggio: 1.2 }] }],
    B: [{ commissario: { id: 'u', nome: 'C' }, criteri: [{ id: '3.1', punteggio: 1.2 }, { id: '3.2', punteggio: 2 }, { id: '3.3', punteggio: 0.8 }] }],
    D: [{ commissario: { id: 'u', nome: 'C' }, criteri: [{ id: '5.1', valore: 10 }, { id: '5.2', punteggio: 0 }, { id: '5.3', punteggio: 0 }] }],
  } };
  const r = confrontaBandi(progetto({ valutazione: severa }), TUTTI, OGGI);
  const nord = riga(r, 'nordovia-2026');
  assert.equal(nord.stima.sopraSoglia, false);
  assert.deepEqual(nord.stima.sezioniSotto, ['Q'], 'scrittura 25×0,2 + regia sotto il minimo di 24');
  assert.ok(nord.avvertenze.some((a) => /stima indicativa resta sotto il minimo della sezione Q/.test(a)));
  const alta = riga(r, 'altacosta');
  assert.ok(alta.stima.totale < 30);
  assert.ok(alta.avvertenze.some((a) => /resta sotto la soglia di 30/.test(a)));
  // nessuna valutazione, valutazione vuota, bando di partenza non a catalogo
  assert.equal(frazioniDallaValutazione(progetto(), TUTTI), null);
  assert.equal(frazioniDallaValutazione(progetto({ valutazione: { giudizi: {} } }), TUTTI), null);
  assert.equal(frazioniDallaValutazione(progetto({ valutazione: VALUTAZIONE, bandoId: 'sparito' }), TUTTI), null);
  assert.ok(confrontaBandi(progetto({ valutazione: { giudizi: {} } }), TUTTI, OGGI).righe.every((x) => x.stima === null));
  // valutazione parziale (solo la sezione A): la stima c'è, e sul bando del dossier è dichiarata parziale
  const parziale = { giudizi: { A: VALUTAZIONE.giudizi.A } };
  const rp = confrontaBandi(progetto({ valutazione: parziale }), TUTTI, OGGI);
  assert.deepEqual([riga(rp, 'sicilia-2025-2027').stima.completa, riga(rp, 'sicilia-2025-2027').stima.sopraSoglia], [false, null]);
  assert.equal(riga(rp, 'nordovia-2026').stima.famiglie.find((f) => f.id === 'scrittura').origine, 'valutazione');
  assert.equal(riga(rp, 'nordovia-2026').stima.famiglie.find((f) => f.id === 'distribuzione').origine, 'media');
});

/* --- copia del dossier --------------------------------------------------------------------------- */

test('duplicaPerBando: nuovo dossier per un altro bando, con ciò che vale solo per il vecchio azzerato', () => {
  const p = progetto({ valutazione: VALUTAZIONE, legale: { domande: [{ q: 'x' }], contratti: { esito: 'ok' }, bozze: ['b'], dataDecreto: '2026-08-01' }, produzione: { ottaviGiorno: 32 }, gestione: { tappe: [1] }, aggiornato: '2026-11-01T00:00:00.000Z' });
  const prima = JSON.stringify(p);
  let chiamate = 0;
  const c = duplicaPerBando(p, NORDOVIA, 'lungometraggio', 2026, () => { chiamate++; return 'nuovo-123'; }, '2026-11-14T08:00:00.000Z');
  assert.equal(JSON.stringify(p), prima, 'il dossier di partenza non viene toccato');
  assert.equal(chiamate, 1);
  assert.deepEqual([c.id, c.bandoId, c.categoriaId, c.anno, c.creato], ['nuovo-123', 'nordovia-2026', 'lungometraggio', 2026, '2026-11-14T08:00:00.000Z']);
  assert.equal(c.nome, 'La casa sul molo — Nordovia 2026');
  assert.equal(c.valutazione, null);
  assert.equal(c.punteggioPrimo, null);
  assert.deepEqual(c.reale, {});
  assert.deepEqual(c.dati.requisiti, {});
  assert.equal('aggiornato' in c, false);
  assert.equal('gestione' in c, false);
  assert.equal('esempio' in duplicaPerBando({ ...p, esempio: true }, NORDOVIA, 'lungometraggio', 2026, () => 'n'), false, 'la copia di un esempio è un dossier normale');
  // documenti e dati mantenuti, ma come copie indipendenti
  assert.deepEqual(c.documenti, p.documenti);
  assert.notEqual(c.documenti[0], p.documenti[0]);
  assert.deepEqual({ ...c.dati, requisiti: p.dati.requisiti }, p.dati);
  c.dati.economici.costoProduzione = 1; c.documenti.push({ id: 'd2' });
  assert.equal(p.dati.economici.costoProduzione, 470000);
  assert.equal(p.documenti.length, 1);
  // strumenti legati all'opera restano, quelli legati all'avviso di partenza no
  assert.deepEqual(c.produzione, { ottaviGiorno: 32 });
  assert.deepEqual(c.legale, { domande: [], contratti: { esito: 'ok' }, bozze: ['b'], dataDecreto: '' });
  assert.deepEqual(c.duplicatoDa, { id: 'p-prova', nome: 'La casa sul molo', bandoId: BANDO_SICILIA.id, nomeBase: 'La casa sul molo' });
  // la copia è un dossier valido per il motore di calcolo e per un nuovo confronto
  assert.equal(componiRisultato(NORDOVIA, c.categoriaId, c.dati, {}).sezioni.length, 3);
  assert.equal(riga(confrontaBandi(c, TUTTI, OGGI), 'nordovia-2026').proprio, true);
  // copiare una copia non accoda i nomi dei bandi
  assert.equal(duplicaPerBando({ ...c, dati: p.dati }, VALMAREA, 'opere', 2027, () => 'n2').nome, 'La casa sul molo — Valmarea 2027');
});

test('duplicaPerBando: categoria e anno mancanti o sbagliati, errori chiari', () => {
  const p = progetto();
  const id = () => 'n';
  // categoria inesistente → la più adatta; anno mancante → finestra di riferimento alla data di creazione
  const c = duplicaPerBando(p, NORDOVIA, 'non-esiste', undefined, id, '2026-11-14T08:00:00.000Z');
  assert.deepEqual([c.categoriaId, c.anno], ['lungometraggio', 2026]);
  assert.equal(duplicaPerBando(p, ALTACOSTA, null, null, id, '2026-11-14T08:00:00.000Z').anno, 2027, 'edizione attesa');
  assert.equal(duplicaPerBando(p, ALTACOSTA, 'linea-b', '2026', id).anno, 2026, 'anno passato come testo');
  assert.equal(duplicaPerBando(p, BANDO_SICILIA, 'documentario', 2027, id).categoriaId, 'documentario');
  assert.equal(duplicaPerBando({ id: 'x', nome: 'Senza dati' }, NORDOVIA, 'corto', 2026, id).documenti.length, 0);
  assert.throws(() => duplicaPerBando(p, NORDOVIA, 'lungometraggio', 2026), /identificativo/);
  assert.throws(() => duplicaPerBando(p, SPORTELLO, null, 2026, id), /bando simulabile/);
  assert.throws(() => duplicaPerBando(null, NORDOVIA, null, 2026, id), /dossier/);
});
