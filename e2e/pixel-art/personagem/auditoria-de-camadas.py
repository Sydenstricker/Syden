# A AUDITORIA DAS CAMADAS (10/11/2026, pedido dele: "talvez seja necessário melhorarmos o nosso processo de auditoria da
# arte? São vários erros que passaram agora"). Os erros que passaram tinham uma coisa em comum: com as cores ORIGINAIS eles
# quase não se viam (pelo lavanda sobre lavanda, bandana ferrugem sobre moletom escuro). Ele os achou pintando o coelho
# com cores berrantes. Esta auditoria faz o mesmo de propósito, em todos os corpos, animações, direções e quadros, e mede
# o que dá para medir:
#
#   1. SOLTOS E PICOS: pedaço de desenho que flutua, que sobe acima dos quadros vizinhos (a bolinha no alto da cabeça) ou
#      que fica colado POR FORA do contorno (o toco claro de um efeito).
#   2. ROUPA ESTÁVEL: quantos pixels de roupa cada quadro tem, contra a mediana da direção; um quadro que foge 35% tem roupa
#      virando pelo ou pelo virando roupa (a regata que clareava num quadro).
#   3. RISQUINHOS: roupa no quarto de cima do desenho, onde só há orelha e cabeça (o risco vermelho na orelha).
#   5. BRILHO: pixel com cor de faísca (o verde acima do vermelho, ou amarelo), que o pelo e a roupa nunca têm.
#      (O mascote fica de fora: os desenhos dele, aprovados, têm uns poucos, para rever um dia.)
#   4. ACESSÓRIO LIMPO: pixel da camada com cor que não é a do acessório nem o contorno dele (o halo da bandana).
#   6. TOCOS DE QUALQUER TOM (10/11/2026, tocos.py): a fileira de tons médios por fora do traço e o cinza neutro sozinho no
#      pelo, nos três corpos (o mascote também: foi nele que ele os achou).
#
# AS POSES DA CENA (10/11/2026): além das 4 animações de sempre, as animações, os estados e as transições que o quarto e o
# salão usam (FONTES do montar.mjs), nos três corpos → camadas/estresse-<corpo>-cena.png. Os picos só nas animações que
# repetem, a roupa estável também; os risquinhos nas orelhas, menos nas poses deitadas e nas de braços para o alto.
#
# E monta a FOLHA DE ESTRESSE, que é a que se olha: cada animação e direção com pelo rosa-choque, roupa vermelha, boné azul
# e bandana verde, os acessórios encaixados como no jogo. Defeito de cor salta aos olhos assim.
#   py -3 e2e/pixel-art/personagem/auditoria-de-camadas.py        → camadas/estresse-<corpo>.png e camadas/auditoria.json
# Sai com código 1 se algo for marcado. Rodar depois de cada corpo, animação ou acessório novo (junto com o
# acessorio-camadas.py, que gera o relatorio.json usado aqui).
import os, sys, json, re
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from classes_de_cor import cls, referencias
from tocos import toco_por_fora, cinza_no_pelo, brilho_de_verdade, sem_quentes
import importlib.util as _u
# a regra do toco fora do contorno mora no limpar-soltos.py (que roda como script): copiada aqui, igual
def fora_do_contorno(a):
    a = a.astype(int); op = a[..., 3] > 20; lum = a[..., :3] @ [0.299, 0.587, 0.114]
    contorno = op & (lum < 45); claro = op & (lum > 130)  # os tocos são claros; o cinza do serrilhado do contorno, não
    cima = np.zeros_like(op); cima[1:] = ~op[:-1]
    baixo = np.zeros_like(op); baixo[:-1] = contorno[1:]
    baixo2 = np.zeros_like(op); baixo2[:-2] = contorno[2:]
    diag = np.zeros_like(op); diag[:-1, 1:] |= contorno[1:, :-1]; diag[:-1, :-1] |= contorno[1:, 1:]
    # e o claro quase todo cercado de vazio (5 ou mais dos 8 vizinhos): a ponta de um toco, mesmo sem o contorno embaixo
    vazios = ndimage.convolve((~op).astype(int), np.ones((3, 3), int), mode='constant', cval=1) - (~op).astype(int)
    sem = claro & ((cima & (baixo | baixo2 | diag)) | (vazios >= 5))
    # vizinhança de 4: pela diagonal, o toco se ligava ao pelo do corpo e virava um pedaço grande demais para sair
    rot, n = ndimage.label(claro & ~contorno)
    marca = np.zeros_like(op)
    for k in set(rot[sem].tolist()) - {0}:
        m = rot == k
        if m.sum() <= 8: marca |= m
    return sem_quentes(a, marca)  # a borda da página do livro fica (tocos.py)

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'camadas')
CORPOS = ['mascote', 'orelha-caida', 'musculoso', 'mascote-f-moletom', 'musculoso-f-curta']
ANIMS = ['parado', 'andando', 'falando', 'acenando']
PASTAS = {('mascote', 'andando'): ['andando-v3', 'andando-v3b']}
DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
PELO, ROUPA = (255, 120, 190), (220, 40, 50)
CORES_ACC = {'bone': (40, 90, 230), 'bandana': (60, 190, 80)}
Q = 168  # as poses da cena têm quadros de até 160
rel = json.load(open(os.path.join(SAIDA, 'relatorio.json'), encoding='utf-8'))

def lum(a): return a[..., :3].astype(float) @ [0.299, 0.587, 0.114]

def recolorir(a, sel, alvo, ref):
    out = a.copy(); L = lum(a)
    k = L[sel] / max(ref, 1)
    alvo = np.array(alvo, float)
    escuro = k[:, None] <= 1
    cor = np.where(escuro, alvo * (0.25 + 0.75 * k[:, None]), alvo + (255 - alvo) * np.clip((k[:, None] - 1) * 1.1, 0, 1))
    out[sel, :3] = np.clip(cor, 0, 255).astype(np.uint8)
    return out

def soltos(a):
    d = a[..., 3] > 0
    rot, n = ndimage.label(d, structure=np.ones((3, 3)))
    if n <= 1: return 0
    tam = np.bincount(rot.ravel()); tam[0] = 0
    tam = tam.copy(); tam[tam >= 40] = 0; tam[np.argmax(np.bincount(rot.ravel())[1:]) + 1] = 0
    return int(tam.sum())  # (pedaço solto de 40 px ou mais é do corpo, com um vão: o tênis do musculoso; ver limpar-soltos.py)

def ler_pasta(pasta, d):
    if not os.path.isdir(pasta): return []
    if os.path.exists(os.path.join(pasta, f'{d}.png')): return [np.array(Image.open(os.path.join(pasta, f'{d}.png')).convert('RGBA'))]
    fs = sorted([f for f in os.listdir(pasta) if re.fullmatch(f'{d}-\\d+\\.png', f)], key=lambda f: int(f.rsplit('-', 1)[1][:-4]))
    return [np.array(Image.open(os.path.join(pasta, f)).convert('RGBA')) for f in fs]

def quadros(corpo, anim, d):
    for p in PASTAS.get((corpo, anim), [anim]):
        fs = ler_pasta(os.path.join(AQUI, corpo, 'baixa-120', 'animacoes', p), d)
        if fs: return fs
    return []

# AS POSES DA CENA (10/11/2026: as pastas primeiras de FONTES, em quarto/novo/quarto/montar.mjs, nos três corpos; as mesmas
# chaves do relatorio.json, ver acessorio-camadas.py). Tipo: 'anim' repete (a roupa tem de ficar estável), 'estado' é uma pose,
# 'transicao' muda de pose (a roupa muda de área de propósito). Deitado: o quarto de cima do desenho não é só orelha (a regra
# dos risquinhos não vale), e as diagonais do norte usam o leste e o oeste (DELES_DEITADO_PL do montar.mjs).
ANIMS_DA_CENA = ['varrendo', 'assistindo-sofa-fofo', 'rindo-sofa', 'acenando-sofa', 'aplaudindo-sofa', 'surpreso-sofa',
                 'jogando-fliperama', 'empolgado-fliperama', 'assistindo-chao', 'digitando-maos']
ESTADOS = ['sentado-2', 'sentado-sofa', 'sentado-poltrona', 'no-computador', 'sentado-banqueta', 'no-fliperama',
           'lendo-deitado', 'dormindo', 'dormindo-largado']
TRANSICOES = ['sentar-fluido', 'sentar-sofa', 'deitar-fluido', 'deitar-lendo-fluido', 'bracos']
DEITADAS = {'estados/lendo-deitado', 'estados/dormindo', 'estados/dormindo-largado', 'transicoes/deitar-fluido', 'transicoes/deitar-lendo-fluido'}

def poses(corpo):
    """(chave, tipo, folha, função de direção → quadros) de tudo o que o corpo tem."""
    out = [(a, 'anim', 'base', lambda d, a=a: quadros(corpo, a, d)) for a in ANIMS]
    out += [(a, 'anim', 'cena', lambda d, a=a: ler_pasta(os.path.join(AQUI, corpo, 'baixa-120', 'animacoes', a), d)) for a in ANIMS_DA_CENA]
    out += [(f'estados/{e}', 'estado', 'cena', lambda d, e=e: ler_pasta(os.path.join(AQUI, corpo, 'estados', e), d)) for e in ESTADOS]
    out += [(f'transicoes/{t}', 'transicao', 'cena', lambda d, t=t: ler_pasta(os.path.join(AQUI, corpo, 'transicoes', t), d)) for t in TRANSICOES]
    return out

marcas = []; folhas = {}
for corpo in CORPOS:
    camadas = {}
    for acc in CORES_ACC:
        for d in DIRS:
            f = os.path.join(AQUI, corpo, 'acessorios', acc, 'parado', f'{d}-0.png')
            if not os.path.exists(f): continue
            L = np.array(Image.open(f).convert('RGBA')); op = L[..., 3] > 20
            # 4. o acessório limpo: matiz fora do dominante e claro (não é contorno)
            rgb = L[..., :3].astype(float); mx, mn = rgb.max(-1), rgb.min(-1)
            sat = (mx - mn) / np.maximum(mx, 1); clara = lum(L) > 70
            sem_cor = op & clara & (sat < 0.18)
            if sem_cor.sum() > 2: marcas.append(f'{corpo}/{acc}/{d}: {int(sem_cor.sum())} px claros sem a cor do acessório')
            Lc = L.copy()
            Lc = recolorir(Lc, op & clara, CORES_ACC[acc], float(np.median(lum(L)[op & clara])) if (op & clara).any() else 1)
            camadas[(acc, d)] = Lc
    linhas = {'base': [], 'cena': []}
    for chave, tipo, qual, ler_dir in poses(corpo):
        dirs = DIRS + (['east', 'west'] if chave in DEITADAS and tipo == 'estado' else [])
        for d in dirs:
            fs = ler_dir(d)
            if not fs: continue
            mapas = [cls(a, corpo) for a in fs]
            ref = referencias(fs[0], mapas[0])
            roupa = np.array([(m == 2).sum() for m in mapas]); med = max(1, np.median(roupa))
            H = max(a.shape[0] for a in fs)
            topo = [int(np.nonzero((a[..., 3] > 0).any(1))[0].min()) + (H - a.shape[0]) // 2 for a in fs]
            linha = []
            for k, (a, m) in enumerate(zip(fs, mapas)):
                nome = f'{corpo}/{chave}/{d}-{k}' if tipo != 'estado' else f'{corpo}/{chave}/{d}'
                s = soltos(a) + int(fora_do_contorno(a).sum())
                r_, g_, b_ = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
                yy = np.nonzero((a[..., 3] > 20).any(1))[0]; metade = np.zeros(a.shape[:2], bool); metade[:yy.min() + (yy.max() - yy.min()) // 2] = True
                bri = (a[..., 3] > 20) & (((g_ > r_ + 3) & (0.299 * r_ + 0.587 * g_ + 0.114 * b_ > 140)) | ((r_ > 200) & (g_ > 170) & (b_ < 140)) | ((r_ > 238) & (g_ > 238) & (b_ > 238) & metade))
                bri = brilho_de_verdade(a, bri)  # o brilho do olho aberto e a página do livro são do desenho (tocos.py)
                # (o mascote fica de fora dos brilhos nas 4 de sempre, aprovadas)
                if bri.sum() and (corpo != 'mascote' or qual == 'cena'): marcas.append(f'{nome}: {int(bri.sum())} px com cor de brilho (efeito do PixelLab)')
                if s: marcas.append(f'{nome}: {s} px soltos')
                # 6. o toco de qualquer tom por fora do traço e o cinza neutro sozinho no pelo (tocos.py; o mascote também)
                t_ = int(toco_por_fora(a).sum()); c_ = int(cinza_no_pelo(a).sum())
                if t_: marcas.append(f'{nome}: {t_} px de toco por fora do contorno')
                if c_: marcas.append(f'{nome}: {c_} px de cinza neutro no pelo')
                viz = [topo[j] for j in (k - 1, k + 1) if 0 <= j < len(fs)]
                if len(viz) == 2 and topo[k] <= min(viz) - 5 and tipo == 'anim': marcas.append(f'{nome}: pico de {min(viz) - topo[k]} px acima dos vizinhos')
                bracos_para_cima = any(x in chave for x in ('acenando', 'aplaudindo', 'empolgado', 'surpreso'))
                # (de braços nus, a regata some atrás dos braços quando a mão vem para a frente do peito: no aplaudir da forte
                # feminina, conferido na folha em 10/11/2026, a roupa caía de ~650 para ~400 px com as classes certas. Ali a
                # folga é maior; o risco de cor errada continua coberto pela folha de estresse.)
                folga = 0.7 if corpo in ('musculoso', 'musculoso-f-curta') and bracos_para_cima else 0.35
                if tipo == 'anim' and abs(roupa[k] - med) / med > folga: marcas.append(f'{nome}: roupa com {roupa[k]} px, a mediana é {int(med)}')
                # 3. risquinhos de roupa NAS ORELHAS: no quarto de cima do desenho só há orelha e cabeça; pixel de roupa ali é
                # traço do pelo pintado com a cor da roupa (o risco vermelho na orelha). Peças separadas pelo contorno (o
                # moletom e a calça) são normais, e por isso a regra olha a altura, não o número de pedaços. (Deitado, o
                # quarto de cima tem corpo: fica de fora; e os braços para o alto do aceno e da torcida também.)
                ys = np.nonzero((a[..., 3] > 0).any(1))[0]
                alto = ys.min() + (ys.max() - ys.min()) // 4
                no_alto = int((m[:alto] == 2).sum())
                if no_alto > 8 and not bracos_para_cima and chave not in DEITADAS: marcas.append(f'{nome}: {no_alto} px de roupa na altura das orelhas')
                # a folha de estresse
                b = recolorir(a, m == 1, PELO, ref[1]); b = recolorir(b, m == 2, ROUPA, ref[2])
                tela = np.zeros((Q, Q, 4), np.uint8); pad = (Q - a.shape[0]) // 2; padx = (Q - a.shape[1]) // 2
                tela[pad:pad + a.shape[0], padx:padx + a.shape[1]] = b
                for acc in ('bandana', 'bone'):
                    chave_rel = f'{corpo}/{acc}/{chave}/{d}'
                    if (acc, d) not in camadas or chave_rel not in rel or k >= len(rel[chave_rel]) or rel[chave_rel][k].get('sem'): continue
                    dx, dy = rel[chave_rel][k]['desloc']; Lc = camadas[(acc, d)]
                    ys, xs = np.nonzero(Lc[..., 3] > 20); Y, X = ys + dy + pad, xs + dx + padx
                    ok = (Y >= 0) & (Y < Q) & (X >= 0) & (X < Q)
                    tela[Y[ok], X[ok]] = Lc[ys[ok], xs[ok]]
                linha.append(tela)
            linhas[qual].append(linha)
    for qual, ls in linhas.items():
        if not ls: continue
        E = 2; cols = max(len(l) for l in ls)
        f = np.zeros((len(ls) * Q * E, cols * Q * E, 3), np.uint8); f[...] = (34, 30, 52)
        for i, l in enumerate(ls):
            for j, t in enumerate(l):
                blk = np.where(t[..., 3:4] > 20, t[..., :3], (34, 30, 52)).astype(np.uint8)
                f[i * Q * E:(i + 1) * Q * E, j * Q * E:(j + 1) * Q * E] = np.kron(blk, np.ones((E, E, 1), np.uint8))
        Image.fromarray(f).save(os.path.join(SAIDA, f'estresse-{corpo}.png' if qual == 'base' else f'estresse-{corpo}-cena.png'))

json.dump(marcas, open(os.path.join(SAIDA, 'auditoria.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(marcas)} marcas')
for m in marcas[:60]: print(' ', m)
sys.exit(1 if marcas else 0)
