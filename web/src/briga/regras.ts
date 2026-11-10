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
export const PASSO_MS = 50;
/**
 * O ESPECIAL É UM GIRO EM QUE SE ANDA (09/11/2026, pedido dele: "o especial teria uma barra para visualizar possibilidade de
 * uso, e ele não ficaria travado usando: poder andar e girar"). Antes ele custava vida e prendia o coelho no lugar meio
 * segundo. Agora dura GIRO_MS, o coelho anda e troca de faixa na velocidade de sempre, e a cada GIRO_TICK_MS pega de novo
 * quem estiver em volta (cada inimigo, uma vez por volta). O recurso é uma RECARGA pelo tempo, e não mais a vida: a barra
 * enche sozinha em RECARGA_ESPECIAL_MS desde o último giro, e cheia ele sai. Pelo tempo, e não pelos acertos, de propósito:
 * o site e o servidor contam a mesma coisa sem trocar mensagem nenhuma (a barra daqui não precisa saber quais acertos o
 * servidor aceitou), e quem está apanhando não fica sem a saída por ter vida pouca.
 */
export const GIRO_MS = 1600;
export const GIRO_TICK_MS = 320;
export const RECARGA_ESPECIAL_MS = 8000;
/**
 * A ARRANCADA (09/11/2026, pedido dele: "se aperto duas vezes pra frente o coelho dá um dash ou corre, tanto para frente
 * como para trás"): dois toques para o mesmo lado (seta ou A/D) dentro de TOQUE_DUPLO_MS, e o coelho dispara ARRANCADA_MS
 * para aquele lado, a ARRANCADA_VEL. Só movimento: não bate nem fica invulnerável (o servidor confere o quanto ela anda).
 */
export const ARRANCADA_MS = 200;
export const ARRANCADA_VEL = 220;
export const ARRANCADA_RECARGA_MS = 600;
export const TOQUE_DUPLO_MS = 250;

export type Golpe = 'soco1' | 'soco2' | 'soco3' | 'voadora' | 'especial';
export const GOLPES: Record<Golpe, { dura: number; alcance: [number, number]; fundo: number; dano: number; derruba: boolean }> = {
  soco1: { dura: 260, alcance: [6, 30], fundo: 9, dano: 4, derruba: false },
  soco2: { dura: 280, alcance: [6, 32], fundo: 9, dano: 5, derruba: false },
  soco3: { dura: 420, alcance: [4, 34], fundo: 10, dano: 9, derruba: true },
  voadora: { dura: 900, alcance: [0, 30], fundo: 11, dano: 9, derruba: true },
  // o giro: pega dos dois lados, a cada volta (GIRO_TICK_MS), e não derruba (só empurra: quem gira vai atrás)
  especial: { dura: GIRO_MS, alcance: [-34, 34], fundo: 14, dano: 4, derruba: false },
};
/** Em que parte do golpe ele pega (fração da duração). A voadora pega do começo até o pé tocar o chão. */
export const ATIVO: Record<Golpe, [number, number]> = {
  soco1: [0.27, 0.62],
  soco2: [0.25, 0.6],
  soco3: [0.3, 0.6],
  voadora: [0.06, 1],
  especial: [0, 1],
};
// os bichos e as fases: a mesma cópia do servidor (fases.ts ↔ server/src/briga-fases.ts)
import { bicho, CORPO, TIPOS, type TipoDeInimigo } from './fases';
export { CORPO, TIPOS, type TipoDeInimigo };
export const ESTADOS = [
  'entrando', 'andando', 'esperando', 'preparando', 'atacando', 'recuperando', 'dor', 'caido', 'levantando', 'morto',
  'rondando', 'mirando', 'mergulhando', 'subindo', 'prep-investida', 'investida', 'cansado', 'prep-pancada', 'pancada',
  // as fases novas (06/11/2026): o pulo de quem cai em cima, e a rajada do chefe que atira
  'saltando', 'prep-sopro', 'sopro',
] as const;
export type EstadoDoInimigo = (typeof ESTADOS)[number];
// a ordem é o código que vai na rede: ação nova entra no FIM ('arrancada', 09/11/2026)
export const ACOES = ['parado', 'andando', 'soco1', 'soco2', 'soco3', 'pulo', 'voadora', 'dor', 'caido', 'levantando', 'especial', 'arrancada'] as const;
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
  /** O segundo toque para um lado (o teclado e os botões de toque contam: ToqueDuplo); 0 sem arrancada. */
  arrancada: -1 | 0 | 1;
}

export const comandosVazios = (): Comandos => ({ esquerda: false, direita: false, cima: false, baixo: false, soco: false, pulo: false, especial: false, arrancada: 0 });

/**
 * O TOQUE DUPLO: quem aperta (o teclado, o direcional da tela de toque) avisa cada aperto NOVO de um lado; o segundo, para o
 * mesmo lado, dentro de TOQUE_DUPLO_MS, é a arrancada. Fica fora do passo do coelho para o piloto automático (que liga e
 * desliga a seta a cada passo) não disparar arrancadas sem querer.
 */
export class ToqueDuplo {
  private ultimo: { lado: -1 | 1; em: number } | null = null;
  apertou(lado: -1 | 1, agora: number): boolean {
    const duplo = !!this.ultimo && this.ultimo.lado === lado && agora - this.ultimo.em <= TOQUE_DUPLO_MS;
    this.ultimo = duplo ? null : { lado, em: agora };
    return duplo;
  }
}

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
  ultimaArrancada: number;
  /** No giro: a volta atual (cada uma pega cada inimigo uma vez; vai junto no acerto). */
  volta: number;
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
  ultimaArrancada: -Infinity,
  volta: 0,
  relogio: 0,
  hp: VIDA,
});

/** O que um passo do coelho fez de novo: um golpe que começou (vai ao servidor na hora). */
export interface Novidade {
  comecou?: { id: number; golpe: Golpe };
  /** A arrancada começou (a posição vai na hora, para o servidor dar a folga dela já na primeira). */
  arrancou?: boolean;
}

/** Quanto da barra do especial está cheio (0 a 1), pelo relógio do coelho. */
export const cargaDoEspecial = (c: Coelho) => Math.max(0, Math.min(1, (c.relogio - c.ultimoEspecial) / RECARGA_ESPECIAL_MS));

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
  const soco = cmd.soco, pulo = cmd.pulo, especial = cmd.especial, arrancada = cmd.arrancada;
  cmd.soco = cmd.pulo = cmd.especial = false;
  cmd.arrancada = 0;
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
    case 'arrancada':
      c.x += c.lado * ARRANCADA_VEL * dt;
      if (c.t >= ARRANCADA_MS) comecar(c, 'parado');
      break;
    case 'especial': {
      // o giro anda e troca de faixa como o coelho parado; cada volta nova pega todo mundo de novo
      c.x += mx * VEL_X * dt;
      c.y += my * VEL_Y * dt;
      if (mx) c.lado = mx > 0 ? 1 : -1;
      const volta = Math.min(Math.floor(c.t / GIRO_TICK_MS), Math.ceil(GIRO_MS / GIRO_TICK_MS) - 1);
      if (volta !== c.volta) {
        c.volta = volta;
        c.acertados = new Set();
      }
      if (c.t >= GIRO_MS) {
        c.golpe = null;
        comecar(c, 'parado');
      }
      break;
    }
    case 'soco1':
    case 'soco2':
    case 'soco3': {
      const g = GOLPES[c.acao];
      if (soco && c.t > g.dura * 0.45) c.socoNaFila = true;
      if (c.t >= g.dura) {
        c.ultimoSoco = { golpe: c.acao, fim: c.relogio };
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
      if (especial && cargaDoEspecial(c) >= 1) {
        c.ultimoEspecial = c.relogio;
        c.volta = 0;
        novo = comecarGolpe(c, 'especial');
        break;
      }
      if (arrancada && c.relogio - c.ultimaArrancada >= ARRANCADA_RECARGA_MS) {
        c.ultimaArrancada = c.relogio;
        c.lado = arrancada;
        comecar(c, 'arrancada');
        novo = { arrancou: true };
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
  /** A faixa do aviso (o mergulho, a investida, o tiro; no pulo, o y da queda) e, no pulo, o x da queda. */
  faixa?: number;
  alvoX?: number;
}

/** Um tiro no ar, como o quadro o traz. */
export interface TiroNaTela {
  x: number;
  y: number;
  lado: number;
}

/** Pode apanhar agora? (Caído, levantando ou sumindo, não; o que está no alto — o corvo, o sapo pulando —, só de voadora.) */
export function apanhavel(i: InimigoNaTela, golpe: Golpe): boolean {
  if (i.estado === 'caido' || i.estado === 'levantando' || i.estado === 'morto') return false;
  return !(i.z > 18 && golpe !== 'voadora');
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
  /** [id, tipo, x, y, z, estado, lado, hp%, passos no estado, faixa, x da queda do pulo] */
  i: number[][];
  /** A fase na tela (o índice em FASES_DA_BRIGA). */
  fs?: number;
  /** Os tiros no ar: [id, tipo, x, y, lado]. */
  t?: number[][];
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
export function pilotoAutomatico(c: Coelho, inimigos: InimigoNaTela[], cmd: Comandos, relogio: number, tiros: TiroNaTela[] = []) {
  cmd.esquerda = cmd.direita = cmd.cima = cmd.baixo = false;
  const vivos = inimigos.filter((i) => i.estado !== 'morto' && i.estado !== 'caido' && i.estado !== 'levantando');
  const alvo = vivos.sort((a, b) => Math.abs(a.x - c.x) + Math.abs(a.y - c.y) - (Math.abs(b.x - c.x) + Math.abs(b.y - c.y)))[0];
  if (!alvo) {
    cmd.direita = true;
    return;
  }
  const lado = alvo.x >= c.x ? 1 : -1;
  // sai da faixa de um tiro que vem (ou da linha que pisca de quem mira), e do círculo de quem vai cair em cima
  const fugirDaFaixa = (y: number) => {
    if (y >= c.y && c.y > 10) cmd.cima = true;
    else if (c.y < PROF - 10) cmd.baixo = true;
    else cmd.cima = true;
  };
  const tiro = tiros.find((tr) => Math.abs(tr.y - c.y) < 12 && (c.x - tr.x) * tr.lado > -10 && (c.x - tr.x) * tr.lado < 150);
  if (tiro) return fugirDaFaixa(tiro.y);
  const mirando = vivos.find((i) => bicho(i.tipo).comp === 'tiro' && i.estado === 'mirando' && Math.abs((i.faixa ?? i.y) - c.y) < 12);
  if (mirando) return fugirDaFaixa(mirando.faixa ?? mirando.y);
  const sopro = vivos.find((i) => i.estado === 'prep-sopro' && Math.abs((i.faixa ?? i.y) - c.y) < 26);
  if (sopro) return fugirDaFaixa(sopro.faixa ?? sopro.y);
  const queda = vivos.find((i) => (i.estado === 'preparando' || i.estado === 'saltando') && bicho(i.tipo).comp === 'pulo' && Math.abs((i.alvoX ?? i.x) - c.x) < 34 && Math.abs((i.faixa ?? i.y) - c.y) < 16);
  if (queda) {
    if ((queda.alvoX ?? queda.x) >= c.x) cmd.esquerda = true;
    else cmd.direita = true;
    return;
  }
  // o chefe avisa antes: sai da faixa da investida e de perto da pancada
  const chefe = vivos.find((i) => bicho(i.tipo).comp === 'chefe');
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
  const grande = bicho(alvo.tipo).comp === 'chefe';
  const destino = alvo.x - lado * (grande ? 30 : 20);
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
  const perto = d >= 8 && d <= (grande ? 40 : 30) && Math.abs(alvo.y - c.y) <= 6;
  if (perto && Math.floor(relogio / 120) % 2 === 0) {
    if (alvo.z > 18) {
      if (c.acao === 'parado' || c.acao === 'andando') cmd.pulo = true;
      else cmd.soco = true;
    } else cmd.soco = true;
  }
}
