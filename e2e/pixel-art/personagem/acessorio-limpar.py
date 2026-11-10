# TIRA DA CAMADA O QUE NÃO É O ACESSÓRIO (10/11/2026, relato dele: pintou a bandana de verde no criador e apareceram pixels
# fora do objeto). A camada é a diferença entre o quadro repintado e o original, e a repintura mexe de leve no pelo e no
# moletom em volta: esses pixels entram na camada com a cor do pelo, e só aparecem quando o acessório troca de cor (ou
# quando o corpo é outro). Fica só:
#   - o que tem a COR do acessório (o matiz dominante da camada, ±35°, com saturação), e
#   - o contorno e as sombras escuras que ENCOSTAM nisso (até 2 px), que são o traço do próprio acessório.
# O resto sai, e por baixo aparece o quadro do corpo, que é o certo. Roda em todas as camadas de um acessório:
#   py -3 e2e/pixel-art/personagem/acessorio-limpar.py <acessório> [corpos...]
import os, sys, glob, colorsys
import numpy as np
from PIL import Image
from scipy import ndimage

AQUI = os.path.dirname(os.path.abspath(__file__))
acc = sys.argv[1]; corpos = sys.argv[2:] or ['mascote', 'orelha-caida', 'musculoso']

def matiz_sat_lum(a):
    rgb = a[..., :3].astype(float) / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    l = (mx + mn) / 2; d = mx - mn
    s = np.where(d == 0, 0, d / (1 - np.abs(2 * l - 1) + 1e-9))
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(l)
    m = d > 0
    hr = ((g - b) / (d + 1e-9)) % 6; hg = (b - r) / (d + 1e-9) + 2; hb = (r - g) / (d + 1e-9) + 4
    h = np.where(mx == r, hr, np.where(mx == g, hg, hb)) * 60
    return np.where(m, h, -1), s, l

for corpo in corpos:
    for f in sorted(glob.glob(os.path.join(AQUI, corpo, 'acessorios', acc, '*', '*-*.png'))):
        if os.sep + 'com' + os.sep in f or os.sep + 'mascara' + os.sep in f: continue
        a = np.array(Image.open(f).convert('RGBA'))
        op = a[..., 3] > 20
        if not op.any(): continue
        h, s, l = matiz_sat_lum(a)
        colorido = op & (s > 0.25) & (l > 0.12) & (h >= 0)
        if not colorido.any(): continue
        # o matiz dominante, pela média circular dos pixels coloridos
        ang = np.deg2rad(h[colorido]); dom = np.rad2deg(np.arctan2(np.sin(ang).mean(), np.cos(ang).mean())) % 360
        dist = np.abs((h - dom + 180) % 360 - 180)
        cor = colorido & (dist <= 35)
        # o maior pedaço de cor e os que tenham pelo menos 6 px (a aba, o nó); pontinhos isolados saem
        rot, n = ndimage.label(cor, structure=np.ones((3, 3)))
        tam = np.bincount(rot.ravel()); tam[0] = 0
        cor = np.isin(rot, [k for k in range(1, n + 1) if tam[k] >= 6 or tam[k] == tam.max()])
        escuro = op & (l < 0.28)
        perto = ndimage.binary_dilation(cor, structure=np.ones((3, 3)), iterations=2)
        fica = cor | (escuro & perto)
        sai = op & ~fica
        if sai.any():
            a[sai] = 0
            Image.fromarray(a).save(f)
            print(os.path.relpath(f, AQUI), int(sai.sum()), 'px fora do acessório')
