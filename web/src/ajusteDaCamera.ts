/**
 * OS AJUSTES DA IMAGEM DA CÂMERA (23/11/2026, pedido dele, depois de usar o celular como câmera: "senti falta de mais opções
 * de ajuste na imagem: enquadrar melhor, clicar e arrastar…"). Valem para qualquer câmera (a webcam e o celular) e são feitos
 * NESTE computador, antes do fundo da câmera, no mesmo processador da faixa (fundoDaCamera.ts):
 *   - ENQUADRAR: zoom (até 4×) e o ponto do meio, que se arrasta na prévia;
 *   - FORMATO: a imagem inteira, como vem, ou preenchendo 16:9 (o celular em pé vira um quadro deitado, sem faixas pretas);
 *   - ESPELHAR;
 *   - LUZ: brilho e contraste.
 * O recorte NÃO amplia: a imagem sai do tamanho do pedaço recortado (o zoom de 4× numa câmera de 720p sai com um quarto da
 * largura), porque inventar pixel só borraria e gastaria internet.
 */

export interface AjusteDaCamera {
  /** 1 a 4. */
  zoom: number;
  /** O meio do enquadramento, de 0 a 1 na imagem que chega (0,5 = o meio). */
  x: number;
  y: number;
  formato: 'inteira' | '16:9';
  espelhar: boolean;
  /** −1 a 1 (0 = como vem). */
  brilho: number;
  contraste: number;
}

export const AJUSTE_PADRAO: AjusteDaCamera = { zoom: 1, x: 0.5, y: 0.5, formato: 'inteira', espelhar: false, brilho: 0, contraste: 0 };
export const ZOOM_MAXIMO = 4;

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

/** O ajuste guardado, conferido (o que veio de outra versão ou foi mexido à mão volta para dentro dos limites). */
export function ajusteValido(a: Partial<AjusteDaCamera> | null | undefined): AjusteDaCamera {
  const b = { ...AJUSTE_PADRAO, ...(a ?? {}) };
  return {
    zoom: limitar(b.zoom, 1, ZOOM_MAXIMO),
    x: limitar(b.x, 0, 1),
    y: limitar(b.y, 0, 1),
    formato: b.formato === '16:9' ? '16:9' : 'inteira',
    espelhar: b.espelhar === true,
    brilho: limitar(b.brilho, -1, 1),
    contraste: limitar(b.contraste, -1, 1),
  };
}

/** Há algo a fazer? Sem ajuste nenhum, o quadro passa como veio (e nem processador é preciso). */
export function ajusteAtivo(a: AjusteDaCamera): boolean {
  return a.zoom > 1.001 || a.formato !== 'inteira' || a.espelhar || Math.abs(a.brilho) > 0.001 || Math.abs(a.contraste) > 0.001;
}

/** O pedaço da imagem que chega (sx, sy, sw, sh) e o tamanho do quadro que sai (pares, como os codificadores pedem). */
export function recorteDoAjuste(largura: number, altura: number, a: AjusteDaCamera) {
  let sw = largura;
  let sh = altura;
  if (a.formato === '16:9') {
    if (sw / sh > 16 / 9) sw = (sh * 16) / 9;
    else sh = (sw * 9) / 16;
  }
  sw /= a.zoom;
  sh /= a.zoom;
  // o meio, preso para o recorte não sair da imagem
  const cx = limitar(a.x * largura, sw / 2, largura - sw / 2);
  const cy = limitar(a.y * altura, sh / 2, altura - sh / 2);
  const par = (v: number) => Math.max(2, Math.floor(v / 2) * 2);
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh, saidaL: par(sw), saidaA: par(sh) };
}

/**
 * Arrastar na prévia: quanto o meio anda na imagem que chega, para o que está embaixo do dedo andar junto (arrastar para a
 * direita mostra o que estava à esquerda). `dx` e `dy` são frações do tamanho da prévia; com o espelho, o x inverte.
 */
export function arrastar(a: AjusteDaCamera, largura: number, altura: number, dx: number, dy: number): AjusteDaCamera {
  const { sw, sh } = recorteDoAjuste(largura, altura, a);
  const r = recorteDoAjuste(largura, altura, {
    ...a,
    x: a.x - ((a.espelhar ? -dx : dx) * sw) / largura,
    y: a.y - (dy * sh) / altura,
  });
  // guarda o meio já preso, para arrastar além da borda não acumular um "crédito" invisível
  return { ...a, x: (r.sx + r.sw / 2) / largura, y: (r.sy + r.sh / 2) / altura };
}

/** O filtro do canvas para a luz: brilho e contraste de 0,5× a 1,5×. */
export function filtroDaLuz(a: AjusteDaCamera): string {
  const partes: string[] = [];
  if (Math.abs(a.brilho) > 0.001) partes.push(`brightness(${(1 + a.brilho * 0.5).toFixed(3)})`);
  if (Math.abs(a.contraste) > 0.001) partes.push(`contrast(${(1 + a.contraste * 0.5).toFixed(3)})`);
  return partes.join(' ') || 'none';
}

/**
 * Aplica o ajuste num quadro, pela placa (um OffscreenCanvas 2D: drawImage com o pedaço, o espelho e o filtro). Devolve um
 * quadro NOVO; o de entrada continua de quem chamou.
 */
export class Ajustador {
  private canvas = new OffscreenCanvas(2, 2);
  private ctx = this.canvas.getContext('2d', { alpha: false });

  ajustar(quadro: VideoFrame, a: AjusteDaCamera): VideoFrame | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const { sx, sy, sw, sh, saidaL, saidaA } = recorteDoAjuste(quadro.displayWidth, quadro.displayHeight, a);
    if (this.canvas.width !== saidaL || this.canvas.height !== saidaA) {
      this.canvas.width = saidaL;
      this.canvas.height = saidaA;
    }
    ctx.setTransform(a.espelhar ? -1 : 1, 0, 0, 1, a.espelhar ? saidaL : 0, 0);
    ctx.filter = filtroDaLuz(a);
    ctx.drawImage(quadro, sx, sy, sw, sh, 0, 0, saidaL, saidaA);
    return new VideoFrame(this.canvas, { timestamp: quadro.timestamp, duration: quadro.duration ?? undefined });
  }
}

/** O tamanho da imagem que CHEGA ao processador (antes do recorte): a prévia precisa dele para o arrastar andar junto. */
export const entradaDaCamera = { largura: 0, altura: 0 };
