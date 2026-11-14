// Report completo in PDF: carica jsPDF solo quando serve e consegna il file.
import { toast, salvaFile, nomeFilePulito } from './dom.js';
import { assicura } from '../core/docs.js';
import { creaReportPdf } from '../core/report-pdf.js';

export async function scaricaReportPdf(p, bando, bottone) {
  const etichetta = bottone?.textContent;
  if (bottone) { bottone.disabled = true; bottone.textContent = 'Preparazione del PDF…'; }
  try {
    await assicura('jspdf');
    const JsPDF = globalThis.jspdf?.jsPDF;
    if (!JsPDF) throw new Error('Il generatore di PDF non è disponibile: controlla la connessione e riprova.');
    const { buffer } = creaReportPdf(JsPDF, bando, p);
    await salvaFile(nomeFilePulito(`report-completo-${p.dati.titolo || p.nome}`, 'pdf'), new Blob([buffer], { type: 'application/pdf' }), 'application/pdf');
  } catch (e) {
    toast(e.message || 'Creazione del PDF non riuscita');
  } finally {
    if (bottone) { bottone.disabled = false; bottone.textContent = etichetta; }
  }
}
