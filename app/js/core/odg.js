// Ordine del giorno (call sheet), calendario delle riprese e stralci: tutto ricavato dallo spoglio
// e dal piano di lavorazione, senza chiamare Claude.
import { dividiScene, pagine, CATEGORIE_ELEMENTI } from './sceneggiatura.js';

const GIORNO = 86400000;
const NOMI_GIORNO = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const dataEstesa = (iso) => { if (!iso) return ''; const d = new Date(`${iso}T12:00:00Z`); return `${NOMI_GIORNO[d.getUTCDay()]} ${d.getUTCDate()} ${MESI[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

/**
 * Date di calendario delle giornate di ripresa: si parte da `inizio` (AAAA-MM-GG) e si saltano i riposi.
 * giorniSettimana 5 = riposo sabato e domenica, 6 = riposo la domenica, 7 = nessun riposo.
 */
export function calendarioRiprese(totale, { inizio, giorniSettimana = 6 } = {}) {
  if (!inizio || !/^\d{4}-\d{2}-\d{2}$/.test(inizio)) return [];
  const date = [];
  let t = Date.parse(`${inizio}T12:00:00Z`);
  while (date.length < totale) {
    const g = new Date(t).getUTCDay();
    const riposo = (giorniSettimana <= 6 && g === 0) || (giorniSettimana <= 5 && g === 6);
    if (!riposo) date.push(new Date(t).toISOString().slice(0, 10));
    t += GIORNO;
  }
  return date;
}

const piu = (ora, minuti) => {
  const [h, m] = ora.split(':').map(Number);
  const tot = (((h * 60 + m + minuti) % 1440) + 1440) % 1440;
  return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
};

/**
 * Ordine del giorno della giornata n del piano.
 * opzioni: { inizio, giorniSettimana, convocazione: 'HH:MM' (troupe; se manca 07:00 di giorno, 17:00 di notte), oreLavoro }
 */
export function ordineDelGiorno(spoglio, piano, n, opzioni = {}) {
  const giorno = piano.giorni.find((d) => d.n === n);
  if (!giorno) return null;
  const perNumero = new Map(spoglio.scene.map((s) => [s.numero, s]));
  const perSet = new Map(spoglio.location.map((l) => [l.nome, l]));
  const scene = giorno.scene.map((num) => perNumero.get(num)).filter(Boolean);
  const notte = giorno.turno === 'NOTTE';
  const troupe = /^\d{1,2}:\d{2}$/.test(opzioni.convocazione || '') ? opzioni.convocazione.padStart(5, '0') : (notte ? '17:00' : '07:00');
  const ore = Math.max(6, Math.min(12, Number(opzioni.oreLavoro) || 10));
  const numeroCast = new Map(spoglio.personaggi.map((p, i) => [p.nome, i + 1]));
  const cast = new Map();
  for (const s of scene) for (const nome of s.personaggi) {
    const c = cast.get(nome) || { n: numeroCast.get(nome) || null, personaggio: nome, scene: [] };
    c.scene.push(s.numero); cast.set(nome, c);
  }
  const reparti = {};
  for (const [k, etichetta] of CATEGORIE_ELEMENTI) {
    const voci = new Map();
    for (const s of scene) for (const v of s.elementi[k] || []) { const e = voci.get(v.toLowerCase()) || { voce: v, scene: [] }; e.scene.push(s.numero); voci.set(v.toLowerCase(), e); }
    if (voci.size) reparti[k] = { nome: etichetta, voci: [...voci.values()] };
  }
  const date = calendarioRiprese(piano.totale, opzioni);
  const prossimo = piano.giorni.find((d) => d.n === n + 1);
  return {
    giorno: n, di: piano.totale, data: date[n - 1] || null, turno: giorno.turno,
    set: giorno.set.map((nome) => ({ nome, luogo: perSet.get(nome)?.luogo || '', sicilia: perSet.get(nome)?.sicilia ?? null })),
    orari: { trucco: piu(troupe, -30), troupe, prontiAGirare: piu(troupe, 60), pausa: piu(troupe, 60 + Math.round((ore * 60) / 2)), fine: piu(troupe, ore * 60 + 60) },
    scene: scene.map((s) => ({ numero: s.numero, intEst: s.intEst, ambiente: s.ambiente, luce: s.luce, ottavi: s.ottavi, sinossi: s.sinossi, personaggi: s.personaggi, comparse: s.comparse })),
    ottavi: giorno.ottavi,
    cast: [...cast.values()].sort((a, b) => (a.n || 999) - (b.n || 999)),
    comparse: scene.filter((s) => s.comparse).map((s) => ({ scena: s.numero, testo: s.comparse })),
    reparti,
    sicurezza: [...new Set(scene.flatMap((s) => s.rischi))],
    domani: prossimo ? { n: prossimo.n, data: date[prossimo.n - 1] || null, turno: prossimo.turno, set: prossimo.set, scene: prossimo.scene } : null,
  };
}

/** Ordine del giorno in testo semplice, pronto da incollare in una e-mail o da stampare. */
export function testoOdg(odg, { titolo = '', produzione = '', note = '' } = {}) {
  const riga = '—'.repeat(64);
  const r = [];
  r.push(`ORDINE DEL GIORNO N. ${odg.giorno} di ${odg.di}${titolo ? ` — ${titolo.toUpperCase()}` : ''}`);
  if (produzione) r.push(produzione);
  r.push(`${odg.data ? dataEstesa(odg.data) : 'Data da definire'} · turno di ${odg.turno === 'NOTTE' ? 'notte' : 'giorno'}`, riga);
  r.push(`Convocazione troupe ${odg.orari.troupe} · trucco e costumi ${odg.orari.trucco} · pronti a girare ${odg.orari.prontiAGirare} · pausa ${odg.orari.pausa} · fine lavorazione ${odg.orari.fine}`);
  r.push('', 'SET', ...odg.set.map((s) => `- ${s.nome}${s.luogo ? ` (${s.luogo})` : ''}`));
  r.push('', `SCENE (${pagine(odg.ottavi)} pagine)`);
  for (const s of odg.scene) r.push(`${String(s.numero).padEnd(5)} ${s.intEst}. ${s.ambiente} — ${s.luce} — ${pagine(s.ottavi)} pag.`, `      ${s.sinossi || ''}`, `      Cast: ${s.personaggi.map((p) => odg.cast.find((c) => c.personaggio === p)?.n || p).join(', ') || '—'}${s.comparse ? ` · Comparse: ${s.comparse}` : ''}`);
  r.push('', 'CAST', ...odg.cast.map((c) => `${String(c.n ?? '').padEnd(3)} ${c.personaggio.padEnd(26)} trucco ${odg.orari.trucco} · sul set ${odg.orari.prontiAGirare} · scene ${c.scene.join(', ')}`));
  if (odg.comparse.length) r.push('', 'COMPARSE', ...odg.comparse.map((c) => `- scena ${c.scena}: ${c.testo}`));
  const reparti = Object.values(odg.reparti);
  if (reparti.length) { r.push('', 'FABBISOGNI PER REPARTO'); for (const rep of reparti) r.push(`${rep.nome}: ${rep.voci.map((v) => `${v.voce} (sc. ${v.scene.join(', ')})`).join('; ')}`); }
  if (odg.sicurezza.length) r.push('', 'SICUREZZA E PREPARAZIONE', ...odg.sicurezza.map((x) => `- ${x}`));
  if (note) r.push('', 'NOTE', note);
  if (odg.domani) r.push('', riga, `DOMANI — giorno ${odg.domani.n}${odg.domani.data ? `, ${dataEstesa(odg.domani.data)}` : ''}: ${odg.domani.set.join(' / ')} · scene ${odg.domani.scene.join(', ')}`);
  return r.join('\n');
}

/** Stralci: il testo delle scene di una giornata, da distribuire agli attori. Null se il copione non ha intestazioni riconoscibili. */
export function stralci(documento, spoglio, numeriScena) {
  if (!documento?.testo || !spoglio?.formattata) return null;
  const divise = dividiScene(documento.testo).scene;
  if (divise.length !== spoglio.scene.length) return null;
  const voluti = new Set(numeriScena.map(String));
  const parti = spoglio.scene.map((s, i) => (voluti.has(String(s.numero)) ? `${divise[i].intestazione}\n\n${divise[i].testo}` : null)).filter(Boolean);
  return parti.length ? parti.join('\n\n\n') : null;
}

const csv = (righe) => righe.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
/** Calendario completo delle riprese in CSV. */
export function csvCalendario(spoglio, piano, opzioni = {}) {
  const date = calendarioRiprese(piano.totale, opzioni);
  return `﻿${csv([
    ['Giorno', 'Data', 'Turno', 'Set', 'Scene', 'Pagine'],
    ...piano.giorni.map((d) => [d.n, date[d.n - 1] ? dataEstesa(date[d.n - 1]) : '', d.turno === 'NOTTE' ? 'notte' : 'giorno', d.set.join(' / '), d.scene.join(', '), pagine(d.ottavi)]),
  ])}`;
}
