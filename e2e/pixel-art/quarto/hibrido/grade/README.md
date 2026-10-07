# O teste da grade: um móvel solto, com a luz calculada

A pergunta do teste: um móvel pintado UMA vez, arrastado pela grade do chão, com a luz de cada lugar calculada
por código, convence ao lado da pintura? **Abra `grade.html`**, clique em "Arrumar" e arraste o pufe. Ou veja
`fotos/folha.png`, que tem o original pintado ao lado do pufe solto, em vários lugares, de noite e de dia.

## Como funciona

- **O chão tem uma grade 8×8** (`chao.mjs`). O conceito foi pintado a olho, não com isometria exata: os quatro
  cantos do piso foram medidos, e a grade é interpolada entre eles (`ver-grade.png`).
- **Casas livres** são as que não têm móvel pintado. O pufe ocupa 2×2 casas e só para onde as quatro estão
  livres. Arrastando, ele salta de vértice em vértice, e a área de destino fica acesa.
- **O pufe é recortado da pintura de DIA.** De noite, cada coluna dele é multiplicada pela luz do chão embaixo
  do pé. A luz vem do **mapa de luz**: a razão noite/dia de cada pixel do quarto, suavizada. Dividir a noite pelo
  dia cancela a cor do próprio chão (tapete verde ou madeira) e deixa só a luz. Mais uma sombra de contato.
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
