"""
O coelho do Pulo do coelho (03/11/2026): os quadros do MASCOTE 3D, de três quartos para a direita (o sudeste), reduzidos
para a tela de plataforma. Sai uma folha só, web/public/plataforma/coelho.png, com 9 quadros lado a lado: os 8 do
andando (baixa-120/animacoes/andando-v3/south-east-0..7) e o parado (baixa-120/south-east.png). Para a esquerda, o jogo
espelha a folha.

O perfil puro (leste) não serve: a câmera do mascote é alta, e de lado ele aparece de costas. De três quartos ele mostra o
rosto e ainda anda para a direita, como os heróis dos jogos de 16 bits desenhados um pouco de frente.

Rodar da raiz do repositório:  py web/scripts/plataforma-coelho.py
"""
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
ORIGEM = RAIZ / 'e2e/pixel-art/personagem/mascote-3d/baixa-120'
SAIDA = RAIZ / 'web/public/plataforma/coelho.png'
ESCALA = 0.34

quadros = [Image.open(ORIGEM / f'animacoes/andando-v3/south-east-{i}.png').convert('RGBA') for i in range(8)]
quadros.append(Image.open(ORIGEM / 'south-east.png').convert('RGBA'))

# a mesma caixa para todos (senão o coelho pula de um quadro para o outro)
caixas = [q.getbbox() for q in quadros]
x0 = min(c[0] for c in caixas)
y0 = min(c[1] for c in caixas)
x1 = max(c[2] for c in caixas)
y1 = max(c[3] for c in caixas)
w = round((x1 - x0) * ESCALA)
h = round((y1 - y0) * ESCALA)

folha = Image.new('RGBA', (w * len(quadros), h), (0, 0, 0, 0))
for i, q in enumerate(quadros):
    p = q.crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS)
    # sem meio-transparente: pixel art tem borda dura
    px = p.load()
    for yy in range(h):
        for xx in range(w):
            r, g, b, a = px[xx, yy]
            px[xx, yy] = (r, g, b, 255) if a >= 110 else (0, 0, 0, 0)
    folha.alpha_composite(p, (i * w, 0))

SAIDA.parent.mkdir(parents=True, exist_ok=True)
folha.save(SAIDA)
print(f'{SAIDA.relative_to(RAIZ)}: {len(quadros)} quadros de {w} x {h}')
