# A CENOURA (24/11/2026): um modelo só, para qualquer jogo 3D (web/public/comum/cenoura.glb). Dois nós: "corpo" (laranja, com os
# sulcos) e "folhas" (o tufo verde), para o jogo trocar o material de um sem o outro (a cenoura DOURADA do Tabuleiro da turma é
# esta mesma, com o ouro no corpo). Medidas do Tabuleiro: o corpo vai de y −0,165 a 0,17 (ponta para baixo), as folhas até ~0,30,
# a origem no meio do corpo.
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import *

limpar()
laranja = mat("cenoura", "#f2872e", rug=0.7)
folha = mat("folha", "#5fbf4f", rug=0.8)
folha2 = mat("folha-escura", "#3f9a46", rug=0.8)

# o corpo: torno com sulcos (um anel mais fino a cada dois), afinando até a ponta
perfil = [(0.0, -0.165)]
pontos = [(-0.135, 0.016), (-0.105, 0.027), (-0.075, 0.037), (-0.045, 0.046), (-0.015, 0.055), (0.015, 0.063), (0.045, 0.071),
          (0.075, 0.078), (0.105, 0.083), (0.13, 0.083), (0.15, 0.074), (0.163, 0.055), (0.17, 0.028)]
for i, (z, r) in enumerate(pontos):
    sulco = 0.9 if (i % 2 == 1 and i < 9) else 1.0
    perfil.append((r * sulco, z))
perfil.append((0.0, 0.171))
corpo = torno(laranja, perfil, lados=10, liso=True)
corpo = juntar([corpo], "corpo")

# as folhas: o colarinho e três hastes achatadas, abertas em leque, com uma folha mais escura atrás
pecas = [cilindro(folha2, 0.026, 0.03, (0, 0, 0.178), lados=8, r2=0.02)]
for k, (ang, alt, cor_) in enumerate([(-0.62, 0.125, folha), (0.0, 0.145, folha), (0.62, 0.12, folha), (math.pi, 0.11, folha2)]):
    gira = 0.9 if k == 3 else 0.0
    # a haste: um cone achatado, inclinado para fora
    lado = math.sin(ang)
    frente = math.cos(ang) if k == 3 else 0.0
    h = alt
    p = cilindro(cor_, 0.034, h, (lado * h * 0.42 * (1 if k < 3 else 0), -frente * h * 0.35, 0.185 + h * 0.48), lados=6, r2=0.004,
                 rot=(frente * 0.55, ang if k < 3 else 0, 0))
    p.scale = (1, 0.45, 1)
    from comum import _ativo
    _ativo(p)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    pecas.append(p)
folhas = juntar(pecas, "folhas")

raiz = pai([corpo, folhas], "cenoura")
caminho = os.path.join(REPO, "web", "public", "comum", "cenoura.glb")
exportar(caminho, [raiz])
previa(os.path.join(FOTOS, "cenoura.png"), [raiz])
pronto()
