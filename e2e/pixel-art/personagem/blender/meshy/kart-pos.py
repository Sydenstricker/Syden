# O PÓS do coelho no kart (03/11/2026): dos 24 renders do kart.py (t/saida/kart/, 480 px) à pixel art de 60 px, presa à
# paleta do mascote do PixelLab mais os tons do kart, com o contorno de 1 px e a linha por dentro (o mesmo do pos.py).
# Sai a folha web/public/corrida/coelho-kart.png: os 24 desenhos lado a lado, 60 × 60 cada, o 0 de costas e girando de
# 15 em 15 graus para a direita da tela. O kart pisa no ponto (30, 48) de cada desenho.
# Também solta t/kart-folha.png (a folha em 4×, para conferir). Uso: MODELO=t python kart-pos.py
import os
from collections import Counter
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
ENTRADA = os.path.join(AQUI, 't', 'saida', 'kart')
RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..', '..', '..', '..'))
DESTINO = os.path.join(RAIZ, 'web', 'public', 'corrida')
MASCOTE = os.path.join(AQUI, '..', '..', 'mascote', 'baixa-120')
N = 8          # 480 / 8 = 60
LADO = 60
CONTORNO = (2, 1, 2)
TRACO = (18, 12, 18)

_cont = Counter()
for _d in ('south-east', 'south-west', 'north-east', 'north-west'):
    _im = Image.open(os.path.join(MASCOTE, f'{_d}.png')).convert('RGBA')
    _cont.update(c[:3] for c in _im.get_flattened_data() if c[3])
KART = [
    (148, 64, 26), (196, 92, 34), (232, 126, 44), (250, 168, 84),   # a cenoura
    (46, 92, 44), (70, 128, 56), (98, 168, 72), (150, 206, 104),    # a rama
    (24, 20, 26), (38, 34, 40), (52, 46, 54), (78, 70, 80),         # pneus e volante
    (150, 144, 132), (214, 206, 190),                               # o aro
]
PALETA = sorted({c for c in _cont if sum(c) > 30 and not (c[0] == c[1] == c[2])} | {CONTORNO} | set(KART))


def lum(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


_PERTO = {}


def perto(c):
    c = c[:3]
    if c not in _PERTO:
        _PERTO[c] = min(PALETA, key=lambda p: 2 * (p[0] - c[0]) ** 2 + 4 * (p[1] - c[1]) ** 2 + 3 * (p[2] - c[2]) ** 2)
    return _PERTO[c]


_LINHA = {}


def linha(c):
    if c not in _LINHA:
        _LINHA[c] = TRACO if lum(c) < 60 else perto(tuple(round(x * 0.55) for x in c))
    return _LINHA[c]


def reduzir(img, z):
    img, z = img.convert('RGBA'), z.convert('L')
    px, pz = img.load(), z.load()
    out = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    dist = [[0] * LADO for _ in range(LADO)]
    for by in range(LADO):
        for bx in range(LADO):
            cores, soma, cheio = Counter(), 0, 0
            for y in range(by * N, by * N + N):
                for x in range(bx * N, bx * N + N):
                    c = px[x, y]
                    if c[3] >= 128:
                        cheio += 1
                        cores[perto(c)] += 1
                        soma += pz[x, y]
            if cheio * 2 < N * N:
                continue
            cor, _ = cores.most_common(1)[0]
            escuros = sum(k for c, k in cores.items() if lum(c) < 45)
            if lum(cor) > 120 and escuros >= N * N // 4:
                cor = TRACO
            out.putpixel((bx, by), cor + (255,))
            dist[by][bx] = soma / cheio
    return out, dist


SALTO = 3


def contornar(img, dist):
    w, h = img.size
    px = img.load()
    out = img.copy()
    po = out.load()
    for y in range(h):
        for x in range(w):
            viz = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < h]
            if px[x, y][3]:
                if any(px[a, b][3] and dist[b][a] + SALTO < dist[y][x] for a, b in viz):
                    po[x, y] = linha(px[x, y][:3]) + (255,)
                continue
            if any(px[a, b][3] for a, b in viz):
                po[x, y] = CONTORNO + (255,)
    return out


os.makedirs(DESTINO, exist_ok=True)
folha = Image.new('RGBA', (LADO * 24, LADO), (0, 0, 0, 0))
for n in range(24):
    cor = Image.open(os.path.join(ENTRADA, f'{n}.png'))
    z = Image.open(os.path.join(ENTRADA, f'{n}-z.png'))
    folha.alpha_composite(contornar(*reduzir(cor, z)), (n * LADO, 0))
folha.save(os.path.join(DESTINO, 'coelho-kart.png'))
conf = Image.new('RGBA', folha.size, (70, 110, 64, 255))
conf.alpha_composite(folha)
conf.resize((folha.width * 4, folha.height * 4), Image.NEAREST).save(os.path.join(AQUI, 't', 'kart-folha.png'))
print('ok', os.path.join(DESTINO, 'coelho-kart.png'))
