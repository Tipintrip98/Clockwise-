// Costruisce il pacchetto di Clockwise per Windows:
//   dist/windows/Clockwise.exe                  eseguibile unico (Node.js SEA): doppio clic -> server + browser
//   dist/windows/Clockwise-Setup-<versione>.exe installatore NSIS per utente, senza diritti di amministratore
// Funziona su Windows (in CI) e su Linux/macOS (compilazione incrociata).
//
//   npm run build:windows                      tutto
//   npm run build:windows -- --linux-smoke     in più: stesso contenuto dentro il node locale e prova reale
//   npm run build:windows -- --senza-installer solo Clockwise.exe
//   npm run build:windows -- --installer-obbligatorio   errore se manca makensis (predefinito su Windows)
//   npm run build:windows -- --senza-risorse   non tocca icona e proprietà del file .exe
//   npm run build:windows -- --richiedi-firma  errore se non è configurato un certificato di firma
//
// Firma digitale: se è configurato un certificato (vedi scripts/windows/firma.mjs) vengono firmati
// Clockwise.exe, il disinstallatore e l'installatore. Senza certificato i file restano non firmati.
//
// Passi: 1) esbuild riunisce server/eseguibile.js in un solo CommonJS; 2) i file di app/ diventano
// asset SEA; 3) `node --experimental-sea-config` crea il blob; 4) il blob viene iniettato con postject
// in una copia di node.exe (su Linux quello ufficiale per Windows, preso dal registro npm, della
// stessa versione del node che ha creato il blob); 5) icona e proprietà del file con resedit;
// 6) makensis crea l'installatore da installer/clockwise.nsi.
// Variabile CLOCKWISE_NODE_EXE=/percorso/node.exe: usa quel node.exe invece di scaricarlo.
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { firma, firmaAttiva, leggiFirma, configurazioneFirma } from './windows/firma.mjs';

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIN = process.platform === 'win32';
const opzioni = new Set(process.argv.slice(2));
const OPZIONI_NOTE = ['--richiedi-firma', '--linux-smoke', '--senza-installer', '--installer-obbligatorio', '--senza-risorse'];
for (const o of opzioni) if (!OPZIONI_NOTE.includes(o)) { console.error(`Opzione sconosciuta: ${o}\nOpzioni: ${OPZIONI_NOTE.join(' ')}`); process.exit(2); }

const pacchetto = JSON.parse(fs.readFileSync(path.join(radice, 'package.json'), 'utf8'));
const versione = pacchetto.version;
// Per le risorse di Windows servono quattro numeri: 1.1.0 -> 1.1.0.0 (eventuali suffissi "-beta" cadono).
const numeri = [...versione.split(/[-+]/)[0].split('.').map((n) => parseInt(n, 10) || 0), 0, 0, 0, 0].slice(0, 4);
const versioneNumerica = numeri.join('.');

const uscita = path.join(radice, 'dist', 'windows');
const lavoro = path.join(uscita, 'lavoro');
const deposito = path.join(radice, 'dist', '.cache', 'windows');
const fileExe = path.join(uscita, 'Clockwise.exe');
const fileSetup = path.join(uscita, `Clockwise-Setup-${versione}.exe`);
const fileIcona = path.join(radice, 'installer', 'clockwise.ico');
const EDITORE = 'Davide Tipaldi'; // come in app/js/core/versione.js e in installer/clockwise.nsi
const FUSIBILE = ['NODE_SEA_FUSE', 'fce680ab2cc467b6e072b8b5df1996b2'].join('_'); // spezzato: nel file deve comparire una volta sola

const rel = (f) => path.relative(radice, f).split(path.sep).join('/');
const mb = (f) => `${(fs.statSync(f).size / 1024 / 1024).toFixed(1)} MB`;
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const passo = (t) => console.log(`\n— ${t}`);
const nota = (t) => console.log(`  ${t}`);
class ErroreBuild extends Error {}
const errore = (t) => { throw new ErroreBuild(t); };

function esegui(comando, args, extra = {}) {
  const r = spawnSync(comando, args, { stdio: 'inherit', ...extra });
  if (r.error) errore(`Impossibile eseguire ${comando}: ${r.error.message}`);
  if (r.status !== 0) errore(`${comando} è terminato con codice ${r.status}.`);
  return r;
}

// ---------------------------------------------------------------- 1. server in un solo file
async function impacchettaServer() {
  passo('Server: un solo file CommonJS (esbuild)');
  const file = path.join(lavoro, 'clockwise.cjs');
  await build({
    entryPoints: [path.join(radice, 'server', 'eseguibile.js')],
    outfile: file, bundle: true, platform: 'node', format: 'cjs', target: `node${process.versions.node.split('.')[0]}`,
    legalComments: 'none', logLevel: 'warning',
  });
  const testo = fs.readFileSync(file, 'utf8');
  // Dentro l'eseguibile require() carica solo i moduli interni di Node: niente deve restare fuori dal file.
  const esterni = [...testo.matchAll(/\brequire\(["']([^"']+)["']\)/g)].map((m) => m[1]).filter((m) => !m.startsWith('node:') && !require('node:module').builtinModules.includes(m));
  if (esterni.length) errore(`Il file del server richiede moduli non incorporati: ${[...new Set(esterni)].join(', ')}`);
  if (testo.includes(FUSIBILE)) errore('Il file del server contiene la stringa del fusibile SEA: postject non saprebbe quale attivare.');
  nota(`${rel(file)} — ${(testo.length / 1024).toFixed(0)} KB`);
  return file;
}

// ---------------------------------------------------------------- 2. interfaccia come asset
function elencaFile(cartella, base = cartella) {
  return fs.readdirSync(cartella, { withFileTypes: true }).flatMap((v) => {
    if (v.name.startsWith('.')) return []; // .DS_Store e simili
    const f = path.join(cartella, v.name);
    return v.isDirectory() ? elencaFile(f, base) : [path.relative(base, f).split(path.sep).join('/')];
  }).sort();
}

function preparaInterfaccia() {
  passo('Interfaccia: file di app/ come asset dell’eseguibile');
  // Copia di lavoro: l'eseguibile contiene esattamente questi file, anche se app/ cambia durante la build.
  const copia = path.join(lavoro, 'app');
  fs.cpSync(path.join(radice, 'app'), copia, { recursive: true });
  const file = elencaFile(copia);
  for (const serve of ['index.html', 'css/app.css', 'js/main.js']) if (!file.includes(serve)) errore(`Manca app/${serve}.`);
  if (!file.some((f) => f.startsWith('vendor/'))) errore('Manca app/vendor: i lettori di PDF, Word ed Excel devono stare dentro l’eseguibile.');
  const impronte = Object.fromEntries(file.map((f) => [f, sha256(path.join(copia, f))]));
  const manifesto = path.join(lavoro, 'manifesto.json');
  fs.writeFileSync(manifesto, JSON.stringify({ nome: 'Clockwise', versione, node: process.version, file }, null, 2));
  const asset = { 'manifesto.json': manifesto };
  for (const f of file) asset[`app/${f}`] = path.join(copia, f);
  const peso = file.reduce((s, f) => s + fs.statSync(path.join(copia, f)).size, 0);
  nota(`${file.length} file, ${(peso / 1024 / 1024).toFixed(1)} MB (${file.filter((f) => f.startsWith('vendor/')).length} in vendor/, ${file.filter((f) => f.startsWith('js/')).length} moduli JS)`);
  return { asset, file, impronte };
}

// ---------------------------------------------------------------- 3. blob SEA
function creaBlob(principale, asset) {
  passo(`Blob SEA (node ${process.version})`);
  const blob = path.join(lavoro, 'clockwise.blob');
  const config = path.join(lavoro, 'sea-config.json');
  // Senza snapshot e senza code cache il blob non dipende dal sistema su cui nasce:
  // creato su Linux funziona dentro il node.exe di Windows della stessa versione.
  fs.writeFileSync(config, JSON.stringify({ main: principale, output: blob, disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false, assets: asset }, null, 2));
  esegui(process.execPath, ['--experimental-sea-config', config]);
  nota(`${rel(blob)} — ${mb(blob)}`);
  return blob;
}

// ---------------------------------------------------------------- 4. node.exe per Windows
function scarica(url, destinazione) {
  // curl rispetta il proxy di sistema (HTTPS_PROXY), il fetch di Node 22 no.
  const r = spawnSync('curl', ['-fsSL', '--retry', '2', '--max-time', '300', '-o', destinazione, url], { stdio: ['ignore', 'ignore', 'pipe'] });
  return !r.error && r.status === 0;
}

function nodePerWindows() {
  passo('node.exe per Windows');
  if (process.env.CLOCKWISE_NODE_EXE) {
    const f = path.resolve(process.env.CLOCKWISE_NODE_EXE);
    if (!fs.existsSync(f)) errore(`CLOCKWISE_NODE_EXE punta a un file che non esiste: ${f}`);
    nota(`da CLOCKWISE_NODE_EXE: ${f} (deve essere node ${process.version}, la stessa versione che crea il blob)`);
    return { file: f, licenza: null };
  }
  if (WIN) {
    const licenza = path.join(path.dirname(process.execPath), 'LICENSE');
    nota(`copia di questo node: ${process.execPath} (${process.version}, ${process.arch})`);
    return { file: process.execPath, licenza: fs.existsSync(licenza) ? licenza : null };
  }
  // Compilazione incrociata: serve il node.exe della STESSA versione del node che ha creato il blob.
  const v = process.versions.node;
  const cartella = path.join(deposito, `node-v${v}-win-x64`);
  const file = path.join(cartella, 'node.exe');
  const licenzaLocale = path.resolve(path.dirname(process.execPath), '..', 'LICENSE');
  const licenza = fs.existsSync(licenzaLocale) ? licenzaLocale : null;
  if (fs.existsSync(file)) { nota(`già scaricato: ${rel(file)}`); }
  else {
    fs.mkdirSync(cartella, { recursive: true });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clockwise-node-'));
    try {
      // a) registro npm: il pacchetto node-win-x64 contiene il node.exe ufficiale (bin/node.exe)
      nota(`scarico node-win-x64@${v} dal registro npm…`);
      const npm = spawnSync('npm', ['pack', `node-win-x64@${v}`, '--pack-destination', tmp, '--silent'], { cwd: tmp, encoding: 'utf8', shell: false });
      const tgz = path.join(tmp, `node-win-x64-${v}.tgz`);
      let ottenuto = null;
      if (!npm.error && npm.status === 0 && fs.existsSync(tgz)) {
        const estratto = path.join(tmp, 'estratto');
        fs.mkdirSync(estratto);
        const tar = spawnSync('tar', ['-xzf', tgz, '-C', estratto, 'package/bin/node.exe'], { stdio: 'inherit' });
        if (tar.status === 0) ottenuto = path.join(estratto, 'package', 'bin', 'node.exe');
      } else nota(`npm non ha il pacchetto node-win-x64@${v}: ${String(npm.stderr || npm.error?.message || '').trim().split('\n')[0]}`);
      // b) nodejs.org
      if (!ottenuto) {
        nota(`provo da https://nodejs.org/dist/v${v}/win-x64/node.exe …`);
        const diretto = path.join(tmp, 'node.exe');
        if (scarica(`https://nodejs.org/dist/v${v}/win-x64/node.exe`, diretto)) ottenuto = diretto;
      }
      if (!ottenuto) errore(`Non riesco a scaricare node.exe ${v} per Windows (né da npm né da nodejs.org).\n  Scaricalo a mano e indica il file con CLOCKWISE_NODE_EXE=/percorso/node.exe`);
      fs.copyFileSync(ottenuto, file);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  // Controllo con le impronte ufficiali di nodejs.org (se raggiungibile).
  const impronta = sha256(file);
  const somme = path.join(cartella, 'SHASUMS256.txt');
  if (!fs.existsSync(somme)) scarica(`https://nodejs.org/dist/v${v}/SHASUMS256.txt`, somme);
  const attesa = fs.existsSync(somme) ? fs.readFileSync(somme, 'utf8').split('\n').find((r) => r.trim().endsWith(' win-x64/node.exe'))?.split(/\s+/)[0] : null;
  if (attesa && attesa !== impronta) { fs.rmSync(cartella, { recursive: true, force: true }); errore(`node.exe scaricato NON corrisponde all’impronta ufficiale di nodejs.org.\n  attesa   ${attesa}\n  ottenuta ${impronta}`); }
  nota(attesa ? `node.exe v${v} win-x64 — ${mb(file)} — sha256 uguale a quello pubblicato su nodejs.org` : `node.exe v${v} win-x64 — ${mb(file)} — sha256 ${impronta} (nodejs.org non raggiungibile: impronta non confrontata)`);
  return { file, licenza };
}

// ---------------------------------------------------------------- 5. Clockwise.exe
// Icona e proprietà del file (quelle che Windows mostra in Esplora file e nella barra delle applicazioni).
// Si fa DOPO l'iniezione: a quel punto le risorse sono l'ultima sezione del file e riscriverle non
// sposta nient'altro (codice, dati e tabella delle rilocazioni restano dove li ha messi Node).
// La firma digitale di node.exe viene tolta: dopo l'iniezione non sarebbe comunque più valida.
const RT_RCDATA = 10;
async function personalizzaRisorse(file, blob) {
  const PE = await import('pe-library');
  const ResEdit = await import('resedit');
  const impronta = (dati) => crypto.createHash('sha256').update(Buffer.from(dati)).digest('hex');
  const leggi = () => { const exe = PE.NtExecutable.from(fs.readFileSync(file), { ignoreCert: true }); return { exe, risorse: PE.NtExecutableResource.from(exe) }; };
  const contenutoSea = (risorse) => risorse.entries.find((e) => e.type === RT_RCDATA && e.id === 'NODE_SEA_BLOB');

  const { exe, risorse } = leggi();
  if (!contenutoSea(risorse)) errore('Nel file .exe non trovo il contenuto SEA appena iniettato.');
  const icona = ResEdit.Data.IconFile.from(fs.readFileSync(fileIcona));
  const gruppo = ResEdit.Resource.IconGroupEntry.fromEntries(risorse.entries)[0] || { id: 1, lang: 1033 };
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(risorse.entries, gruppo.id, gruppo.lang, icona.icons.map((i) => i.data));
  const info = ResEdit.Resource.VersionInfo.fromEntries(risorse.entries)[0];
  if (info) {
    const lingue = info.getAllLanguagesForStringValues();
    for (const lingua of lingue.length ? lingue : [{ lang: 1033, codepage: 1200 }]) {
      // Il file resta il motore di Node.js con dentro Clockwise: il copyright cita entrambi.
      info.setStringValues(lingua, {
        ProductName: 'Clockwise', FileDescription: 'Clockwise — simulatore di punteggio bandi cinema', InternalName: 'Clockwise', OriginalFilename: 'Clockwise.exe',
        CompanyName: EDITORE, LegalCopyright: `Clockwise © ${EDITORE}. Contiene Node.js © Node.js contributors (licenza MIT).`,
        FileVersion: versione, ProductVersion: versione,
      });
    }
    info.setFileVersion(...numeri);
    info.setProductVersion(...numeri);
    info.outputToResourceEntries(risorse.entries);
  }
  risorse.outputResource(exe, false, true);
  fs.writeFileSync(file, Buffer.from(exe.generate()));

  // Rilettura: il contenuto SEA deve essere rimasto identico byte per byte.
  const dopo = leggi().risorse;
  const sea = contenutoSea(dopo);
  if (!sea || impronta(sea.bin) !== impronta(fs.readFileSync(blob))) errore('Dopo aver impostato l’icona il contenuto SEA non è più quello iniettato.');
  const icone = ResEdit.Resource.IconGroupEntry.fromEntries(dopo.entries)[0]?.icons.length || 0;
  if (icone !== icona.icons.length) errore('L’icona non è stata scritta nel file .exe.');
  return icone;
}

// Lettura minima dell'intestazione PE: serve a controllare il risultato anche da Linux.
// `struttura` è null se le sezioni sono come le vuole il caricatore di Windows: in ordine, una
// attaccata all'altra, dentro il file, e con la dimensione dell'immagine che torna.
function leggiPE(file) {
  const b = fs.readFileSync(file);
  if (b.toString('latin1', 0, 2) !== 'MZ') return null;
  const pe = b.readUInt32LE(0x3C);
  if (b.toString('latin1', pe, pe + 4) !== 'PE\0\0') return null;
  const macchina = b.readUInt16LE(pe + 4);
  const quante = b.readUInt16LE(pe + 6);
  const opz = pe + 24;
  const magico = b.readUInt16LE(opz);
  const allinea = (v) => Math.ceil(v / b.readUInt32LE(opz + 32)) * b.readUInt32LE(opz + 32);
  const sottosistema = b.readUInt16LE(opz + 68);
  const dir = opz + (magico === 0x20B ? 112 : 96);
  const tabella = opz + b.readUInt16LE(pe + 20);
  const sezioni = Array.from({ length: quante }, (_, i) => {
    const o = tabella + i * 40;
    return { nome: b.toString('latin1', o, o + 8).replace(/\0+$/, ''), dimensione: b.readUInt32LE(o + 8), indirizzo: b.readUInt32LE(o + 12), grezzi: b.readUInt32LE(o + 16), posizione: b.readUInt32LE(o + 20) };
  });
  let struttura = null;
  sezioni.forEach((z, i) => {
    const prima = sezioni[i - 1];
    if (prima && z.indirizzo !== allinea(prima.indirizzo + prima.dimensione)) struttura ??= `la sezione ${z.nome} non segue ${prima.nome}`;
    if (z.posizione + z.grezzi > b.length) struttura ??= `la sezione ${z.nome} esce dal file`;
  });
  const ultima = sezioni.at(-1);
  if (b.readUInt32LE(opz + 56) !== allinea(ultima.indirizzo + ultima.dimensione)) struttura ??= 'la dimensione dell’immagine non corrisponde alle sezioni';
  const dentro = (indice) => { const rva = b.readUInt32LE(dir + indice * 8), lungo = b.readUInt32LE(dir + indice * 8 + 4); return !rva || sezioni.some((z) => rva >= z.indirizzo && rva + lungo <= z.indirizzo + Math.max(z.dimensione, z.grezzi)); };
  if (!dentro(2)) struttura ??= 'le risorse non stanno in una sezione';
  if (!dentro(5)) struttura ??= 'la tabella delle rilocazioni non sta in una sezione';
  return {
    architettura: { 0x8664: 'x64', 0xAA64: 'arm64', 0x14C: 'x86' }[macchina] || `0x${macchina.toString(16)}`,
    formato: magico === 0x20B ? 'PE32+' : 'PE32',
    sottosistema: { 2: 'finestre', 3: 'console' }[sottosistema] || String(sottosistema),
    firma: b.readUInt32LE(dir + 4 * 8 + 4) > 0, // tabella dei certificati (Authenticode)
    fusibileAttivo: b.includes(`${FUSIBILE}:1`),
    sezioni: sezioni.map((z) => z.nome),
    struttura,
  };
}

// postject (che usa la libreria LIEF) scrive i suoi avvisi con console.warn. Due sono previsti e
// innocui: la firma di node.exe che non torna più (il file è stato appena modificato) e, sugli
// eseguibili Linux, i nomi delle sezioni ".note". Si mostrano solo gli altri.
const AVVISI_PREVISTI = [/signature seems corrupted/i, /Can't find string offset for section name/i];
async function inietta(file, blob) {
  const { inject } = require('postject');
  const avvisi = [];
  const originale = console.warn;
  console.warn = (...parti) => { avvisi.push(parti.join(' ')); };
  try { await inject(file, 'NODE_SEA_BLOB', fs.readFileSync(blob), { sentinelFuse: FUSIBILE }); }
  finally { console.warn = originale; }
  const imprevisti = avvisi.filter((a) => !AVVISI_PREVISTI.some((r) => r.test(a)));
  for (const a of imprevisti) console.warn(`  postject: ${a}`);
  return { previsti: avvisi.length - imprevisti.length, imprevisti: imprevisti.length };
}

// node.exe è un programma da console: Windows gli aprirebbe sempre una finestra nera. Il campo «Subsystem»
// dell'intestazione PE passa da 3 (console) a 2 (finestre): Clockwise resta attivo in background senza finestra,
// e Node, senza console, scarta da solo ciò che il programma scriverebbe a video (lo si ritrova in clockwise.log).
function senzaConsole(file) {
  const b = fs.readFileSync(file);
  const pe = b.readUInt32LE(0x3C);
  if (b.toString('latin1', 0, 2) !== 'MZ' || b.toString('latin1', pe, pe + 4) !== 'PE\0\0') errore('Clockwise.exe non ha un’intestazione PE valida.');
  const campo = pe + 24 + 68;
  if (b.readUInt16LE(campo) === 3) { b.writeUInt16LE(2, campo); fs.writeFileSync(file, b); }
  nota('eseguibile marcato come programma senza finestra della console (resta attivo in background)');
}

async function creaExe(nodeExe, blob) {
  passo('Clockwise.exe');
  fs.copyFileSync(nodeExe, fileExe);
  fs.chmodSync(fileExe, 0o755);
  await inietta(fileExe, blob);
  nota('contenuto SEA iniettato con postject');
  if (opzioni.has('--senza-risorse')) nota('icona e proprietà del file: saltate (--senza-risorse)');
  else {
    const icone = await personalizzaRisorse(fileExe, blob);
    nota(`icona di Clockwise (${icone} misure) e proprietà del file impostate, firma di node.exe rimossa; contenuto SEA riletto: identico`);
  }
  senzaConsole(fileExe);
  const pe = leggiPE(fileExe);
  if (!pe || !pe.fusibileAttivo) errore('Clockwise.exe non è un eseguibile Windows valido con il contenuto SEA attivo.');
  if (pe.sottosistema !== 'finestre') errore('Clockwise.exe risulta ancora un programma da console: comparirebbe la finestra nera.');
  if (pe.struttura) errore(`Clockwise.exe ha una struttura che Windows rifiuterebbe: ${pe.struttura}. Riprova con --senza-risorse.`);
  nota(`${rel(fileExe)} — ${mb(fileExe)} — ${pe.formato} ${pe.architettura}, ${pe.sottosistema}, ${pe.firma ? 'firma di node.exe presente ma non più valida' : 'senza firma digitale'}`);
  firmaFile(fileExe);
}

// ---------------------------------------------------------------- firma digitale
function firmaFile(file) {
  if (!firmaAttiva()) return false;
  try { nota(`${path.basename(file)}: ${firma(file)}`); } catch (e) { errore(`Firma di ${path.basename(file)} non riuscita: ${e.message}`); }
  const f = leggiFirma(file);
  if (!f.presente) errore(`Dopo la firma ${path.basename(file)} non risulta firmato.`);
  nota(`  firma presente${f.firmatario ? ` — ${f.firmatario}` : ''}${f.marcaTemporale ? ', con marca temporale' : ''}`);
  return true;
}

// ---------------------------------------------------------------- 6. installatore NSIS
function trovaMakensis() {
  const candidati = ['makensis'];
  if (WIN) for (const base of [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.ChocolateyInstall && path.join(process.env.ChocolateyInstall, 'bin')]) {
    if (base) candidati.push(path.join(base, 'NSIS', 'makensis.exe'), path.join(base, 'NSIS', 'Bin', 'makensis.exe'), path.join(base, 'makensis.exe'));
  }
  for (const c of candidati) {
    if (c !== 'makensis' && !fs.existsSync(c)) continue;
    const r = spawnSync(c, ['-VERSION'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return { comando: c, versione: r.stdout.trim() };
  }
  return null;
}

function creaInstallatore(licenzaNode) {
  passo('Installatore (NSIS)');
  if (opzioni.has('--senza-installer')) { nota('saltato (--senza-installer)'); return false; }
  const nsis = trovaMakensis();
  if (!nsis) {
    const come = WIN ? 'choco install nsis -y' : 'sudo apt-get install -y nsis   (macOS: brew install makensis)';
    if (WIN || opzioni.has('--installer-obbligatorio')) errore(`makensis non trovato. Installa NSIS: ${come}`);
    console.log(`  ATTENZIONE: makensis non è installato, quindi l’installatore NON è stato creato.\n  Clockwise.exe è pronto lo stesso. Per l’installatore: ${come}\n  oppure lascia fare alla CI su Windows (.github/workflows/windows.yml).`);
    return false;
  }
  fs.rmSync(fileSetup, { force: true });
  const definizioni = { VERSIONE: versione, VERSIONE_NUMERICA: versioneNumerica, ESEGUIBILE: fileExe, ICONA: fileIcona, USCITA: fileSetup };
  if (licenzaNode) definizioni.LICENZA_NODE = licenzaNode;
  // il manuale d'uso (docs/Manuale-Clockwise.pdf, generato da scripts/genera-manuale.mjs) va nell'installazione
  const manuale = path.join(radice, 'docs', 'Manuale-Clockwise.pdf');
  if (fs.existsSync(manuale)) definizioni.MANUALE = manuale;
  else nota('ATTENZIONE: docs/Manuale-Clockwise.pdf non trovato, l’installatore non conterrà il manuale');
  // il disinstallatore si firma mentre makensis lo crea (!uninstfinalize), con lo stesso script
  if (firmaAttiva()) { definizioni.FIRMA_NODE = process.execPath; definizioni.FIRMA_SCRIPT = path.join(radice, 'scripts', 'windows', 'firma.mjs'); }
  esegui(nsis.comando, ['-V2', '-INPUTCHARSET', 'UTF8', ...Object.entries(definizioni).map(([k, v]) => `-D${k}=${v}`), path.join(radice, 'installer', 'clockwise.nsi')]);
  if (!fs.existsSync(fileSetup)) errore('makensis non ha prodotto l’installatore.');
  nota(`${rel(fileSetup)} — ${mb(fileSetup)} (NSIS ${nsis.versione})`);
  firmaFile(fileSetup);
  return true;
}

// ---------------------------------------------------------------- prova su Linux
// Lo stesso blob dentro il node di questa macchina: dimostra senza Windows che il server
// impacchettato parte e che i file incorporati vengono serviti identici agli originali.
const portaLibera = () => new Promise((ok, ko) => { const s = net.createServer(); s.once('error', ko); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
function avviaProva(exe, env) {
  const figlio = spawn(exe, [], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let testo = '';
  figlio.stdout.on('data', (d) => { testo += d; });
  figlio.stderr.on('data', (d) => { testo += d; });
  const fine = new Promise((ok) => figlio.on('close', (codice) => ok(codice)));
  return { figlio, fine, testo: () => testo };
}
async function attendiStato(porta, secondi = 30) {
  for (let i = 0; i < secondi * 4; i++) {
    try { const r = await fetch(`http://127.0.0.1:${porta}/api/stato`); if (r.ok) return await r.json(); } catch { /* non ancora in ascolto */ }
    await pausa(250);
  }
  return null;
}

async function provaLinux(blob, interfaccia) {
  passo('Prova reale su questa macchina (--linux-smoke)');
  const exe = path.join(lavoro, 'clockwise-prova-linux');
  fs.copyFileSync(process.execPath, exe);
  fs.chmodSync(exe, 0o755);
  await inietta(exe, blob);
  nota(`${rel(exe)} — ${mb(exe)} (node ${process.version} locale + lo stesso blob di Clockwise.exe)`);
  const dati = fs.mkdtempSync(path.join(os.tmpdir(), 'clockwise-prova-'));
  // CLOCKWISE_CLAUDE_BIN inesistente: la prova non deve avviare Claude Code.
  const ambiente = { CLOCKWISE_NO_BROWSER: '1', CLOCKWISE_DATA: dati, CLOCKWISE_CLAUDE_BIN: path.join(dati, 'claude-inesistente') };
  const controlli = [];
  const verifica = (ok, testo) => { controlli.push(ok); console.log(`  ${ok ? 'ok ' : 'NO '} ${testo}`); };
  let primo = null, occupante = null;
  try {
    const porta = await portaLibera();
    primo = avviaProva(exe, { ...ambiente, PORT: String(porta) });
    const stato = await attendiStato(porta);
    verifica(!!stato, `avvio: /api/stato risponde su 127.0.0.1:${porta}`);
    if (!stato) { console.log(primo.testo()); errore('L’eseguibile di prova non è partito.'); }
    verifica(stato.eseguibile === true && stato.versione === versione, `/api/stato -> versione ${stato.versione}, eseguibile ${stato.eseguibile}`);
    verifica(/pulsante «Esci»/.test(primo.testo()) && primo.testo().includes(`http://localhost:${porta}`), 'messaggio di avvio con indirizzo e come chiudere');
    // senza finestra, lo stesso messaggio deve finire nel registro su file; e l'archivio su disco deve rispondere
    const registro = path.join(dati, 'clockwise.log');
    verifica(fs.existsSync(registro) && fs.readFileSync(registro, 'utf8').includes(`http://localhost:${porta}`), 'clockwise.log nella cartella dei dati, con l’avvio');
    const messo = await fetch(`http://127.0.0.1:${porta}/api/archivio/kv/prova`, { method: 'PUT', body: '{"a":1}' });
    verifica(messo.ok && fs.existsSync(path.join(dati, 'archivio', 'kv', 'prova.json')), 'archivio su disco: il valore scritto è nella cartella dei dati');
    const pagina = await fetch(`http://127.0.0.1:${porta}/`);
    verifica(pagina.status === 200 && (await pagina.text()).includes('Clockwise'), 'GET / -> 200, contiene "Clockwise"');
    let diversi = 0;
    for (const f of interfaccia.file) {
      const r = await fetch(`http://127.0.0.1:${porta}/${f}`);
      const corpo = Buffer.from(await r.arrayBuffer());
      if (r.status !== 200 || crypto.createHash('sha256').update(corpo).digest('hex') !== interfaccia.impronte[f]) { diversi++; console.log(`      diverso: ${f} (${r.status})`); }
    }
    verifica(diversi === 0, `${interfaccia.file.length} file incorporati serviti identici agli originali (css, js/**, vendor/**)`);
    const manca = await fetch(`http://127.0.0.1:${porta}/js/non-esiste.js`);
    verifica(manca.status === 404, 'file inesistente -> 404');
    const estraneo = await fetch(`http://127.0.0.1:${porta}/api/esci`, { method: 'POST', headers: { origin: 'http://esempio.invalid' } });
    verifica(estraneo.status === 403, 'POST /api/esci da un altro sito -> 403');

    // Seconda copia sulla stessa porta: deve accorgersi che Clockwise c'è già e uscire.
    const secondo = avviaProva(exe, { ...ambiente, PORT: String(porta) });
    const codiceSecondo = await Promise.race([secondo.fine, pausa(20000).then(() => { secondo.figlio.kill(); return 'tempo scaduto'; })]);
    verifica(codiceSecondo === 0 && /già in esecuzione/.test(secondo.testo()), `seconda copia sulla stessa porta: "già in esecuzione", esce con codice ${codiceSecondo}`);

    // Porta occupata da un altro programma: deve passare alla successiva.
    const portaOccupata = await portaLibera();
    occupante = require('node:http').createServer((_, res) => { res.writeHead(404); res.end('altro programma'); });
    await new Promise((ok) => occupante.listen(portaOccupata, '127.0.0.1', ok));
    const terzo = avviaProva(exe, { ...ambiente, PORT: String(portaOccupata) });
    const statoTerzo = await attendiStato(portaOccupata + 1, 15);
    verifica(!!statoTerzo && terzo.testo().includes(`uso la ${portaOccupata + 1}`), `porta ${portaOccupata} occupata da altro: parte sulla ${portaOccupata + 1}`);
    if (statoTerzo) await fetch(`http://127.0.0.1:${portaOccupata + 1}/api/esci`, { method: 'POST' }).catch(() => {});
    const codiceTerzo = await Promise.race([terzo.fine, pausa(8000).then(() => { terzo.figlio.kill(); return 'tempo scaduto'; })]);
    verifica(codiceTerzo === 0, `quella copia si chiude con /api/esci (codice ${codiceTerzo})`);

    const esci = await fetch(`http://127.0.0.1:${porta}/api/esci`, { method: 'POST' });
    const codice = await Promise.race([primo.fine, pausa(8000).then(() => 'tempo scaduto')]);
    verifica(esci.status === 200 && codice === 0, `POST /api/esci -> ${esci.status}, il processo termina con codice ${codice}`);
    primo = null;
  } finally {
    if (primo) primo.figlio.kill();
    if (occupante) occupante.close();
    fs.rmSync(dati, { recursive: true, force: true });
  }
  if (controlli.includes(false)) errore('La prova su Linux non è passata.');
  nota('prova superata');
}

// ---------------------------------------------------------------- tutto insieme
async function principale() {
  console.log(`Clockwise ${versione} — pacchetto per Windows (build su ${process.platform} ${process.arch}, node ${process.version})`);
  if (!fs.existsSync(fileIcona)) errore('Manca installer/clockwise.ico (si rigenera con: node scripts/windows/genera-icona.mjs).');
  if (opzioni.has('--linux-smoke') && process.platform !== 'linux') errore('--linux-smoke funziona solo su Linux.');
  if (opzioni.has('--richiedi-firma') && !firmaAttiva()) errore('--richiedi-firma: nessun certificato configurato (CLOCKWISE_FIRMA_PFX, CLOCKWISE_FIRMA_PFX_BASE64 o CLOCKWISE_FIRMA_COMANDO).');
  nota(firmaAttiva() ? `firma digitale: attiva (${configurazioneFirma().modo === 'comando' ? 'comando configurato' : 'certificato .pfx'})` : 'firma digitale: nessun certificato configurato, i file non saranno firmati');
  fs.rmSync(lavoro, { recursive: true, force: true });
  fs.mkdirSync(lavoro, { recursive: true });
  for (const f of fs.readdirSync(uscita)) if (/^Clockwise(-Setup-.*)?\.exe$/.test(f)) fs.rmSync(path.join(uscita, f));

  const principaleCjs = await impacchettaServer();
  const interfaccia = preparaInterfaccia();
  const blob = creaBlob(principaleCjs, interfaccia.asset);
  const node = nodePerWindows();
  await creaExe(node.file, blob);
  if (opzioni.has('--linux-smoke')) await provaLinux(blob, interfaccia);
  const conInstallatore = creaInstallatore(node.licenza);

  passo('Fatto');
  nota(`${rel(fileExe)}  ${mb(fileExe)}`);
  nota(conInstallatore ? `${rel(fileSetup)}  ${mb(fileSetup)}` : 'installatore: non creato (vedi sopra)');
}

principale().catch((e) => {
  console.error(e instanceof ErroreBuild ? `\nERRORE: ${e.message}` : e);
  process.exit(1);
});
