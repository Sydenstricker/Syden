# O SALÃO 16 × 16 (pedido dele, 15/10/2026: "imaginei o hall comunitário maior, algo como 4× o tamanho atual"). A casca
# (paredes, chão, a borda da frente e as luzinhas) sai da base 8 × 8 por código, sem gerar arte nova: na base o chão e as
# paredes são paralelogramos exatos (uma casa anda 27 px de lado e 14,25 px de altura), então cada pixel do salão grande
# vira um ponto do chão (u, v), de uma parede (casas ao longo dela, altura) ou da borda da frente (casas, profundidade),
# e esse ponto é buscado na base. Os cantos (o do fundo e as pontas) vêm da base como estão; o meio repete um trecho de
# 4 casas (4 casas = 108 px de lado e 57 de altura, inteiros: a repetição não borra). A noite usa a MESMA conta sobre a
# noite da base, e por isso as duas casam pixel a pixel.
#   python e2e/pixel-art/salao/casca16.py   → base16.png, noite16.png (1024 × 1024; o fundo do chão em (512, 253))
import os
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
# A base 8 × 8 (e o salão grande): o canto do fundo, no chão, e a grade.
F0, N0 = (256.0, 253.0), 8
F1, N1, W1 = (512.0, 253.0), 16, 1024
CX, CY = 27.0, 14.25
PERIODO, CANTO = 4.0, 2.0  # o trecho que se repete, e quanto de cada ponta fica como está
ALTURA, BORDA = 270.0, 40.0  # até onde vão a parede (com a moldura de cima) e a borda da frente


def dobrar(a):
    """Casas no salão grande → casas na base: as primeiras e as últimas como estão, o meio repetindo."""
    a = np.asarray(a, float)
    meio = CANTO + np.mod(a - CANTO, PERIODO)
    return np.where(a <= CANTO, a, np.where(a >= N1 - CANTO, a - (N1 - N0), meio))


def montar(fonte):
    src = np.array(Image.open(fonte).convert('RGB'))
    fundo = src[0, 0].copy()
    ys, xs = np.mgrid[0:W1, 0:W1].astype(float)
    sx = np.full(xs.shape, -1.0); sy = np.full(xs.shape, -1.0)
    # 1) o chão
    s = (ys - F1[1]) / CY; d = (xs - F1[0]) / CX  # u + v e v - u
    u = (s - d) / 2; v = (s + d) / 2
    chao = (u >= 0) & (v >= 0) & (u <= N1) & (v <= N1)
    uu, vv = dobrar(u), dobrar(v)
    sx = np.where(chao, F0[0] - CX * uu + CX * vv, sx); sy = np.where(chao, F0[1] + CY * (uu + vv), sy)
    # 2) as paredes (a da esquerda é v = 0; a da direita, u = 0): casas ao longo dela e altura acima do chão
    for lado in (-1, 1):
        a = (xs - F1[0]) * lado / CX
        h = F1[1] + CY * a - ys
        ok = ~chao & (sx < 0) & (a >= 0) & (a <= N1 + 0.4) & (h >= -1) & (h <= ALTURA) & ((xs - F1[0]) * lado >= 0)
        aa = dobrar(np.minimum(a, N1)) + np.maximum(0, a - N1)
        # AS DUAS PAREDES SÃO A DE TIJOLO (pedido dele, 15/10/2026: "o estilo das duas paredes é bem diferente"): a da
        # direita é a da esquerda espelhada, como no quarto sem janela (quarto/novo/quarto/janelas/sem-janela.py).
        sx = np.where(ok, F0[0] - CX * aa, sx); sy = np.where(ok, F0[1] + CY * aa - h, sy)
    # 3) a borda da frente, embaixo dos dois lados do chão que dão para quem olha
    for lado in (-1, 1):
        # do canto da ponta (u = N ou v = N) até a frente, andando na outra direção
        x0 = F1[0] + lado * CX * N1  # a ponta (esquerda ou direita)
        b = (xs - x0) * (-lado) / CX
        p = ys - (F1[1] + CY * N1 + CY * b)
        ok = (sx < 0) & (b >= -0.4) & (b <= N1 + 0.4) & (p > 0) & (p <= BORDA)
        bb = dobrar(np.clip(b, 0, N1)) + np.minimum(0, b) + np.maximum(0, b - N1)
        xs0 = F0[0] + lado * CX * N0
        sx = np.where(ok, xs0 - lado * CX * bb, sx); sy = np.where(ok, F0[1] + CY * N0 + CY * bb + p, sy)
    out = np.empty((W1, W1, 3), np.uint8); out[:] = fundo
    tem = sx >= 0
    ix = np.clip(np.round(sx).astype(int), 0, src.shape[1] - 1); iy = np.clip(np.round(sy).astype(int), 0, src.shape[0] - 1)
    out[tem] = src[iy[tem], ix[tem]]
    return out


for nome, saida in (('base.png', 'base16.png'), ('noite.png', 'noite16.png')):
    Image.fromarray(montar(os.path.join(AQUI, nome))).save(os.path.join(AQUI, saida))
    print(saida)
