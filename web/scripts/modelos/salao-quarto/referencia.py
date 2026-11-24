# A foto de referência: os modelos dos pacotes que ficam em volta dos nossos (o estilo a copiar). Só para conferir.
import bpy, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comum as c
from mathutils import Vector

c.limpa()
pub = c.PUBLICO
lista = [
    ("salao3d/kenney/kitchenBar.glb", 2.0),
    ("quarto3d/couch_pillows.gltf", 0.75),
    ("quarto3d/kenney/bookcaseClosedDoors.glb", 2.0),
    ("quarto3d/tinytreats/closet_blue.gltf", 0.75),
    ("quarto3d/tinytreats/nightstand_blue.gltf", 0.75),
    ("salao3d/kenney/speaker.glb", 2.0),
]
x = 0
for arq, esc in lista:
    antes = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(pub, arq))
    novos = [o for o in bpy.context.scene.objects if o not in antes and o.parent is None]
    for o in novos:
        o.scale = (esc, esc, esc)
        o.location.x = x
    x += 2.2
c.previa("referencia-pacotes")
c.pronto()
