// Istruzioni per Claude: commissari simulati, verifica formale, estrazione dati, lettura di un nuovo bando.
import { getCategoria, getGriglia, coperturaPiano, statisticheEsiti, ETICHETTE_DOC, formati, statisticheFinanziati } from './scoring.js';
import { blocchiDocumenti, tipoPerId, famiglieSezione } from './docs.js';
import { FAMIGLIE, METRICHE, sanificaBando } from './bandi/schema.js';
import { MINIMO_GREEN, RIDUZIONE_EMAS, EDIZIONE_PRECEDENTE } from './greenfilm.js';

const { fmt, euro } = formati;

export const PROFILI = [
  { id: 'drammaturgia', nome: 'Esperta di sceneggiatura', descrizione: 'story editor e docente di sceneggiatura, per anni lettrice per fondi selettivi nazionali. Esigente su struttura, personaggi e lingua; riconosce subito i testi derivativi.' },
  { id: 'produzione', nome: 'Esperto di produzione', descrizione: 'produttore e organizzatore generale con lunga esperienza di piani finanziari, coproduzioni e rendicontazione di fondi pubblici. Guarda alla fattibilità: che cosa è firmato, da chi, per quanto.' },
  { id: 'territorio', nome: 'Esperta di film commission', descrizione: 'già responsabile di una film commission regionale. Valuta ricadute economiche e occupazionali, legame autentico con il territorio e potenziale di cineturismo; diffida del colore locale di maniera.' },
  { id: 'presidente', nome: 'Presidente', descrizione: 'funzionario direttivo regionale che presiede la Commissione. Applica il bando alla lettera, pretende riscontri documentali e resta prudente quando la documentazione è incompleta.' },
  { id: 'mercato', nome: 'Esperto di distribuzione', descrizione: 'distributore e selezionatore di festival. Giudica il potenziale di circolazione dell’opera, la credibilità delle controparti commerciali e la coerenza tra progetto e mercato.' },
];

function descriviCriterio(c) {
  const righe = [`[${c.id}] ${c.nome} — massimo ${fmt(c.max)} punti`];
  righe.push(`Descrizione del bando: ${c.descrizione}`);
  if (c.principio) righe.push(`Principio di attribuzione della Commissione: ${c.principio}`);
  if (c.tipo === 'discreto') {
    righe.push(`Punteggi ammessi (nessun valore intermedio): ${c.valori.map((v) => `${fmt(v.punti)} = ${v.etichetta}`).join('; ')}.`);
  } else if (c.tipo === 'fasce') {
    righe.push(`Criterio a fasce. In «valore» scrivi la percentuale (0-100) di copertura che la Commissione riconoscerebbe secondo la prassi osservata (fonti dichiarate nel piano finanziario per le quali nel dossier c'è un documento della controparte, rapportate al costo di produzione al netto del contributo richiesto), e lascia «punteggio» a 0: il sistema applica le fasce del bando (${c.fasce.map((f) => `${f.etichetta} → ${fmt(f.punti * c.peso)}`).join('; ')}). In «rigoroso» scrivi invece i punti della fascia che risulterebbe contando solo le fonti che reggono a una lettura severa del principio qui sopra.`);
  } else {
    righe.push('Giudizio qualitativo: punteggio con un decimale, da 0 al massimo.');
  }
  return righe.join('\n');
}

export function riepilogoDati(bando, categoriaId, anno, dati) {
  const cat = getCategoria(bando, categoriaId);
  const g = dati.giorni || {}, p = dati.professionisti || {}, e = dati.economici || {};
  const n = (v, suff = '') => (v == null || v === '' ? 'non indicato' : `${typeof v === 'number' ? fmt(v) : v}${suff}`);
  const terr = bando.territorio || 'regione';
  const righe = [
    `Titolo: ${n(dati.titolo)}`,
    `Categoria: ${cat.nome}${dati.tipologiaOpera ? ` (${dati.tipologiaOpera})` : ''}; finestra ${anno}`,
    `Durata: ${n(dati.durataMin, ' minuti')}${dati.animazione ? '; opera in animazione' : ''}`,
    `Costo di produzione: ${euro(e.costoProduzione)}; costo ammissibile: ${euro(e.costoAmmissibile)}; contributo richiesto: ${euro(e.contributoRichiesto)}; spesa ammissibile in ${terr}: ${euro(e.spesaSicilia)}`,
    `Giorni di lavorazione — pre-produzione: ${n(g.prepTot)} (in ${terr} ${n(g.prepSicilia)}); riprese: ${n(g.ripreseTot)} (in ${terr} ${n(g.ripreseSicilia)}); post-produzione: ${n(g.postTot)} (in ${terr} ${n(g.postSicilia)})`,
    `Componente artistica: ${n(p.artTot)} professionisti, di cui ${n(p.artSicilia)} nati o residenti in ${terr}; cast tecnico: ${n(p.crewTot)}, di cui ${n(p.crewSicilia)}`,
    `Riprese già iniziate in ${terr}: ${dati.ripreseIniziate ? 'sì' : 'no'}`,
  ];
  if (dati.piano?.length) {
    const cop = coperturaPiano(dati);
    righe.push('Piano finanziario dichiarato (voce — fonte — importo — documento dichiarato a supporto):');
    for (const r of dati.piano) righe.push(`  ${r.voce} — ${[r.etichetta, r.denominazione].filter(Boolean).join(' / ')} — ${euro(r.importo)} — ${r.voce === '1.1' ? 'contributo richiesto con questo bando' : ETICHETTE_DOC[r.documento] || 'Nessun documento'}`);
    righe.push(`  Fonti con documento dichiarato: ${euro(cop.documentato)}, pari al ${fmt(cop.sulFabbisogno)}% del costo al netto del contributo richiesto (${fmt(cop.sulCosto)}% del costo di produzione complessivo).`);
  } else righe.push('Piano finanziario: non inserito.');
  return righe.join('\n');
}

function blocchiConoscenza(bando) {
  const extra = (bando.conoscenza || []).filter((k) => k.testo);
  if (!extra.length) return '';
  return `\n\nCONOSCENZA AGGIUNTIVA SUL BANDO (FAQ, graduatorie, verbali o note caricati dall'utente: usali per calibrare severità e interpretazioni)\n${extra.map((k, i) => `--- ${i + 1}. ${k.nome} ---\n${k.testo}`).join('\n\n')}`;
}

// Articoli dell'avviso che riguardano una lettura (A, B, D = sezioni; V = verifica formale).
export function testiUfficiali(bando, uso) {
  const articoli = (bando.testi || []).filter((a) => a.usi?.includes(uso));
  if (!articoli.length) return '';
  return `\n\nTESTO UFFICIALE DELL'AVVISO — articoli rilevanti (fonte: ${bando.fonte})\n${articoli.map((a) => `### ${a.titolo}\n${a.testo}`).join('\n\n')}`;
}

// Metro reale della Commissione: distribuzione dei punteggi assegnati nell'ultima finestra completa,
// punteggi dei finanziati di tutte le finestre note e prassi osservata nei casi reali.
export function taratura(bando, categoriaId, sezione) {
  const st = statisticheEsiti(bando, categoriaId);
  const d = st?.sezioni?.[sezione.id];
  if (!d) return '';
  const fin = statisticheFinanziati(bando, categoriaId);
  const f = fin?.sezioni?.[sezione.id];
  const prassi = (bando.prassi || []).filter((x) => !x.sezioni || x.sezioni.includes(sezione.id)).map((x) => `- ${x.testo}`).join('\n');
  return `\n\nMETRO REALE DELLA COMMISSIONE — finestra ${st.anno} (${st.fonte})
In questa categoria la Commissione ha valutato ${st.valutati} progetti: ${st.ammissibili} hanno superato tutte le soglie, ${st.finanziati} sono stati finanziati. Totali: primo in graduatoria ${fmt(st.primo)}, ultimo finanziato ${fmt(st.ultimoFinanziato)}.
Nella sezione ${sezione.id} i punteggi reali di tutti i ${st.valutati} progetti sono andati da ${fmt(d.min)} a ${fmt(d.max)} su ${fmt(sezione.max)}: metà tra ${fmt(d.q1)} e ${fmt(d.q3)}, mediana ${fmt(d.mediana)}.${f ? `\nTra i ${fin.progetti} progetti finanziati nelle finestre ${fin.anni.join(', ')} la sezione ${sezione.id} è andata da ${fmt(f.min)} a ${fmt(f.max)}: metà tra ${fmt(f.q1)} e ${fmt(f.q3)}, mediana ${fmt(f.mediana)}.` : ''}
Questa distribuzione è la scala da usare per il punteggio atteso: la somma dei tuoi «punteggio» per la sezione deve cadere dove la Commissione collocherebbe questo dossier tra quelli reali. Un dossier nella media dei candidati sta vicino alla mediana; uno paragonabile ai finanziati sta nella loro fascia; ci si avvicina al massimo reale solo reggendo il confronto con i migliori. Sotto il minimo reale si scende solo se i documenti della sezione mancano del tutto o sono palesemente inconsistenti: non per difetti di forma che la Commissione, nei fatti, non ha sanzionato.${prassi ? `\n\nPRASSI OSSERVATA (ricavata da dossier reali di cui si conoscono documenti e punteggi)\n${prassi}` : ''}`;
}

const SCALA = 'Per ripartire il punteggio della sezione tra i criteri qualitativi: 90-100% del massimo solo per l’eccellenza rara, che reggerebbe il confronto con i migliori progetti nazionali; 75-89% lavoro solido e professionale; 60-74% discreto, con limiti chiari; sotto il 60% solo per ciò che è debole o non documentato affatto.';

function sistemaCommissione(bando, categoriaId, sezione, ancore = '') {
  const cat = getCategoria(bando, categoriaId);
  const griglia = getGriglia(bando, categoriaId);
  const massimo = bando.punteggioMassimo || 100;
  const minimi = griglia.sezioni.filter((s) => cat.soglie?.[s.id] != null).map((s) => `sezione ${s.id} almeno ${fmt(cat.soglie[s.id])} su ${fmt(s.max)}`).join('; ');
  const regolaSoglie = [bando.sogliaTotale ? `almeno ${fmt(bando.sogliaTotale)}/${fmt(massimo)} complessivi` : '', minimi ? `i minimi di sezione (${minimi})` : ''].filter(Boolean).join(' e ');
  return `Sei un componente della Commissione di Valutazione dell'avviso «${bando.nome}» (${bando.ente}).

Questa è una simulazione per un controllo qualità prima dell'invio dell'istanza. Il produttore vuole sapere quale punteggio darebbe la Commissione vera al dossier così com'è e che cosa lo limita. Serve una previsione fedele: una stima generosa lo porterebbe a contare su un contributo che non arriverà, una stima più severa della Commissione gli farebbe scartare o riscrivere un dossier che sarebbe stato finanziato. Per questo dai due letture distinte di ogni criterio.

Le due letture
- «punteggio» (per i criteri a fasce «valore»): il punteggio ATTESO, cioè quello che la Commissione reale assegnerebbe secondo il metro e la prassi riportati più sotto. È la previsione, e deve stare sulla scala dei punteggi reali.
- «rigoroso»: i punti che resterebbero applicando alla lettera i principi di attribuzione del bando, contando solo ciò che è provato da un documento idoneo e firmato. Non può superare il punteggio atteso. La differenza tra le due letture misura il rischio: i punti che il dossier perderebbe davanti a una Commissione più severa.

Come lavora la Commissione
- ${bando.commissione?.descrizione || 'Ogni componente attribuisce un punteggio per ogni voce della griglia; il punteggio finale è la media.'}
- Valuta il dossier per ciò che dichiarano i moduli di domanda e mostrano gli allegati. Non svolge un'istruttoria legale sui contratti: nella lettura attesa un accordo allegato e sottoscritto viene riconosciuto anche se la forma è migliorabile, e una figura dichiarata nei moduli con un curriculum conta anche senza lettera di intento. Le mancanze documentali vanno nella lettura rigorosa, nelle criticità e nei miglioramenti.
- I punteggi reali sono compressi in una fascia stretta della scala: usa il metro reale riportato sotto, non la scala teorica da zero al massimo.
- ${SCALA}
- Motiva ogni punteggio con riferimenti puntuali ai documenti: titolo del file, scena, pagina o voce.

Opera in valutazione: categoria «${cat.nome}». ${regolaSoglie ? `Per essere ammessi al contributo servono ${regolaSoglie}. Le soglie sono un'informazione di contesto: non avvicinare i punteggi alla soglia per far passare o bocciare il progetto.` : `Il bando non fissa un punteggio minimo: conta la posizione in graduatoria su ${fmt(massimo)} punti.`}

Sezione ${sezione.id} — ${sezione.nome} (massimo ${sezione.max} punti)
${sezione.criteri.filter((c) => c.tipo !== 'fasce' || c.giudizio).map(descriviCriterio).join('\n\n')}${taratura(bando, categoriaId, sezione)}${ancore || ''}${testiUfficiali(bando, sezione.id)}${blocchiConoscenza(bando)}`;
}

// Come leggere i documenti, per famiglia di criteri: vale per qualunque bando.
const GUIDE = {
  testo: 'Leggi per intero il testo dell’opera prima di assegnare i punteggi. Giudica ciò che è scritto sulla pagina, non le intenzioni dichiarate nelle note di regia.',
  persone: 'Per i criteri sulle persone verifica, figura per figura: è indicata nei moduli di domanda? Che cosa dice il curriculum o il profilo riportato? C’è un contratto, deal memo o lettera di intento sottoscritto? Nella lettura attesa valuta il livello professionale di società, componente artistica e troupe così come emergono da moduli e allegati; nella lettura rigorosa conta solo le figure con un accordo sottoscritto. Ogni accordo o curriculum mancante va tra le criticità, con l’intervento per rimediare.',
  finanza: 'Ricostruisci il piano finanziario fonte per fonte. Lettura attesa: sono coperte le fonti dichiarate nel piano per le quali nel dossier c’è un documento proveniente dalla controparte (contratto, deal memo, lettera di impegno, atto di concessione, referenza bancaria), rapportate al costo di produzione al netto del contributo richiesto; un contratto di distribuzione firmato è riconosciuto come tale. Lettura rigorosa: solo documenti firmati da tutte le parti, con importi determinati e controparte la cui qualifica è provata nel dossier; risorse proprie solo con referenze bancarie, contributi pubblici solo se già concessi. Segnala tra le criticità ogni fonte che regge alla prima lettura ma non alla seconda.',
  ricadute: 'Per i criteri sulle ricadute verifica che i numeri dichiarati (giorni, spesa, professionisti del territorio) siano coerenti tra moduli, piano di lavorazione e budget: la Commissione premia impegni credibili e verificabili a consuntivo.',
};
const GUIDA_PER_FAMIGLIA = {
  scrittura: 'testo', visione: 'testo', territorio_contenuto: 'testo',
  societa: 'persone', artistica: 'persone', tecnica: 'persone', formazione: 'persone',
  piano_finanziario: 'finanza', distribuzione: 'finanza', internazionale: 'finanza',
  ricaduta_lavoro: 'ricadute', ricaduta_spesa: 'ricadute', sostenibilita: 'ricadute',
};
const GUIDA_STORICA = { A: 'testo', B: 'persone', D: 'finanza' };
export function guidaSezione(sezione) {
  const famiglie = famiglieSezione(sezione);
  const chiavi = famiglie.length ? [...new Set(famiglie.map((f) => GUIDA_PER_FAMIGLIA[f]).filter(Boolean))] : [GUIDA_STORICA[sezione.id]].filter(Boolean);
  return chiavi.map((k) => GUIDE[k]).join('\n\n');
}

export const SCHEMA_SEZIONE = {
  type: 'object', additionalProperties: false, required: ['criteri', 'sintesi'],
  properties: {
    criteri: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'punteggio', 'rigoroso', 'valore', 'motivazione', 'evidenze', 'criticita', 'miglioramenti'],
        properties: {
          id: { type: 'string' },
          punteggio: { type: 'number' },
          rigoroso: { type: 'number' },
          valore: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          motivazione: { type: 'string' },
          evidenze: { type: 'array', items: { type: 'string' } },
          criticita: { type: 'array', items: { type: 'string' } },
          miglioramenti: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, required: ['azione', 'punti'], properties: { azione: { type: 'string' }, punti: { type: 'number' } } },
          },
        },
      },
    },
    sintesi: { type: 'string' },
  },
};

const FORMATO_SEZIONE = `Rispondi soltanto con un oggetto JSON, senza testo prima o dopo, in questa forma:
{"criteri":[{"id":"<codice criterio>","punteggio":<punteggio atteso>,"rigoroso":<punti nella lettura rigorosa>,"valore":<numero o null>,"motivazione":"<3-6 frasi: che cosa giustifica il punteggio atteso e che cosa lo separa dalla lettura rigorosa>","evidenze":["<riferimento puntuale a un documento>"],"criticita":["<che cosa abbassa il punteggio>"],"miglioramenti":[{"azione":"<intervento concreto fattibile prima dell'invio>","punti":<punti che potrebbe far guadagnare su questo criterio>}]}],"sintesi":"<2-3 frasi sul giudizio complessivo della sezione>"}
«valore» serve solo per i criteri a fasce, altrimenti null. Al massimo tre evidenze, tre criticità e tre miglioramenti per criterio; se non c'è nulla di utile da dire lascia l'elenco vuoto.`;

export function promptSezione({ bando, categoriaId, anno, sezione, documenti, dati, commissario, ancore = '' }) {
  const criteri = sezione.criteri.filter((c) => c.tipo !== 'fasce' || c.giudizio);
  return {
    system: sistemaCommissione(bando, categoriaId, sezione, ancore),
    documenti: `DATI DICHIARATI NEL DOSSIER\n${riepilogoDati(bando, categoriaId, anno, dati)}\n\nDOCUMENTI DEL DOSSIER RILEVANTI PER LA SEZIONE ${sezione.id}\n${blocchiDocumenti(documenti) || '(nessun documento leggibile)'}`,
    compito: `Il tuo profilo in Commissione: ${commissario.nome} — ${commissario.descrizione}

${guidaSezione(sezione)}

Valuta i criteri ${criteri.map((c) => c.id).join(', ')} della sezione ${sezione.id}, uno per uno, con la sensibilità del tuo profilo.

${FORMATO_SEZIONE}`,
    schema: SCHEMA_SEZIONE,
  };
}

export const SCHEMA_VERIFICA = {
  type: 'object', additionalProperties: false, required: ['controlli', 'sintesi'],
  properties: {
    controlli: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['titolo', 'esito', 'dettaglio', 'azione'],
        properties: {
          titolo: { type: 'string' },
          esito: { type: 'string', enum: ['ok', 'attenzione', 'critico'] },
          dettaglio: { type: 'string' },
          azione: { type: 'string' },
        },
      },
    },
    sintesi: { type: 'string' },
  },
};

export function promptVerifica({ bando, categoriaId, anno, documenti, tutti, dati }) {
  const cat = getCategoria(bando, categoriaId);
  const finestra = (bando.finestre || []).find((f) => f.anno === anno);
  const inventario = tutti.map((d) => `- ${d.nome} — classificato come: ${tipoPerId(d.tipo).nome}${d.pagine ? ` — ${d.pagine} pagine` : ''}${d.testo ? '' : ' — contenuto non leggibile'}`).join('\n');
  return {
    system: `Sei il funzionario istruttore che verifica ricevibilità e ammissibilità delle istanze dell'avviso «${bando.nome}» (${bando.ente}) prima che passino alla Commissione.

Questa è una verifica preventiva chiesta dal produttore: vuole trovare adesso, prima dell'invio, tutto ciò che causerebbe esclusione, richieste di chiarimento o perdita di punteggio. Il soccorso istruttorio non sana moduli incompleti né documenti mancanti, quindi ogni lacuna conta.

Regole di riferimento
- Categoria: «${cat.nome}». Contributo massimo: ${cat.contributo.percentuale}% del costo di produzione${cat.contributo.massimali?.[anno] ? `, fino a ${euro(cat.contributo.massimali[anno])}` : ''}. ${bando.spesaTerritorioMinPct ? `Spesa ammissibile sul territorio: almeno ${bando.spesaTerritorioMinPct}% del contributo richiesto.` : ''}${cat.durataMin ? ` Durata minima ${cat.durataMin} minuti.` : ''}${cat.durataMaxEsclusa ? ` Durata inferiore a ${cat.durataMaxEsclusa} minuti.` : ''}
${finestra ? `- Finestra di presentazione ${anno}: dal ${finestra.dal} al ${finestra.al}.` : ''}
${bando.invio ? `- Invio: ${bando.invio.canale} a ${bando.invio.indirizzo}, in un unico invio.` : ''}
- Allegati previsti dal bando:
${(bando.allegati || []).map((a) => `  · ${a.nome} [${a.obbligo === 'sempre' ? 'obbligatorio' : a.obbligo === 'green' ? 'obbligatorio per film e serie TV non in animazione' : a.obbligo === 'se_dichiarato' ? 'obbligatorio se l’accordo o la fonte è dichiarata' : 'non obbligatorio ma incide sul punteggio'}]`).join('\n')}
- Requisiti dichiarativi:
${(bando.requisiti || []).map((r) => `  · ${r.testo}`).join('\n')}
${cat.greenFilm && !dati?.animazione ? `- Certificazione ambientale (requisito di ammissibilità per questa categoria): serve un contratto o un accordo pre-contrattuale per ottenere la certificazione Green Film o equivalente. Nella prassi è stata accettata la domanda di abilitazione all'uso del marchio Green Film firmata dal legale rappresentante, con la scheda di scelta dei criteri e l'organismo di verifica indicato. Se c'è, controlla: firma e data; organismo di verifica indicato; titolo, date e luoghi di ripresa coerenti con i moduli; prerequisiti spuntati; punti dichiarati almeno pari al minimo (${MINIMO_GREEN} con il disciplinare Edizione 03 – 2024, ${EDIZIONE_PRECEDENTE.minimo} con l'edizione precedente; ${RIDUZIONE_EMAS} in meno se la società è registrata EMAS). Una scheda compilata sull'edizione precedente è da «attenzione», non da «critico»: il bando chiede l'accordo, non una certa edizione. A rendiconto andrà documentata la certificazione ottenuta.\n` : ''}${(bando.note || []).map((n) => `- ${n}`).join('\n')}${bando.moduli ? `\n\nSTRUTTURA DEI MODULI UFFICIALI (che cosa deve contenere ogni modulo compilato)\n${bando.moduli}` : ''}${testiUfficiali(bando, 'V')}${blocchiConoscenza(bando)}`,
    documenti: `DATI CHIAVE GIÀ ESTRATTI\n${riepilogoDati(bando, categoriaId, anno, dati)}\n\nINVENTARIO DEI FILE CARICATI\n${inventario || '(nessun file)'}\n\nMODULI DEL DOSSIER\n${blocchiDocumenti(documenti) || '(nessun modulo leggibile)'}`,
    compito: `Controlla il dossier come farebbe l'istruttore e segnala soltanto ciò che trovi davvero nei documenti:
- campi obbligatori dei moduli vuoti o compilati a metà, dichiarazioni non spuntate, firme o date mancanti;
- incoerenze tra i moduli di domanda e con gli altri documenti: titolo, durata, costi, contributo richiesto, date, nomi, numeri di professionisti, giorni di lavorazione;
- accordi o fonti dichiarati nei moduli senza il documento corrispondente tra i file caricati, e viceversa;
- violazioni di limiti e requisiti del bando;
- errori materiali che darebbero una cattiva impressione alla Commissione.
Non ripetere i controlli puramente aritmetici (percentuali, tetti, quadratura): quelli li calcola già il sistema. Se un modulo non è stato caricato dillo in un solo controllo.

Rispondi soltanto con un oggetto JSON in questa forma:
{"controlli":[{"titolo":"<breve>","esito":"ok|attenzione|critico","dettaglio":"<che cosa hai trovato e dove>","azione":"<che cosa fare prima dell'invio; stringa vuota se esito ok>"}],"sintesi":"<2-3 frasi>"}
«critico» = solo ciò che l'avviso sanziona espressamente con irricevibilità, inammissibilità o revoca: allegato obbligatorio assente, modulistica diversa da quella ufficiale, istanza fuori dalla finestra, requisito soggettivo mancante, limiti di contributo o di spesa sul territorio violati. «attenzione» = tutto il resto che va sistemato o chiarito: campi vuoti, incongruenze tra i moduli, denominazioni difformi, documenti deboli nella forma. Nella prassi dossier con incongruenze formali tra i moduli sono stati ammessi e finanziati: non presentarle come cause di esclusione, ma spiega che cosa correggere. «ok» = verificato e a posto (al massimo tre voci ok, le più importanti). Al massimo quindici controlli, dal più grave.`,
    schema: SCHEMA_VERIFICA,
  };
}

const NUM = { anyOf: [{ type: 'number' }, { type: 'null' }] };
export const SCHEMA_ESTRAZIONE = {
  type: 'object', additionalProperties: false,
  required: ['titolo', 'tipologiaOpera', 'durataMin', 'giorni', 'professionisti', 'economici', 'piano', 'ripreseIniziate', 'note'],
  properties: {
    titolo: { type: 'string' }, tipologiaOpera: { type: 'string' }, durataMin: NUM,
    giorni: { type: 'object', additionalProperties: false, required: ['prepTot', 'prepSicilia', 'ripreseTot', 'ripreseSicilia', 'postTot', 'postSicilia'], properties: { prepTot: NUM, prepSicilia: NUM, ripreseTot: NUM, ripreseSicilia: NUM, postTot: NUM, postSicilia: NUM } },
    professionisti: { type: 'object', additionalProperties: false, required: ['artTot', 'artSicilia', 'crewTot', 'crewSicilia'], properties: { artTot: NUM, artSicilia: NUM, crewTot: NUM, crewSicilia: NUM } },
    economici: { type: 'object', additionalProperties: false, required: ['costoProduzione', 'costoAmmissibile', 'contributoRichiesto', 'spesaSicilia', 'producerFee'], properties: { costoProduzione: NUM, costoAmmissibile: NUM, contributoRichiesto: NUM, spesaSicilia: NUM, producerFee: NUM } },
    piano: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['voce', 'etichetta', 'denominazione', 'importo', 'documento'],
        properties: { voce: { type: 'string' }, etichetta: { type: 'string' }, denominazione: { type: 'string' }, importo: { type: 'number' }, documento: { type: 'string', enum: ['contratto', 'deal_memo', 'delibera', 'referenze', 'nessuno'] } },
      },
    },
    ripreseIniziate: { type: 'boolean' },
    note: { type: 'array', items: { type: 'string' } },
  },
};

export function promptEstrazione({ bando, documenti }) {
  const terr = bando.territorio || 'regione';
  return {
    system: `Estrai dati numerici da un dossier di candidatura all'avviso «${bando.nome}». I dati alimentano un calcolo automatico di punteggio: conta l'esattezza, non la completezza. Riporta un valore solo se è scritto nei documenti; se manca o è ambiguo usa null e spiega in «note» che cosa manca.`,
    documenti: `DOCUMENTI\n${blocchiDocumenti(documenti)}`,
    compito: `Estrai i dati chiave del progetto.
- giorni: durata in giorni di pre-produzione, riprese e post-produzione, totali e svolti in ${terr} (campi con suffisso «Sicilia» = giorni nel territorio del bando).
- professionisti: numero totale e numero di nati o residenti in ${terr} da almeno sei mesi, per componente artistica (art) e cast tecnico (crew). Figuranti e comparse non contano.
- economici: importi in euro senza IVA. «spesaSicilia» è la spesa ammissibile sostenuta in ${terr}.
- piano: una riga per ogni fonte del piano finanziario. «voce» è il codice del modulo se presente (1.1 = contributo richiesto con questo bando, 1.2 = tax credit, 2.1 = apporto del proponente…), altrimenti stringa vuota. «documento» è il tipo di documento che la sostiene DAVVERO tra quelli che leggi: contratto, deal_memo, delibera (atto di concessione pubblico), referenze (referenze bancarie), nessuno.
- ripreseIniziate: true solo se un documento attesta che le riprese in ${terr} sono già cominciate.

Rispondi soltanto con un oggetto JSON in questa forma:
{"titolo":"","tipologiaOpera":"","durataMin":null,"giorni":{"prepTot":null,"prepSicilia":null,"ripreseTot":null,"ripreseSicilia":null,"postTot":null,"postSicilia":null},"professionisti":{"artTot":null,"artSicilia":null,"crewTot":null,"crewSicilia":null},"economici":{"costoProduzione":null,"costoAmmissibile":null,"contributoRichiesto":null,"spesaSicilia":null,"producerFee":null},"piano":[{"voce":"","etichetta":"","denominazione":"","importo":0,"documento":"nessuno"}],"ripreseIniziate":false,"note":[""]}`,
    schema: SCHEMA_ESTRAZIONE,
  };
}

export function promptCondensa({ documento, parte, parti, testo }) {
  return {
    system: 'Prepari schede di lettura per una commissione che valuta progetti cinematografici. La scheda sostituisce il testo integrale, che è troppo lungo per essere letto in una sola volta: deve permettere di giudicare originalità, qualità della scrittura, personaggi, struttura e legame con il territorio senza avere il testo davanti.',
    documenti: `TESTO — «${documento.nome}», parte ${parte} di ${parti}\n${testo}`,
    compito: `Scrivi la scheda di lettura di questa parte, in italiano, in non più di 9.000 caratteri:
1. sviluppo della storia scena per scena, in forma compatta, con numeri di scena o pagina;
2. personaggi: chi sono, che cosa vogliono, come cambiano in questa parte;
3. qualità della scrittura: riporta alla lettera 4-6 estratti rappresentativi (battute di dialogo e descrizioni), nel bene e nel male;
4. luoghi, ambientazione e riferimenti a storia, cultura, paesaggio e tradizioni del territorio;
5. debolezze evidenti: lungaggini, scene deboli, dialoghi didascalici, incongruenze.
Scrivi soltanto la scheda.`,
    schema: null,
  };
}

export const METRICHE_DISPONIBILI = Object.fromEntries(Object.entries(METRICHE).map(([k, v]) => [k, v.descrizione]));
export { FAMIGLIE };

export function promptBando({ testo, nomeFile }) {
  return {
    system: 'Trasformi il testo di un bando pubblico italiano per il cinema e l’audiovisivo in una griglia di valutazione strutturata, fedele al testo: punteggi, soglie e fasce devono essere quelli scritti nel bando, senza arrotondamenti né integrazioni. Quello che il bando non dice lo lasci vuoto.',
    documenti: `TESTO DEL BANDO — «${nomeFile}»\n${testo}`,
    compito: `Estrai la griglia di valutazione e i dati essenziali del bando.

Rispondi soltanto con un oggetto JSON con questa struttura:
{
 "nome": "<nome breve del bando con regione e anni>",
 "ente": "<ente che lo emana>",
 "regione": "<regione>",
 "territorio": "<nome del territorio su cui si misura l'impatto, es. Sicilia>",
 "fonte": "<titolo e data dell'atto>",
 "sogliaTotale": <punteggio minimo complessivo o 0>,
 "punteggioMassimo": <di solito 100>,
 "spesaTerritorioMinPct": <spesa minima sul territorio in % del contributo, o 0>,
 "commissione": {"descrizione": "<composizione e regola di calcolo dei punteggi>"},
 "finestre": [{"anno": 2027, "dal": "AAAA-MM-GG", "al": "AAAA-MM-GG"}],
 "invio": {"canale": "", "indirizzo": "", "oggetto": ""},
 "categorie": [{"id": "<slug>", "nome": "", "griglia": "<id griglia>", "soglie": {"<id sezione>": <minimo>}, "contributo": {"percentuale": <% massima sul costo>, "massimali": {"<anno>": <euro>}}, "durataMin": <minuti o null>, "durataMaxEsclusa": <minuti o null>, "greenFilm": <true se è richiesta una certificazione ambientale>, "testoQualita": "sceneggiatura|trattamento"}],
 "griglie": {"<id griglia>": {"id": "<id griglia>", "nome": "", "sezioni": [{"id": "<lettera>", "nome": "", "max": <punti>, "criteri": [<criterio>]}]}},
 "allegati": [{"tipo": "<uno tra: modulo1, modulo2, modulo3, identita, sceneggiatura, cv_societa, cv_regista, cv_autori, cv_artistico, cv_tecnico, accordi_cast, coproduzione, distribuzione, finanziamenti, referenze_bancarie, finanziatori_esterni, produttore_esecutivo, green_film, piano_lavorazione, altro>", "nome": "", "obbligo": "sempre|se_dichiarato|punteggio|consigliato"}],
 "requisiti": [{"id": "<slug>", "testo": "<requisito di ammissibilità da confermare a mano>"}],
 "note": ["<regole importanti per chi presenta domanda>"]
}

Ogni <criterio> ha una di queste tre forme:
- qualitativo: {"id": "1.1", "nome": "", "max": <punti>, "tipo": "qualitativo", "famiglia": "<vedi sotto>", "descrizione": "<testo del bando>", "principio": "<eventuali regole di attribuzione>"}
- discreto, quando il bando prevede solo punteggi fissi: {"id": "", "nome": "", "max": <punti>, "tipo": "discreto", "descrizione": "", "valori": [{"punti": <n>, "etichetta": "<condizione>"}]}
- a fasce, quando il punteggio dipende da una percentuale calcolabile: {"id": "", "nome": "", "max": <punti>, "tipo": "fasce", "metrica": "<una delle metriche sotto>", "peso": <moltiplicatore>, "descrizione": "", "fasce": [{"oltre": <soglia % esclusa> oppure "da": <soglia % inclusa>, "punti": <punti prima del peso>, "etichetta": "<testo della fascia>"}]}
  Le fasce vanno dalla migliore alla peggiore; l'ultima ha "da": 0. Il punteggio del criterio è punti × peso (se il bando indica direttamente i punti finali usa peso 1). Aggiungi "giudizio": true se la percentuale richiede una valutazione dei documenti (per esempio la copertura finanziaria).
  Metriche disponibili: ${Object.entries(METRICHE_DISPONIBILI).map(([k, v]) => `${k} = ${v}`).join('; ')}.
  Le soglie delle fasce sono nella stessa unità della metrica (percentuale, giorni, numero o euro).
  Se un criterio numerico non corrisponde a nessuna di queste metriche, trattalo come qualitativo e scrivi la regola di calcolo in "principio".
Ogni criterio, di qualunque forma, ha anche "famiglia": una tra ${Object.entries(FAMIGLIE).map(([k, v]) => `${k} (${v})`).join('; ')}.

Se il bando ha griglie diverse per tipologie di opera, crea una griglia per ciascuna. La somma dei massimi dei criteri deve coincidere con il massimo della sezione.`,
    schema: null,
  };
}

const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

// Controlla e completa una griglia estratta da Claude; restituisce { bando, avvisi }.
export function normalizzaBando(grezzo, nomeFile) {
  const avvisi = [];
  if (!grezzo || typeof grezzo !== 'object' || !grezzo.griglie || !Array.isArray(grezzo.categorie)) throw new Error('La risposta non contiene una griglia di valutazione riconoscibile.');
  const b = {
    id: `${slug(grezzo.nome || nomeFile) || 'bando'}-${Date.now().toString(36)}`,
    nome: grezzo.nome || nomeFile, nomeBreve: grezzo.nome || nomeFile, ente: grezzo.ente || '', regione: grezzo.regione || '',
    territorio: grezzo.territorio || grezzo.regione || 'regione', fonte: grezzo.fonte || nomeFile,
    verificato: false, predefinito: false,
    sogliaTotale: Number(grezzo.sogliaTotale) || 0, punteggioMassimo: Number(grezzo.punteggioMassimo) || 100,
    spesaTerritorioMinPct: Number(grezzo.spesaTerritorioMinPct) || 0,
    commissione: { descrizione: grezzo.commissione?.descrizione || '' },
    finestre: Array.isArray(grezzo.finestre) ? grezzo.finestre.filter((f) => f && f.anno) : [],
    invio: grezzo.invio?.indirizzo ? grezzo.invio : null,
    categorie: [], griglie: {},
    allegati: Array.isArray(grezzo.allegati) ? grezzo.allegati.filter((a) => a?.tipo && a?.nome) : [],
    requisiti: Array.isArray(grezzo.requisiti) ? grezzo.requisiti.filter((r) => r?.testo).map((r, i) => ({ id: slug(r.id) || `r${i}`, testo: r.testo })) : [],
    note: Array.isArray(grezzo.note) ? grezzo.note.filter(Boolean) : [],
    conoscenza: [],
  };
  for (const [gid, g] of Object.entries(grezzo.griglie)) {
    const sezioni = (g.sezioni || []).map((s) => {
      const criteri = (s.criteri || []).map((c) => {
        const out = { id: String(c.id), nome: c.nome || String(c.id), max: Number(c.max) || 0, tipo: c.tipo, famiglia: FAMIGLIE[c.famiglia] ? c.famiglia : 'altro', descrizione: c.descrizione || '', principio: [c.principio, c.calcolo && `Regola di calcolo: ${c.calcolo}`].filter(Boolean).join(' ') || undefined };
        if (c.tipo === 'fasce' && METRICHE_DISPONIBILI[c.metrica] && Array.isArray(c.fasce) && c.fasce.length) {
          out.metrica = c.metrica; out.peso = Number(c.peso) || 1; out.giudizio = !!c.giudizio;
          out.fasce = c.fasce.map((f) => ({ ...(f.oltre != null ? { oltre: Number(f.oltre) } : { da: Number(f.da) || 0 }), punti: Number(f.punti) || 0, etichetta: f.etichetta || '' }));
          const top = Math.max(...out.fasce.map((f) => f.punti)) * out.peso;
          if (Math.abs(top - out.max) > 0.05) avvisi.push(`Criterio ${out.id}: la fascia più alta vale ${fmt(top)} ma il massimo è ${fmt(out.max)}.`);
        } else if (c.tipo === 'discreto' && Array.isArray(c.valori) && c.valori.length) {
          out.valori = c.valori.map((v) => ({ punti: Number(v.punti) || 0, etichetta: v.etichetta || '' })).sort((x, y) => y.punti - x.punti);
        } else {
          if (c.tipo !== 'qualitativo') avvisi.push(`Criterio ${out.id}: trattato come qualitativo.`);
          out.tipo = 'qualitativo';
        }
        return out;
      });
      const somma = criteri.reduce((a, c) => a + c.max, 0), max = Number(s.max) || somma;
      if (Math.abs(somma - max) > 0.05) avvisi.push(`Sezione ${s.id}: i criteri sommano a ${fmt(somma)}, il massimo dichiarato è ${fmt(max)}.`);
      return { id: String(s.id), nome: s.nome || String(s.id), max, criteri };
    }).filter((s) => s.criteri.length);
    if (sezioni.length) b.griglie[gid] = { id: gid, nome: g.nome || gid, sezioni };
  }
  if (!Object.keys(b.griglie).length) throw new Error('Nessuna griglia con criteri trovata nel documento.');
  for (const c of grezzo.categorie) {
    const griglia = b.griglie[c.griglia] ? c.griglia : Object.keys(b.griglie)[0];
    b.categorie.push({
      id: slug(c.id || c.nome) || `cat${b.categorie.length}`, nome: c.nome || 'Categoria', griglia,
      soglie: c.soglie && typeof c.soglie === 'object' ? c.soglie : {},
      contributo: { percentuale: Number(c.contributo?.percentuale) || 100, massimali: c.contributo?.massimali || {} },
      durataMin: c.durataMin || null, durataMaxEsclusa: c.durataMaxEsclusa || null, greenFilm: !!c.greenFilm, testoQualita: c.testoQualita || 'sceneggiatura',
    });
  }
  if (!b.categorie.length) b.categorie.push({ id: 'unica', nome: 'Tutte le opere', griglia: Object.keys(b.griglie)[0], soglie: {}, contributo: { percentuale: 100, massimali: {} } });
  for (const g of Object.values(b.griglie)) {
    const tot = g.sezioni.reduce((a, s) => a + s.max, 0);
    if (Math.abs(tot - b.punteggioMassimo) > 0.05) avvisi.push(`Griglia ${g.id}: le sezioni sommano a ${fmt(tot)} su ${b.punteggioMassimo}.`);
  }
  // La risposta di Claude (anche su un avviso scaricato in automatico) passa dalla stessa pulizia dei bandi del catalogo:
  // date vere, numeri veri (un massimale «300.000» scritto come testo non diventa 300 €), testi brevi, tipi di allegato noti.
  const pulito = sanificaBando(b);
  for (const k of ['nome', 'nomeBreve', 'ente', 'regione', 'territorio', 'fonte', 'finestre', 'invio', 'categorie', 'allegati', 'requisiti', 'note', 'griglie']) b[k] = pulito[k];
  b.commissione = { descrizione: pulito.commissione.descrizione };
  return { bando: b, avvisi };
}
