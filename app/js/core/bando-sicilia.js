// Griglia di valutazione dell'Avviso Pubblico Regione Siciliana 2025-2027
// "Contributi a sostegno delle produzioni cinematografiche e audiovisive"
// (testo coordinato con le modifiche del D.D.G. n. 4788 del 22/12/2025).
// Trascritta dall'art. 10.2 dell'Avviso: tabelle A e B, sub-criteri quantitativi,
// principi generali della Commissione e punteggi minimi di sezione.

import { TESTO_AVVISO_SICILIA } from './bando-sicilia-testo.js';
import { ESITI_SICILIA, FINANZIATI_SICILIA } from './bando-sicilia-esiti.js';

// Struttura dei tre moduli ufficiali del Dossier di candidatura (dai modelli 2025-2027 della Sicilia Film Commission).
const MODULI_SICILIA = `MODULO I — ISTANZA (da presentare in PDF con firma digitale del legale rappresentante)
Dati del legale rappresentante (nome, luogo e data di nascita, residenza, codice fiscale) e della società (ragione sociale, PEC, e-mail, telefono, partita IVA, codice fiscale, sede legale, sede operativa, Stato, sito web). Tipologia di opera, da spuntare con X, con durata in minuti oppure numero di puntate e durata media. Titolo. Stato dell'opera: «non ancora in fase di riprese in Sicilia» oppure data di avvio delle riprese. Costo di produzione in euro. Cofinanziamento richiesto in euro.
Dichiarazioni: iscrizione al Registro delle Imprese da almeno 24 mesi (Camera di Commercio e data); codice ATECO 59.11 primario o prevalente da almeno 24 mesi; produttore unico oppure coproduttore/produttore associato con quota non inferiore al 20% (indicare la quota); l'opera non è stata oggetto di visione pubblica integrale; categoria d'impresa (micro, piccola, media, grande); possesso dei requisiti soggettivi del paragrafo 5.1; veridicità dei dati. Impegni: obblighi dell'art. 12 e comunicazione delle varianti.
Elenco degli allegati da spuntare: sceneggiatura e CV sceneggiatore/i (trattamento e CV autore o consulente scientifico per i documentari); documento d'identità; CV del soggetto proponente; CV regista/i; piano di lavorazione con le location in Sicilia e storyboard (se presenti). Per ciascun caso dichiarato, con il NUMERO di deal memo e di contratti allegati: coproduzioni/produzioni associate (più CV delle imprese coinvolte), finanziamenti nazionali o internazionali richiesti e ottenuti, accordi di distribuzione, accordi con produttore esecutivo (più CV), finanziatori esterni alla filiera, certificazione Green Film. Luogo, data, firma.

MODULO II — SCHEDA DI PRODUZIONE (PDF, unico file)
Titolo, tipologia di opera, soggetto proponente, anno di costituzione.
II.1 Soggetto dell'opera: massimo mezza cartella, 900 battute. II.2 Note di regia: massimo una cartella e mezzo, 2.700 battute.
II.3 Regista: elenco delle opere realizzate (titolo, anno, prodotta da, premi e riconoscimenti). II.4 Sceneggiatore (per i documentari: autore del soggetto/trattamento e/o consulente scientifico): elenco delle opere con premi e riconoscimenti.
II.5 Impresa: opere prodotte negli ultimi 5 anni. Per film, documentari e cortometraggi: anno, titolo, tipologia, quota % del proponente, festival, premi e riconoscimenti, coproduzione con, coproduttore nazionale o internazionale. Per film TV e serie: anno, titolo, tipologia, quota %, canali di distribuzione, coproduzioni.
II.6 Professionisti della componente artistica: nome, ruolo, opere (titolo, anno, prodotta da, premi). II.7 Professionisti del cast tecnico: nome, mansione, opere. II.8 Produttore esecutivo: ragione sociale, sede legale, regione, legale rappresentante, partita IVA.

MODULO III — DATI DI PRODUZIONE (.xls, unico file: copertina e quattro sezioni)
III.1 Anagrafica: titolo (provvisorio o definitivo), proponente, legale rappresentante, regia, soggetto, sceneggiatura, tipologia, genere, durata, lingua; accordi SI/NO con ragione sociale (N.1 coproduzione con imprese italiane, N.2 con imprese estere, N.3 distribuzione, N.4 produttore esecutivo, N.5 finanziatori esterni); costi calcolati in automatico (O.1 costo di produzione, O.2 costi ammissibili, O.3 cofinanziamento richiesto, O.4-O.5 percentuali, O.6 importo speso in Sicilia e suo rapporto con il contributo); P.1-P.2 date di inizio e fine riprese; P.3-P.5 giorni di pre-produzione, riprese e post-produzione; Q.1-Q.3 giorni di ciascuna fase svolti in Sicilia; R.1-R.4 numero di professionisti artistici e tecnici, totale e siciliani; S.1-S.4 referente, telefono, mail, PEC.
III.2 Cast e troupe list: tabella A componente artistica (regista, autore del soggetto, sceneggiatore, compositore, interpreti principali e secondari; esclusi figuranti e comparse), tabella B cast tecnico con i soli ruoli del menù a tendina; per ogni figura ruolo, cognome, nome e «nato e/o residente in Sicilia da almeno 6 mesi» SI/NO. I nominativi si indicano solo se già individuati. Quadro di sintesi con totale e numero di siciliani per A e B: è il dato usato per i criteri sui professionisti siciliani.
III.3 Budget a preventivo: voci A.1 soggetto e sceneggiatura, A.2 direzione, A.3 componente artistica, A.4 produzione, A.5 animazione, A.6 post-produzione, A.7 spese varie, A.8 spese generali (non ammissibili), A.9 producer fee (ammissibile fino al 7,5% del costo di produzione). Due colonne, IVA esclusa: importo complessivo e «di cui spesa ammissibile sostenuta in Sicilia».
III.4 Piano finanziario a copertura dei costi: 1 finanziamento pubblico (1.1 richiesta con questo bando, 1.2 tax credit, 1.3 MIC-DGCA, 1.4 Regioni, 1.5 fondi europei, 1.6 altri enti), 2 produttore e coproduttori (2.1 apporto societario diretto, 2.2 produttori indipendenti, 2.3 non indipendenti, 2.4 emittenti TV, 2.5 OTT, 2.6 differimenti), 3 coproduttori esteri, 4 apporto di terzi (capitale di rischio, sponsor, product placement, in kind), 5 prevendite Italia, 6 prevendite estero, 7 minimo garantito Italia, 8 minimo garantito estero. Per ogni riga: denominazione, tipologia di accordo, importo, % e documento a supporto (deal memo, contratto, delibera ente pubblico, nessun documento). Il totale del piano deve coincidere con il costo di produzione (differenza zero).`;

const FASCE_LAVORAZIONE = [
  { oltre: 75, punti: 10, etichetta: 'Oltre il 75%' },
  { da: 51, punti: 9, etichetta: 'Dal 51% al 74%' },
  { da: 31, punti: 7, etichetta: 'Dal 31% al 50%' },
  { da: 0, punti: 5, etichetta: 'Da 0% al 30%' },
];
const FASCE_POST = [
  { oltre: 51, punti: 10, etichetta: 'Oltre il 51%' },
  { da: 31, punti: 8, etichetta: 'Dal 31% al 50%' },
  { da: 11, punti: 6, etichetta: 'Dall’11% al 30%' },
  { da: 0, punti: 0, etichetta: 'Fino al 10%' },
];
const FASCE_SPESA = [
  { oltre: 300, punti: 10, etichetta: 'Oltre il 300%' },
  { da: 251, punti: 9, etichetta: 'Dal 251% al 300%' },
  { da: 151, punti: 7, etichetta: 'Dal 151% al 250%' },
  { da: 0, punti: 0, etichetta: '150% (minimo di ammissibilità)' },
];
const FASCE_COPERTURA = [
  { flag: 'ripreseIniziate', punti: 10, etichetta: 'Riprese iniziate in Sicilia' },
  { oltre: 80, punti: 9, etichetta: 'Copertura finanziaria oltre l’80%' },
  { da: 71, punti: 8, etichetta: 'Copertura dal 71% all’80%' },
  { da: 61, punti: 7, etichetta: 'Copertura dal 61% al 70%' },
  { da: 51, punti: 6, etichetta: 'Copertura dal 51% al 60%' },
  { da: 0, punti: 0, etichetta: 'Copertura fino al 50%' },
];

const PRINCIPIO_CAST =
  'Il punteggio è attribuito solo per le figure indicate nel Modulo III – Sez. III.2 e unicamente se sono allegati contratti, deal memo o lettere di intento sottoscritti con gli artisti e gli operatori coinvolti; è graduato sulla base dei rispettivi curriculum.';
const PRINCIPIO_SICILIANI =
  'Conta il numero di soggetti nati in Sicilia o ivi residenti da almeno 6 mesi tra le figure indicate nel Modulo III – Sez. III.2, a prescindere dall’indicazione nominativa. Il numero dichiarato sarà asseverato in rendicontazione.';
const PRINCIPIO_PIANO =
  'I documenti contrattuali e pre-contrattuali allegati sono valutati in base alla rilevanza aziendale e commerciale delle controparti (curriculum degli ultimi 5 anni: produzioni realizzate, festival, premi, coproduzioni). Conta anche lo stato di attuazione del progetto, in particolare l’effettiva data di inizio delle riprese in Sicilia. Le risorse proprie del proponente valgono solo se sostenute da referenze bancarie riferite allo specifico budget. I cofinanziamenti pubblici valgono solo se già giuridicamente attribuiti con provvedimento amministrativo.';
const PRINCIPIO_DISTRIBUZIONE_FILM =
  'Contratti e deal memo contano solo se sottoscritti con: (a) società di distribuzione cinematografica con almeno 3 film distribuiti nelle sale italiane negli ultimi cinque anni; (b) broadcaster o piattaforme VOD/SVOD con diffusione minima sull’intero territorio nazionale.';
const PRINCIPIO_DISTRIBUZIONE_DOC =
  'Contratti e deal memo contano solo se sottoscritti con: (a) società di distribuzione cinematografica con almeno 3 film/documentari distribuiti nelle sale italiane negli ultimi cinque anni; (b) broadcaster o piattaforme VOD/SVOD con diffusione minima sull’intero territorio nazionale.';
const PRINCIPIO_INTERNAZIONALE =
  'Il punteggio dipende dal numero e dalla rilevanza aziendale e commerciale delle controparti firmatarie di contratti di coproduzione. Per la distribuzione internazionale contano solo i contratti stipulati con società che abbiano distribuito all’estero almeno 3 film negli ultimi cinque anni.';

const GRIGLIA_A = {
  id: 'A',
  nome: 'Tabella A — Film di produzione cinematografica/televisiva, Serie TV e Cortometraggi',
  sezioni: [
    {
      id: 'A', nome: 'Qualità del progetto', max: 25,
      obiettivo: 'Promuovere opere originali e di qualità; potenziare l’immagine della Sicilia.',
      criteri: [
        {
          id: '1.1', nome: 'Originalità della sceneggiatura', max: 7, tipo: 'qualitativo',
          descrizione: 'Originalità della scrittura, dei personaggi e della loro rappresentazione, solidità, tono e ritmo della struttura narrativa.',
          documenti: ['sceneggiatura', 'modulo2'],
        },
        {
          id: '1.2', nome: 'Qualità della sceneggiatura', max: 12, tipo: 'qualitativo',
          descrizione: 'Qualità della scrittura, capacità di elaborazione drammaturgica, sviluppo e approfondimento dei personaggi, grado di innovazione linguistica in relazione all’audiovisivo proposto.',
          documenti: ['sceneggiatura', 'modulo2'],
        },
        {
          id: '2.1', nome: 'Valorizzazione di storia, paesaggio, cultura e identità della Sicilia', max: 6, tipo: 'qualitativo',
          descrizione: 'Capacità della sceneggiatura di offrire uno sguardo inedito (struttura, ambientazione, genere, personaggi, idee, linguaggi) e di valorizzare fatti, eventi, dialoghi, relazioni tra personaggi e luoghi con riferimento al contesto siciliano (paesaggio, tradizioni, cultura, attualità, enogastronomia, identità), anche ai fini del cineturismo e del turismo delle radici.',
          documenti: ['sceneggiatura', 'modulo2', 'piano_lavorazione'],
        },
      ],
    },
    {
      id: 'B', nome: 'Soggetti proponenti e soggetti coinvolti', max: 20,
      obiettivo: 'Promuovere e sostenere il settore audiovisivo.',
      criteri: [
        {
          id: '3.1', nome: 'Società di produzione e opere prodotte', max: 6, tipo: 'qualitativo',
          descrizione: 'Rilevanza della società di produzione in base al curriculum degli ultimi cinque anni. Film cinematografici e cortometraggi: numero di produzioni realizzate, partecipazione a festival, premi e riconoscimenti, coproduzioni nazionali e internazionali. Film TV e serie TV: numero di produzioni, canali di distribuzione, coproduzioni nazionali e internazionali.',
          documenti: ['cv_societa', 'modulo2'],
        },
        {
          id: '3.2', nome: 'Componente artistica', max: 10, tipo: 'qualitativo',
          descrizione: 'CV dei singoli professionisti coinvolti (regista, sceneggiatore, direttore della fotografia, autore della colonna sonora originale) in relazione a numero e qualità delle opere a cui hanno partecipato e ai premi e riconoscimenti ottenuti.',
          principio: PRINCIPIO_CAST,
          documenti: ['cv_regista', 'cv_autori', 'cv_artistico', 'accordi_cast', 'modulo2', 'modulo3'],
          richiede: ['accordi_cast'],
        },
        {
          id: '3.3', nome: 'Cast tecnico (crew)', max: 4, tipo: 'qualitativo',
          descrizione: 'CV dei singoli professionisti coinvolti in relazione a numero e qualità delle opere audiovisive a cui hanno partecipato.',
          principio: PRINCIPIO_CAST,
          documenti: ['cv_tecnico', 'accordi_cast', 'modulo2', 'modulo3'],
          richiede: ['accordi_cast'],
        },
      ],
    },
    {
      id: 'C', nome: 'Impatti economici e occupazionali in Sicilia', max: 30,
      obiettivo: 'Promuovere impatti economici e occupazionali sul territorio siciliano.',
      criteri: [
        {
          id: '4.1', nome: 'Incidenza della lavorazione in Sicilia', max: 8, tipo: 'fasce', metrica: 'lavorazioneSicilia', peso: 0.8,
          descrizione: 'Giorni di lavorazione in Sicilia (pre-produzione e riprese) rispetto al totale dei giorni di lavorazione.',
          fasce: FASCE_LAVORAZIONE,
        },
        {
          id: '4.2', nome: 'Professionisti siciliani della componente artistica', max: 5, tipo: 'fasce', metrica: 'artisticiSiciliani', peso: 0.5,
          descrizione: 'Professionisti nati e/o residenti in Sicilia da almeno sei mesi coinvolti nel cast artistico (esclusi figuranti e comparse).',
          principio: PRINCIPIO_SICILIANI,
          fasce: [
            { oltre: 51, punti: 10, etichetta: 'Oltre il 51%' },
            { da: 31, punti: 8, etichetta: 'Dal 31% al 50%' },
            { oltre: 0, punti: 6, etichetta: 'Fino al 30%' },
            { da: 0, punti: 0, etichetta: 'Nessuno' },
          ],
        },
        {
          id: '4.3', nome: 'Professionisti siciliani del cast tecnico', max: 5, tipo: 'fasce', metrica: 'tecniciSiciliani', peso: 0.5,
          descrizione: 'Professionisti nati e/o residenti in Sicilia da almeno sei mesi coinvolti nel cast tecnico (crew).',
          principio: PRINCIPIO_SICILIANI,
          fasce: [
            { oltre: 76, punti: 10, etichetta: 'Oltre il 76%' },
            { da: 51, punti: 8, etichetta: 'Dal 51% al 75%' },
            { oltre: 0, punti: 6, etichetta: 'Fino al 50%' },
            { da: 0, punti: 0, etichetta: 'Nessuno' },
          ],
        },
        {
          id: '4.4', nome: 'Incidenza della post-produzione in Sicilia', max: 2, tipo: 'fasce', metrica: 'postSicilia', peso: 0.2,
          descrizione: 'Giorni di lavorazione in Sicilia (post-produzione) rispetto al totale dei giorni di lavorazione.',
          fasce: FASCE_POST,
        },
        {
          id: '4.5', nome: 'Spesa sul territorio siciliano', max: 10, tipo: 'fasce', metrica: 'spesaSicilia', peso: 1,
          descrizione: 'Percentuale delle spese ammissibili sul territorio rispetto al contributo richiesto.',
          fasce: FASCE_SPESA,
        },
      ],
    },
    {
      id: 'D', nome: 'Solidità economico/finanziaria del progetto', max: 25,
      obiettivo: 'Sostenere opere con alto grado di fattibilità realizzativa e potenzialità distributiva.',
      criteri: [
        {
          id: '5.1', nome: 'Solidità del piano finanziario', max: 16, tipo: 'fasce', metrica: 'copertura', peso: 1.6, giudizio: true,
          descrizione: 'Copertura delle fonti e stato di avanzamento della produzione (eventuale inizio delle riprese in Sicilia) sulla base di deal memo e/o contratti sottoscritti: pre-acquisto, coproduzioni, produzioni associate, distribuzione, vendite, finanziatori esterni alla filiera (tax credit esterno, product placement).',
          principio: PRINCIPIO_PIANO,
          fasce: FASCE_COPERTURA,
          documenti: ['modulo3', 'coproduzione', 'distribuzione', 'finanziamenti', 'referenze_bancarie', 'finanziatori_esterni'],
        },
        {
          id: '5.2', nome: 'Solidità del piano di distribuzione', max: 5, tipo: 'discreto',
          descrizione: 'Presenza di contratti di distribuzione cinematografica e/o televisiva: 5 punti. Presenza di soli deal memo di distribuzione: 2 punti. Nessun accordo valido: 0 punti.',
          valori: [
            { punti: 5, etichetta: 'Contratto di distribuzione con controparte qualificata' },
            { punti: 2, etichetta: 'Deal memo di distribuzione con controparte qualificata' },
            { punti: 0, etichetta: 'Nessun accordo valido' },
          ],
          principio: PRINCIPIO_DISTRIBUZIONE_FILM,
          documenti: ['distribuzione'],
        },
        {
          id: '5.3', nome: 'Internazionalizzazione', max: 4, tipo: 'qualitativo',
          descrizione: 'Presenza di un coproduttore e/o di contratti di distribuzione internazionale.',
          principio: PRINCIPIO_INTERNAZIONALE,
          documenti: ['coproduzione', 'distribuzione'],
          senzaDocumenti: 0,
        },
      ],
    },
  ],
};

const GRIGLIA_B = {
  id: 'B',
  nome: 'Tabella B — Documentari e Serie TV documentarie',
  sezioni: [
    {
      id: 'A', nome: 'Qualità del progetto', max: 30,
      obiettivo: 'Promuovere opere originali e di qualità; potenziare l’immagine della Sicilia.',
      criteri: [
        {
          id: '1.1', nome: 'Originalità del soggetto/trattamento', max: 9, tipo: 'qualitativo',
          descrizione: 'Originalità della scrittura, dei personaggi e della loro rappresentazione, solidità, tono e ritmo della struttura narrativa anche rispetto al contesto paesaggistico, naturalistico, storico e alla tematica individuata.',
          documenti: ['sceneggiatura', 'modulo2'],
        },
        {
          id: '1.2', nome: 'Qualità del soggetto/trattamento', max: 12, tipo: 'qualitativo',
          descrizione: 'Qualità della scrittura, capacità di elaborazione drammaturgica e di restituzione dei personaggi, grado di innovazione linguistica in relazione all’audiovisivo proposto.',
          documenti: ['sceneggiatura', 'modulo2'],
        },
        {
          id: '2.1', nome: 'Valorizzazione di storia, paesaggio, cultura e identità della Sicilia', max: 9, tipo: 'qualitativo',
          descrizione: 'Capacità del soggetto/trattamento di offrire uno sguardo inedito e di valorizzare fatti, eventi, dialoghi, relazioni tra personaggi e luoghi con riferimento al contesto siciliano (paesaggio, tradizioni, cultura, attualità, enogastronomia, identità), anche ai fini del cineturismo e del turismo delle radici.',
          documenti: ['sceneggiatura', 'modulo2', 'piano_lavorazione'],
        },
      ],
    },
    {
      id: 'B', nome: 'Soggetti proponenti e soggetti coinvolti', max: 15,
      obiettivo: 'Promuovere e sostenere professionisti del settore audiovisivo.',
      criteri: [
        {
          id: '3.1', nome: 'Società di produzione e opere prodotte', max: 4, tipo: 'qualitativo',
          descrizione: 'Società di produzione e capacità di collocare il prodotto sul mercato. Ultimi cinque anni: numero di produzioni realizzate, partecipazione a festival, premi e riconoscimenti, coproduzioni nazionali e internazionali.',
          documenti: ['cv_societa', 'modulo2'],
        },
        {
          id: '3.2', nome: 'Componente artistica', max: 8, tipo: 'qualitativo',
          descrizione: 'CV dei professionisti coinvolti (regista, autore del soggetto/trattamento, direttore della fotografia, consulente scientifico, autore della colonna sonora originale) in relazione a numero e qualità delle opere e ai premi e riconoscimenti ottenuti.',
          principio: PRINCIPIO_CAST,
          documenti: ['cv_regista', 'cv_autori', 'cv_artistico', 'accordi_cast', 'modulo2', 'modulo3'],
          richiede: ['accordi_cast'],
        },
        {
          id: '3.3', nome: 'Cast tecnico (crew)', max: 3, tipo: 'qualitativo',
          descrizione: 'CV dei singoli professionisti coinvolti in relazione a numero e qualità delle opere audiovisive a cui hanno partecipato.',
          principio: PRINCIPIO_CAST,
          documenti: ['cv_tecnico', 'accordi_cast', 'modulo2', 'modulo3'],
          richiede: ['accordi_cast'],
        },
      ],
    },
    {
      id: 'C', nome: 'Impatti economici e occupazionali in Sicilia', max: 30,
      obiettivo: 'Promuovere impatti economici e occupazionali sul territorio siciliano.',
      criteri: [
        {
          id: '4.1', nome: 'Incidenza della lavorazione in Sicilia', max: 10, tipo: 'fasce', metrica: 'lavorazioneSicilia', peso: 1,
          descrizione: 'Giorni di lavorazione in Sicilia (pre-produzione e riprese) rispetto al totale dei giorni di lavorazione.',
          fasce: FASCE_LAVORAZIONE,
        },
        {
          id: '4.2', nome: 'Professionisti siciliani tra componente artistica e cast tecnico', max: 7, tipo: 'fasce', metrica: 'professionistiSiciliani', peso: 0.7,
          descrizione: 'Professionisti nati e/o residenti in Sicilia da almeno sei mesi coinvolti nella componente artistica e nel cast tecnico.',
          principio: PRINCIPIO_SICILIANI,
          fasce: [
            { oltre: 51, punti: 10, etichetta: 'Oltre il 51%' },
            { da: 31, punti: 8, etichetta: 'Dal 31% al 50%' },
            { oltre: 0, punti: 6, etichetta: 'Fino al 30%' },
            { da: 0, punti: 0, etichetta: 'Nessuno' },
          ],
        },
        {
          id: '4.3', nome: 'Incidenza della post-produzione in Sicilia', max: 3, tipo: 'fasce', metrica: 'postSicilia', peso: 0.3,
          descrizione: 'Giorni di lavorazione in Sicilia (post-produzione) rispetto al totale dei giorni di lavorazione.',
          fasce: FASCE_POST,
        },
        {
          id: '4.4', nome: 'Spesa sul territorio siciliano', max: 10, tipo: 'fasce', metrica: 'spesaSicilia', peso: 1,
          descrizione: 'Percentuale della spesa ammissibile sul territorio rispetto al contributo richiesto.',
          fasce: FASCE_SPESA,
        },
      ],
    },
    {
      id: 'D', nome: 'Solidità economico/finanziaria del progetto', max: 25,
      obiettivo: 'Sostenere opere con alto grado di fattibilità realizzativa e potenzialità distributiva.',
      criteri: [
        {
          id: '5.1', nome: 'Solidità del piano finanziario', max: 16, tipo: 'fasce', metrica: 'copertura', peso: 1.6, giudizio: true,
          descrizione: 'Copertura delle fonti e stato di avanzamento della produzione (eventuale inizio delle riprese in Sicilia) sulla base di deal memo e/o contratti sottoscritti: pre-acquisto, coproduzioni, produzioni associate, distribuzione, vendite, finanziatori esterni alla filiera.',
          principio: PRINCIPIO_PIANO,
          fasce: FASCE_COPERTURA,
          documenti: ['modulo3', 'coproduzione', 'distribuzione', 'finanziamenti', 'referenze_bancarie', 'finanziatori_esterni'],
        },
        {
          id: '5.2', nome: 'Solidità del piano di distribuzione', max: 6, tipo: 'discreto',
          descrizione: 'Presenza di contratti di distribuzione cinematografica e/o televisiva: 6 punti. Presenza di soli deal memo di distribuzione: 3 punti. Nessun accordo valido: 0 punti.',
          valori: [
            { punti: 6, etichetta: 'Contratto di distribuzione con controparte qualificata' },
            { punti: 3, etichetta: 'Deal memo di distribuzione con controparte qualificata' },
            { punti: 0, etichetta: 'Nessun accordo valido' },
          ],
          principio: PRINCIPIO_DISTRIBUZIONE_DOC,
          documenti: ['distribuzione'],
        },
        {
          id: '5.3', nome: 'Internazionalizzazione', max: 3, tipo: 'discreto',
          descrizione: 'Presenza di un coproduttore e/o di contratti di distribuzione internazionale: 3 punti.',
          valori: [
            { punti: 3, etichetta: 'Coproduttore e/o contratto di distribuzione internazionale' },
            { punti: 0, etichetta: 'Assenti' },
          ],
          principio: PRINCIPIO_INTERNAZIONALE,
          documenti: ['coproduzione', 'distribuzione'],
        },
      ],
    },
  ],
};

export const BANDO_SICILIA = {
  id: 'sicilia-2025-2027',
  nome: 'Sicilia — Produzioni cinematografiche e audiovisive 2025-2027',
  nomeBreve: 'Sicilia 2025-2027',
  ente: 'Regione Siciliana — Assessorato Turismo, Sport e Spettacolo · Sicilia Film Commission',
  regione: 'Sicilia',
  territorio: 'Sicilia',
  fonte: 'Avviso pubblico anni 2025-2027, testo coordinato con D.D.G. n. 4788 del 22/12/2025',
  verificato: true,
  predefinito: true,
  sogliaTotale: 65,
  punteggioMassimo: 100,
  commissione: {
    componenti: 5,
    descrizione: 'Presidente (funzionario regionale), 3 esperti esterni del settore cinematografico e audiovisivo, 1 segretario. Per ogni voce il punteggio è la media aritmetica di quelli dei singoli membri, arrotondata alla prima cifra decimale.',
  },
  finestre: [
    { anno: 2025, dal: '2025-02-01', al: '2025-03-15' },
    { anno: 2026, dal: '2026-02-02', al: '2026-03-16' },
    { anno: 2027, dal: '2027-02-01', al: '2027-03-15' },
  ],
  invio: {
    canale: 'PEC',
    regole: [
      'Un solo invio, dalla casella PEC indicata nel dossier (art. 8.1 e 8.2).',
      'Modulo I e allegati in PDF, un file per documento; il Modulo I firmato digitalmente.',
      'Modulo II in PDF, in un unico file. Modulo III in formato .xls, in un unico file.',
      'Tutto in lingua italiana. Solo la modulistica ufficiale dell’Avviso: moduli diversi rendono l’istanza irricevibile.',
      'Una sola istanza per categoria in ciascuna finestra: vale la prima pervenuta.',
    ],
    indirizzo: 'dipartimento.turismo@certmail.regione.sicilia.it',
    oggetto: 'SICILIA FILM COMMISSION – ISTANZA PER LA CONCESSIONE DI CONTRIBUTI A SOSTEGNO DELLA PRODUZIONE CINEMATOGRAFICA E AUDIOVISIVA 2025-2027',
  },
  spesaTerritorioMinPct: 150,
  categorie: [
    {
      id: 'film',
      nome: 'Film di produzione cinematografica/televisiva e Serie TV',
      griglia: 'A',
      soglie: { A: 17, B: 13, C: 20, D: 15 },
      contributo: { percentuale: 30, massimali: { 2025: 750000, 2026: 1000000, 2027: 1000000 } },
      dotazione: { 2025: 3600000, 2026: 5200000, 2027: 5050000 },
      durataMin: 52,
      greenFilm: true,
      testoQualita: 'sceneggiatura',
    },
    {
      id: 'documentario',
      nome: 'Documentari e Serie TV documentarie',
      griglia: 'B',
      soglie: { A: 21, B: 9, C: 25, D: 10 },
      contributo: { percentuale: 35, massimali: { 2025: 150000, 2026: 150000, 2027: 150000 } },
      dotazione: { 2025: 330000, 2026: 370000, 2027: 357000 },
      durataMin: 50,
      greenFilm: false,
      testoQualita: 'trattamento',
    },
    {
      id: 'cortometraggio',
      nome: 'Cortometraggi',
      griglia: 'A',
      soglie: { A: 17, B: 13, C: 25, D: 10 },
      contributo: { percentuale: 35, massimali: { 2025: 15000, 2026: 15000, 2027: 15000 } },
      dotazione: { 2025: 26024.49, 2026: 34232.62, 2027: 32742.89 },
      durataMaxEsclusa: 52,
      greenFilm: false,
      testoQualita: 'sceneggiatura',
    },
  ],
  griglie: { A: GRIGLIA_A, B: GRIGLIA_B },
  // Allegati del dossier (art. 8.2). "sempre": obbligatori; gli altri dipendono dal progetto.
  allegati: [
    { tipo: 'modulo1', nome: 'Modulo I — Istanza (PDF firmato digitalmente)', obbligo: 'sempre', formati: ['pdf'], unico: true },
    { tipo: 'modulo2', nome: 'Modulo II — Scheda di produzione (PDF, unico file)', obbligo: 'sempre', formati: ['pdf'], unico: true },
    { tipo: 'modulo3', nome: 'Modulo III — Dati di produzione (.xls, unico file)', obbligo: 'sempre', formati: ['xls'], unico: true },
    { tipo: 'identita', nome: 'Documento d’identità del legale rappresentante', obbligo: 'sempre', formati: ['pdf'] },
    { tipo: 'sceneggiatura', nome: 'Sceneggiatura (trattamento per documentari)', obbligo: 'sempre', formati: ['pdf'] },
    { tipo: 'cv_societa', nome: 'Curriculum del soggetto proponente', obbligo: 'sempre', formati: ['pdf'] },
    { tipo: 'cv_regista', nome: 'Curriculum regista/i', obbligo: 'sempre', formati: ['pdf'] },
    { tipo: 'cv_autori', nome: 'Curriculum sceneggiatore/i (autore o consulente scientifico per i documentari)', obbligo: 'sempre', formati: ['pdf'] },
    { tipo: 'green_film', nome: 'Contratto o accordo pre-contrattuale per la certificazione Green Film', obbligo: 'green' },
    { tipo: 'accordi_cast', nome: 'Contratti, deal memo o lettere di intento con artisti e tecnici', obbligo: 'punteggio', criteri: ['3.2', '3.3'] },
    { tipo: 'coproduzione', nome: 'Coproduzione/produzione associata: CV dei soggetti, deal memo o contratti', obbligo: 'se_dichiarato' },
    { tipo: 'distribuzione', nome: 'Accordi di distribuzione: deal memo o contratti', obbligo: 'se_dichiarato', criteri: ['5.2'] },
    { tipo: 'finanziamenti', nome: 'Atti di concessione di altri finanziamenti pubblici', obbligo: 'se_dichiarato' },
    { tipo: 'referenze_bancarie', nome: 'Referenze bancarie sulle risorse proprie', obbligo: 'punteggio', criteri: ['5.1'] },
    { tipo: 'finanziatori_esterni', nome: 'Finanziatori esterni (tax credit esterno, product placement): deal memo o contratti', obbligo: 'se_dichiarato' },
    { tipo: 'produttore_esecutivo', nome: 'Produttore esecutivo: CV, deal memo o contratto', obbligo: 'se_dichiarato' },
    { tipo: 'piano_lavorazione', nome: 'Piano di lavorazione con le location siciliane', obbligo: 'consigliato' },
  ],
  // Requisiti di ammissibilità che il software non può dedurre dai numeri: si spuntano a mano.
  requisiti: [
    { id: 'ateco', testo: 'Codice ATECO 59.11 primario o prevalente da almeno 24 mesi (Registro delle Imprese)' },
    { id: 'attivita', testo: 'In attività da almeno due anni, nessuna procedura concorsuale in corso' },
    { id: 'quota', testo: 'Produttore unico, oppure coproduttore/produttore associato con quota non inferiore al 20%' },
    { id: 'regolarita', testo: 'Regolarità fiscale, contributiva (DURC) e assicurativa' },
    { id: 'difficolta', testo: 'Non è impresa in difficoltà (Reg. UE 651/2014) e non ha ordini di recupero pendenti' },
    { id: 'revoche', testo: 'Nessuna revoca o rinuncia a contributi Sicilia Film Commission negli ultimi due anni solari' },
    { id: 'riprese', testo: 'Riprese in Sicilia non iniziate prima dell’invio dell’istanza' },
    { id: 'unica', testo: 'Una sola istanza per categoria in questa finestra annuale' },
    { id: 'italiano', testo: 'Tutta la documentazione è in lingua italiana' },
    { id: 'contenuti', testo: 'L’opera non è promozionale, istituzionale o di intrattenimento TV e non contiene messaggi vietati (art. 5.2)' },
    { id: 'pec', testo: 'Invio unico via PEC dalla casella indicata nel dossier, con l’oggetto previsto dall’Avviso' },
  ],
  // Scadenze che decorrono dalla notifica del decreto di concessione provvisoria.
  scadenze: [
    { id: 'riprese', etichetta: 'Fine delle riprese (o delle lavorazioni, per l\u2019animazione)', mesi: 18, preavvisoGiorni: 30, nota: 'Art. 12 lett. g) e art. 14: proroga una sola volta, per non più di 6 mesi, da chiedere almeno 30 giorni prima della scadenza. Oltre il termine il contributo è revocato (art. 18).' },
    { id: 'rendiconto', etichetta: 'Rendicontazione finale, copia campione e richiesta della seconda quota', mesi: 24, preavvisoGiorni: 30, nota: 'Art. 12 lett. h), art. 15 e art. 16: conto consuntivo e matrice di rendicontazione asseverati da un revisore legale; proroga fino a 6 mesi con richiesta almeno 30 giorni prima.' },
  ],
  scadenzeNote: [
    'Uscita in sala o messa in onda (fruizione pubblica per documentari e cortometraggi): da documentare entro 6 mesi dalla liquidazione della seconda quota (art. 12 lett. q).',
    'Anticipo fino al 60% del contributo: solo con fideiussione bancaria o assicurativa (art. 16).',
  ],
  // Conoscenza fissa: fa parte del programma e accompagna ogni lettura di Claude.
  testi: TESTO_AVVISO_SICILIA,
  moduli: MODULI_SICILIA,
  esiti: ESITI_SICILIA,
  // Edizioni di cui sono pubblici solo i punteggi dei finanziati: storico della soglia di finanziamento.
  esitiFinanziati: FINANZIATI_SICILIA,
  fonti: [
    { nome: 'Avviso pubblico 2025-2027, testo coordinato con il D.D.G. n. 4788 del 22/12/2025', dettaglio: 'testo integrale degli articoli 3-18 e griglie di valutazione (Tabelle A e B)' },
    { nome: 'Dossier di candidatura: Modulo I (Istanza), Modulo II (Scheda di produzione), Modulo III (Dati di produzione)', dettaglio: 'struttura dei campi; il Modulo III .xls viene letto in automatico' },
    { nome: 'D.D.G. n. 2384 del 28/07/2026 — graduatorie della finestra 2026', dettaglio: 'punteggi reali per sezione di 75 progetti valutati (38 film e serie, 25 documentari, 12 cortometraggi)' },
    { nome: 'D.D.G. n. 2698 del 06/08/2025 — beneficiari della finestra 2025', dettaglio: 'punteggi reali per sezione dei 14 progetti finanziati (7 film e serie, 5 documentari, 2 cortometraggi)' },
    { nome: 'D.D.G. n. 2003 del 11/07/2024 — beneficiari della finestra 2024 (avviso precedente)', dettaglio: 'punteggi reali per sezione dei 17 progetti finanziati (9 film e serie, 7 documentari, 1 cortometraggio)' },
  ],
  note: [
    'Punteggio complessivo minimo 65/100, più un punteggio minimo per ciascuna sezione A, B, C e D.',
    'Il primo in graduatoria riceve il 100% del contributo richiesto; gli altri una quota pari al rapporto tra il proprio punteggio e quello del primo.',
    'Le spese ammissibili sostenute in Sicilia devono essere almeno il 150% del contributo (requisito di ammissibilità e causa di revoca).',
    'Il soccorso istruttorio non sana moduli incompleti o documenti mancanti: un allegato obbligatorio assente comporta l’esclusione.',
    'A consuntivo il costo di produzione non può scendere sotto l’80% di quello dichiarato e i parametri che hanno generato punteggio devono essere rispettati.',
  ],
};

export const BANDI_PREDEFINITI = [BANDO_SICILIA];
