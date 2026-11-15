// Firma digitale (Authenticode) dei file .exe di Clockwise.
// Con una firma riconosciuta Windows mostra «Editore: <nome sul certificato>» invece di «Editore sconosciuto»
// e SmartScreen smette di bloccare l'installazione man mano che il certificato acquista reputazione.
//
// Si attiva solo se è configurato un certificato, in uno di questi modi (variabili d'ambiente):
//   CLOCKWISE_FIRMA_PFX=<percorso del file .pfx/.p12>   oppure   CLOCKWISE_FIRMA_PFX_BASE64=<contenuto in base64>
//   CLOCKWISE_FIRMA_PASSWORD=<password del file>
//     → su Windows firma signtool (Windows SDK), altrove osslsigncode.
//   CLOCKWISE_FIRMA_COMANDO=<comando con {file}>
//     → per certificati su token USB o servizi di firma in cloud (es. Azure Artifact Signing, jsign):
//       il comando deve firmare il file indicato al posto di {file}.
//   CLOCKWISE_FIRMA_TIMESTAMP=<url>   server di marca temporale RFC 3161 (predefinito DigiCert): la firma resta
//     valida anche dopo la scadenza del certificato.
//
// Uso da riga di comando: node scripts/windows/firma.mjs <file.exe> [altri file]
// (lo usa anche installer/clockwise.nsi per firmare il disinstallatore).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TIMESTAMP = process.env.CLOCKWISE_FIRMA_TIMESTAMP || 'http://timestamp.digicert.com';
const DESCRIZIONE = 'Clockwise';
const SITO = 'https://www.davidetipaldi.it';

/** Come è configurata la firma: { modo: 'comando'|'pfx'|null, ... } */
export function configurazioneFirma(env = process.env) {
  if (env.CLOCKWISE_FIRMA_COMANDO) return { modo: 'comando', comando: env.CLOCKWISE_FIRMA_COMANDO };
  if (env.CLOCKWISE_FIRMA_PFX || env.CLOCKWISE_FIRMA_PFX_BASE64) return { modo: 'pfx', pfx: env.CLOCKWISE_FIRMA_PFX || null, base64: env.CLOCKWISE_FIRMA_PFX_BASE64 || null, password: env.CLOCKWISE_FIRMA_PASSWORD || '' };
  return { modo: null };
}
export const firmaAttiva = (env = process.env) => configurazioneFirma(env).modo !== null;

function esegui(comando, args, { shell = false, nascondi = [] } = {}) {
  const r = spawnSync(comando, args, { encoding: 'utf8', shell });
  if (r.error) throw new Error(`Impossibile eseguire ${comando}: ${r.error.message}`);
  if (r.status !== 0) {
    let uscita = `${r.stdout || ''}${r.stderr || ''}`.trim();
    for (const s of nascondi) if (s) uscita = uscita.split(s).join('***');
    throw new Error(`${path.basename(comando)} è terminato con codice ${r.status}${uscita ? `:\n${uscita}` : ''}`);
  }
  return `${r.stdout || ''}${r.stderr || ''}`;
}

// signtool.exe del Windows SDK: nel PATH oppure nella cartella standard dei Windows Kits (la versione più recente).
export function trovaSigntool() {
  const r = spawnSync('signtool', ['/?'], { encoding: 'utf8' });
  if (!r.error && process.platform === 'win32') return 'signtool';
  const base = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin');
  if (!fs.existsSync(base)) return null;
  const versioni = fs.readdirSync(base).filter((v) => /^10\./.test(v)).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
  for (const v of versioni) {
    const f = path.join(base, v, 'x64', 'signtool.exe');
    if (fs.existsSync(f)) return f;
  }
  return null;
}

/** Firma un file. Restituisce una riga di descrizione, oppure null se la firma non è configurata. */
export function firma(file, env = process.env) {
  const cfg = configurazioneFirma(env);
  if (!cfg.modo) return null;
  if (!fs.existsSync(file)) throw new Error(`File da firmare inesistente: ${file}`);
  if (cfg.modo === 'comando') {
    if (!cfg.comando.includes('{file}')) throw new Error('CLOCKWISE_FIRMA_COMANDO deve contenere {file}.');
    esegui(cfg.comando.split('{file}').join(`"${file}"`), [], { shell: true });
    return 'firmato con il comando configurato';
  }
  // certificato in un file .pfx: copia temporanea se arriva in base64 (es. dai segreti della CI)
  let pfx = cfg.pfx, temporaneo = null;
  if (!pfx) {
    temporaneo = fs.mkdtempSync(path.join(os.tmpdir(), 'clockwise-firma-'));
    pfx = path.join(temporaneo, 'certificato.pfx');
    fs.writeFileSync(pfx, Buffer.from(cfg.base64.replace(/\s+/g, ''), 'base64'), { mode: 0o600 });
  }
  try {
    if (!fs.existsSync(pfx)) throw new Error(`Certificato non trovato: ${pfx}`);
    if (process.platform === 'win32') {
      const signtool = trovaSigntool();
      if (!signtool) throw new Error('signtool.exe non trovato: installa il Windows SDK (componente «Signing Tools»).');
      esegui(signtool, ['sign', '/fd', 'SHA256', '/f', pfx, ...(cfg.password ? ['/p', cfg.password] : []), '/tr', TIMESTAMP, '/td', 'SHA256', '/d', DESCRIZIONE, '/du', SITO, file], { nascondi: [cfg.password] });
      return `firmato con signtool (marca temporale: ${TIMESTAMP})`;
    }
    const firmato = `${file}.firmato`;
    fs.rmSync(firmato, { force: true });
    esegui('osslsigncode', ['sign', '-pkcs12', pfx, ...(cfg.password ? ['-pass', cfg.password] : []), '-h', 'sha256', '-n', DESCRIZIONE, '-i', SITO, '-ts', TIMESTAMP, '-in', file, '-out', firmato], { nascondi: [cfg.password] });
    fs.renameSync(firmato, file);
    return `firmato con osslsigncode (marca temporale: ${TIMESTAMP})`;
  } finally {
    if (temporaneo) fs.rmSync(temporaneo, { recursive: true, force: true });
  }
}

/** Legge la firma di un file (solo controllo di presenza e di integrità, non la fiducia nel certificato). */
export function leggiFirma(file) {
  if (process.platform === 'win32') {
    const r = spawnSync('powershell', ['-NoProfile', '-Command', `$s = Get-AuthenticodeSignature -LiteralPath '${file.replace(/'/g, "''")}'; "$($s.Status)|$($s.SignerCertificate.Subject)|$($s.TimeStamperCertificate.Subject)"`], { encoding: 'utf8' });
    const [stato, firmatario, marca] = (r.stdout || '').trim().split('|');
    return { presente: !!firmatario, stato, firmatario, marcaTemporale: !!marca };
  }
  const r = spawnSync('osslsigncode', ['verify', '-in', file], { encoding: 'utf8' });
  const testo = `${r.stdout || ''}${r.stderr || ''}`;
  const firmatario = /Subject:\s*(.+)/.exec(testo)?.[1]?.trim() || '';
  return { presente: /Signer's certificate|Number of signers: [1-9]/.test(testo), integro: /Message digest\s*:\s*(\S+)[\s\S]*Calculated message digest\s*:\s*\1/i.test(testo) || /Signature verification: ok/.test(testo), firmatario, marcaTemporale: /Timestamp/i.test(testo) };
}

// ---------------------------------------------------------------- riga di comando
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv.slice(2);
  if (!file.length) { console.error('Uso: node scripts/windows/firma.mjs <file.exe> [altri file]'); process.exit(2); }
  if (!firmaAttiva()) { console.log('Firma non configurata: nessun file firmato.'); process.exit(0); }
  try {
    for (const f of file) console.log(`${path.basename(f)}: ${firma(f)}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
