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
| `montar.mjs` | As áreas de clique, os nomes, o coelho e o gato recortados | `node e2e/pixel-art/quarto/hibrido/montar.mjs` |

O quarto inteiro, do conceito ao dia, gastou umas 75 gerações.

## Como funciona a página

- **Cada móvel clicável é um polígono** sobre a pintura (`OBJETOS`, em `montar.mjs`). Ele acende um contorno e
  mostra o nome ao passar o mouse ou com Tab.
- **O coelho e o gato são as únicas peças soltas:** o que mudou entre o conceito e o quarto sem eles. Eles
  respiram (um pixel, em degrau) e pulam quando cutucados.
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

## Falta

- **O coelho e o gato de dia:** hoje são recortes da noite, clareados por filtro, e trazem manchas da sombra
  noturna. O certo é pintar a versão de dia deles também.
- O vaso de cenouras, de novo.
- Os polígonos foram marcados a olho: alguns pegam um pouco além do objeto.
- Mais vida: piscar, virar a página, o rabo do gato, o vapor da caneca.
