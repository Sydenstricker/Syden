# O PILOTO DAS CAMADAS EM 3D (09/11/2026, pedido dele: "vamos estender o piloto para 3D para avaliar os resultados, antes
# de mudar as regras"). Roda DENTRO do mascote.py (o gancho do camadas.py), com tudo dele à mão: MESH, ARM, pbs, gira,
# zerar, orelhas, pose_parado, pose_andando, mat_liso, MAT_COR, MAT_DIST, a câmera e o render.
#
# O que se testa: POUCOS CORPOS BASE + ACESSÓRIOS AVULSOS PRESOS AO OSSO.
#   - os corpos: o mascote (a malha em T) e a ORELHA CAÍDA feita da MESMA malha, só dobrando as orelhas (cada orelha ganha
#     um segundo osso, orelha2, para dobrar duas vezes: sai para o lado e cai);
#   - os acessórios: o BONÉ, rígido no osso da cabeça, e a BANDANA, presa ao tronco e à cabeça pelos pesos da pele
#     embaixo dela. Os dois feitos aqui, por código, PROVISÓRIOS: quando o GLB do Meshy estiver em meshy/<nome>.glb, ele
#     entra no lugar, na mesma caixa;
#   - o ENCAIXE é medido em cada corpo (nada de número à mão por corpo): o boné procura, sobre a cabeça, o maior tamanho
#     (até o do alvo) em que a cabeça fica dentro dele e as orelhas ficam FORA (em pé) ou passam POR BAIXO (caídas); a
#     bandana segue o contorno da malha no pescoço e no peito.
import numpy as np

ETAPA = os.environ.get('ETAPA', 'tudo')       # medir | tudo
SO_ = os.environ.get('SO')                     # SO=pixel, SO=normal, SO=anim, SO=glb
SAIDA_C = CAMADAS_SAIDA
PASTA_MESHY = os.path.join(CAMADAS_AQUI, 'meshy')
# os corpos de cada malha: a em T dá o mascote e a orelha caída (a mesma malha com as orelhas dobradas); a nova, o
# mascote novo
CORPOS = ['mascote', 'orelha-caida'] if MALHA == 't' else [f'mascote-{MALHA}']


def caida(corpo):
    return corpo.startswith('orelha-caida')
CORPO = 'mascote'
INFO = {}

# ============================ AS CORES (as das camadas 2D do piloto) ============================
BONE_COR = (167, 43, 46)
BONE_ABA = (150, 36, 40)
BANDANA_COR = (155, 54, 32)
NO_COR = (128, 42, 22)


def lin(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1)


def mat_pixel(nome, cor):
    # a mesma luz em degraus do corpo (três degraus que multiplicam a cor), em emissão: o pós prende à paleta
    m = bpy.data.materials.new(nome + '-pixel'); m.use_nodes = True
    t = m.node_tree
    for n in list(t.nodes):
        t.nodes.remove(n)
    g = t.nodes.new('ShaderNodeNewGeometry')
    d = t.nodes.new('ShaderNodeVectorMath'); d.operation = 'DOT_PRODUCT'; d.inputs[1].default_value = LUZ
    t.links.new(g.outputs['Normal'], d.inputs[0])
    r_ = t.nodes.new('ShaderNodeValToRGB'); r_.color_ramp.interpolation = 'CONSTANT'
    c = Vector(lin(cor)[:3])
    el_ = r_.color_ramp.elements
    el_[0].position, el_[0].color = 0.0, tuple(c * 0.55) + (1,)
    el_[1].position, el_[1].color = 0.42, tuple(c) + (1,)
    e3 = el_.new(0.74); e3.color = tuple(c * 1.25) + (1,)
    m2 = t.nodes.new('ShaderNodeMath'); m2.operation = 'MULTIPLY_ADD'; m2.inputs[1].default_value = 0.5; m2.inputs[2].default_value = 0.5
    t.links.new(d.outputs['Value'], m2.inputs[0]); t.links.new(m2.outputs[0], r_.inputs['Fac'])
    e_ = t.nodes.new('ShaderNodeEmission'); t.links.new(r_.outputs['Color'], e_.inputs['Color'])
    o_ = t.nodes.new('ShaderNodeOutputMaterial'); t.links.new(e_.outputs['Emission'], o_.inputs['Surface'])
    return m


def mat_normal(nome, cor, aspereza=0.75):
    m = bpy.data.materials.new(nome); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = lin(cor)
    b.inputs['Roughness'].default_value = aspereza
    return m


# cada objeto de acessório: (material do pixel, material do render normal) por slot
MATS = {}


def vestir(obj, pares, anexar=True):
    if anexar:
        for mp, mn in pares:
            obj.data.materials.append(mn)
    MATS[obj.name] = pares


# ============================ A ORELHA CAÍDA: um segundo osso em cada orelha ============================
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = ARM
ARM.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = ARM.data.edit_bones
CORTE_ORELHA = 0.24   # onde a orelha dobra a segunda vez, em fração do comprimento
for lado in ('L', 'R'):
    o_ = eb[f'orelha.{lado}']
    h, t_ = o_.head.copy(), o_.tail.copy()
    meio = h + (t_ - h) * CORTE_ORELHA
    o2 = eb.new(f'orelha2.{lado}')
    o2.head, o2.tail = meio, t_
    o2.parent = o_
    o2.use_deform = True
    o_.tail = meio
bpy.ops.object.mode_set(mode='OBJECT')
OSSO_ORELHA = {l: (ARM.data.bones[f'orelha.{l}'].head_local.copy(), ARM.data.bones[f'orelha2.{l}'].tail_local.copy())
               for l in ('L', 'R')}
for pb in ARM.pose.bones:
    pb.rotation_mode = 'QUATERNION'
pbs = ARM.pose.bones

# os pesos da orelha se dividem pelo comprimento: perto da base fica com orelha, na ponta com orelha2 (passagem suave)
for lado in ('L', 'R'):
    g1 = MESH.vertex_groups[f'orelha.{lado}']
    g2 = MESH.vertex_groups.new(name=f'orelha2.{lado}')
    a, b = OSSO_ORELHA[lado]
    eixo = b - a
    for v in MESH.data.vertices:
        w = next((x.weight for x in v.groups if x.group == g1.index), 0.0)
        if w <= 0:
            continue
        t = (v.co - a).dot(eixo) / eixo.length_squared
        k = min(1.0, max(0.0, (t - CORTE_ORELHA + 0.12) / 0.24))
        k = k * k * (3 - 2 * k)
        g1.add([v.index], w * (1 - k), 'REPLACE')
        if k > 0:
            g2.add([v.index], w * k, 'REPLACE')

# A POSE DAS ORELHAS por corpo. O mascote balança como sempre; a orelha caída sai para o lado (orelha) e cai (orelha2),
# com um balanço menor, de orelha pesada.
_orelhas_mascote = orelhas
# A orelha é um pano largo com a face rosa para a frente: dobrar no plano dela amassa. Por isso a base primeiro TORCE
# (a face rosa vira para a cabeça) e só então dobra para fora (sai) e cai (cai), as duas dobras pela espessura.
CAIDA = dict(torce=80, sai=25, cai=140, frente=-4, estica=1.3, raiz=(0.55, 0.75))


# ACESSÓRIO DE CABEÇA → AJUSTE DAS ORELHAS (decisão dele, 09/11/2026: "sim, corrija"). Com o boné posto, as orelhas em pé
# se afastam (para fora) e deitam um pouco (para trás), pelos ossos delas, o MENOR tanto que tira a orelha de dentro e de
# cima do boné em todos os quadros. Medido na malha por ajuste_das_orelhas(); vale só com o acessório ligado.
AJUSTE_OREL = {}       # corpo -> (afasta, deita, desloca): graus, graus, e o quanto a base anda para longe do boné
CHAPEU = False         # há acessório de cabeça posto agora?


def orelhas(p, forca=1.0):
    if not caida(CORPO):
        _orelhas_mascote(p, forca)
        afasta, deita, desloca = AJUSTE_OREL.get(CORPO, (0, 0, 0)) if CHAPEU else (0, 0, 0)
        if afasta or deita or desloca:
            for lado, s in (('L', 1), ('R', -1)):
                pb = pbs[f'orelha.{lado}']
                extra = Quaternion(local(pb, (0, 1, 0)), math.radians(s * afasta)) @ \
                    Quaternion(local(pb, (1, 0, 0)), math.radians(-deita))
                pb.rotation_quaternion = extra @ pb.rotation_quaternion
                # a base anda na horizontal, para longe do eixo do boné (a direção sai da medida, em DIRECAO_OREL)
                if desloca:
                    anda(pb, tuple(Vector(DIRECAO_OREL[CORPO][lado]) * desloca))
        return
    for lado, s in (('L', 1), ('R', -1)):
        tw = s * CAIDA['torce']
        # a raiz desce um pouco pela lateral do crânio: a orelha caída nasce mais do lado que a em pé
        anda(pbs[f'orelha.{lado}'], (s * CAIDA['raiz'][0], 0, -CAIDA['raiz'][1]))
        gira(pbs[f'orelha.{lado}'], ((1, 0, 0), CAIDA['frente'] + 2 * forca * math.cos(2 * p - 1.0)),
             ((0, 1, 0), s * (CAIDA['sai'] + 2 * forca * math.sin(p - 1.2))), ((0, 0, 1), tw))
        # a segunda dobra é em volta do MESMO eixo do mundo (Y): desfaz-se a torção do pai para achá-lo
        eixo = Matrix.Rotation(math.radians(-tw), 3, 'Z') @ Vector((0, 1, 0))
        gira(pbs[f'orelha2.{lado}'], (tuple(eixo), s * (CAIDA['cai'] + 4 * forca * math.sin(p - 1.7))))
        # e a ponta estica um pouco: a orelha caída do desenho desce até o ombro
        pbs[f'orelha2.{lado}'].scale = (1, CAIDA['estica'], 1)


def repouso():
    zerar()
    orelhas(0.0, 0.0)
    bpy.context.view_layer.update()


# ============================ AS MEDIDAS NA MALHA ============================
def grupo(nome):
    gi = MESH.vertex_groups[nome].index
    return np.array([next((x.weight for x in v.groups if x.group == gi), 0.0) for v in MESH.data.vertices])


W = {n: grupo(n) for n in ('cabeca', 'tronco', 'quadril', 'orelha.L', 'orelha.R', 'orelha2.L', 'orelha2.R',
                           'braco.L', 'braco.R', 'antebraco.L', 'antebraco.R')}
W_OREL = {l: W[f'orelha.{l}'] + W[f'orelha2.{l}'] for l in ('L', 'R')}
W_BRACO = W['braco.L'] + W['braco.R'] + W['antebraco.L'] + W['antebraco.R']


def malha_posta():
    # os vértices como a cena os mostra agora (o esqueleto sem giro), no espaço do esqueleto
    ARM.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = MESH.evaluated_get(dg)
    m = ev.to_mesh()
    co = np.empty(len(m.vertices) * 3)
    m.vertices.foreach_get('co', co)
    ev.to_mesh_clear()
    return co.reshape(-1, 3)


# ============================ O BONÉ ============================
def base_do_bone(co):
    # a cabeça: o crânio sem as orelhas (o alto entre as orelhas entra, mesmo meio pesado nelas) e a esfera que melhor
    # passa por ele, acima da altura das bochechas
    orel = W_OREL['L'] + W_OREL['R']
    H = co[(W['cabeca'] + orel > 0.6) & (orel < 0.5)]
    H = H[H[:, 2] > np.percentile(H[:, 2], 35)]
    A = np.c_[2 * H, np.ones(len(H))]
    sol_ = np.linalg.lstsq(A, (H ** 2).sum(1), rcond=None)[0]
    C = sol_[:3]
    raio = float(np.sqrt(sol_[3] + C @ C))
    return H, C, raio


def encaixar_bone(co, caidas):
    # Orelha caída: primeiro POR CIMA (a orelha é parte da cabeça que o boné cobre, e sai por baixo da aba, dos lados);
    # se não houver boné de tamanho razoável que cubra a raiz dela, NA FRENTE, como na orelha em pé.
    if caidas:
        try:
            return dict(_encaixar_bone(co, 'por-cima'), modo='por-cima')
        except RuntimeError:
            pass
    return dict(_encaixar_bone(co, 'na-frente'), modo='na-frente')


def _encaixar_bone(co, modo):
    # PROCURA o lugar do boné sobre a cabeça. O eixo do boné sai do centro da cabeça a φ graus da vertical, para a frente
    # (o rosto olha -Y); a boca do boné é o plano que corta a cabeça a uma profundidade p do alto, e a boca TEM O TAMANHO
    # DO CORTE (o boné assenta: abraça a cabeça de lado a lado e de frente a trás). Vale o maior boné (até o alvo, 86% do
    # raio da cabeça) em que:
    #   - a cabeça acima da boca fica DENTRO da copa (nada atravessa);
    #   - orelha em pé: nenhum ponto da orelha dentro dele, com folga (o boné fica entre e na frente das orelhas);
    #   - orelha caída: o que da orelha está acima da boca fica DENTRO (ela sai por baixo, dos lados);
    #   - a beira da frente não desce até os olhos.
    # O tamanho pesa junto com o φ: cada grau longe de 20° (o boné um pouco para a frente, como se usa) custa 0,6%.
    H, C, raio = base_do_bone(co)
    E = [co[W_OREL[l] > 0.5] for l in ('L', 'R')]
    alvo = 0.86 * raio
    caidas = modo == 'por-cima'
    testa = C[2] + 0.3 * raio
    if caidas:
        # a cabeça que o boné cobre inclui as orelhas acima da boca; o boné pode passar um pouco da cabeça
        H = np.vstack([H, E[0], E[1]])
        E = []
        alvo = 1.12 * raio
    melhor = None
    xl = np.array([1.0, 0, 0])
    for phi in np.arange(0, 49, 3):
        f = math.radians(phi)
        n = np.array([0, -math.sin(f), math.cos(f)])
        fr = np.array([0, -math.cos(f), -math.sin(f)])
        yl = -fr       # o y local aponta para TRÁS (a aba vai para -y local, a frente do corpo)
        q = H - C
        hh = np.stack([q @ xl, q @ yl, q @ n], 1)
        topo = hh[:, 2].max()
        for p in np.arange(0.05, 2.2, 0.03):
            O = C + n * (topo - p)
            h = hh - np.array([0, 0, topo - p])
            boca = np.abs(h[:, 2]) < 0.07
            if boca.sum() < 8:
                continue
            rx = np.abs(h[boca, 0]).max() / 0.95
            ry = max(h[boca, 1].max(), -h[boca, 1].min()) / 0.95
            ry, rx = min(ry, 1.25 * rx), min(rx, 1.25 * ry)
            if rx > alvo:
                break
            # o boné não desce até os olhos: a beira da frente fica acima da testa (30% do raio acima do centro)
            if O[2] - ry * math.sin(f) < testa:
                break
            # a copa: baixa de fábrica; mais alta só se for o que cobre a base da orelha caída
            for rz in sorted({max(0.72 * min(rx, ry), 1.08 * p), max(0.95 * min(rx, ry), 1.08 * p)} | ({1.1 * min(rx, ry)} if caidas else set())):
                dd = np.sqrt((h[:, 0] / rx) ** 2 + (h[:, 1] / ry) ** 2 + (h[:, 2] / rz) ** 2)
                if np.any(dd[h[:, 2] > 0] > 0.985):
                    continue
                ok = True
                for e in E:
                    qe = e - O
                    le = np.stack([qe @ xl, qe @ yl, qe @ n], 1)
                    de = np.sqrt((le[:, 0] / rx) ** 2 + (le[:, 1] / ry) ** 2 + (le[:, 2] / rz) ** 2)
                    if caidas:
                        if np.any(de[le[:, 2] > 0.02] > 0.97):
                            ok = False
                    elif np.any((de < 1.07) & (le[:, 2] > -0.25)):    # folga: a orelha balança uns graus
                        ok = False
                if not ok:
                    continue
                cand = (float(rx) / alvo - 0.006 * abs(phi - 20), -rz)   # 1° fora dos 20° custa 0,6% do tamanho
                if melhor is None or cand > melhor[0]:
                    melhor = (cand, dict(phi=float(phi), profundidade=float(p), O=O.tolist(), n=n.tolist(), fr=fr.tolist(),
                                         r=[float(rx), float(ry), float(rz)], alvo=float(alvo)))
                break
    if melhor is None:
        raise RuntimeError('o boné não coube na cabeça deste corpo')
    return melhor[1]



def malha_do_bone(nome, rx, ry, rz, levanta=0.0, aba_k=0.85):
    # no espaço do boné: a boca no z = 0, a copa para +z, a aba para -y. Low poly, no estilo do mascote (formas cheias,
    # sombreado suave): a copa em seis gomos, o botão em cima, a faixa da boca e a aba curva.
    bm = bmesh.new()
    seg, an = 24, 8
    anel = []
    for i in range(an + 1):
        th = (math.pi / 2) * i / an          # 0 na boca, 90° no topo
        linha_ = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            # a copa do boné é mais alta na frente (o painel da frente fica em pé)
            frente = max(0.0, -math.sin(a))
            alt = rz * (1 + 0.12 * frente)
            if i == an:
                p = (0, 0, rz)
                linha_.append(p)
                continue
            linha_.append((rx * math.cos(th) * math.cos(a), ry * math.cos(th) * math.sin(a), alt * math.sin(th)))
        anel.append(linha_)
    vs = [[bm.verts.new(p) for p in linha_] for linha_ in anel[:-1]]
    topo = bm.verts.new((0, 0, rz))
    for i in range(an - 1):
        for j in range(seg):
            bm.faces.new((vs[i][j], vs[i][(j + 1) % seg], vs[i + 1][(j + 1) % seg], vs[i + 1][j]))
    for j in range(seg):
        bm.faces.new((vs[an - 1][j], vs[an - 1][(j + 1) % seg], topo))
    # a borda de dentro (espessura), para a boca não mostrar um papel
    dentro = [bm.verts.new((v.co.x * 0.94, v.co.y * 0.94, v.co.z)) for v in vs[0]]
    for j in range(seg):
        bm.faces.new((vs[0][(j + 1) % seg], vs[0][j], dentro[j], dentro[(j + 1) % seg]))
    copa = bm.faces[:]
    # a aba: meia elipse para a frente (-y), saindo da boca, um pouco caída
    aba = []
    na = 9
    L = aba_k * ry
    cai = math.radians(14) - levanta
    for k in range(na + 1):
        a = math.pi + math.pi * k / na           # de 180° a 360°: a metade da frente (-y)
        ix, iy = rx * 1.01 * math.cos(a), ry * 1.01 * math.sin(a)
        ext = L * max(0.0, -math.sin(a)) ** 0.7
        ox, oy = ix * 1.04, iy - ext * math.cos(cai)
        oz = -ext * math.sin(cai)
        aba.append(((ix, iy, 0.02), (ox, oy, oz)))
    esp = 0.06
    cima = [(bm.verts.new(p), bm.verts.new(q)) for p, q in aba]
    baixo = [(bm.verts.new((p[0], p[1], p[2] - esp)), bm.verts.new((q[0], q[1], q[2] - esp))) for p, q in aba]
    for k in range(na):
        bm.faces.new((cima[k][0], cima[k + 1][0], cima[k + 1][1], cima[k][1]))
        bm.faces.new((baixo[k][1], baixo[k + 1][1], baixo[k + 1][0], baixo[k][0]))
        bm.faces.new((cima[k][1], cima[k + 1][1], baixo[k + 1][1], baixo[k][1]))
    for k in (0, na):
        bm.faces.new((cima[k][0], cima[k][1], baixo[k][1], baixo[k][0]))
    aba_faces = [f for f in bm.faces if f not in set(copa)]
    me = bpy.data.meshes.new(nome)
    bm.normal_update()
    for f in aba_faces:
        f.material_index = 1
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nome, me)
    cena.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    # o botão do topo
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13 * rx, segments=10, ring_count=6, location=(0, 0, rz * 1.02))
    bt = bpy.context.object
    bt.scale = (1, 1, 0.55)
    bt.data.materials.clear()
    return ob, bt


def montar_bone(fit, nome):
    rx, ry, rz = fit['r']
    meshy = os.path.join(PASTA_MESHY, 'bone.glb')
    O, n, fr = Vector(fit['O']), Vector(fit['n']), Vector(fit['fr'])
    base = Matrix((Vector((1, 0, 0)), -fr, n)).transposed().to_4x4()
    base.translation = O
    if os.path.exists(meshy):
        # o boné do Meshy vai INTEIRO, só na escala (sem esticar um eixo): a forma é a dele, e o alvo_2d.py já mediu o
        # encaixe com os pontos dele (rx é a meia largura da copa)
        ob = importar_bone_meshy(meshy, nome, rx)
        vestir(ob, [(mat_pixel(nome, BONE_COR), m) for m in ob.data.materials[:]], anexar=False)
    else:
        # a aba fica perto da horizontal no mundo (5° para baixo), por mais que a copa incline para a frente
        ob, bt = malha_do_bone(nome, rx, ry, rz, levanta=math.radians(fit['phi'] + 9),
                                  aba_k=fit.get('aba', 0.85))
        pares = [(mat_pixel(nome + '-copa', BONE_COR), mat_normal(nome + '-copa', BONE_COR, 0.8)),
                 (mat_pixel(nome + '-aba', BONE_ABA), mat_normal(nome + '-aba', BONE_ABA, 0.7))]
        vestir(ob, pares)
        bt.data.materials.append(pares[0][1])
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True); bt.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.join()
        ob = bpy.context.object
        ob.name = nome
    ob.matrix_world = base
    prender_ao_osso(ob, 'cabeca')
    return ob


def canonico_do_bone(V):
    # o boné do Meshy no espaço do boné: a boca no z = 0 (o mais baixo da parte de trás), a copa para +z, a aba para -y,
    # e a meia largura da copa = 1. A frente do Meshy olha para -Y no Blender (conferido em 09/11/2026: a aba está em -Y).
    V = np.asarray(V, float)
    cx = (V[:, 0].min() + V[:, 0].max()) / 2
    rx_m = (V[:, 0].max() - V[:, 0].min()) / 2
    cy = V[:, 1].max() - 1.05 * rx_m
    mz = np.percentile(V[V[:, 1] > cy][:, 2], 2)
    return (V - np.array([cx, cy, mz])) / rx_m


def importar_bone_meshy(caminho, nome, rx):
    antes = set(cena.objects)
    bpy.ops.import_scene.gltf(filepath=caminho)
    novos = [o for o in cena.objects if o not in antes]
    malhas = [o for o in novos if o.type == 'MESH']
    for o in novos:
        if o.type != 'MESH':
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in malhas:
        mw_ = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw_
        o.select_set(True)
    bpy.context.view_layer.objects.active = malhas[0]
    if len(malhas) > 1:
        bpy.ops.object.join()
    ob = bpy.context.object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    N = canonico_do_bone([v.co[:] for v in ob.data.vertices]) * rx
    for v, c in zip(ob.data.vertices, N):
        v.co = tuple(c)
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.name = nome
    return ob


def prender_ao_osso(ob, osso_):
    mw_ = ob.matrix_world.copy()
    ob.parent = ARM; ob.parent_type = 'BONE'; ob.parent_bone = osso_
    bpy.context.view_layer.update()
    ob.matrix_world = mw_


def importar_meshy(caminho, nome, caixa, centro_y=0.0):
    # o GLB do Meshy: uma malha. Centrada, levada à caixa (largura x, profundidade y, altura z) do provisório, no espaço
    # do acessório (a boca no z = 0). A frente do Meshy olha para -Y no Blender, como a do corpo.
    antes = set(cena.objects)
    bpy.ops.import_scene.gltf(filepath=caminho)
    novos = [o for o in cena.objects if o not in antes]
    malhas = [o for o in novos if o.type == 'MESH']
    for o in novos:
        if o.type != 'MESH':
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in malhas:
        mw_ = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw_
        o.select_set(True)
    bpy.context.view_layer.objects.active = malhas[0]
    if len(malhas) > 1:
        bpy.ops.object.join()
    ob = bpy.context.object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    vs_ = np.array([v.co[:] for v in ob.data.vertices])
    lo, hi = vs_.min(0), vs_.max(0)
    k = np.array(caixa) / np.maximum(hi - lo, 1e-6)
    for v in ob.data.vertices:
        c = (np.array(v.co[:]) - lo) * k
        v.co = (c[0] - caixa[0] / 2, c[1] - caixa[1] / 2 + centro_y, c[2])
    ob.name = nome
    return ob


# ============================ A BANDANA ============================
def corpo_sem_bracos(co):
    m = (W_BRACO < 0.15) & (W_OREL['L'] + W_OREL['R'] < 0.1)
    return co[m]


def raio_em(P, centro, ang, z, janela_ang=12, janela_z=0.14):
    # o raio da malha numa direção (ang, a partir da frente -y, girando para +x) e numa altura: o ponto mais longe do eixo
    q = P - centro
    a = np.degrees(np.arctan2(q[:, 0], -q[:, 1]))
    da = (a - ang + 180) % 360 - 180
    m = (np.abs(da) < janela_ang) & (np.abs(P[:, 2] - z) < janela_z)
    if m.sum() < 2:
        return None
    return float(np.sqrt(q[m, 0] ** 2 + q[m, 1] ** 2).max())


def encaixar_bandana(co):
    # O PESCOÇO: onde a cabeça acaba (os vértices da cabeça mais baixos, pelo 3.º percentil) e o eixo do corpo ali
    P = corpo_sem_bracos(co)
    cab = co[(W['cabeca'] > 0.5) & (W_OREL['L'] + W_OREL['R'] < 0.1)]
    zb = float(np.percentile(cab[:, 2], 3))
    fatia = P[np.abs(P[:, 2] - zb) < 0.2]
    centro = np.array([(fatia[:, 0].min() + fatia[:, 0].max()) / 2, (fatia[:, 1].min() + fatia[:, 1].max()) / 2, 0])
    return dict(zb=zb, centro=centro.tolist(), P=P)


def montar_bandana(fit, nome):
    P, centro, zb = fit['P'], np.array(fit['centro']), fit['zb']
    folga = 0.07
    bm = bmesh.new()
    seg = 40
    # a faixa em volta do pescoço: duas linhas, a de cima e a de baixo, cada uma no raio da malha na altura dela; na
    # frente ela desce um pouco (o pano pende)
    def ponto(ang, z, extra=0.0):
        r = raio_em(P, centro, ang, z)
        if r is None:
            r = raio_em(P, centro, ang, z, 25, 0.3) or 1.2
        a = math.radians(ang)
        r += folga + extra
        return (centro[0] + r * math.sin(a), centro[1] - r * math.cos(a), z)

    def queda(ang):
        return 0.16 * max(0.0, math.cos(math.radians(ang)))

    linhas = []
    for z_off, extra in ((0.22, 0.0), (0.02, 0.02), (-0.16, 0.04)):
        linhas.append([bm.verts.new(ponto(360 * j / seg, zb + z_off - queda(360 * j / seg), extra)) for j in range(seg)])
    for i in range(len(linhas) - 1):
        for j in range(seg):
            bm.faces.new((linhas[i][j], linhas[i][(j + 1) % seg], linhas[i + 1][(j + 1) % seg], linhas[i + 1][j]))
    # o triângulo da frente: do ângulo -50° ao +50°, descendo até a ponta (1,0 abaixo), colado no peito
    nl, nc = 7, 11
    alto = 1.0
    z0 = zb - 0.16 - queda(0)
    tri = []
    for i in range(nl + 1):
        t = i / nl
        meia = 50 * (1 - t)
        z = z0 - alto * t
        linha_ = []
        for j in range(nc):
            ang = -meia + 2 * meia * j / (nc - 1) if nc > 1 else 0
            linha_.append(bm.verts.new(ponto(ang, z, 0.05 + 0.05 * (1 - t))))
        tri.append(linha_)
    for i in range(nl):
        for j in range(nc - 1):
            bm.faces.new((tri[i][j], tri[i][j + 1], tri[i + 1][j + 1], tri[i + 1][j]))
    me = bpy.data.meshes.new(nome)
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(nome, me)
    cena.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    mod = ob.modifiers.new('espessura', 'SOLIDIFY'); mod.thickness = 0.05; mod.offset = 1.0
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier='espessura')
    # o nó atrás: duas bolotas e duas pontas soltas
    pecas = [ob]
    atras = ponto(180, zb + 0.06, 0.12)
    for dx in (-0.16, 0.16):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.17, segments=12, ring_count=8, location=(atras[0] + dx, atras[1], atras[2]))
        o = bpy.context.object; o.scale = (1.1, 0.75, 0.85); pecas.append(o)
    for dx, gr in ((-0.12, 18), (0.12, -18)):
        bpy.ops.mesh.primitive_cone_add(radius1=0.14, radius2=0.03, depth=0.55, vertices=8,
                                        location=(atras[0] + dx * 2, atras[1] + 0.06, atras[2] - 0.3))
        o = bpy.context.object; o.rotation_euler = (math.radians(180 + 8), math.radians(gr), 0); o.scale = (1, 0.45, 1)
        pecas.append(o)
    for o in pecas[1:]:
        o.data.materials.clear()
    pares = [(mat_pixel(nome, BANDANA_COR), mat_normal(nome, BANDANA_COR, 0.9)),
             (mat_pixel(nome + '-no', NO_COR), mat_normal(nome + '-no', NO_COR, 0.9))]
    meshy = os.path.join(PASTA_MESHY, 'bandana.glb')
    if os.path.exists(meshy):
        # o do Meshy entra na caixa do provisório (a faixa, o triângulo e o nó)
        vs_ = []
        for o in pecas:
            bpy.context.view_layer.update()
            vs_ += [tuple(o.matrix_world @ v.co) for v in o.data.vertices]
        vs_ = np.array(vs_); lo, hi = vs_.min(0), vs_.max(0)
        for o in pecas:
            bpy.data.objects.remove(o)
        ob = importar_meshy(meshy, nome, caixa=tuple(hi - lo))
        ob.location = tuple((lo + hi) / 2 - np.array([0, 0, (hi - lo)[2] / 2]))
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        vestir(ob, [(pares[0][0], m) for m in ob.data.materials[:]], anexar=False)
    else:
        vestir(ob, pares)
        for o in pecas[1:]:
            o.data.materials.append(pares[1][1])
            for p in o.data.polygons:
                p.use_smooth = True
        bpy.ops.object.select_all(action='DESELECT')
        for o in pecas:
            o.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.join()
        ob = bpy.context.object
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ob.name = nome
    pelos_pesos_da_pele(ob, fit)
    return ob


def pelos_pesos_da_pele(ob, fit):
    # A bandana veste o pescoço: cada vértice dela leva a média dos pesos dos 6 vértices do corpo mais perto (sem braço
    # nem orelha), e segue o tronco e a cabeça como a pele embaixo dela.
    m = (W_BRACO < 0.15) & (W_OREL['L'] + W_OREL['R'] < 0.1)
    idx = np.nonzero(m)[0]
    co_ = fit['co'][idx]
    nomes = ['cabeca', 'tronco', 'quadril']
    Wm = np.stack([W[n][idx] for n in nomes], 1)
    grupos_ = {n: ob.vertex_groups.new(name=n) for n in nomes}
    for v in ob.data.vertices:
        p = np.array(v.co[:])
        d = np.linalg.norm(co_ - p, axis=1)
        k = np.argpartition(d, 6)[:6]
        w = Wm[k].mean(0)
        w = w / max(w.sum(), 1e-6)
        for n, x in zip(nomes, w):
            if x > 1e-3:
                grupos_[n].add([v.index], float(x), 'REPLACE')
    ob.parent = ARM
    md = ob.modifiers.new('esqueleto', 'ARMATURE'); md.object = ARM


# ============================ MONTAR OS ACESSÓRIOS DE CADA CORPO ============================
if ETAPA == 'medir':
    if os.path.exists(os.path.join(PASTA_MESHY, 'bone.glb')):
        bpy.ops.import_scene.gltf(filepath=os.path.join(PASTA_MESHY, 'bone.glb'))
        _bm = [o for o in bpy.context.selected_objects if o.type == 'MESH'][0]
        np.save(os.path.join(SAIDA_C, 'bone-meshy.npy'),
                canonico_do_bone([tuple(_bm.matrix_world @ v.co) for v in _bm.data.vertices]))
        bpy.data.objects.remove(_bm)
    for CORPO in CORPOS:
        repouso()
        np.savez(os.path.join(SAIDA_C, f'medida-{CORPO}.npz'), co=malha_posta(), **{k.replace('.', '_'): v for k, v in W.items()},
                 **{f'orel_{k}': v for k, v in W_OREL.items()}, braco=W_BRACO)
    CORPOS = []
ACES = {}
for CORPO in CORPOS:
    repouso()
    co = malha_posta()
    # O BONÉ COPIA O 2D (decisão dele, 09/11/2026): o alvo_2d.py mede o boné do 2D nas 4 diagonais e grava onde ele senta
    # neste corpo; sem esse arquivo, a busca antiga (o maior boné que cabe)
    alvo_ = os.path.join(SAIDA_C, f'alvo-bone-{CORPO}.json')
    fit_b = json.load(open(alvo_)) if os.path.exists(alvo_) and os.environ.get('BONE') != 'busca'         else encaixar_bone(co, caidas=caida(CORPO))
    fit_n = encaixar_bandana(co)
    fit_n['co'] = co
    _, C_, R_ = base_do_bone(co)
    INFO[CORPO] = dict(bone={k: v for k, v in fit_b.items()}, cabeca_centro=C_.tolist(), cabeca_raio=R_,
                       pescoco_z=fit_n['zb'], pescoco_centro=fit_n['centro'])
    print('encaixe', CORPO, json.dumps(INFO[CORPO]))
    ACES[CORPO, 'bone'] = montar_bone(fit_b, f'acessorio-bone-{CORPO}')
    ACES[CORPO, 'bandana'] = montar_bandana(fit_n, f'acessorio-bandana-{CORPO}')


DIRECAO_OREL = {}


def violacoes_da_orelha(fit, quadros):
    # quantos vértices de orelha ficam DENTRO ou EM CIMA do boné (na projeção da boca dele, acima de quase a boca), no
    # pior dos quadros; a orelha só pode passar ao lado ou atrás dele
    O, n, fr = np.array(fit['O']), np.array(fit['n']), np.array(fit['fr'])
    yl = -fr
    rx, ry, rz = fit['r']
    # a orelha de verdade (o peso dela passa de metade); a emenda com o crânio fica embaixo do boné, como o crânio
    idx = np.nonzero(W_OREL['L'] + W_OREL['R'] > 0.5)[0]
    pior = 0
    for f in quadros:
        f()
        q = malha_posta()[idx] - O
        lx, ly, lz = q[:, 0] / rx, (q @ yl) / ry, (q @ n) / rz
        pior = max(pior, int(((lx ** 2 + ly ** 2 < 1.06 ** 2) & (lz > -0.08)).sum()))
        if pior and len(quadros) > 4:
            pass
    return pior


# quanto vale andar a base contra girar (0,1 de deslocamento pesa como PESO_DESLOCA/10 graus). Medido em 10/11/2026 no
# mascote: com 40 sai (12°, 3°, 1,2) e a orelha fica em pé, com a raiz esticada de costas; com 100 sai (57°, 27°, 0,7) e
# as orelhas ficam quase na horizontal. Ficou o 40.
PESO_DESLOCA = float(os.environ.get('PESO_DESLOCA', 40))


def ajuste_das_orelhas(corpo, fit):
    global CORPO, CHAPEU
    CORPO, CHAPEU = corpo, True
    todos = [lambda i=i: pose_parado(i, 16) for i in range(0, 16, 2)] + \
            [lambda i=i: pose_andando(i, 8) for i in range(8)]
    poucos = [todos[0], todos[4], todos[8], todos[10], todos[12], todos[14]]
    # para onde a base anda: na horizontal, do eixo do boné para a base de cada orelha
    O = np.array(fit['O'])
    DIRECAO_OREL[corpo] = {}
    for lado in ('L', 'R'):
        b = np.array(OSSO_ORELHA[lado][0][:])
        v = np.array([b[0] - O[0], b[1] - O[1], 0.0])
        v = v / max(np.linalg.norm(v), 1e-6)
        pb = pbs[f'orelha.{lado}']
        # anda() recebe o vetor no mundo e converte; guarda-se o do mundo
        DIRECAO_OREL[corpo][lado] = tuple(v)
    AJUSTE_OREL[corpo] = (0, 0, 0)
    antes = violacoes_da_orelha(fit, todos)
    if antes == 0:
        return (0, 0, 0), 0, 0
    # do menor movimento para o maior (0,1 de deslocamento pesa como 4°); confere-se em poucos quadros e, achado, em todos
    cands = [(a, d, m / 10) for a in range(0, 61, 3) for d in range(0, 46, 3) for m in range(0, 13)]
    cands.sort(key=lambda x: x[0] ** 2 + x[1] ** 2 + (x[2] * PESO_DESLOCA) ** 2)
    if os.environ.get('DIAG'):
        cands = cands[:1]
    v = antes
    for c in cands:
        AJUSTE_OREL[corpo] = c
        if violacoes_da_orelha(fit, poucos) == 0:
            v = violacoes_da_orelha(fit, todos)
            if v == 0:
                return c, antes, 0
    # nenhum resolve: devolve o maior, com o que sobra medido de verdade
    return AJUSTE_OREL[corpo], antes, violacoes_da_orelha(fit, todos)


# O AJUSTE DAS ORELHAS da v4 ficou DESLIGADO (decisão dele, 10/11/2026: as orelhas viravam "asas"); no lugar, o boné
# RECUA nas vistas de costas (recuo_de_costas, abaixo). ORELHAS_COM_BONE=1 liga o ajuste de novo, para comparar.
for CORPO in (CORPOS if os.environ.get('ORELHAS_COM_BONE') else []):
    if caida(CORPO):
        continue          # a orelha caída passa por baixo do boné de propósito
    aj, antes, depois = ajuste_das_orelhas(CORPO, INFO[CORPO]['bone'])
    INFO[CORPO]['orelhas_com_bone'] = dict(afasta=aj[0], deita=aj[1], desloca=aj[2], vertices_antes=antes,
                                           vertices_depois=depois)
    print('orelhas com o boné', CORPO, INFO[CORPO]['orelhas_com_bone'])
if os.environ.get('DIAG'):
    # diagnóstico: onde ficam os vértices de orelha que violam, sem ajuste e com o maior ajuste
    for aj_ in ((0, 0, 0), (30, 24, 0.8), (60, 40, 1.5)):
        CORPO, CHAPEU = 'mascote', True
        AJUSTE_OREL['mascote'] = aj_
        fit = INFO['mascote']['bone']
        for nome_q, fq in [(f'p{i}', (lambda i=i: pose_parado(i, 16))) for i in range(0, 16, 2)] +                           [(f'a{i}', (lambda i=i: pose_andando(i, 8))) for i in range(8)]:
            print('DIAG quadro', aj_, nome_q, violacoes_da_orelha(fit, [fq]))
        pose_parado(0, 16)
        O, n, fr = np.array(fit['O']), np.array(fit['n']), np.array(fit['fr'])
        rx, ry, rz = fit['r']
        idx = np.nonzero(W_OREL['L'] + W_OREL['R'] > 0.5)[0]
        P = malha_posta()[idx]
        q = P - O
        lx, ly, lz = q[:, 0] / rx, (q @ -fr) / ry, (q @ n) / rz
        m = (lx ** 2 + ly ** 2 < 1.06 ** 2) & (lz > -0.08)
        w = (W_OREL['L'] + W_OREL['R'])[idx]
        print('DIAG', aj_, 'viol', int(m.sum()), 'w', np.round(np.percentile(w[m], [0, 50, 100]), 2) if m.any() else '-',
              'P', np.round(P[m].min(0), 2) if m.any() else '-', np.round(P[m].max(0), 2) if m.any() else '-',
              'orelha toda z', np.round(P[:, 2].min(), 2), np.round(P[:, 2].max(), 2), 'x', np.round(P[:, 0].min(), 2), np.round(P[:, 0].max(), 2))
    print('DIAG fit', fit['O'], fit['r'], fit['n'])
    raise SystemExit
CHAPEU = False
zerar()
with open(os.path.join(SAIDA_C, 'encaixe.json'), 'w', encoding='utf-8') as f_:
    json.dump(INFO, f_, indent=1)

COMBOS = {'nada': (), 'bone': ('bone',), 'bandana': ('bandana',), 'ambos': ('bone', 'bandana')}

# O BONÉ RECUA NAS VISTAS DE COSTAS (decisão dele, 10/11/2026: "de costas, se trouxer para trás o boné, apenas na pose de
# trás, para mim está ok"). É um ajuste por VISTA (pela direção do render), não por pose: de costas, todo quadro usa o
# recuo daquela vista; de frente e de lado, o lugar de sempre. O boné RECUA GIRANDO em volta do centro da cabeça (assim
# continua sentado nela: empurrado em linha reta para trás, ele flutuaria sobre a nuca). O ângulo se MEDE na malha, para
# cada vista de costas: o menor em que, em todos os quadros do parado e do andando, pela câmera daquela vista, quase nada
# da copa fica atrás de uma orelha (o boné aparece inteiro, na frente da base delas, sem picotar). A base da orelha que
# fica dentro da copa não aparece: a copa a cobre; o relatório conta quantos vértices são.
# No 3D de câmera livre (o site), o mesmo entraria pelo ângulo entre a câmera e a frente do coelho: com a câmera atrás
# (mais de ~120° da frente), o boné vai ao giro medido, interpolado na faixa de passagem. Não está no site.
VISTAS_DE_COSTAS = {'north-east': 180 - GIRO, 'north-west': -(180 - GIRO), 'north': 180}
RECUO = {}            # corpo -> {vista: graus de giro para trás, em volta do centro da cabeça}
BASE_DO_BONE = {}     # nome do objeto -> (matrix_basis de sempre, a rotação do pai para levar um vetor do mundo à base)
_rng_c = np.random.default_rng(3)
_cs = _rng_c.normal(size=(1500, 3)); _cs /= np.linalg.norm(_cs, axis=1, keepdims=True)
COPA_UNITARIA = _cs[_cs[:, 2] > 0.05]     # a superfície da copa, numa meia esfera de raio 1


def giro_para_tras(graus):
    # o giro em volta do eixo x que leva o alto da cabeça para trás (+y)
    t = math.radians(graus)
    return np.array([[1, 0, 0], [0, math.cos(t), math.sin(t)], [0, -math.sin(t), math.cos(t)]])


def recuo_de_costas(corpo, fit):
    global CORPO, CHAPEU
    CORPO, CHAPEU = corpo, False
    O0, n, fr = np.array(fit['O']), np.array(fit['n']), np.array(fit['fr'])
    yl = -fr
    xl = np.array([1.0, 0, 0])
    rx, ry, rz = fit['r']
    idx = np.nonzero(W_OREL['L'] + W_OREL['R'] > 0.5)[0]
    quadros = [lambda i=i: pose_parado(i, 16) for i in range(0, 16, 2)] + [lambda i=i: pose_andando(i, 8) for i in range(8)]
    # as orelhas e o crânio em cada quadro, no espaço da CABEÇA (o boné anda com ela): a pose muda a cabeça, não o boné
    cab = ARM.pose.bones['cabeca']
    orelhas_q = []
    for f in quadros:
        f()
        co_ = malha_posta()
        M = np.array(ARM.matrix_world @ cab.matrix)
        Mi = np.linalg.inv(M)
        P = co_[idx]
        Pc = (Mi[:3, :3] @ P.T).T + Mi[:3, 3]
        orelhas_q.append((Pc, M))
    zerar(); bpy.context.view_layer.update()
    M0 = np.array(ARM.matrix_world @ cab.matrix)
    M0i = np.linalg.inv(M0)

    def no_mundo(Pc, M):
        return (M[:3, :3] @ Pc.T).T + M[:3, 3]

    cima = np.array([0, math.sin(ELEV), math.cos(ELEV)])
    frente_cam = np.array([0, math.cos(ELEV), -math.sin(ELEV)])
    resultado = {}
    for d, graus in VISTAS_DE_COSTAS.items():
        g = math.radians(graus)
        R = np.array([[math.cos(g), -math.sin(g), 0], [math.sin(g), math.cos(g), 0], [0, 0, 1]])
        achado = None
        copa0 = O0 + (COPA_UNITARIA[:, :1] * rx) * xl + (COPA_UNITARIA[:, 1:2] * ry) * yl + (COPA_UNITARIA[:, 2:3] * rz) * n
        Cc = np.array(INFO[corpo]['cabeca_centro'])
        for k in range(0, 31):
            r_ = k * 3
            Rb = giro_para_tras(r_)
            # o boné girado para trás em volta do centro da cabeça, no espaço da cabeça em repouso
            copa = (Rb @ (copa0 - Cc).T).T + Cc
            copa_c = (M0i[:3, :3] @ copa.T).T + M0i[:3, 3]
            pior_dentro, pior_coberto = 0, 0.0
            for Pc, M in orelhas_q:
                # dentro da copa: a orelha levada ao espaço do boné antes do giro
                Pw0 = no_mundo(Pc, M0)
                q = (Rb.T @ (Pw0 - Cc).T).T + Cc - O0
                dd = np.sqrt((q @ xl / rx) ** 2 + (q @ yl / ry) ** 2 + (q @ n / rz) ** 2)
                pior_dentro = max(pior_dentro, int(((dd < 1.0) & (q @ n > 0)).sum()))
                # coberto pela orelha, pela câmera desta vista: o ponto da copa que tem orelha na frente (mais perto)
                cw = (R @ no_mundo(copa_c, M).T).T
                ew = (R @ no_mundo(Pc, M).T).T
                cx, cy, cz = cw[:, 0], cw @ cima, cw @ frente_cam
                ex, ey, ez = ew[:, 0], ew @ cima, ew @ frente_cam
                perto = (np.abs(cx[:, None] - ex[None]) < 0.1) & (np.abs(cy[:, None] - ey[None]) < 0.1) & \
                        (ez[None] < cz[:, None] - 0.02)
                pior_coberto = max(pior_coberto, float(perto.any(1).mean()))
            if pior_coberto < 0.03:
                achado = (r_, pior_dentro, pior_coberto)
                break
            if k == 0:
                inicio = (pior_dentro, round(pior_coberto, 3))
        resultado[d] = dict(recuo=achado[0] if achado else None, sem_recuo=inicio,
                            com_recuo=(achado[1], round(achado[2], 3)) if achado else None)
        print('recuo de costas', corpo, d, resultado[d])
    return resultado


for CORPO in CORPOS:
    if caida(CORPO):
        continue          # na orelha caída o boné já cobre a raiz das orelhas; de costas, ele fica onde está
    rr = recuo_de_costas(CORPO, INFO[CORPO]['bone'])
    RECUO[CORPO] = {d: v['recuo'] for d, v in rr.items() if v['recuo']}
    INFO[CORPO]['recuo_de_costas'] = rr
with open(os.path.join(SAIDA_C, 'encaixe.json'), 'w', encoding='utf-8') as f_:
    json.dump(INFO, f_, indent=1)
CHAPEU = False
zerar()
bpy.context.view_layer.update()
for (c, a), ob in ACES.items():
    if a == 'bone':
        Mp = ob.matrix_world @ ob.matrix_basis.inverted()
        BASE_DO_BONE[ob.name] = (ob.matrix_basis.copy(), Mp.copy())


def posicionar_bone(vista):
    # o boné no lugar de sempre, ou recuado se esta vista é de costas e o corpo tem recuo medido
    for (c, a), ob in ACES.items():
        if a != 'bone' or ob.name not in BASE_DO_BONE:
            continue
        base, Mp = BASE_DO_BONE[ob.name]
        ob.matrix_basis = base.copy()
        r_ = RECUO.get(c, {}).get(vista)
        if r_:
            # o giro no espaço do esqueleto em repouso, levado à base do objeto (o pai é o osso da cabeça)
            Cc = Vector(INFO[c]['cabeca_centro'])
            T = Matrix.Translation(Cc) @ Matrix(giro_para_tras(r_).tolist()).to_4x4() @ Matrix.Translation(-Cc)
            ob.matrix_basis = Mp.inverted() @ T @ Mp @ base


def vestir_corpo(corpo, combo):
    global CORPO, CHAPEU
    CORPO = corpo
    CHAPEU = 'bone' in COMBOS[combo]
    for (c, a), ob in ACES.items():
        ob.hide_render = not (c == corpo and a in COMBOS[combo])
        ob.hide_viewport = ob.hide_render


# ============================ O RENDER EM PIXEL ART (os quadros para o pos.py deste piloto) ============================
VASS.hide_render = True
ik(0)


def usar(normal):
    for (c, a), ob in ACES.items():
        for slot, (mp, mn) in zip(ob.material_slots, MATS[ob.name] * 4):
            slot.material = mn if normal else mp


def render_pixel(caminho):
    usar(False)
    r.filepath = caminho
    bpy.ops.render.render(write_still=True)
    guard = {ob.name: [s.material for s in ob.material_slots] for ob in ACES.values()}
    MESH.material_slots[0].material = MAT_DIST
    for ob in ACES.values():
        for s in ob.material_slots:
            s.material = MAT_DIST
    cena.view_settings.view_transform = 'Raw'
    r.image_settings.color_depth = '16'
    r.filepath = caminho.replace('.png', '-z.png')
    bpy.ops.render.render(write_still=True)
    cena.view_settings.view_transform = 'Standard'
    r.image_settings.color_depth = '8'
    MESH.material_slots[0].material = MAT_COR
    for ob in ACES.values():
        for s, m in zip(ob.material_slots, guard[ob.name]):
            s.material = m


DIRS4 = {'south-east': GIRO, 'south-west': -GIRO, 'north-east': 180 - GIRO, 'north-west': -(180 - GIRO)}
QUADROS = os.path.join(SAIDA_C, 'quadros')
os.makedirs(QUADROS, exist_ok=True)
ANIM = {'parado': (16, pose_parado), 'andando': (8, pose_andando)}

if ETAPA != 'medir':
    if not SO_ or SO_ == 'pixel':
        for corpo in CORPOS:
            for combo in COMBOS:
                vestir_corpo(corpo, combo)
                for d, graus in dict(DIRS4, south=0, east=90, north=180, west=-90).items():
                    ARM.rotation_euler = (0, 0, math.radians(graus))
                    posicionar_bone(d)
                    pose_parado(0, 16)
                    bpy.context.view_layer.update()
                    render_pixel(os.path.join(QUADROS, f'{corpo}-{combo}-{d}.png'))
            print('ok pixel', corpo)
    if not SO_ or SO_ == 'anim':
        for corpo in CORPOS:
            vestir_corpo(corpo, 'ambos')
            for nome_, (n_, f_) in ANIM.items():
                for d, graus in DIRS4.items():
                    ARM.rotation_euler = (0, 0, math.radians(graus))
                    posicionar_bone(d)
                    for i in range(n_):
                        f_(i, n_)
                        bpy.context.view_layer.update()
                        render_pixel(os.path.join(QUADROS, f'anim-{corpo}-{nome_}-{d}-{i}.png'))
            print('ok anim', corpo)
        with open(os.path.join(SAIDA_C, 'animacoes.json'), 'w') as f_:
            json.dump({k: v[0] for k, v in ANIM.items()}, f_)

    # ============================ O RENDER 3D NORMAL ============================
    if not SO_ or SO_ == 'normal':
        nt_ = MAT_COR.node_tree
        tex_ = next(n for n in nt_.nodes if n.type == 'TEX_IMAGE')
        MAT_TEX = bpy.data.materials.new('mascote-textura'); MAT_TEX.use_nodes = True
        tt = MAT_TEX.node_tree
        bsdf_ = tt.nodes.get('Principled BSDF')
        ti = tt.nodes.new('ShaderNodeTexImage'); ti.image = tex_.image; ti.interpolation = 'Linear'
        tt.links.new(ti.outputs['Color'], bsdf_.inputs['Base Color'])
        bsdf_.inputs['Roughness'].default_value = 0.85
        sol_d = bpy.data.lights.new('sol', 'SUN'); sol_d.energy = 3.2; sol_d.angle = math.radians(8)
        sol = bpy.data.objects.new('sol', sol_d); cena.collection.objects.link(sol)
        sol.rotation_euler = LUZ.to_track_quat('Z', 'Y').to_euler()
        cena.world.use_nodes = True
        bg = cena.world.node_tree.nodes.get('Background')
        bg.inputs['Color'].default_value = (0.42, 0.43, 0.5, 1); bg.inputs['Strength'].default_value = 0.9
        r.resolution_x = r.resolution_y = 600
        r.filter_size = 1.2
        cena.eevee.taa_render_samples = 32
        try:
            cena.eevee.use_shadows = True
        except Exception:
            pass
        cena.view_settings.view_transform = 'AgX'
        MESH.material_slots[0].material = MAT_TEX
        usar(True)
        pasta_n = os.path.join(SAIDA_C, 'normal')
        os.makedirs(pasta_n, exist_ok=True)
        for corpo in CORPOS:
            for combo in COMBOS:
                vestir_corpo(corpo, combo)
                for d, graus in (('south', 0), ('south-east', GIRO), ('east', 90), ('north-east', 180 - GIRO),
                                 ('north', 180), ('north-west', -(180 - GIRO)), ('west', -90), ('south-west', -GIRO)):
                    ARM.rotation_euler = (0, 0, math.radians(graus))
                    posicionar_bone(d)
                    pose_parado(0, 16)
                    bpy.context.view_layer.update()
                    r.filepath = os.path.join(pasta_n, f'{corpo}-{combo}-{d}.png')
                    bpy.ops.render.render(write_still=True)
        print('ok normal')
        MESH.material_slots[0].material = MAT_COR
        bpy.data.objects.remove(sol)

    # ============================ O GLB DE TESTE (corpo e acessórios como nós separados) ============================
    if not SO_ or SO_ == 'glb':
        exec(open(os.path.join(CAMADAS_AQUI, 'glb_camadas.py'), encoding='utf-8').read())
