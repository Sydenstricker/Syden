/**
 * OS CARRINHOS DA TOCA (06/11/2026): a pista de carrinhos de brinquedo, em que cada carro corre preso à SUA FAIXA e quem joga
 * só controla o ACELERADOR. Só a mecânica do gênero; a pista e os carros são as peças do Toy Car Kit da Kenney (CC0).
 *
 * UM ARQUIVO SÓ, EM DOIS LUGARES: server/src/carrinhos-sim.ts e web/src/carrinhos/sim.ts são o MESMO texto, byte a byte
 * (web/test/carrinhos.test.ts confere). Mexeu num, copie no outro.
 *
 * Por que um arquivo só: o servidor não confia no tempo que o site diz. No fim da corrida o site manda o ACELERADOR de cada
 * passo (em trechos: "tantos passos com tanto de acelerador"), e o servidor refaz a corrida inteira com este código; o tempo
 * é o dele. O mesmo acelerador é o FANTASMA: refeito aqui, o carro do amigo sai da pista nos mesmos lugares.
 *
 * DETERMINISMO: dentro da corrida, só + − × ÷ (o IEEE 754 obriga o mesmo resultado em qualquer navegador). O seno e o cosseno
 * aparecem só em `poseNaFaixa`, que é DESENHO: diz onde pôr o carro na tela, e não muda nada da corrida.
 *
 * AS REGRAS: o passo é 1/60 s, e o tempo é o NÚMERO DE PASSOS. O acelerador vai de 0 a 8. Cada curva tem uma velocidade
 * máxima; acima dela, até a FOLGA, o carro DERRAPA (treme e perde um pouco de velocidade); passou da folga, SAI DA PISTA,
 * fica fora FORA_PASSOS e volta, piscando, ao lugar de onde saiu, parado. Cinco voltas.
 *
 * A PISTA: as peças largas da Kenney têm 2 de largura e 4 de comprimento, e as curvas pequena (raio 2) e grande (raio 4) são
 * CONCÊNTRICAS: duas fileiras de peças lado a lado dão 4 faixas. A linha do meio das duas fileiras faz as curvas com raio 3.
 * Numa curva para um lado a faixa de dentro é mais curta; para que nenhuma faixa ganhe por isso, a velocidade máxima de cada
 * raio foi medida de modo que o piloto automático faça a mesma volta em todas (o teste confere: 1% de diferença, no máximo).
 */

export const PASSO = 1 / 60;
export const VOLTAS = 5;
export const FAIXAS = 4;
/** Na corrida contra o relógio (e nos recordes), quem joga corre sempre nesta faixa: os tempos se comparam. */
export const FAIXA_DO_RECORDE = 1;
export const ACELERADOR_MAXIMO = 8;
/** A velocidade de reta (unidades por segundo; uma peça reta tem 4). */
export const VMAX = 12;
/** O atrito do ar e do motor: a velocidade chega a ~78% da máxima em 1 s de acelerador cheio. */
const ATRITO = 1.5;
/** O freio do motor com o acelerador solto. */
const FREIO = 6;
/** Acima da velocidade da curva, até isto, o carro derrapa; mais que isto, sai. */
export const FOLGA = 1;
/** O quanto a derrapagem segura o carro (unidades por segundo, por segundo). */
const ATRITO_DA_DERRAPAGEM = 3;
/** Quanto tempo o carro fica fora da pista (1,75 s). */
export const FORA_PASSOS = 105;
/** E quanto tempo ele pisca depois de voltar (só desenho: já dá para acelerar). */
export const PISCA_PASSOS = 60;
/** Uma corrida não passa de 10 minutos. */
export const PASSOS_MAXIMOS = 10 * 60 * 60;

/** O raio das curvas da linha do meio (entre as duas fileiras de peças). */
export const RAIO_DO_MEIO = 3;
export const COMPRIMENTO_DA_RETA = 4;
/** A distância de cada faixa à linha do meio, para o lado das curvas "+" (a faixa 0 é a de dentro nelas). */
export const DESLOCAMENTO = [1.5, 0.5, -0.5, -1.5];

/**
 * O traçado: R é uma peça reta; + e − são curvas de 90°, para um lado e para o outro. A volta é um retângulo com um dente
 * no meio de um lado (6 curvas "+" e 2 "−"), largando no começo da reta de baixo.
 */
export const TRACADO = ['R', 'R', 'R', 'R', '+', 'R', 'R', '+', '+', '-', 'R', '-', '+', '+', 'R', 'R', '+'] as const;

/**
 * A velocidade máxima em cada raio de faixa (medida: ver o cabeçalho). Literais, e não uma conta com potência, para dar o
 * mesmo número em qualquer motor.
 */
export const LIMITE_DO_RAIO: Record<number, number> = { 1.5: 4.7, 2.5: 6.4, 3.5: 8.08, 4.5: 9.9 };

const MEIO_PI = 1.5707963267948966;

export interface Trecho {
  /** Onde o trecho começa, na faixa (distância desde a largada). */
  inicio: number;
  comprimento: number;
  /** 0 na reta; +1 ou −1 na curva. */
  sentido: number;
  raio: number;
  limite: number;
  // o desenho: a posição e o rumo no começo do trecho (o rumo em radianos, no plano x, z), e o centro da curva
  x: number;
  z: number;
  rumo: number;
  cx: number;
  cz: number;
}

export interface Peca {
  /** 'reta', 'pequena' ou 'grande': a peça da Kenney. */
  tipo: 'reta' | 'pequena' | 'grande';
  sentido: number;
  /** A entrada da peça (a linha do meio da fileira) e o rumo nela. */
  x: number;
  z: number;
  rumo: number;
  /** A fileira: +1 do lado das curvas "+", −1 do outro. */
  fileira: number;
}

/** A linha do meio: a pose no começo de cada peça do traçado. */
function linhaDoMeio(): { x: number; z: number; rumo: number }[] {
  const poses: { x: number; z: number; rumo: number }[] = [];
  let x = 0, z = 0, rumo = 0;
  for (const p of TRACADO) {
    poses.push({ x, z, rumo });
    const dx = Math.cos(rumo), dz = Math.sin(rumo);
    if (p === 'R') {
      x += dx * COMPRIMENTO_DA_RETA;
      z += dz * COMPRIMENTO_DA_RETA;
    } else {
      const s = p === '+' ? 1 : -1;
      // o lado das curvas "+" é o rumo girado de +90°
      x += (dx - s * dz) * RAIO_DO_MEIO;
      z += (dz + s * dx) * RAIO_DO_MEIO;
      rumo += s * MEIO_PI;
    }
  }
  poses.push({ x, z, rumo });
  return poses;
}

const POSES = linhaDoMeio();

/** Os trechos de cada faixa, do começo ao fim da volta. */
export const TRECHOS: Trecho[][] = DESLOCAMENTO.map((o) => {
  const lista: Trecho[] = [];
  let inicio = 0;
  TRACADO.forEach((p, i) => {
    const { x: mx, z: mz, rumo } = POSES[i];
    const lx = -Math.sin(rumo), lz = Math.cos(rumo);
    const x = mx + lx * o, z = mz + lz * o;
    if (p === 'R') {
      lista.push({ inicio, comprimento: COMPRIMENTO_DA_RETA, sentido: 0, raio: 0, limite: VMAX, x, z, rumo, cx: 0, cz: 0 });
      inicio += COMPRIMENTO_DA_RETA;
    } else {
      const s = p === '+' ? 1 : -1;
      const raio = RAIO_DO_MEIO - s * o;
      const comprimento = MEIO_PI * raio;
      lista.push({ inicio, comprimento, sentido: s, raio, limite: LIMITE_DO_RAIO[raio], x, z, rumo, cx: mx + lx * s * RAIO_DO_MEIO, cz: mz + lz * s * RAIO_DO_MEIO });
      inicio += comprimento;
    }
  });
  return lista;
});

/** O comprimento de uma volta em cada faixa. */
export const VOLTA = TRECHOS.map((l) => l[l.length - 1].inicio + l[l.length - 1].comprimento);

/** As peças da Kenney, nas duas fileiras: na curva, a fileira de dentro leva a pequena, a de fora a grande. */
export const PECAS: Peca[] = TRACADO.flatMap((p, i) => {
  const { x: mx, z: mz, rumo } = POSES[i];
  const lx = -Math.sin(rumo), lz = Math.cos(rumo);
  return [1, -1].map((fileira): Peca => {
    const x = mx + lx * fileira, z = mz + lz * fileira;
    if (p === 'R') return { tipo: 'reta', sentido: 0, x, z, rumo, fileira };
    const s = p === '+' ? 1 : -1;
    return { tipo: s === fileira ? 'pequena' : 'grande', sentido: s, x, z, rumo, fileira };
  });
});

/** Quanto a linha do meio fecha a volta (o teste confere que é zero). */
export const FECHAMENTO = (() => {
  const a = POSES[0], b = POSES[POSES.length - 1];
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z) + Math.abs(((b.rumo - a.rumo) % (4 * MEIO_PI)));
})();

/** O trecho em que está a distância `s` (de qualquer volta). */
export function trechoEm(faixa: number, s: number): Trecho {
  const v = VOLTA[faixa];
  let d = s - Math.floor(s / v) * v;
  if (d < 0) d = 0;
  const lista = TRECHOS[faixa];
  for (let i = lista.length - 1; i >= 0; i--) if (d >= lista[i].inicio) return lista[i];
  return lista[0];
}

export const limiteEm = (faixa: number, s: number) => trechoEm(faixa, s).limite;

export interface Carro {
  faixa: number;
  /** A distância andada desde a largada (as voltas somadas). */
  s: number;
  v: number;
  passo: number;
  /** Os passos que faltam para voltar à pista (0: na pista). */
  fora: number;
  /** Os passos que ainda pisca depois de voltar. */
  pisca: number;
  /** De 0 a 1: o quanto passou da velocidade da curva (o desenho treme o carro). */
  derrapa: number;
  /** A velocidade com que saiu (o desenho do voo). */
  saiuA: number;
  saidas: number;
  /** O passo do fim de cada volta. */
  voltas: number[];
  chegou: boolean;
}

export const novoCarro = (faixa: number): Carro => ({ faixa, s: 0, v: 0, passo: 0, fora: 0, pisca: 0, derrapa: 0, saiuA: 0, saidas: 0, voltas: [], chegou: false });

export type Evento = 'saiu' | 'voltou' | 'volta' | 'chegou' | null;

/** A velocidade depois de um passo com o acelerador `g` (sem a curva). */
function acelerar(v: number, g: number): number {
  const n = v + (VMAX * ATRITO * (g / ACELERADOR_MAXIMO) - ATRITO * v - (g === 0 ? FREIO : 0)) * PASSO;
  return n < 0 ? 0 : n;
}

/** Um passo da corrida, com o acelerador de 0 a 8 (fora disso, arredondado para dentro). Devolve o que aconteceu. */
export function passo(c: Carro, acelerador: number): Evento {
  c.passo++;
  if (c.pisca > 0) c.pisca--;
  if (c.fora > 0) {
    c.fora--;
    if (c.fora === 0) {
      c.pisca = PISCA_PASSOS;
      return 'voltou';
    }
    return null;
  }
  let g = acelerador | 0;
  if (g < 0) g = 0;
  if (g > ACELERADOR_MAXIMO) g = ACELERADOR_MAXIMO;
  if (c.chegou) g = 0;
  c.v = acelerar(c.v, g);
  const limite = limiteEm(c.faixa, c.s);
  c.derrapa = 0;
  if (c.v > limite + FOLGA && !c.chegou) {
    c.saiuA = c.v;
    c.v = 0;
    c.fora = FORA_PASSOS;
    c.saidas++;
    return 'saiu';
  }
  if (c.v > limite) {
    c.derrapa = (c.v - limite) / FOLGA;
    c.v -= ATRITO_DA_DERRAPAGEM * PASSO;
  }
  c.s += c.v * PASSO;
  if (!c.chegou && c.s >= (c.voltas.length + 1) * VOLTA[c.faixa]) {
    c.voltas.push(c.passo);
    if (c.voltas.length >= VOLTAS) {
      c.chegou = true;
      return 'chegou';
    }
    return 'volta';
  }
  return null;
}

/**
 * O PILOTO AUTOMÁTICO (os robôs, os testes): acelera tudo a menos que, acelerando neste passo e soltando depois, chegue a
 * alguma curva acima da velocidade dela menos a `margem`. Com margem negativa maior que a folga, ele sai da pista.
 */
export function pilotoAutomatico(c: Carro, margem = 0.3): number {
  if (c.fora > 0 || c.chegou) return 0;
  let s = c.s, v = acelerar(c.v, ACELERADOR_MAXIMO);
  for (let k = 0; k < 240; k++) {
    const t = trechoEm(c.faixa, s);
    if (t.sentido !== 0 && v > t.limite - margem) return 0;
    if (v < 0.3) break;
    s += v * PASSO;
    v = acelerar(v, 0);
  }
  return ACELERADOR_MAXIMO;
}

/** O acelerador em trechos: [passos, acelerador, passos, acelerador, …]. */
export type Entradas = number[];

/** Confere a forma das entradas (inteiros, acelerador de 0 a 8, o total dentro do máximo). */
export function entradasValidas(e: unknown): e is Entradas {
  if (!Array.isArray(e) || e.length === 0 || e.length % 2 !== 0 || e.length > 40000) return false;
  let total = 0;
  for (let i = 0; i < e.length; i += 2) {
    const n = e[i], g = e[i + 1];
    if (!Number.isInteger(n) || n < 1 || !Number.isInteger(g) || g < 0 || g > ACELERADOR_MAXIMO) return false;
    total += n;
    if (total > PASSOS_MAXIMOS) return false;
  }
  return true;
}

/** Refaz uma corrida inteira pelas entradas. O carro do fim diz se chegou e em que passo terminou cada volta. */
export function refazer(faixa: number, e: Entradas): Carro {
  const c = novoCarro(faixa);
  for (let i = 0; i < e.length && !c.chegou; i += 2) {
    for (let k = 0; k < e[i] && !c.chegou; k++) passo(c, e[i + 1]);
  }
  return c;
}

/** Quem grava as entradas: junta os passos iguais seguidos. */
export function gravador() {
  const e: Entradas = [];
  return {
    entradas: e,
    anotar(g: number) {
      const n = e.length;
      if (n && e[n - 1] === g) e[n - 2]++;
      else e.push(1, g);
    },
  };
}

/** O acelerador de um passo, lido das entradas (o fantasma). */
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

/** DESENHO: onde está o carro (x, z) e para onde aponta (o rumo, em radianos), à distância `s` na faixa. */
export function poseNaFaixa(faixa: number, s: number): { x: number; z: number; rumo: number } {
  const t = trechoEm(faixa, s);
  const v = VOLTA[faixa];
  let u = s - Math.floor(s / v) * v - t.inicio;
  if (u < 0) u = 0;
  if (t.sentido === 0) return { x: t.x + Math.cos(t.rumo) * u, z: t.z + Math.sin(t.rumo) * u, rumo: t.rumo };
  const ang = (t.sentido * u) / t.raio;
  const ox = t.x - t.cx, oz = t.z - t.cz;
  const c = Math.cos(ang), sn = Math.sin(ang);
  return { x: t.cx + ox * c - oz * sn, z: t.cz + ox * sn + oz * c, rumo: t.rumo + ang };
}
