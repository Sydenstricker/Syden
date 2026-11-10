# A AUDITORIA DAS CAMADAS (10/11/2026, pedido dele: "talvez seja necessário melhorarmos o nosso processo de auditoria da
# arte? São vários erros que passaram agora"). Os erros que passaram tinham uma coisa em comum: com as cores ORIGINAIS eles
# quase não se viam (pelo lavanda sobre lavanda, bandana ferrugem sobre moletom escuro). Ele os achou pintando o coelho
# com cores berrantes. Esta auditoria faz o mesmo de propósito, em todos os corpos, animações, direções e quadros, e mede
# o que dá para medir:
#
#   1. SOLTOS E PICOS: pedaço de desenho que flutua ou que sobe acima dos quadros vizinhos (a bolinha no alto da cabeça).
#   2. ROUPA ESTÁVEL: quantos pixels de roupa cada quadro tem, contra a mediana da direção; um quadro que foge 35% tem roupa
#      virando pelo ou pelo virando roupa (a regata que clareava num quadro).
#   3. RISQUINHOS: roupa no quarto de cima do desenho, onde só há orelha e cabeça (o risco vermelho na orelha).
#   4. ACESSÓRIO LIMPO: pixel da camada com cor que não é a do acessório nem o contorno dele (o halo da bandana).
#
# E monta a FOLHA DE ESTRESSE, que é a que se olha: cada animação e direção com pelo rosa-choque, roupa vermelha, boné azul
# e bandana verde, os acessórios encaixados como no jogo. Defeito de cor salta aos olhos assim.
#   py -3 e2e/pixel-art/personagem/auditoria-de-camadas.py        → camadas/estresse-<corpo>.png e camadas/auditoria.json
# Sai com código 1 se algo for marcado. Rodar depois de cada corpo, animação ou acessório novo (junto com o
# acessorio-camadas.py, que gera o relatorio.json usado aqui).
import os, sys, json, re
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from classes_de_cor import cls, referencias

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'camadas')
CORPOS = ['mascote', 'orelha-caida', 'musculoso']
ANIMS = ['parado', 'andando', 'falando', 'acenando']
PASTAS = {('mascote', 'andando'): ['andando-v3', 'andando-v3b']}
DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
PELO, ROUPA = (255, 120, 190), (220, 40, 50)
CORES_ACC = {'bone': (40, 90, 230), 'bandana': (60, 190, 80)}
Q = 144
rel = json.load(open(os.path.join(SAIDA, 'relatorio.json'), encoding='utf-8'))

def lum(a): return a[..., :3].astype(float) @ [0.299, 0.587, 0.114]

def recolorir(a, sel, alvo, ref):
    out = a.copy(); L = lum(a)
    k = L[sel] / max(ref, 1)
    alvo = np.array(alvo, float)
    escuro = k[:, None] <= 1
    cor = np.where(escuro, alvo * (0.25 + 0.75 * k[:, None]), alvo + (255 - alvo) * np.clip((k[:, None] - 1) * 1.1, 0, 1))
    out[sel, :3] = np.clip(cor, 0, 255).astype(np.uint8)
    return out

def soltos(a):
    d = a[..., 3] > 0
    rot, n = ndimage.label(d, structure=np.ones((3, 3)))
    if n <= 1: return 0
    tam = np.bincount(rot.ravel()); tam[0] = 0
    return int(tam.sum() - tam.max())

def quadros(corpo, anim, d):
    for p in PASTAS.get((corpo, anim), [anim]):
        pasta = os.path.join(AQUI, corpo, 'baixa-120', 'animacoes', p)
        if not os.path.isdir(pasta): continue
        fs = sorted([f for f in os.listdir(pasta) if re.fullmatch(f'{d}-\\d+\\.png', f)], key=lambda f: int(f.rsplit('-', 1)[1][:-4]))
        if fs: return [np.array(Image.open(os.path.join(pasta, f)).convert('RGBA')) for f in fs]
    return []

marcas = []; folhas = {}
for corpo in CORPOS:
    camadas = {}
    for acc in CORES_ACC:
        for d in DIRS:
            f = os.path.join(AQUI, corpo, 'acessorios', acc, 'parado', f'{d}-0.png')
            if not os.path.exists(f): continue
            L = np.array(Image.open(f).convert('RGBA')); op = L[..., 3] > 20
            # 4. o acessório limpo: matiz fora do dominante e claro (não é contorno)
            rgb = L[..., :3].astype(float); mx, mn = rgb.max(-1), rgb.min(-1)
            sat = (mx - mn) / np.maximum(mx, 1); clara = lum(L) > 70
            sem_cor = op & clara & (sat < 0.18)
            if sem_cor.sum() > 2: marcas.append(f'{corpo}/{acc}/{d}: {int(sem_cor.sum())} px claros sem a cor do acessório')
            Lc = L.copy()
            Lc = recolorir(Lc, op & clara, CORES_ACC[acc], float(np.median(lum(L)[op & clara])) if (op & clara).any() else 1)
            camadas[(acc, d)] = Lc
    linhas = []
    for anim in ANIMS:
        for d in DIRS:
            fs = quadros(corpo, anim, d)
            if not fs: continue
            mapas = [cls(a, corpo) for a in fs]
            ref = referencias(fs[0], mapas[0])
            roupa = np.array([(m == 2).sum() for m in mapas]); med = max(1, np.median(roupa))
            H = max(a.shape[0] for a in fs)
            topo = [int(np.nonzero((a[..., 3] > 0).any(1))[0].min()) + (H - a.shape[0]) // 2 for a in fs]
            linha = []
            for k, (a, m) in enumerate(zip(fs, mapas)):
                nome = f'{corpo}/{anim}/{d}-{k}'
                s = soltos(a)
                if s: marcas.append(f'{nome}: {s} px soltos')
                viz = [topo[j] for j in (k - 1, k + 1) if 0 <= j < len(fs)]
                if len(viz) == 2 and topo[k] <= min(viz) - 5: marcas.append(f'{nome}: pico de {min(viz) - topo[k]} px acima dos vizinhos')
                if abs(roupa[k] - med) / med > 0.35: marcas.append(f'{nome}: roupa com {roupa[k]} px, a mediana é {int(med)}')
                # 3. risquinhos de roupa NAS ORELHAS: no quarto de cima do desenho só há orelha e cabeça; pixel de roupa ali é
                # traço do pelo pintado com a cor da roupa (o risco vermelho na orelha). Peças separadas pelo contorno (o
                # moletom e a calça) são normais, e por isso a regra olha a altura, não o número de pedaços.
                ys = np.nonzero((a[..., 3] > 0).any(1))[0]
                alto = ys.min() + (ys.max() - ys.min()) // 4
                no_alto = int((m[:alto] == 2).sum())
                # (no aceno, a manga sobe até lá de verdade; e a borda do capuz encosta com uns poucos pixels)
                if no_alto > 8 and anim != 'acenando': marcas.append(f'{nome}: {no_alto} px de roupa na altura das orelhas')
                # a folha de estresse
                b = recolorir(a, m == 1, PELO, ref[1]); b = recolorir(b, m == 2, ROUPA, ref[2])
                tela = np.zeros((Q, Q, 4), np.uint8); pad = (Q - a.shape[0]) // 2
                tela[pad:pad + a.shape[0], pad:pad + a.shape[1]] = b
                for acc in ('bandana', 'bone'):
                    chave = f'{corpo}/{acc}/{anim}/{d}'
                    if (acc, d) not in camadas or chave not in rel or k >= len(rel[chave]): continue
                    dx, dy = rel[chave][k]['desloc']; Lc = camadas[(acc, d)]
                    ys, xs = np.nonzero(Lc[..., 3] > 20); Y, X = ys + dy + pad, xs + dx + pad
                    ok = (Y >= 0) & (Y < Q) & (X >= 0) & (X < Q)
                    tela[Y[ok], X[ok]] = Lc[ys[ok], xs[ok]]
                linha.append(tela)
            linhas.append(linha)
    if linhas:
        E = 2; cols = max(len(l) for l in linhas)
        f = np.zeros((len(linhas) * Q * E, cols * Q * E, 3), np.uint8); f[...] = (34, 30, 52)
        for i, l in enumerate(linhas):
            for j, t in enumerate(l):
                blk = np.where(t[..., 3:4] > 20, t[..., :3], (34, 30, 52)).astype(np.uint8)
                f[i * Q * E:(i + 1) * Q * E, j * Q * E:(j + 1) * Q * E] = np.kron(blk, np.ones((E, E, 1), np.uint8))
        Image.fromarray(f).save(os.path.join(SAIDA, f'estresse-{corpo}.png'))

json.dump(marcas, open(os.path.join(SAIDA, 'auditoria.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(marcas)} marcas')
for m in marcas[:60]: print(' ', m)
sys.exit(1 if marcas else 0)
