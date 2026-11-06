/**
 * O DESENHO DA PONTE DA TOCA (06/11/2026): tudo por código, num canvas 2D de lado — o céu, os morros, a água, os barrancos, as
 * peças com textura de madeira, de tábua e de aço, o tráfego (coelhos de carroça, de carro e de caminhão) e os estilhaços. Nenhuma
 * arte de terceiro. O desenho NÃO decide nada: lê o estado da regra (sim.ts) e pinta. Aqui pode haver seno e cosseno (as ondas,
 * o ângulo de cada peça): o que o servidor refaz não passa por este arquivo.
 */
import { CAIU, CHEGOU, cabe, ehAncora, ESPERANDO, MADEIRA, PISTA, SAIDA, type Fase, type Sim, type Veiculo } from './sim';

export const LARGURA = 960;
export const ALTURA = 540;

/** As cores da madeira, da tábua e do aço (e a sombra de cada uma). */
const COR = [
  { base: '#9a6438', topo: '#c99560', linha: '#6d4223', borda: '#4e2f18' },
  { base: '#c08a50', topo: '#d9a96d', linha: '#93612f', borda: '#5d3a1f' },
  { base: '#8796a5', topo: '#b9c5d0', linha: '#5f6d7a', borda: '#3c4651' },
];
const ESPESSURA = [0.26, 0.16, 0.14];

/** Verde (folgada) → amarelo → vermelho (no limite). */
export function corDoEsforco(e: number): string {
  const v = e < 0 ? 0 : e > 1 ? 1 : e;
  return `hsl(${Math.round(120 * (1 - v))}, 78%, ${46 - 6 * v}%)`;
}

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  cor: string;
  tam: number;
}

/** Um sorteio só do desenho (a grama, as pedras): sempre o mesmo para a mesma fase. */
function sorteio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const CORES_DOS_CARROS = ['#d0524c', '#4a79c8', '#e0a43a', '#6aa35a'];

export class DesenhoDaPonte {
  readonly u: number;
  readonly ox: number;
  readonly oy: number;
  private fundo: HTMLCanvasElement | null = null;
  private particulas: Particula[] = [];
  private ultimo = 0;

  constructor(
    private ctx: CanvasRenderingContext2D,
    readonly fase: Fase,
  ) {
    const x0 = -4.5;
    const x1 = fase.largura + 4.5;
    const y0 = fase.fundo - 0.6;
    const y1 = fase.alto + 1.4;
    this.u = Math.min(LARGURA / (x1 - x0), ALTURA / (y1 - y0));
    this.ox = (LARGURA - (x1 - x0) * this.u) / 2 - x0 * this.u;
    this.oy = (ALTURA + (y1 - y0) * this.u) / 2 + y0 * this.u;
  }

  sx(x: number) {
    return this.ox + x * this.u;
  }
  sy(y: number) {
    return this.oy - y * this.u;
  }
  /** Do ponto do canvas (em pixels lógicos) para o mundo (casas). */
  paraMundo(px: number, py: number): [number, number] {
    return [(px - this.ox) / this.u, (this.oy - py) / this.u];
  }

  // ------------------------------------------------------------------------------------------------------------------------------
  // O CENÁRIO (o que não se mexe vai para uma imagem guardada)
  // ------------------------------------------------------------------------------------------------------------------------------

  private cenario(): HTMLCanvasElement {
    if (this.fundo) return this.fundo;
    const c = document.createElement('canvas');
    c.width = LARGURA;
    c.height = ALTURA;
    const g = c.getContext('2d')!;
    const f = this.fase;
    const u = this.u;
    const rnd = sorteio(f.largura * 977 + f.alto * 31 + f.ancoras.length);
    // o céu
    const ceu = g.createLinearGradient(0, 0, 0, ALTURA);
    ceu.addColorStop(0, '#86c3e3');
    ceu.addColorStop(0.65, '#d7ecf0');
    ceu.addColorStop(1, '#f4e6c6');
    g.fillStyle = ceu;
    g.fillRect(0, 0, LARGURA, ALTURA);
    // o sol e as nuvens
    g.fillStyle = 'rgba(255, 244, 205, 0.9)';
    g.beginPath();
    g.arc(LARGURA * 0.82, ALTURA * 0.16, 30, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 4; i++) {
      const cx = LARGURA * (0.1 + 0.25 * i + rnd() * 0.08);
      const cy = ALTURA * (0.08 + rnd() * 0.14);
      g.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.ellipse(cx + k * 18 - 27, cy + (k % 2) * 4, 22 - (k % 2) * 6, 13, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // os morros lá atrás
    const morros = (cor: string, base: number, alt: number, fase0: number) => {
      g.fillStyle = cor;
      g.beginPath();
      g.moveTo(0, ALTURA);
      for (let x = 0; x <= LARGURA; x += 16) g.lineTo(x, base - alt * (0.55 + 0.45 * Math.sin(x / 140 + fase0) * Math.cos(x / 310 + fase0 * 2)));
      g.lineTo(LARGURA, ALTURA);
      g.fill();
    };
    morros('#a9cf98', this.sy(0.6), 70, 1.3);
    morros('#8fbf7d', this.sy(-0.2), 46, 4.1);
    // a fundura do vão: escurece para baixo, com as paredes do outro lado lá atrás
    const fundoY = this.sy(f.fundo);
    const vao = g.createLinearGradient(0, this.sy(0), 0, fundoY);
    vao.addColorStop(0, 'rgba(120, 160, 110, 0)');
    vao.addColorStop(1, f.agua === null ? 'rgba(92, 70, 52, 0.75)' : 'rgba(60, 100, 80, 0.6)');
    g.fillStyle = vao;
    g.fillRect(this.sx(0), this.sy(0), this.sx(f.largura) - this.sx(0), fundoY - this.sy(0));
    g.fillStyle = f.agua === null ? 'rgba(140, 104, 72, 0.55)' : 'rgba(150, 118, 84, 0.45)';
    for (const [borda, dentro] of [
      [0, 1],
      [f.largura, -1],
    ]) {
      g.beginPath();
      g.moveTo(this.sx(borda), this.sy(0) + 6);
      g.lineTo(this.sx(borda + dentro * 0.9), this.sy(f.fundo * 0.45));
      g.lineTo(this.sx(borda + dentro * 1.5), fundoY);
      g.lineTo(this.sx(borda), fundoY);
      g.fill();
    }
    // o fundo do vão: o leito do rio ou o chão da ravina
    g.fillStyle = f.agua === null ? '#8a6f55' : '#6f8a6b';
    g.fillRect(this.sx(0), fundoY - 4, this.sx(f.largura) - this.sx(0), ALTURA - fundoY + 4);
    for (let i = 0; i < f.largura * 3; i++) {
      g.fillStyle = rnd() < 0.5 ? '#7b7570' : '#9a948c';
      g.beginPath();
      g.ellipse(this.sx(rnd() * f.largura), fundoY - 2 + rnd() * 6, 4 + rnd() * 8, 3 + rnd() * 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    // a pedra do meio
    for (let i = 0; i < f.pedras.length; i += 2) {
      const px = f.pedras[i];
      const topo = f.pedras[i + 1];
      g.fillStyle = '#8d877f';
      g.beginPath();
      g.moveTo(this.sx(px - 1.3), fundoY + 4);
      g.lineTo(this.sx(px - 0.85), this.sy(topo - 0.15));
      g.quadraticCurveTo(this.sx(px), this.sy(topo + 0.25), this.sx(px + 0.85), this.sy(topo - 0.15));
      g.lineTo(this.sx(px + 1.3), fundoY + 4);
      g.fill();
      g.fillStyle = '#a7a199';
      g.beginPath();
      g.moveTo(this.sx(px - 0.7), this.sy(topo - 0.1));
      g.quadraticCurveTo(this.sx(px), this.sy(topo + 0.2), this.sx(px + 0.7), this.sy(topo - 0.1));
      g.lineTo(this.sx(px + 0.4), this.sy(topo - 1.4));
      g.lineTo(this.sx(px - 0.5), this.sy(topo - 1.1));
      g.fill();
    }
    // os pilares de pedra nas margens (a fase dos apoios altos), atrás da estrada
    for (let i = 0; i < f.ancoras.length; i += 2) {
      const ax = f.ancoras[i];
      const ay = f.ancoras[i + 1];
      if (ay <= 0 || (ax !== 0 && ax !== f.largura)) continue;
      const fora = ax === 0 ? -1 : 1;
      const x0 = this.sx(ax + fora * 0.75);
      const x1 = this.sx(ax);
      const esq = Math.min(x0, x1);
      const larg = Math.abs(x1 - x0);
      g.fillStyle = '#9c968d';
      g.fillRect(esq, this.sy(ay + 0.45), larg, this.sy(0) - this.sy(ay + 0.45));
      // as juntas das pedras, só dentro do pilar
      g.save();
      g.beginPath();
      g.rect(esq, this.sy(ay + 0.45), larg, this.sy(0) - this.sy(ay + 0.45));
      g.clip();
      g.fillStyle = '#7f7a72';
      for (let y = 0; y < ay + 0.45; y += 0.4) {
        const off = (Math.round(y / 0.4) % 2) * 0.5;
        for (let k = 0; k < 3; k++) g.fillRect(esq + ((k + off) * larg) / 2, this.sy(y) - 1, 1.5, -0.4 * u + 2);
        g.fillRect(esq, this.sy(y) - 1, larg, 1.5);
      }
      g.restore();
      g.fillStyle = '#b3ada3';
      g.fillRect(esq - 3, this.sy(ay + 0.55), larg + 6, 0.16 * u);
    }
    // os barrancos
    const barranco = (de: number, ate: number, borda: number) => {
      const topo = this.sy(0);
      const x0 = this.sx(de);
      const x1 = this.sx(ate);
      const terra = g.createLinearGradient(0, topo, 0, ALTURA);
      terra.addColorStop(0, '#a77a4f');
      terra.addColorStop(1, '#7c5636');
      g.fillStyle = terra;
      g.fillRect(Math.min(x0, x1), topo, Math.abs(x1 - x0), ALTURA - topo);
      // as camadas e as pedrinhas da parede
      for (let i = 0; i < 40; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(90, 60, 35, 0.35)' : 'rgba(210, 180, 140, 0.3)';
        const x = Math.min(x0, x1) + rnd() * Math.abs(x1 - x0);
        g.beginPath();
        g.ellipse(x, topo + 14 + rnd() * (ALTURA - topo), 3 + rnd() * 6, 2 + rnd() * 3, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = '#5e3f25';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(this.sx(borda), topo);
      g.lineTo(this.sx(borda), ALTURA);
      g.stroke();
      // a grama em cima e a estrada de terra
      g.fillStyle = '#79b35a';
      g.fillRect(Math.min(x0, x1), topo - 0.12 * u, Math.abs(x1 - x0), 0.22 * u);
      g.fillStyle = '#c9a877';
      g.fillRect(Math.min(x0, x1), topo - 0.06 * u, Math.abs(x1 - x0), 0.12 * u);
      for (let i = 0; i < 26; i++) {
        const x = Math.min(x0, x1) + rnd() * Math.abs(x1 - x0);
        g.strokeStyle = '#5f9a45';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x, topo - 0.1 * u);
        g.lineTo(x - 2 + rnd() * 4, topo - 0.1 * u - 4 - rnd() * 5);
        g.stroke();
      }
    };
    barranco(-6, 0, 0);
    barranco(f.largura, f.largura + 6, f.largura);
    // a bandeira de chegada
    const bx = this.sx(f.largura + 2.6);
    const by = this.sy(0);
    g.strokeStyle = '#5b4632';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx, by - 1.5 * u);
    g.stroke();
    const q = 0.16 * u;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) {
        g.fillStyle = (i + j) % 2 ? '#2f2f2f' : '#f5f1e6';
        g.fillRect(bx + i * q, by - 1.5 * u + j * q, q, q);
      }
    this.fundo = c;
    return c;
  }

  /** A água, por cima do que está no vão (meio transparente: o que afunda aparece por baixo). */
  private agua(agora: number) {
    const f = this.fase;
    if (f.agua === null) return;
    const g = this.ctx;
    const topo = this.sy(f.agua);
    const x0 = this.sx(0);
    const x1 = this.sx(f.largura);
    const grad = g.createLinearGradient(0, topo, 0, this.sy(f.fundo));
    grad.addColorStop(0, 'rgba(79, 159, 196, 0.78)');
    grad.addColorStop(1, 'rgba(36, 92, 128, 0.9)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x0, ALTURA);
    for (let x = x0; x <= x1; x += 8) g.lineTo(x, topo + 2.5 * Math.sin(x / 26 + agora / 600));
    g.lineTo(x1, topo);
    g.lineTo(x1, ALTURA);
    g.fill();
    g.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    g.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) {
      const x = x0 + ((k * 97 + agora / 40) % (x1 - x0));
      g.beginPath();
      g.moveTo(x, topo + 8 + (k % 3) * 9);
      g.lineTo(x + 14, topo + 8 + (k % 3) * 9);
      g.stroke();
    }
  }

  // ------------------------------------------------------------------------------------------------------------------------------
  // AS PEÇAS
  // ------------------------------------------------------------------------------------------------------------------------------

  /** Uma peça de (ax, ay) a (bx, by), no mundo. `tinta`: a cor do esforço por cima (na simulação). */
  peca(ax: number, ay: number, bx: number, by: number, tipo: number, tinta: string | null = null, alfa = 1) {
    const g = this.ctx;
    const u = this.u;
    const x0 = this.sx(ax);
    const y0 = this.sy(ay);
    const dx = this.sx(bx) - x0;
    const dy = this.sy(by) - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const c = COR[tipo];
    const th = ESPESSURA[tipo] * u;
    g.save();
    g.globalAlpha = alfa;
    g.translate(x0, y0);
    g.rotate(Math.atan2(dy, dx));
    g.fillStyle = c.base;
    g.fillRect(0, -th / 2, len, th);
    g.fillStyle = c.topo;
    g.fillRect(0, -th / 2, len, th * 0.38);
    g.strokeStyle = c.linha;
    g.lineWidth = Math.max(1, u / 40);
    if (tipo === PISTA) {
      // as tábuas atravessadas
      const passo = 0.3 * u;
      g.beginPath();
      for (let x = passo; x < len - 2; x += passo) {
        g.moveTo(x, -th / 2);
        g.lineTo(x, th / 2);
      }
      g.stroke();
    } else if (tipo === MADEIRA) {
      // o veio
      g.beginPath();
      g.moveTo(3, th * 0.12);
      g.bezierCurveTo(len * 0.3, th * 0.3, len * 0.6, -th * 0.05, len - 3, th * 0.18);
      g.stroke();
    } else {
      // os rebites
      g.fillStyle = c.linha;
      for (let x = 0.2 * u; x < len - 0.1 * u; x += 0.4 * u) {
        g.beginPath();
        g.arc(x, 0, Math.max(1.2, u / 30), 0, Math.PI * 2);
        g.fill();
      }
    }
    if (tinta) {
      g.globalAlpha = alfa * 0.62;
      g.fillStyle = tinta;
      g.fillRect(0, -th / 2, len, th);
      g.globalAlpha = alfa;
    }
    g.strokeStyle = c.borda;
    g.lineWidth = Math.max(1, u / 32);
    g.strokeRect(0, -th / 2, len, th);
    g.restore();
  }

  /** Um nó: a âncora (o apoio fixo) é maior e vermelha; a junta é um pino escuro. */
  no(x: number, y: number, ancora: boolean, destaque = false) {
    const g = this.ctx;
    const u = this.u;
    const px = this.sx(x);
    const py = this.sy(y);
    if (ancora) {
      g.fillStyle = '#5e5852';
      g.fillRect(px - 0.2 * u, py - 0.2 * u, 0.4 * u, 0.4 * u);
      g.fillStyle = destaque ? '#ffcf5a' : '#d0524c';
      g.beginPath();
      g.arc(px, py, 0.14 * u, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#fff3e0';
      g.lineWidth = 2;
      g.stroke();
    } else {
      g.fillStyle = destaque ? '#ffcf5a' : '#3a3530';
      g.beginPath();
      g.arc(px, py, 0.09 * u + (destaque ? 2 : 0), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#c9c1b6';
      g.beginPath();
      g.arc(px, py, 0.035 * u, 0, Math.PI * 2);
      g.fill();
    }
  }

  // ------------------------------------------------------------------------------------------------------------------------------
  // A MONTAGEM
  // ------------------------------------------------------------------------------------------------------------------------------

  montagem(
    pecas: readonly number[],
    o: {
      agora: number;
      fantasma?: { ax: number; ay: number; bx: number; by: number; tipo: number; valida: boolean } | null;
      origem?: [number, number] | null;
      cursor?: [number, number] | null;
      apagando?: number;
    },
  ) {
    const g = this.ctx;
    const f = this.fase;
    g.drawImage(this.cenario(), 0, 0);
    // a área de montar e os pontos da grade
    g.fillStyle = 'rgba(255, 255, 255, 0.07)';
    g.fillRect(this.sx(0), this.sy(f.alto), this.sx(f.largura) - this.sx(0), this.sy(f.baixo) - this.sy(f.alto));
    g.fillStyle = 'rgba(40, 50, 60, 0.32)';
    for (let x = 0; x <= f.largura; x++)
      for (let y = f.baixo; y <= f.alto; y++) {
        if (!cabe(f, x, y) || ehAncora(f, x, y)) continue;
        g.beginPath();
        g.arc(this.sx(x), this.sy(y), Math.max(1.5, this.u / 26), 0, Math.PI * 2);
        g.fill();
      }
    for (let i = 0; i + 4 < pecas.length; i += 5) {
      const apagando = o.apagando === i / 5;
      this.peca(pecas[i], pecas[i + 1], pecas[i + 2], pecas[i + 3], pecas[i + 4], apagando ? '#d0524c' : null, apagando ? 0.8 : 1);
    }
    if (o.fantasma) {
      const fz = o.fantasma;
      this.peca(fz.ax, fz.ay, fz.bx, fz.by, fz.tipo, fz.valida ? null : '#d0524c', 0.6);
    }
    const nos = new Set<string>();
    for (let i = 0; i + 4 < pecas.length; i += 5) {
      nos.add(`${pecas[i]},${pecas[i + 1]}`);
      nos.add(`${pecas[i + 2]},${pecas[i + 3]}`);
    }
    for (const k of nos) {
      const [x, y] = k.split(',').map(Number);
      if (!ehAncora(f, x, y)) this.no(x, y, false, !!o.origem && o.origem[0] === x && o.origem[1] === y);
    }
    for (let i = 0; i < f.ancoras.length; i += 2) {
      const x = f.ancoras[i];
      const y = f.ancoras[i + 1];
      this.no(x, y, true, !!o.origem && o.origem[0] === x && o.origem[1] === y);
    }
    if (o.cursor) {
      g.strokeStyle = '#ffcf5a';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(this.sx(o.cursor[0]), this.sy(o.cursor[1]), 0.24 * this.u, 0, Math.PI * 2);
      g.stroke();
    }
    this.agua(o.agora);
  }

  // ------------------------------------------------------------------------------------------------------------------------------
  // A SIMULAÇÃO
  // ------------------------------------------------------------------------------------------------------------------------------

  /** Os estilhaços e os respingos dos eventos do último passo. */
  ouvir(s: Sim) {
    for (const ev of s.eventos) {
      if (ev.tipo === 'quebrou') {
        const b = s.barras[ev.barra];
        const a = s.nos[b.a];
        const c = s.nos[b.b];
        const mx = (a.x + c.x) / 2;
        const my = (a.y + c.y) / 2;
        for (let k = 0; k < 10; k++)
          this.particulas.push({ x: mx, y: my, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3, vida: 1, cor: COR[b.tipo].base, tam: 2 + Math.random() * 3 });
      } else if (ev.tipo === 'caiu' && this.fase.agua !== null) {
        const v = s.veiculos[ev.veiculo];
        this.respingo = { x: v.x, ate: this.fase.agua };
      }
    }
  }
  private respingo: { x: number; ate: number } | null = null;

  simulacao(s: Sim, agora: number) {
    const g = this.ctx;
    const f = this.fase;
    const dt = this.ultimo ? Math.min(0.1, (agora - this.ultimo) / 1000) : 0;
    this.ultimo = agora;
    g.drawImage(this.cenario(), 0, 0);
    // as peças inteiras, pintadas pelo esforço; as quebradas, dois tocos caídos de cada ponta
    for (const b of s.barras) {
      const a = s.nos[b.a];
      const c = s.nos[b.b];
      if (b.inteira) this.peca(a.x, a.y, c.x, c.y, b.tipo, corDoEsforco(b.esforco));
      else {
        const k = 0.36;
        this.peca(a.x, a.y, a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k, b.tipo, '#3a2a1c', 0.85);
        this.peca(c.x, c.y, c.x + (a.x - c.x) * k, c.y + (a.y - c.y) * k, b.tipo, '#3a2a1c', 0.85);
      }
    }
    for (const n of s.nos) if (n.m > 0.31 || n.fixo) this.no(n.x, n.y, n.fixo);
    s.veiculos.forEach((v, i) => this.veiculo(v, i));
    // o respingo: quando o veículo que caiu chega na água
    if (this.respingo) {
      const v = s.veiculos.find((o) => o.estado === CAIU && o.y <= (this.respingo?.ate ?? 0));
      if (v) {
        for (let k = 0; k < 18; k++)
          this.particulas.push({ x: v.x, y: this.respingo.ate, vx: (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 3, vida: 1, cor: '#d6eef8', tam: 2 + Math.random() * 3 });
        this.respingo = null;
      }
    }
    this.agua(agora);
    // as partículas
    for (const p of this.particulas) {
      p.vy -= 9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vida -= dt * 0.9;
    }
    this.particulas = this.particulas.filter((p) => p.vida > 0 && p.y > f.fundo - 1);
    for (const p of this.particulas) {
      g.globalAlpha = Math.max(0, p.vida);
      g.fillStyle = p.cor;
      g.fillRect(this.sx(p.x) - p.tam / 2, this.sy(p.y) - p.tam / 2, p.tam, p.tam);
    }
    g.globalAlpha = 1;
  }

  /** Um coelho de carroça, de carro ou de caminhão, apoiado na pista (as rodas em cima da tábua). */
  private veiculo(v: Veiculo, i: number) {
    if (v.estado === ESPERANDO || v.estado === CHEGOU || v.x < SAIDA + 0.01) return;
    const g = this.ctx;
    const u = this.u;
    const px = this.sx(v.x);
    const py = this.sy(v.y + ESPESSURA[PISTA] / 2);
    let ang = -Math.atan(v.inclinacao);
    if (v.estado === CAIU) ang += Math.min(0.9, -v.vy * 0.08);
    g.save();
    g.translate(px, py);
    g.rotate(ang);
    g.scale(u, u);
    g.lineWidth = 0.035;
    g.strokeStyle = '#3a2a1c';
    const roda = (x: number, r: number) => {
      g.fillStyle = '#3a3530';
      g.beginPath();
      g.arc(x, -r, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#b9b0a3';
      g.beginPath();
      g.arc(x, -r, r * 0.42, 0, Math.PI * 2);
      g.fill();
    };
    const coelho = (x: number, y: number, s = 1) => {
      g.fillStyle = '#f7f3ec';
      g.beginPath();
      g.ellipse(x - 0.06 * s, y - 0.3 * s, 0.05 * s, 0.17 * s, -0.15, 0, Math.PI * 2);
      g.ellipse(x + 0.07 * s, y - 0.31 * s, 0.05 * s, 0.17 * s, 0.15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#efb3b8';
      g.beginPath();
      g.ellipse(x - 0.06 * s, y - 0.3 * s, 0.022 * s, 0.11 * s, -0.15, 0, Math.PI * 2);
      g.ellipse(x + 0.07 * s, y - 0.31 * s, 0.022 * s, 0.11 * s, 0.15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f7f3ec';
      g.beginPath();
      g.arc(x, y - 0.06 * s, 0.15 * s, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#2b2622';
      g.beginPath();
      g.arc(x + 0.07 * s, y - 0.09 * s, 0.022 * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e88a94';
      g.beginPath();
      g.arc(x + 0.14 * s, y - 0.04 * s, 0.02 * s, 0, Math.PI * 2);
      g.fill();
    };
    if (v.tipo === 'carroca') {
      g.fillStyle = '#b4773f';
      g.fillRect(-0.7, -0.62, 1.2, 0.36);
      g.strokeRect(-0.7, -0.62, 1.2, 0.36);
      g.beginPath();
      g.moveTo(-0.7, -0.5);
      g.lineTo(0.5, -0.5);
      g.moveTo(-0.3, -0.62);
      g.lineTo(-0.3, -0.26);
      g.moveTo(0.1, -0.62);
      g.lineTo(0.1, -0.26);
      g.stroke();
      // as cenouras na carroça
      g.fillStyle = '#ee8a2c';
      for (const cx of [-0.55, -0.42, -0.15]) {
        g.beginPath();
        g.moveTo(cx - 0.05, -0.62);
        g.lineTo(cx + 0.05, -0.62);
        g.lineTo(cx, -0.8);
        g.fill();
      }
      coelho(0.3, -0.66, 1);
      roda(-0.45, 0.24);
      roda(0.32, 0.24);
    } else if (v.tipo === 'carro') {
      const cor = CORES_DOS_CARROS[i % CORES_DOS_CARROS.length];
      g.fillStyle = cor;
      g.beginPath();
      g.moveTo(-0.8, -0.18);
      g.lineTo(-0.8, -0.48);
      g.lineTo(-0.35, -0.5);
      g.lineTo(-0.2, -0.82);
      g.lineTo(0.38, -0.82);
      g.lineTo(0.56, -0.52);
      g.lineTo(0.82, -0.46);
      g.lineTo(0.82, -0.18);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#a8d8f0';
      g.beginPath();
      g.moveTo(-0.12, -0.76);
      g.lineTo(0.34, -0.76);
      g.lineTo(0.47, -0.54);
      g.lineTo(-0.12, -0.54);
      g.closePath();
      g.fill();
      coelho(0.13, -0.6, 0.85);
      g.fillStyle = '#ffe9a0';
      g.fillRect(0.74, -0.42, 0.08, 0.08);
      roda(-0.48, 0.19);
      roda(0.5, 0.19);
    } else {
      // o caminhão: a carroceria cheia de cenouras e a cabine
      g.fillStyle = '#8f6a4a';
      g.fillRect(-1.25, -0.95, 1.55, 0.65);
      g.strokeRect(-1.25, -0.95, 1.55, 0.65);
      g.strokeStyle = '#6d4f35';
      g.beginPath();
      for (let x = -1.05; x < 0.3; x += 0.25) {
        g.moveTo(x, -0.95);
        g.lineTo(x, -0.3);
      }
      g.stroke();
      g.strokeStyle = '#3a2a1c';
      g.fillStyle = '#ee8a2c';
      for (let x = -1.15; x < 0.25; x += 0.17) {
        g.beginPath();
        g.moveTo(x, -0.95);
        g.lineTo(x + 0.1, -0.95);
        g.lineTo(x + 0.05, -1.15);
        g.fill();
      }
      g.fillStyle = '#6aa35a';
      for (let x = -1.1; x < 0.25; x += 0.34) {
        g.beginPath();
        g.ellipse(x + 0.05, -1.17, 0.05, 0.03, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#f2b632';
      g.beginPath();
      g.moveTo(0.35, -0.3);
      g.lineTo(0.35, -1.0);
      g.lineTo(0.9, -1.0);
      g.lineTo(1.18, -0.6);
      g.lineTo(1.18, -0.3);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#a8d8f0';
      g.fillRect(0.5, -0.92, 0.38, 0.3);
      coelho(0.68, -0.68, 0.8);
      roda(-0.95, 0.22);
      roda(-0.45, 0.22);
      roda(0.82, 0.22);
    }
    g.restore();
  }

  /** O quanto da cena ainda tem partícula no ar (a simulação acabou, mas o desenho segue até elas caírem). */
  temParticulas() {
    return this.particulas.length > 0;
  }
}

/** Uma miniatura da fase (a escolha da fase): os barrancos, a água, a pedra e os apoios, em SVG. */
export function caixaDaFase(f: Fase) {
  return { x0: -2, x1: f.largura + 2, y0: f.fundo - 0.4, y1: f.alto + 0.6 };
}

