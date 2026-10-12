"""O COELHO QUE NÃO MINERA (12/10/2026). Pedido dele: "um coelho minerando uma pedra, na sequência um símbolo
de proibido, seguido de 'O Syden é gratuito, não mineramos seus dados'".

A cena, em pixel art montada por código como o jogo da call (ver ../demonstracao/jogo-animado.py, de onde
vem o coelho de cachecol): numa ilha flutuante, o coelho dá picaretadas numa pedra, e a cada golpe saltam
lascas e "bits" azuis — os dados. Depois o símbolo de proibido cai sobre a pedra, a picareta some e sobe um
coração. A frase NÃO vai na imagem: mora no HTML, para ser traduzida nos 72 idiomas do site.

    python e2e/pixel-art/mineracao/mineracao.py

Escreve web/site/mineracao.webp (animada) e web/site/mineracao-parada.webp (para quem pediu menos
movimento). Precisa de Pillow, numpy e do ffmpeg no PATH.
"""

import math
import random
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

AQUI = Path(__file__).parent
DEMO = AQUI.parent / "demonstracao"
SITE = AQUI.parent.parent.parent / "web" / "site"
W, H = 96, 64
FPS, SEGUNDOS = 12, 5
QUADROS = FPS * SEGUNDOS
ESCALA = 6  # um pixel da cena em pixels da imagem do site

sys.path.insert(0, str(DEMO))
import importlib.util  # noqa: E402

_spec = importlib.util.spec_from_file_location("jogo_animado", DEMO / "jogo-animado.py")
jogo = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(jogo)

# A paleta do jogo: a grama dourada do pôr do sol e a terra avermelhada.
COR = {
    "contorno": (42, 20, 20),
    "grama-clara": (240, 172, 64),
    "grama": (208, 128, 36),
    "grama-escura": (150, 88, 30),
    "folha": (156, 154, 52),
    "terra-clara": (140, 74, 38),
    "terra": (110, 52, 32),
    "terra-escura": (74, 34, 24),
    "cipo": (122, 138, 42),
    "pedra-clara": (176, 170, 186),
    "pedra": (128, 122, 142),
    "pedra-escura": (84, 78, 98),
    "cabo": (140, 90, 43),
    "cabo-escuro": (90, 58, 28),
    "ferro-claro": (214, 222, 232),
    "ferro": (140, 150, 166),
    "bit": (96, 200, 255),
    "bit-claro": (200, 240, 255),
    "proibido": (232, 58, 72),
    "proibido-escuro": (150, 24, 40),
}


def px(a, x, y, cor, alfa=255):
    if 0 <= x < W and 0 <= y < H:
        a[y, x, :3] = COR[cor] if isinstance(cor, str) else cor
        a[y, x, 3] = alfa


def ilha():
    """A ilha flutuante: grama no topo, terra embaixo afinando, e cipós pendurados. Sorteio com semente fixa:
    a ilha é a mesma em todo quadro e em toda execução."""
    rnd = random.Random(7)
    a = np.zeros((H, W, 4), "uint8")
    x0, x1, topo = 8, 88, 46
    for x in range(x0, x1):
        # a parte de baixo afina para as pontas, com o fundo irregular
        meio = (x - x0) / (x1 - x0)
        fundo = topo + 4 + int(10 * math.sin(math.pi * meio) ** 0.7) + rnd.choice([0, 0, 1])
        for y in range(topo, fundo + 1):
            if y == topo or y == topo + 1:
                cor = "grama-clara" if y == topo else "grama"
            elif y == topo + 2:
                cor = "grama-escura"
            else:
                cor = rnd.choice(["terra", "terra", "terra", "terra-clara", "terra-escura"])
            px(a, x, y, cor)
        px(a, x, fundo + 1, "contorno")
        # tufos de grama por cima
        if rnd.random() < 0.35:
            px(a, x, topo - 1, rnd.choice(["grama-clara", "folha"]))
            if rnd.random() < 0.3:
                px(a, x, topo - 2, "folha")
    for y in range(topo, topo + 6):
        px(a, x0 - 1, y, "contorno")
        px(a, x1, y, "contorno")
    # cipós
    for cx in (20, 34, 61, 74):
        comp = rnd.randint(3, 7)
        base = topo + 4 + int(10 * math.sin(math.pi * (cx - x0) / (x1 - x0)) ** 0.7)
        for k in range(comp):
            px(a, cx + (1 if k % 3 == 2 else 0), base + 2 + k, "cipo")
    return Image.fromarray(a)


# As letras da pedra: O contorno, P pedra, p pedra escura. (jogo.desenho só conhece as cores dele.)
jogo.CORES.update({"P": COR["pedra"], "p": COR["pedra-escura"], "L": COR["pedra-clara"]})
PEDRA = jogo.desenho(
    [
        "......OOOOO.......",
        "....OOpPLLpOO.....",
        "...OpPLLPPPPpO....",
        "..OpPLPPpPPPPpO...",
        ".OpPPPPpppPPPPpO..",
        ".OPPPPPPpPPPPPPpO.",
        "OpPPPPPPPPPPLPPpO.",
        "OpPPpPPPPPPPPpPppO",
        "OPPpppPPPPPPPpppPO",
        "OPPPpPPPPPPPPPpPPO",
        "OpPPPPPPPPPPPPPPpO",
        ".OppPPPPPPPPPPppO.",
        "..OOOOOOOOOOOOOO..",
    ]
)


def linha(a, x0, y0, x1, y1, cor):
    """Bresenham: a linha de pixel, sem suavizar."""
    x0, y0, x1, y1 = map(int, map(round, (x0, y0, x1, y1)))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        px(a, x0, y0, cor)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def picareta(a, gx, gy, angulo):
    """A picareta pela empunhadura (gx, gy), girada `angulo` graus (0 = para a direita, negativo = para cima)."""
    r = math.radians(angulo)
    cx, cy = gx + 13 * math.cos(r), gy + 13 * math.sin(r)
    # o cabo, com um pixel de sombra
    linha(a, gx, gy + 1, cx, cy + 1, "cabo-escuro")
    linha(a, gx, gy, cx, cy, "cabo")
    # a cabeça: um arco perpendicular ao cabo, com as pontas curvadas para a frente
    px_, py_ = -math.sin(r), math.cos(r)
    pontos = []
    for k in range(-6, 7):
        curva = 0.12 * (k * k) / 6
        pontos.append((cx + px_ * k - math.cos(r) * curva, cy + py_ * k - math.sin(r) * curva))
    for x, y in pontos:
        px(a, int(round(x)), int(round(y)) + 1, "contorno")
    for x, y in pontos:
        px(a, int(round(x)), int(round(y)), "ferro")
    for x, y in pontos[4:9]:
        px(a, int(round(x)), int(round(y)), "ferro-claro")


def proibido(a, cx, cy, raio):
    """O círculo cortado, desenhado pixel a pixel: anel vermelho, faixa na diagonal, contorno escuro."""
    if raio <= 0:
        return
    grossura = max(2, raio // 7)
    for y in range(H):
        for x in range(W):
            d = math.hypot(x - cx, y - cy)
            # a faixa: do canto de cima à esquerda ao de baixo à direita
            dist_faixa = abs((x - cx) - (y - cy)) / math.sqrt(2)
            no_anel = raio - grossura <= d <= raio
            na_faixa = d < raio - grossura and dist_faixa <= grossura * 0.8
            borda = (raio < d <= raio + 1) or (raio - grossura - 1 <= d < raio - grossura and dist_faixa > grossura * 0.8 + 1)
            if no_anel or na_faixa:
                sombra = (x - cx) + (y - cy) > raio * 0.9
                px(a, x, y, "proibido-escuro" if sombra else "proibido")
            elif borda:
                px(a, x, y, "contorno", 220)


def montar(pasta):
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    base.alpha_composite(ilha())
    originais = jogo.quadros_originais()
    mediana = np.median(np.stack(originais), axis=0).astype(int)
    coelho = jogo.recortar_coelho(originais[0], mediana)  # a pose 1, de pé, olhando para a direita
    pedra_x, pedra_y = 60, 46 - PEDRA.height
    coelho_x, coelho_y = 26, 46 - coelho.height
    empunhadura = (coelho_x + 21, coelho_y + 13)

    # os golpes: 4 ciclos de 0,5 s (sobe em 4 quadros, desce em 2)
    angulos_do_golpe = [-70, -100, -125, -125, -40, 25]
    rnd = random.Random(3)
    voando = []  # (x, y, vx, vy, cor, nasceu)
    for q in range(QUADROS):
        t = q / FPS
        im = base.copy()
        a = np.array(im)
        minerando = t < 2.2
        angulo = angulos_do_golpe[q % 6] if minerando else 40
        # o golpe acerta: lascas cinza e bits azuis saem da pedra
        if minerando and q % 6 == 5:
            for _ in range(3):
                voando.append([pedra_x + 2, pedra_y + 5, -rnd.uniform(0.3, 1.2), -rnd.uniform(1.2, 2.2), "pedra-clara", q])
            for _ in range(3):
                voando.append([pedra_x + 4, pedra_y + 3, rnd.uniform(-0.6, 1.0), -rnd.uniform(1.6, 2.6), "bit", q])
        im = Image.fromarray(a)
        im.alpha_composite(PEDRA, (pedra_x, pedra_y))
        im.alpha_composite(coelho, (coelho_x, coelho_y))
        a = np.array(im)
        # Depois do último golpe a picareta sai de cena: deitada no chão, de lado, ela virava um risco.
        if minerando:
            picareta(a, *empunhadura, angulo)
        # o que voa cai com gravidade e some em ~1 s
        vivos = []
        for v in voando:
            idade = q - v[5]
            if idade > 12:
                continue
            x = v[0] + v[2] * idade
            y = v[1] + v[3] * idade + 0.18 * idade * idade
            if v[4] == "bit":
                px(a, int(x), int(y), "bit-claro" if idade % 2 else "bit")
                px(a, int(x) + 1, int(y), "bit")
                px(a, int(x), int(y) + 1, "bit")
            else:
                px(a, int(x), int(y), "pedra-clara")
            vivos.append(v)
        voando = vivos
        # o proibido entra com um pulo (passa do tamanho e volta) e fica
        if t >= 2.3:
            p = min(1.0, (t - 2.3) / 0.35)
            raio = int(16 * (p * 1.12 if p < 0.8 else 1.12 - (p - 0.8) * 0.6))
            # Sobre a PEDRA, e não sobre o coelho: o proibido é minerar; o coelho fica à vista, aliviado.
            proibido(a, pedra_x + 9, pedra_y + 5, max(4, raio))
        im = Image.fromarray(a)
        # e o coelho, aliviado, ganha um coração
        if 3.2 <= t < 4.7:
            subida = (t - 3.2) * 6
            im.alpha_composite(jogo.CORACAO, (coelho_x + 6, int(coelho_y - 8 - subida)))
        # some no fim do laço, para o recomeço não ser seco
        if t >= 4.7:
            fade = np.array(im)
            fade[..., 3] = (fade[..., 3] * max(0.0, 1 - (t - 4.7) / 0.3)).astype("uint8")
            im = Image.fromarray(fade)
        im.resize((W * ESCALA, H * ESCALA), Image.NEAREST).save(pasta / f"q{q:03d}.png")


def main():
    with tempfile.TemporaryDirectory() as tmp:
        pasta = Path(tmp)
        montar(pasta)
        ffmpeg = ["ffmpeg", "-y", "-loglevel", "error"]
        subprocess.run(
            ffmpeg + ["-framerate", str(FPS), "-i", str(pasta / "q%03d.png"), "-c:v", "libwebp_anim", "-lossless", "1", "-loop", "0", str(SITE / "mineracao.webp")],
            check=True,
        )
        # a parada: o proibido já inteiro, com o coração
        subprocess.run(ffmpeg + ["-i", str(pasta / f"q{int(3.8 * FPS):03d}.png"), "-c:v", "libwebp", "-lossless", "1", str(SITE / "mineracao-parada.webp")], check=True)
    for nome in ("mineracao.webp", "mineracao-parada.webp"):
        print(f"{nome}: {(SITE / nome).stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
