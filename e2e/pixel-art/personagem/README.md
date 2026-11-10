# O personagem que vive no ambiente

Decidido pelo Sydenstricker em 14/10/2026 (ver "Os coelhos vivem nos ambientes", no CLAUDE.md): o quarto do início e
o salão da comunidade são ISOMÉTRICOS e modulares, e os coelhos andam, sentam, deitam e usam os móveis conforme o que
a pessoa está fazendo de verdade. **Um personagem primeiro (o mascote), validado, depois os outros.**

Este arquivo é o FORMATO, escrito antes da arte, para a arte já nascer encaixando.

## A escala (medida, `escala.png`)

O coelho do recado colado no quarto modular (base de 512 px) em 64, 82 e 100 px de altura. **~80 px de pé** fica na
proporção do conceito: a cama o comporta deitado, o pufe chega à cintura. 64 parece filhote; 100 enche o quarto.

- **Quadro de 120 × 120** (era 96; ver abaixo), o mesmo para todo coelho e toda animação.
- **O pé é a âncora:** o meio da última linha com desenho fica no ponto do chão da casa. Trocar de coelho não mexe na cena.
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

## O que já foi feito (14/10/2026)

- **A estrutura**, no quarto modular (`../quarto/novo/quarto/`, abrir `quarto.html`): pontos nos móveis, caminhada
  pela grade, ordem de desenho, luz do chão no pé, estados (à toa, em call, ausente, falando), clique no móvel, e
  "sem caminhada". ~20 ms por quadro. Falta a camada da frente (pede a arte dos móveis de sentar).
- **O mascote, parado, nas 8 direções** (`gerar.mjs`; a versão boa é `mascote/baixa-120/`, ~90 px de pé num quadro de
  120, vista "low top-down"). Ele já está no quarto de teste, com o desenho certo para cada diagonal.
  - **Com o recorte do quarto como imagem de estilo, a ferramenta COPIOU a cama para dentro de cada direção**
    (`mascote/baixa`, `mascote/alta`). O estilo vai por texto. É a mesma lição das bases de 512: referência vira
    conteúdo.
  - Num quadro de 96 ele saiu com ~60 px; o quadro de 120 dá ~90. O quadro de 96 do formato acima vira 120.
  - Custo: 15 (alta), 15 (baixa) e 25 (baixa-120) gerações. Restam 2.277 das 2.332 do plano novo.

## As animações: o que funcionou e o que não (14/10/2026)

- **Andar, respirar e falar: animação por TEXTO** (`animar.mjs` com `texto:…`, ~6 gerações por direção). Pernas e
  braços mexem e o tamanho fica o do parado (~90 px). A caminhada por ESQUELETO (`walking`, 1 geração) saiu fraca: pernas
  quase paradas, 80 a 91 px conforme a direção, e de costas a cabeça virava de lado.
- **Sentar, ler e deitar: ESTADO do personagem** (`estado.mjs`, ~25 gerações, as 8 direções de uma vez). A animação por
  texto NÃO SAI da pose de pé (o "sentado" saía de pé), e o esqueleto do corpo "mannequin" não tem sentar nem deitar.
  Pedir "nothing underneath: no stool" — a primeira versão veio com um banquinho desenhado.
- **O PixelLab aceita menos direções quando há trabalhos demais ao mesmo tempo** (sete pedidos em paralelo: cada um
  levou só uma parte, e a resposta diz quais). Pedir em sequência; `animar.mjs` guarda o grupo e completa depois.
- **A âncora é a do primeiro quadro** de cada animação e direção (de pé, o pé; sentado, o assento; deitado, o meio do
  corpo): fixa na animação inteira, para ele não tremer.
- **Os móveis giram nas 4 posições** com `create-8-direction-object` sobre a peça que já existe (`../quarto/novo/quarto/girar.mjs`).
- Falta: as TRANSIÇÕES (sentar e levantar animados; hoje a pose troca de uma vez) — candidata: `interpolation-v2`
  entre o parado e o sentado. E a camada da frente dos móveis.
- Custo da rodada: ~175 gerações (restam 2.103).

## A rodada dos relatos dele (14/10/2026, à tarde)

- **A ordem de desenho é pela ÁREA no chão**, não por um número por peça: um número só (a soma da casa da frente)
  cortava o coelho ao lado da poltrona, do pufe e da cabeceira. Quem está inteiramente mais ao fundo num dos eixos vai
  antes; o coelho sentado vai logo depois do móvel (ou logo antes, com a poltrona de costas).
- **A sombra é um VOLUME:** cada pixel do coelho lança um raio que desce até o chão longe da luz; móvel abaixo do raio
  escurece. Cai no chão, no tapete, na poltrona e no pufe. A de contato, embaixo dos pés, é mais escura: sem ela ele
  parecia flutuar.
- **Na cama ele DEITA:** lendo deitado (`estados/lendo-deitado`) e dormindo rígido ou largado (`estados/dormindo-largado`),
  sorteado; o rígido relaxa depois de 20 s. A fileira junto da janela saiu do caminho (a cortina é da parede pintada).
- **O balão de fala** (o do D4, com os três pontos acendendo) sobre a cabeça, de pé ou sentado.
- Saiu o botão "sem caminhada" (pedido dele); quem pede menos movimento no sistema continua sem caminhada.

## A ordem do trabalho

1. **A estrutura, sem arte nova** (página de teste do quarto modular): pontos nos móveis, andar pela grade, ordem de
   desenho, camada da frente, regras de estado, com um coelho provisório.
2. **O mascote no PixelLab** (`create-character-pro`, 8 direções, quadro 96, referência: o coelho do recado, com um
   pedaço do quarto como estilo): só as 4 direções paradas. Ele julga.
3. **As animações**, uma de cada vez, começando por andar e sentar (`characters/animations`).
4. **As camadas da frente** dos móveis de sentar e deitar (repintura `inpaint-v3`).
5. Validado: os outros coelhos com a mesma receita, e o salão isométrico com o mesmo sistema.

## A auditoria visual (09/11/2026): rodar depois de cada lote do PixelLab

A auditoria das bordas (`../auditoria-de-bordas.mjs`) só acha o desenho cortado na borda do QUADRO, pela conta dos pixels.
O que só aparece com a cena montada — a ordem de desenho (o coelho na frente da mesa em que devia estar atrás), o coelho
flutuando acima do assento ou afundado no chão, a orelha cortada pela máscara da cabeceira, a perna por cima do braço da
poltrona, a direção que falta numa animação e cai em outra — pede OLHAR. Para isso:

    node e2e/pixel-art/auditoria-visual.mjs                       # os dois mascotes, quarto e salão (~2,5 min)
    MASCOTE=pixellab CENA=quarto node e2e/pixel-art/auditoria-visual.mjs   # só um (~30 s)
    SO=cama node e2e/pixel-art/auditoria-visual.mjs                # só os casos com "cama" no nome
    SEM_MONTAR=1 ...                                               # reusa as páginas já montadas

Ele monta as páginas numa pasta temporária (sem mexer no `quarto.html` e no `salao.html` do git), põe o coelho em cada lugar
e pose pelos ganchos de teste da página (`window.coelhoDoTeste`, `girarDoTeste`, `caixaDoMovelDoTeste`,
`pessoasNaTelaDoTeste`, em `quarto/novo/quarto/montar.mjs`), com o relógio parado, e fotografa de dia e de noite: a cama
(lendo, dormindo, largado e o meio das transições de deitar), a poltrona, o pufe (os 4 olhares), a cadeira ao computador, o
abajur e o guarda-roupa, cada móvel nas 4 posições; o coelho de pé (parado, andando, varrendo, falando) nas direções; no
salão, o coelho do balcão e as pessoas da call em cada assento (sofás, poltronas, banquetas, cadeiras, pufão, TV,
fliperama, chão), também nas 4 posições. Sai em `e2e/pixel-art/auditoria-visual/<mascote>/<cena>/`: um recorte ampliado
3× por caso, uma FOLHA DE CONTATO por grupo e por hora (`folha-<grupo>-<dia|noite>.png`, o que se revisa) e o `index.json`.

**Quando:** depois de cada lote novo de arte do personagem (poses, transições, animações) ou de mexer na ordem de desenho
do motor. Rode com `MASCOTE=pixellab` (o quarto vai a 100% pixel art) e olhe as folhas: quarto primeiro, depois o salão. O
script não decide o que é defeito; quem revisa compara com a rodada anterior.

## As poses da cena nos corpos novos (10/11/2026)

Pedido: a orelha caída e o musculoso com as mesmas poses que o quarto e o salão de pixel art usam (FONTES em
`../quarto/novo/quarto/montar.mjs`), para o criador de coelho ir ao app com os três corpos. As pastas e os nomes são os do
mascote (`<corpo>/estados/...`, `<corpo>/transicoes/...`, `<corpo>/baixa-120/animacoes/...`): trocar a pasta-base basta.

- **Os ESTADOS saem da pose do MASCOTE, com a edição do corpo** (`estado.mjs` com `COELHO=<corpo> ORIGEM=mascote/estados/<pose>`,
  a edição de `corpo-novo.mjs` com "exactly the same pose"): o assento, a cama e os braços da poltrona ficam no mesmo lugar
  que o mascote validado na cena. ~25 gerações por estado (as 8 direções). A edição agora fica guardada no `estado.json`.
- **As TRANSIÇÕES saem da animação v3 com o quadro final** (`transicao.mjs` com `MOTOR=v3`: `custom_start_frame` e
  `end_frame` em `/characters/animations`): a passagem inteira de uma vez, por ~1 a 2 gerações a direção, contra 10 por PAR
  de quadros do interpolation-v2 (as fluidas do mascote custaram ~30 por direção). `PEGAR` escolhe os quadros para ter o
  mesmo número de quadros do mascote.
- **A remoção de fundo do PixelLab apaga o BRANCO de dentro do desenho** (as páginas do livro no lendo-deitado, o tênis do
  musculoso sentado no sofá): ficou um buraco transparente fechado pelo contorno. `preencher-buracos.py` pinta de volta, só
  nas pastas conferidas olhando (os vãos de verdade, entre o braço e o corpo, também são regiões fechadas).
- **A limpeza aprendeu** (`limpar-soltos.py`, com `tocos.py`): o toco de qualquer tom por fora do traço e o cinza neutro
  sozinho no pelo (o achado dele no "parado" do mascote); o brilho só conta se não encosta no escuro nem no quente (o brilho
  do olho aberto e a página do livro são do desenho); o pedaço solto de 40 px ou mais é do corpo (o tênis); a quina do livro
  presa à capa fica; e numa transição não há "pico" (o corte tirava o alto da cabeça no deitar).
- **O acessório nas poses** (`acessorio-camadas.py`): rastreio EM CADEIA (o quadro 0 da pose contra o parado, os outros
  contra o quadro 0 da pose), limite 60; um quadro que falha tira o acessório da pose inteira naquela direção (sumir e voltar
  piscaria). Deitado, sempre sem (`"sem": true` no relatorio.json). As chaves estão no topo do script.
- **A segunda rodada (10/11/2026, ~308 gerações):** os estados `no-fliperama` e `dormindo-largado` e as animações das reações
  no sofá, do fliperama, do assistir no chão e do varrer (orelha caída; o musculoso sem o varrer). Só ficaram as direções que
  saíram boas; as outras estão em `<corpo>/falhas/` e a cena cai na pose parada: o v3 desenha efeitos (nuvem, faísca, gota,
  tufo) em cima da cabeça da orelha caída — `limpar-soltos.py --teto N` corta o que passa do alto do quadro 0, conferindo
  olhando — e, nas diagonais de costas do sofá, vira a cara para trás. O sudoeste do `no-fliperama` do musculoso saiu DE
  COSTAS (está em falhas: a cena cai no parado). O `varrendo` dos corpos parte do coelho de pé com `PRIMEIRO=0` no
  `animar.mjs` (sem o estado com a vassoura); o sudoeste da orelha caída perdia a vassoura em alguns quadros e saiu.
- **O tipo feminino (10/11/2026, ~483 gerações):** `mascote-f-moletom` com as mesmas poses, pela mesma receita (a edição de
  `CORPOS['mascote-f-moletom']` em cima das poses do mascote; scripts no scratchpad: estados, transições e animações). As
  reações do sofá só nas diagonais de frente (as de costas viravam o rosto nos outros corpos), o fliperama só nas de costas, o
  chão em nordeste e leste. Em `falhas/`: o `surpreso-sofa` sudoeste (olhos amarelos), o `empolgado-fliperama` noroeste
  (arcos de efeito) e o `varrendo` sudeste e nordeste (a vassoura sumia em alguns quadros). `corpo-novo.mjs` ganhou `base`: a
  orelha caída feminina (`orelha-caida-f-moletom`) e a forte feminina (`musculoso-f`) saem do corpo deles, só as 8 rotações,
  à espera da aprovação dele antes das poses.
- **A forte feminina de regata curta (10/11/2026, ~449 gerações, saldo 849 → 400):** `musculoso-f-curta` com as mesmas poses e as
  mesmas economias do `mascote-f-moletom` (scripts no scratchpad, a edição dela em cima das poses do mascote: "feminine fitness
  athlete... cropped heather grey sports tank top that shows the toned belly, black bike shorts... exactly the same pose"). A
  regata e o short batem com as rotações dela em todas as poses. **O cinza neutro:** em várias poses (poltrona, dormindo,
  lendo) a regata veio em cinza NEUTRO (133,133,133) em vez do cinza malva das rotações (161,135,154); foi tingido para o malva
  na mesma proporção de brilho antes da limpeza. **As classes de cor:** `classes_de_cor.py` dá a ela a regra da regata do
  musculoso (o maior pedaço dos tons médios), e a barriga e as coxas ficam pelo. Na folha de estresse a regata saía BRANCA:
  com o short sendo a maior parte da roupa, o tom de referência (a mediana) caía no preto e a regata estourava; agora, quando a
  parte clara da roupa é minoria, a referência é ela (`referencias`; o musculoso sentado ganha o mesmo conserto, o moletom
  não muda). E a auditoria dá folga maior à "roupa estável" de braços nus nas poses de braço para a frente (no aplaudir, a
  regata some atrás dos braços com as classes certas). O boné de costas (nordeste e noroeste) trazia
  um pedaço solto por fora da orelha: ficou só o pedaço maior da camada. Em `falhas/`: o `varrendo` nas 4 direções e de novo
  em sudoeste e sudeste (o v3 desenhou o coelho PEGANDO a vassoura, ou um esfregão, em vez de varrer: a cena cai no parado),
  o `empolgado-fliperama` noroeste (arcos de efeito) e o `surpreso-sofa` sudeste (olhos azuis). A conexão caiu (ECONNRESET)
  no meio de alguns pedidos já pagos: `estado.mjs`, `animar.mjs` e `transicao.mjs` agora tentam de novo as LEITURAS (o POST
  não, para não pagar duas vezes), e o que caiu foi baixado do PixelLab pelo id.
- **Ainda falta (pede gerações):** `varrendo` do musculoso e da forte feminina; o `assistindo-sofa-fofo` (orelha: sudeste e nordeste; musculoso:
  as de costas); e as direções de costas das reações no sofá que viravam o rosto; o `deitar-fluido` sudeste e o
  `deitar-lendo-fluido` sudoeste da orelha caída, que ficaram curtos (o v3 levantava as orelhas).
