# O personagem que vive no ambiente

Decidido pelo Sydenstricker em 14/10/2026 (ver "Os coelhos vivem nos ambientes", no CLAUDE.md): o quarto do início e
o salão da comunidade são ISOMÉTRICOS e modulares, e os coelhos andam, sentam, deitam e usam os móveis conforme o que
a pessoa está fazendo de verdade. **Um personagem primeiro (o mascote), validado, depois os outros.**

Este arquivo é o FORMATO, escrito antes da arte, para a arte já nascer encaixando.

## A escala (medida, `escala.png`)

O coelho do recado colado no quarto modular (base de 512 px) em 64, 82 e 100 px de altura. **~80 px de pé** fica na
proporção do conceito: a cama o comporta deitado, o pufe chega à cintura. 64 parece filhote; 100 enche o quarto.

- **Quadro de 96 × 96**, o mesmo para todo coelho e toda animação.
- **O pé é a âncora:** o ponto (48, 90) do quadro fica no ponto do chão da casa. Trocar de coelho não mexe na cena.
- Pixel art não encolhe (desfaz o rosto, lição do lobby): ele NASCE nesse tamanho.

## As direções

A câmera olha o quarto pela quina da frente. Só as quatro DIAGONAIS servem (andar pela grade isométrica é sempre na
diagonal da tela):

| direção | o que se vê | usado em |
|---|---|---|
| sudeste / sudoeste | de frente, 3/4 | parado, falando, sentado, andando para a frente |
| nordeste / noroeste | de costas, 3/4 | no computador, no fliperama, andando para o fundo |

**Nada espelhado:** espelhar troca o lado da luz (a lição da poltrona). As quatro são geradas.

## As animações (o mínimo para validar o mascote)

| animação | direções | quadros | repete | quando |
|---|---|---|---|---|
| parado (respirando) | 4 | 4–8 | sim | sempre que não está fazendo nada |
| andando | 4 | 6–8 | sim | indo de um ponto a outro |
| falando (gesto) | sudeste, sudoeste | 4–8 | sim | está falando na call |
| sentado | sudeste, sudoeste | 4 | sim (respira) | pufe, poltrona, sofá |
| deitado lendo | a da cama | 4 | sim | à noite, à toa |
| dormindo | a da cama | 4 | sim | ausente |
| no computador | nordeste, noroeste | 4–8 | sim | em call / transmitindo |

Ficam para depois de validar: acenar (alguém chegou), comer cenoura, jogar fliperama, assistir com pipoca.

## Como cada coisa mora em arquivo

```
personagem/<coelho>/personagem.json   o quadro, o pé, e a lista: { animação: { direções, quadros, fps, repete } }
personagem/<coelho>/<animação>-<direção>.png   uma faixa horizontal de quadros 96 × 96
```

**Os pontos são do MÓVEL** (no json de cada peça do quarto modular), relativos à casa e à orientação dele:

```
{ "id": "sentar", "casa": [du, dv], "pose": "sentado", "olha": "sudoeste", "frente": "poltrona-frente.png" }
```

Girar a poltrona troca `olha`; arrastá-la leva o ponto. `frente` é a camada desenhada POR CIMA do coelho (o braço da
poltrona, a borda do cobertor): o coelho fica entre o móvel e a frente dele.

**A ordem de desenho** é a da grade (quem está mais à frente cobre quem está atrás), e o coelho entra nela pela casa do
pé, como mais um móvel.

**Andar** é pela grade de 8 × 8, desviando das casas ocupadas (busca simples, sem física).

## O comportamento (o estado real decide)

| estado | quarto (o seu coelho) | salão (a turma) |
|---|---|---|
| à toa | anda e para; à noite lê na cama | anda entre os lugares livres |
| em call | no computador, com o fone | — (o salão é a call) |
| falando | gesticula onde estiver | gesticula |
| assistindo transmissão | — | sentado, virado para a TV |
| em mini-game | — | no fliperama |
| ausente | dorme na cama | dorme no sofá |
| clicou num objeto | anda até ele, e então a função abre | — |

Movimento reduzido no sistema: o coelho aparece já no lugar, sem andar.

## A ordem do trabalho

1. **A estrutura, sem arte nova** (página de teste do quarto modular): pontos nos móveis, andar pela grade, ordem de
   desenho, camada da frente, regras de estado, com um coelho provisório.
2. **O mascote no PixelLab** (`create-character-pro`, 8 direções, quadro 96, referência: o coelho do recado, com um
   pedaço do quarto como estilo): só as 4 direções paradas. Ele julga.
3. **As animações**, uma de cada vez, começando por andar e sentar (`characters/animations`).
4. **As camadas da frente** dos móveis de sentar e deitar (repintura `inpaint-v3`).
5. Validado: os outros coelhos com a mesma receita, e o salão isométrico com o mesmo sistema.
