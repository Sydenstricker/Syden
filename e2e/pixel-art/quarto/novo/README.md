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

## Os móveis pela função (proposta, a confirmar)

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
