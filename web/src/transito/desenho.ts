import { PREDIOS, VEICULOS } from './atlas.gerado';
import { C0, C1, CAMINHOS, FILA_MAX, MAPA, TRAVA_PASSOS, naFila, primeiroDaFila, type Carro, type Estado } from './sim';

/**
 * O DESENHO DO TRÂNSITO DA TOCA: a cidade em isométrico, num canvas 2D. Os prédios e os carros são da Kenney (CC0, as folhas de
 * web/public/transito/, montadas por web/scripts/transito-atlas.mjs); o asfalto, as faixas, a calçada da frente, os arbustos e a
 * fumaça da batida, por código.
 *
 * A PROJEÇÃO: a casa (i, j) da grade vira o losango de 130 × 65 da tela, o mesmo da calçada dos prédios da Kenney (medido: o canto
 * esquerdo do topo fica a 59 px do alto da peça, e a laje tem 35 px de lado). O eixo x da grade desce para a direita na tela, o y
 * desce para a esquerda; por isso os carros só usam as quatro diagonais.
 *
 * A ORDEM: primeiro o chão inteiro (as ruas e a calçada, numa camada que não muda), depois prédios, arbustos e carros juntos,
 * do fundo para a frente pela soma x + y. Os lados da laje de cada prédio são cortados (a não ser na beirada da frente do mapa):
 * eles ficam abaixo do chão, e por cima da rua vizinha pareceriam uma parede.
 */

export const MEIA_L = 65;
export const MEIA_A = 32.5;
const LAJE = 35;
const ESCALA_DO_CARRO = 1.2;
export const LARGURA = 2 * MAPA * MEIA_L + 20;
export const ALTURA = 2 * MAPA * MEIA_A + LAJE + 60;
const OX = LARGURA / 2;
const OY = 40;

export const tela = (x: number, y: number): [number, number] => [OX + (x - y) * MEIA_L, OY + (x + y) * MEIA_A];

const ehRua = (i: number, j: number) => i === C0 || j === C0;
/** As casas na frente das ruas ficam baixas (calçada e arbustos): um prédio ali esconderia a faixa de perto. */
const ehCalcada = (i: number, j: number) => !ehRua(i, j) && (i === C1 || j === C1);

/** Um número fixo por casa, para o prédio e o arbusto não mudarem de uma partida para outra. */
const misturar = (i: number, j: number) => ((i * 73856093) ^ (j * 19349663)) >>> 0;

const COR = {
  asfalto: '#5d6169',
  asfaltoCruz: '#585c64',
  faixa: '#e9e5d8',
  meio: '#f0c94a',
  calcada: '#cfcab6',
  calcadaBorda: '#dcd7c3',
  ladoClaroSW: '#c2beac',
  ladoTerraSW: '#a77d53',
  ladoClaroSE: '#979385',
  ladoTerraSE: '#81603e',
  ladoAsfaltoSW: '#6b6f76',
  ladoAsfaltoSE: '#54575d',
  arbusto: '#6fa65a',
  arbustoSombra: '#4f8241',
};

function losango(ctx: CanvasRenderingContext2D, pts: [number, number][], cor: string) {
  ctx.beginPath();
  pts.forEach(([x, y], k) => {
    const [sx, sy] = tela(x, y);
    if (k === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
}

const retangulo = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** A camada do chão, desenhada uma vez. */
function desenharChao(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = LARGURA;
  c.height = ALTURA;
  const ctx = c.getContext('2d')!;
  // os lados da laje na beirada da frente (o mapa é uma ilha, como na amostra da Kenney)
  for (let k = 0; k < MAPA; k++) {
    for (const [i, j, face] of [
      [k, MAPA - 1, 'sw'],
      [MAPA - 1, k, 'se'],
    ] as const) {
      const rua = ehRua(i, j);
      const [ax, ay] = face === 'sw' ? tela(i, j + 1) : tela(i + 1, j);
      const [bx, by] = tela(i + 1, j + 1);
      const faixa = (t: number, h: number, cor: string) => {
        ctx.beginPath();
        ctx.moveTo(ax, ay + t);
        ctx.lineTo(bx, by + t);
        ctx.lineTo(bx, by + t + h);
        ctx.lineTo(ax, ay + t + h);
        ctx.closePath();
        ctx.fillStyle = cor;
        ctx.fill();
      };
      if (face === 'sw') {
        faixa(0, 18, rua ? COR.ladoAsfaltoSW : COR.ladoClaroSW);
        faixa(18, LAJE - 18, COR.ladoTerraSW);
      } else {
        faixa(0, 18, rua ? COR.ladoAsfaltoSE : COR.ladoClaroSE);
        faixa(18, LAJE - 18, COR.ladoTerraSE);
      }
    }
  }
  for (let i = 0; i < MAPA; i++)
    for (let j = 0; j < MAPA; j++) {
      if (ehRua(i, j)) losango(ctx, retangulo(i, j, i + 1, j + 1), i === C0 && j === C0 ? COR.asfaltoCruz : COR.asfalto);
      else if (ehCalcada(i, j)) {
        losango(ctx, retangulo(i, j, i + 1, j + 1), COR.calcadaBorda);
        losango(ctx, retangulo(i + 0.04, j + 0.04, i + 0.96, j + 0.96), COR.calcada);
      }
    }
  // a faixa amarela do meio, tracejada, e as faixas de pedestres em volta do cruzamento
  const m = (C0 + C1) / 2;
  for (let k = 0; k < MAPA; k++) {
    if (k === C0) continue;
    for (let t = 0; t < 1; t += 0.5) {
      const a = k + t + 0.1;
      const b = k + t + 0.35;
      losango(ctx, retangulo(a, m - 0.02, b, m + 0.02), COR.meio);
      losango(ctx, retangulo(m - 0.02, a, m + 0.02, b), COR.meio);
    }
  }
  for (let n = 0; n < 5; n++) {
    const a = C0 + 0.06 + n * 0.18;
    const b = a + 0.1;
    losango(ctx, retangulo(C0 - 0.14, a, C0 - 0.02, b), COR.faixa);
    losango(ctx, retangulo(C1 + 0.02, a, C1 + 0.14, b), COR.faixa);
    losango(ctx, retangulo(a, C0 - 0.14, b, C0 - 0.02), COR.faixa);
    losango(ctx, retangulo(a, C1 + 0.02, b, C1 + 0.14), COR.faixa);
  }
  return c;
}

interface Fumaca {
  x: number;
  y: number;
  ate: number;
}

interface Placa {
  x: number;
  y: number;
  texto: string;
  ate: number;
  grande: boolean;
}

export interface Imagens {
  predios: HTMLImageElement;
  veiculos: HTMLImageElement;
}

export function carregarImagens(base: string): Promise<Imagens> {
  const uma = (nome: string) =>
    new Promise<HTMLImageElement>((ok, falhou) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => falhou(new Error(nome));
      img.src = `${base}transito/${nome}.png`;
    });
  return Promise.all([uma('predios'), uma('veiculos')]).then(([predios, veiculos]) => ({ predios, veiculos }));
}

/** Para onde o carro aponta, na ordem das folhas: NE, SE, SW, NW. */
function direcao(dx: number, dy: number): number {
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 1 : 3;
  return dy > 0 ? 2 : 0;
}

/** As teclas de cada entrada, pela ponta do mapa de onde ela vem: Q no alto à esquerda, E no alto à direita, C e Z embaixo. */
export const TECLAS = ['q', 'e', 'c', 'z'];

/**
 * O ponto de cada entrada onde fica a plaquinha da tecla: ao lado do começo da fila, na calçada da frente (a linha e a coluna 4, onde
 * não há prédio), do lado que for dela.
 */
function lugarDaPlaca(entrada: number): [number, number] {
  const cam = CAMINHOS[entrada * 3];
  const [x0, y0, x1, y1] = cam.pts;
  const s = cam.parada - 1.5;
  const aoLongoDeX = Math.abs(x1 - x0) > Math.abs(y1 - y0);
  const sinal = aoLongoDeX ? Math.sign(x1 - x0) : Math.sign(y1 - y0);
  const lado = C1 + 0.25;
  return aoLongoDeX ? [x0 + sinal * s, lado] : [lado, y0 + sinal * s];
}

export class DesenhoDoTransito {
  private chao: HTMLCanvasElement;
  private fumacas: Fumaca[] = [];
  private placas: Placa[] = [];
  private mostrarTeclas: boolean;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private img: Imagens,
    { teclas = true }: { teclas?: boolean } = {},
  ) {
    this.chao = desenharChao();
    this.mostrarTeclas = teclas;
  }

  batida(x: number, y: number, passo: number) {
    this.fumacas.push({ x, y, ate: passo + TRAVA_PASSOS });
  }

  placa(x: number, y: number, texto: string, passo: number, grande = false) {
    this.placas.push({ x, y, texto, ate: passo + (grande ? 70 : 45), grande });
  }

  /** A entrada sob o ponto (em pixels do canvas), pela fila: o clique perto dos carros parados ou da rua deles. */
  entradaEm(px: number, py: number): number {
    let melhor = -1;
    let dist = 46 * 46;
    for (let e = 0; e < 4; e++) {
      const cam = CAMINHOS[e * 3];
      const [ax, ay] = tela(cam.pts[0], cam.pts[1]);
      const [bx, by] = tela(cam.pts[2], cam.pts[3]);
      const vx = bx - ax;
      const vy = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
      const dx = px - (ax + vx * t);
      const dy = py - (ay + vy * t);
      const d = dx * dx + dy * dy;
      if (d < dist) {
        dist = d;
        melhor = e;
      }
    }
    return melhor;
  }

  desenhar(e: Estado, tempo: number) {
    const { ctx } = this;
    ctx.clearRect(0, 0, LARGURA, ALTURA);
    ctx.drawImage(this.chao, 0, 0);
    // o cruzamento travado fica vermelho por baixo dos carros
    if (e.passo < e.travaAte) {
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(tempo / 90);
      losango(ctx, retangulo(C0, C0, C1, C1), '#d9483b');
      ctx.globalAlpha = 1;
    }

    type Coisa = { chave: number; f: () => void };
    const coisas: Coisa[] = [];
    for (let i = 0; i < MAPA; i++)
      for (let j = 0; j < MAPA; j++) {
        const h = misturar(i, j);
        if (!ehRua(i, j) && !ehCalcada(i, j)) coisas.push({ chave: i + j + 1, f: () => this.predio(i, j, h % PREDIOS.length) });
        else if (ehCalcada(i, j) && h % 3 === 0) {
          // um arbusto no canto da calçada mais longe da rua
          const x = i + (i === C1 ? 0.75 : 0.5);
          const y = j + (j === C1 ? 0.75 : 0.5);
          coisas.push({ chave: x + y, f: () => this.arbusto(x, y) });
        }
      }
    const primeiros = new Set<number>();
    for (let k = 0; k < 4; k++) {
      const c = primeiroDaFila(e, k);
      if (c) primeiros.add(c.id);
    }
    for (const c of e.carros) coisas.push({ chave: c.x + c.y, f: () => this.carro(c, e.passo, tempo, primeiros.has(c.id)) });
    coisas.sort((a, b) => a.chave - b.chave);
    for (const c of coisas) c.f();

    this.fumacas = this.fumacas.filter((f) => f.ate > e.passo);
    for (const f of this.fumacas) this.fumaca(f, e.passo, tempo);
    if (this.mostrarTeclas) for (let k = 0; k < 4; k++) this.plaquinha(k, naFila(e, k), tempo);
    this.placas = this.placas.filter((p) => p.ate > e.passo);
    for (const p of this.placas) {
      const [sx, sy] = tela(p.x, p.y);
      const falta = (p.ate - e.passo) / (p.grande ? 70 : 45);
      ctx.globalAlpha = Math.min(1, falta * 2);
      ctx.font = `bold ${p.grande ? 26 : 18}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(30, 30, 40, 0.8)';
      const y = sy - 30 - (1 - falta) * 26;
      ctx.strokeText(p.texto, sx, y);
      ctx.fillStyle = p.grande ? '#ffd54a' : '#ffffff';
      ctx.fillText(p.texto, sx, y);
      ctx.globalAlpha = 1;
    }
  }

  private predio(i: number, j: number, qual: number) {
    const { ctx } = this;
    const [x, y, w, h] = PREDIOS[qual];
    const [cx, cy] = tela(i + 0.5, j + 0.5);
    const esq = cx - MEIA_L;
    const dir = cx + MEIA_L;
    const baixo = cy + MEIA_A;
    // corta os lados da laje, a não ser na beirada da frente
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(esq, cy - 200);
    ctx.lineTo(esq, cy);
    if (j === MAPA - 1) {
      ctx.lineTo(esq, cy + LAJE + 2);
      ctx.lineTo(cx, baixo + LAJE + 2);
    } else ctx.lineTo(cx, baixo);
    if (i === MAPA - 1) {
      ctx.lineTo(cx, baixo + LAJE + 2);
      ctx.lineTo(dir, cy + LAJE + 2);
    }
    ctx.lineTo(dir, cy);
    ctx.lineTo(dir, cy - 200);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(this.img.predios, x, y, w, h, cx - 66, cy - 59, w, h);
    ctx.restore();
  }

  private arbusto(x: number, y: number) {
    const { ctx } = this;
    const [sx, sy] = tela(x, y);
    ctx.fillStyle = 'rgba(40, 40, 30, 0.18)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COR.arbustoSombra;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 6, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COR.arbusto;
    ctx.beginPath();
    ctx.ellipse(sx - 2, sy - 9, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private carro(c: Carro, passo: number, tempo: number, primeiro: boolean) {
    const { ctx } = this;
    const pele = c.tipo === 'ambulancia' ? VEICULOS.length - 1 : c.pele % (VEICULOS.length - 1);
    const [x, y, w, h] = VEICULOS[pele][direcao(c.dx, c.dy)];
    // um tico maiores que na folha, para ler bem numa janela menor
    const dw = w * ESCALA_DO_CARRO;
    const dh = h * ESCALA_DO_CARRO;
    let [sx, sy] = tela(c.x, c.y);
    if (c.batido) sx += Math.sin(tempo / 25 + c.id) * 1.5;
    // o carro que vem de fora do mapa aparece aos poucos
    const borda = Math.min(c.x + 0.7, c.y + 0.7, MAPA + 0.7 - c.x, MAPA + 0.7 - c.y);
    ctx.globalAlpha = Math.max(0, Math.min(1, borda / 0.5));
    ctx.fillStyle = 'rgba(20, 20, 30, 0.22)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(this.img.veiculos, x, y, w, h, Math.round(sx - dw / 2), Math.round(sy - dh + 9), dw, dh);
    if (c.tipo === 'ambulancia' && !c.batido) {
      const azul = Math.floor(passo / 12) % 2 === 0;
      ctx.fillStyle = azul ? '#4aa8ff' : '#ff4a4a';
      ctx.beginPath();
      ctx.arc(sx, sy - dh + 6, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // a seta: para onde o carro vai virar, na direção da tela da rua de saída (pisca, como o pisca-pisca)
    if (!c.liberado && !c.batido && c.manobra !== 'reto' && Math.floor(passo / 18) % 2 === 0) {
      const cam = CAMINHOS[c.caminho];
      const n = cam.pts.length;
      const [ax, ay] = tela(cam.pts[n - 4], cam.pts[n - 3]);
      const [bx, by] = tela(cam.pts[n - 2], cam.pts[n - 1]);
      this.seta(sx, sy - dh - 2, bx - ax, by - ay);
    }
    // o primeiro da fila tem um anel embaixo: é ele que sai no próximo clique
    if (primeiro && !c.liberado) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, 18, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private seta(sx: number, sy: number, vx: number, vy: number) {
    const { ctx } = this;
    const l = Math.sqrt(vx * vx + vy * vy) || 1;
    const ux = vx / l;
    const uy = vy / l;
    ctx.fillStyle = '#ffb02e';
    ctx.strokeStyle = 'rgba(40, 30, 10, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + ux * 9, sy + uy * 9);
    ctx.lineTo(sx - uy * 6 - ux * 4, sy + ux * 6 - uy * 4);
    ctx.lineTo(sx + uy * 6 - ux * 4, sy - ux * 6 - uy * 4);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }

  private fumaca(f: Fumaca, passo: number, tempo: number) {
    const { ctx } = this;
    const [sx, sy] = tela(f.x, f.y);
    const idade = TRAVA_PASSOS - (f.ate - passo);
    // o estalo: uma estrela que some depressa
    if (idade < 24) {
      const r = 14 + idade;
      ctx.fillStyle = `rgba(255, 214, 74, ${1 - idade / 24})`;
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const rr = k % 2 === 0 ? r : r * 0.45;
        ctx.lineTo(sx + Math.cos(a) * rr, sy - 12 + Math.sin(a) * rr * 0.7);
      }
      ctx.closePath();
      ctx.fill();
    }
    // a fumaça, subindo
    for (let k = 0; k < 4; k++) {
      const t = ((tempo / 900 + k / 4) % 1 + 1) % 1;
      ctx.fillStyle = `rgba(110, 110, 120, ${0.55 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(sx + Math.sin(k * 2.1 + t * 3) * 6, sy - 14 - t * 34, 6 + t * 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private plaquinha(entrada: number, fila: number, tempo: number) {
    const { ctx } = this;
    const [x, y] = lugarDaPlaca(entrada);
    const [sx, sy] = tela(x, y);
    const cheia = fila >= FILA_MAX - 1;
    const pulsa = cheia ? 1 + 0.12 * Math.sin(tempo / 80) : 1;
    ctx.save();
    ctx.translate(sx, sy - 8);
    ctx.scale(pulsa, pulsa);
    ctx.fillStyle = cheia ? '#d9483b' : 'rgba(35, 38, 48, 0.82)';
    ctx.beginPath();
    ctx.roundRect(-13, -13, 26, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(TECLAS[entrada].toUpperCase(), 0, 1);
    ctx.restore();
  }
}
