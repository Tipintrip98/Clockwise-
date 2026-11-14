// Condizioni di produzione ricavate dallo spoglio e dal dossier (minori, animali, armi, droni, acqua…):
// servono a mostrare, tra gli adempimenti, quelli che riguardano davvero questo film.
import { getCategoria } from './scoring.js';

export const CONDIZIONI = [
  ['minori', 'Minori in scena', /minor|bambin|ragazzin|neonat|infant|adolescent/],
  ['animali', 'Animali', /animal|cavall|\bcan[ei]\b|gatt[oi]|pecor|capr|uccell|rapac|tonn[oi]|pesc[ei]\b|mucc|asin/],
  ['armi', 'Armi ed esplosivi', /\barm[ai]\b|pistol|fucil|spar[oi]|coltell|esplos|munizion|a salve/],
  ['droni', 'Riprese con drone', /dron[ei]/],
  ['suolo_pubblico', 'Luoghi pubblici e aree protette', /pubblic|strad[ae]|piazz|traffico|protett|riserva|parco|monument|sito archeolog|port[oi]\b|spiaggi|demani|chies/],
  ['musica', 'Musica e brani', /music|canzon|brano|playback|\bcant[oai]\b|orchestr|banda/],
  ['stunt', 'Stunt e azioni pericolose', /stunt|cadut|lott[ae]|inseguiment|altezz|fuoco|incend|rissa|combattiment/],
  ['acqua', 'Riprese in acqua e in mare', /acqua|\bmare\b|immersion|subacque|barc[ah]|nuot|piscin|fium[ei]|\blag[oh]/],
  ['veicoli', 'Veicoli in movimento', /veicol|camera car|in corsa|guida |auto in movimento|moto in/],
  ['notturne', 'Notturne in esterno', /notturn/],
];
const semplice = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Restituisce { [condizione]: { nome, scene: [numeri], motivo } } con le sole condizioni attive.
 * Dallo spoglio: rischi ed elementi di ogni scena. Dal dossier: tax credit, coproduzione, contributi pubblici, Green Film.
 */
export function condizioniProduzione(progetto, bando) {
  const out = {};
  const attiva = (id, nome, scena, motivo) => { const c = out[id] || { nome, scene: [], motivo: motivo || '' }; if (scena != null && !c.scene.includes(scena)) c.scene.push(scena); out[id] = c; };
  const spoglio = progetto.produzione?.spoglio;
  for (const s of spoglio?.scene || []) {
    const e = s.elementi || {};
    const testo = semplice([...(s.rischi || []), ...(e.stunt || []), ...(e.effetti || []), ...(e.attrezzature || []), ...(e.veicoli || []), ...(e.suono || []), s.comparse].join(' · '));
    for (const [id, nome, re] of CONDIZIONI) if (re.test(testo)) attiva(id, nome, s.numero);
    if (e.animali?.length) attiva('animali', 'Animali', s.numero);
    if (e.stunt?.length) attiva('stunt', 'Stunt e azioni pericolose', s.numero);
    if (/NOTTE|SERA/.test(s.luce || '') && /EST/.test(s.intEst || '')) attiva('notturne', 'Notturne in esterno', s.numero);
  }
  const piano = progetto.dati?.piano || [];
  const m3 = progetto.modulo3?.accordi || {};
  if (piano.some((r) => r.voce === '1.2' || /tax credit/i.test(r.etichetta || ''))) attiva('tax_credit', 'Tax credit', null, 'dichiarato nel piano finanziario');
  if (piano.some((r) => /^(2\.[2-5]|3\.)/.test(r.voce || '')) || m3.coproduzioneItalia?.presente || m3.coproduzioneEstero?.presente) attiva('coproduzione', 'Coproduzione', null, 'dichiarata nel piano finanziario o nel Modulo III');
  if (m3.coproduzioneEstero?.presente || piano.some((r) => /^3\./.test(r.voce || ''))) attiva('estero', 'Rapporti con l’estero', null, 'coproduzione internazionale');
  // gli obblighi che seguono da un beneficio pubblico valgono anche per il solo tax credit
  if (out.tax_credit && !bando) attiva('contributi_pubblici', 'Contributi pubblici', null, 'tax credit dichiarato nel piano finanziario');
  if (bando) {
    attiva('contributi_pubblici', 'Contributi pubblici', null, `candidatura a ${bando.nomeBreve || bando.nome}`);
    const cat = getCategoria(bando, progetto.categoriaId);
    if (cat?.greenFilm && !progetto.dati?.animazione) attiva('green', 'Certificazione ambientale', null, 'requisito di ammissibilità del bando');
  }
  return out;
}
