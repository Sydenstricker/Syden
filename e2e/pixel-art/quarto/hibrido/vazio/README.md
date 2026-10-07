# O quarto vazio: a base para os móveis soltos

Os móveis soltos (decidido em 07/10/2026: cada móvel numa grade, com três versões de luz) precisam do quarto
sem nada: só paredes, chão, rodapé e a janela. A janela é fixa: é a fonte da luz do quarto, e a luz está
pintada nas paredes e no chão. O que se troca nela é a aparência (cortina, persiana), nunca o lugar.

## Tentativa 1: edição do PixelLab (falhou)

`esvaziar.mjs`: a pintura inteira editada para "o mesmo quarto, vazio", com 25 gerações cada. Resultado em
`falhas/`. De dia, a cama e o tapete continuaram lá, simplificados; de noite, ficaram fantasmas da cama e do
abajur. E a edição redesenhou o quarto com menos detalhe: parede lisa, piso mais simples, e uma janela
diferente em cada versão. É o mesmo problema de toda edição de imagem inteira: perde-se a mão do conceito.

## Próximas tentativas

1. O mesmo pedido no ChatGPT, que pintou o conceito, feito pelo Sydenstricker e convertido com `unzoom`.
2. Reconstrução por código a partir da própria pintura: a janela intacta, a parede continuada pela cor e pela
   luz visíveis, e o piso repetido de um trecho limpo pela grade.
