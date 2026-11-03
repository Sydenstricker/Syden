# O PÓS do coelho da Briga na horta (03/11/2026): dos renders do briga.py (t/saida/briga/, 480 px) à pixel art de 80 px,
# presa à paleta do mascote do PixelLab, com o contorno de 1 px e a linha por dentro (o mesmo do kart-pos.py). A paleta é
# a MESMA do kart sem as cores do kart: assim a troca de paleta pelo avatar (coresDosAvatares.ts) vale aqui também.
#
# Sai web/public/briga/coelho.png: os desenhos lado a lado, 80 × 80 cada, na ordem de ANIMACOES (o site tem a mesma lista
# em web/src/briga/desenho.ts, FOLHA e ANIMS). O pé pisa no ponto (42, 69) de cada desenho. Também solta t/briga-folha.png (em 4×, para
# conferir). Uso: python briga-pos.py
import json, os
from collections import Counter
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
ENTRADA = os.path.join(AQUI, 't', 'saida', 'briga')
RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..', '..', '..', '..'))
DESTINO = os.path.join(RAIZ, 'web', 'public', 'briga')
MASCOTE = os.path.join(AQUI, '..', '..', 'mascote', 'baixa-120')
N = 6          # 480 / 6 = 80
LADO = 80
CONTORNO = (2, 1, 2)
TRACO = (18, 12, 18)

_cont = Counter()
for _d in ('south-east', 'south-west', 'north-east', 'north-west'):
    _im = Image.open(os.path.join(MASCOTE, f'{_d}.png')).convert('RGBA')
    _cont.update(c[:3] for c in _im.get_flattened_data() if c[3])
PALETA = sorted({c for c in _cont if sum(c) > 30 and not (c[0] == c[1] == c[2])} | {CONTORNO})


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


with open(os.path.join(ENTRADA, 'animacoes.json')) as f:
    ANIMACOES = json.load(f)
quadros = [(nome, i) for nome, n in ANIMACOES.items() for i in range(n)]
os.makedirs(DESTINO, exist_ok=True)
folha = Image.new('RGBA', (LADO * len(quadros), LADO), (0, 0, 0, 0))
for k, (nome, i) in enumerate(quadros):
    cor = Image.open(os.path.join(ENTRADA, f'{nome}-{i}.png'))
    z = Image.open(os.path.join(ENTRADA, f'{nome}-{i}-z.png'))
    folha.alpha_composite(contornar(*reduzir(cor, z)), (k * LADO, 0))
folha.save(os.path.join(DESTINO, 'coelho.png'))
conf = Image.new('RGBA', folha.size, (92, 120, 70, 255))
conf.alpha_composite(folha)
# em 4×, em duas linhas, para caber na tela de quem confere
meio = (len(quadros) + 1) // 2
dupla = Image.new('RGBA', (LADO * meio, LADO * 2), (92, 120, 70, 255))
dupla.alpha_composite(conf.crop((0, 0, LADO * meio, LADO)), (0, 0))
dupla.alpha_composite(conf.crop((LADO * meio, 0, conf.width, LADO)), (0, LADO))
dupla.resize((dupla.width * 4, dupla.height * 4), Image.NEAREST).save(os.path.join(AQUI, 't', 'briga-folha.png'))
print('ok', len(quadros), 'desenhos', os.path.join(DESTINO, 'coelho.png'), json.dumps(ANIMACOES))
