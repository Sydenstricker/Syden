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

## Rodada de 08/10/2026, à noite (pedidos dele)

- **Estante → guarda-roupa.** A estante saiu embutida na parede duas vezes. No lugar, o guarda-roupa, que é da lista de
  móveis pela função (a aba "Guarda-roupa").
- **O tapete pronto.** Repintado, ele veio mais uma vez com um quarto em miniatura em cima. O recorte bom da rodada
  anterior (mesma base, mesmo lugar) ficou em `prontas/` e entra direto (`pronto` em `lista.mjs`).
- **A luz azul no travesseiro estava errada.** À noite, cada pixel de móvel pegava a luz da parede ATRÁS dele, e atrás
  do travesseiro estava a parede no luar. Agora o móvel pega a luz do chão no pé de cada coluna, e o abajur esquenta os
  móveis em volta (uma luz suave que cai com a distância, só nos móveis; o fundo continua com a luz pintada).
- **Dois pontos brancos no friso:** dois pixels creme na borda de fora (156,68 e 379,80), encostados no fundo. Pixel
  claro com dois vizinhos de fundo ganha a cor do contorno.
- **As quatro vistas têm noite** (`../janela/vista-noite-<n>.png`, por edição de cada uma).

## A janela interativa e os consertos da mesma noite

- **Clicar na janela:** no vidro, abre e fecha a janela; nas cortinas, abre e fecha as cortinas (também pelos botões).
  - **Cortina fechada** (`cortina.mjs`): a região da janela repintada com as cortinas de linho fechadas, de dia e de
    noite. Fechada, a vista some, o desenho do luar sai do chão e, de dia, o quarto escurece um pouco.
  - **Janela aberta** (`janela-aberta.mjs`): as folhas abertas para dentro e o vão pedido em **magenta puro**, que vira
    a máscara da vista: a paisagem continua trocável com a janela aberta. A noite dela é a de dia vezes a luz da
    noite; a pintada tinha outras folhas, que pulariam ao trocar dia e noite (`falhas/`).
- **A luz do abajur estava estranha:** a repintura da noite redesenhou o criado-mudo uns pixels ao lado, e a cúpula
  acesa desse fantasma virava uma mancha laranja junto da nossa. Repintada com o criado-mudo FORA da máscara.
- **O guarda-roupa saía cortado no topo** (a máscara cortava). Agora ele é AVULSO (`avulso.mjs`, ideia dele):
  gerado inteiro, sem fundo, com um pedaço do quarto como referência de estilo; posto no lugar (o pé da frente no
  canto da casa, a profundidade medida na lateral desenhada) e repintado só na forma, para a luz daqui.
- O teste do X das transmissões (`e2e/fechar-na-faixa.mjs`) rodou e passou, com o `sob-demanda` junto.

## Mais uma rodada (08/10/2026, de madrugada)

- **O topo do guarda-roupa saía sem contorno:** a repintura "só na forma" redesenhou a cornija mais lisa. O avulso
  agora fica com o DESENHO dele e só a LUZ da repintura (`reluzir` em `moveis.mjs`: cada pixel vezes a razão
  borrada entre o quarto repintado e o quarto com o avulso só posto).
- **Retângulo de luz na cortina fechada:** de dia, o quarto escurecia menos a região da janela; agora escurece por
  igual.
- **Duas cortinas na ponta da direita:** a cortina aberta original descia além da região repintada. Uma segunda
  repintura cobre só esse canto (`BARRA` em `cortina.mjs`).
- **Girar:** a poltrona (`avulso.mjs`, duas orientações PINTADAS da mesma poltrona de orelha, e não espelhadas,
  porque espelhar inverteria o lado da luz) se arrasta pela grade como o pufe, e o botão Girar (ou a tecla R) troca a
  orientação. Arrasta-se o que está sob o ponteiro; chão vazio não move ninguém. Num quadro de 72 × 88 ela saiu menor
  que o pufe (`avulsos/pequenas/`). Uma das duas veio com sombra pintada; a página a tira, e as duas usam uma
  sombra de contato no chão.

## Custo

157 gerações, mais da metade em tentativas que falharam (o pufe sozinho levou umas 60, porque as versões derivadas
eram refeitas a cada nova tentativa do pufe do meio). A rodada da noite (guarda-roupa, tapete que falhou, pufes, as
três noites das vistas) custou mais 76. A janela interativa e os consertos (luz do abajur, guarda-roupa avulso, pufes refeitos) custaram
mais 68. A rodada da poltrona, da cortina e das máscaras do híbrido custou mais 64. Em 08/10/2026 **restam 493 das 2.000** do mês.

## A janela móvel (15/10/2026, pedido dele)

- **A janela virou peça.** `janelas/sem-janela.py` tira a janela da pintura: a parede da direita é a da esquerda
  espelhada (o quarto é simétrico), vezes a razão de cor medida nos pedaços lisos que a janela deixava ver; de noite, o
  chão inteiro é o dia vezes a luz da noite (um polinômio da razão, sem o luar), e o luar vira MÁSCARA + um ganho de cor.
- **Os tipos** (`janelas/tipos.mjs`): em arco, redonda e com floreira, pintados na parede vazia com o vidro em magenta
  puro. A redonda veio duas vezes com o "quarto em miniatura" e uma vez cortada (`falhas/`); saiu na quarta. A noite deles
  é o dia vezes a luz da noite do lugar, e o luar é PROJETADO do vidro na direção da luz medida na janela original.
- **A página** (`aplicarJanela` em `montar.mjs`) monta a base, as noites, a cortina e a janela aberta com a peça onde
  ela estiver: ao longo da parede é deslocar, na outra parede é espelhar, e cada pixel ganha a luz do lugar novo. A
  janela se arrasta pelas duas paredes (de meia em meia casa); clicar sem arrastar abre a janela ou a cortina. Só a
  original tem cortina e abre. Fotos: `node janelas/fotografar.mjs`.

## A visita (15/10/2026)

- A arrumação (móveis, cadeira, janela, cortina, vista) vai ao servidor (`PUT /api/quarto`) a cada mudança, quando se
  entra numa conta pelo painel "Conta no servidor (teste)". Visitar é `GET /api/quarto/<número da conta>`: o quarto da
  pessoa como ela deixou, só para olhar (nada se arrasta, gira ou se guarda; nem no navegador de quem visita).
- Teste: suba a API de teste (`PORT=3099 CORS_ORIGIN=http://localhost:5181 INVITE_CODE=teste`, banco novo) e rode
  `node visita.mjs`: a Ana arruma, o Zeca visita e vê igual, não consegue mexer, e volta ao quarto dele.

## O recheio e as funções (15/10/2026, pedido dele)

- **Objetos da parede** (`parede/itens.mjs` pinta, `parede/pecas.py` recorta): fone, quadro de fotos, cortiça,
  prateleira e pintura. Andam pelas duas paredes e sobem e descem, como a janela; os botões embaixo põem e guardam
  (posto, vai ao primeiro lugar livre; com a parede cheia, onde cobre menos). O fone e o quadro saíram cortados na
  primeira (`falhas/`). O recorte pega o que mudou muito e a borda dele, e fecha os buracos (o branco das fotos tem a cor
  da parede).
- **Plantas** (`avulso.mjs`): uma monstera alta e uma samambaia, o mesmo desenho nas 4 posições. **A mesa enfeitada**
  (`estado.mjs`, 25 gerações): o mesmo objeto, com plantinha e livros no tampo.
- **As funções** da home de hoje moram nos objetos: fone → Salas, quadro → Amigos, cortiça → ideias, guarda-roupa →
  Guarda-roupa (quando as portas abrem), janela (o vidro) → Explorar, abajur → Dia e noite, mesa/cadeira → Mini-games. O
  nome aparece ao passar o mouse. Na página de teste, o botão "Funções do app" as liga, e o clique só conta o que faria.
  Teste: `node parede/testar.mjs`.
