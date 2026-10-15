# O QUARTO SEM A JANELA (pedido dele, 15/10/2026: "mudar a janela de lugar, o tipo de janela"). A janela vira uma peça
# da parede, e o quarto precisa da parede sem ela. A parede da direita é a da ESQUERDA espelhada (o quarto é simétrico:
# os cantos do chão ficam a 216 px do meio), vezes a razão de cor medida nos pedaços lisos que a janela deixava ver
# (uma razão que anda em x e em y, porque a da direita é mais escura e mais quente). As pontas da cortina que desciam
# no chão saem trocadas pela tábua uma casa adiante, ao longo da tábua (as tábuas correm em u).
#   python e2e/pixel-art/quarto/novo/quarto/janelas/sem-janela.py   → janelas/sem-janela-<dia|noite|noite-abajur>.png
import os
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
Q = os.path.dirname(AQUI)
chao = lambda x: 226 + (x - 256) * (114 / 216)  # a borda do chão na parede da direita (chao.mjs: fundo → direita)
# A janela com as cortinas (as REGIOES de montar.mjs), onde o chão tem ponta de cortina.
REGIOES = [[(276, 64), (466, 158), (466, 318), (276, 268)], [(416, 298), (470, 312), (470, 344), (416, 340)]]

def dentro(x, y, R):
    s = False
    for i in range(len(R)):
        (xi, yi), (xj, yj) = R[i], R[i - 1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: s = not s
    return s

DIA = np.array(Image.open(os.path.join(Q, '..', 'bases', 'pl-512-janela-1.png')).convert('RGB')).astype(float)
FORA = np.abs(DIA - DIA[0, 0]).max(2) < 24  # o cinza em volta do quarto, medido no dia (de noite ele é parecido com a parede)

# As pontas da cortina no chão (com o contorno e a sombra delas): as duas faixas embaixo das cortinas, trocadas pela
# tábua uma casa adiante em u (a mesma tábua, porque elas correm em u).
def tirar_pontas(out, b):
    ponta = lambda x, y: (279 <= x <= 320 or 414 <= x <= 471) and chao(x) + 2 < y < chao(x) + 17
    for y in range(512):
        for x in range(257, 472):
            if not ponta(x, y): continue
            sx, sy = x - 27, y + 14
            while ponta(sx, sy): sx, sy = sx - 27, sy + 14
            out[y, x] = b[sy, sx]

def sem_janela_dia():
    b = DIA
    m = b[:, ::-1]
    # Os pedaços lisos da parede da direita: entre o canto e a cortina, depois da cortina, e embaixo do peitoril.
    pts = [(x, y) for x in range(258, 275) for y in range(60, int(chao(x)) - 8)]
    pts += [(x, y) for x in range(463, 471) for y in range(170, int(chao(x)) - 8)]
    pts += [(x, y) for x in range(335, 420) for y in range(int(chao(x)) - 22, int(chao(x)) - 9)]
    X = np.array([p[0] for p in pts]); Y = np.array([p[1] for p in pts])
    r = b[Y, X] / np.maximum(1, m[Y, X])
    A = np.stack([np.ones_like(X), X, Y], 1).astype(float)
    coef = [np.linalg.lstsq(A, r[:, c], rcond=None)[0] for c in range(3)]
    out = b.copy()
    for x in range(257, 472):
        for y in range(0, int(chao(x)) + 3):
            if FORA[y, x]: continue
            out[y, x] = np.clip(m[y, x] * np.array([coef[c][0] + coef[c][1] * x + coef[c][2] * y for c in range(3)]), 0, 255)
    tirar_pontas(out, b)
    return out


# DE NOITE: a parede da direita é o dia sem janela vezes a luz da noite da parede da ESQUERDA, espelhada (a esquerda já
# é o dia vezes a luz média da noite, noite.mjs, sem luar nenhum).
# O CHÃO de noite tem o LUAR desenhado (os quadrados da janela): ele sai, e a luz do lugar vem da noite em volta
# (a razão noite/dia de fora do luar, espalhada para dentro dele). O que sai vira a camada do luar da janela original
# (janelas/original/luar.png: a razão, × 100), que anda com a janela.
def piso(x, y):
    return y > chao(x) - 1 if x >= 256 else y > 226 + (256 - x) * (114 / 216) - 1

dia = sem_janela_dia()
Image.fromarray(dia.astype(np.uint8)).save(os.path.join(AQUI, 'sem-janela-dia.png'))
noite = np.array(Image.open(os.path.join(Q, 'noite.png')).convert('RGB')).astype(float)
abajur = np.array(Image.open(os.path.join(Q, 'noite-abajur.png')).convert('RGB')).astype(float)
noite0 = noite.copy()
tirar_pontas(noite, noite0.copy()); tirar_pontas(abajur, abajur.copy())
ys, xs = np.mgrid[0:512, 0:512]
chaoM = (xs >= 256) & (ys > chao(xs) - 1) | (xs < 256) & (ys > 226 + (256 - xs) * (114 / 216) - 1)
chaoM &= ~FORA
paredeD = (xs >= 257) & (xs < 472) & ~chaoM & ~FORA
RN = noite / np.maximum(1, DIA)
# O luar: no chão, onde a noite fica bem acima da luz em volta dela (o borrão largo da razão).
from scipy.ndimage import gaussian_filter, binary_dilation
def borrar(a, r):
    return np.stack([gaussian_filter(a[..., c], r) for c in range(3)], 2)
medio = borrar(np.where(chaoM[..., None], RN, 0.3), 14)
# (só na caixa onde ele foi pintado: no resto do chão, o limiar pegava o grão das tábuas)
luarM = chaoM & (RN.mean(2) > medio.mean(2) * 1.18) & (xs >= 210) & (xs < 390) & (ys >= 262) & (ys < 372)
# alarga um pixel (a borda dos quadrados)
for _ in range(2): luarM = luarM | np.roll(luarM, 1, 0) | np.roll(luarM, -1, 0) | np.roll(luarM, 1, 1) | np.roll(luarM, -1, 1)
# O desenho inteiro: o contorno convexo do que passou do limiar, um pouco alargado (as bordas mais fracas dos quadrados
# ficavam de fora e manchavam o chão).
from scipy.spatial import ConvexHull
from matplotlib.path import Path
pts = np.argwhere(luarM)[:, ::-1]
casco = Path(pts[ConvexHull(pts).vertices])
luarM = casco.contains_points(np.stack([xs.ravel() + .5, ys.ravel() + .5], 1), radius=6).reshape(512, 512) | luarM
luarM &= chaoM
# A luz do lugar dentro do luar: a razão noite/dia do chão em volta, ajustada por um polinômio de grau 2 em x e y
# (o buraco é grande demais para borrar por cima).
fy, fx = np.nonzero(chaoM & ~luarM & (DIA.sum(2) > 260))  # sem a borda escura da laje, que puxava a razão para 1
A2 = lambda X, Y: np.stack([np.ones_like(X), X, Y, X * X, X * Y, Y * Y], 1).astype(float) / [1, 512, 512, 512 ** 2, 512 ** 2, 512 ** 2]
cl = [np.linalg.lstsq(A2(fx, fy), RN[fy, fx, c], rcond=None)[0] for c in range(3)]
Rl = np.stack([(A2(xs.ravel(), ys.ravel()) @ cl[c]).reshape(512, 512) for c in range(3)], 2)
semLuar = noite.copy()
# O chão INTEIRO vem do dia vezes essa luz (como as paredes): com só o buraco trocado, o remendo aparecia como um
# retângulo mais claro, porque a noite pintada tem outro contraste nas tábuas.
semLuar[chaoM] = np.clip(dia * Rl, 0, 255)[chaoM]
Rm = (noite / np.maximum(1, DIA))[:, ::-1]
semLuar[paredeD] = np.clip(dia * Rm, 0, 255)[paredeD]
Image.fromarray(semLuar.astype(np.uint8)).save(os.path.join(AQUI, 'sem-janela-noite.png'))
os.makedirs(os.path.join(AQUI, 'original'), exist_ok=True)
# O luar vira MÁSCARA + uma cor: os quadrados (onde a noite pintada passa bem da luz do lugar) e o ganho médio deles.
# Assim ele anda com a janela sem levar o desenho das tábuas de onde foi pintado.
ganho = noite0 / np.maximum(1, dia * Rl)
# (os quadrados são claros e azulados: a soma passa de 260 e o azul passa do vermelho)
quadrados = luarM & (noite0.sum(2) > 260) & (noite0[..., 2] > noite0[..., 0] + 10)
media = ganho[quadrados].mean(0)
Image.fromarray((quadrados * 255).astype(np.uint8)).save(os.path.join(AQUI, 'original', 'luar.png'))
import json
json.dump({'ganho': [round(float(g), 3) for g in media]}, open(os.path.join(AQUI, 'original', 'luar.json'), 'w'))
print('luar', quadrados.sum(), media)
# Com o abajur: a luz dele (abajur/noite) sobre a noite sem janela. Ela já está pintada nas duas paredes (espelhar a da
# esquerda levava junto o desenho do criado-mudo, que virava um fantasma na parede da direita).
RA = abajur / np.maximum(1, noite)
# Só na faixa da cortina da esquerda (x 257–330) a luz pintada traz o desenho da cortina acesa, que sem ela vira listras:
# ali entra a luz da parede da esquerda espelhada, alisada e sem o criado-mudo pintado (que viraria fantasma).
lamp = np.array(Image.open(os.path.join(Q, 'pecas', 'abajur.png')))[..., 3] > 0
lamp = binary_dilation(lamp, iterations=4)
plano = (xs < 256) & ~chaoM & ~FORA & ~lamp
RAs = borrar(RA * plano[..., None], 4) / np.maximum(1e-4, gaussian_filter(plano.astype(float), 4))[..., None]
faixa = paredeD & (xs <= 330)
RA[faixa] = RAs[:, ::-1][faixa]
comAbajur = np.clip(semLuar * RA, 0, 255)
Image.fromarray(comAbajur.astype(np.uint8)).save(os.path.join(AQUI, 'sem-janela-noite-abajur.png'))
print('ok')
