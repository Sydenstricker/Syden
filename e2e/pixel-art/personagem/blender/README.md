# O coelho em 3D: o Blender no lugar do PixelLab?

Experimento de 18/10/2026, em duas rodadas. Os créditos do PixelLab acabaram (16/10), e a geração por IA tem um
problema que crédito nenhum resolve: **animação segurando objeto.** A cada quadro o modelo redesenha a vassoura, e ela
muda de tamanho, de cor, de mão. A pergunta: um coelho montado em 3D e renderizado como pixel art segura o objeto igual
em todo quadro, e fica bom o bastante ao lado do mascote do PixelLab?

**Entrega:** uma animação, **varrendo** (8 quadros), nas 4 diagonais, ao lado do mascote atual, feita de três jeitos
(A, B e C, abaixo).

## O que abrir

| arquivo | o que é |
|---|---|
| **`abordagens.png`** | **abrir primeiro:** a mesma direção (sudoeste) e os mesmos quadros para o PixelLab, a rodada 1, A, B e C, em 3× (`python abordagens.py [direção]` refaz) |
| `varrendo.gif`, `c/varrendo.gif`, `projecao/varrendo.gif` | a animação de A, C e B: as 4 direções no chão do salão, em 3×, a 10 quadros por segundo |
| `comparar.png` (e `c/`, `projecao/`) | por direção: o mascote do PixelLab parado, o do Blender parado e os 8 quadros varrendo (3×) |
| `comparar-a-b.png` | por direção: PixelLab, A parado, B parado, e A e B em dois quadros varrendo |
| `no-salao.png`, `no-salao-noite.png` (e em `projecao/`) | no chão do salão, no tamanho de verdade (em 3×) |
| `*-v1.png`, `varrendo-v1.gif`, `v1/` | a rodada 1, guardada para comparar |
| `varrendo-<direção>.png`, `parado-<direção>.png` | as faixas da A: 8 quadros de 120 × 120 lado a lado, no formato do `../README.md` |
| `varrendo.json` | quadro, quadros, fps e a ÂNCORA explícita de cada direção (ver "A âncora") |

| script | o que faz |
|---|---|
| `coelho.py` | monta o coelho, o esqueleto, a vassoura e a animação no Blender, e renderiza. `-- 4` é a A, `-- 4 projecao` a B, `-- 1 c` a C |
| `rodar.ps1` | roda o `coelho.py` no Blender da Store e espera: `powershell -File rodar.ps1 4`, `... 4 projecao`, `... 1 c` |
| `pos.py` | A e B: do render à pixel art (`python pos.py 4`, `python pos.py 4 projecao`) |
| `projecao/projecao.py` | B: projeta o sprite do PixelLab no modelo (carregado pelo `coelho.py`) |
| `c/pos_c.py` | C: o pós com as quinas claras e escuras (`python c/pos_c.py`) |
| `coelho.blend`, `projecao/coelho-projecao.blend`, `c/coelho-c.blend` | as cenas, para abrir e mexer à mão |

O Blender é o 5.2.2 da Microsoft Store. O `blender.exe` dentro de `WindowsApps` não se deixa chamar direto ("acesso
negado"); quem funciona é o atalho `%LOCALAPPDATA%\Microsoft\WindowsApps\blender-launcher.exe -b -P coelho.py`. Ele
solta o processo e não mostra a saída, por isso o script escreve em `saida/log*.txt` e o `rodar.ps1` espera o
`saida/pronto*.txt`. Nenhum complemento foi instalado no Blender: as técnicas das referências foram refeitas nos nossos
scripts, para o caminho inteiro morar no repositório. A pasta `saida/` (os quadros crus) se refaz e está no `.gitignore`.

## O que é comum às três

**O coelho é feito só por código** (`coelho.py`), sem modelo de fora: elipsoides para cabeça, bochechas, orelhas (com o
rosa por dentro), moletom, capuz, pernas, pés, mãos e rabinho; os olhos fechados e a boquinha são curvas finas sobre a
cabeça. **O esqueleto:** raiz, tronco, cabeça, as duas orelhas, braço e antebraço de cada lado, as pernas. Cada peça é
RÍGIDA, presa a um osso (num boneco de elipsoides em 120 px, igual a pele com pesos, e sem pele esticando errado).

**A vassoura** é um objeto só, preso a um osso `vassoura`; as mãos vão a dois alvos presos a ela, por IK. **A vassoura
manda e os braços acompanham**: o objeto nunca muda, e a mão nunca solta o cabo. Isso vale para as três.

**A câmera** é ortográfica e fixa; o coelho é que gira. Elevação de 20° (o salão é ~30°, mas a 30° aparecia o alto da
cabeça demais perto do mascote, que é "low top-down") e giro de 32° nas diagonais (o mascote mostra mais o rosto que
os 45° geométricos; `ELEV=30 GIRO=45` no ambiente volta ao do salão).

**A âncora:** a vassoura desce à frente e abaixo dos pés, então "o meio da última linha com desenho do primeiro quadro"
(a regra do `montar.mjs`) cairia na palha. O pé é o do coelho parado (a câmera não muda), e está em `varrendo.json`
(`pe`). Para usar no motor, ele precisa ler essa âncora.

## Rodada 1 (`*-v1`)

O primeiro coelho: 3 tons lisos por material, contorno preto por fora, linhas por dentro onde uma parte passa na frente
de outra. A vassoura já era idêntica nos 32 quadros. Ficou abaixo do mascote em quatro pontos, que a rodada 2 atacou:
**faltava o capuz** (a marca do mascote), **a cabeça virava uma bola branca** com 3 tons, **o movimento mal se via em 1×**,
e o corpo era magro.

## A: o modelo melhorado (a rodada 2)

**O que é:** o mesmo caminho da rodada 1, com o modelo e a luz refeitos olhando o mascote lado a lado.

- **O capuz:** um anel grosso deitado nos ombros, mais baixo na frente e mais alto atrás, aberto em V na frente do
  peito (as pontas viram as lapelas), com a camiseta clara aparecendo no V; atrás, o capuz caído é uma massa escura
  abaixo da cabeça, e é uma PARTE à parte, então o pós risca a dobra entre ele e as costas. De costas (nordeste,
  noroeste) ele aparece como no mascote.
- **O corpo:** moletom mais largo, mangas grossas que chegam às patas (a mão só aparece na ponta), cabeça um pouco
  menor, as pernas da calça aparecendo embaixo.
- **A luz:** 4 a 5 tons por material, todos tirados das cores do mascote, incluindo a **sombra fria** dele
  (96, 79, 111); uma **borda de luz** do lado da janela (onde a superfície vira de lado e olha para a janela, sobe um
  degrau); e o **rebatido quente** embaixo da cabeça (227, 205, 227), que o mascote tem. A cabeça ganha degraus do alto
  à esquerda para baixo à direita.
- **O varrer:** o arco da palha de 30° para 40° de cada lado, as mãos andando junto, o tronco torcendo 16° e se
  inclinando para dentro do golpe, o peso passando de um pé para o outro, a cabeça compensando. No fim de cada golpe,
  **um tufinho de poeira** (3 bolinhas, 2–3 pixels) que cresce e some no quadro seguinte.

**De onde vem:** é a base de todos os vídeos de referência (Lucas Roedel, KitagawaGameDev, Wintermute Digital):
modelo simples, câmera ortográfica fixa, rampa de tons, render pequeno.

**Resultado:** o capuz, a gola em V e as mangas fazem ele LER como o mascote, de frente e de costas. O varrer agora se
vê em 1× (no GIF fica claro o vaivém). A cabeça continua mais lisa que a do desenho: os degraus estão lá, mas o
mascote tem pinceladas que um elipsoide não tem. A boca quase não aparece.

**Custo:** ~25 min desta rodada para o modelo, a luz e o varrer (umas 6 rodadas de olhar e ajustar).

## B: o desenho do PixelLab projetado no modelo (`projecao/`)

**O que é:** para cada direção, o sprite do mascote (`mascote/baixa-120/<direção>.png`) é projetado da câmera de render
sobre cada peça rígida, na pose de descanso (as coordenadas de textura de cada vértice são a posição dele na tela,
levada ao sprite). Como as peças são rígidas, o desenho vai junto quando elas se mexem. Duas proteções: a caixa do
modelo é encaixada na caixa do sprite (esticada 0,93 a 1,03), e cada vértice que a câmera não vê (atrás de outra peça)
fica marcado e usa o material liso da A, senão o braço desenhado seria pintado também no corpo atrás dele. O contorno
de fora do sprite é tirado antes (`projecao/sprites/`): projetado, ele caía dentro do modelo e virava linha fantasma.
O rosto modelado sai; o do desenho entra.

**De onde vem:** é a "pintura por projeção da câmera" do Blender (o UV Project / Texture Paint por projeção), usada
para levar um desenho 2D a um modelo 3D.

**Resultado, com honestidade: a diferença de silhueta estraga.** No quadro parado, o moletom herda as dobras
desenhadas e o rosto é o do mascote, e de longe parece o mais "feito à mão" dos três. Mas onde o modelo e o desenho não
coincidem aparece o defeito: a orelha do desenho e a do modelo não batem (uma orelha fica dobrada, com pedaço liso e
pedaço desenhado), o traço da orelha de trás do desenho cai na cabeça como uma mancha escura, e o rosto fica um pouco
deslocado. Quando o coelho se mexe, o desenho que foi feito para uma pose estica e escorrega nas peças que giram (o
tronco gira 16°), e as bordas entre desenho e liso tremem de quadro para quadro. Para funcionar, o modelo teria de ter a
silhueta exata do desenho nas 4 direções, o que é justamente o trabalho de modelagem que se queria evitar.

**Custo:** ~15 min para montar (mais que A e C, e frágil: cada mudança no modelo muda o encaixe).

## C: à t3ssel8r (`c/`)

**O que é:** o jeito do t3ssel8r ("Making an Animation for my 3D Pixel Art Game"), refeito no nosso pós:
- **renderizado direto em 120 × 120**, um pixel de render por pixel do sprite, câmera fixa (a "câmera presa ao pixel"
  dele é para câmera que anda; a nossa não anda);
- **rampa de 3 tons com a sombra puxada para o azul-violeta** (sombra de pintor: mais escura, mais saturada, matiz
  em direção ao azul), a partir do tom do meio de cada material do mascote;
- **linhas por dentro por distância E por normal:** onde a distância salta (uma parte na frente de outra), linha escura
  na de trás; onde a distância é parecida mas a normal vira de repente (uma quina), linha CLARA se a quina é para fora
  (convexa) e ESCURA se é para dentro (côncava). Um passe extra de normais, por quadro, alimenta isso;
- **contorno por fora no tom escuro do próprio material**, não preto (o contorno seletivo dele).

**De onde vem:** t3ssel8r para o visual (rampa, quinas claras/escuras, contorno seletivo); as ferramentas gratuitas
citadas (Blender To Pixels, o Pixel Art Shader do Toshihiro Kushizaki, o complemento de material da técnica do Lucas
Roedel) fazem variações disso dentro do Blender; aqui está nos nossos scripts.

**Resultado:** o mais "pixel art de jogo" dos três: o contorno colorido deixa o coelho mais macio no chão do salão, e a
borda clara pega nas orelhas e no alto da cabeça. Mas o nosso modelo é feito de bolas lisas, e quina quase não há: o
que a técnica tem de melhor (as linhas claras nas arestas) aparece pouco. Ela brilha em modelos com arestas (móveis,
casas, armas), menos num coelho redondo. Fica mais longe das cores do mascote que a A (são 3 tons, não os 5 medidos).

**Custo:** ~15 min (o passe de normais e o pós); por animação, o mesmo da A.

## Veredito e recomendação

**A vassoura idêntica em todos os quadros, nas 4 direções, segurada de verdade, está resolvida pelas três**, sem
crédito nenhum: é o que a IA não consegue, e aqui vem de graça.

**Recomendação: A, com o contorno seletivo da C como opção a testar no salão.** A é a que mais se parece com o mascote,
porque usa as cores dele e agora tem o capuz, a gola e as mangas. C é uma técnica boa, mas pede modelo com quinas, e
afasta do mascote. B não serve como caminho: a projeção só funciona se o modelo já tiver a silhueta do desenho, e aí
ela não precisaria existir.

**O limite que nenhuma das três resolve:** misturar no motor o parado e o andando do PixelLab com o varrendo do Blender
mostra a troca de estilo. O 3D vale de verdade se TODAS as animações do mascote vierem dele (andar, sentar, deitar
também), ou se o modelo ficar bem mais fiel ao desenho (gerado de imagem, abaixo).

## O tempo

- Rodada 1: ~35 min (com a instalação já feita).
- Rodada 2: ~40 min no total: A ~25 min, B ~15 min, C ~15 min (parte em paralelo: o Blender renderiza uma enquanto o
  pós de outra roda). Cada rodada de ajuste: ~1 min de Blender e de 5 a 20 s de pós.

## O que vem depois, se ele quiser seguir

- **Custo de cada animação nova (A ou C):** com o coelho e o esqueleto prontos, uma animação simples (acenar, comer
  cenoura, regar) é uma função de poses no `coelho.py` e mais um objeto se tiver: **~30 min a 1 h**. Com contato em
  móvel (sentar no sofá, deitar na cama) ou um andar bem feito: **1–2 h**. Nenhuma custa crédito.
- **Um modelo mais fiel ao mascote:** gerar o 3D a partir da imagem do mascote (Tripo, Meshy, Rodin) daria a forma do
  desenho, e é o que também faria a B funcionar. **Pede conta dele** num desses serviços. O esqueleto, a vassoura e os
  pós daqui servem igual.
- **Mixamo** (movimentos prontos: varrer, acenar, dançar) pede **login Adobe dele**. O rigger automático espera
  proporção humana; com cabeça de 40% e braço curto de chibi, tende a enfiar a mão na cabeça. Daria para usar só o
  movimento do tronco e manter os braços por IK, como aqui.
- **Pôr no motor:** o `montar.mjs` lê a âncora do primeiro quadro; com objeto abaixo do pé, ele precisa ler o `pe` do
  `varrendo.json`.

## Tropeços, para quem retomar

1. Peças presas ao osso com o IK já ligado grudam nos braços dobrados: o IK entra depois de prender as peças.
2. O IK estica o antebraço para alcançar o cabo, e a mão presa ao osso esticava junto: ela só copia a posição da ponta.
3. Cabo indo da barriga para a frente some atrás das mangas (mesma cor do moletom): segurado na diagonal, atravessando
   a frente do corpo, ele aparece.
4. Braço de chibi é curto: duas mãos no mesmo cabo só alcançam com a vassoura no meio do corpo e um pouco de estica.
5. Na B: o contorno do sprite projetado vira linha fantasma; tira-se só o preto que encosta no transparente (o dos
   olhos fica). O teste de quem a câmera vê precisa da vassoura e da poeira fora da cena, ou elas tapam o corpo.
6. No `rodar.ps1`, o Start-Process recusa argumento vazio: o modo só entra na lista quando existe.
