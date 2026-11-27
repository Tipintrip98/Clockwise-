---
name: valutazione-bando-cinema
description: Stima il punteggio che la Commissione darebbe a un dossier di candidatura a un bando regionale per il cinema (Avviso Sicilia 2025-2027 e gli altri bandi del catalogo in bandi/dati) e indica che cosa correggere prima dell'invio. Da usare quando si chiede di valutare, simulare o controllare un dossier, un Modulo III, una sceneggiatura o un piano finanziario rispetto alla griglia del bando.
---

# Valutare un dossier come farebbe la Commissione

La conoscenza del bando è nel repository e va letta, non ricordata:

- `app/js/core/bando-sicilia.js` — griglie A (film, serie, corti) e B (documentari), soglie, categorie, allegati, requisiti, invio.
- `app/js/core/bando-sicilia-testo.js` — testo ufficiale degli articoli 3-18.
- `app/js/core/bando-sicilia-esiti.js` — punteggi reali per sezione: 75 progetti del 2026, i 14 finanziati del 2025 e i 17 del 2024.
- `app/js/core/scoring.js` — calcolo delle fasce, soglie, previsione statistica.

## Metodo

1. **Categoria e soglie.** Film/serie e corti usano la Tabella A, i documentari la B. Servono almeno 65/100 **e** il minimo di ogni sezione (film A17 B13 C20 D15; documentari A21 B9 C25 D10; corti A17 B13 C25 D10).
2. **Criteri a fasce (sezione C e 5.1): si calcolano, non si giudicano.** Usa `calcolaMetriche` e `valutaQuantitativo`. Se il bando è ambiguo sul denominatore, riporta la lettura principale e l'alternativa.
3. **Criteri qualitativi: tre letture indipendenti.** Assumi uno alla volta i profili dei commissari in `app/js/core/prompts.js` (`PROFILI`), assegna i punti di ogni criterio con una motivazione ancorata a passi dei documenti, poi fai la media arrotondata a un decimale. Riporta anche minimo e massimo.
4. **Taratura.** Confronta ogni sezione con i quartili reali (`statisticheEsiti`): un punteggio sopra il terzo quartile richiede evidenze fuori dal comune. Nel 2026, 26 film esclusi su 27 sono caduti sulla sezione D.
5. **Ammissibilità prima del punteggio.** `verificheAmmissibilita`, `controlliFormato` e `controlliIncrociati` (`app/js/core/invio.js`): un allegato obbligatorio mancante rende l'istanza irricevibile qualunque sia il punteggio.
6. **Solo ciò che è documentato.** Un accordo non firmato, una fonte senza atto, un nominativo senza lettera di intento valgono zero.

## Che cosa consegnare

- Punteggio per sezione e totale, con forbice e confronto con le soglie.
- Problemi bloccanti, poi gli interventi ordinati per punti recuperabili.
- Posizione rispetto all'ultimo finanziato (film: 80,6 nel 2024, 83,1 nel 2025, 77,1 nel 2026).
- Se serve un documento da consegnare: `creaReportPdf` in `app/js/core/report-pdf.js` produce il report completo in PDF.

Per i selettivi MiC usa anche la skill `valutazione-mic-selettivi`, per Lazio Next Generation `valutazione-lazio-next-generation`; per leggere i documenti segui sempre `lettura-dossier-bando`.

I documenti scansionati non hanno testo: vanno prima letti come immagini (`app/js/core/scansioni.js`), altrimenti contratti e curriculum non entrano nella valutazione.
- La frase: è una stima per il controllo qualità, non anticipa il giudizio della Commissione.

Per provare il calcolo: `npm test` (i test in `test/core.test.js` e `test/conoscenza.test.js` verificano griglie ed esiti).
