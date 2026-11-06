import {
  AVISO_DE_QUEIMA,
  COBERTURAS,
  MAXIMO_NO_PRATO,
  PICAVEIS,
  PONTO,
  TEMPO_DE_PICAR_MS,
  chave,
  estadoNoFogo,
  tempoInicialNoFogo,
  vaiAoFogo,
  type Ingrediente,
  type Item,
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

export type TipoDeEstacao = 'caixote' | 'balcao' | 'tabua' | 'fogao' | 'forno' | 'pratos' | 'sorvete' | 'lixeira' | 'entrega';

export type Coisa = { tipo: 'item'; item: Item } | { tipo: 'prato'; itens: Item[] };

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
  andando: boolean;
}

export interface Cozinha {
  estacoes: Estacao[];
  coelho: Coelho;
  /** A hora da cozinha, em ms (o fogo mede por ela). */
  relogio: number;
}

export type Evento =
  | { tipo: 'pegou' | 'largou' | 'juntou' | 'picou' | 'faca' | 'pronto' | 'queimou' | 'jogou-fora' | 'nada' }
  | { tipo: 'entregue'; itens: Item[] }
  /** Algo entrou no fogo (`pos`, como entrou) ou saiu dele (`pos` null): a tela avisa o servidor. */
  | { tipo: 'fogo'; estacao: number; pos: Item | null }
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

/** A ordem é o id de cada estação: as de fogo estão também em ESTACOES_DE_FOGO (receitas.ts), que o servidor usa. */
const PLANTA: [number, number, TipoDeEstacao, (Ingrediente | Sabor)?][] = [
  [0, 0, 'caixote', 'arroz'],
  [1, 0, 'fogao'],
  [2, 0, 'fogao'],
  [3, 0, 'fogao'],
  [4, 0, 'balcao'],
  [5, 0, 'entrega'],
  [6, 0, 'balcao'],
  [7, 0, 'tabua'],
  [8, 0, 'tabua'],
  [9, 0, 'balcao'],
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
];

export const centroDaCasa = (c: number, l: number) => ({ x: (c - (COLUNAS - 1) / 2) * CASA, z: (l - (LINHAS - 1) / 2) * CASA });

export function novaCozinha(): Cozinha {
  const estacoes = PLANTA.map(([c, l, tipo, extra], id): Estacao => {
    const { x, z } = centroDaCasa(c, l);
    const e: Estacao = { id, tipo, c, l, x, z, em: null, tempo: 0, desde: 0 };
    if (tipo === 'caixote') e.ing = extra as Ingrediente;
    if (tipo === 'sorvete') e.sabor = extra as Sabor;
    return e;
  });
  return { estacoes, relogio: 0, coelho: { x: 0, z: 0.5, rumo: Math.PI, mao: null, picando: null, destino: null, andando: false } };
}

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

/** Onde o coelho fica para usar a estação: o ponto do chão livre mais perto dela. */
export function lugarDe(e: Estacao) {
  const m = RAIO + 0.05;
  return { x: limitar(e.x, CHAO.x0 + m, CHAO.x1 - m), z: limitar(e.z, CHAO.z0 + m, CHAO.z1 - m) };
}

/** Manda o coelho andar até a estação e fazer `acao` ao chegar (o clique e o piloto). */
export function irPara(k: Cozinha, estacao: number, acao: Acao) {
  const e = k.estacoes[estacao];
  if (!e) return;
  k.coelho.destino = { estacao, ...lugarDe(e), acao };
  k.coelho.picando = null;
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
  return ev;
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
      if (!mao) {
        c.mao = { tipo: 'prato', itens: [] };
        return [{ tipo: 'pegou' }];
      }
      if (mao.tipo === 'item') {
        c.mao = { tipo: 'prato', itens: [mao.item] };
        return [{ tipo: 'juntou' }];
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
    c.picando = null;
    c.x += (dir.x / n) * VELOCIDADE * dt;
    c.z += (dir.z / n) * VELOCIDADE * dt;
    c.rumo = Math.atan2(dir.x, dir.z);
    c.andando = true;
  } else if (c.destino) {
    const d = c.destino;
    const dx = d.x - c.x;
    const dz = d.z - c.z;
    const dist = Math.hypot(dx, dz);
    const anda = VELOCIDADE * dt;
    if (dist > anda) {
      c.x += (dx / dist) * anda;
      c.z += (dz / dist) * anda;
      c.rumo = Math.atan2(dx, dz);
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

  // a tábua: pica enquanto o coelho continua olhando para ela
  if (c.picando !== null) {
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
export const assinatura = (c: Coisa | null) => (c === null ? '' : c.tipo === 'item' ? chave(c.item) : `prato(${c.itens.map(chave).join('|')})`);
