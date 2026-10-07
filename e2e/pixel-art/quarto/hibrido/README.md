# O quarto híbrido: o cenário pintado inteiro, com poucas peças vivas

O segundo caminho para o quarto, e o que ficou melhor. **Abra `quarto.html`.** Ou veja `foto-noite.png` (com
as áreas de clique acesas) e `foto-dia.png`.

## Por que mudou o método

As peças geradas uma a uma (a pasta de cima) ficaram muito abaixo do conceito. **A resolução não era o
problema:** reduzido à mesma resolução, o conceito continua bonito (`../comparacao-resolucao.png`). A diferença
estava em luz, nas sombras entre os objetos e o chão, numa mão só para tudo, e no recheio. Peças geradas
separadas perdem as quatro coisas.

Então o cenário é **o próprio conceito** (o Sydenstricker liberou usá-lo como arte final), convertido para
pixel art de verdade, e o PixelLab repinta só o que precisa mudar, no estilo do próprio quadro.

## Os passos

| Arquivo | O que é | Como |
|---|---|---|
| `conceito-unzoom.png` | O conceito na grade de pixels dele: 313 px | `/unzoom` do PixelLab (`converter.mjs`), 0,1 geração |
| `passo1-sem-coelho.png` | A cama sem o coelho e o gato, que viram peças à parte | repintura (`pintar.mjs`) |
| `passo2-cortica.png` | O quadro da parede direita virou quadro de cortiça (Caixa de ideias) | repintura |
| `noite.png` | A planta da mesinha da frente virou vaso de cenouras | repintura |
| `dia.png` | O mesmo quarto, de dia | edição do quarto inteiro (`edit-images-v2`) |
| `objetos.mjs` | O que se clica, a caixa de cada objeto e a dica para a remoção de fundo | — |
| `mascaras/` | A forma de cada objeto e das peças vivas, tirada do quadro | `/remove-background` (`mascaras.mjs`), 1 geração cada |
| `montar.mjs` | Os contornos, os nomes, o clique, o coelho e o gato | `node e2e/pixel-art/quarto/hibrido/montar.mjs` |

O quarto inteiro, do conceito ao dia, gastou umas 75 gerações.

## Como funciona a página

- **Cada objeto clicável tem uma máscara** do próprio desenho, tirada do quadro pela remoção de fundo do PixelLab
  (modo de fundo complexo, com uma dica do que é o objeto). Ao passar o mouse, ganha um contorno de 1 pixel do
  quarto em volta da forma, como em jogo, e o nome aparece. O clique testa a máscara: só acerta onde há objeto.
  Com Tab, um botão invisível em cada caixa acende o mesmo contorno.
- **O coelho e o gato são as únicas peças soltas,** recortados do conceito pela mesma remoção de fundo e postos
  sobre a cama vazia. Respiram da cintura para cima (a metade de cima desce um pixel, a de baixo fica) e pulam
  quando cutucados. O primeiro recorte, por diferença entre o conceito e a cama vazia, pegava pedaços da coberta
  e fazia o cenário em volta tremer junto: trocado.
- **Dia e noite são duas pinturas**, trocadas com transição. A luz real do abajur e da janela fica pintada, e
  não vira uma camada por cima.

## O que se aprendeu

- **A repintura nova (`inpaint-v3`) exige o plano Tier 2.** O Pro Flash, que o Tier 1 cobre, repinta numa
  janela de até 256 px. A janela precisa ter pelo menos 128 px, porque o contexto (o quarto inteiro) pode
  ter no máximo 3× o tamanho dela.
- **Um bug meu parecia fila lenta:** o script perdia o número do trabalho depois da primeira consulta e
  ficava perguntando por um inexistente. Corrigido nos dois scripts. A conversão `image-to-pixelart-pro`
  que "travou" caiu nesse mesmo bug, e não foi refeita.
- **O vaso de cenouras saiu fraco:** a planta quase não mudou. Vale repintar com uma caixa maior.
- **A pintura de dia "acendeu" dois quadros:** o rosa da cortiça e o laranja do quadro de paisagem estouravam
  ao trocar de horário (medido por máscara: 13% e 18% dos pixels saltavam de saturação). `harmonizar.mjs` tira
  saturação SÓ dos pixels que estouram e mantém a cor do dia; o original ficou em `dia-bruto.png`. Trazer a
  cor da noite inteira deixava o quadro arroxeado.
- **A remoção de fundo falha em quadro de parede** se a dica descreve só o que está pintado nele: o pôster
  voltou só com a cara do coelho. Dizer "o quadro inteiro, com a moldura" e usar o modo simples resolveu
  (as falhas ficaram em `mascaras/falhas/`).

## Falta

- **O coelho e o gato de dia:** hoje são recortes da noite, clareados por filtro, e trazem manchas da sombra
  noturna. O certo é pintar a versão de dia deles também.
- O vaso de cenouras, de novo.
- Mais vida: piscar, virar a página, o rabo do gato, o vapor da caneca.
