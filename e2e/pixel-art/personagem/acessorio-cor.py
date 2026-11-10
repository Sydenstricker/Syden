# TIRA A MANCHA CLARA DE DENTRO DE UM ACESSÓRIO DE COR (09/11/2026, relato dele: "o boné do coelho orelhudo parece estar com
# artefato"). Nas vistas de costas, o PixelLab pintou a abertura de trás do boné como um borrão cinza-claro. Dentro da
# camada, o pixel claro e sem cor (cinza ou branco, nem vermelho nem contorno) vira a cor dos vizinhos coloridos. Só para
# acessório de cor chapada; um acessório que tem branco de propósito (uma faixa, um logotipo) não passa por aqui.
#   py -3 e2e/pixel-art/personagem/acessorio-cor.py <corpo> <acessório> [origem=parado]
import os, sys, glob
import numpy as np
from PIL import Image
from scipy import ndimage

AQUI = os.path.dirname(os.path.abspath(__file__))
corpo, acc = sys.argv[1], sys.argv[2]; origem = sys.argv[3] if len(sys.argv) > 3 else 'parado'
for f in sorted(glob.glob(os.path.join(AQUI, corpo, 'acessorios', acc, origem, '*-*.png'))):
    a = np.array(Image.open(f).convert('RGBA')).astype(int)
    op = a[..., 3] > 20
    mx, mn = a[..., :3].max(-1), a[..., :3].min(-1)
    claro_sem_cor = op & (mn > 120) & ((mx - mn) < 45)
    if not claro_sem_cor.any(): continue
    colorido = op & ~claro_sem_cor & ((mx - mn) >= 45)
    # cada pixel ruim recebe a cor do pixel colorido mais perto
    _, (iy, ix) = ndimage.distance_transform_edt(~colorido, return_indices=True)
    a[claro_sem_cor] = a[iy[claro_sem_cor], ix[claro_sem_cor]]
    Image.fromarray(a.astype(np.uint8)).save(f)
    print(os.path.relpath(f, AQUI), int(claro_sem_cor.sum()), 'pixels')
