# O piloto do caminho 3D: o mascote do Meshy, animado no Blender

Feito em 30/10/2026. É o passo "primeiro o piloto com o mascote" do caminho decidido em 18/10 (PixelLab para a base,
Meshy para o 3D, Blender para animar, ver CLAUDE.md). O modelo é `e2e/3D/Personagens/mascote.glb`, gerado pelo Meshy a
partir de `../../mascote/conceito.png` (de frente, braços para baixo, ainda NÃO a pose A).

## O que abrir

| arquivo | o que é |
|---|---|
| **`no-salao.png`**, `no-salao-noite.png` | **abrir primeiro:** no chão do salão, no tamanho de verdade (3×): o PixelLab parado, e o 3D parado, andando e varrendo |
| `parado.gif`, `andando.gif`, `varrendo.gif` | as 4 diagonais no chão do salão, em 3×, a 12 desenhos por segundo. No `andando.gif`, a 1.ª coluna é o andando do PixelLab |
| `comparar.png` | por direção: o PixelLab parado, o 3D parado, 4 desenhos andando e 4 varrendo |
| `<animação>-<direção>.png` | as faixas de 120 × 120 por desenho, no formato do `../../README.md` |
| `animacoes.json` | desenhos por animação, fps e a âncora do pé por direção |
| `mascote.blend` | a cena (o modelo com o esqueleto e os pesos), para abrir e mexer à mão |

| script | o que faz |
|---|---|
| `mascote.py` | importa o modelo, põe o esqueleto, faz as animações e renderiza (480 px, 4 diagonais) |
| `rodar.ps1` | roda o `mascote.py` no Blender da Store e espera. `SO=andando` faz só uma; `VISTAS=frente:0,lado:90` troca as direções (para conferir) |
| `pos.py` | do render à pixel art: paleta do mascote, contorno, linha por dentro, faixas, GIFs e salão |

Ordem: `powershell -File rodar.ps1` (~2 min) e depois `python pos.py` (~20 s).

## Como foi feito

- **O modelo:** uma malha só (~5.300 vértices fechadas as costuras), textura 2048, sem esqueleto. Levado à altura 8,4 do
  coelho de 18/10, olhando para -Y: a câmera, a âncora e a escala dos renders antigos valem igual (sai com 93 px de
  altura, contra 90 do PixelLab).
- **O esqueleto** é o do `coelho.py` (raiz, quadril, tronco, cabeça, orelhas, braço e antebraço, pernas), posto nas
  medidas do modelo. **Os pesos** são os automáticos do Blender, corrigidos por região: orelha só acima da testa, braço
  só fora do flanco, perna só abaixo da barra do moletom. Sem isso, o braço arrastava o moletom.
- **A cor** é a da textura vezes 3 degraus de luz (a mesma direção fixa, do lado da janela), mais um tico de roxo nos
  escuros. O pós prende tudo à paleta tirada do próprio desenho do PixelLab, então o mascote do 3D usa as cores dele.
- **O ritmo:** 12 desenhos por segundo ("em dois"). Parado 16, andando 8, varrendo 8, cada um um ciclo que repete.

## O que se aprendeu

1. **O Meshy resolve o que o coelho de elipsoides não resolvia:** no salão, o 3D parado fica quase igual ao desenho,
   e o rosto, o capuz e as mangas vêm do modelo. A vassoura sai idêntica em todos os desenhos, como em 18/10.
2. **Este corpo não segura a vassoura com as duas mãos.** O braço tem 1,35 do ombro à mão e a barriga sai 1,85 para a
   frente: as mãos não se encontram na frente do corpo. A primeira rodada esticava a manga e amassava o moletom. Ficou
   **uma mão, do lado, com o cabo quase em pé**, e o outro braço balançando. Isso é PROPORÇÃO, não falta de técnica:
   animação que pega coisa com as duas mãos na frente do corpo (bandeja, caixa) vai esbarrar no mesmo limite em todos os
   coelhos chibi, e a pose A não muda o comprimento do braço.
3. **A pose A ainda vale para os outros 16:** com os braços colados ao corpo, a malha do braço e a do moletom se
   encostam, e os pesos precisaram de corte à mão. Com os braços afastados, os pesos automáticos acertariam sozinhos.
4. **Falta ver no motor:** este piloto mostra os quadros e o salão em imagem, não o coelho andando pela grade do salão
   de verdade. É o próximo passo, se ele aprovar: ligar as faixas ao `montar.mjs`, com a âncora do `animacoes.json`.
