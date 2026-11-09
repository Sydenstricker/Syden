# O BANHEIRO DO SALÃO EM PIXEL ART (09/11/2026, pedido dele: "pode criar o banheiro de fato para o salão? Use o banheiro 3D
# atual como referência, para não destoar"). O GUIA da casca: o cômodo desenhado só em geometria, em cores chapadas (a moldura
# de madeira escura, os azulejos brancos, a pintura amarela, o piso verde-água, a laje), que vai ao PixelLab de referência de
# FORMA (banheiro.mjs casca). A casa do salão (27 × 14,25 px), 6 casas na parede da direita (a do espelho e da prateleira, os
# 4,2 m do 3D) por 5 na da esquerda (a da porta, os 3,3 m), e, como o salão de pixel art, sem as muretas da frente do 3D.
# O PixelLab NÃO segue as medidas: encolhe o cômodo dentro do quadro (casca-1, ~0,75) e o deixa quase quadrado; por isso a
# geometria que vale é a MEDIDA na casca escolhida (os cantos do chão, em montar.py), e não a daqui.
#   u: casas ao longo da parede da DIREITA; v: ao longo da da ESQUERDA.
#   py -3 e2e/pixel-art/salao/banheiro/guia.py   → guia.png (e guia-grande.png, ampliado 1,35×, para o quadro de 432 × 528)
import os
import numpy as np
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
W, H = 320, 392
FX, FY = 146, 200          # o canto do fundo, no chão
CX, CY = 27.0, 14.25       # uma casa
NU, NV = 6, 5              # casas na parede da direita e na da esquerda
MOLDURA = 190              # do chão ao alto da moldura, no canto do fundo (mais baixa que a do salão: cômodo pequeno)
AZULEJO = 82               # até onde vão os azulejos brancos (o resto é a pintura amarela, como no 3D)
BORDA = 26                 # a borda do chão (a laje), na frente


def ponto(u, v, h=0.0):
    """casas (u, v) e altura em px → pixel da imagem"""
    return (FX + CX * (u - v), FY + CY * (u + v) - h)



if __name__ == '__main__':
    # O GUIA: só a forma, em cores chapadas (a moldura de madeira escura, os azulejos brancos, a pintura amarela, o piso
    # verde-água, a laje de tijolo), para o PixelLab desenhar o cômodo com estas proporções.
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(im)
    P = lambda *a: tuple(round(c) for c in ponto(*a))
    # a laje (a borda do chão), por baixo de tudo
    g.polygon([P(0, NV), P(NU, NV), P(NU, 0), (P(NU, 0)[0], P(NU, 0)[1] + BORDA), (P(NU, NV)[0], P(NU, NV)[1] + BORDA), (P(0, NV)[0], P(0, NV)[1] + BORDA)], fill=(150, 84, 62, 255), outline=(40, 22, 26, 255))
    # o piso, em ladrilhos de meia casa
    g.polygon([P(0, 0), P(NU, 0), P(NU, NV), P(0, NV)], fill=(150, 214, 200, 255))
    for k in range(1, NU * 2):
        g.line([P(k / 2, 0), P(k / 2, NV)], fill=(110, 170, 160, 255))
    for k in range(1, NV * 2):
        g.line([P(0, k / 2), P(NU, k / 2)], fill=(110, 170, 160, 255))
    # as paredes: a da esquerda (v de 0 a NV, u = 0) e a da direita (u de 0 a NU, v = 0)
    for (a0, a1, esq) in ((0, NV, True), (0, NU, False)):
        q = (lambda a, h: P(0, a, h)) if esq else (lambda a, h: P(a, 0, h))
        g.polygon([q(a0, 0), q(a1, 0), q(a1, AZULEJO), q(a0, AZULEJO)], fill=(236, 236, 228, 255))
        g.polygon([q(a0, AZULEJO), q(a1, AZULEJO), q(a1, MOLDURA - 36), q(a0, MOLDURA - 36)], fill=(240, 206, 130, 255))
        g.polygon([q(a0, MOLDURA - 36), q(a1, MOLDURA - 36), q(a1, MOLDURA), q(a0, MOLDURA)], fill=(70, 40, 40, 255))
        for k in range(1, int(a1 * 2)):
            g.line([q(k / 2, 0), q(k / 2, AZULEJO)], fill=(190, 196, 192, 255))
        for h in range(16, AZULEJO, 16):
            g.line([q(a0, h), q(a1, h)], fill=(190, 196, 192, 255))
    im.save(os.path.join(AQUI, 'guia.png'))
    im.resize((432, 529), Image.NEAREST).crop((0, 0, 432, 528)).save(os.path.join(AQUI, 'guia-grande.png'))
