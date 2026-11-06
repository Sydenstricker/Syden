/**
 * TOCAS E TORRES: A SIMULAÇÃO (05/11/2026). Estratégia em tempo real, SÓ A MECÂNICA do gênero (coletar, construir, treinar,
 * avançar de era, atacar): nada de nome, arte ou texto de jogo nenhum.
 *
 * DETERMINÍSTICA, EM PASSO FIXO, E SEPARADA DA TELA. Dez passos por segundo; o mesmo começo (a semente) e os mesmos comandos, no
 * mesmo passo, dão a mesma partida, em qualquer computador. É isso que deixa a sala de duas pessoas possível depois, em
 * "lockstep": só os COMANDOS andam pela rede, e cada computador simula a partida inteira. Por isso:
 *  - nada de Math.random (o sorteio é o da semente, `aleatorio`), nem de relógio, nem de seno e cosseno: só + − × ÷ e raiz,
 *    que dão o mesmo número em qualquer navegador;
 *  - tudo anda em ordem fixa (as listas na ordem dos ids), e o que muda o jogo só entra por `comandar` (a pessoa, o computador
 *    e o piloto automático usam o mesmo caminho);
 *  - a tela só LÊ (as posições de antes, `ax`/`ay`, servem para ela desenhar entre um passo e outro).
 *
 * O MAPA é uma grade de TAMANHO × TAMANHO casas, espelhada pelo centro (o lado de cada um é igual ao do outro). Prédios,
 * árvores, ouro e pedras ocupam casas (`grade`); as unidades andam livres por cima, com o caminho achado por A* na grade (8
 * direções, sem cortar quina). O portão é passagem só para quem é dono dele.
 */

export const PASSOS_POR_SEGUNDO = 10;
export const PASSO = 1 / PASSOS_POR_SEGUNDO;
export const TAMANHO = 44;
/** A partida tem um teto: 20 minutos. Chegando nele, ganha quem tem mais (pontos), para ninguém ficar preso. */
export const PASSOS_MAX = 20 * 60 * PASSOS_POR_SEGUNDO;
/** A Maravilha pronta e de pé por 2 minutos ganha a partida. */
export const PASSOS_DA_MARAVILHA = 2 * 60 * PASSOS_POR_SEGUNDO;
export const POP_MAX = 60;
/** Quanto um trabalhador leva de uma vez. */
export const CARGA = 10;
/**
 * A CAPACIDADE DE CADA LUGAR DE COLETA (06/11/2026, pedido dele: "Fazenda 0/1, mina 0/5"): quantos trabalhadores de UM dono
 * cabem nele ao mesmo tempo. A fazenda é de um só; a MINA é o bloco de ouro inteiro (as casas de ouro encostadas, `minaDe`), e
 * cabem 5 de cada lado. A árvore não tem limite (o bosque já se limita pelas casas livres em volta). Quem passa do limite vai a
 * outro lugar igual com vaga, perto; sem nenhum, fica parado ao lado (e aparece como trabalhador parado).
 */
export const CAPACIDADE = { fazenda: 1, mina: 5 } as const;
/** O sino com gente dentro: o centro solta uma flecha a mais a cada 2 abrigados, até 5 a mais. */
export const FLECHAS_DO_SINO = { cada: 2, max: 5 } as const;

export type Dono = 0 | 1;
export type Recurso = 'comida' | 'madeira' | 'ouro';
export type TipoUnidade = 'trabalhador' | 'lanceiro' | 'arqueiro' | 'cavaleiro' | 'catapulta';
export type TipoPredio = 'centro' | 'casa' | 'fazenda' | 'quartel' | 'arquearia' | 'torre' | 'muralha' | 'portao' | 'maravilha';
export type Custo = Partial<Record<Recurso, number>>;
export const RECURSOS: Recurso[] = ['comida', 'madeira', 'ouro'];

export interface DadosDaUnidade {
  vida: number;
  ataque: number;
  /** O golpe contra prédio (a catapulta é forte aqui; quem bate de perto, fraco). */
  contraPredio: number;
  /** Em casas, de centro a centro (contra prédio, até a borda dele). */
  alcance: number;
  /** Mais perto que isto, não atira (a catapulta). */
  alcanceMin: number;
  /** Passos entre um golpe e outro. */
  recarga: number;
  /** Casas por passo. */
  velocidade: number;
  visao: number;
  custo: Custo;
  /** Passos para treinar. */
  tempo: number;
  de: TipoPredio;
  era: 1 | 2;
  /** A pedra-papel-tesoura: o golpe contra este tipo vale `vezes` mais. */
  bonus?: { contra: TipoUnidade; vezes: number };
  combate: boolean;
}

/** Lanceiro > cavaleiro > arqueiro > lanceiro; a catapulta derruba prédio e muralha, e de perto não faz nada. */
export const UNIDADES: Record<TipoUnidade, DadosDaUnidade> = {
  trabalhador: { vida: 30, ataque: 3, contraPredio: 2, alcance: 0.9, alcanceMin: 0, recarga: 15, velocidade: 0.13, visao: 4.5, custo: { comida: 50 }, tempo: 100, de: 'centro', era: 1, combate: false },
  lanceiro: { vida: 55, ataque: 5, contraPredio: 3, alcance: 0.95, alcanceMin: 0, recarga: 15, velocidade: 0.12, visao: 5, custo: { comida: 35, madeira: 25 }, tempo: 110, de: 'quartel', era: 1, bonus: { contra: 'cavaleiro', vezes: 3 }, combate: true },
  cavaleiro: { vida: 100, ataque: 8, contraPredio: 4, alcance: 1.05, alcanceMin: 0, recarga: 18, velocidade: 0.2, visao: 6, custo: { comida: 70, ouro: 60 }, tempo: 140, de: 'quartel', era: 1, bonus: { contra: 'arqueiro', vezes: 2.5 }, combate: true },
  arqueiro: { vida: 35, ataque: 4, contraPredio: 1, alcance: 5, alcanceMin: 0, recarga: 20, velocidade: 0.12, visao: 7, custo: { madeira: 25, ouro: 40 }, tempo: 110, de: 'arquearia', era: 1, bonus: { contra: 'lanceiro', vezes: 2.5 }, combate: true },
  catapulta: { vida: 90, ataque: 6, contraPredio: 50, alcance: 7, alcanceMin: 2.5, recarga: 50, velocidade: 0.07, visao: 8, custo: { madeira: 180, ouro: 120 }, tempo: 200, de: 'quartel', era: 2, combate: true },
};

export interface DadosDoPredio {
  tam: number;
  vida: number;
  custo: Custo;
  /** Passos de trabalho (com um trabalhador; dois fazem na metade). */
  tempo: number;
  era: 1 | 2;
  pop?: number;
  ataque?: number;
  alcance?: number;
  recarga?: number;
  visao: number;
  /** Quem dá para construir (o centro já vem, e não se faz outro). */
  construivel: boolean;
}

export const PREDIOS: Record<TipoPredio, DadosDoPredio> = {
  centro: { tam: 3, vida: 2000, custo: {}, tempo: 1, era: 1, pop: 5, ataque: 4, alcance: 6, recarga: 15, visao: 8, construivel: false },
  casa: { tam: 2, vida: 350, custo: { madeira: 30 }, tempo: 150, era: 1, pop: 5, visao: 3, construivel: true },
  fazenda: { tam: 2, vida: 200, custo: { madeira: 60 }, tempo: 120, era: 1, visao: 2, construivel: true },
  quartel: { tam: 3, vida: 800, custo: { madeira: 150 }, tempo: 300, era: 1, visao: 4, construivel: true },
  arquearia: { tam: 3, vida: 800, custo: { madeira: 150 }, tempo: 300, era: 1, visao: 4, construivel: true },
  torre: { tam: 1, vida: 600, custo: { madeira: 100, ouro: 60 }, tempo: 350, era: 1, ataque: 5, alcance: 6.5, recarga: 15, visao: 8, construivel: true },
  muralha: { tam: 1, vida: 500, custo: { madeira: 6 }, tempo: 40, era: 1, visao: 2, construivel: true },
  portao: { tam: 1, vida: 600, custo: { madeira: 25 }, tempo: 80, era: 1, visao: 2, construivel: true },
  maravilha: { tam: 4, vida: 2400, custo: { comida: 400, madeira: 600, ouro: 500 }, tempo: 1500, era: 2, visao: 6, construivel: true },
};

/** Avançar de era: no centro da vila, com o custo e o tempo; a era 2 deixa a vida e o golpe maiores, e abre a catapulta e a Maravilha. */
export const ERA2 = { custo: { comida: 400, ouro: 200 } as Custo, tempo: 400, vidaUnidade: 1.2, ataque: 1.25, vidaPredio: 1.5 };

/** Passos de trabalho por unidade de recurso. */
const RITMO: Record<Recurso, number> = { comida: 13, madeira: 12, ouro: 14 };
const MADEIRA_DA_ARVORE = 100;
const OURO_DA_PEDRA = 350;
const DIAG = 1.4142135623730951;

export interface Ordem {
  tipo: 'parado' | 'mover' | 'atacar' | 'coletar' | 'entregar' | 'construir' | 'abrigar';
  x?: number;
  y?: number;
  /** Mover atacando quem aparecer no caminho. */
  atacando?: boolean;
  alvo?: number;
  /** De onde voltar depois de entregar (a fonte ou a fazenda). */
  volta?: number;
  /** A ordem a retomar depois de um ataque que apareceu no caminho. */
  depois?: Ordem;
}

export interface Unidade {
  id: number;
  tipo: TipoUnidade;
  dono: Dono;
  x: number;
  y: number;
  /** Onde estava no passo de antes (a tela desenha entre um e outro). */
  ax: number;
  ay: number;
  /** Para onde olha (um vetor, sem ângulo). */
  rx: number;
  ry: number;
  vida: number;
  vidaMax: number;
  ordem: Ordem;
  caminho: number[];
  /** O passo em que o caminho foi achado (ataque a quem anda: acha de novo de tempos em tempos). */
  achouEm: number;
  recarga: number;
  carga: { rec: Recurso; qtd: number } | null;
  /** Os passos de trabalho na unidade de recurso em andamento. */
  trabalho: number;
  /** O que a tela mostra: a animação. */
  acao: 'parado' | 'andando' | 'trabalhando' | 'atacando';
  /** Quem bateu por último (para revidar), e quando. */
  atacadoPor: number;
  /** O SINO: o id do centro onde está abrigado (0 fora). Abrigado, não aparece, não se mexe, não apanha e não recebe ordem. */
  abrigado: number;
  /** O que fazia quando o sino tocou (o segundo toque devolve). */
  antesDoSino: Ordem | null;
}

export interface Predio {
  id: number;
  tipo: TipoPredio;
  dono: Dono;
  gx: number;
  gy: number;
  tam: number;
  vida: number;
  vidaMax: number;
  progresso: number;
  pronto: boolean;
  fila: TipoUnidade[];
  treino: number;
  /** O avanço de era em andamento (no centro), em passos; 0 sem pesquisa. */
  pesquisa: number;
  recarga: number;
  /** A era em que ficou pronto (a tela escolhe o modelo). */
  era: 1 | 2;
  /**
   * O PONTO DE REUNIÃO (05/11/2026, pedido dele: "clicar com o direito deveria alterar o local de geração da unidade"): quem
   * nasce aqui vai para lá sozinho. Com `alvo` (uma fonte, a fazenda, um inimigo), quem nasce recebe o mesmo clique direito
   * sobre ele (o trabalhador vai coletar, o soldado atacar). Null: fica na porta.
   */
  reuniao: { x: number; y: number; alvo?: number } | null;
  /** O SINO do centro (06/11/2026, pedido dele): tocado, todos os trabalhadores do dono vão para dentro; tocado de novo, voltam. */
  sino: boolean;
}

export interface Fonte {
  id: number;
  tipo: 'arvore' | 'ouro';
  gx: number;
  gy: number;
  qtd: number;
  variante: number;
}

export interface Jogador {
  recursos: Record<Recurso, number>;
  era: 1 | 2;
  /** Passos com a Maravilha pronta e de pé. */
  maravilha: number;
  visivel: Uint8Array;
  explorado: Uint8Array;
}

export type Evento =
  | { t: 'golpe'; de: number; alvo: number; dono: Dono; arma: 'corpo' | 'flecha' | 'pedra'; x0: number; y0: number; x1: number; y1: number }
  | { t: 'morte'; id: number; dono: Dono; tipo: TipoUnidade | TipoPredio; predio: boolean; x: number; y: number }
  | { t: 'pronto'; id: number; dono: Dono; tipo: TipoPredio }
  | { t: 'treinou'; id: number; dono: Dono; tipo: TipoUnidade }
  | { t: 'entregou'; dono: Dono; rec: Recurso; qtd: number }
  | { t: 'esgotou'; id: number }
  | { t: 'era'; dono: Dono }
  | { t: 'maravilha'; dono: Dono }
  | { t: 'atacado'; dono: Dono; x: number; y: number }
  /** Mandou trabalhador a um lugar cheio (a fazenda, a mina) e não havia outro com vaga perto. */
  | { t: 'cheio'; dono: Dono; id: number }
  | { t: 'sino'; dono: Dono; tocado: boolean }
  | { t: 'fim'; vencedor: Dono; motivo: Motivo };

export type Motivo = 'centro' | 'maravilha' | 'tempo';

export type Comando =
  | { t: 'mover'; ids: number[]; x: number; y: number; atacando?: boolean }
  /** O clique direito em alguém ou em algo: atacar o inimigo, coletar a fonte ou a fazenda, ajudar a construir. */
  | { t: 'alvo'; ids: number[]; alvo: number }
  | { t: 'construir'; ids: number[]; tipo: TipoPredio; gx: number; gy: number }
  /** Uma linha reta de muralha (na horizontal ou na vertical), de uma casa a outra. */
  | { t: 'muralha'; ids: number[]; gx0: number; gy0: number; gx1: number; gy1: number }
  | { t: 'treinar'; predio: number; unidade: TipoUnidade }
  | { t: 'cancelar'; predio: number }
  /** O ponto de reunião do prédio: no chão, ou em cima de algo (`alvo`). */
  | { t: 'reuniao'; predio: number; x: number; y: number; alvo?: number }
  | { t: 'era'; predio: number }
  /** O sino do centro: o primeiro toque abriga todos os trabalhadores, o segundo os devolve ao que faziam. */
  | { t: 'sino'; predio: number }
  | { t: 'parar'; ids: number[] };

export interface Sim {
  passo: number;
  semente: number;
  jogadores: [Jogador, Jogador];
  unidades: Unidade[];
  predios: Predio[];
  fontes: Fonte[];
  /** Quem ocupa cada casa: o id do prédio ou da fonte, -1 pedra, 0 livre. */
  grade: Int32Array;
  pedras: { gx: number; gy: number }[];
  proximoId: number;
  eventos: Evento[];
  fila: { dono: Dono; c: Comando }[];
  vencedor: Dono | null;
  motivo: Motivo | null;
  porId: Map<number, Unidade | Predio | Fonte>;
  /** O último aviso de ataque, por dono (para não repetir a cada golpe). */
  avisoEm: [number, number];
  rnd: () => number;
  /** O que era cada fonte que acabou (quem voltava a ela acha uma parecida perto). */
  acabadas: Map<number, { tipo: Fonte['tipo']; gx: number; gy: number }>;
  /** A mina (o bloco de ouro encostado) de cada casa de ouro, pelo id da fonte; não se apaga quando a casa acaba. */
  minaDe: Map<number, number>;
}

// ---------------------------------------------------------------------------------------------------------------------
// O sorteio da semente e o mapa
// ---------------------------------------------------------------------------------------------------------------------

/** mulberry32: o mesmo número em qualquer lugar (só inteiros de 32 bits). */
export function aleatorio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ind = (x: number, y: number) => y * TAMANHO + x;
const dentro = (x: number, y: number) => x >= 0 && y >= 0 && x < TAMANHO && y < TAMANHO;

/** O canto do centro da vila de cada um (o do computador é o espelho). */
export const CENTRO_DE: [{ gx: number; gy: number }, { gx: number; gy: number }] = [
  { gx: 6, gy: 34 },
  { gx: TAMANHO - 6 - 3, gy: TAMANHO - 34 - 3 },
];

export function novaPartida(semente: number): Sim {
  const vazio = () => new Uint8Array(TAMANHO * TAMANHO);
  const jog = (): Jogador => ({ recursos: { comida: 200, madeira: 200, ouro: 100 }, era: 1, maravilha: 0, visivel: vazio(), explorado: vazio() });
  const sim: Sim = {
    passo: 0,
    semente,
    jogadores: [jog(), jog()],
    unidades: [],
    predios: [],
    fontes: [],
    grade: new Int32Array(TAMANHO * TAMANHO),
    pedras: [],
    proximoId: 1,
    eventos: [],
    fila: [],
    vencedor: null,
    motivo: null,
    porId: new Map(),
    avisoEm: [-999, -999],
    rnd: aleatorio(semente),
    acabadas: new Map(),
    minaDe: new Map(),
  };
  gerarMapa(sim);
  juntarMinas(sim);
  for (const d of [0, 1] as Dono[]) {
    const c = CENTRO_DE[d];
    const p = novoPredio(sim, d, 'centro', c.gx, c.gy);
    p.pronto = true;
    p.progresso = PREDIOS.centro.tempo;
    p.vida = p.vidaMax;
    for (let i = 0; i < 3; i++) {
      const lugar = casaLivrePerto(sim, p.gx, p.gy, p.tam, d, d === 0 ? i + 10 : i + 10);
      novaUnidade(sim, d, 'trabalhador', lugar.x + 0.5, lugar.y + 0.5);
    }
  }
  verNevoa(sim);
  return sim;
}

/** Põe na casa e no espelho dela, só se as duas estiverem livres e longe dos centros. */
function gerarMapa(sim: Sim) {
  const r = sim.rnd;
  const longeDosCentros = (x: number, y: number, folga: number) =>
    CENTRO_DE.every((c) => x < c.gx - folga || x >= c.gx + 3 + folga || y < c.gy - folga || y >= c.gy + 3 + folga);
  const par = (x: number, y: number, por: (x: number, y: number) => void, folga = 4) => {
    const mx = TAMANHO - 1 - x;
    const my = TAMANHO - 1 - y;
    if (!dentro(x, y) || sim.grade[ind(x, y)] !== 0 || sim.grade[ind(mx, my)] !== 0) return false;
    if (!longeDosCentros(x, y, folga) || !longeDosCentros(mx, my, folga)) return false;
    por(x, y);
    if (mx !== x || my !== y) por(mx, my);
    return true;
  };
  const arvore = (x: number, y: number) => {
    const f: Fonte = { id: sim.proximoId++, tipo: 'arvore', gx: x, gy: y, qtd: MADEIRA_DA_ARVORE, variante: Math.floor(r() * 3) };
    sim.fontes.push(f);
    sim.porId.set(f.id, f);
    sim.grade[ind(x, y)] = f.id;
  };
  const ouro = (x: number, y: number) => {
    const f: Fonte = { id: sim.proximoId++, tipo: 'ouro', gx: x, gy: y, qtd: OURO_DA_PEDRA, variante: 0 };
    sim.fontes.push(f);
    sim.porId.set(f.id, f);
    sim.grade[ind(x, y)] = f.id;
  };
  const pedra = (x: number, y: number) => {
    sim.grade[ind(x, y)] = -1;
    sim.pedras.push({ gx: x, gy: y });
  };
  /** Um bosque: começa numa casa e cresce para as vizinhas, sorteando. */
  const bosque = (cx: number, cy: number, n: number) => {
    const lista: [number, number][] = [[cx, cy]];
    let feitas = 0;
    for (let tent = 0; tent < n * 8 && feitas < n; tent++) {
      const [bx, by] = lista[Math.floor(r() * lista.length)];
      const dx = Math.floor(r() * 3) - 1;
      const dy = Math.floor(r() * 3) - 1;
      const x = bx + dx;
      const y = by + dy;
      if (par(x, y, arvore)) {
        lista.push([x, y]);
        feitas++;
      }
    }
  };
  // o ouro de cada base (um bloco de 2 × 3), e o do meio, que é de quem chegar
  for (let x = 13; x <= 14; x++) for (let y = 29; y <= 31; y++) par(x, y, ouro);
  for (const [x, y] of [[21, 21], [21, 22]] as [number, number][]) par(x, y, ouro, 0);
  // as pedras (montanhas): obstáculos que desenham o caminho
  for (const [x, y] of [[16, 16], [17, 16], [16, 17], [17, 17], [26, 12], [27, 12], [26, 13], [27, 13], [9, 22], [10, 22], [9, 23], [10, 23]] as [number, number][]) par(x, y, pedra, 2);
  // os bosques: um perto de cada base, um na borda, e os do meio, que fecham as passagens pela metade
  bosque(16, 39, 26);
  bosque(3, 26, 22);
  bosque(11, 41, 10);
  bosque(22, 32, 14);
  bosque(13, 10, 18);
  bosque(31, 22, 10);
  bosque(4, 14, 12);
  for (let i = 0; i < 26; i++) par(Math.floor(r() * TAMANHO), Math.floor(r() * TAMANHO), arvore, 5);
}

/** As casas de ouro encostadas (nas 8 direções) viram uma mina só, numerada de 1 na ordem das fontes. */
function juntarMinas(sim: Sim) {
  const ouros = sim.fontes.filter((f) => f.tipo === 'ouro');
  const porCasa = new Map(ouros.map((f) => [ind(f.gx, f.gy), f]));
  let n = 0;
  for (const f of ouros) {
    if (sim.minaDe.has(f.id)) continue;
    n++;
    const pilha = [f];
    sim.minaDe.set(f.id, n);
    while (pilha.length) {
      const a = pilha.pop()!;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dentro(a.gx + dx, a.gy + dy)) continue;
          const b = porCasa.get(ind(a.gx + dx, a.gy + dy));
          if (!b || sim.minaDe.has(b.id)) continue;
          sim.minaDe.set(b.id, n);
          pilha.push(b);
        }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Criar e achar
// ---------------------------------------------------------------------------------------------------------------------

function novaUnidade(sim: Sim, dono: Dono, tipo: TipoUnidade, x: number, y: number): Unidade {
  const d = UNIDADES[tipo];
  const vida = Math.round(d.vida * (sim.jogadores[dono].era === 2 ? ERA2.vidaUnidade : 1));
  const u: Unidade = {
    id: sim.proximoId++,
    tipo,
    dono,
    x,
    y,
    ax: x,
    ay: y,
    rx: 0,
    ry: dono === 0 ? -1 : 1,
    vida,
    vidaMax: vida,
    ordem: { tipo: 'parado' },
    caminho: [],
    achouEm: -99,
    recarga: 0,
    carga: null,
    trabalho: 0,
    acao: 'parado',
    atacadoPor: 0,
    abrigado: 0,
    antesDoSino: null,
  };
  sim.unidades.push(u);
  sim.porId.set(u.id, u);
  return u;
}

function novoPredio(sim: Sim, dono: Dono, tipo: TipoPredio, gx: number, gy: number): Predio {
  const d = PREDIOS[tipo];
  const era = sim.jogadores[dono].era;
  const vidaMax = Math.round(d.vida * (era === 2 ? ERA2.vidaPredio : 1));
  const p: Predio = {
    id: sim.proximoId++,
    tipo,
    dono,
    gx,
    gy,
    tam: d.tam,
    vida: Math.max(1, Math.round(vidaMax * 0.1)),
    vidaMax,
    progresso: 0,
    pronto: false,
    fila: [],
    treino: 0,
    pesquisa: 0,
    recarga: 0,
    era,
    reuniao: null,
    sino: false,
  };
  sim.predios.push(p);
  sim.porId.set(p.id, p);
  for (let y = gy; y < gy + d.tam; y++) for (let x = gx; x < gx + d.tam; x++) sim.grade[ind(x, y)] = p.id;
  // quem estava em cima sai para a casa livre mais perto
  for (const u of sim.unidades) {
    if (u.x >= gx && u.x < gx + d.tam && u.y >= gy && u.y < gy + d.tam) {
      const c = casaLivrePerto(sim, gx, gy, d.tam, u.dono, u.id);
      u.x = u.ax = c.x + 0.5;
      u.y = u.ay = c.y + 0.5;
      u.caminho = [];
    }
  }
  return p;
}

export function eUnidade(e: Unidade | Predio | Fonte | undefined): e is Unidade {
  return !!e && 'ordem' in e;
}
export function ePredio(e: Unidade | Predio | Fonte | undefined): e is Predio {
  return !!e && 'fila' in e;
}
export function eFonte(e: Unidade | Predio | Fonte | undefined): e is Fonte {
  return !!e && 'qtd' in e;
}

/** A casa livre (e passável para `dono`) mais perto da borda de um retângulo; `salto` espalha quem sai junto. */
function casaLivrePerto(sim: Sim, gx: number, gy: number, tam: number, dono: Dono, salto = 0): { x: number; y: number } {
  const cand: { x: number; y: number }[] = [];
  for (let anel = 1; anel < 12 && cand.length === 0; anel++) {
    for (let y = gy - anel; y < gy + tam + anel; y++) {
      for (let x = gx - anel; x < gx + tam + anel; x++) {
        const borda = x === gx - anel || x === gx + tam + anel - 1 || y === gy - anel || y === gy + tam + anel - 1;
        if (!borda || !dentro(x, y) || !passavel(sim, ind(x, y), dono)) continue;
        cand.push({ x, y });
      }
    }
  }
  if (!cand.length) return { x: gx, y: gy };
  // o lado de baixo (para quem está no canto de cima) primeiro, e um salto pelo número para não sair todo mundo no mesmo lugar
  return cand[salto % cand.length];
}

export function passavel(sim: Sim, i: number, dono: Dono): boolean {
  const g = sim.grade[i];
  if (g === 0) return true;
  if (g < 0) return false;
  const e = sim.porId.get(g);
  return ePredio(e) && e.tipo === 'portao' && e.dono === dono;
}

export function populacao(sim: Sim, dono: Dono): { usada: number; max: number } {
  let usada = 0;
  for (const u of sim.unidades) if (u.dono === dono) usada++;
  for (const p of sim.predios) if (p.dono === dono && p.fila.length) usada += 0; // a fila não reserva lugar: espera na porta
  let max = 0;
  for (const p of sim.predios) if (p.dono === dono && p.pronto) max += PREDIOS[p.tipo].pop ?? 0;
  return { usada, max: Math.min(POP_MAX, max) };
}

/**
 * O LUGAR DE COLETA de um alvo: a chave (o id da fazenda, ou o número da mina com o sinal trocado) e quantos cabem; null para o
 * que não tem limite (a árvore) ou não é lugar de coleta.
 */
export function lugarDeColeta(sim: Sim, id: number): { chave: number; cap: number } | null {
  const mina = sim.minaDe.get(id);
  if (mina !== undefined) return { chave: -mina, cap: CAPACIDADE.mina };
  const e = sim.porId.get(id);
  if (ePredio(e) && e.tipo === 'fazenda') return { chave: e.id, cap: CAPACIDADE.fazenda };
  return null;
}

/** A chave do lugar em que o trabalhador está colhendo (indo, colhendo ou levando a carga para voltar), ou null. */
function chaveDoTrabalho(sim: Sim, u: Unidade): number | null {
  if (u.tipo !== 'trabalhador' || u.abrigado || u.vida <= 0) return null;
  const o = u.ordem;
  const id = o.tipo === 'coletar' ? o.alvo : o.tipo === 'entregar' ? o.volta : undefined;
  if (id === undefined) return null;
  return lugarDeColeta(sim, id)?.chave ?? null;
}

/** Quantos trabalhadores do dono estão no lugar de coleta (a chave de `lugarDeColeta`), sem contar `fora`. */
export function ocupantes(sim: Sim, dono: Dono, chave: number, fora = 0): number {
  let n = 0;
  for (const u of sim.unidades) if (u.dono === dono && u.id !== fora && chaveDoTrabalho(sim, u) === chave) n++;
  return n;
}

/** Cabe mais este trabalhador (`quem`) no lugar do alvo? Sem limite, sempre. */
export function temVaga(sim: Sim, dono: Dono, alvo: number, quem = 0): boolean {
  const l = lugarDeColeta(sim, alvo);
  return !l || ocupantes(sim, dono, l.chave, quem) < l.cap;
}

/** Outro lugar igual com vaga, perto do alvo cheio: outra fazenda pronta do dono, ou uma casa de ouro de outra mina. */
function vagaPerto(sim: Sim, u: Unidade, alvo: number): number {
  const e = sim.porId.get(alvo);
  if (!e) return 0;
  const c = centroDe(e);
  let melhor = 0;
  let dist = 12 * 12;
  const ver = (id: number, x: number, y: number) => {
    const q = (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y);
    if (q < dist && temVaga(sim, u.dono, id, u.id)) {
      dist = q;
      melhor = id;
    }
  };
  if (ePredio(e) && e.tipo === 'fazenda') {
    for (const p of sim.predios) if (p.dono === u.dono && p.tipo === 'fazenda' && p.pronto && p.id !== e.id) ver(p.id, p.gx + 1, p.gy + 1);
  } else if (eFonte(e) && e.tipo === 'ouro') {
    for (const f of sim.fontes) if (f.tipo === 'ouro' && acessivel(sim, f, u.dono)) ver(f.id, f.gx + 0.5, f.gy + 0.5);
  }
  return melhor;
}

/** Manda colher no alvo respeitando a capacidade (ou noutro igual com vaga, perto); sem nenhum, false e nada muda. */
function irColetar(sim: Sim, u: Unidade, alvo: number): boolean {
  const onde = temVaga(sim, u.dono, alvo, u.id) ? alvo : vagaPerto(sim, u, alvo);
  if (!onde) return false;
  u.ordem = { tipo: 'coletar', alvo: onde, volta: onde };
  return true;
}

export function podePagar(sim: Sim, dono: Dono, custo: Custo): boolean {
  const r = sim.jogadores[dono].recursos;
  return RECURSOS.every((k) => r[k] >= (custo[k] ?? 0));
}
function pagar(sim: Sim, dono: Dono, custo: Custo, vezes = 1) {
  const r = sim.jogadores[dono].recursos;
  for (const k of RECURSOS) r[k] -= (custo[k] ?? 0) * vezes;
}

/** Dá para pôr este prédio aqui? Dentro do mapa, nas casas livres, onde o dono já viu, e com a era certa. */
export function podeConstruir(sim: Sim, dono: Dono, tipo: TipoPredio, gx: number, gy: number): boolean {
  const d = PREDIOS[tipo];
  if (!d.construivel || sim.jogadores[dono].era < d.era) return false;
  if (gx < 0 || gy < 0 || gx + d.tam > TAMANHO || gy + d.tam > TAMANHO) return false;
  const j = sim.jogadores[dono];
  for (let y = gy; y < gy + d.tam; y++)
    for (let x = gx; x < gx + d.tam; x++) {
      const i = ind(x, y);
      if (sim.grade[i] !== 0 || !j.explorado[i]) return false;
    }
  if (tipo === 'maravilha' && sim.predios.some((p) => p.dono === dono && p.tipo === 'maravilha')) return false;
  return true;
}

/** As casas de uma linha reta de muralha (a direção que mais anda manda; a outra é a da primeira casa). */
export function casasDaMuralha(gx0: number, gy0: number, gx1: number, gy1: number): { x: number; y: number }[] {
  const lista: { x: number; y: number }[] = [];
  if (Math.abs(gx1 - gx0) >= Math.abs(gy1 - gy0)) {
    const passo = gx1 >= gx0 ? 1 : -1;
    for (let x = gx0; x !== gx1 + passo && lista.length < 24; x += passo) lista.push({ x, y: gy0 });
  } else {
    const passo = gy1 >= gy0 ? 1 : -1;
    for (let y = gy0; y !== gy1 + passo && lista.length < 24; y += passo) lista.push({ x: gx0, y });
  }
  return lista;
}

/** A distância de um ponto até a borda de um prédio (0 dentro), ou até o centro de uma unidade. */
export function distancia(x: number, y: number, e: Unidade | Predio | Fonte): number {
  if (eUnidade(e)) {
    const dx = e.x - x;
    const dy = e.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  const tam = ePredio(e) ? e.tam : 1;
  const dx = Math.max(e.gx - x, 0, x - (e.gx + tam));
  const dy = Math.max(e.gy - y, 0, y - (e.gy + tam));
  return Math.sqrt(dx * dx + dy * dy);
}

export function centroDe(e: Unidade | Predio | Fonte): { x: number; y: number } {
  if (eUnidade(e)) return { x: e.x, y: e.y };
  const tam = ePredio(e) ? e.tam : 1;
  return { x: e.gx + tam / 2, y: e.gy + tam / 2 };
}

// ---------------------------------------------------------------------------------------------------------------------
// O caminho: A* na grade, 8 direções, sem cortar quina
// ---------------------------------------------------------------------------------------------------------------------

const N = TAMANHO * TAMANHO;
const custoG = new Float64Array(N);
const veio = new Int32Array(N);
const marca = new Int32Array(N);
const fechado = new Int32Array(N);
let rodada = 0;
const heap: number[] = [];
const prioridade = new Float64Array(N);
function empurrar(i: number) {
  heap.push(i);
  let k = heap.length - 1;
  while (k > 0) {
    const pai = (k - 1) >> 1;
    if (prioridade[heap[pai]] < prioridade[heap[k]] || (prioridade[heap[pai]] === prioridade[heap[k]] && heap[pai] < heap[k])) break;
    [heap[pai], heap[k]] = [heap[k], heap[pai]];
    k = pai;
  }
}
function tirar(): number {
  const topo = heap[0];
  const ult = heap.pop()!;
  if (heap.length) {
    heap[0] = ult;
    let k = 0;
    for (;;) {
      const a = 2 * k + 1;
      const b = a + 1;
      let m = k;
      const menor = (p: number, q: number) => prioridade[heap[p]] < prioridade[heap[q]] || (prioridade[heap[p]] === prioridade[heap[q]] && heap[p] < heap[q]);
      if (a < heap.length && menor(a, m)) m = a;
      if (b < heap.length && menor(b, m)) m = b;
      if (m === k) break;
      [heap[m], heap[k]] = [heap[k], heap[m]];
      k = m;
    }
  }
  return topo;
}

const VIZ: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, DIAG],
  [1, -1, DIAG],
  [-1, 1, DIAG],
  [-1, -1, DIAG],
];

/**
 * O caminho (as casas, sem a de saída) de (x, y) até o retângulo [x0, x1] × [y0, y1] (inclusive). `encostar`: basta chegar a
 * uma casa vizinha dele (para o prédio, a árvore, quem se ataca); senão, entrar nele. Sem caminho, vai até onde chegou mais perto.
 */
export function acharCaminho(sim: Sim, dono: Dono, x: number, y: number, x0: number, y0: number, x1: number, y1: number, encostar: boolean): number[] {
  rodada++;
  heap.length = 0;
  const sx = Math.min(TAMANHO - 1, Math.max(0, Math.floor(x)));
  const sy = Math.min(TAMANHO - 1, Math.max(0, Math.floor(y)));
  const inicio = ind(sx, sy);
  const h = (cx: number, cy: number) => {
    const dx = Math.max(x0 - cx, 0, cx - x1);
    const dy = Math.max(y0 - cy, 0, cy - y1);
    const a = Math.max(dx, dy);
    const b = Math.min(dx, dy);
    return a - b + b * DIAG;
  };
  const chegou = (cx: number, cy: number) => {
    const dx = Math.max(x0 - cx, 0, cx - x1);
    const dy = Math.max(y0 - cy, 0, cy - y1);
    return encostar ? dx <= 1 && dy <= 1 : dx === 0 && dy === 0;
  };
  custoG[inicio] = 0;
  veio[inicio] = -1;
  marca[inicio] = rodada;
  prioridade[inicio] = h(sx, sy);
  empurrar(inicio);
  let melhor = inicio;
  let melhorH = h(sx, sy);
  let achou = -1;
  let expandidas = 0;
  while (heap.length && expandidas < 2500) {
    const i = tirar();
    if (fechado[i] === rodada) continue;
    fechado[i] = rodada;
    expandidas++;
    const cx = i % TAMANHO;
    const cy = (i - cx) / TAMANHO;
    if (chegou(cx, cy)) {
      achou = i;
      break;
    }
    const hi = h(cx, cy);
    if (hi < melhorH) {
      melhorH = hi;
      melhor = i;
    }
    for (const [dx, dy, c] of VIZ) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!dentro(nx, ny)) continue;
      const ni = ind(nx, ny);
      if (fechado[ni] === rodada || !passavel(sim, ni, dono)) continue;
      if (dx && dy && (!passavel(sim, ind(cx + dx, cy), dono) || !passavel(sim, ind(cx, cy + dy), dono))) continue;
      const g = custoG[i] + c;
      if (marca[ni] === rodada && g >= custoG[ni]) continue;
      marca[ni] = rodada;
      custoG[ni] = g;
      veio[ni] = i;
      prioridade[ni] = g + h(nx, ny);
      empurrar(ni);
    }
  }
  let fim = achou >= 0 ? achou : melhor;
  const lista: number[] = [];
  while (fim !== inicio && fim >= 0) {
    lista.push(fim);
    fim = veio[fim];
  }
  return lista.reverse();
}

// ---------------------------------------------------------------------------------------------------------------------
// Os comandos
// ---------------------------------------------------------------------------------------------------------------------

/** Põe um comando na fila: ele vale no próximo passo (o mesmo para todo mundo, no lockstep). */
export function comandar(sim: Sim, dono: Dono, c: Comando) {
  sim.fila.push({ dono, c });
}

function minhas(sim: Sim, dono: Dono, ids: number[]): Unidade[] {
  const lista: Unidade[] = [];
  const vistos = new Set<number>();
  for (const id of ids.slice(0, 80)) {
    if (vistos.has(id)) continue;
    vistos.add(id);
    const u = sim.porId.get(id);
    if (eUnidade(u) && u.dono === dono && !u.abrigado) lista.push(u);
  }
  return lista;
}

/** Espalha quem vai junto em volta do ponto, em anéis, para não brigarem pela mesma casa. */
function espalhar(n: number, k: number): { dx: number; dy: number } {
  if (k === 0 || n === 1) return { dx: 0, dy: 0 };
  let anel = 1;
  let antes = 1;
  while (k >= antes + anel * 6) {
    antes += anel * 6;
    anel++;
  }
  const pos = k - antes;
  const total = anel * 6;
  // os pontos do anel sem seno: num quadrado de lado 2·anel, andando pela borda
  const lado = anel * 2;
  const perimetro = lado * 4;
  const t = (pos / total) * perimetro;
  let dx: number;
  let dy: number;
  if (t < lado) {
    dx = -anel + t;
    dy = -anel;
  } else if (t < 2 * lado) {
    dx = anel;
    dy = -anel + (t - lado);
  } else if (t < 3 * lado) {
    dx = anel - (t - 2 * lado);
    dy = anel;
  } else {
    dx = -anel;
    dy = anel - (t - 3 * lado);
  }
  return { dx: dx * 0.75, dy: dy * 0.75 };
}

function aplicar(sim: Sim, dono: Dono, c: Comando) {
  const j = sim.jogadores[dono];
  switch (c.t) {
    case 'mover': {
      if (typeof c.x !== 'number' || typeof c.y !== 'number' || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
      const us = minhas(sim, dono, c.ids);
      us.forEach((u, k) => {
        const e = espalhar(us.length, k);
        const x = Math.min(TAMANHO - 0.5, Math.max(0.5, c.x + e.dx));
        const y = Math.min(TAMANHO - 0.5, Math.max(0.5, c.y + e.dy));
        u.ordem = { tipo: 'mover', x, y, atacando: !!c.atacando && UNIDADES[u.tipo].combate };
        u.caminho = [];
        u.achouEm = -99;
      });
      return;
    }
    case 'parar':
      for (const u of minhas(sim, dono, c.ids)) {
        u.ordem = { tipo: 'parado' };
        u.caminho = [];
      }
      return;
    case 'alvo': {
      const alvo = sim.porId.get(c.alvo);
      if (!alvo || (eUnidade(alvo) && alvo.abrigado)) return;
      let cheio = false;
      for (const u of minhas(sim, dono, c.ids)) {
        u.caminho = [];
        u.achouEm = -99;
        if (eFonte(alvo)) {
          if (u.tipo !== 'trabalhador') u.ordem = { tipo: 'mover', x: alvo.gx + 0.5, y: alvo.gy + 0.5 };
          else if (!irColetar(sim, u, alvo.id)) {
            // a mina cheia, e nenhuma com vaga perto: vai até ela e fica parado ao lado
            u.ordem = { tipo: 'mover', x: alvo.gx + 0.5, y: alvo.gy + 0.5 };
            cheio = true;
          }
        } else if (alvo.dono !== dono) {
          u.ordem = { tipo: 'atacar', alvo: alvo.id };
        } else if (ePredio(alvo) && u.tipo === 'trabalhador') {
          if (!alvo.pronto) u.ordem = { tipo: 'construir', alvo: alvo.id };
          else if (alvo.tipo === 'fazenda') {
            if (!irColetar(sim, u, alvo.id)) {
              u.ordem = { tipo: 'mover', x: centroDe(alvo).x, y: alvo.gy + alvo.tam + 0.5 };
              cheio = true;
            }
          }
          else if (alvo.tipo === 'centro' && u.carga) u.ordem = { tipo: 'entregar' };
          else u.ordem = { tipo: 'mover', x: centroDe(alvo).x, y: alvo.gy + alvo.tam + 0.5 };
        } else {
          const p = centroDe(alvo);
          u.ordem = { tipo: 'mover', x: p.x, y: p.y };
        }
      }
      if (cheio) sim.eventos.push({ t: 'cheio', dono, id: alvo.id });
      return;
    }
    case 'sino': {
      const p = sim.porId.get(c.predio);
      if (!ePredio(p) || p.dono !== dono || p.tipo !== 'centro' || !p.pronto) return;
      if (!p.sino) {
        p.sino = true;
        for (const u of sim.unidades) {
          if (u.dono !== dono || u.tipo !== 'trabalhador' || u.abrigado || u.vida <= 0) continue;
          if (u.ordem.tipo !== 'abrigar') u.antesDoSino = u.ordem;
          u.ordem = { tipo: 'abrigar', alvo: p.id };
          u.caminho = [];
          u.achouEm = -99;
        }
      } else soltarDoSino(sim, p);
      sim.eventos.push({ t: 'sino', dono, tocado: p.sino });
      return;
    }
    case 'construir': {
      const d = PREDIOS[c.tipo];
      if (!d || !Number.isInteger(c.gx) || !Number.isInteger(c.gy)) return;
      const us = minhas(sim, dono, c.ids).filter((u) => u.tipo === 'trabalhador');
      if (!us.length || !podeConstruir(sim, dono, c.tipo, c.gx, c.gy) || !podePagar(sim, dono, d.custo)) return;
      pagar(sim, dono, d.custo);
      const p = novoPredio(sim, dono, c.tipo, c.gx, c.gy);
      for (const u of us) {
        u.ordem = { tipo: 'construir', alvo: p.id };
        u.caminho = [];
        u.achouEm = -99;
      }
      return;
    }
    case 'muralha': {
      if (![c.gx0, c.gy0, c.gx1, c.gy1].every(Number.isInteger)) return;
      const us = minhas(sim, dono, c.ids).filter((u) => u.tipo === 'trabalhador');
      if (!us.length) return;
      let primeira: Predio | null = null;
      for (const casa of casasDaMuralha(c.gx0, c.gy0, c.gx1, c.gy1)) {
        if (!podeConstruir(sim, dono, 'muralha', casa.x, casa.y) || !podePagar(sim, dono, PREDIOS.muralha.custo)) continue;
        pagar(sim, dono, PREDIOS.muralha.custo);
        const p = novoPredio(sim, dono, 'muralha', casa.x, casa.y);
        primeira ??= p;
      }
      if (!primeira) return;
      for (const u of us) {
        u.ordem = { tipo: 'construir', alvo: primeira.id };
        u.caminho = [];
        u.achouEm = -99;
      }
      return;
    }
    case 'treinar': {
      const p = sim.porId.get(c.predio);
      const d = UNIDADES[c.unidade];
      if (!ePredio(p) || !d || p.dono !== dono || !p.pronto || d.de !== p.tipo || j.era < d.era || p.fila.length >= 5) return;
      if (!podePagar(sim, dono, d.custo)) return;
      pagar(sim, dono, d.custo);
      p.fila.push(c.unidade);
      return;
    }
    case 'reuniao': {
      const p = sim.porId.get(c.predio);
      if (!ePredio(p) || p.dono !== dono || typeof c.x !== 'number' || typeof c.y !== 'number' || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
      const x = Math.min(TAMANHO - 0.5, Math.max(0.5, c.x));
      const y = Math.min(TAMANHO - 0.5, Math.max(0.5, c.y));
      const alvo = typeof c.alvo === 'number' && sim.porId.has(c.alvo) && c.alvo !== p.id ? c.alvo : undefined;
      p.reuniao = alvo === undefined ? { x, y } : { x, y, alvo };
      return;
    }
    case 'cancelar': {
      const p = sim.porId.get(c.predio);
      if (!ePredio(p) || p.dono !== dono) return;
      if (p.pesquisa > 0) {
        pagar(sim, dono, ERA2.custo, -1);
        p.pesquisa = 0;
        return;
      }
      const tipo = p.fila.pop();
      if (!tipo) return;
      pagar(sim, dono, UNIDADES[tipo].custo, -1);
      if (!p.fila.length) p.treino = 0;
      return;
    }
    case 'era': {
      const p = sim.porId.get(c.predio);
      if (!ePredio(p) || p.dono !== dono || p.tipo !== 'centro' || !p.pronto || j.era !== 1 || p.pesquisa > 0) return;
      if (!podePagar(sim, dono, ERA2.custo)) return;
      pagar(sim, dono, ERA2.custo);
      p.pesquisa = 1;
      return;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// O passo
// ---------------------------------------------------------------------------------------------------------------------

export function passo(sim: Sim) {
  sim.eventos = [];
  if (sim.vencedor !== null) return;
  const fila = sim.fila;
  sim.fila = [];
  for (const { dono, c } of fila) aplicar(sim, dono, c);
  for (const u of sim.unidades) {
    u.ax = u.x;
    u.ay = u.y;
  }
  for (const u of sim.unidades) if (u.vida > 0) pensar(sim, u);
  separar(sim);
  for (const p of sim.predios) if (p.vida > 0) predioPensa(sim, p);
  limparMortos(sim);
  if (sim.passo % 5 === 0) verNevoa(sim);
  conferirFim(sim);
  sim.passo++;
}

function predioPensa(sim: Sim, p: Predio) {
  const j = sim.jogadores[p.dono];
  if (!p.pronto) return;
  const d = PREDIOS[p.tipo];
  // o avanço de era segura a fila do centro
  if (p.pesquisa > 0) {
    p.pesquisa++;
    if (p.pesquisa >= ERA2.tempo) {
      p.pesquisa = 0;
      avancarEra(sim, p.dono);
    }
  } else if (p.fila.length) {
    const tipo = p.fila[0];
    if (p.treino < UNIDADES[tipo].tempo) p.treino++;
    if (p.treino >= UNIDADES[tipo].tempo) {
      const pop = populacao(sim, p.dono);
      if (pop.usada < pop.max) {
        const c = casaLivrePerto(sim, p.gx, p.gy, p.tam, p.dono, sim.passo);
        const u = novaUnidade(sim, p.dono, tipo, c.x + 0.5, c.y + 0.5);
        p.fila.shift();
        p.treino = 0;
        sim.eventos.push({ t: 'treinou', id: u.id, dono: p.dono, tipo });
        // quem nasce vai ao ponto de reunião (o alvo que sumiu vira só o lugar)
        const r = p.reuniao;
        if (r) {
          if (r.alvo !== undefined && sim.porId.has(r.alvo)) aplicar(sim, p.dono, { t: 'alvo', ids: [u.id], alvo: r.alvo });
          else aplicar(sim, p.dono, { t: 'mover', ids: [u.id], x: r.x, y: r.y });
        }
      }
    }
  }
  // quem atira: a torre e o centro
  if (d.ataque) {
    if (p.recarga > 0) p.recarga--;
    else {
      const c = centroDe(p);
      const perto: { u: Unidade; dist: number }[] = [];
      for (const u of sim.unidades) {
        if (u.dono === p.dono || u.vida <= 0 || u.abrigado) continue;
        const dist = distancia(u.x, u.y, p);
        if (dist <= d.alcance!) perto.push({ u, dist });
      }
      if (perto.length) {
        perto.sort((a, b) => a.dist - b.dist || a.u.id - b.u.id);
        // o sino: quem está abrigado no centro atira junto (uma flecha a mais a cada 2, até 5 a mais), nos mais perto, em roda
        let dentro = 0;
        if (p.tipo === 'centro') for (const u of sim.unidades) if (u.abrigado === p.id) dentro++;
        const flechas = 1 + Math.min(FLECHAS_DO_SINO.max, Math.floor(dentro / FLECHAS_DO_SINO.cada));
        const dano = d.ataque * (j.era === 2 ? ERA2.ataque : 1);
        for (let k = 0; k < flechas; k++) {
          const alvo = perto[k % perto.length].u;
          ferir(sim, alvo, dano, p.id);
          sim.eventos.push({ t: 'golpe', de: p.id, alvo: alvo.id, dono: p.dono, arma: 'flecha', x0: c.x, y0: c.y, x1: alvo.x, y1: alvo.y });
        }
        p.recarga = d.recarga!;
      }
    }
  }
}

/** O segundo toque do sino (ou o centro que caiu): quem está dentro sai pela porta e volta ao que fazia; quem ia, também. */
function soltarDoSino(sim: Sim, p: Predio) {
  p.sino = false;
  let k = 0;
  for (const u of sim.unidades) {
    const dentro = u.abrigado === p.id;
    const indo = u.ordem.tipo === 'abrigar' && u.ordem.alvo === p.id;
    if (!dentro && !indo) continue;
    if (dentro) {
      u.abrigado = 0;
      const c = casaLivrePerto(sim, p.gx, p.gy, p.tam, u.dono, u.id + k++);
      u.x = u.ax = c.x + 0.5;
      u.y = u.ay = c.y + 0.5;
    }
    const antes = u.antesDoSino;
    u.antesDoSino = null;
    u.ordem = antes && antes.tipo !== 'abrigar' ? antes : { tipo: 'parado' };
    u.caminho = [];
    u.achouEm = -99;
  }
}

function avancarEra(sim: Sim, dono: Dono) {
  const j = sim.jogadores[dono];
  j.era = 2;
  for (const u of sim.unidades)
    if (u.dono === dono) {
      const novo = Math.round(UNIDADES[u.tipo].vida * ERA2.vidaUnidade);
      u.vida += novo - u.vidaMax;
      u.vidaMax = novo;
    }
  for (const p of sim.predios)
    if (p.dono === dono) {
      const novo = Math.round(PREDIOS[p.tipo].vida * ERA2.vidaPredio);
      p.vida = Math.round((p.vida * novo) / p.vidaMax);
      p.vidaMax = novo;
      p.era = 2;
    }
  sim.eventos.push({ t: 'era', dono });
}

function ferir(sim: Sim, alvo: Unidade | Predio, dano: number, de: number) {
  alvo.vida -= dano;
  if (eUnidade(alvo)) {
    alvo.atacadoPor = de;
    // quem estava parado revida (o trabalhador também)
    if (alvo.ordem.tipo === 'parado' && alvo.vida > 0) {
      const quem = sim.porId.get(de);
      if (eUnidade(quem)) alvo.ordem = { tipo: 'atacar', alvo: de };
    }
  }
  const dono = alvo.dono;
  if (sim.passo - sim.avisoEm[dono] > 150) {
    sim.avisoEm[dono] = sim.passo;
    const c = centroDe(alvo);
    sim.eventos.push({ t: 'atacado', dono, x: c.x, y: c.y });
  }
}

function danoDe(sim: Sim, u: Unidade, alvo: Unidade | Predio): number {
  const d = UNIDADES[u.tipo];
  let dano = ePredio(alvo) ? d.contraPredio : d.ataque;
  if (eUnidade(alvo) && d.bonus && d.bonus.contra === alvo.tipo) dano *= d.bonus.vezes;
  if (sim.jogadores[u.dono].era === 2) dano *= ERA2.ataque;
  return dano;
}

/** O inimigo mais perto que `u` enxerga (unidades primeiro; a catapulta prefere prédio). */
function procurarInimigo(sim: Sim, u: Unidade, raio: number): number {
  const d = UNIDADES[u.tipo];
  let melhorU = 0;
  let distU = Infinity;
  let melhorP = 0;
  let distP = Infinity;
  for (const o of sim.unidades) {
    if (o.dono === u.dono || o.vida <= 0 || o.abrigado) continue;
    const dx = o.x - u.x;
    const dy = o.y - u.y;
    const q = dx * dx + dy * dy;
    if (q <= raio * raio && q < distU) {
      distU = q;
      melhorU = o.id;
    }
  }
  if (melhorU && u.tipo !== 'catapulta') return melhorU;
  for (const p of sim.predios) {
    if (p.dono === u.dono || p.vida <= 0) continue;
    const dist = distancia(u.x, u.y, p);
    if (dist <= raio + (u.tipo === 'catapulta' ? 2 : 0) && dist < distP) {
      distP = dist;
      melhorP = p.id;
    }
  }
  if (u.tipo === 'catapulta') return melhorP || (d.alcanceMin < Math.sqrt(distU) ? melhorU : 0);
  return melhorP;
}

/**
 * Vai até encostar em `alvo`: pelo caminho do A* (achado de novo a cada `refazerCada` passos, para quem persegue quem anda) e,
 * quando o caminho acaba sem encostar (a casa vizinha é grande: o alvo pode estar a uma casa e meia), em linha reta até a borda.
 */
function seguir(sim: Sim, u: Unidade, alvo: Unidade | Predio | Fonte, refazerCada = 0) {
  const [x0, y0, x1, y1] = retangulo(alvo);
  if (!u.caminho.length || (refazerCada && sim.passo - u.achouEm >= refazerCada)) {
    if (sim.passo - u.achouEm >= 3 || u.caminho.length) {
      u.caminho = acharCaminho(sim, u.dono, u.x, u.y, x0, y0, x1, y1, true);
      // sem caminho (cercado, ou já ao lado): só tenta de novo daqui a 2 s, e vai em linha reta enquanto isso
      u.achouEm = u.caminho.length ? sim.passo : sim.passo + 17;
    }
  }
  if (u.caminho.length) {
    andar(sim, u);
    return;
  }
  // o último pedaço, em linha reta até o ponto mais perto do alvo
  let px: number;
  let py: number;
  if (eUnidade(alvo)) {
    px = alvo.x;
    py = alvo.y;
  } else {
    const tam = ePredio(alvo) ? alvo.tam : 1;
    px = Math.min(Math.max(u.x, alvo.gx), alvo.gx + tam);
    py = Math.min(Math.max(u.y, alvo.gy), alvo.gy + tam);
  }
  const dx = px - u.x;
  const dy = py - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.0001) return;
  const v = Math.min(UNIDADES[u.tipo].velocidade, Math.max(0, d - 0.5));
  if (v <= 0) return;
  const nx = u.x + (dx / d) * v;
  const ny = u.y + (dy / d) * v;
  u.rx = dx / d;
  u.ry = dy / d;
  if (!passavel(sim, ind(Math.floor(nx), Math.floor(ny)), u.dono)) return;
  u.x = nx;
  u.y = ny;
  u.acao = 'andando';
}

/** Anda pelo caminho. Devolve true quando não há mais o que andar. */
function andar(sim: Sim, u: Unidade, destino?: { x: number; y: number }): boolean {
  if (!u.caminho.length) return true;
  const prox = u.caminho[0];
  if (!passavel(sim, prox, u.dono)) {
    u.caminho = [];
    u.achouEm = -99;
    return false;
  }
  const px = prox % TAMANHO;
  let tx = px + 0.5;
  let ty = (prox - px) / TAMANHO + 0.5;
  if (destino && u.caminho.length === 1) {
    tx = destino.x;
    ty = destino.y;
  }
  const dx = tx - u.x;
  const dy = ty - u.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const v = UNIDADES[u.tipo].velocidade;
  u.acao = 'andando';
  if (dist <= v) {
    u.x = tx;
    u.y = ty;
    u.caminho.shift();
  } else {
    u.x += (dx / dist) * v;
    u.y += (dy / dist) * v;
  }
  if (dist > 0.0001) {
    u.rx = dx / dist;
    u.ry = dy / dist;
  }
  return u.caminho.length === 0;
}

function olhar(u: Unidade, x: number, y: number) {
  const dx = x - u.x;
  const dy = y - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 0.0001) {
    u.rx = dx / d;
    u.ry = dy / d;
  }
}

function retangulo(e: Unidade | Predio | Fonte): [number, number, number, number] {
  if (eUnidade(e)) {
    const x = Math.floor(e.x);
    const y = Math.floor(e.y);
    return [x, y, x, y];
  }
  const tam = ePredio(e) ? e.tam : 1;
  return [e.gx, e.gy, e.gx + tam - 1, e.gy + tam - 1];
}

function pensar(sim: Sim, u: Unidade) {
  const d = UNIDADES[u.tipo];
  if (u.abrigado) {
    u.acao = 'parado';
    return;
  }
  if (u.recarga > 0) u.recarga--;
  const o = u.ordem;
  u.acao = 'parado';
  switch (o.tipo) {
    case 'parado': {
      u.caminho = [];
      if ((u.id + sim.passo) % 5 === 0 && d.combate) {
        const alvo = procurarInimigo(sim, u, d.visao);
        if (alvo) u.ordem = { tipo: 'atacar', alvo, depois: { tipo: 'mover', x: u.x, y: u.y } };
      }
      return;
    }
    case 'mover': {
      if (o.atacando && (u.id + sim.passo) % 5 === 0) {
        const alvo = procurarInimigo(sim, u, d.visao);
        if (alvo) {
          u.ordem = { tipo: 'atacar', alvo, depois: o };
          u.caminho = [];
          return;
        }
      }
      const tx = Math.floor(o.x!);
      const ty = Math.floor(o.y!);
      let alvoX = tx;
      let alvoY = ty;
      let encostar = false;
      if (!passavel(sim, ind(Math.min(TAMANHO - 1, tx), Math.min(TAMANHO - 1, ty)), u.dono)) encostar = true;
      if (!u.caminho.length) {
        const fx = u.x - o.x!;
        const fy = u.y - o.y!;
        if (fx * fx + fy * fy < 0.04) {
          u.ordem = { tipo: 'parado' };
          return;
        }
        if (Math.floor(u.x) === tx && Math.floor(u.y) === ty) {
          // já na casa: o último pedaço, direto
          u.caminho = [ind(tx, ty)];
        } else if (sim.passo - u.achouEm >= 3) {
          u.caminho = acharCaminho(sim, u.dono, u.x, u.y, alvoX, alvoY, alvoX, alvoY, encostar);
          u.achouEm = sim.passo;
          if (!u.caminho.length) {
            u.ordem = { tipo: 'parado' };
            return;
          }
        } else return;
      }
      const ultima = u.caminho[u.caminho.length - 1];
      const fim = ultima === ind(tx, ty) ? { x: o.x!, y: o.y! } : undefined;
      if (andar(sim, u, fim) && !fim) {
        u.ordem = { tipo: 'parado' };
      }
      return;
    }
    case 'atacar': {
      const alvo = sim.porId.get(o.alvo!);
      if (!alvo || eFonte(alvo) || alvo.vida <= 0 || alvo.dono === u.dono || (eUnidade(alvo) && alvo.abrigado)) {
        u.ordem = o.depois ?? { tipo: 'parado' };
        u.caminho = [];
        return;
      }
      // o inimigo que fugiu para longe demais: desiste (quem anda atacando volta ao caminho)
      const dist = distancia(u.x, u.y, alvo);
      if (eUnidade(alvo) && dist > d.visao + 6) {
        u.ordem = o.depois ?? { tipo: 'parado' };
        u.caminho = [];
        return;
      }
      const alcance = d.alcance + (ePredio(alvo) ? 0.15 : 0);
      if (dist <= alcance) {
        u.caminho = [];
        const c = centroDe(alvo);
        olhar(u, c.x, c.y);
        if (dist < d.alcanceMin) return;
        u.acao = 'atacando';
        if (u.recarga <= 0) {
          ferir(sim, alvo, danoDe(sim, u, alvo), u.id);
          u.recarga = d.recarga;
          sim.eventos.push({ t: 'golpe', de: u.id, alvo: alvo.id, dono: u.dono, arma: u.tipo === 'arqueiro' ? 'flecha' : u.tipo === 'catapulta' ? 'pedra' : 'corpo', x0: u.x, y0: u.y, x1: c.x, y1: c.y });
        }
        return;
      }
      seguir(sim, u, alvo, eUnidade(alvo) ? 8 : 0);
      return;
    }
    case 'coletar': {
      if (u.tipo !== 'trabalhador') {
        u.ordem = { tipo: 'parado' };
        return;
      }
      let alvo = sim.porId.get(o.alvo!);
      const rec: Recurso | null = eFonte(alvo) ? (alvo.tipo === 'arvore' ? 'madeira' : 'ouro') : ePredio(alvo) && alvo.tipo === 'fazenda' && alvo.dono === u.dono && alvo.pronto ? 'comida' : null;
      if (!alvo || !rec) {
        // a fonte acabou: a mais perto do mesmo tipo
        const outra = o.volta !== undefined ? fonteParecida(sim, u, o.volta) : 0;
        if (outra) {
          u.ordem = { tipo: 'coletar', alvo: outra };
          u.caminho = [];
        } else u.ordem = u.carga ? { tipo: 'entregar' } : { tipo: 'parado' };
        return;
      }
      if (u.carga && u.carga.rec !== rec) u.carga = null;
      if (u.carga && u.carga.qtd >= CARGA) {
        u.ordem = { tipo: 'entregar', volta: alvo.id };
        u.caminho = [];
        return;
      }
      if (distancia(u.x, u.y, alvo) <= 0.8) {
        u.caminho = [];
        const c = centroDe(alvo);
        olhar(u, c.x, c.y);
        u.acao = 'trabalhando';
        u.trabalho++;
        if (u.trabalho >= RITMO[rec]) {
          u.trabalho = 0;
          u.carga = { rec, qtd: (u.carga?.qtd ?? 0) + 1 };
          if (eFonte(alvo)) {
            alvo.qtd--;
            if (alvo.qtd <= 0) esgotar(sim, alvo);
          }
        }
        return;
      }
      seguir(sim, u, alvo);
      // guarda o tipo, para achar outra igual se esta acabar no caminho
      u.ordem.volta = alvo.id;
      return;
    }
    case 'entregar': {
      const deposito = depositoPerto(sim, u);
      if (!deposito || !u.carga) {
        u.ordem = o.volta !== undefined ? { tipo: 'coletar', alvo: o.volta, volta: o.volta } : { tipo: 'parado' };
        return;
      }
      if (distancia(u.x, u.y, deposito) <= 0.8) {
        sim.jogadores[u.dono].recursos[u.carga.rec] += u.carga.qtd;
        sim.eventos.push({ t: 'entregou', dono: u.dono, rec: u.carga.rec, qtd: u.carga.qtd });
        u.carga = null;
        u.caminho = [];
        u.ordem = o.volta !== undefined ? { tipo: 'coletar', alvo: o.volta, volta: o.volta } : { tipo: 'parado' };
        return;
      }
      seguir(sim, u, deposito);
      return;
    }
    case 'construir': {
      const alvo = sim.porId.get(o.alvo!);
      if (!ePredio(alvo) || alvo.dono !== u.dono || alvo.vida <= 0) {
        u.ordem = { tipo: 'parado' };
        return;
      }
      if (alvo.pronto) {
        // a fazenda que acabou de ficar pronta: quem a fez já começa a colher; senão, a próxima obra perto
        // (a fazenda é de um só: quem ajudou a construir e chegou depois vai a outra com vaga, ou à próxima obra)
        if (alvo.tipo !== 'fazenda' || !irColetar(sim, u, alvo.id)) {
          const prox = obraPerto(sim, u);
          u.ordem = prox ? { tipo: 'construir', alvo: prox } : { tipo: 'parado' };
        }
        u.caminho = [];
        return;
      }
      if (distancia(u.x, u.y, alvo) <= 0.8) {
        u.caminho = [];
        const c = centroDe(alvo);
        olhar(u, c.x, c.y);
        u.acao = 'trabalhando';
        const dp = PREDIOS[alvo.tipo];
        alvo.progresso++;
        alvo.vida = Math.min(alvo.vidaMax, alvo.vida + (alvo.vidaMax * 0.9) / dp.tempo);
        if (alvo.progresso >= dp.tempo) {
          alvo.pronto = true;
          alvo.vida = Math.max(alvo.vida, Math.round(alvo.vidaMax * 0.999));
          alvo.era = sim.jogadores[alvo.dono].era;
          sim.eventos.push({ t: 'pronto', id: alvo.id, dono: alvo.dono, tipo: alvo.tipo });
          if (alvo.tipo === 'maravilha') sim.eventos.push({ t: 'maravilha', dono: alvo.dono });
        }
        return;
      }
      seguir(sim, u, alvo);
      return;
    }
    case 'abrigar': {
      const alvo = sim.porId.get(o.alvo!);
      if (!ePredio(alvo) || alvo.dono !== u.dono || alvo.vida <= 0 || !alvo.sino) {
        u.ordem = u.antesDoSino ?? { tipo: 'parado' };
        u.antesDoSino = null;
        return;
      }
      if (distancia(u.x, u.y, alvo) <= 0.8) {
        // entra: a carga vai para o estoque, e ele some do mapa
        if (u.carga) {
          sim.jogadores[u.dono].recursos[u.carga.rec] += u.carga.qtd;
          sim.eventos.push({ t: 'entregou', dono: u.dono, rec: u.carga.rec, qtd: u.carga.qtd });
          u.carga = null;
        }
        const c = centroDe(alvo);
        u.x = u.ax = c.x;
        u.y = u.ay = c.y;
        u.caminho = [];
        u.trabalho = 0;
        u.abrigado = alvo.id;
        return;
      }
      seguir(sim, u, alvo);
      return;
    }
  }
}

function esgotar(sim: Sim, f: Fonte) {
  f.qtd = 0;
  sim.grade[ind(f.gx, f.gy)] = 0;
  sim.porId.delete(f.id);
  sim.fontes = sim.fontes.filter((x) => x !== f);
  sim.eventos.push({ t: 'esgotou', id: f.id });
  sim.acabadas.set(f.id, { tipo: f.tipo, gx: f.gx, gy: f.gy });
}

/** Uma fonte com uma casa livre do lado (a árvore do meio do bosque só se alcança quando a da borda cai). */
export function acessivel(sim: Sim, f: Fonte, dono: Dono): boolean {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = f.gx + dx;
    const y = f.gy + dy;
    if (dentro(x, y) && passavel(sim, ind(x, y), dono)) return true;
  }
  return false;
}

function fonteParecida(sim: Sim, u: Unidade, id: number): number {
  const e = sim.porId.get(id);
  const antes = sim.acabadas.get(id) ?? (eFonte(e) ? e : null);
  if (!antes) return 0;
  let melhor = 0;
  let dist = 10 * 10;
  for (const f of sim.fontes) {
    if (f.tipo !== antes.tipo || !acessivel(sim, f, u.dono) || !temVaga(sim, u.dono, f.id, u.id)) continue;
    const dx = f.gx - antes.gx;
    const dy = f.gy - antes.gy;
    const q = dx * dx + dy * dy;
    if (q < dist) {
      dist = q;
      melhor = f.id;
    }
  }
  return melhor;
}

function depositoPerto(sim: Sim, u: Unidade): Predio | null {
  let melhor: Predio | null = null;
  let dist = Infinity;
  for (const p of sim.predios) {
    if (p.dono !== u.dono || p.tipo !== 'centro' || !p.pronto) continue;
    const d = distancia(u.x, u.y, p);
    if (d < dist) {
      dist = d;
      melhor = p;
    }
  }
  return melhor;
}

function obraPerto(sim: Sim, u: Unidade): number {
  let melhor = 0;
  let dist = 8;
  for (const p of sim.predios) {
    if (p.dono !== u.dono || p.pronto || p.vida <= 0) continue;
    const d = distancia(u.x, u.y, p);
    if (d < dist) {
      dist = d;
      melhor = p.id;
    }
  }
  return melhor;
}

/** Quem está em cima de quem é empurrado de leve (na ordem dos ids), sem entrar em casa ocupada. */
function separar(sim: Sim) {
  const us = sim.unidades;
  const R = 0.42;
  for (let a = 0; a < us.length; a++) {
    const u = us[a];
    if (u.abrigado) continue;
    for (let b = a + 1; b < us.length; b++) {
      const v = us[b];
      if (v.abrigado) continue;
      const dx = v.x - u.x;
      const dy = v.y - u.y;
      if (dx > R || dx < -R || dy > R || dy < -R) continue;
      const q = dx * dx + dy * dy;
      if (q >= R * R) continue;
      let d = Math.sqrt(q);
      let nx: number;
      let ny: number;
      if (d < 0.0001) {
        nx = (u.id % 2 ? 1 : -1) * 0.7071;
        ny = 0.7071;
        d = 0;
      } else {
        nx = dx / d;
        ny = dy / d;
      }
      const empurra = (R - d) * 0.25;
      // quem trabalha parado empurra mais do que é empurrado
      const pu = u.acao === 'trabalhando' || u.acao === 'atacando' ? 0.2 : 1;
      const pv = v.acao === 'trabalhando' || v.acao === 'atacando' ? 0.2 : 1;
      mexer(sim, u, -nx * empurra * pu, -ny * empurra * pu);
      mexer(sim, v, nx * empurra * pv, ny * empurra * pv);
    }
  }
}
function mexer(sim: Sim, u: Unidade, dx: number, dy: number) {
  const x = u.x + dx;
  const y = u.y + dy;
  if (x < 0.05 || y < 0.05 || x > TAMANHO - 0.05 || y > TAMANHO - 0.05) return;
  if (!passavel(sim, ind(Math.floor(x), Math.floor(y)), u.dono)) return;
  u.x = x;
  u.y = y;
}

function limparMortos(sim: Sim) {
  if (sim.unidades.some((u) => u.vida <= 0)) {
    for (const u of sim.unidades)
      if (u.vida <= 0) {
        sim.porId.delete(u.id);
        sim.eventos.push({ t: 'morte', id: u.id, dono: u.dono, tipo: u.tipo, predio: false, x: u.x, y: u.y });
      }
    sim.unidades = sim.unidades.filter((u) => u.vida > 0);
  }
  if (sim.predios.some((p) => p.vida <= 0)) {
    for (const p of sim.predios)
      if (p.vida <= 0) {
        sim.porId.delete(p.id);
        for (let y = p.gy; y < p.gy + p.tam; y++) for (let x = p.gx; x < p.gx + p.tam; x++) sim.grade[ind(x, y)] = 0;
        const c = centroDe(p);
        sim.eventos.push({ t: 'morte', id: p.id, dono: p.dono, tipo: p.tipo, predio: true, x: c.x, y: c.y });
        // quem estava nele perde o que fazia
        if (p.pesquisa > 0) p.pesquisa = 0;
        // quem estava abrigado no centro que caiu sai pela porta
        if (p.tipo === 'centro') soltarDoSino(sim, p);
      }
    sim.predios = sim.predios.filter((p) => p.vida > 0);
  }
}

/** O que cada um vê agora (e o que já viu): unidades e prédios iluminam um círculo. */
export function verNevoa(sim: Sim) {
  for (const d of [0, 1] as Dono[]) {
    const j = sim.jogadores[d];
    j.visivel.fill(0);
    const luz = (cx: number, cy: number, r: number) => {
      const x0 = Math.max(0, Math.floor(cx - r));
      const x1 = Math.min(TAMANHO - 1, Math.floor(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r));
      const y1 = Math.min(TAMANHO - 1, Math.floor(cy + r));
      const r2 = r * r;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= r2) {
            const i = ind(x, y);
            j.visivel[i] = 1;
            j.explorado[i] = 1;
          }
        }
    };
    for (const u of sim.unidades) if (u.dono === d) luz(u.x, u.y, UNIDADES[u.tipo].visao);
    for (const p of sim.predios) if (p.dono === d) luz(p.gx + p.tam / 2, p.gy + p.tam / 2, PREDIOS[p.tipo].visao + p.tam / 2);
  }
}

/** O que cada um "vale" (para o teto de tempo): o que custou o que está de pé. */
export function pontos(sim: Sim, dono: Dono): number {
  const soma = (c: Custo) => (c.comida ?? 0) + (c.madeira ?? 0) + (c.ouro ?? 0);
  let p = 0;
  for (const u of sim.unidades) if (u.dono === dono) p += soma(UNIDADES[u.tipo].custo);
  for (const q of sim.predios) if (q.dono === dono && q.pronto) p += soma(PREDIOS[q.tipo].custo) + (q.tipo === 'centro' ? 500 : 0);
  if (sim.jogadores[dono].era === 2) p += 600;
  return p;
}

function conferirFim(sim: Sim) {
  const terminar = (vencedor: Dono, motivo: Motivo) => {
    sim.vencedor = vencedor;
    sim.motivo = motivo;
    sim.eventos.push({ t: 'fim', vencedor, motivo });
  };
  for (const d of [0, 1] as Dono[]) {
    if (!sim.predios.some((p) => p.dono === d && p.tipo === 'centro')) return terminar((1 - d) as Dono, 'centro');
  }
  for (const d of [0, 1] as Dono[]) {
    const j = sim.jogadores[d];
    if (sim.predios.some((p) => p.dono === d && p.tipo === 'maravilha' && p.pronto)) {
      j.maravilha++;
      if (j.maravilha >= PASSOS_DA_MARAVILHA) return terminar(d, 'maravilha');
    } else j.maravilha = 0;
  }
  if (sim.passo + 1 >= PASSOS_MAX) {
    const a = pontos(sim, 0);
    const b = pontos(sim, 1);
    return terminar(a >= b ? 0 : 1, 'tempo');
  }
}

/** Um resumo que muda com qualquer diferença na partida (o teste de determinismo compara dois). */
export function assinatura(sim: Sim): string {
  let h = 2166136261;
  const mais = (n: number) => {
    h = Math.imul(h ^ (Math.round(n * 1000) | 0), 16777619);
  };
  mais(sim.passo);
  for (const u of sim.unidades) {
    mais(u.id);
    mais(u.x);
    mais(u.y);
    mais(u.vida);
    mais(u.abrigado);
  }
  for (const p of sim.predios) {
    mais(p.id);
    mais(p.vida);
    mais(p.progresso);
  }
  for (const j of sim.jogadores) for (const k of RECURSOS) mais(j.recursos[k]);
  return (h >>> 0).toString(16);
}

/** Dá para chegar a encostar no retângulo, saindo de (x, y)? (O computador confere antes de pôr um prédio.) */
export function alcancavel(sim: Sim, dono: Dono, x: number, y: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const c = acharCaminho(sim, dono, x, y, x0, y0, x1, y1, true);
  const fim = c.length ? c[c.length - 1] : ind(Math.floor(x), Math.floor(y));
  const fx = fim % TAMANHO;
  const fy = (fim - fx) / TAMANHO;
  return Math.max(x0 - fx, 0, fx - x1) <= 1 && Math.max(y0 - fy, 0, fy - y1) <= 1;
}
