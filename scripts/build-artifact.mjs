// Genera dist/clockwise.html: la stessa interfaccia in un solo file, da pubblicare come artifact
// nell'app Claude (usa l'account di chi la apre, nessun server).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = await build({
  entryPoints: [path.join(radice, 'app/js/main.js')],
  bundle: true, format: 'iife', minify: true, target: 'es2022', write: false, legalComments: 'none',
});
const js = out.outputFiles[0].text;
// Fogli di stile: quello principale più i moduli (app/css/moduli/*.css), nello stesso ordine di index.html.
// I caratteri locali (blocco tra i marcatori @caratteri-locali) servono solo all'eseguibile: qui arrivano da Google Fonts.
const cartellaModuli = path.join(radice, 'app/css/moduli');
const moduliCss = fs.existsSync(cartellaModuli) ? fs.readdirSync(cartellaModuli).filter((f) => f.endsWith('.css')).sort() : [];
const css = [fs.readFileSync(path.join(radice, 'app/css/app.css'), 'utf8'), ...moduliCss.map((f) => fs.readFileSync(path.join(cartellaModuli, f), 'utf8'))]
  .join('\n')
  .replace(/\/\* @caratteri-locali:inizio \*\/[\s\S]*?\/\* @caratteri-locali:fine \*\//g, '');
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs';
const pagina = `<title>Clockwise Bandi Cinema</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
${css}
</style>
<div id="app"></div>
<script>
globalThis.CLOCKWISE_LIBS = {
  XLSX: ['${CDN}/xlsx/0.18.5/xlsx.full.min.js'],
  pdfjsLib: ['${CDN}/pdf.js/3.11.174/pdf.min.js', '${CDN}/pdf.js/3.11.174/pdf.worker.min.js'],
  mammoth: ['${CDN}/mammoth/1.6.0/mammoth.browser.min.js'],
  jspdf: ['${CDN}/jspdf/4.2.1/jspdf.umd.min.js'],
};
</script>
<script>
${js}
</script>
`;
fs.mkdirSync(path.join(radice, 'dist'), { recursive: true });
fs.writeFileSync(path.join(radice, 'dist/clockwise.html'), pagina);
console.log(`dist/clockwise.html — ${(pagina.length / 1024).toFixed(0)} KB`);
