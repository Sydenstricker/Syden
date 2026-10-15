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


SEAMS = [CANTO + PERIODO * i for i in range(1, 4)]  # onde o trecho recomeça (6, 10, 14)
FAIXA = 0.6  # meia largura, em casas, da faixa em que a costura procura o caminho


def costurar(coord, outra, cor, valido, px_por_casa):
    """A COSTURA (relato dele, 15/10/2026: "tem falhas no tijolo da parede"): no corte reto em cada recomeço do trecho,
    as fiadas do tijolo e o lambri davam um degrau. Na faixa da emenda há duas cópias possíveis de cada pixel (a do trecho
    que termina, a do que começa); a costura acha, linha a linha, o caminho onde as duas mais se parecem (com passos de no
    máximo um pixel entre linhas, como na costura de texturas) e troca de cópia ali. Não borra: cada pixel vem de uma cópia.
    coord: as casas ao longo do eixo da emenda (a, u ou v), por pixel; devolve as casas na base, já costuradas."""
    base = dobrar(coord)
    H, W = coord.shape
    for A in SEAMS:
        t = coord - A
        banda = valido & (np.abs(t) <= FAIXA)
        if not banda.any(): continue
        aL, aR = coord - (A - (CANTO + PERIODO)), coord - (A - CANTO)  # continua o trecho que termina / o que começa
        cL, cR = cor(aL, outra), cor(aR, outra)
        dif = np.abs(cL - cR).sum(2)
        nb = int(np.ceil(2 * FAIXA * px_por_casa)) + 1
        bins = np.clip(np.round((t + FAIXA) * px_por_casa).astype(int), 0, nb - 1)
        linhas = np.nonzero(banda.any(1))[0]
        custo = np.full((len(linhas), nb), 1e9)
        for i, y in enumerate(linhas):
            xs = np.nonzero(banda[y])[0]
            c = np.full(nb, 1e9)
            np.minimum.at(c, bins[y, xs], dif[y, xs])
            # bins vazios desta linha: o custo do vizinho (para o caminho poder passar)
            ok = c < 1e9
            if ok.any():
                idx = np.nonzero(ok)[0]
                c = np.interp(np.arange(nb), idx, c[idx])
            custo[i] = c
        # programação dinâmica de cima para baixo
        acum = custo.copy(); de = np.zeros_like(acum, dtype=int)
        for i in range(1, len(linhas)):
            if linhas[i] != linhas[i - 1] + 1: continue
            prev = acum[i - 1]
            cand = np.stack([np.roll(prev, 1), prev, np.roll(prev, -1)]); cand[0, 0] = cand[2, -1] = 1e12
            k = cand.argmin(0); acum[i] = custo[i] + cand[k, np.arange(nb)]; de[i] = np.arange(nb) + (k - 1)
        corte = np.zeros(len(linhas), int); corte[-1] = int(acum[-1].argmin())
        for i in range(len(linhas) - 1, 0, -1):
            corte[i - 1] = de[i, corte[i]] if linhas[i] == linhas[i - 1] + 1 else int(acum[i - 1].argmin())
        cortes = np.full(H, nb // 2); cortes[linhas] = corte
        usaL = banda & (bins < cortes[:, None])
        usaR = banda & ~usaL
        base = np.where(usaL, aL, np.where(usaR, aR, base))
    return base


def montar(fonte):
    src = np.array(Image.open(fonte).convert('RGB'))
    fundo = src[0, 0].copy()
    ys, xs = np.mgrid[0:W1, 0:W1].astype(float)
    sx = np.full(xs.shape, -1.0); sy = np.full(xs.shape, -1.0)
    # 1) o chão
    s = (ys - F1[1]) / CY; d = (xs - F1[0]) / CX  # u + v e v - u
    u = (s - d) / 2; v = (s + d) / 2
    chao = (u >= 0) & (v >= 0) & (u <= N1) & (v <= N1)
    srcf = src.astype(float)
    def cor_chao(uu_, vv_):
        x = np.clip(np.round(F0[0] - CX * uu_ + CX * vv_).astype(int), 0, src.shape[1] - 1)
        y = np.clip(np.round(F0[1] + CY * (uu_ + vv_)).astype(int), 0, src.shape[0] - 1)
        return srcf[y, x]
    vv = dobrar(v)
    uu = costurar(u, vv, cor_chao, chao, 54)
    vv = costurar(v, uu, lambda a, b: cor_chao(b, a), chao, 54)
    sx = np.where(chao, F0[0] - CX * uu + CX * vv, sx); sy = np.where(chao, F0[1] + CY * (uu + vv), sy)
    # 2) as paredes (a da esquerda é v = 0; a da direita, u = 0): casas ao longo dela e altura acima do chão
    for lado in (-1, 1):
        a = (xs - F1[0]) * lado / CX
        h = F1[1] + CY * a - ys
        ok = ~chao & (sx < 0) & (a >= 0) & (a <= N1 + 0.4) & (h >= -1) & (h <= ALTURA) & ((xs - F1[0]) * lado >= 0)
        def cor_parede(a_, h_):
            x = np.clip(np.round(F0[0] - CX * a_).astype(int), 0, src.shape[1] - 1)
            y = np.clip(np.round(F0[1] + CY * a_ - h_).astype(int), 0, src.shape[0] - 1)
            return srcf[y, x]
        aa = costurar(np.minimum(a, N1), h, cor_parede, ok, 27) + np.maximum(0, a - N1)
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
