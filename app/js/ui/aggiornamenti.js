// Aggiornamenti dei bandi nell'interfaccia (segnaposto: l'implementazione completa arriva con il protocollo).
/** Controllo silenzioso all'avvio: non blocca, non mostra nulla se non c'è niente di nuovo. */
export async function controlloSilenzioso() { /* nessuna azione */ }
/** Riquadro per la pagina Bandi: stato del catalogo, ultimo controllo, registro. Restituisce un nodo o null. */
export function pannelloAggiornamenti(/* ridisegna */) { return null; }
/** Avviso da mostrare nel dettaglio di un bando quando la pagina ufficiale è cambiata o c'è una proposta. Nodo o null. */
export function avvisoBando(/* bando, ridisegna */) { return null; }
