# AS PLANTAS DO QUARTO (pedido dele, 06/11/2026: "3 presets de quarto: a atual, uma sala em L e um cubículo quadradão"). As
# cascas novas saem POR CÓDIGO do quarto sem janela (sem-janela.py), sem arte nova, como a do salão 16 × 16
# (salao/casca16.py): no quarto o chão e as paredes são paralelogramos exatos (uma casa anda 27 px de lado e 14,25 px de
# altura), então cada pixel da casca nova é um pixel da antiga, levado por um número inteiro de casas.
#   - EM L: o canto do fundo vira um PILAR de 4 × 4 casas (u < 4 e v < 4 ficam fora). As duas faces dele são as paredes do
#     fundo trazidas 4 casas para a frente (4 casas = 108 px de lado e 57 de altura, inteiros: nada borra). Fora da faixa
#     do meio (x de 148 a 364), a casca é a de sempre.
#   - CUBÍCULO: 6 × 6 casas, o canto do fundo andando 2 casas para a frente (u < 2 ou v < 2 ficam fora). As paredes descem
#     57 px, inteiras (andam 2 casas em u E em v: o canto do fundo não muda de lado). As PONTAS (o fim da parede, a quina
#     escura e o pé da borda) vêm das pontas do quarto, andando 2 casas numa direção só: 28,5 px, meio pixel arredondado.
# De noite, a mesma conta sobre a noite. A luz do abajur PINTADA vale só no quarto de sempre (a pintura é daquele quarto).
#   py e2e/pixel-art/quarto/novo/quarto/janelas/plantas.py   → janelas/sem-janela-<dia|noite>-<l|cubiculo>.png
#   (--so-franja: só tira a franja clara de cima das cascas já feitas; ver sem_franja)
import os
import numpy as np
from PIL import Image
from buracos import sem_buracos

AQUI = os.path.dirname(os.path.abspath(__file__))
F0X, F0Y, CX, CY, N = 256.0, 226.0, 27.0, 14.25, 8
W = 512


def uv(x, y):
    s = (y - F0Y) / CY
    d = (x - F0X) / CX
    return (s - d) / 2, (s + d) / 2


def em_l(src):
    out = src.copy()
    fundo = src[0, 0].copy()
    for x in range(149, 364):
        for y in range(W):
            if x <= 256:
                # a face do pilar que olha para a esquerda (o plano u = 4): a parede da direita, 4 casas adiante
                xs, ys = x + 108, y - 57
                linha = F0Y + CY * (xs - F0X) / CX  # o pé da parede da direita, em xs
            else:
                xs, ys = x - 108, y - 57
                linha = F0Y + CY * (F0X - xs) / CX
            if ys <= linha + 1:
                out[y, x] = src[ys, xs] if 0 <= ys < W else fundo
    return out


def cubiculo(src):
    out = np.empty_like(src)
    fundo = src[0, 0].copy()
    out[:] = fundo
    for x in range(W):
        for y in range(W):
            u, v = uv(x + 0.5, y + 0.5)
            no_chao = 0 <= u <= N and 0 <= v <= N
            if no_chao and u >= 2 and v >= 2:
                out[y, x] = src[y, x]  # o chão que fica: o mesmo
                continue
            esq = x <= 256
            a = (310 - x) / CX if esq else (x - 202) / CX  # casas ao longo da parede nova (o plano v = 2 ou u = 2)
            linha = F0Y + CY * (a + 2)  # o pé dela
            if a >= 6.5:
                # A PONTA: a do quarto, 2 casas numa direção só (a quina, o fim da parede e o pé da borda)
                xs, ys = (x - 54, y - 29) if esq else (x + 54, y - 29)
                if 0 <= xs < W and 0 <= ys < W:
                    us, vs = uv(xs + 0.5, ys + 0.5)
                    if not (0 <= us <= N and 0 <= vs <= N):
                        out[y, x] = src[ys, xs]
                    elif y > linha:
                        out[y, x] = src[y, x]
                continue
            if y <= linha + 1:
                ys = y - 57
                out[y, x] = src[ys, x] if ys >= 0 else fundo  # a parede inteira, 2 casas em u e em v
            elif not no_chao:
                out[y, x] = src[y, x]  # a borda da frente, embaixo do chão
    return out


def sem_franja(img):
    """OS PONTINHOS CLAROS EM CIMA DA CORNIJA (relato dele, 09/11/2026: "os quartos novos têm artefatos na parte superior"): a
    casca de sempre tem, colada no contorno de cima, uma franja de pixels quase da cor do fundo (o serrilhado da pintura). No
    quarto de sempre a silhueta ideal da página os corta; nas plantas novas o fora é o fundo pela COR, e eles ficavam como
    pontinhos claros (rosados de dia, na parede de qualquer cor). Pixel encostado no fundo e quase da cor dele vira fundo."""
    out = img.copy(); fundo = img[0, 0].astype(int)
    for _ in range(3):
        e = (np.abs(out.astype(int) - fundo).max(2) <= 6)  # (de noite o fundo tem ruído de ±2)
        viz = np.zeros_like(e); viz[1:] |= e[:-1]; viz[:-1] |= e[1:]; viz[:, 1:] |= e[:, :-1]; viz[:, :-1] |= e[:, 1:]
        # (até 48 do fundo, mas não o reboco creme, que fica a ~41 dele e é mais claro: a franja é cinza-rosada e escura)
        perto = (np.abs(out.astype(int) - fundo).max(2) < 48) & (out.mean(2) < 175) & ~e & viz
        # e o pixel solto (3 ou 4 vizinhos de fundo), de qualquer cor: um de reboco ficava no vão do L, em cima da cornija
        nviz = np.zeros(e.shape, int); nviz[1:] += e[:-1]; nviz[:-1] += e[1:]; nviz[:, 1:] += e[:, :-1]; nviz[:, :-1] += e[:, 1:]
        perto |= ~e & (nviz >= 3)
        # (e o claro na quina do contorno, com fundo em cima e de um lado: o reboco que o degrau do contorno deixou de fora)
        cima = np.zeros_like(e); cima[1:] = e[:-1]
        perto |= ~e & cima & (nviz >= 2) & (out.mean(2) > 150)
        if not perto.any(): break
        out[perto] = fundo
    return out


import sys
if '--so-franja' in sys.argv:
    # só tira a franja das cascas já feitas, sem refazê-las (refeitas, a noite saía ±2 diferente da guardada)
    for q in ('dia', 'noite'):
        for nome in ('l', 'cubiculo'):
            f = os.path.join(AQUI, f'sem-janela-{q}-{nome}.png')
            Image.fromarray(sem_franja(np.array(Image.open(f).convert('RGB')))).save(f)
    sys.exit(0)
for q in ('dia', 'noite'):
    src = np.array(Image.open(os.path.join(AQUI, f'sem-janela-{q}.png')).convert('RGB'))
    for nome, f in (('l', em_l), ('cubiculo', cubiculo)):
        Image.fromarray(sem_buracos(sem_franja(f(src)))).save(os.path.join(AQUI, f'sem-janela-{q}-{nome}.png'))
        print(f'sem-janela-{q}-{nome}.png')
