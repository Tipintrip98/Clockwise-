---
name: rilascio-clockwise
description: Prepara un rilascio di Clockwise: numero di versione, test, pagina per l'app Claude e pacchetto di installazione per Windows. Da usare quando si chiede di rilasciare, pubblicare, aggiornare la versione o rifare l'installer.
---

# Rilasciare Clockwise

1. **Versione in due punti, uguali:** `app/js/core/versione.js` (`APP.versione`, `APP.rilascio`, una voce in testa a `NOVITA`) e `package.json`. Un test fallisce se non coincidono.
2. **Test:** `npm test`. Devono passare tutti.
3. **Pagina per l'app Claude:** `npm run build:artifact` genera `dist/clockwise.html` (un solo file). Si pubblica come artifact con le capacità `sample` e `downloads`, sempre dallo stesso percorso per mantenere lo stesso indirizzo.
4. **Windows:** `npm run build:windows` genera `dist/windows/Clockwise.exe` e il programma di installazione. I dettagli e i limiti sono in `installer/LEGGIMI.md`; la prova vera su Windows la fa il flusso `.github/workflows/windows.yml` a ogni push.
5. **Che cosa dire a chi usa il programma:** che cosa è stato provato davvero e che cosa no. Non dichiarare provato su Windows ciò che è stato solo compilato.

I crediti (pannello Aiuto → Informazioni) leggono autore e versione da `versione.js`: non scriverli altrove.
