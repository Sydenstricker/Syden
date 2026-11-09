# A PORTA DE ENTRADA DO SALÃO no lugar: a fechada escolhida (fechada-3) e a aberta (a mesma com a folha repintada,
# aberta-1, só dentro da máscara) viram as peças da parede, nas coordenadas do quarto (27 px acima), como avulsos.py faz
# com as outras: peca-dia.png / peca-noite.png (fechada) e peca-aberta-dia.png / peca-aberta-noite.png, e o item.json.
#   py -3 e2e/pixel-art/quarto/novo/quarto/parede/entrada.py [fechada] [aberta]
import json, os, sys
import numpy as np
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(os.path.dirname(AQUI), 'parede-salao', 'entrada')
FECHADA, ABERTA = (sys.argv[1:] + ['3', '1'])[:2] if len(sys.argv) > 2 else ('3', '1')
chao = lambda x: 253 + (x - 256) * (114 / 216)
f = np.array(Image.open(os.path.join(D, f'fechada-{FECHADA}.png')).convert('RGBA'))
a = np.array(Image.open(os.path.join(D, f'aberta-{ABERTA}.png')).convert('RGBA'))
m = np.array(Image.open(os.path.join(D, 'mascara-folha.png')).convert('L')) > 127
ab = f.copy(); ab[m] = a[m]; ab[m, 3] = 255
# a ref-margem.png tem a porta do banheiro em (14, 19); no salão ela está em (352, 190) (com os 27 px): a de entrada vai
# no mesmo lugar, para nascer na mesma parede e na mesma altura.
X0, Y0 = 352 - 14, 190 - 19
def tela(img):
    t = np.zeros((512, 512, 4), np.uint8); t[Y0:Y0 + img.shape[0], X0:X0 + img.shape[1]] = img
    t[..., 3] = np.where(t[..., 3] > 127, 255, 0); t[..., :3] *= (t[..., 3:] > 0)
    return t
fe, ae = tela(f), tela(ab)
mk = fe[..., 3] > 0
cols = np.nonzero(mk.any(0))[0]; meio = int((cols.min() + cols.max()) / 2)
hs = chao(meio) - np.nonzero(mk[:, cols.min():cols.max() + 1].any(1))[0]
for nome, t in (('peca', fe), ('peca-aberta', ae)):
    tq = np.roll(t, -27, 0)
    for q in ('dia', 'noite'): Image.fromarray(tq, 'RGBA').save(os.path.join(D, f'{nome}-{q}.png'), optimize=True)
meta = {'nome': 'a porta de entrada', 'funcao': None, 'chao': True, 'aberta': True,
        'ocupa': [round((cols.min() - 256) / 27, 2), round((cols.max() + 1 - 256) / 27, 2)], 'alto': [round(float(hs.min()), 1), round(float(hs.max()), 1)], 'avulso': int(FECHADA)}
json.dump(meta, open(os.path.join(D, 'item.json'), 'w', encoding='utf8'), ensure_ascii=False)
print(meta)
