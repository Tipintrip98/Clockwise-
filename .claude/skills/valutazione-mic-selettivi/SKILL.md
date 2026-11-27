---
name: valutazione-mic-selettivi
description: Valuta un dossier di produzione per i contributi selettivi MiC-DGCA (art. 26 L. 220/2016), in particolare la linea «film di particolare qualità artistica e identità culturale», e stima se rientra tra i finanziati, non solo tra gli ammissibili. Da usare quando si chiede una valutazione, una stima di punteggio o un PDF per un bando ministeriale MiC/DGCA.
---

# Valutare un dossier sui selettivi MiC

Le regole sono nel repository e vanno lette, non ricordate:

- `bandi/dati/italia-mic-selettivi-qualita-2026.json` — griglia T5 (A 50, B 25, C 30, D 15, E 10, F 7, G 5, H 5 = **147**), soglia **80** con minimi **A 30 · B 18 · D 8**, dotazione per linea, contributo (40% dei costi ammissibili, tetto 1,2 M€). Verificata sul D.D. 15 maggio 2026 rep. 1238, Tabella 5. Se esce un bando nuovo, ricontrolla la tabella sul PDF ufficiale prima di valutare.
- `app/js/core/bandi/esiti-mic.js` — graduatorie reali 2025 (solo numeri): `statisticheStoriche`, `collocazionePerQuota`.
- `app/js/core/mic.js` — `stimaMic` (stima sulla griglia MiC) e `concorrenzaStimata` (punti che servono per essere finanziati).

## Metodo

1. **Ammissibile ≠ finanziato.** 80 punti e i minimi rendono il progetto ammissibile. Chi viene finanziato dipende dalla dotazione della sessione: nel 2026 la linea qualità ha 3,75 M€ a sessione (nel 2025 erano 14,85 M€), cioè circa 6 film. Usa `concorrenzaStimata`: oggi indica circa **101–116/147**. Dillo sempre in chiaro.
2. **Taratura sulle graduatorie reali.** Nei finanziati 2025 della linea qualità: sceneggiatura mediana 80% del massimo (minimo 62–68%), regia 80% (minimo 60–65%), cast 70–85%, coerenza economica 70–80%, certificazione ambientale presente in quasi tutti (20 su 23 nella II sessione). Un punteggio sopra queste mediane richiede evidenze fuori dal comune; uno sotto i minimi dei finanziati va motivato con un difetto preciso.
3. **Criteri a punteggio fisso** (F pari opportunità, G coproduzione, H certificazione ambientale): si dichiarano, non si stimano. H vale 5 solo con il contratto o la domanda di certificazione allegati; un impegno scritto nei moduli non basta.
4. **Il minimo che fa cadere.** Il rischio tipico è B (regia + cast, 18 su 25): equivale circa al primo quartile dei finanziati 2025. Se la stima di B è sotto 19, indicalo come rischio principale e spiega che cosa lo alza (lettere d'impegno del cast, note di regia).
5. **Intensità di aiuto.** Somma tutti gli aiuti pubblici (tax credit, selettivi, regioni): oltre il 50% del costo serve la qualifica di opera difficile (fino all'80%) con la relazione prevista dal bando.
6. **Lettura dei documenti:** segui la skill `lettura-dossier-bando`.

## Che cosa consegnare

Due numeri distinti e motivati: la simulazione dei commissari e la stima calibrata sulle graduatorie reali, con forbice (prudente / centrale / favorevole), il confronto con la soglia di ammissione e con la soglia di finanziamento stimata, i rischi sui minimi e gli interventi ordinati per punti recuperabili. È una stima per il controllo qualità, non anticipa il giudizio della Commissione.
