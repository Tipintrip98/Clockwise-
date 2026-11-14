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
  { id: 'incarico_produttore_esecutivo', nome: 'Deal memo con il produttore esecutivo', guida: 'Società di produzione esecutiva, attività affidate, compenso, periodo, sede operativa sul territorio.', criteri: 'art. 8.2: va allegato con il curriculum se il Modulo III dichiara un produttore esecutivo' },
  { id: 'opzione_diritti', ambito: 'produzione', nome: 'Opzione sui diritti di un’opera (romanzo, soggetto, storia vera)', guida: 'Titolare dei diritti, opera, durata dell’opzione, prezzo dell’opzione e prezzo di acquisto, diritti compresi.', criteri: 'catena dei diritti: senza titolo sui diritti il progetto non è producibile né finanziabile' },
  { id: 'cessione_sceneggiatura', ambito: 'produzione', nome: 'Contratto di scrittura e cessione dei diritti di sceneggiatura', guida: 'Autore, compenso e rate, consegne, diritti ceduti, crediti nei titoli.', criteri: 'catena dei diritti e voce A.1 del budget' },
  { id: 'liberatoria_immagine', ambito: 'produzione', nome: 'Liberatoria per l’uso dell’immagine e della voce', guida: 'Persona ripresa (comparsa, intervistato, non professionista), scene o giornate, compenso o gratuità, utilizzi ammessi.', criteri: 'utilizzabilità delle riprese: documentari, comparse, persone riconoscibili' },
  { id: 'liberatoria_minore', ambito: 'produzione', nome: 'Consenso dei genitori per la partecipazione di un minore', guida: 'Minore e genitori o tutore, ruolo, giornate e orari, accompagnatore, compenso.', criteri: 'minori in scena: va insieme all’autorizzazione dell’Ispettorato del lavoro' },
  { id: 'liberatoria_location', ambito: 'produzione', nome: 'Accordo per l’uso di una location privata', guida: 'Proprietario, immobile, date e orari, corrispettivo, ripristino dei luoghi, assicurazione.', criteri: 'disponibilità dei set dichiarati nel piano di lavorazione' },
  { id: 'liberatoria_marchio', ambito: 'produzione', nome: 'Autorizzazione all’uso di marchi, opere e insegne in scena', guida: 'Titolare, marchio od opera, scene in cui compare, eventuale corrispettivo.', criteri: 'elementi protetti visibili in scena' },
  { id: 'licenza_musica', ambito: 'produzione', nome: 'Richiesta di licenza di sincronizzazione per un brano', guida: 'Brano, autori ed editore, casa discografica, durata dell’utilizzo, scene, territori e mezzi.', criteri: 'musica preesistente: servono i diritti editoriali e quelli sulla registrazione' },
  { id: 'riservatezza', ambito: 'produzione', nome: 'Accordo di riservatezza (NDA)', guida: 'Parti, informazioni riservate (sceneggiatura, budget, trattative), durata.', criteri: 'circolazione di sceneggiatura e dati economici prima della firma dei contratti' },
];

/** Bozza di un documento da far firmare, coerente con ciò che il bando richiede per attribuire punteggio. */
export async function redigiBozza({ bando, progetto, tipo, indicazioni, llm, opzioni, signal, onTesto }) {
  const modello = MODELLI_BOZZA.find((m) => m.id === tipo) || MODELLI_BOZZA[0];
  const articoli = (bando.testi || []).filter((a) => ['art5', 'art10', 'art12'].includes(a.id)).map((a) => `### ${a.titolo}\n${a.testo}`).join('\n\n');
  const r = await llm.chiama({
    system: modello.ambito === 'produzione'
      ? `Sei un avvocato esperto di diritto dello spettacolo e di diritto d'autore in Italia. Prepari bozze di documenti di produzione per una società che sta realizzando un'opera cinematografica o audiovisiva.

La bozza deve essere pronta da completare e firmare: parti identificate con i dati anagrafici o societari, opera indicata per titolo, oggetto determinato, corrispettivo o gratuità espressi, durata, territori e mezzi di utilizzo, data, luogo e spazi per le firme. Dove manca un dato scrivi [DA COMPLETARE: che cosa] invece di inventarlo. Nessuna clausola vessatoria nascosta: ciò che la controparte concede deve essere chiaro a chi firma.

Testo semplice in italiano, senza simboli di formattazione. Dopo il documento aggiungi, separata da una riga di trattini, una breve nota «Da controllare prima della firma»: i punti da far verificare a un legale e le norme di riferimento. Cita una norma solo se sei certo del riferimento; altrimenti indica la materia (per esempio «disciplina del diritto d'autore», «tutela del lavoro dei minori nello spettacolo») e scrivi che il riferimento va verificato.`
      : `Sei un avvocato esperto di contratti cinematografici. Prepari bozze di documenti che una società di produzione farà firmare e allegherà al dossier per l'avviso «${bando.nome}».

La bozza deve essere pronta da completare e firmare, e scritta in modo che la Commissione le riconosca valore: parti identificate, opera indicata per titolo, impegni determinati (oggetto, importi, tempi), data e spazi per le firme di tutte le parti. Niente formule che svuotano l'impegno. Dove manca un dato scrivi [DA COMPLETARE: che cosa] invece di inventarlo.

Testo semplice in italiano, senza simboli di formattazione. Dopo il documento aggiungi, separata da una riga di trattini, una breve nota «Perché è scritto così» che richiama gli articoli e i criteri dell'avviso a cui la bozza risponde, e che cosa controllare prima della firma.

REGOLE DELL'AVVISO
${articoli || (bando.note || []).join('\n')}`,
    documenti: `DATI DEL DOSSIER\n${riepilogoDati(bando, progetto.categoriaId, progetto.anno, progetto.dati)}`,
    compito: `Documento da redigere: ${modello.nome}.
A che cosa serve: ${modello.criteri}.
Indicazioni della produzione: ${indicazioni?.trim() || '(nessuna: usa i dati del dossier e lascia da completare il resto)'}`,
    schema: null, modello: opzioni.modello, impegno: opzioni.impegno || 'high', signal, onTesto,
  });
  return { tipo: modello.id, nome: modello.nome, testo: r.testo.trim(), data: new Date().toISOString() };
}

export const SCHEMA_FASCICOLO = {
  type: 'object', additionalProperties: false, required: ['parti', 'impegni', 'date', 'incongruenze', 'sintesi'],
  properties: {
    parti: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nome', 'ruolo', 'documenti'], properties: { nome: { type: 'string' }, ruolo: { type: 'string' }, documenti: LISTA } } },
    impegni: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['soggetto', 'impegno', 'importo', 'scadenza', 'fonte'], properties: { soggetto: { type: 'string' }, impegno: { type: 'string' }, importo: { type: 'string' }, scadenza: { type: 'string' }, fonte: { type: 'string' } } } },
    date: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['data', 'evento', 'fonte'], properties: { data: { type: 'string' }, evento: { type: 'string' }, fonte: { type: 'string' } } } },
    incongruenze: LISTA, sintesi: { type: 'string' },
  },
};

const TIPI_FASCICOLO = [...TIPI_CONTRATTO, 'modulo1', 'modulo2', 'modulo3'];

/**
 * Fascicolo del progetto: chi sono le parti, chi si è impegnato a fare che cosa ed entro quando, le date
 * chiave e le incongruenze tra un documento e l'altro. Ogni voce indica il file da cui proviene.
 */
export async function costruisciFascicolo({ bando, progetto, llm, opzioni, signal, onTesto }) {
  const docs = progetto.documenti.filter((d) => d.testo && TIPI_FASCICOLO.includes(d.tipo));
  if (!docs.length) throw new ErroreLlm('nessun_documento', 'Per il fascicolo servono i moduli del dossier oppure contratti, deal memo e lettere di intento.');
  const system = `Sei il legale interno di una società di produzione cinematografica. Tieni il fascicolo del progetto: un quadro ordinato di parti, impegni e date ricavato dai documenti, che permetta a chiunque in produzione di sapere chi deve fare che cosa ed entro quando.

Regole
- Riporta solo ciò che i documenti dicono. Per ogni voce indica in «fonte» il nome del file da cui proviene.
- Le date vanno scritte come nel documento; se manca l'anno o il giorno non completarle.
- Un'incongruenza è un dato che due documenti riportano in modo diverso (importi, quote, date, ragioni sociali, titolo dell'opera) oppure un impegno dichiarato in un modulo che non trova riscontro in nessun accordo.`;
  const compito = `Costruisci il fascicolo del progetto.

Rispondi soltanto con un oggetto JSON in questa forma:
{"parti":[{"nome":"<ragione sociale o persona>","ruolo":"<produttore, coproduttore, distributore, regista, banca…>","documenti":["<file in cui compare>"]}],"impegni":[{"soggetto":"<chi si impegna>","impegno":"<che cosa deve fare o dare>","importo":"<importo o stringa vuota>","scadenza":"<entro quando, o stringa vuota>","fonte":"<file>"}],"date":[{"data":"<data come scritta>","evento":"<firma, inizio riprese, consegna, scadenza di un'opzione…>","fonte":"<file>"}],"incongruenze":["<che cosa non torna, con i file coinvolti>"],"sintesi":"<3-4 frasi sullo stato contrattuale del progetto>"}
Al massimo 20 parti, 30 impegni e 30 date: privilegia ciò che conta per la produzione e per il bando «${bando.nomeBreve || bando.nome}».`;
  const dati = `DATI DEL DOSSIER\n${riepilogoDati(bando, progetto.categoriaId, progetto.anno, progetto.dati)}`;
  // se i documenti non entrano tutti, ciascuno viene accorciato in proporzione
  const spazio = llm.limiteByte - byteLen(system) - byteLen(compito) - byteLen(dati) - 4000;
  const totale = docs.reduce((a, d) => a + byteLen(d.testo), 0);
  const ridotti = totale <= spazio ? docs : docs.map((d) => ({ ...d, testo: d.testo.slice(0, Math.max(1500, Math.floor((d.testo.length * spazio) / totale) - 200)) }));
  const r = await llm.chiama({ system, documenti: `${dati}\n\nDOCUMENTI\n${blocchiDocumenti(ridotti)}`, compito, schema: SCHEMA_FASCICOLO, modello: opzioni.modello, impegno: opzioni.impegno || 'high', signal, onTesto });
  const j = r.json || {};
  const testo = (v) => String(v || '').trim();
  const out = {
    data: new Date().toISOString(), ridotto: ridotti !== docs, documenti: docs.map((d) => d.nome),
    parti: (Array.isArray(j.parti) ? j.parti : []).filter((x) => x?.nome).slice(0, 20).map((x) => ({ nome: testo(x.nome), ruolo: testo(x.ruolo), documenti: (x.documenti || []).map(testo).filter(Boolean) })),
    impegni: (Array.isArray(j.impegni) ? j.impegni : []).filter((x) => x?.impegno).slice(0, 30).map((x) => ({ soggetto: testo(x.soggetto), impegno: testo(x.impegno), importo: testo(x.importo), scadenza: testo(x.scadenza), fonte: testo(x.fonte) })),
    date: (Array.isArray(j.date) ? j.date : []).filter((x) => x?.evento).slice(0, 30).map((x) => ({ data: testo(x.data), evento: testo(x.evento), fonte: testo(x.fonte) })),
    incongruenze: (Array.isArray(j.incongruenze) ? j.incongruenze : []).map(testo).filter(Boolean).slice(0, 12),
    sintesi: testo(j.sintesi),
  };
  if (!out.parti.length && !out.impegni.length && !out.date.length) throw new ErroreLlm('invalid_json', 'Il fascicolo non ha prodotto risultati leggibili. Riprova.');
  return out;
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
