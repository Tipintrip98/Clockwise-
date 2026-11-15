// Genera docs/Manuale-Clockwise.pdf da docs/manuale/manuale.html.
// Inserisce versione, data ed elenco dei bandi presi dal programma, poi stampa la pagina in PDF con Chromium.
// Serve Playwright (non è una dipendenza del progetto): npx playwright install chromium, se manca.
// Uso: node scripts/genera-manuale.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { APP } from '../app/js/core/versione.js';
import { BANDI_PREDEFINITI, SCHEDE_BANDI, catalogo } from '../app/js/core/bandi/indice.js';
import { STATI, TIPI_VALUTAZIONE } from '../app/js/core/bandi/schema.js';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { console.error('Serve Playwright: npm i -g playwright && npx playwright install chromium'); process.exit(1); }

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const data = new Date(`${APP.rilascio}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const tutti = catalogo(BANDI_PREDEFINITI, SCHEDE_BANDI);
const righe = tutti.map((b) => `<tr><td>${esc(b.regione)}</td><td><strong>${esc(b.nomeBreve || b.nome)}</strong><div class="piccolo">${esc(b.ente)}</div></td><td>${esc(STATI[b.stato] || b.stato)}</td><td>${esc(TIPI_VALUTAZIONE[b.tipoValutazione] || '')}</td><td>${b.simulabile ? 'Sì' : 'No'}</td></tr>`).join('\n');
const tabella = `<table><thead><tr><th style="width:18%">Area</th><th>Bando</th><th style="width:11%">Stato</th><th style="width:20%">Valutazione</th><th style="width:10%">Simulabile</th></tr></thead><tbody>${righe}</tbody></table>`;

const sorgente = path.join(radice, 'docs', 'manuale', 'manuale.html');
const html = fs.readFileSync(sorgente, 'utf8')
  .replaceAll('{{VERSIONE}}', esc(APP.versione)).replaceAll('{{DATA}}', esc(data))
  .replaceAll('{{N_BANDI}}', String(tutti.length)).replaceAll('{{N_SIMULABILI}}', String(tutti.filter((b) => b.simulabile).length))
  .replace('{{TABELLA_BANDI}}', tabella);
const temporaneo = path.join(radice, 'docs', 'manuale', '.manuale-pronto.html');
fs.writeFileSync(temporaneo, html);

const uscita = path.join(radice, 'docs', 'Manuale-Clockwise.pdf');
const browser = await playwright.chromium.launch();
try {
  const pagina = await browser.newPage();
  await pagina.goto(pathToFileURL(temporaneo).href, { waitUntil: 'networkidle' });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.pdf({
    path: uscita, format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:7.5pt;color:#7a8794;padding:0 17mm;display:flex;justify-content:space-between"><span>Clockwise ${esc(APP.versione)} · Manuale d’uso</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
} finally {
  await browser.close();
  fs.rmSync(temporaneo, { force: true });
}
console.log(`${path.relative(radice, uscita)} — ${(fs.statSync(uscita).size / 1024 / 1024).toFixed(1)} MB`);
