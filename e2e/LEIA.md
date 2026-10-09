# Testes de ponta a ponta

Estes testes abrem o Syden num Chrome de verdade, criam conta, clicam nos botões e conferem o que aparece
na tela. Eles pegam o que os testes do servidor não pegam: desenho fora de ordem, botão que sumiu, animação
que não roda, tela que quebra no navegador.

São lentos e precisam do Syden no ar — por isso ficam fora do `npm test` e fora do CI. Rode-os antes de
publicar uma mudança grande na interface.

> **O `producao` é o único que pode rodar contra o Syden de verdade.** Todos os outros criam contas e
> mandam mensagens: contra a produção, encheriam a comunidade de gente falsa. Rode-os sempre contra a
> cópia local descrita abaixo.

## Antes de rodar

Toda conta nova cai entre as 25 primeiras e ganha a insígnia de presente, que cobre a tela na entrada — por
isso os testes chamam `dispensarPresentes(page)` logo depois de a vila aparecer. Quem testa a própria tela de
destaque (`insignias`) não chama.

Os testes criam contas de verdade, então **use um banco separado** para não encher o seu de desenvolvimento.

```bash
# terminal 1 — servidor de mídia (só é preciso para os testes de voz/tela)
npm run dev:livekit

# terminal 2 — API com banco próprio de teste
DATABASE_PATH=./teste.db PORT=3099 INVITE_CODE=teste CORS_ORIGIN=http://localhost:5174   EXIGIR_CONFIRMACAO_EMAIL=nao RESEND_API_KEY= npm run dev:server

# terminal 3 — site apontando para essa API (de dentro de web/, senão o npm come o --port)
cd web && VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort
```

No PowerShell, as variáveis vão antes, em linhas separadas (`$env:DATABASE_PATH = './teste.db'`).

Quatro detalhes que custam meia hora quando se descobre na marra:

- **`EXIGIR_CONFIRMACAO_EMAIL=nao` e `RESEND_API_KEY=` vazia não são enfeite.** O `server/.env` tem chave
  do Resend, e o `npm run dev` o carrega — então o cadastro passa a exigir confirmar o e-mail, a conta
  nasce trancada, e todo teste fica parado numa tela de "falta só confirmar" até estourar o tempo. Pior:
  o Syden TENTA MANDAR o e-mail, para um endereço inventado pelo teste. Zerar a chave fecha as duas
  coisas de uma vez.

- **`CORS_ORIGIN` precisa bater com o endereço do site.** Sem isso o navegador recusa toda chamada à API e
  os testes travam na tela de cadastro, sem explicação.
- **`DATABASE_PATH` é relativo à pasta `server/`**, porque é de lá que a API roda. `./teste.db` cria
  `server/teste.db`, e é esse o arquivo a apagar — não um `teste.db` na raiz.
- **O cadastro pede o código pelo LINK, não por um campo.** O campo saiu da tela; quem convida manda
  `?convite=…` no endereço. Sem isso o servidor responde 403 e a tela não diz nada de útil. O ajudante
  `criarConta` já faz isso — e o PRIMEIRO cadastro de um banco novo cai dentro da comunidade inicial do
  Syden em vez da vila, porque ele ganha essa comunidade.

- **`npm run dev:web -- --port 5174` não funciona:** o npm descarta o `--port` e o vite entende "5174"
  como nome de pasta. Daí o `npx vite` direto.

## Rodar

```bash
npm run test:e2e                 # todos
npm run test:e2e -- quarto-home  # só um
npm run test:e2e -- ideias idioma
```

Variáveis que o ajudante entende: `SITE` (padrão `http://localhost:5174`), `CONVITE` (padrão `teste`) e
`CHROME_PATH`, se o seu Chrome não estiver no lugar de sempre.

As fotos de tela vão para `e2e/fotos/` e não entram no Git.

## O que cada um cobre

| Teste | O que prova | Precisa de |
|---|---|---|
| `quarto-home` | a home é o quarto: o rótulo acende pelo desenho, o abajur troca dia e noite, os objetos abrem o que devem, o teclado chega | API + site |
| `ideias` | o ciclo da sugestão: enviar, o agradecimento automático, o dono acolher, o confete e a medalha | API + site, **banco limpo** |
| `idioma` | trocar de idioma sem recarregar, e o idioma do navegador na tela de entrada | API + site |
| `menu-elegante` | o menu do botão direito no nome de alguém: as ações, o teclado e as notas | API + site, **banco limpo** |
| `vila-ordem` | a ordem de desenho da vila (nada aparecendo na frente do que deveria tampá-lo) e a estátua | API + site |
| `sob-demanda` | transmissão só chega a quem abriu: quem não abriu não gasta banda nem processador | API + site + **LiveKit** |
| `producao` | **só olha, não cria nada**: confere o Syden que está no ar — arquivos, endereço da API, tela de entrada e páginas legais | nada (roda contra a internet) |
| `insignias` | a insígnia dos 25 primeiros: o presente espera, é resgatado com um clique e só então vai para o perfil | API + site |

"Banco limpo" quer dizer que o teste conta com um Syden recém-criado, porque **a primeira conta criada vira
dona do Syden** — e é a dona que acolhe ideias e administra. Como `ideias` e `menu-elegante` querem os dois
esse papel, eles não cabem na mesma rodada; o executor avisa se você pedir os dois juntos. O caminho é:

```bash
# pare a API, apague o banco e suba de novo, entre um e outro
rm -f server/teste.db server/teste.db-wal server/teste.db-shm
```

`vila-ordem` deixa os coelhos de fora da conferência de ordem de desenho, de propósito: eles andam o tempo
todo e são sempre desenhados por cima do cenário. O comentário dentro do teste explica o porquê e o que
aconteceria se um dia eles passeassem atrás das casas.

## csp.mjs — a política de segurança de conteúdo, antes de ir ao ar

Roda contra o Syden de verdade (`node e2e/csp.mjs`) e SÓ OLHA — como o producao.mjs.

Existe porque uma CSP errada não avisa: ela barra um arquivo em silêncio e o Syden abre em branco,
para todo mundo ao mesmo tempo, sem erro no servidor e sem nada no registro. É a única mudança de
configuração do projeto capaz de derrubar o app inteiro sem tocar no código.

A política proposta fica no próprio arquivo, comentada linha a linha. Mexeu nela, rode o teste antes
de publicar na Cloudflare.