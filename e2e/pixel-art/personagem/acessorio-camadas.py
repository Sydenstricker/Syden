# AS CAMADAS DO PERSONAGEM, MONTADAS (piloto de 09/11/2026: "quero que nosso método seja escalável e com qualidade").
#
# O acessório é pintado UMA vez por corpo e por direção (acessorio.mjs, num quadro de referência: o "parado" 0). Este script
# o leva a todos os quadros de todas as animações daquele corpo e direção, sem gerar nada:
#
# 1. ACOMPANHAR A CABEÇA PELA IMAGEM: o pedaço do quadro de referência em volta do acessório é procurado em cada quadro
#    (o deslocamento de menor diferença, até 14 px). Não depende da forma das orelhas nem do tamanho da cabeça, então serve a
#    qualquer corpo. (A primeira versão achava o alto do crânio pela largura do pelo, e a orelha caída a confundia.)
# 2. O QUE PASSA NA FRENTE FICA NA FRENTE: onde o acessório cobria cabeça no quadro de referência e, no quadro novo, ali há
#    outra coisa (a mão que acena), a coisa nova fica por cima.
# 3. CONFERIR: o custo da procura de cada quadro vai ao relatório; acima do limite, o quadro é marcado (a cabeça mudou de
#    forma: deitou, virou) e pede o acessório pintado nele (acessorio.mjs com a origem daquela pose).
#
#   py -3 e2e/pixel-art/personagem/acessorio-camadas.py
#   → camadas/folha-<acessório>-<corpo>.png  (por animação e direção: o quadro sem e com o acessório)
#     camadas/troca.png                      (cada corpo com cada acessório e com os dois: a prova de que trocam)
#     camadas/<corpo>-<acessório>-<animação>-<direção>.gif e camadas/relatorio.json
import os, re, json, sys
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'camadas')
CORPOS = ['mascote', 'orelha-caida', 'musculoso']
ACESSORIOS = ['bone', 'bandana']
ANIMS = ['parado', 'andando', 'falando', 'acenando']
# a pasta de cada animação, quando o corpo não usa a de nome igual (o mascote anda pela v3: a "andando" é a caminhada antiga,
# por esqueleto, noutra escala e fora do quarto)
PASTAS = {('mascote', 'andando'): ['andando-v3', 'andando-v3b']}
DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
BUSCA = 14          # px que a cabeça pode andar entre a referência e o quadro
LIMITE = 40         # custo médio (0–255) acima do qual o quadro é marcado
OCLUSAO = 90        # diferença de cor (soma dos canais) que diz "ali agora há outra coisa"
FUNDO = (70, 70, 90, 255)

def ler(f): return np.array(Image.open(f).convert('RGBA')).astype(int)

def quadros(pasta, d):
    if not os.path.isdir(pasta): return []
    fs = [f for f in os.listdir(pasta) if re.fullmatch(f'{d}-\\d+\\.png', f)]
    return [os.path.join(pasta, f) for f in sorted(fs, key=lambda f: int(re.search(r'-(\d+)\.png', f).group(1)))]

def procurar(ref, alvo, caixa):
    """O deslocamento (dx, dy) que leva o pedaço `caixa` do quadro de referência ao lugar dele no alvo, e o custo."""
    y0, y1, x0, x1 = caixa
    pedaco = ref[y0:y1, x0:x1]; opaco = pedaco[..., 3] > 20
    if opaco.sum() < 10: return (0, 0), 0.0
    h, w = alvo.shape[:2]
    melhor = (None, 1e9)
    for dy in range(-BUSCA, BUSCA + 1):
        for dx in range(-BUSCA, BUSCA + 1):
            Y0, X0 = y0 + dy, x0 + dx
            if Y0 < 0 or X0 < 0 or Y0 + (y1 - y0) > h or X0 + (x1 - x0) > w: continue
            ali = alvo[Y0:Y0 + (y1 - y0), X0:X0 + (x1 - x0)]
            dif = np.abs(ali[..., :3] - pedaco[..., :3]).sum(-1) / 3
            dif = np.where(ali[..., 3] > 20, dif, 160)          # onde o alvo não tem desenho, conta como muito diferente
            custo = dif[opaco].mean() + 0.3 * abs(dx) / BUSCA   # um empurrãozinho para o menor deslocamento, no empate
            if custo < melhor[1]: melhor = ((dx, dy), custo)
    return melhor

def montar(alvo, ref, camada, d):
    """Põe a camada no alvo, deslocada por d, deixando na frente o que passou na frente.

    "Passou na frente" é um PEDAÇO (8 px ou mais) que entra pela borda do acessório e não se parece com nada da cabeça em
    volta (2 px de folga): a mão que acena. Diferença de sombreado da própria cabeça, de um quadro para o outro, fica
    espalhada no meio e não conta — a primeira versão contava pixel a pixel e picotava o boné no aceno.
    """
    from scipy import ndimage
    dx, dy = d; out = alvo.copy(); h, w = alvo.shape[:2]; H, W = ref.shape[:2]
    pegada = np.zeros((h, w), bool); outra = np.zeros((h, w), bool)
    ys, xs = np.nonzero(camada[..., 3] > 20)
    Y, X = ys + dy, xs + dx
    ok = (Y >= 0) & (Y < h) & (X >= 0) & (X < w)
    ys, xs, Y, X = ys[ok], xs[ok], Y[ok], X[ok]
    pegada[Y, X] = True
    menor = np.full(len(ys), 1e9)
    for oy in range(-2, 3):
        for ox in range(-2, 3):
            yy, xx = np.clip(ys + oy, 0, H - 1), np.clip(xs + ox, 0, W - 1)
            dif = np.abs(alvo[Y, X, :3] - ref[yy, xx, :3]).sum(-1)
            dif = np.where(ref[yy, xx, 3] > 20, dif, 1e9)
            menor = np.minimum(menor, dif)
    outra[Y, X] = (alvo[Y, X, 3] > 20) & (ref[ys, xs, 3] > 20) & (menor > OCLUSAO)
    rot, n = ndimage.label(outra, structure=np.ones((3, 3)))
    borda = pegada & ~ndimage.binary_erosion(pegada)
    frente = np.zeros((h, w), bool)
    for k in range(1, n + 1):
        pedaco = rot == k
        if pedaco.sum() >= 8 and (pedaco & borda).any(): frente |= pedaco
    # Onde o acessório estava SOBRE o corpo na referência e, no quadro novo, ali é fundo, ele não é pintado: o corpo girou
    # (o tronco do musculoso no aceno) e a bandana ficava pendurada no ar (relato dele, 09/11/2026). O que já ficava sobre o
    # fundo na referência (a aba do boné) continua.
    no_ar = (ref[ys, xs, 3] > 20) & (alvo[Y, X, 3] <= 20)
    pinta = ~frente[Y, X] & ~no_ar
    out[Y[pinta], X[pinta]] = camada[ys[pinta], xs[pinta]]
    return out, int(frente.sum())

def caixa_da(camada):
    ys, xs = np.nonzero(camada[..., 3] > 20)
    if not len(ys): return None
    h, w = camada.shape[:2]
    return (max(0, ys.min() - 8), min(h, ys.max() + 9), max(0, xs.min() - 8), min(w, xs.max() + 9))

def bloco(a, E=3, Q=120):
    b = np.zeros((Q, Q, 4), np.uint8); b[...] = FUNDO
    m = a[..., 3] > 20; b[:a.shape[0], :a.shape[1]][m] = a[m].astype(np.uint8)
    return np.kron(b, np.ones((E, E, 1), np.uint8))

def folha(linhas, saida, E=3):
    cols = max(len(l) for l in linhas)
    Q = max(max(a.shape[:2]) for l in linhas for a in l if a is not None); L = Q * E
    f = np.zeros((len(linhas) * L, cols * L, 4), np.uint8); f[...] = FUNDO
    for i, l in enumerate(linhas):
        for j, a in enumerate(l):
            if a is not None: f[i * L:(i + 1) * L, j * L:(j + 1) * L] = bloco(a, E, Q)
    Image.fromarray(f).save(saida)

os.makedirs(SAIDA, exist_ok=True)
relatorio = {}
# o que cada corpo, acessório e direção recebe, guardado para a folha da troca
referencias = {}
for corpo in CORPOS:
    for acc in ACESSORIOS:
        linhas = []
        for d in DIRS:
            camf = os.path.join(AQUI, corpo, 'acessorios', acc, 'parado', f'{d}-0.png')
            reff = os.path.join(AQUI, corpo, 'baixa-120', 'animacoes', 'parado', f'{d}-0.png')
            if not (os.path.exists(camf) and os.path.exists(reff)):
                print('falta', corpo, acc, d); continue
            camada, ref = ler(camf), ler(reff); caixa = caixa_da(camada)
            if caixa is None: print('camada vazia', corpo, acc, d); continue
            referencias[(corpo, acc, d)] = (ref, camada, caixa)
            for anim in ANIMS:
                fs = next((q for q in (quadros(os.path.join(AQUI, corpo, 'baixa-120', 'animacoes', p), d) for p in PASTAS.get((corpo, anim), [anim])) if q), [])
                if not fs: continue
                sem, com, info = [], [], []
                for f in fs:
                    a = ler(f); desloc, custo = procurar(ref, a, caixa); m, frente = montar(a, ref, camada, desloc)
                    sem.append(a); com.append(m)
                    info.append({'quadro': os.path.basename(f), 'desloc': desloc, 'custo': round(float(custo), 1), 'na_frente': frente, 'marcado': bool(custo > LIMITE)})
                relatorio[f'{corpo}/{acc}/{anim}/{d}'] = info
                linhas += [sem, com]
                gif = [Image.fromarray(np.kron(np.where(c[..., 3:4] > 20, c, FUNDO).astype(np.uint8), np.ones((4, 4, 1), np.uint8))).convert('RGB') for c in com]
                gif[0].save(os.path.join(SAIDA, f'{corpo}-{acc}-{anim}-{d}.gif'), save_all=True, append_images=gif[1:], duration=125, loop=0)
        if linhas: folha(linhas, os.path.join(SAIDA, f'folha-{acc}-{corpo}.png'))

# A TROCA: cada corpo × (nada, cada acessório, todos juntos), no "parado" 0 de cada direção
linhas = []
for corpo in CORPOS:
    for d in DIRS:
        reff = os.path.join(AQUI, corpo, 'baixa-120', 'animacoes', 'parado', f'{d}-0.png')
        if not os.path.exists(reff): continue
        base = ler(reff); l = [base]
        juntos = base
        for acc in ACESSORIOS:
            r = referencias.get((corpo, acc, d))
            if not r: l.append(None); continue
            l.append(montar(base, r[0], r[1], (0, 0))[0]); juntos = montar(juntos, r[0], r[1], (0, 0))[0]
        l.append(juntos); linhas.append(l)
if linhas: folha(linhas, os.path.join(SAIDA, 'troca.png'))

json.dump(relatorio, open(os.path.join(SAIDA, 'relatorio.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
marcados = [(k, q['quadro'], q['custo']) for k, v in relatorio.items() for q in v if q['marcado']]
custos = [q['custo'] for v in relatorio.values() for q in v]
print(f'{len(custos)} quadros; custo médio {np.mean(custos):.1f}, máximo {max(custos):.1f}; {len(marcados)} marcados')
for m in marcados[:30]: print('  marcado', *m)
