# Um detector de voz para o GTCRN dormir (15/11/2026)

O GTCRN do site custa ~2,2 ms a cada quadro de 16 ms, e o detector por ENERGIA (`semVozAgora` em
`web/public/ruido/gtcrn.worklet.js`, medido em `e2e/supressao-sem-voz.mjs`) falhou: onde não corta o começo das frases,
quase não economiza. Aqui: os candidatos a detector de voz (VAD) de verdade, a medida do melhor, e a recomendação.
**Nada em `web/`, `desktop/` nem `server/` foi mudado.**

## Arquivos

| arquivo | o que é |
|---|---|
| `baixar.mjs` | baixa o Silero VAD v6.2.3 para `modelos/` (no `.gitignore`), conferindo o sha256 |
| `onnx-leitor.mjs` | lê um `.onnx` à mão (o protobuf), lista as operações e os pesos: `node e2e/vad/onnx-leitor.mjs <arq> [-v]` |
| `silero.mjs` | **o Silero VAD em JavaScript puro**, escrito à mão (~100 linhas de conta), sem alocar nada por pedaço |
| `conferir.mjs` | confere o `silero.mjs` contra o onnxruntime-node rodando o ONNX oficial, e mede os dois |
| `medir.mjs` | o irmão de `e2e/supressao-sem-voz.mjs`: a MESMA montagem (8 frases pt-BR, 5 ruídos), o worklet de verdade estendido só no `semVozAgora`; áudios em `e2e/fotos/vad/` |

Para rodar: `node e2e/vad/baixar.mjs`, `node e2e/vad/conferir.mjs`, `node e2e/vad/medir.mjs` (só Windows: a fala vem do
System.Speech; ~4 min com todos os detectores; `SO=` e `DET=` filtram).

## Os candidatos

Licença conferida NO ARQUIVO da fonte em 15/11/2026.

| candidato | licença (fonte) | tamanho | entrada | custo / latência | qualidade publicada | serve? |
|---|---|---|---|---|---|---|
| **Silero VAD v6.2.3** | **MIT** (`LICENSE` em github.com/snakers4/silero-vad, pesos no mesmo repositório) | 309.636 pesos; ONNX de 1,29 MB (só 16 kHz, `silero_vad_16k_op15.onnx`) | 16 kHz, pedaços de 512 amostras (32 ms) + 64 de contexto; estado LSTM de 2×128 | **medido: 0,33 ms por pedaço em JS = 0,165 ms por quadro de 16 ms**; decide a cada 32 ms | ~88% de acertos a 5% de alarme falso, 0 dB de SNR (benchmark da Picovoice, que vende o concorrente) | **sim, com o agudo (abaixo)** |
| VAD do WebRTC (GMM) | BSD-3 (o C do WebRTC; o texto vem junto em `py-webrtcvad/LICENSE`) | minúsculo (6 bandas, GMM de 2 gaussianas) | 8/16/32/48 kHz, quadros de 10/20/30 ms | trivial | ~50% a 5% de alarme falso no mesmo benchmark; fraco em ruído (é energia por banda com modelo) | não: não existe porte em JS puro (os portes são Emscripten/WASM: `ennuicastr/webrtcvad.js`, `mozilla/webrtcvad_js`, descontinuado), portar o C de ponto fixo à mão é 1–2 dias, e a família "energia" já falhou aqui |
| TEN VAD (Agora) | **Apache 2.0 COM CONDIÇÕES** (`LICENSE` em github.com/TEN-framework/ten-vad): não pode ser usado "de forma que concorra com as ofertas da Agora" | pequeno, ONNX | 16 kHz, passo de 160 ou 256 | — | diz ser melhor e mais rápido que o Silero | **não: a Agora vende voz e vídeo em tempo real; um app de chamada é exatamente o caso que a condição 1 proíbe** |
| VAD do RNNoise | BSD-3 (`COPYING` em github.com/xiph/rnnoise) | GRUs pequenas (tamanho não conferido) | 48 kHz, quadros de 10 ms, 42 características (bandas + **análise de pitch**) | barato, mas o porte é o RNNoise inteiro (as características com pitch) | é um subproduto da supressão, não um VAD treinado como tal | não medido: mais trabalho que o Silero, sem ganho esperado |
| FireRedVAD (stream) | Apache 2.0 (`LICENSE` em github.com/FireRedTeam/FireRedVAD; o cartão do Hugging Face também) | ~0,6 M pesos (DFSMN) | 16 kHz, quadros de 10 ms, 80 fbank + CMVN | ~2× a conta do Silero; 4,5 ms por 10 ms num ESP32-P4 (porte de terceiro) | o artigo (FireRedASR2S, arXiv 2603.10420) a apresenta como estado da arte; não conferido | reserva, se o Silero falhar com microfone de verdade; não medido |
| Picovoice Cobra | proprietária (AccessKey, plano pago para produção) | — | 16 kHz, 512 | muito barato | o melhor do benchmark deles (99% a 5%) | não: licença |

## As medidas

### O Silero em JavaScript puro (`conferir.mjs`)

O grafo ONNX tem 25 tipos de operação (If, Shape, Cast, Equal… só para aceitar 8 e 16 kHz), mas a conta é pequena e fixa:
STFT de 256 com passo 128 (4 janelas; a "Conv1d" da STFT é Hann × DFT, conferido na base, então vira uma FFT), 4 Conv1d k=3 com
ReLU (129→128, 128→64 s2, 64→64 s2, 64→128), um LSTMCell 128, ReLU, Conv1d 128→1, sigmoide. Escrito à mão em `silero.mjs`:

| | por pedaço de 32 ms | por quadro de 16 ms | erro contra o onnxruntime |
|---|---|---|---|
| onnxruntime-node 1.30, 1 thread (com a chamada assíncrona) | 0,21–0,26 ms | 0,11–0,13 ms | — |
| JS, STFT pela matriz do modelo, conv genérica | 0,71–0,79 ms | 0,35–0,39 ms | 1,0e-6 |
| JS, STFT por FFT, conv genérica | 0,55 ms | 0,27 ms | 1,1e-6 |
| **JS, STFT por FFT, conv desenrolada** | **0,33–0,34 ms** | **0,165 ms** | **1,1e-6** |
| a FFT de 512 + a faixa aguda (o "agudo", abaixo), por quadro | — | 0,018 ms | — |

O detector inteiro recomendado sai a **~0,18 ms por quadro de 16 ms (8% do GTCRN)**, dentro do alvo de 0,3 ms. Dentro do
`medir.mjs`, com o GTCRN rodando no mesmo laço e a máquina ocupada, o mesmo código marcou 0,15–0,35 ms (com picos de até 0,9
quando outro processo pesava): a medida limpa é a de cima.

**Cuidado: o `silero_vad_16k.safetensors` do mesmo repositório NÃO é o mesmo modelo** (até 4,0 de diferença nos pesos da conv1;
as probabilidades erram até 0,2). Os pesos válidos são os do ONNX (`pesosDoOnnx`); o 16k e o de 8+16 kHz dão saídas idênticas.

### Cabe no `motor.js`?

Do grafo, faltam no motor: `Relu`, `LSTM`, `Conv` de 1 dimensão (o motor supõe 4D), `Pad` em modo `reflect` (o motor só faz
constante), e toda a parte de controle (`If`, `Shape`, `Cast`, `Equal`, `Not`, `Size`, `ConstantOfShape`, `Identity`,
`Constant`), que sumiria simplificando com as formas fixas (onnxsim, que pede Python). Dá ~1 dia, e o resultado seria mais lento
que o porte à mão: a STFT viraria uma Conv de 264 mil multiplicações por pedaço (a matriz) pelo caminho de índices do motor.
**O porte à mão é o caminho:** 100 linhas, conferido em 1e-6, 0,165 ms.

### O GTCRN dormindo pelo detector (`medir.mjs`)

A mesma linha do tempo do teste da energia: ~50% dela tem fala (por isso nenhum detector honesto passa muito abaixo de 50% de
modelo rodando aqui; numa chamada de verdade, em que cada um fala uma fração menor do tempo, a economia é maior). "Começo das
frases" é o RMS dos primeiros 150 ms de cada frase contra o modelo sempre ligado; −150 dB quer dizer que saiu MUDO.

O **oráculo** sabe onde há fala: é o melhor de qualquer detector sem antecipação. Ele já perde 1,4–5 dB no começo das frases com
ventilador e ruído alto: é o custo de ACORDAR o GTCRN com o estado de antes (os caches param enquanto ele dorme), e não do
detector.

**Primeiro turno: o Silero sozinho.** Acorda na hora nas vogais (a probabilidade vai de 0 a 0,9 em um ou dois pedaços), mas não
vê a **fricativa surda do começo**: "**Sh**en, chama o Fábio" e "**S**ério? Foi sem querer" saem mudos com ruído, porque o "s" e
o "ch" não têm voz (vibração das cordas vocais), e é isso que o Silero procura. Baixar o limiar (0,15) ou aumentar a folga não
resolve; rodar a cada 16 ms (`silero16`) também não, e custa o dobro.

| cenário | detector | modelo rodando | começo: pior / média | frase a frase |
|---|---|---|---|---|
| ventilador | oráculo | 50% | −4,9 / −4,0 dB | −5 −4 −5 −4 −4 −3 −4 −3 |
| ventilador | Silero 0,3/0,2, segura 300 ms | 49% | −153 / −25,7 dB | −6 −4 −23 −4 −5 −8 **−153** −3 |
| teclado | Silero 0,3/0,2, 300 ms | 50% | −155 / −40,0 dB | 0 −4 **−155** −2 −3 −5 **−149** −2 |
| voz baixa | Silero 0,3/0,2, 300 ms | 49% | −128 / −16,7 dB | 0 0 −1 0 0 −4 **−128** 0 |
| ruído alto | Silero 0,3/0,2, 300 ms | 49% | −162 / −42,8 dB | −9 −2 **−162** −4 −3 −7 **−155** −1 |
| quarto | Silero 0,3/0,2, 300 ms | 50% | −2,0 / −1,5 dB | (igual ao oráculo) |

**Segundo turno: o Silero + o AGUDO.** A fricativa é quase só energia entre 3,5 e 8 kHz, onde ventilador e ruído rosa têm pouco.
O agudo é a energia dessa faixa no quadro (FFT de 512 com Hann), comparada com o seu piso (o mínimo, que sobe ~1 dB/s, a mesma
regra do detector de energia do worklet). Passou a margem, o modelo acorda por um tempo curto; se o Silero confirmar voz, vale a
folga dele. O primeiro agudo (suavizado, 1 quadro basta) consertou as fricativas, mas o teclado o acordava a cada clique (99% do
tempo). Exigir **3 quadros seguidos sem suavizar** (48 ms: o clique dura 1–2, a fricativa 5–12) separa os dois:

| cenário | detector | modelo rodando (só pelo agudo) | começo: pior / média | fala: relação / perda | pausas (sempre ligado → detector) |
|---|---|---|---|---|---|
| quarto | oráculo | 50% | −1,9 / −1,4 dB | 21,7 dB / −0,53 dB | −51 → −60 dB |
| quarto | **sil+agudo6x3s-150** | **51%** (0%) | **−2,0 / −1,5 dB** | 21,6 dB / −0,54 dB | −51 → −59 dB |
| ventilador | oráculo | 50% | −4,9 / −4,0 dB | 12,9 dB / −1,78 dB | −35 → −48 dB |
| ventilador | **sil+agudo6x3s-150** | **50%** (1%) | **−5,2 / −4,3 dB** | 12,8 dB / −1,81 dB | −35 → −48 dB |
| teclado | oráculo | 50% | −3,2 / −1,8 dB | 18,7 dB / −0,83 dB | −49 → −58 dB |
| teclado | **sil+agudo6x3s-150** | **51%** (1%) | **−24,2 / −4,4 dB** | 18,6 dB / −0,81 dB | −49 → −57 dB |
| voz baixa | oráculo | 50% | −0,2 / 0,0 dB | 26,9 dB / 0,00 dB | −73 → −75 dB |
| voz baixa | **sil+agudo6x3s-150** | **50%** (1%) | **−0,5 / −0,1 dB** | 25,6 dB / 0,00 dB | −73 → −75 dB |
| ruído alto | oráculo | 50% | −5,2 / −3,4 dB | 14,0 dB / −1,07 dB | −27 → −43 dB |
| ruído alto | **sil+agudo6x3s-150** | **49%** (0%) | **−8,9 / −4,8 dB** | 14,2 dB / −0,91 dB | −27 → −42 dB |

`sil+agudo6x3s-150` = Silero liga em 0,3 e desliga em 0,2, segura 300 ms; agudo 6 dB acima do piso por 3 quadros seguidos, sem
suavizar, segura 150 ms. As outras variantes medidas (o `medir.mjs` tem todas):

- agudo suavizado, 1 quadro (`sil+agudo6-200`): o melhor começo (ventilador −4,9, ruído alto −8,9, teclado 0), mas **99% no teclado**.
- agudo suavizado, 2 ou 3 quadros: ainda 97–98% no teclado (a suavização estica o clique).
- margem de 9 ou 12 dB: volta a perder o "Sério" no ruído alto (−155 dB).
- sem suavizar, 4 ou 5 quadros: o teclado igual, mas o ruído alto perde o "Sério" de novo (−155). **3 é o ponto.**

O que sobra: no teclado, o "Sério" sai a −24 dB nos primeiros 150 ms (um clique em cima da fricativa sobe o piso; as outras sete
frases ficam como o oráculo). E **as pausas ficam muito mais quietas** que com o modelo sempre ligado (o modelo dormindo devolve
silêncio): no ventilador, de −35 para −48 dB; no ruído alto, de −27 para −43. Isso é um portão de ruído por cima da supressão:
pode soar melhor ou "bombear" (o ruído residual entra e sai com a fala). **Precisa ser ouvido** (`e2e/fotos/vad/*-sil+agudo6x3s-150.wav`
contra `e2e/fotos/supressao-sem-voz/*-nunca.wav`), e não foi.

### O que estas medidas NÃO dizem

- A fala é a voz sintetizada do Windows, e os ruídos são gerados por código. O Silero foi treinado em fala de verdade, e a
  fricativa de um microfone real pode ser mais fraca ou mais forte que a do sintetizador. **Antes de ir ao ar: gravar uma chamada
  de verdade** (fala, teclado, ventilador, alguém ao fundo) e repetir.
- Voz de OUTRA pessoa ao fundo (TV, alguém no quarto) é voz para o Silero: o modelo fica acordado, o que é o certo (o GTCRN é
  quem decide o que tirar).
- Ninguém ouviu os áudios.

## A recomendação

**Silero VAD v6 (MIT), portado à mão em JS, + o agudo de 3,5–8 kHz, decidindo o sono do GTCRN.** ~0,18 ms por quadro (8% do
modelo), e o começo das frases fica perto do que um detector perfeito daria, nos cinco ruídos. Com a fração de fala desta linha
do tempo (50%), o custo da supressão cai de 2,2 para ~1,3 ms por quadro (−42%); com alguém que fala 25% do tempo, para ~0,7 ms
(−67%). O teclado, que derrubava o detector de energia, dorme como os outros.

### No site (o worklet)

1. `web/public/ruido/silero.js`: o `criarSilero` de `e2e/vad/silero.mjs` sem o `node:fs` (recebe os pesos prontos, como o
   `motor.js`), e a FFT de 512 do agudo (o worklet já tem uma FFT de 512: dá para reaproveitá-la, calculando-a sempre, e não só
   quando o modelo roda).
2. Os pesos: um script ao lado de `scripts/ruido/exportar-gtcrn.py` (ou em Node, com o `onnx-leitor.mjs`) tira os 15 tensores do
   `silero_vad_16k_op15.onnx` para `silero.bin` (1,24 MB em float32; ~620 KB em float16, a conferir) com os deslocamentos num JSON;
   a página baixa junto com o `gtcrn.bin` e entrega pelo `processorOptions`. Mesma origem: a política de segurança não muda.
3. No `quadro()`: o detector roda em TODO quadro (é ele que decide); o Silero a cada dois, nas 512 amostras novas; o agudo em
   cada um. Decisão como em `ComDetector` de `medir.mjs` (`sil+agudo6x3s-150`). O modo `'voz'` passa a usar este detector, e o
   padrão sobe de `'quieto'` para `'voz'` só depois da gravação de verdade e de alguém ouvir.
4. `ORIGEM.txt` e a `LICENSE` do Silero (MIT) na pasta; a linha nos termos, seção 10 (Créditos).
5. Uma melhora a medir depois: o oráculo mostra que acordar o GTCRN com o estado parado custa 1,4–5 dB no começo das frases.
   Rodar o modelo no quadro anterior ao acordar (uma vez por acordada) pode tirar parte disso.

Esforço: meio dia a um dia, mais a gravação de verdade.

### No app (o DPDFNet, `desktop/src/ruido/dpdfnet.js`)

O DPDFNet também é 16 kHz (quadros de 10 ms, 1,3–2 ms cada). O mesmo `silero.js` serve: acumula 512 amostras e roda a cada
32 ms (~0,05 ms por quadro de 10 ms, ~3% do modelo); o agudo a cada 16 ms ou a cada quadro, na janela das últimas 512. O
onnxruntime-node com o ONNX oficial também serve (0,21–0,26 ms por pedaço, medido), mas a chamada é assíncrona e o código do
site é síncrono: usar o mesmo JS nos dois é mais simples, e o resultado é o mesmo. **Não medido com o DPDFNet**: o custo de
acordar dele (o estado parado) é outro, e o `medir.mjs` só roda o GTCRN; um harness igual para o DPDFNet é o passo antes.
