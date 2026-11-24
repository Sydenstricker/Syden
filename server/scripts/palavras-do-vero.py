# As palavras que se pode CHUTAR na Palavra secreta (server/src/minijogo-palavra.ts), tiradas de um dicionário de corretor
# do hunspell. O português é o VERO, o corretor ortográfico do LibreOffice (LGPLv3/MPL):
# https://github.com/LibreOffice/dictionaries/tree/master/pt_BR
# Uso: baixe pt_BR.aff e pt_BR.dic para uma pasta vazia e rode, de dentro dela:
#   python -I palavras-do-vero.py cinco.txt [N] [--final]
# Ele expande os sufixos e prefixos do hunspell e guarda as palavras de N letras (5, se não disser) sem acento (a chave),
# com as grafias. A lista final (validas.txt; validas-4.txt e validas-6.txt desde 21/11/2026) é a chave e, quando a grafia é
# uma só e tem acento, a grafia depois do tab: é o que o --final escreve.
#
# OUTROS IDIOMAS (24/11/2026, o lote E da segunda auditoria): --lingua=en, --lingua=es ou --lingua=fr, e um --dic=<base> para cada par
# .aff/.dic (sem a extensão; vários juntam as palavras de todos). A chave de cada língua:
#   pt: sem acento, o ç vira c (o de sempre);
#   en: só a-z (o inglês do SCOWL, en_US);
#   es: sem acento, mas o Ñ FICA uma letra à parte (como nos jogos de palavra em espanhol), e o ü vira u;
#   fr: sem acento, o ç vira c; as palavras com œ e æ ficam de fora (o fr.aff/fr.dic do Grammalecte, FLAG long).
# Exemplos (de dentro da pasta com os arquivos baixados):
#   python -I palavras-do-vero.py validas.txt 5 --final --lingua=en --dic=en_US
#   python -I palavras-do-vero.py validas.txt 5 --final --lingua=es --dic=es_ES --dic=es_MX --dic=es_AR
import re, sys, unicodedata, collections

N = int(next((a for a in sys.argv[2:] if a.isdigit()), '5'))
FINAL = '--final' in sys.argv
LINGUA = next((a.split('=', 1)[1] for a in sys.argv[2:] if a.startswith('--lingua=')), 'pt')
BASES = [a.split('=', 1)[1] for a in sys.argv[2:] if a.startswith('--dic=')] or ['pt_BR']
LETRAS = {'pt': 'a-z', 'en': 'a-z', 'es': 'a-zñ', 'fr': 'a-z'}[LINGUA]


def ler_aff(arquivo):
    aff = open(arquivo, encoding='utf-8-sig').read().splitlines()
    # FLAG long (o francês do Grammalecte): cada flag tem dois caracteres; sem isso, um caractere cada
    longo = any(l.split()[:2] == ['FLAG', 'long'] for l in aff if l.startswith('FLAG'))
    separar = (lambda f: [f[k:k + 2] for k in range(0, len(f), 2)]) if longo else list
    regras = collections.defaultdict(list)  # flag -> [(tipo, tira, poe, flags, cond)]
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
                regras[flag].append((tipo, tira, poe, separar(fl), rx))
            i += n + 1
        else:
            i += 1
    # As palavras marcadas para nunca serem sugeridas pelo corretor (no en_US, os palavrões e as ofensas) ficam fora da lista
    # nas línguas novas: na revelação a sala vê as letras de todo mundo. O português continua como era (validas.txt igual).
    def marca(nome):
        return next((l.split()[1] for l in aff if l.startswith(nome + ' ') and len(l.split()) > 1), None)
    fora = marca('NOSUGGEST')
    # E também (24/11/2026, o francês): a FORBIDDENWORD, que o corretor recusa, e a raiz NEEDAFFIX, que sozinha não é palavra.
    if LINGUA == 'pt':
        return regras, cruza, None, None, None, separar
    return regras, cruza, fora, marca('FORBIDDENWORD'), marca('NEEDAFFIX'), separar


def aplicar(regras, palavra, flags, nivel=0):
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
                saem += [(w, t, ff) for w, t, ff in aplicar(regras, nova, fl, nivel + 1)]
    return saem


def sem_acento(w):
    if LINGUA == 'es':
        w = w.replace('ñ', '\0')
    s = ''.join(c for c in unicodedata.normalize('NFD', w) if unicodedata.category(c) != 'Mn')
    return s.replace('\0', 'ñ')


# Ofensas que o NOSUGGEST do en_US deixa passar (e as do espanhol e do francês) (de ódio, sem outro sentido): fora, com o plural.
OFENSAS = {'en': {'kike', 'kikes', 'spic', 'spics', 'fag', 'fags', 'faggot', 'faggots', 'chink', 'chinks', 'gook', 'gooks',
                  'nigga', 'niggas', 'dyke', 'dykes', 'tranny', 'wetback', 'wetbacks', 'retard', 'retards'},
           'es': {'sudaca', 'sudacas', 'marica', 'maricas', 'maricón', 'negrata', 'negratas'},
           'fr': {'nègre', 'nègres', 'négro', 'négros', 'pédé', 'pédés', 'youpin', 'youpins', 'youpine', 'bougnoul', 'bicot',
                  'bicots', 'gouine', 'gouines', 'fiotte', 'fiottes', 'tapette', 'tarlouze', 'bamboula'}}.get(LINGUA, set())

formas = collections.defaultdict(set)  # chave sem acento -> formas com acento
for base in BASES:
    regras, cruza, fora, proibida, precisa, separar = ler_aff(base + '.aff')
    for linha in open(base + '.dic', encoding='utf-8-sig').read().splitlines()[1:]:
        raiz, _, flags = linha.split('\t')[0].strip().partition('/')
        flags = separar(flags.split()[0] if flags.strip() else '')
        if not raiz or raiz[0].isupper() or (fora and fora in flags) or (proibida and proibida in flags):
            continue
        tudo = [] if (precisa and precisa in flags) else [raiz]
        filhos = aplicar(regras, raiz, flags)
        tudo += [w for w, _, _ in filhos]
        # cruzar prefixo com sufixo
        sufs = [w for w, t, f in filhos if t == 'SFX' and cruza.get(f)]
        pfx = [f for f in flags if any(r[0] == 'PFX' for r in regras.get(f, [])) and cruza.get(f)]
        for w in sufs:
            tudo += [x for x, _, _ in aplicar(regras, w, pfx)]
        for w in tudo:
            if len(w) == N and w.isalpha() and w.islower() and w not in OFENSAS:
                chave = sem_acento(w)
                if re.fullmatch('[%s]{%d}' % (LETRAS, N), chave):
                    formas[chave].add(w)

with open(sys.argv[1], 'w', encoding='utf-8', newline='\n') as s:
    for k in sorted(formas):
        if FINAL:
            unica = sorted(formas[k])[0] if len(formas[k]) == 1 else k
            s.write(k + ('\t' + unica if unica != k else '') + '\n')
        else:
            s.write(k + '\t' + ','.join(sorted(formas[k])) + '\n')
print(len(formas))
