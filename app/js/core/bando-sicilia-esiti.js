// Esiti reali della finestra 2026 dell'Avviso Sicilia 2025-2027: punteggi attribuiti dalla Commissione
// a tutti i progetti valutati, sezione per sezione. Fonte: D.D.G. n. 2384 del 28/07/2026, allegati 1-3,
// pubblicato dal Dipartimento regionale Turismo, Sport e Spettacolo (atto pubblico).
// Servono a tarare le stime sul metro reale della Commissione e a collocare un dossier in graduatoria.
// Si riportano solo i numeri (non i nomi di società e opere); "n" è il numero d'istanza del decreto.
//
// Riga: [n, A, B, C, D, totale, stato, contributo richiesto, contributo concedibile]
//   stato: 'F' finanziato · 'N' ammissibile ma non finanziato per dotazione esaurita · 'X' non ammissibile

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
  [89, 23.4, 13.4, 29, 14.4, 80.2, 'F', 150000, 25685.13], // finanziato in parte: dotazione residua
  [91, 22.9, 12.6, 27, 17.8, 79.9, 'N', 100000], // nel decreto le sezioni sommano a 80,3
  [7, 24.7, 11.7, 29, 13.6, 79, 'N', 35000],
  [19, 24, 11.6, 25.8, 12.8, 74.2, 'N', 22500],
  [39, 24.4, 11.7, 26.4, 11.6, 74.1, 'N', 30000],
  [10, 24.2, 12, 23, 18.8, 78, 'X'],
  [15, 21.7, 10.6, 19, 21.2, 72.5, 'X'],
  [17, 22.4, 11.1, 22.8, 15.5, 71.8, 'X'],
  [33, 24, 11, 24.8, 11.2, 71, 'X'],
  [53, 19.4, 10.3, 24, 17.2, 70.9, 'X'],
  [56, 22.8, 10.9, 27, 9.6, 70.3, 'X'],
  [60, 23.1, 11.5, 26, 9.6, 70.2, 'X'],
  [63, 23.1, 10.5, 20, 15.6, 69.2, 'X'],
  [64, 21.5, 10.9, 27, 9.6, 69, 'X'],
  [69, 25.1, 10.9, 22.6, 9.6, 68.2, 'X'],
  [72, 22.9, 10.1, 14.6, 9.6, 57.2, 'X'],
  [86, 25.1, 10.9, 22.6, 9.6, 68.2, 'X'], // valori identici all'istanza 69 nel decreto
  [99, 22.9, 10.1, 14.6, 9.6, 57.2, 'X'], // valori identici all'istanza 72 nel decreto
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

const righe = (lista) => lista.map(([n, A, B, C, D, totale, stato, richiesto, concedibile]) => ({ n, sezioni: { A, B, C, D }, totale, stato, richiesto: richiesto ?? null, concedibile: concedibile ?? null }));

export const ESITI_SICILIA = [{
  anno: 2026,
  fonte: 'D.D.G. n. 2384 del 28/07/2026 — elenchi delle istanze ammissibili e non ammissibili a cofinanziamento, anno 2026',
  url: 'https://www.regione.sicilia.it/istituzioni/servizi-informativi/decreti-e-direttive/dds-n-2384s9-28072026-approvazione-elenchi-anno-2026-istanze-ammissibili-non-ammissibili-cofinanziamento-inerenti-all-avviso-pubblico-2025-2027',
  categorie: { film: righe(film), documentario: righe(documentario), cortometraggio: righe(cortometraggio) },
}];

// Finestra 2025: il decreto pubblica i punteggi per sezione dei soli progetti finanziati
// (D.D.G. n. 2698 del 06/08/2025, elenchi consolidati dei beneficiari). Non descrive l'intera platea
// dei candidati: serve come storico della soglia di finanziamento, non per le statistiche di sezione.
const film2025 = [
  [10, 19.5, 14.8, 30, 21.8, 86.1, 'F', 300000, 300000],
  [24, 17.7, 16.3, 30, 21.2, 85.2, 'F', 250000, 247386.76],
  [9, 19.2, 14.6, 29, 21.2, 84, 'F', 445000, 434146.34],
  [20, 19.1, 15.8, 27.2, 21.8, 83.9, 'F', 750000, 730836.24],
  [42, 19.3, 16.5, 23, 25, 83.8, 'F', 750000, 729965.16],
  [6, 19.7, 16.2, 22.2, 25, 83.1, 'F', 750000, 600069.86], // ultimo in capienza, a pari merito: contributo ridotto
  [70, 21.6, 17.5, 26.2, 17.8, 83.1, 'F', 700000, 560052.11],
];
const documentario2025 = [
  [41, 22.5, 11.5, 27, 22, 83, 'F', 70000, 70000],
  [43, 21.1, 9.6, 30, 20.8, 81.5, 'F', 32460, 31873.37],
  [7, 25.5, 11.9, 26.4, 17.2, 81, 'F', 50000, 48795.18],
  [47, 23.3, 12.1, 27, 18.5, 80.9, 'F', 130000, 126710.85],
  [23, 25.6, 12.2, 25.8, 15.8, 79.4, 'F', 150000, 52620.6], // dotazione esaurita: contributo parziale
];
const cortometraggio2025 = [
  [86, 19.3, 16.4, 30, 18.1, 83.8, 'F', 10000, 10000],
  [15, 18.7, 15.9, 29, 12.2, 75.8, 'F', 15000, 13568.02],
];

export const FINANZIATI_SICILIA = [{
  anno: 2025,
  soloFinanziati: true,
  fonte: 'D.D.G. n. 2698 del 06/08/2025 — elenchi consolidati delle istanze beneficiarie di contributo, anno 2025',
  url: 'https://www.siciliafilmcommission.org/wp-content/uploads/2024/12/DDG-n.-2698-del-06.08.2025Allegati-Firmato.pdf',
  categorie: { film: righe(film2025), documentario: righe(documentario2025), cortometraggio: righe(cortometraggio2025) },
}];
