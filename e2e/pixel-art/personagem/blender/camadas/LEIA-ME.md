# O piloto das camadas em 3D (09/11/2026)

O pedido dele: "vamos estender o piloto para 3D para avaliar os resultados, antes de mudar as regras". Aqui se testa
**poucos corpos base + acessórios avulsos presos ao osso**, contra a regra de hoje ("um modelo por coelho"). A regra não
mudou: é ele quem decide, vendo isto.

## O que abrir

| arquivo | o que é |
|---|---|
| `folha-3d.png` | o render 3D: mascote (em cima) e orelha caída (embaixo); sem nada, boné, bandana e os dois, de sudeste e de frente |
| `folha-3d-lado-e-costas.png` | o mesmo de lado e de costas (o boné de perfil e o nó da bandana) |
| `bone-2d-e-3d.png` | o boné: em cada diagonal, o 2D e o 3D em pixel art colados; no fim, o 3D de lado e de costas |
| `corpo-antigo-e-novo.png` | o mascote da malha em T e o corpo novo, sem acessório, em 3D e em pixel art |
| `ver-novo.html` | o GLB de teste do corpo novo |
| `folha-pixel.png` | em pixel art: por corpo, o 2D do piloto (PixelLab + camadas) em cima e o 3D embaixo, sudeste e noroeste |
| `mascote-parado.gif`, `mascote-andando.gif`, `orelha-caida-*.gif` | com os dois acessórios, nas 4 diagonais, no chão do salão |
| `no-salao.png` | no chão do salão, no tamanho de verdade: 2D e 3D lado a lado |
| `ver.html` | o GLB de teste com botões (corpo, boné, bandana, parado/andando). Abre direto do disco; o three.js vem da CDN |

## O corpo novo e o boné do Meshy (09/11/2026)

- **`meshy/corpo-mascote.glb`**: o mascote refeito no Meshy com as orelhas afastadas (decisão dele: "vamos usar um corpo do
  Meshy feito com as orelhas mais afastadas"). Veio em T, sem esqueleto, 13,5 mil vértices (7,9 mil fechadas as costuras),
  textura 4096. `MALHA=novo` no `rodar.ps1` usa ele, com as medidas dele (`MEDIDA_NOVO`, no `camadas.py`, posto nas
  `MEDIDAS` do `mascote.py` sem mexer no arquivo), e sai em `saida-novo/`. O corpo se chama `mascote-novo`.
- **`meshy/bone.glb`**: o boné do Meshy. Entra INTEIRO, só na escala (`canonico_do_bone` no `cena.py`: a boca no z = 0, a aba
  para -Y, que é como ele veio), e o `alvo_2d.py` mede o encaixe com os pontos dele (`saida*/bone-meshy.npy`).
- Ordem completa: `ETAPA=medir` nas duas malhas, `rodar.ps1` nas duas, `pos.py`, `alvo_2d.py`, e de novo `rodar.ps1` nas
  duas e `pos.py`.

## Como rodar

    powershell -File rodar.ps1      # ~1,5 min: monta, encaixa, renderiza e exporta saida/coelho-camadas.glb
    py -3 pos.py                    # ~40 s: pixel art, folhas, GIFs e o ver.html
    py -3 para_meshy.py             # as imagens de entrada do Meshy (para-meshy/)

`camadas.py` lê o `../meshy/mascote.py` sem mexer nele (troca a pasta de saída e põe um gancho antes do render) e roda o
`cena.py`. `ETAPA=medir` só grava as medidas (`saida/medida-*.npz`); `SO=pixel|anim|normal|glb` faz uma parte.

## Como o encaixe é medido (nada à mão por corpo)

- **Boné (desde a decisão dele de 09/11/2026: "o boné nos coelhos de orelha em pé deve seguir o design do 2D"):** o
  `alvo_2d.py` mede o boné do 2D (as camadas) nas 4 diagonais, em relação ao pescoço e à largura da cabeça, leva para a
  tela do 3D e procura onde o boné senta, a inclinação, o tamanho e a aba cuja silhueta, pela câmera do render, mais
  coincide com a do 2D. O tamanho vem da largura do boné no 2D (as diagonais da frente). A orelha pode ter a base dentro
  da metade de trás do boné, mas não pode furar a copa nem a aba pela frente. Grava `saida/alvo-bone-<corpo>.json` e a
  conferência `saida/alvo-bone-<corpo>.png` (vermelho: só o 2D; azul: só o 3D; branco: os dois). Ordem: `ETAPA=medir
  powershell -File rodar.ps1`, `py -3 pos.py`, `py -3 alvo_2d.py`, e de novo `rodar.ps1` e `pos.py`. `BONE=busca` volta à
  busca antiga, descrita a seguir.
- **Boné, a busca antiga (sem o alvo do 2D):** a cabeça é a esfera que melhor passa pelo crânio (os vértices pesados na cabeça). O boné procura o eixo
  (0° a 48° para a frente) e a altura da boca; a boca tem o tamanho do corte da cabeça ali (ele assenta). Vale o maior,
  até 86% do raio da cabeça, em que a cabeça acima da boca fica dentro, a beira da frente não desce até os olhos, e:
  orelha em pé → nenhum ponto da orelha dentro dele (com folga); orelha caída → a orelha acima da boca fica dentro (ela
  sai por baixo, dos lados). Preso rígido ao osso da cabeça. O resultado de cada corpo fica em `saida/encaixe.json`.
- **Bandana:** o pescoço é onde a cabeça acaba; a faixa e o triângulo seguem o raio da malha em cada direção e altura,
  com folga, e o nó vai atrás. Ela veste a pele: cada vértice leva os pesos dos 6 vértices do corpo mais perto, e segue o
  tronco e a cabeça como o corpo.
- **Orelha caída:** a MESMA malha do mascote, com um segundo osso em cada orelha (orelha2). A base torce 80° (a face rosa
  vira para a cabeça), desce pela lateral do crânio, sai 25° e a ponta cai mais 140°, esticada 30%.

## Para o Meshy (image-to-3D)

As imagens estão em `para-meshy/`. Em cada uma: **Image to 3D**, sem esqueleto (sem "rig"), **GLB**, textura **2k**.
Salve com estes nomes, nesta pasta:

| imagem | salvar como | o script faz |
|---|---|---|
| `para-meshy/corpo-mascote.png` | `meshy/corpo-mascote.glb` | **o primeiro a gerar** (decisão dele, 09/11/2026): o mascote com as orelhas AFASTADAS, para o boné caber entre elas como no 2D. No Meshy, pedir a pose A (braços abertos); substitui a `mascote-t.glb` depois de medido (ver abaixo) |
| `para-meshy/bone.png` | `meshy/bone.glb` | entra no lugar do boné provisório, levado à caixa medida em cada corpo. Imagem refeita em 09/11/2026 (`acessorio-avulso.mjs`): o boné sozinho, grande e com detalhe; a antiga, recortada do sprite, está em `para-meshy/antigas/` |
| `para-meshy/bandana.png` | `meshy/bandana.glb` | entra no lugar da bandana provisória, na caixa dela, com os pesos da pele |
| `para-meshy/corpo-orelha-caida.png` | `meshy/corpo-orelha-caida.glb` | (ainda não: ver abaixo) |
| `para-meshy/corpo-musculoso.png` | `meshy/corpo-musculoso.glb` | (ainda não: ver abaixo) |

Depois: `powershell -File rodar.ps1` e `py -3 pos.py`. O acessório do Meshy é posto de frente para -Y (como o corpo); se
vier girado, é um giro a acrescentar em `importar_meshy`, no `cena.py`.

- A bandana da camada 2D é um pedaço visto de 3/4, sem o nó: o Meshy pode errar a forma. Se errar, o **Text to 3D**
  ("a small rust red triangular bandana scarf tied around the neck with a knot at the back, low poly, stylized") ou ficar
  com a provisória, que já veste bem.
- **Os corpos do Meshy ainda não entram sozinhos:** o esqueleto do `mascote.py` é posto por medidas à mão (`MEDIDAS`).
  Para cada corpo novo é preciso medir os pontos (ombro, cotovelo, mão, orelhas, pernas, cortes dos pesos), como foi feito
  na malha em T; daí em diante o boné e a bandana se encaixam sozinhos.
