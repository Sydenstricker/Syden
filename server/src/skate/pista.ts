/**
 * A PISTA DO SKATE (05/11/2026, pedido dele: "um mini Tony Hawk"; SÓ A MECÂNICA: nada de nome, personagem, fase ou música
 * de ninguém). Uma pista pequena, 12 × 18 casas, com as peças do Mini Skate da Kenney (CC0, web/public/skate/License.txt):
 * as duas pontas são paredes de quarter (a do fundo e a de trás formam um half gigante), um corrimão, uma caixa de grind e
 * duas rampas de salto no meio.
 *
 * ESTE ARQUIVO NÃO CONHECE O THREE.JS: é a geometria que a física lê (a altura do chão em cada ponto e as linhas de grind),
 * e o desenho (cena.ts) só põe os modelos onde ela diz. Mora em DUAS CÓPIAS IGUAIS (web/src/skate/ e server/src/skate/), com a
 * física: o servidor refaz a sessão (06/11/2026).
 *
 * A unidade é a casa da Kenney (1 = um ladrilho); o coelho tem uns 0,75 de altura. O desenho das peças foi MEDIDO nos
 * modelos (a altura da superfície amostrada triângulo a triângulo, 05/11/2026): a rampa sobe 0,30 na metade da frente e é
 * plana na de trás; o quarter vai de 0 a 0,8, com a borda quase vertical no alto e um patamar de 0,2.
 */

export type Perfil = 'quarter' | 'rampa' | 'caixa' | 'corrimao';

export interface Peca {
  modelo: string;
  /** O centro da peça, na pista. */
  x: number;
  z: number;
  /** Quartos de volta em torno do eixo vertical (o mesmo `rotation.y = rot · 90°` do three.js). */
  rot: 0 | 1 | 2 | 3;
  /** Sem perfil: só enfeite (fora da pista, sem colisão). */
  perfil?: Perfil;
}

export interface Trilho {
  /** As pontas da linha de grind, na pista, e a altura. */
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  y: number;
  /** A distância (no chão) em que a prancha ainda "pega" a linha. */
  folga: number;
  /** O comprimento e a direção (unitária), calculados aqui uma vez. */
  comp: number;
  dx: number;
  dz: number;
  /** A manobra que a linha vale: 'Grind' (corrimão, caixa, cerca) ou 'Stall' (a beirada do alto dos quarters). */
  nome: 'Grind' | 'Stall';
  /**
   * Só na beirada dos quarters: para onde fica a pista (o lado da curva, no chão, unitário). Ao sair da linha o skatista
   * "entra de volta" na rampa por ali, e não fica no patamar estreito atrás dela.
   */
  dentro?: [number, number];
  /** A prancha precisa estar quase ao longo da linha (|cosseno| mínimo), além do caminho. */
  prancha?: number;
}

export const LARGURA = 12;
export const PROFUNDIDADE = 18;
/** O quanto se pode chegar perto da cerca. */
export const MARGEM = 0.15;
/** A altura do alto da cerca (medida no fence.glb), onde se grinda. */
export const ALTURA_DA_CERCA = 0.35;
/** A altura do patamar dos quarters (a beirada, o "coping"), onde se faz o stall. */
export const ALTURA_DA_BEIRADA = 0.8;
/** Onde a curva do quarter encontra o patamar, contando da ponta da pista (o perfil QUARTER cai de 0,8 entre 0,2 e 0,225). */
export const BEIRADA = 0.21;

/**
 * O PERFIL DO QUARTER, medido no half-pipe.glb (de 0,025 em 0,025 casa, do patamar em z local −0,5 à boca em +0,5). A
 * física interpola em linha reta entre as amostras: o modelo é feito de faixas retas, e as amostras caem nelas.
 */
const QUARTER = [
  0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.782, 0.61, 0.538, 0.478, 0.417, 0.377, 0.344, 0.312, 0.279, 0.246, 0.222, 0.203, 0.184, 0.165,
  0.146, 0.126, 0.107, 0.097, 0.086, 0.076, 0.066, 0.055, 0.045, 0.035, 0.026, 0.023, 0.02, 0.016, 0.013, 0.01, 0.007, 0.003, 0,
];

/** A altura de um perfil num ponto LOCAL da peça; fora da peça, a superfície continua reta (clampeada) — é o que a física compara na borda. */
function alturaLocal(perfil: Perfil, lx: number, lz: number): number {
  const z = lz < -0.5 ? -0.5 : lz > 0.5 ? 0.5 : lz;
  switch (perfil) {
    case 'quarter': {
      const u = (z + 0.5) * 40;
      const i = Math.floor(u);
      if (i >= 40) return QUARTER[40];
      const f = u - i;
      return QUARTER[i] + (QUARTER[i + 1] - QUARTER[i]) * f;
    }
    case 'rampa':
      return z <= 0 ? 0.3 : 0.3 * (1 - 2 * z);
    case 'caixa':
      return 0.21;
    case 'corrimao':
      return 0.25;
  }
}

/** A metade da largura (no x local) que a peça ocupa no chão; o comprimento (z local) é sempre a casa inteira. */
function meiaLargura(perfil: Perfil): number {
  return perfil === 'caixa' ? 0.26 : perfil === 'corrimao' ? 0.05 : 0.5;
}

/** Do ponto da pista para o ponto local da peça (o inverso do `rotation.y` do three.js, em quartos de volta exatos). */
function local(p: Peca, x: number, z: number): [number, number] {
  const dx = x - p.x;
  const dz = z - p.z;
  switch (p.rot) {
    case 0:
      return [dx, dz];
    case 1:
      return [-dz, dx];
    case 2:
      return [-dx, -dz];
    case 3:
      return [dz, -dx];
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// AS PISTAS (19/11/2026: a segunda, a Praça, com id próprio e recorde próprio)
// ---------------------------------------------------------------------------------------------------------------------

/** Um ponto no ar (uma letra, a fita), onde o skatista "pega" passando perto. */
export interface Ponto {
  x: number;
  y: number;
  z: number;
}

/** Um retângulo no chão (x0..x1, z0..z1). */
export interface Area {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/**
 * UM SALTO COM NOME: sair do chão dentro de `de` e voltar ao chão (ou pegar uma linha) dentro de `ate`, no mesmo voo. O nome
 * é um id; a tela o traduz.
 */
export interface Salto {
  id: string;
  de: Area;
  ate: Area;
  pontos: number;
}

/** Os OBJETIVOS de uma sessão (19/11/2026, a referência do gênero): a palavra no ar, a fita escondida, as metas e os saltos. */
export interface Objetivos {
  /** As letras da palavra, na ordem (a palavra é NOSSA: "TOCA"). */
  letras: Ponto[];
  fita: Ponto;
  pontos: number;
  combo: number;
  saltos: Salto[];
}

export const PALAVRA = 'TOCA';

/**
 * O SEGUNDO CONJUNTO DE OBJETIVOS (21/11/2026, o lote D): escolhido na largada, nas duas pistas. Outra palavra no ar (também
 * NOSSA: "PULO"), outro esconderijo da fita, metas maiores de pontos e de combo, e duas manobras: um giro de `giro` graus e um
 * manual de `manual` segundos. Os saltos dele ficam vazios: os pontos dos saltos com nome continuam os do primeiro conjunto
 * (a pista é a mesma, e o recorde de pontos também).
 */
export interface SegundoConjunto extends Objetivos {
  giro: number;
  manual: number;
}
export const PALAVRA_2 = 'PULO';
/** As palavras dos conjuntos, pelo índice (0: o primeiro, 1: o segundo). */
export const PALAVRAS = [PALAVRA, PALAVRA_2] as const;
export const CONJUNTOS = 2;

function montarParque(): { pecas: Peca[]; trilhos: Trilho[] } {
  const pecas: Peca[] = [];
  // as duas pontas: uma fileira de quarters de parede a parede, as bocas viradas uma para a outra
  quarters(pecas);
  // o corrimão, ao longo da pista
  for (let j = 6; j < 11; j++) pecas.push({ modelo: 'rail-low', x: 3.5, z: j + 0.5, rot: 0, perfil: 'corrimao' });
  // a caixa de grind
  for (let j = 7; j < 11; j++) pecas.push({ modelo: 'obstacle-box-grind', x: 8.5, z: j + 0.5, rot: 0, perfil: 'caixa' });
  // as rampas de salto, no corredor do meio: duas para quem vai ao fundo, duas para quem volta
  pecas.push({ modelo: 'ramp', x: 5.5, z: 13.5, rot: 0, perfil: 'rampa' });
  pecas.push({ modelo: 'ramp', x: 6.5, z: 13.5, rot: 0, perfil: 'rampa' });
  pecas.push({ modelo: 'ramp', x: 5.5, z: 4.5, rot: 2, perfil: 'rampa' });
  pecas.push({ modelo: 'ramp', x: 6.5, z: 4.5, rot: 2, perfil: 'rampa' });
  // enfeite, do lado de fora da cerca
  for (const z of [3.5, 8.5, 13.5]) {
    pecas.push({ modelo: 'bench', x: -0.7, z, rot: 1 });
    pecas.push({ modelo: 'bench', x: LARGURA + 0.7, z, rot: 3 });
  }
  pecas.push({ modelo: 'pallet', x: -1.2, z: 6, rot: 0 });
  pecas.push({ modelo: 'pallet', x: -1.1, z: 6.6, rot: 1 });
  pecas.push({ modelo: 'structure-wood-platform', x: LARGURA + 1.6, z: 10.5, rot: 3 });

  const trilho = (x1: number, z1: number, x2: number, z2: number, y: number, folga: number, extra: Partial<Trilho> = {}): Trilho => {
    const comp = Math.sqrt((x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1));
    return { x1, z1, x2, z2, y, folga, comp, dx: (x2 - x1) / comp, dz: (z2 - z1) / comp, nome: 'Grind', ...extra };
  };
  const trilhos = [trilho(3.5, 6, 3.5, 11, 0.25, 0.22), trilho(8.5, 7, 8.5, 11, 0.21, 0.3)];
  // O ALTO DA CERCA dos lados compridos também se grinda (pedido dele, 06/11/2026: "a barra que proíbe sair do mapa"). O
  // modelo da cerca tem 0,35 de altura e fica a 0,06 por fora da pista; a linha vai entre as bocas dos dois quarters. A folga
  // é maior porque o skatista não chega a menos de MARGEM da cerca; ao sair da linha ele volta para dentro (fisica.ts).
  trilhos.push(trilho(-0.04, 1.1, -0.04, PROFUNDIDADE - 1.1, ALTURA_DA_CERCA, 0.34));
  trilhos.push(trilho(LARGURA + 0.04, 1.1, LARGURA + 0.04, PROFUNDIDADE - 1.1, ALTURA_DA_CERCA, 0.34));
  // A BEIRADA DO ALTO DOS QUARTERS (pedido dele, 06/11/2026: "se apoiar" na borda de cima, para variar): no vert o skatista
  // sobe e desce rente à parede (a 0,04 da beirada, medido), e pega a linha descendo SE a prancha estiver ao longo dela (girar
  // 90° no ar) — quem sobe reto e não gira volta à rampa como sempre. Vale "Stall", e sair dela devolve à rampa (fisica.ts).
  const beirada = { nome: 'Stall' as const, prancha: 0.8 };
  const x1 = MARGEM + 0.05;
  const x2 = LARGURA - MARGEM - 0.05;
  trilhos.push(trilho(x1, BEIRADA, x2, BEIRADA, ALTURA_DA_BEIRADA, 0.14, { ...beirada, dentro: [0, 1] }));
  trilhos.push(trilho(x1, PROFUNDIDADE - BEIRADA, x2, PROFUNDIDADE - BEIRADA, ALTURA_DA_BEIRADA, 0.14, { ...beirada, dentro: [0, -1] }));
  return { pecas, trilhos };
}

/** As fileiras de quarters das duas pontas (as mesmas nas duas pistas). */
function quarters(pecas: Peca[]) {
  for (let i = 0; i < LARGURA; i++) {
    pecas.push({ modelo: 'half-pipe', x: i + 0.5, z: 0.5, rot: 0, perfil: 'quarter' });
    pecas.push({ modelo: 'half-pipe', x: i + 0.5, z: PROFUNDIDADE - 0.5, rot: 2, perfil: 'quarter' });
  }
}

function linha(x1: number, z1: number, x2: number, z2: number, y: number, folga: number, extra: Partial<Trilho> = {}): Trilho {
  const comp = Math.sqrt((x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1));
  return { x1, z1, x2, z2, y, folga, comp, dx: (x2 - x1) / comp, dz: (z2 - z1) / comp, nome: 'Grind', ...extra };
}

/** As linhas que as duas pistas têm: o alto da cerca dos lados compridos e a beirada dos quarters. */
function linhasDaBorda(): Trilho[] {
  const beirada = { nome: 'Stall' as const, prancha: 0.8 };
  const x1 = MARGEM + 0.05;
  const x2 = LARGURA - MARGEM - 0.05;
  return [
    linha(-0.04, 1.1, -0.04, PROFUNDIDADE - 1.1, ALTURA_DA_CERCA, 0.34),
    linha(LARGURA + 0.04, 1.1, LARGURA + 0.04, PROFUNDIDADE - 1.1, ALTURA_DA_CERCA, 0.34),
    linha(x1, BEIRADA, x2, BEIRADA, ALTURA_DA_BEIRADA, 0.14, { ...beirada, dentro: [0, 1] }),
    linha(x1, PROFUNDIDADE - BEIRADA, x2, PROFUNDIDADE - BEIRADA, ALTURA_DA_BEIRADA, 0.14, { ...beirada, dentro: [0, -1] }),
  ];
}

/**
 * A PRAÇA (19/11/2026): as mesmas pontas de quarter, e no meio a PIRÂMIDE (sobe, um patamar, desce), um corrimão de través
 * (ao longo do x), duas caixas compridas dos lados e dois "kickers" (as rampas de salto) virados para elas. Só as peças que o
 * parque já usa: os perfis medidos continuam valendo.
 */
function montarPraca(): { pecas: Peca[]; trilhos: Trilho[] } {
  const pecas: Peca[] = [];
  quarters(pecas);
  // a pirâmide: em x 5 a 7; de quem vem do fundo (+z) sobe em z 11→10,5, o patamar até 9,5, e desce até 9
  for (const x of [5.5, 6.5]) {
    pecas.push({ modelo: 'ramp', x, z: 10.5, rot: 0, perfil: 'rampa' });
    pecas.push({ modelo: 'ramp', x, z: 9.5, rot: 2, perfil: 'rampa' });
  }
  // o corrimão de través, perto da ponta de cá
  for (let i = 3; i < 9; i++) pecas.push({ modelo: 'rail-low', x: i + 0.5, z: 4.5, rot: 1, perfil: 'corrimao' });
  // as caixas compridas dos lados
  for (let j = 8; j < 14; j++) {
    pecas.push({ modelo: 'obstacle-box-grind', x: 1.5, z: j + 0.5, rot: 0, perfil: 'caixa' });
    pecas.push({ modelo: 'obstacle-box-grind', x: 10.5, z: j + 0.5, rot: 0, perfil: 'caixa' });
  }
  // os kickers: de quem vai ao fundo (−z), virados para a ponta de cá, um de cada lado do corrimão
  pecas.push({ modelo: 'ramp', x: 1.5, z: 6.5, rot: 0, perfil: 'rampa' });
  pecas.push({ modelo: 'ramp', x: 10.5, z: 6.5, rot: 0, perfil: 'rampa' });
  // enfeite, do lado de fora da cerca
  for (const z of [4.5, 13.5]) {
    pecas.push({ modelo: 'bench', x: -0.7, z, rot: 1 });
    pecas.push({ modelo: 'bench', x: LARGURA + 0.7, z, rot: 3 });
  }
  pecas.push({ modelo: 'structure-wood-platform', x: -1.6, z: 9, rot: 1 });
  pecas.push({ modelo: 'pallet', x: LARGURA + 1.2, z: 9, rot: 0 });
  const trilhos = [
    linha(3, 4.5, 9, 4.5, 0.25, 0.22),
    linha(1.5, 8, 1.5, 14, 0.21, 0.3),
    linha(10.5, 8, 10.5, 14, 0.21, 0.3),
    ...linhasDaBorda(),
  ];
  return { pecas, trilhos };
}

export interface Pista {
  id: string;
  pecas: Peca[];
  trilhos: Trilho[];
  objetivos: Objetivos;
  /** O segundo conjunto de objetivos (21/11/2026). */
  segundo: SegundoConjunto;
  /** As peças que têm chão (as do perfil), indexadas pela casa que tocam. */
  porCasa: number[][];
}

function criarPista(id: string, m: { pecas: Peca[]; trilhos: Trilho[] }, objetivos: Objetivos, segundo: SegundoConjunto): Pista {
  const grade: number[][] = Array.from({ length: LARGURA * PROFUNDIDADE }, () => []);
  m.pecas.forEach((p, i) => {
    if (!p.perfil) return;
    // todas as peças com perfil ocupam (no máximo) a própria casa
    const cx = Math.floor(p.x);
    const cz = Math.floor(p.z);
    if (cx >= 0 && cx < LARGURA && cz >= 0 && cz < PROFUNDIDADE) grade[cz * LARGURA + cx].push(i);
  });
  return { id, pecas: m.pecas, trilhos: m.trilhos, objetivos, segundo, porCasa: grade };
}

/**
 * AS PISTAS, pela ordem (o índice vai no skatista). Pista nova é id novo, no FIM da lista: os recordes de uma não se misturam
 * com os da outra. O parque é o de sempre (o recorde dele continua o de skate_recordes_1min).
 */
export const PISTAS: Pista[] = [
  criarPista('parque-1', montarParque(), {
    // T acima da rampa de cá, O em cima do corrimão, C no alto do quarter do fundo, A acima da caixa
    letras: [
      { x: 6, y: 1.0, z: 4.6 },
      { x: 3.5, y: 0.95, z: 8.5 },
      { x: 6, y: 1.55, z: 0.45 },
      { x: 8.5, y: 0.9, z: 9 },
    ],
    // a fita: no alto do quarter do fundo, num canto
    fita: { x: 11.2, y: 2.3, z: 17.7 },
    pontos: 12000,
    combo: 2500,
    saltos: [
      // de uma rampa de salto à outra, por cima do corredor do meio
      { id: 'meio', de: { x0: 5, x1: 7, z0: 13, z1: 14.2 }, ate: { x0: 4, x1: 8, z0: 3, z1: 9 }, pontos: 400 },
      // da rampa de cá para cima da caixa
      { id: 'caixa', de: { x0: 5, x1: 7, z0: 3.8, z1: 5 }, ate: { x0: 8.2, x1: 8.8, z0: 7, z1: 11 }, pontos: 350 },
    ],
  }, {
    // o segundo: P acima da rampa de lá, U na outra ponta do corrimão, L no alto do quarter de cá, O na outra ponta da caixa
    letras: [
      { x: 6, y: 1.0, z: 13.4 },
      { x: 3.5, y: 0.95, z: 10.5 },
      { x: 6, y: 1.55, z: 17.55 },
      { x: 8.5, y: 0.9, z: 7.5 },
    ],
    // a fita: no alto do quarter de lá, no outro canto
    fita: { x: 0.8, y: 2.3, z: 0.3 },
    pontos: 20000,
    combo: 5000,
    saltos: [],
    giro: 540,
    manual: 3,
  }),
  criarPista('praca-1', montarPraca(), {
    // T no alto da pirâmide, O acima do corrimão, C no alto do quarter de cá, A no fim da caixa da direita
    letras: [
      { x: 6, y: 1.25, z: 10 },
      { x: 6, y: 1.0, z: 4.5 },
      { x: 2, y: 1.55, z: 17.55 },
      { x: 10.5, y: 0.9, z: 8.4 },
    ],
    fita: { x: 0.6, y: 2.3, z: 0.3 },
    pontos: 12000,
    combo: 2500,
    saltos: [
      // a pirâmide inteira, de uma boca à outra
      { id: 'piramide', de: { x0: 5, x1: 7, z0: 10.4, z1: 11.2 }, ate: { x0: 4.5, x1: 7.5, z0: 4, z1: 9.1 }, pontos: 400 },
      // do kicker da esquerda até a ponta de cá
      { id: 'esquerda', de: { x0: 1, x1: 2, z0: 5.9, z1: 7 }, ate: { x0: 0.2, x1: 4, z0: 0.15, z1: 4.2 }, pontos: 350 },
      // do kicker da direita até o quarter de cá
      { id: 'quarter', de: { x0: 10, x1: 11, z0: 5.9, z1: 7 }, ate: { x0: 7, x1: 11.9, z0: 0.15, z1: 1 }, pontos: 450 },
    ],
  }, {
    // o segundo: P no alto da pirâmide (do outro lado), U no alto do quarter de lá, L no outro canto do quarter de cá, O no fim
    // da caixa da esquerda
    letras: [
      { x: 6, y: 1.25, z: 9.2 },
      { x: 6, y: 1.55, z: 0.45 },
      { x: 10, y: 1.55, z: 17.55 },
      { x: 1.5, y: 0.9, z: 8.4 },
    ],
    fita: { x: 11.4, y: 2.3, z: 17.7 },
    pontos: 20000,
    combo: 5000,
    saltos: [],
    giro: 540,
    manual: 3,
  }),
];
export const IDS_DAS_PISTAS = PISTAS.map((p) => p.id);

/** A pista que a física e o desenho leem agora (a física a escolhe a cada passo, pelo skatista). */
export let PECAS: Peca[] = PISTAS[0].pecas;
export let TRILHOS: Trilho[] = PISTAS[0].trilhos;
export let OBJETIVOS: Objetivos = PISTAS[0].objetivos;
export let SEGUNDO: SegundoConjunto = PISTAS[0].segundo;
let PORCASA: number[][] = PISTAS[0].porCasa;
let atual = 0;

/** Troca a pista que as contas leem (o índice em PISTAS; fora da lista, a primeira). */
export function usarPista(i: number) {
  if (i === atual) return;
  const p = PISTAS[i] ?? PISTAS[0];
  atual = PISTAS[i] ? i : 0;
  PECAS = p.pecas;
  TRILHOS = p.trilhos;
  OBJETIVOS = p.objetivos;
  SEGUNDO = p.segundo;
  PORCASA = p.porCasa;
}

/** O índice da pista pelo id (−1 se não existe). */
export const indiceDaPista = (id: unknown) => (typeof id === 'string' ? IDS_DAS_PISTAS.indexOf(id) : -1);


/** A peça de chão (índice em PECAS) que manda no ponto, ou −1 (o piso). */
export function pecaEm(x: number, z: number): number {
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  if (cx < 0 || cx >= LARGURA || cz < 0 || cz >= PROFUNDIDADE) return -1;
  let melhor = -1;
  let alto = 0;
  for (const i of PORCASA[cz * LARGURA + cx]) {
    const p = PECAS[i];
    const [lx, lz] = local(p, x, z);
    if (lx < -meiaLargura(p.perfil!) || lx > meiaLargura(p.perfil!) || lz < -0.5 || lz > 0.5) continue;
    const h = alturaLocal(p.perfil!, lx, lz);
    if (melhor < 0 || h > alto) {
      melhor = i;
      alto = h;
    }
  }
  return melhor;
}

/**
 * A altura da superfície da peça `i` no ponto (−1: o piso, 0). Fora da peça, a superfície dela continua reta: é assim que a
 * física sabe, na borda entre duas peças, se o chão é contínuo (a boca do quarter no piso) ou um degrau (o lado da caixa).
 */
export function alturaDaPeca(i: number, x: number, z: number): number {
  if (i < 0) return 0;
  const p = PECAS[i];
  const [lx, lz] = local(p, x, z);
  return alturaLocal(p.perfil!, lx, lz);
}

/** A altura do chão no ponto (a peça mais alta que está ali, ou o piso). */
export function altura(x: number, z: number): number {
  return alturaDaPeca(pecaEm(x, z), x, z);
}

export function dentro(x: number, z: number): boolean {
  return x >= MARGEM && x <= LARGURA - MARGEM && z >= MARGEM && z <= PROFUNDIDADE - MARGEM;
}

/** Para que lado a peça SOBE (o vetor unitário no chão), para o "vert" do quarter: a boca olha para o lado contrário. */
export function subidaDaPeca(i: number): [number, number] {
  const p = PECAS[i];
  // no local, o quarter e a rampa sobem para −z
  switch (p.rot) {
    case 0:
      return [0, -1];
    case 1:
      return [-1, 0];
    case 2:
      return [0, 1];
    case 3:
      return [1, 0];
  }
}

export const perfilDaPeca = (i: number): Perfil | null => (i < 0 ? null : (PECAS[i].perfil ?? null));
