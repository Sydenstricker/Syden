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
os sinais de vogal. As formas verbais dele seguem no masculino: é dívida conhecida, não descuido.

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

**Varredura de 06/10/2026** (o que o site manda ao abrir; página com menos de 5 KB é só o esqueleto
do app, e o anúncio pode entrar pelo JavaScript depois):
- Sem anúncio visto: TimeGuessr (tem /pt), WorldGuessr, City Guesser, Framed, Wikitrivia, Higher
  Lower, Neal.fun, Termo (pt-BR), JKLM.fun. Conexo e Contexto: incertos.
- Com anúncio no código: Globle, Worldle, GuessThe.Game, WhenTaken, Skribbl, Letreco, GeoGuessr,
  Magnitudle. Gartic Phone mostra anúncio, apesar da varredura não pegar.

**O caminho combinado, em três degraus:**
1. Uma lista de links na home ("Mini-games"), escolhida à mão, com a dica "abra, transmita e adivinhem
   juntos". Umas 2 horas.
2. Se pegar: um jogo na sala de voz feito pelo Syden, cada um respondendo na própria tela e a
   revelação junta (base comum: 2 a 3 dias). Os primeiros jogos são "Quanto é?" (estimativa) e "Em que
   ano?", ambos com conteúdo do Wikidata (CC0, em todas as línguas), uns 2 dias cada.
3. Depois: "Onde e quando?" com foto (o TimeGuessr nosso). Mapa próprio do Natural Earth, nunca
   tiles de terceiro, e fotos do Commons, com um acervo inicial curado à mão. O difícil é a
   curadoria, não o código (a mesma lição da aba de cultura).

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
- **Próximo passo:** o Sydenstricker põe uns US$ 5 no Retro Diffusion (e, se quiser comparar, assina um
  mês do PixelLab, cujo teste grátis acabou). Gera-se o kit do quarto (piso, paredes, 4 móveis, o coelho
  DE CORPO INTEIRO andando) e monta-se numa página de teste fora do Syden.

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

**Diagnosticado em 02/10/2026, não consertado.** A turma usa Discord para voz e Syden para tela; quem
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

Enquanto isso não existe, as saídas são desmarcar "compartilhar áudio" ao escolher a tela, ou baixar o
**Volume da transmissão** no "i" do quadro, que é separado da voz e vale só para quem baixa.

## Texto borrado na transmissão: o Padrão foi ajustado para jogo

**Diagnosticado em 06/10/2026, não consertado. PENDÊNCIA para o Sydenstricker fazer.** Relato: o
Magnitudle transmitido chegava com as formas grandes visíveis (avião, botões) e o texto pequeno
ilegível. É resolução baixa esticada, provavelmente 360p ou menos, e não defeito de rede.

**A causa é nossa, em boa parte.** O modo Padrão usa `maintain-framerate` e `contentHint: 'motion'`
(`SCREEN_HINTS`, em `useVoice.ts`): sob aperto de processador ou de internet de quem transmite, ele
corta resolução para segurar os 30 quadros. É o certo para jogo e o errado para site, slide ou
planilha, que ficam quase parados e precisam de letra legível. O modo Leve (`maintain-resolution`,
`detail`) já resolve isso, mas depende de quem transmite saber escolher, e ninguém sabe.

**Para confirmar antes de mexer:**
1. Quem transmite passa o mouse no "i" do quadro. Se aparecer "Seu computador está segurando a
   qualidade" ou "Sua internet está segurando a qualidade", é o aperto com o Padrão cortando resolução.
2. Quem transmite recomeça escolhendo Leve. Se o texto ficar nítido, está confirmado.
3. Quem assiste confere no "i" se não deixou o teto de qualidade baixo, e se o quadro não está pequeno
   (o `adaptiveStream` baixa a camada do tamanho em que o vídeo é mostrado).

**O conserto combinado (meio dia, com teste):** o Padrão decide sozinho o que sacrificar. A
otimização dinâmica já confere a transmissão a cada `SCREEN_CHECK_MS`; ela passa a perguntar também
"a imagem está quase parada?". Tela parada → `maintain-resolution` + `detail`; com movimento →
`maintain-framerate` + `motion`. A medida sai das estatísticas do próprio codificador
(`getStats` do `outbound-rtp` de quem transmite: bytes e quadros codificados por intervalo; tela
parada gera quase nada), sem processar a imagem. Cuidados:
- Trocar com folga (alguns segundos parado antes de ir para nitidez), senão um jogo com pausa fica
  alternando o tempo todo.
- O modo Fluido (jogos, 60 quadros) não entra nisso: ali a escolha da pessoa é explícita.
- Quem assiste continua sem comentário nenhum sobre a imagem (ver "O número verdadeiro que mente").

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
  apenas transmitir?"*. Para quem assiste, o cartão mostra só o que ele pode mudar: o teto do que
  baixar.

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
