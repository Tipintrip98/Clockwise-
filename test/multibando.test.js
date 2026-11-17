// Motore multi-bando: metriche per qualunque territorio, instradamento dei documenti per famiglia di criteri,
// forma e controllo dei bandi, sovrapposizione degli aggiornamenti.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BANDO_SICILIA } from '../app/js/core/bando-sicilia.js';
import { calcolaMetriche, valutaQuantitativo, componiRisultato, verificheAmmissibilita, suggerimentiQuantitativi, stimaContributo, datiVuoti, testoValore, getGriglia } from '../app/js/core/scoring.js';
import { documentiPerSezione, famiglieSezione, TIPI } from '../app/js/core/docs.js';
import { sanificaBando, validaBando, preparaBando, finestraDiRiferimento, anniBando, urlSicuro, FAMIGLIE, METRICHE } from '../app/js/core/bandi/schema.js';
import { applicaAggiornamenti } from '../app/js/core/aggiornamenti.js';
import { guidaSezione, promptSezione, normalizzaBando, METRICHE_DISPONIBILI } from '../app/js/core/prompts.js';
import { BANDI_PREDEFINITI, SCHEDE_BANDI, catalogo } from '../app/js/core/bandi/indice.js';

// Bando d'invenzione con regole diverse dalla Sicilia: sezioni numerate, metriche in giorni ed euro, nessun minimo di sezione.
const INVENTATO = {
  id: 'atlantide-fondo-2026', revisione: '2026-11-01', nome: 'Atlantide — Fondo cinema 2026', nomeBreve: 'Atlantide 2026', ente: 'Regione Atlantide', regione: 'Atlantide', territorio: 'Atlantide', gentilizio: 'atlantidei',
  fonte: 'Avviso d’invenzione n. 1 del 01/01/2026', stato: 'aperto', tipoValutazione: 'punteggio', paginaUfficiale: 'https://esempio.invalid/fondo',
  finestre: [{ anno: 2026, dal: '2026-10-01', al: '2026-12-15' }], prossimaEdizione: { anno: 2027, periodoAtteso: 'ottobre-dicembre', base: 'cadenza annuale' },
  sogliaTotale: 60, punteggioMassimo: 100, spesaTerritorioMinSuCostoPct: 20,
  commissione: { componenti: 3, descrizione: 'Tre esperti; punteggio per consenso.' },
  categorie: [{ id: 'lungometraggi', nome: 'Lungometraggi', griglia: 'U', soglie: {}, contributo: { percentuale: 40, massimali: { 2026: 300000 } }, dotazione: { 2026: 1500000 } }],
  griglie: { U: { id: 'U', nome: 'Griglia unica', sezioni: [
    { id: '1', nome: 'Qualità', max: 50, criteri: [
      { id: 'a', nome: 'Sceneggiatura', max: 30, tipo: 'qualitativo', famiglia: 'scrittura', descrizione: 'Qualità della scrittura.' },
      { id: 'b', nome: 'Regia', max: 20, tipo: 'qualitativo', famiglia: 'visione', descrizione: 'Impianto registico.' },
    ] },
    { id: '2', nome: 'Territorio', max: 30, criteri: [
      { id: 'c', nome: 'Giorni di riprese in regione', max: 15, tipo: 'fasce', metrica: 'giorniRipreseTerritorio', peso: 1, famiglia: 'ricaduta_spesa', fasce: [{ da: 30, punti: 15, etichetta: '30 giorni o più' }, { da: 15, punti: 10, etichetta: 'Da 15 a 29' }, { da: 6, punti: 5, etichetta: 'Da 6 a 14' }, { da: 0, punti: 0, etichetta: 'Fino a 5' }] },
      { id: 'd', nome: 'Spesa in regione', max: 15, tipo: 'fasce', metrica: 'spesaTerritorioEuro', peso: 1, famiglia: 'ricaduta_spesa', fasce: [{ oltre: 500000, punti: 15, etichetta: 'Oltre 500.000 €' }, { da: 200000, punti: 8, etichetta: 'Da 200.000 €' }, { da: 0, punti: 0, etichetta: 'Meno' }] },
    ] },
    { id: '3', nome: 'Fattibilità', max: 20, criteri: [
      { id: 'e', nome: 'Piano finanziario', max: 12, tipo: 'qualitativo', famiglia: 'piano_finanziario', descrizione: 'Solidità delle coperture.' },
      { id: 'f', nome: 'Distribuzione', max: 8, tipo: 'discreto', famiglia: 'distribuzione', descrizione: 'Accordi di distribuzione.', valori: [{ punti: 8, etichetta: 'Contratto' }, { punti: 4, etichetta: 'Lettera di interesse' }, { punti: 0, etichetta: 'Nessuno' }] },
    ] },
  ] } },
  allegati: [{ tipo: 'sceneggiatura', nome: 'Sceneggiatura', obbligo: 'sempre' }],
  requisiti: [{ id: 'sede', testo: 'Sede operativa nell’Unione europea' }],
  affidabilita: { griglia: 'testo_ufficiale', citazioni: [{ riferimento: 'art. 9', testo: 'Tabella dei criteri (d’invenzione).' }], dubbi: [] },
  verifica: { esito: 'confermata', data: '2026-11-01', correzioni: [], dubbi: [] },
};

const dati = () => ({
  ...datiVuoti(), titolo: 'Prova', durataMin: 95,
  giorni: { prepTot: 20, prepSicilia: 10, ripreseTot: 30, ripreseSicilia: 18, postTot: 40, postSicilia: 0 },
  professionisti: { artTot: 10, artSicilia: 4, crewTot: 30, crewSicilia: 12 },
  economici: { costoProduzione: 1000000, costoAmmissibile: 900000, contributoRichiesto: 250000, spesaSicilia: 320000, producerFee: 50000 },
  piano: [{ voce: '1.1', etichetta: 'Contributo', denominazione: '', importo: 250000, documento: 'nessuno' }, { voce: '2.1', etichetta: 'Apporto', denominazione: '', importo: 750000, documento: 'referenze' }],
});

test('metriche: valgono per il territorio del bando in uso e hanno un’unità', () => {
  const m = calcolaMetriche(dati(), INVENTATO);
  assert.equal(m.giorniRipreseTerritorio.valore, 18);
  assert.equal(m.giorniRipreseTerritorio.unita, 'giorni');
  assert.equal(m.ripreseTerritorioPct.valore, 60);
  assert.equal(m.professionistiTerritorio.valore, 16);
  assert.equal(m.spesaTerritorioEuro.valore, 320000);
  assert.equal(m.spesaTerritorioSuCosto.valore, 32);
  assert.equal(m.contributoSuCosto.valore, 25);
  assert.match(m.lavorazioneSicilia.formula, /in Atlantide/);
  // senza bando resta una formula generica, senza nomi di regione
  assert.match(calcolaMetriche(dati()).spesaSicilia.formula, /sul territorio/);
  for (const id of Object.keys(METRICHE)) assert.ok(id in m, `metrica calcolata: ${id}`);
  assert.deepEqual(Object.keys(METRICHE_DISPONIBILI).sort(), Object.keys(METRICHE).sort());
});

test('criteri a fasce in giorni e in euro', () => {
  const griglia = getGriglia(INVENTATO, 'lungometraggi');
  const c = griglia.sezioni[1].criteri[0], d = griglia.sezioni[1].criteri[1];
  const rc = valutaQuantitativo(c, dati(), INVENTATO);
  assert.equal(rc.punti, 10);
  assert.equal(rc.valoreTesto, '18 giorni');
  assert.equal(rc.prossima.soglia, 30);
  const rd = valutaQuantitativo(d, dati(), INVENTATO);
  assert.equal(rd.punti, 8);
  assert.match(rd.valoreTesto, /320\.000/);
  // a ridosso della soglia: 29 giorni su una soglia di 30
  const vicino = dati(); vicino.giorni.ripreseSicilia = 29;
  assert.ok(valutaQuantitativo(c, vicino, INVENTATO).avvisi.some((a) => /ridosso della soglia/.test(a) && /30 giorni/.test(a)));
  assert.equal(testoValore(12.34), '12,3%');
  assert.equal(testoValore(1, 'giorni'), '1 giorno');
});

test('risultato e ammissibilità su un bando senza minimi di sezione e con spesa minima sul costo', () => {
  const ris = componiRisultato(INVENTATO, 'lungometraggi', dati(), {
    a: [{ commissario: 'x', punteggio: 24, rigoroso: 20 }], b: [{ commissario: 'x', punteggio: 15, rigoroso: 15 }],
    e: [{ commissario: 'x', punteggio: 9, rigoroso: 4 }], f: [{ commissario: 'x', punteggio: 4, rigoroso: 0 }],
  });
  assert.equal(ris.totale, 24 + 15 + 10 + 8 + 9 + 4);
  assert.equal(ris.completo, true);
  assert.equal(ris.esito, 'a_rischio'); // sopra 60 nella lettura attesa (70), sotto nella rigorosa (57)
  assert.ok(ris.sezioni.every((s) => s.soglia == null && s.superata));
  const v = verificheAmmissibilita(INVENTATO, 'lungometraggi', 2026, dati(), ['sceneggiatura']);
  const per = (id) => v.find((x) => x.id === id);
  assert.equal(per('spesa').esito, 'ok'); // 32% del costo, minimo 20%
  assert.equal(per('fee'), undefined); // il bando non fissa un tetto alla producer fee
  assert.equal(per('contributo').esito, 'ok'); // 250.000 ≤ min(40% del costo, 300.000)
  const poco = dati(); poco.economici.spesaSicilia = 100000;
  assert.equal(verificheAmmissibilita(INVENTATO, 'lungometraggi', 2026, poco, []).find((x) => x.id === 'spesa').esito, 'critico');
  // suggerimenti con il nome del territorio e le unità giuste
  const s = suggerimentiQuantitativi(INVENTATO, 'lungometraggi', dati());
  assert.ok(s.some((x) => /in Atlantide/.test(x.azione) && /30 giorni/.test(x.azione)));
  assert.ok(s.some((x) => /500\.000/.test(x.azione)));
});

test('contributo: proporzionale al primo solo dove il bando lo prevede', () => {
  assert.equal(stimaContributo(100000, 80, 100, 'proporzionale_al_primo'), 80000);
  assert.equal(stimaContributo(100000, 80, 100, 'pieno'), 100000);
  assert.equal(stimaContributo(null, 80, 100, 'pieno'), null);
  assert.equal(BANDO_SICILIA.regolaContributo, 'proporzionale_al_primo');
});

test('documenti per sezione: le famiglie dei criteri danno alla Sicilia gli stessi documenti di prima', () => {
  const documenti = TIPI.map((t) => ({ nome: t.id, tipo: t.id, testo: 'x' }));
  const tipi = (sez) => documentiPerSezione(documenti, sez).map((d) => d.tipo);
  const g = BANDO_SICILIA.griglie.A;
  const sez = (id) => g.sezioni.find((s) => s.id === id);
  assert.deepEqual(tipi(sez('A')), ['modulo2', 'sceneggiatura', 'piano_lavorazione']);
  assert.deepEqual(tipi(sez('B')), ['modulo2', 'modulo3', 'cv_societa', 'cv_regista', 'cv_autori', 'cv_artistico', 'cv_tecnico', 'accordi_cast', 'produttore_esecutivo']);
  assert.deepEqual(tipi(sez('D')), ['modulo3', 'coproduzione', 'distribuzione', 'finanziamenti', 'referenze_bancarie', 'finanziatori_esterni', 'produttore_esecutivo']);
  // stesso risultato dell'elenco fisso per lettera di sezione, per entrambe le griglie
  for (const griglia of Object.values(BANDO_SICILIA.griglie)) for (const id of ['A', 'B', 'D']) assert.deepEqual(tipi(griglia.sezioni.find((s) => s.id === id)), tipi(id));
  assert.ok(tipi('V').includes('modulo1'));
  // ogni criterio della Sicilia ha una famiglia riconosciuta
  for (const griglia of Object.values(BANDO_SICILIA.griglie)) for (const s of griglia.sezioni) for (const c of s.criteri) assert.ok(FAMIGLIE[c.famiglia], `famiglia di ${griglia.id}/${c.id}`);
});

test('documenti e guida di lettura per un bando con sezioni diverse', () => {
  const documenti = TIPI.map((t) => ({ nome: t.id, tipo: t.id, testo: 'x' }));
  const g = INVENTATO.griglie.U;
  assert.deepEqual(famiglieSezione(g.sezioni[0]), ['scrittura', 'visione']);
  assert.deepEqual(famiglieSezione(g.sezioni[1]), []); // solo criteri calcolati
  const fattibilita = documentiPerSezione(documenti, g.sezioni[2]).map((d) => d.tipo);
  assert.ok(fattibilita.includes('distribuzione') && fattibilita.includes('referenze_bancarie') && !fattibilita.includes('sceneggiatura'));
  assert.match(guidaSezione(g.sezioni[0]), /Leggi per intero il testo/);
  assert.match(guidaSezione(g.sezioni[2]), /piano finanziario fonte per fonte/);
  const p = promptSezione({ bando: preparaBando(INVENTATO), categoriaId: 'lungometraggi', anno: 2026, sezione: g.sezioni[0], documenti: [], dati: dati(), commissario: { nome: 'Esperta', descrizione: 'prova' }, ancore: '\n\nANCORE DI PROVA' });
  assert.match(p.system, /almeno 60\/100 complessivi/);
  assert.doesNotMatch(p.system, /minimi di sezione/);
  assert.match(p.system, /ANCORE DI PROVA/);
});

test('forma di un bando: pulizia, controllo, preparazione', () => {
  const b = preparaBando(INVENTATO);
  assert.equal(b.simulabile, true);
  assert.equal(b.verificato, true);
  assert.equal(b.predefinito, true);
  // la Sicilia, bando di riferimento, supera lo stesso controllo
  const sic = validaBando(sanificaBando(BANDO_SICILIA));
  assert.deepEqual(sic.errori, []);
  assert.equal(sic.simulabile, true);
  // campi estranei e pericolosi non passano
  const sporco = sanificaBando({ ...INVENTATO, __proto__: { x: 1 }, script: '<script>', paginaUfficiale: 'javascript:alert(1)', fontiUrl: [{ titolo: 'x', url: 'data:text/html,ciao' }, { titolo: 'ok', url: 'https://esempio.invalid/a.pdf' }] });
  assert.equal(sporco.script, undefined);
  assert.equal(sporco.paginaUfficiale, '');
  assert.equal(sporco.fontiUrl.length, 1);
  assert.equal(urlSicuro('ftp://x'), '');
  // somme che non tornano, metriche inesistenti, soglie fuori scala
  const rotto = JSON.parse(JSON.stringify(INVENTATO));
  rotto.griglie.U.sezioni[0].criteri[0].max = 25;
  assert.ok(validaBando(sanificaBando(rotto)).errori.some((e) => /sommano/.test(e)));
  const metrica = JSON.parse(JSON.stringify(INVENTATO));
  metrica.griglie.U.sezioni[1].criteri[0].metrica = 'inesistente';
  assert.ok(validaBando(sanificaBando(metrica)).errori.some((e) => /metrica sconosciuta/.test(e)));
  const soglia = JSON.parse(JSON.stringify(INVENTATO));
  soglia.categorie[0].soglie = { 9: 10 };
  assert.ok(validaBando(sanificaBando(soglia)).errori.some((e) => /sezione inesistente/.test(e)));
  assert.throws(() => preparaBando(rotto), /non valido/);
  // una scheda senza griglia è valida ma non simulabile
  const scheda = preparaBando({ id: 'x-scheda', nome: 'Fondo senza griglia', regione: 'X', stato: 'atteso', tipoValutazione: 'automatico', griglie: {}, categorie: [] });
  assert.equal(scheda.simulabile, false);
  // la lettura di Claude conserva la famiglia e la regola di calcolo
  const letto = normalizzaBando({ nome: 'Letto', categorie: [{ id: 'u', nome: 'U', griglia: 'G', contributo: { percentuale: 50 } }], griglie: { G: { sezioni: [{ id: 'A', max: 100, criteri: [{ id: '1', nome: 'Uno', max: 100, tipo: 'qualitativo', famiglia: 'visione', calcolo: 'un punto ogni due giorni' }] }] } } }, 'file.pdf').bando;
  assert.equal(letto.griglie.G.sezioni[0].criteri[0].famiglia, 'visione');
  assert.match(letto.griglie.G.sezioni[0].criteri[0].principio, /un punto ogni due giorni/);
});

test('finestre e anni: aperta, futura, chiusa, edizione attesa', () => {
  const b = preparaBando(INVENTATO);
  assert.equal(finestraDiRiferimento(b, '2026-11-14').condizione, 'aperta');
  assert.equal(finestraDiRiferimento(b, '2026-09-01').condizione, 'futura');
  assert.equal(finestraDiRiferimento(b, '2027-01-10').condizione, 'chiusa');
  assert.equal(finestraDiRiferimento({ finestre: [] }), null);
  const anni = anniBando(b, '2027-01-10');
  assert.deepEqual(anni.map((a) => [a.anno, a.prevista, a.chiusa]), [[2026, false, true], [2027, true, false]]);
  assert.deepEqual(anniBando(BANDO_SICILIA, '2026-11-14').map((a) => a.anno), [2025, 2026, 2027]);
});

test('aggiornamenti: vale solo ciò che è valido e più recente; restano testo e punteggi reali del programma', () => {
  const base = [BANDO_SICILIA, preparaBando(INVENTATO)];
  // revisione più vecchia: ignorata
  let r = applicaAggiornamenti(base, [], { a: { ...INVENTATO, revisione: '2026-01-01', sogliaTotale: 10 } });
  assert.equal(r.bandi.find((b) => b.id === INVENTATO.id).sogliaTotale, 60);
  // revisione più recente: sostituisce
  r = applicaAggiornamenti(base, [], { a: { ...INVENTATO, revisione: '2026-12-01', sogliaTotale: 65 } });
  const nuovo = r.bandi.find((b) => b.id === INVENTATO.id);
  assert.equal(nuovo.sogliaTotale, 65);
  assert.equal(nuovo.aggiornato, '2026-12-01');
  // aggiornamento non valido: ignorato
  const rotto = JSON.parse(JSON.stringify({ ...INVENTATO, revisione: '2027-01-01' }));
  rotto.griglie.U.sezioni[0].max = 10;
  r = applicaAggiornamenti(base, [], { a: rotto });
  assert.equal(r.bandi.find((b) => b.id === INVENTATO.id).revisione, '2026-11-01');
  // un bando nuovo si aggiunge; una scheda senza griglia finisce tra le schede
  r = applicaAggiornamenti(base, [], { n: { ...INVENTATO, id: 'nuovo-2027', revisione: '2027-02-01' }, s: { id: 'solo-scheda', nome: 'Scheda', revisione: '2027-02-01', griglie: {}, categorie: [] } });
  assert.ok(r.bandi.some((b) => b.id === 'nuovo-2027'));
  assert.ok(r.schede.some((b) => b.id === 'solo-scheda'));
  // la Sicilia aggiornata conserva testo dell'avviso ed esiti reali
  const patch = sanificaBando(BANDO_SICILIA); patch.revisione = '2027-01-15'; patch.finestre = [...patch.finestre, { anno: 2028, dal: '2028-02-01', al: '2028-03-15' }];
  r = applicaAggiornamenti(base, [], { s: patch });
  const sic = r.bandi.find((b) => b.id === BANDO_SICILIA.id);
  assert.equal(sic.finestre.length, 4);
  assert.ok(sic.testi.length > 5 && sic.esiti.length && sic.prassi.length);
  // una griglia non provata dal testo ufficiale non diventa simulabile
  r = applicaAggiornamenti(base, [], { d: { ...INVENTATO, id: 'dubbio-2027', revisione: '2027-02-01', affidabilita: { griglia: 'fonte_secondaria' } } });
  assert.ok(r.schede.some((b) => b.id === 'dubbio-2027') && !r.bandi.some((b) => b.id === 'dubbio-2027'));
});

test('registro dei bandi: la Sicilia c’è sempre, il catalogo è ordinato e senza doppioni', () => {
  assert.equal(BANDI_PREDEFINITI[0].id, 'sicilia-2025-2027');
  const tutti = catalogo();
  assert.equal(new Set(tutti.map((b) => b.id)).size, tutti.length);
  assert.equal(tutti.length, BANDI_PREDEFINITI.length + SCHEDE_BANDI.length);
  for (const b of BANDI_PREDEFINITI) assert.ok(b.simulabile !== false && b.verificato !== false, `simulabile e verificato: ${b.id}`);
});

test('soglia su alcune sezioni e penalità', () => {
  const b = preparaBando({ ...INVENTATO, sogliaSuSezioni: ['1', '3'], sogliaTotale: 50, penalita: [{ id: 'legalita', testo: 'Senza rating di legalità', punti: 1 }] });
  const giudizi = { a: [{ commissario: 'x', punteggio: 20, rigoroso: 20 }], b: [{ commissario: 'x', punteggio: 15, rigoroso: 15 }], e: [{ commissario: 'x', punteggio: 9, rigoroso: 9 }], f: [{ commissario: 'x', punteggio: 4, rigoroso: 4 }] };
  const d = dati();
  let r = componiRisultato(b, 'lungometraggi', d, giudizi);
  assert.equal(r.totaleSoglia, 48); // 20+15+9+4: la sezione 2 non conta per la soglia
  assert.equal(r.esito, 'sotto_soglia');
  assert.match(r.motivi[0], /sezioni 1, 3/);
  d.penalita = { legalita: true };
  r = componiRisultato(b, 'lungometraggi', d, giudizi);
  assert.equal(r.totale, 48 + 18 - 1);
  assert.equal(r.penalita.length, 1);
  assert.ok(validaBando(sanificaBando({ ...INVENTATO, sogliaSuSezioni: ['9'] })).errori.some((e) => /inesistente/.test(e)));
});

test('soglie combinate su criteri e sezioni', () => {
  const b = preparaBando({ ...INVENTATO, soglieCombinate: [{ etichetta: 'Sceneggiatura + piano', criteri: ['a', 'e'], minimo: 30 }, { sezioni: ['1', '3'], minimo: 40 }] });
  const giudizi = (a) => ({ a: [{ commissario: 'x', punteggio: a, rigoroso: a }], b: [{ commissario: 'x', punteggio: 15, rigoroso: 15 }], e: [{ commissario: 'x', punteggio: 9, rigoroso: 9 }], f: [{ commissario: 'x', punteggio: 4, rigoroso: 4 }] });
  let r = componiRisultato(b, 'lungometraggi', dati(), giudizi(18));
  assert.equal(r.combinate[0].punti, 27);
  assert.equal(r.esito, 'sotto_soglia');
  assert.ok(r.motivi.some((m) => /Sceneggiatura \+ piano: 27/.test(m)));
  r = componiRisultato(b, 'lungometraggi', dati(), giudizi(24));
  assert.ok(r.combinate.every((x) => x.superata));
  assert.ok(validaBando(sanificaBando({ ...INVENTATO, soglieCombinate: [{ criteri: ['zz'], minimo: 3 }] })).errori.some((e) => /inesistente/.test(e)));
});

test('coproduzione estera al 20%: quota dal piano o dichiarata, controlli e regola sul punteggio', async () => {
  const { quoteCoproduzione, QUOTA_ESTERA_MIN, verificheAmmissibilita, datiVuoti } = await import('../app/js/core/scoring.js');
  const { BANDO_SICILIA } = await import('../app/js/core/bando-sicilia.js');
  const { componiRegole } = await import('../app/js/core/ragionamento.js');
  assert.equal(QUOTA_ESTERA_MIN, 20);
  const dati = (estero, extra = {}) => ({ ...datiVuoti(), economici: { costoProduzione: 1000000, costoAmmissibile: 1000000, contributoRichiesto: 200000, spesaSicilia: 500000, producerFee: 50000 },
    piano: [{ voce: '1.1', etichetta: 'Contributo', importo: 200000 }, { voce: '2.2', etichetta: 'Produttori indipendenti', denominazione: 'Alfa', importo: 800000 - estero }, ...(estero ? [{ voce: '3.1', etichetta: 'Produttori esteri', denominazione: 'Beta Ltd', importo: estero }] : [])], ...extra });

  // dal piano: 25% → sopra; 5% → sotto; nessun estero → niente da dire
  assert.deepEqual((({ esteraPct, origine, sottoSoglia, coproduttoriEsteri }) => ({ esteraPct, origine, sottoSoglia, coproduttoriEsteri }))(quoteCoproduzione(dati(250000))), { esteraPct: 25, origine: 'piano', sottoSoglia: false, coproduttoriEsteri: 1 });
  assert.equal(quoteCoproduzione(dati(50000)).sottoSoglia, true);
  assert.equal(quoteCoproduzione(dati(200000)).sottoSoglia, false, 'il 20% esatto basta');
  assert.deepEqual((({ presente, sottoSoglia }) => ({ presente, sottoSoglia }))(quoteCoproduzione(dati(0))), { presente: false, sottoSoglia: null });
  // la quota dichiarata nei Dati chiave prevale sul piano
  const dich = quoteCoproduzione(dati(50000, { coproduzione: { quotaProponente: 30, quotaEstera: 22 } }));
  assert.equal(dich.esteraPct, 22); assert.equal(dich.origine, 'dichiarata'); assert.equal(dich.sottoSoglia, false);

  // controlli di ammissibilità
  const controllo = (d, id) => verificheAmmissibilita(BANDO_SICILIA, 'film', 2026, d, []).find((x) => x.id === id);
  assert.equal(controllo(dati(250000), 'quota_estera').esito, 'ok');
  assert.equal(controllo(dati(50000), 'quota_estera').esito, 'attenzione');
  assert.match(controllo(dati(50000), 'quota_estera').dettaglio, /Sotto il 20%.*5%/);
  assert.equal(controllo(dati(0), 'quota_estera'), undefined);
  // quota del proponente: sotto il 20% è bloccante in Sicilia; senza il dato nessun controllo
  assert.equal(BANDO_SICILIA.quotaProponenteMinPct, 20);
  assert.equal(controllo(dati(0, { coproduzione: { quotaProponente: 15, quotaEstera: null } }), 'quota_proponente').esito, 'critico');
  assert.equal(controllo(dati(0, { coproduzione: { quotaProponente: 26.4, quotaEstera: null } }), 'quota_proponente').esito, 'ok');
  assert.equal(controllo(dati(0), 'quota_proponente'), undefined);

  // regola sul punteggio di internazionalizzazione: sotto il 20% la fascia attesa scende
  const base = { accordo_coproduzione_estera_firmato: true, coproduttori_esteri_rilevanza_provata: false, coproduttori_esteri_n: 2, documento_coproduzione_estera_allegato: true, coproduzione_estera_dichiarata: true, distribuzione_internazionale_firmata: false, venditore_estero_qualifica_provata: false };
  const sopra = componiRegole('internazionale', { ...base, quota_estera_almeno_20: true });
  const sotto = componiRegole('internazionale', { ...base, quota_estera_almeno_20: false });
  assert.deepEqual(sopra.regole.map((r) => r.id), ['internazionale-piu-coproduttori-esteri-rilevanza-non-provata']);
  assert.deepEqual(sotto.regole.map((r) => r.id), ['internazionale-coproduzione-estera-sotto-il-20']);
  assert.ok(sotto.attesa[1] < sopra.attesa[0], 'sotto il 20% il massimo atteso è sotto il minimo atteso della coproduzione piena');
  assert.deepEqual(sotto.attesa, [0.5, 0.7]);
});
