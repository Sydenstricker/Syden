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

## A tela não interrompe, não insiste e não mente

Quatro regras que vieram da pessoa que usa o Syden, na noite de 28/09/2026, olhando a entrada pelo
Google funcionar. Todas do mesmo tipo: a interface fazendo algo que ninguém pediu.

**Depois do "sim", não pergunte de novo.** Quem autorizou no provedor terminou o que tinha para
fazer. A entrada pelo app existia com uma segunda confirmação em cima — a do Windows, para o site
poder abrir o programa — e a resposta certa não foi explicá-la melhor: foi remover a necessidade dela
(o app pergunta ao servidor se terminou, ver `/api/auth/social/esperar`). Antes de melhorar o texto de
uma pergunta, pergunte se ela precisa existir.

**Não tome o primeiro plano.** A janela vindo para frente sozinha ao fim do login foi descrita como
"parece que ele toma controle do meu PC". E só apareceu no GitHub, que não mostra tela de permissão
nenhuma, então tudo acontecia no mesmo segundo do clique. Roubar o foco é o que programa ruim faz. O
sinal de que deu certo vai onde a pessoa já está olhando; trazer a janela só acontece quando ela pede
(clicar numa notificação, por exemplo). Piscar na barra de tarefas é o meio-termo aceitável.

**Quem vai pode voltar.** Toda tela para onde se manda alguém precisa do caminho de volta. A tela de
entrada não tinha nenhum: quem chegasse sem conta só saía apagando o `/app/` do endereço à mão.

**A tela não afirma o que não é, nem por meio segundo.** "Você não está em nenhuma comunidade" enquanto
a lista ainda vinha; o coelho girando de "espere" quando já tinha acabado; a barra lateral entrando
atrasada e empurrando tudo, o que o olho lê como travamento. Carregamento em etapas é normal e não
precisa ser escondido — o que não pode é a etapa intermediária **declarar** um estado que não é o
real. Na dúvida, guarde o lugar e não diga nada (ver `web/src/lugarDaBarra.ts`).

## Sem anúncios é promessa, não estilo

A listagem na Microsoft Store diz **"sem anúncios e sem assinatura"**, em letras grandes. Isso decide
escolhas técnicas, e já decidiu uma: em 29/09/2026, com a API do Tenor desligada pelo Google, a
alternativa mais usada do mercado (Klipy) era gratuita **porque insere anúncios entre os GIFs**.
Ficou de fora por isso, e a escolha foi o GIPHY, que cobra.

A regra que fica: **serviço de terceiro que se paga com anúncio dentro do Syden não entra**, mesmo
quando é o mais fácil e o mais barato. Se um dia a promessa mudar, ela muda na listagem primeiro —
não no meio de uma implementação.

## Os idiomas tratam por "você"

O Syden conversa, não atende. Em cada idioma isso é uma escolha concreta que se faz uma vez e vale
para sempre: **du** e não *Sie* no alemão, **ты** e não *вы* no russo, **tu** e não *vous* no
francês quando for direto à pessoa.

Não é informalidade por descuido: um app de amigos que trata por senhor soa como banco. E a decisão
precisa estar escrita porque ela se apresenta de novo a cada idioma novo, e cada tradutor — inclusive
eu — resolveria de um jeito.

**Conferir idioma que ninguém da dupla lê é medir, não confiar.** Suba o site construído, force o
idioma e meça: direção do documento, letras do alfabeto certo na tela, nenhum resto em português e
zero de estouro horizontal. O árabe passou por isso antes de ser publicado.

## Onde a língua esconde o gênero

Três idiomas seguidos mostraram que a pergunta ao abrir um idioma novo não é *"ele tem tratamento
formal?"*, é **"onde esta língua esconde o gênero?"** — porque o Syden não sabe o sexo de quem está
lendo, e um erro aqui atinge metade das pessoas em todas as frases.

- **Hauçá:** o gênero está em QUEM LÊ. `ka` para homem, `ki` para mulher — duas palavras, não um
  acento. Saída: imperativo pelado nos botões (não marca sexo) e `ku`, a segunda pessoa do plural,
  nas frases.
- **Tailandês:** está em QUEM FALA. As partículas de fim de frase ครับ (homem) e ค่ะ (mulher)
  declarariam um sexo para o próprio aplicativo. Saída: não usar nenhuma, que é o que as interfaces
  em tailandês fazem.
- **Amárico:** em quem lê de novo. አንተ / አንቺ, com os verbos acompanhando até o fim da frase. Saída:
  a forma de cortesia እርስዎ, que é neutra.

**O árabe tem a mesma divisão e passou batido**, porque o sufixo ـك se escreve igual para os dois sem
os sinais de vogal. As formas verbais dele seguem no masculino: é dívida conhecida, não descuido.

## Aprender idiomas dentro do Syden: arquivado, não descartado

**Decidido em 02/10/2026, pelo Sydenstricker: arquivado enquanto ele pesquisa um caminho melhor.** Ele
quer a funcionalidade no projeto; o que não existe ainda é o desenho certo.

Está escrito aqui porque o assunto **voltou três vezes** em conversas diferentes, sempre do zero, e
porque duas das conclusões abaixo custaram investigação:

1. **NÃO HÁ NADA DISSO NO REPOSITÓRIO** — nem código, nem documento, nem uma única chamada a modelo
   de linguagem no Syden inteiro. A lembrança de "já tínhamos planos" provavelmente vem do FICA ou do
   Biblioteca IA, que são do mesmo dono e usam LLM.
2. **Jornais dentro do app esbarram no mesmo muro do karaokê.** Manchete com link para fora é um
   formato seguro; mostrar o texto da matéria é republicar obra de terceiro. E ler é atividade
   solitária colada num app cujo valor é gente falando junto.
3. **A tela de idioma é o lugar errado**, e isso é o que mais importa guardar: ela é de
   CONFIGURAÇÃO, visitada uma vez. Pior, **o idioma da interface é um fato diferente do idioma que a
   pessoa estuda** — um brasileiro aprendendo japonês mantém o app em português. Se um dia isso
   existir, é na home.
4. **O caminho mais barato para descobrir se alguém quer**, antes de construir qualquer coisa: um
   campo no perfil — "idiomas que falo" e "idiomas que estou aprendendo". Usa o que já existe, não
   licencia nada, e cria o encontro de mão dupla que é a parte boa da ideia (quem ensina um precisa
   de quem ensina o outro).
5. **O bloqueio real não é técnico, é moderação.** Intercâmbio de idioma é desconhecido encontrando
   desconhecido, que é o problema mais difícil que existe — e o Syden tem uma pessoa moderando.

## A caixa-preta: exclusão apaga, mas 90 dias ficam para a justiça

**Decidido em 02/10/2026, pelo Sydenstricker.** O Syden apagava tudo de quem excluía a conta — o que
é certo para quem só quis ir embora, e deixava sem resposta o pedido judicial que chega depois.
Alguém comete uma atrocidade, apaga a conta, e a prova vai junto.

**Eu propus guardar só o que tivesse sido denunciado. Ele apontou o furo e o furo é real:** quem
ninguém denunciou a tempo sairia impune. Então guarda-se tudo o que serve de prova.

As regras, que são o que separa uma caixa-preta de um arquivo:

1. **Não existe rota.** Nenhuma, nem para o dono. O conteúdo só sai rodando
   `node scripts/caixa-preta.mjs` DENTRO do servidor — o que exige a chave SSH da máquina e deixa
   rastro nela. Uma tela de administração transformaria isso num diretório de tudo o que todo mundo
   já apagou, a um `isAdmin` errado de distância. **Há um teste que varre `server/src` inteiro e
   falha se qualquer arquivo que não seja `db.ts` citar a tabela.**
2. **90 dias, e a limpeza é automática** (na subida do servidor e uma vez por dia). Retenção que
   depende de alguém lembrar de limpar não é retenção de 90 dias: é retenção para sempre com uma boa
   intenção escrita ao lado.
3. **A senha não entra.** O hash não prova nada em juízo e guardá-lo é risco puro. "Tudo" quer dizer
   tudo o que serve de prova: quem era a pessoa, o que escreveu, quando, e os arquivos que anexou.
4. **Os arquivos não são copiados, só referenciados pelo sha** — eles já estão em disco endereçados
   pelo conteúdo. Por isso a vassoura de órfãos (`scripts/limpar-orfaos.mjs`) PRECISA ler a
   caixa-preta: sem isso ela apagaria a prova no dia seguinte, noventa dias antes do prazo.

**E os termos de uso precisam dizer isso.** Prometer exclusão e reter noventa dias, calado, seria
mentir para quem apaga a conta. Enquanto a linha não estiver lá, a função está incompleta.
