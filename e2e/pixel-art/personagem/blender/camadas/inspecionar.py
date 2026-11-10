# Abre um GLB do Meshy no Blender e conta como veio (rodar pelo rodar-inspecao.ps1). Saída em saida/inspecao.txt.
import bpy, os, sys
from mathutils import Vector
AQUI = os.path.dirname(os.path.abspath(__file__))
out = open(os.path.join(AQUI, 'saida', 'inspecao.txt'), 'w', encoding='utf-8')
for nome in ('corpo-mascote.glb', 'bone.glb'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(AQUI, 'meshy', nome))
    out.write(f'== {nome}\n')
    for o in bpy.context.scene.objects:
        out.write(f'  objeto {o.name} {o.type} pai={o.parent.name if o.parent else None}\n')
        if o.type == 'MESH':
            vs = [o.matrix_world @ v.co for v in o.data.vertices]
            lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
            hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
            out.write(f'    vertices {len(vs)} faces {len(o.data.polygons)} min {tuple(round(x,3) for x in lo)} max {tuple(round(x,3) for x in hi)}\n')
            out.write(f'    grupos {len(o.vertex_groups)} modificadores {[m.type for m in o.modifiers]} materiais {[m.name for m in o.data.materials]}\n')
            # largura por altura, para ver a pose dos braços e as orelhas
            h = hi.z - lo.z
            for k in range(0, 21):
                z = lo.z + h * k / 20
                fat = [v for v in vs if abs(v.z - z) < h / 40]
                if fat:
                    out.write(f'      z {k/20:.2f} x {min(v.x for v in fat):.3f}..{max(v.x for v in fat):.3f} y {min(v.y for v in fat):.3f}..{max(v.y for v in fat):.3f} n {len(fat)}\n')
        if o.type == 'ARMATURE':
            out.write(f'    ossos {len(o.data.bones)}\n')
    for im in bpy.data.images:
        out.write(f'  imagem {im.name} {tuple(im.size)}\n')
    out.write(f'  acoes {[a.name for a in bpy.data.actions]}\n')
out.close()
open(os.path.join(AQUI, 'saida', 'inspecao.pronto'), 'w').write('ok')
