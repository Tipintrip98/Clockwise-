// Regole finanziarie del cinema italiano usate dalla scheda Finanza: credito d'imposta alla produzione,
// intensità degli aiuti, erogazione dei contributi, costi di finanziamento e recupero dei ricavi.
// Ogni costante porta valore, unità, descrizione, fonte (atto e articolo), data da cui vale e due indicatori:
//   daVerificare — c'è un dubbio dichiarato nella nota (testo ambiguo, regola transitoria non scritta, stima);
//   indicativo   — non viene da un atto: è una stima di prassi di mercato, da sostituire con i dati reali.
// I numeri senza indicatori sono stati letti negli atti ufficiali il 14/11/2026. Quando una norma cambia si aggiorna
// questo file (e la data qui sotto): la logica in finanza.js legge i valori da qui e non li ripete.
// Le percentuali sono in punti percentuali (30 = 30%), gli importi in euro.

export const AGGIORNATO_AL = '2026-11-14';

/** Atti da cui vengono le regole. `breve` è il nome da mostrare accanto ai numeri. */
export const FONTI = {
  CONS: { breve: 'D.I. 225/2024, testo consolidato del 19 ottobre 2026', titolo: 'D.I. MiC-MEF 10 luglio 2024, n. 225 «tax credit produzione», testo consolidato con le modifiche del D.I. 22 aprile 2025, n. 141 e del D.I. 6 luglio 2026, n. 281 (revisione DGCA del 19 ottobre 2026)', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2026/10/20260618_Consolidato_TC-art.-15_Modifica-2026_rev-19-ottobre.pdf' },
  DI281: { breve: 'D.I. 281/2026', titolo: 'D.I. MiC-MEF 6 luglio 2026, n. 281 — Modifiche al D.I. 10 luglio 2024, n. 225 (pubblicato il 24 settembre 2026)', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2026/09/DM_MIC_MEF_tax_credit_cinema_225_2024_per_firma_signed.pdf' },
  DI141: { breve: 'D.I. 141/2025', titolo: 'D.I. MiC-MEF 22 aprile 2025, n. 141 — Modifiche al D.I. 10 luglio 2024, n. 225', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2025/06/250418_Decreto_produzione_17_aprile_2025_signed__1__signed.pdf' },
  CONS2025: { breve: 'D.I. 225/2024, testo consolidato 2025 (superato)', titolo: 'D.I. 225/2024, testo consolidato dopo il D.I. 141/2025 (superato)', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2025/06/DEF-D.I.-10-LUGLIO-2024-N.225-TAX-CREDIT.pdf' },
  DD2541: { breve: 'D.D. 2541/2025 (disposizioni attuative)', titolo: 'D.D. DGCA 26 giugno 2025, rep. 2541 — Disposizioni attuative del tax credit produzione (art. 38, comma 1, D.I. 225/2024)', url: 'https://cinema.cultura.gov.it/wp-content/uploads/dlm_uploads/2025/06/D.D.-26.06.2026-rep.-2541-Tax-Credit-produzione-nazionale.pdf' },
  DD2821: { breve: 'D.D. 2821/2026 (sessione 2026)', titolo: 'D.D. DGCA 24 settembre 2026, rep. 2821 — Apertura della sessione 2026 del tax credit produzione', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2026/09/D.D.-apertura-sessione-finestra-2026-_produzione_REP.-2821.pdf' },
  DI329: { breve: 'D.I. 329/2024 (tax credit internazionale)', titolo: 'D.I. MiC-MEF 4 ottobre 2024, n. 329 — Credito d’imposta per l’attrazione in Italia di investimenti cinematografici e audiovisivi (art. 19 L. 220/2016)', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2024/11/DM-TC-internazionale.pdf' },
  DD1244: { breve: 'D.D. 1244/2026 (sessione internazionale 2026)', titolo: 'D.D. DGCA 19 maggio 2026, rep. 1244 — Apertura della sessione 2026 del tax credit internazionale', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2026/05/20260518_D1.D-apertura-sessione-Tax-credit-internazionale_signed_signed.pdf' },
  DM101: { breve: 'D.M. 101/2026 (riparto del Fondo 2026)', titolo: 'D.M. MiC 5 marzo 2026, rep. 101 — Riparto del Fondo per il cinema e l’audiovisivo per l’anno 2026', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2026/04/Decreto-riparto-signed.pdf' },
  DM390: { breve: 'D.M. 390/2026 (ulteriore riparto 2026)', titolo: 'D.M. MiC 19 ottobre 2026, rep. 390 — Ulteriore riparto del Fondo per l’anno 2026', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2026/11/DM-rep.-390-del-19.10.2026.pdf' },
  DM265: { breve: 'D.M. 265/2026 (contributi automatici)', titolo: 'D.M. MiC 18 giugno 2026, rep. 265 — Disposizioni applicative in materia di contributi automatici (artt. 23, 24 e 25 L. 220/2016)', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2026/09/D.M.-18-giugno-2026-rep.265-Disposizioni-applicative-in-materia-di-contributi-automatici-di-cui-agli-articoli-23-24-e-25-della-.pdf' },
  DM345: { breve: 'D.M. 345/2024 (contributi selettivi)', titolo: 'D.M. MiC 8 ottobre 2024, rep. 345 — Disposizioni applicative in materia di contributi selettivi (art. 26 L. 220/2016)', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2024/11/DM-8-ottobre-2024-rep.-345-art.-26-contributi-selettivi-signed.pdf' },
  SEL26: { breve: 'D.D. 1238/2026 (bando selettivi 2026)', titolo: 'D.D. DGCA 15 maggio 2026, rep. 1238 — Bando contributi selettivi per la scrittura, lo sviluppo e la produzione, anno 2026', url: 'https://cinema.cultura.gov.it/download/38796/' },
  DD3361: { breve: 'D.D. 3361/2024 (revisori), testo consolidato', titolo: 'D.D. DGCA 14 ottobre 2024, rep. 3361 — Requisiti dei soggetti abilitati alla certificazione e contenuto delle certificazioni, testo consolidato (modifiche fino al D.D. 17 settembre 2026, rep. 2738)', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2026/09/REVISORI_-TESTO-CONSOLIDATO-DEL-D.D.-14-ottobre-2024-n.-3361.pdf' },
  DD3362: { breve: 'D.D. 3362/2024 (spese istruttorie), testo consolidato', titolo: 'D.D. DGCA 14 ottobre 2024, rep. 3362 — Contributo per le spese istruttorie, testo consolidato (modifiche fino al D.D. 17 settembre 2026, rep. 2739)', url: 'https://cinema.cultura.gov.it/wp-content/uploads/2026/09/20260915_SPESE-ISTRUTTORIE-_TESTO-CONSOLIDATO.pdf' },
  L220: { breve: 'Legge 220/2016', titolo: 'Legge 14 novembre 2016, n. 220 — Disciplina del cinema e dell’audiovisivo (testo vigente su Normattiva), artt. 12, 13, 15, 19 e 21', url: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2016-11-14;220~art15' },
  GBER: { breve: 'Reg. (UE) 651/2014, consolidato al 1° luglio 2023', titolo: 'Regolamento (UE) n. 651/2014 della Commissione del 17 giugno 2014, testo consolidato al 1° luglio 2023, artt. 4, 8, 54 e 59', url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:02014R0651-20230701' },
  SIC: { breve: 'Regione Siciliana, Avviso 2025-2027', titolo: 'Regione Siciliana — Avviso pubblico per la concessione di contributi a sostegno delle produzioni cinematografiche e audiovisive, anni 2025-2027, testo coordinato con il D.D.G. n. 4788 del 22 dicembre 2025', url: null },
  ER26: { breve: 'Regione Emilia-Romagna, Bando produzione 2026', titolo: 'Regione Emilia-Romagna — Bando per il sostegno alla produzione di opere cinematografiche e audiovisive, anno 2026 (PR FESR 2021-2027, Azione 1.3.4; L.R. 20/2014, art. 10)', url: 'https://fesr.regione.emilia-romagna.it/opportunita/opportunita-di-finanziamento/2026/sostegno-alla-produzione-di-opere-cinematografiche-e-audiovisive-anno-2026/presentazione-domanda/bando-e-modulistica/bando-fesr-cinema-2026.pdf/@@download/file' },
};

export const REGOLE = {
  taxCredit: {
    quadro: {
      testoVigente: {
        valore: 'D.I. 225/2024 come modificato dal D.I. 141/2025 e dal D.I. 281/2026', unita: 'testo', vigenteDal: '2026-09-24',
        descrizione: 'Decreto che regola il credito d’imposta per la produzione di opere di nazionalità italiana. Al 14 novembre 2026 è in vigore nella versione modificata dal D.I. 6 luglio 2026, n. 281; la sessione 2026 è stata aperta su questo testo.',
        fonte: 'DD2821', articolo: 'premesse («decreto tax credit produzione»)',
        nota: 'La pagina normativa della DGCA elenca, in ordine, il D.I. 225/2024, il D.I. 141/2025, il D.I. 281/2026 e il testo consolidato del 19 ottobre 2026. Il consolidato dichiara di non avere valore giuridico: le modifiche del 2026 sono state riscontrate una per una sul D.I. 281 firmato.',
      },
      aliquotaMinimaLegge: {
        valore: 15, unita: 'pct', vigenteDal: '2025-01-01',
        descrizione: 'Aliquota minima del credito sul costo complessivo di produzione fissata dalla legge.',
        fonte: 'L220', articolo: 'art. 15, comma 1',
      },
      aliquotaMassimaLegge: {
        valore: 40, unita: 'pct', vigenteDal: '2025-01-01',
        descrizione: 'Aliquota massima del credito fissata dalla legge.',
        fonte: 'L220', articolo: 'art. 15, commi 1 e 2',
        nota: 'La legge consente fino al 40%; il decreto applicativo dal 2026 si ferma al 35% (vedi aliquotaMassimaDecreto).',
      },
      aliquotaMassimaDecreto: {
        valore: 35, unita: 'pct', vigenteDal: '2026-09-24',
        descrizione: 'Aliquota massima riconosciuta dal decreto applicativo («non inferiore al 15 per cento e non superiore al 35 per cento del costo complessivo di produzione»).',
        fonte: 'CONS', articolo: 'art. 2, comma 1 (modificato dal D.I. 281/2026, art. 1, lett. b)',
      },
      beneficiari: {
        valore: 'produttori indipendenti originari', unita: 'testo', vigenteDal: '2024-07-10',
        descrizione: 'Sono ammessi i produttori indipendenti originari; fanno eccezione i produttori non indipendenti e le imprese non europee per i soli film (art. 13, comma 3) e i produttori di videoclip (art. 30).',
        fonte: 'CONS', articolo: 'art. 2, comma 2',
      },
      risorse2026: {
        valore: { totaleArt15: 220000000, opereCinematografiche: 80000000, opereTvWeb: 130000000, videogiochi: 10000000 }, unita: 'euro', vigenteDal: '2026-03-05',
        descrizione: 'Risorse 2026 per il credito d’imposta alla produzione (art. 15 L. 220/2016), su 441 milioni destinati a tutti i crediti d’imposta del settore.',
        fonte: 'DM101', articolo: 'art. 2, comma 1, lett. a)',
        nota: 'Per il solo 2026 i limiti di spesa degli artt. 15 e 19 possono essere aumentati entro il tetto complessivo del Fondo (D.L. 200/2025, art. 8, comma 5-bis, citato nelle premesse del D.I. 281/2026).',
      },
      tettoDiSpesa: {
        valore: true, unita: 'bool', vigenteDal: '2026-09-24',
        descrizione: 'I crediti teorici riconosciuti in ciascun anno non possono superare il limite di spesa fissato dal decreto di riparto. La DGCA riconosce i crediti secondo l’ordine della data di avvio delle riprese (per l’animazione: avvio delle lavorazioni); le richieste ammissibili oltre il limite sono dichiarate non finanziabili.',
        fonte: 'CONS', articolo: 'art. 6-bis, commi 1-3 (introdotto dal D.I. 281/2026)',
        nota: 'Nella sessione 2026 una domanda che non trova capienza per l’intero importo non riceve un riconoscimento parziale e può essere ripresentata nella prima sessione utile senza nuove spese istruttorie (D.D. 2821/2026, art. 2, commi 6 e 7). A parità di data di inizio riprese conta l’ordine cronologico di invio (art. 3, comma 3).',
      },
    },
    aliquote: {
      film: {
        valore: 30, unita: 'pct', vigenteDal: '2026-09-24',
        descrizione: 'Opere cinematografiche di finzione (durata superiore a 52 minuti) prodotte da produttori indipendenti: credito sul costo eleggibile di produzione.',
        fonte: 'CONS', articolo: 'art. 13, comma 1 (40% → 30% con D.I. 281/2026, art. 1, lett. l)',
      },
      filmImpresaElevataCapacita: {
        valore: [{ daEuro: 0, aEuro: 5000000, pct: 30 }, { daEuro: 5000000, aEuro: 10000000, pct: 25 }, { daEuro: 10000000, aEuro: null, pct: 20 }], unita: 'scaglioni_pct_su_costo_eleggibile', vigenteDal: '2026-09-24',
        descrizione: 'Film: impresa indipendente europea ad elevata capacità produttiva e finanziaria (art. 1, comma 3, lett. k, punti 1 e 3). Aliquota ridotta per scaglioni di costo eleggibile.',
        fonte: 'CONS', articolo: 'art. 13, comma 2',
        nota: 'La riduzione si applica alla sola parte di costo eleggibile che supera la soglia. Impresa ad elevata capacità: controllata o collegata a un fornitore di servizi di media audiovisivi, oppure con totale attivo e valore della produzione entrambi superiori a 100 milioni di euro (anche a livello di gruppo), oppure non europea.',
      },
      filmNonIndipendentiENonEuropei: {
        valore: 20, unita: 'pct', vigenteDal: '2026-09-24',
        descrizione: 'Film di nazionalità italiana prodotti da produttori non indipendenti o da imprese non europee.',
        fonte: 'CONS', articolo: 'art. 13, comma 3 (30% → 20%)',
        nota: 'Tetto di 3.000.000 euro l’anno per impresa o gruppo (vedi massimali) e plafond complessivo pari al 15% delle risorse annue per la produzione cinematografica.',
      },
      filmProduzioneAssociata: {
        valore: { quotaDirittiIndipendenteOltre50pct: 'aliquota dei produttori indipendenti (art. 13, comma 1)', quotaDirittiIndipendenteFinoA50pct: 'regime dei non indipendenti (art. 13, comma 3)' }, unita: 'regola', vigenteDal: '2024-07-10',
        descrizione: 'Film in produzione associata tra un indipendente e un non indipendente o non europeo: decide la quota dei diritti di utilizzazione economica detenuta dall’indipendente.',
        fonte: 'CONS', articolo: 'art. 13, commi 4 e 5',
      },
      tvWebBase: {
        valore: 20, unita: 'pct', vigenteDal: '2026-09-24',
        descrizione: 'Opere televisive e web di finzione: aliquota di base sul costo eleggibile.',
        fonte: 'CONS', articolo: 'art. 17, comma 1 (25% → 20%)',
      },
      tvWebMaggiorata: {
        valore: 30, unita: 'pct', vigenteDal: '2026-09-24',
        descrizione: 'Opere televisive e web: aliquota maggiorata, in alternativa, per (a) opera tv in coproduzione o produzione internazionale non meramente finanziaria; (b) apporto di risorse internazionali pari ad almeno il 30%; (c) preacquisto, acquisto o licenza di prodotto; (d) associazione produttiva in cui il produttore conserva i diritti indicati dal decreto.',
        fonte: 'CONS', articolo: 'art. 17, comma 1, lett. a)-d) (35% → 30%)',
        nota: 'Per la lett. b) non contano le risorse di fornitori di servizi media che rivolgono offerte al pubblico italiano né quelle di società estere del gruppo del richiedente.',
      },
      tvWebRiduzioneElevataCapacita: {
        valore: [{ daEuro: 10000000, aEuro: 20000000, riduzionePunti: 5 }, { daEuro: 20000000, aEuro: null, riduzionePunti: 10 }], unita: 'scaglioni_riduzione_punti', vigenteDal: '2026-09-24',
        descrizione: 'Tv e web: riduzione dell’aliquota per le imprese ad elevata capacità produttiva e finanziaria.',
        fonte: 'CONS', articolo: 'art. 17, comma 2 (tre → cinque punti)',
        nota: 'La riduzione si applica alla sola parte di costo eleggibile che supera la soglia. Cinque punti tra 10 e 20 milioni, altri cinque (dieci in tutto) oltre 20 milioni.',
      },
      documentari: {
        valore: 30, unita: 'pct', vigenteDal: '2026-09-24',
        descrizione: 'Documentari cinematografici, televisivi e web di durata superiore a 20 minuti.',
        fonte: 'CONS', articolo: 'art. 21, comma 2 (40% → 30%)',
      },
      documentariRiduzioneElevataCapacita: {
        valore: { seriali: [{ daEuro: 600000, aEuro: 800000, riduzionePunti: 5 }, { daEuro: 800000, aEuro: null, riduzionePunti: 10 }], nonSeriali: [{ daEuro: 330000, aEuro: 440000, riduzionePunti: 5 }, { daEuro: 440000, aEuro: null, riduzionePunti: 10 }] }, unita: 'scaglioni_riduzione_punti', vigenteDal: '2026-09-24',
        descrizione: 'Documentari: riduzione dell’aliquota per le imprese ad elevata capacità.',
        fonte: 'CONS', articolo: 'art. 21, comma 3',
        nota: 'La riduzione si applica alla sola parte di costo eleggibile che supera la soglia.',
      },
      animazione: {
        valore: 35, unita: 'pct', vigenteDal: '2026-09-24',
        descrizione: 'Opere di animazione cinematografiche, televisive e web di durata superiore a 20 minuti.',
        fonte: 'CONS', articolo: 'art. 24, comma 1 (40% → 35%)',
      },
      animazioneRiduzioneElevataCapacita: {
        valore: { seriali: [{ daEuro: 3900000, aEuro: 5200000, riduzionePunti: 5 }, { daEuro: 5200000, aEuro: null, riduzionePunti: 10 }], nonSeriali: [{ daEuro: 3000000, aEuro: 4200000, riduzionePunti: 5 }, { daEuro: 4200000, aEuro: null, riduzionePunti: 10 }] }, unita: 'scaglioni_riduzione_punti', vigenteDal: '2026-09-24',
        descrizione: 'Animazione: riduzione dell’aliquota per le imprese ad elevata capacità.',
        fonte: 'CONS', articolo: 'art. 24, comma 2',
        nota: 'La riduzione si applica alla sola parte di costo eleggibile che supera la soglia.',
      },
      cortometraggi: {
        valore: 30, unita: 'pct', vigenteDal: '2026-09-24',
        descrizione: 'Cortometraggi (durata fino a 20 minuti) con costo massimo eleggibile non superiore a 200.000 euro.',
        fonte: 'CONS', articolo: 'art. 28, comma 1 (40% → 30%); art. 27, comma 1',
      },
      videoclip: {
        valore: 30, unita: 'pct', vigenteDal: '2026-09-24',
        descrizione: 'Videoclip: credito fino a 80.000 euro per opera, con la sola richiesta definitiva.',
        fonte: 'CONS', articolo: 'art. 30, comma 2 (40% → 30%)',
      },
      aliquotePrecedenti: {
        valore: { film: 40, filmElevataCapacita: [40, 35, 30], filmNonIndipendenti: 30, tvWebBase: 25, tvWebMaggiorata: 35, documentari: 40, animazione: 40, cortometraggi: 40, videoclip: 40, riduzioneElevataCapacitaPunti: 3 }, unita: 'pct', vigenteDal: '2024-07-10', vigenteFinoAl: '2026-09-23', daVerificare: true, storico: true,
        descrizione: 'Aliquote del D.I. 225/2024 prima del D.I. 281/2026: servono a rileggere i piani finanziari chiusi sul vecchio testo.',
        fonte: 'DI281', articolo: 'art. 1 (testo sostituito)',
        nota: 'Storico. Il D.I. 281/2026 non contiene una norma transitoria espressa: non è scritto negli atti letti se le richieste definitive collegate a preventive già approvate conservino le vecchie aliquote. Da chiedere alla DGCA caso per caso.',
      },
    },
    base: {
      base: {
        valore: 'costo eleggibile di produzione', unita: 'testo', vigenteDal: '2024-07-10',
        descrizione: 'Il credito si calcola sul costo eleggibile (Tabella B del decreto), non sul costo complessivo. Per coproduzioni, compartecipazioni e produzioni internazionali vale la quota del produttore italiano.',
        fonte: 'CONS', articolo: 'art. 3, commi 1 e 4; art. 13, comma 1',
      },
      speseEleggibiliTerritorio: {
        valore: ['beni e servizi acquistati da persone fisiche e giuridiche fiscalmente residenti in Italia', 'beni e servizi di imprese con sede legale e domicilio fiscale in Italia o tassate in Italia (e, a condizioni di reciprocità, imprese SEE con stabile organizzazione in Italia)', 'persone fisiche non residenti ma tassate in Italia per lo specifico reddito', 'spese per protocolli di sostenibilità ambientale (Protocollo MiC-MASE del 10 gennaio 2024)'], unita: 'elenco', vigenteDal: '2026-09-24',
        descrizione: 'Spese che entrano nel costo eleggibile: in sostanza la spesa fatta in Italia o verso soggetti tassati in Italia.',
        fonte: 'CONS', articolo: 'art. 3, comma 3, lett. a), b), c), e)',
        nota: 'La lett. d) (spese per il protocollo COVID-19) è stata soppressa dal D.I. 281/2026. Le spese all’estero non sono eleggibili, salvo la deroga per i documentari (speseSeeDocumentariMaxPct).',
      },
      speseSeeDocumentariMaxPct: {
        valore: 20, unita: 'pct_costo_complessivo', vigenteDal: '2024-07-10',
        descrizione: 'Solo documentari: spese verso soggetti residenti in un altro Paese SEE eleggibili fino al 20% del costo complessivo, per esigenze artistiche o narrative comunicate e approvate prima dalla DGCA.',
        fonte: 'CONS', articolo: 'art. 21, comma 1',
      },
      speseNonUsateAltroveInCreditiEsteri: {
        valore: true, unita: 'bool', vigenteDal: '2024-07-10',
        descrizione: 'Sono ammissibili solo le spese che non sono utilizzate per ottenere crediti d’imposta di altri Stati.',
        fonte: 'CONS', articolo: 'art. 3, comma 7',
      },
      sopraLaLineaMaxPct: {
        valore: 25, unita: 'pct_costo_complessivo', vigenteDal: '2026-09-24',
        descrizione: 'Costi «sopra la linea» (soggetto e sceneggiatura, diritti di adattamento, compenso e altri costi del regista, attori principali: voci 1.1, 1.2, 2.1, 2.2, 3.1 della Tabella B) eleggibili al massimo per il 25% del costo complessivo di produzione.',
        fonte: 'CONS', articolo: 'art. 3, comma 2, lett. b); Tabella B, legenda (30% → 25% con D.I. 281/2026)',
        nota: 'Al lordo delle ritenute fiscali e al netto dei contributi previdenziali e degli oneri sociali.',
      },
      sopraLaLineaMaxPctOpereSotto3_5Milioni: {
        valore: 30, unita: 'pct_costo_complessivo', vigenteDal: '2026-09-24',
        descrizione: 'Per le opere con costo inferiore a 3.500.000 euro il limite dei costi sopra la linea resta al 30% del costo complessivo.',
        fonte: 'CONS', articolo: 'art. 3, comma 2, lett. b)',
      },
      sogliaCostoSopraLaLinea: {
        valore: 3500000, unita: 'euro', vigenteDal: '2026-09-24',
        descrizione: 'Soglia di costo sotto la quale il limite del sopra la linea è il 30% invece del 25%.',
        fonte: 'CONS', articolo: 'art. 3, comma 2, lett. b)',
      },
      oneriFinanziariAssicurativiGaranziaMaxPct: {
        valore: 7.5, unita: 'pct_costo_complessivo', vigenteDal: '2024-07-10',
        descrizione: 'Oneri finanziari, assicurativi (con le spese legali) e di garanzia: eleggibili fino al 7,5% complessivo del costo di produzione, se imputabili solo a quell’opera.',
        fonte: 'CONS', articolo: 'art. 3, comma 2, lett. a); Tabella B, voci 8.1-8.3',
      },
      producerFeeEleggibile: {
        valore: false, unita: 'bool', vigenteDal: '2024-07-10',
        descrizione: 'Il compenso per la produzione (producer fee) non è eleggibile.',
        fonte: 'CONS', articolo: 'art. 3, comma 2, lett. c); Tabella B, voce 7.3',
      },
      producerFeeMaxPctSulCostoComplessivo: {
        valore: 7.5, unita: 'pct_costo_complessivo', vigenteDal: '2024-07-10',
        descrizione: 'Il producer fee si può imputare al costo complessivo di produzione fino al 7,5% del costo stesso.',
        fonte: 'CONS', articolo: 'art. 3, comma 2, lett. c)',
      },
      speseGeneraliEleggibili: {
        valore: false, unita: 'bool', vigenteDal: '2024-07-10',
        descrizione: 'Le spese generali dell’impresa non sono eleggibili.',
        fonte: 'CONS', articolo: 'art. 3, comma 2, lett. c); Tabella B, voci 7.1, 7.2, 7.4, 7.5',
      },
      speseGeneraliMaxPctSulCostoComplessivo: {
        valore: 7.5, unita: 'pct_costo_complessivo', vigenteDal: '2024-07-10',
        descrizione: 'Le spese generali si possono imputare al costo complessivo fino al 7,5%. Nella Tabella B il tetto del 7,5% è comune alle voci spese generali, spese generali differite, imprevisti e altri deferrals e contributi in servizi.',
        fonte: 'CONS', articolo: 'art. 3, comma 2, lett. c); Tabella B, voci 7.1, 7.2, 7.4, 7.5, 7.6',
        nota: 'Producer fee e spese generali insieme pesano quindi al massimo il 15% del costo complessivo (così anche il D.D. 2541/2025, art. 4, comma 2).',
      },
      costoPersonaleMaggiorazioneMaxSuCcnlPct: {
        valore: 20, unita: 'pct', vigenteDal: '2024-07-10',
        descrizione: 'Il costo del personale regolato da contratti collettivi è eleggibile, per ciascun lavoratore, fino all’importo del contratto collettivo aumentato al massimo del 20%.',
        fonte: 'CONS', articolo: 'art. 3, comma 2, lett. d)',
        nota: 'Non si applica alle figure soggette al tetto del compenso individuale (regista, sceneggiatore, attore).',
      },
      tettoCompensoSingoloSoggetto: {
        valore: 'limite dell’art. 23-ter del D.L. 201/2011', unita: 'testo', vigenteDal: '2025-06-26', daVerificare: true,
        descrizione: 'Il credito riferibile al compenso di un singolo regista, sceneggiatore o attore, per ciascuna prestazione nella stessa opera, non può superare il limite retributivo dell’art. 23-ter del D.L. 201/2011; il limite scende all’80% per opere (anche seriali) di durata complessiva fino a 180 minuti.',
        fonte: 'DD2541', articolo: 'art. 3; D.I. 225/2024, art. 5, comma 3',
        nota: 'L’importo in euro del limite dell’art. 23-ter non è scritto negli atti letti: va preso dalla norma vigente.',
      },
      costiIntelligenzaArtificialeSopraLaLinea: {
        valore: false, unita: 'bool', vigenteDal: '2024-07-10',
        descrizione: 'Non sono eleggibili i costi di intelligenza artificiale riferibili alle prestazioni creative o artistiche sopra la linea, salvo gli effetti speciali legati alla voce «attori principali».',
        fonte: 'CONS', articolo: 'art. 3, comma 2, lett. b)',
      },
      speseIstruttorieEleggibili: {
        valore: false, unita: 'bool', vigenteDal: '2024-07-10',
        descrizione: 'Le spese istruttorie versate alla DGCA non sono costi eleggibili.',
        fonte: 'CONS', articolo: 'Tabella B, nota 7',
      },
      contrattiDiService: {
        valore: true, unita: 'bool', vigenteDal: '2024-07-10',
        descrizione: 'I costi dei contratti di service sono eleggibili solo se rispettano i requisiti territoriali, se la società affidataria ha sede legale in Italia e se non subappalta «a cascata»; vanno rendicontati prestazione per prestazione.',
        fonte: 'CONS', articolo: 'art. 3, comma 6; D.D. 2541/2025, art. 2',
      },
      produzioniAssociate: {
        valore: 'ciascun associato sulle spese sostenute direttamente', unita: 'testo', vigenteDal: '2024-07-10',
        descrizione: 'Nelle produzioni associate il credito spetta a ciascun produttore per le spese che ha sostenuto direttamente; i rimborsi di costi tra associati non contano.',
        fonte: 'CONS', articolo: 'art. 3, comma 5',
      },
      scostamentoMassimoConsuntivoSuPreventivoPct: {
        valore: 10, unita: 'pct', vigenteDal: '2024-07-10',
        descrizione: 'Se i costi eleggibili della richiesta definitiva superano di oltre il 10% quelli della richiesta preventiva, il credito è calcolato sui costi preventivi aumentati del 10% (e per i film previa verifica delle risorse).',
        fonte: 'CONS', articolo: 'art. 15, commi 7 e 8; art. 19, commi 5 e 6',
        nota: 'Deroga possibile per modifiche sostanziali della struttura produttiva o per eventi imprevedibili di carattere generale, su richiesta presentata con la definitiva.',
      },
      fictionTvWebCostoMinimoAlMinuto: {
        valore: 2000, unita: 'euro_al_minuto', vigenteDal: '2024-07-10',
        descrizione: 'Opere tv e web di finzione: durata complessiva non inferiore a 52 minuti e costo complessivo non inferiore a 2.000 euro al minuto (derogabile dal Direttore generale).',
        fonte: 'CONS', articolo: 'art. 16, comma 6',
      },
      cortometraggiCostoEleggibileMax: {
        valore: 200000, unita: 'euro', vigenteDal: '2024-07-10',
        descrizione: 'Cortometraggi: costo massimo eleggibile.',
        fonte: 'CONS', articolo: 'art. 27, comma 1',
      },
    },
    massimali: {
      perOperaCinema: {
        valore: 4000000, unita: 'euro', vigenteDal: '2026-09-24',
        descrizione: 'Tetto del credito per opera: film (Capo II), documentari cinematografici e animazione cinematografica.',
        fonte: 'CONS', articolo: 'art. 5, comma 1, lett. a), n. 1 (prima: 9.000.000)',
      },
      perImpresaAnnuoCinema: {
        valore: 7000000, unita: 'euro', vigenteDal: '2026-09-24',
        descrizione: 'Tetto annuo per impresa sui crediti per opere cinematografiche.',
        fonte: 'CONS', articolo: 'art. 5, comma 1, lett. a), n. 1',
        nota: 'Non si somma con i crediti della stessa impresa per opere tv e web: i due tetti annui sono separati.',
      },
      perOperaTvWeb: {
        valore: 7000000, unita: 'euro', vigenteDal: '2026-09-24',
        descrizione: 'Tetto del credito per opera: opere tv e web (Capo III), documentari tv e web, animazione tv e web.',
        fonte: 'CONS', articolo: 'art. 5, comma 1, lett. a), n. 2',
      },
      perImpresaAnnuoTvWeb: {
        valore: 15000000, unita: 'euro', vigenteDal: '2026-09-24',
        descrizione: 'Tetto annuo per impresa sui crediti per opere tv e web.',
        fonte: 'CONS', articolo: 'art. 5, comma 1, lett. a), n. 2',
      },
      sogliaRisorseEsterePct: {
        valore: 40, unita: 'pct_costo_complessivo', vigenteDal: '2026-09-24',
        descrizione: 'Quota minima di risorse provenienti da Paesi diversi dall’Italia, sulla copertura del costo complessivo, che fa scattare i tetti per opera più alti.',
        fonte: 'CONS', articolo: 'art. 5, comma 1, lett. b) (prima: 30%)',
      },
      perOperaCinemaConRisorseEstere: {
        valore: 6000000, unita: 'euro', vigenteDal: '2026-09-24',
        descrizione: 'Tetto per opera cinematografica con almeno il 40% di risorse estere.',
        fonte: 'CONS', articolo: 'art. 5, comma 1, lett. b) (prima: 18.000.000 per ogni tipo di opera)',
      },
      perOperaTvWebConRisorseEstere: {
        valore: 10000000, unita: 'euro', vigenteDal: '2026-09-24',
        descrizione: 'Tetto per opera tv o web con almeno il 40% di risorse estere.',
        fonte: 'CONS', articolo: 'art. 5, comma 1, lett. b)',
      },
      imputazioneConRisorseEstere: {
        valore: { cinemaPrimoEsercizio: 3000000, tvWebPrimoEsercizio: 5000000, eccedenzaInEserciziSuccessivi: 3 }, unita: 'euro', vigenteDal: '2026-09-24',
        descrizione: 'Con i tetti maggiorati il credito è imputato all’esercizio della richiesta preventiva fino a 3.000.000 (cinema) o 5.000.000 euro (tv e web); l’eccedenza in parti uguali nei tre esercizi successivi.',
        fonte: 'CONS', articolo: 'art. 5, comma 2',
      },
      videoclipPerOpera: {
        valore: 80000, unita: 'euro', vigenteDal: '2024-07-10',
        descrizione: 'Tetto del credito per ciascun videoclip.',
        fonte: 'CONS', articolo: 'art. 30, comma 2',
      },
      filmNonIndipendentiAnnuoPerImpresaOGruppo: {
        valore: 3000000, unita: 'euro', vigenteDal: '2026-09-24',
        descrizione: 'Film di produttori non indipendenti o non europei: tetto annuo per impresa o gruppo.',
        fonte: 'CONS', articolo: 'art. 13, comma 3 (prima: 5.000.000)',
      },
      filmNonIndipendentiPlafondSuRisorseAnnuePct: {
        valore: 15, unita: 'pct', vigenteDal: '2024-07-10',
        descrizione: 'Quota massima delle risorse annue per la produzione cinematografica destinabile ai non indipendenti e non europei.',
        fonte: 'CONS', articolo: 'art. 13, comma 3',
      },
      massimaliPrecedenti: {
        valore: { perOpera: 9000000, perOperaConRisorseEstereAlmeno30pct: 18000000 }, unita: 'euro', vigenteDal: '2024-07-10', vigenteFinoAl: '2026-09-23', daVerificare: true, storico: true,
        descrizione: 'Tetti in vigore prima del D.I. 281/2026.',
        fonte: 'CONS2025', articolo: 'art. 5, comma 1',
        nota: 'Storico: vale lo stesso dubbio sulla transizione segnalato per le aliquote precedenti.',
      },
    },
    requisiti: {
      nazionalitaItaliana: {
        valore: true, unita: 'bool', vigenteDal: '2024-07-10',
        descrizione: 'L’opera deve avere la nazionalità italiana (artt. 5 e 6 L. 220/2016): provvisoria per la richiesta preventiva, definitiva per quella definitiva.',
        fonte: 'CONS', articolo: 'art. 2, comma 5; art. 6, comma 1; art. 14, comma 2; art. 15, comma 1',
      },
      eleggibilitaCulturalePunteggioMinimo: {
        valore: 50, unita: 'punti_su_100', vigenteDal: '2024-07-10',
        descrizione: 'Punteggio minimo nel test di eleggibilità culturale (Tabella A: 70 punti contenuti, 30 punti produzione).',
        fonte: 'CONS', articolo: 'Tabella A',
      },
      formaGiuridica: {
        valore: 'società di capitali', unita: 'testo', vigenteDal: '2024-07-10',
        descrizione: 'Il richiedente deve essere una società di capitali, diversa da associazioni culturali e fondazioni senza scopo di lucro.',
        fonte: 'CONS', articolo: 'art. 2, comma 4, lett. c) e d)',
      },
      capitaleSocialeEPatrimonioNettoMin: {
        valore: 40000, unita: 'euro', vigenteDal: '2024-07-10',
        descrizione: 'Capitale sociale minimo interamente versato e patrimonio netto, entrambi non inferiori a 40.000 euro.',
        fonte: 'CONS', articolo: 'art. 2, comma 4, lett. c)',
      },
      capitaleSocialeEPatrimonioNettoMinCortometraggi: {
        valore: 10000, unita: 'euro', vigenteDal: '2024-07-10',
        descrizione: 'Per i cortometraggi il minimo di capitale e patrimonio netto scende a 10.000 euro.',
        fonte: 'CONS', articolo: 'art. 2, comma 4, lett. c)',
      },
      sedeETassazione: {
        valore: 'sede legale nello Spazio Economico Europeo e tassazione in Italia', unita: 'testo', vigenteDal: '2024-07-10',
        descrizione: 'Sede legale nel SEE e assoggettamento a tassazione in Italia per residenza fiscale o stabile organizzazione cui sia riconducibile l’opera.',
        fonte: 'CONS', articolo: 'art. 2, comma 4, lett. a) e b)',
      },
      polizzaCatastrofale: {
        valore: true, unita: 'bool', vigenteDal: '2026-09-24',
        descrizione: 'A pena di inammissibilità l’impresa deve avere un contratto assicurativo contro i danni da calamità naturali ed eventi catastrofali sui beni dell’attivo (art. 1, commi 101-102, L. 213/2023).',
        fonte: 'CONS', articolo: 'art. 7, comma 11 (introdotto dal D.I. 281/2026); D.D. 2821/2026, art. 4, lett. a)',
      },
      coperturaFinanziariaMinimaPct: {
        valore: { film: 40, tvWeb: 50, documentari: 30, animazione: 30, cortometraggi: 30, videoclip: 40 }, unita: 'pct_costo_di_produzione', vigenteDal: '2025-04-22',
        descrizione: 'Copertura finanziaria minima da comprovare alla domanda. Il credito d’imposta richiesto non conta.',
        fonte: 'CONS', articolo: 'art. 12, c. 1, lett. a); art. 16, c. 1, lett. a); art. 20, c. 1, lett. a); art. 23, c. 1, lett. a); art. 27, c. 1, lett. a); art. 30, c. 1, lett. a)',
        nota: 'Dal D.I. 141/2025 non è più richiesto che le risorse siano «di origine privata». Per le imprese non ad elevata capacità la percentuale si misura sul costo complessivo, che comprende producer fee e spese generali fino al 15% (D.D. 2541/2025, art. 4, comma 2). Non si applica alle opere che entrano con un contributo selettivo o sovranazionale (per tv, documentari, animazione e corti) e alle richieste solo definitive su opere già completate (D.D. 2821/2026, art. 4, lett. c).',
      },
      fontiAmmesseACopertura: {
        valore: ['apporto diretto del produttore (lettera bancaria recente o estratto conto)', 'apporto di produttori associati, anche fornitori di servizi media (contratto)', 'sponsor, associazione in partecipazione, product placement (contratti)', 'prevendite e vendite di diritti, accordi con fornitori di servizi media, minimi garantiti dei distributori (contratti)', 'altri proventi riferiti alla stessa opera: contributi selettivi, contributi regionali, reinvestimento autorizzato di contributi automatici', 'deferrals non relativi ad autori o persone fisiche (con documentazione del differimento)'], unita: 'elenco', vigenteDal: '2025-06-26',
        descrizione: 'Fonti che concorrono alla copertura finanziaria minima.',
        fonte: 'DD2541', articolo: 'art. 4, comma 3',
      },
      partecipazioneMinimaDelProduttore: {
        valore: 'almeno pari al credito d’imposta riconosciuto', unita: 'testo', vigenteDal: '2024-07-10',
        descrizione: 'Il produttore indipendente originario deve partecipare alla copertura del costo complessivo dell’opera in misura almeno pari al credito riconosciuto e conservare, pro quota, la piena disponibilità dei diritti di elaborazione creativa.',
        fonte: 'CONS', articolo: 'art. 12, comma 4; art. 16, comma 4; art. 20, comma 4; art. 23, comma 4; art. 27, comma 5',
      },
      filmDurataMinima: {
        valore: 52, unita: 'minuti', vigenteDal: '2025-04-22',
        descrizione: 'I film ammessi al Capo II sono opere di finzione di durata superiore a 52 minuti.',
        fonte: 'CONS', articolo: 'art. 12, comma 1',
      },
      filmAccordoDistribuzione: {
        valore: { sogliaCostoEuro: 3500000, costoOltreSoglia: { investimentoPromozioneMinEuro: 300000, entroSettimane: 2, proiezioniMin: 600, saleMin: 80, fasciaOraria: '18:30-21:30' }, costoFinoASoglia: { investimentoPromozioneMinEuro: 90000, entroSettimane: 6, proiezioniMin: 300, saleMin: 30, fasciaOraria: null } }, unita: 'regola', vigenteDal: '2026-09-24',
        descrizione: 'Film: accordo vincolante con una società di distribuzione cinematografica, presentato e verificato con la richiesta definitiva, con piano di promozione e numero minimo di proiezioni e sale dalla prima uscita.',
        fonte: 'CONS', articolo: 'art. 12, comma 1, lett. b) (modificato dai D.I. 141/2025 e 281/2026)',
        nota: 'Per le opere fino a 3,5 milioni il D.I. 281/2026 ha portato il termine da due a sei settimane e le sale da 50 a 30. Non è più richiesta una «primaria» società di distribuzione.',
      },
      filmViaAlternativaConContributi: {
        valore: { contributi: ['contributo selettivo alla produzione (artt. 26 e 27 L. 220/2016) su bandi pubblicati dopo il 1° gennaio 2024', 'contributo di organismi sovranazionali (programmi del Consiglio d’Europa e dell’Unione europea)'], costoOltre3_5Milioni: { investimentoPromozioneMinEuro: 200000, entroSettimane: 2, proiezioniMin: 300, saleMin: 50, fasciaOraria: '18:30-21:30' }, costoFinoA3_5Milioni: { proiezioniMin: 240, arcoMesi: 3, sale: 'numero non inferiore a quello del decreto sulla destinazione cinematografica' }, costoSotto1_5Milioni: 'in alternativa: partecipazione a festival di rilevanza internazionale indicati dalla DGCA più un contratto con un fornitore di servizi media' }, unita: 'regola', vigenteDal: '2025-04-22',
        descrizione: 'Film ammessi in alternativa perché destinatari di un contributo selettivo o sovranazionale: requisiti di circuitazione ridotti; non serve la copertura minima del 40%.',
        fonte: 'CONS', articolo: 'art. 12, comma 2',
      },
      tvWebAccordoDiffusione: {
        valore: { controparte: 'emittente televisiva nazionale oppure fornitore di servizi a richiesta (diritti SVOD a condizioni di mercato) con fatturato di almeno 5.000.000 euro in Italia', apportoMinimoDelFornitorePctCostoComplessivo: 20 }, unita: 'regola', vigenteDal: '2024-07-10',
        descrizione: 'Tv e web: accordo con un’emittente nazionale o una piattaforma; il fornitore partecipa (associazione produttiva) o paga un corrispettivo (preacquisto, acquisto, licenza) pari ad almeno il 20% del costo complessivo.',
        fonte: 'CONS', articolo: 'art. 16, commi 1 e 2',
        nota: 'La stessa soglia del 20% vale per documentari, animazione e cortometraggi diffusi tramite fornitori di servizi media (artt. 20, 23 e 27, comma 2).',
      },
      speseIstruttorieEuro: {
        valore: { cortometraggi: 200, videoclip: 200, cessioneDelCredito: 200, idoneita: 400, filmGiovaniAutori: 800, documentari: 800, filmOperePrimeESeconde: 1000, animazione: 3000, filmAltriCostoFinoA3_5Milioni: 5000, tvWebCostoFinoA3_5Milioni: 5000, filmAltriCostoOltre3_5Milioni: 10000, tvWebCostoOltre3_5Milioni: 10000 }, unita: 'euro', vigenteDal: '2026-09-17',
        descrizione: 'Contributo per le spese istruttorie da versare con la domanda (PagOnline), a pena di inammissibilità; non si restituisce se la domanda non va a buon fine.',
        fonte: 'DD3362', articolo: 'Tabella 1; artt. 1, 2 e 4',
        nota: 'Se il costo dichiarato nella definitiva sale di scaglione va versata la differenza (art. 1, comma 4).',
      },
    },
    tempi: {
      preventivaNonPrimaDiGiorni: {
        valore: 60, unita: 'giorni', vigenteDal: '2026-09-24',
        descrizione: 'La richiesta preventiva non può essere presentata prima di 60 giorni antecedenti la data di avvio di quattro settimane consecutive di riprese o, in alternativa, del 50% delle giornate di ripresa (film, tv e web). Per documentari e cortometraggi: 60 giorni prima della data di avvio del 50% delle giornate di ripresa; per l’animazione: del 50% delle giornate di lavorazione o di quattro settimane consecutive.',
        fonte: 'CONS', articolo: 'art. 14, comma 1; art. 18, comma 1; art. 22, comma 1; art. 25, comma 1; art. 29, comma 1',
      },
      comprovaAvvioRipreseEntroGiorni: {
        valore: 120, unita: 'giorni', vigenteDal: '2025-06-26',
        descrizione: 'La documentazione che prova l’avvio e la prosecuzione delle riprese (UNILAV, certificato di agibilità e altro) va presentata con la richiesta o al massimo entro 120 giorni dall’invio.',
        fonte: 'DD2541', articolo: 'art. 6, comma 1, lett. i)',
      },
      rispostaDgcaGiorni: {
        valore: 60, unita: 'giorni', vigenteDal: '2024-07-10',
        descrizione: 'La DGCA comunica l’eleggibilità culturale e il credito teorico (preventiva) o il credito definitivo entro 60 giorni dalla domanda o dal termine della sessione, e comunque non prima del riconoscimento della nazionalità.',
        fonte: 'CONS', articolo: 'art. 14, comma 4; art. 15, comma 5; art. 18, comma 4; art. 19, comma 5',
      },
      definitivaFilmEntroGiorni: {
        valore: 180, unita: 'giorni', vigenteDal: '2025-04-22',
        descrizione: 'Film: richiesta definitiva dopo la domanda di nazionalità definitiva e non oltre 180 giorni dalla conferma della classificazione dell’opera o dalla prima diffusione al pubblico.',
        fonte: 'CONS', articolo: 'art. 15, comma 1, lett. a) e b)',
      },
      definitivaFilmEntroMesiDallaPreventiva: {
        valore: 24, unita: 'mesi', vigenteDal: '2024-07-10',
        descrizione: 'Film: la definitiva va presentata entro 24 mesi dalla richiesta preventiva.',
        fonte: 'CONS', articolo: 'art. 15, comma 1, lett. c)',
      },
      definitivaTvWebEntroGiorniDallaCopiaCampione: {
        valore: 180, unita: 'giorni', vigenteDal: '2024-07-10',
        descrizione: 'Tv e web: definitiva non oltre 180 giorni dalla consegna della copia campione alla DGCA.',
        fonte: 'CONS', articolo: 'art. 19, comma 1, lett. b)',
      },
      definitivaTvWebEntroMesiDallaPreventiva: {
        valore: 24, unita: 'mesi', vigenteDal: '2026-09-24',
        descrizione: 'Tv e web: definitiva entro 24 mesi dalla richiesta preventiva.',
        fonte: 'CONS', articolo: 'art. 19, comma 1, lett. c) (18 → 24 mesi con D.I. 281/2026)',
      },
      animazioneMesiAggiuntivi: {
        valore: 12, unita: 'mesi', vigenteDal: '2024-07-10', daVerificare: true,
        descrizione: 'Animazione: i termini in mesi per la definitiva sono aumentati di 12 mesi.',
        fonte: 'CONS', articolo: 'art. 26, comma 2',
        nota: 'Il comma cita ancora il termine di «diciotto mesi» dell’art. 19, che il D.I. 281/2026 ha portato a 24: il coordinamento tra i due articoli non è stato fatto nel testo.',
      },
      videoclipDefinitivaEntroGiorni: {
        valore: 180, unita: 'giorni', vigenteDal: '2024-07-10',
        descrizione: 'Videoclip: sola richiesta definitiva, entro 180 giorni dalla prima diffusione.',
        fonte: 'CONS', articolo: 'art. 31, comma 1',
      },
      sessione2026: {
        valore: { dal: '2026-09-30T10:00', al: '2026-10-14T23:59' }, unita: 'finestra', vigenteDal: '2026-09-24',
        descrizione: 'Unica finestra 2026 per richieste preventive e definitive in assenza di preventiva (film, tv e web, documentari, animazione, cortometraggi, videoclip).',
        fonte: 'DD2821', articolo: 'art. 2, comma 1',
        nota: 'Finestra chiusa al 14 novembre 2026. La DGCA comunica i crediti entro 60 giorni dalla chiusura (D.I. 225/2024, art. 14, comma 4). Il 30 ottobre 2026 sono stati pubblicati decreti di riconoscimento di crediti d’imposta, ma l’avviso letto non dice a quale sessione si riferiscano.',
      },
      prossimaSessione: {
        valore: null, unita: 'finestra', daVerificare: true,
        descrizione: 'Date della prossima sessione (2027).',
        fonte: 'CONS', articolo: 'art. 6-bis, comma 2; art. 32, comma 2',
        nota: 'Non ancora pubblicate: ogni anno le fissa un decreto direttoriale. Controllare la pagina avvisi della DGCA.',
      },
      subentroProduttoreGiorni: {
        valore: 30, unita: 'giorni', vigenteDal: '2024-07-10',
        descrizione: 'In caso di subentro, il nuovo produttore presenta le proprie richieste preventive entro 30 giorni dal subentro, a pena di decadenza.',
        fonte: 'CONS', articolo: 'art. 9, comma 3',
      },
    },
    utilizzo: {
      modalitaDiUtilizzo: {
        valore: 'solo in compensazione con modello F24 tramite i servizi telematici dell’Agenzia delle entrate', unita: 'testo', vigenteDal: '2024-07-10',
        descrizione: 'Il credito non è denaro: riduce imposte e contributi dovuti dal produttore. Si usa a partire dal giorno 15 del mese successivo al riconoscimento e mai oltre l’importo concesso.',
        fonte: 'CONS', articolo: 'art. 34, commi 1 e 2; L. 220/2016, art. 21, comma 2',
      },
      quotaUtilizzabileDopoPreventivaPct: {
        valore: 70, unita: 'pct', vigenteDal: '2024-07-10',
        descrizione: 'Quota del credito utilizzabile dopo l’approvazione della richiesta preventiva; il resto dopo l’approvazione della definitiva.',
        fonte: 'CONS', articolo: 'art. 6, comma 5, lett. a); D.D. 2821/2026, art. 3, comma 2',
      },
      quotaUtilizzabileDopoPreventivaElevataCapacitaPct: {
        valore: 40, unita: 'pct', vigenteDal: '2024-07-10',
        descrizione: 'La quota del 70% scende al 40% per le imprese ad elevata capacità produttiva e finanziaria o per quelle che lo chiedono.',
        fonte: 'CONS', articolo: 'art. 6, comma 5, lett. a)',
      },
      quotaUtilizzabileConSolaDefinitivaPct: {
        valore: 100, unita: 'pct', vigenteDal: '2024-07-10',
        descrizione: 'Con la sola richiesta definitiva il credito approvato è utilizzabile per intero.',
        fonte: 'CONS', articolo: 'art. 6, comma 5, lett. b)',
      },
      esercizioDiImputazione: {
        valore: 'esercizio fiscale di presentazione della richiesta preventiva', unita: 'testo', vigenteDal: '2026-09-24',
        descrizione: 'I crediti entro i tetti ordinari sono imputati all’esercizio in cui è presentata la richiesta preventiva.',
        fonte: 'CONS', articolo: 'art. 5, comma 2',
      },
      rilevanzaFiscale: {
        valore: false, unita: 'bool', vigenteDal: '2026-01-01',
        descrizione: 'Il credito non concorre al reddito imponibile né al valore della produzione ai fini IRAP e non rileva per gli artt. 96 e 109, comma 5, del TUIR; non si applica il limite annuo dell’art. 1, comma 53, L. 244/2007.',
        fonte: 'L220', articolo: 'art. 21, commi 2 e 3', url: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2016-11-14;220~art21',
      },
      cedibile: {
        valore: true, unita: 'bool', vigenteDal: '2024-07-10',
        descrizione: 'Sono cedibili solo i crediti approvati in via definitiva, a banche (compreso l’Istituto per il credito sportivo), intermediari finanziari e assicurativi vigilati. Il cessionario può usarli solo in compensazione.',
        fonte: 'CONS', articolo: 'art. 8, commi 1-3; L. 220/2016, art. 21, comma 4',
        nota: 'Conseguenza per il piano di cassa: la quota del 70% dopo la preventiva non si può cedere; si può solo compensare o farsi finanziare da una banca.',
      },
      cessioneProcedura: {
        valore: { domandaAllaDgca: true, contrattoInFormaPubblica: true, attestazioneDgcaEntroGiorni: 60, speseIstruttorieEuro: 200 }, unita: 'regola', vigenteDal: '2024-07-10',
        descrizione: 'Per cedere il credito serve una domanda alla DGCA con il contratto di cessione in forma pubblica; la DGCA attesta l’effettività del credito entro 60 giorni e poi accetta la cessione comunicata dal cedente.',
        fonte: 'CONS', articolo: 'art. 8, commi 3-5; D.D. 3362/2024, Tabella 1',
        nota: 'Il recupero di un credito indebito resta in capo al cedente; il cessionario risponde per l’uso irregolare o in misura maggiore e in solido se concorre nella violazione (art. 8, commi 2 e 6). La DGCA può chiedere una perizia di congruità dei costi anche ai fini della cessione (D.D. 2541/2025, art. 10, comma 2).',
      },
    },
    obblighi: {
      reinvestimentoEntroAnni: {
        valore: 5, unita: 'anni', vigenteDal: '2025-04-22',
        descrizione: 'Il beneficiario deve reinvestire una quota dei proventi dell’opera, in proporzione al contributo riconosciuto e fino a concorrenza dello stesso, solo dopo aver coperto i costi dell’opera, entro cinque anni dal riconoscimento definitivo del credito, in sviluppo, produzione o distribuzione di nuove opere difficili.',
        fonte: 'CONS', articolo: 'art. 7, commi 9 e 10 (introdotti dal D.I. 141/2025)',
        nota: 'Chi non reinveste non può chiedere il credito per altre opere per cinque anni (art. 36, comma 9). Le modalità di dettaglio sono rinviate a un decreto direttoriale.',
      },
      coperturaAssicurativaDiProduzione: {
        valore: ['danni al supporto e difetti di trattamento (faulty stock)', 'interruzione della lavorazione (cast insurance)', 'fermo tecnico (extra expense)', 'infortuni di troupe e attori', 'responsabilità civile generale e dipendenti'], unita: 'elenco', vigenteDal: '2024-07-10',
        descrizione: 'Coperture assicurative da prevedere per l’opera, in presenza di concrete condizioni di rischio, a pena di decadenza.',
        fonte: 'CONS', articolo: 'art. 7, comma 3',
      },
      accessibilita: {
        valore: true, unita: 'bool', vigenteDal: '2024-07-10',
        descrizione: 'Film, opere tv e web devono essere fruibili dalle persone con disabilità (sottotitoli e audiodescrizione), a pena di inammissibilità o decadenza.',
        fonte: 'CONS', articolo: 'art. 7, comma 4',
      },
      logoMinistero: {
        valore: true, unita: 'bool', vigenteDal: '2024-07-10',
        descrizione: 'Logo e nome del Ministero della cultura nei titoli e nei materiali promozionali, con lo stesso rilievo del produttore, a pena di decadenza.',
        fonte: 'CONS', articolo: 'art. 7, comma 7',
      },
      depositoCineteca: {
        valore: true, unita: 'bool', vigenteDal: '2024-07-10',
        descrizione: 'Deposito di una copia dell’opera presso la Cineteca nazionale: il mancato deposito fa decadere dal beneficio.',
        fonte: 'CONS', articolo: 'art. 7, comma 8',
      },
      causeDiDecadenzaORevoca: {
        valore: ['mancato riconoscimento della nazionalità italiana definitiva', 'mancato riconoscimento o perdita dell’eleggibilità culturale', 'mancato rispetto dei requisiti e degli adempimenti dei singoli Capi', 'subentro di un altro produttore'], unita: 'elenco', vigenteDal: '2026-09-24',
        descrizione: 'Casi in cui il credito decade o è revocato, con recupero di quanto già fruito più interessi e sanzioni.',
        fonte: 'CONS', articolo: 'art. 9',
      },
      certificazioneDeiCosti: {
        valore: true, unita: 'bool', vigenteDal: '2024-07-10',
        descrizione: 'La richiesta definitiva deve contenere la certificazione di effettività e stretta inerenza dei costi eleggibili, firmata digitalmente da un revisore registrato sulla piattaforma DGCOL; il costo è a carico del produttore. La DGCA può rideterminare il costo eleggibile se lo giudica non congruo.',
        fonte: 'CONS', articolo: 'art. 11; D.D. 2821/2026, art. 3, comma 1',
      },
    },
  },
  internazionale: {
    aliquota: {
      valore: 40, unita: 'pct', vigenteDal: '2024-10-04',
      descrizione: 'Credito sul costo eleggibile di produzione della singola opera (Tabella B del decreto), sostenuto in Italia.',
      fonte: 'DI329', articolo: 'art. 3, comma 1',
    },
    aliquotaSopraLaLineaNonSee: {
      valore: 30, unita: 'pct', vigenteDal: '2024-10-04',
      descrizione: 'Aliquota ridotta per i costi sopra la linea riferiti a persone fisiche non fiscalmente residenti in un Paese dello Spazio Economico Europeo.',
      fonte: 'DI329', articolo: 'art. 3, comma 2',
    },
    costoEleggibileMinimo: {
      valore: 250000, unita: 'euro', vigenteDal: '2024-10-04',
      descrizione: 'Il beneficio spetta se il costo eleggibile è almeno pari a 250.000 euro.',
      fonte: 'DI329', articolo: 'art. 3, comma 4',
    },
    massimaleAnnuoPerImpresaOGruppo: {
      valore: 20000000, unita: 'euro', vigenteDal: '2024-10-04',
      descrizione: 'Tetto annuo del credito per impresa o gruppo di imprese.',
      fonte: 'DI329', articolo: 'art. 3, comma 5',
      nota: 'Il credito per opere italiane (art. 15) fruito dalla stessa impresa non si somma per il raggiungimento di questo tetto (art. 3, comma 3).',
    },
  },
  aiuti: {
    limiteGeneralePct: {
      valore: 50, unita: 'pct_costo_opera', vigenteDal: '2014-07-01',
      descrizione: 'Tutti gli aiuti pubblici a un’opera (credito d’imposta, contributi statali, regionali, europei gestiti dagli Stati) non possono superare insieme il 50% del costo dell’opera.',
      fonte: 'GBER', articolo: 'art. 54, par. 6',
      nota: 'Ripreso da D.I. 225/2024, art. 4, comma 1; D.I. 329/2024, art. 5, comma 5; bando selettivi 2026, art. 4, comma 1; D.M. 265/2026, art. 16, comma 1.',
    },
    produzioniTransfrontalierePct: {
      valore: 60, unita: 'pct_costo_opera', vigenteDal: '2014-07-01',
      descrizione: 'Limite elevato al 60% per le produzioni transfrontaliere finanziate da più di uno Stato membro e con produttori di più di uno Stato membro.',
      fonte: 'GBER', articolo: 'art. 54, par. 7, lett. a)',
      nota: 'Ripreso da D.I. 225/2024, art. 4, comma 1.',
    },
    opereDifficiliLimiteUePct: {
      valore: 100, unita: 'pct_costo_opera', vigenteDal: '2014-07-01',
      descrizione: 'Limite massimo europeo per le opere audiovisive difficili e per le coproduzioni con Paesi dell’elenco DAC dell’OCSE.',
      fonte: 'GBER', articolo: 'art. 54, par. 7, lett. b); art. 2, punto 140',
      nota: 'Sono gli Stati a definire le opere difficili con criteri prestabiliti (cortometraggi, opere prime e seconde, documentari, film a basso costo, opere commercialmente difficili).',
    },
    opereDifficiliLimiteItaliaPct: {
      valore: 80, unita: 'pct_costo_complessivo', vigenteDal: '2024-07-10',
      descrizione: 'In Italia il limite per le opere difficili è l’80% del costo complessivo.',
      fonte: 'CONS', articolo: 'art. 4, comma 3',
      nota: 'Stesso limite nel bando selettivi 2026, art. 4, comma 3.',
    },
    coproduzioniConPaesiDacPct: {
      valore: 100, unita: 'pct_costo_complessivo', vigenteDal: '2024-07-10',
      descrizione: 'Limite elevato al 100% per le coproduzioni cui partecipano Paesi dell’elenco DAC dell’OCSE.',
      fonte: 'CONS', articolo: 'art. 4, comma 2',
    },
    opereDifficiliDefinizioniItaliane: {
      valore: [{ id: 'oggettive', automatica: true, tipologie: ['documentari', 'opere prime', 'opere seconde', 'opere di giovani autori', 'cortometraggi'], costoMassimoEuro: { default: 3500000, documentari: 1000000, cortometraggi: 200000 }, descrizione: 'Opere di queste tipologie con costo di produzione inferiore alla soglia: la qualifica è attribuita d’ufficio.' }, { id: 'animazione', automatica: false, descrizione: 'Opere di animazione dichiarate dagli esperti dell’art. 26, comma 2, L. 220/2016 non in grado di attrarre risorse finanziarie significative dal settore privato.' }, { id: 'selettivi', automatica: false, descrizione: 'Opere che hanno ottenuto i contributi selettivi dell’art. 26 e sono state dichiarate dagli esperti non in grado di attrarre risorse private significative.' }, { id: 'filmBassoBudget', automatica: false, costoMassimoEuro: { default: 3500000 }, descrizione: 'Film con costo di produzione inferiore a 3.500.000 euro dichiarati dagli esperti non in grado di attrarre risorse private significative.' }, { id: 'filmDistribuzioneLimitata', automatica: false, schermiAttiviMaxPct: 20, descrizione: 'Film distribuiti in meno del 20% degli schermi attivi e dichiarati dagli esperti non in grado di attrarre risorse private significative.' }], unita: 'elenco', vigenteDal: '2025-04-22',
      descrizione: 'Categorie italiane di «opere difficili» che danno accesso al limite dell’80%.',
      fonte: 'CONS', articolo: 'art. 4, comma 3, lett. a)-e); art. 1, comma 2, lett. i), j), k), l), n)',
      nota: 'Definizioni utili: opera prima = regista senza lungometraggi distribuiti in sala; opera seconda = al massimo uno; giovani autori = regista sotto i 35 anni alla prima richiesta e sotto i 35 anche almeno una tra le figure di sceneggiatore, autore della fotografia, delle musiche originali, della scenografia; cortometraggio = fino a 20 minuti. La pagina DGCA «Qualifica opera difficile» conferma che i requisiti oggettivi valgono d’ufficio e che la qualifica si dichiara nell’anagrafica dell’opera su DGCOL.',
    },
    sviluppoEPreproduzioneLimiteUePct: {
      valore: 100, unita: 'pct_costi_ammissibili', vigenteDal: '2014-07-01',
      descrizione: 'Aiuti alla sceneggiatura e allo sviluppo: fino al 100% dei costi; se l’opera viene realizzata, questi costi entrano nel bilancio totale e nel calcolo dell’intensità.',
      fonte: 'GBER', articolo: 'art. 54, par. 8',
    },
    sviluppoLimiteBandoSelettiviPct: {
      valore: 80, unita: 'pct_costi_di_sviluppo', vigenteDal: '2026-05-15',
      descrizione: 'Bando selettivi MiC 2026: l’aiuto pubblico complessivo ai progetti di sviluppo non supera l’80% dei costi totali di sviluppo.',
      fonte: 'SEL26', articolo: 'art. 4, comma 4',
    },
    baseDelCalcolo: {
      valore: 'costo complessivo dell’opera (per le coproduzioni: quota del produttore italiano)', unita: 'testo', vigenteDal: '2024-07-10',
      descrizione: 'L’intensità si misura sul costo complessivo dell’opera, non sul costo eleggibile del singolo aiuto. Nelle coproduzioni internazionali le regole sul costo si riferiscono alla quota italiana, salvo il limite per le opere difficili.',
      fonte: 'CONS', articolo: 'art. 4, comma 1; art. 3, comma 4',
    },
    cumuloRegola: {
      valore: 'si sommano tutti gli aiuti di Stato a favore della stessa opera', unita: 'testo', vigenteDal: '2014-07-01',
      descrizione: 'Per verificare le intensità massime conta l’importo totale degli aiuti di Stato all’attività, al progetto o all’impresa. I fondi dell’Unione gestiti direttamente dalle istituzioni europee non si contano come aiuti di Stato.',
      fonte: 'GBER', articolo: 'art. 8, par. 1-3',
      nota: 'Prima di pagare un contributo la DGCA controlla il Registro nazionale degli aiuti e la clausola «Deggendorf» (bando selettivi 2026, art. 4, comma 5).',
    },
    territorializzazioneMaxPctDellAiuto: {
      valore: 160, unita: 'pct_dell_aiuto', vigenteDal: '2014-07-01',
      descrizione: 'Un regime può imporre che fino al 160% dell’aiuto concesso sia speso nel territorio che lo concede.',
      fonte: 'GBER', articolo: 'art. 54, par. 4, lett. a)',
    },
    territorializzazioneMaxPctDelBilancio: {
      valore: 80, unita: 'pct_bilancio_di_produzione',
      descrizione: 'In ogni caso la spesa soggetta a obblighi territoriali non può superare l’80% del bilancio totale di produzione.',
      fonte: 'GBER', articolo: 'art. 54, par. 4, secondo comma',
      nota: 'Comma aggiunto da una modifica successiva al testo del 2014 (sigla M1 nel consolidato; data non letta). Vale anche quando l’aiuto è calcolato come percentuale della spesa locale (incentivi fiscali).',
    },
    attivitaMinimaSulTerritorioMaxPctDelBilancio: {
      valore: 50, unita: 'pct_bilancio_di_produzione',
      descrizione: 'Il livello minimo di attività di produzione sul territorio richiesto per l’ammissibilità non può superare il 50% del bilancio totale di produzione.',
      fonte: 'GBER', articolo: 'art. 54, par. 4, terzo comma',
      nota: 'Comma aggiunto dalla stessa modifica M1 (data non letta).',
    },
    esempiObblighiTerritoriali: {
      valore: [{ ente: 'MiC — contributi selettivi alla produzione 2026', regola: 'spesa in Italia non inferiore al 160% del contributo', fonte: 'D.D. 1238/2026, art. 27, comma 1' }, { ente: 'Regione Siciliana — Avviso 2025-2027', regola: 'spese ammissibili sostenute in Sicilia pari ad almeno il 150% dell’agevolazione, a pena di revoca', fonte: 'Avviso, art. 6 e art. 18' }, { ente: 'Regione Emilia-Romagna — Bando 2026', regola: 'almeno il 30% dei costi totali di produzione sul territorio regionale (20% per le coproduzioni internazionali, 15% per l’animazione)', fonte: 'Bando, par. 3.3' }], unita: 'elenco', vigenteDal: '2026-05-15',
      descrizione: 'Come tre bandi letti applicano la territorializzazione.',
      fonte: 'SEL26', articolo: 'art. 27, comma 1 (per gli altri vedi il campo fonte di ciascun esempio)',
    },
    sogliaNotificaRegimeEuroAnno: {
      valore: 55000000, unita: 'euro_per_regime_per_anno', vigenteDal: '2023-07-01',
      descrizione: 'Soglia oltre la quale un regime di aiuti alle opere audiovisive va notificato alla Commissione.',
      fonte: 'GBER', articolo: 'art. 4, par. 1, lett. aa)',
    },
    scadenzaRegolamento: {
      valore: '2026-12-31', unita: 'data', vigenteDal: '2023-07-01', daVerificare: true,
      descrizione: 'Il Regolamento 651/2014 si applica fino al 31 dicembre 2026.',
      fonte: 'GBER', articolo: 'art. 59',
      nota: 'Per il 2027 servirà una proroga o un nuovo regolamento: i limiti potrebbero cambiare. Letto il testo consolidato al 1° luglio 2023; non risultano consolidati successivi sul portale dell’Ufficio delle pubblicazioni.',
    },
    deMinimisEsempio: {
      valore: { massimalePerImpresaEuro: 300000, periodoAnni: 3 }, unita: 'regola',
      descrizione: 'Alcuni bandi regionali concedono il contributo in regime «de minimis» (Reg. UE 2023/2831): 300.000 euro per impresa in tre anni, verificati sul Registro nazionale degli aiuti.',
      fonte: 'ER26', articolo: 'par. 6.2 e 6.3',
      nota: 'Nel bando emiliano il totale degli aiuti alla stessa impresa non può comunque superare il 50% delle spese ammissibili e il tax credit è cumulabile entro l’intensità massima.',
    },
  },
  selettivi: {
    produzioneContributoMaxPctCostiAmmissibili: {
      valore: 40, unita: 'pct_costi_ammissibili', vigenteDal: '2026-05-15',
      descrizione: 'Il contributo massimo alla produzione è il minore tra il contributo richiesto, il 40% dei costi ammissibili e i tetti in euro previsti per alcune linee.',
      fonte: 'SEL26', articolo: 'art. 24, comma 6',
    },
    produzioneCostoMassimoOpera: {
      valore: { operePrimeSecondeGiovaniAutori: 4000000, documentari: 1000000, cortometraggi: 200000 }, unita: 'euro', vigenteDal: '2026-05-15',
      descrizione: 'Costo complessivo massimo dell’opera per accedere alla linea (deve restare inferiore alla soglia a preventivo e a consuntivo).',
      fonte: 'SEL26', articolo: 'art. 22, comma 5',
      nota: 'Nelle coproduzioni internazionali i limiti si riferiscono alla quota italiana.',
    },
    produzioneSopraLaLineaMaxPct: {
      valore: { operePrimeSecondeGiovaniAutori: 25, filmEDocumentariDiParticolareQualita: 30 }, unita: 'pct_costo_di_produzione', vigenteDal: '2026-05-15',
      descrizione: 'Incidenza massima dei compensi di regista, autori di soggetto e sceneggiatura e attori principali, a preventivo e a consuntivo.',
      fonte: 'SEL26', articolo: 'art. 22, comma 5',
      nota: 'Il limite non si applica alle coproduzioni, compartecipazioni e produzioni internazionali (art. 22, comma 6).',
    },
    produzioneSpesaInItaliaMinPctDelContributo: {
      valore: 160, unita: 'pct_del_contributo', vigenteDal: '2026-05-15',
      descrizione: 'Obbligo di spendere in Italia almeno il 160% del contributo concesso, a pena di decadenza.',
      fonte: 'SEL26', articolo: 'art. 27, comma 1',
    },
    produzioneCostiNonAmmissibili: {
      valore: ['costi di amministrazione', 'oneri assicurativi, finanziari e di garanzia', 'spese legali', 'promozione e marketing', 'completion bond', 'spese generali, anche differite', 'producer’s fee, anche differito', 'fee dei produttori esecutivi esteri', 'contributi differiti e in natura'], unita: 'elenco', vigenteDal: '2026-05-15',
      descrizione: 'Voci del costo complessivo che non sono costi ammissibili per il contributo selettivo alla produzione.',
      fonte: 'SEL26', articolo: 'Tabella 6, sezioni G e H',
    },
    cumuloConTaxCredit: {
      valore: true, unita: 'bool', vigenteDal: '2025-04-22',
      descrizione: 'Il contributo selettivo si somma al credito d’imposta entro i limiti di intensità; un contributo selettivo alla produzione (bandi dopo il 1° gennaio 2024) apre inoltre la via di accesso alternativa al tax credit e conta tra le fonti di copertura.',
      fonte: 'CONS', articolo: 'art. 12, comma 2; D.D. 2541/2025, art. 4, comma 3, lett. e)',
    },
  },
  erogazione: {
    schemi: {
      taxCreditProduzione: {
        valore: [{ quota: 'prima quota', percentuale: 70, condizione: 'approvazione della richiesta preventiva (40% per imprese ad elevata capacità o su richiesta)' }, { quota: 'saldo', percentuale: 30, condizione: 'approvazione della richiesta definitiva' }], unita: 'quote', vigenteDal: '2024-07-10',
        descrizione: 'Non è un’erogazione di denaro: le quote diventano utilizzabili in compensazione F24 dal giorno 15 del mese successivo al riconoscimento.',
        fonte: 'CONS', articolo: 'art. 6, comma 5; art. 34, comma 1',
      },
      selettiviMicProduzione2026: {
        valore: [{ quota: 'acconto', percentuale: 50, condizione: 'su richiesta, con i contratti degli autori e del regista; pagato entro 90 giorni e dopo la nazionalità provvisoria' }, { quota: 'saldo', percentuale: 50, condizione: 'richiesta definitiva con consuntivo certificato; pagato entro 120 giorni dalle verifiche' }], unita: 'quote', vigenteDal: '2026-05-15',
        descrizione: 'Contributo selettivo alla produzione. Dopo l’acconto: quietanza dei compensi agli autori entro 30 giorni e prova dell’inizio delle riprese entro 90 giorni, a pena di decadenza.',
        fonte: 'SEL26', articolo: 'art. 26, comma 1',
        nota: 'Nell’articolo non è richiesta una fideiussione per l’acconto.',
      },
      selettiviMicSviluppoEScrittura2026: {
        valore: [{ quota: 'acconto', percentuale: 50, condizione: 'richiesta entro 90 giorni dalla graduatoria' }, { quota: 'saldo', percentuale: 50, condizione: 'richiesta definitiva di liquidazione' }], unita: 'quote', vigenteDal: '2026-05-15',
        descrizione: 'Scrittura e sviluppo: acconto del 50% e saldo a consuntivo. Per la scrittura l’acconto è pagato entro 30 giorni dalla richiesta e la richiesta definitiva va presentata entro 12 mesi.',
        fonte: 'SEL26', articolo: 'art. 10, comma 3; art. 18, comma 1',
      },
      siciliaAvviso2025_2027: {
        valore: [{ quota: 'anticipo', percentuale: 60, condizione: 'facoltativo, solo con garanzia fideiussoria bancaria o assicurativa a prima richiesta' }, { quota: 'seconda quota', percentuale: 30, condizione: 'fino alla concorrenza del 90% del contributo (30% se è stato chiesto l’anticipo del 60%, altrimenti fino al 90%), con conto consuntivo e matrice asseverati e copia campione, entro 24 mesi' }, { quota: 'saldo', percentuale: 10, condizione: 'quota residua, dopo la prova dell’uscita in sala, della messa in onda o della fruizione pubblica, entro 6 mesi dalla seconda quota' }], unita: 'quote', vigenteDal: '2025-12-22',
        descrizione: 'Contributo regionale siciliano. La fideiussione copre l’anticipo, gli interessi e le spese di recupero ed è svincolata con la seconda quota.',
        fonte: 'SIC', articolo: 'art. 16',
        nota: 'Il credito verso la Regione non è cedibile; è ammesso il mandato irrevocabile all’incasso a favore di un finanziatore.',
      },
      emiliaRomagna2026: {
        valore: [{ quota: 'stato di avanzamento', percentuale: null, condizione: 'facoltativo, una sola volta, al raggiungimento di almeno il 50% delle spese ammissibili, dal 1° marzo al 30 aprile 2027' }, { quota: 'saldo', percentuale: null, condizione: 'rendicontazione finale; liquidazione entro 80 giorni' }], unita: 'quote',
        descrizione: 'Contributo regionale emiliano: nessun anticipo, si incassa a spesa sostenuta e rendicontata.',
        fonte: 'ER26', articolo: 'par. 13, commi 3 e 4; par. 13.1 e 13.2',
      },
      anticipazioneBancariaSuContributoEsempio: {
        valore: { quotaMaxPctDelContributo: 90, durataMaxMesi: 18, finanziatore: 'Istituto per il Credito Sportivo' }, unita: 'regola', vigenteDal: '2025-12-22', daVerificare: true,
        descrizione: 'L’avviso siciliano dà notizia di un protocollo con l’Istituto per il Credito Sportivo per anticipare i contributi fino al 90% dell’agevolazione provvisoria e per non più di 18 mesi, previa valutazione del merito creditizio.',
        fonte: 'SIC', articolo: 'art. 16',
        nota: 'L’atto indica quota e durata, non il costo del finanziamento.',
      },
      tempiDiPagamentoGiorni: {
        valore: { taxCreditRiconoscimento: 60, selettiviAcconto: 90, selettiviSaldo: 120, emiliaRomagnaLiquidazione: 80 }, unita: 'giorni', vigenteDal: '2026-05-15',
        descrizione: 'Tempi scritti negli atti tra la domanda completa e il riconoscimento o il pagamento: da usare nel piano di cassa come tempi minimi.',
        fonte: 'SEL26', articolo: 'art. 26, comma 1 (per gli altri: D.I. 225/2024, artt. 14 e 15; bando Emilia-Romagna, par. 13, comma 4)',
      },
    },
    costi: {
      fideiussionePremioAnnuoPct: {
        valore: { min: 1, max: 3 }, unita: 'pct_annuo_importo_garantito', daVerificare: true, indicativo: true,
        descrizione: 'Costo annuo di una fideiussione assicurativa o bancaria a garanzia dell’anticipo di un contributo pubblico.',
        fonte: null,
        nota: 'Dipende da durata, importo e solidità dell’impresa; le banche possono chiedere anche un vincolo di liquidità. Le ricerche svolte non hanno trovato una percentuale attendibile. Da sostituire con il preventivo o il contratto reale del progetto.',
      },
      scontoCessioneTaxCreditPct: {
        valore: { min: 3, max: 8 }, unita: 'pct_valore_nominale', daVerificare: true, indicativo: true,
        descrizione: 'Sconto sul valore nominale applicato da banche e intermediari che acquistano il credito d’imposta definitivo.',
        fonte: null,
        nota: 'Varia con i tempi di utilizzo del cessionario e il rischio sul cedente. Nessuna fonte pubblica trovata in questa sessione. Da sostituire con il preventivo o il contratto reale del progetto.',
      },
      finanziamentoPonteTassoAnnuoPct: {
        valore: { min: 5, max: 9 }, unita: 'pct_annuo', daVerificare: true, indicativo: true,
        descrizione: 'Tasso annuo complessivo di un finanziamento ponte garantito da contratti, contributi deliberati o credito d’imposta atteso.',
        fonte: null,
        nota: 'Di norma parametrato all’Euribor più uno spread; il livello cambia con i tassi di mercato. Da sostituire con il preventivo o il contratto reale del progetto.',
      },
      finanziamentoPonteSpeseIstruttoriaPct: {
        valore: { min: 0.5, max: 1.5 }, unita: 'pct_importo_finanziato', daVerificare: true, indicativo: true,
        descrizione: 'Commissioni di istruttoria e di messa a disposizione sul finanziamento ponte.',
        fonte: null,
        nota: 'Voce spesso negoziabile. Da sostituire con il preventivo o il contratto reale del progetto.',
      },
      finanziamentoPonteQuotaAnticipabilePct: {
        valore: { min: 70, max: 90 }, unita: 'pct_del_credito_atteso', daVerificare: true, indicativo: true,
        descrizione: 'Quota del contributo o del credito atteso che una banca è disposta ad anticipare.',
        fonte: null,
        nota: 'L’unico dato scritto in un atto letto è il 90% per non più di 18 mesi del protocollo siciliano con l’Istituto per il Credito Sportivo. Da sostituire con il preventivo o il contratto reale del progetto.',
      },
      completionBondPct: {
        valore: { min: 2, max: 3 }, unita: 'pct_del_budget', daVerificare: true, indicativo: true,
        descrizione: 'Costo di una garanzia di buon fine (completion bond), poco usata in Italia e chiesta soprattutto nelle coproduzioni internazionali.',
        fonte: null,
        nota: 'Non è un costo ammissibile per il contributo selettivo MiC (Tabella 6, sezione G). Da sostituire con il preventivo o il contratto reale del progetto.',
      },
      oneriEleggibiliAlTaxCredit: {
        valore: 7.5, unita: 'pct_costo_complessivo', vigenteDal: '2024-07-10',
        descrizione: 'Promemoria: interessi, premi assicurativi e costi di garanzia direttamente imputabili all’opera sono eleggibili al tax credit entro il 7,5% complessivo del costo di produzione.',
        fonte: 'CONS', articolo: 'art. 3, comma 2, lett. a)',
      },
    },
  },
  recupero: {
    ordineTipico: {
      valore: ['1. incasso lordo al botteghino, al netto di IVA e diritti musicali', '2. quota dell’esercente e quota di noleggio al distributore', '3. commissione di distribuzione', '4. recupero delle spese di lancio (copie e pubblicità) anticipate dal distributore', '5. recupero del minimo garantito versato al produttore', '6. rimborso di banche e finanziatori (finanziamento ponte, gap)', '7. investitori esterni e associati in partecipazione, con l’eventuale premio', '8. compensi differiti', '9. produttore e coproduttori, pro quota; poi partecipazioni agli utili di autori e interpreti'], unita: 'elenco', daVerificare: true, indicativo: true,
      descrizione: 'Ordine tipico di recupero dei ricavi di un film italiano con distribuzione in sala.',
      fonte: null,
      nota: 'Ogni contratto di distribuzione e ogni accordo con i finanziatori può cambiarlo. Per vendite estere, televisione e piattaforme i passaggi 2-5 sono sostituiti dalla commissione del venditore e dal recupero delle sue spese. Da sostituire con il preventivo o il contratto reale del progetto.',
    },
    quotaNoleggioSuIncassoNettoPct: {
      valore: { min: 40, max: 50 }, unita: 'pct_incasso_netto', daVerificare: true, indicativo: true,
      descrizione: 'Quota dell’incasso netto di sala che l’esercente riconosce al distributore (noleggio).',
      fonte: null,
      nota: 'Intervallo tipico dei contratti italiani secondo la prassi; nessun atto pubblico lo fissa. Di solito decresce nelle settimane successive alla prima. Da sostituire con il preventivo o il contratto reale del progetto.',
    },
    commissioneDistribuzioneSalaPct: {
      valore: { min: 20, max: 35 }, unita: 'pct_del_noleggio', daVerificare: true, indicativo: true,
      descrizione: 'Commissione del distributore cinematografico sul noleggio.',
      fonte: null,
      nota: 'Intervallo tipico dei contratti italiani secondo la prassi; nessun atto pubblico lo fissa. Più alta quando il distributore anticipa le spese di lancio o versa un minimo garantito. Da sostituire con il preventivo o il contratto reale del progetto.',
    },
    commissioneVenditeEstereETvPct: {
      valore: { min: 10, max: 25 }, unita: 'pct_dei_ricavi', daVerificare: true, indicativo: true,
      descrizione: 'Commissione del venditore internazionale o del distributore sui diritti tv, piattaforme e home video.',
      fonte: null,
      nota: 'Intervallo tipico dei contratti italiani secondo la prassi; nessun atto pubblico lo fissa. Guide internazionali di film finance trovate con la ricerca web indicano commissioni del 15-25%: sono fonti generiche, non italiane. Da sostituire con il preventivo o il contratto reale del progetto.',
    },
    speseDiLancio: {
      valore: 'recuperate per intero dal distributore prima di riconoscere ricavi al produttore', unita: 'testo', daVerificare: true, indicativo: true,
      descrizione: 'Trattamento delle spese di lancio (copie, pubblicità, promozione).',
      fonte: null,
      nota: 'Il decreto tax credit fissa solo gli investimenti minimi di promozione da prevedere nell’accordo di distribuzione: 300.000 euro per i film oltre 3,5 milioni e 90.000 euro per gli altri (art. 12, comma 1, lett. b). Da sostituire con il preventivo o il contratto reale del progetto.',
    },
    minimoGarantito: {
      valore: 'anticipo sui ricavi futuri recuperato dal distributore, dopo commissione e spese di lancio, sulla quota del produttore', unita: 'testo', daVerificare: true, indicativo: true,
      descrizione: 'Trattamento del minimo garantito.',
      fonte: null,
      nota: 'Nel piano finanziario il minimo garantito è una fonte di copertura documentabile con contratto (D.D. 2541/2025, art. 4, comma 3, lett. d). Da sostituire con il preventivo o il contratto reale del progetto.',
    },
    premioInvestitoriPct: {
      valore: { min: 10, max: 20 }, unita: 'pct_del_capitale', daVerificare: true, indicativo: true,
      descrizione: 'Premio riconosciuto agli investitori esterni prima che il produttore partecipi ai ricavi.',
      fonte: null,
      nota: 'Intervallo tipico dei contratti italiani secondo la prassi; nessun atto pubblico lo fissa. Da sostituire con il preventivo o il contratto reale del progetto.',
    },
    aiutiPubbliciNonRimborsabili: {
      valore: true, unita: 'bool', vigenteDal: '2025-12-22', daVerificare: true,
      descrizione: 'Credito d’imposta, contributi selettivi e contributi regionali letti in questa sessione sono a fondo perduto: non entrano nell’ordine di recupero come debiti da rimborsare.',
      fonte: 'SIC', articolo: 'art. 4 («contributi a fondo perduto»)',
      nota: 'Per credito d’imposta e selettivi nessun articolo letto prevede una restituzione dai ricavi; resta però l’obbligo di reinvestimento del tax credit. Verificare ogni bando: alcuni fondi regionali o europei prevedono quote rimborsabili.',
    },
    obbligoReinvestimentoTaxCredit: {
      valore: { entroAnni: 5, dopoCoperturaDeiCosti: true, tetto: 'fino a concorrenza del credito riconosciuto', destinazione: 'nuove opere difficili' }, unita: 'regola', vigenteDal: '2025-04-22',
      descrizione: 'Dopo aver coperto i costi dell’opera il produttore deve reinvestire una quota dei proventi proporzionale al credito ricevuto: nel piano di recupero è un vincolo sulla quota del produttore, non un’uscita di cassa verso lo Stato.',
      fonte: 'CONS', articolo: 'art. 7, commi 9 e 10; art. 36, comma 9',
    },
    contributiAutomaticiDaiRisultati: {
      valore: true, unita: 'bool', vigenteDal: '2026-06-18', daVerificare: true,
      descrizione: 'Incassi di sala, vendite di diritti, festival e premi generano punti per i contributi automatici, accreditati sulla posizione contabile dell’impresa e utilizzabili solo per nuove opere.',
      fonte: 'DM265', articolo: 'artt. 6, 8 e 13',
      nota: 'Per il 2026 il riparto del Fondo non stanzia risorse per gli automatici.',
    },
  },
  rendicontazione: {
    producerFee: {
      valore: { taxCreditStatale: 'non eleggibile; imputabile al costo complessivo fino al 7,5%', selettiviMic2026: 'non ammissibile', emiliaRomagna2026: 'non ammissibile' }, unita: 'regola', vigenteDal: '2024-07-10',
      descrizione: 'Il producer fee non è mai coperto dall’aiuto nei testi letti; conta solo dentro il costo complessivo, con un tetto.',
      fonte: 'CONS', articolo: 'art. 3, comma 2, lett. c)',
      nota: 'Bando selettivi 2026, Tabella 6, sezione H; Emilia-Romagna 2026, par. 7.1.4, lett. t). Nell’avviso siciliano il limite è nel Modulo III, non letto in questa sessione.',
    },
    speseGenerali: {
      valore: { taxCreditStatale: 'non eleggibili; imputabili fino al 7,5%', selettiviMic2026: 'non ammissibili', emiliaRomagna2026: 'forfait del 7% sulle spese ammissibili di personale, beni e servizi, senza giustificativi' }, unita: 'regola',
      descrizione: 'Trattamento delle spese generali.',
      fonte: 'ER26', articolo: 'par. 7.1.3 (per gli altri: D.I. 225/2024, art. 3, comma 2, lett. c); bando selettivi 2026, Tabella 6, sezione H)',
    },
    scostamentoDalPreventivo: {
      valore: [{ misura: 'tax credit produzione', regola: 'costi eleggibili definitivi riconosciuti al massimo fino al 110% dei preventivi', sogliaPct: 10, fonte: 'D.I. 225/2024, art. 15, comma 7; art. 19, comma 5' }, { misura: 'selettivi MiC produzione 2026', regola: 'contributo ridotto in proporzione se i costi ammissibili sostenuti sono inferiori di oltre il 10% a quelli del preventivo', sogliaPct: 10, fonte: 'D.D. 1238/2026, art. 28, comma 4' }, { misura: 'Sicilia 2025-2027', regola: 'consuntivo non inferiore all’80% del piano presentato (sotto: revoca); varianti ammesse solo con riduzione dei costi fino al 20%', sogliaPct: 20, fonte: 'Avviso, artt. 13, 15 e 18' }, { misura: 'Emilia-Romagna 2026', regola: 'contributo rideterminato in proporzione alle spese ammissibili sostenute; revoca totale sotto 20.000 euro di costi ammissibili', sogliaPct: null, fonte: 'Bando, par. 3.3, comma 4, e par. 14' }], unita: 'elenco', vigenteDal: '2026-05-15',
      descrizione: 'Quanto il consuntivo può discostarsi dal preventivo senza perdere l’aiuto.',
      fonte: 'SEL26', articolo: 'art. 28, comma 4 (per gli altri vedi il campo fonte di ciascuna riga)',
    },
    iva: {
      valore: 'ammissibile solo se non recuperabile', unita: 'testo',
      descrizione: 'L’IVA è un costo ammissibile solo se resta realmente e definitivamente a carico del beneficiario; l’IVA recuperabile non lo è, anche se di fatto non viene recuperata.',
      fonte: 'ER26', articolo: 'par. 7.1, comma 4',
      nota: 'Stessa regola in Sicilia, art. 7, lett. i) e n. 12.',
    },
  },
};

/** Dubbi generali dichiarati dalla ricerca: vanno mostrati a chi usa i calcoli. */
export const INCERTEZZE = [
  'Regime transitorio del D.I. 281/2026: il decreto non dice se le richieste definitive legate a preventive approvate prima del 24 settembre 2026 conservino aliquote e tetti precedenti.',
  'Date delle sessioni 2027 del tax credit e dei bandi selettivi: non ancora pubblicate.',
  'Il Regolamento (UE) 651/2014 si applica fino al 31 dicembre 2026: i limiti di intensità per il 2027 dipendono dalla proroga o dal nuovo regolamento.',
  'Tax credit internazionale: resta il D.I. 329/2024 (40%); la stampa di settore ha parlato di una riduzione, ma nessun atto pubblicato la contiene.',
  'Contributi automatici: nuovo D.M. 265/2026 con PDF solo in parte leggibile; nessuna risorsa nel riparto 2026.',
  'Importo in euro del tetto ai compensi individuali (art. 23-ter D.L. 201/2011): non scritto negli atti letti.',
  'Costi di fideiussione, sconto del tax credit, finanziamento ponte e tutta la sezione recupero: stime senza fonte, da sostituire con i dati reali del progetto.',
  'Rendicontazione regionale: letti per intero solo l’avviso siciliano 2025-2027 e il bando emiliano 2026; le altre regioni possono avere regole diverse.',
  'Riforma annunciata della legge cinema (il D.L. 200/2025 parla di norme «nelle more della riforma»): possibile cambio del sistema dal 2027-2028.',
];

const eRegola = (o) => !!o && typeof o === 'object' && !Array.isArray(o) && 'valore' in o && 'descrizione' in o;

/** Tutte le regole in un elenco piatto, con il percorso (es. «taxCredit.aliquote.film»). */
export function elencoRegole(nodo = REGOLE, percorso = '') {
  if (eRegola(nodo)) return [{ percorso, ...nodo }];
  if (!nodo || typeof nodo !== 'object') return [];
  return Object.entries(nodo).flatMap(([k, v]) => elencoRegole(v, percorso ? `${percorso}.${k}` : k));
}

/** Regola dato il percorso; null se non esiste. */
export function regola(percorso) {
  const r = String(percorso || '').split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), REGOLE);
  return eRegola(r) ? r : null;
}

/** Stato di affidabilità di una regola: 'indicativo' | 'da_verificare' | 'storico' | 'verificato'. */
export function statoRegola(r) {
  if (!r) return 'verificato';
  if (r.indicativo) return 'indicativo';
  if (r.daVerificare) return 'da_verificare';
  return r.storico ? 'storico' : 'verificato';
}

/** Avvertenza da mostrare accanto al numero; stringa vuota se la regola è verificata sull'atto. */
export function avvertenzaRegola(r) {
  const s = statoRegola(r);
  if (s === 'indicativo') return 'valore indicativo di mercato';
  if (s === 'da_verificare') return 'da verificare con il commercialista';
  return s === 'storico' ? 'regola superata' : '';
}

/** Fonte leggibile di una regola: { breve, titolo, articolo, url }; null per le stime senza atto. */
export function fonteRegola(r) {
  const f = r?.fonte ? FONTI[r.fonte] : null;
  if (!f) return null;
  return { breve: f.breve, titolo: f.titolo, articolo: r.articolo || '', url: r.url || f.url || null };
}

/** Regole marcate «da verificare» o «indicative» (escluse quelle storiche, salvo richiesta). */
export function regoleIncerte(conStoriche = false) {
  return elencoRegole().filter((r) => (r.daVerificare || r.indicativo) && (conStoriche || !r.storico));
}
