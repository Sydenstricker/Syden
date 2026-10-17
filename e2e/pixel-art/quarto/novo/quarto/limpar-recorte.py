# Tira do recorte de uma peça CONVEXA (o pufe, o tapete) os restos do chão que vieram colados na borda.
#
# Relato dele (17/10/2026): "dependendo da posição do puff, ele fica com artefatos nas bordas", e o tapete também. A causa
# não era a luz: as peças foram pintadas DENTRO da base e recortadas, e o recorte trouxe pontinhos do chão e um pedaço da
# sombra pintada, opacos. No lugar onde foram pintadas eles somem no chão igual; arrastadas, aparecem, e o contorno do
# realce (que segue cada pixel da peça) os desenha um a um.
#
# Como: abre a máscara (some o que tem 1 a 2 px de largura), fica a maior parte, tira o fecho convexo dela, alargado em
# 1 px para não comer a linha da borda, e apaga o que está fora. Por fim, os pixels soltos que sobraram na beirada.
# Uso: python -I limpar-recorte.py pecas/pufe-frente.png ...  (e --dupla para o que é simétrico também de cima a baixo: o tapete)
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import ConvexHull

for f in [a for a in sys.argv[1:] if not a.startswith('--')]:
    im = np.array(Image.open(f).convert('RGBA'))
    m = im[:, :, 3] > 0
    aberta = ndimage.binary_opening(m, structure=np.ones((3, 3)), iterations=2)
    rot, n = ndimage.label(aberta)
    maior = rot == (np.argmax(ndimage.sum(aberta, rot, range(1, n + 1))) + 1)
    ys, xs = np.nonzero(maior)
    pts = np.stack([xs, ys], 1)
    # os cantos de cada pixel, para o fecho cobrir o pixel inteiro
    cantos = np.concatenate([pts, pts + [1, 0], pts + [0, 1], pts + [1, 1]])
    h = cantos[ConvexHull(cantos).vertices]
    casco = Image.new('L', (m.shape[1], m.shape[0]), 0)
    ImageDraw.Draw(casco).polygon([tuple(p) for p in h.astype(float)], fill=255)
    dentro = ndimage.binary_dilation(np.array(casco) > 0, structure=np.ones((3, 3)))
    novo = m & dentro
    # A SIMETRIA: o pufe é igual dos dois lados, e o tapete também de cima a baixo. O resto colado só de um lado (a sombra
    # pintada à esquerda do pufe, os pontinhos embaixo do tapete) não tem par no espelho, e sai; a borda de verdade, que
    # pode diferir em 1 px de um lado para o outro, fica (o espelho é alargado em 1 px).
    for eixo in ([1, 0] if '--dupla' in sys.argv else [1]):
        melhor = None
        ix = np.nonzero(novo.any(axis=1 - eixo))[0]
        for dobro in range(ix.min() + ix.max() - 8, ix.min() + ix.max() + 9):
            esp = np.flip(novo, eixo)
            desl = dobro - novo.shape[eixo] + 1  # o centro em dobro/2: x -> dobro - x
            esp = np.roll(esp, desl, eixo)
            iguais = int((novo & esp).sum())
            if melhor is None or iguais > melhor[0]: melhor = (iguais, esp)
        par = ndimage.binary_dilation(melhor[1], structure=np.ones((3, 3)))
        novo &= par
    # pontas de 1 px que sobraram na beirada (um vizinho só, nas 4 direções)
    for _ in range(3):
        viz = sum(np.roll(novo, s, a) for a in (0, 1) for s in (1, -1))
        novo &= ~(viz <= 1)
    tirados = int(m.sum() - novo.sum())
    im[~novo] = 0
    Image.fromarray(im).save(f)
    print(f, 'tirados', tirados, 'de', int(m.sum()))
