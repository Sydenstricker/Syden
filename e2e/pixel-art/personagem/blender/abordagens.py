# A FOLHA DAS ABORDAGENS (rodada 2, 18/10/2026): a mesma direção e os mesmos quadros para todas, em 3×.
# Linhas: o mascote do PixelLab (parado; ele não tem "varrendo"), a rodada 1, A (modelo melhorado), B (desenho do
# PixelLab projetado no modelo) e C (à t3ssel8r: direto em 120, quinas claras e escuras). Colunas: parado + 8 quadros.
# Uso: python abordagens.py [direção]   (padrão: south-west, a que mostra o rosto e a vassoura)
import os, sys
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
D = sys.argv[1] if len(sys.argv) > 1 else 'south-west'
LINHAS = [
    ('PixelLab', os.path.join(AQUI, '..', 'mascote', 'baixa-120', f'{D}.png'), None),
    ('rodada 1', os.path.join(AQUI, 'v1', f'parado-{D}.png'), os.path.join(AQUI, 'v1', f'varrendo-{D}.png')),
    ('A modelo', os.path.join(AQUI, f'parado-{D}.png'), os.path.join(AQUI, f'varrendo-{D}.png')),
    ('B projecao', os.path.join(AQUI, 'projecao', f'parado-{D}.png'), os.path.join(AQUI, 'projecao', f'varrendo-{D}.png')),
    ('C t3ssel8r', os.path.join(AQUI, 'c', f'parado-{D}.png'), os.path.join(AQUI, 'c', f'varrendo-{D}.png')),
]
ROT = 70
folha = Image.new('RGBA', (ROT + 120 * 9, 120 * len(LINHAS)), (90, 90, 110, 255))
g = ImageDraw.Draw(folha)
for k, (nome, parado, faixa) in enumerate(LINHAS):
    g.text((6, 120 * k + 54), nome, fill=(235, 230, 240, 255))
    folha.alpha_composite(Image.open(parado).convert('RGBA'), (ROT, 120 * k))
    if faixa:
        folha.alpha_composite(Image.open(faixa).convert('RGBA'), (ROT + 120, 120 * k))
folha.resize((folha.width * 3, folha.height * 3), Image.NEAREST).save(os.path.join(AQUI, 'abordagens.png'))
print('ok')
