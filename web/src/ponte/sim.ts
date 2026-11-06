/**
 * A PONTE DA TOCA — A REGRA (06/11/2026, pedido dele: "um minigame similar ao Poly Bridge: 30 segundos para montar a ponte, e ganha
 * quem usar menos recursos e conseguir fazer o tráfego atravessar"). SÓ A MECÂNICA do gênero de construir ponte: nada de nome,
 * arte, peças ou som de jogo nenhum.
 *
 * ESTE ARQUIVO EXISTE EM DUAS CÓPIAS IGUAIS BYTE A BYTE: web/src/ponte/sim.ts e server/src/ponte-sim.ts (web/test/ponte.test.ts
 * confere). O site monta e mostra; o servidor REFAZ a simulação com a lista de peças, e o resultado (passou, quanto andou, o custo)
 * é o DELE. Por isso aqui só entra conta que dá o mesmo número em qualquer computador: + − × ÷ e raiz, nada de seno nem cosseno, e
 * a ordem das contas é sempre a mesma (as listas, nunca um Map percorrido).
 *
 * A GRADE: x de 0 (a margem da esquerda) até `largura` (a da direita), y de `baixo` até `alto`, em casas inteiras; y cresce para
 * CIMA, e a pista das margens está em y = 0. Nas colunas das margens (x = 0 e x = largura) só os pontos de apoio fixos (âncoras):
 * ali é a parede do barranco.
 *
 * AS PEÇAS (poucas, de propósito, e cada uma com um papel):
 *  - PISTA (tábua): a ÚNICA por onde o tráfego passa. Inclinação até 45°, até ~2,2 casas. 150 por casa.
 *  - MADEIRA (viga): a estrutura barata, até ~2,2 casas. 100 por casa. Aguenta pouco.
 *  - AÇO (viga): mais forte e mais longa (até ~3,6 casas), e cara: 300 por casa.
 * O custo de cada peça é o preço × o comprimento, arredondado; o da ponte é a soma.
 *
 * A FÍSICA: massa-mola. Cada ponta de peça é um nó com metade da massa das peças que chegam nele; cada peça é uma mola rígida com
 * amortecimento ao longo dela. Passo fixo de 1/60 s, dividido em 16 subpassos (Euler semi-implícito). A força de cada peça, no
 * pior subpasso do passo, comparada ao limite do tipo: passou dele (puxando ou empurrando), a peça QUEBRA. O tráfego é uma carga
 * que anda: cada veículo, na velocidade dele, apoia o peso nas duas pontas da peça de pista embaixo dele (pela posição), e segue a
 * altura dela. Sem pista embaixo (quebrou, ou nunca houve), ele CAI; afundou abaixo da água ou do fundo, também.
 *
 * O RESULTADO: passou se todos os veículos chegaram ao outro lado. Senão, o quanto o tráfego andou (de 0 a 1000, a média dos
 * veículos), contado no instante em que o primeiro caiu: os de trás freiam.
 */

export const PASSO = 1 / 60;
const SUBPASSOS = 16;
const H = PASSO / SUBPASSOS;
export const GRAVIDADE = 10;
/** Os 30 segundos da montagem, em passos (no Solo, o relógio é o do computador e pausa; na sala, é o do servidor). */
export const MONTAGEM_PASSOS = 30 * 60;
/** Peças demais para uma ponte de 30 segundos. */
export const MAX_PECAS = 160;
/** A simulação nunca passa disto (um minuto): o tráfego anda sempre, então só um defeito chegaria aqui. */
export const LIMITE_DA_SIMULACAO = 60 * 60;
/** O tráfego espera a ponte assentar (1 s) antes de sair. */
const ESPERA = 60;
/** Os passos em que o peso da ponte entra aos poucos, antes de o tráfego sair. */
const ASSENTAR = 45;
/** Onde o tráfego sai e onde ele chega, em casas além das margens. */
export const SAIDA = -3;
const ALEM = 3;
/** A distância entre um veículo e o da frente. */
const DISTANCIA = 3.2;
/** Depois da primeira queda, a cena segue um pouco (para ver a ponte cair) e acaba. */
const DEPOIS_DA_QUEDA = 100;
/** Amortecimento: ao longo de cada peça (proporcional à rigidez) e no ar (bem pouco). */
const AMORTECIMENTO_AXIAL = 0.01;
/** A massa da junta (o pino) em cada nó: segura a conta dos nós leves. */
const MASSA_DA_JUNTA = 0.3;
const AMORTECIMENTO_DO_AR = 0.3;

export const PISTA = 0;
export const MADEIRA = 1;
export const ACO = 2;

export interface TipoDePeca {
  /** Custo por casa de comprimento. */
  preco: number;
  /** Massa por casa. */
  massa: number;
  /** A rigidez da mola (força por deformação relativa). */
  rigidez: number;
  /** A força que ela aguenta, puxando ou empurrando. */
  limite: number;
  /** O comprimento máximo, ao quadrado (em casas inteiras: 5 deixa (2, 1); 13 deixa (3, 2)). */
  alcance2: number;
}

export const PECAS: readonly TipoDePeca[] = [
  { preco: 150, massa: 0.6, rigidez: 15000, limite: 120, alcance2: 5 },
  { preco: 100, massa: 0.4, rigidez: 15000, limite: 110, alcance2: 5 },
  { preco: 300, massa: 0.8, rigidez: 40000, limite: 300, alcance2: 13 },
];

export type IdDoVeiculo = 'carroca' | 'carro' | 'caminhao';
export interface TipoDeVeiculo {
  massa: number;
  /** Casas por segundo. */
  velocidade: number;
  /** Só para o desenho. */
  comprimento: number;
}
export const VEICULOS: Record<IdDoVeiculo, TipoDeVeiculo> = {
  carroca: { massa: 2.5, velocidade: 2.4, comprimento: 1.5 },
  carro: { massa: 4, velocidade: 3, comprimento: 1.6 },
  caminhao: { massa: 8, velocidade: 2.2, comprimento: 2.4 },
};

export interface Fase {
  id: string;
  /** O vão, em casas (as margens em x = 0 e x = largura). */
  largura: number;
  alto: number;
  baixo: number;
  /** A água (y), ou null na ravina sem rio. */
  agua: number | null;
  /** O fundo (y): o leito do rio ou o chão da ravina. */
  fundo: number;
  /** Os pontos de apoio fixos: [x, y, x, y, ...]. */
  ancoras: readonly number[];
  /** Pilares de pedra (só desenho; o apoio é a âncora): [x, topo, ...]. */
  pedras: readonly number[];
  trafego: readonly IdDoVeiculo[];
}

export const FASES: readonly Fase[] = [
  // 1: o riacho, curto, com apoio embaixo nas duas margens; uma carroça
  { id: 'riacho', largura: 6, alto: 3, baixo: -2, agua: -2.6, fundo: -4, ancoras: [0, 0, 6, 0, 0, -2, 6, -2], pedras: [], trafego: ['carroca'] },
  // 2: o rio, mais largo; duas carroças
  { id: 'rio', largura: 8, alto: 3, baixo: -2, agua: -2.6, fundo: -4, ancoras: [0, 0, 8, 0, 0, -2, 8, -2], pedras: [], trafego: ['carroca', 'carroca'] },
  // 3: a ravina, sem água e funda; carros e uma carroça
  { id: 'ravina', largura: 10, alto: 3, baixo: -4, agua: null, fundo: -7, ancoras: [0, 0, 10, 0, 0, -3, 10, -3], pedras: [], trafego: ['carro', 'carroca', 'carro'] },
  // 4: as margens altas, sem apoio embaixo: só os pilares acima da pista; dois carros
  { id: 'pilares', largura: 10, alto: 4, baixo: -1, agua: -2, fundo: -4, ancoras: [0, 0, 10, 0, 0, 3, 10, 3], pedras: [], trafego: ['carro', 'carro'] },
  // 5: o vão grande, com uma pedra no meio do rio; o caminhão e um carro
  {
    id: 'pedra',
    largura: 14,
    alto: 3,
    baixo: -3,
    agua: -3.6,
    fundo: -5,
    ancoras: [0, 0, 14, 0, 0, -2, 14, -2, 7, -3],
    pedras: [7, -3],
    trafego: ['caminhao', 'carro'],
  },
];

export function faseDe(id: unknown): Fase | null {
  for (const f of FASES) if (f.id === id) return f;
  return null;
}

export function ehAncora(f: Fase, x: number, y: number): boolean {
  for (let i = 0; i < f.ancoras.length; i += 2) if (f.ancoras[i] === x && f.ancoras[i + 1] === y) return true;
  return false;
}

/** Um ponto onde se pode pôr um nó: dentro da grade e fora da parede dos barrancos (lá, só as âncoras). */
export function cabe(f: Fase, x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (ehAncora(f, x, y)) return true;
  return x > 0 && x < f.largura && y >= f.baixo && y <= f.alto;
}

/** A peça de `tipo` pode ligar estes dois pontos? (o comprimento, e a pista sem passar de 45°) */
export function pecaCabe(tipo: number, ax: number, ay: number, bx: number, by: number): boolean {
  const p = PECAS[tipo];
  if (!p) return false;
  const dx = bx - ax;
  const dy = by - ay;
  const d2 = dx * dx + dy * dy;
  if (d2 === 0 || d2 > p.alcance2) return false;
  if (tipo === PISTA && (dx === 0 || dy * dy > dx * dx)) return false;
  return true;
}

export function custoDaPeca(tipo: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.round(PECAS[tipo].preco * Math.sqrt(dx * dx + dy * dy));
}

/** A lista vai e volta como [ax, ay, bx, by, tipo, ...]. */
export function custo(pecas: readonly number[]): number {
  let c = 0;
  for (let i = 0; i + 4 < pecas.length; i += 5) c += custoDaPeca(pecas[i + 4], pecas[i], pecas[i + 1], pecas[i + 2], pecas[i + 3]);
  return c;
}

const chave = (x: number, y: number) => (x + 100) * 1000 + (y + 100);

/**
 * Confere a lista de peças, como o servidor a recebe: inteiros, dentro da grade, o comprimento de cada tipo, nenhuma peça
 * repetida e TODAS ligadas a um ponto de apoio (o que fica solto cai, e a montagem já o tira). Devolve o defeito, ou null.
 */
export function conferir(f: Fase, pecas: unknown): string | null {
  if (!Array.isArray(pecas) || pecas.length % 5 !== 0) return 'formato';
  if (pecas.length / 5 > MAX_PECAS) return 'pecas-demais';
  for (const v of pecas) if (!Number.isInteger(v)) return 'formato';
  const lista = pecas as number[];
  const pares = new Set<string>();
  // a união dos nós (o chão é um nó só)
  const pai = new Map<number, number>();
  const raiz = (k: number): number => {
    let r = k;
    while (pai.has(r) && pai.get(r) !== r) r = pai.get(r)!;
    return r;
  };
  const no = (x: number, y: number) => (ehAncora(f, x, y) ? -1 : chave(x, y));
  const unir = (a: number, b: number) => {
    if (!pai.has(a)) pai.set(a, a);
    if (!pai.has(b)) pai.set(b, b);
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) pai.set(ra, rb);
  };
  for (let i = 0; i < lista.length; i += 5) {
    const [ax, ay, bx, by, tipo] = [lista[i], lista[i + 1], lista[i + 2], lista[i + 3], lista[i + 4]];
    if (tipo < 0 || tipo >= PECAS.length) return 'tipo';
    if (!cabe(f, ax, ay) || !cabe(f, bx, by)) return 'fora-da-grade';
    if (!pecaCabe(tipo, ax, ay, bx, by)) return 'comprimento';
    const ka = chave(ax, ay);
    const kb = chave(bx, by);
    const par = ka < kb ? `${ka}:${kb}` : `${kb}:${ka}`;
    if (pares.has(par)) return 'repetida';
    pares.add(par);
    unir(no(ax, ay), no(bx, by));
  }
  if (!pai.has(-1) && lista.length > 0) return 'solta';
  for (let i = 0; i < lista.length; i += 5) if (raiz(no(lista[i], lista[i + 1])) !== raiz(-1)) return 'solta';
  return null;
}

/** Tira da lista as peças que não chegam a um ponto de apoio (a montagem faz isso ao apagar: o que fica solto cai). */
export function semSoltas(f: Fase, pecas: readonly number[]): number[] {
  const ligado = new Set<number>();
  for (let i = 0; i < f.ancoras.length; i += 2) ligado.add(chave(f.ancoras[i], f.ancoras[i + 1]));
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (let i = 0; i < pecas.length; i += 5) {
      const ka = chave(pecas[i], pecas[i + 1]);
      const kb = chave(pecas[i + 2], pecas[i + 3]);
      if (ligado.has(ka) !== ligado.has(kb)) {
        ligado.add(ka);
        ligado.add(kb);
        mudou = true;
      }
    }
  }
  const fica: number[] = [];
  for (let i = 0; i < pecas.length; i += 5) if (ligado.has(chave(pecas[i], pecas[i + 1]))) fica.push(pecas[i], pecas[i + 1], pecas[i + 2], pecas[i + 3], pecas[i + 4]);
  return fica;
}

export interface No {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  m: number;
  fixo: boolean;
  /** Onde ele está na grade (a montagem). */
  gx: number;
  gy: number;
}

export interface Barra {
  a: number;
  b: number;
  tipo: number;
  l0: number;
  /** A força no pior subpasso do último passo (+ puxando, − empurrando). */
  forca: number;
  /** |força| / limite: 0 folgada, 1 no limite (o desenho pinta de verde a vermelho). */
  esforco: number;
  inteira: boolean;
}

export const ESPERANDO = 0;
export const ANDANDO = 1;
export const CHEGOU = 2;
export const CAIU = 3;
export const PAROU = 4;

export interface Veiculo {
  tipo: IdDoVeiculo;
  x: number;
  y: number;
  vy: number;
  estado: number;
  /** A inclinação da pista embaixo (dy/dx), só para o desenho. */
  inclinacao: number;
}

export type Evento = { tipo: 'quebrou'; barra: number } | { tipo: 'chegou'; veiculo: number } | { tipo: 'caiu'; veiculo: number };

export interface Sim {
  fase: Fase;
  nos: No[];
  barras: Barra[];
  veiculos: Veiculo[];
  passo: number;
  terminou: boolean;
  passou: boolean;
  /** O quanto o tráfego andou, de 0 a 1000 (vale no fim). */
  progresso: number;
  /** O passo em que acaba depois da primeira queda (0: ninguém caiu). */
  fimEm: number;
  custo: number;
  eventos: Evento[];
}

export function montar(f: Fase, pecas: readonly number[]): Sim {
  const nos: No[] = [];
  const indice = new Map<number, number>();
  const noEm = (x: number, y: number): number => {
    const k = chave(x, y);
    const i = indice.get(k);
    if (i !== undefined) return i;
    nos.push({ x, y, vx: 0, vy: 0, fx: 0, fy: 0, m: MASSA_DA_JUNTA, fixo: ehAncora(f, x, y), gx: x, gy: y });
    indice.set(k, nos.length - 1);
    return nos.length - 1;
  };
  for (let i = 0; i < f.ancoras.length; i += 2) noEm(f.ancoras[i], f.ancoras[i + 1]);
  const barras: Barra[] = [];
  for (let i = 0; i + 4 < pecas.length; i += 5) {
    const a = noEm(pecas[i], pecas[i + 1]);
    const b = noEm(pecas[i + 2], pecas[i + 3]);
    const dx = pecas[i + 2] - pecas[i];
    const dy = pecas[i + 3] - pecas[i + 1];
    const l0 = Math.sqrt(dx * dx + dy * dy);
    const tipo = pecas[i + 4];
    const meia = (PECAS[tipo].massa * l0) / 2;
    nos[a].m += meia;
    nos[b].m += meia;
    barras.push({ a, b, tipo, l0, forca: 0, esforco: 0, inteira: true });
  }
  const veiculos: Veiculo[] = f.trafego.map((tipo) => ({ tipo, x: SAIDA, y: 0, vy: 0, estado: ESPERANDO, inclinacao: 0 }));
  return { fase: f, nos, barras, veiculos, passo: 0, terminou: false, passou: false, progresso: 0, fimEm: 0, custo: custo(pecas), eventos: [] };
}

interface Apoio {
  barra: number;
  t: number;
  y: number;
  inclinacao: number;
}

/** A pista embaixo de x, a mais perto da altura em que o veículo estava (null: nenhuma; barra −1: o chão das margens). */
function apoioEm(s: Sim, x: number, yAntes: number): Apoio | null {
  if (x <= 0 || x >= s.fase.largura) return { barra: -1, t: 0, y: 0, inclinacao: 0 };
  let melhor: Apoio | null = null;
  let distancia = 0.8;
  for (let i = 0; i < s.barras.length; i++) {
    const b = s.barras[i];
    if (!b.inteira || b.tipo !== PISTA) continue;
    let na = s.nos[b.a];
    let nb = s.nos[b.b];
    if (na.x > nb.x) {
      const c = na;
      na = nb;
      nb = c;
    }
    const dx = nb.x - na.x;
    if (dx < 0.05 || x < na.x || x > nb.x) continue;
    const t = (x - na.x) / dx;
    const y = na.y + t * (nb.y - na.y);
    const d = y > yAntes ? y - yAntes : yAntes - y;
    if (d < distancia) {
      distancia = d;
      // t medido a partir de b.a, para a carga ir ao nó certo
      melhor = { barra: i, t: na === s.nos[b.a] ? t : 1 - t, y, inclinacao: (nb.y - na.y) / dx };
    }
  }
  return melhor;
}

function andou(s: Sim, v: Veiculo): number {
  const fim = s.fase.largura + ALEM;
  const p = (v.x - SAIDA) / (fim - SAIDA);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

function fechar(s: Sim) {
  s.terminou = true;
  if (s.passou) {
    s.progresso = 1000;
    return;
  }
  let soma = 0;
  for (const v of s.veiculos) soma += andou(s, v);
  s.progresso = Math.floor((soma / s.veiculos.length) * 1000);
}

/** Um passo de 1/60 s. */
export function passo(s: Sim): void {
  s.eventos.length = 0;
  if (s.terminou) return;
  const f = s.fase;
  const fundo = f.agua ?? f.fundo;

  // 1. O TRÁFEGO anda (por passo) e escolhe onde se apoia; as cargas ficam valendo no passo inteiro.
  const cargas: number[] = []; // [barra, t, peso, ...]
  for (let i = 0; i < s.veiculos.length; i++) {
    const v = s.veiculos[i];
    const tipo = VEICULOS[v.tipo];
    if (v.estado === ESPERANDO && s.fimEm === 0 && s.passo >= ESPERA) {
      const frente = i > 0 ? s.veiculos[i - 1] : null;
      if (!frente || frente.estado === CHEGOU || frente.x - SAIDA >= DISTANCIA) v.estado = ANDANDO;
    }
    if (v.estado === ANDANDO) {
      let x = v.x + tipo.velocidade * PASSO;
      const frente = i > 0 ? s.veiculos[i - 1] : null;
      if (frente && (frente.estado === ANDANDO || frente.estado === PAROU) && x > frente.x - DISTANCIA) x = frente.x - DISTANCIA;
      if (x < v.x) x = v.x;
      v.x = x;
      if (v.x >= f.largura + ALEM) {
        v.estado = CHEGOU;
        s.eventos.push({ tipo: 'chegou', veiculo: i });
        continue;
      }
      const ap = apoioEm(s, v.x, v.y);
      if (!ap || ap.y < fundo) {
        v.estado = CAIU;
        v.vy = 0;
        s.eventos.push({ tipo: 'caiu', veiculo: i });
        if (s.fimEm === 0) {
          s.fimEm = s.passo + DEPOIS_DA_QUEDA;
          // a média do quanto andaram é contada AQUI: os de trás freiam
          let soma = 0;
          for (const o of s.veiculos) soma += andou(s, o);
          s.progresso = Math.floor((soma / s.veiculos.length) * 1000);
          for (const o of s.veiculos) if (o.estado === ANDANDO || o.estado === ESPERANDO) o.estado = PAROU;
        }
        continue;
      }
      v.y = ap.y;
      v.inclinacao = ap.inclinacao;
      if (ap.barra >= 0) cargas.push(ap.barra, ap.t, tipo.massa * GRAVIDADE);
    } else if (v.estado === PAROU) {
      // freou: continua apoiado onde está (se a pista ainda existe)
      const ap = apoioEm(s, v.x, v.y);
      if (ap && ap.y >= fundo) {
        v.y = ap.y;
        v.inclinacao = ap.inclinacao;
        if (ap.barra >= 0) cargas.push(ap.barra, ap.t, tipo.massa * GRAVIDADE);
      } else {
        v.estado = CAIU;
        v.vy = 0;
      }
    } else if (v.estado === CAIU) {
      if (v.y > f.fundo) {
        v.vy -= GRAVIDADE * PASSO;
        v.y += v.vy * PASSO;
        v.x += tipo.velocidade * 0.3 * PASSO;
        if (v.y < f.fundo) v.y = f.fundo;
      }
    }
  }

  // 2. A ESTRUTURA, em subpassos.
  const nos = s.nos;
  const barras = s.barras;
  for (const b of barras) b.forca = 0;
  const ar = 1 - AMORTECIMENTO_DO_AR * H;
  // o peso da própria ponte entra aos poucos (ela "assenta"): de uma vez, o tranco dobraria a força no primeiro instante
  const peso = s.passo < ASSENTAR ? (GRAVIDADE * (s.passo + 1)) / ASSENTAR : GRAVIDADE;
  for (let sub = 0; sub < SUBPASSOS; sub++) {
    for (const n of nos) {
      n.fx = 0;
      n.fy = -n.m * peso;
    }
    for (let c = 0; c < cargas.length; c += 3) {
      const b = barras[cargas[c]];
      const t = cargas[c + 1];
      const peso = cargas[c + 2];
      nos[b.a].fy -= peso * (1 - t);
      nos[b.b].fy -= peso * t;
    }
    for (const b of barras) {
      if (!b.inteira) continue;
      const na = nos[b.a];
      const nb = nos[b.b];
      const dx = nb.x - na.x;
      const dy = nb.y - na.y;
      const l = Math.sqrt(dx * dx + dy * dy);
      if (l < 1e-6) continue;
      const ux = dx / l;
      const uy = dy / l;
      const k = PECAS[b.tipo].rigidez;
      const vrel = (nb.vx - na.vx) * ux + (nb.vy - na.vy) * uy;
      const elastica = (k * (l - b.l0)) / b.l0;
      const forca = elastica + k * AMORTECIMENTO_AXIAL * vrel;
      // o esforço é o da mola (o amortecimento só acalma; senão a pancada de uma batida quebraria tudo)
      if ((elastica < 0 ? -elastica : elastica) > (b.forca < 0 ? -b.forca : b.forca)) b.forca = elastica;
      na.fx += forca * ux;
      na.fy += forca * uy;
      nb.fx -= forca * ux;
      nb.fy -= forca * uy;
    }
    for (const n of nos) {
      if (n.fixo || n.m <= 0) continue;
      n.vx = (n.vx + (n.fx / n.m) * H) * ar;
      n.vy = (n.vy + (n.fy / n.m) * H) * ar;
      n.x += n.vx * H;
      n.y += n.vy * H;
      // o que cai no fundo fica lá
      if (n.y < f.fundo) {
        n.y = f.fundo;
        n.vy = 0;
        n.vx = 0;
      }
    }
  }

  // 3. O que passou do limite QUEBRA.
  for (let i = 0; i < barras.length; i++) {
    const b = barras[i];
    if (!b.inteira) continue;
    const limite = PECAS[b.tipo].limite;
    const absoluto = b.forca < 0 ? -b.forca : b.forca;
    b.esforco = absoluto / limite;
    if (absoluto > limite) {
      b.inteira = false;
      s.eventos.push({ tipo: 'quebrou', barra: i });
    }
  }

  s.passo++;
  let todos = true;
  for (const v of s.veiculos) if (v.estado !== CHEGOU) todos = false;
  if (todos) {
    s.passou = true;
    fechar(s);
  } else if (s.fimEm > 0 && s.passo >= s.fimEm) {
    const progresso = s.progresso;
    fechar(s);
    s.progresso = progresso;
  } else if (s.passo >= LIMITE_DA_SIMULACAO) fechar(s);
}

export interface Resultado {
  passou: boolean;
  progresso: number;
  custo: number;
  passos: number;
}

/** A simulação inteira, do começo ao fim: o que o servidor roda com a lista que o site mandou. */
export function simular(f: Fase, pecas: readonly number[]): Resultado {
  const s = montar(f, pecas);
  while (!s.terminou) passo(s);
  return { passou: s.passou, progresso: s.progresso, custo: s.custo, passos: s.passo };
}

/** Quem ganha: quem passou, pelo menor custo; depois quem não passou, por quanto o tráfego andou. Negativo: `a` na frente. */
export function comparar(a: { passou: boolean; progresso: number; custo: number }, b: { passou: boolean; progresso: number; custo: number }): number {
  if (a.passou !== b.passou) return a.passou ? -1 : 1;
  if (a.passou) return a.custo - b.custo;
  return b.progresso - a.progresso;
}

/**
 * UMA PONTE QUE PASSA em cada fase (os testes e o piloto automático do teste de tela): a pista reta de margem a margem e uma treliça
 * por cima (os nós a cada 2 casas, a 1 ou 2 de altura), de madeira onde dá e de aço onde pesa. Não é a mais barata: é a prova de
 * que a fase tem solução.
 */
export function pontePronta(f: Fase): number[] {
  const p: number[] = [];
  const L = f.largura;
  const add = (ax: number, ay: number, bx: number, by: number, tipo: number) => p.push(ax, ay, bx, by, tipo);
  // a pista, de 2 em 2 (o vão é sempre par)
  for (let x = 0; x < L; x += 2) add(x, 0, x + 2, 0, PISTA);
  const pesada = L >= 10;
  const h = L >= 8 ? 2 : 1;
  const banzo = pesada ? ACO : MADEIRA;
  const diagonal = pesada ? ACO : MADEIRA;
  // a treliça por cima: o banzo de cima de (1, h) a (L − 1, h), e as diagonais em zigue-zague
  for (let x = 1; x < L - 1; x += 2) add(x, h, x + 2, h, banzo);
  for (let x = 0; x < L; x += 2) {
    add(x, 0, x + 1, h, diagonal);
    add(x + 1, h, x + 2, 0, diagonal);
  }
  // os apoios de baixo e de cima, quando a fase os tem
  for (let i = 0; i < f.ancoras.length; i += 2) {
    const ax = f.ancoras[i];
    const ay = f.ancoras[i + 1];
    if (ay === 0) continue;
    if (ax === 0 || ax === L) {
      const dentro = ax === 0 ? 2 : L - 2;
      const alvoY = ay < 0 ? 0 : h;
      const alvoX = ay < 0 ? dentro : ax === 0 ? 1 : L - 1;
      if (pecaCabe(ACO, ax, ay, alvoX, alvoY)) add(ax, ay, alvoX, alvoY, ACO);
    } else {
      // a pedra do meio: duas escoras até um nó de cada lado, logo abaixo da pista
      add(ax, ay, ax - 1, -1, ACO);
      add(ax, ay, ax + 1, -1, ACO);
      add(ax - 1, -1, ax + 1, -1, ACO);
      add(ax - 1, -1, ax - 1, 0, ACO);
      add(ax + 1, -1, ax + 1, 0, ACO);
      add(ax - 1, -1, ax - 3, 0, ACO);
      add(ax + 1, -1, ax + 3, 0, ACO);
    }
  }
  return p;
}
