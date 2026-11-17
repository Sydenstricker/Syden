/**
 * BICHOS DA TOCA (16/11/2026): as REGRAS e os DADOS, num arquivo só, em duas cópias iguais byte a byte
 * (server/src/bichos-regras.ts ↔ web/src/bichos/regras.ts; o teste do servidor confere). O servidor decide tudo com elas
 * (o mato, a luta, a amizade, a sorte); o site só as usa para DESENHAR o mapa e dizer o que cada golpe e cada bicho é.
 *
 * SÓ A MECÂNICA DO GÊNERO (andar pelo campo, o mato alto, enfraquecer e fazer amizade, a equipe de seis, os elementos, o nível
 * e a evolução, o desafio da casa). Nada de nome, bicho, desenho, tabela ou palavra de franquia nenhuma: os elementos e a
 * roda de vantagens são nossos, os bichos são os monstros da Quaternius (CC0) que a Briga já tinha, e a amizade é com uma
 * cenoura, nunca uma bola.
 *
 * OS NOMES DOS BICHOS SÃO NOMES PRÓPRIOS INVENTADOS (Brotel, Tisco…), IGUAIS EM TODO IDIOMA, como o nome de uma pessoa: não
 * passam pelo t(). Os elementos e os golpes, sim (as chaves são as palavras em português, várias já traduzidas para o Desenha
 * e adivinha, e por isso a tela usa a primeira forma: "Raio" é "Lightning|Thunderbolt" em inglês).
 *
 * Sem import nenhum, de propósito: o arquivo é o mesmo nos dois lados.
 */

// ---------------- OS ELEMENTOS ----------------
export type Elemento = 'folha' | 'brasa' | 'gota' | 'pedra' | 'vento' | 'faisca' | 'nenhum';
export const ELEMENTOS: Exclude<Elemento, 'nenhum'>[] = ['folha', 'brasa', 'gota', 'pedra', 'vento', 'faisca'];

/**
 * A RODA DAS VANTAGENS: cada elemento vence outros dois (o golpe dele vale o dobro contra eles, e o deles vale a metade contra
 * ele). Pensada pela imagem de cada um, e não copiada de lugar nenhum:
 * a folha bebe a gota e racha a pedra com a raiz; a brasa queima a folha e se aviva com o vento; a gota apaga a brasa e gasta
 * a pedra; a pedra abafa a brasa e aterra a faísca; a faísca corre pela gota e corta o vento; o vento espalha a folha e
 * desgasta a pedra. O equilíbrio é chute (a pedra apanha de três; a faísca, de um).
 */
export const VENCE: Record<Exclude<Elemento, 'nenhum'>, Elemento[]> = {
  folha: ['gota', 'pedra'],
  brasa: ['folha', 'vento'],
  gota: ['brasa', 'pedra'],
  pedra: ['brasa', 'faisca'],
  faisca: ['gota', 'vento'],
  vento: ['folha', 'pedra'],
};

/** Quanto um golpe de `ataque` vale contra um bicho de `defesa`: 2, 1 ou 0,5. */
export function eficacia(ataque: Elemento, defesa: Elemento): number {
  if (ataque === 'nenhum' || defesa === 'nenhum') return 1;
  if (VENCE[ataque].includes(defesa)) return 2;
  if (VENCE[defesa as Exclude<Elemento, 'nenhum'>].includes(ataque)) return 0.5;
  return 1;
}

// ---------------- OS GOLPES ----------------
/** O nome é a chave da tradução (o site chama t() com ela). */
export const GOLPES: Record<string, { nome: string; elemento: Elemento; poder: number }> = {
  investida: { nome: 'Investida', elemento: 'nenhum', poder: 40 },
  semente: { nome: 'Semente', elemento: 'folha', poder: 40 },
  cipo: { nome: 'Cipó', elemento: 'folha', poder: 65 },
  fogo: { nome: 'Fogo', elemento: 'brasa', poder: 40 },
  vulcao: { nome: 'Vulcão', elemento: 'brasa', poder: 65 },
  chuva: { nome: 'Chuva', elemento: 'gota', poder: 40 },
  onda: { nome: 'Onda', elemento: 'gota', poder: 65 },
  pedrada: { nome: 'Pedrada', elemento: 'pedra', poder: 40 },
  avalanche: { nome: 'Avalanche', elemento: 'pedra', poder: 65 },
  sopro: { nome: 'Sopro', elemento: 'vento', poder: 40 },
  tornado: { nome: 'Tornado', elemento: 'vento', poder: 65 },
  choque: { nome: 'Choque', elemento: 'faisca', poder: 40 },
  raio: { nome: 'Raio', elemento: 'faisca', poder: 65 },
};

// ---------------- OS BICHOS ----------------
export interface Especie {
  /** O nome próprio, igual em todo idioma. */
  nome: string;
  elemento: Exclude<Elemento, 'nenhum'>;
  /** A folha de desenhos da Briga (web/public/briga/<fase>/<desenho>.png). */
  desenho: string;
  base: { pv: number; atq: number; def: number; vel: number };
  /** A chance de amizade com a vida cheia é taxa × 0,25; perto de zero, quase a taxa inteira. */
  taxa: number;
  /** A experiência que ele dá ao pegar no sono (vezes o nível, dividido por 5). */
  xp: number;
  /** [nível, golpe]: o bicho sabe os últimos 4 que já aprendeu no nível dele. */
  aprende: [number, string][];
  evolui?: { nivel: number; para: string };
}

export const ESPECIES: Record<string, Especie> = {
  // os três do começo
  brotel: { nome: 'Brotel', elemento: 'folha', desenho: 'cogumelo', base: { pv: 48, atq: 50, def: 52, vel: 44 }, taxa: 0.5, xp: 55,
    aprende: [[1, 'investida'], [1, 'semente'], [6, 'pedrada'], [9, 'cipo']], evolui: { nivel: 10, para: 'brotelao' } },
  brotelao: { nome: 'Brotelão', elemento: 'folha', desenho: 'rei-cogumelo', base: { pv: 72, atq: 74, def: 76, vel: 56 }, taxa: 0.2, xp: 120,
    aprende: [[1, 'investida'], [1, 'semente'], [6, 'pedrada'], [9, 'cipo'], [14, 'avalanche']] },
  tisco: { nome: 'Tisco', elemento: 'brasa', desenho: 'diabinho', base: { pv: 42, atq: 56, def: 44, vel: 64 }, taxa: 0.5, xp: 55,
    aprende: [[1, 'investida'], [1, 'fogo'], [6, 'sopro'], [9, 'vulcao']] },
  bolhim: { nome: 'Bolhim', elemento: 'gota', desenho: 'sapo', base: { pv: 50, atq: 50, def: 56, vel: 46 }, taxa: 0.5, xp: 55,
    aprende: [[1, 'investida'], [1, 'chuva'], [6, 'choque'], [9, 'onda']] },
  // o mato baixo, perto de casa
  zunzi: { nome: 'Zunzi', elemento: 'vento', desenho: 'abelha', base: { pv: 38, atq: 44, def: 34, vel: 70 }, taxa: 0.7, xp: 40,
    aprende: [[1, 'investida'], [1, 'sopro'], [11, 'tornado']] },
  pruvi: { nome: 'Pruvi', elemento: 'vento', desenho: 'corvo', base: { pv: 42, atq: 44, def: 40, vel: 60 }, taxa: 0.75, xp: 40,
    aprende: [[1, 'investida'], [1, 'sopro'], [8, 'chuva']] },
  miasso: { nome: 'Miasso', elemento: 'faisca', desenho: 'raposa', base: { pv: 40, atq: 50, def: 38, vel: 68 }, taxa: 0.6, xp: 45,
    aprende: [[1, 'investida'], [1, 'choque'], [11, 'raio']] },
  rochim: { nome: 'Rochim', elemento: 'pedra', desenho: 'golem', base: { pv: 50, atq: 54, def: 70, vel: 25 }, taxa: 0.55, xp: 45,
    aprende: [[1, 'investida'], [1, 'pedrada'], [11, 'avalanche']] },
  // o mato alto, lá em cima
  cardao: { nome: 'Cardão', elemento: 'folha', desenho: 'cacto', base: { pv: 55, atq: 60, def: 64, vel: 35 }, taxa: 0.45, xp: 60,
    aprende: [[1, 'investida'], [1, 'semente'], [7, 'pedrada'], [9, 'cipo']] },
  dinito: { nome: 'Dinito', elemento: 'brasa', desenho: 'dino', base: { pv: 54, atq: 64, def: 50, vel: 50 }, taxa: 0.45, xp: 60,
    aprende: [[1, 'investida'], [1, 'fogo'], [7, 'pedrada'], [10, 'vulcao']] },
  vultim: { nome: 'Vultim', elemento: 'gota', desenho: 'fantasma', base: { pv: 50, atq: 56, def: 48, vel: 62 }, taxa: 0.45, xp: 60,
    aprende: [[1, 'chuva'], [5, 'sopro'], [9, 'onda']] },
  ventrolo: { nome: 'Ventrolo', elemento: 'vento', desenho: 'redemoinho', base: { pv: 48, atq: 60, def: 44, vel: 76 }, taxa: 0.4, xp: 60,
    aprende: [[1, 'sopro'], [7, 'choque'], [9, 'tornado']] },
  // os da Nena, na casa do desafio
  galoca: { nome: 'Galoça', elemento: 'pedra', desenho: 'texugo', base: { pv: 66, atq: 62, def: 68, vel: 40 }, taxa: 0, xp: 90,
    aprende: [[1, 'investida'], [1, 'pedrada'], [7, 'sopro'], [10, 'avalanche']] },
  macalu: { nome: 'Macalu', elemento: 'faisca', desenho: 'macaco', base: { pv: 58, atq: 64, def: 52, vel: 70 }, taxa: 0, xp: 90,
    aprende: [[1, 'investida'], [1, 'choque'], [8, 'pedrada'], [10, 'raio']] },
  dragolim: { nome: 'Dragolim', elemento: 'brasa', desenho: 'dragao', base: { pv: 72, atq: 74, def: 66, vel: 60 }, taxa: 0, xp: 120,
    aprende: [[1, 'investida'], [1, 'fogo'], [8, 'sopro'], [11, 'vulcao']] },
};

export const INICIAIS = ['brotel', 'tisco', 'bolhim'] as const;
/** O nível de quem começa. */
export const NIVEL_INICIAL = 5;
export const NIVEL_MAXIMO = 50;
export const TAMANHO_DA_EQUIPE = 6;
/** A cesta de quem sai de casa: cenouras para a amizade e chá para a vida. */
export const CESTA = { cenouras: 5, chas: 3 };
/** Quanto o chá devolve. */
export const CURA_DO_CHA = 20;

/** O nome de quem cuida da casa do desafio: nome próprio, igual em todo idioma. */
export const DESAFIANTE = 'Nena';
export const EQUIPE_DO_DESAFIO: [string, number][] = [['galoca', 7], ['macalu', 8], ['dragolim', 9]];

/** A equipe de quem chega à sala sem bicho nenhum: os três do começo, no mesmo nível, para a luta ser justa. */
export const EQUIPE_EMPRESTADA: [string, number][] = [['brotel', 9], ['tisco', 9], ['bolhim', 9]];

// ---------------- AS CONTAS ----------------
export interface Atributos {
  pvMax: number;
  atq: number;
  def: number;
  vel: number;
}

export function atributos(especie: string, nivel: number): Atributos {
  const b = ESPECIES[especie].base;
  const de = (x: number) => Math.floor((2 * x * nivel) / 100) + 5;
  return { pvMax: Math.floor((2 * b.pv * nivel) / 100) + nivel + 10, atq: de(b.atq), def: de(b.def), vel: de(b.vel) };
}

/** Os golpes que ele sabe no nível: os últimos 4 aprendidos. */
export function golpesDe(especie: string, nivel: number): string[] {
  const sabe: string[] = [];
  for (const [n, g] of ESPECIES[especie].aprende) if (n <= nivel && !sabe.includes(g)) sabe.push(g);
  return sabe.slice(-4);
}

/** A experiência que leva a cada nível (a total, desde o 1). */
export const xpDoNivel = (nivel: number) => 4 * nivel * nivel;

export function nivelDaXp(xp: number): number {
  let n = 1;
  while (n < NIVEL_MAXIMO && xpDoNivel(n + 1) <= xp) n++;
  return n;
}

/** A experiência que um bicho dá ao pegar no sono. No desafio, metade a mais. */
export const xpGanha = (especie: string, nivel: number, desafio: boolean) =>
  Math.floor(((ESPECIES[especie].xp * nivel) / 5) * (desafio ? 1.5 : 1));

/**
 * O DANO: a fórmula comum ao gênero (o nível, o poder do golpe, o ataque contra a defesa), vezes a vantagem do elemento,
 * vezes 1,25 quando o golpe é do elemento do próprio bicho, vezes a sorte (de 0,85 a 1). Pelo menos 1.
 */
export function dano(atacante: { especie: string; nivel: number; atq: number }, defensor: { especie: string; def: number }, golpe: string, sorte: number): number {
  const g = GOLPES[golpe];
  const base = (((2 * atacante.nivel) / 5 + 2) * g.poder * (atacante.atq / defensor.def)) / 50 + 2;
  const mesmo = g.elemento === ESPECIES[atacante.especie].elemento ? 1.25 : 1;
  return Math.max(1, Math.floor(base * eficacia(g.elemento, ESPECIES[defensor.especie].elemento) * mesmo * (0.85 + 0.15 * sorte)));
}

/** A chance de a amizade dar certo com a cenoura: maior quanto mais cansado o bicho está. */
export function chanceDeAmizade(especie: string, pv: number, pvMax: number): number {
  const taxa = ESPECIES[especie].taxa;
  if (taxa <= 0) return 0;
  return Math.min(0.95, Math.max(0.05, taxa * (1 - (0.75 * pv) / pvMax)));
}

// ---------------- O MAPA ----------------
/**
 * O campo, visto de cima, numa grade de 24 × 16. T árvore, r pedra, ~ lagoa e as paredes das casas (H, C) não deixam passar;
 * . grama, f flores e = caminho, sim. No " (o mato baixo, perto de casa) e no ; (o mato alto, lá em cima) os bichos aparecem.
 * h é a porta de casa (descansar e encher a cesta) e c a porta da casa do desafio.
 */
export const MAPA = [
  'TTTTTTTTTTTTTTTTTTTTTTTT',
  'T;;;;;;;.....T...CCCCC.T',
  'T;;;;;;;..f..T...CCCCC.T',
  'T;;;;;;;.........CCcCC.T',
  'T..;;;.....========....T',
  'T.......f..=......=..r.T',
  'T..TT......=..~~~.=....T',
  'T..TT......=..~~~.=..f.T',
  'T"""""""...=..~~~.=....T',
  'T""""""""..=......=....T',
  'T""""""""..====.=====..T',
  'T.HHH.""""....=.....rr.T',
  'T.HHH..""".f..=...f....T',
  'T.HhH.........=........T',
  'T.....=========........T',
  'TTTTTTTTTTTTTTTTTTTTTTTT',
];
export const LARGURA_DO_MAPA = 24;
export const ALTURA_DO_MAPA = 16;
/** Onde se começa e para onde se volta depois de todos pegarem no sono: na frente da porta de casa. */
export const CASA = { x: 3, y: 14 };

export const casaDoMapa = (x: number, y: number) => (y >= 0 && y < ALTURA_DO_MAPA && x >= 0 && x < LARGURA_DO_MAPA ? MAPA[y][x] : 'T');
export const andavel = (x: number, y: number) => !'Tr~HC'.includes(casaDoMapa(x, y));

/** Quem aparece em cada mato, e de que nível a que nível. */
export const MATOS: Record<string, { especies: string[]; de: number; ate: number }> = {
  '"': { especies: ['zunzi', 'pruvi', 'miasso', 'rochim'], de: 2, ate: 5 },
  ';': { especies: ['cardao', 'dinito', 'vultim', 'ventrolo', 'miasso'], de: 5, ate: 9 },
};
/** A chance de um bicho aparecer a cada passo no mato. */
export const CHANCE_NO_MATO = 0.15;

/** As direções de um passo. */
export const DIRECOES: Record<string, [number, number]> = { c: [0, -1], b: [0, 1], e: [-1, 0], d: [1, 0] };
