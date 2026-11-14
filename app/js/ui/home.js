// Elenco dei dossier.
import { h, metti, fmt, dataBreve, bottoneConferma, toast } from './dom.js';
import { S, apriProgetto, nuovoProgetto, salva, render } from './app.js';
import * as store from '../core/store.js';

const ESITI = {
  ammissibile: ['ok', 'Sopra le soglie'],
  a_rischio: ['warn', 'Margine ridotto'],
  sotto_soglia: ['bad', 'Sotto soglia'],
  parziale: ['', 'Stima parziale'],
};

export function vistaHome(main) {
  const crea = async () => {
    const p = nuovoProgetto(`Dossier ${S.progetti.filter((x) => !x.esempio).length + 1}`);
    await salva(p);
    await apriProgetto(p.id, 'documenti');
  };
  metti(main, 
    h('div.page-head',
      h('div', h('h1', 'I tuoi dossier'),
        h('p', 'Carica il dossier di candidatura e ottieni il punteggio che la Commissione gli darebbe, criterio per criterio, prima di inviarlo.')),
      h('button.btn.primary', { type: 'button', onclick: crea }, '+ Nuovo dossier')),
    !store.persistente && h('div.notice.warn', { style: { marginBottom: '16px' } }, 'Questo browser non permette di salvare i dati: i dossier restano disponibili solo finché la pagina è aperta. Scarica il report prima di chiudere.'),
    S.progetti.length
      ? h('div.cards', S.progetti.map((p) => {
        const [classe, etichetta] = ESITI[p.esito] || ESITI.parziale;
        return h('div.card', { role: 'button', tabindex: '0', onclick: () => apriProgetto(p.id), onkeydown: (e) => { if (e.key === 'Enter') apriProgetto(p.id); } },
          h('div.spread', h(`span.tag.${classe || 'x'}`, etichetta), p.esempio && h('span.tag.accent', 'Esempio')),
          h('h3', p.nome),
          h('div.muted.small', [p.bando, p.categoria, p.anno && `finestra ${p.anno}`].filter(Boolean).join(' · ')),
          h('div.spread', { style: { marginTop: 'auto' } },
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
      : h('div.panel.flat.empty', h('strong', 'Nessun dossier'), 'Crea il primo dossier e carica i documenti della candidatura.'),
    h('p.muted.small', { style: { marginTop: '22px', maxWidth: '75ch' } },
      'I documenti restano su questo dispositivo. A Claude viene inviato solo il testo necessario alla valutazione; il documento d’identità non viene mai inviato. La stima è uno strumento di controllo qualità: non sostituisce il giudizio della Commissione.'),
  );
}
