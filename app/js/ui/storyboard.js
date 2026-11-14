// Produzione › Storyboard: per ogni scena le inquadrature disegnate da Claude, fedeli alla sceneggiatura.
import { h, metti, svuota, toast, scelta, salvaFile, copiaTesto, nomeFilePulito, bottoneConferma } from './dom.js';
import { S, salva } from './app.js';
import { pagine } from '../core/sceneggiatura.js';
import { STILI, generaStoryboard, testoScena, immagineSvg, schemaInquadratura, nomeCampo, sigla, durataStoryboard, htmlStoryboard, csvInquadrature } from '../core/storyboard.js';
import { serveSpoglio } from './sezioni.js';

const QUANTE = [{ id: 4, nome: 'Fino a 4 per scena' }, { id: 6, nome: 'Fino a 6 per scena' }, { id: 8, nome: 'Fino a 8 per scena' }, { id: 10, nome: 'Fino a 10 per scena' }];
const durata = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)} min ${sec % 60 ? `${sec % 60} s` : ''}`.trim() : `${sec} s`);

// Riduce l'immagine caricata a un fotogramma 16:9 leggero, così il dossier resta salvabile sul dispositivo.
async function fotogramma(file) {
  const bitmap = await createImageBitmap(file);
  const L = 640, A = 360, tela = document.createElement('canvas');
  tela.width = L; tela.height = A;
  const scala = Math.max(L / bitmap.width, A / bitmap.height);
  const l = bitmap.width * scala, a = bitmap.height * scala;
  tela.getContext('2d').drawImage(bitmap, (L - l) / 2, (A - a) / 2, l, a);
  return tela.toDataURL('image/jpeg', 0.82);
}

export function vistaStoryboard(area, ctx, apri) {
  const { p, prod, llm, copioni } = ctx;
  const sp = prod.spoglio;
  if (!sp) { metti(area, serveSpoglio(apri, 'Lo storyboard parte dalle scene individuate nello spoglio e dal testo della sceneggiatura.')); return; }
  prod.storyboard = prod.storyboard || { stile: 'matita', massimo: 6, tavole: {}, note: {} };
  const sb = prod.storyboard;
  sb.tavole = sb.tavole || {}; sb.note = sb.note || {};
  const copione = copioni[0];
  const inCorso = new Set();
  let serie = null; // disegno di tutte le scene, una dopo l'altra

  const tavole = () => sp.scene.filter((s) => sb.tavole[s.numero]).map((s) => ({ scena: s, storyboard: sb.tavole[s.numero] }));

  async function disegnaScena(indice, silenzioso = false) {
    const scena = sp.scene[indice];
    if (inCorso.has(scena.numero)) return false;
    inCorso.add(scena.numero); disegna();
    try {
      sb.tavole[scena.numero] = await generaStoryboard({
        scena, testo: testoScena(copione, sp, indice), titolo: p.dati.titolo || p.nome, stile: sb.stile, massimo: sb.massimo, noteRegia: sb.note[scena.numero] || '',
        llm, opzioni: { modello: S.imp.modello, impegno: S.imp.impegno === 'low' ? 'low' : 'medium' }, signal: serie?.controller.signal,
      });
      await salva(p);
      if (!silenzioso) toast(`Scena ${scena.numero}: ${sb.tavole[scena.numero].inquadrature.length} inquadrature`);
      return true;
    } catch (e) {
      if (!silenzioso || e?.codice !== 'cancelled') toast(e?.codice === 'cancelled' ? 'Disegno interrotto' : `Scena ${scena.numero}: ${e.message || 'disegno non riuscito'}`);
      return false;
    } finally {
      inCorso.delete(scena.numero);
      if (S.progetto?.id === p.id && area.isConnected) disegna();
    }
  }

  async function disegnaTutte() {
    const mancanti = sp.scene.map((s, i) => i).filter((i) => !sb.tavole[sp.scene[i].numero]);
    serie = { controller: new AbortController(), fatto: 0, totale: mancanti.length };
    disegna();
    for (const i of mancanti) {
      if (serie.controller.signal.aborted) break;
      await disegnaScena(i, true);
      serie.fatto++;
    }
    const interrotta = serie.controller.signal.aborted;
    serie = null;
    toast(interrotta ? 'Disegno interrotto: le scene già fatte restano salvate' : 'Storyboard completato');
    if (area.isConnected) disegna();
  }

  function quadro(scena, tavola, q) {
    const ingresso = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
      const file = e.target.files[0]; e.target.value = '';
      if (!file) return;
      try { q.immagine = await fotogramma(file); await salva(p); disegna(); } catch { toast('Immagine non leggibile'); }
    } });
    return h('figure.frame',
      h('div.carta', h('img', { src: q.immagine || immagineSvg(q.svg || schemaInquadratura(q.campo)), alt: `Inquadratura ${sigla(scena.numero, q.n)}: ${q.descrizione}`, loading: 'lazy' }),
        !q.svg && !q.immagine && h('span.tag.x', { style: { position: 'absolute', left: '6px', bottom: '6px' } }, 'schema di composizione')),
      h('figcaption',
        h('div.spread', h('strong.num', sigla(scena.numero, q.n)), h('span.tag.accent', nomeCampo(q.campo)), h('span.muted.small.num', `${q.durata}″`)),
        h('div.muted.small', [q.angolazione, q.movimento, q.ottica].filter(Boolean).join(' · ')),
        h('p.small', q.descrizione),
        q.battuta && h('p.small', { style: { fontStyle: 'italic' } }, q.battuta),
        q.ancorata === true && h('div.small', { style: { color: 'var(--ok)' } }, '✓ ', h('span.muted', `«${q.riferimento}»`)),
        q.ancorata === false && h('div.small', { style: { color: 'var(--warn)' } }, q.riferimento ? `Da verificare: «${q.riferimento}» non è nel testo della scena.` : 'Da verificare: nessun riferimento alla sceneggiatura.'),
        h('div.row.no-print', { style: { gap: '6px', marginTop: '4px' } }, ingresso,
          h('button.btn.s', { type: 'button', onclick: () => copiaTesto(q.prompt, 'Prompt copiato') }, 'Copia prompt'),
          h('button.btn.s', { type: 'button', onclick: () => ingresso.click() }, q.immagine ? 'Cambia immagine' : 'Carica immagine'),
          q.immagine && h('button.btn.s.ghost', { type: 'button', onclick: () => { q.immagine = null; salva(p).then(disegna); } }, 'Torna al bozzetto'),
          h('button.btn.s.ghost', { type: 'button', 'aria-label': `Elimina inquadratura ${sigla(scena.numero, q.n)}`, onclick: () => { tavola.inquadrature = tavola.inquadrature.filter((x) => x !== q).map((x, i) => ({ ...x, n: i + 1 })); if (!tavola.inquadrature.length) delete sb.tavole[scena.numero]; salva(p).then(disegna); } }, '✕'))));
  }

  function disegna() {
    const fatte = tavole();
    const quadri = fatte.reduce((a, t) => a + t.storyboard.inquadrature.length, 0);
    const sec = fatte.reduce((a, t) => a + durataStoryboard(t.storyboard.inquadrature), 0);
    const daVerificare = fatte.reduce((a, t) => a + t.storyboard.inquadrature.filter((q) => q.ancorata === false).length, 0);
    const mancanti = sp.scene.length - fatte.length;
    const aperte = new Set([...area.querySelectorAll('details[open]')].map((d) => d.dataset.scena));
    metti(svuota(area),
      h('div.panel.stack',
        h('div.spread',
          h('div', h('h2', 'Storyboard'),
            h('p.muted', { style: { maxWidth: '74ch', marginTop: '4px' } }, 'Claude traduce ogni scena in inquadrature seguendo la pagina: campo, angolazione, movimento, ottica, un bozzetto e un prompt per i generatori di immagini. Ogni inquadratura cita le parole della sceneggiatura a cui corrisponde, e il programma controlla che ci siano davvero.')),
          fatte.length ? h('div.row',
            h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`storyboard-${p.dati.titolo || p.nome}`, 'html'), htmlStoryboard({ titolo: p.dati.titolo || p.nome, tavole: fatte }), 'text/html') }, 'Scarica storyboard'),
            h('button.btn.s', { type: 'button', onclick: () => salvaFile(nomeFilePulito(`inquadrature-${p.dati.titolo || p.nome}`, 'csv'), csvInquadrature(fatte), 'text/csv') }, 'Elenco inquadrature (CSV)')) : null),
        !llm && h('div.notice.warn', h('strong', 'Claude non è collegato. '), h('a', { href: '#collegamento' }, 'Configura il collegamento'), ' per disegnare le scene.'),
        !copione && h('div.notice.warn', 'La sceneggiatura non è più tra i documenti: lo storyboard userebbe solo la sintesi delle scene. Ricaricala nella scheda Documenti.'),
        copione && !sp.formattata && h('div.notice.warn', 'La sceneggiatura non ha intestazioni di scena riconoscibili: le inquadrature si basano sulla sintesi di ogni scena e il controllo di fedeltà non è disponibile.'),
        h('div.grid.w',
          scelta('Stile del bozzetto', STILI, sb.stile, (v) => { sb.stile = v; salva(p); }, { id: 'sb-stile' }),
          scelta('Inquadrature', QUANTE, sb.massimo, (v) => { sb.massimo = Number(v); salva(p); }, { id: 'sb-massimo' }),
          h('div.box', h('div.label', 'Disegnate'), h('div', h('strong.num', `${fatte.length} / ${sp.scene.length}`), ' scene', quadri ? h('span.muted.small', ` · ${quadri} inquadrature · ${durata(sec)}`) : null))),
        daVerificare ? h('div.notice.warn', `${daVerificare} ${daVerificare === 1 ? 'inquadratura non trova' : 'inquadrature non trovano'} riscontro letterale nella sceneggiatura: controllale, sono segnate in giallo.`) : null,
        serie ? h('div.row', h('span.spin'), h('span', `Disegno delle scene: ${serie.fatto} di ${serie.totale}…`), h('button.btn.s.danger', { type: 'button', onclick: () => serie.controller.abort() }, 'Interrompi'))
          : mancanti && llm ? h('div.row', bottoneConferma(`Disegna le ${mancanti === sp.scene.length ? '' : 'altre '}${mancanti} scene`, `Conferma: ${mancanti} letture di Claude`, disegnaTutte, 'btn.s'),
            h('span.muted.small', 'Una lettura di Claude per scena: per provare, disegna prima una scena sola.')) : null),

      h('div', sp.scene.map((scena, i) => {
        const tavola = sb.tavole[scena.numero];
        const occupata = inCorso.has(scena.numero);
        return h('details.crit', { dataset: { scena: scena.numero }, open: aperte.has(scena.numero) || occupata || (!!tavola && fatte.length === 1) || (!fatte.length && i === 0 && !aperte.size) },
          h('summary', h('span.id', scena.numero), h('span.nm', `${scena.intEst}. ${scena.ambiente}`, h('span.muted', { style: { fontWeight: 400 } }, ` — ${scena.luce} · ${pagine(scena.ottavi)} pag.`)),
            occupata ? h('span.tag.accent', h('span.spin'), 'In disegno') : tavola ? h('span.tag.ok', `${tavola.inquadrature.length} inquadrature`) : h('span.tag.x', 'Da disegnare')),
          h('div.body',
            scena.sinossi && h('p.muted', scena.sinossi),
            h('div.row.no-print',
              h('div.grow', h('input', { type: 'text', id: `sb-note-${i}`, 'aria-label': `Indicazioni di regia per la scena ${scena.numero}`, placeholder: 'Indicazioni di regia facoltative (per esempio: tutta in piano sequenza, camera a mano)', value: sb.note[scena.numero] || '', onchange: (e) => { sb.note[scena.numero] = e.target.value; salva(p); } })),
              h('button.btn.s.primary', { type: 'button', id: `sb-disegna-${i}`, disabled: !llm || occupata || !!serie, onclick: () => disegnaScena(i) }, tavola ? 'Ridisegna' : 'Disegna la scena')),
            tavola ? h('div.frames', tavola.inquadrature.map((q) => quadro(scena, tavola, q))) : null));
      })),
      h('p.muted.small', { style: { maxWidth: '85ch' } }, 'I bozzetti sono schizzi di lavoro generati da Claude come disegni vettoriali: servono a discutere la regia, non sostituiscono lo storyboard di un disegnatore. Con “Copia prompt” ottieni la descrizione dell’inquadratura per un generatore di immagini; con “Carica immagine” metti il risultato al posto del bozzetto.'));
  }
  disegna();
}
