# O GLB DE TESTE DAS CAMADAS (rodado no fim do cena.py): o corpo, o esqueleto e os acessórios como NÓS SEPARADOS, para
# o three.js ligar e desligar cada um (ver.html). NÃO é o coelho do site: sai em saida/coelho-camadas.glb, e o
# web/public/cidades3d/coelho-animado.glb fica como está.
#
# Nós: "mascote" (a malha), "acessorio-bone-<corpo>" (filho do osso da cabeça) e "acessorio-bandana-<corpo>" (malha com
# pele, no mesmo esqueleto). Animações: parado e andando do mascote, e parado-orelha-caida e andando-orelha-caida (a mesma
# malha com as orelhas dobradas: o corpo é a animação, não outra malha). Cada corpo tem o boné medido nele.

DESTINO_GLB = os.path.join(SAIDA_C, 'coelho-camadas.glb')

# 1) a cor de volta ao normal (a textura do Meshy num material comum), como no glb.py
nt_ = MAT_COR.node_tree
tex_ = next(n for n in nt_.nodes if n.type == 'TEX_IMAGE')
tex_.interpolation = 'Linear'
for n in list(nt_.nodes):
    if n != tex_:
        nt_.nodes.remove(n)
bsdf_ = nt_.nodes.new('ShaderNodeBsdfPrincipled')
bsdf_.inputs['Roughness'].default_value = 0.8
saida_ = nt_.nodes.new('ShaderNodeOutputMaterial')
nt_.links.new(tex_.outputs['Color'], bsdf_.inputs['Base Color'])
nt_.links.new(bsdf_.outputs['BSDF'], saida_.inputs['Surface'])
MESH.material_slots[0].material = MAT_COR
# todas as texturas a 1024 (o corpo novo e o boné do Meshy vêm com 4096: o GLB passava de 12 MB)
for im_ in bpy.data.images:
    if im_.size[0] > 1024:
        im_.scale(1024, 1024)
usar(True)

# 2) só o coelho e os acessórios
fica = {MESH, ARM, *ACES.values()}
for o in list(cena.objects):
    if o not in fica:
        bpy.data.objects.remove(o)
for ob in ACES.values():
    ob.hide_render = False
    ob.hide_viewport = False
ik(0)
for pb in pbs:
    for c in list(pb.constraints):
        pb.constraints.remove(c)
ARM.rotation_euler = (0, 0, 0)

# 3) as animações, por corpo
QUADRO = 2
cena.render.fps = 24
ARM.animation_data_create()
feitas = []
for corpo, chapeu in [(c, h) for c in CORPOS for h in (False, True)]:
    CORPO = corpo
    CHAPEU = chapeu
    if chapeu and not any(AJUSTE_OREL.get(corpo, (0, 0, 0))):
        continue
    for nome_, (n_, f_) in ANIM.items():
        nome_acao = (nome_ if corpo == CORPOS[0] else f'{nome_}-{corpo}') + ('-bone' if chapeu else '')
        acao = bpy.data.actions.new(nome_acao)
        acao.use_fake_user = True
        ARM.animation_data.action = acao
        for k, i in enumerate(list(range(n_)) + [0]):
            f_(i, n_)
            for pb in pbs:
                pb.keyframe_insert('location', frame=k * QUADRO)
                pb.keyframe_insert('rotation_quaternion', frame=k * QUADRO)
                pb.keyframe_insert('scale', frame=k * QUADRO)
        ARM.animation_data.action = None
        feitas.append((nome_acao, acao))
for nome_, acao in feitas:
    tr = ARM.animation_data.nla_tracks.new()
    tr.name = nome_
    tr.strips.new(nome_, 0, acao)
CORPO = CORPOS[0]
CHAPEU = False
zerar()
bpy.context.view_layer.update()

bpy.ops.export_scene.gltf(
    filepath=DESTINO_GLB, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_step=1,
    export_skins=True, export_morph=False, export_cameras=False, export_lights=False, use_selection=False,
)
print('GLB', DESTINO_GLB, os.path.getsize(DESTINO_GLB))
