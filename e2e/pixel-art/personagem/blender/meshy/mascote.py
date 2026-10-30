# O PILOTO DO CAMINHO 3D (30/10/2026): o mascote que o Meshy fez do conceito.png (e2e/3D/Personagens/mascote.glb), com o
# NOSSO esqueleto, as animações parado, andando e varrendo, renderizado nas 4 diagonais com a câmera do teste de 18/10.
#
# Rodar (Blender da Store; a saída vai para saida/log.txt):  powershell -File rodar.ps1
# Depois: python pos.py   (paleta do mascote, contorno, faixas, GIFs e o salão)
#
# O RITMO: 12 desenhos por segundo ("em dois", decisão de 18/10/2026). Cada animação tem os desenhos de UM ciclo.
import bpy, bmesh, math, os, sys, json
from mathutils import Vector, Matrix, Quaternion

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'saida')
os.makedirs(SAIDA, exist_ok=True)
MODELO = os.path.normpath(os.path.join(AQUI, '..', '..', '..', '..', '3D', 'Personagens', 'mascote.glb'))
ESCALA = 4
LOG = open(os.path.join(SAIDA, 'log.txt'), 'w', encoding='utf-8')
sys.stdout = LOG
sys.stderr = LOG

# quantos desenhos tem um ciclo de cada animação (a 12 por segundo)
ANIMACOES = {'parado': 16, 'andando': 8, 'varrendo': 8}
SO = os.environ.get('SO')   # SO=andando renderiza só uma

try:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cena = bpy.context.scene

    # ============================ O MODELO ============================
    # O Meshy entrega uma malha só, com as costuras da textura abertas (vértices repetidos): fecham-se, senão os pesos
    # automáticos tratam cada pedaço como uma ilha. Altura levada a 8,4 (a do coelho de 18/10), pés no chão, olhando -Y.
    bpy.ops.import_scene.gltf(filepath=MODELO)
    MESH = [o for o in cena.objects if o.type == 'MESH'][0]
    MESH.name = 'mascote'
    for o in list(cena.objects):
        if o is not MESH and o.type == 'EMPTY':
            bpy.data.objects.remove(o)
    MESH.parent = None
    bpy.context.view_layer.objects.active = MESH
    MESH.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bm = bmesh.new(); bm.from_mesh(MESH.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    zs = [v.co.z for v in bm.verts]
    z0, z1 = min(zs), max(zs)
    k = 8.4 / (z1 - z0)
    for v in bm.verts:
        v.co = Vector((v.co.x * k, v.co.y * k, (v.co.z - z0) * k))
    bm.to_mesh(MESH.data); bm.free()
    for p in MESH.data.polygons:
        p.use_smooth = True
    print('vertices', len(MESH.data.vertices))

    # ============================ O MATERIAL ============================
    # A cor é a da textura do Meshy; a luz é a do coelho de 18/10 (direção fixa no mundo, do lado da janela do salão),
    # em 3 degraus que só multiplicam a cor. Sem lâmpada: emissão pura, e o pós prende tudo à paleta do mascote.
    LUZ = Vector((-0.55, -0.45, 0.70)).normalized()
    mat = MESH.data.materials[0]
    nt = mat.node_tree
    tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image and
               any(l.to_socket.name == 'Base Color' for l in n.outputs['Color'].links))
    tex.interpolation = 'Closest'
    nome_tex = tex.name
    for n in list(nt.nodes):
        if n.name != nome_tex:
            nt.nodes.remove(n)
    tex = nt.nodes[nome_tex]   # a referência antiga não vale depois de remover nós
    N, L = nt.nodes.new, nt.links.new
    geo = N('ShaderNodeNewGeometry')
    dp = N('ShaderNodeVectorMath'); dp.operation = 'DOT_PRODUCT'; dp.inputs[1].default_value = LUZ
    L(geo.outputs['Normal'], dp.inputs[0])
    rampa = N('ShaderNodeValToRGB'); rampa.color_ramp.interpolation = 'CONSTANT'
    el = rampa.color_ramp.elements
    # (medido contra o desenho: com 0,86 no meio, tudo saía um tom abaixo, o pelo em 210 e não em 224)
    el[0].position, el[0].color = 0.0, (0.74, 0.72, 0.84, 1)    # a sombra puxa um pouco para o frio, como a do mascote
    el[1].position, el[1].color = 0.42, (1.0, 1.0, 1.02, 1)
    e = el.new(0.72); e.color = (1.22, 1.2, 1.18, 1)
    mr = N('ShaderNodeMath'); mr.operation = 'MULTIPLY_ADD'; mr.inputs[1].default_value = 0.5; mr.inputs[2].default_value = 0.5
    L(dp.outputs['Value'], mr.inputs[0])
    L(mr.outputs[0], rampa.inputs['Fac'])
    mix = N('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
    L(tex.outputs['Color'], mix.inputs['A']); L(rampa.outputs['Color'], mix.inputs['B'])
    # os escuros da textura são mais pretos que o moletom do desenho (50, 33, 45): soma-se um tico de roxo, que no
    # linear só pesa onde a cor é quase preta
    lev = N('ShaderNodeVectorMath'); lev.operation = 'ADD'; lev.inputs[1].default_value = (0.022, 0.011, 0.02)
    L(mix.outputs['Result'], lev.inputs[0])
    em = N('ShaderNodeEmission'); L(lev.outputs['Vector'], em.inputs['Color'])
    out = N('ShaderNodeOutputMaterial'); L(em.outputs['Emission'], out.inputs['Surface'])
    MAT_COR = mat

    # ============================ O ESQUELETO ============================
    # Medido no modelo (30/10/2026): pés em z 0–0,5 (x ±0,84), barra do moletom ~0,9, braços curtos pendurados do ombro
    # (±1,55; 2,55) à mão (±1,9; 1,25), pescoço ~2,9, cabeça até ~6, orelhas de 5,8 a 8,4. Os mesmos nomes do coelho.py.
    bpy.ops.object.armature_add(location=(0, 0, 0))
    ARM = bpy.context.object
    ARM.name = 'esqueleto'
    bpy.ops.object.mode_set(mode='EDIT')
    eb = ARM.data.edit_bones
    for b in list(eb):
        eb.remove(b)

    def osso(nome, cabeca, cauda, pai=None, ligado=False, deforma=True):
        b = eb.new(nome)
        b.head, b.tail = Vector(cabeca), Vector(cauda)
        b.use_deform = deforma
        if pai:
            b.parent = eb[pai]
            b.use_connect = ligado
        return b

    OMBRO, COTOVELO, MAO = (1.5, -0.15, 2.55), (1.82, -0.2, 1.95), (1.92, -0.2, 1.2)
    osso('raiz', (0, 0, 0), (0, 0, 0.6), deforma=False)
    osso('quadril', (0, 0, 0.7), (0, 0, 1.4), 'raiz')
    osso('tronco', (0, 0, 1.4), (0, 0, 2.9), 'quadril', True)
    osso('cabeca', (0, 0, 2.9), (0, 0, 5.8), 'tronco', True)
    for lado, s in (('L', 1), ('R', -1)):
        osso(f'orelha.{lado}', (s * 0.9, -0.05, 5.7), (s * 1.0, 0.15, 8.3), 'cabeca')
        osso(f'braco.{lado}', (s * OMBRO[0], OMBRO[1], OMBRO[2]), (s * COTOVELO[0], COTOVELO[1], COTOVELO[2]), 'tronco')
        osso(f'antebraco.{lado}', (s * COTOVELO[0], COTOVELO[1], COTOVELO[2]), (s * MAO[0], MAO[1], MAO[2]), f'braco.{lado}', True)
        osso(f'perna.{lado}', (s * 0.8, -0.1, 1.0), (s * 0.83, -0.2, 0.05), 'quadril')
        osso(f'polo.{lado}', (s * 2.8, 0.9, 1.9), (s * 2.8, 0.9, 2.3), 'tronco', deforma=False)

    # A vassoura, como no coelho.py: um osso da pegada ao pé dela no chão, e a mão segue um alvo preso a ele (IK).
    # MAS COM UMA MÃO SÓ, DO LADO: o braço deste corpo é curto (1,35 do ombro à mão) e a barriga sai 1,85 para a frente.
    # Medido na primeira rodada: as duas mãos num cabo na frente esticavam a manga ao dobro e arrastavam o moletom junto.
    PE_VASSOURA = Vector((2.0, -2.2, 0.0))
    PEGADA = Vector((1.6, -1.1, 1.95))
    EIXO = (PEGADA - PE_VASSOURA).normalized()
    osso('vassoura', PEGADA, PE_VASSOURA, 'raiz', deforma=False)
    osso('alvo.L', PEGADA, PEGADA + Vector((0, 0, 0.3)), 'vassoura', deforma=False)
    bpy.ops.object.mode_set(mode='OBJECT')

    # PESOS AUTOMÁTICOS (o "calor" do Blender), depois corrigidos onde a geometria engana: o braço encosta no moletom e
    # roubaria o flanco; a orelha só pega o que está acima da testa.
    bpy.ops.object.select_all(action='DESELECT')
    MESH.select_set(True); ARM.select_set(True)
    bpy.context.view_layer.objects.active = ARM
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    grupos = {g.name: g for g in MESH.vertex_groups}
    print('grupos', sorted(grupos))
    sem_peso = 0
    for v in MESH.data.vertices:
        co = v.co
        tot = sum(x.weight for x in v.groups)
        if tot < 1e-4:
            sem_peso += 1
        for lado, s in (('L', 1), ('R', -1)):
            # orelha só acima de 5,6, e acima de 6,3 é toda dela
            if co.z < 5.6:
                grupos[f'orelha.{lado}'].remove([v.index])
            elif s * co.x > 0.25 and co.z > 6.3:
                for g in grupos.values():
                    g.remove([v.index])
                grupos[f'orelha.{lado}'].add([v.index], 1.0, 'REPLACE')
            # braço só fora do flanco (|x| > 1,45) e abaixo do ombro
            if s * co.x < 1.45 or co.z > 2.85:
                grupos[f'braco.{lado}'].remove([v.index])
                grupos[f'antebraco.{lado}'].remove([v.index])
            # perna só abaixo da barra
            if co.z > 1.1:
                grupos[f'perna.{lado}'].remove([v.index])
    print('sem peso antes', sem_peso)
    # quem ficou sem peso nenhum (o corte acima pode zerar) vai para o osso mais perto entre tronco, quadril e cabeça
    for v in MESH.data.vertices:
        if sum(x.weight for x in v.groups) < 1e-4:
            z = v.co.z
            nome = 'cabeca' if z > 2.9 else 'tronco' if z > 1.4 else 'quadril'
            grupos[nome].add([v.index], 1.0, 'REPLACE')
    # normalizar
    bpy.context.view_layer.objects.active = MESH
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.mode_set(mode='OBJECT')

    # ============================ A VASSOURA ============================
    def lin(c):
        def f(v):
            v /= 255
            return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
        return (f(c[0]), f(c[1]), f(c[2]), 1)

    def mat_liso(nome, cor):
        m = bpy.data.materials.new(nome); m.use_nodes = True
        t = m.node_tree
        for n in list(t.nodes):
            t.nodes.remove(n)
        g = t.nodes.new('ShaderNodeNewGeometry')
        d = t.nodes.new('ShaderNodeVectorMath'); d.operation = 'DOT_PRODUCT'; d.inputs[1].default_value = LUZ
        t.links.new(g.outputs['Normal'], d.inputs[0])
        r = t.nodes.new('ShaderNodeValToRGB'); r.color_ramp.interpolation = 'CONSTANT'
        c = Vector(lin(cor)[:3])
        r.color_ramp.elements[0].color = tuple(c * 0.6) + (1,)
        r.color_ramp.elements[1].position = 0.45
        r.color_ramp.elements[1].color = tuple(c) + (1,)
        m2 = t.nodes.new('ShaderNodeMath'); m2.operation = 'MULTIPLY_ADD'; m2.inputs[1].default_value = 0.5; m2.inputs[2].default_value = 0.5
        t.links.new(d.outputs['Value'], m2.inputs[0]); t.links.new(m2.outputs[0], r.inputs['Fac'])
        e_ = t.nodes.new('ShaderNodeEmission'); t.links.new(r.outputs['Color'], e_.inputs['Color'])
        o_ = t.nodes.new('ShaderNodeOutputMaterial'); t.links.new(e_.outputs['Emission'], o_.inputs['Surface'])
        return m

    MADEIRA, PALHA, AMARRA = mat_liso('madeira', (140, 90, 50)), mat_liso('palha', (204, 160, 82)), mat_liso('amarra', (160, 50, 54))
    pecas = []
    COMP = (PEGADA - PE_VASSOURA).length + 0.8
    bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=COMP - 0.85, location=(0, 0, 0.85 + (COMP - 0.85) / 2 + 0.2), vertices=16)
    o = bpy.context.object; o.data.materials.append(MADEIRA); pecas.append(o)
    bpy.ops.mesh.primitive_cone_add(radius1=0.8, radius2=0.24, depth=1.2, location=(0, 0, 0.6), vertices=24)
    o = bpy.context.object; o.scale = (1, 0.4, 1); o.data.materials.append(PALHA); pecas.append(o)
    bpy.ops.mesh.primitive_cylinder_add(radius=1, depth=0.18, location=(0, 0, 1.12), vertices=24)
    o = bpy.context.object; o.scale = (0.3, 0.16, 1); o.data.materials.append(AMARRA); pecas.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in pecas:
        o.select_set(True)
        for p in o.data.polygons:
            p.use_smooth = True
    bpy.context.view_layer.objects.active = pecas[0]
    bpy.ops.object.join()
    VASS = bpy.context.object
    VASS.name = 'vassoura'
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    VASS.matrix_world = Matrix.Translation(PE_VASSOURA) @ EIXO.to_track_quat('Z', 'X').to_matrix().to_4x4()
    mw = VASS.matrix_world.copy()
    VASS.parent = ARM; VASS.parent_type = 'BONE'; VASS.parent_bone = 'vassoura'
    bpy.context.view_layer.update()
    VASS.matrix_world = mw

    ik = ARM.pose.bones['antebraco.L'].constraints.new('IK')
    ik.name = 'IK'
    ik.target, ik.subtarget = ARM, 'alvo.L'
    ik.pole_target, ik.pole_subtarget = ARM, 'polo.L'
    ik.pole_angle = math.radians(-90)
    ik.chain_count = 2
    ik.use_stretch = False

    # ============================ AS POSES ============================
    pbs = ARM.pose.bones
    for pb in pbs:
        pb.rotation_mode = 'QUATERNION'

    def local(pb, eixo_mundo):
        return (pb.bone.matrix_local.to_3x3().inverted() @ Vector(eixo_mundo)).normalized()

    def gira(pb, *rots):
        q = Quaternion()
        for eixo, graus in rots:
            q = q @ Quaternion(local(pb, eixo), math.radians(graus))
        pb.rotation_quaternion = q

    def anda(pb, desl):
        pb.location = pb.bone.matrix_local.to_3x3().inverted() @ Vector(desl)

    def zerar():
        for pb in pbs:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)

    def onda(p):
        # o tempo torto de 18/10: pressa no golpe, volta mais lenta
        return math.sin(p + 0.55 * math.sin(p))

    def orelhas(p, forca=1.0):
        # atrasadas em relação à cabeça, balançando no ritmo do corpo
        for lado, s in (('L', 1), ('R', -1)):
            gira(pbs[f'orelha.{lado}'], ((0, 1, 0), -s * 4 * forca * math.sin(p - 1.2)),
                 ((1, 0, 0), 6 * forca * math.cos(2 * p - 1.0)))

    BRACOS_SOLTOS = 18   # graus: o braço afasta um pouco do corpo, para não sumir no moletom

    def bracos(abre=0.0, balanco=0.0):
        for lado, s in (('L', 1), ('R', -1)):
            gira(pbs[f'braco.{lado}'], ((0, 1, 0), s * (BRACOS_SOLTOS * 0.3 + abre)), ((1, 0, 0), s * balanco))

    def pose_parado(i, n):
        p = 2 * math.pi * i / n
        zerar()
        # a respiração: o tronco sobe e desce um tico, a cabeça vem depois, as orelhas depois dela
        anda(pbs['tronco'], (0, 0, 0.05 * (1 - math.cos(p))))
        gira(pbs['tronco'], ((1, 0, 0), 1.5 * math.sin(p)))
        gira(pbs['cabeca'], ((1, 0, 0), 2.5 * math.sin(p - 0.5)), ((0, 1, 0), 2 * math.sin(p * 0.5 + 0.3)))
        bracos(abre=2 * math.sin(p - 0.4))
        orelhas(p - 0.8, 1.0)

    def pose_andando(i, n):
        p = 2 * math.pi * i / n
        zerar()
        # perna curta de chibi: o passo é o pé indo à frente e atrás (±28°), o corpo quica 2× por ciclo
        for lado, s in (('L', 1), ('R', -1)):
            gira(pbs[f'perna.{lado}'], ((1, 0, 0), s * 28 * math.sin(p)))
            gira(pbs[f'braco.{lado}'], ((0, 1, 0), s * BRACOS_SOLTOS * 0.3), ((1, 0, 0), -s * 22 * math.sin(p)))
        anda(pbs['quadril'], (0, 0, 0.16 * abs(math.cos(p)) - 0.08))
        gira(pbs['quadril'], ((0, 0, 1), 6 * math.sin(p)), ((0, 1, 0), 3 * math.sin(p)))
        gira(pbs['tronco'], ((0, 0, 1), -8 * math.sin(p)), ((1, 0, 0), -4))
        gira(pbs['cabeca'], ((0, 0, 1), 3 * math.sin(p - 0.4)), ((0, 1, 0), -2 * math.sin(p - 0.5)),
             ((1, 0, 0), 2 * math.cos(2 * p - 0.6)))
        orelhas(2 * p - 1.0, 1.4)

    L_CABO = (PEGADA - PE_VASSOURA).length
    EIXO_BALANCO = (PE_VASSOURA - PEGADA).cross(Vector((1, 0, 0))).normalized()

    def pose_varrendo(i, n):
        p = 2 * math.pi * i / n
        zerar()
        sw, swc, swh = onda(p), onda(p - 0.35), onda(p - 0.7)
        ang = math.radians(26) * sw
        v = pbs['vassoura']
        v.rotation_quaternion = Quaternion(local(v, EIXO_BALANCO), ang)
        # a mão vai um pouco junto com a palha, e desce o que o arco levantaria (a palha não sai do chão)
        anda(v, (0.18 * sw, 0, -L_CABO * (1 - math.cos(ang)) * 0.9))
        # o corpo acompanha o golpe: torce para o lado da vassoura e se inclina um pouco para ela
        gira(pbs['tronco'], ((0, 0, 1), 7 + 9 * swc), ((0, 1, 0), 4 + 4 * swc), ((1, 0, 0), -6))
        anda(pbs['quadril'], (0.08 * swc, 0, -0.04 + 0.04 * math.cos(2 * p)))
        gira(pbs['cabeca'], ((0, 0, 1), -6 * swh), ((0, 1, 0), -3 + 3 * swh), ((1, 0, 0), 6))
        # a outra mão, solta, balança ao contrário
        gira(pbs['braco.R'], ((0, 1, 0), -BRACOS_SOLTOS * 0.3), ((1, 0, 0), 10 * swc))
        orelhas(p - 1.3, 1.6)

    POSES = {'parado': pose_parado, 'andando': pose_andando, 'varrendo': pose_varrendo}

    def ik(f):
        pbs['antebraco.L'].constraints['IK'].influence = f

    # ============================ CÂMERA E RENDER (as do coelho.py) ============================
    ELEV = math.radians(20)
    LADO = 120 * ESCALA
    ORTO = 11.4
    PE_PX = (60, 98)
    cam_d = bpy.data.cameras.new('camera'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = ORTO; cam_d.clip_end = 200
    cam = bpy.data.objects.new('camera', cam_d); cena.collection.objects.link(cam); cena.camera = cam
    cima = Vector((0, math.sin(ELEV), math.cos(ELEV)))
    frente = Vector((0, math.cos(ELEV), -math.sin(ELEV)))
    u_px = ORTO / 120
    centro = cima * ((PE_PX[1] - 60) * u_px) - Vector((1, 0, 0)) * ((PE_PX[0] - 60) * u_px)
    cam.location = centro - frente * 40
    cam.rotation_euler = (math.pi / 2 - ELEV, 0, 0)
    r = cena.render
    r.engine = 'BLENDER_EEVEE'
    r.resolution_x = r.resolution_y = LADO
    r.film_transparent = True
    r.filter_size = 0.0
    cena.eevee.taa_render_samples = 1
    cena.view_settings.view_transform = 'Standard'
    cena.view_settings.look = 'None'
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    cena.world = bpy.data.worlds.new('mundo')

    # o passe de distância: o pós risca a linha por dentro onde uma parte passa na frente de outra (o braço no moletom)
    MAT_DIST = bpy.data.materials.new('distancia'); MAT_DIST.use_nodes = True
    t = MAT_DIST.node_tree
    for n in list(t.nodes):
        t.nodes.remove(n)
    cd = t.nodes.new('ShaderNodeCameraData')
    mrg = t.nodes.new('ShaderNodeMapRange'); mrg.inputs['From Min'].default_value = 34.0; mrg.inputs['From Max'].default_value = 46.0
    t.links.new(cd.outputs['View Z Depth'], mrg.inputs['Value'])
    e_ = t.nodes.new('ShaderNodeEmission'); t.links.new(mrg.outputs['Result'], e_.inputs['Color'])
    o_ = t.nodes.new('ShaderNodeOutputMaterial'); t.links.new(e_.outputs['Emission'], o_.inputs['Surface'])

    def renderizar(caminho):
        r.filepath = caminho
        bpy.ops.render.render(write_still=True)
        MESH.material_slots[0].material = MAT_DIST
        guard = [s.material for s in VASS.material_slots]
        for s in VASS.material_slots:
            s.material = MAT_DIST
        cena.view_settings.view_transform = 'Raw'
        r.image_settings.color_depth = '16'
        r.filepath = caminho.replace('.png', '-z.png')
        bpy.ops.render.render(write_still=True)
        cena.view_settings.view_transform = 'Standard'
        r.image_settings.color_depth = '8'
        MESH.material_slots[0].material = MAT_COR
        for s, m in zip(VASS.material_slots, guard):
            s.material = m

    GIRO = 32
    DIRS = {'south-east': GIRO, 'south-west': -GIRO, 'north-east': 180 - GIRO, 'north-west': -(180 - GIRO)}
    if os.environ.get('VISTAS'):   # VISTAS=frente:0,lado:90 para conferir de frente e de lado
        DIRS = {k: float(v) for k, v in (x.split(':') for x in os.environ['VISTAS'].split(','))}
    pasta = os.path.join(SAIDA, 'quadros')
    os.makedirs(pasta, exist_ok=True)
    for nome, n in ANIMACOES.items():
        if SO and nome != SO:
            continue
        com_vassoura = nome == 'varrendo'
        VASS.hide_render = not com_vassoura
        ik(1 if com_vassoura else 0)
        for d, graus in DIRS.items():
            ARM.rotation_euler = (0, 0, math.radians(graus))
            for i in range(n):
                POSES[nome](i, n)
                bpy.context.view_layer.update()
                renderizar(os.path.join(pasta, f'{nome}-{d}-{i}.png'))
            print('ok', nome, d)

    zerar()
    ARM.rotation_euler = (0, 0, 0)
    with open(os.path.join(SAIDA, 'animacoes.json'), 'w') as f:
        json.dump(ANIMACOES, f)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(AQUI, 'mascote.blend'))
    print('FIM')
except Exception:
    import traceback
    traceback.print_exc()
    print('ERRO')
finally:
    LOG.flush()
    with open(os.path.join(SAIDA, 'pronto.txt'), 'w') as f:
        f.write('ok')
