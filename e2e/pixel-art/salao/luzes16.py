# AS LUZINHAS À PARTE (relato dele, 16/10/2026: "a janela está passando por cima das luzes"): o cordão pendurado no alto
# das paredes está pintado na casca (casca16.py), e a janela e os objetos da parede, compostos sobre a casca, o cobriam.
# Aqui sai a MÁSCARA dele (as lâmpadas, o brilho em volta e o fio), e o motor (quarto/novo/quarto/montar.mjs) copia
# esses pixels da casca de volta por cima de tudo o que vai na parede.
#   python e2e/pixel-art/salao/luzes16.py   → luzes16.png (branco onde há luzinha)
import os
import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, label

AQUI = os.path.dirname(os.path.abspath(__file__))
a = np.array(Image.open(os.path.join(AQUI, 'base16.png')).convert('RGB')).astype(int)
H, W, _ = a.shape
ys, xs = np.mgrid[0:H, 0:W]
casas = np.abs(512 - xs) / 27.0
h = 253 + 14.25 * casas - ys  # a altura acima do chão, na parede
r, g, b = a[..., 0], a[..., 1], a[..., 2]
# A arte é de paleta: a lâmpada são duas cores que só existem nela (f9d65f, fdf9db), e o miolo do fio é quase preto
# (no tijolo, preto assim quase não há). Na faixa do cordão: da lâmpada mais baixa (uns 167 px acima do chão) até a linha
# de baixo da cornija (202 px, que fica de fora: ela é da parede, e passaria por cima da janela), e só as 16 casas de
# cada parede (a quina de fora é escura).
faixa = (h > 158) & (h < 201.5) & (np.abs(512 - xs) <= 432)
cor = (r << 16) | (g << 8) | b
lampada = faixa & np.isin(cor, [0xf9d65f, 0xfdf9db])
miolo = faixa & (r + g + b < 45)
# em volta do miolo, o contorno escuro do fio e o soquete da lâmpada (um pixel)
viz = binary_dilation(lampada | miolo, structure=np.ones((3, 3)))
m = lampada | miolo | (viz & faixa & (r + g + b < 140) & ~lampada)
# os pontinhos soltos no tijolo (uma fresta preta sem lâmpada nem fio em volta) saem
rot, n = label(m, structure=np.ones((3, 3)))
fica = (np.bincount(rot.ravel()) >= 6) | (np.bincount(rot.ravel(), weights=lampada.ravel()) > 0)
fica[0] = False
m = fica[rot]
print('pixels:', int(m.sum()))
Image.fromarray((m * 255).astype(np.uint8)).save(os.path.join(AQUI, 'luzes16.png'), optimize=True)
