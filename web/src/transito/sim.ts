/**
 * O TRÂNSITO DA TOCA, A REGRA (06/11/2026, pedido dele: "um minigame de trânsito, em que o jogador tem 1 minuto para liberar o maior
 * número possível de carros sem fazer com que eles batam"). Só a mecânica do gênero de controlar o cruzamento.
 *
 * ESTE ARQUIVO EXISTE EM DUAS CÓPIAS IGUAIS BYTE A BYTE: web/src/transito/sim.ts e server/src/transito-sim.ts (o teste do site
 * confere). O site joga com ele; o servidor REFAZ a partida inteira com ele, a partir da semente e das liberações que o site manda
 * (o passo e a rua), e os pontos são os do servidor. Por isso: passos fixos de 1/60 s, sorteio por inteiros (a semente), e nada de
 * seno, cosseno nem hypot — só + − × ÷ e raiz, que dão o mesmo número em qualquer navegador. As curvas são quartos de círculo pela
 * parametrização racional ((1 − t²)/(1 + t²), 2t/(1 + t²)).
 *
 * O MAPA: uma grade de 7 × 7 casas, as duas ruas na linha 3 e na coluna 3, o cruzamento na casa (3, 3). Mão inglesa não: cada rua
 * tem duas faixas, e se anda pela da direita. As quatro entradas (0 a 3) chegam cada uma por um lado; o carro chega, para na faixa
 * de pedestres e espera. Liberar solta o PRIMEIRO carro parado daquela rua, que segue reto, vira à direita ou à esquerda (a seta
 * dele mostra). Dois carros de ruas diferentes que se encostam BATEM.
 *
 * A BATIDA: os dois ficam ali, o cruzamento TRAVA por 2 s (ninguém mais sai), perde 3 pontos e a sequência zera. Escolhido em vez de
 * acabar a partida: num minuto, perder tudo num erro aos 10 s tira a graça; travar dói (as filas enchem) sem tirar a pessoa do jogo.
 * A FILA CHEIA também pune: o carro que chega e não cabe buzina e custa 1 ponto, para que esperar não seja a jogada segura.
 * Os pontos: 1 por carro que atravessou (a ambulância vale 3), e +5 a cada 10 seguidos sem batida.
 */

export const PASSO = 1 / 60;
export const PASSOS_DA_PARTIDA = 3600;
export const MAPA = 7;
/** O cruzamento: a casa de 3 a 4 nos dois eixos. */
export const C0 = 3;
export const C1 = 4;
export const FILA_MAX = 5;
/** O espaço de um carro para o da frente, na fila (do centro ao centro). */
export const VAO = 0.55;
/** A faixa de pedestres: o carro para antes dela. */
export const FAIXA = 0.14;
export const COMPRIMENTO = 0.38;
/** Os dois círculos de cada carro (na frente e atrás), para a batida. */
const MEIO = 0.09;
const RAIO = 0.1;
export const TRAVA_PASSOS = 120;
export const PENA_DA_BATIDA = 3;
export const PENA_DA_FILA = 1;
export const SEQUENCIA = 10;
export const BONUS_DA_SEQUENCIA = 5;
const ACELERACAO = 4;
const FREIO = 9;
/** Quantas aparências de carro o desenho tem (civis, táxi, polícia...): o sorteio só escolhe o número. */
export const PELES = 8;

export type Manobra = 'reto' | 'direita' | 'esquerda';
export type Tipo = 'carro' | 'ambulancia';

export interface Chegada {
  passo: number;
  entrada: number;
  manobra: Manobra;
  tipo: Tipo;
  pele: number;
}

export interface Carro {
  id: number;
  entrada: number;
  manobra: Manobra;
  tipo: Tipo;
  pele: number;
  /** O caminho (o índice em CAMINHOS) e quanto já andou nele. */
  caminho: number;
  s: number;
  v: number;
  liberado: boolean;
  batido: boolean;
  x: number;
  y: number;
  /** Para onde aponta (unitário), para o desenho e a batida. */
  dx: number;
  dy: number;
}

export type Evento =
  | { tipo: 'liberou'; entrada: number }
  | { tipo: 'saiu'; id: number; valor: number; x: number; y: number }
  | { tipo: 'batida'; x: number; y: number }
  | { tipo: 'buzina'; entrada: number }
  | { tipo: 'sequencia'; n: number }
  | { tipo: 'destravou' };

export interface Estado {
  semente: number;
  passo: number;
  chegadas: Chegada[];
  proxima: number;
  carros: Carro[];
  proximoId: number;
  pontos: number;
  atravessaram: number;
  batidas: number;
  buzinas: number;
  sequencia: number;
  melhorSequencia: number;
  /** Até que passo o cruzamento fica travado (a batida). */
  travaAte: number;
  eventos: Evento[];
  terminou: boolean;
}

// ---------------------------------------------------------------------------------------------------------------------
// OS CAMINHOS: 4 entradas × 3 manobras, feitos para a entrada 0 e girados em volta do meio do cruzamento
// ---------------------------------------------------------------------------------------------------------------------

export interface Caminho {
  pts: number[];
  /** O comprimento acumulado até cada ponto. */
  acc: number[];
  total: number;
  /** Onde o carro da frente para (o centro dele). */
  parada: number;
  /** Onde o caminho entra no cruzamento: até ali, as três manobras de uma entrada são a mesma reta. */
  entra: number;
}

const MANOBRAS: Manobra[] = ['reto', 'direita', 'esquerda'];
const FORA = 0.7;

function arco(cx: number, cy: number, r: number, ux: number, uy: number, wx: number, wy: number, pts: number[]) {
  const N = 12;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const a = (1 - t * t) / (1 + t * t);
    const b = (2 * t) / (1 + t * t);
    pts.push(cx + r * (a * ux + b * wx), cy + r * (a * uy + b * wy));
  }
}

function caminhoDaEntrada0(m: Manobra): number[] {
  const y = C0 + 0.75;
  const pts = [-FORA, y, C0, y];
  if (m === 'reto') pts.push(C1, y, MAPA + FORA, y);
  else if (m === 'direita') {
    arco(C0, C1, 0.25, 0, -1, 1, 0, pts);
    pts.push(C0 + 0.25, MAPA + FORA);
  } else {
    arco(C0, C0, 0.75, 0, 1, 1, 0, pts);
    pts.push(C0 + 0.75, -FORA);
  }
  return pts;
}

function girar(pts: number[], vezes: number): number[] {
  const m = (C0 + C1) / 2;
  const out = pts.slice();
  for (let k = 0; k < vezes; k++) {
    for (let i = 0; i < out.length; i += 2) {
      const rx = out[i] - m;
      const ry = out[i + 1] - m;
      out[i] = m - ry;
      out[i + 1] = m + rx;
    }
  }
  return out;
}

function montar(pts: number[]): Caminho {
  const acc = [0];
  for (let i = 2; i < pts.length; i += 2) {
    const dx = pts[i] - pts[i - 2];
    const dy = pts[i + 1] - pts[i - 1];
    acc.push(acc[acc.length - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const entra = acc[1];
  return { pts, acc, total: acc[acc.length - 1], entra, parada: entra - FAIXA - COMPRIMENTO / 2 };
}

/** CAMINHOS[entrada * 3 + manobra]. */
export const CAMINHOS: Caminho[] = [];
for (let e = 0; e < 4; e++) for (const m of MANOBRAS) CAMINHOS.push(montar(girar(caminhoDaEntrada0(m), e)));

export const caminhoDe = (entrada: number, m: Manobra) => entrada * 3 + MANOBRAS.indexOf(m);

/** O ponto e a direção a `s` do começo do caminho. */
export function pontoNoCaminho(c: Caminho, s: number): { x: number; y: number; dx: number; dy: number } {
  const n = c.acc.length;
  let i = 1;
  while (i < n - 1 && c.acc[i] < s) i++;
  const x0 = c.pts[2 * i - 2];
  const y0 = c.pts[2 * i - 1];
  const x1 = c.pts[2 * i];
  const y1 = c.pts[2 * i + 1];
  const len = c.acc[i] - c.acc[i - 1];
  const f = len > 0 ? (s - c.acc[i - 1]) / len : 0;
  return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, dx: (x1 - x0) / len, dy: (y1 - y0) / len };
}

// ---------------------------------------------------------------------------------------------------------------------
// O SORTEIO DAS CHEGADAS, pela semente (inteiros de 32 bits)
// ---------------------------------------------------------------------------------------------------------------------

function sorteador(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A velocidade de quem anda, que sobe com o minuto (casas por segundo). */
export const velocidade = (passo: number) => 1.3 + (0.9 * passo) / PASSOS_DA_PARTIDA;

/**
 * Quem chega e quando. Fica mais cheio com o tempo (de um carro a cada ~2,1 s para um a cada ~0,7 s); só reto nos primeiros 10 s,
 * a direita depois dos 10 s, a esquerda depois dos 25 s; ambulância de vez em quando depois dos 20 s.
 */
export function sortearChegadas(semente: number): Chegada[] {
  const r = sorteador(semente);
  const lista: Chegada[] = [];
  let passo = 40;
  let ultima = -1;
  while (passo < PASSOS_DA_PARTIDA) {
    let entrada = Math.floor(r() * 4);
    // a mesma rua duas vezes seguidas, só às vezes: a fila se espalha
    if (entrada === ultima && r() < 0.5) entrada = (entrada + 1 + Math.floor(r() * 3)) % 4;
    ultima = entrada;
    const sm = r();
    let manobra: Manobra = 'reto';
    if (passo >= 1500) manobra = sm < 0.22 ? 'direita' : sm < 0.44 ? 'esquerda' : 'reto';
    else if (passo >= 600) manobra = sm < 0.3 ? 'direita' : 'reto';
    const tipo: Tipo = passo >= 1200 && r() < 0.07 ? 'ambulancia' : 'carro';
    const pele = Math.floor(r() * PELES);
    lista.push({ passo, entrada, manobra, tipo, pele });
    const ritmo = 1.6 - 1.05 * Math.min(1, passo / 3000);
    passo += Math.max(20, Math.round(ritmo * 60 * (0.65 + 0.7 * r())));
  }
  return lista;
}

// ---------------------------------------------------------------------------------------------------------------------
// A PARTIDA
// ---------------------------------------------------------------------------------------------------------------------

export function novaPartida(semente: number): Estado {
  return {
    semente,
    passo: 0,
    chegadas: sortearChegadas(semente),
    proxima: 0,
    carros: [],
    proximoId: 1,
    pontos: 0,
    atravessaram: 0,
    batidas: 0,
    buzinas: 0,
    sequencia: 0,
    melhorSequencia: 0,
    travaAte: 0,
    eventos: [],
    terminou: false,
  };
}

export const travado = (e: Estado) => e.passo < e.travaAte;

/** Quantos carros esperam (ainda não liberados) nesta entrada. */
export function naFila(e: Estado, entrada: number): number {
  let n = 0;
  for (const c of e.carros) if (c.entrada === entrada && !c.liberado && !c.batido) n++;
  return n;
}

/** O primeiro carro ainda não liberado da entrada (null: ninguém). */
export function primeiroDaFila(e: Estado, entrada: number): Carro | null {
  for (const c of e.carros) if (c.entrada === entrada && !c.liberado && !c.batido) return c;
  return null;
}

/**
 * Solta o primeiro carro parado (ou chegando) da entrada. Vale entre um passo e outro: o site chama na hora do clique e guarda
 * [passo, entrada]; o servidor chama no mesmo passo ao refazer. Devolve false se não soltou (ninguém na fila, ou travado).
 */
export function liberar(e: Estado, entrada: number): boolean {
  if (e.terminou || travado(e)) return false;
  const c = primeiroDaFila(e, entrada);
  if (!c) return false;
  c.liberado = true;
  e.eventos.push({ tipo: 'liberou', entrada });
  return true;
}

function batem(a: Carro, b: Carro): boolean {
  if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 0.7) return false;
  for (let i = -1; i <= 1; i += 2) {
    const ax = a.x + a.dx * MEIO * i;
    const ay = a.y + a.dy * MEIO * i;
    for (let j = -1; j <= 1; j += 2) {
      const ddx = ax - (b.x + b.dx * MEIO * j);
      const ddy = ay - (b.y + b.dy * MEIO * j);
      if (ddx * ddx + ddy * ddy < 4 * RAIO * RAIO) return true;
    }
  }
  return false;
}

/** Um passo de 1/60 s. Os eventos do passo ficam em `e.eventos` (o site os ouve para o som e as placas). */
export function passo(e: Estado): void {
  e.eventos = [];
  if (e.terminou) return;
  // a batida passou: o guincho leva os batidos
  if (e.travaAte > 0 && e.passo >= e.travaAte && e.carros.some((c) => c.batido)) {
    e.carros = e.carros.filter((c) => !c.batido);
    e.eventos.push({ tipo: 'destravou' });
  }

  // quem chega
  while (e.proxima < e.chegadas.length && e.chegadas[e.proxima].passo <= e.passo) {
    const ch = e.chegadas[e.proxima++];
    let ultimo: Carro | null = null;
    for (const c of e.carros) if (c.entrada === ch.entrada && !c.batido) ultimo = c;
    if (naFila(e, ch.entrada) >= FILA_MAX || (ultimo !== null && ultimo.s < VAO + 0.05)) {
      e.pontos = Math.max(0, e.pontos - PENA_DA_FILA);
      e.buzinas++;
      e.eventos.push({ tipo: 'buzina', entrada: ch.entrada });
      continue;
    }
    const caminho = caminhoDe(ch.entrada, ch.manobra);
    const p = pontoNoCaminho(CAMINHOS[caminho], 0);
    e.carros.push({
      id: e.proximoId++,
      entrada: ch.entrada,
      manobra: ch.manobra,
      tipo: ch.tipo,
      pele: ch.pele,
      caminho,
      s: 0,
      v: velocidade(e.passo),
      liberado: false,
      batido: false,
      x: p.x,
      y: p.y,
      dx: p.dx,
      dy: p.dy,
    });
  }

  // quem anda
  const vmax = velocidade(e.passo);
  const saem: Carro[] = [];
  const frente: (Carro | null)[] = [null, null, null, null];
  for (const c of e.carros) {
    const adiante = frente[c.entrada];
    frente[c.entrada] = c;
    if (c.batido) continue;
    const cam = CAMINHOS[c.caminho];
    let limite = c.liberado ? Infinity : cam.parada;
    // o da frente, enquanto os dois estão na mesma reta da chegada
    if (adiante && !adiante.batido && adiante.s < CAMINHOS[adiante.caminho].entra + COMPRIMENTO) limite = Math.min(limite, adiante.s - VAO);
    let v = Math.min(vmax, c.v + ACELERACAO * PASSO);
    if (limite < Infinity) v = Math.min(v, Math.sqrt(2 * FREIO * Math.max(0, limite - c.s)));
    c.v = v;
    c.s += v * PASSO;
    if (c.s > limite) {
      c.s = Math.max(c.s - v * PASSO, limite);
      c.v = 0;
    }
    if (c.s >= cam.total) {
      saem.push(c);
      continue;
    }
    const p = pontoNoCaminho(cam, c.s);
    c.x = p.x;
    c.y = p.y;
    c.dx = p.dx;
    c.dy = p.dy;
  }
  for (const c of saem) {
    const valor = c.tipo === 'ambulancia' ? 3 : 1;
    e.pontos += valor;
    e.atravessaram++;
    e.sequencia++;
    if (e.sequencia > e.melhorSequencia) e.melhorSequencia = e.sequencia;
    e.eventos.push({ tipo: 'saiu', id: c.id, valor, x: c.x, y: c.y });
    if (e.sequencia % SEQUENCIA === 0) {
      e.pontos += BONUS_DA_SEQUENCIA;
      e.eventos.push({ tipo: 'sequencia', n: e.sequencia });
    }
  }
  if (saem.length) e.carros = e.carros.filter((c) => !saem.includes(c));

  // quem bate: carros de ruas diferentes, um deles andando (ou batido, no caminho de quem anda)
  const cs = e.carros;
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i];
    for (let j = i + 1; j < cs.length; j++) {
      const b = cs[j];
      if (a.entrada === b.entrada) continue;
      if (a.batido && b.batido) continue;
      if (!a.liberado && !b.liberado) continue;
      if (!batem(a, b)) continue;
      for (const c of [a, b]) {
        if (c.batido) continue;
        c.batido = true;
        c.v = 0;
      }
      e.pontos = Math.max(0, e.pontos - PENA_DA_BATIDA);
      e.batidas++;
      e.sequencia = 0;
      e.travaAte = Math.max(e.travaAte, e.passo + TRAVA_PASSOS);
      e.eventos.push({ tipo: 'batida', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
  }

  e.passo++;
  if (e.passo >= PASSOS_DA_PARTIDA) e.terminou = true;
}

/** As liberações de uma partida, como vão ao servidor: [passo, entrada, passo, entrada, ...], em ordem de passo. */
export type Liberacoes = number[];

/** Refaz a partida inteira (o servidor, ao conferir; o teste, ao comparar). As liberações recusadas são só ignoradas. */
export function refazer(semente: number, liberacoes: Liberacoes): Estado {
  const e = novaPartida(semente);
  let i = 0;
  while (!e.terminou) {
    while (i < liberacoes.length && liberacoes[i] === e.passo) {
      liberar(e, liberacoes[i + 1]);
      i += 2;
    }
    passo(e);
  }
  return e;
}

/** Uma cópia para olhar o futuro (o piloto automático): as chegadas são só lidas, e ficam as mesmas. */
export function copiar(e: Estado): Estado {
  return { ...e, carros: e.carros.map((c) => ({ ...c })), eventos: [] };
}
