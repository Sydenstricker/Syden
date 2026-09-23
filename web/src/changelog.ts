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
    date: '2026-09-23',
    title: 'A tela inicial virou uma vila',
    icon: '🏡',
    items: [
      'A tela de início agora é uma vila vista de cima, com coelhos que andam por conta própria pela praça — cutuque um para ver o que ele fala, ou clique na grama para plantar uma cenoura.',
      'As casas levam a algum lugar: Salas mostra quem está em cada sala de voz, Sons abre o catálogo de pacotes, Novidades traz esta lista e Explorar abre outra comunidade.',
      'Clicar no sol continua acendendo e apagando a luz do Syden inteiro.',
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
