import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { chave, idiomaAtual } from './i18n';
import { PALAVRAS_NOVAS_DO_DESENHO } from './desenhoPalavras';
import { contaEhAdulta } from './protecao';
import type { IdDoQuiz } from './quiz';

/**
 * Os mini-games da sala de voz, do lado do site (o servidor decide tudo: server/src/minijogos.ts).
 *
 * O CATÁLOGO DO "QUAL É O TAMANHO?": o nome de cada objeto, marcado para traduzir. A figura mora em
 * web/public/tamanho/<id>.png (o Fluent Emoji, ver web/scripts/figuras-do-tamanho.mjs). Os TAMANHOS moram só
 * no servidor, que é quem decide quem acertou — e só chegam na revelação. O teste web/test/minijogos.test.ts
 * confere que as listas têm os mesmos ids.
 */
export const OBJETOS: Record<string, { nome: string }> = {
  bacteria: { nome: chave('Bactéria') },
  formiga: { nome: chave('Formiga') },
  joaninha: { nome: chave('Joaninha') },
  abelha: { nome: chave('Abelha') },
  morango: { nome: chave('Morango') },
  caracol: { nome: chave('Caracol') },
  ovo: { nome: chave('Ovo de galinha') },
  camundongo: { nome: chave('Camundongo') },
  lampada: { nome: chave('Lâmpada') },
  celular: { nome: chave('Celular') },
  lapis: { nome: chave('Lápis') },
  banana: { nome: chave('Banana') },
  'bola-de-futebol': { nome: chave('Bola de futebol') },
  'bola-de-basquete': { nome: chave('Bola de basquete') },
  abacaxi: { nome: chave('Abacaxi') },
  notebook: { nome: chave('Notebook') },
  tulipa: { nome: chave('Tulipa') },
  coelho: { nome: chave('Coelho') },
  gato: { nome: chave('Gato') },
  cachorro: { nome: chave('Cachorro') },
  cadeira: { nome: chave('Cadeira') },
  'guarda-chuva': { nome: chave('Guarda-chuva') },
  violao: { nome: chave('Violão') },
  pinguim: { nome: chave('Pinguim-imperador') },
  flamingo: { nome: chave('Flamingo') },
  zebra: { nome: chave('Zebra') },
  vaca: { nome: chave('Vaca') },
  hipopotamo: { nome: chave('Hipopótamo') },
  cavalo: { nome: chave('Cavalo') },
  pessoa: { nome: chave('Pessoa adulta') },
  bicicleta: { nome: chave('Bicicleta') },
  rinoceronte: { nome: chave('Rinoceronte') },
  lhama: { nome: chave('Lhama') },
  bisao: { nome: chave('Bisão') },
  cama: { nome: chave('Cama') },
  camelo: { nome: chave('Camelo') },
  porta: { nome: chave('Porta') },
  trator: { nome: chave('Trator') },
  elefante: { nome: chave('Elefante-africano') },
  mamute: { nome: chave('Mamute') },
  moai: { nome: chave('Moai da Ilha de Páscoa') },
  carro: { nome: chave('Carro') },
  girafa: { nome: chave('Girafa') },
  casa: { nome: chave('Casa') },
  onibus: { nome: chave('Ônibus') },
  cacto: { nome: chave('Cacto saguaro') },
  'tiranossauro-rex': { nome: chave('Tiranossauro rex') },
  braquiossauro: { nome: chave('Braquiossauro') },
  coqueiro: { nome: chave('Coqueiro') },
  'baleia-azul': { nome: chave('Baleia-azul') },
  aviao: { nome: chave('Avião de passageiros') },
  'estatua-da-liberdade': { nome: chave('Estátua da Liberdade') },
  'campo-de-futebol': { nome: chave('Campo de futebol') },
  foguete: { nome: chave('Foguete Saturno V') },
  'roda-gigante': { nome: chave('London Eye') },
  titanic: { nome: chave('Titanic') },
  'torre-eiffel': { nome: chave('Torre Eiffel') },
  'monte-fuji': { nome: chave('Monte Fuji') },
  everest: { nome: chave('Monte Everest') },
  lua: { nome: chave('Lua') },
  terra: { nome: chave('Terra') },
  jupiter: { nome: chave('Júpiter') },
  sol: { nome: chave('Sol') },
  // 19/11/2026: a comida e os veículos
  limao: { nome: chave('Limão') },
  maca: { nome: chave('Maçã') },
  rosquinha: { nome: chave('Rosquinha') },
  pera: { nome: chave('Pera') },
  hamburguer: { nome: chave('Hambúrguer') },
  uva: { nome: chave('Cacho de uva') },
  cenoura: { nome: chave('Cenoura') },
  milho: { nome: chave('Espiga de milho') },
  berinjela: { nome: chave('Berinjela') },
  baguete: { nome: chave('Baguete') },
  skate: { nome: chave('Skate') },
  patinete: { nome: chave('Patinete') },
  motocicleta: { nome: chave('Motocicleta') },
  ambulancia: { nome: chave('Ambulância') },
  'caminhao-de-bombeiros': { nome: chave('Caminhão de bombeiros') },
  helicoptero: { nome: chave('Helicóptero') },
  tangerina: { nome: chave('Tangerina') },
  pessego: { nome: chave('Pêssego') },
  batata: { nome: chave('Batata') },
  pimentao: { nome: chave('Pimentão') },
  manga: { nome: chave('Manga') },
  pretzel: { nome: chave('Pretzel') },
  pepino: { nome: chave('Pepino') },
  treno: { nome: chave('Trenó') },
  lambreta: { nome: chave('Lambreta') },
  van: { nome: chave('Van') },
  caminhonete: { nome: chave('Caminhonete') },
  'carro-de-corrida': { nome: chave('Carro de corrida') },
  caminhao: { nome: chave('Caminhão') },
  // 21/11/2026: a fazenda e o esporte
  pintinho: { nome: chave('Pintinho') },
  galo: { nome: chave('Galo') },
  ganso: { nome: chave('Ganso') },
  porco: { nome: chave('Porco') },
  ovelha: { nome: chave('Ovelha') },
  cabra: { nome: chave('Cabra') },
  'bola-de-beisebol': { nome: chave('Bola de beisebol') },
  'bola-de-volei': { nome: chave('Bola de vôlei') },
  'pedra-de-curling': { nome: chave('Pedra de curling') },
  'patins-de-gelo': { nome: chave('Patins de gelo') },
  esqui: { nome: chave('Esqui') },
  'gol-de-handebol': { nome: chave('Gol de handebol') },
};

/**
 * As figuras desenhadas NA DIAGONAL (o lápis, o avião, o foguete): o comprimento delas é o da diagonal do
 * desenho, e não a largura nem a altura.
 */
export const NA_DIAGONAL = new Set(['lapis', 'banana', 'violao', 'aviao', 'foguete', 'limao', 'cenoura', 'milho', 'berinjela', 'baguete', 'skate', 'batata', 'pepino', 'esqui']);

/** Figuras em que o objeto medido é só PARTE do desenho: em Júpiter, o anel passa para fora da esfera. */
export const PARTE_MEDIDA: Record<string, number> = { jupiter: 0.72 };

/**
 * As categorias do "Qual é o tamanho?" (quais objetos entram em cada uma mora no servidor: CATEGORIAS, em
 * server/src/minijogos.ts). Aqui, o nome e as três figuras que desenham o botão.
 */
export const CATEGORIAS_DO_TAMANHO: { id: string; nome: string; figuras: [string, string, string] }[] = [
  { id: 'tudo', nome: chave('Tudo'), figuras: ['formiga', 'girafa', 'terra'] },
  { id: 'animais', nome: chave('Animais'), figuras: ['coelho', 'zebra', 'elefante'] },
  { id: 'dia-a-dia', nome: chave('Dia a dia'), figuras: ['lapis', 'violao', 'bicicleta'] },
  { id: 'gigantes', nome: chave('Gigantes'), figuras: ['onibus', 'torre-eiffel', 'everest'] },
  { id: 'comida', nome: chave('Comida'), figuras: ['morango', 'hamburguer', 'baguete'] },
  { id: 'veiculos', nome: chave('Veículos'), figuras: ['patinete', 'ambulancia', 'helicoptero'] },
  // 21/11/2026
  { id: 'fazenda', nome: chave('Fazenda'), figuras: ['pintinho', 'porco', 'vaca'] },
  { id: 'esportes', nome: chave('Esporte'), figuras: ['bola-de-volei', 'patins-de-gelo', 'gol-de-handebol'] },
];

export type Medida = 'altura' | 'comprimento' | 'diametro';

/**
 * O que se mede, numa seta antes do número: ↕ em pé (altura), ↔ deitado (comprimento e diâmetro). Era uma frase ("de
 * altura", "de diâmetro"), e a mistura confundia (relato do Sydenstricker, 13/10/2026); hoje os dois objetos de uma
 * rodada são medidos sempre do mesmo jeito (server/src/minijogos.ts, `sentido`), e a seta diz qual sem precisar de
 * tradução.
 */
export const SETA_DA_MEDIDA: Record<Medida, string> = { altura: '↕', comprimento: '↔', diametro: '↔' };

/** O tamanho na unidade que faz sentido: 2 µm, 6,7 cm, 5,5 m, 3.474 km. */
export function tamanhoLegivel(cm: number, locale: string): string {
  const fmt = (n: number, casas = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: casas }).format(n);
  if (cm < 0.1) return `${fmt(cm * 10_000, 0)} µm`;
  if (cm < 1) return `${fmt(cm * 10)} mm`;
  if (cm < 100) return `${fmt(cm)} cm`;
  if (cm < 100_000) return `${fmt(cm / 100)} m`;
  return `${fmt(cm / 100_000, 0)} km`;
}

/**
 * A partida como o servidor a manda: o que todo jogo tem (o jogo, quem começou, se acabou, o relógio) e o
 * resto, que é de cada jogo e cada painel lê do seu jeito (ver server/src/minijogo-motor.ts).
 */
export interface PartidaPublica {
  jogo: IdDoJogo;
  criadaPor: number;
  terminada: boolean;
  restanteMs: number;
  fase: string;
  /**
   * O CONVITE (13/10/2026): enquanto não é null, a partida ainda não começou e cada um da sala responde se joga.
   * Ausente = servidor de antes do convite, em que a sala inteira joga.
   */
  /** presentes: dos que aceitaram, quantos estão na sala agora (é o que a largada conta; o servidor antigo não manda). */
  convite?: { minimo: number; presentes?: number } | null;
  /** Quem joga (null = a sala inteira). */
  jogadores?: { userId: number; username: string }[] | null;
  /** Quem respondeu "Agora não". */
  recusaram?: { userId: number; username: string }[];
  souJogador?: boolean;
  recusei?: boolean;
  /** A partida solo (a aba Solo): só de quem a começou, sem sala nem convite. */
  solo?: boolean;
  [campo: string]: unknown;
}

/** Quem pediu é jogador? Num servidor de antes do convite, todo mundo da sala é. */
export const souJogador = (p: PartidaPublica | null) => p !== null && p.souJogador !== false;

/** Os jogos de MESA, de duas pessoas: começam na hora, e sentar é aceitar o convite. */
export const JOGOS_DE_MESA: readonly IdDoJogo[] = ['gomoku', 'mancala', 'damas', 'naval', 'partida-de-xadrez', 'bichos'];

/**
 * O convite está esperando a MINHA resposta? Antes da largada (ou, na mesa, enquanto ninguém sentou do outro lado),
 * para quem ainda não entrou e não disse "agora não".
 */
export function convitePendente(p: PartidaPublica | null): boolean {
  if (!p || p.terminada || p.souJogador !== false || p.recusei) return false;
  if (p.convite) return true;
  return JOGOS_DE_MESA.includes(p.jogo) && p.fase === 'esperando';
}
export type Partida = PartidaPublica & { recebidaEm: number };

export interface LinhaDoPlacar {
  userId: number;
  username: string;
  pontos: number;
}

/** O "Qual é o tamanho?" (server/src/minijogos.ts). O palpite é a razão objeto ÷ referência. */
export interface EstadoTamanho {
  rodada: number;
  rodadas: number;
  fase: 'estimando' | 'revelando' | 'fim';
  categoria: string;
  referencia: { id: string; cm: number; medida: Medida };
  /** O tamanho (`cm`) só chega na revelação. */
  objeto: { id: string; medida: Medida; cm?: number };
  real: number | null;
  meuPalpite: number | null;
  confirmaram: number[];
  palpites: { userId: number; palpite: number; pontos: number }[] | null;
  placar: LinhaDoPlacar[];
}

/** O Stop (server/src/minijogo-stop.ts). */
export interface EstadoStop {
  rodada: number;
  rodadas: number;
  fase: 'escrevendo' | 'parando' | 'conferindo' | 'resultado' | 'fim';
  letra: string;
  categorias: string[];
  quemParou: number | null;
  minhas: string[];
  completos: number[];
  respostas:
    | {
        userId: number;
        username: string;
        respostas: { texto: string; valida: boolean; contra: number; contestei: boolean; aceita?: boolean; pontos: number | null }[];
      }[]
    | null;
  /** Com dois na partida, a resposta só cai com o aceite de quem a escreveu (20/11/2026). */
  precisaAceite?: boolean;
  /** O bônus de quem apertou STOP com tudo valendo, na rodada que acabou. */
  bonus?: { userId: number; pontos: number } | null;
  bonusDoStop?: number;
  prontos: number[];
  placar: LinhaDoPlacar[];
}

/** O Sudoku (server/src/minijogo-sudoku.ts). */
export interface EstadoSudoku {
  fase: 'jogando' | 'fim';
  enigma: number[];
  meu: number[] | null;
  errados: number[];
  total: number;
  corrida: { userId: number; username: string; certas: number; erros: number; tempoMs: number | null }[];
}

/** A mesa de duas pessoas: Cinco em linha e Mancala (server/src/minijogo-tabuleiro.ts). */
export interface EstadoDuelo {
  fase: 'esperando' | 'jogando' | 'fim';
  jogadores: { userId: number; username: string }[];
  vez: 0 | 1;
  vencedor: 0 | 1 | 'empate' | null;
  motivo: 'jogo' | 'tempo' | 'desistiu' | null;
  casas: number[];
  ultima: number | null;
  /** Só no Cinco em linha. */
  lado?: number;
  linha?: number[] | null;
}

/** Os problemas de xadrez do Lichess (server/src/minijogo-xadrez.ts). */
export interface EstadoXadrez {
  rodada: number;
  rodadas: number;
  fase: 'resolvendo' | 'solucao' | 'fim';
  problema: string;
  nota: number;
  /** A cor de quem resolve ('w' brancas, 'b' pretas). */
  cor: 'w' | 'b';
  /** As 64 casas, de a8 a h1: '' vazia, maiúscula branca, minúscula preta. */
  casas: string[];
  ultimo: string | null;
  estado: 'resolvendo' | 'acertou' | 'errou';
  erro: string | null;
  jogadores: { userId: number; username: string; estado: 'resolvendo' | 'acertou' | 'errou'; tempoMs: number | null }[];
  placar: LinhaDoPlacar[];
}

export type Papel = 'lobisomem' | 'vidente' | 'anjo' | 'armadilha' | 'caldeirao' | 'amuleto' | 'carapaca' | 'mascara' | 'aldeao';
export type PapelEspecial = 'vidente' | 'anjo' | 'armadilha' | 'caldeirao' | 'amuleto' | 'carapaca' | 'mascara';

/** O Lobisomem (server/src/minijogo-lobisomem.ts; o preparo, a defesa, as poções e a história desde 19/11/2026). */
export interface EstadoLobisomem {
  fase: 'preparo' | 'noite' | 'amanhecer' | 'armadilha' | 'dia' | 'defesa' | 'julgamento' | 'veredito' | 'fim';
  dia: number;
  duracao: number;
  criadaPor: number;
  composicao: { lobos: number; especiais: PapelEspecial[]; noiteMs: number; diaMs: number };
  lobosMax: number;
  meuPapel: Papel | null;
  vivo: boolean;
  /** O seu microfone, desligado pela partida (20/11/2026): de noite, ou fora do jogo até o fim. */
  microfone?: 'noite' | 'fora' | null;
  jogadores: { userId: number; username: string; vivo: boolean; papel: Papel | null }[];
  ataque: Record<string, number> | null;
  conversa: { id: number; de: number; texto: string }[] | null;
  visoes: { alvo: number; lobisomem: boolean }[] | null;
  protegido: number | null;
  viuHoje: boolean | null;
  etapa: 'lobos' | 'pocao' | null;
  pocoes: { cura: boolean; veneno: boolean; curouHoje: boolean; envenenouHoje: number | null; decidiu: boolean } | null;
  alvoDosLobos: number | null;
  votos: Record<string, number> | null;
  acusado: number | null;
  julgou: number[] | null;
  meuJulgamento: boolean | null;
  julgamento: Record<string, boolean> | null;
  mortosDaNoite: number[];
  eliminado: number | null;
  armadilha: { quem: number; alvo: number | null } | null;
  /** No veredito, quem o amuleto salvou (21/11/2026). */
  amuletoQuebrou?: number | null;
  vencedor: 'vila' | 'lobisomens' | 'mascara' | null;
  historia: LinhaDaHistoriaDoLobisomem[] | null;
}
export interface LinhaDaHistoriaDoLobisomem {
  dia: number;
  tipo: 'ataque' | 'protecao' | 'visao' | 'cura' | 'veneno' | 'mortes' | 'acusado' | 'julgamento' | 'armadilha';
  de?: number;
  alvo?: number | null;
  salvo?: boolean;
  lobisomem?: boolean;
  mortos?: number[];
  votos?: number;
  sim?: number;
  nao?: number;
  saiu?: boolean;
  carapaca?: boolean;
  amuleto?: boolean;
}

/** O desenha e adivinha (server/src/minijogo-desenho.ts). */
export interface EstadoDesenho {
  fase: 'escolhendo' | 'desenhando' | 'revelando' | 'fim';
  vez: number;
  vezes: number;
  /** Três rodadas, cada uma com todo mundo desenhando uma vez (02/11/2026). Servidor antigo não manda. */
  rodada?: number;
  rodadas?: number;
  quemDesenha: number;
  opcoes: string[] | null;
  palavra: { id: string; texto: string; outras: string[] } | null;
  mascara: string[] | null;
  acertaram: number[];
  chutes: { userId: number; texto: string; perto: boolean }[];
  /** Muda quando o desenho é apagado ou desfeito: aí o site troca os traços em vez de juntar. */
  versao: number;
  tracos: { t: number; c: number; e: number; partes: [number, number[]][] }[];
  placar: LinhaDoPlacar[];
}

/** A Palavra secreta (server/src/minijogo-palavra.ts). As cores: 2 no lugar, 1 noutro lugar, 0 não tem. */
export interface EstadoPalavra {
  rodada: number;
  rodadas: number;
  fase: 'chutando' | 'revelando' | 'fim';
  chutes: number;
  meu: { texto: string; cores: number[] }[];
  acertei: boolean;
  palavra: string | null;
  outros: { userId: number; username: string; cores: number[][]; acertou: boolean; letras: string[] | null }[];
  placar: LinhaDoPlacar[];
}

/** A Festa dos coelhos (server/src/minijogo-festa.ts): 5 rodadas, um microjogo sorteado em cada. */
/** O id de um microjogo da Festa: os ids saem dos registros (server/src/festa/registro.ts e web/src/festa/registro.ts). */
export type Microjogo = string;

export interface LinhaDaFesta {
  userId: number;
  username: string;
  valor: number | null;
  /** Por que não pontuou: antes do sinal, errou, não valeu, ou não respondeu. */
  motivo: 'cedo' | 'errou' | 'invalido' | 'nada' | null;
  posicao: number | null;
  pontos: number;
}

export interface EstadoFesta {
  fase: 'preparando' | 'jogando' | 'revelando' | 'fim';
  rodada: number;
  rodadas: number;
  microjogo: Microjogo;
  /** Os dados prontos do microjogo (as trocas dos copos, as setas, os alvos…), iguais para todos. */
  dados: ({
    periodoMs?: number;
    inicial?: number;
    trocas?: [number, number][];
    passos?: number[];
    setas?: number[];
    alvos?: { t: number; casa: number }[];
  } & Record<string, unknown>) | null;
  duracaoMs: number;
  /** O saque: o sinal já saiu. */
  sinal: boolean;
  /** Há quanto tempo o 'jogando' começou, para quem recarrega no meio (a flor, o saque). */
  jogandoHaMs?: number | null;
  meu: { motivo: LinhaDaFesta['motivo']; valor: number | null } | null;
  prontos: number[];
  jogadores: { userId: number; username: string; avatar?: number | string | null }[];
  /** A última rodada vale o dobro (19/11/2026). */
  dobro?: boolean;
  /** O prêmio bônus do fim: quem venceu mais rodadas ganha `pontos`. */
  premio?: { ganhadores: number[]; valor: number; pontos: number } | null;
  /** Os copos: onde estava a cenoura (só na revelação). */
  resposta: number | null;
  linhas: LinhaDaFesta[] | null;
  placar: LinhaDoPlacar[];
}

/** O Tabuleiro da turma (server/src/minijogo-tabuleiro-da-turma.ts). As casas: 'i' a largada, '+' ganha, '-' perde, '?' evento. */
export type ItemDoTabuleiro = 'duplo' | 'escolhido' | 'troca' | 'ima' | 'escudo';
export type EfeitoDaCasa =
  | { tipo: 'mais' | 'menos' | 'chuva' | 'achado' | 'praga' | 'mutirao' | 'correnteza' | 'escorrega' | 'cheia'; valor: number }
  | { tipo: 'troca'; com: number }
  | { tipo: 'brinde'; item: ItemDoTabuleiro }
  | { tipo: 'vento' | 'escudo' | 'nada' | 'teleferico' };
/** Os tabuleiros da largada (24/11/2026): a horta é o de fábrica. */
export type IdDoTabuleiro = 'horta' | 'rio' | 'serra';

/** As casas desde 19/11/2026: também '$' a loja de itens e 'd' o duelo; as dos ramais vêm depois das da volta. */
export interface EstadoTabuleiro {
  fase: 'vez' | 'caminho' | 'loja' | 'andando' | 'itens' | 'duelo' | 'duelo-jogo' | 'minijogo' | 'reta' | 'premios' | 'fim';
  rodada: number;
  rodadas: number;
  /** O tabuleiro (24/11/2026; sem ele, a horta). 'c' a correnteza do rio, 'e' o escorrega da serra. */
  tabuleiro?: IdDoTabuleiro;
  casas: ('i' | '+' | '-' | '?' | '$' | 'd' | 'c' | 'e')[];
  /** Quantas casas tem a volta (as seguintes são dos ramais). */
  volta: number;
  /** As bifurcações: o ramal sai depois de `de` e volta em `ate`; as casas dele são `inicio` … `inicio + tamanho − 1`. */
  ramais: { de: number; ate: number; inicio: number; tamanho: number }[];
  dourada: number;
  preco: number;
  precos: Record<ItemDoTabuleiro, number>;
  maximoDeItens: number;
  /** As 3 últimas rodadas: as casas valem o dobro. */
  retaFinal: boolean;
  vez: number | null;
  participantes: {
    userId: number;
    username: string;
    avatar: number | string | null;
    pos: number;
    cenouras: number;
    douradas: number;
    itens: ItemDoTabuleiro[];
    presente: boolean;
  }[];
  /** O item usado nesta vez. */
  usado: { userId: number; item: ItemDoTabuleiro; alvo?: number; casa?: number } | null;
  /** O item comprado na loja desta vez. */
  compra: ItemDoTabuleiro | null;
  /** O duelo desta vez. */
  duelo: { de: number; contra: number | null; vencedor: number | null; valor: number } | null;
  /** Os prêmios bônus do fim. */
  premios: { tipo: 'microjogos' | 'andarilho' | 'eventos'; ganhadores: number[]; valor: number }[] | null;
  /**
   * O último andar: o dado, as casas por onde passou (a primeira é a de onde saiu) e o que a casa fez. `antes`: as contas, as
   * posições e a dourada de quando a peça saiu, para a tela não mostrar o resultado antes de ela chegar.
   */
  ultimo: {
    id: number;
    userId: number;
    dado: number;
    /** Os dados que saíram (dois, no dado duplo). */
    dados: number[];
    /** O dado escolhido (o item). */
    escolhido: boolean;
    caminho: number[];
    efeito: EfeitoDaCasa | null;
    comprou: boolean;
    antes: { dourada: number; pecas: { userId: number; pos: number; cenouras: number; douradas: number }[] };
  } | null;
  /** O microjogo entre as rodadas (ou o do duelo): a rodada da Festa, com quem joga e o formato. */
  mini:
    | (Omit<EstadoFesta, 'rodadas' | 'jogadores' | 'placar' | 'fase'> & {
        fase: 'preparando' | 'jogando' | 'revelando';
        inscritos: number[];
        formato: 'todos' | '2x2' | '1x3' | 'duelo';
        equipes?: number[][] | null;
      })
    | null;
  /** No fim, só quem ficou até o fim tem posição; quem saiu (e todos, na partida interrompida) vem com null. */
  classificacao: { userId: number; username: string; douradas: number; cenouras: number; posicao: number | null }[];
  /** Faltou gente: acabou antes do fim, sem troféu. */
  interrompida: boolean;
  partidaId: string;
}

/** Cidades à venda (server/src/minijogo-cidades.ts): o tabuleiro vem do servidor, que é quem decide tudo. */
export type TipoDaCasaDasCidades = 'largada' | 'cidade' | 'transporte' | 'noticia' | 'pedagio' | 'engarrafamento' | 'feriado';
export type CartaDasCidades =
  | 'quadrilha' | 'bolso' | 'feira' | 'carro' | 'multa' | 'largada' | 'carona' | 'onibus-errado' | 'chuva' | 'reforma' | 'aniversario' | 'festa' | 'passagem'
  // as notícias novas de 20/11/2026 (server/src/minijogo-cidades.ts)
  | 'ciencias' | 'restituicao' | 'show' | 'geladeira' | 'dentista' | 'vaquinha' | 'churrasco' | 'atalho' | 'pneu' | 'proxima-cidade'
  | 'feriadao' | 'alta-temporada' | 'baixa-temporada' | 'mutirao' | 'obras' | 'iptu' | 'turistas' | 'perdao';
export type OcorridoDasCidades = { id: number } & (
  | { tipo: 'salario'; userId: number; valor: number }
  | { tipo: 'aluguel'; de: number; para: number; casa: number; valor: number }
  | { tipo: 'comprou'; userId: number; casa: number; valor: number }
  | { tipo: 'leilao'; userId: number | null; casa: number; valor: number }
  | { tipo: 'carta'; userId: number; carta: CartaDasCidades; valor: number | null; grupo?: number; casa?: number }
  | { tipo: 'pedagio'; userId: number; valor: number }
  | { tipo: 'engarrafado'; userId: number }
  | { tipo: 'perdeu-vez'; userId: number }
  | { tipo: 'saiu-do-engarrafamento'; userId: number; valor: number }
  | { tipo: 'dados-iguais'; userId: number }
  | { tipo: 'vendeu-para-pagar'; userId: number; valor: number }
  | { tipo: 'faliu'; userId: number; credor: number | null }
  | { tipo: 'troca'; de: number; para: number; aceita: boolean }
  | { tipo: 'construiu' | 'vendeu-predio' | 'hipotecou' | 'resgatou'; userId: number; casa: number }
);
export interface PropostaDasCidades {
  de: number;
  para: number;
  darCasas: number[];
  darDinheiro: number;
  pedirCasas: number[];
  pedirDinheiro: number;
}
export interface EstadoCidades {
  fase: 'vez' | 'andando' | 'compra' | 'leilao' | 'acoes' | 'troca' | 'fim';
  modo: 'rodadas' | 'falencia';
  rodada: number;
  rodadas: number | null;
  casas: { tipo: TipoDaCasaDasCidades; nome?: string; uf?: string; grupo?: number; preco?: number; aluguel?: number; custo?: number; valor?: number; pais?: boolean }[];
  salario: number;
  multiplicador: number[];
  aluguelDoTransporte: number[];
  jurosDoResgate: number;
  lanceMinimo: number;
  vez: number | null;
  jogadores: { userId: number; username: string; avatar: number | string | null; pos: number; dinheiro: number; patrimonio: number; falido: boolean; parado: number; presente: boolean; robo?: boolean }[];
  posses: { casa: number; dono: number; predios: number; hipotecada: boolean; aluguel: number }[];
  /** O último andar: os dados (null quando foi uma notícia que moveu) e as casas por onde passou (a primeira é a de onde saiu). */
  ultimo: { id: number; userId: number; dados: [number, number] | null; caminho: number[] } | null;
  leilao: { casa: number; lance: number; lider: number | null } | null;
  troca: PropostaDasCidades | null;
  trocasRestantes: number;
  historico: OcorridoDasCidades[];
  /** No fim, só quem ficou até o fim tem posição; quem saiu (e todos, na interrompida) vem com null. */
  classificacao: { userId: number; username: string; patrimonio: number; falido: boolean; posicao: number | null; saiu: boolean }[];
  interrompida: boolean;
  partidaId: string;
  /** Quantos adversários do computador (só no Solo; 0 com a turma). */
  robos?: number;
  /** A partida rápida (19/11/2026): cada um começou com 2 cidades sorteadas. */
  rapida?: boolean;
  /** Dados iguais: quem está na vez joga de novo depois das ações. */
  deNovo?: boolean;
  /** Quanto custa sair do engarrafamento. */
  sairDoEngarrafamento?: number;
  /** O tabuleiro (20/11/2026): 'capitais' (32 casas, o de fábrica), 'brasil' (40 casas, as 27 capitais) ou 'mundo' (21/11/2026: 32 casas, 20 países). */
  tabuleiro?: 'capitais' | 'brasil' | 'mundo';
  /** A temporada de uma notícia: os aluguéis do grupo vezes `fator` até `vezes` vezes passarem. */
  temporada?: { grupo: number; fator: number; vezes: number } | null;
}

/** A Caça às pragas da horta (server/src/minijogo-caca.ts): cinco ondas de corvos e gafanhotos, mais pontos ganha. */
export interface EstadoCaca {
  fase: 'preparando' | 'jogando' | 'placar' | 'fim';
  onda: number;
  ondas: number;
  /** As pragas da onda (as trajetórias, caca/voo.ts); vazio fora da onda. */
  pragas: import('./caca/voo').Praga[];
  duracaoMs: number;
  /** Quanto da onda já passou, no servidor (só jogando). */
  decorridoMs: number | null;
  meu: { pontos: number; daOnda: number; municao: number; abatidas: number[] } | null;
  /** Mais pontos primeiro; a posição só entre quem ficou (empatados dividem). */
  placar: { userId: number; username: string; pontos: number; daOnda: number; acertos: number; posicao: number | null }[];
  /** No Solo: o recorde de antes, e se esta partida virou o novo. */
  recorde: { antes: number | null; novo: boolean } | null;
  partidaId: string;
}

/** O Minigolfe da toca (server/src/minijogo-golfe.ts): seis buracos, menos tacadas ganha. */
export interface EstadoGolfe {
  fase: 'preparando' | 'jogando' | 'placar' | 'fim';
  rodada: number;
  rodadas: number;
  /** O índice do buraco (web/src/golfe/fisica.ts, BURACOS). */
  buraco: number;
  duracaoMs: number;
  /** Quanto do buraco já passou, no servidor (só jogando). */
  decorridoMs: number | null;
  /** O buraco já não aceita tacada (o tempo acabou, ou todos terminaram): a tela não deixa bater. */
  fechando: boolean;
  tacadasMax: number;
  bolas: { userId: number; username: string; x: number; y: number; tacadas: number; dentro: boolean; acabou: boolean }[];
  /** A minha bola, como o servidor a simulou. */
  meu: import('./golfe/fisica').Bola | null;
  /**
   * Em ordem: menos tacadas primeiro. `buraco`: as tacadas do último buraco jogado. `posicao`: só entre quem ficou até o fim
   * (empatados dividem, como no troféu); null para quem saiu, que vem no fim, sem posição nem medalha.
   */
  placar: { userId: number; username: string; pontos: number; buraco: number | null; posicao: number | null }[];
  partidaId: string;
}

/** A Horta em cascata (server/src/minijogo-blocos.ts): cada um com a sua pilha; o servidor refaz a partida de cada um. */
export interface EstadoBlocos {
  fase: 'largada' | 'jogando' | 'fim';
  modo: 'versus' | 'sem-fim' | 'dois-minutos';
  semente: number;
  decorridoMs: number;
  partidaId: string;
  /** Cada um como o servidor viu: a pilha em 72 letras ('.' vazio, '0' a '5' os legumes, 'x' o caixote). */
  jogadores: { userId: number; username: string; pontos: number; vivo: boolean; saiu: boolean; grade: string }[];
  meu: {
    recebidas: number;
    versao: number;
    passo: number;
    pontos: number;
    lixos: { id: number; n: number; largura: number; altura: number }[];
    jogadas: [number, number, number, number][] | null;
    fim: boolean;
  } | null;
  /**
   * No fim: o lugar (a ordem de eliminação; empatados dividem), os pontos e quanto a pilha aguentou. O lugar é só entre quem
   * ficou até o fim (a mesma conta do troféu); quem saiu vem por último, com `lugar` null.
   */
  resultado: { userId: number; username: string; lugar: number | null; pontos: number; tempoMs: number }[] | null;
}

/** A Briga na horta (server/src/minijogo-briga.ts): o estado lento; o rápido vem no quadro do tempo real (briga/regras.ts). */
export interface EstadoBriga {
  fase: 'lutando' | 'avancando' | 'vitoria' | 'derrota' | 'fim';
  onda: number;
  ondas: number;
  venceu: boolean;
  jogadores: { userId: number; username: string; avatar: number | string | null; pontos: number; vidas: number }[];
  resultado: { userId: number; username: string; pontos: number; golpes: number; nocautes: number }[] | null;
  partidaId: string;
}

export type IdDoJogo = 'corrida' | 'festa' | 'tabuleiro' | 'cidades' | 'golfe' | 'caca' | 'nave' | 'estelar' | 'balao' | 'jato' | 'barco' | 'chefe' | 'duelo' | 'torre' | 'plataforma' | 'blocos' | 'briga' | 'masmorra' | 'comando' | 'tamanho' | 'stop' | 'sudoku' | 'gomoku' | 'mancala' | 'damas' | 'naval' | 'domino' | 'truco' | 'xadrez' | 'partida-de-xadrez' | 'cozinha' | 'skate' | 'futebol' | 'golfe3d' | 'tocas' | 'transito' | 'carrinhos' | 'ponte' | 'gincana' | 'planador' | 'ringue' | 'pinball' | 'lendas' | 'bichos' | 'arena' | 'lobisomem' | 'desenho' | 'palavra' | IdDoQuiz;

/**
 * As duas abas da estante (pedido dele, 14/10/2026). SOLO: a partida é só de quem joga, começa sem convite, não ocupa
 * a sala e não pede chamada (desde 24/10/2026, pedido dele: "na aba solo joga sozinho, na coletiva manda convite").
 * COLETIVO: a sala inteira é convidada. Os jogos que funcionam com uma pessoa só estão nas DUAS abas.
 */
export type GrupoDoJogo = 'solo' | 'coletivo';

/** A estante: a ordem é a da tela. O nome e a dica de cada jogo, traduzidos. */
export const JOGOS: { id: IdDoJogo; nome: string; dica: string; abas: GrupoDoJogo[]; idioma?: string }[] = [
  {
    id: 'tamanho',
    nome: chave('Qual é o tamanho?'),
    dica: chave('Ao lado de um objeto de tamanho conhecido aparece outro, e cada um aumenta ou diminui esse outro até achar o tamanho certo. Quem chegar mais perto ganha mais pontos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A corrida de kart (JogoCorrida.tsx). No Solo, contra o relógio, com os fantasmas dos amigos, sem partida no servidor;
    // no Coletivo, a turma corre junto (server/src/minijogo-corrida.ts).
    id: 'corrida',
    nome: chave('Corrida dos coelhos'),
    dica: chave('Uma corrida de kart. Sozinho, contra o relógio e os fantasmas dos amigos; com a turma, ao vivo, com itens e a Copa da Cenoura.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // Os microjogos de festa (JogoFesta.tsx, server/src/minijogo-festa.ts): cada um na própria tela, o resultado comparado.
    id: 'festa',
    nome: chave('Festa dos coelhos'),
    dica: chave('Cinco rodadas de jogos rápidos, cada um na própria tela: reflexo, pontaria, memória e olho. Quem for melhor em cada rodada ganha mais pontos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A briga de rua de lado (JogoBriga.tsx, server/src/minijogo-briga.ts): a turma contra os mesmos inimigos.
    id: 'briga',
    nome: chave('Briga na horta'),
    dica: chave('Os coelhos defendem a horta de raposas, corvos e um texugo. Andem juntos, batam em combo e cuidem uns dos outros: de 1 a 4 pessoas.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A masmorra vista de cima (JogoMasmorra.tsx, server/src/minijogo-masmorra.ts, masmorra-regras.ts ↔ masmorra/regras.ts): a rede da
    // Briga, com as salas, a chave, o baú e os botões do chão no servidor.
    id: 'masmorra',
    nome: chave('Masmorra da Toca'),
    dica: chave('Atravessem juntos a toca do rei-cogumelo: salas cheias de bichos, um baú com a cenoura que vai e volta, botões que pedem dois ao mesmo tempo e a porta trancada. De 1 a 4 pessoas.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // Correr e atirar de lado, em turma (JogoComando.tsx, server/src/minijogo-comando.ts, server/src/comando/): a rede da Briga,
    // com os bichos e as balas deles no servidor (pedido dele, 16/11/2026).
    id: 'comando',
    nome: chave('Comando Cenoura'),
    dica: chave('Correr e atirar com a turma: o lança-cenouras mira em oito direções, a granada abre caminho e quem solta os coelhinhos presos ganha reforço. O dragão espera no fim: de 1 a 4 pessoas.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A corrida de plataforma (JogoPlataforma.tsx). Como a de kart: no Solo, contra o relógio e os fantasmas dos amigos, sem
    // partida no servidor; no Coletivo, a turma corre a mesma fase ao vivo (server/src/minijogo-plataforma.ts).
    id: 'plataforma',
    nome: chave('Pulo do coelho'),
    dica: chave('Uma corrida de plataforma: correr, pular e não cair. Sozinho, contra o relógio e os fantasmas dos amigos; com a turma, ao vivo, numa fase ou nas três.'),
    abas: ['solo', 'coletivo'],
  },
  {
    id: 'stop',
    nome: chave('Stop'),
    dica: chave('Sai uma letra e cada um escreve uma palavra com ela em cada categoria. Quem completar primeiro aperta STOP, e a turma decide o que vale.'),
    abas: ['coletivo'],
  },
  {
    id: 'desenho',
    nome: chave('Desenha e adivinha'),
    dica: chave('Cada um desenha uma vez, e a sala chuta o que é. Quem acerta mais rápido ganha mais pontos.'),
    abas: ['coletivo'],
  },
  {
    id: 'lobisomem',
    nome: chave('Lobisomem'),
    dica: chave('Cada um recebe um papel em segredo. À noite os lobisomens atacam; de dia a vila conversa e vota em quem tirar do jogo. Precisa de 4 pessoas ou mais.'),
    abas: ['coletivo'],
  },
  {
    // O primeiro quiz de adivinhar (quiz.ts): o formato dos "-dle", com os monstros do SRD 5.1, que é livre.
    id: 'monstros',
    nome: chave('Monstros de fantasia'),
    dica: chave('Sai um monstro secreto, e cada um chuta outros da lista. Cada chute mostra o que bate com o secreto: tipo, tamanho, nível, alinhamento e como ele se desloca. Quem acertar com menos chutes ganha mais pontos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // 124 figuras de 11 mitologias, com os nomes de cada idioma (do Wikidata).
    id: 'mitologia',
    nome: chave('Mitologia'),
    dica: chave('Sai uma figura secreta da mitologia, e cada um chuta outras. Cada chute mostra o que bate com a secreta: a mitologia, o tipo, a forma e o que ela governa. Quem acertar com menos chutes ganha mais pontos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // O Worldle sem anúncio: os 193 países da ONU, com a distância e a direção até o secreto.
    id: 'paises',
    nome: chave('Países'),
    dica: chave('Sai um país secreto, e cada um chuta outros. Cada chute mostra a distância e a direção até o secreto, a região, a sub-região e a população. Quem acertar com menos chutes ganha mais pontos.'),
    abas: ['solo', 'coletivo'],
  },
  // OS TEMAS NOVOS DOS QUIZZES (21/11/2026, o lote D): listas nossas, com os nomes de cada idioma do Wikidata.
  {
    id: 'elementos',
    nome: chave('Elementos químicos'),
    dica: chave('Sai um elemento químico secreto, e cada um chuta outros. Cada chute mostra o que bate com o secreto: a família, o estado físico, o período, o grupo e o número atômico. Quem acertar com menos chutes ganha mais pontos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    id: 'dinossauros',
    nome: chave('Dinossauros'),
    dica: chave('Sai um dinossauro secreto, e cada um chuta outros. Cada chute mostra o que bate com o secreto: o período, a dieta, o grupo, o comprimento e onde ele foi achado. Quem acertar com menos chutes ganha mais pontos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    id: 'estados',
    nome: chave('Estados do Brasil'),
    dica: chave('Sai um estado secreto do Brasil, e cada um chuta outros. Cada chute mostra a distância e a direção até o secreto, a região, a população, a área, o litoral e a fronteira com outro país. Quem acertar com menos chutes ganha mais pontos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    id: 'animais',
    nome: chave('Animais'),
    dica: chave('Sai um animal secreto, e cada um chuta outros. Cada chute mostra o que bate com o secreto: a classe, a dieta, onde ele vive e o peso. Quem acertar com menos chutes ganha mais pontos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    id: 'xadrez',
    nome: chave('Problemas de xadrez'),
    dica: chave('Todo mundo recebe o mesmo problema do Lichess. Quem achar o lance certo mais rápido ganha o ponto extra.'),
    abas: ['solo', 'coletivo'],
  },
  {
    id: 'sudoku',
    nome: chave('Sudoku'),
    dica: chave('Todo mundo recebe o mesmo sudoku, e a sala vê quem está mais perto de terminar.'),
    abas: ['solo', 'coletivo'],
  },
  {
    id: 'gomoku',
    nome: chave('Cinco em linha'),
    dica: chave('Duas pessoas põem pedras no tabuleiro, uma de cada vez. Vence quem fizer cinco seguidas. A sala assiste.'),
    abas: ['solo', 'coletivo'],
  },
  {
    id: 'mancala',
    nome: chave('Mancala'),
    dica: chave('O jogo de semear: pegue as sementes de uma casa e espalhe uma por casa. Vence quem guardar mais no depósito. A sala assiste.'),
    abas: ['solo', 'coletivo'],
  },
  // OS CLÁSSICOS DE MESA (04/11/2026, pedido dele): regra pública, sem conteúdo para manter. Dominó e Truco com a turma (o
  // convite), Damas e Batalha naval na mesa de duas pessoas, com a sala assistindo. No Solo (05/11/2026, pedido dele), contra
  // o computador, como os outros jogos da turma que estão nas duas abas (os robôs: server/src/minijogo-robos.ts).
  {
    // JogoDomino.tsx, server/src/minijogo-domino.ts
    id: 'domino',
    nome: chave('Dominó'),
    dica: chave('O dominó de sempre, de 2 a 4 pessoas (com 4, em duplas). Encaixe as pedras pelas pontas, e quem bater primeiro leva os pontos das mãos dos outros.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // JogoTruco.tsx, server/src/minijogo-truco.ts
    id: 'truco',
    nome: chave('Truco'),
    dica: chave('O truco paulista, com vira e manilha, em 2 ou em duplas de 4. Peça truco, aumente para seis, nove e doze, ou corra. Ganha quem fizer 12 pontos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // JogoDamas.tsx, server/src/minijogo-damas.ts
    id: 'damas',
    nome: chave('Damas'),
    dica: chave('As damas brasileiras: comer é obrigatório, para a frente e para trás, e a dama anda a diagonal inteira. A sala assiste.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // JogoPartidaDeXadrez.tsx, server/src/minijogo-partida-de-xadrez.ts (05/11/2026): a partida inteira, ao lado dos problemas
    id: 'partida-de-xadrez',
    nome: chave('Xadrez'),
    dica: chave('Uma partida de xadrez inteira, com todas as regras. Quem abre fica com as brancas. A sala assiste.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // O skate (JogoSkate.tsx, server/src/minijogo-skate.ts): um minuto de manobras e combos. Na sala desde 06/11/2026 (pedido
    // dele): a mesma pista para a turma, os outros como fantasmas, e o servidor refaz a sessão de cada um.
    id: 'skate',
    nome: chave('Rolê do coelho'),
    dica: chave('Um minuto na pista de skate. Pule, gire, faça grind nos corrimãos e emende as manobras num combo: cada manobra a mais multiplica os pontos, mas cair perde o combo inteiro.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A cozinha (JogoCozinha.tsx, server/src/minijogo-cozinha.ts): cada um na própria cozinha, os mesmos pedidos para todos.
    id: 'cozinha',
    nome: chave('Cozinha da toca'),
    dica: chave('Pegue os ingredientes nos caixotes, pique na tábua, cozinhe no fogão e no forno sem queimar, monte no prato e entregue na janela. Todos recebem os mesmos pedidos: ganha quem entregar mais pratos em 3 minutos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // JogoNaval.tsx, server/src/minijogo-naval.ts
    id: 'naval',
    nome: chave('Batalha naval'),
    dica: chave('Cada um esconde a sua frota e atira no mar do outro. Acertou, atira de novo. Vence quem afundar a frota inteira primeiro. A sala assiste.'),
    abas: ['solo', 'coletivo'],
  },
  {
    id: 'palavra',
    nome: chave('Palavra secreta'),
    dica: chave('Todo mundo tenta adivinhar a mesma palavra de 5 letras, em 6 chutes. A sala vê as cores dos outros, mas não as letras. Quem acertar com menos chutes ganha mais pontos.'),
    // no Solo desde 19/11/2026: uma palavra de cada vez (o dueto e o quarteto também)
    abas: ['solo', 'coletivo'],
    // As palavras são dos dicionários do servidor: português, inglês e espanhol desde 24/11/2026, escolhidos na largada
    // (EscolhasDasPalavras.tsx). Por isso o jogo não leva mais o "· português" ao lado do nome.
  },
  {
    // Trocar e combinar com a pilha subindo (JogoBlocos.tsx, server/src/minijogo-blocos.ts): cada um na própria tela.
    id: 'blocos',
    nome: chave('Horta em cascata'),
    dica: chave('Troque dois legumes vizinhos para juntar três ou mais iguais. A pilha sobe sem parar: não deixe chegar ao topo. Com a turma, as cadeias e os combos mandam caixotes para os outros.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // O minigolfe (JogoGolfe.tsx, server/src/minijogo-golfe.ts): todos no mesmo buraco, ao mesmo tempo, cada um na própria tela.
    // FORA DA ESTANTE desde 20/11/2026 (decisão dele: "o minigolfe que fica é o 3D"): sem aba nenhuma, ele não aparece para
    // começar, e o servidor recusa partida nova (JOGOS_APOSENTADOS). A linha fica para o NOME nos troféus, nos recordes e no
    // painel de uso das partidas antigas.
    id: 'golfe',
    nome: chave('Minigolfe da toca'),
    dica: chave('Seis buracos de minigolfe, todos jogando o mesmo ao mesmo tempo. Puxe a bola para trás e solte para dar a tacada. Ganha quem somar menos tacadas.'),
    abas: [],
  },
  {
    // Tocas e Torres (JogoTocas.tsx, web/src/tocas/, server/src/minijogo-tocas.ts): o gênero da estratégia em tempo real, só a
    // mecânica. No Solo, contra o computador (três níveis); na sala, de duas pessoas, em lockstep (19/11/2026: só os comandos na rede).
    id: 'tocas',
    nome: chave('Tocas e Torres'),
    dica: chave('Estratégia em tempo real, contra o computador ou contra outra pessoa da sala: colete comida, madeira e ouro, construa a vila, avance de era e treine o exército. Ganha quem derrubar o centro da vila do outro, ou construir a Maravilha e mantê-la de pé por 2 minutos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // O minigolfe em 3D (JogoGolfe3D.tsx, server/src/minijogo-golfe3d.ts): as peças do Kenney Minigolf Kit, a mesma regra do da toca.
    // Os dois ficaram lado a lado para a turma dizer qual preferia (05/11/2026); em 20/11/2026 ele decidiu: fica o 3D.
    id: 'golfe3d',
    nome: chave('Minigolfe 3D'),
    dica: chave('Oito buracos em 3D, com rampas, castelo e moinho, todos jogando o mesmo ao mesmo tempo. Arraste para mirar e dar a força, e solte. Ganha quem somar menos tacadas.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // O futebol (JogoFutebol.tsx, server/src/minijogo-futebol.ts): na sala, a bola mora no servidor; no Solo, tudo no navegador.
    id: 'futebol',
    nome: chave('Futebol dos coelhos'),
    dica: chave('Futebol de campo pequeno, visto de cima. Encoste na bola para conduzir, segure Espaço para chutar mais forte e passe com X. Na sala, os times se completam com robôs.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A caça (JogoCaca.tsx, server/src/minijogo-caca.ts): as mesmas pragas para todos, cada um mirando na própria tela.
    id: 'caca',
    nome: chave('Caça às pragas da horta'),
    dica: chave('Corvos e gafanhotos atacam a horta. Mire e clique para acertar antes que fujam: a munição é contada, e cada onda vem mais rápida. Ganha quem fizer mais pontos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // O cruzamento (JogoTransito.tsx, server/src/minijogo-transito.ts, transito-sim.ts ↔ transito/sim.ts): a mesma semente para a
    // turma, cada um no próprio cruzamento, e o servidor refaz a partida de cada um (pedido dele, 06/11/2026).
    id: 'transito',
    nome: chave('Trânsito da toca'),
    dica: chave('Um minuto para soltar os carros do cruzamento sem deixar que batam. Fila cheia também custa pontos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A ponte (JogoPonte.tsx, server/src/minijogo-ponte.ts, ponte-sim.ts ↔ ponte/sim.ts): 30 s para montar, a mesma fase para a turma, e o
    // servidor refaz a simulação de cada um pela lista de peças; ganha a mais barata que passou (pedido dele, 06/11/2026).
    id: 'ponte',
    nome: chave('Ponte da toca'),
    dica: chave('Trinta segundos para montar uma ponte de madeira e aço. Ganha quem levar o tráfego até o outro lado gastando menos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A pista de carrinhos de brinquedo (JogoCarrinhos.tsx, server/src/minijogo-carrinhos.ts, carrinhos-sim.ts ↔ carrinhos/sim.ts):
    // cada carro preso à sua faixa, e quem joga só tem o acelerador (pedido dele, 06/11/2026).
    id: 'carrinhos',
    nome: chave('Carrinhos da toca'),
    dica: chave('Uma pista de carrinhos de brinquedo com quatro faixas: o carro segue a faixa sozinho, e você só acelera. Acelerou demais na curva, ele sai voando e perde tempo. No Solo, contra o relógio, os fantasmas dos amigos e robôs.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A mesa de pinball de 16 bits (JogoPinball.tsx, server/src/minijogo-pinball.ts, pinball-sim.ts ↔ pinball/sim.ts): cada um na sua
    // mesa, e o servidor refaz a partida pelos comandos de cada passo, mandados em trechos (16/11/2026).
    id: 'pinball',
    nome: chave('Pinball da Horta'),
    dica: chave('Uma mesa de pinball na horta: segure a mola, rebata nos repolhos e derrube as três cenouras para acender a toca do coelho, que solta mais uma bola. Três bolas, e sacudir demais trava a mesa.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // Os desafios de voo com pouso no alvo (JogoPlanador.tsx, server/src/minijogo-planador.ts, planador-sim.ts ↔ planador/sim.ts): a
    // asa-delta, a mochila a jato e o paraquedas, cada um na própria tela, e o servidor refaz o voo pelos comandos (16/11/2026).
    id: 'planador',
    nome: chave('Planador da toca'),
    dica: chave('Desafios de voo: asa-delta, mochila a jato e paraquedas. Passe pelos anéis e pouse no alvo, perto do centro e de leve.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A corrida de obstáculos em 3D (JogoGincana.tsx, server/src/minijogo-gincana.ts, gincana-sim.ts ↔ gincana/sim.ts): o coelho
    // corre, pula e se equilibra até a bandeira; o servidor refaz o percurso pelos comandos (pedido dele, 06/11/2026).
    id: 'gincana',
    nome: chave('Gincana da toca'),
    dica: chave('Uma corrida de obstáculos em 3D: corra, pule e se equilibre por plataformas, esteiras, serras e varredores até a bandeira. Caiu, volta à última bandeira. No Solo, contra o relógio e os fantasmas dos amigos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // O boxe de reflexo (JogoRingue.tsx, server/src/minijogo-ringue.ts, ringue-sim.ts ↔ ringue/sim.ts): o circuito de três
    // adversários do computador, cada um na própria tela, e o servidor refaz a luta pelos comandos (16/11/2026).
    id: 'ringue',
    nome: chave('Ringue da Toca'),
    dica: chave('Boxe de reflexo contra três adversários do computador. Leia o aviso de cada golpe, esquive ou defenda e bata na brecha. Bater quando a luva brilha enche a estrela do soco forte.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A corrida futurista (JogoJato.tsx, server/src/minijogo-jato.ts, server/src/jato.ts): a técnica do kart, muito mais rápida, com a
    // energia que é vida e turbo (pedido dele, 05/11/2026). Sem itens: a corrida da sala também vira recorde.
    id: 'jato',
    nome: chave('Coelhos a jato'),
    dica: chave('Corrida de naves-cenoura numa pista suspensa, muito mais rápida que o kart. A energia é a vida e o turbo: bater na borda gasta, a faixa cor-de-rosa recarrega, e sair da pista é cair. No Solo, contra o relógio e os fantasmas dos amigos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A subida vertical (JogoTorre.tsx, server/src/minijogo-torre.ts, server/src/torre.ts, web/src/torre/): a técnica do Pulo do
    // coelho, em pé (a versão nossa de um minijogo de torre do Mario Party 3, pedido dele, 05/11/2026).
    id: 'torre',
    nome: chave('A torre do celeiro'),
    dica: chave('Suba o celeiro por tábuas, fardos e vigas que se mexem até o cata-vento lá no alto, desviando das ferramentas que caem e dos corvos. No Solo, contra o relógio e os fantasmas dos amigos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // O duelo de aviões (JogoAvioes.tsx, server/src/minijogo-duelo.ts, duelo-sim.ts ↔ duelo/sim.ts): a versão nossa do Aces High do
    // Mario Party 3, o favorito dele, sobre a rede do Estoura-balão (pedido dele, 05/11/2026).
    id: 'duelo',
    nome: chave('Duelo de aviõezinhos'),
    dica: chave('Coelhos em teco-tecos sobre a horta, atirando ervilhas e uma cenoura teleguiada de cada vez. Dois acertos dá para aguentar; o terceiro derruba. O último no ar ganha.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // O RPG de turnos da turma (JogoLendas.tsx, server/src/lendas-regras.ts): cada um com um herói, os robôs completam os quatro
    // (pedido dele, 16/11/2026: só a mecânica do gênero).
    id: 'lendas',
    nome: chave('Lendas da Toca'),
    dica: chave('Um RPG de turnos curto: cada um controla um herói da turma. Escolham juntos, combinem ataques e vençam o dragão do castelo.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // Juntar bichos e lutar por turnos (JogoBichos.tsx, server/src/minijogo-bichos.ts, bichos-regras.ts ↔ bichos/regras.ts): no
    // Solo, a aventura guardada no servidor; na sala, a luta entre duas pessoas na mesa (pedido dele, 16/11/2026: só a mecânica).
    id: 'bichos',
    nome: chave('Bichos da Toca'),
    dica: chave('Ande pelo campo, faça amizade com os bichos do mato usando uma cenoura e monte uma equipe de até seis. Vença o desafio da casa azul e, na sala, lute com a equipe de um amigo.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A turma contra a toupeira-rei (JogoChefe.tsx, server/src/minijogo-chefe.ts, server/src/chefe/): a rede da Briga, com o chefe
    // no servidor (a versão nossa da batalha final do Mario Party 3, pedido dele, 05/11/2026).
    id: 'chefe',
    nome: chave('O chefe da turma'),
    dica: chave('A turma inteira contra a toupeira-rei, que sai das tocas em três fases. Fuja das marcas no chão, pegue os torrões azulados e atire de volta. Ganha a turma, ou ninguém.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A corrida de barquinhos (JogoBarco.tsx, server/src/minijogo-barco.ts, server/src/barco.ts): a técnica do kart com a água,
    // que desliza (a versão nossa de dois minijogos de barco do Mario Party 3, pedido dele, 05/11/2026).
    id: 'barco',
    nome: chave('Regata da toca'),
    dica: chave('Corrida de barquinhos no lago, no riacho e no mangue. A água desliza: tire o pé antes da curva, cuidado com a margem e aproveite a correnteza e as argolas. No Solo, contra o relógio e os fantasmas dos amigos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A batalha de balões (JogoBalao.tsx, server/src/minijogo-balao.ts, balao-sim.ts ↔ balao/sim.ts): o modo arena do kart,
    // com o motor da corrida (pedido dele, 05/11/2026, depois da boa recepção do kart).
    id: 'balao',
    nome: chave('Estoura-balão'),
    dica: chave('Os karts numa arena fechada, cada um com três balões. Pegue as caixas e use os itens para estourar os balões dos outros: quem fica sem balão sai, e ganha quem sobrar.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // A navinha (JogoNave.tsx, server/src/minijogo-nave.ts, nave-sim.ts ↔ nave/sim.ts): as mesmas ondas para a turma, cada um
    // na própria tela, como a Caça (pedido dele, 05/11/2026).
    id: 'nave',
    nome: chave('Esquadrilha da toca'),
    dica: chave('Aviõezinhos de cenoura contra a praga da horta: desvie das sementes, pegue os reforços e derrube o espantalho mecânico no fim. A turma voa as mesmas ondas, e a esquadrilha soma os pontos.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // O tiro em trilhos em 3D (JogoEstelar.tsx, server/src/minijogo-estelar.ts, estelar-sim.ts ↔ estelar/sim.ts): a rede da
    // Esquadrilha, a mesma rota para a turma, cada um na própria tela (16/11/2026).
    id: 'estelar',
    nome: chave('Rota Estelar'),
    dica: chave('Coelhos em naves pela superfície de um planeta e pelo espaço: atire, segure o tiro para travar a mira, gire para desviar dos tiros e escolha o caminho na bifurcação. A turma voa a mesma rota, e o chefe espera no fim.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // O tabuleiro de festa (JogoTabuleiro.tsx, server/src/minijogo-tabuleiro-da-turma.ts): dado, casas, a cenoura dourada e
    // um microjogo da Festa depois de cada rodada. Com a turma, ou no Solo contra 1 a 5 adversários do computador.
    id: 'tabuleiro',
    nome: chave('Tabuleiro da turma'),
    dica: chave('Cada um joga o dado na sua vez e anda pela horta. Junte cenouras para comprar a cenoura dourada, e depois de cada rodada a turma joga um microjogo. Ganha quem tiver mais cenouras douradas.'),
    abas: ['solo', 'coletivo'],
  },
  {
    // O jogo de comprar cidades e cobrar aluguel (JogoCidades.tsx, server/src/minijogo-cidades.ts): só a mecânica, com
    // capitais do Brasil. Com a turma, ou no Solo contra 1 a 5 adversários do computador (pedido dele, 05/11/2026).
    id: 'cidades',
    nome: chave('Capitais'),
    dica: chave('Ande pelas capitais do Brasil, compre cidades e cobre aluguel de quem parar nelas. Com uma região inteira, dá para construir prédios. Troque, dispute nos leilões e não fique sem dinheiro.'),
    abas: ['solo', 'coletivo'],
  },
];

// a Arena dos coelhos (17/11/2026) é um modo dos Bichos da Toca, escolhido na largada: o nome é o deles
export const nomeDoJogo = (id: string) => JOGOS.find((j) => j.id === (id === 'arena' ? 'bichos' : id))?.nome ?? id;

/**
 * AS PALAVRAS DO DESENHA E ADIVINHA: uma lista escrita para o Syden, de coisas fáceis de desenhar, sem
 * fonte de terceiro. O id é o do servidor (server/src/minijogo-desenho.ts); o nome, traduzido. Quem desenha
 * manda o nome NA LÍNGUA DELE ao escolher, e é contra ele que os chutes são conferidos.
 */
export const PALAVRAS_DO_DESENHO: Record<string, string> = {
  gato: chave('Gato'),
  cachorro: chave('Cachorro'),
  peixe: chave('Peixe'),
  passaro: chave('Pássaro'),
  cavalo: chave('Cavalo'),
  vaca: chave('Vaca'),
  porco: chave('Porco'),
  galinha: chave('Galinha'),
  pato: chave('Pato'),
  coelho: chave('Coelho'),
  rato: chave('Rato'),
  elefante: chave('Elefante'),
  girafa: chave('Girafa'),
  leao: chave('Leão'),
  tigre: chave('Tigre'),
  macaco: chave('Macaco'),
  urso: chave('Urso'),
  cobra: chave('Cobra'),
  tartaruga: chave('Tartaruga'),
  sapo: chave('Sapo'),
  borboleta: chave('Borboleta'),
  abelha: chave('Abelha'),
  aranha: chave('Aranha'),
  formiga: chave('Formiga'),
  caracol: chave('Caracol'),
  polvo: chave('Polvo'),
  tubarao: chave('Tubarão'),
  baleia: chave('Baleia'),
  golfinho: chave('Golfinho'),
  pinguim: chave('Pinguim'),
  coruja: chave('Coruja'),
  camelo: chave('Camelo'),
  zebra: chave('Zebra'),
  jacare: chave('Jacaré'),
  canguru: chave('Canguru'),
  caranguejo: chave('Caranguejo'),
  minhoca: chave('Minhoca'),
  morcego: chave('Morcego'),
  ovelha: chave('Ovelha'),
  dinossauro: chave('Dinossauro'),
  joaninha: chave('Joaninha'),
  'cavalo-marinho': chave('Cavalo-marinho'),
  papagaio: chave('Papagaio'),
  flamingo: chave('Flamingo'),
  esquilo: chave('Esquilo'),
  raposa: chave('Raposa'),
  lobo: chave('Lobo'),
  maca: chave('Maçã'),
  banana: chave('Banana'),
  uva: chave('Uva'),
  morango: chave('Morango'),
  abacaxi: chave('Abacaxi'),
  melancia: chave('Melancia'),
  laranja: chave('Laranja'),
  limao: chave('Limão'),
  cenoura: chave('Cenoura'),
  milho: chave('Milho'),
  cogumelo: chave('Cogumelo'),
  pizza: chave('Pizza'),
  hamburguer: chave('Hambúrguer'),
  sorvete: chave('Sorvete'),
  bolo: chave('Bolo'),
  pao: chave('Pão'),
  queijo: chave('Queijo'),
  ovo: chave('Ovo'),
  'cachorro-quente': chave('Cachorro-quente'),
  pipoca: chave('Pipoca'),
  chocolate: chave('Chocolate'),
  pirulito: chave('Pirulito'),
  sanduiche: chave('Sanduíche'),
  sushi: chave('Sushi'),
  macarrao: chave('Macarrão'),
  'batata-frita': chave('Batata frita'),
  cafe: chave('Café'),
  cereja: chave('Cereja'),
  pera: chave('Pera'),
  abobora: chave('Abóbora'),
  cadeira: chave('Cadeira'),
  mesa: chave('Mesa'),
  cama: chave('Cama'),
  sofa: chave('Sofá'),
  lampada: chave('Lâmpada'),
  relogio: chave('Relógio'),
  oculos: chave('Óculos'),
  chapeu: chave('Chapéu'),
  sapato: chave('Sapato'),
  meia: chave('Meia'),
  camiseta: chave('Camiseta'),
  'guarda-chuva': chave('Guarda-chuva'),
  chave: chave('Chave'),
  cadeado: chave('Cadeado'),
  tesoura: chave('Tesoura'),
  lapis: chave('Lápis'),
  livro: chave('Livro'),
  mochila: chave('Mochila'),
  celular: chave('Celular'),
  computador: chave('Computador'),
  televisao: chave('Televisão'),
  camera: chave('Câmera'),
  'fone-de-ouvido': chave('Fone de ouvido'),
  violao: chave('Violão'),
  piano: chave('Piano'),
  tambor: chave('Tambor'),
  bola: chave('Bola'),
  balao: chave('Balão'),
  pipa: chave('Pipa'),
  presente: chave('Presente'),
  vela: chave('Vela'),
  espelho: chave('Espelho'),
  'escova-de-dentes': chave('Escova de dentes'),
  garrafa: chave('Garrafa'),
  copo: chave('Copo'),
  xicara: chave('Xícara'),
  garfo: chave('Garfo'),
  colher: chave('Colher'),
  faca: chave('Faca'),
  panela: chave('Panela'),
  martelo: chave('Martelo'),
  escada: chave('Escada'),
  porta: chave('Porta'),
  janela: chave('Janela'),
  vassoura: chave('Vassoura'),
  balde: chave('Balde'),
  anel: chave('Anel'),
  coroa: chave('Coroa'),
  espada: chave('Espada'),
  escudo: chave('Escudo'),
  bandeira: chave('Bandeira'),
  ancora: chave('Âncora'),
  ima: chave('Ímã'),
  lupa: chave('Lupa'),
  microfone: chave('Microfone'),
  'controle-de-videogame': chave('Controle de videogame'),
  dado: chave('Dado'),
  'quebra-cabeca': chave('Quebra-cabeça'),
  envelope: chave('Envelope'),
  ampulheta: chave('Ampulheta'),
  'boneco-de-neve': chave('Boneco de neve'),
  robo: chave('Robô'),
  foguete: chave('Foguete'),
  paraquedas: chave('Paraquedas'),
  mapa: chave('Mapa'),
  bussola: chave('Bússola'),
  barraca: chave('Barraca'),
  cesta: chave('Cesta'),
  sino: chave('Sino'),
  trompete: chave('Trompete'),
  carro: chave('Carro'),
  onibus: chave('Ônibus'),
  bicicleta: chave('Bicicleta'),
  moto: chave('Moto'),
  aviao: chave('Avião'),
  helicoptero: chave('Helicóptero'),
  barco: chave('Barco'),
  navio: chave('Navio'),
  trem: chave('Trem'),
  caminhao: chave('Caminhão'),
  submarino: chave('Submarino'),
  skate: chave('Skate'),
  patins: chave('Patins'),
  trator: chave('Trator'),
  ambulancia: chave('Ambulância'),
  'balao-de-ar-quente': chave('Balão de ar quente'),
  'disco-voador': chave('Disco voador'),
  sol: chave('Sol'),
  lua: chave('Lua'),
  estrela: chave('Estrela'),
  nuvem: chave('Nuvem'),
  chuva: chave('Chuva'),
  'arco-iris': chave('Arco-íris'),
  raio: chave('Raio'),
  neve: chave('Neve'),
  arvore: chave('Árvore'),
  flor: chave('Flor'),
  cacto: chave('Cacto'),
  folha: chave('Folha'),
  montanha: chave('Montanha'),
  vulcao: chave('Vulcão'),
  ilha: chave('Ilha'),
  praia: chave('Praia'),
  onda: chave('Onda'),
  rio: chave('Rio'),
  cachoeira: chave('Cachoeira'),
  fogo: chave('Fogo'),
  planeta: chave('Planeta'),
  cometa: chave('Cometa'),
  tornado: chave('Tornado'),
  palmeira: chave('Palmeira'),
  pedra: chave('Pedra'),
  deserto: chave('Deserto'),
  casa: chave('Casa'),
  castelo: chave('Castelo'),
  ponte: chave('Ponte'),
  farol: chave('Farol'),
  piramide: chave('Pirâmide'),
  escola: chave('Escola'),
  predio: chave('Prédio'),
  fazenda: chave('Fazenda'),
  iglu: chave('Iglu'),
  moinho: chave('Moinho'),
  olho: chave('Olho'),
  nariz: chave('Nariz'),
  boca: chave('Boca'),
  orelha: chave('Orelha'),
  mao: chave('Mão'),
  pe: chave('Pé'),
  dente: chave('Dente'),
  coracao: chave('Coração'),
  cerebro: chave('Cérebro'),
  osso: chave('Osso'),
  bigode: chave('Bigode'),
  fantasma: chave('Fantasma'),
  alienigena: chave('Alienígena'),
  zumbi: chave('Zumbi'),
  ninja: chave('Ninja'),
  esqueleto: chave('Esqueleto'),
  mumia: chave('Múmia'),
  dragao: chave('Dragão'),
  unicornio: chave('Unicórnio'),
  monstro: chave('Monstro'),
  trofeu: chave('Troféu'),
  medalha: chave('Medalha'),
  raquete: chave('Raquete'),
  moeda: chave('Moeda'),
  cofrinho: chave('Cofrinho'),
  'oculos-de-sol': chave('Óculos de sol'),
  'nota-musical': chave('Nota musical'),
  'arco-e-flecha': chave('Arco e flecha'),
  'teia-de-aranha': chave('Teia de aranha'),
  ninho: chave('Ninho'),
  'arvore-de-natal': chave('Árvore de Natal'),
  chupeta: chave('Chupeta'),
  mamadeira: chave('Mamadeira'),
  sereia: chave('Sereia'),
  pirata: chave('Pirata'),
  palhaco: chave('Palhaço'),
  astronauta: chave('Astronauta'),
  'carrinho-de-mao': chave('Carrinho de mão'),
  'cata-vento': chave('Cata-vento'),
  semaforo: chave('Semáforo'),
  hidrante: chave('Hidrante'),
  'caixa-de-correio': chave('Caixa de correio'),
  tenis: chave('Tênis'),
  gravata: chave('Gravata'),
  luva: chave('Luva'),
  cachecol: chave('Cachecol'),
  'escova-de-cabelo': chave('Escova de cabelo'),
  pente: chave('Pente'),
  'pasta-de-dente': chave('Pasta de dente'),
  sabonete: chave('Sabonete'),
  toalha: chave('Toalha'),
  banheira: chave('Banheira'),
  chuveiro: chave('Chuveiro'),
  privada: chave('Privada'),
  geladeira: chave('Geladeira'),
  fogao: chave('Fogão'),
  torradeira: chave('Torradeira'),
  liquidificador: chave('Liquidificador'),
  ventilador: chave('Ventilador'),
  'ar-condicionado': chave('Ar-condicionado'),
  tomada: chave('Tomada'),
  pilha: chave('Pilha'),
  lanterna: chave('Lanterna'),
  // as 364 de 19/11/2026, com fácil, média e difícil (desenhoPalavras.ts)
  ...PALAVRAS_NOVAS_DO_DESENHO,
};

/**
 * UMA PALAVRA PODE TER MAIS DE UMA FORMA na tradução, separadas por "|" ("Computadora|Ordenador", "犬|いぬ"): a
 * primeira é a que aparece; todas valem no chute do desenho. Onde a palavra só é mostrada, vale a primeira.
 */
export const primeiraForma = (texto: string) => texto.split('|')[0].trim();

/** As cores do lápis (o índice é o que viaja) — a branca é a borracha — e as espessuras, na largura de 1000. */
export const CORES_DO_DESENHO = ['#1d1d1f', '#ffffff', '#9aa0a6', '#e5484d', '#f2603f', '#f2b84b', '#3fb27f', '#2c8a5a', '#4f7df5', '#8e5cd9', '#e88ab5', '#8b5a2b'];
export const ESPESSURAS_DO_DESENHO = [4, 10, 24];

/** As categorias do Stop: os ids são os do servidor, e o nome de cada uma, traduzido. */
export const CATEGORIAS_DO_STOP: Record<string, string> = {
  nome: chave('Nome de pessoa'),
  animal: chave('Animal'),
  fruta: chave('Fruta'),
  cor: chave('Cor'),
  objeto: chave('Objeto'),
  lugar: chave('Cidade, estado ou país'),
  profissao: chave('Profissão'),
  comida: chave('Comida'),
  marca: chave('Marca'),
  filme: chave('Filme ou série'),
  corpo: chave('Parte do corpo'),
  esporte: chave('Esporte'),
  // As novas de 19/11/2026 (nossas; quem começa escolhe quais entram): a mesma lista que server/src/minijogo-stop.ts.
  legume: chave('Legume ou verdura'),
  bebida: chave('Bebida'),
  doce: chave('Doce ou sobremesa'),
  planta: chave('Planta ou flor'),
  pais: chave('País'),
  cidade: chave('Cidade'),
  instrumento: chave('Instrumento musical'),
  artista: chave('Artista ou banda'),
  personagem: chave('Personagem'),
  jogo: chave('Jogo ou brincadeira'),
  roupa: chave('Roupa ou acessório'),
  veiculo: chave('Meio de transporte'),
  casa: chave('Coisa da casa'),
  cozinha: chave('Coisa da cozinha'),
  escola: chave('Material escolar'),
  ferramenta: chave('Ferramenta'),
  brinquedo: chave('Brinquedo'),
  inseto: chave('Inseto'),
  ave: chave('Ave'),
  mar: chave('Bicho do mar'),
  qualidade: chave('Qualidade de uma pessoa'),
  defeito: chave('Defeito de uma pessoa'),
  sentimento: chave('Sentimento'),
  verbo: chave('Verbo'),
  pet: chave('Nome de bicho de estimação'),
  aplicativo: chave('Aplicativo ou site'),
  loja: chave('Loja ou comércio'),
  natureza: chave('Coisa da natureza'),
  materia: chave('Matéria da escola'),
  idioma: chave('Idioma'),
  danca: chave('Dança ou ritmo'),
  festa: chave('Coisa de festa'),
  praia: chave('Coisa de praia'),
  presente: chave('Presente'),
  medo: chave('Coisa que dá medo'),
  famoso: chave('Pessoa famosa'),
  desenho: chave('Desenho animado'),
  livro: chave('Livro'),
  'outra-lingua': chave('Palavra de outra língua'),
  tempero: chave('Tempero'),
  superpoder: chave('Superpoder'),
  cheiro: chave('Coisa com cheiro bom'),
  redondo: chave('Coisa redonda'),
  voa: chave('Coisa que voa'),
  mochila: chave('Coisa que cabe numa mochila'),
};

/** O nome de uma categoria do Stop: as livres (com "#") como quem começou as escreveu, sem tradução; as da lista, traduzidas. */
export const nomeDaCategoriaDoStop = (categoria: string, t: (texto: string) => string) =>
  categoria.startsWith('#') ? categoria.slice(1) : t(CATEGORIAS_DO_STOP[categoria] ?? categoria);

/**
 * AS LETRAS DO STOP NA ESCRITA DE QUEM COMEÇA. Sortear "W" para quem escreve em cirílico não tem jogo.
 * `confere` diz se a palavra sempre começa por uma destas (os alfabetos, e as escritas em que a palavra
 * começa pela consoante); nas silábicas e nas que escrevem a palavra de outro jeito (japonês com kanji,
 * chinês, coreano, amárico, tibetano), quem confere é a turma.
 */
const LATINO = 'ABCDEFGHIJLMNOPRSTUV';
const CIRILICO = 'АБВГДЕЗИКЛМНОПРСТ';
const ARABE = 'ابتجحدرسشصطعفقكلمنهو';
const PERSA = 'ابپتجچخدرزسشفکگلمنو';
const DEVANAGARI = 'कखगचजटडतदनपफबभमयरलवसह';
const LETRAS_POR_IDIOMA: Record<string, { letras: string; confere: boolean }> = {
  ru: { letras: CIRILICO, confere: true },
  bg: { letras: CIRILICO, confere: true },
  uk: { letras: 'АБВГДЗІКЛМНОПРСТ', confere: true },
  sr: { letras: 'АБВГДЗИКЛМНОПРСТ', confere: true },
  mk: { letras: 'АБВГДЗИКЛМНОПРСТ', confere: true },
  kk: { letras: CIRILICO, confere: true },
  mn: { letras: CIRILICO, confere: true },
  tg: { letras: CIRILICO, confere: true },
  el: { letras: 'ΑΒΓΔΕΖΘΙΚΛΜΝΞΟΠΡΣΤΦΧ', confere: true },
  hy: { letras: 'ԱԲԳԴԵԶԹԻԼԽԿՀՄՆՇՊՍՏՓՔ', confere: true },
  ka: { letras: 'აბგდვზთკლმნოპრსტფქშჩ', confere: true },
  he: { letras: 'אבגדהזחטכלמנסעפצקרשת', confere: true },
  ar: { letras: ARABE, confere: true },
  fa: { letras: PERSA, confere: true },
  ur: { letras: PERSA, confere: true },
  dv: { letras: 'ހށނރބކވމފދތލގސޑޒޓޔ', confere: true },
  hi: { letras: DEVANAGARI, confere: true },
  ne: { letras: DEVANAGARI, confere: true },
  bn: { letras: 'কখগচজটডতদনপফবভমযরলশসহ', confere: true },
  ta: { letras: 'கசடதநபமயரலவ', confere: true },
  te: { letras: 'కగచజటడతదనపబమయరలవసహ', confere: true },
  si: { letras: 'කගචජටඩතදනපබමයරලවසහ', confere: true },
  th: { letras: 'กขคงจชซดตทนบปผพฟมยรลวสหอ', confere: true },
  lo: { letras: 'ກຂຄງຈຊດຕທນບປຜພຟມຢຣລວສຫອ', confere: true },
  km: { letras: 'កខគងចឆជញដតថទនបពមយរលសហអ', confere: true },
  my: { letras: 'ကခဂငစဆဇညတထဒနပဖဗဘမယရလဝသဟအ', confere: true },
  am: { letras: 'ሀለመሰረቀበተነአከወዘየደገጠፈ', confere: false },
  dz: { letras: 'ཀཁགངཅཆཇཉཏཐདནཔཕབམཙཚཛཝཞཟཡརལཤསཧཨ', confere: false },
  ja: { letras: 'あいうえおかきくけこさしすせそたちつてとなにはひふへほまみむめもやゆよらりるれろわ', confere: false },
  ko: { letras: 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ', confere: false },
  'zh-CN': { letras: 'BCDFGHJKLMNPQRSTWXYZ', confere: false },
};
export const letrasDoStop = (idioma: string) => LETRAS_POR_IDIOMA[idioma] ?? { letras: LATINO, confere: true };

/**
 * A partida da sala, se houver. Como o palco: o servidor avisa a comunidade a cada mudança
 * ('minijogo:mudou') e aqui se busca o estado de novo. `recebidaEm` serve para o relógio da tela contar a
 * partir do que o servidor disse, e não do relógio de cada computador.
 */
export function usarMinijogo(channelId: number | null, socket: Socket | null) {
  const [partida, setPartida] = useState<Partida | null>(null);

  const recarregar = useCallback(() => {
    if (channelId === null) return setPartida(null);
    void api<{ partida: PartidaPublica | null }>(`/api/channels/${channelId}/minijogo`)
      .then(({ partida: p }) => setPartida(p ? { ...p, recebidaEm: Date.now() } : null))
      .catch(() => {});
  }, [channelId]);

  useEffect(recarregar, [recarregar]);

  useEffect(() => {
    if (!socket || channelId === null) return;
    const aoMudar = (dados: { channelId: number }) => dados.channelId === channelId && recarregar();
    socket.on('minijogo:mudou', aoMudar);
    // Caiu e voltou: a partida pode ter andado enquanto isso.
    socket.on('connect', recarregar);
    return () => {
      socket.off('minijogo:mudou', aoMudar);
      socket.off('connect', recarregar);
    };
  }, [socket, channelId, recarregar]);

  const comecar = useCallback(
    async (jogo: IdDoJogo, escolhas: Record<string, unknown> = {}) => {
      if (channelId === null) return;
      // (no Stop, as letras da escrita de quem começa, e por cima as escolhas da largada: rodadas, tempo, categorias)
      const extras = jogo === 'stop' ? { ...letrasDoStop(idiomaAtual()), ...escolhas } : escolhas;
      // Convidar: a sala responde se joga, e quem começou dá a largada (ver o convite no servidor).
      const { partida: p } = await api<{ partida: PartidaPublica }>(`/api/channels/${channelId}/minijogo`, {
        method: 'POST',
        body: { jogo, ...extras, convidar: true },
      });
      setPartida({ ...p, recebidaEm: Date.now() });
    },
    [channelId],
  );

  /** Uma ação no jogo (votar, jogar, contestar…). O servidor devolve o estado já com ela. */
  const agir = useCallback(
    async (corpo: Record<string, unknown>) => {
      if (channelId === null) return;
      const { partida: p } = await api<{ partida: PartidaPublica }>(`/api/channels/${channelId}/minijogo/acao`, {
        method: 'POST',
        body: corpo,
      });
      setPartida({ ...p, recebidaEm: Date.now() });
    },
    [channelId],
  );

  const encerrar = useCallback(async () => {
    if (channelId === null) return;
    await api(`/api/channels/${channelId}/minijogo`, { method: 'DELETE' });
    setPartida(null);
  }, [channelId]);

  /** A resposta ao convite: jogar, sair antes da largada, ou "agora não". */
  const responder = useCallback(
    async (resposta: 'jogar' | 'sair' | 'agora-nao') => {
      if (channelId === null) return;
      const { partida: p } = await api<{ partida: PartidaPublica }>(`/api/channels/${channelId}/minijogo/convite`, {
        method: 'POST',
        body: { resposta },
      });
      setPartida({ ...p, recebidaEm: Date.now() });
    },
    [channelId],
  );

  /** A largada, de quem começou: a partida começa com quem aceitou. */
  const largar = useCallback(async () => {
    if (channelId === null) return;
    const { partida: p } = await api<{ partida: PartidaPublica }>(`/api/channels/${channelId}/minijogo/largada`, { method: 'POST' });
    setPartida({ ...p, recebidaEm: Date.now() });
  }, [channelId]);

  return { partida, comecar, agir, encerrar, responder, largar };
}

/**
 * A PARTIDA SOLO (a aba Solo da estante): a mesma conversa com o servidor, mas da pessoa e não da sala (rotas
 * /api/minijogo-solo). Não precisa de chamada: o computador do quarto também a usa.
 */
export function usarMinijogoSolo(socket: Socket | null) {
  const [partida, setPartida] = useState<Partida | null>(null);
  const guardar = (p: PartidaPublica | null) => setPartida(p ? { ...p, recebidaEm: Date.now() } : null);

  const recarregar = useCallback(() => {
    void api<{ partida: PartidaPublica | null }>('/api/minijogo-solo')
      .then(({ partida: p }) => guardar(p))
      .catch(() => {});
  }, []);

  useEffect(recarregar, [recarregar]);
  useEffect(() => {
    if (!socket) return;
    // O relógio da partida anda no servidor (a rodada que acaba, a revelação): o aviso vem só para quem joga.
    socket.on('minijogo-solo:mudou', recarregar);
    socket.on('connect', recarregar);
    return () => {
      socket.off('minijogo-solo:mudou', recarregar);
      socket.off('connect', recarregar);
    };
  }, [socket, recarregar]);

  const comecar = useCallback(async (jogo: IdDoJogo, escolhas: Record<string, unknown> = {}) => {
    const { partida: p } = await api<{ partida: PartidaPublica }>('/api/minijogo-solo', { method: 'POST', body: { jogo, ...escolhas } });
    guardar(p);
  }, []);
  const agir = useCallback(async (corpo: Record<string, unknown>) => {
    const { partida: p } = await api<{ partida: PartidaPublica }>('/api/minijogo-solo/acao', { method: 'POST', body: corpo });
    guardar(p);
  }, []);
  const encerrar = useCallback(async () => {
    await api('/api/minijogo-solo', { method: 'DELETE' });
    setPartida(null);
  }, []);

  return { partida, comecar, agir, encerrar };
}

/**
 * Pedido de abrir os jogos que vem da home (o computador do quarto → escolher a sala): a pessoa ainda não
 * está na sala, e a estante só abre depois de ela entrar. Fica guardado aqui até a sala de voz montar.
 */
// O pedido VENCE em vez de ser gasto na leitura: a sala pode montar duas vezes seguidas (o React faz isso
// em desenvolvimento), e a segunda montagem também precisa vê-lo. Voltar à sala depois não reabre nada.
let abrirAoEntrar: { channelId: number; em: number } | null = null;
const VALIDADE_DO_PEDIDO_MS = 15_000;
export const pedirParaAbrirAoEntrar = (channelId: number) => {
  abrirAoEntrar = { channelId, em: Date.now() };
};
export const pegarPedidoDeAbrir = (channelId: number): boolean =>
  abrirAoEntrar?.channelId === channelId && Date.now() - abrirAoEntrar.em < VALIDADE_DO_PEDIDO_MS;

/**
 * Os sites para jogar FORA do Syden e transmitir (degrau 1 do caminho combinado em 07/10/2026). Só os que
 * a varredura num Chrome de verdade mostrou SEM anúncio (ver CLAUDE.md, "Mini-games"). Abrem no navegador,
 * fora do Syden: o anúncio e o rastreio de um site de fora nunca entram aqui.
 *
 * A promessa da lista é "sem anúncio", e não "sem rastreio" (decisão do Sydenstricker, 13/10/2026: "sem anúncio é
 * honesto"). O Termo só carrega o Google Analytics.
 *
 * TODO MUNDO VÊ TODOS OS SITES (decisão dele, mesmo dia): esconder por idioma tiraria de quem não configurou a
 * chance de conhecer, e esconderia de nós os jogos africanos e asiáticos. O site de uma língua só leva `idioma`,
 * e a tela põe o nome dela, na língua de quem lê.
 *
 * `embutir`: o site roda DENTRO do Syden (SiteEmbutido.tsx), depois do clique. Só entra aqui quem deixa ser
 * embutido, está na frame-src da política de segurança (e2e/politica-de-seguranca.mjs e a Cloudflare) e tem o que
 * carrega declarado na política de privacidade (#jogos-de-parceiros).
 */
/**
 * `capa`: a figura na estante dos Mini-games, para os que rodam dentro do Syden. Só entra site SEM anúncio: o Haxball, que tem,
 * entrou e saiu em 17/11/2026 (decisão dele, para não gerar atrito com a classificação etária).
 */
export const SITES_PARA_TRANSMITIR: {
  nome: string;
  endereco: string;
  dica: string;
  idioma?: string;
  embutir?: boolean;
  capa?: 'palavra' | 'trios' | 'mimica';
  /** Tem conversa PÚBLICA com desconhecidos dentro do site: não aparece para menor de 18 (ECA Digital; ver sitesParaMim). */
  conversaPublica?: boolean;
}[] = [
  { nome: 'Lichess', endereco: 'https://lichess.org', dica: chave('Xadrez, contra a turma ou contra o computador') },
  { nome: 'Clues by Sam', endereco: 'https://cluesbysam.com', dica: chave('Um mistério de lógica por dia') },
  { nome: 'Wikitrivia', endereco: 'https://wikitrivia.tomjwatson.com', dica: chave('Pôr acontecimentos na ordem do tempo') },
  { nome: 'JKLM.fun', endereco: 'https://jklm.fun', dica: chave('Palavras e perguntas rápidas, todo mundo junto') },
  { nome: 'Neal.fun', endereco: 'https://neal.fun', dica: chave('Brincadeiras curiosas para fazer junto') },
  { nome: 'Termo', endereco: 'https://term.ooo', dica: chave('A palavra do dia'), idioma: 'pt', embutir: true, capa: 'palavra' },
  // Os dois da pesquisa de 16/11/2026 (pedido dele): sem anúncio, deixam ser embutidos, código MIT. O Set carrega o Firebase (a
  // conta) e o Stripe (um plano pago opcional dele); o Fishbowl, o Google Analytics e o PostHog. Tudo na política de privacidade.
  { nome: 'Set with Friends', endereco: 'https://setwithfriends.com', dica: chave('Achar trios de cartas, sem palavras'), embutir: true, capa: 'trios', conversaPublica: true },
  { nome: 'Fishbowl', endereco: 'https://fishbowl-game.com', dica: chave('Mímica e descrever em equipes, com as palavras da turma'), embutir: true, capa: 'mimica' },
];

/**
 * OS SITES QUE ESTA CONTA VÊ (auditoria da classificação, 17/11/2026). O Set with Friends tem uma conversa PÚBLICA com
 * desconhecidos ("você divide a conversa pública com muitos outros"), e dentro do Syden ela furaria a proteção de quem tem
 * menos de 18 (conversa privada só com amigos aceitos; ECA Digital): para menor, ele não aparece. Sem a faixa, conta como menor.
 */
export const sitesParaMim = () => SITES_PARA_TRANSMITIR.filter((site) => !site.conversaPublica || contaEhAdulta());

/**
 * OS JOGOS DE COMPUTADOR, LIVRES E DE GRAÇA (pedido dele, 16/11/2026, da pesquisa do mesmo dia): não rodam no navegador, então o
 * Syden só aponta a página oficial de baixar. Nenhum tem loja dentro. DDNet e Luanti entraram e saíram em 17/11/2026
 * (decisão dele, para não gerar atrito com a classificação etária).
 */
export const JOGOS_PARA_BAIXAR: { nome: string; endereco: string; dica: string }[] = [
  { nome: 'OpenTTD', endereco: 'https://www.openttd.org/downloads/openttd-releases/latest', dica: chave('Trens, navios e cidades, em cooperação') },
  { nome: 'Unciv', endereco: 'https://yairm210.github.io/Unciv/', dica: chave('Civilização por turnos, com partida pela internet') },
];

/**
 * O nome de uma língua na língua de quem lê ("português", "Portuguese", "ポルトガル語"). Onde o navegador não tem os
 * dados de quem lê (ver Aniversario.tsx), cai no nome da língua nela mesma ("português").
 */
export function nomeDoIdioma(codigo: string, quemLe: string): string {
  const locale = Intl.DisplayNames.supportedLocalesOf(quemLe).length > 0 ? quemLe : codigo;
  return new Intl.DisplayNames([locale], { type: 'language' }).of(codigo) ?? codigo;
}
