# O CRIADO-MUDO SAI DA PINTURA DA LUZ (noite-abajur-plantas.mjs) sem borrar o rodapé: preencher a forma dele com a média
# dos vizinhos (como o quarto de sempre faz) apagava o rodapé e a quina em volta. Aqui o que fica embaixo dele é a casca da
# noite da planta (que tem o rodapé) vezes a LUZ pintada em volta (a razão pintada / casca, espalhada para dentro da forma).
#   py e2e/pixel-art/quarto/novo/quarto/janelas/noite-abajur-plantas.py [l] [cubiculo]
#   lê noite-abajur-plantas/<planta>-pintada.png e <planta>-partida.png → sem-janela-noite-abajur-<planta>.png
import json, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_dilation

AQUI = os.path.dirname(os.path.abspath(__file__)); P = os.path.join(AQUI, 'noite-abajur-plantas')
ler = lambda f: np.array(Image.open(f).convert('RGB')).astype(float)
for pl in sys.argv[1:] or ['l', 'cubiculo']:
    casca = ler(os.path.join(AQUI, f'sem-janela-noite-{pl}.png'))
    pintada = ler(os.path.join(P, f'{pl}-pintada.png')); partida = ler(os.path.join(P, f'{pl}-partida.png'))
    x0, y0, x1, y1 = json.load(open(os.path.join(AQUI, 'noite-abajur-plantas.json')))[pl]['caixa']
    na_caixa = np.zeros(casca.shape[:2], bool); na_caixa[y0:y1, x0:x1] = True
    forma = binary_dilation(np.abs(partida - casca).max(2) > 3, iterations=4) & na_caixa  # o criado-mudo posto (e 4 px em volta)
    r = np.clip(pintada / np.maximum(8, casca), 0, 3); peso = (~forma).astype(float)  # (pixel muito escuro: a razão explodia num ponto claro)
    rs = np.stack([gaussian_filter(r[..., c] * peso, 3) for c in range(3)], 2) / np.maximum(1e-6, gaussian_filter(peso, 3))[..., None]
    for s in (6, 12):  # o que o borrão de 3 não alcança
        falta = gaussian_filter(peso, 3) < 1e-3
        if not falta.any(): break
        r2 = np.stack([gaussian_filter(r[..., c] * peso, s) for c in range(3)], 2) / np.maximum(1e-6, gaussian_filter(peso, s))[..., None]
        rs[falta] = r2[falta]
    saida = pintada.copy(); saida[forma] = casca[forma] * rs[forma]
    # o fundo (fora do quarto) é o da casca: a pintura partiu da casca de antes, com a franja clara em cima (plantas.py)
    fundo = np.abs(casca - casca[0, 0]).max(2) <= 6; saida[fundo] = casca[fundo]
    Image.fromarray(np.clip(saida, 0, 255).astype(np.uint8)).save(os.path.join(AQUI, f'sem-janela-noite-abajur-{pl}.png'))
    print(pl, 'forma', int(forma.sum()))
