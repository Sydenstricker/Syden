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
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vidro_limpo import sem_pintas

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
# A MADEIRA TINGIDA DE ROSA NÃO É VIDRO (relato dele, 09/11/2026: "a janela parece ter dois pixels de artefato"). A coluna de
# sombra do montante do meio (x 362) veio meio a meio: o marrom dela (7e4b36, 82403c) e o mesmo marrom misturado ao magenta
# (923753, ad257f), que o "rosado" mandava para o vidro. A beira do montante virava um pontilhado de pixels escuros soltos
# na vista, que de noite saltam como pintas pretas. São só esses dois tons, de madeira (vermelho médio, verde de madeira,
# menos azul que vermelho; o magenta e o roxo escuro do serrilhado não entram): voltam a ser madeira, com a cor do vizinho
# de madeira da mesma coluna (ou da linha).
R_, G_, B_ = a[..., 0], a[..., 1], a[..., 2]
tingida = rosado & op & (R_ >= 100) & (R_ <= 200) & (G_ >= 25) & (G_ <= 80) & (B_ < R_)
limpa = op & ~rosado
for y, x in zip(*np.nonzero(tingida)):
    viz = [(y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1), (y - 2, x), (y + 2, x)]
    viz = [(yy, xx) for yy, xx in viz if 0 <= yy < a.shape[0] and 0 <= xx < a.shape[1] and limpa[yy, xx]]
    a[y, x, :3] = a[viz[0]][:3] if viz else [126, 75, 54]
rosado &= ~tingida
print('madeira tingida de rosa devolvida', int(tingida.sum()))
op &= ~rosado
rot, _ = label(op); tam = np.bincount(rot.ravel()); tam[0] = 0; op = rot == tam.argmax()
vidro = binary_fill_holes(op) & ~op
rv, _ = label(vidro); tv = np.bincount(rv.ravel()); tv[0] = 0; vidro = np.isin(rv, np.nonzero(tv >= 12)[0])
# (e o que ainda sobrar de madeira solta no vidro, o furo e o dente: vidro_limpo.py)
vidro = sem_pintas(vidro); op &= ~vidro

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
        # A CORTINA FECHADA SÃO AS DUAS CORTINAS DOS LADOS CORRIDAS ATÉ O MEIO (relato dele, 09/11/2026: "a cortina nunca se
        # mexe e aparece essa do nada na janela"). A repintura (estado-cortina.png) pôs uma terceira cortina DENTRO da moldura,
        # até o peitoril, com as dos lados paradas no lugar. Agora é por código, a partir da própria peça: cada cortina se
        # estende até o meio, repetindo as pregas dela (as colunas de dentro, sem o contorno), com a borda de fora no lugar e a
        # borda de dentro de cada uma encontrando a da outra no meio; cada coluna copiada desce pela inclinação da varão, e vai
        # da argola até o chão, como as dos lados.
        INC = 95 / 192  # (o alto das cortinas: x 271 → y 47, x 463 → y 142; o pé delas acompanha)
        E0, E1, EB = 272, 306, 311   # a da esquerda: pregas 272–306, a borda de dentro 307–311
        D0, D1, DB = 436, 466, 431   # a da direita: a borda de dentro 431–435, pregas 436–466
        MEIO = (EB + DB) // 2
        orig = peca.copy(); fech = peca.copy(); a_f = OP.copy(); pano = np.zeros((512, 512), bool)
        # só o tecido (o creme pouco saturado) e o contorno em volta dele: a borda de dentro das cortinas está na frente da
        # moldura, e copiar a coluna inteira levava a madeira junto
        from scipy.ndimage import binary_dilation
        rgb_o = orig[..., :3]; tecido = (orig[..., 3] > 127) & (rgb_o.mean(2) > 140) & ((rgb_o.max(2) - rgb_o.min(2)) < 100)
        tecido = binary_dilation(tecido, iterations=1) & (orig[..., 3] > 127) & ((rgb_o.mean(2) > 140) | (rgb_o.mean(2) < 70))
        def copiar(x, xs_):
            dy = int(round(INC * (x - xs_)))
            col = orig[:, xs_]; ok = tecido[:, xs_]
            ys_ok = np.nonzero(ok)[0]; yd = ys_ok + dy; m = (yd >= 0) & (yd < 512)
            fech[yd[m], x] = col[ys_ok[m]]; a_f[yd[m], x] = True; pano[yd[m], x] = True
        for x in range(E0, MEIO + 1):
            if x > MEIO - (EB - E1): xs_ = EB - (MEIO - x)
            else: xs_ = E0 + (x - E0) % (E1 - E0 + 1)
            copiar(x, xs_)
        for x in range(MEIO + 1, D1 + 1):
            if x <= MEIO + (D0 - DB): xs_ = DB + (x - MEIO - 1)
            else: xs_ = D1 - (D1 - x) % (D1 - D0 + 1)
            copiar(x, xs_)
        # (a borda de dentro de cada cortina tem falhas, e no encontro das duas a moldura aparecia numa fresta: o que fica
        # entre o alto e o pé do pano, numa coluna dele, e não é pano, é o pano vizinho do mesmo lado)
        for _ in range(4):
            for x in range(E0, D1 + 1):
                c = np.nonzero(pano[:, x])[0]
                if len(c) == 0: continue
                viz = x - 1 if x <= MEIO else x + 1
                for y in range(c.min(), c.max() + 1):
                    if not pano[y, x] and pano[y, viz]:
                        fech[y, x] = fech[y, viz]; a_f[y, x] = True; pano[y, x] = True
            for x in (MEIO, MEIO + 1):  # e a fresta de uma coluna inteira no meio
                for y in range(512):
                    if not pano[y, x] and pano[y, x - 1] and pano[y, x + 1]: fech[y, x] = fech[y, x - 1]; a_f[y, x] = True; pano[y, x] = True
        # (no encontro, o contorno das duas bordas, e o do "dente" da borda da esquerda, somavam uma faixa escura: fica um
        # pixel de contorno, e o resto da faixa é o tecido logo à esquerda dela)
        escuro = lambda y, x: fech[y, x, :3].mean() < 70
        for y in range(512):
            x = MEIO - 8
            while x <= MEIO + 4:
                if pano[y, x] and escuro(y, x):
                    f = x
                    while f + 1 <= MEIO + 6 and pano[y, f + 1] and escuro(y, f + 1): f += 1
                    if f > x and pano[y, x - 1] and not escuro(y, x - 1):
                        for q in range(x, f): fech[y, q] = fech[y, x - 1]
                    x = f + 1
                else: x += 1
        # (e o contorno que sobra no encontro também sai: "essa linha preta no meio da cortina tem que melhorar", relato dele.
        # O encontro de duas cortinas é uma DOBRA, não uma borda: o pixel escuro vira o tecido à esquerda dele escurecido,
        # como as sombras das pregas. O contorno de fora, no pé e no alto, fica.)
        for y in range(512):
            for x in range(MEIO - 8, MEIO + 7):
                if not (pano[y, x] and escuro(y, x)): continue
                esq = next((x - k for k in range(1, 5) if pano[y, x - k] and not escuro(y, x - k)), None)
                dir_ = next((x + k for k in range(1, 5) if pano[y, x + k] and not escuro(y, x + k)), None)
                if esq is None or dir_ is None: continue
                fech[y, x, :3] = fech[y, esq, :3] * 0.78
        p = fech.copy(); p[..., 3] = a_f * 255
        print('cortina: fechada por código, até o chão')
        gravar_rgba(p, 'cortina-dia'); gravar_rgba(noite(p), 'cortina-noite')
    else:
        rosa = (e[..., 0] - e[..., 1] > 60) & (e[..., 2] - e[..., 1] > 60)
        vao = dentro & rosa
        # O PEITORIL E A TRAVESSA DE BAIXO SÃO OS DA JANELA FECHADA (relato dele, 09/11/2026: "a janela aberta parece que tem
        # pedaços cortados"): a repintura redesenhou a faixa abaixo do vidro (a máscara ia 3 px abaixo dele) com outras
        # linhas, que se quebravam em degraus ao encontrar o peitoril da avulsa. Abaixo do vão, em cada coluna que tem vão, vale
        # a avulsa; a repintura fica só no vão e nas folhas. (O peitoril não muda de altura: o gato senta nele.)
        ys_v, xs_v = np.nonzero(vao)
        fundo = np.full(512, -1); np.maximum.at(fundo, xs_v, ys_v)
        abaixo = (fundo[None, :] >= 0) & (ys > fundo[None, :])
        # até o pé do vidro da fechada (nos montantes, interpolado entre as colunas vizinhas) a abertura continua: é vão,
        # e os pés dos montantes não ficam espetados nela; dali para baixo, a travessa e o peitoril da fechada
        yv, xv = np.nonzero(VID); pe = np.full(512, np.nan); np.fmax.at(pe, xv, yv.astype(float))
        tem = ~np.isnan(pe); pe = np.interp(np.arange(512), np.nonzero(tem)[0], pe[tem])
        no_vao = abaixo & (ys <= pe[None, :])
        vao = vao | no_vao; e[no_vao] = [255, 0, 255]
        # (e os pontinhos escuros soltos dentro do vão, que viravam pintas na vista)
        furos = binary_fill_holes(vao) & ~vao; vao = vao | furos; e[furos] = [255, 0, 255]
        abaixo = abaixo & ~no_vao & OP
        e[abaixo] = peca[abaixo][:, :3]
        # OS PÉS DOS MONTANTES: na travessa da fechada, cada montante desce uns pixels com contorno, e sem ele em cima vira um
        # toco espetado e uma falha nas linhas da travessa. Nas colunas dos montantes (sem vidro na fechada), a faixa logo
        # abaixo do vidro é a da coluna com vidro mais perto à esquerda, levada pela inclinação da parede (114/216).
        com_vidro = VID.any(0); cols_vao = np.nonzero(fundo >= 0)[0]
        for x in range(cols_vao.min(), cols_vao.max() + 1):
            if com_vidro[x]: continue
            k = 1
            while x - k >= 0 and not com_vidro[x - k]: k += 1
            if x - k < 0: continue
            for y in range(int(pe[x]) - 2, int(pe[x]) + 7):
                ys_ = int(round(y - 0.528 * k))
                if 0 <= y < 512 and abaixo[y, x] and OP[ys_, x - k]: e[y, x] = peca[ys_, x - k, :3]
        print('aberta: pixels do peitoril devolvidos', int(abaixo.sum()))
        p[..., :3] = e
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
