# Escreve no log as faces de um modelo (o meio, a normal, a uv do meio e a faixa de x, y e z dos vértices), para achar as
# partes de uma peça de pacote.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from comum import argumentos, pronto, limpar, importar

saida, log, arquivos = argumentos()
for arq in arquivos:
    limpar()
    obs = importar(arq)
    for o in obs:
        if o.type != "MESH":
            continue
        me = o.data
        uv = me.uv_layers.active.data if me.uv_layers.active else None
        log.write(f"== {o.name} verts {len(me.vertices)} faces {len(me.polygons)} mw {[tuple(round(x,3) for x in r) for r in o.matrix_world]}\n")
        for p in me.polygons:
            c = p.center
            vs = [me.vertices[i].co for i in p.vertices]
            f = lambda k: f"{min(v[k] for v in vs):.3f}..{max(v[k] for v in vs):.3f}"
            u = None
            if uv:
                us = [uv[i].uv for i in p.loop_indices]
                u = (round(sum(x[0] for x in us) / len(us), 3), round(sum(x[1] for x in us) / len(us), 3))
            log.write(f"{p.index} c=({c.x:.3f},{c.y:.3f},{c.z:.3f}) n=({p.normal.x:.2f},{p.normal.y:.2f},{p.normal.z:.2f}) uv={u} x={f(0)} y={f(1)} z={f(2)}\n")
pronto(saida, log)
