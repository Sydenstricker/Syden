# O coelho do tabuleiro 3D do Cidades à venda (05/11/2026): a malha do mascote do Meshy (e2e/3D/Personagens/mascote.glb,
# braços para baixo), leve para o navegador: só a textura de cor, em 1024, sem a de relevo e a de metal (o visual é de
# desenho, e o metal 1 do Meshy escurecia tudo). Uso: blender -b -P web/scripts/cidades3d-coelho.py
import bpy, os
aqui = os.path.dirname(os.path.abspath(__file__))
raiz = os.path.normpath(os.path.join(aqui, '..', '..'))
entrada = os.path.join(raiz, 'e2e', '3D', 'Personagens', 'mascote.glb')
saida = os.path.join(raiz, 'web', 'public', 'cidades3d', 'coelho.glb')
os.makedirs(os.path.dirname(saida), exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=entrada)
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, 1024)
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    nos = mat.node_tree.nodes
    bsdf = next((n for n in nos if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf:
        continue
    for nome in ('Metallic', 'Roughness', 'Normal'):
        for l in list(bsdf.inputs[nome].links):
            mat.node_tree.links.remove(l)
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.8
    for n in list(nos):
        if n.type in ('NORMAL_MAP', 'SEPARATE_COLOR', 'SEPARATE_RGB'):
            nos.remove(n)
    for n in list(nos):
        if n.type == 'TEX_IMAGE' and not n.outputs['Color'].links:
            nos.remove(n)
bpy.ops.export_scene.gltf(filepath=saida, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85,
                          export_normals=True, export_texcoords=True, export_materials='EXPORT', use_selection=False)
with open(saida + '.pronto', 'w') as f:
    f.write('ok')
