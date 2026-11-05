import { PREDIOS, TAMANHO, ePredio, eFonte, type Sim, type TipoPredio, type TipoUnidade } from './sim';
import { CORES, type Vista } from './vista';

/**
 * TOCAS E TORRES DE CIMA, EM 2D (05/11/2026): a reserva para quando não há WebGL (ou a pessoa escolheu o estilo 2D em
 * Gráficos). O mesmo mapa, visto de cima num canvas: as árvores e o ouro como bolinhas, os prédios como blocos com um sinal
 * de cada tipo, e as unidades como bolinhas na cor do time com o sinal da arma. Tudo desenhado aqui, sem texto (não pede
 * tradução); a névoa escurece as casas como na cena 3D.
 */

const T = TAMANHO;

const SINAL_DA_UNIDADE: Record<TipoUnidade, string> = { trabalhador: 'ferramenta', lanceiro: 'lanca', arqueiro: 'arco', cavaleiro: 'espada', catapulta: 'roda' };
const COR_DO_PREDIO: Record<TipoPredio, string> = {
  centro: '#c9a46a',
  casa: '#c78b5c',
  fazenda: '#d8c060',
  quartel: '#a0705a',
  arquearia: '#8a9a5a',
  torre: '#9a9a9a',
  muralha: '#8c8c88',
  portao: '#7a6a58',
  maravilha: '#e8d79a',
};

export class Vista2D implements Vista {
  selecao = new Set<number>();
  fantasma: Vista['fantasma'] = null;
  private tela = document.createElement('canvas');
  private g: CanvasRenderingContext2D;
  /** Pixels por casa, e a casa no meio da tela. */
  private escala = 22;
  private cx = 8;
  private cy = 32;
  private observador: ResizeObserver;
  private sinais: { x: number; y: number; ataque: boolean; inicio: number }[] = [];
  private alfa = 1;

  constructor(
    private caixa: HTMLElement,
    private sim: Sim,
    private eu: 0 | 1 = 0,
  ) {
    this.tela.className = 'tocas-tela';
    caixa.appendChild(this.tela);
    this.g = this.tela.getContext('2d')!;
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    const c = sim.predios.find((p) => p.dono === eu && p.tipo === 'centro');
    if (c) {
      this.cx = c.gx + 1.5;
      this.cy = c.gy + 1.5 - 2;
    }
    this.medir();
  }

  async montar() {}

  private medir() {
    const k = Math.min(window.devicePixelRatio || 1, 2);
    this.tela.width = Math.max(1, this.caixa.clientWidth * k);
    this.tela.height = Math.max(1, this.caixa.clientHeight * k);
  }

  private paraTela(x: number, y: number) {
    return { x: (x - this.cx) * this.escala + this.caixa.clientWidth / 2, y: (y - this.cy) * this.escala + this.caixa.clientHeight / 2 };
  }

  quadro(alfa: number) {
    this.alfa = alfa;
    const g = this.g;
    const k = this.tela.width / Math.max(1, this.caixa.clientWidth);
    g.setTransform(k, 0, 0, k, 0, 0);
    const w = this.caixa.clientWidth;
    const h = this.caixa.clientHeight;
    // fora do mapa é preto
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    const e = this.escala;
    const j = this.sim.jogadores[this.eu];
    const x0 = Math.max(0, Math.floor(this.cx - w / 2 / e) - 1);
    const x1 = Math.min(T - 1, Math.ceil(this.cx + w / 2 / e) + 1);
    const y0 = Math.max(0, Math.floor(this.cy - h / 2 / e) - 1);
    const y1 = Math.min(T - 1, Math.ceil(this.cy + h / 2 / e) + 1);
    // o chão
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const p = this.paraTela(x, y);
        g.fillStyle = (x + y) % 2 ? '#7aa65a' : '#76a157';
        g.fillRect(p.x, p.y, e + 0.5, e + 0.5);
      }
    for (const p of this.sim.pedras) {
      const s = this.paraTela(p.gx, p.gy);
      g.fillStyle = '#8b8577';
      g.fillRect(s.x + 1, s.y + 1, e - 2, e - 2);
    }
    // as fontes
    for (const f of this.sim.fontes) {
      if (f.gx < x0 || f.gx > x1 || f.gy < y0 || f.gy > y1) continue;
      const s = this.paraTela(f.gx + 0.5, f.gy + 0.5);
      g.beginPath();
      g.arc(s.x, s.y, e * (f.tipo === 'arvore' ? 0.45 : 0.38), 0, Math.PI * 2);
      g.fillStyle = f.tipo === 'arvore' ? '#2f6b34' : '#e7c43c';
      g.fill();
      if (this.selecao.has(f.id)) this.contorno(s.x - e / 2, s.y - e / 2, e, e, '#f0d24a');
    }
    // os prédios
    for (const p of this.sim.predios) {
      if (p.dono !== this.eu && !j.explorado[p.gy * T + p.gx]) continue;
      const s = this.paraTela(p.gx, p.gy);
      const lado = p.tam * e;
      g.globalAlpha = p.pronto ? 1 : 0.55;
      g.fillStyle = COR_DO_PREDIO[p.tipo];
      g.fillRect(s.x + 1, s.y + 1, lado - 2, lado - 2);
      g.fillStyle = CORES[p.dono];
      g.fillRect(s.x + 1, s.y + 1, lado - 2, Math.max(3, e * 0.18));
      this.sinalDoPredio(p.tipo, s.x + lado / 2, s.y + lado / 2 + e * 0.08, lado);
      g.globalAlpha = 1;
      if (this.selecao.has(p.id)) this.contorno(s.x, s.y, lado, lado, p.dono === this.eu ? '#ffffff' : '#f0d24a');
      if (p.vida < p.vidaMax * 0.999 || this.selecao.has(p.id)) this.barra(s.x + lado * 0.1, s.y - 6, lado * 0.8, p.vida / p.vidaMax, p.dono !== this.eu);
    }
    // as unidades
    for (const u of this.sim.unidades) {
      const x = u.ax + (u.x - u.ax) * alfa;
      const y = u.ay + (u.y - u.ay) * alfa;
      if (u.dono !== this.eu && !j.visivel[Math.floor(y) * T + Math.floor(x)]) continue;
      const s = this.paraTela(x, y);
      const r = e * (u.tipo === 'catapulta' ? 0.42 : u.tipo === 'cavaleiro' ? 0.36 : 0.28);
      g.beginPath();
      g.arc(s.x, s.y, r, 0, Math.PI * 2);
      g.fillStyle = CORES[u.dono];
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = this.selecao.has(u.id) ? '#ffffff' : 'rgba(0,0,0,0.45)';
      g.stroke();
      this.sinalDaUnidade(SINAL_DA_UNIDADE[u.tipo], s.x, s.y, r);
      if (u.carga) {
        g.fillStyle = u.carga.rec === 'madeira' ? '#8a5a32' : u.carga.rec === 'ouro' ? '#f0d24a' : '#d04a4a';
        g.fillRect(s.x + r * 0.5, s.y - r * 1.1, r * 0.7, r * 0.7);
      }
      if (u.vida < u.vidaMax || this.selecao.has(u.id)) this.barra(s.x - e * 0.3, s.y - r - 6, e * 0.6, u.vida / u.vidaMax, u.dono !== this.eu);
    }
    // a névoa
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * T + x;
        if (j.visivel[i]) continue;
        const p = this.paraTela(x, y);
        g.fillStyle = j.explorado[i] ? 'rgba(10, 14, 20, 0.45)' : 'rgba(10, 14, 20, 0.92)';
        g.fillRect(p.x, p.y, e + 0.5, e + 0.5);
      }
    // o prédio que se vai pôr
    const f = this.fantasma;
    if (f) {
      const tam = PREDIOS[f.tipo].tam;
      g.fillStyle = f.ok ? 'rgba(127, 224, 127, 0.5)' : 'rgba(224, 82, 82, 0.5)';
      for (const c of f.casas) {
        const s = this.paraTela(c.x, c.y);
        g.fillRect(s.x, s.y, tam * e, tam * e);
      }
    }
    const agora = performance.now();
    this.sinais = this.sinais.filter((s) => agora - s.inicio < 450);
    for (const s of this.sinais) {
      const p = this.paraTela(s.x, s.y);
      const f2 = (agora - s.inicio) / 450;
      g.beginPath();
      g.arc(p.x, p.y, e * (0.2 + f2 * 0.5), 0, Math.PI * 2);
      g.strokeStyle = s.ataque ? `rgba(224,82,82,${1 - f2})` : `rgba(127,224,127,${1 - f2})`;
      g.lineWidth = 2;
      g.stroke();
    }
    // o ponto de reunião do MEU prédio escolhido: a bandeirinha (por cima da névoa: o lugar pode estar fora da vista)
    if (this.selecao.size === 1) {
      const p = this.sim.porId.get([...this.selecao][0]);
      if (p && 'reuniao' in p && p.dono === this.eu && p.reuniao) {
        const s = this.paraTela(p.reuniao.x, p.reuniao.y);
        g.strokeStyle = '#efe3c8';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(s.x, s.y);
        g.lineTo(s.x, s.y - e * 0.9);
        g.stroke();
        g.fillStyle = CORES[this.eu];
        g.beginPath();
        g.moveTo(s.x, s.y - e * 0.9);
        g.lineTo(s.x + e * 0.45, s.y - e * 0.75);
        g.lineTo(s.x, s.y - e * 0.6);
        g.fill();
      }
    }
  }

  private contorno(x: number, y: number, w: number, h: number, cor: string) {
    this.g.strokeStyle = cor;
    this.g.lineWidth = 2;
    this.g.strokeRect(x, y, w, h);
  }

  private barra(x: number, y: number, w: number, f: number, inimigo: boolean) {
    const g = this.g;
    g.fillStyle = 'rgba(20,20,20,0.7)';
    g.fillRect(x, y, w, 4);
    g.fillStyle = inimigo ? '#e05252' : '#5cd65c';
    g.fillRect(x, y, w * Math.max(0, Math.min(1, f)), 4);
  }

  private sinalDoPredio(tipo: TipoPredio, x: number, y: number, lado: number) {
    const g = this.g;
    const r = lado * 0.22;
    g.fillStyle = 'rgba(40, 28, 18, 0.75)';
    g.strokeStyle = 'rgba(40, 28, 18, 0.75)';
    g.lineWidth = 2;
    g.beginPath();
    switch (tipo) {
      case 'centro':
      case 'casa':
        g.moveTo(x - r, y + r * 0.6);
        g.lineTo(x - r, y - r * 0.2);
        g.lineTo(x, y - r);
        g.lineTo(x + r, y - r * 0.2);
        g.lineTo(x + r, y + r * 0.6);
        g.closePath();
        g.fill();
        return;
      case 'fazenda':
        for (let k = -1; k <= 1; k++) {
          g.moveTo(x + k * r * 0.6, y + r);
          g.lineTo(x + k * r * 0.6, y - r);
        }
        g.stroke();
        return;
      case 'quartel':
        g.moveTo(x - r, y + r);
        g.lineTo(x + r, y - r);
        g.moveTo(x + r, y + r);
        g.lineTo(x - r, y - r);
        g.stroke();
        return;
      case 'arquearia':
        g.arc(x, y, r, -Math.PI / 2, Math.PI / 2);
        g.moveTo(x, y - r);
        g.lineTo(x, y + r);
        g.stroke();
        return;
      case 'torre':
        g.fillRect(x - r * 0.5, y - r, r, r * 2);
        return;
      case 'maravilha':
        g.moveTo(x - r, y + r);
        g.lineTo(x, y - r * 1.2);
        g.lineTo(x + r, y + r);
        g.closePath();
        g.fill();
        return;
      case 'portao':
        g.fillRect(x - r * 0.6, y - r * 0.2, r * 1.2, r);
        return;
      default:
        return;
    }
  }

  private sinalDaUnidade(sinal: string, x: number, y: number, r: number) {
    const g = this.g;
    g.strokeStyle = '#ffffff';
    g.fillStyle = '#ffffff';
    g.lineWidth = 1.5;
    g.beginPath();
    if (sinal === 'lanca') {
      g.moveTo(x - r * 0.5, y + r * 0.5);
      g.lineTo(x + r * 0.5, y - r * 0.5);
      g.stroke();
    } else if (sinal === 'arco') {
      g.arc(x - r * 0.15, y, r * 0.5, -Math.PI / 2, Math.PI / 2);
      g.stroke();
    } else if (sinal === 'espada') {
      g.moveTo(x, y - r * 0.6);
      g.lineTo(x, y + r * 0.5);
      g.moveTo(x - r * 0.3, y + r * 0.15);
      g.lineTo(x + r * 0.3, y + r * 0.15);
      g.stroke();
    } else if (sinal === 'roda') {
      g.arc(x, y, r * 0.45, 0, Math.PI * 2);
      g.stroke();
    } else {
      g.arc(x, y, r * 0.22, 0, Math.PI * 2);
      g.fill();
    }
  }

  chao(px: number, py: number) {
    return { x: (px - this.caixa.clientWidth / 2) / this.escala + this.cx, y: (py - this.caixa.clientHeight / 2) / this.escala + this.cy };
  }

  pegar(px: number, py: number): number | null {
    const p = this.chao(px, py);
    const j = this.sim.jogadores[this.eu];
    let melhor: number | null = null;
    let dist = 0.5 * 0.5;
    for (const u of this.sim.unidades) {
      const x = u.ax + (u.x - u.ax) * this.alfa;
      const y = u.ay + (u.y - u.ay) * this.alfa;
      if (u.dono !== this.eu && !j.visivel[Math.floor(y) * T + Math.floor(x)]) continue;
      const q = (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y);
      if (q < dist) {
        dist = q;
        melhor = u.id;
      }
    }
    if (melhor !== null) return melhor;
    const gx = Math.floor(p.x);
    const gy = Math.floor(p.y);
    if (gx < 0 || gy < 0 || gx >= T || gy >= T || !j.explorado[gy * T + gx]) return null;
    const e = this.sim.porId.get(this.sim.grade[gy * T + gx]);
    return e && (ePredio(e) || eFonte(e)) ? e.id : null;
  }

  noRetangulo(x0: number, y0: number, x1: number, y1: number): number[] {
    const a = this.chao(Math.min(x0, x1), Math.min(y0, y1));
    const b = this.chao(Math.max(x0, x1), Math.max(y0, y1));
    return this.sim.unidades.filter((u) => u.dono === this.eu && u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y <= b.y).map((u) => u.id);
  }

  arrastar(dx: number, dy: number) {
    this.cx = Math.min(T, Math.max(0, this.cx - dx / this.escala));
    this.cy = Math.min(T, Math.max(0, this.cy - dy / this.escala));
  }

  zoom(fator: number, px: number, py: number) {
    const antes = this.chao(px, py);
    this.escala = Math.min(48, Math.max(10, this.escala / fator));
    const depois = this.chao(px, py);
    this.cx += antes.x - depois.x;
    this.cy += antes.y - depois.y;
  }

  centrar(x: number, y: number) {
    this.cx = x;
    this.cy = y;
  }

  cantos() {
    const w = this.caixa.clientWidth;
    const h = this.caixa.clientHeight;
    return [this.chao(0, 0), this.chao(w, 0), this.chao(w, h), this.chao(0, h)];
  }

  sinal(x: number, y: number, ataque: boolean) {
    this.sinais.push({ x, y, ataque, inicio: performance.now() });
  }

  destruir() {
    this.observador.disconnect();
    this.tela.remove();
  }
}
