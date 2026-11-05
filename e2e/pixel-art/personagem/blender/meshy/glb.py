# O COELHO PARA O 3D DO SITE (05/11/2026, pedido dele: "baixei o coelho 3D com esqueleto"; o arquivo do Meshy é o mesmo
# mascote-t.glb, com o esqueleto de gente do Mixamo e só Walking e Running). Aqui sai o nosso: a malha em T, o NOSSO
# esqueleto (o do mascote.py) e as poses do motor (as funções do poses.py) gravadas como ANIMAÇÕES de um GLB, para o
# three.js tocar (o tabuleiro do Cidades e o quarto low poly). Carregado pelo mascote.py com MODELO=t GLB=1 no ambiente:
#   $env:MODELO='t'; $env:GLB='1'; powershell -File rodar.ps1
# Sai em web/public/cidades3d/coelho-animado.glb.
#
# As poses que são uma só (poltrona, dormindo...) viram animações de dois quadros iguais, para o site poder ir de uma à
# outra pelo mesmo caminho (crossFade). O ritmo é o do desenho (12 por segundo); o three.js interpola entre os quadros.

DESTINO = os.path.normpath(os.path.join(AQUI, '..', '..', '..', '..', '..', 'web', 'public', 'cidades3d', 'coelho-animado.glb'))

# 1) a cor de volta ao normal: a textura do Meshy num material comum (o de emissão em degraus é só do render em pixel art)
nt = MAT_COR.node_tree
tex_ = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
tex_.interpolation = 'Linear'
for n in list(nt.nodes):
    if n != tex_:
        nt.nodes.remove(n)
bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
bsdf.inputs['Roughness'].default_value = 0.8
bsdf.inputs['Metallic'].default_value = 0.0
saida_ = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(tex_.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(bsdf.outputs['BSDF'], saida_.inputs['Surface'])
if tex_.image and tex_.image.size[0] > 1024:
    tex_.image.scale(1024, 1024)
for img in list(bpy.data.images):
    if img != tex_.image and img.users == 0:
        bpy.data.images.remove(img)

# 2) só o coelho: a vassoura, o livro, a câmera e o material de distância saem
for o in list(cena.objects):
    if o not in (MESH, ARM):
        bpy.data.objects.remove(o)
ik(0)
for pb in pbs:
    for c in list(pb.constraints):
        pb.constraints.remove(c)
ARM.rotation_euler = (0, 0, 0)

# 3) as animações
QUADRO = 2   # a 24 por segundo, um desenho a cada dois (12 por segundo)
cena.render.fps = 24
GRAVAR_GLB = {
    'parado': (16, pose_parado),
    'andando': (8, pose_andando),
    'falando': (8, a_falando),
    'sentado': (16, a_sentado),
    'sentado-sofa': (16, a_sentado_sofa),
    'poltrona': (1, estado(p_poltrona)),
    'banqueta': (1, estado(p_banqueta)),
    'computador': (5, lambda i, n: p_computador(i)),
    'dormindo': (1, estado(p_dormindo)),
    'largado': (1, estado(p_largado)),
    'lendo': (1, estado(p_lendo)),
}
ARM.animation_data_create()
trilhas = ARM.animation_data.nla_tracks
# as trilhas só entram no FIM: empilhadas enquanto se grava, as já gravadas se misturavam à pose da próxima
feitas = []
for nome, (n, f) in GRAVAR_GLB.items():
    acao = bpy.data.actions.new(nome)
    acao.use_fake_user = True
    ARM.animation_data.action = acao
    quadros = list(range(n)) + [0]   # o ciclo fecha no primeiro desenho
    if n == 1:
        quadros = [0, 0]
    for k, i in enumerate(quadros):
        f(i, n)
        fr = k * QUADRO   # do quadro 0: começando no 1, a exportação amostrava o 0, que é o repouso
        for pb in pbs:
            pb.keyframe_insert('location', frame=fr)
            pb.keyframe_insert('rotation_quaternion', frame=fr)
            pb.keyframe_insert('scale', frame=fr)
    ARM.animation_data.action = None
    feitas.append((nome, acao))
    print('animação', nome, n)
for nome, acao in feitas:
    trilha = trilhas.new()
    trilha.name = nome
    trilha.strips.new(nome, 0, acao)
zerar()

bpy.ops.export_scene.gltf(
    filepath=DESTINO,
    export_format='GLB',
    export_image_format='JPEG',
    export_jpeg_quality=85,
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_force_sampling=True,
    export_frame_step=1,
    export_skins=True,
    export_morph=False,
    export_cameras=False,
    export_lights=False,
    use_selection=False,
)
print('GLB', DESTINO, os.path.getsize(DESTINO))
