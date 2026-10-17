# AS PEÇAS DAS JANELAS: cada tipo, recortado do quarto onde foi pintado pela diferença com o quarto sem janela
# (sem-janela.py). Tudo fica nas coordenadas de onde foi pintado (a parede da direita); a página o leva para onde a
# janela estiver: ao longo da parede é só deslocar (a parede e o chão andam o mesmo vetor por casa em v), e na outra
# parede é espelhar (o quarto é simétrico).
#
#   janelas/<tipo>/peca-dia.png, peca-noite.png   a janela (o vidro entra pela máscara, a cor dele não importa)
#   janelas/<tipo>/vidro.png                      onde aparece a vista
#   janelas/<tipo>/luar.png + janela.json         os quadrados de luar no chão, o ganho deles, e quanto a janela ocupa
#   janelas/original/cortina-<dia|noite>.png, aberta-dia.png, aberta-vao.png, aberta-vidro.png   os estados dela
#
# A NOITE dos tipos novos é o dia vezes a luz da noite do lugar (a razão borrada entre os quartos sem janela), e o LUAR
# deles é projetado do vidro: a mesma direção de luz que a janela original pinta no chão, medida nela (um ponto do vidro
# a h px do chão cai a u = 0,034·h − 1,7 casas da parede, e 0,86 casa para o fundo).
#   python e2e/pixel-art/quarto/novo/quarto/janelas/pecas.py
import json
import os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_dilation, binary_fill_holes, label

AQUI = os.path.dirname(os.path.abspath(__file__))
Q = os.path.dirname(AQUI)
ler = lambda *p: np.array(Image.open(os.path.join(*p)).convert('RGB')).astype(float)
gravar = lambda a, *p: Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(*p))
chao = lambda x: 226 + (x - 256) * (114 / 216)
ys, xs = np.mgrid[0:512, 0:512]
ACIMA = ys <= chao(xs) + 2  # parede (a parede da direita: x >= 256)
PONTA = ((xs >= 279) & (xs <= 320) | (xs >= 414) & (xs <= 471)) & (ys > chao(xs) + 2) & (ys < chao(xs) + 17)
DIREITA = (xs >= 257) & (xs < 472)

semDia = ler(AQUI, 'sem-janela-dia.png'); semNoite = ler(AQUI, 'sem-janela-noite.png')
borrar = lambda a: np.stack([gaussian_filter(a[..., c], 10) for c in range(3)], 2)
razaoNoite = borrar(semNoite) / np.maximum(1, borrar(semDia))
luarOriginal = json.load(open(os.path.join(AQUI, 'original', 'luar.json')))['ganho']

def recortar(img, sem, chao_tambem=False):
    """A peça: o que difere do quarto sem janela, na parede da direita (e nas pontas da cortina no chão)."""
    m = (np.abs(img - sem).max(2) > 10) & DIREITA & (ACIMA | (PONTA if chao_tambem else False))
    m = binary_dilation(m, iterations=1) & DIREITA & (ACIMA | (PONTA if chao_tambem else False))  # o contorno inteiro
    return np.dstack([img, m * 255.0]), m

def recortar_limpo(img, sem):
    """Os tipos novos, como os objetos da parede (parede/pecas.py): o que mudou MUITO, só os pedaços grandes, sem buracos,
    e a borda só onde mudou de verdade (dif > 16). Com o contorno de 1 px do recortar(), vinha junto uma faixa da parede
    creme do quarto, que no salão virava um halo claro em volta da janela (relato de 15/10/2026)."""
    dif = np.abs(img - sem).max(2)
    forte = (dif > 28) & DIREITA & ACIMA
    rot, n = label(forte)
    tam = np.bincount(rot.ravel()); tam[0] = 0
    forte = np.isin(rot, np.nonzero(tam >= tam.max() * 0.15)[0])
    m = binary_fill_holes(binary_dilation(forte, iterations=2) & (dif > 16) & DIREITA & ACIMA | forte) & DIREITA & ACIMA
    return np.dstack([img, m * 255.0]), m

def gravar_rgba(a, *p):
    # (a cor fora da peça vai a zero: ela não aparece, e sem isso cada arquivo pesava 140 KB)
    a = a * (a[..., 3:4] > 127)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(*p), optimize=True)

def mascara(m, *p):
    Image.fromarray((m * 255).astype(np.uint8)).save(os.path.join(*p), optimize=True)

def projetar(vidro):
    """O luar de um vidro: cada pixel do chão olha para trás, ao longo da luz, e acende se cai no vidro."""
    B = np.array([256, 226.]); L = np.array([40, 340.]); R = np.array([472, 340.])
    inv = np.linalg.inv(np.array([L - B, R - B]).T / 8.0)
    u, v = np.einsum('ij,jkl->ikl', inv, np.stack([xs + .5 - B[0], ys + .5 - B[1]]))
    h = (u + 1.7) / 0.034; vv = v + 0.86
    x = np.round(256 + 27 * vv - .5).astype(int); y = np.round(chao(256 + 27 * vv) - h - .5).astype(int)
    ok = (u > 0) & (u < 8) & (v > 0) & (v < 8) & (x >= 0) & (x < 512) & (y >= 0) & (y < 512)
    luz = np.zeros((512, 512), bool)
    luz[ok] = vidro[y[ok], x[ok]]
    return luz

def extensao(m):
    """Quanto a janela ocupa ao longo da parede, em casas de v."""
    cols = np.nonzero(m.any(0))[0]
    return [round((cols.min() - 256) / 27, 2), round((cols.max() + 1 - 256) / 27, 2)]

# ---- A janela original (a da pintura), com os estados dela.
base = ler(Q, '..', 'bases', 'pl-512-janela-1.png'); noite = ler(Q, 'noite.png')
o = os.path.join(AQUI, 'original')
pd, mdia = recortar(base, semDia, True); gravar_rgba(pd, o, 'peca-dia.png')
pn, _ = recortar(noite, semNoite, True); gravar_rgba(pn, o, 'peca-noite.png')
for quando, sem in [('dia', semDia), ('noite', semNoite)]:
    p, _ = recortar(ler(Q, f'cortina-{quando}.png'), sem, True); gravar_rgba(p, o, f'cortina-{quando}.png')
ab = ler(Q, 'janela-aberta-dia.png')
p, _ = recortar(ab, semDia, True); gravar_rgba(p, o, 'aberta-dia.png')
mascara((ab[..., 0] > 200) & (ab[..., 1] < 70) & (ab[..., 2] > 200), o, 'aberta-vao.png')
# O VIDRO DAS FOLHAS ABERTAS: a cor exata dele, só a partir de x 338. A parede de dentro do vão (x 321-332) tem a mesma
# cor em pontinhos, e eles entravam como vidro: de noite, uma mancha clara salpicada no vão (relato dele, 16/10/2026).
vidroAb = (ab[..., 0] == 250) & (ab[..., 1] == 243) & (ab[..., 2] == 224) & DIREITA & ACIMA & (ys < 260) & (xs > 338) & (xs < 440)
rot, n = label(vidroAb)
tam = np.bincount(rot.ravel())
vidroAb = vidroAb & (tam[rot] >= 3)
# OS REFLEXOS DO VIDRO (relato dele, 17/10/2026: "a janela parece que tem tinta"): o vidro foi pintado com a cor exata acima
# e com tons claros de reflexo, e os pontinhos da cor exata que são pequenos demais caíam fora. Tudo isso ficava pintado
# por cima da vista. A máscara cresce dos vidros para os vizinhos claros e pouco saturados (a madeira é alaranjada),
# dentro da mesma faixa das folhas.
lum = ab.mean(2)
sat = ab.max(2) - ab.min(2)
claro = (lum >= 175) & (sat <= 80) & DIREITA & ACIMA & (ys < 262) & (xs > 338) & (xs < 440)
for _ in range(6):
    vidroAb = vidroAb | (binary_dilation(vidroAb) & claro)
mascara(vidroAb, o, 'aberta-vidro.png')
# O LUAR DA JANELA ABERTA (relato dele, 17/10/2026: "a sombra da janela aberta é a mesma da janela fechada"): a luz entra
# pelo vão inteiro, sem a grade do meio, e pelo vidro das folhas. Projetado no chão como o luar dos tipos novos.
vaoAb = (ab[..., 0] > 200) & (ab[..., 1] < 70) & (ab[..., 2] > 200)
mascara(projetar(vaoAb | vidroAb), o, 'luar-aberta.png')
vidroO = np.array(Image.open(os.path.join(Q, '..', 'janela', 'vidro.png')))[..., 3] > 127
mascara(vidroO, o, 'vidro.png')
json.dump({'nome': 'Grande, com cortinas', 'ocupa': extensao(mdia), 'ganho': luarOriginal, 'cortina': True, 'abre': True}, open(os.path.join(o, 'janela.json'), 'w'), ensure_ascii=False)
mascara(projetar(vidroO), AQUI, 'original-luar-projetado.png')  # para conferir a projeção contra o luar pintado

# ---- Os tipos novos (tipos.mjs).
NOMES = {'arco': 'Em arco', 'redonda': 'Redonda', 'floreira': 'Com floreira', 'cortinas': 'Com cortinas'}
for tipo, nome in NOMES.items():
    d = os.path.join(AQUI, tipo)
    if not os.path.exists(os.path.join(d, 'dia.png')): continue
    dia = ler(d, 'dia.png')
    vidro = (dia[..., 0] > 200) & (dia[..., 1] < 80) & (dia[..., 2] > 200)
    # a beira do magenta (pixels meio magenta, do serrilhado) também é vidro: senão ficavam pontinhos rosa na borda
    rosado = (dia[..., 0] - dia[..., 1] > 60) & (dia[..., 2] - dia[..., 1] > 60)
    vidro = vidro | (binary_dilation(vidro, iterations=2) & rosado)
    p, m = recortar_limpo(dia, semDia); gravar_rgba(p, d, 'peca-dia.png')
    # de noite: o desenho vezes a luz da noite do lugar
    pn = p.copy(); pn[..., :3] = dia * razaoNoite; gravar_rgba(pn, d, 'peca-noite.png')
    mascara(vidro, d, 'vidro.png')
    mascara(projetar(vidro), d, 'luar.png')
    json.dump({'nome': nome, 'ocupa': extensao(m), 'ganho': luarOriginal, 'cortina': False, 'abre': False}, open(os.path.join(d, 'janela.json'), 'w'), ensure_ascii=False)
    print(tipo, extensao(m), vidro.sum())
print('original', extensao(mdia))
