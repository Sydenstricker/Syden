# O PÓS do piloto: dos quadros que o mascote.py soltou (saida/quadros/, 480 px) à pixel art de 120 px, presa à paleta
# do mascote do PixelLab. O mesmo caminho do pos.py de 18/10, com a paleta tirada do desenho e não de materiais:
#   1. reduz para 120: em cada bloco 4 × 4 vale a cor da paleta que MAIS aparece (o traço do rosto ganha se aparece)
#   2. alfa só 0 ou 255
#   3. linha por dentro onde uma parte passa na frente de outra (pelo passe de distância), e contorno de 1 px por fora
#   4. faixas <animação>-<direção>.png, animacoes.json (com a âncora do pé), os GIFs no chão do salão e as comparações
# Uso: python pos.py
import os, json
from collections import Counter
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
# MODELO=t: os quadros da malha de braços abertos, e a saída em t/ (como no mascote.py)
VARIANTE = os.environ.get('MODELO', '')
RAIZ = AQUI
AQUI = os.path.join(AQUI, VARIANTE) if VARIANTE else AQUI
ENTRADA = os.path.join(AQUI, 'saida', 'quadros')
ESCALA = 4
DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
MASCOTE = os.path.join(RAIZ, '..', '..', 'mascote', 'baixa-120')
SALAO = os.path.join(RAIZ, '..', '..', '..', 'salao')
CONTORNO = (2, 1, 2)
with open(os.path.join(AQUI, 'saida', 'animacoes.json')) as f:
    ANIMACOES = json.load(f)
FPS = 12

# A PALETA: as cores do mascote do PixelLab (os pretos do contorno viram um só, e os cinzas soltos ficam de fora), e os
# tons da vassoura, que o mascote não tem.
_cont = Counter()
for _d in DIRS:
    _im = Image.open(os.path.join(MASCOTE, f'{_d}.png')).convert('RGBA')
    _cont.update(c[:3] for c in _im.get_flattened_data() if c[3])
PALETA = {c for c in _cont if sum(c) > 30 and not (c[0] == c[1] == c[2])} | {CONTORNO}
VASSOURA = [(70, 42, 24), (98, 60, 34), (140, 90, 50), (176, 120, 70), (120, 84, 36), (156, 112, 52), (204, 160, 82),
            (232, 196, 112), (80, 24, 30), (112, 34, 40), (160, 50, 54), (196, 70, 70)]
PALETA = sorted(PALETA | set(VASSOURA))
TRACO = (18, 12, 18)


def lum(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


_PERTO = {}


def perto(c):
    c = c[:3]
    if c not in _PERTO:
        # pesos da percepção (o verde pesa mais), para a sombra fria do pelo não cair no rosa
        _PERTO[c] = min(PALETA, key=lambda p: 2 * (p[0] - c[0]) ** 2 + 4 * (p[1] - c[1]) ** 2 + 3 * (p[2] - c[2]) ** 2)
    return _PERTO[c]


# a linha por dentro: a cor da paleta mais perto do tom 55% mais escuro (no moletom, que já é quase preto, o traço)
_LINHA = {}


def linha(c):
    if c not in _LINHA:
        _LINHA[c] = TRACO if lum(c) < 60 else perto(tuple(round(x * 0.55) for x in c))
    return _LINHA[c]


def reduzir(img, z):
    img, z = img.convert('RGBA'), z.convert('L')   # o PIL lê o PNG de 16 bits como 8
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
            # o traço do rosto é fino: num bloco claro, se ele aparece, ele ganha (senão o olho some na redução)
            escuros = sum(k for c, k in cores.items() if lum(c) < 45)
            if lum(cor) > 120 and escuros >= n * n // 4:
                cor = TRACO
            out.putpixel((bx, by), cor + (255,))
            dist[by][bx] = soma / cheio
    return out, dist


SALTO = 3   # em 0..255 sobre 12 unidades: ~0,15 unidade: menos que isso é a mesma superfície se curvando


def contornar(img, dist):
    w, h = img.size
    px = img.load()
    out = img.copy()
    po = out.load()
    for y in range(h):
        for x in range(w):
            viz = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < h]
            if px[x, y][3]:
                # por dentro: este pixel está ATRÁS do vizinho -> vira linha
                if any(px[a, b][3] and dist[b][a] + SALTO < dist[y][x] for a, b in viz):
                    po[x, y] = linha(px[x, y][:3]) + (255,)
                continue
            if any(px[a, b][3] for a, b in viz):
                po[x, y] = CONTORNO + (255,)
    return out


def processar(nome):
    cor = Image.open(os.path.join(ENTRADA, nome))
    z = Image.open(os.path.join(ENTRADA, nome.replace('.png', '-z.png')))
    return contornar(*reduzir(cor, z))


def x3(img, k=3):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def ancora(fig):
    fy = max(y for y in range(fig.height) for x in range(fig.width) if fig.getpixel((x, y))[3])
    xs = [x for y in range(fy - 3, fy + 1) for x in range(fig.width) if fig.getpixel((x, y))[3]]
    return round(sum(xs) / len(xs), 1), fy


faixas = {}
for nome, n in ANIMACOES.items():
    for d in DIRS:
        faixa = Image.new('RGBA', (120 * n, 120), (0, 0, 0, 0))
        for i in range(n):
            faixa.alpha_composite(processar(f'{nome}-{d}-{i}.png'), (120 * i, 0))
        faixa.save(os.path.join(AQUI, f'{nome}-{d}.png'))
        faixas[nome, d] = faixa
    print('ok', nome)


def quadro(nome, d, i):
    return faixas[nome, d].crop((120 * i, 0, 120 * i + 120, 120))


# A ÂNCORA: o pé do primeiro quadro parado (a câmera não muda entre as animações; a vassoura desce abaixo do pé)
pe = {d: ancora(quadro('parado', d, 0)) for d in DIRS}
with open(os.path.join(AQUI, 'animacoes.json'), 'w', encoding='utf-8') as f:
    json.dump({'quadro': [120, 120], 'fps': FPS, 'animacoes': ANIMACOES, 'pe': pe,
               'nota': 'pe = âncora explícita (do parado); 12 desenhos por segundo, "em dois"'}, f, ensure_ascii=False, indent=2)

# COMPARAR: por direção, o mascote do PixelLab | o 3D parado | quatro quadros andando | quatro varrendo (3×)
linhas = []
for d in DIRS:
    pecas = [Image.open(os.path.join(MASCOTE, f'{d}.png')).convert('RGBA'), quadro('parado', d, 0)]
    pecas += [quadro('andando', d, i) for i in (0, 2, 4, 6)] + [quadro('varrendo', d, i) for i in (0, 2, 4, 6)]
    l = Image.new('RGBA', (120 * len(pecas), 120), (90, 90, 110, 255))
    for k, p in enumerate(pecas):
        l.alpha_composite(p, (120 * k, 0))
    linhas.append(l)
comp = Image.new('RGBA', (linhas[0].width, 120 * len(linhas)))
for k, l in enumerate(linhas):
    comp.paste(l, (0, 120 * k))
x3(comp).save(os.path.join(AQUI, 'comparar.png'))

# NO SALÃO, no tamanho de verdade: o PixelLab parado, o 3D parado, andando e varrendo, em casas vizinhas do chão
for base_nome, saida_nome in (('base16', 'no-salao.png'), ('noite16', 'no-salao-noite.png')):
    base = Image.open(os.path.join(SALAO, f'{base_nome}.png')).convert('RGBA')
    ref = Image.open(os.path.join(MASCOTE, 'south-east.png')).convert('RGBA')
    figs = [(ref, ancora(ref)), (quadro('parado', 'south-east', 0), pe['south-east']),
            (quadro('andando', 'south-west', 2), pe['south-west']), (quadro('varrendo', 'south-east', 2), pe['south-east'])]
    for (x, y), (fig, (ax, ay)) in zip([(458, 520), (512, 520), (566, 520), (620, 520)], figs):
        base.alpha_composite(fig, (round(x - ax), round(y - ay)))
    x3(base.crop((380, 380, 700, 560))).save(os.path.join(AQUI, saida_nome))

# OS GIFS: cada animação nas 4 direções no chão do salão, em 3×, a 12 desenhos por segundo. No andando, a primeira
# coluna é o andando do PixelLab (sudeste), para comparar.
chao = Image.open(os.path.join(SALAO, 'base16.png')).convert('RGBA').crop((392, 470, 872, 590))
pl = os.path.join(MASCOTE, 'animacoes', 'andando')
pl_q = sorted(f for f in os.listdir(pl) if f.startswith('south-east-')) if os.path.isdir(pl) else []
for nome, n in ANIMACOES.items():
    gif = []
    total = n if nome != 'andando' or not pl_q else n * len(pl_q) // __import__('math').gcd(n, len(pl_q))
    largura = 120 * (len(DIRS) + (1 if nome == 'andando' and pl_q else 0))
    fundo = Image.new('RGBA', (largura, 120))
    for x in range(0, largura, chao.width):
        fundo.paste(chao, (x, 0))
    for i in range(total):
        q = fundo.copy()
        k0 = 0
        if nome == 'andando' and pl_q:
            q.alpha_composite(Image.open(os.path.join(pl, pl_q[i % len(pl_q)])).convert('RGBA'), (0, 0))
            k0 = 1
        for k, d in enumerate(DIRS):
            q.alpha_composite(quadro(nome, d, i % n), (120 * (k + k0), 0))
        gif.append(x3(q).convert('RGB'))
    gif[0].save(os.path.join(AQUI, f'{nome}.gif'), save_all=True, append_images=gif[1:], duration=round(1000 / FPS), loop=0)
print('FIM')

# AS DUAS MALHAS LADO A LADO (só na variante): por animação, a primeira em cima e esta embaixo, sudeste, 4 desenhos (3×)
if VARIANTE:
    linhas = []
    for nome, n in ANIMACOES.items():
        for pasta in (RAIZ, AQUI):
            f = os.path.join(pasta, f'{nome}-south-east.png')
            if not os.path.exists(f):
                continue
            fx = Image.open(f).convert('RGBA')
            l = Image.new('RGBA', (480, 120), (90, 90, 110, 255))
            for k, i in enumerate(range(0, n, n // 4)):
                l.alpha_composite(fx.crop((120 * i, 0, 120 * i + 120, 120)), (120 * k, 0))
            linhas.append(l)
    v = Image.new('RGBA', (480, 120 * len(linhas)))
    for k, l in enumerate(linhas):
        v.paste(l, (0, 120 * k))
    x3(v).save(os.path.join(AQUI, 'comparar-malhas.png'))
