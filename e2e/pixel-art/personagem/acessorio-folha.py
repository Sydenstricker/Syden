# A FOLHA DO ACESSÓRIO (09/11/2026, pedido dele: "deixa eu ver como ficou o spritesheet do boné no coelho para avaliar").
# O acessório é pintado UMA vez num quadro (acessorio.mjs) e o código o leva aos outros quadros da mesma pose e direção,
# acompanhando a cabeça: em cada quadro acha o alto do crânio (a primeira linha em que o pelo já é largo, como a máscara de
# acessorio.mjs) e o meio dele, e desloca a camada pela diferença para o quadro em que ela foi pintada. Sem gerar nada.
#   py -3 e2e/pixel-art/personagem/acessorio-folha.py <acessório> <animação de onde ele foi pintado> <direção> <quadro> <saída.png> [animações...]
# A folha: por animação, uma linha sem o acessório e outra com ele; e, se houver mais quadros pintados à parte, uma linha
# com eles (para comparar "pintado uma vez e levado pelo código" com "pintado em cada quadro").
import os, sys, glob, re
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
nome, anim0, direcao, q0, saida = sys.argv[1:6]
anims = sys.argv[6:] or [anim0]
ANIMS = os.path.join(AQUI, 'mascote', 'baixa-120', 'animacoes')
ACESS = os.path.join(AQUI, 'mascote', 'acessorios', nome, anim0)

def ler(f): return np.array(Image.open(f).convert('RGBA')).astype(int)
def pelo(a): return (a[..., 3] > 200) & (a[..., 0] > 200) & (a[..., 1] > 190) & (a[..., 2] > 200)
def cranio(a):
    n = pelo(a).sum(1); maior = n.max()
    topo = int(np.argmax(n >= maior * 0.6))
    xs = np.nonzero(pelo(a)[topo])[0]
    return topo, (xs.min() + xs.max()) / 2

camada = ler(os.path.join(ACESS, f'{direcao}-{q0}.png'))
t0, c0 = cranio(ler(os.path.join(ANIMS, anim0, f'{direcao}-{q0}.png')))

def por_cima(base, cam, dx, dy):
    out = base.copy(); h, w = cam.shape[:2]
    ys, xs = np.nonzero(cam[..., 3] > 20)
    Y, X = ys + dy, xs + dx; ok = (Y >= 0) & (Y < h) & (X >= 0) & (X < w)
    out[Y[ok], X[ok]] = cam[ys[ok], xs[ok]]
    return out

def quadros(pasta):
    fs = [f for f in os.listdir(pasta) if re.fullmatch(f'{direcao}-\\d+\\.png', f)]
    return sorted(fs, key=lambda f: int(re.search(r'-(\d+)\.png', f).group(1)))

linhas = []; animados = {}
for anim in anims:
    pasta = os.path.join(ANIMS, anim); fs = quadros(pasta)
    sem = [ler(os.path.join(pasta, f)) for f in fs]
    com = []
    for a in sem:
        t, c = cranio(a); com.append(por_cima(a, camada, int(round(c - c0)), t - t0))
    linhas += [sem, com]; animados[anim] = com
    if anim == anim0:
        pintados = [f for f in quadros(ACESS)]
        if len(pintados) > 1: linhas.append([ler(os.path.join(ACESS, 'com', f)) for f in pintados])

E = 3; Q = max(a.shape[0] for l in linhas for a in l)
cols = max(len(l) for l in linhas)
folha = np.zeros((len(linhas) * Q * E, cols * Q * E, 4), np.uint8); folha[...] = (70, 70, 90, 255)
for i, l in enumerate(linhas):
    for j, a in enumerate(l):
        bloco = np.full((Q, Q, 4), (70, 70, 90, 255), np.uint8)
        m = a[..., 3] > 20; bloco[:a.shape[0], :a.shape[1]][m] = a[m].astype(np.uint8); bloco[..., 3] = 255
        folha[i * Q * E:(i + 1) * Q * E, j * Q * E:(j + 1) * Q * E] = np.kron(bloco, np.ones((E, E, 1), np.uint8))
Image.fromarray(folha).save(saida)
# e o GIF de cada animação com o acessório, ampliado 4× (a ~8 quadros por segundo, para dar tempo de olhar)
for anim, com in animados.items():
    gif = [Image.fromarray(np.kron(np.where((a[..., 3:4] > 20), a, (70, 70, 90, 255)).astype(np.uint8), np.ones((4, 4, 1), np.uint8))).convert('RGB') for a in com]
    g = os.path.splitext(saida)[0] + f'-{anim}.gif'
    gif[0].save(g, save_all=True, append_images=gif[1:], duration=125, loop=0)
print(len(linhas), 'linhas ->', saida)
