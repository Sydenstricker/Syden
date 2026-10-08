# O quarto novo: gerado direto em pixel art, com o que se aprendeu

Decidido em 07/10/2026, depois do quarto vazio por código (`../hibrido/vazio/`), que ficou abaixo do ideal: criar
um quarto novo pela API, já como pixel art (não convertida), e com os móveis escolhidos pela FUNÇÃO na home.

## O que se leva dos testes anteriores

- **Pixel art que nasce na grade tem bordas limpas.** O conceito convertido trazia degraus desiguais.
- **Paleta tirada do conceito, não inventada** (`paleta.mjs` → `paleta.png`, 32 cores por k-médias).
- **A casca primeiro** (paredes, chão, friso, janela e porta), depois os móveis, cada um com luz por código
  (só intensidade) e as versões de luz pintadas.
- **Recheio:** o quarto vazio de objetos parece pobre.

## A casca (`casca.mjs`)

| Arquivo | Ferramenta | O que se viu |
|---|---|---|
| `casca/pixellab-1.png` | PixelLab Pro (`generate-image-v2`, conceito como referência), 20 gerações | Limpa: diagonais regulares, tábuas nítidas, porta e janela bem desenhadas. Mais clara e "de jogo" que o conceito, com contorno escuro. |
| `casca/rd-1.png`, `rd-2.png` | Retro Diffusion Pro isométrico, com a paleta do conceito, US$ 0,36 | A paleta imposta deixou tudo laranja e chapado; tábuas com manchas. |

## A rodada de bases (`bases.mjs`, `bases/ver.png`)

O Sydenstricker gostou da casca do PixelLab e pediu para explorar outras bases (a base pesa muito no resultado)
e ver o efeito de resolução maior.

| Base | Ferramenta | O que se viu |
|---|---|---|
| `pl-384` | PixelLab, 384 px, 40 gerações | Limpa e clara; mais detalhe nas tábuas que a de 256. |
| `pl-512` | PixelLab, 512 px, 40 gerações | **Falhou:** seguiu a referência e fez uma carta de jogo com o conceito e um cavaleiro (`bases/falhas/`). |
| `pl-512-sem` | PixelLab, 512 px, SEM referência, 40 gerações | **Boa:** vazia, limpa, com mais detalhe nas tábuas e na janela, e a luz da janela no chão. |
| `pl-512-da-384` | PixelLab, 512 px, com a `pl-384` como referência | **Falhou:** pôs uma arqueira de capuz, um mapa e uma aljava no quarto (`bases/falhas/`). |
| `pl-papel` | PixelLab, 256, papel de parede e fim de tarde | **Falhou:** redesenhou o conceito com uma pessoa na cama; ignorou o "vazio". |
| `pl-noite` | PixelLab, 256, de noite | Boa: quarto vazio noturno, limpo, com céu estrelado. |
| `rd-pro-1`, `rd-pro-2` | Retro Diffusion Pro, 256, sem paleta, US$ 0,36 | Boas e limpas; a 2 tem o chão mais escuro e quente. Sem a paleta imposta, o laranja sumiu. |
| `rd-plus-1`, `rd-plus-2` | Retro Diffusion Plus, 384, US$ 0,12 | Mais chapadas e com menos cara de pixel art. |

| `rd-plus-da-pro1`, `rd-plus-da-pro2` | Retro Diffusion Plus, 384, partindo das Pro (imagem para imagem), US$ 0,24 | Mantêm a composição, mas perdem detalhe; a porta de taverna sumiu. |
| `pl-384-taverna` | PixelLab, 384, com a `rd-pro-1` como referência e a porta de taverna na descrição, 40 gerações | **A melhor até aqui:** porta de taverna com dobradiças de ferro, reboco com textura, e a luz da janela desenhando o caixilho no chão. |

O Retro Diffusion não passa de 384 (o Pro vai até 256; o Plus e o Fast, até 384). Para comparar acima de 512 só
existe o PixelLab, que vai até 512.

**Em 512 px, qualquer referência faz o PixelLab inventar gente** (o cavaleiro, a arqueira): sem referência, ele
obedece ao "vazio". **A referência do conceito puxa demais quando o pedido se afasta dele:** com tamanho ou clima diferentes, o
PixelLab copiou o conceito (com gente dentro) em vez de esvaziar o quarto. O dia e a noite de uma mesma base
precisam sair por EDIÇÃO da escolhida, para terem a mesma geometria.

## Os móveis pela função (confirmados em 08/10/2026)

| Função na home | Objeto |
|---|---|
| Salas de voz | fone com microfone num gancho |
| Quem está em chamada | sofá ou pufes onde os amigos aparecem sentados |
| Amigos | varal de fotos instantâneas |
| Coelhos (escolher o seu) | espelho de corpo inteiro |
| Guarda-roupa | guarda-roupa ou arara de roupas |
| Novidades | jornal no capacho, ou calendário de parede |
| Caixa de ideias | caixinha de correio, ou cortiça com lâmpada |
| Explorar | a porta |
| Mini-games | TV com videogame |
| Dia e noite | abajur |
| Plantar cenoura | vaso de cenouras |
