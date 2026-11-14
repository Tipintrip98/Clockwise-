---
name: spoglio-sceneggiatura
description: Prepara lo spoglio di una sceneggiatura (scene, set, personaggi, fabbisogni per reparto, rischi, VFX) e ne ricava piano di lavorazione, ordine del giorno, stralci e condizioni per gli adempimenti. Da usare quando si chiede uno spoglio, un breakdown, un piano di lavorazione, un DOOD o un ordine del giorno a partire da un copione.
---

# Spoglio e pianificazione dalla sceneggiatura

Il codice che fa i conti è già nel repository: usalo invece di rifarli a mano.

- `app/js/core/sceneggiatura.js` — `dividiScene` (intestazioni INT./EST., «SCENA 12», italiano e inglese), `eseguiSpoglio`, `pianoLavorazione`, `dood`, `elementiPerReparto`, CSV.
- `app/js/core/odg.js` — `calendarioRiprese`, `ordineDelGiorno`, `testoOdg`, `stralci`.
- `app/js/core/condizioni.js` — minori, animali, armi, droni, acqua, luoghi pubblici ricavati dalle scene.

## Regole dello spoglio

1. Si riporta **ciò che la pagina richiede**, niente di più: un elemento dimenticato costa sul set, uno inventato gonfia il preventivo.
2. Per ogni scena: intestazione, INT/EST, luce, set, luogo reale se il testo lo indica, sinossi in una o due frasi, personaggi (maiuscolo, senza parentetiche), comparse con numero stimato, elementi per reparto, rischi.
3. Le pagine si misurano in **ottavi**.
4. Il set «in regione» è un'ipotesi dal nome del luogo: va sempre confermato da chi produce, perché da lì dipendono i giorni sul territorio (criterio 4.1 del bando).

## Piano di lavorazione

Le scene si raggruppano per set, poi per giorno/notte, e si distribuiscono fino alle pagine girabili al giorno (4 di norma). È una bozza: va rifinita con disponibilità degli attori, spostamenti e meteo. Molti giorni di attesa nel DOOD per un interprete principale sono un costo.

## Ordine del giorno

Convocazione troupe 07:00 (17:00 di notte), trucco mezz'ora prima, pronti a girare un'ora dopo, dieci ore di lavorazione. Sempre: set, scene con pagine, cast numerato come nel DOOD, comparse, fabbisogni per reparto, avvertenze di sicurezza, anticipo del giorno dopo.

Verifica: `node --test test/produzione.test.js test/strumenti.test.js`.
