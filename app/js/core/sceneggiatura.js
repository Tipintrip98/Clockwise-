// Pre-produzione: spoglio della sceneggiatura, piano di lavorazione, DOOD, rischi e VFX.
// La divisione in scene, le pagine, il piano di lavorazione e il DOOD sono calcoli;
// Claude legge le scene e ne ricava personaggi, elementi per reparto, sinossi e rischi.

const RE_INTESTAZIONE = /^\s*(?:(?:SCENA|SC\.?)\s*)?(\d+\s?[A-Za-z]?)?\s*[.):\-–]?\s*((?:INT|EST|EXT|INTERNO|ESTERNO)\.?(?:\s*[\/\-–]\s*(?:INT|EST|EXT|INTERNO|ESTERNO)\.?)?)\s*[.:\-–]?\s+(\S.*)$/i;
const LUCI = ['GIORNO', 'NOTTE', 'ALBA', 'TRAMONTO', 'SERA', 'MATTINA', 'MATTINO', 'POMERIGGIO', 'CREPUSCOLO', 'DAY', 'NIGHT', 'DAWN', 'DUSK', 'EVENING', 'MORNING'];
const NOTTURNE = ['NOTTE', 'SERA', 'NIGHT', 'EVENING'];

function leggiIntestazione(riga) {
  if (riga.length > 120) return null;
  const m = RE_INTESTAZIONE.exec(riga);
  if (!m) return null;
  const lettere = riga.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const maiuscole = lettere.replace(/[^A-ZÀ-Þ]/g, '').length;
  const conPunto = /^(INT|EST|EXT)\./i.test(m[2]);
  if (!conPunto && maiuscole / Math.max(lettere.length, 1) < 0.7) return null; // prosa, non intestazione
  const tipo = m[2].toUpperCase().replace(/INTERNO/g, 'INT').replace(/ESTERNO|EXT/g, 'EST').replace(/[.\s]/g, '').replace(/[\-–]/g, '/');
  let resto = m[3].trim(), luce = '';
  const parti = resto.split(/\s+[\-–—]\s+|\s*,\s*(?=[A-ZÀ-Þ]+\s*$)/);
  if (parti.length > 1) {
    const ultima = parti[parti.length - 1].toUpperCase().replace(/[^A-ZÀ-Þ\/ ]/g, '').trim();
    if (LUCI.some((l) => ultima.startsWith(l))) { luce = ultima.split(/[\s\/]/)[0]; resto = parti.slice(0, -1).join(' - '); }
  }
  if (!luce) { const fine = LUCI.find((l) => new RegExp(`\\b${l}\\b\\s*\\d*\\s*$`, 'i').test(resto)); if (fine) { luce = fine; resto = resto.replace(new RegExp(`[\\s\\-–.,]*\\b${fine}\\b\\s*\\d*\\s*$`, 'i'), ''); } }
  return { numero: (m[1] || '').replace(/\s/g, ''), intEst: tipo.includes('/') ? 'INT/EST' : tipo, ambiente: resto.replace(/\s+/g, ' ').replace(/[.\-–\s]+$/, '').toUpperCase(), luce: luce.toUpperCase() };
}

/** Divide il testo in scene riconoscendo le intestazioni (INT./EST., "SCENA 12", italiano o inglese). */
export function dividiScene(testo) {
  const righe = testo.split('\n');
  const scene = []; let corrente = null, pagina = 1;
  for (const riga of righe) {
    const p = /^\[pagina (\d+)\]$/.exec(riga.trim());
    if (p) { pagina = Number(p[1]); continue; }
    const h = leggiIntestazione(riga);
    if (h) { corrente = { ...h, intestazione: riga.trim(), pagina, righe: [] }; scene.push(corrente); } else if (corrente) corrente.righe.push(riga);
  }
  if (scene.length < 3) return { formattata: false, scene: [] };
  return {
    formattata: true,
    scene: scene.map((s, i) => ({ k: i + 1, numero: s.numero || String(i + 1), intestazione: s.intestazione, intEst: s.intEst, ambiente: s.ambiente, luce: s.luce, pagina: s.pagina, testo: s.righe.join('\n').trim() })),
  };
}

// Blocchi di testo consecutivi per una sceneggiatura senza intestazioni riconoscibili.
function blocchi(testo, max) {
  const out = [];
  for (let i = 0; i < testo.length;) {
    let fine = Math.min(testo.length, i + max);
    if (fine < testo.length) { const t = testo.lastIndexOf('\n\n', fine); if (t > i + max * 0.5) fine = t; }
    out.push(testo.slice(i, fine)); i = fine;
  }
  return out;
}

function lotti(scene, max) {
  const out = []; let lotto = [], n = 0;
  for (const s of scene) {
    const l = s.testo.length + s.intestazione.length + 40;
    if (lotto.length && n + l > max) { out.push(lotto); lotto = []; n = 0; }
    lotto.push(s); n += l;
  }
  if (lotto.length) out.push(lotto);
  return out;
}

const ELEMENTI = [
  ['scena', 'Oggetti di scena e arredamento'], ['costumi', 'Costumi'], ['trucco', 'Trucco e parrucco'], ['veicoli', 'Veicoli'],
  ['animali', 'Animali'], ['stunt', 'Stunt e azioni'], ['effetti', 'Effetti speciali di scena'], ['vfx', 'VFX'], ['suono', 'Suono e musica in scena'], ['attrezzature', 'Mezzi tecnici speciali'],
];
export const CATEGORIE_ELEMENTI = ELEMENTI;

const LISTA = { type: 'array', items: { type: 'string' } };
export const SCHEMA_SPOGLIO = {
  type: 'object', additionalProperties: false, required: ['scene'],
  properties: {
    scene: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['k', 'intestazione', 'int_est', 'luce', 'ambiente', 'luogo', 'sinossi', 'personaggi', 'comparse', 'elementi', 'rischi'],
        properties: {
          k: { type: 'integer' }, intestazione: { type: 'string' }, int_est: { type: 'string' }, luce: { type: 'string' }, ambiente: { type: 'string' },
          luogo: { type: 'string' }, sinossi: { type: 'string' }, personaggi: LISTA, comparse: { type: 'string' },
          elementi: { type: 'object', additionalProperties: false, required: ELEMENTI.map((e) => e[0]), properties: Object.fromEntries(ELEMENTI.map((e) => [e[0], LISTA])) },
          rischi: LISTA,
        },
      },
    },
  },
};

function promptSpoglio({ titolo, territorio, lotto, formattata, blocco, parte, parti }) {
  const corpo = formattata
    ? lotto.map((s) => `### SCENA k=${s.k} — ${s.intestazione}\n${s.testo}`).join('\n\n')
    : `### BLOCCO ${parte} di ${parti}\n${blocco}`;
  return {
    system: `Sei l'aiuto regista che prepara lo spoglio della sceneggiatura per la produzione del film${titolo ? ` «${titolo}»` : ''}. Lo spoglio serve a organizzatore, reparti e direttore di produzione per pianificare e preventivare: deve riportare ciò che è scritto in scena, senza aggiungere nulla che la pagina non richieda. Un elemento dimenticato costa sul set; un elemento inventato gonfia il preventivo.`,
    documenti: `SCENEGGIATURA — ${formattata ? `scene da ${lotto[0].k} a ${lotto[lotto.length - 1].k}` : `blocco ${parte} di ${parti}`}\n${corpo}`,
    compito: `${formattata ? 'Per ogni scena riportata sopra, nello stesso ordine e con lo stesso valore di k,' : 'Individua le scene di questo blocco (ogni cambio di luogo o di tempo è una scena), numerale k = 1, 2, 3… nell’ordine, e per ciascuna'} compila:
- intestazione, int_est (INT, EST o INT/EST), luce (GIORNO, NOTTE, ALBA, TRAMONTO, SERA) e ambiente (il set, in maiuscolo)${formattata ? ': ricopiali dall’intestazione' : ''};
- luogo: la località geografica reale in cui la scena è ambientata, se il testo la indica o la rende evidente (per esempio «Favignana», «Trapani», «Milano»); altrimenti stringa vuota. Serve a capire quali scene si girano in ${territorio};
- sinossi: una o due frasi su che cosa accade;
- personaggi: i personaggi con battute o azione nella scena, in maiuscolo, senza indicazioni tra parentesi;
- comparse: figurazioni e comparse richieste, con una stima del numero (stringa vuota se nessuna);
- elementi, ciascuno come elenco di voci brevi: scena (oggetti di scena e arredamento che la scena richiede espressamente), costumi (solo capi o stati particolari), trucco (ferite, invecchiamenti, sangue, parrucche), veicoli, animali, stunt (cadute, lotte, guida, immersioni), effetti (pioggia, fumo, fuoco, spari a salve), vfx (ciò che richiede effetti visivi digitali, con il tipo di intervento), suono (musica dal vivo, playback, canti), attrezzature (gru, drone, riprese subacquee, camera car);
- rischi: aspetti che richiedono preparazione, permessi o cautele: minori, animali, acqua e mare, altezze, armi, fuoco, veicoli in movimento, notturne in esterno, luoghi pubblici o protetti, marchi e persone reali riconoscibili, nudità.
Lascia vuoti gli elenchi che non servono.

Rispondi soltanto con un oggetto JSON in questa forma:
{"scene":[{"k":1,"intestazione":"","int_est":"INT","luce":"GIORNO","ambiente":"","luogo":"","sinossi":"","personaggi":[""],"comparse":"","elementi":{"scena":[],"costumi":[],"trucco":[],"veicoli":[],"animali":[],"stunt":[],"effetti":[],"vfx":[],"suono":[],"attrezzature":[]},"rischi":[]}]}`,
    schema: SCHEMA_SPOGLIO,
  };
}

const SICILIA = /sicili|palerm|catani|messin|siracus|ragus|trapan|agrigent|\benna\b|caltanisset|favignan|egadi|eolie|lipari|strombol|panteller|lampedus|\betna\b|taormin|cefal[uù]|\bnoto\b|modica|scicli|marsala|mazara|sciacca|ortigia|erice|bagheria|monreale|gela|vittoria|acireale|milazzo|ustica|salina|vulcano|linosa|madonie|nebrodi|vendicari|marzamemi/i;
const pulisciNome = (s) => String(s || '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const elenco = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : []);

/**
 * Spoglio completo. onEvento({ fatto, totale }) segnala l'avanzamento.
 * Restituisce { scene, personaggi, location, formattata, pagine, generato, modello }.
 */
export async function eseguiSpoglio({ documento, titolo, territorio = 'Sicilia', llm, opzioni, signal, onEvento = () => {} }) {
  const testo = documento.testo;
  const divisione = dividiScene(testo);
  const maxLotto = Math.min(45000, Math.floor((llm.limiteByte || 200000) * 0.35));
  const lavori = divisione.formattata
    ? lotti(divisione.scene, maxLotto).map((lotto) => ({ lotto }))
    : blocchi(testo.replace(/\[pagina \d+\]\n?/g, ''), Math.min(30000, maxLotto)).map((blocco, i, tutti) => ({ blocco, parte: i + 1, parti: tutti.length }));
  const caratteriPagina = documento.pagine ? Math.max(900, testo.length / documento.pagine) : 1700;
  const risultati = new Array(lavori.length);
  let fatti = 0, modello = null;
  onEvento({ fatto: 0, totale: lavori.length });
  const paralleli = Math.max(1, Math.min(llm.paralleli || 2, 3));
  let prossimo = 0;
  const lavora = async () => {
    for (;;) {
      const i = prossimo++;
      if (i >= lavori.length || signal?.aborted) return;
      const p = promptSpoglio({ titolo, territorio, formattata: divisione.formattata, ...lavori[i] });
      const r = await llm.chiama({ ...p, modello: opzioni.modello, impegno: opzioni.impegno || 'medium', signal });
      modello = r.modello || modello;
      risultati[i] = Array.isArray(r.json?.scene) ? r.json.scene : [];
      onEvento({ fatto: ++fatti, totale: lavori.length });
    }
  };
  await Promise.all(Array.from({ length: paralleli }, lavora));
  if (signal?.aborted) throw Object.assign(new Error('Spoglio interrotto.'), { codice: 'cancelled' });

  const scene = [];
  if (divisione.formattata) {
    const perK = new Map(risultati.flat().filter(Boolean).map((s) => [Number(s.k), s]));
    for (const s of divisione.scene) {
      const a = perK.get(s.k) || {};
      scene.push(componiScena({ numero: s.numero, intestazione: s.intestazione, intEst: s.intEst, luce: s.luce || String(a.luce || '').toUpperCase(), ambiente: s.ambiente, lunghezza: s.testo.length + s.intestazione.length, pagina: s.pagina }, a, caratteriPagina));
    }
  } else {
    const piatte = risultati.flat().filter(Boolean);
    const lunghezzaMedia = testo.length / Math.max(piatte.length, 1);
    piatte.forEach((a, i) => scene.push(componiScena({ numero: String(i + 1), intestazione: String(a.intestazione || ''), intEst: String(a.int_est || '').toUpperCase(), luce: String(a.luce || '').toUpperCase(), ambiente: pulisciNome(a.ambiente), lunghezza: lunghezzaMedia, pagina: null }, a, caratteriPagina)));
  }
  if (!scene.length) throw new Error('Nessuna scena riconosciuta nel testo.');
  return { ...riepilogoSpoglio(scene), formattata: divisione.formattata, pagine: documento.pagine || Math.round(testo.length / 1700), generato: new Date().toISOString(), modello, file: documento.nome };
}

function componiScena(base, a, caratteriPagina) {
  const el = a.elementi || {};
  return {
    numero: base.numero, intestazione: base.intestazione, intEst: base.intEst || 'INT', luce: base.luce || 'GIORNO', ambiente: base.ambiente || pulisciNome(a.ambiente) || 'SET NON INDICATO',
    luogo: String(a.luogo || '').trim(), pagina: base.pagina,
    ottavi: Math.max(1, Math.round((base.lunghezza / caratteriPagina) * 8)),
    sinossi: String(a.sinossi || '').trim(),
    personaggi: [...new Set(elenco(a.personaggi).map(pulisciNome).filter(Boolean))],
    comparse: String(a.comparse || '').trim(),
    elementi: Object.fromEntries(ELEMENTI.map(([k]) => [k, elenco(el[k])])),
    rischi: elenco(a.rischi),
  };
}

// Personaggi e location ricavati dalle scene. "sicilia" è un'ipotesi dal nome del luogo: l'utente la conferma.
export function riepilogoSpoglio(scene, precedente = null) {
  const pers = new Map(), loc = new Map();
  for (const s of scene) {
    for (const n of s.personaggi) { const p = pers.get(n) || { nome: n, scene: [], ottavi: 0 }; p.scene.push(s.numero); p.ottavi += s.ottavi; pers.set(n, p); }
    const l = loc.get(s.ambiente) || { nome: s.ambiente, scene: [], ottavi: 0, tipi: new Set(), luoghi: {} };
    l.scene.push(s.numero); l.ottavi += s.ottavi; l.tipi.add(s.intEst); if (s.luogo) l.luoghi[s.luogo] = (l.luoghi[s.luogo] || 0) + 1;
    loc.set(s.ambiente, l);
  }
  const vecchie = new Map((precedente?.location || []).map((l) => [l.nome, l.sicilia]));
  const location = [...loc.values()].map((l) => {
    const luogo = Object.entries(l.luoghi).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const ipotesi = SICILIA.test(`${l.nome} ${luogo}`) ? true : null;
    return { nome: l.nome, luogo, scene: l.scene, ottavi: l.ottavi, intEst: [...l.tipi].join(', '), sicilia: vecchie.has(l.nome) ? vecchie.get(l.nome) : ipotesi };
  });
  const personaggi = [...pers.values()].sort((a, b) => b.scene.length - a.scene.length || b.ottavi - a.ottavi);
  return { scene, personaggi, location };
}

export const pagine = (ottavi) => { const p = Math.floor(ottavi / 8), o = ottavi % 8; return `${p ? p : ''}${p && o ? ' ' : ''}${o ? `${o}/8` : ''}` || '0'; };
const notturna = (luce) => NOTTURNE.includes(luce);

/**
 * Piano di lavorazione: le scene si raggruppano per set e per giorno/notte e si distribuiscono
 * in giornate fino alla quantità di pagine girabili al giorno (in ottavi di pagina).
 */
export function pianoLavorazione(spoglio, { ottaviGiorno = 32 } = {}) {
  const sicilia = new Map(spoglio.location.map((l) => [l.nome, l.sicilia]));
  const ordineSet = spoglio.location.map((l) => l.nome);
  const gruppi = [];
  for (const set of ordineSet) {
    const sue = spoglio.scene.filter((s) => s.ambiente === set);
    const giorno = sue.filter((s) => !notturna(s.luce)), notte = sue.filter((s) => notturna(s.luce));
    if (giorno.length) gruppi.push({ set, turno: 'GIORNO', scene: giorno });
    if (notte.length) gruppi.push({ set, turno: 'NOTTE', scene: notte });
  }
  // prima tutti i diurni poi i notturni dello stesso set restano vicini: si ordina per set, poi per turno
  const giorni = []; let g = null;
  const chiudi = () => { if (g && g.scene.length) giorni.push(g); g = null; };
  const apri = (turno) => { g = { scene: [], ottavi: 0, set: [], turno }; };
  for (const gr of gruppi) {
    if (g && (g.turno !== gr.turno || g.ottavi >= ottaviGiorno * 0.6)) chiudi();
    for (const s of gr.scene) {
      if (!g) apri(gr.turno);
      if (g.scene.length && g.ottavi + s.ottavi > ottaviGiorno) { chiudi(); apri(gr.turno); }
      g.scene.push(s.numero); g.ottavi += s.ottavi; if (!g.set.includes(gr.set)) g.set.push(gr.set);
    }
  }
  chiudi();
  const out = giorni.map((d, i) => {
    const stati = d.set.map((n) => sicilia.get(n));
    return { n: i + 1, scene: d.scene, ottavi: d.ottavi, set: d.set, turno: d.turno, sicilia: stati.every((x) => x === true) ? true : stati.every((x) => x === false) ? false : stati.some((x) => x === true) && !stati.some((x) => x == null) ? 'misto' : null };
  });
  return {
    giorni: out, totale: out.length,
    inSicilia: out.filter((d) => d.sicilia === true || d.sicilia === 'misto').length,
    daDefinire: out.filter((d) => d.sicilia == null).length,
    ottaviGiorno,
  };
}

/** Day Out of Days: per ogni personaggio, giornate di lavoro, primo e ultimo giorno, giorni di attesa. */
export function dood(spoglio, piano) {
  const giornoDi = new Map();
  for (const d of piano.giorni) for (const n of d.scene) giornoDi.set(n, d.n);
  return spoglio.personaggi.map((p) => {
    const giorni = [...new Set(p.scene.map((n) => giornoDi.get(n)).filter(Boolean))].sort((a, b) => a - b);
    const primo = giorni[0] ?? null, ultimo = giorni[giorni.length - 1] ?? null;
    return { nome: p.nome, scene: p.scene.length, giorni, lavoro: giorni.length, primo, ultimo, attesa: primo == null ? 0 : ultimo - primo + 1 - giorni.length };
  });
}

/** Elementi per reparto, rischi e VFX riuniti da tutte le scene. */
export function elementiPerReparto(spoglio) {
  const out = Object.fromEntries(ELEMENTI.map(([k]) => [k, new Map()]));
  for (const s of spoglio.scene) for (const [k] of ELEMENTI) for (const voce of s.elementi[k] || []) {
    const chiave = voce.toLowerCase();
    const e = out[k].get(chiave) || { voce, scene: [] };
    e.scene.push(s.numero); out[k].set(chiave, e);
  }
  return Object.fromEntries(ELEMENTI.map(([k]) => [k, [...out[k].values()].sort((a, b) => b.scene.length - a.scene.length)]));
}
export const rischiPerScena = (spoglio) => spoglio.scene.filter((s) => s.rischi.length).map((s) => ({ numero: s.numero, ambiente: s.ambiente, rischi: s.rischi }));
export const vfxPerScena = (spoglio) => spoglio.scene.filter((s) => s.elementi.vfx?.length).map((s) => ({ numero: s.numero, ambiente: s.ambiente, ottavi: s.ottavi, vfx: s.elementi.vfx }));

export const SCHEMA_SINOSSI = {
  type: 'object', additionalProperties: false, required: ['logline', 'soggetto', 'sinossi'],
  properties: { logline: { type: 'string' }, soggetto: { type: 'string' }, sinossi: { type: 'string' } },
};

/** Logline, soggetto per il Modulo II (massimo 900 battute) e sinossi estesa, a partire dallo spoglio. */
export async function generaSinossi({ spoglio, titolo, llm, opzioni, signal }) {
  const r = await llm.chiama({
    system: 'Scrivi materiali di presentazione per dossier di candidatura a fondi pubblici per il cinema. Stile asciutto e concreto: racconti la storia per ciò che accade, con i nomi dei personaggi e il finale, senza aggettivi promozionali.',
    documenti: `SCENE DEL FILM${titolo ? ` «${titolo}»` : ''} (numero — set — che cosa accade)\n${spoglio.scene.map((s) => `${s.numero} — ${s.intEst} ${s.ambiente} ${s.luce} — ${s.sinossi}`).join('\n')}`,
    compito: `Scrivi tre testi:
- logline: una frase, massimo 220 battute;
- soggetto: il «Soggetto dell'opera» per il Modulo II del dossier. Il modulo ammette al massimo 900 battute spazi inclusi: resta tra 780 e 880;
- sinossi: sinossi estesa di 1.800-2.500 battute, dall'inizio alla fine della storia.

Rispondi soltanto con un oggetto JSON: {"logline":"","soggetto":"","sinossi":""}`,
    schema: SCHEMA_SINOSSI, modello: opzioni.modello, impegno: 'medium', signal,
  });
  const j = r.json || {};
  return { logline: String(j.logline || '').trim(), soggetto: String(j.soggetto || '').trim(), sinossi: String(j.sinossi || '').trim() };
}

const csv = (righe) => righe.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
export function csvSpoglio(spoglio) {
  return `﻿${csv([
    ['Scena', 'Int/Est', 'Set', 'Luce', 'Luogo', 'Pagine', 'Personaggi', 'Comparse', ...ELEMENTI.map((e) => e[1]), 'Rischi', 'Sinossi'],
    ...spoglio.scene.map((s) => [s.numero, s.intEst, s.ambiente, s.luce, s.luogo, pagine(s.ottavi), s.personaggi.join(', '), s.comparse, ...ELEMENTI.map(([k]) => s.elementi[k].join(', ')), s.rischi.join(', '), s.sinossi]),
  ])}`;
}
export function csvPiano(spoglio, piano, territorio = 'Sicilia') {
  const perNumero = new Map(spoglio.scene.map((s) => [s.numero, s]));
  return `﻿${csv([
    ['Giorno', 'Turno', `In ${territorio}`, 'Set', 'Scene', 'Pagine', 'Personaggi'],
    ...piano.giorni.map((d) => [d.n, d.turno, d.sicilia === true ? 'sì' : d.sicilia === false ? 'no' : d.sicilia === 'misto' ? 'in parte' : 'da definire', d.set.join(' / '), d.scene.join(', '), pagine(d.ottavi), [...new Set(d.scene.flatMap((n) => perNumero.get(n)?.personaggi || []))].join(', ')]),
  ])}`;
}
