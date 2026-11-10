# TIRA O QUE FLUTUA SOLTO nos quadros de uma animação (09/11/2026, o "parado" da orelha caída: o PixelLab desenhou
# bolinhas e gotas em cima da cabeça). Fica só o que encosta no corpo: o maior pedaço de desenho e o que toca nele
# (vizinhança de 8), e o que encosta nele só por um fio de 1 px. Um pedaço que é do corpo e se solta de propósito (uma
# lágrima, um "z") não sobrevive: animação que precisa disso não passa por aqui.
#
# OS PICOS (10/11/2026, relato dele: uma bolinha grudada no alto da cabeça do orelhudo, presa por um pescoço de 2 px, que
# o corte do fio não pegava): em cada direção, o quadro cujo alto do desenho sobe 5 px ou mais acima dos DOIS vizinhos
# perde o que passa da altura deles (com 1 px de folga), e depois passa pela limpeza de novo. Um movimento de verdade (o
# braço que sobe no aceno) dura mais de um quadro, e por isso não é pico.
#   py -3 e2e/pixel-art/personagem/limpar-soltos.py <pasta da animação> [direção]
import os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage

pasta = sys.argv[1]; direcao = sys.argv[2] if len(sys.argv) > 2 else None
PICO = 5

def soltos(a):
    desenho = a[..., 3] > 0
    rot, n = ndimage.label(desenho, structure=np.ones((3, 3)))
    if not n: return np.zeros(desenho.shape, bool)
    maior = np.argmax(np.bincount(rot.ravel())[1:]) + 1
    fora = (rot > 0) & (rot != maior)
    # O que encosta no corpo por um FIO (a faísca grudada no alto da cabeça): afina o corpo 1 px, fica o maior pedaço
    # afinado, e volta só o que está a até 2 px dele. O contorno do corpo (1–2 px) volta inteiro; o efeito, só o toco.
    fino = ndimage.binary_erosion(rot == maior, structure=np.ones((3, 3)))
    r2, n2 = ndimage.label(fino, structure=np.ones((3, 3)))
    if n2:
        corpo = r2 == (np.argmax(np.bincount(r2.ravel())[1:]) + 1)
        perto = ndimage.binary_dilation(corpo, structure=np.ones((3, 3)), iterations=2)
        fora |= (rot == maior) & ~perto
    return fora

# os quadros por direção, em ordem
grupos = {}
for f in os.listdir(pasta):
    m = re.fullmatch(r'([a-z-]+)-(\d+)\.png', f)
    if not m or (direcao and m.group(1) != direcao): continue
    grupos.setdefault(m.group(1), []).append((int(m.group(2)), f))

mudou = 0
for d, fs in grupos.items():
    fs.sort()
    imgs = [np.array(Image.open(os.path.join(pasta, f)).convert('RGBA')) for _, f in fs]
    # o alto do desenho de cada quadro, na altura do maior quadro (as animações mudam de tamanho, centradas)
    H = max(a.shape[0] for a in imgs)
    topo = [int(np.nonzero((a[..., 3] > 0).any(1))[0].min()) + (H - a.shape[0]) // 2 for a in imgs]
    for i, (a, (_, f)) in enumerate(zip(imgs, fs)):
        antes = a.copy()
        viz = [topo[j] for j in (i - 1, (i + 1) % len(fs)) if 0 <= j < len(fs) and j != i]
        if len(viz) == 2 and topo[i] <= min(viz) - PICO:
            corte = min(viz) - 1 - (H - a.shape[0]) // 2
            a[:max(0, corte)] = 0
        a[soltos(a)] = 0
        if not np.array_equal(a, antes):
            Image.fromarray(a).save(os.path.join(pasta, f)); mudou += 1
print(f'{mudou} quadro(s) limpos em {pasta}')
