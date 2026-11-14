// Area legale del dossier: domande sul bando con citazione degli articoli, analisi dei contratti
// e degli accordi allegati, bozze di documenti, scadenze. Tutto è ancorato al testo ufficiale dell'avviso.
import { riepilogoDati } from './prompts.js';
import { blocchiDocumenti, tipoPerId, byteLen } from './docs.js';
import { ErroreLlm } from './llm.js';

const TIPI_CONTRATTO = ['accordi_cast', 'coproduzione', 'distribuzione', 'finanziamenti', 'referenze_bancarie', 'finanziatori_esterni', 'produttore_esecutivo', 'green_film'];
export const documentiContrattuali = (documenti) => documenti.filter((d) => d.testo && TIPI_CONTRATTO.includes(d.tipo));

function testoBando(bando) {
  const articoli = (bando.testi || []).map((a) => `### ${a.titolo}\n${a.testo}`).join('\n\n');
  const griglie = Object.values(bando.griglie).map((g) => `${g.nome}\n${g.sezioni.map((s) => `Sezione ${s.id} — ${s.nome} (max ${s.max})\n${s.criteri.map((c) => `  ${c.id} ${c.nome} — max ${c.max}. ${c.descrizione}${c.principio ? ` Principio: ${c.principio}` : ''}${c.fasce ? ` Fasce: ${c.fasce.map((f) => `${f.etichetta} → ${Math.round(f.punti * c.peso * 10) / 10}`).join('; ')}.` : ''}${c.valori ? ` Punteggi: ${c.valori.map((v) => `${v.punti} = ${v.etichetta}`).join('; ')}.` : ''}`).join('\n')}`).join('\n')}`).join('\n\n');
  const extra = (bando.conoscenza || []).filter((k) => k.testo).map((k) => `### Documento aggiuntivo: ${k.nome}\n${k.testo}`).join('\n\n');
  return `TESTO UFFICIALE — ${bando.fonte}\n${articoli || '(il testo integrale di questo bando non è stato caricato: sono disponibili solo la griglia e le note)'}\n\nGRIGLIE DI VALUTAZIONE (art. 10.2)\n${griglie}${bando.moduli ? `\n\nMODULI DEL DOSSIER\n${bando.moduli}` : ''}${(bando.note || []).length ? `\n\nNOTE\n${bando.note.map((n) => `- ${n}`).join('\n')}` : ''}${extra ? `\n\n${extra}` : ''}`;
}

/**
 * Risponde a una domanda sul bando citando gli articoli. storia: [{ domanda, risposta }] (ultimi scambi).
 */
export async function chiediAlBando({ bando, progetto, domanda, storia = [], llm, opzioni, signal, onTesto }) {
  const precedenti = storia.slice(-3).map((s) => `Domanda precedente: ${s.domanda}\nRisposta data: ${s.risposta}`).join('\n\n');
  const p = {
    system: `Sei un consulente legale esperto di fondi pubblici per il cinema e l'audiovisivo. Assisti una società di produzione che sta preparando la candidatura all'avviso «${bando.nome}» (${bando.ente}).

Come rispondere
- Fonda ogni affermazione sul testo ufficiale riportato sotto e cita la fonte tra parentesi subito dopo: articolo e, quando serve, paragrafo o lettera — per esempio (art. 7, lett. c) oppure (art. 10.2, criterio 5.1). Chi legge deve poter aprire l'avviso e ritrovare il punto.
- Se il testo non risponde alla domanda dillo chiaramente. Puoi aggiungere ciò che deriva dalla normativa generale (legge 220/2016, regolamento UE 651/2014, codice civile, prassi contrattuale), ma separalo sotto la dicitura «Fuori dal testo dell'avviso — da verificare»: non hai una banca dati giuridica aggiornata e non devi presentare come certo ciò che non puoi riscontrare.
- Quando il testo è ambiguo, esponi le letture possibili e indica la più prudente.
- Applica la risposta al caso concreto del dossier quando i dati lo permettono.
- Testo semplice in italiano, senza simboli di formattazione: paragrafi brevi, elenchi con trattino. Prima la risposta, poi i dettagli. Chiudi con una riga «In pratica:» che dice che cosa fare.`,
    documenti: `${testoBando(bando)}\n\nDATI DEL DOSSIER IN PREPARAZIONE\n${riepilogoDati(bando, progetto.categoriaId, progetto.anno, progetto.dati)}`,
    compito: `${precedenti ? `${precedenti}\n\n` : ''}Domanda: ${domanda}`,
    schema: null,
  };
  if (byteLen(p.system) + byteLen(p.documenti) + byteLen(p.compito) > llm.limiteByte) throw new ErroreLlm('prompt_too_large', 'La conoscenza aggiuntiva del bando è troppo estesa per questa domanda: rimuovi qualche documento dalla pagina Bandi.');
  const r = await llm.chiama({ ...p, modello: opzioni.modello, impegno: opzioni.impegno || 'high', signal, onTesto });
  return { risposta: r.testo.trim(), modello: r.modello };
}

const LISTA = { type: 'array', items: { type: 'string' } };
export const SCHEMA_CONTRATTI = {
  type: 'object', additionalProperties: false, required: ['documenti', 'sintesi'],
  properties: {
    documenti: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['file', 'natura', 'parti', 'oggetto', 'importo', 'data', 'firmato', 'criteri', 'idoneo', 'motivazione', 'rischi', 'correzioni'],
        properties: {
          file: { type: 'string' }, natura: { type: 'string' }, parti: LISTA, oggetto: { type: 'string' }, importo: { type: 'string' }, data: { type: 'string' },
          firmato: { type: 'string', enum: ['si', 'no', 'non_verificabile'] }, criteri: LISTA,
          idoneo: { type: 'string', enum: ['si', 'parziale', 'no'] }, motivazione: { type: 'string' }, rischi: LISTA, correzioni: LISTA,
        },
      },
    },
    sintesi: { type: 'string' },
  },
};

/** Esamina contratti, deal memo, lettere di intento e atti allegati rispetto a ciò che il bando richiede. */
export async function analizzaContratti({ bando, progetto, llm, opzioni, signal, onTesto }) {
  const docs = documentiContrattuali(progetto.documenti);
  if (!docs.length) throw new ErroreLlm('nessun_documento', 'Nel dossier non ci sono contratti, deal memo, lettere di intento o atti da esaminare.');
  const articoli = (bando.testi || []).filter((a) => ['art5', 'art6', 'art7', 'art8', 'art10', 'art12', 'art18'].includes(a.id)).map((a) => `### ${a.titolo}\n${a.testo}`).join('\n\n');
  const costruisci = (lista) => ({
    system: `Sei un avvocato esperto di contratti cinematografici e di fondi pubblici. Esamini gli accordi allegati a un dossier per l'avviso «${bando.nome}» prima dell'invio.

Per ogni documento devi dire se, così com'è, regge davanti alla Commissione e che cosa gli manca. La Commissione dà punteggio solo a ciò che è documentato, firmato e riferibile a controparti credibili; un accordo vago o non firmato vale zero, e una dichiarazione inesatta è causa di revoca.

Che cosa guardare
- Natura dell'atto (contratto, deal memo, lettera di intento, atto di concessione, referenza bancaria) e parti: sono identificate con ragione sociale e ruolo?
- Oggetto, titolo dell'opera, importi, date, durata, condizioni sospensive: sono determinati? Coincidono con i dati del dossier?
- Sottoscrizione: il testo riporta firme di tutte le parti e data? Se dal testo non si capisce, scrivi non_verificabile.
- Quale criterio di punteggio sostiene (per esempio 3.2, 3.3, 5.1, 5.2, 5.3) e se soddisfa il relativo principio di attribuzione: controparte qualificata, referenze bancarie riferite allo specifico budget, contributi pubblici già concessi con atto formale, distributore con almeno tre film distribuiti negli ultimi cinque anni.
- Clausole che possono creare problemi con il bando: cessione dei diritti di sfruttamento, quota del proponente sotto il 20%, condizioni che svuotano l'impegno, importi diversi da quelli del piano finanziario.

REGOLE DELL'AVVISO
${articoli || (bando.note || []).join('\n')}

CRITERI INTERESSATI
${Object.values(bando.griglie).slice(0, 1).flatMap((g) => g.sezioni).flatMap((s) => s.criteri).filter((c) => c.principio).map((c) => `${c.id} ${c.nome}: ${c.principio}`).join('\n')}`,
    documenti: `DATI DEL DOSSIER\n${riepilogoDati(bando, progetto.categoriaId, progetto.anno, progetto.dati)}\n\nDOCUMENTI DA ESAMINARE\n${blocchiDocumenti(lista)}`,
    compito: `Esamina ciascuno dei ${lista.length} documenti.

Rispondi soltanto con un oggetto JSON in questa forma:
{"documenti":[{"file":"<nome del file>","natura":"<tipo di atto>","parti":["<parte e ruolo>"],"oggetto":"<in una frase>","importo":"<importo o stringa vuota>","data":"<data o stringa vuota>","firmato":"si|no|non_verificabile","criteri":["<codici dei criteri che sostiene>"],"idoneo":"si|parziale|no","motivazione":"<perché, in 2-4 frasi>","rischi":["<problema concreto>"],"correzioni":["<che cosa cambiare o aggiungere prima dell'invio>"]}],"sintesi":"<2-3 frasi sul quadro complessivo>"}
«idoneo» dice se il documento, così com'è, produce l'effetto per cui è allegato. Al massimo quattro rischi e quattro correzioni per documento.`,
    schema: SCHEMA_CONTRATTI,
  });
  // se i documenti non entrano in una lettura si procede a gruppi
  const gruppi = []; let corrente = [];
  for (const d of docs) {
    const prova = [...corrente, d], p = costruisci(prova);
    if (corrente.length && byteLen(p.system) + byteLen(p.documenti) + byteLen(p.compito) > llm.limiteByte) { gruppi.push(corrente); corrente = [d]; } else corrente = prova;
  }
  if (corrente.length) gruppi.push(corrente);
  const esiti = [], sintesi = [];
  for (const g of gruppi) {
    const p = costruisci(g);
    if (byteLen(p.system) + byteLen(p.documenti) + byteLen(p.compito) > llm.limiteByte) throw new ErroreLlm('prompt_too_large', `«${g[0].nome}» è troppo lungo per essere esaminato con questo collegamento.`);
    const r = await llm.chiama({ ...p, modello: opzioni.modello, impegno: opzioni.impegno || 'high', signal, onTesto });
    for (const x of Array.isArray(r.json?.documenti) ? r.json.documenti : []) {
      if (!x || !x.file) continue;
      const originale = g.find((d) => d.nome === x.file) || g.find((d) => String(x.file).includes(d.nome) || d.nome.includes(String(x.file)));
      esiti.push({
        file: originale?.nome || String(x.file), tipo: originale ? tipoPerId(originale.tipo).nome : '', natura: String(x.natura || ''), parti: (x.parti || []).map(String).filter(Boolean),
        oggetto: String(x.oggetto || ''), importo: String(x.importo || ''), data: String(x.data || ''),
        firmato: ['si', 'no', 'non_verificabile'].includes(x.firmato) ? x.firmato : 'non_verificabile',
        criteri: (x.criteri || []).map(String).filter(Boolean), idoneo: ['si', 'parziale', 'no'].includes(x.idoneo) ? x.idoneo : 'parziale',
        motivazione: String(x.motivazione || ''), rischi: (x.rischi || []).map(String).filter(Boolean).slice(0, 4), correzioni: (x.correzioni || []).map(String).filter(Boolean).slice(0, 4),
      });
    }
    if (r.json?.sintesi) sintesi.push(String(r.json.sintesi));
  }
  if (!esiti.length) throw new ErroreLlm('invalid_json', 'L’analisi non ha prodotto risultati leggibili. Riprova.');
  return { data: new Date().toISOString(), documenti: esiti, sintesi: sintesi.join(' ') };
}

export const MODELLI_BOZZA = [
  { id: 'lettera_intento', nome: 'Lettera di intento con artista o tecnico', guida: 'Nome e ruolo del professionista (es. direttore della fotografia), periodo di impegno, eventuale compenso o rinvio a contratto successivo.', criteri: '3.2 e 3.3: senza un accordo sottoscritto la figura non genera punteggio' },
  { id: 'deal_memo_distribuzione', nome: 'Deal memo di distribuzione', guida: 'Distributore o emittente, diritti e territori, minimo garantito o prezzo di prevendita, tempi di uscita o messa in onda.', criteri: '5.2 e 5.1: vale solo con distributore qualificato o broadcaster nazionale' },
  { id: 'deal_memo_coproduzione', nome: 'Deal memo di coproduzione', guida: 'Coproduttore, quote, apporto in denaro, ripartizione dei diritti, chi presenta l’istanza.', criteri: '5.1 e 5.3: il proponente deve mantenere almeno il 20%' },
  { id: 'richiesta_referenze', nome: 'Richiesta di referenze bancarie alla banca', guida: 'Banca e filiale, importo dell’apporto proprio da coprire, titolo dell’opera e budget complessivo.', criteri: '5.1: le risorse proprie contano solo con referenze riferite allo specifico budget' },
  { id: 'accordo_green', nome: 'Accordo pre-contrattuale per la certificazione Green Film', guida: 'Organismo di certificazione accreditato, protocollo, tempi.', criteri: 'art. 5.2: requisito di ammissibilità per film e serie TV non in animazione' },
];

/** Bozza di un documento da far firmare, coerente con ciò che il bando richiede per attribuire punteggio. */
export async function redigiBozza({ bando, progetto, tipo, indicazioni, llm, opzioni, signal, onTesto }) {
  const modello = MODELLI_BOZZA.find((m) => m.id === tipo) || MODELLI_BOZZA[0];
  const articoli = (bando.testi || []).filter((a) => ['art5', 'art10', 'art12'].includes(a.id)).map((a) => `### ${a.titolo}\n${a.testo}`).join('\n\n');
  const r = await llm.chiama({
    system: `Sei un avvocato esperto di contratti cinematografici. Prepari bozze di documenti che una società di produzione farà firmare e allegherà al dossier per l'avviso «${bando.nome}».

La bozza deve essere pronta da completare e firmare, e scritta in modo che la Commissione le riconosca valore: parti identificate, opera indicata per titolo, impegni determinati (oggetto, importi, tempi), data e spazi per le firme di tutte le parti. Niente formule che svuotano l'impegno. Dove manca un dato scrivi [DA COMPLETARE: che cosa] invece di inventarlo.

Testo semplice in italiano, senza simboli di formattazione. Dopo il documento aggiungi, separata da una riga di trattini, una breve nota «Perché è scritto così» che richiama gli articoli e i criteri dell'avviso a cui la bozza risponde, e che cosa controllare prima della firma.

REGOLE DELL'AVVISO
${articoli || (bando.note || []).join('\n')}`,
    documenti: `DATI DEL DOSSIER\n${riepilogoDati(bando, progetto.categoriaId, progetto.anno, progetto.dati)}`,
    compito: `Documento da redigere: ${modello.nome}.
Rilevanza per il bando: ${modello.criteri}.
Indicazioni della produzione: ${indicazioni?.trim() || '(nessuna: usa i dati del dossier e lascia da completare il resto)'}`,
    schema: null, modello: opzioni.modello, impegno: opzioni.impegno || 'high', signal, onTesto,
  });
  return { tipo: modello.id, nome: modello.nome, testo: r.testo.trim(), data: new Date().toISOString() };
}

const aggiungiMesi = (iso, mesi) => { const d = new Date(`${iso}T12:00:00`); const giorno = d.getDate(); d.setMonth(d.getMonth() + mesi); if (d.getDate() !== giorno) d.setDate(0); return d; };
const aggiungiGiorni = (data, giorni) => { const d = new Date(data); d.setDate(d.getDate() + giorni); return d; };

/** Scadenze che decorrono dalla notifica del decreto di concessione provvisoria (bando.scadenze). */
export function scadenzario(bando, dataNotifica) {
  if (!dataNotifica || !/^\d{4}-\d{2}-\d{2}$/.test(dataNotifica) || !bando.scadenze?.length) return [];
  return bando.scadenze.map((s) => {
    const data = aggiungiMesi(dataNotifica, s.mesi);
    return { ...s, data, preavviso: s.preavvisoGiorni ? aggiungiGiorni(data, -s.preavvisoGiorni) : null };
  });
}
