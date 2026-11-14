// Minimi retributivi contrattuali di riferimento per la troupe e per gli attori.
//
// TROUPE. Le cifre sono trascritte dalle tabelle «Minimo salariale settimanale» pubblicate da ANICA
// (documenti «Rinnovo biennio economico livelli 1-4» e «livelli 5-7» nella pagina indicata in `url`).
// La banca dati contrattuale ripubblicata da Cinecittà (`urlRiscontro`) riporta le stesse cifre e le attribuisce
// all'accordo di rinnovo economico del 27 gennaio 2003 del CCNL 7 dicembre 1999 per gli addetti alle troupes,
// con decorrenza dal 3 marzo 2003 per le lavorazioni iniziate da quella data.
//
// ATTENZIONE: sono minimi del 2003, espressi per la settimana contrattuale di 38 ore. Non è stata trovata una
// tabella più recente: il rinnovo del CCNL troupes era ancora in trattativa a settembre 2026 (comunicato
// UILFPC-UIL del 18 settembre 2026). Vanno usati solo come soglia contrattuale minima, non come stima dei
// compensi correnti, e verificati con il consulente del lavoro.
//
// Come leggere le colonne della tabella ufficiale (importi in euro, lordi):
//   pagaBase         paga base tabellare per 38 ore
//   minimo           «tot 1» = paga base + EDR (2,582) + forfait 27% degli istituti normativi (ferie, gratifica, ecc.)
//   totale38ConTfr   «tot (38 ore)» = tot 1 + quota TFR (:13,5)
//   totale45ConTfr   «Tot. 45 ORE» = 38 ore + 7 ore di straordinario al 55%, con TFR
//   giornata9ConTfr  «TOT. 9 ORE» della tabella «Rinforzi o giornalieri» (personale a giornata)

// Valori per livello, esattamente come pubblicati.
const LIVELLI = {
  "1": { pagaBase: 241.92, minimo: 310.518, totale38ConTfr: 333.52, totale45ConTfr: 407.711, giornata9ConTfr: 93.061 },
  "2": { pagaBase: 262.194, minimo: 336.266, totale38ConTfr: 361.174, totale45ConTfr: 441.583, giornata9ConTfr: 100.79 },
  "3": { pagaBase: 278.274, minimo: 356.687, totale38ConTfr: 383.108, totale45ConTfr: 468.448, giornata9ConTfr: 106.92 },
  "4": { pagaBase: 323.999, minimo: 414.758, totale38ConTfr: 445.481, totale45ConTfr: 544.843, giornata9ConTfr: 124.351 },
  "5": { pagaBase: 342.29, minimo: 437.987, totale38ConTfr: 470.431, totale45ConTfr: 575.403, giornata9ConTfr: 131.324 },
  "6B": { pagaBase: 364.463, minimo: 466.147, totale38ConTfr: 500.676, totale45ConTfr: 612.448, giornata9ConTfr: 139.777 },
  "6A": { pagaBase: 395.896, minimo: 506.068, totale38ConTfr: 543.554, totale45ConTfr: 664.966, giornata9ConTfr: 151.761 },
  "7": { pagaBase: 454.422, minimo: 580.396, totale38ConTfr: 623.388, totale45ConTfr: 762.748, giornata9ConTfr: 174.073 },
};

// Qualifiche per livello: esemplificazioni dell'art. 7 (Classificazione) del CCNL 7 dicembre 1999, al singolare.
const RUOLI = {
  "1": ["Manovale", "Addetto a lavori di pulizia, trasporto, carico"],
  "2": [
    "Aiuto tappezziere", "Aiuto magazziniere", "Aiuto attrezzista", "Aiuto di sartoria", "Guardiano", "Custode",
    "Aiuto operatore", "Aiuto trucco", "Aiuto parrucchiere", "Aiuto reparto fonici", "Aiuto reparto montaggio",
    "Aiuto segretario di produzione", "Aiuto costumista", "Aiuto arredatore", "Aiuto scenografo",
    "Assistente alla regia", "Aiuto amministratore-cassiere",
  ],
  "3": ["Autista di camion e autovetture di produzione", "Pompiere", "Assistente al montaggio di 2ª"],
  "4": [
    "Truccatore", "Parrucchiere", "Segretario di produzione", "Aiuto cassiere", "Addetto al playback",
    "Elettricista", "Macchinista", "Gruppista", "Pittore", "Stuccatore", "Attrezzista", "Sarta", "Tappezziere",
    "Autista cameracar", "Autista mezzi speciali", "Roulottista", "Autista-meccanico", "Meccanico",
  ],
  "5": [
    "Assistente operatore", "Assistente scenografo", "Assistente costumista", "Assistente al montaggio di 1ª",
    "Fotografo di scena", "Microfonista", "Assistente arredatore",
    "Amministratore con responsabilità dell'amministrazione della troupe",
    "Caposquadra elettricisti", "Caposquadra macchinisti", "Decoratore", "Scenotecnico",
  ],
  "6B": ["Segretario di edizione", "Ispettore di produzione", "Capo parrucchiere", "Capo truccatore", "Montatore del suono"],
  "6A": ["Operatore alla macchina", "Tecnico del suono (fonico)", "Aiuto regista", "Arredatore"],
  "7": ["Direttore di produzione", "Montatore in esclusiva", "Direttore della fotografia", "Scenografo", "Costumista"],
};

// Ordine crescente dei livelli (il 6° è diviso in B e A; il 6°A è superiore al 6°B).
const ORDINE_LIVELLI = ["1", "2", "3", "4", "5", "6B", "6A", "7"];

export const TARIFFE_RIFERIMENTO = {
  fonte: "CCNL 7 dicembre 1999 per gli addetti alle troupes (tecnici e maestranze) dipendenti da case di produzione cineaudiovisiva - tabelle «Minimo salariale settimanale» del rinnovo economico 27 gennaio 2003, pubblicate da ANICA",
  url: "https://www.anica.it/news/ccnl-troupes-protocollo-dintesa-del-31-7-2012-e-archivio",
  urlTabelle: [
    "https://www.anica.it/multimedia/files/normativa/ccnl_troupes_liv01-04.pdf",
    "https://www.anica.it/multimedia/files/normativa/ccnl_troupes_liv05-07.pdf",
  ],
  urlRiscontro: "https://cinecitta.com/public/amm_trasp/2022/CCNL_troupes.pdf",
  anno: 2003,
  verificato: "2026-11",
  valuta: "EUR",
  unita: "settimana",
  avvertenza: "Minimi contrattuali del 2003 per la settimana di 38 ore («tot 1»: paga base, EDR e forfait 27%, senza TFR e straordinari). Nessuna tabella più recente trovata: rinnovo del CCNL in trattativa a settembre 2026. Non rappresentano i compensi correnti.",
  voci: ORDINE_LIVELLI.flatMap((livello) =>
    RUOLI[livello].map((ruolo) => ({ ruolo, livello, ...LIVELLI[livello] }))
  ),
};

// ATTORI. Minimi lordi omnicomprensivi per giornata di posa, art. 6 del CCNL per interpreti, attrici ed attori
// del comparto di produzione del cineaudiovisivo, firmato il 20 dicembre 2023 da ANICA, APA, APE e SLC-CGIL,
// FISTEL-CISL, UILCOM-UIL, in vigore dal 1° marzo 2024 al 28 febbraio 2027 (art. 19). Gruppi (art. 2):
// 1 = protagonisti; 2 = comprimari, personaggi fissi delle serie, camei; 3 = tutti gli altri.
export const TARIFFE_ATTORI_RIFERIMENTO = {
  fonte: "CCNL per interpreti, attrici ed attori del comparto di produzione del cineaudiovisivo, 20 dicembre 2023, art. 6",
  url: "https://www.anica.it/multimedia/files/normativa/ccnl-attori.pdf",
  anno: 2023,
  verificato: "2026-11",
  valuta: "EUR",
  unita: "giornata di posa",
  voci: [
    { ruolo: "Attore - gruppo 1 (protagonisti)", livello: "1", minimo: 1100 },
    { ruolo: "Attore - gruppo 2 (comprimari, personaggi fissi, camei)", livello: "2", minimo: 850, dallaOttavaPosa: 650 },
    { ruolo: "Attore - gruppo 3 (altri ruoli)", livello: "3", minimo: 650, dallaOttavaPosa: 450 },
  ],
  // Minimi ridotti per: opere prime e seconde o con budget inferiore a 2 milioni di euro; cortometraggi con budget
  // inferiore a 750.000 €; documentari e docufiction con budget inferiore a 500.000 € per ora di prodotto;
  // prodotti di ricerca e formazione.
  vociOpereABassoBudget: [
    { ruolo: "Attore - gruppo 1 (protagonisti)", livello: "1", minimo: 550 },
    { ruolo: "Attore - gruppo 2 (comprimari, personaggi fissi, camei)", livello: "2", minimo: 425 },
    { ruolo: "Attore - gruppo 3 (altri ruoli)", livello: "3", minimo: 325 },
  ],
  avvertenza: "Compensi minimi per giornata di posa, comprensivi della quota per la cessione dei diritti. Il contratto prevede importi diversi per la lunga serialità e un minimo assoluto di 325 € per qualsiasi prodotto industriale.",
};
