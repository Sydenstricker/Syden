# O BONÉ 3D COPIA O 2D (decisão dele, 09/11/2026: "o boné nos coelhos de orelha em pé deve seguir o design do 2D. Se o
# boné do 2D está na cabeça, replica no 3D"). Em vez do "maior boné que cabe sem tocar a orelha", o ALVO é o boné do 2D:
#   1. em cada uma das 4 diagonais, mede no 2D o boné (a camada) em relação ao corpo: o ponto do pescoço (onde o moletom
#      começa) e a largura da cabeça;
#   2. leva esse boné para a tela do 3D, medindo o mesmo pescoço e a mesma largura no render em pixel art sem acessório
#      (saida/pixel/<corpo>-nada-<direção>.png, do pos.py);
#   3. procura o boné 3D (onde ele senta na cabeça, a inclinação e o tamanho) cuja SILHUETA, projetada pela câmera do
#      render, mais coincide com a do 2D nas 4 diagonais ao mesmo tempo.
# Grava saida/alvo-bone-<corpo>.json, que o cena.py usa no lugar da busca antiga, e saida/alvo-bone.png para conferir.
# Precisa de: ETAPA=medir powershell -File rodar.ps1 (as medidas) e um pos.py já rodado (os renders sem acessório).
# Uso: py -3 alvo_2d.py
import os, json, math
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
PERS = os.path.normpath(os.path.join(AQUI, '..', '..'))
SAIDA = os.path.join(AQUI, 'saida')
DIRS = {'south-east': 32, 'south-west': -32, 'north-east': 148, 'north-west': -148}
CORPOS = ['mascote', 'orelha-caida']
LIMITE_ORELHA = int(os.environ.get('LIMITE_ORELHA', 3))
# a câmera do mascote.py: ortográfica, 20° de cima, 11,4 unidades em 120 px, a origem no pixel (60, 98)
U = 11.4 / 120
ELEV = math.radians(20)
CIMA = np.array([0, math.sin(ELEV), math.cos(ELEV)])


def projetar(P, graus):
    g = math.radians(graus)
    R = np.array([[math.cos(g), -math.sin(g), 0], [math.sin(g), math.cos(g), 0], [0, 0, 1]])
    Q = P @ R.T
    return np.stack([Q[:, 0] / U + 60, 98 - (Q @ CIMA) / U], 1)


def referencia(img):
    # o pescoço (a primeira linha com moletom, e o meio dela) e a largura da cabeça (a maior linha de pelo acima dele)
    a = np.array(img.convert('RGBA')).astype(int)
    al = a[..., 3] > 0
    soma = a[..., :3].sum(2)
    escuro = al & (soma > 70) & (soma < 260)   # o moletom (o contorno, quase preto, fica de fora)
    pelo = al & (soma > 420)
    cont = escuro.sum(1)
    ny = next(y for y in range(a.shape[0]) if cont[y] >= 0.45 * cont.max())
    # o meio da cabeça: a média do pelo nas 14 linhas acima do pescoço (a gola nem sempre começa no meio)
    ys_, xs_ = np.nonzero(pelo[max(0, ny - 14):ny])
    nx = xs_.mean()
    larg = max(pelo[y].sum() for y in range(max(0, ny - 30), ny))
    return nx, ny, larg


def mascara(pontos, forma=(120, 120)):
    m = np.zeros(forma, bool)
    xy = np.floor(pontos).astype(int)
    ok = (xy[:, 0] >= 0) & (xy[:, 0] < forma[1]) & (xy[:, 1] >= 0) & (xy[:, 1] < forma[0])
    m[xy[ok, 1], xy[ok, 0]] = True
    return m


# os pontos do boné no espaço dele (a boca no z = 0, a copa para +z, a aba para -y local): o volume da copa e a aba
_rng = np.random.default_rng(1)
_c = _rng.uniform(-1, 1, (5000, 3))
_c = _c[(np.linalg.norm(_c, axis=1) <= 1) & (_c[:, 2] >= 0)]
_a = _rng.uniform(0, 1, (1200, 2))


def pontos_do_bone(rx, ry, rz, t, aba_k=0.85):
    copa = _c * np.array([rx, ry, rz])
    # a aba: meia elipse para a frente, a 5° abaixo da horizontal do mundo (o cena.py faz igual: levanta = t + 9°)
    ang = math.pi + math.pi * _a[:, 0]
    L = aba_k * ry * np.maximum(0, -np.sin(ang)) ** 0.7 * _a[:, 1]
    cai = math.radians(14) - math.radians(math.degrees(t) + 9)
    aba = np.stack([rx * 1.01 * np.cos(ang) * (1 + 0.04 * _a[:, 1]), ry * 1.01 * np.sin(ang) - L * math.cos(cai),
                    -L * math.sin(cai)], 1)
    return np.vstack([copa, aba])


def para_o_mundo(Pl, O, t):
    n = np.array([0, -math.sin(t), math.cos(t)])
    yl = np.array([0, math.cos(t), math.sin(t)])
    return O + Pl[:, :1] * np.array([1.0, 0, 0]) + Pl[:, 1:2] * yl + Pl[:, 2:3] * n


# cada malha tem a sua pasta (saida/ a em T, saida-novo/ o corpo novo); o 2D de cada corpo é o do mascote ou o da
# orelha caída
LISTA = []
for pasta in ('saida', 'saida-novo'):
    for f in sorted(os.listdir(os.path.join(AQUI, pasta))) if os.path.isdir(os.path.join(AQUI, pasta)) else []:
        if f.startswith('medida-') and f.endswith('.npz'):
            LISTA.append((f[7:-4], os.path.join(AQUI, pasta)))
if os.environ.get('SO_CORPO'):
    LISTA = [x for x in LISTA if x[0] == os.environ['SO_CORPO']]
_rng2 = np.random.default_rng(2)

for corpo, SAIDA in LISTA:
    corpo2d = 'orelha-caida' if corpo.startswith('orelha-caida') else 'mascote'
    # O BONÉ DO MESHY (meshy/bone.glb), se houver: os pontos dele no espaço do boné (meia largura da copa = 1), e a
    # forma vai inteira, só na escala; senão, o provisório
    _f = os.path.join(SAIDA, 'bone-meshy.npy')
    MESHY_N = np.load(_f) if os.path.exists(_f) else None
    if MESHY_N is not None:
        MESHY_N = MESHY_N[_rng2.choice(len(MESHY_N), min(4000, len(MESHY_N)), replace=False)]
        RY_K, RZ_K = float(MESHY_N[:, 1].max()), float(MESHY_N[:, 2].max())
    else:
        RY_K, RZ_K = 1.05, 0.7

    def forma(rx, t, aba_k):
        if MESHY_N is not None:
            return MESHY_N * rx
        return pontos_do_bone(rx, 1.05 * rx, 0.7 * rx, t, aba_k)

    med = np.load(os.path.join(SAIDA, f'medida-{corpo}.npz'))
    co = med['co']
    orel = med['orel_L'] + med['orel_R']
    H = co[(med['cabeca'] + orel > 0.6) & (orel < 0.5)]
    H = H[H[:, 2] > np.percentile(H[:, 2], 35)]
    A = np.c_[2 * H, np.ones(len(H))]
    sol = np.linalg.lstsq(A, (H ** 2).sum(1), rcond=None)[0]
    C = sol[:3]
    raio = float(np.sqrt(sol[3] + C @ C))
    E = co[orel > 0.5]
    Hh = co[(med['cabeca'] > 0.6) & (orel < 0.1)]   # o crânio, para o boné não entrar nele

    # 1–2) o alvo de cada direção, na tela do 3D
    alvos = {}
    for d in DIRS:
        corpo2 = Image.open(os.path.join(PERS, corpo2d, 'baixa-120', 'animacoes', 'parado', f'{d}-0.png'))
        bone2 = np.array(Image.open(os.path.join(PERS, corpo2d, 'acessorios', 'bone', 'parado', f'{d}-0.png')).convert('RGBA'))
        # da camada, só o que é do boné (avermelhado); a camada tem 132 px, com o corpo em (6, 6)
        r_, g_, b_, a_ = [bone2[..., i].astype(int) for i in range(4)]
        so = (a_ > 0) & ((r_ > g_ + 40) | (r_ + g_ + b_ < 120))
        ys, xs = np.nonzero(so)
        xs, ys = xs - 6 + 0.5, ys - 6 + 0.5
        nx2, ny2, l2 = referencia(corpo2)
        nx3, ny3, l3 = referencia(Image.open(os.path.join(SAIDA, 'pixel', f'{corpo}-nada-{d}.png')))
        k = l3 / l2
        X = nx3 + (xs - nx2) * k
        Y = ny3 + (ys - ny2) * k
        # cada pixel do 2D vira um quadrado de k × k na tela do 3D
        sub = np.linspace(-0.5, 0.5, 4)
        pts = np.array([(x + dx * k, y + dy * k) for x, y in zip(X, Y) for dx in sub for dy in sub])
        alvos[d] = mascara(pts)

    # 3) a busca: onde o boné senta (o ângulo a do ponto na esfera da cabeça, para a frente; negativo é para trás), quanto
    # afunda (negativo: acima do alto da cabeça), a inclinação t, o tamanho rx (ry = 1,05 rx, rz = 0,7 rx) e o
    # comprimento da aba. Primeiro numa grade larga, depois fina em volta do melhor. A inclinação para trás fica em
    # até 10°: mais que isso, de costas, o boné vira um disco vermelho cobrindo a cabeça.
    def nota_de(a, t, rx, afunda, aba_k):
        ar, tr = math.radians(a), math.radians(t)
        topo = C + raio * np.array([0, -math.sin(ar), math.cos(ar)])
        n = np.array([0, -math.sin(tr), math.cos(tr)])
        rz = RZ_K * rx
        O = topo - n * rz * afunda
        # A ORELHA NÃO SAI PELA COPA NEM PELA ABA: a base pode ficar dentro do boné, mas só na metade de TRÁS, e o ponto
        # em que ela fura a copa tem de ser na parede de trás (onde, nas vistas, ela parece sair de trás do boné)
        yl = np.array([0, math.cos(tr), math.sin(tr)])
        q = E - O
        lx, ly, lz = q[:, 0] / rx, (q @ yl) / (RY_K * rx), (q @ n) / rz
        dd = np.sqrt(lx ** 2 + ly ** 2 + lz ** 2)
        dxy = np.sqrt(lx ** 2 + ly ** 2)
        dentro_na_frente = (dd < 1) & (ly < -0.3)
        fura_em_cima = (dd >= 1) & (dd < 1.25) & (dxy < 0.95) & (lz > 0) & (ly < 0.0)
        if dentro_na_frente.sum() + fura_em_cima.sum() > LIMITE_ORELHA:
            return -1.0, O
        # O BONÉ NÃO ENTRA NA CABEÇA: a cabeça acima da boca fica dentro da copa (senão ela sai pela copa e o boné some
        # dentro dela), e a aba fica fora da cabeça
        qh = Hh - O
        hx, hy, hz = qh[:, 0] / rx, (qh @ yl) / (RY_K * rx), (qh @ n) / rz
        acima = (hz > 0.05) & (hx ** 2 + hy ** 2 < 1)
        if np.any(np.sqrt(hx ** 2 + hy ** 2 + hz ** 2)[acima] > 1.03):
            return -1.0, O
        Pl = forma(rx, tr, aba_k)
        P = para_o_mundo(Pl, O, tr)
        aba = P[Pl[:, 1] < -RY_K * rx]
        if len(aba) and np.mean(np.linalg.norm(aba - C, axis=1) < 0.97 * raio) > 0.02:
            return -1.0, O
        nota = 0.0
        for d, g in DIRS.items():
            m = mascara(projetar(P, g))
            nota += (m & alvos[d]).sum() / max((m | alvos[d]).sum(), 1)
        return nota, O

    def buscar(grades):
        melhor = None
        import itertools
        for a, t, rx, afunda, aba_k in itertools.product(*grades):
            nota, O = nota_de(a, t, rx, afunda, aba_k)
            if melhor is None or nota > melhor[0]:
                melhor = (nota, dict(a=float(a), t=float(t), rx=float(rx), afunda=float(afunda), aba=float(aba_k),
                                     O=O.tolist()))
        return melhor

    # O TAMANHO vem do 2D: a largura do boné na tela (a menor das 4 diagonais, que é a copa sem a aba de lado), em
    # unidades do 3D. Sem isso, num corpo de cabeça mais baixa que a do 2D (a orelha caída), a silhueta pedia um boné
    # enorme para alcançar a altura do desenho.
    # nas diagonais da frente o boné aparece inteiro (de costas, a orelha cobre um pedaço); a largura ali é a copa mais
    # um tanto da aba, de lado: 1,15 da copa
    # A forma do boné decide quanto da largura é aba: mede-se a largura na tela do boné de rx = 1, nas mesmas diagonais,
    # e o tamanho é o que dá a largura do 2D.
    larg_px = np.mean([np.ptp(np.nonzero(alvos[d].any(0))[0]) + 1 for d in ('south-east', 'south-west')])
    _P1 = para_o_mundo(forma(1.0, 0.0, 1.0), C, 0.0)
    larg1 = np.mean([np.ptp(projetar(_P1, DIRS[d])[:, 0]) for d in ('south-east', 'south-west')])
    rx0 = larg_px / larg1
    larg = larg_px * U
    print(corpo, 'largura do boné no 2D, em unidades do 3D:', round(larg, 2))
    melhor = buscar([range(-40, 61, 10), range(-10, 41, 10), np.arange(0.8 * rx0, 1.201 * rx0, 0.05 * rx0), np.arange(0.0, 0.81, 0.2),
                     (0.8, 1.05, 1.3) if MESHY_N is None else (1.0,)])   # aba de 0,8 para cima: sem ela, vira gorro
    b = melhor[1]
    melhor = buscar([np.arange(b['a'] - 8, b['a'] + 8.1, 4), np.arange(max(-10, b['t'] - 8), b['t'] + 8.1, 4),
                     np.arange(max(0.8 * rx0, b['rx'] - 0.04 * rx0), min(1.2 * rx0, b['rx'] + 0.04 * rx0) + 1e-6, 0.02 * rx0), np.arange(max(0.0, b['afunda'] - 0.15), b['afunda'] + 0.151, 0.05),
                     np.arange(max(0.8, b['aba'] - 0.2), b['aba'] + 0.21, 0.1) if MESHY_N is None else (1.0,)])
    nota, p = melhor
    t = math.radians(p['t'])
    rx = p['rx']
    fit = dict(phi=float(p['t']), O=p['O'], n=[0, -math.sin(t), math.cos(t)], fr=[0, -math.cos(t), -math.sin(t)],
               r=[rx, RY_K * rx, RZ_K * rx], aba=p['aba'], meshy=MESHY_N is not None, modo='copia-do-2d', iou_medio=round(nota / 4, 3), busca=p)
    # quanto da orelha fica dentro do boné (a base, escondida na parte de trás dele)
    O = np.array(p['O']); n_ = np.array(fit['n']); yl = -np.array(fit['fr'])
    q = E - O
    le = np.stack([q[:, 0], q @ yl, q @ n_], 1)
    dentro = np.sqrt((le[:, 0] / rx) ** 2 + (le[:, 1] / (RY_K * rx)) ** 2 + (le[:, 2] / (RZ_K * rx)) ** 2) < 1
    fit['orelha_dentro'] = int((dentro & (le[:, 2] > 0)).sum())
    json.dump(fit, open(os.path.join(SAIDA, f'alvo-bone-{corpo}.json'), 'w'), indent=1)
    print(corpo, 'IoU médio', fit['iou_medio'], p, 'orelha dentro', fit['orelha_dentro'])

    # a conferência: por direção, o alvo (do 2D) em vermelho, o boné 3D em azul, o que coincide em branco, sobre o 3D
    linha = Image.new('RGB', (120 * 4, 120), (60, 60, 70))
    P = para_o_mundo(forma(rx, t, p['aba']), O, t)
    for i, (d, g) in enumerate(DIRS.items()):
        base = Image.open(os.path.join(SAIDA, 'pixel', f'{corpo}-nada-{d}.png')).convert('RGBA')
        q_ = Image.new('RGBA', (120, 120), (60, 60, 70, 255)); q_.alpha_composite(base)
        arr = np.array(q_.convert('RGB'))
        m = mascara(projetar(P, g)); al = alvos[d]
        arr[al & ~m] = (220, 40, 40); arr[m & ~al] = (60, 120, 230); arr[m & al] = (250, 250, 250)
        linha.paste(Image.fromarray(arr), (120 * i, 0))
    linha.resize((linha.width * 3, linha.height * 3), Image.NEAREST).save(os.path.join(SAIDA, f'alvo-bone-{corpo}.png'))
