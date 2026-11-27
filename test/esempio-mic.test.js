// Dossier di esempio «L’insabbiato» (solo numeri), esporta/importa dossier, punteggi reali MiC e stima sulle griglie MiC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BANDI_PREDEFINITI } from '../app/js/core/bandi/indice.js';
import { componiRisultato, datiVuoti, quoteCoproduzione } from '../app/js/core/scoring.js';
import { valutazioniPerCriterio } from '../app/js/core/engine.js';
import { compilaEsempio, ESEMPIO, REALE_ESEMPIO, VERSIONE_ESEMPIO } from '../app/js/core/esempio.js';
import { pacchettoDossier, leggiPacchetto, preparaImportato, FORMATO } from '../app/js/core/scambio.js';
import { ESITI_MIC, LINEE_MIC, esitiStorici, statisticheStoriche, collocazionePerQuota } from '../app/js/core/bandi/esiti-mic.js';
import { lineeMic, lineaPredefinita, stimaMic } from '../app/js/core/mic.js';

const nuovo = () => compilaEsempio({ id: 'esempio1', creato: '2026-11-17T00:00:00Z', documenti: [], dati: datiVuoti() });

test('esempio: «L’insabbiato» dà 88,9 punti simulati contro 89,5 reali, sezione per sezione', () => {
  const p = nuovo();
  const bando = BANDI_PREDEFINITI.find((b) => b.id === p.bandoId);
  const r = componiRisultato(bando, p.categoriaId, p.dati, valutazioniPerCriterio(p.valutazione));
  assert.equal(r.totale, ESEMPIO.simulato.totale);
  assert.equal(r.completo, true);
  assert.deepEqual(Object.fromEntries(r.sezioni.map((s) => [s.id, s.punti])), ESEMPIO.simulato.sezioni);
  assert.equal(r.rigoroso, ESEMPIO.simulato.rigoroso);
  const reale = Object.values(REALE_ESEMPIO).reduce((a, v) => a + v, 0);
  assert.equal(Math.round(reale * 10) / 10, ESEMPIO.totaleReale);
  assert.ok(Math.abs(r.totale - ESEMPIO.totaleReale) <= 1, 'scarto entro un punto');
  // il punteggio reale dell'esempio è quello pubblicato nella graduatoria 2024 già nel programma
  const riga = bando.esitiFinanziati[0].categorie.film.find((x) => x.totale === ESEMPIO.totaleReale);
  assert.deepEqual(riga.sezioni, REALE_ESEMPIO);
  assert.equal(p.esempio, true); assert.equal(p.esempioVersione, VERSIONE_ESEMPIO);
  assert.equal(quoteCoproduzione(p.dati).esteraPct, 24.9, 'coproduzione estera sopra il 20%');
});

test('esempio: solo numeri — nessun documento, nessun nome di persona o società, nessuna motivazione tratta dai testi', () => {
  const p = nuovo();
  assert.deepEqual(p.documenti, []);
  assert.equal(p.modulo3, undefined);
  const testo = JSON.stringify(p);
  const sorgente = fs.readFileSync(new URL('../app/js/core/esempio.js', import.meta.url), 'utf8');
  for (const vietato of [/s\.?r\.?l/i, /srls/i, /cinemaset/i, /regia di/i, /«[^»]*\.pdf»/i, /pp?\. ?\d/]) { assert.doesNotMatch(testo, vietato); assert.doesNotMatch(sorgente.replace(/^\/\/.*$/gm, ''), vietato); }
  for (const g of Object.values(p.valutazione.giudizi).flat()) for (const c of g.criteri) { assert.deepEqual(c.evidenze, []); assert.deepEqual(c.criticita, []); assert.match(c.motivazione, /non inclusa nell’esempio/); }
  assert.deepEqual(p.valutazione.verifica.controlli, []);
});

test('esporta e importa: il dossier torna identico; mai sovrascritture, mai documenti d’identità', () => {
  const p = nuovo();
  p.documenti = [{ id: 'd1', nome: 'sceneggiatura.pdf', tipo: 'sceneggiatura', testo: 'INT. CASA', avvisi: [] }, { id: 'd2', nome: 'carta.pdf', tipo: 'identita', testo: 'ROSSI MARIO', avvisi: [] }];
  const pacchetto = pacchettoDossier(p, { versioneApp: '2.0.6', adesso: '2026-11-17T10:00:00Z', originali: [{ id: 'd1', nome: 'sceneggiatura.pdf', tipo: 'application/pdf', base64: 'JVBERg==' }, { id: 'd2', nome: 'carta.pdf', tipo: 'application/pdf', base64: 'AAAA' }] });
  assert.equal(pacchetto.formato, FORMATO);
  assert.equal(pacchetto.progetto.documenti[1].testo, '', 'il testo del documento d’identità non viene esportato');
  assert.deepEqual(pacchetto.originali.map((o) => o.id), ['d1'], 'né il suo file originale');
  assert.equal(p.documenti[1].testo, 'ROSSI MARIO', 'il dossier di partenza non viene toccato');

  const letto = leggiPacchetto(JSON.stringify(pacchetto));
  assert.deepEqual(letto.progetto.dati, p.dati);
  assert.deepEqual(letto.progetto.valutazione, p.valutazione);
  assert.equal(letto.originali.length, 1);

  // stesso identificativo già presente: diventa una copia, l'esistente resta com'è
  const copia = preparaImportato(letto.progetto, { idEsistenti: ['esempio1'], nuovoId: () => 'nuovo9', adesso: '2026-11-17T11:00:00Z' });
  assert.equal(copia.copia, true); assert.equal(copia.progetto.id, 'nuovo9'); assert.match(copia.progetto.nome, /\(importato\)$/);
  assert.equal(copia.progetto.esempio, false);
  const stesso = preparaImportato(letto.progetto, { idEsistenti: ['altro'], nuovoId: () => 'nuovo9' });
  assert.equal(stesso.copia, false); assert.equal(stesso.progetto.id, 'esempio1');

  assert.throws(() => leggiPacchetto('non è json'), /non si riesce a leggerlo/);
  assert.throws(() => leggiPacchetto('{"formato":"altro"}'), /non è un dossier esportato/);
  assert.throws(() => leggiPacchetto(JSON.stringify({ ...pacchetto, versione: 99 })), /versione più recente/);
  assert.throws(() => leggiPacchetto(JSON.stringify({ formato: FORMATO, versione: 1, progetto: { nome: 'x' } })), /incompleto/);
});

test('punteggi reali MiC 2025: numeri dei decreti, coerenti riga per riga', () => {
  assert.deepEqual(ESITI_MIC.map((a) => a.id), ['2025-II', '2025-II-film', '2025-I', '2025-I-film']);
  let righe = 0;
  for (const atto of ESITI_MIC) {
    assert.match(atto.url, /^https:\/\/cinema\.cultura\.gov\.it\/download\/\d+\/$/);
    for (const [cat, d] of Object.entries(atto.categorie)) {
      assert.ok(LINEE_MIC[cat], cat);
      assert.equal(Object.values(d.massimi).reduce((a, v) => a + v, 0), d.massimoTotale);
      let ultimoTotale = Infinity, finiti = false;
      for (const r of d.righe) {
        righe++;
        if (r.totale != null) {
          const somma = Object.values(r.sezioni).reduce((a, v) => a + (v ?? 0), 0);
          assert.equal(somma, r.totale, `${atto.id} ${cat} riga ${r.n}: le sezioni sommano al totale`);
          assert.ok(r.totale <= ultimoTotale, `${atto.id} ${cat}: graduatoria in ordine`); ultimoTotale = r.totale;
        }
        for (const [k, v] of Object.entries(r.sezioni)) if (v != null) assert.ok(v >= 0 && v <= d.massimi[k], `${atto.id} ${cat} riga ${r.n} ${k}`);
        // i finanziati sono i primi della lista, tutti sopra il minimo; chi non è finanziato non ha contributo
        if (r.stato === 'F') { assert.equal(finiti, false); assert.ok(r.totale >= d.minimoTotale); assert.ok(r.assegnato > 0 && r.assegnato <= r.richiesto); } else { finiti = true; assert.equal(r.assegnato, null); assert.ok(r.totale == null || r.totale < d.minimoTotale); }
      }
      const st = statisticheStoriche(d);
      assert.ok(st.assegnato <= d.dotazione, `${atto.id} ${cat}: assegnato entro la dotazione`);
      assert.equal(st.presentati, d.righe.length);
    }
  }
  assert.equal(righe, 653);
  const film = statisticheStoriche(ESITI_MIC[1].categorie['film-qualita-identita']);
  assert.deepEqual([film.presentati, film.finanziati, film.primo, film.ultimoFinanziato, film.quotaUltimo], [47, 23, 103, 80, 65.6]);
  const giovani = statisticheStoriche(ESITI_MIC[0].categorie['giovani-autori']);
  assert.deepEqual([giovani.presentati, giovani.finanziati, giovani.primo, giovani.ultimoFinanziato], [27, 11, 100, 78]);
  // nessun nome: solo numeri e stati
  const sorgente = fs.readFileSync(new URL('../app/js/core/bandi/esiti-mic.js', import.meta.url), 'utf8');
  const dati = sorgente.slice(sorgente.indexOf('const R = {') + 11, sorgente.indexOf('const righe ='));
  assert.doesNotMatch(dati.replace(/'[\w-]+\/[\w-]+':|'[FX]'|null/g, ''), /[A-Za-zÀ-ú]{2,}/);
});

test('punteggi reali MiC: collegati ai due bandi del catalogo, fuori dal motore di calcolo', () => {
  const mic = BANDI_PREDEFINITI.filter((b) => /^italia-mic-selettivi/.test(b.id));
  assert.equal(mic.length, 2);
  for (const b of mic) {
    const voci = esitiStorici(b);
    assert.equal(voci.length, 6, `${b.id}: tre linee per due sessioni`);
    assert.ok(voci.every((v) => b.categorie.some((c) => c.id === v.categoriaId)));
    assert.equal(b.esiti, undefined, 'la griglia 2025 è diversa: i punteggi non entrano nelle stime');
  }
  assert.deepEqual(esitiStorici(BANDI_PREDEFINITI.find((b) => b.id === 'sicilia-2025-2027')), []);
  const d = ESITI_MIC[0].categorie['prime-seconde'];
  const sopra = collocazionePerQuota(d, 80), sotto = collocazionePerQuota(d, 50);
  assert.equal(sopra.finanziabile, true); assert.equal(sopra.punti, 92);
  assert.equal(sotto.finanziabile, false); assert.ok(sotto.posizione > sopra.posizione);
  assert.equal(collocazionePerQuota(d, NaN), null);
});

test('dossier sulle griglie MiC: qualità dalla valutazione, punteggi fissi solo se dichiarati', () => {
  const p = nuovo();
  const linee = lineeMic(BANDI_PREDEFINITI);
  assert.equal(linee.length, 6);
  assert.equal(lineaPredefinita(p, BANDI_PREDEFINITI), 'film-qualita-identita');
  assert.equal(lineaPredefinita({ ...p, dati: { ...p.dati, tipologiaOpera: 'Documentario' } }, BANDI_PREDEFINITI), 'documentari');

  const senza = stimaMic(p, BANDI_PREDEFINITI, 'film-qualita-identita', {});
  assert.equal(senza.senzaValutazione, false);
  assert.equal(senza.daDichiarare, 4);
  assert.equal(senza.fissi.punti, 0, 'ciò che non è dichiarato vale zero, non una media');
  assert.equal(senza.massimo, 147);
  assert.ok(senza.qualita.punti > 80 && senza.qualita.punti < senza.qualita.massimo);
  assert.equal(Math.round(senza.sezioni.reduce((a, s) => a + s.punti, 0) * 10) / 10, senza.totale);
  assert.equal(senza.sopraSoglia, true);
  assert.equal(senza.confronti.length, 2, 'due sessioni reali 2025 per la stessa linea');
  assert.ok(senza.confronti.every((c) => c.collocazione.massimo === 122));

  const con = stimaMic(p, BANDI_PREDEFINITI, 'film-qualita-identita', { 'F.1': 7, 'G.1': 3, 'G.2': 0, 'H.1': 5, 'A.1': 15 });
  assert.equal(con.daDichiarare, 0);
  assert.equal(con.fissi.punti, 15);
  assert.equal(Math.round((con.totale - senza.totale) * 10) / 10, 15, 'i criteri di qualità non si possono dichiarare a mano');
  assert.equal(stimaMic(p, BANDI_PREDEFINITI, 'film-qualita-identita', { 'F.1': 3 }).fissi.punti, 0, 'solo i punteggi previsti dal bando');

  // senza valutazione non c'è niente da riportare: resta la sola parte dichiarata
  const vuoto = stimaMic({ ...p, valutazione: null }, BANDI_PREDEFINITI, 'giovani-autori', { 'H.1': 5 });
  assert.equal(vuoto.senzaValutazione, true); assert.equal(vuoto.totale, undefined);
  assert.equal(stimaMic(p, BANDI_PREDEFINITI, 'inesistente', {}), null);
  assert.equal(stimaMic(p, BANDI_PREDEFINITI.filter((b) => !/mic/.test(b.id)), 'giovani-autori', {}), null);
});

test('caso reale su un dossier MiC: firme come immagini, cast tecnico, certificazione, due sessioni', async () => {
  const { noteImmagini, documentiPerSezione } = await import('../app/js/core/docs.js');
  // logo su ogni pagina (1 immagine), firme sull'ultima (3 in più): solo l'ultima pagina è segnalata, come foglio delle firme
  const note = noteImmagini([1, 1, 4], ['Art. 1 Oggetto', 'Art. 5 Corrispettivo', 'Per la società licenziataria (Licenziatario)']);
  assert.deepEqual(note.slice(0, 2), ['', '']);
  assert.match(note[2], /3 immagini oltre alla carta intestata/);
  assert.match(note[2], /non si deve concludere che il documento non è firmato/);
  assert.match(noteImmagini([0, 2], ['testo', 'una fotografia del set'])[1], /2 immagini che il testo non mostra/);
  assert.deepEqual(noteImmagini([2, 2], ['a', 'b']), ['', ''], 'immagini uguali su tutte le pagine (carta intestata): nessuna nota');
  // il file del cast tecnico arriva anche ai criteri sulla componente artistica (MiC B.2 «cast artistico e tecnico», F.1 capi reparto)
  const qualita = BANDI_PREDEFINITI.find((b) => b.id === 'italia-mic-selettivi-qualita-2026');
  const sezF = qualita.griglie.T5.sezioni.find((s) => s.id === 'F');
  const docs = [{ nome: 'Cast tecnico.pdf', tipo: 'cv_tecnico', testo: 'Direttrice della fotografia: nome e cognome' }];
  assert.equal(documentiPerSezione(docs, sezF).length, 1);
  // nel bando MiC la certificazione ambientale è il criterio H (punti), non un requisito di ammissibilità
  for (const b of BANDI_PREDEFINITI.filter((x) => /^italia-mic-selettivi/.test(x.id))) assert.ok(b.categorie.every((c) => c.greenFilm === false), b.id);
  // il controllo dell'istruttore vede entrambe le sessioni dell'anno
  const { promptVerifica } = await import('../app/js/core/prompts.js');
  const pv = promptVerifica({ bando: qualita, categoriaId: 'film-qualita-identita', anno: 2026, documenti: [], tutti: [], dati: datiVuoti() });
  assert.match(pv.system, /dal 2026-06-03 al 2026-06-17[^;]*; dal 2026-10-01 al 2026-10-15/);
  assert.doesNotMatch(pv.system, /requisito di ammissibilità per questa categoria/);
});

test('moduli PDF compilati: i valori dei riquadri e le caselle spuntate entrano nel testo', async () => {
  const { righeCampi } = await import('../app/js/core/docs.js');
  const testi = [
    { x: 50, y: 700, str: 'Titolo dell’opera:' },
    { x: 80, y: 650, str: 'opera di finzione' }, { x: 80, y: 630, str: 'documentario' },
    { x: 50, y: 600, str: 'Luogo' }, { x: 200, y: 600, str: 'Giornate' },
  ];
  const righe = righeCampi([
    { tipo: 'testo', valore: 'Il film', rect: [160, 695, 400, 710], nome: 'Casella 1' },
    { tipo: 'casella', valore: true, rect: [60, 646, 68, 654] },
    { tipo: 'casella', valore: false, rect: [60, 626, 68, 634] },
    { tipo: 'testo', valore: 'Città A', rect: [50, 570, 150, 585] }, { tipo: 'testo', valore: 'L', rect: [155, 570, 190, 585] }, { tipo: 'testo', valore: '5', rect: [200, 570, 240, 585] },
    { tipo: 'testo', valore: '', rect: [50, 540, 150, 555] },
  ], testi);
  assert.match(righe[0], /Campi compilati del modulo/);
  assert.ok(righe.includes('- Titolo dell’opera: Il film'));
  assert.ok(righe.includes('- [X] opera di finzione'));
  assert.ok(!righe.some((r) => /documentario/.test(r)), 'la casella non spuntata non compare');
  assert.ok(righe.some((r) => /^- riga: Luogo = Città A \| .*L \| Giornate = 5$/.test(r)), righe.join('\n'));
  assert.deepEqual(righeCampi([{ tipo: 'testo', valore: '', rect: [0, 0, 1, 1] }], []), []);
});

test('MiC: quanti punti servono per essere finanziati, dalla dotazione della sessione', async () => {
  const { concorrenzaStimata } = await import('../app/js/core/mic.js');
  const riga = (totale, assegnato) => ({ sezioni: {}, totale, stato: 'F', assegnato });
  const storico = { massimoTotale: 100, dotazione: 5000000, righe: [riga(90, 500000), riga(85, 500000), riga(80, 500000), riga(70, 500000)] };
  const c = concorrenzaStimata({ punteggioMassimo: 150, sogliaTotale: 80 }, { dotazione: { 2026: 2000000 } }, [storico], 120);
  assert.equal(c.perSessione, 1000000);
  assert.equal(c.finanziabili, 2);
  assert.equal(c.quote[0].punti, 85);
  assert.equal(c.punti.medio, 127.5);
  assert.equal(c.esito, 'fuori');
  assert.equal(concorrenzaStimata({ punteggioMassimo: 150 }, { dotazione: {} }, [storico]), null);
  // mai sotto la soglia del bando
  assert.equal(concorrenzaStimata({ punteggioMassimo: 150, sogliaTotale: 80 }, { dotazione: { 2026: 100000000 } }, [storico], 85).punti.min, 105);
});

test('copertura del piano: il credito d’imposta conta dove il bando lo prevede', async () => {
  const { righePiano } = await import('../app/js/core/ragionamento.js');
  const dati = { piano: [{ voce: '1.2', etichetta: 'Tax credit produzione', denominazione: 'Ministero', importo: 300000, documento: 'nessuno' }] };
  const domanda = { nome: 'domanda.pdf', tipo: 'finanziamenti', testo: 'Richiesta di idoneità al credito d’imposta per le imprese di produzione (art. 15). '.repeat(5) };
  assert.equal(righePiano(dati, [domanda])[0].attesa, false, 'senza opzione resta com’era');
  const [r] = righePiano(dati, [domanda], { creditoImposta: true });
  assert.equal(r.attesa, true); assert.equal(r.rigorosa, true);
  const [s] = righePiano(dati, [], { creditoImposta: true });
  assert.equal(s.attesa, true); assert.equal(s.rigorosa, false);
});
