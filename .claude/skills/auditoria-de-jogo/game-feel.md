# O checklist de game feel do Syden

Escrito em 25/11/2026 por nós, inspirado na lista de momentos do Game Feel Prompts (game-feel-prompts.pages.dev, os
nomes das 92 coleções, que são públicos). O texto e os números daqui são NOSSOS: os prompts pagos deles não podem ser
repassados, e não estão aqui. Partículas prontas: a biblioteca pixelfx (MIT, `web/src/vendor/pixelfx/`, ver o ORIGEM.txt);
tremor, pausa no acerto e piscar: `web/src/impacto.ts`; sons: `web/src/somDosJogos.ts`.

Para cada momento que a mudança tocou, responda sim ou não. Cada "não" é uma sugestão no relatório.

## As regras que valem para todo item

- **Só desenho.** Nada de game feel mexe no passo da simulação, nas duas cópias da regra ou no que vai ao servidor. A
  pausa no acerto congela o DESENHO.
- **"Menos movimento"**: sem tremor, sem zoom, sem câmera balançando. Piscar e partícula pequena podem ficar.
- **Sem foco, nada se mexe** (`useJanelaComFoco()` / `document.hasFocus()`).
- **Proporção:** o efeito cabe no personagem. O coelho chibi tem ~45 px; um clarão de 200 px num soco comum é ruído.
- **Hierarquia:** o golpe comum é pequeno, o forte é maior, o final é o maior. Se tudo explode, nada pesa.
- **Sem texto quando o desenho basta** (a regra das animações): "+1" e números servem; frases não.

## Os momentos

**Dar um golpe / acertar**
- [ ] O acerto tem um sinal NO PONTO do contato (faísca, estrela), não só no corpo?
- [ ] Há pausa no acerto (40–90 ms) nos golpes que importam, e não no soco comum de uma sequência rápida?
- [ ] O alvo reage: pisca, recua, amassa (squash) por um instante?
- [ ] O som sai no ACERTO, não no começo do golpe?
- [ ] O golpe forte se distingue do fraco pelo tamanho do efeito e pelo som?

**Levar dano**
- [ ] Quem levou pisca (e fica intocável o tempo do piscar, se a regra tiver isso)?
- [ ] A barra de vida mostra o pedaço perdido por um instante antes de descer (o "atraso")?
- [ ] O tremor de levar é menor que o de dar, e some com "menos movimento"?

**Derrotar um inimigo**
- [ ] Ele sai com um desenho de saída (fumaça, dissolver, piscar e sumir), sem sangue?
- [ ] O que ele deixa (ponto, item) aparece e vai para algum lugar (o placar, o chão)?
- [ ] O último inimigo da onda/fase tem um fecho maior que os outros?

**Coletar (moeda, cenoura, item, cura)**
- [ ] Há um brilho no lugar e o objeto "vai" para o contador (ou um "+1" sobe)?
- [ ] Vários seguidos sobem de tom ou contam um combo?
- [ ] A cura sobe "+" verde/menta em cima de quem curou?

**Pular, pousar, correr, arrancar (dash), esquivar**
- [ ] Poeira no pulo e no pouso; o pouso forte amassa o personagem um instante?
- [ ] A arrancada deixa rastro (imagens fantasma ou linhas de velocidade)?
- [ ] A esquiva mostra que deu certo (piscar, fantasma)?

**Combo, sequência, multiplicador**
- [ ] O número do combo dá um "soco" ao subir e muda de cor por faixa?
- [ ] Perder o combo tem um sinal (o número cai/apaga), sem bronca?

**Explosão, quebrar objeto, tiro**
- [ ] Explosão: clarão curto, anel, fumaça que sobe e some?
- [ ] Objeto quebrado: lascas que caem e param no chão?
- [ ] Tiro: clarão no cano, recuo pequeno, faísca onde bate?

**Largada, contagem, fim**
- [ ] A contagem bate cada número (cresce e some) e o "vai" é o maior?
- [ ] Vitória: confete ou pódio, o coelho de quem ganhou comemora?
- [ ] Derrota: a tela esmaece sem humilhar; o "jogar de novo" está à mão?

**Subir de nível, meta, recorde, medalha, troféu**
- [ ] Há um momento só dele (coluna de luz, estrelas, som de medalha), sem interromper a partida no meio?
- [ ] O recorde novo é dito uma vez, no fim, e não a cada quadro?

**Interface do jogo (HUD)**
- [ ] O que mudou no placar pulsa um instante quando muda?
- [ ] A barra de recarga mostra que encheu (brilho), sem precisar de texto?
- [ ] O botão de toque reage ao dedo (afunda, acende)?

## Os momentos que ainda não temos nenhum jogo usando

Ficam como ideia, para quando couber: virar carta (Truco, Dominó), abrir baú (Masmorra), crescer a planta (Tabuleiro),
mordida do peixe, faíscas da derrapagem (Corrida), puxar o ímã de XP.
