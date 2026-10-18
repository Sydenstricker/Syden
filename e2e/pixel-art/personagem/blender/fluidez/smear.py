# O SMEAR (pedido dele, 18/10/2026): o "borrão" desenhado da pixel art. No ritmo padrão (em dois, 12/s), o desenho que
# mostra o golpe mais rápido ganha o RASTRO da palha: os pixels por onde a vassoura passou nos quadros de 24 que o ritmo
# em dois pula, num tom de palha, por trás do resto. Assim o golpe ganha velocidade sem acrescentar desenho nenhum.
# A vassoura de cada quadro vem do passe de partes do Blender (grupo 10 em saida/quadros-q24o-4x/*-id.png).
# Sai smear.gif (em dois | em dois com smear), no chão do salão, em 3×, e smear-quadros.png (os desenhos com rastro).
#   python smear.py [quantos desenhos ganham rastro, os mais rápidos]   (padrão 2)
import os, sys
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
IDS = os.path.join(AQUI, '..', 'saida', 'quadros-q24o-4x')
N, ESC, VASSOURA = 24, 4, 10
QUANTOS = int(sys.argv[1]) if len(sys.argv) > 1 else 2
DIRS = ['south-east', 'south-west']
PALHA = [(232, 196, 110, 255), (205, 160, 84, 255)]  # do claro (perto da vassoura) ao escuro (o começo do rastro)
try:
    FONTE = ImageFont.truetype('arial.ttf', 11)
except OSError:
    FONTE = ImageFont.load_default()

def mascara(d, k):
    """Os pixels (em 120) que são da vassoura no quadro k: o bloco 4 × 4 com 4 ou mais pontos dela."""
    ids = Image.open(os.path.join(IDS, f'varrendo-{d}-{k}-id.png')).convert('RGBA').load()
    m = set()
    for by in range(120):
        for bx in range(120):
            n = 0
            for y in range(by * ESC, by * ESC + ESC):
                for x in range(bx * ESC, bx * ESC + ESC):
                    q = ids[x, y]
                    if q[3] >= 128 and round(q[0] * 16 / 255) == VASSOURA:
                        n += 1
            if n >= 4:
                m.add((bx, by))
    return m

def centro(m):
    return (sum(x for x, _ in m) / len(m), sum(y for _, y in m) / len(m)) if m else (0, 0)

saida = {}
for d in DIRS:
    faixa = Image.open(os.path.join(AQUI, 'q24o', f'varrendo-{d}.png')).convert('RGBA')
    masc = [mascara(d, k) for k in range(N)]
    # no ritmo em dois, mostram-se os quadros pares; o rastro do desenho k vem dos quadros que ele pula (k-1) e do
    # anterior mostrado (k-2). O quanto a palha andou entre k-2 e k diz quem é rápido.
    passo = {k: ((centro(masc[k])[0] - centro(masc[k - 2])[0]) ** 2 + (centro(masc[k])[1] - centro(masc[k - 2])[1]) ** 2) ** 0.5 for k in range(0, N, 2)}
    rapidos = sorted(passo, key=passo.get, reverse=True)[:QUANTOS]
    desenhos = {}
    for k in range(0, N, 2):
        q = faixa.crop((120 * k, 0, 120 * k + 120, 120))
        if k in rapidos:
            # (a primeira tentativa, só os pixels de k-2 e k-1, saiu como vassouras-fantasma: o smear é a FAIXA por onde a
            # palha passou, contínua. Por isso só a palha — as últimas linhas da vassoura, sem o cabo — e, em cada linha,
            # tudo entre o pixel mais à esquerda e o mais à direita das três posições.)
            def palha(m):
                fundo = max((y for _, y in m), default=0)
                return {(x, y) for x, y in m if y >= fundo - 7}
            junto = palha(masc[k - 2]) | palha(masc[k - 1]) | palha(masc[k])
            rastro = Image.new('RGBA', (120, 120), (0, 0, 0, 0))
            p = rastro.load()
            agora = centro(masc[k])[0]
            for y in {y for _, y in junto}:
                xs = [x for x, yy in junto if yy == y]
                for x in range(min(xs), max(xs) + 1):
                    # mais claro perto da vassoura de agora, mais escuro no começo do rastro
                    p[x, y] = PALHA[0] if abs(x - agora) < 6 else PALHA[1]
            rastro.alpha_composite(q)  # o rastro POR TRÁS do coelho e da vassoura de agora
            q = rastro
        desenhos[k] = q
    saida[d] = (desenhos, rapidos)
    print(d, 'rastro nos desenhos', sorted(rapidos))

chao = Image.open(os.path.join(AQUI, '..', '..', '..', 'salao', 'base16.png')).convert('RGBA').crop((392, 470, 632, 590))
faixas = {d: Image.open(os.path.join(AQUI, 'q24o', f'varrendo-{d}.png')).convert('RGBA') for d in DIRS}
quadros = []
for t in range(N):
    k = t - t % 2
    tela = Image.new('RGBA', (chao.width * 2 + 8, chao.height + 14), (24, 22, 30, 255))
    for j, (nome, com) in enumerate((('em dois', False), ('em dois + smear', True))):
        cena = chao.copy()
        for m, d in enumerate(DIRS):
            img = saida[d][0][k] if com else faixas[d].crop((120 * k, 0, 120 * k + 120, 120))
            cena.alpha_composite(img, (120 * m, 0))
        x = j * (chao.width + 8)
        tela.alpha_composite(cena, (x, 14))
        ImageDraw.Draw(tela).text((x + 4, 1), nome, fill=(240, 236, 226, 255), font=FONTE)
    quadros.append(tela.resize((tela.width * 3, tela.height * 3), Image.NEAREST).convert('RGB'))
quadros[0].save(os.path.join(AQUI, 'smear.gif'), save_all=True, append_images=quadros[1:], duration=50, loop=0)

# os desenhos com rastro, de perto, ao lado do mesmo desenho sem rastro
pares = []
for d in DIRS:
    for k in sorted(saida[d][1]):
        sem = faixas[d].crop((120 * k, 0, 120 * k + 120, 120))
        par = Image.new('RGBA', (240, 120), (90, 90, 110, 255))
        par.alpha_composite(sem, (0, 0)); par.alpha_composite(saida[d][0][k], (120, 0))
        pares.append(par)
folha = Image.new('RGBA', (240, 120 * len(pares)), (90, 90, 110, 255))
for i, p in enumerate(pares):
    folha.alpha_composite(p, (0, 120 * i))
folha.resize((folha.width * 3, folha.height * 3), Image.NEAREST).save(os.path.join(AQUI, 'smear-quadros.png'))
print('smear.gif e smear-quadros.png')
