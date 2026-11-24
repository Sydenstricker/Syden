# As PEÇAS QUE O TOY CAR KIT NÃO TEM, para os Carrinhos da toca (24/11/2026): o CRUZAMENTO (X, as faixas trocam de lado) e a
# AGULHA (T, o carro pode passar à outra faixa da fileira). Partem da reta larga do próprio kit (track-road-wide-straight.glb,
# Kenney, CC0), para casar com as outras peças em tudo (a textura, a zebra, os encaixes):
#  - cruzamento.glb: a reta SEM a zebra do lado de dentro (o lado +x da peça, que encosta na outra fileira) e com as faixas
#    pintadas em creme, da faixa de cada lado até o meio da peça e de volta (o "<" que, com a peça vizinha girada, faz o X).
#    A cena gira a peça da fileira −1 meia volta em torno do meio dela.
#  - agulha.glb: a reta inteira, com os dois desvios amarelos tracejados de uma faixa à outra.
# A peça fica como a do kit: o nó 1 abaixo do chão, a entrada em (0, 0) olhando +z (o −y do Blender), 2 de largura e 4 de
# comprimento; as faixas da fileira em x = ±0,5. A física dos carrinhos não muda: é só o desenho.
#   rodar.ps1 carrinhos.py
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector
from comum import cor_branca, argumentos, pronto, limpar, mat, caixa, importar, juntar, exportar, previa, triangulos, REPO, FOTOS

saida, log, _ = argumentos()
PUBLICO = os.path.join(REPO, "web", "public", "carrinhos")
RETA = os.path.join(PUBLICO, "track-road-wide-straight.glb")
os.makedirs(FOTOS, exist_ok=True)
ASFALTO_UV = (0.219, 0.025)
TOPO = 0.1  # o tampo da pista, no espaço do nó


def reta():
    obs = [o for o in importar(RETA) if o.type == "MESH"]
    return obs[0]


def faixa(nome, a, b, largura, material, altura=0.008):
    """Um risco no tampo, de a a b (x, z do three.js: z para a frente = −y do Blender), no espaço do mundo (o nó está em −1)."""
    ax, az = a
    bx, bz = b
    meio = ((ax + bx) / 2, -(az + bz) / 2, -1 + TOPO + altura / 2 + 0.002)
    comp = math.hypot(bx - ax, bz - az)
    giro = math.atan2(-(bz - az), bx - ax)
    return caixa(nome, (comp, largura, altura), meio, material, bevel=0.0015, giro=(0, 0, giro))


def abrir_o_lado_de_dentro(ob):
    """Tira a zebra do lado +x e pinta de asfalto a linha clara desse lado; tampa o chão onde a zebra estava."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.active
    fora = []
    for f in bm.faces:
        xs = [v.co.x for v in f.verts]
        zs = [v.co.z for v in f.verts]
        if min(xs) >= 0.9 - 1e-4 and max(zs) > TOPO + 1e-4:
            fora.append(f)
        elif min(xs) >= 0.7 - 1e-4 and max(zs) <= TOPO + 1e-4 and min(zs) >= TOPO - 1e-4:
            for l in f.loops:
                l[uv].uv = ASFALTO_UV
    bmesh.ops.delete(bm, geom=fora, context="FACES")
    # o chão de 0,9 a 1,0 (onde a zebra assentava) e a beirada de x = 1 (de 0 ao tampo)
    y0, y1 = -4.0, 0.0  # o comprimento da reta, sem os encaixes das pontas

    def quad(pts, n_uv):
        vs = [bm.verts.new(p) for p in pts]
        f = bm.faces.new(vs)
        for l in f.loops:
            l[uv].uv = n_uv
        f.smooth = False
        return f
    quad([(0.9, y1, TOPO), (0.9, y0, TOPO), (1.0, y0, TOPO), (1.0, y1, TOPO)], ASFALTO_UV)
    quad([(1.0, y1, 0.0), (1.0, y1, TOPO), (1.0, y0, TOPO), (1.0, y0, 0.0)], (0.344, 0.092))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()


def cruzamento():
    limpar()
    ob = reta()
    abrir_o_lado_de_dentro(ob)
    creme = mat("risco", "#f3ead2", rug=1.0)
    riscos = []
    # cada faixa da fileira vai até a beirada de dentro no meio da peça; as da outra fileira entram por ali e chegam ao fim
    for i, (a, b) in enumerate([((-0.5, 0), (1, 2)), ((0.5, 0), (1, 2)), ((1, 2), (-0.5, 4)), ((1, 2), (0.5, 4))]):
        riscos.append(faixa(f"risco{i}", a, b, 0.09, creme))
    final = juntar("cruzamento", [ob] + riscos)
    cor_branca(final)
    n = triangulos([final])
    exportar(os.path.join(PUBLICO, "cruzamento.glb"), cores=False)
    previa(os.path.join(FOTOS, "carrinhos-cruzamento.png"), alvo=(0, -2, -0.9), distancia=4.6, altura=1.1)
    log.write(f"cruzamento: {n} triângulos\n")


def agulha():
    limpar()
    ob = reta()
    amarelo = mat("desvio", "#ffd36b", rug=1.0)
    riscos = []
    for f, (a, b) in enumerate([((-0.5, 0), (0.5, 4)), ((0.5, 0), (-0.5, 4))]):
        for k in range(4):
            k0, k1 = (k + 0.15) / 4, (k + 0.6) / 4
            p0 = (a[0] + (b[0] - a[0]) * k0, a[1] + (b[1] - a[1]) * k0)
            p1 = (a[0] + (b[0] - a[0]) * k1, a[1] + (b[1] - a[1]) * k1)
            riscos.append(faixa(f"desvio{f}{k}", p0, p1, 0.08, amarelo, altura=0.008 + f * 0.002))
    final = juntar("agulha", [ob] + riscos)
    cor_branca(final)
    n = triangulos([final])
    exportar(os.path.join(PUBLICO, "agulha.glb"), cores=False)
    previa(os.path.join(FOTOS, "carrinhos-agulha.png"), alvo=(0, -2, -0.9), distancia=4.6, altura=1.1)
    log.write(f"agulha: {n} triângulos\n")


cruzamento()
agulha()
pronto(saida, log)
