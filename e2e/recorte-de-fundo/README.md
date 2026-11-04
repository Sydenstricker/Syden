# Recorte de fundo para as figurinhas: o passo 2, medido

Pedido dele (04/11/2026): a figurinha sem o fundo e com contorno, como no WhatsApp. O passo 1 (só código, `web/src/figurinhaEfeitos.ts`)
tira o fundo LISO. Para foto e fundo desenhado, um modelo rodando no computador de quem cria a figurinha. Aqui estão as medidas dos
candidatos de licença livre, todos rodando no navegador pelo onnxruntime-web (MIT), como rodariam no Syden.

```
node e2e/recorte-de-fundo/baixar.mjs   # os modelos (~700 MB no total) e as fotos de teste, fora do git
node e2e/recorte-de-fundo/medir.mjs    # ~10 min; abre resultados/comparar.html
node e2e/recorte-de-fundo/montar.mjs   # só remonta a página, sem medir
```

## As licenças, conferidas na fonte (04/11/2026)

| Modelo | Licença | Fonte |
|---|---|---|
| U²-Net pequeno | Apache 2.0 | github.com/xuebinqin/U-2-Net |
| IS-Net geral | Apache 2.0 | github.com/xuebinqin/DIS |
| BiRefNet lite | MIT | github.com/ZhengPeng7/BiRefNet e huggingface.co/ZhengPeng7/BiRefNet_lite |
| onnxruntime-web | MIT | github.com/microsoft/onnxruntime |

Fora: a biblioteca pronta mais usada no navegador (AGPL) e o RMBG (não comercial).

## O resultado (nesta máquina: 16 núcleos, 8 usados; RTX 3070)

| Modelo | Download | Placa de vídeo | Processador | Qualidade |
|---|---|---|---|---|
| U²-Net pequeno | 5 MB | ~0,2 s | ~0,3 s | corta a Glock e o pires ao meio, deixa sombra na xícara |
| IS-Net geral | 179 MB | ~0,2 s | ~2,7 s | bom em bicho e cabelo; perde metade do quarto e do pires |
| **BiRefNet lite 512** | 192 MB | ~1,7 s | ~2,8 s | **o melhor em todas**: Glock inteira, pelo, cabelo, pires, até a pintura do quarto |
| **BiRefNet lite 512, meia precisão** | **98 MB** | ~1,5 s | ~3,0 s | igual ao de cima, com metade do download |
| BiRefNet lite 1024 | 224 MB | falha | falha | não cabe: a placa recusa o shader, e o processador fica sem memória |

O tempo é por imagem, depois de aberto o modelo; abrir leva de 3 a 10 s, uma vez. As figurinhas da comparação saem com o contorno do
passo 1, como o Syden as guardaria.

## O que se aprendeu medindo

- **A versão do onnxruntime-web decide.** Na 1.20 e na 1.22, a placa dava erro (MaxPool com arredondamento para cima, no U²-Net e no
  IS-Net) ou dava RESULTADO ERRADO sem erro nenhum (o BiRefNet saía meio transparente). Na 1.30, os três dão na placa o mesmo número
  do processador. Conferir a saída da placa contra a do processador é parte do teste, não detalhe.
- **O headless usa a placa de verdade** (a NVIDIA aparece no WebGPU), com `--enable-unsafe-webgpu`.
- **A versão de 512 do BiRefNet é de um terceiro** (huggingface.co/shozebDev/birefnet-lite-512-onnx, MIT como o original). Se entrar no
  Syden, converter a nossa a partir do original, e servir do nosso servidor.
- O processador com metade dos núcleos (a regra do tradutor: quem cria a figurinha pode estar jogando) leva ~3 s. Cabe, com o
  "processando" da prévia.
