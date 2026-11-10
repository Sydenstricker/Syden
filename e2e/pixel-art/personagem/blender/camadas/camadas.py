# O PILOTO DAS CAMADAS EM 3D (09/11/2026): poucos corpos base + acessórios avulsos presos ao osso.
# Monta a cena do mascote.py (a malha em T, o NOSSO esqueleto, os pesos, a câmera e o render em pixel art) sem mexer nele:
# lê o código dele, troca a pasta de saída e põe um gancho antes do render, onde entra o cena.py deste piloto.
# Rodar: powershell -File rodar.ps1   (depois: py -3 pos.py)
import os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
MESHY = os.path.normpath(os.path.join(AQUI, '..', 'meshy'))
for k in ('POSES', 'GLB', 'KART', 'BRIGA', 'VISTAS'):
    os.environ.pop(k, None)
# MALHA=novo: o corpo NOVO do mascote (meshy/corpo-mascote.glb, 09/11/2026: as orelhas afastadas, para o boné ficar
# entre elas como no 2D), com as medidas dele em MEDIDA_NOVO; sai em saida-novo/. Sem nada: a malha em T, em saida/.
MALHA = os.environ.get('MALHA', 't')
os.environ['MODELO'] = MALHA
CAMADAS_SAIDA = os.path.join(AQUI, 'saida' if MALHA == 't' else f'saida-{MALHA}')
os.makedirs(CAMADAS_SAIDA, exist_ok=True)

fonte = open(os.path.join(MESHY, 'mascote.py'), encoding='utf-8').read()
# AS MEDIDAS DO CORPO NOVO (09/11/2026), na altura 8,4, fatiando a malha como na em T: veio em T (braços na horizontal,
# z 2,7–3,65, do ombro ±1,5 à mão ±3,3), pés no chão de x ±0,5 a ±1,05, a barra do moletom em ~1,25, a cabeça de ~3,8 a
# 6,35 (±1,38 de largura), e as orelhas nascendo dos lados do alto (x de 0,65 a 1,8, com 1,3 de vão entre elas) e
# inclinadas para trás (a ponta em y ~0,95). O resto (a vassoura) é o da malha em T.
MEDIDA_NOVO = '''
    'novo': dict(pescoco=3.8, cintura=1.6, ombro=(1.5, 0.0, 3.17), cotovelo=(2.4, 0.0, 3.17), mao=(3.3, 0.05, 3.17),
                 orelha_base=((1.05, 0.2, 6.25), (-1.05, 0.2, 6.25)), orelha_ponta=((1.5, 0.95, 8.35), (-1.5, 0.95, 8.35)),
                 corte_orelha=(6.25, 6.55), corte_braco=(1.6, 2.5, 3.9), corte_perna=1.2, perna=(0.78, 1.2), baixar=76,
                 pegada=(0.15, -1.95, 3.0), pe_vassoura=(-0.45, -2.45, 0.0), duas_maos=True),
'''
TROCAS = [
    ("}[VARIANTE]", MEDIDA_NOVO + "}[VARIANTE]"),
    ("f'mascote-{VARIANTE}.glb' if VARIANTE else 'mascote.glb'))",
     "f'mascote-{VARIANTE}.glb' if VARIANTE else 'mascote.glb'))\n"
     "if VARIANTE == 'novo':\n    MODELO = os.path.join(CAMADAS_AQUI, 'meshy', 'corpo-mascote.glb')"),
    ("SAIDA = os.path.join(AQUI, VARIANTE, 'saida') if VARIANTE else os.path.join(AQUI, 'saida')", "SAIDA = CAMADAS_SAIDA"),
    ("    if os.environ.get('KART'):",
     "    exec(open(os.path.join(CAMADAS_AQUI, 'cena.py'), encoding='utf-8').read())\n    ANIMACOES = {}\n    if os.environ.get('KART'):"),
    ("bpy.ops.wm.save_as_mainfile(filepath=os.path.join(AQUI, VARIANTE, 'mascote.blend'))",
     "bpy.ops.wm.save_as_mainfile(filepath=os.path.join(CAMADAS_SAIDA, 'camadas.blend'))"),
]
for a, b in TROCAS:
    if fonte.count(a) != 1:
        open(os.path.join(CAMADAS_SAIDA, 'log.txt'), 'w').write(f'o mascote.py mudou: não achei {a!r}\n')
        open(os.path.join(CAMADAS_SAIDA, 'pronto.txt'), 'w').write('erro')
        raise SystemExit
    fonte = fonte.replace(a, b)
g = {'__file__': os.path.join(MESHY, 'mascote.py'), '__name__': '__main__', 'CAMADAS_SAIDA': CAMADAS_SAIDA,
     'CAMADAS_AQUI': AQUI, 'MALHA': MALHA}
exec(compile(fonte, os.path.join(MESHY, 'mascote.py'), 'exec'), g)
