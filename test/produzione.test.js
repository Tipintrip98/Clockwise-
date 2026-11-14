import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dividiScene, eseguiSpoglio, pianoLavorazione, dood, elementiPerReparto, rischiPerScena, vfxPerScena, pagine, csvSpoglio, csvPiano } from '../app/js/core/sceneggiatura.js';
import { scadenzario, documentiContrattuali, analizzaContratti, chiediAlBando, redigiBozza } from '../app/js/core/legale.js';
import { BANDO_SICILIA as B } from '../app/js/core/bando-sicilia.js';
import { datiVuoti } from '../app/js/core/scoring.js';

const COPIONE = `[pagina 1]
L'ULTIMA TONNARA

SCENA 1. EST. TONNARA DI FAVIGNANA - ALBA
Saro cammina sul molo.

SARO
Quarant'anni ca ti parru.

2. INT. STABILIMENTO FLORIO – GIORNO
Nina fotografa i macchinari. L'interno era buio e silenzioso.

NINA
Non e' un museo.

[pagina 2]
3 EST. MARE APERTO - GIORNO
Saro rema da solo. Un tonno enorme gira attorno alla barca.

INT./EST. AUTO DI NINA - NOTTE
Nina guida verso Trapani.

5. INT. STUDIO DEL NOTAIO, TRAPANI - GIORNO
Nina posa la penna.

6. EST. TONNARA DI FAVIGNANA - NOTTE
Saro accende la lanterna.
`;

test('divisione in scene: intestazioni italiane, numerate e non', () => {
  const d = dividiScene(COPIONE);
  assert.equal(d.formattata, true);
  assert.deepEqual(d.scene.map((s) => [s.numero, s.intEst, s.ambiente, s.luce, s.pagina]), [
    ['1', 'EST', 'TONNARA DI FAVIGNANA', 'ALBA', 1],
    ['2', 'INT', 'STABILIMENTO FLORIO', 'GIORNO', 1],
    ['3', 'EST', 'MARE APERTO', 'GIORNO', 2],
    ['4', 'INT/EST', 'AUTO DI NINA', 'NOTTE', 2],
    ['5', 'INT', 'STUDIO DEL NOTAIO, TRAPANI', 'GIORNO', 2],
    ['6', 'EST', 'TONNARA DI FAVIGNANA', 'NOTTE', 2],
  ]);
  assert.ok(d.scene[1].testo.includes("L'interno era buio"), 'una frase che comincia per «interno» non è una scena');
  assert.equal(dividiScene('Un trattamento in prosa senza intestazioni.\n'.repeat(20)).formattata, false);
});

// Claude simulato per lo spoglio: restituisce personaggi ed elementi in base al set.
const llmSpoglio = {
  limiteByte: 2_000_000, paralleli: 2, etichetta: 'Finto',
  async chiama(p) {
    const ks = [...p.documenti.matchAll(/### SCENA k=(\d+) — (.*)/g)];
    return { modello: 'finto', json: { scene: ks.map(([, k, intest]) => ({
      k: Number(k), intestazione: intest, int_est: 'INT', luce: 'GIORNO', ambiente: 'X',
      luogo: /FAVIGNANA|FLORIO|MARE/.test(intest) ? 'Favignana' : /TRAPANI/.test(intest) ? 'Trapani' : '',
      sinossi: `Accade qualcosa nella scena ${k}.`, personaggi: /NINA|FLORIO|NOTAIO/.test(intest) ? ['Nina', 'NINA (V.O.)'] : ['SARO'], comparse: '',
      elementi: { scena: /TONNARA/.test(intest) ? ['lanterna'] : [], costumi: [], trucco: [], veicoli: /AUTO/.test(intest) ? ['utilitaria'] : [], animali: /MARE/.test(intest) ? ['tonno'] : [], stunt: [], effetti: [], vfx: /MARE/.test(intest) ? ['tonno in CGI'] : [], suono: [], attrezzature: [] },
      rischi: /MARE/.test(intest) ? ['riprese in mare aperto'] : [],
    })) } };
  },
};

test('spoglio, piano di lavorazione e DOOD', async () => {
  const sp = await eseguiSpoglio({ documento: { nome: 'copione.pdf', testo: COPIONE, pagine: 2 }, titolo: 'Prova', llm: llmSpoglio, opzioni: { modello: 'm' } });
  assert.equal(sp.scene.length, 6);
  assert.deepEqual(sp.personaggi.map((x) => [x.nome, x.scene.length]).sort(), [['NINA', 3], ['SARO', 3]], 'nomi normalizzati, senza (V.O.)');
  assert.equal(sp.location.length, 5, 'la tonnara compare in due scene');
  const perNome = Object.fromEntries(sp.location.map((l) => [l.nome, l.sicilia]));
  assert.equal(perNome['TONNARA DI FAVIGNANA'], true);
  assert.equal(perNome['STUDIO DEL NOTAIO, TRAPANI'], true);
  assert.equal(perNome['AUTO DI NINA'], null, 'set senza luogo: da definire');
  assert.ok(sp.scene.every((s) => s.ottavi >= 1));
  assert.deepEqual(vfxPerScena(sp).map((v) => v.numero), ['3']);
  assert.deepEqual(rischiPerScena(sp).map((v) => v.numero), ['3']);
  assert.deepEqual(elementiPerReparto(sp).scena.map((e) => [e.voce, e.scene]), [['lanterna', ['1', '6']]]);

  // una scena al giorno: diurne e notturne dello stesso set in giornate distinte
  const piano = pianoLavorazione(sp, { ottaviGiorno: 1 });
  assert.equal(piano.totale, 6);
  assert.equal(piano.giorni.find((d) => d.scene.includes('6')).turno, 'NOTTE');
  assert.equal(piano.inSicilia, 5);
  assert.equal(piano.daDefinire, 1);
  sp.location.find((l) => l.nome === 'AUTO DI NINA').sicilia = false;
  const piano2 = pianoLavorazione(sp, { ottaviGiorno: 1 });
  assert.deepEqual([piano2.inSicilia, piano2.daDefinire], [5, 0]);
  // giornate capienti: le scene dello stesso turno si accorpano, giorno e notte restano separati
  const largo = pianoLavorazione(sp, { ottaviGiorno: 80 });
  assert.ok(largo.totale < 6);
  assert.ok(largo.giorni.every((d) => d.turno === 'GIORNO' || d.turno === 'NOTTE'));
  assert.equal(largo.giorni.flatMap((d) => d.scene).length, 6, 'ogni scena è pianificata una volta sola');

  const giornate = dood(sp, piano2);
  const saro = giornate.find((x) => x.nome === 'SARO');
  assert.equal(saro.lavoro, 3);
  assert.equal(saro.attesa, saro.ultimo - saro.primo + 1 - 3);
  assert.equal(pagine(13), '1 5/8');
  assert.ok(csvSpoglio(sp).includes('"TONNARA DI FAVIGNANA"'));
  assert.equal(csvPiano(sp, piano2).split('\r\n').length, 7);
});

test('area legale: scadenze, documenti esaminati, istruzioni fondate sul testo', async () => {
  const s = scadenzario(B, '2027-08-31');
  assert.deepEqual(s.map((x) => [x.id, x.data.toISOString().slice(0, 10), x.preavviso.toISOString().slice(0, 10)]), [['riprese', '2029-02-28', '2029-01-29'], ['rendiconto', '2029-08-31', '2029-08-01']]);
  assert.deepEqual(scadenzario(B, ''), []);
  const p = { categoriaId: 'film', anno: 2027, dati: datiVuoti(), documenti: [
    { nome: 'deal memo.pdf', tipo: 'distribuzione', testo: 'Deal memo' }, { nome: 'sceneggiatura.pdf', tipo: 'sceneggiatura', testo: 'x' }, { nome: 'lettera.pdf', tipo: 'accordi_cast', testo: 'Lettera di intento' },
  ] };
  assert.deepEqual(documentiContrattuali(p.documenti).map((d) => d.nome), ['deal memo.pdf', 'lettera.pdf']);
  const richieste = [];
  const llm = { limiteByte: 2_000_000, paralleli: 2, async chiama(r) {
    richieste.push(r);
    if (r.schema) return { json: { documenti: [{ file: 'deal memo.pdf', natura: 'deal memo', parti: ['A', 'B'], oggetto: 'prevendita', importo: '60.000', data: '', firmato: 'boh', criteri: ['5.2'], idoneo: 'parziale', motivazione: 'm', rischi: ['r1', 'r2', 'r3', 'r4', 'r5'], correzioni: ['c'] }, { file: 'lettera', natura: 'lettera', parti: [], oggetto: '', importo: '', data: '', firmato: 'si', criteri: ['3.2'], idoneo: 'si', motivazione: '', rischi: [], correzioni: [] }], sintesi: 'ok' } };
    return { testo: ' Risposta (art. 7, lett. c). ', modello: 'finto' };
  } };
  const an = await analizzaContratti({ bando: B, progetto: p, llm, opzioni: { modello: 'm' } });
  assert.equal(an.documenti.length, 2);
  assert.equal(an.documenti[0].firmato, 'non_verificabile', 'valore fuori elenco riportato a «non verificabile»');
  assert.equal(an.documenti[0].rischi.length, 4);
  assert.equal(an.documenti[1].file, 'lettera.pdf', 'nome ricondotto al file del dossier');
  assert.ok(!richieste[0].documenti.includes('sceneggiatura.pdf'));
  assert.match(richieste[0].system, /Art\. 10 — /);
  const r = await chiediAlBando({ bando: B, progetto: p, domanda: 'Il tax credit conta?', storia: [{ domanda: 'prima', risposta: 'risposta precedente' }], llm, opzioni: { modello: 'm' } });
  assert.equal(r.risposta, 'Risposta (art. 7, lett. c).');
  const q = richieste.at(-1);
  assert.match(q.documenti, /Art\. 18 — /, 'tutto il testo dell’avviso');
  assert.match(q.documenti, /5\.1 Solidità del piano finanziario/);
  assert.match(q.compito, /risposta precedente[\s\S]*Domanda: Il tax credit conta\?/);
  const b = await redigiBozza({ bando: B, progetto: p, tipo: 'lettera_intento', indicazioni: 'DOP Mario Rossi', llm, opzioni: { modello: 'm' } });
  assert.equal(b.nome, 'Lettera di intento con artista o tecnico');
  assert.match(richieste.at(-1).compito, /DOP Mario Rossi/);
});
