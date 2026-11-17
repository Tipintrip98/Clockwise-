// Green Film: il disciplinare per una produzione audiovisiva ecosostenibile (Edizione 03 – 2024), trascritto dal testo
// ufficiale di Trentino Film Commission – Trentino Sviluppo S.p.A., titolare del marchio:
//   https://www.green.film/download/  →  «Disciplinare per una produzione cinematografica ecosostenibile», 3ª edizione.
// Serve a tre cose: scegliere i criteri e vedere se si arriva al minimo, sapere quali documenti e quali prove sul set
// servono per ogni criterio scelto, riconoscere una richiesta compilata sull'edizione precedente.
// Solo logica e dati: nessun accesso al DOM.

const r1 = (v) => Math.round(v * 10) / 10;

export const FONTE_GREEN = {
  titolo: 'Green Film – Disciplinare per una produzione audiovisiva ecosostenibile, Edizione 03 – 2024',
  ente: 'Trentino Film Commission – Trentino Sviluppo S.p.A. (soggetto certificatore, titolare del marchio)',
  url: 'https://www.green.film/download/',
  procedura: 'https://www.green.film/certification/',
  consultato: '2026-11-17',
};

/** Punteggio minimo e riduzione per le società registrate EMAS (testo del disciplinare, «La sostenibilità nella pratica»). */
export const MINIMO_GREEN = 25;
export const RIDUZIONE_EMAS = 5;
export const TOTALE_GREEN = 65;

/**
 * Il prerequisito è obbligatorio e non dà punti: senza, nessun punteggio vale.
 * Ogni voce va completata prima dell'inizio delle riprese, tranne il report finale.
 */
export const PREREQUISITO = {
  id: 'PR1', nome: 'Piano di Sostenibilità',
  requisito: 'Prima dell’inizio delle riprese: nominare un/una Sustainability Manager con esperienza almeno biennale nella gestione ambientale; redigere il Piano di Sostenibilità con i criteri scelti, un capitolo sull’ottimizzazione dei trasporti e uno sulla gestione dei rifiuti (principio delle 4R, regole di raccolta di ogni set, bidoni segnalati su set e campo base); trasmetterlo via email al soggetto certificatore, all’organismo di verifica e a ogni membro della produzione; tenere un kick-off meeting formativo con produttore o delegato, regista e capireparto, con verbale scritto. A fine riprese: report del/della Sustainability Manager sulle azioni svolte per ogni criterio.',
  voci: [
    { id: 'manager', testo: 'Nomina e curriculum del/della Sustainability Manager (almeno due anni di esperienza in gestione ambientale)', quando: 'prima' },
    { id: 'piano', testo: 'Piano di Sostenibilità con i criteri scelti e le azioni previste su ogni set', quando: 'prima' },
    { id: 'trasporti', testo: 'Capitolo «ottimizzazione dei trasporti» (tragitti alloggio-set, casa-set, set-set)', quando: 'prima' },
    { id: 'rifiuti', testo: 'Capitolo «ottimizzazione della gestione dei rifiuti» (4R, regole locali, zone con bidoni segnalati)', quando: 'prima' },
    { id: 'invio', testo: 'Email di trasmissione del Piano a certificatore, organismo di verifica, troupe e staff', quando: 'prima' },
    { id: 'kickoff', testo: 'Kick-off meeting formativo con verbale scritto', quando: 'prima' },
    { id: 'report', testo: 'Report finale del/della Sustainability Manager, criterio per criterio', quando: 'dopo' },
  ],
  set: 'Sul set l’organismo di verifica controlla che troupe e staff conoscano davvero il Piano, che i trasporti siano ottimizzati e che i contenitori per la raccolta differenziata ci siano e siano usati bene.',
};

// tipo dei criteri:
//  'soglie'  una sola scelta tra livelli (es. 100% → 4, 75% → 3)
//  'opzioni' una sola scelta tra opzioni alternative
//  'somma'   più voci che si sommano fino al massimo
//  'fisso'   sì/no
//  'giudizio' punti assegnati dall'organismo di verifica, da 0 al massimo: qui si indica la previsione
const soglie = (...l) => l.map(([id, etichetta, punti]) => ({ id, etichetta, punti }));

export const SEZIONI_GREEN = [
  { id: 'A', nome: 'Risparmio energetico', criteri: [
    { id: 'A1', nome: 'Energia elettrica dalla rete di distribuzione', max: 4, tipo: 'soglie',
      requisito: 'Allacci temporanei alla rete invece dei gruppi elettrogeni a fonti non rinnovabili.',
      livelli: soglie(['100', '100% delle giornate di ripresa con energia da rete', 4], ['75', 'almeno il 75% delle giornate', 3]),
      documenti: ['Contratti con i fornitori di energia elettrica', 'Fatture', 'Tabella di tutti i set con allaccio usato o no e riferimenti di fornitura, da cui risulti la percentuale'],
      set: 'Rilievo della fonte di energia effettivamente usata.' },
    { id: 'A2', nome: 'Elettricità verde', max: 3, tipo: 'soglie',
      requisito: 'Energia da fonti rinnovabili: fornitura di rete solo rinnovabile oppure generatori a fonti rinnovabili.',
      livelli: soglie(['100', '100% delle giornate di ripresa con energia rinnovabile', 3], ['75', 'almeno il 75% delle giornate', 2]),
      documenti: ['Contratto di fornitura', 'Dichiarazione del fornitore o certificazione «Garanzia d’Origine»', 'Fatture e foto dei generatori a fonti rinnovabili', 'Tabella dei set con la percentuale complessiva'],
      set: 'Rilievo dell’allaccio con fornitura rinnovabile o dei generatori a fonti rinnovabili.' },
    { id: 'A3', nome: 'Luci a LED', max: 2, tipo: 'soglie',
      requisito: 'Apparecchi illuminanti a LED invece di incandescenza, alogeni o fluorescenza.',
      livelli: soglie(['100', '100% dei sistemi di illuminazione a LED', 2], ['75', 'almeno il 75%', 1]),
      documenti: ['Fatture di acquisto o noleggio delle luci', 'Elenco con la percentuale di corpi luce LED sul parco luci'],
      set: 'Rilievo dei sistemi di illuminazione in uso.' },
  ] },
  { id: 'B', nome: 'Trasporti e alloggi', criteri: [
    { id: 'B1', nome: 'Automezzi tecnici per il trasporto delle attrezzature', max: 2, tipo: 'fisso',
      requisito: 'Solo automezzi Euro VI o superiori per le attrezzature tecniche.',
      documenti: ['Carte di circolazione', 'Eventuali contratti di noleggio'],
      set: 'Rilievo dei mezzi usati: nessun mezzo Euro V o inferiore.' },
    { id: 'B2', nome: 'Trasferimenti giornalieri alloggio-set', max: 4, tipo: 'opzioni',
      requisito: 'Per cast e troupe solo mezzi ammessi. Vale il punteggio più basso tra le modalità effettivamente usate.',
      livelli: soglie(['pubblico', 'Trasporto pubblico e mobilità lenta', 4], ['elettriche', 'Auto elettriche', 3], ['ibride', 'Auto ibride, a metano o a GPL', 2]),
      documenti: ['Lista dei mezzi usati', 'Biglietti e abbonamenti dei mezzi pubblici', 'Libretti di circolazione', 'Contratti di noleggio', 'Dichiarazione firmata per la mobilità lenta con mezzi propri'],
      set: 'Rilievo dei mezzi usati: nessun mezzo non ammesso.' },
    { id: 'B3', nome: 'Spostamenti casa-lavoro e trasferimenti tra set', max: 3, tipo: 'soglie',
      requisito: 'Viaggi pagati dalla produzione con treno, metro, pullman, bus, car pooling (almeno 3 persone) o nave. Aereo solo oltre le 7 ore di viaggio e con compensazione della CO2.',
      livelli: soglie(['100', '100% dei viaggi con le modalità consentite', 3], ['75', 'almeno il 75%', 2]),
      documenti: ['Elenco del personale con i luoghi di partenza', 'Fatture e biglietti', 'Autodichiarazione per il car pooling', 'Attestato o fattura dei crediti di carbonio per i voli'],
      set: null },
    { id: 'B4', nome: 'Alloggi entro 10 km dal set', max: 4, tipo: 'soglie',
      requisito: 'Alloggi entro 10 km dal set (esclusi i set usati per una sola giornata).',
      livelli: soglie(['100', '100% dei pernottamenti entro 10 km', 4], ['75', 'almeno il 75%', 3]),
      documenti: ['Elenco degli alloggi con la percentuale entro 10 km', 'Fatture degli alloggi', 'Distanze calcolate con un servizio di mappe'],
      set: null },
    { id: 'B5', nome: 'Strutture ricettive certificate', max: 3, tipo: 'opzioni',
      requisito: 'Almeno il 50% dei pernottamenti in strutture certificate.',
      livelli: soglie(['ecolabel', 'EU Ecolabel (o altra ISO 14024 tipo I) oppure EMAS', 3], ['gstc', 'GST Council', 2]),
      documenti: ['Elenco delle strutture usate', 'Certificazioni', 'Tabella dei pernottamenti con la percentuale in strutture certificate', 'Fatture'],
      set: null },
  ] },
  { id: 'C', nome: 'Ristorazione', criteri: [
    { id: 'C1', nome: 'Acqua potabile', max: 3, tipo: 'opzioni',
      requisito: 'Niente bottiglie di plastica né bicchieri usa e getta. Vale il punteggio più basso tra le modalità usate.',
      livelli: soglie(['rete', 'Solo rete idrica locale, con borracce o bicchieri riutilizzabili', 3], ['boccioni', 'Boccioni con ritiro e riutilizzo, con borracce o bicchieri riutilizzabili', 2]),
      documenti: ['Elenco dei set con i punti di erogazione', 'Fatture di boccioni, borracce e bicchieri lavabili (o autodichiarazione di riuso)'],
      set: 'Nessuna bottiglia di plastica o bicchiere usa e getta.' },
    { id: 'C2', nome: 'Somministrazione dei pasti', max: 4, tipo: 'opzioni',
      requisito: 'Pasto principale senza cestini e imballaggi monouso. Spuntino veloce sul set ammesso per non più del 30% delle giornate.',
      livelli: soglie(['ristoranti', 'Solo esercizi di ristorazione entro 5 km dal set o cucina da campo con stoviglie riutilizzabili', 4], ['misto', 'Almeno il 75% dei pasti così, il resto con catering self-service senza cestini', 3], ['catering', 'Catering self-service con stoviglie riutilizzabili, senza cestini', 2]),
      documenti: ['Elenco dei set con gli esercizi di ristorazione usati e la percentuale di pasti', 'Fatture', 'Contratto di catering o cucina da campo che escluda i cestini'],
      set: 'Nessun cestino pro capite; spuntini entro il 30% delle giornate.' },
    { id: 'C3', nome: 'Proposta vegetariana, biologica e/o locale', max: 2, tipo: 'somma',
      requisito: 'Sul 100% dei pasti principali.',
      voci: soglie(['veg', 'Almeno un’alternativa vegetariana o vegana', 1], ['bio', 'Almeno un’alternativa con ingredienti 100% biologici e/o locali (entro 200 km)', 1]),
      documenti: ['Contratto con il fornitore che espliciti il piatto vegetariano e/o biologico-locale'],
      set: null },
    { id: 'C4', nome: 'Caffè sul set', max: 2, tipo: 'opzioni',
      requisito: 'Senza bicchieri né palette usa e getta; niente capsule di plastica o alluminio. Vale il punteggio più basso tra i tipi di caffè serviti.',
      livelli: soglie(['grani', '100% caffè in grani', 2], ['cialde', '100% cialde compostabili conferite nell’organico', 1]),
      documenti: ['Fatture di bicchieri e cucchiaini lavabili e del caffè in grani o in cialde compostabili'],
      set: 'Nessuna fornitura non ammessa.' },
    { id: 'C5', nome: 'Lotta allo spreco alimentare', max: 2, tipo: 'soglie',
      requisito: 'Accordo con enti no profit o aziende per il recupero del cibo preparato e non consumato sul set.',
      livelli: soglie(['100', '100% dei pasti principali con donazione degli avanzi', 2], ['75', 'almeno il 75%', 1]),
      documenti: ['Accordo con il soggetto che recupera il cibo', 'Elenco dei set e dei pasti con donazione, con la percentuale'],
      set: 'Verifica del recupero effettivo del cibo.' },
  ] },
  { id: 'D', nome: 'Scelta dei materiali', criteri: [
    { id: 'D1', nome: 'Fornitori e prodotti certificati per le scenografie', max: 3, tipo: 'opzioni',
      requisito: 'Vernici e legname certificati. Con entrambi i requisiti i punti sono 3.',
      livelli: soglie(['entrambi', 'Vernici EU Ecolabel (o ISO 14024 tipo I) e legname FSC o PEFC', 3], ['vernici', 'Solo vernici certificate', 1], ['legno', 'Solo legname certificato', 1]),
      documenti: ['Tabella delle forniture per le scenografie', 'Fatture', 'Certificazioni ambientali'],
      set: 'Scenografie realizzate con i materiali certificati.' },
    { id: 'D2', nome: 'Materiali riciclati o derivanti dal riuso', max: 1, tipo: 'fisso',
      requisito: 'Per scenografia, oggetti di scena e abiti di scena: il requisito va rispettato per tutte e tre le tipologie.',
      documenti: ['Fatture, contratti, bolle o accordi scritti', 'Schede tecniche con la componente riciclata', 'Evidenze del precedente utilizzo'],
      set: 'Presenza sul set dei materiali riciclati o di riuso.' },
    { id: 'D3', nome: 'Donazione o riutilizzo dei materiali', max: 3, tipo: 'giudizio',
      requisito: 'A fine riprese i materiali di scena realizzati per l’opera vanno conservati per il riuso o ceduti a chi li riusa. I punti (fino a 3) li assegna l’organismo di verifica in base alla quantità e al tipo di beneficiario.',
      documenti: ['Dichiarazione firmata di impegno a conservare e riutilizzare', 'Fatture, bolle o ricevute controfirmate della cessione (o impegno scritto al ritiro)'],
      set: null },
    { id: 'D4', nome: 'Riduzione dell’utilizzo di carta', max: 1, tipo: 'fisso',
      requisito: 'Ordini del giorno e comunicazioni interne per via telematica; la carta indispensabile deve essere certificata.',
      documenti: ['Campione digitale delle comunicazioni', 'Dichiarazione firmata dell’organizzatore generale o del produttore'],
      set: 'Nessuna comunicazione cartacea non indispensabile.' },
    { id: 'D5', nome: 'Prodotti cosmetici', max: 1, tipo: 'fisso',
      requisito: 'Trucco e parrucchieri: solo prodotti EU Ecolabel (o ISO 14024 tipo I) oppure con almeno il 95% di ingredienti biologici.',
      documenti: ['Tabella delle forniture cosmetiche', 'Fatture', 'Certificazioni'],
      set: 'Nessun prodotto non conforme.' },
  ] },
  { id: 'E', nome: 'Azioni supplementari', criteri: [
    { id: 'E1', nome: 'Calcolo dell’impronta di carbonio', max: 3, tipo: 'fisso',
      requisito: 'Quantificare la CO2 con un calcolatore specifico per l’audiovisivo, basato su ISO 14067 o standard analogo, su energia, trasporti, alloggi, ristorazione, materiali e rifiuti.',
      documenti: ['Report del calcolo o evidenza analoga con i risultati'],
      set: null },
    { id: 'E2', nome: 'Iniziativa personalizzata', max: 2, tipo: 'giudizio',
      requisito: 'Ulteriori iniziative verificabili, da concordare prima con l’organismo di verifica: fino a 2 punti.',
      documenti: ['Documentazione dell’iniziativa con i giustificativi'],
      set: null },
  ] },
  { id: 'F', nome: 'Sostenibilità sociale', criteri: [
    { id: 'F1', nome: 'Benessere sul set', max: 3, tipo: 'somma',
      requisito: 'Le due voci si sommano.',
      voci: soglie(['carta', 'Carta dei valori della produzione diffusa a cast e troupe prima delle riprese', 1], ['iniziative', 'Una o più iniziative per il benessere psico-fisico-sociale durante le riprese', 2]),
      documenti: ['Carta dei valori ed evidenze della diffusione prima delle riprese', 'Documentazione delle iniziative con i giustificativi'],
      set: 'Ricezione effettiva della carta; veridicità delle iniziative dichiarate.' },
    { id: 'F2', nome: 'Scelta di fornitori sostenibili', max: 3, tipo: 'fisso',
      requisito: 'Almeno il 30% dei fornitori rilevanti è società benefit, cooperativa sociale di tipo B o ente del terzo settore, oppure certificato SA 8000, ISO 14001 o EMAS.',
      documenti: ['Fatture dei fornitori certificati', 'Certificazioni'],
      set: null },
    { id: 'F3', nome: 'Fornitori locali', max: 3, tipo: 'fisso',
      requisito: 'Almeno il 30% dei fornitori rilevanti ha la sede operativa entro 200 km dai set.',
      documenti: ['Elenco dei fornitori con bene o servizio e distanze stradali, con la percentuale di locali', 'Fatture dei fornitori locali'],
      set: null },
  ] },
  { id: 'G', nome: 'Comunicazione', criteri: [
    { id: 'G1', nome: 'Pubblicizzare e promuovere la sostenibilità', max: 4, tipo: 'somma',
      requisito: 'Le voci si sommano fino a 4 punti. Il logo Green Film è comunque obbligatorio nei crediti e nei materiali pubblicitari.',
      voci: soglie(['video', 'Trailer, clip o backstage sulle buone pratiche adottate, diffuso prima della fine della verifica', 1], ['formazione', 'Formazione all’intera troupe e «green memo» (oltre al kick-off del prerequisito)', 2], ['iniziativa', 'Altra iniziativa di comunicazione verificabile', 1]),
      documenti: ['Video ed evidenze della diffusione', 'Prove degli incontri e della diffusione del «green memo»', 'Documentazione dell’iniziativa'],
      set: null },
  ] },
];

export const CRITERI_GREEN = SEZIONI_GREEN.flatMap((s) => s.criteri.map((c) => ({ ...c, sezione: s.id })));
const criterioGreen = (id) => CRITERI_GREEN.find((c) => c.id === id);

/** I punti di una scelta. scelta: id del livello (soglie/opzioni), true (fisso), elenco di voci (somma), numero (giudizio). */
export function puntiCriterio(c, scelta) {
  if (!c || scelta == null || scelta === false || scelta === '') return 0;
  if (c.tipo === 'fisso') return scelta === true || scelta === 'si' ? c.max : 0;
  if (c.tipo === 'giudizio') { const n = Number(scelta); return Number.isFinite(n) ? Math.max(0, Math.min(c.max, r1(n))) : 0; }
  if (c.tipo === 'somma') {
    const ids = Array.isArray(scelta) ? scelta : [];
    return Math.min(c.max, c.voci.filter((v) => ids.includes(v.id)).reduce((a, v) => a + v.punti, 0));
  }
  return c.livelli.find((l) => l.id === scelta)?.punti || 0;
}

/**
 * Il quadro della certificazione per le scelte fatte.
 * @param {object} piano { scelte: { [criterioId]: scelta }, prerequisito: { [voceId]: true }, emas: boolean, margine: number }
 */
export function calcolaGreen(piano = {}) {
  const scelte = piano.scelte || {};
  const minimo = MINIMO_GREEN - (piano.emas ? RIDUZIONE_EMAS : 0);
  const sezioni = SEZIONI_GREEN.map((s) => {
    const criteri = s.criteri.map((c) => ({ id: c.id, nome: c.nome, max: c.max, tipo: c.tipo, punti: puntiCriterio(c, scelte[c.id]), incerto: c.tipo === 'giudizio' && puntiCriterio(c, scelte[c.id]) > 0 }));
    return { id: s.id, nome: s.nome, max: criteri.reduce((a, c) => a + c.max, 0), punti: r1(criteri.reduce((a, c) => a + c.punti, 0)), criteri };
  });
  const totale = r1(sezioni.reduce((a, s) => a + s.punti, 0));
  // punti che dipendono dal giudizio dell'organismo di verifica: non vanno contati per stare tranquilli
  const incerti = r1(sezioni.flatMap((s) => s.criteri).filter((c) => c.incerto).reduce((a, c) => a + c.punti, 0));
  const sicuri = r1(totale - incerti);
  const pre = PREREQUISITO.voci.map((v) => ({ ...v, fatto: !!piano.prerequisito?.[v.id] }));
  const preOk = pre.filter((v) => v.quando === 'prima').every((v) => v.fatto);
  const scelti = CRITERI_GREEN.filter((c) => puntiCriterio(c, scelte[c.id]) > 0);
  const avvisi = [];
  if (totale < minimo) avvisi.push({ livello: 'critico', testo: `Mancano ${r1(minimo - totale).toLocaleString('it-IT')} punti al minimo di ${minimo}: senza, il marchio non viene rilasciato.` });
  else if (sicuri < minimo) avvisi.push({ livello: 'attenzione', testo: `Il minimo di ${minimo} si raggiunge solo contando ${incerti.toLocaleString('it-IT')} punti che assegna l’organismo di verifica a sua discrezione (criteri D3 ed E2): aggiungi criteri dal punteggio certo.` });
  else if (totale - minimo < 5) avvisi.push({ livello: 'attenzione', testo: `Il margine sul minimo è di soli ${r1(totale - minimo).toLocaleString('it-IT')} punti: se un criterio non viene confermato dalla verifica sul set la certificazione salta. Meglio dichiarare almeno 5 punti in più.` });
  if (!preOk) avvisi.push({ livello: 'attenzione', testo: 'Il prerequisito PR1 è obbligatorio: nomina, Piano di Sostenibilità, invio e kick-off vanno completati prima dell’inizio delle riprese.' });
  return {
    edizione: '03 – 2024', minimo, totale, sicuri, incerti, massimo: TOTALE_GREEN, margine: r1(totale - minimo),
    raggiunto: totale >= minimo, solido: sicuri >= minimo && totale - minimo >= 5 && preOk,
    sezioni, prerequisito: { voci: pre, completo: preOk }, avvisi,
    documenti: scelti.map((c) => ({ id: c.id, nome: c.nome, documenti: c.documenti, set: c.set })),
  };
}

/** I criteri non scelti che darebbero più punti, per arrivare al minimo o allargare il margine. */
export function suggerimentiGreen(piano = {}, quanti = 6) {
  const scelte = piano.scelte || {};
  return CRITERI_GREEN.map((c) => ({ id: c.id, nome: c.nome, sezione: c.sezione, guadagno: r1(c.max - puntiCriterio(c, scelte[c.id])), certo: c.tipo !== 'giudizio', requisito: c.requisito }))
    .filter((x) => x.guadagno > 0).sort((a, b) => Number(b.certo) - Number(a.certo) || b.guadagno - a.guadagno).slice(0, quanti);
}

/**
 * Scadenze della procedura rispetto alle riprese (pagina «Certification» di green.film e modulo di richiesta):
 * richiesta almeno 15 giorni prima dell'inizio, documentazione entro un mese dall'ultimo giorno di riprese.
 */
export function scadenzeGreen(inizioRiprese, fineRiprese) {
  const data = (s) => { const d = new Date(`${String(s || '').slice(0, 10)}T12:00:00Z`); return Number.isNaN(d.getTime()) ? null : d; };
  const iso = (d) => d.toISOString().slice(0, 10);
  const out = [];
  const a = data(inizioRiprese), b = data(fineRiprese);
  if (a) {
    const r = new Date(a); r.setUTCDate(r.getUTCDate() - 15);
    out.push({ id: 'richiesta', data: iso(r), testo: 'Ultimo giorno per inviare la richiesta di certificazione (almeno 15 giorni prima dell’inizio delle riprese)' });
    out.push({ id: 'prerequisito', data: iso(a), testo: 'Entro l’inizio delle riprese: nomina del/della Sustainability Manager, Piano di Sostenibilità trasmesso, kick-off con verbale, eventuali modifiche ai criteri comunicate' });
  }
  if (b) {
    const r = new Date(b); r.setUTCMonth(r.getUTCMonth() + 1);
    out.push({ id: 'documenti', data: iso(r), testo: 'Consegna all’organismo di verifica dei documenti che provano i criteri dichiarati e del report finale (entro un mese dall’ultimo giorno di riprese)' });
  }
  return out;
}

/**
 * L'edizione precedente del disciplinare (in uso fino al 2024): serviva per le richieste compilate allora.
 * Minimo 20 punti su 50; i codici dei criteri non coincidono con quelli dell'Edizione 03.
 */
export const EDIZIONE_PRECEDENTE = {
  minimo: 20, totale: 50,
  criteri: { A1: 3, A2: 3, A3: 3, B1: 1, B2: 4, B3: 4, B4: 3, C1: 4, C2: 4, C3: 2, C4: 3, D1: 3, D2: 1, D3: 2, D4: 1, E1: 4, F1: 5 },
};

/**
 * Riconosce dal testo di una richiesta Green Film su quale edizione è compilata.
 * @returns {{ edizione: 'precedente'|'03-2024'|null, minimoDichiarato: number|null, organismo: string|null, avviso: string|null }}
 */
export function leggiRichiestaGreen(testo) {
  const t = String(testo || '').replace(/\s+/g, ' ');
  if (!/green\s*film/i.test(t)) return { edizione: null, minimoDichiarato: null, organismo: null, avviso: null };
  const m = /almeno\s+(\d{2})\s+punti|non inferiore a\s+\w+\s*\(?\s*(\d{2})\s*\)?\s*punti/i.exec(t);
  const minimo = m ? Number(m[1] || m[2]) : null;
  const nuova = /sostenibilit[àa] sociale|impronta di carbonio|spreco alimentare|edizione\s*0?3/i.test(t) || minimo === 25;
  const vecchia = minimo === 20 || /mezzi euro 5|stoviglie riutilizzabili|bevande calde sul set|raccolta differenziata\s+4/i.test(t);
  const edizione = nuova ? '03-2024' : vecchia ? 'precedente' : null;
  const org = /organismo di verifica[^:]{0,80}:\s*([A-Z][A-Za-z0-9 .&'’-]{2,60}?)(?=\s{2,}|\s+allega|\s+luogo|$)/i.exec(t);
  return {
    edizione, minimoDichiarato: minimo, organismo: org ? org[1].trim() : null,
    avviso: edizione === 'precedente' ? `La richiesta è compilata sull’edizione precedente del disciplinare (minimo ${EDIZIONE_PRECEDENTE.minimo} punti). L’Edizione 03 – 2024 chiede almeno ${MINIMO_GREEN} punti e ha criteri diversi: per una nuova domanda va rifatta la scheda di scelta dei criteri.` : null,
  };
}

/** Tabella del piano Green Film in CSV (separatore punto e virgola, come gli altri file del programma). */
export function csvGreen(piano = {}, titolo = '') {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const k = calcolaGreen(piano);
  const righe = [[`Green Film – scelta dei criteri${titolo ? ` – ${titolo}` : ''}`], [`Disciplinare Edizione ${k.edizione}`, `Minimo ${k.minimo}`, `Dichiarati ${k.totale}`], [], ['Criterio', 'Titolo', 'Scelta', 'Punti', 'Massimo', 'Documenti da presentare', 'Verifica sul set']];
  for (const c of CRITERI_GREEN) {
    const s = piano.scelte?.[c.id];
    const p = puntiCriterio(c, s);
    const etichetta = !p ? '' : c.tipo === 'fisso' ? 'Sì' : c.tipo === 'giudizio' ? `previsti ${p}` : c.tipo === 'somma' ? c.voci.filter((v) => (s || []).includes(v.id)).map((v) => v.etichetta).join(' + ') : c.livelli.find((l) => l.id === s)?.etichetta || '';
    righe.push([c.id, c.nome, etichetta, p, c.max, p ? c.documenti.join(' · ') : '', p ? c.set || '' : '']);
  }
  righe.push([], ['Prerequisito PR1', PREREQUISITO.nome], ...k.prerequisito.voci.map((v) => ['', v.testo, v.fatto ? 'fatto' : 'da fare', '', '', v.quando === 'prima' ? 'prima delle riprese' : 'a fine riprese']));
  return `﻿${righe.map((r) => r.map(q).join(';')).join('\r\n')}`;
}

export { criterioGreen };
