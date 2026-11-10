# AS CLASSES DE COR DO PERSONAGEM (10/11/2026, o criador de coelho): cada pixel de um quadro é 0 fora, 1 pelo, 2 roupa ou
# 3 fixo (contorno, rosa do focinho e das orelhas, olhos, detalhes). A troca de paleta (a cor do pelo e da roupa que a
# pessoa escolhe) recolore o 1 e o 2 pelo tom de cada pixel em relação ao tom do meio da região NO QUADRO 0 da direção
# (`referencias`), fixo para todos os quadros. Usado pelo criador e pela auditoria-de-camadas.py.
# Roupa é só o que forma PEÇA: pedaços grandes (40 px ou mais) dos tons da roupa. Os risquinhos escuros no pelo (o traço
# da orelha, a sombra do queixo) são do pelo/contorno e ficam como estão: pintá-los com a cor da roupa dava os riscos
# vermelhos nas orelhas (relato dele, 10/11/2026).
import numpy as np
from scipy import ndimage

MIN_PECA = 40
ENORME = 250

def pecas(m, op):
    """Os pedaços de roupa: grandes (MIN_PECA) e com o centro abaixo de 40% da altura do desenho. O interior escuro da
    orelha caída forma um pedaço grande na altura da cabeça e não é roupa (achado pela auditoria-de-camadas, 10/11/2026)."""
    rot, n = ndimage.label(m, structure=np.ones((3, 3)))
    if not n: return m
    ys = np.nonzero(op.any(1))[0]; corte = ys.min() + 0.4 * (ys.max() - ys.min())
    tam = np.bincount(rot.ravel()); tam[0] = 0
    centros = ndimage.center_of_mass(m, rot, range(1, n + 1))
    # da metade para baixo (a calça, a perna que fica atrás da outra), um pedaço menor também é roupa: a perna de trás, nas
    # vistas de costas, saía com menos de 40 px e ficava sem a cor (relato dele, 10/11/2026)
    baixo = ys.min() + 0.6 * (ys.max() - ys.min())
    # e o pedaço ENORME é roupa onde quer que esteja: deitado de cabeça para baixo na tela (o dormindo das diagonais do norte), o
    # moletom fica no alto do desenho, e a regra da altura o deixava sem a cor (a auditoria das poses da cena, 10/11/2026). O
    # interior escuro da orelha caída não chega perto desse tamanho.
    return np.isin(rot, [k for k in range(1, n + 1) if tam[k] >= ENORME or (centros[k - 1][0] >= corte and (tam[k] >= MIN_PECA or (tam[k] >= 6 and centros[k - 1][0] >= baixo)))])

def cls(a, corpo):
    rgb = a[..., :3].astype(int); op = a[..., 3] > 20
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1); mn = rgb.min(-1); lum = (r * 299 + g * 587 + b * 114) // 1000
    sat = mx - mn
    lav = op & (b >= r - 25) & (lum >= 95) & (sat < 70) & ~((r > g + 40) & (r > b))
    rosa = op & (r > g + 35) & (r > b + 10)
    escuro = op & (lum < 95)
    contorno = op & (lum < 16)
    out = np.zeros(a.shape[:2], np.uint8)
    out[op] = 3
    out[lav] = 1
    roupa = pecas(escuro & ~contorno, op)
    if corpo in ('musculoso', 'musculoso-f-curta'):
        # a regata é dos tons médios da mesma lavanda; só o MAIOR pedaço deles (o tronco), não as sombras dos braços
        meio = lav & (lum < 155)
        rot, n = ndimage.label(meio, structure=np.ones((3, 3)))
        if n:
            tam = np.bincount(rot.ravel()); tam[0] = 0
            roupa |= rot == tam.argmax()
    out[roupa] = 2
    if corpo in ('musculoso', 'musculoso-f-curta'):
        # OS BRILHOS DA REGATA (relato dele, 10/11/2026: "as costas não pegaram a cor da roupa"): nas costas, a luz deixa tons
        # claros (lum >= 155) DENTRO da regata, e eles ficavam pelo, manchas da cor do pelo na roupa. Buraco da roupa vira roupa,
        # menos o que encosta no contorno: o rabinho (entre a regata e o short) e a faixa da barriga têm o traço preto em volta.
        roupa = out == 2
        buraco = ndimage.binary_fill_holes(roupa) & ~roupa & (out == 1)
        rot, n = ndimage.label(buraco, structure=np.ones((3, 3)))
        for k in range(1, n + 1):
            p = rot == k
            if not (ndimage.binary_dilation(p, np.ones((3, 3))) & contorno).any(): out[p] = 2
    out[rosa] = 3; out[contorno] = 3
    # AS SOMBRAS ESCURAS DO PELO (relato dele, 10/11/2026: "a orelha caída está com vários artefatos, em vários quadros"): o
    # queixo, o traço da boca e a borda das orelhas são do mesmo lilás, só que abaixo de 95, e ficavam FIXOS: com o pelo verde,
    # manchas roxas no rosto. Tom lilás de 60 a 95 que não é roupa nem contorno vai para a classe da vizinhança (pelo ou roupa,
    # a que tiver mais em volta; sem nenhuma, pelo): assim a sombra na beira da regata continua roupa.
    sombra = op & ~contorno & ~rosa & (out == 3) & (lum >= 60) & (lum < 95) & (b >= r - 25) & (sat < 70)
    if sombra.any():
        k = np.ones((3, 3))
        pelo = ndimage.convolve((out == 1).astype(int), k, mode='constant')
        pano = ndimage.convolve((out == 2).astype(int), k, mode='constant')
        out[sombra & (pano > pelo)] = 2
        out[sombra & (pano <= pelo)] = 1
    # e o pontinho ROSA solto no meio da roupa (um reflexo do PixelLab na gola): o rosa de verdade (focinho, orelha, almofadas
    # das patas) encosta no pelo; o de até 4 px cercado de roupa vira roupa
    rot, n = ndimage.label(rosa & (out == 3), structure=np.ones((3, 3)))
    for i in range(1, n + 1):
        p = rot == i
        if p.sum() > 4: continue
        volta = ndimage.binary_dilation(p, np.ones((3, 3))) & ~p
        if (out[volta] == 2).sum() > (out[volta] == 1).sum(): out[p] = 2
    return out

def referencias(a, k):
    """O tom do meio do pelo e da roupa num quadro: o mesmo para todos os quadros da direção (senão a cor pisca)."""
    rgb = a[..., :3].astype(float); lum = rgb @ [0.299, 0.587, 0.114]
    ref = {}
    for c in (1, 2):
        v = lum[k == c]
        ref[c] = float(np.median(v)) if len(v) else 1.0
    # A ROUPA DE DUAS PEÇAS DE TONS LONGE UM DO OUTRO (10/11/2026, a forte feminina: regata cinza média e short preto): com o
    # short sendo a maior parte, a mediana caía no preto e a regata, 3× mais clara que ela, estourava em BRANCO em qualquer
    # cor (a folha de estresse). Quando a parte clara da roupa (lum >= 95, a regata) é minoria mas existe, a referência é
    # ela: a regata fica na cor escolhida e o short num tom escuro dela, como no musculoso. Onde a parte clara já é a maioria
    # (o musculoso) a mediana já caía nela, e nada muda; sem parte clara (o moletom), também não.
    v = lum[k == 2]
    if len(v):
        claro = v[v >= 95]
        if 0.1 <= len(claro) / len(v) < 0.5: ref[2] = float(np.median(claro))
    return ref
