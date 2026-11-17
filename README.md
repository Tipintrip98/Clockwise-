# Clockwise — controllo qualità dei dossier per i bandi cinema

**Manuale d’uso completo:** [`docs/Manuale-Clockwise.pdf`](docs/Manuale-Clockwise.pdf) (incluso anche nell’installazione per Windows). Si rigenera con `node scripts/genera-manuale.mjs` da `docs/manuale/manuale.html`.

Clockwise legge il dossier di candidatura a un bando pubblico per il cinema e l'audiovisivo e stima il punteggio che la Commissione gli darebbe, criterio per criterio, **prima dell'invio**. Serve come controllo qualità: mostra dove si perdono punti, che cosa manca per essere ammessi e che cosa sistemare. Attorno alla stima ha gli strumenti per tutta la vita del progetto: produzione, finanza, gestione del bando dopo la concessione, area legale.

## Il catalogo dei bandi

Clockwise contiene **25 schede di bando**: le regioni e le province autonome, i contributi selettivi del Ministero della Cultura e Creative Europe MEDIA. Ogni scheda riporta stato, finestre, edizione successiva attesa, categorie, contributo e massimali, allegati, requisiti, scadenze dopo la concessione e fonti ufficiali.

- **Si simulano 23 bandi** con griglia a punti. Ogni griglia è trascritta dal testo ufficiale (avviso, decreto o regolamento) e ricontrollata da una verifica indipendente sullo stesso testo; le citazioni e i dubbi rimasti sono nella scheda («Come è stata verificata la griglia»).
- **Toscana** (bando 2026 non ancora pubblicato, con pesi già cambiati rispetto al 2024) e **Alto Adige** (parere degli esperti senza punteggio) restano schede informative: Clockwise non simula su regole che non ha potuto leggere.
- Le regole particolari sono nel motore: soglia complessiva calcolata solo su alcune sezioni (es. Molise, Lombardia, Umbria), minimi su somme di criteri o sezioni (Liguria, Sardegna, Campania, Lazio), penalità (Veneto), punteggi massimi diversi da 100, contributo proporzionale al primo in graduatoria solo dove il bando lo prevede (Sicilia).
- **«Quale bando vuoi simulare?»**: al primo avvio e a ogni nuovo dossier si sceglie bando, categoria e anno (le finestre note e l'edizione successiva attesa). Il cruscotto mostra **dove conviene presentare** lo stesso progetto: contributo ottenibile, punti dai numeri e profilo di ogni bando.

L'elenco completo, con atto ufficiale ed esito della verifica di ogni fondo, è in [`bandi/README.md`](bandi/README.md).

### Aggiornamento automatico e silenzioso

Due livelli, entrambi silenziosi: si vede qualcosa solo quando c'è una novità.

1. **Canale del catalogo.** Il programma scarica `bandi/catalogo.json`. Una voce entra solo se l'impronta sha256 è esatta, la scheda supera pulizia e controllo e la revisione è più recente di quella in uso; le voci accettate sostituiscono subito i bandi del programma, le altre finiscono nel registro con il motivo. Indirizzo modificabile con `CLOCKWISE_CATALOGO` o `"canaleBandi"` in `data/config.json`.
2. **Pagine ufficiali degli enti.** Il server locale controlla periodicamente la pagina ufficiale di ogni bando e ne ricava l'elenco dei documenti pubblicati: ogni documento mai visto (avviso, decreto, graduatoria, proroga, FAQ) diventa una «novità» nel dettaglio del bando. Se è attiva l'opzione, Claude legge il nuovo avviso e ne ricava una **proposta** di griglia con il confronto: non sostituisce mai la griglia verificata e si attiva solo a mano, come bando «da verificare».
3. Cadenza: all'avvio se sono passate 12 ore, poi ogni 6 ore a programma aperto, più «Controlla ora» nella pagina Bandi. Solo https, nessun indirizzo privato, limiti di tempo e dimensione, nessun dato dell'utente inviato.
4. Per chi mantiene il catalogo: `npm run bandi:controlla` confronta le pagine con `bandi/sorgenti.lock.json`; il workflow `.github/workflows/bandi.yml` lo esegue ogni lunedì e apre una issue con le novità. Dopo aver rivisto una scheda: `npm run bandi` e commit.

**Da sapere:** finché il repository GitHub è privato, il canale del catalogo non è raggiungibile dai programmi installati (risponde 404, gestito in silenzio). Il controllo delle pagine ufficiali funziona comunque.

## Sicilia: testo integrale e graduatorie reali

Non c'è nulla da caricare per far funzionare la valutazione sul bando Sicilia. Clockwise contiene già:

- **il testo ufficiale dell'Avviso** (articoli 3-18) e le griglie di valutazione, trascritte criterio per criterio;
- **la struttura dei Moduli I, II e III** del dossier; il Modulo III in formato .xls viene letto in automatico;
- **la graduatoria reale della finestra 2026** (D.D.G. n. 2384 del 28/07/2026): i punteggi per sezione di tutti i 75 progetti valutati.
- **la graduatoria completa della finestra 2025** (D.D.G. n. 2230 del 02/07/2025): i punteggi per sezione di tutti i 77 progetti valutati, con lo scorrimento del D.D.G. n. 3542/2025;
- **le rettifiche e gli scorrimenti 2026** (D.D.G. n. 2469 e n. 3304/2026) e le **FAQ del 02/02/2026**, che l'Amministrazione dichiara vincolanti per i punteggi;
- **i beneficiari della finestra 2024** (D.D.G. n. 2003 del 11/07/2024, avviso precedente), come storico della soglia di finanziamento.

A ogni lettura Claude riceve gli articoli che riguardano la sezione in esame e la distribuzione dei punteggi reali, che usa come metro. I test automatici verificano che la griglia trascritta sia coerente con i documenti: i 75 esiti reali del 2026 rispettano soglie, fasce e formula del contributo così come sono scritte nel programma. I PDF di origine sono in `bandi/sicilia-2025-2027/`.

Che cosa dice la graduatoria 2026, in breve: su 38 film e serie valutati solo 11 hanno superato tutte le soglie, e 26 dei 27 esclusi sono caduti sulla **sezione D** (piano finanziario e distribuzione). Nei documentari 12 erano ammissibili ma solo 8 finanziati: l'ultimo ha preso 80,2 punti.

## Installazione su Windows

Per chi usa Windows c'è il **programma di installazione** `Clockwise-Setup-<versione>.exe`: si installa per il solo utente (non chiede i permessi di amministratore), crea le icone nel menu Start e sul desktop e si disinstalla da *App installate*. All'avvio apre Clockwise nel browser predefinito; per chiuderlo c'è **Esci** nella barra in alto. Non serve installare Node.js.

Il pacchetto si genera con `npm run build:windows` e, a ogni aggiornamento del repository, viene costruito e provato su un vero Windows dal flusso automatico `.github/workflows/windows.yml`: i file restano allegati all'esecuzione, e si pubblicano tra i rilasci solo su richiesta (Actions → Windows → Run workflow → *pubblica*). Dettagli, limiti e avvisi di Windows (SmartScreen) sono in [`installer/LEGGIMI.md`](installer/LEGGIMI.md).

### Firma digitale dell'eseguibile

Senza firma Windows mostra «Editore sconosciuto» e SmartScreen blocca il primo avvio. Il pacchetto è già pronto per essere firmato: eseguibile, disinstallatore e installatore si firmano da soli appena è configurato un certificato di **firma del codice** (Authenticode) rilasciato da un'autorità riconosciuta e intestato alla società.

1. Procurarsi il certificato a nome della società (verifica dell'identità da parte dell'autorità). Dal 2023 la chiave privata sta su un dispositivo sicuro (token USB) o in un servizio di firma in cloud.
2. Nella CI: in GitHub → Settings → Secrets and variables → Actions aggiungere `WINDOWS_CERT_PFX_BASE64` (il file .pfx in base64) e `WINDOWS_CERT_PASSWORD`. Dalla build successiva i file sono firmati e la CI controlla che la firma sia valida e con marca temporale.
3. In locale: `CLOCKWISE_FIRMA_PFX=certificato.pfx CLOCKWISE_FIRMA_PASSWORD=… npm run build:windows -- --richiedi-firma`. Per token USB o firma in cloud: `CLOCKWISE_FIRMA_COMANDO='<comando che firma {file}>'`. Dettagli in `scripts/windows/firma.mjs`.

Un certificato fatto in casa (autofirmato) non toglie l'avviso sui computer degli altri: vale solo dove viene installato a mano tra i certificati attendibili, per esempio sui PC della società. Anche con un certificato riconosciuto SmartScreen può avvisare per le prime settimane, finché il certificato non acquista reputazione.

## Avvio da sorgente

Serve [Node.js](https://nodejs.org) 20 o successivo.

```bash
npm install     # solo la prima volta
npm start
```

Poi apri **http://localhost:5757** nel browser.

## Collegare Claude

Clockwise fa leggere i documenti a Claude con il tuo accesso. Nella pagina **Collegamento** puoi configurare entrambi i modi e scegliere quale usare.

| Modo | Che cosa serve | Costo |
|---|---|---|
| **Account Claude** | [Claude Code](https://claude.com/claude-code) installato sul computer e login fatto (`claude`, poi `/login`) | Rientra nell'abbonamento Claude |
| **Chiave API Anthropic** | Una chiave creata su console.anthropic.com, incollata nella pagina Collegamento | A consumo |

Il modello predefinito è **Claude Fable 5.2**; nella scheda Valutazione puoi sceglierne un altro.

C'è anche una terza strada, senza installare niente: la stessa interfaccia pubblicata come pagina nell'app Claude, che usa l'account di chi la apre. Si genera con `npm run build:artifact` (file `dist/clockwise.html`).

## Come si usa

Al primo avvio una **guida in sette passi** mostra dove trovare le cose; la prima volta che apri una scheda compare un suggerimento su come usarla. Tutto si ritrova nel pulsante **Aiuto** in alto (guida, novità della versione, informazioni e crediti).

Ogni dossier si apre sul **Cruscotto**:

- un **semaforo** dice se il dossier si può inviare (rosso: problemi bloccanti; giallo: cose da sistemare; verde: pronto) e propone il prossimo passo;
- **Da sistemare** elenca i problemi in ordine di gravità, ognuno con il pulsante che porta al punto in cui correggerlo;
- **Previsione prima della valutazione**: le sezioni non ancora lette da Claude vengono completate con i punteggi che la Commissione ha realmente dato ai progetti dell'ultima finestra, e vedi in quanti casi il dossier sarebbe ammissibile e in quanti sopra l'ultimo finanziato. Non serve Claude;
- **Invio**: date della finestra con i giorni mancanti, indirizzo PEC e oggetto pronti da copiare, regole di formato, elenco dei file da allegare con ciò che manca.

Le quattro schede numerate sono i passi della valutazione:

1. **Documenti** — trascina i file del dossier: Moduli I, II e III, sceneggiatura, curriculum, contratti, deal memo, lettere di intento. Il tipo di ogni file viene riconosciuto dal nome e si può correggere. I PDF **scansionati** (contratti firmati, lettere, curriculum) e le fotografie non hanno testo: con **Leggi le scansioni con Claude** vengono letti come immagini e trascritti, con firme e timbri segnalati tra parentesi quadre. Clockwise controlla i **formati** prescritti dall'avviso (Modulo I e allegati in PDF, Modulo II in PDF unico, Modulo III in .xls unico) e la **coerenza con il Modulo III**: accordi dichiarati ma non allegati, documenti allegati ma non dichiarati, nominativi di cast e troupe che non compaiono in nessun accordo, date delle riprese incoerenti.
2. **Dati chiave** — se carichi il **Modulo III in formato .xls**, giorni di lavorazione, professionisti siciliani, budget e piano finanziario si compilano da soli. I punti che dipendono dai numeri si aggiornano mentre scrivi, con le mosse per salire di fascia.
3. **Valutazione** — scegli quanti commissari simulare (1, 3 o 5) e avvia. Ogni commissario legge i documenti della sezione e assegna i punteggi; il risultato è la media, arrotondata al decimale, come fa la Commissione reale.
4. **Report** — punteggio complessivo e per sezione rispetto alle soglie, motivazioni per criterio, controlli di ammissibilità, elenco degli interventi ordinati per punti recuperabili, confronto con la graduatoria reale 2026 e con le soglie di finanziamento degli anni precedenti, stima del contributo.

Con **Report completo (PDF)**, dal Report o dal Cruscotto, si ottiene un documento impaginato con **tutti i dati interni** del dossier: esito e stato dell'invio, interventi, punteggio di ogni criterio con le motivazioni, le evidenze e le criticità di ciascun commissario, controlli e verifica formale, confronto con le graduatorie e con il punteggio reale, stima del contributo, dati chiave e piano finanziario, indicatori calcolati, documenti caricati, parametri della valutazione e, se presenti, le appendici di produzione (piano di lavorazione, preventivo) e legale (contratti, fascicolo). È un documento riservato a uso interno.

### Produzione

La scheda **Produzione** ha cinque sezioni.

- **Spoglio** — Claude legge la sceneggiatura scena per scena e ne ricava personaggi, set, comparse, oggetti di scena, costumi, trucco, veicoli, animali, stunt, effetti e VFX; poi fabbisogni per reparto, rischi da preparare, scene con VFX, **logline, soggetto e sinossi** (il soggetto rispetta le 900 battute del Modulo II).
- **Piano e ordine del giorno** — piano di lavorazione (scene raggruppate per set e per giorno/notte, pagine in ottavi), **calendario** dal primo giorno di riprese con i riposi settimanali, **DOOD**, e per ogni giornata l'**ordine del giorno**: orari, scene, cast convocato, comparse, fabbisogni per reparto, avvertenze di sicurezza, anticipo del giorno dopo. Si copia o si scarica, insieme agli **stralci** della sceneggiatura per quella giornata. I giorni di riprese in Sicilia si riportano nei Dati chiave con un clic (criterio 4.1).
- **Storyboard** — per ogni scena Claude prepara le inquadrature **seguendo la pagina**: campo, angolazione, movimento, ottica, durata, un bozzetto e un prompt in inglese per i generatori di immagini. Ogni inquadratura riporta le parole della sceneggiatura a cui corrisponde e il programma controlla che esistano davvero nel testo: quelle senza riscontro sono segnate. Si può caricare un'immagine al posto del bozzetto; lo storyboard si scarica come pagina stampabile e come elenco inquadrature in CSV.
- **Preventivo** — righe di costo assegnate alle voci del budget del Modulo III (A.1-A.9), con la quota spesa in Sicilia: ne escono costo di produzione, costo ammissibile, spesa sul territorio, producer fee (con il limite del 7,5%) e percentuale sopra la linea, da riportare nei Dati chiave. **Importa il Master Budget in Excel** (foglio `BUDGET`): i lordi diventano costo per la produzione (paghe con oneri e TFR, fatture senza IVA) e ogni riga riceve la voce del Modulo III più vicina, che puoi cambiare.
- **Adempimenti** — che cosa serve per girare in regola in Italia, dallo sviluppo alla chiusura: 53 voci con che cosa fare, quando, riferimento e fonte. Le voci su minori, animali, armi, droni, acqua, luoghi pubblici, musica e stunt compaiono solo se lo spoglio le ha trovate in sceneggiatura, con le scene interessate. Le voci non riscontrate su una fonte certa sono segnate «da verificare con il consulente».
- **Green Film** — il disciplinare ufficiale per la certificazione ambientale (Edizione 03 – 2024): scelta dei criteri, punti dichiarati contro il minimo (25 su 65, 20 per le società EMAS), prerequisito, documenti e prove sul set per ogni criterio, scadenze della procedura, scheda in CSV (`app/js/core/greenfilm.js`). Riconosce le richieste compilate sull'edizione precedente.

Spoglio, piano, calendario e inquadrature si scaricano in CSV (si aprono in Excel).

### Finanza

Dai Dati chiave del dossier: piano finanziario con scenari confrontabili, **limite degli aiuti pubblici** (Reg. UE 651/2014 art. 54: 50%, 60% per le coproduzioni transfrontaliere, 80% per le opere difficili), **calcolatore del tax credit** alla produzione secondo il D.I. 225/2024 come modificato dal D.I. 141/2025 e dal D.I. 281/2026 (film al 30%), piano di cassa mensile con quote di erogazione e finanziamento ponte, piano di recupero dei ricavi su tre scenari, indicatori con la formula. Ogni numero normativo porta fonte e data; ciò che non è verificato su un atto ufficiale è marcato «da verificare» o «indicativo».

### Gestione bando

Dopo la concessione: tappe e scadenze con conto alla rovescia, quote di erogazione e fideiussione, registro delle spese (inserimento da tastiera o importazione da CSV/Excel), rendiconto contro preventivo con i controlli del bando, **parametri di punteggio da mantenere** a consuntivo (giorni, professionisti e spesa sul territorio ricalcolati sui criteri) e cronoprogramma.

### Legale

Nella scheda **Legale**:

- **Chiedi al bando** — risposte fondate sul testo ufficiale dell'avviso, con l'articolo citato accanto a ogni affermazione e applicate ai dati del dossier. Ciò che esce dal testo è segnalato come "da verificare".
- **Contratti** — contratti, deal memo, lettere di intento, referenze bancarie e atti di concessione letti uno per uno: parti, oggetto, importi, firma, criterio che sostengono, problemi e correzioni prima dell'invio.
- **Bozze** — quattordici modelli. Per il dossier: lettera di intento, deal memo di distribuzione e di coproduzione, richiesta di referenze bancarie, accordo Green Film, deal memo con il produttore esecutivo. Per la produzione: opzione e cessione dei diritti, liberatorie per immagine, minori, location e marchi, licenza di sincronizzazione, accordo di riservatezza.
- **Fascicolo** — parti, impegni e date chiave ricavati dai moduli e dagli accordi, con il file di provenienza accanto a ogni voce e le incongruenze tra un documento e l'altro.
- **Scadenze** — fine riprese, rendicontazione e termini di proroga calcolati dalla data del decreto.

È un supporto alla preparazione del dossier e dei documenti di produzione, non un parere legale.

### Prova con un dossier già presentato

Se di un dossier conosci il punteggio reale (è pubblicato per sezione nel decreto di graduatoria), caricalo, avvia la valutazione e inserisci i punteggi reali nel riquadro **Prova con un punteggio reale** del report: vedi lo scarto sezione per sezione. Con "Salva come caso di taratura" il caso entra nella conoscenza del bando (Claude ne tiene conto nelle valutazioni successive) e i suoi scarti numerici correggono le stime successive dello stesso bando.

### Apprendimento dai casi reali

Il voto dei criteri a giudizio nasce in due passi (`app/js/core/apprendimento.js`), dichiarati nel report criterio per criterio:

1. **Regole**: media pesata tra i commissari simulati e il centro della fascia che il motore di regole ricava dai casi reali (peso 0,5 se la regola ha un riscontro diretto in un caso reale, 0,25 se è un'estrapolazione).
2. **Casi**: per sezione, una parte dello scarto medio (reale − stima) osservato nei dossier di cui si conosce il punteggio vero, incorporati e salvati dall'utente: `n ÷ (n + 1)` dello scarto medio, con un tetto dell'8% della sezione.

Criteri calcolati, criteri con una tabella del bando e lettura rigorosa non si correggono. Sul dossier reale di prova (punteggio vero 89,5), due valutazioni reali complete: commissari con le fasce nel prompt 87,7 e 87,9; con le regole 88,4 e 88,6; con i casi 88,9 e 89,1. Prima delle fasce la stima era 85,8. È lo stesso caso su cui il programma è tarato: serve un secondo dossier reale per una misura fuori campione.

## Come nasce il punteggio

- **Criteri numerici** (sezione C, copertura finanziaria): li calcola il programma applicando le fasce del bando. Nessuna stima dell'AI: stessi numeri, stesso risultato.
- **Criteri di giudizio** (qualità della sceneggiatura, curriculum, piano finanziario e distributivo): li valuta Claude nel ruolo di più commissari con profili diversi. La forbice tra il più severo e il più generoso dice quanto è solido il risultato.
- **Due letture per ogni criterio di giudizio**: il **punteggio atteso**, cioè quello che la Commissione darebbe secondo il metro dei punteggi reali e la prassi osservata, e la **lettura rigorosa**, cioè i punti che resterebbero contando solo ciò che è provato da documenti idonei e firmati. La differenza è il rischio documentale: se nella lettura rigorosa una sezione scende sotto il minimo, il dossier è segnato «a rischio» anche quando il punteggio atteso supera le soglie.
- **Motore di ragionamento**: le regole ricavate dalla prova sul dossier reale (62 regole su 46 fatti verificabili del dossier, per famiglia di criteri) fissano per ogni criterio una fascia attesa e una rigorosa. Le fasce entrano nelle istruzioni dei commissari simulati; dopo la valutazione il report segnala i criteri in cui la media esce dalla fascia, senza correggere i punteggi. Senza Claude il cruscotto dà una **stima dalle regole**.
- **Soglie**: quelle del bando scelto (in Sicilia 65/100 più il minimo di ogni sezione), comprese soglie su gruppi di sezioni o di criteri. Se una soglia non può essere raggiunta, il report lo dice subito.
- **Ammissibilità**: tetto del contributo, spesa minima sul territorio, quadratura tra budget e piano finanziario, producer fee, allegati obbligatori, incoerenze tra i moduli.

Dove il testo del bando si presta a due letture (per esempio la base di calcolo dei giorni di lavorazione), il report mostra entrambe.

### Prova su un dossier reale

Il metro è stato messo alla prova su un dossier vero: un film già finanziato in una finestra precedente, caricato così come fu presentato (24 file, 12 dei quali scansioni lette da Claude) e valutato alla cieca da tre commissari simulati.

| Sezione | Commissione reale | Stima alla cieca (metro 1.2) | Stima con il metro corretto (1.3) |
|---|---|---|---|
| A · Qualità del progetto | 19,8 | 16,7 | 18,7 |
| B · Soggetti proponenti e coinvolti | 16,6 | 5,7 | 14,7 |
| C · Impatti in Sicilia | 30,0 | 30,0 | 30,0 |
| D · Solidità economico-finanziaria | 23,1 | 1,3 | 22,7 |
| **Totale** | **89,5** | **53,7** | **86,1** |

Che cosa ha insegnato la prova:

- la sezione C, calcolata dai numeri, coincide al decimale;
- alla cieca il simulatore era **molto più severo** della Commissione nelle sezioni B e D: applicava alla lettera i principi di attribuzione (nessun accordo firmato, nessun punto), mentre la Commissione ha riconosciuto ciò che era dichiarato nei moduli e allegato;
- la copertura finanziaria reale è compatibile solo con il calcolo sul costo **al netto del contributo richiesto**, che ora è la lettura principale;
- da qui la doppia lettura: la severità di prima non è andata persa, è diventata la «lettura rigorosa».

La terza colonna **non è una prova alla cieca**: il metro è stato corretto proprio su questo caso. Per sapere quanto vale su un dossier mai visto serve almeno un secondo caso reale, meglio se escluso o non finanziato. La prassi ricavata è in `prassi` dentro `app/js/core/bando-sicilia.js` e va aggiornata a ogni nuovo caso.

## Bandi da PDF e conoscenza aggiuntiva

Nella pagina **Bandi**:

- **Aggiungi un bando da PDF**: Claude ricava criteri, fasce e soglie dall'avviso. La griglia resta segnata "da verificare" finché non la controlli sul testo.
- **Conoscenza aggiuntiva**: FAQ, verbali, schede di valutazione ricevute, decreti di modifica, graduatorie di altri anni, casi reali di taratura. Claude li legge a ogni valutazione insieme alla conoscenza fissa.

## Riservatezza

- I file restano sul computer. Il server ascolta solo su `127.0.0.1`.
- A Claude viene inviato il testo dei documenti che servono a ciascuna valutazione, attraverso il collegamento scelto e a nessun altro servizio.
- Il documento d'identità non viene mai inviato.
- La chiave API viene salvata in `data/config.json`, leggibile solo dal tuo utente ed esclusa da git.

## Limiti da conoscere

- È una **stima**: aiuta a trovare i punti deboli, non anticipa né vincola il giudizio della Commissione.
- Il vecchio formato `.doc` non è leggibile: usa PDF, DOCX o XLS. Le scansioni si leggono con Claude, una lettura ogni 8 pagine: la trascrizione va controllata sull'originale per importi, date e firme. Dopo aver riaperto la pagina, per leggere una scansione serve trascinare di nuovo il file. Nell'app Claude la lettura delle scansioni dipende dal permesso di inviare immagini.
- Il piano di lavorazione è una bozza automatica: non conosce disponibilità degli attori, spostamenti e meteo.
- I bozzetti dello storyboard sono schizzi vettoriali di lavoro: servono a discutere la regia, non sostituiscono un disegnatore. Per immagini rifinite si usa il prompt in un generatore esterno e si carica il risultato.
- Il preventivo non stima i costi: riordina quelli che inserisci o importi. La voce del Modulo III proposta per ogni riga va controllata.
- La previsione statistica dice come sono andati i progetti reali, non come andrà il tuo: è sostituita dalla valutazione di Claude appena i documenti sono caricati.
- Gli adempimenti sono un elenco di orientamento aggiornato a novembre 2026: norme, importi e termini cambiano e vanno verificati con i consulenti.
- L'area legale lavora sul testo dell'avviso e sui documenti del dossier: non consulta una banca dati di leggi e sentenze e non gestisce il processo telematico.
- Con l'account Claude nell'app (pagina pubblicata) ogni lettura è limitata a circa 250.000 caratteri: le sceneggiature più lunghe vengono lette in più parti e riassunte in una scheda con estratti. Con il server locale la lettura è integrale.
- La taratura del motore di ragionamento poggia su un solo dossier reale (finanziato, lungometraggio, Sicilia) più le graduatorie: documentari, cortometraggi e famiglie di criteri assenti in Sicilia sono estrapolazioni. Un secondo caso reale, meglio se escluso, serve a confermarla.
- Le griglie degli altri bandi sono verificate sul testo ufficiale, ma per nessuno di loro c'è ancora una prova su un dossier reale: la stima vale come controllo della struttura del dossier rispetto alla griglia.
- Costi di fideiussione, sconto del tax credit, finanziamento ponte e percentuali del piano di recupero sono stime di mercato senza fonte ufficiale: vanno sostituiti con i valori reali.
- Il collegamento con chiave API è verificato con test automatici su un servizio simulato, non ancora con una chiave reale. Il collegamento con account Claude è provato dal vivo su Linux (richieste reali, compreso il ripiego di modello); su Windows la build prova su due versioni del sistema l'installazione di Claude Code dal pulsante, la ricerca, la diagnosi e il riconoscimento dell'accesso mancante. La richiesta reale su Windows parte solo se nei segreti del repository c'è `CLAUDE_CODE_OAUTH_TOKEN` (creato con `claude setup-token`).

## Per chi sviluppa

```
bandi/          schede dei bandi (dati/), catalogo pubblicato (catalogo.json), impronte delle pagine ufficiali
                (sorgenti.lock.json), documenti ufficiali della Sicilia
app/            interfaccia (HTML, CSS, moduli JavaScript, nessuna compilazione)
  js/core/bandi/ catalogo dei bandi: forma e controllo delle schede (schema.js), registro (indice.js),
                dati generati da bandi/dati/*.json (dati.js), ricerca e raggruppamento (catalogo.js)
  js/core/      motore di ragionamento e taratura (ragionamento.js, taratura-dati.js), finanza
                (finanza.js, finanza-regole.js), gestione del bando (gestione.js), confronto tra bandi
                (confronto.js), aggiornamenti automatici (aggiornamenti.js), griglia del bando Sicilia ed esiti reali, calcolo dei punteggi e previsione statistica (scoring.js),
                stato dell'invio e controlli incrociati (invio.js), lettura del Modulo III, istruzioni per Claude,
                spoglio e piano (sceneggiatura.js), ordine del giorno (odg.js), storyboard (storyboard.js),
                preventivo e Master Budget (preventivo.js), adempimenti (adempimenti.js, condizioni.js),
                area legale (legale.js), lettura delle scansioni (scansioni.js), report completo in PDF
                (report-dati.js, report-pdf.js), versione e crediti (versione.js)
  js/ui/        pagine: cruscotto, schede del dossier, produzione, legale, aiuto, guida iniziale
  vendor/       lettori di PDF, Word ed Excel, generatore di PDF (jsPDF)
server/         server locale: file statici e ponte verso Claude (API e Claude Code); avvio dell'eseguibile Windows
installer/      programma di installazione per Windows (NSIS), icona, istruzioni
scripts/        pagina singola per l'app Claude, pacchetto Windows
.claude/skills/ istruzioni per Claude Code: valutazione del bando, spoglio, storyboard, rilascio
test/           test automatici
```

```bash
npm test                  # punteggi, bandi, finanza, gestione, taratura, coerenza con i documenti ufficiali
npm run bandi             # rigenera app/js/core/bandi/dati.js e bandi/catalogo.json dalle schede
npm run bandi:controlla   # controlla le pagine ufficiali degli enti
npm run build:artifact    # dist/clockwise.html
npm run build:windows     # dist/windows/Clockwise.exe e programma di installazione
PORT=5858 npm start       # porta diversa
```

La griglia della Sicilia è in `app/js/core/bando-sicilia.js`, il testo dell'avviso in `bando-sicilia-testo.js` (generato da `scripts/estrai-testo-avviso.py`), gli esiti reali in `bando-sicilia-esiti.js`. Quando esce la graduatoria di una nuova finestra si aggiunge lì e la taratura si aggiorna da sola.
