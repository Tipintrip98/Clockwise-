// Avvio di Clockwise come programma (Clockwise.exe): cartella dati dell'utente, scelta della
// porta, apertura del browser. Funzioni senza effetti all'importazione, così si possono provare.
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const PORTA_PREDEFINITA = 5757;

/** Dove l'eseguibile salva config.json: %APPDATA%\Clockwise, altrimenti ~/.clockwise. */
export function cartellaDatiEseguibile(env = process.env, casa = os.homedir()) {
  if (env.CLOCKWISE_DATA) return env.CLOCKWISE_DATA;
  if (env.APPDATA) return path.join(env.APPDATA, 'Clockwise');
  return path.join(casa, '.clockwise');
}

/** Comando che apre l'indirizzo nel browser predefinito del sistema. */
export function comandoBrowser(url, piattaforma = process.platform, env = process.env) {
  // Su Windows il primo argomento tra virgolette di "start" è il titolo della finestra: va lasciato vuoto.
  if (piattaforma === 'win32') return { comando: env.ComSpec || 'cmd.exe', args: ['/c', 'start', '""', url], opzioni: { windowsVerbatimArguments: true } };
  if (piattaforma === 'darwin') return { comando: 'open', args: [url], opzioni: {} };
  return { comando: 'xdg-open', args: [url], opzioni: {} };
}

/** Apre il browser; non blocca e non fallisce mai (al massimo l'utente copia l'indirizzo dalla finestra). */
export function apriBrowser(url, env = process.env) {
  if (env.CLOCKWISE_NO_BROWSER === '1') return false;
  if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+\/?$/.test(url)) return false; // solo l'indirizzo di Clockwise
  const { comando, args, opzioni } = comandoBrowser(url);
  try {
    // Su Windows cmd usa la finestra di Clockwise (nessuna finestra in più) e termina subito;
    // altrove il programma che apre il browser viene staccato da questo processo.
    const figlio = spawn(comando, args, { ...opzioni, stdio: 'ignore', detached: process.platform !== 'win32' });
    figlio.on('error', () => { /* nessun browser predefinito: resta l'indirizzo scritto nella finestra */ });
    figlio.unref();
    return true;
  } catch { return false; }
}

/**
 * C'è già un Clockwise in ascolto su questa porta? Chiede /api/stato: se risponde un JSON
 * con il campo `versione` è lui. Qualsiasi altra risposta (o nessuna) vuol dire di no.
 */
export function clockwiseGiaAvviato(porta, attesaMs = 8000) {
  return new Promise((ok) => {
    let finito = false;
    const fine = (v) => { if (!finito) { finito = true; ok(v); } };
    const req = http.get({ host: '127.0.0.1', port: porta, path: '/api/stato', headers: { accept: 'application/json' }, timeout: attesaMs }, (res) => {
      const pezzi = []; let tot = 0;
      res.on('data', (c) => { tot += c.length; if (tot > 1024 * 1024) { req.destroy(); fine(null); } else pezzi.push(c); });
      res.on('end', () => {
        try {
          const j = JSON.parse(Buffer.concat(pezzi).toString('utf8'));
          fine(res.statusCode === 200 && j && typeof j.versione === 'string' ? j : null);
        } catch { fine(null); }
      });
      res.on('error', () => fine(null));
    });
    req.on('timeout', () => { req.destroy(); fine(null); });
    req.on('error', () => fine(null));
  });
}

/** Prova ad ascoltare su 127.0.0.1:porta. true = in ascolto, false = porta non disponibile. */
export function ascolta(server, porta) {
  return new Promise((ok, ko) => {
    const suErrore = (e) => {
      server.off('listening', suAscolto);
      // EACCES: su Windows alcune porte sono riservate dal sistema (Hyper-V, WSL).
      if (e.code === 'EADDRINUSE' || e.code === 'EACCES') ok(false); else ko(e);
    };
    const suAscolto = () => { server.off('error', suErrore); ok(true); };
    server.once('error', suErrore);
    server.once('listening', suAscolto);
    server.listen(porta, '127.0.0.1');
  });
}

/** Chiede a un Clockwise già avviato su questa porta di chiudersi (POST /api/esci). true = ha risposto. */
export function chiediChiusura(porta, attesaMs = 5000) {
  return new Promise((ok) => {
    const req = http.request({ host: '127.0.0.1', port: porta, path: '/api/esci', method: 'POST', headers: { 'content-length': 0 }, timeout: attesaMs }, (res) => { res.resume(); res.on('end', () => ok(res.statusCode === 200)); res.on('error', () => ok(false)); });
    req.on('timeout', () => { req.destroy(); ok(false); });
    req.on('error', () => ok(false));
    req.end();
  });
}

/**
 * Avvio con sostituzione: se sulla porta risponde un Clockwise di un'ALTRA versione (quella vecchia rimasta aperta
 * dopo un aggiornamento), gli si chiede di chiudersi e si avvia questa. Con la stessa versione resta quello aperto.
 * @returns {Promise<{porta: number, giaAvviato: boolean, stato?: object, sostituita?: string}>}
 */
export async function avviaSostituendo(server, preferita, versione, { attesaMs = 8000, pausaMs = 400, giri = 20 } = {}) {
  let esito = await avviaSuPortaLibera(server, preferita, { attesaMs });
  if (!esito.giaAvviato || !versione || esito.stato?.versione === versione) return esito;
  const vecchia = esito.stato?.versione || 'sconosciuta';
  if (!(await chiediChiusura(esito.porta))) return esito; // non si chiude: meglio riaprire quella che c'è
  for (let i = 0; i < giri; i++) {
    await new Promise((ok) => setTimeout(ok, pausaMs));
    if (await ascolta(server, esito.porta)) return { porta: esito.porta, giaAvviato: false, sostituita: vecchia };
  }
  esito = await avviaSuPortaLibera(server, preferita, { attesaMs });
  return esito.giaAvviato ? esito : { ...esito, sostituita: vecchia };
}

/**
 * Mette il server in ascolto sulla porta preferita o, se è occupata da altro, sulla prima libera
 * dopo di lei. Se sulla porta occupata risponde già Clockwise non avvia niente.
 * @returns {Promise<{porta: number, giaAvviato: boolean, stato?: object}>}
 */
export async function avviaSuPortaLibera(server, preferita = PORTA_PREDEFINITA, { tentativi = 30, attesaMs = 8000 } = {}) {
  for (let porta = preferita; porta < preferita + tentativi && porta < 65536; porta++) {
    if (await ascolta(server, porta)) return { porta, giaAvviato: false };
    const stato = await clockwiseGiaAvviato(porta, attesaMs);
    if (stato) return { porta, giaAvviato: true, stato };
  }
  throw Object.assign(new Error(`Nessuna porta libera tra ${preferita} e ${preferita + tentativi - 1}.`), { codice: 'porte' });
}
