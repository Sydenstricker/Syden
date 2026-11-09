# O PUFE E O TAPETE AVULSOS no lugar dos recortes (09/11/2026, o compromisso de 17/10: "toda peça nasce avulsa"). A opção
# escolhida de avulsos/<id>-<n>.png (avulso.mjs) vai para pecas/<peça>.png, nas coordenadas do quarto, com o CENTRO DO PÉ
# (o meio da linha mais baixa) no da peça de antes: a página mede o pé e a base pelo desenho (montar.mjs, pecaDeImagem e
# MOVEIS), e assim o lugar no chão não muda. As sombras (pecas/<peça>-sombra.png) ficam as de antes.
# O pufe é o MESMO desenho nas três versões (antes eram três repinturas, de luz diferente; a página já ajusta a intensidade
# da luz pelo lugar). Os recortes de antes ficam em pecas/recortes/, para comparar.
#   py e2e/pixel-art/quarto/novo/quarto/pecas-avulsas.py pufe=<n> tapete=<n>
import os, shutil, sys
import numpy as np
from PIL import Image
from scipy.ndimage import label

AQUI = os.path.dirname(os.path.abspath(__file__))
PECAS = {'pufe': ['pufe-meio', 'pufe-janela', 'pufe-frente'], 'tapete': ['tapete']}
for arg in sys.argv[1:]:
    id_, _, n = arg.partition('=')
    a = np.array(Image.open(os.path.join(AQUI, 'avulsos', f'{id_}-{n}.png')).convert('RGBA'))
    op = a[..., 3] > 127
    rot, _ = label(op); tam = np.bincount(rot.ravel()); tam[0] = 0; op = rot == tam.argmax()  # sem sujeira solta
    ys, xs = np.nonzero(op); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; op = op[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    if id_ == 'tapete':
        # O TOM DA SÁLVIA: a página tinge o tapete supondo a sálvia do de antes (matiz 0,158, saturação 0,27; ver
        # CORES_DO_TAPETE em montar.mjs). O gerado veio mais verde (0,31 e 0,15): a matiz e a saturação vão às de antes, a
        # claridade (o desenho) fica.
        import colorsys
        rgb = a[..., :3].astype(float) / 255
        hsv = np.array([colorsys.rgb_to_hsv(*px) for px in rgb.reshape(-1, 3)]).reshape(rgb.shape)
        m = op & (hsv[..., 1] > 0.02)
        dh = 0.158 - np.median(hsv[m][:, 0]); fs = 0.27 / max(0.01, np.median(hsv[m][:, 1]))
        hsv[..., 0] = (hsv[..., 0] + dh) % 1; hsv[..., 1] = np.clip(hsv[..., 1] * fs, 0, 1)
        novo = np.array([colorsys.hsv_to_rgb(*px) for px in hsv.reshape(-1, 3)]).reshape(rgb.shape)
        a = a.copy(); a[..., :3] = np.round(novo * 255).astype(a.dtype)
    h, w = op.shape; pe = np.nonzero(op[-1])[0]; meio = (pe.min() + pe.max()) / 2
    for peca in PECAS[id_]:
        f = os.path.join(AQUI, 'pecas', peca + '.png'); guarda = os.path.join(AQUI, 'pecas', 'recortes', peca + '.png')
        os.makedirs(os.path.dirname(guarda), exist_ok=True)
        if not os.path.exists(guarda): shutil.copy(f, guarda)
        velho = np.array(Image.open(guarda))[..., 3] > 127
        vy, vx = np.nonzero(velho); y1 = vy.max(); vpe = np.nonzero(velho[y1])[0]; vmeio = (vpe.min() + vpe.max()) / 2
        x0 = int(round(vmeio - meio)); y0 = y1 - h + 1
        tela = np.zeros((512, 512, 4), np.uint8)
        tela[y0:y0 + h, x0:x0 + w][op] = a[op]; tela[..., 3] = np.where(tela[..., 3] > 0, 255, 0)
        Image.fromarray(tela, 'RGBA').save(f, optimize=True)
        print(peca, 'antes', vx.max() - vx.min() + 1, 'x', vy.max() - vy.min() + 1, '· agora', w, 'x', h)
