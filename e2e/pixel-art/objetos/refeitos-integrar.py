# Põe no lugar os OBJETOS DE CIMA REFEITOS (10/11/2026, refeitos.mjs): escreve pequenos/escolhidos.json com as opções
# escolhidas e monta as 4 vistas (pequenos/<id>-giros/, na ordem do montar.mjs: south-west, north-west, north-east,
# south-east) dos que têm lado. A caneca, os livros e o videogame são "de duas faces" (girar 90° espelha o desenho): a vista
# escolhida e o espelho dela, alternados. O porta-retrato tem COSTAS: a frente e o espelho dela, e as costas do
# create-8-direction-object (pequenos.mjs girar), recolocadas no quadro de 32 com o pé no mesmo lugar.
# As versões de 09/11/2026 ficaram em pequenos/falhas/09-11/.
#   python e2e/pixel-art/objetos/refeitos-integrar.py
import json, os, shutil
from PIL import Image, ImageOps

AQUI = os.path.dirname(os.path.abspath(__file__))
PEQ = os.path.join(AQUI, 'pequenos')
ESCOLHIDOS = {
    'caneca': 'refeitos/caneca-9.png',
    'suco': 'refeitos/suco-17.png',
    'refrigerante': 'refeitos/refrigerante-9.png',
    'plantinha': 'refeitos/plantinha-21.png',
    'livros': 'refeitos/livros-2.png',
    'videogame': 'refeitos/videogame-20.png',
    'pipoca': 'refeitos/pipoca-1.png',
    'retrato': 'refeitos/retrato-4.png',
    'salgadinho': 'refeitos/salgadinho-1.png',
    'bolo': 'refeitos/bolo-1.png',
}
ORDEM = ['south-west', 'north-west', 'north-east', 'south-east']


def no_quadro(im, lado=32, base=None):
    """Recoloca o desenho num quadro lado × lado, centrado na horizontal, com o pé (a última linha) em `base`."""
    im = im.convert('RGBA')
    b = im.getbbox()
    peca = im.crop(b)
    q = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    x = (lado - peca.width) // 2
    y = (base if base is not None else lado - 2) - peca.height + 1
    q.alpha_composite(peca, (max(0, x), max(0, y)))
    return q


def main():
    with open(os.path.join(PEQ, 'escolhidos.json'), 'w', encoding='utf8') as f:
        json.dump(ESCOLHIDOS, f, indent=2, ensure_ascii=False)
        f.write('\n')
    for id in ['caneca', 'livros', 'videogame', 'retrato']:
        a = Image.open(os.path.join(PEQ, ESCOLHIDOS[id])).convert('RGBA')
        espelho = ImageOps.mirror(a)
        pasta = os.path.join(PEQ, id + '-giros')
        if id == 'retrato':
            # as costas, do objeto de 8 direções (quadro de 34), guardado à parte
            oito = os.path.join(PEQ, 'refeitos', 'retrato-8-direcoes')
            if not os.path.isdir(oito):
                shutil.move(pasta, oito)
            base = a.getbbox()[3] - 1
            costas = {d: no_quadro(Image.open(os.path.join(oito, d + '.png')), 32, base) for d in ['north-west', 'north-east']}
            vistas = {'south-west': a, 'north-west': costas['north-west'], 'north-east': costas['north-east'], 'south-east': espelho}
        else:
            vistas = {'south-west': a, 'north-west': espelho, 'north-east': a, 'south-east': espelho}
        os.makedirs(pasta, exist_ok=True)
        for d in ORDEM:
            vistas[d].save(os.path.join(pasta, d + '.png'))
        print(id, '->', pasta)


main()
