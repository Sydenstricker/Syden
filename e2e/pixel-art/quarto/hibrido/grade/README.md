# O teste da grade: um móvel solto, com a luz calculada

A pergunta do teste: um móvel pintado UMA vez, arrastado pela grade do chão, com a luz de cada lugar calculada
por código, convence ao lado da pintura? **Abra `grade.html`**, clique em "Arrumar" e arraste o pufe. Ou veja
`fotos/folha.png`, que tem o original pintado ao lado do pufe solto, em vários lugares, de noite e de dia.

## Como funciona

- **O chão tem uma grade 8×8** (`chao.mjs`). O conceito foi pintado a olho, não com isometria exata: os quatro
  cantos do piso foram medidos, e a grade é interpolada entre eles (`ver-grade.png`).
- **Casas livres** são as que não têm móvel pintado. O pufe ocupa 2×2 casas e só para onde as quatro estão
  livres. Arrastando, ele salta de vértice em vértice, e a área de destino fica acesa.
- **O pufe é recortado da pintura de DIA**, que traz a luz do lugar onde ele estava. Primeiro essa luz é
  tirada, depois entra a do lugar novo, coluna por coluna, na linha do pé:
  - **de dia, a luz da janela é desenhada** (`SOL`, em `montar.mjs`): ambiente mais um foco no chão em frente
    à janela, levemente quente, e o lado do pufe voltado para ela fica mais claro. Não dá para medir na
    pintura de dia, porque nela a luz e a cor do chão (tapete verde × madeira) estão misturadas. A primeira
    versão não tinha isso: de dia o pufe ficava igual em qualquer casa, com a luz do lugar original;
  - **de noite, a luz é medida**: o mesmo sol, vezes a razão noite/dia de cada pixel do chão, suavizada.
    Dividir a noite pelo dia cancela a cor do chão e deixa só a luz (o abajur, o monitor, o escuro).
  - Mais uma sombra de contato no chão.
- **A grade é desenhada em pixel:** um mapa diz a que casa pertence cada pixel do chão, e a borda é onde a casa
  muda. Fica 1 pixel claro com 1 escuro embaixo, para se ler no tapete e na madeira. A primeira versão, com
  linhas suavizadas do canvas, ficava fraca e borrada.
- **"Ver o pufe pintado original"** troca para a pintura de antes, para comparar.

## Como se tirou o pufe das pinturas (`preparar.mjs`)

- **De dia:** repintura com a FORMA do pufe como máscara, 3 px mais larga. Com a caixa inteira, a ferramenta
  desenhou outro pufe; com a forma justa, sobrou o arco escuro da borda.
- **De noite, a repintura falhou duas vezes:** desenhou um pedaço de cama e depois uma cena com abajur (as
  tentativas estão em `falhas/`). A noite foi feita **sem IA**: o tapete de dia, escurecido pela luz da noite
  medida no anel em volta do buraco. É o mesmo princípio do mapa de luz, e ficou sem emenda visível.

## O que se viu

- O pufe solto no lugar original fica quase igual ao pintado. Ele sai um pouco mais frio e cinza, e a sombra de
  contato é mais fraca que a pintada.
- Nos outros lugares, ele escurece e esquenta conforme o chão. A diferença é sutil, porque a luz no chão deste
  quarto é bem uniforme. O teste de verdade será um móvel perto do abajur.

## Custo

31 gerações: cinco repinturas de 6 gerações cada (só a última de dia valeu; as outras falharam) e 1 da remoção
de fundo do pufe. Sobraram 1.556 das 2.000 do mês.

## Tentado e desfeito: mover o brilho pintado por código

O brilho do pufe está pintado no lado de onde vinha a luz na pintura; ao levar o pufe para perto da janela, ele
deveria virar para ela. Tentou-se a técnica dos jogos 2D com luz dinâmica: a forma adivinhada pela silhueta (um
domo), a luz pintada descoberta e tirada, e uma nova acesa vinda da janela ou do abajur. **O pufe virou uma
bolha escura e lisa, e perdeu o desenho** (`falhas/relevo-pela-silhueta.png`). Código genérico de luz destrói o
que faz a pixel art boa. Fica: o código só clareia, escurece e esquenta; a DIREÇÃO do brilho, se for preciso,
vem de versões pintadas (o móvel aceso de um lado e do outro), escolhidas pela posição.
