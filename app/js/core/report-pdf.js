// Report completo in PDF: tutti i dati interni del dossier in un documento impaginato.
// Usa jsPDF (passato dal chiamante: nel browser arriva da vendor/, nei test da npm), solo testo e forme:
// niente immagini, niente HTML, quindi il file resta leggero e identico su ogni sistema.
import { raccogliReport, TITOLI_ESITO } from './report-dati.js';
import { ETICHETTE_DOC } from './scoring.js';
import { tipoPerId } from './docs.js';
import { APP } from './versione.js';
import { pianoLavorazione, pagine as inPagine } from './sceneggiatura.js';
import { totaliPreventivo } from './preventivo.js';

const PT = 0.352778; // un punto tipografico in millimetri
const INK = [18, 27, 37], MUTO = [86, 100, 115], LINEA = [211, 218, 226], FONDO = [242, 244, 247];
const ACCENTO = [36, 65, 194], OK = [21, 118, 74], AVVISO = [154, 92, 6], MALE = [179, 46, 38], SEGNALE = [201, 135, 8];
const COLORE_ESITO = { ok: OK, attenzione: AVVISO, critico: MALE, da_verificare: MUTO };
const NOME_ESITO = { ok: 'A posto', attenzione: 'Da sistemare', critico: 'Bloccante', da_verificare: 'Da confermare' };

// I caratteri tipografici standard del PDF coprono il set Windows-1252: tutto il resto va sostituito.
const CP1252 = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const SOSTITUZIONI = [[/→/g, '->'], [/←/g, '<-'], [/[✓✔]/g, 'sì'], [/[✕✗✘]/g, 'x'], [/″/g, '"'], [/′/g, "'"], [/≥/g, '>='], [/≤/g, '<='], [/−/g, '-'], [/[    ]/g, ' '], [/[​﻿]/g, ''], [/÷/g, '/'], [/\t/g, ' ']];
export function pulisci(testo) {
  let s = String(testo ?? '');
  for (const [re, con] of SOSTITUZIONI) s = s.replace(re, con);
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    out += ch === '\n' || (c >= 32 && c <= 126) || (c >= 161 && c <= 255) || CP1252.includes(ch) ? ch : '?';
  }
  return out;
}

const num = (n, dec = 1) => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: dec }));
const euro = (n) => (n == null || Number.isNaN(n) ? '—' : `${Math.round(Number(n)).toLocaleString('it-IT')} €`);
const pct = (n) => (n == null || Number.isNaN(n) ? '—' : `${num(n)}%`);
const dataOra = (d) => new Date(d).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const giorno = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Piccolo impaginatore sopra jsPDF: testo che va a capo, elenchi, tabelle e salti di pagina. */
class Impaginatore {
  constructor(JsPDF, compressione = true) {
    this.d = new JsPDF({ unit: 'mm', format: 'a4', compress: compressione });
    this.L = 210; this.A = 297; this.mx = 16; this.alto = 20; this.basso = 18;
    this.w = this.L - 2 * this.mx; this.y = this.alto;
  }
  font(peso = 'normal', corpo = 9.5, colore = INK) { this.d.setFont('helvetica', peso); this.d.setFontSize(corpo); this.d.setTextColor(...colore); }
  riga(corpo) { return corpo * PT * 1.36; }
  spazio(mm = 3) { this.y += mm; }
  serve(mm) { if (this.y + mm > this.A - this.basso) { this.d.addPage(); this.y = this.alto; return true; } return false; }
  righe(testo, w, peso, corpo) { this.d.setFont('helvetica', peso); this.d.setFontSize(corpo); return pulisci(testo).split('\n').flatMap((par) => (par.trim() ? this.d.splitTextToSize(par, w) : [''])); }

  testo(t, { corpo = 9.5, peso = 'normal', colore = INK, x = this.mx, w = null, dopo = 1.6 } = {}) {
    if (t == null || t === '') return;
    const largo = w ?? this.w - (x - this.mx);
    const h = this.riga(corpo);
    for (const r of this.righe(t, largo, peso, corpo)) {
      this.serve(h);
      this.font(peso, corpo, colore);
      if (r) this.d.text(r, x, this.y + corpo * PT);
      this.y += h;
    }
    this.y += dopo;
  }
  titolo(t) {
    this.spazio(4); this.serve(22);
    this.d.setFillColor(...ACCENTO); this.d.rect(this.mx, this.y, 1.4, 6.2, 'F');
    this.font('bold', 13.5, INK); this.d.text(pulisci(t), this.mx + 4, this.y + 4.9);
    this.y += 9.5;
  }
  sotto(t, extra = '') {
    this.spazio(1.5); this.serve(14);
    this.font('bold', 10.5, INK); this.d.text(pulisci(t), this.mx, this.y + 3.7);
    if (extra) { this.font('normal', 9, MUTO); this.d.text(pulisci(extra), this.mx + this.w, this.y + 3.7, { align: 'right' }); }
    this.y += 6;
  }
  etichetta(t) { this.serve(6); this.font('bold', 7, MUTO); this.d.text(pulisci(t).toUpperCase(), this.mx, this.y + 2.5, { charSpace: 0.25 }); this.y += 4.2; }
  filo() { this.d.setDrawColor(...LINEA); this.d.setLineWidth(0.2); this.d.line(this.mx, this.y, this.mx + this.w, this.y); this.y += 2; }

  /** Elenco puntato con rientro; ogni voce è una stringa o { testo, colore, marca }. */
  elenco(voci, { corpo = 9, x = this.mx, dopo = 1.5 } = {}) {
    const h = this.riga(corpo);
    for (const v of voci) {
      const voce = typeof v === 'string' ? { testo: v } : v;
      const righe = this.righe(voce.testo, this.w - (x - this.mx) - 4, 'normal', corpo);
      righe.forEach((r, i) => {
        this.serve(h);
        if (i === 0) { this.font('bold', corpo, voce.colore || MUTO); this.d.text(pulisci(voce.marca || '•'), x, this.y + corpo * PT); }
        this.font('normal', corpo, INK); this.d.text(r, x + 4, this.y + corpo * PT);
        this.y += h;
      });
      this.y += 0.7;
    }
    this.y += dopo;
  }
  /** Coppie etichetta / valore su due colonne. */
  coppie(righe, { colonna = 58, corpo = 9 } = {}) {
    const h = this.riga(corpo);
    for (const [k, v] of righe) {
      if (v == null || v === '') continue;
      const valori = this.righe(v, this.w - colonna, 'normal', corpo);
      const chiavi = this.righe(k, colonna - 3, 'normal', corpo);
      const n = Math.max(valori.length, chiavi.length);
      this.serve(Math.min(n, 3) * h);
      for (let i = 0; i < n; i++) {
        this.serve(h);
        if (chiavi[i]) { this.font('normal', corpo, MUTO); this.d.text(chiavi[i], this.mx, this.y + corpo * PT); }
        if (valori[i]) { this.font('normal', corpo, INK); this.d.text(valori[i], this.mx + colonna, this.y + corpo * PT); }
        this.y += h;
      }
      this.y += 0.6;
    }
    this.y += 1.5;
  }
  /**
   * Tabella con celle che vanno a capo. colonne: [{ t: titolo, w: quota di larghezza, a: 'r' per allineare a destra, peso }].
   * Una riga può essere { celle: [...], colore, peso } per evidenziarla.
   */
  tabella(colonne, righe, { corpo = 8.4 } = {}) {
    const tot = colonne.reduce((a, c) => a + c.w, 0);
    const larghezze = colonne.map((c) => (c.w / tot) * this.w);
    const pad = 1.6, h = this.riga(corpo);
    const intestazione = () => {
      this.d.setFillColor(...FONDO); this.d.rect(this.mx, this.y, this.w, h + 2.2, 'F');
      let x = this.mx;
      colonne.forEach((c, i) => { this.font('bold', 7, MUTO); this.d.text(pulisci(c.t).toUpperCase(), c.a === 'r' ? x + larghezze[i] - pad : x + pad, this.y + 3.6, { align: c.a === 'r' ? 'right' : 'left' }); x += larghezze[i]; });
      this.y += h + 2.2;
    };
    this.serve(h * 3 + 4);
    intestazione();
    for (const riga of righe) {
      const celle = Array.isArray(riga) ? riga : riga.celle;
      const peso = Array.isArray(riga) ? null : riga.peso;
      const testi = celle.map((c, i) => this.righe(c ?? '', larghezze[i] - 2 * pad, peso || colonne[i].peso || 'normal', corpo));
      const alto = Math.max(...testi.map((t) => t.length)) * h + 1.8;
      if (this.serve(alto)) intestazione();
      let x = this.mx;
      testi.forEach((linee, i) => {
        const c = colonne[i];
        this.font(peso || c.peso || 'normal', corpo, (!Array.isArray(riga) && riga.colori?.[i]) || INK);
        linee.forEach((l, k) => this.d.text(l, c.a === 'r' ? x + larghezze[i] - pad : x + pad, this.y + 0.9 + corpo * PT + k * h, { align: c.a === 'r' ? 'right' : 'left' }));
        x += larghezze[i];
      });
      this.y += alto;
      this.d.setDrawColor(...LINEA); this.d.setLineWidth(0.15); this.d.line(this.mx, this.y, this.mx + this.w, this.y);
    }
    this.y += 3.5;
  }
  /** Barra orizzontale con la tacca della soglia. */
  barra(x, y, w, valore, massimo, soglia, colore = ACCENTO) {
    const h = 2.6;
    this.d.setFillColor(...FONDO); this.d.rect(x, y, w, h, 'F');
    const quota = Math.max(0, Math.min(1, (valore || 0) / massimo));
    if (quota > 0) { this.d.setFillColor(...colore); this.d.rect(x, y, w * quota, h, 'F'); }
    if (soglia != null) { this.d.setFillColor(...SEGNALE); this.d.rect(x + (w * soglia) / massimo - 0.35, y - 1, 0.7, h + 2, 'F'); }
  }
  /** Riquadro con un filetto colorato a sinistra: avvisi ed esiti. */
  nota(t, colore = MUTO) {
    const corpo = 9, h = this.riga(corpo);
    const righe = this.righe(t, this.w - 8, 'normal', corpo);
    const alto = righe.length * h + 3;
    this.serve(alto);
    this.d.setFillColor(...colore); this.d.rect(this.mx, this.y, 1, alto, 'F');
    let y = this.y + 1.5;
    this.font('normal', corpo, colore);
    for (const r of righe) { this.d.text(r, this.mx + 4, y + corpo * PT); y += h; }
    this.y += alto + 3;
  }
  /** Intestazione e piè di pagina su tutte le pagine, con il totale delle pagine. */
  chiudi(sinistra, destra) {
    const n = this.d.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      this.d.setPage(i);
      this.d.setDrawColor(...LINEA); this.d.setLineWidth(0.2);
      this.d.line(this.mx, this.A - 12, this.mx + this.w, this.A - 12);
      this.font('normal', 7.5, MUTO);
      this.d.text(pulisci(sinistra), this.mx, this.A - 8);
      this.d.text(`Pagina ${i} di ${n}`, this.mx + this.w, this.A - 8, { align: 'right' });
      if (i > 1) { this.d.text(pulisci(destra), this.mx, 11); this.d.line(this.mx, 13.5, this.mx + this.w, 13.5); }
    }
    return n;
  }
}

/**
 * Crea il report completo. Restituisce { buffer: ArrayBuffer, pagine }.
 * opzioni: { oggi (per i test), compressione (false per ottenere un PDF con il testo in chiaro) }
 */
export function creaReportPdf(JsPDF, bando, p, opzioni = {}) {
  const oggi = opzioni.oggi || new Date();
  const R = raccogliReport(bando, p, oggi);
  const { ris, controlli, categoria, definizioni, piano, invio, statistiche: st, storico, posizione, previsione, reale, contributo, metriche, copertura } = R;
  const P = new Impaginatore(JsPDF, opzioni.compressione !== false);
  const titoloOpera = p.dati.titolo || p.nome;
  const terr = bando.territorio || 'regione';
  const val = p.valutazione;
  const coloreEsito = { ammissibile: OK, a_rischio: SEGNALE, sotto_soglia: MALE, parziale: ACCENTO }[ris.esito] || ACCENTO;
  P.d.setProperties({ title: `Report completo — ${pulisci(titoloOpera)}`, subject: `${pulisci(bando.nomeBreve || bando.nome)} · finestra ${p.anno}`, author: APP.autore, creator: `${APP.nome} ${APP.versione}`, keywords: 'bando cinema, report interno' });

  /* ---------------------------------------------------------------- frontespizio */
  P.font('bold', 8, ACCENTO); P.d.text('CLOCKWISE · REPORT INTERNO COMPLETO', P.mx, P.y, { charSpace: 0.3 });
  P.font('normal', 8, MUTO); P.d.text('RISERVATO', P.mx + P.w, P.y, { align: 'right', charSpace: 0.3 });
  P.y += 7;
  P.testo(titoloOpera, { corpo: 22, peso: 'bold', dopo: 1 });
  if (p.nome && p.nome !== titoloOpera) P.testo(`Dossier «${p.nome}»`, { corpo: 10, colore: MUTO, dopo: 0.5 });
  P.testo(`${bando.nome} · ${categoria.nome} · finestra ${p.anno}`, { corpo: 10, colore: MUTO, dopo: 0.5 });
  P.testo(`Generato il ${dataOra(oggi)}`, { corpo: 9, colore: MUTO, dopo: 5 });

  // esito
  const alto = 34;
  P.d.setFillColor(...FONDO); P.d.roundedRect(P.mx, P.y, P.w, alto, 2, 2, 'F');
  P.d.setFillColor(...coloreEsito); P.d.rect(P.mx, P.y, 2, alto, 'F');
  P.font('bold', 34, INK); P.d.text(num(ris.totale), P.mx + 8, P.y + 15.5);
  const lt = P.d.getTextWidth(num(ris.totale));
  P.font('normal', 10, MUTO); P.d.text(`/ ${ris.massimo}${ris.completo ? '' : '  parziale'}`, P.mx + 10 + lt, P.y + 15.5);
  P.font('normal', 8.5, MUTO); P.d.text(pulisci(`Soglia complessiva ${ris.sogliaTotale}${ris.max > ris.min + 0.05 ? ` · forbice dei commissari ${num(ris.min)} – ${num(ris.max)}` : ''}`), P.mx + 8, P.y + 22.5);
  P.barra(P.mx + 8, P.y + 26.5, 76, ris.totale, ris.massimo, ris.sogliaTotale, coloreEsito);
  P.font('bold', 12.5, coloreEsito); P.d.text(pulisci(TITOLI_ESITO[ris.esito]), P.mx + 96, P.y + 9.5);
  const spiega = ris.esito === 'parziale' ? `Assegnati finora ${num(ris.totale)} punti; ${num(ris.sezioni.reduce((a, s) => a + s.daValutare, 0))} restano da valutare con la lettura dei documenti.`
    : ris.esito === 'ammissibile' ? `Ogni sezione supera il minimo. Anche nella lettura più severa (${num(ris.min)}) il dossier resta ammissibile.`
      : ris.esito === 'a_rischio' ? `La media supera le soglie, ma nella lettura più severa (${num(ris.min)}) il totale o una sezione scendono sotto il minimo.`
        : ris.motivi.join(' ');
  P.font('normal', 8.8, INK);
  P.d.text(P.d.splitTextToSize(pulisci(spiega), P.w - 102).slice(0, 5), P.mx + 96, P.y + 15);
  P.y += alto + 6;

  // sezioni
  P.tabella(
    [{ t: 'Sezione', w: 46 }, { t: 'Punti', w: 12, a: 'r', peso: 'bold' }, { t: 'Massimo', w: 12, a: 'r' }, { t: 'Minimo', w: 12, a: 'r' }, { t: 'Esito', w: 30 }],
    ris.sezioni.map((s) => {
      const esito = !s.completo ? (s.raggiungibile ? 'Da completare' : 'Minimo irraggiungibile') : s.superata ? 'Minimo superato' : 'Sotto il minimo';
      return { celle: [`${s.id} · ${s.nome}`, num(s.punti), num(s.massimo), s.soglia == null ? '—' : num(s.soglia), esito], colori: [null, null, null, null, !s.completo ? (s.raggiungibile ? MUTO : MALE) : s.superata ? OK : MALE] };
    }));

  // stato dell'invio
  const semaforo = { rosso: ['Non inviare', MALE], giallo: ['Da completare', AVVISO], verde: ['Pronto per l’invio', OK] }[invio.semaforo];
  P.sotto('Stato dell’invio', invio.finestra ? `Finestra ${invio.finestra.anno}: ${giorno(invio.finestra.dal)} – ${giorno(invio.finestra.al)}` : '');
  P.testo(`${semaforo[0]}: ${invio.critici} ${invio.critici === 1 ? 'problema bloccante' : 'problemi bloccanti'}, ${invio.attenzioni} da sistemare, ${invio.daConfermare} ${invio.daConfermare === 1 ? 'requisito' : 'requisiti'} da confermare a mano.${invio.prossimo ? ` Prossimo passo: ${invio.prossimo.testo.toLowerCase()}.` : ''}`, { colore: semaforo[1], peso: 'bold', corpo: 9.5 });
  P.tabella([{ t: 'Passo', w: 22, peso: 'bold' }, { t: 'Stato', w: 18 }, { t: 'Dettaglio', w: 72 }],
    invio.passi.map((x) => ({ celle: [x.titolo, x.stato === 'fatto' ? 'Fatto' : x.stato === 'attenzione' ? 'Da completare' : 'Da fare', x.dettaglio], colori: [null, x.stato === 'fatto' ? OK : x.stato === 'attenzione' ? AVVISO : MUTO, null] })));

  /* ---------------------------------------------------------------- 1. interventi */
  P.titolo('1. Che cosa sistemare prima dell’invio');
  if (!piano.blocchi.length && !piano.punti.length && !ris.bloccanti.length) P.testo('Nessun intervento individuato.', { colore: MUTO });
  if (ris.bloccanti.length || piano.blocchi.length) {
    P.etichetta('Problemi bloccanti');
    P.elenco([...ris.bloccanti.map((b) => ({ testo: b, colore: MALE, marca: '!' })), ...piano.blocchi.map((v) => ({ testo: `${v.testo} (${v.dove})`, colore: MALE, marca: '!' }))]);
  }
  if (piano.punti.length) {
    P.etichetta('Interventi in ordine di punti recuperabili');
    P.tabella([{ t: 'Intervento', w: 70 }, { t: 'Punti', w: 10, a: 'r', peso: 'bold' }, { t: 'Criterio e fonte', w: 32 }],
      piano.punti.map((v) => ({ celle: [v.testo, `+${num(v.punti)}`, v.dove], colori: [null, OK, MUTO] })));
    P.testo('I punti indicati sono stime per singolo intervento e non si sommano automaticamente.', { corpo: 8, colore: MUTO });
  }

  /* ---------------------------------------------------------------- 2. criteri */
  P.titolo('2. Punteggio criterio per criterio');
  for (const sez of ris.sezioni) {
    P.sotto(`Sezione ${sez.id} — ${sez.nome}`, `${num(sez.punti)} / ${num(sez.massimo)}${sez.soglia != null ? ` · minimo ${num(sez.soglia)}` : ''}`);
    P.barra(P.mx, P.y, P.w, sez.punti, sez.massimo, sez.soglia, !sez.completo ? MUTO : sez.superata ? OK : MALE);
    P.y += 6;
    for (const g of (val?.giudizi?.[sez.id] || []).filter((x) => x.sintesi)) {
      P.testo(`${g.commissario.nome} — giudizio di sintesi`, { corpo: 8.5, peso: 'bold', colore: MUTO, dopo: 0.4 });
      P.testo(g.sintesi, { corpo: 9, dopo: 2.2 });
    }
    for (const c of sez.criteri) {
      const def = definizioni[c.id] || {};
      P.serve(16);
      P.d.setFillColor(...FONDO); P.d.rect(P.mx, P.y, P.w, 6.6, 'F');
      P.font('bold', 9.5, INK); P.d.text(pulisci(`${c.id}  ${c.nome}`).slice(0, 96), P.mx + 2, P.y + 4.5);
      P.font('bold', 9.5, INK); P.d.text(`${c.punti == null ? '—' : num(c.punti)} / ${num(c.massimo)}`, P.mx + P.w - 2, P.y + 4.5, { align: 'right' });
      P.y += 8.6;
      if (def.descrizione) P.testo(def.descrizione, { corpo: 8.5, colore: MUTO });
      if (c.min != null && c.max != null && c.max - c.min >= 0.1) P.testo(`Forbice tra i commissari: ${num(c.min)} – ${num(c.max)}.`, { corpo: 8.5, colore: MUTO });
      if (c.fonte === 'calcolo' || c.fonte === 'dichiarato') {
        P.testo(c.mancante ? 'Dato mancante: i Dati chiave non sono compilati per questo criterio.'
          : `Valore ${c.valoreTesto}${c.dettaglio ? ` (${c.dettaglio})` : ''}: fascia «${c.fascia}». Calcolo: ${c.formula}.${c.fonte === 'dichiarato' ? ' Punteggio provvisorio dai dati dichiarati.' : ''}`, { corpo: 9 });
      }
      if (c.fonte === 'non_valutato') P.testo('Non ancora valutato: serve la lettura dei documenti (scheda Valutazione).', { corpo: 9, colore: AVVISO });
      for (const a of c.avvisi || []) P.testo(a, { corpo: 8.8, colore: AVVISO });
      if (def.principio) P.testo(`Come attribuisce i punti la Commissione: ${def.principio}`, { corpo: 8.5, colore: MUTO });
      for (const g of c.giudizi) {
        P.serve(10);
        P.testo(`${g.commissario} — ${def.tipo === 'fasce' ? `${num(g.valore)}% -> ${num(g.punti)} punti` : `${num(g.punti)} punti`}`, { corpo: 9, peso: 'bold', dopo: 0.5 });
        P.testo(g.motivazione, { corpo: 9, x: P.mx + 3, dopo: 1 });
        if (g.evidenze?.length) { P.testo('Evidenze nei documenti', { corpo: 7.5, peso: 'bold', colore: MUTO, x: P.mx + 3, dopo: 0.3 }); P.elenco(g.evidenze, { corpo: 8.6, x: P.mx + 3, dopo: 0.6 }); }
        if (g.criticita?.length) { P.testo('Criticità', { corpo: 7.5, peso: 'bold', colore: MUTO, x: P.mx + 3, dopo: 0.3 }); P.elenco(g.criticita.map((t) => ({ testo: t, colore: AVVISO })), { corpo: 8.6, x: P.mx + 3, dopo: 0.6 }); }
        if (g.miglioramenti?.length) { P.testo('Come migliorare', { corpo: 7.5, peso: 'bold', colore: MUTO, x: P.mx + 3, dopo: 0.3 }); P.elenco(g.miglioramenti.map((m) => ({ testo: `${m.azione}${m.punti ? ` (+${num(m.punti)})` : ''}`, colore: OK })), { corpo: 8.6, x: P.mx + 3, dopo: 0.6 }); }
      }
      P.spazio(1.5);
    }
  }

  /* ---------------------------------------------------------------- 3. ammissibilità */
  P.titolo('3. Ammissibilità, allegati e coerenza');
  const ordine = ['critico', 'attenzione', 'da_verificare', 'ok'];
  const conta = (e) => controlli.filter((c) => c.esito === e).length;
  P.testo(`${conta('critico')} bloccanti · ${conta('attenzione')} da sistemare · ${conta('da_verificare')} da confermare · ${conta('ok')} a posto.`, { colore: MUTO });
  P.tabella([{ t: 'Esito', w: 17, peso: 'bold' }, { t: 'Controllo', w: 36, peso: 'bold' }, { t: 'Dettaglio', w: 60 }],
    [...controlli].sort((a, b) => ordine.indexOf(a.esito) - ordine.indexOf(b.esito)).map((c) => ({ celle: [NOME_ESITO[c.esito] || c.esito, c.titolo, c.dettaglio], colori: [COLORE_ESITO[c.esito], null, null] })));
  if (val?.verifica) {
    P.sotto('Verifica formale di Claude sui moduli');
    if (val.verifica.sintesi) P.testo(val.verifica.sintesi);
    if (val.verifica.controlli?.length) P.tabella([{ t: 'Esito', w: 17, peso: 'bold' }, { t: 'Controllo', w: 32, peso: 'bold' }, { t: 'Dettaglio e azione', w: 64 }],
      val.verifica.controlli.map((c) => ({ celle: [NOME_ESITO[c.esito] || c.esito, c.titolo, [c.dettaglio, c.azione ? `Da fare: ${c.azione}` : ''].filter(Boolean).join('\n')], colori: [COLORE_ESITO[c.esito], null, null] })));
  }
  if (invio.file.length) {
    P.sotto('File da allegare all’invio');
    P.tabella([{ t: 'Allegato', w: 52 }, { t: 'File nel dossier', w: 60 }],
      invio.file.map((f) => ({ celle: [f.nome, f.file.length ? f.file.map((x) => x.nome).join('\n') : 'Non caricato'], colori: [null, f.file.length ? null : (f.obbligo === 'punteggio' || f.obbligo === 'consigliato' ? AVVISO : MALE)] })));
    if (invio.invio?.indirizzo) P.coppie([['Invio', `${invio.invio.canale || ''} a ${invio.invio.indirizzo}`], ['Oggetto', invio.invio.oggetto]]);
  }

  /* ---------------------------------------------------------------- 4. graduatoria */
  if (st) {
    P.titolo(`4. Confronto con la graduatoria reale ${st.anno}`);
    P.testo(`Nella finestra ${st.anno} la Commissione ha valutato ${st.valutati} progetti di questa categoria: ${st.ammissibili} hanno superato tutte le soglie e ${st.finanziati} sono stati finanziati. Primo in graduatoria ${num(st.primo)}, ultimo finanziato ${num(st.ultimoFinanziato)}.`);
    if (posizione) P.nota(`Con ${num(ris.totale)} punti il dossier sarebbe ${posizione.posizione}° su ${posizione.su} ammissibili: ${posizione.finanziabile ? `sopra l’ultimo finanziato (${num(posizione.ultimoFinanziato)}).` : `sotto l’ultimo finanziato (${num(posizione.ultimoFinanziato)}), quindi ammissibile ma senza contributo a parità di concorrenza.`}`, posizione.finanziabile ? OK : AVVISO);
    P.tabella([{ t: 'Sezione', w: 40 }, { t: 'Stima', w: 14, a: 'r', peso: 'bold' }, { t: `Mediana ${st.anno}`, w: 16, a: 'r' }, { t: 'Metà dei progetti', w: 22, a: 'r' }, { t: 'Minimo – massimo', w: 22, a: 'r' }],
      ris.sezioni.filter((s) => st.sezioni[s.id]).map((s) => { const d = st.sezioni[s.id]; return [`${s.id} · ${s.nome}`, `${num(s.punti)}${s.completo ? '' : ' parz.'}`, num(d.mediana), `${num(d.q1)} – ${num(d.q3)}`, `${num(d.min)} – ${num(d.max)}`]; }));
    if (storico.length) P.testo(`Soglia di finanziamento negli anni: ${storico.map((x) => `${x.anno}, ultimo finanziato ${num(x.ultimoFinanziato)} e primo ${num(x.primo)} (${x.finanziati} progetti)`).join('; ')}.`, { corpo: 8.8, colore: MUTO });
    if (previsione && !previsione.completa) {
      P.sotto('Previsione statistica per le sezioni non ancora valutate');
      P.testo(`Le sezioni ${previsione.sezioniStimate.join(', ')} sono completate con i punteggi reali dei ${previsione.valutati} progetti del ${previsione.anno}.`, { corpo: 9, colore: MUTO });
      P.tabella([{ t: 'Scenario', w: 30, peso: 'bold' }, { t: 'Totale', w: 14, a: 'r', peso: 'bold' }, { t: 'Esito', w: 50 }],
        [['Prudente (primo quartile)', previsione.scenari.basso], ['Atteso (mediana)', previsione.scenari.atteso], ['Favorevole (terzo quartile)', previsione.scenari.alto]].map(([n, s]) => ({ celle: [n, num(s.totale), s.ammissibile ? 'Ammissibile' : s.sotto.length ? `Sotto il minimo nelle sezioni ${s.sotto.join(', ')}` : `Sotto ${previsione.sogliaTotale}`], colori: [null, null, s.ammissibile ? OK : MALE] })));
      P.testo(`Completando il dossier con i punteggi di ciascun progetto reale: ammissibile in ${previsione.empirica.ammissibili} casi su ${previsione.empirica.casi}${previsione.empirica.finanziabili != null ? `, sopra l’ultimo finanziato in ${previsione.empirica.finanziabili}` : ''}.`, { corpo: 9 });
    }
    P.testo(`Fonte: ${st.fonte}.`, { corpo: 8, colore: MUTO });
  }

  /* ---------------------------------------------------------------- 5. prova con il punteggio reale */
  if (reale.presenti) {
    P.titolo('5. Prova con il punteggio reale della Commissione');
    const segno = (v) => (v == null ? '—' : v > 0 ? `+${num(v)}` : num(v));
    P.tabella([{ t: 'Sezione', w: 46 }, { t: 'Stima', w: 16, a: 'r' }, { t: 'Punteggio reale', w: 20, a: 'r', peso: 'bold' }, { t: 'Scarto', w: 16, a: 'r' }],
      [...reale.righe.map((x) => [`${x.id} · ${x.nome}`, `${num(x.stima)}${x.completa ? '' : ' parz.'}`, x.reale == null ? '—' : num(x.reale), segno(x.scarto)]),
        { celle: ['Totale', num(ris.totale), reale.totaleReale == null ? '—' : num(reale.totaleReale), segno(reale.scartoTotale)], peso: 'bold' }]);
    if (reale.scartoMedio != null) P.nota(`Scarto medio per sezione: ${num(reale.scartoMedio)} punti. ${reale.scartoMedio <= 1.5 ? 'La stima è allineata al giudizio reale.' : reale.scartoMedio <= 3 ? 'La stima è vicina al giudizio reale.' : 'La stima si discosta dal giudizio reale: il caso va usato per la taratura.'} Scarto positivo: stima più generosa della Commissione; negativo: più severa.`, reale.scartoMedio <= 1.5 ? OK : reale.scartoMedio <= 3 ? ACCENTO : AVVISO);
  }

  /* ---------------------------------------------------------------- 6. contributo */
  P.titolo('6. Stima del contributo');
  if (contributo.richiesto == null) P.testo('Contributo richiesto non indicato nei Dati chiave.', { colore: MUTO });
  else {
    P.coppie([
      ['Contributo richiesto', euro(contributo.richiesto)],
      ['Punteggio ipotizzato del primo', num(contributo.primo)],
      ['Contributo stimato', `${euro(contributo.stima)}  (${num(ris.totale)} / ${num(Math.max(ris.totale, contributo.primo))} x richiesto)`],
      ['Massimo concedibile', categoria.contributo ? `${categoria.contributo.percentuale}% del costo di produzione${categoria.contributo.massimali?.[p.anno] ? `, tetto ${euro(categoria.contributo.massimali[p.anno])}` : ''}` : null],
    ]);
    P.testo('Il primo in graduatoria riceve il 100% del richiesto, gli altri una quota pari al rapporto tra il proprio punteggio e quello del primo. Vale solo se il dossier supera le soglie e la dotazione non è esaurita.', { corpo: 8.5, colore: MUTO });
  }

  /* ---------------------------------------------------------------- 7. dati interni */
  P.titolo('7. Dati del dossier');
  const d = p.dati, g = d.giorni || {}, pr = d.professionisti || {}, e = d.economici || {};
  P.sotto('Opera');
  P.coppie([['Titolo', d.titolo], ['Tipologia', d.tipologiaOpera], ['Durata', d.durataMin != null ? `${num(d.durataMin)} minuti` : null], ['Animazione', d.animazione ? 'Sì' : 'No'],
    ['Proponente (Modulo III)', p.modulo3?.proponente], ['Regia (Modulo III)', p.modulo3?.regia], ['Riprese (Modulo III)', p.modulo3?.dataInizioRiprese ? `dal ${p.modulo3.dataInizioRiprese}${p.modulo3.dataFineRiprese ? ` al ${p.modulo3.dataFineRiprese}` : ''}` : null],
    ['Origine dei dati', p.origineDati?.tipo === 'modulo3' ? `Modulo III «${p.origineDati.file}»` : p.origineDati?.tipo === 'claude' ? 'Compilati da Claude dai documenti' : 'Inseriti a mano']]);
  if (p.origineDati?.avvisi?.length) { P.etichetta('Avvisi sui dati di origine'); P.elenco(p.origineDati.avvisi.map((t) => ({ testo: t, colore: AVVISO })), { corpo: 8.6 }); }
  P.sotto('Giorni di lavorazione e professionisti');
  P.tabella([{ t: 'Voce', w: 50 }, { t: 'Totale', w: 16, a: 'r' }, { t: `In ${terr}`, w: 16, a: 'r' }, { t: 'Quota', w: 16, a: 'r', peso: 'bold' }],
    [['Pre-produzione (giorni)', g.prepTot, g.prepSicilia], ['Riprese (giorni)', g.ripreseTot, g.ripreseSicilia], ['Post-produzione (giorni)', g.postTot, g.postSicilia], ['Componente artistica (persone)', pr.artTot, pr.artSicilia], ['Cast tecnico (persone)', pr.crewTot, pr.crewSicilia]]
      .map(([n, tot, sic]) => [n, tot == null ? '—' : num(tot, 0), sic == null ? '—' : num(sic, 0), tot ? pct(((sic || 0) / tot) * 100) : '—']));
  P.sotto('Indicatori calcolati');
  const NOMI_METRICA = { lavorazioneSicilia: `Lavorazione in ${terr}`, postSicilia: `Post-produzione in ${terr}`, artisticiSiciliani: 'Artistici del territorio', tecniciSiciliani: 'Tecnici del territorio', professionistiSiciliani: 'Professionisti del territorio', spesaSicilia: 'Spesa sul territorio / contributo', copertura: 'Copertura documentata' };
  P.tabella([{ t: 'Indicatore', w: 36, peso: 'bold' }, { t: 'Valore', w: 14, a: 'r', peso: 'bold' }, { t: 'Lettura alternativa', w: 16, a: 'r' }, { t: 'Come si calcola', w: 48 }],
    Object.entries(metriche).filter(([, m]) => m && typeof m === 'object' && 'valore' in m).map(([k, m]) => [NOMI_METRICA[k] || k, pct(m.valore), m.alternativa != null ? pct(m.alternativa) : '—', [m.formula, m.dettaglio].filter(Boolean).join(' — ')]));
  P.sotto('Budget e contributo');
  P.coppie([['Costo di produzione', euro(e.costoProduzione)], ['Costo ammissibile', euro(e.costoAmmissibile)], ['Contributo richiesto', euro(e.contributoRichiesto)],
    [`Spesa ammissibile in ${terr}`, e.spesaSicilia != null ? `${euro(e.spesaSicilia)}${e.contributoRichiesto ? `  (${pct((e.spesaSicilia / e.contributoRichiesto) * 100)} del contributo)` : ''}` : null],
    ['Producer fee', e.producerFee != null ? `${euro(e.producerFee)}${e.costoProduzione ? `  (${pct((e.producerFee / e.costoProduzione) * 100)} del costo)` : ''}` : null],
    ['Riprese già iniziate', d.ripreseIniziate ? 'Sì' : 'No']]);
  P.sotto('Piano finanziario');
  if (d.piano?.length) {
    P.tabella([{ t: 'Voce', w: 10 }, { t: 'Fonte', w: 56 }, { t: 'Importo', w: 20, a: 'r', peso: 'bold' }, { t: 'Documento nel dossier', w: 26 }],
      [...d.piano.map((r) => ({ celle: [r.voce || '', [r.etichetta, r.denominazione].filter(Boolean).join(' — '), euro(r.importo), r.voce === '1.1' ? 'contributo richiesto' : (ETICHETTE_DOC[r.documento] || 'Nessuno')], colori: [MUTO, null, null, r.voce !== '1.1' && (!r.documento || r.documento === 'nessuno') ? AVVISO : null] })),
        { celle: ['', 'Totale del piano', euro(copertura.totalePiano), ''], peso: 'bold' }]);
    P.coppie([['Documentato', `${euro(copertura.documentato)}${copertura.sulCosto != null ? `  (${pct(copertura.sulCosto)} del costo${copertura.sulFabbisogno != null ? `, ${pct(copertura.sulFabbisogno)} del fabbisogno senza il contributo` : ''})` : ''}`], ['Senza documento', euro(copertura.nonDocumentato)]]);
  } else P.testo('Nessuna fonte inserita.', { colore: MUTO });
  if ((bando.requisiti || []).length) {
    P.sotto('Requisiti da confermare a mano');
    P.elenco(bando.requisiti.map((r) => ({ testo: r.testo, marca: d.requisiti?.[r.id] ? 'sì' : 'no', colore: d.requisiti?.[r.id] ? OK : AVVISO })), { corpo: 8.8 });
  }
  const accordi = Object.entries(p.modulo3?.accordi || {});
  if (accordi.length) {
    P.sotto('Accordi dichiarati nel Modulo III');
    const NOMI = { coproduzioneItalia: 'Coproduzione con società italiane (N.1)', coproduzioneEstero: 'Coproduzione internazionale (N.2)', distribuzione: 'Distribuzione (N.3)', produttoreEsecutivo: 'Produttore esecutivo (N.4)', finanziatoriEsterni: 'Finanziatori esterni (N.5)' };
    P.coppie(accordi.map(([k, a]) => [NOMI[k] || k, a.presente ? `Sì${a.ragioneSociale ? ` — ${a.ragioneSociale}` : ''}` : 'No']));
  }

  /* ---------------------------------------------------------------- 8. documenti */
  P.titolo('8. Documenti caricati');
  if (p.documenti?.length) P.tabella([{ t: 'File', w: 50, peso: 'bold' }, { t: 'Tipo', w: 34 }, { t: 'Contenuto letto', w: 18, a: 'r' }, { t: 'Avvisi', w: 30 }],
    p.documenti.map((x) => ({ celle: [x.nome, tipoPerId(x.tipo).nome, x.tipo === 'identita' ? 'non letto' : x.testo ? `${x.pagine ? `${x.pagine} pag. · ` : ''}${num(x.testo.length / 1000, 0)}k car.` : 'nessun testo', (x.avvisi || []).join(' ')], colori: [null, MUTO, MUTO, AVVISO] })));
  else P.testo('Nessun documento caricato.', { colore: MUTO });

  /* ---------------------------------------------------------------- 9. valutazione */
  P.titolo('9. Come è stata fatta la valutazione');
  if (val) {
    P.coppie([['Data', dataOra(val.data)], ['Collegamento', val.collegamento], ['Modello', (val.modelliUsati?.length ? val.modelliUsati : [val.modello]).filter(Boolean).join(', ')],
      ['Commissari simulati', (val.commissari || []).map((c) => c.nome).join(', ')],
      ['Testo letto e scritto', val.uso?.ingresso ? `${num((val.uso.ingresso + (val.uso.cacheLetta || 0) + (val.uso.cacheScritta || 0)) / 1000, 0)}k token letti, ${num(val.uso.uscita / 1000, 0)}k scritti` : null],
      ['Letture non riuscite', val.errori?.length ? val.errori.map((x) => x.etichetta).join(', ') : 'Nessuna'], ['Note', (val.note || []).join(' ')]]);
  } else P.testo('La commissione simulata non ha ancora letto i documenti: i punti riportati derivano solo dai numeri del dossier.', { colore: AVVISO });
  P.testo(`Griglia applicata: ${bando.fonte || bando.nome}. ${bando.commissione?.descrizione || ''}`, { corpo: 8.8, colore: MUTO });

  /* ---------------------------------------------------------------- appendici */
  const sp = p.produzione?.spoglio;
  const righePrev = p.preventivo?.righe || [];
  if (sp || righePrev.length) {
    P.titolo('Appendice A — Produzione');
    if (sp) {
      const lav = pianoLavorazione(sp, { ottaviGiorno: p.produzione.ottaviGiorno || 32 });
      P.sotto('Spoglio e piano di lavorazione');
      P.coppie([['Scene', String(sp.scene.length)], ['Pagine', inPagine(sp.scene.reduce((a, s) => a + s.ottavi, 0))], ['Personaggi', sp.personaggi.slice(0, 14).map((x) => `${x.nome} (${x.scene.length})`).join(', ')],
        ['Set', String(sp.location.length)], ['Giorni di riprese dal piano', `${lav.totale}, di cui ${lav.inSicilia} in ${terr}${lav.daDefinire ? ` e ${lav.daDefinire} da definire` : ''}`]]);
      P.tabella([{ t: 'Giorno', w: 10, a: 'r' }, { t: 'Turno', w: 12 }, { t: 'Set', w: 52 }, { t: 'Scene', w: 26 }, { t: 'Pagine', w: 12, a: 'r' }],
        lav.giorni.slice(0, 80).map((x) => [String(x.n), x.turno === 'NOTTE' ? 'Notte' : 'Giorno', x.set.join(' / '), x.scene.join(', '), inPagine(x.ottavi)]));
      const rischi = sp.scene.filter((s) => s.rischi.length);
      if (rischi.length) { P.etichetta('Scene che richiedono preparazione'); P.elenco(rischi.slice(0, 40).map((s) => `Scena ${s.numero} · ${s.ambiente}: ${s.rischi.join('; ')}`), { corpo: 8.6 }); }
    }
    if (righePrev.length) {
      const t = totaliPreventivo(righePrev);
      P.sotto('Preventivo per voce del Modulo III');
      P.tabella([{ t: 'Voce', w: 60 }, { t: 'Importo', w: 22, a: 'r', peso: 'bold' }, { t: `Di cui in ${terr}`, w: 22, a: 'r' }],
        [...t.gruppi.filter((x) => x.importo).map((x) => [`A.${x.id} ${x.nome}`, euro(x.importo), x.nonAmmissibile ? '—' : euro(x.sicilia)]),
          { celle: ['Costo di produzione', euro(t.costoProduzione), ''], peso: 'bold' }, { celle: ['Costo ammissibile', euro(t.costoAmmissibile), euro(t.spesaSicilia)], peso: 'bold' }]);
      for (const a of t.avvisi) P.testo(a, { corpo: 8.8, colore: AVVISO });
    }
  }
  const leg = p.legale;
  if (leg?.contratti || leg?.fascicolo) {
    P.titolo('Appendice B — Legale');
    if (leg.contratti) {
      P.sotto('Analisi dei contratti e degli accordi', dataOra(leg.contratti.data));
      if (leg.contratti.sintesi) P.testo(leg.contratti.sintesi);
      const IDONEO = { si: ['Regge così com’è', OK], parziale: ['Da sistemare', AVVISO], no: ['Non produce effetto', MALE] };
      for (const c of leg.contratti.documenti) {
        const [nome, colore] = IDONEO[c.idoneo] || IDONEO.parziale;
        P.serve(12);
        P.testo(`${c.file} — ${nome}`, { corpo: 9.3, peso: 'bold', colore, dopo: 0.5 });
        P.testo([c.natura, c.firmato === 'si' ? 'firmato' : c.firmato === 'no' ? 'non firmato' : 'firma non verificabile', c.criteri?.length ? `criteri ${c.criteri.join(', ')}` : '', c.importo, c.data].filter(Boolean).join(' · '), { corpo: 8.5, colore: MUTO, dopo: 0.8 });
        P.testo(c.motivazione, { corpo: 9 });
        if (c.rischi?.length) P.elenco(c.rischi.map((t) => ({ testo: t, colore: AVVISO, marca: '!' })), { corpo: 8.6, dopo: 0.5 });
        if (c.correzioni?.length) P.elenco(c.correzioni.map((t) => ({ testo: `Da correggere: ${t}`, colore: OK })), { corpo: 8.6 });
      }
    }
    if (leg.fascicolo) {
      const f = leg.fascicolo;
      P.sotto('Fascicolo del progetto', dataOra(f.data));
      if (f.sintesi) P.testo(f.sintesi);
      if (f.incongruenze?.length) { P.etichetta('Incongruenze tra i documenti'); P.elenco(f.incongruenze.map((t) => ({ testo: t, colore: AVVISO, marca: '!' })), { corpo: 8.8 }); }
      if (f.parti?.length) P.tabella([{ t: 'Soggetto', w: 36, peso: 'bold' }, { t: 'Ruolo', w: 30 }, { t: 'Compare in', w: 46 }], f.parti.map((x) => [x.nome, x.ruolo, x.documenti.join(', ')]));
      if (f.impegni?.length) P.tabella([{ t: 'Chi', w: 24, peso: 'bold' }, { t: 'Che cosa', w: 44 }, { t: 'Importo', w: 16 }, { t: 'Entro', w: 14 }, { t: 'Fonte', w: 22 }], f.impegni.map((x) => [x.soggetto, x.impegno, x.importo || '—', x.scadenza || '—', x.fonte]));
      if (f.date?.length) P.tabella([{ t: 'Data', w: 20 }, { t: 'Evento', w: 60 }, { t: 'Fonte', w: 32 }], f.date.map((x) => [x.data || '—', x.evento, x.fonte]));
    }
  }

  P.spazio(4);
  P.filo();
  P.testo('Stima prodotta applicando la griglia del bando con l’aiuto di un modello di intelligenza artificiale. Serve a trovare i punti deboli prima dell’invio: non anticipa né vincola il giudizio della Commissione e non sostituisce il parere di un professionista. Documento a uso interno: contiene dati riservati del progetto.', { corpo: 8, colore: MUTO });

  const pagine = P.chiudi(`${APP.nome} ${APP.versione} · Report interno riservato · creato da ${APP.autore}`, `${titoloOpera} — ${bando.nomeBreve || bando.nome}, finestra ${p.anno}`);
  return { buffer: P.d.output('arraybuffer'), pagine };
}
