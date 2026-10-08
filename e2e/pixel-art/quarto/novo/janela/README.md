# A janela com vista

Pedido do Sydenstricker em 08/10/2026: ele adorou a base sem porta (`../bases/pl-512-janela-1.png`), mas a janela
era só vidro. A do conceito tem vista, e isso dá charme. **Abra `janela.html`.**

## Como é feito

- **A vista fica ATRÁS do vidro, não pintada nele.** O vidro da base foi pintado numa cor só, (250, 243, 224), e
  `vidro.mjs` acha essa cor dentro do caixilho (`vidro.png`; conferência em `ver-vidro.png`). Ali, a página põe a
  paisagem, pixel por pixel, com um véu leve da cor do vidro. Assim a vista troca com a hora e, um dia, por tema,
  ou com nuvens andando.
- **As paisagens são geradas à parte** (`vista.mjs`, PixelLab, 128 × 160): quatro de dia numa chamada (16
  gerações). **A noite é a EDIÇÃO da de dia** (a vista 1): o mesmo lugar, com lua, estrelas e as janelas da vila
  acesas.
- **A vista é espelhada:** a lua fica no alto à direita da imagem, e ali o vidro começa mais embaixo (a janela
  segue a inclinação da parede). Espelhada, ela cai nas vidraças de cima.
- **A noite do quarto é montada:** editar a base para a noite manchou a parede da esquerda duas vezes (`falhas/`).
  O chão (com o luar desenhado) e a janela com as cortinas vêm da primeira edição (`noite-pintada.png`); as
  paredes são o dia vezes a luz MÉDIA dessa noite, bem borrada, só com os pixels do quarto, o que guarda o
  degradê e apaga as manchas. Cantos do chão medidos em `regua.png`.

## Custo

76 gerações: as quatro vistas de dia (16), a noite da vista (10) e as duas noites da base (25 cada). Em 08/10/2026
**restam 858 das 2.000** do mês.
