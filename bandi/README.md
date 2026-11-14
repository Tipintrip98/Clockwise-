# Bandi per la produzione audiovisiva — schede di Clockwise

Questa cartella contiene i dati dei bandi che Clockwise conosce: per ogni fondo una **scheda** in `dati/<id>.json`, trascritta dal testo ufficiale e verificata da un revisore. Da queste schede lo script `scripts/genera-bandi.mjs` produce i due file che il programma usa davvero:

- `app/js/core/bandi/dati.js` — i bandi inclusi nel programma (Windows, `npm start`, pagina singola);
- `bandi/catalogo.json` — lo stesso contenuto, con impronta SHA-256 per scheda, per il canale di aggiornamento.

La Sicilia ha un modulo a sé (`app/js/core/bando-sicilia.js`) perché porta con sé il testo integrale dell’avviso e i punteggi reali delle graduatorie; i documenti originali sono in `sicilia-2025-2027/`.

**Regola d’oro: nessun numero senza testo ufficiale.** Una scheda diventa *simulabile* (griglia a punti, categorie, soglie) solo se la griglia viene dal testo ufficiale dell’atto e la verifica l’ha confermata o corretta. Altrimenti resta una *scheda informativa*: stato, descrizione, pagina ufficiale, storico delle edizioni, prossima edizione e note, senza griglia. Su questi punteggi un produttore decide se presentare domanda.

## I fondi (revisione del 14 novembre 2026)

| Regione | Bando | Stato | Valutazione | Simulabile | Atto ufficiale | Verifica | Dubbi principali |
|---|---|---|---|---|---|---|---|
| Abruzzo | Produzione audiovisiva 2026 | Chiuso | commissione a punti | sì — 5 categorie, max 100, soglia 60 | Avviso PR FESR Abruzzo 2021-2027, Azione 1.3.1 (DGR 36/2026) | confermata | Alcune fasce assegnano un intervallo di punti, non un valore; graduatoria 2026 non ancora pubblicata. |
| Basilicata | PO Val d’Agri 2026 | Chiuso | commissione a punti | sì — 4 categorie, max 110, soglia 60 | Avviso «PO Val d’Agri 2026», D.D. n. 204/2026 e rettifiche | corretta | Vale solo per l’area della Val d’Agri; C3 e C4 senza fasce; testo consolidato inesistente. |
| Calabria | Regolamento contributi 2026 | Chiuso | misto (sportello con punteggio) | sì — 6 categorie, max 100, soglia 60 | Regolamento Calabria Film Commission 2026 (14/04/2026) | confermata | Settimane di lavorazione approssimate con i giorni di riprese; sezioni numerate in trascrizione. |
| Campania | Piano Cinema 2026 | Chiuso | commissione a punti | sì — 3 categorie, max 100, soglia 60 | Avviso Piano Cinema Campania 2026 (L.R. 30/2016) | confermata | Soglia sulla somma delle sezioni 1 e 2; copertura finanziaria con punti a scelta dentro la fascia. |
| Emilia-Romagna | Produzione, imprese nazionali e internazionali 2026 | Chiuso | commissione a punti | sì — 4 categorie, max 100, soglia 70 (80 in Sezione A) | Bando 2026, Allegato 1 alla DGR n. 2175/2025 | corretta | Contributo a importo fisso (A) o per voce di spesa (B), non simulato; confine del contributo ridotto da chiarire; bando 2027 non uscito. |
| Friuli Venezia Giulia | FVG Film Fund 2026-2027 | Atteso (call dal 4/1/2027) | commissione a punti | sì — 4 categorie, max 100, soglia 75 | DPReg. n. 0167/Pres. del 2022, testo coordinato al DPReg. 01/2026 | corretta | Nessun sotto-criterio: tutto a giudizio del Comitato; testo del bando 2026 non pubblicato; percentuale di contributo legata al punteggio. |
| Lazio | Cinema International 2026 | Chiuso | commissione a punti | sì — 3 categorie, max 90, soglia 50 | Avviso, Det. n. G03117 del 10/03/2026 | corretta | La tabella dichiara «Totale 100» ma i massimi sommano a 90: usata la somma. |
| Liguria | Attrazione di produzioni audiovisive 2026 | Chiuso | commissione a punti | sì — 2 categorie, max 191 | Bando PR FESR 2021-2027, Azione 1.3.4 «attrazione» (3/8/2026) | corretta | Il bando non dichiara un massimo (191 è la somma della tabella); minimo 50 sui criteri 1 + 5 e zero escluso negli elementi del criterio 1. |
| Liguria | Sviluppo e produzione 2026 — sottomisura Produzione | Chiuso | commissione a punti | sì — 4 categorie, max 171 | Bando PR FESR 2021-2027, Azione 1.3.4 «sviluppo e produzione» (3/8/2026) | corretta | Come sopra, minimo 45 sui criteri 1 + 5; criteri 6.1-6.3 senza fasce. |
| Liguria | Sviluppo e produzione 2026 — sottomisura Sviluppo | Chiuso | commissione a punti | sì — 4 categorie, max 118 | Bando PR FESR 2021-2027, Azione 1.3.4 «sviluppo e produzione» (3/8/2026) | corretta | Come sopra, minimo 40 sui criteri 1 + 5. |
| Lombardia | Lombardia per il cinema, 2ª edizione 2025-2026 | Chiuso | commissione a punti | sì — 6 categorie, max 102 (100 + 2 di premialità), soglia 50 su A-F | d.d.s. n. 15573/2025 (BURL 7/11/2025), Allegato 1 aggiornato | corretta | Contributo al 50% della spesa in Lombardia, non del costo; nessuna terza edizione annunciata. |
| Marche | Sostegno alla produzione audiovisiva 2025 | Chiuso | commissione a punti | sì — 5 categorie, max 105, soglia 60 | Bando 2025, PR Marche FESR 2021-2027, Azione 1.3.3 | corretta | Griglia 2025, nessuna edizione 2026; contributo proporzionale al punteggio senza formula. |
| Molise | Produzione cinema e audiovisivo 2022 | Chiuso (edizione unica) | commissione a punti | sì — 3 categorie, max 100, soglia 40 su A-E | D.D. n. 5146 del 07/09/2022, Allegato 1 | corretta | Riferimento storico: nessuna edizione successiva; pagina regionale irraggiungibile il 14/11/2026. |
| Piemonte | Piemonte Film TV Fund 2026 | Chiuso | commissione a punti | sì — 6 categorie, max 102 (100 + 2 di premialità), soglia 50 sui criteri 1-11 | D.D. n. 145/A2003D/2026 (BUR 16/4/2026) | confermata | Contributo sulle spese in Piemonte (70%/40%), non sul costo; criterio 7f dell’animazione contraddittorio; bando 2027 non uscito. |
| Puglia | Apulia Film Fund 2026 | Chiuso | commissione a punti | sì — 6 categorie, max 100, soglia 60 | Avviso Apulia Film Fund 2026 (BURP 3/9/2026) | confermata | Colonna dei punteggi della sezione C sfalsata nel PDF; C3-C5 senza fasce. |
| Sardegna | Lungometraggi L.R. 15/2006 — 2026 | Chiuso | commissione a punti | sì — 1 categoria, max 100, soglia 50 (40 su A + B) | Bando 2026, artt. 7 e 12 della L.R. 15/2006 | corretta | Bando 2027 non uscito e regole cambiate tra 2025 e 2026; criterio H senza regola di graduazione. |
| Sicilia | Avviso 2025-2027 | Aperto | commissione a punti | sì — 3 categorie, max 100, soglia 65 | Avviso 2025-2027, testo coordinato con D.D.G. n. 4788/2025 | confermata | Modulo dedicato, tarato sui punteggi reali delle graduatorie. |
| Toscana | Produzione audiovisiva, edizione 2026 attesa | Atteso | commissione a punti | **no** — scheda informativa | Bando 2024 (decreto n. 25757/2024); DGR n. 1181/2026 per il 2026 | corretta | La griglia 2024 è superata: la DGR 1181/2026 ha cambiato i pesi di sezione, ma i punti dei criteri 2026 non sono pubblicati. |
| Trentino-Alto Adige (Bolzano) | IDM Film Fund 2024-2026 | Aperto (call 12/1/2027) | selettiva senza punteggio | **no** — scheda informativa | Delibera della Giunta provinciale n. 269/2024, Allegato A | senza griglia | Nessun punteggio: parere a maggioranza del gruppo di esperti; nuovi criteri per il 2027 non ancora pubblicati. |
| Trentino-Alto Adige (Trento) | Trentino Film Fund 2026 | Sospeso | commissione a punti | sì — 4 categorie, max 100, soglia 65 | Criteri del Fondo (delib. n. 1827/2016 e successive modifiche) | corretta | Domande sospese dal 6/10/2026; contributo = richiesta × punteggio ÷ 100, non simulato; minimi di spesa diversi per categoria. |
| Umbria | Umbria Film Fund 2026-2027 | Aperto (fino al 31/12/2026) | commissione a punti | sì — 6 categorie, max 112 (100 + 12 di premialità), soglia 60 su A-C e 32 in A | D.D. n. 5071 del 25/05/2026, integrata dalla D.D. n. 7987/2026 | confermata | Fasce sovrapposte sulle giornate (categoria b); denominatori delle quote di spesa non definiti. |
| Valle d’Aosta | Film Fund FCVDA 2025-2026 | Chiuso (fondo esaurito) | commissione a punti | sì — 4 categorie, max 100, soglia 60 | Regolamento FCVDA, versione 2025 | corretta | Fondo chiuso da marzo 2026 senza annunci; criteri 5 e 7 letti come «tutto o niente». |
| Veneto | Produzione audiovisiva PR FESR 2026 | Atteso (2ª apertura dall’1/12/2026) | commissione a punti | sì — 5 categorie, max 90, soglia 40 | DGR n. 285 del 28/04/2026, Allegato A | corretta | Esclusione con zero in a.1 o in d.1 + d.2 + d.3 resa come minimo di 2 punti in A e D; penalità di 1 punto senza rating di legalità. |
| Italia | MiC — selettivi 2026, opere prime, giovani autori, corti | Chiuso | commissione a punti | sì — 3 categorie, max 137, soglia 75 | Decreto DGCA rep. n. 1238 del 15/05/2026 | confermata | Il bando non dichiara un massimo (137 è la somma dei criteri); criteri F, G, H letti come fissi. |
| Italia | MiC — selettivi 2026, qualità, documentari, animazione | Chiuso | commissione a punti | sì — 3 categorie, max 147, soglia 80 | Decreto DGCA rep. n. 1238 del 15/05/2026 | confermata | Come sopra (147 è la somma dei criteri). |
| Europa | MEDIA — TV and Online Content 2027 | Aperto | commissione a punti | sì — 3 categorie, max 100, soglia 70 | Call CREA-MEDIA-2027-TVONLINE (30/09/2026) | corretta | Esclude le opere nate per la sala; subordinato al bilancio UE 2027. |

I dubbi completi di ogni fondo sono in `affidabilita.dubbi` della scheda e compaiono nel programma (pagina **Bandi**, dettaglio del fondo). L’esito della revisione indipendente è in `verifica`.

### Regole speciali usate

Il motore applica alcune regole oltre alla griglia; le schede le usano solo dove il testo ufficiale le prevede:

- **Soglia su alcune sezioni** (Piemonte, Lombardia, Umbria; Basilicata e Molise): la premialità o la parte fuori soglia è una sezione a parte e la soglia si misura solo sulle sezioni di base (`sogliaSuSezioni`); il punteggio massimo è la somma (per esempio 102 o 112).
- **Soglie combinate** (Liguria, Campania, Lazio): minimi su somme di criteri o sezioni (`soglieCombinate`). In Liguria il divieto di zero negli elementi del criterio 1 è reso come minimo di 0,1 punti per elemento.
- **Penalità** (Veneto): −1 se l’impresa ha i requisiti per il rating di legalità ma non l’ha conseguito (`penalita`).
- **Punteggio massimo diverso da 100**: quando la tabella non dichiara un totale o ne dichiara uno sbagliato, il massimo è la somma dei massimi dei criteri, spiegata nelle note.

Regole che il motore **non** rappresenta e che restano nelle note e nei dubbi: contributo proporzionale al punteggio (Trentino, Marche), percentuale di contributo per fascia di punteggio (Friuli Venezia Giulia, Liguria, Emilia-Romagna), contributo calcolato sulla sola spesa nel territorio (quasi tutte le regioni: i controlli mostrano un tetto sul costo di produzione, da leggere come indicativo), minimi di spesa diversi per categoria (Trentino), pre-valutazione culturale (Trentino).

## Come aggiornare una scheda

1. **Leggi l’atto nuovo per intero** (avviso, bando, regolamento, decreto di modifica) e salvane il testo: la griglia va trascritta da lì, mai da memoria o da siti di terzi.
2. **Modifica `dati/<id>.json`.** Se l’edizione è nuova, conviene creare una scheda con un nuovo identificativo (`<regione>-<slug>-<anno>`) e togliere la vecchia; il nome del file deve essere l’identificativo. Aggiorna sempre:
   - `revisione` (AAAA-MM-GG), `fonte` (numero e data dell’atto), `stato`, `finestre` (solo date scritte nell’atto), `storicoEdizioni`, `prossimaEdizione`;
   - griglie e categorie: la somma dei `max` dei criteri deve dare il `max` della sezione, la somma delle sezioni il `punteggioMassimo`; ogni criterio ha una `famiglia` (decide quali documenti legge la commissione simulata: vedi `app/js/core/docs.js`, `TIPI`); i criteri a fasce usano una metrica di `app/js/core/bandi/schema.js` (`METRICHE`) con soglie nella sua unità, dalla fascia migliore alla peggiore; un numero che non corrisponde a nessuna metrica diventa un criterio `qualitativo` con la regola in `calcolo`; una scala di punteggi fissi diventa un criterio `discreto`;
   - `affidabilita.citazioni` (estratti letterali di tabella e soglie) e `affidabilita.dubbi` (ciò che il testo non scioglie), scritti per chi usa il programma, senza nomi di campi;
   - `verifica`, dopo un controllo indipendente sul testo salvato.
3. **Se una somma non torna**, riapri il testo ufficiale e correggi leggendo; se il testo non scioglie il dubbio, il bando non è simulabile: svuota `griglie` e `categorie` e spiega in `affidabilita.dubbi`.
4. **Rigenera e prova:**
   ```
   node scripts/genera-bandi.mjs           # riscrive app/js/core/bandi/dati.js e bandi/catalogo.json
   node --test test/bandi.test.js          # forma, somme, finestre, prova di calcolo, allineamento
   node scripts/genera-bandi.mjs --controlla
   ```
   Lo script si ferma e dice perché se una scheda non è valida. I testi oltre i limiti di lunghezza della sanificazione vengono troncati: il test lo segnala.
5. **Controlla nel programma** la pagina **Bandi** e la scelta del bando in **+ Nuovo dossier**.
6. Per le pagine ufficiali da sorvegliare vedi `scripts/controlla-bandi.mjs` e `sorgenti.lock.json`.
