// Punteggi reali delle graduatorie dei contributi selettivi MiC-DGCA alla produzione, sessioni I e II del 2025
// (decreti direttoriali pubblicati su cinema.cultura.gov.it). Solo numeri: nessun titolo, società o nominativo.
// ATTENZIONE: nel 2025 la griglia aveva 7 criteri (A-G) con massimi diversi da quella del bando 2026 (8 criteri, A-H):
// questi punteggi NON entrano nel motore di calcolo; si mostrano in una sezione a parte e servono da riferimento.
//
// Riga: [A, B, C, D, E, F, G, totale, stato, contributo richiesto, contributo assegnato]; la posizione è l'ordine della riga.
//   stato: 'F' ammesso al contributo · 'X' non ammesso (punteggio sotto un minimo). Nei quattro decreti non ci sono
//          progetti idonei ma non finanziati: chi raggiunge il minimo totale è finanziato.
//   null:  cella non stampata nel decreto (sotto un minimo i criteri successivi non vengono valutati). Mai sostituita con 0.
// Dati generati dai PDF ufficiali e riletti due volte (somme delle colonne = totale stampato in tutte le righe con totale;
// somma dei contributi assegnati = totale stampato in tutte le 12 tabelle).

export const CRITERI_MIC_2025 = {
  A: 'Qualità, innovatività e originalità del soggetto e della sceneggiatura',
  B: 'Visione e stile del regista, linguaggio cinematografico o audiovisivo proposto',
  C: 'Qualità dell’apporto del cast artistico e tecnico',
  D: 'Coerenza tra sceneggiatura e dimensione economica, finanziaria e distributiva',
  E: 'Pari opportunità di genere',
  F: 'Coproduzione o compartecipazione internazionale',
  G: 'Certificazione per la sostenibilità ambientale',
};
/** A quale bando del catalogo appartiene ogni linea (le linee sono le stesse del bando 2026). */
export const LINEE_MIC = {
  'giovani-autori': 'italia-mic-selettivi-2026', 'prime-seconde': 'italia-mic-selettivi-2026', cortometraggi: 'italia-mic-selettivi-2026',
  'film-qualita-identita': 'italia-mic-selettivi-qualita-2026', documentari: 'italia-mic-selettivi-qualita-2026', animazione: 'italia-mic-selettivi-qualita-2026',
};

const R = {
  '2025-II/giovani-autori': [
    [49,18,6,6,6,10,5,100,'F',350000,350000], [51,18,7,8,7,0,5,96,'F',600000,500000], [52,18,7,8,0,0,5,90,'F',500000,400000], [43,16,7,7,7,4,5,89,'F',600000,550000],
    [47,15,6,5,6,4,5,88,'F',470000,350000], [47,16,7,5,7,4,0,86,'F',340000,300000], [47,15,7,6,6,0,5,86,'F',400000,350000], [45,16,6,6,0,0,5,78,'F',600000,240000],
    [44,16,7,6,0,0,5,78,'F',600000,240000], [50,16,6,6,0,0,0,78,'F',377833,152000], [48,16,6,8,0,0,0,78,'F',67307,38000], [34,10,4,6,0,6,5,65,'X',239580,null],
    [33,10,4,5,7,0,5,64,'X',320000,null], [34,10,4,6,0,0,0,54,'X',600000,null], [9,null,null,null,null,null,null,null,'X',500000,null], [9,null,null,null,null,null,null,null,'X',250000,null],
    [9,null,null,null,null,null,null,null,'X',400000,null], [9,null,null,null,null,null,null,null,'X',540000,null], [9,null,null,null,null,null,null,null,'X',410000,null], [9,null,null,null,null,null,null,null,'X',244625.1,null],
    [9,null,null,null,null,null,null,null,'X',600000,null], [9,null,null,null,null,null,null,null,'X',600000,null], [9,null,null,null,null,null,null,null,'X',500000,null], [9,null,null,null,null,null,null,null,'X',168216,null],
    [9,null,null,null,null,null,null,null,'X',572200,null], [9,null,null,null,null,null,null,null,'X',500000,null], [9,null,null,null,null,null,null,null,'X',529587.2,null],
  ],
  '2025-II/prime-seconde': [
    [50,16,6,7,7,6,5,97,'F',600000,500000], [50,18,6,7,6,0,5,92,'F',600000,500000], [49,14,6,7,6,4,5,91,'F',315981.44,250000], [50,16,5,7,6,0,5,89,'F',600000,484000],
    [47,15,6,7,7,6,0,88,'F',380000,300000], [50,17,6,8,6,0,0,87,'F',600000,400000], [46,15,6,7,0,4,5,83,'F',400000,160000], [39,12,6,6,7,4,5,79,'F',500000,200000],
    [36,10,5,6,7,10,5,79,'F',296365.43,120000], [46,14,6,6,6,0,0,78,'F',539480,216000], [38,13,7,8,7,0,5,78,'F',40000,16000], [44,15,6,6,0,0,5,76,'F',466400,187000],
    [43,12,6,6,0,4,5,76,'F',405000,162000], [40,12,7,6,6,0,5,76,'F',199480,80000], [38,14,6,6,6,0,5,75,'F',440000,85000], [44,14,6,6,0,0,5,75,'F',455163.88,90000],
    [31,10,6,5,7,0,5,64,'X',300000,null], [31,5,5,5,0,10,5,61,'X',300000,null], [31,8,5,5,6,0,5,60,'X',486377.2,null], [31,8,5,5,6,0,5,60,'X',600000,null],
    [31,8,5,5,4,0,5,58,'X',400000,null], [9,null,null,null,null,null,null,null,'X',306845,null], [9,null,null,null,null,null,null,null,'X',400000,null], [9,null,null,null,null,null,null,null,'X',210345.96,null],
    [9,null,null,null,null,null,null,null,'X',410000,null], [9,null,null,null,null,null,null,null,'X',170000,null], [9,null,null,null,null,null,null,null,'X',400000,null], [9,null,null,null,null,null,null,null,'X',317500.76,null],
    [9,null,null,null,null,null,null,null,'X',400000,null], [9,null,null,null,null,null,null,null,'X',165000,null], [9,null,null,null,null,null,null,null,'X',240000,null], [9,null,null,null,null,null,null,null,'X',400000,null],
    [9,null,null,null,null,null,null,null,'X',70000,null], [9,null,null,null,null,null,null,null,'X',297855,null], [9,null,null,null,null,null,null,null,'X',143622,null], [9,null,null,null,null,null,null,null,'X',180000,null],
    [9,null,null,null,null,null,null,null,'X',369260.8,null], [9,null,null,null,null,null,null,null,'X',600000,null], [9,null,null,null,null,null,null,null,'X',135226.4,null], [9,null,null,null,null,null,null,null,'X',250000,null],
    [9,null,null,null,null,null,null,null,'X',554000,null], [9,null,null,null,null,null,null,null,'X',558807.36,null], [9,null,null,null,null,null,null,null,'X',400000,null], [9,null,null,null,null,null,null,null,'X',596608,null],
    [9,null,null,null,null,null,null,null,'X',590000,null], [9,null,null,null,null,null,null,null,'X',500000,null], [9,null,null,null,null,null,null,null,'X',25000,null], [9,null,null,null,null,null,null,null,'X',600000,null],
    [9,null,null,null,null,null,null,null,'X',600000,null], [9,null,null,null,null,null,null,null,'X',400000,null], [9,null,null,null,null,null,null,null,'X',600000,null], [9,null,null,null,null,null,null,null,'X',600000,null],
    [9,null,null,null,null,null,null,null,'X',400000,null], [9,null,null,null,null,null,null,null,'X',400000,null], [9,null,null,null,null,null,null,null,'X',350000,null], [9,null,null,null,null,null,null,null,'X',500000,null],
    [9,null,null,null,null,null,null,null,'X',185000,null], [9,null,null,null,null,null,null,null,'X',200000,null], [9,null,null,null,null,null,null,null,'X',500000,null], [9,null,null,null,null,null,null,null,'X',600000,null],
    [9,null,null,null,null,null,null,null,'X',64657,null], [9,null,null,null,null,null,null,null,'X',300000,null], [9,null,null,null,null,null,null,null,'X',270000,null], [9,null,null,null,null,null,null,null,'X',500000,null],
  ],
  '2025-II/documentari': [
    [58,17,4,8,0,4,5,96,'F',120000,120000], [51,16,4,7,7,4,5,94,'F',90000,90000], [55,17,4,7,6,0,0,89,'F',150000,100000], [50,17,4,7,6,0,5,89,'F',62666,60000],
    [48,14,4,7,0,10,5,88,'F',185194.23,80000], [58,17,5,8,0,0,0,88,'F',109106.24,100000], [55,17,4,7,0,0,5,88,'F',100000,100000], [58,18,5,7,0,0,0,88,'F',80000,70000],
    [58,18,5,7,0,0,0,88,'F',44000,44000], [58,17,5,8,0,0,0,88,'F',200000,150000], [41,14,3,7,7,10,5,87,'F',47400,47000], [50,15,4,7,6,0,5,87,'F',38000,38000],
    [54,17,5,7,0,4,0,87,'F',51090.7,51000], [53,18,7,8,0,0,0,86,'F',167083,100000], [52,16,4,7,7,0,0,86,'F',130000,100000], [45,14,4,7,7,4,5,86,'F',36470,36000],
    [57,16,5,8,0,0,0,86,'F',152720.72,120000], [51,16,4,7,7,0,0,85,'F',248858.8,100000], [54,15,4,7,0,0,5,85,'F',63000,63000], [47,16,4,7,6,0,5,85,'F',100000,60000],
    [55,17,5,7,0,0,0,84,'F',200000,100000], [52,16,4,7,0,0,5,84,'F',140000,100000], [52,15,4,7,6,0,0,84,'F',95000,90000], [52,15,4,7,6,0,0,84,'F',150000,80000],
    [52,15,4,7,6,0,0,84,'F',100000,80000], [52,16,4,7,0,0,5,84,'F',89822.38,70000], [52,16,4,7,0,0,5,84,'F',49500,49000], [53,16,5,9,0,0,0,83,'F',144551.6,120000],
    [50,16,5,7,0,0,5,83,'F',210596,110000], [51,16,4,7,0,0,5,83,'F',103239.2,100000], [51,15,4,7,6,0,0,83,'F',216840.77,90000], [51,16,4,7,0,0,5,83,'F',130000,90000],
    [54,17,4,7,0,0,0,82,'F',147600,80000], [54,17,4,7,0,0,0,82,'F',49000,49000], [51,16,4,7,0,4,0,82,'F',60000,60000], [49,15,5,7,0,6,0,82,'F',90000,90000],
    [52,15,5,8,0,0,0,80,'F',90000,70000], [30,null,null,null,null,null,null,null,'X',150000,null], [30,null,null,null,null,null,null,null,'X',75000,null], [30,null,null,null,null,null,null,null,'X',71627.2,null],
    [30,null,null,null,null,null,null,null,'X',90263.89,null], [30,null,null,null,null,null,null,null,'X',83507.6,null], [30,null,null,null,null,null,null,null,'X',219000,null], [30,null,null,null,null,null,null,null,'X',200000,null],
    [30,null,null,null,null,null,null,null,'X',78000,null], [30,null,null,null,null,null,null,null,'X',170000,null], [30,null,null,null,null,null,null,null,'X',51851.8,null], [30,null,null,null,null,null,null,null,'X',80000,null],
    [30,null,null,null,null,null,null,null,'X',278159.04,null], [30,null,null,null,null,null,null,null,'X',65000,null], [30,null,null,null,null,null,null,null,'X',63911.06,null], [30,null,null,null,null,null,null,null,'X',26000,null],
    [30,null,null,null,null,null,null,null,'X',125800,null], [30,null,null,null,null,null,null,null,'X',112000,null], [30,null,null,null,null,null,null,null,'X',118080,null], [30,null,null,null,null,null,null,null,'X',150000,null],
    [30,null,null,null,null,null,null,null,'X',110942.4,null], [30,null,null,null,null,null,null,null,'X',135000,null], [30,null,null,null,null,null,null,null,'X',85704,null], [30,null,null,null,null,null,null,null,'X',47924.4,null],
    [30,null,null,null,null,null,null,null,'X',137086.4,null], [30,null,null,null,null,null,null,null,'X',200000,null], [30,null,null,null,null,null,null,null,'X',100000,null], [30,null,null,null,null,null,null,null,'X',123000,null],
    [30,null,null,null,null,null,null,null,'X',130000,null], [30,null,null,null,null,null,null,null,'X',85000,null], [30,null,null,null,null,null,null,null,'X',63278,null], [30,null,null,null,null,null,null,null,'X',60000,null],
    [30,null,null,null,null,null,null,null,'X',150000,null], [9,null,null,null,null,null,null,null,'X',150000,null], [9,null,null,null,null,null,null,null,'X',64834.88,null], [9,null,null,null,null,null,null,null,'X',95000,null],
    [9,null,null,null,null,null,null,null,'X',113488.7,null], [9,null,null,null,null,null,null,null,'X',150000,null], [9,null,null,null,null,null,null,null,'X',171572.39,null], [9,null,null,null,null,null,null,null,'X',100000,null],
    [9,null,null,null,null,null,null,null,'X',40000,null], [9,null,null,null,null,null,null,null,'X',100000,null], [9,null,null,null,null,null,null,null,'X',58000,null], [9,null,null,null,null,null,null,null,'X',111960,null],
    [9,null,null,null,null,null,null,null,'X',55810,null], [9,null,null,null,null,null,null,null,'X',80000,null], [9,null,null,null,null,null,null,null,'X',73000,null], [9,null,null,null,null,null,null,null,'X',90372.8,null],
    [9,null,null,null,null,null,null,null,'X',60000,null], [9,null,null,null,null,null,null,null,'X',74514.9,null], [9,null,null,null,null,null,null,null,'X',100000,null], [9,null,null,null,null,null,null,null,'X',118800,null],
    [9,null,null,null,null,null,null,null,'X',117689.6,null], [9,null,null,null,null,null,null,null,'X',80000,null], [9,null,null,null,null,null,null,null,'X',72600,null], [9,null,null,null,null,null,null,null,'X',51975,null],
    [9,null,null,null,null,null,null,null,'X',225321.68,null], [9,null,null,null,null,null,null,null,'X',52760,null], [9,null,null,null,null,null,null,null,'X',82600,null], [9,null,null,null,null,null,null,null,'X',44448,null],
    [9,null,null,null,null,null,null,null,'X',81560.8,null], [9,null,null,null,null,null,null,null,'X',78000,null], [9,null,null,null,null,null,null,null,'X',60000,null], [9,null,null,null,null,null,null,null,'X',40000,null],
    [9,null,null,null,null,null,null,null,'X',59500,null], [9,null,null,null,null,null,null,null,'X',28353.84,null], [9,null,null,null,null,null,null,null,'X',97683.2,null], [9,null,null,null,null,null,null,null,'X',120000,null],
    [9,null,null,null,null,null,null,null,'X',52000,null], [9,null,null,null,null,null,null,null,'X',148214.4,null], [9,null,null,null,null,null,null,null,'X',175000,null], [9,null,null,null,null,null,null,null,'X',93000,null],
    [9,null,null,null,null,null,null,null,'X',130000,null], [9,null,null,null,null,null,null,null,'X',67126.48,null], [9,null,null,null,null,null,null,null,'X',117000,null], [9,null,null,null,null,null,null,null,'X',80000,null],
    [9,null,null,null,null,null,null,null,'X',57520,null], [9,null,null,null,null,null,null,null,'X',100000,null], [9,null,null,null,null,null,null,null,'X',28348.8,null], [9,null,null,null,null,null,null,null,'X',80000,null],
    [9,null,null,null,null,null,null,null,'X',100000,null], [9,null,null,null,null,null,null,null,'X',95748.2,null], [9,null,null,null,null,null,null,null,'X',82780,null], [9,null,null,null,null,null,null,null,'X',83936.8,null],
    [9,null,null,null,null,null,null,null,'X',37082,null], [9,null,null,null,null,null,null,null,'X',110000,null], [9,null,null,null,null,null,null,null,'X',120000,null], [9,null,null,null,null,null,null,null,'X',120000,null],
    [9,null,null,null,null,null,null,null,'X',400000,null], [9,null,null,null,null,null,null,null,'X',70000,null], [9,null,null,null,null,null,null,null,'X',86400,null], [9,null,null,null,null,null,null,null,'X',54680,null],
    [9,null,null,null,null,null,null,null,'X',71096,null], [9,null,null,null,null,null,null,null,'X',70642,null], [9,null,null,null,null,null,null,null,'X',160270,null], [9,null,null,null,null,null,null,null,'X',95000,null],
    [9,null,null,null,null,null,null,null,'X',128000,null], [9,null,null,null,null,null,null,null,'X',100000,null], [9,null,null,null,null,null,null,null,'X',75468.11,null], [9,null,null,null,null,null,null,null,'X',50000,null],
    [9,null,null,null,null,null,null,null,'X',120000,null], [9,null,null,null,null,null,null,null,'X',21600,null], [9,null,null,null,null,null,null,null,'X',100200,null],
  ],
  '2025-II/cortometraggi': [
    [56,20,7,10,0,0,5,98,'F',67993.3,67900], [53,18,6,9,6,0,5,97,'F',25500,25000], [56,18,6,10,7,0,0,97,'F',25000,25000], [54,20,6,9,7,0,0,96,'F',54804,54000],
    [54,20,6,9,0,0,5,94,'F',47980,47900], [48,15,5,8,7,6,5,94,'F',20000,18000], [54,17,7,9,7,0,0,94,'F',17496,17400], [54,19,6,9,0,0,5,93,'F',48240,48000],
    [51,17,5,8,6,0,5,92,'F',43432,30000], [52,18,5,9,7,0,0,91,'F',16354.56,16300], [55,20,5,9,0,0,0,89,'F',18640,18500], [52,18,5,8,0,0,5,88,'F',23404,23000],
    [54,19,5,10,0,0,0,88,'F',10200,10000], [50,18,5,9,0,0,5,87,'F',29017.79,29000], [45,15,5,9,6,0,5,85,'F',28700,20000], [29,null,null,null,null,null,null,null,'X',21365.2,null],
    [28,null,null,null,null,null,null,null,'X',24800,null], [28,null,null,null,null,null,null,null,'X',18118,null], [18,null,null,null,null,null,null,null,'X',26410.32,null], [18,null,null,null,null,null,null,null,'X',48860.8,null],
    [17,null,null,null,null,null,null,null,'X',19546.56,null], [17,null,null,null,null,null,null,null,'X',26735.12,null], [16,null,null,null,null,null,null,null,'X',30000,null], [15,null,null,null,null,null,null,null,'X',19600,null],
    [8,null,null,null,null,null,null,null,'X',20757.04,null], [8,null,null,null,null,null,null,null,'X',33000,null], [8,null,null,null,null,null,null,null,'X',20000,null], [8,null,null,null,null,null,null,null,'X',14936,null],
    [8,null,null,null,null,null,null,null,'X',20000,null], [8,null,null,null,null,null,null,null,'X',33880,null], [8,null,null,null,null,null,null,null,'X',16040,null], [8,null,null,null,null,null,null,null,'X',23164.8,null],
    [8,null,null,null,null,null,null,null,'X',17760,null], [8,null,null,null,null,null,null,null,'X',24556.4,null], [8,null,null,null,null,null,null,null,'X',33656.76,null], [8,null,null,null,null,null,null,null,'X',23000,null],
    [8,null,null,null,null,null,null,null,'X',66940.8,null], [8,null,null,null,null,null,null,null,'X',27000,null], [8,null,null,null,null,null,null,null,'X',18949.28,null], [8,null,null,null,null,null,null,null,'X',11180,null],
    [8,null,null,null,null,null,null,null,'X',12900,null], [8,null,null,null,null,null,null,null,'X',9000,null], [7,null,null,null,null,null,null,null,'X',38000,null], [7,null,null,null,null,null,null,null,'X',19682.72,null],
    [7,null,null,null,null,null,null,null,'X',23800,null], [7,null,null,null,null,null,null,null,'X',18112.92,null], [7,null,null,null,null,null,null,null,'X',32000,null], [6,null,null,null,null,null,null,null,'X',23864,null],
  ],
  '2025-II/animazione': [
    [67,18,7,9,4,0,5,110,'F',350000,350000], [69,18,7,9,0,0,5,108,'F',200000,200000], [67,18,7,9,0,0,5,106,'F',1000000,800000], [67,18,7,9,0,0,5,106,'F',600000,600000],
    [65,18,7,9,0,0,5,104,'F',300000,182000], [60,16,7,8,7,0,5,103,'F',290000,172000], [56,16,7,8,6,4,5,102,'F',379892.88,378000], [59,18,7,9,0,4,5,102,'F',500000,500000],
    [64,16,7,9,0,4,0,100,'F',600000,500000], [48,14,6,8,7,0,5,88,'F',295000,111000], [54,15,6,8,0,4,0,87,'F',570000,228000], [50,15,6,8,4,4,0,87,'F',210000,75000],
    [50,15,6,8,6,0,0,85,'F',760000,304000], [6,null,null,null,null,null,null,null,'X',208963.2,null], [6,null,null,null,null,null,null,null,'X',370000,null], [6,null,null,null,null,null,null,null,'X',166492.68,null],
    [6,null,null,null,null,null,null,null,'X',495500,null],
  ],
  '2025-I/giovani-autori': [
    [52,18,7,8,6,0,5,96,'F',350000,350000], [52,18,7,8,0,0,0,85,'F',30600,30600], [44,16,6,6,7,0,5,84,'F',600000,400000], [44,16,6,7,0,4,5,82,'F',500000,450000],
    [44,16,6,6,7,0,0,79,'F',307552,300000], [44,16,6,7,0,0,5,78,'F',158400,150000], [40,15,7,6,0,4,5,77,'F',593101.86,350000], [34,12,7,8,6,4,5,76,'F',600000,350000],
    [40,15,7,8,0,0,5,75,'F',600000,400000], [41,17,6,6,0,0,5,75,'F',376000,250000], [34,14,7,8,7,0,5,75,'F',500000,300000], [31,12,6,4,null,null,null,null,'X',23120,null],
    [31,12,6,4,null,null,null,null,'X',400000,null], [31,12,5,4,null,null,null,null,'X',600000,null], [9,null,null,null,null,null,null,null,'X',274741.29,null], [9,null,null,null,null,null,null,null,'X',600000,null],
    [9,null,null,null,null,null,null,null,'X',500000,null], [9,null,null,null,null,null,null,null,'X',350000,null], [9,null,null,null,null,null,null,null,'X',350000,null], [9,null,null,null,null,null,null,null,'X',468188,null],
    [9,null,null,null,null,null,null,null,'X',170444,null], [9,null,null,null,null,null,null,null,'X',592460.8,null],
  ],
  '2025-I/prime-seconde': [
    [53,18,6,8,7,4,5,101,'F',584284,450000], [54,18,6,8,0,6,5,97,'F',235400,235000], [53,18,6,8,6,0,5,96,'F',600000,400000], [54,18,6,8,0,4,5,95,'F',470000,350000],
    [54,18,6,9,0,0,5,92,'F',600000,400000], [47,16,4,5,0,10,5,87,'F',220000,150000], [47,16,4,7,0,0,5,79,'F',500000,300000], [47,16,4,5,7,0,0,79,'F',354055.6,250000],
    [47,16,4,5,0,0,5,77,'F',600000,400000], [49,17,4,5,0,0,0,75,'F',357150.4,250000], [41,14,3,5,7,0,5,75,'F',400000,200000], [43,15,5,5,7,0,0,75,'F',550000,245000],
    [41,15,6,8,0,0,5,75,'F',300000,120000], [32,null,null,null,null,null,null,null,'X',600000,null], [31,null,null,null,null,null,null,null,'X',600000,null], [31,null,null,null,null,null,null,null,'X',250000,null],
    [30,null,null,null,null,null,null,null,'X',89874.2,null], [30,null,null,null,null,null,null,null,'X',600000,null], [30,null,null,null,null,null,null,null,'X',370000,null], [30,null,null,null,null,null,null,null,'X',600000,null],
    [30,null,null,null,null,null,null,null,'X',540000,null], [30,null,null,null,null,null,null,null,'X',343534.35,null], [30,null,null,null,null,null,null,null,'X',600000,null], [20,null,null,null,null,null,null,null,'X',353715.86,null],
    [8,null,null,null,null,null,null,null,'X',186000,null], [8,null,null,null,null,null,null,null,'X',350000,null], [8,null,null,null,null,null,null,null,'X',257020.8,null], [8,null,null,null,null,null,null,null,'X',350000,null],
    [8,null,null,null,null,null,null,null,'X',550000,null], [8,null,null,null,null,null,null,null,'X',147622.29,null], [8,null,null,null,null,null,null,null,'X',37000,null], [8,null,null,null,null,null,null,null,'X',400000,null],
    [8,null,null,null,null,null,null,null,'X',300000,null], [8,null,null,null,null,null,null,null,'X',206500.89,null], [8,null,null,null,null,null,null,null,'X',120000,null], [8,null,null,null,null,null,null,null,'X',246800,null],
    [8,null,null,null,null,null,null,null,'X',70000,null], [8,null,null,null,null,null,null,null,'X',400000,null], [8,null,null,null,null,null,null,null,'X',350000,null], [8,null,null,null,null,null,null,null,'X',499942.6,null],
    [8,null,null,null,null,null,null,null,'X',250000,null], [8,null,null,null,null,null,null,null,'X',600000,null], [8,null,null,null,null,null,null,null,'X',600000,null], [8,null,null,null,null,null,null,null,'X',600000,null],
    [8,null,null,null,null,null,null,null,'X',50902,null], [8,null,null,null,null,null,null,null,'X',450000,null], [8,null,null,null,null,null,null,null,'X',350000,null], [8,null,null,null,null,null,null,null,'X',400000,null],
    [8,null,null,null,null,null,null,null,'X',320480,null],
  ],
  '2025-I/documentari': [
    [51,13,5,7,7,0,5,88,'F',80000,80000], [51,13,5,7,6,0,5,87,'F',82600,80000], [52,15,4,9,7,0,0,87,'F',126600,125000], [51,13,5,7,6,0,5,87,'F',55600,55000],
    [53,15,5,9,0,0,5,87,'F',110000,110000], [51,12,5,7,7,0,5,87,'F',139113.6,139000], [51,13,5,7,6,0,5,87,'F',55000,55000], [51,13,5,7,6,0,5,87,'F',100000,100000],
    [46,14,4,6,7,4,5,86,'F',56688,55000], [48,15,5,7,6,0,5,86,'F',130000,130000], [52,15,4,9,0,0,5,85,'F',221000,220000], [48,15,4,6,7,0,5,85,'F',50000,50000],
    [51,15,4,9,6,0,0,85,'F',70000,65000], [52,15,4,9,0,0,5,85,'F',80000,80000], [47,15,5,7,6,0,5,85,'F',110000,110000], [52,15,4,9,0,0,5,85,'F',120000,120000],
    [52,15,4,9,0,0,5,85,'F',60000,60000], [52,15,4,8,6,0,0,85,'F',70240,70000], [51,16,5,8,0,0,5,85,'F',169800,165000], [52,15,4,9,0,0,5,85,'F',155000,155000],
    [44,14,4,6,7,4,5,84,'F',91913,85000], [52,16,5,6,0,0,5,84,'F',40000,40000], [48,13,5,6,7,0,5,84,'F',129992,125000], [54,16,6,7,0,0,0,83,'F',145000,100000],
    [45,15,4,7,7,0,5,83,'F',55000,50000], [54,16,6,7,0,0,0,83,'F',100092.8,100000], [46,15,4,7,6,0,5,83,'F',251800,200000], [45,15,4,7,7,0,5,83,'F',34000,30000],
    [54,16,6,7,0,0,0,83,'F',91829.6,90000], [45,15,4,7,7,0,5,83,'F',40000,40000], [44,14,4,6,6,4,5,83,'F',58000,51000], [45,15,4,7,7,0,5,83,'F',40000,40000],
    [54,16,6,7,0,0,0,83,'F',46677.69,35000], [50,15,4,9,0,0,5,83,'F',117200,90000], [45,15,4,7,6,0,5,82,'F',283444,200000], [36,10,4,5,6,0,5,66,'X',131395.6,null],
    [36,11,4,5,0,4,5,65,'X',81000,null], [35,10,4,5,6,0,5,65,'X',99238,null], [37,13,5,5,0,0,0,60,'X',50000,null], [36,10,4,5,0,0,5,60,'X',72292,null],
    [36,13,4,4,null,null,null,57,'X',230000,null], [36,12,5,4,null,null,null,57,'X',55000,null], [35,8,3,5,0,0,5,56,'X',113200,null], [36,10,3,5,0,0,0,54,'X',30000,null],
    [36,10,3,4,null,null,null,53,'X',100000,null], [30,null,null,null,null,null,null,null,'X',100000,null], [30,null,null,null,null,null,null,null,'X',154555.2,null], [30,null,null,null,null,null,null,null,'X',48037.64,null],
    [30,null,null,null,null,null,null,null,'X',80000,null], [30,null,null,null,null,null,null,null,'X',33014.81,null], [30,null,null,null,null,null,null,null,'X',44915.2,null], [30,null,null,null,null,null,null,null,'X',100000,null],
    [30,null,null,null,null,null,null,null,'X',70000,null], [30,null,null,null,null,null,null,null,'X',50000,null], [30,null,null,null,null,null,null,null,'X',80000,null], [30,null,null,null,null,null,null,null,'X',300000,null],
    [30,null,null,null,null,null,null,null,'X',47920,null], [30,null,null,null,null,null,null,null,'X',83943.6,null], [30,null,null,null,null,null,null,null,'X',80249.2,null], [30,null,null,null,null,null,null,null,'X',64000,null],
    [30,null,null,null,null,null,null,null,'X',116200,null], [30,null,null,null,null,null,null,null,'X',46600,null], [30,null,null,null,null,null,null,null,'X',40000,null], [30,null,null,null,null,null,null,null,'X',120000,null],
    [30,null,null,null,null,null,null,null,'X',60450,null], [20,null,null,null,null,null,null,null,'X',161636,null], [20,null,null,null,null,null,null,null,'X',112819.07,null], [20,null,null,null,null,null,null,null,'X',80000,null],
    [20,null,null,null,null,null,null,null,'X',65790,null], [20,null,null,null,null,null,null,null,'X',65860.16,null], [20,null,null,null,null,null,null,null,'X',84000,null], [20,null,null,null,null,null,null,null,'X',75000,null],
    [20,null,null,null,null,null,null,null,'X',125000,null], [20,null,null,null,null,null,null,null,'X',65000,null], [20,null,null,null,null,null,null,null,'X',38091.25,null], [20,null,null,null,null,null,null,null,'X',29788,null],
    [20,null,null,null,null,null,null,null,'X',90589.2,null], [20,null,null,null,null,null,null,null,'X',50000,null], [20,null,null,null,null,null,null,null,'X',85000,null], [20,null,null,null,null,null,null,null,'X',68765.6,null],
    [20,null,null,null,null,null,null,null,'X',174920,null], [20,null,null,null,null,null,null,null,'X',71390.19,null], [20,null,null,null,null,null,null,null,'X',50000,null], [20,null,null,null,null,null,null,null,'X',58280,null],
    [20,null,null,null,null,null,null,null,'X',98805.23,null], [20,null,null,null,null,null,null,null,'X',110000,null], [19,null,null,null,null,null,null,null,'X',40626.4,null], [9,null,null,null,null,null,null,null,'X',87083.91,null],
    [9,null,null,null,null,null,null,null,'X',141555.58,null], [9,null,null,null,null,null,null,null,'X',124535.87,null], [9,null,null,null,null,null,null,null,'X',110000,null], [9,null,null,null,null,null,null,null,'X',50000,null],
    [9,null,null,null,null,null,null,null,'X',110299.32,null], [9,null,null,null,null,null,null,null,'X',70000,null], [9,null,null,null,null,null,null,null,'X',48800,null], [9,null,null,null,null,null,null,null,'X',22840,null],
    [9,null,null,null,null,null,null,null,'X',44769.6,null], [9,null,null,null,null,null,null,null,'X',73900,null], [9,null,null,null,null,null,null,null,'X',47658.56,null], [9,null,null,null,null,null,null,null,'X',31300,null],
    [9,null,null,null,null,null,null,null,'X',400000,null], [9,null,null,null,null,null,null,null,'X',281825.2,null], [9,null,null,null,null,null,null,null,'X',116895.2,null], [9,null,null,null,null,null,null,null,'X',196000,null],
    [9,null,null,null,null,null,null,null,'X',76773.66,null], [9,null,null,null,null,null,null,null,'X',120812.13,null], [9,null,null,null,null,null,null,null,'X',100000,null], [9,null,null,null,null,null,null,null,'X',110000,null],
    [9,null,null,null,null,null,null,null,'X',75000,null], [9,null,null,null,null,null,null,null,'X',100000,null], [9,null,null,null,null,null,null,null,'X',150000,null], [9,null,null,null,null,null,null,null,'X',33500,null],
    [9,null,null,null,null,null,null,null,'X',90261.6,null], [9,null,null,null,null,null,null,null,'X',83378.4,null], [9,null,null,null,null,null,null,null,'X',400000,null], [9,null,null,null,null,null,null,null,'X',90000,null],
    [9,null,null,null,null,null,null,null,'X',109000,null], [9,null,null,null,null,null,null,null,'X',275000,null],
  ],
  '2025-I/cortometraggi': [
    [56,20,7,10,0,0,0,93,'F',40000,40000], [54,20,5,6,7,0,0,92,'F',10000,10000], [54,18,5,7,6,0,0,90,'F',27869.84,27000], [55,18,5,7,0,0,5,90,'F',26262.36,26000],
    [54,16,5,8,7,0,0,90,'F',30000,30000], [55,17,5,6,7,0,0,90,'F',35000,35000], [50,16,5,10,7,0,0,88,'F',40000,40000], [52,18,5,6,7,0,0,88,'F',12460,12000],
    [52,18,5,8,0,0,5,88,'F',33992.8,33000], [47,16,5,8,6,0,5,87,'F',41533.4,40000], [49,16,5,6,6,0,5,87,'F',27000,25000], [46,16,5,8,6,0,5,86,'F',37680.81,35000],
    [52,16,5,7,6,0,0,86,'F',30000,27000], [48,13,5,6,7,0,5,84,'F',37624.4,30000], [46,12,5,5,7,0,5,80,'F',77000,40000], [30,null,null,null,null,null,null,null,'X',9440,null],
    [30,null,null,null,null,null,null,null,'X',20000,null], [29,null,null,null,null,null,null,null,'X',18492,null], [29,null,null,null,null,null,null,null,'X',20000,null], [29,null,null,null,null,null,null,null,'X',12600,null],
    [29,null,null,null,null,null,null,null,'X',37298,null], [29,null,null,null,null,null,null,null,'X',21010,null], [29,null,null,null,null,null,null,null,'X',23740,null], [28,null,null,null,null,null,null,null,'X',15600,null],
    [28,null,null,null,null,null,null,null,'X',40500,null], [26,null,null,null,null,null,null,null,'X',21912.43,null], [19,null,null,null,null,null,null,null,'X',13000,null], [19,null,null,null,null,null,null,null,'X',16000,null],
    [19,null,null,null,null,null,null,null,'X',40200,null], [17,null,null,null,null,null,null,null,'X',20500,null], [9,null,null,null,null,null,null,null,'X',53760,null], [9,null,null,null,null,null,null,null,'X',27544,null],
    [9,null,null,null,null,null,null,null,'X',40000,null], [9,null,null,null,null,null,null,null,'X',48000,null], [9,null,null,null,null,null,null,null,'X',23529.6,null], [9,null,null,null,null,null,null,null,'X',30000,null],
    [9,null,null,null,null,null,null,null,'X',25896.28,null], [8,null,null,null,null,null,null,null,'X',35940.4,null], [8,null,null,null,null,null,null,null,'X',45000,null], [8,null,null,null,null,null,null,null,'X',29058.28,null],
    [8,null,null,null,null,null,null,null,'X',19006.24,null], [8,null,null,null,null,null,null,null,'X',20000,null], [8,null,null,null,null,null,null,null,'X',55338,null], [8,null,null,null,null,null,null,null,'X',29400,null],
    [8,null,null,null,null,null,null,null,'X',20228.8,null], [8,null,null,null,null,null,null,null,'X',29687,null], [8,null,null,null,null,null,null,null,'X',19005.44,null], [8,null,null,null,null,null,null,null,'X',24148,null],
    [8,null,null,null,null,null,null,null,'X',13242.08,null], [8,null,null,null,null,null,null,null,'X',24680,null], [8,null,null,null,null,null,null,null,'X',20000,null], [8,null,null,null,null,null,null,null,'X',40538,null],
    [8,null,null,null,null,null,null,null,'X',23795.4,null], [8,null,null,null,null,null,null,null,'X',26560,null], [8,null,null,null,null,null,null,null,'X',28000,null], [8,null,null,null,null,null,null,null,'X',25554.4,null],
    [8,null,null,null,null,null,null,null,'X',17602.44,null], [8,null,null,null,null,null,null,null,'X',13892.57,null], [8,null,null,null,null,null,null,null,'X',25000,null], [8,null,null,null,null,null,null,null,'X',29502,null],
    [8,null,null,null,null,null,null,null,'X',16336,null],
  ],
  '2025-I/animazione': [
    [71,18,7,8,7,0,5,116,'F',416880,416000], [71,18,7,8,0,4,5,113,'F',400000,400000], [71,18,7,7,0,0,0,103,'F',1000000,1000000], [60,16,6,7,4,4,5,102,'F',450000,450000],
    [61,16,6,7,4,0,5,99,'F',346000,346000], [54,14,6,6,4,10,5,99,'F',800000,800000], [48,12,6,5,7,4,5,87,'F',750000,300000], [50,12,6,5,7,0,5,85,'F',65496.76,65000],
    [6,null,null,null,null,null,null,null,'X',270000,null], [6,null,null,null,null,null,null,null,'X',565765.76,null], [6,null,null,null,null,null,null,null,'X',150000,null], [6,null,null,null,null,null,null,null,'X',600000,null],
    [6,null,null,null,null,null,null,null,'X',800000,null], [6,null,null,null,null,null,null,null,'X',400000,null], [6,null,null,null,null,null,null,null,'X',69249.2,null], [6,null,null,null,null,null,null,null,'X',1000000,null],
  ],
  '2025-II-film/film-qualita-identita': [
    [55,19,7,9,4,4,5,103,'F',1480000,1000000], [56,20,7,8,0,6,0,97,'F',953788.8,750000], [58,19,6,8,0,0,5,96,'F',1800000,1200000], [57,19,7,8,0,0,5,96,'F',450000,450000],
    [57,18,7,9,0,0,5,96,'F',1000000,800000], [58,18,6,9,0,0,5,96,'F',900000,750000], [56,18,5,5,6,0,5,95,'F',400000,400000], [51,16,5,7,6,4,5,94,'F',700000,600000],
    [49,16,6,7,7,4,5,94,'F',990000,700000], [51,15,5,7,7,4,5,94,'F',700000,600000], [59,18,7,8,0,0,0,92,'F',545000,500000], [55,17,6,8,0,0,5,91,'F',1076000,700000],
    [51,14,6,8,6,0,5,90,'F',800000,700000], [45,16,7,7,6,4,5,90,'F',1100000,650000], [53,16,6,9,0,0,5,89,'F',800000,700000], [49,13,6,8,7,0,5,88,'F',750000,600000],
    [46,17,6,7,6,0,5,87,'F',800000,550000], [51,15,6,8,0,0,5,85,'F',1800000,800000], [45,17,7,7,4,0,5,85,'F',1100000,450000], [50,15,6,8,0,0,5,84,'F',659600,450000],
    [46,14,5,7,6,0,5,83,'F',1800000,700000], [43,15,4,6,7,0,5,80,'F',559200,400000], [48,15,5,6,6,0,0,80,'F',650000,400000], [37,13,5,7,7,4,5,78,'X',400000,null],
    [38,14,7,7,7,0,5,78,'X',600000,null], [38,14,7,7,7,0,5,78,'X',650000,null], [38,14,7,7,7,0,5,78,'X',1600000,null], [46,15,7,7,0,0,0,75,'X',638000,null],
    [37,13,6,6,0,6,5,73,'X',400000,null], [38,12,6,6,6,0,5,73,'X',800000,null], [38,12,6,6,6,0,5,73,'X',400000,null], [38,12,6,6,6,0,5,73,'X',600000,null],
    [38,12,6,6,6,0,5,73,'X',750000,null], [40,13,7,8,0,0,5,73,'X',625000,null], [37,12,6,7,0,4,5,71,'X',820000,null], [39,12,7,7,0,0,5,70,'X',1800000,null],
    [20,null,null,null,null,null,null,null,'X',800000,null], [20,null,null,null,null,null,null,null,'X',800000,null], [20,null,null,null,null,null,null,null,'X',800000,null], [19,null,null,null,null,null,null,null,'X',1598061,null],
    [19,null,null,null,null,null,null,null,'X',500000,null], [19,null,null,null,null,null,null,null,'X',800000,null], [19,null,null,null,null,null,null,null,'X',548000,null], [19,null,null,null,null,null,null,null,'X',193680,null],
    [19,null,null,null,null,null,null,null,'X',1200000,null], [19,null,null,null,null,null,null,null,'X',500000,null], [9,null,null,null,null,null,null,null,'X',790000,null],
  ],
  '2025-I-film/film-qualita-identita': [
    [47,14,5,7,6,4,5,88,'F',400000,400000], [47,14,4,7,6,4,5,87,'F',630000,630000], [50,14,5,7,6,0,5,87,'F',500000,500000], [52,16,5,7,6,0,0,86,'F',610000,610000],
    [57,15,6,7,0,0,0,85,'F',700000,700000], [54,17,5,8,0,0,0,84,'F',370000,370000], [51,16,5,7,0,0,5,84,'F',788000,788000], [53,17,6,7,0,0,0,83,'F',1000000,1000000],
    [51,15,5,7,0,0,5,83,'F',871712,870000], [50,16,5,7,0,0,5,83,'F',800000,800000], [47,14,5,6,6,0,5,83,'F',700000,700000], [53,16,6,7,0,0,0,82,'F',900000,900000],
    [50,16,5,7,4,0,0,82,'F',573755.02,572000], [53,16,6,7,0,0,0,82,'F',800000,800000], [49,15,5,7,0,0,5,81,'F',1290000,1050000], [48,15,5,8,0,0,5,81,'F',1800000,1050000],
    [46,13,5,6,6,0,5,81,'F',775080,500000], [39,12,4,5,6,10,5,81,'F',360000,320000], [52,17,5,7,0,0,0,81,'F',800000,635000], [48,16,5,7,0,0,5,81,'F',1800000,1050000],
    [50,16,7,7,0,0,0,80,'F',1179000,480000], [48,14,5,8,0,0,5,80,'F',310000,125000], [36,12,4,6,7,0,5,70,'X',750000,null], [41,12,4,7,0,0,5,69,'X',1000000,null],
    [37,12,5,6,0,0,5,65,'X',922850,null], [30,null,null,null,null,null,null,null,'X',700000,null], [30,null,null,null,null,null,null,null,'X',1450000,null], [30,null,null,null,null,null,null,null,'X',500000,null],
    [30,null,null,null,null,null,null,null,'X',1800000,null], [30,null,null,null,null,null,null,null,'X',1350000,null], [30,null,null,null,null,null,null,null,'X',800000,null], [20,null,null,null,null,null,null,null,'X',500000,null],
    [20,null,null,null,null,null,null,null,'X',1304703.74,null], [20,null,null,null,null,null,null,null,'X',750000,null], [20,null,null,null,null,null,null,null,'X',500000,null], [20,null,null,null,null,null,null,null,'X',700000,null],
    [20,null,null,null,null,null,null,null,'X',1800000,null], [20,null,null,null,null,null,null,null,'X',700000,null], [20,null,null,null,null,null,null,null,'X',700000,null], [20,null,null,null,null,null,null,null,'X',1800000,null],
    [20,null,null,null,null,null,null,null,'X',528000,null], [20,null,null,null,null,null,null,null,'X',750000,null], [20,null,null,null,null,null,null,null,'X',200000,null], [9,null,null,null,null,null,null,null,'X',365000,null],
    [9,null,null,null,null,null,null,null,'X',250000,null],
  ],
};

const righe = (lista) => lista.map(([A, B, C, D, E, F, G, totale, stato, richiesto, assegnato], i) => ({ n: i + 1, sezioni: { A, B, C, D, E, F, G }, totale, stato, richiesto, assegnato }));

// In ordine dalla più recente.
export const ESITI_MIC = [
  {
    id: '2025-II', anno: 2025, sessione: 'II sessione 2025', decreto: 'D.D. 10 luglio 2026 rep. 2211', url: 'https://cinema.cultura.gov.it/download/39356/',
    bando: 'D.D. 9 giugno 2025 rep. 2251 (contributi selettivi 2025), art. 24, tabelle 4 e 5',
    categorie: {
    'giovani-autori': { massimi: {A: 56, B: 20, C: 7, D: 10, E: 7, F: 10, G: 5}, massimoTotale: 115, minimoTotale: 75, minimi: { D: 5 }, dotazione: 3900000, righe: righe(R['2025-II/giovani-autori']) },
    'prime-seconde': { massimi: {A: 56, B: 20, C: 7, D: 10, E: 7, F: 10, G: 5}, massimoTotale: 115, minimoTotale: 75, minimi: { D: 5 }, dotazione: 3750000, righe: righe(R['2025-II/prime-seconde']) },
    'documentari': { massimi: {A: 63, B: 20, C: 7, D: 10, E: 7, F: 10, G: 5}, massimoTotale: 122, minimoTotale: 80, minimi: { D: 5 }, dotazione: 3300000, righe: righe(R['2025-II/documentari']) },
    'cortometraggi': { massimi: {A: 56, B: 20, C: 7, D: 10, E: 7, F: 10, G: 5}, massimoTotale: 115, minimoTotale: 75, minimi: { D: 5 }, dotazione: 450000, righe: righe(R['2025-II/cortometraggi']) },
    'animazione': { massimi: {A: 71, B: 20, C: 7, D: 10, E: 7, F: 10, G: 5}, massimoTotale: 130, minimoTotale: 85, minimi: { D: 5 }, dotazione: 4400000, righe: righe(R['2025-II/animazione']) },
    },
  },
  {
    id: '2025-II-film', anno: 2025, sessione: 'II sessione 2025', decreto: 'D.D. 10 luglio 2026 rep. 2212', url: 'https://cinema.cultura.gov.it/download/39361/',
    bando: 'D.D. 9 giugno 2025 rep. 2249 (film di particolare qualità artistica e identità culturale italiana), art. 9, tabella 1',
    categorie: {
    'film-qualita-identita': { massimi: {A: 63, B: 20, C: 7, D: 10, E: 7, F: 10, G: 5}, massimoTotale: 122, minimoTotale: 80, minimi: { D: 5 }, dotazione: 14850000, righe: righe(R['2025-II-film/film-qualita-identita']) },
    },
  },
  {
    id: '2025-I', anno: 2025, sessione: 'I sessione 2025', decreto: 'D.D. 2 aprile 2026 rep. 738', url: 'https://cinema.cultura.gov.it/download/38395/',
    bando: 'D.D. 9 giugno 2025 rep. 2251 (contributi selettivi 2025), art. 24, tabelle 4 e 5',
    categorie: {
    'giovani-autori': { massimi: {A: 56, B: 20, C: 7, D: 10, E: 7, F: 10, G: 5}, massimoTotale: 115, minimoTotale: 75, minimi: { D: 5 }, dotazione: 3900000, righe: righe(R['2025-I/giovani-autori']) },
    'prime-seconde': { massimi: {A: 56, B: 20, C: 7, D: 10, E: 7, F: 10, G: 5}, massimoTotale: 115, minimoTotale: 75, minimi: { D: 5 }, dotazione: 3750000, righe: righe(R['2025-I/prime-seconde']) },
    'documentari': { massimi: {A: 63, B: 20, C: 7, D: 10, E: 7, F: 10, G: 5}, massimoTotale: 122, minimoTotale: 80, minimi: { D: 5 }, dotazione: 3300000, righe: righe(R['2025-I/documentari']) },
    'cortometraggi': { massimi: {A: 56, B: 20, C: 7, D: 10, E: 7, F: 10, G: 5}, massimoTotale: 115, minimoTotale: 75, minimi: { D: 5 }, dotazione: 450000, righe: righe(R['2025-I/cortometraggi']) },
    'animazione': { massimi: {A: 71, B: 20, C: 7, D: 10, E: 7, F: 10, G: 5}, massimoTotale: 130, minimoTotale: 85, minimi: { D: 5 }, dotazione: 4400000, righe: righe(R['2025-I/animazione']) },
    },
  },
  {
    id: '2025-I-film', anno: 2025, sessione: 'I sessione 2025', decreto: 'D.D. 2 aprile 2026 rep. 739', url: 'https://cinema.cultura.gov.it/download/38399/',
    bando: 'D.D. 9 giugno 2025 rep. 2249 (film di particolare qualità artistica e identità culturale italiana), art. 9, tabella 1',
    categorie: {
    'film-qualita-identita': { massimi: {A: 63, B: 20, C: 7, D: 10, E: 7, F: 10, G: 5}, massimoTotale: 122, minimoTotale: 80, minimi: { D: 5 }, dotazione: 14850000, righe: righe(R['2025-I-film/film-qualita-identita']) },
    },
  },
];

/* ------------------------------------------------------------------ letture */
const r1 = (v) => Math.round(v * 10) / 10;
const mediana = (valori) => { const o = [...valori].sort((a, b) => a - b); if (!o.length) return null; const m = (o.length - 1) / 2; return r1((o[Math.floor(m)] + o[Math.ceil(m)]) / 2); };

/** Le graduatorie reali che riguardano le linee di un bando del catalogo: [{ atto, categoriaId, dati }], dalla più recente. */
export function esitiStorici(bando) {
  if (!bando?.id) return [];
  const linee = new Set((bando.categorie || []).map((c) => c.id).filter((id) => LINEE_MIC[id] === bando.id));
  return ESITI_MIC.flatMap((atto) => Object.entries(atto.categorie).filter(([id]) => linee.has(id)).map(([categoriaId, dati]) => ({ atto, categoriaId, dati })));
}

/**
 * Riassunto di una graduatoria: quanti progetti, quanti finanziati, primo e ultimo finanziato (in punti e in quota del
 * massimo), mediane dei finanziati criterio per criterio, contributi assegnati.
 */
export function statisticheStoriche(dati) {
  const tutte = dati.righe;
  const fin = tutte.filter((r) => r.stato === 'F');
  const completi = tutte.filter((r) => r.totale != null);
  const quota = (p) => (p == null ? null : r1((p / dati.massimoTotale) * 100));
  const assegnati = fin.map((r) => r.assegnato).filter((v) => v != null);
  const primo = fin.length ? Math.max(...fin.map((r) => r.totale)) : null;
  const ultimo = fin.length ? Math.min(...fin.map((r) => r.totale)) : null;
  return {
    presentati: tutte.length, valutatiPerIntero: completi.length, finanziati: fin.length,
    fermatiAlPrimoCriterio: tutte.filter((r) => r.sezioni.B == null).length,
    primo, ultimoFinanziato: ultimo, quotaPrimo: quota(primo), quotaUltimo: quota(ultimo),
    medianaFinanziati: mediana(fin.map((r) => r.totale)),
    mediane: Object.fromEntries(Object.keys(dati.massimi).map((k) => [k, mediana(fin.map((r) => r.sezioni[k]).filter((v) => v != null))])),
    minimiFinanziati: Object.fromEntries(Object.keys(dati.massimi).map((k) => [k, fin.length ? Math.min(...fin.map((r) => r.sezioni[k])) : null])),
    assegnato: assegnati.reduce((a, v) => a + v, 0), assegnatoMediano: mediana(assegnati), dotazione: dati.dotazione,
  };
}

/**
 * Dove si collocherebbe, in una graduatoria reale, un progetto che ottiene una certa quota del massimo (0-100).
 * È un confronto tra scale diverse (la griglia 2025 non è quella del 2026): vale come ordine di grandezza.
 */
export function collocazionePerQuota(dati, quota) {
  if (typeof quota !== 'number' || !Number.isFinite(quota)) return null;
  const punti = r1((quota / 100) * dati.massimoTotale);
  const fin = dati.righe.filter((r) => r.stato === 'F');
  const ultimo = fin.length ? Math.min(...fin.map((r) => r.totale)) : null;
  return { punti, massimo: dati.massimoTotale, posizione: dati.righe.filter((r) => r.totale != null && r.totale > punti).length + 1, su: dati.righe.length + 1, finanziati: fin.length, ultimoFinanziato: ultimo, finanziabile: ultimo == null ? null : punti >= ultimo };
}
