# A BASE 8 × 8 COM AS DUAS PAREDES DE TIJOLO (15/10/2026): a da direita é a da esquerda espelhada, como na casca 16 × 16.
# É onde os objetos da parede do salão são pintados (quarto/novo/quarto/parede/itens.mjs salao): pintados no reboco creme
# do quarto, eles traziam em volta a cor do quarto, que no tijolo virava mancha (relato dele).
#   python e2e/pixel-art/salao/base-tijolo.py   → base-tijolo.png
import os
import numpy as np
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__))
a = np.array(Image.open(os.path.join(AQUI, 'base.png')).convert('RGB'))
ys, xs = np.mgrid[0:512, 0:512]
chao = 253 + (xs - 256) * (114 / 216)
direita = (xs > 256) & (ys <= chao + 1)
out = a.copy()
out[direita] = a[ys[direita], 511 - xs[direita]]
Image.fromarray(out).save(os.path.join(AQUI, 'base-tijolo.png'))
print('base-tijolo.png')
