# O CENÁRIO DA ROTA ESTELAR (24/11/2026): o cristal e a laje da rota do gelo e o portão da bifurcação.
# Os dois de gelo nascem em MEDIDA UNITÁRIA, porque a cena os estica pela regra (o cristal: raio 1 e altura 1 com a base no zero;
# a laje: 1 × 1 × 1 centrada). O gelo é o material 'gelo' (a cena o deixa transparente e com brilho); o portão tem o anel em
# 'pintura' (a cena pinta cada um: azul o das rochas, laranja o da estação) e a frente para o −z do three.js (o +Y do Blender).
# Uso: rodar.ps1 cenario.py  (SO=cristal,laje,portao)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import *

comecar("cenario")
SO = [x for x in os.environ.get("SO", "").split(",") if x]


def limpar():
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)


def ponta(r, alto, ponta_alt, lados=6):
    """Um prisma de cristal: o corpo de pé (z de 0 a alto) e a ponta de pirâmide em cima."""
    bm = bmesh.new()
    base, topo = [], []
    for k in range(lados):
        a = k / lados * math.tau
        base.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, 0)))
        topo.append(bm.verts.new((math.cos(a) * r * 0.92, math.sin(a) * r * 0.92, alto)))
    pico = bm.verts.new((0, 0, alto + ponta_alt))
    bm.faces.new(list(reversed(base)))
    for k in range(lados):
        bm.faces.new((base[k], base[(k + 1) % lados], topo[(k + 1) % lados], topo[k]))
        bm.faces.new((topo[k], topo[(k + 1) % lados], pico))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def cristal():
    """O cristal de gelo: o prisma grande e dois menores encostados, inclinados para fora, na base de neve."""
    R = raiz("cristal")
    p = Peca()
    p.juntar(ponta(0.62, 0.62, 0.38), "celeste", "gelo", faixa=(0.06, 0.8))
    p.juntar(ponta(0.34, 0.34, 0.22), "celeste", "gelo", faixa=(0.06, 0.8), matriz=M((0.62, 0.15, 0), (0, 24, 15)))
    p.juntar(ponta(0.28, 0.22, 0.18), "celeste", "gelo", faixa=(0.06, 0.8), matriz=M((-0.5, -0.38, 0), (-14, -22, 40)))
    p.juntar(ponta(0.24, 0.18, 0.14), "celeste", "gelo", faixa=(0.06, 0.8), matriz=M((-0.25, 0.6, 0), (24, -10, 0)))
    # a neve na base
    p.juntar(cilindro(1.0, 0.85, 0.08, 10, 0.03), "branco", faixa=(0.06, 0.5))
    filho(objeto(p, "cristal_corpo", angulo_suave=20), R)
    exportar(R, "cristal.glb")
    previa("cristal.png", alvo=(0, 0, 0.45), dist=4.5, azimute=150, elev=22, lente=45)


def laje():
    """A laje de gelo: o bloco de quinas largas com uma camada de neve em cima e embaixo (vira teto ou chão)."""
    R = raiz("laje")
    p = Peca()
    p.juntar(caixa((0.5, 0.5, 0.42), 0.05), "celeste", "gelo", faixa=(0.06, 0.8))
    for z in (0.42, -0.42):
        p.juntar(caixa((0.51, 0.51, 0.08), 0.03), "branco", faixa=(0.06, 0.5), matriz=M((0, 0, z)))
    filho(objeto(p, "laje_corpo", angulo_suave=20), R)
    exportar(R, "laje.glb")
    previa("laje.png", alvo=(0, 0, 0), dist=3.6, azimute=150, elev=22, lente=45)


def portao():
    """O portão da bifurcação: o anel aceso (raio 6) preso em quatro presilhas escuras, de frente para a nave."""
    R = raiz("portao")
    p = Peca()
    p.juntar(anel(6.0, 0.62, 40, 8), "branco", "pintura", faixa=(0.06, 0.5), matriz=M((0, 0, 0), (90, 0, 0)))
    for k in range(8):
        a = math.radians(k * 45)
        x, z = math.cos(a) * 6.0, math.sin(a) * 6.0
        grande = k % 2 == 0
        tam = (0.5, 0.95, 0.95) if grande else (0.3, 0.8, 0.8)
        p.juntar(caixa(tam, 0.12), "grafite", faixa=(0.1, 0.6), matriz=M((x, 0, z), (0, -k * 45, 0)))
        if grande:
            p.juntar(esfera(0.28, 10, 8), "branco", "pintura", faixa=(0.06, 0.4), matriz=M((x * 1.05, 0.9, z * 1.05)))
    filho(objeto(p, "portao_anel"), R)
    exportar(R, "portao.glb")
    previa("portao.png", alvo=(0, 0, 0), dist=24, azimute=160, elev=15, lente=45)


for nome, f in [("cristal", cristal), ("laje", laje), ("portao", portao)]:
    if SO and nome not in SO:
        continue
    limpar()
    f()
terminar()
