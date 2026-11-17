/**
 * O PLANADOR DA TOCA (16/11/2026): desafios de voo com pouso no alvo, o gênero dos jogos de voo de 16 bits (asa-delta, mochila
 * a jato, salto de paraquedas, passar por anéis e pousar na mosca, com a nota pela precisão). Só a MECÂNICA do gênero: nada de
 * nome, personagem, veículo, arte ou música de jogo nenhum. Quem voa é o nosso coelho; o chão é pintado por código.
 *
 * UM ARQUIVO SÓ, EM DOIS LUGARES: server/src/planador-sim.ts e web/src/planador/sim.ts são o MESMO texto, byte a byte
 * (web/test/planador.test.ts confere). Mexeu num, copie no outro.
 *
 * Por que um arquivo só: o servidor não confia nos pontos que o site diz. No pouso o site manda os COMANDOS de cada passo (em
 * trechos: "tantos passos com tal comando"), e o servidor refaz o voo inteiro com este código; os pontos são os dele. Os mesmos
 * comandos são o FANTASMA: refeito aqui, o amigo passa pelos mesmos anéis e pousa no mesmo lugar.
 *
 * DETERMINISMO: dentro do voo, só + − × ÷ e raiz (o IEEE 754 obriga o mesmo resultado em qualquer navegador). Nada de seno,
 * cosseno, sorteio ou relógio: o rumo é um vetor girado por uma rotação fixa, escrita em literais.
 *
 * AS REGRAS: o passo é 1/60 s, e o tempo é o NÚMERO DE PASSOS. O comando de um passo junta cinco botões (as setas e o botão).
 * - ASA-DELTA: as setas do lado viram; ↑ mergulha (ganha velocidade e perde altura), ↓ levanta o nariz (perde velocidade e
 *   ganha um pouco de altura: é o arredondar do pouso). Sem motor: a altura que se gasta não volta.
 * - MOCHILA A JATO: o botão é o jato de baixo (sobe), ↑ e ↓ empurram para a frente e para trás, as setas do lado viram. Tudo
 *   gasta o combustível, que acaba; pousa-se de leve na plataforma do alto.
 * - SALTO: cai-se em queda livre pelos anéis deitados (↑ anda para a frente, ↓ para), e o botão abre o paraquedas; aberto, ↓
 *   freia (anda e cai mais devagar). Chegar ao chão sem o paraquedas é batida.
 * OS PONTOS: 10 por anel; no pouso, a PRECISÃO (até 50, pela distância ao centro do alvo), a SUAVIDADE (até 30, pela
 * velocidade de descida e a de lado na hora do toque) e o BÔNUS (até 20: o tempo na asa e no salto, o combustível que sobrou
 * na mochila). Tocar o chão rápido demais é BATIDA: só os anéis valem.
 */

export const PASSO = 1 / 60;
/** O mundo é um quadrado de MUNDO metros (o chão pintado tem um ponto por metro). */
export const MUNDO = 1024;
const G = 9.8;

/** Os botões de um passo (somados num número só, de 0 a 31). */
export const ESQUERDA = 1;
export const DIREITA = 2;
export const CIMA = 4;
export const BAIXO = 8;
export const BOTAO = 16;
export const COMANDO_MAXIMO = 31;

export type Tipo = 'asa' | 'mochila' | 'queda';

export interface Anel {
  x: number;
  y: number;
  h: number;
  raio: number;
  /** Deitado (o salto: cai-se por dentro dele); em pé, ele olha para (nx, ny), que é só desenho. */
  deitado: boolean;
  nx: number;
  ny: number;
}

export interface Desafio {
  id: string;
  tipo: Tipo;
  /** Onde começa: a posição, a altura, o rumo (um vetor de tamanho 1) e a velocidade. */
  x: number;
  y: number;
  h: number;
  hx: number;
  hy: number;
  v: number;
  aneis: Anel[];
  /** O alvo: o centro, a altura do topo (a plataforma da mochila; 0 no chão) e o raio da plataforma (0 no chão). */
  alvo: { x: number; y: number; h: number; raio: number };
  /** A distância ao centro do alvo em que a precisão zera. */
  escala: number;
  combustivel: number;
  /** O tempo bom (em passos): passou dele, o bônus perde 1 ponto por segundo. */
  par: number;
  passosMaximos: number;
  /** Tocar o chão mais rápido que isto (para baixo, ou de lado) é batida. */
  limiteVs: number;
  limiteVh: number;
}

/** Um anel em pé no caminho de (ax, ay) para (x, y): olha na direção do caminho (desenho). */
function emPe(ax: number, ay: number, x: number, y: number, h: number, raio: number): Anel {
  const dx = x - ax, dy = y - ay;
  const m = Math.sqrt(dx * dx + dy * dy);
  return { x, y, h, raio, deitado: false, nx: dx / m, ny: dy / m };
}

const deitado = (x: number, y: number, h: number, raio: number): Anel => ({ x, y, h, raio, deitado: true, nx: 0, ny: -1 });

/** Os três desafios. Desafio novo é id novo: os recordes não se misturam. */
export const DESAFIOS: Desafio[] = [
  {
    id: 'asa-1',
    tipo: 'asa',
    x: 512, y: 960, h: 110, hx: 0, hy: -1, v: 14,
    aneis: [
      emPe(512, 960, 512, 840, 100, 7),
      emPe(512, 840, 440, 730, 84, 7),
      emPe(440, 730, 520, 620, 68, 7),
      emPe(520, 620, 620, 540, 52, 7),
      emPe(620, 540, 600, 420, 34, 7),
    ],
    alvo: { x: 540, y: 250, h: 0, raio: 0 },
    escala: 25,
    combustivel: 0,
    par: 60 * 60,
    passosMaximos: 3 * 60 * 60,
    limiteVs: 3.5,
    limiteVh: 17,
  },
  {
    id: 'mochila-1',
    tipo: 'mochila',
    x: 512, y: 900, h: 0, hx: 0, hy: -1, v: 0,
    aneis: [
      emPe(512, 900, 512, 860, 14, 5),
      emPe(512, 860, 480, 800, 24, 5),
      emPe(480, 800, 540, 740, 18, 5),
      emPe(540, 740, 512, 690, 13, 5),
    ],
    alvo: { x: 512, y: 640, h: 10, raio: 6 },
    escala: 6,
    combustivel: 4800,
    par: 0,
    passosMaximos: 2 * 60 * 60,
    limiteVs: 4,
    limiteVh: 6,
  },
  {
    id: 'queda-1',
    tipo: 'queda',
    x: 512, y: 520, h: 380, hx: 0, hy: -1, v: 0,
    aneis: [deitado(512, 506, 320, 10), deitado(524, 496, 260, 10), deitado(512, 484, 200, 10), deitado(522, 472, 150, 10)],
    alvo: { x: 512, y: 360, h: 0, raio: 0 },
    escala: 20,
    combustivel: 0,
    par: 50 * 60,
    passosMaximos: 2 * 60 * 60,
    limiteVs: 4,
    limiteVh: 10,
  },
];

export const desafioPorId = (id: unknown): Desafio | null => DESAFIOS.find((d) => d.id === id) ?? null;

/** O giro de um passo (o cosseno e o seno de um ângulo pequeno, em literais): asa 45°/s, mochila 100°/s, queda livre 90°/s, paraquedas 50°/s. */
const GIRO = {
  asa: [0.999914327574007, 0.01308959557134444],
  mochila: [0.9995769500822006, 0.029084718743111405],
  livre: [0.99965732497555726, 0.026176948307873149],
  aberto: [0.99989423192710747, 0.014543897651582656],
} as const;

export interface Resultado {
  /** pousou (no alvo do chão, ou na plataforma), fora (a mochila no chão, longe da plataforma), batida, ou acabou o tempo. */
  como: 'pousou' | 'fora' | 'batida' | 'tempo';
  passos: number;
  /** A distância ao centro do alvo no toque, em metros. */
  distancia: number;
  /** A velocidade de descida e a de lado no toque (m/s). */
  vs: number;
  vh: number;
  aneis: number;
  pontosAneis: number;
  precisao: number;
  suavidade: number;
  bonus: number;
  total: number;
}

export interface Voo {
  d: Desafio;
  passo: number;
  x: number;
  y: number;
  h: number;
  /** O rumo (vetor de tamanho 1, no chão; y cresce para o sul). */
  hx: number;
  hy: number;
  /** A asa e o salto andam pelo rumo, a `v`; a mochila tem a velocidade no chão (vx, vy). */
  v: number;
  vx: number;
  vy: number;
  vz: number;
  /** De −1 a 1, quanto a asa está inclinada na curva (desenho). */
  inclina: number;
  aberto: boolean;
  combustivel: number;
  /** O que o jato fez neste passo (1 o de baixo, 2 para a frente, 4 para trás): desenho e som. */
  jato: number;
  decolou: boolean;
  /** O passo em que cada anel foi pego (−1: ainda não). */
  aneis: number[];
  pegos: number;
  fim: Resultado | null;
}

export function novoVoo(d: Desafio): Voo {
  return {
    d,
    passo: 0,
    x: d.x,
    y: d.y,
    h: d.h,
    hx: d.hx,
    hy: d.hy,
    v: d.v,
    vx: 0,
    vy: 0,
    vz: 0,
    inclina: 0,
    aberto: false,
    combustivel: d.combustivel,
    jato: 0,
    decolou: false,
    aneis: d.aneis.map(() => -1),
    pegos: 0,
    fim: null,
  };
}

function girar(v: Voo, sentido: number, giro: readonly [number, number]) {
  if (sentido === 0) return;
  const c = giro[0], s = sentido > 0 ? giro[1] : -giro[1];
  const nx = v.hx * c - v.hy * s, ny = v.hx * s + v.hy * c;
  const m = Math.sqrt(nx * nx + ny * ny);
  v.hx = nx / m;
  v.hy = ny / m;
}

/** Aproxima `de` de `para`, no máximo `taxa` por passo. */
function aproximar(de: number, para: number, taxa: number) {
  if (de < para) return de + taxa < para ? de + taxa : para;
  return de - taxa > para ? de - taxa : para;
}

const limitar = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

function terminar(v: Voo, como: Resultado['como'], vs: number, vh: number): Resultado {
  const d = v.d;
  const dx = v.x - d.alvo.x, dy = v.y - d.alvo.y;
  const distancia = Math.sqrt(dx * dx + dy * dy);
  const pontosAneis = v.pegos * 10;
  let precisao = 0, suavidade = 0, bonus = 0;
  if (como === 'pousou' || como === 'fora') {
    suavidade = Math.round(limitar(30 * (1 - vs / d.limiteVs) - (10 * vh) / d.limiteVh, 0, 30));
    if (como === 'pousou') {
      precisao = Math.round(limitar(50 * (1 - distancia / d.escala), 0, 50));
      bonus =
        d.tipo === 'mochila'
          ? Math.round((20 * v.combustivel) / d.combustivel)
          : limitar(20 - Math.floor((v.passo - d.par) / 60), 0, 20);
    }
  }
  return {
    como,
    passos: v.passo,
    distancia: Math.round(distancia * 10) / 10,
    vs: Math.round(vs * 10) / 10,
    vh: Math.round(vh * 10) / 10,
    aneis: v.pegos,
    pontosAneis,
    precisao,
    suavidade,
    bonus,
    total: pontosAneis + precisao + suavidade + bonus,
  };
}

/** Toca o chão (ou a plataforma): pouso, ou batida se veio rápido demais. */
function tocar(v: Voo, como: 'pousou' | 'fora', vs: number, vh: number): 'pousou' | 'batida' {
  const batida = vs > v.d.limiteVs || vh > v.d.limiteVh || (v.d.tipo === 'queda' && !v.aberto);
  v.fim = terminar(v, batida ? 'batida' : como, vs, vh);
  v.vz = 0;
  v.v = 0;
  v.vx = 0;
  v.vy = 0;
  return batida ? 'batida' : 'pousou';
}

export type Evento = 'anel' | 'abriu' | 'pousou' | 'batida' | 'tempo' | null;

/** Um passo do voo com o comando `cmd`. Devolve o que aconteceu (para o som e o desenho). */
export function passo(v: Voo, cmd: number): Evento {
  if (v.fim) return null;
  v.passo++;
  const d = v.d;
  const vira = ((cmd & DIREITA) !== 0 ? 1 : 0) - ((cmd & ESQUERDA) !== 0 ? 1 : 0);
  const cima = (cmd & CIMA) !== 0, baixo = (cmd & BAIXO) !== 0, botao = (cmd & BOTAO) !== 0;
  v.inclina = aproximar(v.inclina, vira, 3 * PASSO);
  const hAntes = v.h;
  let evento: Evento = null;
  v.jato = 0;

  if (d.tipo === 'asa') {
    girar(v, vira, GIRO.asa);
    const vAntes = v.v;
    v.v = aproximar(v.v, cima ? 22 : baixo ? 9 : 14, 5 * PASSO);
    let afunda = 0.9 + 0.04 * (v.v - 13) * (v.v - 13);
    if (vira !== 0) afunda += 0.4;
    // a energia: o que a velocidade ganhou sai da altura, e metade do que ela perdeu vira altura (o arredondar do pouso)
    const energia = ((v.v * v.v - vAntes * vAntes) / (2 * G)) * (v.v > vAntes ? 1 : 0.5);
    const dh = -afunda * PASSO - energia;
    v.vz = dh / PASSO;
    v.h += dh;
    v.x += v.hx * v.v * PASSO;
    v.y += v.hy * v.v * PASSO;
  } else if (d.tipo === 'queda') {
    if (!v.aberto) {
      girar(v, vira, GIRO.livre);
      v.v = aproximar(v.v, cima ? 14 : baixo ? 0 : 5, 16 * PASSO);
      v.vz = v.vz - G * PASSO < -42 ? -42 : v.vz - G * PASSO;
      if (botao && v.h > 2) {
        v.aberto = true;
        evento = 'abriu';
      }
    } else {
      girar(v, vira, GIRO.aberto);
      v.v = aproximar(v.v, baixo ? 3 : 8, 4 * PASSO);
      const alvoVz = (baixo ? -2.2 : -4.5) - (vira !== 0 ? 1 : 0);
      // o tranco da abertura segura forte; depois, devagar
      v.vz = aproximar(v.vz, alvoVz, (v.vz < alvoVz - 1 ? 30 : 3) * PASSO);
    }
    v.h += v.vz * PASSO;
    v.x += v.hx * v.v * PASSO;
    v.y += v.hy * v.v * PASSO;
  } else {
    girar(v, vira, GIRO.mochila);
    let ax = 0, ay = 0, az = -G;
    if (v.combustivel > 0 && botao) {
      az += 15;
      v.combustivel--;
      v.jato |= 1;
    }
    if (v.combustivel > 0 && (cima || baixo) && cima !== baixo) {
      const f = cima ? 8 : -8;
      ax += v.hx * f;
      ay += v.hy * f;
      v.combustivel--;
      v.jato |= cima ? 2 : 4;
    }
    v.vx += (ax - v.vx * 0.7) * PASSO;
    v.vy += (ay - v.vy * 0.7) * PASSO;
    v.vz += (az - v.vz * 0.1) * PASSO;
    v.h += v.vz * PASSO;
    if (!v.decolou) {
      if (v.h <= 0) {
        // ainda na plataforma de largada: parado até o jato levantar
        v.h = 0;
        v.vz = 0;
        v.vx = 0;
        v.vy = 0;
      } else if (v.h > 1) v.decolou = true;
    }
    v.x += v.vx * PASSO;
    v.y += v.vy * PASSO;
  }

  // os anéis: passar pelo miolo de um conta uma vez
  for (let i = 0; i < d.aneis.length; i++) {
    if (v.aneis[i] >= 0) continue;
    const a = d.aneis[i];
    const dx = v.x - a.x, dy = v.y - a.y, dz = v.h - a.h;
    if (dx * dx + dy * dy + dz * dz < a.raio * a.raio) {
      v.aneis[i] = v.passo;
      v.pegos++;
      evento = 'anel';
    }
  }

  // o toque
  if (d.tipo === 'mochila') {
    if (v.decolou) {
      const dx = v.x - d.alvo.x, dy = v.y - d.alvo.y;
      const naPlataforma = dx * dx + dy * dy < d.alvo.raio * d.alvo.raio;
      const vh = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
      if (naPlataforma && v.h <= d.alvo.h) {
        if (hAntes >= d.alvo.h) {
          v.h = d.alvo.h;
          return tocar(v, 'pousou', -v.vz, vh);
        }
        // bateu na lateral da plataforma
        v.fim = terminar(v, 'batida', 0, 0);
        return 'batida';
      }
      if (v.h <= 0) {
        v.h = 0;
        return tocar(v, 'fora', -v.vz, vh);
      }
    }
  } else if (v.h <= 0) {
    v.h = 0;
    return tocar(v, 'pousou', -v.vz, v.v);
  }
  if (v.passo >= d.passosMaximos) {
    v.fim = terminar(v, 'tempo', 0, 0);
    return 'tempo';
  }
  return evento;
}

/** Os comandos em trechos: [passos, comando, passos, comando, …]. */
export type Entradas = number[];

/** Confere a forma das entradas (inteiros, o comando de 0 a 31, o total dentro do máximo). */
export function entradasValidas(e: unknown, d: Desafio): e is Entradas {
  if (!Array.isArray(e) || e.length === 0 || e.length % 2 !== 0 || e.length > 40000) return false;
  let total = 0;
  for (let i = 0; i < e.length; i += 2) {
    const n = e[i], c = e[i + 1];
    if (!Number.isInteger(n) || n < 1 || !Number.isInteger(c) || c < 0 || c > COMANDO_MAXIMO) return false;
    total += n;
    if (total > d.passosMaximos) return false;
  }
  return true;
}

/** Refaz um voo inteiro pelas entradas. O voo do fim diz se acabou e os pontos. */
export function refazer(d: Desafio, e: Entradas): Voo {
  const v = novoVoo(d);
  for (let i = 0; i < e.length && !v.fim; i += 2) {
    for (let k = 0; k < e[i] && !v.fim; k++) passo(v, e[i + 1]);
  }
  return v;
}

/** Quem grava as entradas: junta os passos iguais seguidos. */
export function gravador() {
  const e: Entradas = [];
  return {
    entradas: e,
    anotar(c: number) {
      const n = e.length;
      if (n && e[n - 1] === c) e[n - 2]++;
      else e.push(1, c);
    },
  };
}

/** O comando de um passo, lido das entradas (o fantasma). */
export function leitor(e: Entradas) {
  let i = 0, usados = 0;
  return () => {
    while (i < e.length && usados >= e[i]) {
      i += 2;
      usados = 0;
    }
    if (i >= e.length) return 0;
    usados++;
    return e[i + 1];
  };
}

/** Para onde ir agora: o primeiro anel que falta, ou o alvo. */
export function proximoAlvo(v: Voo): { x: number; y: number; h: number; anel: boolean } {
  for (let i = 0; i < v.d.aneis.length; i++) {
    if (v.aneis[i] < 0) {
      const a = v.d.aneis[i];
      // um anel que ficou para trás (passou ao lado) não segura o piloto: só os da frente
      const dx = a.x - v.x, dy = a.y - v.y;
      const frente = dx * v.hx + dy * v.hy;
      if (v.d.tipo === 'queda' ? v.h > a.h - 2 : frente > -3) return { x: a.x, y: a.y, h: a.h, anel: true };
    }
  }
  return { x: v.d.alvo.x, y: v.d.alvo.y, h: v.d.alvo.h, anel: false };
}

/** Vira para o ponto (x, y): o lado pelo produto vetorial (y cresce para o sul, então positivo é a direita). */
function virarPara(v: Voo, x: number, y: number, folga: number): number {
  const dx = x - v.x, dy = y - v.y;
  const m = Math.sqrt(dx * dx + dy * dy);
  if (m < 0.5) return 0;
  const lado = (v.hx * dy - v.hy * dx) / m;
  const frente = (v.hx * dx + v.hy * dy) / m;
  if (frente < 0) return lado >= 0 ? DIREITA : ESQUERDA;
  return lado > folga ? DIREITA : lado < -folga ? ESQUERDA : 0;
}

/**
 * O PILOTO AUTOMÁTICO (os testes e o e2e): passa pelos anéis e pousa no alvo. Só contas de + − × ÷ e raiz, como o voo.
 */
export function pilotoAutomatico(v: Voo): number {
  if (v.fim) return 0;
  const d = v.d;
  const alvo = proximoAlvo(v);
  const dx = alvo.x - v.x, dy = alvo.y - v.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  let cmd = 0;
  if (d.tipo === 'asa') {
    cmd |= virarPara(v, alvo.x, alvo.y, 0.02);
    if (alvo.anel) {
      // a planeio de cruzeiro perde ~1 m a cada 15; sobrando altura, mergulha
      if (v.h - dist / 15 > alvo.h + 1) cmd |= CIMA;
    } else if (v.h < 1.6) cmd |= BAIXO;
    else if (dist < 25 && v.h > 6) cmd = (cmd & ~(ESQUERDA | DIREITA)) | DIREITA;
    else if (v.h < 4 && v.v > 15) cmd |= BAIXO;
    else if (v.h > 2.5 && v.v < (v.h > 8 ? 23 : 17) && v.h - 1.6 > (dist - 20) / 12) cmd |= CIMA;
  } else if (d.tipo === 'queda') {
    if (!v.aberto) {
      cmd |= virarPara(v, alvo.x, alvo.y, 0.05);
      if (v.v > dist * 1.5) cmd |= BAIXO;
      else if (dist > 2) cmd |= CIMA;
      if (!alvo.anel && v.h < dist / 1.6 + 30) cmd |= BOTAO;
    } else {
      cmd |= virarPara(v, alvo.x, alvo.y, 0.05);
      // alto demais para o que falta: freia, ou dá voltas em cima do alvo
      if (v.h < 2.5) cmd |= BAIXO;
      else if (dist < v.h * 1.1 && dist < 30) cmd = (cmd & ~(ESQUERDA | DIREITA)) | DIREITA;
      else if (dist < v.h * 1.6) cmd |= BAIXO;
    }
  } else {
    const plataforma = !alvo.anel;
    const alvoH = plataforma ? (dist > 3 ? d.alvo.h + 4 : d.alvo.h - 1) : alvo.h;
    const querVz = limitar((alvoH - v.h) * 0.8, plataforma && dist < 3 ? -1.5 : -3, 3);
    if (v.vz < querVz) cmd |= BOTAO;
    cmd |= virarPara(v, alvo.x, alvo.y, 0.04);
    const frente = v.vx * v.hx + v.vy * v.hy;
    const quer = plataforma ? (dist < 1 ? 0 : limitar(dist * 0.5, 0, 5)) : 6;
    const alinhado = dist < 0.5 || Math.abs(v.hx * dy - v.hy * dx) / dist < 0.4;
    if (alinhado && frente < quer - 0.3) cmd |= CIMA;
    else if (frente > quer + 0.5) cmd |= BAIXO;
  }
  return cmd;
}
