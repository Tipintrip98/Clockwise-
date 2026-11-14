// Gestione del bando: scadenze, erogazione, registro delle spese, rendiconto, punteggio a consuntivo, cronoprogramma.
// Tutti i dati sono d'invenzione.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  eData, aggiungiMesi, aggiungiGiorni, giorniTra, dataCorta,
  gestioneVuota, assicuraGestione, TAPPE, citaBando,
  tappaDellaScadenza, prorogaMassima, statoTappe,
  quoteDaBando, quoteInUso, pianoErogazione, costoFideiussione, mesiFideiussione,
  VOCI_SPESA, nuovaSpesa, importoSpesa, problemiSpesa, totaliSpese, filtraSpese, ordinaSpese,
  numeroItaliano, dataDaTesto, siNo, voceDaTesto, voceDaDescrizione, mezzoDaTesto, leggiCsv, campoDiColonna, mappaColonne, importaSpese, senzaDoppioni,
  csvRegistro, csvMatrice,
  preventivoPerVoce, rendiconto,
  criteriQuantitativi, campiDaConfermare, datiConsuntivo, incongruenzeEffettivi, punteggioDaMantenere,
  FASI, fasiCronoprogramma, impostaFase, proponiCronoprogramma, segniCronoprogramma, geometriaGantt, controlliCronoprogramma, csvCronoprogramma,
} from '../app/js/core/gestione.js';
import { scadenzario } from '../app/js/core/legale.js';
import { BANDO_SICILIA as B } from '../app/js/core/bando-sicilia.js';
import { sanificaBando, validaBando } from '../app/js/core/bandi/schema.js';
import { datiVuoti, valutaQuantitativo } from '../app/js/core/scoring.js';

const circa = (a, b, eps = 0.005) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const locale = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Dossier d'invenzione: gli stessi numeri del dossier dimostrativo del programma.
const DATI = {
  ...datiVuoti(), titolo: 'Il faro di ponente',
  giorni: { prepTot: 30, prepSicilia: 24, ripreseTot: 28, ripreseSicilia: 28, postTot: 60, postSicilia: 20 },
  professionisti: { artTot: 10, artSicilia: 6, crewTot: 20, crewSicilia: 15 },
  economici: { costoProduzione: 470000, costoAmmissibile: 460000, contributoRichiesto: 120000, spesaSicilia: 270000, producerFee: 30000 },
};
const progetto = (extra = {}) => ({ bandoId: B.id, categoriaId: 'film', anno: 2026, dati: structuredClone(DATI), ...extra });
// Un bando qualunque senza regole di gestione: nessuna scadenza, nessuna quota, nessun minimo.
const BANDO_NUDO = { id: 'fondo-prova', nome: 'Fondo di prova', territorio: 'Valle', categorie: [], griglie: {}, finestre: [] };

/* ------------------------------------------------------------------ date */

test('date: validità, mesi con fine mese e anni bisestili', () => {
  assert.equal(eData('2026-02-28'), true);
  assert.equal(eData('2026-02-29'), false); // 2026 non è bisestile
  assert.equal(eData('2028-02-29'), true);
  assert.equal(eData('2100-02-29'), false); // secolare non divisibile per 400
  assert.equal(eData('2000-02-29'), true);
  assert.equal(eData('2026-13-01'), false);
  assert.equal(eData('2026-04-31'), false);
  assert.equal(eData('31/12/2026'), false);
  assert.equal(eData(null), false);

  assert.equal(aggiungiMesi('2026-07-28', 18), '2028-01-28');
  assert.equal(aggiungiMesi('2026-07-28', 24), '2028-07-28');
  assert.equal(aggiungiMesi('2026-08-31', 6), '2027-02-28'); // febbraio di un anno normale
  assert.equal(aggiungiMesi('2027-08-31', 6), '2028-02-29'); // febbraio bisestile
  assert.equal(aggiungiMesi('2026-08-31', 18), '2028-02-29');
  assert.equal(aggiungiMesi('2028-02-29', 12), '2029-02-28');
  assert.equal(aggiungiMesi('2028-02-29', 48), '2032-02-29');
  assert.equal(aggiungiMesi('2026-01-31', 1), '2026-02-28');
  assert.equal(aggiungiMesi('2026-03-31', 1), '2026-04-30');
  assert.equal(aggiungiMesi('2026-11-30', 3), '2027-02-28');
  assert.equal(aggiungiMesi('2026-12-15', 1), '2027-01-15'); // cambio d'anno
  assert.equal(aggiungiMesi('2026-03-31', -1), '2026-02-28'); // all'indietro
  assert.equal(aggiungiMesi('2026-01-15', -2), '2025-11-15');
  assert.equal(aggiungiMesi('2026-05-10', 0), '2026-05-10');
  assert.equal(aggiungiMesi('non una data', 3), null);
  assert.equal(aggiungiMesi('2026-02-30', 3), null);
});

test('date: giorni di calendario, anche a cavallo del 29 febbraio e dell’ora legale', () => {
  assert.equal(aggiungiGiorni('2028-02-28', 1), '2028-02-29');
  assert.equal(aggiungiGiorni('2028-02-28', 2), '2028-03-01');
  assert.equal(aggiungiGiorni('2027-02-28', 1), '2027-03-01');
  assert.equal(aggiungiGiorni('2028-01-28', -30), '2027-12-29');
  assert.equal(aggiungiGiorni('2026-03-28', 2), '2026-03-30'); // la notte del cambio dell'ora non sposta il giorno
  assert.equal(giorniTra('2026-03-28', '2026-03-30'), 2);
  assert.equal(giorniTra('2026-10-24', '2026-10-26'), 2);
  assert.equal(giorniTra('2028-01-01', '2029-01-01'), 366);
  assert.equal(giorniTra('2027-01-01', '2028-01-01'), 365);
  assert.equal(giorniTra('2026-05-10', '2026-05-01'), -9);
  assert.equal(giorniTra('2026-05-10', ''), null);
  assert.equal(dataCorta('2026-03-05'), '05/03/2026');
});

test('date: i termini coincidono con lo scadenzario della scheda Legale', () => {
  for (const notifica of ['2026-07-28', '2026-08-31', '2027-08-31', '2028-02-29', '2026-01-31', '2026-12-31']) {
    const legale = scadenzario(B, notifica);
    const stato = statoTappe({ bando: B, anno: 2026, gestione: gestioneVuota(), dataDecreto: notifica, oggi: notifica });
    const riprese = stato.tappe.find((t) => t.id === 'fineRiprese'), rend = stato.tappe.find((t) => t.id === 'rendicontazione');
    assert.equal(riprese.termine, locale(legale.find((s) => s.id === 'riprese').data), `riprese da ${notifica}`);
    assert.equal(rend.termine, locale(legale.find((s) => s.id === 'rendiconto').data), `rendiconto da ${notifica}`);
    assert.equal(riprese.limiteProroga, locale(legale.find((s) => s.id === 'riprese').preavviso));
  }
});

/* ------------------------------------------------------------------ bando Sicilia: campi di gestione */

test('bando Sicilia: erogazione e minimo a consuntivo come nell’avviso', () => {
  assert.equal(B.consuntivoMinPct, 80);
  assert.deepEqual(B.erogazione.map((q) => q.percentuale), [60, 30, 10]);
  assert.equal(B.erogazione.reduce((a, q) => a + q.percentuale, 0), 100);
  for (const q of B.erogazione) assert.match(q.condizione, /^Art\. 16, punto \d/);
  // i due numeri compaiono davvero nel testo ufficiale incluso nel programma
  const art = (id) => B.testi.find((a) => a.id === id).testo;
  assert.match(art('art16'), /fino al 60% del contributo concesso in via provvisoria/);
  assert.match(art('art16'), /fino alla concorrenza del 90% del contributo concesso in via provvisoria/);
  assert.match(art('art15'), /non potrà essere inferiore al 80%/);
  assert.match(art('art18'), /costo di produzione inferiore al 80%/);
  // i campi passano la pulizia del registro dei bandi senza perdere nulla
  const pulito = sanificaBando(B);
  assert.equal(validaBando(pulito).ok, true);
  assert.equal(pulito.consuntivoMinPct, 80);
  assert.deepEqual(pulito.erogazione, B.erogazione);
});

test('citazioni: frasi riportate alla lettera dal testo dell’avviso, con la fonte', () => {
  const p = citaBando(B, 'punteggio', 3);
  assert.equal(p.length, 3);
  assert.ok(p.some((c) => /Art\. 18/.test(c.fonte) && /diminuzione del punteggio/.test(c.testo)));
  // ogni parte è letterale; le voci d'elenco portano davanti la frase che le introduce, unite da «[…]»
  for (const c of p) for (const parte of c.testo.replace(/^…|…$/g, '').split(' […] ')) assert.ok(B.testi.some((a) => a.testo.replace(/\s+/g, ' ').includes(parte.replace(/:$/, ''))), `non letterale: ${parte}`);
  const revoca = citaBando(B, 'territorio', 1)[0].testo;
  assert.match(revoca, /^Il cofinanziamento concesso sarà, inoltre, revocato nei casi: \[…\] in cui la spesa ammissibile/);
  assert.doesNotMatch(revoca, /^-|\[…\] -/);
  assert.equal(citaBando({ testi: [{ titolo: 'Art. 1', testo: 'Elenco:\n- primo caso di revoca\nAltro testo.\n- revoca senza introduzione' }] }, /revoca/, 3).map((c) => c.testo).join(' | '), 'Elenco: […] primo caso di revoca | revoca senza introduzione');
  assert.match(citaBando(B, 'contanti', 2)[1].testo, /transazione sia avvenuta in contanti/);
  assert.match(citaBando(B, 'periodo', 1)[0].testo, /tra la data di presentazione dell’istanza e la data di presentazione della rendicontazione finale/);
  assert.match(citaBando(B, 'territorio', 1)[0].testo, /inferiore al 150% dell’importo concesso/);
  // le abbreviazioni non spezzano la frase
  assert.match(citaBando(B, 'contanti', 1)[0].testo, /Legge n\. 136\/2010, come modificata/);
  // un bando senza testo: si cerca nelle note, altrimenti niente
  assert.deepEqual(citaBando(BANDO_NUDO, 'punteggio'), []);
  assert.equal(citaBando({ nome: 'Fondo', note: ['A consuntivo i parametri che hanno generato punteggio vanno rispettati.'] }, 'punteggio')[0].fonte, 'Fondo — note');
  assert.deepEqual(citaBando(B, 'tema inesistente'), []);
  assert.ok(citaBando(B, /prorog/gi, 5).length >= 2); // un'espressione con il flag g non salta le corrispondenze
});

/* ------------------------------------------------------------------ tappe e scadenze */

test('scadenze del bando: a quale tappa appartengono e proroga massima letta dalla nota', () => {
  assert.equal(tappaDellaScadenza(B.scadenze[0]), 'fineRiprese');
  assert.equal(tappaDellaScadenza(B.scadenze[1]), 'rendicontazione');
  assert.equal(tappaDellaScadenza({ id: 's1', etichetta: 'Avvio delle riprese sul territorio' }), 'inizioRiprese');
  assert.equal(tappaDellaScadenza({ id: 's2', etichetta: 'Presentazione del conto consuntivo' }), 'rendicontazione');
  assert.equal(tappaDellaScadenza({ id: 's3', etichetta: 'Uscita in sala' }), 'uscita');
  assert.equal(tappaDellaScadenza({ id: 's4', etichetta: 'Completamento delle lavorazioni' }), 'fineRiprese');
  assert.equal(tappaDellaScadenza({ id: 's5', etichetta: 'Consegna del piano di comunicazione' }), null);
  assert.equal(prorogaMassima(B.scadenze[0]), 6);
  assert.equal(prorogaMassima(B.scadenze[1]), 6);
  assert.equal(prorogaMassima({ nota: 'Nessuna possibilità di rinvio.' }), null);
  assert.equal(prorogaMassima({ nota: 'x', prorogaMaxMesi: 3 }), 3);
});

test('tappe: prima del decreto i termini restano in attesa e la prima cosa da fare è presentare la domanda', () => {
  const st = statoTappe({ bando: B, anno: 2027, gestione: gestioneVuota(), dataDecreto: '', oggi: '2026-11-14' });
  assert.deepEqual(st.tappe.map((t) => t.id), TAPPE.map((t) => t.id));
  const pres = st.tappe.find((t) => t.id === 'presentazione');
  assert.equal(pres.termine, '2027-03-15');
  assert.equal(pres.origine, 'finestra');
  assert.equal(pres.giorni, 121);
  assert.equal(pres.semaforo, 'verde');
  const riprese = st.tappe.find((t) => t.id === 'fineRiprese');
  assert.equal(riprese.termine, null);
  assert.match(riprese.messaggio, /Entro 18 mesi dalla notifica/);
  assert.equal(st.adesso.id, 'presentazione');
  assert.match(st.adesso.titolo, /Presenta la domanda entro il 15 marzo 2027/);
  assert.equal(st.adesso.giorni, 121);
  assert.equal(st.semaforo, 'verde');
  assert.equal(st.note.length, B.scadenzeNote.length);
});

test('tappe: finestra chiusa senza conferma è un dato da confermare, non un termine mancato', () => {
  const st = statoTappe({ bando: B, anno: 2026, gestione: gestioneVuota(), dataDecreto: '', oggi: '2026-11-14' });
  const pres = st.tappe.find((t) => t.id === 'presentazione');
  assert.equal(pres.semaforo, 'giallo');
  assert.match(pres.messaggio, /16 marzo 2026.*segna la tappa come fatta/);
  assert.equal(st.adesso.semaforo, 'giallo');
});

test('tappe: dal decreto decorrono i termini, con conto alla rovescia, semaforo e proroga', () => {
  const g = gestioneVuota();
  g.tappe.accettazione = { data: '2026-08-10', fatta: true };
  let st = statoTappe({ bando: B, anno: 2026, gestione: g, dataDecreto: '2026-07-28', oggi: '2026-11-14' });
  const t = (id) => st.tappe.find((x) => x.id === id);
  assert.equal(t('presentazione').fatta, true); // implicita: il decreto c'è
  assert.equal(t('concessione').fatta, true);
  assert.equal(t('concessione').data, '2026-07-28');
  assert.equal(t('fineRiprese').termine, '2028-01-28');
  assert.equal(t('fineRiprese').giorni, giorniTra('2026-11-14', '2028-01-28'));
  assert.equal(t('fineRiprese').limiteProroga, '2027-12-29');
  assert.equal(t('fineRiprese').prorogaMax, 6);
  assert.equal(t('fineRiprese').semaforo, 'verde');
  assert.equal(t('rendicontazione').termine, '2028-07-28');
  assert.equal(st.adesso.id, 'inizioRiprese');
  assert.match(st.adesso.dettaglio, /Prossimo termine: fine delle riprese, 28 gennaio 2028/);
  assert.equal(st.prossima.id, 'fineRiprese');

  // a ridosso del termine: giallo entro 90 giorni (con il promemoria della proroga), rosso entro 14
  st = statoTappe({ bando: B, anno: 2026, gestione: g, dataDecreto: '2026-07-28', oggi: '2027-11-20' });
  assert.equal(t('fineRiprese').semaforo, 'giallo');
  assert.match(t('fineRiprese').messaggio, /Mancano 69 giorni\. Per la proroga la richiesta va fatta entro il 29 dicembre 2027/);
  st = statoTappe({ bando: B, anno: 2026, gestione: g, dataDecreto: '2026-07-28', oggi: '2028-01-20' });
  assert.equal(t('fineRiprese').semaforo, 'rosso');
  assert.equal(st.semaforo, 'rosso');
  assert.equal(st.adesso.semaforo, 'rosso');
  assert.match(st.adesso.titolo, /Urgente: fine delle riprese/);
  st = statoTappe({ bando: B, anno: 2026, gestione: g, dataDecreto: '2026-07-28', oggi: '2028-02-02' });
  assert.match(t('fineRiprese').messaggio, /Termine scaduto da 5 giorni/);
  assert.match(st.adesso.titolo, /Termine scaduto/);

  // proroga di 6 mesi: il termine si sposta, la data per chiederla resta quella sul termine originario
  g.proroghe.riprese = 6;
  st = statoTappe({ bando: B, anno: 2026, gestione: g, dataDecreto: '2026-07-28', oggi: '2028-02-02' });
  assert.equal(t('fineRiprese').termine, '2028-07-28');
  assert.equal(t('fineRiprese').termineOriginario, '2028-01-28');
  assert.equal(t('fineRiprese').limiteProroga, '2027-12-29');
  assert.equal(t('fineRiprese').semaforo, 'verde');

  // data prevista oltre il termine: rosso anche se il termine è lontano
  g.proroghe = {};
  g.tappe.fineRiprese = { data: '2028-03-10', fatta: false };
  st = statoTappe({ bando: B, anno: 2026, gestione: g, dataDecreto: '2026-07-28', oggi: '2027-01-10' });
  assert.equal(t('fineRiprese').semaforo, 'rosso');
  assert.match(t('fineRiprese').messaggio, /supera il termine di 42 giorni\. Per la proroga/);

  // fatta: il semaforo si spegne
  g.tappe.fineRiprese = { data: '2027-10-02', fatta: true };
  st = statoTappe({ bando: B, anno: 2026, gestione: g, dataDecreto: '2026-07-28', oggi: '2028-02-02' });
  assert.equal(t('fineRiprese').semaforo, 'fatto');
  assert.match(t('fineRiprese').messaggio, /Fatto il 2 ottobre 2027/);
});

test('tappe: decreto notificato il 31 agosto, termini a fine febbraio (anno normale e bisestile)', () => {
  let st = statoTappe({ bando: B, anno: 2026, gestione: gestioneVuota(), dataDecreto: '2026-08-31', oggi: '2026-09-01' });
  assert.equal(st.tappe.find((x) => x.id === 'fineRiprese').termine, '2028-02-29');
  assert.equal(st.tappe.find((x) => x.id === 'rendicontazione').termine, '2028-08-31');
  st = statoTappe({ bando: B, anno: 2025, gestione: gestioneVuota(), dataDecreto: '2025-08-31', oggi: '2025-09-01' });
  assert.equal(st.tappe.find((x) => x.id === 'fineRiprese').termine, '2027-02-28');
});

test('tappe: un bando senza scadenze funziona con termini e scadenze liberi', () => {
  const g = gestioneVuota();
  let st = statoTappe({ bando: BANDO_NUDO, anno: 2026, gestione: g, dataDecreto: '', oggi: '2026-11-14' });
  assert.ok(st.tappe.every((t) => t.termine == null && t.semaforo === 'grigio'));
  assert.equal(st.semaforo, 'grigio');
  assert.equal(st.adesso.id, 'presentazione');
  assert.equal(st.adesso.semaforo, 'grigio');
  assert.equal(st.prossima, null);

  g.tappe.presentazione = { data: '2026-05-04', fatta: true };
  g.tappe.rendicontazione = { data: '', fatta: false, termine: '2027-06-30' };
  g.tappe.inizioRiprese = { data: '2026-11-01', fatta: false };
  g.scadenzeLibere.push({ id: 'x1', etichetta: 'Rinnovo della polizza', data: '2026-12-01', fatta: false, nota: '' }, { id: 'x2', etichetta: 'Senza data', data: '', fatta: false });
  st = statoTappe({ bando: BANDO_NUDO, anno: 2026, gestione: g, dataDecreto: '2026-09-01', oggi: '2026-11-14' });
  const rend = st.tappe.find((t) => t.id === 'rendicontazione');
  assert.equal(rend.origine, 'manuale');
  assert.equal(rend.termine, '2027-06-30');
  assert.equal(rend.semaforo, 'verde');
  const inizio = st.tappe.find((t) => t.id === 'inizioRiprese');
  assert.equal(inizio.semaforo, 'giallo');
  assert.match(inizio.messaggio, /Data prevista passata da 13 giorni/);
  assert.equal(st.altre.length, 2);
  assert.equal(st.altre[0].semaforo, 'giallo');
  assert.equal(st.altre[0].giorni, 17);
  assert.equal(st.altre[1].semaforo, 'grigio');
  assert.equal(st.prossima.id, 'x1');
  assert.equal(st.semaforo, 'giallo');
});

test('tappe: le scadenze del bando che non riguardano una tappa restano in elenco a parte', () => {
  const bando = { ...BANDO_NUDO, scadenze: [{ id: 'piano', etichetta: 'Consegna del piano di comunicazione', mesi: 3, nota: '' }, { id: 'a', etichetta: 'Fine riprese', mesi: 12, nota: '' }, { id: 'b', etichetta: 'Chiusura delle lavorazioni', mesi: 14, nota: '' }] };
  const st = statoTappe({ bando, anno: 2026, gestione: gestioneVuota(), dataDecreto: '2026-01-31', oggi: '2026-02-01' });
  assert.equal(st.tappe.find((t) => t.id === 'fineRiprese').termine, '2027-01-31');
  assert.deepEqual(st.altre.map((x) => [x.id, x.termine]), [['bando:piano', '2026-04-30'], ['bando:b', '2027-03-31']]);
});

test('gestione: i dossier salvati senza alcuni campi vengono completati senza perdere dati', () => {
  const vecchia = { contributoConcesso: 90000, tappe: { saldo: { data: '2027-01-01', fatta: true } }, spese: [{ id: 'a' }] };
  const g = assicuraGestione(vecchia);
  assert.equal(g, vecchia); // stesso oggetto: il dossier resta collegato
  assert.equal(g.contributoConcesso, 90000);
  assert.equal(g.tappe.saldo.fatta, true);
  assert.equal(g.tappe.presentazione.fatta, false);
  assert.equal(g.erogazione.fideiussione.attiva, true);
  assert.equal(g.adempimenti.length, 5);
  assert.deepEqual(g.crono.fasi, {});
  assert.equal(assicuraGestione(undefined).spese.length, 0);
  // un elenco di adempimenti svuotato dall'utente resta vuoto
  assert.deepEqual(assicuraGestione({ adempimenti: [] }).adempimenti, []);
});

/* ------------------------------------------------------------------ erogazione */

test('erogazione Sicilia: con la fideiussione 60/30/10, senza l’anticipo confluisce nella seconda quota', () => {
  const quote = quoteDaBando(B);
  assert.deepEqual(quote.map((q) => [q.id, q.percentuale, q.garanzia]), [['q1', 60, true], ['q2', 30, false], ['q3', 10, false]]);
  let piano = pianoErogazione({ quote, contributo: 120000, fideiussione: true });
  assert.deepEqual(piano.righe.map((r) => r.importo), [72000, 36000, 12000]);
  assert.deepEqual(piano.righe.map((r) => r.cumulata), [60, 90, 100]);
  assert.equal(piano.previsto, 120000);
  assert.equal(piano.incassato, 0);
  assert.equal(piano.residuo, 120000);
  assert.deepEqual(piano.avvisi, []);

  piano = pianoErogazione({ quote, contributo: 120000, fideiussione: false });
  assert.deepEqual(piano.righe.map((r) => [r.attiva, r.percentualeEffettiva, r.importo]), [[false, 0, 0], [true, 90, 108000], [true, 10, 12000]]);
  assert.deepEqual(piano.righe.map((r) => r.cumulata), [0, 90, 100]); // «fino alla concorrenza del 90%»
  assert.equal(piano.totalePct, 100);
});

test('erogazione: arrotondamenti al centesimo, la somma delle quote è sempre il contributo', () => {
  const quote = [{ id: 'a', nome: 'Prima', percentuale: 33.33 }, { id: 'b', nome: 'Seconda', percentuale: 33.33 }, { id: 'c', nome: 'Saldo', percentuale: 33.34 }];
  const piano = pianoErogazione({ quote, contributo: 100000.01 });
  circa(piano.righe.reduce((a, r) => a + r.importo, 0), 100000.01, 0.001);
  assert.deepEqual(piano.righe.map((r) => r.importo), [33330, 33330, 33340.01]);
  const dispari = pianoErogazione({ quote: quoteDaBando(B), contributo: 33333.33 });
  assert.deepEqual(dispari.righe.map((r) => r.importo), [20000, 10000, 3333.33]);
  circa(dispari.righe.reduce((a, r) => a + r.importo, 0), 33333.33, 0.001);
});

test('erogazione: stato delle quote, incassato, in attesa e residuo', () => {
  const quote = quoteDaBando(B);
  const stati = { q1: { stato: 'incassata', incassataIl: '2026-10-01' }, q2: { stato: 'chiesta', chiestaIl: '2028-06-01' }, q3: { stato: 'qualcosa' } };
  let piano = pianoErogazione({ quote, contributo: 120000, stati });
  assert.deepEqual(piano.righe.map((r) => r.stato), ['incassata', 'chiesta', 'da_chiedere']);
  assert.equal(piano.righe[0].incassataIl, '2026-10-01');
  assert.equal(piano.incassato, 72000);
  assert.equal(piano.chiesto, 36000);
  assert.equal(piano.residuo, 48000);
  // importo effettivamente incassato diverso dal previsto
  stati.q1.incassato = 70000;
  piano = pianoErogazione({ quote, contributo: 120000, stati });
  assert.equal(piano.incassato, 70000);
  assert.equal(piano.residuo, 50000);
  // senza fideiussione l'anticipo non può risultare incassato
  piano = pianoErogazione({ quote, contributo: 120000, stati, fideiussione: false });
  assert.equal(piano.righe[0].stato, 'da_chiedere');
  assert.equal(piano.incassato, 0);
  // incassato oltre il concesso: avviso
  piano = pianoErogazione({ quote, contributo: 120000, stati: { q1: { stato: 'incassata', incassato: 130000 } } });
  assert.match(piano.avvisi.join(' '), /supera il contributo concesso/);
  assert.equal(piano.residuo, -10000);
});

test('erogazione: senza contributo concesso niente importi; quote a mano che non sommano a 100 vengono segnalate', () => {
  let piano = pianoErogazione({ quote: quoteDaBando(B), contributo: null });
  assert.equal(piano.previsto, null);
  assert.equal(piano.residuo, null);
  assert.ok(piano.righe.every((r) => r.importo == null));
  piano = pianoErogazione({ quote: [{ id: 'a', nome: 'Acconto', percentuale: 40 }, { id: 'b', nome: 'Saldo', percentuale: 50 }], contributo: 50000 });
  assert.match(piano.avvisi[0], /sommano al 90%.*10% restante/);
  assert.equal(piano.previsto, 45000);
  // l'ultima quota richiede la garanzia ma la fideiussione non c'è: la sua parte resta senza destinazione
  piano = pianoErogazione({ quote: [{ id: 'a', nome: 'Saldo', percentuale: 70 }, { id: 'b', nome: 'Anticipo', percentuale: 30, garanzia: true }], contributo: 1000, fideiussione: false });
  assert.match(piano.avvisi.join(' '), /30% delle quote che richiedono la fideiussione/);
  assert.deepEqual(pianoErogazione({ quote: [], contributo: 1000 }).righe, []);
  // bando senza erogazione: nessuna quota finché l'utente non le definisce
  assert.deepEqual(quoteDaBando(BANDO_NUDO), []);
  const g = gestioneVuota();
  assert.deepEqual(quoteInUso(BANDO_NUDO, g), []);
  g.erogazione.personalizzate = true; g.erogazione.quote = [{ id: 'm1', nome: 'Unica', percentuale: 100 }];
  assert.equal(quoteInUso(B, g)[0].id, 'm1');
});

test('fideiussione: costo stimato e durata proposta', () => {
  assert.equal(costoFideiussione({ importo: 72000, tasso: 2, mesi: 24 }), 2880);
  assert.equal(costoFideiussione({ importo: 72000, tasso: 1.5, mesi: 18 }), 1620);
  assert.equal(costoFideiussione({ importo: 10000, tasso: 2.35, mesi: 7 }), 137.08);
  assert.equal(costoFideiussione({ importo: 72000, tasso: 0, mesi: 24 }), 0);
  assert.equal(costoFideiussione({ importo: null, tasso: 2, mesi: 24 }), null);
  assert.equal(costoFideiussione({ importo: 72000, tasso: -1, mesi: 24 }), null);
  assert.equal(mesiFideiussione(B), 24); // fino alla seconda erogazione, chiesta con il rendiconto
  assert.equal(mesiFideiussione(BANDO_NUDO), 12);
});

/* ------------------------------------------------------------------ registro delle spese */

const SPESE = [
  nuovaSpesa({ id: 'a', data: '2026-09-10', fornitore: 'Noleggi Ponente srl', descrizione: 'Noleggio macchina da presa', voce: 'A.4', imponibile: 12000, iva: 2640, territorio: true, pagataIl: '2026-10-10', mezzo: 'bonifico', documento: 'FT 114' }),
  nuovaSpesa({ id: 'b', data: '2026-09-18', fornitore: 'Albergo Marina', descrizione: 'Alloggio troupe', voce: 'A.4', imponibile: 8500.5, iva: 850.05, territorio: true, pagataIl: '2026-09-30', mezzo: 'carta', documento: '2026/77' }),
  nuovaSpesa({ id: 'c', data: '2026-10-02', fornitore: 'Studio Suono Uno', descrizione: 'Mix e doppiaggio', voce: 'A.6', imponibile: 20000, iva: 4400, territorio: false, pagataIl: '', documento: 'FT 9' }),
  nuovaSpesa({ id: 'd', data: '2026-10-05', fornitore: 'Bar del porto', descrizione: 'Caffetteria set', voce: 'A.4', imponibile: 300, iva: 30, territorio: true, pagataIl: '2026-10-05', mezzo: 'contanti', documento: 'RF 3' }),
  nuovaSpesa({ id: 'e', data: '2026-10-20', fornitore: 'Affitti Centro', descrizione: 'Ufficio di produzione, sede', voce: 'A.8', imponibile: 4000, iva: 880, territorio: true, pagataIl: '2026-10-21', mezzo: 'bonifico', documento: 'FT 31' }),
  nuovaSpesa({ id: 'f', data: '2026-11-03', fornitore: 'Produttore', descrizione: 'Producer fee', voce: 'A.9', imponibile: 5000, iva: 0, territorio: true, pagataIl: '2026-11-04', mezzo: 'bonifico', documento: 'FT 2' }),
];

test('registro: una riga nuova ha i tipi giusti e le spese generali nascono non ammissibili', () => {
  const r = nuovaSpesa({ data: '31/12/2026', fornitore: '  Ditta   Uno \n srl ', imponibile: '12', voce: 'Z.1', mezzo: 'baratto', territorio: 'sì' });
  assert.equal(r.data, '');
  assert.equal(r.fornitore, 'Ditta Uno srl');
  assert.equal(r.imponibile, null);
  assert.equal(r.voce, '');
  assert.equal(r.mezzo, '');
  assert.equal(r.territorio, false);
  assert.equal(r.ammissibile, true);
  assert.ok(r.id);
  assert.notEqual(nuovaSpesa().id, nuovaSpesa().id);
  assert.equal(SPESE[4].ammissibile, false); // A.8
  assert.equal(nuovaSpesa({ voce: 'A.8', ammissibile: true }).ammissibile, true); // la scelta esplicita vince
  assert.deepEqual(VOCI_SPESA.map((v) => v.id), ['A.1', 'A.2', 'A.3', 'A.4', 'A.5', 'A.6', 'A.7', 'A.8', 'A.9']);
});

test('registro: totali per voce e complessivi, con e senza IVA come costo', () => {
  const t = totaliSpese(SPESE);
  const v = (id) => t.voci.find((x) => x.id === id);
  assert.equal(t.totale.righe, 6);
  assert.equal(t.totale.imponibile, 49800.5);
  assert.equal(t.totale.iva, 8800.05);
  assert.equal(t.totale.costo, 49800.5);
  assert.equal(v('A.4').righe, 3);
  assert.equal(v('A.4').costo, 20800.5);
  assert.equal(v('A.4').territorio, 20800.5);
  assert.equal(v('A.6').costo, 20000);
  assert.equal(v('A.6').territorio, 0);
  assert.equal(v('A.8').ammissibile, 0); // nel costo ma non tra le ammissibili
  assert.equal(v('A.8').costo, 4000);
  assert.equal(v('A.1').righe, 0);
  assert.equal(t.totale.ammissibile, 45800.5);
  assert.equal(t.totale.territorio, 25800.5);
  assert.equal(t.totale.daPagare, 24400); // la sola spesa non pagata, IVA compresa
  assert.equal(t.totale.pagato, 34200.55);
  assert.equal(t.voci.some((x) => x.id === ''), false);

  const conIva = totaliSpese(SPESE, { ivaCosto: true });
  assert.equal(conIva.totale.costo, 58600.55);
  assert.equal(conIva.voci.find((x) => x.id === 'A.4').territorio, 24320.55);
  assert.equal(importoSpesa(SPESE[0]), 12000);
  assert.equal(importoSpesa(SPESE[0], true), 14640);

  // somme di decimali senza errori di virgola mobile; righe senza voce in una riga a parte
  const fini = totaliSpese([nuovaSpesa({ imponibile: 0.1, voce: 'A.7' }), nuovaSpesa({ imponibile: 0.2, voce: 'A.7' }), nuovaSpesa({ imponibile: 10 }), nuovaSpesa({ imponibile: -5, voce: 'A.7' })]);
  assert.equal(fini.voci.find((x) => x.id === 'A.7').costo, -4.7);
  assert.equal(fini.voci.find((x) => x.id === '').costo, 10);
  assert.equal(totaliSpese([]).totale.costo, 0);
  assert.equal(totaliSpese(null).voci.length, 9);
});

test('registro: che cosa non va in una riga', () => {
  const periodo = { dal: '2026-09-15', al: '2026-10-31' };
  assert.deepEqual(problemiSpesa(SPESE[0]), []);
  assert.deepEqual(problemiSpesa(SPESE[0], { periodo }), ['fuori_periodo']);
  assert.deepEqual(problemiSpesa(SPESE[1], { periodo }), []);
  assert.deepEqual(problemiSpesa(SPESE[2]), ['non_pagata']);
  assert.deepEqual(problemiSpesa(SPESE[3]), ['non_tracciabile']);
  assert.deepEqual(problemiSpesa({ ...SPESE[3], ammissibile: false }), []); // in contanti ma fuori dalle ammissibili: non è un problema
  assert.deepEqual(problemiSpesa(SPESE[4], { periodo }), []);
  assert.deepEqual(problemiSpesa({ ...SPESE[4], ammissibile: true }), ['generali_ammissibili']);
  assert.deepEqual(problemiSpesa(SPESE[5], { periodo }), ['fuori_periodo']);
  assert.deepEqual(problemiSpesa(nuovaSpesa()), ['senza_importo', 'senza_data', 'senza_fornitore', 'senza_documento', 'senza_voce', 'non_pagata']);
  assert.deepEqual(problemiSpesa({ ...SPESE[0], mezzo: '' }), ['senza_mezzo']);
  assert.deepEqual(problemiSpesa({ ...SPESE[0], pagataIl: '2026-05-01' }), ['pagata_prima']);
  assert.deepEqual(problemiSpesa({ ...SPESE[0], pagataIl: '2026-09-01' }), []); // un acconto pochi giorni prima della fattura è normale
  assert.deepEqual(problemiSpesa(SPESE[0], { periodo: { dal: '2026-09-10', al: '' } }), []); // gli estremi sono compresi
});

test('registro: filtro per testo, voce e stato', () => {
  const id = (righe) => righe.map((r) => r.id).join('');
  assert.equal(id(filtraSpese(SPESE, {})), 'abcdef');
  assert.equal(id(filtraSpese(SPESE, { testo: 'NOLEGGI ponente' })), 'a');
  assert.equal(id(filtraSpese(SPESE, { testo: 'Caffè' })), 'd'); // senza badare ad accenti e maiuscole: trova «Caffetteria»
  assert.equal(id(filtraSpese(SPESE, { testo: 'caffetteria porto' })), 'd'); // tutte le parole, anche in campi diversi
  assert.equal(id(filtraSpese(SPESE, { testo: 'caffetteria ponente' })), '');
  assert.equal(id(filtraSpese(SPESE, { testo: 'ft' })), 'acef');
  assert.equal(id(filtraSpese(SPESE, { testo: '10/2026' })), 'cde');
  assert.equal(id(filtraSpese(SPESE, { testo: 'post-produzione' })), 'c'); // anche il nome della voce
  assert.equal(id(filtraSpese(SPESE, { voce: 'A.4' })), 'abd');
  assert.equal(id(filtraSpese(SPESE, { voce: 'A.4', testo: 'troupe' })), 'b');
  assert.equal(id(filtraSpese(SPESE, { stato: 'territorio' })), 'abdef');
  assert.equal(id(filtraSpese(SPESE, { stato: 'fuori' })), 'c');
  assert.equal(id(filtraSpese(SPESE, { stato: 'non_ammissibili' })), 'e');
  assert.equal(id(filtraSpese(SPESE, { stato: 'da_pagare' })), 'c');
  assert.equal(id(filtraSpese(SPESE, { stato: 'problemi' })), 'cd');
  assert.equal(id(filtraSpese(SPESE, { stato: 'problemi' }, { periodo: { dal: '2026-10-01', al: '' } })), 'abcd');
  assert.equal(id(filtraSpese([...SPESE, nuovaSpesa({ id: 'z', imponibile: 1 })], { voce: 'nessuna' })), 'z');
});

test('registro: ordinamento stabile, righe senza valore in fondo', () => {
  const id = (righe) => righe.map((r) => r.id).join('');
  const conVuote = [...SPESE, nuovaSpesa({ id: 'z', fornitore: 'Zeta', imponibile: 99 }), nuovaSpesa({ id: 'y' })];
  assert.equal(id(ordinaSpese(conVuote, 'data')), 'abcdefzy');
  assert.equal(id(ordinaSpese(conVuote, 'data', 'desc')), 'fedcbazy');
  assert.equal(id(ordinaSpese(conVuote, 'imponibile')), 'zdefbacy'); // 99 è un importo, non un valore mancante
  assert.equal(id(ordinaSpese(conVuote, 'imponibile', 'desc')), 'cabfedzy');
  assert.equal(id(ordinaSpese(conVuote, 'fornitore')), 'ebdafczy');
  assert.equal(id(ordinaSpese(conVuote, 'voce')), 'abdcefzy'); // A.4 prima di A.6, A.8, A.9; a parità l'ordine d'inserimento
  assert.equal(id(ordinaSpese(conVuote, 'pagataIl')), 'bdaefczy');
  assert.equal(id(ordinaSpese(conVuote, 'territorio', 'desc')), 'abdefczy');
  assert.equal(id(ordinaSpese(conVuote, 'colonna inesistente')), 'abcdefzy');
  assert.equal(id(SPESE), 'abcdef'); // l'originale non viene toccato
});

/* ------------------------------------------------------------------ importazione */

test('numeri all’italiana e all’inglese', () => {
  const casi = [
    ['1.234,56', 1234.56], ['1234,56', 1234.56], ['1.234', 1234], ['12.345.678', 12345678], ['1.234.567,89', 1234567.89],
    ['€ 1.234,56', 1234.56], ['1.234,56 €', 1234.56], ['EUR 99,90', 99.9], ['1 234,56', 1234.56], ['1 234,56', 1234.56],
    ['-1.234,56', -1234.56], ['(1.234,56)', -1234.56], ['1.234,56-', -1234.56], ['−12,5', -12.5], ['+7', 7],
    ['1,234.56', 1234.56], ['1234.56', 1234.56], ['12.5', 12.5], ['0.500', 0.5], ['0,5', 0.5], ['1,234,567', 1234567], ['1’234.50', 1234.5],
    ['0', 0], ['007', 7], [1234.56, 1234.56], [0, 0],
  ];
  for (const [testo, atteso] of casi) assert.equal(numeroItaliano(testo), atteso, `«${testo}»`);
  for (const vuoto of ['', '   ', null, undefined, 'abc', '12abc', '12,5%', '--', '.', ',', NaN, Infinity]) assert.equal(numeroItaliano(vuoto), null, `«${vuoto}»`);
});

test('date scritte in molti modi', () => {
  const casi = [
    ['31/12/2026', '2026-12-31'], ['1/2/2026', '2026-02-01'], ['01-02-2026', '2026-02-01'], ['01.02.2026', '2026-02-01'], ['31/12/26', '2026-12-31'], ['15/06/98', '1998-06-15'],
    ['2026-12-31', '2026-12-31'], ['2026/1/5', '2026-01-05'], ['2026-12-31T00:00:00.000Z', '2026-12-31'], ['31/12/2026 14:30', '2026-12-31'], ['31/12/2026 00:00:00', '2026-12-31'],
    ['3 marzo 2026', '2026-03-03'], ['3 mar 2026', '2026-03-03'], ['1° agosto 2027', '2027-08-01'], ['12 dic. 2026', '2026-12-12'],
    ['29/02/2028', '2028-02-29'], [46022, '2025-12-31'], ['46022', '2025-12-31'], [46082.5, '2026-03-01'],
  ];
  for (const [testo, attesa] of casi) assert.equal(dataDaTesto(testo), attesa, `«${testo}»`);
  for (const no of ['', null, undefined, '29/02/2026', '31/04/2026', '12/13/2026', 'ieri', '2026', 12, 1e6, '3 brumaio 2026', new Date('x')]) assert.equal(dataDaTesto(no), '', `«${no}»`);
  assert.equal(dataDaTesto(new Date(2026, 11, 31)), '2026-12-31');
});

test('sì/no, voce e mezzo di pagamento da testo libero', () => {
  for (const si of ['sì', 'SI', 'Sì ', 's', 'x', 'X', 'yes', 'vero', '1', 1, true, '1.500,00', 250]) assert.equal(siNo(si), true, `«${si}»`);
  for (const no of ['no', 'NO', 'n', 'falso', '0', 0, false, '0,00']) assert.equal(siNo(no), false, `«${no}»`);
  for (const boh of ['', null, undefined, 'forse', '-']) assert.equal(siNo(boh), null, `«${boh}»`);

  const voci = [['A.4', 'A.4'], ['a4', 'A.4'], ['A 4', 'A.4'], ['A.4.12', 'A.4'], ['A.4 Produzione', 'A.4'], ['4', 'A.4'], ['4.12', 'A.4'], ['6 - Post', 'A.6'], ['Post-produzione', 'A.6'], ['PRODUZIONE', 'A.4'],
    ['Componente artistica', 'A.3'], ['Attori principali', 'A.3'], ['Spese generali', 'A.8'], ['Producer fee', 'A.9'], ['Soggetto e sceneggiatura', 'A.1'], ['Direzione', 'A.2'], ['Animazione', 'A.5'], ['Spese varie', 'A.7'],
    ['A.10', ''], ['', ''], ['Altro', ''], [null, '']];
  for (const [testo, attesa] of voci) assert.equal(voceDaTesto(testo), attesa, `«${testo}»`);
  assert.equal(voceDaDescrizione('Hotel per la troupe'), 'A.4');
  assert.equal(voceDaDescrizione('Regista, compenso'), 'A.2');
  assert.equal(voceDaDescrizione('Mix audio e doppiaggio'), 'A.6');
  assert.equal(voceDaDescrizione('Polizza assicurazione set'), 'A.7');
  assert.equal(voceDaDescrizione('Qualcosa di indefinito'), ''); // nessuna regola: meglio vuota che sbagliata
  assert.equal(voceDaDescrizione(''), '');

  const mezzi = [['Bonifico bancario', 'bonifico'], ['SEPA', 'bonifico'], ['carta di credito', 'carta'], ['POS', 'carta'], ['Assegno', 'assegno'], ['RID', 'addebito'], ['F24', 'f24'], ['CONTANTI', 'contanti'], ['cash', 'contanti'], ['Ri.Ba.', ''], ['PagoPA', 'altro'], ['', ''], ['boh', '']];
  for (const [testo, atteso] of mezzi) assert.equal(mezzoDaTesto(testo), atteso, `«${testo}»`);
});

test('CSV: separatore riconosciuto, virgolette, a capo nei campi, BOM', () => {
  assert.deepEqual(leggiCsv('﻿Data;Fornitore;Importo\r\n01/02/2026;"Rossi; Bianchi & C.";1.234,56\r\n'), [['Data', 'Fornitore', 'Importo'], ['01/02/2026', 'Rossi; Bianchi & C.', '1.234,56']]);
  assert.deepEqual(leggiCsv('a,b,c\n1,"due, con virgola","dice ""ciao"""\n'), [['a', 'b', 'c'], ['1', 'due, con virgola', 'dice "ciao"']]);
  assert.deepEqual(leggiCsv('a\tb\n1\t2,5\n'), [['a', 'b'], ['1', '2,5']]);
  assert.deepEqual(leggiCsv('a;b\n"riga\nsu due";2\n\n;\n3;4'), [['a', 'b'], ['riga\nsu due', '2'], ['3', '4']]);
  // tutte le colonne sono numeri con la virgola decimale: le virgole sono più dei punti e virgola, ma il separatore resta «;»
  assert.deepEqual(leggiCsv('1,5;2,5;3,5\n4,5;5,5;6,5\n'), [['1,5', '2,5', '3,5'], ['4,5', '5,5', '6,5']]);
  // titolo sopra le intestazioni, senza separatori
  assert.deepEqual(leggiCsv('Registro spese 2026\nData,Importo\n01/02/2026,"1.234,56"\n'), [['Registro spese 2026'], ['Data', 'Importo'], ['01/02/2026', '1.234,56']]);
  assert.deepEqual(leggiCsv(''), []);
  assert.deepEqual(leggiCsv(null), []);
  assert.deepEqual(leggiCsv('solo una cella'), [['solo una cella']]);
});

test('intestazioni di colonna: sinonimi e casi ambigui', () => {
  const casi = [
    ['Data', 'data'], ['Data documento', 'data'], ['DATA FATTURA', 'data'], ['Data emissione', 'data'],
    ['Data pagamento', 'pagataIl'], ['Pagata il', 'pagataIl'], ['Data valuta', 'pagataIl'], ['Quietanza', 'pagataIl'],
    ['Mezzo di pagamento', 'mezzo'], ['Modalità di pagamento', 'mezzo'], ['Tipo pagamento', 'mezzo'], ['Pagamento', 'mezzo'],
    ['Imponibile', 'imponibile'], ['Importo', 'imponibile'], ['Importo netto', 'imponibile'], ['Importo (IVA esclusa)', 'imponibile'], ['Costo €', 'imponibile'],
    ['IVA', 'iva'], ['Importo IVA', 'iva'], ['Imposta', 'iva'], ['Aliquota IVA', 'ivaPct'], ['IVA %', 'ivaPct'],
    ['Totale', 'totale'], ['Importo totale', 'totale'], ['Totale fattura', 'totale'], ['Lordo', 'totale'], ['Importo IVA inclusa', 'totale'],
    ['Fornitore', 'fornitore'], ['Ragione sociale', 'fornitore'], ['Beneficiario', 'fornitore'], ['Descrizione', 'descrizione'], ['Causale', 'descrizione'], ['Oggetto della prestazione', 'descrizione'],
    ['Voce', 'voce'], ['Voce di budget', 'voce'], ['Voce di spesa', 'voce'], ['Categoria', 'voce'],
    ['N. documento', 'documento'], ['Numero fattura', 'documento'], ['Fattura n.', 'documento'], ['Numero', 'documento'], ['Rif.', 'documento'], ['N.', null], ['#', null], ['Progressivo', null],
    ['Nel territorio', 'territorio'], ['In regione', 'territorio'], ['Sicilia', 'territorio'], ['Spesa in Sicilia', 'territorio'], ['Ammissibile', 'ammissibile'], ['Spesa ammissibile', 'ammissibile'],
    ['Note', 'note'], ['Annotazioni', 'note'], ['Colonna misteriosa', null], ['', null], [null, null],
  ];
  for (const [etichetta, campo] of casi) assert.equal(campoDiColonna(etichetta, 'Sicilia'), campo, `«${etichetta}»`);
  assert.equal(campoDiColonna('Sicilia', 'Puglia'), null);
  const { mappa, ignorate } = mappaColonne(['Importo', 'N.', 'Data', 'Importo totale', 'Data pagamento', 'Costo', 'Colore']);
  assert.deepEqual(mappa, { imponibile: 0, data: 2, totale: 3, pagataIl: 4 });
  assert.deepEqual(ignorate, ['N.', 'Costo', 'Colore']); // «Costo» è un doppione di «Importo»
});

const CSV_DISORDINATO = `Registro delle spese — Il faro di ponente;;;;;;;;;;;
;;;;;;;;;;;
Importo netto;Fornitore;N. fattura;Data pagamento;IVA;Data fattura;Voce di spesa;In Sicilia;Causale;Modalità di pagamento;Ammissibile;Annotazioni
"1.234,56";Noleggi Ponente srl;FT 114;15/10/2026;271,60;10/09/2026;A.4;sì;Noleggio macchina da presa;Bonifico;sì;
8.500,50;"Albergo ""Marina""";2026/77;;10%;18/09/26;;SI;Hotel per la troupe;carta;;gruppo di 12
20.000;Studio Suono Uno;FT 9;02/11/2026;4.400,00;2 ottobre 2026;Post-produzione;no;Mix e doppiaggio;bonifico SEPA;sì;
300,00;Bar del porto;RF 3;05/10/2026;;05/10/2026;4;x;Varie;CONTANTI;no;
;;;;;;;;;;;
4.000,00;Affitti Centro;FT 31;21/10/2026;880;31/02/2026;Spese generali;sì;Sede;baratto;;data sbagliata
TOTALE;;;;;;;;;;;
34.035,06;;;;;;;;;;;
`;

test('importazione: colonne in disordine, numeri all’italiana, righe vuote e totali', () => {
  const r = importaSpese(leggiCsv(CSV_DISORDINATO), { territorio: 'Sicilia' });
  assert.equal(r.righe.length, 5);
  assert.equal(r.saltate, 2); // la riga «TOTALE» e quella con la sola somma
  const [a, b, c, d, e] = r.righe;
  assert.deepEqual({ ...a, id: 0 }, { id: 0, data: '2026-09-10', fornitore: 'Noleggi Ponente srl', descrizione: 'Noleggio macchina da presa', voce: 'A.4', imponibile: 1234.56, iva: 271.6, territorio: true, ammissibile: true, pagataIl: '2026-10-15', mezzo: 'bonifico', documento: 'FT 114', note: '' });
  assert.equal(b.fornitore, 'Albergo "Marina"');
  assert.equal(b.imponibile, 8500.5);
  assert.equal(b.iva, 850.05); // «10%» è un'aliquota
  assert.equal(b.data, '2026-09-18');
  assert.equal(b.voce, 'A.4'); // proposta dalla descrizione
  assert.equal(b.pagataIl, '');
  assert.equal(b.mezzo, 'carta');
  assert.equal(b.ammissibile, true);
  assert.equal(b.note, 'gruppo di 12');
  assert.equal(c.imponibile, 20000);
  assert.equal(c.iva, 4400);
  assert.equal(c.data, '2026-10-02');
  assert.equal(c.voce, 'A.6');
  assert.equal(c.territorio, false);
  assert.equal(d.voce, 'A.4');
  assert.equal(d.mezzo, 'contanti');
  assert.equal(d.ammissibile, false);
  assert.equal(d.territorio, true);
  assert.equal(d.iva, null);
  assert.equal(e.voce, 'A.8');
  assert.equal(e.ammissibile, false); // spesa generale senza indicazione: non ammissibile
  assert.equal(e.data, ''); // il 31 febbraio non esiste
  assert.equal(e.mezzo, '');
  assert.equal(r.colonne.imponibile, 'Importo netto');
  assert.equal(r.colonne['pagata il'], 'Data pagamento');
  assert.equal(r.colonne['nel territorio'], 'In Sicilia');
  assert.deepEqual(r.ignorate, []);
  const avvisi = r.avvisi.join(' | ');
  assert.match(avvisi, /1 voce di budget è stata proposta/);
  assert.match(avvisi, /1 riga ha una data che non riesco a leggere/);
  assert.match(avvisi, /1 riga ha un mezzo di pagamento non riconosciuto/);
  assert.doesNotMatch(avvisi, /nel territorio/);
  circa(totaliSpese(r.righe).totale.imponibile, 34035.06);
});

test('importazione: celle di Excel (numeri, date seriali, percentuali), totale lordo senza imponibile', () => {
  const foglio = [
    ['Elenco fatture'],
    ['Ragione sociale', 'Data', 'Totale', 'Aliquota IVA', 'Descrizione', 'Pagato'],
    ['Trasporti Levante', 46275, 1220, 0.22, 'Noleggio furgone con autista', 'sì'],
    ['Catering Scirocco', 46280, 550, 10, 'Pranzi troupe', ''],
    ['Senza IVA', 46281, 300, '', 'Ricevuta', 'no'],
    [null, null, null, null, null, null],
  ];
  const r = importaSpese(foglio);
  assert.equal(r.righe.length, 3);
  assert.equal(r.righe[0].data, '2026-09-10');
  assert.equal(r.righe[0].imponibile, 1000);
  assert.equal(r.righe[0].iva, 220);
  assert.equal(r.righe[0].voce, 'A.4');
  assert.equal(r.righe[1].imponibile, 500);
  assert.equal(r.righe[1].iva, 50);
  assert.equal(r.righe[2].imponibile, 300);
  assert.equal(r.righe[2].iva, null);
  assert.equal(r.righe[0].pagataIl, ''); // «sì» non è una data: resta da indicare, senza avviso di data illeggibile
  assert.doesNotMatch(r.avvisi.join(' '), /data che non riesco/);
  assert.match(r.avvisi.join(' '), /Manca la colonna «nel territorio»/);
  assert.equal(r.righe[0].territorio, false);

  // imponibile e totale insieme: l'IVA è la differenza
  const due = importaSpese([['Fornitore', 'Imponibile', 'Totale'], ['Uno', '100,00', '122,00'], ['Due', '100,00', '100,00']]);
  assert.equal(due.righe[0].iva, 22);
  assert.equal(due.righe[1].iva, null);
});

test('importazione: file senza intestazioni riconoscibili o vuoto', () => {
  let r = importaSpese(leggiCsv('alfa;beta\n1;2\n'));
  assert.equal(r.righe.length, 0);
  assert.match(r.avvisi[0], /Non trovo la riga delle intestazioni/);
  r = importaSpese([]);
  assert.match(r.avvisi[0], /Non trovo/);
  r = importaSpese(null);
  assert.equal(r.righe.length, 0);
  r = importaSpese([['Data', 'Importo'], ['', '']]);
  assert.match(r.avvisi.join(' '), /non ci sono righe/);
  // una colonna sola con l'importo non basta a riconoscere il registro
  assert.equal(importaSpese([['Importo'], ['12']]).righe.length, 0);
});

test('importazione: i doppioni di ciò che è già nel registro vengono riconosciuti', () => {
  const nuove = importaSpese(leggiCsv(CSV_DISORDINATO), { territorio: 'Sicilia' }).righe;
  let r = senzaDoppioni([], nuove);
  assert.equal(r.righe.length, 5);
  assert.equal(r.doppie, 0);
  r = senzaDoppioni(nuove.slice(0, 2), nuove);
  assert.equal(r.righe.length, 3);
  assert.equal(r.doppie, 2);
  r = senzaDoppioni([], [...nuove, ...nuove]); // lo stesso file due volte nello stesso incollaggio
  assert.equal(r.righe.length, 5);
  assert.equal(r.doppie, 5);
  // stessa fattura con maiuscole diverse nel fornitore: è la stessa
  r = senzaDoppioni([{ ...nuove[0], fornitore: 'NOLEGGI PONENTE SRL' }], [nuove[0]]);
  assert.equal(r.doppie, 1);
});

test('esportazione: il registro in CSV si rilegge identico', () => {
  const testo = csvRegistro(SPESE);
  assert.ok(testo.startsWith('﻿"Data documento";"N. documento";"Fornitore"'));
  assert.match(testo, /"10\/09\/2026";"FT 114";"Noleggi Ponente srl";"Noleggio macchina da presa";"A.4 Produzione";"12000,00";"2640,00";"sì";"sì";"10\/10\/2026";"Bonifico";""/);
  const letto = importaSpese(leggiCsv(testo));
  assert.deepEqual(letto.avvisi, []);
  assert.equal(letto.righe.length, SPESE.length);
  const senzaId = (r) => ({ ...r, id: '' });
  assert.deepEqual(letto.righe.map(senzaId), ordinaSpese(SPESE, 'data').map(senzaId));
  // testi con virgolette, punto e virgola e a capo sopravvivono al giro
  const strana = nuovaSpesa({ data: '2026-01-02', fornitore: 'Ditta "Alfa"; Beta', descrizione: 'riga uno', imponibile: 1.5, voce: 'A.7', note: 'ok' });
  assert.equal(importaSpese(leggiCsv(csvRegistro([strana]))).righe[0].fornitore, 'Ditta "Alfa"; Beta');
});

test('esportazione: matrice di rendicontazione per voce, solo spese ammissibili nel territorio', () => {
  const testo = csvMatrice(SPESE, { titolo: 'Il faro di ponente', bando: B, cup: 'X00X00000000000' });
  const righe = leggiCsv(testo);
  assert.equal(righe[0][0], 'Matrice di rendicontazione — spese ammissibili sostenute in Sicilia');
  assert.deepEqual(righe[3], ['CUP', 'X00X00000000000']);
  assert.deepEqual(righe[4], ['Importi', 'IVA esclusa']);
  const corpo = righe.slice(6);
  // A.4: tre spese (anche quella in contanti, finché è segnata ammissibile: la segnala il rendiconto), poi il totale; A.6 è fuori territorio, A.8 non ammissibile
  assert.deepEqual(corpo.map((r) => r[0]), ['A.4 Produzione', 'A.4 Produzione', 'A.4 Produzione', 'Totale A.4', 'A.9 Producer fee', 'Totale A.9', 'Totale generale']);
  assert.deepEqual(corpo.map((r) => r[1]), ['1', '2', '3', '', '4', '', '']);
  assert.equal(corpo[3][8], '20800,50');
  assert.equal(corpo[5][8], '5000,00');
  assert.equal(corpo[6][8], '25800,50');
  assert.equal(numeroItaliano(corpo[6][8]), totaliSpese(SPESE).totale.territorio);
  // con l'IVA come costo l'importo rendicontato la comprende
  const conIva = leggiCsv(csvMatrice(SPESE, { bando: B, ivaCosto: true }));
  assert.equal(conIva[4][1], 'imponibile più IVA non recuperabile');
  assert.equal(conIva.at(-1)[8], '29320,55');
  assert.equal(numeroItaliano(conIva.at(-1)[8]), totaliSpese(SPESE, { ivaCosto: true }).totale.territorio);
  // registro vuoto: resta la sola intestazione con il totale a zero
  assert.equal(leggiCsv(csvMatrice([], { bando: BANDO_NUDO })).at(-1)[8], '0,00');
  assert.match(csvMatrice([], { bando: BANDO_NUDO }), /sostenute in Valle/);
});

/* ------------------------------------------------------------------ rendiconto */

function gestioneConSpese(spese, extra = {}) {
  const g = gestioneVuota();
  g.spese = spese; g.contributoConcesso = 100000;
  return Object.assign(g, extra);
}
const grande = (id, voce, imponibile, territorio = true, extra = {}) => nuovaSpesa({ id, data: '2026-10-01', fornitore: `Fornitore ${id}`, descrizione: 'Lavorazione', voce, imponibile, iva: 0, territorio, pagataIl: '2026-10-15', mezzo: 'bonifico', documento: `FT ${id}`, ...extra });

test('rendiconto: preventivo per voce dal preventivo di produzione, altrimenti i totali dei Dati chiave', () => {
  const righe = [{ voce: 'A.4.12', costo: 100000, quota: 50 }, { voce: 'A.4.17', costo: 20000, quota: 100 }, { voce: 'A.6.3', costo: 30000, quota: 0 }, { voce: 'A.9.1', costo: 5000, quota: 0 }];
  let p = preventivoPerVoce(progetto({ preventivo: { righe } }));
  assert.equal(p.origine, 'preventivo');
  assert.equal(p.voci.get('A.4').importo, 120000);
  assert.equal(p.voci.get('A.4').territorio, 70000);
  assert.equal(p.voci.get('A.6').importo, 30000);
  assert.equal(p.voci.get('A.1').importo, 0);
  assert.equal(p.costo, 155000);
  p = preventivoPerVoce(progetto({ produzione: { preventivo: { righe } } })); // posizione alternativa
  assert.equal(p.origine, 'preventivo');
  p = preventivoPerVoce(progetto());
  assert.equal(p.origine, 'dati');
  assert.equal(p.voci, null);
  assert.equal(p.costo, 470000);
  assert.equal(preventivoPerVoce({ dati: datiVuoti() }).origine, 'nessuno');
  assert.equal(preventivoPerVoce(null).origine, 'nessuno');
});

test('rendiconto: consuntivo contro preventivo per voce, con gli scostamenti', () => {
  const righe = [{ voce: 'A.4.12', costo: 100000, quota: 50 }, { voce: 'A.6.3', costo: 30000, quota: 0 }];
  const g = gestioneConSpese([grande('1', 'A.4', 110000), grande('2', 'A.6', 24000, false), grande('3', 'A.7', 5000)]);
  const r = rendiconto({ progetto: progetto({ preventivo: { righe } }), bando: B, gestione: g, oggi: '2026-11-14' });
  const v = (id) => r.voci.find((x) => x.id === id);
  assert.equal(r.origine, 'preventivo');
  assert.deepEqual([v('A.4').preventivo, v('A.4').consuntivo, v('A.4').scostamento], [100000, 110000, 10000]);
  circa(v('A.4').scostamentoPct, 10);
  assert.deepEqual([v('A.6').preventivo, v('A.6').consuntivo, v('A.6').scostamento], [30000, 24000, -6000]);
  circa(v('A.6').scostamentoPct, -20);
  assert.deepEqual([v('A.7').preventivo, v('A.7').consuntivo, v('A.7').scostamento, v('A.7').scostamentoPct], [0, 5000, 5000, null]); // voce non prevista
  assert.equal(r.totali.preventivo, 130000);
  assert.equal(r.totali.consuntivo, 139000);
  assert.equal(r.totali.scostamento, 9000);
  // senza preventivo per voce il confronto resta sui totali
  const soloDati = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  assert.equal(soloDati.origine, 'dati');
  assert.equal(soloDati.voci.find((x) => x.id === 'A.4').preventivo, null);
  assert.equal(soloDati.totali.preventivo, 470000);
});

test('rendiconto: spesa sul territorio misurata sul contributo CONCESSO, non sul richiesto', () => {
  // richiesto 120.000 (150% = 180.000), concesso 100.000 (150% = 150.000): 160.000 bastano solo sul concesso
  const g = gestioneConSpese([grande('1', 'A.4', 160000), grande('2', 'A.6', 240000, false)]);
  let r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  const c = (id) => r.controlli.find((x) => x.id === id);
  assert.equal(r.minimoTerritorio, 150000);
  assert.equal(r.spesaTerritorio, 160000);
  circa(r.pctTerritorio, 160);
  assert.equal(c('territorio').esito, 'ok');
  assert.match(c('territorio').dettaglio, /160%.*contributo concesso/);

  g.contributoConcesso = 120000;
  r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  assert.equal(r.minimoTerritorio, 180000);
  assert.equal(c('territorio').esito, 'attenzione'); // a lavorazione in corso è un avviso
  assert.match(c('territorio').dettaglio, /Mancano 20\.000/);
  assert.match(c('territorio').dettaglio, /Art\. 18[^:]*: «[^»]*inferiore al 150% dell’importo concesso/); // la regola è citata dall'avviso

  g.tappe.rendicontazione = { data: '2026-11-01', fatta: true };
  r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  assert.equal(c('territorio').esito, 'critico'); // a rendiconto presentato è una causa di revoca

  g.contributoConcesso = null;
  r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  assert.equal(c('territorio').esito, 'da_verificare');
  assert.equal(r.minimoTerritorio, null);
  assert.equal(r.pctTerritorio, null);
  assert.equal(r.saldo.find((x) => x.id === 'contributo').fatto, false);

  // esattamente sul minimo: basta
  g.contributoConcesso = 100000; g.tappe.rendicontazione = { data: '', fatta: false };
  g.spese = [grande('1', 'A.4', 150000), grande('2', 'A.6', 250000, false)];
  r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  assert.equal(c('territorio').esito, 'ok');
  g.spese[0].imponibile = 149999.99;
  r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  assert.equal(c('territorio').esito, 'attenzione');
});

test('rendiconto: costo a consuntivo almeno all’80% del costo dichiarato', () => {
  // dichiarato 470.000 → minimo 376.000
  const g = gestioneConSpese([grande('1', 'A.4', 200000), grande('2', 'A.6', 176000, false)]);
  let r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  const c = (id) => r.controlli.find((x) => x.id === id);
  assert.equal(r.minimoCosto, 376000);
  assert.equal(r.costoConsuntivo, 376000);
  circa(r.pctCosto, 80);
  assert.equal(c('consuntivo').esito, 'ok');
  g.spese[1].imponibile = 175999;
  r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  assert.equal(c('consuntivo').esito, 'attenzione');
  assert.match(c('consuntivo').dettaglio, /servono almeno 376\.000/);
  assert.match(c('consuntivo').dettaglio, /Art\. 15[^:]*: «[^»]*non potrà essere inferiore al 80%/);
  // costo dichiarato mancante
  const vuoto = progetto(); vuoto.dati.economici.costoProduzione = null;
  r = rendiconto({ progetto: vuoto, bando: B, gestione: g, oggi: '2026-11-14' });
  assert.equal(c('consuntivo').esito, 'da_verificare');
});

test('rendiconto: pagamenti non tracciabili, spese fuori periodo, documenti e pagamenti mancanti', () => {
  const g = gestioneConSpese([
    grande('1', 'A.4', 100000),
    grande('2', 'A.4', 2000, true, { mezzo: 'contanti' }),
    grande('3', 'A.4', 3000, true, { data: '2026-01-10' }),
    grande('4', 'A.6', 4000, false, { documento: '' }),
    grande('5', 'A.6', 5000, false, { pagataIl: '', mezzo: '' }),
    grande('6', 'A.6', 6000, false, { mezzo: '' }),
    grande('7', '', 700, false),
    grande('8', 'A.8', 800, true, { ammissibile: true }),
  ]);
  let r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  const c = (id) => r.controlli.find((x) => x.id === id);
  assert.equal(c('tracciabili').esito, 'critico');
  assert.match(c('tracciabili').titolo, /^1 spesa ammissibile pagata/);
  assert.match(c('tracciabili').dettaglio, /2000\s€.*Art\. 7/);
  assert.equal(c('periodo').esito, 'da_verificare'); // periodo non indicato
  assert.match(c('periodo').dettaglio, /tra la data di presentazione dell’istanza/);
  assert.equal(c('documenti').esito, 'attenzione');
  assert.match(c('documenti').titolo, /^1 spesa ha/);
  assert.equal(c('pagamenti').esito, 'attenzione');
  assert.match(c('pagamenti').titolo, /1 spesa non risulta pagata · 1 pagamento senza il mezzo indicato/);
  assert.match(c('voci').titolo, /^1 spesa è senza voce/);
  assert.match(c('generali').titolo, /^1 spesa generale è segnata/);

  g.periodo = { dal: '2026-03-01', al: '2027-12-31' };
  r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  assert.equal(c('periodo').esito, 'critico');
  assert.match(c('periodo').dettaglio, /3000\s€.*dal 1 marzo 2026 al 31 dicembre 2027/);

  // sistemato tutto: i controlli diventano verdi
  g.spese[1].mezzo = 'bonifico'; g.spese[2].data = '2026-04-10'; g.spese[3].documento = 'FT 4'; g.spese[4].pagataIl = '2026-10-20'; g.spese[4].mezzo = 'carta'; g.spese[5].mezzo = 'bonifico'; g.spese[6].voce = 'A.7'; g.spese[7].ammissibile = false;
  r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  for (const id of ['tracciabili', 'periodo', 'documenti', 'pagamenti']) assert.equal(c(id).esito, 'ok', id);
  assert.equal(c('voci'), undefined);
  assert.equal(c('generali'), undefined);
  // una spesa in contanti tolta dalle ammissibili non è più un problema, ma resta nel costo
  g.spese[1].mezzo = 'contanti'; g.spese[1].ammissibile = false;
  r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  assert.equal(c('tracciabili').esito, 'ok');
  assert.equal(r.costoConsuntivo, 121500);
  assert.equal(r.ammissibile, 118700);
});

test('rendiconto: producer fee ammissibile fino al limite del bando', () => {
  // costo 100.000 → limite 7,5% = 7.500; fee 10.000 tutta nel territorio → 2.500 non contano
  const g = gestioneConSpese([grande('1', 'A.4', 90000), grande('2', 'A.9', 10000)]);
  const r = rendiconto({ progetto: progetto(), bando: B, gestione: g, oggi: '2026-11-14' });
  assert.equal(r.feeEccedente, 2500);
  assert.equal(r.ammissibile, 97500);
  assert.equal(r.spesaTerritorio, 97500);
  assert.match(r.controlli.find((x) => x.id === 'fee').dettaglio, /2500\s€.*7,5%.*7500\s€/);
  // un bando senza limite non taglia nulla
  const libero = rendiconto({ progetto: progetto(), bando: BANDO_NUDO, gestione: g, oggi: '2026-11-14' });
  assert.equal(libero.feeEccedente, 0);
  assert.equal(libero.spesaTerritorio, 100000);
});

test('rendiconto: un bando senza minimi non inventa regole', () => {
  const g = gestioneConSpese([grande('1', 'A.4', 1000)]);
  const r = rendiconto({ progetto: progetto(), bando: BANDO_NUDO, gestione: g, oggi: '2026-11-14' });
  const c = (id) => r.controlli.find((x) => x.id === id);
  assert.equal(c('territorio').esito, 'da_verificare');
  assert.equal(c('territorio').azione, 'Verifica sull’avviso.');
  assert.equal(c('consuntivo').esito, 'da_verificare');
  assert.equal(c('consuntivo').azione, 'Verifica sull’avviso.');
  assert.equal(r.minimoTerritorio, null);
  assert.equal(r.minimoCosto, null);
  assert.equal(r.saldo.some((x) => x.id === 'territorio' || x.id === 'consuntivo' || x.id === 'quote'), false);
  // minimo espresso sul costo anziché sul contributo
  const sulCosto = rendiconto({ progetto: progetto(), bando: { ...BANDO_NUDO, spesaTerritorioMinSuCostoPct: 50 }, gestione: gestioneConSpese([grande('1', 'A.4', 400), grande('2', 'A.6', 600, false)]), oggi: '2026-11-14' });
  assert.equal(sulCosto.controlli.find((x) => x.id === 'territorio').esito, 'attenzione');
  assert.equal(sulCosto.minimoTerritorio, 500);
  // registro vuoto
  const vuoto = rendiconto({ progetto: progetto(), bando: B, gestione: gestioneVuota(), oggi: '2026-11-14' });
  assert.equal(vuoto.controlli[0].id, 'registro');
  assert.equal(vuoto.costoConsuntivo, 0);
  assert.equal(vuoto.controlli.some((x) => x.id === 'tracciabili'), false);
});

test('rendiconto: che cosa manca per chiedere il saldo', () => {
  const g = gestioneConSpese([grande('1', 'A.4', 200000), grande('2', 'A.6', 200000, false)]);
  let r = rendiconto({ progetto: progetto(), bando: B, gestione: g, dataDecreto: '', oggi: '2026-11-14' });
  const s = (id) => r.saldo.find((x) => x.id === id);
  assert.equal(s('decreto').fatto, false);
  assert.equal(s('contributo').fatto, true);
  assert.equal(s('riprese').fatto, false);
  assert.equal(s('registro').fatto, true);
  assert.equal(s('ammissibilita').fatto, false); // periodo non indicato
  assert.match(s('ammissibilita').dettaglio, /Indica il periodo/);
  assert.equal(s('territorio').fatto, true);
  assert.equal(s('consuntivo').fatto, true);
  assert.equal(s('quote').fatto, false);
  assert.match(s('quote').dettaglio, /Anticipo \(facoltativo\): da chiedere · Seconda quota: da chiedere/);
  assert.equal(r.quotaFinale.nome, 'Saldo finale');
  assert.equal(r.saldo.filter((x) => x.id.startsWith('adempimento:')).length, 5);
  assert.equal(r.mancanti, r.saldo.filter((x) => !x.fatto).length);

  g.periodo = { dal: '2026-03-01', al: '' };
  g.tappe.fineRiprese = { data: '2026-10-30', fatta: true };
  g.tappe.rendicontazione = { data: '2026-11-10', fatta: true };
  g.tappe.uscita = { data: '2026-11-12', fatta: true };
  g.erogazione.fideiussione.attiva = false; // niente anticipo: prima del saldo c'è la sola seconda quota
  g.erogazione.stati = { q2: { stato: 'incassata', incassataIl: '2026-11-11' } };
  for (const a of g.adempimenti) a.fatto = true;
  r = rendiconto({ progetto: progetto(), bando: B, gestione: g, dataDecreto: '2026-07-28', oggi: '2026-11-14' });
  assert.equal(s('quote').fatto, true);
  assert.equal(r.mancanti, 0, r.saldo.filter((x) => !x.fatto).map((x) => x.id).join(','));
});

/* ------------------------------------------------------------------ punteggio da mantenere */

const effettiviUguali = () => ({ giorni: { ...DATI.giorni }, professionisti: { ...DATI.professionisti }, spesaTerritorio: 270000 });
const confronto = (effettivi, extra = {}) => punteggioDaMantenere({ bando: B, categoriaId: 'film', dati: DATI, consuntivo: datiConsuntivo({ dati: DATI, effettivi, costoConsuntivo: 470000 }), ...extra });

test('punteggio: criteri quantitativi del bando e campi da confermare a consuntivo', () => {
  const film = criteriQuantitativi(B, 'film');
  assert.deepEqual(film.map((c) => c.id), ['4.1', '4.2', '4.3', '4.4', '4.5']); // il 5.1 dipende dal giudizio della Commissione
  assert.deepEqual(criteriQuantitativi(B, 'documentario').map((c) => c.id), ['4.1', '4.2', '4.3', '4.4']);
  assert.deepEqual(campiDaConfermare(film), ['giorni.prepTot', 'giorni.prepSicilia', 'giorni.ripreseTot', 'giorni.ripreseSicilia', 'giorni.postTot', 'giorni.postSicilia', 'professionisti.artTot', 'professionisti.artSicilia', 'professionisti.crewTot', 'professionisti.crewSicilia', 'spesa']);
  assert.deepEqual(criteriQuantitativi(BANDO_NUDO, 'x'), []);
  assert.deepEqual(campiDaConfermare([{ metrica: 'giorniRipreseTerritorio' }, { metrica: 'costoProduzione' }]), ['giorni.ripreseSicilia', 'costo']);
});

test('punteggio: i dati a consuntivo hanno la forma dei Dati chiave', () => {
  const d = datiConsuntivo({ dati: DATI, effettivi: { giorni: { ripreseTot: 25 }, professionisti: {}, spesaTerritorio: null }, spesaTerritorio: 199000, costoConsuntivo: 400000 });
  assert.equal(d.giorni.ripreseTot, 25);
  assert.equal(d.giorni.prepTot, null); // ciò che non è stato inserito resta mancante, non eredita il dichiarato
  assert.equal(d.economici.spesaSicilia, 199000); // dal registro
  assert.equal(d.economici.costoProduzione, 400000);
  assert.equal(d.economici.contributoRichiesto, 120000); // il criterio è scritto sul contributo richiesto
  assert.equal(datiConsuntivo({ dati: DATI, effettivi: { spesaTerritorio: 250000 }, spesaTerritorio: 199000 }).economici.spesaSicilia, 250000); // il valore a mano vince
  assert.equal(DATI.giorni.ripreseTot, 28); // i dichiarati non vengono toccati
});

test('punteggio: valori nel territorio più alti del totale segnalati come incongruenze', () => {
  assert.deepEqual(incongruenzeEffettivi({}), []);
  assert.deepEqual(incongruenzeEffettivi(effettiviUguali()), []);
  const r = incongruenzeEffettivi({ giorni: { prepTot: 10, prepSicilia: 24, ripreseTot: 20, ripreseSicilia: 20, postTot: null, postSicilia: 5 }, professionisti: { crewTot: 3, crewSicilia: 4 } });
  assert.deepEqual(r.map((x) => x.territorio), ['giorni.prepSicilia', 'professionisti.crewSicilia']); // uguale al totale va bene, un totale vuoto non si confronta
  assert.equal(r[0].valoreTotale, 10);
  assert.equal(r[0].valoreTerritorio, 24);
});

test('punteggio: parametri confermati, nessun punto perso', () => {
  const r = confronto(effettiviUguali());
  assert.equal(r.persi, 0);
  assert.equal(r.guadagnati, 0);
  assert.equal(r.completo, true);
  assert.equal(r.rischio, 'nessuno');
  assert.ok(r.criteri.every((c) => c.stato === 'confermato' && c.differenza === 0));
  // i punti dichiarati sono quelli che calcola il motore del simulatore
  for (const c of r.criteri) assert.equal(c.dichiarato.punti, valutaQuantitativo(criteriQuantitativi(B, 'film').find((x) => x.id === c.id), DATI, B).punti);
  assert.deepEqual(r.criteri.map((c) => c.dichiarato.punti), [8, 5, 4, 1.6, 7]);
});

test('punteggio: meno giorni, meno professionisti e meno spesa → punti persi criterio per criterio', () => {
  const eff = effettiviUguali();
  eff.giorni.ripreseSicilia = 14; // lavorazione: (24+14)/58 = 65,5% → fascia 51-74 → 9 × 0,8 = 7,2 (da 8)
  eff.professionisti.artSicilia = 5; // 50% → fascia 31-50 → 8 × 0,5 = 4 (da 5)
  eff.giorni.postSicilia = 6; // 10% → fascia fino al 10% → 0 (da 1,6)
  eff.spesaTerritorio = 300000; // 250% → fascia 151-250 → 7 (come dichiarato: 225%)
  const r = confronto(eff);
  const c = (id) => r.criteri.find((x) => x.id === id);
  assert.deepEqual([c('4.1').effettivo.punti, c('4.1').differenza, c('4.1').stato], [7.2, -0.8, 'perso']);
  assert.equal(c('4.1').effettivo.valore, '65,5%');
  assert.deepEqual([c('4.2').effettivo.punti, c('4.2').differenza], [4, -1]);
  assert.deepEqual([c('4.3').effettivo.punti, c('4.3').differenza, c('4.3').stato], [4, 0, 'confermato']);
  assert.deepEqual([c('4.4').effettivo.punti, c('4.4').differenza], [0, -1.6]);
  assert.deepEqual([c('4.5').effettivo.punti, c('4.5').differenza], [7, 0]);
  assert.equal(r.persi, 3.4);
  assert.equal(r.rischio, 'riduzione');
  assert.match(r.sintesi, /si perdono 3,4 punti/);
  assert.deepEqual(r.sezioni.map((s) => [s.id, s.persi]), [['C', 3.4]]);
  assert.equal(r.senzaRegola, false);
  assert.ok(r.citazioni.some((x) => /Art\. 18/.test(x.fonte)));
});

test('punteggio: soglie minime dopo i punti persi, con i punteggi della Commissione', () => {
  const eff = effettiviUguali();
  eff.giorni.ripreseSicilia = 14; eff.professionisti.artSicilia = 5; eff.giorni.postSicilia = 6; // −3,4 nella sezione C (minimo 20)
  let r = confronto(eff, { punteggi: { origine: 'commissione', totale: 72, sezioni: { A: 19, B: 14, C: 24, D: 15 } } });
  assert.equal(r.rischio, 'riduzione');
  assert.match(r.sintesi, /resta sopra le soglie/);
  assert.deepEqual(r.sezioni.find((s) => s.id === 'C'), { id: 'C', nome: 'Impatti economici e occupazionali in Sicilia', persi: 3.4, prima: 24, dopo: 20.6, soglia: 20, sotto: false });
  assert.deepEqual(r.totale, { prima: 72, dopo: 68.6, soglia: 65, sotto: false });

  r = confronto(eff, { punteggi: { origine: 'commissione', totale: 68, sezioni: { A: 19, B: 14, C: 22, D: 15 } } });
  assert.equal(r.rischio, 'soglie');
  assert.equal(r.sezioni.find((s) => s.id === 'C').sotto, true);
  assert.equal(r.totale.sotto, true);
  assert.match(r.sintesi, /sezione C a 18,6 \(minimo 20\); totale a 64,6 \(minimo 65\)/);
  assert.equal(r.origine, 'commissione');
});

test('punteggio: i punti in più non compensano quelli persi; dati mancanti e bandi senza criteri', () => {
  const eff = effettiviUguali();
  eff.spesaTerritorio = 400000; // 333% → 10 punti (da 7): +3
  eff.professionisti.crewSicilia = 10; // 50% → fino al 50% → 6 × 0,5 = 3 (da 4): −1
  let r = confronto(eff);
  assert.equal(r.guadagnati, 3);
  assert.equal(r.persi, 1); // prudente: non si fa la compensazione
  assert.equal(r.criteri.find((c) => c.id === '4.5').stato, 'guadagnato');

  r = confronto({ giorni: { prepTot: 30, prepSicilia: 24, ripreseTot: 28, ripreseSicilia: 28 }, professionisti: {}, spesaTerritorio: null });
  assert.equal(r.completo, false);
  assert.equal(r.rischio, 'da_completare');
  assert.equal(r.criteri.find((c) => c.id === '4.1').stato, 'confermato');
  assert.equal(r.criteri.find((c) => c.id === '4.2').stato, 'da_inserire');
  assert.equal(r.criteri.find((c) => c.id === '4.2').differenza, null);
  assert.match(r.sintesi, /completa i dati effettivi mancanti/);

  r = punteggioDaMantenere({ bando: B, categoriaId: 'film', dati: datiVuoti(), consuntivo: datiConsuntivo({ dati: datiVuoti(), effettivi: effettiviUguali() }) });
  assert.ok(r.criteri.every((c) => c.stato === 'non_dichiarato'));
  assert.equal(r.persi, 0);

  r = punteggioDaMantenere({ bando: BANDO_NUDO, categoriaId: 'x', dati: DATI, consuntivo: DATI });
  assert.equal(r.rischio, 'nessun_criterio');
  assert.equal(r.senzaRegola, true); // il bando non dice nulla: «verifica sull'avviso»
  assert.deepEqual(r.criteri, []);
});

/* ------------------------------------------------------------------ cronoprogramma */

test('cronoprogramma: fasi, durata e riprese legate alle tappe', () => {
  const g = gestioneVuota();
  assert.deepEqual(fasiCronoprogramma(g).map((f) => f.id), FASI.map((f) => f.id));
  assert.ok(fasiCronoprogramma(g).every((f) => f.dal === '' && f.al === '' && f.giorni == null));
  impostaFase(g, 'preparazione', 'dal', '2027-02-01');
  impostaFase(g, 'preparazione', 'al', '2027-02-28');
  impostaFase(g, 'riprese', 'dal', '2027-03-01');
  impostaFase(g, 'riprese', 'al', '2027-04-09');
  assert.equal(g.tappe.inizioRiprese.data, '2027-03-01'); // stesso dato delle tappe, non una copia
  assert.equal(g.tappe.fineRiprese.data, '2027-04-09');
  assert.equal(g.crono.fasi.riprese, undefined);
  const f = Object.fromEntries(fasiCronoprogramma(g).map((x) => [x.id, x]));
  assert.equal(f.preparazione.giorni, 28);
  assert.equal(f.riprese.giorni, 40);
  g.tappe.fineRiprese.data = '2027-04-16'; // cambiata dalle tappe: il diagramma la segue
  assert.equal(fasiCronoprogramma(g).find((x) => x.id === 'riprese').al, '2027-04-16');
  impostaFase(g, 'post', 'dal', '2027-06-01');
  impostaFase(g, 'post', 'al', '2027-05-01');
  assert.equal(fasiCronoprogramma(g).find((x) => x.id === 'post').invertita, true);
  assert.equal(fasiCronoprogramma(g).find((x) => x.id === 'post').giorni, null);
  impostaFase(g, 'post', 'al', 'non una data');
  assert.equal(g.crono.fasi.post.al, '');
});

test('cronoprogramma: proposta dalle giornate dei Dati chiave', () => {
  const p = proponiCronoprogramma({ inizioRiprese: '2027-03-01', giorni: DATI.giorni });
  // 28 giorni di riprese → 40 di calendario; 30 di preparazione → 42; 60 di post → 84
  assert.deepEqual(p.riprese, { dal: '2027-03-01', al: '2027-04-09' });
  assert.deepEqual(p.preparazione, { dal: '2027-01-18', al: '2027-02-28' });
  assert.deepEqual(p.post, { dal: '2027-04-10', al: '2027-07-02' });
  assert.deepEqual(p.consegna, { dal: '2027-07-03', al: '2027-08-01' });
  assert.equal(p.sviluppo.al, '2027-01-17');
  assert.equal(giorniTra(p.sviluppo.dal, p.sviluppo.al) + 1, 90);
  assert.equal(p.uscita.dal, '2027-11-29');
  // le fasi si susseguono senza buchi né sovrapposizioni
  for (const [a, b] of [['sviluppo', 'preparazione'], ['preparazione', 'riprese'], ['riprese', 'post'], ['post', 'consegna']]) assert.equal(aggiungiGiorni(p[a].al, 1), p[b].dal);
  assert.equal(proponiCronoprogramma({ inizioRiprese: '', giorni: DATI.giorni }), null);
  const conFine = proponiCronoprogramma({ inizioRiprese: '2027-03-01', fineRiprese: '2027-04-30', giorni: DATI.giorni });
  assert.deepEqual(conFine.riprese, { dal: '2027-03-01', al: '2027-04-30' }); // la fine già indicata non si cambia
  assert.equal(conFine.post.dal, '2027-05-01');
  assert.equal(proponiCronoprogramma({ inizioRiprese: '2027-03-01', fineRiprese: '2027-02-01', giorni: DATI.giorni }).riprese.al, p.riprese.al); // fine prima dell'inizio: ignorata
  assert.deepEqual(proponiCronoprogramma({ inizioRiprese: '2028-02-01', giorni: {} }).riprese, { dal: '2028-02-01', al: '2028-02-28' }); // senza giornate: 20 lavorative
});

test('cronoprogramma: geometria del diagramma (mesi interi, barre, scadenze, oggi)', () => {
  const g = gestioneVuota();
  impostaFase(g, 'riprese', 'dal', '2027-03-01');
  impostaFase(g, 'riprese', 'al', '2027-04-09');
  impostaFase(g, 'post', 'dal', '2027-04-10');
  impostaFase(g, 'consegna', 'al', '2027-08-15'); // una sola data: un punto, non una barra
  const stato = statoTappe({ bando: B, anno: 2026, gestione: g, dataDecreto: '2026-07-28', oggi: '2027-03-15' });
  const segni = segniCronoprogramma(stato);
  assert.deepEqual(segni.map((s) => [s.id, s.data]), [['concessione', '2026-07-28'], ['fineRiprese', '2028-01-28'], ['rendicontazione', '2028-07-28']]);
  const geo = geometriaGantt(fasiCronoprogramma(g), segni, { oggi: '2027-03-15' });
  assert.equal(geo.dal, '2026-07-01');
  assert.equal(geo.al, '2028-07-31');
  assert.equal(geo.giorni, 762);
  assert.equal(geo.mesi.length, 25);
  assert.deepEqual([geo.mesi[0].etichetta, geo.mesi[0].anno, geo.mesi.at(-1).etichetta, geo.mesi.at(-1).anno], ['lug', 2026, 'lug', 2028]);
  circa(geo.mesi.reduce((a, m) => a + m.w, 0), 1, 1e-9);
  assert.deepEqual([geo.mesi[19].etichetta, geo.mesi[19].anno], ['feb', 2028]);
  circa(geo.mesi[19].w, 29 / 762, 1e-9); // febbraio 2028 è bisestile
  circa(geo.mesi[7].w, 28 / 762, 1e-9); // febbraio 2027 no
  const b = Object.fromEntries(geo.barre.map((x) => [x.id, x]));
  circa(b.riprese.x, giorniTra('2026-07-01', '2027-03-01') / 762, 1e-9);
  circa(b.riprese.w, 40 / 762, 1e-9);
  assert.equal(b.sviluppo.x, null);
  assert.equal(b.post.puntuale, true);
  assert.equal(b.consegna.puntuale, true);
  circa(b.consegna.w, 1 / 762, 1e-9);
  assert.ok(geo.barre.every((x) => x.x == null || (x.x >= 0 && x.x + x.w <= 1 + 1e-9)));
  assert.ok(geo.segni.every((s) => s.x > 0 && s.x < 1));
  circa(geo.oggi, (giorniTra('2026-07-01', '2027-03-15') + 0.5) / 762, 1e-9);
  assert.equal(geometriaGantt(fasiCronoprogramma(g), segni, { oggi: '2030-01-01' }).oggi, null); // oggi fuori dal diagramma
  assert.equal(geometriaGantt(fasiCronoprogramma(gestioneVuota()), []), null);
  // una sola data in tutto: un mese
  const uno = geometriaGantt([{ id: 'x', nome: 'X', dal: '2028-02-10', al: '' }], []);
  assert.deepEqual([uno.dal, uno.al, uno.giorni, uno.mesi.length], ['2028-02-01', '2028-02-29', 29, 1]);
});

test('cronoprogramma: incongruenze con i termini del bando', () => {
  const g = gestioneVuota();
  const controlla = (oggi = '2026-08-01') => { const st = statoTappe({ bando: B, anno: 2026, gestione: g, dataDecreto: '2026-07-28', oggi }); return controlliCronoprogramma(fasiCronoprogramma(g), st); };
  assert.deepEqual(controlla(), []);
  impostaFase(g, 'preparazione', 'dal', '2027-10-01'); impostaFase(g, 'preparazione', 'al', '2027-11-15');
  impostaFase(g, 'riprese', 'dal', '2027-11-10'); impostaFase(g, 'riprese', 'al', '2028-02-10');
  impostaFase(g, 'post', 'dal', '2028-02-01'); impostaFase(g, 'post', 'al', '2028-09-01');
  let c = controlla();
  assert.equal(c.length, 3);
  assert.match(c[0].testo, /Riprese comincia prima della fine di preparazione/);
  assert.equal(c[1].esito, 'critico');
  assert.match(c[1].testo, /Le riprese finiscono il 10 febbraio 2028, oltre il termine del 28 gennaio 2028/);
  assert.match(c[2].testo, /La post-produzione finisce il 1 settembre 2028, oltre il termine per la rendicontazione del 28 luglio 2028/);
  // con la proroga di sei mesi le riprese rientrano
  g.proroghe.riprese = 6; g.proroghe.rendiconto = 6;
  c = controlla();
  assert.equal(c.length, 1);
  // montaggio che parte durante le riprese: nessuna segnalazione (è normale)
  assert.doesNotMatch(c.map((x) => x.testo).join(' '), /Post-produzione comincia/);
  // riprese prima della domanda
  g.tappe.presentazione = { data: '2027-12-01', fatta: false };
  assert.match(controlla().at(-1).testo, /prima della presentazione della domanda.*verifica sull’avviso/);
  impostaFase(g, 'consegna', 'dal', '2028-10-01'); impostaFase(g, 'consegna', 'al', '2028-09-01');
  assert.equal(controlla()[0].esito, 'critico');
  assert.match(controlla()[0].testo, /Consegna: la data di fine precede quella di inizio/);
});

test('cronoprogramma: esportazione CSV', () => {
  const g = gestioneVuota();
  impostaFase(g, 'riprese', 'dal', '2027-03-01'); impostaFase(g, 'riprese', 'al', '2027-04-09');
  const stato = statoTappe({ bando: B, anno: 2026, gestione: g, dataDecreto: '2026-07-28', oggi: '2026-08-01' });
  const righe = leggiCsv(csvCronoprogramma(fasiCronoprogramma(g), segniCronoprogramma(stato)));
  assert.deepEqual(righe[0], ['Tipo', 'Nome', 'Dal', 'Al', 'Giorni di calendario']);
  assert.deepEqual(righe[3], ['Fase', 'Riprese', '01/03/2027', '09/04/2027', '40']);
  assert.deepEqual(righe[1], ['Fase', 'Sviluppo', '', '', '']);
  assert.deepEqual(righe[7], ['Decreto', 'Notifica del decreto', '28/07/2026', '', '']);
  assert.deepEqual(righe[8], ['Scadenza', 'Termine: fine delle riprese', '28/01/2028', '', '']);
  assert.equal(righe.length, 10);
});
