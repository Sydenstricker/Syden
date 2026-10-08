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
| `pl-512` | PixelLab, 512 px, 40 gerações | **Falhou:** seguiu a referência e fez uma carta de jogo com o conceito e um cavaleiro. |
| `pl-papel` | PixelLab, 256, papel de parede e fim de tarde | **Falhou:** redesenhou o conceito com uma pessoa na cama; ignorou o "vazio". |
| `pl-noite` | PixelLab, 256, de noite | Boa: quarto vazio noturno, limpo, com céu estrelado. |
| `rd-pro-1`, `rd-pro-2` | Retro Diffusion Pro, 256, sem paleta, US$ 0,36 | Boas e limpas; a 2 tem o chão mais escuro e quente. Sem a paleta imposta, o laranja sumiu. |
| `rd-plus-1`, `rd-plus-2` | Retro Diffusion Plus, 384, US$ 0,12 | Mais chapadas e com menos cara de pixel art. |

**A referência do conceito puxa demais quando o pedido se afasta dele:** com tamanho ou clima diferentes, o
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
