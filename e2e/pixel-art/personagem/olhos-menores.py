# OS OLHOS DE ASSISTIR MENORES (relato dele, 09/11/2026: "o olho do coelho da esquerda está legal, o da direita fica
# muito grande e parece alien"): nas animações do sofá e do chão, o PixelLab desenhou alguns olhos como ovais escuros de
# 7 a 8 px de altura; o riso, que ele aprovou, tem 5 a 6. Cada olho alto perde linhas em cima e embaixo (alternando) até
# a altura do riso, e o lugar delas vira o pelo ao lado. O brilho e o desenho do meio do olho ficam.
#   py -3 e2e/pixel-art/personagem/olhos-menores.py <pasta> [--aplicar]
import os, sys
from PIL import Image

ALTURA = 6

def pelo(c):
    return c[3] > 200 and c[0] > 200 and c[1] > 190 and c[2] > 200

def olhos(im):
    w, h = im.size
    px = im.load()
    cont = [sum(1 for x in range(w) if pelo(px[x, y])) for y in range(h)]
    if max(cont) == 0:
        return []
    topo = next(y for y in range(h) if cont[y] >= max(cont) * 0.6)
    escuro = {(x, y) for y in range(topo, min(h, topo + 30)) for x in range(w) if px[x, y][3] > 200 and sum(px[x, y][:3]) < 150}
    vistos, achados = set(), []
    for p in escuro:
        if p in vistos:
            continue
        pilha, comp = [p], []
        while pilha:
            q = pilha.pop()
            if q in vistos or q not in escuro:
                continue
            vistos.add(q)
            comp.append(q)
            x, y = q
            pilha += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        xs = [c[0] for c in comp]
        ys = [c[1] for c in comp]
        larg, alt = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        # um olho: mancha compacta (não o contorno do rosto, que é fino e comprido), cercada de pelo dos dois lados
        meio_y = (min(ys) + max(ys)) // 2
        cercado = pelo(px[max(0, min(xs) - 1), meio_y]) or pelo(px[min(w - 1, max(xs) + 1), meio_y])
        if 15 <= len(comp) <= 45 and 3 <= larg <= 6 and ALTURA < alt <= 9 and cercado:
            achados.append((comp, min(xs), max(xs), min(ys), max(ys)))
    return achados

pasta, aplicar = sys.argv[1], '--aplicar' in sys.argv
total = 0
for nome in sorted(os.listdir(pasta)):
    # só de frente: de costas não há olho, e as manchas altas de lá são o contorno do capuz
    if not nome.endswith('.png') or not nome.startswith(('south-east', 'south-west')):
        continue
    arq = os.path.join(pasta, nome)
    im = Image.open(arq).convert('RGBA')
    px = im.load()
    achados = olhos(im)
    if not achados:
        continue
    total += len(achados)
    print(nome, [(x1 - x0 + 1, y1 - y0 + 1) for _, x0, x1, y0, y1 in achados])
    if not aplicar:
        continue
    for comp, x0, x1, y0, y1 in achados:
        tirar, de_cima = [], True
        a, b = y0, y1
        while b - a + 1 > ALTURA:
            if de_cima:
                tirar.append(a); a += 1
            else:
                tirar.append(b); b -= 1
            de_cima = not de_cima
        # o pelo de cada linha tirada: o pixel claro mais perto, na mesma linha, de fora do olho
        for y in tirar:
            fora = px[x0 - 1, y] if pelo(px[x0 - 1, y]) else px[x1 + 1, y]
            for x in range(x0, x1 + 1):
                c = px[x, y]
                if c[3] > 200 and sum(c[:3]) < 150 or (x, y) in comp:
                    px[x, y] = fora
                elif not pelo(c):
                    px[x, y] = fora  # o brilho ou o contorno que sobrava na linha tirada
        # as linhas que ficaram descem/sobem para o centro? não: o olho fica onde estava, só mais baixo.
    im.save(arq)
print('olhos altos:', total)
