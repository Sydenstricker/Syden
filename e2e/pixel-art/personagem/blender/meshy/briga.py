# O COELHO DA BRIGA NA HORTA (03/11/2026): o mascote 3D nas poses de um jogo de briga de rua de lado (andar, socos,
# pulo, voadora, apanhar, cair, levantar e o especial que gira). Só a MECÂNICA dos fliperamas do começo dos anos 90:
# nenhuma pose, personagem ou desenho de ninguém. Carregado pelo mascote.py com BRIGA=1 no ambiente (o esqueleto, os
# materiais e a câmera são os dele). Rodar: MODELO=t e BRIGA=1 no ambiente e `powershell -File rodar.ps1` (~1 min); depois
# `python briga-pos.py`.
#
# Uma direção só, de três quartos virado para a DIREITA da tela; o jogo espelha para a esquerda. Ritmo "em dois" (12
# desenhos por segundo), com poucos desenhos por animação, como os jogos da época.
#
# Sai em t/saida/briga/<animação>-<n>.png (e -z.png, o passe de distância).

BRIGA_SAIDA = os.path.join(SAIDA, 'briga')
os.makedirs(BRIGA_SAIDA, exist_ok=True)
VASS.hide_render = True
ik(0)

# virado para a direita da tela (+X), um pouco para a câmera, para o rosto aparecer
FRENTE_GRAUS = 64


def virar(extra=0.0, deitado=0.0, dx=0.0, dz=0.0):
    # `deitado`: tomba para TRÁS em volta do eixo de quem olha (a cabeça vai para a esquerda da tela), em graus;
    # dx/dz levam o corpo (em unidades do modelo) para o meio do quadro
    rz = Matrix.Rotation(math.radians(FRENTE_GRAUS + extra), 4, 'Z')
    ry = Matrix.Rotation(math.radians(-deitado), 4, 'Y')
    ARM.matrix_world = Matrix.Translation((dx, 0, dz)) @ ry @ rz


def soco(lado, estende, recua=0.0):
    # o braço que bate vai para a frente na altura do ombro (balanço -90 = para a frente); o outro recolhe
    s = 1 if lado == 'L' else -1
    braco(lado, abre=-14 * estende, balanco=-100 * estende)
    outro = 'R' if lado == 'L' else 'L'
    braco(outro, abre=-10, balanco=-40 - 20 * recua)


def p_parado(i, n):
    p = 2 * math.pi * i / n
    zerar()
    # a guarda: as mãos na frente do peito, o corpo um pouco baixo, respirando
    anda(pbs['quadril'], (0, 0, -0.08 - 0.05 * (1 - math.cos(p))))
    gira(pbs['tronco'], ((1, 0, 0), 8 + 2 * math.sin(p)))
    gira(pbs['cabeca'], ((1, 0, 0), -6 + 2 * math.sin(p - 0.5)))
    braco('L', abre=-20, balanco=-55 - 4 * math.sin(p))
    braco('R', abre=-14, balanco=-48 - 4 * math.sin(p - 0.4))
    for lado, s in (('L', 1), ('R', -1)):
        gira(pbs[f'perna.{lado}'], ((1, 0, 0), s * 10))
    orelhas(p - 0.8, 1.0)


def p_andando(i, n):
    pose_andando(i, n)
    # com a guarda meio levantada
    p = 2 * math.pi * i / n
    braco('L', abre=-16, balanco=-45 - 10 * math.sin(p))
    braco('R', abre=-12, balanco=-40 + 10 * math.sin(p))


def p_soco1(i, n):
    zerar()
    # o jab, com o braço de trás da tela (L): recolhe e solta
    e = (0.25, 1.0)[i]
    gira(pbs['tronco'], ((0, 0, 1), -14 * e), ((1, 0, 0), 10))
    anda(pbs['quadril'], (0, -0.15 * e, -0.1))
    soco('L', e)
    gira(pbs['cabeca'], ((1, 0, 0), -6))
    for lado, s in (('L', 1), ('R', -1)):
        gira(pbs[f'perna.{lado}'], ((1, 0, 0), s * 14))
    orelhas(1.0 + i, 0.8)


def p_soco2(i, n):
    zerar()
    # o direto, com o braço da frente da tela (R)
    e = (0.25, 1.0)[i]
    gira(pbs['tronco'], ((0, 0, 1), 16 * e), ((1, 0, 0), 12))
    anda(pbs['quadril'], (0, -0.2 * e, -0.1))
    soco('R', e)
    gira(pbs['cabeca'], ((1, 0, 0), -6))
    for lado, s in (('L', 1), ('R', -1)):
        gira(pbs[f'perna.{lado}'], ((1, 0, 0), s * 16))
    orelhas(2.0 + i, 0.8)


def p_soco3(i, n):
    zerar()
    # o terceiro, de baixo para cima com as duas mãos: agacha, sobe, e fica um tempo no alto
    agacha, sobe = ((1.0, 0.0), (0.2, 1.0), (0.0, 0.85))[i]
    anda(pbs['quadril'], (0, -0.35 * sobe, -0.45 * agacha + 0.25 * sobe))
    gira(pbs['tronco'], ((1, 0, 0), 22 * agacha - 12 * sobe))
    gira(pbs['cabeca'], ((1, 0, 0), -10 * sobe))
    for lado in ('L', 'R'):
        braco(lado, abre=-20 * agacha - 12 * sobe, balanco=-30 * agacha - 150 * sobe)
    for lado, s in (('L', 1), ('R', -1)):
        gira(pbs[f'perna.{lado}'], ((1, 0, 0), s * (20 * agacha + 10)))
    orelhas(3.0 + 2 * i, 1.6)


def p_pulo(i, n):
    zerar()
    # subindo (as pernas encolhidas, os braços para cima) e descendo (as pernas soltas, os braços abertos)
    if i == 0:
        for lado in ('L', 'R'):
            gira(pbs[f'perna.{lado}'], ((1, 0, 0), -55))
            braco(lado, abre=-30, balanco=-120)
        gira(pbs['tronco'], ((1, 0, 0), 10))
        anda(pbs['raiz'], (0, 0, 0.5))
    else:
        for lado, s in (('L', 1), ('R', -1)):
            gira(pbs[f'perna.{lado}'], ((1, 0, 0), -15 + s * 12))
            braco(lado, abre=-55, balanco=-20)
        gira(pbs['tronco'], ((1, 0, 0), -4))
    orelhas(1.5 + i * 2, 1.8)


def p_voadora(i, n):
    zerar()
    # a voadora: o corpo deitado para trás, a perna da frente esticada para a frente, a outra dobrada
    gira(pbs['tronco'], ((1, 0, 0), -18))
    gira(pbs['cabeca'], ((1, 0, 0), 8))
    gira(pbs['perna.R'], ((1, 0, 0), -95))
    pbs['perna.R'].scale = (1, 1.5, 1)
    gira(pbs['perna.L'], ((1, 0, 0), -30))
    braco('L', abre=-50, balanco=10)
    braco('R', abre=-45, balanco=30)
    anda(pbs['raiz'], (0, 0, 0.5))
    orelhas(2.5, 2.0)


def p_dor(i, n):
    zerar()
    # apanhou: o corpo vai para trás, a cabeça junto, os braços soltos
    k = (1.0, 0.6)[i]
    gira(pbs['tronco'], ((1, 0, 0), -20 * k))
    gira(pbs['cabeca'], ((1, 0, 0), 16 * k), ((0, 1, 0), 6 * k))
    anda(pbs['quadril'], (0, 0.25 * k, -0.1))
    braco('L', abre=-35 * k, balanco=25 * k)
    braco('R', abre=-40 * k, balanco=35 * k)
    for lado, s in (('L', 1), ('R', -1)):
        gira(pbs[f'perna.{lado}'], ((1, 0, 0), s * 12 * k))
    orelhas(4.0 + i, 2.0)


def p_caido(i, n):
    zerar()
    # caindo (tombado 50°) e no chão (de costas, os braços abertos)
    braco('L', abre=-40, balanco=40)
    braco('R', abre=-50, balanco=50)
    for lado, s in (('L', 1), ('R', -1)):
        gira(pbs[f'perna.{lado}'], ((1, 0, 0), -20 + s * 10))
    gira(pbs['cabeca'], ((1, 0, 0), 10))
    orelhas(0.5, 0.6)


def p_levantando(i, n):
    zerar()
    # sentado no chão, depois de joelhos se erguendo
    if i == 0:
        for lado, s_ in (('L', 1), ('R', -1)):
            gira(pbs[f'perna.{lado}'], ((1, 0, 0), -80), ((0, 1, 0), s_ * 20))
            pbs[f'perna.{lado}'].scale = (1, 1.3, 1)
        anda(pbs['raiz'], (0, 0.2, -1.0))
        gira(pbs['tronco'], ((1, 0, 0), 10))
        braco('L', abre=-5, balanco=20)
        braco('R', abre=-5, balanco=20)
    else:
        anda(pbs['quadril'], (0, 0, -0.4))
        gira(pbs['tronco'], ((1, 0, 0), 28))
        gira(pbs['cabeca'], ((1, 0, 0), -14))
        for lado, s in (('L', 1), ('R', -1)):
            gira(pbs[f'perna.{lado}'], ((1, 0, 0), s * 30 - 10))
        braco('L', abre=-10, balanco=-35)
        braco('R', abre=-10, balanco=-35)
    orelhas(1.0 + i, 1.2)


def p_especial(i, n):
    zerar()
    # o especial: os braços abertos na horizontal, girando (o giro é do corpo inteiro, em virar())
    for lado in ('L', 'R'):
        braco(lado, abre=-(M['baixar'] + 2), balanco=0)
    anda(pbs['raiz'], (0, 0, 0.35))
    gira(pbs['cabeca'], ((1, 0, 0), -4))
    for lado, s in (('L', 1), ('R', -1)):
        gira(pbs[f'perna.{lado}'], ((1, 0, 0), s * 8))
    orelhas(i * 1.6, 2.2)


# nome -> (desenhos, pose, como virar cada desenho)
BRIGA = {
    'parado': (4, p_parado, lambda i: virar()),
    'andando': (8, p_andando, lambda i: virar()),
    'soco1': (2, p_soco1, lambda i: virar()),
    'soco2': (2, p_soco2, lambda i: virar()),
    'soco3': (3, p_soco3, lambda i: virar()),
    'pulo': (2, p_pulo, lambda i: virar()),
    'voadora': (1, p_voadora, lambda i: virar(extra=0, deitado=-22)),
    'dor': (2, p_dor, lambda i: virar()),
    # de costas no chão: tomba para trás e vai para o meio do quadro (o corpo deitado tem 8,4 de comprido)
    'caido': (2, p_caido, lambda i: virar(deitado=(55, 90)[i], dx=(1.6, 3.6)[i], dz=(0.9, 1.6)[i])),
    'levantando': (2, p_levantando, lambda i: virar()),
    'especial': (4, p_especial, lambda i: virar(extra=-i * 90)),
}

# a câmera é a do coelho em pé (ELEV 20), com o quadro um pouco maior: os braços e a perna esticados e o corpo deitado
# precisam caber
cam_d.ortho_scale = 13.2
u_b = 13.2 / 120
cima_b = Vector((0, math.sin(ELEV), math.cos(ELEV)))
frente_b = Vector((0, math.cos(ELEV), -math.sin(ELEV)))
# o pé no ponto (60, 100) do quadro de 120
cam.location = cima_b * ((100 - 60) * u_b) - frente_b * 40
cam.rotation_euler = (math.pi / 2 - ELEV, 0, 0)
r.resolution_x = r.resolution_y = 480

SO_B = os.environ.get('SO_B')   # SO_B=soco1,caido para conferir só algumas
for nome, (n, pose, vira) in BRIGA.items():
    if SO_B and nome not in SO_B.split(','):
        continue
    for i in range(n):
        vira(i)
        pose(i, n)
        bpy.context.view_layer.update()
        renderizar(os.path.join(BRIGA_SAIDA, f'{nome}-{i}.png'))
    print('ok briga', nome)
with open(os.path.join(BRIGA_SAIDA, 'animacoes.json'), 'w') as f:
    json.dump({k: v[0] for k, v in BRIGA.items()}, f)
ANIMACOES = {}
