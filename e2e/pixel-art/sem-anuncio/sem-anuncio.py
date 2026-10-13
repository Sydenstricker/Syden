"""O COELHO SEM ANÚNCIO (13/10/2026). Troca a cena da mineração no site (#dados), por decisão do Sydenstricker: com o
Termo rodando dentro do Syden (e o Google Analytics dele), "não mineramos seus dados" deixou de ser a frase mais
precisa. A promessa exata é a da Microsoft Store: SEM ANÚNCIOS.

A cena reaproveita a ilha, o coelho de cachecol, o proibido e o coração da mineração (../mineracao/mineracao.py):
o coelho está na ilha, e janelinhas de anúncio pipocam em volta dele, piscando. O proibido cai sobre elas, elas se
desfazem em pixels, e o coelho ganha o coração. Nenhum texto na imagem: a frase mora no HTML, para ser traduzida.

    python e2e/pixel-art/sem-anuncio/sem-anuncio.py

Escreve web/site/sem-anuncio.webp (animada) e web/site/sem-anuncio-parada.webp (para quem pediu menos movimento).
Precisa de Pillow, numpy e do ffmpeg no PATH.
"""

import importlib.util
import math
import random
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

AQUI = Path(__file__).parent
_spec = importlib.util.spec_from_file_location("mineracao", AQUI.parent / "mineracao" / "mineracao.py")
m = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m)
jogo = m.jogo

W, H, FPS, ESCALA, SITE = m.W, m.H, m.FPS, m.ESCALA, m.SITE
SEGUNDOS = 5
QUADROS = FPS * SEGUNDOS

m.COR.update(
    {
        "janela": (238, 232, 220),
        "janela-sombra": (196, 188, 176),
        "barra": (79, 125, 245),
        "barra-clara": (140, 172, 255),
        "fechar": (229, 72, 77),
        "estrela": (255, 208, 64),
        "estrela-clara": (255, 244, 170),
        "estrela-escura": (232, 130, 40),
        "rosa": (232, 118, 181),
        "verde": (63, 178, 127),
    }
)

# As janelinhas: (x, y do canto, largura, altura, quando pipoca em s, cor do miolo que pisca).
JANELAS = [
    (52, 14, 20, 15, 0.25, "estrela"),
    (70, 26, 18, 13, 0.75, "rosa"),
    (56, 31, 16, 12, 1.25, "verde"),
    (74, 8, 15, 12, 1.65, "estrela"),
]
QUANDO_CAI = 2.4
CENTRO = (69, 24)


def janela(a, x0, y0, w, h, miolo, piscando):
    """Uma janela de anúncio em pixel: contorno, barra azul com o X vermelho, e no miolo uma estrela que pisca."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            borda = x in (x0, x0 + w - 1) or y in (y0, y0 + h - 1)
            if borda:
                m.px(a, x, y, "contorno")
            elif y <= y0 + 3:
                m.px(a, x, y, "barra-clara" if y == y0 + 1 else "barra")
            else:
                m.px(a, x, y, "janela-sombra" if y == y0 + h - 2 else "janela")
    # o X de fechar, que ninguém consegue achar
    fx = x0 + w - 5
    for d in range(3):
        m.px(a, fx + d, y0 + 1 + d, "fechar")
        m.px(a, fx + 2 - d, y0 + 1 + d, "fechar")
    # a estrela do miolo: um losango com raios, que troca de cor para chamar atenção
    cx, cy = x0 + w // 2, y0 + 4 + (h - 5) // 2
    r = max(2, min(w, h - 5) // 3)
    cor, clara = (miolo, "estrela-clara") if piscando else ("estrela-escura", miolo)
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if abs(x - cx) + abs(y - cy) <= r:
                m.px(a, x, y, clara if abs(x - cx) + abs(y - cy) < r - 1 else cor)
    for dx, dy in ((r + 1, 0), (-r - 1, 0), (0, r + 1), (0, -r - 1)):
        m.px(a, cx + dx, cy + dy, cor)


def montar(pasta):
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    base.alpha_composite(m.ilha())
    originais = jogo.quadros_originais()
    mediana = np.median(np.stack(originais), axis=0).astype(int)
    coelho = jogo.recortar_coelho(originais[0], mediana)
    coelho_x, coelho_y = 24, 46 - coelho.height

    rnd = random.Random(5)
    pedacos = []  # os pixels das janelas que estouram: (x, y, vx, vy, cor)
    for x0, y0, w, h, _, miolo in JANELAS:
        for _ in range(14):
            pedacos.append(
                (
                    rnd.uniform(x0, x0 + w),
                    rnd.uniform(y0, y0 + h),
                    rnd.uniform(-1.4, 1.4),
                    rnd.uniform(-2.0, 0.2),
                    rnd.choice(["janela", "barra", "fechar", miolo, "estrela-clara"]),
                )
            )

    for q in range(QUADROS):
        t = q / FPS
        im = base.copy()
        im.alpha_composite(coelho, (coelho_x, coelho_y))
        a = np.array(im)
        if t < QUANDO_CAI + 0.15:
            for i, (x0, y0, w, h, nasce, miolo) in enumerate(JANELAS):
                if t < nasce:
                    continue
                # pipoca: nasce pequena, passa do tamanho e volta, e depois treme de leve
                p = min(1.0, (t - nasce) / 0.25)
                escala = p * 1.15 if p < 0.8 else 1.15 - (p - 0.8) * 0.75
                ww, hh = max(3, int(w * escala)), max(3, int(h * escala))
                tremor = (1 if (q + i) % 4 == 0 else 0) if p >= 1 else 0
                janela(a, x0 + (w - ww) // 2 + tremor, y0 + (h - hh) // 2, ww, hh, miolo, (q // 3 + i) % 2 == 0)
        else:
            # as janelas estouram em pixels que caem
            idade = (t - QUANDO_CAI - 0.15) * FPS
            if idade < 14:
                for x, y, vx, vy, cor in pedacos:
                    m.px(a, int(x + vx * idade), int(y + vy * idade + 0.2 * idade * idade), cor)
        if t >= QUANDO_CAI:
            p = min(1.0, (t - QUANDO_CAI) / 0.35)
            raio = int(19 * (p * 1.12 if p < 0.8 else 1.12 - (p - 0.8) * 0.6))
            m.proibido(a, *CENTRO, max(4, raio))
        im = Image.fromarray(a)
        if 3.2 <= t < 4.7:
            subida = (t - 3.2) * 6
            im.alpha_composite(jogo.CORACAO, (coelho_x + 6, int(coelho_y - 8 - subida)))
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
            ffmpeg + ["-framerate", str(FPS), "-i", str(pasta / "q%03d.png"), "-c:v", "libwebp_anim", "-lossless", "1", "-loop", "0", str(SITE / "sem-anuncio.webp")],
            check=True,
        )
        # a parada: as janelas ainda no ar e o proibido já inteiro por cima — a promessa inteira numa imagem só
        subprocess.run(ffmpeg + ["-i", str(pasta / f"q{int((QUANDO_CAI + 0.1) * FPS):03d}.png"), "-c:v", "libwebp", "-lossless", "1", str(SITE / "sem-anuncio-parada.webp")], check=True)
        # para conferir sem abrir o site: quatro momentos lado a lado
        momentos = [int(s * FPS) for s in (0.6, 2.0, 2.6, 3.6)]
        folha = Image.new("RGBA", (W * ESCALA * 4, H * ESCALA), (22, 24, 31, 255))
        for i, q in enumerate(momentos):
            folha.alpha_composite(Image.open(pasta / f"q{q:03d}.png"), (i * W * ESCALA, 0))
        folha.save(AQUI / "folha.png")
    for nome in ("sem-anuncio.webp", "sem-anuncio-parada.webp"):
        print(f"{nome}: {(SITE / nome).stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
