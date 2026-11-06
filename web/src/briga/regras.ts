/**
 * AS REGRAS DA BRIGA NA HORTA NO SITE (03/11/2026): as medidas (as mesmas do servidor, server/src/minijogo-briga.ts; o
 * teste web/test/briga.test.ts confere), o coelho de quem joga — que anda AQUI, sem esperar o servidor —, a caixa de cada
 * golpe, a interpolação dos quadros que o servidor manda e o piloto automático do teste de tela.
 *
 * O mundo: x ao longo da fase (px da tela de 320), y a faixa do chão do fundo (0) para a frente (PROF), z a altura do pulo.
 */

export const ARENA_L = 320;
export const PROF = 56;
export const ONDAS_X = [0, 360, 720, 1080, 1440];
export const VEL_X = 72;
export const VEL_Y = 44;
export const VIDA = 100;
export const CUSTO_ESPECIAL = 8;
export const PASSO_MS = 50;

export type Golpe = 'soco1' | 'soco2' | 'soco3' | 'voadora' | 'especial';
export const GOLPES: Record<Golpe, { dura: number; alcance: [number, number]; fundo: number; dano: number; derruba: boolean }> = {
  soco1: { dura: 260, alcance: [6, 30], fundo: 9, dano: 4, derruba: false },
  soco2: { dura: 280, alcance: [6, 32], fundo: 9, dano: 5, derruba: false },
  soco3: { dura: 420, alcance: [4, 34], fundo: 10, dano: 9, derruba: true },
  voadora: { dura: 900, alcance: [0, 30], fundo: 11, dano: 9, derruba: true },
  especial: { dura: 520, alcance: [-38, 38], fundo: 14, dano: 10, derruba: true },
};
/** Em que parte do golpe ele pega (fração da duração). A voadora pega do começo até o pé tocar o chão. */
export const ATIVO: Record<Golpe, [number, number]> = {
  soco1: [0.27, 0.62],
  soco2: [0.25, 0.6],
  soco3: [0.3, 0.6],
  voadora: [0.06, 1],
  especial: [0.15, 0.78],
};
export const CORPO = { raposa: 10, corvo: 9, texugo: 18 } as const;
export type TipoDeInimigo = keyof typeof CORPO;
export const TIPOS: TipoDeInimigo[] = ['raposa', 'corvo', 'texugo'];
export const ESTADOS = [
  'entrando', 'andando', 'esperando', 'preparando', 'atacando', 'recuperando', 'dor', 'caido', 'levantando', 'morto',
  'rondando', 'mirando', 'mergulhando', 'subindo', 'prep-investida', 'investida', 'cansado', 'prep-pancada', 'pancada',
] as const;
export type EstadoDoInimigo = (typeof ESTADOS)[number];
export const ACOES = ['parado', 'andando', 'soco1', 'soco2', 'soco3', 'pulo', 'voadora', 'dor', 'caido', 'levantando', 'especial'] as const;
export type Acao = (typeof ACOES)[number];

const PULO_VZ = 215;
const GRAVIDADE = 720;
const DOR_MS = 320;
const CAIDO_MS = 900;
const LEVANTANDO_MS = 450;
/** Depois de levantar, piscando: o servidor dá a mesma folga (invulAte). */
const PISCANDO_MS = 800;
/** Depois de um golpe que não derruba, piscando: a folga que o servidor dá (invulAte, 400 ms). */
export const PISCA_DO_GOLPE_MS = 400;
/** Depois de um soco, quanto tempo o próximo aperto ainda continua o combo. */
const JANELA_DO_COMBO_MS = 300;

export interface Comandos {
  esquerda: boolean;
  direita: boolean;
  cima: boolean;
  baixo: boolean;
  /** Apertos desde o último passo (o laço zera depois de ler). */
  soco: boolean;
  pulo: boolean;
  especial: boolean;
}

export const comandosVazios = (): Comandos => ({ esquerda: false, direita: false, cima: false, baixo: false, soco: false, pulo: false, especial: false });

export interface Coelho {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  lado: 1 | -1;
  acao: Acao;
  /** Há quanto tempo (ms) a ação começou. */
  t: number;
  /** O número do golpe atual (o servidor conta: um a mais a cada golpe começado). */
  ataque: number;
  /** O golpe que está valendo, ou null. */
  golpe: Golpe | null;
  /** Os inimigos que o golpe atual já acertou (cada um, uma vez). */
  acertados: Set<number>;
  /** O último soco do combo, e quando acabou (ms desde o começo da corrida). */
  ultimoSoco: { golpe: Golpe; fim: number } | null;
  /** O soco apertado durante o soco anterior: sai assim que ele acabar. */
  socoNaFila: boolean;
  voadoraNestePulo: boolean;
  piscandoAte: number;
  ultimoEspecial: number;
  /** O relógio do coelho (ms). */
  relogio: number;
  hp: number;
}

export const novoCoelho = (x: number, y: number): Coelho => ({
  x,
  y,
  z: 0,
  vx: 0,
  vz: 0,
  lado: 1,
  acao: 'parado',
  t: 0,
  ataque: 0,
  golpe: null,
  acertados: new Set(),
  ultimoSoco: null,
  socoNaFila: false,
  voadoraNestePulo: false,
  piscandoAte: 0,
  ultimoEspecial: -Infinity,
  relogio: 0,
  hp: VIDA,
});

/** O que um passo do coelho fez de novo: um golpe que começou (vai ao servidor na hora). */
export interface Novidade {
  comecou?: { id: number; golpe: Golpe };
}

const comecar = (c: Coelho, acao: Acao) => {
  c.acao = acao;
  c.t = 0;
};

function comecarGolpe(c: Coelho, golpe: Golpe): Novidade {
  c.ataque++;
  c.golpe = golpe;
  c.acertados = new Set();
  if (golpe !== 'voadora') comecar(c, golpe);
  return { comecou: { id: c.ataque, golpe } };
}

/**
 * A conta dos golpes continua de onde o servidor está (revisão independente, 03/11/2026): ele só aceita golpe com número
 * maior que o último aceito, e a página recarregada (ou o painel montado de novo) recomeçava do 1 — nenhum golpe valia até
 * passar da conta de antes. O quadro leva o último aceito de cada um; a conta daqui nunca anda para trás.
 */
export function contarDesde(c: Coelho, ultimoNoServidor: number) {
  if (Number.isInteger(ultimoNoServidor) && ultimoNoServidor > c.ataque) c.ataque = ultimoNoServidor;
}

/** O próximo soco do combo (o servidor confere a mesma ordem e o mesmo ritmo). */
function proximoSoco(c: Coelho): Golpe {
  const u = c.ultimoSoco;
  if (!u || c.relogio - u.fim > JANELA_DO_COMBO_MS || u.golpe === 'soco3') return 'soco1';
  return u.golpe === 'soco1' ? 'soco2' : 'soco3';
}

/**
 * UM PASSO DO COELHO (dt em segundos). `arena` limita o x. Os apertos de `cmd` são consumidos aqui. Devolve o golpe que
 * começou, para o laço mandá-lo na hora (o servidor só aceita acerto de golpe que já sabe que começou).
 */
export function passoDoCoelho(c: Coelho, cmd: Comandos, dt: number, arena: [number, number]): Novidade {
  const ms = dt * 1000;
  c.relogio += ms;
  c.t += ms;
  let novo: Novidade = {};
  const soco = cmd.soco, pulo = cmd.pulo, especial = cmd.especial;
  cmd.soco = cmd.pulo = cmd.especial = false;
  const mx = (cmd.direita ? 1 : 0) - (cmd.esquerda ? 1 : 0);
  const my = (cmd.baixo ? 1 : 0) - (cmd.cima ? 1 : 0);

  switch (c.acao) {
    case 'dor':
      c.x += c.vx * dt;
      c.vx *= Math.pow(0.02, dt);
      if (c.t >= DOR_MS) comecar(c, 'parado');
      break;
    case 'caido':
      c.x += c.vx * dt;
      c.vx *= Math.pow(0.01, dt);
      if (c.z > 0 || c.vz > 0) {
        c.vz -= GRAVIDADE * dt;
        c.z = Math.max(0, c.z + c.vz * dt);
      }
      if (c.t >= CAIDO_MS && c.hp > 0) comecar(c, 'levantando');
      break;
    case 'levantando':
      if (c.t >= LEVANTANDO_MS) {
        c.piscandoAte = c.relogio + PISCANDO_MS;
        comecar(c, 'parado');
      }
      break;
    case 'soco1':
    case 'soco2':
    case 'soco3':
    case 'especial': {
      const g = GOLPES[c.acao];
      if (soco && c.acao !== 'especial' && c.t > g.dura * 0.45) c.socoNaFila = true;
      if (c.t >= g.dura) {
        if (c.acao !== 'especial') c.ultimoSoco = { golpe: c.acao, fim: c.relogio };
        c.golpe = null;
        comecar(c, 'parado');
        if (c.socoNaFila) {
          c.socoNaFila = false;
          novo = comecarGolpe(c, proximoSoco(c));
        }
      }
      break;
    }
    case 'pulo':
    case 'voadora': {
      c.x += c.vx * dt;
      c.vz -= GRAVIDADE * dt;
      c.z += c.vz * dt;
      if (soco && c.acao === 'pulo' && !c.voadoraNestePulo && c.z > 2) {
        c.voadoraNestePulo = true;
        novo = comecarGolpe(c, 'voadora');
        comecar(c, 'voadora');
      }
      if (c.z <= 0) {
        c.z = 0;
        c.vz = 0;
        c.golpe = null;
        comecar(c, 'parado');
      }
      break;
    }
    default: {
      // parado ou andando: anda, e cada aperto começa uma coisa
      if (especial && c.hp > CUSTO_ESPECIAL && c.relogio - c.ultimoEspecial >= 950) {
        c.ultimoEspecial = c.relogio;
        novo = comecarGolpe(c, 'especial');
        break;
      }
      if (soco) {
        novo = comecarGolpe(c, proximoSoco(c));
        break;
      }
      if (pulo) {
        c.vz = PULO_VZ;
        c.vx = mx * VEL_X;
        c.voadoraNestePulo = false;
        comecar(c, 'pulo');
        break;
      }
      c.x += mx * VEL_X * dt;
      c.y += my * VEL_Y * dt;
      if (mx) c.lado = mx > 0 ? 1 : -1;
      const anda = mx !== 0 || my !== 0;
      if (anda && c.acao !== 'andando') comecar(c, 'andando');
      else if (!anda && c.acao !== 'parado') comecar(c, 'parado');
    }
  }
  c.x = Math.max(arena[0] + 8, Math.min(arena[1] - 8, c.x));
  c.y = Math.max(0, Math.min(PROF, c.y));
  return novo;
}

/** O servidor disse que o coelho apanhou: ele vai para trás (e cai, se o golpe derruba). */
export function apanhar(c: Coelho, derruba: boolean, lado: number) {
  c.golpe = null;
  c.socoNaFila = false;
  c.ultimoSoco = null;
  c.vx = (lado >= 0 ? 1 : -1) * (derruba ? 110 : 60);
  // o golpe que não derruba também se vê (relato de 06/11/2026: "tomei vários socos e não pisquei"): pisca pela folga que
  // o servidor dá (invulAte); o que derruba pisca ao levantar, que é quando a folga dele acaba
  if (!derruba) c.piscandoAte = Math.max(c.piscandoAte, c.relogio + PISCA_DO_GOLPE_MS);
  if (derruba) {
    c.vz = c.z > 0 ? 60 : 120;
    comecar(c, 'caido');
  } else if (c.acao !== 'caido') {
    comecar(c, 'dor');
  }
}

/** O golpe está na parte que pega? */
export function golpeAtivo(c: Coelho): boolean {
  if (!c.golpe) return false;
  if (c.golpe === 'voadora') return c.acao === 'voadora' && c.t >= GOLPES.voadora.dura * ATIVO.voadora[0];
  const [a, b] = ATIVO[c.golpe];
  const d = GOLPES[c.golpe].dura;
  return c.t >= a * d && c.t <= b * d;
}

/** Pela ação e o tempo dela (o que os outros mandam), o golpe está na parte que pega? Para desenhar o rastro. */
export function acaoAtiva(acao: Acao, t: number): boolean {
  if (acao === 'voadora') return true;
  if (acao !== 'soco1' && acao !== 'soco2' && acao !== 'soco3') return false;
  const [a, b] = ATIVO[acao];
  return t >= a * GOLPES[acao].dura && t <= b * GOLPES[acao].dura;
}

export interface InimigoNaTela {
  id: number;
  tipo: TipoDeInimigo;
  x: number;
  y: number;
  z: number;
  estado: EstadoDoInimigo;
}

/** Pode apanhar agora? (Caído, levantando ou sumindo, não; o corvo no alto, só de voadora.) */
export function apanhavel(i: InimigoNaTela, golpe: Golpe): boolean {
  if (i.estado === 'caido' || i.estado === 'levantando' || i.estado === 'morto') return false;
  return !(i.tipo === 'corvo' && i.z > 18 && golpe !== 'voadora');
}

/** A caixa do golpe encosta no inimigo? A mesma conta do servidor, sem a folga dele. */
export function encosta(golpe: Golpe, x: number, y: number, z: number, lado: number, i: InimigoNaTela): boolean {
  const g = GOLPES[golpe];
  const dx = (i.x - x) * (golpe === 'especial' ? 1 : lado);
  const w = CORPO[i.tipo];
  if (!(dx + w >= g.alcance[0] && dx - w <= g.alcance[1] && Math.abs(i.y - y) <= g.fundo)) return false;
  // a voadora pega o que está na altura dela; o soco no chão, o que está embaixo
  return golpe === 'voadora' ? Math.abs(i.z - z) < 26 : i.z < 24;
}

// ---------------- O QUADRO DO SERVIDOR, E A INTERPOLAÇÃO ----------------
export interface Quadro {
  n: number;
  f: 'lutando' | 'avancando' | 'vitoria' | 'derrota' | 'fim';
  o: number;
  a: [number, number];
  /** [id, tipo, x, y, z, estado, lado, hp%, passos no estado, faixa] */
  i: number[][];
  /** [userId, x, y, z, lado, ação, ms da ação, hp, vidas, pontos, estado (0 em pé, 1 fora, 2 sem vidas), avatar, último golpe aceito] */
  j: number[][];
  e: unknown[][];
}

const MEDALHAS = ['🥇', '🥈', '🥉'];

/**
 * O que vai no lugar da posição no placar do fim (revisão independente, 03/11/2026: a tela dava medalha a todas as linhas,
 * até depois de perder e no Solo). A posição vem do servidor, só entre quem ficou (null para quem saiu: "–"); a medalha, só
 * quando o troféu também sai: fase vencida, fora do Solo, 2 ou mais que ficaram, até o 3º, e com ponto.
 */
export function marcaDoLugar(posicao: number | null, pontos: number, o: { venceu: boolean; solo: boolean; ficaram: number }): string {
  if (posicao === null) return '–';
  if (o.venceu && !o.solo && o.ficaram >= 2 && posicao <= 3 && pontos > 0) return MEDALHAS[posicao - 1];
  return `${posicao}.`;
}

export const ehQuadro = (d: unknown): d is Quadro => {
  const q = d as Quadro | null;
  return !!q && (q as { tipo?: unknown } & Quadro).tipo === 'q' && typeof q.n === 'number' && Array.isArray(q.i) && Array.isArray(q.j) && Array.isArray(q.a);
};

/**
 * A LINHA DO TEMPO DOS QUADROS: cada um chega com o número do passo do servidor. A tela desenha um pouco ATRÁS do mais
 * novo (ATRASO_MS), interpolando entre os dois que cercam esse instante — o tremido da internet some, e o custo são esses
 * 100 ms. A hora de cada passo neste computador sai da chegada mais adiantada (a que menos atrasou).
 */
export const ATRASO_MS = 100;
export class LinhaDoTempo {
  quadros: Quadro[] = [];
  private base = Infinity;

  chegou(q: Quadro, agora: number) {
    const ultimo = this.quadros.at(-1);
    if (ultimo && q.n <= ultimo.n) return;
    this.quadros.push(q);
    if (this.quadros.length > 40) this.quadros.shift();
    // a base anda devagar para frente (o relógio deste computador e o do servidor não andam iguais), e cai na hora
    this.base = Math.min(this.base + 0.5, agora - q.n * PASSO_MS);
  }

  /** O passo (fracionário) que a tela mostra agora. */
  passoNaTela(agora: number): number {
    return (agora - this.base - ATRASO_MS) / PASSO_MS;
  }

  /** Os dois quadros em volta do passo `p`, e quanto andar do primeiro para o segundo. */
  emVolta(p: number): { a: Quadro; b: Quadro; k: number } | null {
    const qs = this.quadros;
    if (!qs.length) return null;
    if (p <= qs[0].n) return { a: qs[0], b: qs[0], k: 0 };
    for (let i = qs.length - 1; i >= 0; i--) {
      if (qs[i].n <= p) {
        const b = qs[i + 1] ?? qs[i];
        const k = b === qs[i] ? 0 : (p - qs[i].n) / (b.n - qs[i].n);
        return { a: qs[i], b, k: Math.max(0, Math.min(1, k)) };
      }
    }
    return { a: qs[0], b: qs[0], k: 0 };
  }

  ultimo(): Quadro | null {
    return this.quadros.at(-1) ?? null;
  }
}

/** Entre duas linhas do quadro (o mesmo id na coluna 0): x, y e z andam, o resto é o do mais novo. */
export function misturar(a: number[][], b: number[][], k: number, colunas: number[]): number[][] {
  const antes = new Map(a.map((l) => [l[0], l]));
  return b.map((l) => {
    const v = antes.get(l[0]);
    if (!v) return l;
    const r = [...l];
    for (const c of colunas) r[c] = v[c] + (l[c] - v[c]) * k;
    return r;
  });
}

// ---------------- O PILOTO AUTOMÁTICO (só no desenvolvimento, para o teste de tela) ----------------
/**
 * Anda até o inimigo mais perto e bate; sem inimigo, anda para a direita (a seta). Pula e dá voadora no corvo que está
 * no alto. Só para o e2e/briga.mjs terminar a fase (window.brigaPilotoAutomatico, ver JogoBriga.tsx).
 */
export function pilotoAutomatico(c: Coelho, inimigos: InimigoNaTela[], cmd: Comandos, relogio: number) {
  cmd.esquerda = cmd.direita = cmd.cima = cmd.baixo = false;
  const vivos = inimigos.filter((i) => i.estado !== 'morto' && i.estado !== 'caido' && i.estado !== 'levantando');
  const alvo = vivos.sort((a, b) => Math.abs(a.x - c.x) + Math.abs(a.y - c.y) - (Math.abs(b.x - c.x) + Math.abs(b.y - c.y)))[0];
  if (!alvo) {
    cmd.direita = true;
    return;
  }
  const lado = alvo.x >= c.x ? 1 : -1;
  // o chefe avisa antes: sai da faixa da investida e de perto da pancada
  const chefe = vivos.find((i) => i.tipo === 'texugo');
  if (chefe && (chefe.estado === 'prep-investida' || chefe.estado === 'investida') && Math.abs(chefe.y - c.y) < 18) {
    if (chefe.y >= c.y && c.y > 4) cmd.cima = true;
    else cmd.baixo = true;
    return;
  }
  if (chefe && (chefe.estado === 'prep-pancada' || chefe.estado === 'pancada') && Math.abs(chefe.x - c.x) < 70) {
    if (chefe.x >= c.x) cmd.esquerda = true;
    else cmd.direita = true;
    return;
  }
  const destino = alvo.x - lado * (alvo.tipo === 'texugo' ? 30 : 20);
  if (Math.abs(destino - c.x) > 4) {
    if (destino > c.x) cmd.direita = true;
    else cmd.esquerda = true;
  } else if (c.lado !== lado) {
    if (lado > 0) cmd.direita = true;
    else cmd.esquerda = true;
  }
  if (Math.abs(alvo.y - c.y) > 3) {
    if (alvo.y > c.y) cmd.baixo = true;
    else cmd.cima = true;
  }
  // perto: na frente dele, ao alcance (na borda da arena, o destino exato pode não existir)
  const d = (alvo.x - c.x) * c.lado;
  const perto = d >= 8 && d <= (alvo.tipo === 'texugo' ? 40 : 30) && Math.abs(alvo.y - c.y) <= 6;
  if (perto && Math.floor(relogio / 120) % 2 === 0) {
    if (alvo.tipo === 'corvo' && alvo.z > 18) {
      if (c.acao === 'parado' || c.acao === 'andando') cmd.pulo = true;
      else cmd.soco = true;
    } else cmd.soco = true;
  }
}
