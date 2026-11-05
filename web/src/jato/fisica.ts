import { naLinha, pontoMaisPerto, pontoNaLinha, type PistaDoJato } from './pista';

/**
 * A FÍSICA DOS COELHOS A JATO (05/11/2026): a corrida antigravidade dos 16 bits, só a mecânica. Bem mais rápida que o kart
 * (o teto é o dobro), a nave flutua, inclina na curva e escorrega um pouco. Não há grama: fora da pista é o vazio. Na maior
 * parte da volta a BORDA DE ENERGIA empurra a nave de volta e cobra energia; nos trechos abertos, quem sai cai, e o trilho a
 * devolve ao meio da pista, devagar (é a perda de tempo).
 *
 * A ENERGIA é a vida e o turbo ao mesmo tempo: bater na borda gasta, o turbo (da segunda volta em diante) gasta, a faixa de
 * recarga devolve. Zerou, a nave explode e fica fora da corrida.
 *
 * Como no kart, o passo é FIXO (60 por segundo) e o tempo é o número de passos. O fantasma guarda as POSIÇÕES, uma a cada 4
 * passos, no mesmo formato do kart (x e y em décimos, o ângulo em milésimos): o servidor confere como confere o do kart
 * (server/src/jato.ts).
 */

export const PASSO = 1 / 60;
export const VMAX = 290;
export const VTURBO = 430;
export const AMOSTRA = 4;
export const ENERGIA_MAXIMA = 100;
/** O turbo do botão: quanto dura (s) e quanto custa. */
export const TEMPO_DO_TURBO = 1;
export const CUSTO_DO_TURBO = 12;
/** A placa de impulso: quanto dura (s), de graça. */
export const TEMPO_DA_PLACA = 0.7;
/** A recarga: energia por segundo, na faixa do meio. */
export const RECARGA = 34;
/** Quanto a nave fica caindo (s) e quantos passos o trilho leva para trazê-la de volta. */
export const TEMPO_DA_QUEDA = 0.8;
export const PASSOS_DO_RESGATE = 36;
/** O raio da nave contra a borda. */
const RAIO = 5;
/** O quanto a nave vira por segundo, a toda (com o freio de ar, mais, e perdendo velocidade). */
export const GIRO = 3.0;
export const GIRO_COM_FREIO = 4.2;

export interface ComandosDoJato {
  acelera: boolean;
  freia: boolean;
  /** −1 esquerda, 0, 1 direita. */
  vira: number;
  /** O botão do turbo (vale na hora em que desce). */
  turbo: boolean;
  /** O freio de ar: a curva fecha mais, e a nave perde um pouco de velocidade. */
  freioDeAr: boolean;
}

export interface Nave {
  x: number;
  y: number;
  /** Para onde a nave aponta (o desenho). */
  angulo: number;
  /** Para onde ela anda (fica um pouco atrás do ângulo: a nave escorrega na curva). */
  rumo: number;
  v: number;
  energia: number;
  /** Turbo que falta (s), do botão ou da placa. */
  turbo: number;
  /** A inclinação (−1 a 1), para o desenho: segue o direcional. */
  banco: number;
  indice: number;
  volta: number;
  meio: boolean;
  voltas: number[];
  passos: number;
  terminou: boolean;
  explodiu: boolean;
  /** Caindo (s que faltam), e depois o resgate (passos que faltam), de onde e para onde. */
  caindo: number;
  resgate: number;
  de: { x: number; y: number; angulo: number } | null;
  para: { x: number; y: number; angulo: number } | null;
  /** O s da linha do meio do último lugar seguro (o resgate volta um pouco antes dele). */
  seguro: number;
  /** Bateu na borda neste passo (para tremer, faiscar e tocar). */
  bateu: boolean;
  /** Estava encostado na borda no passo anterior (a primeira batida cobra mais que o raspar). */
  encostado: boolean;
  /** Pegou uma placa neste passo / está na recarga / usou o turbo neste passo / completou uma volta neste passo. */
  placa: boolean;
  recarga: boolean;
  usouTurbo: boolean;
  fezVolta: boolean;
  turboAntes: boolean;
  /** Quanto caiu (para o desenho: a nave encolhe e escurece lá embaixo). */
  queda: number;
}

export function novaNave(p: PistaDoJato): Nave {
  const { x, y, angulo, indice } = p.largada;
  return {
    x, y, angulo, rumo: angulo, v: 0, energia: ENERGIA_MAXIMA, turbo: 0, banco: 0, indice, volta: 0, meio: false, voltas: [], passos: 0,
    terminou: false, explodiu: false, caindo: 0, resgate: 0, de: null, para: null, seguro: p.la[indice], bateu: false, encostado: false,
    placa: false, recarga: false, usouTurbo: false, fezVolta: false, turboAntes: false, queda: 0,
  };
}

export const normal = (a: number) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};
const giraPara = (a: number, b: number, max: number) => a + Math.max(-max, Math.min(max, normal(b - a)));

/** O turbo do botão está liberado? Da segunda volta em diante, sem outro turbo andando, e com energia para pagar. */
export const turboLiberado = (n: Nave) => n.volta >= 1 && n.turbo <= 0 && n.energia > CUSTO_DO_TURBO && !n.terminou && !n.explodiu;

export function passo(n: Nave, c: ComandosDoJato, p: PistaDoJato): void {
  const dt = PASSO;
  n.bateu = false;
  n.placa = false;
  n.recarga = false;
  n.usouTurbo = false;
  n.fezVolta = false;
  if (n.explodiu) {
    n.v = 0;
    return;
  }
  if (n.terminou) c = { acelera: false, freia: false, vira: 0, turbo: false, freioDeAr: false };
  n.passos++;

  // CAINDO: a nave segue um pouco para fora, perde velocidade e desce; depois o trilho a traz de volta ao meio da pista
  if (n.caindo > 0) {
    n.caindo = Math.max(0, n.caindo - dt);
    n.v *= 1 - 2.4 * dt;
    n.x += Math.cos(n.rumo) * n.v * dt;
    n.y += Math.sin(n.rumo) * n.v * dt;
    n.queda += dt;
    if (n.caindo === 0) {
      const q = pontoNaLinha(p, n.seguro - 30);
      n.de = { x: n.x, y: n.y, angulo: n.angulo };
      n.para = { x: q.x, y: q.y, angulo: Math.atan2(q.dy, q.dx) };
      n.resgate = PASSOS_DO_RESGATE;
    }
    n.turboAntes = c.turbo;
    return;
  }
  if (n.resgate > 0) {
    n.resgate--;
    const t = 1 - n.resgate / PASSOS_DO_RESGATE;
    const e = t * t * (3 - 2 * t);
    n.x = n.de!.x + (n.para!.x - n.de!.x) * e;
    n.y = n.de!.y + (n.para!.y - n.de!.y) * e;
    n.angulo = n.de!.angulo + normal(n.para!.angulo - n.de!.angulo) * e;
    n.rumo = n.angulo;
    n.queda = Math.max(0, 1 - t) * TEMPO_DA_QUEDA;
    n.v = 0;
    // o ponto da linha do meio acompanha o resgate (o progresso volta aos poucos, e não de uma vez)
    n.indice = pontoMaisPerto(p, n.x, n.y, n.indice, 40);
    if (n.resgate === 0) {
      n.queda = 0;
      n.v = 60;
    }
    n.turboAntes = c.turbo;
    return;
  }

  const aqui = naLinha(p, n.x, n.y, n.indice);
  const f = aqui.s / p.comprimento;
  // AS PLACAS DE IMPULSO e a RECARGA: pelo lugar na linha do meio
  for (const [pf, pl] of p.def.placas) {
    const ds = aqui.s - pf * p.comprimento, dl = aqui.lado - pl * p.def.meiaLargura;
    if (ds >= 0 && ds < 22 && Math.abs(dl) < 12) {
      if (n.turbo < TEMPO_DA_PLACA) n.placa = true;
      n.turbo = Math.max(n.turbo, TEMPO_DA_PLACA);
    }
  }
  if (p.def.recargas.some(([a, b]) => f >= a && f <= b) && Math.abs(aqui.lado) < p.def.meiaLargura * 0.4 && !n.terminou) {
    n.recarga = true;
    n.energia = Math.min(ENERGIA_MAXIMA, n.energia + RECARGA * dt);
  }
  // O TURBO DO BOTÃO: na hora em que ele desce
  if (c.turbo && !n.turboAntes && turboLiberado(n)) {
    n.turbo = TEMPO_DO_TURBO;
    n.energia -= CUSTO_DO_TURBO;
    n.usouTurbo = true;
  }
  n.turboAntes = c.turbo;

  // A VELOCIDADE
  const teto = n.turbo > 0 ? VTURBO : VMAX;
  if (n.turbo > 0) n.turbo = Math.max(0, n.turbo - dt);
  if (c.acelera && !c.freia) {
    if (n.v < teto) n.v += (teto - n.v) * (n.turbo > 0 ? 3 : 0.75) * dt + (n.v < 40 ? 40 * dt : 0);
    else n.v -= Math.min(n.v - teto, 220 * dt);
  } else if (c.freia) {
    n.v = Math.max(0, n.v - 320 * dt);
  } else {
    n.v -= Math.min(n.v, 60 * dt);
  }
  if (n.v > teto && !c.acelera) n.v -= Math.min(n.v - teto, 220 * dt);
  if (c.freioDeAr && c.vira !== 0) n.v -= Math.min(n.v, 70 * dt);

  // A DIREÇÃO: parada não vira; o freio de ar fecha a curva. A nave inclina para o lado da curva (o desenho).
  const forca = Math.min(1, n.v / 80);
  n.angulo = normal(n.angulo + c.vira * (c.freioDeAr ? GIRO_COM_FREIO : GIRO) * forca * dt);
  n.rumo = normal(giraPara(n.rumo, n.angulo, (c.freioDeAr ? 5 : 7) * dt));
  n.banco += (c.vira - n.banco) * Math.min(1, 9 * dt);

  // ANDAR
  n.x += Math.cos(n.rumo) * n.v * dt;
  n.y += Math.sin(n.rumo) * n.v * dt;
  n.indice = pontoMaisPerto(p, n.x, n.y, n.indice);
  const l = naLinha(p, n.x, n.y, n.indice);
  const hw = p.def.meiaLargura;
  if (!l.aberto && Math.abs(l.lado) > hw - RAIO) {
    // A BORDA DE ENERGIA: devolve a nave para dentro, rebate a parte da velocidade que ia para fora, e cobra energia
    const sinal = Math.sign(l.lado);
    const fora = Math.abs(l.lado) - (hw - RAIO);
    n.x -= -l.dy * sinal * fora;
    n.y -= l.dx * sinal * fora;
    const vx = Math.cos(n.rumo) * n.v, vy = Math.sin(n.rumo) * n.v;
    const nx = -l.dy * sinal, ny = l.dx * sinal;
    const vn = vx * nx + vy * ny;
    if (vn > 0) {
      const rx = vx - nx * vn * 1.35, ry = vy - ny * vn * 1.35;
      n.v = Math.hypot(rx, ry) * 0.94;
      n.rumo = Math.atan2(ry, rx);
      n.angulo = giraPara(n.angulo, n.rumo, 0.25);
      n.energia -= (n.encostado ? 0.08 : 3) + vn * 0.07;
      n.bateu = !n.encostado;
    }
    n.encostado = true;
  } else {
    n.encostado = false;
    if (l.aberto && Math.abs(l.lado) > hw + 4) {
      // fora da pista, sem borda: caiu
      n.caindo = TEMPO_DA_QUEDA;
      n.queda = 0;
      n.turbo = 0;
    } else if (Math.abs(l.lado) < hw - 8) {
      n.seguro = l.s;
    }
  }
  if (n.energia <= 0) {
    n.energia = 0;
    n.explodiu = true;
    n.v = 0;
    return;
  }

  // A VOLTA: como no kart, a linha de chegada é o ponto 0 da linha do meio; conta quando a nave passa por ela para a
  // frente, tendo passado pela metade da pista
  const total = p.lx.length;
  const antes = aqui.s;
  if (n.indice > total * 0.4 && n.indice < total * 0.6) n.meio = true;
  const agoraS = p.la[n.indice];
  if (antes > p.comprimento * 0.8 && agoraS < p.comprimento * 0.2 && n.meio && !n.terminou) {
    n.volta++;
    n.meio = false;
    n.voltas.push(n.passos);
    n.fezVolta = true;
    if (n.volta >= p.def.voltas) n.terminou = true;
  }
}

/**
 * A posição na corrida: voltas completas mais a fração da volta atual. Antes da primeira passagem pela linha (a largada fica
 * 100 antes dela), é negativa: senão quem acabou de largar pareceria uma volta inteira na frente de quem já passou.
 */
export const progresso = (n: Nave, p: PistaDoJato) => {
  const f = p.la[n.indice] / p.comprimento;
  return n.volta + (n.volta === 0 && !n.meio && f > 0.5 ? f - 1 : f);
};

/** O fantasma: x, y (em décimos) e o ângulo (em milésimos de radiano), um trio a cada AMOSTRA passos. */
export function amostrar(n: Nave, fantasma: number[]) {
  if ((n.passos - 1) % AMOSTRA === 0) fantasma.push(Math.round(n.x * 10), Math.round(n.y * 10), Math.round(n.angulo * 1000));
}

/**
 * O PILOTO AUTOMÁTICO (testes e e2e, nunca quem joga): mira um ponto da linha do meio à frente (mais longe quanto mais
 * rápido), freia antes das curvas fechadas pela curvatura, usa o turbo nas retas com energia sobrando, e passa pela
 * recarga quando ela está no caminho.
 */
export function pilotoAutomatico(n: Nave, p: PistaDoJato): ComandosDoJato {
  const total = p.lx.length;
  const aqui = naLinha(p, n.x, n.y, n.indice);
  // o rumo que se quer: o da pista um pouco à frente, puxado de volta para o meio pelo quanto a nave está de lado
  const q = pontoNaLinha(p, aqui.s + 20 + n.v * 0.12);
  const desejado = Math.atan2(q.dy, q.dx) - Math.max(-0.6, Math.min(0.6, aqui.lado * 0.025));
  const dif = normal(desejado - n.rumo);
  // a curva mais fechada que vem pela frente decide a velocidade que dá para levar
  let kmax = 0;
  for (let k = 0; k < 16 + n.v / 7; k += 2) kmax = Math.max(kmax, p.curva[(n.indice + k) % total]);
  const freio = kmax * n.v > GIRO * 0.95;
  const limite = kmax > 0 ? (freio ? GIRO_COM_FREIO : GIRO) / kmax : VTURBO;
  return {
    acelera: n.v < limite * 0.92,
    freia: n.v > limite * 1.15,
    vira: Math.max(-1, Math.min(1, dif / 0.08)),
    turbo: kmax < 0.004 && n.energia > 45 && n.v > 220,
    freioDeAr: freio && Math.abs(dif) > 0.02,
  };
}
