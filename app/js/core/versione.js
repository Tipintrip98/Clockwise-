// Identità del programma: una sola fonte per versione, crediti e novità (pannello Aiuto, report, installer).
export const APP = {
  nome: 'Clockwise',
  sottotitolo: 'Bandi Cinema',
  versione: '2.0.5',
  rilascio: '2026-11-17',
  autore: 'Davide Tipaldi',
  ruoloAutore: 'Ideazione, direzione del progetto e sviluppo',
  sito: 'https://www.davidetipaldi.it',
  motore: 'Claude (Anthropic)',
  descrizione: 'Controllo qualità dei dossier per i bandi di cinema e audiovisivo (regionali, nazionali, europei): stima del punteggio della Commissione, verifiche di ammissibilità, strumenti di produzione, finanza, gestione del bando dopo la concessione e area legale.',
};

export const NOVITA = [
  { versione: '2.0.5', data: '2026-11-17', voci: [
    'Pagina Bandi riordinata: si apre subito sul catalogo, con i bandi aperti in cima (prima chi scade prima), poi quelli in arrivo, quelli attesi, i sospesi e i chiusi. Con «Ordina» si torna all’elenco per regione. Il riquadro degli aggiornamenti sta in una riga e si apre da solo quando c’è una novità.',
    'Coproduzione estera al 20%: nei Dati chiave c’è il riquadro «Coproduzione» con la quota del proponente e quella dei coproduttori esteri (se manca, il programma la calcola dal piano finanziario). Sotto il 20% la coproduzione estera conta come partecipazione minore: il controllo lo segnala e il punteggio atteso di internazionalizzazione scende.',
    'Bando Sicilia: quota del proponente sotto il 20% segnalata come bloccante (requisito di ammissibilità, da mantenere fino al rendiconto).',
  ] },
  { versione: '2.0.4', data: '2026-11-17', voci: [
    'Green Film: nella scheda Produzione c’è il disciplinare ufficiale (Edizione 03 – 2024) con tutti i criteri. Scegli quelli che la produzione rispetterà e vedi i punti (minimo 25 su 65, 20 per le società EMAS), il margine, i documenti e le prove sul set da preparare per ogni criterio, il prerequisito obbligatorio e le scadenze della procedura; la scheda si scarica in CSV.',
    'Le richieste Green Film compilate sull’edizione precedente del disciplinare (minimo 20 punti) vengono riconosciute e segnalate; la verifica formale controlla firma, organismo di verifica e punti dichiarati.',
    'Gestione bando per la Sicilia: elenco dei 17 obblighi a pena di revoca del decreto di concessione, da spuntare fase per fase, compresa la certificazione ambientale da documentare a rendiconto.',
    'Dagli atti di un caso reale: contenuto obbligatorio dell’accettazione del contributo, tempi effettivi tra graduatoria, concessione e notifica, modelli che arrivano con il decreto, approvazione dei titoli di testa e di coda, comunicazione delle variazioni della coproduzione.',
    'Umbria Film Fund: registrati un esito reale (progetto non ammesso con 56 punti su un minimo di 60) e i tempi effettivi di valutazione.',
  ] },
  { versione: '2.0.3', data: '2026-11-17', voci: [
    'Il programma impara dai punteggi reali: il voto dei criteri a giudizio è la media pesata tra i commissari simulati e la fascia ricavata dai casi reali, più una parte dello scarto osservato nei dossier di cui si conosce il punteggio vero. Sul dossier reale di prova lo scarto dal punteggio della Commissione è sceso da 3,7 a meno di un punto su 100.',
    '«Salva come caso di taratura» nel Report ora registra anche gli scarti numerici: ogni punteggio reale che inserisci corregge le stime successive dello stesso bando.',
    '«Prova il collegamento»: una richiesta reale di una riga a Claude, con il collegamento e il modello scelti, per sapere subito se le valutazioni funzioneranno su questo computer. La stessa prova entra nel rapporto di diagnosi.',
    'Se il modello scelto non è disponibile per il tuo abbonamento Clockwise ripiega da solo sul modello successivo e lo indica nel report, invece di fermarsi.',
    'Dopo un aggiornamento, la versione nuova chiude da sola quella vecchia rimasta aperta: prima si riapriva la vecchia.',
    'Messaggi di errore del collegamento più precisi: accesso mancante, limite di utilizzo, server sovraccarichi, rete.',
  ] },
  { versione: '2.0.2', data: '2026-11-15', voci: [
    'Il numero di versione è accanto al nome, in alto a sinistra, e in tutti i file pubblicati: Clockwise-Setup-2.0.2.exe, Clockwise-2.0.2.exe, Manuale-Clockwise-2.0.2.pdf.',
    'Ogni versione ha la sua pagina di rilascio su GitHub (v2.0.2); l’indirizzo «releases/latest» porta sempre all’ultima.',
  ] },
  { versione: '2.0.1', data: '2026-11-15', voci: [
    'Collegamento a Claude in tre passi, senza terminale: «Installa Claude Code» scarica e installa il programma ufficiale di Anthropic, «Accedi» apre la pagina di accesso dell’account, poi Clockwise si collega da solo.',
    'Claude Code viene trovato anche se è stato installato dopo l’avvio del computer e non è nel PATH (registro di Windows, cartella dell’installatore ufficiale, npm, WinGet, app Claude desktop).',
    'Diagnosi del collegamento: rapporto completo su Claude Code, accesso, rete e PATH, da copiare e mandare a chi assiste.',
    'Manuale d’uso completo in PDF, incluso nell’installazione.',
  ] },
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
