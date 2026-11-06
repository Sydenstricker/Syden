import { ARENA, CARGA, VEL_DA_ERVILHA, type Aviao } from './sim';

/**
 * O PILOTO DO COMPUTADOR do Duelo de aviõezinhos (05/11/2026): regras, não modelo de linguagem, e vê só o que uma pessoa ali
 * veria (os aviões e os tiros na tela). Persegue o mais perto, mira um pouco à frente dele, dá ervilhas quando está de
 * frente, segura e solta a cenoura de vez em quando, foge da cerca e, com uma cenoura no rabo, freia e vira fechado (perto da
 * cerca, é a curva que protege). Serve também de piloto automático nos testes.
 */

export interface MemoriaDoRobo {
  /** 0 a 1: o quanto mira bem e reage depressa. */
  jeito: number;
  alvo: number | null;
  trocaEm: number;
  /** Segurando o tiro para a cenoura: quantos passos faltam para soltar. */
  segurando: number;
  /** De quanto em quanto ele dá a ervilha. */
  esperaTiro: number;
  lado: number;
  /** Há quantos passos persegue sem chance de tiro, e até quando está se afastando para voltar. */
  semChance: number;
  afastaAte: number;
  semente: number;
}

export interface VistaDoRobo {
  n: number;
  inimigos: { id: number; x: number; y: number; hx: number; hy: number; v: number }[];
  /** Os tiros dos outros: onde estão e para onde vão. */
  perigos: { x: number; y: number; dx: number; dy: number; missil: boolean; meu: boolean }[];
  /** A minha cenoura está livre? */
  missilLivre: boolean;
}

export interface ComandosDoDuelo {
  acelera: boolean;
  freia: boolean;
  vira: number;
  fogo: boolean;
}

export const novaMemoria = (jeito: number, semente = 1): MemoriaDoRobo => ({
  jeito,
  alvo: null,
  trocaEm: 0,
  segurando: 0,
  esperaTiro: 0,
  lado: semente % 2 ? 1 : -1,
  semChance: 0,
  afastaAte: 0,
  semente: (semente * 7919 + 13) | 0 || 1,
});

const sorte = (m: MemoriaDoRobo) => {
  m.semente = (Math.imul(m.semente, 1103515245) + 12345) | 0;
  return ((m.semente >>> 8) & 0xffff) / 0x10000;
};

/** Para que lado virar para olhar (tx, ty): 1, −1 ou 0, e o "quanto está de frente" (o cosseno). */
function virarPara(a: Aviao, tx: number, ty: number, folga: number): { vira: number; frente: number } {
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy) || 1;
  const cruz = (a.hx * dy - a.hy * dx) / d;
  const frente = (a.hx * dx + a.hy * dy) / d;
  return { vira: frente < 0 ? (cruz >= 0 ? 1 : -1) : Math.abs(cruz) < folga ? 0 : cruz > 0 ? 1 : -1, frente };
}

export function comandoDoRobo(a: Aviao, vista: VistaDoRobo, m: MemoriaDoRobo): ComandosDoDuelo {
  const c: ComandosDoDuelo = { acelera: false, freia: false, vira: 0, fogo: false };
  const [x0, y0, x1, y1] = ARENA;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;

  // o alvo: o mais perto, trocando de vez em quando
  if (m.alvo === null || vista.n >= m.trocaEm || !vista.inimigos.some((i) => i.id === m.alvo)) {
    let melhor: number | null = null, dist = Infinity;
    for (const i of vista.inimigos) {
      const d = Math.hypot(i.x - a.x, i.y - a.y);
      if (d < dist) (dist = d), (melhor = i.id);
    }
    m.alvo = melhor;
    m.trocaEm = vista.n + 180 + Math.floor(sorte(m) * 180);
  }
  const alvo = vista.inimigos.find((i) => i.id === m.alvo) ?? null;

  // a cenoura de alguém atrás de mim: freia e vira fechado
  const cenoura = vista.perigos.find((p) => p.missil && !p.meu && Math.hypot(p.x - a.x, p.y - a.y) < 46 + 30 * m.jeito);
  // a cerca na frente: volta para o meio
  const olhaX = a.x + a.hx * 34, olhaY = a.y + a.hy * 34;
  const cerca = olhaX < x0 + 10 || olhaX > x1 - 10 || olhaY < y0 + 10 || olhaY > y1 - 10;

  if (cenoura && sorte(m) < 0.4 + 0.6 * m.jeito) {
    c.freia = true;
    c.vira = m.lado;
  } else if (cerca) {
    const v = virarPara(a, cx, cy, 0.05);
    c.vira = v.vira || m.lado;
    c.freia = v.frente < 0.3;
  } else if (alvo && vista.n < m.afastaAte) {
    // AFASTANDO: ficou girando atrás de alguém sem chance de tiro; sai reto, acelerando, e volta depois (senão os dois
    // giram em volta um do outro até o fim do tempo)
    const v = virarPara(a, 2 * a.x - alvo.x, 2 * a.y - alvo.y, 0.3);
    c.vira = v.vira;
    c.acelera = true;
  } else if (alvo) {
    const d = Math.hypot(alvo.x - a.x, alvo.y - a.y);
    if (m.semChance++ > 200 + 150 * sorte(m)) {
      m.semChance = 0;
      m.afastaAte = vista.n + 50 + Math.floor(sorte(m) * 60);
    }
    // um pouco à frente dele (a ervilha leva um tempo para chegar), mais certo para quem tem mais jeito
    const tempo = (d / VEL_DA_ERVILHA) * (0.4 + 0.6 * m.jeito);
    const px = alvo.x + alvo.hx * alvo.v * tempo, py = alvo.y + alvo.hy * alvo.v * tempo;
    const v = virarPara(a, px, py, 0.08);
    c.vira = v.vira;
    c.acelera = d > 90;
    // freando, a curva fecha: é assim que se entra atrás de alguém
    c.freia = d < 40 || v.frente < 0.5;
    // a ervilha: de frente e não muito longe
    if (m.esperaTiro > 0) m.esperaTiro--;
    else if (v.frente > 0.993 - 0.02 * (1 - m.jeito) && d < 150) {
      c.fogo = true;
      m.semChance = 0;
      m.esperaTiro = 30 + Math.floor((1 - m.jeito) * 50 + sorte(m) * 30);
    }
    // a cenoura: livre, a uma boa distância, de vez em quando
    if (m.segurando === 0 && vista.missilLivre && d > 50 && d < 230 && sorte(m) < 0.004 + 0.008 * m.jeito) m.segurando = CARGA + 3;
  }
  if (m.segurando > 0) {
    m.segurando--;
    c.fogo = m.segurando > 0;
  }
  if (sorte(m) < 0.004) m.lado = -m.lado;
  return c;
}
