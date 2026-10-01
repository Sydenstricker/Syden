# Microsoft Store: textos da listagem do Syden

Cole cada bloco no campo correspondente do Partner Center. Tudo em português do Brasil.

## Informações básicas

| Campo | Valor |
|---|---|
| Nome do produto | Syden |
| Categoria | Social (subcategoria: Mensagens) |
| Preço | Grátis |
| Visibilidade | Oculto na loja; disponível só por link direto (grupo privado de amigos) |
| Política de privacidade | https://syden.chat/privacidade.html |
| Site do aplicativo | https://syden.chat/ |
| Contato de suporte | contato@syden.chat |

> **Os dois primeiros endereços apontavam para `sydenstricker.github.io` até 01/10/2026**, de quando o
> site morava no GitHub Pages. Hoje aquilo é redirecionamento, e a certificação da Store ABRE a URL da
> política de privacidade — redirecionamento costuma passar, mas é risco sem motivo. No Partner Center
> os três campos não ficam na descrição: ficam em **Propriedades → Informações de suporte**, e valem a
> partir da submissão em que forem trocados.
>
> **O contato era um link de issues do GitHub**, e isso é pedir que alguém crie conta no GitHub para
> dizer que o microfone não funciona. Virou `contato@syden.chat` — que é o MESMO endereço que os termos
> de uso já prometem (web/site/termos.html), e não um terceiro para manter. O domínio recebe pelo
> Cloudflare Email Routing, mas **cada apelido é criado um a um lá**: o MX existir não prova que este
> encaminha. Antes de confiar, mande um e-mail para ele e veja se chega.

## Descrição curta

Voz, vídeo, tela compartilhada e chat para o seu grupo de amigos. Crie a sua comunidade em um minuto.

## Descrição

Syden é o ponto de encontro do seu grupo de amigos: salas de voz, câmera, compartilhamento de tela e chat de
texto. Qualquer pessoa cria uma conta e monta a sua comunidade; nas comunidades, entra quem recebe o convite.

- Salas de voz com supressão de ruído e cancelamento de eco.
- Compartilhamento de tela em até 1080p a 60 quadros por segundo, com seletor de telas e janelas e áudio do
  computador opcional.
- Chat de texto com emojis personalizados do servidor.
- Soundboard: sons que tocam para todos na sala.
- Notificações do Windows e teclas de atalho globais para silenciar e ensurdecer, mesmo com o app minimizado.
- Fica na bandeja do sistema, pronto para a próxima conversa.
- Entrar com Google, Discord, GitHub ou Steam, além de nome e senha.
- Karaokê, jogos e enfeites: emojis, sons e molduras conquistadas no uso.
- Em português, inglês e espanhol.
- Moderação: quem administra a comunidade apaga mensagens e remove membros; cada pessoa pode excluir a própria conta.

Sem anúncios e sem assinatura. Voz, vídeo e telas compartilhadas não são gravados.

## Recursos (lista de "Product features")

- Salas de voz com supressão de ruído
- Compartilhamento de tela em até 1080p 60 fps
- Chat com emojis personalizados
- Soundboard do servidor
- Notificações e atalhos globais
- Comunidades privadas, com entrada por convite

## Palavras-chave

chat de voz, chamada em grupo, compartilhar tela, amigos, jogos, soundboard, servidor privado

## Classificação etária (questionário IARC)

Responda com sinceridade:
- **Os usuários podem interagir e se comunicar:** sim (chat de texto, voz e vídeo entre membros convidados).
- **Compartilha localização:** não.
- **Compras no app:** não.
- **Conteúdo gerado por usuários:** sim, com moderação pelo administrador (apagar mensagens, remover membros).

## Notas para certificação (campo "Notes for certification")

> Troque os dados da conta de teste antes de enviar. Crie a conta **depois** de o administrador já estar
> cadastrado em produção (o primeiro cadastro vira administrador).

```
Syden is a private voice, video and text chat app for an invite-only group of friends.
Registration requires an invite code, so please use this test account:

  Username: <usuario-de-teste>
  Password: <senha-de-teste>

How to test:
1. Launch Syden and sign in with the account above.
2. Text chat: open the "#geral" channel and send a message. The emoji button (right side of the message box)
   inserts custom server emojis.
3. Voice: click "Sala 1" to join a voice room. Allow microphone access if Windows asks.
   Use the controls at the bottom to mute, turn on the camera or share the screen (a custom picker lists
   screens and windows). The soundboard button plays a sound for everyone in the room.
4. Settings: gear icon at the bottom left (account, audio devices, notifications, members, emojis, soundboard).
   The account can be deleted in Settings > Minha conta > Excluir conta.

Voice, video and screen sharing are relayed in real time and never recorded.
The app is in Brazilian Portuguese.
Privacy policy: https://syden.chat/privacidade.html
```

## Capturas de tela (mínimo 1, recomendado 4)

Tamanho sugerido: 1920×1080 ou 1366×768, sem dados pessoais de ninguém além das contas de teste.

1. Sala de voz com duas ou mais pessoas (cartões com avatar).
2. Compartilhamento de tela em destaque.
3. Chat com emojis personalizados.
4. Configurações de voz e vídeo, ou o soundboard aberto.
