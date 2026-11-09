# A JANELA ORIGINAL AVULSA vira as peças que a página usa (09/11/2026), no lugar das recortadas da pintura (pecas.py):
#   original/avulso-<n>.png (original-avulsa.mjs) e original/estado-cortina.png, estado-aberta.png (original-estados.mjs)
#   → original/peca-dia, peca-noite, vidro, luar, cortina-dia, cortina-noite, aberta-dia, aberta-vao, aberta-vidro,
#     luar-aberta, janela.json
# Tudo nas coordenadas de onde a original foi pintada (ref.json). A noite é o dia vezes a luz da noite do lugar (como os
# outros tipos), e o luar é PROJETADO do vidro (pecas.py): a peça não traz mais a parede, a viga nem o luar pintados.
#   py e2e/pixel-art/quarto/novo/quarto/janelas/original-pecas.py <n>
import json, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import binary_fill_holes, gaussian_filter, label

AQUI = os.path.dirname(os.path.abspath(__file__)); d = os.path.join(AQUI, 'original')
n = sys.argv[1] if len(sys.argv) > 1 else '1'
ref = json.load(open(os.path.join(d, 'ref.json')))
chao = lambda x: 226 + (x - 256) * (114 / 216)
ys, xs = np.mgrid[0:512, 0:512]
ler = lambda f: np.array(Image.open(os.path.join(AQUI, f)).convert('RGB')).astype(float)
borrar = lambda a: np.stack([gaussian_filter(a[..., c], 10) for c in range(3)], 2)
razao = borrar(ler('sem-janela-noite.png')) / np.maximum(1, borrar(ler('sem-janela-dia.png')))

a = np.array(Image.open(os.path.join(d, f'avulso-{n}.png')).convert('RGBA')).astype(int)
op = a[..., 3] > 127
rosado = ((a[..., 0] - a[..., 1] > 30) & (a[..., 2] - a[..., 1] > 30)) | ((a[..., 0] - a[..., 1] > 60) & (a[..., 2] - a[..., 1] > 20))  # (com 60, uma linha roxa escura sobrava no vidro)
op &= ~rosado
rot, _ = label(op); tam = np.bincount(rot.ravel()); tam[0] = 0; op = rot == tam.argmax()
vidro = binary_fill_holes(op) & ~op
rv, _ = label(vidro); tv = np.bincount(rv.ravel()); tv[0] = 0; vidro = np.isin(rv, np.nonzero(tv >= 12)[0])

def na_tela(m):
    t = np.zeros((512, 512), bool); h, w = m.shape; t[ref['y0']:ref['y0'] + h, ref['x0']:ref['x0'] + w] = m[:512 - ref['y0'], :512 - ref['x0']]; return t
OP, VID = na_tela(op) & (xs < 472), na_tela(vidro) & (xs < 472)  # (a parede acaba em x 471: a ponta da cortina passava)
peca = np.zeros((512, 512, 4)); h, w = op.shape
peca[ref['y0']:ref['y0'] + h, ref['x0']:ref['x0'] + w, :3] = a[:512 - ref['y0'], :512 - ref['x0'], :3]
peca[..., 3] = OP * 255

def gravar_rgba(p, nome):
    p = p * (p[..., 3:4] > 127)
    Image.fromarray(np.clip(p, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(d, nome + '.png'), optimize=True)
def noite(p):
    q = p.copy(); q[..., :3] = p[..., :3] * razao; return q
def mascara(m, nome):
    Image.fromarray((m * 255).astype(np.uint8)).save(os.path.join(d, nome + '.png'), optimize=True)
def projetar(v):
    B = np.array([256, 226.]); L = np.array([40, 340.]); R = np.array([472, 340.])
    inv = np.linalg.inv(np.array([L - B, R - B]).T / 8.0)
    u, vv0 = np.einsum('ij,jkl->ikl', inv, np.stack([xs + .5 - B[0], ys + .5 - B[1]]))
    hh = (u + 1.7) / 0.034; vv = vv0 + 0.86
    x = np.round(256 + 27 * vv - .5).astype(int); y = np.round(chao(256 + 27 * vv) - hh - .5).astype(int)
    ok = (u > 0) & (u < 8) & (vv0 > 0) & (vv0 < 8) & (x >= 0) & (x < 512) & (y >= 0) & (y < 512)
    luz = np.zeros((512, 512), bool); luz[ok] = v[y[ok], x[ok]]; return luz

# O DENTE NA CORTINA DA ESQUERDA (relato dele, 09/11/2026: "a cortina tem um artefato negro"): a avulsa desenhou a borda
# direita da cortina 2 px para dentro, com o contorno dobrado (##), num trecho de ~50 linhas; o resto da borda é cortina até a
# coluna 308 e o contorno em 309. Na tela, uma linha preta solta ao lado da cortina. Nessas linhas a cortina vai até 308 (a cor
# das duas colunas de antes) e o contorno volta a 309, como acima e abaixo.
def alisar(rgb, nome):
    escuro = lambda y, x: rgb[y, x, :3].mean() < 60
    creme = lambda y, x: rgb[y, x, :3].mean() > 150
    n = 0
    for y in range(512):
        if OP[y, 306] and creme(y, 306) and escuro(y, 307) and escuro(y, 308) and not escuro(y, 309):
            rgb[y, 309, :3] = rgb[y, 308, :3]; rgb[y, 307, :3] = rgb[y, 305, :3]; rgb[y, 308, :3] = rgb[y, 306, :3]; n += 1
    print(nome, 'linhas alisadas', n)
alisar(peca, 'peça')
gravar_rgba(peca, 'peca-dia'); gravar_rgba(noite(peca), 'peca-noite')
mascara(VID, 'vidro'); mascara(projetar(VID), 'luar')
# OS ESTADOS: a repintura vale onde a janela está (a peça e o vidro); fora, a avulsa
dentro = OP | VID
for estado in ('cortina', 'aberta'):
    e = np.array(Image.open(os.path.join(d, f'estado-{estado}.png')).convert('RGB')).astype(float)
    alisar(e, estado)
    p = np.zeros((512, 512, 4)); p[..., :3] = e; p[..., 3] = dentro * 255
    if estado == 'cortina':
        # (sobrou vidro magenta? vira a cor da cortina em volta: com a cortina fechada, nada de vista)
        mag = dentro & (e[..., 0] > 200) & (e[..., 1] < 80) & (e[..., 2] > 200)
        if mag.any(): p[mag, :3] = np.median(e[dentro & ~mag & (e.mean(2) > 170)], 0)
        print('cortina: magenta que sobrou', int(mag.sum()))
        gravar_rgba(p, 'cortina-dia'); gravar_rgba(noite(p), 'cortina-noite')
    else:
        rosa = (e[..., 0] - e[..., 1] > 60) & (e[..., 2] - e[..., 1] > 60)
        vao = dentro & rosa
        # o vidro das folhas abertas: o claro e pouco saturado dentro da janela, longe das cortinas (as colunas onde a avulsa é creme)
        lum = e.mean(2); sat = e.max(2) - e.min(2)
        creme_av = OP & (peca[..., :3].mean(2) > 170) & ((peca[..., :3].max(2) - peca[..., :3].min(2)) < 90)
        vidroAb = dentro & ~vao & ~creme_av & (lum > 175) & (sat < 70)
        rl, _ = label(vidroAb); tl = np.bincount(rl.ravel()); tl[0] = 0; vidroAb = np.isin(rl, np.nonzero(tl >= 3)[0])
        gravar_rgba(p, 'aberta-dia'); mascara(vao, 'aberta-vao'); mascara(vidroAb, 'aberta-vidro'); mascara(projetar(vao | vidroAb), 'luar-aberta')
        print('aberta: vão', int(vao.sum()), 'vidro das folhas', int(vidroAb.sum()))
cols = np.nonzero(OP.any(0))[0]
meta = json.load(open(os.path.join(d, 'janela.json'), encoding='utf8'))
meta.update({'ocupa': [float(round((cols.min() - 256) / 27, 2)), float(round((cols.max() + 1 - 256) / 27, 2))], 'avulso': int(n)})
json.dump(meta, open(os.path.join(d, 'janela.json'), 'w'), ensure_ascii=False)
print('original', meta['ocupa'], 'vidro', int(VID.sum()))
