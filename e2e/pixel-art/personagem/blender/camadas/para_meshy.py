# As entradas do Meshy para o piloto das camadas em 3D (como as de avatares/frente/para-meshy/): o desenho recortado,
# ampliado em INTEIRO (pixels nítidos) até ~1000 px no lado maior, sobre fundo branco, com margem.
#   corpo-orelha-caida.png, corpo-musculoso.png   o south.png (de frente) de cada corpo, sem acessório
#   bone.png, bandana.png                          o acessório sozinho, tirado da camada 2D (sudeste: não há camada de frente)
# Corpo que ainda não existe (o musculoso estava sendo gerado) fica de fora: rodar de novo quando ele existir.
# Uso: py -3 para_meshy.py
import os
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
PERS = os.path.normpath(os.path.join(AQUI, '..', '..'))
SAI = os.path.join(AQUI, 'para-meshy')
os.makedirs(SAI, exist_ok=True)


def preparar(im, destino, so_acessorio=False):
    im = im.convert('RGBA')
    if so_acessorio:
        # a camada é a diferença do repintado: tira o que veio de pelo (claro e pouco saturado)
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a and max(r, g, b) - min(r, g, b) < 35 and r + g + b > 300:
                    px[x, y] = (0, 0, 0, 0)
    im = im.crop(im.getbbox())
    k = max(1, 1000 // max(im.size))
    im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    m = max(im.size) // 12
    fundo = Image.new('RGBA', (im.width + 2 * m, im.height + 2 * m), (255, 255, 255, 255))
    fundo.alpha_composite(im, (m, m))
    fundo.convert('RGB').save(os.path.join(SAI, destino))
    print('ok', destino, fundo.size, f'{k}x')


for corpo in ('orelha-caida', 'musculoso'):
    f = os.path.join(PERS, corpo, 'baixa-120', 'south.png')
    if os.path.exists(f):
        preparar(Image.open(f), f'corpo-{corpo}.png')
    else:
        print('falta', f)
# o boné: o da orelha caída aparece INTEIRO (no mascote, a orelha cobre um pedaço); a bandana: a do mascote
for ac, corpo in (('bone', 'orelha-caida'), ('bandana', 'mascote')):
    f = os.path.join(PERS, corpo, 'acessorios', ac, 'parado', 'south-east-0.png')
    preparar(Image.open(f), f'{ac}.png', so_acessorio=True)
