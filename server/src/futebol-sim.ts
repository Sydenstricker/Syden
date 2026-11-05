/**
 * O FUTEBOL DOS COELHOS: A SIMULAÇÃO (05/11/2026, pedido dele: futebol ao vivo na sala, e no Solo contra robôs). Um futebol de
 * campo pequeno, visto de cima, no espírito dos futebóis de fliperama — SÓ A MECÂNICA: andar, conduzir a bola encostando nela,
 * chutar (segurar carrega a força), passar para o companheiro, roubar a bola de quem a conduz. Sem lateral nem escanteio: o
 * campo tem parede baixa, e a bola quica nela. Os jogadores são os da Kenney (Sports Pack, CC0) com orelhas de coelho
 * desenhadas por código no site.
 *
 * ESTE ARQUIVO EXISTE DUAS VEZES, IGUAL BYTE A BYTE: server/src/futebol-sim.ts e web/src/futebol/sim.ts (web/test/futebol.test.ts
 * confere). No Solo, o site joga a partida inteira com ele (a pessoa e os robôs, sem rede no meio). Na sala, o servidor roda a
 * bola e os robôs com ele (server/src/minijogo-futebol.ts), e o site usa as mesmas contas para mover o próprio coelho e para
 * adiantar a bola enquanto a resposta do servidor não chega. Por isso ele não importa nada e, dentro do passo, só usa + − × ÷ e
 * raiz (nada de seno, cosseno ou número sorteado): o mesmo passo dá o mesmo resultado em qualquer computador.
 *
 * O TEMPO É O PASSO: 60 por segundo. A partida tem 3 minutos de bola rolando (o relógio para depois do gol). As unidades são os
 * pixels da tela do jogo (W × H), e as velocidades, pixels por passo.
 */

export const PASSOS_POR_SEGUNDO = 60;
/** A tela do jogo, e o campo dentro dela (as paredes baixas são as bordas do campo). */
export const W = 640;
export const H = 400;
export const X0 = 40;
export const X1 = 600;
export const Y0 = 34;
export const Y1 = 366;
export const CX = 320;
export const CY = 200;
/** A meia boca do gol (a boca inteira tem o dobro), e a fundura da rede. */
export const GOL_MEIA = 46;
export const GOL_FUNDO = 20;
export const R_JOGADOR = 9;
export const R_BOLA = 5;
/** A velocidade de quem corre, e de quem conduz a bola (um pouco menos: dá para alcançar quem conduz). */
export const VEL = 2;
export const VEL_COM_BOLA = 1.85;
/** O robô corre um pouco menos que gente: a graça é a pessoa poder ganhar dele. */
export const FATOR_DO_ROBO = 0.86;
/** O quanto a velocidade chega à desejada a cada passo (o arranque e a freada). */
export const ACEL = 0.3;
export const ATRITO = 0.983;
export const QUIQUE = 0.6;
/** O chute: a força vai de CHUTE_MIN (um toque) a CHUTE_MAX (segurando CARGA_MAX passos, 0,75 s). */
export const CHUTE_MIN = 4.5;
export const CHUTE_MAX = 10;
export const CARGA_MAX = 45;
export const PASSE_MIN = 2.6;
export const PASSE_MAX = 6.5;
/** A bola mais rápida que isto não se domina: bate no corpo e desvia. */
export const DOMINIO_MAX = 6;
/** Encostar: a distância do centro do jogador ao da bola em que ele a domina (ou chuta de primeira). */
export const ALCANCE = R_JOGADOR + R_BOLA + 3;
/** Onde a bola fica, na frente de quem a conduz. */
export const FRENTE = R_JOGADOR + R_BOLA;
/** Quem acabou de ganhar a bola fica com ela um instante, sem roubo. */
export const PROTEGE = 30;
/** Quem perdeu a bola não a rouba de volta logo. */
export const ESPERA_ROUBO = 40;
/** Quem perdeu a bola num roubo fica tonto um instante, sem andar (é o que dá ao outro a chance de sair com ela). */
export const TONTO = 36;
/** Quem chutou não domina a própria bola no passo seguinte. */
export const SEM_DOMINIO = 14;
export const PARTIDA_PASSOS = 3 * 60 * PASSOS_POR_SEGUNDO;
/** A contagem antes da largada (3 s), e o gol: 2,5 s parado, e a volta ao meio quando faltar 1 s. */
export const CONTAGEM = 180;
export const GOL_PAUSA = 150;
export const GOL_REINICIO = 60;
export const MAXIMO_POR_TIME = 4;
/** O círculo do meio: na saída, o time que não dá a saída espera fora dele até a bola sair de lá. */
export const RAIO_DO_CENTRO = 50;

export interface Bola {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Quem a conduz (0: ninguém; as contas têm id positivo, os robôs negativo). */
  dono: number;
  /** O último que tocou nela (o autor do gol). */
  ultimo: number;
  /** Passos até poder ser roubada. */
  protege: number;
  /** Muda a cada chute ou passe: o servidor sabe se a bola foi chutada depois de um instante do passado. */
  versao: number;
}

export interface Jogador {
  id: number;
  time: 0 | 1;
  /** O lugar na formação: o último, com 2 ou mais por time, é o que fica atrás. */
  slot: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Para onde está virado (unitário): é para onde a bola vai no chute. */
  fx: number;
  fy: number;
  /** Os passos segurando o chute (0: não está carregando). */
  carga: number;
  semDominio: number;
  esperaRoubo: number;
  /** Os passos tonto, depois de perder a bola num roubo: não anda. */
  tonto: number;
  /** Movido de fora (na sala, a pessoa move o próprio coelho no computador dela): o passo não o anda. */
  externo: boolean;
  /** Corre como robô (o computador, ou quem saiu da sala e deixou o coelho com ele). */
  robo: boolean;
  gols: number;
}

export interface Comando {
  /** A direção, de -1 a 1 em cada eixo. */
  dx: number;
  dy: number;
  /** Segurando o chute (soltar chuta). */
  chute: boolean;
  /** O passe, só no passo em que foi apertado. */
  passe: boolean;
}

export type Evento =
  | { tipo: 'chute'; id: number; forca: number }
  | { tipo: 'passe'; id: number }
  | { tipo: 'dominio'; id: number }
  | { tipo: 'roubo'; id: number; de: number }
  | { tipo: 'quique' }
  | { tipo: 'gol'; time: 0 | 1; autor: number; contra: boolean }
  | { tipo: 'reinicio' }
  | { tipo: 'fim' };

export interface Mundo {
  /** Os passos de bola rolando (o relógio da partida). */
  passo: number;
  /** Todos os passos, contando a contagem e as pausas do gol. */
  tempo: number;
  pausa: number;
  /** Em que passo da pausa os jogadores voltam ao meio (-1: nenhum). */
  reinicioEm: number;
  /** O time que dá a saída no próximo reinício. */
  saida: 0 | 1;
  /** A saída ainda não aconteceu: a bola não saiu do círculo do meio. */
  centro: boolean;
  porTime: number;
  bola: Bola;
  jogadores: Jogador[];
  placar: [number, number];
  reinicios: number;
  fim: boolean;
  eventos: Evento[];
}

export const NADA: Comando = { dx: 0, dy: 0, chute: false, passe: false };

/** As formações (em relação ao meio, para quem ataca a direita): o último é o que fica atrás. */
const FORMACOES: number[][][] = [
  [[-50, 0]],
  [[-45, 0], [-200, 0]],
  [[-45, -55], [-45, 55], [-210, 0]],
  [[-45, -65], [-45, 65], [-140, 0], [-235, 0]],
];

export function posicaoInicial(time: 0 | 1, slot: number, porTime: number, saida: boolean): [number, number] {
  const f = FORMACOES[Math.max(0, Math.min(MAXIMO_POR_TIME, porTime) - 1)];
  const p = f[Math.min(slot, f.length - 1)];
  const dx = slot === 0 && saida ? -16 : p[0];
  return [CX + (time === 0 ? dx : -dx), CY + p[1]];
}

/** Um mundo novo: `times` são os ids de cada time, na ordem da formação. */
export function novoMundo(times: [number[], number[]]): Mundo {
  const porTime = Math.max(1, Math.min(MAXIMO_POR_TIME, Math.max(times[0].length, times[1].length)));
  const jogadores: Jogador[] = [];
  for (const time of [0, 1] as const) {
    times[time].forEach((id, slot) => {
      jogadores.push({
        id,
        time,
        slot,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        fx: time === 0 ? 1 : -1,
        fy: 0,
        carga: 0,
        semDominio: 0,
        esperaRoubo: 0,
        tonto: 0,
        externo: false,
        robo: id < 0,
        gols: 0,
      });
    });
  }
  const m: Mundo = {
    passo: 0,
    tempo: 0,
    pausa: CONTAGEM,
    reinicioEm: -1,
    saida: 0,
    centro: true,
    porTime,
    bola: { x: CX, y: CY, vx: 0, vy: 0, dono: 0, ultimo: 0, protege: 0, versao: 0 },
    jogadores,
    placar: [0, 0],
    reinicios: 0,
    fim: false,
    eventos: [],
  };
  posicionar(m, 0);
  m.reinicios = 0;
  return m;
}

/** Todos de volta à formação, e a bola no meio. */
export function posicionar(m: Mundo, saida: 0 | 1) {
  for (const j of m.jogadores) {
    const [x, y] = posicaoInicial(j.time, j.slot, m.porTime, j.time === saida);
    j.x = x;
    j.y = y;
    j.vx = 0;
    j.vy = 0;
    j.fx = j.time === 0 ? 1 : -1;
    j.fy = 0;
    j.carga = 0;
    j.semDominio = 0;
    j.esperaRoubo = 0;
    j.tonto = 0;
  }
  const b = m.bola;
  b.x = CX;
  b.y = CY;
  b.vx = 0;
  b.vy = 0;
  b.dono = 0;
  b.protege = 0;
  b.versao++;
  m.reinicios++;
  m.saida = saida;
  m.centro = true;
}

export const jogadorPorId = (m: Mundo, id: number): Jogador | undefined => {
  for (const j of m.jogadores) if (j.id === id) return j;
  return undefined;
};

const limitar = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** O jogador dentro do campo. */
export function prenderNoCampo(j: { x: number; y: number }) {
  j.x = limitar(j.x, X0 + R_JOGADOR, X1 - R_JOGADOR);
  j.y = limitar(j.y, Y0 + R_JOGADOR, Y1 - R_JOGADOR);
}

/** Na saída, quem não a dá fica fora do círculo do meio (o site prende o próprio coelho com a mesma conta). */
export function foraDoCentro(m: Mundo, j: { x: number; y: number; time: 0 | 1 }) {
  if (!m.centro || j.time === m.saida) return;
  const dx = j.x - CX;
  const dy = j.y - CY;
  const d = Math.sqrt(dx * dx + dy * dy);
  const r = RAIO_DO_CENTRO + R_JOGADOR;
  if (d >= r) return;
  if (d < 0.001) {
    j.x = CX + (j.time === 0 ? -r : r);
    return;
  }
  j.x = CX + (dx / d) * r;
  j.y = CY + (dy / d) * r;
}

/** Anda um passo com o comando (o chute e o passe são do passo do mundo). */
export function passoDoJogador(j: Jogador, c: Comando, comBola: boolean) {
  const max = (comBola ? VEL_COM_BOLA : VEL) * (j.robo ? FATOR_DO_ROBO : 1);
  let dx = limitar(c.dx, -1, 1);
  let dy = limitar(c.dy, -1, 1);
  const n = Math.sqrt(dx * dx + dy * dy);
  if (n > 1) {
    dx /= n;
    dy /= n;
  }
  if (n > 0.05) {
    j.fx = dx / Math.sqrt(dx * dx + dy * dy);
    j.fy = dy / Math.sqrt(dx * dx + dy * dy);
  }
  j.vx += (dx * max - j.vx) * ACEL;
  j.vy += (dy * max - j.vy) * ACEL;
  j.x += j.vx;
  j.y += j.vy;
  prenderNoCampo(j);
}

/** Onde fica a bola de quem a conduz: na frente dele, dentro do campo. */
export function frenteDe(j: { x: number; y: number; fx: number; fy: number }): [number, number] {
  return [limitar(j.x + j.fx * FRENTE, X0 + R_BOLA, X1 - R_BOLA), limitar(j.y + j.fy * FRENTE, Y0 + R_BOLA, Y1 - R_BOLA)];
}

export function forcaDaCarga(carga: number): number {
  return CHUTE_MIN + (CHUTE_MAX - CHUTE_MIN) * limitar(carga / CARGA_MAX, 0, 1);
}

/** O chute vai para onde o jogador está virado. */
export function vetorDoChute(j: Jogador, forca: number): [number, number] {
  return [j.fx * forca, j.fy * forca];
}

/**
 * O passe: para o companheiro mais bem colocado na frente de quem passa (com a corrida dele adiantada), forte o bastante para
 * chegar dominável; sem ninguém na frente, um toque curto para onde está virado.
 */
export function vetorDoPasse(m: Mundo, j: Jogador): [number, number] {
  let melhor = -Infinity;
  let vx = j.fx * 4.5;
  let vy = j.fy * 4.5;
  for (const t of m.jogadores) {
    if (t === j || t.time !== j.time) continue;
    const ddx = t.x + t.vx * 12 - j.x;
    const ddy = t.y + t.vy * 12 - j.y;
    const d = Math.sqrt(ddx * ddx + ddy * ddy);
    if (d < 24) continue;
    const cos = (ddx * j.fx + ddy * j.fy) / d;
    if (cos < 0.35) continue;
    const nota = cos * 2 - d / 400;
    if (nota > melhor) {
      melhor = nota;
      const v = limitar(d * 0.019 + 1.6, PASSE_MIN, PASSE_MAX);
      vx = (ddx / d) * v;
      vy = (ddy / d) * v;
    }
  }
  return [vx, vy];
}

/** O jogador pode tocar na bola agora: ele a conduz, ou ela está solta e encostada nele. */
export function podeChutar(m: Mundo, j: Jogador): boolean {
  const b = m.bola;
  if (b.dono === j.id) return true;
  if (b.dono !== 0) return false;
  const dx = b.x - j.x;
  const dy = b.y - j.y;
  return dx * dx + dy * dy <= (ALCANCE + 2) * (ALCANCE + 2);
}

/** A bola sai com a velocidade (vx, vy): da frente de quem a conduzia, ou de onde estava, se foi de primeira. */
export function aplicarChute(m: Mundo, j: Jogador, vx: number, vy: number, passe: boolean) {
  const b = m.bola;
  if (b.dono === j.id) {
    const [x, y] = frenteDe(j);
    b.x = x;
    b.y = y;
  }
  const v = Math.sqrt(vx * vx + vy * vy);
  if (v > CHUTE_MAX) {
    vx = (vx / v) * CHUTE_MAX;
    vy = (vy / v) * CHUTE_MAX;
  }
  b.vx = vx;
  b.vy = vy;
  b.dono = 0;
  b.protege = 0;
  b.ultimo = j.id;
  b.versao++;
  j.semDominio = SEM_DOMINIO;
  j.carga = 0;
  m.eventos.push(passe ? { tipo: 'passe', id: j.id } : { tipo: 'chute', id: j.id, forca: Math.sqrt(vx * vx + vy * vy) });
}

const naBoca = (y: number) => y > CY - GOL_MEIA + R_BOLA && y < CY + GOL_MEIA - R_BOLA;

/**
 * Um passo da bola solta: anda, perde força, quica nas paredes e na rede. Devolve o time que fez o gol (0 ou 1), ou -1. O time 0
 * ataca a direita. `contar` falso: a bola só anda (na pausa do gol, entrando na rede).
 */
export function passoDaBola(m: Mundo, contar: boolean): number {
  const b = m.bola;
  const px = b.x;
  b.x += b.vx;
  b.y += b.vy;
  b.vx *= ATRITO;
  b.vy *= ATRITO;
  if (b.vx * b.vx + b.vy * b.vy < 0.0025) {
    b.vx = 0;
    b.vy = 0;
  }
  // as paredes de cima e de baixo
  if (b.y < Y0 + R_BOLA) {
    b.y = 2 * (Y0 + R_BOLA) - b.y;
    b.vy = -b.vy * QUIQUE;
    m.eventos.push({ tipo: 'quique' });
  } else if (b.y > Y1 - R_BOLA) {
    b.y = 2 * (Y1 - R_BOLA) - b.y;
    b.vy = -b.vy * QUIQUE;
    m.eventos.push({ tipo: 'quique' });
  }
  // o fundo: fora da boca do gol, a parede; dentro, a rede
  if (px >= X0 && b.x < X0 + R_BOLA && !naBoca(b.y)) {
    b.x = 2 * (X0 + R_BOLA) - b.x;
    b.vx = -b.vx * QUIQUE;
    m.eventos.push({ tipo: 'quique' });
  } else if (px <= X1 && b.x > X1 - R_BOLA && !naBoca(b.y)) {
    b.x = 2 * (X1 - R_BOLA) - b.x;
    b.vx = -b.vx * QUIQUE;
    m.eventos.push({ tipo: 'quique' });
  }
  if (b.x < X0 || b.x > X1) {
    // dentro do gol: as laterais e o fundo da rede seguram a bola
    if (b.y < CY - GOL_MEIA + R_BOLA) {
      b.y = CY - GOL_MEIA + R_BOLA;
      b.vy = -b.vy * 0.3;
    } else if (b.y > CY + GOL_MEIA - R_BOLA) {
      b.y = CY + GOL_MEIA - R_BOLA;
      b.vy = -b.vy * 0.3;
    }
    if (b.x < X0 - GOL_FUNDO + R_BOLA) {
      b.x = X0 - GOL_FUNDO + R_BOLA;
      b.vx = -b.vx * 0.2;
    } else if (b.x > X1 + GOL_FUNDO - R_BOLA) {
      b.x = X1 + GOL_FUNDO - R_BOLA;
      b.vx = -b.vx * 0.2;
    }
  }
  if (contar) {
    if (b.x < X0 - R_BOLA) return 1;
    if (b.x > X1 + R_BOLA) return 0;
  }
  return -1;
}

/** Os jogadores que se encostam se afastam (só os que o passo move: o de fora é da pessoa, e não se empurra). */
function separar(m: Mundo) {
  const js = m.jogadores;
  const min = R_JOGADOR * 2;
  for (let a = 0; a < js.length; a++) {
    for (let k = a + 1; k < js.length; k++) {
      const p = js[a];
      const q = js[k];
      if (p.externo && q.externo) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      const nx = d > 0.001 ? dx / d : 1;
      const ny = d > 0.001 ? dy / d : 0;
      const falta = min - d;
      if (p.externo) {
        q.x += nx * falta;
        q.y += ny * falta;
      } else if (q.externo) {
        p.x -= nx * falta;
        p.y -= ny * falta;
      } else {
        p.x -= nx * falta * 0.5;
        p.y -= ny * falta * 0.5;
        q.x += nx * falta * 0.5;
        q.y += ny * falta * 0.5;
      }
      prenderNoCampo(p);
      prenderNoCampo(q);
    }
  }
}

/** Quem ganha a bola: `id` domina a bola solta (ou a rouba de quem a conduzia). */
export function darBola(m: Mundo, j: Jogador) {
  const b = m.bola;
  const de = b.dono;
  if (de !== 0 && de !== j.id) {
    const antes = jogadorPorId(m, de);
    if (antes) {
      antes.esperaRoubo = ESPERA_ROUBO;
      antes.tonto = TONTO;
      antes.carga = 0;
    }
    m.eventos.push({ tipo: 'roubo', id: j.id, de });
  } else if (de === 0) m.eventos.push({ tipo: 'dominio', id: j.id });
  b.dono = j.id;
  b.protege = PROTEGE;
  b.ultimo = j.id;
}

/** A bola e os corpos: quem conduz a leva na frente; encostar na solta domina (ou desvia, se vem forte); encostar na do outro time rouba. */
export function contatos(m: Mundo) {
  const b = m.bola;
  if (b.dono !== 0) {
    const d = jogadorPorId(m, b.dono);
    if (!d) {
      b.dono = 0;
      return;
    }
    const [x, y] = frenteDe(d);
    b.x = x;
    b.y = y;
    b.vx = d.vx;
    b.vy = d.vy;
    if (b.protege > 0) {
      b.protege--;
      return;
    }
    const perto = (R_JOGADOR + R_BOLA + 2) * (R_JOGADOR + R_BOLA + 2);
    for (const p of m.jogadores) {
      if (p.time === d.time || p.esperaRoubo > 0 || p.semDominio > 0 || (m.centro && p.time !== m.saida)) continue;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      if (dx * dx + dy * dy < perto) {
        darBola(m, p);
        return;
      }
    }
    return;
  }
  const v2 = b.vx * b.vx + b.vy * b.vy;
  for (const p of m.jogadores) {
    if (p.semDominio > 0 || (m.centro && p.time !== m.saida)) continue;
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > ALCANCE * ALCANCE) continue;
    if (v2 <= DOMINIO_MAX * DOMINIO_MAX) {
      darBola(m, p);
      return;
    }
    // forte demais: bate no corpo e desvia
    const d = Math.sqrt(d2);
    const nx = d > 0.001 ? dx / d : 1;
    const ny = d > 0.001 ? dy / d : 0;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= 1.5 * vn * nx;
      b.vy -= 1.5 * vn * ny;
    }
    b.x = p.x + nx * ALCANCE;
    b.y = p.y + ny * ALCANCE;
    b.ultimo = p.id;
    m.eventos.push({ tipo: 'quique' });
    return;
  }
}

/** O gol: o placar, o autor (gol contra não conta para ele) e a pausa até a volta ao meio. */
export function marcarGol(m: Mundo, time: 0 | 1) {
  m.placar[time]++;
  const autor = jogadorPorId(m, m.bola.ultimo);
  const contra = !!autor && autor.time !== time;
  if (autor && !contra) autor.gols++;
  m.eventos.push({ tipo: 'gol', time, autor: autor ? autor.id : 0, contra });
  m.bola.dono = 0;
  m.pausa = GOL_PAUSA;
  m.reinicioEm = GOL_REINICIO;
  m.saida = time === 0 ? 1 : 0;
  for (const j of m.jogadores) j.carga = 0;
}

/**
 * Um passo do mundo. `comando(j)` dá o comando de cada jogador que o passo move (null: ele é movido de fora, ou fica parado).
 * Na pausa (a contagem, o gol), ninguém anda e o relógio não corre.
 */
export function passoDoMundo(m: Mundo, comando: (j: Jogador) => Comando | null) {
  m.eventos = [];
  if (m.fim) return;
  m.tempo++;
  if (m.pausa > 0) {
    m.pausa--;
    if (m.reinicioEm >= 0) {
      if (m.bola.dono === 0) passoDaBola(m, false);
      if (m.pausa <= m.reinicioEm) {
        m.reinicioEm = -1;
        posicionar(m, m.saida);
        m.eventos.push({ tipo: 'reinicio' });
      }
    }
    return;
  }
  m.passo++;
  for (const j of m.jogadores) {
    if (j.externo) continue;
    const c0 = comando(j);
    if (!c0) continue;
    // tonto: não anda nem chuta (a velocidade vai caindo)
    const c = j.tonto > 0 ? NADA : c0;
    passoDoJogador(j, c, m.bola.dono === j.id);
    if (c.chute) {
      if (j.carga < CARGA_MAX) j.carga++;
    } else if (j.carga > 0) {
      const forca = forcaDaCarga(j.carga);
      j.carga = 0;
      if (podeChutar(m, j)) {
        const [vx, vy] = vetorDoChute(j, forca);
        aplicarChute(m, j, vx, vy, false);
      }
    }
    if (c.passe && j.carga === 0 && podeChutar(m, j)) {
      const [vx, vy] = vetorDoPasse(m, j);
      aplicarChute(m, j, vx, vy, true);
    }
  }
  separar(m);
  if (m.centro) for (const j of m.jogadores) if (!j.externo) foraDoCentro(m, j);
  if (m.bola.dono === 0) {
    const gol = passoDaBola(m, true);
    if (gol >= 0) {
      marcarGol(m, gol as 0 | 1);
      return;
    }
  }
  contatos(m);
  if (m.centro) {
    const dx = m.bola.x - CX;
    const dy = m.bola.y - CY;
    if (dx * dx + dy * dy > RAIO_DO_CENTRO * RAIO_DO_CENTRO) m.centro = false;
  }
  for (const j of m.jogadores) {
    if (j.semDominio > 0) j.semDominio--;
    if (j.esperaRoubo > 0) j.esperaRoubo--;
    if (j.tonto > 0) j.tonto--;
  }
  if (m.passo >= PARTIDA_PASSOS) {
    m.fim = true;
    m.eventos.push({ tipo: 'fim' });
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// O ROBÔ: regras simples, que veem só o que uma pessoa ali veria. Vai na bola, conduz para o gol e chuta de perto; com 2 ou
// mais por time, o último da formação fica atrás, entre a bola e o gol; os outros abrem para receber.
// ---------------------------------------------------------------------------------------------------------------------

function ir(j: Jogador, x: number, y: number): Comando {
  const dx = x - j.x;
  const dy = y - j.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 3) return NADA;
  const k = d < 20 ? d / 20 : 1;
  return { dx: (dx / d) * k, dy: (dy / d) * k, chute: false, passe: false };
}

export function comandoDoRobo(m: Mundo, j: Jogador): Comando {
  const b = m.bola;
  const sentido = j.time === 0 ? 1 : -1;
  const golX = j.time === 0 ? X1 : X0;
  const meuGolX = j.time === 0 ? X0 : X1;
  const goleiro = m.porTime >= 2 && j.slot === m.porTime - 1;
  const dist2 = (p: { x: number; y: number }) => (p.x - b.x) * (p.x - b.x) + (p.y - b.y) * (p.y - b.y);

  if (b.dono === j.id) {
    // o goleiro do outro time: chutar no canto do outro lado dele
    let gk: Jogador | null = null;
    for (const p of m.jogadores) if (p.time !== j.time && (!gk || Math.abs(p.x - golX) < Math.abs(gk.x - golX))) gk = p;
    // a mira varia um pouco (pelo relógio, que é igual nos dois lados): às vezes no canto, às vezes para fora
    const mira = 0.3 + (((m.tempo * 37) % 100) / 100) * 0.9;
    const alvoY = CY + (gk && gk.y < CY ? 1 : -1) * GOL_MEIA * mira;
    const gx = golX + sentido * 6 - j.x;
    const gy = alvoY - j.y;
    const dg = Math.sqrt(gx * gx + gy * gy);
    const ux = gx / dg;
    const uy = gy / dg;
    const alinhado = j.fx * ux + j.fy * uy > 0.85;
    if (j.carga > 0) {
      const alvo = dg > 140 ? CARGA_MAX : dg > 90 ? 30 : 16;
      return { dx: ux, dy: uy, chute: j.carga < alvo, passe: false };
    }
    if (dg < 180 && alinhado) return { dx: ux, dy: uy, chute: true, passe: false };
    // marcado de perto, com um companheiro adiante: passa
    let marcado = false;
    for (const p of m.jogadores) {
      if (p.time === j.time) continue;
      const ox = p.x - j.x;
      const oy = p.y - j.y;
      if (ox * ox + oy * oy < 30 * 30 && ox * j.fx + oy * j.fy > 0) marcado = true;
    }
    if (marcado && j.fx * sentido > 0.3) {
      for (const t of m.jogadores) if (t !== j && t.time === j.time && (t.x - j.x) * sentido > 20) return { dx: ux, dy: uy, chute: false, passe: true };
    }
    // alguém do outro time no caminho: desvia para o lado de onde ele não está
    let desvio = 0;
    for (const p of m.jogadores) {
      if (p.time === j.time) continue;
      const ox = p.x - j.x;
      const oy = p.y - j.y;
      const frente = ox * ux + oy * uy;
      const lado = -ox * uy + oy * ux;
      if (frente > 0 && frente < 45 && Math.abs(lado) < 22) desvio = lado > 0 ? -1 : 1;
    }
    if (desvio !== 0) {
      const sx = ux - uy * desvio * 1.2;
      const sy = uy + ux * desvio * 1.2;
      const n = Math.sqrt(sx * sx + sy * sy);
      return { dx: sx / n, dy: sy / n, chute: false, passe: false };
    }
    return { dx: ux, dy: uy, chute: false, passe: false };
  }

  // quem do time (fora o goleiro) está mais perto da bola
  let maisPerto: Jogador | null = null;
  for (const p of m.jogadores) {
    if (p.time !== j.time) continue;
    if (m.porTime >= 2 && p.slot === m.porTime - 1) continue;
    if (!maisPerto || dist2(p) < dist2(maisPerto)) maisPerto = p;
  }
  const doDono = b.dono !== 0 ? jogadorPorId(m, b.dono) : undefined;
  const nossa = !!doDono && doDono.time === j.time;
  const perigo = (b.x - meuGolX) * sentido < 130;

  if (goleiro) {
    // sai do gol na bola que chega perto, e senão fica entre ela e o gol
    if (perigo && !nossa && dist2(j) < 70 * 70) return ir(j, b.x, b.y);
    const kx = meuGolX + sentido * 28;
    // a bola vindo para o gol: onde ela vai passar na linha do goleiro
    if (b.dono === 0 && b.vx * sentido < -1) {
      const py = b.y + (b.vy * (kx - b.x)) / b.vx;
      return ir(j, kx, limitar(py, CY - GOL_MEIA, CY + GOL_MEIA));
    }
    const gy = limitar(CY + (b.y - CY) * 0.45, CY - GOL_MEIA + 6, CY + GOL_MEIA - 6);
    return ir(j, kx, gy);
  }
  if (maisPerto === j && !nossa) {
    // na bola, chegando por trás dela (do lado do próprio gol), para sair conduzindo para o ataque
    const tx = b.x + b.vx * 8;
    const ty = b.y + b.vy * 8;
    const naFrente = (j.x - tx) * sentido > 0;
    if (naFrente && dist2(j) > 14 * 14) return ir(j, tx - sentido * 12, ty + (j.y < ty ? -14 : 14));
    return ir(j, tx - sentido * 3, ty);
  }
  // os outros: abertos e adiante da bola quando ela é nossa; recuados entre a bola e o gol quando é do outro time
  const lado = j.slot % 2 === 0 ? -1 : 1;
  if (nossa) return ir(j, limitar(b.x + sentido * 80, X0 + 40, X1 - 40), limitar(CY + lado * 80, Y0 + 30, Y1 - 30));
  return ir(j, limitar(b.x - sentido * 60, X0 + 40, X1 - 40), limitar(b.y * 0.5 + CY * 0.5 + lado * 30, Y0 + 30, Y1 - 30));
}
