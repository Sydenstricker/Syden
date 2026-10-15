# O salão isométrico

Decidido pelo Sydenstricker em 15/10/2026: o salão de frente (`web/src/assets/salao/sala.png`, o `Salao.tsx`) vira
isométrico, no mesmo sistema do quarto (`../quarto/novo/quarto/`). Os créditos do PixelLab estão liberados para ele e
para o que derivar dele. A sala é nova, com o salão de frente como referência ("ele está bem legal"). As pessoas aparecem
com o mascote base até os outros mascotes virarem isométricos (pendência do projeto).

## Etapa A: a arte (15/10/2026)

- **A casca** (`bases.mjs`): o salão vazio, sem janela e sem porta (a janela é peça, como no quarto). Três pedidos:
  tarde, noite e com o salão de frente de referência.
- **A geometria bate com a do quarto:** a mesma largura (de x 40 a 472), o chão 27 px mais baixo e as paredes uns
  33 px mais altas. As janelas e os objetos da parede do quarto servem aqui com um deslocamento só.
- **Os móveis** (`moveis.mjs`), a receita do quarto: avulso com a base de referência, e as vistas giradas do mesmo
  objeto. A lista vem do salão de frente: sofá de canto, TV no rack, fliperama, balcão do bar, banqueta, estante e mesinha.
  Do quarto: as plantas, a poltrona e os objetos da parede.

## Etapa B: o motor dos dois ambientes (a fazer)

O motor do quarto (`../quarto/novo/quarto/montar.mjs`) tem UM coelho e os móveis do quarto escritos no código. Para
servir o salão:

1. **A cena como configuração:** a casca, os cantos do chão, os móveis e o que cada um faz (sentar, ficar de pé na
   frente, deitar), a altura das paredes. O quarto vira uma cena; o salão, outra.
2. **Vários coelhos:** um por pessoa na call (o mascote base, com o nome em cima), mais o do balcão (o recado). Os
   lugares saem dos pontos dos móveis (o sofá tem vários assentos); o estado de cada pessoa decide onde ela fica (quem
   transmite, na TV; quem joga, no fliperama).
3. **As funções do salão** (as do `Salao.tsx`): TV → voz (e "Ao vivo"), fliperama → mini-games, estante → canais, janela →
   chamar alguém, quadro → a imagem da comunidade.
4. **A arrumação é da comunidade:** quem administra arruma, e ela mora no servidor (como `quartos`, por comunidade).
5. **No app,** como o quarto: só no desenvolvimento, até ele lançar.
