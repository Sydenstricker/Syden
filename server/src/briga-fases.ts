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
 * - 'chefe': o do texugo (a investida pela faixa e a pancada no chão), e, com `sopro`, uma rajada de três tiros.
 *
 * A horta é a de sempre (os mesmos bichos, as mesmas ondas). Os bichos das fases novas são os monstros da Quaternius (CC0),
 * renderizados de lado pelo Blender (e2e/pixel-art/personagem/blender/meshy/briga-monstros.py); os da horta continuam
 * desenhados por código. Os ids são internos e nunca aparecem na tela.
 */

export type Comportamento = 'soco' | 'mergulho' | 'pulo' | 'tiro' | 'chefe';

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
  /** O chefe que também atira (a rajada de três). */
  sopro?: boolean;
}

export const BICHOS = {
  // a horta (desenhados por código, como sempre)
  raposa: { comp: 'soco', corpo: 10, hp: 30, pontos: 50, dano: 8 },
  corvo: { comp: 'mergulho', corpo: 9, hp: 18, pontos: 40, dano: 7 },
  texugo: { comp: 'chefe', corpo: 18, hp: 220, pontos: 300, dano: 14 },
  // a floresta
  cogumelo: { comp: 'soco', corpo: 10, hp: 32, pontos: 50, dano: 8 },
  sapo: { comp: 'pulo', corpo: 9, hp: 24, pontos: 50, dano: 10 },
  abelha: { comp: 'mergulho', corpo: 8, hp: 18, pontos: 40, dano: 7 },
  'rei-cogumelo': { comp: 'chefe', corpo: 20, hp: 240, pontos: 320, dano: 14, sopro: true },
  // o deserto
  cacto: { comp: 'soco', corpo: 11, hp: 36, pontos: 55, dano: 9 },
  dino: { comp: 'tiro', corpo: 10, hp: 26, pontos: 50, dano: 7 },
  redemoinho: { comp: 'mergulho', corpo: 9, hp: 20, pontos: 40, dano: 7 },
  'alpaca-rei': { comp: 'chefe', corpo: 20, hp: 260, pontos: 340, dano: 15, sopro: true },
  // a neve
  macaco: { comp: 'soco', corpo: 10, hp: 32, pontos: 50, dano: 8 },
  espinhento: { comp: 'pulo', corpo: 10, hp: 28, pontos: 55, dano: 10 },
  golem: { comp: 'tiro', corpo: 9, hp: 26, pontos: 50, dano: 7 },
  yeti: { comp: 'chefe', corpo: 22, hp: 280, pontos: 360, dano: 16, sopro: true },
  // o castelo
  diabinho: { comp: 'soco', corpo: 10, hp: 34, pontos: 55, dano: 9 },
  'demonio-azul': { comp: 'pulo', corpo: 10, hp: 30, pontos: 55, dano: 11 },
  fantasma: { comp: 'mergulho', corpo: 9, hp: 22, pontos: 45, dano: 8 },
  dragao: { comp: 'chefe', corpo: 22, hp: 300, pontos: 400, dano: 16, sopro: true },
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
}

/** As fases, na ordem da campanha. A primeira é a horta, igual à de antes. */
export const FASES_DA_BRIGA: FaseDaBriga[] = [
  { id: 'horta', chefe: 'texugo', ondas: [{ raposa: 3 }, { raposa: 3, corvo: 1 }, { raposa: 3, corvo: 2 }, { raposa: 4, corvo: 2 }] },
  {
    id: 'floresta',
    chefe: 'rei-cogumelo',
    ondas: [{ cogumelo: 3 }, { cogumelo: 2, sapo: 1 }, { cogumelo: 2, sapo: 1, abelha: 1 }, { cogumelo: 3, sapo: 1, abelha: 2 }],
  },
  {
    id: 'deserto',
    chefe: 'alpaca-rei',
    ondas: [{ cacto: 3 }, { cacto: 2, redemoinho: 1 }, { cacto: 2, dino: 1, redemoinho: 1 }, { cacto: 3, dino: 2, redemoinho: 1 }],
  },
  {
    id: 'neve',
    chefe: 'yeti',
    ondas: [{ macaco: 3 }, { macaco: 2, espinhento: 1 }, { macaco: 2, golem: 1, espinhento: 1 }, { macaco: 3, golem: 1, espinhento: 2 }],
  },
  {
    id: 'castelo',
    chefe: 'dragao',
    ondas: [{ diabinho: 3 }, { diabinho: 2, fantasma: 1 }, { diabinho: 2, 'demonio-azul': 1, fantasma: 1 }, { diabinho: 3, 'demonio-azul': 1, fantasma: 2 }],
  },
];

/** As fases todas, uma atrás da outra. */
export const CAMPANHA = 'campanha';
export const faseDaBriga = (id: string): FaseDaBriga | undefined => FASES_DA_BRIGA.find((f) => f.id === id);

/** A pista do troféu (corrida_trofeus): a horta guarda a de antes ('briga'), para os troféus antigos continuarem dela. */
export const pistaDaBriga = (escolha: string) => (escolha === 'horta' ? 'briga' : `briga-${escolha}`);
