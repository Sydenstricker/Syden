# Põe no lugar a janela do salão gerada SEM PAREDE (avulsa.mjs): a peça, o vidro e o luar, nas coordenadas do quarto
# (a parede da direita), como os outros tipos (pecas.py). O PixelLab tirou o magenta junto com o fundo: o vidro são os
# BURACOS dentro da moldura, mais os fiapos de magenta que sobraram na beira dele.
#   python e2e/pixel-art/quarto/novo/quarto/janelas/avulsa.py [tipo] [opção]
import json, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import binary_fill_holes, label
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vidro_limpo import sem_pintas

AQUI = os.path.dirname(os.path.abspath(__file__))
tipo = sys.argv[1] if len(sys.argv) > 1 else 'tijolo'; n = sys.argv[2] if len(sys.argv) > 2 else '1'
d = os.path.join(AQUI, tipo); ref = json.load(open(os.path.join(d, 'ref.json')))
chao = lambda x: 226 + (x - 256) * (114 / 216)
ys, xs = np.mgrid[0:512, 0:512]

a = np.array(Image.open(os.path.join(d, f'avulso-{n}.png')).convert('RGBA')).astype(int)
op = a[..., 3] > 127
rosado = (a[..., 0] - a[..., 1] > 60) & (a[..., 2] - a[..., 1] > 60)
op &= ~rosado
# só o pedaço grande (fora ele, sujeira solta do fundo)
rot, k = label(op); tam = np.bincount(rot.ravel()); tam[0] = 0; op = rot == tam.argmax()
vidro = binary_fill_holes(op) & ~op
# um buraco pequeno na madeira não é vidro
rv, kv = label(vidro); tv = np.bincount(rv.ravel()); tv[0] = 0; vidro = np.isin(rv, np.nonzero(tv >= 12)[0])
vidro = sem_pintas(vidro)  # (a madeira solta dentro do vidro: vidro_limpo.py)

tela = np.zeros((512, 512, 4), np.uint8); vid = np.zeros((512, 512), bool)
y0, x0 = ref['y0'], ref['x0']; h, w = op.shape
QUARTO = tipo != 'tijolo'
antigo = None
if QUARTO:
    # OS TIPOS DO QUARTO (09/11/2026): a peça nova fica com o CENTRO no centro da antiga (o recorte, guardado em
    # recorte-peca-dia.png na primeira vez), e o nome e o resto do janela.json continuam os dela.
    rec = os.path.join(d, 'recorte-peca-dia.png')
    if not os.path.exists(rec): os.replace(os.path.join(d, 'peca-dia.png'), rec)
    antigo = np.array(Image.open(rec))[..., 3] > 127
    ay, ax = np.nonzero(antigo); ny, nx = np.nonzero(op)
    y0 += int(round((ay.min() + ay.max()) / 2 - (y0 + (ny.min() + ny.max()) / 2)))
    x0 += int(round((ax.min() + ax.max()) / 2 - (x0 + (nx.min() + nx.max()) / 2)))
tela[y0:y0 + h, x0:x0 + w][op] = np.dstack([a[..., :3], np.full(op.shape, 255)]).astype(np.uint8)[op]
vid[y0:y0 + h, x0:x0 + w] = vidro
if QUARTO:
    # de noite, o desenho vezes a luz da noite do lugar (como pecas.py)
    from scipy.ndimage import gaussian_filter
    ler = lambda f: np.array(Image.open(os.path.join(AQUI, f)).convert('RGB')).astype(float)
    borrar = lambda a: np.stack([gaussian_filter(a[..., c], 10) for c in range(3)], 2)
    razao = borrar(ler('sem-janela-noite.png')) / np.maximum(1, borrar(ler('sem-janela-dia.png')))
    noite = tela.copy(); noite[..., :3] = np.clip(tela[..., :3] * razao, 0, 255).astype(np.uint8) * (tela[..., 3:] > 0)
    Image.fromarray(tela, 'RGBA').save(os.path.join(d, 'peca-dia.png'), optimize=True)
    Image.fromarray(noite, 'RGBA').save(os.path.join(d, 'peca-noite.png'), optimize=True)
else:
  for nome in ('peca-dia', 'peca-noite'):  # no salão a noite sai do dia, por código
    Image.fromarray(tela, 'RGBA').save(os.path.join(d, nome + '.png'), optimize=True)
Image.fromarray((vid * 255).astype(np.uint8)).save(os.path.join(d, 'vidro.png'), optimize=True)

def projetar(vidro):
    """O luar de um vidro (o mesmo de pecas.py): cada pixel do chão olha para trás, ao longo da luz."""
    B = np.array([256, 226.]); L = np.array([40, 340.]); R = np.array([472, 340.])
    inv = np.linalg.inv(np.array([L - B, R - B]).T / 8.0)
    u, v = np.einsum('ij,jkl->ikl', inv, np.stack([xs + .5 - B[0], ys + .5 - B[1]]))
    hh = (u + 1.7) / 0.034; vv = v + 0.86
    x = np.round(256 + 27 * vv - .5).astype(int); y = np.round(chao(256 + 27 * vv) - hh - .5).astype(int)
    ok = (u > 0) & (u < 8) & (v > 0) & (v < 8) & (x >= 0) & (x < 512) & (y >= 0) & (y < 512)
    luz = np.zeros((512, 512), bool); luz[ok] = vidro[y[ok], x[ok]]
    return luz

Image.fromarray((projetar(vid) * 255).astype(np.uint8)).save(os.path.join(d, 'luar.png'), optimize=True)
m = tela[..., 3] > 0; cols = np.nonzero(m.any(0))[0]
ganho = json.load(open(os.path.join(AQUI, 'original', 'luar.json')))['ganho']
meta = json.load(open(os.path.join(d, 'janela.json'), encoding='utf8')) if QUARTO else {'nome': 'De tijolo', 'cortina': False, 'abre': False}
json.dump({**meta, 'ocupa': [round((cols.min() - 256) / 27, 2), round((cols.max() + 1 - 256) / 27, 2)], 'ganho': ganho, 'avulso': int(n)},
          open(os.path.join(d, 'janela.json'), 'w'), ensure_ascii=False)
print(tipo, 'vidro', int(vid.sum()), 'peça', int(m.sum()))
