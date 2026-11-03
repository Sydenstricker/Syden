# AS CORES DE CADA AVATAR PRONTO NO KART (03/11/2026, Corrida dos coelhos): o kart é um desenho só (o mascote 3D no
# kart-cenoura, web/public/corrida/coelho-kart.png), e cada pessoa corre com as cores do PRÓPRIO coelho, por troca de
# paleta, como os jogos do Super Nintendo: o pelo e o moletom do mascote viram o pelo e a roupa do avatar.
#
# De cada corpo (web/public/avatares/coelho-NN-corpo.png; o 16 só tem o busto) sai:
#   pelo  = a cor clara mais comum (o creme do pelo)
#   roupa = a cor mais comum da metade de baixo, tirando o contorno, o pelo e o rosa
# e o resultado vai para web/src/corrida/coresDosAvatares.ts (não editar à mão). Também solta, para conferir,
# e2e/pixel-art/personagem/blender/meshy/t/kart-avatares.png: o kart de costas e de três quartos de cada um.
# Uso: python web/scripts/cores-dos-avatares.py
import colorsys, os
from collections import Counter
from PIL import Image

RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
AV = os.path.join(RAIZ, 'web', 'public', 'avatares')
FOLHA = os.path.join(RAIZ, 'web', 'public', 'corrida', 'coelho-kart.png')
SAIDA = os.path.join(RAIZ, 'web', 'src', 'corrida', 'coresDosAvatares.ts')
CONFERIR = os.path.join(RAIZ, 'e2e', 'pixel-art', 'personagem', 'blender', 'meshy', 't', 'kart-avatares.png')


def lum(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


def sat(c):
    return colorsys.rgb_to_hsv(*(x / 255 for x in c[:3]))[1]


def rosa(c):
    h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in c[:3]))
    return (h < 0.05 or h > 0.9) and s > 0.25 and v > 0.6


def cores(n):
    caminho = os.path.join(AV, f'coelho-{n:02d}-corpo.png')
    if not os.path.exists(caminho):
        caminho = os.path.join(AV, f'coelho-{n:02d}.png')
    im = Image.open(caminho).convert('RGBA')
    px = [(x, y, im.getpixel((x, y))) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3] > 200]
    claros = Counter(p[:3] for _, _, p in px if lum(p) > 170 and sat(p) < 0.35)
    pelo = claros.most_common(1)[0][0]
    perto_do_pelo = lambda c: sum(abs(a - b) for a, b in zip(c, pelo)) < 70
    baixo = Counter(
        p[:3] for x, y, p in px
        if y > im.height * 0.55 and lum(p) > 40 and not perto_do_pelo(p[:3]) and not rosa(p[:3])
    )
    roupa = baixo.most_common(1)[0][0] if baixo else (60, 50, 70)
    return pelo, roupa


# Os grupos do desenho do kart (a paleta do kart-pos.py): o pelo lilás do mascote e o moletom escuro.
PELO = [(224, 210, 237), (227, 205, 227), (210, 192, 220), (182, 162, 188), (175, 153, 182), (179, 157, 184), (161, 135, 154),
        (197, 164, 179), (122, 103, 123), (96, 79, 111)]
MOLETOM = [(61, 43, 54), (50, 33, 45), (46, 29, 41)]
PELO_BASE, MOLETOM_BASE = lum((227, 205, 227)), lum((61, 43, 54))


def trocar(c, pelo, roupa):
    if c in PELO:
        f = lum(c) / PELO_BASE
        return tuple(max(0, min(255, round(x * f))) for x in pelo)
    if c in MOLETOM:
        f = 0.72 + 0.28 * lum(c) / MOLETOM_BASE
        return tuple(max(0, min(255, round(x * f))) for x in roupa)
    return c


tabela = {n: cores(n) for n in range(1, 17)}
with open(SAIDA, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// GERADO por web/scripts/cores-dos-avatares.py (não editar à mão): de cada avatar pronto, a cor do pelo e a da roupa,\n')
    f.write('// para a troca de paleta do coelho no kart (render.ts, coelhoDoAvatar).\n')
    f.write('export const CORES_DOS_AVATARES: Record<number, { pelo: [number, number, number]; roupa: [number, number, number] }> = {\n')
    for n, (pelo, roupa) in tabela.items():
        f.write(f'  {n}: {{ pelo: [{pelo[0]}, {pelo[1]}, {pelo[2]}], roupa: [{roupa[0]}, {roupa[1]}, {roupa[2]}] }},\n')
    f.write('};\n\n')
    f.write('/** As cores do kart que mudam (o pelo e o moletom do mascote). As outras ficam como estão. */\n')
    f.write(f'export const PELO_DO_MASCOTE: [number, number, number][] = {[list(c) for c in PELO]};\n'.replace("'", ''))
    f.write(f'export const MOLETOM_DO_MASCOTE: [number, number, number][] = {[list(c) for c in MOLETOM]};\n'.replace("'", ''))

folha = Image.open(FOLHA).convert('RGBA')
conf = Image.new('RGBA', (60 * 3 * 4, 60 * 4 * 2), (70, 110, 64, 255))
for i, (n, (pelo, roupa)) in enumerate(tabela.items()):
    lin, col = divmod(i, 4)
    for k, quadro in enumerate((0, 3, 21)):
        q = folha.crop((quadro * 60, 0, quadro * 60 + 60, 60))
        q.putdata([trocar(p[:3], pelo, roupa) + (p[3],) if p[3] else p for p in q.get_flattened_data()])
        conf.alpha_composite(q, (col * 180 + k * 60, lin * 120 + 30))
conf.resize((conf.width * 2, conf.height * 2), Image.NEAREST).save(CONFERIR)
print('ok', SAIDA)
for n, c in tabela.items():
    print(n, c)
