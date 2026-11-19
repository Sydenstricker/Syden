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
 * aparecem só no DESENHO (`poseNaFaixa`) e na conferência de que o traçado não se cruza (`seCruza`, com folga): onde pôr o
 * carro na tela, e não quanto ele andou. As posições das peças são inteiras (a reta anda 4, a curva 3 de cada lado).
 *
 * AS REGRAS: o passo é 1/60 s, e o tempo é o NÚMERO DE PASSOS. O acelerador vai de 0 a 8. Cada curva tem uma velocidade
 * máxima; acima dela, até a FOLGA, o carro DERRAPA (treme e perde um pouco de velocidade); passou da folga, SAI DA PISTA,
 * fica fora FORA_PASSOS e volta, piscando, ao lugar de onde saiu, parado. Cinco voltas, ou vinte na RESISTÊNCIA.
 *
 * A PISTA: as peças largas da Kenney têm 2 de largura e 4 de comprimento, e as curvas pequena (raio 2) e grande (raio 4) são
 * CONCÊNTRICAS: duas fileiras de peças lado a lado dão 4 faixas. A linha do meio das duas fileiras faz as curvas com raio 3.
 * Numa curva para um lado a faixa de dentro é mais curta; para que nenhuma faixa ganhe por isso, a velocidade máxima de cada
 * raio foi medida de modo que o piloto automático faça a mesma volta em todas (o teste confere em cada traçado pronto: 1% de
 * diferença, no máximo). O CRUZAMENTO (19/11/2026) é uma reta em que as faixas trocam de lado (a de fora passa para dentro):
 * depois dele, a faixa que era de dentro nas curvas "+" é a de fora. Ele tem o mesmo comprimento em todas as faixas, e um
 * traçado tem de ter um número PAR deles, para cada faixa voltar ao lado em que largou.
 *
 * OS TRAÇADOS: os prontos (TRACADOS, cada um com o seu id, recorde e fantasma) e os do EDITOR (19/11/2026), que chegam como um
 * código de texto ("SYDP1-" + as peças) e valem só se `validarTracado` aceitar: fecha, não se cruza, cruzamentos em par,
 * comprimento mínimo. O servidor confere o código colado com a mesma função e refaz a corrida sobre ele.
 */

export const PASSO = 1 / 60;
export const VOLTAS = 5;
/** A RESISTÊNCIA (19/11/2026): a mesma corrida, com vinte voltas. */
export const VOLTAS_DA_RESISTENCIA = 20;
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
/** Uma corrida não passa de 30 minutos (a resistência longa, com saídas, cabe). */
export const PASSOS_MAXIMOS = 30 * 60 * 60;

/** O raio das curvas da linha do meio (entre as duas fileiras de peças). */
export const RAIO_DO_MEIO = 3;
export const COMPRIMENTO_DA_RETA = 4;
/** A distância de cada faixa à linha do meio, para o lado das curvas "+" (a faixa 0 é a de dentro nelas). */
export const DESLOCAMENTO = [1.5, 0.5, -0.5, -1.5];

/**
 * A velocidade máxima em cada raio de faixa (medida: ver o cabeçalho). Literais, e não uma conta com potência, para dar o
 * mesmo número em qualquer motor.
 */
export const LIMITE_DO_RAIO: Record<number, number> = { 1.5: 4.7, 2.5: 6.4, 3.5: 8.08, 4.5: 9.9 };

const MEIO_PI = 1.5707963267948966;

/**
 * As peças de um traçado: R é uma reta; + e − são curvas de 90°, para um lado e para o outro; X é o CRUZAMENTO (uma reta em
 * que as faixas trocam de lado).
 */
export type LetraDaPeca = 'R' | '+' | '-' | 'X';
export const LETRAS: readonly LetraDaPeca[] = ['R', '+', '-', 'X'];

/**
 * Os traçados prontos, pela ordem da escolha. A Toca é a de sempre (o id 'toca-1' guarda os recordes de antes). Os outros
 * quatro (19/11/2026) foram escolhidos entre traçados sorteados que fecham, não se cruzam e deixam as faixas a menos de 0,6%
 * uma da outra com o piloto automático, em 5 e em 20 voltas. Medido no mesmo dia: o OVAL (duas voltas de "++" e retas) NÃO
 * serve, com 2,3% (as faixas do meio perdem nas voltas fechadas), nem com cruzamentos: trocar de lado não muda a distância
 * de cada faixa ao meio. Mexeu num traçado ou nos limites, medir de novo (o teste cobra 1%).
 */
export const TRACADOS: Record<string, string> = {
  // um retângulo com um dente no meio de um lado (6 curvas "+" e 2 "−"): 47 s em 5 voltas
  'toca-1': 'RRRR+RR++-R-++RR+',
  // o caracol: curto, com as voltas apertadas uma atrás da outra (39 s)
  'caracol-1': 'R+RRR+R++--++',
  // o zigue-zague: um "S" logo depois da largada e uma reta comprida (53 s)
  'zigue-1': 'RRRR-+R+R+RRRRR-++R+',
  // a troca: dois CRUZAMENTOS, e cada faixa corre um pedaço da volta de cada lado (58 s)
  'troca-1': 'R-+RR+RXR+RRRX-++RRR+R',
  // a estrada longa: as retas mais compridas, a melhor para a resistência (62 s; 4 min em 20 voltas)
  'longa-1': 'R-+RRRRR+RRR++-RRRRRRR++R',
};
export const IDS_DAS_PISTAS = Object.keys(TRACADOS);
export const PISTA_PADRAO_ID = 'toca-1';

export interface Trecho {
  /** Onde o trecho começa, na faixa (distância desde a largada). */
  inicio: number;
  comprimento: number;
  /** 0 na reta e no cruzamento; +1 ou −1 na curva. */
  sentido: number;
  raio: number;
  limite: number;
  // o desenho: a posição e o rumo no começo do trecho (o rumo em radianos, no plano x, z), e o centro da curva
  x: number;
  z: number;
  rumo: number;
  cx: number;
  cz: number;
  /** No cruzamento, o quanto a faixa anda de lado do começo ao fim (no desenho); 0 nos outros. */
  ladoX: number;
  ladoZ: number;
}

export interface Peca {
  /** 'reta', 'pequena' ou 'grande': a peça da Kenney; 'cruzamento' é a reta com as faixas trocando de lado. */
  tipo: 'reta' | 'pequena' | 'grande' | 'cruzamento';
  sentido: number;
  /** A entrada da peça (a linha do meio da fileira) e o rumo nela. */
  x: number;
  z: number;
  rumo: number;
  /** A fileira: +1 do lado das curvas "+", −1 do outro. */
  fileira: number;
}

export interface Pista {
  /** O id: o do traçado pronto, ou "p-" + o resumo do traçado do editor. */
  id: string;
  tracado: string;
  /** Os trechos de cada faixa, do começo ao fim da volta. */
  trechos: Trecho[][];
  /** O comprimento de uma volta em cada faixa. */
  volta: number[];
  pecas: Peca[];
  /** Quanto a linha do meio fecha a volta (0 num traçado que fecha). */
  fechamento: number;
  /** O comprimento da linha do meio. */
  comprimento: number;
}

/** As direções inteiras do rumo (0: +x; 1: +z; 2: −x; 3: −z): as posições das peças ficam exatas. */
const DIRECOES = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const direcao = (q: number) => DIRECOES[((q % 4) + 4) % 4];

interface Pose {
  x: number;
  z: number;
  /** O rumo em quartos de volta (inteiro, sem dar a volta: as curvas do desenho seguem contínuas). */
  q: number;
}

/** A linha do meio: a pose no começo de cada peça do traçado, e a do fim. */
function linhaDoMeio(tracado: string): Pose[] {
  const poses: Pose[] = [];
  let x = 0, z = 0, q = 0;
  for (const p of tracado) {
    poses.push({ x, z, q });
    const [dx, dz] = direcao(q);
    if (p === '+' || p === '-') {
      const s = p === '+' ? 1 : -1;
      // o lado das curvas "+" é o rumo girado de +90°
      x += (dx - s * dz) * RAIO_DO_MEIO;
      z += (dz + s * dx) * RAIO_DO_MEIO;
      q += s;
    } else {
      x += dx * COMPRIMENTO_DA_RETA;
      z += dz * COMPRIMENTO_DA_RETA;
    }
  }
  poses.push({ x, z, q });
  return poses;
}

/** Um resumo curto e sempre igual do traçado (FNV-1a de 32 bits): o id da pista do editor. */
export function resumoDoTracado(tracado: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < tracado.length; i++) {
    h ^= tracado.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** O id de um traçado: o do pronto, se for um deles; senão "p-" + o resumo. */
export function idDoTracado(tracado: string): string {
  for (const id of IDS_DAS_PISTAS) if (TRACADOS[id] === tracado) return id;
  return `p-${resumoDoTracado(tracado)}`;
}

/** Monta a pista de um traçado (sem conferir: para isso, `validarTracado`). */
export function montarPista(tracado: string, id = idDoTracado(tracado)): Pista {
  const poses = linhaDoMeio(tracado);
  const letras = [...tracado];
  const trechos = DESLOCAMENTO.map((o0) => {
    const lista: Trecho[] = [];
    let inicio = 0;
    // o lado da faixa: troca a cada cruzamento
    let lado = 1;
    letras.forEach((p, i) => {
      const { x: mx, z: mz, q } = poses[i];
      const [dx, dz] = direcao(q);
      const lx = -dz, lz = dx;
      const o = lado * o0;
      const x = mx + lx * o, z = mz + lz * o;
      const rumo = q * MEIO_PI;
      if (p === '+' || p === '-') {
        const s = p === '+' ? 1 : -1;
        const raio = RAIO_DO_MEIO - s * o;
        const comprimento = MEIO_PI * raio;
        lista.push({ inicio, comprimento, sentido: s, raio, limite: LIMITE_DO_RAIO[raio], x, z, rumo, cx: mx + lx * s * RAIO_DO_MEIO, cz: mz + lz * s * RAIO_DO_MEIO, ladoX: 0, ladoZ: 0 });
        inicio += comprimento;
      } else {
        const cruza = p === 'X';
        lista.push({ inicio, comprimento: COMPRIMENTO_DA_RETA, sentido: 0, raio: 0, limite: VMAX, x, z, rumo, cx: 0, cz: 0, ladoX: cruza ? -2 * o * lx : 0, ladoZ: cruza ? -2 * o * lz : 0 });
        inicio += COMPRIMENTO_DA_RETA;
        if (cruza) lado = -lado;
      }
    });
    return lista;
  });
  const volta = trechos.map((l) => (l.length ? l[l.length - 1].inicio + l[l.length - 1].comprimento : 0));
  // as peças da Kenney, nas duas fileiras: na curva, a fileira de dentro leva a pequena, a de fora a grande
  const pecas: Peca[] = letras.flatMap((p, i) => {
    const { x: mx, z: mz, q } = poses[i];
    const [dx, dz] = direcao(q);
    const lx = -dz, lz = dx;
    const rumo = q * MEIO_PI;
    return [1, -1].map((fileira): Peca => {
      const x = mx + lx * fileira, z = mz + lz * fileira;
      if (p === 'R') return { tipo: 'reta', sentido: 0, x, z, rumo, fileira };
      if (p === 'X') return { tipo: 'cruzamento', sentido: 0, x, z, rumo, fileira };
      const s = p === '+' ? 1 : -1;
      return { tipo: s === fileira ? 'pequena' : 'grande', sentido: s, x, z, rumo, fileira };
    });
  });
  const a = poses[0], b = poses[poses.length - 1];
  const giro = (((b.q - a.q) % 4) + 4) % 4;
  let comprimento = 0;
  for (const p of letras) comprimento += p === '+' || p === '-' ? MEIO_PI * RAIO_DO_MEIO : COMPRIMENTO_DA_RETA;
  return { id, tracado, trechos, volta, pecas, fechamento: Math.abs(a.x - b.x) + Math.abs(a.z - b.z) + giro, comprimento };
}

/** As pistas prontas, já montadas. */
export const PISTAS: Record<string, Pista> = Object.fromEntries(IDS_DAS_PISTAS.map((id) => [id, montarPista(TRACADOS[id], id)]));
export const PISTA_PADRAO = PISTAS[PISTA_PADRAO_ID];

// =====================================================================================================================
// O EDITOR: o traçado, a conferência e o código
// =====================================================================================================================

export const PECAS_NO_MINIMO = 6;
export const PECAS_NO_MAXIMO = 60;
/** O comprimento mínimo da linha do meio (um oval curto que ainda dá corrida). */
export const COMPRIMENTO_MINIMO = 40;
/** Dois pontos da linha do meio mais perto que isto se encostam (cada fileira tem 2 de largura: a pista tem 4). */
const LARGURA_DA_PISTA = 4;

/** Por que um traçado não vale (a tela traduz). */
export type ErroDoTracado = 'pecas' | 'reta' | 'curta' | 'nao-fecha' | 'impar' | 'cruza';

/**
 * Põe o traçado na forma de sempre: só as letras conhecidas, começando na primeira reta (a largada é numa reta). Dois códigos
 * da mesma pista com a largada noutro lugar continuam pistas diferentes: é outra corrida.
 */
export function normalizarTracado(texto: string): string {
  const t = [...texto.toUpperCase()].filter((c) => (LETRAS as readonly string[]).includes(c)).join('');
  const i = t.indexOf('R');
  return i <= 0 ? t : t.slice(i) + t.slice(0, i);
}

/** Quanto falta para a volta fechar, na linha do meio: a distância e o giro (para o editor mostrar). */
export function fimDoTracado(tracado: string): { x: number; z: number; q: number } {
  const poses = linhaDoMeio(tracado);
  return poses[poses.length - 1];
}

/**
 * Confere um traçado do editor: o número de peças, uma reta para a largada, o comprimento mínimo, a volta que fecha (no
 * mesmo lugar e no mesmo rumo), os cruzamentos em par e a pista que não passa por cima de si mesma.
 */
export function validarTracado(tracado: string): { pista: Pista } | { erro: ErroDoTracado } {
  if (tracado.length < PECAS_NO_MINIMO || tracado.length > PECAS_NO_MAXIMO || normalizarTracado(tracado) !== tracado) return { erro: 'pecas' };
  if (tracado[0] !== 'R') return { erro: 'reta' };
  const pista = montarPista(tracado);
  if (pista.fechamento !== 0) return { erro: 'nao-fecha' };
  if (pista.comprimento < COMPRIMENTO_MINIMO) return { erro: 'curta' };
  let cruzamentos = 0;
  for (const p of tracado) if (p === 'X') cruzamentos++;
  if (cruzamentos % 2 !== 0) return { erro: 'impar' };
  if (seCruza(tracado)) return { erro: 'cruza' };
  return { pista };
}

/**
 * A pista passa por cima de si mesma? Amostra a linha do meio a cada 0,25 e confere cada par de pontos que estão longe ao
 * longo da pista (mais de 4,5: numa curva de raio 3, isso já dá mais de 4 em linha reta) e perto no chão (menos de 4).
 */
export function seCruza(tracado: string): boolean {
  const pontos = amostrasDaLinhaDoMeio(tracado, 0.25);
  let total = 0;
  for (const p of tracado) total += p === '+' || p === '-' ? MEIO_PI * RAIO_DO_MEIO : COMPRIMENTO_DA_RETA;
  const minimo = (LARGURA_DA_PISTA - 1e-6) * (LARGURA_DA_PISTA - 1e-6);
  for (let i = 0; i < pontos.length; i++) {
    for (let j = i + 1; j < pontos.length; j++) {
      const longe = pontos[j].d - pontos[i].d;
      if (longe <= 4.5 || total - longe <= 4.5) continue;
      const ex = pontos[i].x - pontos[j].x, ez = pontos[i].z - pontos[j].z;
      if (ex * ex + ez * ez < minimo) return true;
    }
  }
  return false;
}

/**
 * Pontos da linha do meio a cada `passo` (com a distância ao longo da pista): a conferência de `seCruza` e o DESENHO do mapa
 * (também de um traçado que ainda não fecha, no editor).
 */
export function amostrasDaLinhaDoMeio(tracado: string, passo: number): { x: number; z: number; d: number }[] {
  const poses = linhaDoMeio(tracado);
  const pontos: { x: number; z: number; d: number }[] = [];
  let d = 0;
  [...tracado].forEach((p, i) => {
    const { x, z, q } = poses[i];
    const [dx, dz] = direcao(q);
    if (p === '+' || p === '-') {
      const s = p === '+' ? 1 : -1;
      const cx = x - dz * s * RAIO_DO_MEIO, cz = z + dx * s * RAIO_DO_MEIO;
      const comp = MEIO_PI * RAIO_DO_MEIO;
      for (let u = 0; u < comp; u += passo) {
        const ang = (s * u) / RAIO_DO_MEIO;
        const ox = x - cx, oz = z - cz;
        const c = Math.cos(ang), sn = Math.sin(ang);
        pontos.push({ x: cx + ox * c - oz * sn, z: cz + ox * sn + oz * c, d: d + u });
      }
      d += comp;
    } else {
      for (let u = 0; u < COMPRIMENTO_DA_RETA; u += passo) pontos.push({ x: x + dx * u, z: z + dz * u, d: d + u });
      d += COMPRIMENTO_DA_RETA;
    }
  });
  const fim = poses[poses.length - 1];
  pontos.push({ x: fim.x, z: fim.z, d });
  return pontos;
}

/** O código de uma pista do editor, para copiar e colar: "SYDP1-" + as peças. */
export const PREFIXO_DO_CODIGO = 'SYDP1-';
export const codigoDaPista = (tracado: string) => PREFIXO_DO_CODIGO + tracado;

/** O traçado de um código colado (já normalizado), ou null se não é um código de pista. A conferência é `validarTracado`. */
export function lerCodigoDaPista(texto: unknown): string | null {
  if (typeof texto !== 'string') return null;
  const t = texto.trim().toUpperCase();
  if (!t.startsWith(PREFIXO_DO_CODIGO) || t.length > PREFIXO_DO_CODIGO.length + PECAS_NO_MAXIMO) return null;
  const corpo = t.slice(PREFIXO_DO_CODIGO.length);
  if (![...corpo].every((c) => (LETRAS as readonly string[]).includes(c))) return null;
  return normalizarTracado(corpo);
}

/**
 * A pista pedida: um código do editor (conferido) ou o id de uma pronta; sem nada, a de sempre. Null se o pedido não vale.
 */
export function pistaPedida(id: unknown, codigo: unknown): Pista | null {
  if (typeof codigo === 'string' && codigo) {
    const t = lerCodigoDaPista(codigo);
    if (!t) return null;
    const v = validarTracado(t);
    return 'pista' in v ? PISTAS[v.pista.id] ?? v.pista : null;
  }
  if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(PISTAS, id)) return PISTAS[id];
  return id === undefined || id === null || id === '' ? PISTA_PADRAO : null;
}

// =====================================================================================================================
// A CORRIDA
// =====================================================================================================================

/** O trecho em que está a distância `s` (de qualquer volta). */
export function trechoEm(pista: Pista, faixa: number, s: number): Trecho {
  const v = pista.volta[faixa];
  let d = s - Math.floor(s / v) * v;
  if (d < 0) d = 0;
  const lista = pista.trechos[faixa];
  for (let i = lista.length - 1; i >= 0; i--) if (d >= lista[i].inicio) return lista[i];
  return lista[0];
}

export const limiteEm = (pista: Pista, faixa: number, s: number) => trechoEm(pista, faixa, s).limite;

export interface Carro {
  faixa: number;
  /** A pista em que corre, e quantas voltas tem a corrida. */
  pista: Pista;
  meta: number;
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

export const novoCarro = (faixa: number, pista: Pista = PISTA_PADRAO, meta: number = VOLTAS): Carro => ({
  faixa,
  pista,
  meta,
  s: 0,
  v: 0,
  passo: 0,
  fora: 0,
  pisca: 0,
  derrapa: 0,
  saiuA: 0,
  saidas: 0,
  voltas: [],
  chegou: false,
});

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
  const limite = limiteEm(c.pista, c.faixa, c.s);
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
  if (!c.chegou && c.s >= (c.voltas.length + 1) * c.pista.volta[c.faixa]) {
    c.voltas.push(c.passo);
    if (c.voltas.length >= c.meta) {
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
    const t = trechoEm(c.pista, c.faixa, s);
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
  if (!Array.isArray(e) || e.length === 0 || e.length % 2 !== 0 || e.length > 160000) return false;
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
export function refazer(faixa: number, e: Entradas, pista: Pista = PISTA_PADRAO, meta: number = VOLTAS): Carro {
  const c = novoCarro(faixa, pista, meta);
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
export function poseNaFaixa(pista: Pista, faixa: number, s: number): { x: number; z: number; rumo: number } {
  const t = trechoEm(pista, faixa, s);
  const v = pista.volta[faixa];
  let u = s - Math.floor(s / v) * v - t.inicio;
  if (u < 0) u = 0;
  if (t.sentido === 0) {
    const k = u / t.comprimento;
    const cr = Math.cos(t.rumo), sr = Math.sin(t.rumo);
    // no cruzamento, a faixa anda de lado; o carro aponta para onde vai
    const desvio = t.ladoX || t.ladoZ ? Math.atan2(cr * t.ladoZ - sr * t.ladoX, t.comprimento) : 0;
    return { x: t.x + cr * u + t.ladoX * k, z: t.z + sr * u + t.ladoZ * k, rumo: t.rumo + desvio };
  }
  const ang = (t.sentido * u) / t.raio;
  const ox = t.x - t.cx, oz = t.z - t.cz;
  const c = Math.cos(ang), sn = Math.sin(ang);
  return { x: t.cx + ox * c - oz * sn, z: t.cz + ox * sn + oz * c, rumo: t.rumo + ang };
}
