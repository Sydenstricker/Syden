# A API pública do Syden e a integração com jogos (o primeiro: a corrida em Godot)

**Plano escrito em 09/11/2026, a pedido dele, para retomar depois dos testes do PixelLab.** Nada disto foi construído.

## A ideia, nas palavras dele

Ele evolui um jogo de corrida próprio, em **Godot** (hoje roda no Windows; Linux não testado), e quer que ele se
integre ao Syden "como já ocorre com o Discord em outros jogos". E mais: **uma API pública ajudaria o Syden a se
popularizar, como ocorreu com o Discord** — os jogos levando gente até ele.

Isso muda uma conclusão antiga: em "Saber que alguém está jogando" (CLAUDE.md, 02/10/2026), o "vincule sua conta" do
Discord ficou fora porque "nenhum estúdio vai integrar um SDK do Syden". Agora o estúdio é ele.

## O que a análise de fora errou sobre o Syden (para não repetir)

Uma análise que ele trouxe supunha outro Syden. O real, medido em 09/11/2026:

- **"20 TB"** é a cota de TRÁFEGO mensal da máquina, não o que fica guardado. O guardado é da ordem de GB.
- **Banco:** SQLite (`janja.db`), não PostgreSQL. **Arquivos:** no disco, dentro do cofre cifrado (`docs/cofre.md`),
  não num armazenamento S3.
- **Já existem:** o endereço próprio da API (`api.syden.chat`, separado do site, que mora na Cloudflare), o Docker
  (API, Caddy, LiveKit) e o domínio nosso — mudar de servidor é trocar o DNS.
- **A máquina tem folga:** 2 núcleos e 4 GB; no `sar` de 08/11, ~12% de memória e ~99% do processador ocioso. Uma API
  de presença e convites quase não gasta tráfego (centenas de bytes por aviso).
- **O risco real é a disponibilidade:** uma máquina só, e depois de qualquer reinício a API fica fora até alguém abrir o
  cofre (a queda de 08/11/2026). Ele considera a disponibilidade boa (a Hetzner tem sido consistente; aquela foi a
  única queda) — mas um jogo de terceiros que DEPENDA da API sente cada minuto fora. Revisitar antes da etapa 2.

## O desenho: o caminho do Discord de verdade

O "está jogando X — Marina Bay, volta 2/2" do Discord **não passa por uma API pública na internet**: o jogo conversa
com o **app do Discord aberto no mesmo computador**, por um canal local, e o app repassa pela conexão que já tem com o
servidor. A API pública (com "Entrar com Discord") é OUTRA camada, para o que acontece sem ninguém com o app aberto.

### Etapa 1 — presença e convite pelo app, com um plugin Godot nosso (uns 3 a 5 dias)

- **O canal local:** o app de Windows (`desktop/`, Electron) abre um WebSocket em `127.0.0.1` (o Godot 4 fala
  WebSocket nativamente: `WebSocketPeer`), numa porta fixa com algumas alternativas. Só aceita conexão do próprio
  computador, confere a origem e exige um aperto de mão com o id do jogo.
- **Na primeira vez, a pessoa autoriza** ("A Corrida X quer mostrar o que você está jogando no Syden") — a regra da
  tela que não insiste: uma vez, guardada no aparelho.
- **Presença:** o jogo manda `{ jogo, detalhe ("Marina Bay"), estado ("Volta 2/2"), desde }`; o app repassa ao
  servidor pelo socket que já existe, e o Syden mostra no "Jogando agora" e no perfil — **só para quem já pode ver**
  (amigos, a comunidade, as proteções de menores). Some quando o jogo fecha ou o app perde o jogo.
- **Convite:** "Convidar para a corrida" na conversa ou na sala de voz manda um código de partida; quem aceita tem o
  jogo aberto pelo link `syden://jogar/<jogo>?partida=<código>` (o app já registra `syden://` para o login social) —
  e o jogo recebe o código pelo canal local.
- **O plugin Godot:** um addon pequeno (`syden.gd`): `Syden.conectar(id_do_jogo)`, `Syden.presenca(detalhe, estado)`,
  `Syden.limpar()`, o sinal `convite_aceito(codigo)`. É a primeira peça que qualquer jogo em Godot pode usar.
- **Limite honesto:** só funciona com o **app de Windows** aberto; quem usa o Syden no navegador não manda presença (a
  mesma limitação da detecção de jogos, CLAUDE.md).

### Etapa 2 — a API pública e o "Entrar com Syden" (1 a 2 semanas)

Para o que o SERVIDOR de um jogo faz sem ninguém com o app aberto: postar o resultado de uma corrida num canal, um
ranking da comunidade, ver amigos e convidar a partir do jogo.

- **Registro de apps** (nome, ícone, endereços de retorno), feito por quem cuida do Syden no começo.
- **OAuth 2 com PKCE** ("Entrar com Syden"): a pessoa vê o que o app pede e autoriza; **tokens com escopo**
  (`identidade`, `amigos`, `presenca`, `postar-resultado:<canal>`), que ela pode revogar em Minha conta.
- **Limite de pedidos por app** e por pessoa, para um app abusivo não derrubar o resto.
- **Versão no endereço** (`/api/v1/…`), separada das rotas internas do site, que continuam livres para mudar.
- **Os primeiros recursos:** identidade básica, amigos (só os que aceitam aparecer para apps), presença, convite,
  postar resultado num canal autorizado pela comunidade (quem administra libera o app no canal).

### Etapa 3 — o portal de desenvolvedores

A documentação, o plugin Godot publicado e a página para outros estúdios registrarem os apps deles. É aqui que a API
vira canal de popularização.

## Regras que valem antes de qualquer etapa ir ao ar

- **Política de privacidade:** o que o jogo manda, quem vê, por quanto tempo fica, e (etapa 2) o que cada escopo dá a
  um app de fora — ANTES de publicar, como manda o resto do projeto.
- **Adolescentes (ECA Digital):** a presença e os convites seguem as proteções que existem (`server/src/protecao.ts`):
  o que um menor joga só para os amigos; convite de estranho, não. Na etapa 2, app de fora não vê menor nenhum sem as
  mesmas regras.
- **Sem anúncios é promessa:** um app integrado não pode trazer anúncio para dentro do Syden (CLAUDE.md).
- **Não é uma porta para dados:** a API nunca expõe conversa privada, e-mail, idade ou o que a pessoa não autorizou.

## Para retomar

1. Ler este plano com ele e confirmar a etapa 1.
2. Detalhar o formato das mensagens do canal local (versão, aperto de mão, erros) e o que o plugin expõe.
3. Fazer a etapa 1 de ponta a ponta com o jogo de corrida dele: presença aparecendo para um amigo e um convite abrindo
   o jogo do outro lado.
