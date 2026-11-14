// Protocollo di aggiornamento dei bandi: canale del catalogo, pagine ufficiali, download protetto, rotte del server.
// Tutto contro un server HTTP locale di prova: nessuna richiesta esce verso Internet. Bandi, enti e pagine sono d'invenzione.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

process.env.CLOCKWISE_CLAUDE_BIN = path.join(os.tmpdir(), 'clockwise-claude-inesistente');
delete process.env.ANTHROPIC_API_KEY;
const { sanificaBando, validaBando } = await import('../app/js/core/bandi/schema.js');
const A = await import('../app/js/core/aggiornamenti.js');
const { scarica, indirizzoPrivato, creaAggiornamenti, pagineDi, ErroreRete } = await import('../server/aggiornamenti.js');
const { creaServer, chiudiServer } = await import('../server/servizio.js');
const { fornitoreCartella } = await import('../server/statici.js');
const { confrontaConLock, rapportoTesto, rapportoMarkdown } = await import('../scripts/controlla-bandi.mjs');

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

/* ------------------------------------------------------------------ dati d'invenzione */

/** Un bando valido con una griglia minima (100 punti in due sezioni). */
function bandoDiProva(id = 'regione-prova-2027', revisione = '2026-10-01', extra = {}) {
  return sanificaBando({
    id, revisione, nome: `Fondo di prova ${id}`, nomeBreve: 'Prova', ente: 'Ente inventato per i test', regione: 'Provincia di Prova', stato: 'aperto', tipoValutazione: 'punteggio',
    paginaUfficiale: 'https://ente.test/bandi', sogliaTotale: 60, punteggioMassimo: 100,
    categorie: [{ id: 'film', nome: 'Film', griglia: 'A', soglie: { A: 20 }, contributo: { percentuale: 40, massimali: { 2027: 200000 } } }],
    griglie: { A: { nome: 'Griglia unica', sezioni: [
      { id: 'A', nome: 'Qualità', max: 60, criteri: [{ id: 'A1', nome: 'Sceneggiatura', max: 40, tipo: 'qualitativo', famiglia: 'scrittura' }, { id: 'A2', nome: 'Regia', max: 20, tipo: 'qualitativo', famiglia: 'visione' }] },
      { id: 'B', nome: 'Territorio', max: 40, criteri: [{ id: 'B1', nome: 'Spesa sul territorio', max: 40, tipo: 'fasce', metrica: 'spesaSicilia', peso: 4, famiglia: 'ricaduta_spesa', fasce: [{ oltre: 150, punti: 10, etichetta: 'Oltre il 150%' }, { da: 0, punti: 5, etichetta: 'Fino al 150%' }] }] },
    ] } },
    affidabilita: { griglia: 'testo_ufficiale', citazioni: [{ riferimento: 'art. 9', testo: 'Testo inventato.' }] },
    ...extra,
  });
}
/** Voce di catalogo come la scrive scripts/genera-bandi.mjs. */
const voce = (b) => ({ id: b.id, revisione: b.revisione, sha256: sha256(JSON.stringify(b)), bando: b });
const catalogoDi = (...bandi) => ({ schema: 1, revisione: bandi.map((b) => b.revisione).sort().at(-1) || '', bandi: bandi.map(voce) });

/* ------------------------------------------------------------------ server di prova (finti siti degli enti e finto canale) */

const sito = { risposte: new Map(), richieste: [] };
let finto, porta;
const NOMI = { 'ente.test': ['93.184.216.34'], 'altro-ente.test': ['93.184.216.40'], 'canale.test': ['93.184.216.35'], 'interno.test': ['10.0.0.8'], 'misto.test': ['93.184.216.36', '192.168.1.20'], 'fermo.test': ['93.184.216.37'] };
/** Rete delle prove: http verso il server locale, con nomi «pubblici» inventati; la regola sugli indirizzi privati resta quella vera. */
const rete = {
  protocolli: ['http:'], qualsiasiPorta: true, env: {},
  risolvi: async (nome) => { if (!NOMI[nome]) throw Object.assign(new Error('sconosciuto'), { code: 'ENOTFOUND' }); return NOMI[nome].map((address) => ({ address, family: 4 })); },
  instrada: () => ({ address: '127.0.0.1', family: 4 }),
};
const u = (host, percorso) => `http://${host}:${porta}${percorso}`;
const rispondi = (percorso, corpo, { stato = 200, tipo = 'text/html; charset=utf-8', intestazioni = {} } = {}) => sito.risposte.set(percorso, { stato, intestazioni: { 'content-type': tipo, ...intestazioni }, corpo });

before(async () => {
  finto = http.createServer((req, res) => {
    sito.richieste.push({ url: req.url, host: req.headers.host, intestazioni: req.headers });
    const r = sito.risposte.get(req.url);
    if (typeof r === 'function') return r(req, res);
    if (!r) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('non trovato'); }
    res.writeHead(r.stato, r.intestazioni);
    res.end(r.corpo);
  });
  await new Promise((ok) => finto.listen(0, '127.0.0.1', ok));
  porta = finto.address().port;
});
after(async () => { finto.closeAllConnections(); await new Promise((ok) => finto.close(ok)); });

const PAGINA_BASE = `<!doctype html><html><head><title>Bandi</title>
<script>var x = '<a href="/finto-da-script.pdf">no</a>';</script><!-- <a href="/commentato.pdf">vecchio</a> -->
</head><body>
<nav><a href="/">Home</a> <a href="/chi-siamo">Chi siamo</a> <a href="mailto:info@ente.test">Scrivici</a> <a href="javascript:void(0)">Menu</a></nav>
<a href="documenti/avviso-pubblico-2027.pdf?utm_source=newsletter&amp;PHPSESSID=abc123">Avviso pubblico 2027 &ndash; testo integrale</a>
<a href="/documenti/avviso-pubblico-2027.pdf#pagina=3">Scarica l&rsquo;avviso</a>
<a href='/documenti/modulo-domanda.docx;jsessionid=9F3A?sid=77'>Modulo di domanda</a>
<a href="https://ente.test/documenti/graduatoria-2026.pdf">Graduatoria <b>2026</b></a>
<a href="/notizie/proroga-termini?id=12&fbclid=zzz">Proroga dei termini</a>
<a href="/faq">FAQ</a>
<a href="/download.php?file=allegato%20B.xlsx&_=1699999999">Scarica</a>
<a href="//cdn.ente.test/archivio/decreto-12.pdf.p7m"><img src="pdf.png" alt="Decreto n. 12 firmato"></a>
<a href="http://utente:segreto@ente.test/privato.pdf">Con credenziali</a>
<a href="/contatti">Contatti</a>
</body></html>`;

/* ================================================================== A. canale del catalogo */

test('catalogo valido: la voce più recente è accettata e si sovrappone al bando del programma', async () => {
  const inProgramma = { ...bandoDiProva('regione-prova-2027', '2026-09-01'), predefinito: true, simulabile: true, verificato: true, testi: ['testo integrale incorporato'] };
  const nuovo = bandoDiProva('regione-prova-2027', '2026-10-01', { sogliaTotale: 65 });
  const inedito = bandoDiProva('altra-regione-2027', '2026-10-05');
  const v = await A.verificaCatalogo(catalogoDi(nuovo, inedito), A.revisioniInUso([inProgramma], []), { oggi: '2026-11-14' });
  assert.equal(v.ok, true);
  assert.deepEqual(v.accettati.map((b) => b.id), ['regione-prova-2027', 'altra-regione-2027']);
  assert.deepEqual(v.scartati, []);
  assert.equal(v.revisione, '2026-10-05');

  const salvati = Object.fromEntries(v.accettati.map((b) => [b.id, b]));
  const { bandi } = A.applicaAggiornamenti([inProgramma], [], salvati);
  const aggiornato = bandi.find((b) => b.id === 'regione-prova-2027');
  assert.equal(aggiornato.sogliaTotale, 65, 'vale la griglia arrivata dal canale');
  assert.equal(aggiornato.aggiornato, '2026-10-01');
  assert.deepEqual(aggiornato.testi, ['testo integrale incorporato'], 'restano i campi che il catalogo non porta');
  assert.ok(bandi.some((b) => b.id === 'altra-regione-2027'), 'un bando nuovo entra nel catalogo');

  // al controllo successivo le stesse voci non sono più una novità
  const dopo = await A.verificaCatalogo(catalogoDi(nuovo, inedito), A.revisioniInUso([inProgramma], [], salvati), { oggi: '2026-11-14' });
  assert.equal(dopo.accettati.length, 0);
  assert.equal(dopo.invariati, 2);
  assert.deepEqual(dopo.scartati, []);
});

test('catalogo: impronta sbagliata, contenuto alterato, impronta assente', async () => {
  const b = bandoDiProva();
  const alterata = voce(b); alterata.bando = { ...b, sogliaTotale: 10 }; // contenuto cambiato dopo il calcolo dell'impronta
  const sbagliata = { ...voce(bandoDiProva('secondo-2027')), sha256: 'a'.repeat(64) };
  const assente = { ...voce(bandoDiProva('terzo-2027')) }; delete assente.sha256;
  const v = await A.verificaCatalogo({ schema: 1, revisione: '2026-10-01', bandi: [alterata, sbagliata, assente] }, {}, { oggi: '2026-11-14' });
  assert.equal(v.ok, true);
  assert.equal(v.accettati.length, 0);
  assert.equal(v.scartati.length, 3);
  assert.match(v.scartati[0].motivo, /impronta sha256 non corrispondente/);
  assert.match(v.scartati[1].motivo, /impronta sha256 non corrispondente/);
  assert.match(v.scartati[2].motivo, /impronta sha256 mancante/);
});

test('catalogo: revisione vecchia scartata, uguale ignorata in silenzio, datata nel futuro rifiutata', async () => {
  const inUso = { 'regione-prova-2027': '2026-10-01', 'uguale-2027': '2026-10-01' };
  const v = await A.verificaCatalogo(catalogoDi(bandoDiProva('regione-prova-2027', '2026-05-20'), bandoDiProva('uguale-2027', '2026-10-01'), bandoDiProva('futuro-2027', '2031-01-01')), inUso, { oggi: '2026-11-14' });
  assert.equal(v.accettati.length, 0);
  assert.equal(v.invariati, 1);
  assert.equal(v.scartati.length, 2);
  assert.match(v.scartati.find((s) => s.id === 'regione-prova-2027').motivo, /più vecchia di quella in uso \(2026-10-01\)/);
  assert.match(v.scartati.find((s) => s.id === 'futuro-2027').motivo, /futuro/);
  // applicaAggiornamenti non torna mai indietro, nemmeno se una voce vecchia fosse rimasta nell'archivio
  const attuale = { ...bandoDiProva('regione-prova-2027', '2026-10-01'), predefinito: true, simulabile: true, verificato: true };
  const { bandi } = A.applicaAggiornamenti([attuale], [], { x: bandoDiProva('regione-prova-2027', '2026-05-20', { sogliaTotale: 1 }) });
  assert.equal(bandi[0].sogliaTotale, 60);
  assert.deepEqual(A.potaSalvati([attuale], [], { x: bandoDiProva('regione-prova-2027', '2026-05-20'), y: bandoDiProva('nuovo-2027', '2026-11-01') }), { 'nuovo-2027': bandoDiProva('nuovo-2027', '2026-11-01') });
});

test('catalogo: schema futuro, forma sbagliata, voci ripetute o incoerenti', async () => {
  const futuro = await A.verificaCatalogo({ schema: 2, revisione: '2027-01-01', bandi: [voce(bandoDiProva())] }, {});
  assert.equal(futuro.ok, false);
  assert.match(futuro.motivo, /schema 2.*versione aggiornata di Clockwise/);
  assert.equal(futuro.accettati.length, 0);
  for (const grezzo of [null, 'testo', 42, [], { schema: 1 }, { schema: 1, bandi: {} }, { schema: '1', bandi: [] }, { bandi: [] }]) {
    const v = await A.verificaCatalogo(grezzo, {});
    assert.equal(v.ok, false, JSON.stringify(grezzo));
    assert.ok(v.motivo);
  }
  const b = bandoDiProva();
  const altroId = { ...voce(b), id: 'nome-diverso' };
  const altraRevisione = { ...voce(b), revisione: '2026-12-31' };
  const v = await A.verificaCatalogo({ schema: 1, bandi: [voce(b), voce(b), altroId, altraRevisione, null, { id: 'vuota' }, { id: 'constructor', revisione: '2026-10-01', sha256: 'b'.repeat(64), bando: [] }] }, {}, { oggi: '2026-11-14' });
  assert.equal(v.accettati.length, 1);
  assert.deepEqual(v.scartati.map((s) => s.motivo.split(':')[0]), ['identificativo ripetuto nel catalogo', 'identificativo diverso da quello dichiarato', 'identificativo ripetuto nel catalogo', 'voce incompleta', 'voce incompleta', 'voce incompleta']);
});

test('catalogo: un bando che non supera validaBando è scartato con il motivo', async () => {
  const rotto = bandoDiProva('rotto-2027', '2026-10-01');
  rotto.griglie.A.sezioni[0].criteri[0].max = 55; // la sezione non somma più al suo massimo
  assert.equal(validaBando(rotto).ok, false);
  const v = await A.verificaCatalogo(catalogoDi(rotto, bandoDiProva('sano-2027')), {}, { oggi: '2026-11-14' });
  assert.deepEqual(v.accettati.map((b) => b.id), ['sano-2027']);
  assert.equal(v.scartati.length, 1);
  assert.match(v.scartati[0].motivo, /non supera il controllo della griglia: .*Sezione A/);
  // ciò che entra è sempre il bando ripulito: campi imprevisti e indirizzi non http spariscono
  const sporco = { ...bandoDiProva('sporco-2027'), paginaUfficiale: 'javascript:alert(1)', inatteso: '<script>', nome: 'Fondo\u0000 con caratteri di controllo' };
  const w = await A.verificaCatalogo({ schema: 1, bandi: [voce(sporco)] }, {}, { oggi: '2026-11-14' });
  assert.equal(w.accettati.length, 1);
  assert.equal(w.accettati[0].paginaUfficiale, '');
  assert.equal('inatteso' in w.accettati[0], false);
  assert.equal(w.accettati[0].nome, 'Fondo con caratteri di controllo');
});

test('impronta: coincide con sha256 di Node', async () => {
  for (const t of ['', 'abc', 'àèìòù — ’', 'x'.repeat(100000)]) assert.equal(await A.impronta(t), sha256(t));
  assert.equal(await A.improntaDocumenti([{ url: 'https://a.test/1.pdf', titolo: 'Uno' }, { url: 'https://a.test/2.pdf', titolo: 'Due' }]), sha256('https://a.test/1.pdf\nhttps://a.test/2.pdf'));
});

/* ================================================================== B. pagine ufficiali: elenco dei documenti */

test('estraiDocumenti: link relativi, doppioni, parametri di sessione e di tracciamento', () => {
  const { documenti, troncato } = A.estraiDocumenti(PAGINA_BASE, 'https://ente.test/bandi/');
  assert.equal(troncato, false);
  assert.deepEqual(documenti.map((d) => [d.tipo, d.url]), [
    ['p7m', 'https://cdn.ente.test/archivio/decreto-12.pdf.p7m'],
    ['pdf', 'https://ente.test/bandi/documenti/avviso-pubblico-2027.pdf'],
    ['pdf', 'https://ente.test/documenti/avviso-pubblico-2027.pdf'],
    ['pdf', 'https://ente.test/documenti/graduatoria-2026.pdf'],
    ['docx', 'https://ente.test/documenti/modulo-domanda.docx'],
    ['xlsx', 'https://ente.test/download.php?file=allegato%20B.xlsx'],
    ['pagina', 'https://ente.test/faq'],
    ['pagina', 'https://ente.test/notizie/proroga-termini?id=12'],
  ]);
  const titolo = (percorso) => documenti.find((d) => d.url === `https://${percorso}`).titolo;
  assert.equal(titolo('ente.test/bandi/documenti/avviso-pubblico-2027.pdf'), 'Avviso pubblico 2027 – testo integrale');
  assert.equal(titolo('ente.test/documenti/graduatoria-2026.pdf'), 'Graduatoria 2026');
  assert.equal(titolo('cdn.ente.test/archivio/decreto-12.pdf.p7m'), 'Decreto n. 12 firmato');
  assert.equal(titolo('ente.test/documenti/avviso-pubblico-2027.pdf'), 'Scarica l’avviso');
  assert.equal(titolo('ente.test/download.php?file=allegato%20B.xlsx'), 'Scarica');
  // stesso contenuto in altro ordine e con altri parametri volatili: stesso elenco, stessa impronta
  const rimescolata = PAGINA_BASE.replace('PHPSESSID=abc123', 'PHPSESSID=zzz999').replace('utm_source=newsletter', 'utm_campaign=x').replace('fbclid=zzz', 'gclid=1').replace('<a href="/faq">FAQ</a>', '').replace('</body>', '<a href="/faq#top">FAQ</a></body>');
  assert.deepEqual(A.estraiDocumenti(rimescolata, 'https://ente.test/bandi/').documenti.map((d) => d.url), documenti.map((d) => d.url));
  // <base href> sposta la radice dei link relativi
  const conBase = A.estraiDocumenti('<head><base href="https://archivio.ente.test/2027/"></head><a href="avviso.pdf">Avviso</a>', 'https://ente.test/bandi/');
  assert.deepEqual(conBase.documenti.map((d) => d.url), ['https://archivio.ente.test/2027/avviso.pdf']);
  assert.deepEqual(A.estraiDocumenti('', 'https://ente.test/').documenti, []);
  assert.deepEqual(A.estraiDocumenti(null, 'https://ente.test/').documenti, []);
});

test('normalizzaUrl e tipoDocumento: casi limite', () => {
  const n = (h) => A.normalizzaUrl(h, 'https://ente.test/a/b/');
  assert.equal(n('../c.pdf'), 'https://ente.test/a/c.pdf');
  assert.equal(n('  /x.PDF  '), 'https://ente.test/x.PDF');
  assert.equal(n('/x.pdf?download'), 'https://ente.test/x.pdf?download', 'un parametro senza valore resta com’è');
  assert.equal(n('/x.pdf?a=1&utm_medium=mail&b=2&_ga=9'), 'https://ente.test/x.pdf?a=1&b=2');
  assert.equal(n('HTTPS://ENTE.TEST:443/x.pdf'), 'https://ente.test/x.pdf');
  for (const cattivo of ['#sezione', '', 'javascript:alert(1)', 'data:text/html,ciao', 'mailto:a@b.it', 'ftp://ente.test/x.pdf', 'file:///etc/passwd', 'https://utente@ente.test/x.pdf', 'http://[', null, 12, `/${'x'.repeat(1200)}.pdf`]) assert.equal(n(cattivo), '', String(cattivo).slice(0, 40));
  assert.equal(A.tipoDocumento('https://ente.test/a/Avviso%20Pubblico.PDF'), 'pdf');
  assert.equal(A.tipoDocumento('https://ente.test/scarica?doc=bando.docx&v=2'), 'docx');
  assert.equal(A.tipoDocumento('https://ente.test/cartella.pdf/'), 'pdf');
  assert.equal(A.tipoDocumento('https://ente.test/pagina.html'), '');
  assert.equal(A.tipoDocumento('https://ente.test/pdf'), '');
  assert.equal(A.tipoDocumento('non è un indirizzo'), '');
  assert.equal(A.decodificaEntita('Citt&agrave; &amp; &#232; &#xE8; &sconosciuta; &#0; &#x110000;'), 'Città & è è &sconosciuta;    ');
});

test('estraiDocumenti: pagine ostili o malformate non bloccano il programma', () => {
  const inizio = Date.now();
  const casi = [
    '<a '.repeat(300000),                                   // ancore mai chiuse
    '<!--'.repeat(300000),                                  // commenti mai chiusi
    `<script>${'<script>'.repeat(200000)}`,                 // script mai chiuso
    `<a href="${'"'.repeat(500000)}`,                       // virgolette spaiate
    `<a href=/x.pdf ${'x=">" '.repeat(100000)}>Avviso</a>`, // attributi interminabili
    '<a href="/x.pdf">'.repeat(100000),                     // ancore annidate senza chiusura
  ];
  for (const html of casi) {
    const r = A.estraiDocumenti(html, 'https://ente.test/');
    assert.ok(Array.isArray(r.documenti));
    assert.ok(r.documenti.length <= 400);
  }
  assert.ok(Date.now() - inizio < 5000, `troppo lento: ${Date.now() - inizio} ms`);
  // oltre il massimo l'elenco viene troncato e lo dice
  const tante = Array.from({ length: 450 }, (_, i) => `<a href="/doc-${String(i).padStart(3, '0')}.pdf">Documento ${i}</a>`).join('');
  const r = A.estraiDocumenti(tante, 'https://ente.test/');
  assert.equal(r.documenti.length, 400);
  assert.equal(r.troncato, true);
});

/* ================================================================== B. pagine ufficiali: rilevazioni successive */

const rilevazione = (pagine) => ({ url: pagine[0].url, impronta: 'f'.repeat(64), pagine });
const doc = (nome, titolo = nome) => ({ url: `https://ente.test/documenti/${nome}`, titolo, tipo: A.tipoDocumento(`https://ente.test/documenti/${nome}`) || 'pagina' });

test('rilevazione di documenti nuovi: la prima fa da base, poi contano solo quelli mai visti', () => {
  const pagina = 'https://ente.test/bandi';
  // 1. prima rilevazione: base, nessun avviso
  const prima = A.aggiornaSorgente(null, rilevazione([{ url: pagina, documenti: [doc('avviso-2026.pdf'), doc('modulo.docx')] }]), '2026-11-01T08:00:00.000Z');
  assert.equal(prima.primaRilevazione, true);
  assert.deepEqual(prima.nuovi, []);
  assert.deepEqual(prima.stato.nuovi, []);
  assert.equal(prima.stato.documenti, 2);
  assert.equal(prima.stato.basi[pagina], '2026-11-01T08:00:00.000Z');
  // 2. niente di cambiato
  const seconda = A.aggiornaSorgente(prima.stato, rilevazione([{ url: pagina, documenti: [doc('modulo.docx'), doc('avviso-2026.pdf')] }]), '2026-11-02T08:00:00.000Z');
  assert.deepEqual(seconda.nuovi, []);
  assert.equal(seconda.primaRilevazione, false);
  // 3. compare l'avviso nuovo
  const terza = A.aggiornaSorgente(seconda.stato, rilevazione([{ url: pagina, documenti: [doc('avviso-2026.pdf'), doc('avviso-2027.pdf', 'Avviso pubblico 2027'), doc('modulo.docx')] }]), '2026-11-03T08:00:00.000Z');
  assert.deepEqual(terza.nuovi.map((d) => d.url), ['https://ente.test/documenti/avviso-2027.pdf']);
  assert.deepEqual(terza.nuovi[0], { url: 'https://ente.test/documenti/avviso-2027.pdf', titolo: 'Avviso pubblico 2027', tipo: 'pdf', pagina, rilevato: '2026-11-03T08:00:00.000Z' });
  assert.equal(terza.stato.nuovi.length, 1);
  // 4. la novità non ancora guardata resta segnalata una volta sola; se ne aggiunge un'altra
  const quarta = A.aggiornaSorgente(terza.stato, rilevazione([{ url: pagina, documenti: [doc('avviso-2027.pdf'), doc('faq-2027.pdf')] }]), '2026-11-04T08:00:00.000Z');
  assert.deepEqual(quarta.nuovi.map((d) => d.url), ['https://ente.test/documenti/faq-2027.pdf']);
  assert.equal(quarta.stato.nuovi.length, 2);
  // 5. «Segna come controllato» toglie l'avviso; un documento tolto e rimesso non torna a essere nuovo
  const guardato = A.segnaControllato(quarta.stato);
  assert.deepEqual(guardato.nuovi, []);
  const quinta = A.aggiornaSorgente(guardato, rilevazione([{ url: pagina, documenti: [doc('modulo.docx'), doc('avviso-2026.pdf'), doc('avviso-2027.pdf'), doc('faq-2027.pdf')] }]), '2026-11-05T08:00:00.000Z');
  assert.deepEqual(quinta.nuovi, []);
});

test('pagina non raggiungibile o aggiunta dopo: nessun falso allarme', () => {
  const principale = 'https://ente.test/bandi', seconda = 'https://altro-ente.test/atti';
  let s = A.aggiornaSorgente(null, rilevazione([{ url: principale, documenti: [doc('a.pdf')] }, { url: seconda, errore: 'sito non raggiungibile' }]), '2026-11-01T08:00:00.000Z').stato;
  assert.equal(s.errore, '', 'una pagina secondaria ferma non è un errore del bando');
  // la seconda pagina risponde per la prima volta: i suoi documenti fanno da base
  let r = A.aggiornaSorgente(s, rilevazione([{ url: principale, documenti: [doc('a.pdf')] }, { url: seconda, documenti: [doc('vecchio-decreto.pdf')] }]), '2026-11-02T08:00:00.000Z');
  assert.deepEqual(r.nuovi, []);
  // tutto fermo: lo stato resta com'era e l'errore viene annotato
  r = A.aggiornaSorgente(r.stato, { url: principale, errore: 'sito non raggiungibile', pagine: [{ url: principale, errore: 'il sito non ha risposto in tempo' }, { url: seconda, errore: 'sito non raggiungibile' }] }, '2026-11-03T08:00:00.000Z');
  assert.equal(r.riuscita, false);
  assert.equal(r.stato.errore, 'il sito non ha risposto in tempo');
  assert.equal(r.stato.controllato, '2026-11-02T08:00:00.000Z');
  assert.equal(r.stato.noti.length, 2);
  // al ritorno, i documenti di prima non sono novità; quello davvero nuovo sì
  r = A.aggiornaSorgente(r.stato, rilevazione([{ url: principale, documenti: [doc('a.pdf'), doc('b.pdf')] }, { url: seconda, documenti: [doc('vecchio-decreto.pdf')] }]), '2026-11-04T08:00:00.000Z');
  assert.deepEqual(r.nuovi.map((d) => d.url), ['https://ente.test/documenti/b.pdf']);
  assert.equal(r.stato.errore, '');
  // dati sporchi in arrivo dalle pagine: indirizzi non http scartati, titoli ripuliti
  r = A.aggiornaSorgente(r.stato, rilevazione([{ url: principale, documenti: [{ url: 'javascript:alert(1)', titolo: 'x', tipo: 'pdf' }, { url: 'https://ente.test/c.pdf', titolo: '<b>Bando</b>\u0007 nuovo', tipo: 'eseguibile' }, null] }]), '2026-11-05T08:00:00.000Z');
  assert.deepEqual(r.nuovi.map((d) => [d.url, d.titolo, d.tipo]), [['https://ente.test/c.pdf', 'Bando nuovo', 'pdf']]);
});

test('scelta del candidato avviso tra i documenti nuovi', () => {
  const d = (nome, titolo) => ({ url: `https://ente.test/doc/${nome}`, titolo, tipo: A.tipoDocumento(`https://ente.test/doc/${nome}`) || 'pagina' });
  const nuovi = [
    d('graduatoria-definitiva.pdf', 'Graduatoria definitiva avviso pubblico 2026'),
    d('faq.pdf', 'FAQ sull’avviso pubblico'),
    d('modulo-1.pdf', 'Modulo di domanda'),
    d('proroga.pdf', 'Proroga dei termini dell’avviso pubblico'),
    d('DDG_4788.pdf', 'Avviso pubblico 2027 – testo coordinato'),
    d('bando.docx', 'Bando 2027'),
    d('notizia', 'Pubblicato il nuovo avviso'),
  ];
  assert.equal(A.candidatoAvviso(nuovi).url, 'https://ente.test/doc/DDG_4788.pdf');
  assert.equal(A.candidatoAvviso(nuovi, ['https://ente.test/doc/DDG_4788.pdf']), null, 'mai due volte lo stesso documento');
  assert.equal(A.candidatoAvviso([nuovi[0], nuovi[1], nuovi[2], nuovi[3], nuovi[5], nuovi[6]]), null, 'graduatorie, FAQ, moduli e proroghe non sono griglie; i .docx e le pagine non si leggono da soli');
  assert.equal(A.candidatoAvviso([d('allegato-a.pdf', 'Allegato A – Avviso pubblico'), d('allegato-b.pdf', 'Allegato B – Schema di domanda')]).url, 'https://ente.test/doc/allegato-a.pdf');
  assert.equal(A.candidatoAvviso([d('FF2027_Regolamento_definitivo.pdf', 'REGOLAMENTO FILM FUND'), d('FF2027_Check_List.pdf', 'CHECK LIST'), d('elenco.pdf', 'ELENCO 2026')]).url, 'https://ente.test/doc/FF2027_Regolamento_definitivo.pdf');
  const inChiaro = [{ url: 'http://ente.test/doc/avviso.pdf', titolo: 'Avviso pubblico', tipo: 'pdf' }];
  assert.equal(A.candidatoAvviso(inChiaro), null, 'solo documenti che il server può scaricare: di norma https');
  assert.equal(A.candidatoAvviso(inChiaro, [], ['http:', 'https:']), inChiaro[0]);
  assert.equal(A.scaricabile('https://ente.test/a.pdf'), true);
  assert.equal(A.scaricabile('http://ente.test/a.pdf'), false);
  assert.equal(A.scaricabile('javascript:alert(1)', ['http:', 'https:']), false);
  assert.equal(A.scaricabile('storto', []), false);
  assert.equal(A.candidatoAvviso([]), null);
  assert.equal(A.candidatoAvviso(null), null);
  // a parità di indizi la scelta non dipende dall'ordine
  const pari = [d('b-avviso.pdf', 'Avviso'), d('a-avviso.pdf', 'Avviso')];
  assert.equal(A.candidatoAvviso(pari).url, A.candidatoAvviso([...pari].reverse()).url);
});

test('confrontaGriglie: criteri e massimi cambiati, aggiunti, tolti', () => {
  const attuale = bandoDiProva();
  assert.equal(A.confrontaGriglie(attuale, bandoDiProva()).uguale, true);
  const proposta = bandoDiProva('letto-da-claude', '', { sogliaTotale: 70 });
  const [qualita, territorio] = proposta.griglie.A.sezioni;
  qualita.criteri[0].max = 35;                                         // A1: 40 → 35
  qualita.criteri.push({ id: 'A3', nome: 'Sostenibilità', max: 5, tipo: 'qualitativo', famiglia: 'sostenibilita' }); // nuovo
  territorio.criteri[0].fasce[0].oltre = 160;                           // B1: stessi punti, soglia della fascia cambiata
  proposta.categorie[0].soglie.A = 25;
  proposta.categorie[0].contributo.percentuale = 35;
  delete qualita.criteri.splice(1, 1);                                  // A2 tolto
  qualita.max = 40;
  const c = A.confrontaGriglie(attuale, proposta);
  assert.equal(c.uguale, false);
  assert.deepEqual(c.generali, [{ voce: 'Soglia complessiva', prima: 60, dopo: 70 }]);
  assert.deepEqual(c.sezioni.map((s) => [s.id, s.prima, s.dopo, s.tipo]), [['A', 60, 40, 'cambiato']]);
  assert.deepEqual(c.criteri.map((x) => [x.id, x.prima, x.dopo, x.tipo, x.regola]), [['A1', 40, 35, 'cambiato', false], ['A3', null, 5, 'nuovo', false], ['A2', 20, null, 'tolto', false], ['B1', 40, 40, 'cambiato', true]]);
  assert.deepEqual(c.categorie.map((x) => [x.voce, x.prima, x.dopo]), [['Minimo della sezione A', 20, 25], ['Contributo massimo (% del costo)', 40, 35]]);
  assert.deepEqual(c.totali, { cambiati: 2, nuovi: 1, tolti: 1 });
  // griglia con un altro identificativo (succede quando la legge Claude): si accoppia per posizione
  const rinominata = bandoDiProva();
  rinominata.griglie = { unica: { ...rinominata.griglie.A, id: 'unica' } };
  rinominata.categorie[0].griglia = 'unica';
  assert.equal(A.confrontaGriglie(attuale, rinominata).uguale, true);
  assert.equal(A.confrontaGriglie(null, attuale).uguale, false);
});

test('registro senza ripetizioni e cadenza dei controlli', () => {
  let reg = A.unisciRegistro([], [{ quando: 't1', tipo: 'canale', testo: 'Canale a posto', gruppo: 'canale', chiave: 'ok', quieto: true }]);
  assert.equal(reg.length, 0, 'il primo «tutto a posto» non si racconta');
  reg = A.unisciRegistro(reg, [{ quando: 't2', tipo: 'canale', testo: 'Canale non raggiungibile', gruppo: 'canale', chiave: 'non_raggiungibile' }]);
  reg = A.unisciRegistro(reg, [{ quando: 't3', tipo: 'canale', testo: 'Canale non raggiungibile', gruppo: 'canale', chiave: 'non_raggiungibile' }]);
  assert.equal(reg.length, 1, 'lo stesso stato non si ripete a ogni controllo');
  reg = A.unisciRegistro(reg, [{ quando: 't4', tipo: 'novita', testo: 'Due documenti nuovi', bando: 'x' }, { quando: 't4', tipo: 'canale', testo: 'Canale di nuovo raggiungibile', gruppo: 'canale', chiave: 'ok', quieto: true }]);
  assert.deepEqual(reg.map((e) => e.testo), ['Canale non raggiungibile', 'Due documenti nuovi', 'Canale di nuovo raggiungibile']);
  assert.equal(A.unisciRegistro(reg, Array.from({ length: 500 }, (_, i) => ({ quando: 't', tipo: 'novita', testo: `evento ${i}` }))).length, A.MAX_REGISTRO);
  assert.deepEqual(A.unisciRegistro(null, [null, { testo: 5 }]), []);

  const ora = Date.parse('2026-11-14T12:00:00Z');
  assert.equal(A.controlloDovuto({}, 12, ora), true, 'mai controllato');
  assert.equal(A.controlloDovuto({ ultimoControllo: '2026-11-14T01:00:00Z' }, 12, ora), false, '11 ore fa');
  assert.equal(A.controlloDovuto({ ultimoControllo: '2026-11-13T23:59:00Z' }, 12, ora), true, 'più di 12 ore fa');
  assert.equal(A.controlloDovuto({ ultimoControllo: '2026-11-14T05:30:00Z' }, 6, ora), true, 'a programma aperto bastano 6 ore');
  assert.equal(A.controlloDovuto({ ultimoControllo: '2026-11-10T00:00:00Z', ultimoTentativo: '2026-11-14T11:30:00Z' }, 12, ora), false, 'dopo un tentativo fallito si aspetta un’ora');
  assert.equal(A.controlloDovuto({ ultimoControllo: '2026-11-10T00:00:00Z', ultimoTentativo: '2026-11-14T10:30:00Z' }, 12, ora), true);
  assert.equal(A.controlloDovuto({ ultimoControllo: '2030-01-01T00:00:00Z' }, 12, ora), true, 'orologio spostato all’indietro');
  assert.equal(A.controlloDovuto({ ultimoControllo: 'non è una data' }, 12, ora), true);
});

/* ================================================================== server: download protetto */

test('indirizzoPrivato: questo computer, reti locali e indirizzi riservati', () => {
  for (const ip of ['127.0.0.1', '127.8.9.10', '10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '192.0.2.5', '198.51.100.7', '203.0.113.9',
    '::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '::127.0.0.1', 'fe80::1', 'fe80::1%eth0', 'fd00::1', 'fc00::1', 'ff02::1', '64:ff9b::7f00:1', '2002:7f00:1::', '2001:db8::1', '[::1]', 'ente.test', '', null, undefined]) {
    assert.equal(indirizzoPrivato(ip), true, String(ip));
  }
  for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '172.15.255.255', '100.128.0.1', '2606:4700::1111', '2a00:1450:4002:400::200e', '::ffff:8.8.8.8']) assert.equal(indirizzoPrivato(ip), false, ip);
});

test('scarica: si presenta come Clockwise e non invia cookie, provenienza o altri dati', async () => {
  rispondi('/pagina', PAGINA_BASE);
  sito.richieste.length = 0;
  const r = await scarica(u('ente.test', '/pagina'), { rete, versione: '9.9.9' });
  assert.equal(r.stato, 200);
  assert.equal(r.corpo.toString('utf8'), PAGINA_BASE);
  const { intestazioni } = sito.richieste[0];
  assert.equal(intestazioni['user-agent'], 'Clockwise/9.9.9 (controllo aggiornamenti bandi)');
  assert.deepEqual(Object.keys(intestazioni).sort(), ['accept', 'accept-encoding', 'accept-language', 'connection', 'host', 'user-agent']);
  assert.equal(intestazioni.host, `ente.test:${porta}`);
});

test('scarica: fuori dalle prove vale solo https, sulla porta standard, senza credenziali', async () => {
  const vera = { risolvi: rete.risolvi, instrada: rete.instrada, env: {} }; // protocolli e porte come nel programma
  await assert.rejects(scarica('http://ente.test/pagina', { rete: vera }), (e) => e instanceof ErroreRete && e.codice === 'protocollo');
  await assert.rejects(scarica(`https://ente.test:${porta}/pagina`, { rete: vera }), (e) => e.codice === 'porta');
  await assert.rejects(scarica('https://utente:segreto@ente.test/pagina', { rete: vera }), (e) => e.codice === 'credenziali');
  for (const cattivo of ['file:///etc/passwd', 'ftp://ente.test/x', 'javascript:alert(1)', 'data:text/plain,ciao', 'non è un indirizzo', '']) {
    await assert.rejects(scarica(cattivo, { rete: vera }), (e) => e instanceof ErroreRete && ['protocollo', 'indirizzo'].includes(e.codice), cattivo);
  }
});

test('scarica: rifiuta questo computer e le reti private, anche dietro un nome', async () => {
  sito.richieste.length = 0;
  rispondi('/segreto', 'dati interni', { tipo: 'text/plain' });
  for (const indirizzo of [u('127.0.0.1', '/segreto'), u('localhost', '/segreto'), u('[::1]', '/segreto'), u('169.254.169.254', '/latest/meta-data'), u('2130706433', '/segreto'), u('0x7f.0.0.1', '/segreto'),
    u('interno.test', '/segreto'), u('misto.test', '/segreto'), u('stampante.local', '/segreto'), u('intranet', '/segreto'), u('servizio.internal', '/segreto')]) {
    await assert.rejects(scarica(indirizzo, { rete }), (e) => e instanceof ErroreRete && e.codice === 'host_privato', indirizzo);
  }
  await assert.rejects(scarica(u('sconosciuto.test', '/x'), { rete }), (e) => e.codice === 'dns');
  assert.equal(sito.richieste.length, 0, 'nessuna richiesta è partita');
});

test('scarica: redirect verso un indirizzo privato rifiutato, e ogni salto ricontrollato', async () => {
  rispondi('/segreto', 'dati interni', { tipo: 'text/plain' });
  rispondi('/va-all-interno', '', { stato: 302, intestazioni: { location: u('interno.test', '/segreto') } });
  rispondi('/va-al-loopback', '', { stato: 301, intestazioni: { location: u('127.0.0.1', '/segreto') } });
  rispondi('/va-ai-metadati', '', { stato: 307, intestazioni: { location: 'http://169.254.169.254/latest/meta-data/' } });
  rispondi('/va-su-file', '', { stato: 302, intestazioni: { location: 'file:///etc/passwd' } });
  rispondi('/con-credenziali', '', { stato: 302, intestazioni: { location: u('utente:pw@ente.test', '/pagina') } });
  rispondi('/senza-meta', '', { stato: 302 });
  rispondi('/due-salti', '', { stato: 302, intestazioni: { location: '/va-all-interno' } });
  sito.richieste.length = 0;
  for (const [percorso, codice] of [['/va-all-interno', 'host_privato'], ['/va-al-loopback', 'host_privato'], ['/va-ai-metadati', 'host_privato'], ['/va-su-file', 'protocollo'], ['/con-credenziali', 'credenziali'], ['/senza-meta', 'redirect'], ['/due-salti', 'host_privato']]) {
    await assert.rejects(scarica(u('ente.test', percorso), { rete }), (e) => e instanceof ErroreRete && e.codice === codice, percorso);
  }
  assert.equal(sito.richieste.some((r) => r.url === '/segreto'), false, 'la destinazione privata non è mai stata contattata');

  // i redirect buoni si seguono (anche verso un altro ente) fino a 5; al sesto ci si ferma
  rispondi('/pagina', PAGINA_BASE);
  rispondi('/r1', '', { stato: 302, intestazioni: { location: u('altro-ente.test', '/r2') } });
  rispondi('/r2', '', { stato: 303, intestazioni: { location: '/pagina' } });
  const r = await scarica(u('ente.test', '/r1'), { rete });
  assert.equal(r.url, u('altro-ente.test', '/pagina'));
  assert.deepEqual(r.salti, [u('altro-ente.test', '/r2'), u('altro-ente.test', '/pagina')]);
  for (let i = 1; i <= 7; i++) rispondi(`/catena-${i}`, '', { stato: 302, intestazioni: { location: i === 7 ? '/pagina' : `/catena-${i + 1}` } });
  assert.equal((await scarica(u('ente.test', '/catena-3'), { rete })).stato, 200, 'cinque reindirizzamenti');
  await assert.rejects(scarica(u('ente.test', '/catena-2'), { rete }), (e) => e.codice === 'redirect', 'sei reindirizzamenti');
  rispondi('/anello', '', { stato: 302, intestazioni: { location: '/anello' } });
  await assert.rejects(scarica(u('ente.test', '/anello'), { rete }), (e) => e.codice === 'redirect');
});

test('scarica: limite di dimensione (dichiarata, effettiva, dopo la decompressione) e tempo massimo', async () => {
  const grande = Buffer.alloc(300 * 1024, 'x');
  rispondi('/grande-dichiarato', grande, { intestazioni: { 'content-length': String(grande.length) } });
  sito.risposte.set('/grande-a-pezzi', (req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); const t = setInterval(() => { if (!res.write(Buffer.alloc(64 * 1024, 'y'))) { /* continua */ } }, 5); res.on('close', () => clearInterval(t)); });
  rispondi('/bomba', zlib.gzipSync(Buffer.alloc(8 * 1024 * 1024, 0)), { intestazioni: { 'content-encoding': 'gzip' } }); // 8 MB in pochi KB
  rispondi('/compresso', zlib.gzipSync(Buffer.from(PAGINA_BASE)), { intestazioni: { 'content-encoding': 'gzip' } });
  rispondi('/brotli', zlib.brotliCompressSync(Buffer.from(PAGINA_BASE)), { intestazioni: { 'content-encoding': 'br' } });
  rispondi('/strano', 'x', { intestazioni: { 'content-encoding': 'zstd' } });
  for (const percorso of ['/grande-dichiarato', '/grande-a-pezzi', '/bomba']) {
    await assert.rejects(scarica(u('ente.test', percorso), { rete, max: 100 * 1024 }), (e) => e instanceof ErroreRete && e.codice === 'dimensione', percorso);
  }
  assert.equal((await scarica(u('ente.test', '/grande-dichiarato'), { rete, max: 400 * 1024 })).corpo.length, grande.length);
  assert.equal((await scarica(u('ente.test', '/compresso'), { rete })).corpo.toString('utf8'), PAGINA_BASE);
  assert.equal((await scarica(u('ente.test', '/brotli'), { rete })).corpo.toString('utf8'), PAGINA_BASE);
  await assert.rejects(scarica(u('ente.test', '/strano'), { rete }), (e) => e.codice === 'codifica');

  sito.risposte.set('/muto', () => { /* non risponde mai */ });
  sito.risposte.set('/lento', (req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.write('<html>'); /* e poi più niente */ });
  const inizio = Date.now();
  await assert.rejects(scarica(u('fermo.test', '/muto'), { rete, tempoMs: 300 }), (e) => e.codice === 'tempo');
  await assert.rejects(scarica(u('fermo.test', '/lento'), { rete, tempoMs: 300 }), (e) => e.codice === 'tempo');
  assert.ok(Date.now() - inizio < 3000);
  rispondi('/errore', 'guasto', { stato: 503 });
  await assert.rejects(scarica(u('ente.test', '/errore'), { rete }), (e) => e.codice === 'http_503');
  await assert.rejects(scarica(u('ente.test', '/non-esiste'), { rete }), (e) => e.codice === 'http_404' && /404/.test(e.message));
});

/* ================================================================== server: controllo completo e rotte */

const BANDI_FINTI = [
  { id: 'regione-prova-2027', nome: 'Fondo di prova', nomeBreve: 'Prova', revisione: '2026-09-01', paginaUfficiale: '', fontiUrl: [] },
  { id: 'senza-pagina', nome: 'Fondo senza pagina', revisione: '2026-09-01' },
];
function servizio(extra = {}) {
  BANDI_FINTI[0].paginaUfficiale = u('ente.test', '/bandi/');
  BANDI_FINTI[0].fontiUrl = [{ titolo: 'Atti', url: u('altro-ente.test', '/atti'), tipo: 'pagina' }, { titolo: 'Avviso', url: u('ente.test', '/documenti/avviso.pdf'), tipo: 'documento' }];
  return creaAggiornamenti({ versione: '9.9.9', rete, env: { CLOCKWISE_CATALOGO: u('canale.test', '/catalogo.json') }, bandi: BANDI_FINTI, limiti: { memoriaMs: 0, tempoPagina: 2000 }, ...extra });
}
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(2000, 0x20), Buffer.from('\n%%EOF')]);

test('pagineDi: pagina ufficiale e fonti di tipo «pagina», mai i file', () => {
  assert.deepEqual(pagineDi({ paginaUfficiale: 'https://ente.test/bandi#sezione', fontiUrl: [{ url: 'https://ente.test/bandi', tipo: 'pagina' }, { url: 'https://ente.test/atti', tipo: 'pagina' }, { url: 'https://ente.test/avviso.pdf', tipo: 'pagina' }, { url: 'https://ente.test/altro', tipo: 'documento' }, { url: 'storto', tipo: 'pagina' }] }),
    ['https://ente.test/bandi', 'https://ente.test/atti']);
  assert.deepEqual(pagineDi({}), []);
  assert.deepEqual(pagineDi(null), []);
});

test('controllo completo: catalogo dal canale, documenti delle pagine, canale non raggiungibile o malformato', async () => {
  const s = servizio();
  rispondi('/bandi/', PAGINA_BASE);
  rispondi('/atti', '<a href="/atti/decreto-1.pdf">Decreto n. 1</a>');
  const pagine = { paginaUfficiale: u('ente.test', '/bandi/'), fontiUrl: [{ titolo: 'Atti', url: u('altro-ente.test', '/atti'), tipo: 'pagina' }] };
  const catalogo = catalogoDi(bandoDiProva('regione-prova-2027', '2026-10-01', pagine));
  rispondi('/catalogo.json', JSON.stringify(catalogo), { tipo: 'text/plain; charset=utf-8' });

  let r = await s.controlla();
  assert.deepEqual(r.canale, { url: u('canale.test', '/catalogo.json'), esito: 'ok' });
  assert.deepEqual(r.protocolli, ['http:'], 'nelle prove; nel programma è sempre e solo https');
  assert.deepEqual((await creaAggiornamenti({ env: { CLOCKWISE_CATALOGO: 'off' }, bandi: [] }).controlla()).protocolli, ['https:']);
  assert.deepEqual(r.catalogo, catalogo, 'il catalogo arriva tale e quale: lo verifica chi lo usa');
  assert.match(r.quando, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(Object.keys(r.sorgenti), ['regione-prova-2027'], 'solo i bandi con una pagina da sorvegliare');
  const sorgente = r.sorgenti['regione-prova-2027'];
  assert.equal(sorgente.url, u('ente.test', '/bandi/'));
  assert.equal(sorgente.pagine.length, 2);
  assert.equal(sorgente.documenti.length, 9);
  assert.equal(sorgente.impronta, sha256(sorgente.documenti.map((d) => d.url).join('\n')));
  assert.equal(sorgente.errore, undefined);
  assert.ok(sorgente.documenti.some((d) => d.url === u('altro-ente.test', '/atti/decreto-1.pdf')));
  assert.ok(sorgente.documenti.some((d) => d.url === u('ente.test', '/bandi/documenti/avviso-pubblico-2027.pdf')), 'link relativo risolto rispetto alla pagina');
  // se il catalogo (verificato anche dal server) sposta la pagina ufficiale di un bando, dal controllo stesso si sorveglia quella nuova…
  rispondi('/bandi-2028/', '<a href="avviso-2028.pdf">Avviso pubblico 2028</a>');
  rispondi('/catalogo.json', JSON.stringify(catalogoDi(bandoDiProva('regione-prova-2027', '2026-10-20', { paginaUfficiale: u('ente.test', '/bandi-2028/') }))));
  r = await s.controlla();
  assert.deepEqual(r.sorgenti['regione-prova-2027'].documenti.map((d) => d.url), [u('ente.test', '/bandi-2028/avviso-2028.pdf')]);
  // …ma una voce con l'impronta sbagliata non sposta niente
  const falsa = catalogoDi(bandoDiProva('regione-prova-2027', '2026-10-25', { paginaUfficiale: u('ente.test', '/segreto') }));
  falsa.bandi[0].sha256 = 'c'.repeat(64);
  rispondi('/catalogo.json', JSON.stringify(falsa));
  r = await s.controlla();
  assert.equal(r.sorgenti['regione-prova-2027'].url, u('ente.test', '/bandi/'), 'senza una voce valida si torna alle pagine del programma');
  rispondi('/catalogo.json', JSON.stringify(catalogo));

  // JSON malformato
  const s2 = servizio();
  rispondi('/catalogo.json', '{ "schema": 1, "bandi": [', { tipo: 'application/json' });
  r = await s2.controlla();
  assert.equal(r.catalogo, null);
  assert.equal(r.canale.esito, 'non_valido');
  assert.ok(Object.keys(r.sorgenti).length === 1, 'le pagine si controllano lo stesso');
  rispondi('/catalogo.json', '[1, 2, 3]', { tipo: 'application/json' });
  assert.equal((await s2.controlla()).canale.esito, 'non_valido');
  rispondi('/catalogo.json', '"solo testo"', { tipo: 'application/json' });
  assert.equal((await s2.controlla()).canale.esito, 'non_valido');

  // canale che risponde 404 (oggi il repository è privato): in silenzio, con l'esito scritto
  sito.risposte.delete('/catalogo.json');
  r = await s2.controlla();
  assert.equal(r.catalogo, null);
  assert.equal(r.canale.esito, 'non_raggiungibile');
  assert.equal(r.canale.codice, 'http_404');
  // più indirizzi: vale il primo che risponde con un catalogo leggibile
  rispondi('/copia.json', JSON.stringify(catalogo));
  const s3 = servizio({ env: { CLOCKWISE_CATALOGO: `${u('canale.test', '/catalogo.json')}, ${u('canale.test', '/copia.json')}` } });
  r = await s3.controlla();
  assert.equal(r.canale.esito, 'ok');
  assert.equal(r.canale.url, u('canale.test', '/copia.json'));
  assert.equal(r.canale.tentativi.length, 1);
  // canale spento, canale da config.json, canale predefinito
  assert.deepEqual((await servizio({ env: { CLOCKWISE_CATALOGO: 'off' } }).controlla()).canale, { url: '', esito: 'disattivato' });
  assert.deepEqual(servizio({ env: {}, leggiConfig: () => ({ canaleBandi: 'https://esempio.test/c.json' }) }).indirizziCanale(), ['https://esempio.test/c.json']);
  assert.deepEqual(servizio({ env: { CLOCKWISE_CATALOGO: 'https://a.test/c.json' }, leggiConfig: () => ({ canaleBandi: 'https://b.test/c.json' }) }).indirizziCanale(), ['https://a.test/c.json'], 'la variabile d’ambiente vince');
  assert.deepEqual(servizio({ env: {} }).indirizziCanale(), A.CANALI_PREDEFINITI);
  assert.deepEqual(A.CANALI_PREDEFINITI, ['https://raw.githubusercontent.com/Tipintrip98/Clockwise-/main/bandi/catalogo.json']);
  // un canale configurato su un indirizzo interno non viene contattato
  r = await servizio({ env: { CLOCKWISE_CATALOGO: u('interno.test', '/catalogo.json') } }).controlla();
  assert.equal(r.canale.esito, 'non_raggiungibile');
  assert.equal(r.canale.codice, 'host_privato');
});

test('controllo delle pagine: errori isolati, pagina non HTML, controllo dei soli bandi richiesti', async () => {
  const s = servizio({ env: { CLOCKWISE_CATALOGO: 'off' } });
  rispondi('/bandi/', PAGINA_BASE);
  sito.risposte.delete('/atti');
  let r = await s.controlla();
  let sorgente = r.sorgenti['regione-prova-2027'];
  assert.equal(sorgente.errore, undefined, 'la pagina principale ha risposto');
  assert.equal(sorgente.pagine[1].codice, 'http_404');
  assert.equal(sorgente.documenti.length, 8);
  rispondi('/bandi/', PDF, { tipo: 'application/pdf' });
  r = await s.controlla();
  sorgente = r.sorgenti['regione-prova-2027'];
  assert.equal(sorgente.pagine[0].codice, 'tipo');
  assert.match(sorgente.errore, /pagina HTML/);
  assert.deepEqual(sorgente.documenti, []);
  // pagina in ISO-8859-1 dichiarata nel meta: gli accenti dei titoli arrivano giusti
  rispondi('/bandi/', Buffer.from('<html><head><meta charset="iso-8859-1"></head><a href="/a.pdf">Avviso per le attivit\xe0 2027</a>', 'latin1'), { tipo: 'text/html' });
  r = await s.controlla({ ids: ['regione-prova-2027', 'inesistente', 12, null] });
  assert.deepEqual(r.canale, { url: '', esito: 'saltato' });
  assert.equal(r.catalogo, null);
  assert.equal(r.sorgenti['regione-prova-2027'].documenti[0].titolo, 'Avviso per le attività 2027');
  assert.deepEqual(Object.keys((await s.controlla({ ids: ['inesistente'] })).sorgenti), []);
  // due richieste uguali insieme: un solo giro di scaricamenti
  sito.richieste.length = 0;
  const [a, b] = await Promise.all([s.controlla(), s.controlla()]);
  assert.equal(a, b);
  assert.equal(sito.richieste.filter((x) => x.url === '/bandi/').length, 1);
});

test('rotte del server: /api/bandi/controlla e /api/bandi/documento', async () => {
  rispondi('/bandi/', PAGINA_BASE);
  rispondi('/atti', '<a href="/atti/decreto-1.pdf">Decreto n. 1</a>');
  rispondi('/documenti/avviso-pubblico-2027.pdf', '<html>pagina di errore travestita da PDF</html>', { tipo: 'application/pdf' });
  rispondi('/altro.pdf', PDF, { tipo: 'application/pdf' });
  rispondi('/catalogo.json', JSON.stringify(catalogoDi(bandoDiProva('altro-2027'))));
  const cartellaDati = fs.mkdtempSync(path.join(os.tmpdir(), 'clockwise-agg-'));
  BANDI_FINTI[0].paginaUfficiale = u('ente.test', '/bandi/');
  BANDI_FINTI[0].fontiUrl = [];
  const server = creaServer({ fornitore: fornitoreCartella(path.join(radice, 'app')), cartellaDati, versione: '9.9.9',
    aggiornamenti: { rete, env: { CLOCKWISE_CATALOGO: u('canale.test', '/catalogo.json') }, bandi: BANDI_FINTI, limiti: { memoriaMs: 0, documento: 64 * 1024 } } });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const documento = (id, url, opzioni) => fetch(`${base}/api/bandi/documento?id=${encodeURIComponent(id)}&url=${encodeURIComponent(url)}`, opzioni);
  const avviso = u('ente.test', '/bandi/documenti/avviso-pubblico-2027.pdf');
  try {
    // prima di qualunque controllo nessun documento è scaricabile
    assert.equal((await documento('regione-prova-2027', avviso)).status, 404);

    let r = await fetch(`${base}/api/bandi/controlla`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 200);
    const esito = await r.json();
    assert.equal(esito.canale.esito, 'ok');
    assert.equal(esito.catalogo.bandi[0].id, 'altro-2027');
    assert.equal(esito.sorgenti['regione-prova-2027'].documenti.length, 8);

    // richieste da un altro sito aperto nel browser: rifiutate
    assert.equal((await fetch(`${base}/api/bandi/controlla`, { method: 'POST', headers: { origin: 'https://sito-ostile.test', 'content-type': 'text/plain' }, body: '{}' })).status, 403);
    assert.equal((await fetch(`${base}/api/bandi/controlla`, { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, body: '{}' })).status, 403);
    assert.equal((await documento('regione-prova-2027', avviso, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
    assert.equal((await fetch(`${base}/api/bandi/controlla`, { method: 'POST', body: '{"ids":"tutti"}' })).status, 400);
    assert.equal((await fetch(`${base}/api/bandi/controlla`)).status, 404, 'solo POST');
    assert.equal((await fetch(`${base}/api/bandi/altro`)).status, 404);

    // documento in elenco: i byte, mai interpretabili come pagina
    rispondi('/bandi/documenti/avviso-pubblico-2027.pdf', PDF, { tipo: 'text/html' });
    r = await documento('regione-prova-2027', avviso);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/octet-stream');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('content-disposition'), /^attachment; filename="avviso-pubblico-2027\.pdf"$/);
    assert.equal(r.headers.get('x-clockwise-tipo'), 'pdf');
    assert.ok(Buffer.from(await r.arrayBuffer()).equals(PDF));

    // documento NON in elenco: rifiutato, e il sito non viene nemmeno contattato
    sito.richieste.length = 0;
    for (const [id, url] of [['regione-prova-2027', u('ente.test', '/altro.pdf')], ['regione-prova-2027', u('127.0.0.1', '/segreto')], ['regione-prova-2027', 'file:///etc/passwd'], ['regione-prova-2027', ''],
      ['altro-bando', avviso], ['', avviso], ['senza-pagina', avviso]]) {
      r = await documento(id, url);
      assert.equal(r.status, 404, `${id} ${url}`);
      assert.equal((await r.json()).codice, 'non_in_elenco');
    }
    assert.equal((await fetch(`${base}/api/bandi/documento`)).status, 404);
    assert.equal(sito.richieste.length, 0);
    // in elenco ma è una pagina, non un file; in elenco ma non è un PDF vero; in elenco ma troppo grande
    r = await documento('regione-prova-2027', u('ente.test', '/faq'));
    assert.equal(r.status, 415);
    r = await documento('regione-prova-2027', u('ente.test', '/documenti/avviso-pubblico-2027.pdf'));
    assert.equal(r.status, 415);
    assert.match((await r.json()).messaggio, /non è un PDF/);
    rispondi('/bandi/documenti/avviso-pubblico-2027.pdf', Buffer.concat([PDF, Buffer.alloc(80 * 1024)]), { tipo: 'application/pdf' });
    r = await documento('regione-prova-2027', avviso);
    assert.equal(r.status, 413);
    assert.equal((await r.json()).codice, 'dimensione');
    // il documento è sparito dal sito: errore del sito, non del programma
    sito.risposte.delete('/bandi/documenti/avviso-pubblico-2027.pdf');
    r = await documento('regione-prova-2027', avviso);
    assert.equal(r.status, 502);
    assert.equal((await r.json()).codice, 'http_404');

    // dopo un nuovo controllo vale il nuovo elenco: ciò che non è più pubblicato non si scarica più
    rispondi('/bandi/', '<a href="/altro.pdf">Avviso 2028</a>');
    await fetch(`${base}/api/bandi/controlla`, { method: 'POST', body: '{"ids":["regione-prova-2027"]}' });
    assert.equal((await documento('regione-prova-2027', avviso)).status, 404);
    assert.equal((await documento('regione-prova-2027', u('ente.test', '/altro.pdf'))).status, 200);
  } finally {
    await chiudiServer(server);
    fs.rmSync(cartellaDati, { recursive: true, force: true });
  }
});

/* ================================================================== riga di comando: confronto con il lock */

test('controlla-bandi: confronto con il lock, rapporto leggibile e in Markdown', () => {
  const elenco = [{ id: 'regione-prova-2027', nome: 'Prova', pagine: ['https://ente.test/bandi', 'https://ente.test/atti'] }, { id: 'altro-2027', nome: 'Altro', pagine: ['https://altro-ente.test/'] }];
  const pag = (url, nomi, extra = {}) => ({ url, documenti: nomi.map((n) => ({ url: `https://ente.test/d/${n}`, titolo: `Titolo di ${n}`, tipo: 'pdf' })), impronta: sha256(nomi.join()), ...extra });
  const prima = { 'regione-prova-2027': { pagine: [pag('https://ente.test/bandi', ['a.pdf', 'b.pdf']), pag('https://ente.test/atti', ['x.pdf'])] }, 'altro-2027': { pagine: [{ url: 'https://altro-ente.test/', errore: 'sito non raggiungibile' }] } };
  // senza lock: tutto «senza base», nessuna novità
  const uno = confrontaConLock({ schema: 1, sorgenti: {} }, elenco, prima, '2026-11-01T08:00:00.000Z');
  assert.equal(uno.esito.novita, false);
  assert.deepEqual(uno.esito.senzaBase.map((s) => s.pagina), ['https://ente.test/atti', 'https://ente.test/bandi'].reverse());
  assert.equal(uno.esito.errori.length, 1);
  assert.deepEqual(Object.keys(uno.lock.sorgenti), ['regione-prova-2027'], 'una pagina mai letta non entra nel lock');
  assert.deepEqual(uno.lock.sorgenti['regione-prova-2027'].pagine['https://ente.test/bandi'].documenti, ['https://ente.test/d/a.pdf', 'https://ente.test/d/b.pdf']);
  // con il lock: un documento nuovo, uno sparito, una pagina ferma che conserva la sua base
  const dopo = { 'regione-prova-2027': { pagine: [pag('https://ente.test/bandi', ['a.pdf', 'c.pdf']), { url: 'https://ente.test/atti', errore: 'il sito non ha risposto in tempo' }] }, 'altro-2027': { pagine: [pag('https://altro-ente.test/', ['z.pdf'])] } };
  const due = confrontaConLock(uno.lock, elenco, dopo, '2026-11-08T08:00:00.000Z');
  assert.equal(due.esito.novita, true);
  assert.deepEqual(due.esito.conNovita.map((n) => [n.id, n.documenti.map((d) => d.url)]), [['regione-prova-2027', ['https://ente.test/d/c.pdf']]]);
  assert.deepEqual(due.esito.rimossi.map((n) => n.documenti), [['https://ente.test/d/b.pdf']]);
  assert.deepEqual(due.esito.senzaBase.map((s) => s.id), ['altro-2027']);
  assert.deepEqual(due.lock.sorgenti['regione-prova-2027'].pagine['https://ente.test/atti'], uno.lock.sorgenti['regione-prova-2027'].pagine['https://ente.test/atti']);
  assert.equal(due.lock.sorgenti['regione-prova-2027'].pagine['https://ente.test/bandi'].rilevato, '2026-11-08T08:00:00.000Z');
  // nessun cambiamento: lock identico salvo la data, nessuna novità
  const tre = confrontaConLock(due.lock, elenco, { ...dopo, 'regione-prova-2027': { pagine: [pag('https://ente.test/bandi', ['a.pdf', 'c.pdf']), pag('https://ente.test/atti', ['x.pdf'])] } }, '2026-11-15T08:00:00.000Z');
  assert.equal(tre.esito.novita, false);
  assert.deepEqual(tre.lock.sorgenti, due.lock.sorgenti);

  const testo = rapportoTesto(due.esito);
  assert.match(testo, /NOVITÀ SULLE PAGINE UFFICIALI/);
  assert.match(testo, /\+ \[pdf\] Titolo di c\.pdf/);
  assert.match(testo, /PAGINE NON RAGGIUNGIBILI/);
  assert.match(rapportoTesto(tre.esito), /Nessun documento nuovo/);
  // i titoli arrivano da siti esterni: nel Markdown della issue non devono poter aprire link, menzioni o HTML
  due.esito.conNovita[0].documenti[0].titolo = 'Avviso [clicca](https://sito-ostile.test) <img src=x> @tutti `codice`';
  const markdown = rapportoMarkdown(due.esito);
  assert.match(markdown, /## Documenti nuovi/);
  assert.ok(markdown.includes('Avviso \\[clicca\\](https://sito-ostile.test) \\<img src=x\\> @&#8203;tutti \\`codice\\`'));
  assert.ok(!markdown.includes('[clicca]('));
});
