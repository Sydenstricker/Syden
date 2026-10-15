# A NOITE DO SALÃO, por código (o quarto mostrou que pintar a noite por edição mancha a parede): o dia vezes a luz da
# noite do QUARTO, que tem a mesma geometria (o salão é o quarto 27 px abaixo; ver README.md). As LUZINHAS ficam acesas:
# os pixels claros e quentes da fieira não escurecem, e jogam um brilho quente e suave em volta (de noite, são elas a
# luz do salão).
#   python e2e/pixel-art/salao/noite.py   → noite.png
import os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_dilation

AQUI = os.path.dirname(os.path.abspath(__file__))
Q = os.path.join(AQUI, '..', 'quarto', 'novo', 'quarto', 'janelas')
dia = np.array(Image.open(os.path.join(AQUI, 'base.png')).convert('RGB')).astype(float)
qd = np.array(Image.open(os.path.join(Q, 'sem-janela-dia.png')).convert('RGB')).astype(float)
qn = np.array(Image.open(os.path.join(Q, 'sem-janela-noite.png')).convert('RGB')).astype(float)
borrar = lambda a, r: np.stack([gaussian_filter(a[..., c], r) for c in range(3)], 2)
# só onde o quarto tem quarto (o cinza em volta daria razão 1, e a borda de baixo do salão ficava clara)
foraQ = np.abs(qd - qd[0, 0]).max(2) < 20
peso = gaussian_filter((~foraQ).astype(float), 12)[..., None]
razao = borrar(np.where(foraQ[..., None], 0, qn), 12) / np.maximum(1, borrar(np.where(foraQ[..., None], 0, qd), 12))
media = razao[~foraQ].mean(0)
razao = np.where(peso > 0.5, razao, media)
# o quarto, 27 px acima: a razão dele desce 27 px para cair no mesmo lugar do salão
desloc = np.ones_like(razao) * razao[226:236].mean((0, 1))
desloc[27:] = razao[:-27]
noite = dia * np.clip(desloc, 0, 1.2)
# as luzinhas: claras, quentes e saturadas, no alto das paredes
r, g, b = dia[..., 0], dia[..., 1], dia[..., 2]
ys = np.mgrid[0:512, 0:512][0]
luz = (r > 200) & (g > 150) & (b < 150) & (r - b > 90) & (ys < 200)
# só as LÂMPADAS: pedaços de 3 pixels ou mais com o miolo bem claro (relato de 15/10/2026, "de noite tem vários pontos
# brancos": os fiapos claros do rejunte do tijolo novo passavam no teste e ficavam acesos)
from scipy.ndimage import label as rotular
rot, _ = rotular(luz)
tam = np.bincount(rot.ravel()); tam[0] = 0
brilho_max = np.zeros(tam.size); np.maximum.at(brilho_max, rot.ravel(), (r + g).ravel())
luz = np.isin(rot, np.nonzero((tam >= 3) & (brilho_max >= 430))[0])
luz = binary_dilation(luz, iterations=1) & (r > 150)
noite[luz] = dia[luz]
brilho = gaussian_filter(luz.astype(float), 9)
brilho = brilho / max(1e-6, brilho.max())
noite = noite + brilho[..., None] * np.array([70, 42, 12])
fora = np.abs(dia - dia[0, 0]).max(2) < 20
noite[fora] = dia[fora]
Image.fromarray(np.clip(noite, 0, 255).astype(np.uint8)).save(os.path.join(AQUI, 'noite.png'))
print('noite.png', int(luz.sum()), 'pixels de luzinha')
