# Tentativa 3: esvaziar o conceito por partes (falhou)

Pedido do Sydenstricker em 08/10/2026: tentar de novo esvaziar o quarto do conceito convertido (`../../noite.png`),
com até umas 60 gerações, para comparar com a base gerada direto em pixel art (`../../../novo/teste/`).

**O método:** um móvel (ou um grupo) por vez, com a repintura do PixelLab (`inpaint-image-pro-flash`, 6
gerações) só na caixa dele, pedindo parede ou chão vazio. Cada passo parte do anterior (`esvaziar.mjs`). As
tentativas 1 (edição do quarto inteiro) e 2 (reconstrução por código) estão em `../README.md`. Lado a lado em
`ver.png`: o conceito, o passo 3 e o último.

## O que aconteceu

| Passo | Resultado |
|---|---|
| 1. Quadros da parede esquerda | **Bom.** Saíram, e a parede continuou com a luz do abajur. Ficaram fantasmas leves de dois quadrinhos. |
| 2. Cortiça e prateleira da direita | A cortiça saiu. **A prateleira com planta foi repintada igual.** |
| 3. Prateleiras, pedindo para tirar | A da esquerda saiu, com a parede manchada. A da direita ficou: a janela de repintura (no máximo 256 px) cortou a caixa dela. |
| 4. Cama | **Falhou:** pintou outra cama no lugar, quase igual. |
| 5 a 8. Criado-mudo, mesinha, escrivaninha, armarinho | **Falharam:** pedaços de cama, de mesa e de cadeira redesenhados, cada um num retângulo com emenda visível. |
| 9. Tapete | **Falhou:** no lugar do tapete, uma cama e uma cadeira novas. |

## Por quê

- **O resto do quarto ensina o modelo a desenhar móvel.** O contexto é um quarto cheio. Pedir "chão vazio" ali
  rende o que o resto da imagem sugere: cama, cadeira, tapete. Na parede funcionou porque os objetos de parede
  são pequenos e há muita parede limpa em volta para copiar.
- **A repintura volta como um retângulo inteiro,** e não só a área da máscara. Por isso cada passo deixa uma
  emenda: a luz e o tom do retângulo não casam com a pintura em volta.

## Conclusão

Com isso, **as três formas de esvaziar o conceito falharam** (edição inteira, código e por partes). O caminho que
se sustenta é o da base gerada já vazia, em `novo/`, com os móveis pintados dentro dela.

## Custo

57 gerações, em nove repinturas (pelo saldo antes e depois). Em 08/10/2026 **restam 1.041 das 2.000** do mês.
