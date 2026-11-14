// Dati del report raccolti in un solo punto: servono alla pagina Report e al report completo in PDF.
import { componiRisultato, getCategoria, getGriglia, elencoCriteri, verificheAmmissibilita, suggerimentiQuantitativi, calcolaMetriche, coperturaPiano,
  statisticheEsiti, posizioneEsiti, storicoFinanziamento, previsioneStatistica, stimaContributo, r1 } from './scoring.js';
import { valutazioniPerCriterio } from './engine.js';
import { statoInvio, controlliFormato, controlliIncrociati } from './invio.js';

/** Interventi ordinati per punti recuperabili: prima i blocchi di ammissibilità, poi numeri e contenuti. */
export function pianoMiglioramento(p, bando, ris, controlli) {
  const voci = [];
  for (const c of controlli.filter((x) => x.esito === 'critico')) voci.push({ tipo: 'blocco', testo: `${c.titolo}: ${c.dettaglio}`, dove: 'Ammissibilità' });
  for (const c of (p.valutazione?.verifica?.controlli || []).filter((x) => x.esito === 'critico')) voci.push({ tipo: 'blocco', testo: `${c.titolo}: ${c.azione || c.dettaglio}`, dove: 'Verifica formale' });
  for (const s of suggerimentiQuantitativi(bando, p.categoriaId, p.dati)) voci.push({ tipo: 'punti', testo: s.azione, punti: s.guadagno, dove: `${s.criterio} · ${s.nome}` });
  for (const sez of ris.sezioni) for (const c of sez.criteri) {
    const proposte = c.giudizi.flatMap((g) => (g.miglioramenti || []).map((m) => ({ ...m, chi: g.commissario })));
    const margine = c.massimo - (c.punti ?? 0);
    proposte.sort((a, b) => b.punti - a.punti);
    const viste = new Set();
    for (const m of proposte) {
      const chiave = m.azione.toLowerCase().slice(0, 40);
      if (viste.has(chiave) || viste.size >= 2) continue;
      viste.add(chiave);
      voci.push({ tipo: 'punti', testo: m.azione, punti: Math.min(Math.max(m.punti, 0), margine), dove: `${c.id} · ${c.nome} — ${m.chi}` });
    }
  }
  const blocchi = voci.filter((v) => v.tipo === 'blocco');
  const punti = voci.filter((v) => v.tipo === 'punti' && v.punti > 0).sort((a, b) => b.punti - a.punti).slice(0, 12);
  return { blocchi, punti };
}

export const TITOLI_ESITO = {
  ammissibile: 'Sopra tutte le soglie',
  a_rischio: 'Ammissibile, con margine ridotto',
  sotto_soglia: 'Sotto soglia: così non è finanziabile',
  parziale: 'Stima parziale',
};

/** Confronto tra la stima e il punteggio reale inserito a mano (progetto.reale), sezione per sezione. */
export function confrontoConReale(ris, reale = {}) {
  const righe = ris.sezioni.map((s) => {
    const r = typeof reale?.[s.id] === 'number' ? reale[s.id] : null;
    return { id: s.id, nome: s.nome, massimo: s.massimo, stima: s.punti, completa: s.completo, reale: r, scarto: r != null && s.completo ? r1(s.punti - r) : null };
  });
  const con = righe.filter((x) => x.scarto != null);
  const tutte = righe.every((x) => x.reale != null);
  const totaleReale = tutte ? r1(righe.reduce((a, x) => a + x.reale, 0)) : null;
  return {
    righe, presenti: righe.some((x) => x.reale != null), totaleReale,
    scartoTotale: totaleReale != null && ris.completo ? r1(ris.totale - totaleReale) : null,
    scartoMedio: con.length ? r1(con.reduce((a, x) => a + Math.abs(x.scarto), 0) / con.length) : null,
  };
}

/** Tutto ciò che il report mostra, calcolato una volta sola. `oggi` è iniettabile per i test. */
export function raccogliReport(bando, p, oggi = new Date()) {
  const ris = componiRisultato(bando, p.categoriaId, p.dati, valutazioniPerCriterio(p.valutazione));
  const docs = p.documenti || [];
  let controlli = verificheAmmissibilita(bando, p.categoriaId, p.anno, p.dati, docs.map((d) => d.tipo));
  if (!docs.length) controlli = [{ id: 'all_nessuno', esito: 'da_verificare', titolo: 'Allegati del dossier', dettaglio: 'Nessun file caricato.' }, ...controlli.filter((c) => !c.id.startsWith('all_'))];
  controlli = [...controlli, ...controlliFormato(bando, docs), ...controlliIncrociati(bando, p)];
  const st = statisticheEsiti(bando, p.categoriaId);
  const primo = p.punteggioPrimo || st?.primo || 85;
  const richiesto = p.dati.economici?.contributoRichiesto;
  return {
    ris, controlli, categoria: getCategoria(bando, p.categoriaId),
    definizioni: Object.fromEntries(elencoCriteri(getGriglia(bando, p.categoriaId)).map((c) => [c.id, c])),
    piano: pianoMiglioramento(p, bando, ris, controlli),
    invio: statoInvio(bando, p, ris, oggi),
    statistiche: st, storico: storicoFinanziamento(bando, p.categoriaId),
    posizione: ris.completo && ris.esito !== 'sotto_soglia' ? posizioneEsiti(bando, p.categoriaId, ris.totale) : null,
    previsione: previsioneStatistica(bando, p.categoriaId, ris),
    reale: confrontoConReale(ris, p.reale),
    contributo: { richiesto: richiesto ?? null, primo, stima: stimaContributo(richiesto, ris.totale, primo) },
    metriche: calcolaMetriche(p.dati), copertura: coperturaPiano(p.dati),
  };
}
