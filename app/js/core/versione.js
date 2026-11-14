// Identità del programma: una sola fonte per versione, crediti e novità (pannello Aiuto, report, installer).
export const APP = {
  nome: 'Clockwise',
  sottotitolo: 'Bandi Cinema',
  versione: '2.0.0',
  rilascio: '2026-11-14',
  autore: 'Davide Tipaldi',
  ruoloAutore: 'Ideazione, direzione del progetto e sviluppo',
  sito: 'https://www.davidetipaldi.it',
  motore: 'Claude (Anthropic)',
  descrizione: 'Controllo qualità dei dossier per i bandi di cinema e audiovisivo (regionali, nazionali, europei): stima del punteggio della Commissione, verifiche di ammissibilità, strumenti di produzione, finanza, gestione del bando dopo la concessione e area legale.',
};

export const NOVITA = [
  { versione: '2.0.0', data: '2026-11-14', voci: [
    'Catalogo dei bandi italiani ed europei per la produzione: per ogni fondo stato, finestre, edizioni successive attese, categorie e metodo di valutazione. Le griglie a punti sono trascritte dai testi ufficiali e ricontrollate da una verifica indipendente; i fondi senza griglia (automatici, a sportello, non attivi) restano come schede informative.',
    '«Quale bando vuoi simulare?»: scelta guidata di bando, categoria e anno, anche nella guida del primo avvio; confronto dello stesso progetto su più bandi.',
    'Aggiornamento automatico e silenzioso dei bandi: catalogo controllato e integrato da solo, controllo periodico delle pagine ufficiali degli enti con segnalazione dei documenti nuovi e lettura dei nuovi avvisi come proposta da verificare.',
    'Motore di ragionamento: le regole ricavate dalla prova sul dossier reale sono codice, con fasce attese e rigorose per ogni criterio, segnalazione degli scostamenti dei commissari simulati e stima senza Claude.',
    'Motore multi-bando: metriche per qualunque territorio (percentuali, giorni, numero, euro), soglie su gruppi di sezioni o di criteri, penalità, regola del contributo propria di ogni bando.',
    'Scheda Finanza: piano finanziario con scenari, limite degli aiuti pubblici, calcolatore del tax credit (norme 2026), piano di cassa, piano di recupero, indicatori.',
    'Scheda Gestione bando: tappe e scadenze, quote di erogazione, registro delle spese con importazione, rendiconto, parametri di punteggio da mantenere, cronoprogramma.',
    'Nuova interfaccia: carattere Inter incluso nel programma, colori per area e per sezione, temi chiaro e scuro rifiniti.',
  ] },
  { versione: '1.3.0', data: '2026-11-14', voci: [
    'Metro della Commissione corretto dopo la prova alla cieca su un dossier reale già finanziato: la stima era molto più severa del punteggio vero nelle sezioni B e D; con il metro corretto lo scarto sullo stesso caso è sotto i 4 punti su 100.',
    'Due letture per ogni criterio di giudizio: punteggio atteso e lettura rigorosa. La differenza è il rischio documentale; un dossier sopra le soglie solo nella lettura attesa è segnato «a rischio».',
    'Copertura finanziaria calcolata sul costo al netto del contributo richiesto, la sola lettura compatibile con il punteggio reale.',
    'Beneficiari della finestra 2024 nello storico delle soglie di finanziamento.',
  ] },
  { versione: '1.2.0', data: '2026-11-14', voci: [
    'Report completo in PDF: tutti i dati interni del dossier in un documento impaginato (punteggi, motivazioni di ogni commissario, controlli, confronto con le graduatorie, dati e piano finanziario, documenti, appendici di produzione e legale).',
    'Lettura delle scansioni: Claude legge come immagini i PDF senza testo e le fotografie (contratti firmati, lettere, curriculum) e ne trascrive il contenuto, segnalando firme e timbri.',
    'Le date delle riprese scritte nel Modulo III come data di Excel vengono riconosciute.',
  ] },
  { versione: '1.1.0', data: '2026-11-14', voci: [
    'Cruscotto del dossier: stato dell’invio, problemi in ordine di gravità con il collegamento al punto da correggere, date della finestra, PEC e oggetto pronti da copiare.',
    'Previsione statistica sui punteggi reali della Commissione, disponibile anche prima della lettura di Claude.',
    'Storyboard dalla sceneggiatura, ordine del giorno, stralci, preventivo con importazione del Master Budget e adempimenti di produzione.',
    'Area legale: fascicolo con parti e date chiave, nuovi modelli di documento.',
    'Controlli incrociati tra Modulo III e allegati; storico delle soglie di finanziamento 2025 e 2026.',
    'Guida al primo utilizzo, pannello Aiuto e programma di installazione per Windows.',
  ] },
  { versione: '1.0.0', data: '2026-11-13', voci: [
    'Stima del punteggio con commissione simulata, griglie ufficiali dell’Avviso Sicilia 2025-2027 e graduatoria reale 2026.',
    'Spoglio della sceneggiatura, piano di lavorazione, DOOD; domande sul bando, analisi dei contratti, bozze.',
  ] },
];
