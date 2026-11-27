---
name: lettura-dossier-bando
description: Regole per leggere i documenti di un dossier di candidatura (moduli PDF compilati, firme, buste .p7m, contratti, visure) senza trarre conclusioni che i documenti non sostengono. Da usare prima di ogni valutazione o verifica di ammissibilità di un dossier per un bando cinema.
---

# Leggere un dossier senza errori di lettura

1. **Moduli compilati.** I valori dei riquadri e le caselle spuntate dei moduli PDF (AcroForm) non sono nel testo stampato: Clockwise li estrae nel blocco «[Campi compilati del modulo]» (`righeCampi` in `app/js/core/docs.js`). Fuori da Clockwise usa `pypdf` (`get_fields`) o le annotazioni di pdf.js. Un modulo non è «in bianco» finché non hai letto i campi.
2. **Firme.** Firme autografe, timbri e sigle inseriti come immagini non compaiono nel testo: controlla a vista (Clockwise aggiunge una «Nota di lettura»). I file estratti da una busta `.p7m` sono firmati digitalmente nella busta. Una firma mancante si segnala solo sui documenti che il bando chiede di firmare: i prospetti tecnici come il **piano di lavorazione non si firmano**.
3. **Collegamenti tra società.** Parti correlate, controllo o compagine comune si affermano solo con una prova: soci, amministratori o partecipazioni in comune da visura o dichiarazioni. **Codice destinatario SDI, carta intestata, modello o metadati del file, stesso consulente** sono elementi generici: non sono prove e non si usano per ipotizzare legami.
4. **Date e numeri.** Confronta titolo, date di riprese e consegna, costi e contributo tra tutti i moduli; segnala le incoerenze come errori materiali da correggere.
5. **Documenti d'identità e dati riservati.** Non aprire i documenti d'identità. I documenti del cliente restano fuori dal repository (scratchpad o `dist/riservato`, che è ignorata da git) e non vanno citati in test o messaggi di commit.
