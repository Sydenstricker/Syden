# O EXTINTOR e a CAMPAINHA da Cozinha da toca (24/11/2026), no estilo do KayKit Restaurant Bits que está em volta: formas
# gordinhas, quinas chanfradas, poucas cores chapadas. Saem em web/public/cozinha/extintor.glb e campainha.glb, com a base no
# chão (y = 0) e o meio em (0, 0); a cena (web/src/cozinha/cena.ts) os põe onde ficavam as peças por código, que continuam de
# reserva. Medidas do código de antes: o extintor tem 0,86 de alto e 0,17 de raio, com o bico para +z (o −y do Blender); a
# campainha, o pé de 0,23 de raio e 0,05 de alto e o domo de 0,18.
#   rodar.ps1 cozinha.py
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from comum import (juntar, argumentos, pronto, limpar, mat, caixa, cilindro, esfera, toro, tubo, assar_oclusao, exportar, previa,
                   triangulos, REPO, FOTOS, aplicar_tudo)

saida, log, _ = argumentos()
PUBLICO = os.path.join(REPO, "web", "public", "cozinha")
os.makedirs(FOTOS, exist_ok=True)


def extintor():
    limpar()
    vermelho = mat("vermelho", "#d8432f", rug=0.5)
    escuro = mat("escuro", "#3a3533", rug=0.55)
    metal = mat("metal", "#b9c2c3", rug=0.35, metal=0.4)
    rotulo = mat("rotulo", "#f1e6cc", rug=0.8)
    # o corpo: um cilindro gordo, com o fundo e o ombro arredondados pelo chanfro
    cilindro("corpo", 0.17, 0.58, (0, 0, 0.3), vermelho, lados=20, bevel=0.012)
    # o anel da base (o pé de borracha)
    cilindro("pe", 0.172, 0.04, (0, 0, 0.02), escuro, lados=20, bevel=0.01)
    # o rótulo: uma faixa clara em volta (sem texto)
    cilindro("rotulo", 0.174, 0.16, (0, 0, 0.36), rotulo, lados=20, bevel=0.004)
    # o ombro e o gargalo
    esfera("ombro", 0.17, (0, 0, 0.585), vermelho, seg=20, aneis=10, escala=(1, 1, 0.55), meia=True)
    cilindro("gargalo", 0.055, 0.07, (0, 0, 0.71), escuro, lados=12, bevel=0.008)
    # a válvula: a cabeça escura, a alavanca de cima e o gatilho de baixo, prateados
    caixa("valvula", (0.11, 0.13, 0.09), (0, -0.01, 0.78), escuro, bevel=0.018)
    caixa("alavanca", (0.06, 0.2, 0.025), (0, 0.04, 0.83), metal, bevel=0.008, giro=(math.radians(-12), 0, 0))
    caixa("gatilho", (0.055, 0.17, 0.022), (0, 0.05, 0.75), metal, bevel=0.007, giro=(math.radians(10), 0, 0))
    cilindro("pino", 0.012, 0.13, (0, -0.02, 0.81), metal, lados=8, bevel=0, giro=(0, math.radians(90), 0))
    # a mangueira: sai da válvula para a frente (−y), desce pela lateral e termina no bico
    tubo("mangueira", [(0, -0.07, 0.78), (0, -0.16, 0.74), (0.02, -0.21, 0.62), (0.08, -0.2, 0.5)], 0.022, escuro, lados=8)
    cilindro("bico", 0.032, 0.11, (0.1, -0.195, 0.45), escuro, lados=10, bevel=0.006, raio2=0.045,
             giro=(0, math.radians(15), 0))
    aplicar_tudo()
    obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assar_oclusao(obs, forca=0.5, distancia=0.08)
    obs = [juntar("extintor", obs)]
    n = triangulos(obs)
    exportar(os.path.join(PUBLICO, "extintor.glb"))
    previa(os.path.join(FOTOS, "extintor.png"), alvo=(0, 0, 0.43), distancia=1.25, altura=0.7)
    log.write(f"extintor: {n} triângulos\n")


def campainha():
    limpar()
    madeira = mat("madeira", "#5a4636", rug=0.7)
    ouro = mat("ouro", "#e8b64a", rug=0.3, metal=0.6)
    escuro = mat("escuro", "#3a3533", rug=0.5)
    # o pé redondo de madeira, chanfrado
    cilindro("pe", 0.235, 0.05, (0, 0, 0.025), madeira, lados=24, bevel=0.015, raio2=0.22)
    # o aro escuro onde o domo assenta
    cilindro("aro", 0.19, 0.02, (0, 0, 0.06), escuro, lados=24, bevel=0.006)
    # o domo dourado (meia esfera um pouco achatada)
    esfera("domo", 0.18, (0, 0, 0.065), ouro, seg=24, aneis=12, escala=(1, 1, 0.8), meia=True)
    # o pino de apertar
    cilindro("haste", 0.02, 0.06, (0, 0, 0.225), escuro, lados=10, bevel=0)
    esfera("botao", 0.042, (0, 0, 0.265), ouro, seg=14, aneis=8, escala=(1, 1, 0.65))
    aplicar_tudo()
    obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assar_oclusao(obs, forca=0.5, distancia=0.06)
    obs = [juntar("campainha", obs)]
    n = triangulos(obs)
    exportar(os.path.join(PUBLICO, "campainha.glb"))
    previa(os.path.join(FOTOS, "campainha.png"), alvo=(0, 0, 0.12), distancia=0.85, altura=0.8)
    log.write(f"campainha: {n} triângulos\n")


extintor()
campainha()
pronto(saida, log)
