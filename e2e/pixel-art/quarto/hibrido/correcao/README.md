# As bordas quebradas: de onde vêm, e o que não resolve

Uma linha diagonal bem feita em pixel art tem degraus regulares (dois para o lado, um para cima, sempre iguais).
As bordas do quarto têm degraus desiguais. **É erro, não estética:** o conceito do ChatGPT não foi desenhado numa
grade exata, e o `unzoom`, ao encaixá-lo em 313 px, cria degraus maiores onde a grade "escorrega" (comparação em
`../ver-borda.png`: no conceito a borda já não é perfeita, e na conversão fica pior).

**A correção do PixelLab (`/correct-pixelart`, 0,1 geração) não resolve** (`ver.png`, forças 0,1 e 0,3): os degraus
continuam desiguais, e ela ainda achata um pouco a cor (a coberta perde detalhe).

O que resolve: redesenhar por código as linhas LONGAS da estrutura (o friso do topo das paredes, a quina, o
rodapé, a borda do chão) com degraus exatos. É nelas que o olho vê a quebra; dentro dos objetos, a mesma
irregularidade passa por textura. Fica para quando o quarto vazio estiver pronto, que é onde essas linhas moram.
