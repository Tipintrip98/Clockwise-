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
