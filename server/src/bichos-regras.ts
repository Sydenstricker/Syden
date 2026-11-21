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
 * e adivinha, e por isso a tela usa a primeira forma: "Raio" é "Lightning|Thunderbolt" em inglês). As pessoas do caminho e as
 * desafiantes também têm nome próprio, igual em todo idioma.
 *
 * 19/11/2026 (a auditoria dos mini-games): os golpes com EFEITO (a precisão, o cochilo, baixar o ataque ou a defesa, a cura de
 * si, o golpe que vai primeiro e o veneno leve), a EVOLUÇÃO de metade das espécies (a mesma folha da Briga, maior e com outra
 * cor, ou outra folha), mais duas telas de mapa (o Bosque e a Serra, passando pela borda), as pessoas no caminho, a ESCADA de
 * quatro desafiantes até o nível ~30, os achados no chão, a lojinha (moedas do jogo, nunca dinheiro) e o pós-jogo (a revanche
 * da Nena e o bicho raro). E na sala, todos lutam no mesmo nível (NIVEL_DA_SALA).
 *
 * 20/11/2026 (lote C da segunda auditoria): o chá cura uma PARTE da vida (e não 20 fixos), a lojinha abre itens pela escada
 * (LOJA_ABRE: a erva-doce, o chá forte, a cenoura dourada), o mato do Bosque e da Serra escolhe o golpe com esperteza
 * (`esperto` no mapa), o caderno fecha (os do começo não escolhidos aparecem raros na Serra depois da escada, e a Nena dá os
 * bichos dela a quem vence a revanche: `alcancaveis`), o golpe novo é escolhido (`golpesNovos`), e na sala cada um leva até 3
 * bichos na forma crescida (`formaCrescida`).
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
/**
 * O efeito de um golpe (19/11/2026): `em` é quem o recebe (o próprio bicho ou o da frente do outro lado).
 * - cochilo: o bicho cochila 1 ou 2 vezes e não golpeia (é leve: não é o "pegar no sono" de quem cansou);
 * - veneno: perde 1/12 da vida no fim de cada turno, até a luta acabar;
 * - atq / def: sobe ou desce um degrau (de −3 a +3; cada degrau vale meio a mais, ou tira um terço);
 * - cura: devolve `valor` da vida cheia.
 * Um bicho só tem um estado por vez (cochilo ou veneno). `chance`: a chance de o efeito pegar (sem ela, sempre).
 */
export type TipoDeEfeito = 'cochilo' | 'veneno' | 'atq' | 'def' | 'cura';
export interface EfeitoDoGolpe {
  tipo: TipoDeEfeito;
  em: 'eu' | 'outro';
  valor?: number;
  chance?: number;
}
export interface DadosDoGolpe {
  /** O nome é a chave da tradução (o site chama t() com ela). */
  nome: string;
  elemento: Elemento;
  /** 0: golpe de apoio (não tira vida, só o efeito). */
  poder: number;
  /** A chance de acertar (sem ela, sempre acerta). */
  precisao?: number;
  /** 1: vai antes dos outros golpes do turno. */
  prioridade?: number;
  efeito?: EfeitoDoGolpe;
}

export const GOLPES: Record<string, DadosDoGolpe> = {
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
  // os de 19/11/2026: dois ou três de apoio por elemento
  espinho: { nome: 'Espinho', elemento: 'folha', poder: 20, efeito: { tipo: 'veneno', em: 'outro' } },
  polen: { nome: 'Pólen', elemento: 'folha', poder: 0, precisao: 0.75, efeito: { tipo: 'cochilo', em: 'outro' } },
  raiz: { nome: 'Raiz', elemento: 'folha', poder: 0, efeito: { tipo: 'cura', em: 'eu', valor: 0.5 } },
  calor: { nome: 'Calor', elemento: 'brasa', poder: 0, efeito: { tipo: 'def', em: 'outro', valor: -1 } },
  labareda: { nome: 'Labareda', elemento: 'brasa', poder: 90, precisao: 0.75 },
  neblina: { nome: 'Neblina', elemento: 'gota', poder: 0, efeito: { tipo: 'atq', em: 'outro', valor: -1 } },
  orvalho: { nome: 'Orvalho', elemento: 'gota', poder: 0, efeito: { tipo: 'cura', em: 'eu', valor: 0.5 } },
  casca: { nome: 'Casca', elemento: 'pedra', poder: 0, efeito: { tipo: 'def', em: 'eu', valor: 1 } },
  tremor: { nome: 'Tremor', elemento: 'pedra', poder: 90, precisao: 0.8 },
  rajada: { nome: 'Rajada', elemento: 'vento', poder: 40, prioridade: 1 },
  assobio: { nome: 'Assobio', elemento: 'vento', poder: 0, precisao: 0.6, efeito: { tipo: 'cochilo', em: 'outro' } },
  estalo: { nome: 'Estalo', elemento: 'faisca', poder: 35, prioridade: 1 },
  carga: { nome: 'Carga', elemento: 'faisca', poder: 0, efeito: { tipo: 'atq', em: 'eu', valor: 1 } },
};

/** Quanto um degrau de ataque ou defesa multiplica: +1 é 1,5×, −1 é 2/3. */
export function multDoDegrau(degrau: number): number {
  const d = Math.max(-3, Math.min(3, degrau));
  return d >= 0 ? (2 + d) / 2 : 2 / (2 - d);
}

// ---------------- OS BICHOS ----------------
export interface Especie {
  /** O nome próprio, igual em todo idioma. */
  nome: string;
  elemento: Exclude<Elemento, 'nenhum'>;
  /** A folha de desenhos da Briga (web/public/briga/<fase>/<desenho>.png). */
  desenho: string;
  /** A troca de cor por código (graus no círculo das cores) e o tamanho: a forma crescida que usa a mesma folha. */
  matiz?: number;
  escala?: number;
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
    aprende: [[1, 'investida'], [1, 'semente'], [6, 'pedrada'], [9, 'cipo'], [12, 'espinho'], [14, 'avalanche'], [18, 'raiz'], [24, 'polen']] },
  tisco: { nome: 'Tisco', elemento: 'brasa', desenho: 'diabinho', base: { pv: 42, atq: 56, def: 44, vel: 64 }, taxa: 0.5, xp: 55,
    aprende: [[1, 'investida'], [1, 'fogo'], [6, 'sopro'], [9, 'vulcao'], [12, 'calor']], evolui: { nivel: 16, para: 'fornalho' } },
  fornalho: { nome: 'Fornalho', elemento: 'brasa', desenho: 'demonio-azul', matiz: 175, base: { pv: 62, atq: 82, def: 60, vel: 84 }, taxa: 0.2, xp: 120,
    aprende: [[1, 'fogo'], [1, 'sopro'], [9, 'vulcao'], [12, 'calor'], [20, 'rajada'], [26, 'labareda']] },
  bolhim: { nome: 'Bolhim', elemento: 'gota', desenho: 'sapo', base: { pv: 50, atq: 50, def: 56, vel: 46 }, taxa: 0.5, xp: 55,
    aprende: [[1, 'investida'], [1, 'chuva'], [6, 'choque'], [9, 'onda'], [13, 'orvalho']], evolui: { nivel: 16, para: 'bolhao' } },
  bolhao: { nome: 'Bolhão', elemento: 'gota', desenho: 'sapo', matiz: 95, escala: 1.4, base: { pv: 76, atq: 72, def: 78, vel: 58 }, taxa: 0.2, xp: 120,
    aprende: [[1, 'chuva'], [6, 'choque'], [9, 'onda'], [13, 'orvalho'], [20, 'neblina'], [26, 'tremor']] },
  // o mato baixo, perto de casa
  zunzi: { nome: 'Zunzi', elemento: 'vento', desenho: 'abelha', base: { pv: 38, atq: 44, def: 34, vel: 70 }, taxa: 0.7, xp: 40,
    aprende: [[1, 'investida'], [1, 'sopro'], [11, 'tornado'], [13, 'rajada']], evolui: { nivel: 14, para: 'zunzao' } },
  zunzao: { nome: 'Zunzão', elemento: 'vento', desenho: 'abelha', matiz: 160, escala: 1.5, base: { pv: 58, atq: 66, def: 50, vel: 92 }, taxa: 0.3, xp: 95,
    aprende: [[1, 'sopro'], [11, 'tornado'], [13, 'rajada'], [16, 'espinho'], [22, 'assobio']] },
  pruvi: { nome: 'Pruvi', elemento: 'vento', desenho: 'corvo', base: { pv: 42, atq: 44, def: 40, vel: 60 }, taxa: 0.75, xp: 40,
    aprende: [[1, 'investida'], [1, 'sopro'], [8, 'chuva'], [12, 'assobio']], evolui: { nivel: 16, para: 'pruvento' } },
  pruvento: { nome: 'Pruvento', elemento: 'vento', desenho: 'corvo', matiz: 200, escala: 1.4, base: { pv: 64, atq: 66, def: 58, vel: 82 }, taxa: 0.3, xp: 95,
    aprende: [[1, 'sopro'], [8, 'chuva'], [12, 'assobio'], [18, 'rajada'], [24, 'tornado']] },
  miasso: { nome: 'Miasso', elemento: 'faisca', desenho: 'raposa', base: { pv: 40, atq: 50, def: 38, vel: 68 }, taxa: 0.6, xp: 45,
    aprende: [[1, 'investida'], [1, 'choque'], [11, 'raio'], [13, 'estalo']], evolui: { nivel: 18, para: 'relampo' } },
  relampo: { nome: 'Relampo', elemento: 'faisca', desenho: 'raposa', matiz: 40, escala: 1.3, base: { pv: 60, atq: 76, def: 56, vel: 90 }, taxa: 0.3, xp: 100,
    aprende: [[1, 'choque'], [11, 'raio'], [13, 'estalo'], [20, 'carga'], [26, 'rajada']] },
  rochim: { nome: 'Rochim', elemento: 'pedra', desenho: 'golem', base: { pv: 50, atq: 54, def: 70, vel: 25 }, taxa: 0.55, xp: 45,
    aprende: [[1, 'investida'], [1, 'pedrada'], [11, 'avalanche'], [12, 'casca']], evolui: { nivel: 18, para: 'rochedo' } },
  rochedo: { nome: 'Rochedo', elemento: 'pedra', desenho: 'golem', matiz: 25, escala: 1.5, base: { pv: 74, atq: 78, def: 96, vel: 34 }, taxa: 0.3, xp: 100,
    aprende: [[1, 'pedrada'], [11, 'avalanche'], [12, 'casca'], [20, 'investida'], [24, 'tremor']] },
  // o mato alto, lá em cima
  cardao: { nome: 'Cardão', elemento: 'folha', desenho: 'cacto', base: { pv: 55, atq: 60, def: 64, vel: 35 }, taxa: 0.45, xp: 60,
    aprende: [[1, 'investida'], [1, 'semente'], [7, 'pedrada'], [9, 'cipo'], [12, 'espinho']], evolui: { nivel: 20, para: 'cardeiro' } },
  cardeiro: { nome: 'Cardeiro', elemento: 'folha', desenho: 'cacto', matiz: -40, escala: 1.4, base: { pv: 78, atq: 82, def: 88, vel: 46 }, taxa: 0.25, xp: 110,
    aprende: [[1, 'semente'], [9, 'cipo'], [12, 'espinho'], [20, 'raiz'], [26, 'avalanche']] },
  dinito: { nome: 'Dinito', elemento: 'brasa', desenho: 'dino', base: { pv: 54, atq: 64, def: 50, vel: 50 }, taxa: 0.45, xp: 60,
    aprende: [[1, 'investida'], [1, 'fogo'], [7, 'pedrada'], [10, 'vulcao'], [14, 'calor']], evolui: { nivel: 20, para: 'dinarco' } },
  dinarco: { nome: 'Dinarco', elemento: 'brasa', desenho: 'dino', matiz: -30, escala: 1.45, base: { pv: 78, atq: 88, def: 70, vel: 64 }, taxa: 0.25, xp: 110,
    aprende: [[1, 'fogo'], [7, 'pedrada'], [10, 'vulcao'], [14, 'calor'], [24, 'labareda']] },
  vultim: { nome: 'Vultim', elemento: 'gota', desenho: 'fantasma', base: { pv: 50, atq: 56, def: 48, vel: 62 }, taxa: 0.45, xp: 60,
    aprende: [[1, 'chuva'], [5, 'sopro'], [9, 'onda'], [12, 'neblina']], evolui: { nivel: 20, para: 'vultao' } },
  vultao: { nome: 'Vultão', elemento: 'gota', desenho: 'fantasma', matiz: 200, escala: 1.4, base: { pv: 70, atq: 78, def: 66, vel: 82 }, taxa: 0.25, xp: 110,
    aprende: [[1, 'chuva'], [9, 'onda'], [12, 'neblina'], [20, 'assobio'], [26, 'orvalho']] },
  ventrolo: { nome: 'Ventrolo', elemento: 'vento', desenho: 'redemoinho', base: { pv: 48, atq: 60, def: 44, vel: 76 }, taxa: 0.4, xp: 60,
    aprende: [[1, 'sopro'], [7, 'choque'], [9, 'tornado'], [14, 'rajada'], [20, 'assobio']] },
  // os da Nena, na casa do desafio (os golpes de nível alto são da revanche)
  galoca: { nome: 'Galoça', elemento: 'pedra', desenho: 'texugo', base: { pv: 66, atq: 62, def: 68, vel: 40 }, taxa: 0, xp: 90,
    aprende: [[1, 'investida'], [1, 'pedrada'], [7, 'sopro'], [10, 'avalanche'], [20, 'casca'], [28, 'tremor']] },
  macalu: { nome: 'Macalu', elemento: 'faisca', desenho: 'macaco', base: { pv: 58, atq: 64, def: 52, vel: 70 }, taxa: 0, xp: 90,
    aprende: [[1, 'investida'], [1, 'choque'], [8, 'pedrada'], [10, 'raio'], [20, 'estalo'], [28, 'carga']] },
  dragolim: { nome: 'Dragolim', elemento: 'brasa', desenho: 'dragao', base: { pv: 72, atq: 74, def: 66, vel: 60 }, taxa: 0, xp: 120,
    aprende: [[1, 'investida'], [1, 'fogo'], [8, 'sopro'], [11, 'vulcao'], [20, 'calor'], [28, 'labareda']] },
  // os de 19/11/2026: os que só aparecem num lugar, e o raro do pós-jogo
  picotim: { nome: 'Picotim', elemento: 'pedra', desenho: 'espinhento', base: { pv: 52, atq: 62, def: 72, vel: 40 }, taxa: 0.4, xp: 70,
    aprende: [[1, 'investida'], [1, 'pedrada'], [10, 'espinho'], [13, 'casca'], [16, 'avalanche']], evolui: { nivel: 24, para: 'picolosso' } },
  picolosso: { nome: 'Picolosso', elemento: 'pedra', desenho: 'espinhento', matiz: 30, escala: 1.45, base: { pv: 74, atq: 84, def: 98, vel: 50 }, taxa: 0.2, xp: 120,
    aprende: [[1, 'pedrada'], [10, 'espinho'], [13, 'casca'], [16, 'avalanche'], [26, 'tremor']] },
  nevasco: { nome: 'Nevasco', elemento: 'vento', desenho: 'yeti', base: { pv: 80, atq: 82, def: 70, vel: 58 }, taxa: 0.3, xp: 130,
    aprende: [[1, 'sopro'], [1, 'investida'], [14, 'neblina'], [18, 'tornado'], [24, 'avalanche'], [30, 'assobio']] },
  aurelho: { nome: 'Aurelho', elemento: 'faisca', desenho: 'alpaca-rei', base: { pv: 86, atq: 90, def: 82, vel: 88 }, taxa: 0.12, xp: 200,
    aprende: [[1, 'choque'], [1, 'estalo'], [20, 'raio'], [30, 'carga'], [36, 'orvalho']] },
  // os da GRUTA (21/11/2026): só aparecem lá, recoloridos por código das folhas que já existem
  luzeta: { nome: 'Luzeta', elemento: 'faisca', desenho: 'fantasma', matiz: 60, base: { pv: 52, atq: 64, def: 50, vel: 74 }, taxa: 0.35, xp: 75,
    aprende: [[1, 'choque'], [1, 'neblina'], [20, 'estalo'], [26, 'raio'], [30, 'carga']], evolui: { nivel: 34, para: 'luzerna' } },
  luzerna: { nome: 'Luzerna', elemento: 'faisca', desenho: 'fantasma', matiz: 75, escala: 1.4, base: { pv: 72, atq: 88, def: 68, vel: 94 }, taxa: 0.2, xp: 125,
    aprende: [[1, 'choque'], [20, 'estalo'], [26, 'raio'], [30, 'carga'], [36, 'assobio']] },
  cristalim: { nome: 'Cristalim', elemento: 'pedra', desenho: 'golem', matiz: 260, base: { pv: 58, atq: 60, def: 80, vel: 34 }, taxa: 0.35, xp: 75,
    aprende: [[1, 'pedrada'], [1, 'casca'], [22, 'avalanche'], [28, 'choque'], [32, 'tremor']], evolui: { nivel: 34, para: 'cristalao' } },
  cristalao: { nome: 'Cristalão', elemento: 'pedra', desenho: 'golem', matiz: 280, escala: 1.5, base: { pv: 80, atq: 84, def: 104, vel: 42 }, taxa: 0.2, xp: 130,
    aprende: [[1, 'pedrada'], [1, 'casca'], [22, 'avalanche'], [28, 'raio'], [32, 'tremor']] },
  lodim: { nome: 'Lodim', elemento: 'gota', desenho: 'sapo', matiz: 230, escala: 1.15, base: { pv: 66, atq: 62, def: 64, vel: 50 }, taxa: 0.35, xp: 80,
    aprende: [[1, 'chuva'], [1, 'espinho'], [22, 'onda'], [26, 'neblina'], [30, 'orvalho']] },
};

export const INICIAIS = ['brotel', 'tisco', 'bolhim'] as const;
/** O nível de quem começa. */
export const NIVEL_INICIAL = 5;
export const NIVEL_MAXIMO = 50;
export const TAMANHO_DA_EQUIPE = 6;
/** A cesta de quem sai de casa: cenouras para a amizade e chá para a vida. */
export const CESTA = { cenouras: 5, chas: 3 };
/** Quanto o chá devolve: uma parte da vida cheia (20/11/2026; eram 20 fixos, que no nível 30 não faziam nada). E o chá forte. */
export const CURA_DO_CHA = 0.35;
export const CURA_DO_CHA_FORTE = 0.75;
/** A vida que um chá devolve a um bicho com `pvMax` (pelo menos 1). */
export const curaDoCha = (pvMax: number, forte = false) => Math.max(1, Math.floor(pvMax * (forte ? CURA_DO_CHA_FORTE : CURA_DO_CHA)));

/** O nome de quem cuida da casa do desafio: nome próprio, igual em todo idioma. */
export const DESAFIANTE = 'Nena';
export const EQUIPE_DO_DESAFIO: [string, number][] = [['galoca', 7], ['macalu', 8], ['dragolim', 9]];

/**
 * A ESCADA DOS DESAFIOS (19/11/2026): quatro casas, cada uma com quem desafia, em ordem (a próxima só abre com a de antes
 * vencida). A Nena é a primeira. Com as quatro vencidas, a porta da Nena dá a REVANCHE, em nível alto.
 */
export const DESAFIANTES: { nome: string; equipe: [string, number][]; moedas: number }[] = [
  { nome: DESAFIANTE, equipe: EQUIPE_DO_DESAFIO, moedas: 100 },
  { nome: 'Bento', equipe: [['vultim', 15], ['picotim', 16], ['ventrolo', 17]], moedas: 200 },
  { nome: 'Ravi', equipe: [['cardeiro', 21], ['zunzao', 22], ['dinarco', 23]], moedas: 300 },
  { nome: 'Olga', equipe: [['nevasco', 27], ['rochedo', 28], ['dragolim', 29], ['fornalho', 30]], moedas: 400 },
];
export const EQUIPE_DA_REVANCHE: [string, number][] = [['galoca', 34], ['macalu', 35], ['nevasco', 35], ['dragolim', 36]];
export const MOEDAS_DA_REVANCHE = 500;
/**
 * O PRESENTE DA REVANCHE (20/11/2026): os bichos da Nena não fazem amizade no mato (taxa 0); a cada revanche vencida, ela dá
 * um deles (o próximo que a pessoa ainda não tem), neste nível. Assim o caderno fecha.
 */
export const PRESENTES_DA_REVANCHE = ['galoca', 'macalu', 'dragolim'] as const;
export const NIVEL_DO_PRESENTE = 30;
/** Os do começo que a pessoa não escolheu: raros no mato da Serra, só depois da escada inteira (como o raro). */
export const INICIAL_RARO = { mapa: 'serra', chance: 0.08 };

/**
 * A LIGA DA TOCA (21/11/2026): depois da escada inteira, a porta da Liga, na Gruta, abre uma SEQUÊNCIA de quatro lutas
 * seguidas, sem descansar no meio (só o que se leva na cesta). Perder em qualquer uma volta para casa, e a Liga recomeça da
 * primeira. Os nomes são próprios, iguais em todo idioma.
 */
export const LIGA: { nome: string; avatar: number; equipe: [string, number][]; moedas: number }[] = [
  { nome: 'Juno', avatar: 3, equipe: [['cristalim', 34], ['rochedo', 35], ['picolosso', 36]], moedas: 150 },
  { nome: 'Kai', avatar: 6, equipe: [['lodim', 35], ['vultao', 36], ['bolhao', 37]], moedas: 150 },
  { nome: 'Ariel', avatar: 10, equipe: [['luzerna', 37], ['pruvento', 37], ['relampo', 38]], moedas: 200 },
  { nome: 'Sasha', avatar: 14, equipe: [['dinarco', 39], ['fornalho', 40], ['cristalao', 40], ['dragolim', 41]], moedas: 300 },
];
/** O que a Liga inteira vencida dá, além das moedas de cada luta. */
export const MOEDAS_DA_LIGA = 500;

/** A equipe de quem chega à sala sem bicho nenhum: os três do começo, no mesmo nível, para a luta ser justa. */
export const EQUIPE_EMPRESTADA: [string, number][] = [['brotel', 9], ['tisco', 9], ['bolhim', 9]];
/** NA SALA, TODOS LUTAM NESTE NÍVEL (19/11/2026): o troféu não depende de quanto cada um jogou no Solo. */
export const NIVEL_DA_SALA = 20;

/**
 * A lojinha: o preço em moedas do jogo (ganhas nas lutas; nunca dinheiro). Desde 20/11/2026 ela tem ESCADA: cada item abre com
 * quantos degraus da escada dos desafios já foram vencidos (LOJA_ABRE). A erva-doce tira o cochilo e o veneno; a cenoura
 * dourada ajuda a amizade (chanceDeAmizade).
 */
export const PRECOS = { cenoura: 8, cha: 12, erva: 15, chaForte: 30, dourada: 40 } as const;
export type ItemDaLoja = keyof typeof PRECOS;
export const LOJA_ABRE: Record<ItemDaLoja, number> = { cenoura: 0, cha: 0, erva: 1, chaForte: 2, dourada: 3 };

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

/** Todos os golpes que a espécie aprende até o nível, na ordem. */
export function aprendidos(especie: string, nivel: number): string[] {
  const sabe: string[] = [];
  for (const [n, g] of ESPECIES[especie].aprende) if (n <= nivel && !sabe.includes(g)) sabe.push(g);
  return sabe;
}

/** Os golpes que ele sabe no nível, sem ninguém ter escolhido: os últimos 4 aprendidos (o bicho novo, a sala, o mato). */
export function golpesDe(especie: string, nivel: number): string[] {
  return aprendidos(especie, nivel).slice(-4);
}

/**
 * Os golpes que um bicho passa a poder aprender ao subir de `deNivel` para `paraNivel` (e, se cresceu, de `deEspecie` para
 * `paraEspecie`): o que a espécie de agora aprende até o nível novo e a de antes não tinha aprendido até o nível de antes.
 * Quem chama tira os que ele já sabe e, com 4 sabidos, pergunta qual esquecer (20/11/2026).
 */
export function golpesNovos(deEspecie: string, deNivel: number, paraEspecie: string, paraNivel: number): string[] {
  const antes = new Set(aprendidos(deEspecie, deNivel));
  return aprendidos(paraEspecie, paraNivel).filter((g) => !antes.has(g));
}

/** A forma crescida de uma espécie (a última da linha); quem não cresce é ela mesma. */
export function formaCrescida(especie: string): string {
  let e = especie;
  for (let k = 0; k < 5 && ESPECIES[e]?.evolui; k++) e = ESPECIES[e].evolui!.para;
  return e;
}

/** A experiência que leva a cada nível (a total, desde o 1). */
export const xpDoNivel = (nivel: number) => 4 * nivel * nivel;

export function nivelDaXp(xp: number): number {
  let n = 1;
  while (n < NIVEL_MAXIMO && xpDoNivel(n + 1) <= xp) n++;
  return n;
}

/** A experiência que um bicho dá ao pegar no sono. No desafio (e contra as pessoas do caminho), metade a mais. */
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

/**
 * A chance de a amizade dar certo com a cenoura: maior quanto mais cansado o bicho está. A cenoura DOURADA (20/11/2026) dobra a
 * chance, e nunca fica abaixo de 1 em 4 (quem tem taxa 0, os da Nena, continua sem amizade no mato).
 */
export function chanceDeAmizade(especie: string, pv: number, pvMax: number, dourada = false): number {
  const taxa = ESPECIES[especie].taxa;
  if (taxa <= 0) return 0;
  const c = Math.min(0.95, Math.max(0.05, taxa * (1 - (0.75 * pv) / pvMax)));
  return dourada ? Math.min(0.95, Math.max(0.25, c * 2)) : c;
}

/** De quem uma espécie cresce (para o caderno pôr a crescida ao lado). */
export function antesDe(especie: string): string | null {
  for (const [id, e] of Object.entries(ESPECIES)) if (e.evolui?.para === especie) return id;
  return null;
}

// ---------------- OS MAPAS ----------------
/**
 * O campo, visto de cima, numa grade de 24 × 16. T árvore, r pedra, ~ lagoa e as paredes das casas (H, C, L) não deixam passar;
 * . grama, f flores e = caminho, sim. No " (o mato baixo) e no ; (o mato alto) os bichos aparecem. h é a porta de casa
 * (descansar e encher a cesta), c a porta de uma casa de desafio e l a da lojinha.
 * As outras telas (19/11/2026) estão em MAPAS: passa-se de uma para a outra andando para fora pela borda, onde as árvores
 * deixam (a casa do outro lado, na mesma linha ou coluna, tem de ser andável).
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
  'T.HHH..""".f..=...f.....',
  'T.HhH.........=.........',
  'T.....=========........T',
  'TTTTTTTTTTTTTTTTTTTTTTTT',
];
export const LARGURA_DO_MAPA = 24;
export const ALTURA_DO_MAPA = 16;
/** Onde se começa e para onde se volta depois de todos pegarem no sono: na frente da porta de casa. */
export const CASA = { x: 3, y: 14 };

/** Quem aparece em cada mato, e de que nível a que nível. */
export interface Mato {
  especies: string[];
  de: number;
  ate: number;
}
export const MATOS: Record<string, Mato> = {
  '"': { especies: ['zunzi', 'pruvi', 'miasso', 'rochim'], de: 2, ate: 5 },
  ';': { especies: ['cardao', 'dinito', 'vultim', 'ventrolo', 'miasso'], de: 5, ate: 9 },
};
/** A chance de um bicho aparecer a cada passo no mato. */
export const CHANCE_NO_MATO = 0.15;
/** O raro do pós-jogo: só na Serra, e só depois da escada inteira. */
export const RARO = { especie: 'aurelho', mapa: 'serra', chance: 0.05, nivel: 40 };

export type Direcao = 'c' | 'b' | 'e' | 'd';
/** As direções de um passo. */
export const DIRECOES: Record<string, [number, number]> = { c: [0, -1], b: [0, 1], e: [-1, 0], d: [1, 0] };

/** Quem está parado no caminho e desafia quem passa na frente (até 3 casas, na direção em que olha). */
export interface PessoaDoCaminho {
  id: string;
  /** Nome próprio, igual em todo idioma. */
  nome: string;
  x: number;
  y: number;
  olha: Direcao;
  /** O coelho dela (um dos prontos, só para as cores). */
  avatar: number;
  equipe: [string, number][];
  moedas: number;
}
export interface Achado {
  id: string;
  x: number;
  y: number;
  item: 'cenoura' | 'cha' | 'moedas';
  qtd: number;
}
export interface Mapa {
  linhas: string[];
  matos: Record<string, Mato>;
  /** A tela vizinha de cada borda. */
  vizinhos: Partial<Record<Direcao, string>>;
  /** "x,y" da porta → o índice em DESAFIANTES. */
  portas: Record<string, number>;
  pessoas: PessoaDoCaminho[];
  achados: Achado[];
  /** O bicho do mato escolhe o golpe como quem desafia (20/11/2026: do Bosque em diante). */
  esperto?: boolean;
  /** A tela é uma gruta (21/11/2026): o site desenha o chão de pedra, a parede e o mato de fungos. */
  escuro?: boolean;
  /** "x,y" da porta da Liga da Toca (21/11/2026). */
  liga?: string;
}

export const MAPAS: Record<string, Mapa> = {
  campo: {
    linhas: MAPA,
    matos: MATOS,
    vizinhos: { d: 'bosque' },
    portas: { '19,3': 0 },
    pessoas: [],
    achados: [{ id: 'campo-cha', x: 21, y: 6, item: 'cha', qtd: 1 }],
  },
  bosque: {
    linhas: [
      'TTTTTTTTTTT..TTTTTTTTTTT',
      'T;;;;;;;;..=..;;;;;;;;;T',
      'T;;;;;;;;..=..;;;;;;;;;T',
      'T;;;;;;....=....;;;;;;;T',
      'T..........=...........T',
      'T..LLLL....=...CCCCC...T',
      'T..LLLL....=...CCCCC...T',
      'T..LlLL....=...CCcCC...T',
      'T...=......=.....=.....T',
      'T...=========.=====....T',
      'T..TT......=......TT...T',
      'T..TT..;;;;=;;;;..TT.f.T',
      '.......;;;;=;;;;.......T',
      '======.;;;;=;;;;.......T',
      'T....=========.........T',
      'TTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    matos: { ';': { especies: ['picotim', 'pruvi', 'vultim', 'ventrolo', 'cardao', 'zunzi'], de: 10, ate: 15 } },
    vizinhos: { e: 'campo', c: 'serra' },
    esperto: true,
    portas: { '17,7': 1 },
    pessoas: [
      { id: 'duda', nome: 'Duda', x: 10, y: 7, olha: 'd', avatar: 4, equipe: [['pruvi', 11], ['zunzi', 12]], moedas: 40 },
      { id: 'lio', nome: 'Lio', x: 12, y: 2, olha: 'e', avatar: 9, equipe: [['cardao', 12], ['vultim', 13]], moedas: 50 },
    ],
    achados: [
      { id: 'bosque-cenoura', x: 21, y: 12, item: 'cenoura', qtd: 2 },
      { id: 'bosque-moedas', x: 20, y: 4, item: 'moedas', qtd: 30 },
    ],
  },
  serra: {
    linhas: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'T...CCCCC....rr..CCCCC.T',
      'T...CCCCC.;;;;;;.CCCCC.T',
      'T...CCcCC.;;;;;;.CCcCC.T',
      'T.....=...;;;;;;...=...T',
      'T.....=============....T',
      'T.rr.......=.......rr..T',
      'T;;;;;;;...=...;;;;;;;.T',
      'T;;;;;;;...=...;;;;;;;.T',
      'T;;;;;;;...=...;;;;;;;.T',
      'T..........=............',
      'T.HHH......=.....rr....T',
      'T.HhH......=.......f...T',
      'T...========........~~.T',
      'T..........=........~~.T',
      'TTTTTTTTTTT..TTTTTTTTTTT',
    ],
    matos: { ';': { especies: ['nevasco', 'dinito', 'rochim', 'ventrolo', 'miasso', 'picotim'], de: 17, ate: 24 } },
    vizinhos: { b: 'bosque', d: 'gruta' },
    esperto: true,
    portas: { '6,3': 2, '19,3': 3 },
    pessoas: [
      { id: 'tavo', nome: 'Tavo', x: 12, y: 9, olha: 'e', avatar: 7, equipe: [['ventrolo', 18], ['rochim', 19]], moedas: 70 },
      { id: 'mirela', nome: 'Mirela', x: 10, y: 6, olha: 'd', avatar: 12, equipe: [['picotim', 19], ['dinito', 20], ['miasso', 20]], moedas: 80 },
    ],
    achados: [
      { id: 'serra-cha', x: 22, y: 10, item: 'cha', qtd: 2 },
      { id: 'serra-moedas', x: 1, y: 1, item: 'moedas', qtd: 60 },
    ],
  },
  /**
   * A GRUTA (21/11/2026), depois da Serra (pela borda da direita): o chão de pedra, o lago escuro, os fungos onde moram os
   * bichos que só aparecem aqui (Luzeta, Cristalim, Lodim), duas pessoas no caminho e a porta da LIGA DA TOCA.
   */
  gruta: {
    linhas: [
      'rrrrrrrrrrrrrrrrrrrrrrrr',
      'r;;;;;;....rr...CCCCC..r',
      'r;;;;;;....rr...CCCCC..r',
      'r;;;;;;.........CCcCC..r',
      'r.......=========.=....r',
      'r..rr...=.....~~~.=..;;r',
      'r..rr...=.....~~~.=..;;r',
      'r;;;....=.....~~~.=..;;r',
      'r;;;....=.........=....r',
      'r;;;....===========....r',
      '.........=......rr.....r',
      'r........=..;;;;;;;....r',
      'r..rr....=..;;;;;;;.rr.r',
      'r..rr....=..;;;;;;;....r',
      'r........=.............r',
      'rrrrrrrrrrrrrrrrrrrrrrrr',
    ],
    matos: { ';': { especies: ['luzeta', 'cristalim', 'lodim', 'vultim', 'picotim', 'nevasco'], de: 26, ate: 33 } },
    vizinhos: { e: 'serra' },
    esperto: true,
    escuro: true,
    portas: {},
    liga: '18,3',
    pessoas: [
      { id: 'remi', nome: 'Remi', x: 5, y: 10, olha: 'd', avatar: 5, equipe: [['lodim', 28], ['cristalim', 29]], moedas: 90 },
      { id: 'zaya', nome: 'Zaya', x: 12, y: 8, olha: 'b', avatar: 11, equipe: [['luzeta', 30], ['nevasco', 30], ['picotim', 31]], moedas: 110 },
    ],
    achados: [
      { id: 'gruta-cha', x: 22, y: 14, item: 'cha', qtd: 2 },
      { id: 'gruta-moedas', x: 1, y: 14, item: 'moedas', qtd: 80 },
      { id: 'gruta-cenoura', x: 22, y: 1, item: 'cenoura', qtd: 3 },
    ],
  },
};

export const mapaDe = (id: string): Mapa => MAPAS[id] ?? MAPAS.campo;

export const casaNo = (mapa: string, x: number, y: number) =>
  y >= 0 && y < ALTURA_DO_MAPA && x >= 0 && x < LARGURA_DO_MAPA ? mapaDe(mapa).linhas[y][x] : 'T';
export const pessoaEm = (mapa: string, x: number, y: number) => mapaDe(mapa).pessoas.find((p) => p.x === x && p.y === y) ?? null;
export const andavelNo = (mapa: string, x: number, y: number) => !'TrHCL~'.includes(casaNo(mapa, x, y)) && !pessoaEm(mapa, x, y);

/** O campo (a tela de sempre): as duas de antes de 19/11/2026. */
export const casaDoMapa = (x: number, y: number) => casaNo('campo', x, y);
export const andavel = (x: number, y: number) => andavelNo('campo', x, y);

/** Um passo: para onde ele leva (passando pela borda para a tela vizinha), ou null se não dá. */
export function passoNoMapa(mapa: string, x: number, y: number, dir: string): { mapa: string; x: number; y: number } | null {
  const d = DIRECOES[dir];
  if (!d) return null;
  let m = mapa;
  let nx = x + d[0];
  let ny = y + d[1];
  if (nx < 0 || nx >= LARGURA_DO_MAPA || ny < 0 || ny >= ALTURA_DO_MAPA) {
    const vizinho = mapaDe(mapa).vizinhos[dir as Direcao];
    if (!vizinho || !MAPAS[vizinho]) return null;
    m = vizinho;
    nx = (nx + LARGURA_DO_MAPA) % LARGURA_DO_MAPA;
    ny = (ny + ALTURA_DO_MAPA) % ALTURA_DO_MAPA;
  }
  return andavelNo(m, nx, ny) ? { mapa: m, x: nx, y: ny } : null;
}

/** Quem vê esta casa: a pessoa do caminho que olha para ela, até 3 casas, sem nada no meio. */
export function quemVe(mapa: string, x: number, y: number): PessoaDoCaminho | null {
  for (const p of mapaDe(mapa).pessoas) {
    const [dx, dy] = DIRECOES[p.olha];
    for (let k = 1; k <= 3; k++) {
      const cx = p.x + dx * k;
      const cy = p.y + dy * k;
      if (!andavelNo(mapa, cx, cy)) break;
      if (cx === x && cy === y) return p;
    }
  }
  return null;
}

/**
 * O CADERNO QUE FECHA (20/11/2026): as espécies que alguém pode ter como amiga numa aventura — os do mato de cada tela, os três
 * do começo (o escolhido, e os outros raros na Serra), o raro, os presentes da revanche e tudo o que eles viram ao crescer. O
 * caderno conta sobre esta lista; o que sobrar fora dela (só de quem desafia) a tela conta à parte. O teste confere que é tudo.
 */
export function alcancaveis(): Set<string> {
  const s = new Set<string>([...INICIAIS, RARO.especie, ...PRESENTES_DA_REVANCHE]);
  for (const m of Object.values(MAPAS)) for (const mato of Object.values(m.matos)) for (const e of mato.especies) s.add(e);
  for (const e of [...s]) {
    let x = e;
    for (let k = 0; k < 5 && ESPECIES[x]?.evolui; k++) s.add((x = ESPECIES[x].evolui!.para));
  }
  return s;
}
