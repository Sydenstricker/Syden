# O teste: a base com móveis, e a luz

A pergunta, de 08/10/2026: se evoluirmos uma base da pasta `novo/`, pondo os móveis e a luz, chegamos perto do
conceito do ChatGPT? A base escolhida para o teste foi a **`pl-512-sem-1`**. A `pl-384-taverna` tem cara de taverna,
e o Sydenstricker a guardou como possível skin temática futura. **Abra `teste.html`**, ou veja `fotos/`. A primeira
versão, com os defeitos que ele apontou, está em `v1/`.

**A direção, decidida por ele no mesmo dia:** o conceito convertido tem a melhor qualidade até aqui
(`../../hibrido/quarto.html`), mas não deixa mudar nada. Para skins, variações e móveis trocados, o caminho de longo
prazo é este processo, por etapas.

## Como os móveis foram feitos (`moveis.mjs`, `pintar.mjs`)

- **Cada móvel é pintado DENTRO da base,** com o repintar do PixelLab (`inpaint-image-pro-flash`, 6 gerações) e o
  quarto inteiro como contexto. Assim ele sai com a mesma mão, a luz da janela e a sombra no chão.
- **A ordem importa:** quem é pintado depois não pode invadir quem já está lá. Na v1 o criado-mudo veio antes e
  espremeu a cabeceira da cama. Agora: cama, criado-mudo, estante, tapete (`lista.mjs`).
- **A máscara é o pé do móvel na grade, erguido até a altura dele** (`chao.mjs`; desenho em `ver-pes.png`). Com uma
  caixa solta, a ferramenta desenhou móveis pequenos num quarto grande (`falhas/`). A altura decide o tamanho: a
  estante da v1, limitada para não cobrir o peitoril, saiu minúscula.
- **O recorte junta duas fontes:** a remoção de fundo do PixelLab (1 geração, guardada em `fundo/` com a caixa usada)
  e a diferença entre os passos, só onde ela é forte e perto do que a remoção manteve. Sozinha, a diferença perde
  madeira sobre madeira e pega tábuas retocadas (os fiapos da v1); sozinha, a remoção de fundo cortou a estante.
- **A sombra vem da diferença:** o que só escureceu, por igual e no chão, vira uma camada à parte
  (`pecas/<id>-sombra.png`), que escurece o que estiver embaixo de onde o móvel for parar.
- **O pufe foi pintado em três lugares** (perto da janela, no meio e na frente): são as três versões de luz.

## O que a página faz (`montar.mjs`)

- **Dia:** os móveis são os recortes. O pufe ocupa 2×2 casas e se arrasta de cruzamento em cruzamento da grade. As
  quatro casas de destino acendem, pintadas pixel a pixel. Ele usa a versão pintada mais perto e ganha só a
  intensidade da luz do lugar novo.
- **Noite:** o fundo é a noite da base (`noite.mjs`, feita por EDIÇÃO: mesma geometria, 25 gerações). Os móveis são a
  cor do dia vezes a razão noite/dia.
- **A luz do abajur, de dois jeitos** (botão na página):
  - **pintada** (`noite-abajur.mjs`, o padrão): o abajur é fixo, fonte de luz como a janela, e a região dele foi
    repintada na noite com ele aceso (6 gerações). A borda da repintura é misturada com a noite em 14 px;
  - **por código:** a cúpula clareia e uma luz quente em faixas cai com a distância.
- O fundo cinza em volta do quarto sai por preenchimento a partir da borda, um para cada versão: a noite, feita por
  edição, tem o contorno 1 ou 2 px diferente.

## O que se viu

- **A qualidade é a da base:** bordas limpas, uma mão só, e os móveis com a luz e a sombra do quarto.
- **A luz por código fica abaixo da pintada.** Em degradê, denuncia o código; em faixas, parece um alvo. A pintada
  tem o desenho de pixel art. Fica o princípio: **luz de fonte FIXA é pintada; o código só leva essa luz aos móveis
  soltos** (pela razão noite/dia).
- **Editar o quarto inteiro para acender o abajur manchou as paredes e apagou o luar**
  (`falhas/noite-abajur-edicao-manchada.png`). A repintura só da região do abajur, não.
- **Ainda longe do conceito em DENSIDADE:** o quarto é grande e os móveis saem em escala real. O conceito é um quarto
  pequeno, cheio de coisas. O que falta é recheio e móveis maiores, não técnica.
- **As versões do pufe saíram de tamanhos diferentes.** Para serem o mesmo móvel, a segunda e a terceira precisam
  partir da primeira.

## A rodada 3 (pedido dele, mesmo dia)

- **A cabeceira parecia mexer entre dia e noite:** quem mexia era o criado-mudo, redesenhado uns pixels ao lado
  na repintura da noite. Agora a noite usa o recorte do dia, escurecido pela luz pintada, e a cúpula acende pelo
  código (laranja). Da pintura fica só a luz na parede e no chão.
- **O pufe não assentava nas casas:** ele era posto pelo centro da caixa PEDIDA, mas foi desenhado deslocado nela.
  Agora a base desenhada (o ponto mais baixo menos meio pufe) vai para o cruzamento da grade.
- **A estante ainda perdia o vaso do topo:** a folga da diferença em volta da remoção de fundo foi de 6 para 12 px,
  e pedaços soltos com menos de 20 px saem.

## Custo

A v1 custou 97 gerações. A v2 (os consertos, a estante de novo e a luz pintada) custou mais 90, incluindo a edição que
falhou (25). Em 08/10/2026 **restavam 1.008 das 2.000 do mês**; depois da base sem porta (`../bases/pl-512-janela-1.png`, 40) e de ~35
perdidas num disparo acidental de `bases.mjs`, **restam 933** (o `/balance` dá o que RESTA).
