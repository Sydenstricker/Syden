# As palavras que se pode CHUTAR na Palavra secreta (server/src/minijogo-palavra.ts), tiradas do VERO, o corretor
# ortográfico do LibreOffice (LGPLv3/MPL): https://github.com/LibreOffice/dictionaries/tree/master/pt_BR
# Uso: baixe pt_BR.aff e pt_BR.dic para uma pasta vazia e rode, de dentro dela:
#   python -I palavras-do-vero.py cinco.txt
# Ele expande os sufixos e prefixos do hunspell e guarda as palavras de 5 letras sem acento (a chave), com as grafias.
# A lista final (validas.txt) é a chave e, quando a grafia é uma só e tem acento, a grafia depois do tab.
import re, sys, unicodedata, collections

aff = open('pt_BR.aff', encoding='utf-8-sig').read().splitlines()
regras = collections.defaultdict(list)  # flag -> [(tipo, cruza, tira, poe, flags, cond)]
cruza = {}
i = 0
while i < len(aff):
    p = aff[i].split()
    if len(p) >= 4 and p[0] in ('SFX', 'PFX') and p[2] in ('Y', 'N') and p[3].isdigit():
        tipo, flag, cr, n = p[0], p[1], p[2] == 'Y', int(p[3])
        cruza[flag] = cr
        for j in range(1, n + 1):
            q = aff[i + j].split()
            tira = '' if q[2] == '0' else q[2]
            poe, _, fl = q[3].partition('/')
            poe = '' if poe == '0' else poe
            cond = q[4] if len(q) > 4 else '.'
            rx = re.compile((cond + '$') if tipo == 'SFX' else ('^' + cond))
            regras[flag].append((tipo, tira, poe, fl, rx))
        i += n + 1
    else:
        i += 1

def aplicar(palavra, flags, nivel=0):
    saem = []
    for f in flags:
        for tipo, tira, poe, fl, rx in regras.get(f, []):
            if not rx.search(palavra):
                continue
            if tipo == 'SFX':
                if tira and not palavra.endswith(tira):
                    continue
                nova = palavra[: len(palavra) - len(tira)] + poe
            else:
                if tira and not palavra.startswith(tira):
                    continue
                nova = poe + palavra[len(tira):]
            saem.append((nova, tipo, f))
            if fl and nivel < 1:
                saem += [(w, t, ff) for w, t, ff in aplicar(nova, fl, nivel + 1)]
    return saem

def sem_acento(w):
    return ''.join(c for c in unicodedata.normalize('NFD', w) if unicodedata.category(c) != 'Mn')

formas = collections.defaultdict(set)  # chave sem acento -> formas com acento
for linha in open('pt_BR.dic', encoding='utf-8-sig').read().splitlines()[1:]:
    raiz, _, flags = linha.split('\t')[0].partition('/')
    if not raiz or raiz[0].isupper():
        continue
    tudo = [raiz]
    filhos = aplicar(raiz, flags)
    tudo += [w for w, _, _ in filhos]
    # cruzar prefixo com sufixo
    sufs = [w for w, t, f in filhos if t == 'SFX' and cruza.get(f)]
    pfx = [f for f in flags if any(r[0] == 'PFX' for r in regras.get(f, [])) and cruza.get(f)]
    for w in sufs:
        tudo += [x for x, _, _ in aplicar(w, pfx)]
    for w in tudo:
        if len(w) == 5 and w.isalpha() and w.islower():
            chave = sem_acento(w)
            if re.fullmatch('[a-z]{5}', chave):
                formas[chave].add(w)

with open(sys.argv[1], 'w', encoding='utf-8') as s:
    for k in sorted(formas):
        s.write(k + '\t' + ','.join(sorted(formas[k])) + '\n')
print(len(formas))
