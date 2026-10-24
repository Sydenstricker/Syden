import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { chave, idiomaAtual } from './i18n';
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
};

/**
 * As figuras desenhadas NA DIAGONAL (o lápis, o avião, o foguete): o comprimento delas é o da diagonal do
 * desenho, e não a largura nem a altura.
 */
export const NA_DIAGONAL = new Set(['lapis', 'banana', 'violao', 'aviao', 'foguete']);

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
  [campo: string]: unknown;
}

/** Quem pediu é jogador? Num servidor de antes do convite, todo mundo da sala é. */
export const souJogador = (p: PartidaPublica | null) => p !== null && p.souJogador !== false;

/** Os jogos de MESA, de duas pessoas: começam na hora, e sentar é aceitar o convite. */
export const JOGOS_DE_MESA: readonly IdDoJogo[] = ['gomoku', 'mancala'];

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
        respostas: { texto: string; valida: boolean; contra: number; contestei: boolean; pontos: number | null }[];
      }[]
    | null;
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

export type Papel = 'lobisomem' | 'vidente' | 'anjo' | 'aldeao';

/** O Lobisomem (server/src/minijogo-lobisomem.ts). */
export interface EstadoLobisomem {
  fase: 'noite' | 'amanhecer' | 'dia' | 'veredito' | 'fim';
  dia: number;
  meuPapel: Papel | null;
  vivo: boolean;
  jogadores: { userId: number; username: string; vivo: boolean; papel: Papel | null }[];
  ataque: Record<string, number> | null;
  visoes: { alvo: number; lobisomem: boolean }[] | null;
  protegido: number | null;
  viuHoje: boolean | null;
  votos: Record<string, number> | null;
  mortoDaNoite: number | null;
  eliminado: number | null;
  vencedor: 'vila' | 'lobisomens' | null;
}

/** O desenha e adivinha (server/src/minijogo-desenho.ts). */
export interface EstadoDesenho {
  fase: 'escolhendo' | 'desenhando' | 'revelando' | 'fim';
  vez: number;
  vezes: number;
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

export type IdDoJogo = 'tamanho' | 'stop' | 'sudoku' | 'gomoku' | 'mancala' | 'xadrez' | 'lobisomem' | 'desenho' | 'palavra' | IdDoQuiz;

/**
 * As duas abas da estante (pedido dele, 14/10/2026). SOLO: dá para jogar sozinho, e quem estiver na sala entra na
 * corrida se quiser. COLETIVO: o jogo é a turma (precisa de outra pessoa, ou não tem graça sem ela).
 */
export type GrupoDoJogo = 'solo' | 'coletivo';

/** A estante: a ordem é a da tela. O nome e a dica de cada jogo, traduzidos. */
export const JOGOS: { id: IdDoJogo; nome: string; dica: string; grupo: GrupoDoJogo; idioma?: string }[] = [
  {
    id: 'tamanho',
    nome: chave('Qual é o tamanho?'),
    dica: chave('Ao lado de um objeto de tamanho conhecido aparece outro, e cada um aumenta ou diminui esse outro até achar o tamanho certo. Quem chegar mais perto ganha mais pontos.'),
    grupo: 'solo',
  },
  {
    id: 'stop',
    nome: chave('Stop'),
    dica: chave('Sai uma letra e cada um escreve uma palavra com ela em cada categoria. Quem completar primeiro aperta STOP, e a turma decide o que vale.'),
    grupo: 'coletivo',
  },
  {
    id: 'desenho',
    nome: chave('Desenha e adivinha'),
    dica: chave('Cada um desenha uma vez, e a sala chuta o que é. Quem acerta mais rápido ganha mais pontos.'),
    grupo: 'coletivo',
  },
  {
    id: 'lobisomem',
    nome: chave('Lobisomem'),
    dica: chave('Cada um recebe um papel em segredo. À noite os lobisomens atacam; de dia a vila conversa e vota em quem tirar do jogo. Precisa de 4 pessoas ou mais.'),
    grupo: 'coletivo',
  },
  {
    // O primeiro quiz de adivinhar (quiz.ts): o formato dos "-dle", com os monstros do SRD 5.1, que é livre.
    id: 'monstros',
    nome: chave('Monstros de fantasia'),
    dica: chave('Sai um monstro secreto, e cada um chuta outros da lista. Cada chute mostra o que bate com o secreto: tipo, tamanho, nível, alinhamento e como ele se desloca. Quem acertar com menos chutes ganha mais pontos.'),
    grupo: 'solo',
  },
  {
    // 124 figuras de 11 mitologias, com os nomes de cada idioma (do Wikidata).
    id: 'mitologia',
    nome: chave('Mitologia'),
    dica: chave('Sai uma figura secreta da mitologia, e cada um chuta outras. Cada chute mostra o que bate com a secreta: a mitologia, o tipo, a forma e o que ela governa. Quem acertar com menos chutes ganha mais pontos.'),
    grupo: 'solo',
  },
  {
    // O Worldle sem anúncio: os 193 países da ONU, com a distância e a direção até o secreto.
    id: 'paises',
    nome: chave('Países'),
    dica: chave('Sai um país secreto, e cada um chuta outros. Cada chute mostra a distância e a direção até o secreto, a região, a sub-região e a população. Quem acertar com menos chutes ganha mais pontos.'),
    grupo: 'solo',
  },
  {
    id: 'xadrez',
    nome: chave('Problemas de xadrez'),
    dica: chave('Todo mundo recebe o mesmo problema do Lichess. Quem achar o lance certo mais rápido ganha o ponto extra.'),
    grupo: 'solo',
  },
  {
    id: 'sudoku',
    nome: chave('Sudoku'),
    dica: chave('Todo mundo recebe o mesmo sudoku, e a sala vê quem está mais perto de terminar.'),
    grupo: 'solo',
  },
  {
    id: 'gomoku',
    nome: chave('Cinco em linha'),
    dica: chave('Duas pessoas põem pedras no tabuleiro, uma de cada vez. Vence quem fizer cinco seguidas. A sala assiste.'),
    grupo: 'coletivo',
  },
  {
    id: 'mancala',
    nome: chave('Mancala'),
    dica: chave('O jogo de semear: pegue as sementes de uma casa e espalhe uma por casa. Vence quem guardar mais no depósito. A sala assiste.'),
    grupo: 'coletivo',
  },
  {
    id: 'palavra',
    nome: chave('Palavra secreta'),
    dica: chave('Todo mundo tenta adivinhar a mesma palavra de 5 letras, em 6 chutes. A sala vê as cores dos outros, mas não as letras. Quem acertar com menos chutes ganha mais pontos.'),
    grupo: 'coletivo',
    // As palavras são do dicionário do servidor, que por enquanto só existe em português.
    idioma: 'pt',
  },
];

export const nomeDoJogo = (id: string) => JOGOS.find((j) => j.id === id)?.nome ?? id;

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
};

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
      const extras = jogo === 'stop' ? letrasDoStop(idiomaAtual()) : escolhas;
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
export const SITES_PARA_TRANSMITIR: { nome: string; endereco: string; dica: string; idioma?: string; embutir?: boolean }[] = [
  { nome: 'Lichess', endereco: 'https://lichess.org', dica: chave('Xadrez, contra a turma ou contra o computador') },
  { nome: 'Clues by Sam', endereco: 'https://cluesbysam.com', dica: chave('Um mistério de lógica por dia') },
  { nome: 'Wikitrivia', endereco: 'https://wikitrivia.tomjwatson.com', dica: chave('Pôr acontecimentos na ordem do tempo') },
  { nome: 'JKLM.fun', endereco: 'https://jklm.fun', dica: chave('Palavras e perguntas rápidas, todo mundo junto') },
  { nome: 'Neal.fun', endereco: 'https://neal.fun', dica: chave('Brincadeiras curiosas para fazer junto') },
  { nome: 'Termo', endereco: 'https://term.ooo', dica: chave('A palavra do dia'), idioma: 'pt', embutir: true },
];

/**
 * O nome de uma língua na língua de quem lê ("português", "Portuguese", "ポルトガル語"). Onde o navegador não tem os
 * dados de quem lê (ver Aniversario.tsx), cai no nome da língua nela mesma ("português").
 */
export function nomeDoIdioma(codigo: string, quemLe: string): string {
  const locale = Intl.DisplayNames.supportedLocalesOf(quemLe).length > 0 ? quemLe : codigo;
  return new Intl.DisplayNames([locale], { type: 'language' }).of(codigo) ?? codigo;
}
