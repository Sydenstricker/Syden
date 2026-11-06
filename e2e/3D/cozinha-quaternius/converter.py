# Converte os OBJ do pacote de comida da Quaternius (CC0, e2e/3D/Assets/as/) em GLB para a Cozinha da toca
# (web/public/cozinha/quaternius/). Só os usados. Roda no Blender: powershell -File converter.ps1
import bpy, os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..', '..'))
ORIGEM = os.path.join(RAIZ, 'e2e', '3D', 'Assets', 'as', 'OBJ-20261106T173241Z-1-001', 'OBJ')
DESTINO = os.path.join(RAIZ, 'web', 'public', 'cozinha', 'quaternius')
USADOS = ['Bacon_Uncooked', 'Bacon_Cooked', 'Bacon_Burned', 'Steak', 'Steak_burned', 'Egg_Fried', 'Egg_Burned']
os.makedirs(DESTINO, exist_ok=True)
log = open(os.path.join(AQUI, 'log.txt'), 'w')
for nome in USADOS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(filepath=os.path.join(ORIGEM, nome + '.obj'))
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    # foscos como os da KayKit (o MTL vem com brilho de plástico)
    for o in objs:
        for m in o.data.materials:
            if m and m.use_nodes:
                p = m.node_tree.nodes.get('Principled BSDF')
                if p:
                    p.inputs['Roughness'].default_value = 0.85
                    p.inputs['Metallic'].default_value = 0.0
    bpy.ops.export_scene.gltf(filepath=os.path.join(DESTINO, nome + '.glb'), export_format='GLB', use_selection=False, export_apply=True)
    log.write(f'{nome}: {len(objs)} malhas\n')
open(os.path.join(AQUI, 'pronto.txt'), 'w').write('ok')
log.close()
