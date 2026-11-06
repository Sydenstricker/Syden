# O PÓS DOS INIMIGOS DAS FASES NOVAS DA BRIGA (06/11/2026): dos renders do briga-monstros.py (6× maiores) à pixel art, com o
# mesmo contorno de 1 px e a linha por dentro do coelho (briga-pos.py). A paleta é a de CADA BICHO (24 cores tiradas de todos os
# desenhos dele juntos): o coelho prende à do mascote por causa da troca de cor do avatar; os bichos não trocam de cor.
#
# Sai web/public/briga/<fase>/<bicho>.png: os desenhos lado a lado, `lado` × `lado` cada, na ordem de ORDEM (o site tem a
# mesma em web/src/briga/sprites.ts), com o pé no ponto (lado/2, 0,85 × lado). Também solta t/briga-monstros-folha.png (2×,
# todos, para conferir). Uso: python briga-monstros-pos.py
import json, os
from collections import Counter
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
ENTRADA = os.path.join(AQUI, 't', 'saida', 'briga-monstros')
RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..', '..', '..', '..'))
DESTINO = os.path.join(RAIZ, 'web', 'public', 'briga')
N = 6
ORDEM = [('parado', 4), ('andando', 6), ('prep', 2), ('golpe', 2), ('dor', 2), ('caido', 3), ('pulo', 2)]
FASE = {
    'cogumelo': 'floresta', 'sapo': 'floresta', 'abelha': 'floresta', 'rei-cogumelo': 'floresta',
    'cacto': 'deserto', 'dino': 'deserto', 'redemoinho': 'deserto', 'alpaca-rei': 'deserto',
    'macaco': 'neve', 'espinhento': 'neve', 'golem': 'neve', 'yeti': 'neve',
    'diabinho': 'castelo', 'demonio-azul': 'castelo', 'fantasma': 'castelo', 'dragao': 'castelo',
}
CONTORNO = (24, 16, 26)
SALTO = 3


def lum(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


def paleta_de(imagens):
    # todas as cores opacas de todos os desenhos, numa tira, reduzidas a 24
    px = [c[:3] for im in imagens for c in im.get_flattened_data() if c[3] >= 128]
    tira = Image.new('RGB', (len(px), 1))
    tira.putdata(px)
    q = tira.quantize(colors=24, method=Image.Quantize.MEDIANCUT)
    p = q.getpalette()[: 24 * 3]
    return [tuple(p[i:i + 3]) for i in range(0, len(p), 3)]


def reduzir(img, z, lado, paleta, perto):
    px, pz = img.load(), z.load()
    out = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    dist = [[0] * lado for _ in range(lado)]
    for by in range(lado):
        for bx in range(lado):
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
            out.putpixel((bx, by), cor + (255,))
            dist[by][bx] = soma / cheio
    return out, dist


def contornar(img, dist, perto):
    w, h = img.size
    px = img.load()
    out = img.copy()
    po = out.load()
    for y in range(h):
        for x in range(w):
            viz = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < h]
            if px[x, y][3]:
                if any(px[a, b][3] and dist[b][a] + SALTO < dist[y][x] for a, b in viz):
                    c = px[x, y][:3]
                    po[x, y] = (CONTORNO if lum(c) < 60 else perto(tuple(round(v * 0.55) for v in c))) + (255,)
                continue
            if any(px[a, b][3] for a, b in viz):
                po[x, y] = CONTORNO + (255,)
    return out


with open(os.path.join(ENTRADA, 'monstros.json')) as f:
    MANIFESTO = json.load(f)
quadros = [(nome, i) for nome, n in ORDEM for i in range(n)]
conferir = []
folhas = {}
for bicho, info in MANIFESTO.items():
    lado = info['lado']
    pasta = os.path.join(ENTRADA, bicho)
    cores = [Image.open(os.path.join(pasta, f'{a}-{i}.png')).convert('RGBA') for a, i in quadros]
    zs = [Image.open(os.path.join(pasta, f'{a}-{i}-z.png')).convert('L') for a, i in quadros]
    paleta = paleta_de(cores)
    cache = {}

    def perto(c, paleta=paleta, cache=cache):
        c = c[:3]
        if c not in cache:
            cache[c] = min(paleta, key=lambda p: 2 * (p[0] - c[0]) ** 2 + 4 * (p[1] - c[1]) ** 2 + 3 * (p[2] - c[2]) ** 2)
        return cache[c]

    folha = Image.new('RGBA', (lado * len(quadros), lado), (0, 0, 0, 0))
    for k, (cor, z) in enumerate(zip(cores, zs)):
        folha.alpha_composite(contornar(*reduzir(cor, z, lado, paleta, perto), perto), (k * lado, 0))
    destino = os.path.join(DESTINO, FASE[bicho])
    os.makedirs(destino, exist_ok=True)
    folha.save(os.path.join(destino, f'{bicho}.png'))
    conferir.append(folha)
    # O PÉ: a linha de baixo do primeiro desenho parado (o voador, a ponta de baixo do corpo), no meio do quadro
    caixa = folha.crop((0, 0, lado, lado)).getbbox()
    folhas[bicho] = dict(fase=FASE[bicho], lado=lado, peX=lado // 2, peY=caixa[3] - 1, alto=caixa[3] - caixa[1])
    print('ok', bicho, folha.size)

# a conferência: cada bicho numa linha, num fundo de grama, em 2×
largura = max(f.width for f in conferir)
altura = sum(f.height for f in conferir)
conf = Image.new('RGBA', (largura, altura), (92, 120, 70, 255))
y = 0
for f in conferir:
    conf.alpha_composite(f, (0, y))
    y += f.height
conf.resize((conf.width * 2, conf.height * 2), Image.NEAREST).save(os.path.join(AQUI, 't', 'briga-monstros-folha.png'))

# as medidas de cada folha vão para o site (gerado: não editar à mão)
linhas = [f"  '{b}': {{ fase: '{f['fase']}', lado: {f['lado']}, peX: {f['peX']}, peY: {f['peY']}, alto: {f['alto']} }}," for b, f in sorted(folhas.items())]
with open(os.path.join(RAIZ, 'web', 'src', 'briga', 'folhasDosBichos.ts'), 'w', encoding='utf-8', newline='\n') as f:
    f.write('// GERADO por e2e/pixel-art/personagem/blender/meshy/briga-monstros-pos.py: não editar à mão.\n')
    f.write('// Cada folha: o lado do quadro, o pé (px dentro do quadro) e a altura do bicho parado.\n')
    f.write('export const FOLHAS_DOS_BICHOS: Record<string, { fase: string; lado: number; peX: number; peY: number; alto: number }> = {\n')
    f.write('\n'.join(linhas) + '\n};\n')
