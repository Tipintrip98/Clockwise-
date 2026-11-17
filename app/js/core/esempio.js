// Dossier di esempio: «L’insabbiato», lungometraggio presentato all'avviso della Regione Siciliana nella finestra 2024
// e finanziato con 89,5 punti (terzo dei nove film in graduatoria, D.D.G. n. 2003 dell'11/07/2024).
// Qui ci sono soltanto i numeri: dati chiave del Modulo III, piano finanziario (con i finanziatori resi anonimi),
// punteggio reale della Commissione e punteggi della simulazione di Clockwise sul dossier completo.
// I documenti del dossier, i loro testi, i nomi di persone e società e le motivazioni dei commissari NON sono inclusi:
// il dossier completo si carica, per chi lo possiede, con «Importa dossier».
import { datiVuoti } from './scoring.js';

export const VERSIONE_ESEMPIO = 2;
export const NOME_ESEMPIO = 'Esempio — L’insabbiato';
export const ESEMPIO = {
  bandoId: 'sicilia-2025-2027', categoriaId: 'film', anno: 2025,
  titolo: 'L’insabbiato', annoReale: 2024, totaleReale: 89.5, posizioneReale: 3, filmFinanziati: 9,
  simulato: { totale: 88.9, sezioni: { A: 19.6, B: 16.2, C: 30, D: 23.1 }, rigoroso: 53.9 },
};
/** Punteggio reale attribuito dalla Commissione, sezione per sezione (atto pubblico). */
export const REALE_ESEMPIO = { A: 19.8, B: 16.6, C: 30, D: 23.1 };

export function datiEsempio() {
  return {
    ...datiVuoti(), titolo: ESEMPIO.titolo, tipologiaOpera: 'Film di produzione cinematografica', durataMin: 120, animazione: false,
    giorni: { prepTot: 20, prepSicilia: 20, ripreseTot: 30, ripreseSicilia: 30, postTot: 60, postSicilia: 60 },
    professionisti: { artTot: 12, artSicilia: 11, crewTot: 13, crewSicilia: 12 },
    economici: { costoProduzione: 870030, costoAmmissibile: 870030, contributoRichiesto: 172000, spesaSicilia: 692130, producerFee: 33000 },
    piano: [
      { voce: '1.1', etichetta: 'Contributo richiesto con questo bando', denominazione: '', importo: 172000, documento: 'nessuno' },
      { voce: '1.2', etichetta: 'Tax credit', denominazione: '', importo: 132500, documento: 'nessuno' },
      { voce: '2.2', etichetta: 'Produttori indipendenti', denominazione: 'Coproduttore italiano', importo: 198530, documento: 'contratto' },
      { voce: '3.1', etichetta: 'Produttori esteri', denominazione: 'Coproduttore estero 1', importo: 87000, documento: 'contratto' },
      { voce: '3.1', etichetta: 'Produttori esteri', denominazione: 'Coproduttore estero 2', importo: 130000, documento: 'contratto' },
      { voce: '4.3', etichetta: 'Product placement', denominazione: 'Società partner', importo: 150000, documento: 'contratto' },
    ],
    ripreseIniziate: false,
  };
}

// Voti dei tre commissari simulati sul dossier completo (versione 2.0.3): [criterio, lettura attesa, lettura rigorosa, valore].
const COMMISSARI = [['drammaturgia', 'Esperta di sceneggiatura'], ['produzione', 'Esperto di produzione'], ['territorio', 'Esperta di film commission']];
const VOTI = {
  A: [[['1.1', 5.2, 4.5], ['1.2', 8.8, 7.4], ['2.1', 5.3, 4.8]], [['1.1', 5.2, 4.5], ['1.2', 8.8, 7.5], ['2.1', 5.3, 4.8]], [['1.1', 5.2, 4.6], ['1.2', 8.8, 7.5], ['2.1', 5.4, 4.8]]],
  B: [[['3.1', 4.1, 3.2], ['3.2', 8.4, 2.4], ['3.3', 3, 0]], [['3.1', 4.1, 3.2], ['3.2', 8.5, 2.5], ['3.3', 3, 0]], [['3.1', 4.2, 3.3], ['3.2', 8.4, 2.5], ['3.3', 2.9, 0]]],
  D: [[['5.1', 0, 0, 81], ['5.2', 5, 0], ['5.3', 3.5, 1.4]], [['5.1', 0, 0, 81], ['5.2', 5, 0], ['5.3', 3.5, 1.3]], [['5.1', 0, 0, 81], ['5.2', 5, 0], ['5.3', 3.5, 1.4]]],
};
// Correzione appresa dai casi reali, com'era al momento della valutazione (core/apprendimento.js).
const CORREZIONE = {
  versione: 1,
  criteri: {
    1.1: { centro: 5.4, peso: 0.5, casi: 0.014 }, 1.2: { centro: 9.2, peso: 0.5, casi: 0.024 }, 2.1: { centro: 5.3, peso: 0.5, casi: 0.012 },
    3.1: { centro: 4.4, peso: 0.25, casi: 0.108 }, 3.2: { centro: 8.8, peso: 0.5, casi: 0.18 }, 3.3: { centro: 3, peso: 0.25, casi: 0.072 },
    5.3: { centro: 3.7, peso: 0.5, casi: 0.05 },
  },
  sezioni: { A: { n: 1, media: 0.004, frazione: 0.002, punti: 0.1 }, B: { n: 1, media: 0.035, frazione: 0.018, punti: 0.4 }, D: { n: 1, media: 0.004, frazione: 0.002, punti: 0.1 } },
};
const SENZA_TESTI = 'Motivazione non inclusa nell’esempio: le motivazioni citano i documenti del dossier, che qui non ci sono. Le trovi nel dossier completo, se lo importi.';

export function valutazioneEsempio() {
  const commissari = COMMISSARI.map(([id, nome]) => ({ id, nome }));
  return {
    data: '2026-11-17T14:19:09.577Z', modello: 'claude-fable-5-2', impegno: 'high', collegamento: 'Account Claude (Claude Code)',
    commissari,
    giudizi: Object.fromEntries(Object.entries(VOTI).map(([sezione, perCommissario]) => [sezione, perCommissario.map((voti, i) => ({
      commissario: commissari[i], modello: 'claude-fable-5-2',
      criteri: voti.map(([id, punteggio, rigoroso, valore = null]) => ({ id, punteggio, rigoroso, valore, motivazione: SENZA_TESTI, evidenze: [], criticita: [], miglioramenti: [] })),
      sintesi: '',
    }))])),
    verifica: { controlli: [], sintesi: 'Nell’esempio la verifica documentale non è riportata: riguarda i documenti del dossier, che qui non sono inclusi.' },
    errori: [], note: ['Dossier di esempio: i punteggi sono quelli ottenuti da Clockwise sul dossier completo; documenti e motivazioni non sono inclusi.'],
    modelliUsati: ['claude-fable-5-2'], interrotta: false,
    correzione: JSON.parse(JSON.stringify(CORREZIONE)),
  };
}

/** Riempie un dossier appena creato (nuovoProgetto) con l'esempio. */
export function compilaEsempio(p) {
  Object.assign(p, {
    nome: NOME_ESEMPIO, bandoId: ESEMPIO.bandoId, categoriaId: ESEMPIO.categoriaId, anno: ESEMPIO.anno,
    esempio: true, esempioVersione: VERSIONE_ESEMPIO, documenti: [], dati: datiEsempio(),
    origineDati: { tipo: 'esempio', file: 'Modulo III del dossier reale', avvisi: [] },
    valutazione: valutazioneEsempio(), reale: { ...REALE_ESEMPIO }, punteggioPrimo: 91.9,
  });
  return p;
}
