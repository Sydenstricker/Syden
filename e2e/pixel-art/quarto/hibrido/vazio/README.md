# O quarto vazio: a base para os móveis soltos

Os móveis soltos (decidido em 07/10/2026: cada móvel numa grade, com três versões de luz) precisam do quarto
sem nada: só paredes, chão, rodapé e a janela. A janela é fixa: é a fonte da luz do quarto, e a luz está
pintada nas paredes e no chão. O que se troca nela é a aparência (cortina, persiana), nunca o lugar.

## Tentativa 1: edição do PixelLab (falhou)

`esvaziar.mjs`: a pintura inteira editada para "o mesmo quarto, vazio", com 25 gerações cada. Resultado em
`falhas/`. De dia, a cama e o tapete continuaram lá, simplificados; de noite, ficaram fantasmas da cama e do
abajur. E a edição redesenhou o quarto com menos detalhe: parede lisa, piso mais simples, e uma janela
diferente em cada versão. É o mesmo problema de toda edição de imagem inteira: perde-se a mão do conceito.

## Tentativa 2: reconstrução por código (`codigo/`, a que valeu até agora)

`codigo/reconstruir.mjs` refaz o quarto a partir da própria pintura, sem IA e sem gerações:

- **ficam intactos** o friso, a moldura de fora e a janela com as cortinas (pela máscara dela);
- **os móveis são caixas marcadas à mão** (`MOVEIS`), e tudo dentro delas é refeito;
- **a parede** vira a cor da parede limpa em volta, numa média contínua de três escalas (de perto, de longe e do
  quarto inteiro), que continua o degradê de luz por trás dos móveis;
- **o chão é desenhado:** tábuas no sentido do piso, a emenda de 1 pixel onde uma encontra a outra, pontas
  desencontradas e uma leve variação de tom, pintadas com a cor e a luz da madeira medidas no chão visível.

Resultado em `codigo/noite.png` e `codigo/dia.png` (`codigo/ver.png` lado a lado). O que se aprendeu no caminho:

- **Adivinhar pela cor o que é móvel não funciona:** de noite, plantas e sombras passavam por parede; de dia, o
  tapete passava por chão. Caixas marcadas à mão resolveram.
- **Copiar textura da pintura traz lixo junto:** as tábuas copiadas carregavam pedaços do tapete e das rodinhas
  da cadeira, e a parede copiada fazia listras com a borda dos móveis. Desenhar as tábuas e deixar a parede lisa
  (como a pintada é) ficou melhor.
- **Média com limiar faz faixas** (curvas de nível na parede). A mistura contínua de escalas, não.
- **A parede pode ficar sem nenhuma referência por perto:** no pé da parede direita, mesa, armarinho, prateleira e
  fone cobriam tudo, e saía preto. A escala do tamanho do quarto resolve.

A geometria (os cantos do chão e das paredes) foi medida em `codigo/regua.png` e `codigo/cantos.png`. Ela ainda
não foi passada para a grade (`../grade/chao.mjs`), que usa os cantos antigos.

## Ainda possível

O mesmo pedido no ChatGPT, que pintou o conceito, convertido com `unzoom`. Fica como comparação, se a
reconstrução não agradar.
