# As imagens da v4 (10/11/2026): o boné do Meshy no mascote PRINCIPAL, com as orelhas ajustadas pelo osso quando ele está
# posto. Lê o que o rodar.ps1 e o pos.py já fizeram (saida/) e salva na pasta dada (padrão: ./v4/).
# Uso: py -3 entrega_v4.py [pasta]   (SUFIXO=v5 no ambiente troca o sufixo dos arquivos)
import os, sys, shutil
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
PERS = os.path.normpath(os.path.join(AQUI, '..', '..'))
SALAO = os.path.normpath(os.path.join(PERS, '..', 'salao'))
SUF = os.environ.get('SUFIXO', 'v4')
DEST = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, SUF)
os.makedirs(DEST, exist_ok=True)
FUNDO = (70, 72, 90, 255)
DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
OITO = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
PX = os.path.join(AQUI, 'saida', 'pixel')


def x3(img, k=3):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def abrir(p):
    return Image.open(p).convert('RGBA')


def dois_d(combo, d):
    base = os.path.join(PERS, 'mascote')
    if combo == 'nada':
        return abrir(os.path.join(base, 'baixa-120', f'{d}.png'))
    return abrir(os.path.join(base, 'acessorios', 'bone', 'parado', 'com', f'{d}-0.png')).crop((6, 6, 126, 126))


# 1) o boné, 2D e 3D em pixel art lado a lado nas 4 diagonais; no fim, o 3D de lado (leste e oeste) e de costas
extra = ['east', 'west', 'north']
l = Image.new('RGBA', (len(DIRS) * 260 + 120 * len(extra), 120), FUNDO)
for i, d in enumerate(DIRS):
    l.alpha_composite(dois_d('bone', d), (i * 260, 0))
    l.alpha_composite(abrir(os.path.join(PX, f'mascote-bone-{d}.png')), (i * 260 + 120, 0))
for j, d in enumerate(extra):
    f = os.path.join(PX, f'mascote-bone-{d}.png')
    if os.path.exists(f):
        l.alpha_composite(abrir(f), (len(DIRS) * 260 + 120 * j, 0))
x3(l).save(os.path.join(DEST, f'bone-2d-e-3d-{SUF}.png'))

# 2) o render 3D nas 8 vistas: sem boné em cima, com boné embaixo
L = 300
f8 = Image.new('RGBA', (L * 8, L * 2), FUNDO)
for r, combo in enumerate(('nada', 'bone')):
    for i, d in enumerate(OITO):
        im = abrir(os.path.join(AQUI, 'saida', 'normal', f'mascote-{combo}-{d}.png')).crop((60, 0, 540, 480))
        f8.alpha_composite(im.resize((L, L), Image.LANCZOS), (L * i, L * r))
f8.save(os.path.join(DEST, f'oito-vistas-{SUF}.png'))
# e as mesmas 8 em pixel art (3×)
p8 = Image.new('RGBA', (120 * 8, 240), FUNDO)
for r, combo in enumerate(('nada', 'bone')):
    for i, d in enumerate(OITO):
        f = os.path.join(PX, f'mascote-{combo}-{d}.png')
        if os.path.exists(f):
            p8.alpha_composite(abrir(f), (120 * i, 120 * r))
x3(p8).save(os.path.join(DEST, f'oito-vistas-pixel-{SUF}.png'))

# 3) os GIFs (o boné e a bandana postos: são as animações renderizadas com os dois)
for nome in ('parado', 'andando'):
    shutil.copy(os.path.join(AQUI, f'mascote-{nome}.gif'), os.path.join(DEST, f'mascote-bone-{nome}-{SUF}.gif'))

# 4) no salão, no tamanho de verdade: o 2D sem e com boné, o 3D sem e com boné
base = abrir(os.path.join(SALAO, 'base16.png'))
figs = [dois_d('nada', 'south-east'), dois_d('bone', 'south-east'),
        abrir(os.path.join(PX, 'mascote-nada-south-east.png')), abrir(os.path.join(PX, 'mascote-bone-south-east.png')),
        dois_d('bone', 'south-west'), abrir(os.path.join(PX, 'mascote-bone-south-west.png'))]


def ancora(fig):
    fy = max(y for y in range(fig.height) for x in range(fig.width) if fig.getpixel((x, y))[3])
    xs = [x for y in range(fy - 3, fy + 1) for x in range(fig.width) if fig.getpixel((x, y))[3]]
    return sum(xs) / len(xs), fy


for k, fig in enumerate(figs):
    ax, ay = ancora(fig)
    base.alpha_composite(fig, (round(300 + 54 * k - ax), round(520 - ay)))
x3(base.crop((240, 400, 300 + 54 * len(figs) + 40, 560))).save(os.path.join(DEST, f'no-salao-{SUF}.png'))

# 5) a página de teste
shutil.copy(os.path.join(AQUI, 'ver.html'), os.path.join(DEST, f'ver-{SUF}.html'))
print('ok', DEST)
