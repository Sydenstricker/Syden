# O quarto do coelho, na base sem porta

Decidido pelo Sydenstricker em 08/10/2026: **a base é a `pl-512-janela-1`** (sem porta, janela grande com vista). Os
móveis do teste (`../teste/`) foram passados para ela. **Abra `quarto.html`.** Os botões trocam dia e noite, mostram a
grade, trocam a luz do abajur (pintada ou por código) e a paisagem da janela. O pufe se arrasta pelo chão.

## Como foi feito

- **Os móveis** (`moveis.mjs`, `lista.mjs`, `pintar.mjs`): o método do teste. Cada um é pintado dentro da base, na
  máscara do pé dele na grade (`chao.mjs`, cantos medidos em `../janela/regua.png`), e recortado. A parede da
  direita é quase toda janela, então a cama e a estante ficam na esquerda e o criado-mudo no canto do fundo.
- **O pufe tem três versões do MESMO pufe.** O do meio veio do teste, posto no lugar pela base desenhada dele. As
  outras duas partem dele: o pufe posto no lugar e repintado só na forma dele (3 px de folga), para ganhar a luz
  de lá. No teste, pintadas soltas, as três saíam de tamanhos diferentes.
- **A noite** (`noite.mjs`) é a montada de `../janela/`: chão e janela da pintura, paredes por código. A luz do
  abajur é pintada (`noite-abajur.mjs`), com a borda da repintura misturada na página.
- **A vista** (`../janela/`) entra nos pixels do vidro, espelhada, e troca com a hora.

## O que deu errado no caminho (`falhas/`)

- **Nesta base, a ferramenta desenha um "quarto em miniatura" dentro de áreas pequenas.** Aconteceu no tapete e três
  vezes no pufe: cama, criado-mudo e cortina copiados do resto do quarto. A máscara em cubo do pufe parece um quarto, e
  o pedido dizia "matching the room". Saídas: "ONLY ... nothing on it" no tapete; e, no pufe, não pintar (trazer o do
  teste) e tirar a palavra "room" do pedido das versões.
- **A primeira cama saiu pequena e com um banquinho;** a segunda, com outra semente (`semente` em `lista.mjs`), saiu
  limpa. A mesma entrada dá sempre a mesma saída, então repetir sem mudar a semente não adianta.
- **A estante sai embutida na parede,** mesmo pedindo "freestanding". A segunda é um nicho arredondado com livros:
  bonito, mas não um móvel solto.

## Custo

157 gerações, mais da metade em tentativas que falharam (o pufe sozinho levou umas 60, porque as versões derivadas
eram refeitas a cada nova tentativa do pufe do meio). Em 08/10/2026 **restam 701 das 2.000** do mês.
