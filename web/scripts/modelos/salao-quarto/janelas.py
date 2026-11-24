# As janelas do quarto 3D que nenhum pacote tem (24/11/2026): a em ARCO, a REDONDA e a COM FLOREIRA, e, para a janela grande
# (a "original" do pixel), a CORTINA FECHADA e as FOLHAS ABERTAS. Uma versão por tema: o clássico (a madeira pintada de verde
# das cortinas do Restaurant Bits, o peitoril de madeira) e o colorido (o branco gordinho e os tons do Tiny Treats).
# Antes, todas viravam a janela do pacote (quarto3d/cena.ts, que continua de reserva).
#
# As janelas ficam NA FRENTE da parede (a cena põe a parede inteira atrás): a origem é o meio do vidro, as costas em z = 0. O
# 'vidro' e o 'morro' são pintados pela cena com o céu da hora. A cortina e as folhas têm 1 de largura (a cena estica em x
# até o vão) e a origem no meio do vão.
#   rodar.ps1 janelas.py [arco-classico redonda-classico floreira-classico cortina-classico folhas-classico ... -colorido]
import bpy, bmesh, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comum as c
from comum import caixa, cilindro, esfera, toro, placa, tubo, juntar, mat, no

QUARTO = os.path.join(c.PUBLICO, "quarto3d", "feitos")
PI = math.pi
TAU = math.tau

ESTILO = {
    "classico": dict(moldura="#3f7a5a", trim="#2f5e45", peitoril="#9a5d36", cortina="#4f9a68", cortina2="#3f7f55",
                     varao="#6b4430", chanfro=0.015, grosso=0.09),
    "colorido": dict(moldura="#f4f0ea", trim="#d9d2e6", peitoril="#ec8a5a", cortina="#f2a7b8", cortina2="#e48aa0",
                     varao="#f6c445", chanfro=0.035, grosso=0.12),
}


def arco(t):
    e = ESTILO[t]
    m, tr, pe = mat("moldura", e["moldura"], 0.7), mat("trim", e["trim"], 0.7), mat("peitoril", e["peitoril"], 0.8)
    w, h = 1.3, 1.0             # a parte reta e o raio do arco = w/2
    r = w / 2
    y0 = -0.75
    contorno = [(-r, y0), (r, y0)] + [(math.cos(PI * i / 20) * r, y0 + h + math.sin(PI * i / 20) * r) for i in range(21)]
    placa(contorno, 0.01, (0, 0, 0.012), mat("vidro", "#a8dcf5", 1.0), 0)
    placa([(-r + 0.04, y0 + 0.02), (r - 0.04, y0 + 0.02), (r - 0.04, y0 + 0.3), (0.2, y0 + 0.5), (-0.3, y0 + 0.45), (-r + 0.04, y0 + 0.32)],
          0.01, (0, 0, 0.02), mat("morro", "#86c06a", 1.0), 0)
    g = e["grosso"]
    obs = []
    # a moldura: os dois lados, o arco por cima, a cruz
    obs.append(caixa((g, h + 0.02, g), (-r - g / 2 + 0.02, y0 + h / 2, g / 2), m, e["chanfro"]))
    obs.append(caixa((g, h + 0.02, g), (r + g / 2 - 0.02, y0 + h / 2, g / 2), m, e["chanfro"]))
    pts = [(math.cos(PI * i / 24) * (r + g / 2 - 0.02), y0 + h + math.sin(PI * i / 24) * (r + g / 2 - 0.02), g / 2) for i in range(25)]
    obs.append(tubo(pts, g / 2, m, 10))
    obs.append(caixa((0.05, h + r - 0.02, 0.05), (0, y0 + (h + r) / 2, 0.035), tr, 0.012))
    obs.append(caixa((w, 0.05, 0.05), (0, y0 + h, 0.035), tr, 0.012))
    # os raios do leque no arco
    for a in (PI / 4, 3 * PI / 4):
        obs.append(caixa((0.04, r, 0.04), (math.cos(a) * r / 2, y0 + h + math.sin(a) * r / 2, 0.035), tr, 0.01, rot=(0, 0, a - PI / 2)))
    obs.append(caixa((w + 0.4, 0.08, 0.22), (0, y0 - 0.03, 0.11), pe, 0.025))
    obs.append(caixa((w + 0.2, 0.06, 0.06), (0, y0 - 0.1, 0.04), m, 0.015))
    if t == "colorido":
        obs.append(esfera(0.07, (0, y0 + h + r + g / 2, g / 2), mat("enfeite", "#f6c445", 0.5), 12, 8))
    juntar(obs, "moldura")
    return "janela-arco-" + t


def redonda(t):
    e = ESTILO[t]
    m, tr, pe = mat("moldura", e["moldura"], 0.7), mat("trim", e["trim"], 0.7), mat("peitoril", e["peitoril"], 0.8)
    R = 0.66
    cont = [(math.cos(TAU * i / 40) * R, math.sin(TAU * i / 40) * R) for i in range(40)]
    placa(cont, 0.01, (0, 0, 0.012), mat("vidro", "#a8dcf5", 1.0), 0)
    morro = [(math.cos(PI + PI * i / 20) * (R - 0.03), math.sin(PI + PI * i / 20) * (R - 0.03)) for i in range(21)]
    morro += [(R * 0.7, -0.1), (0.1, 0.05), (-0.4, -0.05)]
    placa(morro, 0.01, (0, 0, 0.02), mat("morro", "#86c06a", 1.0), 0)
    g = e["grosso"]
    obs = [toro(R + g / 2 - 0.02, g / 2 + 0.01, (0, 0, g / 2), m, 40, 10, escala=(1, 1, 1))]
    obs.append(caixa((0.05, 2 * R, 0.05), (0, 0, 0.035), tr, 0.012))
    obs.append(caixa((2 * R, 0.05, 0.05), (0, 0, 0.035), tr, 0.012))
    obs.append(toro(R * 0.42, 0.025, (0, 0, 0.035), tr, 24, 6))
    # o pezinho de baixo, como uma escuna
    obs.append(caixa((0.5, 0.08, 0.16), (0, -R - g / 2 + 0.01, 0.08), pe, 0.025))
    if t == "colorido":
        for a in (PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4):
            obs.append(esfera(0.035, (math.cos(a) * (R + g / 2 - 0.02), math.sin(a) * (R + g / 2 - 0.02), g + 0.01),
                              mat("enfeite", "#f6c445", 0.5), 10, 6))
    juntar(obs, "moldura")
    return "janela-redonda-" + t


def floreira(t):
    e = ESTILO[t]
    m, tr, pe = mat("moldura", e["moldura"], 0.7), mat("trim", e["trim"], 0.7), mat("peitoril", e["peitoril"], 0.8)
    w, h = 1.4, 1.15
    cont = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    placa(cont, 0.01, (0, 0, 0.012), mat("vidro", "#a8dcf5", 1.0), 0)
    placa([(-w / 2 + 0.03, -h / 2 + 0.02), (w / 2 - 0.03, -h / 2 + 0.02), (w / 2 - 0.03, -h / 2 + 0.28), (0.25, -h / 2 + 0.45),
           (-0.2, -h / 2 + 0.38), (-w / 2 + 0.03, -h / 2 + 0.3)], 0.01, (0, 0, 0.02), mat("morro", "#86c06a", 1.0), 0)
    g = e["grosso"]
    obs = [caixa((w + 2 * g, g, g), (0, h / 2 + g / 2 - 0.02, g / 2), m, e["chanfro"]),
           caixa((g, h, g), (-w / 2 - g / 2 + 0.02, 0, g / 2), m, e["chanfro"]),
           caixa((g, h, g), (w / 2 + g / 2 - 0.02, 0, g / 2), m, e["chanfro"]),
           caixa((0.05, h, 0.05), (0, 0, 0.035), tr, 0.012),
           caixa((w, 0.05, 0.05), (0, 0.08, 0.035), tr, 0.012),
           caixa((w + 0.35, 0.07, 0.2), (0, -h / 2 - 0.03, 0.1), m, 0.02)]
    # a floreira: a caixa de madeira com as tábuas, a terra e as flores
    obs.append(caixa((w + 0.2, 0.26, 0.3), (0, -h / 2 - 0.2, 0.2), pe, 0.03))
    for k in range(3):
        obs.append(caixa((w + 0.22, 0.015, 0.31), (0, -h / 2 - 0.29 + k * 0.08, 0.2), mat("tabua", "#7a4a2c", 0.85), 0))
    for s in (-1, 1):
        obs.append(caixa((0.06, 0.16, 0.06), (s * (w / 2 - 0.05), -h / 2 - 0.33, 0.06), mat("tabua", "#7a4a2c", 0.85), 0.01))
    obs.append(caixa((w + 0.12, 0.03, 0.24), (0, -h / 2 - 0.075, 0.2), mat("terra", "#5a3a28", 1.0), 0))
    juntar(obs, "moldura")
    import random
    rnd = random.Random(3)
    folhas, flores = [], []
    cores = ["#e85d75", "#f6c445", "#f29bd0", "#ffffff", "#e8743b"] if t == "colorido" else ["#d9463b", "#f2c94c", "#efe5d2", "#c97bb0"]
    for i in range(7):
        x = -w / 2 + 0.1 + (w - 0.2) * i / 6 + rnd.uniform(-0.03, 0.03)
        z = 0.2 + rnd.uniform(-0.06, 0.06)
        y = -h / 2 - 0.06
        folhas.append(esfera(0.11, (x, y + 0.03, z), mat("folha", "#5f9a58", 0.8), 8, 5, escala=(1, 0.7, 1)))
        cor = cores[i % len(cores)]
        hy = y + rnd.uniform(0.13, 0.2)
        for k in range(5):
            a = TAU * k / 5
            flores.append(esfera(0.042, (x + math.cos(a) * 0.05, hy, z + 0.03 + math.sin(a) * 0.05), mat("petala" + cor, cor, 0.6), 6, 4,
                                 escala=(1, 0.6, 1)))
        flores.append(esfera(0.03, (x, hy + 0.015, z + 0.03), mat("miolo", "#f6c445" if cor != "#f6c445" else "#c9714f", 0.6), 6, 4))
    juntar(folhas, "folhas", 1, 0.8)
    juntar(flores, "flores", 1, 0.9)
    return "janela-floreira-" + t


def onda(w, h, x0, prof, dobras, material, nome, z0=0.0, aberta_em_baixo=0.0):
    """Um pano com as dobras (ondas em z), de x0 a x0+w e de 0 a −h (pendurado no alto). `aberta_em_baixo`: o quanto o pano
    se recolhe para o lado (x0) na barra (a cortina presa)."""
    bm = bmesh.new()
    nx, ny = dobras * 4, 2
    vs = []
    for j in range(ny + 1):
        fy = j / ny
        linha = []
        for i in range(nx + 1):
            fx = i / nx
            x = x0 + w * fx * (1 - aberta_em_baixo * fy ** 2)
            z = z0 + prof * (0.5 + 0.5 * math.sin(TAU * dobras * fx))
            y = -h * fy
            linha.append(bm.verts.new((x, -z, y)))
        vs.append(linha)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new([vs[j][i], vs[j + 1][i], vs[j + 1][i + 1], vs[j][i + 1]])
    # a espessura (o pano tem frente e verso)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ret = bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.025)
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def cortina(t):
    """A cortina fechada da janela grande: o varão com as ponteiras e as duas folhas de pano, com dobras, que se encontram no
    meio. Largura 1 (a cena estica), altura ~1,9 a partir do varão (origem no meio do varão)."""
    e = ESTILO[t]
    pano = mat("pano", e["cortina"], 0.95)
    pano2 = mat("pano-barra", e["cortina2"], 0.95)
    varao = mat("varao", e["varao"], 0.5, 0.2)
    H = 1.85
    folhas = [onda(0.52, H, -0.52, 0.06, 4, pano, "esq", 0.05), onda(0.52, H, 0.0, 0.06, 4, pano, "dir", 0.05)]
    juntar(folhas, "pano", 1, 0.82)
    barras = [onda(0.52, 0.12, -0.52, 0.062, 4, pano2, "b1", 0.055), onda(0.52, 0.12, 0.0, 0.062, 4, pano2, "b2", 0.055)]
    for b in barras:
        b.location.z = -(H - 0.14)
    juntar(barras, "barra", 1, 0.9)
    # o varão (fino o bastante para esticar em x sem engordar) e as argolas
    obs = [caixa((1.08, 0.035, 0.035), (0, 0.03, 0.09), varao, 0.008)]
    for k in range(9):
        obs.append(caixa((0.012, 0.06, 0.05), (-0.5 + k / 8, 0.015, 0.09), varao, 0.004))
    for s in (-1, 1):
        obs.append(caixa((0.03, 0.06, 0.09), (s * 0.54, 0.03, 0.045), varao, 0.008))
    juntar(obs, "varao", 1, 0.9)
    return "cortina-" + t


def folhas(t):
    """As folhas abertas da janela grande: duas folhas de caixilho com vidro, presas nas pontas do vão (x = ±0,5) e abertas para
    dentro do quarto (para +z), e a tranca. Largura 1 do vão (a cena estica a distância das dobradiças, não as folhas)."""
    e = ESTILO[t]
    m, tr = mat("moldura", e["moldura"], 0.7), mat("trim", e["trim"], 0.7)
    vidro = mat("vidro-folha", "#cfeaf6", 0.2)
    W, H = 0.42, 1.25
    for s, nome in ((-1, "folha-esq"), (1, "folha-dir")):
        piv = no(nome, (s * 0.5, 0, 0.05))
        # a folha fechada iria de x = s·0,5 para o meio; aberta, gira ~110° na dobradiça
        obs = [caixa((W, 0.06, 0.05), (s * (0.5 - W / 2), H / 2 - 0.03, 0.05), m, 0.012),
               caixa((W, 0.06, 0.05), (s * (0.5 - W / 2), -H / 2 + 0.03, 0.05), m, 0.012),
               caixa((0.06, H, 0.05), (s * (0.5 - 0.03), 0, 0.05), m, 0.012),
               caixa((0.06, H, 0.05), (s * (0.5 - W + 0.03), 0, 0.05), m, 0.012),
               caixa((W - 0.06, 0.035, 0.03), (s * (0.5 - W / 2), 0, 0.05), tr, 0.008),
               esfera(0.025, (s * (0.5 - W + 0.03), 0, 0.09), mat("tranca", "#e2b53e", 0.4, 0.3), 8, 6)]
        fr = juntar(obs, nome + "-moldura")
        vi = juntar([caixa((W - 0.08, H - 0.08, 0.01), (s * (0.5 - W / 2), 0, 0.05), vidro, 0)], nome + "-vidro", 1, 1)
        for o in (fr, vi):
            o.parent = piv
            o.matrix_parent_inverse = piv.matrix_world.inverted()
        piv.rotation_euler = (0, 0, s * math.radians(105))
    return "folhas-" + t


def tudo():
    d = {}
    for t in ("classico", "colorido"):
        for f in (arco, redonda, floreira, cortina, folhas):
            d[f.__name__ + "-" + t] = (lambda f=f, t=t: f(t))
    return d


ITENS = tudo()
for nome in c.itens_pedidos(ITENS):
    c.limpa()
    arq = ITENS[nome]()
    c.exportar(os.path.join(QUARTO, arq + ".glb"))
    c.previa(arq)
c.pronto()
