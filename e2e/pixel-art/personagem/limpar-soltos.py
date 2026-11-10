# TIRA O QUE FLUTUA SOLTO nos quadros de uma animação (09/11/2026, o "parado" da orelha caída: o PixelLab desenhou
# bolinhas e gotas em cima da cabeça). Fica só o que encosta no corpo: o maior pedaço de desenho e o que toca nele
# (vizinhança de 8), e o que encosta nele só por um fio de 1 px. Um pedaço que é do corpo e se solta de propósito (uma lágrima, um "z") não sobrevive: animação que
# precisa disso não passa por aqui.
#   py -3 e2e/pixel-art/personagem/limpar-soltos.py <pasta da animação> [direção]
import os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage

pasta = sys.argv[1]; direcao = sys.argv[2] if len(sys.argv) > 2 else None
mudou = 0
for f in sorted(os.listdir(pasta)):
    if not re.fullmatch(r'[a-z-]+-\d+\.png', f) or (direcao and not f.startswith(direcao + '-')): continue
    p = os.path.join(pasta, f); a = np.array(Image.open(p).convert('RGBA'))
    desenho = a[..., 3] > 0
    rot, n = ndimage.label(desenho, structure=np.ones((3, 3)))
    if not n: continue
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
    if fora.any():
        a[fora] = 0; Image.fromarray(a).save(p); mudou += 1
print(f'{mudou} quadro(s) limpos em {pasta}')
