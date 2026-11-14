// Identità del programma: una sola fonte per versione, crediti e novità (pannello Aiuto, report, installer).
export const APP = {
  nome: 'Clockwise',
  sottotitolo: 'Bandi Cinema',
  versione: '1.3.0',
  rilascio: '2026-11-14',
  autore: 'Davide Tipaldi',
  ruoloAutore: 'Ideazione, direzione del progetto e sviluppo',
  sito: 'https://www.davidetipaldi.it',
  motore: 'Claude (Anthropic)',
  descrizione: 'Controllo qualità dei dossier per i bandi regionali di cinema e audiovisivo: stima del punteggio della Commissione, verifiche di ammissibilità, strumenti di produzione e area legale.',
};

export const NOVITA = [
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
