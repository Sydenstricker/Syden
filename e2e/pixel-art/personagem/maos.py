"""AS MÃOS NO TECLADO, POR CÓDIGO (14/10/2026). Pedido dele: "digitando devagar e de vez em quando mexendo no mouse"; a
animação do PixelLab balançava o corpo inteiro ("desengonçado"), e a do mouse desenhava um mouse voando. Aqui o corpo
fica PARADO (é a pose estados/no-computador) e só as mãos se mexem: os pedaços de pelo claro na ponta dos braços,
longe da cabeça e do rabo. O espaço que a mão deixa vira manga (o braço estica). Tentado antes, e descartado: pedir ao
PixelLab "digitando devagar, o corpo parado" ainda virava o corpo, e "mexendo no mouse" desenhava um mouse voando.

Quadros de cada direção, em animacoes/digitando-maos/<direção>-<n>.png:
  0 a pose · 1 a mão de dentro desce · 2 a mão de fora desce · 3 a mão de fora no mouse · 4 no mouse, mexendo
A página toca uma SEQUÊNCIA deles (devagar, com pausas, e o mouse de vez em quando).

  python -I e2e/pixel-art/personagem/maos.py
"""
import os
from collections import deque
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
POSE = os.path.join(AQUI, 'mascote', 'estados', 'no-computador')
SAIDA = os.path.join(AQUI, 'mascote', 'baixa-120', 'animacoes', 'digitando-maos')
os.makedirs(SAIDA, exist_ok=True)

def claro(p):
    return p[3] > 127 and sum(p[:3]) > 520

def componentes(im, regiao):
    W, H = im.size; px = im.load(); visto = set(); saida = []
    x0, y0, x1, y1 = regiao
    for y in range(y0, y1):
        for x in range(x0, x1):
            if (x, y) in visto or not claro(px[x, y]): continue
            fila = deque([(x, y)]); visto.add((x, y)); comp = []
            while fila:
                a, b = fila.popleft(); comp.append((a, b))
                for c, d in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if x0 <= c < x1 and y0 <= d < y1 and (c, d) not in visto and claro(px[c, d]):
                        visto.add((c, d)); fila.append((c, d))
            saida.append(comp)
    return saida

def mover(im, mao, dx, dy, manga):
    """Leva a mão (os pixels claros e o contorno escuro em volta) de (dx, dy); o que fica vira manga."""
    W, H = im.size; px = im.load(); novo = im.copy(); np_ = novo.load()
    conj = set(mao)
    contorno = set()
    for (x, y) in mao:
        for c, d in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1), (x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)):
            if (c, d) not in conj and 0 <= c < W and 0 <= d < H and px[c, d][3] > 127 and sum(px[c, d][:3]) < 90: contorno.add((c, d))
    pedaco = conj | contorno
    cores = {p: px[p] for p in pedaco}
    for p in pedaco: np_[p] = manga  # o braço estica por baixo
    for (x, y), cor in cores.items():
        X, Y = x + dx, y + dy
        if 0 <= X < W and 0 <= Y < H: np_[X, Y] = cor
    # o contorno de fora que a mão deixou para trás vira contorno da manga, e o que saiu para o vazio ganha contorno
    return novo

for d in ['south-west', 'south-east', 'north-east', 'north-west', 'south', 'north', 'east', 'west']:
    arq = os.path.join(POSE, d + '.png')
    if not os.path.exists(arq): continue
    im = Image.open(arq).convert('RGBA'); W, H = im.size
    b = im.getbbox(); alto = b[3] - b[1]
    # a faixa dos braços: abaixo da cabeça, acima das pernas
    faixa = (b[0], b[1] + int(alto * 0.5), b[2], b[1] + int(alto * 0.8))
    comps = [c for c in componentes(im, faixa) if 3 <= len(c) <= 60]
    leste = d in ('south-east', 'north-east', 'east')
    # as mãos: as pontas para o lado dos braços; o rabo fica do outro lado (de costas) e é mais redondo
    meio = (b[0] + b[2]) / 2
    def cx(c): return sum(p[0] for p in c) / len(c)
    comps.sort(key=lambda c: -cx(c) if leste else cx(c))
    if d.startswith('north'):
        comps = [c for c in comps if (cx(c) > meio) == leste][:1]  # de costas, só a mão do lado do braço aparece
    else:
        comps = comps[:2]
    px = im.load()
    # a cor da manga: o escuro mais comum na faixa
    conta = {}
    for y in range(faixa[1], faixa[3]):
        for x in range(faixa[0], faixa[2]):
            p = px[x, y]
            if p[3] > 127 and 90 < sum(p[:3]) < 250: conta[p] = conta.get(p, 0) + 1
    manga = max(conta, key=conta.get) if conta else (40, 30, 40, 255)
    fora = comps[0] if comps else None
    dentro = comps[1] if len(comps) > 1 else None
    lado = 1 if leste else -1
    quadros = [im,
               mover(im, dentro, 0, 1, manga) if dentro else (mover(im, fora, 0, 1, manga) if fora else im),
               mover(im, fora, 0, 1, manga) if fora else im,
               # no mouse, só o pulso: 1 pixel para fora, e para fora e para baixo (2 ou 3 deixavam um risco na manga)
               mover(im, fora, lado, 0, manga) if fora else im,
               mover(im, fora, lado, 1, manga) if fora else im]
    for n, q in enumerate(quadros): q.save(os.path.join(SAIDA, f'{d}-{n}.png'))
    print(d, 'mãos', [len(c) for c in comps])
