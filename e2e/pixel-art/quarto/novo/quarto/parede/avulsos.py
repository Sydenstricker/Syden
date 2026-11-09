# Escolhe a opção gerada SEM PAREDE mais parecida com o recorte (avulsos.mjs) e a põe no lugar da peça do salão:
# parede-salao/<item>/peca-dia.png e peca-noite.png (nas coordenadas do quarto, 27 px acima) e item.json.
#   python e2e/pixel-art/quarto/novo/quarto/parede/avulsos.py <item...>   [escolha: <item>=<n> força a opção n]
import glob, json, os, sys
import numpy as np
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__)); BASE = os.path.join(os.path.dirname(AQUI), 'parede-salao')
chao = lambda x: 253 + (x - 256) * (114 / 216)
from scipy.ndimage import gaussian_filter
_J = os.path.join(os.path.dirname(AQUI), 'janelas')
_ler = lambda f: np.array(Image.open(os.path.join(_J, f)).convert('RGB')).astype(float)
_borrar = lambda a: np.stack([gaussian_filter(a[..., c], 10) for c in range(3)], 2)
RAZAO_NOITE = _borrar(_ler('sem-janela-noite.png')) / np.maximum(1, _borrar(_ler('sem-janela-dia.png')))
folha = []
for arg in sys.argv[1:]:
    item, _, forcar = arg.partition('=')
    d = os.path.join(BASE, item); ref = json.load(open(os.path.join(d, 'ref.json')))
    r = np.array(Image.open(os.path.join(d, 'ref.png')).convert('RGB')).astype(float)
    peca = np.array(Image.open(os.path.join(d, 'peca-dia.png')).convert('RGBA'))
    alvo = np.roll(peca[..., 3] > 127, 27, 0)[ref['y0']:ref['y0'] + ref['h'], ref['x0']:ref['x0'] + ref['w']]
    melhor = None
    for f in sorted(glob.glob(os.path.join(d, 'avulso-*.png')), key=lambda f: int(f.rsplit('-', 1)[1][:-4])):
        a = np.array(Image.open(f).convert('RGBA').resize((ref['w'], ref['h']), Image.NEAREST)).astype(float)
        op = a[..., 3] > 127
        if not op.any(): continue
        inter = (op & alvo).sum(); uniao = (op | alvo).sum(); iou = inter / max(1, uniao)
        cor = np.abs(a[..., :3] - r)[op & alvo].mean() if inter else 255
        nota = iou * 100 - cor * 0.4
        n = int(f.rsplit('-', 1)[1][:-4])
        if forcar and int(forcar) == n: nota = 1e9
        if not melhor or nota > melhor[0]: melhor = (nota, n, a, iou, cor)
    nota, n, a, iou, cor = melhor
    print(item, 'opção', n, 'iou', round(iou, 2), 'cor', round(cor, 1))
    tela = np.zeros((512, 512, 4)); tela[ref['y0']:ref['y0'] + ref['h'], ref['x0']:ref['x0'] + ref['w']] = a
    tela[..., 3] = np.where(tela[..., 3] > 127, 255, 0); tela[..., :3] *= (tela[..., 3:] > 0)
    m = tela[..., 3] > 0
    cols = np.nonzero(m.any(0))[0]; meio = int((cols.min() + cols.max()) / 2)
    # GERADO COM A INCLINAÇÃO DA OUTRA PAREDE (o neon, relato dele de 16/10/2026: "a regra de espelhamento invertida"): a
    # peça é da parede da direita, e "espelhar" no item.json a vira dentro da própria caixa.
    if json.load(open(os.path.join(d, 'item.json'), encoding='utf8')).get('espelhar'):
        c0, c1 = cols.min(), cols.max(); tela[:, c0:c1 + 1] = tela[:, c0:c1 + 1][:, ::-1].copy(); m = tela[..., 3] > 0
    hs = chao(meio) - np.nonzero(m[:, cols.min():cols.max() + 1].any(1))[0]
    tq = np.roll(tela, -27, 0).astype(np.uint8)
    # A NOITE (09/11/2026): no salão a noite sai do dia, por código, mas o QUARTO usa a peca-noite como ela é, e a peça
    # gerada sem parede acendia à noite (o fone, os troféus). Ela é o dia vezes a luz da noite do quarto no lugar (como
    # parede/pecas.py e janelas/pecas.py fazem com os recortes).
    Image.fromarray(tq, 'RGBA').save(os.path.join(d, 'peca-dia.png'), optimize=True)
    tn = tq.copy(); tn[..., :3] = np.clip(tq[..., :3] * RAZAO_NOITE, 0, 255).astype(np.uint8) * (tq[..., 3:] > 0)
    Image.fromarray(tn, 'RGBA').save(os.path.join(d, 'peca-noite.png'), optimize=True)
    meta = json.load(open(os.path.join(d, 'item.json'), encoding='utf8'))
    meta.update({'ocupa': [round((cols.min() - 256) / 27, 2), round((cols.max() + 1 - 256) / 27, 2)], 'alto': [round(float(hs.min()), 1), round(float(hs.max()), 1)], 'avulso': n})
    json.dump(meta, open(os.path.join(d, 'item.json'), 'w', encoding='utf8'), ensure_ascii=False)
