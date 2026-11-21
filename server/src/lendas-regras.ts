/**
 * LENDAS DA TOCA (16/11/2026): um RPG de turnos curto para a turma, do GÊNERO dos RPGs de turno dos anos 90 — só a mecânica
 * (a turma de heróis, a vez de cada um, a energia das habilidades, o ataque combinado, o equipamento que cai depois da luta,
 * o nível que sobe, o caminho que se escolhe). Nada de nome, personagem, magia, arte ou música de jogo nenhum: as classes, os
 * golpes e o caminho são nossos, os heróis são o coelho da Briga (com as cores de cada um) e os inimigos são os monstros da
 * Quaternius (CC0) que a Briga já usa.
 *
 * A AVENTURA (19/11/2026): um caminho de cinco PASSOS, SORTEADO a cada partida pela semente — uma luta, uma BIFURCAÇÃO de
 * duas lutas, uma bifurcação entre a fogueira (descanso) e uma loja de espólio ou um evento, outra bifurcação de duas lutas
 * e o castelo, onde mora o dragão. Na bifurcação, a turma VOTA (quem é gente; empate, o servidor sorteia).
 *
 * O NÍVEL SOBE DENTRO DA PARTIDA (nada fica de uma partida para outra): depois de cada luta, cada herói escolhe 1 de 2
 * melhorias da classe dele, e o nível novo libera a habilidade seguinte da classe (são três por classe). Cada luta também dá
 * uma peça de equipamento (arma, armadura ou amuleto), que cada um decide se veste.
 *
 * CADA INIMIGO TEM UM TRAÇO (em dados, `TRACOS`, e mostrado na tela): o cacto devolve parte do golpe de perto, a abelha age
 * duas vezes, o golem quase não sente golpe físico (só cai com magia), o fantasma desvia de metade dos golpes físicos...
 *
 * A TURMA É SEMPRE DE QUATRO: cada pessoa (1 a 4) escolhe a classe do seu herói, e os lugares que sobram são de robôs
 * (minijogo-robos.ts), que pegam as classes que faltam. As classes têm nome de COISA, e não de gente (Escudo, Faísca, Erva,
 * Flecha): não dizem o sexo de ninguém em língua nenhuma.
 *
 * A REDE DECIDIU A FORMA DO TURNO: a rodada é de ESCOLHA AO MESMO TEMPO. Todos escolhem juntos (20 s, que o servidor conta),
 * e o servidor resolve a rodada inteira pela velocidade de cada um, heróis e inimigos misturados. Quem não escolheu a tempo,
 * ou saiu da sala, joga pelo robô.
 *
 * O COMBO: dois heróis ou mais que escolhem "Combo" na mesma rodada atacam JUNTOS, e o golpe junta o que cada classe sabe. Com
 * três ou quatro classes diferentes, o combo tem NOME (`COMBOS`) e bate mais forte. O robô atende: quem escolhe Combo e não
 * tem par ganha um robô de parceiro (na luta do chefe, todos os robôs com energia vão junto).
 *
 * O SERVIDOR DECIDE TUDO (o dano, o sorteio, a ordem, o caminho); o site só escolhe a ação e o alvo, e desenha o que veio.
 * No Solo, a vitória guarda o RECORDE (as rodadas até o dragão, contadas aqui) na tabela comum dos recordes do Solo.
 *
 * Este arquivo não fala com o banco (o avatar, o troféu e o recorde chegam por `servicos`), para o teste rodar a regra sem
 * servidor. O que o Syden registra é minijogo-lendas.ts.
 */
import { embaralhar, type Definicao, type Jogo } from './minijogo-motor.js';
import { comRobos, ehRobo, idsDosRobos } from './minijogo-robos.js';

// ---------------- OS RELÓGIOS ----------------
/** A escolha de cada rodada, na sala. */
export const TEMPO_DA_ESCOLHA = 20_000;
/** A escolha da classe, a do espólio (com a melhoria), a da loja e o voto do caminho. */
export const TEMPO_DA_CLASSE = 30_000;
export const TEMPO_DO_ESPOLIO = 20_000;
export const TEMPO_DA_LOJA = 20_000;
export const TEMPO_DO_RUMO = 15_000;
/** No Solo, pensar não segura ninguém (a regra das mesas): o relógio é longo. */
export const TEMPO_SOLO = 30 * 60_000;
/** O mapa entre uma parada e outra, o descanso na fogueira e o evento. */
export const MAPA_MS = 2_500;
export const DESCANSO_MS = 3_000;
export const EVENTO_DA_PARADA_MS = 4_000;
/** Cada acontecimento da rodada, na tela (o site anima no mesmo passo). */
export const EVENTO_MS = 850;
export const ACAO_FOLGA_MS = 700;
/** Uma luta que não acaba (os dois lados só se defendendo) termina em derrota. */
export const RODADAS_MAX = 40;

// ---------------- AS CLASSES ----------------
export const CLASSES = ['escudo', 'faisca', 'erva', 'flecha'] as const;
export type Classe = (typeof CLASSES)[number];

interface Base {
  hp: number;
  en: number;
  atk: number;
  def: number;
  mag: number;
  vel: number;
}
export const BASES: Record<Classe, Base> = {
  // aguenta, e protege a turma
  escudo: { hp: 150, en: 6, atk: 14, def: 10, mag: 4, vel: 4 },
  // pouca vida, acerta todos os inimigos
  faisca: { hp: 85, en: 10, atk: 6, def: 3, mag: 16, vel: 6 },
  // cura a turma (e levanta quem caiu)
  erva: { hp: 95, en: 10, atk: 7, def: 5, mag: 13, vel: 5 },
  // a mais rápida, um tiro forte que atravessa a defesa
  flecha: { hp: 100, en: 8, atk: 15, def: 5, mag: 5, vel: 9 },
};
export const CUSTO_DO_COMBO = 2;

/**
 * AS HABILIDADES (19/11/2026): três por classe, a primeira desde o começo e as outras liberadas pelo nível (as lutas
 * vencidas). `alvo: 'inimigo'` pede o inimigo na escolha. O GOLPE FINAL (20/11/2026) é a quarta, do nível 3: o nível que a
 * turma tem quando chega ao castelo (as três lutas do caminho), para a luta do dragão ter a carta guardada de cada classe.
 */
export interface DefDaHabilidade {
  id: string;
  custo: number;
  alvo: 'inimigo' | 'nenhum';
  nivel: number;
}
export const HABILIDADES: Record<Classe, DefDaHabilidade[]> = {
  escudo: [
    // leva o golpe no lugar de quem está atrás, com metade
    { id: 'proteger', custo: 2, alvo: 'nenhum', nivel: 0 },
    // todos os golpes de um só inimigo vão no Escudo nesta rodada, e doem menos
    { id: 'provocar', custo: 2, alvo: 'nenhum', nivel: 1 },
    // o escudo da turma: todo golpe nesta rodada dói bem menos, até o sopro
    { id: 'muralha', custo: 4, alvo: 'nenhum', nivel: 2 },
    // O GOLPE FINAL (nível 3): o golpe forte de perto que deixa o inimigo tonto
    { id: 'investida', custo: 4, alvo: 'inimigo', nivel: 3 },
  ],
  faisca: [
    // acerta todos os inimigos
    { id: 'chuva', custo: 3, alvo: 'nenhum', nivel: 0 },
    // um raio forte num inimigo só (é magia: o golem sente)
    { id: 'raio', custo: 3, alvo: 'inimigo', nivel: 1 },
    // a turma inteira mais rápida nas duas rodadas seguintes
    { id: 'acelerar', custo: 4, alvo: 'nenhum', nivel: 2 },
    // O GOLPE FINAL: magia forte em todos os inimigos
    { id: 'estrelas', custo: 5, alvo: 'nenhum', nivel: 3 },
  ],
  erva: [
    // cura a turma e levanta quem caiu
    { id: 'curar', custo: 4, alvo: 'nenhum', nivel: 0 },
    // o veneno de espinho: tira vida do inimigo no fim de três rodadas
    { id: 'veneno', custo: 2, alvo: 'inimigo', nivel: 1 },
    // a turma recupera um pouco de vida no fim de três rodadas
    { id: 'renovar', custo: 3, alvo: 'nenhum', nivel: 2 },
    // O GOLPE FINAL: cura muito a turma e levanta quem caiu com metade da vida
    { id: 'florescer', custo: 6, alvo: 'nenhum', nivel: 3 },
  ],
  flecha: [
    // um tiro forte, que passa da defesa
    { id: 'tiro', custo: 2, alvo: 'inimigo', nivel: 0 },
    // o tiro que deixa tonto: o inimigo perde a próxima vez
    { id: 'atordoar', custo: 3, alvo: 'inimigo', nivel: 1 },
    // três flechas em inimigos ao acaso
    { id: 'rajada', custo: 3, alvo: 'nenhum', nivel: 2 },
    // O GOLPE FINAL: o tiro enorme que nunca erra (nem no fantasma) e atravessa a pedra
    { id: 'final', custo: 4, alvo: 'inimigo', nivel: 3 },
  ],
};

/** AS MELHORIAS de cada nível: o que cada uma soma, e quais cada classe pode receber. */
export const MELHORIAS = {
  vida: { hp: 20 },
  forca: { atk: 4 },
  magia: { mag: 4 },
  pele: { def: 3 },
  pressa: { vel: 2 },
  folego: { en: 2 },
} as const;
export type Melhoria = keyof typeof MELHORIAS;
/** Na ordem de preferência do robô. */
export const MELHORIAS_DA_CLASSE: Record<Classe, Melhoria[]> = {
  escudo: ['vida', 'pele', 'forca', 'folego'],
  faisca: ['magia', 'folego', 'vida', 'pressa'],
  erva: ['magia', 'folego', 'vida', 'pele'],
  flecha: ['forca', 'pressa', 'vida', 'pele'],
};

/** OS COMBOS COM NOME: três classes diferentes ou as quatro (a chave é a lista em ordem alfabética). */
export const COMBOS: Record<string, string> = {
  'erva+escudo+faisca': 'luz',
  'escudo+faisca+flecha': 'tempestade',
  'erva+escudo+flecha': 'raiz',
  'erva+faisca+flecha': 'polen',
  'erva+escudo+faisca+flecha': 'coracao',
};
export function nomeDoCombo(classes: Iterable<Classe | null>): string | null {
  const lista = [...new Set([...classes].filter(Boolean) as Classe[])].sort();
  return lista.length >= 3 ? (COMBOS[lista.join('+')] ?? null) : null;
}

// ---------------- O CAMINHO E OS INIMIGOS ----------------
/**
 * OS TRAÇOS (19/11/2026): cada inimigo tem um, que a tela mostra com figura e texto curto.
 * - espinhos: devolve parte do golpe de perto a quem bateu;
 * - ligeiro: age duas vezes por rodada;
 * - pedra: golpe físico quase não entra (só cai com magia);
 * - etereo: metade dos golpes físicos passa direto;
 * - peconha: o golpe envenena;
 * - regenera: recupera vida no fim da rodada;
 * - furia: com menos da metade da vida, bate mais forte;
 * - ladrao: o golpe rouba energia;
 * - sopro: o chefe enche o fôlego e, na rodada seguinte, o fogo pega a turma inteira.
 */
export const TRACOS = ['espinhos', 'ligeiro', 'pedra', 'etereo', 'peconha', 'regenera', 'furia', 'ladrao', 'sopro'] as const;
export type Traco = (typeof TRACOS)[number];

/** Os ids dos bichos são os da Briga (web/src/briga/folhasDosBichos.ts): o site os desenha pela folha deles. */
export interface DefDoInimigo {
  hp: number;
  atk: number;
  def: number;
  vel: number;
  traco: Traco;
  chefe?: boolean;
}
export const INIMIGOS: Record<string, DefDoInimigo> = {
  // (o equilíbrio é chute medido contra os robôs: a turma toda de robôs vence a maioria, e quase sempre perde no dragão)
  cogumelo: { hp: 117, atk: 28, def: 3, vel: 3, traco: 'regenera' },
  sapo: { hp: 98, atk: 30, def: 2, vel: 6, traco: 'peconha' },
  abelha: { hp: 69, atk: 23, def: 1, vel: 9, traco: 'ligeiro' },
  raposa: { hp: 94, atk: 30, def: 2, vel: 7, traco: 'ladrao' },
  corvo: { hp: 67, atk: 21, def: 1, vel: 10, traco: 'ligeiro' },
  texugo: { hp: 138, atk: 30, def: 4, vel: 3, traco: 'furia' },
  cacto: { hp: 150, atk: 34, def: 6, vel: 3, traco: 'espinhos' },
  dino: { hp: 132, atk: 36, def: 4, vel: 5, traco: 'furia' },
  redemoinho: { hp: 92, atk: 28, def: 2, vel: 10, traco: 'ligeiro' },
  espinhento: { hp: 167, atk: 39, def: 7, vel: 4, traco: 'espinhos' },
  golem: { hp: 173, atk: 36, def: 9, vel: 2, traco: 'pedra' },
  macaco: { hp: 150, atk: 41, def: 4, vel: 8, traco: 'furia' },
  diabinho: { hp: 132, atk: 41, def: 4, vel: 9, traco: 'ladrao' },
  fantasma: { hp: 126, atk: 39, def: 3, vel: 7, traco: 'etereo' },
  yeti: { hp: 340, atk: 42, def: 6, vel: 4, traco: 'sopro', chefe: true },
  dragao: { hp: 900, atk: 60, def: 10, vel: 6, traco: 'sopro', chefe: true },
};

export type TipoDeParada = 'luta' | 'descanso' | 'loja' | 'evento' | 'chefe';
/**
 * Uma parada possível: o id (que a tela desenha), o cenário da Briga (web/src/briga/cenarios.ts) e quem mora nela.
 * `inimigos` é o GRUPO DE REFERÊNCIA (o de antes de 20/11/2026): ele dá a medida da força da parada. `bando` são os bichos que
 * podem aparecer nela, e o grupo de cada partida sai da semente (ver `grupoDaParada`); `chefe`, o chefe que sempre está lá.
 */
export interface Parada {
  id: string;
  tipo: TipoDeParada;
  cenario: string;
  inimigos: string[];
  bando?: string[];
  chefe?: string;
  /** Quantos bichos do bando entram (sem o chefe): de 2 a 4, e com o chefe, 1 ou 2. */
  quantos?: [number, number];
}
export const PARADAS: Record<string, Parada> = {
  floresta: { id: 'floresta', tipo: 'luta', cenario: 'floresta', inimigos: ['cogumelo', 'sapo', 'abelha'], bando: ['cogumelo', 'sapo', 'abelha', 'corvo'] },
  horta: { id: 'horta', tipo: 'luta', cenario: 'horta', inimigos: ['raposa', 'corvo', 'texugo'], bando: ['raposa', 'corvo', 'texugo', 'abelha'] },
  deserto: { id: 'deserto', tipo: 'luta', cenario: 'deserto', inimigos: ['cacto', 'dino', 'redemoinho'], bando: ['cacto', 'dino', 'redemoinho', 'raposa'] },
  ruinas: { id: 'ruinas', tipo: 'luta', cenario: 'castelo', inimigos: ['fantasma', 'sapo', 'diabinho'], bando: ['fantasma', 'sapo', 'diabinho', 'golem'] },
  neve: { id: 'neve', tipo: 'luta', cenario: 'neve', inimigos: ['espinhento', 'golem', 'macaco'], bando: ['espinhento', 'golem', 'macaco', 'fantasma'] },
  geleira: { id: 'geleira', tipo: 'luta', cenario: 'neve', inimigos: ['macaco', 'yeti'], bando: ['macaco', 'espinhento', 'golem'], chefe: 'yeti' },
  fogueira: { id: 'fogueira', tipo: 'descanso', cenario: 'floresta', inimigos: [] },
  loja: { id: 'loja', tipo: 'loja', cenario: 'floresta', inimigos: [] },
  evento: { id: 'evento', tipo: 'evento', cenario: 'floresta', inimigos: [] },
  castelo: { id: 'castelo', tipo: 'chefe', cenario: 'castelo', inimigos: ['diabinho', 'dragao', 'fantasma'], bando: ['diabinho', 'fantasma', 'macaco'], chefe: 'dragao', quantos: [2, 2] },
};

/** Um bicho do grupo: o tipo e a escala da vida e do golpe (o grupo menor vem mais forte, o maior mais fraco). */
export interface NoGrupo {
  tipo: string;
  k: number;
}
/** O peso do golpe de um bicho na conta da força (o ligeiro age duas vezes, a segunda mais no fim da rodada). */
const pesoDoGolpe = (tipo: string) => INIMIGOS[tipo].atk * (INIMIGOS[tipo].traco === 'ligeiro' ? 1.6 : 1);
/** A força de um grupo (sem o chefe): a vida somada vezes o golpe somado, como numa batalha de desgaste. */
const forcaDoGrupo = (tipos: string[]) => tipos.reduce((s, t) => s + INIMIGOS[t].hp, 0) * tipos.reduce((s, t) => s + pesoDoGolpe(t), 0);
/**
 * Quanto um grupo de `n` bichos (contando o chefe) vale da força de referência, medido contra a turma de robôs (20/11/2026):
 * com quatro, a chuva e a rajada da turma pegam mais gente; com dois, o golpe da turma se concentra.
 */
export const FORCA_POR_TAMANHO: Record<number, number> = { 2: 0.85, 3: 1, 4: 1.1 };

/**
 * O GRUPO DE UMA PARADA (20/11/2026), pelo sorteio da semente: de 2 a 4 bichos do bando dela (com o chefe, ele e mais 1 ou 2), e
 * a vida e o golpe de cada um escalados para o grupo ter a força do grupo de referência. Assim a neve continua a parada mais
 * forte do caminho, seja qual for o grupo que saiu.
 */
export function grupoDaParada(p: Parada, r: () => number): NoGrupo[] {
  if (!p.bando) return p.inimigos.map((tipo) => ({ tipo, k: 1 }));
  // (o dragão com um bicho só ao lado venceu a turma de robôs o dobro das vezes: a escolta dele é sempre de dois)
  const [min, max] = p.quantos ?? (p.chefe ? [1, 2] : [2, 4]);
  const escolta = min + Math.floor(r() * (max - min + 1));
  const tipos = embaralhar([...p.bando], r).slice(0, escolta);
  const referencia = p.inimigos.filter((t) => t !== p.chefe);
  const alvo = forcaDoGrupo(referencia) * (FORCA_POR_TAMANHO[p.chefe ? tipos.length + 1 : tipos.length] ?? 1);
  const k = Math.max(0.5, Math.min(1.6, Math.sqrt(alvo / forcaDoGrupo(tipos))));
  const grupo = tipos.map((tipo) => ({ tipo, k: Math.round(k * 100) / 100 }));
  // o chefe no meio (a tela o desenha grande; a escolta em cima e embaixo)
  if (p.chefe) grupo.splice(1, 0, { tipo: p.chefe, k: 1 });
  return grupo;
}
/** Os cinco passos: cada um é uma parada só, ou a bifurcação entre duas (sorteadas pela semente). */
export const PASSOS_DA_ROTA = 5;
export const EVENTOS = ['fonte', 'bau', 'treino'] as const;
export type EventoDaParada = (typeof EVENTOS)[number];

/** Um sorteio repetível (mulberry32): a mesma semente dá o mesmo caminho. */
export function sorteioDaSemente(s: number) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * O CAMINHO da partida, pela semente: quais paradas formam cada passo, qual evento cai no ponto de interrogação, e o GRUPO de
 * inimigos de cada parada de luta (20/11/2026; sorteado depois do resto, para o caminho de cada semente não mudar).
 */
export function rotaDaSemente(semente: number): { passos: string[][]; evento: EventoDaParada; grupos: Record<string, NoGrupo[]> } {
  const r = sorteioDaSemente(semente);
  const um = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const dois = <T>(xs: T[]) => embaralhar([...xs], r);
  const passos = [[um(['floresta', 'horta'])], dois(['deserto', 'ruinas']), dois(['fogueira', um(['loja', 'evento'])]), dois(['neve', 'geleira']), ['castelo']];
  const evento = um(EVENTOS);
  const grupos: Record<string, NoGrupo[]> = {};
  for (const id of passos.flat()) if (PARADAS[id].inimigos.length) grupos[id] = grupoDaParada(PARADAS[id], r);
  return { passos, evento, grupos };
}

// ---------------- O EQUIPAMENTO ----------------
export const PECAS = ['arma', 'armadura', 'amuleto'] as const;
export type Peca = (typeof PECAS)[number];
export interface Item {
  peca: Peca;
  /** A arma soma no ataque e na magia; a armadura, na defesa; o amuleto, na vida máxima. */
  valor: number;
}
/** O valor de uma peça na parada `n` (a da neve é melhor que a da floresta). */
export function valorDaPeca(peca: Peca, n: number, sorte: number) {
  return peca === 'amuleto' ? 10 + n * 4 + Math.floor(sorte * 8) : 2 + n + Math.floor(sorte * 3);
}

// ---------------- OS TIPOS ----------------
export type Acao = 'atacar' | 'habilidade' | 'defender' | 'combo';
export const ACOES: readonly Acao[] = ['atacar', 'habilidade', 'defender', 'combo'];
export interface Escolha {
  acao: Acao;
  /** O inimigo (índice), para atacar, as habilidades com alvo e o combo. */
  alvo: number | null;
  /** Qual habilidade (0 a 2). */
  hab?: number;
}

type Bonus = Record<'hp' | 'atk' | 'mag' | 'def' | 'vel' | 'en', number>;
export interface Heroi {
  userId: number;
  classe: Classe | null;
  hp: number;
  equip: Record<Peca, number>;
  /** O que as melhorias somaram, e o nível (as lutas vencidas). */
  bonus: Bonus;
  nivel: number;
  melhorias: Melhoria[];
  en: number;
  escolha: Escolha | null;
  pontos: number;
  defendendo: boolean;
  protegendo: boolean;
  provocando: boolean;
  /** Envenenado pelo sapo: as rodadas que faltam e o dano de cada uma. */
  veneno: { rodadas: number; dano: number } | null;
}

export interface Inimigo {
  id: number;
  tipo: string;
  hp: number;
  hpMax: number;
  atk: number;
  def: number;
  vel: number;
  chefe: boolean;
  traco: Traco;
  /** Tonto pelo combo do Escudo ou pelo tiro da Flecha: perde a próxima vez. */
  tonto: boolean;
  /** O chefe enchendo o fôlego: na próxima rodada, o sopro pega a turma inteira (a tela avisa). */
  preparando: boolean;
  /** O veneno da Erva: as rodadas que faltam, o dano e quem envenenou (os pontos). */
  veneno: { rodadas: number; dano: number; de: number } | null;
}

/** Quem age ou leva: um herói (pelo id da pessoa) ou um inimigo (pelo índice). */
export type Ator = { h: number } | { i: number };
export interface Alvo {
  quem: Ator;
  dano?: number;
  cura?: number;
  /** Caiu com este golpe. */
  ko?: boolean;
  /** Levantou (a cura da Erva em quem tinha caído). */
  volta?: boolean;
  /** O golpe passou direto (o fantasma). */
  errou?: boolean;
  /** O golpe quase não entrou (o golem). */
  resistiu?: boolean;
  /** Perdeu energia (o ladrão). */
  energia?: number;
}
export type TipoDeEvento =
  | 'ataque'
  | 'habilidade'
  | 'defender'
  | 'combo'
  | 'inimigo'
  | 'sopro'
  | 'preparar'
  | 'tonto'
  | 'espinhos'
  | 'veneno'
  | 'renovar'
  | 'regenera';
export interface Evento {
  id: number;
  tipo: TipoDeEvento;
  de: Ator;
  alvos: Alvo[];
  /** Na habilidade: qual (o id da tabela). */
  hab?: string;
  /** No combo: quem atacou junto, e o nome (com três classes ou mais). */
  membros?: number[];
  nome?: string;
  /** O herói do Escudo que levou o golpe no lugar de outro. */
  protegido?: boolean;
}

export interface OpcoesDasLendas {
  agora?: () => number;
  aleatorio?: () => number;
  servicos?: {
    avatarDe(userId: number): number | string | null;
    guardarTrofeu(t: { userId: number; evento: string; communityId: number; pista: string; posicao: number; tempoMs: number | null; pontos: number | null; rivais: number[] }): void;
    /** O recorde do Solo (a tabela comum): as rodadas até o dragão, menor é melhor. */
    guardarRecorde?(userId: number, rodadas: number, extra: { tempoMs: number }): { antes: number | null; novo: boolean };
  };
}

// ---------------- AS CONTAS (puras, exportadas para o teste) ----------------
const SEM_BONUS: Bonus = { hp: 0, atk: 0, mag: 0, def: 0, vel: 0, en: 0 };
/** Os números do herói com o equipamento e as melhorias. */
export function atributos(h: Pick<Heroi, 'classe' | 'equip'> & Partial<Pick<Heroi, 'bonus'>>) {
  const b = BASES[h.classe ?? 'escudo'];
  const x = h.bonus ?? SEM_BONUS;
  return {
    hpMax: b.hp + h.equip.amuleto + x.hp,
    enMax: b.en + x.en,
    atk: b.atk + h.equip.arma + x.atk,
    mag: b.mag + h.equip.arma + x.mag,
    def: b.def + h.equip.armadura + x.def,
    vel: b.vel + x.vel,
  };
}
/** As habilidades que o herói já tem (pelo nível). */
export const habilidadesDe = (h: Pick<Heroi, 'classe' | 'nivel'>) => (h.classe ? HABILIDADES[h.classe].filter((d) => d.nivel <= h.nivel) : []);

/** As cores dos robôs: três coelhos prontos, para a turma não ser de quatro mascotes iguais. */
const AVATARES_DOS_ROBOS = [4, 9, 13, 2];

export function criarLendas({ agora = Date.now, aleatorio = Math.random, servicos }: OpcoesDasLendas = {}): Definicao {
  return {
    minimo: 1,
    maximo: 4,
    comecar(ctxDaSala, { naSala: naSalaDaSala }) {
      const humanos = naSalaDaSala.slice(0, 4);
      if (!humanos.length) return 'Ainda falta gente para começar.';
      const robos = idsDosRobos(4 - humanos.length);
      const ctx = comRobos(ctxDaSala, robos);
      const solo = ctxDaSala.solo === true;
      const ordem = [...humanos, ...robos];
      const inicio = agora();
      const partidaId = `lendas-${ctx.comunidade ?? 0}-${inicio}`;
      const sorteio = (a: number, b: number) => a + (b - a) * aleatorio();
      const variar = (x: number) => x * sorteio(0.9, 1.1);
      /** O CAMINHO desta partida (a semente vai à tela: quem quiser, compara caminhos). */
      const semente = Math.floor(aleatorio() * 2 ** 31);
      const caminho = rotaDaSemente(semente);
      /** A parada escolhida em cada passo (as de uma opção só já vêm escolhidas). */
      const escolhidas: (string | null)[] = caminho.passos.map((p) => (p.length === 1 ? p[0] : null));

      const herois = new Map<number, Heroi>(
        ordem.map((userId) => [
          userId,
          {
            userId,
            classe: null,
            hp: 0,
            equip: { arma: 0, armadura: 0, amuleto: 0 },
            bonus: { ...SEM_BONUS },
            nivel: 0,
            melhorias: [],
            en: 0,
            escolha: null,
            pontos: 0,
            defendendo: false,
            protegendo: false,
            provocando: false,
            veneno: null,
          },
        ]),
      );
      const avatares = new Map<number, number | string | null>(
        ordem.map((id) => [id, ehRobo(id) ? AVATARES_DOS_ROBOS[(-id - 1) % AVATARES_DOS_ROBOS.length] : (servicos?.avatarDe(id) ?? null)]),
      );
      /** Quem escolheu pelo robô nesta fase (o tempo acabou, ou saiu): a tela mostra a escolha com outra marca. */
      const peloRobo = new Set<number>();

      let fase: 'classes' | 'mapa' | 'rumo' | 'descanso' | 'loja' | 'evento' | 'escolha' | 'acao' | 'espolio' | 'fim' = 'classes';
      let parada = 0;
      let rodada = 0;
      /** As rodadas de todas as lutas (o recorde do Solo). */
      let rodadasTotais = 0;
      let inimigos: Inimigo[] = [];
      let eventos: Evento[] = [];
      let proximoEvento = 1;
      /** O número da resolução: o site sabe que chegou rodada nova para animar. */
      let resolucao = 0;
      let espolio = new Map<number, Item>();
      /** As duas melhorias que cada um pode escolher depois da luta, e a escolhida. */
      let ofertas = new Map<number, Melhoria[]>();
      const melhorou = new Set<number>();
      /** A loja: as três peças de cada um. */
      let vitrine = new Map<number, Item[]>();
      const decidiram = new Set<number>();
      /** O voto do caminho: pessoa → opção (0 ou 1). */
      const votosDoRumo = new Map<number, number>();
      /** A turma acelerada (as rodadas que faltam) e a Erva renovando (as rodadas e de quem). */
      let rapidez = 0;
      let renovar: { rodadas: number; de: number } | null = null;
      let muralha = false;
      /** O BOTÃO DE ACELERAR (20/11/2026), só no Solo: a tela toca a rodada no dobro da velocidade. O ritmo vale por resolução
       * (o que vai à tela é o da rodada que está sendo tocada; trocar no meio vale da próxima). */
      let acelerado = false;
      let ritmo = 1;
      const noRitmo = (ms: number) => Math.round(ms * (solo && acelerado ? 0.5 : 1));
      let venceu = false;
      let resultado: { userId: number; username: string; pontos: number; posicao: number | null }[] | null = null;
      let recorde: { valor: number; antes: number | null; novo: boolean } | null = null;

      const presente = (id: number) => ctx.naSala().includes(id);
      const vivos = () => ordem.map((id) => herois.get(id)!).filter((h) => h.hp > 0);
      const inimigosVivos = () => inimigos.filter((i) => i.hp > 0);
      const relogio = (ms: number) => (solo ? TEMPO_SOLO : ms);
      const paradaAtual = () => PARADAS[escolhidas[parada] ?? caminho.passos[parada][0]];

      // ---------------- AS CLASSES ----------------
      const classeDoRobo = (): Classe => {
        const usadas = new Set([...herois.values()].map((h) => h.classe).filter(Boolean));
        const falta = CLASSES.filter((c) => !usadas.has(c));
        return falta.length ? falta[0] : CLASSES[Math.floor(aleatorio() * CLASSES.length)];
      };
      const vestir = (h: Heroi, classe: Classe) => {
        h.classe = classe;
        const a = atributos(h);
        h.hp = a.hpMax;
        h.en = a.enMax;
      };
      const fecharClasses = () => {
        if (fase !== 'classes') return;
        // primeiro quem é gente (o tempo acabou ou saiu), depois os robôs com o que faltou
        for (const id of humanos) if (!herois.get(id)!.classe) vestir(herois.get(id)!, classeDoRobo());
        for (const id of robos) vestir(herois.get(id)!, classeDoRobo());
        irAoMapa();
      };
      const conferirClasses = () => {
        for (const id of humanos) if (!presente(id) && !herois.get(id)!.classe) vestir(herois.get(id)!, classeDoRobo());
        if (humanos.every((id) => herois.get(id)!.classe)) fecharClasses();
      };

      // ---------------- O MAPA E O RUMO ----------------
      const irAoMapa = () => {
        eventos = [];
        // a bifurcação ainda sem escolha: a turma vota antes de andar
        if (escolhidas[parada] === null) return abrirRumo();
        fase = 'mapa';
        ctx.agendar(noRitmo(MAPA_MS), entrarNaParada);
        ctx.avisar();
      };
      const abrirRumo = () => {
        fase = 'rumo';
        votosDoRumo.clear();
        ctx.agendar(relogio(TEMPO_DO_RUMO), fecharRumo);
        if (!conferirRumo()) ctx.avisar();
      };
      const conferirRumo = () => {
        if (fase !== 'rumo') return false;
        const votam = humanos.filter(presente);
        if (votam.every((id) => votosDoRumo.has(id))) {
          fecharRumo();
          return true;
        }
        return false;
      };
      const fecharRumo = () => {
        if (fase !== 'rumo') return;
        const conta = [0, 0];
        for (const v of votosDoRumo.values()) conta[v]++;
        // empate (ou ninguém votou): o servidor sorteia
        const lado = conta[0] === conta[1] ? Math.floor(aleatorio() * 2) : conta[0] > conta[1] ? 0 : 1;
        escolhidas[parada] = caminho.passos[parada][lado];
        irAoMapa();
      };

      const entrarNaParada = () => {
        const p = paradaAtual();
        if (p.tipo === 'descanso') {
          fase = 'descanso';
          // a fogueira: metade da vida de volta, quem caiu levanta, a energia cheia
          for (const h of herois.values()) {
            const a = atributos(h);
            h.hp = Math.min(a.hpMax, Math.max(h.hp, 0) + Math.round(a.hpMax * 0.5));
            h.en = a.enMax;
            h.veneno = null;
          }
          ctx.agendar(noRitmo(DESCANSO_MS), seguir);
          ctx.avisar();
          return;
        }
        if (p.tipo === 'evento') {
          fase = 'evento';
          for (const h of herois.values()) {
            const a = atributos(h);
            if (caminho.evento === 'fonte') {
              // a fonte: a vida e a energia cheias, e quem caiu levanta
              h.hp = a.hpMax;
              h.en = a.enMax;
              h.veneno = null;
            } else if (caminho.evento === 'bau') {
              // o baú: uma peça para cada um, vestida se for melhor
              const item: Item = { peca: PECAS[Math.floor(aleatorio() * PECAS.length)], valor: 0 };
              item.valor = valorDaPeca(item.peca, parada + 1, aleatorio());
              if (item.valor > h.equip[item.peca]) vestirPeca(h, item);
            } else {
              // o treino: todo mundo mais forte, no golpe e na magia
              h.bonus.atk += 3;
              h.bonus.mag += 3;
            }
          }
          ctx.agendar(noRitmo(EVENTO_DA_PARADA_MS), seguir);
          ctx.avisar();
          return;
        }
        if (p.tipo === 'loja') return abrirLoja();
        // o grupo que a semente sorteou para esta parada (ver grupoDaParada)
        inimigos = (caminho.grupos[p.id] ?? p.inimigos.map((tipo) => ({ tipo, k: 1 }))).map(({ tipo, k }, id) => {
          const d = INIMIGOS[tipo];
          const hp = Math.round(d.hp * k);
          return { id, tipo, hp, hpMax: hp, atk: Math.round(d.atk * k), def: d.def, vel: d.vel, chefe: !!d.chefe, traco: d.traco, tonto: false, preparando: false, veneno: null };
        });
        rodada = 0;
        rapidez = 0;
        renovar = null;
        novaRodada();
      };
      const seguir = () => {
        parada++;
        irAoMapa();
      };

      // ---------------- A ESCOLHA ----------------
      const novaRodada = () => {
        fase = 'escolha';
        rodada++;
        rodadasTotais++;
        eventos = [];
        peloRobo.clear();
        for (const h of herois.values()) {
          h.escolha = null;
          h.defendendo = false;
          h.protegendo = false;
          h.provocando = false;
        }
        // os robôs escolhem na hora; quem é gente tem o relógio
        for (const id of robos) escolherPeloRobo(herois.get(id)!);
        for (const id of humanos) if (!presente(id)) escolherPeloRobo(herois.get(id)!, true);
        ctx.agendar(relogio(TEMPO_DA_ESCOLHA), fecharEscolha);
        if (!conferirEscolhas()) ctx.avisar();
      };

      /** Todo herói vivo escolheu? Então a rodada se resolve já. */
      const conferirEscolhas = () => {
        if (fase !== 'escolha') return false;
        for (const id of humanos) {
          const h = herois.get(id)!;
          if (h.hp > 0 && !h.escolha && !presente(id)) escolherPeloRobo(h, true);
        }
        if (vivos().every((h) => h.escolha)) {
          resolver();
          return true;
        }
        return false;
      };
      const fecharEscolha = () => {
        if (fase !== 'escolha') return;
        for (const h of vivos()) if (!h.escolha) escolherPeloRobo(h, true);
        resolver();
      };

      const podeUsar = (h: Heroi, k: number) => {
        const d = h.classe ? HABILIDADES[h.classe][k] : undefined;
        return !!d && d.nivel <= h.nivel && h.en >= d.custo;
      };

      /** O robô: regras de quem joga com cuidado, vendo o que a turma vê. */
      const escolherPeloRobo = (h: Heroi, porGente = false) => {
        if (h.hp <= 0 || !h.classe) return;
        if (porGente) peloRobo.add(h.userId);
        const vivosI = inimigosVivos();
        if (!vivosI.length) return (h.escolha = { acao: 'defender', alvo: null });
        // o alvo do golpe físico: o mais fraco que sente golpe (o golem e o fantasma por último)
        const fisicoRuim = (i: Inimigo) => i.traco === 'pedra' || i.traco === 'etereo';
        const porVida = [...vivosI].sort((x, y) => Number(fisicoRuim(x)) - Number(fisicoRuim(y)) || x.hp - y.hp);
        const fraco = porVida[0];
        const sopro = vivosI.some((i) => i.preparando);
        const chefe = vivosI.find((i) => i.chefe);
        const turma = vivos();
        const caidos = ordem.filter((id) => herois.get(id)!.hp <= 0).length;
        const falta = turma.reduce((s, x) => s + (atributos(x).hpMax - x.hp), 0);
        const total = turma.reduce((s, x) => s + atributos(x).hpMax, 0);
        const fracos = turma.filter((x) => x.hp < atributos(x).hpMax * 0.5).length;
        const hab = (k: number, alvo: number | null = null): Escolha => ({ acao: 'habilidade', alvo, hab: k });
        let e: Escolha = { acao: 'atacar', alvo: fraco.id };
        switch (h.classe) {
          case 'erva':
            if (podeUsar(h, 3) && (caidos > 0 || fracos >= 2)) e = hab(3);
            else if (podeUsar(h, 0) && (caidos > 0 || falta > total * 0.3 || turma.some((x) => x.hp < atributos(x).hpMax * 0.35))) e = hab(0);
            else if (podeUsar(h, 2) && !renovar && falta > total * 0.15 && h.en >= 3 + 4) e = hab(2);
            else if (sopro) e = { acao: 'defender', alvo: null };
            else if (podeUsar(h, 1) && h.en >= 2 + 4) {
              const alvo = [...vivosI].filter((i) => !i.veneno && i.hp > 50).sort((x, y) => y.hp - x.hp)[0];
              if (alvo) e = hab(1, alvo.id);
            }
            break;
          case 'escudo':
            if (podeUsar(h, 2) && (sopro || fracos >= 2)) e = hab(2);
            else if (podeUsar(h, 3) && chefe && !chefe.tonto) e = hab(3, chefe.id);
            else if (sopro) e = { acao: 'defender', alvo: null };
            else if (podeUsar(h, 1) && h.hp > atributos(h).hpMax * 0.5 && turma.some((x) => x !== h && x.hp < atributos(x).hpMax * 0.5)) e = hab(1);
            else if (podeUsar(h, 0) && turma.some((x) => x !== h && x.hp < atributos(x).hpMax * 0.4)) e = hab(0);
            break;
          case 'faisca': {
            const pedra = vivosI.find((i) => i.traco === 'pedra');
            if (podeUsar(h, 2) && chefe && rapidez === 0 && h.en >= 4 + 3) e = hab(2);
            else if (podeUsar(h, 3) && vivosI.length >= 2) e = hab(3);
            else if (podeUsar(h, 0) && vivosI.length >= 2) e = hab(0);
            else if (podeUsar(h, 1)) e = hab(1, (pedra ?? chefe ?? fraco).id);
            else if (sopro) e = { acao: 'defender', alvo: null };
            break;
          }
          case 'flecha': {
            const forte = chefe ?? fraco;
            if (podeUsar(h, 3) && chefe && !sopro) e = hab(3, chefe.id);
            else if (podeUsar(h, 1) && (sopro || (chefe && !chefe.tonto && chefe.preparando))) e = hab(1, (vivosI.find((i) => i.preparando) ?? forte).id);
            else if (podeUsar(h, 2) && vivosI.length >= 2 && !vivosI.every(fisicoRuim)) e = hab(2);
            else if (podeUsar(h, 0)) e = hab(0, forte.id);
            break;
          }
        }
        // o robô atende o chamado de combo de quem é gente, se tem energia e não está curando a turma
        const chamado = [...herois.values()].find((x) => x !== h && x.escolha?.acao === 'combo' && !ehRobo(x.userId));
        const jaTemPar = [...herois.values()].filter((x) => x.escolha?.acao === 'combo').length >= 2;
        if (chamado && (!jaTemPar || chefe) && h.en >= CUSTO_DO_COMBO && e.acao !== 'defender' && !(h.classe === 'erva' && e.acao === 'habilidade')) {
          e = { acao: 'combo', alvo: chamado.escolha!.alvo };
        }
        h.escolha = e;
      };

      /** Alguém de gente escolheu Combo: um robô vira o par (na luta do chefe, todos os robôs com energia vão junto). */
      const atenderCombo = (quem: Heroi) => {
        const chefe = inimigosVivos().some((i) => i.chefe);
        const candidatos = robos
          .map((id) => herois.get(id)!)
          .filter((x) => x.hp > 0 && x.en >= CUSTO_DO_COMBO && x.escolha?.acao !== 'combo')
          // quem estava só atacando primeiro; a Erva curando e quem se defende do sopro ficam
          .sort((x, y) => Number(x.escolha?.acao !== 'atacar') - Number(y.escolha?.acao !== 'atacar'))
          .filter((x) => x.escolha?.acao === 'atacar' || (x.classe !== 'erva' && x.escolha?.acao !== 'defender'));
        const noCombo = [...herois.values()].filter((x) => x.hp > 0 && x.escolha?.acao === 'combo').length;
        const vao = chefe ? candidatos : noCombo >= 2 ? [] : candidatos.slice(0, 1);
        for (const par of vao) par.escolha = { acao: 'combo', alvo: quem.escolha!.alvo };
      };

      // ---------------- A RESOLUÇÃO ----------------
      const evento = (e: Omit<Evento, 'id'>) => eventos.push({ ...e, id: proximoEvento++ });
      /** Os espinhos que um golpe de perto acordou: viram um acontecimento logo depois do golpe. */
      let espinhos: { de: Inimigo; dano: number; em: Heroi[] }[] = [];
      const ferirInimigo = (i: Inimigo, dano: number, quem: Heroi[], tipo: 'fisico' | 'magia' = 'fisico', contato = false): Alvo => {
        if (tipo === 'fisico' && i.traco === 'etereo' && aleatorio() < 0.5) return { quem: { i: i.id }, dano: 0, errou: true };
        let d = Math.max(1, Math.round(dano));
        const resistiu = tipo === 'fisico' && i.traco === 'pedra';
        if (resistiu) d = Math.max(1, Math.round(d / 4));
        const real = Math.min(i.hp, d);
        i.hp -= real;
        for (const h of quem) h.pontos += Math.round(real / quem.length);
        if (contato && i.traco === 'espinhos' && real > 0) espinhos.push({ de: i, dano: Math.max(1, Math.round(real * 0.3)), em: quem });
        return { quem: { i: i.id }, dano: d, ko: i.hp <= 0, ...(resistiu ? { resistiu } : {}) };
      };
      const soltarEspinhos = () => {
        for (const s of espinhos) {
          const alvos = s.em
            .filter((h) => h.hp > 0)
            .map((h) => {
              const final = Math.max(1, Math.round(s.dano / s.em.length));
              h.hp = Math.max(0, h.hp - final);
              return { quem: { h: h.userId }, dano: final, ko: h.hp <= 0 } as Alvo;
            });
          if (alvos.length) evento({ tipo: 'espinhos', de: { i: s.de.id }, alvos });
        }
        espinhos = [];
      };
      const alvoVivo = (alvo: number | null) => {
        const i = inimigos.find((x) => x.id === alvo && x.hp > 0);
        return i ?? [...inimigosVivos()].sort((a, b) => a.hp - b.hp)[0];
      };

      const agirHeroi = (h: Heroi) => {
        if (h.hp <= 0 || !h.escolha || !inimigosVivos().length) return;
        const a = atributos(h);
        const { acao } = h.escolha;
        if (acao === 'defender') return; // já valeu desde o começo da rodada
        const k = h.escolha.hab ?? 0;
        const def = h.classe ? HABILIDADES[h.classe][k] : undefined;
        // (o "proteger", o "provocar" e a "muralha" já valeram desde o começo da rodada, e já pagaram)
        if (acao === 'habilidade' && def && h.classe === 'escudo' && k < 3) return;
        if (acao === 'habilidade' && def && podeUsar(h, k)) {
          h.en -= def.custo;
          const de = { h: h.userId };
          switch (def.id) {
            case 'chuva':
              return evento({ tipo: 'habilidade', hab: def.id, de, alvos: inimigosVivos().map((i) => ferirInimigo(i, variar(a.mag) - i.def * 0.25, [h], 'magia')) });
            case 'raio': {
              const i = alvoVivo(h.escolha.alvo);
              return evento({ tipo: 'habilidade', hab: def.id, de, alvos: [ferirInimigo(i, variar(a.mag * 2.2) - i.def * 0.25, [h], 'magia')] });
            }
            case 'acelerar':
              rapidez = 3;
              return evento({ tipo: 'habilidade', hab: def.id, de, alvos: vivos().map((x) => ({ quem: { h: x.userId } })) });
            case 'curar': {
              const alvos: Alvo[] = [];
              for (const x of herois.values()) {
                const ax = atributos(x);
                if (x.hp <= 0) {
                  x.hp = Math.round(ax.hpMax * 0.25);
                  h.pontos += x.hp;
                  alvos.push({ quem: { h: x.userId }, cura: x.hp, volta: true });
                } else {
                  const cura = Math.min(ax.hpMax - x.hp, Math.round(variar(a.mag * 1.4 + 8)));
                  x.hp += cura;
                  h.pontos += cura;
                  alvos.push({ quem: { h: x.userId }, cura });
                }
              }
              return evento({ tipo: 'habilidade', hab: def.id, de, alvos });
            }
            case 'veneno': {
              const i = alvoVivo(h.escolha.alvo);
              i.veneno = { rodadas: 3, dano: Math.round(a.mag * 0.8), de: h.userId };
              return evento({ tipo: 'habilidade', hab: def.id, de, alvos: [{ quem: { i: i.id } }] });
            }
            case 'renovar':
              renovar = { rodadas: 3, de: h.userId };
              return evento({ tipo: 'habilidade', hab: def.id, de, alvos: vivos().map((x) => ({ quem: { h: x.userId } })) });
            case 'tiro': {
              const i = alvoVivo(h.escolha.alvo);
              return evento({ tipo: 'habilidade', hab: def.id, de, alvos: [ferirInimigo(i, variar(a.atk * 2), [h])] });
            }
            case 'atordoar': {
              const i = alvoVivo(h.escolha.alvo);
              const alvo = ferirInimigo(i, variar(a.atk * 1.2), [h]);
              if (i.hp > 0 && !alvo.errou) i.tonto = true;
              return evento({ tipo: 'habilidade', hab: def.id, de, alvos: [alvo] });
            }
            // OS GOLPES FINAIS (nível 3)
            case 'investida': {
              const i = alvoVivo(h.escolha.alvo);
              const alvo = ferirInimigo(i, variar(a.atk * 2.2 + a.def) - i.def * 0.5, [h], 'fisico', true);
              if (i.hp > 0 && !alvo.errou) i.tonto = true;
              evento({ tipo: 'habilidade', hab: def.id, de, alvos: [alvo] });
              return soltarEspinhos();
            }
            case 'estrelas':
              return evento({ tipo: 'habilidade', hab: def.id, de, alvos: inimigosVivos().map((i) => ferirInimigo(i, variar(a.mag * 1.7) - i.def * 0.25, [h], 'magia')) });
            case 'florescer': {
              const alvos: Alvo[] = [];
              for (const x of herois.values()) {
                const ax = atributos(x);
                x.veneno = null;
                if (x.hp <= 0) {
                  x.hp = Math.round(ax.hpMax * 0.5);
                  h.pontos += x.hp;
                  alvos.push({ quem: { h: x.userId }, cura: x.hp, volta: true });
                } else {
                  const cura = Math.min(ax.hpMax - x.hp, Math.round(ax.hpMax * 0.5));
                  x.hp += cura;
                  h.pontos += cura;
                  alvos.push({ quem: { h: x.userId }, cura });
                }
              }
              return evento({ tipo: 'habilidade', hab: def.id, de, alvos });
            }
            case 'final': {
              // (como magia: o fantasma não desvia e a pedra não segura)
              const i = alvoVivo(h.escolha.alvo);
              return evento({ tipo: 'habilidade', hab: def.id, de, alvos: [ferirInimigo(i, variar(a.atk * 3), [h], 'magia')] });
            }
            case 'rajada': {
              const alvos: Alvo[] = [];
              for (let n = 0; n < 3 && inimigosVivos().length; n++) {
                const vs = inimigosVivos();
                alvos.push(ferirInimigo(vs[Math.floor(aleatorio() * vs.length)], variar(a.atk * 0.8), [h]));
              }
              return evento({ tipo: 'habilidade', hab: def.id, de, alvos });
            }
          }
        }
        // atacar (e o combo sem par, e a habilidade sem energia); a Flecha atira de longe, os outros batem de perto
        const i = alvoVivo(h.escolha.alvo);
        evento({ tipo: 'ataque', de: { h: h.userId }, alvos: [ferirInimigo(i, variar(a.atk) - i.def * 0.5, [h], 'fisico', h.classe !== 'flecha')] });
        soltarEspinhos();
      };

      const agirCombo = (membros: Heroi[], alvo: number | null) => {
        const ainda = membros.filter((h) => h.hp > 0 && h.en >= CUSTO_DO_COMBO);
        if (ainda.length < 2 || !inimigosVivos().length) {
          for (const h of ainda) {
            h.escolha = { acao: 'atacar', alvo };
            agirHeroi(h);
          }
          return;
        }
        for (const h of ainda) h.en -= CUSTO_DO_COMBO;
        const classes = new Set(ainda.map((h) => h.classe));
        const nome = nomeDoCombo(classes);
        const i = alvoVivo(alvo);
        let forca = ainda.reduce((s, h) => s + Math.max(atributos(h).atk, atributos(h).mag), 0) * 1.5;
        if (classes.has('flecha')) forca *= 1.25;
        // o combo com nome: três classes ou mais batem mais forte
        if (nome) forca *= classes.size >= 4 ? 1.35 : 1.15;
        const tipo = classes.has('faisca') ? 'magia' : 'fisico';
        const alvos: Alvo[] = [ferirInimigo(i, variar(forca), ainda, tipo, true)];
        if (classes.has('faisca')) for (const o of inimigosVivos()) if (o !== i) alvos.push(ferirInimigo(o, variar(forca * 0.4) - o.def * 0.25, ainda, 'magia'));
        if (classes.has('escudo') && i.hp > 0) i.tonto = true;
        if (classes.has('erva')) {
          for (const x of vivos()) {
            const cura = Math.min(atributos(x).hpMax - x.hp, nome ? 25 : 15);
            x.hp += cura;
            alvos.push({ quem: { h: x.userId }, cura });
          }
        }
        evento({ tipo: 'combo', de: { h: ainda[0].userId }, membros: ainda.map((h) => h.userId), alvos, ...(nome ? { nome } : {}) });
        soltarEspinhos();
      };

      /** O quanto um golpe dói em `h` nesta rodada (a defesa, o escudo, a provocação e a muralha). */
      const doer = (h: Heroi, dano: number) => {
        let d = dano - atributos(h).def * 0.5;
        if (h.defendendo || h.protegendo) d *= 0.5;
        if (h.provocando) d *= 0.7;
        if (muralha) d *= 0.6;
        return Math.max(1, Math.round(d));
      };
      const ferirHeroi = (alvo: Heroi, dano: number): Alvo & { protegido?: boolean } => {
        let h = alvo;
        let protegido = false;
        // o Escudo protegendo leva o golpe no lugar de quem está atrás dele, com metade
        const escudo = vivos().find((x) => x.protegendo && x !== alvo);
        if (escudo) {
          h = escudo;
          protegido = true;
        }
        const final = doer(h, dano);
        h.hp = Math.max(0, h.hp - final);
        return { quem: { h: h.userId }, dano: final, ko: h.hp <= 0, protegido };
      };

      const agirInimigo = (i: Inimigo) => {
        if (i.hp <= 0 || !vivos().length) return;
        if (i.tonto) {
          i.tonto = false;
          return evento({ tipo: 'tonto', de: { i: i.id }, alvos: [] });
        }
        if (i.chefe && i.preparando) {
          i.preparando = false;
          // o sopro: a turma inteira (o "proteger" e o "provocar" não seguram fogo que vem de todo lado: o defender e a muralha sim)
          const alvos = vivos().map((h) => {
            let d = variar(i.atk * 0.85) - atributos(h).def * 0.5;
            if (h.defendendo || h.protegendo) d *= 0.5;
            if (muralha) d *= 0.6;
            const final = Math.max(1, Math.round(d));
            h.hp = Math.max(0, h.hp - final);
            return { quem: { h: h.userId }, dano: final, ko: h.hp <= 0 } as Alvo;
          });
          return evento({ tipo: 'sopro', de: { i: i.id }, alvos });
        }
        if (i.chefe && rodada % 3 === 2) {
          i.preparando = true;
          return evento({ tipo: 'preparar', de: { i: i.id }, alvos: [] });
        }
        // o alvo: quem provoca; senão, ao acaso, com o Escudo chamando mais atenção
        const turma = vivos();
        let alvo = turma.find((h) => h.provocando);
        if (!alvo) {
          const pesos = turma.map((h) => (h.classe === 'escudo' ? 2 : 1));
          let r = aleatorio() * pesos.reduce((s, p) => s + p, 0);
          alvo = turma[turma.length - 1];
          for (let k = 0; k < turma.length; k++) {
            r -= pesos[k];
            if (r < 0) {
              alvo = turma[k];
              break;
            }
          }
        }
        const forca = i.traco === 'furia' && i.hp < i.hpMax / 2 ? 1.4 : 1;
        const { protegido, ...a } = ferirHeroi(alvo, variar(i.atk * forca));
        const levou = 'h' in a.quem ? herois.get(a.quem.h)! : alvo;
        if (levou.hp > 0 && i.traco === 'peconha') levou.veneno = { rodadas: 2, dano: Math.round(i.atk * 0.25) };
        if (i.traco === 'ladrao' && levou.en > 0) {
          levou.en -= 1;
          a.energia = -1;
        }
        evento({ tipo: 'inimigo', de: { i: i.id }, alvos: [a], protegido });
      };

      /** O fim da rodada: os venenos, a renovação da Erva e o cogumelo que regenera. */
      const fimDaRodada = () => {
        const venenoEm: Alvo[] = [];
        for (const h of vivos()) {
          if (!h.veneno) continue;
          const d = Math.min(h.hp, h.veneno.dano);
          h.hp = Math.max(0, h.hp - d);
          venenoEm.push({ quem: { h: h.userId }, dano: d, ko: h.hp <= 0 });
          if (--h.veneno.rodadas <= 0) h.veneno = null;
        }
        for (const i of inimigosVivos()) {
          if (!i.veneno) continue;
          const real = Math.min(i.hp, i.veneno.dano);
          i.hp -= real;
          const quem = herois.get(i.veneno.de);
          if (quem) quem.pontos += real;
          venenoEm.push({ quem: { i: i.id }, dano: real, ko: i.hp <= 0 });
          if (--i.veneno.rodadas <= 0) i.veneno = null;
        }
        if (venenoEm.length) evento({ tipo: 'veneno', de: venenoEm[0].quem, alvos: venenoEm });
        if (renovar && vivos().length) {
          const de = herois.get(renovar.de);
          const alvos: Alvo[] = [];
          for (const h of vivos()) {
            const cura = Math.min(atributos(h).hpMax - h.hp, Math.round(atributos(h).hpMax * 0.08));
            h.hp += cura;
            if (de) de.pontos += cura;
            alvos.push({ quem: { h: h.userId }, cura });
          }
          evento({ tipo: 'renovar', de: { h: renovar.de }, alvos });
          if (--renovar.rodadas <= 0) renovar = null;
        }
        for (const i of inimigosVivos()) {
          if (i.traco !== 'regenera' || i.hp >= i.hpMax) continue;
          const cura = Math.min(i.hpMax - i.hp, Math.round(i.hpMax * 0.06));
          i.hp += cura;
          evento({ tipo: 'regenera', de: { i: i.id }, alvos: [{ quem: { i: i.id }, cura }] });
        }
        if (rapidez > 0) rapidez--;
      };

      const resolver = () => {
        if (fase !== 'escolha') return;
        eventos = [];
        muralha = false;
        // o que vale desde o começo da rodada: defender, proteger, provocar e a muralha (e já pagam a energia)
        for (const h of vivos()) {
          const k = h.escolha?.hab ?? 0;
          const habEscudo = h.escolha?.acao === 'habilidade' && h.classe === 'escudo' && k < 3 && podeUsar(h, k);
          h.defendendo = h.escolha?.acao === 'defender';
          h.protegendo = habEscudo && k === 0;
          h.provocando = habEscudo && k === 1;
          if (habEscudo) {
            h.en -= HABILIDADES.escudo[k].custo;
            if (k === 2) muralha = true;
            evento({ tipo: 'habilidade', hab: HABILIDADES.escudo[k].id, de: { h: h.userId }, alvos: k === 2 ? vivos().map((x) => ({ quem: { h: x.userId } })) : [] });
          }
          if (h.defendendo) evento({ tipo: 'defender', de: { h: h.userId }, alvos: [] });
        }
        // o combo: quem o escolheu e tem energia; com dois ou mais, age na vez do mais rápido
        const noCombo = vivos().filter((h) => h.escolha?.acao === 'combo' && h.en >= CUSTO_DO_COMBO);
        const combo = noCombo.length >= 2 ? noCombo : [];
        const alvoDoCombo = combo.length ? (combo.find((h) => !ehRobo(h.userId))?.escolha?.alvo ?? combo[0].escolha!.alvo) : null;
        // a ordem: pela velocidade, com um pouco de sorte (a turma acelerada vai antes)
        const pressa = rapidez > 0 ? 5 : 0;
        const fila: { vel: number; agir: () => void }[] = [];
        let comboNaFila = false;
        for (const h of vivos()) {
          if (combo.includes(h)) {
            if (comboNaFila) continue;
            comboNaFila = true;
            fila.push({ vel: Math.max(...combo.map((x) => atributos(x).vel)) + pressa + aleatorio() * 3, agir: () => agirCombo(combo, alvoDoCombo) });
            continue;
          }
          fila.push({ vel: atributos(h).vel + pressa + aleatorio() * 3, agir: () => agirHeroi(h) });
        }
        for (const i of inimigosVivos()) {
          fila.push({ vel: i.vel + aleatorio() * 3, agir: () => agirInimigo(i) });
          // o ligeiro age duas vezes (a segunda, mais para o fim da rodada)
          if (i.traco === 'ligeiro') fila.push({ vel: i.vel * 0.4 + aleatorio() * 3, agir: () => agirInimigo(i) });
        }
        embaralhar(fila, aleatorio).sort((a, b) => b.vel - a.vel);
        for (const f of fila) {
          if (!inimigosVivos().length || !vivos().length) break;
          f.agir();
        }
        if (inimigosVivos().length && vivos().length) fimDaRodada();
        // a energia volta um pouco a cada rodada (mais a quem se defendeu)
        for (const h of vivos()) h.en = Math.min(atributos(h).enMax, h.en + (h.defendendo ? 2 : 1));
        resolucao++;
        fase = 'acao';
        ritmo = solo && acelerado ? 0.5 : 1;
        ctx.agendar(noRitmo(ACAO_FOLGA_MS + eventos.length * EVENTO_MS), depoisDaAcao);
        ctx.avisar();
      };

      const depoisDaAcao = () => {
        if (fase !== 'acao') return;
        if (!vivos().length || rodada >= RODADAS_MAX) return fim(false);
        if (inimigosVivos().length) return novaRodada();
        if (paradaAtual().tipo === 'chefe') return fim(true);
        // a luta acabou: quem caiu levanta com um pouco de vida, a energia enche, e o nível sobe
        for (const h of herois.values()) {
          const a = atributos(h);
          if (h.hp <= 0) h.hp = Math.round(a.hpMax * 0.3);
          h.en = a.enMax;
          h.defendendo = h.protegendo = h.provocando = false;
          h.escolha = null;
          h.veneno = null;
          h.nivel++;
        }
        abrirEspolio();
      };

      // ---------------- O EQUIPAMENTO ----------------
      const vestirPeca = (h: Heroi, item: Item) => {
        const antes = atributos(h).hpMax;
        h.equip[item.peca] = item.valor;
        h.hp = Math.max(1, h.hp + atributos(h).hpMax - antes);
      };
      const aplicarMelhoria = (h: Heroi, m: Melhoria) => {
        const antes = atributos(h);
        for (const [k, v] of Object.entries(MELHORIAS[m]) as [keyof Bonus, number][]) h.bonus[k] += v;
        const depois = atributos(h);
        h.hp = Math.max(1, h.hp + depois.hpMax - antes.hpMax);
        h.en = Math.min(depois.enMax, h.en + depois.enMax - antes.enMax);
        h.melhorias.push(m);
      };

      // ---------------- O ESPÓLIO E O NÍVEL ----------------
      const abrirEspolio = () => {
        fase = 'espolio';
        espolio = new Map();
        ofertas = new Map();
        decidiram.clear();
        melhorou.clear();
        peloRobo.clear();
        for (const id of ordem) {
          const peca = PECAS[Math.floor(aleatorio() * PECAS.length)];
          // a peça melhora com o caminho: a da neve é melhor que a da floresta
          espolio.set(id, { peca, valor: valorDaPeca(peca, parada, aleatorio()) });
          const h = herois.get(id)!;
          ofertas.set(id, embaralhar([...MELHORIAS_DA_CLASSE[h.classe ?? 'escudo']], aleatorio).slice(0, 2));
        }
        for (const id of ordem) if (ehRobo(id) || !presente(id)) decidirTudo(id);
        ctx.agendar(relogio(TEMPO_DO_ESPOLIO), fecharEspolio);
        if (!conferirEspolio()) ctx.avisar();
      };
      /** `equipar` null: o robô decide (veste se é melhor). */
      const decidirEspolio = (id: number, equipar: boolean | null) => {
        if (decidiram.has(id)) return;
        const h = herois.get(id)!;
        const item = espolio.get(id)!;
        if (equipar === null && !ehRobo(id)) peloRobo.add(id);
        if (equipar ?? item.valor > h.equip[item.peca]) vestirPeca(h, item);
        decidiram.add(id);
      };
      /** `k` null: o robô escolhe (a primeira da ordem de preferência da classe). */
      const decidirMelhoria = (id: number, k: number | null) => {
        if (melhorou.has(id)) return;
        const h = herois.get(id)!;
        const oferta = ofertas.get(id)!;
        const pref = MELHORIAS_DA_CLASSE[h.classe ?? 'escudo'];
        const m = k === null ? [...oferta].sort((a, b) => pref.indexOf(a) - pref.indexOf(b))[0] : oferta[k];
        aplicarMelhoria(h, m);
        melhorou.add(id);
      };
      const decidirTudo = (id: number) => {
        decidirEspolio(id, null);
        decidirMelhoria(id, null);
      };
      const conferirEspolio = () => {
        if (fase !== 'espolio') return false;
        for (const id of humanos) if (!presente(id)) decidirTudo(id);
        if (ordem.every((id) => decidiram.has(id) && melhorou.has(id))) {
          seguir();
          return true;
        }
        return false;
      };
      const fecharEspolio = () => {
        if (fase !== 'espolio') return;
        for (const id of ordem) decidirTudo(id);
        conferirEspolio();
      };

      // ---------------- A LOJA ----------------
      const abrirLoja = () => {
        fase = 'loja';
        vitrine = new Map();
        decidiram.clear();
        peloRobo.clear();
        for (const id of ordem) vitrine.set(id, PECAS.map((peca) => ({ peca, valor: valorDaPeca(peca, parada + 1, aleatorio()) })));
        for (const id of ordem) if (ehRobo(id) || !presente(id)) decidirLoja(id, null);
        ctx.agendar(relogio(TEMPO_DA_LOJA), fecharLoja);
        if (!conferirLoja()) ctx.avisar();
      };
      /** `k` null: o robô leva a peça que mais melhora (em proporção); -1: não leva nada. */
      const decidirLoja = (id: number, k: number | null) => {
        if (decidiram.has(id)) return;
        const h = herois.get(id)!;
        const itens = vitrine.get(id)!;
        if (k === null && !ehRobo(id)) peloRobo.add(id);
        const ganho = (x: Item) => (x.valor - h.equip[x.peca]) / (x.peca === 'amuleto' ? 4 : 1);
        const escolhido = k === null ? [...itens].sort((a, b) => ganho(b) - ganho(a))[0] : k >= 0 ? itens[k] : undefined;
        if (escolhido && (k !== null || ganho(escolhido) > 0)) vestirPeca(h, escolhido);
        decidiram.add(id);
      };
      const conferirLoja = () => {
        if (fase !== 'loja') return false;
        for (const id of humanos) if (!presente(id)) decidirLoja(id, null);
        if (ordem.every((id) => decidiram.has(id))) {
          seguir();
          return true;
        }
        return false;
      };
      const fecharLoja = () => {
        if (fase !== 'loja') return;
        for (const id of ordem) decidirLoja(id, null);
        conferirLoja();
      };

      // ---------------- O FIM ----------------
      const fim = (ganhou: boolean) => {
        fase = 'fim';
        venceu = ganhou;
        const ficaram = humanos.filter(presente);
        const linhas = ordem
          .map((id) => ({ userId: id, username: ctx.nome(id), pontos: herois.get(id)!.pontos }))
          .sort((a, b) => b.pontos - a.pontos || a.username.localeCompare(b.username));
        // a posição só entre quem é gente e ficou até o fim (empatados dividem); robôs e quem saiu ficam sem
        const contam = linhas.filter((l) => ficaram.includes(l.userId));
        resultado = linhas.map((l) => ({
          ...l,
          posicao: contam.includes(l) ? 1 + contam.filter((o) => o.pontos > l.pontos).length : null,
        }));
        // O RECORDE DO SOLO: as rodadas que o SERVIDOR contou, da primeira luta ao dragão
        if (ganhou && solo && servicos?.guardarRecorde && ficaram.length) {
          const r = servicos.guardarRecorde(humanos[0], rodadasTotais, { tempoMs: agora() - inicio });
          recorde = { valor: rodadasTotais, ...r };
        }
        // O PÓDIO: o dragão vencido, 2 pessoas ou mais que ficaram, até o 3º, fora do Solo
        if (ganhou && !solo && contam.length >= 2 && servicos) {
          const evento_ = `lendas-${ctx.comunidade ?? 0}-${agora()}`;
          for (const l of resultado) {
            if (l.posicao === null || l.posicao > 3) continue;
            servicos.guardarTrofeu({
              userId: l.userId,
              evento: evento_,
              communityId: ctx.comunidade ?? 0,
              pista: 'lendas',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: contam.map((o) => o.userId).filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar(true);
      };

      // ---------------- O COMEÇO ----------------
      ctx.agendar(relogio(TEMPO_DA_CLASSE), fecharClasses);

      const jogo: Jogo & Record<string, unknown> = {
        publico(quem) {
          const meu = herois.get(quem);
          const p = paradaAtual();
          return {
            partidaId,
            fase,
            parada,
            semente,
            // o caminho: as opções de cada passo e a escolhida
            rota: caminho.passos.map((opcoes, k) => ({
              opcoes: opcoes.map((id) => ({ id, tipo: PARADAS[id].tipo })),
              escolhida: escolhidas[k],
            })),
            cenario: p.cenario,
            tipoDaParada: p.tipo,
            evento: fase === 'evento' ? caminho.evento : null,
            rumo: fase === 'rumo' ? { opcoes: caminho.passos[parada], votos: Object.fromEntries(votosDoRumo) } : null,
            rodada,
            rodadasTotais,
            resolucao,
            venceu,
            rapidez: rapidez > 0,
            // o botão de acelerar (só no Solo) e o ritmo da rodada que está sendo tocada (1, ou 0.5 acelerada)
            acelerado: solo && acelerado,
            ritmo,
            herois: ordem.map((id) => {
              const h = herois.get(id)!;
              const a = atributos(h);
              return {
                userId: id,
                username: ctx.nome(id),
                avatar: avatares.get(id) ?? null,
                robo: ehRobo(id),
                presente: ehRobo(id) || presente(id),
                classe: h.classe,
                hp: h.hp,
                hpMax: a.hpMax,
                en: h.en,
                enMax: a.enMax,
                atk: a.atk,
                mag: a.mag,
                def: a.def,
                vel: a.vel,
                nivel: h.nivel,
                melhorias: h.melhorias,
                habilidades: habilidadesDe(h).map((d) => ({ id: d.id, custo: d.custo, alvo: d.alvo })),
                envenenado: !!h.veneno,
                equip: h.equip,
                pontos: h.pontos,
                // os outros só sabem SE escolheu; a ação de cada um aparece quando a rodada se resolve (como numa mesa)
                escolheu:
                  fase === 'escolha'
                    ? !!h.escolha
                    : fase === 'espolio'
                      ? decidiram.has(id) && melhorou.has(id)
                      : fase === 'loja'
                        ? decidiram.has(id)
                        : fase === 'rumo'
                          ? votosDoRumo.has(id)
                          : !!h.classe,
                peloRobo: peloRobo.has(id),
                // o combo é a exceção: a turma precisa ver quem chamou, para ir junto
                noCombo: fase === 'escolha' && h.escolha?.acao === 'combo',
                alvoDoCombo: fase === 'escolha' && h.escolha?.acao === 'combo' ? h.escolha.alvo : null,
              };
            }),
            inimigos: inimigos.map((i) => ({
              id: i.id,
              tipo: i.tipo,
              hp: i.hp,
              hpMax: i.hpMax,
              chefe: i.chefe,
              traco: i.traco,
              tonto: i.tonto,
              preparando: i.preparando,
              envenenado: !!i.veneno,
            })),
            eventos,
            minhaEscolha: meu?.escolha ?? null,
            meuEspolio:
              fase === 'espolio' && meu
                ? { item: espolio.get(quem) ?? null, atual: meu.equip, decidi: decidiram.has(quem), melhorias: ofertas.get(quem) ?? [], melhorei: melhorou.has(quem) }
                : null,
            minhaLoja: fase === 'loja' && meu ? { itens: vitrine.get(quem) ?? [], atual: meu.equip, decidi: decidiram.has(quem) } : null,
            resultado,
            recorde: fase === 'fim' ? recorde : null,
          };
        },

        acao(quem, corpo) {
          const h = herois.get(quem);
          if (!h || ehRobo(quem)) return 'Você está assistindo esta partida.';
          const tipo = corpo.tipo;
          if (tipo === 'classe') {
            if (fase !== 'classes') return 'Agora não dá.';
            const c = corpo.classe as Classe;
            if (!CLASSES.includes(c)) return 'Agora não dá.';
            vestir(h, c);
            if (humanos.every((id) => herois.get(id)!.classe)) fecharClasses();
            else ctx.avisar();
            return null;
          }
          if (tipo === 'acelerar') {
            // só no Solo: na sala, a turma assiste junta, e ninguém acelera a tela dos outros
            if (!solo) return 'Agora não dá.';
            acelerado = corpo.ligado === true;
            ctx.avisar();
            return null;
          }
          if (tipo === 'rumo') {
            const lado = corpo.lado;
            if (fase !== 'rumo' || (lado !== 0 && lado !== 1)) return 'Agora não dá.';
            votosDoRumo.set(quem, lado);
            if (!conferirRumo()) ctx.avisar();
            return null;
          }
          if (tipo === 'acao') {
            if (fase !== 'escolha' || h.hp <= 0) return 'Agora não dá.';
            const acao = corpo.acao as Acao;
            if (!ACOES.includes(acao)) return 'Agora não dá.';
            const alvo = Number.isInteger(corpo.alvo) ? (corpo.alvo as number) : null;
            const k = acao === 'habilidade' ? (Number.isInteger(corpo.hab) ? (corpo.hab as number) : 0) : undefined;
            const def = k === undefined || !h.classe ? undefined : HABILIDADES[h.classe][k];
            if (acao === 'habilidade') {
              if (!def || def.nivel > h.nivel) return 'Agora não dá.';
              if (h.en < def.custo) return 'Sem energia.';
            }
            if (acao === 'combo' && h.en < CUSTO_DO_COMBO) return 'Sem energia.';
            if ((acao === 'atacar' || acao === 'combo' || def?.alvo === 'inimigo') && !inimigos.some((i) => i.id === alvo && i.hp > 0)) {
              return 'Agora não dá.';
            }
            h.escolha = { acao, alvo, ...(k !== undefined ? { hab: k } : {}) };
            peloRobo.delete(quem);
            if (acao === 'combo') atenderCombo(h);
            if (!conferirEscolhas()) ctx.avisar();
            return null;
          }
          if (tipo === 'espolio') {
            if (fase !== 'espolio' || decidiram.has(quem)) return 'Agora não dá.';
            decidirEspolio(quem, corpo.equipar === true);
            if (!conferirEspolio()) ctx.avisar();
            return null;
          }
          if (tipo === 'melhoria') {
            const k = corpo.escolha;
            if (fase !== 'espolio' || melhorou.has(quem) || (k !== 0 && k !== 1)) return 'Agora não dá.';
            decidirMelhoria(quem, k);
            if (!conferirEspolio()) ctx.avisar();
            return null;
          }
          if (tipo === 'loja') {
            const k = corpo.item;
            if (fase !== 'loja' || decidiram.has(quem) || !Number.isInteger(k) || (k as number) < -1 || (k as number) > 2) return 'Agora não dá.';
            decidirLoja(quem, k as number);
            if (!conferirLoja()) ctx.avisar();
            return null;
          }
          return 'Agora não dá.';
        },

        conferir() {
          if (fase === 'classes') conferirClasses();
          else if (fase === 'escolha') conferirEscolhas();
          else if (fase === 'espolio') conferirEspolio();
          else if (fase === 'loja') conferirLoja();
          else if (fase === 'rumo') conferirRumo();
        },

        // para o teste
        _herois: herois,
        _inimigos: () => inimigos,
        _caminho: caminho,
        _escolhidas: escolhidas,
      };
      return jogo;
    },
  };
}
