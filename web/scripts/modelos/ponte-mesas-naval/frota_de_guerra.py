# A FROTA DE GUERRA da Batalha naval (24/11/2026): porta-aviões (5 casas), destróier (4), fragata e corveta (3) e patrulha (2),
# no jeito do Watercraft Kit da Kenney que já está na cena (o casco "bandeja" chanfrado, a borda grossa, o convés afundado,
# blocos chapados em poucas cores). A proa aponta para −Y, como os da Kenney. Sai em web/public/naval3d/guerra/<nome>.glb; o
# jogo (naval3d/cena.ts) estica cada um nas casas dele pela caixa, então só a PROPORÇÃO importa.
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import comum as c

r = c.Rodada("frota_de_guerra")
SAIDA = os.path.join(c.PUBLICO, "naval3d", "guerra")

c.limpa()
CASCO = c.cor("#4d5566", 0.7, nome="casco")
CONVES = c.cor("#8f99ab", 0.8, nome="conves")
LINHA = c.cor("#cf4f45", 0.7, nome="linha-dagua")
TORRE = c.cor("#c9cfdb", 0.7, nome="torre")
TORRE2 = c.cor("#aeb6c6", 0.7, nome="torre-sombra")
JANELA = c.cor("#33384a", 0.4, nome="janela")
ARMA = c.cor("#5a6273", 0.6, nome="arma")
PISTA = c.cor("#565d6b", 0.85, nome="pista")
BRANCO = c.cor("#f2f2ee", 0.8, nome="faixa")
AMARELO = c.cor("#f2bd3d", 0.7, nome="amarelo")
RADAR = c.cor("#e9ecf2", 0.6, nome="radar")
BANDEIRA = c.cor("#3f78d8", 0.8, nome="bandeira")


def faixa_dagua(nome, comp, larg, proa, z=0.06, alto=0.1):
    """A faixa vermelha da linha d'água: um anel um pouco maior que a base do casco."""
    pts = c.contorno_de_casco(comp * 0.955, larg * 0.83, proa * 0.9)
    return c.poligono(nome, pts, z, z + alto, LINHA, 0.01)


def torre_de_canhao(x, y, z, s=1.0, n=1, para=-1):
    """A torre: a base redonda, o bloco chanfrado e o cano (ou dois) para a proa (para=−1) ou a popa (+1)."""
    obs = [c.cilindro("base", 0.26 * s, 0.06 * s, (x, y, z), ARMA, 10, chanfro=0.01),
           c.caixa("torre", (0.42 * s, 0.46 * s, 0.22 * s), (x, y, z + 0.17 * s), TORRE2, 0.05 * s)]
    for k in range(n):
        dx = (k - (n - 1) / 2) * 0.12 * s
        cano = c.cilindro("cano", 0.04 * s, 0.5 * s, (x + dx, y + para * 0.2 * s, z + 0.17 * s), ARMA, 8, chanfro=0.0,
                          rot=(math.radians(90 if para < 0 else -90), 0, 0))
        obs.append(cano)
    return obs


def mastro(x, y, z, alto, s=1.0):
    obs = [c.cilindro("mastro", 0.045 * s, alto, (x, y, z), ARMA, 8, chanfro=0),
           c.caixa("verga", (0.5 * s, 0.05 * s, 0.05 * s), (x, y, z + alto * 0.72), ARMA, 0.01),
           c.caixa("radar", (0.42 * s, 0.08 * s, 0.16 * s), (x, y, z + alto + 0.05 * s), RADAR, 0.02),
           c.caixa("bandeira", (0.02, 0.22 * s, 0.14 * s), (x, y + 0.13 * s, z + alto * 0.6), BANDEIRA, 0.0)]
    return obs


def superestrutura(x, y, z, larg, comp, alto, andares=2, janelas=True):
    """Blocos empilhados que afinam, com a faixa escura das janelas na frente (para a proa) do último."""
    obs = []
    zz = z
    for k in range(andares):
        f = 1 - 0.18 * k
        h = alto / andares
        obs.append(c.caixa("bloco", (larg * f, comp * f, h), (x, y + comp * 0.06 * k, zz + h / 2), TORRE if k % 2 == 0 else TORRE2, 0.04))
        zz += h
    if janelas:
        f = 1 - 0.18 * (andares - 1)
        obs.append(c.caixa("janelas", (larg * f * 0.86, 0.04, alto / andares * 0.38),
                           (x, y + comp * 0.06 * (andares - 1) - comp * f / 2 - 0.005, zz - alto / andares * 0.45), JANELA, 0.0))
    return obs, zz


def casco_padrao(comp, larg, proa, alto=0.5):
    h = c.bandeja("casco", comp, larg, alto, proa, CASCO, CONVES, borda=0.09, fundo=0.12, estreita=0.78)
    return [h, faixa_dagua("linha", comp, larg, proa)], alto - 0.12


def jato(x, y, z, ang=0.0):
    """O aviãozinho do convés (o nariz para a proa): corpo, a asa em delta e o leme. Feito na origem, girado e posto."""
    obs = [c.caixa("fuselagem", (0.14, 0.78, 0.1), (0, 0, 0.06), TORRE, 0.03),
           c.poligono("asa", [(0, -0.2), (0.34, 0.22), (-0.34, 0.22)], 0.03, 0.07, TORRE, 0.0),
           c.caixa("cabine", (0.08, 0.18, 0.05), (0, -0.16, 0.13), JANELA, 0.02),
           c.caixa("leme", (0.03, 0.16, 0.16), (0, 0.3, 0.16), TORRE2, 0.0)]
    for o in obs:
        lx, ly = o.location.x, o.location.y
        o.rotation_euler[2] += ang
        o.location = (x + lx * math.cos(ang) - ly * math.sin(ang), y + lx * math.sin(ang) + ly * math.cos(ang), z + o.location.z)
    return obs
def porta_avioes():
    L, W = 10.0, 2.0
    obs, z = casco_padrao(L, W, 1.6, 0.55)
    # a pista de voo: a laje larga por cima do casco, que sai mais para bombordo, com o canto da proa chanfrado
    pista = [(-1.45, 4.85), (-1.45, -2.4), (-0.85, -4.85), (1.1, -4.85), (1.2, -2.0), (1.2, 4.85)]
    obs.append(c.poligono("pista", pista, 0.62, 0.78, PISTA, 0.03))
    obs.append(c.poligono("borda-pista", [(x * 1.02, y * 1.004) for x, y in pista], 0.52, 0.64, CASCO, 0.02))
    # as faixas: a linha do meio (tracejada) e a pista em ângulo
    for k in range(7):
        obs.append(c.caixa("faixa", (0.07, 0.42, 0.01), (-0.15, 4.2 - k * 1.25, 0.785), BRANCO, 0.0))
    obs.append(c.caixa("faixa-lado", (0.04, 6.8, 0.01), (-1.3, 1.3, 0.785), AMARELO, 0.0))
    obs.append(c.caixa("faixa-lado2", (0.04, 9.2, 0.01), (1.05, 0.2, 0.785), AMARELO, 0.0))
    # a ilha de comando, a boreste
    ilha, zt = superestrutura(0.82, 0.6, 0.78, 0.48, 1.5, 0.9, 2)
    obs += ilha
    obs += mastro(0.82, 0.9, zt, 0.55)
    obs.append(c.caixa("chamine", (0.36, 0.42, 0.3), (0.82, 1.2, zt - 0.05), CASCO, 0.05))
    # os aviões no convés
    for (x, y, a) in [(-0.75, 3.9, 0.6), (-0.75, 2.9, 0.6), (-0.75, 1.9, 0.6), (-0.1, -3.3, 0.0), (-0.55, -1.9, 0.0)]:
        obs += jato(x, y, 0.785, a)
    return obs


def destroier():
    L, W = 8.0, 1.7
    obs, z = casco_padrao(L, W, 1.7, 0.5)
    obs += torre_de_canhao(0, -2.45, z, 1.0)
    obs.append(c.caixa("misseis", (0.7, 0.6, 0.14), (0, -1.6, z + 0.07), TORRE2, 0.04))
    for k in range(4):
        obs.append(c.caixa("tampa", (0.13, 0.13, 0.02), (-0.2 + (k % 2) * 0.4, -1.75 + (k // 2) * 0.3, z + 0.15), ARMA, 0.0))
    sup, zt = superestrutura(0, -0.35, z, 1.15, 1.6, 0.78, 2)
    obs += sup
    obs += mastro(0, -0.1, zt, 0.7)
    obs.append(c.caixa("chamine", (0.5, 0.6, 0.72), (0, 0.95, z + 0.36), TORRE2, 0.08))
    obs.append(c.caixa("chamine-topo", (0.4, 0.5, 0.06), (0, 0.95, z + 0.74), JANELA, 0.02))
    obs.append(c.caixa("hangar", (1.0, 1.0, 0.36), (0, 1.95, z + 0.18), TORRE, 0.05))
    obs += torre_de_canhao(0, 3.0, z, 0.7, 1, para=1)
    return obs


def fragata():
    L, W = 6.2, 1.55
    obs, z = casco_padrao(L, W, 1.4, 0.46)
    obs += torre_de_canhao(0, -1.75, z, 0.85)
    sup, zt = superestrutura(0, -0.45, z, 1.05, 1.4, 0.7, 2)
    obs += sup
    obs += mastro(0, -0.2, zt, 0.62)
    obs.append(c.caixa("hangar", (1.05, 1.1, 0.42), (0, 0.9, z + 0.21), TORRE2, 0.05))
    # o heliponto na popa: o círculo amarelo e o x branco (sem letra)
    obs.append(c.cilindro("heliponto", 0.5, 0.012, (0, 2.15, z), AMARELO, 20, chanfro=0))
    obs.append(c.cilindro("heliponto-meio", 0.42, 0.014, (0, 2.15, z), CONVES, 20, chanfro=0))
    obs.append(c.caixa("cruz1", (0.08, 0.6, 0.01), (0, 2.15, z + 0.02), BRANCO, 0, rot=(0, 0, math.radians(45))))
    obs.append(c.caixa("cruz2", (0.08, 0.6, 0.01), (0, 2.15, z + 0.02), BRANCO, 0, rot=(0, 0, math.radians(-45))))
    return obs


def corveta():
    L, W = 5.6, 1.45
    obs, z = casco_padrao(L, W, 1.3, 0.44)
    obs += torre_de_canhao(0, -1.45, z, 0.75)
    sup, zt = superestrutura(0, -0.15, z, 0.95, 1.5, 0.66, 2)
    obs += sup
    obs += mastro(0, 0.1, zt, 0.75)
    # os lançadores inclinados a meio navio e a metralhadora da popa
    for lado in (-1, 1):
        obs.append(c.caixa("lancador", (0.3, 0.9, 0.26), (lado * 0.36, 1.15, z + 0.16), TORRE, 0.05,
                           rot=(math.radians(-14), 0, 0)))
    obs += torre_de_canhao(0, 2.0, z, 0.5, 1, para=1)
    return obs


def patrulha():
    L, W = 4.0, 1.35
    obs, z = casco_padrao(L, W, 1.2, 0.42)
    obs += torre_de_canhao(0, -0.95, z, 0.55)
    sup, zt = superestrutura(0, 0.25, z, 0.95, 1.15, 0.56, 1)
    obs += sup
    obs += mastro(0, 0.45, zt, 0.5)
    obs.append(c.caixa("bote", (0.5, 0.8, 0.16), (0, 1.45, z + 0.08), AMARELO, 0.06))
    return obs


NAVIOS = [("porta-avioes", porta_avioes, 14), ("destroier", destroier, 11), ("fragata", fragata, 9),
          ("corveta", corveta, 8.5), ("patrulha", patrulha, 7)]
for nome, fazer, dist in NAVIOS:
    c.esvazia()
    obs = fazer()
    ob = c.juntar(nome, obs)
    tri = c.exporta(os.path.join(SAIDA, nome + ".glb"), [ob])
    lo = [min(v.co[k] for v in ob.data.vertices) for k in range(3)]
    hi = [max(v.co[k] for v in ob.data.vertices) for k in range(3)]
    r.diz(nome, "triângulos", tri, "caixa", [round(x, 2) for x in lo], [round(x, 2) for x in hi])
    c.previa(os.path.join(r.pasta, f"naval-{nome}.png"), alvo=(0, 0, 0.4), dist=dist, azimute=35, elev=30)
r.fim()
