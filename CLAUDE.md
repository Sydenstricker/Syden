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

**A outra metade de "quem sobe responde" existe desde 11/10/2026:** quem tem o direito escreve para
direitos@syden.chat (termos, seção 4), e quem cuida do Syden retira pelo painel (Uso do servidor → Direito
autoral): procura pelo nome, retira dizendo quem reclamou, e quem subiu recebe o aviso numa conversa privada,
onde pode contestar. Cada retirada fica registrada por pessoa — a reincidência que os termos dizem custar a
conta aparece ali, mas banir continua sendo decisão de uma pessoa. Cobre sons, músicas do karaokê, emojis
(de comunidade e de pacote) e anexos. **Retirar leva as cópias do mesmo arquivo** (mesmo sha: o emoji de pacote é
copiado para cada comunidade que instala). **Anexo só dos canais de comunidade:** a busca nunca olha conversa
privada, senão o painel viraria um jeito de ver os nomes dos arquivos trocados no particular.

O gerador continua no projeto como **ferramenta de teste**, para ter um arquivo de áudio com letra
sincronizada ao mexer no karaokê. Não é produto: a saída dele não mora em `web/public/`, e por isso
nunca vai para o site.

## Som de meme é da pessoa que sobe, nunca do Syden

**Decidido em 03/10/2026, pelo Sydenstricker.** Os sete pacotes de som que vinham de fábrica (meme,
futebol, Lula e Bolsonaro, streamer…) eram todos áudio de terceiros, e saíram do repositório. No
servidor eles viraram pacotes da conta de quem cuida do Syden (`entregarPacotesDeFabrica`): quem
tinha instalado continua com eles, e conta nova não ganha pacote nenhum de presente.

A razão é a mesma da música: **quem sobe responde pelo que sobe, quem distribui responde como
publicador.** É o modelo do MyInstants e do soundboard do Discord — o próprio Discord não traz meme
de terceiro nos sons que vêm com ele. Pacote de fábrica, se voltar a existir, é só de material livre.

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

**Idioma da listagem não é mercado** (decisão dele, 09/10/2026): os mercados europeus estão DESMARCADOS na Store, e
por isso a listagem pode ter alemão, francês, italiano etc. sem dirigir o app à União. O que decide é a
disponibilidade por mercado; quem um dia marcar um país da UE ali reabre a revisão acima.

## Animações: quem espera não tem texto, quem falhou tem

A regra vale para as telas desenhadas em SVG (ver `animacaoSVG/`):

- **Carregamento, entrada e espera → só o desenho, sem texto.** Um coelho comendo cenoura não precisa de
  legenda, e isso resolve 74 idiomas de uma vez. Há também um motivo técnico que não tem contorno: a tela
  de carregamento aparece ANTES de o JavaScript carregar, então `t()` ainda não existe. Traduzi-la
  exigiria um segundo mecanismo de idioma, só para ela.
- **Erro (404, 500, offline) → texto traduzido, com o código.** Aqui o texto é informação, não enfeite:
  quem está diante de um erro precisa saber o que houve e ter um código para repetir ao pedir ajuda. O
  formato é sempre `CÓDIGO — descrição`, no mesmo lugar nas três telas.

**O mascote é o personagem; o D4 é a marca.** Decidido em 05/10/2026, depois de tentar pôr um rosto
dentro do balão do ícone ("estamos forçando demais"). O coelho antigo, sem a estrela, é quem espera,
cumprimenta, canta, apresenta e fica sem internet — tem cara, e cara é o que o torna amigável. O D4
(orelhas, balão, três pontos) é o ícone, o avatar e a conversa acontecendo. Quando os dois aparecem
juntos, a cabeça do coelho VIRA o balão, ancorada nas orelhas. Os desenhos nascem no estúdio
(`animacaoSVG/animacoes_d4.html`) e vão para o app por `animacaoSVG/exportar-mascote.mjs` — o arquivo
exportado não se edita à mão. O texto dos erros nunca vai dentro do SVG: vai em HTML, para ser traduzido.

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
os sinais de vogal. **Paga em 13/10/2026:** 132 frases reescritas — botões no nome de ação (masdar: إرسال، حذف),
frases com يمكنك/يُرجى + masdar ou na passiva, e {nome} de terceiro como substantivo ("بث {nome}"). Ficou no masculino
só o genérico de terceiros indefinidos (كل لاعب، من يرسم), que é a norma, e três rótulos de status (متاح، غائب،
غير متصل) sem forma neutra idiomática. Frase nova em árabe nasce assim.

## Culturas na home (idiomas, leitura, culinária, dança, música)

**REMOVIDA INTEIRA em 06/10/2026, pelo Sydenstricker, depois de ver no ar:** *"uma qualidade ruim no
geral. A intenção era estimular o usuário, mas a baixa qualidade vai apenas poluir a interface."* Saiu
tudo: a faixa da home, as abas (comida, dança, música, teatro), a cultura da turma e a aba dela no
modo sala. O que está abaixo fica como registro do que foi tentado e medido.

**A lição, e é ela que vale reler antes de voltar ao assunto:** "quem escolhe o conteúdo são as APIs
das fontes" garante a licença, NÃO a qualidade. Medido no dia: "Cuisine of Brazil" trazia fotos de
mandioca crua e de churrascaria em outro país; "Dance of" e os áudios do Commons eram desiguais de país
para país; o teatro do Gutenberg era capa genérica. A home é o lugar mais visto do app, e conteúdo
mediano ali é pior do que nenhum. Fontes medidas e descartadas para quem retomar: a API do Met deu 410
(desligada), as receitas da Wikibooks só existem em inglês, e o Openverse buscando o país trazia faixas
que só levam o nome dele no título.

**A primeira faixa foi construída em 03/10/2026** (`server/src/cultura.ts`, `web/src/Cultura.tsx`):
fotos do país da pessoa ("Quality images of <país>", no Commons) e livros na língua dela (Gutendex).
O que decidiu a forma, medido no dia:

- **O tom ("otimista, como a TV Cultura") vem de quais seções se ligam, não de uma fonte.** O feed
  diário da Wikipédia ficou de fora: o "Você sabia?" trazia o dono de um site pornográfico e o "neste
  dia" abria com política. Mesmo nas imagens de qualidade há um filtro pelas categorias do arquivo.
- **O país sai da preferência de idioma do sistema** ("pt-BR" → Brasil), nunca do IP.
- **O servidor busca e entrega tudo**; o navegador não fala com Wikimedia nem Gutenberg (o e2e
  `cultura.mjs` confere).
- Livros só aparecem com três ou mais: em árabe, o Gutenberg só tinha uma homenagem ao fundador.

Música, dança e culinária continuam só no desenho abaixo.

**Decidido em 03/10/2026, pelo Sydenstricker, retomando o assunto arquivado logo abaixo.** O tema
cresceu: não é só aprender idioma, é **se conectar com outras culturas**, e o formato tem de aceitar
culinária, dança, música e o que vier. O que ficou decidido:

1. **Quem escolhe o conteúdo são as APIs das fontes**, não uma pessoa. Por isso a escolha das fontes é
   a decisão que importa — e o critério é o do karaokê e das fontes de letra: só entra o que tem
   licença que permite mostrar dentro do Syden, item por item.
2. **O conteúdo aparece na LÍNGUA DE ORIGEM.** O objetivo é a pessoa interagir com o japonês, não ler
   uma receita japonesa em português. Tradução é ajuda opcional para quem tem pouca intimidade com a
   língua — e o custo de traduzir entre 34 línguas ainda está em aberto (ver abaixo).
3. **"Conversar sobre isso" virando subcomunidades por tópico ficou FORA, por escopo.** Quem se
   interessar cria a comunidade; o Syden não monta uma por assunto.

**As fontes, conferidas em 03/10/2026:**

- **Gutendex** (gutendex.com) — os livros do Project Gutenberg, domínio público, filtráveis por
  língua (`languages=ja`) e assunto. Sem chave. Pede para quem usa muito hospedar a própria cópia,
  que é código aberto — para o Syden, que guardaria o resultado, cabe.
- **Openverse** (api.openverse.org) — música e imagem com a LICENÇA de cada item, o texto de
  atribuição pronto, filtro `license_type=commercial` e marca de conteúdo adulto (`mature`). Sem
  chave. É a melhor candidata para música e dança.
- **Wikimedia** (Wikibooks, Wikisource, Commons) — receitas do livro de culinária da Wikibooks
  (CC BY-SA), textos em dezenas de línguas, vídeos e imagens com licença na própria API.
- Não servem: TheMealDB e parecidos (receita sem licença declarada); qualquer catálogo de anime.

**A tradução, se um dia entrar:** um serviço de terceiro (DeepL, Google) mandaria o texto para fora
e entraria na política de privacidade; o **LibreTranslate** roda no próprio servidor do Syden, sem
terceiro, ao custo de memória na Hetzner e qualidade menor. Traduzir só quando a pessoa PEDE, item a
item, mantém o custo proporcional ao uso, e não aos 34 idiomas.

**O que continua valendo da decisão anterior** está logo abaixo.

## Mini-games: pesquisado, pendente

**Registrado em 06/10/2026, pelo Sydenstricker: fica como pendência, depois da home.** A ideia veio
do Magnitudle e do TimeGuessr: jogos de adivinhar que rendem conversa com uma pessoa transmitindo e
a sala chutando junto.

**Embutir site de terceiro está fora:** o Magnitudle carrega a rede de anúncios Mediavine, e embutir
seria anúncio dentro do Syden (ver "Sem anúncios é promessa"). LINKAR para fora pode: o anúncio e o
rastreio ficam com quem abre o site, e quem só assiste a transmissão recebe o vídeo. Cuidado com o
endereço: o certo é **timeguessr.com**, e "timeguesser.com" (com "e") leva para um golpe.

**Varredura de 07/10/2026, num Chrome de verdade** (12 s na página, contando os domínios de anúncio
que ela chama). **Ela DESMENTIU a de 06/10**, que só leu o HTML: TimeGuessr, WorldGuessr, City
Guesser, Framed e Higher Lower carregam rede de anúncio pelo JavaScript. Lição: site moderno é um
esqueleto, e anúncio só se mede com o navegador rodando.
- Sem anúncio: Lichess, Clues by Sam, Neal.fun, Wikitrivia, JKLM.fun, Scribble.rs, OGS (Go),
  Termo (pt-BR, só Google Analytics), horsepaste (Codenames, só Google Analytics).
- Com anúncio: TimeGuessr, WorldGuessr, City Guesser, Framed, Higher Lower, Conexo, Contexto,
  Magnitudle, sizeitup.games, sudoku.com, Wordle, Nerdle, Quordle, e (de 06/10) Globle, Worldle,
  GuessThe.Game, WhenTaken, Skribbl, Letreco, GeoGuessr.
- Gartic Phone e Gartic.io quase não carregaram nada na entrada, mas mostram anúncio jogando: fora.
- Ressalva: só a página de entrada foi medida. Anúncio pode aparecer no meio da partida.
- **A promessa da lista é "sem anúncio", não "sem rastreio"** (decisão dele, 13/10/2026: "sem anúncio é honesto"). O
  rastreio de um site que a pessoa abre por vontade própria é entre ela e o site. Por isso o **Termo** entrou (só Google
  Analytics).
- **Todo mundo vê todos os sites**, com o nome da língua do site quando ela não é a de quem lê (decisão dele, mesmo
  dia): esconder por idioma tiraria de quem não configurou a chance de conhecer, e esconderia de nós os jogos
  africanos e asiáticos.
- **Site sem anúncio que deixa ser embutido RODA DENTRO do Syden** (`SiteEmbutido.tsx`, depois do clique, só para
  quem clicou), corrigindo o "embutir está fora" de 06/10, que era sobre anúncio. Nas palavras dele: "a comodidade da
  aba de mini-games é justamente rodar no Syden; não temos anúncio, que é o prometido". O preço é trabalho, não
  promessa: o site entra na frame-src (`e2e/politica-de-seguranca.mjs` E a Cloudflare, à mão) e o que ele carrega
  entra na política de privacidade (`#jogos-de-parceiros`) ANTES de ir ao ar. Primeiro: o Termo. Na sala de voz o jogo ocupa o PALCO
  (o lugar do vídeo), com a lista de gente e a barra da call à mão — desenho dele; fora da sala, janela por cima.

**Licenças conferidas em 07/10/2026** (o Syden é de código fechado, "todos os direitos reservados", e
isso decide quais bibliotecas podem entrar):
- **Problemas de xadrez do Lichess: CC0** (database.lichess.org, 6,1 milhões, com nota de dificuldade e
  tema). Baixa-se uma vez e serve-se do nosso servidor; o navegador não fala com o Lichess.
- **chessground (o tabuleiro do Lichess): GPL-3, NÃO pode** — obrigaria abrir o código do Syden. Os
  que podem: chess.js (BSD-2, as regras) e cm-chessboard (MIT, o tabuleiro).
- **Scribble.rs: BSD-3 (menos o logo), ativo, mas sem português**: nem na tela, nem na lista de
  palavras (13 idiomas, nenhum pt). Hospedá-lo pede tradução e lista nossas.
- **PhyloPic** (silhuetas de bicho): cada imagem tem a sua licença. CC0 e domínio público, sem
  exigência; CC BY pede crédito; ShareAlike e NC ficam de fora.

**O que ficou decidido em 07/10/2026, depois de comparar na conversa do Sydenstricker:**
- **O critério é tração + manutenção baixa.** Jogo com público comprovado (os clássicos: a regra é
  pública, a fama é do jogo e não de um app) e conteúdo que não precisa de gente para continuar.
- **Os 71 idiomas não excluem jogo de palavra, são a vantagem do Syden** (correção dele, mesmo dia).
  Jogo sem palavra (sudoku, Gomoku, Mancala, xadrez) sai pronto no mundo inteiro; nos de palavra, o
  mesmo processo das traduções da interface traduz categorias do Stop, papéis do Lobisomem, nomes
  dos objetos do Size It Up e a lista de desenho. A exceção é a palavra do dia estilo Termo: ela pede
  um DICIONÁRIO de palavras válidas de 5 letras por idioma, e tradução não produz isso.
- **Jogo nosso roda DENTRO do Syden** (na aba de jogos ou na sala de voz, com a turma vendo). Site
  de terceiro abre FORA, no navegador. O Lichess ao vivo é o meio-termo: dentro, mas só depois do
  clique da pessoa.
- **Parceria (Magnitudle, Termo, Gartic) fica para quando houver volume:** sem usuários, a troca é
  desigual, e a renda deles é anúncio.
- **O Size It Up será NOSSO, com manutenção a cada 2 semanas** (decisão dele, mesmo sendo gênero de
  pouca tração). O desenho e a rotina de manutenção ainda serão propostos.

**Feito em 12/10/2026 (degraus 1 e 2, com o primeiro jogo):** o "Qual é maior?" (o Size It Up nosso) roda na sala de
voz: botão de videogame na barra, painel que abre sozinho para a sala inteira, 8 rodadas, votos escondidos até a
revelação, placar. O servidor decide tudo e a partida mora só na memória (`server/src/minijogos.ts`); os nomes dos
objetos ficam no site, traduzidos, e os tamanhos só no servidor (um teste confere que as listas batem). O computador do
quarto abre os Mini-games: escolher uma sala entra e já começa, e embaixo ficam os sites sem anúncio para transmitir.
**Manutenção do conteúdo:** acrescentar objeto é uma linha em cada um dos dois `minijogos.ts` e a tradução do nome.
**Refeito em 13/10/2026 como o Size It Up de verdade** (ele jogou as duas cartas e "não era o que eu imaginei"): agora é
o **"Qual é o tamanho?"**. A referência aparece com o tamanho dito, e ao lado o objeto que cada um aumenta e diminui
(arrastando, pela roda ou pela barra) até achar a proporção. O palpite vai ao servidor enquanto a pessoa mexe, e não
só no "Confirmar". Os pontos medem o erro em PROPORÇÃO: 100 na mosca, 50 errando pelo dobro ou pela metade, zero a
partir de 4×. Na revelação o objeto vai ao tamanho real, e o palpite vira a SILHUETA do mesmo desenho (atrás quando
é maior, na frente quando é menor), como no Size It Up.
**As figuras são do Fluent Emoji da Microsoft (MIT), embutidas** em `web/public/tamanho/` com a licença ao lado
(`web/scripts/figuras-do-tamanho.mjs` baixa, corta a borda e mede). O emoji do sistema não servia: muda de sistema para
sistema e vinha com objeto que não batia com o nome (o urso era só a cabeça, a pizza uma fatia). A altura do desenho é a
altura do objeto e a largura é o comprimento; os desenhados na diagonal medem pela diagonal (`NA_DIAGONAL`), e o anel de
Júpiter é descontado (`PARTE_MEDIDA`). **Objeto novo só entra se o desenho mostrar o objeto INTEIRO.**
**Categorias, como no Size It Up (13/10/2026):** ao clicar na capa, quem começa escolhe Tudo, Animais, Dia a dia ou
Gigantes (prédios, veículos, montanhas e planetas). Quais objetos entram em cada uma mora no servidor (`CATEGORIAS`); o
nome e as três figuras do botão, no site. Categoria nova precisa de objetos que se encadeiem (1,5× a 20×) para render 8
rodadas sem repetir o objeto a estimar — o teste do servidor confere.

**Mais quatro no mesmo dia, antes de subir** (decisão dele: "mini-games no plural com um jogo só não faz sentido"):
Stop, Sudoku em corrida, Cinco em linha e Mancala. O botão da sala abre uma ESTANTE com uma capa por jogo, sem texto
de explicação (pedido dele: "mais limpa"). Cada jogo é uma máquina no servidor sobre um motor comum
(`server/src/minijogo-motor.ts`): o estado é pedido POR PESSOA, porque no Stop as respostas dos outros ficam
escondidas até o STOP e no Sudoku cada um vê só o próprio tabuleiro. As letras do Stop vêm da escrita de quem começa
(`letrasDoStop`), e a turma decide o que vale (mais da metade dos outros contestando derruba a resposta). Os de duas
pessoas têm a mesa: quem começa senta, o primeiro da sala que apertar "Jogar" senta do outro lado, e o resto assiste.

**Degrau 3, no mesmo dia:** o **Lobisomem** (o Syden é o narrador; 4 pessoas ou mais; os papéis têm nomes que não dizem o
sexo de quem os recebe: "Anjo" no lugar de médico, "Da vila" no lugar de aldeão) e os **problemas de xadrez do
Lichess**, em corrida: 1000 problemas CC0 em `server/assets/`, tirados por `server/scripts/problemas-de-xadrez.mjs`
(o arquivo do Lichess é pzstd, com quadros puláveis que o Node não pula sozinho). O servidor não tem biblioteca de
xadrez: só compara o lance com a solução e move as peças.

**O desenha e adivinha (o Gartic do Syden), no mesmo dia, nos 71 idiomas e não só em pt-BR:** a lista de 263 palavras é
NOSSA (escrita para o Syden, sem fonte de terceiro) e passa pela tradução como o resto. Quem desenha manda a palavra na
língua dele ao escolher, e os chutes são conferidos contra ela. O traço vai pelo socket (`minijogo:tempo-real`, o
`tempoReal` do motor), em pedaços numerados de 40 ms: os pedaços se JUNTAM no site, e só a `versao` (apagar/desfazer)
troca o desenho inteiro. Falta do degrau 4 só a palavra do dia, que pede um dicionário com licença (decisão dele).

**A estante em duas abas e a Palavra secreta (14/10/2026, pedido dele):** **Solo** (dá para jogar sozinho: Qual é o
tamanho?, Problemas de xadrez, Sudoku e o Termo de parceiro) e **Coletivo** (o jogo é a turma: Stop, Desenha e adivinha,
Lobisomem, Palavra secreta, Cinco em linha, Mancala) — `grupo` em `JOGOS`, no site. A **Palavra secreta** é o Termo da
turma, em corrida: a mesma palavra para todos, 6 chutes cada um, a sala vê as CORES dos outros e nunca as letras, 3 rodadas
(`server/src/minijogo-palavra.ts`). O dicionário foi resolvido assim: as palavras que SAEM são nossas (373, escritas para o
Syden), e as que se pode CHUTAR (~18 mil) saem do **VERO**, o corretor do LibreOffice (LGPLv3/MPL), expandido e guardado
em `server/assets/palavra-secreta/` com o leia-me dele. **Ele fica só no servidor**: o site manda o chute e recebe as cores.
Por enquanto só em português — idioma novo pede um dicionário, e tradução não produz um; quem lê noutra língua vê o jogo
com "· português" ao lado do nome.

**A sondagem de jogos dele (12/10/2026), avaliada:** os campeões de receita (Coin Master, Candy Crush, Sheep a Sheep)
são solo e se pagam com anúncio, vidas e roleta. **Decisão dele: clonar só a MECÂNICA DE JOGO** (empilhar e combinar
peças, parafusos, setas, combinar três) — nunca a de cassino nem a de "volte todo dia". Integração, nenhuma. Party game de ação (Mario Party, Overcooked) tem aderência
baixa (meses de trabalho, atraso de rede, qualidade abaixo do original); os de turno estilo Jackbox, telefone sem fio de
desenho e Codenames têm aderência alta. A recomendação foi medir quais dos 8 a turma joga antes do nono.

**O caminho combinado, em degraus:**
1. Uma lista de links na home ("Mini-games"), só com os sites SEM anúncio acima, com a dica "abra,
   transmita e adivinhem juntos". Umas 2 horas.
2. A base "jogo na sala de voz" (cada um responde na própria tela, revelação junta), sobre o
   socket.io que já existe: 2 a 3 dias. Primeiros: o Size It Up nosso, sudoku, Gomoku e Mancala.
3. Stop e Lobisomem (os melhores para voz) e os problemas de xadrez do Lichess.
4. Só em pt-BR, se pegar: palavra do dia e desenho-e-adivinhação.
5. Adiado: trivia, truco, mahjong, "Onde e quando?" com foto (o TimeGuessr nosso: curadoria pesada,
   a mesma lição da aba de cultura).

## Gerar arte com IA: interesse registrado, não agora

**Decidido em 03/10/2026, pelo Sydenstricker: amadurecer como foi feito com os idiomas, mas não
continuar agora.** O que se sabe até aqui: as ferramentas com API (PixelLab e Retro Diffusion para
pixel art, Recraft para vetor/SVG, Scenario para treinar um estilo próprio) dispensariam dominar a
ferramenta — o Syden as chamaria por script e ele julgaria o resultado. O problema a resolver não é
qualidade, é CONSISTÊNCIA entre dezenas de peças. O primeiro passo combinado, quando retomar: uma
peça só (o coelho em três poses) gerada em duas ou três delas, lado a lado.

**Retomado em 06/10/2026: o primeiro passo foi feito** (`e2e/pixel-art/`, com a folha de comparação, os
custos e o que surpreendeu no README). O Sydenstricker gostou do **Retro Diffusion Pro** e do **PixelLab
Pro**, os dois com o coelho como referência de personagem. O PixelLab normal falhou em consistência.

**A ideia que veio daí: trocar a vila em vetor por um cenário em pixel art** (cidade ou quarto). O que
ficou combinado:
- **Peças, nunca uma imagem inteira.** A vila é um tabuleiro interativo (casas clicáveis, coelhos
  andando, cenoura plantada). Uma cena gerada numa imagem só vira papel de parede. Gera-se chão, objetos
  e personagens separados, e o código monta no tabuleiro de hoje (`iso()`, em `Vila.tsx`).
- **Piloto: o quarto, não a cidade.** Umas 15 peças contra dezenas; mede se o estilo se sustenta antes
  de enfrentar a consistência em escala.
- **O que o vetor faz e a pixel art não faz sozinha:** seguir as paletas de Aparência e ter a versão
  da noite (saída: troca de paleta cor por cor, como os jogos antigos), e crescer suave (pixel art só
  amplia em inteiros: 2×, 3×, 4×).
- **Decidido em 07/10/2026: a HOME vira o quarto do coelho, em pixel art isométrica**, com os objetos
  clicáveis como o quarto do gato no FICA. A referência visual é `imagem/Sugestao/home.png` (quarto à
  noite: cama com o coelho lendo, gato, estante, janela, mesa com computador, tapete e pufe). Cada
  função da home de hoje vai para um objeto do quarto, e os mini-games entram por ele. A cidade (sair
  do quarto) fica para depois. O conceito foi feito no ChatGPT, só como referência.
- **O tom: aconchegante, pouco estímulo, acolhedor, e funcional como home.** A paleta foi delegada:
  poucas cores, quentes e pouco saturadas, sem preto nem branco puros. Ela é fixa e imposta nas duas
  ferramentas; o quarto NÃO segue as paletas de Aparência.
- **Dia e noite próprios do quarto** (relógio real ou tempo próprio: a decidir). Uma só arte de dia,
  e a noite feita por código (camada escura + luz do abajur, do monitor e da janela), o que dá também
  o entardecer sem gerar três versões.
- **Feito em 07/10/2026: o kit do quarto e a página de teste** (`e2e/pixel-art/quarto/`, abrir
  `quarto.html`). Ele assinou o PixelLab (US$ 12, 2.000 gerações) e pôs US$ 5 no Retro Diffusion. **O
  PixelLab ganhou a comparação** (4 a 64 variações por chamada, fiéis ao conceito; o RD, uma imagem por
  US$ 0,18, com defeitos). O kit inteiro custou 325 gerações. A paleta imposta à mão PIOROU as peças e
  ficou de fora. O guarda-roupa não coube. O que se aprendeu está no README da pasta.
- **MUDOU O MÉTODO, no mesmo dia: cenário pintado inteiro + poucas peças vivas** (`e2e/pixel-art/quarto/
  hibrido/`). As peças soltas ficaram muito abaixo do conceito, e **não por resolução** (medido: o conceito
  reduzido à mesma resolução continua bonito). O que faltava era luz, sombra entre os objetos, uma mão só e
  recheio. Isso revê o "peças, nunca uma imagem inteira" acima: **os móveis são áreas de clique sobre a
  pintura; só o que se mexe (coelho, gato) é peça.** O cenário é o próprio conceito (ele liberou usá-lo como
  arte final), convertido com o `unzoom` do PixelLab para 313 px de pixel art de verdade, e repintado no
  estilo dele para o que falta. O dia é uma segunda pintura do mesmo quarto.
- **A repintura é nossa, ao preparar a arte, nunca do Syden em funcionamento.** O custo de quadro fixo: a
  pessoa não arruma o próprio quarto. Se isso um dia entrar, a saída são variações já pintadas.
- **MUDOU DE NOVO, em 07–08/10/2026: móveis SOLTOS numa grade, num quarto NOVO gerado em pixel art**
  (`e2e/pixel-art/quarto/novo/`). O quarto híbrido (`hibrido/quarto.html`) ficou bonito, mas é fixo, e ele
  quer arrumar o quarto. O que foi decidido e medido no caminho:
  - **Grade no chão inteiro** (casas de parede a parede, como no desenho dele) e **grade nas paredes** para
    quadros e prateleiras. Cada móvel ocupa as suas casas; quem está mais à frente é desenhado por cima.
  - **Luz: o código só ajusta intensidade** (clarear, escurecer, esquentar, pelo mapa de luz); a DIREÇÃO do
    brilho vem de **três versões pintadas por móvel**, escolhidas pela posição — o meio-termo entre pintar
    uma imagem por casa (64) e nenhuma. Reacender por código (normais pela silhueta) destruiu o desenho
    (`hibrido/grade/falhas/`).
  - **A janela é fixa:** é a fonte da luz, pintada na parede e no chão. Troca-se a aparência, nunca o lugar. (Revisto em
    15/10/2026: a janela ANDA e troca de tipo; ver "A janela se arrasta" mais abaixo.)
  - **Esvaziar a pintura do conceito não deu:** a edição do PixelLab redesenhou o quarto, e a reconstrução por
    código ficou abaixo do ideal (`hibrido/vazio/`). Daí o quarto novo, já gerado como pixel art: **pixel art
    que nasce na grade tem bordas limpas** (as do conceito convertido têm degraus desiguais, e o
    `correct-pixelart` não conserta).
  - **A minha recomendação foi a `novo/bases/pl-384-taverna-1.png` (ele escolheu outra, ver abaixo)** — PixelLab, 384
    px, com a luz da `rd-pro-1` como referência e a porta de taverna na descrição. Ele gostou também da
    `pl-384`, da `rd-pro-1` (a luz) e da `rd-pro-2` (a porta). Em 512, qualquer referência faz o PixelLab
    inventar gente no quarto; sem referência sai bom (`pl-512-sem`).
  - **Os móveis pela função, confirmados** (tabela em `novo/README.md`): fone num gancho (Salas de voz), sofá
    ou pufes com os amigos em chamada, varal de fotos (Amigos), espelho (Coelhos), guarda-roupa, jornal ou
    calendário (Novidades), caixinha de correio ou cortiça (Caixa de ideias), a porta (Explorar), TV com
    videogame (Mini-games), abajur (Dia e noite), vaso de cenouras.
- **A base ficou a `pl-512-sem-1`** (decisão dele, 08/10/2026): a `pl-384-taverna` tem cara de taverna mesmo, e
  fica como possível skin temática futura. Ele quer um quarto aconchegante NATURAL.
- **O teste com ela foi feito** (`novo/teste/`, abrir `teste.html`). Cada móvel é pintado DENTRO da base e recortado
  pela diferença; a sombra vira uma camada à parte, e a máscara é o pé do móvel na grade. A noite saiu por edição,
  e o abajur acende por código. A qualidade é a da base, e a luz por código convence. O que falta para chegar ao
  conceito é DENSIDADE (recheio, móveis maiores), não técnica. As três versões do pufe saíram de tamanhos
  diferentes: as versões de um móvel precisam partir da primeira.
- **Refeito no mesmo dia, com os defeitos que ele apontou consertados:** cama antes do criado-mudo (a cabeceira
  estava espremida), estante alta, abajur pintado APAGADO e aceso só pelo código, o móvel recortado pela remoção de
  fundo (a diferença perdia madeira sobre madeira e pegava tábuas retocadas) e o fundo tirado por preenchimento.
- **Esvaziar o conceito falhou pela terceira vez,** agora por partes (`hibrido/vazio/partes/`): os quadros saem, mas
  no lugar da cama e do tapete o modelo pinta outra cama, porque o resto do quarto cheio ensina a desenhar móvel.
  O caminho é a base gerada vazia.
- **Luz de fonte FIXA (janela, abajur) é pintada; o código só a leva aos móveis soltos.** A luz do abajur por
  código ficou abaixo; a repintura só da região do abajur, com ele aceso, ficou boa (`novo/teste/`).
- **Decisão dele (08/10/2026):** o conceito convertido é o melhor resultado, mas não deixa mudar nada; skins,
  variações e móveis trocados vêm do processo por etapas sobre a base gerada.
- **Opção sem porta:** `novo/bases/pl-512-janela-1.png` (pedido dele: a janela como lugar de explorar e enfeitar,
  como no conceito). Cuidado: `bases.mjs` gera tudo o que falta ao ser importado; rodar sempre com o id.
- **A janela com vista** (`novo/janela/`): a paisagem fica ATRÁS do vidro, numa imagem à parte, e troca com a
  hora (e um dia por tema). A noite da base sem porta é montada: chão e janela da pintura, paredes por código, porque
  a edição manchou a parede duas vezes.
- **A base é a `pl-512-janela-1`** (decisão dele, 08/10/2026), e o quarto montado nela está em `novo/quarto/`
  (abrir `quarto.html`). Nesta base a ferramenta desenha "quartos em miniatura" em áreas pequenas: pedir "ONLY",
  evitar a palavra "room" e trocar a `semente`. Animação na vista: depois do quarto completo.
- **Móvel que sai cortado ou embutido: gerar AVULSO** (`novo/quarto/avulso.mjs`) e repintar só a forma no lugar. **Área
  que precisa virar máscara (o vão da janela aberta): pedir magenta puro** — funcionou de primeira.
- **A home do app já é o quarto HÍBRIDO** (`web/src/Quarto.tsx`, imagens por `hibrido/exportar.mjs`), decisão dele de
  08/10/2026: enquanto o quarto de móveis soltos evolui em `novo/quarto/`, o do conceito fica na home. No app: o
  guarda-roupa são as GAVETAS da cama (o "armarinho com o coelho" é o gabinete do PC); computador, gabinete, vaso,
  pôster e prateleira são só desenho — as NOVIDADES saíram da home em 09/10/2026 ("deixa mais limpo"), com a bolinha
  do ícone de início e o changelog.ts (a escolha de coelhos saiu até haver outros coelhos); o quadrado escuro do conceito foi tirado
  na exportação; o quarto tem no máximo 626 px e 72% da altura. Mover/girar móveis NÃO está no app (só na página de
  teste do quarto novo).
- **O quarto é INDIVIDUAL; o coletivo é o salão** (dele, 14/10/2026). **Ele dá um layout inicial, e cada pessoa arruma
  como quiser:** todo móvel se arrasta e gira (4 posições), não só o pufe e a poltrona. A cadeira do computador terá
  FÍSICA de verdade (rola, perde força no atrito, bate e quica nos móveis), não só o desenho mudando.
- **VISITAR o quarto de outra pessoa (feito em 15/10/2026, ideia dele).** A arrumação mora no servidor (`quartos`,
  `server/src/quarto.ts`: só posições e códigos, validados porque são desenhados na tela de quem visita), e quem visita vê
  igual, inclusive onde a cadeira parou. **Quem visita: QUALQUER CONTA** (decisão dele), menos quando há bloqueio em
  qualquer sentido, com a resposta de "não arrumou o quarto". Visita é por id, nunca por nome. **Por enquanto só na
  página de teste** (conta numa API de teste; `visita.mjs` testa): o quarto novo entra no app quando substituir o atual
  (decisão dele: "quando eu lançar, ele vai substituir o quarto atual").
- **As camas para desbloquear já têm 4 candidatas** (`avulsos/cama-casal-1..4.png`, madeiras e cabeceiras diferentes);
  a 2 é a de fábrica. O que libera cama nova ainda é decisão dele.
- **As portas do guarda-roupa abrem animadas (15/10/2026):** os quadros do meio entre o fechado e o aberto
  (`animar-estado.mjs`, interpolation-v2, 40 gerações nas 4 vistas); fechar toca ao avesso.
- **A janela se arrasta pelas duas paredes e troca de tipo (15/10/2026, pedido dele):** o quarto ficou SEM janela
  (`janelas/sem-janela.py`: a parede da direita é a da esquerda espelhada, vezes a cor medida), e a janela virou peça,
  com a luz e o luar dela montados por código (o luar dos tipos novos é projetado do vidro). Tipos: a original (a única
  com cortina e que abre), em arco, redonda e com floreira (`janelas/tipos.mjs`, vidro em magenta).
- **O recheio, as funções e o componente (15/10/2026, pedido dele):** fone, quadro de fotos, cortiça, prateleira e pintura
  são OBJETOS DA PAREDE (como a janela: andam pelas duas paredes e sobem e descem; `parede/`), há duas plantas e a mesa
  enfeitada. As funções da home moram nos objetos: fone → Salas, quadro → Amigos, cortiça → ideias, **o guarda-roupa (o
  móvel) → Guarda-roupa** (na home atual eram as gavetas da cama), o vidro da janela → Explorar, abajur → Dia e noite,
  mesa → Mini-games; o nome aparece ao passar o mouse. **No app, `QuartoNovo.tsx` mostra a página do quarto num iframe
  (`?app`), SÓ NO DESENVOLVIMENTO:** o Vite a serve do disco e ela não entra no build; o botão 🧪 da home troca de quarto.
  Para lançar: a página precisa ir para o build (2,7 MB desde 15/10, com as imagens dentro) e a home trocar de
  componente. **A barra de ARRUMAR do app existe (15/10/2026):** Editar → Girar, Janela, as cores do tapete (sálvia,
  terracota, azul, mostarda, rosa, cinza) e os objetos da parede, estes dois como FIGURAS e não nomes, para não pedir
  um texto novo por objeto nos 80 idiomas (só "Girar", "Tapete" e "Objetos da parede" entraram).
  O coelho do quarto no app já segue o estado de verdade (em call, ausente).
- **Ainda depois:** animação na vista, variações de tapete (cor por código), mais móveis que giram.
- **Feito em 11/10/2026:** a caixa de ideias dizia "aqui embaixo da vila"; agora diz "do quarto", nos 70 idiomas.
- Saldo em 08/10/2026: PixelLab 493 de 2.000 gerações restando (plano Tier 1, US$ 12/mês; a repintura nova
  `inpaint-v3` exige o Tier 2), Retro Diffusion US$ 3,28.

## A caixa de correio das novidades: pendente, depois do quarto e do salão

**Decidido em 15/10/2026, pelo Sydenstricker. Fica para DEPOIS de terminar o quarto e o hub da comunidade, e sem conjunto
de exemplo agora.**

- **A entrada é uma CAIXA DE CORREIO no quarto.** Ela abre as Novidades: os pacotes novos, e dentro de cada pacote os
  CONJUNTOS (de Halloween, por exemplo).
- **Um conjunto é de COSMÉTICOS, de qualquer tipo:** do guarda-roupa, móveis e objetos do quarto, acessórios da etiqueta
  (tag) da pessoa, e o que vier.
- **Clicar desbloqueia, e NÃO CUSTA NADA.** É a regra do guarda-roupa (tudo livre, sem cosmético de pagante): "desbloquear"
  é só pegar, sem preço, sem moeda, sem pedir nada em troca. O servidor já tem o resgate dos presentes ("Um dos 25
  primeiros") para aproveitar.
- **Sem forçar retorno diário.** Nada de "pegue antes que acabe": um conjunto de época ganha destaque na época dele e
  continua na vitrine depois.
- **Para que serve a medida:** saber quais conjuntos as pessoas pegam, para DIRECIONAR OS PRÓXIMOS COSMÉTICOS (melhoria do
  Syden, nas palavras dele). O painel mostra os números somados por conjunto. O que cada pessoa pegou fica guardado
  porque é o inventário dela; usar isso para traçar o perfil de alguém está fora. A política de privacidade ganha a linha
  que diz isso ANTES de ir ao ar.

## O salão da comunidade: o quarto é de cada um, o salão é da turma

**Decidido em 12/10/2026, pelo Sydenstricker:** o início da comunidade ainda era arte em vetor (o coelho do recado
sobre faixas diagonais) e deve ser um espaço em pixel art de evolução COLABORATIVA — o salão do fim do site, "já que ele
representa o coletivo". Em duas etapas:

1. **Feita no mesmo dia (`web/src/Salao.tsx`), sem gastar crédito do PixelLab:** as peças do lobby do site copiadas
   para `web/src/assets/salao/`. Cada função mora num objeto: TV → entrar na voz, fliperama → mini-games, estante →
   canais, janela → chamar alguém, balcão → guarda-roupa, quadro da parede → a imagem da comunidade (e, para quem
   administra, montar a tela). **O salão enche com quem está na call agora** (sofá primeiro, depois a TV, o fliperama
   e as rodinhas); sem ninguém, fica vazio, porque a tela não finge movimento. O coelho do balcão está sempre lá e lê
   o recado do dono. Os mesmos objetos viram atalhos em texto embaixo (no celular não há "passar o mouse").
2. **Pendente: a evolução.** O salão ganha enfeites pelo que a turma faz JUNTA (horas de call, partidas, karaokê),
   por marcos coletivos, e quem administra escolhe onde pôr. Sem sequência diária e sem cobrança. Pede arte nova
   (PixelLab, com os créditos acabando: decisão dele quando gastar) e uma tabela no servidor.

**O que já está no salão (13/10/2026):** cada pessoa na call aparece com o PRÓPRIO coelho (o pronto que escolheu de
avatar; o corpo inteiro de pé foi gerado no PixelLab, `e2e/pixel-art/avatares/corpos.mjs`) e o nome em cima; a TV
mostra quem está transmitindo ("Ao vivo"), as setas trocam de canal e clicar entra assistindo — a imagem da
transmissão NÃO vai para a TV (decisão dele: cada pessoa no início baixaria o vídeo sem ter entrado na sala); quem
administra escolhe quem dá o recado (17 coelhos animados, `COELHOS_DO_RECADO` em `web/src/boasVindas.ts`); o
guarda-roupa saiu do salão ("na home não precisa").

**O SALÃO ISOMÉTRICO (15/10/2026, decisão dele):** substitui o salão de frente. Pode gastar os créditos nele e no que
derivar dele; reaproveita as mecânicas do quarto (móveis soltos, janela e objetos de parede, pontos de interação); a
SALA é nova (não há salão isométrico), com o salão de frente de referência ("ele está bem legal"). As pessoas aparecem
com o mascote base até os outros virarem isométricos.

**O que o salão isométrico já faz (15/10/2026, `e2e/pixel-art/salao/`, no app pelo `SalaoNovo.tsx`, SÓ NO
DESENVOLVIMENTO, com o mesmo botão 🧪 do quarto):** as funções do Salao.tsx nos objetos (TV → voz e Ao vivo, fliperama →
mini-games, estante → canais, janela → chamar alguém, balcão → o recado num balão sobre o coelho, quadro → montar a tela);
a TV e o fliperama têm TELA POR CÓDIGO (a TV à toa passa um desenho calmo e, com transmissão, o selo Ao vivo e quem
transmite em cima, com as setas de canal; a imagem de verdade continua fora da TV); o quadro mostra a CAPA da comunidade
(ou o ícone, inteiro) no plano da parede; quem transmite fica na frente da TV, quem está numa partida no fliperama (pose
própria), e as banquetas têm a pose sentada alta. **A arrumação é da COMUNIDADE** (`saloes`, `salao-routes.ts`): todo
membro vê igual e USA as funções, só quem administra arruma (o servidor confere), e a turma relê na hora (`salao:mudou`).
Para lançar: as duas páginas vão para o build e o início da comunidade troca de componente. Teste: `salao/no-app.mjs`.

**O SALÃO É 16 × 16, COM CÂMERA (decisão dele, 15/10/2026: "imaginei 4× o tamanho"; "câmera que anda").** A casca sai por
código da 8 × 8 (`salao/casca16.py`: a mesma casa de 27 × 14,25 px, os cantos como estão e o meio repetindo 4 casas), e
**as duas paredes são de tijolo** (a da direita era creme com lambri; "o estilo das duas paredes é bem diferente"). A
imagem tem 1024 px; a vista mostra um pedaço, abre no canto da TV, e arrastar onde não há nada para pegar leva a câmera.
O pixel acompanha a largura da vista, para o coelho ficar do tamanho de sempre. O servidor aceita até 16 casas no salão
(o quarto segue em 8).

**Gráficos e o jogo (15/10/2026):** o quarto e o salão são desenhados pelo PROCESSADOR (a luz e as sombras pixel a pixel;
a placa só mostra a imagem pronta). Por isso: (1) **param de desenhar quando a janela do Syden perde o foco ou fica
escondida** — o app desliga o freio de janela escondida por causa da chamada, e sem isso o quarto seguiria desenhando
atrás do jogo, que é o uso principal; (2) **opção de Gráficos** nas Configurações (Aparência): partículas, sombras, telas
animadas e "ajustar sozinho quando ficar lento" (desliga o que pesa acima de 30 ms por quadro), pedido dele.

**MÓVEL É UMA COISA, OBJETO É OUTRA (decisão dele, 15/10/2026), nos dois ambientes:** o móvel vem LIMPO (o balcão sem
garrafas, a mesinha sem canecas, o rack sem o videogame, a mesa do quarto sem enfeites), e o que vai em cima é peça à
parte: põe-se no tampo de qualquer móvel que tenha tampo, anda e gira com ele, e tem as suas posições. "Aumenta as
possibilidades de customização e variação, e fica barato de implementar"; e quem quiser o móvel limpo, sem adereços,
tem. **O padrão é SEM ÁLCOOL:** bebida no salão é suco, refrigerante, café.

**DECIDIDO (13/10/2026), À ESPERA DE CRÉDITOS DO PIXELLAB:** o salão vira personalizável — **móveis diferentes e
layouts do ambiente**, e também o coelho do recado. **Uma parte vem liberada, e o resto se DESBLOQUEIA POR CONQUISTAS
COLETIVAS** (o que a turma faz junta: horas de call, partidas, karaokê) — é a etapa 2 acima, agora com a regra de
liberação decidida. Ele parou aqui só por falta de créditos ("preciso de mais créditos no PixelLab para dar
continuidade"). O que ainda falta desenhar quando voltar:
- **A arte:** cada móvel e cada layout é peça nova do PixelLab (o salão hoje é `sala.png` pintado inteiro, com as
  pessoas e as telas por cima; móvel trocável pede que ele vire peças, como o quarto de móveis soltos em
  `e2e/pixel-art/quarto/novo/` — a mesma lição: peças que nascem na grade têm bordas limpas).
- **Quais vêm liberados e quais cada conquista abre**, e os marcos (ex.: 10 horas de call juntos, 50 partidas).
- **O servidor:** a arrumação de cada comunidade e as conquistas dela, numa tabela; quem administra escolhe e arruma.
- **Sem sequência diária e sem cobrança** (regra da etapa 2 e da avaliação da sondagem de jogos: nada de "volte todo dia").

## Os coelhos vivem nos ambientes: um sistema isométrico só, e o personagem antes da arte

**Decidido em 14/10/2026, pelo Sydenstricker:** os avatares precisam de várias animações e de interagir com o ambiente
de forma orgânica, no quarto do início e no salão da comunidade. E **estruturar o formato antes de criar as artes.**

- **Os dois ambientes são ISOMÉTRICOS** ("o quarto isométrico tem um charme único"). O salão de hoje, de frente, fica
  até o isométrico ficar pronto. Um sistema só: a mesma grade, os mesmos móveis soltos, os mesmos pontos de interação,
  e **um jogo só de animações por coelho** (de frente e de quina, cada coelho precisaria de dois).
- **O quarto que fica é o MODULAR** (`e2e/pixel-art/quarto/novo/quarto/`). O da home é só o lugar guardado: pintura
  fixa, e ajustar móvel nela gera problema atrás de problema.
- **UM personagem primeiro, validado, depois os outros com a mesma receita. O primeiro é o MASCOTE** (o coelho branco
  de moletom: o do recado no salão, o da cama na home). Validado, ele é também quem aparece para quem não tem coelho
  pronto.
- **O ponto de interação é do MÓVEL** (deitar na cama, sentar na poltrona virada para onde ela foi girada): arrastou o
  móvel, o ponto vai junto — por isso só o quarto modular serve. Móvel de sentar/deitar tem a CAMADA DA FRENTE à parte
  (o braço da poltrona, o cobertor), para o coelho ficar dentro dele. Andar é pela grade, desviando dos móveis.
- **O estado real decide o lugar** (a tela não mente): ausente dorme, em call vai ao computador, quem assiste senta
  virado para a TV; quem prefere menos movimento vê o coelho já no lugar.
- **PENDÊNCIA (decisão dele, 15/10/2026): TODOS os mascotes de frente viram modelos isométricos.** Cada pessoa aparece
  nos ambientes com o mascote que ela usa; enquanto só o mascote base existe em isométrico, ele é quem aparece para
  todos (com o nome em cima). Trocar os coelhos prontos de avatar, um a um, pela receita validada do mascote.
- **O formato e o passo a passo** estão em `e2e/pixel-art/personagem/README.md`. Plano do PixelLab: Tier 2 desde
  14/10/2026 (a repintura `inpaint-v3` e a API de personagens com 8 direções e animação).

## Traduzir mensagens de outro idioma: válido, para outro momento

**Registrado em 09/10/2026, pelo Sydenstricker.** A pergunta: quem lê em português entra numa comunidade japonesa —
dá para traduzir? Ele achou válido e deixou para depois. O que ficou levantado:

- **A forma: um botão "Traduzir" em cada mensagem** que não está no idioma de quem lê, e só quando a pessoa pede
  (a mesma regra anotada na seção de culturas: o custo acompanha o uso, não os 72 idiomas).
- **O caminho recomendado: o tradutor do próprio navegador** (Translator API do Chrome/Edge, que roda no
  computador da pessoa). A mensagem não sai do aparelho, não custa nada e não muda a política de privacidade. Onde
  ele não existe, o botão não aparece — como o de GIF.
- **Medir antes de construir:** se o app de desktop (Electron) tem esse tradutor — o modelo vem do Chrome e pode não
  existir lá — e quais pares de idioma ele cobre (dezenas, não os 72).
- **Reservas, se faltar cobertura:** LibreTranslate no nosso servidor (sem terceiro, uns 2–4 GB de memória na
  Hetzner, qualidade menor em japonês/coreano/chinês) ou serviço de terceiro (DeepL, Google: melhor qualidade, pago
  por caractere, e entra na política de privacidade).
- Esforço estimado: meio dia com o tradutor do navegador; mais um dia e um serviço novo com o LibreTranslate.

Nomes de canal e de comunidade são conteúdo de quem criou e NÃO passam pelo `t()`; os canais que o Syden cria
sozinho numa comunidade nova é que nascem no idioma de quem a cria (desde 09/10/2026).

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

## Saber que alguém está jogando: tudo o que foi medido, e por que nada foi construído

**Decidido em 02/10/2026, pelo Sydenstricker: a sobreposição saiu, e nada a substituiu.** Esta seção
existe para que retomar o assunto não comece do zero — foram três rodadas de medição, e duas delas
derrubaram o caminho que parecia óbvio.

### A sobreposição por cima do jogo foi construída e REMOVIDA

Uma janelinha sem borda, sempre no topo, atravessável pelo clique, com quem estava na sala. Durou dois
dias. O veredito foi **"o incômodo é maior que a conveniência"**, e ela saiu inteira no commit
`6e611a2` — o git tem tudo, inclusive a sonda, que é a parte difícil.

Duas lições que sobrevivem à remoção:

1. **Eu a deixei LIGADA por padrão, e isso foi erro meu.** O argumento na época era que ela não
   interrompe nada (não rouba foco, não recebe clique). Mas uma janela que aparece sozinha por cima de
   tudo é exatamente o que a seção "A tela não interrompe" manda não fazer, e ligada por padrão ela
   não pede licença. **Função que aparece sobre o trabalho dos outros nasce desligada.**
2. **Aproximação cobra o preço previsto.** A primeira regra era "está em tela cheia, logo é jogo". O
   VS Code em tela cheia virou jogo, e a janelinha foi parar por cima do editor.

### A lista de jogos: três caminhos medidos, um só funciona

**A lista pública da Steam ACABOU.** `ISteamApps/GetAppList` devolve 404 sem chave, e o método não
aparece mais entre os que a Steam serve sem chave (conferido em `GetSupportedAPIList`). Hoje exigiria
uma chave de API, ou seja, mais uma credencial.

**Casar NOME de janela com nome de jogo não funciona, e o contra-exemplo é fatal:** uma aba do
navegador chamada "ELDEN RING - gameplay" viraria "está jogando Elden Ring". Títulos reais, medidos:
`Welcome - Janja - Visual Studio Code`, `Geral | ANDRU FEDA MT - Discord`. Nome puro é a exceção.

**QUEM SABE É O WINDOWS, em `HKCU\System\GameConfigStore\Children`.** É onde a Barra de Jogos guarda o
que ela reconheceu — a mesma lista que decide se o Win+G aparece. Medido na máquina do Sydenstricker:

```
144 entradas, 75 com MatchedExeFullPath
  0 falsos positivos (nenhum navegador, editor, Discord, Word, OBS, Spotify)
 50 Steam · 6 Epic · 19 de lugar nenhum (Riot, Blizzard, EA, Origin, avulsos)
 68 das 75 com TitleId da Microsoft != 0
montar a lista: 27 ms · 10.000 consultas: 85 ms
```

Os **19 fora de Steam e Epic** são o argumento contra qualquer regra de "mora em pasta da loja X". E o
**TitleId** diz que não é heurística: o Windows casou o executável com um catálogo do lado da
Microsoft, o que explica os zero falsos positivos.

**O QUE ELA NÃO É**, e isto é o que mais importa guardar: **não é lista pública e não dá para baixar.**
É o cache local das respostas da Microsoft para os jogos que AQUELA pessoa já rodou, no ramo do
usuário (não existe equivalente em `HKLM` — conferido em três caminhos). Jogo nunca aberto não está
lá; por isso a primeiríssima sessão de um jogo novo não seria reconhecida. E é um detalhe interno não
documentado: a Microsoft não prometeu que essa chave existe.

### O "vincule sua conta" do Discord: metade é impossível

A tela que oferece vantagens ao abrir o Battlefield **não é o Discord agindo sozinho** — é a EA tendo
integrado o SDK do Discord dentro do jogo. Nenhum estúdio vai integrar um SDK do Syden, então
**detalhe de partida e "entrar no esquadrão do amigo" estão fora de alcance para sempre.**

**E o "está jogando X" do Discord NÃO vem da conta vinculada**: vem do cliente dele olhando os
processos da máquina. A vinculação serve para a camada de cima.

### O caminho da Steam: possível, e descartado por cobertura

O Syden **já guarda o SteamID64** de quem liga a Steam (`social_accounts`) e **já tem chave da Steam
Web API**. O `GetPlayerSummaries`, que ele já chama no login, devolve `gameextrainfo` e `gameid` quando
a pessoa está em jogo. Isso daria presença **pelo servidor**, funcionando no navegador e no celular —
arquitetura melhor que a sonda local, que só vive no app de Windows.

**Descartado por um número: só UMA pessoa do grupo entra pela Steam.** E sobre esse um ainda pesariam
duas condições: perfil público (com *detalhes do jogo* público, que é um ajuste separado) e jogo aberto
PELA Steam — o que já falha se o Battlefield vier do EA App. Não vale o trabalho, nem a consulta
periódica a um terceiro, nem a linha nova na política de privacidade que ela exigiria.

### Se um dia retomar, a pergunta que decide é esta

**Quantas pessoas do grupo usam o APLICATIVO, e não o navegador?** A detecção local cobre qualquer
jogo de qualquer loja, mas só existe no app de Windows. Se a maioria usa o site, ela tem a mesma
doença da Steam e a resposta é não construir.

**E existe um caminho mais barato que cobre todo mundo:** o Syden já tem a agenda de servidores de jogo
por comunidade (`ServidoresDeJogo.tsx`). O que falta ali não é detecção automática — é alguém poder
dizer "estou neste agora" e os outros verem. Funciona no navegador, no celular e no app, não depende
de loja, não fala com terceiro e não conta nada que a pessoa não tenha escolhido contar. **O risco
dele é o oposto do da sobreposição: status que ninguém atualiza vira enfeite morto.**

## O som da transmissão pega o Discord junto, e isso não é defeito do Syden

**Diagnosticado em 02/10/2026; consertado para JANELA em 13/10/2026.** A turma usa Discord para voz e Syden para tela; quem
ouve a transmissão no Syden escuta as vozes duas vezes.

A captura de som pede ao Windows *"tudo o que está tocando, EXCETO o Syden"*
(`PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE`, em `desktop/native/src/capture.cpp`). Essa
exceção foi escrita assumindo que o Syden seria o aplicativo de voz. Com a voz noutro programa, as
vozes dele entram na captura e voltam pela transmissão, com atraso.

**O conserto de verdade é inverter o modo:** o Windows também aceita
`PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE`, ou seja *"só o som DESTE programa"*. Aí a pessoa
escolheria o jogo, e nem Discord nem Syden entrariam. É mudança pequena no C++ — o PID já vem do
JavaScript —, mas **só compila no GitHub Actions**, porque o módulo nativo exige as Ferramentas de
Build do Visual Studio.

**Prioridade baixa, decidido em 11/10/2026:** usar Syden e Discord juntos não é o uso esperado. O mesmo
conserto também tiraria da transmissão de UMA JANELA o som do resto do computador (Spotify, notificações),
que hoje vai junto — se alguém reclamar disso, ele volta para a fila.

**Feito em 13/10/2026 (chega com a versão seguinte do app):** transmitindo UMA JANELA, a captura usa o INCLUDE
apontado para o processo dono dela (`windowProcess` no C++, chamado por `screen-audio.js`): vai só o som do jogo, sem
Discord, Spotify nem notificação. Medido com o Discord tocando: janela do Discord dá som, a do Firefox dá silêncio. A
TELA INTEIRA continua no EXCLUDE (tudo menos o Syden, Discord junto), e também os apps da Store, cuja janela é do
ApplicationFrameHost e daria silêncio. O módulo compila nesta máquina também (`npm run build:native` em `desktop/`,
com as Build Tools do VS 2022 instaladas).

Para a tela inteira, as saídas continuam sendo desmarcar "compartilhar áudio" ao escolher a tela, ou baixar o
**Volume da transmissão** no "i" do quadro, que é separado da voz e vale só para quem baixa. (No app,
desmarcar só vale da versão seguinte à 0.1.7 em diante: antes o site ligava a captura de som por fora,
sempre.)

## Texto borrado na transmissão: o Padrão decide pela imagem parada

**Diagnosticado em 06/10/2026, consertado em 11/10/2026.** Relato: o Magnitudle transmitido chegava com
as formas grandes visíveis e o texto pequeno ilegível — resolução baixa esticada, não defeito de rede.

**A causa era nossa.** O Padrão usa `maintain-framerate` e `contentHint: 'motion'`: sob aperto, corta
resolução para segurar os 30 quadros. Certo para jogo, errado para site, slide e planilha. O Leve
resolvia, mas dependia de quem transmite saber escolher, e saiu.

**O conserto:** a otimização dinâmica (`useVoice.ts`) mede os quadros CODIFICADOS por camada entre uma
conferência e outra (`framesEncoded`, não o `framesPerSecond`: tela parada e camada pausada dão os dois
zero). A regra é `proximaParada` (`streamStats.ts`): parada → `maintain-resolution` + `detail`, e os
degraus de tamanho desligados; movimento → `maintain-framerate` + `motion`. Folga: duas medições paradas
para ir à nitidez (~8 s), uma com quadros para voltar. **Aperto de processador ou internet conta como
movimento**: tela parada quase não gera dados, e sem isso um jogo começando depois de um slide podia
ficar preso na nitidez, a menos de 12 quadros. O Fluido não entra. Teste de tela: `e2e/tela-parada.mjs`.

## O número verdadeiro que mente: a tela não pode cobrar o preço sem mostrar a compra

**Três relatos em dois dias, a mesma causa, e por isso está escrito aqui.** Todos sobre números
CORRETOS que faziam o Syden parecer quebrado:

1. *"Esses números diferentes de 30/60 são lidos como 'tem algum erro na transmissão'."* — eram
   `14 fps` numa camada de 15 e `29 fps` numa de 30. As duas transmissões estavam perfeitas.
2. *"Diz que estou a 576p mas a qualidade está agradável."*
3. *"760p dá impressão de qualidade ruim, pois é resolução de celular. Os usuários acham que está
   bugado quando vem um número baixo de p."*

**A causa é a mesma nas três: o número mostrava o PREÇO de uma escolha sem nunca mostrar O QUE ELA
COMPROU.** O Syden pede `maintain-framerate` de propósito (ver `SCREEN_HINTS`, em `useVoice.ts`):
quando falta banda ou processador, **sacrifica-se resolução para segurar os 30 quadros**, porque
804p a 7 fps é a pior forma possível de assistir alguém jogar. "576p · 30 fps" é esse acordo sendo
cumprido — e a tela o anunciava como defeito.

**A regra que fica, e ela vale para qualquer medida futura na tela:**

- **Medida sem referência não informa, alarma.** `576p` não responde "está ruim?"; o mesmo 576p
  sobra num quadro de 540 e falta em tela cheia num monitor 4K. O que responde é a COMPARAÇÃO, e
  não a altura crua.
- **Ruído de medição não é defeito.** 29 num alvo de 30 é o normal de um codificador. A taxa volta
  ao alvo dentro de 10% e só mostra o número cru quando ele está mesmo longe.
- **Número cru fica para quem PODE AGIR sobre ele.** Quem transmite vê tudo, com o diagnóstico ao
  lado. **Quem assiste não recebe comentário nenhum sobre a imagem** — nem o número, nem veredito.
  A comparação chegou a virar frase no cartão ("Menor que o espaço onde está sendo mostrada. Numa
  janela menor, fica nítida.") e saiu em 05/10/2026: *"essa mensagem é inconveniente — não podemos
  apenas transmitir?"*. Para quem assiste, o cartão ficou só com o teto do que baixar — e quando o
  teto saiu (11/10/2026), quem assiste ficou sem "i" nenhum.

## Transmissão: o Syden decide, quem usa não administra

**Decidido em 11/10/2026, pelo Sydenstricker, depois de uma auditoria dos modos e das opções:** *"o
erro deve ser tratado pelo Syden, não ser um ônus do usuário"*, e *"grande medida do esforço de manter
a melhor transmissão cabe ao aplicativo"*. Um amigo relatou um modo que deu problema e não lembrava
qual — o sinal de que havia escolha demais. O que saiu, e por quê:

- **O modo Leve.** A tela dizia "para internet mais fraca"; o código segurava a nitidez e sacrificava
  os quadros. Quem jogava com internet fraca transmitia fotos, e nada avisava. Ficam Padrão e Fluido.
- **O conselheiro de qualidade (`QualityAdvisor`), inteiro.** O "Mudar para 60 fps" trocava o modo no
  meio da transmissão, e ali o Fluido não acontece: a captura já fora aberta a 30 quadros e as três
  camadas do Padrão ficavam, somando ~12,5 Mbps a 30 fps — e a escolha ficava salva. Os avisos de
  travamento passavam o problema a quem transmite. **O Fluido apertado agora cai para 30 sozinho**
  (`proximoFluido`, em `streamStats.ts`), só naquela transmissão; o Padrão já encolhia a imagem sozinho.
- **O "Baixar até" (Automático, Média, Baixa) de quem assiste.** Para internet ruim o automático já
  desce de camada; "Média" não diz nada; no Fluido não fazia nada. O caso real, dados contados no
  celular, vem do próprio aparelho: `navigator.connection.saveData` (ver `qualidadeQueRecebo.ts`).
- **A escolha de codec (Automático, VP8, H.264) nas Configurações.** O Syden já pergunta ao computador
  se o H.264 sai pela placa (`escolherCodec.ts`); quem a usava era o conselheiro. Quem tinha um codec,
  ou um teto, guardado perde a escolha na leitura (`converterPreferenciasAntigas`).
- **O VP9 entra sozinho, e só pela placa.** O automático pergunta primeiro se o VP9 sai pela placa
  (Intel recente; NVIDIA e AMD não codificam VP9), depois o H.264, e fica no VP8. Ganho estimado: ~30%
  menos internet, sem custo de processador; por software ele custaria 1,5–2× o VP8 a quem está jogando,
  e por isso nunca. **Ele sai com `scalabilityMode: 'L1T3'`**: sem isso o LiveKit publica VP9 de tela
  numa camada só e força `motion`, e somem a camada pequena e a nitidez da tela parada. Exige servidor
  acima da 1.13.6. Teste de tela: `e2e/vp9-pela-placa.mjs`.
- **Uma opção em cada menu de compartilhar.** No app não existe aba de navegador; no navegador a janela
  sai sempre muda. App: tela inteira e janela. Navegador: tela inteira e aba.

**A regra que fica:** antes de pôr uma escolha de qualidade na tela, pergunte se o Syden consegue
medir e decidir sozinho. Quase sempre consegue — e uma escolha que ninguém entende vira o relato
"um modo deu problema e não sei qual".

## Fonte de terceiro: embutir é REDISTRIBUIR, e quase nenhuma "grátis" permite isso

**Decidido em 02/10/2026, depois de medir — e a medição derrubou a fonte que ele queria usar.**

A ideia era pegar fontes do DaFont. Medido na página dos mais baixados, 28 fontes: **19 são "Grátis
para uso pessoal"**, 5 dizem só "Grátis" sem nomear licença nenhuma, e só 4 nomeiam uma de verdade.
Dois terços do catálogo popular estão proibidos num produto, e o "Grátis" dos outros é uma etiqueta
que o próprio autor marcou, sem arquivo de licença, e que ele pode mudar.

**E o direito de que o Syden precisa é mais forte do que parece: embutir uma fonte num app web é
REDISTRIBUIR o arquivo para o navegador de cada pessoa.** Não é "usar numa arte". Muita fonte grátis
permite a segunda coisa e não a primeira. É a mesma forma da lição da música: ter o arquivo não dá o
direito de distribuí-lo.

**A saída é o catálogo OFL, auto-hospedado** (`web/public/fontes/`), com o `OFL.txt` ao lado de cada
arquivo — a licença exige acompanhar a fonte, e um `.woff2` solto numa pasta não é licença nenhuma.
Há teste para isso.

**E o motivo de EMBUTIR não é segurança, é consistência.** Pilha de fontes do sistema não faz
requisição nenhuma, então nesse quesito ela é imbatível — mas medido: 'Arial Narrow' e
'Segoe UI Variable Display' não existem no Linux, e 'SF Pro Rounded' é só do macOS. Lá as opções
caíam na sans-serif comum, idênticas à padrão: quem administra escolheria uma identidade e metade
das pessoas veria outra coisa.

**O que continua proibido é terceiro em tempo de execução.** O Syden busca a Noto no Google só
quando a PESSOA escolhe um idioma de escrita não latina — escolha dela, sobre o aparelho dela. Uma
fonte escolhida por quem administra faria o navegador de TODO MUNDO ir buscar, por decisão de outra
pessoa. É a mesma forma do problema que fechou os GIFs numa lista de domínios e que fez a capa por
endereço ser BAIXADA pelo servidor em vez de apontada.

**Paga em 03/10/2026:** o Google Fonts está declarado na política de privacidade (`#fontes`). E a
declaração revelou que a frase acima era falsa no código: a Noto era baixada para TODO idioma,
português incluído, e o `preconnect` do `index.html` abria conexão com o Google em toda visita.
Hoje latino, cirílico e grego usam a letra do sistema (`ESCRITAS_DO_SISTEMA`, em `i18n/index.ts`).
Quem mexer nisso: a política promete "só nas outras escritas", e é esse conjunto que a cumpre.
