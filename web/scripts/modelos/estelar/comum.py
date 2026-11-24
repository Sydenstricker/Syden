# Peças comuns dos modelos da Rota Estelar (24/11/2026): tudo nasce por script, no estilo do Space Base Bits da KayKit que já
# está na cena (web/public/estelar/). O segredo do estilo é a PALETA da KayKit: uma imagem de quadrados em degradê (claro em
# cima, escuro embaixo). Cada peça aponta para um quadrado, e o v de cada vértice anda pela altura da peça, como no pacote.
# A paleta vai DENTRO do GLB, reduzida a 256 px (CC0, a mesma imagem do pacote).
#
# Blender: coordenadas do Blender (Z para cima); o exportador passa para o Y para cima do glTF. A frente do three.js (+z) é o
# -Y do Blender. Rodar com rodar.ps1 <script.py> (o launcher da Store não mostra a saída: o log vai para saida/log.txt).
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, "..", "..", "..", ".."))
PUBLICO = os.path.join(REPO, "web", "public", "estelar")
FOTOS = os.path.join(REPO, "e2e", "fotos", "modelos", "estelar")
SAIDA = os.path.join(AQUI, "saida")

# os quadrados da paleta (coluna, linha), da esquerda para a direita e de cima para baixo
Q = {
    "preto": (0, 0), "branco": (1, 0), "cinza": (2, 0), "grafite": (3, 0), "escuro": (4, 0), "aco": (5, 0),
    "marrom": (6, 0), "laranja": (7, 0),
    "celeste": (0, 1), "azul": (1, 1), "azulaco": (2, 1), "ouro": (3, 1), "vermelho": (4, 1), "areia": (5, 1),
    "pedra": (6, 1), "fogo": (7, 1),
    "lima": (0, 2), "petroleo": (1, 2), "verde": (2, 2), "musgo": (3, 2), "degrade": (4, 2), "creme": (5, 2),
    "roxo": (6, 2), "salmao": (7, 2),
    "amarelo": (2, 3),
}

_log = None

# as tintas por cima da paleta (cor linear): o roxo dos inimigos parte do quadrado branco
TINTAS = {"roxo": (0.30, 0.17, 0.62), "roxoclaro": (0.55, 0.40, 0.95)}


def log(*a):
    _log.write(" ".join(str(x) for x in a) + "\n")
    _log.flush()


def comecar(nome):
    """Limpa a cena, abre o log e prende os erros nele (o launcher esconde a saída)."""
    global _log
    os.makedirs(SAIDA, exist_ok=True)
    os.makedirs(FOTOS, exist_ok=True)
    pronto = os.path.join(SAIDA, "pronto.txt")
    if os.path.exists(pronto):
        os.remove(pronto)
    _log = open(os.path.join(SAIDA, "log.txt"), "w", encoding="utf-8")

    def erro(tipo, valor, tb):
        import traceback
        _log.write("".join(traceback.format_exception(tipo, valor, tb)) + "\npronto (com erro)\n")
        _log.flush()
        open(pronto, "w").write("erro")
    sys.excepthook = erro
    bpy.ops.wm.read_factory_settings(use_empty=True)
    log("comecou", nome)


def terminar():
    log("pronto")
    open(os.path.join(SAIDA, "pronto.txt"), "w").write("ok")


# ---------------------------------------------------------------- a paleta e os materiais

_paleta = None
_mats = {}


def paleta():
    global _paleta
    if _paleta is None:
        img = bpy.data.images.load(os.path.join(PUBLICO, "spacebits_texture.png"))
        img.scale(256, 256)
        img.name = "paleta_estelar"
        img.pack()
        _paleta = img
    return _paleta


def material(nome, emissao=0.0, rug=0.6, tinta=None):
    """Um material com a paleta (o nome importa: a cena troca 'pintura', 'olho', 'luz' e 'vidro')."""
    if nome in _mats:
        return _mats[nome]
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rug
    bsdf.inputs["Metallic"].default_value = 0.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = paleta()
    tex.interpolation = "Closest"
    cor = tex.outputs["Color"]
    if tinta:
        # a tinta multiplica a paleta (vira o baseColorFactor do glTF): o roxo dos inimigos, que a paleta não tem
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(tex.outputs["Color"], mix.inputs["A"])
        mix.inputs["B"].default_value = (*tinta, 1.0)
        cor = mix.outputs["Result"]
    nt.links.new(cor, bsdf.inputs["Base Color"])
    if emissao:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emissao
    _mats[nome] = m
    return m


# ---------------------------------------------------------------- as peças

class Peca:
    """Um bmesh com o quadrado da paleta de cada face (o v sai da altura, no fim)."""

    def __init__(self):
        self.bm = bmesh.new()
        self.faces_q = {}  # face -> (quadrado, material, faixa)

    def _marcar(self, faces, q, mat, faixa):
        for f in faces:
            self.faces_q[f] = (q, mat, faixa)

    def juntar(self, outro_bm, q, mat="paleta", faixa=(0.08, 0.72), matriz=None):
        """Copia um bmesh já pronto (em coordenadas locais) aplicando a matriz."""
        if matriz is not None:
            bmesh.ops.transform(outro_bm, matrix=matriz, verts=outro_bm.verts)
        me = bpy.data.meshes.new("_tmp")
        outro_bm.to_mesh(me)
        outro_bm.free()
        antes = set(self.bm.faces)
        self.bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        novas = [f for f in self.bm.faces if f not in antes]
        self._marcar(novas, Q[q] if isinstance(q, str) else q, mat, faixa)
        return novas


def secao(w, h, lados=10, quadrado=0.55):
    """A seção arredondada de um tubo de brinquedo: entre o círculo (0) e o retângulo de quinas chanfradas (1)."""
    pts = []
    for k in range(lados):
        a = (k + 0.5) / lados * math.tau
        c, s = math.cos(a), math.sin(a)
        # superelipse
        e = 2.0 / (2.0 + quadrado * 4.0)
        x = math.copysign(abs(c) ** e, c) * w
        y = math.copysign(abs(s) ** e, s) * h
        pts.append((x, y))
    return pts


def loft(aneis, lados=10, quadrado=0.55, tampas=(True, True), eixo="y"):
    """Um tubo por anéis (pos, meia-largura, meia-altura, sobe): ao longo do eixo (y por padrão). Devolve o bmesh."""
    bm = bmesh.new()
    vs = []
    for (p, w, h, dz) in aneis:
        anel = []
        for (x, z) in secao(w, h, lados, quadrado):
            if eixo == "y":
                co = (x, p, z + dz)
            elif eixo == "x":
                co = (p, x, z + dz)
            else:
                co = (x, z + dz, p)
            anel.append(bm.verts.new(co))
        vs.append(anel)
    for i in range(len(vs) - 1):
        for k in range(lados):
            a, b = vs[i][k], vs[i][(k + 1) % lados]
            c, d = vs[i + 1][(k + 1) % lados], vs[i + 1][k]
            bm.faces.new((a, b, c, d))
    if tampas[0] and aneis[0][1] > 1e-4:
        bm.faces.new(list(reversed(vs[0])))
    if tampas[1] and aneis[-1][1] > 1e-4:
        bm.faces.new(vs[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def caixa(tam, chanfro=0.06):
    """Uma caixa (meias-medidas) com as quinas chanfradas."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * tam[0], v.co.y * tam[1], v.co.z * tam[2]))
    if chanfro:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=chanfro, segments=1, affect="EDGES", profile=0.5)
    return bm


def prisma(pontos_xy, z0, z1, chanfro=0.04, encolhe=1.0):
    """Um prisma de base poligonal (no plano XY), de z0 a z1; `encolhe` estreita o topo (a asa afinando)."""
    bm = bmesh.new()
    cx = sum(p[0] for p in pontos_xy) / len(pontos_xy)
    cy = sum(p[1] for p in pontos_xy) / len(pontos_xy)
    base = [bm.verts.new((x, y, z0)) for x, y in pontos_xy]
    topo = [bm.verts.new((cx + (x - cx) * encolhe, cy + (y - cy) * encolhe, z1)) for x, y in pontos_xy]
    n = len(pontos_xy)
    bm.faces.new(list(reversed(base)))
    bm.faces.new(topo)
    for k in range(n):
        bm.faces.new((base[k], base[(k + 1) % n], topo[(k + 1) % n], topo[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if chanfro:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=chanfro, segments=1, affect="EDGES", profile=0.5, clamp_overlap=True)
    return bm


def cilindro(r1, r2, alt, lados=10, chanfro=0.03):
    """Um cilindro de pé (z de 0 a alt), r1 embaixo e r2 em cima."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=lados, radius1=r1, radius2=r2, depth=alt)
    bmesh.ops.translate(bm, vec=(0, 0, alt / 2), verts=bm.verts)
    if chanfro:
        arestas = [e for e in bm.edges if all(abs(v.co.z) < 1e-4 or abs(v.co.z - alt) < 1e-4 for v in e.verts) and e.calc_face_angle(0) > 0.6]
        bmesh.ops.bevel(bm, geom=arestas, offset=chanfro, segments=1, affect="EDGES", profile=0.5, clamp_overlap=True)
    return bm


def cone(r, alt, lados=8):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=lados, radius1=r, radius2=0.0, depth=alt)
    bmesh.ops.translate(bm, vec=(0, 0, alt / 2), verts=bm.verts)
    return bm


def esfera(r, u=12, v=8, achata=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
    for vv in bm.verts:
        vv.co = Vector((vv.co.x * achata[0], vv.co.y * achata[1], vv.co.z * achata[2]))
    return bm


def icoesfera(r, sub=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    return bm


def anel(R, r, lados=24, lados_tubo=8, achata=1.0):
    """Um toro no plano XY."""
    bm = bmesh.new()
    vs = []
    for i in range(lados):
        a = i / lados * math.tau
        anel_ = []
        for j in range(lados_tubo):
            b = j / lados_tubo * math.tau
            rr = R + r * math.cos(b)
            anel_.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), r * math.sin(b) * achata)))
        vs.append(anel_)
    for i in range(lados):
        for j in range(lados_tubo):
            a, b = vs[i][j], vs[(i + 1) % lados][j]
            c, d = vs[(i + 1) % lados][(j + 1) % lados_tubo], vs[i][(j + 1) % lados_tubo]
            bm.faces.new((a, b, c, d))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def M(pos=(0, 0, 0), rot=(0, 0, 0), esc=(1, 1, 1)):
    """A matriz de posição, giro (graus, XYZ) e escala."""
    r = Matrix.Rotation(math.radians(rot[2]), 4, "Z") @ Matrix.Rotation(math.radians(rot[1]), 4, "Y") @ Matrix.Rotation(math.radians(rot[0]), 4, "X")
    s = Matrix.Diagonal((esc[0], esc[1], esc[2], 1.0))
    return Matrix.Translation(pos) @ r @ s


def objeto(peca, nome, pivo=(0, 0, 0), angulo_suave=35.0):
    """Fecha a peça num objeto: os materiais, o UV na paleta pela altura, a origem no pivô e as quinas duras."""
    bm = peca.bm
    uv = bm.loops.layers.uv.new("UVMap")
    nomes = []
    for f in bm.faces:
        q, mat, faixa = peca.faces_q.get(f, (Q["cinza"], "paleta", (0.08, 0.72)))
        if mat not in nomes:
            nomes.append(mat)
        f.material_index = nomes.index(mat)
    # o v pela altura de cada grupo de faces do mesmo quadrado (o degradê da KayKit: claro em cima)
    grupos = {}
    for f in bm.faces:
        grupos.setdefault(peca.faces_q.get(f, (Q["cinza"], "paleta", (0.08, 0.72))), []).append(f)
    for (q, mat, faixa), fs in grupos.items():
        zs = [l.vert.co.z for f in fs for l in f.loops]
        z0, z1 = min(zs), max(zs)
        col, lin = q
        for f in fs:
            for l in f.loops:
                t = 1.0 if z1 - z0 < 1e-5 else (l.vert.co.z - z0) / (z1 - z0)
                prof = faixa[0] + (faixa[1] - faixa[0]) * (1.0 - t)
                # nunca na borda do quadrado: o vizinho de cima (ou o outro lado da imagem) apareceria em listras
                prof = min(0.94, max(0.06, prof))
                u = (col + 0.3) / 8.0
                v = 1.0 - (lin + prof) / 4.0
                l[uv].uv = (u, v)
    bmesh.ops.translate(bm, vec=Vector(pivo) * -1, verts=bm.verts)
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    for n in nomes:
        me.materials.append(material(n, emissao=1.5 if n in ("olho", "luz") else 0.0, tinta=TINTAS.get(n)))
    for p in me.polygons:
        p.use_smooth = True
    try:
        me.set_sharp_from_angle(angle=math.radians(angulo_suave))
    except AttributeError:
        pass
    ob = bpy.data.objects.new(nome, me)
    ob.location = pivo
    bpy.context.scene.collection.objects.link(ob)
    return ob


def filho(ob, pai):
    """Prende ob ao pai sem mover (o three.js recebe a hierarquia com os nomes)."""
    mw = ob.matrix_world.copy()
    ob.parent = pai
    ob.matrix_parent_inverse = pai.matrix_world.inverted()
    ob.matrix_world = mw


def raiz(nome):
    ob = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def triangulos(obs):
    n = 0
    for o in obs:
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n


def exportar(raiz_ob, arquivo):
    """O GLB da raiz e dos filhos (a paleta embutida)."""
    obs = [raiz_ob] + list(raiz_ob.children_recursive)
    for o in bpy.context.scene.objects:
        o.select_set(o in obs)
    bpy.context.view_layer.objects.active = raiz_ob
    caminho = os.path.join(PUBLICO, arquivo)
    kw = dict(filepath=caminho, export_format="GLB", use_selection=True, export_yup=True, export_apply=True)
    bpy.ops.export_scene.gltf(**kw)
    log("exportou", caminho, os.path.getsize(caminho), "bytes,", triangulos(obs), "triangulos")
    return caminho


def kaykit(nome, pos=(0, 0, 0), escala=1.0, giro=0.0):
    """Um modelo do pacote, só para comparar na prévia (não é exportado)."""
    antes = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(PUBLICO, nome + ".gltf"))
    novos = [o for o in bpy.context.scene.objects if o not in antes]
    raizes = [o for o in novos if o.parent is None]
    for r in raizes:
        r.location = Vector(pos)
        r.scale = (escala, escala, escala)
        r.rotation_euler = (r.rotation_euler.x, r.rotation_euler.y, math.radians(giro))
        r["_comparar"] = True
    return novos


def previa(arquivo, alvo=(0, 0, 0.3), dist=9.0, azimute=35.0, elev=28.0, lente=50, largura=1000, altura=700, fundo=(0.55, 0.56, 0.6)):
    """A prévia 3/4 de cima com fundo neutro (Eevee; se não houver, o Workbench)."""
    scn = bpy.context.scene
    ok = False
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scn.render.engine = eng
            ok = True
            break
        except TypeError:
            pass
    if not ok:
        scn.render.engine = "BLENDER_WORKBENCH"
    scn.render.resolution_x, scn.render.resolution_y = largura, altura
    scn.render.film_transparent = False
    try:
        scn.eevee.taa_render_samples = 24
    except AttributeError:
        pass
    w = bpy.data.worlds.new("fundo")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (*fundo, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    scn.world = w
    sol = bpy.data.objects.new("sol", bpy.data.lights.new("sol", "SUN"))
    sol.data.energy = 3.0
    sol.data.angle = math.radians(10)
    sol.rotation_euler = (math.radians(40), math.radians(10), math.radians(30))
    scn.collection.objects.link(sol)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scn.collection.objects.link(cam)
    az, el = math.radians(azimute), math.radians(elev)
    a = Vector(alvo)
    cam.location = a + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * dist
    cam.rotation_euler = (a - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = lente
    scn.camera = cam
    try:
        scn.view_settings.view_transform = "Standard"
    except TypeError:
        pass
    scn.render.filepath = os.path.join(FOTOS, arquivo)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(sol)
    bpy.data.objects.remove(cam)
    log("previa", arquivo)
