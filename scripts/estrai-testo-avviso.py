# Genera app/js/core/bando-sicilia-testo.js dal PDF ufficiale dell'Avviso.
# Uso (serve pdftotext, pacchetto poppler):
#   pdftotext -layout bandi/sicilia-2025-2027/Avviso-pubblico-2025-2027-coordinato-DDG-4788-2025.pdf bando.txt
#   python3 scripts/estrai-testo-avviso.py app/js/core/bando-sicilia-testo.js
# Va rieseguito solo se l'Avviso viene modificato; poi vanno riallineati a mano griglia e soglie in bando-sicilia.js.
import re, json, sys
righe = open('bando.txt', encoding='utf-8').read().split('\n')
# via indice (prime 58 righe) e numeri di pagina
righe = righe[59:]
puliti = []
for r in righe:
    s = r.replace('\x0c', '').strip()
    if re.fullmatch(r'\d+/\d+', s): continue
    puliti.append(s)
testo = '\n'.join(puliti)
# articoli
parti = re.split(r'\n\s*ARTICOLO (\d+)\s*\n', '\n' + testo)
articoli = {}
for i in range(1, len(parti), 2):
    articoli[int(parti[i])] = parti[i + 1]

MARCATORI = re.compile(r'^(||‒|–|-|•|◦|•|[a-z]\)|\d+\)|\d+\.\d+\s|)')
def paragrafi(blocco):
    out, cur = [], ''
    for s in blocco.split('\n'):
        if not s:
            if cur: out.append(cur); cur = ''
            continue
        s = re.sub(r'\s+', ' ', s)
        nuovo = bool(MARCATORI.match(s)) or (cur and re.search(r'[.:;]$', cur) and (s[0].isupper() or MARCATORI.match(s)))
        if cur and nuovo: out.append(cur); cur = s
        else: cur = (cur + ' ' + s).strip() if cur else s
    if cur: out.append(cur)
    res = []
    for p in out:
        p = re.sub(r'^[••◦]\s*', '- ', p)
        p = re.sub(r'^[‒–]\s*', '- ', p)
        res.append(p)
    return '\n'.join(res)

titoli = {}
corpi = {}
for n, blocco in articoli.items():
    ls = [l for l in blocco.split('\n')]
    # il titolo è la prima (o le prime) righe in maiuscolo
    t = []
    while ls and (not ls[0] or ls[0].upper() == ls[0]):
        if ls[0]: t.append(ls[0])
        ls.pop(0)
        if t and ls and ls[0] and ls[0].upper() != ls[0]: break
    titoli[n] = re.sub(r'\s+', ' ', ' '.join(t)).strip()
    corpi[n] = '\n'.join(ls)

# Art. 10: tolgo le tabelle (già trascritte nella griglia strutturata), tengo procedure, principi e minimi
a10 = corpi[10]
i1 = a10.index('Tabella A'); i2 = a10.index('Con riferimento alle Tabelle sopra riportate')
testa = a10[:i1]; coda = a10[i2:]
# i minimi di sezione sono una tabella: li riscrivo in chiaro
j = coda.index('FILM - FILM TV - SERIE TV'); k = coda.index('Resta inteso che')
minimi = ("Punteggi minimi per sezione — Film, film TV e serie TV: A 17, B 13, C 20, D 15. "
          "Documentari e serie documentarie: A 21, B 9, C 25, D 10. Cortometraggi: A 17, B 13, C 25, D 10.")
corpi[10] = testa + '\n[Tabelle A e B con criteri, punteggi e fasce: riportate nella griglia strutturata.]\n\n' + coda[:j] + '\n' + minimi + '\n\n' + coda[k:]

USI = {1: [], 2: [], 3: ['V'], 4: ['A', 'B', 'D', 'V'], 5: ['V'], 6: ['D', 'V'], 7: ['D', 'V'], 8: ['V'], 9: ['V'], 10: ['A', 'B', 'D', 'V'], 11: ['D'], 12: ['V'], 13: ['V'], 14: [], 15: ['V'], 16: [], 17: [], 18: ['V'], 19: [], 20: [], 21: []}
voci = []
for n in sorted(corpi):
    if n in (1, 2, 19, 20, 21): continue
    txt = paragrafi(corpi[n]).strip()
    if n == 12:  # i loghi sono immagini: nel testo resta un vuoto
        txt = txt.replace('provvedimenti di concessione delle agevolazioni:\n', 'provvedimenti di concessione delle agevolazioni: [loghi istituzionali della Regione Siciliana e della Sicilia Film Commission]\n')
    voci.append({'id': f'art{n}', 'titolo': f'Art. {n} — {titoli[n].capitalize()}', 'usi': USI[n], 'testo': txt})
    print(n, titoli[n], len(txt), file=sys.stderr)
print('totale', sum(len(v['testo']) for v in voci), file=sys.stderr)
js = '''// Testo ufficiale dell'Avviso pubblico Regione Siciliana 2025-2027 (coordinato con il D.D.G. n. 4788 del 22/12/2025),
// estratto articolo per articolo dal PDF pubblicato dalla Sicilia Film Commission. È conoscenza fissa del programma:
// ogni lettura di Claude riceve gli articoli che riguardano la sezione in esame ("usi": A, B, D = sezioni della
// griglia, V = verifica formale). File generato da scripts/estrai-testo-avviso.py: non modificare a mano.
export const TESTO_AVVISO_SICILIA = ''' + json.dumps(voci, ensure_ascii=False, indent=1) + ''';
'''
open(sys.argv[1], 'w', encoding='utf-8').write(js)
