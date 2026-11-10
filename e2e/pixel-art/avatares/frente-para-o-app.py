# OS COELHOS INTEIROS DO APP (10/11/2026, pedido dele: "estamos usando os 16 com maior qualidade que refinamos ontem?").
#
# Copia a foto de frente ESCOLHIDA de cada coelho pronto (frente/escolhidas.json → frente/coelho-NN-K.png, 128 × 192) para
# web/public/avatares/coelho-NN-inteiro.png, sem a borda vazia (o recorte pelo alfa). O nome é estável: trocar a escolha
# no json e rodar de novo troca a imagem do app sem mexer no código. É o corpo que a Aparência (aba Avatar) mostra no
# carrossel (enderecoDoCorpoPronto, em web/src/Avatar.tsx). O salão de frente continua com os coelho-NN-corpo.png de
# 34 × 51 (CORPOS em web/src/Salao.tsx: o tamanho deles é a medida do salão).
#
#   py -3 e2e/pixel-art/avatares/frente-para-o-app.py
#
# Os PNGs de web/public/avatares/ pedem `git add -f` (o .gitignore pega *.png).
import json
from pathlib import Path

from PIL import Image

AQUI = Path(__file__).resolve().parent
FRENTE = AQUI / 'frente'
DESTINO = AQUI.parent.parent.parent / 'web' / 'public' / 'avatares'

escolhidas = json.loads((FRENTE / 'escolhidas.json').read_text(encoding='utf-8'))
for nn, arquivo in sorted(escolhidas.items()):
    img = Image.open(FRENTE / arquivo).convert('RGBA')
    caixa = img.getchannel('A').getbbox()
    if not caixa:
        raise SystemExit(f'{arquivo}: imagem vazia')
    recorte = img.crop(caixa)
    saida = DESTINO / f'coelho-{int(nn):02d}-inteiro.png'
    recorte.save(saida, optimize=True)
    print(f'{arquivo} -> {saida.name} ({recorte.width} x {recorte.height})')
