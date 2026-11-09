# A ORELHA DE DENTRO ROSA (relato dele, 09/11/2026: "a orelha da esquerda está com falha na orelha interna, onde deveria
# ser rosado"): no varrendo de frente (sudeste), o PixelLab pintou o miolo da orelha esquerda com o cinza do verso da
# orelha nos 9 quadros. Só nessa orelha (acima do crânio, na metade esquerda), os cinzas arroxeados do miolo viram os
# rosas da outra orelha, o claro no claro e o escuro no escuro; o pelo branco, a sombra do pelo e o contorno ficam.
#   py -3 e2e/pixel-art/personagem/orelha-rosa.py <pasta da animação> <direção>
import os, sys
from PIL import Image

pasta, direcao = sys.argv[1], sys.argv[2]
ROSA, ROSA_ESCURO = (201, 119, 124), (154, 78, 72)

def pelo(c):
    return c[3] > 200 and c[0] > 200 and c[1] > 190 and c[2] > 200

def miolo_cinza(c):
    # o cinza arroxeado do verso: médio, pouco saturado, mais escuro que a sombra do pelo (175-179)
    r, g, b, a = c
    lum = (r + g + b) / 3
    return a > 200 and 110 <= lum <= 160 and max(r, g, b) - min(r, g, b) <= 40

for nome in sorted(os.listdir(pasta)):
    if not ((nome.startswith(direcao + '-') or nome == direcao + '.png') and nome.endswith('.png')):
        continue
    im = Image.open(os.path.join(pasta, nome)).convert('RGBA')
    w, h = im.size
    px = im.load()
    cont = [sum(1 for x in range(w) if pelo(px[x, y])) for y in range(h)]
    maior = max(cont)
    topo = next(y for y in range(h) if cont[y] >= maior * 0.6)
    xs = [x for y in range(topo, min(h, topo + 8)) for x in range(w) if pelo(px[x, y])]
    meio = sum(xs) / len(xs)
    trocados = 0
    for y in range(topo):
        for x in range(int(meio)):
            c = px[x, y]
            if miolo_cinza(c):
                lum = sum(c[:3]) / 3
                px[x, y] = (*(ROSA if lum >= 135 else ROSA_ESCURO), c[3])
                trocados += 1
    im.save(os.path.join(pasta, nome))
    print(nome, trocados)
