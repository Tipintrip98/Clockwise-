// Aggiornamento automatico dei bandi, lato server.
// È l'unico punto di Clockwise che scarica qualcosa da siti che non sono Anthropic: il catalogo dei bandi
// dal canale di aggiornamento e le pagine ufficiali degli enti. Per questo ogni richiesta passa da scarica():
//   - solo indirizzi https, senza credenziali e sulla porta standard;
//   - mai verso questo computer o la rete locale: i nomi vengono risolti e, se anche un solo indirizzo è
//     privato, di loopback o riservato, la richiesta non parte (e la connessione usa proprio l'indirizzo controllato);
//   - al massimo 5 reindirizzamenti, ognuno ricontrollato come se fosse il primo;
//   - tempo massimo e dimensione massima, anche sul contenuto decompresso;
//   - si presenta come «Clockwise/<versione> (controllo aggiornamenti bandi)» e non invia cookie, provenienza
//     né alcun dato dell'utente o dei dossier.
// Il browser non passa mai indirizzi: chiede «controlla» e il server usa i bandi che porta con sé (più quelli
// arrivati dal canale e già verificati). Un documento si può scaricare solo se l'ultimo controllo l'ha trovato
// nella pagina ufficiale di quel bando.
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import net from 'node:net';
import dns from 'node:dns';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { BANDI_PREDEFINITI, SCHEDE_BANDI } from '../app/js/core/bandi/indice.js';
import { CANALI_PREDEFINITI, applicaAggiornamenti, revisioniInUso, verificaCatalogo, estraiDocumenti, tipoDocumento, nomeDaUrl } from '../app/js/core/aggiornamenti.js';

const MB = 1024 * 1024;
export const LIMITI = {
  pagina: 4 * MB, catalogo: 8 * MB, documento: 25 * MB,
  tempoPagina: 20000, tempoDocumento: 90000, tempoTotale: 150000,
  paralleli: 4, paginePerBando: 4, reindirizzamenti: 5, memoriaMs: 15000,
};

export class ErroreRete extends Error {
  constructor(codice, messaggio) { super(messaggio); this.codice = codice; }
}

/* ------------------------------------------------------------------ indirizzi consentiti */

// Reti che non sono Internet: questo computer, reti locali, indirizzi riservati o di documentazione.
const RISERVATI = new net.BlockList();
for (const [rete, bit] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) RISERVATI.addSubnet(rete, bit, 'ipv4');
for (const [rete, bit] of [['::', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]]) RISERVATI.addSubnet(rete, bit, 'ipv6');

/** Vero se l'indirizzo IP non è un indirizzo pubblico di Internet (o non è un indirizzo: nel dubbio si rifiuta). */
export function indirizzoPrivato(indirizzo) {
  const ip = String(indirizzo ?? '').replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const famiglia = net.isIP(ip);
  if (!famiglia) return true;
  if (famiglia === 4) return RISERVATI.check(ip, 'ipv4');
  // ::ffff:a.b.c.d è un indirizzo IPv4 scritto in IPv6: vale la regola dell'IPv4
  const mappato = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mappato) return RISERVATI.check(mappato[1], 'ipv4');
  return RISERVATI.check(ip, 'ipv6');
}

// Nomi che per convenzione indicano macchine della rete locale, qualunque cosa dica il DNS.
const nomeLocale = (host) => !host.includes('.') || /(^|\.)(localhost|local|localdomain|internal|intranet|lan|home|corp|home\.arpa)\.?$/i.test(host);
const senzaQuadre = (host) => host.replace(/^\[|\]$/g, '');
const risolviDns = (host) => dns.promises.lookup(host, { all: true, verbatim: true });
const privato = () => new ErroreRete('host_privato', 'l’indirizzo porta a questo computer o a una rete privata: richiesta non consentita');

function controllaUrl(indirizzo, r) {
  let u;
  try { u = new URL(indirizzo); } catch { throw new ErroreRete('indirizzo', 'indirizzo non valido'); }
  if (!r.protocolli.includes(u.protocol)) throw new ErroreRete('protocollo', 'sono ammessi solo indirizzi https');
  if (u.username || u.password) throw new ErroreRete('credenziali', 'gli indirizzi con nome utente o password non sono ammessi');
  if (u.port && !r.qualsiasiPorta) throw new ErroreRete('porta', 'sono ammessi solo indirizzi sulla porta standard');
  u.hash = '';
  return u;
}

// Proxy di rete dell'ambiente (HTTPS_PROXY), come fanno i programmi da riga di comando: serve nelle reti aziendali.
function proxyPer(host, env) {
  const valore = env.HTTPS_PROXY || env.https_proxy;
  if (!valore) return null;
  let p;
  try { p = new URL(valore); } catch { return null; }
  if (p.protocol !== 'http:') return null;
  const esclusi = String(env.NO_PROXY || env.no_proxy || '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  const h = host.toLowerCase();
  if (esclusi.some((e) => e === '*' || h === e.replace(/^\*?\./, '') || h.endsWith(`.${e.replace(/^\*?\./, '')}`))) return null;
  return p;
}

async function controllaHost(u, r, proxy) {
  const host = senzaQuadre(u.hostname);
  if (net.isIP(host)) { if (indirizzoPrivato(host)) throw privato(); return; }
  if (nomeLocale(host)) throw privato();
  if (!proxy) return; // senza proxy il controllo avviene mentre ci si collega (ricercaSicura), sull'indirizzo davvero usato
  // Con un proxy il nome lo risolve lui: qui si rifiuta ciò che, visto da questo computer, è già un indirizzo privato.
  let indirizzi = null;
  try { indirizzi = await r.risolvi(host); } catch { /* nessun DNS diretto: decide il proxy */ }
  if (indirizzi?.some((a) => indirizzoPrivato(a.address))) throw privato();
}

// Risoluzione dei nomi usata per collegarsi: controlla TUTTI gli indirizzi e consegna alla connessione quelli controllati.
function ricercaSicura(r) {
  return (nome, opzioni, fatto) => {
    if (typeof opzioni === 'function') { fatto = opzioni; opzioni = {}; }
    Promise.resolve().then(() => r.risolvi(nome)).then((indirizzi) => {
      const lista = (Array.isArray(indirizzi) ? indirizzi : []).filter((a) => a && typeof a.address === 'string');
      if (!lista.length) return fatto(Object.assign(new Error('nome non risolto'), { code: 'ENOTFOUND' }));
      if (lista.some((a) => indirizzoPrivato(a.address))) return fatto(Object.assign(new Error('indirizzo privato'), { code: 'E_PRIVATO' }));
      const finali = lista.map((a) => r.instrada(a)).map((a) => ({ address: a.address, family: a.family || net.isIP(a.address) }));
      if (opzioni?.all) fatto(null, finali); else fatto(null, finali[0].address, finali[0].family);
    }, (e) => fatto(Object.assign(new Error('nome non risolto'), { code: e?.code || 'ENOTFOUND' })));
  };
}

function erroreDa(e) {
  if (e instanceof ErroreRete) return e;
  const c = String(e?.code || '');
  if (c === 'E_PRIVATO') return privato();
  if (c === 'ENOTFOUND' || c === 'EAI_AGAIN' || c === 'ENODATA') return new ErroreRete('dns', 'indirizzo non trovato');
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS|ERR_SSL|ALTNAME/.test(c)) return new ErroreRete('tls', 'certificato del sito non valido');
  return new ErroreRete('rete', 'sito non raggiungibile');
}

/* ------------------------------------------------------------------ una richiesta, poi i reindirizzamenti */

function richiesta(u, { r, proxy, intestazioni, tempoMs, max }) {
  return new Promise((ok, ko) => {
    let finito = false, req = null, galleria = null;
    const fine = (errore, valore) => {
      if (finito) return;
      finito = true;
      clearTimeout(timer);
      if (errore) { req?.destroy(); galleria?.destroy(); ko(erroreDa(errore)); } else ok(valore);
    };
    const timer = setTimeout(() => fine(new ErroreRete('tempo', 'il sito non ha risposto in tempo')), Math.max(1, tempoMs));
    const host = senzaQuadre(u.hostname);
    const sicuro = u.protocol === 'https:';
    const porta = Number(u.port) || (sicuro ? 443 : 80);

    const suRisposta = (res) => {
      const stato = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(stato)) {
        const posizione = typeof res.headers.location === 'string' ? res.headers.location : '';
        res.destroy(); req.destroy(); galleria?.destroy();
        return fine(null, { stato, posizione });
      }
      if (stato < 200 || stato > 299) { res.destroy(); req.destroy(); galleria?.destroy(); return fine(null, { stato, intestazioni: res.headers, corpo: null }); }
      const troppo = () => fine(new ErroreRete('dimensione', `contenuto oltre il limite di ${Math.round(max / MB * 10) / 10} MB`));
      if (Number(res.headers['content-length']) > max) return troppo();
      const codifica = String(res.headers['content-encoding'] || '').trim().toLowerCase();
      let flusso = res;
      if (codifica === 'gzip' || codifica === 'x-gzip') flusso = res.pipe(zlib.createGunzip());
      else if (codifica === 'deflate') flusso = res.pipe(zlib.createInflate());
      else if (codifica === 'br') flusso = res.pipe(zlib.createBrotliDecompress());
      else if (codifica && codifica !== 'identity') return fine(new ErroreRete('codifica', 'risposta in un formato compresso non previsto'));
      const pezzi = []; let totale = 0;
      flusso.on('data', (c) => { totale += c.length; if (totale > max) troppo(); else if (!finito) pezzi.push(c); });
      flusso.on('end', () => { galleria?.destroy(); fine(null, { stato, intestazioni: res.headers, corpo: Buffer.concat(pezzi) }); });
      flusso.on('error', () => fine(new ErroreRete('rete', 'risposta interrotta o illeggibile')));
      res.on('error', () => fine(new ErroreRete('rete', 'risposta interrotta')));
      res.on('aborted', () => fine(new ErroreRete('rete', 'risposta interrotta')));
    };
    const base = { method: 'GET', path: `${u.pathname}${u.search}`, headers: intestazioni };
    const parti = (opzioni, modulo) => {
      try {
        req = modulo.request(opzioni);
        req.once('response', suRisposta);
        req.on('error', fine);
        req.end();
      } catch (e) { fine(e); }
    };

    if (!proxy) {
      // collegamento diretto: la risoluzione dei nomi è quella controllata, nessuna connessione riusata
      return parti({ ...base, protocol: u.protocol, hostname: host, port: porta, agent: false, lookup: ricercaSicura(r), ...(sicuro && !net.isIP(host) ? { servername: host } : {}) }, sicuro ? https : http);
    }
    // attraverso il proxy: galleria CONNECT, poi TLS dentro la galleria (il certificato del sito viene verificato comunque)
    const credenziali = proxy.username ? { 'proxy-authorization': `Basic ${Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString('base64')}` } : {};
    const apertura = http.request({ host: senzaQuadre(proxy.hostname), port: Number(proxy.port) || 80, method: 'CONNECT', path: `${host}:${porta}`, headers: { host: `${host}:${porta}`, ...credenziali }, agent: false });
    apertura.once('connect', (res, presa) => {
      galleria = presa;
      presa.on('error', () => {});
      if (finito) return presa.destroy();
      if (res.statusCode !== 200) return fine(new ErroreRete('proxy', `il proxy di rete ha rifiutato il collegamento (${res.statusCode})`));
      const cifrata = tls.connect({ socket: presa, servername: host, ALPNProtocols: ['http/1.1'] });
      cifrata.on('error', fine);
      parti({ ...base, host, port: porta, createConnection: () => cifrata, headers: { ...intestazioni, host: porta === 443 ? host : `${host}:${porta}` } }, http);
    });
    apertura.on('error', () => fine(new ErroreRete('proxy', 'proxy di rete non raggiungibile')));
    apertura.end();
  });
}

/**
 * Scarica un indirizzo con tutte le protezioni descritte in cima al file.
 * @param {string} indirizzo
 * @param {object} [o]
 * @param {number} [o.max]        dimensione massima in byte (anche dopo la decompressione)
 * @param {number} [o.tempoMs]    tempo massimo complessivo, reindirizzamenti compresi
 * @param {string} [o.accetta]    intestazione Accept
 * @param {string} [o.versione]   versione di Clockwise, per presentarsi
 * @param {object} [o.rete]       per le prove: { protocolli, qualsiasiPorta, risolvi(nome), instrada(indirizzo), env }
 * @returns {Promise<{ url: string, stato: number, intestazioni: object, corpo: Buffer, salti: string[] }>}
 */
export async function scarica(indirizzo, { max = LIMITI.pagina, tempoMs = LIMITI.tempoPagina, accetta = '*/*', versione = '', rete = {}, reindirizzamenti = LIMITI.reindirizzamenti } = {}) {
  const r = { protocolli: ['https:'], qualsiasiPorta: false, risolvi: risolviDns, instrada: (a) => a, env: process.env, ...rete };
  const intestazioni = {
    'user-agent': `Clockwise/${versione || '0'} (controllo aggiornamenti bandi)`,
    accept: accetta, 'accept-language': 'it-IT,it;q=0.9,en;q=0.5', 'accept-encoding': 'gzip, deflate, br',
  };
  const scadenza = Date.now() + tempoMs;
  const salti = [];
  let u = controllaUrl(indirizzo, r);
  for (let n = 0; ; n++) {
    const host = senzaQuadre(u.hostname);
    const proxy = u.protocol === 'https:' ? proxyPer(host, r.env) : null;
    await controllaHost(u, r, proxy);
    const restante = scadenza - Date.now();
    if (restante <= 0) throw new ErroreRete('tempo', 'il sito non ha risposto in tempo');
    const risposta = await richiesta(u, { r, proxy, intestazioni, tempoMs: restante, max });
    if (risposta.posizione !== undefined) {
      if (n >= reindirizzamenti) throw new ErroreRete('redirect', 'troppi reindirizzamenti');
      let prossimo;
      try { prossimo = new URL(risposta.posizione, u); } catch { prossimo = null; }
      if (!risposta.posizione || !prossimo) throw new ErroreRete('redirect', 'reindirizzamento senza una destinazione valida');
      u = controllaUrl(prossimo.href, r); // protocollo, credenziali e porta ricontrollati; l'host al prossimo giro
      salti.push(u.href);
      continue;
    }
    if (risposta.stato < 200 || risposta.stato > 299) throw new ErroreRete(`http_${risposta.stato}`, risposta.stato === 404 ? 'indirizzo inesistente (404)' : `il sito ha risposto con un errore (${risposta.stato})`);
    return { url: u.href, stato: risposta.stato, intestazioni: risposta.intestazioni, corpo: risposta.corpo, salti };
  }
}

/* ------------------------------------------------------------------ pagine, canale, documenti */

const sha256 = (testo) => crypto.createHash('sha256').update(testo).digest('hex');
const perUrl = (a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0);

function decodificaPagina(corpo, tipoContenuto) {
  const dichiarato = /charset\s*=\s*["']?([\w-]+)/i.exec(tipoContenuto || '')?.[1]
    || /<meta[^>]{0,300}charset\s*=\s*["']?([\w-]+)/i.exec(corpo.subarray(0, 4096).toString('latin1'))?.[1];
  try { return new TextDecoder(dichiarato || 'utf-8').decode(corpo); } catch { return new TextDecoder('utf-8').decode(corpo); }
}

async function inParallelo(elementi, quanti, lavoro) {
  let prossimo = 0;
  const operaio = async () => { while (prossimo < elementi.length) { const i = prossimo++; await lavoro(elementi[i]); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(quanti, elementi.length)) }, operaio));
}

/** Pagine da sorvegliare per un bando: la pagina ufficiale e le fonti di tipo «pagina». */
export function pagineDi(bando, massimo = LIMITI.paginePerBando) {
  const candidate = [bando?.paginaUfficiale, ...(Array.isArray(bando?.fontiUrl) ? bando.fontiUrl.filter((f) => f?.tipo === 'pagina').map((f) => f.url) : [])];
  const out = [];
  for (const c of candidate) {
    if (typeof c !== 'string' || !c) continue;
    let u;
    try { u = new URL(c); } catch { continue; }
    u.hash = '';
    if (tipoDocumento(u.href) || out.includes(u.href)) continue; // un file non è una pagina da cui ricavare un elenco
    out.push(u.href);
  }
  return out.slice(0, massimo);
}

/**
 * @param {object} [o]
 * @param {string} [o.versione]
 * @param {() => object} [o.leggiConfig]   config.json del programma (campo "canaleBandi")
 * @param {object} [o.env]                 variabili d'ambiente (CLOCKWISE_CATALOGO, HTTPS_PROXY)
 * @param {object} [o.rete]                per le prove (vedi scarica)
 * @param {object[]} [o.bandi]             per le prove: bandi da usare al posto di quelli del programma
 * @param {object} [o.limiti]
 */
export function creaAggiornamenti({ versione = '', leggiConfig = () => ({}), env = process.env, rete = {}, bandi = null, limiti = {} } = {}) {
  const L = { ...LIMITI, ...limiti };
  const opzioniRete = { env, ...rete };
  const base = bandi ? { predefiniti: bandi, schede: [] } : { predefiniti: BANDI_PREDEFINITI, schede: SCHEDE_BANDI };
  const ultimi = new Map(); // id del bando → Map(indirizzo → documento) trovati nell'ultimo controllo
  let dalCanale = {};       // voci del catalogo scaricato che hanno superato la verifica (più recenti dei bandi del programma)
  const inCorso = new Map();
  let recente = null;

  const prendi = (url, opzioni) => scarica(url, { versione, rete: opzioniRete, reindirizzamenti: L.reindirizzamenti, ...opzioni });

  /** Bandi con almeno una pagina da sorvegliare: [{ id, nome, pagine }]. */
  function elencoPagine() {
    const { bandi: simulabili, schede } = applicaAggiornamenti(base.predefiniti, base.schede, dalCanale);
    return [...simulabili, ...schede].map((b) => ({ id: b.id, nome: b.nomeBreve || b.nome || b.id, pagine: pagineDi(b, L.paginePerBando) })).filter((b) => b.id && b.pagine.length);
  }

  /** Indirizzi del canale: variabile d'ambiente, poi config.json, poi quelli del programma. Elenco vuoto = canale spento. */
  function indirizziCanale() {
    const daAmbiente = env.CLOCKWISE_CATALOGO;
    let scelta = daAmbiente != null && String(daAmbiente).trim() !== '' ? daAmbiente : null;
    if (scelta == null) { try { scelta = leggiConfig()?.canaleBandi ?? null; } catch { scelta = null; } }
    if (scelta == null || scelta === '') return [...CANALI_PREDEFINITI];
    if (scelta === false || /^(no|off|0|false|nessuno)$/i.test(String(scelta).trim())) return [];
    return (Array.isArray(scelta) ? scelta : String(scelta).split(/[\s,]+/)).map((v) => String(v).trim()).filter(Boolean).slice(0, 5);
  }

  async function leggiCanale() {
    const indirizzi = indirizziCanale();
    if (!indirizzi.length) return { catalogo: null, canale: { url: '', esito: 'disattivato' } };
    const tentativi = [];
    for (const url of indirizzi) {
      try {
        const r = await prendi(url, { max: L.catalogo, tempoMs: L.tempoPagina, accetta: 'application/json,text/plain;q=0.9,*/*;q=0.5' });
        let testo = new TextDecoder('utf-8').decode(r.corpo);
        if (testo.charCodeAt(0) === 0xfeff) testo = testo.slice(1);
        let catalogo = null;
        try { catalogo = JSON.parse(testo); } catch { /* non è JSON */ }
        if (!catalogo || typeof catalogo !== 'object' || Array.isArray(catalogo)) { tentativi.push({ url, esito: 'non_valido', dettaglio: 'il catalogo non è un JSON leggibile' }); continue; }
        return { catalogo, canale: { url, esito: 'ok', ...(tentativi.length ? { tentativi } : {}) } };
      } catch (e) {
        const er = erroreDa(e);
        tentativi.push({ url, esito: 'non_raggiungibile', codice: er.codice, dettaglio: er.message });
      }
    }
    const scelto = tentativi.find((t) => t.esito === 'non_valido') || tentativi[0];
    return { catalogo: null, canale: { url: scelto.url, esito: scelto.esito, ...(scelto.codice ? { codice: scelto.codice } : {}), dettaglio: scelto.dettaglio, ...(tentativi.length > 1 ? { tentativi } : {}) } };
  }

  async function rilevaPagina(url) {
    const r = await prendi(url, { max: L.pagina, tempoMs: L.tempoPagina, accetta: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' });
    const tipo = String(r.intestazioni?.['content-type'] || '').toLowerCase();
    if (tipo && !/^(text\/html|application\/xhtml\+xml|text\/plain)\b/.test(tipo)) throw new ErroreRete('tipo', 'l’indirizzo non restituisce una pagina HTML');
    const { documenti, troncato } = estraiDocumenti(decodificaPagina(r.corpo, tipo), r.url);
    return { url, ...(r.url !== url ? { finale: r.url } : {}), documenti, impronta: sha256(documenti.map((d) => d.url).join('\n')), ...(troncato ? { troncato: true } : {}) };
  }

  /**
   * Scarica le pagine dei bandi indicati e ne ricava gli elenchi dei documenti.
   * @param {{id: string, pagine: string[]}[]} scelti
   * @returns {Promise<Record<string, { url: string, impronta: string, documenti: object[], pagine: object[], errore?: string }>>}
   */
  async function rilevaPagine(scelti) {
    const indirizzi = [...new Set(scelti.flatMap((b) => b.pagine))];
    const esiti = new Map();
    const scadenza = Date.now() + L.tempoTotale;
    await inParallelo(indirizzi, L.paralleli, async (url) => {
      if (Date.now() > scadenza) { esiti.set(url, { url, codice: 'tempo', errore: 'controllo interrotto: tempo esaurito' }); return; }
      try { esiti.set(url, await rilevaPagina(url)); } catch (e) { const er = erroreDa(e); esiti.set(url, { url, codice: er.codice, errore: er.message }); }
    });
    const sorgenti = {};
    for (const b of scelti) {
      const pagine = b.pagine.map((u) => esiti.get(u));
      const riuscite = pagine.filter((p) => !p.errore);
      const unione = new Map();
      for (const p of riuscite) for (const d of p.documenti) if (!unione.has(d.url)) unione.set(d.url, d);
      const documenti = [...unione.values()].sort(perUrl);
      sorgenti[b.id] = { url: b.pagine[0], impronta: riuscite.length ? sha256(documenti.map((d) => d.url).join('\n')) : '', documenti, pagine, ...(riuscite.length ? {} : { errore: pagine[0]?.errore || 'pagina non raggiungibile' }) };
      if (riuscite.length) ultimi.set(b.id, unione);
    }
    return sorgenti;
  }

  async function eseguiControllo(richiesti) {
    let canale = { catalogo: null, canale: { url: '', esito: 'saltato' } };
    if (!richiesti) {
      canale = await leggiCanale();
      if (canale.catalogo) {
        // le pagine dei bandi nuovi o aggiornati si sorvegliano subito, ma solo se la voce supera la stessa verifica del programma
        try {
          const v = await verificaCatalogo(canale.catalogo, revisioniInUso(base.predefiniti, base.schede));
          dalCanale = Object.fromEntries(v.accettati.map((b) => [b.id, b]));
        } catch { dalCanale = {}; }
      }
    }
    const tutti = elencoPagine();
    const scelti = richiesti ? tutti.filter((b) => richiesti.includes(b.id)) : tutti;
    const sorgenti = await rilevaPagine(scelti);
    return { catalogo: canale.catalogo, canale: canale.canale, sorgenti, quando: new Date().toISOString() };
  }

  /** Il controllo completo (o dei soli bandi indicati): catalogo dal canale e pagine ufficiali. Una sola esecuzione alla volta per richiesta uguale. */
  function controlla({ ids } = {}) {
    const richiesti = Array.isArray(ids) ? [...new Set(ids.filter((x) => typeof x === 'string' && x && x.length <= 80))].slice(0, 300) : null;
    const chiave = richiesti ? `solo:${[...richiesti].sort().join(',')}` : 'tutto';
    if (inCorso.has(chiave)) return inCorso.get(chiave);
    if (recente && recente.chiave === chiave && Date.now() - recente.quando < L.memoriaMs) return Promise.resolve(recente.esito);
    const promessa = eseguiControllo(richiesti).then((esito) => { recente = { chiave, quando: Date.now(), esito }; return esito; }).finally(() => inCorso.delete(chiave));
    inCorso.set(chiave, promessa);
    return promessa;
  }

  /** Byte di un documento, solo se l'ultimo controllo l'ha trovato tra quelli pubblicati per quel bando. */
  async function documento({ id, url } = {}) {
    const elenco = typeof id === 'string' ? ultimi.get(id) : null;
    const voce = elenco && typeof url === 'string' ? elenco.get(url) : null;
    if (!voce) throw new ErroreRete('non_in_elenco', 'Documento non presente tra quelli rilevati nell’ultimo controllo di questo bando.');
    if (voce.tipo === 'pagina') throw new ErroreRete('non_documento', 'Questo indirizzo è una pagina, non un documento da scaricare.');
    const r = await prendi(voce.url, { max: L.documento, tempoMs: L.tempoDocumento, accetta: '*/*' });
    if (voce.tipo === 'pdf' && !r.corpo.subarray(0, 1024).includes('%PDF-')) throw new ErroreRete('non_documento', 'Il file scaricato non è un PDF.');
    const nome = (nomeDaUrl(r.url) || nomeDaUrl(voce.url) || 'documento').replace(/[^\w.\- ]+/g, '_').slice(0, 120);
    return { corpo: r.corpo, nome: nome.toLowerCase().endsWith(`.${voce.tipo}`) ? nome : `${nome}.${voce.tipo}`, tipo: voce.tipo, titolo: voce.titolo };
  }

  const STATI_HTTP = { non_in_elenco: 404, non_documento: 415, dimensione: 413, richiesta: 400 };
  /**
   * Rotte /api/bandi/… del server locale (già passate dal controllo dell'origine in servizio.js).
   * @param {{ json: Function, leggiCorpo: Function }} strumenti
   */
  async function gestisci(req, res, percorso, { json, leggiCorpo }) {
    // difesa in più: una pagina di un altro sito aperta nel browser non deve poter far partire scaricamenti
    const provenienza = req.headers['sec-fetch-site'];
    if (provenienza && provenienza !== 'same-origin' && provenienza !== 'none') return json(res, 403, { codice: 'origine', messaggio: 'Richiesta non consentita.' });
    if (percorso === '/api/bandi/controlla' && req.method === 'POST') {
      const corpo = await leggiCorpo(req, 64 * 1024);
      if (corpo.ids != null && !Array.isArray(corpo.ids)) return json(res, 400, { codice: 'richiesta', messaggio: 'Elenco dei bandi non valido.' });
      return json(res, 200, await controlla({ ids: corpo.ids }));
    }
    if (percorso === '/api/bandi/documento' && req.method === 'GET') {
      const parametri = new URL(req.url, 'http://localhost').searchParams;
      try {
        const d = await documento({ id: parametri.get('id'), url: parametri.get('url') });
        // mai come pagina: i byte arrivano da un sito esterno e non devono essere interpretati dal browser
        res.writeHead(200, {
          'content-type': 'application/octet-stream', 'content-length': d.corpo.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
          'content-disposition': `attachment; filename="${d.nome.replace(/[^\x20-\x7e]|["\\]/g, '_')}"`, 'content-security-policy': 'sandbox; default-src \'none\'', 'x-clockwise-tipo': d.tipo,
        });
        return res.end(d.corpo);
      } catch (e) {
        const er = erroreDa(e);
        return json(res, STATI_HTTP[er.codice] || 502, { codice: er.codice, messaggio: er.message });
      }
    }
    return json(res, 404, { codice: 'non_trovato', messaggio: 'Percorso inesistente.' });
  }

  return { controlla, documento, gestisci, elencoPagine, indirizziCanale, rilevaPagine };
}
