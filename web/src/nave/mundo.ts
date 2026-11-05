import {
  ALTURA,
  CADENCIA,
  Ficha,
  LARGURA,
  NASCER,
  RAIO,
  RAIO_BALA,
  RAIO_ITEM,
  RAIO_NAVE,
  RAIO_TIRO,
  VEL_NAVE,
  VOLEIAS,
  posicaoBala,
  posicaoInimigo,
  posicaoItem,
  posicaoTiro,
  roteiro,
  tirosDosInimigos,
  type Arma,
  type Inimigo,
  type TiroInimigo,
} from './sim';

/**
 * O MUNDO DA ESQUADRILHA NESTE COMPUTADOR (05/11/2026): a nave de quem joga, as balas, os inimigos e os tiros deles, passo a
 * passo. Tudo o que o servidor confere passa pela FICHA (sim.ts, a mesma conta dele): o mundo só descobre o acerto, o item, o
 * golpe e a bomba, e guarda o evento para ir no próximo lote.
 *
 * Quem não joga (assiste, ou ficou sem vidas) usa o mesmo mundo sem nave, e os inimigos que somem são os derrubados por quem
 * ele segue (`vista`).
 */

export interface Comandos {
  dx: number;
  dy: number;
  fogo: boolean;
  bomba: boolean;
  /** No toque: o lugar para onde o dedo leva a nave (ela vai até lá na velocidade dela). */
  alvo?: { x: number; y: number } | null;
}

export interface Bala {
  p: number;
  x: number;
  y: number;
  arma: Arma;
  b: number;
}

/** O que só enfeita a tela: explosões, faíscas e o clarão da bomba. */
export interface Efeito {
  tipo: 'explosao' | 'faisca' | 'bomba' | 'escudo' | 'pegou' | 'perdeu';
  x: number;
  y: number;
  em: number;
  grande?: boolean;
}

/** O que aconteceu no passo, para o som. */
export interface Ocorrido {
  disparou: boolean;
  acertou: boolean;
  derrubou: boolean;
  pegou: boolean;
  perdeuVida: boolean;
  escudo: boolean;
  bomba: boolean;
  chefe: boolean;
}

const arred = (v: number) => Math.round(v * 100) / 100;
const perto = (a: { x: number; y: number }, x: number, y: number, raio: number) => (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y) <= raio * raio;

export class Mundo {
  readonly inimigos: Inimigo[];
  readonly tiros: TiroInimigo[];
  readonly ficha: Ficha;
  /** O último passo simulado (−1: ainda não começou). */
  passo = -1;
  nave = { ...NASCER };
  balas: Bala[] = [];
  /** Os tiros dos inimigos na tela agora. */
  tirosAtivos: TiroInimigo[] = [];
  private proximoTiro = 0;
  /** Os inimigos na janela de tempo deles agora (vivos ou não). */
  ativos: number[] = [];
  private ordem: number[];
  private proximoInimigo = 0;
  /** Os tiros que saíram até este passo foram limpos pela bomba. */
  limpoAte = -1;
  /** Os itens soltos ainda não pegos: [quem soltou, quando caiu]. */
  soltos: [number, number][] = [];
  efeitos: Efeito[] = [];
  /** Os eventos ainda não mandados ao servidor. */
  eventos: unknown[] = [];
  private renascer = false;
  /** Quem não joga: os derrubados de quem ele segue (null: ninguém some). */
  vista: Map<number, number> | null = null;

  constructor(
    readonly semente: number,
    readonly jogador: boolean,
  ) {
    this.inimigos = roteiro(semente);
    this.tiros = tirosDosInimigos(this.inimigos);
    this.ficha = new Ficha(this.inimigos);
    this.ordem = this.inimigos.map((_, i) => i).sort((a, b) => this.inimigos[a].t - this.inimigos[b].t);
  }

  /** Está pilotando agora (joga, tem vida, e não derrubou o chefe ainda)? */
  get pilotando() {
    return this.jogador && !this.ficha.acabou;
  }

  /** Quando o inimigo `i` caiu, na tela de quem se vê (null: está de pé). */
  mortoEm(i: number): number | null {
    const m = this.pilotando || !this.vista ? this.ficha.mortos.get(i) : this.vista.get(i);
    return m === undefined ? null : m;
  }

  /** Um passo. `ausente`: a janela está sem foco, e a nave fica parada, sem atirar e sem levar dano. */
  avancar(cmd: Comandos, ausente = false): Ocorrido {
    const n = ++this.passo;
    const f = this.ficha;
    const o: Ocorrido = { disparou: false, acertou: false, derrubou: false, pegou: false, perdeuVida: false, escudo: false, bomba: false, chefe: false };

    // os inimigos que entram e os que saem
    while (this.proximoInimigo < this.ordem.length && this.inimigos[this.ordem[this.proximoInimigo]].t <= n) this.ativos.push(this.ordem[this.proximoInimigo++]);
    this.ativos = this.ativos.filter((i) => this.inimigos[i].t + this.inimigos[i].dur >= n);

    const pilota = this.pilotando && !ausente;
    if (this.renascer) {
      this.renascer = false;
      this.nave = { ...NASCER };
    }
    if (pilota) {
      // andar: as setas (a diagonal anda o mesmo que a reta) ou o dedo
      let vx = 0;
      let vy = 0;
      if (cmd.alvo) {
        const dx = cmd.alvo.x - this.nave.x;
        const dy = cmd.alvo.y - this.nave.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.5) {
          const k = Math.min(VEL_NAVE, d) / d;
          vx = dx * k;
          vy = dy * k;
        }
      } else if (cmd.dx || cmd.dy) {
        const k = cmd.dx && cmd.dy ? Math.SQRT1_2 : 1;
        vx = Math.sign(cmd.dx) * VEL_NAVE * k;
        vy = Math.sign(cmd.dy) * VEL_NAVE * k;
      }
      this.nave = {
        x: arred(Math.max(6, Math.min(LARGURA - 6, this.nave.x + vx))),
        y: arred(Math.max(10, Math.min(ALTURA - 8, this.nave.y + vy))),
      };

      // os itens que estão caindo (antes do disparo: a arma nova vale já neste passo)
      this.soltos = this.soltos.filter(([i, q]) => {
        if (f.pegos.has(i)) return false;
        const pos = posicaoItem(this.inimigos[i], q, n);
        if (!pos) return false;
        if (perto(pos, this.nave.x, this.nave.y, RAIO_ITEM + RAIO_NAVE) && f.pegar(n, i, this.nave.x, this.nave.y) === null) {
          this.eventos.push(['g', n, i, this.nave.x, this.nave.y]);
          this.efeitos.push({ tipo: 'pegou', x: this.nave.x, y: this.nave.y, em: n });
          o.pegou = true;
          return false;
        }
        return true;
      });

      if (cmd.bomba && f.bombas > 0) {
        const antes = new Set(f.mortos.keys());
        if (f.bomba(n, this.nave.x, this.nave.y) === null) {
          this.eventos.push(['b', n, this.nave.x, this.nave.y]);
          this.limpoAte = n;
          this.tirosAtivos = [];
          this.efeitos.push({ tipo: 'bomba', x: this.nave.x, y: this.nave.y, em: n });
          o.bomba = true;
          for (const i of f.mortos.keys()) if (!antes.has(i)) this.caiu(i, n, o);
        }
      }

      if (cmd.fogo && n % CADENCIA === 0) {
        const arma = f.armaEm(n);
        for (let b = 0; b < VOLEIAS[arma].length; b++) this.balas.push({ p: n, x: this.nave.x, y: this.nave.y, arma, b });
        o.disparou = true;
      }
    }

    // as balas: a primeira que encosta num inimigo de pé é o acerto (a mesma conta do servidor)
    this.balas = this.balas.filter((bala) => {
      const pos = posicaoBala(bala.p, bala.x, bala.y, bala.arma, bala.b, n);
      if (!pos) return false;
      if (!this.jogador || f.chefeEm !== null) return true;
      for (const i of this.ativos) {
        if (f.mortos.has(i)) continue;
        const e = this.inimigos[i];
        const alvo = posicaoInimigo(e, n);
        if (!alvo || !perto(alvo, pos.x, pos.y, RAIO[e.tipo] + RAIO_BALA)) continue;
        if (f.acerto(n, i, bala.p, bala.x, bala.y, bala.arma, bala.b) !== null) return false;
        this.eventos.push(['a', n, i, bala.p, bala.x, bala.y, bala.arma, bala.b]);
        o.acertou = true;
        if (f.mortos.has(i)) this.caiu(i, n, o);
        else this.efeitos.push({ tipo: 'faisca', x: pos.x, y: pos.y, em: n });
        return false;
      }
      return true;
    });

    // os tiros dos inimigos: só sai o de quem está de pé (nesta tela), e a bomba limpa os que já tinham saído
    while (this.proximoTiro < this.tiros.length && this.tiros[this.proximoTiro].t <= n) {
      const tiro = this.tiros[this.proximoTiro++];
      const morto = this.mortoEm(tiro.dono);
      if ((morto !== null && morto <= tiro.t) || tiro.t <= this.limpoAte) continue;
      this.tirosAtivos.push(tiro);
    }
    this.tirosAtivos = this.tirosAtivos.filter((tiro) => posicaoTiro(tiro, n) !== null);

    // o golpe: quem leva é quem diz
    if (pilota && n >= f.invulAte) {
      const { x, y } = this.nave;
      let atingida = this.tirosAtivos.findIndex((tiro) => perto(posicaoTiro(tiro, n)!, x, y, RAIO_NAVE + RAIO_TIRO));
      let corpo = false;
      if (atingida < 0)
        corpo = this.ativos.some((i) => {
          if (f.mortos.has(i)) return false;
          const p = posicaoInimigo(this.inimigos[i], n);
          return !!p && perto(p, x, y, RAIO_NAVE + RAIO[this.inimigos[i].tipo] * 0.6);
        });
      if (atingida >= 0 || corpo) {
        const escudoAntes = f.escudo;
        const vidasAntes = f.vidas;
        if (f.atingida(n, x, y) === null && (f.vidas < vidasAntes || f.escudo !== escudoAntes)) {
          this.eventos.push(['d', n, x, y]);
          if (atingida >= 0) this.tirosAtivos.splice(atingida, 1);
          if (f.vidas < vidasAntes) {
            o.perdeuVida = true;
            this.efeitos.push({ tipo: 'perdeu', x, y, em: n, grande: true });
            this.balas = [];
            if (f.morteFinal === null) this.renascer = true;
          } else {
            o.escudo = true;
            this.efeitos.push({ tipo: 'escudo', x, y, em: n });
          }
        }
        atingida = -1;
      }
    }

    this.efeitos = this.efeitos.filter((e) => n - e.em < 40);
    return o;
  }

  private caiu(i: number, n: number, o: Ocorrido) {
    const e = this.inimigos[i];
    const p = posicaoInimigo(e, n);
    o.derrubou = true;
    if (e.tipo === 'chefe') o.chefe = true;
    if (p) this.efeitos.push({ tipo: 'explosao', x: p.x, y: p.y, em: n, grande: e.tipo === 'besouro' || e.tipo === 'chefe' });
    if (e.item) this.soltos.push([i, n]);
  }

  /** Quem segue alguém (sem nave): os derrubados dessa pessoa, para a explosão aparecer aqui também. */
  seguir(mortos: Map<number, number> | null) {
    this.vista = mortos;
  }
}
