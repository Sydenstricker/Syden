# A NAVE DE QUEM JOGA (Rota Estelar, 24/11/2026): o corpo branco de brinquedo, o bico laranja, as asas curtas para trás com a
# ponta laranja levantada, o leme, os dois canos do laser duplo embaixo das asas e o bocal do motor. O vidro da cabine, o
# coelho e o fogo continuam por código (cena.ts): o vidro precisa da transparência de cada nave, o coelho é o da pessoa.
# As medidas são as da nave por código de antes (o bico em +z 2,75 no three.js, o bocal em −1,75, as asas até ±2,4).
# O que leva a cor da nave (as alas têm a delas) é o material 'pintura'.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import *

comecar("nave")
from mathutils import Matrix as Mx

R = raiz("nave")
p = Peca()

# o casco: um tubo do bocal (y +1,75) ao bico (y −2,15), mais baixo na frente
p.juntar(loft([
    (1.72, 0.50, 0.44, 0.02),
    (1.45, 0.62, 0.54, 0.03),
    (0.70, 0.66, 0.56, 0.02),
    (-0.30, 0.60, 0.52, 0.0),
    (-1.20, 0.46, 0.40, -0.06),
    (-1.85, 0.30, 0.27, -0.10),
    (-2.15, 0.22, 0.20, -0.12),
], lados=12, quadrado=0.45), "branco", "pintura", faixa=(0.0, 0.62))
# o bico laranja
p.juntar(loft([
    (-2.13, 0.22, 0.20, -0.12),
    (-2.45, 0.15, 0.13, -0.13),
    (-2.70, 0.06, 0.05, -0.14),
], lados=12, quadrado=0.3), "laranja", faixa=(0.0, 0.5))
# a faixa azul dos lados do casco (um friso que acompanha a lateral)
for lado in (-1, 1):
    p.juntar(caixa((0.05, 0.95, 0.07), 0.03), "azul", faixa=(0.05, 0.4), matriz=M((lado * 0.62, -0.35, 0.02), (0, 0, lado * -6)))
# a borda da cabine (o vidro é da cena): um aro escuro em volta da abertura
p.juntar(anel(0.47, 0.07, 20, 6), "grafite", faixa=(0.1, 0.5), matriz=M((0, -0.15, 0.40), (0, 0, 0), (1, 1.72, 1)))
# o encosto atrás da cabine, que desce até o leme
p.juntar(loft([
    (0.62, 0.30, 0.16, 0.48),
    (0.95, 0.26, 0.12, 0.50),
    (1.40, 0.18, 0.06, 0.46),
], lados=10, quadrado=0.4), "branco", "pintura", faixa=(0.0, 0.4))
# o bocal do motor e a luz de dentro
p.juntar(cilindro(0.50, 0.44, 0.32, 14, 0.03), "grafite", faixa=(0.1, 0.6), matriz=M((0, 1.55, 0.02), (-90, 0, 0)))
p.juntar(cilindro(0.30, 0.30, 0.05, 12, 0.0), "fogo", "luz", faixa=(0.1, 0.4), matriz=M((0, 1.86, 0.02), (-90, 0, 0)))
# as entradas de ar dos lados
for lado in (-1, 1):
    p.juntar(caixa((0.10, 0.30, 0.16), 0.04), "grafite", faixa=(0.2, 0.6), matriz=M((lado * 0.62, 0.95, -0.12)))

# as asas: curtas, para trás, mais finas na ponta
for lado in (-1, 1):
    pts = [(0.45, -0.35), (2.20, 0.55), (2.30, 1.15), (0.45, 1.30)]
    if lado < 0:
        pts = [(-x, y) for x, y in reversed(pts)]
    p.juntar(prisma(pts, -0.26, -0.08, 0.035), "branco", "pintura", faixa=(0.05, 0.45))
    # a faixa laranja na asa
    faixa = [(1.35, 0.15), (1.70, 0.36), (1.73, 1.20), (1.35, 1.22)]
    if lado < 0:
        faixa = [(-x, y) for x, y in reversed(faixa)]
    p.juntar(prisma(faixa, -0.09, -0.055, 0.0), "laranja", faixa=(0.05, 0.3))
    # a ponta da asa, levantada e um pouco aberta (o plano YZ girado para fora)
    perfil = [(0.45, 0.0), (1.35, 0.0), (1.30, 0.20), (0.90, 0.78), (0.70, 0.80)]
    fin = prisma(perfil, -0.07, 0.07, 0.03)
    giro = Mx(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # (y, z, x) do perfil
    p.juntar(fin, "laranja", faixa=(0.0, 0.55), matriz=M((lado * 2.30, 0.05, -0.20), (0, lado * 20, 0)) @ giro)
    # o laser embaixo da asa
    p.juntar(cilindro(0.11, 0.09, 1.05, 8, 0.02), "cinza", faixa=(0.1, 0.6), matriz=M((lado * 1.25, 0.55, -0.32), (90, 0, 0)))
    p.juntar(cilindro(0.17, 0.17, 0.40, 8, 0.03), "grafite", faixa=(0.1, 0.6), matriz=M((lado * 1.25, 0.75, -0.32), (90, 0, 0)))

# o leme
perfil = [(0.70, 0.0), (1.55, 0.0), (1.70, 0.85), (1.40, 0.88)]
leme = prisma(perfil, -0.06, 0.06, 0.03)
giro = Mx(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
p.juntar(leme, "laranja", faixa=(0.0, 0.55), matriz=M((0, 0, 0.42)) @ giro)

ob = objeto(p, "nave_corpo")
filho(ob, R)
exportar(R, "nave.glb")

# prévia: com um vidro só de prévia, ao lado do módulo e do lander do pacote
vidro = Peca()
vidro.juntar(esfera(0.5, 16, 10, (1, 1.7, 0.85)), "celeste", "vidro")
vo = objeto(vidro, "_vidro", angulo_suave=80)
vo.location = (0, -0.15, 0.42)
kaykit("lander_A", (3.6, 1.5, -0.6), 1.6)
kaykit("dropship", (-4.2, 2.0, -0.6), 2.1, 180)
previa("nave.png", alvo=(0, 0.6, 0.2), dist=13, azimute=-35, elev=25, lente=40, largura=1200)
for o in list(bpy.context.scene.objects):
    if o.get("_comparar") or o.parent and o.parent.get("_comparar"):
        o.hide_render = True
previa("nave-perto.png", alvo=(0, 0, 0.1), dist=7.5, azimute=-145, elev=22, lente=45)
terminar()
