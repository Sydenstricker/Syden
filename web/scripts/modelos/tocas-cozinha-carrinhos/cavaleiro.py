# O CAVALEIRO MONTADO das Tocas e Torres (24/11/2026): a pose do NOSSO coelho (o esqueleto do mascote.py, o mesmo de
# web/public/cidades3d/coelho-animado.glb) sentado a cavalo, com as pernas abertas dos dois lados da sela, o tronco um pouco
# para a frente e as mãos na rédea; e um trote curto (o corpo quica no ritmo do cavalo). O cavalo é o do Medieval Hexagon
# (horse_{cor}_accent, KayKit, CC0), que o jogo já tira para web/public/tocas/medieval/ (web/scripts/tocas-modelos.mjs).
#
# Sai SÓ a animação, num GLB sem malha (web/public/tocas/coelho-montado.glb): o esqueleto com a ação "montado". O jogo toca a
# ação no coelho de sempre (os ossos têm os mesmos nomes), então a malha, a textura e as cores do time continuam as dele.
# A prévia mostra o coelho no cavalo, com as medidas que a cena usa (escrevem-se no log: a altura da sela, a escala).
#   rodar.ps1 cavaleiro.py
import os, sys, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Quaternion
from comum import argumentos, pronto, limpar, importar, caixa_de, previa, REPO, FOTOS

saida, log, _ = argumentos()
os.makedirs(FOTOS, exist_ok=True)
CAVALO = os.path.join(REPO, "e2e", "3D", "Assets", "KayKit_Medieval_Hexagon_Pack_1.0_EXTRA", "KayKit_Medieval_Hexagon_Pack_1.0_EXTRA",
                      "Assets", "gltf", "units", "blue", "horse_blue_accent.gltf")
DESTINO = os.path.join(REPO, "web", "public", "tocas", "coelho-montado.glb")

# AS MEDIDAS DA CENA (as mesmas em web/src/tocas/cena.ts, MONTADO): a altura do cavalo e a do coelho (de pé, como as outras)
ALTURA_DO_CAVALO = 0.78
ALTURA_DO_COELHO = 0.86

limpar()
obs = importar(os.path.join(REPO, "web", "public", "cidades3d", "coelho-animado.glb"))
ARM = next(o for o in obs if o.type == "ARMATURE")
MALHA = [o for o in obs if o.type == "MESH"]
pbs = ARM.pose.bones
for pb in pbs:
    pb.rotation_mode = "QUATERNION"


def local(pb, eixo):
    return (pb.bone.matrix_local.to_3x3().inverted() @ Vector(eixo)).normalized()


def gira(pb, *rots):
    q = Quaternion()
    for eixo, graus in rots:
        q = q @ Quaternion(local(pb, eixo), math.radians(graus))
    pb.rotation_quaternion = q


def anda(pb, desl):
    pb.location = pb.bone.matrix_local.to_3x3().inverted() @ Vector(desl)


def zerar():
    for pb in pbs:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


BAIXAR = 74 + 18 * 0.3   # a malha em T baixa os braços (mascote.py: M['baixar'] + BRACOS_SOLTOS * 0.3)


def braco(lado, abre=0.0, balanco=0.0):
    s = 1 if lado == "L" else -1
    gira(pbs[f"braco.{lado}"], ((1, 0, 0), balanco), ((0, 1, 0), s * (BAIXAR + abre)))


def pose_montado(i, n):
    # o trote: o corpo sobe e desce duas vezes por ciclo, o tronco balança um tico, as orelhas vêm atrasadas
    p = 2 * math.pi * i / n
    zerar()
    pula = abs(math.sin(p))
    anda(pbs["raiz"], (0, 0.1, -0.9 + 0.22 * pula))
    for lado, s in (("L", 1), ("R", -1)):
        # as pernas abertas, dos dois lados da sela, e um pouco para a frente (o estribo); esticadas como no sentado
        gira(pbs[f"perna.{lado}"], ((1, 0, 0), -28), ((0, 1, 0), s * 52))
        pbs[f"perna.{lado}"].scale = (1, 1.3, 1)
        # as mãos para a frente, na rédea
        braco(lado, abre=-8, balanco=-s * 0 - 58)
    gira(pbs["tronco"], ((1, 0, 0), 8 + 3 * math.sin(p * 2)))
    gira(pbs["cabeca"], ((1, 0, 0), -6 - 2 * math.sin(p * 2 - 0.6)))
    for lado, s in (("L", 1), ("R", -1)):
        gira(pbs[f"orelha.{lado}"], ((1, 0, 0), 6 * math.sin(p * 2 - 1.2)))


# a ação "montado": 8 desenhos a 12 por segundo (o ritmo do desenho, como o glb.py), o ciclo fechando no primeiro
cena = bpy.context.scene
cena.render.fps = 24
ARM.animation_data_create()
acao = bpy.data.actions.new("montado")
ARM.animation_data.action = acao
N = 8
for k, i in enumerate(list(range(N)) + [0]):
    pose_montado(i, N)
    for pb in pbs:
        pb.keyframe_insert("location", frame=k * 2)
        pb.keyframe_insert("rotation_quaternion", frame=k * 2)
        pb.keyframe_insert("scale", frame=k * 2)
cena.frame_start, cena.frame_end = 0, N * 2

# só a ação nova sai: as outras ações do arquivo ficam fora
for a in list(bpy.data.actions):
    if a != acao:
        bpy.data.actions.remove(a)

# a prévia: o coelho de pé mede ALTURA_DO_COELHO; o cavalo, ALTURA_DO_CAVALO; o coelho senta na sela
cena.frame_set(0)
bpy.context.view_layer.update()
cav = [o for o in importar(CAVALO) if o.type == "MESH"]
cmn, cmx = caixa_de(cav)
kc = ALTURA_DO_CAVALO / (cmx.z - cmn.z)
for o in cav:
    o.scale = (kc, kc, kc)
bpy.context.view_layer.update()
# a sela: o mais alto do lombo, no meio do comprimento do cavalo (o raio de cima para baixo)
dg = bpy.context.evaluated_depsgraph_get()
sela = 0.0
for dy in (-0.05, 0.0, 0.05, 0.1):
    ok, loc, *_ = cena.ray_cast(dg, Vector((0, dy, 5)), Vector((0, 0, -1)))
    if ok:
        sela = max(sela, loc.z)
# o coelho: a escala pela altura de pé (a mesma conta da cena: a caixa do clone em repouso, com tudo o que vem nele)
ARM.animation_data.action = None
zerar()
bpy.context.view_layer.update()
mn, mx = caixa_de(MALHA)
kk = ALTURA_DO_COELHO / (mx.z - mn.z)
base = -mn.z * kk
ARM.animation_data.action = acao
cena.frame_set(0)
# o assento do coelho (a raiz) vai para a sela; a raiz está no chão do coelho de pé, e a pose a baixa 0,9
ARM.scale = (kk, kk, kk)
ARM.location = (0, 0.02, sela)
bpy.context.view_layer.update()
mn2, mx2 = caixa_de(MALHA)
log.write(json.dumps({"sela": round(sela, 4), "escalaCavalo": round(kc, 4), "escalaCoelho": round(kk, 5), "baseDePe": round(base, 4),
                      "alturaMontado": round(mx2.z, 4), "pesMontado": round(mn2.z, 4)}) + "\n")
previa(os.path.join(FOTOS, "cavaleiro.png"), alvo=(0, 0, 0.6), distancia=1.9, altura=0.55)
previa(os.path.join(FOTOS, "cavaleiro-lado.png"), alvo=(0, 0, 0.6), distancia=1.9, altura=0.25, lado=-1.4)

# a exportação: só o esqueleto e a ação (sem malha, sem cavalo)
for o in list(cena.objects):
    if o != ARM:
        bpy.data.objects.remove(o)
ARM.location = (0, 0, 0)
ARM.scale = (1, 1, 1)
ARM.select_set(True)
bpy.context.view_layer.objects.active = ARM
kw = dict(filepath=DESTINO, export_format="GLB", use_selection=True, export_yup=True, export_animations=True,
          export_frame_range=True, export_force_sampling=True, export_materials="NONE")
try:
    bpy.ops.export_scene.gltf(**kw, export_animation_mode="ACTIONS")
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
log.write(f"exportado {DESTINO}\n")
pronto(saida, log)
