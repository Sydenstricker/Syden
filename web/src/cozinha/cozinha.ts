import {
  AVISO_DE_QUEIMA,
  COBERTURAS,
  MAXIMO_NO_PRATO,
  PICAVEIS,
  PONTO,
  TEMPO_DE_PICAR_MS,
  chave,
  emChamas,
  estadoNoFogo,
  tempoInicialNoFogo,
  vaiAoFogo,
  type Ingrediente,
  type Item,
  type PlantaDaCozinha,
  type Sabor,
} from './receitas';

/**
 * A COZINHA DE CADA UM (05/11/2026): as regras do que se faz na cozinha, sem desenho nenhum (a cena só lê isto). O servidor
 * não conhece nada daqui: ele confere só o prato entregue (receitas.ts). Por isso a cozinha roda inteira na tela de quem
 * joga, e o mesmo código serve ao teclado, ao clique e ao piloto automático.
 *
 * A PLANTA, vista de cima (c = coluna, l = linha; a casa tem 2 unidades, como os balcões da KayKit): uma volta de 30 estações
 * em torno do chão livre (as colunas 1 a 10, as linhas 1 a 3). Atrás, o arroz, os três fogões, a janela de entrega entre dois
 * balcões, as tábuas, um balcão, o forno e o peixe; à esquerda, os caixotes do lanche; à direita, os da pizza; na frente, a
 * lixeira, o ovo, o bacon, o bife, a alface, os pratos, as casquinhas, os sorvetes, o queijo e o cogumelo.
 *
 * O FOGO ANDA PELO RELÓGIO DE VERDADE (06/11/2026): o servidor mede o ponto pelo relógio dele (receitas.ts), e por isso a
 * tela também: `relogio` é a hora (Date.now() no jogo; os testes o andam com o passo), e o que está no fogo guarda `desde`.
 * Com a janela sem foco nada é desenhado, mas o fogo continua, como no servidor. Cada vez que algo entra ou sai do fogo,
 * sai o evento 'fogo', que a tela manda ao servidor. O coelho anda só no chão livre, e por isso não há caminho a procurar: a estação mais perto do
 * que ele tem à frente é a que ele usa.
 */

export type TipoDeEstacao = 'caixote' | 'balcao' | 'tabua' | 'fogao' | 'forno' | 'pratos' | 'sorvete' | 'lixeira' | 'entrega' | 'pia' | 'extintor';

/** O extintor (19/11/2026) vai na mão como uma coisa, mas nunca fica em cima de nada: volta ao lugar dele. */
export type Coisa = { tipo: 'item'; item: Item } | { tipo: 'prato'; itens: Item[] } | { tipo: 'extintor' };

export interface Estacao {
  id: number;
  tipo: TipoDeEstacao;
  c: number;
  l: number;
  x: number;
  z: number;
  /** O caixote: o que sai dele. */
  ing?: Ingrediente;
  /** O pote de sorvete. */
  sabor?: Sabor;
  /** O que está em cima (os caixotes, os pratos, a lixeira e a janela nunca guardam nada). */
  em: Coisa | null;
  /** O tempo de fogo (fogão, forno) ou de tábua do que está em cima, em ms. */
  tempo: number;
  /** No fogo: quando (no relógio da cozinha) o tempo de fogo começou a contar. */
  desde: number;
  /** No fogo: o que ficou esquecido pegou fogo, e a estação só volta a servir depois do extintor. */
  chamas?: boolean;
  /** Na pia: os pratos sujos esperando. */
  sujos?: number;
}

export type Acao = 'espaco' | 'usar';

export interface Coelho {
  x: number;
  z: number;
  /** Para onde olha (o ângulo em torno do eixo de cima; 0 = para a frente da tela). */
  rumo: number;
  mao: Coisa | null;
  /** A tábua em que está picando (para ao sair do lugar). */
  picando: number | null;
  /** Andando sozinho até uma estação, pelo clique ou pelo piloto, para fazer `acao` ao chegar. */
  destino: { estacao: number; x: number; z: number; acao: Acao } | null;
  /** Os pontos de passagem antes do destino (a volta pela passagem da bancada do meio). */
  rota: { x: number; z: number }[];
  andando: boolean;
}

/** Um retângulo do chão em que não se anda (a bancada do meio). */
export interface Ilha {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface Cozinha {
  planta: PlantaDaCozinha;
  estacoes: Estacao[];
  coelho: Coelho;
  /** A hora da cozinha, em ms (o fogo mede por ela). */
  relogio: number;
  /** A bancada do meio, casa a casa (vazia nas plantas sem ela). */
  ilhas: Ilha[];
  /** O x do meio de cada passagem pela bancada do meio. */
  passagens: number[];
  /** Os pratos limpos na pilha. */
  pratos: number;
  /** Quando cada prato entregue volta sujo para a pia (no relógio da cozinha). */
  voltando: number[];
}

export type Evento =
  | { tipo: 'pegou' | 'largou' | 'juntou' | 'picou' | 'faca' | 'pronto' | 'queimou' | 'jogou-fora' | 'nada' | 'lavou' | 'esfrega' | 'sujo' | 'incendio' | 'apagou' }
  | { tipo: 'entregue'; itens: Item[] }
  /**
   * Algo entrou no fogo (`pos`, como entrou) ou saiu dele (`pos` null): a tela avisa o servidor. `extintor`: saiu pelo
   * extintor (estava em chamas).
   */
  | { tipo: 'fogo'; estacao: number; pos: Item | null; extintor?: boolean }
  /** Passou do ponto e está queimando (a fumaça e o chiado). */
  | { tipo: 'queimando' }
  | { tipo: 'recusado' };

export const CASA = 2;
export const COLUNAS = 12;
export const LINHAS = 5;
export const RAIO = 0.55;
export const VELOCIDADE = 6.2;
/** O chão livre (o miolo da planta). */
export const CHAO = { x0: -10, x1: 10, z0: -3, z1: 3 };

type Linha = [number, number, TipoDeEstacao, (Ingrediente | Sabor)?];

/**
 * AS PLANTAS (19/11/2026; a da toca é a de 05/11). A ordem é o id de cada estação: as de fogo estão também em FOGO_DAS_PLANTAS
 * (receitas.ts), que o servidor usa, e o teste confere. A volta (as linhas 0 e 4, as colunas 0 e 11) é igual em todas; as da
 * bancada do meio ficam na linha 2. O balcão à esquerda da janela é onde o prato se monta (o piloto conta com ele).
 */
const PLANTAS: Record<PlantaDaCozinha, Linha[]> = {
  toca: [
    [0, 0, 'caixote', 'arroz'],
    [1, 0, 'fogao'],
    [2, 0, 'fogao'],
    [3, 0, 'fogao'],
    [4, 0, 'balcao'],
    [5, 0, 'entrega'],
    [6, 0, 'extintor'],
    [7, 0, 'tabua'],
    [8, 0, 'tabua'],
    [9, 0, 'pia'],
    [10, 0, 'forno'],
    [11, 0, 'caixote', 'peixe'],
    [0, 1, 'caixote', 'pao'],
    [0, 2, 'caixote', 'carne'],
    [0, 3, 'caixote', 'salsicha'],
    [11, 1, 'caixote', 'massa'],
    [11, 2, 'caixote', 'tomate'],
    [11, 3, 'caixote', 'calabresa'],
    [0, 4, 'lixeira'],
    [1, 4, 'caixote', 'ovo'],
    [2, 4, 'caixote', 'bacon'],
    [3, 4, 'caixote', 'bife'],
    [4, 4, 'caixote', 'alface'],
    [5, 4, 'pratos'],
    [6, 4, 'caixote', 'casquinha'],
    [7, 4, 'sorvete', 'chocolate'],
    [8, 4, 'sorvete', 'morango'],
    [9, 4, 'sorvete', 'baunilha'],
    [10, 4, 'caixote', 'queijo'],
    [11, 4, 'caixote', 'cogumelo'],
  ],
  // os balcões longe: a janela num canto, o fogo do outro lado, as tábuas e os pratos no canto da frente
  longe: [
    [0, 0, 'caixote', 'arroz'],
    [1, 0, 'balcao'],
    [2, 0, 'entrega'],
    [3, 0, 'pia'],
    [4, 0, 'caixote', 'pao'],
    [5, 0, 'caixote', 'carne'],
    [6, 0, 'caixote', 'salsicha'],
    [7, 0, 'caixote', 'peixe'],
    [8, 0, 'extintor'],
    [9, 0, 'forno'],
    [10, 0, 'caixote', 'massa'],
    [11, 0, 'caixote', 'tomate'],
    [0, 1, 'lixeira'],
    [0, 2, 'caixote', 'ovo'],
    [0, 3, 'caixote', 'bacon'],
    [11, 1, 'fogao'],
    [11, 2, 'fogao'],
    [11, 3, 'fogao'],
    [0, 4, 'caixote', 'bife'],
    [1, 4, 'caixote', 'alface'],
    [2, 4, 'caixote', 'calabresa'],
    [3, 4, 'caixote', 'casquinha'],
    [4, 4, 'sorvete', 'chocolate'],
    [5, 4, 'sorvete', 'morango'],
    [6, 4, 'sorvete', 'baunilha'],
    [7, 4, 'caixote', 'queijo'],
    [8, 4, 'caixote', 'cogumelo'],
    [9, 4, 'tabua'],
    [10, 4, 'tabua'],
    [11, 4, 'pratos'],
  ],
  // a passagem estreita: a bancada do meio de ponta a ponta, com uma passagem só (a coluna 5)
  estreita: [
    [0, 0, 'caixote', 'arroz'],
    [1, 0, 'caixote', 'pao'],
    [2, 0, 'caixote', 'carne'],
    [3, 0, 'caixote', 'salsicha'],
    [4, 0, 'balcao'],
    [5, 0, 'entrega'],
    [6, 0, 'extintor'],
    [7, 0, 'pia'],
    [8, 0, 'caixote', 'peixe'],
    [9, 0, 'caixote', 'massa'],
    [10, 0, 'forno'],
    [11, 0, 'caixote', 'tomate'],
    [0, 1, 'caixote', 'calabresa'],
    [0, 2, 'balcao'],
    [0, 3, 'lixeira'],
    [11, 1, 'caixote', 'bacon'],
    [11, 2, 'balcao'],
    [11, 3, 'caixote', 'bife'],
    [0, 4, 'caixote', 'ovo'],
    [1, 4, 'caixote', 'alface'],
    [2, 4, 'caixote', 'casquinha'],
    [3, 4, 'sorvete', 'chocolate'],
    [4, 4, 'sorvete', 'morango'],
    [5, 4, 'sorvete', 'baunilha'],
    [6, 4, 'pratos'],
    [7, 4, 'caixote', 'queijo'],
    [8, 4, 'caixote', 'cogumelo'],
    [9, 4, 'balcao'],
    [10, 4, 'balcao'],
    [11, 4, 'balcao'],
    [1, 2, 'balcao'],
    [2, 2, 'tabua'],
    [3, 2, 'fogao'],
    [4, 2, 'fogao'],
    [6, 2, 'fogao'],
    [7, 2, 'tabua'],
    [8, 2, 'balcao'],
    [9, 2, 'balcao'],
    [10, 2, 'balcao'],
  ],
  // dois andares de bancada: a do meio aberta nas duas pontas, com as tábuas e o fogo
  andares: [
    [0, 0, 'caixote', 'arroz'],
    [1, 0, 'caixote', 'pao'],
    [2, 0, 'caixote', 'carne'],
    [3, 0, 'caixote', 'salsicha'],
    [4, 0, 'balcao'],
    [5, 0, 'entrega'],
    [6, 0, 'pia'],
    [7, 0, 'extintor'],
    [8, 0, 'caixote', 'peixe'],
    [9, 0, 'caixote', 'massa'],
    [10, 0, 'forno'],
    [11, 0, 'caixote', 'tomate'],
    [0, 1, 'caixote', 'calabresa'],
    [0, 2, 'lixeira'],
    [0, 3, 'caixote', 'ovo'],
    [11, 1, 'caixote', 'bacon'],
    [11, 2, 'caixote', 'bife'],
    [11, 3, 'caixote', 'alface'],
    [0, 4, 'caixote', 'casquinha'],
    [1, 4, 'sorvete', 'chocolate'],
    [2, 4, 'sorvete', 'morango'],
    [3, 4, 'sorvete', 'baunilha'],
    [4, 4, 'caixote', 'queijo'],
    [5, 4, 'caixote', 'cogumelo'],
    [6, 4, 'pratos'],
    [7, 4, 'balcao'],
    [8, 4, 'balcao'],
    [9, 4, 'balcao'],
    [10, 4, 'balcao'],
    [11, 4, 'balcao'],
    [2, 2, 'tabua'],
    [3, 2, 'tabua'],
    [4, 2, 'balcao'],
    [5, 2, 'balcao'],
    [6, 2, 'fogao'],
    [7, 2, 'fogao'],
    [8, 2, 'fogao'],
    [9, 2, 'balcao'],
  ],
};

/** Os pratos limpos no começo: os outros voltam sujos da janela e passam pela pia. */
export const PRATOS_INICIAIS = 4;
/** O prato entregue volta sujo para a pia depois disto. */
export const VOLTA_DO_PRATO_MS = 7000;
/** Lavar um prato. */
export const TEMPO_DE_LAVAR_MS = 1400;

export const centroDaCasa = (c: number, l: number) => ({ x: (c - (COLUNAS - 1) / 2) * CASA, z: (l - (LINHAS - 1) / 2) * CASA });

/** A estação está na bancada do meio (fora da volta). */
export const naIlha = (e: { c: number; l: number }) => e.l > 0 && e.l < LINHAS - 1 && e.c > 0 && e.c < COLUNAS - 1;

export function novaCozinha(planta: PlantaDaCozinha = 'toca'): Cozinha {
  const estacoes = PLANTAS[planta].map(([c, l, tipo, extra], id): Estacao => {
    const { x, z } = centroDaCasa(c, l);
    const e: Estacao = { id, tipo, c, l, x, z, em: null, tempo: 0, desde: 0 };
    if (tipo === 'caixote') e.ing = extra as Ingrediente;
    if (tipo === 'sorvete') e.sabor = extra as Sabor;
    if (tipo === 'pia') e.sujos = 0;
    return e;
  });
  const ilhas = estacoes.filter(naIlha).map((e) => ({ x0: e.x - CASA / 2, x1: e.x + CASA / 2, z0: e.z - CASA / 2, z1: e.z + CASA / 2 }));
  const passagens: number[] = [];
  if (ilhas.length)
    for (let c = 1; c < COLUNAS - 1; c++) if (!estacoes.some((e) => naIlha(e) && e.c === c)) passagens.push(centroDaCasa(c, 2).x);
  return {
    planta,
    estacoes,
    ilhas,
    passagens,
    pratos: PRATOS_INICIAIS,
    voltando: [],
    relogio: 0,
    coelho: { x: 0, z: ilhas.length ? 2 : 0.5, rumo: Math.PI, mao: null, picando: null, destino: null, rota: [], andando: false },
  };
}

/** Empurra o coelho para fora da bancada do meio (o círculo dele contra cada casa). */
function sairDasIlhas(k: Cozinha) {
  const c = k.coelho;
  for (const i of k.ilhas) {
    const px = limitar(c.x, i.x0, i.x1);
    const pz = limitar(c.z, i.z0, i.z1);
    const dx = c.x - px;
    const dz = c.z - pz;
    const d = Math.hypot(dx, dz);
    if (d >= RAIO) continue;
    if (d > 1e-6) {
      c.x = px + (dx / d) * RAIO;
      c.z = pz + (dz / d) * RAIO;
    } else {
      // o meio dele dentro da casa: sai pelo lado de cima ou de baixo, o mais perto
      c.z = c.z < (i.z0 + i.z1) / 2 ? i.z0 - RAIO : i.z1 + RAIO;
    }
  }
}

/** O lado da bancada do meio em que um ponto está (−1 em cima, 1 embaixo, 0 na altura dela). */
const ladoDe = (z: number) => (z < -CASA / 2 ? -1 : z > CASA / 2 ? 1 : 0);

const limitar = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A estação que o coelho tem à frente (a mais perto do ponto das mãos), ou null. */
export function alvo(k: Cozinha): Estacao | null {
  const { coelho } = k;
  const hx = coelho.x + Math.sin(coelho.rumo) * 1.25;
  const hz = coelho.z + Math.cos(coelho.rumo) * 1.25;
  let melhor: Estacao | null = null;
  let d = 1.75;
  for (const e of k.estacoes) {
    const de = Math.hypot(e.x - hx, e.z - hz);
    if (de < d) {
      d = de;
      melhor = e;
    }
  }
  return melhor;
}

/**
 * Onde o coelho fica para usar a estação: o ponto do chão livre mais perto dela. A da bancada do meio se usa dos dois lados:
 * do lado em que o coelho está (`k`, quando há bancada).
 */
export function lugarDe(e: Estacao, k?: Cozinha) {
  const m = RAIO + 0.05;
  const p = { x: limitar(e.x, CHAO.x0 + m, CHAO.x1 - m), z: limitar(e.z, CHAO.z0 + m, CHAO.z1 - m) };
  if (k?.ilhas.some((i) => p.x > i.x0 - m && p.x < i.x1 + m && p.z > i.z0 - m && p.z < i.z1 + m)) {
    const lado = ladoDe(k.coelho.z) || (k.coelho.z < 0 ? -1 : 1);
    p.z = lado * (CASA / 2 + m);
  }
  return p;
}

/**
 * Manda o coelho andar até a estação e fazer `acao` ao chegar (o clique e o piloto). Com a bancada do meio entre ele e o
 * lugar, a rota passa pela passagem mais curta.
 */
export function irPara(k: Cozinha, estacao: number, acao: Acao) {
  const e = k.estacoes[estacao];
  if (!e) return;
  const c = k.coelho;
  const lugar = lugarDe(e, k);
  c.rota = [];
  if (k.passagens.length) {
    const de = ladoDe(c.z);
    const para = ladoDe(lugar.z);
    if (de !== para || de === 0) {
      let g = k.passagens[0];
      for (const x of k.passagens) if (Math.abs(c.x - x) + Math.abs(x - lugar.x) < Math.abs(c.x - g) + Math.abs(g - lugar.x)) g = x;
      const meio = CASA / 2 + 1;
      // dentro da passagem, ele sai pela própria coluna
      if (de === 0) g = c.x;
      if (de !== 0) c.rota.push({ x: g, z: de * meio });
      if (para !== 0) c.rota.push({ x: g, z: para * meio });
    }
  }
  c.destino = { estacao, ...lugar, acao };
  c.picando = null;
}

const item = (ing: Ingrediente): Coisa => ({ tipo: 'item', item: { ing, estado: 'cru' } });

/** Cabe no prato? Até 5 itens, sem dois do mesmo ingrediente, e nada de prato dentro de prato. */
export function cabeNoPrato(itens: Item[], i: Item): boolean {
  return itens.length < MAXIMO_NO_PRATO && !itens.some((o) => o.ing === i.ing);
}

/** A cobertura vai na massa aberta (ainda crua), já picada, uma de cada. */
function cabeNaMassa(massa: Item, i: Item): boolean {
  return massa.ing === 'massa' && massa.estado === 'picado' && COBERTURAS.includes(i.ing) && i.estado === 'picado' && !(massa.com ?? []).includes(i.ing);
}

/** O que a estação aceita em cima. */
function aceita(e: Estacao, c: Coisa): boolean {
  if (c.tipo === 'extintor') return false;
  if (e.tipo === 'balcao' || e.tipo === 'tabua') return true;
  if (e.tipo === 'fogao' || e.tipo === 'forno') return c.tipo === 'item' && vaiAoFogo(e.tipo, c.item);
  return false;
}

const ehFogo = (e: Estacao) => e.tipo === 'fogao' || e.tipo === 'forno';

/** O fogo da estação na hora da cozinha: o tempo e o estado do que está nele (o mesmo cálculo do servidor, sem a folga). */
function atualizarFogo(k: Cozinha, e: Estacao): Evento[] {
  if (!ehFogo(e) || e.em?.tipo !== 'item') return [];
  const i = e.em.item;
  const p = PONTO[i.ing];
  if (!p) return [];
  const antes = i.estado;
  const tempoAntes = e.tempo;
  e.tempo = Math.max(0, k.relogio - e.desde);
  i.estado = estadoNoFogo(i, e.tempo);
  const ev: Evento[] = [];
  if (antes !== 'cozido' && antes !== 'queimado' && i.estado !== antes) ev.push({ tipo: 'pronto' });
  const aviso = p.queima - (p.queima - p.pronto) * AVISO_DE_QUEIMA;
  if (tempoAntes < aviso && e.tempo >= aviso && i.estado === 'cozido') ev.push({ tipo: 'queimando' });
  if (antes !== 'queimado' && i.estado === 'queimado') ev.push({ tipo: 'queimou' });
  if (!e.chamas && emChamas(i, e.tempo)) {
    e.chamas = true;
    ev.push({ tipo: 'incendio' });
  }
  return ev;
}

/** O extintor na mão, diante do fogo em chamas: apaga, e o que estava lá se perde. */
function apagar(k: Cozinha, e: Estacao): Evento[] {
  e.em = null;
  e.tempo = 0;
  e.chamas = false;
  k.coelho.mao = { tipo: 'extintor' };
  return [{ tipo: 'apagou' }, { tipo: 'fogo', estacao: e.id, pos: null, extintor: true }];
}

/** A pia: começa a lavar (como a tábua, só com o coelho lá), se houver prato sujo e a mão estiver vazia. */
function lavar(k: Cozinha, e: Estacao): Evento[] {
  if (k.coelho.mao || !e.sujos) return [{ tipo: 'nada' }];
  k.coelho.picando = e.id;
  return [{ tipo: 'esfrega' }];
}

/** O que sai da estação (a mão pegou, ou o prato levou): do fogo, com o estado da hora, e o aviso ao servidor. */
function tirar(k: Cozinha, e: Estacao, ev: Evento[]): Coisa {
  if (ehFogo(e) && e.em?.tipo === 'item') {
    atualizarFogo(k, e);
    ev.push({ tipo: 'fogo', estacao: e.id, pos: null });
  }
  const c = e.em!;
  e.em = null;
  e.tempo = 0;
  return c;
}

/**
 * ESPAÇO: pegar, largar, juntar. Com a mão vazia, pega (no caixote sai um ingrediente novo; nos pratos, um prato). Com algo
 * na mão, larga onde cabe, ou junta: o item no prato, o prato no item, a cobertura na massa. Na janela, entrega o prato:
 * `aceitaEntrega` diz se ele é um dos pedidos (quem decide é a tela, que conhece a fila).
 */
export function espaco(k: Cozinha, aceitaEntrega: (itens: Item[]) => boolean): Evento[] {
  const e = alvo(k);
  const c = k.coelho;
  if (!e) return [{ tipo: 'nada' }];
  c.picando = null;
  const mao = c.mao;
  // o extintor: só sai do lugar dele e só apaga; em qualquer outra estação, nada
  if (e.tipo === 'extintor') {
    if (!mao) {
      c.mao = { tipo: 'extintor' };
      return [{ tipo: 'pegou' }];
    }
    if (mao.tipo === 'extintor') {
      c.mao = null;
      return [{ tipo: 'largou' }];
    }
    return [{ tipo: 'nada' }];
  }
  if (mao?.tipo === 'extintor') return e.chamas ? apagar(k, e) : [{ tipo: 'nada' }];
  // o fogo em chamas não se mexe sem o extintor
  if (e.chamas) return [{ tipo: 'nada' }];
  if (e.tipo === 'pia') return lavar(k, e);
  switch (e.tipo) {
    case 'caixote': {
      if (!mao) {
        c.mao = item(e.ing!);
        return [{ tipo: 'pegou' }];
      }
      const novo: Item = { ing: e.ing!, estado: 'cru' };
      if (mao.tipo === 'prato' && cabeNoPrato(mao.itens, novo)) {
        mao.itens.push(novo);
        return [{ tipo: 'juntou' }];
      }
      return [{ tipo: 'nada' }];
    }
    case 'pratos':
      // só há prato enquanto houver limpo na pilha (os outros estão na pia, ou voltando da janela)
      if (!mao) {
        if (k.pratos <= 0) return [{ tipo: 'nada' }];
        k.pratos--;
        c.mao = { tipo: 'prato', itens: [] };
        return [{ tipo: 'pegou' }];
      }
      if (mao.tipo === 'item') {
        if (k.pratos <= 0) return [{ tipo: 'nada' }];
        k.pratos--;
        c.mao = { tipo: 'prato', itens: [mao.item] };
        return [{ tipo: 'juntou' }];
      }
      if (mao.itens.length === 0) {
        k.pratos++;
        c.mao = null;
        return [{ tipo: 'largou' }];
      }
      return [{ tipo: 'nada' }];
    case 'lixeira':
      if (!mao) return [{ tipo: 'nada' }];
      if (mao.tipo === 'item') c.mao = null;
      else mao.itens = [];
      return [{ tipo: 'jogou-fora' }];
    case 'entrega':
      if (mao?.tipo !== 'prato' || mao.itens.length === 0) return [{ tipo: 'nada' }];
      if (!aceitaEntrega(mao.itens)) return [{ tipo: 'recusado' }];
      c.mao = null;
      // o prato volta sujo para a pia daqui a pouco
      k.voltando.push(k.relogio + VOLTA_DO_PRATO_MS);
      return [{ tipo: 'entregue', itens: mao.itens }];
    case 'sorvete':
      return servirSorvete(k, e);
  }
  // balcão, tábua, fogão, forno
  if (!mao) {
    if (!e.em) return [{ tipo: 'nada' }];
    const ev: Evento[] = [{ tipo: 'pegou' }];
    c.mao = tirar(k, e, ev);
    return ev;
  }
  if (!e.em) {
    if (!aceita(e, mao)) return [{ tipo: 'nada' }];
    e.em = mao;
    c.mao = null;
    e.tempo = 0;
    if (ehFogo(e)) {
      const i = (mao as { item: Item }).item;
      e.tempo = tempoInicialNoFogo(i);
      e.desde = k.relogio - e.tempo;
      return [{ tipo: 'largou' }, { tipo: 'fogo', estacao: e.id, pos: { ...i, com: i.com ? [...i.com] : undefined } }];
    }
    return [{ tipo: 'largou' }];
  }
  const la = e.em;
  if (mao.tipo === 'prato' && la.tipo === 'item' && cabeNoPrato(mao.itens, la.item)) {
    // o prato leva do fogo com o estado da hora (o mesmo ingrediente, cozido ou queimado: cabe igual)
    const ev: Evento[] = [{ tipo: 'juntou' }];
    const levado = tirar(k, e, ev) as { tipo: 'item'; item: Item };
    mao.itens.push(levado.item);
    return ev;
  }
  if (mao.tipo === 'item' && la.tipo === 'prato' && cabeNoPrato(la.itens, mao.item)) {
    la.itens.push(mao.item);
    c.mao = null;
    return [{ tipo: 'juntou' }];
  }
  if (mao.tipo === 'item' && la.tipo === 'item') {
    if (cabeNaMassa(la.item, mao.item) && e.tipo !== 'forno') {
      la.item.com = [...(la.item.com ?? []), mao.item.ing];
      c.mao = null;
      return [{ tipo: 'juntou' }];
    }
    if (cabeNaMassa(mao.item, la.item) && !ehFogo(e)) {
      mao.item.com = [...(mao.item.com ?? []), la.item.ing];
      e.em = null;
      e.tempo = 0;
      return [{ tipo: 'juntou' }];
    }
  }
  return [{ tipo: 'nada' }];
}

function servirSorvete(k: Cozinha, e: Estacao): Evento[] {
  const mao = k.coelho.mao;
  const casquinha = mao?.tipo === 'item' ? mao.item : mao?.tipo === 'prato' ? mao.itens.find((i) => i.ing === 'casquinha') : undefined;
  if (!casquinha || casquinha.ing !== 'casquinha' || casquinha.com?.length) return [{ tipo: 'nada' }];
  casquinha.com = [e.sabor!];
  return [{ tipo: 'juntou' }];
}

/** E: usar a estação. Na tábua, começa (ou continua) a picar; no pote de sorvete, serve a casquinha. O resto é o Espaço. */
export function usar(k: Cozinha, aceitaEntrega: (itens: Item[]) => boolean): Evento[] {
  const e = alvo(k);
  if (!e) return [{ tipo: 'nada' }];
  if (e.tipo === 'tabua' && e.em?.tipo === 'item' && e.em.item.estado === 'cru' && PICAVEIS.includes(e.em.item.ing)) {
    k.coelho.picando = e.id;
    return [{ tipo: 'faca' }];
  }
  if (e.tipo === 'sorvete') return servirSorvete(k, e);
  return espaco(k, aceitaEntrega);
}

/** Para onde as setas apontam (x, z), ou null. */
export type Direcao = { x: number; z: number } | null;

/**
 * UM PASSO DA COZINHA: o coelho anda (pelas setas ou até o destino do clique), a tábua pica enquanto ele fica lá, e o fogo
 * cozinha o que está no fogão e no forno — no ponto, e depois queimando. Devolve o que aconteceu (para os sons).
 */
export function passo(k: Cozinha, dir: Direcao, dt: number, aceitaEntrega: (itens: Item[]) => boolean, agora?: number): Evento[] {
  const eventos: Evento[] = [];
  // o relógio: a hora de verdade, quando a tela a dá; nos testes, o passo
  k.relogio = agora ?? k.relogio + dt * 1000;
  const c = k.coelho;
  const ms = dt * 1000;
  c.andando = false;
  if (dir && (dir.x || dir.z)) {
    const n = Math.hypot(dir.x, dir.z);
    c.destino = null;
    c.rota = [];
    c.picando = null;
    c.x += (dir.x / n) * VELOCIDADE * dt;
    c.z += (dir.z / n) * VELOCIDADE * dt;
    c.rumo = Math.atan2(dir.x, dir.z);
    c.andando = true;
  } else if (c.destino) {
    const d = c.destino;
    // a rota pela passagem: um ponto de cada vez, e o destino no fim
    const ponto = c.rota[0] ?? d;
    const dx = ponto.x - c.x;
    const dz = ponto.z - c.z;
    const dist = Math.hypot(dx, dz);
    const anda = VELOCIDADE * dt;
    if (dist > anda || c.rota.length) {
      if (dist <= anda) c.rota.shift();
      const passo = Math.min(anda, dist);
      if (dist > 1e-9) {
        c.x += (dx / dist) * passo;
        c.z += (dz / dist) * passo;
        c.rumo = Math.atan2(dx, dz);
      }
      c.andando = true;
    } else {
      c.x = d.x;
      c.z = d.z;
      const e = k.estacoes[d.estacao];
      c.rumo = Math.atan2(e.x - c.x, e.z - c.z);
      c.destino = null;
      eventos.push(...(d.acao === 'usar' ? usar(k, aceitaEntrega) : espaco(k, aceitaEntrega)));
    }
  }
  c.x = limitar(c.x, CHAO.x0 + RAIO, CHAO.x1 - RAIO);
  c.z = limitar(c.z, CHAO.z0 + RAIO, CHAO.z1 - RAIO);
  if (k.ilhas.length) sairDasIlhas(k);

  // os pratos entregues voltam sujos para a pia
  if (k.voltando.length && k.voltando[0] <= k.relogio) {
    const pia = k.estacoes.find((e) => e.tipo === 'pia');
    while (k.voltando.length && k.voltando[0] <= k.relogio) {
      k.voltando.shift();
      if (pia) pia.sujos = (pia.sujos ?? 0) + 1;
      else k.pratos++;
      eventos.push({ tipo: 'sujo' });
    }
  }

  // a pia: lava enquanto o coelho continua lá, de mão vazia
  if (c.picando !== null && k.estacoes[c.picando].tipo === 'pia') {
    const e = k.estacoes[c.picando];
    if (alvo(k) !== e || c.mao || !e.sujos) c.picando = null;
    else {
      const antes = Math.floor(e.tempo / 350);
      e.tempo += ms;
      if (Math.floor(e.tempo / 350) > antes) eventos.push({ tipo: 'esfrega' });
      if (e.tempo >= TEMPO_DE_LAVAR_MS) {
        e.sujos--;
        k.pratos++;
        e.tempo = 0;
        c.picando = null;
        eventos.push({ tipo: 'lavou' });
      }
    }
  }
  // a tábua: pica enquanto o coelho continua olhando para ela
  else if (c.picando !== null) {
    const e = k.estacoes[c.picando];
    if (alvo(k) !== e || e.em?.tipo !== 'item' || e.em.item.estado !== 'cru') c.picando = null;
    else {
      const antes = Math.floor(e.tempo / 400);
      e.tempo += ms;
      if (Math.floor(e.tempo / 400) > antes) eventos.push({ tipo: 'faca' });
      if (e.tempo >= TEMPO_DE_PICAR_MS) {
        e.em.item.estado = 'picado';
        e.tempo = 0;
        c.picando = null;
        eventos.push({ tipo: 'picou' });
      }
    }
  }

  // o fogo, pelo relógio
  for (const e of k.estacoes) eventos.push(...atualizarFogo(k, e));
  return eventos;
}

/**
 * O que a barrinha em cima da estação mostra. Na tábua, quanto falta para picar (`f`, de 0 a 1). No fogo, o MEDIDOR DO PONTO:
 * `f` é o tempo de fogo sobre o tempo de queimar, `pronto` e `aviso` são onde começam o ponto e o "queimando" na mesma
 * régua, e `fase` diz em qual o item está.
 */
export type Progresso =
  | { tipo: 'tabua'; f: number }
  | { tipo: 'fogo'; f: number; pronto: number; aviso: number; fase: 'cru' | 'ponto' | 'queimando' | 'queimado' };
export function progresso(e: Estacao): Progresso | null {
  if (e.tipo === 'pia') return e.tempo > 0 && e.sujos ? { tipo: 'tabua', f: e.tempo / TEMPO_DE_LAVAR_MS } : null;
  if (e.em?.tipo !== 'item') return null;
  const i = e.em.item;
  if (e.tipo === 'tabua') return e.tempo > 0 && i.estado === 'cru' ? { tipo: 'tabua', f: e.tempo / TEMPO_DE_PICAR_MS } : null;
  if (ehFogo(e)) {
    const p = PONTO[i.ing];
    if (!p) return null;
    const aviso = p.queima - (p.queima - p.pronto) * AVISO_DE_QUEIMA;
    const fase = i.estado === 'queimado' ? 'queimado' : e.tempo < p.pronto ? 'cru' : e.tempo < aviso ? 'ponto' : 'queimando';
    return { tipo: 'fogo', f: Math.min(1, e.tempo / p.queima), pronto: p.pronto / p.queima, aviso: aviso / p.queima, fase };
  }
  return null;
}

/** A assinatura do que está em cima de algo (a cena só refaz o desenho quando ela muda). */
export const assinatura = (c: Coisa | null) =>
  c === null ? '' : c.tipo === 'item' ? chave(c.item) : c.tipo === 'extintor' ? 'extintor' : `prato(${c.itens.map(chave).join('|')})`;
