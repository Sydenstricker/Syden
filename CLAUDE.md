# Decisões do Syden

Regras de produto que valem para sempre e não se descobrem lendo o código. Cada uma está aqui porque
foi decidida depois de tentar, e o custo de reaprender seria repetir o erro.

## Música: nunca fazer a nossa

**NUNCA MAIS tentar compor, gerar ou gravar música própria para o Syden.**

Foi tentado em 28/09/2026: um gerador em `scripts/musica-de-exemplo.mjs` produziu uma canção de
aniversário original (melodia, letra e síntese por código), para servir de exemplo no karaokê. A parte
técnica funcionou — áudio e letra saindo da mesma fonte, sem chance de dessincronizar — e **a música é
ruim.** Decisão do Sydenstricker, ao ouvir: não temos expertise em composição, tentar consome energia
que o produto precisa em outro lugar, e o resultado não tem a qualidade do resto do Syden.

**O caminho é música de terceiros, já validada e com tração.** Isso significa licenciamento, e
licenciamento é um problema comprável — ver `parcerias/karafun.md`.

Duas consequências que não dá para contornar:

1. **Ter a música não dá direito de transmiti-la.** Comprar um CD ou MP3 dá uma cópia para uso
   privado; execução pública e comunicação ao público são direitos separados que não vêm na compra.
   Não existe sistema que "verifique que o usuário tem direito" — o que existe (Content ID, Audible
   Magic, ACRCloud) **identifica** a faixa, não licencia.
2. **Domínio público da composição não libera a gravação.** O ECAD é explícito: mesmo com a obra em
   domínio público, arranjo e fonograma seguem protegidos por direitos conexos (intérprete, músicos,
   gravadora). "Ó Abre Alas" é livre como composição desde 2006; nenhuma gravação dela que exista por
   aí é livre por causa disso.

Enquanto não houver licença, **o karaokê continua sendo só o que os usuários sobem**, com a
responsabilidade em quem sobe (já está nos termos) — e o Syden não traz acervo nenhum.

O gerador continua no projeto como **ferramenta de teste**, para ter um arquivo de áudio com letra
sincronizada ao mexer no karaokê. Não é produto: a saída dele não mora em `web/public/`, e por isso
nunca vai para o site.

## O servidor na Alemanha NÃO põe o Syden na Europa

Eu afirmei que o servidor na Hetzner colocava o Syden dentro do DSA. **Estava errado**, e a correção
muda o que se declara em formulários e o que se implementa.

**O que decide o DSA é onde estão os USUÁRIOS, não onde está o servidor.** O Artigo 2(1) aplica-se a
serviços oferecidos a destinatários estabelecidos ou localizados na União, *"irrespective of where the
providers... have their place of establishment"*. E, explicitamente, a mera acessibilidade técnica a
partir da União não cria conexão substancial. Usuários no Brasil, app em português do Brasil, domínio
.chat: hoje não há conexão substancial com a União.

**O mesmo vale para o RGPD.** O Considerando 36 e as Diretrizes 3/2018 do EDPB dizem que meios
técnicos — servidor, centro de dados — **não constituem estabelecimento** por si sós. Alugar máquina na
Alemanha não estabelece o Syden na Europa.

**Em formulário, "located" é onde VOCÊ está: Brasil.** Foi assim no cadastro do Shield, e declarar EEA
seria declaração falsa (a Seção 3 dos termos deles é uma lista de garantias).

**O QUE SOBREVIVE À CORREÇÃO, e é o que sustenta a detecção:** a lei penal alemã alcança conteúdo
fisicamente armazenado na Alemanha, independentemente do DSA. CSAM num servidor alemão é crime na
Alemanha. Some-se o ECA Digital (Lei 15.211/2025), que alcança o Syden porque ele e os usuários estão
no Brasil: remoção e comunicação às autoridades são imediatas e independem de denúncia.

**O que muda a resposta no futuro:** abrir empresa, ganhar número relevante de usuários num país da UE,
ou mirar a UE de propósito — inclusive publicar a listagem da Store em mercados europeus, já que
português é língua da União (Portugal). Se isso acontecer, o DSA passa a valer e é preciso revisar.

## Animações: quem espera não tem texto, quem falhou tem

A regra vale para as telas desenhadas em SVG (ver `animacaoSVG/`):

- **Carregamento, entrada e espera → só o desenho, sem texto.** Um coelho comendo cenoura não precisa de
  legenda, e isso resolve 74 idiomas de uma vez. Há também um motivo técnico que não tem contorno: a tela
  de carregamento aparece ANTES de o JavaScript carregar, então `t()` ainda não existe. Traduzi-la
  exigiria um segundo mecanismo de idioma, só para ela.
- **Erro (404, 500, offline) → texto traduzido, com o código.** Aqui o texto é informação, não enfeite:
  quem está diante de um erro precisa saber o que houve e ter um código para repetir ao pedir ajuda. O
  formato é sempre `CÓDIGO — descrição`, no mesmo lugar nas três telas.

A exceção da exceção: a tela offline do app de desktop (`desktop/src/offline.html`) mora dentro do pacote
e não tem acesso ao i18n. Ela precisa do próprio dicionário pequeno, lendo `navigator.language` — porque
se houvesse internet para buscar a tradução, ela não estaria aparecendo.

## Idioma: detectar pelo navegador, nunca pelo IP

O Syden já começa no idioma da pessoa, lendo `navigator.languages` (ver `web/src/i18n/index.ts`).

**Isso não é localizar ninguém.** É a preferência que a própria pessoa configurou no navegador ou no
sistema, e que o navegador já manda para todo site que ela abre. Descobrir país por endereço de rede
seria outra coisa: mais invasivo e mais errado (VPN, quem mora fora, quem viaja).

A detecção é **padrão inicial, nunca trava**: a escolha explícita fica guardada e não é sobreposta.
