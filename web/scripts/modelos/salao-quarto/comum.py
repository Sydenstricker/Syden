# Peças comuns dos modelos do salão e do quarto 3D (24/11/2026): tudo nasce aqui, por código, no estilo dos pacotes que já
# estão na cena (KayKit Furniture Bits, Kenney Furniture Kit, Tiny Treats): proporções gordinhas, quinas chanfradas, poucas
# cores chapadas, e o DEGRADÊ de cima para baixo que as texturas de paleta desses pacotes têm (a cor de cada vértice, mais clara
# em cima e mais escura embaixo, multiplicada pela cor do material). Nada de textura nem de licença: os modelos são nossos.
#
# As medidas são as do three.js (x para a direita, y para cima, z para a FRENTE); a conversão para o Blender (z para cima, a
# frente em −y) é feita aqui, e o glTF a desfaz na exportação. Cada peça que se mexe (a hélice do ventilador) é um nó próprio,
# com nome, e as outras viram uma malha só (por material).
#
# Uso (pelo PowerShell): rodar.ps1 <script.py> [itens...]   — o script escreve o log e o pronto.txt em saida/.
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, "..", "..", "..", ".."))
PUBLICO = os.path.join(REPO, "web", "public")
FOTOS = os.path.join(REPO, "e2e", "fotos", "modelos", "salao-quarto")
SAIDA = os.path.join(AQUI, "saida")
os.makedirs(SAIDA, exist_ok=True)
os.makedirs(FOTOS, exist_ok=True)
_log = open(os.path.join(SAIDA, "log.txt"), "a", encoding="utf-8")


def log(*a):
    _log.write(" ".join(str(x) for x in a) + "\n")
    _log.flush()


def _erro(tipo, valor, tb):
    import traceback
    log("".join(traceback.format_exception(tipo, valor, tb)))
    pronto()
    sys.__excepthook__(tipo, valor, tb)


sys.excepthook = _erro


def pronto():
    with open(os.path.join(SAIDA, "pronto.txt"), "w") as f:
        f.write("pronto\n")


def itens_pedidos(todos):
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return [a for a in args if a in todos] or list(todos)


# ---------------------------------------------------------------- conversão de eixos

def B(v):
    """three (x, y, z) → Blender (x, −z, y)."""
    return Vector((v[0], -v[2], v[1]))


def limpa():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()


# ---------------------------------------------------------------- materiais

_mats = {}


def hexa(c):
    c = c.lstrip("#")
    srgb = [int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in srgb]
    return (*lin, 1.0)


def mat(nome, cor, rug=0.8, metal=0.0, emissao=None, forca=1.0):
    """Um material com nome (a cena acha 'tela', 'luz' pelo nome) e a cor de vértice multiplicada (o degradê)."""
    if nome in _mats:
        return _mats[nome]
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hexa(cor)
    bsdf.inputs["Roughness"].default_value = rug
    bsdf.inputs["Metallic"].default_value = metal
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs["A"].default_value = hexa(cor)
    nt.links.new(vc.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    if emissao:
        bsdf.inputs["Emission Color"].default_value = hexa(emissao)
        bsdf.inputs["Emission Strength"].default_value = forca
    _mats[nome] = m
    return m


# ---------------------------------------------------------------- peças

def _novo(nome, bm, material):
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def _por(ob, pos, rot):
    """rot: (rx, ry, rz) em radianos, nos eixos do three (aplicados x, depois y, depois z)."""
    R = Matrix.Identity(4)
    if rot:
        rx, ry, rz = rot
        # o eixo y do three é o z do Blender; o z do three é o −y do Blender
        R = Matrix.Rotation(rz, 4, Vector((0, -1, 0))) @ Matrix.Rotation(ry, 4, "Z") @ Matrix.Rotation(rx, 4, "X")
    ob.matrix_world = Matrix.Translation(B(pos)) @ R
    return ob


def _chanfrar(bm, ch, segs=1):
    if ch <= 1e-4:
        return
    bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=ch, offset_type="OFFSET", segments=segs, profile=0.5,
                    affect="EDGES", clamp_overlap=True)


def caixa(tam, pos, material, chanfro=0.02, rot=None, nome="caixa", segs=1):
    """Um bloco de tam (x, y, z) do three, com as quinas chanfradas."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * tam[0], v.co.y * tam[2], v.co.z * tam[1]))
    _chanfrar(bm, min(chanfro, min(tam) * 0.3), segs)
    return _por(_novo(nome, bm, material), pos, rot)


def cilindro(r1, r2, h, pos, material, lados=16, rot=None, chanfro=0.01, nome="cilindro", tampa=True):
    """Em pé no eixo y do three (raio r1 embaixo, r2 em cima), centrado em pos."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=tampa, cap_tris=False, segments=lados, radius1=r1, radius2=r2, depth=h)
    if chanfro > 0 and tampa:
        aneis = [e for e in bm.edges if all(abs(abs(v.co.z) - h / 2) < 1e-5 for v in e.verts) and
                 len(e.link_faces) == 2 and any(len(f.verts) > 4 for f in e.link_faces)]
        bmesh.ops.bevel(bm, geom=aneis, offset=min(chanfro, h * 0.3, min(r1, r2 or r1) * 0.3), offset_type="OFFSET",
                        segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
    return _por(_novo(nome, bm, material), pos, rot)


def esfera(r, pos, material, seg=12, aneis=8, escala=(1, 1, 1), rot=None, nome="esfera"):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=aneis, radius=r)
    for v in bm.verts:
        v.co = Vector((v.co.x * escala[0], v.co.y * escala[2], v.co.z * escala[1]))
    return _por(_novo(nome, bm, material), pos, rot)


def toro(R, r, pos, material, seg=24, lados=8, arco=math.tau, rot=None, nome="toro", escala=(1, 1, 1)):
    """No plano xy do three (de frente), começando em +x e girando para +y; arco < τ deixa as pontas abertas."""
    bm = bmesh.new()
    fechado = arco >= math.tau - 1e-6
    n = seg if fechado else seg + 1
    aneis = []
    for i in range(n):
        a = arco * i / seg
        c = Vector((math.cos(a) * R, math.sin(a) * R, 0))
        d = Vector((math.cos(a), math.sin(a), 0))
        anel = []
        for k in range(lados):
            b = math.tau * k / lados
            p = c + d * (math.cos(b) * r) + Vector((0, 0, math.sin(b) * r))
            anel.append(bm.verts.new((p.x * escala[0], -p.z * escala[2], p.y * escala[1])))
        aneis.append(anel)
    pares = range(n) if fechado else range(n - 1)
    for i in pares:
        a, b = aneis[i], aneis[(i + 1) % n]
        for k in range(lados):
            bm.faces.new([a[k], a[(k + 1) % lados], b[(k + 1) % lados], b[k]])
    if not fechado:
        bm.faces.new(list(reversed(aneis[0])))
        bm.faces.new(aneis[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return _por(_novo(nome, bm, material), pos, rot)


def torno(perfil, pos, material, lados=20, rot=None, nome="torno", fechar_base=True, fechar_topo=True):
    """O perfil [(raio, y), …] de baixo para cima, girado em volta do eixo y do three (a taça, o balde)."""
    bm = bmesh.new()
    aneis = []
    for r, y in perfil:
        anel = []
        for k in range(lados):
            a = math.tau * k / lados
            anel.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, y)))
        aneis.append(anel)
    for i in range(len(aneis) - 1):
        a, b = aneis[i], aneis[i + 1]
        for k in range(lados):
            bm.faces.new([a[k], a[(k + 1) % lados], b[(k + 1) % lados], b[k]])
    if fechar_base and perfil[0][0] > 1e-4:
        bm.faces.new(list(reversed(aneis[0])))
    if fechar_topo and perfil[-1][0] > 1e-4:
        bm.faces.new(aneis[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = _novo(nome, bm, material)
    for p in ob.data.polygons:
        p.use_smooth = True
    return _por(ob, pos, rot)


def placa(contorno, esp, pos, material, chanfro=0.01, rot=None, nome="placa"):
    """O contorno [(x, y), …] (anti-horário, no plano de frente do three) puxado `esp` para a frente (+z), centrado em z."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, esp / 2, y)) for x, y in contorno]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    novos = [v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=novos, vec=(0, -esp, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if chanfro > 0:
        quinas = [e for e in bm.edges if abs(e.verts[0].co.y - e.verts[1].co.y) < 1e-6]
        bmesh.ops.bevel(bm, geom=quinas, offset=min(chanfro, esp * 0.35), offset_type="OFFSET", segments=1, profile=0.5,
                        affect="EDGES", clamp_overlap=True)
    return _por(_novo(nome, bm, material), pos, rot)


def tubo(pontos, r, material, lados=8, nome="tubo", fechado=False):
    """Um tubo pelos pontos (do three), de raio r (um número, ou um por ponto): o fio, a alça. `fechado`: o último ponto
    emenda no primeiro (um anel), sem tampas."""
    bm = bmesh.new()
    pts = [B(p) for p in pontos]
    n = len(pts)
    raios = r if isinstance(r, (list, tuple)) else [r] * n
    aneis = []
    normal = None
    for i, p in enumerate(pts):
        if fechado:
            tan = (pts[(i + 1) % n] - pts[(i - 1) % n]).normalized()
        else:
            tan = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        if normal is None:
            normal = Vector((0, 0, 1)) if fechado and abs(tan.z) < 0.9 else tan.orthogonal().normalized()
        normal = (normal - tan * normal.dot(tan)).normalized()
        bi = tan.cross(normal)
        aneis.append([bm.verts.new(p + (normal * math.cos(math.tau * k / lados) + bi * math.sin(math.tau * k / lados)) * raios[i])
                      for k in range(lados)])
    for i in range(n if fechado else n - 1):
        a, b = aneis[i], aneis[(i + 1) % n]
        for k in range(lados):
            bm.faces.new([a[k], a[(k + 1) % lados], b[(k + 1) % lados], b[k]])
    if not fechado:
        bm.faces.new(list(reversed(aneis[0])))
        bm.faces.new(aneis[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = _novo(nome, bm, material)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


# ---------------------------------------------------------------- acabamento

def degrade(ob, topo=1.0, base=0.74):
    """A cor de cada vértice pelo alto dele na própria peça: o degradê de cima para baixo das paletas do KayKit e do Tiny Treats."""
    me = ob.data
    if "Col" not in me.color_attributes:
        me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    col = me.color_attributes["Col"]
    zs = [(ob.matrix_world @ v.co).z for v in me.vertices]
    z0, z1 = min(zs), max(zs)
    alto = max(1e-5, z1 - z0)
    for li, loop in enumerate(me.loops):
        t = (zs[loop.vertex_index] - z0) / alto
        k = base + (topo - base) * t
        col.data[li].color = (k, k, k, 1.0)


def juntar(obs, nome, topo=1.0, base=0.74, pai=None):
    """As peças viram uma malha só (cada uma com o seu degradê), um nó com nome."""
    obs = [o for o in obs if o]
    for o in obs:
        degrade(o, topo, base)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = nome
    ob.data.name = nome
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # liso nas curvas, quina nas quinas (como os pacotes: o cilindro não mostra as faces)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    except Exception as e:
        log("sem shade_smooth_by_angle:", e)
    if pai:
        ob.parent = pai
    return ob


def no(nome, pos=(0, 0, 0), pai=None):
    """Um nó vazio com nome (o pivô de uma peça que se mexe)."""
    e = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = B(pos)
    if pai:
        e.parent = pai
    bpy.context.view_layer.update()
    return e


def triangulos():
    n = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            me = o.evaluated_get(dg).data
            n += sum(len(p.vertices) - 2 for p in me.polygons)
    return n


def exportar(caminho):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    # a peça que não passou por juntar (o vidro, o morro) ganha a cor de vértice lisa: sem ela, o material sairia preto
    for o in bpy.context.scene.objects:
        if o.type == "MESH" and "Col" not in o.data.color_attributes:
            degrade(o, 1.0, 1.0)
    kw = dict(filepath=caminho, export_format="GLB", export_yup=True, export_apply=True, export_materials="EXPORT")
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color="ACTIVE")
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    log("exportado", os.path.relpath(caminho, REPO), "triângulos:", triangulos())


def previa(nome, distancia=None, angulo=0.6):
    """A foto de 3/4 de cima, num fundo neutro (EEVEE; sem placa, o Workbench)."""
    cena = bpy.context.scene
    obs = [o for o in cena.objects if o.type == "MESH"]
    pts = [o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centro = (lo + hi) / 2
    raio = (hi - lo).length / 2
    cam_d = bpy.data.cameras.new("cam")
    cam_d.type = "ORTHO"
    cam_d.ortho_scale = raio * 2.3
    cam = bpy.data.objects.new("cam", cam_d)
    cena.collection.objects.link(cam)
    d = distancia or raio * 6
    # 3/4 de cima, olhando a frente (−y do Blender) da esquerda
    direcao = Vector((0.55, -1.0, angulo)).normalized()
    cam.location = centro + direcao * d
    cam.rotation_euler = (centro - cam.location).to_track_quat("-Z", "Y").to_euler()
    cena.camera = cam
    sol = bpy.data.lights.new("sol", "SUN")
    sol.energy = 3.0
    s = bpy.data.objects.new("sol", sol)
    s.rotation_euler = (0.8, 0.2, 0.6)
    cena.collection.objects.link(s)
    mundo = bpy.data.worlds.new("mundo")
    mundo.use_nodes = True
    mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.75, 0.73, 0.70, 1)
    mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    cena.world = mundo
    cena.render.resolution_x = cena.render.resolution_y = 512
    cena.render.film_transparent = False
    try:
        cena.render.engine = "BLENDER_EEVEE"
    except TypeError:
        cena.render.engine = "BLENDER_EEVEE_NEXT"
    cena.view_settings.view_transform = "Standard"
    caminho = os.path.join(FOTOS, nome + ".png")
    cena.render.filepath = caminho
    try:
        bpy.ops.render.render(write_still=True)
    except Exception as e:
        log("eevee falhou:", e, "— workbench")
        cena.render.engine = "BLENDER_WORKBENCH"
        cena.display.shading.color_type = "MATERIAL"
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    bpy.data.objects.remove(s)
    log("prévia", os.path.relpath(caminho, REPO))
