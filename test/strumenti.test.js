import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import XLSX from 'xlsx';

import { BANDO_SICILIA as B } from '../app/js/core/bando-sicilia.js';
import { datiVuoti, componiRisultato, previsioneStatistica, storicoFinanziamento, statisticheEsiti } from '../app/js/core/scoring.js';
import { finestraInvio, controlliFormato, controlliIncrociati, statoInvio, campiMancanti } from '../app/js/core/invio.js';
import { eseguiSpoglio, pianoLavorazione } from '../app/js/core/sceneggiatura.js';
import { pulisciSvg, schemaInquadratura, verificaRiferimenti, generaStoryboard, testoScena, htmlStoryboard, csvInquadrature, immagineSvg, CAMPI } from '../app/js/core/storyboard.js';
import { calendarioRiprese, ordineDelGiorno, testoOdg, stralci, dataEstesa } from '../app/js/core/odg.js';
import { voceProposta, leggiMasterBudget, eMasterBudget, totaliPreventivo, datiDalPreventivo, csvModuloIII, VOCI } from '../app/js/core/preventivo.js';
import { condizioniProduzione } from '../app/js/core/condizioni.js';
import { APP, NOVITA } from '../app/js/core/versione.js';

const COPIONE = `[pagina 1]
SCENA 1. EST. TONNARA DI FAVIGNANA - ALBA
Saro cammina sul molo con la lanterna spenta. Guarda il mare.

SARO
Quarant'anni ca ti parru.

2. INT. STABILIMENTO FLORIO - GIORNO
Nina fotografa i macchinari arrugginiti.

NINA
Non e' un museo.

[pagina 2]
3. EST. MARE APERTO - GIORNO
Saro rema da solo. Un tonno enorme gira attorno alla barca.

4. EST. TONNARA DI FAVIGNANA - NOTTE
Saro accende la lanterna. Un bambino lo osserva dal molo.
`;
const llmSpoglio = { limiteByte: 2_000_000, paralleli: 1, async chiama(p) {
  const ks = [...p.documenti.matchAll(/### SCENA k=(\d+) — (.*)/g)];
  return { modello: 'finto', json: { scene: ks.map(([, k, intest]) => ({
    k: Number(k), intestazione: intest, int_est: 'EST', luce: 'GIORNO', ambiente: 'X', luogo: 'Favignana', sinossi: `Scena ${k}.`,
    personaggi: /FLORIO/.test(intest) ? ['NINA'] : ['SARO'], comparse: /NOTTE/.test(intest) ? '1 bambino' : '',
    elementi: { scena: /TONNARA/.test(intest) ? ['lanterna'] : [], costumi: [], trucco: [], veicoli: [], animali: /MARE/.test(intest) ? ['tonno'] : [], stunt: [], effetti: [], vfx: [], suono: [], attrezzature: /MARE/.test(intest) ? ['drone'] : [] },
    rischi: /MARE/.test(intest) ? ['riprese in mare aperto'] : /NOTTE/.test(intest) ? ['minore in scena'] : [],
  })) } };
} };
const documento = { nome: 'copione.pdf', testo: COPIONE, pagine: 2 };
const spoglioDiProva = () => eseguiSpoglio({ documento, titolo: 'Prova', llm: llmSpoglio, opzioni: { modello: 'm' } });

test('versione e crediti', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(APP.versione, pkg.version, 'versione.js e package.json devono coincidere');
  assert.equal(APP.autore, 'Davide Tipaldi');
  assert.equal(NOVITA[0].versione, APP.versione);
});

test('storico delle soglie di finanziamento: 2025 (solo finanziati) e 2026', () => {
  const film = storicoFinanziamento(B, 'film');
  assert.deepEqual(film.map((x) => [x.anno, x.finanziati, x.primo, x.ultimoFinanziato]), [[2024, 9, 91.9, 80.6], [2025, 7, 86.1, 83.1], [2026, 11, 86.1, 77.1]]);
  assert.deepEqual(storicoFinanziamento(B, 'documentario').map((x) => x.ultimoFinanziato), [75.2, 79.4, 80.2]);
  assert.deepEqual(storicoFinanziamento(B, 'cortometraggio').map((x) => [x.anno, x.ultimoFinanziato]), [[2024, 68.8], [2025, 75.8], [2026, 77.7]]);
  // i dati 2025 quadrano: somma delle sezioni e formula del contributo (richiesto × punteggio ÷ punteggio del primo)
  for (const edizione of B.esitiFinanziati) for (const righe of Object.values(edizione.categorie)) {
    const primo = Math.max(...righe.map((r) => r.totale));
    for (const r of righe) assert.ok(Math.abs(r.sezioni.A + r.sezioni.B + r.sezioni.C + r.sezioni.D - r.totale) < 0.051, `somma istanza ${r.n} del ${edizione.anno}`);
    for (const r of righe.slice(0, 2).filter((x) => x.richiesto)) assert.ok(Math.abs((r.richiesto * r.totale) / primo - r.concedibile) < 0.01, `contributo istanza ${r.n} del ${edizione.anno}`);
  }
  // le statistiche di sezione restano quelle dell'edizione completa
  assert.equal(statisticheEsiti(B, 'film').anno, 2026);
  assert.equal(statisticheEsiti(B, 'film').valutati, 38);
});

test('previsione statistica: scenari ed empirica sui punteggi reali', () => {
  const dati = { ...datiVuoti(), giorni: { prepTot: 30, prepSicilia: 30, ripreseTot: 28, ripreseSicilia: 28, postTot: 60, postSicilia: 60 },
    professionisti: { artTot: 10, artSicilia: 10, crewTot: 20, crewSicilia: 20 }, economici: { costoProduzione: 500000, costoAmmissibile: 490000, contributoRichiesto: 120000, spesaSicilia: 480000, producerFee: 30000 },
    piano: [{ voce: '1.1', importo: 120000, documento: 'nessuno' }, { voce: '2.2', importo: 380000, documento: 'contratto' }] };
  const ris = componiRisultato(B, 'film', dati, {});
  const prev = previsioneStatistica(B, 'film', ris);
  assert.equal(prev.anno, 2026);
  assert.equal(prev.valutati, 38);
  assert.ok(prev.sezioniStimate.includes('A') && prev.sezioniStimate.includes('B') && !prev.sezioniStimate.includes('C'));
  const { basso, atteso, alto } = prev.scenari;
  assert.ok(basso.totale <= atteso.totale && atteso.totale <= alto.totale);
  assert.equal(atteso.sezioni.find((s) => s.id === 'C').punti, ris.sezioni.find((s) => s.id === 'C').punti, 'le sezioni già calcolate non cambiano');
  for (const s of atteso.sezioni) { const r = ris.sezioni.find((x) => x.id === s.id); assert.ok(s.punti >= r.punti && s.punti <= r.punti + r.daValutare + 0.001, 'ogni stima resta entro i limiti del dossier'); }
  assert.equal(prev.empirica.casi, 38);
  assert.ok(prev.empirica.ammissibili > 0 && prev.empirica.ammissibili <= 38);
  assert.ok(prev.empirica.finanziabili <= prev.empirica.ammissibili);
  // dossier senza numeri: nessun caso reale lo porta sopra il minimo della sezione C
  const vuoto = previsioneStatistica(B, 'film', componiRisultato(B, 'film', datiVuoti(), {}));
  assert.equal(vuoto.empirica.ammissibili, 0);
  assert.equal(vuoto.empirica.sezioneCritica.id, 'C');
});

test('finestra di invio e formato dei file', () => {
  assert.deepEqual([finestraInvio(B, 2027, new Date(2026, 10, 14)).stato, finestraInvio(B, 2027, new Date(2026, 10, 14)).giorni], ['futura', 79]);
  assert.deepEqual([finestraInvio(B, 2027, new Date(2027, 2, 10)).stato, finestraInvio(B, 2027, new Date(2027, 2, 10)).giorni], ['aperta', 5]);
  assert.equal(finestraInvio(B, 2027, new Date(2027, 2, 15)).stato, 'aperta', 'l’ultimo giorno la finestra è ancora aperta');
  assert.equal(finestraInvio(B, 2027, new Date(2027, 2, 16)).stato, 'chiusa');
  assert.equal(finestraInvio(B, 2031), null);
  const docs = [
    { id: 'a', nome: 'Modulo III.xlsx', tipo: 'modulo3', avvisi: [] }, { id: 'b', nome: 'Modulo II parte 1.pdf', tipo: 'modulo2', avvisi: [] }, { id: 'c', nome: 'Modulo II parte 2.pdf', tipo: 'modulo2', avvisi: [] },
    { id: 'd', nome: 'sceneggiatura.docx', tipo: 'sceneggiatura', avvisi: [] }, { id: 'e', nome: 'cv regista.pdf', tipo: 'cv_regista', avvisi: ['PDF senza testo selezionabile (probabile scansione): Claude non può leggerlo.'] },
  ];
  const c = controlliFormato(B, docs);
  assert.ok(c.find((x) => x.id === 'fmt_a').dettaglio.includes('97-2003'), 'xlsx al posto di xls: istruzione per salvarlo');
  assert.ok(c.some((x) => x.id === 'fmt_unico_modulo2'));
  assert.ok(c.some((x) => x.id === 'fmt_d'));
  assert.ok(c.some((x) => x.id === 'fmt_let_e'));
  assert.equal(c.length, 4);
});

test('controlli incrociati tra Modulo III e allegati', () => {
  const p = { anno: 2027, categoriaId: 'film', dati: { ...datiVuoti(), giorni: { ripreseTot: 40 } },
    documenti: [{ id: '1', nome: 'lettera Rossi.pdf', tipo: 'accordi_cast', testo: 'Lettera di intento tra la produzione e Mario ROSSI, direttore della fotografia.' }, { id: '2', nome: 'pe.pdf', tipo: 'produttore_esecutivo', testo: 'x' }],
    modulo3: { accordi: { distribuzione: { presente: true, ragioneSociale: 'Lumen Distribuzione' }, coproduzioneItalia: { presente: false }, produttoreEsecutivo: { presente: false } },
      elencoArtistico: [{ ruolo: 'Direttore della fotografia', nome: 'Mario Rossi' }, { ruolo: 'Compositore', nome: 'Anna Bianchi' }], elencoTecnico: [],
      dataInizioRiprese: '10/01/2027', dataFineRiprese: '30/01/2027' } };
  const c = controlliIncrociati(B, p);
  const per = Object.fromEntries(c.map((x) => [x.id, x]));
  assert.equal(per.m3_distribuzione.esito, 'critico');
  assert.ok(per.m3_distribuzione.dettaglio.includes('Lumen Distribuzione'));
  assert.equal(per.m3_nd_produttore_esecutivo.esito, 'attenzione');
  assert.ok(per.m3_nominativi.titolo.includes('1 nominativi su 2') && per.m3_nominativi.dettaglio.includes('Anna Bianchi') && !per.m3_nominativi.dettaglio.includes('Mario Rossi'));
  assert.ok(per.m3_inizio, 'riprese prima dell’apertura della finestra');
  assert.ok(per.m3_giorni.dettaglio.includes('21 giorni di calendario'));
  assert.deepEqual(controlliIncrociati(B, { ...p, modulo3: null }), []);
});

test('stato dell’invio: passi, problemi in ordine di gravità, prossimo passo', () => {
  const vuoto = { anno: 2027, categoriaId: 'film', documenti: [], dati: datiVuoti() };
  const s0 = statoInvio(B, vuoto, componiRisultato(B, 'film', vuoto.dati, {}), new Date(2026, 10, 14));
  assert.equal(s0.passi[0].stato, 'da_fare');
  assert.deepEqual(s0.prossimo, { scheda: 'documenti', testo: 'Carica i documenti del dossier' });
  assert.ok(!s0.problemi.some((x) => x.id.startsWith('all_')), 'senza file caricati non si elencano gli allegati mancanti uno per uno');
  assert.equal(s0.pronto, false);
  assert.equal(campiMancanti(vuoto.dati).mancanti.length, 15);
  const p = { ...vuoto, documenti: [{ id: '1', nome: 'Modulo III.xls', tipo: 'modulo3', testo: 'x', avvisi: [] }] };
  const s1 = statoInvio(B, p, componiRisultato(B, 'film', p.dati, {}), new Date(2026, 10, 14));
  assert.equal(s1.semaforo, 'rosso');
  assert.equal(s1.passi[0].stato, 'attenzione');
  assert.ok(s1.problemi.length > 3 && s1.problemi[0].esito === 'critico' && s1.problemi[0].scheda === 'documenti');
  assert.ok(s1.problemi.every((x, i, a) => i === 0 || !(a[i - 1].esito === 'attenzione' && x.esito === 'critico')), 'prima i bloccanti');
  assert.ok(s1.file.find((f) => f.tipo === 'modulo3').file.length === 1 && s1.file.find((f) => f.tipo === 'modulo1').file.length === 0);
  assert.equal(s1.invio.indirizzo, 'dipartimento.turismo@certmail.regione.sicilia.it');
});

test('storyboard: pulizia del disegno, schema di riserva, fedeltà al testo', async () => {
  const sporco = 'ecco: <svg viewBox="0 0 320 180" onload="x()"><script>alert(1)</script><rect width="320" height="180" fill="#fff" onclick="y()"/><text x="3">ciao</text><image href="http://x/y.png"/><path d="M0 0L10 10" style="fill:red"/><a href="https://x">k</a></svg> fine';
  const pulito = pulisciSvg(sporco);
  assert.ok(pulito.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') && pulito.endsWith('</svg>'));
  for (const vietato of ['script', 'alert', 'onload', 'onclick', 'href', 'http://x', '<text', 'ciao', 'style=', '<image', '<a']) assert.ok(!pulito.includes(vietato), `rimosso: ${vietato}`);
  assert.ok(pulito.includes('<path d="M0 0L10 10"'));
  assert.equal(pulisciSvg('nessun disegno'), null);
  assert.equal(pulisciSvg('<svg><text>solo testo</text></svg>'), null, 'un disegno senza forme non serve');
  assert.equal(pulisciSvg('<svg><rect fill="url(https://x/y)"/></svg>'), null);
  for (const [campo] of CAMPI) { const s = schemaInquadratura(campo); assert.ok(pulisciSvg(s), `schema ${campo} valido`); assert.ok(immagineSvg(s).startsWith('data:image/svg+xml')); }
  assert.notEqual(schemaInquadratura('PP'), schemaInquadratura('CL'));

  const sp = await spoglioDiProva();
  const testo = testoScena(documento, sp, 0);
  assert.ok(testo.startsWith('SCENA 1. EST. TONNARA') && testo.includes('lanterna spenta') && !testo.includes('Nina'));
  assert.equal(testoScena(documento, { ...sp, formattata: false }, 0), null);
  const v = verificaRiferimenti([{ riferimento: 'Saro cammina sul molo con la lanterna' }, { riferimento: 'cammina sul molo… con la lanterna spenta, guarda' }, { riferimento: 'Saro corre verso il faro in fiamme' }, { riferimento: '' }], testo);
  assert.deepEqual(v.map((x) => x.ancorata), [true, true, false, false]);
  assert.equal(verificaRiferimenti([{ riferimento: 'x y' }], null)[0].ancorata, null);

  let richiesta = null;
  const llm = { async chiama(r) { richiesta = r; return { modello: 'finto', json: { inquadrature: [
    { campo: 'cl', angolazione: 'altezza occhi', movimento: 'fissa', ottica: 'grandangolo 24 mm', descrizione: 'Il molo all’alba, Saro di spalle.', riferimento: '«Saro cammina sul molo»', battuta: '', durata_sec: 6, prompt: 'An old fisherman walks on a pier at dawn.', svg: '<svg viewBox="0 0 320 180"><path d="M0 120H320"/></svg>' },
    { campo: 'PP', angolazione: '', movimento: '', ottica: '', descrizione: 'Saro parla al mare.', riferimento: 'un elicottero atterra', battuta: 'SARO: Quarant’anni ca ti parru.', durata_sec: 999, prompt: '', svg: 'rotto' },
    { campo: 'XX', descrizione: '', svg: '' },
  ] } }; } };
  const sb = await generaStoryboard({ scena: sp.scene[0], testo, titolo: 'Prova', stile: 'inchiostro', massimo: 5, llm, opzioni: { modello: 'm' } });
  assert.ok(richiesta.documenti.includes('lanterna spenta') && richiesta.system.includes('Non aggiungere eventi'));
  assert.equal(sb.inquadrature.length, 2, 'le voci vuote si scartano');
  assert.deepEqual(sb.inquadrature.map((q) => [q.n, q.campo, q.ancorata, q.durata, !!q.svg]), [[1, 'CL', true, 6, true], [2, 'PP', false, 120, false]]);
  assert.ok(sb.inquadrature[0].prompt.includes('black ink storyboard') && sb.inquadrature[0].prompt.endsWith('16:9'));
  const html = htmlStoryboard({ titolo: 'Prova <1>', tavole: [{ scena: sp.scene[0], storyboard: sb }] });
  assert.ok(html.includes('Prova &lt;1&gt;') && html.includes('1A · CL') && html.includes('1B · PP') && (html.match(/<img /g) || []).length === 2);
  assert.equal(csvInquadrature([{ scena: sp.scene[0], storyboard: sb }]).split('\r\n').length, 3);
});

test('ordine del giorno, calendario e stralci', async () => {
  assert.deepEqual(calendarioRiprese(4, { inizio: '2027-09-10', giorniSettimana: 5 }), ['2027-09-10', '2027-09-13', '2027-09-14', '2027-09-15']);
  assert.deepEqual(calendarioRiprese(3, { inizio: '2027-09-10', giorniSettimana: 6 }), ['2027-09-10', '2027-09-11', '2027-09-13']);
  assert.deepEqual(calendarioRiprese(3, {}), []);
  assert.equal(dataEstesa('2027-09-10'), 'venerdì 10 settembre 2027');
  const sp = await spoglioDiProva();
  const piano = pianoLavorazione(sp, { ottaviGiorno: 1 });
  const notte = piano.giorni.find((d) => d.turno === 'NOTTE').n;
  const odg = ordineDelGiorno(sp, piano, notte, { inizio: '2027-09-10', giorniSettimana: 6 });
  assert.equal(odg.turno, 'NOTTE');
  assert.deepEqual([odg.orari.troupe, odg.orari.trucco, odg.orari.prontiAGirare, odg.orari.fine], ['17:00', '16:30', '18:00', '04:00']);
  assert.deepEqual(odg.cast.map((c) => c.personaggio), ['SARO']);
  assert.equal(odg.comparse[0].testo, '1 bambino');
  assert.deepEqual(odg.sicurezza, ['minore in scena']);
  assert.equal(odg.reparti.scena.voci[0].voce, 'lanterna');
  assert.equal(odg.set[0].nome, 'TONNARA DI FAVIGNANA');
  const giorno1 = ordineDelGiorno(sp, piano, 1, { convocazione: '6:30', oreLavoro: 9 });
  assert.deepEqual([giorno1.orari.troupe, giorno1.orari.prontiAGirare, giorno1.orari.fine, giorno1.data], ['06:30', '07:30', '16:30', null]);
  assert.ok(giorno1.domani && giorno1.domani.n === 2);
  assert.equal(ordineDelGiorno(sp, piano, 99), null);
  const testo = testoOdg(odg, { titolo: 'Prova', produzione: 'Esempio Film' });
  assert.ok(testo.includes('ORDINE DEL GIORNO N.') && testo.includes('PROVA') && testo.includes('TONNARA DI FAVIGNANA') && testo.includes('minore in scena') && testo.includes('lanterna'));
  const st = stralci(documento, sp, ['2', '3']);
  assert.ok(st.includes('Nina fotografa') && st.includes('Saro rema') && !st.includes('lanterna spenta'));
  assert.equal(stralci(documento, { ...sp, formattata: false }, ['2']), null);
});

test('preventivo: voci del Modulo III, importazione del Master Budget, totali', () => {
  assert.deepEqual(['Regista', 'Protagonista', 'Direttore Fotografia', 'Elettricisti', 'Hotel + Vitto', 'Studio Legale', 'Montatore', 'Comparse', 'Qualcosa di ignoto'].map((n) => voceProposta(n)),
    ['A.2.1', 'A.3.1', 'A.4.11', 'A.4.13', 'A.4.17', 'A.7.3', 'A.6.4', 'A.4.7', 'A.4.19']);
  assert.equal(voceProposta('COSTO DEL NOLEGGIO', 'ATTREZZATURA AUDIO'), 'A.4.16');
  assert.equal(new Set(VOCI.map((v) => v.codice)).size, VOCI.length);

  // foglio con la stessa impaginazione del Master Budget: sezione in A, voce in B, lordo in D, formule di oneri e IVA
  const n = (v) => ({ t: 'n', v }), s = (v) => ({ t: 's', v }), f = (formula) => ({ t: 'n', v: 0, f: formula });
  const ws = { '!ref': 'A1:N40',
    A1: s('SOPRA LINEA'), A2: s('UN.'), B2: s('Denominazione'), D2: s('LORDO FATTURA '), B3: s('Soggetto'), D3: n(11760), F3: f('N(D3)/1.176'),
    B4: s('TOTALE'), D4: f('SUM(D3:D3)'),
    A5: n(1), B5: s('Regista'), D5: n(10000), G5: f('N(D5)*0.3'), K5: f('N(D5)*0.01'),
    A6: s('Attori Principali'), D6: s('LORDO TRATTEN. '), B7: s('Protagonista'), D7: n(12200), E7: s('SI'), G7: f('N(D7)*0.2788'),
    A8: s('REPARTO REGIA'), A9: n(2), B9: s('Aiuto regista'), D9: n(5000), G9: f('N(D9)*0.2797'), K9: f('N(D9)*0.00553'),
    B10: s('VITTO E ALLOGGIO'), D10: s('LORDO FATTURA '), B11: s('Hotel + Vitto'), D11: n(11000), K11: n(0.1), B12: s('Importo vuoto'),
    A13: s('ATTREZZATURA AUDIO'), A14: s('COSTO DEL NOLEGGIO'), D14: n(1220), K14: n(0.22),
    B15: s('Producer fee'), C15: n(0.075), E15: n(20000),
    B17: s('CONTO ECONOMICO TOTALE'), B18: s('Riga dopo la fine'), D18: n(999999) };
  const wb = { SheetNames: ['BUDGET'], Sheets: { BUDGET: ws } };
  assert.equal(eMasterBudget(wb), true);
  assert.equal(eMasterBudget({ SheetNames: ['Foglio1'], Sheets: { Foglio1: {} } }), false);
  const { righe, avvisi, totaleLordo } = leggiMasterBudget(wb);
  assert.deepEqual(righe.map((r) => [r.nome, r.sezione, r.tipo, r.voce, r.costo]), [
    ['Soggetto', 'SOPRA LINEA', 'fattura', 'A.1.1', 10000],
    ['Regista', 'SOPRA LINEA', 'paga', 'A.2.1', 13100],
    ['Protagonista', 'Attori Principali', 'fattura', 'A.3.1', 10000],
    ['Aiuto regista (×2)', 'REPARTO REGIA', 'paga', 'A.4.2', 6426.15],
    ['Hotel + Vitto', 'VITTO E ALLOGGIO', 'fattura', 'A.4.17', 10000],
    ['Noleggio — attrezzatura audio', 'ATTREZZATURA AUDIO', 'fattura', 'A.4.16', 1000],
    ['Producer fee', 'Producer fee', 'fee', 'A.9.1', 20000],
  ]);
  assert.equal(totaleLordo, 71180);
  assert.deepEqual(avvisi, []);

  const t = totaliPreventivo(righe.map((r) => ({ ...r, quota: r.voce === 'A.4.17' ? 100 : 50 })));
  assert.equal(t.costoProduzione, 70526.15);
  assert.equal(t.producerFee, 20000);
  assert.equal(t.feeAmmissibile, 5289.46, 'fee ammissibile fino al 7,5% del costo di produzione');
  assert.equal(t.costoAmmissibile, 55815.61);
  assert.equal(t.spesaSicilia, 32907.81, 'quote per riga più metà della fee ammissibile');
  assert.equal(t.sopraLinea, 33100);
  assert.ok(t.avvisi.some((a) => a.includes('non sono ammissibili')));
  assert.deepEqual(datiDalPreventivo(t), { costoProduzione: 70526, costoAmmissibile: 55816, spesaSicilia: 32908, producerFee: 20000 });
  const csv = csvModuloIII(t);
  assert.ok(csv.includes('"A.9.2";"Ulteriore producer fee (non ammissibile)";"14710,54"') && csv.includes('"B.";"TOTALE COSTO AMMISSIBILE";"55815,61";"32907,81"'));
  assert.equal(totaliPreventivo([]).costoProduzione, 0);

  // il file .xlsx vero passa da SheetJS: le formule restano leggibili
  const foglio = XLSX.utils.aoa_to_sheet([['SOPRA LINEA'], ['UN.', 'Denominazione', null, 'LORDO FATTURA'], [null, 'Soggetto', null, 1000]]);
  foglio.F3 = { t: 'n', v: 0, f: 'N(D3)/1.25' }; foglio['!ref'] = 'A1:F3';
  const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, foglio, 'BUDGET');
  const riletto = XLSX.read(XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }));
  assert.equal(leggiMasterBudget(riletto).righe[0].costo, 800);
});

test('condizioni di produzione dallo spoglio e dal dossier', async () => {
  const sp = await spoglioDiProva();
  const p = { categoriaId: 'film', dati: { ...datiVuoti(), piano: [{ voce: '1.2', etichetta: 'Tax credit', importo: 1 }, { voce: '3.1', etichetta: 'Coproduttore estero', importo: 1 }] }, produzione: { spoglio: sp } };
  const c = condizioniProduzione(p, B);
  assert.deepEqual(c.acqua.scene, ['3']);
  assert.deepEqual(c.animali.scene, ['3']);
  assert.deepEqual(c.droni.scene, ['3']);
  assert.deepEqual(c.minori.scene, ['4']);
  assert.deepEqual(c.notturne.scene, ['4']);
  assert.ok(c.tax_credit && c.coproduzione && c.estero && c.green && c.contributi_pubblici);
  assert.ok(!c.armi && !c.musica);
  const senza = condizioniProduzione({ categoriaId: 'documentario', dati: datiVuoti() }, B);
  assert.deepEqual(Object.keys(senza), ['contributi_pubblici']);
  assert.ok(condizioniProduzione({ categoriaId: 'film', dati: { ...datiVuoti(), piano: [{ voce: '1.2', importo: 1 }] } }, null).contributi_pubblici, 'il tax credit porta con sé gli obblighi dei contributi pubblici');
});

test('adempimenti: elenco coerente con le condizioni riconosciute', async () => {
  const { ADEMPIMENTI } = await import('../app/js/core/adempimenti.js');
  const { CONDIZIONI } = await import('../app/js/core/condizioni.js');
  const note = new Set([...CONDIZIONI.map((c) => c[0]), 'tax_credit', 'coproduzione', 'estero', 'contributi_pubblici', 'green']);
  const voci = ADEMPIMENTI.fasi.flatMap((f) => f.voci);
  assert.ok(voci.length >= 35);
  assert.equal(new Set(voci.map((v) => v.id)).size, voci.length, 'identificativi unici');
  for (const v of voci) {
    assert.ok(v.titolo && v.cosa, `voce ${v.id} completa`);
    for (const c of [].concat(v.condizione || [])) assert.ok(note.has(c), `condizione «${c}» della voce ${v.id} riconosciuta dal programma`);
    if (v.link) assert.ok(v.link.startsWith('https://'), `fonte di ${v.id}`);
  }
});
