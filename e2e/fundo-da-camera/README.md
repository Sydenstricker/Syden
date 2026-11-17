# Fundo da câmera: os candidatos, medidos (14/11/2026)

Pedido dele: tirar o fundo da câmera como o NVIDIA Broadcast, com três efeitos (fundo apagado, desfocado e imagem), **só no app**.
O app carrega o próprio site, então a política de segurança dele (sem WebAssembly) vale lá dentro também: o modelo roda num
PROCESSO À PARTE, pelo onnxruntime-node que o app já leva (o caminho do ruído e do recorte das figurinhas), e a página só monta o
resultado pela placa. Esta medida é desse caminho: onnxruntime-node 1.30, nesta máquina (Ryzen 7 3700X, RTX 3070).

```
node e2e/fundo-da-camera/baixar.mjs        # os modelos (~50 MB), as fotos e os vídeos de teste (Commons), fora do git
node e2e/fundo-da-camera/medir.mjs         # ~2 min; abre resultados/comparar.html
node e2e/fundo-da-camera/medir-video.mjs   # ~4 min, precisa do ffmpeg; abre resultados/video-comparar.html
node e2e/fundo-da-camera/camera-falsa.mjs  # ~10 s: confere que o Chrome entrega um vídeo como webcam
```

## As licenças (conferidas na fonte)

| Modelo | Licença | De onde |
|---|---|---|
| MediaPipe selfie (256 × 256 e paisagem 256 × 144) | Apache 2.0 (Google) | conversão ONNX de huggingface.co/onnx-community |
| MediaPipe multiclasse | Apache 2.0 (Google) | conversão de huggingface.co/FreeHugsForRobots/ps-skin-seg |
| PP-HumanSeg (192 × 192) | Apache 2.0 (PaddleSeg) | OpenCV Zoo, huggingface.co/opencv/human_segmentation_pphumanseg |
| MODNet | Apache 2.0 (ZHKKKe/MODNet) | conversão de huggingface.co/Xenova/modnet |

Fora: Robust Video Matting (GPL-3), e a conversão da Qualcomm do MediaPipe (licença própria).

## O resultado (quadro de 640 × 360; ms por quadro, a mediana, só o modelo)

| Modelo | Arquivo | 1 núcleo | 2 núcleos | 4 núcleos | Placa (DirectML) | Contorno |
|---|---|---|---|---|---|---|
| MediaPipe paisagem | 0,5 MB | 3,4 | 2,8 | 2,7 | 3,4 | bom com luz; **no quarto escuro some com a pessoa inteira** |
| MediaPipe quadrado | 0,5 MB | 6,3 | 4,3 | 4,3 | 4,8 | come o canto do notebook e deixa blocos; no escuro, a pessoa meio transparente |
| **PP-HumanSeg** | 6,2 MB | 16,2 | **10,6** | 7,9 | **1,8** | **o mais limpo com luz E no escuro** (fone, cabelo, mão); borda um pouco macia |
| MODNet 256 | 25,9 MB | 203 | 117 | 89 | 10,1 | perde a pessoa fora de foco |
| MODNet 512 | 25,9 MB | 877 | 536 | 407 | 21,9 | o melhor cabelo e mão, mas buracos e manchas; só cabe na placa |
| MediaPipe multiclasse | 16,5 MB | 141 | 91 | 64 | 8,8 | deixa o fundo meio visível; descartado pelo tempo no processador |

Com o preparo do quadro (reduzir e normalizar, em JavaScript, ainda sem otimizar), somam-se 2–5 ms.

**A conta do custo para quem joga:** a 15 quadros por segundo, o PP-HumanSeg com 2 núcleos gasta ~15 × 13 ms ≈ **0,2 de um núcleo**
(na faixa da supressão de ruído, ~20%). Pela placa seria ~0,06, mas a placa é do jogo, e o app hoje NÃO leva o DirectML (o
`desktop/package.json` o exclui do pacote: mais ~18 MB).

## Estabilidade (a câmera 3 px ao lado; quanto a máscara concorda com ela mesma)

A maioria fica entre 94% e 99%. No quarto escuro todos caem (PP-HumanSeg 62%, MediaPipe quadrado 58%, MODNet 512 93%): o ruído do
sensor faz a borda tremer. **Suavizar a máscara no tempo** (misturar com a do quadro anterior) é obrigatório no produto, e precisa
ser medido com VÍDEO de verdade, o que esta medida não tem.

## O que NÃO foi medido

- ~~Vídeo~~: medido em 15/11/2026, com a webcam simulada (abaixo). Ainda sem webcam de verdade.
- A ida e volta do quadro entre a página e o processo (a máscara volta pequena: 192 × 192 = 37 KB).
- O custo de montar o resultado pela placa na página (WebGL) e de reenviar o vídeo.
- Notebook com placa híbrida (o caso do relato do LoL: Ryzen 5 com RTX 4050).

## A recomendação

**PP-HumanSeg, no processador, 2 núcleos e prioridade baixa, a 15 quadros por segundo**, com a máscara suavizada no tempo e
ampliada na placa pela página. É o único que segura o quarto escuro, cabe no processador sem a placa, e tem 6 MB. O MediaPipe
paisagem fica de reserva para computador fraco (4× mais barato), sabendo que falha com pouca luz.

## Vídeo (webcam simulada, 15/11/2026)

Sem webcam na máquina, a câmera é simulada: três vídeos do Commons de gente falando para a câmera, reduzidos pelo ffmpeg ao que
uma webcam entrega (640 × 360, 15 qps, 20 s cada) em quatro versões: **limpa**, **ruído de sensor** (gaussiano que muda a cada
quadro), **quarto escuro** (o mesmo escurecer das fotos, gama 1,8 até 90 de 255, mais ruído forte) e **compressão MJPEG** (q 18, a
webcam USB barata). PP-HumanSeg e MediaPipe paisagem, **2 núcleos**, quadro a quadro (`medir-video.mjs`; o ffmpeg tem de estar no
PATH). Fora do git: `videos/` e `resultados/`.

| Vídeo | Autor | Licença | Trecho |
|---|---|---|---|
| [Video message from Rep. Alexandria Ocasio-Cortez](https://commons.wikimedia.org/wiki/File:Video_message_from_Rep._Alexandria_Ocasio-Cortez.webm) (celular na mão, legenda gravada na imagem) | Climate Justice Alliance | CC0 1.0 | 5–25 s |
| [Hasan Jameel gives a message in Torwali about Covid19](https://commons.wikimedia.org/wiki/File:Hasan_Jameel_gives_a_message_in_Torwali_about_Covid19_(video-converter.com).webm) (400 × 222, a mais "webcam") | Zubair Torwali | CC BY 4.0 | 10–30 s |
| [Wikimedia Hackathon 2016 video message from Wes Moran](https://commons.wikimedia.org/wiki/File:Wikimedia_Hackathon_2016_video_message_from_Wes_Moran.webm) (estúdio, parede branca) | VGrigas (WMF) | CC BY-SA 3.0 | 3–23 s |

### O tempo (2 núcleos, 3.600 quadros por modelo)

| Modelo | Só o modelo (mediana / p90) | Com o preparo (mediana / p90) | Núcleos a 15 qps |
|---|---|---|---|
| **PP-HumanSeg** | 10,6 / 12,4 ms | **11,6** / 13,6 ms | **~0,17** |
| MediaPipe paisagem | 2,6 / 3,5 ms | 3,4 / 4,5 ms | ~0,05 |

O preparo caiu de 2–5 ms (fotos) para ~1 ms com as tabelas da amostra bilinear feitas uma vez (`preparador`): é assim que o
processo do app deve fazer.

### O tremor (média dos três vídeos; a grade de comparação é 320 × 180)

"Trocas": pixels que mudam de lado entre dois quadros seguidos, por pixel de contorno. A fala e a cabeça mexem de verdade, então a
versão limpa não é zero: **o que o ruído acrescenta é a diferença para ela**. "Δ alfa": quanto a transparência muda por quadro na
faixa macia da borda (o que se vê tremendo sobre o fundo).

| PP-HumanSeg | IoU limpa | Trocas limpa | IoU escura | IoU p5 escura | Trocas escura | Δ alfa escura |
|---|---|---|---|---|---|---|
| crua | 99,02% | 0,206 | 97,33% | 89,6% | 0,557 | 0,117 |
| média 0,5 | 99,24% | 0,163 | 98,60% | 93,8% | 0,292 | 0,059 |
| média 0,65 | 99,32% | 0,145 | 98,91% | 95,1% | 0,227 | 0,044 |
| média 0,8 | 99,44% | 0,118 | 99,21% | 95,9% | 0,163 | 0,028 |
| histerese 0,35–0,65 | 99,37% | 0,132 | 98,77% | 92,7% | 0,253 | (dura) |
| **média que se adapta** | 99,34% | 0,140 | 98,82% | 93,1% | **0,243** | 0,038 |

O MediaPipe paisagem fica nos mesmos números (escura, crua: 97,68% e 0,462 trocas; com a que se adapta, 0,188). Ruído de sensor e
MJPEG quase não pesam (PP, crua: 0,286 e 0,216 trocas contra 0,206 da limpa); **o quarto escuro é o caso que importa**, e nele a
suavização corta o tremor pela metade ou mais.

### O arrasto (um quadro do vídeo andando 1 s e parando; px no quadro de 640)

| PP-HumanSeg | Cabeça, 6 px/quadro: atrás | Assenta em | Mão, 18 px/quadro: atrás | Assenta em | Resto 1 s depois de parar |
|---|---|---|---|---|---|
| média 0,5 | 3,8 px | 2 quadros | 9,5 px | 2 quadros | 0 |
| média 0,65 | 7,2 px | 3 | 19,4 px | 4 | 0 |
| média 0,8 | 15,8 px | 7 | **48,3 px** | 8 | 0,05 px |
| histerese | 1,2 px | **nunca** | 1,3 px | nunca | **0,5–0,9 px** (pixels presos) |
| **média que se adapta** | **1,1 px** | 1 | **1,1 px** | 2 | 0,02 px |

A média fixa atrasa o contorno em ~α/(1−α) quadros: a 0,8, a mão passando deixa um rastro de 48 px (meia mão) por meio segundo. A
histerese não arrasta, mas deixa pixels presos na faixa do meio que nunca voltam (um halo fixo onde a pessoa esteve). O MediaPipe
dá o mesmo (0,8 na mão: 46,8 px; a que se adapta: 1,2 px).

**A média que se adapta** (`adaptativa` em `medir-video.mjs`): por pixel, segura com α = 0,8 onde a mudança é pequena (|Δ| < 0,2,
o tremor) e solta até α = 0,2 onde é grande (|Δ| > 0,6, movimento de verdade), em rampa no meio. No escuro ela tira ~55% do tremor
(quase o que a média 0,65 tira) e arrasta como a máscara crua.

### Fidelidade (sem gabarito: contra a própria versão limpa)

Uma máscara que some não treme, então a estabilidade sozinha não basta. No escuro, a IoU com a própria limpa: PP-HumanSeg 93,9%,
97,7% e 99,3% nos três vídeos; MediaPipe 92,4%, 97,9% e 99,3%. **O "MediaPipe some com a pessoa no escuro" das fotos NÃO se
repetiu** nestes vídeos: os três são bem iluminados na origem e de fundo simples (o caso das fotos era a Gamescom, fundo cheio).
Na versão limpa, o MediaPipe concorda 96–99% com o PP-HumanSeg.

### A câmera falsa do Chrome

`camera-falsa.mjs`: o vídeo vira um `.y4m` (640 × 360, 15 qps, yuv420p) e o Chrome com `--use-fake-device-for-media-stream
--use-file-for-fake-video-capture=<arquivo>.y4m` o entrega pelo `getUserMedia` (conferido: 640 × 360 a 15 qps, quadros mudando;
o rótulo da câmera é o caminho do arquivo). Só em contexto seguro: a página é https servida pelo próprio playwright. É o caminho
de um e2e futuro no app (o Electron aceita as mesmas opções).

### Os limites desta medida

- Os vídeos são de câmera boa, escurecidos e com ruído por código; o ruído de uma webcam de verdade no escuro tem cor e padrão
  próprios. Nenhum tem fundo cheio nem pouca luz de verdade.
- O arrasto é um quadro inteiro andando (a pessoa e o fundo juntos), não um braço se mexendo sobre um fundo parado.
- A legenda gravada na imagem do vídeo CC0 entra como "pessoa" nos dois modelos (aparece no comparativo).

### A recomendação, revista

**O PP-HumanSeg se mantém**: 11,6 ms com o preparo, ~0,17 de um núcleo a 15 qps, e a borda mais limpa nas fotos (o comparativo em vídeo para julgar a olho:
`resultados/video-comparar.html`: em cima o PP-HumanSeg, embaixo o MediaPipe; crua, média 0,65 e a que se adapta). O MediaPipe
paisagem continua de reserva (~0,05 de um núcleo); nos vídeos ele não falhou no escuro, mas as fotos dizem que falha com fundo cheio.

**A suavização é a média que se adapta (α de 0,8 a 0,2 pela mudança do pixel)**, sobre a máscara pequena antes de
ampliar (é uma conta por pixel: 37 mil em 192 × 192). Se for para ser uma média fixa, **0,5**: corta ~48% do tremor no escuro e
atrasa ~0,6 quadro. **0,8 e a histerese, não**: uma arrasta a mão por meio segundo, a outra deixa pixels presos.

## O filtro guiado e os refinados (17/11/2026)

Relato dele com o fundo no ar: funciona, mas "não fica tão refinado quanto o do NVIDIA Broadcast": uma FRANJA CLARA fina em
volta do cabelo e a borda grossa, porque a máscara de 192 px é ampliada. Pedido: os três passos abaixo ("pode fazer os 3").

```
py -3.12 -m venv <pasta> && <pasta>/Scripts/python -m pip install paddlepaddle==2.6.2 paddle2onnx==1.3.1 setuptools onnx onnxconverter-common
<pasta>/Scripts/python e2e/fundo-da-camera/converter-paddle.py   # os candidatos do PaddleSeg em ONNX (modelos/, fora do git)
SO=pphumanseg,ppmatting-v2-fp16 CONFIGS=cpu-2,dml node e2e/fundo-da-camera/medir.mjs        # fotos: tempo e a borda
MODELOS_DO_VIDEO=pphumanseg,ppmatting-v2-fp16,ppseg-v2-retrato PLACA=ppmatting-v2-fp16 SUAVES_DO_VIDEO=crua,pagina,guiado \
  node e2e/fundo-da-camera/medir-video.mjs                                                    # vídeo: tremor e arrasto
```

### 1. O filtro guiado no modesto (`guiado.mjs`; a mesma conta na placa em `web/src/fundoDaCamera.ts`)

O filtro guiado (He, Sun e Tang, 2010; a versão rápida, 2015) faz a máscara, perto da borda, virar uma função linear do BRILHO
do próprio quadro da câmera, e a borda dela cola na borda da imagem. A conta é num quadro de até 320 px de largura (os
coeficientes são lisos), janela de raio 4 e `eps` 0,004 (brilho de 0 a 1); a saída usa o brilho do quadro cheio. A varredura
(320 e 640 px, raio 2 a 6, `eps` 0,001 a 0,01) mudou os números dentro do ruído da medida (as fotos escuras levam ruído
sorteado, ±0,7 ponto entre rodadas): ficou o primeiro.

**A borda sem gabarito** (`qualidade.mjs`): na faixa de transição (alfa entre 0,05 e 0,95), a FRANJA é quanto do que aparece é
fundo (o pixel se parece mais com a cor do fundo ali perto e entra com alfa), o CORTE é quanto da pessoa sai, e a LARGURA é a
espessura da faixa. São proxies, para comparar na mesma foto. A média das 9 fotos, com a máscara montada como a página monta:

| Modelo | Franja | Corte | Largura |
|---|---|---|---|
| PP-HumanSeg (o modesto) | 49,9% | 40,9% | 5,5 px |
| **PP-HumanSeg + filtro guiado** | **46,8%** | **31,7%** | 7,0 px |
| PP-MattingV2 512 | 44,1% | 38,6% | 1,0 px |
| PP-MattingV2 512 + filtro guiado | 42,3% | 34,6% | 3,0 px |

O filtro guiado baixou a franja e o corte em todos os modelos medidos (o comparativo traz cada um com e sem). A faixa fica mais
larga porque o filtro deixa transparência onde a imagem tem borda de verdade (o fio de cabelo), em vez do degrau do smoothstep.
A olho (`resultados/comparar.html`, as linhas "+ filtro guiado"): o halo claro do fundo em volta do cabelo escuro some.

**Na placa, medido no app** (`e2e/fundo-da-camera-no-app.mjs`: a montagem com e sem o filtro, alternando quadro a quadro, com
uma leitura de 1 pixel que obriga a placa a terminar): **0,1 a 0,4 ms por quadro** a mais (2,3–2,9 ms sem, 2,4–3,2 ms com, em
três rodadas), na RTX 3070.

**O tremor e o arrasto, em vídeo** (a média dos três vídeos; o modesto com a média que se adapta, montado como a página monta):

| PP-HumanSeg | Trocas limpa | Trocas escura | IoU p5 escura | Arrasto 6 px/q | Arrasto no escuro | Mão 18 px/q |
|---|---|---|---|---|---|---|
| como a página monta | 0,141 | 0,245 | 93,1% | 1,3 px | 2,1 px | 1,4 px |
| + filtro guiado | 0,160 | 0,275 | 93,2% | 1,2 px | 2,4 px | 1,4 px |

O filtro acrescenta ~12% de troca de lado nos pixels de contorno (ele segue a borda da imagem, que também treme com o ruído) e
praticamente não muda o arrasto. O "resto parado" sobe de 0,02 para ~0,4 px porque compara com a máscara SEM o filtro (a borda
mudou de lugar de propósito): não é pixel preso.

### 2. Os refinados, pela placa (as mesmas fotos e vídeos; o tempo é só o do modelo, a mediana)

| Modelo | Arquivo | 2 núcleos | Placa (DirectML) | Franja / largura (fotos) | No escuro, em vídeo |
|---|---|---|---|---|---|
| PP-HumanSeg 192 (o modesto) | 6,2 MB | 13,8 ms | 3,3 ms | 49,9% / 5,5 px | trocas 0,245; fiel 94–99% |
| PP-HumanSeg v2 retrato 256 × 144 | 3,8 MB | 6,8 ms | 2,0 ms | 43,4% / 6,1 px | trocas 0,230; fiel 91–98% |
| PP-HumanSeg v2 leve 192 | 12,2 MB | 9,1 ms | 2,0 ms | 45,1% / 5,6 px | – |
| PP-HumanSeg v2 médio 192 | 30,2 MB | 13,9 ms | 2,0 ms | 48,6% / 6,4 px | – |
| PP-HumanSeg v1 servidor 512 | 107 MB | 1.562 ms | 28,1 ms | 55,1% / 1,8 px | – |
| **PP-MattingV2 512, 16 bits** | **18,1 MB** | ~290 ms | **4,6–5,5 ms** | 44,1% / 1,0 px | **trocas 1,04; fiel 72–100%** |
| PP-MattingV2 768 × 512 | 35,9 MB | 411 ms | 8,6 ms | 45,4% / 0,9 px | – |
| MODNet 512 × 288 | 25,9 MB | 216 ms | 13,5 ms | 55,7% / 1,5 px | trocas 7,5 e 71; fiel 35–98% |
| MODNet 896 × 512 | 25,9 MB | 674 ms | 24,0 ms | 60,3% / 1,4 px | – |

Todos Apache 2.0 (PaddleSeg e ZHKKKe/MODNet). "Fiel": a IoU com a máscara do mesmo modelo no mesmo vídeo limpo. A máquina estava
em uso (outros testes e o cliente do LoL abertos) durante as fotos: os tempos no processador saíram até 2× piores que os de
14/11; os da placa batem. **VRAM** do PP-MattingV2 aberto pelo DirectML: ~225 MiB em 16 bits, ~263 em 32 (pela memória usada da
placa antes e depois de abrir, não por processo).

**As conversões** (`converter-paddle.py`): ninguém publica os v2 nem o PP-MattingV2 em ONNX com origem confiável, então a
conversão é nossa, a partir dos zips OFICIAIS do PaddleSeg (paddleseg.bj.bcebos.com, os links do README do PaddleSeg 2.9), pelo
paddle2onnx 1.3.1. Dois tropeços que o script resolve: (1) a média adaptativa dos v2 sai como um AveragePool de passo zero com a
entrada de tamanho livre ("Adaptive only support static input shape"): fixar a entrada e refazer a inferência de formas no
Paddle resolve; (2) o PP-MattingV2 só converte com lados que as médias dele dividem bem: 512 × 288 e 640 × 352 saem quebrados,
512 × 512 e 768 × 512 saem. A meia precisão (onnxconverter-common) pede tirar o `scales` vazio dos Resize (o `sizes` basta) e as
constantes que sobram; a saída difere da de 32 bits em no máximo 0,002 de alfa.

**O escolhido é o PP-MattingV2 512 em 16 bits**: a borda mais fina de todos (1 px, contra 5,5 do modesto), o cabelo e a mão no
lugar com luz, ~5 ms na placa (o mais rápido dos que recortam de verdade; o MODNet leva 13–24 ms e se perde no escuro e com a
pessoa fora de foco), 18 MB (cabe no git, abaixo dos ~30 MB), Apache 2.0. Os v2 de segmentação são baratos, mas a borda deles é
tão larga quanto a do modesto: não são "refinados". O servidor 512 é lento e pesado demais (107 MB, 28 ms).

**O preço dele, e o que se fez:** (a) **no escuro ele se perde**: nos vídeos escurecidos com ruído, a máscara troca de lado 4×
mais que a do modesto, e em dois dos três fica só 72–85% parecida com a dele mesmo na luz. Por isso, no Automático, A CÂMERA
ESCURA VAI AO MODESTO (o brilho médio abaixo de 85 de 255, e de volta acima de 100; os vídeos escurecidos ficam entre 51 e 61, os
normais entre 153 e 166). (b) Com a pessoa fora de foco (a foto do cabelo cacheado, com a câmera focando o celular), ele corta o
cabelo de lado; o filtro guiado devolve parte. (c) Na foto da videochamada, ele recorta o notebook junto com a pessoa (o modesto
não).

**O PP-HumanSeg v2 de retrato** (256 × 144, 16:9 como a webcam) é a descoberta à parte: metade do tempo do modesto no
processador (6,8 contra 13,8 ms), franja menor nas fotos e o mesmo tremor no escuro. Ele pode virar o modesto num passo seguinte
(decisão dele); NÃO foi trocado aqui.

### 3. A troca no app (`desktop/src/fundo-camera/`: decisor.js, jogo.js, placa.js, processo.js, segmentador.js, modelos.js)

- O refinado mora numa THREAD À PARTE do processo (`placa.js`): abrir pelo DirectML trava a thread por ~1,5 s (medido), e o
  modesto ficava calado; a página, que desiste do processo calado por 2 s, desligava o efeito.
- No Automático ele entra com a placa capaz (a mediana de 8 quadros seguidos abaixo de 33 ms, ao abrir), nenhum jogo na frente
  (os executáveis do `HKCU\System\GameConfigStore\Children`, ou tela cheia de verdade; a cada 2 s, `jogo.js`), luz bastante, e
  sem aperto (5 quadros seguidos acima de 60 ms descem; volta com 24 s de folga, uma vez; o jogo que sai, com 5 s).
- **O relógio da placa engana**: com a placa à toa entre um quadro e outro, a NVIDIA baixa o relógio (P5, 345 MHz), e o mesmo
  modelo que leva 5 ms em quadros seguidos leva 25–50 ms a 15 por segundo (no app: mediana 26 ms, p90 56 ms, pior 101 ms em 527
  quadros). Não é aperto: o limite em uso é o do quadro (60 ms), e não o da abertura (33 ms).
- A troca não pisca: a máscara anterior é levada ao tamanho da nova e entra na mesma média que se adapta (no e2e, o pior quadro
  da descida com o jogo ainda tinha 100% dos cantos apagados).
- **A escolha à mão** (decisão dele, mesmo dia, pelo caso do Mundial): Configurações → Voz e vídeo → Recorte: Automático (de
  fábrica), Leve ou Completo. A escolha é respeitada (nem jogo, nem aperto, nem pouca luz a trocam); o Completo que não roda neste
  computador vira o Leve, e a linha diz "Completo indisponível neste computador". No Automático, a linha diz o que vale agora
  ("Automático · Completo").
- O pacote passa a levar o `DirectML.dll` (18,5 MB) e o modelo (18,1 MB): **~37 MB a mais** sem comprimir. O `dxcompiler.dll` e o
  `dxil.dll` continuam fora: o DirectML abre e roda sem eles (medido com uma cópia do onnxruntime-node sem os dois).
- O processo com o refinado gastou 0,09 de um núcleo em 10 s (a conta vai à placa), contra 0,10–0,22 com o modesto. A página
  reduz e copia 1 MB por quadro (512 × 512 RGBA) em vez de 147 KB: o custo disso na página NÃO foi medido à parte.

### O que NÃO foi medido

- Webcam de verdade, e escuro de verdade (o ruído de uma webcam no escuro tem cor e padrão próprios; o limite de 85/100 é o dos
  vídeos escurecidos por código).
- Outra placa que não a RTX 3070 (AMD, Intel integrada, notebook híbrido): a abertura mede e decide, mas o tempo nelas não foi visto.
- Um jogo de verdade na frente com o refinado (o e2e simula pelo `SYDEN_TESTE_JOGO`), e o aperto real de um jogo na placa.
- O custo da página com o quadro de 512 × 512.
