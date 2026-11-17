/**
 * A ROTA ESTELAR (16/11/2026): a regra do tiro em trilhos em 3D. Este arquivo tem DUAS CÓPIAS IGUAIS BYTE A BYTE:
 * server/src/estelar-sim.ts e web/src/estelar/sim.ts (os dois testes conferem). A rota, o roteiro dos inimigos, os anéis, os
 * obstáculos, as balas da nave e a FICHA de cada piloto (escudo, vidas, bombas, arma, rota escolhida, pontos) saem daqui; o
 * site joga com esta conta, e o servidor confere com a mesma.
 *
 * Só a mecânica do gênero dos jogos de nave em trilhos (a nave anda sozinha para a frente e quem joga a guia dentro da tela;
 * o tiro, o tiro carregado que trava a mira, a pirueta que desvia os tiros, as bombas, os anéis que devolvem o escudo, a
 * bifurcação, o subchefe e o chefe). Nada de nome, nave, personagem, arte ou som de ninguém: os pilotos são os nossos
 * coelhos, e os inimigos são a frota de lata (sondas, caçadores, cargueiros, torres, o jipe gigante e o polvo de lata).
 *
 * O MUNDO: a nave anda VEL_Z por passo no +z (z = VEL_Z × passo), e o lugar dela é (x, y) dentro da caixa da tela (±LIM_X,
 * ±LIM_Y) em volta do trilho. Na superfície do planeta o chão fica em y = CHAO; depois de Z_FIM_DO_CHAO, é o espaço.
 *
 * DETERMINISMO: passos fixos de 1/60 s, e as contas que os dois lados fazem usam só + − × ÷, Math.floor, Math.abs e
 * Math.sqrt. O vaivém é uma parábola, não o seno. O sorteio é o mulberry32 (inteiros de 32 bits).
 */

export const PASSOS_POR_S = 60;
/** O quanto a nave anda para a frente por passo (30 por segundo). */
export const VEL_Z = 0.5;
export const zNave = (n: number) => VEL_Z * n;

/** A caixa em que a nave anda, em volta do trilho. */
export const LIM_X = 13;
export const LIM_Y = 7.5;
/** O chão do planeta (abaixo da caixa), até Z_FIM_DO_CHAO. */
export const CHAO = -10;

/** A nave: a velocidade na tela (unidades por passo, já contando a diagonal), o raio que leva dano, e onde nasce. */
export const VEL_NAVE = 0.32;
export const RAIO_NAVE = 1.1;
export const NASCER = { x: 0, y: 0 };
export const VIDAS = 2;
export const ESCUDO_MAX = 100;
export const BOMBAS = 3;
/** Os golpes que existem (o tiro, o corpo de um inimigo, um obstáculo). */
export const GOLPES = [10, 15, 20] as const;
/** A piscada depois de um golpe, e depois de perder uma vida. */
export const INVUL_GOLPE = 30;
export const INVUL_MORTE = 120;
/** A pirueta: quanto dura (desviando os tiros) e a espera até a próxima. Só desenho e golpe: o servidor não a vê. */
export const PIRUETA_PASSOS = 30;
export const PIRUETA_ESPERA = 50;

/** O roteiro, em passos. */
export const INICIO = 150;
export const SUBCHEFE_T = 2280;
export const SUBCHEFE_DUR = 960;
/** Onde o chão do planeta acaba (dali para a frente, o espaço). */
export const Z_FIM_DO_CHAO = zNave(3420);
/** A bifurcação: o lugar da nave neste passo decide a rota (x < 0, a das rochas; x ≥ 0, a da estação). */
export const BIFURCA = 3660;
export const CHEFE_T = 6240;
export const FIM = CHEFE_T + 2760;

/** Um disparo a cada CADENCIA passos, e só nos passos múltiplos dela. */
export const CADENCIA = 6;
export const VEL_BALA = 3;
export const VIDA_BALA = 36;
export const RAIO_BALA = 0.35;
/** As armas: 0 é o laser simples, 1 o duplo. */
export type Arma = 0 | 1;
export const VOLEIAS: readonly (readonly { ox: number }[])[] = [[{ ox: 0 }], [{ ox: -0.9 }, { ox: 0.9 }]];

/** O TIRO CARREGADO: segurar o tiro por CARGA passos trava a mira no inimigo do cone; soltar, ele vai atrás e tira DANO_TRAVA. */
export const CARGA = 36;
export const ALCANCE_TRAVA = 90;
export const VEL_TRAVA = 2.2;
export const DANO_TRAVA = 4;

/** A bomba explode à frente da nave, neste raio (os chefes levam BOMBA_CHEFE e um raio maior). */
export const BOMBA_DIST = 26;
export const BOMBA_RAIO = 15;
export const BOMBA_CHEFE = 25;

export const RAIO_ANEL = 2.6;
export const RAIO_ITEM = 2.2;

export type Tipo = 'drone' | 'cacador' | 'cargueiro' | 'torre' | 'rocha' | 'subchefe' | 'chefe';
export type Item = 'duplo' | 'bomba';
export type Padrao = 'mira' | 'leque' | 'anel' | 'chuva';
/** 0: as duas rotas; 1: a das rochas (esquerda); 2: a da estação (direita). */
export type Ramo = 0 | 1 | 2;

export const RAIO: Record<Tipo, number> = { drone: 1.3, cacador: 1.3, cargueiro: 2.2, torre: 1.6, rocha: 1.8, subchefe: 3.2, chefe: 6 };
export const VIDA: Record<Tipo, number> = { drone: 1, cacador: 2, cargueiro: 6, torre: 3, rocha: 2, subchefe: 80, chefe: 300 };
export const PONTOS: Record<Tipo, number> = { drone: 100, cacador: 150, cargueiro: 400, torre: 250, rocha: 50, subchefe: 3000, chefe: 8000 };
/** Cada acerto num chefe vale isto, além do abate. */
export const PONTOS_NO_CHEFE = 10;
export const POR_VIDA = 1000;
export const ehChefe = (t: Tipo) => t === 'subchefe' || t === 'chefe';

/**
 * Um inimigo do roteiro. `rota` é [x0, y0, z0, x1, y1, z1, amplitude, período]: o caminho em linha reta de um ponto ao outro
 * ao longo de `dur`, com o vaivém no x. Com `rel`, o z é contado a partir da nave (ele voa junto); sem, é o z do mundo.
 */
export interface Inimigo {
  tipo: Tipo;
  t: number;
  dur: number;
  rel: boolean;
  rota: number[];
  vida: number;
  item: Item | null;
  /** [passo desde que apareceu, padrão] de cada tiro (a mira é na nave de quem joga, no site). */
  tiros: [number, Padrao][];
  /** A velocidade dos tiros dele. */
  vt: number;
  ramo: Ramo;
}

/** Um anel no mundo: o prateado devolve 30 de escudo, o dourado 50. */
export interface Anel {
  x: number;
  y: number;
  z: number;
  ouro: boolean;
  ramo: Ramo;
}

/** Um obstáculo (só a tela e o golpe: quem bate é quem diz). Uma caixa de x ± raio, de y0 a y1, em z ± fundo. */
export interface Obstaculo {
  x: number;
  y0: number;
  y1: number;
  z: number;
  raio: number;
  fundo: number;
  modelo: 'torre' | 'turbina' | 'viga' | 'bloco';
  ramo: Ramo;
}

export interface Roteiro {
  inimigos: Inimigo[];
  aneis: Anel[];
  obstaculos: Obstaculo[];
}

/** O sorteio: mulberry32, só com inteiros de 32 bits. */
export function sorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** O vaivém, sem seno: uma parábola de cada lado, que vai de −1 a 1 e volta em cada ciclo (f em ciclos). */
export function vaivem(f: number): number {
  const g = f - Math.floor(f);
  const x = 2 * g - 1;
  return -4 * x * (1 - Math.abs(x));
}

export interface Ponto {
  x: number;
  y: number;
  z: number;
}

/** Onde o inimigo está no passo `n` (no mundo), ou null se ainda não apareceu ou já foi embora. */
export function posicaoInimigo(e: Inimigo, n: number): Ponto | null {
  const s = n - e.t;
  if (s < 0 || s > e.dur) return null;
  const zn = zNave(n);
  if (e.tipo === 'subchefe') {
    // o jipe gigante no chão: chega de longe, anda na frente da nave de um lado para o outro, e vai embora acelerando
    let d: number;
    if (s < 180) {
      const u = s / 180;
      d = 110 - 68 * (1 - (1 - u) * (1 - u));
    } else if (s < e.dur - 150) d = 42;
    else {
      const k = s - (e.dur - 150);
      d = 42 + 0.01 * k * k;
    }
    return { x: 9 * vaivem((s - 180) / 420), y: CHAO + 2.2, z: zn + d };
  }
  if (e.tipo === 'chefe') {
    // o polvo de lata: chega de longe e passeia na frente da nave
    if (s < 240) {
      const u = s / 240;
      return { x: 0, y: 2, z: zn + 160 - 105 * (1 - (1 - u) * (1 - u)) };
    }
    const k = s - 240;
    return { x: 10 * vaivem(k / 600), y: 2 + 3 * vaivem(k / 340), z: zn + 55 + 6 * vaivem(k / 900) };
  }
  const r = e.rota;
  const u = s / e.dur;
  return {
    x: r[0] + (r[3] - r[0]) * u + r[6] * vaivem(s / r[7]),
    y: r[1] + (r[4] - r[1]) * u,
    z: (e.rel ? zn : 0) + r[2] + (r[5] - r[2]) * u,
  };
}

/** Onde a bala `b` de um disparo no passo `p`, da nave em (x, y), com a arma `arma`, está no passo `n`. */
export function posicaoBala(p: number, x: number, y: number, arma: Arma, b: number, n: number): Ponto | null {
  const v = VOLEIAS[arma]?.[b];
  const k = n - p;
  if (!v || k < 0 || k > VIDA_BALA) return null;
  return { x: x + v.ox, y, z: zNave(p) + 1.5 + VEL_BALA * k };
}

/** A bala (que andou VEL_BALA no z neste passo) encosta no alvo de raio `raio`? */
export function balaEncosta(alvo: Ponto, bala: Ponto, raio: number): boolean {
  const r = raio + RAIO_BALA;
  const dx = alvo.x - bala.x;
  const dy = alvo.y - bala.y;
  return dx * dx + dy * dy <= r * r && alvo.z >= bala.z - VEL_BALA - r && alvo.z <= bala.z + r;
}

/** O tiro carregado do passo `p`, da nave em (x, y), pode travar no inimigo `e`? (À frente, no alcance, perto da mira.) */
export function travaPossivel(e: Inimigo, p: number, x: number, y: number): boolean {
  const a = posicaoInimigo(e, p);
  if (!a) return false;
  const dz = a.z - zNave(p);
  if (dz < 6 || dz > ALCANCE_TRAVA) return false;
  const cone = 3 + dz * 0.08 + RAIO[e.tipo];
  const dx = a.x - x;
  const dy = a.y - y;
  return dx * dx + dy * dy <= cone * cone;
}

/** Em que passo o tiro carregado do passo `p`, da nave em (x, y), chega ao inimigo `e`. */
export function chegadaDaTrava(e: Inimigo, p: number, x: number, y: number): number {
  const a = posicaoInimigo(e, p);
  if (!a) return p + 1;
  const dx = a.x - x;
  const dy = a.y - y;
  const dz = a.z - zNave(p);
  return p + 1 + Math.floor(Math.sqrt(dx * dx + dy * dy + dz * dz) / VEL_TRAVA);
}

/** Onde o item de quem caiu no passo `q` está no passo `n` (fica parado no mundo), ou null se a nave já passou. */
export function posicaoItem(e: Inimigo, q: number, n: number): Ponto | null {
  const p = posicaoInimigo(e, q);
  if (!p || n < q || p.z < zNave(n) - 3) return null;
  return { x: Math.max(-LIM_X, Math.min(LIM_X, p.x)), y: Math.max(-LIM_Y, Math.min(LIM_Y, p.y)), z: p.z };
}

/** O passo em que a nave cruza o anel (o primeiro em que ela está no z dele ou além). */
export const passoDoAnel = (a: Anel) => Math.ceil(a.z / VEL_Z);

/** Quanto tempo (passos) um alvo parado no mundo em `z` fica à frente da nave que está no passo `t`, mais uma folga. */
const durParado = (t: number, z: number) => Math.ceil((z - zNave(t)) / VEL_Z) + 30;

/**
 * O ROTEIRO DA PARTIDA, pela semente. A superfície do planeta (filas de sondas, torres no chão, cargueiros, as torres e
 * turbinas no caminho), o jipe gigante, a subida ao espaço, a bifurcação (à esquerda o campo de rochas com os caçadores, à
 * direita a estação com as torres nas plataformas e as vigas), e o polvo de lata no fim. Anéis prateados pelo caminho e um
 * dourado em cada trecho. Alguns inimigos soltam item: o primeiro é sempre o laser duplo.
 */
export function roteiro(semente: number): Roteiro {
  const r = sorteio(semente);
  const inimigos: Inimigo[] = [];
  const aneis: Anel[] = [];
  const obstaculos: Obstaculo[] = [];
  const candidatos: number[] = [];
  const entre = (a: number, b: number) => a + (b - a) * r();

  const fila = (t: number, ramo: Ramo, tipo: 'drone' | 'cacador', nivel: number) => {
    const quantos = 4 + Math.floor(r() * 2);
    const daEsquerda = r() < 0.5;
    const y0 = entre(-5, 5);
    const y1 = entre(-5, 5);
    const atira = r() < 0.35 + 0.15 * nivel;
    for (let k = 0; k < quantos; k++) {
      const x0 = daEsquerda ? -22 : 22;
      inimigos.push({
        tipo,
        t: t + k * 12,
        dur: 220,
        rel: true,
        rota: [x0, y0, 75, -x0, y1, 38, 0, 1],
        vida: VIDA[tipo],
        item: null,
        tiros: atira && k % 2 === 1 ? [[90, 'mira']] : [],
        vt: 1.3 + 0.1 * nivel,
        ramo,
      });
    }
    candidatos.push(inimigos.length - 1);
  };
  const frente = (t: number, ramo: Ramo, tipo: 'drone' | 'cacador', nivel: number) => {
    const quantos = 3 + (nivel >= 1 ? 1 : 0);
    const y = entre(-4, 4);
    for (let k = 0; k < quantos; k++) {
      const x = -9 + (18 * (k + 0.5)) / quantos + entre(-1.5, 1.5);
      const tiros: [number, Padrao][] = [];
      for (let s = 70 + Math.floor(r() * 40); s < 260; s += 90) if (r() < 0.4 + 0.15 * nivel) tiros.push([s, 'mira']);
      inimigos.push({ tipo, t: t + k * 8, dur: 330, rel: true, rota: [x, y + 6, 120, x * 0.6, y, -6, 3 + r() * 3, 120 + Math.floor(r() * 60)], vida: VIDA[tipo], item: null, tiros, vt: 1.3 + 0.1 * nivel, ramo });
    }
  };
  const torres = (t: number, ramo: Ramo, flutuam: boolean) => {
    const quantas = 2 + Math.floor(r() * 2);
    for (let k = 0; k < quantas; k++) {
      const z = zNave(t) + 110 + k * 16;
      const x = entre(-10, 10);
      const y = flutuam ? entre(-6, 5) : CHAO + 1;
      const dur = durParado(t, z);
      const tiros: [number, Padrao][] = [];
      for (let s = 50 + Math.floor(r() * 30); s < dur - 70; s += 75) tiros.push([s, 'mira']);
      inimigos.push({ tipo: 'torre', t, dur, rel: false, rota: [x, y, z, x, y, z, 0, 1], vida: VIDA.torre, item: null, tiros, vt: 1.4, ramo });
      if (flutuam) obstaculos.push({ x, y0: y - 2.2, y1: y - 1.2, z, raio: 3, fundo: 3, modelo: 'bloco', ramo });
    }
  };
  const cargueiro = (t: number, ramo: Ramo, nivel: number) => {
    const x = entre(-6, 6);
    const tiros: [number, Padrao][] = [];
    for (let s = 120; s < 460; s += 80 - nivel * 8) tiros.push([s, s % 160 < 80 ? 'leque' : 'mira']);
    inimigos.push({ tipo: 'cargueiro', t, dur: 520, rel: true, rota: [x, 5, 130, -x, 1, 30, 5, 300], vida: VIDA.cargueiro, item: null, tiros, vt: 1.2, ramo });
    candidatos.push(inimigos.length - 1);
  };
  const rochas = (t: number, nivel: number) => {
    const quantas = 5 + Math.floor(r() * 3) + nivel;
    for (let k = 0; k < quantas; k++) {
      const z = zNave(t) + 100 + k * 9 + entre(0, 6);
      const x = entre(-12, 12);
      const y = entre(-6.5, 6.5);
      const deriva = entre(-3, 3);
      inimigos.push({ tipo: 'rocha', t, dur: durParado(t, z), rel: false, rota: [x, y, z, x + deriva, y - deriva * 0.5, z, 0, 1], vida: VIDA.rocha, item: null, tiros: [], vt: 1, ramo: 1 });
    }
  };
  const anel = (t: number, ramo: Ramo, ouro = false) => {
    aneis.push({ x: entre(-8, 8), y: entre(-4, 4), z: zNave(t) + 60, ouro, ramo });
  };

  // A SUPERFÍCIE DO PLANETA
  let t = INICIO + 60;
  let grupo = 0;
  while (t < SUBCHEFE_T - 260) {
    const nivel = t < 1200 ? 0 : 1;
    const g = r();
    if (g < 0.35) fila(t, 0, 'drone', nivel);
    else if (g < 0.6) frente(t, 0, 'drone', nivel);
    else if (g < 0.82) torres(t, 0, false);
    else cargueiro(t, 0, nivel);
    // as torres e turbinas no caminho
    for (let k = 0; k < 2; k++) {
      const alto = entre(5, 11);
      obstaculos.push({ x: entre(-11, 11), y0: CHAO, y1: CHAO + alto, z: zNave(t) + 90 + k * 30 + entre(0, 10), raio: 1.2, fundo: 1.2, modelo: r() < 0.5 ? 'torre' : 'turbina', ramo: 0 });
    }
    if (grupo % 3 === 1) anel(t + 80, 0, grupo === 4);
    grupo++;
    t += 200 + Math.floor(r() * 50);
  }
  // o jipe gigante
  {
    const tiros: [number, Padrao][] = [];
    const ciclo: Padrao[] = ['leque', 'mira', 'chuva', 'mira'];
    let k = 0;
    for (let s = 220; s < SUBCHEFE_DUR - 160; s += 55, k++) tiros.push([s, ciclo[k % ciclo.length]]);
    inimigos.push({ tipo: 'subchefe', t: SUBCHEFE_T, dur: SUBCHEFE_DUR, rel: true, rota: [], vida: VIDA.subchefe, item: 'bomba', tiros, vt: 1.4, ramo: 0 });
  }
  // a subida: anéis que levam à bifurcação
  anel(SUBCHEFE_T + SUBCHEFE_DUR + 20, 0);
  anel(BIFURCA - 200, 0, true);

  // AS DUAS ROTAS
  for (const ramo of [1, 2] as const) {
    t = BIFURCA + 90;
    grupo = 0;
    while (t < CHEFE_T - 300) {
      const g = r();
      if (ramo === 1) {
        if (g < 0.45) rochas(t, grupo % 2);
        else if (g < 0.75) fila(t, 1, 'cacador', 1);
        else frente(t, 1, 'cacador', 1);
      } else {
        if (g < 0.4) torres(t, 2, true);
        else if (g < 0.7) cargueiro(t, 2, 1);
        else fila(t, 2, 'drone', 1);
        // as vigas da estação, atravessadas no caminho
        const y = entre(-6, 6);
        obstaculos.push({ x: r() < 0.5 ? -7 : 7, y0: y - 0.6, y1: y + 0.6, z: zNave(t) + 100, raio: 6, fundo: 0.8, modelo: 'viga', ramo: 2 });
      }
      if (grupo % 3 === 2) anel(t + 60, ramo, grupo === 5);
      grupo++;
      t += 210 + Math.floor(r() * 50);
    }
  }
  anel(CHEFE_T - 120, 0);

  // os itens: o primeiro candidato dá o laser duplo, e mais três (bomba ou duplo)
  const comItem = new Set<number>();
  if (candidatos.length) {
    inimigos[candidatos[0]].item = 'duplo';
    comItem.add(candidatos[0]);
  }
  for (let k = 0; k < 6 && candidatos.length > 1; k++) {
    const i = candidatos[1 + Math.floor(r() * (candidatos.length - 1))];
    if (comItem.has(i)) continue;
    comItem.add(i);
    inimigos[i].item = r() < 0.6 ? 'bomba' : 'duplo';
  }

  // o polvo de lata: alterna o anel, o leque e a chuva, cada vez mais depressa
  const tiros: [number, Padrao][] = [];
  const ciclo: Padrao[] = ['leque', 'mira', 'anel', 'chuva', 'mira'];
  let k = 0;
  for (let s = 260; s < FIM - CHEFE_T - 30; s += Math.max(40, 70 - Math.floor(s / 600) * 6), k++) tiros.push([s, ciclo[k % ciclo.length]]);
  inimigos.push({ tipo: 'chefe', t: CHEFE_T, dur: FIM - CHEFE_T, rel: true, rota: [], vida: VIDA.chefe, item: null, tiros, vt: 1.5, ramo: 0 });
  return { inimigos, aneis, obstaculos };
}

const inteiro = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const perto3 = (a: Ponto, b: Ponto, raio: number) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z) <= raio * raio;

/**
 * A FICHA DE UM PILOTO: o que ele derrubou, a arma, o escudo, as vidas, as bombas, a rota e os pontos. O site a usa para jogar
 * (o placar da tela é a mesma conta) e o servidor para conferir: cada evento é recusado se não bate com o roteiro.
 *
 * O que ela confere sem saber onde a nave estava de verdade: o disparo só nos passos da cadência e com a arma que a pessoa
 * tinha, a bala no lugar do inimigo no passo do acerto, cada bala uma vez, o tiro carregado no cone e no passo da chegada,
 * um por carga, a rota pelo lugar da nave na bifurcação (e só os inimigos dela), o anel e o item no lugar deles, e a nave
 * sem andar mais rápido do que anda. O golpe que a nave leva é quem leva que diz (como na Esquadrilha).
 */
export class Ficha {
  vidas = VIDAS;
  escudo = ESCUDO_MAX;
  bombas = BOMBAS;
  invulAte = -1;
  ramo: Ramo = 0;
  armas: [number, Arma][] = [[0, 0]];
  mortos = new Map<number, number>();
  dano = new Map<number, number>();
  pegos = new Set<number>();
  aneis = new Set<number>();
  usados = new Set<string>();
  posicoes: { p: number; x: number; y: number }[] = [];
  mortes: number[] = [];
  pontos = 0;
  acertos = 0;
  ultimaTrava = -1000;
  morteFinal: number | null = null;
  chefeEm: number | null = null;
  ultimoQ = 0;
  novos: number[] = [];

  constructor(readonly r: Roteiro) {}

  get inimigos() {
    return this.r.inimigos;
  }
  get acabou() {
    return this.morteFinal !== null || this.chefeEm !== null;
  }
  vivoEm(n: number) {
    return this.morteFinal === null || n < this.morteFinal;
  }
  armaEm(n: number): Arma {
    let a: Arma = 0;
    for (const [p, arma] of this.armas) if (p <= n) a = arma;
    return a;
  }
  /** O inimigo (ou anel) deste ramo existe para este piloto? */
  doMeuRamo(ramo: Ramo) {
    return ramo === 0 || ramo === this.ramo;
  }

  /** O lugar dito bate com os outros (a nave não anda mais que VEL_NAVE por passo)? E o guarda, se bater. */
  lugar(p: number, x: number, y: number): boolean {
    if (!numero(x) || !numero(y) || Math.abs(x) > LIM_X + 0.5 || Math.abs(y) > LIM_Y + 0.5) return false;
    const ps = this.posicoes;
    let lo = 0;
    let hi = ps.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (ps[m].p < p) lo = m + 1;
      else hi = m;
    }
    if (lo < ps.length && ps[lo].p === p) return Math.abs(ps[lo].x - x) <= 0.02 && Math.abs(ps[lo].y - y) <= 0.02;
    const cabe = (dx: number, dy: number, passos: number) => {
      const max = VEL_NAVE * passos + 0.5;
      return dx * dx + dy * dy <= max * max;
    };
    const antes = lo > 0 ? ps[lo - 1] : null;
    let morte: number | null = null;
    for (const m of this.mortes) if (m < p) morte = m;
    if (morte !== null && (!antes || morte >= antes.p)) {
      if (!cabe(x - NASCER.x, y - NASCER.y, p - morte)) return false;
    } else if (antes && !cabe(x - antes.x, y - antes.y, p - antes.p)) return false;
    const depois = lo < ps.length ? ps[lo] : null;
    if (depois && !this.mortes.some((m) => m >= p && m < depois.p) && !cabe(depois.x - x, depois.y - y, depois.p - p)) return false;
    ps.splice(lo, 0, { p, x, y });
    return true;
  }

  private tempo(q: unknown): string | null {
    if (!inteiro(q) || q < 0 || q > FIM) return 'Evento inválido.';
    if (q < this.ultimoQ) return 'Evento fora de ordem.';
    return null;
  }

  private derrubar(i: number, q: number) {
    const e = this.inimigos[i];
    this.mortos.set(i, q);
    this.dano.delete(i);
    this.pontos += PONTOS[e.tipo];
    this.novos.push(i);
    if (e.tipo === 'chefe') this.chefeEm = q;
  }

  private ferir(i: number, q: number, quanto: number) {
    const e = this.inimigos[i];
    const dano = (this.dano.get(i) ?? 0) + quanto;
    if (dano >= e.vida) this.derrubar(i, q);
    else {
      this.dano.set(i, dano);
      if (ehChefe(e.tipo)) this.pontos += PONTOS_NO_CHEFE * quanto;
    }
  }

  private alvoValido(i: unknown): i is number {
    return inteiro(i) && i >= 0 && i < this.inimigos.length && !this.mortos.has(i) && this.doMeuRamo(this.inimigos[i].ramo);
  }

  /** A bala `b` do disparo em `p`, da nave em (x, y), acertou o inimigo `i` no passo `q`. */
  acerto(q: number, i: number, p: number, x: number, y: number, arma: number, b: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (this.chefeEm !== null || !inteiro(p) || !inteiro(b) || !inteiro(arma)) return 'Evento inválido.';
    if (!this.alvoValido(i)) return 'Acerto inválido.';
    if (p < 0 || p % CADENCIA !== 0 || q - p < 0 || q - p > VIDA_BALA || !this.vivoEm(p)) return 'Disparo inválido.';
    if (arma !== this.armaEm(p) || b < 0 || b >= VOLEIAS[arma].length) return 'Disparo inválido.';
    const chave = `${p}:${b}`;
    if (this.usados.has(chave)) return 'Disparo inválido.';
    const e = this.inimigos[i];
    const alvo = posicaoInimigo(e, q);
    const bala = posicaoBala(p, x, y, arma as Arma, b, q);
    if (!alvo || !bala || !balaEncosta(alvo, bala, RAIO[e.tipo] + 0.1)) return 'Acerto inválido.';
    if (!this.lugar(p, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.usados.add(chave);
    this.acertos++;
    this.ferir(i, q, 1);
    return null;
  }

  /** O tiro carregado solto no passo `p`, da nave em (x, y), travado no inimigo `i`, chegou no passo `q`. */
  travado(q: number, i: number, p: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (this.chefeEm !== null || !inteiro(p) || !numero(x) || !numero(y)) return 'Evento inválido.';
    if (!this.alvoValido(i)) return 'Acerto inválido.';
    if (p < 0 || p - this.ultimaTrava < CARGA || !this.vivoEm(p)) return 'Disparo inválido.';
    const e = this.inimigos[i];
    if (!travaPossivel(e, p, x, y) || q !== chegadaDaTrava(e, p, x, y) || !posicaoInimigo(e, q)) return 'Acerto inválido.';
    if (!this.lugar(p, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.ultimaTrava = p;
    this.acertos++;
    this.ferir(i, q, DANO_TRAVA);
    return null;
  }

  /** A nave em (x, y) pegou, no passo `q`, o item que o inimigo `i` soltou. */
  pegar(q: number, i: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (!this.vivoEm(q) || !inteiro(i) || i < 0 || i >= this.inimigos.length) return 'Evento inválido.';
    const e = this.inimigos[i];
    const caiu = this.mortos.get(i);
    if (!e.item || caiu === undefined || q < caiu || this.pegos.has(i)) return 'Item inválido.';
    const item = posicaoItem(e, caiu, q);
    if (!item || !numero(x) || !numero(y) || !perto3(item, { x, y, z: zNave(q) }, RAIO_ITEM + RAIO_NAVE + 0.2)) return 'Item inválido.';
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.pegos.add(i);
    if (e.item === 'bomba') this.bombas = Math.min(BOMBAS + 2, this.bombas + 1);
    else this.armas.push([q, 1]);
    return null;
  }

  /** A nave em (x, y) passou, no passo `q`, pelo anel `k`. */
  anel(q: number, k: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    const a = inteiro(k) ? this.r.aneis[k] : undefined;
    if (!a || this.aneis.has(k) || !this.vivoEm(q) || !this.doMeuRamo(a.ramo) || q !== passoDoAnel(a)) return 'Anel inválido.';
    if (!numero(x) || !numero(y) || (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y) > RAIO_ANEL * RAIO_ANEL) return 'Anel inválido.';
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.aneis.add(k);
    this.escudo = Math.min(ESCUDO_MAX, this.escudo + (a.ouro ? 50 : 30));
    this.pontos += a.ouro ? 500 : 100;
    return null;
  }

  /** A nave em (x, y) na bifurcação: a rota é a do lado em que ela está. */
  rota(q: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (q !== BIFURCA || this.ramo !== 0 || !this.vivoEm(q)) return 'Evento inválido.';
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.ramo = x < 0 ? 1 : 2;
    return null;
  }

  /** A nave em (x, y) levou um golpe de `quanto` no passo `q` (quem leva é quem diz). Piscando, não conta. */
  atingida(q: number, x: number, y: number, quanto: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (!this.vivoEm(q) || this.chefeEm !== null || !(GOLPES as readonly number[]).includes(quanto)) return 'Evento inválido.';
    if (q < this.invulAte) return null;
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.escudo -= quanto;
    this.invulAte = q + INVUL_GOLPE;
    if (this.escudo > 0) return null;
    this.vidas--;
    this.mortes.push(q);
    this.armas.push([q, 0]);
    this.escudo = ESCUDO_MAX;
    this.invulAte = q + INVUL_MORTE;
    if (this.vidas <= 0) {
      this.escudo = 0;
      this.morteFinal = q;
    }
    return null;
  }

  /** A bomba, no passo `q`: derruba quem está no raio dela, à frente da nave, e fere os chefes. */
  bomba(q: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (!this.vivoEm(q) || this.chefeEm !== null || this.bombas <= 0) return 'Sem bomba.';
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.bombas--;
    const centro = { x, y, z: zNave(q) + BOMBA_DIST };
    this.inimigos.forEach((e, i) => {
      if (this.mortos.has(i) || !this.doMeuRamo(e.ramo)) return;
      const p = posicaoInimigo(e, q);
      if (!p) return;
      if (ehChefe(e.tipo)) {
        if (perto3(p, centro, BOMBA_RAIO + 25)) this.ferir(i, q, BOMBA_CHEFE);
      } else if (perto3(p, centro, BOMBA_RAIO)) this.derrubar(i, q);
    });
    return null;
  }

  /** Um lugar da nave, mandado de tempos em tempos (só confere e guarda). */
  posicao(q: number, x: number, y: number): string | null {
    if (!inteiro(q) || q < 0 || q > FIM) return 'Evento inválido.';
    if (!this.vivoEm(q)) return null;
    return this.lugar(q, x, y) ? null : 'Lugar inválido.';
  }

  /**
   * Um evento do jeito que vai pela rede: ['a', q, i, p, x, y, arma, b] (acerto), ['t', q, i, p, x, y] (tiro travado),
   * ['g', q, i, x, y] (item), ['n', q, k, x, y] (anel), ['v', q, x, y] (a rota), ['d', q, x, y, quanto] (golpe),
   * ['b', q, x, y] (bomba).
   */
  aplicar(ev: unknown): string | null {
    if (!Array.isArray(ev)) return 'Evento inválido.';
    const [tipo, q] = ev;
    if (tipo === 'a') return this.acerto(q, ev[2], ev[3], ev[4], ev[5], ev[6], ev[7]);
    if (tipo === 't') return this.travado(q, ev[2], ev[3], ev[4], ev[5]);
    if (tipo === 'g') return this.pegar(q, ev[2], ev[3], ev[4]);
    if (tipo === 'n') return this.anel(q, ev[2], ev[3], ev[4]);
    if (tipo === 'v') return this.rota(q, ev[2], ev[3]);
    if (tipo === 'd') return this.atingida(q, ev[2], ev[3], ev[4]);
    if (tipo === 'b') return this.bomba(q, ev[2], ev[3]);
    return 'Evento inválido.';
  }

  /** Os pontos no passo `n`: os abates, os anéis e, no fim, as vidas que sobraram. */
  total(_n: number, fim = false): number {
    return this.pontos + (fim && this.morteFinal === null ? POR_VIDA * this.vidas : 0);
  }
}
