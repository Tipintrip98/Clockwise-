# Clockwise — simulatore di punteggio per i bandi cinema

Clockwise legge il dossier di candidatura a un bando regionale per il cinema e l'audiovisivo e stima il punteggio che la Commissione gli darebbe, criterio per criterio, **prima dell'invio**. Serve come controllo qualità: mostra dove si perdono punti, che cosa manca per essere ammessi e che cosa sistemare.

Il primo bando caricato è l'**Avviso pubblico Regione Siciliana 2025-2027** (Sicilia Film Commission, testo coordinato con il D.D.G. n. 4788 del 22/12/2025), con le griglie ufficiali delle Tabelle A e B, le fasce dei criteri quantitativi e i punteggi minimi di sezione.

## Avvio in tre passi

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

1. **Documenti** — trascina i file del dossier: Moduli I, II e III, sceneggiatura, curriculum, contratti, deal memo, lettere di intento. Il tipo di ogni file viene riconosciuto dal nome e si può correggere.
2. **Dati chiave** — se carichi il **Modulo III in formato .xls**, giorni di lavorazione, professionisti siciliani, budget e piano finanziario si compilano da soli. I punti che dipendono dai numeri si aggiornano mentre scrivi, con le mosse per salire di fascia.
3. **Valutazione** — scegli quanti commissari simulare (1, 3 o 5) e avvia. Ogni commissario legge i documenti della sezione e assegna i punteggi; il risultato è la media, arrotondata al decimale, come fa la Commissione reale.
4. **Report** — punteggio complessivo e per sezione rispetto alle soglie, motivazioni per criterio, controlli di ammissibilità, elenco degli interventi ordinati per punti recuperabili, stima del contributo. Si può scaricare o stampare.

## Come nasce il punteggio

- **Criteri numerici** (sezione C, copertura finanziaria): li calcola il programma applicando le fasce del bando. Nessuna stima dell'AI: stessi numeri, stesso risultato.
- **Criteri di giudizio** (qualità della sceneggiatura, curriculum, piano finanziario e distributivo): li valuta Claude nel ruolo di più commissari con profili diversi. La forbice tra il più severo e il più generoso dice quanto è solido il risultato.
- **Soglie**: 65/100 complessivi più il minimo di ogni sezione. Se una sezione non può raggiungere il minimo, il report lo dice subito.
- **Ammissibilità**: tetto del contributo, spesa minima sul territorio (150%), quadratura tra budget e piano finanziario, allegati obbligatori, incoerenze tra i moduli.

Dove il testo del bando si presta a due letture (per esempio la base di calcolo dei giorni di lavorazione), il report mostra entrambe.

## Altri bandi e conoscenza aggiuntiva

Nella pagina **Bandi**:

- **Aggiungi un bando da PDF**: Claude ricava criteri, fasce e soglie dall'avviso. La griglia resta segnata "da verificare" finché non la controlli sul testo.
- **Conoscenza aggiuntiva**: FAQ, graduatorie degli anni scorsi con i punteggi, verbali, decreti di modifica. Claude li legge a ogni valutazione per calibrare la severità: più materiale reale carichi, più la stima si avvicina al metro della Commissione.

## Riservatezza

- I file restano sul computer. Il server ascolta solo su `127.0.0.1`.
- A Claude viene inviato il testo dei documenti che servono a ciascuna valutazione, attraverso il collegamento scelto e a nessun altro servizio.
- Il documento d'identità non viene mai inviato.
- La chiave API viene salvata in `data/config.json`, leggibile solo dal tuo utente ed esclusa da git.

## Limiti da conoscere

- È una **stima**: aiuta a trovare i punti deboli, non anticipa né vincola il giudizio della Commissione.
- Il vecchio formato `.doc` e i PDF scansionati non sono leggibili: usa PDF con testo, DOCX o XLS.
- Con l'account Claude nell'app (pagina pubblicata) ogni lettura è limitata a circa 250.000 caratteri: le sceneggiature più lunghe vengono lette in più parti e riassunte in una scheda con estratti. Con il server locale la lettura è integrale.
- Il collegamento con chiave API è verificato con test automatici su un servizio simulato, non ancora con una chiave reale. Il collegamento con account Claude è provato dal vivo su macOS/Linux; su Windows usa l'installazione nativa di Claude Code.

## Per chi sviluppa

```
app/            interfaccia (HTML, CSS, moduli JavaScript, nessuna compilazione)
  js/core/      griglia del bando, calcolo dei punteggi, lettura del Modulo III, istruzioni per Claude
  js/ui/        pagine
  vendor/       lettori di PDF, Word ed Excel
server/         server locale: file statici e ponte verso Claude (API e Claude Code)
scripts/        generazione della pagina singola per l'app Claude
test/           test automatici
```

```bash
npm test                  # calcolo dei punteggi, lettura del Modulo III, orchestrazione
npm run build:artifact    # dist/clockwise.html
PORT=5858 npm start       # porta diversa
```

La griglia della Sicilia è in `app/js/core/bando-sicilia.js`: se l'avviso viene modificato, si aggiorna lì.
