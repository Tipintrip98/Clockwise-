// Elenco dei dossier.
import { h, metti, fmt, dataBreve, bottoneConferma, toast } from './dom.js';
import { S, apriProgetto, render } from './app.js';
import * as store from '../core/store.js';
import { opzioniAnno, areaBando } from '../core/bandi/catalogo.js';
import { nuovoDossierGuidato } from './scelta-bando.js';

const ESITI = {
  ammissibile: ['ok', 'Sopra le soglie'],
  a_rischio: ['warn', 'Margine ridotto'],
  sotto_soglia: ['bad', 'Sotto soglia'],
  parziale: ['', 'Stima parziale'],
};
const AMBITO = { nazionale: 'Bando nazionale', europeo: 'Bando europeo' };

// Bando e regione di un dossier dell'elenco: dal catalogo in uso, altrimenti da ciò che è stato salvato con il dossier.
function bandoDelDossier(p, oggi) {
  const b = S.bandi.find((x) => x.id === p.bandoId);
  if (!b) return { regione: '', nome: p.bando ? `${p.bando} (bando non più in catalogo)` : 'Bando non più in catalogo', edizione: p.anno ? `finestra ${p.anno}` : '' };
  const anno = p.anno ? opzioniAnno(b, oggi, p.anno).find((a) => a.anno === Number(p.anno)) : null;
  return {
    regione: AMBITO[areaBando(b)] || b.regione || '',
    nome: b.nomeBreve || b.nome,
    edizione: anno ? (anno.prevista ? `edizione ${anno.anno} prevista` : `finestra ${anno.anno}`) : '',
  };
}

export function vistaHome(main) {
  const oggi = new Date().toISOString().slice(0, 10);
  metti(main,
    h('div.page-head',
      h('div', h('h1', 'I tuoi dossier'),
        h('p', 'Carica il dossier di candidatura e ottieni il punteggio che la Commissione gli darebbe, criterio per criterio, prima di inviarlo.')),
      h('button.btn.primary', { type: 'button', id: 'btn-nuovo-dossier', onclick: () => nuovoDossierGuidato() }, '+ Nuovo dossier')),
    !store.persistente && h('div.notice.warn.cat-spazio', 'Questo browser non permette di salvare i dati: i dossier restano disponibili solo finché la pagina è aperta. Scarica il report prima di chiudere.'),
    S.progetti.length
      ? h('div.cards', S.progetti.map((p) => {
        const [classe, etichetta] = ESITI[p.esito] || ESITI.parziale;
        const bando = bandoDelDossier(p, oggi);
        return h('div.card', { role: 'button', tabindex: '0', onclick: () => apriProgetto(p.id), onkeydown: (e) => { if (e.key === 'Enter') apriProgetto(p.id); } },
          h('div.spread', h(`span.tag.${classe || 'x'}`, etichetta), p.esempio && h('span.tag.accent', 'Esempio')),
          h('div', bando.regione && h('div.label.cat-regione', bando.regione), h('h3', p.nome)),
          h('div.muted.small', [bando.nome, p.categoria, bando.edizione].filter(Boolean).join(' · ')),
          h('div.spread.cat-fondo',
            h('div.score', p.totale != null ? fmt(p.totale) : '—', h('small', p.completo ? ' / 100' : ' / 100 parziale')),
            h('div.muted.small', `${p.documenti || 0} file · ${dataBreve(p.aggiornato)}`)),
          h('div', { onclick: (e) => e.stopPropagation(), onkeydown: (e) => e.stopPropagation() },
            bottoneConferma('Elimina', 'Conferma eliminazione', async () => {
              await store.eliminaProgetto(p.id);
              if (S.progetto?.id === p.id) S.progetto = null;
              S.progetti = await store.elencoProgetti();
              toast('Dossier eliminato'); render();
            })));
      }))
      : h('div.panel.flat.empty', h('strong', 'Nessun dossier'), 'Crea il primo dossier: scegli il bando, la categoria e l’anno, poi carica i documenti della candidatura.',
        h('div.cat-spazio-su', h('button.btn.primary', { type: 'button', onclick: () => nuovoDossierGuidato() }, 'Quale bando vuoi simulare?'))),
    h('p.muted.small.cat-nota-fondo',
      'I documenti restano su questo dispositivo. A Claude viene inviato solo il testo necessario alla valutazione; il documento d’identità non viene mai inviato. La stima è uno strumento di controllo qualità: non sostituisce il giudizio della Commissione.'),
  );
}
