# O VIDRO SEM PINTAS (relato dele, 09/11/2026: "a janela parece ter dois pixels de artefato"). A máscara do vidro sai do
# magenta da pintura, e o serrilhado da borda deixava pixels de madeira SOLTOS dentro dela: um pixel isolado no meio do vidro
# (o arco em 364,140; a de cortinas em 352,110) e, na janela original avulsa, a beira direita do montante do meio (x 362)
# em pontilhado, ora o rosa do serrilhado (vidro), ora o marrom escuro do contorno (madeira). De dia quase não se vê; de
# noite, com a vista escura atrás, cada um vira um pontinho preto colado na moldura. Aqui eles viram vidro:
#   - o pixel de madeira com vidro em 3 dos 4 lados (o furo);
#   - o "dente": até 3 pixels de madeira seguidos numa coluna (ou linha), com vidro acima e abaixo (ou dos dois lados) da
#     fileira e, em cada um deles, vidro de um lado e madeira do outro (a beira serrilhada de um montante). Uma travessa
#     que cruza o montante não entra: do outro lado dela também há madeira.
#   py e2e/pixel-art/quarto/novo/quarto/janelas/vidro_limpo.py [--gravar] [tipo...]   → mostra (e, com --gravar, limpa) <tipo>/vidro.png
# (original-pecas.py e pecas.py chamam sem_pintas() antes de gravar.)
import os, sys
import numpy as np
from PIL import Image

MAX_DENTE = 3

def _dentes(v):
    """Os dentes verticais: fileiras de até MAX_DENTE pixels de madeira numa coluna, entre vidro, encostadas no vidro de um lado só."""
    h, w = v.shape; novo = np.zeros_like(v)
    for x in range(1, w - 1):
        col = v[:, x]; y = 1
        while y < h - 1:
            if col[y] or not col[y - 1]: y += 1; continue
            f = y
            while f < h - 1 and not col[f]: f += 1
            n = f - y  # madeira em y..f-1, vidro em y-1 e (se f < h) em f
            if f < h and col[f] and n <= MAX_DENTE:
                ys = np.arange(y, f)
                esq, dir_ = v[ys, x - 1], v[ys, x + 1]
                if np.all(esq ^ dir_): novo[ys, x] = True
            y = f
    return novo

def sem_pintas(vidro):
    v = vidro.astype(bool).copy()
    for _ in range(4):
        p = np.pad(v, 1)
        n4 = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        furo = ~v & (n4 >= 3)
        dente = _dentes(v) | _dentes(v.T).T
        mudou = furo | dente
        if not mudou.any(): break
        v |= mudou
    return v

if __name__ == '__main__':
    AQUI = os.path.dirname(os.path.abspath(__file__))
    gravar = '--gravar' in sys.argv; args = [a for a in sys.argv[1:] if a != '--gravar']
    tipos = args or [t for t in sorted(os.listdir(AQUI)) if os.path.exists(os.path.join(AQUI, t, 'vidro.png'))]
    for t in tipos:
        f = os.path.join(AQUI, t, 'vidro.png')
        v = np.array(Image.open(f).convert('L')) > 127
        l = sem_pintas(v)
        d = np.argwhere(l & ~v)
        print(t, 'pixels que viraram vidro:', len(d), [(int(x), int(y)) for y, x in d[:20]])
        if len(d) and gravar: Image.fromarray((l * 255).astype(np.uint8)).save(f, optimize=True)
