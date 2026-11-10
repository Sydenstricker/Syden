# O PÓS DO PILOTO DAS CAMADAS EM 3D: dos quadros do cena.py (saida/quadros/, 480 px) à pixel art de 120 px, com o MESMO
# caminho do meshy/pos.py (copiado: aquele roda tudo ao ser importado). A paleta é a do mascote do PixelLab MAIS as cores
# das camadas 2D do boné e da bandana, para o 3D sair com as cores do 2D.
#
# Sai (nesta pasta):
#   folha-3d.png       o render 3D normal: mascote e orelha caída, sem nada, boné, bandana e os dois (sudeste e de frente)
#   folha-pixel.png    por corpo: o 2D do piloto (PixelLab + camadas) em cima, o 3D em pixel art embaixo (sudeste e noroeste)
#   bone-2d-e-3d.png   o boné: em cada diagonal, o 2D e o 3D colados, para comparar
#   <corpo>-<parado|andando>.gif   com os dois acessórios, nas 4 diagonais, no chão do salão, 3×, 12 por segundo
#   no-salao.png       no chão do salão, no tamanho de verdade: 2D e 3D lado a lado, com os acessórios
#   ver.html, ver-novo.html   o GLB de teste de cada malha, com botões (o GLB vai dentro da página: abre direto do disco)
#   corpo-antigo-e-novo.png   o mascote da malha em T e o corpo novo, sem acessório, em 3D e em pixel art
# Cada malha tem a sua pasta de saída do Blender: saida/ (a em T: mascote e orelha caída) e saida-novo/ (o mascote novo).
# Uso: py -3 pos.py
import os, json, base64
from collections import Counter
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
PERS = os.path.normpath(os.path.join(AQUI, '..', '..'))
SALAO = os.path.normpath(os.path.join(PERS, '..', 'salao'))
ESCALA = 4
DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
# os corpos e a pasta de cada um, pelo encaixe.json de cada malha (o corpo novo primeiro)
PASTA = {}
for _p in ('saida-novo', 'saida'):
    _f = os.path.join(AQUI, _p, 'encaixe.json')
    if os.path.exists(_f):
        for _c in json.load(open(_f, encoding='utf-8')):
            PASTA[_c] = os.path.join(AQUI, _p)
CORPOS = list(PASTA)


def dois_d_de(corpo):
    return 'orelha-caida' if corpo.startswith('orelha-caida') else 'mascote'
COMBOS = ['nada', 'bone', 'bandana', 'ambos']
CONTORNO = (2, 1, 2)
TRACO = (18, 12, 18)
FPS = 12
FUNDO = (70, 72, 90, 255)


def cores_de(caminho):
    im = Image.open(caminho).convert('RGBA')
    return Counter(c[:3] for c in im.get_flattened_data() if c[3])


# A PALETA: o mascote do PixelLab (as 4 diagonais) e as camadas 2D dos dois acessórios nos dois corpos
_cont = Counter()
for d in DIRS:
    _cont.update(cores_de(os.path.join(PERS, 'mascote', 'baixa-120', f'{d}.png')))
PALETA = {c for c in _cont if sum(c) > 30 and not (c[0] == c[1] == c[2])}
for corpo in ('mascote', 'orelha-caida'):
    for ac in ('bone', 'bandana'):
        for d in DIRS:
            f = os.path.join(PERS, corpo, 'acessorios', ac, 'parado', f'{d}-0.png')
            if os.path.exists(f):
                # só os tons do acessório (saturados): o que a camada trouxe de pelo ou de contorno já está na paleta
                PALETA |= {c for c, k in cores_de(f).items() if max(c) - min(c) > 40 and sum(c) > 60}
PALETA = sorted(PALETA | {CONTORNO})


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
    n = ESCALA
    w = img.width // n
    px, pz = img.load(), z.load()
    out = Image.new('RGBA', (w, w), (0, 0, 0, 0))
    dist = [[0] * w for _ in range(w)]
    for by in range(w):
        for bx in range(w):
            cores, soma, cheio = Counter(), 0, 0
            for y in range(by * n, by * n + n):
                for x in range(bx * n, bx * n + n):
                    c = px[x, y]
                    if c[3] >= 128:
                        cheio += 1
                        cores[perto(c)] += 1
                        soma += pz[x, y]
            if cheio * 2 < n * n:
                continue
            cor, _ = cores.most_common(1)[0]
            escuros = sum(k for c, k in cores.items() if lum(c) < 45)
            if lum(cor) > 120 and escuros >= n * n // 4:
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


def processar(corpo, nome):
    e = os.path.join(PASTA[corpo], 'quadros')
    return contornar(*reduzir(Image.open(os.path.join(e, nome)), Image.open(os.path.join(e, nome.replace('.png', '-z.png')))))


def x3(img, k=3):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def ancora(fig):
    fy = max(y for y in range(fig.height) for x in range(fig.width) if fig.getpixel((x, y))[3])
    xs = [x for y in range(fy - 3, fy + 1) for x in range(fig.width) if fig.getpixel((x, y))[3]]
    return round(sum(xs) / len(xs), 1), fy


def dois_d(corpo, combo, d):
    # o 2D do piloto das camadas: o corpo do PixelLab e o quadro repintado com o acessório (as camadas são 132 px, com o
    # corpo em (6, 6)); "ambos" é o da bandana com a camada do boné por cima
    base = os.path.join(PERS, dois_d_de(corpo))
    if combo == 'nada':
        return Image.open(os.path.join(base, 'baixa-120', f'{d}.png')).convert('RGBA')
    ac = 'bandana' if combo == 'ambos' else combo
    f = os.path.join(base, 'acessorios', ac, 'parado', 'com', f'{d}-0.png')
    if not os.path.exists(f):
        return None
    im = Image.open(f).convert('RGBA')
    if combo == 'ambos':
        b = os.path.join(base, 'acessorios', 'bone', 'parado', f'{d}-0.png')
        if not os.path.exists(b):
            return None
        im.alpha_composite(Image.open(b).convert('RGBA'))
    return im.crop((6, 6, 126, 126))


# ============================ OS QUADROS PARADOS EM PIXEL ART ============================
PX = {}
for corpo in CORPOS:
    px_dir = os.path.join(PASTA[corpo], 'pixel')
    os.makedirs(px_dir, exist_ok=True)
    for combo in COMBOS:
        for d in DIRS + ['south', 'east', 'north']:
            if not os.path.exists(os.path.join(PASTA[corpo], 'quadros', f'{corpo}-{combo}-{d}.png')):
                continue
            q = processar(corpo, f'{corpo}-{combo}-{d}.png')
            q.save(os.path.join(px_dir, f'{corpo}-{combo}-{d}.png'))
            PX[corpo, combo, d] = q
    print('ok pixel', corpo)

# ============================ A FOLHA DO PIXEL: o 2D em cima, o 3D embaixo ============================
VISTAS = ['south-east', 'north-west']
linhas = []
for corpo in CORPOS:
    for fonte in ('2d', '3d'):
        l = Image.new('RGBA', (120 * len(COMBOS) * len(VISTAS), 120), FUNDO)
        for i, combo in enumerate(COMBOS):
            for j, d in enumerate(VISTAS):
                q = dois_d(corpo, combo, d) if fonte == '2d' else PX[corpo, combo, d]
                if q is not None:
                    l.alpha_composite(q, (120 * (i * len(VISTAS) + j), 0))
        linhas.append(l)
folha = Image.new('RGBA', (linhas[0].width, 120 * len(linhas)), FUNDO)
for k, l in enumerate(linhas):
    folha.paste(l, (0, 120 * k))
x3(folha).save(os.path.join(AQUI, 'folha-pixel.png'))

# ============================ O BONÉ, 2D E 3D LADO A LADO (na mesma direção) ============================
# por corpo, uma linha: em cada uma das 4 diagonais, o 2D com o boné e, colado, o 3D em pixel art com o boné; no fim, o
# 3D de lado e de costas (o 2D não tem camada nessas duas)
linhas = []
for corpo in CORPOS:
    l = Image.new('RGBA', (120 * 2 * len(DIRS) + 20 * len(DIRS) + 240, 120), FUNDO)
    for i, d in enumerate(DIRS):
        x = i * (240 + 20)
        q2 = dois_d(corpo, 'bone', d)
        if q2 is not None:
            l.alpha_composite(q2, (x, 0))
        l.alpha_composite(PX[corpo, 'bone', d], (x + 120, 0))
    for j, d in enumerate(('east', 'north')):
        if (corpo, 'bone', d) in PX:
            l.alpha_composite(PX[corpo, 'bone', d], (len(DIRS) * 260 + 120 * j, 0))
    linhas.append(l)
f2 = Image.new('RGBA', (linhas[0].width, 120 * len(linhas)), FUNDO)
for k, l in enumerate(linhas):
    f2.paste(l, (0, 120 * k))
x3(f2).save(os.path.join(AQUI, 'bone-2d-e-3d.png'))

# ============================ A FOLHA DO 3D NORMAL ============================
LADO = 300
VN = ['south-east', 'south']
f3 = Image.new('RGBA', (LADO * len(COMBOS) * len(VN), LADO * len(CORPOS)), FUNDO)
for a, corpo in enumerate(CORPOS):
    for i, combo in enumerate(COMBOS):
        for j, d in enumerate(VN):
            im = Image.open(os.path.join(PASTA[corpo], 'normal', f'{corpo}-{combo}-{d}.png')).convert('RGBA').crop((60, 40, 540, 520))
            f3.alpha_composite(im.resize((LADO, LADO), Image.LANCZOS), (LADO * (i * len(VN) + j), LADO * a))
f3.save(os.path.join(AQUI, 'folha-3d.png'))
# e de lado e de costas, para conferir o boné e o nó da bandana
VN2 = ['east', 'north-west']
f4 = Image.new('RGBA', (LADO * len(COMBOS) * len(VN2), LADO * len(CORPOS)), FUNDO)
for a, corpo in enumerate(CORPOS):
    for i, combo in enumerate(COMBOS):
        for j, d in enumerate(VN2):
            im = Image.open(os.path.join(PASTA[corpo], 'normal', f'{corpo}-{combo}-{d}.png')).convert('RGBA').crop((60, 40, 540, 520))
            f4.alpha_composite(im.resize((LADO, LADO), Image.LANCZOS), (LADO * (i * len(VN2) + j), LADO * a))
f4.save(os.path.join(AQUI, 'folha-3d-lado-e-costas.png'))

# ============================ OS GIFS (com os dois acessórios) ============================
chao = Image.open(os.path.join(SALAO, 'base16.png')).convert('RGBA').crop((392, 470, 872, 590))
for corpo in CORPOS:
    with open(os.path.join(PASTA[corpo], 'animacoes.json')) as f:
        ANIMS = json.load(f)
    for nome, n in ANIMS.items():
        quadros = {d: [processar(corpo, f'anim-{corpo}-{nome}-{d}-{i}.png') for i in range(n)] for d in DIRS}
        fundo = Image.new('RGBA', (120 * len(DIRS), 120))
        for x in range(0, fundo.width, chao.width):
            fundo.paste(chao, (x, 0))
        gif = []
        for i in range(n):
            q = fundo.copy()
            for k, d in enumerate(DIRS):
                q.alpha_composite(quadros[d][i], (120 * k, 0))
            gif.append(x3(q).convert('RGB'))
        gif[0].save(os.path.join(AQUI, f'{corpo}-{nome}.gif'), save_all=True, append_images=gif[1:],
                    duration=round(1000 / FPS), loop=0)
        print('ok gif', corpo, nome)

# ============================ NO SALÃO, no tamanho de verdade ============================
base = Image.open(os.path.join(SALAO, 'base16.png')).convert('RGBA')
figs = []
for corpo in CORPOS:
    for combo in ('nada', 'ambos'):
        for fonte in ('2d', '3d'):
            q = dois_d(corpo, combo, 'south-east') if fonte == '2d' else PX[corpo, combo, 'south-east']
            if q is not None:
                figs.append(q)
for k, fig in enumerate(figs):
    ax, ay = ancora(fig)
    x, y = 300 + 54 * k, 520
    base.alpha_composite(fig, (round(x - ax), round(y - ay)))
x3(base.crop((240, 400, 300 + 54 * len(figs) + 40, 560))).save(os.path.join(AQUI, 'no-salao.png'))

# ============================ A PÁGINA DE TESTE DO GLB ============================
for _p, _html in (('saida', 'ver.html'), ('saida-novo', 'ver-novo.html')):
    glb = os.path.join(AQUI, _p, 'coelho-camadas.glb')
    if os.path.exists(glb):
        dados = base64.b64encode(open(glb, 'rb').read()).decode()
        modelo = open(os.path.join(AQUI, 'ver-modelo.html'), encoding='utf-8').read()
        open(os.path.join(AQUI, _html), 'w', encoding='utf-8').write(modelo.replace('__GLB_BASE64__', dados))

# ============================ O CORPO ANTIGO E O NOVO, SEM ACESSÓRIO ============================
if 'mascote' in PASTA and 'mascote-novo' in PASTA:
    VS = ['south', 'south-east', 'east', 'north-west']
    f5 = Image.new('RGBA', (max(LADO * len(VS), 120 * 3 * len(DIRS)), LADO * 2 + 120 * 3 * 3), FUNDO)
    for a, corpo in enumerate(('mascote', 'mascote-novo')):
        for j, d in enumerate(VS):
            im = Image.open(os.path.join(PASTA[corpo], 'normal', f'{corpo}-nada-{d}.png')).convert('RGBA').crop((60, 40, 540, 520))
            f5.alpha_composite(im.resize((LADO, LADO), Image.LANCZOS), (LADO * j, LADO * a))
    # embaixo, em pixel art (3×): o 2D do PixelLab, o antigo e o novo, nas 4 diagonais
    pl = Image.new('RGBA', (120 * len(DIRS), 120 * 3), FUNDO)
    for j, d in enumerate(DIRS):
        pl.alpha_composite(dois_d('mascote', 'nada', d), (120 * j, 0))
        pl.alpha_composite(PX['mascote', 'nada', d], (120 * j, 120))
        pl.alpha_composite(PX['mascote-novo', 'nada', d], (120 * j, 240))
    f5.alpha_composite(x3(pl), (0, LADO * 2))
    f5.save(os.path.join(AQUI, 'corpo-antigo-e-novo.png'))
print('FIM')
