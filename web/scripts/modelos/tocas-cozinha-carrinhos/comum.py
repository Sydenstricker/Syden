# Peças comuns dos modelos do grupo tocas-cozinha-carrinhos (24/11/2026): o extintor e a campainha da Cozinha, as peças de
# cruzamento e de agulha dos Carrinhos, o poste do Rolê e o cavaleiro montado das Tocas e Torres.
#
# Como os do Animal Grand Prix (tools/blender/parque_comum.py), mais simples: tudo nasce aqui, por script, com cor POR MATERIAL
# chapado (como a KayKit e a Kenney usam uma cor por pedaço da paleta), quinas chanfradas por um bevel pequeno, a sombra de
# oclusão assada na cor dos vértices (COLOR_0, que o three.js multiplica quando o material pede: ver `assar_oclusao`) e a
# exportação em GLB binário, sem textura. A prévia sai no Eevee, de 3/4 de cima, num fundo neutro.
#
# Rodar (PowerShell): web/scripts/modelos/tocas-cozinha-carrinhos/rodar.ps1 <item>   (o Blender da Store não mostra a saída:
# o log vai para <saida>/log.txt e o fim cria <saida>/pronto.txt).
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, "..", "..", "..", ".."))
FOTOS = os.path.join(REPO, "e2e", "fotos", "modelos", "tocas-cozinha-carrinhos")


def argumentos():
    """(saida, log, resto): os argumentos depois de "--"; o log pega o erro e escreve "pronto" no fim."""
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    saida = os.path.abspath(args[0]) if args else os.path.join(AQUI, "saida")
    os.makedirs(saida, exist_ok=True)
    log = open(os.path.join(saida, "log.txt"), "w", encoding="utf-8")

    def erro(tipo, valor, tb):
        import traceback
        log.write("".join(traceback.format_exception(tipo, valor, tb)) + "\n")
        log.flush()
        open(os.path.join(saida, "pronto.txt"), "w").write("erro")
        sys.__excepthook__(tipo, valor, tb)
        os._exit(1)
    sys.excepthook = erro
    return saida, log, args[1:]


def pronto(saida, log):
    log.write("pronto\n")
    log.close()
    open(os.path.join(saida, "pronto.txt"), "w").write("ok")


def limpar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _materiais.clear()


# ---------------------------------------------------------------- materiais

_materiais = {}


def mat(nome, cor, rug=0.8, metal=0.0, emissao=0.0):
    """Um material chapado (a cor em hex), que multiplica a cor dos vértices (a oclusão assada)."""
    if nome in _materiais:
        return _materiais[nome]
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    c = hex_rgb(cor)
    bsdf.inputs["Base Color"].default_value = (*c, 1)
    bsdf.inputs["Roughness"].default_value = rug
    bsdf.inputs["Metallic"].default_value = metal
    if emissao:
        bsdf.inputs["Emission Color"].default_value = (*c, 1)
        bsdf.inputs["Emission Strength"].default_value = emissao
    # a cor de vértice multiplicada só na prévia (o glTF leva o COLOR_0 à parte)
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs["A"].default_value = (*c, 1)
    nt.links.new(vc.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    _materiais[nome] = m
    return m


def hex_rgb(h):
    h = h.lstrip("#")
    s = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    # de sRGB para linear (o Blender e o glTF guardam a cor do material em linear)
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in s)


# ---------------------------------------------------------------- formas

def _ativo(ob):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.select_set(True)


def _fim(ob, nome, material, bevel=0.0, segs=2, suave=True, angulo=40):
    ob.name = nome
    ob.data.name = nome
    if material is not None:
        ob.data.materials.clear()
        ob.data.materials.append(material)
    if bevel > 0:
        b = ob.modifiers.new("bevel", "BEVEL")
        b.width = bevel
        b.segments = segs
        b.limit_method = "ANGLE"
        b.angle_limit = math.radians(30)
        b.harden_normals = False
    _ativo(ob)
    if suave:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angulo))
    return ob


def caixa(nome, tam, pos=(0, 0, 0), material=None, bevel=0.02, giro=(0, 0, 0)):
    """Uma caixa de tamanho (x, y, z) com o centro em pos (Z para cima, como o Blender)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos, rotation=giro)
    ob = bpy.context.active_object
    ob.scale = tam
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _fim(ob, nome, material, bevel)


def cilindro(nome, raio, altura, pos=(0, 0, 0), material=None, lados=16, bevel=0.015, giro=(0, 0, 0), raio2=None):
    """Um cilindro (ou tronco de cone, com raio2 em cima) de pé, com o centro em pos."""
    if raio2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=lados, radius=raio, depth=altura, location=pos, rotation=giro)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=lados, radius1=raio, radius2=raio2, depth=altura, location=pos, rotation=giro)
    return _fim(bpy.context.active_object, nome, material, bevel)


def esfera(nome, raio, pos=(0, 0, 0), material=None, seg=16, aneis=8, escala=(1, 1, 1), meia=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=aneis, radius=raio, location=pos)
    ob = bpy.context.active_object
    if meia:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        fora = [v for v in bm.verts if v.co.z < -1e-5]
        bmesh.ops.delete(bm, geom=fora, context="VERTS")
        # fecha o fundo
        borda = [e for e in bm.edges if e.is_boundary]
        if borda:
            bmesh.ops.holes_fill(bm, edges=borda)
        bm.to_mesh(ob.data)
        bm.free()
    ob.scale = escala
    _ativo(ob)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _fim(ob, nome, material, 0)


def toro(nome, raio, espessura, pos=(0, 0, 0), material=None, giro=(0, 0, 0), maior=24, menor=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=raio, minor_radius=espessura, major_segments=maior, minor_segments=menor,
                                     location=pos, rotation=giro)
    return _fim(bpy.context.active_object, nome, material, 0)


def tubo(nome, pontos, raio, material=None, lados=8):
    """Um tubo pela curva dos pontos (a mangueira, o cabo)."""
    cu = bpy.data.curves.new(nome, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = raio
    cu.bevel_resolution = max(1, lados // 4 - 1)
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pontos) - 1)
    for p, c in zip(sp.bezier_points, pontos):
        p.co = c
        p.handle_left_type = p.handle_right_type = "AUTO"
    sp.resolution_u = 6
    ob = bpy.data.objects.new(nome, cu)
    bpy.context.scene.collection.objects.link(ob)
    _ativo(ob)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.active_object
    return _fim(ob, nome, material, 0)


def juntar(nome, objetos):
    """Junta os objetos num só (com os modificadores aplicados)."""
    for o in objetos:
        _ativo(o)
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    _ativo(objetos[0])
    for o in objetos:
        o.select_set(True)
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = nome
    ob.data.name = nome
    return ob


def aplicar_tudo():
    for o in list(bpy.context.scene.objects):
        if o.type != "MESH":
            continue
        _ativo(o)
        for m in list(o.modifiers):
            if m.type == "ARMATURE":
                continue
            bpy.ops.object.modifier_apply(modifier=m.name)


# ---------------------------------------------------------------- a oclusão assada

def assar_oclusao(objetos, forca=0.55, distancia=0.25, amostras=24):
    """A sombra dos cantos, assada no Cycles na cor dos vértices "Col" (o glTF a leva como COLOR_0). 1 = sem sombra."""
    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.samples = amostras
    try:
        cena.cycles.device = "CPU"
    except Exception:
        pass
    mundo = cena.world or bpy.data.worlds.new("mundo")
    cena.world = mundo
    for ob in objetos:
        if ob.type != "MESH":
            continue
        me = ob.data
        if "Col" not in me.color_attributes:
            me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        me.color_attributes.active_color = me.color_attributes["Col"]
    # cada material ganha um nó AO -> emissão só durante o assado
    for ob in objetos:
        ob.select_set(False)
    guardados = []
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        nt = m.node_tree
        saida = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
        antes = saida.inputs["Surface"].links[0].from_socket if saida.inputs["Surface"].links else None
        ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
        ao.inputs["Distance"].default_value = distancia
        ao.samples = 16
        em = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(ao.outputs["AO"], em.inputs["Color"])
        nt.links.new(em.outputs["Emission"], saida.inputs["Surface"])
        guardados.append((m, antes, ao, em, saida))
    for ob in objetos:
        if ob.type != "MESH":
            continue
        _ativo(ob)
        bpy.ops.object.bake(type="EMIT", target="VERTEX_COLORS")
        # suaviza: a sombra em 1 - forca*(1-ao)
        me = ob.data
        attr = me.color_attributes["Col"]
        for d in attr.data:
            v = d.color[0]
            # o assado sai em linear; a oclusão fica clara (1) longe dos cantos
            s = 1 - forca * (1 - min(1.0, v))
            d.color = (s, s, s, 1)
    for m, antes, ao, em, saida in guardados:
        nt = m.node_tree
        nt.nodes.remove(ao)
        nt.nodes.remove(em)
        if antes is not None:
            nt.links.new(antes, saida.inputs["Surface"])


# ---------------------------------------------------------------- exportar e conferir

def triangulos(objetos=None):
    n = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objetos or bpy.context.scene.objects:
        if o.type != "MESH":
            continue
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        n += len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
    return n


def exportar(caminho, cores=True, animacoes=False):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(True)
    kw = dict(filepath=caminho, export_format="GLB", use_selection=False, export_yup=True, export_apply=True,
              export_animations=animacoes, export_materials="EXPORT")
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color="ACTIVE" if cores else "NONE")
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_colors=cores)


def previa(caminho, alvo=(0, 0, 0.3), distancia=2.0, altura=0.9, lado=1.0, res=512, fundo="#d9d4cc", orto=None):
    """A prévia: 3/4 de cima, sol e céu claros, fundo neutro."""
    cena = bpy.context.scene
    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            cena.render.engine = eng
            break
        except TypeError:
            continue
    cena.render.resolution_x = res
    cena.render.resolution_y = res
    cena.render.film_transparent = False
    mundo = cena.world or bpy.data.worlds.new("mundo")
    cena.world = mundo
    mundo.use_nodes = True
    bg = mundo.node_tree.nodes.get("Background") or mundo.node_tree.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (*hex_rgb(fundo), 1)
    bg.inputs["Strength"].default_value = 1.0
    try:
        cena.view_settings.view_transform = "Standard"
    except Exception:
        pass
    alvo = Vector(alvo)
    pos = alvo + Vector((lado * distancia * 0.75, -distancia * 0.75, distancia * altura))
    cam_d = bpy.data.cameras.new("cam")
    if orto:
        cam_d.type = "ORTHO"
        cam_d.ortho_scale = orto
    cam = bpy.data.objects.new("cam", cam_d)
    cena.collection.objects.link(cam)
    cam.location = pos
    cam.rotation_euler = (alvo - pos).to_track_quat("-Z", "Y").to_euler()
    cena.camera = cam
    sol_d = bpy.data.lights.new("sol", "SUN")
    sol_d.energy = 3.0
    sol = bpy.data.objects.new("sol", sol_d)
    cena.collection.objects.link(sol)
    sol.rotation_euler = (math.radians(50), math.radians(10), math.radians(30))
    cena.render.filepath = caminho
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    bpy.data.objects.remove(sol)


def importar(caminho):
    antes = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=caminho)
    return [o for o in bpy.context.scene.objects if o not in antes]


def caixa_de(objetos):
    dg = bpy.context.evaluated_depsgraph_get()
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objetos:
        if o.type != "MESH":
            continue
        for v in o.evaluated_get(dg).to_mesh().vertices:
            w = o.matrix_world @ v.co
            mn = Vector(map(min, mn, w))
            mx = Vector(map(max, mx, w))
        o.evaluated_get(dg).to_mesh_clear()
    return mn, mx


def cor_branca(ob):
    """A cor de vértice branca (sem sombra) num objeto que não tem: a prévia multiplica por ela."""
    me = ob.data
    if "Col" not in me.color_attributes:
        a = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        for d in a.data:
            d.color = (1, 1, 1, 1)
