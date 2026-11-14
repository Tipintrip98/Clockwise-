# Fonti ufficiali — Sicilia 2025-2027

Documenti pubblici della Regione Siciliana (Dipartimento Turismo, Sport e Spettacolo — Sicilia Film Commission) da cui è ricavata la conoscenza fissa di Clockwise.

| File | Che cos'è | Dove finisce nel programma |
|---|---|---|
| `Avviso-pubblico-2025-2027-coordinato-DDG-4788-2025.pdf` | Avviso con le modifiche del D.D.G. n. 4788 del 22/12/2025 | `app/js/core/bando-sicilia.js` (griglie, fasce, soglie) e `bando-sicilia-testo.js` (testo degli articoli 3-18) |
| `Modulo-III-Dati-di-produzione-2025-2027.xls` | Modello ufficiale del Modulo III | `app/js/core/modulo3.js` lo legge in automatico |
| `DDG-2384-2026-graduatorie-finestra-2026.pdf` | Elenchi delle istanze ammissibili e non ammissibili, finestra 2026, con i punteggi per sezione | `app/js/core/bando-sicilia-esiti.js` |

I test in `test/conoscenza.test.js` verificano che la griglia trascritta sia coerente con questi documenti: i 75 punteggi reali del 2026 devono rispettare soglie, fasce e formula del contributo così come sono scritte nel programma.
