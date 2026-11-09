# As REFERÊNCIAS das gerações do banheiro (banheiro.mjs): o estilo é o do salão de pixel art (um pedaço dele, com móveis,
# em ref/salao-dia.png: a página do salão fotografada de dia), e o conteúdo é o do banheiro 3D (ref-3d-dia.png: o
# banheiro de web/src/salao3d/, fotografado de dia, com "menos movimento", numa caixa de 960 × 720), recortado peça a peça.
# A escala do 3D na foto bate com a do salão: a porta do banheiro tem ~245 px lá e ~109 aqui (× ~0,45). O tamanho de cada
# peça em banheiro.mjs sai dessa conta (o quadro um tanto maior: o PixelLab desenha a peça em ~70% dele).
# A foto do 3D foi tirada pelo site de desenvolvimento (a CenaDoSalao3D de web/src/salao3d/cena.ts montada sozinha numa
# caixa de 960 × 720, com usarFuncao('banheiro') e "menos movimento"); a do salão, pela página do salão (montar.mjs salao).
#   py -3 e2e/pixel-art/salao/banheiro/referencias.py   → ref/estilo.png e ref/<peça>.png
import os
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(AQUI, 'ref')
# as caixas (x0, y0, x1, y1) de cada peça na foto do 3D
CAIXAS = {
    'banheira': (488, 355, 722, 535), 'pia': (355, 250, 568, 448), 'espelho': (460, 103, 548, 225),
    'prateleira': (562, 220, 732, 338), 'vaso': (528, 486, 654, 598), 'tapete': (400, 478, 562, 568),
    'toalhas': (398, 418, 464, 490), 'lixo': (472, 526, 530, 592), 'papel': (528, 552, 568, 596), 'patinho': (618, 420, 654, 456),
    'cascas': (160, 10, 800, 690),
}
tres = Image.open(os.path.join(AQUI, 'ref-3d-dia.png')).convert('RGB')
for nome, cx in CAIXAS.items():
    tres.crop(cx).save(os.path.join(R, nome + '.png'))
# o estilo: as poltronas, o sofá, o pufe e o chão do salão (160 × 160)
Image.open(os.path.join(R, 'salao-dia.png')).convert('RGB').crop((400, 420, 560, 580)).save(os.path.join(R, 'estilo.png'))
print('ok')
