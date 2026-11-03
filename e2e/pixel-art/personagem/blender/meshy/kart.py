# O COELHO NO KART (03/11/2026, a Corrida dos coelhos, degrau 1): o mascote 3D sentado num kart em forma de cenoura,
# renderizado em 24 ângulos, como os jogos de corrida do Super Nintendo faziam com os pilotos (um desenho por ângulo, e o
# jogo escolhe o do ângulo entre a câmera e o kart). Carregado pelo mascote.py com KART=1 no ambiente (o esqueleto, os
# materiais e a câmera são os dele). Depois: python kart-pos.py.
#
# As pernas da malha ficam dentro do moletom e, sentado, o coelho parecia em pé (relato de 30/10/2026): aqui elas
# somem dentro do kart, e o que aparece é o tronco, os braços no volante e a cabeça.
#
# Sai em saida/kart/<n>.png (e -z.png, o passe de distância), n de 0 a 23: o ângulo do kart em relação à câmera, de 15
# em 15 graus. 0 = o kart de COSTAS para a câmera (o que quem dirige vê o tempo todo); 6 = virado para a direita da tela;
# 12 = de frente; 18 = virado para a esquerda.

KART_SAIDA = os.path.join(SAIDA, 'kart')
os.makedirs(KART_SAIDA, exist_ok=True)
VASS.hide_render = True
ik(0)

LARANJA = mat_liso('cenoura', (232, 126, 44))
LARANJA_ESC = mat_liso('cenoura-escura', (196, 92, 34))
VERDE = mat_liso('rama', (98, 168, 72))
PNEU = mat_liso('pneu', (52, 46, 54))
ARO = mat_liso('aro', (214, 206, 190))
VOLANTE = mat_liso('volante', (70, 62, 72))

pecas_kart = []


def peca(obj, mat, liso=True):
    obj.data.materials.append(mat)
    if liso:
        for p in obj.data.polygons:
            p.use_smooth = True
    pecas_kart.append(obj)
    return obj


# A CARROCERIA: uma cenoura deitada, a ponta para a frente (-Y). Um cone achatado para a frente e uma caixa arredondada
# atrás, onde o coelho senta. O assento é o vão do meio.
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, -0.2, 1.25), segments=32, ring_count=16)
o = bpy.context.object; o.scale = (2.25, 3.4, 0.95)
peca(o, LARANJA)
bpy.ops.mesh.primitive_cone_add(radius1=1.35, radius2=0.25, depth=2.6, location=(0, -3.9, 1.05), vertices=32)
o = bpy.context.object; o.rotation_euler = (math.radians(90), 0, 0); o.scale = (1.3, 1, 0.75)
peca(o, LARANJA)
# os anéis da cenoura: três faixas mais escuras atravessando a carroceria
for y_, r_ in ((-3.3, 1.2), (-4.3, 0.8)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r_, minor_radius=0.09, location=(0, y_, 1.08))
    o = bpy.context.object; o.rotation_euler = (math.radians(90), 0, 0); o.scale = (1.35, 1, 0.8)
    peca(o, LARANJA_ESC)
# a rama atrás, de aerofólio: três folhas verdes saindo em leque
for ang in (-28, 0, 28):
    bpy.ops.mesh.primitive_cone_add(radius1=0.6, radius2=0.05, depth=2.8, location=(0, 0, 0), vertices=12)
    o = bpy.context.object
    o.scale = (1, 0.35, 1)
    o.rotation_euler = (math.radians(-38), math.radians(ang), 0)
    o.location = (math.sin(math.radians(ang)) * 1.1, 3.3, 2.6 + math.cos(math.radians(ang)) * 0.8)
    peca(o, VERDE)

# AS RODAS: pneus escuros com o aro claro para fora, as da frente menores (como nos karts)
for x_, y_, r_ in ((2.35, -2.6, 0.72), (-2.35, -2.6, 0.72), (2.45, 1.75, 0.88), (-2.45, 1.75, 0.88)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r_, depth=0.75, location=(x_, y_, r_), vertices=24)
    o = bpy.context.object; o.rotation_euler = (0, math.radians(90), 0)
    peca(o, PNEU)
    s = 1 if x_ > 0 else -1
    bpy.ops.mesh.primitive_cylinder_add(radius=r_ * 0.5, depth=0.1, location=(x_ + s * 0.39, y_, r_), vertices=16)
    o = bpy.context.object; o.rotation_euler = (0, math.radians(90), 0)
    peca(o, ARO, liso=False)

# O VOLANTE, na frente do peito, onde as mãos chegam (o braço do chibi é curto: o volante vem até ele)
bpy.ops.mesh.primitive_torus_add(major_radius=0.85, minor_radius=0.13, location=(0, -2.0, 2.45))
o = bpy.context.object; o.rotation_euler = (math.radians(62), 0, 0)
peca(o, VOLANTE)
bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=1.2, location=(0, -2.35, 1.95), vertices=8)
o = bpy.context.object; o.rotation_euler = (math.radians(-28), 0, 0)
peca(o, VOLANTE)

bpy.ops.object.select_all(action='DESELECT')
for o in pecas_kart:
    o.select_set(True)
bpy.context.view_layer.objects.active = pecas_kart[0]
bpy.ops.object.join()
KART = bpy.context.object
KART.name = 'kart'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
KART.parent = ARM   # gira junto com o esqueleto (ARM.rotation_euler é a direção)


def pose_kart(curva=0.0):
    # sentado no vão da carroceria, inclinado para a frente, as duas mãos no volante; `curva` vira o corpo e a cabeça
    # para o lado da curva (-1 esquerda, 1 direita)
    zerar()
    anda(pbs['raiz'], (0, 0.45, 0.05))
    for lado in ('L', 'R'):
        gira(pbs[f'perna.{lado}'], ((1, 0, 0), -80))
    gira(pbs['tronco'], ((1, 0, 0), 12), ((0, 0, 1), -6 * curva), ((0, 1, 0), 5 * curva))
    gira(pbs['cabeca'], ((1, 0, 0), -4), ((0, 0, 1), -10 * curva))
    braco('L', abre=-30, balanco=-62)
    braco('R', abre=-30, balanco=-62)
    for lado, s in (('L', 1), ('R', -1)):
        # as orelhas para trás, com o vento
        gira(pbs[f'orelha.{lado}'], ((1, 0, 0), 22), ((0, 1, 0), s * 6))


def renderizar_kart(caminho):
    r.filepath = caminho
    bpy.ops.render.render(write_still=True)
    MESH.material_slots[0].material = MAT_DIST
    guard = [s.material for s in KART.material_slots]
    for s in KART.material_slots:
        s.material = MAT_DIST
    cena.view_settings.view_transform = 'Raw'
    r.image_settings.color_depth = '16'
    r.filepath = caminho.replace('.png', '-z.png')
    bpy.ops.render.render(write_still=True)
    cena.view_settings.view_transform = 'Standard'
    r.image_settings.color_depth = '8'
    MESH.material_slots[0].material = MAT_COR
    for s, m in zip(KART.material_slots, guard):
        s.material = m


# A câmera da corrida: um pouco mais alta que a do coelho em pé (atrás e acima do kart), e um quadro maior, porque o
# kart é mais largo que o coelho.
ELEV_K = math.radians(24)
cam_d.ortho_scale = 13.0
u_k = 13.0 / 120
cima_k = Vector((0, math.sin(ELEV_K), math.cos(ELEV_K)))
frente_k = Vector((0, math.cos(ELEV_K), -math.sin(ELEV_K)))
cam.location = cima_k * ((96 - 60) * u_k) - frente_k * 40
cam.rotation_euler = (math.pi / 2 - ELEV_K, 0, 0)
r.resolution_x = r.resolution_y = 480

SO_K = os.environ.get('SO_K')   # SO_K=0,6,12 para conferir só alguns
for n in range(24):
    if SO_K and str(n) not in SO_K.split(','):
        continue
    # n = 0: de costas (o kart olha para longe da câmera, +Y). O coelho olha -Y no giro 0, então soma 180°. Positivo
    # gira no sentido anti-horário visto de cima: n = 6 (giro 90°) põe a frente do kart em +X, a direita da tela.
    ARM.rotation_euler = (0, 0, math.radians(180 - n * 15))
    pose_kart(0.0)
    bpy.context.view_layer.update()
    renderizar_kart(os.path.join(KART_SAIDA, f'{n}.png'))
    print('ok kart', n)
ANIMACOES = {}
