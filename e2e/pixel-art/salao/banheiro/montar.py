# O BANHEIRO DO SALÃO EM PIXEL ART: a MONTAGEM (09/11/2026). A casca escolhida e as peças avulsas escolhidas (banheiro.mjs),
# postas numa grade como os móveis do salão, na arrumação do banheiro 3D (PECAS_DO_BANHEIRO em web/src/salao3d/cena.ts): a pia
# no canto, com o espelho em cima; a banheira ao longo da parede da direita, com a prateleira da vela em cima; o tapete com os
# chinelos na frente dela; as toalhas, o lixinho e o papel; a porta de dentro na parede da esquerda, perto da frente. Uma
# diferença de propósito: no 3D o vaso fica encostado na mureta da frente, e aqui (sem muretas, como o salão de pixel art) ele
# fica encostado na parede da esquerda, para não ficar solto no meio do chão.
# É uma cena FIXA (não se arruma): sai pronta, de dia e de noite, e a página só põe o patinho por cima (ele boia).
# A NOITE é por código, como a do quarto: a cor do dia vezes o tom azulado da noite do salão, e a luz morna da vela, que acende
# (a chama fica com a cor do dia, e ela clareia a parede e o que está perto).
#   py -3 e2e/pixel-art/salao/banheiro/montar.py   → pronto/{dia,noite,porta,pato-dia,pato-noite}.png e pronto/banheiro.json
import json, os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(AQUI, *a)
SAIDA = P('pronto')
os.makedirs(SAIDA, exist_ok=True)

# A CASCA: casca-2 (o quadro de 432 × 528), recortada em volta do cômodo. Os cantos do chão foram MEDIDOS nela (as bordas do
# piso verde-água, pelas retas dos quatro lados): o PixelLab não seguiu as medidas do guia (ver guia.py).
CASCA, RECORTE = 'casca-2.png', (63, 84, 369, 442)
OX, OY = RECORTE[0], RECORTE[1]
FUNDO, ESQ, DIR, FRENTE = (203.3 - OX, 268.9 - OY), (90.0 - OX, 331.0 - OY), (340.0 - OX, 343.0 - OY), (220.5 - OX, 403.0 - OY)
NU, NV = 5, 4  # casas (da casa do salão, ~27 px) na parede da direita e na da esquerda


def ponto(u, v, h=0.0):
    """casas (u ao longo da parede da direita, v ao longo da da esquerda) e altura em px → pixel"""
    a, b = u / NU, v / NV
    x = FUNDO[0] * (1 - a) * (1 - b) + DIR[0] * a * (1 - b) + ESQ[0] * (1 - a) * b + FRENTE[0] * a * b
    y = FUNDO[1] * (1 - a) * (1 - b) + DIR[1] * a * (1 - b) + ESQ[1] * (1 - a) * b + FRENTE[1] * a * b
    return x, y - h


# AS PEÇAS: a opção escolhida de cada uma (pecas/<id>-<n>.png, escolhida nas folhas de contato). No chão, o pé (u0, u1, v0,
# v1): o pé da imagem vai à quina da frente dele e o meio, ao meio dele. Na parede, o meio da imagem vai ao ponto (a casas ao
# longo dela, h px acima do chão); a porta, que fica no chão, pelo pé. espelhar: a peça foi desenhada para a parede da direita
# e vai à da esquerda. d: um ajuste à mão, em px. Tudo conferido na foto (auditoria-visual.mjs, grupo banheiro).
PECAS = [
    {'id': 'espelho', 'arq': 'espelho-30', 'parede': 'direita', 'a': 1.2, 'h': 118},
    {'id': 'prateleira', 'arq': 'prateleira-17', 'parede': 'direita', 'a': 3.4, 'h': 112},
    {'id': 'porta', 'arq': 'porta-10', 'parede': 'esquerda', 'a': 2.95, 'h': 0, 'chao': True, 'espelhar': True},
    {'id': 'pia', 'arq': 'pia-5', 'pe': (0.35, 2.0, 0.0, 1.2)},
    {'id': 'banheira', 'arq': 'banheira-5', 'pe': (2.15, 5.0, 0.0, 1.65)},
    {'id': 'vaso', 'arq': 'vaso-21', 'pe': (0.0, 1.0, 1.3, 2.25), 'espelhar': True},
    {'id': 'papel', 'arq': 'papel-73', 'pe': (1.1, 1.4, 1.75, 2.05)},
    {'id': 'toalhas', 'arq': 'toalhas-12', 'pe': (1.7, 2.15, 1.55, 2.0)},
    {'id': 'lixo', 'arq': 'lixo-1', 'pe': (1.15, 1.5, 2.3, 2.65)},
    {'id': 'tapete', 'arq': 'tapete-20', 'pe': (2.2, 4.3, 2.0, 3.1), 'deitado': True},
]
# O PATINHO: o canto de cima da imagem (px da cena), na água da banheira; a linha da água (abaixo dela ele fica submerso); e
# quantos px ele anda para cada lado, boiando.
PATO = {'arq': 'patinho-14', 'xy': (218, 220), 'agua': 230, 'anda': 3}
# A VELA da prateleira: o meio da chama (px da cena), para a luz da noite.
VELA = (214, 100)


def carregar(arq, espelhar=False):
    im = Image.open(P('pecas', arq + '.png')).convert('RGBA')
    im = im.crop(im.getbbox())
    a = np.array(im)
    a[..., 3] = np.where(a[..., 3] > 127, 255, 0)  # pixel art: sem meio transparente
    im = Image.fromarray(a, 'RGBA')
    return im.transpose(Image.FLIP_LEFT_RIGHT) if espelhar else im


def lugar(p, im):
    """o canto de cima da imagem da peça na cena"""
    dx, dy = p.get('d', (0, 0))
    if 'pe' in p:
        u0, u1, v0, v1 = p['pe']
        fx, fy = ponto(u1, v1)
        mx, _ = ponto((u0 + u1) / 2, (v0 + v1) / 2)
        return round(mx - im.width / 2 + dx), round(fy - im.height + dy)
    x, y = ponto(p['a'], 0, p['h']) if p['parede'] == 'direita' else ponto(0, p['a'], p['h'])
    if p.get('chao'):  # a porta: o pé no chão, na ponta da frente dela
        return round(x - im.width / 2 + dx), round(y - im.height + im.width * 0.26 + dy)
    return round(x - im.width / 2 + dx), round(y - im.height / 2 + dy)


def profundidade(p):
    if 'pe' in p:
        return (0 if p.get('deitado') else 1, p['pe'][1] + p['pe'][3])
    return (-1, 0)


casca = Image.open(P(CASCA)).convert('RGBA').crop(RECORTE)
W, H = casca.size
cena = casca.copy()

# AS SOMBRAS DE CONTATO no piso: o pé de cada peça do chão, um pouco maior, escurecido e desfocado (como as do salão).
sombra = Image.new('L', (W, H), 0)
ds = ImageDraw.Draw(sombra)
for p in PECAS:
    if 'pe' not in p or p.get('deitado'):
        continue
    u0, u1, v0, v1 = p['pe']
    ds.polygon([ponto(u0 - 0.05, v0 - 0.05), ponto(u1 + 0.12, v0 - 0.05), ponto(u1 + 0.12, v1 + 0.12), ponto(u0 - 0.05, v1 + 0.12)], fill=110)
sombra = np.array(sombra.filter(ImageFilter.GaussianBlur(2.2))).astype(float) / 255
ca = np.array(cena).astype(float)
ca[..., :3] *= (1 - 0.45 * sombra)[..., None]
cena = Image.fromarray(ca.clip(0, 255).astype(np.uint8), 'RGBA')

porta = Image.new('RGBA', (W, H), (0, 0, 0, 0))
lugares = {}
for p in sorted(PECAS, key=profundidade):
    im = carregar(p['arq'], p.get('espelhar'))
    xy = lugar(p, im)
    lugares[p['id']] = (xy, im.size)
    cena.alpha_composite(im, xy)
    if p['id'] == 'porta':
        porta.alpha_composite(im, xy)

# o patinho (a página o desenha; aqui só o recorte dele, de dia e de noite)
pato = carregar(PATO['arq'])

# A NOITE: o tom da noite do salão (azulado e escuro) e a luz da vela. A chama (os pixels claros e quentes perto da vela)
# continua acesa, com a cor do dia.
TOM = np.array([0.40, 0.42, 0.62])
LUZ = np.array([255, 178, 104]) / 255


def noite(img, origem=(0, 0)):
    a = np.array(img).astype(float)
    h, w = a.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    xs, ys = xs + origem[0], ys + origem[1]
    d2 = ((xs - VELA[0]) ** 2 + ((ys - VELA[1]) * 1.25) ** 2)
    luz = 0.95 * np.exp(-d2 / (2 * 38.0 ** 2)) + 0.28 * np.exp(-d2 / (2 * 110.0 ** 2))
    rgb = a[..., :3] / 255
    rgb = rgb * TOM + rgb * LUZ * luz[..., None] * 0.9
    claro = rgb.max(-1)
    out = a.copy()
    out[..., :3] = (rgb.clip(0, 1) * 255)
    if origem == (0, 0):
        chama = (np.hypot(xs - VELA[0], ys - VELA[1]) < 5) & (a[..., 0] > 200) & (a[..., 1] > 150) & (a[..., 0] > a[..., 2] + 40)
        out[chama, :3] = a[chama, :3]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGBA')


cena.save(os.path.join(SAIDA, 'dia.png'), optimize=True)
noite(cena).save(os.path.join(SAIDA, 'noite.png'), optimize=True)
porta.save(os.path.join(SAIDA, 'porta.png'), optimize=True)
pato.save(os.path.join(SAIDA, 'pato-dia.png'), optimize=True)
noite(pato, tuple(PATO['xy'])).save(os.path.join(SAIDA, 'pato-noite.png'), optimize=True)
# (as caixas das peças vão junto, para a auditoria visual fotografar cada uma)
json.dump({'W': W, 'H': H, 'pato': {'xy': list(PATO['xy']), 'agua': PATO['agua'], 'anda': PATO['anda']}, 'pecas': {k: [x, y, x + w, y + h] for k, ((x, y), (w, h)) in lugares.items()}}, open(os.path.join(SAIDA, 'banheiro.json'), 'w', encoding='utf8'))
print({k: v for k, v in lugares.items()}, 'pato', pato.size)
