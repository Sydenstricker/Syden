# O TESTE DE FLUIDEZ, lado a lado (pedido dele, 18/10/2026): a mesma varrida em 8 quadros (o limite que vinha do custo do
# PixelLab), em 12 e 24 quadros "orgânicos" (golpe com pressa, volta mais lenta, corpo e cabeça atrasados) e em 24 com o
# seno puro. O ciclo leva o mesmo tempo nas quatro: só muda quantas fatias ele tem. Sai fluidez.gif, no chão do salão, em 3×.
# Os quadros de cada versão saem de "QUADROS=n [ORGANICO=1]" no coelho.py (Blender) e no pos.py, em fluidez/q<n>[o]/.
#   python comparar.py [segundos por ciclo]   (padrão 1,2 s)
import os, sys
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
CICLO = float(sys.argv[1]) if len(sys.argv) > 1 else 1.2
TICKS = 24  # a linha do tempo comum: 24 passos por ciclo
VERSOES = [('8 quadros', os.path.join(AQUI, '..'), 8), ('12 orgânica', os.path.join(AQUI, 'q12o'), 12), ('24 quadros', os.path.join(AQUI, 'q24'), 24), ('24 orgânica', os.path.join(AQUI, 'q24o'), 24)]
try:
    FONTE = ImageFont.truetype('arial.ttf', 11)  # (a fonte padrão do Pillow não tem o â)
except OSError:
    FONTE = ImageFont.load_default()
DIRS = ['south-east', 'south-west']
chao = Image.open(os.path.join(AQUI, '..', '..', '..', 'salao', 'base16.png')).convert('RGBA').crop((392, 470, 632, 590))

faixas = {(n, d): Image.open(os.path.join(p, f'varrendo-{d}.png')).convert('RGBA') for n, p, _ in VERSOES for d in DIRS}
quadros = []
for k in range(TICKS):
    tela = Image.new('RGBA', (chao.width * len(VERSOES) + 8 * (len(VERSOES) - 1), chao.height + 14), (24, 22, 30, 255))
    for j, (nome, _, q) in enumerate(VERSOES):
        cena = chao.copy()
        i = k * q // TICKS
        for m, d in enumerate(DIRS):
            cena.alpha_composite(faixas[(nome, d)].crop((120 * i, 0, 120 * i + 120, 120)), (120 * m, 0))
        x = j * (chao.width + 8)
        tela.alpha_composite(cena, (x, 14))
        ImageDraw.Draw(tela).text((x + 4, 1), nome, fill=(240, 236, 226, 255), font=FONTE)
    quadros.append(tela.resize((tela.width * 3, tela.height * 3), Image.NEAREST).convert('RGB'))
quadros[0].save(os.path.join(AQUI, 'fluidez.gif'), save_all=True, append_images=quadros[1:], duration=round(CICLO * 1000 / TICKS), loop=0)
print('fluidez.gif', len(quadros), 'quadros,', CICLO, 's por ciclo')
