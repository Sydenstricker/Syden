# AS PEÇAS DOS OBJETOS DA PAREDE (itens.mjs): como as janelas (janelas/pecas.py), o que difere do quarto sem janela,
# nas coordenadas de onde foi pintado; de noite, o desenho vezes a luz da noite do lugar.
#   python e2e/pixel-art/quarto/novo/quarto/parede/pecas.py   → parede/<item>/peca-dia.png, peca-noite.png, item.json
import json
import os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_dilation, binary_fill_holes, label

AQUI = os.path.dirname(os.path.abspath(__file__))
J = os.path.join(os.path.dirname(AQUI), 'janelas')
ler = lambda *p: np.array(Image.open(os.path.join(*p)).convert('RGB')).astype(float)
chao = lambda x: 226 + (x - 256) * (114 / 216)
ys, xs = np.mgrid[0:512, 0:512]
PAREDE = (xs >= 257) & (xs < 472) & (ys <= chao(xs) - 4)
semDia = ler(J, 'sem-janela-dia.png'); semNoite = ler(J, 'sem-janela-noite.png')
borrar = lambda a: np.stack([gaussian_filter(a[..., c], 10) for c in range(3)], 2)
razao = borrar(semNoite) / np.maximum(1, borrar(semDia))
# O que cada um é (o nome para a página) e o que ele abre no app (a ação da home de hoje, Home.tsx).
ITENS = {
    'fone': {'nome': 'o fone', 'funcao': 'fone'},
    'quadro': {'nome': 'o quadro de fotos', 'funcao': 'quadro'},
    'cortica': {'nome': 'a cortiça', 'funcao': 'cortica'},
    'prateleira': {'nome': 'a prateleira', 'funcao': None},
    'pintura': {'nome': 'a pintura', 'funcao': None},
}
for item, meta in ITENS.items():
    d = os.path.join(AQUI, item)
    if not os.path.exists(os.path.join(d, 'dia.png')): continue
    dia = ler(d, 'dia.png')
    # O objeto é o que mudou MUITO, e mais a borda dele (contorno e sombra) onde mudou pouco: a repintura também mexe de
    # leve no tom da parede em volta, e isso viraria uma faixa da parede andando junto com o objeto.
    dif = np.abs(dia - semDia).max(2)
    forte = (dif > 28) & PAREDE
    # só os pedaços grandes (a repintura deixa pontinhos soltos longe do objeto), e sem buracos (o branco das fotos e o
    # vaso claro têm a cor da parede e ficariam vazados)
    rot, n = label(forte)
    tam = np.bincount(rot.ravel()); tam[0] = 0
    forte = np.isin(rot, np.nonzero(tam >= tam.max() * 0.15)[0])
    # A borda é só o que mudou de verdade (o contorno e a sombra, dif > 16): com dif > 6 entrava uma faixa da parede creme
    # do quarto, que na parede de tijolo do salão virava um halo claro em volta do quadro (15/10/2026).
    m = binary_fill_holes(binary_dilation(forte, iterations=2) & (dif > 16) & PAREDE | forte) & PAREDE
    for nome, cor in [('peca-dia', dia), ('peca-noite', dia * razao)]:
        # (a cor fora da peça vai a zero: ela não aparece, e sem isso cada arquivo pesava 140 KB)
        Image.fromarray(np.dstack([np.clip(cor, 0, 255) * m[..., None], m * 255.0]).astype(np.uint8), 'RGBA').save(os.path.join(d, nome + '.png'), optimize=True)
    cols = np.nonzero(m.any(0))[0]; linhas = np.nonzero(m.any(1))[0]
    # a altura: de quanto acima do chão até quanto (medida na coluna do meio)
    meio = int((cols.min() + cols.max()) / 2)
    hs = chao(meio) - np.nonzero(m[:, cols.min():cols.max() + 1].any(1))[0]
    json.dump({**meta, 'ocupa': [round((cols.min() - 256) / 27, 2), round((cols.max() + 1 - 256) / 27, 2)], 'alto': [round(float(hs.min()), 1), round(float(hs.max()), 1)]}, open(os.path.join(d, 'item.json'), 'w'), ensure_ascii=False)
    print(item, json.load(open(os.path.join(d, 'item.json'))))
