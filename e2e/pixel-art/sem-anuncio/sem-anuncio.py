"""O COELHO SEM ANÚNCIO (13/10/2026). Troca a cena da mineração no site (#dados), por decisão do Sydenstricker: com o
Termo rodando dentro do Syden (e o Google Analytics dele), "não mineramos seus dados" deixou de ser a frase mais
precisa. A promessa exata é a da Microsoft Store: SEM ANÚNCIOS.

O coelho (incomodado e feliz) e a ilha são do PixelLab (gerar.mjs, pedido dele: "o cenário e o coelho podem melhorar").
As janelas de anúncio, o proibido e o coração são desenhados por código, com as funções da mineração
(../mineracao/mineracao.py): janelinhas pipocam em volta do coelho incomodado, piscando. O proibido cai sobre elas, elas se
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


# A cena tem o DOBRO da resolução da mineração: o coelho e a ilha vêm do PixelLab (gerar.mjs) e nasceram
# assim. As janelas, o proibido e o coração continuam desenhados por código na grade antiga (96 × 64) e são
# ampliados 2× — a parte da cena que ele aprovou fica igual.
# TOPO: a folga em cima, para o pulo do feliz (7 px) não cortar as orelhas (relato dele, 13/10/2026).
TOPO = 9
CW, CH, CESCALA = 192, 132 + TOPO, 3
COELHO_X, COELHO_Y = 30, 2 + TOPO
ILHA_Y = 66 + TOPO  # a grama da ilha (linha 16 da figura) fica na altura dos pés do coelho


def recortar(arquivo):
    im = Image.open(AQUI / arquivo).convert("RGBA")
    return im.crop(im.getbbox())


def animacao(base):
    """Os 9 quadros do PixelLab (gerar.mjs animar), cada um com o quanto o pé dele fica acima do fundo da figura:
    na cena, todo quadro pisa no chão, e o movimento é o do desenho (o pulo do feliz vem do código)."""
    quadros = []
    for i in range(1, 10):
        im = Image.open(AQUI / f"animado-{base}-{i}.png").convert("RGBA")
        quadros.append((im, im.getbbox()[3]))
    return quadros


def montar(pasta):
    ilha = Image.open(AQUI / "ilha-1.png").convert("RGBA")
    incomodado = recortar("incomodado-1.png")
    # o chão do coelho: onde pisava a pose parada (os quadros animados pisam no mesmo lugar)
    pe = COELHO_Y + incomodado.height
    anim_incomodado = animacao("incomodado-1")
    anim_feliz = animacao("feliz-4")
    # a figura animada tem a borda de 64 × 96: o x dela é o da pose parada menos a sobra da esquerda
    x_figura = COELHO_X - Image.open(AQUI / "incomodado-1.png").getbbox()[0]

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
        cena = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        cena.alpha_composite(ilha, (0, ILHA_Y))
        # incomodado enquanto os anúncios pipocam (bate o pé, balança a cabeça); feliz depois do proibido, pulando
        # — cada quadro do desenho dura 2 da cena (6 por segundo)
        if t < QUANDO_CAI + 0.5:
            figura, base = anim_incomodado[(q // 2) % len(anim_incomodado)]
            dy = 0
        else:
            k = q - int((QUANDO_CAI + 0.5) * FPS)
            figura, base = anim_feliz[(k // 2) % len(anim_feliz)]
            dy = -int(round(7 * abs(math.sin(math.pi * k / 9))))
        cena.alpha_composite(figura, (x_figura, pe - base + dy))

        # a camada desenhada por código, na grade antiga
        a = np.zeros((H, W, 4), "uint8")
        if t < QUANDO_CAI + 0.15:
            for i, (x0, y0, w, h, nasce, miolo) in enumerate(JANELAS):
                if t < nasce:
                    continue
                p = min(1.0, (t - nasce) / 0.25)
                escala = p * 1.15 if p < 0.8 else 1.15 - (p - 0.8) * 0.75
                ww, hh = max(3, int(w * escala)), max(3, int(h * escala))
                tremor = (1 if (q + i) % 4 == 0 else 0) if p >= 1 else 0
                janela(a, x0 + (w - ww) // 2 + tremor, y0 + (h - hh) // 2, ww, hh, miolo, (q // 3 + i) % 2 == 0)
        else:
            idade = (t - QUANDO_CAI - 0.15) * FPS
            if idade < 14:
                for x, y, vx, vy, cor in pedacos:
                    m.px(a, int(x + vx * idade), int(y + vy * idade + 0.2 * idade * idade), cor)
        if t >= QUANDO_CAI:
            p = min(1.0, (t - QUANDO_CAI) / 0.35)
            raio = int(19 * (p * 1.12 if p < 0.8 else 1.12 - (p - 0.8) * 0.6))
            m.proibido(a, *CENTRO, max(4, raio))
        camada = Image.fromarray(a)
        if 3.2 <= t < 4.7:
            subida = (t - 3.2) * 5
            camada.alpha_composite(jogo.CORACAO, (44, max(0, int(14 - subida))))
        cena.alpha_composite(camada.resize((W * 2, H * 2), Image.NEAREST), (0, TOPO))

        if t >= 4.7:
            fade = np.array(cena)
            fade[..., 3] = (fade[..., 3] * max(0.0, 1 - (t - 4.7) / 0.3)).astype("uint8")
            cena = Image.fromarray(fade)
        cena.resize((CW * CESCALA, CH * CESCALA), Image.NEAREST).save(pasta / f"q{q:03d}.png")


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
        folha = Image.new("RGBA", (CW * CESCALA * 4, CH * CESCALA), (22, 24, 31, 255))
        for i, q in enumerate(momentos):
            folha.alpha_composite(Image.open(pasta / f"q{q:03d}.png"), (i * CW * CESCALA, 0))
        folha.save(AQUI / "folha.png")
    for nome in ("sem-anuncio.webp", "sem-anuncio-parada.webp"):
        print(f"{nome}: {(SITE / nome).stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
