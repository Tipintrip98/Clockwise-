# Clockwise per Windows

Due file, entrambi in `dist/windows/`:

- `Clockwise.exe` — il programma in un solo file (Node.js + server + interfaccia). Doppio clic: si apre una finestra nera con l'indirizzo e subito dopo il browser. Funziona anche senza installazione.
- `Clockwise-Setup-<versione>.exe` — l'installatore, quello da dare agli utenti.

Serve Windows 10 o 11 a 64 bit. Internet serve solo per le chiamate a Claude.

## Come si costruisce

```
npm ci
npm run build:windows
```

Funziona su Windows e su Linux/macOS (da Linux prende dal registro npm il `node.exe` ufficiale della stessa versione del Node locale e ne confronta l'impronta con quella pubblicata su nodejs.org). Servono Node 22 e, per l'installatore, NSIS (`sudo apt-get install -y nsis`, `brew install makensis`, `choco install nsis -y`). Senza NSIS su Linux viene creato solo `Clockwise.exe`, con un avviso.

Opzioni (dopo `--`): `--linux-smoke` mette lo stesso contenuto nel Node di Linux e lo prova davvero; `--senza-installer`; `--installer-obbligatorio`; `--senza-risorse` (non tocca icona e proprietà del file `.exe`).

A ogni push sul ramo di lavoro il workflow `.github/workflows/windows.yml` rifà tutto su un vero Windows e prova l'eseguibile e l'installatore; i due file restano allegati all'esecuzione (Actions → Windows → l'ultima esecuzione → *Artifacts* → `clockwise-windows`).

La pubblicazione non è automatica: Actions → Windows → **Run workflow**, spunta **pubblica**. I file finiscono nella release della versione, `v<versione>`, con il numero di versione nel nome (`Clockwise-Setup-2.0.1.exe`, `Clockwise-2.0.1.exe`, `Manuale-Clockwise-2.0.1.pdf`), segnata come ultima. Indirizzo da dare agli utenti, che porta sempre all'ultima versione:
`https://github.com/<proprietario>/<repository>/releases/latest`

File di questa cartella: `clockwise.nsi` (l'installatore), `clockwise.ico` (l'icona; si ridisegna con `node scripts/windows/genera-icona.mjs`).

## Cosa fa l'installatore

- Installa per il solo utente corrente in `%LOCALAPPDATA%\Programs\Clockwise`: **non servono i diritti di amministratore**.
- Crea i collegamenti «Clockwise» nel menu Start e sul desktop.
- Registra Clockwise in Impostazioni → App → App installate, con il suo disinstallatore.
- Se Clockwise è aperto lo chiude (una valutazione in corso va persa), poi aggiorna i file: per aggiornare basta installare la versione nuova sopra la vecchia.
- In silenzioso: `Clockwise-Setup-<versione>.exe /S` (cartella diversa: `/D=C:\percorso` come ultimo argomento).

## Dove stanno i dati

- Impostazioni e chiave API salvata: `%APPDATA%\Clockwise\config.json` (cioè `C:\Users\<nome>\AppData\Roaming\Clockwise`). Con la variabile `CLOCKWISE_DATA` si sceglie un'altra cartella.
- I dossier: nel browser (archivio locale del sito `http://localhost:5757`). Non sono nella cartella del programma: restano dove sono quando si aggiorna o si disinstalla, ma si vedono solo con lo stesso browser e lo stesso indirizzo.
- Porta: 5757. Se è occupata da un altro programma Clockwise usa la successiva e lo scrive nella finestra; a un indirizzo diverso il browser mostra un archivio diverso, quindi i dossier ricompaiono quando la 5757 torna libera. Se invece Clockwise è già aperto, il secondo doppio clic riapre soltanto il browser.

## Chiudere e disinstallare

- Chiudere: pulsante **Esci** nella barra in alto dell'interfaccia (chiede conferma nel pannello Aiuto → Informazioni e crediti), oppure chiudi la finestra nera.
- Disinstallare: Impostazioni → App → App installate → Clockwise → Disinstalla, oppure `Disinstalla.exe` nella cartella del programma (`/S` per farlo in silenzio). Vengono tolti programma, collegamenti e voce di registro. Il disinstallatore chiede se eliminare anche le impostazioni con la chiave API (in silenzioso le lascia). I dossier nel browser non vengono toccati.

## L'avviso di Windows al primo avvio

I due file **non hanno una firma digitale** (un certificato di firma del codice costa qualche centinaio di euro l'anno). Per questo:

- il browser può dire che il file «non viene scaricato comunemente»: scegli **Conserva** / **Conserva comunque**;
- al primo avvio Windows mostra **«PC protetto da Windows»** (Microsoft Defender SmartScreen), con «Autore: Autore sconosciuto» (in altre finestre «Editore sconosciuto»). Premi **Ulteriori informazioni** e poi **Esegui comunque**. Succede una volta sola per ogni file scaricato.

Nota tecnica: `Clockwise.exe` è il `node.exe` ufficiale con dentro il contenuto di Clockwise. La firma Authenticode di Node.js non sarebbe più valida dopo la modifica, quindi la build la toglie: il file risulta **senza firma** (con `--senza-risorse` resta la firma di Node.js, ma **non valida**). In entrambi i casi Windows lo tratta come programma di autore sconosciuto. Per eliminare l'avviso bisogna firmare `Clockwise.exe` e l'installatore con un proprio certificato (`signtool sign`), dopo la build.

Il motore dentro il file è Node.js (licenza MIT): l'installatore ne copia la licenza in `Licenza Node.js.txt`.
