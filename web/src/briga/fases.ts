/**
 * AS FASES DA BRIGA NA HORTA (06/11/2026, pedido dele: "a primeira fase é a briga na horta, e em outros cenários ele vai mudando
 * inimigos e cenário"). Este arquivo existe em DUAS CÓPIAS IGUAIS BYTE A BYTE — server/src/briga-fases.ts e
 * web/src/briga/fases.ts — e web/test/briga.test.ts confere. Não importa nada, para as duas cópias poderem ser iguais.
 *
 * Cada bicho tem um COMPORTAMENTO, e é ele que o servidor simula (server/src/minijogo-briga.ts):
 * - 'soco': anda até quem está mais perto, prepara (0,5 s, o braço para trás) e bate. A raposa da horta.
 * - 'mergulho': voa alto (só a voadora alcança), mira uma faixa e mergulha nela. O corvo.
 * - 'pulo': chega perto, se agacha mirando um ponto do chão (o círculo pisca ali) e cai em cima dele.
 * - 'tiro': fica longe, mira a faixa de quem está mais perto (a linha pisca) e atira; pular ou trocar de faixa escapa.
 * - 'chefe': o do texugo (a investida pela faixa e a pancada no chão). Desde 21/11/2026 cada chefe novo tem o GOLPE DELE
 *   (`golpe`; antes os quatro dividiam a rajada): o rei-cogumelo solta ESPOROS (o círculo pisca debaixo de cada coelho e
 *   estoura), a alpaca-rei dá o COICE (vira de costas e chuta quem está atrás), o yeti bate no chão e a ONDA DE CHOQUE corre
 *   em anel (pular por cima escapa), e o dragão continua com a rajada de três tiros (o SOPRO).
 *
 * CADA FASE TEM UM ELEMENTO DE CENÁRIO COM REGRA (21/11/2026, a segunda auditoria dos mini-games), decidido pelo servidor como
 * os bichos: o TRONCO que rola pela faixa na floresta (a linha pisca antes; derruba coelho e bicho), o RODAMOINHO de areia que
 * anda pelo deserto e empurra quem encosta, as PLACAS DE GELO da neve (o coelho escorrega: é a única que mora só no site, a
 * física do próprio coelho, e o lugar delas é esta tabela), e as GRADES DE ESPINHOS do castelo (piscam e sobem, em ciclo;
 * pegam também os bichos). A horta continua a de sempre, sem nada.
 *
 * A horta é a de sempre (os mesmos bichos, as mesmas ondas). Os bichos são os monstros da Quaternius (CC0), renderizados de
 * lado pelo Blender (e2e/pixel-art/personagem/blender/meshy/briga-monstros.py); desde 09/11/2026 os da horta também (pedido
 * dele): a "raposa" é o gato malhado, o "corvo" o pombo e o "texugo" a galinha gigante. Os ids ficaram, porque vão no quadro
 * da rede e nos troféus; são internos e nunca aparecem na tela.
 */

export type Comportamento = 'soco' | 'mergulho' | 'pulo' | 'tiro' | 'chefe';
/** O golpe próprio de cada chefe novo (o texugo não tem: só a investida e a pancada). */
export type GolpeDoChefe = 'esporos' | 'coice' | 'onda' | 'sopro';

export interface DefinicaoDoBicho {
  comp: Comportamento;
  /** A meia largura do corpo (px). */
  corpo: number;
  /** A vida (o chefe ganha mais 90 por pessoa além da primeira). */
  hp: number;
  /** Os pontos de quem derruba de vez. */
  pontos: number;
  /** O dano do golpe (o do tiro, no tiro). */
  dano: number;
  /** O golpe próprio do chefe (ver o topo). */
  golpe?: GolpeDoChefe;
}

export const BICHOS = {
  // a horta (o gato, o pombo e a galinha; os ids são os de antes)
  raposa: { comp: 'soco', corpo: 10, hp: 30, pontos: 50, dano: 8 },
  corvo: { comp: 'mergulho', corpo: 9, hp: 18, pontos: 40, dano: 7 },
  texugo: { comp: 'chefe', corpo: 18, hp: 220, pontos: 300, dano: 14 },
  // a floresta
  cogumelo: { comp: 'soco', corpo: 10, hp: 32, pontos: 50, dano: 8 },
  sapo: { comp: 'pulo', corpo: 9, hp: 24, pontos: 50, dano: 10 },
  abelha: { comp: 'mergulho', corpo: 8, hp: 18, pontos: 40, dano: 7 },
  'rei-cogumelo': { comp: 'chefe', corpo: 20, hp: 240, pontos: 320, dano: 14, golpe: 'esporos' },
  // o deserto
  cacto: { comp: 'soco', corpo: 11, hp: 36, pontos: 55, dano: 9 },
  dino: { comp: 'tiro', corpo: 10, hp: 26, pontos: 50, dano: 7 },
  redemoinho: { comp: 'mergulho', corpo: 9, hp: 20, pontos: 40, dano: 7 },
  'alpaca-rei': { comp: 'chefe', corpo: 20, hp: 260, pontos: 340, dano: 15, golpe: 'coice' },
  // a neve
  macaco: { comp: 'soco', corpo: 10, hp: 32, pontos: 50, dano: 8 },
  espinhento: { comp: 'pulo', corpo: 10, hp: 28, pontos: 55, dano: 10 },
  golem: { comp: 'tiro', corpo: 9, hp: 26, pontos: 50, dano: 7 },
  yeti: { comp: 'chefe', corpo: 22, hp: 280, pontos: 360, dano: 16, golpe: 'onda' },
  // o castelo
  diabinho: { comp: 'soco', corpo: 10, hp: 34, pontos: 55, dano: 9 },
  'demonio-azul': { comp: 'pulo', corpo: 10, hp: 30, pontos: 55, dano: 11 },
  fantasma: { comp: 'mergulho', corpo: 9, hp: 22, pontos: 45, dano: 8 },
  dragao: { comp: 'chefe', corpo: 22, hp: 300, pontos: 400, dano: 16, golpe: 'sopro' },
} satisfies Record<string, DefinicaoDoBicho>;

export type TipoDeInimigo = keyof typeof BICHOS;
/** A ordem é o código que vai no quadro: bicho novo entra no FIM. */
export const TIPOS = Object.keys(BICHOS) as TipoDeInimigo[];
export const CORPO = Object.fromEntries(TIPOS.map((t) => [t, BICHOS[t].corpo])) as Record<TipoDeInimigo, number>;
export const bicho = (t: TipoDeInimigo): DefinicaoDoBicho => BICHOS[t];

export interface FaseDaBriga {
  id: string;
  chefe: TipoDeInimigo;
  /** As quatro ondas antes do chefe: quantos de cada bicho (o de soco vem primeiro; os outros entram intercalados). */
  ondas: Partial<Record<TipoDeInimigo, number>>[];
  /** O elemento de cenário da fase (ver o topo); a horta não tem. */
  elemento?: ElementoDaFase;
}

// ---------------- OS ELEMENTOS DE CENÁRIO (21/11/2026) ----------------
export type ElementoDaFase = 'tronco' | 'rodamoinho' | 'gelo' | 'espinhos';
/** O código de cada coisa da coluna 1 do `el` do quadro ([id, código, x, y, estado, lado]); coisa nova entra no FIM. */
export const ELEMENTOS = ['tronco', 'rodamoinho', 'gelo', 'espinhos', 'esporo'] as const;
/** Onde começa cada arena (as mesmas ONDAS_X das regras; o teste confere). */
export const ARENAS_DA_BRIGA = [0, 360, 720, 1080, 1440];
/**
 * O TRONCO da floresta: de tempos em tempos (`intervalo`, sorteado entre os dois), a linha pisca na faixa de um coelho por
 * `aviso` ms, com o tronco parado na borda; depois ele rola a `vel` px/s até a outra borda. Pega quem está na faixa e no chão
 * (pular ou sair da faixa escapa), e derruba também os bichos do caminho.
 */
export const TRONCO = { aviso: 1200, vel: 115, raio: 9, fundo: 8, dano: 9, danoNoBicho: 6, intervalo: [8000, 12000] as const };
/** O RODAMOINHO do deserto: um por arena, anda devagar até um ponto sorteado e empurra (pouco dano) quem encosta, um golpe a cada `cada` ms. */
export const RODAMOINHO = { vel: 34, raioX: 12, raioY: 7, dano: 4, cada: 1200 };
/**
 * O GELO da neve: placas no chão de cada arena, [dx, y, meia largura, meia fundura]. Em cima delas o coelho escorrega: a
 * velocidade dele vai até a que as setas pedem aos poucos (`aderencia` por segundo), em vez de na hora. Nunca passa da
 * velocidade normal (o servidor confere o andar como sempre).
 */
export const GELO_NA_ARENA: readonly (readonly [number, number, number, number])[] = [
  [74, 16, 34, 8],
  [206, 40, 46, 9],
];
export const GELO = { aderencia: 2.4 };
/** Está numa placa de gelo? */
export function noGelo(x: number, y: number): boolean {
  for (const a of ARENAS_DA_BRIGA) {
    for (const [dx, y0, l, p] of GELO_NA_ARENA) if (Math.abs(x - (a + dx)) <= l && Math.abs(y - y0) <= p) return true;
  }
  return false;
}
/**
 * AS GRADES DE ESPINHOS do castelo: três por arena, [dx, y]. Cada uma num ciclo de `ciclo` ms, defasadas entre si: quieta, PISCA
 * por `aviso` ms e fica com os espinhos em pé por `emPe` ms. Em pé, pega quem está nela no chão, coelho ou bicho (o chefe não).
 */
export const ESPINHOS_NA_ARENA: readonly (readonly [number, number])[] = [
  [96, 12],
  [176, 44],
  [256, 24],
];
export const ESPINHOS = { meiaL: 13, meiaP: 6, ciclo: 5200, aviso: 1000, emPe: 700, defasagem: 1700, dano: 9, danoNoBicho: 6 };
/** O estado de uma grade no instante `ms` (desde o começo da fase): 0 quieta, 1 piscando, 2 em pé; e o número do ciclo. */
export function estadoDaGrade(ms: number, k: number): { estado: 0 | 1 | 2; ciclo: number } {
  const t = ms + k * ESPINHOS.defasagem;
  const p = ((t % ESPINHOS.ciclo) + ESPINHOS.ciclo) % ESPINHOS.ciclo;
  const ciclo = Math.floor(t / ESPINHOS.ciclo);
  if (p >= ESPINHOS.ciclo - ESPINHOS.emPe) return { estado: 2, ciclo };
  if (p >= ESPINHOS.ciclo - ESPINHOS.emPe - ESPINHOS.aviso) return { estado: 1, ciclo };
  return { estado: 0, ciclo };
}
/** Os ESPOROS do rei-cogumelo: o círculo pisca `aviso` ms debaixo de cada coelho e estoura (fica `nuvem` ms à vista). */
export const ESPOROS = { raioX: 20, raioY: 8, aviso: 1100, nuvem: 450 };
/** O COICE da alpaca-rei: quem está atrás dela, até `alcance` px. */
export const COICE = { alcance: 56, fundo: 12 };
/** A ONDA DE CHOQUE do yeti: o anel sai do pé dele a `vel` px/s até `alcance`; a faixa do chão conta 3 vezes (o anel é achatado). */
export const ONDA_DE_CHOQUE = { vel: 125, alcance: 190, largura: 14, inicio: 18 };
/** O raio do anel `ms` depois de sair. */
export const raioDaOnda = (ms: number) => ONDA_DE_CHOQUE.inicio + (ONDA_DE_CHOQUE.vel * Math.max(0, ms)) / 1000;
/** A distância "no chão" do anel: o y conta 3 vezes. */
export const distanciaDaOnda = (dx: number, dy: number) => Math.sqrt(dx * dx + 9 * dy * dy);

/** As fases, na ordem da campanha. A primeira é a horta, igual à de antes. */
export const FASES_DA_BRIGA: FaseDaBriga[] = [
  { id: 'horta', chefe: 'texugo', ondas: [{ raposa: 3 }, { raposa: 3, corvo: 1 }, { raposa: 3, corvo: 2 }, { raposa: 4, corvo: 2 }] },
  {
    id: 'floresta',
    chefe: 'rei-cogumelo',
    elemento: 'tronco',
    ondas: [{ cogumelo: 3 }, { cogumelo: 2, sapo: 1 }, { cogumelo: 2, sapo: 1, abelha: 1 }, { cogumelo: 3, sapo: 1, abelha: 2 }],
  },
  {
    id: 'deserto',
    chefe: 'alpaca-rei',
    elemento: 'rodamoinho',
    ondas: [{ cacto: 3 }, { cacto: 2, redemoinho: 1 }, { cacto: 2, dino: 1, redemoinho: 1 }, { cacto: 3, dino: 2, redemoinho: 1 }],
  },
  {
    id: 'neve',
    chefe: 'yeti',
    elemento: 'gelo',
    ondas: [{ macaco: 3 }, { macaco: 2, espinhento: 1 }, { macaco: 2, golem: 1, espinhento: 1 }, { macaco: 3, golem: 1, espinhento: 2 }],
  },
  {
    id: 'castelo',
    chefe: 'dragao',
    elemento: 'espinhos',
    ondas: [{ diabinho: 3 }, { diabinho: 2, fantasma: 1 }, { diabinho: 2, 'demonio-azul': 1, fantasma: 1 }, { diabinho: 3, 'demonio-azul': 1, fantasma: 2 }],
  },
];

/** As fases todas, uma atrás da outra. */
export const CAMPANHA = 'campanha';
export const faseDaBriga = (id: string): FaseDaBriga | undefined => FASES_DA_BRIGA.find((f) => f.id === id);

/** A pista do troféu (corrida_trofeus): a horta guarda a de antes ('briga'), para os troféus antigos continuarem dela. */
export const pistaDaBriga = (escolha: string) => (escolha === 'horta' ? 'briga' : `briga-${escolha}`);
