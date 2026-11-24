# O quarto 3D (24/11/2026): o fone de Salas, a cortiça, o violão, o ventilador de pé (a cabeça e a hélice em nós próprios,
# para girar), a caminha do gato, o relógio de parede (os ponteiros em nós próprios), o balde de pipoca e o guarda-roupa alto,
# um por tema (o clássico no jeito do KayKit, o colorido no do Tiny Treats). Antes eram feitos por código em quarto3d/cena.ts
# (que continua lá, de reserva). Medidas do three.js: a base em y = 0, a frente para +z; os da parede com as costas em z = 0.
#   rodar.ps1 quarto.py [fone cortica violao ventilador caminha relogio pipoca guarda-roupa-classico guarda-roupa-colorido]
import bpy, bmesh, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comum as c
from comum import caixa, cilindro, esfera, toro, torno, placa, tubo, juntar, mat, no

QUARTO = os.path.join(c.PUBLICO, "quarto3d", "feitos")
PI = math.pi
TAU = math.tau


def fone():
    """O fone pendurado: a plaquinha de madeira com o pino, o arco acolchoado por cima do pino e as duas conchas com as
    almofadas. Os materiais 'corpo', 'detalhe' e 'almofada' são pintados pela cena com as cores do tema."""
    madeira = mat("madeira", "#9a5d36", 0.85)
    corpo = mat("corpo", "#3c3a40", 0.5)
    almofada = mat("almofada", "#26252a", 0.9)
    detalhe = mat("detalhe", "#c98c3c", 0.4)
    placa_ = juntar([caixa((0.2, 0.24, 0.04), (0, 0.6, 0.02), madeira, 0.015),
                     cilindro(0.025, 0.025, 0.2, (0, 0.62, 0.12), madeira, 10, rot=(PI / 2, 0, 0)),
                     cilindro(0.04, 0.04, 0.03, (0, 0.62, 0.225), madeira, 12, rot=(PI / 2, 0, 0))], "gancho")
    # o arco: a faixa de cima passa por cima do pino, a almofada por baixo dela
    pts = [(math.cos(PI * i / 18) * 0.21, 0.42 + math.sin(PI * i / 18) * 0.25, 0.18) for i in range(19)]
    arco = tubo(pts, 0.026, corpo, 10)
    pts2 = [(math.cos(PI * (0.25 + 0.5 * i / 10)) * 0.205, 0.42 + math.sin(PI * (0.25 + 0.5 * i / 10)) * 0.235, 0.18) for i in range(11)]
    acolchoado = tubo(pts2, 0.03, almofada, 10)
    obs = [arco, acolchoado]
    for s in (-1, 1):
        obs.append(caixa((0.03, 0.12, 0.05), (s * 0.21, 0.4, 0.18), detalhe, 0.01))                     # o garfo
        obs.append(cilindro(0.1, 0.1, 0.08, (s * 0.235, 0.33, 0.18), corpo, 20, rot=(0, 0, PI / 2), chanfro=0.02))
        obs.append(cilindro(0.08, 0.075, 0.035, (s * 0.18, 0.33, 0.18), almofada, 18, rot=(0, 0, PI / 2), chanfro=0.012))
        obs.append(cilindro(0.055, 0.055, 0.02, (s * 0.283, 0.33, 0.18), detalhe, 16, rot=(0, 0, PI / 2), chanfro=0.006))
    juntar(obs, "fone")
    return "fone", os.path.join(QUARTO, "fone.glb")


def cortica():
    """A cortiça dos avisos: a moldura de madeira, o quadro de cortiça, os bilhetes, a foto e as tachinhas. As costas em z = 0."""
    L, A = 1.15, 0.8
    madeira = mat("madeira", "#9a5d36", 0.85)
    corti = mat("cortica", "#c99a63", 1.0)
    pinta = mat("cortica-escura", "#a77a48", 1.0)
    obs = [caixa((L, A, 0.04), (0, A / 2, 0.02), corti, 0.01)]
    for w, h, x, y in ((L + 0.1, 0.07, 0, 0), (L + 0.1, 0.07, 0, A), (0.07, A, -L / 2, A / 2), (0.07, A, L / 2, A / 2)):
        obs.append(caixa((w, h, 0.075), (x, y, 0.0375), madeira, 0.018))
    quadro = juntar(obs, "quadro")
    # as pintinhas da cortiça (poucas, grandes o bastante para ver de longe)
    pts = []
    for i in range(22):
        x = ((i * 0.37) % 1.0 - 0.5) * (L - 0.15)
        y = 0.08 + ((i * 0.61) % 1.0) * (A - 0.16)
        pts.append(cilindro(0.012, 0.012, 0.004, (x, y, 0.041), pinta, 6, rot=(PI / 2, 0, 0), chanfro=0))
    juntar(pts, "pintas", 1, 1)
    bilhetes = [("#f4e1a1", -0.3, 0.52, 0.28, -0.08), ("#9cc8d6", 0.12, 0.55, 0.24, 0.1), ("#efe5d2", 0.36, 0.3, 0.22, -0.05),
                ("#e9a38a", -0.12, 0.24, 0.3, 0.06)]
    obs = []
    for i, (cor, x, y, t, giro) in enumerate(bilhetes):
        papel = mat("papel" + cor, cor, 0.95)
        obs.append(caixa((t, t * 0.85, 0.01), (x, y, 0.047), papel, 0.003, rot=(0, 0, giro)))
        # as linhas escritas (riscos)
        tinta = mat("tinta", "#8a7a6a", 0.9)
        for k in range(3):
            dy = t * (0.18 - k * 0.16)
            dx, ddy = -math.sin(giro) * dy, math.cos(giro) * dy
            obs.append(caixa((t * (0.6 - 0.1 * k), 0.012, 0.004), (x + dx, y + ddy - 0.02, 0.053), tinta, 0, rot=(0, 0, giro)))
        tacha = mat("tacha" + str(i % 3), ("#c9473d", "#3f8fb0", "#e2b53e")[i % 3], 0.45)
        px, py = x - math.sin(giro) * t * 0.36, y + math.cos(giro) * t * 0.36
        obs.append(cilindro(0.024, 0.022, 0.02, (px, py, 0.064), tacha, 12, rot=(PI / 2, 0, 0), chanfro=0.006))
    # a foto
    obs.append(caixa((0.2, 0.24, 0.01), (0.42, 0.6, 0.047), mat("papel-foto", "#fbf6ea", 0.9), 0.003, rot=(0, 0, 0.12)))
    obs.append(caixa((0.16, 0.15, 0.004), (0.425, 0.625, 0.053), mat("ceu", "#a8dcf5", 0.9), 0, rot=(0, 0, 0.12)))
    obs.append(caixa((0.16, 0.05, 0.005), (0.43, 0.575, 0.0535), mat("morro", "#86c06a", 0.9), 0, rot=(0, 0, 0.12)))
    juntar(obs, "bilhetes", 1, 0.92)
    return "cortica", os.path.join(QUARTO, "cortica.glb")


def violao():
    """O violão pendurado: o corpo em 8 (duas bolas unidas, com a cintura), o tampo claro com a boca e o cavalete, o braço com
    os trastes, a cabeça com as tarraxas e as cordas. As costas em z = 0, altura ~1,35."""
    madeira = mat("madeira", "#a8643a", 0.6)
    tampo = mat("tampo", "#e0a96b", 0.55)
    escura = mat("escura", "#4a2c1c", 0.7)
    metal = mat("metal", "#d9d6cc", 0.35, 0.5)

    # o contorno de verdade: as duas bolas e a cintura, amostrado como o envelope das duas
    def envelope(n=60):
        cs = [(0.0, 0.28, 0.24), (0.0, 0.55, 0.195)]
        pts = []
        for i in range(n):
            a = TAU * i / n
            d = (math.cos(a), math.sin(a))
            # o ponto mais distante, nessa direção, a partir do centro do corpo (0, 0.42)
            melhor = 0
            for cx, cy, r in cs:
                ox, oy = cx - 0.0, cy - 0.42
                b = ox * d[0] + oy * d[1]
                q = b * b - (ox * ox + oy * oy - r * r)
                if q >= 0:
                    melhor = max(melhor, b + math.sqrt(q))
            # a cintura: aperta um pouco nos lados
            aperto = 1 - 0.03 * math.exp(-((math.sin(a) - 0.2) ** 2) / 0.02) * abs(math.cos(a))
            pts.append((d[0] * melhor * aperto, 0.42 + d[1] * melhor * aperto))
        return pts

    contorno = envelope()
    lados = placa(contorno, 0.1, (0, 0, 0.05), madeira, 0.02)
    topo = placa([(x * 0.94, 0.42 + (y - 0.42) * 0.94) for x, y in contorno], 0.012, (0, 0, 0.102), tampo, 0.004)
    corpo = juntar([lados, topo], "corpo", 1, 0.85)
    obs = [cilindro(0.068, 0.068, 0.006, (0, 0.5, 0.109), escura, 20, rot=(PI / 2, 0, 0), chanfro=0),
           toro(0.075, 0.008, (0, 0.5, 0.109), mat("filete", "#6b3a20", 0.6), 20, 6),
           caixa((0.16, 0.035, 0.02), (0, 0.24, 0.115), escura, 0.006),                       # o cavalete
           caixa((0.075, 0.6, 0.045), (0, 0.98, 0.085), escura, 0.012),                        # o braço
           caixa((0.11, 0.17, 0.04), (0, 1.36, 0.08), escura, 0.015, rot=(-0.12, 0, 0))]       # a cabeça
    for k in range(6):
        obs.append(caixa((0.078, 0.008, 0.006), (0, 0.76 + k * 0.08, 0.11), metal, 0))         # os trastes
    for s in (-1, 1):
        for k in range(3):
            obs.append(cilindro(0.012, 0.012, 0.05, (s * 0.075, 1.31 + k * 0.045, 0.08), metal, 8, rot=(0, 0, PI / 2), chanfro=0))
    juntar(obs, "braco")
    cordas = [caixa((0.004, 1.06, 0.004), (-0.025 + k * 0.01, 0.78, 0.114), metal, 0) for k in range(6)]
    juntar(cordas, "cordas", 1, 1)
    return "violao", os.path.join(QUARTO, "violao.glb")


def ventilador():
    """O ventilador de pé: a base, a haste, o motor; a CABEÇA (nó 'cabeca', o pivô da oscilação, no alto da haste) com a grade,
    e a HÉLICE (nó 'helice', filho da cabeça, que gira em z) com as três pás e o miolo. Virado para +z."""
    creme = mat("creme", "#efe3c8", 0.55)
    escuro = mat("escuro", "#6f6257", 0.6)
    pa = mat("pa", "#9fd0c6", 0.5)
    juntar([cilindro(0.2, 0.23, 0.06, (0, 0.03, 0), creme, 24, chanfro=0.02),
            cilindro(0.06, 0.08, 0.04, (0, 0.08, 0), creme, 14),
            cilindro(0.025, 0.025, 0.72, (0, 0.44, 0), creme, 10, chanfro=0),
            cilindro(0.04, 0.04, 0.05, (0, 0.78, 0), escuro, 12),
            caixa((0.05, 0.05, 0.04), (0.12, 0.05, 0.15), escuro, 0.012)], "pe")              # o botão na base
    Y = 0.86
    cab = no("cabeca", (0, Y, 0))
    # a cabeça, no referencial do nó (a origem no pivô)
    def em(p):
        return (p[0], p[1] + Y, p[2])
    obs = [cilindro(0.08, 0.095, 0.18, em((0, 0, -0.06)), creme, 16, rot=(PI / 2, 0, 0), chanfro=0.025),
           esfera(0.06, em((0, 0, -0.16)), creme, 12, 8),
           toro(0.27, 0.016, em((0, 0, 0.1)), creme, 36, 6), toro(0.27, 0.016, em((0, 0, 0.03)), creme, 36, 6)]
    # a grade: os arames da frente, em raios, e o selo no meio
    for i in range(8):
        a = PI * i / 8
        obs.append(caixa((0.008, 0.54, 0.008), em((0, 0, 0.115)), creme, 0, rot=(0, 0, a)))
    for i in range(12):
        a = TAU * i / 12
        obs.append(caixa((0.008, 0.008, 0.08), em((math.cos(a) * 0.27, math.sin(a) * 0.27, 0.065)), creme, 0))
    obs.append(cilindro(0.05, 0.05, 0.02, em((0, 0, 0.12)), mat("selo", "#c9714f", 0.5), 14, rot=(PI / 2, 0, 0), chanfro=0.006))
    grade = juntar(obs, "grade")
    grade.parent = cab
    grade.matrix_parent_inverse = cab.matrix_world.inverted()
    hel = no("helice", (0, Y, 0.06))
    pas = [cilindro(0.04, 0.04, 0.06, em((0, 0, 0.06)), escuro, 12, rot=(PI / 2, 0, 0))]
    for i in range(3):
        a = TAU * i / 3
        # a pá: uma gota achatada, um pouco torcida
        cont = []
        for k in range(20):
            t = TAU * k / 20
            cont.append((0.13 + math.cos(t) * 0.11, math.sin(t) * 0.07 * (0.6 + 0.4 * math.cos(t))))
        p = placa(cont, 0.012, em((0, 0, 0.06)), pa, 0.004, rot=(0.25, 0, a))
        pas.append(p)
    helice = juntar(pas, "pas", 1, 0.9)
    bpy.context.view_layer.update()
    helice.parent = hel
    helice.matrix_parent_inverse = hel.matrix_world.inverted()
    hel.parent = cab
    hel.matrix_parent_inverse = cab.matrix_world.inverted()
    return "ventilador", os.path.join(QUARTO, "ventilador.glb")


def caminha():
    """A caminha do gato: o fundo redondo, a almofada fofa e a borda de tecido em rolo, mais baixa na frente (+z, a entrada)."""
    tecido = mat("tecido", "#b8654a", 0.9)
    claro = mat("almofada", "#efe1c6", 0.95)
    obs = [torno([(0.0, 0.0), (0.33, 0.0), (0.36, 0.02), (0.36, 0.05), (0.0, 0.05)], (0, 0, 0), tecido, 32)]
    pts = []
    raios = []
    for i in range(48):
        a = TAU * i / 48
        frente = max(0.0, math.sin(a)) ** 2          # a = π/2 é o +z (a entrada)
        rr = 0.09 - 0.04 * frente
        r = 0.29 + 0.03 * frente
        pts.append((math.cos(a) * r, 0.05 + rr * 0.9, math.sin(a) * r))
        raios.append(rr)
    obs.append(tubo(pts, raios, tecido, 12, fechado=True))
    borda = juntar(obs, "borda", 1, 0.8)
    juntar([torno([(0, 0.05), (0.2, 0.05), (0.25, 0.065), (0.24, 0.09), (0.15, 0.105), (0.0, 0.11)], (0, 0, 0), claro, 28)],
           "almofada", 1, 0.9)
    return "caminha-gato", os.path.join(QUARTO, "caminha-gato.glb")


def relogio():
    """O relógio de parede do clássico: o aro de madeira, o mostrador creme com as doze marcas, e os ponteiros em nós próprios
    ('horas', 'minutos'; giram em z, o zero apontando para cima). As costas em z = 0."""
    madeira = mat("madeira", "#9a5d36", 0.8)
    face = mat("mostrador", "#f3ead8", 0.9)
    preto = mat("ponteiro", "#3a2d26", 0.7)
    Y = 0.32
    obs = [cilindro(0.32, 0.32, 0.08, (0, Y, 0.04), madeira, 32, rot=(PI / 2, 0, 0), chanfro=0.025),
           cilindro(0.265, 0.265, 0.02, (0, Y, 0.08), face, 32, rot=(PI / 2, 0, 0), chanfro=0)]
    for i in range(12):
        a = TAU * i / 12
        g = 0.05 if i % 3 == 0 else 0.03
        obs.append(caixa((0.018, g, 0.008), (math.sin(a) * (0.22 - g / 2 + 0.01), Y + math.cos(a) * (0.22 - g / 2 + 0.01), 0.092),
                         preto, 0, rot=(0, 0, -a)))
    juntar(obs, "relogio")
    for nome, comp, larg, z in (("horas", 0.13, 0.03, 0.1), ("minutos", 0.2, 0.02, 0.107)):
        n = no(nome, (0, Y, 0))
        p = juntar([caixa((larg, comp, 0.007), (0, Y + comp / 2 - 0.02, z), preto, 0.002)], nome + "-malha", 1, 1)
        p.parent = n
        p.matrix_parent_inverse = n.matrix_world.inverted()
    juntar([cilindro(0.022, 0.022, 0.02, (0, Y, 0.112), madeira, 12, rot=(PI / 2, 0, 0))], "miolo")
    return "relogio", os.path.join(QUARTO, "relogio.glb")


def pipoca():
    """O balde de pipoca listrado (vermelho e branco) com as pipocas saindo por cima. Altura ~0,32 (a cena ajusta)."""
    verm = mat("listra", "#d9463b", 0.6)
    branco = mat("branco", "#f6efe2", 0.6)
    milho = mat("pipoca", "#fbe7b0", 0.85)
    amarelo = mat("manteiga", "#f2c94c", 0.7)
    # o balde: 16 gomos alternados, mais largo em cima
    n = 16
    bm = bmesh.new()
    aneis = []
    for r, y in ((0.085, 0.0), (0.12, 0.24)):
        aneis.append([bm.verts.new((math.cos(TAU * k / n) * r, math.sin(TAU * k / n) * r, y)) for k in range(n)])
    faces = []
    for k in range(n):
        f = bm.faces.new([aneis[0][k], aneis[0][(k + 1) % n], aneis[1][(k + 1) % n], aneis[1][k]])
        f.material_index = k % 2
        faces.append(f)
    fundo = bm.faces.new(list(reversed(aneis[0])))
    fundo.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new("balde")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(verm)
    me.materials.append(branco)
    balde = bpy.data.objects.new("balde", me)
    bpy.context.scene.collection.objects.link(balde)
    borda = toro(0.122, 0.012, (0, 0.24, 0), branco, 24, 6, rot=(PI / 2, 0, 0))
    juntar([balde, borda], "balde", 1, 0.85)
    pops = []
    import random
    rnd = random.Random(7)
    for i in range(32):
        a = rnd.uniform(0, TAU)
        r = rnd.uniform(0, 0.11) ** 0.8 * 0.11 ** 0.2
        y = 0.25 + rnd.uniform(0, 0.04) + (0.11 - r) * 0.55
        s = rnd.uniform(0.028, 0.038)
        pops.append(esfera(s, (math.cos(a) * r, y, math.sin(a) * r), amarelo if i % 7 == 0 else milho, 6, 4,
                           escala=(1, rnd.uniform(0.8, 1.1), rnd.uniform(0.85, 1.15))))
    juntar(pops, "pipocas", 1, 0.9)
    return "pipoca", os.path.join(QUARTO, "pipoca.glb")


def guarda_roupa(tema):
    """O guarda-roupa alto (o que nenhum pacote tem), ~1,6 × 2,05 × 0,62, virado para +z. Clássico: madeira do KayKit, duas
    portas almofadadas, puxadores redondos, a cornija e o rodapé. Colorido: o do Tiny Treats, a caixa laranja com as portas e as
    gavetas azuis e os puxadores amarelos, nos pezinhos."""
    W, H, D = 1.6, 2.25, 0.62
    obs = []
    if tema == "classico":
        corpo = mat("madeira", "#c47c4a", 0.85)
        escura = mat("madeira-escura", "#8a5233", 0.85)
        porta = mat("porta", "#d38b55", 0.8)
        puxa = mat("puxador", "#e2b53e", 0.4, 0.3)
        obs += [caixa((W, H - 0.12, D), (0, 0.06 + (H - 0.12) / 2, 0), corpo, 0.03),
                caixa((W + 0.08, 0.1, D + 0.06), (0, H - 0.05, 0.01), escura, 0.03),          # a cornija
                caixa((W + 0.04, 0.1, D + 0.03), (0, 0.05, 0.005), escura, 0.025)]           # o rodapé
        for s in (-1, 1):
            x = s * (W / 4 - 0.005)
            obs.append(caixa((W / 2 - 0.07, H - 0.34, 0.04), (x, 0.13 + (H - 0.34) / 2 + 0.02, D / 2 + 0.01), porta, 0.015))
            # as almofadas da porta (dois retângulos em relevo)
            for y0, h in ((0.25, 0.8), (1.15, 0.7)):
                obs.append(caixa((W / 2 - 0.22, h, 0.025), (x, y0 + h / 2, D / 2 + 0.035), corpo, 0.012))
            obs.append(esfera(0.035, (s * 0.07, 1.1, D / 2 + 0.05), puxa, 12, 8))
        obs.append(caixa((0.02, H - 0.36, 0.02), (0, 0.13 + (H - 0.36) / 2 + 0.02, D / 2 + 0.03), escura, 0.006))
        juntar(obs, "guarda-roupa", 1, 0.78)
    else:
        laranja = mat("caixa", "#ec8a5a", 0.7)
        azul = mat("portas", "#5b8fd0", 0.65)
        amarelo = mat("puxador", "#f6c445", 0.5)
        clara = mat("tampo", "#f4a97c", 0.7)
        obs += [caixa((W, H - 0.12, D), (0, 0.1 + (H - 0.12) / 2, 0), laranja, 0.06, segs=2),
                caixa((W + 0.06, 0.08, D + 0.06), (0, H - 0.0, 0.0), clara, 0.035, segs=2)]
        for s in (-1, 1):
            obs.append(cilindro(0.06, 0.05, 0.12, (s * (W / 2 - 0.12), 0.06, D / 2 - 0.12), laranja, 12, chanfro=0.02))
            obs.append(cilindro(0.06, 0.05, 0.12, (s * (W / 2 - 0.12), 0.06, -D / 2 + 0.12), laranja, 12, chanfro=0.02))
        for s in (-1, 1):
            x = s * (W / 4 - 0.01)
            obs.append(caixa((W / 2 - 0.1, H - 0.8, 0.05), (x, 0.66 + (H - 0.8) / 2, D / 2 + 0.005), azul, 0.04, segs=2))
            obs.append(cilindro(0.04, 0.04, 0.04, (s * 0.1, 1.4, D / 2 + 0.045), amarelo, 14, rot=(PI / 2, 0, 0), chanfro=0.015))
        for k in range(2):
            y = 0.26 + k * 0.25
            obs.append(caixa((W - 0.14, 0.2, 0.05), (0, y, D / 2 + 0.005), azul, 0.04, segs=2))
            obs.append(cilindro(0.035, 0.035, 0.04, (0, y, D / 2 + 0.045), amarelo, 14, rot=(PI / 2, 0, 0), chanfro=0.012))
        juntar(obs, "guarda-roupa", 1, 0.8)
    return "guarda-roupa-" + tema, os.path.join(QUARTO, "guarda-roupa-" + tema + ".glb")


ITENS = {"fone": fone, "cortica": cortica, "violao": violao, "ventilador": ventilador, "caminha": caminha, "relogio": relogio,
         "pipoca": pipoca, "guarda-roupa-classico": lambda: guarda_roupa("classico"),
         "guarda-roupa-colorido": lambda: guarda_roupa("colorido")}
for nome in c.itens_pedidos(ITENS):
    c.limpa()
    foto, destino = ITENS[nome]()
    c.exportar(destino)
    c.previa(foto)
c.pronto()
