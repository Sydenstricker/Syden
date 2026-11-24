# Abre GLB/glTF de referência (os pacotes vizinhos), escreve o tamanho, os materiais e as cores no log e faz uma prévia de cada.
# Uso: rodar.ps1 inspecionar.py <saida> <arquivo1> <arquivo2> ...
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from comum import argumentos, pronto, limpar, importar, caixa_de, previa, triangulos

saida, log, arquivos = argumentos()
for arq in arquivos:
    limpar()
    obs = importar(arq)
    mn, mx = caixa_de(obs)
    nome = os.path.splitext(os.path.basename(arq))[0]
    log.write(f"{nome}: min {tuple(round(v, 3) for v in mn)} max {tuple(round(v, 3) for v in mx)} tris {triangulos(obs)}\n")
    for o in obs:
        if o.type == "MESH":
            for m in o.data.materials:
                if m and m.use_nodes:
                    b = m.node_tree.nodes.get("Principled BSDF")
                    tex = [n.image.name for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image]
                    c = tuple(round(x, 3) for x in b.inputs["Base Color"].default_value) if b else None
                    log.write(f"   {o.name} mat {m.name} cor {c} tex {tex} rug {b.inputs['Roughness'].default_value if b else None}\n")
            log.write(f"   {o.name} cores_vert {[a.name for a in o.data.color_attributes]}\n")
    meio = (mn + mx) / 2
    tam = max(mx - mn)
    previa(os.path.join(saida, nome + ".png"), alvo=meio, distancia=tam * 1.4, res=384)
    log.flush()
pronto(saida, log)
