# O RITMO DA PIXEL ART (pedido dele, 18/10/2026: "se ficar com muitos frames vai destoar da estética pixel"). A mesma varrida
# orgânica de 24 quadros (q24o), com o MESMO ciclo de 1,2 s, mostrada em quatro ritmos — o que muda é quanto tempo cada
# desenho fica na tela, não o desenho:
#   - em um (24/s): todo quadro novo, o mais liso;
#   - em dois (12/s): cada desenho segura dois tempos, o ritmo clássico de animação à mão e de muita pixel art;
#   - em três (8/s): cada desenho segura três tempos, o mais "pixel" e o mais travado;
#   - variável: em um no golpe (rápido, para não engasgar), em dois e em três na volta e nas pontas (lento, pose lida).
# Sai ritmos.gif, no chão do salão, em 3×.   python tempos.py [segundos por ciclo]
import math, os, sys
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
CICLO = float(sys.argv[1]) if len(sys.argv) > 1 else 1.2
N = 24
try:
    FONTE = ImageFont.truetype('arial.ttf', 11)
except OSError:
    FONTE = ImageFont.load_default()

def em(passo):
    return [k - k % passo for k in range(N)]

def variavel():
    # a velocidade da vassoura em cada quadro (a derivada da onda orgânica do coelho.py): rápida → em um; média → em dois;
    # lenta → em três. Um desenho só se repete enquanto o movimento é lento o bastante para o olho não ver o salto.
    vel = [abs(math.cos(p + 0.55 * math.sin(p)) * (1 + 0.55 * math.cos(p))) for p in (2 * math.pi * k / N for k in range(N))]
    seq, k = [], 0
    while k < N:
        passo = 1 if vel[k] > 0.7 else 2 if vel[k] > 0.3 else 3
        seq += [k] * passo
        k += passo
    return seq[:N]

RITMOS = [('em um (24/s)', em(1)), ('em dois (12/s)', em(2)), ('em três (8/s)', em(3)), ('variável', variavel())]
DIRS = ['south-east', 'south-west']
faixas = {d: Image.open(os.path.join(AQUI, 'q24o', f'varrendo-{d}.png')).convert('RGBA') for d in DIRS}
chao = Image.open(os.path.join(AQUI, '..', '..', '..', 'salao', 'base16.png')).convert('RGBA').crop((392, 470, 632, 590))

quadros = []
for t in range(N):
    tela = Image.new('RGBA', (chao.width * len(RITMOS) + 8 * (len(RITMOS) - 1), chao.height + 14), (24, 22, 30, 255))
    for j, (nome, seq) in enumerate(RITMOS):
        cena = chao.copy()
        i = seq[t]
        for m, d in enumerate(DIRS):
            cena.alpha_composite(faixas[d].crop((120 * i, 0, 120 * i + 120, 120)), (120 * m, 0))
        x = j * (chao.width + 8)
        tela.alpha_composite(cena, (x, 14))
        ImageDraw.Draw(tela).text((x + 4, 1), nome, fill=(240, 236, 226, 255), font=FONTE)
    quadros.append(tela.resize((tela.width * 3, tela.height * 3), Image.NEAREST).convert('RGB'))
quadros[0].save(os.path.join(AQUI, 'ritmos.gif'), save_all=True, append_images=quadros[1:], duration=round(CICLO * 1000 / N), loop=0)
print('ritmos.gif; variavel =', variavel(), '=', len(set(variavel())), 'desenhos distintos')
