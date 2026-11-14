// Storyboard dalla sceneggiatura: per ogni scena la sequenza delle inquadrature, con un bozzetto
// disegnato da Claude e un prompt pronto per i generatori di immagini.
// Fedeltà alla pagina: ogni inquadratura riporta le parole della sceneggiatura a cui corrisponde, e il
// programma controlla che quelle parole esistano davvero nel testo della scena.
import { dividiScene } from './sceneggiatura.js';

export const CAMPI = [
  ['CLL', 'Campo lunghissimo'], ['CL', 'Campo lungo'], ['CM', 'Campo medio'], ['TOT', 'Totale'], ['FI', 'Figura intera'],
  ['PA', 'Piano americano'], ['MF', 'Mezza figura'], ['MPP', 'Mezzo primo piano'], ['PP', 'Primo piano'], ['PPP', 'Primissimo piano'], ['DETT', 'Dettaglio'],
];
const NOME_CAMPO = Object.fromEntries(CAMPI);
export const nomeCampo = (c) => NOME_CAMPO[c] || c || '';

export const STILI = [
  { id: 'matita', nome: 'Schizzo a matita', svg: 'tratto nero sottile e irregolare, come matita su carta; ombre a tratteggio', prompt: 'rough pencil storyboard sketch, monochrome graphite on white paper, loose expressive lines' },
  { id: 'inchiostro', nome: 'Inchiostro bianco e nero', svg: 'linee nere decise e campiture nere piene per le ombre, come pennarello', prompt: 'black ink storyboard frame, bold brush lines, high-contrast black and white' },
  { id: 'acquerello', nome: 'Mezzatinta grigia', svg: 'linee nere e campiture in tre grigi (#333, #888, #ccc) per profondità e luce', prompt: 'grayscale marker storyboard frame, three-tone gray wash, cinematic lighting study' },
  { id: 'cinema', nome: 'Fotogramma realistico (solo prompt)', svg: 'linee nere e campiture in grigi per indicare luce e profondità', prompt: 'cinematic film still, photorealistic, anamorphic lens, natural film grain, shot on 35mm' },
];
const stileDi = (id) => STILI.find((s) => s.id === id) || STILI[0];

const STR = { type: 'string' };
export const SCHEMA_STORYBOARD = {
  type: 'object', additionalProperties: false, required: ['inquadrature'],
  properties: {
    inquadrature: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['campo', 'angolazione', 'movimento', 'ottica', 'descrizione', 'riferimento', 'battuta', 'durata_sec', 'prompt', 'svg'],
        properties: { campo: { type: 'string', enum: CAMPI.map((c) => c[0]) }, angolazione: STR, movimento: STR, ottica: STR, descrizione: STR, riferimento: STR, battuta: STR, durata_sec: { type: 'number' }, prompt: STR, svg: STR },
      },
    },
  },
};

/** Testo della scena così com'è nella sceneggiatura caricata (null se il copione non ha intestazioni riconoscibili). */
export function testoScena(documento, spoglio, indice) {
  if (!documento?.testo || !spoglio?.formattata) return null;
  const scene = dividiScene(documento.testo).scene;
  const s = scene[indice];
  const attesa = spoglio.scene[indice];
  if (!s || !attesa) return null;
  // lo spoglio e la divisione devono parlare della stessa scena
  if (scene.length !== spoglio.scene.length && s.ambiente !== attesa.ambiente) return null;
  return `${s.intestazione}\n${s.testo}`;
}

const TAG_AMMESSI = new Set(['svg', 'g', 'path', 'line', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'pattern']);

/** Tiene del disegno solo forme vettoriali semplici; restituisce null se non è un SVG utilizzabile. */
export function pulisciSvg(sorgente) {
  let s = String(sorgente || '').trim();
  const inizio = s.search(/<svg[\s>]/i), fine = s.toLowerCase().lastIndexOf('</svg>');
  if (inizio < 0 || fine < inizio) return null;
  s = s.slice(inizio, fine + 6);
  if (s.length > 16000) return null;
  s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  s = s.replace(/<(script|style|foreignObject|text|title|desc|metadata)\b[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/<\/?([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g, (tutto, tag, attributi) => {
    if (!TAG_AMMESSI.has(tag.toLowerCase())) return '';
    if (tutto.startsWith('</')) return `</${tag}>`;
    const puliti = attributi.replace(/\s(?:on[a-z]+|href|xlink:href|style|src)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    return `<${tag}${puliti}>`;
  });
  if (/url\(\s*['"]?\s*(?:https?:|data:|javascript:|\/\/)/i.test(s) || /javascript:/i.test(s)) return null;
  if (!/<(path|line|rect|circle|ellipse|polygon|polyline)\b/i.test(s)) return null;
  if (!/\sxmlns\s*=/.test(s.slice(0, s.indexOf('>') + 1))) s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  if (!/\sviewBox\s*=/i.test(s.slice(0, s.indexOf('>') + 1))) s = s.replace(/<svg/i, '<svg viewBox="0 0 320 180"');
  return s;
}

export const immagineSvg = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// Quanto è grande la figura rispetto al quadro (altezza in unità di un quadro alto 180) e dove comincia.
const SCALA = { CLL: [22, 100], CL: [46, 80], CM: [88, 52], TOT: [128, 30], FI: [150, 16], PA: [215, 20], MF: [310, 22], MPP: [430, 24], PP: [620, 26], PPP: [1050, -6] };

/**
 * Schema dell'inquadratura disegnato dal programma: una figura alla scala del campo indicato.
 * Serve quando il bozzetto di Claude manca o non è utilizzabile, e come riferimento di composizione.
 */
export function schemaInquadratura(campo = 'CM') {
  const apri = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#fff"/>';
  const tratto = 'fill="none" stroke="#222" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
  if (campo === 'DETT') {
    return `${apri}<circle cx="160" cy="90" r="58" ${tratto}/><circle cx="160" cy="90" r="20" ${tratto}/><path d="M34 90h40M246 90h40M160 14v22M160 144v22" ${tratto} stroke-dasharray="4 5"/></svg>`;
  }
  const [H, top] = SCALA[campo] || SCALA.CM;
  const x = 160, u = (f) => Math.round(f * H * 10) / 10, y = (f) => Math.round((top + f * H) * 10) / 10;
  const orizzonte = H < 200 ? `<path d="M0 ${y(H < 100 ? 0.92 : 0.6)}H320" ${tratto} stroke="#999" stroke-width="1.4"/>` : '';
  const figura = [
    `<ellipse cx="${x}" cy="${y(0.065)}" rx="${u(0.045)}" ry="${u(0.062)}" ${tratto}/>`,
    `<path d="M${x - u(0.02)} ${y(0.127)}V${y(0.155)}M${x + u(0.02)} ${y(0.127)}V${y(0.155)}" ${tratto}/>`,
    `<path d="M${x - u(0.125)} ${y(0.2)}Q${x - u(0.12)} ${y(0.16)} ${x - u(0.04)} ${y(0.155)}H${x + u(0.04)}Q${x + u(0.12)} ${y(0.16)} ${x + u(0.125)} ${y(0.2)}L${x + u(0.09)} ${y(0.5)}H${x - u(0.09)}Z" ${tratto}/>`,
    `<path d="M${x - u(0.125)} ${y(0.2)}L${x - u(0.15)} ${y(0.46)}M${x + u(0.125)} ${y(0.2)}L${x + u(0.15)} ${y(0.46)}" ${tratto}/>`,
    `<path d="M${x - u(0.085)} ${y(0.5)}L${x - u(0.07)} ${y(0.98)}M${x + u(0.085)} ${y(0.5)}L${x + u(0.07)} ${y(0.98)}M${x} ${y(0.52)}V${y(0.6)}" ${tratto}/>`,
  ].join('');
  return `${apri}${orizzonte}${figura}</svg>`;
}

const semplice = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Controllo di fedeltà: il riferimento di ogni inquadratura deve trovarsi nel testo della scena.
 * Aggiunge a ciascuna `ancorata` (true, false, oppure null se non c'è testo con cui confrontare).
 */
export function verificaRiferimenti(inquadrature, testo) {
  const pagina = testo ? ` ${semplice(testo)} ` : null;
  return inquadrature.map((q) => {
    if (!pagina) return { ...q, ancorata: null };
    const parole = semplice(q.riferimento).split(' ').filter(Boolean);
    if (parole.length < 2) return { ...q, ancorata: false };
    if (pagina.includes(` ${parole.join(' ')} `)) return { ...q, ancorata: true };
    // tolleranza per tagli e puntini: basta una sequenza di quattro parole consecutive
    for (let i = 0; i + 4 <= parole.length; i++) if (pagina.includes(` ${parole.slice(i, i + 4).join(' ')} `)) return { ...q, ancorata: true };
    return { ...q, ancorata: false };
  });
}

function promptStoryboard({ scena, testo, titolo, stile, massimo, noteRegia }) {
  const st = stileDi(stile);
  const contesto = [
    `Scena ${scena.numero} — ${scena.intEst}. ${scena.ambiente} — ${scena.luce}${scena.luogo ? ` (${scena.luogo})` : ''}`,
    scena.personaggi?.length ? `Personaggi in scena: ${scena.personaggi.join(', ')}` : '',
    scena.comparse ? `Comparse: ${scena.comparse}` : '',
  ].filter(Boolean).join('\n');
  return {
    system: `Sei lo storyboard artist che lavora con il regista del film${titolo ? ` «${titolo}»` : ''}. Traduci una scena della sceneggiatura in inquadrature. Lo storyboard serve a regia, fotografia e produzione per preparare il set: deve mostrare ciò che la pagina racconta, nell'ordine in cui lo racconta.

Regole di fedeltà
- Lavora solo su ciò che è scritto nella scena: azioni, battute, personaggi, oggetti e luoghi. Non aggiungere eventi, personaggi o oggetti che la pagina non contiene e non cambiare l'ordine dei fatti.
- Ogni azione rilevante e ogni scambio di battute importante è coperto da almeno un'inquadratura; i momenti secondari si possono riunire in una sola.
- Le scelte di regia (campo, angolazione, movimento, ottica) sono tue: servono il senso della scena e rispettano la continuità (regola dei 180 gradi, raccordi di sguardo e di movimento).
- In «riferimento» ricopia alla lettera, tra 4 e 14 parole consecutive, il punto della sceneggiatura a cui l'inquadratura corrisponde: il programma verifica che quelle parole esistano nel testo.`,
    documenti: `${contesto}\n\n${testo ? `TESTO DELLA SCENA\n${testo}` : `La sceneggiatura non ha un'impaginazione riconoscibile: lavora sulla sintesi della scena.\nSINTESI\n${scena.sinossi || '(non disponibile)'}`}`,
    compito: `Prepara lo storyboard di questa scena con ${massimo <= 4 ? `al massimo ${massimo}` : `da 3 a ${massimo}`} inquadrature, in ordine.${noteRegia ? `\nIndicazioni del regista: ${noteRegia}` : ''}

Per ogni inquadratura:
- campo: ${CAMPI.map(([k, n]) => `${k} (${n.toLowerCase()})`).join(', ')};
- angolazione: altezza occhi, dall'alto, dal basso, a piombo, soggettiva, di quinta…;
- movimento: fissa, panoramica, carrello avanti/indietro/laterale, a mano, steadicam, drone, zoom…;
- ottica: grandangolo, normale o teleobiettivo, con la focale indicativa (per esempio «tele 85 mm»);
- descrizione: che cosa si vede e che cosa accade nel quadro, in una o due frasi, al presente;
- riferimento: le parole della sceneggiatura ricopiate alla lettera${testo ? '' : ' (dalla sintesi, se non hai il testo)'};
- battuta: la battuta pronunciata durante l'inquadratura, con il nome del personaggio, oppure stringa vuota;
- durata_sec: durata stimata in secondi;
- prompt: un prompt in inglese per un generatore di immagini, in una frase densa: soggetto e azione, ambiente, luce e ora del giorno, campo e angolazione. Descrivi i personaggi solo con i tratti che la sceneggiatura fornisce, senza nomi propri;
- svg: il bozzetto dell'inquadratura come SVG autonomo, con <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">. Solo forme semplici (path, line, rect, circle, ellipse, polygon, polyline): ${st.svg}. Sfondo bianco, niente testo, niente immagini incorporate. Il disegno rispetta campo e angolazione: figure stilizzate con testa, spalle e busto alla scala giusta, linea d'orizzonte, gli elementi essenziali del set e la direzione degli sguardi. Al massimo 1.500 caratteri.

Rispondi soltanto con un oggetto JSON in questa forma:
{"inquadrature":[{"campo":"PP","angolazione":"","movimento":"","ottica":"","descrizione":"","riferimento":"","battuta":"","durata_sec":4,"prompt":"","svg":"<svg …></svg>"}]}`,
    schema: SCHEMA_STORYBOARD,
  };
}

/**
 * Storyboard di una scena. `scena` è la voce dello spoglio; `testo` il testo della scena (può mancare).
 * Restituisce { inquadrature, generato, modello, stile, conTesto }.
 */
export async function generaStoryboard({ scena, testo, titolo, stile = 'matita', massimo = 6, noteRegia = '', llm, opzioni, signal, onTesto }) {
  const st = stileDi(stile);
  const p = promptStoryboard({ scena, testo: testo ? testo.slice(0, 24000) : null, titolo, stile, massimo: Math.max(2, Math.min(12, massimo)), noteRegia });
  const r = await llm.chiama({ ...p, modello: opzioni.modello, impegno: opzioni.impegno || 'medium', signal, onTesto });
  const grezze = Array.isArray(r.json?.inquadrature) ? r.json.inquadrature : [];
  const codici = new Set(CAMPI.map((c) => c[0]));
  const lista = grezze.filter((q) => q && (q.descrizione || q.svg)).slice(0, 12).map((q, i) => {
    const campo = codici.has(String(q.campo || '').toUpperCase()) ? String(q.campo).toUpperCase() : 'CM';
    return {
      n: i + 1, campo, angolazione: String(q.angolazione || '').trim(), movimento: String(q.movimento || '').trim(), ottica: String(q.ottica || '').trim(),
      descrizione: String(q.descrizione || '').trim(), riferimento: String(q.riferimento || '').replace(/^["«“]+|["»”]+$/g, '').trim(), battuta: String(q.battuta || '').trim(),
      durata: Math.max(1, Math.min(120, Math.round(Number(q.durata_sec) || 4))),
      prompt: [String(q.prompt || '').trim().replace(/[.\s]+$/, ''), st.prompt, '16:9'].filter(Boolean).join(', '),
      svg: pulisciSvg(q.svg), immagine: null,
    };
  });
  if (!lista.length) throw new Error('Lo storyboard non ha prodotto inquadrature leggibili. Riprova.');
  return { inquadrature: verificaRiferimenti(lista, testo), generato: new Date().toISOString(), modello: r.modello || null, stile: st.id, conTesto: !!testo };
}

export const durataStoryboard = (inquadrature) => inquadrature.reduce((a, q) => a + (q.durata || 0), 0);
export const sigla = (numeroScena, n) => `${numeroScena}${String.fromCharCode(64 + Math.min(n, 26))}`;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const figura = (q) => (q.immagine && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(q.immagine) ? q.immagine : immagineSvg(q.svg || schemaInquadratura(q.campo)));

/** Pagina stampabile con tutte le scene disegnate: tre quadri per riga, legenda sotto ogni quadro. */
export function htmlStoryboard({ titolo, tavole }) {
  const corpo = tavole.map(({ scena, storyboard }) => `<section><h2>Scena ${esc(scena.numero)} — ${esc(scena.intEst)}. ${esc(scena.ambiente)} — ${esc(scena.luce)}</h2><div class="g">${storyboard.inquadrature.map((q) => `<figure><img src="${figura(q)}" alt=""><figcaption><b>${esc(sigla(scena.numero, q.n))} · ${esc(q.campo)}</b> ${esc([q.angolazione, q.movimento, q.ottica].filter(Boolean).join(' · '))} · ${q.durata}″<p>${esc(q.descrizione)}</p>${q.battuta ? `<p class="b">${esc(q.battuta)}</p>` : ''}</figcaption></figure>`).join('')}</div></section>`).join('');
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Storyboard — ${esc(titolo)}</title><style>
body{font:13px/1.4 system-ui,sans-serif;color:#111;margin:24px;background:#fff}h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 8px;border-bottom:1px solid #999;padding-bottom:4px}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0;break-inside:avoid}img{width:100%;aspect-ratio:16/9;object-fit:cover;border:1.5px solid #111;background:#fff;display:block}
figcaption{font-size:11.5px;margin-top:4px}p{margin:2px 0 0}.b{font-style:italic}.m{color:#555;font-size:12px}@media(max-width:700px){.g{grid-template-columns:1fr}}@media print{body{margin:10mm}}
</style></head><body><h1>${esc(titolo)}</h1><div class="m">Storyboard · ${tavole.length} ${tavole.length === 1 ? 'scena' : 'scene'} · ${tavole.reduce((a, t) => a + t.storyboard.inquadrature.length, 0)} inquadrature · generato con Clockwise</div>${corpo}</body></html>`;
}

const csv = (righe) => righe.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
/** Elenco delle inquadrature (shot list) di tutte le scene disegnate. */
export function csvInquadrature(tavole) {
  return `﻿${csv([
    ['Scena', 'Inquadratura', 'Campo', 'Angolazione', 'Movimento', 'Ottica', 'Durata (s)', 'Descrizione', 'Battuta', 'Riferimento in sceneggiatura', 'Prompt immagine'],
    ...tavole.flatMap(({ scena, storyboard }) => storyboard.inquadrature.map((q) => [scena.numero, sigla(scena.numero, q.n), nomeCampo(q.campo), q.angolazione, q.movimento, q.ottica, q.durata, q.descrizione, q.battuta, q.riferimento, q.prompt])),
  ])}`;
}
