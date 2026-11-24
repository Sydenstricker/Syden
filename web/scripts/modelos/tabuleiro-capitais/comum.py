# O comum dos modelos do grupo "tabuleiro-capitais" (24/11/2026): a cenoura (comum a qualquer jogo), as peças do miolo do
# Tabuleiro da turma (a barraca da dourada, a toca, o chafariz, o banco, a cerquinha, as pedras da Serra) e o avião das Capitais.
# Tudo NOSSO, feito por script: primitivas do Blender com chanfro pequeno, cores chapadas no material (o estilo da mini cidade
# Kenney em volta: brinquedo, quinas macias, poucas cores), exportado em GLB (Y para cima) e com uma prévia em PNG.
#
# Rodar (PowerShell): web/scripts/modelos/tabuleiro-capitais/rodar.ps1 <script.py>
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, "..", "..", "..", ".."))
FOTOS = os.path.join(REPO, "e2e", "fotos", "modelos", "tabuleiro-capitais")
os.makedirs(FOTOS, exist_ok=True)
LOG = open(os.path.join(FOTOS, "log.txt"), "a", encoding="utf-8")


def log(*a):
    LOG.write(" ".join(str(x) for x in a) + "\n")
    LOG.flush()


def _erro(tipo, valor, tb):
    import traceback
    log("".join(traceback.format_exception(tipo, valor, tb)))
    pronto()
    sys.__excepthook__(tipo, valor, tb)


sys.excepthook = _erro


def pronto():
    with open(os.path.join(FOTOS, "pronto.txt"), "w") as f:
        f.write("ok")


_mats = {}


def limpar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()


# ———————————————————————————— materiais ————————————————————————————

def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def cor(hexa):
    h = hexa.lstrip("#")
    return tuple(_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def mat(nome, hexa, rug=0.85, metal=0.0):
    """Um material chapado (só a cor base): o glTF leva baseColorFactor, sem textura."""
    if nome in _mats:
        return _mats[nome]
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = cor(hexa)
    b.inputs["Roughness"].default_value = rug
    b.inputs["Metallic"].default_value = metal
    m.diffuse_color = cor(hexa)
    _mats[nome] = m
    return m


# ———————————————————————————— peças ————————————————————————————

def _ativo(ob):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.select_set(True)


def _fim(ob, m, chanfro=0.0, segs=1, liso=False):
    if m is not None:
        ob.data.materials.clear()
        ob.data.materials.append(m)
    if chanfro > 0:
        mod = ob.modifiers.new("chanfro", "BEVEL")
        mod.width = chanfro
        mod.segments = segs
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(40)
        _ativo(ob)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in ob.data.polygons:
        p.use_smooth = liso
    return ob


def caixa(m, tam, pos, rot=(0, 0, 0), chanfro=0.0, segs=1):
    """Caixa de tamanho (x, y, z) com o centro em pos (Blender: Z para cima)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos, rotation=rot)
    ob = bpy.context.active_object
    ob.scale = tam
    _ativo(ob)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _fim(ob, m, chanfro, segs)


def cilindro(m, r, h, pos, lados=12, rot=(0, 0, 0), r2=None, chanfro=0.0, segs=1, liso=False):
    """Cilindro (ou tronco de cone, com r2 no topo) de altura h com o centro em pos."""
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=lados, radius=r, depth=h, location=pos, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=lados, radius1=r, radius2=r2, depth=h, location=pos, rotation=rot)
    return _fim(bpy.context.active_object, m, chanfro, segs, liso)


def esfera(m, r, pos, seg=12, aneis=8, escala=(1, 1, 1), liso=True, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=aneis, radius=r, location=pos, rotation=rot)
    ob = bpy.context.active_object
    ob.scale = escala
    _ativo(ob)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _fim(ob, m, 0, 1, liso)


def ico(m, r, pos, sub=1, escala=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=pos, rotation=rot)
    ob = bpy.context.active_object
    ob.scale = escala
    _ativo(ob)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _fim(ob, m, 0, 1, False)


def torno(m, perfil, lados=12, pos=(0, 0, 0), liso=True, tampa_baixo=True, tampa_cima=True):
    """Um sólido de revolução em volta de Z: perfil = [(raio, z), ...] de baixo para cima."""
    bm = bmesh.new()
    aneis = []
    for r, z in perfil:
        anel = []
        for k in range(lados):
            a = k / lados * math.tau
            anel.append(bm.verts.new((pos[0] + r * math.cos(a), pos[1] + r * math.sin(a), pos[2] + z)))
        aneis.append(anel)
    for i in range(len(aneis) - 1):
        for k in range(lados):
            q = [aneis[i][k], aneis[i][(k + 1) % lados], aneis[i + 1][(k + 1) % lados], aneis[i + 1][k]]
            if perfil[i][0] < 1e-6:
                bm.faces.new([aneis[i][k], aneis[i + 1][(k + 1) % lados], aneis[i + 1][k]])
            elif perfil[i + 1][0] < 1e-6:
                bm.faces.new([aneis[i][k], aneis[i][(k + 1) % lados], aneis[i + 1][k]])
            else:
                bm.faces.new(q)
    if tampa_baixo and perfil[0][0] > 1e-6:
        bm.faces.new(list(reversed(aneis[0])))
    if tampa_cima and perfil[-1][0] > 1e-6:
        bm.faces.new(aneis[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("torno")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("torno", me)
    bpy.context.scene.collection.objects.link(ob)
    return _fim(ob, m, 0, 1, liso)


def juntar(obs, nome):
    """Junta as peças num objeto só (um nó do glTF), com os materiais de cada uma."""
    obs = [o for o in obs if o is not None]
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = nome
    ob.data.name = nome
    # junta os materiais repetidos (cada peça trouxe a sua lista)
    vistos = {}
    for i, s in enumerate(ob.material_slots):
        vistos.setdefault(s.material.name, i)
    if len(vistos) < len(ob.material_slots):
        mapa = {i: vistos[s.material.name] for i, s in enumerate(ob.material_slots)}
        for p in ob.data.polygons:
            p.material_index = mapa[p.material_index]
        # remove os espaços que sobraram (de trás para frente)
        _ativo(ob)
        for i in sorted(set(range(len(ob.material_slots))) - set(vistos.values()), reverse=True):
            ob.active_material_index = i
            bpy.ops.object.material_slot_remove()
    return ob


def pai(filhos, nome, pos=(0, 0, 0)):
    """Um nó vazio (para as peças que o jogo anima ou troca de material separadas)."""
    e = bpy.data.objects.new(nome, None)
    e.location = pos
    bpy.context.scene.collection.objects.link(e)
    for f in filhos:
        f.parent = e
    return e


def triangulos(obs):
    n = 0
    for o in obs:
        if o.type == "MESH":
            for p in o.data.polygons:
                n += len(p.vertices) - 2
    return n


# ———————————————————————————— saída ————————————————————————————

def exportar(caminho, obs):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(False)
    todos = set()
    for o in obs:
        todos.add(o)
        for c in o.children_recursive:
            todos.add(c)
    for o in todos:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=caminho, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_animations=False, export_materials="EXPORT", export_texcoords=False, export_normals=True,
        export_extras=False, export_cameras=False, export_lights=False,
    )
    tri = triangulos(todos)
    log(f"{os.path.relpath(caminho, REPO)}: {tri} triângulos, {os.path.getsize(caminho)} bytes")
    return tri


def previa(png, obs, angulo=35, elev=32, fundo="#d8dcd4"):
    """Uma foto de 3/4 por cima, de fundo neutro, enquadrando os objetos."""
    cena = bpy.context.scene
    bpy.context.view_layer.update()
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    todos = []
    for o in obs:
        todos.append(o)
        todos.extend(o.children_recursive)
    for o in todos:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w))
            mx = Vector(map(max, mx, w))
    centro = (mn + mx) / 2
    raio = (mx - mn).length / 2
    cam = bpy.data.cameras.new("cam")
    cam.lens = 50
    co = bpy.data.objects.new("cam", cam)
    cena.collection.objects.link(co)
    d = raio / math.tan(cam.angle / 2) * 1.15
    a, e = math.radians(angulo), math.radians(elev)
    co.location = centro + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * d
    co.rotation_euler = (centro - co.location).to_track_quat("-Z", "Y").to_euler()
    cena.camera = co
    sol = bpy.data.lights.new("sol", "SUN")
    sol.energy = 3.2
    so = bpy.data.objects.new("sol", sol)
    so.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    cena.collection.objects.link(so)
    w = bpy.data.worlds.new("mundo")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = cor(fundo)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    cena.world = w
    for motor in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "BLENDER_WORKBENCH"):
        try:
            cena.render.engine = motor
            break
        except TypeError:
            continue
    cena.render.resolution_x = cena.render.resolution_y = 520
    cena.render.film_transparent = False
    try:
        cena.view_settings.view_transform = "Standard"
    except Exception:
        pass
    cena.render.filepath = png
    bpy.ops.render.render(write_still=True)
    for o in (co, so):
        bpy.data.objects.remove(o)
    log(f"prévia: {os.path.relpath(png, REPO)} ({cena.render.engine})")


def argumentos():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
