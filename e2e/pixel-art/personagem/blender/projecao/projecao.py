# ALTERNATIVA B (rodada 2, 18/10/2026): o desenho do PixelLab PROJETADO no modelo.
#
# Para cada diagonal: o coelho na pose de descanso, visto da câmera de render daquela direção; o sprite do mascote
# (mascote/baixa-120/<direção>.png) é projetado da câmera sobre cada peça rígida (as coordenadas de textura de cada
# vértice são a posição dele na tela, levada ao sprite). Como as peças são rígidas, a textura vai junto quando elas se
# mexem: o quadro parado herda o desenho à mão, e os quadros varrendo o movem.
#
# Duas proteções:
#   - ENCAIXE: a silhueta do modelo e a do sprite não são iguais. O sprite é esticado (x e y separados) para a caixa do
#     modelo caber na caixa do desenho.
#   - OCLUSÃO: a projeção atravessa tudo; sem cuidado, o braço desenhado no sprite seria pintado também no corpo atrás
#     dele, e apareceria quando o braço se mexe. Cada vértice que a câmera NÃO vê (atrás de outra peça, ou de costas)
#     fica marcado e usa o material liso da alternativa A.
# Onde o sprite é transparente (o modelo passa da silhueta do desenho), também vale o material liso.
#
# Não roda sozinho: o coelho.py o carrega quando chamado com "-- 4 projecao".
import bpy, os, math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

PROJ_SEM = ('olho', 'boca', 'focinho', 'vassoura', 'poeira')   # o rosto vem do desenho; a vassoura não está nele
# o sprite SEM o contorno preto de fora (projecao/sprites/: só o preto que encosta no transparente; o do rosto fica): projetado com o contorno, o preto caía dentro do
# modelo onde as silhuetas não batem, e virava linha fantasma. O contorno vem do pós, como na A.
MASC = os.path.join(AQUI, 'projecao', 'sprites')


def caixa_do_sprite(img):
    w, h = img.size
    px = img.pixels[:]
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if px[(y * w + x) * 4 + 3] > 0.5:
                xs.append(x); ys.append(h - 1 - y)   # Blender guarda de baixo para cima
    return min(xs), max(xs), min(ys), max(ys)


def projetar(d):
    # o rosto modelado sai (o do desenho entra); a vassoura e a poeira saem da cena só durante a projeção, para não
    # taparem o corpo no teste de quem a câmera vê
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name.startswith(PROJ_SEM[:3]):
            o.hide_render = True
        if o.type == 'MESH' and o.name.startswith(PROJ_SEM):
            o.hide_viewport = True
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    img = bpy.data.images.load(os.path.join(MASC, f'{d}.png'), check_existing=True)
    img.colorspace_settings.name = 'sRGB'
    sx0, sx1, sy0, sy1 = caixa_do_sprite(img)
    frente = (cam.matrix_world.to_3x3() @ Vector((0, 0, -1))).normalized()
    partes = [o for o in bpy.data.objects if o.type == 'MESH' and not o.name.startswith(PROJ_SEM) and o.name in PARTES]

    def tela(co):
        v = world_to_camera_view(cena, cam, co)
        return v.x * 120, (1 - v.y) * 120

    # a caixa do modelo, em pixels do quadro (só os vértices que a câmera vê)
    vistos = {}
    xs, ys = [], []
    for o in partes:
        oe = o.evaluated_get(dg)
        mw = oe.matrix_world
        me = oe.data
        vis = []
        for v in me.vertices:
            co = mw @ v.co
            ok, loc, _n, _i, obj, _m = cena.ray_cast(dg, co - frente * 60, frente)
            ve = ok and obj.name == o.name and (loc - co).length < 0.06
            vis.append(ve)
            if ve:
                x, y = tela(co)
                xs.append(x); ys.append(y)
        vistos[o.name] = vis
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    kx = (sx1 - sx0) / max(1e-6, x1 - x0)
    ky = (sy1 - sy0) / max(1e-6, y1 - y0)
    print(f'projeção {d}: modelo {x0:.1f}-{x1:.1f} × {y0:.1f}-{y1:.1f}; sprite {sx0}-{sx1} × {sy0}-{sy1}; '
          f'esticado {kx:.3f} × {ky:.3f}')

    for o in partes:
        me = o.data
        nome_uv = f'proj-{d}'
        uv = me.uv_layers.get(nome_uv) or me.uv_layers.new(name=nome_uv)
        cor = me.color_attributes.get(f'visto-{d}') or me.color_attributes.new(f'visto-{d}', 'FLOAT_COLOR', 'POINT')
        oe = o.evaluated_get(dg)
        mw = oe.matrix_world
        coords = []
        for k, v in enumerate(me.vertices):
            x, y = tela(mw @ v.co)
            u = sx0 + 0.5 + (x - x0) * kx
            w = sy0 + 0.5 + (y - y0) * ky
            coords.append((u / 120, 1 - w / 120))
            vv = 1.0 if vistos[o.name][k] else 0.0
            cor.data[k].color = (vv, vv, vv, 1)
        for laco in me.loops:
            uv.data[laco.index].uv = coords[laco.vertex_index]
        # o material: o liso da A, com o desenho por cima onde ele existe e a câmera viu
        base = PARTES[o.name][1][0]
        nome_m = f'{base.name}-proj-{d}'
        m = bpy.data.materials.get(nome_m)
        if m is None:
            m = base.copy(); m.name = nome_m
            nt = m.node_tree
            emis = next(n for n in nt.nodes if n.type == 'EMISSION')
            liso = emis.inputs['Color'].links[0].from_socket
            uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = nome_uv
            tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
            tex.interpolation = 'Closest'; tex.extension = 'CLIP'
            nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
            at = nt.nodes.new('ShaderNodeVertexColor'); at.layer_name = f'visto-{d}'
            limiar = nt.nodes.new('ShaderNodeMath'); limiar.operation = 'GREATER_THAN'
            limiar.inputs[1].default_value = 0.5
            nt.links.new(at.outputs['Color'], limiar.inputs[0])
            alfa = nt.nodes.new('ShaderNodeMath'); alfa.operation = 'GREATER_THAN'
            alfa.inputs[1].default_value = 0.5
            nt.links.new(tex.outputs['Alpha'], alfa.inputs[0])
            fator = nt.nodes.new('ShaderNodeMath'); fator.operation = 'MULTIPLY'
            nt.links.new(limiar.outputs[0], fator.inputs[0]); nt.links.new(alfa.outputs[0], fator.inputs[1])
            mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
            nt.links.new(fator.outputs[0], mix.inputs['Factor'])
            nt.links.new(liso, mix.inputs['A'])
            nt.links.new(tex.outputs['Color'], mix.inputs['B'])
            nt.links.new(mix.outputs['Result'], emis.inputs['Color'])
        for s in o.material_slots:
            s.material = m
        PARTES[o.name] = (PARTES[o.name][0], [m])
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name.startswith(PROJ_SEM):
            o.hide_viewport = False
    bpy.context.view_layer.update()
