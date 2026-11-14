// Catalogo dei bandi: stato con la data che conta, simulabilità, gruppi, ricerca, filtri, anni e categorie.
// Tutti i bandi qui sotto sono d'invenzione (regioni e fondi che non esistono), tranne dove si usa la Sicilia del programma.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dataEstesa, dataCorta, giorniTra, normalizza, statoBando, etichettaValutazione, aPunti, simulabilita, areaBando, raggruppaPerRegione,
  cercaBandi, filtraBandi, contaFiltri, riepilogoCatalogo, collegati, opzioniAnno, annoConsigliato, valoreAnno, schedaCategoria,
  calendarioEdizioni, nomeDossierProposto, FILTRI, NOTA_PREVISTA,
} from '../app/js/core/bandi/catalogo.js';
import { preparaBando } from '../app/js/core/bandi/schema.js';
import { catalogo, BANDI_PREDEFINITI } from '../app/js/core/bandi/indice.js';

const OGGI = '2026-11-14';

// Una griglia minima ma valida: due sezioni da 60 e 40 punti.
const GRIGLIA = {
  A: { nome: 'Griglia unica', sezioni: [
    { id: 'A', nome: 'Qualità del progetto', max: 60, criteri: [
      { id: 'A1', nome: 'Sceneggiatura', max: 40, tipo: 'qualitativo', famiglia: 'scrittura', descrizione: 'Originalità e solidità.' },
      { id: 'A2', nome: 'Regia', max: 20, tipo: 'qualitativo', famiglia: 'visione', descrizione: 'Impianto visivo.' },
    ] },
    { id: 'B', nome: 'Ricadute sul territorio', max: 40, criteri: [
      { id: 'B1', nome: 'Giorni di riprese nel territorio', max: 40, tipo: 'fasce', metrica: 'ripreseTerritorioPct', peso: 1, fasce: [{ oltre: 80, punti: 40, etichetta: 'oltre l’80%' }, { da: 50, punti: 20, etichetta: 'dal 50%' }, { da: 0, punti: 0, etichetta: 'meno' }] },
    ] },
  ] },
};
const base = (extra) => ({
  id: 'prova', nome: 'Fondo di prova', nomeBreve: 'Prova', ente: 'Ente di prova', regione: 'Arcadia', stato: 'aperto', tipoValutazione: 'punteggio',
  sogliaTotale: 60, punteggioMassimo: 100, griglie: GRIGLIA,
  categorie: [
    { id: 'lungo', nome: 'Lungometraggi', griglia: 'A', soglie: { A: 30, B: 10 }, contributo: { percentuale: 40, massimali: { 2026: 200000, 2027: 250000 }, nota: 'Elevabile per le opere prime.' }, dotazione: { 2026: 1000000 }, durataMin: 75 },
    { id: 'corto', nome: 'Cortometraggi', griglia: 'A', soglie: {}, contributo: { percentuale: 50, massimali: {} }, dotazione: {}, durataMaxEsclusa: 30 },
  ],
  affidabilita: { griglia: 'testo_ufficiale', citazioni: [{ riferimento: 'art. 9', testo: 'Fino a 100 punti.' }], dubbi: [] },
  verifica: { esito: 'confermata', data: '2026-10-01' },
  ...extra,
});
const bando = (extra) => preparaBando(base(extra));
const scheda = (extra) => preparaBando({ id: 'scheda', nome: 'Fondo senza griglia', regione: 'Arcadia', stato: 'aperto', tipoValutazione: 'sportello', ...extra });

/* ------------------------------------------------------------------ date */

test('date: forma estesa, corta e differenza in giorni', () => {
  assert.equal(dataEstesa('2026-03-16'), '16 marzo 2026');
  assert.equal(dataEstesa('2027-02-01'), '1 febbraio 2027');
  assert.equal(dataCorta('2026-03-16'), '16 mar');
  assert.equal(dataCorta('2026-12-05', true), '5 dic 2026');
  assert.equal(giorniTra('2026-11-14', '2026-11-14'), 0);
  assert.equal(giorniTra('2026-11-14', '2026-12-01'), 17);
  assert.equal(giorniTra('2026-03-01', '2026-02-27'), -2);
  assert.equal(giorniTra('2024-02-28', '2024-03-01'), 2, 'anno bisestile');
});

test('date: i valori non validi non fanno danni', () => {
  for (const v of [null, undefined, '', '16/03/2026', '2026-3-16', 20260316, '2026-13-01']) {
    assert.equal(dataEstesa(v), '');
    assert.equal(dataCorta(v), '');
  }
  assert.equal(giorniTra(null, '2026-01-01'), null);
  assert.equal(giorniTra('2026-01-01', 'domani'), null);
});

test('normalizza: accenti, maiuscole e punteggiatura non contano', () => {
  assert.equal(normalizza('  Città d’Arcadia — Fondo CINEMA! '), 'citta d arcadia fondo cinema');
  assert.equal(normalizza(null), '');
  assert.equal(normalizza(2027), '2027');
});

/* ------------------------------------------------------------------ stato */

test('stato: finestra aperta → «scade il…», con i giorni che mancano', () => {
  const s = statoBando(bando({ finestre: [{ anno: 2026, dal: '2026-10-01', al: '2026-12-15' }] }), OGGI);
  assert.equal(s.codice, 'aperto');
  assert.equal(s.etichetta, 'Aperto');
  assert.equal(s.quando, 'scade il 15 dicembre 2026');
  assert.equal(s.testo, 'Aperto · scade il 15 dicembre 2026');
  assert.equal(s.giorni, 31);
  assert.equal(s.anno, 2026);
  assert.equal(s.urgente, false);
});

test('stato: scadenza vicina, oggi e domani', () => {
  const con = (al) => statoBando(bando({ finestre: [{ anno: 2026, dal: '2026-10-01', al }] }), OGGI);
  assert.equal(con('2026-11-28').urgente, true, 'a 14 giorni è urgente');
  assert.equal(con('2026-11-29').urgente, false, 'a 15 giorni no');
  assert.equal(con('2026-11-14').quando, 'scade oggi');
  assert.equal(con('2026-11-14').codice, 'aperto', 'il giorno della scadenza il bando è ancora aperto');
  assert.equal(con('2026-11-15').quando, 'scade domani');
  assert.equal(con('2026-11-13').codice, 'chiuso', 'il giorno dopo è chiuso');
});

test('stato: finestra senza data di apertura = aperta fino alla scadenza', () => {
  const s = statoBando(bando({ finestre: [{ anno: 2026, al: '2026-12-31' }] }), OGGI);
  assert.equal(s.codice, 'aperto');
});

test('stato: prossima finestra → «apre il…» anche se il campo stato dice «aperto»', () => {
  const s = statoBando(BANDI_PREDEFINITI[0], OGGI); // Sicilia: finestra 2026 chiusa a marzo, la 2027 apre a febbraio
  assert.equal(s.codice, 'in_arrivo');
  assert.equal(s.quando, 'apre il 1 febbraio 2027');
  assert.equal(s.anno, 2027);
  assert.equal(s.giorni, 79);
});

test('stato: finestre tutte chiuse → atteso con l’edizione successiva, altrimenti chiuso con la data', () => {
  const finestre = [{ anno: 2025, dal: '2025-01-10', al: '2025-02-28' }, { anno: 2026, dal: '2026-01-10', al: '2026-02-28' }];
  const atteso = statoBando(bando({ finestre, prossimaEdizione: { anno: 2027, periodoAtteso: 'gennaio-febbraio 2027', base: 'cadenza annuale' } }), OGGI);
  assert.equal(atteso.codice, 'atteso');
  assert.equal(atteso.quando, 'edizione 2027 attesa: gennaio-febbraio 2027');
  assert.equal(atteso.anno, 2027);
  const senzaPeriodo = statoBando(bando({ finestre, prossimaEdizione: { anno: 2027 } }), OGGI);
  assert.equal(senzaPeriodo.quando, 'edizione 2027 attesa');
  const chiuso = statoBando(bando({ finestre, stato: 'aperto' }), OGGI);
  assert.equal(chiuso.codice, 'chiuso', 'le date valgono più del campo stato');
  assert.equal(chiuso.quando, 'scaduto il 28 febbraio 2026');
});

test('stato: senza finestre decide il campo stato', () => {
  assert.equal(statoBando(scheda({ stato: 'aperto', tipoValutazione: 'sportello' }), OGGI).testo, 'Aperto · a sportello, senza scadenza fissa');
  assert.equal(statoBando(scheda({ stato: 'aperto', tipoValutazione: 'automatico' }), OGGI).quando, 'scadenza da verificare sulla pagina ufficiale');
  assert.equal(statoBando(scheda({ stato: 'atteso' }), OGGI).testo, 'Atteso · nuova edizione non ancora annunciata');
  assert.equal(statoBando(scheda({ stato: 'chiuso' }), OGGI).testo, 'Chiuso');
});

test('stato: sospeso e non attivo non dipendono dal calendario', () => {
  const aperta = [{ anno: 2026, dal: '2026-10-01', al: '2026-12-15' }];
  assert.equal(statoBando(bando({ stato: 'sospeso', finestre: aperta }), OGGI).codice, 'sospeso');
  assert.equal(statoBando(scheda({ stato: 'non_trovato', finestre: aperta }), OGGI).codice, 'non_attivo');
  assert.equal(statoBando(scheda({ stato: 'aperto', tipoValutazione: 'nessuna' }), OGGI).etichetta, 'Non attivo');
  assert.equal(statoBando(scheda({ stato: 'sospeso', prossimaEdizione: { anno: 2028, periodoAtteso: 'da definire' } }), OGGI).testo, 'Sospeso · edizione 2028 attesa: da definire');
});

test('stato: un bando vuoto o assente non lancia', () => {
  for (const v of [null, undefined, {}]) {
    const s = statoBando(v, OGGI);
    assert.equal(s.codice, 'chiuso');
    assert.equal(s.testo, 'Chiuso');
  }
});

/* ------------------------------------------------------------------ valutazione e simulabilità */

test('tipo di valutazione: etichette brevi', () => {
  assert.equal(etichettaValutazione(bando()), 'Griglia a punti');
  assert.equal(etichettaValutazione(scheda({ tipoValutazione: 'automatico' })), 'Automatico');
  assert.equal(etichettaValutazione(scheda({ tipoValutazione: 'sportello' })), 'A sportello');
  assert.equal(etichettaValutazione({ griglie: GRIGLIA, categorie: [{ id: 'x' }] }), 'Griglia a punti', 'bando aggiunto da PDF senza tipo');
  assert.equal(etichettaValutazione({}), 'Valutazione non indicata');
  assert.equal(aPunti(bando({ tipoValutazione: 'misto' })), true);
  assert.equal(aPunti(scheda({ tipoValutazione: 'automatico' })), false);
  assert.equal(aPunti({ griglie: GRIGLIA, categorie: [{ id: 'x' }] }), true);
  assert.equal(aPunti({}), false);
});

test('simulabilità: bando con griglia provata', () => {
  const s = simulabilita(bando());
  assert.equal(s.simulabile, true);
  assert.equal(s.etichetta, 'Simulabile');
  assert.equal(s.tono, 'ok');
  assert.deepEqual(s.alternative, []);
});

test('simulabilità: griglia letta da PDF e non ancora verificata resta simulabile, ma lo dice', () => {
  const s = simulabilita({ ...bando(), predefinito: false, verificato: false });
  assert.equal(s.simulabile, true);
  assert.equal(s.tono, 'warn');
  assert.match(s.etichetta, /da verificare/);
  assert.ok(s.spiegazione.length > 20);
});

test('simulabilità: ogni scheda non simulabile spiega il perché', () => {
  const casi = [
    [scheda({ tipoValutazione: 'automatico' }), 'Contributo automatico', false],
    [scheda({ tipoValutazione: 'sportello' }), 'Bando a sportello', false],
    [scheda({ tipoValutazione: 'nessuna', stato: 'non_trovato' }), 'Nessun bando attivo', false],
    [scheda({ tipoValutazione: 'punteggio' }), 'Griglia non disponibile', true],
    [{ ...bando({ affidabilita: { griglia: 'fonte_secondaria' } }), simulabile: false }, 'Griglia non ancora verificata', true],
    [{ ...bando({ verifica: { esito: 'dubbia' } }), simulabile: false }, 'Griglia non ancora verificata', true],
  ];
  for (const [b, motivo, daPdf] of casi) {
    const s = simulabilita({ ...b, simulabile: false });
    assert.equal(s.simulabile, false, motivo);
    assert.equal(s.motivo, motivo);
    assert.ok(s.spiegazione.length > 40, `${motivo}: spiegazione`);
    assert.equal(s.alternative.some((a) => a.tipo === 'pdf'), daPdf, `${motivo}: proposta «da PDF»`);
  }
  assert.match(simulabilita({ ...bando({ affidabilita: { griglia: 'fonte_secondaria' } }), simulabile: false }).spiegazione, /fonte secondaria/);
});

test('simulabilità: le alternative portano pagina ufficiale e altri bandi dello stesso ente', () => {
  const s = simulabilita({ ...scheda({ tipoValutazione: 'automatico', paginaUfficiale: 'https://fondo.example/bando', altriBandi: [{ nome: 'Sviluppo', url: 'https://fondo.example/sviluppo', descrizione: 'per la scrittura' }, { nome: 'Senza indirizzo' }] }), simulabile: false });
  assert.deepEqual(s.alternative.map((a) => a.tipo), ['pagina', 'altro', 'altro']);
  assert.equal(s.alternative[0].url, 'https://fondo.example/bando');
  assert.match(s.alternative[1].testo, /Sviluppo — per la scrittura/);
  assert.equal('url' in s.alternative[2], false);
  assert.deepEqual(simulabilita({ ...scheda({ tipoValutazione: 'automatico' }), simulabile: false }).alternative, [], 'nessuna pagina, nessuna alternativa inventata');
});

test('simulabilità: un oggetto vuoto è una scheda senza griglia', () => {
  const s = simulabilita(null);
  assert.equal(s.simulabile, false);
  assert.equal(s.motivo, 'Griglia non disponibile');
});

/* ------------------------------------------------------------------ gruppi */

const VOCI = [
  { id: 'eu', nome: 'Fondo europeo', regione: 'Europa', ente: 'Agenzia europea di prova', simulabile: false, tipoValutazione: 'punteggio', stato: 'chiuso' },
  { id: 'it', nome: 'Fondo nazionale', regione: 'Italia', ente: 'Ministero di prova', simulabile: false, tipoValutazione: 'automatico', stato: 'aperto' },
  { id: 'za', nome: 'Zeta cinema', regione: 'Zefiria', ente: 'Regione Zefiria', simulabile: true, tipoValutazione: 'punteggio', stato: 'aperto', finestre: [{ anno: 2026, dal: '2026-11-01', al: '2026-11-30' }], categorie: [{ nome: 'Documentari di creazione' }] },
  { id: 'ar2', nome: 'Arcadia sviluppo', nomeBreve: 'Sviluppo', regione: 'Arcadia', ente: 'Arcadia Film Fund', fondoId: 'arcadia', simulabile: false, tipoValutazione: 'sportello', stato: 'aperto' },
  { id: 'ar1', nome: 'Arcadia produzione', nomeBreve: 'Produzione', regione: 'Arcadia', ente: 'Arcadia Film Fund', fondoId: 'arcadia', simulabile: true, tipoValutazione: 'punteggio', stato: 'chiuso', descrizione: 'Sostegno alle opere girate nelle città d’Arcadia.' },
  { id: 'mio', nome: 'Bando letto da PDF', simulabile: true, griglie: GRIGLIA, categorie: [{ id: 'x', nome: 'Unica' }] },
];

test('area: regionale, nazionale, europeo, personale', () => {
  assert.deepEqual(VOCI.map(areaBando), ['europeo', 'nazionale', 'regionale', 'regionale', 'regionale', 'personale']);
  assert.equal(areaBando(null), 'personale');
});

test('gruppi: regioni in ordine alfabetico, poi Italia, poi Europa, poi i bandi senza regione', () => {
  const g = raggruppaPerRegione(VOCI);
  assert.deepEqual(g.map((x) => x.titolo), ['Arcadia', 'Zefiria', 'Italia — bandi nazionali', 'Europa', 'Altri bandi']);
  assert.deepEqual(g.map((x) => x.area), ['regionale', 'regionale', 'nazionale', 'europeo', 'personale']);
  assert.deepEqual(g[0].voci.map((b) => b.id), ['ar1', 'ar2'], 'dentro il gruppo i simulabili vengono prima');
  assert.deepEqual(g.map((x) => x.simulabili), [1, 1, 0, 0, 1]);
  assert.equal(g.reduce((n, x) => n + x.voci.length, 0), VOCI.length, 'nessuna voce persa');
});

test('gruppi: elenco vuoto, un solo bando, tanti bandi', () => {
  assert.deepEqual(raggruppaPerRegione([]), []);
  assert.deepEqual(raggruppaPerRegione(null), []);
  const uno = raggruppaPerRegione(catalogo());
  assert.equal(uno[0].titolo, 'Sicilia');
  const tanti = Array.from({ length: 30 }, (_, i) => ({ id: `b${i}`, nome: `Bando ${String(i).padStart(2, '0')}`, regione: `Regione ${String.fromCharCode(65 + (i % 10))}`, simulabile: i % 3 !== 0 }));
  const g = raggruppaPerRegione(tanti);
  assert.equal(g.length, 10);
  assert.ok(g.every((x) => x.voci.length === 3));
  assert.deepEqual(g.map((x) => x.titolo), [...g.map((x) => x.titolo)].sort((a, b) => a.localeCompare(b, 'it')));
});

test('gruppi: non modifica l’elenco ricevuto', () => {
  const copia = VOCI.map((b) => b.id);
  raggruppaPerRegione(VOCI);
  assert.deepEqual(VOCI.map((b) => b.id), copia);
});

/* ------------------------------------------------------------------ ricerca e filtri */

test('ricerca: per regione, ente, nome, categoria e tipo, senza badare agli accenti', () => {
  const ids = (t) => cercaBandi(VOCI, t).map((b) => b.id).sort();
  assert.deepEqual(ids('arcadia'), ['ar1', 'ar2']);
  assert.deepEqual(ids('ARCÀDIA  produzione'), ['ar1'], 'tutte le parole devono comparire');
  assert.deepEqual(ids('citta'), ['ar1'], 'trova «città» nella descrizione');
  assert.deepEqual(ids('documentari'), ['za'], 'cerca anche nei nomi delle categorie');
  assert.deepEqual(ids('sportello'), ['ar2'], 'cerca anche nel tipo di valutazione');
  assert.deepEqual(ids('ministero'), ['it']);
  assert.deepEqual(ids('inesistente'), []);
});

test('ricerca: testo vuoto o di soli segni restituisce tutto, in una copia', () => {
  for (const t of ['', '   ', null, undefined, '—!?']) assert.equal(cercaBandi(VOCI, t).length, VOCI.length);
  assert.notEqual(cercaBandi(VOCI, ''), VOCI);
  assert.deepEqual(cercaBandi(null, 'x'), []);
  assert.deepEqual(cercaBandi(undefined, ''), []);
});

test('filtri: tutti, aperti adesso, con griglia a punti', () => {
  assert.deepEqual(FILTRI.map((f) => f.id), ['tutti', 'aperti', 'punteggio']);
  const ids = (o) => filtraBandi(VOCI, o, OGGI).map((b) => b.id).sort();
  assert.equal(ids({}).length, VOCI.length);
  assert.deepEqual(ids({ filtro: 'aperti' }), ['ar2', 'it', 'za']);
  assert.deepEqual(ids({ filtro: 'punteggio' }), ['ar1', 'eu', 'mio', 'za']);
  assert.deepEqual(ids({ filtro: 'punteggio', testo: 'arcadia' }), ['ar1']);
  assert.deepEqual(ids({ filtro: 'aperti', testo: 'zefiria' }), ['za']);
  assert.equal(ids({ filtro: 'sconosciuto' }).length, VOCI.length, 'un filtro sconosciuto vale «Tutti»');
});

test('filtri: «aperti adesso» segue il calendario', () => {
  assert.deepEqual(filtraBandi(VOCI, { filtro: 'aperti' }, '2026-12-01').map((b) => b.id).sort(), ['ar2', 'it'], 'la finestra di Zefiria è scaduta il 30 novembre');
});

test('conteggi: i numeri accanto ai filtri tengono conto della ricerca', () => {
  assert.deepEqual(contaFiltri(VOCI, '', OGGI), { tutti: 6, aperti: 3, punteggio: 4 });
  assert.deepEqual(contaFiltri(VOCI, 'arcadia', OGGI), { tutti: 2, aperti: 1, punteggio: 1 });
  assert.deepEqual(contaFiltri([], '', OGGI), { tutti: 0, aperti: 0, punteggio: 0 });
});

test('riepilogo del catalogo', () => {
  assert.deepEqual(riepilogoCatalogo(VOCI, OGGI), { totale: 6, simulabili: 3, aperti: 3, inArrivo: 0, regioni: 2 });
  assert.deepEqual(riepilogoCatalogo(catalogo(), OGGI), { totale: catalogo().length, simulabili: BANDI_PREDEFINITI.length, aperti: riepilogoCatalogo(catalogo(), OGGI).aperti, inArrivo: riepilogoCatalogo(catalogo(), OGGI).inArrivo, regioni: riepilogoCatalogo(catalogo(), OGGI).regioni });
  assert.deepEqual(riepilogoCatalogo(null, OGGI), { totale: 0, simulabili: 0, aperti: 0, inArrivo: 0, regioni: 0 });
});

test('collegati: stesso fondo o stesso ente, esclusa la voce di partenza', () => {
  assert.deepEqual(collegati(VOCI, VOCI[4]).map((b) => b.id), ['ar2']);
  assert.deepEqual(collegati(VOCI, VOCI[0]), []);
  assert.deepEqual(collegati(VOCI, { id: 'nuovo', ente: 'ARCADIA film fund' }).map((b) => b.id).sort(), ['ar1', 'ar2'], 'l’ente si confronta senza badare alle maiuscole');
  assert.deepEqual(collegati(VOCI, { id: 'vuoto' }), [], 'senza ente né fondo non collega tutto con tutto');
  assert.deepEqual(collegati(null, null), []);
});

/* ------------------------------------------------------------------ anni */

test('anni: finestre note più l’edizione successiva attesa, ciascuna con la sua condizione', () => {
  const b = bando({
    finestre: [{ anno: 2025, dal: '2025-02-01', al: '2025-03-15' }, { anno: 2026, dal: '2026-10-01', al: '2026-12-15' }, { anno: 2027, dal: '2027-02-01', al: '2027-03-15' }],
    prossimaEdizione: { anno: 2028, periodoAtteso: 'inizio 2028', base: 'avviso triennale in scadenza' },
  });
  const anni = opzioniAnno(b, OGGI);
  assert.deepEqual(anni.map((a) => [a.anno, a.condizione]), [[2025, 'chiusa'], [2026, 'aperta'], [2027, 'futura'], [2028, 'prevista']]);
  assert.deepEqual(anni.map((a) => a.dettaglio), ['chiusa il 15 marzo 2025', 'aperta fino al 15 dicembre 2026', 'apre il 1 febbraio 2027', 'prevista']);
  assert.equal(anni[3].prevista, true);
  assert.match(anni[3].nota, /inizio 2028/);
  assert.match(NOTA_PREVISTA, /vale la griglia dell’ultima edizione/);
});

test('anni: l’edizione attesa non duplica una finestra già nota', () => {
  const b = bando({ finestre: [{ anno: 2027, dal: '2027-02-01', al: '2027-03-15' }], prossimaEdizione: { anno: 2027, periodoAtteso: 'febbraio' } });
  assert.deepEqual(opzioniAnno(b, OGGI).map((a) => [a.anno, a.prevista]), [[2027, false]]);
});

test('anni: bando senza date → anno in corso; l’anno già scelto da un dossier resta selezionabile', () => {
  assert.deepEqual(opzioniAnno(scheda(), OGGI).map((a) => [a.anno, a.condizione]), [[2026, 'senza_date']]);
  assert.deepEqual(opzioniAnno(null, OGGI).map((a) => a.anno), [2026]);
  const b = bando({ finestre: [{ anno: 2026, dal: '2026-10-01', al: '2026-12-15' }] });
  assert.deepEqual(opzioniAnno(b, OGGI, 2024).map((a) => [a.anno, a.condizione]), [[2024, 'senza_date'], [2026, 'aperta']]);
  assert.deepEqual(opzioniAnno(b, OGGI, 2026).map((a) => a.anno), [2026], 'nessun doppione');
  assert.deepEqual(opzioniAnno(b, OGGI, '2026').map((a) => a.anno), [2026], 'accetta l’anno come testo');
  assert.deepEqual(opzioniAnno(b, OGGI, 'abc').map((a) => a.anno), [2026]);
});

test('anno consigliato: aperta, poi futura, poi prevista, poi l’ultima chiusa', () => {
  const chiuse = [{ anno: 2024, dal: '2024-02-01', al: '2024-03-15' }, { anno: 2025, dal: '2025-02-01', al: '2025-03-15' }];
  const aperta = { anno: 2026, dal: '2026-10-01', al: '2026-12-15' };
  const futura = { anno: 2027, dal: '2027-02-01', al: '2027-03-15' };
  const prossimaEdizione = { anno: 2028 };
  assert.equal(annoConsigliato(bando({ finestre: [...chiuse, aperta, futura], prossimaEdizione }), OGGI), 2026);
  assert.equal(annoConsigliato(bando({ finestre: [...chiuse, futura], prossimaEdizione }), OGGI), 2027);
  assert.equal(annoConsigliato(bando({ finestre: chiuse, prossimaEdizione }), OGGI), 2028);
  assert.equal(annoConsigliato(bando({ finestre: chiuse }), OGGI), 2025);
  assert.equal(annoConsigliato(bando({ finestre: [] }), OGGI), 2026);
  assert.equal(annoConsigliato(BANDI_PREDEFINITI[0], OGGI), 2027, 'Sicilia: a novembre 2026 si lavora per la finestra 2027');
});

/* ------------------------------------------------------------------ categorie */

test('valore dell’anno: esatto, ereditato dall’ultimo anno noto, assente', () => {
  const m = { 2025: 750000, 2026: 1000000 };
  assert.deepEqual(valoreAnno(m, 2026), { valore: 1000000, anno: 2026, ereditato: false });
  assert.deepEqual(valoreAnno(m, '2025'), { valore: 750000, anno: 2025, ereditato: false });
  assert.deepEqual(valoreAnno(m, 2028), { valore: 1000000, anno: 2026, ereditato: true }, 'edizione prevista: vale l’ultimo dato');
  assert.deepEqual(valoreAnno(m, 2020), { valore: 750000, anno: 2025, ereditato: true }, 'prima del primo anno noto: il più vicino');
  assert.deepEqual(valoreAnno({ 2026: 0 }, 2026), { valore: 0, anno: 2026, ereditato: false }, 'zero è un valore');
  assert.equal(valoreAnno({}, 2026), null);
  assert.equal(valoreAnno(null, 2026), null);
  assert.equal(valoreAnno({ nota: 'testo', 2026: 'mille' }, 2026), null, 'solo numeri');
});

test('scheda della categoria: contributo, dotazione dell’anno e punteggi minimi con i nomi delle sezioni', () => {
  const b = bando();
  const c = schedaCategoria(b, b.categorie[0], 2026);
  assert.equal(c.nome, 'Lungometraggi');
  assert.equal(c.percentuale, 40);
  assert.deepEqual(c.massimale, { valore: 200000, anno: 2026, ereditato: false });
  assert.deepEqual(c.dotazione, { valore: 1000000, anno: 2026, ereditato: false });
  assert.equal(c.notaContributo, 'Elevabile per le opere prime.');
  assert.equal(c.sogliaTotale, 60);
  assert.equal(c.punteggioMassimo, 100);
  assert.deepEqual(c.soglie, [{ id: 'A', nome: 'Qualità del progetto', min: 30, max: 60 }, { id: 'B', nome: 'Ricadute sul territorio', min: 10, max: 40 }]);
  assert.equal(c.durata, 'almeno 75 minuti');
});

test('scheda della categoria: anni successivi, dati mancanti, durate', () => {
  const b = bando();
  const dopo = schedaCategoria(b, b.categorie[0], 2028);
  assert.deepEqual(dopo.massimale, { valore: 250000, anno: 2027, ereditato: true });
  assert.deepEqual(dopo.dotazione, { valore: 1000000, anno: 2026, ereditato: true });
  const corto = schedaCategoria(b, b.categorie[1], 2026);
  assert.equal(corto.massimale, null);
  assert.equal(corto.dotazione, null);
  assert.deepEqual(corto.soglie, []);
  assert.equal(corto.durata, 'meno di 30 minuti');
  assert.equal(schedaCategoria(b, { durataMin: 30, durataMaxEsclusa: 75 }, 2026).durata, 'da 30 a meno di 75 minuti');
  const vuota = schedaCategoria(null, null, 2026);
  assert.equal(vuota.nome, '');
  assert.equal(vuota.percentuale, null);
  assert.equal(vuota.durata, '');
});

test('scheda della categoria: la Sicilia del programma', () => {
  const b = BANDI_PREDEFINITI[0];
  const film = schedaCategoria(b, b.categorie.find((c) => c.id === 'film'), 2027);
  assert.equal(film.percentuale, 30);
  assert.equal(film.massimale.valore, 1000000);
  assert.equal(film.massimale.ereditato, false);
  assert.equal(film.sogliaTotale, 65);
  assert.deepEqual(film.soglie.map((s) => [s.id, s.min]), [['A', 17], ['B', 13], ['C', 20], ['D', 15]]);
  assert.ok(film.soglie.every((s) => s.nome && s.max > s.min));
});

/* ------------------------------------------------------------------ calendario */

test('calendario: storico, finestre e prossima edizione in un unico elenco per anno', () => {
  const b = bando({
    storicoEdizioni: [{ anno: 2024, pubblicato: '2023-12-10', scadenza: '2024-03-01', nota: 'prima edizione' }, { anno: 2025, pubblicato: '2024-12-12', scadenza: '2025-03-15' }],
    finestre: [{ anno: 2025, dal: '2025-02-01', al: '2025-03-15' }, { anno: 2026, dal: '2026-10-01', al: '2026-12-15', nota: 'prorogata' }, { anno: 2027, dal: '2027-02-01', al: '2027-03-15' }],
    prossimaEdizione: { anno: 2028, periodoAtteso: 'inizio 2028', base: 'cadenza annuale' },
  });
  const c = calendarioEdizioni(b, OGGI);
  assert.deepEqual(c.map((e) => [e.anno, e.condizione]), [[2024, 'passata'], [2025, 'passata'], [2026, 'aperta'], [2027, 'futura'], [2028, 'prevista']]);
  assert.deepEqual(c[0], { anno: 2024, condizione: 'passata', pubblicato: '2023-12-10', dal: null, al: '2024-03-01', nota: 'prima edizione' });
  assert.deepEqual(c[1], { anno: 2025, condizione: 'passata', pubblicato: '2024-12-12', dal: '2025-02-01', al: '2025-03-15', nota: '' }, 'storico e finestra dello stesso anno si fondono');
  assert.equal(c[2].nota, 'prorogata');
  assert.equal(c[4].nota, 'attesa: inizio 2028 — cadenza annuale');
  assert.equal(c[4].al, null);
});

test('calendario: casi limite', () => {
  assert.deepEqual(calendarioEdizioni(null, OGGI), []);
  assert.deepEqual(calendarioEdizioni(scheda(), OGGI), []);
  const soloAttesa = calendarioEdizioni(scheda({ prossimaEdizione: { anno: 2027 } }), OGGI);
  assert.deepEqual(soloAttesa, [{ anno: 2027, condizione: 'prevista', pubblicato: null, dal: null, al: null, nota: '' }]);
  const giaNota = calendarioEdizioni(bando({ finestre: [{ anno: 2027, dal: '2027-02-01', al: '2027-03-15' }], prossimaEdizione: { anno: 2027, periodoAtteso: 'febbraio' } }), OGGI);
  assert.deepEqual(giaNota.map((e) => [e.anno, e.condizione]), [[2027, 'futura']], 'la finestra con le date vince sull’attesa');
  const scadeOggi = calendarioEdizioni(bando({ finestre: [{ anno: 2026, dal: '2026-10-01', al: OGGI }] }), OGGI);
  assert.equal(scadeOggi[0].condizione, 'aperta');
});

/* ------------------------------------------------------------------ nome del dossier */

test('nome proposto per il dossier: non ripete un nome già usato', () => {
  assert.equal(nomeDossierProposto([]), 'Dossier 1');
  assert.equal(nomeDossierProposto(), 'Dossier 1');
  assert.equal(nomeDossierProposto(['Il film', 'Altro']), 'Dossier 3');
  assert.equal(nomeDossierProposto(['Dossier 2']), 'Dossier 3');
  assert.equal(nomeDossierProposto(['dossier 2', 'DOSSIER 3 ']), 'Dossier 4');
  assert.equal(nomeDossierProposto(['Dossier 1', 'Dossier 3']), 'Dossier 4');
});

/* ------------------------------------------------------------------ con il registro del programma */

test('il catalogo del programma passa da tutte le funzioni senza errori', () => {
  const voci = catalogo();
  assert.ok(voci.length >= 1);
  for (const b of voci) {
    const st = statoBando(b, OGGI);
    assert.ok(st.etichetta && st.testo, b.id);
    const sim = simulabilita(b);
    assert.equal(sim.simulabile, b.simulabile !== false, b.id);
    if (!sim.simulabile) assert.ok(sim.motivo && sim.spiegazione, `${b.id}: una scheda non simulabile spiega sempre il perché`);
    const anni = opzioniAnno(b, OGGI);
    assert.ok(anni.length >= 1 && anni.some((a) => a.anno === annoConsigliato(b, OGGI)), b.id);
    for (const c of b.categorie || []) for (const a of anni) assert.equal(schedaCategoria(b, c, a.anno).nome, c.nome);
    calendarioEdizioni(b, OGGI);
  }
  assert.equal(raggruppaPerRegione(voci).reduce((n, g) => n + g.voci.length, 0), voci.length);
});
