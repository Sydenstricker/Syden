# AS PEÇAS DOS OBJETOS DA PAREDE (itens.mjs): como as janelas (janelas/pecas.py), o que difere do quarto sem janela,
# nas coordenadas de onde foi pintado; de noite, o desenho vezes a luz da noite do lugar.
#   python e2e/pixel-art/quarto/novo/quarto/parede/pecas.py   → parede/<item>/peca-dia.png, peca-noite.png, item.json
import json
import os
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_dilation, binary_fill_holes, label, distance_transform_edt

AQUI = os.path.dirname(os.path.abspath(__file__))
J = os.path.join(os.path.dirname(AQUI), 'janelas')
ler = lambda *p: np.array(Image.open(os.path.join(*p)).convert('RGB')).astype(float)
# O SALÃO ("pecas.py salao"): os objetos pintados no TIJOLO do salão (itens.mjs salao), recortados contra ele, em
# parede-salao/<item>/; a peça é gravada nas coordenadas do quarto (27 px acima), que o motor leva ao salão.
SALAO = sys.argv[1:2] == ['salao']
DESLOC = 27 if SALAO else 0
chao = lambda x: 226 + DESLOC + (x - 256) * (114 / 216)
ys, xs = np.mgrid[0:512, 0:512]
PAREDE = (xs >= 257) & (xs < 472) & (ys <= chao(xs) - 4)
if SALAO:
    semDia = ler(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(AQUI)))), 'salao', 'base-tijolo.png'); semNoite = semDia
else:
    semDia = ler(J, 'sem-janela-dia.png'); semNoite = ler(J, 'sem-janela-noite.png')
borrar = lambda a: np.stack([gaussian_filter(a[..., c], 10) for c in range(3)], 2)
razao = borrar(semNoite) / np.maximum(1, borrar(semDia))
# O que cada um é (o nome para a página) e o que ele abre no app (a ação da home de hoje, Home.tsx).
ITENS = {
    # (17/10/2026: o creme da parede por dentro do arco do fone ficava na peça; o vaso claro da prateleira era tomado por
    # parede e descascado, e sobrava só a metade escura dele)
    'fone': {'nome': 'o fone', 'funcao': 'fone', 'vaos': True, 'contorno': True, 'tingida': 0.8},
    'quadro': {'nome': 'o quadro de fotos', 'funcao': 'quadro'},
    'cortica': {'nome': 'a cortiça', 'funcao': 'cortica'},
    'prateleira': {'nome': 'a prateleira', 'funcao': None, 'contorno': True, 'escuro': 110},
    'pintura': {'nome': 'a pintura', 'funcao': None},
    # O salão (15/10/2026). "luz": as cores claras ficam acesas de noite e brilham em volta; "chao": fica no chão (a porta).
    'prateleira-bar': {'nome': 'a prateleira do bar', 'funcao': None, 'luz': True, 'vaos': True},
    'prateleira-snacks': {'nome': 'a prateleira de snacks', 'funcao': None},
    'trofeus': {'nome': 'os troféus', 'funcao': None},
    'neon': {'nome': 'o neon', 'funcao': None, 'luz': True},
    'relogio': {'nome': 'o relógio', 'funcao': None},
    'violao': {'nome': 'o violão', 'funcao': None},
    'porta': {'nome': 'a porta do banheiro', 'funcao': None, 'chao': True},
    # o pôster do coelho roqueiro abre o karaokê (a função do microfone)
    'poster': {'nome': 'o pôster do karaokê', 'funcao': 'microfone'},
}
SO = sys.argv[2:] if SALAO else sys.argv[1:]  # só estes itens (vazio: todos)
for item, meta in ITENS.items():
    if SO and item not in SO: continue
    d = os.path.join(os.path.dirname(AQUI), 'parede-salao', item) if SALAO else os.path.join(AQUI, item)
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
    # SEM A FRANJA DA PAREDE (15/10/2026): na borda, o que é quase da cor da parede creme do quarto é parede, e no tijolo
    # do salão virava um contorno claro em volta do relógio, do violão e dos troféus. Por dentro (o branco do mostrador,
    # as fotos), os buracos se fecham de novo.
    m = binary_fill_holes(m & (dif > 26)) & PAREDE
    # E SEM A SOMBRA PINTADA NA PAREDE: o pixel que é só a parede creme escurecida (os três canais na mesma proporção) é
    # sombra no reboco do quarto, e no tijolo do salão virava uma mancha clara em volta da peça.
    rs = dia / np.maximum(1, semDia)  # (antes se chamava razao e apagava a luz da noite, usada embaixo na peça de noite)
    sombra = (rs.max(2) - rs.min(2) < 0.07) & (rs.mean(2) < 0.97) & (rs.mean(2) > 0.35)
    rot2, _ = label(m & ~sombra)
    t2 = np.bincount(rot2.ravel()); t2[0] = 0
    if not SALAO: m = np.isin(rot2, np.nonzero(t2 >= max(20, t2.max() * 0.05))[0])
    # (no salão a peça foi pintada no próprio tijolo: o que sobra em volta já é da cor certa, e descascar só comia a peça)
    # DESCASCAR A BORDA (relato de 15/10/2026: manchas em volta do violão, dos troféus, do neon, da prateleira de snacks):
    # o que sobra em volta é o creme da parede do quarto TINGIDO pela peça (o rosado do neon, o bege do violão), e não
    # sombra pura. De fora para dentro, sai da borda todo pixel claro e pouco saturado, até bater no contorno escuro da peça
    # ou numa cor viva (os tubos do neon); por dentro, nada muda.
    lum = dia.mean(2); sat = (dia.max(2) - dia.min(2)) / np.maximum(1, dia.max(2))
    # só numa faixa de 4 px da borda de fora: sem isso, entrava por uma falha do contorno e comia o mostrador do relógio, o
    # vidro dos potes e a placa da porta
    parece_parede = (lum > 105) & (sat < 0.42) & (distance_transform_edt(m) <= 4)
    for _ in range(0 if SALAO or meta.get('descascar') is False else 4):
        fora = ~m
        borda = m & (np.roll(fora, 1, 0) | np.roll(fora, -1, 0) | np.roll(fora, 1, 1) | np.roll(fora, -1, 1))
        tira = borda & parece_parede
        if not tira.any(): break
        m = m & ~tira
    # o que ficou cercado pela peça é dela (o mostrador do relógio, as fotos do quadro): o filtro de sombra o tomava por
    # parede escurecida
    m = binary_fill_holes(m)
    # no salão, só os pedaços grandes: a repintura mexe no fio das luzinhas e nos tijolos perto, e esses pedaços soltos
    # andariam junto com a peça
    if SALAO:
        rot3, _ = label(m); t3 = np.bincount(rot3.ravel()); t3[0] = 0
        m = np.isin(rot3, np.nonzero(t3 >= t3.max() * 0.12)[0])
    # "vaos": o que é parede pura por dentro da peça (o vão entre as tábuas da prateleira) também sai. Não vale para
    # todas: o mostrador do relógio é creme como a parede.
    if meta.get('vaos'): m = m & (dif > 14)
    # "contorno" (17/10/2026): a peça é tudo o que fica DENTRO do contorno escuro do desenho. Inunda-se de fora para dentro
    # pelo que é parede (quase igual à vazia, ou ela escurecida pela sombra, ou tingida pela peça: claro e pouco vivo), e
    # para no contorno. Serve à peça clara como a parede (o vaso da prateleira) e ao halo pintado em volta (o fone).
    if meta.get('contorno'):
        escuro = lum < meta.get('escuro', 80)
        parede_ou_sombra = ((dif <= 26) | sombra | ((lum > 105) & (sat < meta.get('tingida', 0.42)))) & ~escuro
        caixa = binary_dilation(m, iterations=12)  # (com 3, a metade do vaso que o recorte de antes perdia ficava fora, e a inundação entrava por ela)
        livre = (parede_ou_sombra & caixa) | ~caixa
        rot4, _ = label(livre)
        fora = np.isin(rot4, np.unique(np.concatenate([rot4[0], rot4[-1], rot4[:, 0], rot4[:, -1]])))
        m = binary_fill_holes(~fora & caixa & PAREDE)
        if meta.get('vaos'): m = m & ~(dif <= 14)
        rot5, _ = label(m); t5 = np.bincount(rot5.ravel()); t5[0] = 0
        m = rot5 == np.argmax(t5)
    for nome, cor in [('peca-dia', dia), ('peca-noite', dia if SALAO else dia * razao)]:
        # (a cor fora da peça vai a zero: ela não aparece, e sem isso cada arquivo pesava 140 KB; no salão, a peça sobe
        # os 27 px para as coordenadas do quarto)
        a = np.dstack([np.clip(cor, 0, 255) * m[..., None], m * 255.0])
        if DESLOC: a = np.roll(a, -DESLOC, 0)
        Image.fromarray(a.astype(np.uint8), 'RGBA').save(os.path.join(d, nome + '.png'), optimize=True)
    cols = np.nonzero(m.any(0))[0]; linhas = np.nonzero(m.any(1))[0]
    # a altura: de quanto acima do chão até quanto (medida na coluna do meio)
    meio = int((cols.min() + cols.max()) / 2)
    hs = chao(meio) - np.nonzero(m[:, cols.min():cols.max() + 1].any(1))[0]
    json.dump({**{k: v for k, v in meta.items() if k not in ('vaos', 'descascar', 'contorno', 'tingida', 'escuro')}, 'ocupa': [round((cols.min() - 256) / 27, 2), round((cols.max() + 1 - 256) / 27, 2)], 'alto': [round(float(hs.min()), 1), round(float(hs.max()), 1)]}, open(os.path.join(d, 'item.json'), 'w', encoding='utf8'), ensure_ascii=False)
    print(item, json.load(open(os.path.join(d, 'item.json'))))
