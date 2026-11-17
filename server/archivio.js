// Archivio su disco: tutto ciò che Clockwise salva (dossier, impostazioni, bandi aggiunti, casi reali) e i file
// originali caricati restano nella cartella dei dati dell'utente (%APPDATA%\Clockwise\archivio), non solo nel browser.
// Così i dossier sopravvivono alla pulizia del browser, al cambio di browser e al cambio di porta.
//   archivio/kv/<chiave>.json                 un valore per chiave (le stesse chiavi di app/js/core/store.js)
//   archivio/originali/<gruppo>/<id>/<nome>   il file caricato, con il suo nome (gruppo = dossier o «bandi»)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHIAVE = /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,119}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const MAX_VALORE = 400 * 1024 * 1024;
const MAX_FILE = 600 * 1024 * 1024;
// Solo questi tipi si aprono nel browser; tutto il resto viene scaricato (un HTML caricato non deve mai essere eseguito).
const IN_LINEA = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8' };
const RISERVATI = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

const fileChiave = (k) => `${k.replace(/:/g, '~')}.json`;
const chiaveDaFile = (f) => f.slice(0, -5).replace(/~/g, ':');

/** Nome di file sicuro per Windows, macOS e Linux: niente percorsi, niente caratteri vietati, mai vuoto. */
export function nomeSicuro(nome) {
  let n = String(nome || '').split(/[\\/]/).pop().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '').trim();
  if (n.length > 150) { const est = path.extname(n).slice(0, 12); n = n.slice(0, 150 - est.length) + est; }
  if (!n || n === '.' || n === '..') n = 'file';
  return RISERVATI.test(n) ? `_${n}` : n;
}

function scriviAtomico(file, dati) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, dati);
  fs.renameSync(tmp, file);
}

function leggiGrezzo(req, max) {
  return new Promise((ok, ko) => {
    const pezzi = []; let tot = 0;
    req.on('data', (c) => { tot += c.length; if (tot > max) { ko(Object.assign(new Error('Contenuto troppo grande.'), { stato: 413 })); req.destroy(); } else pezzi.push(c); });
    req.on('end', () => ok(Buffer.concat(pezzi)));
    req.on('error', ko);
  });
}

/** Riceve un file senza tenerlo in memoria: lo scrive in un temporaneo e lo sposta al suo posto solo se è arrivato tutto. */
function riceviFile(req, destinazione, max) {
  return new Promise((ok, ko) => {
    fs.mkdirSync(path.dirname(destinazione), { recursive: true });
    const tmp = `${destinazione}.${process.pid}.${Date.now()}.tmp`;
    const uscita = fs.createWriteStream(tmp);
    let tot = 0, finito = false;
    const fallito = (e) => { if (finito) return; finito = true; uscita.destroy(); fs.rm(tmp, { force: true }, () => ko(e)); };
    req.on('data', (c) => { tot += c.length; if (tot > max) { fallito(Object.assign(new Error('File troppo grande.'), { stato: 413 })); req.destroy(); } });
    req.on('error', fallito); req.on('aborted', () => fallito(Object.assign(new Error('Invio interrotto.'), { stato: 400 })));
    uscita.on('error', fallito);
    uscita.on('finish', () => { if (finito) return; finito = true; try { fs.renameSync(tmp, destinazione); ok(tot); } catch (e) { fs.rm(tmp, { force: true }, () => ko(e)); } });
    req.pipe(uscita);
  });
}

/**
 * @param {object} o
 * @param {string} o.cartellaDati  cartella dei dati dell'utente
 * @param {(cartella: string) => void} [o.apriCartella]  nelle prove sostituisce l'apertura di Esplora file
 */
export function creaArchivio({ cartellaDati, apriCartella }) {
  const radice = path.join(cartellaDati, 'archivio');
  const kv = path.join(radice, 'kv');
  const originali = path.join(radice, 'originali');

  function elencoChiavi() {
    let nomi = [];
    try { nomi = fs.readdirSync(kv); } catch { return []; }
    return nomi.filter((f) => f.endsWith('.json')).map((f) => {
      try { const s = fs.statSync(path.join(kv, f)); return { chiave: chiaveDaFile(f), byte: s.size, modificato: Math.round(s.mtimeMs) }; } catch { return null; }
    }).filter(Boolean);
  }
  // l'unico file dentro originali/<gruppo>/<id>/
  function fileOriginale(gruppo, id) {
    const dir = path.join(originali, gruppo, id);
    try { const nome = fs.readdirSync(dir).find((n) => !n.endsWith('.tmp')); return nome ? { dir, nome, percorso: path.join(dir, nome) } : null; } catch { return null; }
  }
  function misura(dir) {
    let file = 0, byte = 0;
    const giro = (d) => { let voci = []; try { voci = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const v of voci) { const p = path.join(d, v.name); if (v.isDirectory()) giro(p); else { try { byte += fs.statSync(p).size; file++; } catch { /* sparito nel frattempo */ } } } };
    giro(dir);
    return { file, byte };
  }
  function apri(cartella) {
    fs.mkdirSync(cartella, { recursive: true });
    if (apriCartella) return apriCartella(cartella);
    if (process.env.CLOCKWISE_NO_BROWSER === '1') return;
    const [comando, args] = process.platform === 'win32' ? ['explorer.exe', [cartella]] : process.platform === 'darwin' ? ['open', [cartella]] : ['xdg-open', [cartella]];
    try { const f = spawn(comando, args, { stdio: 'ignore', detached: process.platform !== 'win32' }); f.on('error', () => {}); f.unref(); } catch { /* resta il percorso scritto nella pagina */ }
  }

  /** Gestisce le richieste /api/archivio…; `json(res, stato, corpo)` è quello del servizio. */
  async function gestisci(req, res, percorso, { json }) {
    // niente letture dei dossier da pagine di altri siti aperte nello stesso browser
    const sito = req.headers['sec-fetch-site'];
    if (sito && sito !== 'same-origin' && sito !== 'none') return json(res, 403, { codice: 'origine', messaggio: 'Richiesta non consentita.' });
    const parti = percorso.split('/').slice(3).map((x) => { try { return decodeURIComponent(x); } catch { return '\u0000'; } });
    const metodo = req.method;

    if (!parti.length && metodo === 'GET') {
      const o = misura(originali);
      return json(res, 200, { attivo: true, cartella: radice, chiavi: elencoChiavi(), originali: o.file, byteOriginali: o.byte });
    }
    if (parti[0] === 'apri' && parti.length === 1 && metodo === 'POST') { apri(radice); return json(res, 200, { ok: true, cartella: radice }); }

    if (parti[0] === 'kv' && parti.length === 2) {
      if (!CHIAVE.test(parti[1])) return json(res, 400, { codice: 'chiave', messaggio: 'Chiave non valida.' });
      const file = path.join(kv, fileChiave(parti[1]));
      if (metodo === 'GET') {
        let dati;
        // 204 e non 404: una chiave mai scritta è normale e non deve riempire di errori la console del browser
        try { dati = fs.readFileSync(file); } catch { res.writeHead(204, { 'cache-control': 'no-store' }); return res.end(); }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(dati);
      }
      if (metodo === 'PUT') {
        const corpo = await leggiGrezzo(req, MAX_VALORE);
        try { JSON.parse(corpo.toString('utf8')); } catch { return json(res, 400, { codice: 'json', messaggio: 'JSON non valido.' }); }
        scriviAtomico(file, corpo);
        return json(res, 200, { ok: true, byte: corpo.length });
      }
      if (metodo === 'DELETE') { fs.rmSync(file, { force: true }); return json(res, 200, { ok: true }); }
    }

    if (parti[0] === 'file' && (parti.length === 2 || parti.length === 3)) {
      const [, gruppo, id] = parti;
      if (!ID.test(gruppo) || (id != null && !ID.test(id))) return json(res, 400, { codice: 'id', messaggio: 'Identificativo non valido.' });
      if (id == null) {
        if (metodo === 'DELETE') { fs.rmSync(path.join(originali, gruppo), { recursive: true, force: true }); return json(res, 200, { ok: true }); }
        if (metodo === 'GET') {
          let ids = [];
          try { ids = fs.readdirSync(path.join(originali, gruppo)); } catch { /* nessun file per questo gruppo */ }
          return json(res, 200, { file: ids.filter((x) => ID.test(x)).map((x) => { const f = fileOriginale(gruppo, x); return f ? { id: x, nome: f.nome, byte: fs.statSync(f.percorso).size } : null; }).filter(Boolean) });
        }
      } else {
        if (metodo === 'PUT') {
          const nome = nomeSicuro(new URL(req.url, 'http://localhost').searchParams.get('nome'));
          const dir = path.join(originali, gruppo, id);
          fs.rmSync(dir, { recursive: true, force: true }); // un solo file per documento: il nuovo sostituisce il vecchio
          const byte = await riceviFile(req, path.join(dir, nome), MAX_FILE);
          return json(res, 200, { ok: true, nome, byte });
        }
        if (metodo === 'GET') {
          const f = fileOriginale(gruppo, id);
          if (!f) return json(res, 404, { codice: 'assente', messaggio: 'File non trovato nell’archivio.' });
          const tipo = IN_LINEA[path.extname(f.nome).toLowerCase()];
          res.writeHead(200, {
            'content-type': tipo || 'application/octet-stream', 'content-length': fs.statSync(f.percorso).size, 'cache-control': 'no-store',
            'content-disposition': `${tipo ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.nome)}`,
            'x-content-type-options': 'nosniff', 'content-security-policy': "sandbox; default-src 'none'",
          });
          return fs.createReadStream(f.percorso).on('error', () => res.destroy()).pipe(res);
        }
        if (metodo === 'DELETE') { fs.rmSync(path.join(originali, gruppo, id), { recursive: true, force: true }); return json(res, 200, { ok: true }); }
      }
    }
    return json(res, 404, { codice: 'non_trovato', messaggio: 'Percorso inesistente.' });
  }

  return { gestisci, radice };
}
