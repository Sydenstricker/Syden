# O POSTE DE LUZ do Rolê do coelho (24/11/2026), no estilo dos kits da Kenney que estão em volta (Mini Skate, Coaster Kit):
# oitavado, poucas faces, cores chapadas. Sai em web/public/skate/poste.glb com o pé em (0, 0, 0), o braço para +x e a
# luminária em x ≈ 0,36, a 1,9 de altura (as medidas do poste por código, que continua de reserva em skate/entorno.ts).
#   rodar.ps1 poste.py
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from comum import juntar, argumentos, pronto, limpar, mat, caixa, cilindro, esfera, assar_oclusao, exportar, previa, triangulos, REPO, FOTOS, aplicar_tudo

saida, log, _ = argumentos()
os.makedirs(FOTOS, exist_ok=True)

limpar()
ferro = mat("ferro", "#6b7178", rug=0.55, metal=0.2)
escuro = mat("escuro", "#4a4f57", rug=0.6, metal=0.2)
luz = mat("luz", "#fff3cf", rug=0.4, emissao=0.8)
# o pé: um bloco oitavado e o anel
cilindro("pe", 0.11, 0.1, (0, 0, 0.05), escuro, lados=8, bevel=0.012)
cilindro("anel", 0.075, 0.06, (0, 0, 0.13), ferro, lados=8, bevel=0.008)
# o cano, afinando, e o anel do meio
cilindro("cano", 0.055, 1.86, (0, 0, 1.06), ferro, lados=8, bevel=0, raio2=0.04)
cilindro("cinta", 0.058, 0.05, (0, 0, 0.75), escuro, lados=8, bevel=0.006)
# a tampa de cima
cilindro("topo", 0.05, 0.05, (0, 0, 2.0), escuro, lados=8, bevel=0.01)
# o braço, até a luminária, e a mão-francesa por baixo
caixa("braco", (0.38, 0.05, 0.05), (0.19, 0, 1.96), ferro, bevel=0.01)
caixa("mao", (0.2, 0.035, 0.035), (0.1, 0, 1.86), ferro, bevel=0.006, giro=(0, math.radians(-40), 0))
# a luminária: a cúpula oitavada, a borda e a lâmpada que brilha por baixo
cilindro("cupula", 0.13, 0.08, (0.36, 0, 1.93), escuro, lados=8, bevel=0.01, raio2=0.06)
cilindro("borda", 0.135, 0.02, (0.36, 0, 1.885), ferro, lados=8, bevel=0.004)
esfera("lampada", 0.085, (0.36, 0, 1.885), luz, seg=8, aneis=4, escala=(1, 1, 0.55))
aplicar_tudo()
obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
assar_oclusao(obs, forca=0.4, distancia=0.1)
obs = [juntar("poste", obs)]
n = triangulos(obs)
exportar(os.path.join(REPO, "web", "public", "skate", "poste.glb"))
previa(os.path.join(FOTOS, "poste.png"), alvo=(0.15, 0, 1.05), distancia=2.6, altura=0.6)
log.write(f"poste: {n} triângulos\n")
pronto(saida, log)
