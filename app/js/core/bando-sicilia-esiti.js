// Esiti reali dell'Avviso Sicilia 2025-2027: punteggi attribuiti dalla Commissione a tutti i progetti valutati,
// sezione per sezione, nelle finestre 2026 e 2025 (atti pubblici del Dipartimento regionale Turismo, Sport e Spettacolo).
// Servono a tarare le stime sul metro reale della Commissione e a collocare un dossier in graduatoria.
// Si riportano solo i numeri (non i nomi di società e opere); "n" è il numero d'istanza del decreto.
// L'edizione più recente (anno più alto) è il metro principale; le altre sono casi reali in più (core/scoring.js).
//
// Riga: [n, A, B, C, D, totale, stato, contributo richiesto, contributo concedibile, { dettagli }]
//   stato: 'F' finanziato · 'N' ammissibile ma non finanziato per dotazione esaurita · 'X' non ammissibile (punteggio
//          sotto una soglia) · 'R' ammissibile per punteggio ma uscito dopo la graduatoria (rinuncia, decadenza per mancata
//          accettazione o esclusione ai controlli successivi): conta fra gli ammissibili, non fra i finanziati.
//   dettagli (facoltativi): ridotto = contributo inferiore alla formula dell'art. 11.1 (quota residua della dotazione);
//          scorrimento = finanziato dopo la prima graduatoria, per scorrimento; nota = che cosa dice l'atto.

/* ------------------------------------------------------------------ finestra 2026 */
// D.D.G. n. 2384 del 28/07/2026, allegati 1-3; seconda parte dell'allegato 2 (documentari non ammissibili) sostituita
// dal D.D.G. n. 2469 del 04/08/2026 per errore materiale; beneficiari consolidati dal D.D.G. n. 3304 del 30/09/2026.

const film = [
  [8, 19.1, 17.6, 30, 19.4, 86.1, 'F', 599447.95, 599447.95],
  [4, 20, 17.7, 22, 25, 84.7, 'F', 1000000, 983739.84],
  [93, 20.8, 15.4, 30, 18.4, 84.6, 'F', 445300, 437542.16],
  [74, 21.7, 15, 29, 19.4, 85.1, 'F', 440000, 434889.66],
  [30, 19.3, 14.3, 30, 19.4, 83, 'F', 60000, 57839.72],
  [49, 18.9, 15.9, 30, 16.2, 81, 'F', 450000, 423344.95],
  [3, 19.4, 15.8, 27, 18.6, 80.8, 'F', 450000, 422299.65],
  [20, 20.6, 18.4, 20, 21, 80, 'F', 499000, 463646.92],
  [42, 17.3, 13.7, 29, 18.6, 78.6, 'F', 400000, 365156.79],
  [24, 20.7, 18.4, 23.2, 15.6, 77.9, 'F', 240000, 217142.86],
  [77, 18.8, 15.7, 22.2, 20.4, 77.1, 'F', 750000, 671602.79],
  [2, 18.2, 14, 30, 6, 68.2, 'X'],
  [13, 20.3, 16.9, 24, 2, 63.2, 'X'],
  [16, 17.8, 14.2, 24.6, 0, 56.6, 'X'],
  [21, 18.7, 16.1, 29, 0, 63.8, 'X'],
  [22, 20, 16.6, 27, 2, 65.6, 'X'],
  [28, 20.6, 15.6, 28, 5, 69.2, 'X'],
  [37, 16, 14, 30, 14.6, 74.6, 'X'],
  [38, 16.3, 13.6, 28.6, 11.2, 69.7, 'X'],
  [41, 19.5, 13, 30, 9.6, 72.1, 'X'],
  [43, 18.9, 15.7, 24, 2, 60.6, 'X'],
  [45, 19.5, 16, 26, 2, 63.5, 'X'],
  [47, 19.6, 14.2, 30, 14.4, 78.2, 'X'],
  [51, 17.2, 15.1, 29, 14.6, 75.9, 'X'],
  [54, 19.1, 14, 25, 11.6, 69.7, 'X'],
  [55, 19.2, 14.4, 29.6, 0, 63.2, 'X'],
  [57, 18.2, 14.2, 27.6, 0, 60, 'X'],
  [59, 20.3, 15.7, 27, 0, 63, 'X'],
  [66, 19.5, 16.5, 19.6, 22, 77.6, 'X'],
  [68, 20.6, 14.3, 15, 0, 49.9, 'X'],
  [70, 18.4, 14.9, 27, 2, 62.3, 'X'],
  [80, 19.7, 15.6, 24, 13.2, 72.5, 'X'],
  [84, 19, 14.3, 26.2, 0, 59.5, 'X'],
  [85, 17.9, 13.6, 27.6, 5, 64.1, 'X'],
  [87, 20, 13.7, 25, 2, 60.7, 'X'],
  [90, 20.6, 16.4, 26, 11.2, 74.2, 'X'],
  [92, 20, 16.9, 25.6, 9.6, 72.1, 'X'],
  [100, 19.9, 15.1, 30, 0, 65, 'X'],
];

const documentario = [
  [71, 26.6, 13.3, 26.4, 22, 88.3, 'F', 70000, 70000],
  [26, 25.7, 12.2, 29, 21, 87.9, 'F', 21000, 20904.87],
  [46, 23.7, 11.3, 29, 20, 84, 'F', 60000, 57078.14],
  [11, 26.1, 12.5, 27, 18, 83.6, 'F', 33500, 31716.87],
  [31, 25.3, 11.7, 30, 14.4, 81.4, 'F', 22000, 20280.86],
  [81, 25.6, 12.1, 26.4, 16.4, 80.5, 'F', 150000, 136749.71],
  [18, 25.1, 13.3, 26, 16, 80.4, 'F', 150000, 136579.84],
  [89, 23.4, 13.4, 29, 14.4, 80.2, 'R', 150000, null, { nota: 'Ammessa per la sola quota residua di € 25.685,13: nessuna accettazione entro i 15 giorni dalla notifica, decaduta (D.D.G. n. 3304 del 30/09/2026).' }],
  [91, 22.9, 12.6, 27, 17.8, 79.9, 'R', 100000, null, { nota: 'Ha rifiutato la quota residua offerta per scorrimento (PEC dell’08/09/2026). Nel decreto le sezioni sommano a 80,3.' }],
  [7, 24.7, 11.7, 29, 13.6, 79, 'F', 35000, 25685.13, { ridotto: true, scorrimento: true, nota: 'Finanziata per scorrimento con la quota residua della dotazione, accettata il 14/09/2026 (D.D.G. n. 3304 del 30/09/2026).' }],
  [19, 24, 11.6, 25.8, 12.8, 74.2, 'N', 22500],
  [39, 24.4, 11.7, 26.4, 11.6, 74.1, 'N', 30000],
  // Non ammissibili: valori del D.D.G. n. 2469 del 04/08/2026, che corregge la tabella del 28/07/2026.
  [10, 24.4, 12.6, 23.4, 16, 76.4, 'X'],
  [15, 22.9, 11.2, 27, 0, 61.1, 'X'],
  [17, 24.2, 11.1, 23.2, 0, 58.5, 'X'],
  [33, 24.7, 11.9, 19.6, 13.6, 69.8, 'X'],
  [53, 23.8, 11.4, 24.8, 0, 60, 'X'],
  [56, 22.4, 11.1, 23.4, 5, 61.9, 'X'],
  [60, 23.6, 11.8, 24.6, 5, 65, 'X'],
  [63, 23.2, 12, 27, 2, 64.2, 'X'],
  [64, 25.1, 11.6, 29.4, 0, 66.1, 'X'],
  [69, 24.2, 11.4, 30, 0, 65.6, 'X'],
  [72, 24, 11.9, 29, 2, 66.9, 'X'],
  [86, 24, 11.9, 20, 0, 55.9, 'X'],
  [99, 21.1, 12.2, 21.4, 20.4, 75.1, 'X'],
];

const cortometraggio = [
  [35, 21.9, 17.5, 30, 16.4, 85.8, 'F', 15000, 15000],
  [95, 21, 16.9, 25, 14.8, 77.7, 'F', 15000, 13583.91],
  [5, 20.3, 14, 25, 4, 63.3, 'X'],
  [6, 20, 14, 17.2, 0, 51.2, 'X'],
  [27, 17.4, 15.9, 29, 0, 62.3, 'X'],
  [32, 18.9, 14, 16.2, 0, 49.1, 'X'],
  [34, 17.6, 14.1, 30, 0, 61.7, 'X'],
  [61, 19.7, 15.8, 30, 2, 67.5, 'X'],
  [62, 18.7, 14.1, 27, 0, 59.8, 'X'],
  [76, 18.6, 14, 27, 0, 59.6, 'X'],
  [83, 19.2, 15.7, 21.6, 0, 56.5, 'X'],
  [96, 19.6, 14.2, 28, 2, 63.8, 'X'],
];

/* ------------------------------------------------------------------ finestra 2025 */
// D.D.G. n. 2230 del 02/07/2025: punteggi per sezione di tutti i 77 progetti valutati (105 istanze pervenute).
// Stati e importi consolidati: D.D.G. n. 2698 del 06/08/2025 (controlli e accettazioni) e, per i film, D.D.G. n. 3542
// del 21/10/2025 (scorrimento integrale con risorse aggiuntive del Fondo regionale per il cinema e l'audiovisivo).

const film2025 = [
  [10, 19.5, 14.8, 30, 21.8, 86.1, 'F', 300000, 300000],
  [24, 17.7, 16.3, 30, 21.2, 85.2, 'F', 250000, 247386.76],
  [9, 19.2, 14.6, 29, 21.2, 84, 'F', 445000, 434146.34],
  [20, 19.1, 15.8, 27.2, 21.8, 83.9, 'F', 750000, 730836.24],
  [42, 19.3, 16.5, 23, 25, 83.8, 'F', 750000, 729965.16],
  [6, 19.7, 16.2, 22.2, 25, 83.1, 'F', 750000, 723867.6, { nota: 'Ultimo in capienza, a pari merito: contributo ridotto a € 600.069,86 dal D.D.G. 2698, portato al pieno dal D.D.G. 3542.' }],
  [70, 21.6, 17.5, 26.2, 17.8, 83.1, 'F', 700000, 675609.76, { nota: 'Ultimo in capienza, a pari merito: contributo ridotto a € 560.052,11 dal D.D.G. 2698, portato al pieno dal D.D.G. 3542.' }],
  [104, 19, 15.1, 23, 25, 82.1, 'F', 590000, 562590.01, { scorrimento: true }],
  [29, 18.8, 13.3, 29.2, 19.2, 80.5, 'F', 250000, 233739.84, { scorrimento: true }],
  [51, 21.9, 17.8, 22.2, 17.8, 79.7, 'F', 400000, 370267.13, { scorrimento: true }],
  [8, 19.5, 15, 27.2, 16.5, 78.2, 'F', 330000, 299721.25, { scorrimento: true }],
  [18, 19.2, 14.4, 29, 15.2, 77.8, 'F', 447900, 404722.65, { scorrimento: true }],
  [40, 20.1, 16.7, 24, 16.8, 77.6, 'F', 600000, 540766.55, { scorrimento: true }],
  [84, 19, 14.4, 28.2, 15.2, 76.8, 'F', 750000, 668989.55, { scorrimento: true }],
  [26, 20.1, 15.8, 24.4, 16.2, 76.5, 'F', 750000, 666376.31, { scorrimento: true }],
  [2, 17, 14.5, 27, 17.8, 76.3, 'F', 303000, 268512.19, { scorrimento: true }],
  [58, 17.5, 14.8, 21.2, 21.5, 75, 'F', 300000, 261324.04, { scorrimento: true }],
  [14, 19, 15.2, 22, 18.8, 75, 'F', 300000, 261324.04, { scorrimento: true }],
  [100, 18.4, 14.7, 26.2, 15.2, 74.5, 'F', 548070, 474230.14, { scorrimento: true }],
  [85, 18.8, 13.2, 25.8, 16.2, 74, 'F', 538500, 462822.3, { scorrimento: true }],
  [52, 19.2, 14.8, 21.6, 17.8, 73.4, 'F', 137000, 116792.1, { scorrimento: true }],
  [25, 17.6, 14, 20.2, 17.8, 69.6, 'F', 250000, 202090.59, { scorrimento: true }],
  [94, 18.9, 14, 30, 14.6, 77.5, 'X'],
  [91, 16.7, 14.5, 28.2, 16.8, 76.2, 'X'],
  [39, 17.7, 13.7, 30, 14.6, 76, 'X'],
  [76, 18.9, 14.2, 30, 12.8, 75.9, 'X'],
  [49, 17.2, 13.8, 30, 14.6, 75.6, 'X'],
  [46, 18.3, 15.5, 19, 21.8, 74.6, 'X'],
  [31, 19.7, 15.8, 23.6, 14.8, 73.9, 'X'],
  [79, 16.7, 13.2, 29, 14.6, 73.5, 'X'],
  [87, 19.9, 16.2, 26, 11.2, 73.3, 'X'],
  [71, 17.9, 16, 28, 11.2, 73.1, 'X'],
  [93, 18, 14.7, 29, 11.2, 72.9, 'X'],
  [44, 19.1, 16.1, 26, 11.2, 72.4, 'X'],
  [12, 19.5, 15.1, 27, 10.2, 71.8, 'X'],
  [68, 16.9, 14, 18.8, 21.8, 71.5, 'X'],
  [37, 19.7, 16, 25, 9.6, 70.3, 'X'],
  [33, 19.2, 13.9, 27, 9.6, 69.7, 'X'],
  [81, 17.9, 12.9, 29, 9.6, 69.4, 'X'],
  [38, 18, 13.4, 24, 13.2, 68.6, 'X'],
  [30, 17.8, 12.3, 24, 13.8, 67.9, 'X'],
  [75, 18.7, 15.1, 19.8, 12.8, 66.4, 'X'],
  [78, 18.2, 14.6, 23, 10.6, 66.4, 'X'],
  [50, 19.7, 13.2, 22, 10.9, 65.8, 'X'],
  [82, 16.6, 12.6, 26, 9.6, 64.8, 'X'],
  [66, 17.5, 13.6, 22, 9.9, 63, 'X'],
  [56, 17.7, 13.2, 18.8, 9.9, 59.6, 'X'],
];

const documentario2025 = [
  [59, 23.6, 11.4, 28.4, 20.1, 83.5, 'R', 55000, null, { nota: 'Prima in graduatoria il 02/07/2025, esclusa dopo i controlli dell’art. 11 per mancanza del requisito soggettivo del par. 5.1 (D.D.G. n. 2698 del 06/08/2025).' }],
  [41, 22.5, 11.5, 27, 22, 83, 'F', 70000, 70000],
  [43, 21.1, 9.6, 30, 20.8, 81.5, 'F', 32460, 31873.37],
  [7, 25.5, 11.9, 26.4, 17.2, 81, 'F', 50000, 48795.18],
  [47, 23.3, 12.1, 27, 18.5, 80.9, 'F', 130000, 126710.85],
  [23, 25.6, 12.2, 25.8, 15.8, 79.4, 'F', 150000, 52620.6, { ridotto: true, scorrimento: true, nota: 'Entrata al posto dell’istanza esclusa, per la sola quota residua della dotazione (D.D.G. n. 2698 del 06/08/2025).' }],
  [77, 24.7, 12.2, 26.4, 14.8, 78.1, 'N', 40000],
  [60, 23.6, 11, 29, 12.5, 76.1, 'N', 105000],
  [35, 24.9, 12.6, 27, 11.2, 75.7, 'N', 50000],
  [32, 23.6, 11.1, 27, 11.2, 72.9, 'N', 108000],
  [97, 21.5, 10.4, 27, 11.2, 70.1, 'N', 150000],
  [19, 21.8, 9.6, 26.2, 11.4, 69, 'N', 5250],
  [27, 24.2, 12, 23, 18.8, 78, 'X'],
  [54, 21.7, 10.6, 19, 21.2, 72.5, 'X'],
  [5, 22.4, 11.1, 22.8, 15.5, 71.8, 'X'],
  [22, 24, 11, 24.8, 11.2, 71, 'X'],
  [53, 19.4, 10.3, 24, 17.2, 70.9, 'X'],
  [64, 22.8, 10.9, 27, 9.6, 70.3, 'X'],
  [89, 23.1, 11.5, 26, 9.6, 70.2, 'X'],
  [55, 23.1, 10.5, 20, 15.6, 69.2, 'X'],
  [105, 21.5, 10.9, 27, 9.6, 69, 'X'],
  [16, 25.1, 10.9, 22.6, 9.6, 68.2, 'X'],
  [1, 22.9, 10.1, 14.6, 9.6, 57.2, 'X'],
];

const cortometraggio2025 = [
  [86, 19.3, 16.4, 30, 18.1, 83.8, 'F', 10000, 10000],
  [15, 18.7, 15.9, 29, 12.2, 75.8, 'F', 15000, 13568.02],
  [11, 18.7, 14.6, 29, 11.8, 74.1, 'R', 6000, null, { nota: 'Beneficiaria il 02/07/2025 per la quota residua di € 2.456,47, assente dagli elenchi consolidati del D.D.G. n. 2698 (motivo non indicato): la quota è passata ai film.' }],
  [34, 16.5, 12.9, 29, 14.2, 72.6, 'X'],
  [96, 18.8, 14, 29.6, 9.6, 72, 'X'],
  [83, 18.7, 14.6, 29, 9.6, 71.9, 'X'],
  [69, 16.4, 13.6, 22.2, 9.6, 61.8, 'X'],
];

const righe = (lista) => lista.map(([n, A, B, C, D, totale, stato, richiesto, concedibile, dettagli]) => ({
  n, sezioni: { A, B, C, D }, totale, stato, richiesto: richiesto ?? null, concedibile: concedibile ?? null,
  ...(dettagli?.ridotto ? { ridotto: true } : {}), ...(dettagli?.scorrimento ? { scorrimento: true } : {}), ...(dettagli?.nota ? { nota: dettagli.nota } : {}),
}));

// In ordine dalla più recente. `ultimoInCapienza`: punteggio dell'ultimo finanziato nella prima graduatoria, prima di
// rinunce e scorrimenti (il punteggio dell'ultimo finanziato a consuntivo si ricava dalle righe 'F').
export const ESITI_SICILIA = [{
  anno: 2026,
  fonte: 'D.D.G. n. 2384 del 28/07/2026 — elenchi delle istanze ammissibili e non ammissibili a cofinanziamento, anno 2026; documentari non ammissibili rettificati dal D.D.G. n. 2469 del 04/08/2026; beneficiari consolidati dopo lo scorrimento dal D.D.G. n. 3304 del 30/09/2026',
  url: 'https://www.regione.sicilia.it/istituzioni/servizi-informativi/decreti-e-direttive/ddg-n-2384s9-28072026-approvazione-elenchi-anno-2026-istanze-ammissibili-non-ammissibili-cofinanziamento-inerenti-all-avviso-pubblico-2025-2027',
  atti: [
    { nome: 'D.D.G. n. 2469 del 04/08/2026 — rettifica della seconda parte dell’Allegato 2', url: 'https://www.regione.sicilia.it/istituzioni/servizi-informativi/decreti-e-direttive/ddg-n-2469s9-04082026' },
    { nome: 'D.D.G. n. 3304 del 30/09/2026 — beneficiari consolidati dopo lo scorrimento', url: 'https://www.regione.sicilia.it/istituzioni/servizi-informativi/decreti-e-direttive/servizio-9-ddg-n-3304-30092026' },
  ],
  istanze: 101,
  ultimoInCapienza: { film: 77.1, documentario: 80.2, cortometraggio: 77.7 },
  dotazioneEffettiva: { documentario: 498995.42 },
  note: [
    'Documentari: dotazione salita da € 370.000 a € 498.995,42 con le somme non assorbite da film e cortometraggi (art. 6).',
    'Documentari: dopo la decadenza di un’istanza e il rifiuto della successiva, la quota residua è andata all’istanza con 79 punti; il D.D.G. 3304 lascia possibile un altro scorrimento se arrivano nuove risorse.',
  ],
  categorie: { film: righe(film), documentario: righe(documentario), cortometraggio: righe(cortometraggio) },
}, {
  anno: 2025,
  fonte: 'D.D.G. n. 2230 del 02/07/2025 — elenchi delle istanze ammissibili e non ammissibili a cofinanziamento, anno 2025; beneficiari consolidati dal D.D.G. n. 2698 del 06/08/2025 e, per i film, dal D.D.G. n. 3542 del 21/10/2025 (scorrimento)',
  url: 'https://www.siciliafilmcommission.org/wp-content/uploads/2024/12/DDG-n.-2230-del-02.07.2025Allegati-firmato.pdf',
  atti: [
    { nome: 'D.D.G. n. 2698 del 06/08/2025 — elenchi consolidati dei beneficiari', url: 'https://www.siciliafilmcommission.org/wp-content/uploads/2024/12/DDG-n.-2698-del-06.08.2025Allegati-Firmato.pdf' },
    { nome: 'D.D.G. n. 3542 del 21/10/2025 — scorrimento della graduatoria dei film', url: 'https://www.siciliafilmcommission.org/wp-content/uploads/2024/12/DDG-n.-3542-del-21.10.2025ALLEGATO-firmato.pdf' },
  ],
  istanze: 105,
  ultimoInCapienza: { film: 83.1, documentario: 79.4, cortometraggio: 75.8 },
  // L'Avviso era nella versione precedente al D.D.G. n. 4788 del 22/12/2025.
  grigliaPrecedente: true,
  notaGriglia: 'Avviso nella versione precedente alle modifiche del D.D.G. n. 4788 del 22/12/2025. Le intestazioni del decreto riportano le stesse sezioni e gli stessi minimi (film A17 B13 C20 D15, documentari A21 B9 C25 D10, cortometraggi A17 B13 C25 D10); il testo dei criteri prima della modifica non è in archivio. Tutti i punteggi della sezione C sono ottenibili con le fasce attuali. Nella sezione D nessun progetto è sceso sotto 9,6, mentre nel 2026 compaiono 0, 2 e 5: per quella sezione il metro 2025 non vale alla pari.',
  note: [
    'Film: nella prima graduatoria finanziati 7 progetti fino a 83,1 punti; con le risorse aggiuntive del Fondo regionale (D.D.G. 3542) sono stati finanziati tutti i 22 film ammissibili, fino a 69,6 punti. Il decreto di scorrimento non è impegno finché non seguono notifica, accettazione e concessione: non è noto quanti abbiano poi accettato.',
    'Documentari: la prima in graduatoria è stata esclusa ai controlli per un requisito soggettivo; è entrata la prima non finanziata, per la sola quota residua.',
  ],
  categorie: { film: righe(film2025), documentario: righe(documentario2025), cortometraggio: righe(cortometraggio2025) },
}];

// Finestra 2024, avviso precedente (2024-2025): punteggi per sezione dei soli progetti finanziati
// (D.D.G. n. 2003 del 11/07/2024). Le sezioni erano le stesse, con minimi leggermente diversi
// (film: A 16, B 13, C 20, D 16). Non descrive l'intera platea dei candidati: serve solo allo storico della soglia di finanziamento.
const film2024 = [
  [1, 24.2, 18.7, 28, 21, 91.9, 'F', 500000, 500000],
  [23, 21.9, 15.3, 30, 23.4, 90.6, 'F', 440000, 433775.84],
  [51, 19.8, 16.6, 30, 23.1, 89.5, 'F', 172000, 167508.16],
  [11, 22.5, 16.7, 25, 21.7, 85.9, 'F', 500000, 467355.82],
  [53, 20.2, 15.1, 26.2, 21.8, 83.3, 'F', 480000, 435081.61],
  [29, 20.2, 15.7, 30, 17.1, 83, 'F', 241764.2, 218350.69],
  [66, 17.6, 15.6, 30, 18.8, 82, 'F', 500000, 446137.11],
  [33, 17.9, 15.2, 30, 18.8, 81.9, 'F', 390000, 347562.57],
  [25, 19.1, 18.1, 24, 19.4, 80.6, 'F', 400000, 184228.2, { ridotto: true, nota: 'Ultimo in capienza: contributo ridotto.' }],
];
const documentario2024 = [
  [12, 27.4, 10.9, 23, 25, 86.3, 'F'], [37, 21.9, 10, 30, 22.8, 84.7, 'F'], [40, 25.6, 12, 28, 16.1, 81.7, 'F'], [6, 25.1, 10.3, 27, 16.1, 78.5, 'F'],
  [27, 25.4, 10, 24, 18.8, 78.2, 'F'], [42, 25, 10.2, 30, 12.8, 78, 'F'], [39, 22.4, 10, 27, 15.8, 75.2, 'F'],
];
const cortometraggio2024 = [[48, 17.6, 15, 24, 12.2, 68.8, 'F']];

export const FINANZIATI_SICILIA = [{
  anno: 2024,
  soloFinanziati: true,
  avvisoPrecedente: true,
  fonte: 'D.D.G. n. 2003 del 11/07/2024 — elenchi delle istanze beneficiarie di contributo, anno 2024 (avviso 2024-2025)',
  url: '',
  categorie: { film: righe(film2024), documentario: righe(documentario2024), cortometraggio: righe(cortometraggio2024) },
}];
