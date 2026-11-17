// Forma di un bando in Clockwise: vocabolari, pulizia e controllo.
// Tutto ciò che entra nel programma come bando — dati predefiniti, catalogo scaricato dal canale di
// aggiornamento, griglia letta da Claude — passa da sanificaBando() e validaBando(): ne escono soltanto
// dati (numeri, testi, elenchi) nei campi previsti, mai altro.

export const FAMIGLIE = {
  scrittura: 'qualità e originalità di sceneggiatura, soggetto o trattamento',
  visione: 'regia, impianto visivo, note di regia',
  territorio_contenuto: 'valorizzazione di luoghi, cultura e identità del territorio',
  societa: 'curriculum e solidità della società di produzione',
  artistica: 'regista, autori, cast artistico',
  tecnica: 'troupe e capi reparto',
  ricaduta_lavoro: 'occupazione di professionisti del territorio',
  ricaduta_spesa: 'spesa e giorni di lavorazione sul territorio',
  piano_finanziario: 'copertura e solidità del piano finanziario',
  distribuzione: 'piano e accordi di distribuzione, mercato',
  internazionale: 'coproduzioni e circolazione all’estero',
  sostenibilita: 'sostenibilità ambientale, parità, inclusione',
  formazione: 'giovani autori, opere prime, formazione',
  altro: 'altro',
};

// I nomi con «Sicilia» sono storici: ogni metrica vale per il territorio del bando in uso.
export const METRICHE = {
  lavorazioneSicilia: { unita: 'pct', descrizione: 'giorni di pre-produzione e riprese nel territorio ÷ totale giorni di pre-produzione e riprese (%)' },
  ripreseTerritorioPct: { unita: 'pct', descrizione: 'giorni di riprese nel territorio ÷ giorni di riprese totali (%)' },
  giorniRipreseTerritorio: { unita: 'giorni', descrizione: 'numero di giorni di riprese nel territorio (giorni)' },
  postSicilia: { unita: 'pct', descrizione: 'giorni di post-produzione nel territorio ÷ totale giorni di post-produzione (%)' },
  artisticiSiciliani: { unita: 'pct', descrizione: 'professionisti della componente artistica nati/residenti nel territorio ÷ totale (%)' },
  tecniciSiciliani: { unita: 'pct', descrizione: 'professionisti del cast tecnico nati/residenti nel territorio ÷ totale (%)' },
  professionistiSiciliani: { unita: 'pct', descrizione: 'professionisti artistici e tecnici nati/residenti nel territorio ÷ totale (%)' },
  professionistiTerritorio: { unita: 'numero', descrizione: 'numero di professionisti nati/residenti nel territorio (numero)' },
  spesaSicilia: { unita: 'pct', descrizione: 'spesa ammissibile nel territorio ÷ contributo richiesto (%)' },
  spesaTerritorioSuCosto: { unita: 'pct', descrizione: 'spesa nel territorio ÷ costo di produzione (%)' },
  spesaTerritorioEuro: { unita: 'euro', descrizione: 'spesa nel territorio (euro)' },
  contributoSuCosto: { unita: 'pct', descrizione: 'contributo richiesto ÷ costo di produzione (%)' },
  costoProduzione: { unita: 'euro', descrizione: 'costo di produzione (euro)' },
  copertura: { unita: 'pct', descrizione: 'fonti finanziarie documentate ÷ costo di produzione (%)' },
};

export const TIPI_ALLEGATO = ['modulo1', 'modulo2', 'modulo3', 'identita', 'sceneggiatura', 'cv_societa', 'cv_regista', 'cv_autori', 'cv_artistico', 'cv_tecnico',
  'accordi_cast', 'coproduzione', 'distribuzione', 'finanziamenti', 'referenze_bancarie', 'finanziatori_esterni', 'produttore_esecutivo', 'green_film', 'piano_lavorazione', 'altro'];
export const STATI = { aperto: 'Aperto', chiuso: 'Chiuso', atteso: 'Atteso', sospeso: 'Sospeso', non_trovato: 'Non attivo' };
export const TIPI_VALUTAZIONE = { punteggio: 'Commissione con griglia a punti', automatico: 'Automatico', sportello: 'A sportello', misto: 'Misto', selettiva: 'Selettiva senza punteggio', nessuna: 'Nessun bando attivo' };
const OBBLIGHI = ['sempre', 'se_dichiarato', 'punteggio', 'consigliato', 'green'];

/* ------------------------------------------------------------------ pulizia */

const testo = (v, max = 4000) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
// Numeri scritti come testo: anche all'italiana («300.000», «12,5», «1.500.000,50»): «300.000» non deve diventare 300.
const testoNumero = (v) => { const t = v.trim().replace(/\s+/g, ''); return /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : /^-?\d+,\d+$/.test(t) ? t.replace(',', '.') : t; };
const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(testoNumero(v))) ? Number(testoNumero(v)) : null));
const elenco = (v, max = 200) => (Array.isArray(v) ? v.slice(0, max) : []);
const slug = (v, max = 64) => testo(v, 200).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
const data = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
// Solo indirizzi https (o http) scritti per esteso: niente javascript:, data: o percorsi relativi.
export function urlSicuro(v) {
  if (typeof v !== 'string') return '';
  try { const u = new URL(v.trim()); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href.slice(0, 600) : ''; } catch { return ''; }
}
const mappaNumeri = (o, max = 40) => {
  const out = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) for (const [k, v] of Object.entries(o).slice(0, max)) { const n = numero(v); if (n != null) out[testo(k, 24)] = n; }
  return out;
};

const soglieComb = (v) => elenco(v, 20).map((x) => ({
  etichetta: testo(x?.etichetta, 200), minimo: numero(x?.minimo) ?? 0,
  criteri: elenco(x?.criteri, 40).map((c) => testo(c, 24)).filter(Boolean), sezioni: elenco(x?.sezioni, 20).map((c) => testo(c, 12)).filter(Boolean),
})).filter((x) => x.minimo > 0 && (x.criteri.length || x.sezioni.length));

function sanificaCriterio(c) {
  const tipo = ['qualitativo', 'discreto', 'fasce'].includes(c?.tipo) ? c.tipo : 'qualitativo';
  const out = {
    id: testo(c?.id, 24), nome: testo(c?.nome, 300), max: numero(c?.max) ?? 0, tipo,
    famiglia: FAMIGLIE[c?.famiglia] ? c.famiglia : 'altro',
    descrizione: testo(c?.descrizione, 3000),
  };
  const principio = [testo(c?.principio, 3000), c?.calcolo ? `Regola di calcolo scritta nel bando: ${testo(c.calcolo, 1500)}` : '', c?.formula ? `Formula: ${testo(c.formula, 800)}` : ''].filter(Boolean).join(' ');
  if (principio) out.principio = principio;
  if (tipo === 'fasce') {
    out.metrica = testo(c.metrica, 40);
    out.peso = numero(c.peso) ?? 1;
    if (c.giudizio === true) out.giudizio = true;
    out.fasce = elenco(c.fasce, 30).map((f) => {
      const r = { punti: numero(f?.punti) ?? 0, etichetta: testo(f?.etichetta, 200) };
      if (typeof f?.flag === 'string') r.flag = testo(f.flag, 40);
      else if (numero(f?.oltre) != null) r.oltre = numero(f.oltre);
      else r.da = numero(f?.da) ?? 0;
      return r;
    });
  }
  if (tipo === 'discreto') out.valori = elenco(c.valori, 30).map((v) => ({ punti: numero(v?.punti) ?? 0, etichetta: testo(v?.etichetta, 300) })).sort((a, b) => b.punti - a.punti);
  if (Array.isArray(c?.documenti)) out.documenti = c.documenti.filter((t) => TIPI_ALLEGATO.includes(t));
  if (Array.isArray(c?.richiede)) out.richiede = c.richiede.filter((t) => TIPI_ALLEGATO.includes(t));
  if (numero(c?.senzaDocumenti) != null) out.senzaDocumenti = numero(c.senzaDocumenti);
  return out;
}

/** Copia un bando tenendo soltanto i campi previsti, con i tipi giusti. Non lancia: i difetti li trova validaBando(). */
export function sanificaBando(g) {
  const b = g && typeof g === 'object' ? g : {};
  const out = {
    id: slug(b.id), fondoId: slug(b.fondoId || ''), revisione: data(b.revisione) || '',
    nome: testo(b.nome, 300), nomeBreve: testo(b.nomeBreve || b.nome, 80), ente: testo(b.ente, 400), regione: testo(b.regione, 60),
    territorio: testo(b.territorio || b.regione, 60), gentilizio: testo(b.gentilizio, 40), fonte: testo(b.fonte, 500),
    stato: STATI[b.stato] ? b.stato : 'chiuso', tipoValutazione: TIPI_VALUTAZIONE[b.tipoValutazione] ? b.tipoValutazione : 'punteggio',
    descrizione: testo(b.descrizione, 1500), paginaUfficiale: urlSicuro(b.paginaUfficiale),
    fontiUrl: elenco(b.fontiUrl, 30).map((f) => ({ titolo: testo(f?.titolo, 300), url: urlSicuro(f?.url), tipo: testo(f?.tipo, 24), consultato: data(f?.consultato) || '' })).filter((f) => f.url),
    storicoEdizioni: elenco(b.storicoEdizioni, 20).map((e) => ({ anno: numero(e?.anno), pubblicato: data(e?.pubblicato), scadenza: data(e?.scadenza), nota: testo(e?.nota, 300) })).filter((e) => e.anno),
    finestre: elenco(b.finestre, 30).map((f) => ({ anno: numero(f?.anno), dal: data(f?.dal), al: data(f?.al), ...(f?.nota ? { nota: testo(f.nota, 300) } : {}) })).filter((f) => f.anno && f.al),
    prossimaEdizione: b.prossimaEdizione && numero(b.prossimaEdizione.anno) ? { anno: numero(b.prossimaEdizione.anno), periodoAtteso: testo(b.prossimaEdizione.periodoAtteso, 120), base: testo(b.prossimaEdizione.base, 400) } : null,
    sogliaTotale: numero(b.sogliaTotale) ?? 0, punteggioMassimo: numero(b.punteggioMassimo) ?? 100,
    // Soglia complessiva calcolata solo su alcune sezioni (es. A-E, esclusa una sezione di premialità).
    sogliaSuSezioni: elenco(b.sogliaSuSezioni, 20).map((x) => testo(x, 12)).filter(Boolean),
    // Penalità che si sottraggono al totale se il dossier ricade nella condizione (es. rating di legalità assente).
    // Minimi su somme di criteri o di sezioni (es. «criteri 1+5 almeno 25», «A+B almeno 40»); valgono per tutte le categorie salvo categorie[].soglieCombinate.
    soglieCombinate: soglieComb(b.soglieCombinate),
    penalita: elenco(b.penalita, 20).map((x, i) => ({ id: slug(x?.id, 40) || `p${i + 1}`, testo: testo(x?.testo, 400), punti: -Math.abs(numero(x?.punti) ?? 0) })).filter((x) => x.testo && x.punti < 0),
    spesaTerritorioMinPct: numero(b.spesaTerritorioMinPct) ?? 0, spesaTerritorioMinSuCostoPct: numero(b.spesaTerritorioMinSuCostoPct) ?? 0,
    producerFeeMaxPct: numero(b.producerFeeMaxPct), consuntivoMinPct: numero(b.consuntivoMinPct), quotaProponenteMinPct: numero(b.quotaProponenteMinPct), regolaContributo: b.regolaContributo === 'proporzionale_al_primo' ? 'proporzionale_al_primo' : 'pieno',
    commissione: { componenti: numero(b.commissione?.componenti), descrizione: testo(b.commissione?.descrizione, 1500) },
    invio: b.invio && (b.invio.indirizzo || b.invio.canale) ? { canale: testo(b.invio.canale, 60), indirizzo: testo(b.invio.indirizzo, 300), oggetto: testo(b.invio.oggetto, 400), regole: elenco(b.invio.regole, 20).map((r) => testo(r, 500)).filter(Boolean) } : null,
    categorie: elenco(b.categorie, 30).map((c) => ({
      id: slug(c?.id || c?.nome, 48), nome: testo(c?.nome, 300), griglia: testo(c?.griglia, 24),
      soglie: mappaNumeri(c?.soglie),
      contributo: { percentuale: numero(c?.contributo?.percentuale) ?? 0, massimali: mappaNumeri(c?.contributo?.massimali), ...(c?.contributo?.nota ? { nota: testo(c.contributo.nota, 400) } : {}) },
      dotazione: mappaNumeri(c?.dotazione),
      durataMin: numero(c?.durataMin), durataMaxEsclusa: numero(c?.durataMaxEsclusa), greenFilm: c?.greenFilm === true,
      testoQualita: c?.testoQualita === 'trattamento' ? 'trattamento' : 'sceneggiatura',
      ...(Array.isArray(c?.soglieCombinate) ? { soglieCombinate: soglieComb(c.soglieCombinate) } : {}),
    })),
    griglie: {},
    allegati: elenco(b.allegati, 60).map((a) => ({ tipo: TIPI_ALLEGATO.includes(a?.tipo) ? a.tipo : 'altro', nome: testo(a?.nome, 300), obbligo: OBBLIGHI.includes(a?.obbligo) ? a.obbligo : 'consigliato', ...(Array.isArray(a?.criteri) ? { criteri: a.criteri.map((x) => testo(x, 24)) } : {}), ...(Array.isArray(a?.formati) ? { formati: a.formati.map((x) => testo(x, 8)) } : {}), ...(a?.unico ? { unico: true } : {}) })).filter((a) => a.nome),
    requisiti: elenco(b.requisiti, 60).map((r, i) => ({ id: slug(r?.id, 40) || `r${i + 1}`, testo: testo(r?.testo, 600) })).filter((r) => r.testo),
    scadenze: elenco(b.scadenze, 20).map((x, i) => ({ id: slug(x?.id, 40) || `s${i + 1}`, etichetta: testo(x?.etichetta, 300), mesi: numero(x?.mesi) ?? 0, ...(numero(x?.preavvisoGiorni) != null ? { preavvisoGiorni: numero(x.preavvisoGiorni) } : {}), nota: testo(x?.nota, 600) })).filter((x) => x.etichetta && x.mesi > 0),
    scadenzeNote: elenco(b.scadenzeNote, 20).map((x) => testo(x, 900)).filter(Boolean),
    obblighi: elenco(b.obblighi, 40).map((x, i) => ({ id: slug(x?.id, 40) || `o${i + 1}`, quando: ['sempre', 'riprese', 'postproduzione', 'rendiconto', 'uscita'].includes(x?.quando) ? x.quando : 'sempre', testo: testo(x?.testo, 600) })).filter((x) => x.testo),
    erogazione: elenco(b.erogazione, 10).map((x) => ({ quota: testo(x?.quota, 60), percentuale: numero(x?.percentuale) ?? 0, condizione: testo(x?.condizione, 500) })).filter((x) => x.quota),
    note: elenco(b.note, 40).map((n) => testo(n, 800)).filter(Boolean),
    altriBandi: elenco(b.altriBandi, 20).map((x) => ({ nome: testo(x?.nome, 300), url: urlSicuro(x?.url), descrizione: testo(x?.descrizione, 600) })).filter((x) => x.nome),
    esitiPubblici: elenco(b.esitiPubblici, 20).map((x) => ({ anno: numero(x?.anno), titolo: testo(x?.titolo, 300), url: urlSicuro(x?.url), contienePunteggi: x?.contienePunteggi === true, perSezione: x?.perSezione === true })).filter((x) => x.anno),
    affidabilita: {
      griglia: ['testo_ufficiale', 'fonte_secondaria', 'non_disponibile'].includes(b.affidabilita?.griglia) ? b.affidabilita.griglia : 'non_disponibile',
      citazioni: elenco(b.affidabilita?.citazioni, 30).map((c) => ({ riferimento: testo(c?.riferimento, 200), testo: testo(c?.testo, 900) })).filter((c) => c.testo),
      dubbi: elenco(b.affidabilita?.dubbi, 30).map((d) => testo(d, 600)).filter(Boolean),
    },
    verifica: b.verifica ? { esito: testo(b.verifica.esito, 24), data: data(b.verifica.data) || '', correzioni: elenco(b.verifica.correzioni, 40).map((x) => testo(x, 500)).filter(Boolean), dubbi: elenco(b.verifica.dubbi, 30).map((x) => testo(x, 500)).filter(Boolean) } : null,
  };
  if (b.griglie && typeof b.griglie === 'object' && !Array.isArray(b.griglie)) {
    for (const [gid, g2] of Object.entries(b.griglie).slice(0, 12)) {
      const id = testo(gid, 24);
      const sezioni = elenco(g2?.sezioni, 20).map((s) => ({ id: testo(s?.id, 12), nome: testo(s?.nome, 300), max: numero(s?.max) ?? 0, ...(s?.obiettivo ? { obiettivo: testo(s.obiettivo, 500) } : {}), criteri: elenco(s?.criteri, 40).map(sanificaCriterio) }));
      if (id) out.griglie[id] = { id, nome: testo(g2?.nome || gid, 300), sezioni };
    }
  }
  return out;
}

/* ------------------------------------------------------------------ controllo */

const quasi = (a, b) => Math.abs(a - b) <= 0.051;

/**
 * Controlla un bando già sanificato. errori = non usabile per la simulazione; avvisi = da far vedere a chi verifica.
 * @returns {{ ok: boolean, simulabile: boolean, errori: string[], avvisi: string[] }}
 */
export function validaBando(b) {
  const errori = [], avvisi = [];
  if (!b?.id) errori.push('Manca l’identificativo.');
  if (!b?.nome) errori.push('Manca il nome.');
  const griglie = Object.values(b?.griglie || {});
  const haGriglia = griglie.length > 0 && (b.categorie || []).length > 0;
  if (haGriglia) {
    if (!(b.punteggioMassimo > 0)) errori.push('Punteggio massimo non valido.');
    if (b.sogliaTotale < 0 || b.sogliaTotale > b.punteggioMassimo) errori.push('Soglia complessiva fuori scala.');
    for (const g of griglie) {
      if (!g.sezioni.length) errori.push(`Griglia ${g.id}: nessuna sezione.`);
      const idSez = new Set(), idCrit = new Set();
      let totale = 0;
      for (const s of g.sezioni) {
        if (!s.id || idSez.has(s.id)) errori.push(`Griglia ${g.id}: sezione senza identificativo o ripetuta (${s.id || '?'}).`);
        idSez.add(s.id);
        if (!s.criteri.length) errori.push(`Sezione ${s.id}: nessun criterio.`);
        if (!(s.max > 0)) errori.push(`Sezione ${s.id}: massimo non valido.`);
        let somma = 0;
        for (const c of s.criteri) {
          if (!c.id || idCrit.has(c.id)) errori.push(`Griglia ${g.id}: criterio senza identificativo o ripetuto (${c.id || '?'}).`);
          idCrit.add(c.id);
          if (!(c.max > 0)) errori.push(`Criterio ${c.id}: massimo non valido.`);
          somma += c.max;
          if (c.tipo === 'fasce') {
            if (!METRICHE[c.metrica]) errori.push(`Criterio ${c.id}: metrica sconosciuta «${c.metrica}».`);
            if (!c.fasce?.length) errori.push(`Criterio ${c.id}: nessuna fascia.`);
            else {
              const top = Math.max(...c.fasce.map((f) => f.punti)) * c.peso;
              if (!quasi(top, c.max)) errori.push(`Criterio ${c.id}: la fascia più alta vale ${top} ma il massimo è ${c.max}.`);
              const soglie = c.fasce.filter((f) => !f.flag).map((f) => (f.oltre != null ? f.oltre : f.da));
              if (soglie.some((v, i) => i > 0 && v > soglie[i - 1])) errori.push(`Criterio ${c.id}: le fasce non sono ordinate dalla migliore alla peggiore.`);
            }
          }
          if (c.tipo === 'discreto') {
            if (!c.valori?.length) errori.push(`Criterio ${c.id}: nessun punteggio ammesso.`);
            else if (!quasi(Math.max(...c.valori.map((v) => v.punti)), c.max)) errori.push(`Criterio ${c.id}: il punteggio più alto ammesso non coincide con il massimo.`);
          }
          if (c.famiglia === 'altro' && c.tipo !== 'fasce') avvisi.push(`Criterio ${c.id}: famiglia non riconosciuta, i documenti da leggere vanno scelti a mano.`);
        }
        if (!quasi(somma, s.max)) errori.push(`Sezione ${s.id}: i criteri sommano a ${somma}, il massimo dichiarato è ${s.max}.`);
        totale += s.max;
      }
      if (!quasi(totale, b.punteggioMassimo)) errori.push(`Griglia ${g.id}: le sezioni sommano a ${totale} su ${b.punteggioMassimo}.`);
    }
    const idCat = new Set();
    for (const c of b.categorie) {
      if (!c.id || idCat.has(c.id)) errori.push(`Categoria senza identificativo o ripetuta (${c.id || '?'}).`);
      idCat.add(c.id);
      const g = b.griglie[c.griglia];
      if (!g) { errori.push(`Categoria «${c.nome}»: griglia «${c.griglia}» inesistente.`); continue; }
      for (const [sid, min] of Object.entries(c.soglie || {})) {
        const s = g.sezioni.find((x) => x.id === sid);
        if (!s) errori.push(`Categoria «${c.nome}»: soglia su una sezione inesistente (${sid}).`);
        else if (min < 0 || min > s.max) errori.push(`Categoria «${c.nome}»: soglia della sezione ${sid} fuori scala.`);
      }
      if (c.contributo.percentuale < 0 || c.contributo.percentuale > 100) errori.push(`Categoria «${c.nome}»: percentuale di contributo fuori scala.`);
    }
  }
  for (const sc of [...(b?.soglieCombinate || []), ...(b?.categorie || []).flatMap((c) => c.soglieCombinate || [])]) {
    for (const cid of sc.criteri) if (!griglie.some((g) => g.sezioni.some((x) => x.criteri.some((k) => k.id === cid)))) errori.push(`Soglia combinata su un criterio inesistente (${cid}).`);
    for (const sid of sc.sezioni) if (!griglie.some((g) => g.sezioni.some((x) => x.id === sid))) errori.push(`Soglia combinata su una sezione inesistente (${sid}).`);
  }
  for (const sid of b?.sogliaSuSezioni || []) if (!griglie.some((g) => g.sezioni.some((x) => x.id === sid))) errori.push(`Soglia su una sezione inesistente (${sid}).`);
  for (const f of b?.finestre || []) if (f.dal && f.al && f.dal > f.al) errori.push(`Finestra ${f.anno}: la data di apertura segue quella di chiusura.`);
  const simulabile = haGriglia && !errori.length && b.tipoValutazione !== 'automatico' && b.tipoValutazione !== 'nessuna';
  return { ok: !errori.length, simulabile, errori, avvisi };
}

/** Bando pronto per il programma a partire da un dato grezzo; lancia se non è usabile. */
export function preparaBando(grezzo, { predefinito = true } = {}) {
  const b = sanificaBando(grezzo);
  const v = validaBando(b);
  if (!v.ok) throw new Error(`Bando «${b.id || b.nome || '?'}» non valido: ${v.errori.join(' ')}`);
  const provata = b.affidabilita.griglia === 'testo_ufficiale' && (!b.verifica || ['confermata', 'corretta'].includes(b.verifica.esito));
  return { ...b, predefinito, simulabile: v.simulabile, verificato: v.simulabile && provata, avvisi: v.avvisi };
}

/** Finestra a cui riferirsi oggi: quella aperta, altrimenti la prossima, altrimenti l'ultima chiusa. */
export function finestraDiRiferimento(bando, oggi = new Date().toISOString().slice(0, 10)) {
  const f = [...(bando?.finestre || [])].sort((a, b) => a.al.localeCompare(b.al));
  const aperta = f.find((x) => (!x.dal || x.dal <= oggi) && x.al >= oggi);
  if (aperta) return { ...aperta, condizione: 'aperta' };
  const futura = f.find((x) => x.dal && x.dal > oggi);
  if (futura) return { ...futura, condizione: 'futura' };
  return f.length ? { ...f[f.length - 1], condizione: 'chiusa' } : null;
}

/** Anni selezionabili per un bando: quelli delle finestre note più l'edizione successiva attesa. */
export function anniBando(bando, oggi = new Date().toISOString().slice(0, 10)) {
  const anni = new Map();
  for (const f of bando?.finestre || []) anni.set(f.anno, { anno: f.anno, dal: f.dal, al: f.al, nota: f.nota || '', prevista: false, chiusa: f.al < oggi });
  const p = bando?.prossimaEdizione;
  if (p?.anno && !anni.has(p.anno)) anni.set(p.anno, { anno: p.anno, dal: null, al: null, nota: [p.periodoAtteso && `attesa: ${p.periodoAtteso}`, p.base].filter(Boolean).join(' — '), prevista: true, chiusa: false });
  return [...anni.values()].sort((a, b) => a.anno - b.anno);
}
