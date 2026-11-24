# Peças comuns dos modelos do grupo "ponte-mesas-naval" (24/11/2026): a Ponte da toca, as mesas 3D e a frota de guerra da
# Batalha naval. Tudo por script, sem nada baixado: as caixas e os cilindros com o chanfro pequeno dos pacotes CC0 que já
# estão nas cenas (KayKit Board Game Bits, Kenney Watercraft e Car Kit), cor chapada por material, a exportação GLB (Y para
# cima, sem textura) e a prévia no Eevee.
#
# Uso (pelo PowerShell): blender-launcher.exe -b --factory-startup -P <script>.py -- <pasta-de-saida-das-previas>
# O launcher não mostra a saída: o log vai para <pasta>/log-<script>.txt e, no fim, <pasta>/pronto-<script>.txt.
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
PUBLICO = os.path.join(REPO, "web", "public")


class Rodada:
    """O log, o pronto.txt e a pasta das prévias."""

    def __init__(self, nome):
        args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
        self.pasta = os.path.abspath(args[0]) if args else os.path.join(REPO, "e2e", "fotos", "modelos", "ponte-mesas-naval")
        os.makedirs(self.pasta, exist_ok=True)
        self.nome = nome
        self.pronto = os.path.join(self.pasta, f"pronto-{nome}.txt")
        if os.path.exists(self.pronto):
            os.remove(self.pronto)
        self.log = open(os.path.join(self.pasta, f"log-{nome}.txt"), "w", encoding="utf-8")

        def erro(tipo, valor, tb):
            import traceback
            self.log.write("".join(traceback.format_exception(tipo, valor, tb)))
            self.fim("com erro")
        sys.excepthook = erro

    def diz(self, *a):
        self.log.write(" ".join(str(x) for x in a) + "\n")
        self.log.flush()

    def fim(self, como="ok"):
        self.log.write(f"pronto ({como})\n")
        self.log.close()
        open(self.pronto, "w").write(como)


def limpa():
    _mats.clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)


_mats = {}


def cor(hexa, rug=0.75, metal=0.0, nome=None, emissao=0.0):
    """Material chapado (um por cor). O nome vira o nome do material no glTF (o jogo acha alguns pelo nome)."""
    chave = (nome or hexa, rug, metal)
    if chave in _mats:
        return _mats[chave]
    h = hexa.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    m = bpy.data.materials.new(nome or ("c" + h))
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*lin, 1)
    b.inputs["Roughness"].default_value = rug
    b.inputs["Metallic"].default_value = metal
    if emissao:
        b.inputs["Emission Color"].default_value = (*lin, 1)
        b.inputs["Emission Strength"].default_value = emissao
    _mats[chave] = m
    return m


def _novo(nome, bm, mat):
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def _chanfro(ob, largura, segs=1, angulo=40):
    if largura <= 0:
        return ob
    md = ob.modifiers.new("chanfro", "BEVEL")
    md.width = largura
    md.segments = segs
    md.limit_method = "ANGLE"
    md.angle_limit = math.radians(angulo)
    md.harden_normals = False
    return ob


def caixa(nome, tam, pos, mat, chanfro=0.03, rot=(0, 0, 0), segs=1):
    """Caixa (tamanho x, y, z em Blender: z é para cima) com o chanfro pequeno."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(tam), verts=bm.verts)
    ob = _novo(nome, bm, mat)
    ob.location = pos
    ob.rotation_euler = rot
    return _chanfro(ob, min(chanfro, min(tam) * 0.45), segs)


def cilindro(nome, raio, altura, pos, mat, lados=12, raio2=None, chanfro=0.02, rot=(0, 0, 0), segs=1):
    """Cilindro (ou tronco de cone, com raio2 em cima) de pé, com a base em pos."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=lados, radius1=raio,
                          radius2=raio if raio2 is None else raio2, depth=altura)
    bmesh.ops.translate(bm, vec=Vector((0, 0, altura / 2)), verts=bm.verts)
    ob = _novo(nome, bm, mat)
    ob.location = pos
    ob.rotation_euler = rot
    return _chanfro(ob, min(chanfro, altura * 0.4), segs)


def esfera(nome, raio, pos, mat, sub=1, escala=(1, 1, 1), suave=False):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=raio)
    bmesh.ops.scale(bm, vec=Vector(escala), verts=bm.verts)
    ob = _novo(nome, bm, mat)
    ob.location = pos
    if suave:
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob


def prisma(nome, perfil, espessura, mat, pos=(0, 0, 0), eixo="Y", chanfro=0.02):
    """Extruda o perfil (lista de (u, v) num plano) na espessura: eixo Y (o perfil é x, z) ou X (o perfil é y, z)."""
    bm = bmesh.new()
    vs = []
    for u, v in perfil:
        co = Vector((u, -espessura / 2, v)) if eixo == "Y" else Vector((-espessura / 2, u, v))
        vs.append(bm.verts.new(co))
    f = bm.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm, faces=[f])
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    nv = [g for g in r["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=Vector((0, espessura, 0)) if eixo == "Y" else Vector((espessura, 0, 0)), verts=nv)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _novo(nome, bm, mat)
    ob.location = pos
    return _chanfro(ob, chanfro)


def casco(nome, comp, larg, alto, mat, proa=0.32, popa=0.1, fundo=0.55, aneis=14, lados=10, chanfro=0.0):
    """O casco de um navio ao comprido de Y (a proa para +Y): cada anel é uma seção em U que afina na proa e na popa,
    com o fundo mais estreito (fundo) que o convés. A borda de cima é reta (o convés)."""
    bm = bmesh.new()
    secoes = []
    for i in range(aneis + 1):
        t = i / aneis  # 0 popa, 1 proa
        y = -comp / 2 + t * comp
        if t > 1 - proa:
            k = (t - (1 - proa)) / proa
            meia = larg / 2 * math.sqrt(max(0.0, 1 - k ** 1.6)) + 0.002
            elev = alto * 0.18 * k  # a proa sobe um pouco
        elif t < popa:
            k = 1 - t / popa
            meia = larg / 2 * (1 - 0.18 * k * k)
            elev = 0
        else:
            meia = larg / 2
            elev = 0
        anel = []
        for j in range(lados + 1):
            a = math.pi * j / lados  # de um bordo ao outro pelo fundo
            x = -math.cos(a) * meia
            prof = math.sin(a)
            z = alto + elev - prof * (alto + elev * 0.3)
            x *= 1 - (1 - fundo) * prof ** 2
            anel.append(bm.verts.new((x, y, z)))
        secoes.append(anel)
    for i in range(aneis):
        for j in range(lados):
            bm.faces.new([secoes[i][j], secoes[i][j + 1], secoes[i + 1][j + 1], secoes[i + 1][j]])
    # o convés (tampa de cima) e o espelho da popa
    for i in range(aneis):
        a, b = secoes[i], secoes[i + 1]
        bm.faces.new([a[0], b[0], b[-1], a[-1]])
    bm.faces.new(list(reversed(secoes[0])))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.004)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _novo(nome, bm, mat)
    return _chanfro(ob, chanfro)


def juntar(nome, obs, pai=None):
    """Aplica os modificadores e junta numa malha só (um nó no glTF), com a origem onde estava a do primeiro."""
    for o in obs:
        bpy.context.view_layer.objects.active = o
        for md in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    # a origem no (0,0,0) do mundo: as peças já foram postas no lugar certo
    ob.data.transform(ob.matrix_world)
    ob.matrix_world = Matrix.Identity(4)
    ob.name = nome
    ob.data.name = nome
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bm.to_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons:
        p.use_smooth = False
    if pai:
        ob.parent = pai
    return ob


def vazio(nome, pos=(0, 0, 0)):
    o = bpy.data.objects.new(nome, None)
    o.location = pos
    bpy.context.scene.collection.objects.link(o)
    return o


def triangulos(obs):
    n = 0
    for o in obs:
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n


def exporta(caminho, obs):
    """GLB com só estes objetos (e os filhos), Y para cima, sem textura."""
    bpy.ops.object.select_all(action="DESELECT")
    todos = set()
    for o in obs:
        todos.add(o)
        todos.update(o.children_recursive)
    for o in todos:
        o.select_set(True)
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=caminho, export_format="GLB", use_selection=True, export_yup=True,
                              export_apply=True, export_normals=True, export_materials="EXPORT")
    return triangulos(todos)


def previa(caminho, alvo=(0, 0, 0.5), dist=6.0, azimute=35.0, elev=32.0, largura=900, altura=640, lente=50):
    """Render 3/4 de cima, fundo neutro claro, sol de lado."""
    scn = bpy.context.scene
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scn.render.engine = eng
            break
        except TypeError:
            pass
    scn.render.resolution_x, scn.render.resolution_y = largura, altura
    scn.render.film_transparent = False
    try:
        scn.view_settings.view_transform = "Standard"
    except Exception:
        pass
    w = bpy.data.worlds.get("neutro") or bpy.data.worlds.new("neutro")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.78, 0.8, 0.82, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    scn.world = w
    for o in [o for o in scn.objects if o.get("_previa")]:
        bpy.data.objects.remove(o)
    sol = bpy.data.lights.new("sol", "SUN")
    sol.energy = 3.2
    so = bpy.data.objects.new("sol", sol)
    so.rotation_euler = (math.radians(50), 0, math.radians(-40))
    so["_previa"] = True
    scn.collection.objects.link(so)
    cam = bpy.data.cameras.new("cam")
    cam.lens = lente
    co = bpy.data.objects.new("cam", cam)
    co["_previa"] = True
    scn.collection.objects.link(co)
    a, e = math.radians(azimute), math.radians(elev)
    alvo = Vector(alvo)
    co.location = alvo + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    co.rotation_euler = (alvo - co.location).to_track_quat("-Z", "Y").to_euler()
    scn.camera = co
    scn.render.filepath = caminho
    bpy.ops.render.render(write_still=True)


def contorno_de_casco(comp, larg, proa, popa=0.12):
    """O contorno de cima de um casco no estilo Kenney Watercraft (de cima, no plano x, y), com a PROA para −Y (o lado que
    os navios da Kenney apontam): a popa reta com os cantos chanfrados e a proa em ponta de duas facetas."""
    L, W = comp / 2, larg / 2
    c = min(popa, W * 0.5)
    return [(-W + c, L), (-W, L - c), (-W, -L + proa), (-W * 0.42, -L + proa * 0.3), (0, -L),
            (W * 0.42, -L + proa * 0.3), (W, -L + proa), (W, L - c), (W - c, L)]


def bandeja(nome, comp, larg, alto, proa, mat_casco, mat_conves, borda=0.12, fundo=0.18, recuo=0.75, estreita=0.8):
    """O casco "bandeja" da Kenney: os costados inclinados do fundo (mais estreito) até a borda, a borda grossa em volta e o
    convés afundado no meio (fundo: quanto afunda). Devolve o objeto, já com os dois materiais."""
    bm = bmesh.new()
    def anel(pts, z):
        return [bm.verts.new((x, y, z)) for x, y in pts]
    topo = contorno_de_casco(comp, larg, proa)
    base = contorno_de_casco(comp * 0.94, larg * estreita, proa * 0.9)
    dentro = contorno_de_casco(comp - borda * 2.2, larg - borda * 2, max(0.05, proa - borda * 1.2))
    a_base = anel(base, 0.0)
    a_topo = anel(topo, alto)
    a_dentro = anel(dentro, alto)
    a_conves = anel(dentro, alto - fundo)
    n = len(topo)
    faces_casco, faces_conves = [], []
    for i in range(n):
        j = (i + 1) % n
        faces_casco.append(bm.faces.new([a_base[i], a_base[j], a_topo[j], a_topo[i]]))
        faces_casco.append(bm.faces.new([a_topo[i], a_topo[j], a_dentro[j], a_dentro[i]]))
        faces_casco.append(bm.faces.new([a_dentro[i], a_dentro[j], a_conves[j], a_conves[i]]))
    faces_casco.append(bm.faces.new(list(reversed(a_base))))
    faces_conves.append(bm.faces.new(a_conves))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in faces_conves:
        f.material_index = 1
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat_casco)
    me.materials.append(mat_conves)
    ob = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(ob)
    return _chanfro(ob, 0.025, 1, 30)


def poligono(nome, pts, z0, z1, mat, chanfro=0.02):
    """Um prisma de pé a partir de um contorno (x, y) de z0 a z1."""
    bm = bmesh.new()
    b = [bm.verts.new((x, y, z0)) for x, y in pts]
    t = [bm.verts.new((x, y, z1)) for x, y in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([b[i], b[j], t[j], t[i]])
    bm.faces.new(list(reversed(b)))
    bm.faces.new(t)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _chanfro(_novo(nome, bm, mat), chanfro)


def esvazia():
    """Tira os objetos da cena (os materiais ficam, para o próximo modelo)."""
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)


def material_kaykit(pasta, nome_img="boardgame_bits_texture.png"):
    """O material do KayKit Board Game Bits: a textura de paleta dele (web/public/mesa3d/), que o glTF separado aponta sem
    copiar (export_keep_originals). Cada face escolhe a CÉLULA (8 colunas × 4 linhas) e a altura do degradê dentro dela."""
    img = bpy.data.images.load(os.path.join(pasta, nome_img), check_existing=True)
    m = bpy.data.materials.new("boardgame")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.5
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    t.interpolation = "Closest"
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    return m


def pintar_faces(ob, regra):
    """Põe o UV de cada face num ponto da paleta: regra(centro, normal) -> (coluna, v) com v no UV do Blender (0 embaixo)."""
    me = ob.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv = me.uv_layers.active.data
    for p in me.polygons:
        ctr = ob.matrix_world @ p.center
        col, v = regra(ctr, p.normal)
        u = (col + 0.5) / 8
        for li in p.loop_indices:
            uv[li].uv = (u, v)


def aplicar_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for md in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)


def exporta_gltf(caminho, obs):
    """glTF separado (.gltf + .bin) como os do KayKit, a imagem apontada para a que já está na pasta (sem cópia)."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=caminho, export_format="GLTF_SEPARATE", use_selection=True, export_yup=True,
                              export_apply=True, export_keep_originals=True, export_materials="EXPORT")
    return triangulos(obs)
