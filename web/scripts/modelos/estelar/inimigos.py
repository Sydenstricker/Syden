# OS INIMIGOS COMUNS DA ROTA ESTELAR (24/11/2026): o caçador, a torre, a mina com espetos e a sentinela da rota do gelo. O roxo
# e o olho vermelho continuam a marca dos inimigos (o roxo é a tinta 'roxo' por cima do quadrado branco da paleta: a KayKit não
# tem roxo). A frente deles (o −z do three.js, para onde a nave do jogador está) é o +Y do Blender.
# Uso: rodar.ps1 inimigos.py  (ou SO=cacador,torre… no ambiente para só alguns)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import *
from mathutils import Matrix as Mx

comecar("inimigos")
SO = [x for x in os.environ.get("SO", "").split(",") if x]
# o perfil desenhado no plano (y, z) vira uma aleta de pé, com a espessura em x
DE_PE = Mx(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def limpar():
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)


def cacador():
    """O caçador: a cápsula roxa de bico para a frente, as duas garras de asa e o olho vermelho."""
    R = raiz("cacador")
    p = Peca()
    p.juntar(loft([
        (-1.35, 0.30, 0.24, 0.05),
        (-1.10, 0.55, 0.42, 0.05),
        (-0.20, 0.78, 0.58, 0.0),
        (0.70, 0.62, 0.46, -0.04),
        (1.25, 0.36, 0.28, -0.08),
        (1.45, 0.12, 0.10, -0.10),
    ], lados=10, quadrado=0.35), "branco", "roxo", faixa=(0.0, 0.7))
    # a viseira escura e o olho
    p.juntar(esfera(0.42, 12, 8, (1.25, 0.9, 0.62)), "grafite", faixa=(0.2, 0.6), matriz=M((0, 0.95, 0.17)))
    p.juntar(esfera(0.24, 10, 8), "vermelho", "olho", faixa=(0.0, 0.3), matriz=M((0, 1.25, 0.15)))
    # a crista de cima
    p.juntar(prisma([(-1.0, 0.0), (0.3, 0.0), (-0.65, 0.55), (-1.05, 0.5)], -0.06, 0.06, 0.03), "grafite", faixa=(0.1, 0.6),
             matriz=M((0, 0, 0.45)) @ DE_PE)
    # as asas em garra: para trás e com a ponta para a frente, levantadas um pouco
    for lado in (-1, 1):
        pts = [(0.55, -0.85), (2.05, -0.55), (2.25, 0.85), (1.75, 0.95), (1.55, 0.05), (0.55, 0.35)]
        if lado < 0:
            pts = [(-x, y) for x, y in reversed(pts)]
        asa = prisma(pts, -0.09, 0.09, 0.035)
        p.juntar(asa, "aco", faixa=(0.1, 0.6), matriz=M((0, 0, 0), (0, lado * -22, 0)))
        # a ponta vermelha da garra
        ponta = prisma([(1.68, 0.55), (2.18, 0.45), (2.26, 0.86), (1.76, 0.96)] if lado > 0 else [(-1.76, 0.96), (-2.26, 0.86), (-2.18, 0.45), (-1.68, 0.55)],
                       -0.11, 0.11, 0.03)
        p.juntar(ponta, "vermelho", faixa=(0.1, 0.5), matriz=M((0, 0, 0), (0, lado * -22, 0)))
        # o motor de trás
        p.juntar(cilindro(0.22, 0.18, 0.55, 8, 0.03), "grafite", faixa=(0.1, 0.6), matriz=M((lado * 0.55, -1.45, -0.05), (-90, 0, 0)))
        p.juntar(cilindro(0.14, 0.14, 0.04, 8, 0.0), "fogo", "luz", faixa=(0.1, 0.3), matriz=M((lado * 0.55, -1.47, -0.05), (90, 0, 0)))
    filho(objeto(p, "cacador_corpo"), R)
    exportar(R, "cacador.glb")
    kaykit("lander_A", (3.4, -1.0, -0.9), 1.6)
    previa("cacador.png", alvo=(0, 0, 0), dist=9, azimute=150, elev=28, lente=45)


def torre():
    """A torre de chão: a base sextavada com a faixa amarela e a cabeça roxa (nó próprio) com o cano duplo e o olho."""
    R = raiz("torre")
    p = Peca()
    p.juntar(cilindro(1.32, 1.12, 0.62, 6, 0.06), "grafite", faixa=(0.1, 0.7), matriz=M((0, 0, -0.42), (0, 0, 30)))
    p.juntar(cilindro(1.17, 1.17, 0.14, 6, 0.0), "ouro", faixa=(0.1, 0.4), matriz=M((0, 0, -0.06), (0, 0, 30)))
    p.juntar(cilindro(0.95, 0.85, 0.22, 10, 0.04), "aco", faixa=(0.1, 0.6), matriz=M((0, 0, 0.08)))
    for k in range(6):
        a = math.radians(k * 60)
        p.juntar(caixa((0.22, 0.14, 0.12), 0.03), "escuro", faixa=(0.2, 0.6), matriz=M((math.cos(a) * 1.28, math.sin(a) * 1.28, -0.38), (0, 0, k * 60)))
    filho(objeto(p, "torre_base"), R)
    c = Peca()
    c.juntar(esfera(0.85, 14, 10, (1, 1, 0.82)), "branco", "roxo", faixa=(0.0, 0.7), matriz=M((0, 0, 0.6)))
    c.juntar(caixa((0.55, 0.22, 0.16), 0.05), "grafite", faixa=(0.2, 0.6), matriz=M((0, 0.66, 0.78)))
    c.juntar(esfera(0.17, 10, 8), "vermelho", "olho", faixa=(0.0, 0.3), matriz=M((0, 0.86, 0.80)))
    for lado in (-1, 1):
        c.juntar(cilindro(0.13, 0.13, 1.25, 8, 0.02), "aco", faixa=(0.1, 0.6), matriz=M((lado * 0.24, 0.45, 0.52), (-90, 0, 0)))
        c.juntar(cilindro(0.18, 0.18, 0.22, 8, 0.03), "grafite", faixa=(0.1, 0.6), matriz=M((lado * 0.24, 1.55, 0.52), (-90, 0, 0)))
    filho(objeto(c, "torre_cabeca", pivo=(0, 0, 0.55)), R)
    exportar(R, "torre.glb")
    kaykit("solarpanel", (-3.0, -1.0, -0.4), 2.5)
    previa("torre.png", alvo=(0, 0, 0.2), dist=8, azimute=150, elev=28, lente=45)


def mina():
    """A mina: a bola de metal com a faixa, os seis espetos roxos e a lâmpada vermelha, tudo num nó (gira inteira)."""
    R = raiz("mina")
    p = Peca()
    p.juntar(esfera(0.82, 14, 10), "aco", faixa=(0.0, 0.7))
    p.juntar(cilindro(0.86, 0.86, 0.18, 14, 0.03), "grafite", faixa=(0.2, 0.6), matriz=M((0, 0, -0.09)))
    dirs = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
    for d in dirs:
        v = Vector(d)
        giro = v.to_track_quat("Z", "Y").to_matrix().to_4x4()
        p.juntar(cilindro(0.22, 0.2, 0.16, 8, 0.02), "grafite", faixa=(0.2, 0.6), matriz=Mx.Translation(v * 0.74) @ giro)
        p.juntar(cone(0.17, 0.55, 8), "branco", "roxo", faixa=(0.0, 0.6), matriz=Mx.Translation(v * 0.86) @ giro)
    # a lâmpada vermelha entre os espetos, virada para a frente e para cima
    p.juntar(esfera(0.2, 10, 8), "vermelho", "olho", faixa=(0.0, 0.3), matriz=M((0, 0.55, 0.55)))
    filho(objeto(p, "mina_bola"), R)
    exportar(R, "mina.glb")
    previa("mina.png", alvo=(0, 0, 0), dist=6, azimute=150, elev=28, lente=45)


def sentinela():
    """A sentinela: o miolo roxo com o olho grande e o anel (nó próprio, que gira de frente para a nave) com quatro luzes."""
    R = raiz("sentinela")
    p = Peca()
    p.juntar(esfera(1.45, 16, 12), "branco", "roxo", faixa=(0.0, 0.7))
    p.juntar(anel(1.45, 0.14, 24, 6), "grafite", faixa=(0.2, 0.6))
    p.juntar(anel(0.72, 0.16, 18, 6), "grafite", faixa=(0.2, 0.6), matriz=M((0, 1.18, 0), (90, 0, 0)))
    p.juntar(esfera(0.62, 12, 8, (1, 0.6, 1)), "vermelho", "olho", faixa=(0.0, 0.3), matriz=M((0, 1.2, 0)))
    filho(objeto(p, "sentinela_miolo"), R)
    a = Peca()
    # o anel no plano XZ do Blender (o XY do three.js), girando em volta do eixo da frente
    a.juntar(anel(3.0, 0.42, 32, 8, 1.0), "aco", faixa=(0.0, 0.7), matriz=M((0, 0, 0), (90, 0, 0), (1, 1, 1.5)))
    for k in range(4):
        ang = k * 90 + 45
        r = math.radians(ang)
        x, z = math.cos(r), math.sin(r)
        a.juntar(caixa((0.55, 0.62, 0.55), 0.1), "grafite", faixa=(0.1, 0.6), matriz=M((x * 3.0, 0, z * 3.0), (0, -ang, 0)))
        a.juntar(esfera(0.3, 10, 8), "vermelho", "olho", faixa=(0.0, 0.3), matriz=M((x * 3.0, 0.6, z * 3.0)))
        a.juntar(caixa((0.75, 0.12, 0.12), 0.03), "aco", faixa=(0.1, 0.6), matriz=M((x * 2.1, 0, z * 2.1), (0, -ang, 0)))
    for k in range(4):
        r = math.radians(k * 90)
        a.juntar(caixa((0.12, 0.5, 0.32), 0.03), "ouro", faixa=(0.1, 0.5), matriz=M((math.cos(r) * 3.0, 0, math.sin(r) * 3.0), (0, -k * 90, 0)))
    filho(objeto(a, "sentinela_anel"), R)
    exportar(R, "sentinela.glb")
    previa("sentinela.png", alvo=(0, 0, 0), dist=13, azimute=160, elev=20, lente=45)


for nome, f in [("cacador", cacador), ("torre", torre), ("mina", mina), ("sentinela", sentinela)]:
    if SO and nome not in SO:
        continue
    limpar()
    f()
terminar()
