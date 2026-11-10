# OS BURACOS BRANCOS (10/11/2026, as poses novas da orelha caída e do musculoso): a remoção de fundo do PixelLab apagou o
# BRANCO de dentro do desenho — as páginas do livro aberto (lendo-deitado) e o tênis branco do musculoso sentado no sofá —, e
# ali ficou um buraco transparente, fechado pelo contorno (a cor do chão aparecia dentro do livro e do sapato).
#
# Este script pinta de volta cada região transparente FECHADA (cercada de desenho) com pelo menos MIN px, com o branco mais
# claro que houver na borda dela (ou um branco quente, se a borda não tiver claro). Os vãos de verdade (entre o braço e o
# corpo, entre a vassoura e o corpo) também são regiões fechadas: por isso ele NÃO roda sozinho em toda pasta, só nas que
# foram conferidas olhando, e o tamanho mínimo deixa de fora os vãos pequenos.
#   py -3 e2e/pixel-art/personagem/preencher-buracos.py <pasta> [direção ...] [--min N]
import os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage

args = sys.argv[1:]
MIN = 12
if '--min' in args: i = args.index('--min'); MIN = int(args[i + 1]); del args[i:i + 2]
pasta, dirs = args[0], set(args[1:])
BRANCO = np.array([246, 242, 246, 255], np.uint8)

feitos = []
for f in sorted(os.listdir(pasta)):
    m = re.fullmatch(r'((?:north|south|east|west)(?:-(?:east|west))?)(?:-\d+)?\.png', f)
    if not m or (dirs and m.group(1) not in dirs): continue
    a = np.array(Image.open(os.path.join(pasta, f)).convert('RGBA')); op = a[..., 3] > 20
    buracos = ndimage.binary_fill_holes(op) & ~op
    rot, n = ndimage.label(buracos)
    mudou = 0
    for k in range(1, n + 1):
        r = rot == k
        if r.sum() < MIN: continue
        borda = ndimage.binary_dilation(r, iterations=2) & op
        lum = a[..., :3].astype(float) @ [0.299, 0.587, 0.114]
        claros = borda & (lum > 200)
        cor = a[claros][np.argmax(lum[claros])] if claros.any() else BRANCO
        a[r] = cor; a[r, 3] = 255; mudou += int(r.sum())
    if mudou:
        feitos.append((f, mudou)); Image.fromarray(a).save(os.path.join(pasta, f))
for f, n in feitos: print(f'{pasta}/{f}: {n} px pintados')
print(len(feitos), 'arquivo(s)')
