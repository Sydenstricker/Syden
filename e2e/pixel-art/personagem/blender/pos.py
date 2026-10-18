# O PÓS do coelho em 3D: dos quadros que o Blender soltou (saida/quadros-<n>x/) às faixas finais de 120 px.
#   1. reduz para 120 × 120: em cada bloco n × n vale a cor que MAIS aparece (não o pixel do canto, que perde o olho)
#   2. alfa só 0 ou 255 (metade do bloco coberta = pixel cheio)
#   3. cada cor vai para a mais perto da paleta (a do coelho.py, que é a medida no mascote do PixelLab)
#   4. contorno escuro de 1 px por fora, como o do mascote; e uma linha por dentro onde a vassoura cruza o corpo
#   5. faixas: varrendo-<direção>.png (8 quadros lado a lado), parado-<direção>.png, e as comparações
# Uso: python pos.py [escala]   (4 = dos quadros de 480, o usado; 1 = direto em 120, comparado e descartado)
import os, sys, json
from collections import Counter
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
ESCALA = int(sys.argv[1]) if len(sys.argv) > 1 else 4
# "python pos.py 4 projecao": a alternativa B (os quadros do coelho.py "-- 4 projecao"), saída em projecao/
PROJECAO = len(sys.argv) > 2 and sys.argv[2] == 'projecao'
# o teste de fluidez (QUADROS e ORGANICO no ambiente, como no coelho.py): entra e sai à parte, em fluidez/
QUADROS = int(os.environ.get('QUADROS', '8'))
ORGANICO = os.environ.get('ORGANICO') == '1'
VARIANTE = f"q{QUADROS}{'o' if ORGANICO else ''}" if QUADROS != 8 or ORGANICO else ''
ENTRADA = os.path.join(AQUI, 'saida', f"quadros{'-proj' if PROJECAO else ''}{'-' + VARIANTE if VARIANTE else ''}-{ESCALA}x")
# a escala 4 é a escolhida e vai para a pasta; as outras ficam em saida/final-<n>x/, só para comparar
SAIDA = os.path.join(AQUI, 'projecao') if PROJECAO else AQUI if ESCALA == 4 else os.path.join(AQUI, 'saida', f'final-{ESCALA}x')
if VARIANTE:
    SAIDA = os.path.join(AQUI, 'fluidez', VARIANTE)
os.makedirs(SAIDA, exist_ok=True)
DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
MASCOTE = os.path.join(AQUI, '..', 'mascote', 'baixa-120')
SALAO = os.path.join(AQUI, '..', '..', 'salao')
CONTORNO = (2, 1, 2, 255)   # o preto do contorno do mascote

# a paleta: a que o coelho.py escreveu (os tons de cada material, medidos no mascote do PixelLab)
with open(os.path.join(AQUI, 'saida', 'paleta.json'), encoding='utf-8') as f:
    _p = json.load(f)
MATERIAIS = {k: [tuple(c) for c in v] for k, v in _p['materiais'].items()}
PALETA = sorted({c for tons in MATERIAIS.values() for c in tons} | {tuple(_p['quente'])})
TRACO = MATERIAIS['traco'][0]
if PROJECAO:
    # na B entram também as cores do próprio desenho do PixelLab (as que aparecem em mais de 4 pixels)
    _cont = Counter()
    for _d in ('south-east', 'south-west', 'north-east', 'north-west'):
        _im = Image.open(os.path.join(AQUI, '..', 'mascote', 'baixa-120', f'{_d}.png')).convert('RGBA')
        _cont.update(c[:3] for c in _im.get_flattened_data() if c[3])
    PALETA = sorted(set(PALETA) | {c for c, n in _cont.items() if n > 4})


_PERTO = {}


def perto(c):
    c = c[:3]
    if c not in _PERTO:
        _PERTO[c] = min(PALETA, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)
    return _PERTO[c]


# a linha por dentro: o tom mais escuro do próprio material (e o preto do contorno, se ele já é o mais escuro)
LINHA_DE = {}
for tons in MATERIAIS.values():
    for c in tons:
        LINHA_DE.setdefault(c, tons[0] if c != tons[0] else CONTORNO[:3])
LINHA_DE[tuple(_p['quente'])] = MATERIAIS['pelo'][0]
LINHA_DE[TRACO] = TRACO
PROFUNDIDADE = 4   # 12 unidades em 0..255: ~0,2 unidade de distância para valer como "na frente"


def reduzir(img, ids):
    """Devolve (cores, parte, distância) em 120 × 120. Em cada bloco vale a cor que mais aparece; a parte também."""
    img = img.convert('RGBA')
    ids = ids.convert('RGBA')
    n = ESCALA
    w = img.width // n
    px, pi = img.load(), ids.load()
    out = Image.new('RGBA', (w, w), (0, 0, 0, 0))
    parte = [[0] * w for _ in range(w)]
    dist = [[0] * w for _ in range(w)]
    for by in range(w):
        for bx in range(w):
            cores, grupos, soma = Counter(), Counter(), Counter()
            cheio = 0
            for y in range(by * n, by * n + n):
                for x in range(bx * n, bx * n + n):
                    c = px[x, y]
                    if c[3] >= 128:
                        cheio += 1
                        cores[perto(c)] += 1
                    q = pi[x, y]
                    if q[3] >= 128:
                        g = round(q[0] * 16 / 255)
                        grupos[g] += 1
                        soma[g] += q[2]
            if cheio * 2 < n * n:
                continue
            cor, _ = cores.most_common(1)[0]
            # o traço do rosto é fino: se ele aparece no bloco, ele ganha (senão o olho some na redução)
            if cores[TRACO] >= max(1, n * n // 4):
                cor = TRACO
            out.putpixel((bx, by), cor + (255,))
            if grupos:
                g, k = grupos.most_common(1)[0]
                parte[by][bx], dist[by][bx] = g, soma[g] / k
    return out, parte, dist


def contornar(img, parte, dist):
    w, h = img.size
    px = img.load()
    out = img.copy()
    po = out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3]:
                # por dentro: este pixel é de uma parte que está ATRÁS da vizinha -> vira linha
                g = parte[y][x]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < w and 0 <= yy < h and px[xx, yy][3]:
                        h2 = parte[yy][xx]
                        if g and h2 and h2 != g and dist[yy][xx] + PROFUNDIDADE < dist[y][x]:
                            po[x, y] = LINHA_DE.get(px[x, y][:3], CONTORNO[:3]) + (255,)
                            break
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and px[xx, yy][3]:
                    po[x, y] = CONTORNO
                    break
    return out


def processar(nome):
    cor = Image.open(os.path.join(ENTRADA, nome))
    ids = Image.open(os.path.join(ENTRADA, nome.replace('.png', '-id.png')))
    return contornar(*reduzir(cor, ids))


def fundo(img, cor=(90, 90, 110, 255)):
    f = Image.new('RGBA', img.size, cor)
    f.alpha_composite(img)
    return f


def x3(img, k=3):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


parados, faixas = {}, {}
for d in DIRS:
    parados[d] = processar(f'parado-{d}.png')
    parados[d].save(os.path.join(SAIDA, f'parado-{d}.png'))
    faixa = Image.new('RGBA', (120 * QUADROS, 120), (0, 0, 0, 0))
    for i in range(QUADROS):
        faixa.alpha_composite(processar(f'varrendo-{d}-{i}.png'), (120 * i, 0))
    faixa.save(os.path.join(SAIDA, f'varrendo-{d}.png'))
    faixas[d] = faixa
    print('ok', d)

# A ÂNCORA: a vassoura passa na frente e abaixo dos pés, então o "meio da última linha" do quadro 1 não é o pé.
# O pé fica onde o pé do coelho parado está (a câmera não mexe entre o parado e o varrendo).
anc = {}
for d in DIRS:
    a = parados[d]
    fundo_y = max(y for y in range(120) for x in range(120) if a.getpixel((x, y))[3])
    xs = [x for y in range(fundo_y - 3, fundo_y + 1) for x in range(120) if a.getpixel((x, y))[3]]
    anc[d] = [round(sum(xs) / len(xs), 1), fundo_y]
with open(os.path.join(SAIDA, 'varrendo.json'), 'w', encoding='utf-8') as f:
    json.dump({'quadro': [120, 120], 'quadros': QUADROS, 'fps': round(QUADROS * 10 / 8), 'repete': True,
               'pe': anc, 'nota': 'pe = âncora explícita (do coelho parado); a vassoura desce abaixo dos pés'},
              f, ensure_ascii=False, indent=2)

# COMPARAR: por direção, o mascote do PixelLab parado | o do Blender parado | os 8 quadros varrendo; tudo 3×
linhas = []
for d in DIRS:
    ref = Image.open(os.path.join(MASCOTE, f'{d}.png')).convert('RGBA')
    linha = Image.new('RGBA', (120 * (2 + QUADROS), 120), (0, 0, 0, 0))
    linha.alpha_composite(ref, (0, 0))
    linha.alpha_composite(parados[d], (120, 0))
    linha.alpha_composite(faixas[d], (240, 0))
    linhas.append(linha)
comp = Image.new('RGBA', (120 * (2 + QUADROS), 120 * len(DIRS)), (90, 90, 110, 255))
for i, l in enumerate(linhas):
    comp.alpha_composite(l, (0, 120 * i))
x3(comp).save(os.path.join(SAIDA, 'comparar.png'))

# NO SALÃO: lado a lado no chão do salão 16 × 16, no tamanho de verdade (1 px do quadro = 1 px da cena), cada um com o
# pé no ponto do chão: o do PixelLab parado, o do Blender parado e dois quadros varrendo (sudeste e sudoeste).
def ancora(fig):
    fy = max(y for y in range(fig.height) for x in range(fig.width) if fig.getpixel((x, y))[3])
    xs = [x for y in range(fy - 3, fy + 1) for x in range(fig.width) if fig.getpixel((x, y))[3]]
    return sum(xs) / len(xs), fy


for base_nome, saida_nome in (('base16', 'no-salao.png'), ('noite16', 'no-salao-noite.png')):
    base = Image.open(os.path.join(SALAO, f'{base_nome}.png')).convert('RGBA')
    ref = Image.open(os.path.join(MASCOTE, 'south-east.png')).convert('RGBA')
    figuras = [(ref, ancora(ref)), (parados['south-east'], anc['south-east']),
               (faixas['south-east'].crop((0, 0, 120, 120)), anc['south-east']),
               (faixas['south-west'].crop((120 * 6, 0, 120 * 7, 120)), anc['south-west'])]
    # quatro casas vizinhas do chão, na mesma fileira (a casa é 27 × 14,25)
    pontos = [(458, 520), (512, 520), (566, 520), (620, 520)]
    for (x, y), (fig, (ax, ay)) in zip(pontos, figuras):
        base.alpha_composite(fig, (round(x - ax), round(y - ay)))
    x3(base.crop((380, 380, 700, 560))).save(os.path.join(SAIDA, saida_nome))
# A ANIMAÇÃO PARA VER: as 4 direções lado a lado, em 3×, no chão do salão, a 10 quadros por segundo
chao = Image.open(os.path.join(SALAO, 'base16.png')).convert('RGBA').crop((392, 470, 872, 590))
gif = []
for i in range(QUADROS):
    q = chao.copy()
    for k, d in enumerate(DIRS):
        q.alpha_composite(faixas[d].crop((120 * i, 0, 120 * i + 120, 120)), (120 * k, 0))
    gif.append(x3(q).convert('RGB'))
gif[0].save(os.path.join(SAIDA, 'varrendo.gif'), save_all=True, append_images=gif[1:], duration=round(800 / QUADROS), loop=0)
# A e B lado a lado (só na rodada da B): por direção, PixelLab | A parado | B parado | A e B em dois quadros varrendo
if PROJECAO:
    linhas = []
    for d in DIRS:
        ref = Image.open(os.path.join(MASCOTE, f'{d}.png')).convert('RGBA')
        a_par = Image.open(os.path.join(AQUI, f'parado-{d}.png')).convert('RGBA')
        a_var = Image.open(os.path.join(AQUI, f'varrendo-{d}.png')).convert('RGBA')
        pecas = [ref, a_par, parados[d]]
        for i in (2, 6):
            pecas += [a_var.crop((120 * i, 0, 120 * i + 120, 120)), faixas[d].crop((120 * i, 0, 120 * i + 120, 120))]
        linha = Image.new('RGBA', (120 * len(pecas), 120), (90, 90, 110, 255))
        for k, pc in enumerate(pecas):
            linha.alpha_composite(pc, (120 * k, 0))
        linhas.append(linha)
    ab = Image.new('RGBA', (linhas[0].width, 120 * len(linhas)))
    for k, l in enumerate(linhas):
        ab.paste(l, (0, 120 * k))
    x3(ab).save(os.path.join(AQUI, 'comparar-a-b.png'))
print('FIM')
