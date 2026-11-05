# Os minijogos do Mario Party 3, e o que dá para trazer ao Syden

Pesquisa de 05/11/2026, a pedido do Sydenstricker: *"Faça uma coleta dos minijogos do Mario Party 3. Tinha um de caça que eu
adorava, acho que era Ace High. Mapeie os minijogos que dê para implementar."*

O Mario Party 3 (Nintendo 64, 2000) tem **71 minijogos**: 20 de quatro jogadores, 10 de um contra três, 10 de dois contra
dois, 8 de batalha, 10 de duelo, 6 de item, 3 raros e 4 do Game Guy (cassino).

As duas regras de sempre valem para tudo o que está aqui:

- **Só a mecânica.** Nada de nome, personagem, desenho ou som da Nintendo. Os nomes originais aparecem neste documento só
  como referência; as versões propostas são com coelhos, horta e o que já temos.
- **A rede decide.** Servidor na Alemanha, turma no Brasil, uns 200 ms de ida e volta. Cabe bem o que cada um joga **na
  própria tela** e o servidor compara, ou o que é **por turnos**. O que pede contato ao vivo entre jogadores (empurrar,
  disputar a mesma bola, pegar o mesmo objeto) fica caro ou ruim.

## Resumo: os 10 melhores candidatos, em ordem

| # | Original | A nossa versão | Por quê | Esforço |
|---|---|---|---|---|
| 1 | **Aces High** | **Duelo de aviõezinhos**: coelhos em teco-tecos atirando cenouras teleguiadas uns nos outros | É o favorito dele, e dá para fazer funcionar com 200 ms (ver a seção abaixo). Reaproveita a rede da corrida na sala | Grande |
| 2 | Pipe Cleaners | **Praga na toca**: as pragas saem das tocas e cada um bate com o martelo | O "acerte a toupeira" que todo mundo entende na hora. Cada um na própria tela, as mesmas pragas para todos. Microjogo da Festa | Pequeno |
| 3 | Tick Tock Hop | **Pula o ponteiro**: o ponteiro do relógio da horta varre o chão e é preciso pular na hora certa | Uma tecla, tensão crescente, quem errar primeiro perde. Perfeito para a Festa | Pequeno |
| 4 | Hide and Sneak | **Esconde-esconde na horta**: três se escondem (moita, toco, regador, casinha) e um procura | Por turnos, então a rede não atrapalha, e rende conversa na voz ("eu sabia que você ia no toco!") | Pequeno |
| 5 | The Beat Goes On | **Tambor da turma**: cada um repete as batidas de todos e acrescenta uma | Por turnos, cresce com a turma, e cada um toca na própria tela (o ritmo é medido lá, não pela internet). Só efeito de tambor, sem música | Médio |
| 6 | Rockin' Raceway | **Corrida de cavalinho de pau**: alternar duas teclas no ritmo, sem esgotar o fôlego, pegando as cenouras de turbo | Corrida de apertar botão com um pouco de estratégia (o fôlego). Cada um na sua pista, como o kart | Pequeno |
| 7 | Chip Shot Challenge | **Uma tacada só**: todos dão UMA tacada para a toca, ganha quem parar mais perto | A física do Minigolfe já existe e já é conferida pelo servidor. Quase de graça | Pequeno |
| 8 | Awful Tower | **A torre do celeiro**: subir por blocos que sobem e descem, desviando das ferramentas que caem | Usa o motor do Pulo do coelho, com os fantasmas dos outros subindo ao lado | Médio |
| 9 | Curtain Call / Messy Memory | **Quem dançou em terceiro?** / **Arrume a despensa** | Jogos de memória: baratos, sem reflexo, bons para quem não joga videogame | Pequeno |
| 10 | Slap Down / Crowd Cover | **Bate quando der a flor** / **Quem está atrás da multidão?** | Reação e observação, uma tecla, errar elimina. Entram na Festa como mais duas rodadas | Pequeno |

**Dois grupos que valem um comentário à parte:**

- **Os seis minijogos de item** (Winner's Wheel, Hey Batter Batter, Bobbing Bow-loons, Dorrie Dip, Swinging with Sharks,
  Swing 'n' Swipe) são todos "um toque no tempo certo". Sozinhos são finos demais para a Festa, mas servem como **casa
  especial do Tabuleiro da turma**: quem para nela joga um desses para ganhar cenouras ou um bônus.
- **Os quatro do Game Guy são cassino** (apostar todas as moedas e dobrar ou perder). Ficam de fora pela regra já decidida:
  "clonar só a mecânica de jogo, nunca a de cassino".

## Aces High, o jogo de "caça" que ele lembra

**A lembrança bate.** O nome certo é **Aces High** (com "s"; em espanhol saiu como "Ases del Aire", em alemão
"Wolkengefecht", "combate nas nuvens"). E o "jogo de caça" faz todo sentido: é uma batalha de **aviões de caça**.

**Como funciona o original:**

- **Quatro jogadores, cada um num aviãozinho**, voando numa arena fechada, vista de cima, por 60 segundos.
- **Controles:** a alavanca guia o avião, A acelera, B freia, Z dá o tiro normal, e **segurar e soltar Z** lança um **míssil
  teleguiado** (uma "bala" que persegue o avião mais próximo).
- **Só um míssil por vez:** depois de lançar, só se lança outro quando ele acerta alguém ou some.
- **O único jeito de fugir do míssil** é fazer uma curva fechada na borda da arena (encostar na borda dá um instante de
  invencibilidade, e a dica dos jogadores é usar isso).
- **Cada um aguenta dois acertos**; no terceiro, cai. **O último no ar ganha.** Se o tempo acaba com mais de um no ar, ganha
  quem tem mais vida; vida igual é empate.

### Como fazer a nossa versão funcionar com 200 ms

O problema: num duelo aéreo, o que eu vejo do avião do outro está sempre uns 100 a 200 ms atrasado. Se o servidor decidir
sozinho quem foi atingido, ou a vítima "leva tiro depois de já ter desviado", ou o atirador "acerta na tela e não conta".
Avaliei três caminhos:

**Opção 1 — Duelo de verdade, cada um voa no próprio computador, e QUEM LEVA DECIDE. (Recomendada.)**

- Cada um pilota o próprio avião no próprio computador, sem atraso nenhum. Os outros aparecem suavizados, como os karts
  da corrida na sala: o servidor dá a largada e só repassa as posições, 15 por segundo.
- **O tiro é um evento**, com o instante e o ponto de onde saiu. Todo computador desenha o mesmo tiro, com a mesma conta.
- **Quem decide se foi atingido é quem leva**, no computador dele, contra a posição verdadeira dele. É exatamente o que já
  fazemos com o repolho e a lama do kart. A vítima avisa, e o tiro some na tela de todos.
- **Por que isso casa tão bem com este jogo em particular:** a arma principal é o **míssil teleguiado**, que é lento e
  persegue. Na tela da vítima, ele a persegue de verdade, e ela desvia ou não desvia com o próprio avião, sem atraso. O
  atirador vê a explosão uns 0,2 s depois, e num míssil que vem fazendo curva ninguém percebe esse atraso.
- **O tiro reto é o ponto fraco**: rápido e pequeno, ele é onde o "acertei e não contou" apareceria. Duas saídas: fazê-lo
  lento e gordo (uma ervilha, não uma bala), ou tirá-lo e deixar só o míssil, com a recarga mais curta. Eu iria na ervilha
  lenta e testaria na tela.
- **Contra trapaça:** quem leva poderia mentir que não levou. O servidor tem as posições que ele mesmo repassou, e o míssil
  é uma conta conhecida, então ele **refaz a perseguição** e confere (como já confere o voo das pragas na Caça e a bola no
  Minigolfe). Mentira que ele não consegue provar passa, e entre amigos isso é aceitável, como ficou decidido no kart.
- **No Solo:** contra 1 a 3 aviões do computador, como os robôs dos jogos de mesa, rodando no próprio navegador (sem atraso
  nenhum).
- **A batalha de balões do kart, que está a caminho, resolve o mesmo problema** (acertar o outro com itens). Vale construir
  as duas sobre a mesma peça de rede.

**Opção 2 — Todos caçam alvos, ninguém atira em ninguém.** Corvos e balões no céu, cada um com a sua cópia, pontos por
abate. Não há problema de rede nenhum, mas **perde a graça do original** (o duelo entre amigos) e repete a Caça às pragas.
Fica como modo extra, se tanto.

**Opção 3 — O servidor decide tudo, com a "folga" da Briga** (quem atira tem razão, conferido pelo passado do alvo, e quem
leva tem uma janela para escapar). Funciona para socos, que têm preparação longa, mas num duelo aéreo rápido gera muita
discussão de "eu já tinha desviado". Pior que a opção 1.

**A forma proposta, com coelhos:** **Duelo de aviõezinhos.** Coelhos em teco-tecos de madeira sobre a horta vista de cima,
pixel art desenhada por código. O míssil teleguiado é uma **cenoura-foguete**, o tiro normal é **ervilha**. Três corações
(dois acertos e cai no terceiro), 60 segundos, o último no ar ganha. Na Festa não cabe (é jogo inteiro); vai para as duas
abas da estante, como o kart, e o pódio para a estante de troféus.

**Esforço: grande**, mas menor do que parece, porque a largada pelo servidor, o repasse das posições, a interpolação e os
itens decididos por quem leva já existem na corrida (`server/src/minijogo-corrida.ts`, `web/src/corrida/laco.ts`).

## A tabela completa

**Como ler a classe:**

- **A** — cabe como microjogo da Festa dos coelhos (rodada rápida de "prepare-se, jogo, revelação"). Barato.
- **B** — cabe como jogo próprio, ou reaproveitando um motor que já existe (kart, plataforma, minigolfe, blocos, briga).
- **C** — só funciona com contato ao vivo entre jogadores; caro, ou ruim com 200 ms.
- **D** — não serve: depende de controle específico do N64, é sorte pura sem graça, é cassino, ou depende de personagem.

A "versão do Syden" só está preenchida para A e B. Quando o original é de equipe e a versão proposta é individual, a
linha diz.

### Quatro jogadores (20)

| Original | Como funciona | Classe | Versão do Syden | Esforço |
|---|---|---|---|---|
| Treadmill Grill | Esteiras que encolhem; derrubar os outros com socos e pisões, o último em pé ganha | C | — | — |
| Ice Rink Risk | Desviar de cascos que deslizam num rinque de gelo por 30 s | A | **Repolhos no gelo**: desviar dos repolhos rolando no lago congelado; os mesmos repolhos para todos, cada um na sua cópia | Médio |
| Parasol Plummet | Descer de guarda-chuva pegando moedas jogadas, desviando de martelos | A | **Chuva de cenouras**: descer de folha-guarda-chuva pegando cenouras e fugindo das pedras; mesma chuva para todos | Médio |
| Messy Memory | Devolver os objetos bagunçados ao lugar certo da prateleira | A | **Arrume a despensa**: ver a prateleira, ela é bagunçada, recolocar cada pote | Pequeno |
| Picture Imperfect | Parar cada parte do rosto (olhos, nariz, boca) na hora certa para montar o retrato | A | **Retrato do coelho**: parar orelhas, olhos e focinho na hora certa | Pequeno |
| M.P.I.Q. | Perguntas sobre a série; quem aperta primeiro responde; três acertos ganha | A | **Quiz relâmpago**, com perguntas nossas; cada um responde na própria tela e conta o tempo de cada tela | Médio (as perguntas, nos 80 idiomas) |
| Curtain Call | Decorar a ordem dos dançarinos e dizer quem estava em tal posição | A | **Quem dançou em terceiro?**: coelhos, raposas e corvos dançam no palco e somem | Pequeno |
| Cheep Cheep Chase | Apertar muito para nadar e mergulhar na hora das bombas, fugindo de um peixe gigante | A | **Fuga do rio**: nadar fugindo do lúcio e mergulhar sob os troncos | Pequeno |
| Snowball Summit | Rolar bolas de neve para empurrar os outros do pico | C | — | — |
| Toadstool Titan | Quem acha o cogumelo cresce e esmaga os outros | C | — | — |
| **Aces High** | Duelo de aviões com tiro e míssil teleguiado; dois acertos e cai no terceiro | C no original, **B adaptado** | **Duelo de aviõezinhos** (ver a seção acima) | Grande |
| Bounce 'n' Trounce | Pular sobre bolas numa plataforma que se desfaz, derrubando os outros | C | — | — |
| Chip Shot Challenge | Uma tacada de golfe para a ilha; ganha quem para mais perto do buraco | A | **Uma tacada só**, com a física do Minigolfe (o servidor já a refaz) | Pequeno |
| Mario's Puzzle Party | Juntar blocos da mesma cor que caem, estilo Dr. Mario; quem chega a 100 pontos ganha | B | Já coberto pela **Horta em cascata** | Nenhum |
| The Beat Goes On | Cada um repete as batidas anteriores e acrescenta uma; quem errar sai | B | **Tambor da turma**, por turnos; o ritmo medido na tela de quem toca | Médio |
| Water Whirled | Corrida de lancha, cinco voltas; curva rápida demais bate na borda | B | **Corrida de barquinhos** no lago, sobre o motor do kart | Médio |
| Frigid Bridges | Levar três blocos para consertar a ponte de gelo, sem cair na água | B | **A ponte do riacho**: levar três tábuas, na própria cópia, ganha quem termina primeiro | Médio |
| Awful Tower | Subir uma torre de blocos que sobem e descem, desviando de martelos | B | **A torre do celeiro**, no motor do Pulo do coelho, com fantasmas | Médio |
| Pipe Cleaners | Bater com o martelo em quem sai dos canos | A | **Praga na toca**: as mesmas pragas saem para todos, cada um bate na sua | Pequeno |
| Rockin' Raceway | Alternar dois botões para o cavalinho correr, com fôlego e placas de turbo | A | **Corrida de cavalinho de pau**, cada um na sua pista | Pequeno |

### Um contra três (10)

| Original | Como funciona | Classe | Versão do Syden | Esforço |
|---|---|---|---|---|
| Coconut Conk | Os três derrubam cocos no que rola dentro de um barril | C | — | — |
| Spotlight Swim | Os três miram holofotes; o nadador tem de escapar dos três ao mesmo tempo | C | — | — |
| Boulder Ball | O solitário joga pedras nos três que sobem a ladeira | C | — | — |
| Crazy Cogs | O solitário gira a engrenagem onde os três desviam de projéteis | C | — | — |
| Hide and Sneak | Os três se escondem em 4 lugares; o solitário elimina esconderijos em 3 rodadas | B | **Esconde-esconde na horta**, por turnos | Pequeno |
| River Raiders | Barco com os três amarrados atrás, pegando moedas no rio | C | — | — |
| Tidal Toss | O solitário faz ondas; os três pulam para não cair | C | Talvez: a onda leva tempo para chegar e "quem leva decide" caberia; não vale o esforço agora | — |
| Hand, Line and Sinker | O solitário pesca os três, que viraram peixes | C | — | — |
| Ridiculous Relay | O solitário voa de asa-delta; os três fazem um revezamento remando | B | **Revezamento do riacho**: cada parte corre na própria tela, e o servidor compara os tempos | Médio |
| Thwomp Pull | Apertar os botões indicados para puxar o trenó até a chegada | B | **Cabo de guerra de teclas**: cada lado aperta as suas teclas; o servidor soma | Pequeno |

### Dois contra dois (10)

| Original | Como funciona | Classe | Versão do Syden | Esforço |
|---|---|---|---|---|
| Eatsa Pizza | Cada dupla come a sua metade da pizza apertando muito | B | **A torta de cenoura**, em dupla; o servidor soma as mordidas | Pequeno |
| Baby Bowser Broadside | Canhões miram um alvo que se move no meio | A | Já coberto pelo **Tiro ao alvo** e pela Caça | Nenhum |
| Cosmic Coaster | A dupla conduz junto um carrinho, desviando de placas | A (individual) | **Carrinho de mina**: trocar de trilho para desviar, cada um no seu | Pequeno |
| Puddle Paddle | A dupla rema junto uma balsa, pegando moedas | C | — | — |
| Log Jam | Um coloca a tora, o outro corta, apertando o botão mostrado | A (individual) | **Lenha rápida**: apertar a tecla que aparece em cada tora | Pequeno |
| Pump, Pump and Away | Bombear no ritmo para o foguete subir mais alto | A | **Foguete de cenoura**: bombear no ritmo do brilho; em dupla, o servidor soma | Pequeno |
| Hyper Hydrants | Um bombeia, o outro mira a mangueira no fogo | A (individual) | **Regador contra a fogueira**: mirar e apagar as chamas | Pequeno |
| Picking Panic | Um pega as cerejas e joga ao parceiro, que as põe na cesta | C | — | — |
| Etch 'n' Catch | Desenhar um círculo em volta de quem corre na tela | A (individual) | **Laçar o coelho**: circular com o mouse o coelho que corre | Médio |
| Slot Synch | Os dois param os blocos e precisam tirar a mesma figura | A | **Caça-níquel da horta, sem aposta**: parar as figuras iguais; dá para ser em dupla | Pequeno |

### Batalha (8)

| Original | Como funciona | Classe | Versão do Syden | Esforço |
|---|---|---|---|---|
| Stacked Deck | Por turnos, virar cartas; a ruim elimina | B | **Cartas do celeiro**: sorte, mas por turnos e com suspense, o que rende na voz | Pequeno |
| Three Door Monty | Lembrar quem entrou em qual das três portas | A | Parecido com o **Jogo dos copos**; uma variante dele | Pequeno |
| Merry-Go-Chomp | Escolher uma cor no pilar que gira; onde parar, elimina | D | Sorte pura | — |
| Slap Down | Bater na mesa quando aparecer a flor igual à do centro; bater errado elimina | A | **Bate quando der a flor** | Pequeno |
| Locked Out | Disputar chaves (menos chaves que jogadores) e passar pelas portas | C | — | — |
| All Fired Up | Desviar de chamas em círculos, cruzes e ondas por 60 s | A | **Brasas da fogueira**: os mesmos padrões para todos, cada um na sua cópia | Médio |
| Storm Chasers | Seguir a nuvem de chuva para regar a própria planta | A | **Regar a horta**: a mesma nuvem para todos, cada um na sua cópia (sem empurrar os outros) | Médio |
| Eye Sore | Correr em volta de um olho gigante; cada volta o encolhe | D | Girar a alavanca não traduz bem para teclado e toque | — |

### Duelo (10)

| Original | Como funciona | Classe | Versão do Syden | Esforço |
|---|---|---|---|---|
| Vine With Me | Soltar o cipó na hora certa para pegar o próximo | A | **De galho em galho** | Pequeno |
| Popgun Pick-Off | Atirar em quem aparece, sem acertar o inocente | A | Variante do **Tiro ao alvo**: "não acerte o coelhinho" | Pequeno |
| End of the Line | Escolher esquerda ou direita em três túneis | D | Sorte quase pura | — |
| Baby Bowser Bonkers | Pular em quem sai dos buracos | A | Já coberto pela **Praga na toca** | Nenhum |
| Silly Screws | Girar parafusos para o lado certo, apertando muito | A | **Destampar os potes**: girar cada tampa para o lado mostrado | Pequeno |
| Crowd Cover | Descobrir qual figura está atrás da multidão que vai saindo; errar perde | A | **Quem está atrás da multidão?** | Pequeno |
| Tick Tock Hop | Pular o ponteiro do relógio que varre o chão; quem for atingido perde | A | **Pula o ponteiro** | Pequeno |
| Bowser Toss | Girar e arremessar um boneco; ganha o mais longe | A | Parecido com o **Medidor de força**; **arremesso do nabo** como variante | Pequeno |
| Motor Rooter | Corrida em canos, girando com as duas alavancas | D | Depende do controle do N64 | — |
| Fowl Play | Pegar a galinha que foge quando se chega perto | A | **Pegue a galinha**: cada um com a sua galinha, na sua cópia | Médio |

### Item (6)

Todos são "um toque no tempo certo". **Lugar proposto: casa especial do Tabuleiro da turma**, não a Festa.

| Original | Como funciona | Classe | Versão do Syden | Esforço |
|---|---|---|---|---|
| Winner's Wheel | Parar a roleta num prêmio | A | **Roda da feira** (sem aposta: o prêmio é cenoura do tabuleiro) | Pequeno |
| Hey, Batter, Batter! | Um golpe de taco na bola; onde cair é o prêmio | A | **Rebater o rabanete** | Pequeno |
| Bobbing Bow-loons | Uma flecha nos balões que se movem | A | **Uma flecha só** | Pequeno |
| Dorrie Dip | Um toque para o bicho pegar um prêmio | D | Fino demais: é só apertar | — |
| Swinging with Sharks | Pular do balanço e cair no barril certo | A | **Pulo do balanço** | Pequeno |
| Swing 'n' Swipe | Martelada em quem anda com o baú | A | **Martelada no baú** | Pequeno |

### Raros (3)

| Original | Como funciona | Classe | Versão do Syden | Esforço |
|---|---|---|---|---|
| Stardust Battle | O chefe final: desviar dos meteoros e devolver os frios até derrotá-lo | B | **O chefe da turma**: todos contra um chefe, com os inimigos no servidor, como na Briga na horta | Grande |
| Dizzy Dinghies | Contra o relógio, de barco, em três pistas | B | O Solo da **corrida de barquinhos** (junto com Water Whirled) | Médio |
| Mario's Puzzle Party Pro | A versão solo, 3 minutos, com lixo caindo | B | Já coberto pelo Solo da **Horta em cascata** | Nenhum |

### Game Guy (4)

| Original | Como funciona | Classe | Motivo |
|---|---|---|---|
| Game Guy's Magic Boxes | Apostar as moedas e escolher o baú certo, dobrando até três vezes | D | Cassino |
| Game Guy's Sweet Surprise | Apostar em qual bicho come o bolo primeiro | D | Cassino |
| Game Guy's Roulette | Apostar numa área da roleta | D | Cassino |
| Game Guy's Lucky 7 | Dados contra a casa, dobrar ou perder tudo | D | Cassino |

### A conta

- **A (microjogo da Festa):** 34, dos quais uns 5 são variantes do que já temos (Tiro ao alvo, Jogo dos copos, Medidor de
  força) ou de outro desta lista (a Praga na toca).
- **B (jogo próprio ou motor existente):** 14, contando o Aces High adaptado; 2 já cobertos (Horta em cascata).
- **C (contato ao vivo):** 14.
- **D (não serve):** 9.

**O que isso diz:** quase metade do Mario Party 3 é "cada um na sua tela, com tempo e precisão", que é exatamente o formato
que a Festa dos coelhos já tem. Dobrar a Festa, de 6 para uns 12 microjogos, custa pouco e já deixa o Tabuleiro da turma
bem mais variado. O que é caro, e o que o original tinha de mais caótico, é o empurra-empurra (classe C), e é isso que a
rede não deixa.

## Fontes

- Super Mario Wiki, [List of Mario Party 3 minigames](https://www.mariowiki.com/List_of_Mario_Party_3_minigames) (a lista e os
  tipos) e as páginas de cada minijogo, a partir de [Aces High](https://www.mariowiki.com/Aces_High) (controles, regras, os
  nomes em outras línguas).
- Super Mario Wiki, [Mario Party 3](https://www.mariowiki.com/Mario_Party_3).
- Mario Party Legacy, [Mario Party 3 minigame list, tips and unlockables](https://mariopartylegacy.com/mario-party-3/minigame-list-tips-and-unlockables)
  (dicas dos jogadores, inclusive a da borda da arena no Aces High).
