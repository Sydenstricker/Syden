# OS CHEFES DA ROTA ESTELAR (24/11/2026): o polvo de lata (o chefe do planeta), a nave-mãe (o da rota do gelo) e o canhão que
# vai em cima do jipe gigante (o subchefe; o jipe é o spacetruck_large do pacote). Mesmas marcas dos inimigos: o roxo por tinta,
# o olho vermelho. A frente (o −z do three.js) é o +Y do Blender.
#
# OS BRAÇOS DO POLVO são nós em corrente: polvo_braco_<k> (a raiz, girada para fora, com o x local para fora) e dentro dele
# polvo_braco_<k>_<j> (j de 0 a 4), cada gomo preso no anterior pela junta, para o three.js dobrar cada um (rotation.z enrola).
# Uso: rodar.ps1 chefes.py  (SO=polvo,mae,canhao)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import *
from mathutils import Matrix as Mx

comecar("chefes")
SO = [x for x in os.environ.get("SO", "").split(",") if x]
DE_PE = Mx(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def limpar():
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)


def polvo():
    R = raiz("polvo")
    p = Peca()
    # a cabeça de lata e o capacete roxo por cima, com a faixa de rebites
    p.juntar(esfera(4.0, 20, 14, (1, 1, 0.9)), "aco", faixa=(0.0, 0.75))
    p.juntar(loft([
        (0.9, 4.12, 4.12, 0), (2.0, 3.75, 3.75, 0), (2.95, 2.95, 2.95, 0), (3.5, 1.8, 1.8, 0), (3.72, 0.7, 0.7, 0),
    ], lados=20, quadrado=0.0, eixo="z", tampas=(False, True)), "branco", "roxo", faixa=(0.0, 0.6))
    p.juntar(anel(4.12, 0.2, 28, 6), "grafite", faixa=(0.2, 0.6), matriz=M((0, 0, 0.9)))
    for k in range(14):
        a = k / 14 * math.tau
        p.juntar(caixa((0.16, 0.16, 0.16), 0.04), "ouro", faixa=(0.1, 0.5), matriz=M((math.cos(a) * 4.3, math.sin(a) * 4.3, 0.9), (0, 0, math.degrees(a))))
    # as duas antenas com a luz
    for lado in (-1, 1):
        p.juntar(cilindro(0.12, 0.08, 1.4, 6, 0.0), "grafite", faixa=(0.2, 0.6), matriz=M((lado * 1.4, -0.6, 3.2), (0, lado * 18, 0)))
        p.juntar(esfera(0.3, 10, 8), "vermelho", "olho", faixa=(0.0, 0.3), matriz=M((lado * 1.83, -0.6, 4.55)))
    # o olho: a escotilha escura, o branco e a pupila vermelha
    p.juntar(anel(1.55, 0.3, 24, 8), "grafite", faixa=(0.1, 0.6), matriz=M((0, 3.55, 0.4), (90, 0, 0)))
    p.juntar(esfera(1.5, 16, 12, (1, 0.75, 1)), "branco", faixa=(0.0, 0.35), matriz=M((0, 3.4, 0.4)))
    p.juntar(esfera(0.75, 12, 8, (1, 0.6, 1)), "vermelho", "olho", faixa=(0.0, 0.3), matriz=M((0, 4.4, 0.4)))
    # a saia de baixo, onde os braços se prendem
    p.juntar(cilindro(3.0, 3.55, 0.9, 16, 0.08), "grafite", faixa=(0.1, 0.6), matriz=M((0, 0, -3.35)))
    filho(objeto(p, "polvo_cabeca"), R)
    # os oito braços em cinco gomos
    for k in range(8):
        a = k / 8 * math.tau
        raiz_b = bpy.data.objects.new(f"polvo_braco_{k}", None)
        bpy.context.scene.collection.objects.link(raiz_b)
        raiz_b.parent = R
        # no three.js: posição (cos a·3, −2,4, sin a·3) e giro y = −a  →  no Blender (cos a·3, −sin a·3, −2,4) e giro z = −a
        raiz_b.location = (math.cos(a) * 3.0, -math.sin(a) * 3.0, -2.4)
        raiz_b.rotation_euler = (0, 0, -a)
        anterior = raiz_b
        for j in range(5):
            s = 1 - j * 0.14
            comp = 1.15
            g = Peca()
            cor = "roxo" if j % 2 == 0 else "aco"
            q = "branco" if cor == "roxo" else "aco"
            mat = "roxo" if cor == "roxo" else "paleta"
            # o gomo: um barril ao longo do x, com o anel escuro da junta
            g.juntar(loft([
                (0.0, 0.52 * s, 0.52 * s, 0), (0.25 * comp, 0.75 * s, 0.75 * s, 0), (0.75 * comp, 0.72 * s, 0.72 * s, 0),
                (comp, 0.5 * s, 0.5 * s, 0),
            ], lados=8, quadrado=0.2, eixo="x"), q, mat, faixa=(0.0, 0.7))
            g.juntar(anel(0.5 * s, 0.11 * s, 10, 4), "grafite", faixa=(0.2, 0.6), matriz=M((0, 0, 0), (0, 90, 0)))
            if j == 4:
                # a ponta: uma garrinha
                g.juntar(cone(0.42 * s, 0.7, 8), "grafite", faixa=(0.1, 0.6), matriz=M((comp, 0, 0), (0, 90, 0)))
            ob = objeto(g, f"polvo_braco_{k}_{j}")
            ob.parent = anterior
            # cada gomo desce um pouco (a mesma curva dos gomos de antes: 1,15 para fora e 0,5 para baixo)
            ob.location = (0.0, 0.0, 0.0) if j == 0 else (comp, 0.0, 0.0)
            ob.rotation_euler = (0, math.radians(18 if j == 0 else 8), 0)
            anterior = ob
    exportar(R, "polvo.glb")
    previa("polvo.png", alvo=(0, 0, -1.5), dist=26, azimute=150, elev=22, lente=45)


def mae():
    """A nave-mãe: o casco largo de aço com as placas roxas, o hangar aceso na frente, a ponte de comando e os canhões."""
    R = raiz("mae")
    p = Peca()
    p.juntar(loft([
        (-6.6, 3.0, 1.5, 0.4), (-5.6, 4.3, 2.2, 0.3), (0.0, 4.7, 2.4, 0.2), (3.6, 4.1, 2.0, 0.0), (4.7, 3.4, 1.6, -0.2),
    ], lados=12, quadrado=0.7), "aco", faixa=(0.0, 0.75))
    # as placas roxas de cima
    for y0, y1 in ((-5.2, -3.4), (-3.0, -0.4), (0.0, 3.2)):
        p.juntar(caixa((2.6, (y1 - y0) / 2, 0.18), 0.08), "branco", "roxo", faixa=(0.0, 0.5), matriz=M((0, (y0 + y1) / 2, 2.55)))
    # o hangar aceso na frente, na moldura escura
    p.juntar(caixa((2.1, 0.25, 1.0), 0.12), "grafite", faixa=(0.1, 0.6), matriz=M((0, 4.75, -0.5)))
    p.juntar(caixa((1.65, 0.1, 0.65), 0.0), "amarelo", "luz", faixa=(0.0, 0.5), matriz=M((0, 4.95, -0.5)))
    # a ponte de comando, com a janela e o olho
    p.juntar(prisma([(-1.6, -4.6), (1.6, -4.6), (1.4, -1.4), (-1.4, -1.4)], 2.4, 4.0, 0.12, encolhe=0.82), "branco", "roxo", faixa=(0.0, 0.6))
    p.juntar(caixa((1.15, 0.12, 0.22), 0.05), "grafite", faixa=(0.1, 0.5), matriz=M((0, -1.45, 3.45)))
    p.juntar(esfera(0.42, 12, 8, (1, 0.6, 1)), "vermelho", "olho", faixa=(0.0, 0.3), matriz=M((0, -1.35, 3.45)))
    for lado in (-1, 1):
        p.juntar(cilindro(0.08, 0.05, 1.3, 6, 0.0), "grafite", faixa=(0.2, 0.6), matriz=M((lado * 0.9, -3.8, 3.9)))
        p.juntar(esfera(0.17, 8, 6), "vermelho", "olho", faixa=(0.0, 0.3), matriz=M((lado * 0.9, -3.8, 5.25)))
    # as barcaças dos lados, com o canhão na frente
    for lado in (-1, 1):
        x = lado * 5.3
        p.juntar(loft([
            (-5.0, 0.6, 0.6, 0), (-4.2, 1.15, 1.2, 0), (2.2, 1.15, 1.15, 0), (3.2, 0.7, 0.7, 0),
        ], lados=10, quadrado=0.5), "branco", "roxo", faixa=(0.0, 0.7), matriz=M((x, 0, 0.3)))
        p.juntar(caixa((0.9, 1.6, 0.25), 0.06), "grafite", faixa=(0.1, 0.6), matriz=M((lado * 4.4, -0.8, 0.3)))
        p.juntar(cilindro(0.45, 0.38, 2.2, 10, 0.04), "grafite", faixa=(0.1, 0.6), matriz=M((x, 2.3, 0.3), (-90, 0, 0)))
        p.juntar(cilindro(0.55, 0.55, 0.45, 10, 0.05), "aco", faixa=(0.1, 0.6), matriz=M((x, 4.3, 0.3), (-90, 0, 0)))
        p.juntar(cilindro(0.5, 0.45, 0.5, 10, 0.04), "grafite", faixa=(0.1, 0.6), matriz=M((x, -4.6, 0.3), (90, 0, 0)))
        p.juntar(cilindro(0.34, 0.34, 0.05, 10, 0.0), "fogo", "luz", faixa=(0.1, 0.3), matriz=M((x, -5.12, 0.3), (90, 0, 0)))
    # os três motores de trás
    for x in (-1.9, 0.0, 1.9):
        p.juntar(cilindro(0.85, 0.75, 0.7, 12, 0.06), "grafite", faixa=(0.1, 0.6), matriz=M((x, -6.3, 0.4), (90, 0, 0)))
        p.juntar(cilindro(0.55, 0.55, 0.05, 12, 0.0), "fogo", "luz", faixa=(0.1, 0.3), matriz=M((x, -7.02, 0.4), (90, 0, 0)))
    # as faixas amarelas de aviso embaixo
    for lado in (-1, 1):
        p.juntar(caixa((0.12, 3.0, 0.5), 0.03), "ouro", faixa=(0.1, 0.5), matriz=M((lado * 4.62, 0.2, -0.6)))
    filho(objeto(p, "mae_casco"), R)
    exportar(R, "mae.glb")
    previa("mae.png", alvo=(0, 0, 0.5), dist=30, azimute=150, elev=25, lente=45)


def canhao():
    """O canhão do jipe: a base escura, a carcaça roxa com o olho e o cano para a frente, um pouco levantado."""
    R = raiz("canhao_do_jipe")
    p = Peca()
    p.juntar(cilindro(1.25, 1.1, 0.45, 10, 0.06), "grafite", faixa=(0.1, 0.6), matriz=M((0, 0, -0.95)))
    p.juntar(esfera(1.15, 14, 10, (1, 1.1, 0.8)), "branco", "roxo", faixa=(0.0, 0.7), matriz=M((0, 0, -0.2)))
    p.juntar(caixa((0.75, 0.25, 0.22), 0.06), "grafite", faixa=(0.1, 0.6), matriz=M((0, 1.0, 0.42)))
    p.juntar(esfera(0.42, 12, 8, (1, 0.7, 1)), "vermelho", "olho", faixa=(0.0, 0.3), matriz=M((0, 1.22, 0.42)))
    # o cano: sai da frente e sobe 15 graus
    cano = M((0, 0.4, -0.5), (-90 + 15, 0, 0))
    p.juntar(cilindro(0.4, 0.34, 3.4, 12, 0.05), "aco", faixa=(0.0, 0.7), matriz=cano @ M((0, 0, 0)))
    p.juntar(cilindro(0.5, 0.5, 0.5, 12, 0.06), "grafite", faixa=(0.1, 0.6), matriz=cano @ M((0, 0, 3.2)))
    p.juntar(cilindro(0.3, 0.3, 0.04, 10, 0.0), "preto", faixa=(0.3, 0.6), matriz=cano @ M((0, 0, 3.69)))
    p.juntar(cilindro(0.46, 0.46, 0.25, 12, 0.04), "ouro", faixa=(0.1, 0.5), matriz=cano @ M((0, 0, 0.9)))
    filho(objeto(p, "canhao_corpo"), R)
    exportar(R, "canhao_do_jipe.glb")
    previa("canhao.png", alvo=(0, 1, 0), dist=10, azimute=150, elev=25, lente=45)


for nome, f in [("polvo", polvo), ("mae", mae), ("canhao", canhao)]:
    if SO and nome not in SO:
        continue
    limpar()
    f()
terminar()
