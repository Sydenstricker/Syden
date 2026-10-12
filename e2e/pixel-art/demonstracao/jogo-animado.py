"""O JOGO DA CALL DO SITE, ANIMADO POR CÓDIGO (12/10/2026).

Os quadros que vieram do PixelLab (jogo-1-anim-*.png) tinham o coelho passando por cima das moedas sem
pegá-las, e o contador parado em 03 — o relato foi "não está coletando as moedas". O gerador de imagem
desenha movimento, não entende o jogo. Aqui o jogo é montado: cenário limpo + coelho + moedas, e cada moeda
some com um brilho quando o coelho encosta, e o contador sobe.

E UM FINAL PARA LEMBRAR (pedido do mesmo dia: "algo marcante/fofo para fortalecer a marca e os coelhos"): na
borda do penhasco chega um amigo, os dois se olham, sobe um coração e aparece o balão do Syden — os três
pontos digitando, que viram coração. A conversa que vira carinho é o Syden; o coelho é o mascote (regra do
CLAUDE.md: o mascote é o personagem, o D4 é a marca e "a conversa acontecendo").

O que sai daqui vira o jogo transmitido na call do site (e2e/call-animada.mjs lê a pasta jogo-animado/).

    python e2e/pixel-art/demonstracao/jogo-animado.py

Precisa de Pillow, numpy e scipy.
"""

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

AQUI = Path(__file__).parent
SAIDA = AQUI / "jogo-animado"
W, H = 256, 144
FPS, SEGUNDOS = 12, 8
QUADROS = FPS * SEGUNDOS


# ---------------------------------------------------------------------------------------------------
# 1. O CENÁRIO LIMPO E OS RECORTES DO COELHO, a partir dos quadros que já estão no repositório.
# ---------------------------------------------------------------------------------------------------


def quadros_originais():
    nomes = [AQUI / f"jogo-1-anim-{i}.png" for i in range(1, 10)] + [AQUI / "jogo-1.png"]
    return [np.array(Image.open(n).convert("RGB")).astype(int) for n in nomes]


def cenario_limpo(originais):
    """A mediana dos quadros apaga o que anda (o coelho, os inimigos). As moedas mexem pouco e ficam: saem
    à mão, preenchidas na direção em que os dois lados do buraco combinam (a encosta da montanha é diagonal),
    e um filtro de maioria tira o xadrez que sobra onde o sol encontra a nuvem."""
    med = np.median(np.stack(originais), axis=0).astype(int)
    r, g, b = med[..., 0], med[..., 1], med[..., 2]
    amarelo = (r > 200) & (g > 150) & (b < 120)
    regiao = np.zeros((H, W), bool)
    regiao[40:75, 118:196] = True
    rotulos, n = ndimage.label(amarelo & regiao)
    centros = ndimage.center_of_mass(amarelo & regiao, rotulos, range(1, n + 1))
    yy, xx = np.mgrid[0:H, 0:W]
    buraco = np.zeros((H, W), bool)
    for cy, cx in centros:
        buraco |= ((yy - cy) ** 2 / 6.5**2 + (xx - cx) ** 2 / 5.5**2) <= 1

    im = med.copy()
    direcoes = [(0, 1), (1, 0), (1, 1), (1, -1), (1, 2), (2, 1), (1, -2), (2, -1)]
    for y, x in zip(*np.nonzero(buraco)):
        melhor = None
        for dy, dx in direcoes:
            pontas = []
            for s in (1, -1):
                k = 1
                while True:
                    py, px = y + s * dy * k, x + s * dx * k
                    if not (0 <= py < H and 0 <= px < W):
                        pontas.append(None)
                        break
                    if not buraco[py, px]:
                        pontas.append((k, med[py, px]))
                        break
                    k += 1
            if None in pontas:
                continue
            (k1, c1), (k2, c2) = pontas
            dif = np.abs(c1 - c2).sum()
            if melhor is None or dif < melhor[0]:
                melhor = (dif, c1 if k1 <= k2 else c2)
        if melhor:
            im[y, x] = melhor[1]
    for _ in range(4):
        novo = im.copy()
        for y, x in zip(*np.nonzero(buraco)):
            viz = [tuple(im[y + dy, x + dx]) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if 0 <= y + dy < H and 0 <= x + dx < W]
            valores, conta = np.unique(np.array(viz), axis=0, return_counts=True)
            novo[y, x] = valores[conta.argmax()]
        im = novo

    # O contador do canto ("03") sai: o número é desenhado aqui, e sobe com as moedas. As faixas do céu
    # ali são horizontais, então a coluna ao lado, na mesma linha, é o fundo certo.
    for y in range(8, 21):
        im[y, 5:19] = im[y, 21]
    return med, im


def recortar_coelho(quadro, mediana):
    """O coelho de um quadro: o que difere do cenário, na peça com mais creme. Sem os tons de moeda que vêm
    grudados, e só a maior peça conectada."""
    dif = np.abs(quadro - mediana).sum(2) > 70
    creme = (quadro[..., 0] > 215) & (quadro[..., 1] > 195) & (quadro[..., 2] > 150) & (quadro[..., 2] < 235)
    rotulos, n = ndimage.label(ndimage.binary_dilation(dif, iterations=1))
    k = max(range(1, n + 1), key=lambda k: ((rotulos == k) & creme).sum())
    peca = (rotulos == k) & dif
    r, g, b = quadro[..., 0], quadro[..., 1], quadro[..., 2]
    moeda = (r > 120) & (b < 75) & (g > 55) & (g < 0.85 * r) & ~((r > 150) & (g < 80))
    peca &= ~moeda
    rotulos, n = ndimage.label(peca, structure=np.ones((3, 3)))
    tamanhos = ndimage.sum(peca, rotulos, range(1, n + 1))
    peca = rotulos == (int(np.argmax(tamanhos)) + 1)
    ys, xs = np.nonzero(peca)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), "uint8")
    rgba[..., :3] = quadro[y0:y1, x0:x1]
    rgba[..., 3] = peca[y0:y1, x0:x1] * 255
    return Image.fromarray(rgba)


def cachecol_azul(sprite):
    """O amigo: o mesmo coelho, de cachecol azul. Só os vermelhos do cachecol mudam de cor."""
    a = np.array(sprite).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    vermelho = (r > 110) & (g < 90) & (b < 100) & (r > g + 50)
    claro = r / 255.0
    a[vermelho, 0] = (40 * claro[vermelho]).astype(int)
    a[vermelho, 1] = (120 * claro[vermelho] + 20).astype(int)
    a[vermelho, 2] = (230 * claro[vermelho] + 20).clip(0, 255).astype(int)
    return Image.fromarray(a.astype("uint8"))


# ---------------------------------------------------------------------------------------------------
# 2. OS DESENHOS FEITOS À MÃO: moeda, brilho, coração, balão do Syden e os números do contador.
# ---------------------------------------------------------------------------------------------------

# A paleta da moeda é a da moeda original (contorno, amarelo, meio-tom, sombra, brilho).
CORES = {
    "O": (66, 35, 29),
    "Y": (251, 235, 83),
    "M": (249, 180, 45),
    "S": (232, 118, 31),
    "H": (254, 250, 216),
    # coração
    "R": (234, 58, 72),
    "P": (255, 160, 170),
    "D": (44, 21, 20),
    # balão do Syden: o creme e o azul-noite da marca
    "C": (243, 235, 216),
    "N": (30, 37, 51),
    # brilho
    "W": (255, 255, 240),
}


def desenho(linhas):
    h, w = len(linhas), max(len(l) for l in linhas)
    a = np.zeros((h, w, 4), "uint8")
    for y, linha in enumerate(linhas):
        for x, ch in enumerate(linha):
            if ch in CORES:
                a[y, x, :3] = CORES[ch]
                a[y, x, 3] = 255
    return Image.fromarray(a)


MOEDA = [
    desenho(["..OOOO..", ".OHYYMO.", "OHYYYYSO", "OYYMYYSO", "OYYMYYSO", "OYYMYYSO", "OYYMYYSO", "OMYYYSSO", ".OMSSSO.", "..OOOO.."]),
    desenho(["..OO..", ".OHYO.", "OHYYSO", "OYMYSO", "OYMYSO", "OYMYSO", "OYMYSO", "OMYSSO", ".OSSO.", "..OO.."]),
    desenho([".OO.", "OHSO", "OYSO", "OYSO", "OYSO", "OYSO", "OYSO", "OYSO", "OSSO", ".OO."]),
    desenho(["..OO..", ".OHYO.", "OHYYSO", "OYMYSO", "OYMYSO", "OYMYSO", "OYMYSO", "OMYSSO", ".OSSO.", "..OO.."]),
]

BRILHO = [
    desenho(["...", ".W.", "..."]),
    desenho(["..W..", "..Y..", "WYWYW", "..Y..", "..W.."]),
    desenho(["...W...", "...Y...", ".......", "WY...YW", ".......", "...Y...", "...W..."]),
    desenho(["...W...", ".......", ".......", "W.....W", ".......", ".......", "...W..."]),
]

CORACAO = desenho([".DD.DD.", "DRPDRRD", "DRRRRRD", ".DRRRD.", "..DRD..", "...D..."])

BALAO = [
    # 0: os três pontos, cada um num quadro de cima (digitando)
    [
        "..NNNNNNNNNNNNN..",
        ".NCCCCCCCCCCCCCN.",
        "NCCCCCCCCCCCCCCCN",
        "NCC{0}{0}CCC{1}{1}CCC{2}{2}CCN",
        "NCC{0}{0}CCC{1}{1}CCC{2}{2}CCN",
        "NCC{3}{3}CCC{4}{4}CCC{5}{5}CCN",
        "NCCCCCCCCCCCCCCCN",
        ".NCCCCCCCCCCCCCN.",
        ".NCNNNNNNNNNNNNN.",
        ".NN..............",
    ],
]
BALAO_CORACAO = desenho(
    [
        "..NNNNNNNNNNNNN..",
        ".NCCCCCCCCCCCCCN.",
        "NCCCCCRRCRRCCCCCN",
        "NCCCCRPRRRRRCCCCN",
        "NCCCCRRRRRRRCCCCN",
        "NCCCCCRRRRRCCCCCN",
        "NCCCCCCRRRCCCCCCN",
        ".NCCCCCCRCCCCCCN.",
        ".NCNNNNNNNNNNNNN.",
        ".NN..............",
    ]
)


def balao_digitando(quadro):
    """Os três pontos sobem um de cada vez, como no 'fulano está digitando' do app."""
    qual = (quadro // 3) % 4  # 3 = pausa, nenhum em cima
    cima = ["N" if (i == qual) else "C" for i in range(3)]
    baixo = ["C" if (i == qual) else "N" for i in range(3)]
    linhas = [l.format(*cima, *baixo) for l in BALAO[0]]
    return desenho(linhas)


# Números 3×5, desenhados em creme com contorno escuro, como os do contador original.
DIGITOS = {
    "0": ["###", "#.#", "#.#", "#.#", "###"],
    "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"],
    "3": ["###", "..#", ".##", "..#", "###"],
    "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "###", "..#", "###"],
}


def numero(texto):
    w = len(texto) * 4 + 1
    a = np.zeros((7, w, 4), "uint8")
    for i, ch in enumerate(texto):
        for y, linha in enumerate(DIGITOS[ch]):
            for x, c in enumerate(linha):
                if c == "#":
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + 1 + dy, i * 4 + x + 1 + dx
                            if a[yy, xx, 3] == 0:
                                a[yy, xx] = (44, 21, 20, 255)
        for y, linha in enumerate(DIGITOS[ch]):
            for x, c in enumerate(linha):
                if c == "#":
                    a[y + 1, i * 4 + x + 1] = (254, 244, 214, 255)
    return Image.fromarray(a)


# ---------------------------------------------------------------------------------------------------
# 3. O ROTEIRO: por onde o coelho passa, onde ficam as moedas, e o final.
# ---------------------------------------------------------------------------------------------------

# Onde se pisa (o pé do coelho): a plataforma da esquerda, o pilar do meio e o penhasco da direita.
CHAO_ESQ, CHAO_PILAR, CHAO_DIR = 86, 78, 79


def trecho(t, de, ate):
    return min(1.0, max(0.0, (t - de) / (ate - de)))


def pulo(p, x0, y0, x1, y1, altura):
    """Uma parábola do pé: sai de (x0, y0), chega a (x1, y1) e sobe `altura` acima do mais alto dos dois."""
    x = x0 + (x1 - x0) * p
    topo = min(y0, y1) - altura
    # y(p) = (1-p)·y0 + p·y1 − 4·h·p(1−p), com h ajustado para passar pelo topo no meio
    h = topo - (y0 + y1) / 2
    y = (1 - p) * y0 + p * y1 + 4 * h * p * (1 - p)
    return x, y


def onde_esta(t):
    """O pé do coelho no instante t (segundos), e se ele está no ar."""
    if t < 1.0:
        return 44 + 40 * trecho(t, 0, 1.0), CHAO_ESQ, False
    if t < 2.0:
        x, y = pulo(trecho(t, 1.0, 2.0), 84, CHAO_ESQ, 128, CHAO_PILAR, 26)
        return x, y, True
    if t < 2.33:
        return 128 + 6 * trecho(t, 2.0, 2.33), CHAO_PILAR, False
    if t < 3.66:
        x, y = pulo(trecho(t, 2.33, 3.66), 134, CHAO_PILAR, 196, CHAO_DIR, 34)
        return x, y, True
    if t < 4.1:
        return 196 + 4 * trecho(t, 3.66, 4.1), CHAO_DIR, False
    return 200, CHAO_DIR, False


# As moedas ficam no caminho do coelho: no meio do corpo dele, em pontos dos dois pulos.
def _moedas():
    pontos = []
    for p in (0.4, 0.75):
        x, y = pulo(p, 84, CHAO_ESQ, 128, CHAO_PILAR, 26)
        pontos.append((x, y - 12, 1.0 + p * 1.0))
    for p in (0.25, 0.5, 0.75):
        x, y = pulo(p, 134, CHAO_PILAR, 196, CHAO_DIR, 34)
        pontos.append((x, y - 12, 2.33 + p * 1.33))
    return pontos


MOEDAS = _moedas()  # (x, y, instante em que o coelho passa)


def colar(quadro, sprite, x, y):
    """Cola com x, y no CANTO de cima à esquerda, arredondado para o pixel."""
    quadro.alpha_composite(sprite, (int(round(x)), int(round(y))))


def montar():
    originais = quadros_originais()
    mediana, cenario = cenario_limpo(originais)
    cenario = Image.fromarray(cenario.astype("uint8")).convert("RGBA")
    poses = {i: recortar_coelho(originais[i - 1], mediana) for i in (1, 2, 4, 6)}
    corrida = [poses[1], poses[2], poses[4], poses[2]]
    no_ar = poses[6]
    parado = poses[1]
    amigo_parado = cachecol_azul(parado).transpose(Image.FLIP_LEFT_RIGHT)
    amigo_corrida = [cachecol_azul(p).transpose(Image.FLIP_LEFT_RIGHT) for p in corrida]

    SAIDA.mkdir(exist_ok=True)
    for velho in SAIDA.glob("q*.png"):
        velho.unlink()

    for q in range(QUADROS):
        t = q / FPS
        im = cenario.copy()

        # As moedas que ainda não foram pegas giram; a pega vira um brilho de quatro quadros.
        pegas = 0
        for i, (mx, my, quando) in enumerate(MOEDAS):
            if t < quando:
                m = MOEDA[(q // 2 + i) % len(MOEDA)]
                colar(im, m, mx - m.width / 2, my - m.height / 2 + (1 if (q // 4 + i) % 2 else 0))
            else:
                pegas += 1
                k = int((t - quando) * FPS)
                if k < len(BRILHO):
                    b = BRILHO[k]
                    colar(im, b, mx - b.width / 2, my - b.height / 2)

        # O contador sobe com cada moeda, e pisca na hora em que sobe.
        n = numero(f"{pegas:02d}")
        acabou_de_pegar = any(0 <= t - quando < 0.25 for _, _, quando in MOEDAS)
        colar(im, n, 6, 9 - (1 if acabou_de_pegar else 0))

        # O coelho.
        fx, fy, no_ar_agora = onde_esta(t)
        if no_ar_agora:
            s = no_ar
        elif t < 4.1:
            s = corrida[(q // 2) % len(corrida)]
        else:
            s = parado
        pulinho = 0
        if 6.2 <= t < 6.45:  # os dois dão um pulinho quando o balão vira coração
            pulinho = 2
        colar(im, s, fx - s.width / 2, fy - s.height - pulinho)

        # O amigo chega correndo pela direita, de cachecol azul, e para olhando para ele.
        if t >= 3.9:
            p = trecho(t, 3.9, 4.8)
            ax = 272 - (272 - 232) * p
            a = amigo_corrida[(q // 2) % len(amigo_corrida)] if p < 1 else amigo_parado
            colar(im, a, ax - a.width / 2, CHAO_DIR - a.height - pulinho)

        # Um coração sobe entre os dois.
        if 4.9 <= t < 6.0:
            p = trecho(t, 4.9, 6.0)
            colar(im, CORACAO, 216 - CORACAO.width / 2, 56 - 12 * p)

        # O balão do Syden: os três pontos digitando, e depois o coração dentro dele.
        if t >= 5.3:
            bx, by = 216, 36
            if t < 6.2:
                b = balao_digitando(q)
            else:
                b = BALAO_CORACAO
                if 6.2 <= t < 6.35:  # o coração entra com um pulso
                    by -= 1
            colar(im, b, bx - b.width / 2, by)

        # Escurece no fim do laço e clareia no começo: o pulo de volta à esquerda não fica seco.
        escuro = max(trecho(t, 7.6, 8.0), 1 - trecho(t, 0, 0.25))
        if escuro > 0:
            noite = Image.new("RGBA", im.size, (20, 12, 30, int(200 * escuro)))
            im.alpha_composite(noite)

        im.convert("RGB").save(SAIDA / f"q{q:03d}.png")
    print(f"{QUADROS} quadros em {SAIDA}")


if __name__ == "__main__":
    montar()
