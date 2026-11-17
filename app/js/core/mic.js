// Il dossier sulle griglie dei contributi selettivi del MiC (bando 2026) e il confronto con le graduatorie reali 2025.
// Logica pura. È una STIMA INDICATIVA, non una valutazione: per i criteri di qualità si riporta sulla griglia MiC la
// stessa frazione del massimo che il dossier ha ottenuto nella valutazione sul proprio bando (per famiglia di criteri);
// i criteri a punteggio fisso (pari opportunità, coproduzione internazionale, certificazione ambientale) non si
// stimano: valgono i punti della condizione che l'utente dichiara.
import { frazioniDallaValutazione, tipiProgetto } from './confronto.js';
import { r1 } from './scoring.js';
import { LINEE_MIC, esitiStorici, statisticheStoriche, collocazionePerQuota } from './bandi/esiti-mic.js';

export const NOMI_LINEA = {
  'giovani-autori': 'Lungometraggi di giovani autori', 'prime-seconde': 'Opere prime e seconde', cortometraggi: 'Cortometraggi',
  'film-qualita-identita': 'Film di qualità e identità culturale', documentari: 'Documentari', animazione: 'Animazione',
};

/** Le linee MiC presenti nel catalogo in uso: [{ id, nome, bando, categoria }]. */
export function lineeMic(bandi = []) {
  return Object.entries(LINEE_MIC).map(([id, bandoId]) => {
    const bando = bandi.find((b) => b?.id === bandoId);
    const categoria = bando?.categorie?.find((c) => c.id === id);
    return bando && categoria && bando.griglie?.[categoria.griglia] ? { id, nome: NOMI_LINEA[id] || categoria.nome, bando, categoria } : null;
  }).filter(Boolean);
}

/** La linea da proporre: dalla tipologia dell'opera; per un lungometraggio di finzione, «film di qualità e identità culturale». */
export function lineaPredefinita(progetto, bandi = []) {
  const linee = lineeMic(bandi);
  const tipi = tipiProgetto(progetto, bandi);
  const scelta = tipi.includes('documentario') ? 'documentari' : tipi.includes('cortometraggio') ? 'cortometraggi' : tipi.includes('animazione') ? 'animazione' : 'film-qualita-identita';
  return (linee.find((l) => l.id === scelta) || linee[0])?.id || null;
}

/**
 * Stima del dossier su una linea MiC.
 * @param scelte  { [idCriterio]: punti } per i criteri a punteggio fisso; ciò che manca resta «da dichiarare» e vale 0
 * @returns null se la linea non c'è; { senzaValutazione: true, ... } se il dossier non ha ancora una valutazione
 */
export function stimaMic(progetto, bandi, lineaId, scelte = {}) {
  const linea = lineeMic(bandi).find((l) => l.id === lineaId);
  if (!linea) return null;
  const { bando, categoria } = linea;
  const griglia = bando.griglie[categoria.griglia];
  const base = frazioniDallaValutazione(progetto, bandi);
  let daDichiarare = 0, senzaRiscontro = 0;
  const sezioni = griglia.sezioni.map((s) => {
    const criteri = s.criteri.map((c) => {
      if (c.tipo === 'discreto') {
        const ammessi = (c.valori || []).map((v) => v.punti);
        const scelto = typeof scelte[c.id] === 'number' && ammessi.includes(scelte[c.id]) ? scelte[c.id] : null;
        if (scelto == null) daDichiarare++;
        return { id: c.id, nome: c.nome, max: c.max, punti: scelto ?? 0, origine: scelto == null ? 'da_dichiarare' : 'dichiarato', valori: c.valori || [], scelto, descrizione: c.descrizione || '' };
      }
      if (!base) return { id: c.id, nome: c.nome, max: c.max, punti: null, origine: 'manca' };
      const fam = base.famiglie.get(c.famiglia);
      if (!fam) senzaRiscontro += c.max;
      return { id: c.id, nome: c.nome, max: c.max, punti: r1(c.max * (fam ? fam.frazione : base.media)), origine: fam ? 'valutazione' : 'media', famiglia: c.famiglia };
    });
    const punti = criteri.some((c) => c.punti == null) ? null : r1(criteri.reduce((a, c) => a + c.punti, 0));
    const minimo = categoria.soglie?.[s.id] ?? null;
    return { id: s.id, nome: s.nome, massimo: s.max, minimo, punti, sopra: punti == null || minimo == null ? null : punti >= minimo, fissa: criteri.every((c) => c.valori), criteri };
  });
  const comune = { linea, bando, categoria, sezioni, massimo: bando.punteggioMassimo, sogliaTotale: bando.sogliaTotale, daDichiarare };
  if (!base) return { ...comune, senzaValutazione: true };
  const totale = r1(sezioni.reduce((a, s) => a + s.punti, 0));
  const qualita = sezioni.filter((s) => !s.fissa);
  const sotto = sezioni.filter((s) => s.sopra === false).map((s) => s.id);
  const quota = r1((totale / bando.punteggioMassimo) * 100);
  return {
    ...comune, senzaValutazione: false, totale, quota, sezioniSotto: sotto, sopraSoglia: totale >= bando.sogliaTotale && !sotto.length,
    qualita: { punti: r1(qualita.reduce((a, s) => a + s.punti, 0)), massimo: r1(qualita.reduce((a, s) => a + s.massimo, 0)) },
    fissi: { punti: r1(sezioni.filter((s) => s.fissa).reduce((a, s) => a + s.punti, 0)), massimo: r1(sezioni.filter((s) => s.fissa).reduce((a, s) => a + s.massimo, 0)) },
    senzaRiscontro: r1(senzaRiscontro),
    base: { nome: base.bando.nomeBreve || base.bando.nome, totale: base.risultato.totale, massimo: base.risultato.massimo, completo: base.risultato.completo },
    // graduatorie reali della stessa linea: la griglia 2025 era diversa, quindi il confronto si fa sulla quota del massimo
    confronti: esitiStorici(bando).filter((e) => e.categoriaId === lineaId).map((e) => ({ atto: e.atto, statistiche: statisticheStoriche(e.dati), collocazione: collocazionePerQuota(e.dati, quota) })),
  };
}
