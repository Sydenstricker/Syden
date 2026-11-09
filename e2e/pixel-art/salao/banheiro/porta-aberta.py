# A PORTA DO BANHEIRO ABERTA na parede do salão (09/11/2026): a opção escolhida de porta-aberta.mjs (aberta/aberta-<n>.png) entra
# na peça da porta SÓ dentro da máscara da folha (o batente e o resto ficam os da fechada, pixel a pixel), e vira
# parede-salao/porta/peca-aberta-dia.png e -noite.png (iguais, como as da fechada: a noite do salão é feita pelo motor), com
# "aberta": true no item.json. O motor (montar.mjs) a mostra no instante em que a porta abre, antes de a vista ir ao banheiro.
#   py -3 e2e/pixel-art/salao/banheiro/porta-aberta.py [n]
import json, os, sys
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
PORTA = os.path.join(AQUI, '..', '..', 'quarto', 'novo', 'quarto', 'parede-salao', 'porta')
N = sys.argv[1] if len(sys.argv) > 1 else '1'
CAIXA, FOLGA = (352, 163), (10, 10)  # as mesmas de porta-aberta.mjs
peca = np.array(Image.open(os.path.join(PORTA, 'peca-dia.png')).convert('RGBA'))
aberta = np.array(Image.open(os.path.join(AQUI, 'aberta', f'aberta-{N}.png')).convert('RGBA'))
mascara = np.array(Image.open(os.path.join(AQUI, 'aberta', 'mascara.png')).convert('L')) > 127
nova = peca.copy()
ys, xs = np.nonzero(mascara)
nova[ys - FOLGA[1] + CAIXA[1], xs - FOLGA[0] + CAIXA[0], :3] = aberta[ys, xs, :3]
nova[ys - FOLGA[1] + CAIXA[1], xs - FOLGA[0] + CAIXA[0], 3] = 255
for q in ('dia', 'noite'):
    Image.fromarray(nova, 'RGBA').save(os.path.join(PORTA, f'peca-aberta-{q}.png'), optimize=True)
item = json.load(open(os.path.join(PORTA, 'item.json'), encoding='utf8'))
item['aberta'] = True
json.dump(item, open(os.path.join(PORTA, 'item.json'), 'w', encoding='utf8'), ensure_ascii=False)
print(item)
