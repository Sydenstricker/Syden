import {
  BIFURCA,
  CADENCIA,
  CARGA,
  CHAO,
  Ficha,
  INVUL_GOLPE,
  LIM_X,
  LIM_Y,
  NASCER,
  PIRUETA_ESPERA,
  PIRUETA_PASSOS,
  RAIO,
  RAIO_ANEL,
  RAIO_ITEM,
  RAIO_NAVE,
  VEL_NAVE,
  VEL_Z,
  VOLEIAS,
  Z_FIM_DO_CHAO,
  balaEncosta,
  chegadaDaTrava,
  passoDoAnel,
  posicaoBala,
  posicaoInimigo,
  posicaoItem,
  roteiro,
  travaPossivel,
  zNave,
  type Arma,
  type Padrao,
  type Ponto,
  type Ramo,
  type Roteiro,
} from './sim';

/**
 * O MUNDO DA ROTA ESTELAR NESTE COMPUTADOR (16/11/2026): a nave de quem joga, as balas, o tiro carregado, a pirueta, os
 * inimigos e os tiros deles, passo a passo. Tudo o que o servidor confere passa pela FICHA (sim.ts, a mesma conta dele): o
 * mundo só descobre o acerto, o item, o anel, a rota, o golpe e a bomba, e guarda o evento para ir no próximo lote.
 *
 * Os TIROS DOS INIMIGOS miram a nave DESTA tela (a de cada um), e por isso moram só aqui: quem leva o golpe é quem diz. Quem
 * não joga (assiste, ou ficou sem vidas) usa o mesmo mundo sem nave, e os inimigos que somem são os de quem ele segue.
 */

export interface Comandos {
  dx: number;
  dy: number;
  /** O tiro está apertado (tocar atira; segurar carrega e trava a mira). */
  fogo: boolean;
  bomba: boolean;
  pirueta: boolean;
}

export interface Bala {
  p: number;
  x: number;
  y: number;
  arma: Arma;
  b: number;
}

/** O tiro carregado a caminho: solto em `p` da nave em (x, y), chega ao inimigo `i` em `q`. */
export interface Trava {
  p: number;
  x: number;
  y: number;
  i: number;
  q: number;
}

/** Um tiro de inimigo: sai em `t` de (x0, y0, z0) com a velocidade (vx, vy, vz) por passo. */
export interface TiroInimigo {
  t: number;
  x0: number;
  y0: number;
  z0: number;
  vx: number;
  vy: number;
  vz: number;
}

export function posicaoTiro(b: TiroInimigo, n: number): Ponto {
  const k = n - b.t;
  return { x: b.x0 + b.vx * k, y: b.y0 + b.vy * k, z: b.z0 + b.vz * k };
}

/** O que só enfeita a tela. */
export interface Efeito {
  tipo: 'explosao' | 'faisca' | 'bomba' | 'golpe' | 'perdeu' | 'pegou' | 'anel' | 'desvio';
  x: number;
  y: number;
  z: number;
  em: number;
  grande?: boolean;
}

/** O que aconteceu no passo, para o som. */
export interface Ocorrido {
  disparou: boolean;
  travou: boolean;
  soltouTrava: boolean;
  derrubou: boolean;
  pegou: boolean;
  anel: boolean;
  golpe: boolean;
  perdeuVida: boolean;
  bomba: boolean;
  pirueta: boolean;
  desviou: boolean;
  chefe: boolean;
}

const arred = (v: number) => Math.round(v * 100) / 100;
const DIRECOES_DO_ANEL: [number, number][] = [
  [1, 0],
  [0.71, 0.71],
  [0, 1],
  [-0.71, 0.71],
  [-1, 0],
  [-0.71, -0.71],
  [0, -1],
  [0.71, -0.71],
];

export class Mundo {
  readonly r: Roteiro;
  readonly ficha: Ficha;
  passo = -1;
  nave = { ...NASCER };
  /** A velocidade da nave no último passo (para o desenho inclinar). */
  vel = { x: 0, y: 0 };
  balas: Bala[] = [];
  travas: Trava[] = [];
  tiros: TiroInimigo[] = [];
  /** Os inimigos na janela de tempo deles agora (vivos ou não). */
  ativos: number[] = [];
  private ordem: number[];
  private proximoInimigo = 0;
  /** Os tiros dos inimigos, em ordem: [passo, inimigo, padrão]. */
  private agenda: [number, number, Padrao][];
  private proximoTiro = 0;
  soltos: [number, number][] = [];
  efeitos: Efeito[] = [];
  eventos: unknown[] = [];
  /** Quantos disparos (voleias e tiros carregados), para a precisão. */
  disparos = 0;
  /** O tiro apertado há quantos passos (0: solto), o disparo esperando a cadência, e o alvo travado. */
  carga = 0;
  private querAtirar = false;
  alvo: number | null = null;
  /** A pirueta: até quando gira, e quando pode girar de novo. */
  piruetaAte = -1;
  piruetaPronta = 0;
  private renascer = false;
  /** Quem não joga: os derrubados e a rota de quem ele segue. */
  vista: Map<number, number> | null = null;
  ramoVisto: Ramo = 0;

  constructor(
    readonly semente: number,
    readonly jogador: boolean,
  ) {
    this.r = roteiro(semente);
    this.ficha = new Ficha(this.r);
    const ini = this.r.inimigos;
    this.ordem = ini.map((_, i) => i).sort((a, b) => ini[a].t - ini[b].t);
    this.agenda = [];
    ini.forEach((e, i) => e.tiros.forEach(([s, padrao]) => this.agenda.push([e.t + s, i, padrao])));
    this.agenda.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }

  get pilotando() {
    return this.jogador && !this.ficha.acabou;
  }
  /** A rota de quem se vê. */
  get ramo(): Ramo {
    return this.pilotando || !this.vista ? this.ficha.ramo : this.ramoVisto;
  }
  doRamo(ramo: Ramo) {
    return ramo === 0 || ramo === this.ramo || (this.ramo === 0 && this.passo < BIFURCA);
  }
  mortoEm(i: number): number | null {
    const m = this.pilotando || !this.vista ? this.ficha.mortos.get(i) : this.vista.get(i);
    return m === undefined ? null : m;
  }
  /** O inimigo está de pé, nesta tela, no passo `n`? */
  dePe(i: number, n: number) {
    const m = this.mortoEm(i);
    return (m === null || m > n) && this.doRamo(this.r.inimigos[i].ramo);
  }
  /** O alvo que o tiro carregado travaria agora: o inimigo do cone mais perto da mira. */
  alvoDaTrava(n: number): number | null {
    let melhor: number | null = null;
    let menor = Infinity;
    for (const i of this.ativos) {
      if (!this.dePe(i, n)) continue;
      const e = this.r.inimigos[i];
      if (!travaPossivel(e, n, this.nave.x, this.nave.y)) continue;
      const a = posicaoInimigo(e, n)!;
      const d = Math.abs(a.x - this.nave.x) + Math.abs(a.y - this.nave.y) + (a.z - zNave(n)) * 0.05;
      if (d < menor) (menor = d), (melhor = i);
    }
    return melhor;
  }

  /** Um passo. `ausente`: a janela está sem foco, e a nave fica parada, sem atirar e sem levar dano. */
  avancar(cmd: Comandos, ausente = false): Ocorrido {
    const n = ++this.passo;
    const f = this.ficha;
    const ini = this.r.inimigos;
    const o: Ocorrido = { disparou: false, travou: false, soltouTrava: false, derrubou: false, pegou: false, anel: false, golpe: false, perdeuVida: false, bomba: false, pirueta: false, desviou: false, chefe: false };

    while (this.proximoInimigo < this.ordem.length && ini[this.ordem[this.proximoInimigo]].t <= n) this.ativos.push(this.ordem[this.proximoInimigo++]);
    this.ativos = this.ativos.filter((i) => ini[i].t + ini[i].dur >= n);

    const pilota = this.pilotando && !ausente;
    const zn = zNave(n);
    if (this.renascer) {
      this.renascer = false;
      this.nave = { ...NASCER };
    }
    this.vel = { x: 0, y: 0 };
    if (pilota) {
      if (cmd.dx || cmd.dy) {
        const k = cmd.dx && cmd.dy ? Math.SQRT1_2 : 1;
        const nx = arred(Math.max(-LIM_X, Math.min(LIM_X, this.nave.x + Math.sign(cmd.dx) * VEL_NAVE * k)));
        const ny = arred(Math.max(-LIM_Y, Math.min(LIM_Y, this.nave.y + Math.sign(cmd.dy) * VEL_NAVE * k)));
        this.vel = { x: nx - this.nave.x, y: ny - this.nave.y };
        this.nave = { x: nx, y: ny };
      }
      // a rota: o lado em que a nave está na bifurcação
      if (n === BIFURCA && f.ramo === 0 && f.rota(n, this.nave.x, this.nave.y) === null) this.eventos.push(['v', n, this.nave.x, this.nave.y]);

      // os itens
      this.soltos = this.soltos.filter(([i, q]) => {
        if (f.pegos.has(i)) return false;
        const pos = posicaoItem(ini[i], q, n);
        if (!pos) return false;
        const dx = pos.x - this.nave.x, dy = pos.y - this.nave.y, dz = pos.z - zn;
        const r = RAIO_ITEM + RAIO_NAVE;
        if (dx * dx + dy * dy + dz * dz <= r * r && f.pegar(n, i, this.nave.x, this.nave.y) === null) {
          this.eventos.push(['g', n, i, this.nave.x, this.nave.y]);
          this.efeitos.push({ tipo: 'pegou', x: this.nave.x, y: this.nave.y, z: zn, em: n });
          o.pegou = true;
          return false;
        }
        return true;
      });

      // os anéis cruzados neste passo
      this.r.aneis.forEach((a, k) => {
        if (passoDoAnel(a) !== n || f.aneis.has(k) || !this.doRamo(a.ramo)) return;
        const dx = a.x - this.nave.x, dy = a.y - this.nave.y;
        if (dx * dx + dy * dy <= RAIO_ANEL * RAIO_ANEL && f.anel(n, k, this.nave.x, this.nave.y) === null) {
          this.eventos.push(['n', n, k, this.nave.x, this.nave.y]);
          this.efeitos.push({ tipo: 'anel', x: a.x, y: a.y, z: a.z, em: n, grande: a.ouro });
          o.anel = true;
        }
      });

      if (cmd.bomba && f.bombas > 0) {
        const antes = new Set(f.mortos.keys());
        const dano = new Map(f.dano);
        if (f.bomba(n, this.nave.x, this.nave.y) === null) {
          this.eventos.push(['b', n, this.nave.x, this.nave.y]);
          this.tiros = [];
          this.efeitos.push({ tipo: 'bomba', x: this.nave.x, y: this.nave.y, z: zn + 26, em: n });
          o.bomba = true;
          for (const i of f.mortos.keys()) if (!antes.has(i)) this.caiu(i, n, o);
          for (const [i, d] of f.dano) if (d !== dano.get(i)) this.efeitos.push({ tipo: 'faisca', ...posicaoInimigo(ini[i], n)!, em: n, grande: true });
        }
      }

      if (cmd.pirueta && n >= this.piruetaPronta) {
        this.piruetaAte = n + PIRUETA_PASSOS;
        this.piruetaPronta = this.piruetaAte + PIRUETA_ESPERA;
        o.pirueta = true;
      }

      // o tiro: apertar atira (no próximo passo da cadência); segurar carrega e trava; soltar carregado manda o tiro travado
      if (cmd.fogo) {
        if (this.carga === 0) this.querAtirar = true;
        this.carga++;
        if (this.carga >= CARGA) {
          const antes = this.alvo;
          this.alvo = this.alvoDaTrava(n);
          if (this.alvo !== null && antes !== this.alvo) o.travou = true;
        }
      } else {
        if (this.carga >= CARGA && this.alvo !== null && n - f.ultimaTrava >= CARGA) {
          const i = this.alvo;
          if (travaPossivel(ini[i], n, this.nave.x, this.nave.y)) {
            this.travas.push({ p: n, x: this.nave.x, y: this.nave.y, i, q: chegadaDaTrava(ini[i], n, this.nave.x, this.nave.y) });
            this.disparos++;
            o.soltouTrava = true;
          }
        }
        this.carga = 0;
        this.alvo = null;
      }
      if (this.querAtirar && n % CADENCIA === 0) {
        this.querAtirar = false;
        const arma = f.armaEm(n);
        for (let b = 0; b < VOLEIAS[arma].length; b++) this.balas.push({ p: n, x: this.nave.x, y: this.nave.y, arma, b });
        this.disparos++;
        o.disparou = true;
      }
    } else {
      this.carga = 0;
      this.alvo = null;
      this.querAtirar = false;
    }

    // as balas: a primeira que encosta num inimigo de pé é o acerto (a mesma conta do servidor)
    this.balas = this.balas.filter((bala) => {
      const pos = posicaoBala(bala.p, bala.x, bala.y, bala.arma, bala.b, n);
      if (!pos) return false;
      if (!this.jogador || f.chefeEm !== null) return true;
      for (const i of this.ativos) {
        if (f.mortos.has(i) || !f.doMeuRamo(ini[i].ramo)) continue;
        const e = ini[i];
        const alvo = posicaoInimigo(e, n);
        if (!alvo || !balaEncosta(alvo, pos, RAIO[e.tipo])) continue;
        if (f.acerto(n, i, bala.p, bala.x, bala.y, bala.arma, bala.b) !== null) return false;
        this.eventos.push(['a', n, i, bala.p, bala.x, bala.y, bala.arma, bala.b]);
        if (f.mortos.has(i)) this.caiu(i, n, o);
        else this.efeitos.push({ tipo: 'faisca', x: pos.x, y: pos.y, z: alvo.z, em: n });
        return false;
      }
      return true;
    });

    // os tiros travados que chegam
    this.travas = this.travas.filter((tv) => {
      if (tv.q > n) return true;
      if (this.jogador && f.travado(n, tv.i, tv.p, tv.x, tv.y) === null) {
        this.eventos.push(['t', n, tv.i, tv.p, tv.x, tv.y]);
        const pos = posicaoInimigo(ini[tv.i], n)!;
        if (f.mortos.has(tv.i)) this.caiu(tv.i, n, o);
        else this.efeitos.push({ tipo: 'faisca', ...pos, em: n, grande: true });
      }
      return false;
    });

    // os tiros dos inimigos: só atira quem está de pé nesta tela e à frente da nave, mirando onde a nave vai estar
    while (this.proximoTiro < this.agenda.length && this.agenda[this.proximoTiro][0] <= n) {
      const [t, i, padrao] = this.agenda[this.proximoTiro++];
      if (t < n - 2 || !this.dePe(i, n)) continue;
      const e = ini[i];
      const de = posicaoInimigo(e, n);
      if (!de || de.z - zn < 8 || de.z - zn > 170) continue;
      this.atirar(de, padrao, e.vt, n);
    }
    this.tiros = this.tiros.filter((tiro) => {
      const p = posicaoTiro(tiro, n);
      return p.z > zNave(n) - 4 && n - tiro.t < 400;
    });

    // o golpe: quem leva é quem diz (tiro 10, o corpo de um inimigo 15, um obstáculo 20); girando, o tiro é desviado
    if (pilota) {
      const { x, y } = this.nave;
      const girando = n < this.piruetaAte;
      let golpe = 0;
      this.tiros = this.tiros.filter((tiro) => {
        const p = posicaoTiro(tiro, n);
        const a = posicaoTiro(tiro, n - 1);
        const rel = p.z - zn;
        const relAntes = a.z - zNave(n - 1);
        const r = RAIO_NAVE + 0.5;
        if (!(relAntes >= -r && rel <= r) || (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) > r * r) return true;
        if (girando) {
          this.efeitos.push({ tipo: 'desvio', x: p.x, y: p.y, z: zn + 1, em: n });
          o.desviou = true;
          return false;
        }
        golpe = Math.max(golpe, 10);
        return false;
      });
      for (const i of this.ativos) {
        if (f.mortos.has(i) || !f.doMeuRamo(ini[i].ramo)) continue;
        const p = posicaoInimigo(ini[i], n);
        const r = RAIO_NAVE + RAIO[ini[i].tipo] * 0.8;
        if (p && (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) + (p.z - zn) * (p.z - zn) <= r * r) golpe = Math.max(golpe, 15);
      }
      for (const ob of this.r.obstaculos) {
        if (Math.abs(ob.z - zn) > ob.fundo + 0.3 || !f.doMeuRamo(ob.ramo)) continue;
        if (Math.abs(x - ob.x) <= ob.raio + RAIO_NAVE * 0.7 && y >= ob.y0 - RAIO_NAVE * 0.7 && y <= ob.y1 + RAIO_NAVE * 0.7) golpe = 20;
      }
      if (zn < Z_FIM_DO_CHAO && y < CHAO + 1) golpe = Math.max(golpe, 15);
      if (golpe && n >= f.invulAte) {
        const vidas = f.vidas;
        if (f.atingida(n, x, y, golpe) === null) {
          this.eventos.push(['d', n, x, y, golpe]);
          if (f.vidas < vidas) {
            o.perdeuVida = true;
            this.efeitos.push({ tipo: 'perdeu', x, y, z: zn, em: n, grande: true });
            this.balas = [];
            this.travas = [];
            this.tiros = [];
            if (f.morteFinal === null) this.renascer = true;
          } else {
            o.golpe = true;
            this.efeitos.push({ tipo: 'golpe', x, y, z: zn, em: n });
          }
        }
      }
    }

    this.efeitos = this.efeitos.filter((e) => n - e.em < 45);
    return o;
  }

  /** O inimigo atira, mirando à frente de onde a nave estará quando o tiro chegar. */
  private atirar(de: Ponto, padrao: Padrao, vt: number, n: number) {
    const alvoZ = (d: number) => zNave(n) + (VEL_Z * d) / (vt + VEL_Z);
    const um = (ox: number, oy: number) => {
      const tx = this.nave.x + ox;
      const ty = this.nave.y + oy;
      const dist = Math.sqrt((tx - de.x) * (tx - de.x) + (ty - de.y) * (ty - de.y) + (de.z - zNave(n)) * (de.z - zNave(n)));
      const tz = alvoZ(dist);
      const dx = tx - de.x, dy = ty - de.y, dz = tz - de.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      this.tiros.push({ t: n, x0: de.x, y0: de.y, z0: de.z, vx: (dx / d) * vt, vy: (dy / d) * vt, vz: (dz / d) * vt });
    };
    if (padrao === 'mira') um(0, 0);
    else if (padrao === 'leque') for (const ox of [-5, -2.5, 0, 2.5, 5]) um(ox, 0);
    else if (padrao === 'chuva') for (const ox of [-9, -4.5, 0, 4.5, 9]) um(ox, 3);
    else for (const [dx, dy] of DIRECOES_DO_ANEL) um(dx * 4, dy * 4);
  }

  private caiu(i: number, n: number, o: Ocorrido) {
    const e = this.r.inimigos[i];
    const p = posicaoInimigo(e, n);
    o.derrubou = true;
    if (e.tipo === 'chefe') o.chefe = true;
    if (p) this.efeitos.push({ tipo: 'explosao', ...p, em: n, grande: e.tipo === 'cargueiro' || e.tipo === 'subchefe' || e.tipo === 'chefe' });
    if (e.item) this.soltos.push([i, n]);
  }

  /** Quem segue alguém (sem nave): os derrubados e a rota dessa pessoa. */
  seguir(mortos: Map<number, number> | null, ramo: Ramo) {
    this.vista = mortos;
    this.ramoVisto = ramo;
  }

  /** Piscando (golpe ou vida nova)? */
  piscando(n = this.passo) {
    return n < this.ficha.invulAte && this.ficha.invulAte - n <= INVUL_GOLPE * 4;
  }
}
