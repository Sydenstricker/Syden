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

## O aniversário do Syden é 19/09, e ele abre no quarto

**Decidido em 19/10/2026, pelo Sydenstricker.** O aniversário do Syden é **19/09**: o dia em que o projeto ganhou o nome e
virou app instalável (a v0.1.0 é de 19/09/2026, 13:27; o nome Syden, das 15:01). O primeiro commit, ainda como "Janja", é
de 18/09/2026, e já trazia quase 10 mil linhas: o trabalho começou antes do que o git conta. Nos dois lugares: marcado no
calendário de toda comunidade (a partir de 2027) e com festa ao abrir o Syden no dia (`AniversarioDoSyden.tsx`,
`diaDoSyden.ts`), uma vez por ano, guardado nas preferências.

**O Syden abre no QUARTO por padrão**, e "Onde parei" fica em Minha conta → Ao abrir o Syden. Desde 22/09/2026 ele abria
onde a pessoa tinha parado (para quem só conversa não ganhar um clique), mas o quarto virou a casa de cada um e quase não
aparecia. No quarto, a barra lateral continua com os canais da última comunidade.

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
- **Loldle e a família dele (Pokédle, Dotadle, Smashdle, OnePiecedle, Narutodle), medidos em 24/10/2026, a pedido da
  turma:** todos com a rede Venatus, Google Ad Manager e Amazon (até ~80 domínios de anúncio). Sem API pública. E um
  "-dle" NOSSO de LoL também não pode: as duas políticas da Riot (a de fãs, "Legal Jibber Jabber", e a de
  desenvolvedores) dizem com todas as letras que proíbem usar a propriedade intelectual dela em jogos ("We prohibit the
  use of our IP in games and apps"; "Do not create or develop games utilizing Riot's IP"). O Loldle existe por
  tolerância, não por licença. Pokémon, Naruto, One Piece, Dota e Smash nem têm política de fãs.
  **O padrão das políticas de fãs (lidas em 24/10/2026): todas proíbem jogo**, de graça ou não — Wizards ("Don't use
  Wizards' IP in other games… regardless of whether it is distributed for free"), Supercell ("You cannot create new
  products… Not even if they were free"), Riot. Um "-dle" com franquia de terceiro só com licença por escrito; o que
  dá para lançar sem pedir é conteúdo LIVRE (o SRD 5.1 do D&D em CC BY 4.0, folclore e mitologia em domínio público,
  países e bandeiras, as figuras Fluent que o "Qual é o tamanho?" já usa).
- Ressalva: só a página de entrada foi medida. Anúncio pode aparecer no meio da partida.
- **Varredura de 04/11/2026** (pedido dele: jogos que outros mantêm, para não gerar conteúdo nem manter), o mesmo método
  (12 s num Chrome) e mais o cabeçalho de embutir da página. **Sem anúncio e o cabeçalho deixa embutir:** JKLM.fun,
  OGS (online-go.com), Wikitrivia, PlayStrategy, Lidraughts (damas), Lishogi, PyChess, Codenames (codenames.game, o
  oficial), horsepaste, Drawphone, playingcards.io e Lidraughts. **A varredura de 12 s ERROU dois, no mesmo dia, lendo o
  texto da página:** o Geotastic TEM anúncio ("Ad network: Publift", pelo html-load.cc, que a lista de domínios não
  pegava; e funções travadas até o pagamento de 3 €), e o Wikispeedruns também ("Viewing these ads supports us"). Lição:
  ler o texto da página junto com os domínios. E o JKLM.fun NÃO roda numa moldura de outro site ("Could not load games
  list", 400), apesar do cabeçalho. **Sem anúncio, mas não embute:** Lichess,
  Clues by Sam, chess.com. **Com anúncio:** Broken Picturephone, netgames.io, Colonist, Buddy Board Games, Semantle,
  The Wiki Game, OpenGuessr, Spyfall (o site), Sandspiel, ZType, Drawasaurus, Sketchful, papergames, Travle, Keymash,
  Monkeytype, e Board Game Arena (que também não embute). Neal.fun, Secret Hitler e TETR.IO barraram o Chrome de teste
  (403): sem medida. O cabeçalho deixar não prova que roda no iframe (cookie de terceiro, site que se recusa por
  script): só o teste dentro do Syden prova. Licenças, para hospedar: Drawphone, Wikitrivia, Spyfall, 2048,
  boardgame.io e Sandspiel são MIT, Scribble.rs BSD-3; OpenFront AGPL e o Codenames do horsepaste SEM licença (e a
  marca é da CGE): não.
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

**A aba Solo é jogar sozinho, e o Coletivo chama a turma (24/10/2026, pedido dele).** Os seis que funcionam com uma pessoa
(Qual é o tamanho?, xadrez, sudoku e os três quizzes) estão nas DUAS abas. No Solo a partida é da PESSOA, não da sala
(`/api/minijogo-solo`): começa sem convite, não ocupa a sala (a turma começa o jogo dela ao mesmo tempo), não pede chamada
(o computador do quarto tem a seção Solo) e não conta nas conquistas, que medem gente junta.

**Os quizzes de adivinhar (24/10/2026):** o formato dos "-dle" num motor só (`server/src/minijogo-quiz.ts`): o tema é a
lista e as colunas. Monstros de fantasia (SRD 5.1, CC BY 4.0), Países (Natural Earth) e Mitologia (lista nossa, nomes do
Wikidata). Franquia de terceiro entra como mais um tema SÓ com licença por escrito.
**O crédito de terceiro mora nos TERMOS, seção 10 "Créditos" (decisão dele, 25/10/2026), e não na tela do jogo:** a CC BY
4.0 aceita "qualquer maneira razoável", e o parágrafo do SRD em inglês no meio do quiz era ruído. Material livre novo
(dados, figuras, fontes) ganha a linha dele lá, nas duas línguas; se foi traduzido ou adaptado, a linha diz isso.

**A CORRIDA DOS COELHOS (ideia dele, 03/11/2026): kart de 16 bits, com o Super Mario Kart de referência.** O que ficou
decidido na conversa, antes do código:
- **Da referência, só a MECÂNICA** (a regra da sondagem): câmera em perspectiva estilo Mode 7, derrapagem que carrega
  turbo, placas de turbo, copas de pistas. Nada da Nintendo: nem casco, nem banana com aquele desenho, nem o juiz nas
  nuvens, nem nome que lembre. Os itens, quando vierem, são do tema do coelho (cenoura turbo, repolho que rola).
- **Música: a regra do "nunca fazer a nossa" vale aqui.** Sai com efeitos sintetizados, ou com música de terceiro
  licenciada; corrida é onde dá vontade de compor uma trilha, e é exatamente o que não se faz.
- **O problema é a rede, não a arte:** servidor na Alemanha, turma no Brasil, ~200 ms de ida e volta. Na corrida ao vivo,
  cada um dirige o próprio kart no próprio computador, os outros chegam suavizados, sem batida física entre karts, e o
  servidor decide os itens e a chegada com folga a favor de quem joga.
- **Os degraus:** (1) contra o relógio, solo, com os FANTASMAS dos recordes dos amigos; (2) a corrida ao vivo na sala, sem
  itens; (3) itens, copas e troféus. O degrau 1 é também o teste de qualidade: se a direção não convencer, para ali.
- **OS TROFÉUS (decisão dele, mesma conversa): os dois.** O do QUARTO é de quem ganhou, atrelado à POSIÇÃO numa corrida de
  verdade, e diz quando, contra quem, a pista e o tempo: "um registro do momento entre amigos". O COLETIVO é do salão, da
  turma (completar uma copa juntos). É a primeira conquista individual do Syden, e por decisão dele; as conquistas da
  turma continuam contando só gente junta.

**O degrau 1 está feito (03/11/2026):** a aba Solo tem a **Corrida dos coelhos** (`web/src/JogoCorrida.tsx`,
`web/src/corrida/`). A pista "Horta" é desenhada POR CÓDIGO a partir da linha do meio (`pista.ts`: asfalto, zebra, grama,
placas de turbo, um lago, árvores, canteiros de cenoura); a câmera é o Mode 7 numa tela de 320 × 180 ampliada (`render.ts`);
a física anda em passos fixos de 1/60 s, e **o tempo é o número de passos**, não o relógio (`fisica.ts`): o mesmo comando dá
o mesmo tempo, e a janela sem foco PAUSA a corrida. **O coelho no kart é o mascote 3D** sentado num kart-cenoura feito no
Blender por script (`e2e/pixel-art/personagem/blender/meshy/kart.py`, 24 ângulos, `kart-pos.py` → `web/public/corrida/
coelho-kart.png`): as pernas da malha, que estragavam o sentado, somem dentro do kart. O servidor guarda só o MELHOR tempo
de cada pessoa por pista, com as voltas e o fantasma (`corrida_recordes`, `server/src/corrida.ts`), e **só os amigos
aceitos veem** (o fantasma é o caminho que alguém fez). Ele confere o que dá sem conhecer a pista (uma posição a cada 4
passos, nenhum salto maior que o turbo, volta de 8 s ou mais); cortar pela grama continua possível, e é corrida entre
amigos. Cada corrida até o fim entra no painel de uso (é o único jogo só do Solo). Pista nova é id novo ("horta-1"):
mudar o traçado não mistura fantasmas. Testes: `web/test/corrida.test.ts` (o piloto automático fecha as voltas),
`server/test/corrida.test.ts` e `e2e/corrida.mjs` (o piloto automático liga por `window.corridaPilotoAutomatico`, só no site
de desenvolvimento). Sem som por enquanto.

**O degrau 2 está feito (03/11/2026, depois de ele testar o 1: "ficou ótimo"): a corrida NA SALA.** A Corrida dos
coelhos está nas duas abas: no Solo, o contra o relógio; no Coletivo, o convite de sempre (2 pessoas ou mais), e a turma
corre junto (`server/src/minijogo-corrida.ts`, `JogoCorridaNaSala` em `web/src/JogoCorrida.tsx`; o laço comum mora em
`web/src/corrida/laco.ts`). Como decidido pela rede: o servidor dá a LARGADA (o mesmo semáforo para todos, pelo relógio
da partida) e só REPASSA as posições (o tempo real do motor, 15 por segundo, carimbadas com quem mandou); cada um dirige
no próprio computador, e os outros aparecem no MESMO PASSO da corrida deles, interpolados (e um pouco adiante, se a
internet atrasa). **A classificação é pelo tempo de cada um, em passos desde o próprio verde**, conferido pelo fantasma
como no contra o relógio: quem tem internet pior não perde por isso, e quem pausa (janela sem foco) só perde o prazo.
A primeira chegada abre 30 s para os outros; quem não chega fica atrás, pelo quanto andou. Na tela: o nome em cima de
cada kart, a ordem ao vivo no canto, e na chegada a lista com os tempos — **as medalhas só no fim**, porque quem ainda
corre pode fazer um tempo menor. Quem disse "Agora não" assiste pela câmera de quem está na frente. Uma corrida da sala
que bate o recorde da pessoa vira o recorde dela. Sem batida entre karts. A corrida ainda NÃO entra nas conquistas da
turma (nem os quizzes estão lá): o troféu coletivo do degrau 3 é o lugar dela. Testes: `server/test/minijogos-corrida.test.ts`
e `e2e/corrida-na-sala.mjs` (três pessoas, uma assistindo, com o LiveKit).
**A revisão independente (03/11/2026, antes do push do degrau 2) achou que o servidor confiava demais no fantasma**, e
virou regra: um kart PARADO passava e virava recorde de 0:24 — agora cada volta tem de andar 70% da pista e acabar na
linha de chegada (`PISTAS` em `server/src/corrida.ts` guarda o comprimento e a linha; `web/test/corrida.test.ts` confere
que batem com a pista do site e que o fantasma honesto passa) — e, desde a auditoria de 03/11/2026, passar pelos 10 MARCOS da pista, na ordem (um
fantasma inventado, indo e voltando na linha de chegada, fazia 0:26.8 contra 1:00.5 honesto; os marcos saem de `marcosDaPista` no
site, e o teste confere que batem); e, na sala, um fantasma guardado mandado pelo console um
segundo depois do verde ganhava e fechava o prazo de todos — agora a chegada não pode declarar mais tempo do que passou
desde o verde do servidor (+3 s de folga). Pista nova precisa da linha dela em `PISTAS`.

**O degrau 3 está feito (03/11/2026, pedido dele: "pode fazer o degrau 3 que depois subo tudo de uma vez"):**
- **Três pistas e a Copa da Cenoura.** A Horta, o **Pomar** (outono, laranjeiras, um "S") e a **Praia** (areia fora do asfalto,
  que segura como a grama, coqueiros, uma lagoa), todas por código a partir de um TEMA (`Tema` em `pista.ts`: as cores do
  chão, o que cresce, o céu e os morros). No Solo, escolhe-se a pista, e cada uma tem os seus recordes. Na sala, escolhe-se
  uma pista ou a **copa**: as três seguidas, com pontos por posição (10, 8, 6, 5, 4, 3, 2, 1) e 10 s de placar entre uma e
  outra; empate nos pontos desempata pela soma dos tempos.
- **Os itens, só na sala** (o contra o relógio fica limpo: o recorde é da pilotagem, e por isso a corrida da sala, com itens,
  NÃO vira recorde). Caixas em fileiras na pista; o item sai pela posição (quem está atrás ganha mais cenoura e repolho, quem
  lidera mais lama): **cenoura** (turbo), **repolho** (anda pela linha do meio até 4 s e derruba quem pega) e **lama** (fica
  30 s onde caiu). Cada item é um evento com o passo da corrida de quem o usou, e todo computador simula o mesmo trajeto;
  **quem decide se foi atingido é quem leva**, e avisa os outros para o item sumir. O servidor carimba o dono e não deixa
  usar mais itens que as caixas dão (2 fileiras × 3 voltas + 1), nem dois no mesmo segundo. Tecla E (ou Ctrl); no toque, um
  botão com o item.
- **O troféu do QUARTO** (`corrida_trofeus`, `TrofeusDaCorrida.tsx`): o pódio de cada corrida avulsa e de cada copa na sala,
  com 2 ou mais, com a posição, a pista, o tempo (na copa, a soma, e os pontos), a data e CONTRA QUEM — guardado pelos ids, e
  o nome lido na hora (quem exclui a conta vira "Conta excluída" no troféu dos outros, e o nome dela não fica guardado). Só a
  pessoa vê. Abre pela estante de troféus do quarto (que entrou na arrumação de fábrica, na parede da direita, e aparece
  sozinha nos quartos já arrumados) e pelo botão "Troféus" da largada do Solo.
- **O troféu COLETIVO** é a conquista **"Copa da turma"** no salão (`corrida_copas`, `conquistas.ts`): copas corridas até o
  fim pela turma, com 2 ou mais, em degraus de 1, 5 e 20. Sem pessoa.
- Testes: `server/test/minijogos-corrida.test.ts` (a copa, os troféus, o limite dos itens), `web/test/corrida.test.ts` (as três
  pistas: medidas iguais às do servidor, sem trecho encostado, o fantasma honesto passando; o repolho e o sorteio),
  `e2e/corrida-na-sala.mjs` (a copa inteira, ~5 min; `SO_HORTA=1` faz uma corrida só) e `e2e/corrida.mjs`.

**Mais pistas e o coelho de cada um (03/11/2026, pedido dele: "fazer mais mapas, usar os diferentes avatares"):**
- **Seis pistas e duas copas.** Além das três da Copa da Cenoura, a **Copa do Repolho**: o **Bosque** (pinheiros, pista mais
  estreita), a **Neve** (neve fora do asfalto e PLACAS DE GELO na pista: o rumo segue o kart devagar, e ele escorrega;
  `Chao.Gelo`) e o **Cânion** (rocha vermelha, cactos, areia). Copa nova é uma linha em `COPAS`, no site e no servidor (o
  teste confere que são iguais). O lago só cobre grama ou areia: posto errado, não vira parede no asfalto.
- **Cada um corre com o próprio coelho**, por TROCA DE PALETA (como os jogos do Super Nintendo): a folha do kart é uma só (o
  mascote 3D), e o pelo e o moletom viram as cores do avatar pronto da pessoa (`web/scripts/cores-dos-avatares.py` tira de
  cada corpo a cor do pelo e a da roupa e gera `coresDosAvatares.ts`; a conferência é
  `e2e/pixel-art/personagem/blender/meshy/t/kart-avatares.png`). Bonés, gorros, óculos e fones NÃO aparecem: pediriam um
  modelo 3D por coelho (o caminho já decidido para os 16, quando o Meshy voltar). Sem avatar pronto (foto), o mascote.
- **"Praia" e "Neve" são também palavras do Desenha e adivinha**, cuja tradução guarda as alternativas aceitas com "|": o nome
  da pista na tela é a primeira (`nomeDaPistaEm`). Nome de pista que coincidir com palavra do desenho passa por ele.

**O FLIPERAMA COMO HUB DE JOGOS DE 16 BITS (pedido dele, 03/11/2026): "mini jogos nossos, inspirados em Super Nintendo e
minijogos de Mario Party", integrados à estante que já existe.** A varredura (só a mecânica; nada de nome, personagem, arte ou
som de ninguém; o Tetris é o perigo: a empresa já ganhou na justiça pelo formato das peças e da grade): o que cabe na rede é o
que cada um joga NA PRÓPRIA TELA e compara, ou por turnos; o que pede contato ao vivo entre jogadores (empurrar, a mesma bola)
fica de fora. A ordem proposta: (1) os microjogos de festa, (2) minigolfe, (3) corrida de plataforma com fantasmas (o motor do
kart), (4) blocos que caem em versus (trocar e combinar, como Panel de Pon/Puyo, NÃO Tetris), (5) por último o TABULEIRO estilo
Mario Party (dado, casas, um microjogo entre as rodadas), quando houver uns dez microjogos. Arena de bombas, em observação.
Ritmo, fora até haver música licenciada.

**A FESTA DOS COELHOS está feita (03/11/2026, o item 1, em paralelo ao kart):** `server/src/minijogo-festa.ts`,
`web/src/JogoFesta.tsx`, nas duas abas. Cinco rodadas, cada uma um microjogo sorteado sem repetir — Saque rápido (o sinal sai
entre 2 e 5 s; antes dele, está fora), Medidor de força, Parar o relógio (10 s, os números somem depois de 3), Jogo dos copos,
Siga o coelho e Tiro ao alvo —, com o "prepare-se", o jogo e a revelação; 10, 8, 6… pela posição, e as medalhas só no fim. O
servidor é dono do relógio e das respostas (o sinal do saque só vai quando sai, e a reação conta de quando apareceu em cada
tela, mas nunca abaixo de 100 ms nem muito abaixo do que o servidor viu passar). No Coletivo, o pódio vai para a mesma estante
de troféus do quarto (`pista: 'festa'`). Microjogo novo é uma entrada nos dois lados; a estante de troféus serve a qualquer
jogo da sala. Testes: `server/test/minijogos-festa.test.ts` e `e2e/festa.mjs` (com o LiveKit).

**A BRIGA NA HORTA está feita, como PILOTO (03/11/2026, pedido dele: a nostalgia dos fliperamas de briga de quatro do começo
dos anos 90; só a mecânica):** `server/src/minijogo-briga.ts`, `web/src/JogoBriga.tsx`, `web/src/briga/`, nas duas abas (1 a 4
pessoas). Uma fase de ~2 min na horta, de lado (andar também para o fundo), 4 ondas de raposas e corvos e o texugo no fim;
combo de três socos, pulo, voadora, o especial que gasta vida, cair e levantar piscando, 3 vidas. **É o único jogo em que a
turma divide os mesmos inimigos**, e a rede decidiu assim: os inimigos são do SERVIDOR (passo próprio de 20 por segundo, o
quadro pelo `difundir`, que o motor ganhou; e o `parar`, que desliga o passo); cada coelho anda no computador de quem joga;
**quem bate tem razão** (o acerto como a tela mostrou, conferido pelo passado do inimigo) e **quem apanha tem folga** (o golpe
inimigo só é decidido 200 ms depois, e quem saiu da área nessa janela escapa; as preparações são longas de propósito). O
coelho é o mascote 3D de lado (`briga.py`/`briga-pos.py`, com a troca de paleta do avatar). Troféu só com a fase vencida
(`pista: 'briga'`). Testes: `server/test/minijogos-briga.test.ts`, `web/test/briga.test.ts` (o piloto automático vence a
fase contra o servidor de verdade, com 200 ms de atraso) e `e2e/briga.mjs` (escrito, não rodado).

**A HORTA EM CASCATA está feita (03/11/2026, o item 4):** trocar e combinar com a pilha subindo, 6 × 12 (NÃO é Tetris: nada
cai do alto em forma de peça), com seis legumes desenhados por código. Cadeia (o que cai e combina) e combo (4 ou mais)
valem mais e, na sala, mandam CAIXOTES ao próximo adversário vivo, em roda; o caixote vira legume quando algo some do lado.
Nas duas abas: no Solo, "Sem fim" ou "2 minutos"; no Coletivo, de 2 a 8, ganha quem sobra. **A regra mora num arquivo só, em
duas cópias iguais byte a byte** (`server/src/blocos-sim.ts` e `web/src/blocos/sim.ts`; `web/test/blocos.test.ts` confere): o
servidor dá a semente, o site manda as jogadas (o passo e a casa) em lotes, e o servidor REFAZ a partida de cada um — os
pontos, os caixotes e quem chegou ao topo são dele (`server/src/minijogo-blocos.ts`). O caixote cai ~1,5 s no futuro de quem
recebe; chegou atrasado, a tela refaz a partida do começo. Passo à frente do relógio do servidor não vale, e no versus quem
fica 5 s calado é levado adiante sem jogadas. No pódio, a POSIÇÃO é a ordem de eliminação, `pontos` o placar e `tempoMs` o
quanto a pilha aguentou (`pista: 'blocos'`; quem não fez nenhuma troca não sobe). Testes: `server/test/minijogos-blocos.test.ts`,
`web/test/blocos.test.ts` e `e2e/blocos.mjs` (o piloto automático liga por `window.blocosPilotoAutomatico`, só em desenvolvimento).

**O PULO DO COELHO está feito (03/11/2026, o item 3: a corrida de plataforma com fantasmas, no motor do kart):**
`web/src/plataforma/`, `web/src/JogoPlataforma.tsx`, `server/src/plataforma.ts`, `server/src/minijogo-plataforma.ts`, nas duas
abas. Três fases curtas POR CÓDIGO (Prado, Toca e Galhos, ~35 s cada; `fases.ts` monta a grade de blocos por um roteiro):
correr, pulo mais alto segurando, a folga da beirada (coiote) e o pulo guardado, molas, plataformas que andam (só pelo passo,
então todos as veem no mesmo lugar), buracos e espinhos que voltam ao último posto. O coelho é o mascote 3D de TRÊS QUARTOS (o
sudeste: de perfil, a câmera alta o mostra de costas), reduzido por `web/scripts/plataforma-coelho.py`. Como no kart: passos
fixos de 1/60 s, o tempo é o número de passos, o fantasma é uma posição a cada 4 passos; no Solo, contra o relógio e os
fantasmas dos amigos (`plataforma_recordes`, só amigos aceitos veem); na sala, uma fase ou a **Copa do Pulo** (as três), o
servidor dá o verde, repassa as posições e classifica pelo tempo de cada um, e o pódio vai à estante de troféus. Sem itens, a
fase da sala que bate o recorde da pessoa vira o recorde. O servidor não conhece os blocos: confere a largada, a chegada, a
velocidade por amostra (a corrida, e mais a da plataforma só nos trechos dela), a volta ao posto só para um posto já
alcançado, e o relógio desde o verde; atravessar parede pelo console continua possível, e ganha uns 2 s (escrito em
`plataforma.ts`). Fase nova é id novo e as medidas dela em `FASES_DO_PULO`. O piloto automático PLANEJA (busca em feixe sobre a
física, `piloto.ts`): serve aos testes e ao e2e (`window.plataformaPilotoAutomatico`, só no site de desenvolvimento). Testes:
`web/test/plataforma.test.ts`, `server/test/plataforma.test.ts`, `server/test/minijogos-plataforma.test.ts`; `e2e/plataforma.mjs`
escrito, NÃO rodado. Sem som.

**O MINIGOLFE DA TOCA está feito (03/11/2026, o item 2):** `server/src/minijogo-golfe.ts`, `web/src/JogoGolfe.tsx`, nas duas
abas. Seis buracos curtos vistos de cima, desenhados pixel a pixel (jardim, horta, toca, lago, porteira com a tábua que anda,
raízes), com areia que segura, água que devolve a bola com uma tacada a mais e cogumelos que quicam. Puxar a bola para trás e
soltar (ou setas e Espaço segurado). A turma joga o MESMO buraco ao mesmo tempo, cada um na própria tela, com as bolas dos
outros como pontinhos (o tempo real); o buraco fecha quando todos terminaram ou em 60 s (120 s sozinho), e quem não acertou
em 6 tacadas fica com 7. Menos tacadas ganha. **A FÍSICA É UM ARQUIVO SÓ, NOS DOIS LADOS** (`server/src/golfe-fisica.ts` e
`web/src/golfe/fisica.ts`, iguais byte a byte, e `web/test/golfe.test.ts` confere): cada tacada vai ao servidor na hora,
com o passo do relógio e o vetor em inteiros, e o servidor a simula — o resultado é o dele. Sem seno nem cosseno dentro da
simulação (só + − × ÷ e raiz, que dão o mesmo número em qualquer navegador). O que sobra possível: um programa que calcule a
tacada perfeita. Troféu com `pista: 'golfe'`, os pontos sendo o total de tacadas. Testes: `server/test/minijogos-golfe.test.ts`,
`web/test/golfe.test.ts` e `e2e/golfe.mjs`.

**OS AJUSTES DO FLIPERAMA DE 05/11/2026 (pedidos dele, no mesmo dia):**
- **O Minigolfe em perspectiva**, como a corrida (`web/src/golfe/mode7.ts`): a câmera atrás da bola, o chão é a mesa de cima lida
  a cada quadro, a bandeira e as bolas de pé; a mesa de cima vira o mapa do canto. Na perspectiva, puxar para baixo é a força e
  para o lado é a mira. A física não mudou.
- **A Horta em cascata troca também na VERTICAL** (a jogada de tipo 2: a casa com a de baixo, só entre dois legumes parados; tecla C,
  ou tocar e arrastar para cima ou para baixo). Mudou a regra nas duas cópias: servidor e site sobem juntos.
- **A Briga mostra as teclas desenhadas** (as setas, Z, X, C) embaixo da fase; no toque, não.
- **No Pulo, quem chegou assiste a quem ainda corre** (`seguir`/`aoAssistir` em `plataforma/laco.ts`), com ◀ ▶ para trocar.
- **Efeitos sonoros em todos** (`web/src/somDosJogos.ts`, sintetizados, sem arquivo) e o alto-falante no cabeçalho do painel para
  silenciar (lembrado no aparelho; "Desativar áudio" da chamada também cala). **Música, não:** a regra do "nunca fazer a nossa"
  vale; entra quando houver trilha de terceiro com licença, e o mesmo botão já a silencia.

**O XADREZ (05/11/2026, pedido dele: "adicione xadrez também, com os assets"):** a partida inteira, ao lado dos Problemas de
xadrez, na mesa de duas pessoas e no Solo contra o robô (`server/src/minijogo-partida-de-xadrez.ts`, id `partida-de-xadrez`). As
regras são do chess.js (BSD-2): o servidor gera os lances e o site só escolhe; a promoção é sempre a dama. O robô olha o lance dele
e a resposta, mais as capturas que sobram (abaixo de 1,5 s; o teste confere). Em 3D com o tabuleiro e as peças do KayKit Board
Game Bits (`web/src/xadrez3d/`), o tabuleiro de botões por baixo. Fora das conquistas da turma até ele decidir.

**MAIS 3D E DOIS JOGOS NOVOS (05/11/2026, pedidos dele):** Damas, Truco, Dominó e os dados do Cidades em 3D (`web/src/mesa3d/`, a base
comum e o gancho `useCena3D`; KayKit Board Game Bits). A **Cozinha da toca** (`minijogo-cozinha.ts`, `JogoCozinha.tsx`; KayKit Restaurant
Bits): CADA UM NA PRÓPRIA COZINHA, os mesmos pedidos (a abordagem aprovada por ele, pela lição do Overcooked acima); o servidor confere cada
prato pela receita. O **Rolê do coelho** (`minijogo-skate.ts`, `JogoSkate.tsx`; Kenney Mini Skate): skate de 2 minutos com combos, só a
mecânica (nada de Tony Hawk); só no Solo até a sala ser testada na tela. No xadrez, a promoção deixa escolher a peça. O jogo de
estratégia (o pacote Ultimate Fantasy RTS do Quaternius, CC0, em glTF) é o próximo, contra o computador primeiro.

**O LOTE DA TARDE DE 05/11/2026 (pedidos dele):**
- **Tocas e Torres** (`JogoTocas.tsx`, `web/src/tocas/`, `minijogo-tocas.ts`): o RTS, só no Solo. O nome é dele; **"Age of Bunny" foi
  recusado** por imitar o "Age of" da marca da Microsoft. A simulação é determinística em passo fixo, pronta para a sala por lockstep
  (o degrau seguinte). O painel é pequeno para o gênero: abrir maior é pendência.
- **Futebol dos coelhos** (`minijogo-futebol.ts`, `futebol-sim.ts` ↔ `web/src/futebol/sim.ts`): **ele escolheu a partida AO VIVO na
  sala**, aceitando o atraso, contra a regra de "a mesma bola ao vivo fica de fora": a bola mora no servidor, "quem chuta tem razão"
  pelo passado de 300 ms, e os times se completam com robôs. No Solo roda no navegador, sem atraso.
- **Minigolfe 3D** (`golfe3d`, Kenney Minigolf Kit): ao lado do Minigolfe da toca, **de propósito**, para a turma dizer qual prefere;
  um não substitui o outro até ele decidir.
- **Capitais** é o nome novo do Cidades à venda (escolha dele); o id continua `cidades`.
- **O fichário de gêneros** (`FicharioDeGeneros.tsx`): jogo novo precisa da linha dele em `GENEROS_DOS_JOGOS` (o teste cobra).
- **Os jogos em 3D abrem direto no 3D**: enquanto a cena carrega, a caixa mostra a cor do fundo dela, e o 2D fica só para o teclado
  e o leitor de tela ("carrega primeiro a versão 2D depois a 3D" era o relato).
- **Truco:** "Aceitou!" e "Correu!" grandes na mesa; a carta sai no clique (o servidor só confirma).
- **Batalha naval:** a montagem da frota antes do primeiro tiro (`Regras.montagem` no duelo), e a **frota moderna** (navios civis do
  Watercraft Pack) como opção de aparência de cada um. Não há navio de guerra moderno em pacote livre nenhum que temos.
- **Reações na chamada** (`reacoes.ts`): os balões do Kenney Emotes Pack em cima do quadro, pelo canal de dados do LiveKit (cifrado,
  nada no servidor). **No salão, não**: quem está fora da chamada não recebe o canal, e levar ao salão pede o servidor repassar.
- **O coelho 3D é um módulo só** (`web/src/coelho3d.ts`): todo jogo 3D novo carrega o coelho por ele. **A "massa sem textura" era
  LUZ, não textura** (medido lado a lado em 05/11/2026, relato dele: "a animação que baixei tem textura"): o arquivo animado do Meshy
  é byte a byte o `mascote-t.glb`, a mesma pintura; o visualizador dele tem luz de AMBIENTE, e os jogos só sol e céu chapado. A luz
  de ambiente agora vai no material do coelho (um céu pequeno pintado por código, só nele: as peças dos jogos continuam com a luz
  delas), e o relevo do Meshy volta à parte do GLB (`cidades3d/coelho-relevo.jpg`, 1024).
- **Minigolfe 3D, a tacada por cima** (pedido dele: "a bola sempre vai linear ao solo"): a tacada leva `dy` e a bola voa por cima
  das bordas baixas (0,147) e dos fossos; castelo e moinho são torres. Mudou a física nas duas cópias: servidor e site sobem juntos.
  Tecla Q ou o botão; a mira vira o arco de verdade. **O cenário** ganhou céu em degradê, nuvens, morros e o parque (Coaster Kit da
  Kenney, CC0, crédito nos termos).
- **Tocas e Torres, a segunda rodada (pedidos dele, mesmo dia):** a janela larga e da altura da tela; o painel e os recursos DENTRO
  da janela do jogo, com altura fixa (a barra de rolagem que aparecia ao escolher algo mudava a largura, e o 3D redimensionado
  piscava preto e pulava a câmera); fora do mapa é preto; os ícones são os próprios modelos dos recursos fotografados em PNG
  (`web/public/tocas/icones/`); a taxa "+x" é o que chegou no último minuto da partida; **o ponto de reunião** (botão direito com o
  prédio escolhido; em cima de uma fonte, quem nasce vai coletar); e o treino que não sai diz o porquê (falta recurso, fila cheia,
  "Falta casa").
- **Os três de 16 bits pedidos depois do sucesso do kart (05/11/2026, ele aprovou os três):**
  - **Esquadrilha da toca** (`nave`, `minijogo-nave.ts`, `nave-sim.ts` ↔ `web/src/nave/sim.ts`): navinha de rolagem vertical com a
    rede da Caça. A turma voa as MESMAS ondas, cada um na própria tela; o servidor refaz cada acerto pela "Ficha" (passo no relógio,
    cadência, arma que a pessoa tem, nave sem teleporte). O golpe que a nave LEVA é quem leva que diz (a regra do repolho). Solo
    com recorde (`nave_recordes`), Coletivo com o pódio e o placar somado da esquadrilha. Tudo desenhado por código.
  - **Estoura-balão** (`balao`, `minijogo-balao.ts`, `balao-sim.ts` ↔ `web/src/balao/sim.ts`): o modo arena do kart, sobre o motor
    da corrida (só importa de `web/src/corrida/`). Três balões, os itens do kart estouram, quem fica sem sai. **Contra quem nunca se
    declara atingido:** o caminho do repolho e a lama são contas iguais nos dois lados, e o servidor refaz cada posição que chega
    contra os itens vivos; quem passou por um e não avisou perde o balão do mesmo jeito, e quem fica calado 1,5 s fica "parado" na
    última posição. Sobra possível: mandar posições inventadas que desviam (e são o kart que a turma vê). Solo contra 1 a 5 robôs.
  - **Coelhos a jato** (`jato`, `minijogo-jato.ts`, `server/src/jato.ts`, `web/src/jato/`): a corrida futurista, o dobro da
    velocidade do kart, com a energia que é vida e turbo. Uma CÓPIA do que precisou da corrida (`jato/util.ts`), sem mexer nela.
    11 naves do computador completam a pista (não entram na classificação nem no troféu). Recordes e fantasmas como o kart
    (`jato_recordes`, só amigos aceitos veem; na política desde o mesmo dia, com os recordes da Caça e da Esquadrilha, que faltavam).
  - **Regata da toca** (`barco`, `minijogo-barco.ts`, `server/src/barco.ts`, `web/src/barco/`): a corrida de barquinhos do Mario
    Party 3 sobre a técnica do kart, com a água que desliza, a correnteza e as argolas; recordes e fantasmas como o kart
    (`barco_recordes`, na política). **O chefe da turma** (`chefe`, `minijogo-chefe.ts`, `server/src/chefe/`): a turma contra a
    toupeira-rei, com a rede da Briga (o chefe no servidor, o golpe decidido 220 ms depois).
  - **A Festa é plugável desde 05/11/2026** (`server/src/festa/` e `web/src/festa/`, o guia no topo de `registro.ts`): um par de
    arquivos por microjogo, e os lotes do Mario Party 3 entram pelos `loteN.ts`. Microjogo registrado entra no sorteio da Festa E do
    Tabuleiro da turma.
  - **OS MINIJOGOS DO MARIO PARTY 3 (05/11/2026, pedido dele: "implemente os jogos das classes A, B e C"):** 51 microjogos novos na
    Festa (10 → 61), em seis lotes (`loteN.ts`), cada um com robô, teste de servidor e a jogada honesta em
    `server/test/festa-loteN-ajuda.ts`. **Ficaram de fora, de propósito:** 2 do lote 5 (repetiam o canteiro) e 5 do lote 6
    (Spotlight Swim, Coconut Conk e Hand Line and Sinker por tempo; Crazy Cogs e River Raiders porque pedem um objeto da turma
    inteira ao vivo, ruim com 200 ms), e os três que já tínhamos (os dois de tiro no chefinho = Caça; o de blocos = Horta em
    cascata). Os de CLASSE C usam o canal ao vivo e as equipes do formato (o empurrão é golpe com aviso, decidido no servidor);
    os de empurrar têm `minimo: 2` e não saem na Festa sozinho. **NINGUÉM JOGOU NENHUM COM GENTE**: o equilíbrio (abóboras da
    ladeira, a mesa 2 da tacada, a folha longe do balanço, a balsa que sente a rede) é chute medido contra robôs.
  - **O Tabuleiro da turma é 3D** (`web/src/tabuleiro3d/`), no meio de uma mini cidade, com a câmera de cada um; o SVG fica de
    reserva.
  - Nenhum dos três tem e2e com a sala de verdade (LiveKit e duas pessoas): os Coletivos estão cobertos só pelos testes do servidor.
    Ficam fora das conquistas da turma até ele decidir, como os outros novos.
  - O levantamento do Mario Party 3 (o pedido dele: "um de caça que eu adorava, Aces High") está em `docs/mario-party-3.md`: o
    Aces High vira o "Duelo de aviõezinhos" sobre a rede dos itens do kart, e uns 34 minijogos cabem como microjogo da Festa.

**O TABULEIRO DA TURMA está feito (03/11/2026, o item 5):** `server/src/minijogo-tabuleiro-da-turma.ts`, `web/src/JogoTabuleiro.tsx`,
só no Coletivo (2 a 8). Uma volta de 30 casas em volta de uma horta, desenhada por código; 5, 10 ou 15 rodadas. Na vez, cada
um pede o dado (QUEM SORTEIA É O SERVIDOR), a peça anda na tela casa a casa, e a casa age: +3 cenouras, −3, ou um evento
(chuva na horta, trocar de lugar, cenouras escondidas). Passar pela cenoura dourada com 20 cenouras deixa comprá-la, e ela muda
de casa. Depois que todos andaram, a turma joga um microjogo da Festa, que é a MESMA rodada (`rodadaDeFesta` em
`minijogo-festa.ts`, `RodadaDaFesta` em `JogoFesta.tsx`, com a mesma conferência), e a posição dá 10, 6, 4 e 2 cenouras.
Ganha quem tem mais douradas, depois mais cenouras. Ninguém segura a turma: a vez tem 20 s (o dado sai sozinho; na loja,
compra), quem saiu da sala é pulado, e com menos de 2 a partida acaba sem troféu. O pódio de quem ficou até o fim vai para a
estante do quarto (`pista: 'tabuleiro'`, os pontos são as douradas). Sem bifurcação no caminho, por enquanto. Testes:
`server/test/minijogos-tabuleiro-da-turma.test.ts` e `e2e/tabuleiro.mjs` (escrito, NÃO rodado).

**CIDADES À VENDA (04/11/2026, pedido dele: "eu queria um monopoly para jogarmos"):** comprar cidades e cobrar aluguel, SÓ A
MECÂNICA. Nada de nome, ruas, cartas, cantos ou visual de Monopoly nem de Banco Imobiliário (marcas da Hasbro e da Estrela).
`server/src/minijogo-cidades.ts`, `web/src/JogoCidades.tsx`, só no Coletivo (2 a 6). Uma volta de 32 casas com 20 capitais em 7
grupos por região (a sigla do estado na casa, a cor da região), 4 transportes diferentes (o aluguel sobe com quantos o dono tem),
notícias nossas (festa junina, carona, ônibus errado…), pedágio, engarrafamento (perde a próxima vez) e feriado. **O que ele
escolheu:** quem começa escolhe 10, 20 ou 30 rodadas (ganha o maior patrimônio) ou ATÉ SOBRAR UM; quem fica sem dinheiro SAI E
ASSISTE; há TROCA (na própria vez, até 3 propostas) e LEILÃO (quem parou não comprou: todos dão lance, cada lance devolve 8 s).
Construir pede a região inteira e sem hipoteca (até 4 prédios). **Quem deve mais do que tem não administra nada:** o servidor
vende os prédios e hipoteca as cidades sozinho; não cobrindo, a pessoa fale e o que tinha vai ao credor (ou ao banco). A casa só
age quando a peça CHEGA (a fase 'andando' segura o dinheiro). Troféu com `pista: 'cidades'`, os pontos são o patrimônio. Conta nas conquistas da
turma (Repertório e "A turma do jogo", decisão dele em 04/11/2026: o Repertório completo passou de 15 para 16 jogos). Testes: `server/test/minijogos-cidades.test.ts`. Sem e2e.
**No SOLO, contra o computador (05/11/2026, pedido dele: "opção de jogar sozinho, contra IA"):** a pessoa escolhe de 1 a 5
adversários, que entram como jogadores de id NEGATIVO, sempre "na sala", com nome próprio e o 🤖 na frente (`NOMES_DOS_ROBOS`:
sem tradução e sem fingir que é gente). Só no Solo (`ctx.solo`): na sala, a turma é a graça. Não é modelo de linguagem: são regras
de quem joga com cuidado, e eles só veem o que a pessoa vê. Guardam uma reserva, compram o que fecha o grupo deles ou o de outro,
pagam no leilão até o valor que a casa tem para eles (cada um com o seu "jeito", de 0,8 a 1,15), sobem aos saltos, constroem por
igual nos grupos inteiros, resgatam hipoteca com folga, e aceitam a troca que lhes dá uns 15% a mais (a cidade que fecha o grupo
de quem propõe vale 2,5 vezes). Eles NÃO propõem trocas. Agem depois de uma pausa (`PAUSA_DO_ROBO`, 1,2 s) para a pessoa ver o que
fizeram; o leilão guarda a hora de fechar e os robôs disputam dentro dela. A pessoa que faliu encerra a partida. Contra o computador
não há troféu nem conquista (o Solo não conta).
**O TABULEIRO EM 3D (05/11/2026, pedido dele: "3D cartoon fofo, similar ao Mario Party, com os assets da pasta assets; o nosso
coelho 3D como personagem jogável"):** `web/src/cidades3d/` (three.js 0.186, num pedaço à parte que só carrega com o jogo). Ilha de
grama, as casas em blocos com a sigla e o preço pintados por código, e o que se constrói FORA da volta (casinha e a bandeira do dono;
1–2 prédios baixos, 3 alto, 4 arranha-céu), com um trem de enfeite no miolo. Os modelos são da Kenney (CC0: City Kit Commercial,
Suburban e Train Kit, de `e2e/3D/Assets/`), copiados para `web/public/cidades3d/` com a licença; o crédito nos termos, seção 10. Cada
pessoa é o MASCOTE 3D com o NOSSO esqueleto (`coelho-animado.glb`, de `glb.py`; anda entre as casas e gesticula na vez), com pelo e moletom trocados
pelas cores dela no shader (o escuro abaixo do pescoço é moletom: os olhos ficam), e ele PULA casa a casa. Sem foco na janela, não
desenha; sombras de verdade só com "Sombras" em Gráficos. O desenho em SVG continua de reserva: sem WebGL, ou enquanto carrega.
Os PNG das texturas da Kenney pedem `git add -f` (o .gitignore pega `*.png`).
**2D OU 3D, QUEM ESCOLHE É A PESSOA (05/11/2026, pedido dele: "quero ter material 2D pixel art e 3D low poly; que o usuário possa
escolher o que ele mais gosta"):** Configurações → Gráficos → "Estilo visual: 2D | 3D" (`estiloVisual()` em `web/src/Graficos.tsx`,
em 'syden:graficos'). Hoje só o tabuleiro do Cidades tem as duas versões; o que não tem 3D continua em 2D. De fábrica é 3D, porque
hoje só muda o Cidades, que ele pediu em 3D: quando o quarto 3D for ao app, o padrão é decisão dele de novo. **O quarto low poly** é
um piloto (`e2e/3D/quarto/`, KayKit Bits Bundle 1, CC0), e **o coelho 3D com o NOSSO esqueleto** sai de
`e2e/pixel-art/personagem/blender/meshy/glb.py` (as poses do motor do pixel art viram animações de um GLB,
`web/public/cidades3d/coelho-animado.glb`). O arquivo "animated_mixamo" do Meshy é o mesmo `mascote-t.glb`: esqueleto de gente, sem
orelhas, e só Walking e Running.
**Os outros coletivos no Solo (05/11/2026, pedido dele: "outros jogos coletivos com opção de jogar sozinho contra IA"):** Cinco em
linha, Mancala, Damas, Batalha naval, Dominó, Truco e Tabuleiro da turma, pelo módulo comum `server/src/minijogo-robos.ts` (os nomes,
a pausa, `comRobos` para os jogos de convite contarem os robôs como gente na sala). Nas mesas (`duelo`), o robô senta na hora e
`Regras.robo` dá a jogada pelo mesmo caminho da pessoa, que no Solo não perde pelo tempo; Mancala e Damas olham 5 e 4 lances à frente,
o Cinco em linha pontua ameaças, a Batalha naval caça com o que a pessoa no lugar dele veria. Dominó e Truco de 1 a 3 robôs (com 3, em
duplas, com um robô de parceiro, e no Truco quem responde pela dupla é a pessoa); no Tabuleiro, os robôs ganham resultados plausíveis
nos microjogos da Festa (`resultadoDoRobo`). Ficaram de fora Stop, Desenha e adivinha, Lobisomem e Palavra secreta: robô ali pediria
dicionário, desenho ou conversa. Teste: `server/test/minijogos-robos.test.ts`.

**A CAÇA ÀS PRAGAS DA HORTA (04/11/2026, pedido dele: "temos algum jogo tipo Duck Hunt?"):** o gênero dos jogos de mira, SÓ A
MECÂNICA (nada de pato, cachorro, arte ou som da Nintendo). Corvos e gafanhotos atravessam a horta, e quem joga mira e clica (ou
toca); cinco ondas, cada uma mais cheia e mais rápida, com a munição contada em cenouras (~1,5 por praga). `server/src/minijogo-caca.ts`,
`web/src/JogoCaca.tsx`, `web/src/caca/`, nas duas abas. **A rede decidiu como no golfe:** a turma caça AS MESMAS pragas, cada um a
SUA cópia (a que eu acertei some só para mim), e ninguém disputa a mesma praga pela internet. **O voo é um arquivo só, em duas cópias
iguais byte a byte** (`server/src/caca-voo.ts` e `web/src/caca/voo.ts`; o teste do servidor confere): o servidor sorteia as pragas, o
site as desenha com a mesma conta, e cada tiro vai com o lugar e o instante da onda — o servidor refaz a conta e decide (relógio com
0,4 s de folga para a frente e 0,8 s para trás, munição, um tiro a cada 120 ms). O que sobra possível: as trajetórias vão ao site, e
um programa poderia mirar sozinho. Pontos: 100 o corvo, 150 o gafanhoto (menor), mais até 50 pela rapidez. Pódio com 2 ou mais
(`pista: 'caca'`); no Solo, o RECORDE da pessoa (`caca_recordes`). Tudo desenhado por código. Testes:
`server/test/minijogos-caca.test.ts` e `e2e/caca.mjs` (passou, pelo Solo do computador do quarto, com o piloto automático
`window.cacaPilotoAutomatico`). Conta nas conquistas da turma desde o mesmo dia (decisão dele, junto com os clássicos de mesa).

**OS CLÁSSICOS DE MESA (04/11/2026, pedido dele, depois da pesquisa de jogos sem manutenção):** Dominó, Truco, Damas e
Batalha naval, só no Coletivo. Regra pública e nenhum conteúdo para manter. **Damas e Batalha naval são de MESA**, no `duelo`
de `minijogo-tabuleiro.ts`, que ganhou a vista POR LADO (`publico(estado, lado)`: na Batalha naval cada um vê só a própria
frota, e quem assiste só os navios afundados), a ação fora da vez (`livre`: sortear a frota de novo enquanto ninguém atirou
no seu mar) e o `aoComecar` (nas Damas, quem abre fica com as claras). **As damas são as brasileiras:** comer é obrigatório
para a frente e para trás, a lei da maioria, a dama voadora, a peça comida sai só no fim do lance e a pedra só vira dama
terminando na última fileira; o servidor gera os lances e o site só escolhe (`lances`). Empate: 20 lances seguidos só de
damas sem captura (os finais específicos da CBD ficaram de fora). **Batalha naval:** 10 × 10, frota 5, 4, 3, 3, 2 sem
encostar nem na diagonal, acertou atira de novo. **Dominó e Truco vão pelo convite:** o Dominó de 2 a 4 (com 4, em duplas;
com 2 ou 3, com compra), 6-6 começa a primeira mão, batida e jogo trancado levam os pontos das mãos dos outros, até 50; o
**Truco é o paulista**, em 2 ou em 4 (duplas), com vira e manilha (zap, copas, espadas, ouros), carta coberta da segunda
rodada em diante, truco/seis/nove/doze, mão de onze e mão de ferro (sem a variante de cartas às cegas), até 12. Nos dois, a
vez tem 30 s e o servidor joga por quem demora ou saiu da sala. **Contam nas conquistas da turma** (decisão dele, mesmo dia:
"elas devem contar"; o Repertório completo passou a 21 jogos, com a Caça). Troféus da estante, ainda não. Testes: `server/test/minijogos-{damas,naval,domino,truco}.test.ts` e
`e2e/classicos.mjs` (passou: duas pessoas na sala de voz jogando os quatro pela tela, numa tela estreita).

**A ESTANTE DE TROFÉUS VIROU O HUB (03/11/2026, pedido dele: "um hub para todos os troféus em mini-games, todas as
conquistas; o jogador pode escolher o que deixa em destaque"):** a estante do quarto (`web/src/Trofeus.tsx`) junta os pódios de
todos os jogos, agrupados pelo jogo, e as conquistas da turma de cada comunidade da pessoa (o degrau mais alto); a estrela põe
até 6 em DESTAQUE (`trofeus_destaque`), e é o destaque que quem visita o quarto vê, **com tudo, inclusive contra quem**
(decisão dele: "se ele permitiu a visita, presumo que não seja um problema contra quem ele ganhou"). Foi isso que fechou a
visita a qualquer conta (ver o quarto, acima). O rival que tem bloqueio com quem visita não aparece para essa pessoa, e
**o rival MENOR DE IDADE só aparece para quem é amigo dele** (achado da revisão; mantido por decisão dele, 03/11/2026: o nome de
um adolescente não vai a desconhecidos pelo quarto de outra pessoa). O convite para o quarto privado é só para amigos, acaba
com a amizade, e CHEGA a quem foi convidado: na hora, um cartão no canto como o do convite para a voz (`ConviteParaQuarto.tsx`,
'quarto:convite'), e para quem estava fora, na tela de Amigos ("Convite para o quarto" e "Visitar o quarto" ao lado do nome,
`/api/quartos-abertos`). **Os seis
jogos do fliperama (Festa, golfe, tabuleiro, blocos, pulo e briga) contam no Repertório e na "A turma do jogo"** desde o mesmo
dia; a corrida continua de fora (o troféu coletivo dela é a Copa da turma), e os quizzes também.

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
  igual, inclusive onde a cadeira parou. ~~Quem visita: qualquer conta~~ — **MUDOU em 03/11/2026 (decisão dele, como o
  perfil da Steam): quem mora decide.** Público, amigos (o de fábrica) ou privado, em que nem os amigos entram, só os
  convidados (Minha conta → "Quem visita o seu quarto"; `server/src/trofeus-routes.ts`). Antes dos 18, o público não
  existe e o convite é só para amigos. O bloqueio fecha a porta em qualquer modo, com a resposta de quem não existe.
  Visita é por id, nunca por nome. **No app desde 03/11/2026:** "Visitar o quarto" no cartão de perfil, que só aparece
  quando a porta está aberta (`VisitaAoQuarto.tsx`; a página do quarto em modo de só olhar, `visitaNoApp` em montar.mjs);
  teste `e2e/quarto-visita.mjs`.
- **As camas para desbloquear já têm 4 candidatas** (`avulsos/cama-casal-1..4.png`, madeiras e cabeceiras diferentes);
  a 2 é a de fábrica. **Decisão dele (20/10/2026): as quatro vêm LIBERADAS de uma vez**, sem conquista; pacote temático
  (o de Halloween, da caixa de correio) é para o futuro. Falta a arte: só a 2 tem os giros (`cama-casal-giros`), e cama
  que não gira quebraria o "todo móvel gira"; as outras três pedem os giros dela (~25 gerações cada) em novembro.
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
  (`?app`); LANÇADO PARA TODO MUNDO em 16/10/2026** ("o quarto novo substitui para todo mundo, assim como o salão
  isométrico"). No build, `montar.mjs --publicar` (chamado por web/vite.config.ts) tira as imagens e o script para
  /app/assets/ com a impressão digital. **O iframe depende de três cabeçalhos da Cloudflare** (frame-src 'self',
  frame-ancestors 'self', X-Frame-Options SAMEORIGIN); fechado qualquer um, ou sem o "pronto" da cena em 20 s, a home mostra
  o quarto antigo (`web/src/cenaNova.ts`). Teste do build de produção: `e2e/cenas-no-ar.mjs`. **A barra de ARRUMAR do app existe (15/10/2026):** Editar → Girar, Janela, as cores do tapete (sálvia,
  terracota, azul, mostarda, rosa, cinza) e os objetos da parede, estes dois como FIGURAS e não nomes, para não pedir
  um texto novo por objeto nos 80 idiomas (só "Girar", "Tapete" e "Objetos da parede" entraram).
  O coelho do quarto no app já segue o estado de verdade (em call, ausente).
  **Desde 16/10/2026 (pedidos dele):** a barra é EM ABAS (Móveis, Objetos da parede, Em cima dos móveis, Tapete, Janela;
  os tipos de janela como figuras, porque o antigo "Janela" trocava o tipo às cegas e só a original tem cortina e abre);
  **a animação vem antes da função** (o coelho vai ao móvel, senta ao computador ou para diante do abajur, e só então a
  função abre, como as portas do guarda-roupa); passar o mouse no que tem função dá o **contorno claro**; e no Editar
  nenhum clique abre função. **Da referência de interface dele (mesmo dia), entrou só o que serve a leigos:** no Editar, o
  que se toca fica ESCOLHIDO (contorno) com uma **barrinha em cima dele** (girar, tirar, "…" com as opções dele: cor do
  tapete, arte do pôster, tipo de janela; na janela, cortina e abrir) e o **Desfazer** (Ctrl+Z e botão). Ficaram de fora,
  de propósito: painel de propriedades com números, escala, colisão desligável e setas 3D.
  **O EDITOR NO LAYOUT DELE (mesmo dia, ele escolheu cada ponto):** o Editar ocupa a tela (topo com Salvar,
  Desfazer/Refazer, dia e noite e configurações; categorias, busca e catálogo à esquerda; atalhos G, R, Del, Ctrl+D, E e
  Cancelar/Aplicar embaixo). **As mudanças do Editar ficam PENDENTES até Aplicar** — exceção escolhida por ele ao "cada
  mudança já vale"; fora do Editar, continua valendo na hora. **Tudo pode duplicar** (móvel, objeto da parede, objeto de
  cima: "cama~2"; o original de função continua o único com função de coelho, e a cópia se tira, não se guarda); o
  servidor aceita cópias e avisa (`copias`), e a página só oferece Duplicar então. **Cada peça tem nome traduzido nos 80**
  (`web/src/nomesDaCena.ts`), para a busca e as dicas.
- **Ainda depois:** animação na vista, variações de tapete (cor por código), mais móveis que giram.
- **TODA PEÇA NASCE AVULSA (decisão dele, 17/10/2026).** Gerada sozinha, sem fundo (`no_background`), com o quarto ou o
  salão como referência de estilo; nunca mais pintada dentro da cena e recortada. O recorte foi a saída de 07/10, para
  herdar a luz pintada; desde que a luz é feita por código, ele só traz custo: restos do chão e da parede, contorno sujo
  e um script de limpeza por peça (relato dele: pufe, tapete, fone, prateleira, troféus, prateleira do bar). **O
  compromisso: refazer avulsas as que ainda são recorte**, e apagar os recortes e os scripts de limpeza
  (`limpar-recorte.py`, o "contorno" de `parede/pecas.py`) quando a última sair. Faltam, em 17/10: os objetos da parede
  fone, quadro, cortiça, prateleira e pintura; o pufe e o tapete (`pecas/`); as janelas original (com aberta e cortina),
  arco, redonda, floreira e cortinas. Onde já existe a avulsa (os objetos do salão em `parede-salao/`), ela vale nos dois
  ambientes. **Plano para quando houver créditos (ele quer em novembro/2026), nesta ordem:** (1) os 5 da parede e (2) o pufe
  e o tapete, ~60 gerações, que resolvem os relatos de 17/10; (3) as 4 janelas simples; (4) a original por último,
  comparando lado a lado (a peça e os estados aberta e cortina, ~55). Total ~150 (100 a 200); (5) os OBJETOS DE CIMA
  (caneca, suco, pizza, livros…) gerados no TAMANHO FINAL, de 16 a 24 px, com silhueta forte e pouco detalhe: vieram 2,5×
  maiores e reduzir pixel art quebra o contorno (17/10/2026: estão no tamanho inteiro, grandes demais, por decisão dele,
  até isso), ~150 a 200 gerações; depois, os pedidos novos abaixo. Registrar no `custos.jsonl` também o custo das gerações avulsas (hoje só giros e estados ficam lá).
- **DÍVIDA DE ARTE (pedidos dele, à espera de créditos do PixelLab):**
  - **Um ventilador ou um ar-condicionado** (16/10/2026).
  - **A porta de entrada do salão** (aprovada em 20/10/2026): o membro novo chega por ela, e o coelho do balcão acena.
  - **Os giros das camas 1, 3 e 4** (20/10/2026), para elas entrarem liberadas no quarto (~75 gerações).
  - **Um gatinho olhando a janela** (16/10/2026): deitado, dormindo; clicado, ele se espreguiça e senta. Precisa das
    poses (deitado dormindo, espreguiçando, sentado) e da passagem entre elas, como o coelho; é peça viva, não móvel.
  - **O coelho sentado no sofá do salão, por lugar** (16/10/2026, relato dele: "os coelhos continuam flutuando"): com o
    sofá de frente, eles ficam por cima do encosto; de costas, o encosto já os cobre (`atras`), mas não basta. Pede uma
    pose sentada para cada posição do sofá e a CAMADA DA FRENTE do assento à parte, como a poltrona do quarto.
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

**O que o salão isométrico já faz (15/10/2026, `e2e/pixel-art/salao/`, no app pelo `SalaoNovo.tsx`, LANÇADO com o
quarto em 16/10/2026, com a mesma volta ao salão de frente se a página não puder abrir):** as funções do Salao.tsx nos objetos (TV → voz e Ao vivo, fliperama →
mini-games, estante → canais, janela → chamar alguém, balcão → o recado num balão sobre o coelho, quadro → montar a tela);
a TV e o fliperama têm TELA POR CÓDIGO (a TV à toa passa um desenho calmo e, com transmissão, o selo Ao vivo e quem
transmite em cima, com as setas de canal; a imagem de verdade continua fora da TV); **a TV tem CANAIS (18/10/2026, pedido dele): o desenho, futebol,
um tiro tático e uma arena de rotas, todos por código e genéricos (sem nome, logo ou mapa de jogo de verdade, e SEM o selo
vermelho, que é só da transmissão de verdade); o botão direito passa de canal em canal e, depois do último, desliga.
Havendo transmissão, ela é o primeiro canal, e uma transmissão que começa leva a TV a ela.** **O Ao vivo mostra o GÊNERO do jogo transmitido (18/10/2026, decisão dele: "o gênero, não o jogo"):** 20 desenhos nossos (moba, tiro, futebol, corrida, luta, aventura, construção, fazenda, estratégia, cartas, terror, plataforma, festa, espaço, quebra-cabeça, esportes, voo, RPG por turnos, história e ritmo; os sete últimos tirados da lista de gêneros da Steam que ele mandou, juntando os que dão o mesmo desenho numa tela pequena), nunca imagem do jogo. Só no app e só transmitindo UMA JANELA: o app passa à página o executável dono da janela (o mesmo dado do som do jogo), a página o converte pela tabela `web/src/generoDoJogo.ts` e só o gênero vai aos outros (o servidor aceita só os da lista). Pelo executável e nunca pelo título, que engana. Jogo novo é uma linha na tabela, sem versão nova do app; fora da tabela, o Ao vivo comum. Teste: `salao/canais-da-tv.mjs`. o quadro mostra a CAPA da comunidade
(ou o ícone, inteiro) no plano da parede; quem transmite fica na frente da TV, quem está numa partida no fliperama (pose
própria), e as banquetas têm a pose sentada alta. **A arrumação é da COMUNIDADE** (`saloes`, `salao-routes.ts`): todo
membro vê igual e USA as funções, só quem administra arruma (o servidor confere), e a turma relê na hora (`salao:mudou`). **A turma ajuda a arrumar (18/10/2026, decisão dele):** quem administra marca no cargo "Pode arrumar o salão", e quem tem o cargo arruma — é a ÚNICA exceção, de propósito, ao "cargo é identidade, não poder" (db.ts). Contra a bagunça, o salão guarda quem mexeu por último e o salão de ANTES dessa pessoa começar, e quem administra desfaz ("Última mudança no salão: fulano · Desfazer"). O canal da TV e o que está desligado (TV, fliperama, jukebox) vão com a arrumação: valem para a turma, e só quem arruma muda.
Testes: `salao/no-app.mjs` (no app de desenvolvimento) e `e2e/cenas-no-ar.mjs` (no build de produção).

**O SALÃO É 16 × 16, COM CÂMERA (decisão dele, 15/10/2026: "imaginei 4× o tamanho"; "câmera que anda").** A casca sai por
código da 8 × 8 (`salao/casca16.py`: a mesma casa de 27 × 14,25 px, os cantos como estão e o meio repetindo 4 casas), e
**as duas paredes são de tijolo** (a da direita era creme com lambri; "o estilo das duas paredes é bem diferente"). A
imagem tem 1024 px; a vista mostra um pedaço, abre no canto da TV, e arrastar onde não há nada para pegar leva a câmera.
O pixel acompanha a largura da vista, para o coelho ficar do tamanho de sempre. O servidor aceita até 16 casas no salão
(o quarto segue em 8).

**Gráficos e o jogo (15/10/2026):** o quarto e o salão são desenhados pelo PROCESSADOR (a luz e as sombras pixel a pixel;
a placa só mostra a imagem pronta). Por isso: (1) **param de desenhar quando a janela do Syden perde o foco ou fica
escondida** — o app desliga o freio de janela escondida por causa da chamada, e sem isso o quarto seguiria desenhando
atrás do jogo, que é o uso principal; (2) **opção de Gráficos** nas Configurações (seção própria desde 17/10/2026; antes ficava dentro da Aparência), no ar já: partículas, sombras e telas
animadas, **TODAS DESLIGADAS DE FÁBRICA** (decisão dele: quem quiser o enfeite liga), sem "ajustar sozinho" (ele tirou).

**A LUZ NA PLACA (WebGL2, feito em 16/10/2026, decisão dele: "o usuário só renderiza o quarto e o salão no início e na
home").** O passe da luz (`passeFinal`) roda num shader com os mesmos números do da CPU (`passeFinalCPU`, que fica como
reserva: sem WebGL2, shader recusado, contexto perdido, ou `?cpu` no endereço). Os buffers sobem como texturas (só a região
que mudou, a cada quadro) e o resultado volta para a mesma imagem, então o que se pinta por cima (telas, contorno, faíscas,
balão) não mudou. `window.compararGpuDoTeste()` confere: de dia, idêntico; de noite, ~200 de 4 milhões de canais diferem
em 1 (arredondamento). **Medido no salão, de noite:** montar a cena de ~183 para ~77 ms, o quadro do arraste de 19 para 9 ms;
criar o contexto, ~40 ms, uma vez, ao abrir. A montagem dos móveis (`montarCena`, ~60 ms) continua na CPU. O contexto vive no
iframe da página: sair do início ou da home desmonta o iframe e o libera; com a janela sem foco, nada é desenhado.

**As luzinhas do alto das paredes vão NA FRENTE do que se pendura (16/10/2026):** estão pintadas na casca, e a janela e
os objetos da parede as cobriam (a lâmpada no canto da janela saía cortada). `salao/luzes16.py` tira a máscara delas (as
duas cores da lâmpada e o preto do fio), e o motor recopia esses pixels da casca por cima. Casca nova pede rodar de novo.
**O salão SEM O LAMBRI (pedido dele, 16/10/2026):** a janela e a porta ficavam metade na madeira. `casca16.py` troca a faixa
de madeira pelo tijolo 46 px acima (4 fiadas) e refaz o rodapé reto; a base 8 × 8 (`base.png`) continua com o lambri, porque
é a referência das gerações. Peça gerada com a inclinação da parede errada (o neon) leva `"espelhar": true` no item.json.
**GUARDAR E PÔR MÓVEIS, nos dois ambientes (pedido dele, 16/10/2026):** a barra de Editar ganha o grupo "Móveis" (figuras,
"Móveis" nos 79 idiomas); guardado, o móvel sai da arrumação (`guardados` no servidor, que precisa ser publicado para o app
lembrar) e os objetos em cima dele saem junto; de volta, ele vai para a casa livre mais perto da de fábrica. **Móvel com
função não se guarda** (o guarda-roupa, a mesa, o abajur, a TV, o fliperama, a estante, o balcão, a jukebox, o microfone) nem
a cama do quarto, onde o coelho dorme quando a pessoa está ausente.
**Objeto da parede com OPÇÕES (o pôster: palco, neon, fogo; pedido dele, 16/10/2026):** `parede-salao/<item>/opcoes/<nome>/`,
saídas de `parede/avulsos.py <item>=<n>`; a escolha vai no campo `cores` da arrumação, o mesmo do tapete, sem mexer no
servidor, e a barra de arrumar mostra as figuras enquanto o objeto está na parede.

**O CARTÃO DA PEÇA (pedido dele, 17/10/2026), nos dois ambientes:** clicar numa peça SEM função abre a figura grande, o
nome e uma frase curta, sempre pertinente ao objeto (`descricaoDaPeca`, em `web/src/nomesDaCena.ts`, nos 80 idiomas;
`CartaoDaPeca.tsx`). A peça com função continua abrindo a função, e o cartão dela fica no "i" da barrinha do Editar. Peça
nova pede a frase dela. Quando houver peça ganha por conquista, o cartão diz também de onde ela veio. **Desde 18/10/2026 ele
gira e amplia, como no Resident Evil** (as vistas da peça, pedidas à página quando o cartão abre; até 4×, pixels nítidos).

**OS ESPAÇOS QUE FALTAM NO SALÃO (conversa com ele, 18/10/2026), cada um com uma função de verdade, pela regra de que a
tela não mente. Pendentes: todos pedem arte nova (PixelLab em novembro, ou o caminho 3D dos coelhos).**
- **A janela é AMBIENTAÇÃO, não convite** (decisão dele, feito no mesmo dia: clicar nela não faz nada, e o "Chamar alguém"
  ficou só nos atalhos em texto). O rumo é a vitrine da referência dele (`imagem/` da conversa: um café com uma janela
  grande para as montanhas, luminárias pendentes): a vista de fora, com a hora do dia, como a do quarto.
- **Cantinho do café** (ele sentiu falta): máquina de café, mesinha redonda, banquetas. Quem está na call e marcou
  "ausente" vai tomar café, em vez de ficar na frente da TV.
- **Calendário**: os eventos principais da comunidade E os aniversários dos membros. **A FUNÇÃO ESTÁ FEITA (18/10/2026)**
  (`calendario-routes.ts`, `Calendario.tsx`; teste `e2e/calendario.mjs`): quem administra marca nome, dia e hora; todo
  membro vê, e o calendário aberto relê na hora; os aniversários só nas comunidades com os PARABÉNS LIGADOS (lá a data já
  seria anunciada no dia: mostrar antes não expõe nada além do que a pessoa aceitou). Abre por um atalho embaixo do
  salão; o calendário de PAREDE espera a arte.
- **Um bicho do salão** (ele sentiu falta, "valioso na ambientação"): cachorro ou gato, com o comportamento ligado ao real
  (dorme com o salão vazio, acorda e vai até quem chega na call, deita perto de quem assiste). Bom candidato ao caminho
  3D dos coelhos (um modelo, as animações por script).
- **Forno a lenha na copa**: pizza sem forno não faz sentido (dele). A comida aparece com motivo — no aniversário de alguém,
  sai pizza do forno ou aparece bolo na ilha. A copa é hoje o único canto sem função.
- **AS CONQUISTAS DA TURMA (feitas em 20/10/2026; ele aprovou as 19 da pesquisa e pediu a maestria por jogo).** O
  troféu do salão (e um atalho embaixo dele) abre o painel (`Conquistas.tsx`); as contas em `server/src/conquistas.ts`,
  a pesquisa e a lista em `docs/conquistas-coletivas.md`. São 28 (19 + "A turma do jogo", uma por mini-game). Regras: conta
  GENTE JUNTA (call só na mesma sala, com 2 ou mais; partida só com 2 ou mais); o degrau alcançado é gravado e NUNCA se
  perde (`conquistas_alcancadas`); nada de prazo, sequência, "faltam" ou barra de progresso; os BONS EXEMPLOS (pedido
  dele: "dar ênfase aos bons exemplos", não competição) são até 3 nomes de quem mais contribuiu em 30 dias, sem posição.
  Medição nova: `cinema_segundos` (transmitir com 2+ assistindo) e a sala em `usage_sessions.channel_id` (as sessões
  antigas contam a comunidade como uma sala só). **Os enfeites que cada degrau abre no salão esperam a arte** (PixelLab,
  novembro): hoje o degrau aparece só no painel.
  **A porta de entrada foi aprovada** (20/10/2026) e está na dívida de arte do PixelLab (novembro).

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
- **Os números das conquistas JÁ EXISTEM (19/10/2026):** horas de call e de tela por comunidade (`usage_sessions.community_id`,
  desde 27/09), partidas (`minijogo_partidas`) e, desde 19/10, as vezes que se cantou (`karaoke_cantadas`, com o ranking do
  karaokê: conta só com a turma na sala, numa sala da comunidade). Quem exclui a conta deixa a soma (`tempo_de_quem_saiu`,
  `karaoke_de_quem_saiu`, sem data nem pessoa), para um marco alcançado não desacontecer.

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
- **O CAMINHO DAS ANIMAÇÕES: PixelLab para a base, Meshy para o 3D, Blender para animar (decisão dele, 18/10/2026; a
  testar em novembro, quando os créditos do PixelLab renovarem).** Por quê: animação feita uma vez serve a todos os
  coelhos (mesmo esqueleto), o objeto na mão (vassoura, bandeja) sai igual em todo quadro, as 8 direções saem de graça e
  animação nova não gasta crédito.
  1. **PixelLab: TODOS os 17 coelhos em pose A** — o mascote base (o branco de moletom, `personagem/mascote/`) e os 16
     prontos de avatar (`web/public/avatares/`; o 16 só tem o busto). De frente, corpo inteiro, braços abertos uns 45°,
     pernas um pouco afastadas, orelhas em pé e separadas (as caídas, como a do 03, como são), fundo liso, sem sombra,
     cada um com a roupa, os acessórios e o rosto dele.
  2. **Meshy: UM MODELO POR COELHO**, nunca uma base com variações: os corpos não são iguais (medido: de 48 a 57 px de
     altura; o 03 tem orelha caída, o 05 não tem roupa, o 06 usa jardineira, o 14 é mais baixo e largo, e bonés, gorros e
     fones mudam a cabeça), e a textura de um não serve ao outro. GLB, textura 2k, SEM o esqueleto deles. Os 17 cabem num
     mês do plano (20 downloads, licença privada para uso comercial); depois de baixados, os modelos são nossos e a
     assinatura pode acabar — a dependência do Meshy é de um mês.
  3. **Blender, por script e no repositório:** o NOSSO esqueleto, o mesmo em todos (com ossos para as orelhas), as
     animações feitas uma vez, e o render como pixel art com as cores presas à paleta de cada coelho. Por coelho, só
     conferir o que atravessa o corpo em cada animação (o braço na barriga do 14, o boné na orelha) e ajustar.
  - **Primeiro o piloto com o mascote** (esqueleto, parado, andando, varrendo, no salão de verdade); só aprovado, os 16.
  - **O MASCOTE 3D ESTÁ NO APP desde 30/10/2026** (pedido dele: "algo minimamente viável funcionando"). A malha de
    braços abertos (`e2e/3D/Personagens/mascote-t.glb`, do Meshy, SEM o esqueleto deles, que o script descarta) com
    TODAS as poses do motor em `personagem/mascote-3d/` (as mesmas pastas do PixelLab; `blender/meshy/poses.py`).
    `MASCOTE=pixellab` no `montar.mjs` volta ao desenho. Os outros 16 coelhos seguem o formato DESTE (decisão dele). Na malha
    em T, com os braços soltos do moletom, as DUAS mãos seguram a vassoura (o cabo na frente do peito, o tronco inclinado e o
    braço esticado até 20%; pedido dele: "com um braço só é inviável"). **Sentado é o desenho do PixelLab** (decisão dele,
    30/10/2026): as pernas da malha ficam dentro do moletom e, sentado, ele parecia em pé em qualquer pose; os nomes "pl:" no
    FONTES do montar.mjs. Falta a malha do mascote SENTADO no Meshy para isso voltar ao 3D. Os deitados usam a
    câmera do chão (32°, diagonais a 45°); na do coelho em pé (20°, 32°) o corpo deitado some.
    **Ele VARRE (30/10/2026):** no quarto, à toa, numa parada a cada três; no salão, o coelho do recado sai do balcão de
    vez em quando (nunca com o recado aberto), varre uns 5 s perto dele e volta, e clicar no balcão o chama de volta (o
    balão só aparece com ele lá).
    **No salão (30/10/2026):** os assentos do sofá acertados por posição (AVANCO_NO_SOFA: o pé dele na grade não coincide
    com o desenho), quem senta de costas ou no chão atrás de um sofá perde os pixels sobre o desenho dele (o encosto sempre
    na frente, sem depender da ordem de desenho), quem transmite e quem não cabe no sofá sentam no chão perto da TV, e
    todos respiram (um tempo a cada 0,5 s, remontando a cena).
  - **Medido em 18/10/2026** (`e2e/pixel-art/personagem/blender/`): o coelho montado por código segura a vassoura
    idêntica em 32 quadros, mas fica abaixo do desenho; o sprite projetado nele falhou pela silhueta. O Meshy ganhou do
    Tripo (simulação no salão, cores presas à paleta): forma do mascote, malha lisa que dobra bem; o Tripo vem em blocos,
    com os degraus dos pixels e o contorno pintados na textura, e o esqueleto automático dele pôs os braços nas orelhas.
    O Meshy fez um bom modelo até do desenho de braços para baixo; a pose A é para o esqueleto encaixar melhor.
  - Ao pôr no motor: a âncora vem do `pe` explícito do json da animação (a vassoura desce abaixo do pé, e a regra do
    primeiro quadro cairia na palha).
  - **O RITMO PADRÃO É "EM DOIS": 12 desenhos por segundo (decisão dele, 18/10/2026).** Renderiza-se a 24 e cada desenho
    segura dois tempos, como na animação feita à mão e em muita pixel art: o olho lê a pose e o movimento ganha peso, e
    quadro demais destoa da estética pixel. Comparado no mesmo ciclo com "em um" (24/s, liso demais), "em três" (8/s,
    travado) e o variável (em um no golpe, em dois na volta). **A CADA ANIMAÇÃO NOVA o comparativo se refaz**
    (`personagem/blender/fluidez/tempos.py` → `ritmos.gif`), e ela fica em 12 ou muda, caso a caso. O movimento é
    "orgânico" (golpe com pressa e volta lenta, o corpo e a cabeça atrasados): o seno puro fica mecânico. O jogo segue a
    60 por segundo; só o coelho anda no ritmo dele.
  - **O SMEAR TAMBÉM É PADRÃO (decisão dele, 18/10/2026):** nos desenhos do golpe mais rápido, o que se move depressa
    (a palha da vassoura) ganha o RASTRO: a faixa contínua por onde passou nos quadros que o ritmo em dois pula, tirada do
    passe de partes do Blender, em tom da própria peça e POR TRÁS do coelho (`personagem/blender/fluidez/smear.py`).
    Só a parte que corre (a palha, não o cabo), e preenchida linha a linha: os pixels soltos das posições puladas viram
    "objetos-fantasma", não borrão. Animação nova: escolher qual peça leva o rastro e conferir no `smear.gif`.

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

**Medido em 19/10/2026 (pedido dele: "vamos começar medindo"; tudo em `e2e/tradutor-local/README.md`):** o tradutor do
navegador NÃO existe no Electron 44 e, no Edge, diz indisponível; só o Chrome o tem. O LibreTranslate no servidor (2–4 GB
de RAM sempre) ele achou inviável. O tradutor NO COMPUTADOR de quem clica, o **Bergamot do Firefox** (MPL-2.0, motor e
modelos), cabe: 5 MB de motor + 36–70 MB por idioma baixados na hora, 30–70 ms por mensagem, 250–500 MB de memória só
enquanto traduz (num processo à parte, desligado sem uso: o heap do wasm não devolve memória). Cobre 48 dos 82 idiomas do
Syden. A qualidade decide: inglês e espanhol bons, árabe razoável, japonês fraco (erra o sentido em ~6 de 20), e o
**português sai de Portugal** em metade das frases. Pendente da palavra dele: seguir assim, ou medir antes o Opus-MT com
português do Brasil (CC BY 4.0, maior) para a segunda perna (inglês → português). Em qualquer motor, o original fica
visível e a tradução diz que é automática (o Chrome traduziu "a base" do árabe como "Al-Qaeda").

**Decidido no mesmo dia, depois da medição:** *"as soluções leves do navegador são problemáticas"*. O tradutor é **só do
APP**, o melhor possível pela QUALIDADE, e só consome o computador quando a pessoa traduz (para não prejudicar quem joga):
nada carregado até o clique, num processo à parte com prioridade baixa e metade dos núcleos, a placa de vídeo só sem jogo
em primeiro plano, descarregado depois de uns minutos sem uso, e o download só quando a pessoa ativa, com o tamanho dito.
**Os candidatos a medir, EM OUTRO MOMENTO (decisão dele, 19/10/2026: "vamos testar os modelos em outro momento"):**
TranslateGemma 4B (Google, licença Gemma, 55 idiomas, aceita `pt-BR` no prompt), MiLMMT-46 4B (Xiaomi, Gemma, 46 idiomas,
sem África), Qwen3 4B (Apache 2.0) e MADLAD-400 3B (Apache 2.0, 400+ idiomas, para a África e o Pacífico), uns 2–2,5 GB
cada em Q4, pelo llama.cpp (node-llama-cpp, MIT), com o Bergamot de referência. Fora pela licença: NLLB-200 (não
comercial), Hunyuan-MT (exclui territórios), Seed-X. Medir com as 20 mensagens de `e2e/tradutor-local/`, com o
processador limitado como ficaria no jogo, e mensagens em hauçá e suaíli para o MADLAD.

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
   de quem ensina o outro). **Feito em 19/10/2026 (pedido dele):** "Idiomas falados" e "Idiomas em estudo" em
   Minha conta, até 6 em cada, no cartão de perfil pelo nome na própria língua (`IdiomasDoPerfil.tsx`,
   `server/src/idiomas-routes.ts`; já na política). O sinal a medir antes de construir mais: quantas pessoas preenchem.
5. **O bloqueio real não é técnico, é moderação.** Intercâmbio de idioma é desconhecido encontrando
   desconhecido, que é o problema mais difícil que existe — e o Syden tem uma pessoa moderando.

## Adolescentes no Syden: proteger de verdade, não fugir para os 18 (ECA Digital)

**Decidido em 17/10/2026, pelo Sydenstricker, depois do caso Discord** (a ANPD suspendeu o vídeo e o compartilhamento de
tela dele no Brasil em 12/08/2026, por medida preventiva do ECA Digital, a Lei 15.211/2025, depois da morte de uma menina
de 13 anos induzida numa transmissão). Nas palavras dele: *"a idade de 18 é o caminho dos covardes"*, e *"prefiro ter mais
trabalho de implementação e ficarmos com um produto mais seguro"*. O Syden tem a MESMA arquitetura que derrubou o Discord
(transmissão em sala fechada, que ninguém vê em tempo real), então o caso é o nosso espelho.

- **Idade mínima: 13.** De 13 a 15, a conta fica LIGADA à de um responsável (art. 24); 16 e 17 com as proteções de menor.
- **Fechado por padrão para menor** (arts. 7 e 17; o responsável pode abrir): conversa privada só com amigos aceitos;
  transmitir tela/câmera só para amigos; assistir transmissão só de amigos; o tempo de uso visível ao responsável, com
  limite diário opcional (art. 18 também pede: ver os adultos com quem o menor fala, e mexer nas configurações dele).
- **Verificação de idade: em aberto.** Fatos levantados: o login do Google/Steam NÃO entrega idade ao Syden; CPF prova que
  um número existe, não que é de quem digitou (o menor usa o do pai), e guardar CPF de todos pesa na LGPD (art. 13 do ECA
  Digital: dado de verificação só serve para verificar); foto se burla. O que vem: o **Windows já dá a faixa etária da
  conta Microsoft** aos apps (`GetUserAgeRangeAsync`, com "verificado", pedindo cadastro na plataforma de segurança digital
  da Microsoft); o governo monta um **token de idade pelo gov.br** (só a faixa, sem CPF; PL 2410/26 em tramitação). Por
  isso a verificação é em CAMADAS e trocável: data de nascimento no cadastro (guarda só a faixa) + o sinal do Windows no app
  + suspeita de idade falsa suspende com recurso rápido (art. 24) + o gov.br quando existir.
- **Para todo mundo, antes da idade (fase 1):** denunciar mensagem (os termos já prometiam, e a tela não tinha) e
  TRANSMISSÃO (com a imagem do momento); quem modera corta a tela de alguém sem tirá-lo da chamada; banimento geral;
  aviso com motivo e recurso a quem teve conteúdo retirado (art. 30); o botão "Levar seus dados" que a política promete;
  procedimento escrito de comunicar às autoridades (art. 27/28) e a guarda da prova pelo prazo do Marco Civil.
- **Validar com advogado de proteção de dados** antes de publicar a política nova: o enquadramento (porte, art. 39;
  "acesso provável", art. 1º) pede alguém que responda por ele.
- **FEITO em 17/10/2026 (fases 1 e 2, pedido dele: "pode fazer a fase 1 e 2")**: `server/src/protecao.ts` (as regras e a
  BARREIRA: a conta banida, suspensa, sem a data, sem o responsável depois de 7 dias ou com o tempo do dia esgotado entra,
  mas só alcança o que resolve a pendência e os direitos de levar os dados e excluir a conta), `protecao-routes.ts`,
  `web/src/TelaDaBarreira.tsx`, `Familia.tsx`, `PainelBarrados.tsx`; termos (seção 2, com o COMPROMISSO do token do gov.br)
  e política nas duas línguas; `docs/autoridades.md` (o caso grave, passo a passo); `e2e/protecao.mjs` (pede banco novo: a
  primeira conta é a que bane). Escolhas que ficaram: a conta de AULA não pede idade (só alcança a aula); a transmissão
  recusada diz "não está disponível para você" SEM dizer o porquê (marcar quem é menor para estranhos seria dar o mapa a
  quem procura criança); a conta banida continua existindo (o mesmo e-mail e a mesma conta social não abrem outra).
- **Onde estão as duas peças de fora (17/10/2026):** o token do gov.br é o **PL 2410/2026** (dep. Duda Salabert), que altera o
  ECA Digital: verificação prioritariamente pelo gov.br, a plataforma recebe só a faixa etária, sem CPF; tramita em caráter
  conclusivo nas comissões de Comunicação, de Infância/Família e de CCJ, e depois vai ao Senado. A ANPD (agora agência) deve
  regulamentar a verificação etária. O Windows: `GetUserAgeRangeAsync` (faixas <10, 10–12, 13–15, 16–17, 18+) e
  `GetAgeVerificationStatusAsync` saíram para os Insiders em 09/2026, ainda sem data de lançamento geral e com documentação
  rala. **A página oficial (Microsoft Learn, "Age signals overview", 24/09/2026) pede só duas coisas:** a permissão
  `userAccountInformation` no pacote e o "sim" de cada pessoa em Privacidade → Informações da conta, com uma conta Microsoft
  na sessão do Windows. O "registrar o app na plataforma de segurança digital" vem só de reportagens, sem formulário nem
  passo publicado (conferido em 20/10/2026): **não há cadastro a fazer até a Microsoft publicar um.** A permissão está
  declarada desde 20/10/2026 (`appx.capabilities` em desktop/package.json, a partir do pacote 0.1.8), a pedido dele.
  **A LEITURA ESTÁ PRONTA desde 20/10/2026 (pedido dele):** `desktop/native/src/idade.cpp` chama `GetUserAgeRangeAsync` e
  `GetAgeVerificationStatusAsync`, que ainda não estão em SDK nenhum: as declarações são GERADAS da descrição do próprio
  Windows dos Insiders (`desktop/scripts/gerar-winrt.js`, rodado pelo `build:native`; 85 MB em `native/gerado/`, fora do
  git). Máquina sem as funções compila com a leitura desligada ("sem-api"). Medido nesta máquina (Windows 26300): **18+,
  verificada**, funcionando até fora do pacote. O site (`idadeDoWindows.ts`) manda ao servidor SÓ a faixa verificada
  (`POST /api/me/idade-do-windows`, `users.faixa_windows`). **ELA SÓ DEIXA A CONTA MAIS PROTEGIDA, NUNCA MENOS**
  (`faixaDaConta`, em protecao.ts; corrigido em 21/10/2026, achado da revisão): o servidor não tem como provar que a faixa
  veio do Windows, e um menor mandava "adulto, verificada" pelo console e saía das proteções. Afrouxar só com uma prova
  que o servidor confira sozinho (token assinado, como o do gov.br). Abaixo de 13 verificado suspende como a data.
  Quando devolver valores de verdade: chamar pelo módulo nativo
  (`desktop/native`), gravar `idade_fonte = 'windows'`, e o "verificado" sobrepõe a data declarada.
- **Falta, e é dele ou de fora:** a Microsoft ligar a idade do Windows para todos (o app já lê; publicar o registro, se houver um);
  o token do gov.br quando o governo oferecer (o compromisso está nos
  termos); o advogado; e o deploy (servidor e site juntos: com o servidor novo, TODA conta antiga é perguntada pela data
  de nascimento na próxima vez que abrir o Syden, inclusive a dele).

## Criptografia: guardado com cifra e chamadas de ponta a ponta, mas mensagens não

**Decidido em 20/10/2026, pelo Sydenstricker** (a conversa começou em 18/10). A ideia dele era "ponta a ponta nas
mensagens, com exceção nos casos legais", e isso não existe: se o servidor abre em algum caso, ele tem as chaves, e
anunciar como ponta a ponta seria enganoso. Ficaram três degraus, e ele escolheu dois:

1. **O que fica guardado, cifrado (o COFRE, `docs/cofre.md`).** O banco e os arquivos num disco LUKS2, e **a senha
   NÃO fica no servidor** (escolha dele): os backups da Hetzner copiam o disco inteiro, e chave ao lado dos dados não
   protege nada. O preço aceito: depois de cada reinício, o Syden só volta quando ele roda `deploy/cofre-abrir.sh`. A
   API com `COFRE=sim` não sobe sem a marca `.cofre` (senão criaria um banco vazio ao lado do verdadeiro). O Syden
   continua lendo tudo (mostrar, buscar, moderar, responder à justiça): a política diz "guardado com criptografia",
   nunca "nem nós lemos", e só DEPOIS de o cofre estar aberto no servidor.
   **NO AR desde 20/10/2026** (ele rodou o `cofre-criar.sh`; a política ganhou a linha no mesmo dia).
2. **Chamadas e transmissões de ponta a ponta DE VERDADE** (escolha dele, contra a chave entregue pelo servidor, que
   não poderia ser anunciada assim): cada aparelho combina a chave com os outros, o servidor só repassa embrulhada, a
   chave troca quando alguém sai, e um código de verificação na chamada mostra que ninguém está no meio. Convive com o
   ECA Digital porque o servidor já não olha as transmissões: a imagem da denúncia sai do aparelho de quem denuncia.
   **Feito em 20/10/2026** (`web/src/chaveDaChamada.ts`): par ECDH por aparelho e por chamada, chave de mídia própria
   embrulhada (HKDF + AES-GCM) para cada um, repassada pelo socket (`e2ee:chave`, só entre duas pessoas da mesma sala);
   a cifra dos quadros é a do LiveKit (`encryption`, que cifra também o canal de dados). O servidor LIGA pelo voice-token
   (`e2ee: true`; `CHAMADAS_E2EE=nao` desliga numa emergência), para os dois lados de uma sala concordarem; navegador sem
   cifra por quadro não entra, com o aviso. O código de segurança fica no cadeado de "Voz conectada". Testes:
   `chaveDaChamada.test.ts` (inclusive o servidor trocando as chaves no meio) e `e2e/chamada-cifrada.mjs` (o LiveKit
   vê as faixas cifradas, e o som chega). A chave troca quando alguém SAI e quando alguém ENTRA (este, desde 20/10/2026:
   quem chega não recebe a chave de antes). Medido em 12 escritas (`e2e/telas-novas-nos-idiomas.mjs`). O protocolo é nosso
   sobre peças padrão: mudou, vale pedir revisão de fora.
3. **Mensagens privadas de ponta a ponta: FORA** ("polêmico", nas palavras dele). Com menores no Syden, bate de frente
   com o dever de detectar e remover do ECA Digital, quebraria o Shield nas imagens privadas e deixaria a caixa-preta
   guardando só cifra.

**Nenhuma lei brasileira exige ponta a ponta.** A LGPD (art. 46) pede segurança adequada; o degrau 1 é o que mais
pesa nela (e num incidente, dado cifrado conta como risco menor). Estar em dia com a lei é o conjunto (proteção de
adolescentes, Marco Civil, política) e o advogado, não a criptografia.

## O recado geral tem foto, e ela só é pública enquanto for a do recado

**Feito em 04/11/2026, pedido dele.** O aviso de Uso do servidor ganhou uma foto: miniatura na faixa, grande ao clicar. Ela sobe
pelo funil das imagens (`PUT /api/aviso/imagem`: tipo, tamanho, Shield) e é servida SEM CONTA (a faixa aparece na tela de
entrada) por `GET /api/aviso/imagem/:sha`, que só entrega o sha da foto do aviso guardado — qualquer outro dá 404, para a rota
não virar um jeito de baixar arquivo de ninguém. A vassoura de órfãos e a reconferência do Shield conhecem o kv `aviso-geral`.

**O recado aparece EM DESTAQUE (decisão dele, 04/11/2026, com o desenho):** cada recado NOVO (texto ou foto) abre uma vez no meio da
tela, com o resto desfocado atrás, e fechado fica a faixa (clicar nela reabre). "Uma vez" é por aparelho (`syden.avisoVisto`, a marca
texto|sha): voltar a cada abertura seria insistir. É a exceção escolhida por ele ao "não interrompa", e só para o recado de quem cuida do Syden.

## A foto do avatar se mexe, e o GIF anima só sob o mouse

**Feito em 04/11/2026, pedidos dele.** A foto própria tem os estados dos coelhos prontos, mexendo a foto inteira (ela não tem
quadros): pula falando, cochila esmaecida com o "z" ausente, balança ocupada (`.avatar-foto` em styles.css). **O GIF animado vai
INTEIRO**, sem a tela de recorte (que o redesenharia num canvas), até 5 MB (eram 2, e pegavam vários GIFs de 2 a 3 MB: pedido dele, mesmo dia; o ícone da comunidade segue em 2), e o servidor marca `users.avatar_animado`. **Como o
Discord, para não virar pisca-pisca** (palavras dele): nas mensagens e nas listas o GIF fica PARADO, no primeiro quadro desenhado num
canvas, e anima enquanto o mouse está na LINHA dele (a mensagem, a pessoa); de 80 px para cima (Minha conta, o cartão de perfil) anima
sempre. Com "menos movimento" no sistema, nada disso se mexe. De graça para todos: "sem assinatura" é promessa. **Também por LINK**
(pedido dele, mesmo dia): o servidor baixa e guarda, como a capa (`PUT /api/me/avatar/endereco`, `baixarImagemOuDaPagina`), e entende
o link da PÁGINA, que é o que se copia: a do Tenor pela imagem de prévia que ela declara (og:image), pedida no tamanho pequeno (o
código de formato M: a original passava de 2 MB), e a do GIPHY pelo endereço do arquivo, que sai do próprio link. **Ao abrir o link a
todo mundo, duas defesas entraram** (pergunta dele: "isso não abre espaço para links maliciosos?"): o DNS é conferido NA CONEXÃO
(`lookupConferido`: antes, um nome podia responder público na conferência e interno um instante depois) e cada pessoa pede no
máximo 5 links por minuto (`muitosLinks`, também na capa). Testes:
`server/test/avatar-animado.test.ts` e `e2e/avatar-gif.mjs` (passou).

## As figurinhas são da pessoa, e mandá-las é um anexo marcado

**Feito em 04/11/2026, pedido dele ("as figurinhas criadas pelos usuários, como no WhatsApp").** A coleção é DE CADA PESSOA
(até 200), não da comunidade: quem cria manda em qualquer canal ou conversa privada, e quem recebe salva na própria coleção
pelo "Salvar figurinha" (a chave do anexo prova que recebeu). Sem tela de recorte: a imagem vai inteira, com a transparência,
reduzida a 512 px em WEBP (GIF passa como veio). `server/src/figurinhas-routes.ts`, `web/src/SeletorDeFigurinhas.tsx`, a
figurinha na conversa em `MessageItem.tsx`.

**Tirar o fundo e o contorno (pedido dele, mesmo dia: "remova o fundo e adicione um contorno mais forte, como no WhatsApp"):**
antes de guardar, a PRÉVIA, com "Tirar o fundo" e "Contorno" ligados de fábrica (`web/src/figurinhaEfeitos.ts`, só código, no
computador de quem cria). Este é o PASSO 1: o fundo que sai é o LISO (a cor dominante da borda, apagada da borda para dentro,
mais os pedacinhos soltos que sobram); fundo de foto ou desenhado avisa e fica como veio, e o que se parece com o fundo pode
sumir junto — é para isso a prévia. O contorno é a silhueta engrossada em branco (~3% do lado) com uma sombra leve. GIF não passa
pela prévia (o canvas mataria a animação). **O passo 2, MEDIDO (mesmo dia, `e2e/recorte-de-fundo/README.md`):** o BiRefNet lite
512 (MIT) ganhou do U²-Net e do IS-Net (Apache 2.0) nas 9 imagens; em meia precisão, 98 MB, ~1,5 s na placa e ~3 s no
processador, pelo onnxruntime-web 1.30 (as versões antigas davam resultado errado calado na placa). Fora: a biblioteca pronta mais
usada no navegador (AGPL) e o RMBG (não comercial).
**NO APP, SÓ NO APP (decisão dele, mesmo dia: no site o modelo pediria WebAssembly e o 'wasm-unsafe-eval' que ele não dá):**
`desktop/src/recorte/` roda o BiRefNet nativo (o onnxruntime-node que o ruído já leva), num processo à parte, com prioridade baixa,
metade dos núcleos e saída depois de 3 min sem uso (~7,7 s para abrir, que começa ao abrir as figurinhas; ~2,3 s por imagem; pico de
~2 GB com o reservatório de memória desligado — ligado, 3,8). **O modelo vai DENTRO do app** (decisão dele, mesmo dia: "pra que esse
atrito inicial?"; a primeira versão o baixava quando a pessoa pedia, pela regra do tradutor, que era para modelos de 2 GB), em
`desktop/recorte-modelo/`, fora do asar como o do ruído. Não mora no git (98 MB): `desktop/scripts/baixar-recorte.js` o põe lá antes
de gerar o pacote (predist, predist:loja e o passo do Actions), da revisão fixa da conversão medida e só se o sha256 conferir. A
imagem não sai do computador. No site, o fundo não liso diz que no app funciona. Se o modelo falhar, fica o recorte simples e a
prévia diz. O crédito (MIT) está nos termos, seção 10. Chega com a versão do app depois da 0.1.8 (o site sem ela segue com o passo
1). A conversão de 512 é de terceiro (MIT); converter a nossa pede Python, que esta máquina não tem. Teste:
`e2e/recorte-no-app.mjs` (passou no app de desenvolvimento e no EMPACOTADO).

**Mandar é um ANEXO MARCADO (`attachments.figurinha = 1`) que aponta para o mesmo arquivo pelo sha** — por isso ela herda a
chave secreta no endereço, a caixa-preta, a vassoura de órfãos (que lê também `figurinhas`) e a cota (que conta a figurinha uma
vez, na coleção). O Shield confere UMA vez, ao criar; positivo na reconferência tira de todas as coleções. **Quem sobe responde**
(a regra dos emojis e dos sons): a retirada por direito autoral de um anexo-figurinha leva também as cópias guardadas nas
coleções; as já mandadas em conversa privada ficam, pela regra de que a busca não olha o privado. Na busca do painel, o nome do
anexo é "figurinha". Política nas duas línguas desde o mesmo dia. Testes: `server/test/figurinhas.test.ts` e
`e2e/figurinhas.mjs` (passou).

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

**Feito em 19/10/2026 (pedido dele):** cada cartão da agenda tem o "Estou aqui", e a turma vê "Jogando agora: fulano"
na hora (`jogos:mudou`). Contra o enfeite morto, a marca SOME SOZINHA: 4 horas depois de marcada, ou quando a pessoa
fica sem o Syden aberto por duas varreduras seguidas (recarregar não apaga). Mora só na memória do servidor
(`server/src/jogando-agora.ts`), como quem está em chamada. Teste de tela: `e2e/jogando-agora.mjs`.

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
