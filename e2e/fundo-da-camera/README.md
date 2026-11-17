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
