# Teste de pixel art: o coelho em duas ferramentas

O primeiro passo combinado em "Gerar arte com IA" (CLAUDE.md): uma peça só, o coelho do Syden, gerada em
mais de uma ferramenta e comparada lado a lado. **Nada daqui entra no Syden.** É material de avaliação.

Feito em 06/10/2026. A comparação está em `folha.html` (abre no navegador) e em `folha.png`.

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `ref-coelho.png`, `ref-coelho-64.png` | A referência: o coelho `ocioso`, recortado (e reduzido a 64 px para o PixelLab) |
| `ref-*.png` | Outros desenhos do mascote renderizados, caso sirvam de referência depois |
| `saida/` | O que as ferramentas devolveram, em 64×64 |
| `grande/` | As mesmas imagens ampliadas 6×, com os pixels nítidos, para avaliar a olho |
| `custos.jsonl` | Quanto cada chamada custou |
| `gerar.mjs` | Gera uma pose numa ferramenta: `node e2e/pixel-art/gerar.mjs <ferramenta> <pose>` |
| `renderizar.mjs`, `ampliar.mjs`, `folha.mjs` | Fazem as referências, as ampliações e a folha de comparação |

As chaves ficam como variável de ambiente do Windows (`RETRO_DIFFUSION_KEY`, `PIXELLAB_KEY`), nunca no
repositório nem no servidor: a arte é feita uma vez, aqui, e o Syden em funcionamento não chama esses serviços.

## O que se viu

- **PixelLab Pro** (o coelho como referência de PERSONAGEM): o mais consistente. Reconhece a cara redonda, o
  creme e as orelhas, e várias das 16 variações saem quase iguais ao coelho de hoje. Põe contorno preto, que o
  coelho atual não tem, e algumas variações fogem do personagem: é um cardápio, não resultado direto.
- **Retro Diffusion Pro** (referência): a imagem isolada mais bonita, mais macia e perto da linha atual. Só
  uma foi gerada; falta saber se mantém o personagem entre poses.
- **Retro Diffusion Plus** (parte do desenho): mantém o formato, mas com defeitos (olhos desiguais).
- **PixelLab normal** (estilo pela imagem): falha em consistência, cada pose tem outra cara. É o problema
  que o CLAUDE.md já previa.

## O que custou e o que surpreendeu

- Retro Diffusion: US$ 0,42 dos US$ 0,50 de crédito inicial. Plus custa US$ 0,06 por imagem e Pro, US$ 0,18
  (`check_cost: true` dá o preço sem gastar).
- **A API do Retro Diffusion é assíncrona**: responde "aceito" com um `task_id`, e a imagem se busca depois
  em `/v2/inferences/tasks/{id}`. A primeira tentativa foi cobrada e a imagem se perdeu por isso; o
  `gerar.mjs` hoje espera a tarefa.
- **O PixelLab Pro faz 16 imagens por chamada e cobra cerca de 20 gerações.** Uma chamada só consumiu
  metade do teste grátis (40 gerações). O modo normal (`create-image-bitforge`) custa 1 por imagem.
- O `bitforge` exige a referência de estilo no mesmo tamanho da saída (por isso o `ref-coelho-64.png`).

## Próximo passo, se continuar

Retro Diffusion Pro nas três poses (uns US$ 0,54) para saber se a imagem bonita se sustenta como personagem.
A decisão de estilo (com contorno, "cara de jogo", ou macio, como hoje) é do Sydenstricker.
