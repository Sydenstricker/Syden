# Contato com a KaraFun — acesso ao catálogo por API

## Por que vale mandar

Eu tinha dito que esse contrato não sairia para um app pequeno. Isso era **palpite meu, não informação** — e palpite não vale como resposta. O que se sabe de fato:

- A KaraFun **tem** um programa OEM/API público (<https://business.karafun.com/oem>), com catálogo, letra sincronizada por sílaba e **licenciamento por conta deles**;
- eles não publicam preço nem mínimo, o que significa que é conversado caso a caso — e caso a caso é exatamente onde um pedido bem escrito tem chance;
- o modelo do Sydenstricker (**a pessoa paga por música, como no karaokê de rua**) é melhor para eles do que assinatura: recebem por execução, sem depender de o Syden ter base grande.

E há um argumento técnico que é nosso e é raro: no Syden **o áudio não passa pela chamada** — cada computador toca a própria cópia. Para quem licencia, isso é bom: cada execução é local, identificável e contável por usuário, em vez de uma transmissão de um para muitos. É mais fácil de licenciar, não mais difícil.

## Antes de enviar, confira

- [ ] O app já está **publicado** na Microsoft Store (não só enviado)? Se sim, ponha o link — muda o tom da conversa.
- [ ] Número de usuários ativos, de verdade. **Não aumente.** Eles conseguem verificar, e um número inflado encerra a conversa antes de começar.
- [ ] Um endereço de e-mail do domínio syden.chat, se houver. Um Gmail funciona, um domínio próprio pesa mais.

## A carta

> **Assunto:** OEM/API partnership enquiry — Syden (voice & karaoke app, Brazil)
>
> Hello,
>
> I'm the developer of **Syden** (<https://syden.chat>), a voice, video and text chat
> application for small groups of friends. It's free, it runs in the browser and as a
> Windows desktop app, and it has just been submitted to the Microsoft Store. Our users
> are in Brazil.
>
> Syden has a built-in karaoke feature, and I'd like to ask about your OEM/API programme.
>
> **Why the technical fit may interest you.** In Syden, karaoke audio does not travel
> through the voice call. Each participant's own machine plays its own copy of the track,
> locally and in sync, while only voices go over the call. This is why our karaoke sounds
> clean where screen-sharing approaches fail — and it also means every playback is a
> discrete, local, per-user event that we can count and report, rather than a
> one-to-many broadcast.
>
> **What I'd like to propose.** Rather than a subscription, a **pay-per-song model**: the
> end user pre-pays for each track they queue, exactly as people do in a physical karaoke
> venue, and your share is settled per play. I believe this is a better fit for both of us
> at our current size — you earn per actual use rather than per registered user, and we
> don't have to commit to volume we can't yet promise.
>
> **Being straightforward about our size.** Syden is small today: a few dozen active
> users, growing by word of mouth. I'm not going to present it as bigger than it is. What
> I can offer is a well-built product, a licensing-friendly playback architecture, and a
> market (Brazil) where karaoke is popular and legal catalogue access is scarce.
>
> My questions:
>
> 1. Is a pay-per-song arrangement something you can support commercially, or does the
>    programme require a subscription model?
> 2. What is the smallest viable arrangement you offer — is there a minimum commitment?
> 3. Does your licensing cover Brazil, including the ECAD obligations for public
>    performance, or would that remain ours to handle?
> 4. Does the API expose the syllable-synced lyrics for client-side rendering, or only
>    through your own player?
>
> Happy to send a build or give you access so you can see how the karaoke works.
>
> Thank you for your time,
>
> **Sydenstricker** — <https://syden.chat>

## Sobre a pergunta 3, que é a que decide

Essa é a que importa mais, e é a que não se pode esquecer. No Brasil a execução pública é
cobrada pelo **ECAD**, e isso é separado do direito que a KaraFun licencia. Se a licença
deles não cobrir o ECAD, sobra para o Syden — e aí o modelo por música precisa embutir esse
custo, ou a conta não fecha.

Se a resposta for não, ou nem vier, não se perdeu nada. E fica valendo a alternativa que já
está pronta: música própria gerada por código, mais o que é de domínio público de verdade
(ver `scripts/musica-de-exemplo.mjs`).
