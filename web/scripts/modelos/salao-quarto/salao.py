# O salão 3D (24/11/2026): o fliperama (Mini-games), a jukebox e o microfone de pé (o karaokê), a janela do fundo e o troféu
# (o mesmo do quarto). Antes eram caixas e cilindros montados em salao3d/cena.ts (que continuam lá, de reserva). Medidas do
# three.js: a base em y = 0, centrado em x e z, a frente para +z — as mesmas da peça por código que ele substitui.
#   rodar.ps1 salao.py [fliperama jukebox microfone janela trofeu]
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comum as c
from comum import caixa, cilindro, esfera, toro, torno, placa, tubo, juntar, mat, no

SALAO = os.path.join(c.PUBLICO, "salao3d", "feitos")
QUARTO = os.path.join(c.PUBLICO, "quarto3d", "feitos")
PI = math.pi


def lado(perfil_zy, esp, x, material, chanfro=0.02):
    """Uma lateral: o perfil (z, y) do three puxado `esp` em x, centrada em x."""
    # placa puxa em z; girada +90° em y, o x local vira −z
    return placa([(-z, y) for z, y in perfil_zy], esp, (x, 0, 0), material, chanfro=chanfro, rot=(0, PI / 2, 0))


def fliperama():
    """O gabinete de fliperama: as laterais em perfil (o painel saltado, a tela inclinada, o letreiro no alto), o painel com a
    alavanca e três botões, a fenda das fichas. A tela é um nó vazio, 'tela' (a cena põe ali o desenho por código)."""
    roxo = mat("gabinete", "#5b3f8c", 0.7)
    roxo2 = mat("lateral", "#4a3274", 0.7)
    escuro = mat("painel", "#2b2238", 0.6)
    moldura = mat("moldura", "#1c1726", 0.5)
    letreiro = mat("luz", "#ffc85a", 0.5, emissao="#ff9a3c", forca=0.6)
    laranja = mat("faixa", "#e0a23e", 0.6)
    W = 0.82
    perfil = [(-0.35, 0), (0.29, 0), (0.29, 0.86), (0.4, 0.93), (0.4, 1.0), (0.33, 1.04), (0.17, 1.52), (0.27, 1.56),
              (0.27, 1.77), (-0.35, 1.77)]
    obs = [lado(perfil, 0.07, -W / 2 + 0.035, roxo2), lado(perfil, 0.07, W / 2 - 0.035, roxo2)]
    Wi = W - 0.12
    obs.append(caixa((Wi, 0.86, 0.6), (0, 0.43, -0.03), roxo, 0.03))                     # o corpo de baixo
    obs.append(caixa((Wi, 1.77, 0.3), (0, 0.885, -0.2), roxo, 0.03))                      # as costas
    # o painel de controle, inclinado para quem joga
    obs.append(caixa((Wi, 0.07, 0.24), (0, 0.97, 0.3), escuro, 0.02, rot=(0.32, 0, 0)))
    # a moldura da tela, inclinada para trás
    ang = math.atan2(0.16, 0.48)
    obs.append(caixa((Wi, 0.5, 0.12), (0, 1.28, 0.19), moldura, 0.02, rot=(-ang, 0, 0)))
    # o letreiro aceso no alto
    obs.append(caixa((Wi, 0.17, 0.1), (0, 1.665, 0.22), roxo, 0.02))
    obs.append(caixa((Wi, 0.3, 0.42), (0, 1.62, 0.0), roxo, 0.02))                       # o miolo do alto, atrás do letreiro
    # a fenda das fichas e a portinhola
    obs.append(caixa((0.24, 0.3, 0.03), (0, 0.42, 0.28), escuro, 0.015))
    obs.append(caixa((0.12, 0.04, 0.02), (0, 0.48, 0.3), laranja, 0.008))
    # o rodapé
    obs.append(caixa((W, 0.08, 0.66), (0, 0.04, -0.03), escuro, 0.02))
    corpo = juntar(obs, "corpo")
    luz = juntar([caixa((Wi - 0.04, 0.12, 0.02), (0, 1.665, 0.275), letreiro, 0.01)], "letreiro", 1, 0.9)
    # a alavanca e os botões, em cima do painel
    nx, ny = math.sin(0.32), math.cos(0.32)
    def no_painel(x, z, h):
        return (x, 0.97 + (0.035 + h) * ny - (z - 0.3) * nx, z + (0.035 + h) * nx)
    pecas = [cilindro(0.035, 0.035, 0.012, no_painel(-0.2, 0.3, 0.006), escuro, 12, rot=(0.32, 0, 0)),
             cilindro(0.012, 0.012, 0.11, no_painel(-0.2, 0.3, 0.055), mat("haste", "#c9ccd4", 0.4, 0.3), 8, rot=(0.32, 0, 0)),
             esfera(0.035, no_painel(-0.2, 0.3, 0.12), mat("bola", "#d9463b", 0.4), 12, 8)]
    for x, cor in ((0.02, "#d9463b"), (0.12, "#4fb0d9"), (0.22, "#f2c94c")):
        pecas.append(cilindro(0.034, 0.034, 0.03, no_painel(x, 0.3, 0.015), mat("botao" + cor, cor, 0.4), 12, rot=(0.32, 0, 0)))
    botoes = juntar(pecas, "controles")
    # a tela: o nó onde a cena pendura o desenho (de frente para +z do nó)
    tela = no("tela", (0, 1.28, 0.19 + 0.061 * math.cos(ang)))
    tela.rotation_euler = (-ang, 0, 0)
    tela.location.z += 0.061 * math.sin(ang)  # (o z do Blender é o y do three)
    return "fliperama", os.path.join(SALAO, "fliperama.glb")


def jukebox():
    """A jukebox: o corpo de madeira com o alto em arco, o vidro arqueado com os discos, as duas colunas de luz (material 'luz',
    que a cena acende de noite), a grade do alto-falante e os botões."""
    madeira = mat("madeira", "#8a4b2b", 0.75)
    clara = mat("madeira-clara", "#b8703f", 0.7)
    escuro = mat("vidro", "#3b2a40", 0.4)
    grade = mat("grade", "#c9a35a", 0.5, 0.2)
    luz = mat("luz", "#ffb347", 0.4, emissao="#ff9a3c", forca=0.6)
    W, H, D = 0.8, 1.05, 0.55
    # a frente: o retângulo de baixo e o arco em cima, puxados na profundidade
    arco = [(math.cos(PI * i / 16) * W / 2, H + math.sin(PI * i / 16) * 0.4) for i in range(17)]
    contorno = [(-W / 2, 0), (W / 2, 0)] + arco
    obs = [placa(contorno, D, (0, 0, 0), madeira, 0.035)]
    # a moldura clara da frente, um pouco à frente
    arco2 = [(math.cos(PI * i / 16) * (W / 2 - 0.06), H + math.sin(PI * i / 16) * 0.34) for i in range(17)]
    obs.append(placa([(-W / 2 + 0.06, 0.08), (W / 2 - 0.06, 0.08)] + arco2, 0.04, (0, 0, D / 2 + 0.005), clara, 0.012))
    obs.append(caixa((W + 0.04, 0.07, D + 0.04), (0, 0.035, 0), madeira, 0.02))
    corpo = juntar(obs, "corpo")
    # o vidro dos discos (arco escuro) e a grade
    arco3 = [(math.cos(PI * i / 16) * 0.26, 1.0 + math.sin(PI * i / 16) * 0.24) for i in range(17)]
    vidro = placa([(-0.26, 0.82), (0.26, 0.82)] + arco3, 0.02, (0, 0, D / 2 + 0.03), escuro, 0.006)
    discos = [cilindro(0.075, 0.075, 0.01, (x, 0.98, D / 2 + 0.045), mat("disco", "#1e1a22", 0.3), 14, rot=(PI / 2, 0, 0), chanfro=0)
              for x in (-0.12, 0.0, 0.12)]
    rotulos = [cilindro(0.025, 0.025, 0.012, (x, 0.98, D / 2 + 0.046), mat("rotulo" + cor, cor, 0.5), 10, rot=(PI / 2, 0, 0), chanfro=0)
               for x, cor in ((-0.12, "#d9463b"), (0.0, "#f2c94c"), (0.12, "#4fb0d9"))]
    ripas = [caixa((0.4, 0.025, 0.02), (0, 0.22 + i * 0.06, D / 2 + 0.035), grade, 0.006) for i in range(6)]
    botoes = [cilindro(0.022, 0.022, 0.02, (x, 0.66, D / 2 + 0.035), mat("tecla", "#efe5d2", 0.5), 10, rot=(PI / 2, 0, 0))
              for x in (-0.15, -0.075, 0, 0.075, 0.15)]
    juntar([vidro] + discos + rotulos + ripas + botoes, "frente")
    # as colunas de luz, que seguem o arco
    pts_e = [(-0.33, 0.12, D / 2 + 0.03)] + [(math.cos(PI - a) * 0.33, 1.0 + math.sin(PI - a) * 0.36, D / 2 + 0.03)
                                             for a in [PI * i / 20 for i in range(0, 10)]]
    pts_d = [(-x, y, z) for x, y, z in pts_e]
    juntar([tubo(pts_e, 0.035, luz, 10), tubo(pts_d, 0.035, luz, 10)], "luzes", 1, 0.95)
    return "jukebox", os.path.join(SALAO, "jukebox.glb")


def microfone():
    """O microfone de pé: a base pesada, a haste com a rosca no meio, o suporte e o microfone de grade."""
    metal = mat("metal", "#3a3a42", 0.45, 0.4)
    claro = mat("metal-claro", "#9aa0a8", 0.4, 0.4)
    obs = [cilindro(0.19, 0.2, 0.05, (0, 0.025, 0), metal, 20, chanfro=0.015),
           cilindro(0.05, 0.08, 0.05, (0, 0.07, 0), metal, 14),
           cilindro(0.022, 0.022, 0.62, (0, 0.4, 0), claro, 10, chanfro=0),
           cilindro(0.03, 0.03, 0.06, (0, 0.72, 0), metal, 12),
           cilindro(0.018, 0.018, 0.5, (0, 0.98, 0), claro, 10, chanfro=0),
           cilindro(0.02, 0.02, 0.05, (0, 1.24, 0.0), metal, 10)]
    haste = juntar(obs, "pedestal")
    # o microfone inclinado para a frente
    inc = 0.5
    cabo = cilindro(0.024, 0.032, 0.16, (0, 1.29, 0.04), mat("cabo", "#2a2a30", 0.5, 0.2), 12, rot=(inc, 0, 0))
    globo = esfera(0.062, (0, 1.36, 0.08), mat("grade", "#b9bec6", 0.35, 0.5), 14, 10)
    anel = toro(0.058, 0.01, (0, 1.33, 0.066), mat("anel", "#d9463b", 0.4), 16, 6, rot=(PI / 2 + inc, 0, 0))
    juntar([cabo, globo, anel], "microfone")
    return "microfone", os.path.join(SALAO, "microfone.glb")


def janela():
    """O caixilho da janela do fundo (1,5 × 1,3 de vão): a moldura, a cruz, o peitoril saltado e a verga. O vidro e o céu
    continuam na cena (mudam com a hora). O centro do vão está na origem; a parede em z = 0."""
    madeira = mat("madeira", "#6b4430", 0.8)
    clara = mat("madeira-clara", "#8a5a3c", 0.8)
    w, h = 1.5, 1.3
    obs = [caixa((w + 0.2, 0.12, 0.12), (0, h / 2 + 0.03, 0.06), madeira, 0.025),
           caixa((0.11, h, 0.11), (-w / 2 - 0.0, 0, 0.055), madeira, 0.025),
           caixa((0.11, h, 0.11), (w / 2 + 0.0, 0, 0.055), madeira, 0.025),
           caixa((w + 0.36, 0.09, 0.26), (0, -h / 2 + 0.015, 0.12), madeira, 0.03),
           caixa((w + 0.24, 0.06, 0.06), (0, -h / 2 - 0.06, 0.05), clara, 0.015),
           caixa((0.05, h - 0.04, 0.06), (0, 0, 0.03), clara, 0.012),
           caixa((w - 0.04, 0.05, 0.06), (0, 0, 0.03), clara, 0.012),
           caixa((w + 0.3, 0.06, 0.16), (0, h / 2 + 0.11, 0.07), clara, 0.02)]
    for x in (-0.36, 0.36):
        obs.append(caixa((0.05, 0.06, 0.03), (x, h / 2 + 0.06, 0.13), clara, 0.01))
    juntar(obs, "caixilho")
    return "janela", os.path.join(SALAO, "janela.glb")


def trofeu():
    """A taça dourada (a mesma no salão e no quarto): base de madeira em degraus, plaqueta, pé torneado, a taça com borda, as
    duas alças e a estrela na frente. Altura ~0,38, a base em y = 0."""
    ouro = mat("ouro", "#e2b53e", 0.35, 0.3)
    base = mat("base", "#6b4430", 0.8)
    placa_ = mat("plaqueta", "#f3e3a8", 0.4, 0.2)
    obs = [caixa((0.22, 0.05, 0.22), (0, 0.025, 0), base, 0.012), caixa((0.17, 0.04, 0.17), (0, 0.07, 0), base, 0.01),
           caixa((0.09, 0.035, 0.01), (0, 0.045, 0.112), placa_, 0.004)]
    perfil = [(0.055, 0.09), (0.05, 0.1), (0.022, 0.115), (0.018, 0.15), (0.03, 0.165), (0.02, 0.18), (0.04, 0.2),
              (0.085, 0.24), (0.115, 0.3), (0.125, 0.345), (0.135, 0.36), (0.12, 0.365), (0.1, 0.33)]
    obs.append(torno(perfil, (0, 0, 0), ouro, 20, fechar_topo=True))
    for s in (-1, 1):
        pts = [(s * (0.11 - 0.035 * i / 10 + 0.07 * math.sin(PI * i / 10)), 0.33 - 0.09 * i / 10, 0) for i in range(11)]
        obs.append(tubo(pts, 0.013, ouro, 8))
    estrela = []
    for i in range(10):
        a = PI / 2 + PI * i / 5
        r = 0.04 if i % 2 == 0 else 0.017
        estrela.append((math.cos(a) * r, math.sin(a) * r))
    obs.append(placa(estrela, 0.012, (0, 0.27, 0.104), mat("estrela", "#fff1b8", 0.3, 0.3), 0.003, rot=(-0.35, 0, 0)))
    juntar(obs, "trofeu", 1, 0.8)
    return "trofeu", os.path.join(QUARTO, "trofeu.glb")


ITENS = {"fliperama": fliperama, "jukebox": jukebox, "microfone": microfone, "janela": janela, "trofeu": trofeu}
for nome in c.itens_pedidos(ITENS):
    c.limpa()
    foto, destino = ITENS[nome]()
    c.exportar(destino)
    c.previa(foto)
c.pronto()
