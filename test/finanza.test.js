import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  arrot, ripartisci, gruppoFonte, normalizzaVoce, chiaviRighe, copiaPiano, strutturaPiano, controlliPiano, creaScenario, pianiUguali,
  confrontaScenari, differenzePiano, pianoDaScenario, operaDifficile, limiteAiuti, intensitaAiuti, effettoAiuti, contaComeAiuto,
  categoriaDifficileProposta, scaglioniTaxCredit, calcolaTaxCredit, pianoConTaxCredit, operaTaxCreditProposta, vociTaxCreditDaPreventivo,
  aggiungiMesi, differenzaMesi, etichettaMese, meseDaData, mesiDaGiorni, calendarioProposto, calendarioInUso, tappeCalendario,
  distribuisciUscite, curvaDaPreventivo, tempisticaProposta, quoteBandoProposte, quoteSenzaAnticipo, incassiFonte, pianoDiCassa, csvCassa,
  condizioniRecupero, cascataRecupero, puntoDiPareggio, scenariRecupero, recuperoDalPiano, indicatori, giudizioPiano, finanzaVuota, preparaFinanza,
  preventivoDelDossier,
} from '../app/js/core/finanza.js';
import { REGOLE, FONTI, elencoRegole, regola, statoRegola, avvertenzaRegola, fonteRegola, regoleIncerte, AGGIORNATO_AL } from '../app/js/core/finanza-regole.js';
import { totaliPreventivo } from '../app/js/core/preventivo.js';

// Piano d'invenzione, come il dossier d'esempio
const PIANO = [
  { voce: '1.1', etichetta: 'Contributo richiesto con questo bando', denominazione: '', importo: 120000, documento: 'nessuno' },
  { voce: '1.2', etichetta: 'Tax credit', denominazione: '', importo: 100000, documento: 'nessuno' },
  { voce: '2.1', etichetta: 'Apporto societario diretto', denominazione: '', importo: 80000, documento: 'referenze' },
  { voce: '2.2', etichetta: 'Produttori indipendenti', denominazione: 'Coproduttore d’invenzione', importo: 110000, documento: 'contratto' },
  { voce: '5.2', etichetta: 'Prevendite Italia — Free TV', denominazione: 'Emittente d’invenzione', importo: 60000, documento: 'deal_memo' },
];
const DATI = {
  durataMin: 100,
  giorni: { prepTot: 30, ripreseTot: 28, postTot: 60 },
  economici: { costoProduzione: 470000, costoAmmissibile: 460000, contributoRichiesto: 120000, spesaSicilia: 270000, producerFee: 30000 },
  piano: PIANO,
};
const somma = (a) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;

/* ------------------------------------------------------------------ regole */

test('regole: ogni costante ha valore, descrizione e una fonte esistente, o è dichiarata indicativa', () => {
  const tutte = elencoRegole();
  assert.ok(tutte.length > 80);
  for (const r of tutte) {
    assert.ok(r.descrizione, r.percorso);
    if (r.fonte == null) assert.ok(r.indicativo && r.daVerificare, `${r.percorso}: senza fonte deve essere indicativa e da verificare`);
    else assert.ok(FONTI[r.fonte], `${r.percorso}: fonte ${r.fonte} sconosciuta`);
  }
  assert.match(AGGIORNATO_AL, /^\d{4}-\d{2}-\d{2}$/);
});

test('regole: aliquote e tetti del D.I. 281/2026', () => {
  assert.equal(regola('taxCredit.aliquote.film').valore, 30);
  assert.equal(regola('taxCredit.aliquote.animazione').valore, 35);
  assert.equal(regola('taxCredit.massimali.perOperaCinema').valore, 4000000);
  assert.equal(regola('taxCredit.base.sopraLaLineaMaxPct').valore, 25);
  assert.equal(regola('aiuti.limiteGeneralePct').valore, 50);
  assert.equal(regola('non.esiste'), null);
});

test('regole: stato, avvertenza e fonte leggibile', () => {
  assert.equal(statoRegola(REGOLE.recupero.premioInvestitoriPct), 'indicativo');
  assert.equal(avvertenzaRegola(REGOLE.recupero.premioInvestitoriPct), 'valore indicativo di mercato');
  assert.equal(statoRegola(REGOLE.taxCredit.tempi.animazioneMesiAggiuntivi), 'da_verificare');
  assert.equal(avvertenzaRegola(REGOLE.taxCredit.tempi.animazioneMesiAggiuntivi), 'da verificare con il commercialista');
  assert.equal(avvertenzaRegola(REGOLE.taxCredit.aliquote.film), '');
  assert.equal(statoRegola(REGOLE.taxCredit.aliquote.aliquotePrecedenti), 'da_verificare');
  const f = fonteRegola(REGOLE.taxCredit.aliquote.film);
  assert.equal(f.breve, FONTI.CONS.breve);
  assert.match(f.articolo, /art\. 13/);
  assert.equal(fonteRegola(REGOLE.recupero.premioInvestitoriPct), null);
  assert.ok(regoleIncerte().every((r) => !r.storico));
  assert.ok(regoleIncerte(true).some((r) => r.storico));
});

/* ------------------------------------------------------------------ utilità */

test('arrot e ripartisci: centesimi esatti, somma che torna', () => {
  assert.equal(arrot(1.005), 1.01);
  assert.equal(arrot(-1.005), -1.01);
  assert.equal(arrot(null), null);
  assert.equal(arrot(0.1 + 0.2), 0.3);
  const parti = ripartisci(100, [1, 1, 1]);
  assert.deepEqual(parti, [33.33, 33.33, 33.34]);
  assert.equal(somma(ripartisci(1000.01, [3, 0, 7])), 1000.01);
  assert.deepEqual(ripartisci(100, [0, 0]), [0, 0]);
  assert.deepEqual(ripartisci(0, [1, 2]), [0, 0]);
  assert.deepEqual(ripartisci(10, [1, 0]), [10, 0]); // il resto non finisce su un peso nullo
});

/* ------------------------------------------------------------------ 1. piano */

test('gruppi delle fonti secondo il Modulo III', () => {
  assert.equal(gruppoFonte('1.1'), 'pubblico');
  assert.equal(gruppoFonte('1,2 '), 'pubblico');
  assert.equal(gruppoFonte('2.1'), 'proprio');
  assert.equal(gruppoFonte('2.6'), 'proprio');
  assert.equal(gruppoFonte('2.4'), 'coproduzioni');
  assert.equal(gruppoFonte('3.1'), 'coproduzioni');
  assert.equal(gruppoFonte('4.2'), 'terzi');
  assert.equal(gruppoFonte('5.1'), 'mercato');
  assert.equal(gruppoFonte('8.1'), 'mercato');
  assert.equal(gruppoFonte('9.1'), 'altro');
  assert.equal(gruppoFonte(''), 'altro');
  assert.equal(normalizzaVoce(' 1,2 '), '1.2');
  assert.deepEqual(chiaviRighe([{ voce: '2.2' }, { voce: '2.2' }, { voce: '' }]), ['2.2#0', '2.2#1', '?#0']);
});

test('struttura del piano: gruppi, scoperto, eccedenza, quadratura', () => {
  const s = strutturaPiano(PIANO, 470000);
  assert.equal(s.totale, 470000);
  assert.equal(s.quadra, true);
  assert.equal(s.scoperto, 0);
  const g = Object.fromEntries(s.gruppi.map((x) => [x.id, x.importo]));
  assert.deepEqual(g, { pubblico: 220000, proprio: 80000, coproduzioni: 110000, mercato: 60000, terzi: 0, altro: 0 });
  assert.equal(arrot(s.gruppi[0].sulCosto, 2), 46.81);
  const corto = strutturaPiano(PIANO, 500000);
  assert.equal(corto.scoperto, 30000);
  assert.equal(corto.quadra, false);
  assert.equal(strutturaPiano(PIANO, 400000).eccedenza, 70000);
  assert.equal(strutturaPiano(PIANO, 400000).coperto, 100);
});

test('struttura del piano: costo nullo e piano vuoto', () => {
  const vuoto = strutturaPiano([], 470000);
  assert.equal(vuoto.totale, 0);
  assert.equal(vuoto.scoperto, 470000);
  assert.ok(vuoto.gruppi.every((g) => g.sulPiano == null));
  const senzaCosto = strutturaPiano(PIANO, 0);
  assert.equal(senzaCosto.costo, null);
  assert.equal(senzaCosto.scoperto, null);
  assert.equal(senzaCosto.quadra, false);
  assert.equal(strutturaPiano(null, null).righe, 0);
  // righe senza importo o negative non contano
  assert.equal(strutturaPiano([{ voce: '1.1', importo: null }, { voce: '2.1', importo: -5 }], 10).righe, 0);
});

test('controlli del piano', () => {
  assert.deepEqual(controlliPiano(DATI).map((c) => c.id), ['quadra']);
  const scoperto = controlliPiano({ ...DATI, economici: { ...DATI.economici, costoProduzione: 500000, contributoRichiesto: 100000 }, piano: [...PIANO, { voce: 'x', importo: 10 }] });
  assert.deepEqual(scoperto.map((c) => c.id), ['scoperto', 'voce11', 'codici']);
  assert.equal(scoperto[0].esito, 'critico');
  assert.deepEqual(controlliPiano({ economici: {}, piano: [] }).map((c) => c.id), ['costo', 'vuoto']);
});

test('scenari: copia indipendente, confronto e differenze', () => {
  const sc = creaScenario('  Più prevendite ', PIANO, { id: 's1' });
  assert.equal(sc.nome, 'Più prevendite');
  sc.piano[4].importo = 90000;
  assert.equal(PIANO[4].importo, 60000, 'lo scenario non tocca il piano del dossier');
  assert.equal(creaScenario('', []).nome, 'Scenario');
  assert.equal(pianiUguali(PIANO, copiaPiano(PIANO)), true);
  assert.equal(pianiUguali(PIANO, sc.piano), false);
  const confronto = confrontaScenari(DATI, [sc]);
  assert.equal(confronto.length, 2);
  assert.equal(confronto[0].attuale, true);
  assert.equal(confronto[1].scarto, 30000);
  assert.equal(confronto[1].eccedenza, 30000);
  assert.equal(confronto[1].gruppi.mercato, 90000);
  assert.deepEqual(differenzePiano(PIANO, sc.piano), [{ voce: '5.2', etichetta: 'Prevendite Italia — Free TV', base: 60000, altro: 90000, scarto: 30000 }]);
  const applicato = pianoDaScenario({ piano: [...sc.piano, { voce: '4.1', importo: 0 }] });
  assert.equal(applicato.length, 5, 'le righe a zero non passano nel dossier');
  assert.equal(confrontaScenari(DATI, []).length, 1);
});

test('copiaPiano conserva la scelta «conta come aiuto» e ripulisce i campi', () => {
  const c = copiaPiano([{ voce: '2,4', importo: '10', aiuto: true, extra: 1 }]);
  assert.deepEqual(c, [{ voce: '2.4', etichetta: '', denominazione: '', importo: null, documento: 'nessuno', aiuto: true }]);
});

/* ------------------------------------------------------------------ 2. aiuti */

test('opera difficile: d’ufficio sotto soglia, dichiarata dagli esperti, altrimenti no', () => {
  assert.equal(operaDifficile({ categoria: 'documentario', costo: 900000 }).automatica, true);
  assert.equal(operaDifficile({ categoria: 'documentario', costo: 1000000 }).difficile, false, 'la soglia è «inferiore a»');
  assert.equal(operaDifficile({ categoria: 'opera_prima', costo: 3499999 }).difficile, true);
  assert.equal(operaDifficile({ categoria: 'opera_prima', costo: 3500000 }).difficile, false);
  assert.equal(operaDifficile({ categoria: 'cortometraggio', costo: 150000 }).soglia, 200000);
  assert.equal(operaDifficile({ categoria: 'opera_prima', costo: null }).difficile, false);
  assert.equal(operaDifficile({ categoria: 'opera_prima', costo: 5000000, dichiarata: true }).automatica, false);
  assert.equal(operaDifficile({ dichiarata: true }).difficile, true);
  assert.equal(operaDifficile().difficile, false);
  assert.equal(categoriaDifficileProposta('Documentario creativo'), 'documentario');
  assert.equal(categoriaDifficileProposta('Cortometraggio'), 'cortometraggio');
  assert.equal(categoriaDifficileProposta('Film'), '');
});

test('limite applicabile: vale il più alto tra quelli di cui si hanno i requisiti', () => {
  assert.equal(limiteAiuti().pct, 50);
  assert.equal(limiteAiuti({ coproduzione: 'ue' }).pct, 60);
  assert.equal(limiteAiuti({ categoria: 'opera_prima', costo: 1000000 }).pct, 80);
  assert.equal(limiteAiuti({ coproduzione: 'ue', categoria: 'opera_prima', costo: 1000000 }).id, 'difficile');
  assert.equal(limiteAiuti({ coproduzione: 'dac', categoria: 'opera_prima', costo: 1000000 }).pct, 100);
  assert.equal(limiteAiuti({ categoria: 'opera_prima', costo: 9000000 }).pct, 50);
});

test('intensità degli aiuti: rapporto, margine, stato e scelta riga per riga', () => {
  const a = intensitaAiuti({ piano: PIANO, costo: 470000 });
  assert.equal(a.aiuti, 220000);
  assert.equal(arrot(a.intensita, 2), 46.81);
  assert.equal(a.limiteEuro, 235000);
  assert.equal(a.margine, 15000);
  assert.equal(a.stato, 'vicino');
  assert.equal(intensitaAiuti({ piano: PIANO, costo: 470000, limitePct: 80 }).stato, 'ok');
  const oltre = intensitaAiuti({ piano: PIANO, costo: 400000 });
  assert.equal(oltre.stato, 'superato');
  assert.equal(oltre.margine, -20000);
  // la riga 2.4 (emittente pubblica) messa a mano tra gli aiuti; la 1.2 tolta
  const scelte = [...PIANO.map((r) => (r.voce === '1.2' ? { ...r, aiuto: false } : r)), { voce: '2.4', importo: 50000, aiuto: true }];
  const b = intensitaAiuti({ piano: scelte, costo: 520000 });
  assert.equal(b.aiuti, 170000);
  assert.equal(b.righe.filter((r) => r.modificato).length, 2);
  assert.equal(contaComeAiuto({ voce: '1.4' }), true);
  assert.equal(contaComeAiuto({ voce: '1.4', aiuto: false }), false);
  // costo nullo e piano vuoto
  const nulla = intensitaAiuti({ piano: PIANO, costo: 0 });
  assert.equal(nulla.intensita, null);
  assert.equal(nulla.stato, 'nd');
  assert.equal(nulla.margine, null);
  assert.equal(intensitaAiuti({ piano: [], costo: 100 }).intensita, 0);
  // esattamente sul limite: non superato
  assert.equal(intensitaAiuti({ piano: [{ voce: '1.1', importo: 50 }], costo: 100 }).stato, 'vicino');
});

test('effetto del contributo del bando e del tax credit', () => {
  const e = effettoAiuti({ piano: PIANO, costo: 470000, taxCreditStimato: 132000 });
  assert.equal(e.altri, 0);
  assert.equal(e.bando, 120000);
  assert.equal(e.taxCredit, 100000);
  assert.deepEqual(e.passi.map((x) => x.cumulato), [0, 120000, 220000]);
  assert.equal(e.passi[2].stato, 'vicino');
  assert.equal(e.massimoBando, 135000);
  assert.equal(e.massimoTaxCredit, 115000);
  assert.equal(e.conStima.cumulato, 252000);
  assert.equal(e.conStima.stato, 'superato');
  assert.equal(effettoAiuti({ piano: PIANO, costo: null }).massimoBando, null);
});

/* ------------------------------------------------------------------ 3. tax credit */

test('tax credit: film indipendente, costo eleggibile e credito al 30%', () => {
  const r = calcolaTaxCredit({ costoComplessivo: 470000, producerFee: 30000, speseGenerali: 10000, sopraLaLinea: 100000 });
  assert.equal(r.costoEleggibile, 430000);
  assert.equal(r.aliquota, 30);
  assert.equal(r.credito, 129000);
  assert.equal(r.quote.dopoPreventiva, 90300);
  assert.equal(r.quote.dopoDefinitiva, 38700);
  assert.equal(r.controlli.find((c) => c.id === 'sopra').esito, 'ok');
  assert.equal(r.sopra.limitePct, 30, 'sotto i 3,5 milioni il limite del sopra la linea è il 30%');
});

test('tax credit: sopra la linea e oneri oltre il limite non sono eleggibili', () => {
  const r = calcolaTaxCredit({ costoComplessivo: 4000000, sopraLaLinea: 1200000, oneri: 400000 });
  assert.equal(r.sopra.limitePct, 25);
  assert.equal(r.sopra.eccedente, 200000);
  assert.equal(r.oneri.eccedente, 100000);
  assert.equal(r.costoEleggibile, 3700000);
  assert.equal(r.credito, 1110000);
  assert.equal(r.controlli.find((c) => c.id === 'sopra').esito, 'attenzione');
  assert.ok(r.controlli.some((c) => c.id === 'oneri'));
  // sopra la linea non indicato: resta da confermare
  assert.equal(calcolaTaxCredit({ costoComplessivo: 1000000 }).controlli.find((c) => c.id === 'sopra').esito, 'da_verificare');
});

test('tax credit: tetti per opera, con risorse estere e annuo d’impresa', () => {
  const grande = calcolaTaxCredit({ costoComplessivo: 20000000 });
  assert.equal(grande.creditoTeorico, 6000000);
  assert.equal(grande.credito, 4000000);
  assert.equal(grande.limitatoDa, 'opera');
  const estere = calcolaTaxCredit({ costoComplessivo: 20000000, risorseEsterePct: 40 });
  assert.equal(estere.credito, 6000000);
  assert.equal(estere.limitatoDa, null);
  const anno = calcolaTaxCredit({ costoComplessivo: 10000000, creditiAnno: 5000000 });
  assert.equal(anno.residuoAnnuo, 2000000);
  assert.equal(anno.credito, 2000000);
  assert.equal(anno.limitatoDa, 'anno');
  assert.equal(calcolaTaxCredit({ opera: 'tv', costoComplessivo: 50000000 }).tettoOpera, 7000000);
});

test('tax credit: scaglioni delle imprese ad elevata capacità', () => {
  const film = calcolaTaxCredit({ costoComplessivo: 12000000, impresa: 'elevata' });
  // 5 M al 30% + 5 M al 25% + 2 M al 20% = 1,5 + 1,25 + 0,4 = 3,15 M
  assert.equal(film.creditoTeorico, 3150000);
  assert.equal(film.scaglioni.length, 3);
  assert.equal(film.quote.preventivaPct, 40);
  const tv = scaglioniTaxCredit({ opera: 'tv', impresa: 'elevata', maggiorata: true });
  assert.deepEqual(tv.fasce.map((f) => f.pct), [30, 25, 20]);
  const doc = scaglioniTaxCredit({ opera: 'documentario_tv', impresa: 'elevata', seriale: true });
  assert.equal(doc.fasce[1].da, 600000);
  assert.equal(scaglioniTaxCredit({ opera: 'animazione_cinema' }).fasce[0].pct, 35);
  // fascia oltre l'ultimo scaglione senza base: eliminata
  assert.equal(calcolaTaxCredit({ costoComplessivo: 1000000, impresa: 'elevata' }).scaglioni.length, 1);
});

test('tax credit: non indipendenti, cortometraggi, videoclip, costo nullo', () => {
  const ni = calcolaTaxCredit({ costoComplessivo: 20000000, impresa: 'non_indipendente' });
  assert.equal(ni.aliquota, 20);
  assert.equal(ni.tettoAnnuo, 3000000);
  assert.equal(ni.credito, 3000000);
  const niTv = calcolaTaxCredit({ opera: 'tv', costoComplessivo: 1000000, impresa: 'non_indipendente' });
  assert.equal(niTv.ammessa, false);
  assert.equal(niTv.credito, 0);
  assert.equal(niTv.controlli[0].esito, 'critico');
  const corto = calcolaTaxCredit({ opera: 'cortometraggio', costoComplessivo: 300000 });
  assert.equal(corto.costoEleggibile, 200000);
  assert.equal(corto.credito, 60000);
  assert.equal(calcolaTaxCredit({ opera: 'videoclip', costoComplessivo: 500000 }).credito, 80000);
  const zero = calcolaTaxCredit({ costoComplessivo: 0 });
  assert.equal(zero.valido, false);
  assert.equal(zero.credito, 0);
  assert.equal(zero.aliquotaEffettiva, null);
  assert.equal(calcolaTaxCredit().valido, false);
});

test('tax credit: copertura minima, partecipazione del produttore, cumulo, durata', () => {
  const r = calcolaTaxCredit({ costoComplessivo: 1000000, coperturaSenzaCredito: 350000, apportoProduttore: 100000, altriAiuti: 300000, durataMin: 50 });
  const c = Object.fromEntries(r.controlli.map((x) => [x.id, x]));
  assert.equal(r.credito, 300000);
  assert.equal(c.copertura.esito, 'attenzione', 'il 35% è sotto il 40% richiesto ai film');
  assert.equal(c.partecipazione.esito, 'da_verificare');
  assert.equal(c.cumulo.esito, 'critico');
  assert.equal(r.creditoCompatibile, 200000);
  assert.equal(c.durata.esito, 'critico');
  const doc = calcolaTaxCredit({ opera: 'documentario_cinema', costoComplessivo: 1000000, coperturaSenzaCredito: 300000 });
  assert.equal(doc.controlli.find((x) => x.id === 'copertura').esito, 'ok');
  const tv = calcolaTaxCredit({ opera: 'tv', costoComplessivo: 100000, durataMin: 100 });
  assert.ok(tv.controlli.some((x) => x.id === 'costo_minuto'));
});

test('tax credit nel piano: aggiorna la voce 1.2 o la aggiunge dopo le voci pubbliche', () => {
  const aggiornato = pianoConTaxCredit(PIANO, 132000.4);
  assert.equal(aggiornato.find((r) => r.voce === '1.2').importo, 132000);
  assert.equal(PIANO[1].importo, 100000, 'il piano passato non cambia');
  const senza = PIANO.filter((r) => r.voce !== '1.2');
  const aggiunto = pianoConTaxCredit(senza, 50000);
  assert.equal(aggiunto[1].voce, '1.2');
  assert.equal(aggiunto.length, 5);
  const doppio = pianoConTaxCredit([...PIANO, { voce: '1.2', importo: 5 }], 10);
  assert.equal(doppio.filter((r) => r.voce === '1.2').length, 1);
  assert.equal(pianoConTaxCredit([], 7)[0].voce, '1.2');
});

test('tipologia del tax credit proposta e voci dal preventivo', () => {
  assert.equal(operaTaxCreditProposta({ categoria: 'film', tipologia: 'Film di produzione cinematografica' }), 'film');
  assert.equal(operaTaxCreditProposta({ tipologia: 'Serie tv' }), 'tv');
  assert.equal(operaTaxCreditProposta({ tipologia: 'Documentario per la televisione' }), 'documentario_tv');
  assert.equal(operaTaxCreditProposta({ animazione: true }), 'animazione_cinema');
  assert.equal(operaTaxCreditProposta({ categoria: 'cortometraggi' }), 'cortometraggio');
  const tot = totaliPreventivo([
    { voce: 'A.1.1', costo: 20000, quota: 100 }, { voce: 'A.3.1', costo: 50000, quota: 100 }, { voce: 'A.4.1', costo: 300000, quota: 80 },
    { voce: 'A.7.2', costo: 9000, quota: 100 }, { voce: 'A.8.1', costo: 10000, quota: 0 }, { voce: 'A.9.1', costo: 30000, quota: 0 },
  ]);
  const v = vociTaxCreditDaPreventivo(tot);
  assert.equal(v.costoComplessivo, 419000);
  assert.equal(v.sopraLaLinea, 70000);
  assert.equal(v.oneri, 9000);
  assert.equal(v.producerFee, 30000);
  assert.equal(v.speseGenerali, 10000);
  assert.equal(vociTaxCreditDaPreventivo(null), null);
  assert.equal(preventivoDelDossier({ produzione: { preventivo: { righe: [{ voce: 'A.1.1', costo: 5 }] } } }).costoProduzione, 5);
  assert.equal(preventivoDelDossier({}), null);
});

/* ------------------------------------------------------------------ 4. cassa */

test('mesi: somma a cavallo d’anno, differenze, etichette, date', () => {
  assert.equal(aggiungiMesi('2026-11', 3), '2027-02');
  assert.equal(aggiungiMesi('2027-01', -1), '2026-12');
  assert.equal(aggiungiMesi('2026-12', 13), '2028-01');
  assert.equal(aggiungiMesi('2026-13', 1), null);
  assert.equal(differenzaMesi('2026-11', '2027-02'), 3);
  assert.equal(differenzaMesi('x', '2027-02'), null);
  assert.equal(etichettaMese('2027-01'), 'gen 2027');
  assert.equal(meseDaData('15/03/2027'), '2027-03');
  assert.equal(meseDaData('2027-04-02'), '2027-04');
  assert.equal(meseDaData('31/13/2027'), null);
  assert.equal(meseDaData(''), null);
  assert.equal(mesiDaGiorni(30), 2);
  assert.equal(mesiDaGiorni(22), 1);
  assert.equal(mesiDaGiorni(1), 1);
  assert.equal(mesiDaGiorni(0), null);
});

test('calendario: durate dai giorni, inizio dalle date del Modulo III', () => {
  const c = calendarioProposto({ giorni: DATI.giorni, oggi: '2026-11' });
  assert.deepEqual(c.mesi, { prep: 2, riprese: 2, post: 3 });
  assert.equal(c.inizio, '2026-12');
  const m3 = calendarioProposto({ giorni: DATI.giorni, modulo3: { dataInizioRiprese: '10/02/2027', dataFineRiprese: '20/04/2027' }, oggi: '2026-11' });
  assert.equal(m3.inizio, '2026-12', 'riprese a febbraio meno due mesi di preparazione');
  assert.equal(m3.mesi.riprese, 3);
  assert.equal(m3.origine.riprese, 'modulo3');
  const vuoto = calendarioProposto({});
  assert.equal(vuoto.inizio, null);
  assert.equal(vuoto.origine.prep, 'partenza');
  const inUso = calendarioInUso({ inizio: '2027-03', mesi: { prep: 1, riprese: null, post: 0 } }, c);
  assert.deepEqual(inUso, { inizio: '2027-03', mesi: { prep: 1, riprese: 2, post: 0 } });
  assert.equal(calendarioInUso({ mesi: { prep: 0, riprese: 0, post: 0 } }, c).mesi.riprese, 1, 'almeno un mese');
  assert.deepEqual(tappeCalendario({ prep: 2, riprese: 2, post: 3 }), { inizio: 0, riprese: 2, fine_riprese: 3, consegna: 7, durata: 7 });
});

test('uscite: curva per fase, fasi vuote, somma esatta', () => {
  const u = distribuisciUscite(470000, { prep: 2, riprese: 2, post: 3 });
  assert.equal(u.length, 7);
  assert.equal(somma(u), 470000);
  assert.equal(u[0], 47000);
  assert.equal(u[2], 129250);
  const senzaPost = distribuisciUscite(100, { prep: 1, riprese: 1, post: 0 });
  assert.equal(somma(senzaPost), 100);
  assert.equal(senzaPost.length, 2);
  assert.equal(somma(distribuisciUscite(1000, { prep: 1, riprese: 1, post: 1 }, { prep: 0, riprese: 0, post: 0 })), 1000);
  assert.deepEqual(distribuisciUscite(0, { prep: 1, riprese: 1, post: 1 }), [0, 0, 0]);
  const curva = curvaDaPreventivo([{ id: 1, importo: 100 }, { id: 6, importo: 100 }]);
  assert.deepEqual(curva, { prep: 50, riprese: 0, post: 50 });
  assert.equal(curvaDaPreventivo([]), null);
  assert.deepEqual(curvaDaPreventivo([{ id: 1, importo: 100 }], { 1: { prep: 0, riprese: 100, post: 0 } }), { prep: 0, riprese: 100, post: 0 });
});

test('entrate: tempistiche proposte, quote del bando, tax credit', () => {
  assert.deepEqual(tempisticaProposta('1.1'), { tipo: 'quote', ritardo: 0 });
  assert.equal(tempisticaProposta('1.2').tipo, 'tax_credit');
  assert.equal(tempisticaProposta('2.1').tipo, 'inizio');
  assert.equal(tempisticaProposta('2.2').tipo, 'lavorazione');
  assert.equal(tempisticaProposta('5.2').tipo, 'consegna');
  const q = quoteBandoProposte({ erogazione: [{ quota: 'Anticipo (facoltativo)', percentuale: 60 }, { quota: 'Seconda quota', percentuale: 30 }, { quota: 'Saldo', percentuale: 10 }] });
  assert.equal(q.origine, 'bando');
  assert.deepEqual(q.quote.map((x) => [x.momento, x.ritardo]), [['riprese', 0], ['consegna', 3], ['consegna', 9]]);
  assert.equal(quoteBandoProposte({ erogazione: [{ quota: 'Anticipo', percentuale: 50 }] }).origine, 'partenza', 'quote che non fanno 100: tutto a saldo');
  assert.equal(quoteBandoProposte(null).quote[1].pct, 100);
  assert.deepEqual(quoteSenzaAnticipo(q.quote).map((x) => x.pct), [0, 90, 10]);
  const tappe = tappeCalendario({ prep: 2, riprese: 2, post: 3 });
  assert.deepEqual(incassiFonte(100000, { tipo: 'tax_credit' }, tappe), [[5, 70000], [13, 30000]]);
  assert.deepEqual(incassiFonte(100000, { tipo: 'tax_credit' }, tappe, { taxCredit: { primaPct: 40, assorbimento: 2 } }), [[5, 20000], [6, 20000], [13, 30000], [14, 30000]]);
  assert.deepEqual(incassiFonte(100, { tipo: 'consegna', ritardo: 2 }, tappe), [[9, 100]]);
  assert.deepEqual(incassiFonte(100, { tipo: 'escluso' }, tappe), []);
  assert.deepEqual(incassiFonte(0, { tipo: 'inizio' }, tappe), []);
  assert.equal(somma(incassiFonte(100, { tipo: 'lavorazione' }, tappe).map((x) => x[1])), 100);
});

test('piano di cassa: saldo, punta di fabbisogno, finanziamento ponte, mesi a cavallo d’anno', () => {
  const calendario = { inizio: '2026-12', mesi: { prep: 2, riprese: 2, post: 3 } };
  const quote = quoteBandoProposte({ erogazione: [{ quota: 'Anticipo', percentuale: 60 }, { quota: 'Seconda quota', percentuale: 30 }, { quota: 'Saldo', percentuale: 10 }] }).quote;
  const c = pianoDiCassa({ costo: 470000, piano: PIANO, calendario, quote, tasso: 7, commissione: 1 });
  assert.equal(c.totali.uscite, 470000);
  assert.equal(c.totali.entrate, 470000);
  assert.equal(c.totali.saldo, 0);
  assert.equal(c.mesi[0].etichetta, 'dic 2026');
  assert.equal(c.mesi[1].etichetta, 'gen 2027');
  assert.equal(c.mesi.at(-1).cumulato, 0);
  assert.equal(c.punta.importo, 161095.22);
  assert.equal(c.punta.mese, 'apr 2027');
  assert.equal(c.primoRosso, 'feb 2027');
  // interessi: somma dei saldi negativi × 7% ÷ 12, mese per mese
  const attesi = c.mesi.reduce((a, m) => a + (m.cumulato < 0 ? Math.round((-m.cumulato * 7) / 12) / 100 : 0), 0);
  assert.ok(Math.abs(c.ponte.interessi - attesi) < 0.05);
  assert.equal(c.ponte.commissione, 1610.95);
  assert.equal(c.ponte.costo, arrot(c.ponte.interessi + 1610.95));
  // senza anticipo la punta cresce
  const senza = pianoDiCassa({ costo: 470000, piano: PIANO, calendario, quote: quoteSenzaAnticipo(quote) });
  assert.ok(senza.punta.importo > c.punta.importo);
  assert.equal(senza.ponte.costo, 0, 'senza tasso nessun interesse');
  // fonte esclusa dalla cassa
  const escluso = pianoDiCassa({ costo: 470000, piano: PIANO, calendario, quote, tempi: { '5.2#0': { tipo: 'escluso' } } });
  assert.equal(escluso.nonIncassato, 60000);
  assert.equal(escluso.totali.saldo, -60000);
});

test('piano di cassa: costo nullo, piano vuoto, nessun calendario', () => {
  const vuota = pianoDiCassa({ costo: 0, piano: [], calendario: { inizio: null, mesi: { prep: 1, riprese: 1, post: 1 } } });
  assert.equal(vuota.mesi.length, 4);
  assert.equal(vuota.punta.importo, 0);
  assert.equal(vuota.punta.mese, null);
  assert.equal(vuota.mesi[0].etichetta, 'Mese 1');
  const soloUscite = pianoDiCassa({ costo: 300, piano: [], calendario: { mesi: { prep: 1, riprese: 1, post: 1 } } });
  assert.equal(soloUscite.punta.importo, 300);
  assert.equal(soloUscite.mesiInRosso, 4);
  assert.equal(pianoDiCassa().mesi.length > 0, true);
});

test('CSV del piano di cassa: separatore, decimali italiani, totali', () => {
  const c = pianoDiCassa({ costo: 1000, piano: [{ voce: '2.1', etichetta: 'Apporto "diretto"', importo: 1000 }], calendario: { inizio: '2026-12', mesi: { prep: 1, riprese: 1, post: 0 } }, tasso: 6 });
  const testo = csvCassa(c);
  assert.ok(testo.startsWith('﻿'));
  const righe = testo.slice(1).split('\r\n');
  assert.match(righe[0], /"Entrata: 2\.1 Apporto ""diretto"""/);
  assert.match(righe[1], /^"dic 2026";"Preparazione";"266,67";"1000,00"/);
  assert.match(righe.at(-1), /^"Totale";"";"1000,00";"1000,00"/);
});

/* ------------------------------------------------------------------ 5. recupero */

test('recupero: condizioni dall’utente, dal piano, poi indicative', () => {
  const c = condizioniRecupero({}, [...PIANO, { voce: '7.1', importo: 40000 }, { voce: '4.1', importo: 20000 }]);
  assert.equal(c.quotaNoleggioPct, 45);
  assert.equal(c.commissioneSalaPct, 27.5);
  assert.equal(c.minimoGarantito, 40000);
  assert.equal(c.investitori, 20000);
  assert.equal(c.daRecuperare, 80000);
  const s = condizioniRecupero({ quotaNoleggioPct: 120, minimoGarantito: 0, premioPct: -3 }, PIANO);
  assert.equal(s.quotaNoleggioPct, 100);
  assert.equal(s.minimoGarantito, 0);
  assert.equal(s.premioPct, 0);
  assert.deepEqual(recuperoDalPiano([]), { minimoGarantito: 0, investitori: 0, differiti: 0, daRecuperare: 0 });
});

test('cascata di recupero: ordine dei passaggi e importi', () => {
  const c = { ...condizioniRecupero({}, []), quotaNoleggioPct: 50, commissioneSalaPct: 20, commissioneVenditePct: 10, speseLancio: 10000, minimoGarantito: 20000, debiti: 5000, investitori: 10000, premioPct: 20, differiti: 3000, quotaProduttorePct: 60, daRecuperare: 10000 };
  const r = cascataRecupero({ sala: 200000, tv: 50000 }, c);
  assert.equal(r.lordo, 250000);
  assert.equal(r.esercenti, 100000);
  assert.equal(r.commissioneSala, 20000);
  assert.equal(r.commissioneVendite, 5000);
  assert.equal(r.netto, 125000);
  assert.equal(r.lancio, 10000);
  assert.equal(r.minimoGarantito, 20000);
  assert.equal(r.debiti, 5000);
  assert.equal(r.investitori, 12000);
  assert.equal(r.differiti, 3000);
  assert.equal(r.daDividere, 75000);
  assert.equal(r.produttore, 45000);
  assert.equal(r.coproduttori, 30000);
  assert.equal(r.risultato, 35000);
  assert.equal(r.inPareggio, true);
  // ricavi bassi: i passaggi a valle restano a zero e si segnala il non recuperato
  const poco = cascataRecupero({ sala: 20000 }, c);
  assert.equal(poco.netto, 8000);
  assert.equal(poco.lancio, 8000);
  assert.equal(poco.minimoGarantito, 0);
  assert.equal(poco.nonRecuperato.minimoGarantito, 20000);
  assert.equal(poco.produttore, 0);
  assert.equal(cascataRecupero({}, c).lordo, 0);
});

test('punto di pareggio e tre scenari', () => {
  const c = { ...condizioniRecupero({}, []), quotaNoleggioPct: 50, commissioneSalaPct: 0, commissioneVenditePct: 0, daRecuperare: 100000 };
  const p = puntoDiPareggio({ sala: 100000 }, c);
  assert.equal(p.lordo, 200000, 'con metà della sala al distributore servono 200.000 € di incasso');
  assert.equal(p.raggiunto, false);
  assert.equal(puntoDiPareggio({}, c), null, 'senza ricavi il pareggio non si calcola');
  assert.deepEqual(puntoDiPareggio({ sala: 1 }, { ...c, daRecuperare: 0 }), { fattore: 0, lordo: 0, raggiunto: true });
  assert.equal(puntoDiPareggio({ sala: 100 }, { ...c, quotaProduttorePct: 0 }), null, 'con quota del produttore nulla il pareggio è irraggiungibile');
  const s = scenariRecupero({ prudente: { sala: 50000 }, atteso: { sala: 150000 }, favorevole: { sala: 400000, estero: 50000 } }, {}, PIANO);
  assert.deepEqual(s.scenari.map((x) => x.id), ['prudente', 'atteso', 'favorevole']);
  assert.ok(s.scenari[0].produttore < s.scenari[1].produttore && s.scenari[1].produttore < s.scenari[2].produttore);
  assert.ok(s.scenari.every((x) => x.pareggio && x.pareggio.lordo > 0));
  assert.ok(Math.abs(s.scenari[0].pareggio.lordo - s.scenari[1].pareggio.lordo) <= 1, 'stesso mix di canali, stesso pareggio');
});

/* ------------------------------------------------------------------ 6. indicatori e sintesi */

test('indicatori: formule, valori e limiti del bando', () => {
  const lista = indicatori({ dati: DATI, bando: { territorio: 'Sicilia', producerFeeMaxPct: 7.5, spesaTerritorioMinPct: 150 } });
  const v = Object.fromEntries(lista.map((x) => [x.id, x]));
  assert.equal(v.costo_minuto.valore, 4700);
  assert.equal(arrot(v.costo_giorno.valore, 2), 16785.71);
  assert.equal(arrot(v.producer_fee.valore, 2), 6.38);
  assert.equal(v.producer_fee.esito, 'ok');
  assert.equal(v.spesa_contributo.valore, 225);
  assert.equal(v.spesa_contributo.esito, 'ok');
  assert.equal(v.quota_pubblica.esito, 'attenzione');
  assert.equal(arrot(v.quota_privata.valore, 2), 53.19);
  assert.ok(lista.every((x) => x.formula));
  assert.equal(v.sopra_linea.valore, null, 'senza preventivo non c’è');
  const fee = indicatori({ dati: { ...DATI, economici: { ...DATI.economici, producerFee: 40000 } }, bando: { producerFeeMaxPct: 7.5 } });
  assert.equal(fee.find((x) => x.id === 'producer_fee').esito, 'attenzione');
  const vuoti = indicatori({ dati: {} });
  assert.ok(vuoti.every((x) => x.valore == null));
});

test('indicatori con il preventivo: sopra e sotto la linea, spese generali', () => {
  const prev = totaliPreventivo([{ voce: 'A.1.1', costo: 100000 }, { voce: 'A.4.1', costo: 300000 }, { voce: 'A.8.1', costo: 50000 }, { voce: 'A.9.1', costo: 20000 }]);
  const v = Object.fromEntries(indicatori({ dati: DATI, preventivo: prev }).map((x) => [x.id, x]));
  assert.equal(arrot(v.sopra_linea.valore, 2), 21.28);
  assert.equal(arrot(v.sotto_linea.valore, 2), 63.83);
  assert.equal(v.spese_generali.esito, 'attenzione', '10,6% supera il 7,5%');
});

test('giudizio sul piano in una riga', () => {
  const struttura = strutturaPiano(PIANO, 470000);
  const g = giudizioPiano({ struttura, aiuti: intensitaAiuti({ piano: PIANO, costo: 470000 }) });
  assert.equal(g.esito, 'attenzione');
  const ok = giudizioPiano({ struttura, aiuti: intensitaAiuti({ piano: PIANO, costo: 470000, limitePct: 80 }) });
  assert.equal(ok.esito, 'ok');
  const critico = giudizioPiano({ struttura: strutturaPiano(PIANO, 600000), aiuti: intensitaAiuti({ piano: PIANO, costo: 600000 }) });
  assert.equal(critico.esito, 'critico');
  assert.equal(giudizioPiano({ struttura: strutturaPiano([], null) }).esito, 'nd');
  assert.equal(giudizioPiano({}).esito, 'nd');
});

test('dati della scheda: dossier nuovo e dossier salvati prima', () => {
  const p = {};
  const f = preparaFinanza(p);
  assert.deepEqual(f, finanzaVuota());
  const vecchio = { finanza: { scenari: 'rotto', taxCredit: { opera: 'tv' }, cassa: { mesi: { prep: 4 } } } };
  const g = preparaFinanza(vecchio);
  assert.deepEqual(g.scenari, []);
  assert.equal(g.taxCredit.opera, 'tv');
  assert.equal(g.taxCredit.impresa, 'indipendente');
  assert.equal(g.cassa.mesi.prep, 4);
  assert.equal(g.cassa.mesi.post, null);
  assert.ok(g.recupero.ricavi.atteso && 'sala' in g.recupero.ricavi.atteso);
});
