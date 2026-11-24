# O AVIÃO DO AEROPORTO DAS CAPITAIS (24/11/2026): a Kenney não tem avião, e o de código (cápsula e caixas) destoava dos prédios
# dela em volta. Um jatinho de brinquedo nas cores do de antes (branco, as asas coral, a cauda azul), com as janelas, os motores
# e o trem de pouso, em web/public/cidades3d/nossos/aviao.glb. O nariz é a frente do jogo (o +z do three.js, o −Y daqui), as asas
# no x, as rodas em z = 0. Medidas: ~0,44 de comprimento e 0,5 de asa (o jogo o põe com a mesma largura do de código).
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import *
from comum import _ativo

limpar()
branco = mat("branco", "#f6f3ec")
coral = mat("coral", "#e0684a")
azul = mat("azul", "#3f6fb0")
vidro = mat("vidro", "#2f4a6b", rug=0.3)
cinza = mat("cinza", "#b9b6b0")
escuro = mat("escuro", "#3a3434")

Z = 0.075  # o eixo da fuselagem
p = []
# a fuselagem: torno em volta de Z, deitado no −Y (nariz) ao +Y (cauda), a cauda subindo um pouco
perfil = [(0.0, -0.222), (0.022, -0.214), (0.036, -0.198), (0.046, -0.172), (0.051, -0.14), (0.052, -0.08), (0.052, 0.08),
          (0.049, 0.12), (0.042, 0.16), (0.03, 0.195), (0.016, 0.215), (0.0, 0.222)]
f = torno(branco, perfil, lados=14, liso=True)
f.rotation_euler = (-math.pi / 2, 0, 0)
f.location = (0, 0, Z)
_ativo(f)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
p.append(f)
# a faixa coral dos lados e as janelas
for s in (-1, 1):
    p.append(caixa(coral, (0.006, 0.3, 0.012), (s * 0.05, 0.0, Z - 0.012), chanfro=0.002))
    for k in range(7):
        p.append(caixa(vidro, (0.006, 0.016, 0.014), (s * 0.0495, -0.105 + k * 0.032, Z + 0.016), chanfro=0.002))
# o para-brisa
p.append(caixa(vidro, (0.06, 0.03, 0.02), (0, -0.178, Z + 0.025), rot=(-0.55, 0, 0), chanfro=0.004))
# as asas (baixas, um pouco para trás), com as pontas viradas para cima
for s in (-1, 1):
    a = caixa(coral, (0.22, 0.085, 0.014), (s * 0.135, 0.018, Z - 0.022), rot=(0, s * -0.05, s * 0.22), chanfro=0.004)
    p.append(a)
    p.append(caixa(coral, (0.01, 0.045, 0.04), (s * 0.244, 0.055, Z - 0.0), rot=(0, s * 0.25, 0), chanfro=0.003))
    # o motor debaixo da asa
    m = cilindro(cinza, 0.021, 0.075, (s * 0.115, -0.02, Z - 0.045), lados=10, rot=(math.pi / 2, 0, 0), chanfro=0.004)
    p.append(m)
    p.append(cilindro(escuro, 0.015, 0.006, (s * 0.115, -0.059, Z - 0.045), lados=10, rot=(math.pi / 2, 0, 0)))
    p.append(caixa(cinza, (0.008, 0.03, 0.02), (s * 0.115, -0.01, Z - 0.03)))
# a cauda: o leme azul (inclinado para trás) e os profundores
p.append(caixa(azul, (0.012, 0.085, 0.1), (0, 0.17, Z + 0.075), rot=(0.42, 0, 0), chanfro=0.004))
for s in (-1, 1):
    p.append(caixa(azul, (0.085, 0.045, 0.01), (s * 0.05, 0.19, Z + 0.02), rot=(0, 0, s * 0.2), chanfro=0.003))
# o trem de pouso: o do nariz e os dois de baixo da asa
for (x, y) in [(0, -0.15), (-0.05, 0.03), (0.05, 0.03)]:
    p.append(caixa(cinza, (0.008, 0.008, 0.04), (x, y, 0.035)))
    p.append(cilindro(escuro, 0.013, 0.012, (x, y, 0.013), lados=10, rot=(0, math.pi / 2, 0)))

aviao = juntar(p, "aviao")
exportar(os.path.join(REPO, "web", "public", "cidades3d", "nossos", "aviao.glb"), [aviao])
previa(os.path.join(FOTOS, "aviao.png"), [aviao], angulo=145)
pronto()
