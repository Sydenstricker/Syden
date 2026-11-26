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

**O celular não tem botão direito (20/11/2026, relato dele: "no celular a experiência é incompleta; não consegui clicar na
comunidade para compartilhar o link").** Medido num iPhone simulado: o convite só existia no botão direito do ícone e no salão, e
tocar em "Início" na lista não abria o salão; a lista de pessoas sumia abaixo de 900 px, e com ela o perfil e a conversa privada.
Agora: o **convite fica na capa da comunidade** (o botão com o boneco e o +, para todo membro), e no toque ele abre a FOLHA DE
COMPARTILHAR do sistema, no computador copia (`mandarConvite` em `linkDeConvite.ts`, o mesmo do "Chamar alguém" do salão); o
**"Início" abre o salão**; o botão de pessoas abre a lista como **gaveta** (`.members.aberta-no-celular`, abaixo do cartão de perfil);
e o **toque longo é o botão direito** (`toqueLongo.ts`: segurar ~550 ms dispara o `contextmenu` no lugar do dedo, e todos os menus
de sempre respondem; o Android já fazia, o iPhone não). **Regra para o que vier: função que só existe no botão direito ou no
"passar o mouse" não existe no celular** — ela precisa de um botão, ou pelo menos responder ao toque longo. Teste: `e2e/celular.mjs`.

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
- **Pesquisa de 16/11/2026** (pedido dele: "jogos famosos que são gratuitos, para eu já integrar; não tem por que reinventar a
  roda"), o mesmo método (12 s num Chrome + o texto + o cabeçalho de embutir). **Sem anúncio e embutíveis:** Set with Friends
  (MIT; carrega Stripe e Firebase, o login pode falhar na moldura), Fishbowl (MIT; GA e PostHog), Out of Context, Just One
  (marca do jogo de tabuleiro, no Heroku), Snakeout, werewolf-night.com, Protobowl, Little Alchemy 2; Drawphone e o Spyfall do
  tannerkrewson continuam limpos. **Com anúncio:** Haxball (e não embute), Krunker, bonk.io, Smash Karts, agar.io, diep.io, PlayOK,
  MegaJogos, StopotS, wavelength.zone, cardgames.io, play2048.co (o 2048 só hospedando o MIT). **Fora:** Freeciv-web (todos os
  endereços públicos viraram cassino: nunca linkar), Poker Now (sem anúncio, mas é jogo de azar simulado e há adolescentes no
  Syden), minecraft-web-client (arte da Mojang), Hextris (GPL-3), o Poke2D Arena (fan game de Pokémon sem licença, com AdSense e
  termos que proíbem hospedar; a MECÂNICA de arena em tempo real foi para os Bichos da Toca). **Por link (de graça, sem loja):**
  DDNet (zlib), OpenTTD, Wesnoth, SuperTuxKart (GPL; servidor nosso só à parte e sem modificar), Luanti, Unciv. O Rocketcrab (MIT)
  é um lançador de jogos de festa em moldura, a mesma arquitetura do SiteEmbutido: o catálogo dele foi a fonte. Notas e medidas no
  scratchpad da sessão; o que entra, decisão dele. **Script que visita muitos sites lê a lista de um arquivo:** com os endereços
  na linha de comando, o Defender o matou como "Trojan:Win32/Commando.C!ml" (falso positivo).
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
**AS COLUNAS NOVAS DA MITOLOGIA E O MODO BANDEIRA (20/11/2026, as pendências dos lotes):** a mitologia ganhou o **Gênero** da
figura (nunca o de quem lê: masculino, feminino, "varia", e "—" para bicho sem gênero) e a **Família**, os dois do Wikidata (CC0)
por `server/scripts/quiz-mitologia.mjs`; os que o Wikidata não diz foram conferidos à mão em `GENERO_A_MAO`. A família é a figura e
os parentes dela que estão na lista, nos dois sentidos, numa coluna de tipo novo, `parentes`: verde só a própria figura, amarelo se
é parente ou tem parente em comum (alguns vínculos do Wikidata soam estranhos, como Afrodite–Gaia: ficou como a fonte diz). Os países
ganharam o **modo Bandeira**, escolhido na largada como categoria ('bandeira'), com o recorde do Solo à parte (o clássico segue na
variante ''): a bandeira se abre em 6 pedaços, um a cada chute, e as colunas continuam dando a dica. As bandeiras são do flag-icons
(MIT, crédito nos termos), tiradas por `server/scripts/quiz-bandeiras.mjs` para `server/assets/quiz/bandeiras/` com a licença ao lado.
**Não ficam em `web/public`: o nome do arquivo seria a resposta.** A tela as pede por uma ficha sorteada a cada rodada
(`/api/minijogos/quiz-bandeira/:ficha`), e o SVG sai sem nada que diga o país. Sobra possível: ver a bandeira inteira pelas
ferramentas do navegador. De fora: símbolo e animal da mitologia (o Wikidata não tem para quase nenhuma). Testes:
`server/test/minijogos-quiz.test.ts` e `web/test/quiz.test.ts`.

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
**OS AJUSTES DE 09/11/2026 (pedidos dele):** os bichos da HORTA também são da Quaternius agora (o gato listrado no lugar da
raposa, o pombo no do corvo e a galinha gigante no do texugo; os ids continuam raposa/corvo/texugo, que vão no quadro e nos
troféus; o desenho por código só enquanto a folha carrega). Os comandos mostram as setas E o WASD lado a lado. **A ARRANCADA:**
dois toques para o lado (setas, A/D ou o toque) em 250 ms dão um dash de 200 ms, para a frente ou para trás, só movimento; o
servidor dá um crédito de distância à parte para ela. **O ESPECIAL VIROU UM GIRO** (a mecânica do giro que anda, só a mecânica):
1,6 s girando e andando, acertando em volta a cada 320 ms, com RECARGA DE 8 s pelo relógio (não gasta mais vida) e a barra no
canto da tela; o servidor confere a recarga e cada acerto. O equilíbrio é chute medido contra o piloto automático.
**AS FASES (06/11/2026, pedido dele: "a primeira fase é a briga na horta, e em outros cenários ele vai mudando inimigos e
cenário"):** Horta (a de sempre, intocada), Floresta, Deserto, Neve e Castelo, e a **Campanha** (as cinco seguidas). Quem começa
escolhe na largada, no Solo e na sala; todas abertas de fábrica. Os bichos e as fases moram em `server/src/briga-fases.ts` ↔
`web/src/briga/fases.ts`, IGUAIS BYTE A BYTE (o teste confere); bicho novo entra no FIM da lista (o índice vai no quadro). Cada
bicho é um COMPORTAMENTO: soco (a raposa), mergulho (o corvo), **pulo** (agacha mirando onde a pessoa está, o círculo pisca, e cai
em cima), **tiro** (mira a faixa, a linha pisca, e atira: trocar de faixa ou pular escapa) e chefe (o texugo; os novos com a
**rajada** de três tiros). Os da horta continuam por código; os outros 16 são os **Ultimate Monsters da Quaternius (CC0)**
renderizados de lado pelo Blender com a câmera, a luz e o giro do coelho (`blender/meshy/briga-monstros.py` → `-pos.py` →
`web/public/briga/<fase>/` e `folhasDosBichos.ts`, gerado). Sem humanos nem o Bunny no elenco. A floresta usa o Parallax Forest do
ansimuz (CC0); deserto, neve e castelo são por código (`briga/cenarios.ts`). Troféu: a horta segue `'briga'`, as outras
`'briga-<fase>'`, a campanha só inteira (`'briga-campanha'`). Crédito nos termos, seção 10. O equilíbrio dos bichos novos é chute
medido contra o piloto automático. `e2e/briga-fases.mjs` passou (a escolha e as cinco fases, com fotos).

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

**A AUDITORIA DOS MINI-GAMES (16/11/2026, pedido dele: "não quero ficar vendo um por um"), e os consertos:** a Batalha naval
apagava no meio da partida porque perguntava "tem WebGL?" a cada desenho, criando um contexto que nunca soltava (o mesmo em 13
jogos 3D). **Regra: a pergunta é só por `web/src/temWebGL.ts`** (uma vez por página, e o contexto do teste é solto na hora), e
cena 3D nova ouve o `webglcontextlost` e volta ao 2D. Mais: a energia do Jato cobra por batida, e não por passo raspando (o
iniciante explodia em 5 a 10 s); a corrente do Dominó fica PARADA na mesa (a primeira pedra no meio, as novas pelas pontas, a
esquina perto da borda); o painel largo (`min(760px, 94vw)`) nos jogos de ação e nos 3D; o coelho 3D com o relevo do Meshy de
volta e a luz amaciada (`coelho3d.ts`); no Estoura-balão, o pulo (só desenho: não desvia de item), o painel em HTML por cima e a
largada que não aponta para a árvore. O relatório inteiro foi entregue a ele na conversa; Stop, Desenha, Lobisomem e Palavra
secreta não foram auditados (pedem uma sala).

**A AUDITORIA COMPLETA E OS LOTES 1 A 4 DE MELHORIAS (19/11/2026, pedido dele: "algumas implementações estão muito modestas, quase incompletas; compare com o jogo de referência"; depois "faça do lote 1 ao 4").** A auditoria comparou cada jogo com a referência e foi entregue na conversa; as melhorias foram feitas por agentes, um por grupo de jogos, e ninguém jogou nenhuma com gente (o equilíbrio é chute medido contra os pilotos automáticos). A BASE COMUM que nasceu dela: **`solo_recordes`** (no fim do db.ts: `recordeDoSolo`, `recordesDoSolo`, `guardarRecordeDoSolo(userId, jogo, variante, valor, menorMelhor, extra?)`), a tabela única dos recordes do Solo — jogo novo NÃO cria tabela própria; o valor é sempre o que o SERVIDOR calculou ou refez; está no "Levar seus dados" (`recordesDoSolo`). Módulo que é importado por testes do site não importa o db no topo (abriria o banco de verdade): recebe os recordes de fora (`criarXadrez({ recordes })`) ou usa `server/src/recorde-solo-tardio.ts` (import dinâmico). **`web/src/impacto.ts`**: o tremor, a pausa no acerto e o piscar, SÓ DESENHO (nunca mexe no passo da simulação nem no que vai ao servidor); com "menos movimento", sem tremor. **Os sons novos** em `somDosJogos.ts`: impacto, derrota, dano, explosao, turbo, item, cura, largada, alarme, medalha, desliza e torcida. O detector de texto cravado aprendeu cor, posição e família de letra no estilo (`rgba(…)`, "top center", "system-ui, sans-serif") e os nomes Kalah e Oware.

**A Corrida dos coelhos, as melhorias de 19/11/2026:** ganhou som, que antes não tinha nenhum. O motor (`criarMotor`) ronca pela velocidade e, no semáforo, sobe quando se aperta o acelerador; há efeitos para cada luz, o verde, derrapagem, turbo, item, batida, lama, volta e chegada. O TURBO DA LARGADA (`largada` em `corrida/fisica.ts`) é só de passos: acelerar entre 40 e 12 passos antes do verde dá 0,8 s de turbo, e apertar antes da terceira luz faz o kart patinar 0,7 s; quem segura desde antes do semáforo (a tela de toque) não ganha nem perde. O servidor não mudou, e o fantasma com o turbo passa na conferência. No Solo há agora o CONTRA O COMPUTADOR (`corrida/robos.ts`): sete robôs com a física de verdade, que só decidem os comandos; quem joga larga na última fila. Dá para escolher uma pista ou uma copa (pontos 10, 8, 6, 5, 4, 3, 2, 1, pódio na tela) e três dificuldades, sempre com os itens: os robôs pegam as caixas, usam os itens e são atingidos pela mesma regra de "quem leva decide". Há também o MODO ESPELHO (`espelhar`: o x vira 1024 − x e o id ganha "~espelho", que o servidor não conhece) e a CLASSE RÁPIDA (o teto ×1,25, campo `classe` do `Kart`). Contra o computador não vale recorde nem troféu, e nada vai ao servidor; o contra o relógio continua na pista normal. Robôs medidos na Horta: fácil ~1:12, médio ~1:06, difícil ~1:02, contra 1:00 do piloto automático.

**Os Coelhos a jato, as melhorias de 19/11/2026:** no Solo, a classificação das 12 naves aparece ao final, e há duas COPAS, a estelar (Cidade, Órbita, Mar de nuvens) e a da tempestade (Aurora, Tempestade, Órbita), com pontos 15, 12, 10, 8…0, sem fantasmas. A copa mora só no site: cada corrida é um Solo comum no servidor e continua valendo recorde, porque as naves do computador nunca tocam a de quem joga. A DIFICULDADE das naves do computador tem três níveis; o médio é exatamente o caminho de antes, e a sala usa sempre o médio. O GOLPE DE LADO (X ou 🌀, só no Solo) gira a nave 0,4 s e empurra o robô encostado: ele perde 60% da velocidade e o caminho dele é refeito dali (`golpear`); na sala continua sem contato. Duas PISTAS NOVAS por código, `aurora-1` e `tempestade-1`, com as medidas em `server/src/jato.ts`.

**A Regata da toca, as melhorias de 19/11/2026:** as BOIAS DE SLALOM (cone com uma seta piscando no lado certo) dão 0,6 s de turbo do lado certo e 1,2 s na terceira certa seguida; errar zera o turbo e freia ×0,85. As RAMPAS dão um salto acima de velocidade 70 (no ar, o motor e o leme não pegam). Tudo isso é física do site, e o fantasma honesto continua passando na conferência do servidor. No Solo entraram 5 BARCOS DO COMPUTADOR (`barco/robos.ts`) em três dificuldades, com o caminho esticado no tempo em relação ao piloto automático de cada pista; eles não tocam o barco de quem joga, então a corrida vale recorde. E a COPA DA REGATA (as três pistas), só no site.

**AS PISTAS DOS CARRINHOS (19/11/2026):** cinco traçados prontos, cada um com o seu id, recorde e fantasma (`TRACADOS` em `carrinhos-sim.ts`): a Toca de sempre (`toca-1`, a mesma volta de antes: os recordes antigos valem), o Caracol, o Zigue-zague, a Troca e a Estrada longa, escolhidos entre traçados sorteados que fecham, não se cruzam e deixam as faixas a menos de 0,6% (o teste cobra 1% em 5 e em 20 voltas). **O oval NÃO serve** (medido: 2,3%; trocar de lado não muda a distância de cada faixa ao meio). O **CRUZAMENTO** (X) é uma reta em que as faixas trocam de lado (o kit da Kenney não tem a peça: a reta com os riscos por código), e um traçado leva um número par deles. A **RESISTÊNCIA** são 20 voltas, com recorde à parte (`@20` na chave). O **EDITOR** (`carrinhos/EscolhaDaPista.tsx`) monta a pista com reta, curvas e cruzamento, e ela só vale se fechar, não passar por cima de si mesma, tiver cruzamentos em par e ao menos 40 de comprimento (`validarTracado`, a mesma conta no servidor); vira o código "SYDP1-…" para copiar e colar, e o servidor confere o código e refaz a corrida. O recorde da pista do editor mora em `carrinhos_recordes` com o CÓDIGO como chave (com os fantasmas dos amigos). O equilíbrio das faixas das pistas do editor NÃO é conferido (decisão dele: avisar ou recusar). Na sala, quem convida escolhe a pista e as voltas.

**A GINCANA, as rodadas e a sobrevivência (19/11/2026):** o MERGULHO entrou na regra, nas duas cópias (o bit 32, Shift ou X; um impulso por pulo; o coelho deitado 20 passos ao pousar); sem o bit a regra é a mesma, e os fantasmas antigos valem. A SOBREVIVÊNCIA é o percurso `campo-1`: 5 × 5 blocos que caem e voltam, com o varredor que ACELERA (soma em inteiros, `acel`/`ACEL_DIV`). Cair é sair, e o resultado é o quanto aguentou, refeito pelo servidor (máximo 120 s); no Solo, o recorde mora na tabela comum. Na sala, `percurso: 'rodadas'` faz duas corridas sorteadas e a sobrevivência na final; passam 70% e depois 50% (`cota`), nunca menos de 2 na final, e a corrida fecha quando a cota chega. No Solo correm até 3 COELHOS-ROBÔ: o planejador com erro (`correrRobo`), num worker, trecho a trecho, sem virar recorde. Poeira e confete, só desenho.

**O ROLÊ, os objetivos e a Praça (19/11/2026):** cada sessão tem OBJETIVOS, contados na sessão que o servidor refaz (`objetivos()` em fisica.ts): a palavra NOSSA "TOCA" em letras no ar, a meta de pontos, a de combo, a fita escondida no alto do quarter e os SALTOS COM NOME (`gap:<id>` no combo). O melhor número por pista vai à tabela comum ('skate', 'objetivos-<pista>'). A BARRA DE ESPECIAL enche com os pontos e esvazia ao cair; cheia, os flips viram "Double". A seta na hora de apertar dá as variações (Heelflip, Pop Shove-it, Varial; Nosegrab, Tailgrab, Melon, Indy). A SEGUNDA PISTA, a Praça (`praca-1`), usa só as peças e os perfis já medidos; o recorde do parque continua em skate_recordes_1min, o da praça na tabela comum. Pista nova é id novo no FIM de `PISTAS`. A pista se escolhe no Solo e na sala. A pontuação mudou: os recordes antigos do parque só se comparam por alto.

**O PLANADOR, os níveis, as medalhas e o vento (19/11/2026):** 10 desafios (asa 1–4, mochila 1–3, salto 1–3) com `nivel`; os três de antes não mudaram e mantêm o recorde. As TÉRMICAS (`subidaEm`) e o VENTO de lado, nas duas cópias, só + − × ÷. MEDALHAS de bronze, prata e ouro a 50%, 70% e 85% dos pontos máximos, na escolha e no fim, com a nota de 0 a 3 estrelas por categoria. O cenário segue o tema das pistas da corrida (horta, neve, cânion). O piloto automático passa em todos com pelo menos o bronze.

**A BRIGA (19/11/2026):** o golpe soa no ACERTO, com a pausa no acerto (70 ms no 3º soco, 50 na voadora) e o tremor; a barrinha de vida do bicho aparece por 2 s depois de cada acerto. **A CURA QUE CAI é do servidor** (20%; a grande cura 60, a pequena 25; some em 15 s). **O ARREMESSO**: o 3º soco num bicho atordoado o joga longe, derrubando os do caminho (o chefe e quem voa, não). **OS CAIXOTES**: dois por arena de onda; os socos os quebram (sai uma cenoura), e o 3º soco ou a voadora num caixote INTEIRO o arremessa pela faixa; o servidor confere e decide o voo. **Um BICHO DE ELITE por fase** (o primeiro da 3ª onda: 2,5× a vida, +3 de dano, o triplo de pontos, a aura). **O recorde do Solo** é o tempo da fase vencida, na tabela comum (variante = a fase).

**O COMANDO (19/11/2026):** clarão no cano e tremor na granada, no pisão e na queda do dragão. **A FACA-CENOURA**: com o bicho colado, atirar vira a facada (2 de dano, uma a cada 320 ms), conferida pelo passado do bicho. **AS ARMAS NOVAS**: a CHAMA CURTA (um tiro a cada 70 ms, alcance de 64 px) e a TELEGUIADA (lenta, longe, 2 de dano; a curva é da tela, e o servidor confere pela distância do caminho possível e pelo lado da mira), nas duas cópias de `comando/conta.ts`. Vêm da **CÁPSULA VOADORA** (2ª e 4ª onda; derrubada, a arma fica 15 s no chão). **A SEGUNDA FASE, O DESERTO** (cacto, golem e redemoinho; os bichos são guiados pelo `comp`, não pelo nome), com o YETI de subchefe na 3ª onda e o dragão no fim; escolhe-se floresta, deserto ou campanha. Recorde do Solo por fase, na tabela comum.

**O CHEFE (19/11/2026):** **REVIVER**: quem ficou sem vidas volta com UMA vida se alguém da turma ficar a até 26 px dele por 2 s seguidos (o servidor decide). **A CRUZ DE PEDRAS**, só da última fase. Tremor e o clarão na troca de fase. **O SEGUNDO CHEFE, O YETI**, escolhido na largada: no lugar da investida, empurra uma BOLA DE NEVE pela linha marcada, e ela para no fim, fria, para pegar e devolver como o torrão. Recorde do Solo na tabela comum ('chefe'; '' a toupeira, 'yeti' o yeti).

**A CAÇA (19/11/2026):** o clarão do tiro e o som do erro. **O COMBO** (×2 a partir do 4º acerto seguido, ×3 a partir do 8º; o erro zera) e **a ONDA PERFEITA** (+500), contados pelo servidor. **A PRAGA DOURADA** (no máximo uma por onda, da 2ª em diante, mais rápida e valendo o triplo) e **a onda 4 em pares**, nas duas cópias de `voo.ts`. No placar entre as ondas, **o coelho sobe da moita**, alegre (60% ou mais) ou rindo.

**O PULO DO COELHO (19/11/2026):** poeira, amassa-e-estica e estrelinhas no espinho, só desenho. Cada fase ganhou cenouras e uma DOURADA escondida, contadas À PARTE do tempo; o servidor só aceita as que o fantasma passou perto (`cenourasDoCaminho`) e vale o menor entre isso e o que a tela diz (tabela comum: `pulo-cenouras`, `pulo-dourada`). Três fases novas com bichos de patrulha que se pisam (o besouro e a abelha, pelo passo): o **Córrego** (`corrego-1`, porque `riacho-1` é da Regata), a **Mina** e o **Ninho**, e a **Copa dos Bichos**; as três antigas não mudaram. O servidor não conhece os bichos, como não conhece os blocos.

**A TORRE DO CELEIRO (19/11/2026):** medalhas de ouro, prata e bronze sobre o tempo do piloto (`TEMPO_DO_PILOTO`: até ele, +25% e +60%). O pulo cresce com a corrida (`vPuloCom` = 310 + 0,35·|vx|), com `SOBE` e as janelas do servidor ajustados; os ids não mudaram, e os recordes antigos valem (a confirmar com ele). Duas torres novas: o **Moinho** e o **Pombal**.

**A ESQUADRILHA DA TOCA (19/11/2026):** a arma tem três níveis (dano 1, 1,5 e 2; a Ficha confere pelo nível do disparo). O **loop de esquiva** (C ou Shift, evento `'l'`; recarga de 5 s, invulnerável no meio, conferido). A **esquadrilha intacta**: na sala, com 2 ou mais, sem ninguém perder vida, +1500 a cada um. Duas fases curtas escolhidas na largada: o **Pomar** (o Vespeiro, tiros em espiral) e o **Celeiro** (o Trator, paredes de tiro com vão); a Horta segue o roteiro de sempre e o recorde dela em `nave_recordes`, as outras na tabela comum.

**A MASMORRA DA TOCA (19/11/2026):** o mapa do canto (corredores, a sala do chefe e onde cada um da turma está). Vasos e moitas (o SERVIDOR anda o vaso, acerta o bicho e sorteia o que sai). A **bomba de semente** (Q; a turma começa com 2, no máximo 5) estoura no servidor e abre a **parede rachada** do salão dos cogumelos, com a **sala secreta** e o **coração grande** (um coração a mais para cada um). **A SEGUNDA MASMORRA, a MINA DOS POSTES**, escolhida na largada (`corpo.masmorra`): RAMIFICADA, com o baú do **gancho** a oeste e o rio a leste, que só se atravessa com ele, puxando o coelho até um POSTE; o gancho é do servidor, como a porta (`alvoDoGancho`, a mesma conta nas duas cópias). Recorde do Solo por variante ('' a toca, 'mina' a mina).

**OS BICHOS DA TOCA CRESCERAM (19/11/2026).** Na sala, todos lutam no mesmo nível (`NIVEL_DA_SALA`, 20). Os golpes ganharam EFEITO (13 novos): precisão, cochilo leve, veneno leve, degraus de ataque e defesa (−3 a +3), cura de si e o golpe que vai primeiro; a sorte só é sorteada quando o golpe tem algo sorteado, para as lutas de antes darem a mesma sequência. Metade das espécies cresce (outra folha da Briga ou a MESMA recolorida por código, `matiz`/`escala`). O CADERNO DA TOCA anota os vistos e os amigos. O mapa ganhou o Bosque e a Serra (`MAPAS`, 24 × 16, com o vizinho de cada borda; o teste confere que tudo é alcançável), com matos de nível maior, bichos que só aparecem ali, pessoas no caminho, achados e a LOJINHA (moedas do jogo, nunca dinheiro). A ESCADA de quatro desafiantes até o nível ~30 (Nena, Bento, Ravi, Olga), a REVANCHE da Nena e o raro Aurelho. A aventura antiga continua valendo (`lerAventura`). Os nomes das pessoas são próprios e iguais em todo idioma.

**A ARENA DOS BICHOS (19/11/2026):** o forte e o especial passaram a ser de cada elemento, nas duas cópias de `conta.ts`; o servidor confere cada forma. A tela do fim mostra o dano, os nocautes, o dano levado e os DESVIOS, contados pelo servidor. Dois cenários com regra própria, o GELO (escorrega) e a LAMA (as poças seguram), sem passar da velocidade normal. O modo "Segurar a zona" (o time sozinho no círculo faz um ponto por segundo; 60 vence; o servidor conta). "Mato que esconde" ficou de fora: pediria esconder posições no quadro.

**O MATO QUE ESCONDE (20/11/2026, a pendência dos lotes de 19/11):** moitas de mato alto nos quatro cenários da Arena (`MATO` em
`arena/conta.ts`, as duas cópias), simétricas pelo centro e longe de onde se nasce, dos suprimentos e da zona do meio; valem em todos
os modos, sem opção na largada. Quem está com o pé numa moita some para os adversários (o próprio time continua vendo) e reaparece com
um adversário de pé a menos de 80 px, na mesma moita, ou por 1,2 s depois de golpear ou de levar golpe. **Quem esconde é o servidor:**
o quadro vai por time (`difundirPorPessoa`, que o motor dos minijogos ganhou, opcional), e quem está escondido vai só com a vida e as
vidas (a posição zerada, a coluna 17 ligada); quem só assiste vê como quem não tem aliado (na sala de voz, ele podia soprar). A tela de
quem atira não acerta quem não vê, então o servidor anda essa bala e confere ele mesmo (`passoDasBalasNoMato`). Os robôs só miram em
quem o time deles vê e, sem ninguém à vista, vão olhar as moitas. As folhas são de pé, na ordem do y com os coelhos; eu e os aliados no
mato ficamos meio transparentes. Números chutados (80 px, 1,2 s). Testes: `server/test/minijogos-bichos-arena.test.ts` e
`web/test/arena.test.ts`.

**AS LENDAS (19/11/2026):** três HABILIDADES por classe, a 2ª e a 3ª liberadas pelo NÍVEL, que sobe a cada luta vencida, com 1 de 2 melhorias da classe (nada passa de uma partida para outra). Cada inimigo tem um TRAÇO (`TRACOS`), mostrado com figura e frase. O CAMINHO é sorteado pela semente (`rotaDaSemente`), com bifurcações votadas pela turma (empate, sorteio do servidor), fogueira, loja ou evento, e o yeti na geleira. Os COMBOS COM NOME de três classes ou das quatro. No Solo, o recorde são as rodadas até o dragão, na tabela comum. Uma turma toda de robôs vence ~81%.

**O LOBISOMEM (19/11/2026):** a partida abre no PREPARO (quem começou escolhe os lobisomens, os papéis e os tempos; a composição aparece para todos). Os papéis novos têm nome de COISA, porque "Caçador" e "Bruxa" diriam o sexo de quem recebe: a **Armadilha** (quem sai do jogo leva alguém junto) e o **Caldeirão** (vê quem os lobos atacaram; uma poção salva e uma envenena, cada uma uma vez); sem o Caldeirão vivo, a etapa dele dura um tempo sorteado, para o relógio não contar nada. A DEFESA de 20 s e o julgamento no SIM ou NÃO. A CONVERSA DE TEXTO só dos lobisomens à noite (só na memória; some no amanhecer). A HISTÓRIA da partida no fim. O céu em CSS e os sons sintetizados.

**O TABULEIRO DA TURMA (19/11/2026):** a LOJA (`$`) e o DUELO (`d`), mais quatro eventos (vento, praga, mutirão, brinde). Cinco ITENS (dado duplo, dado escolhido, troca de lugar, ímã da dourada, escudo), no máximo 3 por pessoa. No duelo, quem ganha leva 5 cenouras do outro: valor fixo, cenoura do jogo, nada apostado. DUAS BIFURCAÇÕES (`RAMAIS`). Com 4 na partida, a cor da casa decide o formato do microjogo (2 contra 2, 1 contra 3; `OpcoesDaRodada.equipes`). A RETA FINAL (as 3 últimas rodadas valem o dobro) e três PRÊMIOS BÔNUS no fim, uma dourada cada. Os robôs compram, usam itens, escolhem o caminho e duelam.

**A FESTA DOS COELHOS (19/11/2026):** no "prepare-se", os controles desenhados e a figura do microjogo (a própria tela parada; `web/src/festa/moldura.tsx`, microjogo novo com teclas ganha a linha em `CONTROLES`). Na revelação, o coelho de quem venceu comemora. O Parar o relógio, o Medidor de força e o Saque rápido ganharam cena (só desenho). A última rodada vale o dobro, e quem venceu mais rodadas ganha +5. O MODO RELÂMPAGO (`minijogo-festa-relampago.ts`): cinco microjogos curtos que aceleram de 4,8 s a 2,2 s, com 3 vidas, conferidos pelo servidor; pódio `'festa-relampago'`.

**PINBALL, TRÂNSITO, PONTE E HORTA EM CASCATA (19/11/2026):** o PINBALL ganhou a tacada certeira (2500), a bola extra nos 40, 120 e 300 mil, as MISSÕES em ciclo com patente (até 9), a RAMPA (a primeira versão fazia um LAÇO SEM FIM; o teste cobra que a partida acaba pelas bolas) e a SEGUNDA MESA, o POMAR (recorde na tabela comum; medido com o piloto, bem mais generoso que a horta: decisão dele). O TRÂNSITO, o modo "ATÉ BATER" e o mapa em T, o caminhão e a moto (`MEDIDAS`; a batida só conta perto do cruzamento) e a demonstração de 5 s. A PONTE, o Solo SEM PRESSA, o ORÇAMENTO com até 3 selos (medido por busca gulosa a partir da ponte de referência), 10 fases novas (15 no total; `pontePronta` passa em todas) e o CABO, que só puxa. A ponte levadiça ficou de fora: pede uma junta nova na física, nas duas cópias (decisão dele). A HORTA EM CASCATA, o recorde por modo e velocidade, a velocidade da largada de 1 a 5, o CONTRA O COMPUTADOR (o piloto mora na regra, `escolherJogada`), o QUEBRA-CABEÇA de 20 fases (`QUEBRA_CABECAS`; o teste confere por busca que cada uma se limpa em N e não em menos), o alarme, as faíscas e o tremor.

**COZINHA, FUTEBOL, OS MINIGOLFES E O TAMANHO (19/11/2026):** a COZINHA ganhou quatro PLANTAS escolhidas na largada (`PLANTAS`, `FOGO_DAS_PLANTAS`), a GORJETA por rapidez pelo relógio do servidor (só bônus), o recorde por planta, os pratos sujos e a pia (só da tela) e a FRIGIDEIRA ESQUECIDA que pega fogo (o servidor só aceita o extintor). O FUTEBOL, a dificuldade dos robôs, a troca de jogador (Q), a mini-copa e o CHUTE ALTO (C, a bola com altura nas duas cópias; ninguém domina a bola alta), e a comemoração do gol com a torcida. Os dois MINIGOLFES continuam lado a lado: o percurso escolhido na largada, o recorde por percurso e o selo do par; na toca, 9 buracos; no 3D, o Parque (9) e AS PÁS DO MOINHO GIRANDO pelo passo (`moinhoFechado`), e os ITENS DA PRÓPRIA BOLA só na sala (bola pesada, quique extra, mira longa). O TAMANHO ganhou som, o recorde por categoria e as categorias Comida e Veículos (29 objetos do Fluent Emoji, conferidos inteiros).

**TOCAS E TORRES (19/11/2026):** a simulação e o computador viraram DUAS CÓPIAS IGUAIS (`web/src/tocas/{sim,ia}.ts` ↔ `server/src/tocas/`; o comando de fora passa por `limparComando`), e o Solo é REFEITO pelo servidor (o recorde, por nível, só com todas as assinaturas batendo). Três NÍVEIS (o normal é o de antes; o difícil ganhou as 32 partidas contra o fácil; ligar `fazendasNaEra` no normal é decisão dele). Quatro MAPAS espelhados (campo, floresta, ouro no meio, lagos; a água é `grade = -2`). O FERREIRO (9 melhorias) e o MERCADO (a novidade da era 2). O TUTORIAL de 5 passos. O FIM com os gráficos. **A SALA 1×1 EM LOCKSTEP**: turnos de 2 passos, o comando vale 3 turnos depois (600 ms), assinatura a cada 25 turnos (na 1ª diferença, refaz; na 2ª, acaba sem troféu), e o pódio `'tocas'`.

**O 2×2 E QUEM ASSISTE NAS TOCAS E TORRES (20/11/2026, as pendências dos lotes):** quem convida escolhe 1×1 ou 2×2 e o mapa
(`EscolhaDaSalaDasTocas` em JogoTocas.tsx; `corpo.formato`). No 2×2 jogam de 2 a 4 pessoas, e os ROBÔS (o computador normal,
`NIVEL_DOS_ROBOS`, com o 🤖) completam o que falta. Eles jogam DENTRO da simulação: o servidor e cada computador da sala chamam a mesma
IA antes de cada passo, depois dos comandos do turno, e a parte do robô no turno vai vazia. As equipes são os donos 0 e 2 contra 1 e 3
(`equipeDe`, `aliados` em sim.ts; o Solo e o 1×1 conferidos contra a versão anterior em 36 partidas, assinatura igual). Os aliados
ficam EM CANTOS OPOSTOS (`CENTROS_DO_2X2`): lado a lado, a equipe da direita ganhava 8 de 10 entre computadores (a varredura das casas
não é simétrica); na diagonal, 12 a 16 em 28. O mapa é `gerarMapaDe4`, espelhado nos dois eixos, com corredores entre as bases.
Aliados não se atacam, dividem a visão e o portão; a equipe só perde com os dois centros caídos, e `vencedor` passou a ser a equipe.
Quem fica 1 minuto fora ou desiste com a aliada de pé LARGA: a base fica parada e a partida segue; sem ninguém pela equipe, ela perde.
QUEM ASSISTE (quem está na sala e não joga) recebe os turnos, anda a mesma partida sem névoa, move a câmera e não manda nada (o painel
não fica `inert` para as Tocas, Minijogo.tsx). Pendentes: a assinatura de quem assiste (dessincronia dele não é detectada), um robô
que assume quem larga, as duas pessoas na MESMA equipe contra robôs (hoje, com 2, cada uma fica numa equipe com um robô), a dica em
`minijogos.ts` (ainda diz "contra outra pessoa"), e2e. Testes: `server/test/minijogos-tocas-2x2.test.ts` e o do 2×2 em
`web/test/tocas.test.ts`.

**A MESA COMUM E OS JOGOS DELA (19/11/2026):** Cinco em linha, Mancala, Damas, Xadrez e Batalha naval ganharam juntos (`duelo` em `minijogo-tabuleiro.ts`, `web/src/MesaComum.tsx`) o NÍVEL DO ROBÔ no Solo, o RELÓGIO DE PARTIDA na sala (3+2, 5+3, 10+0, 15+10), o "Como jogar", VOLTAR O LANCE no Solo (a Batalha naval não volta), a OFERTA DE EMPATE na sala e o HISTÓRICO, ao lado do tabuleiro a partir de 620 px da mesa. O Cinco em linha, o "exatamente 5" e a TROCA na abertura; a Mancala, de 3 a 6 sementes e o OWARE, com a semeadura animada; os dois agora em 3D (`mesa3d/gomoku.ts`, `mesa3d/mancala.ts`). As Damas, a repetição tripla. A Batalha naval, a pontaria no fim, o robô que conta as posições possíveis e o SALVO. A Partida de xadrez, a notação algébrica e as capturadas; o difícil olha 1 lance (2 levava segundos no servidor), e **o robô de xadrez segura o servidor ~0,8 s por lance: um processo à parte é decisão dele**. Os PROBLEMAS DE XADREZ, o 3D da partida, o "tente de novo" e a CORRIDA de 3 minutos (recorde na tabela comum); o script guarda os temas do Lichess, mas o arquivo em `server/assets/` ainda é o antigo (regenerar pede baixar ~250 MB: decisão dele). O CAPITAIS, dados iguais jogam de novo, pagar 50 para sair do engarrafamento, a partida rápida e o robô que PROPÕE a troca que fecha o grupo dele.

**SUDOKU, STOP, PALAVRA SECRETA, DESENHA E ADIVINHA E OS QUIZZES (19/11/2026):** o SUDOKU, o lápis, o destaque, o desfazer, a dificuldade (35 a 58 casas vazias) e o "conferir só no fim"; o recorde por dificuldade e modo (no "na hora", cada erro custa 10 s). O STOP, rodadas, tempo, letras fora e 57 categorias nossas, mais até 6 LIVRES da turma (sem tradução). A PALAVRA SECRETA no SOLO (o recorde é a maior sequência de vitórias da SESSÃO, só na memória do servidor, sem calendário), o DUETO, o QUARTETO e o MODO DIFÍCIL; 859 palavras para sair, nossas e conferidas contra o VERO. O DESENHA E ADIVINHA, o BALDE (um traço de um ponto; cada tela acha a área numa grade própria só com + − × ÷), votar para pular, 627 palavras em três níveis com bônus, a lista própria da sala e a galeria do fim (só na tela). Os QUIZZES, as pistas aos 5 e 10 chutes e o recorde por tema; sem as colunas novas da mitologia (não há dados) e sem bandeiras (não há arte livre no repositório).

**AS INSÍGNIAS: O CATÁLOGO E AS DO FLIPERAMA (19/11/2026, decisão dele, vendo as insígnias do Discord: "traga as duas coisas").** O catálogo (`CatalogoDeInsignias.tsx`, o mesmo em Minha conta e no Guarda-roupa → Insígnias) mostra TODAS as insígnias: as da pessoa inteiras, as outras esmaecidas com a frase de como se ganham (`comoSeGanha` em `insignias.ts`); sem barra, sem "faltam", sem contagem, sem raridade e sem prazo, a regra das conquistas. É também onde se monta a vitrine: o clique põe e tira, as setas trocam a ordem, "Esconder todas" esvazia. O servidor dá a lista por `GET /api/me/insignias`. **As três do fliperama** (`fliperama-5`, `-15`, `-30`; bronze, prata e ouro, com a arte em pixel art por código em `arteDoFliperama.ts`) medem VARIEDADE: mini-games diferentes jogados NA SALA com 2 ou mais pessoas (`db.jogosDiferentesComGente`: a regra das conquistas da turma; Solo, robôs e o contra o relógio não contam; a Arena conta como os Bichos). São insígnias separadas, e não níveis com barra. **É a primeira conquista INDIVIDUAL fora do troféu do kart**, por decisão dele, e não dá vantagem nenhuma. Quem decide é o servidor (`presentes.ts`): ao entrar (as partidas antigas contam, porque `minijogo_jogadores` já existia) e quando a partida da sala sai da tela, depois do placar (`itens:novos` → a tela de destaque de sempre). Sem dado novo: `user_items` já está no "Levar seus dados". Testes: `server/test/insignias-fliperama.test.ts`, `web/test/insignias.test.ts`; `e2e/catalogo-de-insignias.mjs` escrito, não rodado.

**AS PENDÊNCIAS DOS LOTES DE 19/11/2026 (pedido dele: "anote o que ficou de fora para eu continuar futuramente").**
- **Ficou de fora, para fazer:**
  - ~~Ponte levadiça, Tocas 2×2 e quem assiste, o mato que esconde, as colunas da mitologia e o modo bandeira~~: **feitos em
    20/11/2026** (ver as seções de cada jogo).
  - **Problemas de xadrez por TEMA:** o script (`server/scripts/problemas-de-xadrez.mjs`) já guarda os temas e o servidor
    aceita `tema`, mas o arquivo em `server/assets/` é o antigo. Falta baixar o do Lichess (~250 MB), regenerar (talvez
    subir `POR_FAIXA`) e pôr a escolha na tela.
  - **Testes de navegador (rodados em 20/11/2026):** passaram `masmorra.mjs` (clicando na escolha da masmorra),
    `catalogo-de-insignias.mjs`, `bichos-arena.mjs` (com o mato), `ponte.mjs` (a faixa do celular quebrava em 2 linhas desde o
    cabo: a amostra de 20 px perdia para a regra geral, que vinha depois no CSS) e `ponte-levadica.mjs`. Não rodados: `quiz.mjs` (pede o
    LiveKit) e nenhum das Tocas 2×2. Ninguém jogou nada disso com gente: o equilíbrio é chute medido contra os pilotos.
- **Decisões dele, em aberto:**
  1. Os nomes **Armadilha** (o caçador) e **Caldeirão** (a bruxa) no Lobisomem.
  2. ~~O **robô de xadrez** segurava o servidor ~0,8 s por lance~~: **resolvido em 20/11/2026** (o motor num worker; ver "A DIFICULDADE DO XADREZ").
  3. O **Pomar** do pinball é bem mais generoso que a Horta (partidas do piloto até ~24 min): apertar?
  4. As pistas do **editor dos Carrinhos** não conferem o equilíbrio das faixas (um oval dá ~2,3%): avisar na tela ou recusar?
  5. A **Torre do Celeiro** mudou a física (o pulo cresce com a corrida) sem trocar os ids: os recordes antigos valem.
  6. O **nível normal das Tocas e Torres** ainda trava sem comida às vezes; ligar `fazendasNaEra` nele muda o equilíbrio testado.
  7. Os números chutados: o nível 20 da mesa dos Bichos e os preços da lojinha; os preços dos itens e o duelo de 5 cenouras
     do Tabuleiro; o +5 da Festa; a gorjeta da Cozinha.
  8. Quais modos novos entram nas **conquistas da turma** (a Arena, o Relâmpago, as Tocas na sala…: hoje nenhum).
  9. ~~Cazaque e uzbeque~~: **passados ao informal em 21/11/2026** (decisão dele; o arquivo inteiro, não só os jogos: o cabeçalho mandava сіз/siz). Tadjique, persa, urdu, tâmil e telugo FICAM COMO ESTÃO (decisão dele, mesmo dia): o app no formal, os jogos no informal. No hebraico, a chave "Você" do placar ficou "אני" (eu), como a 'você' que já existia.
  10. Alinhar termos antigos com os novos: no russo, "Pista" era "Полотно" e os novos usam "Трасса"; no montenegrino,
      "Kolovoz" e "Staza".
- O material de trabalho dos lotes (os relatórios por grupo, com o que cada agente fez, e os scripts de tradução
  `extrair.mjs`, `aplicar.mjs` e `orfas.mjs`) está fora do repositório, em
  `C:\Users\fsc_r\.claude\projects\u--Repos-Syden\retomar-19-11\`. O `orfas.mjs` pegou por engano uma linha do
  `paises.ts` (restaurada): se usar de novo, só nos arquivos de idioma.

**A SEGUNDA AUDITORIA DOS MINI-GAMES (20/11/2026, pedido dele: "avaliar os mini jogos para torná-los melhores, com mais fases e jogabilidade melhor"; depois "avance com os batch em sequência").** Seis agentes leram o código de 49 jogos e deram nota de conteúdo e de jogabilidade; o que mais pesava era o CELULAR (jogos que não se jogavam no toque) e a falta de META no Solo. As propostas, em lotes (A: celular e controle; B: metas; C: defeitos de desenho; D: conteúdo; E: grandes), estão no plano.md da pasta retomar-20-11 da memória do projeto (ao lado de retomar-19-11), com os relatórios de cada agente em relatorios/. Decisões dele no mesmo dia: o minigolfe que fica é o 3D, música nos jogos sem música, dificuldade no xadrez. Ninguém jogou nada disso com gente: os números são chute medido contra os pilotos.

**O MINIGOLFE QUE FICA É O 3D (20/11/2026, decisão dele).** Os dois estavam lado a lado para a turma escolher. O Minigolfe da toca (`golfe`) saiu da estante: ficou sem aba em `JOGOS` (a linha fica pelo nome, para os troféus, recordes e partidas antigas) e sem ficha no fichário, e o servidor recusa partida nova (`JOGOS_APOSENTADOS` em minijogos-routes.ts). A máquina e o código continuam no repositório, e a física dele segue viva no microjogo "Uma tacada só" da Festa. Nas conquistas, o lugar dele é do 3D (`NO_LUGAR_DE` em conquistas.ts): as partidas antigas do da toca contam como do 3D, o Repertório completo continua de 21, e "A turma do jogo" do minigolfe guarda o id `turma-golfe` (agora com o nome do 3D) para os degraus alcançados manterem a data. Com isso o Minigolfe 3D passou a contar nas conquistas. No 3D, a tecla C liga e desliga a vista de cima do buraco, e começar a tacada volta a câmera para trás da bola. O percurso novo com as peças que faltam do Minigolf Kit (bifurcação, túnel, crista, cantos de morro, a pista em canaleta) vem depois.

**A DIFICULDADE DO XADREZ (20/11/2026, pedido dele: "adicione dificuldade no xadrez"; resolve a decisão 2, o robô que segurava o servidor ~0,8 s por lance).** O robô da Partida de xadrez tem MOTOR PRÓPRIO (`server/src/xadrez-motor.ts`, nada de terceiro: o Stockfish é GPL). O chess.js foi medido em 3 mil posições por segundo, e por isso o motor tem o gerador dele (0x88, conferido por perft; ~800 mil posições/s). A busca: alfa-beta com aprofundamento iterativo e limite de tempo, tabela de posições, MVV-LVA, assassinos, quiescência, lance nulo e tabelas de casa por peça. CINCO NÍVEIS (`NIVEIS_DO_MOTOR`): Iniciante, Fácil e Normal olham pouco, sorteiam entre os parecidos e às vezes erram de propósito; o Difícil vai a 6 meios-lances em 0,7 s; o Mestre pensa 1,6 s e passa de 9. Medido (`server/scripts/xadrez-niveis.mjs`, 6 partidas por par): cada nível ganhou do de baixo, 6–0, 6–0, 6–0 e 5–1. **A conta roda num worker** (`xadrez-robo.ts`): um só, com fila de 24, tempo máximo e a RESERVA (o servidor joga um lance legal curto se o worker cai, demora ou a fila enche); a mesa joga fora a resposta que chega depois de "voltar" ou "desistir" (`roboAssincrono` e `geracao` em minijogo-tabuleiro.ts). Os outros jogos da mesa continuam com três níveis. Nos PROBLEMAS DE XADREZ entraram a SEQUÊNCIA (Solo: cada acerto um problema mais difícil, o primeiro erro acaba, recorde na tabela comum, variante `sequencia`, só acertos sem dica) e a DICA (o servidor acende a peça que move; nas rodadas não pontua, na sequência não conta, na corrida custa 10 s). Ninguém jogou contra o robô novo com gente.

**A Corrida dos coelhos, a segunda auditoria (20/11/2026):** o CONTROLE DE VIDEOGAME entrou pelo módulo comum `web/src/controleDosJogos.ts` (`lerControle()`: o 1º controle, zona morta, direção e gatilhos analógicos, A/B/X/Y, ombros, Start; o Start pausa em todo jogo da `usePausaComEsc`), somado ao teclado e ao toque (`corrida/controle.ts`): o analógico vira proporcional, RT ou A acelera, LT ou B freia e dá ré, os ombros derrapam, X usa o item, Y olha para trás. A física não mudou (já aceitava volante parcial; o acelerador continua ligado ou desligado, o gatilho vale a partir de 30%). No TOQUE, os ◀ ▶ viraram um VOLANTE (o dedo vira o quanto está longe do meio) e entrou o botão ▼ de frear e dar ré. No contra o relógio, MEDALHAS sobre o tempo do piloto automático (×1, ×1,08, ×1,18; `TEMPO_DO_PILOTO` em `corrida/parciais.ts`) e as PARCIAIS: 4 marcos por volta, a diferença para o meu recorde (ou o mais rápido dos fantasmas marcados) em verde ou vermelho. Contra o computador, o nível MESTRE (`DificuldadeDaCorrida`): teto ×1,04 e empurrão de até +5% no robô que vem atrás de quem joga. Medido na Horta: mestre 0:59.7, piloto 1:00.5, difícil 1:02.3.

**O Estoura-balão, a segunda auditoria (20/11/2026):** o controle de videogame, o botão ▼ de RÉ no toque e a DIFICULDADE dos robôs no Solo, só no site (`balao/robo.ts`, lembrada no aparelho; o médio é o robô de antes, que a sala usa). Medido com o piloto contra três: 14 balões perdidos no fácil, 31 no médio, 30 no difícil; o difícil ficou pouco acima do médio (separar mais é decisão dele). As duas cópias da regra não mudaram.

**Os Coelhos a jato, a segunda auditoria (20/11/2026):** MEDALHAS de ouro, prata e bronze pelo tempo, sobre o do piloto automático de cada pista (`jato/medalhas.ts`), com os fatores comuns de `medalhasDaCorrida.ts` (1, 1,12 e 1,3: chute). A DIFERENÇA a cada volta, verde ou vermelha, contra o meu fantasma (ou o mais rápido dos marcados); as voltas do fantasma saem do próprio caminho dele (`voltasDoCaminho`). O MODO ELIMINAÇÃO no Solo, só no site (`jato/eliminacao.ts`): ao fim de cada volta, menos a última, sai a última nave, com `voltas + 1` naves do computador para a última volta ficar com três; se a pessoa sai, o site manda `explodiu` (sem recorde). O controle de videogame por `jato/controle.ts` (sobre `controleDosJogos.ts`). O servidor não mudou.

**A Regata da toca, a segunda auditoria (20/11/2026):** as MEDALHAS (`barco/medalhas.ts`) e a DIFERENÇA por volta, como no Jato. OS BARCOS DO COMPUTADOR NA SALA: o servidor manda `robos` (6 barcos ao todo menos a turma, `BARCOS_NA_SALA`), e cada computador anda os mesmos barcos no médio. Não tocam ninguém e não entram na classificação, no pódio nem no recorde. O controle de videogame por `barco/controle.ts`.

**Os Carrinhos da toca, a segunda auditoria (20/11/2026):** a DIFICULDADE dos robôs no Solo (`HABILIDADE_DOS_ROBOS`; o médio é o de antes; medido: fácil 9–16% atrás do piloto quase perfeito, médio 3–9%, difícil 0,3–1,8%). As MEDALHAS só nos traçados prontos (`carrinhos/medalhas.ts`, fatores 1,025, 1,08, 1,18). O CAMPEONATO no Solo, só no site: os cinco traçados contra três robôs, pontos 10, 6, 3 e 1; cada corrida vale recorde. A MARCA DA CURVA CHEGANDO (`cena.marcarCurva`, vermelha quando é hora de soltar) e uma vibração curta quando o carro começa a tremer, nunca com "menos movimento". O controle pelo módulo comum: A acelera tudo, o gatilho dá o meio-termo. A regra não mudou.

**O TOQUE, O CONTROLE E A PAUSA NOS CONTRA O RELÓGIO (20/11/2026, a segunda auditoria):** nasceu a base comum de toque, `web/src/toqueDosJogos.tsx`. A ALAVANCA (`Alavanca`, com a conta em `alavancaDosJogos.ts`) dá oito direções de 45°, nos mesmos bits do teclado. O GRUPO DE BOTÕES (`useGrupoDeToque`, `data-toque` em cada botão) acha o botão PELA POSIÇÃO do dedo: o polegar desliza de um para o outro sem levantar, e dois dedos valem juntos. Botão de toque novo nos jogos usa isso, nunca `pointerleave`. A pausa do Solo (`TelaDePausa`) ganhou `aoRecomecar` ("Jogar de novo", tecla R por `useTeclaDeRecomecar`) e `aoSair`, ligados no Rolê, na Gincana, no Pulo e na Torre; nos outros, cada um liga quando o recomeço for honesto com o relógio do servidor. Na Gincana e na Torre, o servidor passou a aceitar correr de novo e voltar à escolha no meio da corrida: a de antes só não conta, e o relógio dele recomeça junto. A Gincana anda na diagonal no celular (a alavanca no lugar das quatro setas), e no Pulo e na Torre o polegar desliza de ◀ para ▶. Teste: `e2e/toque-dos-jogos.mjs` (iPhone simulado).

**O ROLÊ NO CELULAR, NO CONTROLE E O TREINO LIVRE (20/11/2026):** na tela de toque, a alavanca e os quatro botões no losango (manual em cima, flip à esquerda, grab à direita, pulo embaixo); no controle de videogame, A pula, X flip, B grab, Y manual. Tudo vira os mesmos `Comandos` do teclado (`useComandos`); a física e o servidor não mudaram. O TREINO LIVRE, só no Solo e só no site: sem relógio, sem recorde, nada ao servidor (o passo volta 1794 passos antes do fim do minuto, múltiplo do ciclo de 23 da deriva). Limite que sobra: a partida Solo do servidor expira em 11 minutos.

**O PINBALL, A ESQUADRILHA, A ARENA E OS BICHOS NO CELULAR (20/11/2026, a segunda auditoria):** o PINBALL é MULTITOQUE (cada dedo é dono do seu lado pelo pointerId; levantar um solta só o dele) e o TRANCO no toque é o botão do canto de cima (a figura de vibrar), com cada toque guardado até o passo seguinte; a regra das duas cópias não mudou, e a largada das duas mesas cabe em 390 px. Na ESQUADRILHA, o botão do loop (↻) fica ao lado da bomba, com o anel da recarga (`ficha.loops`, `LOOP_RECARGA`, só desenho). Na ARENA, sem dedo mirando, a mira vai no adversário visível mais perto; Q e E são como nas arenas de celular (tocar mira o mais perto; segurar e arrastar a partir do botão mira, com a linha na tela, e soltar dispara), e a largada escolhe o CENÁRIO em figuras ("?" sorteado de fábrica, `corpo.cenario`). Nos BICHOS, segurar a seta da tela anda como a tecla segurada; o botão do golpe mostra ×2 ou ½ contra o bicho da frente (`eficacia`), e o caderno abre com a RODA DOS ELEMENTOS (seis figuras e as setas de `VENCE`). Testes: `e2e/pinball-toque.mjs`, `e2e/bichos-arena-toque.mjs`, `e2e/bichos-toque.mjs` (passaram).

**AS MESAS NO CELULAR E AS PRÉVIAS (20/11/2026, a segunda auditoria):** nas mesas 3D de casa pequena, o toque tem PRÉVIA (`previaNoToque` em `mesa3d/base.ts`): o primeiro toque mostra, o segundo na MESMA casa confirma, e tocar outra casa leva a prévia para lá; o mouse continua com um clique. Ligado no Cinco em linha (a pedra-fantasma da cor de quem joga, também com o mouse) e na Mancala; a Batalha naval faz o mesmo com a mira (`naval3d/cena.ts`). A MANCALA ganhou a prévia da semeadura: com o mouse por cima ou no primeiro toque, acende a cova onde a última semente cai, com o selo ↻ (joga de novo) ou +N (captura), pela mesma conta do servidor em `web/src/mancalaPrevia.ts` (`web/test/mesas-previa.test.ts` confere contra `semear`/`semearOware`). Só no 3D: o 2D de reserva continua com um clique.

**O "COMO JOGAR" DOS OUTROS JOGOS DE MESA (20/11/2026):** Truco, Dominó, Capitais e Sudoku ganharam o "Como jogar" da mesa comum (`ComoJogar` em `MesaComum.tsx`, com a `figura` em cima das frases). O TRUCO mostra a RÉGUA DA FORÇA em cima da mesa, só figura (`contasDasMesas.ts`; o teste confere contra a `forca` do servidor). Nas Capitais, a linha "Com a região inteira" da tabela de aluguel também acende quando é a de agora. No SUDOKU, cada botão de 1 a 9 diz quantos faltam, e o número que fechou se apaga (no "conferir no fim" só esmaece).

**TOCAS E TORRES, OS ATALHOS (20/11/2026, só tela; a simulação não mudou):** Ctrl+número (ou Shift+número: no navegador, Ctrl+1…9 troca de aba) guarda a seleção; o número a chama, e duas vezes seguidas leva a câmera até ela. O ponto (.) passa pelos trabalhadores parados. Cada botão do painel tem uma letra, mostrada no canto e escondida no toque (`LETRA_DO_PREDIO`, `LETRA_DA_UNIDADE`). Os grupos não aparecem na tela e não passam de uma partida para outra.

**A FESTA NO SOLO, COM ROBÔS, E AS RODADAS (20/11/2026, a segunda auditoria dos mini-games):** sozinha, a pessoa jogava contra ninguém (levava os 10 pontos de toda rodada, e os microjogos de contato nunca saíam). Agora o Solo escolhe na largada de 1 a 5 robôs (a última escolha lembrada no aparelho), que jogam pela mesma rodada do Tabuleiro da turma; com eles, os microjogos de 2 ou mais entram no sorteio. Contra o computador não há troféu; há o RECORDE DO SOLO na tabela comum (jogo 'festa', variante `r<rodadas>-<robôs>`), com os pontos somados pelo servidor. Sem robôs, a festa de antes, sem recorde. As RODADAS (5, 10 ou 15) se escolhem na largada, no Solo e na sala. O RELÂMPAGO ganhou o recorde do Solo (acertos contados pelo servidor, jogo 'festa-relampago') e o AVISO DE ACELERAÇÃO a cada 5 acertos (raio, setas, clarão, som do turbo; só tela).

**A PONTE, A ESCOLHA DA FASE (20/11/2026):** no Solo, a montagem começa da última ponte daquela fase, lembrada NO APARELHO (`web/src/ponte/escolha.ts`; a que a regra não aceita é esquecida). Na sala, começa vazia (quem treinou no Solo não chega com a ponte pronta; a confirmar com ele). Os botões da escolha mostram a marca de dificuldade (1 a 3 martelinhos, `DIFICULDADE_DAS_FASES`, chute; fase nova precisa da linha, o teste cobra) e, no Solo, os selos e o custo do recorde (`GET /api/minijogos/ponte/recordes`). Os ids e a regra não mudaram.

**O RINGUE, A FÚRIA E O "COMO JOGAR" (20/11/2026):** no último round, ou com menos de um terço da vida, o adversário entra na FÚRIA, uma vez por luta: golpes novos (o ligeiro, a cadeia de três; o pesado, a pancada de baixo; o trapaceiro, o gancho emendado) e menos espera. Mudou a regra nas duas cópias; até a fúria, a luta é a de antes, passo a passo. O "Como jogar" são três quadros desenhados (brilho, esquiva e contra-ataque, estrela). Os botões ▼ e ▲ passaram a "Abaixar" e "Defender".

**A BRIGA, A DIFICULDADE DO SOLO (20/11/2026):** fácil, normal ou difícil, só no Solo, tudo no servidor (`AJUSTE_DA_DIFICULDADE`: vida e dano ×0,7/×0,65 e ×1,3/×1,3, quantos na tela −1/+1, janela do aviso ×1,3/×0,8, nunca abaixo do dobro da folga de 200 ms). O recorde é por fase E dificuldade: o normal continua na variante de sempre (os recordes antigos valem); os outros em `<fase>@facil` e `<fase>@dificil`. Números chutados.

**AS VARIANTES DAS MESAS (20/11/2026, o lote C da segunda auditoria):** cada variante é uma escolha da largada, a regra de fábrica continua a de sempre, e o robô joga a variante. O CINCO EM LINHA ganhou a CAPTURA (`captura`: a pedra que fecha X O O X tira as duas do outro, nas oito direções; cinco capturas também vencem; a mecânica de domínio público, com nome nosso) e a RESTRIÇÃO 3-3 (`tresTres`: as escuras não põem a pedra que faz dois três abertos, a não ser que feche o cinco); a tela mostra as capturas ao lado do nome e marca as casas tiradas. As DAMAS ganharam a pedra que não come para trás (`paraTras: false`). A BATALHA NAVAL, os MARES de 8 × 8 (frota 4, 3, 2, 2) e 12 × 12 (5, 4, 4, 3, 3, 2, 2), em `MARES` nas duas pontas (`minijogo-naval.ts` ↔ `naval3d/montagem.ts`). O DOMINÓ, as BATIDAS ESPECIAIS (`especiais`): carroça ×2, lá-e-ló ×2 e a cruzada ×4 (a carroça do número que está nas duas pontas; mantida por ele). O TRUCO MINEIRO (`variante: 'mineiro'`): sem vira, manilhas fixas 7♦ < A♠ < 7♥ < 4♣; e vale a CONTAGEM MINEIRA (decisão dele): a mão vale 2, e o truco, o seis, o nove e o doze valem 4, 8, 10 e 12 (`contagemDa` em `minijogo-truco.ts`; a tela tira o grito do DEGRAU em `valoresDaMao`, nunca do número); no lugar da mão de onze, a MÃO DE DEZ (joga valendo 4 sem truco, ou corre e dá 2; com as duas em 10, a mão de ferro vale 2; por dentro a fase segue `mao-de-onze`). O paulista não mudou. Dominó e Truco abrem a escolha nas duas abas (`EscolhaDasCartas.tsx`). Testes: `server/test/minijogos-variantes-das-mesas.test.ts` e `web/test/mesas-variantes.test.ts`.

**O PULO DO COELHO, AS MEDALHAS (20/11/2026, lote C):** ouro, prata e bronze por fase sobre o tempo do piloto automático (`TEMPO_DO_PILOTO_DO_PULO`, fatores 1; 1,25; 1,6; o teste confere: mexeu na fase ou na física, medir de novo). Só tela.

**A COPA DO CELEIRO (20/11/2026, lote C):** na sala, as cinco torres seguidas (`COPA_DO_CELEIRO`, `TORRES_DA_COPA` em `server/src/torre.ts` ↔ `web/src/torre/fases.ts`), com 10 s de placar entre uma e outra; a ordem é quem subiu mais torres e, empatados, a soma menor; o pódio (`pista: 'copa-do-celeiro'`) só de quem subiu as cinco, com 2 ou mais. No Solo, não há copa.

**CAPITAIS, O BRASIL INTEIRO E AS NOTÍCIAS NOVAS (20/11/2026, lote C da segunda auditoria):** na largada escolhe-se o tabuleiro: as 20 capitais de sempre (32 casas, o de fábrica) ou o BRASIL INTEIRO (`CASAS_DO_BRASIL`, `corpo.tabuleiro: 'brasil'`): as 27 capitais numa volta de 40 casas, em 9 grupos por região, com o prédio pelo grupo (`CUSTO_DO_PREDIO_NO_BRASIL`). A regra, a partida rápida e os robôs servem aos dois. A volta mora em `web/src/cidadesVolta.ts`, a mesma conta para o desenho de reserva e o 3D (que cresce por `definirVolta`). As NOTÍCIAS foram de 13 para 31, todas nossas, entre elas a TEMPORADA (os aluguéis de um grupo ×2 ou ½ por uma rodada), o MUTIRÃO (prédio grátis), as OBRAS, o IPTU, os turistas e o PERDÃO da hipoteca mais cara. A região aparece pelas siglas, que não se traduzem. Números chutados. Testes: `server/test/minijogos-cidades-brasil.test.ts`, `web/test/cidades-volta.test.ts`; `BRASIL=1 node e2e/cidades-3d.mjs` passou.

**O SUDOKU PELA TÉCNICA E O SUDOKU X (20/11/2026, lote C da segunda auditoria):** a dificuldade passou a ser a TÉCNICA que o tabuleiro pede (as casas vazias viraram o mínimo). O resolvedor lógico (`server/src/sudoku-logica.ts`, `nivelDoTabuleiro`) tenta a mais simples primeiro: singles nus, escondidos, casas travadas e pares, X-wing. Fácil só com singles nus, Médio pede os escondidos, Difícil pede pares ou casas travadas, Muito difícil o X-wing; o que pede chute nunca sai. O tabuleiro de X-wing é raro (~0,7 s de processador), e por isso Difícil e Muito difícil saem de uma RESERVA na memória (2 de cada, clássico e X, enchida em fatias de ~8 ms a partir de 30 s depois de o servidor subir); vazia, gera na hora com prazo de 150 ms e fica com o mais perto do pedido. O SUDOKU X (as duas diagonais também valem) é escolhido na largada ("Regra"), com as diagonais riscadas e o recorde à parte (variante com `:x`). Testes: `server/test/sudoku-tecnica.test.ts`.

**O STOP, A SEGUNDA AUDITORIA (20/11/2026, lote C):** com dois jogadores, "mais da metade dos outros" era um voto só, e qualquer um derrubava a resposta do outro. Agora, com dois, a resposta só cai com AS DUAS PARTES: o outro contesta e quem escreveu ACEITA (a ação `aceitar`, que se desfaz). Em qualquer tamanho de turma o aceite de quem escreveu derruba, e com três ou mais continua a maioria. O BÔNUS DO STOP: quem apertou STOP ganha +10 (`BONUS_DO_STOP`) se, depois da conferência, todas as respostas dele ainda valerem.

**O DESENHA E ADIVINHA E OS QUIZZES, A LARGADA (20/11/2026, lote C):** quem começa o Desenha e adivinha escolhe as rodadas (1 a 3) e o tempo de cada desenho (45, 60, 80 ou 120 s; vale para as dicas e os pontos por rapidez). Os quizzes escolhem 1, 3 ou 5 rodadas (os Monstros ganharam o "Começar"); o recorde do Solo de 3 rodadas fica onde estava, e 1 e 5 têm o deles na tabela comum (variante `@1`, `@5`).

**O TABULEIRO DA TURMA, AS EQUIPES IMPOSTAS (20/11/2026, lote C):** o Cabo, a Torta, o Revezamento e o Esconde-esconde ACEITAM as equipes do Tabuleiro (`aceitaEquipes`, `impostas` em `festa/lote4-turma.ts`), e os robôs jogam dentro do microjogo num ritmo fixo. O Cabo é pela média de cada lado, e a Torta tem o tamanho da equipe (45 mordidas por pessoa); Revezamento e Esconde-esconde só no 1 contra 3. Listas: 2×2 colheita, remada, torta, cabo; 1×3 onda, ladeira, torta, cabo, revezamento, esconde. Teste: `server/test/festa-equipes-impostas.test.ts`.

**O FUTEBOL, A SEGUNDA AUDITORIA (20/11/2026, lote C):** a MINI-COPA do Solo virou MATA-MATA: perdeu, acabou, e o empate vai aos PÊNALTIS (`web/src/futebol/penaltis.ts`, `CobrancaDePenaltis.tsx`, só no site, como a copa): canto e força numa barra que vai e volta; o goleiro robô acerta o lado de 30% a 46%, mais a cada jogo; na vez do robô, escolhe-se para onde pular; cinco para cada lado, depois as alternadas. NA SALA, quem começa escolhe o TEMPO (2, 3 ou 5 minutos) e o GOL DE OURO (prorrogação de 1 minuto em que o primeiro gol vence; sem gol, empate), nas duas cópias da simulação (`duracao`, `golDeOuro`, `prorrogacao`; o fim mora em `marcarGol`). O Solo continua em 3 minutos.

**O MICROFONE NO LOBISOMEM (20/11/2026, decisão dele: "Lobisomem pode mutar sim").** Como no jogo de mesa: DE NOITE (as duas etapas) o microfone de todos os jogadores da partida fica desligado e volta no amanhecer, e QUEM SAIU DO JOGO fica só ouvindo até o fim. Quem só assiste à sala nunca é calado. **A trava é a permissão do LiveKit** (`server/src/silencio-do-jogo.ts`), lida por `permissaoNaSala` como o microfone travado pela moderação: sai o microfone e o "som da tela" (senão o microfone sairia pelo console como som de transmissão), e ficam a câmera e a tela. Cada mudança vai por `updateParticipant`, com o `mutePublishedTrack` da faixa aberta, e o token de quem sai e volta já nasce sem o microfone. O jogo manda o mapa inteiro pelo `ctx.silenciar` (no motor); no Solo, nada. **Ninguém fica mudo para sempre:** o fim, o `parar`, o `encerrar`, a partida trocada e o erro do jogo soltam a sala; o silêncio tem um teto de 10 min sem renovação; e o que está mudo fica no kv (`silencio-do-jogo`), para o servidor que caiu no meio da noite devolver o microfone ao voltar. Sem o LiveKit, o jogo segue sem mutar, com uma linha no log. No site (`useVoice.ts`), o app desliga o próprio microfone e o religa no amanhecer SÓ se estava ligado antes (a exceção ao "soltar não liga nada" da moderação: quem desligou foi a partida). O palco, o botão do microfone e o painel do jogo dizem "Noite: microfones desligados" ou "Fora do jogo: só ouvindo". Testes: `server/test/lobisomem-microfone.test.ts`, `server/test/lobisomem-microfone-permissao.test.ts`; `e2e/lobisomem-microfone.mjs` escrito, não rodado.

**OS BICHOS DA TOCA, o lote C da segunda auditoria (20/11/2026):** **a toca tem saída**: na porta de casa (`naToca` em minijogo-bichos.ts) se leva um guardado para a equipe, se guarda um da equipe (fica ao menos um), se troca um pelo outro e se solta um guardado de volta ao mato (com a pergunta antes); quem sai da toca sai descansado, e o servidor confere. **O caderno fecha** (`alcancaveis` em bichos-regras.ts, e o teste cobra que são todas as espécies): os do começo não escolhidos aparecem raros (8%) no mato da Serra depois da escada inteira, antes de crescer, e cada revanche vencida faz a Nena dar o próximo bicho dela que falta (`PRESENTES_DA_REVANCHE`, no nível 30). **A experiência se reparte**: quem entrou na luta contra aquele bicho e está acordado divide, quem ficou na equipe sem lutar leva 20% (`PARTE_DE_QUEM_NAO_LUTOU`). **O golpe novo é escolhido**: cada bicho guarda os golpes dele (`golpes`; a aventura antiga recebe os últimos 4); com 4 sabidos, o golpe espera na fila `aprender` e a pessoa diz qual esquecer, ou não aprender (vale no meio da luta). **O chá cura uma parte** (35%, o forte 75%; eram 20 fixos), e **a lojinha tem escada** (`LOJA_ABRE`): a erva-doce (tira o cochilo e o veneno) com 1 desafiante vencido, o chá forte com 2, a cenoura dourada (dobra a chance, mínimo 1 em 4) com 3. **O mato do Bosque e da Serra é esperto** (`esperto` no mapa). **A mesa da sala é justa**: na largada cada um escolhe até 3 bichos da equipe e da toca (`MONTAGEM_MS`, 30 s), todos crescidos (`formaCrescida`) no nível da sala, e cada escolha tem 30 s (eram 60). Os números são chute: ninguém jogou com gente. O JSON da aventura (já no "Levar seus dados") guarda também os golpes de cada bicho. Testes: `server/test/minijogos-bichos.test.ts` e `web/test/bichos.test.ts`.

**AS LENDAS, OS GRUPOS SORTEADOS, O ACELERAR E O GOLPE FINAL (20/11/2026, lote C da segunda auditoria):** cada parada de luta sorteia o grupo pela semente (`grupoDaParada`, depois do caminho, para o caminho de cada semente não mudar): de 2 a 4 bichos do `bando` dela, e com chefe ele e mais 1 ou 2 (o castelo sempre com 2). A vida e o golpe de cada bicho são escalados para o grupo ter a força do grupo de antes (`FORCA_POR_TAMANHO`, medido), e a neve continua a parada mais forte. No Solo, o BOTÃO DE ACELERAR (▶️/⏩) toca a rodada, o mapa e as paradas na metade do tempo (o servidor manda o `ritmo`; a tela, `definirRitmo`). O GOLPE FINAL é a quarta habilidade de cada classe, no nível 3 (o nível com que a turma chega ao castelo): a Investida do Escudo (deixa tonto), a Chuva de estrelas da Faísca (magia em todos), o Florescer da Erva (metade da vida a cada um, levanta quem caiu) e a Flecha final (não erra e atravessa a pedra); os robôs também usam. A turma de robôs vence 78% em 600 sementes (eram ~81%).

**A ARENA, O FIM COM PRESSÃO, A DIFICULDADE E AS VITÓRIAS SEGUIDAS (20/11/2026, lote C da segunda auditoria):** no último minuto (`ZONA_FINAL`, nas duas cópias de `conta.ts`), as zonas vêm a cada 3,5 s e com raio 70 (eram 7 s e 50); o relógio fica vermelho e aparece "Último minuto!" com o alarme. No Solo, a largada escolhe a DIFICULDADE dos robôs adversários (`ROBO_DA_ARENA`); o médio é o robô de antes, número por número, e é o da sala e o dos aliados no 3×3. Medido contra o piloto com 3 robôs: fácil 11 de 12, médio 8, difícil 5. O RECORDE do Solo são as VITÓRIAS SEGUIDAS, contadas pelo servidor, que moram só na memória (perdem-se com 30 minutos parada, sem calendário), na tabela comum (`bichos-arena`, variante dificuldade:adversários[:zona]).

**O CHEFE, a segunda auditoria (20/11/2026, lote C):** o **GOLPE DE PÁ** (Z/K, ou o ⚒ no toque) é de perto e fraco: 1 de dano, sem o dobro da tonta, recarga de 450 ms, e só pega o chefe TONTO ou PARADO; o servidor confere pelo passado do chefe, como o torrão (`PA`, `apanhaDaPa`, `paPega` nas duas cópias de `chefe/conta.ts`). No Solo há a **MARATONA** (a toupeira e, sem parar, o yeti: seis fases; a etapa em `c[10]`) e o **DIFÍCIL** (a vida da sala e os avisos 20% mais curtos, `AVISO_DIFICIL`; o mais curto cai para ~0,7 s). Recorde por variante na tabela comum (`varianteDoChefe`): `''` e `yeti` continuam valendo, e entram `maratona`, `dificil`, `yeti-dificil` e `maratona-dificil`. Na sala, a toupeira de sempre.

**A CAÇA, a segunda auditoria (20/11/2026, lote C):** a **JOANINHA** é o bicho amigo que não se atira: da 2ª onda em diante (duas a partir da 4ª), no FIM da lista do sorteio (as pragas são as mesmas de antes); acertá-la custa 200 pontos (nunca abaixo de zero), zera o combo e tira a onda perfeita. A **RODADA BÔNUS** entre a 3ª e a 4ª onda: 14 cenouras lançadas para cima, sem limite de munição, sem combo. As duas nas duas cópias do voo (`sortearBonus`, `ehAmigo`, `ehPraga`). O recorde do Solo passou para a tabela comum (`'caca'`, variante `'bonus'`); o `caca_recordes` de antes fica guardado e não se compara.

**A ESQUADRILHA, a segunda auditoria (20/11/2026, lote C):** o **RASPÃO**: o tiro inimigo que passa a até 10 do centro da nave sem acertar, e já se afastando, vale 25 pontos, uma vez por tiro, com uma faísca azul. A Ficha confere (`['r', q, j, x, y]`: o tiro saiu de verdade, a posição é possível, a nave não estava piscando nem no loop). Os recordes não ganharam variante (decisão dele, confirmada em 21/11/2026).

**O PLANADOR, a segunda auditoria (20/11/2026, lote C), só desenho:** o **VARIÔMETRO** no painel; o **ANEL NO CHÃO** debaixo do coelho abaixo de 30 m, verde, amarelo ou vermelho pela mesma régua que decide a batida (no paraquedas fechado, sempre vermelho); o **MAPA** no alto da tela com o alvo, os anéis (o próximo em amarelo, o PERDIDO piscando em vermelho) e a LINHA DE RUMO de cada fantasma (`planador/render.ts`).

**O TRÂNSITO, O TETO DOS 5 MINUTOS E A AMBULÂNCIA COM PRESSA (20/11/2026, lote C da segunda auditoria):** no "até bater", as chegadas apertavam até os 50 s e a velocidade até os 2 min, e o resto da partida era igual. Agora as duas continuam subindo devagar até os 5 minutos (`ritmoDaChegada`, `velocidade`, `PASSOS_DO_TETO`), e o minuto não mudou (o teste confere ponto a ponto). Os recordes do "até bater" recomeçam em `ate-bater-5min-<mapa>`; os antigos ficam em `ate-bater-<mapa>`, que ninguém mais oferece. **A ambulância traz um relógio em cima**: solta em até 4 s vale 3, até 7 s vale 2, até 10 s vale 1; passados 10 s, custa 2 pontos e depois não vale nada (`valorDaAmbulancia`, nas duas cópias; o servidor refaz). O recorde do minuto ficou na variante dele. O piloto aguenta 6 minutos sem batida; os números são chute.

**A PACIÊNCIA DA COZINHA (20/11/2026, lote C da segunda auditoria):** cada pedido tem um prazo desde que apareceu na fila, de 60 s (o sorvete) a 90 s (as pizzas), pelos pontos da receita (`prazoDoPedidoMs`, nas duas cópias). Vencido, sai, entra o próximo e custa 5 pontos (`PENA_DO_PEDIDO_PERDIDO`, nunca abaixo de zero), pelo relógio do servidor (o `vencer`, antes de cada ação, ao montar o estado, no fim e na conferência das rotas a cada 4 s). A comanda tem a barra da paciência, e a vencida some da tela sem esperar o servidor. O piloto entrega 7 a 11 pratos e perde 1 a 4 (o teste cobra todas as plantas). Os recordes por planta RECOMEÇARAM (decisão dele, 21/11/2026) em `cozinha-paciencia` (`JOGO_DO_RECORDE`); os de antes ficam em `cozinha`, sem comparar.

**A CURVA DO "QUAL É O TAMANHO?" (20/11/2026, lote C da segunda auditoria):** as rodadas 1 a 3 pedem razão de 4× a 20× com a referência entre os objetos conhecidos (`CONHECIDOS`), as 4 e 5 de 2,5× a 8×, e as 6 a 8 de 1,5× a 3× (`faixaDaRodada`, `sortearPar(..., rodada)`); o sorteio afrouxa em degraus, e a categoria pequena nunca fica sem rodada.

**A música para na pausa (20/11/2026, lote C da segunda auditoria):** a pausa comum (`usePausaComEsc`) marca em `musicaDosJogos.ts` cada pausa aberta (`marcarPausaDoJogo`), e a música cala enquanto houver uma, sem mexer em nenhum Jogo*.tsx.

**O LOTE D DA SEGUNDA AUDITORIA, ONDA 1 (21/11/2026, "pode seguir para D"):** seis agentes, um por grupo de jogos; ninguém jogou nada disso com gente (os números são chute medido contra os pilotos).

**A BRIGA, O GOLPE DE CADA CHEFE E O ELEMENTO DE CADA FASE (21/11/2026, o lote D da segunda auditoria):** os chefes novos dividiam a rajada; agora cada um tem a sua (`golpe` em `briga-fases.ts`, as duas cópias). O **rei-cogumelo** solta ESPOROS: o círculo pisca debaixo de cada coelho e estoura. A **alpaca-rei** dá o COICE: vira de costas para quem está perto e chuta quem ficou atrás. O **yeti** bate no chão e a ONDA DE CHOQUE corre em anel achatado; quem pula por cima escapa. O **dragão** fica com a rajada. Esporos e onda vêm um ataque sim, um não, pelo número do ataque, sem sorteio novo. Cada fase ganhou UM elemento de cenário, decidido pelo servidor como os bichos (`el` no quadro): o **TRONCO** da floresta (a linha pisca na faixa de alguém e ele rola de borda a borda, derrubando coelho e bicho), o **RODAMOINHO** de areia do deserto (anda pela arena e empurra quem encosta), as **PLACAS DE GELO** da neve (o coelho escorrega; é a física do próprio coelho, só no site, nunca acima da velocidade normal) e as **GRADES DE ESPINHOS** do castelo (piscam e sobem em ciclo, pegam coelho e bicho, nunca o chefe). A horta continua sem nada. Os estados novos entram no FIM das listas. Números chutados, medidos contra o piloto, que vence as cinco fases. Testes: `server/test/minijogos-briga.test.ts`, `web/test/briga.test.ts`.

**O COMANDO, A NEVE, A ALPACA-REI E O FIRMAR (21/11/2026, o lote D):** cada fase tem as suas TÁBUAS e as suas GAIOLAS (`PLATAFORMAS_DA_FASE`, `REFENS_DA_FASE` em `comando/conta.ts`, as duas cópias). As do deserto e da neve têm DEGRAUS, e toda arena tem uma tábua; a floresta ficou com as de sempre. O quadro diz a fase (`mp`). A **TERCEIRA FASE, a NEVE**, vem das folhas da Briga: o macaco, o espinhento e o pombo no ar, com o yeti de chefe e a vida de chefe (a vida sai da onda, não do tipo). A campanha são as três. O **deserto tem o chefe dele, a ALPACA-REI**: o CUSPE (três marcas piscam e as bolas caem nelas em arco; as balas ganharam gravidade) e a INVESTIDA rente ao chão, de que a tábua salva. O **yeti** ganhou a AVALANCHE: pedras penduradas sobre a turma caem depois do aviso. Cada chefe tem a sua roda (`RODA_DO_CHEFE`), e o dragão da floresta não mudou. O **FIRMAR**: segurando Q ou Shift (no toque, o ⌖), o coelho não anda e as setas só miram, com as diagonais para baixo também no chão. Os botões de toque passaram ao grupo comum (`useGrupoDeToque`). O recorde do Solo: a floresta continua 'floresta'; o deserto mudou e vira 'deserto-2', a neve é 'neve' e a campanha 'campanha-3'. O yeti segue de subchefe no deserto: trocar é decisão dele. Números chutados; o piloto vence as três fases em 8 de 8 sementes. Testes: `server/test/minijogos-comando.test.ts`.

**A Corrida dos coelhos, a terceira copa e a pista que mexe (21/11/2026, o lote D):** a **Copa do Milho** com três pistas novas
por tema, ids novos (as seis de antes não mudaram): a **Fazenda** (`fazenda-1`, girassóis), o **Brejo** (`brejo-1`, terra molhada
e três lagoas, pista de 28) e o **Vulcão** (`vulcao-1`, cinza, pedras e lagos de lava: `Tema.lago`). **A Fazenda é a pista que
mexe: as PORTEIRAS** (`porteiras` na definição, `ladoFechado` em `corrida/pista.ts`): cada uma fecha UMA metade da pista de cada
vez, num ciclo de 240 passos, pelo PASSO da corrida de cada um — no mesmo passo estão iguais em todo computador, e quem vê os
outros no mesmo passo vê a porteira igual a eles. Sempre há uma metade aberta; a folha fechada é parede naquele passo, quem já
estava em cima passa, e a toca passa por baixo. A folha que vai fechar pisca no último meio segundo. O piloto automático e os
robôs miram a metade que estará aberta na chegada (`desvioDaPorteira`). O servidor não conhece as porteiras, como não conhece o
chão: o fantasma de quem bate só fica mais lento. Pista sem porteira roda a conta de sempre (o tempo do piloto nas seis antigas
é o mesmo). Medidas em `PISTAS` (server/src/corrida.ts), a copa em `COPAS` dos dois lados, as medalhas em `TEMPO_DO_PILOTO`.
Equilíbrio chute: ninguém jogou.

**A TELA EM 640 × 360 E A CAIXA EM FATIAS (26/11/2026, decisão dele, depois do piloto em `e2e/sprite-stacking/`: "em 640 ainda
mantém a estética de Super Nintendo, mas melhora a legibilidade").** O sprite stacking (fatias empilhadas) foi testado no cenário
inteiro e ficou SÓ NA CAIXA DE ITEM ("de resto o ganho é marginal"): a árvore torneada vira bolha, o pinheiro perde os andares, a
cenoura vira ovo. A caixa é um cubo com a figura de sempre nas faces, o tampo liso de tábuas e o miolo de madeira, 1,6× a figura,
virada com a fileira (`web/src/corrida/caixaEmFatias.ts`, montada uma vez por ângulo e distância e guardada; no balão, do tamanho
do kart). **Em 320 × 180 ela virava mancha de longe, por isso a tela da Corrida e do Estoura-balão passou a 640 × 360**
(`ESCALA_DA_TELA` em `corrida/render.ts`): o chão, o céu e a caixa ganham pixels, as figuras de frente continuam com os delas,
ampliadas. **O painel desenhado na tela (mapa, semáforo, pausa, faíscas, chuva, retrovisor, quadro do item) é feito na medida de
antes, `TELA_W × TELA_H`, com o contexto ampliado** — nos dois `laco.ts`, `W` e `H` são esses 320 × 180 (importados com apelido);
o canvas usa os 640 × 360. O Planador pega o céu da corrida na medida antiga (`prepararDesenho(…, true)`). Regata e Jato têm motor
próprio e ficaram em 320. Medido: o quadro inteiro de ~1 para ~2,5 ms (quase tudo o chão). `localStorage['syden.caixaFatias'] =
'nao'` volta à figura de frente. Auditoria: `e2e/caixa-em-fatias.mjs`, duas rodadas reprovadas (a caixa grande e em "gaiola", depois
ilegível em 320) antes de passar. Ninguém jogou com gente.

**A Regata da toca, a segunda copa (21/11/2026):** três pistas novas, a **Represa** (`represa-1`, lago frio da manhã, slalom e
rampas; 3 voltas, ~70 s no piloto), a **Corredeira** (`corredeira-1`, correntezas fortes e três pontes) e o **Igarapé**
(`igarape-1`, água verde no fim da tarde), e a **Copa da correnteza**, só no site como a primeira. Medidas em
server/src/barco.ts e as medalhas em `barco/medalhas.ts`.

**Os Coelhos a jato, os perigos (21/11/2026):** `perigos` na definição da pista (`jato/pista.ts`), pelo PASSO da corrida: o
**METEORO** cruza a pista de um lado ao outro e volta (encostar cobra 8 e deixa metade da velocidade) e o **LASER** corta a pista
inteira, liga 50 de 200 passos e pisca antes (cruzar ligado cobra 12 e deixa 40%), com respiro de 0,6 s. Duas pistas novas com
eles, os **Asteroides** (`asteroides-1`, 5 meteoros) e a **Avenida neon** (`avenida-1`, 4 lasers), e a **Copa dos perigos** no Solo.
**As cinco pistas de antes ficaram sem perigo, de propósito**: a física delas não muda e os recordes valem; pôr perigo nelas pede
id novo (`cidade-2`…) e é decisão dele. O servidor não conhece os perigos (como não conhece a borda); as naves do computador
não os levam (o caminho delas é calculado na largada). O piloto automático foge do meteoro e espera ou acelera no laser.

**A ESQUADRILHA, o lote D (21/11/2026):** cada fase curta ganhou o SEU BICHO: a MARIPOSA só no pomar (desce dando voltas, dois a dois,
soltando o pó em leque; 250 pontos) e o MORCEGO só no celeiro (bandos de três mergulhando em V de um lado ao outro, o leque no fundo do
mergulho; 200). Saem de um sorteio À PARTE (`bichosDaFase` nas duas cópias de `nave-sim.ts`): as ondas de antes são as mesmas, e a horta
não mudou. A CAMPANHA (`'campanha'`): as três fases numa partida só, com o placar somado pela mesma Ficha; o chefe do meio tem 30 s
(`CAMPANHA_CHEFE`) e só o último fecha a partida; o chão troca com o trecho (`faseNoPasso`) e o nome da fase aparece num letreiro.
Recorde do Solo na tabela comum (variante `'campanha'`). Os recordes do pomar e do celeiro RECOMEÇARAM (decisão dele, 21/11/2026) em
`pomar-2` e `celeiro-2` (`VARIANTE_DO_RECORDE` em minijogo-nave.ts); os de antes ficam guardados, sem comparar.

**A CAÇA, o lote D (21/11/2026):** duas PRAGAS NOVAS no fim da lista do sorteio, nas duas cópias do voo: a TOUPEIRA (da 2ª onda; sai da
terra no mesmo lugar, olha e se esconde; 175) e a MOSCA (da 3ª; pequena, rápida, em zigue-zague apertado; 200). Contam na onda perfeita
e na munição (`todasAsPragasDaOnda`). O modo "ATÉ ERRAR TRÊS", só no Solo (`categoria: 'tres-erros'`): as ondas não acabam, sem limite de
munição e sem rodada bônus; tiro no vazio ou na joaninha é erro, o terceiro acaba a partida, e uma onda inteira sem tiro também. O recorde
das cinco ondas recomeçou na variante `'pragas'` (a `'bonus'` fica guardada; a nova fica, decisão dele, 21/11/2026); o do modo novo é `'tres-erros'`.

**O RINGUE, o lote D (21/11/2026):** o SEGUNDO CIRCUITO, escolhido na largada (`corpo.circuito`, nas duas abas), com três adversários
novos de folhas da Briga, cada um com um padrão: o DANÇARINO (diabinho; nunca fecha a guarda alta e troca o lado dela no ritmo dele, a
cada 18 passos: campo `danca`, sem sorteio), o ESPINHO (cacto; o contra-golpe: o soco na guarda é respondido na hora, e ele fecha depois
de dois) e o CAMPEÃO (alpaca-rei; cadeias de três em que só o último golpe brilha, fintas, e na fúria a de quatro). A regra nas duas
cópias (`CIRCUITOS`, `adversarioDe`, `novaLuta(semente, circuito)`); o primeiro circuito é o de sempre, passo a passo. O recorde do
segundo vai à tabela comum (`'ringue'`, `'circuito-2'`, o resultado inteiro no extra); o do primeiro continua em `ringue_recordes`.

**O PINBALL, o lote D (21/11/2026):** o MODO FINAL: cumpridas as seis missões do ciclo (cada uma pelo menos uma vez, em qualquer ordem e
bola), por 30 s com bola em jogo tudo vale ×3, a toca acende e a bola fica salva; as missões param, e ele acaba no prazo ou quando a bola
cai, com o ciclo recomeçando do zero (`feitas`, `final`, `comecarFinal`/`acabarFinal` nas duas cópias). Na tela, o aviso, e no lugar da
missão a coroa e a barra do prazo. O piloto automático não chega a ele (nunca cumpre as seis); a partida continua acabando pelas bolas.

**AS LENDAS, OS NÍVEIS DE DESAFIO E AS PEÇAS COM EFEITO (21/11/2026, lote D da segunda auditoria):** quem começou escolhe o DESAFIO na tela das classes (no Solo, a pessoa; `corpo.desafio` também vale na largada), de 0 a 3 e somados: inimigos mais fortes (`FORCA_DO_DESAFIO`), a fogueira e o levantar depois da luta curando menos, e todo inimigo se curando no fim da rodada (`REGENERA_NO_DESAFIO`). O chefe enchendo o fôlego mais vezes foi tentado para o 3 e deixou MAIS FÁCIL (ele perde a vez preparando). Medido com a turma de robôs, 300 sementes: 79%, 60%, 47% e 23%. O recorde do Solo é por nível (variante `desafio-N`; o 0 continua na de sempre). Uma peça em cinco traz EFEITO (`EFEITO_DA_PECA`): a arma de seiva cura quem bate, a armadura de reflexo devolve parte do golpe (o acontecimento 'reflexo'), o amuleto de fôlego dá uma energia a mais por rodada; ela vale metade no número, para a turma de robôs vencer como antes (com o número cheio, 86–89%). O golpe final do lote C ficou como estava. Testes: `server/test/minijogos-lendas.test.ts`.

**OS BICHOS, A GRUTA E A LIGA DA TOCA (21/11/2026, lote D):** a GRUTA (`MAPAS.gruta`, `escuro`, desenhada por código: chão de pedra, fungos que brilham, lago escuro) fica pela borda da direita da Serra, com o mato de 26 a 33, três bichos que só moram lá (Luzeta, Cristalim, Lodim, as folhas da Briga recoloridas, e as formas crescidas Luzerna e Cristalão), Remi e Zaya no caminho e a porta da LIGA (`liga` no mapa, `LIGA` nas regras). A Liga só abre com a escada inteira: quatro lutas SEGUIDAS (Juno, Kai, Ariel e Sasha, níveis 34 a 41), sem descanso no meio (o "continuar" começa a próxima com a vida que sobrou; o chá vale dentro da luta); perder volta para casa e a Liga recomeça. A Liga inteira dá 500 moedas e conta em `ligas` na aventura (já no "Levar seus dados"). Os nomes são próprios, iguais em todo idioma. Os níveis da Liga são chute: ninguém jogou com gente. Testes: `server/test/minijogos-bichos.test.ts`.

**A ARENA, A MARCA DE CADA ESPÉCIE E AS ONDAS (21/11/2026, lote D):** o especial continua com a forma do elemento, e o bicho da frente traz a MARCA dele (`MARCA_DA_ESPECIE` nas duas cópias de `conta.ts`): forte (mais dano), seiva (cura quem usa), casca (leva menos dano por 3 s), pressa (o rápido do suprimento) e fôlego (o especial volta com uma parte). Só o dano e o que acontece a quem usa mudam, porque a forma, o alcance e o raio são o que a tela dos outros desenha; o servidor aplica, e a figura vai no botão do especial. AS ONDAS, só no Solo (`objetivo: 'ondas'`): a pessoa sozinha ou com dois aliados contra ondas de robôs (`onda(n)`: 1, 1, 2, 2, 3, 3, 4…, fáceis, médios e difíceis, duas vidas da 8ª em diante), com 3 s de pausa e um pouco de vida entre elas; o recorde é a ONDA ALCANÇADA (tabela comum, `ondas` ou `ondas:3x3`), contada pelo servidor. O piloto, com 200 ms, chegou à 6ª em 5 minutos. Testes: `server/test/minijogos-bichos-arena.test.ts`.

**A MASMORRA, O LOTE D (21/11/2026):** o chefe da Mina dos Postes passou a ser o **GOLEM-REI** (a folha do golem da Briga em
dobro), de **COURAÇA**: a pá, o vaso e a bomba só tinem até o **GANCHO** pegá-lo; então ele fica atordoado 2,6 s, sem couraça (a pá
tira 2), e por mais 1,8 s o gancho não o pega de novo. O servidor confere o gancho como o golpe, pela linha da corda contra o
passado dele (`fimDoGancho`/`ganchoPega`, nas duas cópias das regras). Dois bichos novos, no fim de `TIPOS`: a **ABELHA** (voa por
cima da água e mergulha na faixa marcada) e o **FANTASMA** (some e aparece; sumido, nada o acerta e ele não acerta ninguém). A mina
ganhou a sua **sala secreta** (a parede rachada da entrada, com o coração grande). Os **ACHADOS** (baús e segredos, `achadosDa`,
contados pelo servidor) aparecem no fim. O **HEROICO** (vida ×1,5, +1 de dano, 3 corações), na largada e na sala (vale com a turma também: decisão dele, 21/11/2026), vai como
`toca-heroico`/`mina-heroico`, com o recorde do Solo à parte (`heroico`, `mina-heroico`). Números chutados contra o piloto.

**O CHEFE, O LOTE D (21/11/2026):** a **ARENA QUE MUDA**: na 2ª e na 3ª fase de cada chefe o chão abre buracos (2 por fase; no
Solo, 1), marcados 2 s antes; quem está dentro quando abre cai, e aberto ninguém pisa nele (`foraDosBuracos`, nas duas cópias de
`chefe/conta.ts`, no site ao andar e no servidor ao receber a posição). Na maratona o yeti começa com o chão inteiro. O **3º
CHEFE, A ALPACA-REI** (folha da Briga), na largada: no lugar da investida, o **LEQUE DE VENTO**, 5 faixas marcadas em ~120° na
direção de alguém (marca `'faixa'`, no fim de MARCAS); na última fase, dois leques de 7, o segundo meio passo girado. Recorde do
Solo em `alpaca` e `alpaca-dificil`. Números chutados contra o piloto.

**O Pulo do coelho, o lote D (21/11/2026):** três fases com um ELEMENTO NOVO cada, e a **Copa dos Elementos** (`copa-dos-elementos`).
O **Vento** (`vento-1`, nas copas) tem as CORRENTES DE AR que sobem (`Fase.ventos`): no ar, dentro delas, o coelho sobe até 220/s, e é
assim que se atravessa o vão largo e se chega ao galho alto. A **Caverna** (`caverna-1`, na toca) tem as PEDRAS QUE RACHAM
(`Bloco.Racha`): pisada, a pedra treme meio segundo e cai, e volta 3 s depois; o estado é de cada coelho (`Coelho.racha`, por isso
`copiarCoelho`), e cair devolve todas. A **Cachoeira** (`cachoeira-1`, no prado) tem as TÁBUAS QUE PISCAM (`PiscaA`/`PiscaB`): a clara e a
azul se revezam a cada 2 s pelo passo da corrida, piscando antes de sumir. Os três só seguram por cima, e nenhum muda o que o servidor
confere (a corrente cabe no y da mola): só as medidas em `FASES_DO_PULO` e as cenouras. As seis fases de antes não mudaram. O piloto passa
nas três (medalhas sobre 1788, 1827 e 2429 passos). A corda (o cipó que balança) ficou de fora: pediria um caso novo na conferência.

**A Gincana, o lote D (21/11/2026):** dois percursos novos só com os trechos de sempre, o **lago-4** (a plataforma que vai e volta logo na
saída, os espinhos estreitos, o varredor de quatro braços e os blocos que caem, os canhões antes da rampa) e o **cume-5** (sobe sempre:
duas molas, duas rampas, a esteira contra, os varredores em par), e a **segunda sobrevivência, o campo-2** (7 × 7, o braço mais comprido).
O de quatro braços foi medido e não deu (o piloto do teste caía em 4 s). Nas Rodadas, a final sorteia uma das duas. Na escolha, "⏱1" e "⏱2".

**O Minigolfe 3D, a Trilha (21/11/2026):** o terceiro percurso, seis buracos com as peças do Minigolf Kit que faltavam: a BIFURCAÇÃO (a
mureta do meio, e o "T" que abre dois caminhos em volta de um vão e os junta de novo), a CRISTA (a pista afunda e volta), os CANTOS DE
MORRO (o canto sobe e devolve a bola), a CANALETA (a pista côncava; a ponta entra lisa, sem degrau) e o túnel. Escolhida na largada (⛰️),
com o recorde por percurso. A forma de cada peça foi medida no modelo (a vista de cima rasterizada) e o piloto acerta todos os buracos em
até o par + 1. **Defeito achado:** os modelos do túnel e da rampa baixa nunca tinham ido para `web/public/golfe3d/`, e os buracos 2 e 5
do Parque não abriam o 3D; foram copiados, e o túnel passou a ser o estreito (o largo tem pilares por dentro que a física não tem). Um
teste confere que todo modelo usado num percurso está lá.

**O Planador, o lote D (21/11/2026):** mais quatro desafios: a **asa 5** (larga baixa no cânion; só as três térmicas em fila seguram a
altura dos anéis do meio), a **mochila 4** (zigue-zague alto na horta, o vento que vira) e a **mochila 5** (vento forte no cânion, a
plataforma menor de todas), e o **salto 4** (o mais alto, sete anéis, vento de través). A lista se ordena por veículo e nível. O piloto
passa em todos com prata. Chute medido contra o piloto.

**O Rolê, o segundo conjunto de objetivos (21/11/2026):** escolhido na largada (no Solo e na sala), nas duas pistas: outra palavra no ar,
também nossa, **PULO**, outro esconderijo da fita, metas maiores (20 000 pontos, combo de 5 000) e duas manobras, **pousar um 540** e **um
manual de 3 s** (`Skatista.maiorGiro`/`maiorManual`, anotados em `somar`). Os saltos com nome do segundo conjunto ficam vazios: os pontos são
os mesmos nos dois conjuntos, e o recorde de pontos também. O servidor refaz a sessão no conjunto dela (`refazer(e, pista, conjunto)`), e o
mais de objetivos do segundo mora à parte na tabela comum (`objetivos2-<pista>`). Os botões da escolha são as próprias palavras (★ TOCA,
★★ PULO). As letras da praça não foram conferidas uma a uma: conferir jogando.

**O LOTE D DA SEGUNDA AUDITORIA, ONDA 2 (21/11/2026):** cinco agentes, um por grupo; ninguém jogou nada disso com gente.

**OS QUIZZES, OS TEMAS NOVOS (21/11/2026, o lote D):** quatro temas, cada um um jogo da estante nas duas abas, sem música (como os outros quizzes): os **Elementos químicos** (os 118; família, estado físico, período, grupo e número atômico; saem até o plutônio, e o nome leva o símbolo: "Ferro (Fe)"), os **Dinossauros** (73 gêneros; o período é de ordem, Triássico → Cretáceo, mais a dieta, o grupo, o comprimento e os continentes; os raros são só chute), os **Estados do Brasil** (as 27 UFs, o Worldle do país: distância e rumo, com o amarelo até 900 km pela `perto` da coluna, a região, a população, a área, o litoral e a fronteira com outro país) e os **Animais** (88 selvagens, sem domésticos; classe, dieta, habitat, continentes e peso). Como a mitologia, a lista e as colunas são NOSSAS, escritas nos scripts (`server/scripts/quiz-{elementos,dinossauros,estados,animais}.mjs`, sobre o comum `quiz-wikidata.mjs`), e o nome em cada idioma vem do Wikidata (CC0); dos estados, também o ponto, a população (a mais recente que o Wikidata guarda) e a área. Bicho cujo rótulo no Wikidata é o nome científico sai pelo "nome comum do táxon" (P1843) da língua, e os que nem assim têm, à mão em pt-BR. Os dados de dinossauros e animais são de divulgação: ordem de grandeza. Testes: `server/test/minijogos-quiz.test.ts`, `web/test/quiz.test.ts` (todo valor dos dados tem rótulo).

**O "QUAL É O TAMANHO?", FAZENDA E ESPORTE (21/11/2026, o lote D):** duas categorias novas, com 12 figuras do Fluent Emoji conferidas inteiras (pintinho, galo, ganso, porco, ovelha, cabra; bola de beisebol, bola de vôlei, pedra de curling, patins de gelo, esqui, gol de handebol) e os objetos que já existiam. Ficaram de fora os bichos do mar (o Fluent os desenha curvados ou de pé, e a medida mentiria), o peru (em português é também o país), o jumento (pulando), as bolas de rúgbi e de futebol americano (na diagonal, a ponta erra a medida) e o frisbee (o rastro do voo). Com 13 objetos, Esportes às vezes repetia o objeto a estimar: o sorteio agora guarda os ESTIMADOS (`estimados` em `sortearPar`), e só a referência pode voltar.

**A PALAVRA SECRETA DE 4 E DE 6 LETRAS (21/11/2026, o lote D):** escolhida na largada (`corpo.letras`; a de 5 continua a de fábrica), em todos os modos. As que saem são NOSSAS (`sorteio-4.txt`, 297; `sorteio-6.txt`, 339), conferidas contra o VERO; as que se chutam saem do VERO pelo mesmo script, agora com o tamanho (`palavras-do-vero.py saida.txt 6 --final`; o de 5, regenerado, saiu byte a byte igual ao de antes). O recorde e a sequência do Solo de 4 e de 6 são à parte (`@4`, `@6` na variante).

**O STOP, A CONFERÊNCIA POR CATEGORIA (21/11/2026, o lote D):** depois do STOP, a turma confere UMA categoria de cada vez, toda a sala na mesma, com as respostas de todos lado a lado em cartas; contestar e aceitar só nela. Cada categoria tem 25 s (`CONFERINDO_POR_CATEGORIA_MS`), e o "Pronto" de todos passa à próxima; depois da última, os pontos. A regra de quando a resposta cai (a maioria, ou o aceite de quem escreveu) não mudou.

**A PARTIDA DE XADREZ, OS FINAIS E A REVISÃO (21/11/2026, o lote D da segunda auditoria):** no Solo, os FINAIS DE TREINO
(`FINAIS_DE_TREINO` em minijogo-partida-de-xadrez.ts): rei e dama, rei e torre, dois bispos e rei e peão contra o rei. A pessoa joga
de brancas e abre (a mesa comum ganhou `quemAbre`: sem ele, o sorteio de sempre), o motor defende sempre no Difícil, e a meta é o mate;
o recorde é em quantos lances, contado pelo servidor, na tabela comum (`partida-de-xadrez`, variante `final-<id>`, menor é melhor;
empate não grava; quem VOLTA o lance dá o mate mas não grava recorde, decisão dele, 21/11/2026: `voltou`). Medido com o motor dos dois lados: os quatro acabam em mate, de 11 a 20 lances. Na sala, não há final. No fim de
qualquer partida, a REVISÃO: o público leva as posições depois de cada lance (só na fase fim), e as setas embaixo do tabuleiro (ou as
do teclado) andam por ela, lance a lance; só tela.

**AS DAMAS DE 10 × 10 (21/11/2026):** as internacionais, escolhidas na largada (`tamanho: 10`); as brasileiras continuam de fábrica. A
regra é a mesma (comer para trás, a lei da maioria, a dama voadora, coroar só terminando); muda o tabuleiro, de 100 casas, com 20
pedras de cada lado. As contas tiram o lado do próprio tabuleiro. O robô olha menos no de 10 (`NIVEL_DAS_DAMAS_10`: 2, 3 e 4 lances),
porque a conta roda na thread do servidor e o difícil de 6 levava até ~1 s. No 3D, o tabuleiro de 10 é feito por código (o do KayKit é
de 8).

**AS ARMAS ESPECIAIS DA BATALHA NAVAL (21/11/2026):** variante da largada, só sem o salvo. Cada lado tem, UMA VEZ por partida, o TIRO
EM CRUZ (a casa e as quatro vizinhas sem tiro, juntas; a vez passa sempre) e o SONAR (quantos navios do outro passam pela área de 3 × 3,
sem dizer onde; gasta a vez). O servidor confere e calcula (`usarArma`). A área e o número do sonar aparecem para todos, de propósito:
o dono do mar já sabe onde estão os navios e quem usou já tem o número, então nenhum navio escondido aparece para ninguém que não o
tivesse. O robô usa as duas (`jogadaDoRoboComArmas`): sonar sem fogo à vista e depois de 4 tiros, procura nas áreas em que o sonar
achou navio, cruz quando abre 4 casas novas; só com o que a pessoa no lugar dele veria. Na tela, três botões-figura na vez (mira, cruz,
radar); no 3D, as casas do sonar tingidas e uma boia por navio. Teste: `server/test/minijogos-lote-d-mesas.test.ts`.

**O DOMINÓ, O LOTE D (21/11/2026):** o DOMINÓ DE PONTOS, uma opção da largada (`corpo.pontos`): depois de cada pedra, se a soma
das pontas é múltiplo de 5, quem jogou (ou a dupla) marca a soma na hora; a carroça na ponta conta as duas metades e a primeira
pedra sozinha conta inteira (`somaDasPontas`). Batida e trancado levam as mãos dos outros arredondadas para baixo, de 5 em 5, e a
partida vai a 150, acabando no meio da mão se alguém chegar. Combina com as batidas especiais. O NÍVEL DOS ROBÔS no Solo (fácil,
normal, difícil; o normal é o de antes), por `jogadaDoRoboNoDomino`, que vê só o que a pessoa naquele lugar veria. O difícil É O
ROBÔ QUE CONTA: as pedras vistas, os números que cada um mostrou não ter ao passar (a compra apaga o que se sabia), prender o
adversário, não fechar o parceiro e, no de pontos, o que as pedras ocultas podem marcar em seguida. Medido contra a pessoa jogada
pelo relógio: no 1×1 o robô ganha 45%, 62% e 72%; no de pontos, 62%, 85% e 90%. O 150 e os pesos são chute.

**O TRUCO, OS SINAIS (21/11/2026):** no jogo de quatro, cada um faz ao parceiro a cara da carta forte, como na mesa de verdade:
😉 zap, 🤨 copas, 😏 espadas, 😛 ouros (as manilhas pelo naipe, no paulista e no mineiro), 😬 um 3, 😐 nada. O SERVIDOR manda o
sinal SÓ ao parceiro: o adversário e quem assiste não sabem nem que houve um (o teste confere). Um a cada 800 ms, e pode-se blefar.
Os robôs fazem o sinal verdadeiro logo na distribuição (`sinalDaMao`) e leem o do parceiro enquanto a carta prometida não saiu:
confiam mais na mão da dupla (pedir, aceitar, mão de onze) e, com o parceiro de manilha ainda por jogar, guardam a carta deles.

**AS CAPITAIS DO MUNDO (21/11/2026):** o terceiro tabuleiro da largada (`tabuleiro: 'mundo'`), a mesma volta de 32 casas e os
mesmos preços da de fábrica, com 20 países em 7 grupos por continente (a Ásia em dois). A casa guarda o CÓDIGO do país (o da lista
do quiz; `pais: true`), que é a sigla na placa. O nome da casa, no cartão de detalhe (as duas vistas), na compra, no leilão, no
aluguel e no histórico, é "Tóquio (Japão)": a CAPITAL passa pela tradução (decisão dele, mesmo dia; `CAPITAL_DO_PAIS` em
web/src/capitaisDoMundo.ts, e o teste confere que bate com os países do servidor) e o país vem do Intl, como no quiz. País novo pede
a linha da capital.

**O SUDOKU COOPERATIVO (21/11/2026):** na largada, ao lado da corrida, o modo Juntos (só na sala): a turma resolve O MESMO
tabuleiro, e cada número aparece para todos na cor de quem o pôs (`autores`). No "conferir na hora", a casa certa trava (ninguém
apaga o acerto de ninguém) e a errada fica vermelha para todos, contando o erro de quem a pôs; no "conferir no fim", qualquer um
confere e a penalidade é da turma. Acaba quando o tabuleiro fecha, com o tempo da turma; quem sai não segura. Sem recorde. Teste:
`server/test/minijogos-sudoku-juntos.test.ts`.

**O LOBISOMEM, OS PAPÉIS NOVOS (21/11/2026, lote D):** três papéis a mais no preparo, pela regra dos nomes de COISA (o Syden não sabe o sexo de quem recebe): o **Amuleto** (🧿, o "príncipe" do jogo de mesa: a primeira vez que o julgamento decide tirar a pessoa, ele quebra, ela fica e o papel abre a todos), a **Carapaça** (🐢, o "ancião": aguenta o primeiro ataque dos lobisomens, calada; o anjo e a cura não a gastam, o veneno passa) e a **Máscara** (🎭, o "curtidor": joga por conta própria e vence se a VILA a tirar no julgamento, e a partida acaba ali; atacada, envenenada ou levada pela Armadilha, só sai). `ESPECIAIS` em `minijogo-lobisomem.ts`; a história do fim mostra a carapaça e o amuleto. O microfone de noite (lote C) não mudou. Os nomes são a confirmar com ele. Testes: `server/test/minijogos-lobisomem.test.ts`.

**O FUTEBOL, O BOTE (21/11/2026, lote D):** o carrinho para tirar a bola (E ou V; o botão "Bote" no toque), nas duas cópias da simulação (`comecarBote`, `alcancaBote`, `aplicarBote`, `relogiosDoBote`): escorrega reto 0,3 s, e encostando na bola ela sai SOLTA na direção do carrinho (quem deu não vira dono); quem a conduzia fica tonto um instante e não se machuca. Errou, fica 0,5 s no chão (acertou, 0,2 s), e só dá outro depois de 2,5 s. Os robôs dão bote às vezes, mais no difícil (pelo relógio, igual nos dois lados). NA SALA, quem dá o carrinho tem razão, como no chute: o carrinho anda na tela de quem o deu, e quando encosta na bola da tela o bote vai ao servidor, que procura nos últimos 300 ms a bola (sem chute desde então, com o mesmo dono) perto da posição dita, confere a recarga no relógio da partida e a solta (evento 'b' no quadro; o bote dos robôs vai numa coluna a mais, só para o desenho). O bote de gente não aparece desenhado na tela dos outros. Números chutados. Testes: `server/test/minijogos-futebol.test.ts`, `web/test/futebol.test.ts`.

**A COZINHA, AS FASES DO SOLO (21/11/2026, lote D):** além da planta livre, oito restaurantes em sequência (`FASES_DA_COZINHA`, nas duas cópias de `cozinha-receitas.ts`): sorveteria, lanchonete, xis, pizzaria, peixaria, café, churrascaria e o banquete (todas as receitas), cada um com a planta e o CARDÁPIO dele (os pedidos saem só dali: `sortearPedidos(..., cardapio)`, que sem cardápio sorteia igual a antes) e as ESTRELAS (os pontos do servidor para 1, 2 e 3). A primeira abre de fábrica; cada uma abre com 1 estrela na anterior, conferido pelo servidor nos recordes. O recorde é por fase na tabela comum (jogo 'cozinha-paciencia', variante `fase-<id>`, com os pratos e as estrelas). Na escolha do Solo, a fileira das fases (número ou cadeado, as figuras do cardápio, as estrelas e o recorde); no fim, as estrelas grandes. As metas foram medidas com o piloto (um prato por vez): ele sempre tira 1 estrela e nunca 3, que pedem cozinhar duas coisas juntas (o teste cobra). Fase nova vai no FIM.

**A FESTA, O TREINO, O QUIZ E O RELÂMPAGO (21/11/2026, lote D):** o **TREINO**, só no Solo: escolhe-se um microjogo na largada (a lista em "Treino") e joga-se 20 rodadas dele, sem placar na tela, sem recorde, prêmio, dobro ou troféu; o microjogo de 2 ou mais ganha os robôs que faltam (`modo: 'treino'`, `TREINO_RODADAS` em `minijogo-festa.ts`). O **QUIZ RELÂMPAGO** passou de 30 para 150 perguntas: as 120 novas são de conhecimento geral, NOSSAS e sem franquia (o céu, o corpo, os bichos, as cores, os números, as estações, a geografia), traduzidas como o resto; a certa continua só no servidor (`CERTAS`), e pergunta nova vai no fim das duas listas. O **MODO RELÂMPAGO** ganhou oito tipos de microjogo, todos sem texto e conferidos pelos dados do servidor: o monte maior, a cor igual (com uma forma dentro de cada cor, para não depender só dela), o nabo entre as cenouras, as batidas no tambor (cada batida no mínimo 70 ms depois da outra), a pedra que cai (ir para outra faixa), a soma dos dados, a sombra do legume e a toca onde a cenoura estava (`TIPOS_RELAMPAGO`, os novos no fim). Testes: `server/test/minijogos-festa.test.ts`, `server/test/minijogos-festa-relampago.test.ts`.

**TOCAS E TORRES, O LOTE D (21/11/2026):** o ATACAR ANDANDO chegou à tela (a simulação já tinha o `mover` com `atacando`, só o computador usava): o botão da mira (tecla G) com tropa escolhida, e o próximo clique, toque ou botão direito no chão manda andar atacando quem aparecer; Esc desarma. A VELOCIDADE do Solo (1×, 1,5×, 2×, botão no topo) é só o ritmo da tela: o servidor deixa a partida andar até 2× o relógio (`VELOCIDADE_MAX`), e o recorde, em passos, não muda. OS DESAFIOS DO SOLO (`DESAFIOS` em sim.ts, `PERFIL_DO_DESAFIO` em ia.ts, nas duas cópias): o Cerco (10 min contra o difícil adiantado; recorde = pontos), Defender a Maravilha (ela já de pé, o exército do computador mirando nela; 5 min; recorde = a vida dela em %), o Ataque relâmpago (exército pronto, o centro do fácil em 8 min; recorde = tempo) e a Colheita (2500 recursos, sem ataque; recorde = tempo), na tabela comum (variante `desafio-<id>`), com o número da partida refeita pelo servidor. Sem desafio, a partida é a de sempre. Números chutados; o piloto passa nos quatro (a Maravilha perde às vezes no mapa "ouro").

**O ESTOURA-BALÃO, O LOTE D (21/11/2026):** QUEM SAIU CONTINUA: sem balão, o kart vira fantasma (meio transparente), segue andando, pega caixa e solta item que pega os outros, mas não é atingido, não bate e não vence; no servidor, só o "acertou" e a "batida" pedem balão. AS DUPLAS: na sala, quem convida escolhe, e vale com 4, 6 ou 8 (o lugar `i` vai ao time `i % (total/2)`, que larga do mesmo lado); o item e a batida não pegam o colega (o servidor confere), acaba quando sobra um time, os balões têm a cor do time e o troféu é dos dois que venceram, em 1º. No Solo, 2×2 e 2×2×2 com robô de parceiro. DUAS ARENAS NOVAS, o Pomar e o Cânion, nas duas cópias de sim.ts (o servidor confere as paredes como sempre), pintadas com o tema da pista de mesmo nome.

**OS CARRINHOS, O COMBUSTÍVEL DA RESISTÊNCIA (21/11/2026):** só nas 20 voltas, nas duas cópias da regra: o tanque dá 7 voltas de acelerador inteiro (o gasto é o acelerador vezes o que andou; soltar não gasta), vazio o carro se arrasta, e o BOX é o trecho de 6 antes da linha, em toda faixa: parado nele, o tanque enche (2,5 s do vazio ao cheio). O piloto automático e os robôs planejam a parada (duas por corrida, as faixas continuam a 1%). O servidor refaz igual. O recorde da resistência recomeça em `@20c`; os de antes ficam em `@20`, que ninguém mais oferece. Na tela, o tanque ao lado do acelerador, o box marcado na pista e o aviso com o tanque baixo. Números chutados.

**O TRÂNSITO, A CAMPANHA (21/11/2026):** dez fases (`CAMPANHA` em sim.ts, as duas cópias), cada uma com mapa, duração (40 s a 1:30), ritmo das chegadas, rapidez, a hora em que entram curvas, moto, caminhão e ambulância, e uma META de pontos (~60% do pior de oito sorteios do piloto). Sem fase, a partida é a de sempre (o teste confere). A 1ª está sempre aberta; a próxima abre quando o recorde da anterior chega à meta, lido da tabela comum (variante `fase-<n>`, os pontos refeitos pelo servidor), sem tabela nova. Na escolha do Solo, a grade das fases com a meta, o recorde e o cadeado.

**A HORTA EM CASCATA, O LOTE D (21/11/2026):** o TREINO DA CADEIA (`blocos/treino.ts`, `TreinoDaCadeia.tsx`, a lâmpada na escolha do Solo): lições prontas em que uma troca solta uma cadeia; a lâmpada mostra a troca, a pessoa tenta, e a regra de sempre diz a cadeia que saiu. Só no site, sem servidor nem recorde; o teste confere cada lição. Mais 20 QUEBRA-CABEÇAS (8 de duas trocas e 12 de três), achados por sorteio e conferidos pela busca do teste, no fim da lista (os recordes das 20 de antes valem).

**O LOTE E DA SEGUNDA AUDITORIA (24/11/2026, "rode em paralelo o lote E"):** sete agentes, um por grupo; ninguém jogou nada disso com gente (os números são chute medido contra os pilotos e robôs). A lista dos modelos 3D que faltam nos mini-games (51, quase todos por script do Blender; Meshy só para bicho e corpo de coelho) está em `retomar-20-11/modelos-3d.md`, na pasta do projeto na memória.


**A TORRE SEM FIM (24/11/2026, o lote E da segunda auditoria), só no Solo:** o botão ∞ depois das cinco torres. A torre é
montada pela SEMENTE que o servidor sorteia a cada subida (`torreSemFim` em `torre/fases.ts`: 40 trechos das mesmas peças, com
os padrões das torres de sempre; mais coisa caindo e corvos mais ligeiros subindo, até 80% do ritmo do começo; o posto de cada
andar longe do primeiro fardo do trecho seguinte, e o corvo dos fardos voa entre os topos), e a ÁGUA SOBE do chão
(`torre/semfim.ts`: espera 6 s, aperta a cada passo, e corre 4× se ficar mais de 240 px abaixo do último andar); a pancada leva
ao último andar, e quando a água passa dos pés, acabou. O recorde é o ANDAR mais alto, e quem conta é o servidor: as torres, a
física e a regra moram em DUAS CÓPIAS IGUAIS (`web/src/torre/{fases,fisica,semfim}.ts` ↔ `server/src/torre/`), o site manda os
comandos de cada passo e o servidor refaz a subida (`refazerSemFim`), sem mais passos do que passou desde o começo. Tabela comum
(`torre`, variante `sem-fim`); sem fantasmas nem medalhas (cada subida é outra torre). Na sala não há (a torre de sempre). Medido
com o piloto (8 sementes): todas se sobem, e ele chega a 11–19 andares antes da água; os números são chute. Testes:
`web/test/torre.test.ts`, `server/test/minijogos-torre.test.ts`.

**O Rolê, a terceira pista (24/11/2026, o lote E): a QUADRA** (`quadra-1`, no fim de `PISTAS`), só com as peças já medidas: um
corrimão comprido à esquerda e uma caixa comprida à direita, cada um com o kicker dele, e uma caixa de través no fundo com dois
kickers para saltar por cima. Os objetivos nos dois conjuntos (TOCA e PULO, as fitas nos cantos) e três saltos com nome no
primeiro ("por cima da caixa", "até o corrimão" e "até a caixa", o mesmo nome do parque); o teste confere por simulação que cada
salto, letra e fita se alcança. O recorde e os objetivos na tabela comum, como a Praça. Testes: `web/test/skate.test.ts`,
`server/test/minijogos-skate.test.ts`.



**O TABULEIRO DA TURMA, OS TABULEIROS NOVOS (24/11/2026, lote E da segunda auditoria):** na largada, antes das rodadas, quem começa escolhe o tabuleiro: a HORTA (a de sempre e de fábrica), o RIO ou a SERRA (`TABULEIROS` e `tracadoDe` em `minijogo-tabuleiro-da-turma.ts`; os nomes de sempre, `CASAS`, `RAMAIS`, `proximaCasa`…, continuam sendo os da horta). O **Rio** tem 32 casas e uma ponte (um ramal), a casa nova da CORRENTEZA ('c': leva a peça 3 casas adiante, e a casa onde ela fica não age) e a CHEIA nos eventos (todo mundo da sala anda 2 casas). A **Serra** tem 28 casas, um atalho, a casa do ESCORREGA ('e': devolve 3 casas, `casaAnterior`) e o TELEFÉRICO nos eventos (a peça vai à casa antes da cenoura dourada). Nenhum dos dois tem o mutirão. No 3D, cada um tem a sua volta (`GEOMETRIAS` em `tabuleiro3d/volta.ts`), o mesmo miolo e a mesma cidade, e o seu chão: o anel de água do rio (a ponte passa por cima) e as pedras da serra; no 2D de reserva, cada um tem o seu retângulo (`MEDIDAS_2D` em `tabuleiroLugares.ts`) e o seu miolo. Tabuleiro novo pede a linha em `TABULEIROS`, a geometria e as medidas 2D (os testes cobram que batem e que nada fica em cima de nada). Os robôs jogam os dois; os números são chute: ninguém jogou com gente. Testes: `server/test/minijogos-tabuleiro-novos.test.ts`, `web/test/tabuleiro3d.test.ts`.

**O TELEFONE SEM FIO DO DESENHA E ADIVINHA (24/11/2026, lote E):** o outro modo da largada ("Modo": Clássico ou 📞 Telefone sem fio; só a mecânica da brincadeira, nada de nome nem arte de app). De 3 a 8 pessoas: cada uma escreve uma frase, e a cada passo todo mundo trabalha AO MESMO TEMPO na corrente de outra pessoa (quem recebe frase desenha, quem recebe desenho escreve o que acha que é), tantos passos quanto pessoas; no fim, a turma vê cada corrente inteira, um passo a cada 4 s (qualquer um passa adiante). Sem pontos. O traço vai pelo MESMO canal do desenho, com as mesmas conferências, mas o servidor NÃO o repassa: o desenho é segredo até a revelação (`server/src/minijogo-telefone.ts`). **A frase passa pela moderação da comunidade** (o silêncio, as palavras proibidas e os links; quem administra não passa), por `server/src/texto-do-jogo.ts`, com o banco por import dinâmico; fica como foi escrita, sem tradução, até 80 caracteres. Quem sai da sala não segura o passo; a frase escrita e não enviada vai sozinha no último segundo e meio. O desenho clássico não mudou (`JogoDesenho` escolhe pela `modo`; a tela é `JogoTelefone.tsx`). Testes: `server/test/minijogos-telefone.test.ts`. Ninguém jogou com gente.



**O PINBALL, A TERCEIRA MESA, O LAGO (24/11/2026, o lote E):** na largada do Solo, ao lado da horta e do pomar, o LAGO (`MESAS[2]`), com três coisas só dele, nas duas cópias da regra: as DUAS RAMPAS (a da horta à direita, caindo na primeira pista, e a do pomar à esquerda, na terceira; cada bola sabe em que trilho está, `Bola.rampa`) e a DUPLA, a outra rampa em até 4 s, que vale 2000; o SAPO da raia de saída da esquerda (`SAPO`, `PULO_DO_SAPO`): aceso, a bola que desce por ela é devolvida num pulo (um trilho curto) para a raia de dentro, sobre a palheta, e ele apaga; acende em cada bola nova e na colheita das cenouras (chutá-la de volta pela raia não servia: o desvio da órbita fecha o alto da raia); e as MISSÕES DELE (`MISSOES_DO_LAGO`, a mesa ganhou `missoes`): no lugar dos estilingues, acender as três pistas do alto, e três rampas; o modo final é o mesmo. Os rebatedores são vitórias-régias num arco largo, na água, e o sapo é desenhado na raia (aceso ou apagado). Só no Solo, com o recorde na tabela comum (`'pinball'`, variante `'lago'`). A horta e o pomar rodam a mesma conta de antes: `web/test/pinball.test.ts` guarda 12 partidas do piloto medidas antes da mudança. O lago é mais difícil para o piloto (~30 mil de média contra ~65 mil na horta). Números chutados: ninguém jogou com gente.

**A ROTA ESTELAR, A SEGUNDA ROTA, A DO GELO (24/11/2026, o lote E):** escolhida na largada por quem começa (`EscolhaDaRotaEstelar`, `corpo.rota`, vale para a turma toda), com o mesmo relógio da primeira (o subchefe, a subida, a bifurcação e o chefe nos mesmos passos; por isso a Ficha é a mesma) e o conteúdo dela, nas duas cópias de `estelar-sim.ts` (`roteiro(semente, ROTA_DO_GELO)`): o planeta gelado com os CRISTAIS no chão, os ARCOS de gelo atravessados e as MINAS (paradas, estouram num anel de tiros quando a nave chega a 55); a SENTINELA de subchefe (o anel que dá voltas na frente da nave); na bifurcação, à esquerda a NEBULOSA (minas e caçadores) e à direita o ANEL DE GELO (rochas, cargueiros e as PORTAS, duas lajes com um vão); e a NAVE-MÃE no fim (o cargueiro do Space Base Bits em tamanho de chefe, com a ponte e os canhões por código), que solta pares de sondas de escolta. O chefe que acaba a rota é `ehChefeFinal` (o polvo ou a mãe), e `ehChefe` cobre os quatro. Na tela, o chão de neve, o céu azul do dia da Kenney, e o resto por código; nenhum modelo novo. A rota do planeta não mudou: a mesma semente dá o mesmo roteiro (o teste guarda o resumo de quatro). O recorde do Solo do gelo fica na tabela comum (`'estelar'`, variante `'gelo'`); o do planeta continua em `estelar_recordes`; o troféu da sala é o mesmo. O piloto derruba a nave-mãe nas duas rotas do gelo, e o servidor aceita cada evento. `e2e/estelar.mjs` clica na rota (`ROTA=gelo`): escrito, não rodado. Números chutados: ninguém jogou com gente.


**TOCAS E TORRES, A ERA 3 (24/11/2026, lote E da segunda auditoria):** da era 2, com um MERCADO pronto (o degrau: `podeAvancarEra`),
por 500 de comida e 300 de ouro em 50 s; vida das unidades ×1,4, golpe ×1,5, prédios ×1,8 (`ERA3`, `FATOR_DA_ERA`, nas duas
cópias). Abre a GUARDA (quartel; lança com escudo, da linha do lanceiro: as melhorias dele valem para ela, `linha` na unidade), a
OFICINA com o CANHÃO (cerco de longe; `ehCerco` junta catapulta e canhão), o BASTIÃO (a torre do canhão) e três melhorias gerais no
ferreiro, no fim de `ORDEM_DAS_MELHORIAS`: forja (toda tropa bate ×1,15), cota de malha (leva ×0,85) e carrinho de mão (carga 15). Os
modelos são do mesmo Medieval Hexagon (workshop, tower_cannon, cannon, a bala), por `tocas-modelos.mjs`; o centro da era 3 ganha as
torrinhas do canhão. O computador busca a era 3 a partir de `era3Desde` (fácil 12 min, normal 11, difícil 10): levanta o mercado,
troca nele o que sobra pelo que falta e avança; lá, oficina, canhões, bastiões, guarda e as melhorias gerais. O piloto, o tutorial e
os desafios ficam sem a era 3 (os recordes deles continuam comparáveis). **Quem não chega à era 3 joga a partida de antes, número
por número:** com o computador sem ela, 44 partidas iguais à versão anterior passo a passo (o 2×2 e os desafios incluídos), e
`web/test/tocas-era3.test.ts` crava quatro delas. Com ela, mais partidas acabam pelo tempo (a defesa fica forte); o difícil seguiu
ganhando do fácil em 8 de 8. Números chutados contra os robôs: ninguém jogou. O cavaleiro montado entrou depois, com os modelos por script (ver abaixo).



**A FORNALHA DO DRAGÃO, A TERCEIRA MASMORRA (24/11/2026, lote E da segunda auditoria):** escolhida na largada ao lado da toca e da
mina (`corpo.masmorra = 'fornalha'`, com o heroico), salas 14 a 20; as duas de antes não mudaram. O item é o **REGADOR**: quem rega
diz só a direção, e o servidor acha na linha (`alvoDoRegador`/`jatoPega`, nas duas cópias das regras) o dragão ou o primeiro fogo
aceso, até 5 casas, passando por cima da água. O **fogo do chão** ('F') é parede até apagar, e apagado fica apagado; os **BRASEIROS**
('A', a trava `'braseiros'`) são o enigma da turma: os três apagados AO MESMO TEMPO abrem o norte, e cada um acende de novo em 7 s
(`BRASEIRO.volta`; com a turma cada um rega o seu, sozinho é correr; um anel mostra quanto falta). O caminho: o salão das chamas
com o norte atrás do fogo, o baú do regador a oeste, os braseiros, a chave atrás da parede de fogo e o **DRAGÃO** (a folha do castelo
da Briga), protegido como o golem-rei (`ehProtegido`): o fogo em volta só o regador apaga, e molhado ('atordoado', 2,8 s, depois imune
1,6 s) ele apanha; o sopro é um leque de cinco bolas de fogo, e na metade da vida chama dois **DIABINHOS**, o bicho novo da fornalha
(fica de longe e cospe fogo). Sala secreta pela parede rachada da entrada, 2 baús e 2 segredos nos achados, recorde do Solo em
`fornalha` e `fornalha-heroico`. O piloto atravessa a fornalha inteira sozinho e com a turma (o teste cobra). Números chutados;
ninguém jogou com gente. As chamas que o sopro deixaria no chão ficaram para depois.



**OS CARRINHOS, A TROCA DE FAIXA (24/11/2026, o lote E):** a peça `T`, a AGULHA (as duas cópias de `carrinhos-sim.ts`): uma reta em
que o carro pode passar à outra faixa da MESMA fileira (0 ↔ 1, 2 ↔ 3). Quem joga ARMA a troca com um toque (X, Shift, ↓ ou S; o X
do controle; o botão redondo no toque) e ela acontece ao entrar na próxima agulha; outro toque desarma. No que vai ao servidor o
toque é o acelerador + `TROCA` (16 a 24) naquele passo: sem agulha nada muda, e os fantasmas e recordes de antes valem. O traçado
novo é a **Agulha** (`agulha-1`), a volta da Toca com duas agulhas: sem trocar é a Toca; o piloto que troca bem (`pilotoComTroca`,
que ensaia as duas faixas até a agulha seguinte) ganha ~1,4% e as faixas ficam a menos de 1% (o teste cobra, em 5 e 20 voltas). O
ganho é pequeno de propósito: as faixas foram equilibradas por volta. O editor tem a peça, a cena desliza o carro de uma faixa à
outra (só desenho), os robôs trocam, as medalhas da Agulha são sobre o piloto que troca, e na sala a posição leva a faixa de agora
(o servidor só aceita a outra da fileira, numa pista com agulha). O campeonato continua com os cinco de 20/11. Chute medido: ninguém jogou.

**O ESTOURA-BALÃO, A CENOURA DOURADA (24/11/2026, o lote E):** um modo da largada (`corpo.modo: 'dourada'`), na sala e no Solo, com
duplas. Ninguém perde balão: uma cenoura dourada nasce num ponto da semente (`lugarDaDourada`, as duas cópias de `balao-sim.ts`),
quem passa por ela a pega, e quem a segura e leva item ou batida (a regra de sempre, com os 2 s e o escudo) a derruba onde estava;
quem derrubou só a pega 1,5 s depois. Ganha quem a segurou mais tempo (nas duplas, a soma do time). **Quem está com ela é do
servidor**: dá a quem passou perto pelas posições aceitas, tira no estouro que só ele decide e de quem sai da sala, conta o tempo
pelo relógio da partida e avisa a todos (`difundir`, tipo 'dourada'). Bater em quem a tem costuma tomá-la na mesma passada, de
propósito. No Solo os robôs a buscam, perseguem quem a tem e fogem com ela. O troféu é o de sempre ('balao'), com o placar em
segundos. Chute medido contra os robôs.

**A CORRIDA DOS COELHOS, OS ROBÔS NA SALA (24/11/2026, o lote E):** quem convida escolhe "Só a turma" ou "Completar com o
computador" (`corpo.robos`); o servidor diz quantos (até 8 karts, `KARTS_NA_SALA`), e cada computador anda os mesmos robôs (médio)
pela mesma conta, desde o verde dele (`robosNaSala` em corrida/laco.ts). Para não se separarem: o item do robô sai da posição entre
os robôs, o roxo mira o robô da frente, os eventos deles não vão ao servidor, e **um robô só cai com item de robô** (o das pessoas
chega a cada computador numa hora). Os itens dos robôs pegam as pessoas pela regra de sempre (quem leva decide). A turma larga na
última fila (o servidor aceita a primeira posição 30 mais longe só com robôs). **Os robôs ENTRAM NA CLASSIFICAÇÃO** (decisão dele,
mesmo dia): posição, pontos da copa e pódio; o troféu é só de pessoa, com a posição real, e o robô vai nos "contra quem" pelo nome
com o 🤖. **O tempo do robô é o que a MAIORIA dos computadores diz** (cada um manda, a cada segundo, a chegada e o quanto andou
cada robô; no empate, a chegada menor; tem de caber no relógio): o servidor não refaz a corrida do robô, porque a física do kart
usa seno e cosseno e mora no site. Quem não chegou fica pela mediana do quanto andou; o prazo de 30 s só abre com a chegada de uma
pessoa; quem só assiste não vê os robôs. Ninguém jogou com gente.


**A PALAVRA SECRETA EM CINCO IDIOMAS (24/11/2026, o lote E da segunda auditoria):** quem começa escolhe o IDIOMA na largada
(português, inglês, espanhol, francês ou alemão, pelo nome da língua no navegador; de fábrica, o de quem começa, senão o
português), nos três tamanhos e em todos os modos. As que SAEM são NOSSAS (en/, es/, fr/ e de/ em `server/assets/palavra-secreta/`,
cada uma com o leia-me e a licença da fonte, conferidas contra ela); as que se CHUTAM saem de um corretor do LibreOffice pelo
mesmo script, agora com `--lingua`/`--dic` (o português regenerado sai byte a byte igual): o en_US (SCOWL, licença permissiva), o
RLA-ES em LGPL/MPL (a licença é tripla, à escolha) e o Grammalecte (MPL 2.0). **O alemão não tem corretor que sirva** (o igerman98
é GPL, ou a OASIS, que proíbe modificar e só vale para programas ODF): os chutes vêm da wortliste do projeto Trennmuster (MIT, com
as flexões), filtrada pelo que o OpenThesaurus (LGPL) marca como vulgar (`server/scripts/palavras-do-alemao.mjs`), e a chave é só
a-z (BÄR é BAER, ß é SS; fica assim, decisão dele, 24/11/2026). **O italiano ficou de fora**: corretor e thesaurus são GPL 3, e o Morph-it! tem a licença ambígua (não escrever aos autores: decisão dele, 24/11/2026). No
espanhol o Ñ é letra ("niño" não é "nino"); os teclados da tela seguem cada língua (Ñ, AZERTY, QWERTZ). Nas línguas novas ficam
fora dos chutes os palavrões que o dicionário marca e uma lista curta de ofensas (na revelação a sala vê as letras); o português
continua como era (decisão dele). O recorde e a sequência do Solo são à parte por idioma (variante com `~en`, `~es`, `~fr`, `~de`).
A palavra que tem duas grafias para a mesma chave ("vovó"/"vovô") sai uma vez só, e a revelação mostra "vovó / vovô". O jogo perdeu
o "· português" na estante. Ninguém jogou com gente, e as listas não passaram por quem fala as línguas. Teste:
`server/test/minijogos-palavra-idiomas.test.ts`.

**OS 20 MINUTOS SÃO UMA SUGESTÃO (24/11/2026, decisão dele: "não um limite rígido").** Nas Tocas e Torres, aos 20 minutos a partida
NÃO acaba: aparece o placar e "Terminar pelos pontos" (ganha quem tem mais, `pontos`). No Solo, um clique acaba; na sala (1×1 e 2×2),
qualquer pessoa propõe e a partida acaba quando TODAS as que ainda jogam aceitam; uma recusa desfaz a proposta; robôs e quem largou
não votam. Tudo pelo lockstep: o comando 'pontos' (e o 'largar', que o servidor põe no turno de quem saiu do 2×2), com `votam` e
`votos` na simulação (as duas cópias). O teto de SEGURANÇA é de 90 minutos de jogo (`PASSOS_MAX`; `PASSOS_SUGERIDOS` são os 20), e o
prazo de relógio da partida passou a 2 h 30 (`PRAZO_MS`). Sem ninguém que vote (o computador contra o computador), ela acaba aos 20
minutos como sempre, número por número; e antes dos 20 minutos nada muda para ninguém. Os recordes dos desafios do Solo não mudaram.
Testes: `web/test/tocas-era3.test.ts`, `server/test/minijogos-tocas.test.ts`.

**OS MODELOS 3D POR SCRIPT (24/11/2026, decisão dele: "pode fazer os 44 itens por script"):** o que os jogos 3D desenhavam por código virou GLB NOSSO, feito por script do Blender e guardado no projeto (`web/scripts/modelos/<grupo>/`, cada um com o `rodar.ps1`), sem textura e sem crédito a dar. A regra de todos: **a peça por código continua de RESERVA** (o arquivo que falta ou falha deixa a de antes), e só a tela muda (nenhuma regra, ficha ou servidor). O carregador comum é `web/src/modelosNossos.ts`. A lista, as regras e os relatórios de cada grupo estão em `retomar-20-11/` (modelos-3d.md, modelos-regras.md, relatorios-modelos/), na pasta do projeto na memória. Ninguém jogou com eles; os e2e `modelos-*.mjs` só fotografam.

**A ROTA ESTELAR SEM PRIMITIVAS (24/11/2026, pedido dele: "pode fazer os 44 itens por script"):** a nave de quem joga, o
caçador, a torre, a mina, a sentinela, o polvo de lata, a nave-mãe, o canhão do jipe, o cristal, a laje de gelo e os portões
da bifurcação são GLB NOSSOS, feitos por script do Blender (`web/scripts/modelos/estelar/`, rodar com `rodar.ps1`) com a
paleta do Space Base Bits embutida, em `web/public/estelar/`. A cena os carrega por `carregarNosso` (`NOSSOS` em
`estelar/cena.ts`), e a geometria por código de antes ficou de RESERVA: sem o arquivo, a peça de antes (conferido com os
11 respondendo 404). O que mexe é nó com nome: a cabeça da torre, a bola da mina, o anel da sentinela e os 8 braços do polvo
em 5 gomos cada, que a cena dobra com a onda descendo. A cabine e o coelho da nave continuam por código, por cima do casco;
a cor da nave e a dos portões vão no material `pintura`. Só a tela: a regra, a ficha e o servidor não mudaram.

**OS MODELOS NOSSOS DO SALÃO E DO QUARTO 3D (24/11/2026, "pode fazer os 44 itens por script"):** o que era feito por código virou
modelo feito por script no Blender (`web/scripts/modelos/salao-quarto/`, nada a creditar): no salão o fliperama (a tela por código
no nó `tela`), a jukebox, o microfone, a janela do fundo e o troféu, que é o MESMO do quarto (prata e bronze pintados por cima);
no quarto o fone, a cortiça, os troféus, o violão, o relógio (os ponteiros na hora em que o quarto abriu), a caminha, a pipoca, o
guarda-roupa ALTO de cada tema e o VENTILADOR, que agora GIRA quando está ligado no pixel e balança a cabeça oscilando (com "menos
movimento", parado). As janelas que não tinham desenho no 3D existem: arco, redonda e com floreira, uma versão por tema, e na
grande a cortina fechada e as folhas abertas (`vao` em `Tema.parede`: a janela do clássico tem parede em volta). Tudo carrega sem
segurar a cena, e o de antes (o código ou o do pacote) fica de reserva. Na malha juntada do colorido, a cor dos vértices fica (sem
ela o modelo nosso saía preto). Ficaram de fora o neon (a forma já era a certa) e o balcão do bar (já é do Kenney).

**OS MODELOS NOSSOS DO TABULEIRO DA TURMA E DO AVIÃO DAS CAPITAIS (24/11/2026, "pode fazer os 44 itens por script"):** feitos no
Blender por script (`web/scripts/modelos/tabuleiro-capitais/`), no estilo da mini cidade da Kenney, sem textura: a CENOURA (dourada e
comum num modelo só, `web/public/comum/cenoura.glb`, nós "corpo" e "folhas", para qualquer jogo 3D), a barraca da dourada, a toca com a
porta redonda, o chafariz e os bancos, a cerquinha e as pedras da Serra (`web/public/tabuleiro3d/`), e o avião do aeroporto
(`web/public/cidades3d/nossos/aviao.glb`). Carregam por `web/src/modelosNossos.ts` (`carregarNosso` nunca falha; `geometriaComCor`
vira a geometria de cor por vértice das peças de código), e a peça por código continua de reserva. As voltas do Rio e da Serra não
mudaram. Os modelos são nossos: nada a creditar.

**OS MODELOS POR SCRIPT DA PONTE, DAS MESAS E DA NAVAL (24/11/2026, pedido dele: "pode fazer os 44 itens por script").** Feitos no
Blender por `web/scripts/modelos/ponte-mesas-naval/` (`rodar.ps1 <script>`), nossos, sem crédito. A **Ponte** ganhou `ponte/cenario.glb`,
um nó por peça com as medidas das de código (pinheiro, árvore, a pedra do rio de altura 1, as fiadas do pilar empilhadas, o capitel, o
bloco de apoio, o casco do barco com o mastro e a vela esticados, a bandeira de chegada); a copa troca para os materiais da cena (a fase
seca continua seca) e os sorteios da floresta são os mesmos. As **mesas** ganharam os tabuleiros da Mancala (covas ESCAVADAS: o tampo a
0,62 e o fundo no TOPO de antes), do Cinco em linha e das Damas de 10, em glTF separado que aponta para a textura de paleta do Board Game
Bits (cada face num ponto do degradê da célula, como o board_A). A **Batalha naval** ganhou a TERCEIRA frota, a de GUERRA (porta-aviões,
destróier, fragata, corveta e patrulha, `naval3d/guerra/`), ao lado da pirata e da civil; os três mares só têm navios de 2 a 5 casas.
Em todos, a peça por código continua de reserva enquanto o modelo carrega ou se ele falhar. Teste: `e2e/modelos-ponte-mesas-naval.mjs`.

**O EXTINTOR, A CAMPAINHA, AS PEÇAS DOS CARRINHOS, O POSTE E O CAVALEIRO MONTADO (24/11/2026, "pode fazer os itens por
script"):** os modelos nascem de scripts do Blender em `web/scripts/modelos/tocas-cozinha-carrinhos/` (`rodar.ps1
<script>`; `comum.py` tem as formas chanfradas, a oclusão assada na cor dos vértices e a prévia), e a peça por código de
antes fica de RESERVA (o GLB vem com `.catch`). Na Cozinha, o extintor e a campainha (`cozinha.py`). Nos Carrinhos, o
CRUZAMENTO e a AGULHA partem da própria reta do Toy Car Kit (`carrinhos.py`): o cruzamento sem a zebra do lado de dentro e
com as faixas pintadas (a peça da fileira −1 dá meia volta), a agulha com os desvios tracejados; a física não mudou. No Rolê,
o poste oitavado (`poste.py`, 'poste' no fim de `MODELOS_DO_ENTORNO`). Nas Tocas e Torres, o CAVALEIRO MONTADO: o cavalo do
Medieval Hexagon (`horse_{cor}_accent`, pelo `tocas-modelos.mjs`) e a pose "montado" do NOSSO esqueleto (`cavaleiro.py`), que
sai num GLB SEM malha (`tocas/coelho-montado.glb`, só a ação): o jogo a toca no coelho de sempre, com as cores do time; o trote
só andando. As medidas da sela moram em `MONTADO` (cena.ts) e saem do script. Fotos em `e2e/fotos/modelos/tocas-cozinha-carrinhos/`
(os e2e `modelos-*.mjs` só fotografam). Ninguém jogou com eles.

**OS JOGOS NOVOS DE 16/11/2026 (pedido dele: "implemente esses jogos"; feitos por agentes, um por jogo, com arte só do que já
existia no projeto). Todos fora das conquistas da turma até ele decidir; em nenhum alguém jogou com gente (o equilíbrio é chute
medido contra o piloto automático); os Coletivos sem e2e com o LiveKit, só o teste do servidor.**
- **O COMANDO CENOURA** (`comando`, 1 a 4, nas duas abas): correr e atirar de lado, SÓ A MECÂNICA do gênero. Quatro arenas de uma
  tela (andarilho, atirador e voador: o cogumelo, o dino e a abelha da Quaternius) e o dragão no fim (fogo rente ao chão, pisão
  marcado, chamado). O lança-cenouras mira em OITO direções (para baixo, só no ar), granada com recarga de 4 s, tábuas sobre
  caixotes, três GAIOLAS de coelhinhos que dão reforço por 30 s (leque de três ou rápida), perdido com a vida; 3 vidas de 3 golpes;
  o bicho vira FUMAÇA, sem sangue. **A rede é a da Briga e do Chefe**: bichos, balas deles, gaiolas e granadas no servidor
  (`server/src/comando/motor.ts`, `minijogo-comando.ts`); cada tiro com número, origem e direção, o ritmo da arma conferido; o
  acerto conferido pelo caminho da bala contra o passado do bicho (0,8 s); o golpe levado decidido 200 ms depois. Contas em duas
  cópias iguais (`server/src/comando/conta.ts` ↔ `web/src/comando/conta.ts`). Sobra possível: o servidor não conhece as tábuas
  (ficar no alto até H_MAX). Pódio `pista: 'comando'`. Testes: `server/test/minijogos-comando.test.ts` (o piloto vence contra o
  servidor de verdade com 100 ms em cada sentido) e `e2e/comando.mjs`.
- **A MASMORRA DA TOCA** (`masmorra`, 1 a 4): masmorra vista de cima, SÓ A MECÂNICA. Sete salas de 17 × 11: entrada, salão dos
  cogumelos (tranca até limpar), a encruzilhada dos DOIS BOTÕES ao mesmo tempo (sozinho, o bloco segura um), o baú com a CENOURA
  QUE VAI E VOLTA, o lago (o cristal do outro lado só a cenoura alcança, e ele levanta a ponte), o corredor da porta trancada e o
  rei-cogumelo. A turma está sempre na MESMA sala. Pá de jardim, arrancada, 5 corações; cair volta à porta da sala em 3 s. **A rede
  é a da Briga**: o mundo é do servidor; cada coelho anda no próprio computador, conferido pela mesma conta de casas
  (`masmorra-regras.ts` ↔ `web/src/masmorra/regras.ts`); a posição leva o número de teleporte (`tp`: a atrasada da sala anterior
  é recusada, senão atravessava a água). Desenho por código; coelho e bichos das folhas da Briga. Pódio `pista: 'masmorra'`.
  Testes: `server/test/minijogos-masmorra.test.ts`, `web/test/masmorra.test.ts`, `e2e/masmorra.mjs`.
- **O RINGUE DA TOCA** (`ringue`): boxe de reflexo visto de trás contra três adversários do computador, SÓ A MECÂNICA. O golpe é
  AVISADO (a luva recua) e no meio do aviso a luva BRILHA: socar no brilho interrompe e dá estrela (a finta do trapaceiro nunca
  brilha). Esquivar, abaixar, defender; contra-ataque depois de esquivar de golpe forte; soco forte gasta as estrelas; socar a
  guarda cansa. O ligeiro (macaco), o pesado (yeti) e o trapaceiro (demônio-azul), das folhas da Briga ampliadas; quem cai vê
  estrelinhas. Rounds de 60 s, três por luta. **Regra num arquivo em duas cópias** (`ringue-sim.ts` ↔ `web/src/ringue/sim.ts`,
  sem seno, relógio nem import; o acaso por um gerador inteiro com a semente do servidor), o site manda os comandos e o servidor
  REFAZ. Solo com `ringue_recordes`; sala de 2 a 8 com a mesma semente; pódio `pista: 'ringue'`. Testes: `web/test/ringue.test.ts`,
  `server/test/minijogos-ringue.test.ts`, `e2e/ringue.mjs`.
- **A ROTA ESTELAR** (`estelar`): tiro em trilhos em 3D, SÓ A MECÂNICA do gênero (o pedido dele: "um equivalente ao Star Fox").
  Superfície de um planeta, o JIPE GIGANTE, subida ao espaço, a BIFURCAÇÃO (o lado da nave decide: rochas ou estação) e o POLVO DE
  LATA, ~2,5 min; escudo, anéis, TIRO TRAVADO (segurar trava no cone), PIRUETA que desvia, 3 bombas, laser duplo. **A rede é a da
  Esquadrilha** (`estelar-sim.ts` ↔ `web/src/estelar/sim.ts`, byte a byte): a mesma rota para a turma, os outros como alas
  translúcidas, o servidor refaz cada acerto pela Ficha; o golpe levado é quem leva que diz. Modelos do Space Base Bits (KayKit,
  CC0, `web/public/estelar/`; o PNG pede `git add -f`); nave, caçador e polvo por código; o coelho 3D na cabine. Solo com
  `estelar_recordes`; pódio `pista: 'estelar'`. Testes: `web/test/estelar.test.ts`, `server/test/minijogos-estelar.test.ts`,
  `e2e/estelar.mjs`.
- **O PLANADOR DA TOCA** (`planador`): voo com pouso no alvo, SÓ A MECÂNICA. Asa-delta pelos anéis até o alvo, mochila a jato até a
  plataforma com combustível contado, paraquedas (queda livre pelos anéis; sem abrir é batida). Pontos por anel, precisão,
  suavidade e bônus; tocar rápido demais é BATIDA. No Mode 7 da corrida com a câmera que sobe e inclina. **Regra em duas cópias**
  (`planador-sim.ts` ↔ `web/src/planador/sim.ts`): o servidor refaz o voo. Solo com `planador_recordes` por desafio e até 3
  fantasmas (amigos aceitos); sala de 2 a 8 pelos pontos, sem virar recorde. Pódio `pista: 'planador'`. Testes:
  `web/test/planador.test.ts`, `server/test/minijogos-planador.test.ts`, `e2e/planador.mjs`.
- **O PINBALL DA HORTA** (`pinball`): duas palhetas, mola, repolhos que rebatem, estilingues, cenouras que caem, a órbita, três
  pistas (multiplicador até ×5), a toca do coelho que solta o MULTIBOLA, bola salva, TRANCO. Desenho pixel a pixel por código.
  **Regra em duas cópias** (`pinball-sim.ts` ↔ `web/src/pinball/sim.ts`, só + − × ÷ e raiz): o site manda os comandos em TRECHOS e o
  servidor anda a mesa até o relógio dele; os pontos são os dele. Solo com `pinball_recordes` (amigos aceitos veem); sala de 2 a 8,
  3 minutos de mesa, pódio `pista: 'pinball'`. Testes: `web/test/pinball.test.ts`, `server/test/minijogos-pinball.test.ts`,
  `e2e/pinball.mjs`.
- **OS BICHOS DA TOCA** (`bichos`, o pedido dele: "um equivalente a Pokémon"): juntar bichos e lutar por turnos, SÓ A MECÂNICA.
  Nada de nome, bicho, bola, "-dex" nem tabela de franquia: seis elementos nossos (Folha, Brasa, Gota, Pedra, Vento, Faísca; cada
  um vence dois), os monstros da Quaternius da Briga, amizade com uma CENOURA; nomes próprios inventados (Brotel, Tisco, Bolhim…,
  a desafiante Nena), iguais em todo idioma. **Solo, a aventura** (`minijogo-bichos.ts`, `bichos-batalha.ts`): o campo de cima, o
  primeiro bicho entre três, o mato onde o SERVIDOR sorteia, luta por turnos (quem perde "pega no sono"), cenoura, chá, fuga,
  equipe de 6, nível e uma evolução, o desafio da Nena. A aventura mora no servidor (`bichos_aventuras`). **Sala, a mesa:** duas
  pessoas com as equipes guardadas (sem equipe, a emprestada); pódio só de quem vence (`pista: 'bichos'`). Regras em duas cópias
  (`server/src/bichos-regras.ts` ↔ `web/src/bichos/regras.ts`). **Pendente, aprovado por ele: a ARENA EM TEMPO REAL** (times de 3,
  1×1 ou 3 cada um por si, a rede da Briga). **A câmera é a do Poke2D Arena** (decisão dele, 17/11/2026; poke2darena.com, só a
  mecânica): arena VISTA DE CIMA, andar livre em todas as direções, mirar pelo mouse (joystick de 360° no toque), arrancada para
  desviar (sem pulo), a câmera SEGUE quem joga e setas na borda apontam o que caiu fora da tela; zonas de perigo marcadas no chão
  antes de bater, suprimentos (energia, cura, velocidade) em pontos fixos, troca do bicho ativo com recarga. A vista de lado, que eu
  tinha recomendado só porque as folhas eram de lado, caiu. **Quem luta na arena são OS COELHOS** (decisão dele, mesmo dia: "para
  tornar mais único e facilitar nosso trabalho"): cada um com o próprio coelho (a receita do criador: corpo, cores, acessórios), em
  pixel art do PixelLab, nunca renderizado do Blender (a regra de 09/11: no 2D, tudo PixelLab). Os bichos dão o elemento e os golpes:
  trocar o bicho ativo troca os ataques e a cor dos efeitos. O que existe hoje: o mascote-base nas 8 direções parado e nos estados, e
  as ANIMAÇÕES (andar, acenar) só nas 4 diagonais (o quarto só anda na diagonal). A arena nasce nas 4 diagonais, sem crédito (a
  arrancada é o andar com rastro, o golpe é o acenar com o efeito por código, levar golpe é piscar e recuar); as 4 retas (norte, sul,
  leste, oeste) de andar e acenar vêm quando houver crédito, ~20 gerações por corpo mais os acessórios nelas.
  **FEITA em 17/11/2026 (`arena`):** na largada dos Bichos se escolhe a luta por turnos (no Solo, a aventura; na sala, a mesa) ou a
  ARENA (`EscolhaDosBichos` em JogoArena.tsx), com 1×1, 3×3 (os robôs completam) e cada um por si; no Solo, contra 1 a 5 robôs ou
  o 3×3. O coelho de cada um vem de `arena/coelhos.ts` (as retas entram quando `coelho-camadas.py` as exportar); o bicho da frente
  (os três primeiros da aventura; sem ela, a emprestada) dá o kit de golpes (`KITS`), a cor e a defesa pela roda de bichos-regras.ts,
  amaciada (`fatorDaArena`: 1,5 e 0,67); o nível não conta. Cenários grama e praia, por código. **A rede é a da Briga e do Comando**
  (`server/src/arena/motor.ts`), as contas em duas cópias (`server/src/arena/conta.ts` ↔ `web/src/arena/conta.ts`). Troféu `pista:
  'bichos-arena'` (no Solo, nada); sem tabela nova; fora das conquistas da turma até ele decidir. Ninguém jogou com gente (o
  equilíbrio é chute medido contra o piloto); a sala só pelo teste do servidor, sem e2e com o LiveKit. Sobra possível: mentir a
  posição dentro da velocidade, e um programa que mire sozinho. A `LinhaDoTempo` da tela assume o passo de 50 ms: nas balas e nas
  zonas a arena conta pela chegada do quadro. Testes: `server/test/minijogos-bichos-arena.test.ts`, `web/test/arena.test.ts`,
  `e2e/bichos-arena.mjs` (passou, Solo).
  Testes: `server/test/minijogos-bichos.test.ts`, `e2e/bichos.mjs`.
- **AS LENDAS DA TOCA** (`lendas`, nas duas abas): o RPG de turnos da turma, SÓ A MECÂNICA do gênero dos anos 90 (a turma de heróis,
  a energia das habilidades, o ataque combinado, o equipamento depois da luta). Um caminho de cinco paradas: floresta, deserto, a
  fogueira (descanso), neve e o castelo do dragão. **A turma é sempre de quatro**: cada pessoa (1 a 4) escolhe a classe, e os robôs
  completam com as que faltam; as classes têm nome de COISA (Escudo, Faísca, Erva, Flecha), que não diz o sexo de ninguém. **A rede
  decidiu o turno: a rodada é de ESCOLHA AO MESMO TEMPO** (20 s, contados pelo servidor), e o servidor resolve a rodada inteira pela
  velocidade de cada um; ninguém espera a vez de ninguém, e quem não escolhe joga pelo robô. O COMBO: quem escolhe "Combo" na mesma
  rodada ataca junto, e o golpe soma o que cada classe sabe. O servidor decide tudo (`server/src/lendas-regras.ts`, sem banco). Sem
  tabela própria: só o troféu (`pista: 'lendas'`, só com o dragão vencido e 2 ou mais até o fim). Coelho e monstros das folhas da
  Briga. Testes: `server/test/minijogos-lendas.test.ts` e `e2e/lendas.mjs` (passou em 17/11/2026, o piloto até a vitória no Solo).
- **Os jogos de parceiros e os para baixar (pedido dele):** o Set with Friends e o Fishbowl rodam DENTRO do Syden como o Termo
  (`SITES_PARA_TRANSMITIR`, `embutir`, capas `CapaTrios`/`CapaMimica`; na frame-src do e2e E na Cloudflare, à mão; na política,
  `#jogos-de-parceiros`); OpenTTD e Unciv em "Para baixar e jogar junto" (`JOGOS_PARA_BAIXAR`). **Haxball, DDNet e Luanti NÃO
  entram** (decisão dele, 17/11/2026: "para não gerar atrito com a classificação etária"; o Haxball tem anúncio, e os três vivem de
  servidores públicos com conversa e conteúdo de desconhecidos). **O Set with Friends tem conversa PÚBLICA
  com desconhecidos, e NÃO APARECE PARA MENOR** (`conversaPublica`, `sitesParaMim`; a faixa da conta por `guardarFaixaDaConta` em
  protecao.ts; sem faixa conta como menor) — achado da auditoria da classificação de 17/11/2026, que não encontrou nada nos jogos
  que suba a classificação de 12 anos (violência de desenho, fumaça em vez de sangue, nada de aposta, álcool ou drogas).
- **Um clone do GTA2, avaliado em 17/11/2026: NÃO**, porque crime, atropelar e atirar em pedestres levam o app a 16/18 e fecham os
  adolescentes. O que cabe e foi oferecido: a cidade vista de cima SEM crime (entregas, táxi, corridas, perseguições de desenho).

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

**OS ASSETS LIVRES (20/11/2026, pedido dele: "faça uma pesquisa por assets para os minigames", e depois "faça tudo"; feito por
agentes, um por frente).** Créditos nos termos, seção 10.
- **Os sons são amostras da Kenney (CC0)**, com o sintetizado de reserva: `somDosJogos.ts` toca a amostra do efeito
  (`sonsDosJogosAmostras.ts`: versões e volume por efeito; `web/public/sons/`, com `FONTES.txt`), baixada no primeiro uso, com um
  sorteio leve de altura e volume. Água, derrapagem, serra, chiado, torcida e o motor do kart seguem sintetizados (nenhum pacote serviu).
  As amostras saem de `web/scripts/sons-dos-jogos.mjs` (ffmpeg). **Ninguém ouviu as escolhas**: foram pelo nome e pela medida de volume.
- **A MÚSICA ENTROU, de terceiro e livre** (aprovado por ele com a REGRA DE ORIGEM: autor com histórico conhecido, faixa com página
  própria e licença declarada nela, nada de coletânea de terceiros nem de música feita com IA, nada de SA/NC; a origem de cada faixa em
  `web/public/musica/LEIA-ME.txt`). Hoje: três faixas CC0 de Juhani Junkala ("5 Chiptunes (Action)"), uma na Corrida, uma no Jato e
  uma na Regata, SÓ com a corrida rodando (`musicaDosJogos.ts`, `useMusicaDoJogo`): volume baixo, cala com o mudo dos jogos, com o
  "Desativar áudio" e sem foco. "Pure Raceway"/"Joyful Jungle" (MintoDog) ficaram de fora pela regra (conta nova e prolífica).
  Compor continua proibido; jogo de ritmo continua esperando música licenciada que sirva.
- **Arte de cenário da Kenney (CC0), só cenário e objetos (os personagens continuam nossos):** a Caça virou barraca de tiro (Shooting
  Gallery e Crosshair Pack, `web/public/caca/`; patos e alvos do pacote, NÃO: lembram o Duck Hunt); a Masmorra, o Tiny Dungeon
  (`web/public/masmorra/cenario.png`, por `web/scripts/masmorra-cenario.mjs`; o "vaso" aparece como barril, porque o pacote não tem vaso
  — a confirmar com ele); o Pulo, o Pixel Platformer (as figuras de 18 px perdem as colunas do meio para caber na grade de 16); a
  Esquadrilha, o chão, as explosões e os itens do Pixel Shmup (`nave/arte.ts`). Céus da Kenney (Skyboxes, `web/src/ceus.ts`) na Rota
  Estelar, no Minigolfe 3D e na Gincana. Em todos, o desenho por código continua como reserva enquanto a imagem carrega.
- **Ficou como estava, de propósito:** as cartas do Truco e as pedras do Dominó (o KayKit de hoje é melhor que o Playing Cards da Kenney,
  e a Kenney não tem dominó); o parallax do ansimuz no Pulo (brigava com os blocos chapados). As teclas da Briga e do Comando já eram
  o Input Prompts; só a Festa as desenhava por código, e agora usa `TeclaDesenhada.tsx` (as setas destacadas e o ␣ no lugar de "SPACE").
- **A música chegou aos outros jogos (20/11/2026, pedido dele: "coloque música em jogos sem nada").** Mais 25 faixas CC0 de Juhani Junkala, de outros seis pacotes dele no OpenGameArt (4 Chiptunes Adventure, 12 Music Loops, JRPG Pack 1, 2, 4 e 5), com a origem de cada uma em `web/public/musica/LEIA-ME.txt`. Quem decide a faixa de cada jogo é `TRILHA_DO_JOGO`, em `musicaDosJogos.ts`, tocada por `useMusicaDaPartida` no Minijogo.tsx enquanto a partida corre. Corrida, Jato e Regata continuam pedindo a deles por dentro, e o Solo do Pulo também. **Sem música, de propósito, onde a conversa é o jogo:** Stop, Lobisomem, Desenha e adivinha, Palavra secreta, os quizzes e o Truco. Nas mesas, no Sudoku e nos Problemas de xadrez, uma faixa calma ainda mais baixa (`VOLUME_CALMO`). Jogo novo pede a linha dele na tabela, e o teste cobra. Ninguém ouviu as escolhas. Desde o lote C, a música para em toda pausa do Solo.
- **Para baixar da Kenney**, o curl recebe 403: o zip sai pela página num Chrome de verdade (ou `/download-link/<id>` com o cookie dela).

**O XADREZ (05/11/2026, pedido dele: "adicione xadrez também, com os assets"):** a partida inteira, ao lado dos Problemas de
xadrez, na mesa de duas pessoas e no Solo contra o robô (`server/src/minijogo-partida-de-xadrez.ts`, id `partida-de-xadrez`). As
regras são do chess.js (BSD-2): o servidor gera os lances e o site só escolhe; a promoção é sempre a dama. O robô olha o lance dele
e a resposta, mais as capturas que sobram (abaixo de 1,5 s; o teste confere). Em 3D com o tabuleiro e as peças do KayKit Board
Game Bits (`web/src/xadrez3d/`), o tabuleiro de botões por baixo. Fora das conquistas da turma até ele decidir.

**MAIS 3D E DOIS JOGOS NOVOS (05/11/2026, pedidos dele):** Damas, Truco, Dominó e os dados do Cidades em 3D (`web/src/mesa3d/`, a base
comum e o gancho `useCena3D`; KayKit Board Game Bits). A **Cozinha da toca** (`minijogo-cozinha.ts`, `JogoCozinha.tsx`; KayKit Restaurant
Bits): CADA UM NA PRÓPRIA COZINHA, os mesmos pedidos (a abordagem aprovada por ele, pela lição do Overcooked acima); o servidor confere cada
prato pela receita. **A etapa de cozinhar no ponto (06/11/2026, pedido dele, com o pacote de comida da Quaternius, CC0):** o PONTO
é do SERVIDOR, também no Solo (por isso a Cozinha não pausa): a tela manda "pus na estação N" e "tirei" na hora, numa fila (o "tirei"
nunca passa o "pus"), e o servidor mede pelo relógio dele (`estadoNoFogo` em `cozinha-receitas.ts`, folga de 400 ms a favor de quem
joga); cada item que ele viu sair no ponto vira uma FICHA, e o prato só vale com a ficha de cada cozido (o "está no ponto" da tela não
conta). Queimado não serve receita nenhuma: lixeira. O fogo da tela anda pela hora de verdade (sem foco nada se desenha, mas queima). O
medidor em cima do fogo é a régua cru / ponto (verde) / queimando (os últimos 40% antes de queimar, vermelha), com fumaça clara e o
chiado passando do ponto e escura com o queimado. A planta passou a 12 × 5 (três fogões; as estações de fogo em `ESTACOES_DE_FOGO`, que
o teste confere com a planta), com bacon e bife; receitas novas: café da manhã, x-bacon, bife com arroz e bife com salada. Os modelos
(bacon, bife, ovo frito e queimado) saem por `e2e/3D/cozinha-quaternius/converter.py` (Blender) para `web/public/cozinha/quaternius/`,
com as cores clareadas na carga para casar com a KayKit. O **Rolê do coelho** (`minijogo-skate.ts`, `JogoSkate.tsx`; Kenney Mini Skate): skate de 1 minuto (eram 2 até 06/11/2026; o recorde recomeçou em `skate_recordes_1min`) com combos, só a
mecânica (nada de Tony Hawk). **Na SALA desde 06/11/2026** (pedido dele: "um modo com mais pessoas no skate, com fantasmas como no jogo de
corrida"), de 2 a 8: o servidor dá o verde, cada um anda na própria pista e manda a posição 15 vezes por segundo (conferida por alto:
dentro da pista, sem passo à frente do relógio, sem salto), que o servidor REPASSA; os outros aparecem como FANTASMAS (o coelho de cada um
com as cores do avatar, meio transparente, a prancha também, e o nome em cima), 6 passos atrás do meu e interpolados, sem batida; a ordem
ao vivo no canto (pelos pontos que cada um diz ter); quem não joga assiste pela câmera de quem tem mais pontos; sem pausa. **O SERVIDOR
REFAZ A SESSÃO** (no Solo também): a física e a pista são DUAS CÓPIAS IGUAIS BYTE A BYTE (`web/src/skate/{fisica,pista}.ts` ↔
`server/src/skate/`; `web/test/skate.test.ts` confere; só + − × ÷ e raiz, nada de seno, sorteio ou relógio), o site manda os comandos de
cada passo em trechos (8 bits), e os pontos e o melhor combo que valem são os refeitos; a sessão não anda mais passos do que passou desde
o verde (+3 s). Pódio na estante (`pista: 'skate'`, os pontos); sem itens, a sessão da sala que bate o recorde da pessoa vira o recorde
(como no Pulo). Fora das conquistas da turma até ele decidir. Testes: `server/test/minijogos-skate.test.ts` (a sala de 3 com o piloto) e
`e2e/skate-na-sala.mjs` (passou, duas pessoas com o LiveKit). Sobra possível: um programa que ache comandos melhores. No xadrez, a promoção deixa escolher a peça. O jogo de
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
- **Tocas e Torres num estilo só, o Medieval Hexagon da KayKit (06/11/2026, pedido dele):** saíram o Quaternius e o Kenney do jogo.
  Os prédios vêm por TIME (o pacote traz o arquivo azul e o vermelho, as nossas duas cores; `{cor}` nos nomes de `cena.ts`), a
  Maravilha é o castelo, a muralha é o trecho do pacote encolhido e engrossado (torrezinha do time nas quinas), a obra tem três etapas
  (canteiro, paredes, andaime), o prédio derrubado vira ruína e a catapulta tomba; armas, flechas, a bola da catapulta, bandeiras,
  árvores (com o toco que fica), pedras e a mina (rocha + pepitas do Resource Bits) são do pacote. **Só a tela mudou**: a catapulta e
  os tiros já existiam na simulação. Os LADRILHOS hexagonais ficaram de fora (a grade é quadrada); o trigo é hexagonal, e passa.
  Cada pacote da KayKit pinta com UMA textura: os modelos dividem um material por pacote. Cavaleiro a cavalo (o pacote tem o
  cavalo) pediria a pose do coelho montado. Modelo novo: `web/scripts/tocas-modelos.mjs`.
- **Tocas e Torres, a terceira rodada (pedidos dele, 06/11/2026):** **uma bandeira só**, a do ponto de reunião (o estandarte no canto
  de cada prédio saiu: confundia com ela). **Os atalhos são ÍCONES** ao lado do minimapa (Game Icons da Kenney: centro da vila,
  trabalhador parado com o número, exército, e o sino do lucide), e **o CURSOR diz o que o botão direito vai fazer** (`cursorDeHud`
  em `iconesDeHud.tsx`: o ícone branco com contorno escuro, 32 px): mão (andar), cesta (colher), mira (atacar), chave (construir),
  bandeira (reunião). **REGRA NOVA, a CAPACIDADE** (`CAPACIDADE` em `sim.ts`): a fazenda é de 1 trabalhador e a MINA (o bloco de
  ouro encostado inteiro, `minaDe`) de 5, POR DONO; a árvore não tem limite. Quem passa do limite vai a outro lugar igual com vaga a
  até 12 casas, ou fica parado ao lado com o aviso "Este lugar já está cheio."; a tela mostra o selo "n/cap" sobre cada fazenda pronta
  e mina vista. O computador não manda à mina do meio enquanto a de casa existir (com o teto, o piloto automático ganha 7 de 10
  sementes, e não mais todas). **REGRA NOVA, o SINO do centro** (comando `sino`, pronto para o lockstep): o primeiro toque manda
  todos os trabalhadores para DENTRO (deixam a carga no estoque, somem do mapa, não apanham nem recebem ordem) e o centro solta uma
  flecha a mais a cada 2 abrigados (até 5 a mais); o segundo toque os devolve ao que faziam. **Só desenho:** o martelo gigante
  (o do pacote, ou desenhado no 2D) bate na obra enquanto alguém trabalha nela, e quem colhe na fazenda anda pelas fileiras dela
  (`passeioNaFazenda` em `vista.ts`; na simulação ele colhe na beira). Os dois andam pelo tempo da tela, que para sem foco.
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
    **Os ajustes de 06/11/2026 (pedidos dele):** quem perde balão RODOPIA (duas voltas em 1 s, com a câmera parada); os
    obstáculos ficam DE PÉ (blocos com tampa, muretas no lago e no canteiro, a cerca; `solidosNaTela`), e a faixa de
    `MARGEM_DO_KART` (4) em volta de cada um é parede, pintada como a sombra: o kart bate onde o desenho bate; a caixa é quase
    do tamanho do kart (`RAIO_DA_CAIXA` 12 → 16); e a **BATIDA**: quem vem a 150/s ou mais (só o turbo: o normal é 140) e
    encosta (a menos de 12) em quem não vem estoura um balão dele, uma por par a cada 3 s, sem empurrão. Quem leva avisa
    ('batida'), e o servidor confere sozinho pelas posições dos dois, como os itens. Os robôs usam a cenoura para bater.
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
  - **OS MINIJOGOS DO MARIO PARTY 3 (05/11/2026, pedido dele: "implemente os jogos das classes A, B e C"):** 37 microjogos novos na
    Festa (10 → 47, contados no registro em 06/11/2026; o "51 → 61" anotado antes estava errado), em seis lotes (`loteN.ts`), cada um com robô, teste de servidor e a jogada honesta em
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

**OS CARRINHOS DA TOCA (06/11/2026, pedido dele: "um jogo de autorama"; "Autorama" é marca da Estrela, por isso o nome):**
`carrinhos`, nas duas abas. A pista de brinquedo de 4 faixas em 3D (Toy Car Kit da Kenney, CC0: duas fileiras de peças largas, a
curva pequena dentro da grande), o carro preso à faixa e quem joga SÓ ACELERA (Espaço/↑, mouse, toque; o gatilho do controle é
analógico). Acima da velocidade da curva, 1 de folga em que o carro treme; passou, sai voando, fica fora 1,75 s e volta parado,
piscando, ao lugar de onde saiu. Cinco voltas. **A regra é um arquivo só nas duas pontas** (`carrinhos-sim.ts` ↔
`web/src/carrinhos/sim.ts`, byte a byte): o site manda o ACELERADOR de cada passo em trechos e o servidor REFAZ a corrida; o
fantasma é esse acelerador. **A velocidade de cada raio de curva foi medida para nenhuma faixa ganhar** (a de dentro é mais curta;
o piloto automático faz a mesma volta nas quatro, o teste cobra 1%): mexeu no traçado ou nos números, medir de novo. Solo na faixa
do recorde (`carrinhos_recordes`, só amigos aceitos veem), com 0 a 3 robôs do site (erram de vez em quando); na sala, de 2 a 4,
cada um na sua faixa, e a corrida da sala NÃO vira recorde (a faixa é outra). Pódio com `pista: 'carrinhos'`. Testes:
`web/test/carrinhos.test.ts`, `server/test/minijogos-carrinhos.test.ts`, `e2e/carrinhos.mjs`, `e2e/carrinhos-na-sala.mjs`.

**A GINCANA DA TOCA (06/11/2026, pedido dele: "um minigame para chegar ao final do mapa, com esses assets que já temos"):**
`gincana`, nas duas abas, a corrida de obstáculos em 3D com o Platformer Pack da KayKit (CC0; só as peças usadas, em
`web/public/gincana/`). Só a mecânica do gênero: nada de nome nem arte de jogo existente. O coelho 3D corre, pula (folga da beirada,
pulo guardado, soltar corta) e se equilibra até a bandeira; caiu do mapa, serra ou espinho, volta à última bandeira. Três percursos
POR ROTEIRO (`ROTEIROS` em `gincana/sim.ts`: pedras, rampa, esteira, serras, varredores, blocos vermelhos que caem, plataformas que
andam, espinhos, canhões, mola; ~25–50 s com o piloto perfeito). **A regra é um arquivo só nas duas pontas** (`gincana-sim.ts` ↔
`web/src/gincana/sim.ts`) e a conferência é a dos Carrinhos: o site manda os COMANDOS de cada passo e o servidor REFAZ o percurso.
Tudo que se mexe anda pelo passo (o giro dos varredores numa tabela feita por multiplicação, sem seno); só os blocos que caem são de
cada um. A câmera fica atrás olhando o +z, e por isso o percurso é reto (a direita de quem joga é o −x da regra). Solo com
`gincana_recordes` por percurso e os fantasmas dos amigos; na sala (2 a 8), as posições conferidas por `posicaoPossivel` (salto só de
volta a uma bandeira alcançada), quem recarrega no meio assiste, e a corrida da sala vira recorde (sem itens). Pódio com
`pista: 'gincana'`; fora das conquistas até ele decidir. O que sobra possível: um programa que ache os comandos perfeitos, e posições
ao vivo inventadas dentro do que um coelho anda (só desenho). Percurso novo é id novo. Testes: `web/test/gincana.test.ts`,
`server/test/minijogos-gincana.test.ts`, `e2e/gincana.mjs` e `e2e/gincana-na-sala.mjs` (passaram; o piloto automático planeja por
busca em feixe, `gincana/piloto.ts`, ligado por `window.gincanaPilotoAutomatico` só em desenvolvimento). Ninguém jogou com gente.

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
**O ESTILO É DO QUARTO E DO SALÃO; CADA JOGO TEM A SUA ESTÉTICA (decisão dele, 06/11/2026, corrigindo um mal-entendido do
mesmo dia):** "uma escolha para tudo" quer dizer que a POSIÇÃO de cada peça no quarto 2D tem o OBJETO EQUIVALENTE 3D na MESMA
POSIÇÃO — a arrumação é uma só, e o 2D e o 3D são dois jeitos de desenhá-la. "Para os mini jogos, é uma estética única": os jogos
NÃO seguem o Estilo visual (Truco, Dominó, Damas, Xadrez, Batalha naval, Capitais, Tocas e Torres abrem sempre em 3D; o 2D só sem
WebGL, se o 3D falhar, e para o teclado e o leitor de tela). Antes disso, o botão do quarto em pixel art passava esses jogos para 2D.
**O QUARTO 3D FOI AO APP (06/11/2026, pedido dele: "quero esse quarto 3D low poly como PILOTO da nossa funcionalidade de variação
estética; um ícone no quarto que alterne entre 3D e Pixel Art; não implemente no salão ainda"):** `web/src/quarto3d/` (a cena num
pedaço à parte, os modelos em `web/public/quarto3d/`) e `web/src/QuartoComEstilo.tsx` (o botão do canto: o xadrezinho de pixels e o
cubo, "Estilo visual: 2D/3D", texto que já existia nos 80). **O botão e Gráficos mexem na MESMA escolha**, na hora, sem recarregar — e
por isso o pixel art no quarto põe o Cidades em 2D também. **O padrão do QUARTO é o pixel art** (`estiloDoQuarto()`: só vai ao 3D quem
escolheu, `estiloEscolhido` em 'syden:graficos'; um '3d' guardado sem a marca era o de fábrica gravado junto com as sombras); o do
Cidades continua 3D. **Mudar o padrão do quarto é decisão dele.** No 3D: as funções nos MESMOS objetos do pixel (o guarda-roupa →
Guarda-roupa, a mesa → Mini-games com o coelho sentando na cadeira antes, o fone da parede → Salas, o quadro de fotos → Amigos, a cortiça →
ideias, a janela → Explorar, o criado-mudo com o abajur → Dia e noite, a prateleira dos troféus → Troféus), realce e nome ao passar o
mouse, o coelho com as cores do avatar no estado de verdade (ausente dorme na cama, em chamada na cadeira; volta ao lugar 8 s depois de
usar uma função), as sombras de Gráficos, no máximo 30 quadros por segundo, nada sem foco. Sem WebGL, contexto perdido ou 20 s sem ficar
pronto, volta o pixel art sozinho. Teste: `e2e/quarto3d.mjs` (nos dois temas).
**O 3D DESENHA A ARRUMAÇÃO DO PIXEL (decisão dele, 06/11/2026: "a POSIÇÃO do item no quarto 2D terá o OBJETO EQUIVALENTE 3D na MESMA
POSIÇÃO"):** o 3D não tem arrumação própria. Ele lê a que o servidor guarda (`/api/quarto`, e `/api/quarto/:id` na visita: quem visita
vê o quarto da pessoa nos dois estilos) e `web/src/quarto3d/arrumacao.ts` a traduz: a planta (o de sempre, o L com o pilar, o cubículo),
os móveis na casa e no giro (no pixel, a parede da direita é u = 0 e a da esquerda v = 0; no 3D, x = v e z = u, e os lados batem), a
cadeira onde parou, a janela e os objetos da parede no trecho deles (as casas que ocupam e a altura em px, 3/195 por px), os objetos de
cima no tampo, as cores do tapete, da parede e do piso, os guardados e as cópias ("cama~2", sem função). Arrumar continua só no pixel
(o Editar). O que a página do pixel sabe e o servidor não guarda (as plantas, a arrumação de fábrica de cada planta, o tamanho de cada
móvel na grade, onde cada objeto foi pintado) foi COPIADO de `montar.mjs` e do `quarto.html`, e `web/test/quarto3d-arrumacao.test.ts`
confere contra eles: **peça nova no pixel pede a linha dela em `arrumacao.ts` e o modelo dela em cada tema** (o teste cobra). Sem
desenho no 3D: a cortina fechada e a janela aberta da grande, e o tipo da janela (todas viram a janela do tema, na largura do vão).
**OS TEMAS DO 3D (pedido dele, mesmo dia: "presets para o usuário escolher de base", que viraram CONJUNTOS DE MODELOS da mesma
arrumação):** `web/src/quarto3d/temas.ts`, uma tabela peça do pixel → modelo por tema. O **clássico** (KayKit e Kenney, o piloto; a mesa é a
comprida com os três monitores: o pé dela no pixel é 3 × 1 e o L de antes não cabe) e o **colorido** (Tiny Treats, de Isa Lousberg, CC0,
em `web/public/quarto3d/tinytreats/`: a cama de solteiro do pacote, um tanto maior, com o ursinho; o criado-mudo com o abajur e o
despertador; o guarda-roupa é a CÔMODA com a vitrola, porque o pacote não tem armário alto; a mesa com o computador antigo; a cadeira; a
cadeira de balanço é a poltrona; o banquinho, o pufe; o tapete, a monstera e a espada-de-são-jorge; as paredes de lambri da sala, a janela
grande de três peças, as tábuas do quarto; três molduras com fotos desenhadas no lugar da imagem de exemplo; a caneca de patinho, o bolo, a
latinha). As comidas de cima que nenhum dos dois tem vêm do Food Kit do Kenney (`web/public/quarto3d/comida/`). O que nenhum pacote tem é
feito por código: o fone pendurado, a cortiça, os troféus, o neon, o violão e o relógio do clássico. **No colorido, as peças paradas
viram UMA malha só** (o chão, as paredes, as plantas, o tapete e os objetos de parede sem função; os originais ficam invisíveis no lugar,
para o clique). A escolha é o botão das poltronas ao lado do 2D/3D, só no 3D ("Móveis: Clássico/Colorido", nos 80), lembrada NO APARELHO
('syden:quarto3d-tema'): o servidor não guarda tema (o `cores` da arrumação seria o lugar, mas a página do pixel tira dele o que não
conhece), então **quem visita vê o quarto da pessoa no tema que ELE escolheu**. Ficaram de fora do colorido, por não terem peça
equivalente no pixel: a lareira, o aquário com o peixe, as velas e o relógio de pé (entram quando o pixel ganhar a peça). **O terceiro
tema** é só mais uma entrada em `TEMAS`: o candidato é o Furniture Kit inteiro do Kenney, mais anguloso. Medido (Chrome de teste, sem
placa, o quarto de fábrica): clássico ~1,1–1,6 ms por quadro, 84 chamadas, ~43 mil triângulos; colorido ~1,3–2,8 ms, 77 chamadas, ~58 mil;
com sombras, 142 e 130 chamadas. O salão 3D lê modelos de `quarto3d/`: os que o quarto deixou de usar (desk, lamp_desk_headphones,
table_small…) ficaram lá.
**O SALÃO 3D E O NATAL (06/11/2026, pedido dele: "testar o cenário de datas comemorativas, começando pelo Natal, no salão em 3D"; o
"não implemente no salão ainda" de antes caiu):** `web/src/salao3d/` (a cena num pedaço à parte; os modelos novos em `web/public/salao3d/`,
os do quarto 3D lidos de `quarto3d/`) e `web/src/SalaoComEstilo.tsx` (o mesmo botão do canto, na MESMA escolha; o padrão é o do quarto, o
pixel art). Um salão 12 × 12 que cabe inteiro na caixa 4:3, sem câmera que anda, com as paredes de tijolo e as luzinhas. As funções nos
mesmos objetos do pixel art: TV → voz ou assistir (o Ao vivo e quem transmite pintados na tela, as setas de canal com mais de uma), fliperama →
Mini-games, estante → a conversa, balcão e o coelho dele → o recado (um balão em cima dele, e ele "fala"), quadro → a capa (ou o ícone) e o
Montar a tela de quem administra, a prateleira com os troféus → Conquistas, a jukebox e o microfone → karaokê; a janela é ambientação. Clicar
abre na hora (o salão não é de uma pessoa: ninguém anda até o objeto). Quem está na call com as cores do avatar e o nome em cima: o sofá, as
poltronas, as banquetas, a mesa de jogos e de pé; quem transmite na frente da TV, quem joga no fliperama; sem ninguém, vazio. O fliperama, a
jukebox, o microfone, o troféu, a janela e as telas são feitos por código. **A arrumação no 3D é a de fábrica; o Editar continua no pixel
art.** Medido (Chrome de teste, sem placa): ~1,4 ms por quadro, 132 chamadas, ~140 mil triângulos (4 coelhos); no Natal ~2–2,6 ms, 170
chamadas, ~186 mil; com sombras, ~2,9 ms e 294 chamadas. Teste: `e2e/salao3d.mjs`.
**AS DATAS COMEMORATIVAS (a regra, mesmo dia):** um conjunto de época aparece SOZINHO pela data do aparelho (`salao3d/epocas.ts`: o mês e o
dia de começo e de fim), igual para a turma inteira, sem servidor, e some sozinho — sem contagem, sem "pegue antes que acabe" (a regra da caixa
de correio). Época nova é uma linha em `EPOCAS` e a montagem dela na cena. **O Natal vai de 1º de dezembro ao Dia de Reis (6 de janeiro)**
(escolha minha, a confirmar com ele): a árvore com os presentes, o trenzinho dando a volta nela no trilho oval (para sem foco e com "menos
movimento"), a casinha de gengibre, o boneco de neve, o poste com as bolas de neve, a poltrona vermelha com o pufe e o leite com biscoitos, as
guirlandas, as luzinhas coloridas, neve no peitoril e, com Partículas ligado, neve leve caindo. **O coelho do recado recebe sentado na poltrona**
(clicar nele ou nela abre o recado), e a mesa de jogos sai para dar lugar. Tudo do Holiday Bits (KayKit, EXTRA): o pacote não traz o arquivo
de licença, e a página oficial declara CC0 (conferido em 06/11/2026; a nota em `web/public/salao3d/LICENCA-KayKit-Holiday-Bits.txt`; o crédito
nos termos, seção 10). **Ver antes de dezembro, só no site de desenvolvimento:** `?natal` no endereço (ou `window.salao3dNatal = true`);
`?sem-epoca` tira. Só no 3D: o salão de pixel art não tem Natal.
**O BANHEIRO DO SALÃO 3D (06/11/2026, pedido dele, pela foto do Bubbly Bathroom do Tiny Treats) É UM CÔMODO À PARTE, ATRÁS DA PORTA.** A
primeira versão, um canto do salão com muretas, ele corrigiu no mesmo dia: "o banheiro é para ficar atrás da porta; é um cômodo à parte".
No salão (que voltou às paredes inteiras e à arrumação de antes do banheiro: o quadro, a estante, a janela e o troféu no fundo), a PORTA
DO BANHEIRO fica na parede da esquerda, entre a planta do canto e a TV: a folha do Tiny Treats, fechada, com moldura e a plaquinha do
patinho (sem texto). Clicar (ou o botão escondido do leitor de tela) abre a porta e a câmera PASSA para o banheiro, que mora longe na mesma
cena (`BANHEIRO.origem`, x = 40, fora da vista do salão), enquadrado sozinho como casa de boneca (as duas paredes do fundo inteiras, de
azulejo, e as da frente cortadas em muretas de 0,5). Lá, a porta de dentro, o botão ‹ do canto e o Esc voltam; os nomes da call, o recado e
as setas da TV somem, e os coelhos ficam escondidos (o three.js os desenha sempre: o esqueleto mexe e eles não passam pelo corte da
câmera). Ninguém da call vai ao banheiro. Os textos são os da porta do salão de pixel art ("Porta do banheiro", "Dá no banheiro. Bata antes
de entrar.") e o "Fechar" no botão de voltar: nenhum texto novo. Dentro, tudo o que tinha: a banheira com espuma e o PATINHO boiando (para
sem foco e com "menos movimento"), a pia no balcão azul, o espelho, a prateleira com a vela (que acende de noite), a planta e os frascos, o
vaso com o papel e o lixinho, o tapete rosa com os chinelos e as toalhas, o piso verde-água; as peças paradas são UMA malha só. Custo: o
salão ficou com 138 chamadas e 140 mil triângulos (eram 142 e 152 mil com o canto), e o banheiro sozinho, 19 chamadas e 13 mil. Os modelos
em `web/public/salao3d/banheiro/` (Tiny Treats, de Isa Lousberg, CC0; o crédito nos termos, seção 10). O e2e confere a porta, a ida e a
volta (pelo clique, pelo teclado e pelo botão), o patinho e a call cheia (12, cada um no seu lugar no salão, ninguém na frente da porta).
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

**O TRÂNSITO DA TOCA (06/11/2026, pedido dele, com os pacotes Isometric Buildings e Isometric Vehicles da Kenney, CC0):** um minuto num
cruzamento isométrico; os carros chegam pelas quatro pontas e param na faixa, e clicar na rua (ou Q, E, C, Z, as pontas do teclado como
as do mapa) solta o primeiro da fila, que segue reto ou vira (a seta pisca). Carros de ruas diferentes que se encostam BATEM: menos 3
pontos, a sequência zera e o cruzamento TRAVA 2 s com a batida à vista — escolhido em vez de acabar a partida, porque num minuto perder
tudo aos 10 s tira a graça. Fila cheia buzina e custa 1 ponto (esperar não é a jogada segura). 1 por carro, a ambulância 3, +5 a cada 10
seguidos. **A regra é um arquivo só, em duas cópias iguais byte a byte** (`web/src/transito/sim.ts` ↔ `server/src/transito-sim.ts`): o site
joga e manda só as liberações [passo, rua], e o servidor REFAZ a partida com a mesma semente (os pontos são dele). Solo com recorde
(`transito_recordes`) e ESC; Coletivo com a mesma semente para a turma e o pódio (`pista: 'transito'`). Os prédios cortam o lado da laje
(fica abaixo do chão), e a linha e a coluna na frente das ruas são calçada sem prédio, para nada esconder a faixa de perto. Os carros
civis da Kenney não dizem a direção no nome: os quadros das diagonais estão em `web/scripts/transito-atlas.mjs`. Fora, de propósito:
mais de um cruzamento e semáforo. Ninguém jogou com gente: o ritmo das chegadas é chute medido contra o piloto (`window.transitoPilotoAutomatico`).
Testes: `web/test/transito.test.ts`, `server/test/minijogos-transito.test.ts`, `e2e/transito.mjs` (passou).

**A PONTE DA TOCA (06/11/2026, pedido dele: "30 segundos para montar a ponte; ganha quem usar menos recursos e fizer o tráfego
atravessar"; só a mecânica do gênero, nada de Poly Bridge):** `ponte`, nas duas abas, 2D de lado e tudo por código. Três peças: a
PISTA (a única por onde o tráfego passa, até 45°, 150 por casa), a MADEIRA (100, aguenta pouco) e o AÇO (300, mais forte e mais longo);
o custo é preço × comprimento. Arrastar de um nó (o apoio vermelho ou a ponta de uma peça) põe a peça; clicar vai em corrente; botão
direito ou "Apagar" tira (o que fica solto cai junto); Ctrl+Z; pelo teclado, setas, Enter, Delete e 1/2/3. "Testar" roda o tráfego ali
mesmo SEM parar o relógio; "Pronto" ou o fim dos 30 s manda a lista. **A física é um arquivo só, nas duas cópias iguais byte a byte**
(`web/src/ponte/sim.ts` ↔ `server/src/ponte-sim.ts`): massa-mola, passo de 1/60 s em 16 subpassos, só + − × ÷ e raiz; a peça cuja
força passa do limite do tipo QUEBRA; o peso da ponte entra aos poucos em 0,75 s (de uma vez, o tranco quebrava treliças boas); cada
veículo é uma carga que anda na pista embaixo dele e cai sem ela. O site manda só [ax, ay, bx, by, tipo, ...]; o servidor confere
(`conferir`: a grade da fase, o comprimento, nada repetido, tudo ligado a um apoio) e REFAZ; o resultado é dele. Na sala, o relógio é o
do servidor (a ponte depois dos 30 s + 2,5 s é recusada); no Solo, o do computador, com ESC. Placar: quem passou pelo MENOR custo, depois
quem caiu pelo quanto o tráfego andou; no fim todos veem as pontes de todos, a vencedora primeiro. Cinco fases (riacho, rio, ravina, os
pilares só com apoio no alto, e o vão com a pedra no meio, onde o caminhão pede aço); `pontePronta` dá uma ponte que passa em cada uma
(o teste cobra). Solo com o recorde por fase (`ponte_recordes`, na política e no "Levar seus dados"); pódio só de quem passou
(`pista: 'ponte'`, os pontos são o custo). Fora das conquistas da turma até ele decidir. O equilíbrio (limites, pesos, preços) é chute
medido contra as pontes de referência: ninguém jogou. Testes: `web/test/ponte.test.ts`, `server/test/minijogos-ponte.test.ts`,
`e2e/ponte.mjs` e `e2e/ponte-na-sala.mjs` (passaram).
**Os três relatos dele no mesmo dia, feitos:** (1) **"o jogador não sabe qual veículo precisa passar"**: desde a montagem, o tráfego da
fase espera na margem de partida, NA ORDEM em que vai passar (o primeiro mais perto da ponte), cada um com o SELO DO PESO (um peso de
academia com o número, maior quanto mais pesado; sem texto novo). A fila é só do desenho (`web/src/ponte/fila.ts`): a regra põe todos na
SAIDA e solta um por vez, e a fila encosta no da frente e chega à SAIDA antes de a regra soltar (o teste cobra: nada pula). (2) **a HUD
SEMPRE DENTRO DA TELA**, como o Duelo: as peças, os botões, o custo e o relógio por cima do quadro, e os comandos num cartão só na
contagem e nos primeiros 4 s (nunca no teste nem no celular); a moldura é um contêiner, e na tela estreita os botões ficam só com a
figura. (3) **Em 3D** (`web/src/ponte/cena3d.ts`, three.js num pedaço à parte), com a FÍSICA IGUAL (as duas cópias não mudaram): uma
maquete de lado, de cima e de viés, com as margens cortadas na frente e o rio (ou a ravina) correndo para o fundo; DUAS treliças (a da
frente no plano em que se monta, onde o mouse é projetado e a grade aparece, a de trás espelhada, com os pinos entre elas) e a pista de
tábuas atravessada; as peças numa malha de instâncias por tipo, com a textura repetindo pelo comprimento e a cor do esforço PINTADA por
cima (multiplicar sujava a madeira). Os veículos são o sedã e o caminhão de entrega do Car Kit (Kenney) e a carroça do Halloween Bits
(KayKit), puxada pelo nosso coelho 3D, com as rodas girando; a peça que quebra solta o meio girando e as lascas, e o que cai na água
espirra e faz onda. Abre direto no 3D (a caixa com a cor do céu enquanto carrega); sem WebGL, se a cena falhar ou o contexto cair, o 2D
de reserva (`desenho.ts`, com a mesma fila; no site de desenvolvimento, `localStorage.ponte2d` força). Os modelos em `web/public/ponte/`
com as licenças; o crédito nos termos, seção 10. Medido no Chrome de teste (sem placa): ~1,3 ms por quadro do lado do JavaScript.

**A PONTE LEVADIÇA (20/11/2026, a pendência dos lotes de 19/11):** peça nova, a LEVADIÇA (`LEVADICA = 4`, 400 por casa), uma
pista que abre, só nas fases do barco (`canais` na `Fase`; nas outras, a conferência recusa). A ponta A é o EIXO; a B é a PONTA, um
nó só dela mesmo em cima de outro nó (a JUNTA NOVA), presa ao nó comum do ponto por uma TRAVA (mola de comprimento zero; sem nó comum,
à primeira ponta que chegou). No passo 60 as travas soltam e ela gira até ficar em pé (a parametrização racional do círculo, só + − ×
÷; a ponta fica fora da física, `movido`); do 120 ao 240 o barco passa e quebra o que entra no canal; ela deita de novo e a trava só
prende se a ponta encostou; o tráfego sai no 330. Duas fases novas: o Canal (16) e o Porto (17, dois canais e o caminhão), com a
referência `ponteComLevadica` e os orçamentos da busca gulosa. **As 15 fases de antes rodam a conta de antes**, comparadas bit a bit
com a cópia antiga em 298 pontes; `web/test/ponte.test.ts` guarda o resultado de cada uma, e os recordes valem. Duas meias-levadiças
se encontrando no meio travam, mas não seguram carga (as peças só fazem força ao comprido). Testes: `web/test/ponte.test.ts`,
`server/test/minijogos-ponte.test.ts`, `e2e/ponte-levadica.mjs` (passou). Os tempos e a peça são chute: ninguém jogou com gente.

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

## A auditoria antes de ir ao ar: quem confere não é quem fez

**Decidido em 25/11/2026, pelo Sydenstricker**, depois de avaliar três materiais que ele viu (reels): o **Claude Code
Game Studios** (MIT; 49 agentes com cargos de estúdio, para Godot/Unity/Unreal), o **pixelfx** e o **Game Feel Prompts**.
Do primeiro entrou só a ideia, não os 49 agentes: *mudança que a pessoa vê não está pronta até o jogo ser aberto, olhado e
fotografado.* "Escrito, não rodado" e "ninguém jogou com gente" aparecem dezenas de vezes neste arquivo; teste que passa não
prova que a tela está certa.

**A etapa mora na skill `.claude/skills/auditoria-de-jogo/`** (o passo a passo e o checklist de game feel): o pedido vira uma
lista de itens conferíveis; o e2e joga (piloto automático ou teclas por script) e fotografa, com FOLHA DE QUADROS para efeito e
animação (modelo: `e2e/briga-pixelfx.mjs`); um agente NOVO, sem o raciocínio de quem fez, confere item a item pelas fotos
(feito / falta / quebrado, com o quadro que prova); só com tudo "feito" vai ao ar. O relatório diz sempre se alguém jogou com gente.

**O Game Feel Prompts** (game-feel-prompts.pages.dev) é pago (US$ 15) e proíbe repassar os prompts: NÃO foi comprado. Entrou
a lista PÚBLICA dos momentos que eles cobrem (acerto, levar dano, derrotar, coletar, pousar, combo, largada, vitória…), virada
num checklist NOSSO, com os números e as regras do Syden (`game-feel.md` na skill). Cada "não" é sugestão, não mudança.

**O pixelfx** (github.com/patch-gg/pixelfx, MIT, efeitos de pixel art feitos por código) está COPIADO em
`web/src/vendor/pixelfx/` (só o motor e os efeitos usados; a origem e o commit no `ORIGEM.txt`; o crédito nos termos, seção 10,
e o texto da licença servido em `web/public/licencas/pixelfx.txt`, porque o build minificado tira os comentários de licença). Efeito novo: copiar o arquivo e o .d.ts.
**O PILOTO NA BRIGA** (`efeitosPixelfx.ts`): a faísca do golpe FORTE (`hit-spark-pequena.js`, a hit-spark a 60% do tamanho) e o
bicho que vira FUMAÇA (`poof-pequeno.js`: o poof a 60%, sem o estouro branco, nas cores quentes da horta), que sai onde o bicho estava DESENHADO, no quadro em que ele
some da tela; o soco comum e a poeira do caixote continuam os nossos. Sem a LUZ da biblioteca (a composição com luz 0). Só desenho, e para na pausa do acerto.
`localStorage['syden.brigaPixelfx'] = 'nao'` volta aos de antes. **A própria auditoria mudou o piloto:** a primeira versão
(hit-spark em todo soco, blunt-hit no forte, luz 0,55) foi reprovada pelo agente conferente: a biblioteca desenha para quadros
de 110–140 px e o coelho tem ~45, então o soco comum ficava do tamanho do coelho, a blunt-hit cobria o coelho de bolha e
poeira, e a luz sobre o céu claro virava mancha branca. A segunda rodada achou o resto: mesmo a 0,15 a luz fazia uma nuvem creme do
tamanho do coelho (o brilho tem 22 a 38 px de raio), a faísca saía duas vezes no arremesso (a minha e o eco do servidor), e a
fumaça nascia ao lado do bicho, que continuava inteiro na tela (a posição do quadro do servidor não é a desenhada). A terceira, o estouro BRANCO do começo da fumaça (fixo no
código dela: a paleta não o troca) e a faísca no meio do bicho em vez do contato. Foram quatro rodadas até passar. **Lição para usar a biblioteca noutro jogo: medir a escala do efeito
contra o personagem e a luz contra o fundo, antes de trocar.** **Ele viu as folhas e aceitou como está (25/11/2026)**, com as ressalvas da
4ª rodada (a faísca 10–15 px atrás do punho, o anel claro fino no começo da fumaça, e o piscar creme antigo do bicho, que é
nosso e continua maior que os efeitos novos). Os próximos candidatos, se ele quiser: o Comando, a Masmorra e a Arena. Ninguém jogou com gente.

**A primeira auditoria de game feel (25/11/2026)** passou o checklist em Comando, Masmorra, Arena, Chefe, Caça e Esquadrilha
pelo piloto automático (`e2e/auditoria-gf-*.mjs`; o relatório e as folhas em `e2e/fotos/auditoria-gf/`), e achou defeitos de
verdade, consertados no mesmo dia: **a pausa no acerto era pedida e nunca lida** na Masmorra, na Esquadrilha, no Pulo e na Horta
em cascata (só a Briga lia o `congelado`; agora, congelado, o quadro não é redesenhado e a tela fica no golpe); **a toupeira do
Chefe nunca piscava** (a `sombra()` devolvia o alpha a 1 no meio do desenho; agora devolve o que estava); e **o coelhinho da
gaiola do Comando** sai em três pulinhos, como o comentário prometia. **Regra: jogo que pede `pausaMs` lê o `congelado`.** **A
Arena ganhou o impacto no mesmo dia (pedido dele):** a pausa no acerto meu (40 ms, 60 no golpe que vale mais), o tremor no golpe
que levo e na minha queda, o clarão em quem leva (eu também), na hora em que o golpe aparece na tela (`impactos` em
`arena/regras.ts`); o número do dano maior, com contorno escuro, nascendo acima do nome; e contorno escuro nos anéis e na fumaça,
que sumiam na areia. Só desenho. Conferido por agente pelas folhas (só o gramado saiu; a praia, não). As outras sugestões do
relatório (a explosão da granada, a fumaça atrasada) esperam a decisão dele. Na mesma
leva, os e2e de briga, plataforma, tabuleiro, lobisomem-microfone, estelar (`ROTA=gelo`) e quiz, antes "escritos, não rodados",
PASSARAM; o que falhava eram os testes, não os jogos.

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
  enfeitada. As funções da home moram nos objetos: fone → Salas, quadro → Amigos, cortiça → ideias (os avisos das comunidades desde 23/11/2026), **o guarda-roupa (o
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
- **DÍVIDA DE ARTE (pedidos dele, à espera de créditos do PixelLab). OS CRÉDITOS VOLTAM EM 07/11/2026** (aviso dele em
  06/11: "anote no projeto para retomar essa demanda técnica"): retomar por esta lista e pela ordem do plano acima (os 5 da
  parede, o pufe e o tapete, as janelas, os objetos de cima no tamanho final), registrando cada geração no `custos.jsonl`.**
  - **Um ventilador ou um ar-condicionado** (16/10/2026).
  - **A porta de entrada do salão** (aprovada em 20/10/2026): o membro novo chega por ela, e o coelho do balcão acena.
  - **Os giros das camas 1, 3 e 4** (20/10/2026), para elas entrarem liberadas no quarto (~75 gerações).
  - **Um gatinho olhando a janela** (16/10/2026): deitado, dormindo; clicado, ele se espreguiça e senta. Precisa das
    poses (deitado dormindo, espreguiçando, sentado) e da passagem entre elas, como o coelho; é peça viva, não móvel.
  - **O coelho sentado no sofá do salão, por lugar** (16/10/2026, relato dele: "os coelhos continuam flutuando"): com o
    sofá de frente, eles ficam por cima do encosto; de costas, o encosto já os cobre (`atras`), mas não basta. Pede uma
    pose sentada para cada posição do sofá e a CAMADA DA FRENTE do assento à parte, como a poltrona do quarto.
  - **Da auditoria de 06/11/2026** (ver abaixo): a noite com a luz do abajur PINTADA nas plantas em L e no cubículo (lá a luz
    é a por código, com as faixas); a peça avulsa da janela original (ela traz uma faixa de parede creme entre a cortina e
    o caixilho, que não muda com a cor da parede); as folhas da planta alta passam da quina do quarto (até ~100 px no
    canto da frente).
- **A AUDITORIA, A COR DA PAREDE E DO PISO E AS PLANTAS (06/11/2026, pedidos dele).**
  - **O livro em cima do armário cortava** (o relato): a vista de um móvel começava no canto (0, 0) do quadro dela, e o que
    o objeto de cima passava da linha 0 não era desenhado. Os móveis com tampo começam com uma MARGEM no quadro
    (`MARGEM_DO_TAMPO`). A auditoria (`window.auditoriaDoTeste`: pixels do desenho, os que entraram na peça e os vistos)
    rodou cada objeto em cada móvel com tampo, em cada giro e em 9 lugares do tampo: 2.160 casos, nenhum cortado. E mais
    três: a caneca de costas virava um contorno vazio (a página tirava "a sombra pintada", a cor mais comum do pé, e nos
    objetos essa cor é o corpo deles: agora não nos objetos de cima), o objeto podia ficar com meio corpo fora do tampo
    (o pé dele, um círculo do tamanho da base do desenho, fica dentro), e o lugar no tampo era o pé da GRADE, maior que o
    desenho (agora o pé medido). Sem defeito: a luz na placa e no processador (de dia iguais, de noite ±1 em ~400 canais),
    os objetos da parede em todo trecho e altura (nunca saem da tela), os móveis nas bordas (só as folhas da planta alta).
  - **A cor da parede e do piso**, no Editar → Cômodo, em figuras: 8 paredes (creme de fábrica, sálvia, terracota, azul,
    lavanda, mostarda, rosa, cinza) e 6 pisos (mel de fábrica, carvalho, nogueira, cerejeira, cinza, pinho). Por código, como
    o tapete: cada pixel do reboco (claro e pouco saturado, fora do chão; não o rodapé nem a cornija) e do chão vezes a razão
    entre a cor escolhida e a média dele na casca, a mesma de dia e de noite (`pintarRegioes`, na montagem da cena). A
    luz das peças continua lida da casca SEM cor. Mora em `cores` ("parede", "piso"), que o servidor já conferia. O que
    o recorte do pufe e do tapete trouxe de chão ganha a cor do piso. Só no quarto: no salão (tijolo) pediria outra máscara.
  - **As plantas** (Editar → Cômodo): o quarto de sempre, **em L** (o canto do fundo é um pilar de 4 × 4 casas; as faces dele
    são as paredes do fundo trazidas 4 casas para a frente) e o **cubículo** (6 × 6, as paredes 2 casas à frente). As
    cascas saem por código (`janelas/plantas.py`), a grade continua a de 8 × 8 e a planta diz quais casas são chão
    (`PLANTAS`) e os TRECHOS de parede (de, até, recuo): a janela e os objetos da parede vão num trecho só. A janela grande
    só cabe na parede inteira: nas outras plantas a de fábrica é a "com cortinas". Cada planta tem a arrumação de fábrica
    dela (`INICIAIS`, `PAREDE_DA_PLANTA`); trocar de planta mantém o que continua no chão, leva o que caiu fora para a
    casa livre mais perto (ou guarda; o móvel de função vai para o lugar de fábrica), e quem não mexeu na de fábrica recebe
    a da planta nova. O servidor guarda `planta` (código); quem visita vê igual. Testes: `comodo.mjs` (no app).
  - **A AUDITORIA DE NOITE** (10/11/2026, relato dele: o violão, o relógio e a prateleira de potes claros de noite): `e2e/pixel-art/
    auditoria-de-noite.mjs` põe cada peça do catálogo na cena e reprova a que escurece bem menos que o entorno; objeto da parede sem
    noite própria (a peca-noite igual à do dia) ganha a noite por código (`noiteDoDia`). Rodar quando entrar peça nova.
  - **O LOTE DE 10/11/2026 (pedidos dele):** (1) os Mini-games abertos pelo COMPUTADOR DO QUARTO aparecem dentro do MESMO monitor
    da mesa (deitado, 4:3, a moldura escura com o LED), feito por código com as cores da mesa
    (`e2e/pixel-art/monitor/escuro.mjs` → `web/src/assets/quarto/`; a versão creme do PixelLab foi recusada: "não é o mesmo
    monitor"); o fliperama e a sala abrem o painel de sempre. **Em 11/11/2026 (pedidos dele):** o teclado e o mouse minúsculos
    embaixo SAÍRAM ("se for para deixar um item ruim, melhor nem colocar"), e a tela virou uma ÁREA DE TRABALHO RETRÔ, nossa
    (`TelaDoComputador.tsx`: sem logo nem "Iniciar" de sistema nenhum): os ícones em pixel art Mini-games (abre a lista numa
    janela com barra de título e ✕) e Troféus, e a barra com o desligar e o relógio; Esc fecha a janela e depois o computador.
    Só entra ícone do que funciona. Teste: `e2e/tela-do-computador.mjs`. (2) O tapete aceita COR LIVRE (`cores.tapete` = '#rrggbb'; o
    servidor aceita hex só no tapete). (3) Os 10 OBJETOS DE CIMA refeitos no tamanho final (`e2e/pixel-art/objetos/refeitos.mjs`;
    saem de 20 a 28 px, o menor que o PixelLab faz sem virar ruído; os de 09/11 em `pequenos/falhas/09-11/`), a suculenta virou
    uma echeveria. (4) O VENTILADOR pelo botão direito: desligado → ligado → oscilando → desligado (`cores[<id>]` = 'ligado' |
    'oscilando'); a hélice é um rastro por código (`ventilador-quadros.mjs`). No 3D ele fica parado.
    **A OSCILAÇÃO DESENHADA (11/11/2026, revista por ele quadro a quadro, ~20 rodadas):** cada vista do quarto oscila pelas duas
    VIZINHAS (a sudeste vai da sul à leste), 7 posições e volta, com 2 quadros do meio por par feitos pelo PixelLab
    (`ventilador-entre-vistas.mjs`, interpolation-v2 numa janela de 128 px, 10 gerações por par, 80 no total); pedir ao PixelLab que
    animasse "só a cabeça" girava o ventilador inteiro (`avulsos/ventilador-oscilar-falha/`). `ventilador-oscilacao.mjs` cola cada
    cabeça sobre a haste e a base PARADAS: alinhada pela HASTE (o encaixe abaixo dela tem o botão de lado e errava até 5 px), a haste
    da cabeça tirada e a da base no lugar, o pé do aro abaixo do corte só se continua o aro. A página baixa os quadros num pacote À
    PARTE só quando alguém põe para oscilar (`OSC_VENT`, `pedirOscilacao`); até lá, a oscilação por código. **Cada desenho do
    PixelLab pediu limpeza à mão** (os originais ao lado, em `originais/`, `antes-do-aro/`, `antes-do-motor/`, `antes-do-branco/`):
    a haste atravessando a grade, a espessura preta do aro por dentro, o motor espiando quase de frente, a frente da grade branca de
    lado (virou arame). E a hélice por código aprendeu a lista que está no topo de `ventilador-quadros.mjs`. **Pendente:** a P3 do
    noroeste (`north__north-west-1.png`) veio sem as varetas da grade (gerar o par de novo ou usar um quadro do meio só); as três vistas
    novas não foram aprovadas por ele como a sudeste; só a sudeste foi vista dentro do quarto.
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
Havendo transmissão, ela é o primeiro canal, e uma transmissão que começa leva a TV a ela.** **O GIF da comunidade (10/11/2026, pedidos dele):** quando a capa ou o ícone da comunidade é animado, ele é mais um canal da TV (reduzido ao estilo da tela, pelo `ImageDecoder`; no Firefox, parado). De fábrica a TV fica no pôr do sol; quem arruma o salão escolhe o canal (botão direito ou o "…" do Editar, em figuras), e vale para a turma. **A luz de noite do salão** (mesmo dia): as luzinhas do alto das paredes, a TV, o fliperama, a jukebox e o neon iluminam em volta, como o abajur no quarto (`lampadasDoSalao`); ele a viu e aprovou ("não é defeito"). **O Ao vivo mostra o GÊNERO do jogo transmitido (18/10/2026, decisão dele: "o gênero, não o jogo"):** 20 desenhos nossos (moba, tiro, futebol, corrida, luta, aventura, construção, fazenda, estratégia, cartas, terror, plataforma, festa, espaço, quebra-cabeça, esportes, voo, RPG por turnos, história e ritmo; os sete últimos tirados da lista de gêneros da Steam que ele mandou, juntando os que dão o mesmo desenho numa tela pequena), nunca imagem do jogo. Só no app e só transmitindo UMA JANELA: o app passa à página o executável dono da janela (o mesmo dado do som do jogo), a página o converte pela tabela `web/src/generoDoJogo.ts` e só o gênero vai aos outros (o servidor aceita só os da lista). Pelo executável e nunca pelo título, que engana. Jogo novo é uma linha na tabela, sem versão nova do app; fora da tabela, o Ao vivo comum. Teste: `salao/canais-da-tv.mjs`. o quadro mostra a CAPA da comunidade
(ou o ícone, inteiro) no plano da parede; quem transmite fica na frente da TV, quem está numa partida no fliperama (pose
própria), e as banquetas têm a pose sentada alta. **A arrumação é da COMUNIDADE** (`saloes`, `salao-routes.ts`): todo
membro vê igual e USA as funções, só quem administra arruma (o servidor confere), e a turma relê na hora (`salao:mudou`). **UM SALÃO POR COMUNIDADE E O CÓDIGO DO LAYOUT (10/11/2026, relato dele: "estou em duas comunidades e elas estão exatamente iguais"):** dois defeitos juntos. (1) O `SalaoNovo` não remontava ao trocar de comunidade, e a página do salão recebe a rota uma vez só: a segunda comunidade mostrava e GRAVAVA no salão da primeira (agora `key={community.id}`). (2) A arrumação no navegador tem uma chave só para todos os salões, e a comunidade sem salão no servidor recebia a do navegador (agora começa na de fábrica). **No Editar (quarto e salão), o "Código do layout"**: o retrato da arrumação comprimido, "SYDL1-…" (`web/src/codigoDoLayout.ts`), para copiar; colado, entra como mudança do Editar (Desfazer, Cancelar, Aplicar), e o de um salão não entra num quarto. O "Voltar ao padrão" já existia na mesma barra. Teste: `e2e/pixel-art/salao/codigo-do-layout.mjs`.
**A turma ajuda a arrumar (18/10/2026, decisão dele):** quem administra marca no cargo "Pode arrumar o salão", e quem tem o cargo arruma — é a ÚNICA exceção, de propósito, ao "cargo é identidade, não poder" (db.ts). Contra a bagunça, o salão guarda quem mexeu por último e o salão de ANTES dessa pessoa começar, e quem administra desfaz ("Última mudança no salão: fulano · Desfazer"). O canal da TV e o que está desligado (TV, fliperama, jukebox) vão com a arrumação: valem para a turma, e só quem arruma muda.
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
iframe da página; com a janela sem foco, nada é desenhado. **Sair do início ou do salão GUARDA a cena (13/11/2026, relato dele:
"notável quando mudo de aba para procurar mensagem")**: ela fica montada, escondida (visibility) e parada (a página e as cenas 3D
conferem `checkVisibility`), e voltar é só mostrar (medido: ~2,5 s de volta → ~0,1 s). **A guarda é modesta** (pergunta dele,
mesmo dia: "estamos guardando quase 2 GB de RAM do usuário por 10 minutos?"): UMA cena só (a última de onde a pessoa saiu), por
3 min (30 s sem foco na janela), e NADA em computador com menos de 8 GB (`navigator.deviceMemory`); com o salão de outra
comunidade, também sai (`web/src/CenaGuardada.tsx`). Teste: `e2e/cena-guardada.mjs`.
**E A CENA PESAVA DEMAIS (mesmo dia, medido por `e2e/pixel-art/memoria-das-cenas.mjs`, que diz quanto cada lugar do código segura):**
cada vista de móvel, objeto de cima e objeto de parede é um quadro do tamanho da CENA (4 MB no salão, 1 MB no quarto), e a página
preparava as do CATÁLOGO INTEIRO na abertura. Agora cada uma é feita no primeiro uso (`preguicoso` em montar.mjs), e as figuras do
Editar só ESPIAM (fazem e deixam ir). Medido: o salão de ~1,6 GB para ~1,06 GB, o quarto de ~550 para ~445 MB. O que sobra: as peças
postas, ainda no tamanho da cena (~290 MB no salão; guardá-las no tamanho delas é uma reforma no motor), e ~2.400 imagens
decodificadas de saída (~220 MB, quase todas quadros dos coelhos). Peça nova: criar a vista com `vistasPreguicosas`, nunca com `.map`.

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

## O personagem: o 2D é todo PixelLab, e o 3D copia o 2D

**Decidido em 09/11/2026, pelo Sydenstricker, revendo o caminho de 18/10 (PixelLab → Meshy → Blender renderizando o pixel).**
Nas palavras dele: "o fluxo do 2D é todo pelo PixelLab… pelos aprendizados de misturar 3D e 2D, todo o processo será pelo
PixelLab, mesmo que demore mais e custe mais créditos. Com o fluxo feito, a versão 3D do Syden usa os elementos criados em
2D, com o nosso esqueleto e o nosso fluxo atual." **Na cena 2D, tudo 2D; na 3D, tudo 3D.**

- **O objetivo é a customização completa** (pedido dele, mesmo dia): escolher o coelho, os acessórios e as cores, e usar esse
  personagem nos minigames 2D e 3D e como avatar no quarto e no salão, nos dois estilos. **Os 16 avatares de hoje são
  pré-seleções** para ajudar a escolher.
- **Primeiro, fechar o ciclo do mascote principal** (pedido dele): o mascote do PixelLab (`personagem/mascote/`) tem desde
  09/11/2026 todas as poses do quarto e do salão nas 4 diagonais (`MASCOTE=pixellab` no `montar.mjs`). **O do app continua
  o 3D até ele decidir trocar.**
- **Acessório é por REPINTURA, uma vez por pose e direção** (piloto de 09/11/2026, `personagem/acessorio.mjs`, o boné):
  repintar quadro a quadro dava um boné diferente em cada quadro (tremeria); pintado uma vez e acompanhando a cabeça pelo
  código, fica estável. ~10 gerações por pose e direção. Nas poses em que a cabeça deita ou gira, pinta-se naquela pose.
  **Acessório de cabeça fica ENTRE as duas orelhas** (decisão dele, mesmo dia, vendo o boné atravessado num quadro): as
  orelhas só atravessam o acessório quando o desenho dele é para isso.
- **Roupa não é camada no PixelLab:** cobre o corpo, que muda de forma a cada quadro. Cada roupa é uma VERSÃO do personagem
  (um estado), com as animações dela (~300 a 400 gerações por roupa). O coelho sem roupa não economiza no 2D (economiza no
  3D). Cor de roupa e pelo é troca de paleta, de graça.
- **A auditoria visual** (`e2e/pixel-art/auditoria-visual.mjs`, pedido dele) fotografa cada pose em cada móvel, de dia e de
  noite, com os dois mascotes e o gato; roda depois de cada lote do PixelLab. A das bordas
  (`e2e/pixel-art/auditoria-de-bordas.mjs`) roda no `npm test`.
- **O gato é o pet do quarto** (pedido dele, mesmo dia: "mais um elemento customizável"): tem os lugares dele, sobe no
  peitoril da janela grande para olhar a rua, sai de onde o coelho vai usar, e se guarda no Editar (`cores.pet`). Outras
  pelagens ou bichos: mais um valor de `cores.pet` e a arte deles.
  **Aprovado, e os ajustes de 09/11/2026 (pedidos dele):** a **caminha do gato** é móvel do catálogo (`caminha-gato`, avulsa e com
  os giros; no 3D, feita por código), POSTA DE FÁBRICA no canto da frente das três plantas (decisão dele: "nos quartos novos
  venha ela já posta"; no quarto já arrumado chega guardada, como o ventilador, e fica no catálogo) e é o lugar preferido dele para dormir, DENTRO dela (a
  borda da frente o cobre); parado, ele fica **de frente** (sudeste/sudoeste), de costas só olhando a janela e, raramente, no
  chão; e o **pulo** é a animação do PixelLab em três tempos (impulso no chão, o voo pelo arco do código, o pouso). As
  **4 vistas da janela** (`../janela/vista-*`), que só o botão da página de teste trocava, são figuras na aba Janela do Editar
  e no "…" da janela (`vista` na arrumação, que o servidor já guardava).
  **A segunda rodada (mesmo dia):** o **impulso de verdade**: para SUBIR ele agacha (o estado `agachado` e a passagem
  `agachar`, reutilizáveis: a pose parada 'agachado' existe), MIRA ~0,8 s (`mirar`, o traseiro balançando) e salta do agachado
  (`saltar`); para descer, o pulo de antes. E as coisas de gato, de vez em quando e sem insistir (com menos movimento, nada):
  **esfregar-se no coelho** parado no chão (vai até a perna dele; no máximo uma vez por minuto), **amassar pãozinho** no tapete ou na
  caminha antes de deitar, **bocejar** (só de frente) e **lamber a pata** (era o `lambendo`). De costas, o agachado do estado parecia
  sentado: o de costas é o último quadro de `agachar-costas`, sem quadro final (os de antes em `animacoes/falhas/`).
  **PENDÊNCIA: o gato no quarto 3D** (decisão dele, 09/11/2026: "no momento deixe vazia; vamos evoluindo os elementos aos
  poucos"). No 3D a caminha existe e fica VAZIA, porque o gato ainda não tem modelo 3D; quando tiver, ele dorme nela lá também.
- **O sofá do salão tem 2 lugares** (sugestão dele): com 3, os coelhos se sobrepunham e as pontas cortavam as pernas.
- **O móvel ganha, o personagem sai** (relato dele, 09/11/2026: "se eu arrastar um móvel para onde já tem um personagem, nada
  impede"): arrastar não é impedido; quem estava ali (o coelho, o gato, o coelho do balcão, quem está na call) anda para a casa
  livre mais perto, a cada passo do motor. `e2e/pixel-art/auditoria-de-sobreposicao.mjs` confere o quarto (as três plantas) e o
  salão; rodar depois de mexer em móvel, ponto de interação ou personagem.
- **O mascote do app é o do PixelLab desde 09/11/2026** (decisão dele): `MASCOTE=3d` no `montar.mjs` volta ao 3D.
- **As fotos de frente dos 16 coelhos para o Meshy** (`e2e/pixel-art/avatares/frente.mjs`, as escolhidas em
  `frente/escolhidas.json`, ampliadas em `frente/para-meshy/`): gerados cada um sozinho, o acabamento variava; o 14 vai de
  referência de ESTILO, e a roupa de cada um vem da foto de frente dele (a do 14 vazava para os outros).
- **O MÉTODO DAS CAMADAS (piloto de 09/11/2026, pedido dele: "escalável e com qualidade; resolver primeiro em 2D, depois o
  3D").** As 16 fotos de frente são RECEITAS (corpo + roupa + cores + acessórios), não 16 personagens: o personagem é feito de
  camadas que se combinam por código, e só a forma nova custa geração. **CORPO** novo só quando a silhueta muda, e ele nasce
  como ESTADO do mascote (`corpo-novo.mjs`): herda tamanho, vista, luz, roupa e esqueleto. Criado do zero a partir de um
  conceito, saiu com 57 px contra 90 e noutro ângulo (`orelha-caida/falhas/`). As animações saem pelo mesmo `animar.mjs`
  (`COELHO=<corpo>`). **ACESSÓRIO** é pintado UMA vez por corpo e direção (`acessorio.mjs`, ~10 gerações; a região, crânio ou
  pescoço, sai das contas de pixel) e levado a todos os quadros por `acessorio-camadas.py`, que acompanha a cabeça PELA
  IMAGEM (procura o pedaço em volta do acessório), deixa na frente o pedaço grande que entra pela borda (a mão) e marca o
  quadro em que a cabeça mudou de forma (pede pintura própria). Medido: 2 corpos (mascote e orelha caída) × boné e bandana ×
  parado, andando, falando e acenando nas 4 diagonais, 504 quadros, 3 marcados; a folha da troca é
  `personagem/camadas/troca.png`. Custo do piloto ~400 gerações, ~100 delas em tentativas que falharam. A conta de agora:
  acessório novo ≈ 40 gerações por corpo; corpo novo ≈ 26 + ~10 por animação. **Lições do PixelLab:** no texto da animação,
  NÃO cite efeitos nem para proibir (o "no sparkles" desenhou brilhos), e "as orelhas balançam" fez as orelhas caídas
  levantarem; o que flutua solto ou preso por um fio sai com `limpar-soltos.py`. O endereço de um quadro às vezes devolve
  um erro 500 em JSON no lugar do PNG (`animar.mjs` confere e avisa). **A decidir com ele:** a regra "um modelo por coelho" do
  3D (de 18/10) vira "poucos corpos + acessórios avulsos"; o mesmo acessório sai de tamanhos diferentes em cada corpo, porque
  cada pintura é independente (o boné da orelha caída é maior que o do mascote); e roupa (terno, regata, sandália de dedo:
  ele pediu mais variedade que o moletom) é uma versão do corpo, a próxima camada a medir.
  **O terceiro corpo, o MUSCULOSO de regata** (pedido dele, mesmo dia), saiu com a mesma receita e recebeu o boné e a bandana
  sem nada à mão: 3 corpos, 756 quadros. A gola se acha onde o PELO acaba descendo pelo meio da cabeça (o "primeiro escuro"
  pôs a bandana na cintura da regata cinza), e a máscara do boné sobe 16 px e protege as orelhas em pé (com 8, a cabeça
  redonda da orelha caída cortou o boné reto em cima). Ele aceita pequenas variações de tamanho do acessório entre corpos.
  **O PILOTO EM 3D (mesmo dia, pedido dele: "estender o piloto para 3D antes de mudar as regras"; `personagem/blender/camadas/`,
  LEIA-ME lá):** o acessório é malha avulsa presa ao osso, com o encaixe MEDIDO na malha de cada corpo (`saida/encaixe.json`), e
  o GLB de teste liga e desliga cada peça (`ver.html`). A bandana veste bem nos dois corpos; a orelha caída sai da malha do
  mascote com um segundo osso por orelha (girar só o osso amassava); o boné na orelha caída fica bom. **O boné no mascote de
  orelha em pé NÃO cabe** em 3D: as orelhas nascem quase juntas no alto da cabeça, e o "entre as orelhas" do 2D é um truque
  do desenho. Saídas para ele escolher: boné com furos, virado para trás, ou corpos de orelhas mais afastadas. Os provisórios
  são feitos por script; os do Meshy entram sozinhos por nome em `camadas/meshy/` (4 downloads: 2 corpos e 2 acessórios).
  Corpo novo do Meshy ainda pede medir o esqueleto à mão (`MEDIDAS` do `mascote.py`) uma vez. A regra "um modelo por coelho"
  continuou até ele decidir (decidiu em 10/11: ver "REVISTO" abaixo). **Decidido por ele no mesmo dia: o boné 3D segue o desenho 2D** (no 2D ele senta na cabeça, entre
  as orelhas, sem ser atravessado; o 3D repete isso, e um boné atravessado só se o 2D for assim), e **o mascote 3D ganha uma
  malha NOVA do Meshy com as orelhas afastadas** ("a qualidade vai ser maior"), no lugar de dobrar a malha de hoje. A foto de
  entrada é `camadas/para-meshy/corpo-mascote.png` (`mascote-frente.mjs`), e o boné ganhou uma imagem própria, grande
  (`acessorio-avulso.mjs`).
  **REVISTO em 10/11/2026, e é o que vale:** o corpo do Meshy de orelhas afastadas saiu MAGRINHO ("parece uma opção feminina do
  mascote") e virou um corpo base a mais (`mascote-novo`), não o principal. **O mascote principal continua a `mascote-t.glb`, com
  o boné do Meshy (`camadas/meshy/bone.glb`) na posição da v3 de frente e de lado, e RECUADO 48° só nas vistas de costas**
  (nordeste, noroeste, norte; `recuo_de_costas` em `saida/encaixe.json`, medido na malha: menos de 3% da copa atrás das
  orelhas). Ajuste por VISTA, não por pose. Afastar as orelhas pelos ossos (a v4) virava "asas" e foi descartado. Ele aprovou:
  "para mim a solução do 3D está ok, pode usar ele". **Com isso, A REGRA DO 3D MUDOU:** em vez de "um modelo por coelho", o 3D é
  feito de POUCOS CORPOS BASE + ACESSÓRIOS AVULSOS presos ao osso, com o encaixe medido em cada corpo (o mesmo método das
  camadas do 2D). No site, de câmera livre, o recuo de costas entra interpolado pelo ângulo entre a câmera e a frente do coelho
  (até ~100°, a posição de sempre; de ~140°, os 48°): anotado em `cena.py` e no LEIA-ME, ainda não feito.
  **A AUDITORIA DAS CAMADAS (10/11/2026, pedido dele: "talvez seja necessário melhorarmos o nosso processo de auditoria da
  arte? São vários erros que passaram"):** ele achou os defeitos pintando o coelho de cores berrantes no criador (a bolinha
  presa no alto da cabeça, riscos de roupa nas orelhas, a regata mudando de tom entre quadros, o halo em volta da bandana),
  porque nas cores originais quase não se viam. `personagem/auditoria-de-camadas.py` faz isso de propósito em todo corpo,
  animação, direção e quadro: mede soltos e PICOS (o quadro cujo alto sobe 5 px acima dos dois vizinhos), roupa que foge 35%
  da mediana da direção, roupa na altura das orelhas e pixel claro sem a cor do acessório; e monta `camadas/estresse-<corpo>.png`
  (pelo rosa-choque, roupa vermelha, boné azul, bandana verde) para OLHAR. **Roda depois de cada corpo, animação ou acessório
  novo, e só passa com 0 marcas.** As correções que ela pediu: `limpar-soltos.py` corta os picos; `acessorio-limpar.py`
  tira da camada o que não tem a cor do acessório nem é o contorno colado nele (a repintura mexia no pelo em volta);
  `classes_de_cor.py` separa pelo e roupa (roupa é peça de 40 px ou mais, do pescoço para baixo; na regata, o maior pedaço dos
  tons médios) e o tom de referência é o do quadro 0 da direção, fixo (recalcular por quadro fazia a cor piscar). **O
  criador de coelho** (a prévia da customização, pedido dele: "como uma tela de seleção de Dark Souls ou The Sims") está
  publicado como artefato: corpo, cor do pelo, roupa, boné e bandana com cores, girar, receitas e clicar para acenar.
  **O CRIADOR ESTÁ NO APP (10/11/2026, pedido dele: "pode implementar ao Syden?")**, como a primeira folha da Aparência → Avatar
  (`web/src/coelho/`): o palco é o coelho EM CAMADAS (`montar.ts`: as tiras de `web/public/coelho/`, geradas por
  `web/scripts/coelho-camadas.py`, com a troca de paleta e os acessórios), gira e acena ao clique; no canto, o avatar redondo como os
  outros vão ver. **As 16 sugestões são os coelhos prontos** (decisão dele: "usar os 16 avatares como sugestões; futuramente criar os
  assets no PixelLab e gerar maior variação"): cada uma é a receita mais perto com as peças de hoje (`PRESETS` em `receita.ts`).
  Escolhida e intacta, o avatar continua o desenho pronto; mexeu num traço, vira "Personalizado" e o avatar passa a ser o BUSTO do
  coelho montado. A receita é o código "SYD1-…" (o da prévia), em DUAS CÓPIAS IGUAIS (`web/src/coelho/receita.ts` ↔
  `server/src/coelho-receita.ts`), e o servidor a guarda canônica em `users.coelho` (`PUT /api/me/coelho`, com `pronto` quando é a
  sugestão intacta); "Meus coelhos" fica na conta (`users.coelhos_salvos`, até 12, no "Levar seus dados"). Nada muda até o Salvar, e a
  foto de antes vai para os anteriores. Escolher um pronto pelo caminho antigo tira a receita. **A CENA DESENHA O COELHO DE CADA UM**
  (mesmo dia): no quarto, o de quem mora (o servidor manda `coelho`/`avatarPronto` com a arrumação, o app lê por `receitaDe` e devolve
  à página; o "arrumado" espera; mudar na Aparência relê), na visita o do dono, e no salão o de cada pessoa na call (`coelho` em
  `PessoaNoSalao`); o do balcão continua o mascote. A página pinta com a conta do criador ("O COELHO DE CADA UM" em montar.mjs), pelos
  mapas de `web/scripts/coelho-cena.py` → `personagem/cena/`; os outros corpos vêm num pacote à parte, baixado só quando alguém os usa.
  Pose que o corpo não tem cai na mais perto DELE (`CAIR`; varrendo não existe fora do mascote); pose nova só entra depois de
  `acessorio-camadas.py` e `coelho-cena.py` (o montar avisa e a deixa de fora). Com `MASCOTE=3d`, todos são o mascote. Teste:
  `e2e/pixel-art/coelho-na-cena.mjs`.
  **OS JOGOS SEGUEM A RECEITA (mesmo dia, pedido dele: "quero um ecossistema integrado"):** o servidor manda aos jogos o
  `avatarDoJogo` (db.ts: a receita, senão o número do pronto, senão null; nos recordes, `COALESCE(u.coelho, u.avatar_pronto)`), e o
  site tira as cores por `coresDoJogador` (`web/src/coelho/cores.ts`), no lugar da tabela dos 16. O corpo nos jogos continua o do
  mascote (só as cores mudam); orelha caída, musculoso e acessórios nos jogos pedem modelos e folhas novas.
  **O TIPO DE CORPO (10/11/2026, pedido dele: "no Dark Souls tem uma opção de tipo de corpo, feminino e masculino"; e "mesmo
  multiplicando o trabalho, me parece que terá o resultado mais completo"):** cada corpo base ganha a versão feminina. A do
  mascote é a SILHUETA base das próximas (`personagem/mascote-f`, com o moletom curto e o umbigo, pintado à mão nas vistas de
  frente porque ele pediu), e a roupa de fábrica dela é o moletom comprido (`mascote-f-moletom`, a primeira tentativa, de
  silhueta sutil, aproveitada como roupa: "o resultado ficou bom e seria útil já aproveitar o material"). Na receita, o
  `corpo` continua sendo a PASTA (`mascote-f-moletom`, `orelha-caida-f-moletom`, `musculoso-f`…), e `partesDoCorpo`/`corpoDe`
  (receita.ts) a dividem em corpo base, tipo e roupa, as três linhas do criador; a linha do tipo e a da roupa só aparecem quando
  a combinação tem desenho (`public/coelho/dados.json`). Cada roupa no PixelLab é um conjunto inteiro de poses (~500 gerações),
  e cada versão feminina completa ~600: o que não couber no saldo espera a renovação do mês.
  **Aprovados no mesmo dia:** a orelha caída feminina MARCADA (`orelha-caida-f-moletom`; a sutil saiu: "a sutil parece o padrão com
  o olho customizado") e a forte feminina em DUAS versões (dele: "mulher musculosa não treina a mesma coisa que um homem musculoso,
  são outros grupos musculares"; "merece duas versões"): `musculoso-f` (regata, braços fortes mas menores) e `musculoso-f-curta`
  (regata curta, short até o meio da coxa, coxas e glúteos fortes), as duas roupas da forte feminina. Só o `mascote-f-moletom`
  tem as poses; os outros, só o corpo base.
  **Os cinzas soltos** (mesmo dia, relato dele): o PixelLab deixa pixels de cinza NEUTRO (75 e 133) soltos no pelo e no pescoço;
  `personagem/limpar-cinzas.py <corpo>` troca os pedaços de até 4 px pela cor dos vizinhos. NÃO rodar no musculoso (a regata é cinza). Peça nova (fone, óculos, gorro, roupas) entra em `CABECAS`/`PESCOCOS` e nas sugestões que a usam. Teste:
  `e2e/criador-de-coelho.mjs` (substituiu o `avatar-atual.mjs`).

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

## As permissões do Discord: o mapa, e o que já entrou

**Mapeado em 23/11/2026, a pedido dele** (as 52 permissões da documentação do Discord contra as funções do Syden; o relatório
foi entregue na conversa). O modelo continua o do Syden: **cargo é identidade, não poder**, e quem administra pode tudo.
Permissão por cargo, se vier, é um interruptor fixo e pequeno ("pode moderar a conversa"), como o "Pode arrumar o salão";
canal escondido para alguns cargos é o caro e arriscado (todo caminho que leva conteúdo teria de filtrar, e esquecer um
vaza), e a sobreposição completa do Discord não entra. Fora, pelas regras daqui: assinatura de cargo, webhooks e apps de
terceiros, tópico privado, TTS. **Achado no caminho: o Syden não tem EDITAR MENSAGEM.** Os próximos da fila, pela ordem do
mapa: canal de avisos e "pode moderar" no cargo, registro de moderação para quem administra, convites com validade, editar
mensagem, status da sala de voz, membro marcar evento. **Feitos no mesmo dia:**
- **Banir da comunidade** (`server/src/banidos-routes.ts`, `banidos_da_comunidade`): tira como a remoção e TODA porta de
  entrada confere (o convite e o link de aula com conta); desbanir só libera a volta. A regra de quem age sobre quem é a da
  remoção. Pelo botão direito (a confirmação no próprio menu, como a advertência) e em Configurações → Membros, com a lista
  "Pessoas banidas" e o desbanir. A pessoa não é avisada (como na remoção); a recusa do convite diz que quem administra
  baniu a conta, sem dizer quem. **Achado pelo e2e:** quem era removido não recebia o `member:removed` (ia à sala da
  comunidade DEPOIS de tirá-lo dela), e a comunidade ficava na tela dele; agora vai direto a ele também.
- **Fixar mensagens** (`server/src/fixadas-routes.ts`, `fixadas`, `FixadasDoCanal.tsx`): na comunidade quem administra, na
  conversa privada os dois; só mensagem do canal (não de tópico); teto de 50 por canal; apagar a mensagem a tira. O alfinete
  no cabeçalho abre a lista; o "Ir até a mensagem" só aparece se ela está carregada na conversa.
- O menu da pessoa passou a se reposicionar a cada mudança de tamanho (ResizeObserver): a confirmação do banir e o campo da
  advertência o cresciam por dentro e os botões ficavam abaixo da tela.
Testes: `server/test/banir-e-fixar.test.ts`, `e2e/banir-e-fixar.mjs` (passaram).
- **O canal de avisos** (`avisos` no canal; Configurações → Ferramentas → Moderação, ao lado do modo lento): no canal marcado,
  só quem administra escreve; a turma lê, reage e conversa nos TÓPICOS de cada aviso (a trava é `soQuemAdministra`, em
  automod.ts, conferida em todo caminho que grava mensagem no canal, o socket e o `destination` do chat-routes). Para quem não
  administra, a caixa de escrever vira a frase que diz isso, e o canal ganha o megafone no lugar do #.
- **Editar mensagem** (`PATCH /api/messages/:id`, o lápis da mensagem; Enter salva, Esc desiste): só quem escreveu, e só o
  texto (enquete e figurinha não se editam; com anexo o texto pode ficar vazio). A edição passa pelas regras de CONTEÚDO da
  moderação automática (o silêncio, as palavras, os links: `barrarEdicao`), não pelo modo lento. A mensagem mostra "(editada)"
  com a hora, e as respostas que a citam trocam o texto citado. **O HISTÓRICO É GUARDADO** (decisão dele, mesmo dia: "ao editar, guarde o
  histórico"): cada versão de antes vai para `mensagem_versoes` com de quando a quando valeu, e QUEM VÊ A MENSAGEM VÊ O HISTÓRICO,
  clicando no "(editada)" (`GET /api/messages/:id/versoes`): editar não vira jeito de mudar o que já foi respondido sem ninguém
  saber. As versões vivem o tempo da mensagem (apagar a leva junto), vão no "Levar seus dados" e na caixa-preta, e a política
  diz isso. Nem quem administra edita o texto dos outros (apaga, se precisar).
- **A cortiça do quarto mostra os AVISOS** (decisão dele, mesmo dia: "um item no quarto associado aos avisos"; entre o quadro de
  fotos, a pintura e a cortiça, ele escolheu a cortiça): os últimos 20 avisos dos canais de avisos de todas as comunidades da
  pessoa, sem os tópicos (`GET /api/me/avisos`, `CorticaDeAvisos.tsx`); clicar leva ao canal. A caixa de ideias, que a cortiça
  abria, continua embaixo do quarto.
Testes: `server/test/avisos-e-editar.test.ts`, `e2e/avisos-e-editar.mjs`, `e2e/historico-e-cortica.mjs` (passaram).

**"Pode moderar a conversa" no cargo (23/11/2026, o segundo da fila):** o interruptor fixo, ao lado do "Pode arrumar o salão"
(Cargos.tsx; a coluna `cargos.modera`), e a SEGUNDA EXCEÇÃO ao "cargo é identidade" (db.ts). Quem tem o cargo apaga a mensagem
dos outros, fixa e desafixa, encerra a enquete e apaga o tópico dos outros, só na comunidade do cargo. Banir, tirar alguém,
dar cargo, mudar papel e configurações seguem só de quem administra. A conta é uma só, `db.podeModerar` (dono, admin ou cargo
marcado), usada pelas rotas de apagar, fixar, enquete e tópico; a tela tira o mesmo de `usePodeModerar` (directory.ts), com os
cargos de cada membro e a lista de cargos que ela já tem, e por isso acompanha sozinha o `member:updated` e o `cargos:updated`.
As mensagens de erro de antes ("quem administra") não mudaram. Teste: `server/test/pode-moderar.test.ts`.

**O status da sala de voz** (23/11/2026; `server/src/status-da-sala.ts`, `web/src/StatusDaSala.tsx`): uma linha curta (até 60
caracteres, emoji vale) embaixo do nome da sala, como "ranqueada, não chamar". Muda quem está NA sala, ou quem administra; o texto
vazio tira. **Some sozinho quando a última pessoa sai** (a regra do "Jogando agora": status que ninguém atualiza vira enfeite
morto), e por isso só se põe com alguém lá dentro; as salas temporárias seguem igual. Só na memória do servidor, como quem está em
chamada, e vai junto do `voice:state` (`statusDasSalas`). A moderação da comunidade vale (palavras, links e o silêncio; quem
administra não passa por ela, como nas mensagens), e uma mudança a cada 3 s por pessoa. Pelo botão direito na sala ("Definir status
da sala"; no toque, o toque longo) e pelo lápis no cabeçalho do palco, para quem está na sala. Teste:
`server/test/status-da-sala.test.ts` (pelo socket de verdade). Sem e2e.

**O registro de moderação da comunidade (23/11/2026, o próximo da fila):** em Configurações → Ferramentas → "Registro de
moderação", só para quem administra (`GET /api/communities/:id/registro`, 50 por vez, `?antes=<id>` para as mais antigas;
`registro-routes.ts`, `registroDaComunidade` em db.ts). É a MESMA tabela da auditoria de quem cuida do Syden (`audit_log`, que
ganhou `target_id`), filtrada pela comunidade e pelas ações de `ACOES_DO_REGISTRO`: remover, banir, desbanir, advertir, silenciar,
dar e tirar administrador e cargo, travar o microfone, cortar a transmissão, apagar a mensagem de OUTRA pessoa, fixar e desafixar,
criar, renomear, apagar e restaurar canal, o modo lento, as regras da moderação automática e a troca do convite. **Os nomes são lidos
na hora pelos números** (quem excluiu a conta vira "Conta excluída"; o nome por extenso fica só na auditoria geral); da mensagem
apagada, só de quem era e o canal, NUNCA o texto; o motivo da advertência e as palavras proibidas não vão ao registro (moram nas telas
delas). A mensagem apagada por quem cuida do Syden aparece como "Quem cuida do Syden", sem o nome. Ação nova de moderação: uma linha em
`ACOES_DO_REGISTRO` e a frase em `RegistroDeModeracao.tsx`. Teste: `server/test/registro-de-moderacao.test.ts`.

**Convites com prazo e limite de usos (23/11/2026, o próximo da fila).** O código de sempre da comunidade continua igual (o
"Chamar alguém" e o botão da capa o usam, não expira, e só quem administra o troca). Os A MAIS moram em `convites`
(`server/src/convites-routes.ts`): qualquer membro cria um com validade (30 min, 1 h, 6 h, 12 h, 1 dia, 7 dias ou nunca) e
usos (sem limite, 1, 5, 10, 25, 50, 100), no máximo 25 valendo por pessoa; o código tem 10 letras sorteadas pelo crypto e nunca
bate com o de sempre de outra comunidade. A entrada é a de sempre (`/api/communities/join`, a prévia do link e o cadastro, por
`comunidadeDoConvite`): banido, comunidade cheia e a barreira da proteção continuam valendo, e o USO só conta para quem entrou.
Vencido diz "Este convite expirou."; gasto, "Este convite já foi usado o máximo de vezes." (410), e eles só saem da tabela uma
semana depois, quando alguém olha a lista, para o link não virar "inválido" na hora. Quem administra vê os que valem, com quem
criou, em Configurações → Membros → Convites, e revoga qualquer um; quem criou vê e revoga os seus na própria janela. A janela
("Configurar convite", `ConfigurarConvite.tsx`) abre pelo botão direito no ícone da comunidade e pelo botão direito (no toque, o
toque longo) no botão de convite da capa. Quem criou cada convite está na política (`Dentro de cada comunidade`). O link de aula
não mudou. Teste: `server/test/convites.test.ts`. As frases novas, à espera de tradução, em `docs/frases-novas/convites.txt`.

## Trazer a estrutura de um servidor do Discord: canais e cargos, nunca permissões

**Feito em 23/11/2026, pedido dele ("eles copiam a estrutura de uma comunidade do Discord e transferem para o novo app").** Ao
criar uma comunidade, um link discreto embaixo do nome ("Trazer de um servidor do Discord") abre o campo do link do MODELO DE
SERVIDOR (discord.new/CODIGO ou discord.com/template/CODIGO, que o dono gera em Configurações do servidor → Modelo de servidor),
e "Ver o que vem" mostra a PRÉVIA (os canais de texto, os de voz e os cargos, com os nomes) antes de criar; o nome do servidor
vira a sugestão de nome. **Quem fala com o Discord é o servidor** (`server/src/modelo-do-discord.ts`, a rota pública
`/guilds/templates/{code}`, sem conta), só com o código, com 8 s de prazo, 2 MB no máximo e o teto de links por pessoa
(`muitosLinks`); a resposta fica 10 min na memória, e o "Criar" não pede de novo. Texto, anúncios, fórum e mídia viram canal de
texto; voz e palco, de voz. **O Syden não tem categoria**: elas são achatadas como o Discord mostra (os sem categoria primeiro,
depois cada categoria pela posição; dentro de cada uma, texto antes de voz). Até 100 canais (o Syden não tinha teto de canais:
confirmado por ele no mesmo dia) e os 50 cargos de sempre. **Cargo vem só com NOME e COR**: permissões não, porque cargo é
identidade (db.ts); o @everyone e os cargos de robô ficam de fora; sem cor, o cinza. Mensagens não vêm (o modelo não as tem).
Sem canal de texto no modelo, entra o primeiro inicial. A comunidade nasce numa transação só (erro do Discord não deixa
comunidade pela metade). Na política, `#modelo-do-discord`. Teste: `server/test/modelo-do-discord.test.ts` (sem rede).

## O bolão é uma pergunta com palpite de dia e hora, não uma tabela de jogos

**Refeito em 15/11/2026, pelo relato dele ao ver a primeira versão:** eu tinha entendido "bolão" como o de futebol (jogos,
placares, 10/5/3 pontos), e ele não entendeu a tela. O que ele queria: "adicionar uma imagem, adicionar a pergunta e cada pessoa
colocar a sua resposta; como no caso é o dia e o horário, cada um dá palpite com um calendário". Agora (`server/src/bolao-routes.ts`,
`web/src/Bolao.tsx`): qualquer membro cria uma PERGUNTA com foto opcional e, se quiser, a hora em que os palpites fecham; cada um
dá UM palpite de dia e hora (muda enquanto está aberto); os dos outros só aparecem quando fecha (no prazo, na mão, ou com a
resposta); quem criou ou quem administra lança a resposta certa, e ganha quem chegou mais perto (empatados na menor distância,
ganham todos). Só
pontos, sem dinheiro. A foto passa pelo funil das imagens, é servida pela chave do endereço (`/api/boloes/:id/foto/:chave`), está na
vassoura de órfãos e sai pelo Shield (a pergunta fica). **No calendário da comunidade** (ideia dele, mesmo dia), TODO bolão fica
registrado, os passados também ("ver eventos passados e futuros"), num dia só: o da resposta, quando já saiu (numa pergunta
de "quando", é o próprio acontecimento), senão o do prazo, senão o da criação; o dia ganha o selo com a inicial de "Bolão" no
canto (o desenho dele), e clicar o abre com a foto, os palpites e os GANHADORES em destaque ("Quem ganhou: …" e o troféu na linha); o
"voltar" dele volta ao calendário, no mesmo mês. As tabelas da primeira forma (`bolao_jogos`) caem
sozinhas na subida. Teste: `server/test/bolao.test.ts` e `e2e/bolao.mjs`. Outro tipo de resposta (número, texto) é mais um campo
no bolão e outra conta de distância.

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

## Controlar o computador de outra pessoa: nunca

**Decidido em 23/11/2026, pelo Sydenstricker, vendo o "jogar no PC do amigo" da Salinha:** "é uma brecha muito grande de
segurança". O Syden não oferece controle remoto (teclado, mouse ou controle de um mandando no computador de outro), nem para
jogo. Transmitir continua sendo só mostrar.

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

## O clipe não recodifica: copia os quadros que já chegam

**Decidido em 16/11/2026, pelo Sydenstricker.** O gravador de clipes recodificava a transmissão o tempo todo (medido no app: ~1
núcleo de quem assiste, que muitas vezes está jogando). Agora (`web/src/clipeCru/`, LIGADO no app e no site) o worker de cifra
copia os quadros JÁ CODIFICADOS, depois de decifrados, num anel; o arquivo só é montado quando a pessoa pede (VP8/VP9/AV1 em
WebM, H.264 em MP4, sem recodificar; as vozes vão alinhadas num WAV). O clipe abre num QUADRO-CHAVE:
- **No app, o quadro-chave é PEDIDO** (`sendKeyFrameRequest`, quando o último passa de 20 s). Só existe no caminho do
  RTCRtpScriptTransform, que o LiveKit recusa em todo Chromium pelo userAgent; o app o liga por `__sydenScriptTransform` e um
  DESVIO no código do LiveKit feito no build (`vite.config.ts`, que para o build se o trecho mudar numa versão nova). Medido
  no app: 58 ms. Escolha dele: SÓ no app, porque mexe na decifragem de todas as chamadas.
- **No navegador não há como pedir**, e o WebRTC quase não manda sozinho: o anel segura o último quadro-chave por até 10 min
  (ou 150 MB), e o clipe longo abre no editor com os últimos 30 s escolhidos (`Clipe.inicio`).
- **O preço:** o arquivo vem na taxa da transmissão e passa dos 8 MB do chat; ao mandar, o corte e o encolhimento são UMA
  passada (`Corte.caber`; em duas, 90 s no app; numa, ~13 s). Sem a cifra de ponta a ponta o gancho não vê nada, e em 6 s
  entra o gravador de antes. `localStorage 'syden.clipeCru' = 'nao'` volta ao de antes. Teste: `e2e/clipe.mjs` (`NO_APP=1`,
  `CLIPE_ANTIGO=1`, `CODEC=`).

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
- **A pergunta à placa MENTIA na NVIDIA (12/11/2026, relato dele com uma RTX 3070).** No Chrome e no Edge 157, o
  `mediaCapabilities.encodingInfo` responde "não é pela placa" para tudo, e a transmissão de verdade sai pelo
  codificador da NVIDIA: quem tinha NVIDIA transmitia em VP8 pelo processador. Quando ela diz não, o Syden pergunta ao
  WebCodecs (`prefer-hardware`), que acertou (H.264 sim; VP9 e AV1 não). Ver `escolherCodec.ts`.
- **O DEGRAU LEVE DO PADRÃO (12/11/2026, relato: ajudando uma amiga a instalar a impressora, o notebook dela não dava
  conta de 1080p a 30 e o texto chegava ilegível; ele quis automático, não um modo na lista).** O processador ou a internet
  apertando por 3 s (o MOTIVO, não o número de quadros: o navegador segura os 30 encolhendo a imagem) leva a transmissão a
  720p, até 15 quadros e 2 Mbps, segurando a nitidez (`proximoLeve`, streamStats.ts). Folgou ~24 s, volta uma vez; apertou
  de novo, fica até o fim. Simulado no codificador VP8 do Chrome com uma tela de Configurações: a 270p que ela recebia é
  ilegível; o leve a 720p se lê até a 600 kbps (`e2e/fotos/degrau-leve-comparacao.png`). **O leve é de quem MOSTRA UMA TELA,
  nunca de quem joga** (pergunta dele, mesmo dia: "o jogador se beneficia de altos frames; é outro perfil"): jogo pesado também
  aperta o processador, e para ele encolher e segurar os quadros continua o certo. O que separa os dois é quanto a tela MUDA (a
  captura só entrega quadro quando algo muda): o leve só entra com menos de 15 mudanças por segundo, nunca numa janela que o
  app reconhece como jogo, e sai sozinho em 2 s se a tela passa a mexer (abriu o jogo depois de ajudar); sem a medida, conta como
  jogo (`telaEmMovimento`). O Fluido nunca entra no leve. Teste: `e2e/degrau-leve.mjs` (a tela e o jogo; o aperto é
  simulado, porque o estrangulamento do Chrome para também o "jogo" desenhado na página). **O leve mede de segundo em
  segundo, num laço só dele** (pergunta dele, mesmo dia: "8 s de transição podem parecer lag"): na conferência geral de 4 s
  eram duas medidas, e o jogo aberto dentro do leve passava até 8 s a 15 quadros. Medido no e2e: entra em 3,5 s e sai em 2,8 s.
  A volta ao normal com folga continua em 24 s: ali não há lag, só a imagem continuando nítida.
- **O som da tela no NAVEGADOR saía como voz (16/11/2026, relato: a turma assistindo à gravação do Mundial de LoL, "o áudio
  parecia walkie-talkie").** Publicado pelo `setScreenShareEnabled`, ele herdava os padrões da sala, que são os do microfone:
  DTX ligado (o Opus para de mandar no que acha que é silêncio, e narração com torcida liga e desliga) e 48 kbps. O som do app já
  ia como música; agora os dois vão por `SOM_DA_TELA` (128 kbps, estéreo, sem DTX nem RED). Teste: `e2e/som-da-tela.mjs` (lê a
  negociação de verdade; o DTX vem na resposta do servidor, `usedtx=1`).
- **Uma opção em cada menu de compartilhar.** No app não existe aba de navegador; no navegador a janela
  sai sempre muda. App: tela inteira e janela. Navegador: tela inteira e aba.

**OS AJUSTES DE 23/11/2026 (sugestões de quem usa).** (1) **O Safari só abre a escolha de tela no mesmo instante do clique**: o
Syden perguntava o codec à placa ANTES do `getDisplayMedia`, e o Safari recusava ("InvalidStateError"). A captura é pedida primeiro
e o codec junto (`shareScreen` em useVoice.ts); **nada que espere pode vir antes da captura**. No iPhone e no iPad nenhum navegador
compartilha tela, e o aviso diz isso. (2) **Cada tela diz de quem é** ("ana · nome da janela"): com quatro transmitindo, só o nome
da janela não dizia nada. (3) **O botão direito EM CIMA DA TRANSMISSÃO começa pelo som dela** (a régua, calar, parar de assistir),
antes do menu da pessoa; é o mesmo volume do alto-falante de cima (`useVolumeDaTela`). (4) **O botão "Canais" do cabeçalho recolhe
a coluna da esquerda** (`esconderCanais`), guardado, só no computador e só onde há cabeçalho para trazê-la de volta (no quarto e no
salão ela não se recolhe); com uma tela em destaque, a faixa de rostos fica mais baixa. (5) **A prévia do Syden Broadcast**: o
"Testar" embaixo do fundo da câmera mostra o efeito ao vivo (só no app, onde o fundo existe). Teste: `e2e/quem-transmite.mjs`.

**A EXCEÇÃO, O PERSONALIZADO (16/11/2026, sugestão de quem usa; decisão dele: "é uma forma manual de corrigir eventual leitura
equivocada do Syden"; o caso foi a gravação do Mundial, que o Padrão encolhia para segurar os quadros de um vídeo).** Ao lado
de Padrão e Fluido, o terceiro modo: quem transmite escolhe a resolução (HD 720p, Full HD 1080p ou a Nativa da tela, até 4K) e
os quadros (15, 30 ou 60), e **durante a transmissão o Syden não muda nada** (sem degraus de tamanho, sem o leve, sem a nitidez
da tela parada, sem a queda do Fluido; o diário continua contando os apertos). Sob aperto o navegador ainda sacrifica algo, e
o desempate segue os quadros: 15 segura a nitidez, 60 segura os quadros, 30 equilibra. Full HD e a Nativa levam a versão de
540p para quem tem internet fraca; HD, não. `web/src/telaPersonalizada.ts`; teste `e2e/tela-personalizada.mjs`. Padrão e
Fluido continuam decidindo sozinhos: o Personalizado é a correção, não o caminho de fábrica.

**A regra que fica:** antes de pôr uma escolha de qualidade na tela, pergunte se o Syden consegue
medir e decidir sozinho. Quase sempre consegue — e uma escolha que ninguém entende vira o relato
"um modo deu problema e não sei qual".

**QUEM ASSISTE NO SEGUNDO MONITOR ENQUANTO JOGA (14/11/2026, relato: FPS baixo no LoL; a ideia de medir é dele: "a segunda
tela não pode se dar ao luxo de consumir tantos recursos").** No mesmo monitor do jogo, o Chrome percebe que está coberto e a
página e o vídeo param sozinhos (medido: a página a 0 quadros). No segundo monitor o Syden fica à vista e sem foco, e o vídeo
seguia inteiro. Agora, **sem foco E com o computador apertado**, a tela e as câmeras dos outros descem à versão de 540p, e voltam
com o foco ou com 20 s de folga; apertou de novo depois de voltar, fica até o foco (`apertoDeQuemAssiste.ts`, aplicado por
`qualidadeQueRecebo.ts`). Folgado e sem foco, nada muda: quem só assiste no segundo monitor não perde nada. Os sinais, porque o
navegador não deixa ver RAM nem placa: a **pressão do processador** (Compute Pressure API, Chrome e Edge; entrega a leitura sem foco
enquanto o microfone está aberto, medido) com "serious" na hora ou "fair" JUNTO com quadros perdidos (o "fair" sozinho contava
por 5 s até 16/11/2026, e saiu: decodificar 1080p já o causa, e quem só assistia ao Mundial caía para 540p), e os **quadros perdidos** na decodificação
(todo navegador) acima de 10% em duas medidas seguidas (uma só é a troca de versão). Medido (`e2e/assistir-apertado.mjs`, VP8 pelo
processador, 15 quadros): o navegador de quem assiste de 2,21 para 0,93 núcleo. Uma linha no diário por chamada quando acontece.
**No app**, o Electron nunca deixa a página "escondida" (o freio de segundo plano desligado: coberta e até minimizada, ela anima a
60 por segundo, medido), então o app diz à página se está à vista (`desktop/src/a-vista.js`, com a janela da frente lida pelo
módulo nativo): minimizado, na bandeja ou coberto inteiro por outro programa, o vídeo nem é baixado.

**DUAS VERSÕES, O "BANDA" QUE ERA O TETO E O BOTÃO DE RECOMENDAR (12/11/2026, pelo diário de 11/11 e por pedido dele).**
O diário trazia "chega embaçada" e "apertada pela internet" com a internet sobrando (26 Mbps estimados, saindo 427×240).
Medido (`e2e/versoes-da-tela.mjs`), três coisas eram nossas:
- **O Chrome diz "banda" também quando a versão bate no TETO de taxa dela**, no mesmo computador. A de 360p a 800 kbps
  com jogo pesado ia a 213×120. O diário culpava a internet, e a otimização dinâmica encolhia a imagem e só a devolvia
  com "nenhum aperto", que não vinha: medido, 540p → 180p → 135p → 90p, parado. Agora "banda" só é a internet quando a
  estimativa não cobre a soma dos tetos das versões ligadas; se cobre, é o "teto" (`motivoDoAperto`, streamStats.ts), que
  não encolhe nem segura a volta, e vai ao diário como "pelo teto da versão".
- **Três versões cobravam demais de quem transmite** (pergunta dele: "ter tantas opções cobra do streamer"): 1080p, 720p e
  360p, 7,8 Mbps e +55% de pixels. **Agora são DUAS, 1080p a 5 Mbps e 960×540 a 1,8, nos dois modos**: 6,8 Mbps e +25%.
  A de 540p é também a do celular em pé (o LiveKit pede pela largura do quadro × a densidade, que ele limita a 2), e o
  1,8 foi medido: é a mesma taxa por pixel da de 360p a 800, e a 1,5 ela desaba. O preço aceito: quem baixa menos de
  ~1,8 Mbps vê a imagem travar em vez de borrar.
- **Com duas versões, o "sem teto" de quem assiste mandava 1080p a todo mundo.** O LiveKit as rotula "baixa" e "média";
  pedir "alta" sem camada alta faz ele ignorar o tamanho do quadro. O teto é a maior que a transmissão TEM
  (`maiorQualidade`, qualidadeQueRecebo.ts).

**O "Recomendar para este computador"** (Configurações → Voz e vídeo, embaixo de Padrão e Fluido; `recomendarModo.ts`) é
a exceção pedida por ele à regra acima: a escolha continua, e o Syden a faz quando a pessoa pede. Ele mede o ENVIO até o
servidor (pedaços de 1 MB a `/api/medir-envio`, que só conta e joga fora; a ida e volta é descontada), pergunta à placa
se codifica 1080p a 60, e lembra no aparelho se o último Fluido caiu para 30 ou aguentou um minuto. Fluido só com as três
a favor (12 Mbps ou mais); senão Padrão, com o porquê na tela, e o modo já fica escolhido. Sem medir a internet, não
recomenda nada.

## Desempenho: o Electron fica, e sem foco nada se mexe

**Avaliado em 06/11/2026, a pedido dele, depois de o Discord anunciar a troca do Electron por um app em Rust (GPUI, sem
navegador embutido; a primeira versão de teste com ~290 MB contra até 4 GB do atual, sem data).** Para o Syden, NÃO: seria
reescrever a interface inteira (a conversa, as chamadas, o quarto e o salão, os 100+ jogos em three.js e canvas, os 80 idiomas
com RTL) e manter duas, porque o site no navegador continua. O GPUI é de um editor de texto, e o problema que o Discord tinha
(4 GB) o Syden não tem. Se um dia pesar, o caminho é trocar a casca, nunca a interface.

**Medido no mesmo dia, nesta máquina (Ryzen 7 3700X, 16 núcleos, 32 GB), com o Discord aberto ao lado:** parados, o Syden
instalado usava 602 MB e o Discord 964 MB (a página do Discord sozinha, 469 MB), e no disco 405 MB contra 544 MB. Mas o
processador perdia: 1,1% da máquina contra 0,1%, com o Syden ATRÁS do VS Code. As causas eram as animações que nunca paravam:
o brilho da capa (que mexia no `left` e repintava a cada quadro) e as animações DENTRO dos SVGs dos avatares do mascote, que a
página não pausa. **A regra que ficou: sem foco ou escondida, nada se mexe** (`web/src/janelaComFoco.ts`: a marca
`janela-sem-foco` pausa toda animação de CSS, e o avatar troca para `avatar-*-parado.svg`, gerado pelo exportador do mascote).
Medido: o canal de texto, sem foco, de 15%/19% (página/placa, de um núcleo) para ~0%. Animação nova de CSS já obedece; animação
em canvas ou em SVG dentro de `<img>` precisa olhar `useJanelaComFoco()` ou `document.hasFocus()`, como o quarto e os jogos.

**Com a janela À VISTA, os coelhos continuam vivos** (decisão dele, mesmo dia): a regra do GIF ("anima só sob o mouse") era
contra o pisca-pisca, e o mascote vivo é a imersão do ambiente. O custo (~14% de um núcleo na página e ~22% na placa com
dezenas de avatares na lista) é aceito, porque só existe enquanto a pessoa olha o Syden, e não enquanto joga.

**Na chamada (medido no mesmo dia, o app de desenvolvimento com uma segunda pessoa, chamada cifrada):** com a janela à vista,
~1 núcleo (6% da máquina); sem foco, ~⅓ de núcleo (2%). O maior gasto fixo é a SUPRESSÃO DE RUÍDO (o processo `NodeService`):
20 a 37% de um núcleo o tempo todo. Assistir a 1080p em VP8 decodificado pelo processador (o pior caso: quem transmite sem
codificador na placa) custou ~1,8 núcleo (11%); com H.264 pela placa deve ser menos. A transmissão não foi medida de verdade (o
"jogo" do teste é desenhado pelo processador, e capturar a tela real só com o pedido dele). Os scripts da medida ficaram no
scratchpad da sessão (`medir-por-processo.ps1` separa os processos pelo `--type=` do Chromium).

**A supressão de ruído, avaliada no mesmo dia (pedido dele):** medido no Electron com o processo e a porta de verdade, o
DPDFNet é ~90% do custo do processo: o modelo leva ~1 ms a cada quadro de 10 ms em rajada e 1,3 a 2 ms em tempo real (a cache
esfria entre um quadro e outro). Por isso os ~20% de um núcleo com som, contra os ~12% de 10/2026, que foram medidos em
rajada. Tentado e SEM ganho: as opções do onnxruntime (otimização do grafo, arena, spinning, 2 threads), reaproveitar os
tensores do estado (153 KB por quadro) e mandar dois quadros por vez. Feito: **o quieto não passa pelo modelo** (o microfone
mudo e o silêncio abaixo de −60 dBFS de pico por 300 ms; de ~20% para ~2%, no app e no GTCRN do site) e a transformada por
tabela (~400 KB lidos duas vezes por quadro) virou FFT. Baixar o custo com som pede trocar ou quantizar o modelo (int8),
o que precisa de Python e de medir a qualidade de novo na gravação dele (DNSMOS): decisão dele.

**A supressão do site que dorme sem voz: MEDIDA E NÃO LIGADA (15/11/2026, pedido dele).** O GTCRN roda o tempo todo numa
chamada de verdade (o "quieto" de −60 dBFS nunca chega com o ruído de um quarto: 100% nos cinco cenários medidos). Um detector
por energia (`semVozAgora` em gtcrn.worklet.js, ligado só pelo teste) não separa voz de ruído o bastante: onde o começo das frases
sai intacto, o modelo roda 90% do tempo; onde ele dorme metade, o começo das frases perde 4 a 8 dB com ventilador ou ruído alto.
O padrão continua o "quieto". O próximo passo, se valer, é um detector de voz de verdade (um modelo pequeno). Os números e o
teste: `e2e/supressao-sem-voz.mjs` (fala pt-BR do Windows sobre cinco ruídos, o worklet de verdade no Node).

**O lote pequeno da auditoria (15/11/2026):** o PING mora fora do useVoice (`definirPing`/`usePing` em ping.ts): como estado do
Shell, redesenhava o app inteiro a cada 2 s da chamada; sem foco, uma medida a cada 10 s. O aviso "Você está silenciado!" ouve
uma CÓPIA da faixa do microfone já aberta (`faixaCruaDoMicrofone`), e não um segundo getUserMedia com o cancelamento de eco e a
supressão do navegador em dobro (medido: a cópia de uma faixa desligada pelo mudo traz o mesmo som da original). Os contextos de
áudio dos sons da interface, dos jogos e do soundboard DORMEM 10 s depois do último som (`audioOcioso.ts`): antes, depois do
primeiro "plim", a thread de áudio ficava acordada a sessão inteira. O das vozes do clipe dorme com o gravador desligado. As
cenas do mascote (`Mascote.tsx`) têm o "-parado.svg" sem foco, como os avatares. Contexto de áudio novo: `usar` ou
`segurar`/`soltar`; nunca deixar um "running" à toa.

**A CENA À VISTA DORME SEM FOCO (15/11/2026, pedido dele: "1,1 GB de RAM é muita coisa, especialmente no contexto brasileiro de
PCs mais modestos").** O quarto e o salão no segundo monitor, com o jogo no primeiro: 30 s sem foco, a parte à vista do canvas
vira uma FOTO e o iframe sai (`cenaDormindo.ts`, usado por QuartoNovo e SalaoNovo); com o foco de volta, a página é montada de
novo com a foto por cima até dizer "pronto" (sem o mascote de espera no meio). Medido (`e2e/cena-dormindo.mjs`): o salão libera
~950 MB e o quarto ~400 MB; acordar leva ~3 s no quarto e ~7 s no salão, com a foto à vista. Não dorme no Editar nem com uma
peça aberta. A foto não traz os nomes nem os balões (HTML por cima do canvas). As cenas 3D (Quarto3D, Salao3D) ainda não dormem.

**A PAUSA DO VÍDEO SÓ COM TELA CHEIA DE VERDADE (15/11/2026, relatos de quem usa: "o mute das lives voltou a dar problema",
"dependendo do app, em tela cheia, só trava o vídeo", "o Discord vaza os mics compartilhando só uma janela").** Medido no app
(`e2e/mudo-e-pausa-no-app.mjs`): o mudo da live CONTINUA calado ao minimizar, cobrir e descobrir; o defeito era a pausa da 0.1.10,
que parava o vídeo com uma SOBREPOSIÇÃO transparente em tela cheia na frente (o Syden à vista atrás dela). Agora só conta como
coberto a janela da frente que ocupa o MONITOR inteiro e não é camada nem deixa o clique passar (WS_EX_LAYERED/TRANSPARENT, no
`janelaDaFrente` do módulo nativo). NÃO o WS_EX_NOREDIRECTIONBITMAP: todo programa feito com o Chromium o tem (medido com o VS Code).
O DIÁRIO DE SAÚDE ganhou duas linhas: o programa que pausou o vídeo (uma por programa, por chamada, só assistindo), e o motivo de,
numa JANELA, ir o som do computador inteiro (`donoDaJanela` em screen-audio.js: app da Store, módulo antigo, ou só o som do
programa não abriu). A barra de título do app mostra a versão. Tudo isso chega com a versão do app depois da 0.1.10. Os testes do
app pedem o PC parado: com alguém usando, a janela do teste não vem para a frente e o "coberto" falha.

## O fundo da câmera: só no app, e a imagem não sai do computador

**O SYDEN BROADCAST (16/11/2026, decisão dele):** em Voz e vídeo, os efeitos feitos por um modelo no computador de quem usa
ficam juntos sob esse nome, como o NVIDIA Broadcast junta os dele: a supressão de ruído (no site também, o GTCRN) e o fundo da
câmera (só no app). O nome é marca e fica igual nos 80 idiomas. O cancelamento de eco é do navegador e fica em "Processamento de
voz". Efeito novo do mesmo tipo (um modelo rodando no aparelho) entra nesta seção.

**Pedido dele em 14/11/2026 ("como o NVIDIA Broadcast"), medido em 14–15/11 (`e2e/fundo-da-camera/README.md`), construído em
16/11 ("pode construir").** Em Configurações → Voz e vídeo, abaixo da câmera: Nenhum, Desfocado, Apagado ou Imagem (a imagem
fica no aparelho, reduzida a 1280 × 720). Vale na hora, com a câmera ligada. **Só no app** (no site, a rede neural pediria o
'wasm-unsafe-eval'); onde o app não roda o modelo, a escolha nem aparece.
- **O modelo é o PP-HumanSeg** (Apache 2.0, 6 MB, versionado em `desktop/fundo-camera/` com a origem e a licença; crédito nos
  termos, seção 10), num processo à parte (`desktop/src/fundo-camera/`), com 2 núcleos e prioridade baixa. Ele sai sozinho um
  minuto depois da última câmera. **As threads do onnxruntime NÃO giram à espera** (`allow_spinning: '0'`): girando, ele custava
  0,55 de um núcleo, contra 0,18 sem girar (medido no app).
- **O caminho de cada quadro** (`web/src/fundoDaCamera.ts`, o processador da faixa do LiveKit): no máximo 15 vezes por segundo, o
  quadro reduzido a 192 × 192 vai por uma porta direta ao processo, sem lista de transferência (a porta do Electron não recebe
  ArrayBuffer transferido). A máscara volta suavizada pela média que se adapta, e a placa monta a saída em WebGL2. **O desfoque é
  só do fundo**, pesado pela máscara e dividido pelo peso no fim; sem isso, o cabelo e a roupa viravam uma sombra em volta da cabeça.
- **Se o processo cair ou a placa recusar, o quadro passa como veio**: a câmera nunca fica preta por causa do efeito.
- Teste: `e2e/fundo-da-camera-no-app.mjs` (o app com a câmera falsa tocando um vídeo do estudo; os quatro modos e o custo) e
  `desktop/test/fundo-camera.test.mjs`. Sobra: uma franja clara fina da parede em volta do cabelo (o modelo a 192 px).
- **A IMAGEM DE FUNDO SAÍA CINZA, igual ao "Apagado"** (relato de quem usa, 23/11/2026): o efeito lia a imagem só do localStorage, e a
  foto de verdade (1280 × 720 em JPEG) não cabia quando ele estava cheio; a gravação falhava calada. Agora a imagem fica na memória
  da sessão e o localStorage é só para a próxima vez (com uma versão mais leve se a cheia não couber). E escolher "Imagem" sem
  imagem nenhuma já abre o seletor de arquivos. O e2e enche o localStorage antes de escolher (com o código antigo, falha). **E a causa de verdade, no ar, era outra:** a imagem era aberta por
  `fetch(data:…)`, e a política de segurança do site (connect-src, sem `data:`) a barrava; o site de desenvolvimento não tem a
  política, e o e2e passava. Agora o base64 é aberto sem fetch. **Regra: nada de fetch em endereço data: ou blob: no site.**

**O FILTRO GUIADO E O COMPLETO (17/11/2026, relato dele: "não fica tão refinado quanto o do NVIDIA Broadcast"; "pode fazer os 3").**
A franja clara em volta do cabelo saiu com o FILTRO GUIADO na placa (`fundoDaCamera.ts`: perto da borda, a máscara segue o brilho do
próprio quadro; 320 px, raio 4, eps 0,004; +0,1 a 0,4 ms por quadro, medido no app; nas fotos, a franja de ~49% para ~46% e o corte
da pessoa de ~41% para ~32%; em vídeo, +12% de troca de lado no contorno e o arrasto igual). Há DOIS modelos: o **Leve** (o
PP-HumanSeg 192, no processador, para todos) e o **Completo** (o PP-MattingV2 512 do PaddleSeg, Apache 2.0, em 16 bits, 18 MB,
convertido por nós dos zips oficiais por `e2e/fundo-da-camera/converter-paddle.py`; borda de 1 px contra 5, ~5 ms pelo DirectML,
~225 MiB de VRAM), numa thread à parte do processo (abrir pelo DirectML trava a thread por ~1,5 s). O pacote passou a levar o
`DirectML.dll` (+~37 MB com o modelo; o `dxcompiler` e o `dxil` não precisam ir). **No Automático (o de fábrica) o Syden decide**
(`desktop/src/fundo-camera/decisor.js`): o Completo só com a placa capaz (abaixo de 33 ms ao abrir), sem jogo na frente
(GameConfigStore ou tela cheia de verdade, `jogo.js`, a cada 2 s), com luz (no escuro ele se perde: brilho médio abaixo de 85 vai ao
Leve, volta acima de 100) e sem aperto (5 quadros seguidos acima de 60 ms; a NVIDIA à toa baixa o relógio e o quadro leva 25–50 ms, e
isso não é aperto); desce sem piscar (a máscara anterior entra na mesma suavização) e volta com folga. **QUEM USA PODE SOBREPOR**
(decisão dele, 17/11/2026, pelo caso do Mundial: "uma detecção automática deixou os usuários de reféns"; o mesmo princípio do
Personalizado da transmissão): Voz e vídeo → Recorte → Automático, Leve ou Completo, e o Automático diz o que está usando
("Automático · Completo"). **A escolha manual é respeitada** (nem jogo, nem aperto, nem pouca luz a trocam); só o Completo que não
roda de jeito nenhum vira o Leve, dito na mesma linha ("Completo indisponível neste computador"), sem janela. Uma linha no diário de
saúde na primeira descida do Automático. O PP-HumanSeg v2 de retrato custa metade do Leve no processador (6,8
contra 13,8 ms) com números parecidos, e NÃO entrou: ele viu os vídeos lado a lado e não gostou (17/11/2026). O Leve continua o PP-HumanSeg 192. Não medido: webcam e escuro de verdade (o 85/100 vem de vídeos
escurecidos por código), outras placas além da RTX 3070, um jogo de verdade na frente. Medida: `e2e/fundo-da-camera/README.md` (os
comparativos lado a lado em `resultados/`, fora do git); testes: `desktop/test/fundo-camera.test.mjs` e `e2e/fundo-da-camera-no-app.mjs`.
**Mais candidatos, medidos no mesmo dia (relato dele: "mesmo o Completo não é perfeito, olhe os artefatos"): NÃO HÁ COMPLETO MELHOR que
caiba ao vivo.** O U²-Net humano (15 ms na placa) é pior e 10× maior; BEN2 e BiRefNet retrato recortam melhor com luz, mas levam 1 s e
13 s por quadro; MatAnyone (não comercial), IS-Net (AGPL), ViTMatte e SAM 2 (pedem marcação) ficaram fora. **O escuro derruba o Completo
pelo RUÍDO, não pela falta de luz**: clarear a entrada piora; a média dos quadros na entrada ajuda (72 → 82% no pior vídeo) sem chegar ao
Leve. A regra "câmera escura vai ao Leve" fica; o que decide o próximo passo é medir uma webcam de verdade num quarto escuro. **A troca de
modelo não se vê** (`e2e/fundo-da-camera-luz.mjs`, a luz acendendo e apagando como um interruptor, no app): a máscara muda até 0,9% no
quadro da troca, contra até 1,7% da própria luz mudando e 0,4% parada; desce ao Leve ~0,7 s depois de apagar e volta em ~0,3 s.

## O celular como câmera: o celular não entra na chamada

**Pedido dele em 23/11/2026, visto no Trivo.** Na chamada, Mais → "Usar o celular como câmera" mostra um QR code; o celular
abre a página (sem conta) e a câmera dele vira a câmera da pessoa, no lugar da webcam. O botão da câmera, aceso, desliga o celular.
- **O celular manda a imagem DIRETO ao computador** (WebRTC de aparelho para aparelho), e o computador a publica como a câmera
  dele. Por isso a cifra de ponta a ponta não mudou (uma pessoa, um aparelho, uma chave por sala), o fundo da câmera vale também
  para ela, e o celular não ouve nem vê nada da chamada.
- **O servidor só emite o par e repassa o aperto de mão** (`server/src/camera-do-celular.ts`, namespace `/celular`, fora do da
  conta): um token de uso único que vale 10 minutos, um par por pessoa, tudo na memória. **O QR leva um SEGREDO depois do #**,
  que nunca chega a servidor nenhum, e cada mensagem do aperto de mão vai assinada com ele (HMAC, sentido e número que só sobe):
  o servidor não troca a impressão digital da conexão (`web/src/cameraDoCelular.ts`). O celular tira o segredo da barra de
  endereço ao abrir.
- **Sem STUN nem TURN** (nada de terceiro sabendo o endereço de ninguém): só funciona com os dois na MESMA REDE, e a tela diz
  isso quando não liga em 20 s. Funcionar pelo 4G pede um TURN nosso: decisão dele.
- Parar no celular de propósito só apaga a câmera, sem janela no computador; a conexão que cai mostra "O celular saiu.".
- **Testado por ele com um iPhone de verdade em 23/11/2026: funcionou.** O vídeo do celular vem EM PÉ, e o quadro da chamada
  (deitado) o cortava pelo meio; agora a câmera em pé aparece INTEIRA, com faixas da cor do quadro dos lados (`camera-em-pe` em
  VoiceStage.tsx, medido pelo tamanho do vídeo). Vale para qualquer câmera em pé.
- **Também pelas Configurações** (pedido dele, 23/11/2026): "Usar o celular como câmera" embaixo da prévia do Syden Broadcast (só no
  app, onde a prévia existe). FORA DE UMA CHAMADA a imagem do celular fica guardada (`faixaDoCelular` em useVoice.ts), a prévia
  acende sozinha com ela e o fundo escolhido, e ela entra como a câmera quando a pessoa entra numa sala; o botão aceso desliga. A
  janela do QR code é uma só para o app (no Shell, por cima das Configurações).
- Testes: `server/test/camera-do-celular.test.ts` e `e2e/celular-como-camera.mjs` (passaram; o "celular" é outro navegador com uma
  câmera em pé de canvas, na mesma máquina). E `e2e/celular-nas-configuracoes-no-app.mjs` (o app, passou).

**OS AJUSTES DA IMAGEM (23/11/2026, pedido dele, depois de usar o celular: "senti falta de mais opções de ajuste na imagem").** O
**grupo A, feito NO COMPUTADOR**, vale para qualquer câmera (a webcam e o celular) e onde o navegador mexe nos quadros (o app, Chrome,
Edge): Configurações → Voz e vídeo → "Ajustar a imagem", embaixo da prévia: zoom até 4× (a régua, ou a rodinha em cima da prévia),
ARRASTAR a prévia para enquadrar, "Imagem inteira" ou "Preencher 16:9" (o celular em pé vira um quadro deitado), espelhar, claridade e
contraste (`web/src/ajusteDaCamera.ts`). Mora no MESMO processador do fundo da câmera, antes do recorte (o modelo já recebe o quadro
enquadrado), e o modelo do fundo só abre quando um efeito pede. O recorte NÃO amplia: o zoom sai com menos pixels, sem inventar.
Fica nas preferências (`ajusteDaCamera`), e vale na hora, também numa chamada. Testes: `web/test/ajusteDaCamera.test.ts` e
`e2e/ajustes-da-camera.mjs` (no Chrome, passou). **O grupo B (a câmera do próprio celular: lente, zoom de verdade, foco, lanterna)
espera a MEDIÇÃO no iPhone dele:** `web/public/medir-camera.html` (no ar em /app/medir-camera.html; fora do app, nada é enviado,
o resultado é copiado à mão), que lista o que cada câmera deixa e testa o zoom e a lanterna de verdade.
**O GRUPO B ESTÁ FEITO (24/11/2026), pela medição no iPhone dele (iOS 18.7):** o zoom da LENTE e a lanterna funcionam pelo Safari;
o foco não (só informa a distância mínima), nem o balanço de branco. **Os controles moram NA TELA DO CELULAR** (decisão dele): os
atalhos 0,5× · 1× · 2× · 5× que a câmera alcança, a pinça no vídeo e a lanterna (só onde existe); o que o aparelho não deixa não
aparece (`controles`, `zoom`, `lanterna` em cameraDoCelular.ts; PaginaDoCelular.tsx). **Pedindo só "a de trás", o iPhone entrega a
traseira comum, que começa em 1×**; a que chega a 0,5× é a câmera virtual "dupla" (ou "tripla"), que junta as lentes. Os nomes vêm
traduzidos e o Safari não diz o que uma câmera faz sem abri-la, então na primeira vez o celular abre cada câmera de trás, uma de cada
vez, e fica a primeira cujo zoom começa abaixo de 1, lembrada no aparelho (`syden.celularTraseira`; `procurarGrandeAngular`). O zoom
do computador (grupo A) continua valendo por cima. O e2e simula as três câmeras do iPhone.

## O app de Android: medido, ainda não começado

**Medido em 23/11/2026, a pedido dele ("transmitir a tela do celular é uma funcionalidade importante").** O Chrome do Android não
tem `getDisplayMedia`: só um app transmite. O caminho recomendado: uma WebView nossa com o site, e um serviço nativo (o SDK de
Android do LiveKit, MediaProjection) que entra na sala como um SEGUNDO participante da pessoa (`<id>:tela`), só publicando a tela,
com uma chave de mídia que a página entrega por dentro do celular e distribui pelo embrulho de hoje. O maior risco é a cifra do
SDK de Android casar com a do navegador (o `setKey` dele só aceita texto): é o primeiro dia de qualquer protótipo, e mexe no
protocolo da cifra (pede revisão de fora). O preço escondido: o servidor e o site leem a identity como "o número da pessoa" em
dezenas de lugares, e a regra dos menores precisa valer para `<id>:tela`. Estimativa: protótipo 10 a 13 dias; publicável 37 a
50 dias; mais 14 dias de teste fechado com 12 testadores (conta pessoal nova). Decisões dele em aberto: conta pessoal ou de empresa
na Play, push (Firebase, terceiro novo), Android mínimo (10, pelo som), e se o app é só para transmitir ou vira o Syden do celular.

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
