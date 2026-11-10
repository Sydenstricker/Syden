# OS INIMIGOS DAS FASES NOVAS DA BRIGA NA HORTA (06/11/2026): os monstros da Quaternius (Ultimate Monsters, CC0; os glTF em
# e2e/3D/Assets/briga na horta/, fora do git) renderizados DE LADO, com a MESMA câmera, a mesma luz em 3 degraus e o mesmo
# virar de três quartos do coelho da Briga (briga.py): assim o coelho e os bichos parecem da mesma mão. As animações são as
# que vêm em cada arquivo (Idle, Walk, Punch, HitReact, Death...), amostradas "em dois" (12 desenhos por segundo): poucos
# desenhos por animação, como os jogos da época.
#
# Rodar (Blender da Store; a saída vai para t/saida/briga-monstros/log.txt):  powershell -File briga-monstros.ps1
# Depois: python briga-monstros-pos.py   (6× menor, paleta de cada bicho, contorno; sai em web/public/briga/<fase>/)
# No ambiente: SO_M=cogumelo,sapo para fazer só alguns.
#
# Os glTF NÃO vão ao site: só as folhas de pixel art que saem daqui.
import bpy, math, os, sys, json
from mathutils import Vector, Matrix

AQUI = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(AQUI, '..', '..', '..', '..', '3D', 'Assets', 'briga na horta'))
SAIDA = os.path.join(AQUI, 't', 'saida', 'briga-monstros')
os.makedirs(SAIDA, exist_ok=True)
LOG = open(os.path.join(SAIDA, 'log.txt'), 'w', encoding='utf-8')
sys.stdout = LOG
sys.stderr = LOG

# A ORDEM DOS DESENHOS NA FOLHA (o site tem a mesma: web/src/briga/sprites.ts, ANIMS_DOS_BICHOS):
# (nome, desenhos, qual animação do arquivo, de que fração a que fração dela, se é um ciclo)
ORDEM = [('parado', 4), ('andando', 6), ('prep', 2), ('golpe', 2), ('dor', 2), ('caido', 3), ('pulo', 2)]

# Cada bicho: o arquivo, a altura na tela (px, no desenho final; o coelho tem ~51), o lado do quadro (80 os comuns, 128 os
# chefes) e qual animação do arquivo faz cada uma das nossas. Os voadores andam com o voo.
H1 = dict(parado='Idle', andando='Walk', prep=('Punch', 0.0, 0.4), golpe=('Punch', 0.45, 0.8), dor=('HitReact', 0.15, 0.6),
          caido=('Death', 0.35, 1.0), pulo=('Jump', 0.3, 0.7))
H2 = dict(parado='Idle', andando='Walk', prep=('Bite_Front', 0.0, 0.4), golpe=('Bite_Front', 0.45, 0.8),
          dor=('HitRecieve', 0.15, 0.6), caido=('Death', 0.35, 1.0), pulo=('Jump', 0.25, 0.65))
VOA = dict(parado='Flying_Idle', andando='Fast_Flying', prep=('Headbutt', 0.0, 0.4), golpe=('Headbutt', 0.45, 0.8),
           dor=('HitReact', 0.15, 0.6), caido=('Death', 0.35, 1.0), pulo=('Punch', 0.3, 0.7))
MONSTROS = {
    # a floresta (o parallax do ansimuz)
    'cogumelo': dict(arq='Mushnub.gltf', px=52, lado=80, anim=H2),
    'sapo': dict(arq='Frog.gltf', px=39, lado=80, anim=H1),
    'abelha': dict(arq='Armabee.gltf', px=47, lado=80, anim=VOA),
    'rei-cogumelo': dict(arq='MushroomKing.gltf', px=95, lado=128, anim=H1),
    # o deserto
    'cacto': dict(arq='Cactoro.gltf', px=53, lado=80, anim=H1),
    'dino': dict(arq='Dino.gltf', px=46, lado=80, anim=dict(H1, prep=('Weapon', 0.0, 0.45), golpe=('Weapon', 0.5, 0.85))),
    'redemoinho': dict(arq='Hywirl.gltf', px=42, lado=80, anim=VOA),
    'alpaca-rei': dict(arq='Alpaking_Evolved.gltf', px=105, lado=128, anim=VOA),
    # a neve
    'macaco': dict(arq='Monkroose.gltf', px=54, lado=80, anim=H1),
    'espinhento': dict(arq='GreenSpikyBlob.gltf', px=38, lado=80, anim=H2),
    'golem': dict(arq='Goleling.gltf', px=57, lado=80, anim=dict(VOA, prep=('Punch', 0.0, 0.45), golpe=('Punch', 0.5, 0.85))),
    'yeti': dict(arq='Yeti.gltf', px=104, lado=128, anim=H1),
    # o castelo
    'diabinho': dict(arq='Demon.gltf', px=52, lado=80, anim=H1),
    'demonio-azul': dict(arq='BlueDemon.gltf', px=50, lado=80, anim=dict(H1, prep=('Weapon', 0.0, 0.45), golpe=('Weapon', 0.5, 0.85))),
    'fantasma': dict(arq='Ghost.gltf', px=40, lado=80, anim=VOA),
    'dragao': dict(arq='Dragon_Evolved.gltf', px=95, lado=128, anim=VOA),
    # a horta (09/11/2026, pedido dele: "não temos assets para substituir os inimigos?"): os ids continuam os de antes, porque
    # vão no quadro da rede e nos troféus; só o desenho trocou. A raposa virou o gato malhado (o laranja dela), o corvo o pombo
    # e o texugo a galinha gigante (escolhida entre três chefes: t/briga-horta-chefes.png). Os bichos redondos da Quaternius
    # (gato, pombo, galinha) têm a cara noutro eixo: com o giro dos outros, apareciam de costas, e `frente` os vira de três
    # quartos para a câmera, como o coelho.
    'raposa': dict(arq='Cat.gltf', px=52, lado=80, anim=H2, frente=34),
    'corvo': dict(arq='Pigeon.gltf', px=40, lado=80, anim=H2, frente=34),
    'texugo': dict(arq='Chicken.gltf', px=100, lado=128, anim=H2, frente=34),
}
FRENTE_GRAUS = 64   # o mesmo do coelho: virado para a direita da tela, um pouco para a câmera
ELEV = math.radians(20)
PX_POR_UNIDADE = 80 / 13.2   # a câmera do coelho da Briga: 13,2 unidades em 80 px
N = 6                         # o render é 6× o desenho final
LUZ = Vector((-0.55, -0.45, 0.70)).normalized()


def achar(arq):
    for d in sorted(os.listdir(ASSETS)):
        p = os.path.join(ASSETS, d, 'glTF', arq)
        if os.path.exists(p):
            return p
    raise FileNotFoundError(arq)


def material_de_luz(mat):
    # a cor da textura vezes 3 degraus de luz (a do coelho), em emissão pura: o pós prende tudo à paleta do bicho
    mat.use_nodes = True
    nt = mat.node_tree
    tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image), None)
    for n in list(nt.nodes):
        if tex is None or n.name != tex.name:
            nt.nodes.remove(n)
    N_, L_ = nt.nodes.new, nt.links.new
    geo = N_('ShaderNodeNewGeometry')
    dp = N_('ShaderNodeVectorMath'); dp.operation = 'DOT_PRODUCT'; dp.inputs[1].default_value = LUZ
    L_(geo.outputs['Normal'], dp.inputs[0])
    rampa = N_('ShaderNodeValToRGB'); rampa.color_ramp.interpolation = 'CONSTANT'
    el = rampa.color_ramp.elements
    el[0].position, el[0].color = 0.0, (0.70, 0.68, 0.80, 1)
    el[1].position, el[1].color = 0.42, (1.0, 1.0, 1.0, 1)
    e = el.new(0.72); e.color = (1.18, 1.16, 1.12, 1)
    mr = N_('ShaderNodeMath'); mr.operation = 'MULTIPLY_ADD'; mr.inputs[1].default_value = 0.5; mr.inputs[2].default_value = 0.5
    L_(dp.outputs['Value'], mr.inputs[0]); L_(mr.outputs[0], rampa.inputs['Fac'])
    mix = N_('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
    if tex is not None:
        tex.interpolation = 'Closest'
        L_(tex.outputs['Color'], mix.inputs['A'])
    else:
        mix.inputs['A'].default_value = (0.8, 0.8, 0.8, 1)
    L_(rampa.outputs['Color'], mix.inputs['B'])
    em = N_('ShaderNodeEmission'); L_(mix.outputs['Result'], em.inputs['Color'])
    out = N_('ShaderNodeOutputMaterial'); L_(em.outputs['Emission'], out.inputs['Surface'])


def mat_distancia():
    m = bpy.data.materials.new('distancia'); m.use_nodes = True
    t = m.node_tree
    for n in list(t.nodes):
        t.nodes.remove(n)
    cd = t.nodes.new('ShaderNodeCameraData')
    mrg = t.nodes.new('ShaderNodeMapRange'); mrg.inputs['From Min'].default_value = 30.0; mrg.inputs['From Max'].default_value = 50.0
    t.links.new(cd.outputs['View Z Depth'], mrg.inputs['Value'])
    e_ = t.nodes.new('ShaderNodeEmission'); t.links.new(mrg.outputs['Result'], e_.inputs['Color'])
    o_ = t.nodes.new('ShaderNodeOutputMaterial'); t.links.new(e_.outputs['Emission'], o_.inputs['Surface'])
    return m


def caixa(meshes):
    dg = bpy.context.evaluated_depsgraph_get()
    mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        for v in me.vertices:
            w = ev.matrix_world @ v.co
            for k in range(3):
                mn[k] = min(mn[k], w[k]); mx[k] = max(mx[k], w[k])
        ev.to_mesh_clear()
    return mn, mx


def pegar_acao(nome):
    for a in bpy.data.actions:
        if a.name == nome or a.name.endswith('|' + nome) or a.name.split('|')[-1] == nome:
            return a
    return None


def usar(arm, acao):
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = acao
    if hasattr(ad, 'action_slot') and getattr(acao, 'slots', None) and len(acao.slots) and ad.action_slot is None:
        ad.action_slot = acao.slots[0]


SO_M = os.environ.get('SO_M')
manifesto = {}
try:
    for nome, m in MONSTROS.items():
        if SO_M and nome not in SO_M.split(','):
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        cena = bpy.context.scene
        bpy.ops.import_scene.gltf(filepath=achar(m['arq']))
        arm = next((o for o in cena.objects if o.type == 'ARMATURE'), None)
        meshes = [o for o in cena.objects if o.type == 'MESH']
        print(nome, 'acoes', [a.name for a in bpy.data.actions])
        # tudo debaixo de uma raiz, que leva a escala, o giro e os pés ao chão
        raiz = bpy.data.objects.new('raiz', None); cena.collection.objects.link(raiz)
        for o in cena.objects:
            if o.parent is None and o is not raiz and o.type != 'CAMERA':
                mw = o.matrix_world.copy()
                o.parent = raiz
                o.matrix_world = mw
        for o in meshes:
            for s in o.material_slots:
                if s.material and not s.material.get('feito'):
                    material_de_luz(s.material)
                    s.material['feito'] = True
        # a medida é a do parado, no primeiro desenho
        parado = pegar_acao(m['anim']['parado'])
        if arm and parado:
            usar(arm, parado)
            cena.frame_set(int(parado.frame_range[0]))
        mn, mx = caixa(meshes)
        k = (m['px'] / PX_POR_UNIDADE) / (mx.z - mn.z)
        cx, cy = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2
        raiz.matrix_world = Matrix.Rotation(math.radians(m.get('frente', FRENTE_GRAUS)), 4, 'Z') @ Matrix.Scale(k, 4) @ Matrix.Translation((-cx, -cy, -mn.z))
        bpy.context.view_layer.update()

        # a câmera: a do coelho, com o quadro do tamanho do bicho; o pé (a origem) cai em (lado/2, 0,85 × lado)
        lado = m['lado']
        orto = lado / PX_POR_UNIDADE
        cam_d = bpy.data.cameras.new('camera'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = orto; cam_d.clip_end = 200
        cam = bpy.data.objects.new('camera', cam_d); cena.collection.objects.link(cam); cena.camera = cam
        cima = Vector((0, math.sin(ELEV), math.cos(ELEV)))
        frente = Vector((0, math.cos(ELEV), -math.sin(ELEV)))
        u = orto / lado
        cam.location = cima * ((0.85 * lado - lado / 2) * u) - frente * 40
        cam.rotation_euler = (math.pi / 2 - ELEV, 0, 0)
        r = cena.render
        r.engine = 'BLENDER_EEVEE'
        r.resolution_x = r.resolution_y = lado * N
        r.film_transparent = True
        r.filter_size = 0.0
        cena.eevee.taa_render_samples = 1
        cena.view_settings.view_transform = 'Standard'
        cena.view_settings.look = 'None'
        r.image_settings.file_format = 'PNG'
        r.image_settings.color_mode = 'RGBA'
        cena.world = bpy.data.worlds.new('mundo')
        dist = mat_distancia()
        pasta = os.path.join(SAIDA, nome)
        os.makedirs(pasta, exist_ok=True)

        def renderizar(caminho):
            r.filepath = caminho
            bpy.ops.render.render(write_still=True)
            guarda = [[s.material for s in o.material_slots] for o in meshes]
            for o in meshes:
                for s in o.material_slots:
                    s.material = dist
            cena.view_settings.view_transform = 'Raw'
            r.image_settings.color_depth = '16'
            r.filepath = caminho.replace('.png', '-z.png')
            bpy.ops.render.render(write_still=True)
            cena.view_settings.view_transform = 'Standard'
            r.image_settings.color_depth = '8'
            for o, g in zip(meshes, guarda):
                for s, mm in zip(o.material_slots, g):
                    s.material = mm

        for anim, n in ORDEM:
            spec = m['anim'][anim]
            nome_acao, de, ate = (spec, 0.0, 1.0) if isinstance(spec, str) else spec
            acao = pegar_acao(nome_acao) or parado
            ciclo = isinstance(spec, str)
            f0, f1 = acao.frame_range
            usar(arm, acao)
            for i in range(n):
                # o ciclo reparte a volta inteira; o golpe vai de `de` a `ate`, com o último desenho no `ate`
                fr = (i / n) if ciclo else (de + (ate - de) * (i / max(1, n - 1)))
                f = f0 + (f1 - f0) * fr
                cena.frame_set(int(f), subframe=f - int(f))
                bpy.context.view_layer.update()
                renderizar(os.path.join(pasta, f'{anim}-{i}.png'))
        manifesto[nome] = dict(lado=lado, peX=lado // 2, peY=round(0.85 * lado), px=m['px'])
        print('ok', nome)
    antigo = {}
    caminho = os.path.join(SAIDA, 'monstros.json')
    if os.path.exists(caminho):
        antigo = json.load(open(caminho))
    antigo.update(manifesto)
    json.dump(antigo, open(caminho, 'w'), indent=1)
    print('FIM')
except Exception:
    import traceback
    traceback.print_exc()
    print('ERRO')
finally:
    LOG.flush()
    with open(os.path.join(SAIDA, 'pronto.txt'), 'w') as f:
        f.write('ok')
