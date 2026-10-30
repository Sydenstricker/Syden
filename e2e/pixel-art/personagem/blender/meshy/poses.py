# AS POSES DO MOTOR (30/10/2026): o conjunto que o quarto e o salão usam (FONTES, em quarto/novo/quarto/montar.mjs), com
# o mascote 3D. Carregado pelo mascote.py com POSES=1 no ambiente (o esqueleto, a câmera e o render são os dele).
# Sai em saida/poses/<pasta>/<direção>-<n>.png, com as MESMAS pastas do mascote do PixelLab (baixa-120/animacoes/parado,
# estados/sentado-2, transicoes/sentar-fluido...), para o motor achar tudo trocando só a raiz. Depois: POSES=1 python pos.py.
#
# O enquadramento é o mesmo em tudo, e o motor se vira com isso: ancora pelo meio da última linha com desenho (de pé, o
# pé; sentado, o assento), deitado pelo meio do corpo, e nas transições pelo centro do corpo.

LIVRO = None


def criar_livro():
    # o livro do "lendo": capa e miolo, preso ao tronco, na frente do peito (deitado, fica acima do rosto)
    global LIVRO
    capa_m = mat_liso('capa', (150, 64, 52))
    miolo_m = mat_liso('miolo', (232, 220, 196))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -2.25, 3.05))
    capa = bpy.context.object; capa.scale = (2.0, 0.12, 1.4); capa.data.materials.append(capa_m)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -2.12, 3.05))
    miolo = bpy.context.object; miolo.scale = (1.85, 0.2, 1.28); miolo.data.materials.append(miolo_m)
    bpy.ops.object.select_all(action='DESELECT')
    capa.select_set(True); miolo.select_set(True)
    bpy.context.view_layer.objects.active = capa
    bpy.ops.object.join()
    LIVRO = bpy.context.object
    LIVRO.name = 'livro'
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mw_ = LIVRO.matrix_world.copy()
    LIVRO.parent = ARM; LIVRO.parent_type = 'BONE'; LIVRO.parent_bone = 'tronco'
    bpy.context.view_layer.update()
    LIVRO.matrix_world = mw_
    LIVRO.hide_render = True


criar_livro()


def deitar_raiz():
    # de costas no chão: o corpo gira 90° para trás em volta dos pés; a cabeça vai para +Y (a cabeceira), o rosto para
    # cima. Depois sobe o que as costas desceram (1,9) e vai para o meio (o motor ancora o deitado pelo meio do corpo); a
    # subida extra só traz o corpo para o meio do quadro.
    gira(pbs['raiz'], ((1, 0, 0), -90))
    anda(pbs['raiz'], (0, -4.2, 1.9 + 3.6))


def sentar_raiz():
    # o assento: o moletom encosta no chão (a barra está a ~0,8)
    anda(pbs['raiz'], (0, 0, -0.85))


def pernas(frente=0.0, abre=0.0, estica=1.0):
    # estica: a perna do chibi é um toco (~1 unidade) e, sentado, some atrás da barriga; o desenho do PixelLab também a
    # desenhava maior sentado. Esticar o osso é a mesma licença, em 3D.
    for lado, s in (('L', 1), ('R', -1)):
        gira(pbs[f'perna.{lado}'], ((1, 0, 0), -frente), ((0, 1, 0), s * abre))
        pbs[f'perna.{lado}'].scale = (1, estica, 1)


def p_sentado():
    # As pernas do chibi são tocos e a barriga é redonda: com as pernas só para a frente, elas somem embaixo da barriga e,
    # visto de frente, ele parece em pé no assento (relato dele, 30/10/2026, no sofá). Então: as pernas um pouco ACIMA da
    # horizontal e abertas (os pés aparecem dos lados da barriga), o tronco recostado e as mãos apoiadas do lado.
    zerar(); pernas(95, 30, 1.4)
    anda(pbs['raiz'], (0, 0.25, -1.05))
    gira(pbs['tronco'], ((1, 0, 0), -14))
    gira(pbs['cabeca'], ((1, 0, 0), 9))
    bracos(abre=-2, balanco=-14)


def a_sentado(i, n):
    # sentado, respirando (relato dele, 30/10/2026: "engessados"): a pose de cima, com o peito subindo e descendo e a
    # cabeça e as orelhas atrasadas, como no parado
    p = 2 * math.pi * i / n
    p_sentado()
    anda(pbs['tronco'], (0, 0, 0.05 * (1 - math.cos(p))))
    gira(pbs['tronco'], ((1, 0, 0), -14 + 1.5 * math.sin(p)))
    gira(pbs['cabeca'], ((1, 0, 0), 9 + 2.5 * math.sin(p - 0.5)), ((0, 1, 0), 2 * math.sin(p * 0.5 + 0.3)))
    orelhas(p - 0.8, 1.0)


def a_sentado_sofa(i, n):
    # no sofá: o mesmo corpo do sentado (o motor usa a âncora dele), com as pernas PENDURADAS por cima da almofada, para a
    # frente e para baixo, onde aparecem inteiras (para a frente só, apontavam para a câmera e sumiam atrás da barriga)
    a_sentado(i, n)
    pernas(78, 30, 1.45)


def p_poltrona():
    # afundado, com os braços nos apoios
    zerar(); sentar_raiz(); pernas(75, 8)
    gira(pbs['tronco'], ((1, 0, 0), -18))
    gira(pbs['cabeca'], ((1, 0, 0), 10))
    bracos(abre=22, balanco=-22)


def p_banqueta():
    # banqueta alta: as pernas penduradas, as mãos no colo
    zerar(); sentar_raiz(); pernas(45, 4)
    gira(pbs['cabeca'], ((1, 0, 0), 3))
    bracos(abre=-10, balanco=-28)


def p_computador(i=0):
    # 0 a pose; 1 e 2 uma mão descendo (um toque); 3 e 4 o pulso no mouse (o roteiro NO_PC do motor)
    zerar(); sentar_raiz(); pernas(80, 6)
    gira(pbs['tronco'], ((1, 0, 0), 10))
    gira(pbs['cabeca'], ((1, 0, 0), 3))
    toque = {1: 4, 2: 8}.get(i, 0)
    mouse = {3: 7, 4: 10}.get(i, 0)
    braco('L', abre=-14, balanco=-(70 - toque))
    braco('R', abre=-14 + mouse, balanco=-(70 - mouse * 0.3))


def p_fliperama():
    zerar()
    gira(pbs['tronco'], ((1, 0, 0), 6))
    gira(pbs['cabeca'], ((1, 0, 0), -2))
    bracos(abre=-12, balanco=-62)


def p_dormindo():
    zerar(); deitar_raiz()
    gira(pbs['tronco'], ((1, 0, 0), 18))   # a cabeça no travesseiro: o tronco um pouco erguido, o rosto à mostra
    gira(pbs['cabeca'], ((0, 0, 1), 14), ((0, 1, 0), 6))
    bracos(abre=-4)
    for lado, s in (('L', 1), ('R', -1)):
        gira(pbs[f'orelha.{lado}'], ((1, 0, 0), -12), ((0, 1, 0), s * 10))


def p_largado():
    zerar(); deitar_raiz(); pernas(0, 22)
    gira(pbs['tronco'], ((1, 0, 0), 14))
    gira(pbs['cabeca'], ((0, 0, 1), 26), ((0, 1, 0), 10))
    bracos(abre=-38)
    for lado, s in (('L', 1), ('R', -1)):
        gira(pbs[f'orelha.{lado}'], ((1, 0, 0), -16), ((0, 1, 0), s * 22))


def p_lendo():
    zerar(); deitar_raiz()
    gira(pbs['tronco'], ((1, 0, 0), 34))   # recostado para ler
    gira(pbs['cabeca'], ((1, 0, 0), 10))
    bracos(abre=-16, balanco=-80)


def p_parado():
    pose_parado(0, 16)


def a_falando(i, n):
    # gesticulando: a mão direita conta a história, a cabeça acompanha
    p = 2 * math.pi * i / n
    zerar()
    gira(pbs['tronco'], ((0, 0, 1), 4 * math.sin(p)), ((1, 0, 0), 1.5 * math.sin(2 * p)))
    gira(pbs['cabeca'], ((1, 0, 0), 4 * math.sin(2 * p + 0.6)), ((0, 0, 1), -3 * math.sin(p - 0.4)))
    braco('R', abre=-12 - 10 * math.sin(p), balanco=-(45 + 20 * math.sin(p + 0.8)))
    braco('L', abre=-4, balanco=-(12 + 8 * math.sin(p - 1.0)))
    orelhas(2 * p - 1.0, 1.0)


def captura():
    return {pb.name: (pb.location.copy(), pb.rotation_quaternion.copy()) for pb in pbs}


def mistura(a, b, t):
    for pb in pbs:
        la, qa = a[pb.name]; lb, qb = b[pb.name]
        pb.location = la.lerp(lb, t)
        pb.rotation_quaternion = qa.slerp(qb, t)


def liso(t):
    return t * t * (3 - 2 * t)


def transicao(cadeia, n):
    """Os n desenhos de ir pela cadeia de poses (sem o primeiro, que é a pose de partida; o último é a de chegada)."""
    capt = []
    for f in cadeia:
        f(); bpy.context.view_layer.update(); capt.append(captura())

    def quadro(i):
        t = (i + 1) / n * (len(capt) - 1)
        k = min(int(t), len(capt) - 2)
        mistura(capt[k], capt[k + 1], liso(t - k))
    return quadro


# A CÂMERA DO DEITADO: a do coelho em pé (20° de elevação, 32° nas diagonais) foi escolhida para PARECER o mascote
# do PixelLab; o chão do salão é desenhado a ~32° e com as diagonais a 45° (a casa de 27 × 14,25). Em pé a diferença não
# aparece; deitado, sim: na câmera de pé o corpo some em profundidade e vira uma bola vista de cima.
def camera(elev):
    e = math.radians(elev)
    cima_ = Vector((0, math.sin(e), math.cos(e)))
    frente_ = Vector((0, math.cos(e), -math.sin(e)))
    centro_ = cima_ * ((PE_PX[1] - 60) * u_px) - Vector((1, 0, 0)) * ((PE_PX[0] - 60) * u_px)
    cam.location = centro_ - frente_ * 40
    cam.rotation_euler = (math.pi / 2 - e, 0, 0)


DE_PE, DEITADO = (20, 32), (32, 45)   # (elevação, giro das diagonais)


def giro_da(d, giro):
    return {'south': 0, 'south-east': giro, 'east': 90, 'north-east': 180 - giro, 'north': 180,
            'north-west': -(180 - giro), 'west': -90, 'south-west': -giro}[d]


OITO = {'south': 0, 'south-east': GIRO, 'east': 90, 'north-east': 180 - GIRO, 'north': 180,
        'north-west': -(180 - GIRO), 'west': -90, 'south-west': -GIRO}
DIAG = {k: OITO[k] for k in ('south-east', 'south-west', 'north-east', 'north-west')}


def estado(f):
    return lambda i, n: f()


# pasta -> (direções, desenhos, função(i, n) que põe a pose, com livro?, câmera: None de pé, 'deitado', ou 'deitando'
# nas transições que vão de uma à outra)
GRAVAR = {
    'baixa-120/animacoes/parado': (OITO, 16, pose_parado, False, None),
    'baixa-120/animacoes/andando-v3': (OITO, 8, pose_andando, False, None),
    'baixa-120/animacoes/falando': (OITO, 8, a_falando, False, None),
    # varrendo (30/10/2026): à toa, de vez em quando. A palha desce abaixo dos pés: o motor ancora pelo parado.
    'baixa-120/animacoes/varrendo': (OITO, 8, pose_varrendo, False, None),
    'baixa-120/animacoes/digitando-maos': (OITO, 5, lambda i, n: p_computador(i), False, None),
    'estados/sentado-2': (OITO, 16, a_sentado, False, None),
    'estados/sentado-sofa': (OITO, 16, a_sentado_sofa, False, None),
    'estados/sentado-poltrona': (OITO, 1, estado(p_poltrona), False, None),
    'estados/sentado-banqueta': (OITO, 1, estado(p_banqueta), False, None),
    'estados/no-computador': (OITO, 1, estado(p_computador), False, None),
    'estados/no-fliperama': (OITO, 1, estado(p_fliperama), False, None),
    'estados/lendo-deitado': (OITO, 1, estado(p_lendo), True, 'deitado'),
    'estados/dormindo': (OITO, 1, estado(p_dormindo), False, 'deitado'),
    'estados/dormindo-largado': (OITO, 1, estado(p_largado), False, 'deitado'),
    'transicoes/sentar-fluido': (DIAG, 6, None, False, None),
    'transicoes/deitar-fluido': (DIAG, 4, None, False, 'deitando'),
    'transicoes/deitar-lendo-fluido': (DIAG, 4, None, 'fim', 'deitando'),
    'transicoes/bracos': (DIAG, 2, None, False, None),
}
CADEIAS = {
    'transicoes/sentar-fluido': [p_parado, p_sentado],
    'transicoes/deitar-fluido': [p_parado, p_sentado, p_dormindo],
    'transicoes/deitar-lendo-fluido': [p_parado, p_sentado, p_lendo],
    'transicoes/bracos': [p_sentado, p_poltrona],
}

SO_POSE = os.environ.get('SO')
VASS.hide_render = True
ik(0)
raiz_poses = os.path.join(SAIDA, 'poses')
for pasta_, (dirs, n, f, livro, cam_) in GRAVAR.items():
    if SO_POSE and SO_POSE not in pasta_:
        continue
    destino = os.path.join(raiz_poses, *pasta_.split('/'))
    os.makedirs(destino, exist_ok=True)
    vassoura = pasta_.endswith('/varrendo')
    VASS.hide_render = not vassoura
    ik(1 if vassoura else 0)
    if f is None:
        quadro_t = transicao(CADEIAS[pasta_], n)
        f = lambda i, n, q=quadro_t: q(i)
    for d in dirs:
        for i in range(n):
            # deitando: a câmera vai da de pé à do deitado junto com o corpo
            k = 1.0 if cam_ == 'deitado' else (i + 1) / n if cam_ == 'deitando' else 0.0
            camera(DE_PE[0] + (DEITADO[0] - DE_PE[0]) * k)
            ARM.rotation_euler = (0, 0, math.radians(giro_da(d, DE_PE[1] + (DEITADO[1] - DE_PE[1]) * k)))
            f(i, n)
            LIVRO.hide_render = not (livro is True or (livro == 'fim' and i >= n - 2))
            bpy.context.view_layer.update()
            renderizar(os.path.join(destino, f'{d}-{i}.png'))
    print('ok', pasta_)
LIVRO.hide_render = True
VASS.hide_render = True
ik(0)
camera(DE_PE[0])
with open(os.path.join(SAIDA, 'poses.json'), 'w') as f_:
    json.dump({p: {'direcoes': list(d), 'desenhos': n} for p, (d, n, _, _, _) in GRAVAR.items()}, f_, indent=1)
