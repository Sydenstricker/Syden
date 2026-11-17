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

## Mais candidatos, e o escuro: do modelo ou do nosso vídeo? (17/11/2026)

Pedido dele, olhando `resultados/video-comparar.html`: "mesmo o Completo não é perfeito, olhe os artefatos" (no vídeo escurecido,
o PP-MattingV2 perde o ombro e a roupa e deixa um bloco no rosto) e "não temos mais modelos para testar?".

```
node e2e/fundo-da-camera/baixar.mjs     # baixa também os novos (modelos/novos/, ~1,1 GB)
RODADAS=20 SAIDA=comparar-candidatos SO=pphumanseg,ppmatting-v2-fp16,u2net-humano,birefnet-lite-512,ben2,birefnet-retrato,\
ppmatting-v2-fp16-auto,ppmatting-v2-fp16-auto-suave,ppmatting-v2-fp16-inverso,pphumanseg-auto-suave,pphumanseg-inverso \
  CONFIGS=cpu-2,dml node e2e/fundo-da-camera/medir.mjs        # ~12 min (o BiRefNet retrato leva 13 s por foto)
SAIDA=video-candidatos MODELOS_DO_VIDEO=ppmatting-v2-fp16,pphumanseg,u2net-humano,birefnet-lite-512 \
  PLACA=ppmatting-v2-fp16,u2net-humano,birefnet-lite-512 SUAVES_DO_VIDEO=crua,guiado node e2e/fundo-da-camera/medir-video.mjs
SAIDA=video-realce MODELOS_DO_VIDEO=ppmatting-v2-fp16,ppmatting-v2-fp16-auto,ppmatting-v2-fp16-auto-suave,ppmatting-v2-fp16-inverso \
  PLACA=<os mesmos> SUAVES_DO_VIDEO=crua,guiado node e2e/fundo-da-camera/medir-video.mjs
SEPARAR_ESCURO=1 SEM_VIDEO=1 GUIADO=0 SAIDA=video-escuro \
  MODELOS_DO_VIDEO=ppmatting-v2-fp16,pphumanseg,ppmatting-v2-fp16-inverso,birefnet-lite-512 PLACA=<os da placa> node ...medir-video.mjs
SEM_VIDEO=1 GUIADO=0 SAIDA=video-temporal \
  MODELOS_DO_VIDEO=ppmatting-v2-fp16,ppmatting-v2-fp16-temporal,ppmatting-v2-fp16-temporal-auto PLACA=<os mesmos> node ...medir-video.mjs
```

`SAIDA=` escreve `resultados/<nome>.html` (e os vídeos com o nome na frente) sem apagar os comparativos de antes. O que entrou no
banco: a normalização do ImageNet e as saídas por sigmoide e por "menor e maior" (o U²-Net); `configs`, `rodadas` e `aquecer` por
modelo na lista; o REALCE só na entrada do modelo (`realce.mjs`, um modelo da lista com `realce:`); a IoU de cada foto escura com a
mesma foto clara (a franja e o corte não veem a pessoa que SOME: máscara vazia não tem borda); e as versões `escura-sem-ruido` e
`ruido-forte` do vídeo (`SEPARAR_ESCURO=1`). (`GUIADO=0` no vídeo quebrava o resumo; consertado.)

### As licenças (conferidas na fonte, o código E os pesos)

| Modelo | Código | Pesos e conversão ONNX | Arquivo |
|---|---|---|---|
| BiRefNet lite, 512 (o das figurinhas) | [MIT](https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE) | [MIT](https://huggingface.co/ZhengPeng7/BiRefNet_lite); conversão [shozebDev, MIT](https://huggingface.co/shozebDev/birefnet-lite-512-onnx) | 98 MB (16 bits) |
| BiRefNet retrato, 1024 | MIT | [MIT](https://huggingface.co/ZhengPeng7/BiRefNet-portrait); conversão [onnx-community, MIT](https://huggingface.co/onnx-community/BiRefNet-portrait-ONNX) | 490 MB (16 bits) |
| BEN2 base, 1024 | [MIT](https://github.com/PramaLLC/BEN2/blob/main/LICENSE) | [MIT](https://huggingface.co/PramaLLC/BEN2) (o "completo" deles é o comercial, por API; o base é aberto); conversão [onnx-community, MIT](https://huggingface.co/onnx-community/BEN2-ONNX) | 219 MB (16 bits) |
| U²-Net humano, 320 | [Apache 2.0](https://github.com/xuebinqin/U-2-Net/blob/master/LICENSE) | Apache 2.0 (do repositório); o ONNX é o do [rembg, MIT](https://github.com/danielgatis/rembg/releases/tag/v0.0.0) | 176 MB |
| ViTMatte small | [MIT](https://github.com/hustvl/ViTMatte/blob/main/LICENSE) | [Apache 2.0](https://huggingface.co/hustvl/vitmatte-small-composition-1k); ONNX do [Xenova](https://huggingface.co/Xenova/vitmatte-small-composition-1k), sem licença declarada | 104 MB |

Ressalva comum: os pesos são MIT/Apache, mas os conjuntos de TREINO (DIS5K, P3M-10k, Composition-1k da Adobe) têm termos próprios,
alguns só de pesquisa. O cartão de cada modelo declara MIT/Apache para os pesos, e é isso que fica anotado.

**Fora, e por quê:**
- MatAnyone: [S-Lab License](https://github.com/pq-yang/MatAnyone/blob/main/LICENSE), não comercial. Robust Video Matting: GPL-3.
- IS-Net / DIS: o código é [Apache 2.0](https://github.com/xuebinqin/DIS/blob/main/LICENSE.md), mas a conversão
  [onnx-community/ISNet-ONNX](https://huggingface.co/onnx-community/ISNet-ONNX) está marcada AGPL-3.0; e é um modelo de objeto
  qualquer a 1024, da classe do BiRefNet de 1024 (segundos por quadro, abaixo). Não medido.
- BackgroundMattingV2 ([MIT](https://github.com/PeterL1n/BackgroundMattingV2)): pede uma FOTO DO FUNDO VAZIO antes (a pessoa sai
  da frente da câmera). Muda o produto; não medido.
- ViTMatte: pede o TRIMAPA (que poderia vir do Leve), e é lento: **50 ms a 320 × 192, 98 ms a 512 × 288, 133 ms a 640 × 384** na
  placa (32 bits, entrada aleatória, só o tempo). Fora pelo tempo.
- SAM 2 ([Apache 2.0](https://github.com/facebookresearch/sam2/blob/main/LICENSE)): pede um ponto ou uma caixa e é pesado; não é desta
  classe. Não medido.
- SINet / ExtremeC3Net ([MIT, NAVER](https://github.com/clovaai/ext_portrait_segmentation)): minúsculo (~0,1 M parâmetros), da
  classe do Leve para baixo, e o único ONNX pronto é o da Qualcomm (fora pela licença deles). P3M-Net (código
  [MIT](https://github.com/JizhiziLi/P3M)): sem ONNX, e converter pediria rodar o código do repositório. PortraitNet: sem LICENSE no
  repositório. BiRefNet lite "matting" (MIT): sem ONNX publicado. Não medidos.
- O BiRefNet lite e o BEN2 de 1024 só existem com a entrada FIXA em 1024: **BiRefNet lite 1024, 6,3 s por quadro na placa**;
  BEN2 1,1 s; BiRefNet retrato 12–13 s. Os dois últimos ficaram nas fotos como referência de qualidade, não como candidatos.

### Por que o BiRefNet é lento na placa

O BiRefNet lite de 512 (o mesmo arquivo das figurinhas) leva **76–82 ms por quadro pelo DirectML** (229 ms no vídeo, com as outras
sessões abertas no mesmo processo). O registro da sessão diz por quê: **724 dos 3.133 nós caem no processador** (184 Gather, mais
Concat, Where, Equal, Slice: a convolução deformável do decodificador, desmontada em indexações), e cada ida e volta entre a placa e
o processador custa. A versão de 32 bits da mesma conversão: 1,75 s. Com CUDA ou TensorRT ele seria outro (o autor fala em 17 qps a
1024 numa RTX 4090), mas o app só tem o DirectML.

### O resultado

Fotos: as 9 de sempre, a média; "no escuro": a IoU da máscara da foto escura com a da mesma foto clara (fone da Gamescom ·
videochamada). Vídeo: a média dos três; "fiel no escuro": a IoU com a máscara do mesmo modelo no vídeo limpo (cc0 / Torwali /
hackathon). Tempo: só o modelo, a mediana, nas fotos (o modelo sozinho no processo; duas rodadas, a faixa).

| Modelo | Arquivo | Placa | 2 núcleos | Fotos: franja / corte / largura | + filtro guiado | Fotos no escuro | Vídeo: trocas limpa / escura | Fiel no escuro | IoU p5 escura |
|---|---|---|---|---|---|---|---|---|---|
| PP-HumanSeg 192 (o Leve) | 6,2 MB | 1,8 ms | 8,5–12,1 ms | 49,1% / 42,0% / 5,1 px | 45,3 / 32,2 / 6,6 | 93% · 92% | 0,206 / 0,557 | 94 / 98 / 99% | 89,6% |
| **PP-MattingV2 512, 16 bits (o Completo)** | 18,1 MB | **5,4–5,6 ms** | ~335 ms | 44,0% / 38,7% / 1,0 px | 41,9 / 34,5 / 3,0 | 95% · 99% | 0,259 / 1,130 | 85 / **73** / 100% | 55,6% |
| U²-Net humano 320 | 176 MB | 14,1–14,9 ms | 661–671 ms | 56,4% / 31,5% / 1,7 px | 44,7 / 33,5 / 3,6 | 87% · **32%** | 0,255 / 1,477 | 86 / 79 / 100% | 35,7% |
| BiRefNet lite 512 | 98 MB | 76–82 ms | – | 34,4% / 43,8% / 1,3 px | 37,1 / 31,9 / 3,1 | **0%** · 32% | 0,184 / 524 | **48** / 99 / 100% | 0% |
| BEN2 base 1024 | 219 MB | 1.081–1.092 ms | – | 32,3% / 59,0% / 1,2 px | 36,0 / 40,6 / 3,6 | 99% · 81% | – | – | – |
| BiRefNet retrato 1024 | 490 MB | 12,5–13,0 s | – | 41,8% / 46,3% / 1,0 px | 40,2 / 38,4 / 3,2 | 99% · 88% | – | – | – |

(As fotos escuras levam ruído sorteado. "Trocas 524" do BiRefNet: num vídeo escuro a máscara SOME em parte dos quadros, e a troca é
medida por pixel de contorno de um contorno quase vazio.)

A olho (`resultados/comparar-candidatos.html`): o **BEN2** e o **BiRefNet retrato** são os mais limpos com luz (o BEN2 não deixa a
mão solta no ar que o PP-MattingV2 deixa no fone da Gamescom), e o corte alto deles nas contas vem de jogarem fora o notebook e a mão
que o PP-MattingV2 mantém, não de comerem a pessoa; mas custam 1 s e 13 s por quadro. O **BiRefNet lite** some com a pessoa na foto
escura do fone (a máscara vazia) e em parte dos quadros de um vídeo escuro. O **U²-Net** deixa mais fundo na borda que todos
(franja 56%), perde a pessoa na videochamada escura (32%) e treme mais que o Completo no escuro.

**Nenhum candidato novo ganha do PP-MattingV2 512 dentro do orçamento** (meta abaixo de 30 ms na placa): o único que cabe, o U²-Net
(15 ms), é pior com luz e no escuro e tem 10 vezes o tamanho. Os que recortam melhor com luz (BEN2, BiRefNet retrato) passam do
orçamento por duas ordens de grandeza, e só existem com a entrada fixa de 1024. **Nenhum serve como Leve**: o U²-Net leva 670 ms no
processador. O candidato a Leve continua o PP-HumanSeg v2 de retrato (a seção anterior).

### O escuro: do modelo ou do nosso vídeo?

O "quarto escuro" da medida junta duas coisas: escurecer (gama 1,8 até 90 de 255) e um ruído FORTE (σ 22/14 no nível escuro). Para
separar, duas versões novas (`SEPARAR_ESCURO=1`): só o escurecer, sem ruído; e um ruído equivalente (σ 55/35, o do escuro depois de
desfeita a gama) numa imagem com luz. Fiel = IoU com o mesmo modelo no vídeo limpo (cc0 / Torwali / hackathon); trocas por pixel
de contorno, a máscara crua.

| | Completo | Completo + realce ideal ("inverso") | Leve | BiRefNet lite |
|---|---|---|---|---|
| escuro (o de sempre) | 84,7 / 72,5 / 99,8% · trocas 1,13 | 82,8 / 54,9 / 99,7%¹ · 1,58 | 93,9 / 97,7 / 99,3% · 0,56 | 48,3 / 99,0 / 99,8% |
| **escuro sem ruído** | 89,4 / 92,9 / 99,9% · 0,34 | **98,6 / 98,9 / 100%**¹ · 0,27 | 95,0 / 99,1 / 99,4% · 0,24 | 99,2 / 99,7 / 99,9% |
| **ruído forte, com luz** | **59,2 / 30,6 / 77,1%** · 4,09 | – | 92,3 / 34,8 / 98,5% · 1,49 | 82,3 / 98,2 / 99,6% |

¹ Contra o Completo no vídeo limpo SEM realce (o "inverso" num vídeo claro estoura o branco, então comparar com ele mesmo não serve).

**A resposta: o que derruba o Completo é o RUÍDO, não a falta de luz.** Só escuro, ele cai pouco (89–93% no pior vídeo), e o realce
que desfaz o escuro o devolve a 98,6–100%. Só ruído, com luz, ele desaba (31–77%) e treme 16 vezes mais que no vídeo limpo. No escuro
de sempre, clarear a entrada PIORA (o realce amplia o ruído junto): o "inverso", que desfaz a conta exata, dá 54,9% no Torwali contra
72,5% sem nada; o realce automático (esticar o brilho e a gama, `auto`) também piora (61,8%, trocas 1,58); com uma média 3 × 3 antes
(`auto-suave`) melhora o cc0 (88,8%) e destrói o Torwali (39%: o vídeo de 400 × 222 já é borrado). Nas FOTOS escuras o realce quase
não muda nada (o Completo já fica em 95–99% nelas: o ruído delas é σ 7, um terço do do vídeo).

**O que ajuda: tirar o ruído no TEMPO, antes do modelo** (`temporal`: a média dos quadros de entrada por pixel, α 0,75, como o filtro
de ruído de uma webcam; só na entrada do modelo). No escuro, as trocas do Completo caem de 1,13 para **0,45** (−60%), a pior IoU
entre quadros (p5) sobe de 55,6% para 75,8%, e o Torwali de 72,5% para 81,6%; com o ruído leve, de 0,45 para 0,25. O preço: no vídeo
LIMPO e balançado (o cc0, filmado com o celular na mão) a máscara fica só 91,5% parecida com a do Completo sem ela (o rastro do
movimento na entrada), então ela só faria sentido ligada no escuro. E mesmo com ela o Completo no escuro (trocas 0,45, p5 76%, fiel
82–100%) ainda fica atrás do Leve (0,56 cru e 0,25 como a página monta, p5 90%, fiel 94–99%). A média em JavaScript desta medida soma
~8 ms ao preparo; na placa seria uma conta por pixel. O arrasto medido (0,6–1 px) é contra a máscara do mesmo modelo, que já tem o
rastro: o rastro da entrada não foi medido à parte. Os tempos "com o preparo" dos modelos com realce estão inflados pelo realce em
JavaScript sem otimizar (até +30 ms); o do modelo não muda.

**Conclusão para o app:** a regra que já existe (no Automático, a câmera escura vai ao Leve) continua certa para o escuro destes
vídeos. **E o veredito depende de uma webcam de verdade**: o nosso ruído é forte (σ 22 no escuro, sem a redução de ruído que o
processador de imagem de uma webcam faz). Se uma webcam real no escuro chegar perto do "escuro sem ruído", um realce de brilho na
entrada recupera o Completo inteiro (98,6–100%), e o limite de brilho do Automático poderia descer. É a medida que falta.

### Os comparativos

- `resultados/comparar-candidatos.html`: as fotos, com a coluna nova "No escuro" (o `comparar.html` de antes ficou como estava).
- `resultados/video-candidatos.html`: em cada vídeo (limpo e escuro), as linhas PP-MattingV2 512 (o Completo) · PP-HumanSeg (o
  Leve) · U²-Net humano · BiRefNet lite 512; as colunas, a crua e a que se adapta com o filtro guiado (como o app monta).
- `resultados/video-realce.html`: o Completo sem realce · com o `auto` · com o `auto-suave` · com o `inverso`.
- `resultados/video-escuro-numeros.json` e `video-temporal-numeros.json` (e os `.html` deles, só tabelas): a separação e a média no
  tempo.

### O que NÃO foi medido

- Webcam de verdade no escuro (a pergunta que decide, acima).
- O BEN2, o BiRefNet retrato e o BiRefNet lite numa entrada menor que a do arquivo: as conversões têm a entrada fixa, e convertê-los
  de novo pede rodar o código dos repositórios.
- A média no tempo no Leve, e com o filtro guiado.
- Outra placa além da RTX 3070.

## A luz que acende e apaga: a troca de modelo se vê? (17/11/2026)

`node e2e/fundo-da-camera-luz.mjs` (o app de verdade, com a API, o site e o LiveKit de teste). A câmera falsa toca o
mensagem-hackathon com a luz trocando de repente a cada 5 s (`PERIODO=`), o escuro e o ruído da variante "escura" (brilho médio
~173 aceso, ~53 apagado). Com o fundo apagado, grava cada quadro que vai para a chamada em três rodadas (Automático, Leve sempre,
Completo sempre) e mede quanto da máscara (80 × 45) mudou de um quadro para o outro. A página: `resultados/luz.html`.

| | Parada (mediana · p95) | A luz mudando | A troca de modelo |
|---|---|---|---|
| Automático | 0,39% · 0,78% | 1,1–1,7% | 0,50–0,89% |
| Leve sempre | 0,42% · 0,78% | 1,1–1,5% | — |
| Completo sempre | 0,44% · 0,83% | 0,9–1,7% | — |

A troca mexe menos que a própria luz: não se vê. Desce ao Leve ~0,7–0,8 s depois de apagar (a média do brilho, 0,8 por quadro) e
volta ao Completo ~0,3 s depois de acender. O pior quadro da pessoa é igual com e sem troca (o "meio" medido pega ~19% de parede
em qualquer rodada). O interruptor seco é o pior caso: a webcam de verdade ainda ajusta a exposição aos poucos.
