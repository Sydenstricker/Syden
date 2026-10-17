# Uma imagem DE FORA (feita em outra ferramenta, com fundo transparente) vira objeto da parede do salão:
# parede-salao/<item>/peca-dia.png e peca-noite.png, como as de avulsos.py, e item.json.
#   python e2e/pixel-art/quarto/novo/quarto/parede/de-imagem.py <item> <largura> <altura> [cores]
#
# Feito para o pôster "Café & Fofoca" (dele, 17/10/2026, feito no ChatGPT): a imagem vem com uma perspectiva qualquer e em
# alta resolução. Aqui ela é (1) endireitada pelos quatro cantos, (2) reduzida ao tamanho de pixel art em blocos (cada
# pixel novo é a média do bloco, sem borrão de interpolação), com poucas cores, e (3) inclinada como a parede da direita
# (a mesma conta do chão de avulsos.py: 114 px de queda a cada 216).
#
# COM TEXTO, A OUTRA PAREDE NÃO PODE SER O ESPELHO: o motor desenha a parede da esquerda espelhando a peça (x → W − 1 − x),
# e o "Café" sairia "éfaC". Por isso sai também peca-dia-esq.png / peca-noite-esq.png: a peça já espelhada e inclinada de
# modo que, espelhada de novo pelo motor, fique legível e com a inclinação da parede da esquerda.
import json, os, sys
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__)); BASE = os.path.join(os.path.dirname(AQUI), 'parede-salao')
A = 114 / 216
chao = lambda x: 253 + (x - 256) * A
item, larg, alt = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
ncores = int(sys.argv[4]) if len(sys.argv) > 4 else 48
d = os.path.join(BASE, item)
src = Image.open(os.path.join(d, 'origem.png')).convert('RGBA')
a = np.array(src)
op = a[..., 3] > 127
ys, xs = np.nonzero(op)

# (1) os quatro cantos: pelas bordas de cima e de baixo, medidas coluna a coluna (as fitas dos cantos atrapalhariam os
# extremos), e as colunas da esquerda e da direita.
x0, x1 = xs.min(), xs.max()
amostra = np.linspace(x0 + (x1 - x0) * 0.15, x0 + (x1 - x0) * 0.85, 12).astype(int)
cima = np.array([np.nonzero(op[:, x])[0].min() for x in amostra]); baixo = np.array([np.nonzero(op[:, x])[0].max() for x in amostra])
ac, bc = np.polyfit(amostra, cima, 1); ab, bb = np.polyfit(amostra, baixo, 1)
canto = lambda x, a_, b_: (float(x), float(a_ * x + b_))
quad = [*canto(x0, ac, bc), *canto(x0, ab, bb), *canto(x1, ab, bb), *canto(x1, ac, bc)]  # NW, SW, SE, NE
F = 8  # endireita em 8× o tamanho final, para depois reduzir por blocos
plano = src.transform((larg * F, alt * F), Image.QUAD, quad, Image.BICUBIC)
p = np.array(plano).astype(float)
# (2) por blocos: a cor é a média dos pixels opacos do bloco; o bloco fica opaco se a maioria for
blocos = p.reshape(alt, F, larg, F, 4).transpose(0, 2, 1, 3, 4).reshape(alt, larg, F * F, 4)
peso = (blocos[..., 3] > 127)
n = peso.sum(2)
cor = (blocos[..., :3] * peso[..., None]).sum(2) / np.maximum(1, n)[..., None]
alfa = n > F * F / 2
img = Image.fromarray(np.dstack([cor, alfa * 255]).astype(np.uint8), 'RGBA')
q = img.convert('RGB').quantize(ncores, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
plana = np.dstack([np.array(q), alfa * 255]).astype(np.uint8)

# (3) inclinada como a parede da direita, posta onde o pôster do karaokê foi pintado (coordenadas do quarto, 27 px acima)
X0, TOPO = 336, 84
tela = np.zeros((512, 512, 4), np.uint8); esq = np.zeros((512, 512, 4), np.uint8)
for c in range(larg):
    desce = int(round(A * c))
    tela[TOPO + desce:TOPO + desce + alt, X0 + c] = plana[:, c]
    # a da esquerda: a coluna espelhada (o motor espelha de novo) e a mesma queda (a caixa é a mesma)
    esq[TOPO + desce:TOPO + desce + alt, X0 + c] = plana[:, larg - 1 - c]
for nome, t in [('peca', tela), ('peca-esq', esq)]:
    t[..., :3] *= (t[..., 3:] > 0)
    for q_ in ('dia', 'noite'):
        Image.fromarray(t, 'RGBA').save(os.path.join(d, nome.replace('peca', 'peca-' + q_) + '.png'), optimize=True)
m = tela[..., 3] > 0
cols = np.nonzero(m.any(0))[0]; meio = int((cols.min() + cols.max()) / 2)
hs = chao(meio) - (np.nonzero(m[:, cols.min():cols.max() + 1].any(1))[0] + 27)
caminho = os.path.join(d, 'item.json')
meta = json.load(open(caminho, encoding='utf8')) if os.path.exists(caminho) else {}
meta.update({'ocupa': [round((cols.min() - 256) / 27, 2), round((cols.max() + 1 - 256) / 27, 2)], 'alto': [round(float(hs.min()), 1), round(float(hs.max()), 1)], 'avulso': 0, 'texto': True})
json.dump(meta, open(caminho, 'w', encoding='utf8'), ensure_ascii=False)
print(item, larg, 'x', alt, meta)
