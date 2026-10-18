# ABORDAGEM C (rodada 2, 18/10/2026): o jeito do t3ssel8r ("Making an Animation for my 3D Pixel Art Game"), refeito
# no nosso pós, sem complemento instalado no Blender.
#   - renderizado DIRETO no tamanho final (120 × 120, um pixel de render = um pixel do sprite), câmera fixa;
#   - rampa de 3 tons por material, com a sombra puxada para o azul-violeta (coelho.py "-- 1 c");
#   - linhas por dentro de DOIS jeitos: onde a distância salta (uma parte na frente de outra) -> linha escura na de trás;
#     onde a distância é parecida mas a normal vira de repente (uma quina) -> CLARA se a quina é para fora (convexa),
#     ESCURA se é para dentro (côncava);
#   - contorno por fora no tom mais escuro do material vizinho (não preto), como no jogo dele.
# Uso: powershell -File ../rodar.ps1 1 c ; python pos_c.py
import os, json
from collections import Counter
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
ENTRADA = os.path.join(RAIZ, 'saida', 'quadros-c-1x')
MASCOTE = os.path.join(RAIZ, '..', 'mascote', 'baixa-120')
SALAO = os.path.join(RAIZ, '..', '..', 'salao')
DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
QUADROS = 8
with open(os.path.join(RAIZ, 'saida', 'paleta-c.json'), encoding='utf-8') as f:
    MATERIAIS = {k: [tuple(c) for c in v] for k, v in json.load(f)['materiais'].items()}
PALETA = sorted({c for t in MATERIAIS.values() for c in t})
TOM = {}   # cor -> (tons do material, índice)
for tons in MATERIAIS.values():
    for k, c in enumerate(tons):
        TOM.setdefault(c, (tons, k))
PROFUNDIDADE = 4      # salto de distância (0..255 = 12 unidades) que conta como "na frente"
QUINA = 0.55          # cosseno entre normais vizinhas abaixo do qual há quina (~57°)


def perto(c):
    return min(PALETA, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)


def mais_escuro(c):
    tons, k = TOM.get(c, ([c], 0))
    return tons[0] if k > 0 else tuple(max(0, int(x * 0.6)) for x in c)


def mais_claro(c):
    tons, k = TOM.get(c, ([c], 0))
    return tons[min(len(tons) - 1, k + 1)]


def processar(nome):
    cor = Image.open(os.path.join(ENTRADA, nome)).convert('RGBA')
    ids = Image.open(os.path.join(ENTRADA, nome.replace('.png', '-id.png'))).convert('RGBA')
    nor = Image.open(os.path.join(ENTRADA, nome.replace('.png', '-n.png'))).convert('RGBA')
    w, h = cor.size
    pc, pi, pn = cor.load(), ids.load(), nor.load()
    base = {}
    for y in range(h):
        for x in range(w):
            if pc[x, y][3] >= 128:
                q = pi[x, y]; n = pn[x, y]
                base[x, y] = (perto(pc[x, y][:3]), round(q[0] * 16 / 255), q[2],
                              tuple(v / 127.5 - 1 for v in n[:3]))
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    po = out.load()
    for (x, y), (c, g, z, n) in base.items():
        novo = c
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            viz = base.get((x + dx, y + dy))
            if not viz:
                continue
            c2, g2, z2, n2 = viz
            if z2 + PROFUNDIDADE < z and g2 != g:
                novo = mais_escuro(c)            # oclusão: eu estou atrás
                break
            if abs(z2 - z) <= PROFUNDIDADE * 2:
                cos = sum(a * b for a, b in zip(n, n2))
                if cos < QUINA:
                    # convexa se a normal do vizinho aponta mais para o lado dele (tela: x para a direita, y para cima)
                    convexa = (n2[0] - n[0]) * dx + (n2[1] - n[1]) * (-dy) > 0
                    if convexa:
                        if z <= z2:                # a luz da quina fica do lado de cá (o mais perto)
                            novo = mais_claro(c)
                    else:
                        if z >= z2:
                            novo = mais_escuro(c)
                            break
        po[x, y] = novo + (255,)
    # contorno por fora: o tom mais escuro do vizinho de dentro
    final = out.copy()
    pf = final.load()
    for y in range(h):
        for x in range(w):
            if po[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and (xx, yy) in base:
                    c = base[xx, yy][0]
                    tons, _ = TOM.get(c, ([c], 0))
                    pf[x, y] = tuple(max(0, int(v * 0.55)) for v in tons[0]) + (255,)
                    break
    return final


def x3(img, k=3):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


parados, faixas = {}, {}
for d in DIRS:
    parados[d] = processar(f'parado-{d}.png')
    parados[d].save(os.path.join(AQUI, f'parado-{d}.png'))
    faixa = Image.new('RGBA', (120 * QUADROS, 120), (0, 0, 0, 0))
    for i in range(QUADROS):
        faixa.alpha_composite(processar(f'varrendo-{d}-{i}.png'), (120 * i, 0))
    faixa.save(os.path.join(AQUI, f'varrendo-{d}.png'))
    faixas[d] = faixa
    print('ok', d)

comp = Image.new('RGBA', (120 * (2 + QUADROS), 120 * len(DIRS)), (90, 90, 110, 255))
for k, d in enumerate(DIRS):
    comp.alpha_composite(Image.open(os.path.join(MASCOTE, f'{d}.png')).convert('RGBA'), (0, 120 * k))
    comp.alpha_composite(parados[d], (120, 120 * k))
    comp.alpha_composite(faixas[d], (240, 120 * k))
x3(comp).save(os.path.join(AQUI, 'comparar.png'))
chao = Image.open(os.path.join(SALAO, 'base16.png')).convert('RGBA').crop((392, 470, 872, 590))
gif = []
for i in range(QUADROS):
    q = chao.copy()
    for k, d in enumerate(DIRS):
        q.alpha_composite(faixas[d].crop((120 * i, 0, 120 * i + 120, 120)), (120 * k, 0))
    gif.append(x3(q).convert('RGB'))
gif[0].save(os.path.join(AQUI, 'varrendo.gif'), save_all=True, append_images=gif[1:], duration=100, loop=0)
print('FIM')
