# OS CINZAS SOLTOS (10/11/2026, relato dele: "achei outro artefato no coelho", o pescoço e o lado da cabeça do mascote de
# olho fechado). O PixelLab reduz as cores a uma paleta, e nela vêm dois cinzas NEUTROS, (75,75,75) e (133,133,133), que não
# são de nenhuma parte do coelho (o pelo é lavanda, o moletom vinho, o contorno quase preto). Onde eles aparecem SOZINHOS (um
# pedaço de até 4 px desses cinzas), são resto da redução: viram a cor mais comum dos vizinhos que não são cinza, ou somem
# quando estão por fora do contorno (5 ou mais vizinhos transparentes). Pedaço maior fica: pode ser um objeto cinza de
# verdade (o livro, o controle).
#   py -3 e2e/pixel-art/personagem/limpar-cinzas.py <corpo> [--so-contar]
import glob, os, sys
from collections import Counter
import numpy as np
from PIL import Image
from scipy import ndimage

AQUI = os.path.dirname(os.path.abspath(__file__))
CINZAS = [(75, 75, 75), (133, 133, 133)]
MAXIMO = 4


def limpar(a):
    al = a[..., 3] > 0
    cinza = np.zeros(al.shape, bool)
    for c in CINZAS: cinza |= al & (a[..., 0] == c[0]) & (a[..., 1] == c[1]) & (a[..., 2] == c[2])
    rot, n = ndimage.label(cinza, structure=np.ones((3, 3)))
    if not n: return 0
    tam = ndimage.sum(cinza, rot, range(1, n + 1))
    trocar = np.isin(rot, [k + 1 for k, t in enumerate(tam) if t <= MAXIMO])
    H, W = al.shape
    feitos = 0
    for y, x in zip(*np.nonzero(trocar)):
        viz, vazios = [], 0
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not dy and not dx: continue
                yy, xx = y + dy, x + dx
                if not (0 <= yy < H and 0 <= xx < W) or not al[yy, xx]: vazios += 1; continue
                if not cinza[yy, xx]: viz.append(tuple(a[yy, xx]))
        if vazios >= 5 or not viz: a[y, x] = 0
        else: a[y, x] = Counter(viz).most_common(1)[0][0]
        feitos += 1
    return feitos


if __name__ == '__main__':
    corpo = sys.argv[1]
    so_contar = '--so-contar' in sys.argv
    total = 0
    for f in sorted(glob.glob(os.path.join(AQUI, corpo, 'baixa-120', 'animacoes', '*', '*.png')) + glob.glob(os.path.join(AQUI, corpo, 'estados', '*', '*.png')) + glob.glob(os.path.join(AQUI, corpo, 'transicoes', '*', '*.png')) + glob.glob(os.path.join(AQUI, corpo, 'baixa-120', '*.png'))):
        if os.path.basename(f).startswith(('folha', 'revisao')) or 'falhas' in f: continue
        a = np.array(Image.open(f).convert('RGBA'))
        n = limpar(a)
        if n:
            total += n
            if not so_contar: Image.fromarray(a).save(f)
    print(f'{corpo}: {total} pixels de cinza solto' + (' (só contados)' if so_contar else ' trocados'))
