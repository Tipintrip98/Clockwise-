// Schede dei bandi in bandi/dati/*.json: forma, coerenza dei numeri, prova del motore con dati d'invenzione,
// allineamento dei file generati (app/js/core/bandi/dati.js e bandi/catalogo.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sanificaBando, validaBando, finestraDiRiferimento, METRICHE, FAMIGLIE } from '../app/js/core/bandi/schema.js';
import { componiRisultato, verificheAmmissibilita, datiVuoti, getGriglia } from '../app/js/core/scoring.js';
import { pianoValutazione, sezioniConGiudizio } from '../app/js/core/engine.js';
import { documentiPerSezione, TIPI } from '../app/js/core/docs.js';
import { BANDI_PREDEFINITI, SCHEDE_BANDI, catalogo } from '../app/js/core/bandi/indice.js';
import { BANDI_DATI } from '../app/js/core/bandi/dati.js';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cartella = path.join(radice, 'bandi/dati');
const schede = fs.readdirSync(cartella).filter((f) => f.endsWith('.json')).sort().map((f) => {
  const grezzo = JSON.parse(fs.readFileSync(path.join(cartella, f), 'utf8'));
  const bando = sanificaBando(grezzo);
  return { file: f, grezzo, bando, esito: validaBando(bando) };
});
const simulabili = schede.filter((s) => s.esito.simulabile);
const quasi = (a, b) => Math.abs(a - b) < 0.051;

// Dossier d'invenzione: nessun dato reale.
const datiProva = () => ({
  ...datiVuoti(), titolo: 'Il faro di carta', durataMin: 98,
  giorni: { prepTot: 20, prepSicilia: 12, ripreseTot: 30, ripreseSicilia: 21, postTot: 40, postSicilia: 10 },
  professionisti: { artTot: 10, artSicilia: 4, crewTot: 30, crewSicilia: 14 },
  economici: { costoProduzione: 1200000, costoAmmissibile: 1100000, contributoRichiesto: 200000, spesaSicilia: 420000, producerFee: 60000 },
  piano: [
    { voce: '1.1', etichetta: 'Contributo richiesto', denominazione: '', importo: 200000, documento: 'nessuno' },
    { voce: '2.1', etichetta: 'Apporto del produttore', denominazione: 'Produzioni d’invenzione', importo: 1000000, documento: 'referenze' },
  ],
});
const documenti = TIPI.map((t) => ({ id: t.id, nome: `${t.id}.pdf`, tipo: t.id, testo: `Testo d’invenzione per ${t.nome}.`, avvisi: [] }));

test('ci sono schede, una per file, e ognuna è valida', () => {
  assert.ok(schede.length >= 11, `trovate solo ${schede.length} schede`);
  for (const s of schede) {
    assert.deepEqual(s.esito.errori, [], `${s.file}: ${s.esito.errori.join(' ')}`);
    assert.equal(`${s.bando.id}.json`, s.file, `${s.file}: il nome del file deve essere l’identificativo`);
    assert.match(s.bando.revisione, /^\d{4}-\d{2}-\d{2}$/, `${s.file}: manca la revisione`);
    assert.ok(s.bando.nome && s.bando.ente && s.bando.regione && s.bando.descrizione, `${s.file}: nome, ente, regione o descrizione mancanti`);
    assert.ok(s.bando.gentilizio, `${s.file}: manca il gentilizio`);
    assert.ok(s.bando.fonte, `${s.file}: manca l’atto ufficiale`);
  }
});

test('identificativi unici', () => {
  const id = schede.map((s) => s.bando.id);
  assert.equal(new Set(id).size, id.length);
  assert.ok(!id.includes('sicilia-2025-2027'), 'la Sicilia vive nel suo modulo');
});

test('nessun testo viene troncato dalla sanificazione', () => {
  const troncati = [];
  const confronta = (g, s, via) => {
    if (typeof g === 'string' && typeof s === 'string') { if (s.length < g.trim().length) troncati.push(via); return; }
    if (Array.isArray(g) && Array.isArray(s)) { g.forEach((x, i) => confronta(x, s[i], `${via}[${i}]`)); return; }
    if (g && s && typeof g === 'object' && typeof s === 'object') for (const k of Object.keys(g)) if (k in s && k !== 'id') confronta(g[k], s[k], `${via}.${k}`);
  };
  for (const s of schede) confronta(s.grezzo, s.bando, s.file);
  assert.deepEqual(troncati, []);
});

test('le somme tornano: criteri = sezione, sezioni = punteggio massimo', () => {
  for (const { file, bando } of simulabili) {
    for (const g of Object.values(bando.griglie)) {
      let totale = 0;
      for (const s of g.sezioni) {
        const somma = s.criteri.reduce((a, c) => a + c.max, 0);
        assert.ok(quasi(somma, s.max), `${file} ${g.id}/${s.id}: criteri ${somma}, sezione ${s.max}`);
        totale += s.max;
      }
      assert.ok(quasi(totale, bando.punteggioMassimo), `${file} ${g.id}: sezioni ${totale}, massimo ${bando.punteggioMassimo}`);
      assert.ok(bando.sogliaTotale >= 0 && bando.sogliaTotale <= bando.punteggioMassimo, `${file}: soglia fuori scala`);
    }
  }
});

test('criteri: famiglia nota, fasce su metriche esistenti nell’unità giusta e ordinate', () => {
  for (const { file, grezzo, bando } of simulabili) {
    for (const g of Object.values(grezzo.griglie)) for (const s of g.sezioni) for (const c of s.criteri) {
      assert.ok(FAMIGLIE[c.famiglia], `${file} ${c.id}: famiglia «${c.famiglia}» sconosciuta`);
      if (c.tipo === 'fasce') {
        assert.ok(METRICHE[c.metrica], `${file} ${c.id}: metrica «${c.metrica}» sconosciuta`);
        if (c.unita) assert.equal(c.unita, METRICHE[c.metrica].unita, `${file} ${c.id}: unità diversa da quella della metrica`);
      }
    }
    for (const g of Object.values(bando.griglie)) for (const s of g.sezioni) for (const c of s.criteri.filter((x) => x.tipo === 'fasce')) {
      const soglie = c.fasce.filter((f) => !f.flag).map((f) => f.oltre ?? f.da);
      assert.deepEqual(soglie, [...soglie].sort((a, b) => b - a), `${file} ${c.id}: fasce non ordinate`);
    }
  }
});

test('finestre: apertura prima della chiusura, anno coerente, finestra di riferimento calcolabile', () => {
  for (const { file, bando } of schede) {
    for (const f of bando.finestre) {
      if (f.dal) assert.ok(f.dal <= f.al, `${file}: finestra ${f.anno} con apertura dopo la chiusura`);
      const annoChiusura = Number(f.al.slice(0, 4));
      assert.ok(Math.abs(f.anno - annoChiusura) <= 1, `${file}: finestra ${f.anno} che chiude nel ${annoChiusura}`);
    }
    if (bando.finestre.length) {
      const rif = finestraDiRiferimento(bando, '2026-11-14');
      assert.ok(rif && ['aperta', 'futura', 'chiusa'].includes(rif.condizione), `${file}: finestra di riferimento non calcolabile`);
    }
  }
});

test('i bandi simulabili poggiano sul testo ufficiale e hanno una pagina https', () => {
  assert.ok(simulabili.length > 0);
  for (const { file, bando } of simulabili) {
    assert.equal(bando.affidabilita.griglia, 'testo_ufficiale', `${file}: griglia non tratta dal testo ufficiale`);
    assert.ok(bando.affidabilita.citazioni.length >= 1 && bando.affidabilita.citazioni.every((c) => c.riferimento && c.testo.length > 20), `${file}: mancano le citazioni dal testo ufficiale`);
    assert.match(bando.paginaUfficiale, /^https:\/\//, `${file}: pagina ufficiale non https`);
    assert.ok(['confermata', 'corretta'].includes(bando.verifica?.esito), `${file}: griglia non verificata`);
  }
});

test('le schede informative non hanno griglie né categorie, ma dicono perché', () => {
  for (const { file, bando, esito } of schede.filter((s) => !s.esito.simulabile)) {
    assert.equal(Object.keys(bando.griglie).length + bando.categorie.length, 0, `${file}: scheda non simulabile con griglie o categorie`);
    assert.ok(bando.affidabilita.dubbi.length > 0, `${file}: una scheda informativa deve spiegare i suoi limiti`);
    assert.ok(bando.paginaUfficiale, `${file}: manca la pagina ufficiale`);
    assert.equal(esito.ok, true);
  }
});

test('prova di calcolo con un dossier d’invenzione: motore, ammissibilità, piano di lettura dei documenti', () => {
  for (const { file, bando } of simulabili) {
    for (const cat of bando.categorie) {
      const g = getGriglia(bando, cat.id);
      const valutazioni = {};
      for (const s of g.sezioni) for (const c of s.criteri) if (c.tipo !== 'fasce' || c.giudizio) valutazioni[c.id] = [{ commissario: 'prova', punteggio: c.max * 0.7, rigoroso: c.max * 0.6, valore: 65, motivazione: 'Prova.' }];
      const r = componiRisultato(bando, cat.id, datiProva(), valutazioni);
      assert.ok(r.completo, `${file}/${cat.id}: risultato incompleto con tutti i criteri valutati`);
      assert.ok(Number.isFinite(r.totale) && r.totale >= -10 && r.totale <= bando.punteggioMassimo + 0.01, `${file}/${cat.id}: totale ${r.totale}`);
      assert.ok(['ammissibile', 'a_rischio', 'sotto_soglia'].includes(r.esito), `${file}/${cat.id}: esito ${r.esito}`);
      const vuoto = componiRisultato(bando, cat.id, datiProva(), {});
      assert.equal(vuoto.completo, sezioniConGiudizio(g).length === 0, `${file}/${cat.id}: senza giudizi il risultato dev’essere parziale`);
      const anno = Object.keys(cat.contributo.massimali).sort().at(-1) || String(bando.finestre.at(-1)?.anno ?? 2026);
      const controlli = verificheAmmissibilita(bando, cat.id, anno, datiProva(), TIPI.map((t) => t.id));
      assert.ok(controlli.length > 0 && controlli.every((x) => x.titolo && ['ok', 'attenzione', 'critico', 'da_verificare'].includes(x.esito)), `${file}/${cat.id}: controlli di ammissibilità anomali`);
      const piano = pianoValutazione(bando, { categoriaId: cat.id, documenti }, 3);
      assert.deepEqual(piano.saltate.map((s) => s.id), [], `${file}/${cat.id}: sezioni senza documenti da leggere`);
      for (const s of sezioniConGiudizio(g)) assert.ok(documentiPerSezione(documenti, s).length > 0, `${file}/${cat.id}: la sezione ${s.id} non riceve documenti`);
    }
  }
});

test('regole speciali: soglie su alcune sezioni, soglie combinate e penalità puntano a elementi esistenti', () => {
  for (const { file, bando } of simulabili) {
    const sezioni = new Set(Object.values(bando.griglie).flatMap((g) => g.sezioni.map((s) => s.id)));
    for (const id of bando.sogliaSuSezioni) assert.ok(sezioni.has(id), `${file}: soglia su una sezione inesistente ${id}`);
    for (const p of bando.penalita) assert.ok(p.punti < 0 && p.testo, `${file}: penalità non valida`);
  }
  // Veneto: il rating di legalità mancante toglie un punto.
  const veneto = simulabili.find((s) => s.bando.id.startsWith('veneto-'))?.bando;
  if (veneto) {
    const base = componiRisultato(veneto, veneto.categorie[0].id, datiProva(), {});
    const conPenalita = componiRisultato(veneto, veneto.categorie[0].id, { ...datiProva(), penalita: { legalita: true } }, {});
    assert.equal(Math.round((base.totale - conPenalita.totale) * 10) / 10, 1);
  }
  // Liguria: un elemento del criterio 1 a zero esclude anche con un totale alto.
  const liguria = simulabili.find((s) => s.bando.id === 'liguria-attrazione-produzioni-audiovisive-2026')?.bando;
  if (liguria) {
    const g = getGriglia(liguria, liguria.categorie[0].id);
    const val = {};
    for (const s of g.sezioni) for (const c of s.criteri) val[c.id] = [{ punteggio: c.id === '1.3' ? 0 : c.max }];
    const r = componiRisultato(liguria, liguria.categorie[0].id, datiProva(), val);
    assert.equal(r.esito, 'sotto_soglia');
    assert.ok(r.motivi.some((m) => m.includes('1.3')));
  }
  // Premialità fuori scala (Piemonte, Lombardia, Umbria): la soglia guarda solo le sezioni di base.
  for (const id of ['piemonte-film-tv-fund-2026', 'lombardia-per-il-cinema-2025-2026', 'umbria-film-fund-2026-2027']) {
    const b = simulabili.find((s) => s.bando.id === id)?.bando;
    if (!b) continue;
    assert.ok(b.sogliaSuSezioni.length > 0 && b.punteggioMassimo > 100, `${id}: premialità non separata dalla soglia`);
    const g = getGriglia(b, b.categorie[0].id);
    const premi = g.sezioni.filter((s) => !b.sogliaSuSezioni.includes(s.id));
    assert.equal(premi.length, 1, `${id}: una sola sezione di premialità`);
    assert.equal(premi[0].max + 100, b.punteggioMassimo);
  }
});

test('il file generato e il catalogo sono allineati alle schede', () => {
  const r = spawnSync(process.execPath, [path.join(radice, 'scripts/genera-bandi.mjs'), '--controlla'], { cwd: radice, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.deepEqual(BANDI_DATI.map((b) => b.id).sort(), schede.map((s) => s.bando.id).sort());
  const cat = JSON.parse(fs.readFileSync(path.join(radice, 'bandi/catalogo.json'), 'utf8'));
  assert.equal(cat.bandi.length, schede.length);
});

test('registro: i simulabili verificati sono predefiniti, gli altri restano schede; il catalogo li elenca tutti', () => {
  const predefiniti = new Set(BANDI_PREDEFINITI.map((b) => b.id));
  const informative = new Set(SCHEDE_BANDI.map((b) => b.id));
  for (const { bando, esito } of schede) {
    const provata = esito.simulabile && bando.affidabilita.griglia === 'testo_ufficiale' && ['confermata', 'corretta'].includes(bando.verifica?.esito);
    assert.ok(provata ? predefiniti.has(bando.id) : informative.has(bando.id), `${bando.id}: nel registro sbagliato`);
  }
  const tutti = catalogo();
  assert.equal(tutti.length, schede.length + 1, 'tutte le schede più la Sicilia');
  assert.deepEqual(tutti.filter((b) => ['Italia', 'Europa'].includes(b.regione)).map((b) => b.regione), tutti.slice(-tutti.filter((b) => ['Italia', 'Europa'].includes(b.regione)).length).map((b) => b.regione), 'nazionali ed europei in fondo');
});
