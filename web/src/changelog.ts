// As novidades que aparecem na tela inicial. A mais nova em cima; a data é a de quando entrou no ar.
// Escreva pensando em quem vai ler: o que mudou para a pessoa, não o que mudou no código.

export interface Update {
  date: string;
  title: string;
  icon: string;
  items: string[];
}

export const CHANGELOG: Update[] = [
  {
    date: '2026-09-26',
    title: 'A aba dos coelhos, e a medalha em quadro',
    icon: '🐰',
    items: [
      'Na tela inicial, em cima da estátua, apareceu o balão Coelhos: ele abre os dois lado a lado para você escolher quem representa o seu Syden.',
      'Passe o mouse em cada um: o OurBunny pula e solta estrelinhas, o BigChunkus afunda e levanta poeira — cada um com o peso que tem.',
      'A escolha vale no app inteiro: o ícone da barra lateral, a tela de entrada e a estátua da praça passam a mostrar o coelho que você escolheu.',
      'A medalha de quem contribui virou um quadro com moldura dourada e gemas, no estilo das insígnias de jogo — a mesma moldura vai servir para as próximas medalhas.',
    ],
  },
  {
    date: '2026-09-26',
    title: 'O Syden fala a sua língua',
    icon: '🌍',
    items: [
      'O idioma agora se escolhe dentro do app, em Configurações → Idioma, e não mais na hora de instalar. A troca vale na hora, sem reiniciar nada, e é só sua.',
      'Quem abre o Syden pela primeira vez já entra na língua do computador dele, quando ela existir por aqui.',
      'Por enquanto há português, inglês e espanhol — juntos, a língua oficial de 86 países. Outros 69 idiomas já estão mapeados: o que ainda não foi traduzido aparece em português, nunca em branco.',
      'E as letras aparecem certas em qualquer alfabeto: árabe, chinês, coreano, hindi, tailandês, hebraico, amárico… O Syden busca a fonte daquela escrita quando precisa, para ninguém ver quadradinhos.',
    ],
  },
  {
    date: '2026-09-25',
    title: 'Menu do botão direito refeito',
    icon: '🖱️',
    items: [
      'Clicando com o botão direito em alguém, o menu agora começa mostrando quem é a pessoa: foto, nome na cor dela e o cargo aqui na comunidade.',
      'Novidades no menu: abrir o perfil, mencionar a pessoa na conversa (o nome cai no campo de escrever) e fazer uma anotação sobre ela — a anotação fica só no seu computador, ninguém mais vê.',
      'O que é de moderação ficou separado embaixo, com título próprio, para ninguém clicar sem querer.',
      'O menu também anda pelo teclado (setas e Esc) e não escapa mais pela borda da tela quando aberto lá embaixo.',
    ],
  },
  {
    date: '2026-09-25',
    title: 'Ideia acolhida: agradecimento, confete e medalha',
    icon: '🏅',
    items: [
      'Mandou uma ideia pela tela inicial? O Syden responde na hora agradecendo, na mesma conversa — e a conversa continua aberta, para tirar dúvidas sobre a ideia.',
      'Quando a ideia entra no app de verdade, cai confete na sua tela com a sua sugestão escrita, e o perfil ganha a medalha dos coelhos — a marca de quem contribuiu com o Syden.',
      'Se você não estiver online na hora, a festa te espera: ela acontece assim que você abrir o Syden de novo.',
      'Para quem cuida do Syden: as ideias chegam com 💡 na conversa e têm um joinha do lado — é ele que acolhe a ideia.',
    ],
  },
  {
    date: '2026-09-25',
    title: 'A vila arrumada',
    icon: '🏡',
    items: [
      'A horta não fica mais por cima da casa, nem a ponte por cima da cabana: agora cada coisa da vila é desenhada na ordem certa, de trás para a frente, e os coelhos passam por trás da fonte quando estão atrás dela.',
      'A horta mudou para o gramado da frente, onde dá para ver os pés de cenoura.',
      'A estátua da praça troca de coelho: passe o mouse nela e clique para pôr o BigChunkus no pedestal — ou o OurBunny de volta. Fica do seu jeito neste computador.',
    ],
  },
  {
    date: '2026-09-25',
    title: 'Você escolhe qual transmissão abrir',
    icon: '📺',
    items: [
      'Entrando numa sala, a transmissão de quem está ao vivo aparece como um convite com o nome da pessoa e o que ela está mostrando. Ela só começa a ser baixada quando você clica em Assistir.',
      'Antes, o seu computador baixava e descomprimia a transmissão de todo mundo, mesmo a que você não estava olhando: numa sala com três telas ligadas eram três vídeos em cima do seu processador e da sua internet.',
      'Dá para fechar a transmissão a qualquer momento pelo botão no canto dela, e continuar na conversa sem gastar internet com a imagem.',
      'Quem prefere como era antes liga "Abrir a transmissão sozinha" em Configurações → Voz e vídeo.',
      'A tela agora sai em três tamanhos ao mesmo tempo, e cada pessoa recebe só o tamanho que está vendo — quem está com a transmissão num quadradinho não baixa mais 1080p.',
    ],
  },
  {
    date: '2026-09-25',
    title: 'Karaokê na sala de voz',
    icon: '🎤',
    items: [
      'Suba uma música que você tem e ponha para tocar: ela começa na tela de todo mundo da sala, no mesmo ponto.',
      'Com um arquivo de letra (.lrc), a linha do momento acende grande no meio da tela e vai andando sozinha.',
      'A música não passa pela chamada — cada computador toca a própria cópia, então a qualidade é a do arquivo e ninguém fica com a internet travada.',
    ],
  },
  {
    date: '2026-09-25',
    title: 'Recado em vídeo de tela',
    icon: '🖥️',
    items: [
      'No + da conversa, "Gravar um recado em vídeo": mostra a sua tela e fala por cima, até dez minutos, para explicar uma coisa a quem não está online.',
      'Antes de mandar, você vê o recado inteiro e pode descartar.',
      'Recado é arquivo grande, então tem prazo: some da conversa sozinho depois de sete dias, e a conversa avisa quanto falta.',
    ],
  },
  {
    date: '2026-09-25',
    title: 'Clipes: guarde a jogada depois que ela aconteceu',
    icon: '✂️',
    items: [
      'Na sala, com alguém transmitindo, apareceu uma tesoura: ela guarda os últimos segundos do que passou — até meio minuto, som junto.',
      'A prévia abre na hora, e daí dá para guardar no computador ou mandar direto na conversa.',
      'A gravação só roda enquanto há transmissão na tela, e nada sai do seu computador até você mandar.',
    ],
  },
  {
    date: '2026-09-25',
    title: 'Pacotes de emoji',
    icon: '😀',
    items: [
      'Em Configurações → Emojis agora tem um catálogo de pacotes: escolha várias imagens de uma vez, dê um nome a cada uma e publique.',
      'Instalar um pacote põe os emojis dele na comunidade inteira, para todo mundo usar nas mensagens; tirar o pacote leva os emojis junto.',
      'Dá para publicar os emojis que a sua comunidade já tem como um pacote, e instalar em outra de uma vez só.',
      'Dá para acrescentar ou tirar emojis de um pacote já publicado: quem instalou recebe a mudança na hora, sem reinstalar nada.',
      'Estrelas de 1 a 5, como nos pacotes de som, para a turma achar os melhores.',
    ],
  },
  {
    date: '2026-09-25',
    title: 'Dá para ver o que a pessoa está transmitindo',
    icon: '🎮',
    items: [
      'Antes a lista só dizia "Transmitindo em Sala 1". Agora diz o quê: "Transmitindo League of Legends em Sala 1".',
      'O nome vem do título da janela que a pessoa escolheu compartilhar. Compartilhando a tela inteira, aparece "a tela"; pelo navegador, que não conta o título, aparece o tipo (a tela, uma janela, uma aba).',
    ],
  },
  {
    date: '2026-09-23',
    title: 'Ícone novo e coelhos bem alimentados',
    icon: '🥕',
    items: [
      'O Syden ganhou um desenho novo: o mesmo coelho na estrela, mais limpo e com sorriso, no ícone do app, na aba do navegador e na abertura.',
      'Plante cinco cenouras na vila e a turma engorda. Dá para colocá-los de dieta pela própria dica, no canto da cena.',
    ],
  },
  {
    date: '2026-09-23',
    title: 'A tela inicial virou uma vila',
    icon: '🏡',
    items: [
      'A tela de início agora é uma vila vista de cima, com coelhos que andam por conta própria pela praça — cutuque um para ver o que ele sente, ou clique na grama para plantar uma cenoura.',
      'Coelho não fala: ele mostra um sentimento numa bolha de pensamento.',
      'E tem uma caixa de ideias logo abaixo da vila: escreva o que você gostaria que existisse no Syden e chega como conversa privada para quem cuida dele — com direito a resposta.',
      'As casas levam a algum lugar: Salas mostra quem está em cada sala de voz, Sons abre o catálogo de pacotes, Novidades traz esta lista e Explorar abre outra comunidade.',
      'Clicar no sol continua acendendo e apagando a luz do Syden inteiro.',
    ],
  },
  {
    date: '2026-09-23',
    title: 'Trocar de comunidade ficou mais suave',
    icon: '🔀',
    items: [
      'Antes, ao trocar de comunidade, cada pedaço da tela chegava na sua hora: primeiro os canais, depois as pessoas, depois a conversa.',
      'Agora a tela anterior fica de pé até tudo da nova estar pronto, e troca de uma vez só.',
    ],
  },
  {
    date: '2026-09-23',
    title: 'Seu perfil do seu jeito',
    icon: '🎨',
    items: [
      'Em Configurações → Minha conta dá para escolher a cor do seu nome, entre dez, e um fundo para o seu perfil — quatro deles com movimento.',
      'Clicando em alguém na lista da direita abre o cartão da pessoa, com o fundo e a cor que ela escolheu.',
      'Seu nome sai colorido na lista, nas mensagens e ali embaixo, ao lado da sua foto.',
    ],
  },
  {
    date: '2026-09-22',
    title: 'Pacotes de sons e modificador de voz',
    icon: '🎛️',
    items: [
      'O soundboard virou um catálogo: 43 sons divididos em sete pacotes, com estrelas para a turma eleger os melhores.',
      'Qualquer um monta o seu pacote com os áudios que quiser, e quem gostar instala com um clique.',
      'Marque a estrelinha nos seus sons preferidos: eles passam a abrir o painel.',
      'Modificador de voz na chamada: voz feminina, masculina, rádio de avião, helicóptero, robô, monstro, esquilo e caverna.',
    ],
  },
  {
    date: '2026-09-22',
    title: 'Transmissão mais firme e lista de pessoas sempre à mão',
    icon: '📺',
    items: [
      'Quando falta internet ou processador, a transmissão agora reduz o tamanho da imagem sozinha para segurar os quadros — nada de travar em 5 fps.',
      'A lista de pessoas, com cargos e status, deixou de sumir dentro das salas de voz (e some com um clique, quando a transmissão precisa da tela).',
    ],
  },
  {
    date: '2026-09-21',
    title: 'Conversas privadas',
    icon: '💬',
    items: [
      'Clique com o botão direito em alguém e escolha "Enviar mensagem" para abrir uma conversa só de vocês dois.',
      'Dá para criar conversas em grupo, escolhendo quem entra.',
      'Anexos, reações, enquetes e tópicos funcionam dentro delas igual nos canais.',
    ],
  },
  {
    date: '2026-09-21',
    title: 'Status, transmissões e o menu do botão direito',
    icon: '🟢',
    items: [
      'Botão direito no seu avatar para ficar ocupado, ausente ou invisível.',
      'Botão direito em alguém que está transmitindo para entrar direto na sala dela.',
      'Duas transmissões ao mesmo tempo agora cabem lado a lado na tela.',
    ],
  },
  {
    date: '2026-09-20',
    title: 'Chat mais completo',
    icon: '📎',
    items: [
      'Enviar arquivos e imagens, arrastando para a conversa.',
      'Enquetes, tópicos e reações nas mensagens.',
      'Emojis comuns e os da comunidade no mesmo seletor.',
    ],
  },
  {
    date: '2026-09-19',
    title: 'O Syden saiu do forno',
    icon: '🐰',
    items: [
      'Voz, vídeo, transmissão de tela e chat, com app para Windows.',
      'Comunidades com canais de texto e salas de voz.',
      'Soundboard, emojis próprios e painel de saúde do servidor.',
    ],
  },
];

const VISTO_KEY = 'syden.novidades';

/** A data da novidade mais recente. */
export const ULTIMA_NOVIDADE = CHANGELOG[0]?.date ?? '';

/** Tem novidade que esta pessoa ainda não abriu? */
export function temNovidade(): boolean {
  try {
    return (localStorage.getItem(VISTO_KEY) ?? '') < ULTIMA_NOVIDADE;
  } catch {
    return false; // sem armazenamento: não fica cutucando com a bolinha
  }
}

/** Marca as novidades como lidas (chamado quando a tela inicial abre). */
export function marcarNovidadesVistas() {
  try {
    localStorage.setItem(VISTO_KEY, ULTIMA_NOVIDADE);
  } catch {
    // sem armazenamento: a bolinha só volta a aparecer, nada quebra
  }
}
