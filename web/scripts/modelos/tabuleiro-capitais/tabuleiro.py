# AS PEÇAS DO MIOLO DO TABULEIRO DA TURMA (24/11/2026): a barraca da cenoura dourada, a toca com a porta redonda, o chafariz,
# o banco da praça, a cerquinha da horta e as pedras da Serra, em web/public/tabuleiro3d/. As medidas são as das peças por
# código de tabuleiro3d/cena.ts (que ficam de reserva): a mesma origem, a mesma frente, o mesmo tamanho.
# No Blender o Z é para cima e a FRENTE do jogo (o +z do three.js, para a câmera) é o −Y daqui.
# Uso: rodar.ps1 tabuleiro.py [barraca toca chafariz banco cerca pedras]   (sem nada, todas)
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import *
from comum import _ativo, _fim
import bmesh

SAIDA = os.path.join(REPO, "web", "public", "tabuleiro3d")


def cortar_no_chao(ob, z=0.0):
    """Tira o que fica abaixo do chão (as peças nascem de esferas e cilindros inteiros)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    geo = bm.verts[:] + bm.edges[:] + bm.faces[:]
    r = bmesh.ops.bisect_plane(bm, geom=geo, plane_co=(0, 0, z), plane_no=(0, 0, 1), clear_inner=True)
    arestas = [e for e in r["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    if arestas:
        try:
            bmesh.ops.edgeloop_fill(bm, edges=arestas)
        except Exception:
            pass
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def amassar(ob, forca, semente):
    """Mexe os vértices um pouco (pedra e morro não são esferas perfeitas)."""
    rnd = random.Random(semente)
    for v in ob.data.vertices:
        v.co.x += rnd.uniform(-forca, forca)
        v.co.y += rnd.uniform(-forca, forca)
        v.co.z += rnd.uniform(-forca, forca) * 0.6
    return ob


def aplicar(ob):
    _ativo(ob)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


# ———————————————————————————— a barraca da dourada ————————————————————————————

def barraca():
    limpar()
    madeira = mat("madeira", "#b0784c")
    clara = mat("madeira-clara", "#d9a46c")
    escura = mat("madeira-escura", "#8a5a3c")
    branco = mat("branco", "#f4efe6")
    laranja = mat("toldo-laranja", "#e9a23b")
    creme = mat("toldo-creme", "#fff6e6")
    p = []
    # o balcão: o corpo, o tampo, as tábuas da frente e o rodapé
    p.append(caixa(madeira, (0.34, 0.18, 0.165), (0, 0.0, 0.0825), chanfro=0.012))
    p.append(caixa(clara, (0.39, 0.23, 0.03), (0, -0.005, 0.18), chanfro=0.01))
    for k in range(4):
        p.append(caixa(clara if k % 2 else madeira, (0.075, 0.012, 0.13), (-0.12 + k * 0.08, -0.094, 0.085), chanfro=0.004))
    p.append(caixa(escura, (0.36, 0.2, 0.025), (0, 0, 0.0125), chanfro=0.006))
    # um caixote no balcão, de lado
    p.append(caixa(clara, (0.09, 0.07, 0.055), (0.11, 0.02, 0.222), chanfro=0.006))
    p.append(caixa(escura, (0.092, 0.072, 0.01), (0.11, 0.02, 0.232), chanfro=0.002))
    # os postes atrás
    for s in (-1, 1):
        p.append(cilindro(branco, 0.014, 0.33, (s * 0.17, 0.08, 0.195 + 0.165), lados=8, chanfro=0.0))
        p.append(esfera(branco, 0.022, (s * 0.17, 0.08, 0.53), seg=8, aneis=6))
    corpo = juntar(p, "barraca")
    # o toldo listrado, caindo para a frente, com o babado de pontas
    t = []
    inclina = 0.3
    for k in range(6):
        m = creme if k % 2 else laranja
        x = -0.175 + k * 0.07
        t.append(caixa(m, (0.07, 0.29, 0.02), (x, 0.0, 0.5), rot=(inclina, 0, 0), chanfro=0.005))
        # a ponta do babado (um triângulo achatado), pendurada na beira da frente
        yb = -0.145 * math.cos(inclina)
        zb = 0.5 - 0.145 * math.sin(inclina)
        bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.036, radius2=0.036, depth=0.012, location=(x, yb - 0.004, zb - 0.026),
                                        rotation=(math.pi / 2, math.pi / 2, 0))
        c = bpy.context.active_object
        c.scale = (1.0, 1.0, 1.0)
        _fim(c, m)
        t.append(c)
    toldo = juntar(t, "toldo")
    raiz = pai([corpo, toldo], "barraca-dourada")
    exportar(os.path.join(SAIDA, "barraca-dourada.glb"), [raiz])
    previa(os.path.join(FOTOS, "barraca-dourada.png"), [raiz])


# ———————————————————————————— a toca ————————————————————————————

def toca():
    limpar()
    raio = 0.55
    grama = mat("grama", "#7fbf5f")
    grama2 = mat("grama-escura", "#5fa24c")
    terra = mat("terra", "#a07a52")
    pedra = mat("pedra", "#c9c0b0")
    porta = mat("porta", "#8a5a3c")
    porta2 = mat("porta-escura", "#5e3c28")
    ouro = mat("macaneta", "#e8b84a", rug=0.4, metal=0.3)
    placa = mat("placa", "#e0b04a")
    poste = mat("poste", "#8a6a4c")
    p = []
    # o morro: meia esfera achatada e um pouco amassada
    m = esfera(grama, raio, (0, 0, 0), seg=18, aneis=10, escala=(1, 1, 0.62), liso=True)
    amassar(m, 0.018, 3)
    cortar_no_chao(m)
    p.append(m)
    # a entrada: um capuz de grama saindo do morro, com o arco de pedras e a porta redonda (a frente é o −Y)
    yf = -raio + 0.02
    capuz = cilindro(grama, 0.25, 0.22, (0, yf + 0.06, 0), lados=16, rot=(math.pi / 2, 0, 0), liso=True)
    cortar_no_chao(capuz)
    p.append(capuz)
    for k in range(9):
        a = k / 8 * math.pi
        p.append(ico(pedra, 0.042, (math.cos(a) * 0.215, yf - 0.06, math.sin(a) * 0.215 + 0.01), sub=1, escala=(1, 0.8, 0.9),
                     rot=(k, k * 0.7, 0)))
    d = cilindro(porta, 0.19, 0.03, (0, yf - 0.05, 0), lados=20, rot=(math.pi / 2, 0, 0))
    cortar_no_chao(d)
    p.append(d)
    for s in (-1, 1):
        p.append(caixa(porta2, (0.012, 0.012, 0.17), (s * 0.065, yf - 0.067, 0.085)))
    p.append(caixa(porta2, (0.34, 0.012, 0.014), (0, yf - 0.067, 0.1)))
    p.append(esfera(ouro, 0.016, (0.11, yf - 0.075, 0.08), seg=8, aneis=6))
    # tufos de grama e umas pedrinhas no morro
    rnd = random.Random(7)
    for k in range(9):
        a = rnd.uniform(0, math.tau)
        if abs(math.sin(a) + 1) < 0.5:  # nada na frente da porta
            continue
        rr = raio * rnd.uniform(0.35, 0.85)
        z = 0.34 * math.sqrt(max(0, 1 - (rr / raio) ** 2))
        for j in range(3):
            p.append(cilindro(grama2, 0.018, 0.07, (math.cos(a) * rr + (j - 1) * 0.015, math.sin(a) * rr, z + 0.02), lados=4, r2=0.0,
                              rot=((j - 1) * 0.3, (j - 1) * 0.3, 0)))
    for (x, y, s) in [(-0.5, -0.25, 0.05), (0.47, -0.32, 0.04), (0.42, 0.35, 0.045)]:
        p.append(ico(pedra, s, (x, y, s * 0.3), sub=1, escala=(1, 1, 0.7), rot=(x, y, 0)))
    # a plaquinha amarela, ao lado (como a de código)
    p.append(caixa(poste, (0.022, 0.022, 0.2), (0.28, -0.45, 0.1), chanfro=0.004))
    p.append(caixa(placa, (0.2, 0.02, 0.1), (0.28, -0.462, 0.19), chanfro=0.008))
    raiz = juntar(p, "toca")
    exportar(os.path.join(SAIDA, "toca.glb"), [raiz])
    previa(os.path.join(FOTOS, "toca.png"), [raiz])


# ———————————————————————————— o chafariz ————————————————————————————

def chafariz():
    limpar()
    pedra = mat("pedra", "#d9cdb6")
    clara = mat("pedra-clara", "#ece2cd")
    escura = mat("pedra-escura", "#b9ab92")
    agua = mat("agua", "#7cc6e0", rug=0.2)
    p = []
    # a bacia: a borda grossa por fora e a parede de dentro (a água é do jogo, a 0,13; a de dentro tem 0,385)
    p.append(torno(pedra, [(0.455, 0.0), (0.46, 0.03), (0.44, 0.05), (0.44, 0.12), (0.452, 0.135), (0.45, 0.155),
                           (0.43, 0.165), (0.395, 0.165), (0.385, 0.15), (0.385, 0.09)], lados=28, liso=False,
                   tampa_baixo=True, tampa_cima=True))
    p.append(cilindro(escura, 0.455, 0.02, (0, 0, 0.01), lados=28))
    # a coluna com anéis e a taça de cima
    p.append(torno(clara, [(0.1, 0.09), (0.1, 0.12), (0.07, 0.14), (0.06, 0.3), (0.085, 0.31), (0.085, 0.33), (0.055, 0.345),
                           (0.05, 0.37)], lados=12, liso=False))
    p.append(torno(pedra, [(0.05, 0.37), (0.15, 0.405), (0.175, 0.43), (0.165, 0.445), (0.14, 0.44), (0.0, 0.43)], lados=18,
                   liso=False, tampa_baixo=False, tampa_cima=False))
    p.append(cilindro(agua, 0.145, 0.01, (0, 0, 0.437), lados=18))
    # o jorro: um botão no meio e a água que sobe
    p.append(torno(agua, [(0.025, 0.43), (0.018, 0.5), (0.03, 0.53), (0.0, 0.56)], lados=8, liso=True, tampa_cima=False))
    raiz = juntar(p, "chafariz")
    exportar(os.path.join(SAIDA, "chafariz.glb"), [raiz])
    previa(os.path.join(FOTOS, "chafariz.png"), [raiz])


# ———————————————————————————— o banco ————————————————————————————

def banco():
    limpar()
    madeira = mat("madeira", "#b0784c")
    clara = mat("madeira-clara", "#c98e5c")
    ferro = mat("ferro", "#5b5350", rug=0.6, metal=0.2)
    p = []
    # o assento (duas tábuas) e o encosto (duas tábuas), virado para a frente (−Y)
    for k, y in enumerate((-0.03, 0.025)):
        p.append(caixa(madeira if k else clara, (0.34, 0.05, 0.018), (0, y, 0.12), chanfro=0.005))
    for k, z in enumerate((0.17, 0.215)):
        p.append(caixa(clara if k else madeira, (0.34, 0.016, 0.035), (0, 0.062, z), rot=(0.18, 0, 0), chanfro=0.005))
    # as laterais de ferro: o pé da frente, o de trás que sobe até o encosto, e o braço
    for s in (-1, 1):
        x = s * 0.145
        p.append(caixa(ferro, (0.018, 0.018, 0.12), (x, -0.045, 0.06), chanfro=0.003))
        p.append(caixa(ferro, (0.018, 0.018, 0.24), (x, 0.055, 0.12), rot=(0.1, 0, 0), chanfro=0.003))
        p.append(caixa(ferro, (0.018, 0.11, 0.016), (x, 0.005, 0.107), chanfro=0.003))
        p.append(caixa(ferro, (0.02, 0.1, 0.018), (x, 0.0, 0.18), chanfro=0.004))
    raiz = juntar(p, "banco")
    exportar(os.path.join(SAIDA, "banco.glb"), [raiz])
    previa(os.path.join(FOTOS, "banco.png"), [raiz])


# ———————————————————————————— a cerquinha ————————————————————————————

def cerca():
    limpar()
    creme = mat("cerca", "#f1e6cf")
    # a estaca: 0,03 × 0,13 com a ponta, a base em z = 0
    e = caixa(creme, (0.032, 0.022, 0.11), (0, 0, 0.055), chanfro=0.004)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.0226, radius2=0, depth=0.03, location=(0, 0, 0.125), rotation=(0, 0, math.pi / 4))
    pt = bpy.context.active_object
    pt.scale = (1.0, 0.69, 1.0)
    aplicar(pt)
    _fim(pt, creme)
    estaca = juntar([e, pt], "estaca")
    # a tábua: comprimento 1 ao longo do −Y (o +z do jogo), o centro na origem (o jogo estica e põe na altura)
    tabua = caixa(creme, (0.012, 1.0, 0.024), (0.0, 0.0, 0.0))
    tabua.name = tabua.data.name = "tabua"
    tabua.location = (0.6, 0, 0)  # só na prévia; volta a 0 antes de exportar
    raiz_e = pai([estaca], "cerca-estaca")
    raiz_t = pai([tabua], "cerca-tabua")
    previa(os.path.join(FOTOS, "cerca.png"), [raiz_e, raiz_t])
    tabua.location = (0, 0, 0)
    exportar(os.path.join(SAIDA, "cerca.glb"), [raiz_e, raiz_t])


# ———————————————————————————— as pedras da Serra ————————————————————————————

def pedras():
    limpar()
    cinza = mat("pedra", "#a29c90", rug=0.95)
    cinza2 = mat("pedra-escura", "#8a847a", rug=0.95)
    musgo = mat("musgo", "#86b260", rug=0.95)
    raizes = []
    # três jeitos, cada um com ~1 de raio no chão (o jogo escala por s) e a base plana em z = 0
    a = ico(cinza, 1.0, (0, 0, 0.25), sub=1, escala=(1.0, 0.85, 0.85), rot=(0.3, 0.2, 0.5))
    amassar(a, 0.12, 1)
    cortar_no_chao(a)
    raizes.append(pai([juntar([a], "pedra-a")], "pedra-1"))
    b1 = ico(cinza, 0.85, (-0.2, 0.05, 0.25), sub=1, escala=(1, 0.9, 1.05), rot=(0.1, 0.6, 0.2))
    amassar(b1, 0.1, 2)
    b2 = ico(cinza2, 0.5, (0.62, -0.25, 0.1), sub=1, escala=(1, 0.9, 0.8), rot=(0.4, 0.1, 0.9))
    amassar(b2, 0.07, 5)
    for o in (b1, b2):
        cortar_no_chao(o)
    raizes.append(pai([juntar([b1, b2], "pedra-b")], "pedra-2"))
    c = ico(cinza2, 0.95, (0, 0, 0.2), sub=1, escala=(1.05, 0.9, 0.95), rot=(0.7, 0.3, 0.1))
    amassar(c, 0.11, 9)
    cortar_no_chao(c)
    mz = ico(musgo, 0.6, (0.05, 0.0, 0.86), sub=1, escala=(1.1, 1.0, 0.2), rot=(0, 0, 0.4))
    amassar(mz, 0.05, 4)
    raizes.append(pai([juntar([c, mz], "pedra-c")], "pedra-3"))
    for k, r in enumerate(raizes):
        r.location = ((k - 1) * 2.6, 0, 0)
    previa(os.path.join(FOTOS, "pedras.png"), raizes)
    for r in raizes:
        r.location = (0, 0, 0)
    exportar(os.path.join(SAIDA, "pedras.glb"), raizes)


TODAS = {"barraca": barraca, "toca": toca, "chafariz": chafariz, "banco": banco, "cerca": cerca, "pedras": pedras}
for nome in (argumentos() or list(TODAS)):
    TODAS[nome]()
pronto()
