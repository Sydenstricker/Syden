# O CENÁRIO DA PONTE DA TOCA (24/11/2026): as peças que eram por código em web/src/ponte/cena3d.ts, no jeito low poly dos
# veículos que já estão lá (Car Kit da Kenney, Halloween Bits da KayKit): poucas faces, cor chapada, chanfro pequeno.
# Um GLB só (web/public/ponte/cenario.glb), um NÓ por peça, cada um com a origem no pé e as MEDIDAS da peça por código, para
# a cena trocar uma pela outra sem mexer em posição nem escala:
#   pinheiro, arvore      as árvores (altura ~2,0 e ~1,8; a copa usa os materiais "copa*", que a cena troca pelos dela)
#   pedra-do-rio          a pedra do meio do rio, de ALTURA 1 (a cena estica no y), raio 0,85 em cima e 1,45 embaixo
#   pilar-fiada, capitel  uma fiada de pedra do pilar (0,8 × 0,5 × 0,4; a cena empilha) e o capitel (0,94 × 0,15 × 0,52)
#   bloco                 o bloco de apoio (0,42 × 0,42 × 0,3, o meio na origem)
#   barco-casco           o casco do barco de mastro alto (comprido no z do jogo, ~3,1), o convés em y ≈ 0,38
#   barco-mastro          o mastro de ALTURA 1 (a cena estica) e barco-vela, o triângulo de 1 × 1 (a cena estica)
#   chegada               a bandeira de chegada inteira (o mastro de 1,8, a base e o pano quadriculado)
import bpy, bmesh, math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import comum as c

r = c.Rodada("ponte_cenario")
c.limpa()
rng = random.Random(7)

TRONCO = c.cor("#7a5233", 0.95, nome="tronco")
COPA = c.cor("#5f9e4e", 0.95, nome="copa")
COPA2 = c.cor("#78b45c", 0.95, nome="copa-clara")
PEDRA = c.cor("#8d877f", 0.95, nome="pedra")
PEDRA_CLARA = c.cor("#bab4aa", 0.9, nome="pedra-clara")
PILAR = c.cor("#a39d94", 0.95, nome="pilar")
BLOCO = c.cor("#6e6861", 0.9, nome="bloco")
FERRO = c.cor("#3a3530", 0.5, metal=0.4, nome="ferro")
CASCO = c.cor("#b4552f", 0.8, nome="casco")
BORDA = c.cor("#f5f1e6", 0.8, nome="borda")
MADEIRA = c.cor("#9a6438", 0.85, nome="madeira")
MADEIRA_CLARA = c.cor("#c58f55", 0.85, nome="madeira-clara")
CORDA = c.cor("#d9c08a", 0.9, nome="corda")
VERMELHO = c.cor("#d0524c", 0.7, nome="vermelho")
PRETO = c.cor("#2f2f2f", 0.8, nome="xadrez-escuro")
BRANCO = c.cor("#f5f1e6", 0.8, nome="xadrez-claro")


def rocha(nome, raio_baixo, raio_cima, alto, lados, mat, semente, topo_plano=True, torto=0.15):
    """Um tronco de cone de poucas faces com os vértices mexidos (pedra), a tampa de cima plana se pedido."""
    g = random.Random(semente)
    bm = bmesh.new()
    aneis = []
    niveis = [0.0, 0.45, 1.0]
    for t in niveis:
        anel = []
        for k in range(lados):
            a = k / lados * math.tau + (0.2 if t == 0.45 else 0)
            rr = raio_baixo + (raio_cima - raio_baixo) * t
            rr *= 1 + g.uniform(-torto, torto) * (0.4 if (t == 1.0 and topo_plano) else 1)
            z = t * alto + (0 if (t == 1.0 and topo_plano) or t == 0 else g.uniform(-0.06, 0.06) * alto)
            anel.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, z)))
        aneis.append(anel)
    for i in range(len(aneis) - 1):
        for k in range(lados):
            j = (k + 1) % lados
            bm.faces.new([aneis[i][k], aneis[i][j], aneis[i + 1][j], aneis[i + 1][k]])
    bm.faces.new(list(reversed(aneis[0])))
    bm.faces.new(aneis[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return c._novo(nome, bm, mat)


def no(nome, obs):
    ob = c.juntar(nome, obs)
    return ob


pecas = []

# ---- o pinheiro: o tronco e três saias de cone, a de baixo mais larga (o desenho de árvore dos pacotes low poly) ----
obs = [c.cilindro("t", 0.13, 0.75, (0, 0, 0), TRONCO, 6, raio2=0.09, chanfro=0.0)]
for k, (z, raio, alto) in enumerate([(0.55, 0.62, 0.75), (0.95, 0.5, 0.65), (1.32, 0.36, 0.68)]):
    obs.append(c.cilindro("saia", raio, alto, (0, 0, z), COPA if k != 1 else COPA2, 7, raio2=0.04, chanfro=0.0))
pecas.append(no("pinheiro", obs))

# ---- a árvore redonda: o tronco com um galho e três bolotas de copa ----
obs = [c.cilindro("t", 0.13, 0.85, (0, 0, 0), TRONCO, 6, raio2=0.08, chanfro=0.0),
       c.cilindro("g", 0.05, 0.35, (0.05, 0, 0.5), TRONCO, 5, raio2=0.03, chanfro=0.0, rot=(0, math.radians(40), 0))]
for (x, y, z, s, m) in [(0, 0, 1.2, 0.56, COPA), (0.32, 0.1, 1.0, 0.36, COPA2), (-0.22, -0.18, 1.02, 0.38, COPA2),
                        (0.05, 0.12, 1.55, 0.34, COPA2)]:
    obs.append(c.esfera("b", s, (x, y, z), m, 1, (1, 1, 0.85)))
pecas.append(no("arvore", obs))

# ---- a pedra do meio do rio: altura 1, o topo plano (o apoio fica nele) e um degrau de pedra clara em volta do topo ----
obs = [rocha("p", 1.45, 0.85, 1.0, 8, PEDRA, 11),
       rocha("musgo", 0.92, 0.86, 0.05, 8, PEDRA_CLARA, 12, torto=0.05)]
obs[1].location.z = 0.97
pecas.append(no("pedra-do-rio", obs))

# ---- o pilar: uma fiada (duas pedras com a junta funda entre elas) e o capitel ----
obs = [c.caixa("a", (0.38, 0.4, 0.47), (-0.205, 0, 0.25), PILAR, 0.05),
       c.caixa("b", (0.38, 0.4, 0.47), (0.205, 0, 0.25), PILAR, 0.05),
       c.caixa("j", (0.76, 0.34, 0.5), (0, 0, 0.25), BLOCO, 0.0)]
pecas.append(no("pilar-fiada", obs))
obs = [c.caixa("c", (0.94, 0.52, 0.11), (0, 0, 0.055), PEDRA_CLARA, 0.035),
       c.caixa("c2", (0.84, 0.44, 0.05), (0, 0, 0.125), PEDRA_CLARA, 0.02)]
pecas.append(no("capitel", obs))

# ---- o bloco de apoio: a pedra chanfrada com a chapa de ferro e dois parafusos na frente (a marca vermelha é da cena) ----
obs = [c.caixa("b", (0.42, 0.3, 0.42), (0, 0, 0), BLOCO, 0.05),
       c.caixa("chapa", (0.3, 0.32, 0.3), (0, 0, 0), FERRO, 0.02)]
for sx in (-1, 1):
    for sz in (-1, 1):
        obs.append(c.cilindro("paraf", 0.025, 0.33, (sx * 0.17, 0.165, sz * 0.17), FERRO, 6, chanfro=0.0,
                              rot=(math.radians(90), 0, 0)))
pecas.append(no("bloco", obs))

# ---- o barco: o casco de tábuas (comprido no Y do Blender = z do jogo), a borda branca, a cabine, os caixotes e a boia ----
pts = [(-0.58, 1.5), (-0.62, 0.6), (-0.62, -0.9), (-0.35, -1.45), (0, -1.6), (0.35, -1.45), (0.62, -0.9), (0.62, 0.6),
       (0.58, 1.5)]
fundo = [(x * 0.6, y * 0.9) for x, y in pts]
bm = bmesh.new()
b = [bm.verts.new((x, y, -0.16)) for x, y in fundo]
t = [bm.verts.new((x, y, 0.36)) for x, y in pts]
n = len(pts)
for i in range(n):
    j = (i + 1) % n
    bm.faces.new([b[i], b[j], t[j], t[i]])
bm.faces.new(list(reversed(b)))
bm.faces.new(t)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
casco = c._chanfro(c._novo("casco", bm, CASCO), 0.03)
obs = [casco,
       c.poligono("borda", [(x * 1.04, y * 1.03) for x, y in pts], 0.34, 0.42, BORDA, 0.02),
       c.poligono("conves", [(x * 0.9, y * 0.92) for x, y in pts], 0.36, 0.425, MADEIRA_CLARA, 0.0),
       c.poligono("faixa", [(x * 0.97, y * 0.985) for x, y in fundo], 0.02, 0.1, BORDA, 0.0)]
# a cabine na popa (+Y), com a janela e o telhado
obs += [c.caixa("cab", (0.72, 0.62, 0.42), (0, 0.92, 0.63), BORDA, 0.04),
        c.caixa("teto", (0.84, 0.74, 0.08), (0, 0.92, 0.87), CASCO, 0.03),
        c.caixa("jan", (0.5, 0.04, 0.16), (0, 0.6, 0.68), FERRO, 0.0)]
# dois caixotes e uma boia de corda na proa
obs += [c.caixa("cx1", (0.3, 0.3, 0.28), (-0.2, -0.55, 0.56), MADEIRA, 0.03),
        c.caixa("cx2", (0.24, 0.24, 0.22), (0.18, -0.62, 0.53), MADEIRA, 0.03)]
boia = c.cilindro("boia", 0.15, 0.06, (0.62, 0.15, 0.55), VERMELHO, 10, raio2=0.15, chanfro=0.025,
                  rot=(0, math.radians(90), 0))
obs.append(boia)
# a retranca (o pau do pé da vela, na altura em que a cena põe a vela; a vela vem esticada, a retranca não)
obs.append(c.cilindro("ret", 0.035, 1.0, (0.0, -0.05, 0.53), MADEIRA, 6, chanfro=0.0, rot=(0, math.radians(90), 0)))
pecas.append(no("barco-casco", obs))
# o mastro de altura 1 (só o cilindro com a ponteira)
obs = [c.cilindro("m", 0.06, 1.0, (0, 0, 0), MADEIRA, 8, raio2=0.045, chanfro=0.0)]
pecas.append(no("barco-mastro", obs))
# a vela de 1 × 1: o triângulo grosso (do pé do mastro ao alto e à ponta da retranca) e a retranca embaixo
obs = [c.prisma("v", [(0.0, 0.0), (0.0, 1.0), (1.0, 0.0)], 0.03, c.cor("#f5f1e6", 0.9, nome="vela"), (0, 0, 0), "Y", 0.0)]
pecas.append(no("barco-vela", obs))

# ---- a bandeira de chegada: o mastro de 1,8 com a bolinha, a base de pedra e o pano xadrez de 4 × 3 com uma onda ----
obs = [c.cilindro("m", 0.045, 1.8, (0, 0, 0), TRONCO, 8, chanfro=0.0),
       c.esfera("ponta", 0.07, (0, 0, 1.83), c.cor("#f2bd3d", 0.5, nome="ponta"), 1),
       rocha("base", 0.26, 0.2, 0.16, 7, PEDRA, 3, torto=0.08)]
L, H, cols, lins = 0.72, 0.54, 4, 3
for i in range(cols):
    for j in range(lins):
        x0, x1 = 0.01 + i * L / cols, 0.01 + (i + 1) * L / cols
        z1, z0 = 1.77 - j * H / lins, 1.77 - (j + 1) * H / lins
        onda = lambda x: 0.05 * math.sin(x / L * math.pi * 1.6)
        bm = bmesh.new()
        vs = [bm.verts.new((x0, onda(x0), z0)), bm.verts.new((x1, onda(x1), z0)), bm.verts.new((x1, onda(x1), z1)),
              bm.verts.new((x0, onda(x0), z1))]
        bm.faces.new(vs)
        q = c._novo("q", bm, PRETO if (i + j) % 2 else BRANCO)
        sol = q.modifiers.new("esp", "SOLIDIFY")
        sol.thickness = 0.02
        obs.append(q)
pecas.append(no("chegada", obs))

# ---- tudo num GLB, as peças lado a lado para a prévia (no arquivo, cada uma volta à origem dela) ----
for k, ob in enumerate(pecas):
    r.diz(ob.name, "triângulos", c.triangulos([ob]))
tri = c.exporta(os.path.join(c.PUBLICO, "ponte", "cenario.glb"), pecas)
r.diz("total", tri)
# a prévia: as peças afastadas em fila (a pedra encolhida, o mastro e a vela na altura de um barco)
lugar = {"pinheiro": (-4.2, 0), "arvore": (-3.0, 0), "pedra-do-rio": (-1.2, 0), "pilar-fiada": (0.6, 0), "capitel": (0.6, 0),
         "bloco": (1.7, 0), "barco-casco": (3.4, 0), "barco-mastro": (3.4, 0), "barco-vela": (3.46, 0.05), "chegada": (5.2, 0)}
for ob in pecas:
    x, y = lugar[ob.name]
    ob.location = (x, y, 0)
bpy.data.objects["capitel"].location.z = 1.5
bpy.data.objects["pilar-fiada"].scale = (1, 1, 3.0)
bpy.data.objects["bloco"].location.z = 1.86
bpy.data.objects["barco-mastro"].location.z = 0.36
bpy.data.objects["barco-mastro"].scale = (1, 1, 2.6)
bpy.data.objects["barco-vela"].location.z = 0.6
bpy.data.objects["barco-vela"].scale = (0.89, 1, 2.0)
c.previa(os.path.join(r.pasta, "ponte-cenario.png"), alvo=(0.5, 0, 0.8), dist=13, azimute=10, elev=18, largura=1400, altura=700)
r.fim()
