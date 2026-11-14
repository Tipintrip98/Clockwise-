// Stato dell'invio: finestra, formato dei file, coerenza tra Modulo III e allegati, problemi in ordine
// di gravità e prossimo passo. Tutto calcolato: non serve Claude.
import { verificheAmmissibilita } from './scoring.js';

const GIORNO = 86400000;
const estensione = (n) => (/\.([a-z0-9]+)$/i.exec(n || '')?.[1] || '').toLowerCase();
const semplice = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Finestra di presentazione dell'anno scelto rispetto a oggi: futura, aperta o chiusa, con i giorni mancanti. */
export function finestraInvio(bando, anno, oggi = new Date()) {
  const f = (bando.finestre || []).find((x) => x.anno === Number(anno));
  if (!f) return null;
  const t = Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  const dal = Date.parse(`${f.dal}T00:00:00Z`), al = Date.parse(`${f.al}T00:00:00Z`);
  if (t < dal) return { ...f, stato: 'futura', giorni: Math.round((dal - t) / GIORNO) };
  if (t <= al) return { ...f, stato: 'aperta', giorni: Math.round((al - t) / GIORNO) };
  return { ...f, stato: 'chiusa', giorni: Math.round((t - al) / GIORNO) };
}

/** Formato e numero dei file rispetto a ciò che l'avviso prescrive per ciascun allegato. */
export function controlliFormato(bando, documenti) {
  const out = [];
  for (const a of bando.allegati || []) {
    const suoi = documenti.filter((d) => d.tipo === a.tipo);
    if (!suoi.length) continue;
    if (a.unico && suoi.length > 1) out.push({ id: `fmt_unico_${a.tipo}`, esito: 'attenzione', titolo: a.nome, dettaglio: `Sono caricati ${suoi.length} file di questo tipo (${suoi.map((d) => `«${d.nome}»`).join(', ')}): l’avviso chiede un unico file. Se uno è di un altro tipo, correggilo nella tabella dei documenti.` });
    for (const d of suoi) {
      const est = estensione(d.nome);
      if (a.formati && est && !a.formati.includes(est)) {
        const vicino = a.formati.includes('xls') && est === 'xlsx';
        out.push({ id: `fmt_${d.id || d.nome}`, esito: 'attenzione', titolo: `Formato di «${d.nome}»`, dettaglio: `Il file è .${est}; per “${a.nome}” l’avviso prescrive ${a.formati.map((f) => `.${f}`).join(' o ')}${vicino ? ': prima dell’invio salvalo da Excel come “Cartella di lavoro di Excel 97-2003 (.xls)”' : ''}. Un formato diverso è una difformità dalle modalità di presentazione (art. 8.1 lett. b).` });
      }
    }
  }
  for (const d of documenti) {
    if (d.tipo === 'identita') continue;
    for (const avviso of d.avvisi || []) if (/senza testo|non è leggibile|non leggibile|Impossibile leggere/i.test(avviso)) out.push({ id: `fmt_let_${d.id || d.nome}`, esito: 'attenzione', titolo: `«${d.nome}» non è leggibile`, dettaglio: avviso });
  }
  return out;
}

const ACCORDI = [
  ['coproduzioneItalia', 'coproduzione', 'una coproduzione con società italiane (campo N.1)'],
  ['coproduzioneEstero', 'coproduzione', 'una coproduzione internazionale (campo N.2)'],
  ['distribuzione', 'distribuzione', 'accordi di distribuzione (campo N.3)'],
  ['produttoreEsecutivo', 'produttore_esecutivo', 'un produttore esecutivo (campo N.4)'],
  ['finanziatoriEsterni', 'finanziatori_esterni', 'finanziatori esterni (campo N.5)'],
];
const dataIt = (s) => { const m = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/.exec(String(s || '')); return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null; };
const giornoMese = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Confronta ciò che il Modulo III dichiara (progetto.modulo3) con i documenti caricati:
 * accordi dichiarati senza carte, carte senza dichiarazione, nominativi senza accordo, date incoerenti.
 */
export function controlliIncrociati(bando, progetto) {
  const m3 = progetto.modulo3;
  if (!m3) return [];
  const out = [];
  const docs = progetto.documenti || [];
  const ha = (tipo) => docs.some((d) => d.tipo === tipo);
  const perTipo = {};
  for (const [chiave, tipo, etichetta] of ACCORDI) {
    const a = m3.accordi?.[chiave];
    if (!a) continue;
    perTipo[tipo] = perTipo[tipo] || { dichiarato: false };
    if (a.presente) {
      perTipo[tipo].dichiarato = true;
      if (!ha(tipo)) out.push({ id: `m3_${chiave}`, esito: 'critico', titolo: 'Accordo dichiarato ma non allegato', dettaglio: `Il Modulo III dichiara ${etichetta}${a.ragioneSociale ? ` con ${a.ragioneSociale}` : ''}, ma nel dossier non c’è il deal memo o il contratto (e, dove richiesto, il curriculum). L’art. 8.2 li chiede insieme all’istanza.` });
    }
  }
  for (const [tipo, st] of Object.entries(perTipo)) {
    if (!st.dichiarato && ha(tipo)) out.push({ id: `m3_nd_${tipo}`, esito: 'attenzione', titolo: 'Documento allegato ma non dichiarato nel Modulo III', dettaglio: `Nel dossier c’è un documento di tipo “${(bando.allegati || []).find((x) => x.tipo === tipo)?.nome || tipo}”, ma il Modulo III (Sez. III.1, campi N) non dichiara l’accordo: la Commissione valuta ciò che è dichiarato nei moduli.` });
  }

  // nominativi di cast e troupe: generano punteggio solo se c'è un accordo sottoscritto
  const accordi = docs.filter((d) => d.tipo === 'accordi_cast' && d.testo);
  const persone = [...(m3.elencoArtistico || []), ...(m3.elencoTecnico || [])].filter((x) => x.nome && x.nome.trim().length > 3);
  if (accordi.length && persone.length) {
    const testo = semplice(accordi.map((d) => `${d.nome}\n${d.testo}`).join('\n'));
    const senza = persone.filter((x) => {
      const parti = semplice(x.nome).split(/\s+/).filter((t) => t.length >= 3);
      const cognome = parti[parti.length - 1];
      return !cognome || !testo.includes(cognome);
    });
    if (senza.length) out.push({ id: 'm3_nominativi', esito: 'attenzione', titolo: `Accordi con cast e troupe: ${persone.length - senza.length} nominativi su ${persone.length} trovati`, dettaglio: `Non compaiono negli accordi caricati: ${senza.slice(0, 8).map((x) => `${x.nome}${x.ruolo ? ` (${x.ruolo})` : ''}`).join(', ')}${senza.length > 8 ? ` e altri ${senza.length - 8}` : ''}. Senza contratto, deal memo o lettera di intento sottoscritta queste figure non generano punteggio (criteri 3.2 e 3.3).` });
    else out.push({ id: 'm3_nominativi', esito: 'ok', titolo: 'Accordi con cast e troupe', dettaglio: `Tutti i ${persone.length} nominativi del Modulo III compaiono negli accordi caricati.` });
  }

  // date delle riprese
  const inizio = dataIt(m3.dataInizioRiprese), fine = dataIt(m3.dataFineRiprese);
  const finestra = (bando.finestre || []).find((f) => f.anno === Number(progetto.anno));
  if (inizio && finestra && inizio < new Date(`${finestra.dal}T00:00:00Z`)) out.push({ id: 'm3_inizio', esito: 'attenzione', titolo: 'Inizio delle riprese prima della finestra', dettaglio: `Il Modulo III indica l’inizio delle riprese il ${giornoMese(inizio)}, prima dell’apertura della finestra ${finestra.anno}: le riprese in ${bando.territorio || 'regione'} non devono cominciare prima dell’invio dell’istanza (art. 5).` });
  if (inizio && fine && fine < inizio) out.push({ id: 'm3_date', esito: 'attenzione', titolo: 'Date delle riprese', dettaglio: `La fine delle riprese (${giornoMese(fine)}) precede l’inizio (${giornoMese(inizio)}).` });
  const giorni = progetto.dati?.giorni?.ripreseTot;
  if (inizio && fine && fine >= inizio && typeof giorni === 'number') {
    const calendario = Math.round((fine - inizio) / GIORNO) + 1;
    if (giorni > calendario) out.push({ id: 'm3_giorni', esito: 'attenzione', titolo: 'Giorni di riprese e calendario', dettaglio: `Il modulo dichiara ${giorni} giorni di riprese, ma tra il ${giornoMese(inizio)} e il ${giornoMese(fine)} ci sono ${calendario} giorni di calendario.` });
  }
  return out;
}

const CAMPI = [
  ['durataMin', null, 'durata'],
  ['giorni', 'prepTot', 'giorni di pre-produzione'], ['giorni', 'prepSicilia', 'pre-produzione sul territorio'],
  ['giorni', 'ripreseTot', 'giorni di riprese'], ['giorni', 'ripreseSicilia', 'riprese sul territorio'],
  ['giorni', 'postTot', 'giorni di post-produzione'], ['giorni', 'postSicilia', 'post-produzione sul territorio'],
  ['professionisti', 'artTot', 'componente artistica'], ['professionisti', 'artSicilia', 'artistici del territorio'],
  ['professionisti', 'crewTot', 'cast tecnico'], ['professionisti', 'crewSicilia', 'tecnici del territorio'],
  ['economici', 'costoProduzione', 'costo di produzione'], ['economici', 'contributoRichiesto', 'contributo richiesto'], ['economici', 'spesaSicilia', 'spesa sul territorio'],
];
export function campiMancanti(dati) {
  const mancanti = CAMPI.filter(([g, k]) => { const v = k ? dati?.[g]?.[k] : dati?.[g]; return v == null || v === '' || Number.isNaN(v); }).map((c) => c[2]);
  if (!dati?.piano?.length) mancanti.push('piano finanziario');
  return { mancanti, totale: CAMPI.length + 1 };
}

/** Elenco dei file da allegare alla PEC, con ciò che è già nel dossier. */
export function elencoFile(bando, progetto, controlli) {
  const docs = progetto.documenti || [];
  const visti = new Set((controlli || []).filter((c) => c.id.startsWith('all_')).map((c) => c.id.slice(4)));
  return (bando.allegati || []).map((a) => {
    const file = docs.filter((d) => d.tipo === a.tipo);
    const richiesto = a.obbligo === 'sempre' || (visti.has(a.tipo) && a.obbligo !== 'consigliato' && a.obbligo !== 'punteggio');
    return { tipo: a.tipo, nome: a.nome, obbligo: a.obbligo, richiesto, formati: a.formati || null, file: file.map((d) => ({ nome: d.nome, dimensione: d.dimensione || 0 })) };
  }).filter((x) => x.richiesto || x.file.length);
}

const ORDINE = { critico: 0, attenzione: 1 };
const schedaDi = (id) => (/^(all_|fmt_|m3_)/.test(id) ? 'documenti' : 'dati');

/**
 * Quadro completo per il cruscotto del dossier.
 * ris è il risultato di componiRisultato; oggi è iniettabile per i test.
 */
export function statoInvio(bando, progetto, ris, oggi = new Date()) {
  const docs = progetto.documenti || [];
  let base = verificheAmmissibilita(bando, progetto.categoriaId, progetto.anno, progetto.dati, docs.map((d) => d.tipo));
  if (!docs.length) base = base.filter((c) => !c.id.startsWith('all_'));
  const controlli = [...base, ...controlliFormato(bando, docs), ...controlliIncrociati(bando, progetto)];
  const problemi = controlli.filter((c) => c.esito in ORDINE).map((c) => ({ ...c, scheda: schedaDi(c.id) }));
  for (const c of progetto.valutazione?.verifica?.controlli || []) {
    if (c.esito in ORDINE) problemi.push({ id: `vf_${problemi.length}`, esito: c.esito, titolo: c.titolo, dettaglio: c.azione || c.dettaglio, scheda: 'report', origine: 'Verifica formale di Claude' });
  }
  for (const b of ris.bloccanti || []) problemi.push({ id: `pt_b${problemi.length}`, esito: 'critico', titolo: 'Minimo di sezione irraggiungibile', dettaglio: b, scheda: 'report' });
  if (ris.completo && ris.esito === 'sotto_soglia') for (const m of ris.motivi) problemi.push({ id: `pt_s${problemi.length}`, esito: 'critico', titolo: 'Punteggio sotto soglia', dettaglio: m, scheda: 'report' });
  if (ris.completo && ris.esito === 'a_rischio') problemi.push({ id: 'pt_rischio', esito: 'attenzione', titolo: ris.sezioniFragili?.length ? 'Soglie superate, ma a rischio documentale' : 'Margine ridotto sulle soglie',
    dettaglio: ris.sezioniFragili?.length ? `Applicando alla lettera i principi di attribuzione il dossier scenderebbe a ${ris.rigoroso.toLocaleString('it-IT')} punti, con ${ris.sezioniFragili.length === 1 ? 'la sezione' : 'le sezioni'} ${ris.sezioniFragili.join(', ')} sotto il minimo: chiudi le lacune documentali segnalate nel report.` : `Nella lettura più severa dei commissari il dossier scende a ${Math.min(ris.min, ris.rigoroso).toLocaleString('it-IT')} punti o sotto un minimo di sezione.`, scheda: 'report' });
  problemi.sort((a, b) => ORDINE[a.esito] - ORDINE[b.esito]);

  const mancantiObbligatori = controlli.filter((c) => c.id.startsWith('all_') && c.esito === 'critico').length;
  const campi = campiMancanti(progetto.dati);
  const daConfermare = controlli.filter((c) => c.id.startsWith('req_') && c.esito === 'da_verificare').length;
  const val = progetto.valutazione;
  const passi = [
    { id: 'documenti', titolo: 'Documenti', stato: !docs.length ? 'da_fare' : mancantiObbligatori ? 'attenzione' : 'fatto',
      dettaglio: !docs.length ? 'Nessun file caricato.' : mancantiObbligatori ? `${docs.length} file ${docs.length === 1 ? 'caricato' : 'caricati'}, ${mancantiObbligatori} ${mancantiObbligatori === 1 ? 'allegato obbligatorio mancante' : 'allegati obbligatori mancanti'}.` : `${docs.length} file ${docs.length === 1 ? 'caricato' : 'caricati'}, allegati obbligatori presenti.` },
    { id: 'dati', titolo: 'Dati chiave', stato: campi.mancanti.length >= campi.totale - 1 ? 'da_fare' : campi.mancanti.length || daConfermare ? 'attenzione' : 'fatto',
      dettaglio: campi.mancanti.length ? `Mancano: ${campi.mancanti.slice(0, 4).join(', ')}${campi.mancanti.length > 4 ? ` e altri ${campi.mancanti.length - 4}` : ''}.` : daConfermare ? `Numeri completi; ${daConfermare} ${daConfermare === 1 ? 'requisito' : 'requisiti'} da confermare a mano.` : 'Numeri completi e requisiti confermati.' },
    { id: 'valutazione', titolo: 'Valutazione', stato: !val ? 'da_fare' : (val.errori?.length || !ris.completo) ? 'attenzione' : 'fatto',
      dettaglio: !val ? 'La commissione simulata non ha ancora letto i documenti.' : val.errori?.length ? `${val.errori.length} ${val.errori.length === 1 ? 'lettura non riuscita' : 'letture non riuscite'}: riprovale.` : !ris.completo ? 'Alcune sezioni non sono state valutate: mancano i documenti corrispondenti.' : `Completata il ${new Date(val.data).toLocaleDateString('it-IT')}.` },
    { id: 'report', titolo: 'Esito', stato: !ris.completo ? 'da_fare' : ris.esito === 'ammissibile' ? 'fatto' : 'attenzione',
      dettaglio: !ris.completo ? 'Stima ancora parziale.' : ris.esito === 'ammissibile' ? 'Sopra tutte le soglie.' : ris.esito === 'a_rischio' ? (ris.sezioniFragili?.length ? 'Sopra le soglie, con rischio documentale.' : 'Ammissibile con margine ridotto.') : 'Sotto soglia.' },
  ];
  const critici = problemi.filter((x) => x.esito === 'critico').length;
  const attenzioni = problemi.length - critici;
  const semaforo = critici ? 'rosso' : (!ris.completo || attenzioni || daConfermare || passi.some((x) => x.stato !== 'fatto')) ? 'giallo' : 'verde';
  const AZIONI = { documenti: 'Carica i documenti del dossier', dati: 'Completa i dati chiave', valutazione: 'Avvia la valutazione', report: 'Leggi il report e sistema i punti deboli' };
  const daFare = (id) => passi.find((x) => x.id === id).stato === 'da_fare';
  const incompleto = passi.find((x) => x.stato === 'attenzione');
  // prima ciò che manca del tutto, poi i blocchi, poi la valutazione, infine i ritocchi
  const prossimo = daFare('documenti') ? { scheda: 'documenti', testo: AZIONI.documenti }
    : daFare('dati') ? { scheda: 'dati', testo: AZIONI.dati }
      : critici ? { scheda: problemi[0].scheda, testo: critici === 1 ? 'Risolvi il problema bloccante' : 'Risolvi i problemi bloccanti' }
        : daFare('valutazione') ? { scheda: 'valutazione', testo: AZIONI.valutazione }
          : incompleto ? { scheda: incompleto.id, testo: AZIONI[incompleto.id] } : null;
  return {
    controlli, problemi, passi, critici, attenzioni, daConfermare, semaforo, pronto: semaforo === 'verde',
    prossimo,
    finestra: finestraInvio(bando, progetto.anno, oggi), invio: bando.invio || null, file: elencoFile(bando, progetto, controlli),
  };
}
