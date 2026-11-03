/**
 * A FÍSICA DO MINIGOLFE DA TOCA (03/11/2026). UM ARQUIVO SÓ, EM DOIS LUGARES: server/src/golfe-fisica.ts e
 * web/src/golfe/fisica.ts são o MESMO texto, byte a byte (web/test/golfe.test.ts confere). Mexeu num, copie no outro.
 *
 * Por que um arquivo só: o servidor não confia no "acertei em 2" do site. Cada tacada vai ao servidor na hora (o passo do
 * relógio do buraco em que foi dada e o vetor da tacada), e ele SIMULA a mesma tacada com este código, e é a simulação dele
 * que diz onde a bola parou, se caiu na água e se entrou. O site simula igual para mostrar sem esperar a rede.
 *
 * DETERMINISMO: a simulação usa só + − × ÷ e Math.sqrt, que o IEEE 754 obriga a dar o mesmo resultado em qualquer motor
 * (V8, SpiderMonkey, JavaScriptCore). Nada de Math.sin, cos, atan2 nem hypot DENTRO da simulação: esses podem diferir na
 * última casa de um navegador para outro, e a bola pararia em lugares diferentes. Por isso a tacada é um VETOR de inteiros
 * (dx, dy), e não um ângulo: o site faz a trigonometria da mira e manda o vetor já arredondado.
 *
 * O relógio é o passo de 1/60 s, contado desde o começo do buraco. O obstáculo que anda é uma função do passo (uma onda
 * triangular), e por isso as duas pontas o veem no mesmo lugar.
 *
 * A MESA: 192 × 128 unidades (um pixel da arte cada uma). O contorno é um polígono fechado; dentro dele é grama.
 */

export const LARGURA = 192;
export const ALTURA = 128;
export const RAIO_BOLA = 2;
export const RAIO_BURACO = 3.5;
/** A tacada é (dx, dy) inteiros, com o tamanho entre FORCA_MIN e FORCA_MAX: FORCA_MAX é a força toda. */
export const FORCA_MAX = 1000;
export const FORCA_MIN = 30;
/** A velocidade da força toda, em unidades por passo. */
export const VELOCIDADE_MAX = 5;
export const ATRITO_GRAMA = 0.982;
export const ATRITO_AREIA = 0.9;
/** O que se tira da velocidade a cada passo, além do atrito: sem isto, a bola rola devagarinho para sempre. */
export const FREIO = 0.012;
/** Abaixo disto, a bola para. */
export const PARADA = 0.04;
/** Abaixo desta velocidade, a bola que passa sobre o buraco cai; acima, ela passa por cima. */
export const CAPTURA = 2.6;
export const QUIQUE_PAREDE = 0.72;
/** O cogumelo devolve um pouco mais do que recebe (com o teto da velocidade máxima). */
export const QUIQUE_PINO = 1.05;
/** Uma tacada não rola mais que isto (20 s). */
export const PASSOS_MAX_DA_TACADA = 60 * 20;
/** O limite de tacadas no buraco (a água conta uma). Quem chega nele sem acertar fica com TACADAS_MAX + 1. */
export const TACADAS_MAX = 6;

export type Tema = 'jardim' | 'horta' | 'toca' | 'lago' | 'porteira' | 'raizes';

/** O obstáculo que anda: um retângulo que vai e volta (dx, dy) num período de passos. */
export interface Movel {
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  periodo: number;
}

export interface Buraco {
  tema: Tema;
  par: number;
  inicio: [number, number];
  buraco: [number, number];
  /** O polígono da mesa: x0, y0, x1, y1, … (fechado: o último ponto liga no primeiro). */
  contorno: number[];
  /** Ilhas de parede dentro da mesa, também polígonos fechados. */
  blocos: number[][];
  /** Os cogumelos (pinos que quicam): x, y, raio. */
  pinos: [number, number, number][];
  /** Retângulos: x, y, largura, altura. */
  areia: [number, number, number, number][];
  agua: [number, number, number, number][];
  movel: Movel | null;
}

/** OS SEIS BURACOS. A ordem é a do jogo. Buraco novo: o contorno sem cantos mais estreitos que a bola, e o teste do piloto. */
export const BURACOS: Buraco[] = [
  {
    // 1. O jardim: reto, com um canteiro de areia no meio do caminho.
    tema: 'jardim',
    par: 2,
    inicio: [34, 64],
    buraco: [160, 64],
    contorno: [16, 36, 176, 36, 176, 92, 16, 92],
    blocos: [],
    pinos: [],
    areia: [[84, 52, 22, 24]],
    agua: [],
    movel: null,
  },
  {
    // 2. A horta: em L, com um cogumelo na curva.
    tema: 'horta',
    par: 3,
    inicio: [38, 30],
    buraco: [162, 98],
    contorno: [16, 14, 62, 14, 62, 76, 178, 76, 178, 116, 16, 116],
    blocos: [],
    pinos: [[30, 104, 5]],
    areia: [[120, 80, 18, 32]],
    agua: [],
    movel: null,
  },
  {
    // 3. A toca: uma ilha de pedra no meio e dois cogumelos, um de cada lado.
    tema: 'toca',
    par: 3,
    inicio: [30, 64],
    buraco: [162, 64],
    contorno: [16, 16, 176, 16, 176, 112, 16, 112],
    blocos: [[82, 42, 110, 42, 110, 86, 82, 86]],
    pinos: [
      [96, 28, 5],
      [96, 100, 5],
    ],
    areia: [],
    agua: [],
    movel: null,
  },
  {
    // 4. O lago: a água corta a mesa, e só há passagem por baixo.
    tema: 'lago',
    par: 3,
    inicio: [32, 40],
    buraco: [160, 40],
    contorno: [16, 22, 176, 22, 176, 106, 16, 106],
    blocos: [],
    pinos: [],
    areia: [[126, 86, 26, 16]],
    agua: [[72, 22, 46, 58]],
    movel: null,
  },
  {
    // 5. A porteira: uma tábua sobe e desce no meio do corredor.
    tema: 'porteira',
    par: 2,
    inicio: [28, 64],
    buraco: [164, 64],
    contorno: [16, 38, 176, 38, 176, 90, 16, 90],
    blocos: [],
    pinos: [],
    areia: [],
    agua: [],
    movel: { x: 92, y: 45, w: 10, h: 16, dx: 0, dy: 22, periodo: 150 },
  },
  {
    // 6. As raízes: em C, com o canto chanfrado, um cogumelo na volta, areia e uma poça.
    tema: 'raizes',
    par: 4,
    inicio: [30, 34],
    buraco: [30, 94],
    contorno: [16, 16, 162, 16, 178, 32, 178, 112, 16, 112, 16, 76, 140, 76, 140, 52, 16, 52],
    blocos: [],
    pinos: [[160, 64, 6]],
    areia: [[64, 80, 22, 28]],
    agua: [[96, 20, 18, 12]],
    movel: null,
  },
];

export interface Tacada {
  /** O passo do relógio do buraco em que foi dada. */
  passo: number;
  dx: number;
  dy: number;
}

export interface Bola {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** O passo do relógio do buraco: andando, o passo de agora; parada, o passo em que parou. */
  passo: number;
  /** O passo da última tacada (o teto de uma tacada conta dele). */
  tacadaEm: number;
  andando: boolean;
  dentro: boolean;
  /** As tacadas, com a água contando uma a mais. */
  tacadas: number;
  /** Onde a bola estava antes da última tacada: a água a devolve para lá. */
  ultimaX: number;
  ultimaY: number;
}

export function novaBola(b: Buraco): Bola {
  return {
    x: b.inicio[0],
    y: b.inicio[1],
    vx: 0,
    vy: 0,
    passo: 0,
    tacadaEm: 0,
    andando: false,
    dentro: false,
    tacadas: 0,
    ultimaX: b.inicio[0],
    ultimaY: b.inicio[1],
  };
}

/** A pessoa terminou o buraco: acertou, ou chegou ao limite de tacadas com a bola parada. */
export const acabouOBuraco = (bola: Bola) => bola.dentro || (!bola.andando && bola.tacadas >= TACADAS_MAX);

/** O que conta no placar do buraco: as tacadas, ou TACADAS_MAX + 1 para quem não acertou. */
export const pontosDoBuraco = (bola: Bola) => (bola.dentro ? bola.tacadas : TACADAS_MAX + 1);

/** As paredes do buraco, como segmentos (x1, y1, x2, y2), guardadas por buraco. */
const SEGMENTOS = new WeakMap<Buraco, number[]>();
function segmentosDe(b: Buraco): number[] {
  const pronto = SEGMENTOS.get(b);
  if (pronto) return pronto;
  const s: number[] = [];
  for (const poligono of [b.contorno, ...b.blocos]) {
    const n = poligono.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      s.push(poligono[i * 2], poligono[i * 2 + 1], poligono[j * 2], poligono[j * 2 + 1]);
    }
  }
  SEGMENTOS.set(b, s);
  return s;
}

/** A onda triangular do obstáculo que anda: 0 → 1 → 0 num período. */
function fracaoDoMovel(m: Movel, passo: number): number {
  const fase = (((passo % m.periodo) + m.periodo) % m.periodo) / m.periodo;
  return fase < 0.5 ? fase * 2 : 2 - fase * 2;
}

/** Onde está o obstáculo que anda, no passo. */
export function movelEm(m: Movel, passo: number): { x: number; y: number } {
  const f = fracaoDoMovel(m, passo);
  return { x: m.x + m.dx * f, y: m.y + m.dy * f };
}

const dentroDoRetangulo = (r: [number, number, number, number], x: number, y: number) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];

/** O ponto está dentro do polígono (o raio que cruza as arestas, só com + − × ÷). */
export function dentroDoPoligono(p: number[], x: number, y: number): boolean {
  let dentro = false;
  const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2];
    const yi = p[i * 2 + 1];
    const xj = p[j * 2];
    const yj = p[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** A bola bate num segmento: empurra para fora e rebate a parte da velocidade que ia contra ele. */
function baterNoSegmento(bola: Bola, ax: number, ay: number, bx: number, by: number, quique: number) {
  const sx = bx - ax;
  const sy = by - ay;
  const l2 = sx * sx + sy * sy;
  let t = l2 > 0 ? ((bola.x - ax) * sx + (bola.y - ay) * sy) / l2 : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const dx = bola.x - (ax + sx * t);
  const dy = bola.y - (ay + sy * t);
  const d2 = dx * dx + dy * dy;
  if (d2 >= RAIO_BOLA * RAIO_BOLA) return;
  let nx: number;
  let ny: number;
  let d: number;
  if (d2 > 0) {
    d = Math.sqrt(d2);
    nx = dx / d;
    ny = dy / d;
  } else {
    // o centro em cima da parede: a normal do próprio segmento
    const l = Math.sqrt(l2);
    nx = -sy / l;
    ny = sx / l;
    d = 0;
  }
  bola.x += nx * (RAIO_BOLA - d);
  bola.y += ny * (RAIO_BOLA - d);
  const vn = bola.vx * nx + bola.vy * ny;
  if (vn < 0) {
    bola.vx -= (1 + quique) * vn * nx;
    bola.vy -= (1 + quique) * vn * ny;
  }
}

function baterNoPino(bola: Bola, px: number, py: number, r: number) {
  const dx = bola.x - px;
  const dy = bola.y - py;
  const soma = r + RAIO_BOLA;
  const d2 = dx * dx + dy * dy;
  if (d2 >= soma * soma || d2 === 0) return;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  bola.x = px + nx * soma;
  bola.y = py + ny * soma;
  const vn = bola.vx * nx + bola.vy * ny;
  if (vn < 0) {
    bola.vx -= (1 + QUIQUE_PINO) * vn * nx;
    bola.vy -= (1 + QUIQUE_PINO) * vn * ny;
  }
  const v2 = bola.vx * bola.vx + bola.vy * bola.vy;
  if (v2 > VELOCIDADE_MAX * VELOCIDADE_MAX) {
    const k = VELOCIDADE_MAX / Math.sqrt(v2);
    bola.vx *= k;
    bola.vy *= k;
  }
}

/** A tábua que anda: as quatro bordas no passo, e quem ficou dentro dela é empurrado para o lado do movimento. */
function baterNoMovel(bola: Bola, m: Movel, passo: number) {
  const { x, y } = movelEm(m, passo);
  const x2 = x + m.w;
  const y2 = y + m.h;
  if (bola.x > x && bola.x < x2 && bola.y > y && bola.y < y2) {
    // engolida pela tábua: sai pelo lado mais perto, no eixo em que ela anda
    if (m.dy !== 0) bola.y = bola.y - y < y2 - bola.y ? y - RAIO_BOLA : y2 + RAIO_BOLA;
    else bola.x = bola.x - x < x2 - bola.x ? x - RAIO_BOLA : x2 + RAIO_BOLA;
  }
  baterNoSegmento(bola, x, y, x2, y, QUIQUE_PAREDE);
  baterNoSegmento(bola, x2, y, x2, y2, QUIQUE_PAREDE);
  baterNoSegmento(bola, x2, y2, x, y2, QUIQUE_PAREDE);
  baterNoSegmento(bola, x, y2, x, y, QUIQUE_PAREDE);
}

/**
 * A bola parou no caminho da tábua: vai para o lado, para a tábua não precisar empurrar uma bola parada (a bola parada não
 * é simulada, e as duas pontas não saberiam quando ela foi empurrada).
 */
function assentar(b: Buraco, bola: Bola) {
  const m = b.movel;
  if (!m) return;
  const x1 = m.x - RAIO_BOLA - 0.5;
  const x2 = m.x + m.w + m.dx + RAIO_BOLA + 0.5;
  const y1 = m.y - RAIO_BOLA - 0.5;
  const y2 = m.y + m.h + m.dy + RAIO_BOLA + 0.5;
  if (bola.x <= x1 || bola.x >= x2 || bola.y <= y1 || bola.y >= y2) return;
  if (m.dy !== 0) bola.x = bola.x - x1 < x2 - bola.x ? x1 : x2;
  else bola.y = bola.y - y1 < y2 - bola.y ? y1 : y2;
}

function parar(b: Buraco, bola: Bola) {
  bola.vx = 0;
  bola.vy = 0;
  bola.andando = false;
  assentar(b, bola);
}

/** A tacada é possível agora? Devolve o motivo, ou null. Os números são conferidos aqui, para as duas pontas. */
export function tacadaInvalida(bola: Bola, t: Tacada): string | null {
  if (bola.andando) return 'andando';
  if (acabouOBuraco(bola)) return 'acabou';
  if (!Number.isInteger(t.passo) || !Number.isInteger(t.dx) || !Number.isInteger(t.dy)) return 'numeros';
  if (t.passo < bola.passo) return 'cedo';
  const f2 = t.dx * t.dx + t.dy * t.dy;
  if (f2 < FORCA_MIN * FORCA_MIN || f2 > FORCA_MAX * FORCA_MAX) return 'forca';
  return null;
}

/** Dá a tacada (já conferida por tacadaInvalida). */
export function bater(bola: Bola, t: Tacada) {
  bola.passo = t.passo;
  bola.tacadaEm = t.passo;
  bola.ultimaX = bola.x;
  bola.ultimaY = bola.y;
  // (+ 0 tira o -0 que o Math.round deixa: o JSON o manda como 0, e as duas pontas precisam começar iguais)
  bola.vx = ((t.dx + 0) / FORCA_MAX) * VELOCIDADE_MAX;
  bola.vy = ((t.dy + 0) / FORCA_MAX) * VELOCIDADE_MAX;
  bola.andando = true;
  bola.tacadas++;
}

/** Um passo de 1/60 s da bola andando. Parada, nada muda. */
export function avancar(b: Buraco, bola: Bola) {
  if (!bola.andando) return;
  bola.passo++;
  const v = Math.sqrt(bola.vx * bola.vx + bola.vy * bola.vy);
  let atrito = ATRITO_GRAMA;
  for (const r of b.areia) if (dentroDoRetangulo(r, bola.x, bola.y)) atrito = ATRITO_AREIA;
  const nova = v * atrito - FREIO;
  if (nova <= PARADA || bola.passo - bola.tacadaEm > PASSOS_MAX_DA_TACADA) {
    const [hx, hy] = b.buraco;
    const ex = bola.x - hx;
    const ey = bola.y - hy;
    if (ex * ex + ey * ey < RAIO_BURACO * RAIO_BURACO) {
      bola.x = hx;
      bola.y = hy;
      bola.dentro = true;
    }
    return parar(b, bola);
  }
  bola.vx *= nova / v;
  bola.vy *= nova / v;
  const segmentos = segmentosDe(b);
  const pedacos = Math.ceil(nova);
  for (let p = 0; p < pedacos; p++) {
    bola.x += bola.vx / pedacos;
    bola.y += bola.vy / pedacos;
    for (let i = 0; i < segmentos.length; i += 4) baterNoSegmento(bola, segmentos[i], segmentos[i + 1], segmentos[i + 2], segmentos[i + 3], QUIQUE_PAREDE);
    for (const [px, py, r] of b.pinos) baterNoPino(bola, px, py, r);
    if (b.movel) baterNoMovel(bola, b.movel, bola.passo);
    // a água (e, por segurança, qualquer lugar fora da mesa): volta para onde estava, com uma tacada a mais
    let molhou = !dentroDoPoligono(b.contorno, bola.x, bola.y);
    for (const r of b.agua) if (dentroDoRetangulo(r, bola.x, bola.y)) molhou = true;
    if (molhou) {
      bola.x = bola.ultimaX;
      bola.y = bola.ultimaY;
      bola.tacadas++;
      return parar(b, bola);
    }
    const [hx, hy] = b.buraco;
    const ex = bola.x - hx;
    const ey = bola.y - hy;
    const v2 = bola.vx * bola.vx + bola.vy * bola.vy;
    if (ex * ex + ey * ey < RAIO_BURACO * RAIO_BURACO && v2 < CAPTURA * CAPTURA) {
      bola.x = hx;
      bola.y = hy;
      bola.dentro = true;
      return parar(b, bola);
    }
  }
}

/** A tacada inteira, até a bola parar (o servidor faz isto ao receber cada tacada). */
export function rolarAteParar(b: Buraco, bola: Bola) {
  while (bola.andando) avancar(b, bola);
}

export function copiarBola(bola: Bola): Bola {
  return { ...bola };
}

/**
 * A DISTÂNCIA PELO CAMINHO até o buraco, numa grade de 2 unidades (contornando as paredes): para o piloto automático
 * (os testes e o e2e). Não entra na simulação.
 */
export function mapaDeDistancia(b: Buraco): (x: number, y: number) => number {
  const passo = 2;
  const cw = LARGURA / passo;
  const ch = ALTURA / passo;
  const livre = new Uint8Array(cw * ch);
  const segmentos = segmentosDe(b);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const x = cx * passo + 1;
      const y = cy * passo + 1;
      let ok = dentroDoPoligono(b.contorno, x, y) && !b.blocos.some((p) => dentroDoPoligono(p, x, y));
      for (const r of b.agua) if (dentroDoRetangulo(r, x, y)) ok = false;
      for (let i = 0; ok && i < segmentos.length; i += 4) {
        const sx = segmentos[i + 2] - segmentos[i];
        const sy = segmentos[i + 3] - segmentos[i + 1];
        const l2 = sx * sx + sy * sy;
        let t = l2 > 0 ? ((x - segmentos[i]) * sx + (y - segmentos[i + 1]) * sy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = x - (segmentos[i] + sx * t);
        const dy = y - (segmentos[i + 1] + sy * t);
        if (dx * dx + dy * dy < RAIO_BOLA * RAIO_BOLA) ok = false;
      }
      livre[cy * cw + cx] = ok ? 1 : 0;
    }
  }
  const dist = new Float64Array(cw * ch).fill(Infinity);
  const inicio = Math.floor(b.buraco[1] / passo) * cw + Math.floor(b.buraco[0] / passo);
  dist[inicio] = 0;
  const fila = [inicio];
  for (let k = 0; k < fila.length; k++) {
    const i = fila[k];
    const cx = i % cw;
    const cy = (i - cx) / cw;
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
      const j = ny * cw + nx;
      if (!livre[j] || dist[j] !== Infinity) continue;
      dist[j] = dist[i] + passo;
      fila.push(j);
    }
  }
  return (x, y) => {
    const cx = Math.min(cw - 1, Math.max(0, Math.floor(x / passo)));
    const cy = Math.min(ch - 1, Math.max(0, Math.floor(y / passo)));
    return dist[cy * cw + cx];
  };
}

/**
 * O PILOTO AUTOMÁTICO: experimenta direções e forças e fica com a que deixa a bola mais perto do buraco pelo caminho (ou
 * dentro dele). Para os testes e o e2e (web/src/golfe: só em desenvolvimento). As direções saem de uma parametrização
 * racional do círculo, sem trigonometria, como o resto deste arquivo.
 */
export function melhorTacada(b: Buraco, bola: Bola, passo: number, distancia = mapaDeDistancia(b)): Tacada {
  let melhor: Tacada = { passo, dx: FORCA_MAX, dy: 0 };
  let melhorNota = Infinity;
  const direcoes: [number, number][] = [];
  const N = 24;
  for (let k = 0; k < N; k++) {
    const u = -1 + (2 * k) / N;
    const den = 1 + u * u;
    const cx = (1 - u * u) / den;
    const cy = (2 * u) / den;
    direcoes.push([cx, cy], [-cx, -cy]);
  }
  for (const [cx, cy] of direcoes) {
    for (let f = 1; f <= 10; f++) {
      const forca = f * 100;
      const t: Tacada = { passo, dx: Math.round(cx * forca), dy: Math.round(cy * forca) };
      if (tacadaInvalida(bola, t)) continue;
      const teste = copiarBola(bola);
      bater(teste, t);
      rolarAteParar(b, teste);
      const nota = teste.dentro ? -1000 + f : distancia(teste.x, teste.y) + (teste.tacadas - bola.tacadas - 1) * 500;
      if (nota < melhorNota) {
        melhorNota = nota;
        melhor = t;
      }
    }
  }
  return melhor;
}
