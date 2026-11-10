# OS TOCOS DE QUALQUER TOM (10/11/2026, achado dele no "parado" sudeste 0 do mascote: uma coluna de 4 px POR FORA do contorno
# preto, à esquerda da cabeça, em tons médios e escuros (122,103,123), (75,75,75), (61,43,54); e um cinza neutro (133,133,133)
# na base da orelha). A regra do toco de limpar-soltos.py (`fora_do_contorno`) só olhava pixels CLAROS, e a dos brilhos, só o
# verde, o amarelo e o branco; estes passavam pelas duas. Usado por limpar-soltos.py (que apaga) e auditoria-de-camadas.py
# (que marca).
#
#   toco_por_fora(a): pixel que NÃO é contorno, com o vazio de um lado e o contorno escuro do lado OPOSTO (numa das 4
#     direções: esquerda/direita, cima/baixo), ou seja, do lado de fora do traço, e sem contorno no eixo de través (o degrau
#     do serrilhado); agrupado (vizinhança de 8) só com outros pixels assim, o pedaço de 2 a 8 px que não encosta em tom quente (livro, rosa da orelha) sai. A mão, a ponta da orelha e o tênis têm o contorno POR FORA deles (o vazio
#     encosta no contorno, não neles), então não entram.
#   cinza_no_pelo(a): cinza neutro (|r−g| e |g−b| < 6, luminância de 90 a 200) cercado de pelo lavanda (6 ou mais dos 8
#     vizinhos) e sem outro cinza neutro encostado → vira a cor do pelo vizinho. O pelo é lavanda (azul acima do verde); o cinza neutro ali é resto de efeito.
import numpy as np
from scipy import ndimage

CONTORNO = 45  # luminância abaixo da qual o pixel é traço

def _lum(a): return a[..., :3].astype(float) @ [0.299, 0.587, 0.114]

def _viz(m, dy, dx, fora=False):
    """m deslocado: o valor do vizinho em (y+dy, x+dx); fora da imagem vale `fora`."""
    h, w = m.shape; out = np.full((h, w), fora, bool)
    ys0, ys1 = max(0, -dy), min(h, h - dy); xs0, xs1 = max(0, -dx), min(w, w - dx)
    out[ys0:ys1, xs0:xs1] = m[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
    return out

def toco_por_fora(a, maximo=8):
    op = a[..., 3] > 20; contorno = op & (_lum(a) < CONTORNO)
    cand = np.zeros_like(op)
    for dy, dx in ((0, 1), (1, 0)):
        v1, c1 = ~_viz(op, dy, dx, False), _viz(contorno, dy, dx)
        v2, c2 = ~_viz(op, -dy, -dx, False), _viz(contorno, -dy, -dx)
        # e nenhum contorno nos dois vizinhos do eixo de través: o pixel do degrau do traço (o serrilhado, no canto de dentro
        # da escada do contorno) tem o contorno de um lado E em cima ou embaixo; o toco fica solto ao longo do traço
        trav = _viz(contorno, dx, dy) | _viz(contorno, -dx, -dy)
        cand |= ((v1 & c2) | (v2 & c1)) & ~trav
    cand &= op & ~contorno
    rot, n = ndimage.label(cand, structure=np.ones((3, 3)))
    if not n: return cand
    tam = np.bincount(rot.ravel()); tam[0] = 0
    # de 2 px para cima: o pixel SOZINHO assim é quase sempre o serrilhado do traço no começo de uma curva (medido nos três
    # corpos, 10/11/2026: centenas, todos do desenho); o toco do efeito é uma fileira ao longo do traço
    # e o pedaço que encosta num tom QUENTE (o marrom da capa do livro, o rosa de dentro da orelha) é a borda de uma coisa
    # desenhada, não um toco: o livro do deitar-lendo do mascote tem a quina assim. O toco do efeito só encosta no vazio, no
    # traço e no pelo (lavanda, com o azul acima do vermelho).
    rgb = a[..., :3].astype(int); L = _lum(a)
    quente = op & (rgb[..., 0] > rgb[..., 2] + 15) & (L >= CONTORNO) & (L < 230)
    bons = []
    for k in range(1, n + 1):
        if not 2 <= tam[k] <= maximo: continue
        m = rot == k
        borda = ndimage.binary_dilation(m, structure=np.ones((3, 3))) & ~m
        if (borda & quente).any(): continue
        # e o toco fica SOLTO ao longo do traço: em volta dele só vazio e traço, e no máximo 2 px de outra coisa (a ponta da
        # fileira que encosta no pelo). A borda da página do livro e o polegar da mão encostam em muito mais do desenho deles.
        if (borda & op & ~contorno).sum() > 2: continue
        bons.append(k)
    return np.isin(rot, bons)

def _lavanda(a):
    rgb = a[..., :3].astype(int); r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (a[..., 3] > 20) & (b > g + 4) & (_lum(a) >= 120)

def cinza_no_pelo(a):
    rgb = a[..., :3].astype(int); r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]; L = _lum(a)
    cinza = (a[..., 3] > 20) & (abs(r - g) < 6) & (abs(g - b) < 6) & (L >= 90) & (L <= 200)
    lav = _lavanda(a).astype(int)
    em_volta = ndimage.convolve(lav, np.ones((3, 3), int), mode='constant', cval=0) - lav
    # e SOZINHO: nenhum outro cinza neutro em volta (a sombra cinza das bochechas, em alguns quadros, vem em grupo e é do desenho)
    ci = cinza.astype(int)
    outros = ndimage.convolve(ci, np.ones((3, 3), int), mode='constant', cval=0) - ci
    return cinza & (em_volta >= 6) & (outros == 0)

def consertar_cinza(a):
    """Pinta cada cinza isolado no pelo com a cor do pelo lavanda mais perto. Devolve quantos."""
    m = cinza_no_pelo(a)
    if m.any():
        lav = _lavanda(a) & ~m
        _, (iy, ix) = ndimage.distance_transform_edt(~lav, return_indices=True)
        a[m] = a[iy[m], ix[m]]
    return int(m.sum())

def brilho_de_verdade(a, marca):
    """Dos pixels com cor de faísca (`brilhos` do limpar-soltos.py, a regra 5 da auditoria), só os que são EFEITO: o pedaço
    (vizinhança de 8) que não encosta em nada escuro (luminância < 80) nem quente (o vermelho acima do azul). O brilho do olho
    aberto (o branco dentro do olho escuro, no sofá e no susto) e as páginas do livro (brancas, encostadas na capa marrom) são
    do desenho, e a regra os apagava (10/11/2026, medido nas poses do sofá e no lendo-deitado do mascote)."""
    if not marca.any(): return marca
    rgb = a[..., :3].astype(int); L = _lum(a); op = a[..., 3] > 20
    escuro_ou_quente = op & ((L < 80) | (rgb[..., 0] > rgb[..., 2] + 15))
    rot, n = ndimage.label(marca, structure=np.ones((3, 3)))
    perto = ndimage.binary_dilation(escuro_ou_quente, structure=np.ones((3, 3)))
    ruins = set(rot[perto & marca].tolist()) - {0}
    return marca & ~np.isin(rot, list(ruins))

def sem_quentes(a, marca):
    """Tira da marca o pedaço (vizinhança de 8) que encosta num tom QUENTE (o vermelho acima do azul: a capa marrom do livro, o
    rosa da orelha): a borda clara da página do livro tem o vazio em cima e o traço embaixo, como um toco, e a regra
    `fora_do_contorno` a apagava (10/11/2026, o deitar-lendo do mascote)."""
    if not marca.any(): return marca
    rgb = a[..., :3].astype(int); L = _lum(a); op = a[..., 3] > 20
    quente = op & (rgb[..., 0] > rgb[..., 2] + 15) & (L >= CONTORNO) & (L < 230) & ~marca
    rot, n = ndimage.label(marca, structure=np.ones((3, 3)))
    # até 3 px: o traço de cima do livro encosta na página branca, e só ela na capa
    perto = ndimage.binary_dilation(quente, structure=np.ones((3, 3)), iterations=3)
    return marca & ~np.isin(rot, list(set(rot[perto & marca].tolist()) - {0}))
