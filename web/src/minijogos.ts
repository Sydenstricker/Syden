import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { chave, idiomaAtual } from './i18n';

/**
 * Os mini-games da sala de voz, do lado do site (o servidor decide tudo: server/src/minijogos.ts).
 *
 * O CATÁLOGO DO "QUAL É MAIOR?": o emoji e o nome de cada objeto, marcados para traduzir. Os TAMANHOS
 * moram só no servidor, que é quem decide quem acertou — e só chegam na revelação. O teste
 * web/test/minijogos.test.ts confere que as duas listas têm os mesmos ids.
 */
export const OBJETOS: Record<string, { emoji: string; nome: string }> = {
  bacteria: { emoji: '🦠', nome: chave('Bactéria') },
  formiga: { emoji: '🐜', nome: chave('Formiga') },
  abelha: { emoji: '🐝', nome: chave('Abelha') },
  morango: { emoji: '🍓', nome: chave('Morango') },
  ovo: { emoji: '🥚', nome: chave('Ovo de galinha') },
  'bola-de-tenis': { emoji: '🎾', nome: chave('Bola de tênis') },
  camundongo: { emoji: '🐭', nome: chave('Camundongo') },
  celular: { emoji: '📱', nome: chave('Celular') },
  lapis: { emoji: '✏️', nome: chave('Lápis') },
  banana: { emoji: '🍌', nome: chave('Banana') },
  'bola-de-futebol': { emoji: '⚽', nome: chave('Bola de futebol') },
  pizza: { emoji: '🍕', nome: chave('Pizza grande') },
  melancia: { emoji: '🍉', nome: chave('Melancia') },
  gato: { emoji: '🐈', nome: chave('Gato') },
  violao: { emoji: '🎸', nome: chave('Violão') },
  pinguim: { emoji: '🐧', nome: chave('Pinguim-imperador') },
  flamingo: { emoji: '🦩', nome: chave('Flamingo') },
  cavalo: { emoji: '🐎', nome: chave('Cavalo') },
  pessoa: { emoji: '🧍', nome: chave('Pessoa adulta') },
  bicicleta: { emoji: '🚲', nome: chave('Bicicleta') },
  porta: { emoji: '🚪', nome: chave('Porta') },
  urso: { emoji: '🐻', nome: chave('Urso-pardo em pé') },
  elefante: { emoji: '🐘', nome: chave('Elefante-africano') },
  moai: { emoji: '🗿', nome: chave('Moai da Ilha de Páscoa') },
  carro: { emoji: '🚗', nome: chave('Carro') },
  girafa: { emoji: '🦒', nome: chave('Girafa') },
  onibus: { emoji: '🚌', nome: chave('Ônibus') },
  'tiranossauro-rex': { emoji: '🦖', nome: chave('Tiranossauro rex') },
  'baleia-azul': { emoji: '🐋', nome: chave('Baleia-azul') },
  aviao: { emoji: '✈️', nome: chave('Avião de passageiros') },
  'piscina-olimpica': { emoji: '🏊', nome: chave('Piscina olímpica') },
  'estatua-da-liberdade': { emoji: '🗽', nome: chave('Estátua da Liberdade') },
  'campo-de-futebol': { emoji: '🏟️', nome: chave('Campo de futebol') },
  foguete: { emoji: '🚀', nome: chave('Foguete Saturno V') },
  'roda-gigante': { emoji: '🎡', nome: chave('London Eye') },
  titanic: { emoji: '🚢', nome: chave('Titanic') },
  'torre-eiffel': { emoji: '🗼', nome: chave('Torre Eiffel') },
  'monte-fuji': { emoji: '🗻', nome: chave('Monte Fuji') },
  everest: { emoji: '🏔️', nome: chave('Monte Everest') },
  lua: { emoji: '🌕', nome: chave('Lua') },
  terra: { emoji: '🌍', nome: chave('Terra') },
  jupiter: { emoji: '🪐', nome: chave('Júpiter') },
  sol: { emoji: '☀️', nome: chave('Sol') },
};

export type Medida = 'altura' | 'comprimento' | 'diametro';

/** "{tamanho} de altura" etc. — o tamanho vai pronto, com a unidade (as unidades são as do SI em toda língua). */
export const FRASE_DA_MEDIDA: Record<Medida, string> = {
  altura: chave('{tamanho} de altura'),
  comprimento: chave('{tamanho} de comprimento'),
  diametro: chave('{tamanho} de diâmetro'),
};

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
  [campo: string]: unknown;
}
export type Partida = PartidaPublica & { recebidaEm: number };

export interface LinhaDoPlacar {
  userId: number;
  username: string;
  pontos: number;
}

/** O "Qual é maior?" (server/src/minijogos.ts). */
export interface EstadoTamanho {
  rodada: number;
  rodadas: number;
  fase: 'votando' | 'revelando' | 'fim';
  par: { id: string; cm?: number; medida?: Medida }[];
  votaram: number[];
  votos: Record<string, 0 | 1> | null;
  certo: 0 | 1 | null;
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

export type IdDoJogo = 'tamanho' | 'stop' | 'sudoku' | 'gomoku' | 'mancala';

/** A estante: a ordem é a da tela. O nome e a dica de cada jogo, traduzidos. */
export const JOGOS: { id: IdDoJogo; nome: string; dica: string }[] = [
  {
    id: 'tamanho',
    nome: chave('Qual é maior?'),
    dica: chave('Dois objetos aparecem e cada um escolhe, na própria tela, qual é o maior. O tamanho de verdade aparece para todo mundo ao mesmo tempo.'),
  },
  {
    id: 'stop',
    nome: chave('Stop'),
    dica: chave('Sai uma letra e cada um escreve uma palavra com ela em cada categoria. Quem completar primeiro aperta STOP, e a turma decide o que vale.'),
  },
  {
    id: 'sudoku',
    nome: chave('Sudoku'),
    dica: chave('Todo mundo recebe o mesmo sudoku, e a sala vê quem está mais perto de terminar.'),
  },
  {
    id: 'gomoku',
    nome: chave('Cinco em linha'),
    dica: chave('Duas pessoas põem pedras no tabuleiro, uma de cada vez. Vence quem fizer cinco seguidas. A sala assiste.'),
  },
  {
    id: 'mancala',
    nome: chave('Mancala'),
    dica: chave('O jogo de semear: pegue as sementes de uma casa e espalhe uma por casa. Vence quem guardar mais no depósito. A sala assiste.'),
  },
];

export const nomeDoJogo = (id: string) => JOGOS.find((j) => j.id === id)?.nome ?? id;

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
    async (jogo: IdDoJogo) => {
      if (channelId === null) return;
      const extras = jogo === 'stop' ? letrasDoStop(idiomaAtual()) : {};
      const { partida: p } = await api<{ partida: PartidaPublica }>(`/api/channels/${channelId}/minijogo`, {
        method: 'POST',
        body: { jogo, ...extras },
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
 */
export const SITES_PARA_TRANSMITIR: { nome: string; endereco: string; dica: string }[] = [
  { nome: 'Lichess', endereco: 'https://lichess.org', dica: chave('Xadrez, contra a turma ou contra o computador') },
  { nome: 'Clues by Sam', endereco: 'https://cluesbysam.com', dica: chave('Um mistério de lógica por dia') },
  { nome: 'Wikitrivia', endereco: 'https://wikitrivia.tomjwatson.com', dica: chave('Pôr acontecimentos na ordem do tempo') },
  { nome: 'JKLM.fun', endereco: 'https://jklm.fun', dica: chave('Palavras e perguntas rápidas, todo mundo junto') },
  { nome: 'Neal.fun', endereco: 'https://neal.fun', dica: chave('Brincadeiras curiosas para fazer junto') },
];
