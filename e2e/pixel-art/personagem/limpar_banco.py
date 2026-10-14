# Tira dos quadros de transição o banquinho/cadeira que a interpolação às vezes desenha. Cor + forma: manchas LIGADAS de
# tom madeira (marrom-alaranjado, ou marrom-avermelhado escuro), de 12 pixels ou mais, no terço de baixo do desenho.
# O coelho limpo tem esse tom só em pixels soltos (a sombra dos pés), que ficam.
import sys, glob, os
from PIL import Image
T = sys.argv[1]
def madeira(r, g, b): return (r - g >= 18 and g - b >= 6 and r <= 210) or (r - g >= 20 and r - b >= 12 and 50 <= r <= 145) or (r - g >= 18 and r - b >= 22 and 30 <= r <= 120)
for pasta in sorted(glob.glob(os.path.join(T, '*'))):
    if not os.path.isdir(pasta): continue
    if 'lendo' in os.path.basename(pasta): continue  # o LIVRO é marrom: ali a cor de madeira não é banco
    for f in sorted(glob.glob(os.path.join(pasta, '*-*.png'))):
        im = Image.open(f).convert('RGBA'); px = im.load(); W, H = im.size
        bb = im.getbbox()
        if not bb: continue
        corte = bb[1] + (bb[3] - bb[1]) * 2 / 3
        visto = set(); n = 0; pedacos = []
        for y0 in range(H):
            for x0 in range(W):
                if (x0, y0) in visto: continue
                r, g, b, a = px[x0, y0]
                if not (a > 0 and madeira(r, g, b)): continue
                comp, fila = [], [(x0, y0)]; visto.add((x0, y0))
                while fila:
                    x, y = fila.pop(); comp.append((x, y))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        X, Y = x + dx, y + dy
                        if 0 <= X < W and 0 <= Y < H and (X, Y) not in visto:
                            q = px[X, Y]
                            if q[3] > 0 and madeira(*q[:3]): visto.add((X, Y)); fila.append((X, Y))
                if max(y for _, y in comp) >= corte: pedacos.append(comp)
        # Achou um banco (mancha grande)? Então os pedaços menores do mesmo tom, embaixo, também são dele.
        def solto(comp):  # não encosta em nenhum pixel do corpo (nem madeira nem contorno escuro)
            cs = set(comp)
            for x, y in comp:
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        X, Y = x + dx, y + dy
                        if (X, Y) in cs or not (0 <= X < W and 0 <= Y < H): continue
                        q = px[X, Y]
                        if q[3] > 0 and not madeira(*q[:3]) and q[0] + q[1] + q[2] >= 60: return False
            return True
        grande = any(len(c) >= 12 for c in pedacos)
        for comp in pedacos:
            if grande or solto(comp):
                for x, y in comp: px[x, y] = (0, 0, 0, 0)
                n += len(comp)
        if n: im.save(f); print(os.path.basename(pasta), os.path.basename(f), n)

# O CONTORNO que sobra do banco: pixel escuro no terço de baixo que não encosta em nenhum pixel do corpo (não escuro).
# O contorno do coelho sempre encosta no corpo (o moletom, os pés); o do banco, sem a madeira, fica solto.
def escuro(p): return p[3] > 0 and p[0] + p[1] + p[2] < 60
for pasta in sorted(glob.glob(os.path.join(T, '*'))):
    if not os.path.isdir(pasta): continue
    if 'lendo' in os.path.basename(pasta): continue  # o LIVRO é marrom: ali a cor de madeira não é banco
    for f in sorted(glob.glob(os.path.join(pasta, '*-*.png'))):
        im = Image.open(f).convert('RGBA'); px = im.load(); W, H = im.size
        bb = im.getbbox()
        if not bb: continue
        corte = bb[1] + (bb[3] - bb[1]) * 2 / 3; n = 0
        for _ in range(3):
            tirar = []
            for y in range(int(corte), H):
                for x in range(W):
                    if not escuro(px[x, y]): continue
                    corpo = any(0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] > 0 and not escuro(px[x + dx, y + dy])
                                for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy)
                    if not corpo: tirar.append((x, y))
            for x, y in tirar: px[x, y] = (0, 0, 0, 0)
            n += len(tirar)
        if n: im.save(f); print('contorno', os.path.basename(pasta), os.path.basename(f), n)
