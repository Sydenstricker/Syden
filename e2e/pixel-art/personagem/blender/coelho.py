# O COELHO EM 3D (experimento de 18/10/2026): o mascote montado por código no Blender, com esqueleto, a vassoura presa
# ao esqueleto e a animação "varrendo", renderizado direto em pixel art nas 4 diagonais.
#
# Rodar (Blender da Store; a saída do console não aparece, vai para saida/log.txt):
#   blender-launcher.exe -b -P coelho.py -- [escala]      escala = 4 (renderiza 480 e reduz) ou 1 (direto em 120)
# Depois: python pos.py   (limiar de alfa, paleta, contorno, faixas e comparações)
#
# Tudo nasce aqui: nada de modelo de fora. Rodar de novo refaz o .blend e os quadros.
import bpy, math, os, sys, json
from mathutils import Vector, Matrix, Quaternion

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'saida')
os.makedirs(SAIDA, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ESCALA = int(ARGS[0]) if ARGS else 4
# "-- 4 projecao": a alternativa B (o sprite do PixelLab projetado no modelo, ver projecao/projecao.py)
PROJECAO = len(ARGS) > 1 and ARGS[1] == 'projecao'
# "-- 1 c": a abordagem C (à t3ssel8r): direto em 120, 3 tons com a sombra puxada para o azul, e um passe de normais
# para o pós riscar as quinas (escuro onde dobra para dentro, claro onde dobra para fora)
ABORDAGEM_C = len(ARGS) > 1 and ARGS[1] == 'c'
SUF = '-proj' if PROJECAO else '-c' if ABORDAGEM_C else ''
LOG = open(os.path.join(SAIDA, f'log{SUF}-{ESCALA}x.txt'), 'w', encoding='utf-8')
sys.stdout = LOG
sys.stderr = LOG

try:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cena = bpy.context.scene

    # ============================ A PALETA (medida no mascote do PixelLab, baixa-120) ============================
    # Cada material tem 4 ou 5 tons, do escuro ao claro, TODOS tirados das cores do mascote (a vassoura e a poeira,
    # que o mascote não tem, têm tons próprios). A luz é calculada pela normal contra uma direção FIXA no mundo (do alto
    # à esquerda, o lado da janela do salão), sem lâmpada nem sombra projetada: a saída já é a paleta.
    # Rodada 2 (18/10/2026): eram 3 tons e a cabeça virava uma bola branca; agora são degraus, com a sombra fria do
    # mascote (96, 79, 111), uma borda de luz do lado da janela e, só no pelo, o rebatido quente embaixo da cabeça.
    def lin(c):
        def f(v):
            v /= 255
            return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
        return (f(c[0]), f(c[1]), f(c[2]), 1)

    PALETA = {
        'pelo':    [(96, 79, 111), (122, 103, 123), (175, 153, 182), (210, 192, 220), (224, 210, 237)],
        'rosa':    [(121, 77, 81), (154, 78, 72), (201, 119, 124), (203, 131, 140)],
        'pata':    [(121, 77, 81), (156, 118, 122), (197, 164, 179)],
        'moletom': [(18, 12, 18), (31, 20, 31), (37, 25, 38), (50, 33, 45), (61, 43, 54)],
        'calca':   [(18, 12, 18), (26, 18, 27), (31, 20, 31), (37, 25, 38), (47, 32, 43)],
        'cordao':  [(161, 135, 154), (210, 192, 220), (224, 210, 237)],
        'traco':   [(18, 12, 18)],
        'madeira': [(70, 42, 24), (98, 60, 34), (140, 90, 50), (176, 120, 70)],
        'palha':   [(120, 84, 36), (156, 112, 52), (204, 160, 82), (232, 196, 112)],
        'amarra':  [(80, 24, 30), (112, 34, 40), (160, 50, 54), (196, 70, 70)],
        'poeira':  [(161, 135, 154), (197, 164, 179)],
    }
    QUENTE = (227, 205, 227)   # o rebatido embaixo da cabeça, medido no mascote
    LIMIARES = {5: [0.0, 0.2, 0.38, 0.56, 0.72], 4: [0.0, 0.3, 0.5, 0.7], 3: [0.0, 0.42, 0.66], 2: [0.0, 0.5], 1: [0.0]}
    LUZ = Vector((-0.55, -0.45, 0.70)).normalized()
    BORDA = Vector((-1.0, 0.25, 0.25)).normalized()   # a borda de luz: do lado da janela, um pouco de trás
    if ABORDAGEM_C:
        import colorsys

        def sombra_fria(c):
            # a sombra de pintor: mais escura, mais saturada e com o matiz puxado para o azul-violeta
            h, sat, v = colorsys.rgb_to_hsv(*(x / 255 for x in c))
            alvo = 0.72
            dh = ((alvo - h + 0.5) % 1) - 0.5
            h = (h + dh * 0.18) % 1
            r_, g_, b_ = colorsys.hsv_to_rgb(h, min(1, sat * 1.15 + 0.06), v * 0.72)
            return (round(r_ * 255), round(g_ * 255), round(b_ * 255))
        # luz, meio e sombra fria; a base é o tom do meio de cada material medido no mascote
        PALETA = {k: ([sombra_fria(v[len(v) // 2]), v[len(v) // 2], v[-1]] if len(v) > 1 else v) for k, v in PALETA.items()}
    with open(os.path.join(SAIDA, f'paleta{SUF}.json'), 'w', encoding='utf-8') as f:
        json.dump({'materiais': PALETA, 'quente': QUENTE}, f)

    def material(nome):
        m = bpy.data.materials.new(nome)
        m.use_nodes = True
        nt = m.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        N, L = nt.nodes.new, nt.links.new
        geo = N('ShaderNodeNewGeometry')

        def conta(op, a, b=None, vb=None, vc=None):
            n = N('ShaderNodeMath'); n.operation = op
            L(a, n.inputs[0])
            if b is not None: L(b, n.inputs[1])
            if vb is not None: n.inputs[1].default_value = vb
            if vc is not None: n.inputs[2].default_value = vc
            return n.outputs[0]

        def dot(v):
            n = N('ShaderNodeVectorMath'); n.operation = 'DOT_PRODUCT'
            n.inputs[1].default_value = v
            L(geo.outputs['Normal'], n.inputs[0])
            return n.outputs['Value']

        # o degrau de luz: (n·luz + 1) / 2
        luz = conta('MULTIPLY_ADD', dot(LUZ), vb=0.5, vc=0.5)
        # a borda: onde a superfície vira de lado para a câmera E olha para a janela, sobe um degrau
        lw = N('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.5
        beira = conta('GREATER_THAN', lw.outputs['Facing'], vb=0.72)
        lado = conta('GREATER_THAN', dot(BORDA), vb=0.35)
        borda = conta('MULTIPLY', beira, lado)
        fac = conta('MULTIPLY_ADD', borda, vb=0.18)
        L(luz, fac.node.inputs[2])
        tons = PALETA[nome]
        rampa = N('ShaderNodeValToRGB')
        rampa.color_ramp.interpolation = 'CONSTANT'
        el = rampa.color_ramp.elements
        pos = LIMIARES[len(tons)]
        el[0].position, el[0].color = 0.0, lin(tons[0])
        if len(tons) > 1:
            el[1].position, el[1].color = pos[1], lin(tons[1])
        else:
            el.remove(el[1])
        for t, p in zip(tons[2:], pos[2:]):
            e = el.new(p); e.color = lin(t)
        L(fac, rampa.inputs['Fac'])
        cor = rampa.outputs['Color']
        if nome == 'pelo' and not ABORDAGEM_C:
            # o rebatido quente: a parte de baixo da cabeça (normal para baixo), como no mascote
            mix = N('ShaderNodeMix'); mix.data_type = 'RGBA'
            L(conta('GREATER_THAN', dot(Vector((0, 0, -1))), vb=0.62), mix.inputs['Factor'])
            L(cor, mix.inputs['A'])
            mix.inputs['B'].default_value = lin(QUENTE)
            cor = mix.outputs['Result']
        emis = N('ShaderNodeEmission')
        L(cor, emis.inputs['Color'])
        saida = N('ShaderNodeOutputMaterial')
        L(emis.outputs['Emission'], saida.inputs['Surface'])
        return m

    MAT = {k: material(k) for k in PALETA}

    # ============================ O ESQUELETO ============================
    # O coelho olha para -Y. ".L" é o lado +X. Unidade: ~10 px de altura na tela antes da projeção.
    bpy.ops.object.armature_add(location=(0, 0, 0))
    ARM = bpy.context.object
    ARM.name = 'esqueleto'
    bpy.ops.object.mode_set(mode='EDIT')
    eb = ARM.data.edit_bones
    for b in list(eb):
        eb.remove(b)

    def osso(nome, cabeca, cauda, pai=None, ligado=False):
        b = eb.new(nome)
        b.head, b.tail = Vector(cabeca), Vector(cauda)
        if pai:
            b.parent = eb[pai]
            b.use_connect = ligado
        return b

    OMBRO, COTOVELO, MAO = (1.3, -0.35, 2.6), (1.68, -0.45, 1.92), (1.72, -0.5, 1.3)
    osso('raiz', (0, 0, 0), (0, 0, 0.8))
    osso('tronco', (0, 0, 1.0), (0, 0, 3.3), 'raiz')
    osso('cabeca', (0, 0, 3.3), (0, 0, 6.4), 'tronco')
    for lado, s in (('L', 1), ('R', -1)):
        osso(f'orelha.{lado}', (s * 0.55, 0.1, 6.0), (s * 0.78, 0.1, 8.5), 'cabeca')
        osso(f'braco.{lado}', (s * OMBRO[0], OMBRO[1], OMBRO[2]), (s * COTOVELO[0], COTOVELO[1], COTOVELO[2]), 'tronco')
        osso(f'antebraco.{lado}', (s * COTOVELO[0], COTOVELO[1], COTOVELO[2]), (s * MAO[0], MAO[1], MAO[2]), f'braco.{lado}', True)
        osso(f'perna.{lado}', (s * 0.5, 0, 1.1), (s * 0.5, 0, 0.1), 'raiz')
        osso(f'polo.{lado}', (s * 2.6, 0.9, 1.9), (s * 2.6, 0.9, 2.3), 'tronco')

    # A VASSOURA: um osso que vai da pegada de cima até o pé da vassoura, no chão. As mãos seguem alvos presos A ELE
    # (IK), então a vassoura manda e os braços acompanham: ela é um objeto só, rígido, igual em todo quadro.
    PE_VASSOURA = Vector((-1.1, -2.05, 0.0))
    PEGADA = Vector((0.25, -1.5, 2.0))
    EIXO = (PEGADA - PE_VASSOURA).normalized()
    PEGADA2 = PEGADA - EIXO * 0.45
    osso('vassoura', PEGADA, PE_VASSOURA, 'raiz')
    osso('alvo.L', PEGADA, PEGADA + Vector((0, 0, 0.3)), 'vassoura')
    osso('alvo.R', PEGADA2, PEGADA2 + Vector((0, 0, 0.3)), 'vassoura')
    bpy.ops.object.mode_set(mode='OBJECT')
    for nome in ('polo.L', 'polo.R', 'alvo.L', 'alvo.R', 'vassoura'):
        ARM.data.bones[nome].use_deform = False

    # ============================ AS PEÇAS ============================
    # Cada peça é rígida, presa a um osso (no tamanho de 120 px, um corpo de bonecos de pano fica igual a um com pesos
    # pintados, e não tem pele esticando errado). Os braços dobram no cotovelo, com uma bola na junta.
    bpy.context.view_layer.update()

    def prender(obj, nome_osso):
        bpy.context.view_layer.update()
        mw = obj.matrix_world.copy()
        obj.parent = ARM
        obj.parent_type = 'BONE'
        obj.parent_bone = nome_osso
        bpy.context.view_layer.update()
        obj.matrix_world = mw

    def finalizar(obj, mat, nome_osso, suave=True):
        obj.data.materials.append(MAT[mat])
        if suave:
            for p in obj.data.polygons:
                p.use_smooth = True
        prender(obj, nome_osso)
        return obj

    def elipsoide(nome, loc, esc, mat, nome_osso, rot=(0, 0, 0), seg=40):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=seg, ring_count=seg // 2, location=loc, rotation=rot)
        o = bpy.context.object
        o.name = nome
        o.scale = esc
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        return finalizar(o, mat, nome_osso)

    def entre(nome, a, b, raio, mat, nome_osso, folga=0.15):
        a, b = Vector(a), Vector(b)
        d = b - a
        meio = (a + b) / 2
        rot = d.to_track_quat('Z', 'Y').to_euler()
        return elipsoide(nome, meio, (raio, raio, d.length / 2 + folga), mat, nome_osso, rot=rot)

    def no_rosto(azim, elev, centro, raios, fora=0.02):
        # ponto na superfície do elipsoide da cabeça: azim 0 = frente (-Y), positivo para +X; elev para cima
        a, e = math.radians(azim), math.radians(elev)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        # raio do elipsoide nessa direção
        r = 1 / math.sqrt((d.x / raios[0]) ** 2 + (d.y / raios[1]) ** 2 + (d.z / raios[2]) ** 2)
        return Vector(centro) + d * (r + fora)

    def traco(nome, pontos, espessura, mat, nome_osso):
        cu = bpy.data.curves.new(nome, 'CURVE')
        cu.dimensions = '3D'
        cu.bevel_depth = espessura
        cu.bevel_resolution = 2
        sp = cu.splines.new('POLY')
        sp.points.add(len(pontos) - 1)
        for p, c in zip(sp.points, pontos):
            p.co = (c.x, c.y, c.z, 1)
        o = bpy.data.objects.new(nome, cu)
        bpy.context.collection.objects.link(o)
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.convert(target='MESH')
        o = bpy.context.object
        return finalizar(o, mat, nome_osso)

    # pés e pernas
    for lado, s in (('L', 1), ('R', -1)):
        elipsoide(f'pe.{lado}', (s * 0.6, -0.22, 0.2), (0.48, 0.64, 0.26), 'pata', f'perna.{lado}')
        elipsoide(f'perna.{lado}', (s * 0.6, 0.0, 0.75), (0.56, 0.5, 0.62), 'calca', f'perna.{lado}')
    # o moletom: largo e fofo (rodada 2: era magro perto do mascote), barra embaixo
    elipsoide('moletom', (0, 0, 2.15), (1.86, 1.3, 1.32), 'moletom', 'tronco')
    elipsoide('barra', (0, 0, 1.42), (1.78, 1.25, 0.45), 'moletom', 'tronco')
    # O CAPUZ, a marca do mascote (rodada 2): um anel grosso deitado nos ombros, mais baixo na frente (vira a gola
    # dobrada em volta do pescoço) e mais alto atrás, onde o capuz caído é uma massa escura abaixo da cabeça.
    bpy.ops.mesh.primitive_torus_add(major_radius=1.02, minor_radius=0.4, location=(0, 0.12, 3.38),
                                     rotation=(math.radians(24), 0, 0), major_segments=48, minor_segments=18)
    o = bpy.context.object
    o.name = 'capuz-gola'
    o.scale = (1.22, 1.05, 1.0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # o V da frente: o anel se abre na frente do peito, e as duas pontas viram as lapelas cruzando
    import bmesh
    bm = bmesh.new(); bm.from_mesh(o.data)
    fora = [v for v in bm.verts if v.co.y < -0.55 and abs(math.atan2(v.co.x, -v.co.y)) < math.radians(24)]
    bmesh.ops.delete(bm, geom=fora, context='VERTS')
    bm.to_mesh(o.data); bm.free()
    o.location = (0, 0, 0)
    finalizar(o, 'moletom', 'tronco')
    for s_ in (1, -1):
        elipsoide(f'capuz-lapela.{s_}', (s_ * 0.42, -1.08, 2.92), (0.34, 0.26, 0.42), 'moletom', 'tronco',
                  rot=(0, math.radians(-s_ * 25), 0))
    elipsoide('capuz', (0, 1.0, 3.45), (1.38, 0.72, 0.78), 'moletom', 'tronco', rot=(math.radians(-15), 0, 0))
    elipsoide('capuz-ponta', (0, 1.25, 2.85), (0.9, 0.45, 0.62), 'moletom', 'tronco', rot=(math.radians(-25), 0, 0))
    # a camiseta clara aparecendo no V da gola
    elipsoide('camisa', (0, -0.98, 3.18), (0.42, 0.22, 0.4), 'cordao', 'tronco')
    # os cordões do capuz
    for s in (1, -1):
        entre(f'cordao.{s}', (s * 0.28, -1.0, 2.95), (s * 0.3, -1.12, 2.45), 0.075, 'cordao', 'tronco', folga=0.05)
    # o rabinho
    elipsoide('rabo', (0, 1.08, 1.35), (0.38, 0.32, 0.36), 'pelo', 'tronco')
    # a cabeça: grande e redonda, um pouco mais larga embaixo (as bochechas)
    CAB, RCAB = (0, 0, 4.98), (1.72, 1.58, 1.58)
    elipsoide('cabeca', CAB, RCAB, 'pelo', 'cabeca')
    elipsoide('bochechas', (0, -0.33, 4.5), (1.44, 1.24, 0.98), 'pelo', 'cabeca')
    # as orelhas, com o rosa por dentro
    for lado, s in (('L', 1), ('R', -1)):
        rot = (math.radians(-6), math.radians(s * 9), 0)
        elipsoide(f'orelha.{lado}', (s * 0.68, 0.12, 7.2), (0.54, 0.3, 1.16), 'pelo', f'orelha.{lado}', rot=rot)
        elipsoide(f'orelha-rosa.{lado}', (s * 0.68, -0.08, 7.1), (0.34, 0.14, 0.9), 'rosa', f'orelha.{lado}', rot=rot)
    # o rosto: olhos fechados felizes (arcos), focinho rosa e a boquinha
    for s in (1, -1):
        pts = [no_rosto(s * 21 + s * t, -1 + 7 * math.sin(math.pi * (t + 9) / 18), CAB, RCAB)
               for t in range(-8, 9, 2)]
        traco(f'olho.{s}', pts, 0.085, 'traco', 'cabeca')
    elipsoide('focinho', tuple(no_rosto(0, -11, CAB, RCAB, -0.1)), (0.2, 0.14, 0.13), 'rosa', 'cabeca')
    boca = [no_rosto(a, -17 + 2 * abs(math.sin(math.radians(a * 30))), CAB, RCAB) for a in range(-6, 7, 2)]
    traco('boca', boca, 0.05, 'traco', 'cabeca')
    # os braços: manga de cima, manga de baixo, cotovelo e a mão branca
    for lado, s in (('L', 1), ('R', -1)):
        om, co, ma = Vector((s * OMBRO[0], OMBRO[1], OMBRO[2])), Vector((s * COTOVELO[0], COTOVELO[1], COTOVELO[2])), Vector((s * MAO[0], MAO[1], MAO[2]))
        entre(f'manga.{lado}', om, co, 0.5, 'moletom', f'braco.{lado}')
        entre(f'manga-baixo.{lado}', co, ma, 0.46, 'moletom', f'antebraco.{lado}', folga=0.0)
        elipsoide(f'cotovelo.{lado}', co, (0.48, 0.48, 0.48), 'moletom', f'antebraco.{lado}')
        # a mão NÃO é filha do osso: o IK estica o antebraço para alcançar o cabo, e a mão esticaria junto. Ela só
        # copia a posição da ponta do antebraço, e fica redonda.
        m = elipsoide(f'mao.{lado}', ma, (0.29, 0.29, 0.29), 'pata', f'antebraco.{lado}')
        m.parent = None
        m.location = (0, 0, 0)
        cl = m.constraints.new('COPY_LOCATION')
        cl.target = ARM
        cl.subtarget = f'antebraco.{lado}'
        cl.head_tail = 1.0

    # ============================ A VASSOURA ============================
    # Montada em pé na origem (cabo no +Z, pé da palha em z=0) e depois levada ao osso: um objeto só.
    pecas = []
    COMP = (PEGADA - PE_VASSOURA).length + 0.8
    bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=COMP - 0.85, location=(0, 0, 0.85 + (COMP - 0.85) / 2 + 0.2), vertices=16)
    o = bpy.context.object; o.data.materials.append(MAT['madeira']); pecas.append(o)
    bpy.ops.mesh.primitive_cone_add(radius1=0.8, radius2=0.24, depth=1.2, location=(0, 0, 0.6), vertices=24)
    o = bpy.context.object; o.scale = (1, 0.4, 1); o.data.materials.append(MAT['palha']); pecas.append(o)
    bpy.ops.mesh.primitive_cylinder_add(radius=1, depth=0.18, location=(0, 0, 1.12), vertices=24)
    o = bpy.context.object; o.scale = (0.3, 0.16, 1); o.data.materials.append(MAT['amarra']); pecas.append(o)
    for o in pecas:
        o.select_set(True)
        for p in o.data.polygons:
            p.use_smooth = True
    bpy.context.view_layer.objects.active = pecas[0]
    bpy.ops.object.join()
    VASS = bpy.context.object
    VASS.name = 'vassoura'
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # leva ao lugar: o +Z dela vira o EIXO do cabo, a largura da palha fica de lado (+X), o pé no ponto do chão
    rot = EIXO.to_track_quat('Z', 'X').to_matrix().to_4x4()
    VASS.matrix_world = Matrix.Translation(PE_VASSOURA) @ rot
    prender(VASS, 'vassoura')

    # O IK entra DEPOIS de as peças estarem presas: presas com ele ligado, elas grudariam nos braços já dobrados.
    for lado in ('L', 'R'):
        pb = ARM.pose.bones[f'antebraco.{lado}']
        ik = pb.constraints.new('IK')
        ik.name = 'IK'
        ik.target = ARM
        ik.subtarget = f'alvo.{lado}'
        ik.pole_target = ARM
        ik.pole_subtarget = f'polo.{lado}'
        ik.pole_angle = math.radians(-90)
        ik.chain_count = 2
        ik.use_stretch = True
        for n in (f'braco.{lado}', f'antebraco.{lado}'):
            ARM.pose.bones[n].ik_stretch = 0.5

    # ============================ A ANIMAÇÃO "VARRENDO" ============================
    QUADROS = 8
    cena.frame_start, cena.frame_end = 1, QUADROS
    pbs = ARM.pose.bones
    for pb in pbs:
        pb.rotation_mode = 'QUATERNION'

    def local(pb, eixo_mundo):
        return (pb.bone.matrix_local.to_3x3().inverted() @ eixo_mundo).normalized()

    # o eixo do balanço: perpendicular ao cabo e ao X do mundo, para o pé da vassoura correr de lado no chão
    EIXO_BALANCO = (PE_VASSOURA - PEGADA).cross(Vector((1, 0, 0))).normalized()
    L_CABO = (PEGADA - PE_VASSOURA).length

    ARCO = float(os.environ.get('ARCO', '40'))   # graus para cada lado (era 30)

    def pose(i):
        p = 2 * math.pi * i / QUADROS
        sw = math.sin(p)
        ang = math.radians(ARCO) * sw
        v = pbs['vassoura']
        v.rotation_quaternion = Quaternion(local(v, EIXO_BALANCO), ang)
        # as mãos vão um pouco junto com a palha, e descem o que o arco levantaria (a palha não sai do chão)
        desl = Vector((0.4 * sw, 0, -L_CABO * (1 - math.cos(ang)) * 0.9))
        v.location = v.bone.matrix_local.to_3x3().inverted() @ desl
        t = pbs['tronco']
        # rodada 2: o tronco torce e se inclina PARA DENTRO do golpe (antes era 9° e mal se via em 1×)
        t.rotation_quaternion = Quaternion(local(t, Vector((0, 0, 1))), math.radians(16) * sw) @ \
            Quaternion(local(t, Vector((0, 1, 0))), math.radians(-6) * sw) @ \
            Quaternion(local(t, Vector((1, 0, 0))), math.radians(-12))
        r = pbs['raiz']
        # o peso passa de um pé para o outro junto com a vassoura
        r.location = r.bone.matrix_local.to_3x3().inverted() @ Vector((0.12 * sw, 0, -0.05 + 0.05 * math.cos(2 * p)))
        c = pbs['cabeca']
        c.rotation_quaternion = Quaternion(local(c, Vector((0, 0, 1))), math.radians(-9) * sw) @ \
            Quaternion(local(c, Vector((0, 1, 0))), math.radians(3) * sw) @ \
            Quaternion(local(c, Vector((1, 0, 0))), math.radians(6))
        # as orelhas atrasadas: seguem o balanço com um quarto de volta de atraso, e balançam no ritmo do quique
        for lado, s in (('L', 1), ('R', -1)):
            o = pbs[f'orelha.{lado}']
            o.rotation_quaternion = Quaternion(local(o, Vector((0, 1, 0))), math.radians(-10) * math.sin(p - 1.3)) @ \
                Quaternion(local(o, Vector((1, 0, 0))), math.radians(5) * math.cos(2 * p - 1.0))
        for nome in ('vassoura', 'tronco', 'raiz', 'cabeca', 'orelha.L', 'orelha.R'):
            pbs[nome].keyframe_insert('rotation_quaternion', frame=i + 1)
            pbs[nome].keyframe_insert('location', frame=i + 1)

    for i in range(QUADROS):
        pose(i)

    # ============================ CÂMERA E RENDER ============================
    ELEV = math.radians(float(os.environ.get('ELEV', '20')))  # o salão é ~30° (ladrilho 27 × 14,25); o mascote do PixelLab é mais baixo
    LADO = 120 * ESCALA
    ORTO = 11.4                      # unidades na largura do quadro (medido: ~90 px de altura de pé)
    PE_PX = (60, 98)                 # onde a origem (o chão entre os pés) cai no quadro de 120
    cam_d = bpy.data.cameras.new('camera')
    cam_d.type = 'ORTHO'
    cam_d.ortho_scale = ORTO
    cam = bpy.data.objects.new('camera', cam_d)
    cena.collection.objects.link(cam)
    cena.camera = cam
    cima = Vector((0, math.sin(ELEV), math.cos(ELEV)))
    frente = Vector((0, math.cos(ELEV), -math.sin(ELEV)))
    u_px = ORTO / 120
    centro = Vector((0, 0, 0)) + cima * ((PE_PX[1] - 60) * u_px) - Vector((1, 0, 0)) * ((PE_PX[0] - 60) * u_px)
    cam.location = centro - frente * 40
    cam.rotation_euler = (math.pi / 2 - ELEV, 0, 0)
    cam_d.clip_end = 200

    r = cena.render
    r.engine = 'BLENDER_EEVEE'
    r.resolution_x = r.resolution_y = LADO
    r.resolution_percentage = 100
    r.film_transparent = True
    try:
        r.filter_size = 0.0
    except Exception as e:
        print('filter_size', e)
    try:
        cena.eevee.taa_render_samples = 1
    except Exception as e:
        print('taa', e)
    cena.view_settings.view_transform = 'Standard'
    cena.view_settings.look = 'None'
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    w = bpy.data.worlds.new('mundo')
    cena.world = w

    # O quanto o coelho gira em cada diagonal: o mascote do PixelLab mostra mais o rosto que um giro de 45° (medido
    # lado a lado), então o giro é menor. GIRO=45 dá a diagonal geométrica.
    GIRO = float(os.environ.get('GIRO', '32'))
    DIRS = {'south-east': GIRO, 'south-west': -GIRO, 'north-east': 180 - GIRO, 'north-west': -(180 - GIRO)}
    pasta = os.path.join(SAIDA, f'quadros{SUF}-{ESCALA}x')
    os.makedirs(pasta, exist_ok=True)

    # O PASSE DE PARTES: o mesmo quadro de novo, cada parte numa cor lisa (R = qual parte, B = a distância da câmera).
    # O pós usa isso para riscar a linha por dentro onde uma parte passa na frente de outra (a manga sobre o moletom,
    # a cabeça sobre o capuz), que é o que o desenho à mão do PixelLab tem e a cor sozinha não dá.
    GRUPOS = [('cabeca', 1), ('bochechas', 1), ('olho', 1), ('focinho', 1), ('boca', 1),
              ('orelha-rosa.L', 2), ('orelha.L', 2), ('orelha-rosa.R', 3), ('orelha.R', 3),
              ('moletom', 4), ('barra', 4), ('capuz', 11), ('cordao', 4), ('camisa', 4),
              ('manga-baixo.L', 5), ('manga.L', 5), ('cotovelo.L', 5), ('mao.L', 5),
              ('manga-baixo.R', 6), ('manga.R', 6), ('cotovelo.R', 6), ('mao.R', 6),
              ('pe.L', 7), ('perna.L', 7), ('pe.R', 8), ('perna.R', 8), ('rabo', 9), ('vassoura', 10)]
    MAT_ID = {}

    def mat_id(g):
        if g in MAT_ID:
            return MAT_ID[g]
        m = bpy.data.materials.new(f'id-{g}')
        nt = m.node_tree if m.node_tree else None
        if nt is None:
            m.use_nodes = True
            nt = m.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        em = nt.nodes.new('ShaderNodeEmission')
        camd = nt.nodes.new('ShaderNodeCameraData')
        mr = nt.nodes.new('ShaderNodeMapRange')
        mr.inputs['From Min'].default_value = 34.0
        mr.inputs['From Max'].default_value = 46.0
        comb = nt.nodes.new('ShaderNodeCombineColor')
        comb.inputs['Red'].default_value = g / 16
        comb.inputs['Green'].default_value = 0.0
        nt.links.new(camd.outputs['View Z Depth'], mr.inputs['Value'])
        nt.links.new(mr.outputs['Result'], comb.inputs['Blue'])
        nt.links.new(comb.outputs['Color'], em.inputs['Color'])
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
        MAT_ID[g] = m
        return m

    PARTES = {}
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        g = next((g for pre, g in GRUPOS if o.name.startswith(pre)), None)
        if g is None:
            print('sem grupo:', o.name)
            continue
        PARTES[o.name] = (g, [s.material for s in o.material_slots])

    # o passe de normais (só na C): a normal na câmera, de -1..1 para 0..1
    MAT_NORMAL = bpy.data.materials.new('normal')
    MAT_NORMAL.use_nodes = True
    _nt = MAT_NORMAL.node_tree
    for _n in list(_nt.nodes):
        _nt.nodes.remove(_n)
    _geo = _nt.nodes.new('ShaderNodeNewGeometry')
    _vt = _nt.nodes.new('ShaderNodeVectorTransform')
    _vt.vector_type = 'NORMAL'; _vt.convert_from = 'WORLD'; _vt.convert_to = 'CAMERA'
    _ma = _nt.nodes.new('ShaderNodeVectorMath'); _ma.operation = 'MULTIPLY_ADD'
    _ma.inputs[1].default_value = (0.5, 0.5, 0.5); _ma.inputs[2].default_value = (0.5, 0.5, 0.5)
    _em = _nt.nodes.new('ShaderNodeEmission'); _out = _nt.nodes.new('ShaderNodeOutputMaterial')
    _nt.links.new(_geo.outputs['Normal'], _vt.inputs['Vector'])
    _nt.links.new(_vt.outputs['Vector'], _ma.inputs[0])
    _nt.links.new(_ma.outputs['Vector'], _em.inputs['Color'])
    _nt.links.new(_em.outputs['Emission'], _out.inputs['Surface'])

    def renderizar(caminho):
        r.filepath = caminho
        bpy.ops.render.render(write_still=True)
        for nome, (g, mats) in PARTES.items():
            o = bpy.data.objects[nome]
            for k in range(len(o.material_slots)):
                o.material_slots[k].material = mat_id(g)
        cena.view_settings.view_transform = 'Raw'
        r.image_settings.color_depth = '16'
        r.filepath = caminho.replace('.png', '-id.png')
        bpy.ops.render.render(write_still=True)
        if ABORDAGEM_C:
            for nome in PARTES:
                for sl in bpy.data.objects[nome].material_slots:
                    sl.material = MAT_NORMAL
            r.filepath = caminho.replace('.png', '-n.png')
            bpy.ops.render.render(write_still=True)
        cena.view_settings.view_transform = 'Standard'
        r.image_settings.color_depth = '8'
        for nome, (g, mats) in PARTES.items():
            o = bpy.data.objects[nome]
            for k, m in enumerate(mats):
                o.material_slots[k].material = m

    # A POEIRA: um tufinho de 2–3 pixels no fim de cada golpe (quadros 3 e 7, onde a palha para e volta), que cresce e
    # some no quadro seguinte. Não é osso nem animação gravada: é posta no pé da vassoura na hora de renderizar.
    POEIRA = []
    for k, (dx, dy, raio) in enumerate(((0.0, 0.0, 0.16), (0.3, -0.2, 0.13), (0.15, 0.25, 0.11))):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=raio, segments=12, ring_count=6)
        o = bpy.context.object
        o.name = f'poeira.{k}'
        o.data.materials.append(MAT['poeira'])
        o.hide_render = True
        POEIRA.append((o, dx, dy))
    PARTES.update({o.name: (12, [MAT['poeira']]) for o, _, _ in POEIRA})

    def poeira(i, d_graus):
        for o, _, _ in POEIRA:
            o.hide_render = True
        fim = {2: (1, 0), 3: (1, 1), 6: (-1, 0), 7: (-1, 1)}.get(i)
        if not fim:
            return
        lado, depois = fim
        # o pé da vassoura no quadro do fim do golpe, um pouco além, no sentido do golpe
        cena.frame_set((2 if lado > 0 else 6) + 1)
        pe = ARM.matrix_world @ pbs['vassoura'].tail
        cena.frame_set(i + 1)
        rot = Matrix.Rotation(math.radians(d_graus), 3, 'Z')
        for o, dx, dy in POEIRA:
            o.location = pe + rot @ Vector((lado * (0.45 + dx + 0.25 * depois), dy - 0.1, 0.12 + 0.12 * depois))
            o.scale = (1.0 + 0.3 * depois,) * 3
            o.hide_render = False

    def ik(influencia):
        for lado in ('L', 'R'):
            pbs[f'antebraco.{lado}'].constraints['IK'].influence = influencia

    if PROJECAO:
        exec(open(os.path.join(AQUI, 'projecao', 'projecao.py'), encoding='utf-8').read())

    for d, graus in DIRS.items():
        ARM.rotation_euler = (0, 0, math.radians(graus))
        # parado: sem vassoura, braços soltos (para comparar com o mascote de pé do PixelLab)
        ik(0)
        VASS.hide_render = True
        cena.frame_set(1)
        for pb in pbs:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
        acao = ARM.animation_data.action
        ARM.animation_data.action = None
        for pb in pbs:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
        bpy.context.view_layer.update()
        if PROJECAO:
            projetar(d)
        renderizar(os.path.join(pasta, f'parado-{d}.png'))
        # varrendo
        ARM.animation_data.action = acao
        ik(1)
        VASS.hide_render = False
        for i in range(QUADROS):
            cena.frame_set(i + 1)
            poeira(i, graus)
            renderizar(os.path.join(pasta, f'varrendo-{d}-{i}.png'))
        poeira(-1, graus)
        print('ok', d)

    ARM.rotation_euler = (0, 0, math.radians(45))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(AQUI, 'projecao', 'coelho-projecao.blend') if PROJECAO else os.path.join(AQUI, 'c', 'coelho-c.blend') if ABORDAGEM_C else os.path.join(AQUI, 'coelho.blend'))
    print('FIM')
except Exception:
    import traceback
    traceback.print_exc()
    print('ERRO')
finally:
    LOG.flush()
    with open(os.path.join(SAIDA, f'pronto{SUF}-{ESCALA}x.txt'), 'w') as f:
        f.write('ok')
