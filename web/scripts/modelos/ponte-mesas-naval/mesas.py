# OS TABULEIROS DAS MESAS 3D (24/11/2026): a Mancala com as covas ESCAVADAS, a tábua do Cinco em linha e as Damas de 10 × 10,
# no jeito do KayKit Board Game Bits que já está na mesa: a MESMA textura de paleta dele (web/public/mesa3d/
# boardgame_bits_texture.png, apontada sem cópia), cada face num ponto do degradê da célula, o chanfro pequeno. Saem como os do
# pacote, glTF separado em web/public/mesa3d/: tabuleiro-mancala, tabuleiro-gomoku e tabuleiro-damas-10.
# As medidas são as das peças por código de antes (mesa3d/mancala.ts, gomoku.ts, damas.ts), que ficam de reserva.
import bpy, bmesh, math, os, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import comum as c

r = c.Rodada("mesas")
PASTA = os.path.join(c.PUBLICO, "mesa3d")

# as células da paleta (coluna) e o v do Blender (a linha de baixo da paleta de cores vai de 0,5 a 0,75; mais alto, mais claro)
MARROM, LARANJA, CREME = 3, 2, 7


def mancala():
    c.limpa()
    tex = c.material_kaykit(PASTA)
    TOPO = 0.62  # o alto da tábua; o fundo das covas fica em 0,42, onde as sementes pousam (TOPO de mancala.ts)
    FUNDO = 0.42
    tabua = c.caixa("tabuleiro-mancala", (17.4, 5.2, TOPO), (0, 0, TOPO / 2), tex, 0.0)
    cortes = []
    # as covas: x de −5 a 5, as duas fileiras em z = ±1,15 do jogo (y = ∓1,15 no Blender); o tronco de cone abre para cima
    for k in range(6):
        for y in (-1.15, 1.15):
            cortes.append(c.cilindro("cova", 0.72, 0.5, (-5 + k * 2, y, FUNDO), tex, 28, raio2=0.95, chanfro=0.0))
    for x in (-7.2, 7.2):
        d = c.cilindro("deposito", 1.0, 0.5, (x, 0, FUNDO), tex, 32, raio2=1.25, chanfro=0.0)
        d.scale = (0.88, 1.95, 1)
        cortes.append(d)
    # o friso do meio (um sulco raso entre as fileiras) e os dois sulcos em volta, como entalhe
    cortes.append(c.caixa("sulco", (11.6, 0.09, 0.2), (0, 0, TOPO), tex, 0.0))
    for y in (-2.25, 2.25):
        cortes.append(c.caixa("sulco", (16.2, 0.07, 0.16), (0, y, TOPO), tex, 0.0))
    junto = c.juntar("cortes", cortes)
    md = tabua.modifiers.new("covas", "BOOLEAN")
    md.operation = "DIFFERENCE"
    md.object = junto
    try:
        md.solver = "EXACT"
    except Exception:
        pass
    c.aplicar_mods(tabua)
    bpy.data.objects.remove(junto)
    c._chanfro(tabua, 0.035, 1, 30)
    c.aplicar_mods(tabua)
    covas = [(-5 + k * 2, y) for k in range(6) for y in (-1.15, 1.15)]

    def regra(p, n):
        dentro = p.z < TOPO - 0.005 and (any((p.x - x) ** 2 + (p.y - y) ** 2 < 1.05 ** 2 for x, y in covas)
                                          or any(((p.x - x) / 1.15) ** 2 + (p.y / 2.25) ** 2 < 1 for x in (-7.2, 7.2)))
        sulco = p.z < TOPO - 0.005 and not dentro and abs(p.x) < 8.3 and abs(p.y) < 2.45 and n.z > -0.5
        if dentro:
            return MARROM, 0.53 if n.z > 0.5 else 0.58  # o fundo escuro e as paredes um pouco mais claras
        if sulco:
            return MARROM, 0.6
        if n.z > 0.5:
            return LARANJA, 0.515  # o tampo: a madeira clara
        if n.z < -0.5:
            return MARROM, 0.56
        return LARANJA, 0.503  # os lados, mais escuros
    contagem = {}
    def regra_contada(p, n):
        k = regra(p, n)
        contagem[k] = contagem.get(k, 0) + 1
        return k
    c.pintar_faces(tabua, regra_contada)
    r.diz("mancala classes", contagem)
    tri = c.exporta_gltf(os.path.join(PASTA, "tabuleiro-mancala.gltf"), [tabua])
    r.diz("mancala", tri)
    c.previa(os.path.join(r.pasta, "mesa-mancala.png"), alvo=(0, 0, 0.3), dist=17, azimute=20, elev=40)


def gomoku():
    c.limpa()
    tex = c.material_kaykit(PASTA)
    topo = c.cor("#d9b77a", 0.8, nome="topo")  # a cena troca pelo da textura das linhas
    # a tábua de 16 × 16 (lado = n + 1 do jogo, que a cena estica) de −0,12 a 0,12, com o tampo na face de cima
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((16, 16, 0.24)), verts=bm.verts)
    me = bpy.data.meshes.new("tabuleiro-gomoku")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(tex)
    me.materials.append(topo)
    tab = bpy.data.objects.new("tabuleiro-gomoku", me)
    bpy.context.scene.collection.objects.link(tab)
    c._chanfro(tab, 0.06, 2, 30)
    c.aplicar_mods(tab)
    uv = me.uv_layers.active.data if me.uv_layers else me.uv_layers.new(name="UVMap").data
    for p in me.polygons:
        if p.normal.z > 0.99 and p.center.z > 0.11:
            p.material_index = 1
            for li in p.loop_indices:
                co = me.vertices[me.loops[li].vertex_index].co
                uv[li].uv = ((co.x + 8) / 16, (co.y + 8) / 16)
        else:
            col, v = (LARANJA, 0.6) if p.normal.z > 0.3 else (LARANJA, 0.53)
            for li in p.loop_indices:
                uv[li].uv = ((col + 0.5) / 8, v)
    # o rodapé: a moldura mais escura que aparece rente à mesa, e os quatro pezinhos de canto
    base = c.caixa("base", (16.5, 16.5, 0.08), (0, 0, 0.0), tex, 0.03)
    pes = [c.cilindro("pe", 0.35, 0.1, (x * 7.9, y * 7.9, -0.02), tex, 10, chanfro=0.03) for x in (-1, 1) for y in (-1, 1)]
    resto = c.juntar("base", [base] + pes)
    c.pintar_faces(resto, lambda p, n: (MARROM, 0.7 if n.z > 0.5 else 0.66))
    tab = c.juntar("tabuleiro-gomoku", [tab, resto])
    tri = c.exporta_gltf(os.path.join(PASTA, "tabuleiro-gomoku.gltf"), [tab])
    r.diz("gomoku", tri, [m.name for m in tab.data.materials])
    c.previa(os.path.join(r.pasta, "mesa-gomoku.png"), alvo=(0, 0, 0), dist=40, azimute=20, elev=40)


def damas10():
    c.limpa()
    tex = c.material_kaykit(PASTA)
    n = 10
    # a moldura como a do board_A (o mesmo degradê do marrom), 0,6 de cada lado, até 0,27; as casas por cima, até 0,30
    moldura = c.caixa("moldura", (n + 1.2, n + 1.2, 0.27), (0, 0, 0.135), tex, 0.05)
    c.aplicar_mods(moldura)
    c.pintar_faces(moldura, lambda p, nn: (MARROM, 0.703 if nn.z > 0.3 else (0.656 if nn.z < -0.5 else 0.672)))
    bm = bmesh.new()
    res = bmesh.ops.create_grid(bm, x_segments=n, y_segments=n, size=n / 2)
    for v in bm.verts:
        v.co.z = 0.30
    topo = list(bm.faces)
    ext = bmesh.ops.extrude_face_region(bm, geom=topo)
    novos = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=Vector((0, 0, -0.04)), verts=novos)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    casas = c._novo("casas", bm, tex)
    me = casas.data
    uv = me.uv_layers.new(name="UVMap").data
    for p in me.polygons:
        if p.normal.z > 0.9 and p.center.z > 0.29:
            col_ = round(p.center.x + (n - 1) / 2)
            lin = round((n - 1) / 2 - p.center.y)
            # a casa escura é (linha + coluna) ímpar, como em damas.ts
            cel, v = (MARROM, 0.734) if (col_ + lin) % 2 == 1 else (CREME, 0.516)
        else:
            cel, v = MARROM, 0.672
        for li in p.loop_indices:
            uv[li].uv = ((cel + 0.5) / 8, v)
    tab = c.juntar("tabuleiro-damas-10", [moldura, casas])
    tri = c.exporta_gltf(os.path.join(PASTA, "tabuleiro-damas-10.gltf"), [tab])
    r.diz("damas10", tri)
    c.previa(os.path.join(r.pasta, "mesa-damas-10.png"), alvo=(0, 0, 0), dist=20, azimute=20, elev=40)


mancala()
gomoku()
damas10()
r.fim()
