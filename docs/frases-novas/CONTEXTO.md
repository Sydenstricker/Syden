# Contexto das frases novas de 23/11/2026 (para a tradução)

A lista está em `todas.json` (78 frases, em português do Brasil, exatamente como passadas a `t()`). São de cinco funções novas
do Syden, um app de conversa e voz para grupos de amigos (como o Discord):

- **Canal de avisos**: um canal de texto em que só quem administra a comunidade escreve; os outros leem, reagem e conversam nos
  "tópicos" (threads) de cada aviso. "(editada)" é a marca pequena ao lado de uma mensagem editada; "Editar mensagem" é o botão.
- **Pode moderar a conversa**: uma opção (caixa de marcar) num cargo (role) da comunidade.
- **Status da sala de voz**: um texto curto que quem está numa sala de voz põe embaixo do nome dela ("Ex.: ranqueada, não chamar"
  é o texto de exemplo do campo; "ranqueada" = partida ranqueada/ranked de jogo). "Some quando a sala esvazia" = o status
  desaparece sozinho quando a última pessoa sai.
- **Registro de moderação**: a lista do que quem administra fez. `{quem}` e `{alvo}` são NOMES de pessoas, `{canal}` é o nome de um
  canal, `{cargo}` o nome de um cargo, `{tempo}` uma duração já escrita ("10 minutos"), `{nome}` o novo nome de um canal.
  "Quem cuida do Syden" = a equipe que opera o app.
- **Convites com prazo**: links de convite que vencem e têm limite de usos. "{n} usos" (n ≥ 5), "{usos} de {max} usos",
  "Expira em {data}" ({data} já formatada), "Revogar convite" = invalidar o link.
- As frases que começam com letra maiúscula e terminam com ponto, e que dizem "não", são mensagens de erro do servidor.

Os marcadores `{...}` ficam exatamente como estão, sem traduzir. A ordem deles pode mudar se a língua pedir.
