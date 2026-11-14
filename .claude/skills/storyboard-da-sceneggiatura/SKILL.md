---
name: storyboard-da-sceneggiatura
description: Traduce le scene di una sceneggiatura in uno storyboard fedele al testo: inquadrature con campo, angolazione, movimento, ottica, bozzetto SVG e prompt per generatori di immagini. Da usare quando si chiede uno storyboard, una shot list o i prompt immagine a partire da un copione.
---

# Storyboard fedele alla sceneggiatura

Motore: `app/js/core/storyboard.js` (`generaStoryboard`, `verificaRiferimenti`, `pulisciSvg`, `schemaInquadratura`, `htmlStoryboard`, `csvInquadrature`). Interfaccia: `app/js/ui/storyboard.js`.

## Regole di fedeltà

1. Solo ciò che è scritto nella scena: nessun evento, personaggio od oggetto aggiunto, nessun cambio d'ordine.
2. Ogni azione rilevante e ogni scambio di battute importante ha almeno un'inquadratura.
3. Ogni inquadratura riporta in `riferimento` da 4 a 14 parole **ricopiate alla lettera** dalla sceneggiatura. `verificaRiferimenti` controlla che esistano nel testo: quelle non trovate vanno segnalate, non nascoste.
4. Le scelte di regia sono libere ma rispettano la continuità (180 gradi, raccordi di sguardo e di movimento).

## Campi

CLL, CL, CM, TOT, FI, PA, MF, MPP, PP, PPP, DETT. Per ogni inquadratura anche angolazione, movimento, ottica con focale indicativa, durata in secondi, battuta.

## Bozzetto e prompt

- SVG autonomo `viewBox="0 0 320 180"`, solo forme semplici, sfondo bianco, niente testo né immagini, entro 1.500 caratteri. Passa sempre da `pulisciSvg`; se non è utilizzabile si mostra `schemaInquadratura(campo)`.
- Il bozzetto si mostra come `<img src="data:image/svg+xml…">`, mai inserito nel DOM come markup.
- Prompt in inglese, una frase densa: soggetto e azione, ambiente, luce, campo e angolazione. I personaggi si descrivono solo con i tratti che la sceneggiatura fornisce, senza nomi propri.

Verifica: `node --test test/strumenti.test.js`.
