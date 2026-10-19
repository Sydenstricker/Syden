# Tradutor local no app: a medição (19/10/2026)

Pedido dele: o botão "Traduzir" em cada mensagem. O tradutor do navegador (Translator API) **não existe no Electron 44**
e, no Edge 155, diz "indisponível" para tudo; só o Chrome o tem. Um tradutor no nosso servidor (LibreTranslate, 2–4 GB de
RAM o tempo todo) ele achou inviável. Daí a pergunta: **um tradutor que rode no computador de quem clica, só na hora?**

O candidato medido é o **Bergamot**, o motor do Firefox (Marian em wasm), com os modelos que o Firefox distribui.

## O que há aqui

- `baixar.mjs` — baixa o wasm e os modelos da distribuição pública do Firefox (Remote Settings), conferindo o sha256.
  `node baixar.mjs en-pt ja-en` baixa só esses; `ANDROID=1` pega a versão de Android (menor) quando existe.
- `medir.mjs` — carrega o motor, um idioma por vez (`SO=ja`), e traduz as 20 mensagens uma a uma, como no clique:
  tempo de carga, memória (RSS e o heap do wasm) e ms por mensagem. Roda igual no Node e no Electron do app
  (`ELECTRON_RUN_AS_NODE=1 electron.exe medir.mjs`).
- `comparar-chrome.mjs` — as mesmas mensagens pelo tradutor do Chrome, para comparar.
- `mensagens.json` — 20 mensagens de conversa da turma, escritas em português e vertidas por mim para inglês, espanhol,
  japonês e árabe. O tradutor volta para o português, e quem não lê a língua de partida compara com o original.
- `motor/` — o código JS do Bergamot e o worker do Firefox (referência de como ele chama o motor), com a licença.
- `resultados/` — o que saiu. `modelos/` fica fora do git (36–70 MB por idioma; `baixar.mjs` refaz).

## Licenças

- Motor (bergamot-translator) e modelos (mozilla/firefox-translations-models, mozilla/translations): **MPL-2.0**. É
  copyleft POR ARQUIVO: serve a um app de código fechado, desde que os arquivos do motor vão sem mudança (ou com o
  código das mudanças aberto) e com a licença junto.
- Opus-MT (a alternativa com português do Brasil, abaixo): **CC BY 4.0**, pede crédito.

## Os números (Ryzen 7 3700X, com o processador já a ~34% de outra coisa)

| | inglês | espanhol | japonês | árabe |
|---|---|---|---|---|
| Rota | en→pt | es→en→pt | ja→en→pt | ar→en→pt |
| Baixar (motor 5 MB + modelos) | 36 MB | 73 MB | 107 MB | 73 MB |
| Carregar o idioma | 0,1 s | 0,2 s | 0,3 s | 0,2 s |
| 1ª mensagem | 0,2–0,6 s | 0,4 s | 0,6 s | 0,4 s |
| Mensagem seguinte (mediana) | 30 ms | 55 ms | 62–66 ms | 63 ms |
| Memória no pico | 250–270 MB | 357 MB | 500 MB | 356 MB |
| Chrome, mediana | 21 ms | 40 ms | 49 ms | 44 ms |

- **Não passa pelo inglês só o par com o inglês**: não há modelo direto japonês→português, e a pivô custa o dobro do
  tempo, a memória e um pouco da qualidade.
- **A memória não volta sozinha** (o heap do wasm só cresce): no app, o tradutor tem de morar num processo à parte, como
  a supressão de ruído, e ser DESLIGADO depois de uns minutos sem uso.
- Reduzir o `workspace` (128 → 32 ou 16 MB) não mudou nada: a memória é o modelo preparado para o cálculo.
- O japonês de Android (2.1, 55 MB) pesa um pouco menos (442 MB contra 501) e traduz parecido.
- Cobertura: uns 57 idiomas, sempre de/para o inglês (japonês, coreano, chinês e russo incluídos). **Dos 82 da lista do
  Syden, 48 têm modelo e 34 ficam de fora** (contado contra `idiomas.ts`): sw mk ga mt ka hy kk uz mn ne si km lo my dv
  am yo om ig ff bm so ha rw mg zu ht sm fj to tet tg tk dz — quase toda a África e o Pacífico, e parte da Ásia Central.

## A qualidade (as traduções completas em `resultados/`)

- **Inglês e espanhol: bons.** O sentido chega certo nas 20.
- **O português sai de Portugal** em metade das frases: "está a jogar", "estou à tua espera", "equipa", "ligar-me".
  O modelo do Firefox é um "pt" só, misturado. É o que mais destoaria para a turma.
- **Árabe: razoável**, com erros de sentido em 3–4 de 20 ("defendeu a regra" no lugar de "a base", uma risada que vira
  "Hahahhhhh…", "acordado amanhã" repetido). O Chrome errou outras tantas, e uma delas grave: "ninguém defendeu a
  Al-Qaeda" (القاعدة é "a base" e também o nome do grupo).
- **Japonês: fraco**, com erro de sentido em ~6 de 20, alguns invertendo a frase ("Ninguém perdeu porque não protegeu a
  base"; "meio-dia" no lugar de meia-noite; "micro-servista" no lugar de Minecraft). O Chrome errou menos (~3–4), mas
  também trocou quem fez o quê ("eu caí do mapa").

**A lição para a tela, valendo para qualquer motor:** tradução automática de conversa erra o sentido de vez em quando.
O original fica sempre visível, e o texto traduzido diz que é tradução automática.

## A alternativa com português do Brasil, ainda não medida

O **Opus-MT** (Helsinki-NLP, `opus-mt-tc-big-en-pt`, CC BY 4.0) tem o português do Brasil como alvo explícito
(`>>pob<<`). É um modelo "big", bem maior que os do Firefox (centenas de MB). O caminho seria híbrido: o Bergamot leva da
língua de partida ao inglês, e o Opus-MT leva do inglês ao português do Brasil, no onnxruntime-node que o app já usa para
a supressão de ruído. Medir antes: tamanho, memória, tempo e se o português fica mesmo brasileiro.
