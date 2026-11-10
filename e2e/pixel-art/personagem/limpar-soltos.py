# TIRA O QUE FLUTUA SOLTO nos quadros de uma animação (09/11/2026, o "parado" da orelha caída: o PixelLab desenhou
# bolinhas e gotas em cima da cabeça). Fica só o que encosta no corpo: o maior pedaço de desenho e o que toca nele
# (vizinhança de 8), e o que encosta nele só por um fio de 1 px. Um pedaço que é do corpo e se solta de propósito (uma
# lágrima, um "z") não sobrevive: animação que precisa disso não passa por aqui.
#
# OS PICOS (10/11/2026, relato dele: uma bolinha grudada no alto da cabeça do orelhudo, presa por um pescoço de 2 px, que
# o corte do fio não pegava): em cada direção, o quadro cujo alto do desenho sobe 5 px ou mais acima dos DOIS vizinhos
# perde o que passa da altura deles (com 1 px de folga), e depois passa pela limpeza de novo. Um movimento de verdade (o
# braço que sobe no aceno) dura mais de um quadro, e por isso não é pico. E o toco claro colado POR FORA do contorno sai
# também (fora_do_contorno).
#   py -3 e2e/pixel-art/personagem/limpar-soltos.py <pasta da animação> [direção]
#
# OS TOCOS DE QUALQUER TOM E O CINZA NO PELO (10/11/2026, tocos.py): a coluna de tons médios por fora do traço e o cinza
# neutro (133,133,133) sozinho no pelo, que as regras de cima não pegavam (só olham o claro e as cores de faísca).
# Uma pasta de ESTADO (<direção>.png, uma pose por direção) também passa: cada direção é um quadro só (sem picos).
import os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tocos import toco_por_fora, consertar_cinza, brilho_de_verdade, sem_quentes

# --teto N (10/11/2026): nada pode passar N px acima do alto do quadro 0 da direção. Para as animações em que a cabeça não sobe
# (sentado no sofá, de orelha caída), onde o PixelLab desenhou nuvens e faíscas GRANDES em cima da cabeça, que a regra dos soltos
# (pedaço de 40 px ou mais é do corpo) deixava. Só por pedido, conferindo olhando.
_args = sys.argv[1:]; TETO = None
if '--teto' in _args: _i = _args.index('--teto'); TETO = int(_args[_i + 1]); del _args[_i:_i + 2]
pasta = _args[0]; direcao = _args[1] if len(_args) > 1 else None
PICO = 5
GRANDE = 40  # px: pedaço solto desse tamanho para cima é do corpo (ver soltos)
# numa TRANSIÇÃO (transicoes/), o desenho sobe ou desce de propósito (sentar, deitar) e não repete: picos não valem (10/11/2026:
# no deitar-lendo, o corte de pico tirava o alto da cabeça)
TRANSICAO = 'transicoes' in os.path.abspath(pasta).replace(os.sep, '/').split('/')

def fora_do_contorno(a):
    """O TOCO DE EFEITO preso por fora do contorno (10/11/2026, relato dele: pontinhos claros no alto da cabeça do orelhudo,
    colados no desenho, que a limpeza por forma não pega): pixel claro com o vazio logo acima e o contorno preto logo
    abaixo, ou seja, POR FORA do traço. O pedaço claro inteiro preso ali sai, se tiver até 8 px. A mão do aceno e a ponta
    da orelha não entram: nelas o claro tem claro embaixo, e não o contorno."""
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

def brilhos(a):
    """O BRILHO DESENHADO POR DENTRO (10/11/2026: a cruzinha branca na testa do orelhudo): o PixelLab pinta faíscas com um
    branco-azulado em que o verde passa o vermelho, e a amarela. O pelo e a roupa dos coelhos NUNCA têm o verde acima do
    vermelho (o pelo é lavanda), então esse pixel é efeito. Ele vira a cor do pixel bom mais perto."""
    a = a.astype(int); op = a[..., 3] > 20
    r, g, b = a[..., 0], a[..., 1], a[..., 2]; lum = 0.299 * r + 0.587 * g + 0.114 * b
    # e o BRANCO PURO na metade de cima: o pelo mais claro é lavanda; o único branco legítimo é o tênis, lá embaixo
    ys = np.nonzero(op.any(1))[0]
    cima = np.zeros_like(op)
    if len(ys): cima[:ys.min() + (ys.max() - ys.min()) // 2] = True
    branco = (r > 238) & (g > 238) & (b > 238) & cima
    # (só o pedaço que não encosta no escuro nem no quente: o brilho do olho aberto e a página do livro ficam; tocos.py)
    return brilho_de_verdade(a, op & (((g > r + 3) & (lum > 140)) | ((r > 200) & (g > 170) & (b < 140)) | branco))

def soltos(a):
    desenho = a[..., 3] > 0
    rot, n = ndimage.label(desenho, structure=np.ones((3, 3)))
    if not n: return np.zeros(desenho.shape, bool)
    maior = np.argmax(np.bincount(rot.ravel())[1:]) + 1
    # um pedaço GRANDE solto (40 px ou mais) é do corpo, desenhado com um vão: o tênis do musculoso sentado no sofá saiu assim
    # (10/11/2026), e a limpeza o apagava. Efeito solto é pequeno (as faíscas têm até uns 20 px).
    tam = np.bincount(rot.ravel()); grandes = [k for k in range(1, n + 1) if k != maior and tam[k] >= GRANDE]
    fora = (rot > 0) & (rot != maior) & ~np.isin(rot, grandes)
    # O que encosta no corpo por um FIO (a faísca grudada no alto da cabeça): afina o corpo 1 px, fica o maior pedaço
    # afinado, e volta só o que está a até 2 px dele. O contorno do corpo (1–2 px) volta inteiro; o efeito, só o toco.
    fino = ndimage.binary_erosion(rot == maior, structure=np.ones((3, 3)))
    r2, n2 = ndimage.label(fino, structure=np.ones((3, 3)))
    if n2:
        corpo = r2 == (np.argmax(np.bincount(r2.ravel())[1:]) + 1)
        perto = ndimage.binary_dilation(corpo, structure=np.ones((3, 3)), iterations=2)
        # (menos o que encosta num tom quente: a quina fina do livro aberto, presa à capa marrom; tocos.py)
        fio = sem_quentes(a, (rot == maior) & ~perto)
        # e só pedaço pequeno: o tênis preso por um fio é do corpo (o mesmo GRANDE de cima)
        rf, nf = ndimage.label(fio, structure=np.ones((3, 3)))
        if nf:
            tf = np.bincount(rf.ravel()); fio &= ~np.isin(rf, [k for k in range(1, nf + 1) if tf[k] >= GRANDE])
        fora |= fio
    return fora

# os quadros por direção, em ordem
grupos = {}
for f in os.listdir(pasta):
    m = re.fullmatch(r'([a-z]+(?:-[a-z]+)*)(?:-(\d+))?\.png', f)
    if m and m.group(1) not in ('south', 'north', 'east', 'west', 'south-east', 'south-west', 'north-east', 'north-west'): m = None
    if not m or (direcao and m.group(1) != direcao): continue
    grupos.setdefault(m.group(1), []).append((int(m.group(2) or 0), f))

mudou = 0
for d, fs in grupos.items():
    fs.sort()
    imgs = [np.array(Image.open(os.path.join(pasta, f)).convert('RGBA')) for _, f in fs]
    # o alto do desenho de cada quadro, na altura do maior quadro (as animações mudam de tamanho, centradas)
    H = max(a.shape[0] for a in imgs)
    topo = [int(np.nonzero((a[..., 3] > 0).any(1))[0].min()) + (H - a.shape[0]) // 2 for a in imgs]
    for i, (a, (_, f)) in enumerate(zip(imgs, fs)):
        antes = a.copy()
        if TETO is not None:
            corte = topo[0] - TETO - (H - a.shape[0]) // 2
            if corte > 0: a[:corte] = 0
        viz = [topo[j] for j in (i - 1, (i + 1) % len(fs)) if 0 <= j < len(fs) and j != i]
        if not TRANSICAO and len(viz) == 2 and topo[i] <= min(viz) - PICO:
            corte = min(viz) - 1 - (H - a.shape[0]) // 2
            a[:max(0, corte)] = 0
        bri = brilhos(a)
        if bri.any():
            bom = (a[..., 3] > 20) & ~bri
            _, (iy, ix) = ndimage.distance_transform_edt(~bom, return_indices=True)
            a[bri] = a[iy[bri], ix[bri]]
        a[fora_do_contorno(a)] = 0
        a[toco_por_fora(a)] = 0
        consertar_cinza(a)
        a[soltos(a)] = 0
        if not np.array_equal(a, antes):
            Image.fromarray(a).save(os.path.join(pasta, f)); mudou += 1
print(f'{mudou} quadro(s) limpos em {pasta}')
