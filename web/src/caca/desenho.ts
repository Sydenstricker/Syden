import { ALTURA, CHAO, LARGURA, type Praga, posicao } from './voo';

/**
 * O DESENHO DA CAÇA ÀS PRAGAS DA HORTA (04/11/2026), todo por código, numa tela de 320 × 180 ampliada em pixels inteiros (como
 * a corrida e o golfe): o céu, os morros, a cerca e a horta são pintados uma vez; os corvos e os gafanhotos, a cada quadro.
 * Nada de imagem de ninguém: as pragas são formas simples, no estilo dos outros jogos do fliperama.
 */

/** O cenário parado, pintado uma vez numa tela à parte. */
export function pintarCenario(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = LARGURA;
  c.height = ALTURA;
  const ctx = c.getContext('2d')!;
  // o céu, de cima para baixo
  const ceu = ctx.createLinearGradient(0, 0, 0, CHAO);
  ceu.addColorStop(0, '#7fb6e0');
  ceu.addColorStop(1, '#d6ecf5');
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, LARGURA, CHAO);
  // o sol e duas nuvens
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(272, 30, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y, r] of [
    [60, 34, 9],
    [72, 30, 11],
    [86, 35, 8],
    [180, 54, 7],
    [190, 50, 9],
    [201, 55, 6],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // os morros ao longe
  ctx.fillStyle = '#8fbf7a';
  ctx.beginPath();
  ctx.moveTo(0, CHAO - 14);
  for (let x = 0; x <= LARGURA; x += 8) ctx.lineTo(x, CHAO - 18 - 10 * Math.sin(x / 47) - 6 * Math.sin(x / 19));
  ctx.lineTo(LARGURA, CHAO);
  ctx.lineTo(0, CHAO);
  ctx.fill();
  ctx.fillStyle = '#6fa75d';
  ctx.beginPath();
  ctx.moveTo(0, CHAO);
  for (let x = 0; x <= LARGURA; x += 8) ctx.lineTo(x, CHAO - 7 - 5 * Math.sin(x / 31 + 2));
  ctx.lineTo(LARGURA, CHAO);
  ctx.fill();
  // a cerca
  ctx.fillStyle = '#b98a5a';
  ctx.fillRect(0, CHAO - 9, LARGURA, 2);
  ctx.fillRect(0, CHAO - 4, LARGURA, 2);
  for (let x = 4; x < LARGURA; x += 16) ctx.fillRect(x, CHAO - 13, 3, 13);
  // a terra da horta, com os canteiros
  ctx.fillStyle = '#7a5236';
  ctx.fillRect(0, CHAO, LARGURA, ALTURA - CHAO);
  ctx.fillStyle = '#6a452c';
  for (let y = CHAO + 8; y < ALTURA; y += 12) ctx.fillRect(0, y, LARGURA, 4);
  // as cenouras e as alfaces (o que as pragas querem)
  for (let fileira = 0, y = CHAO + 6; y < ALTURA - 2; y += 12, fileira++) {
    for (let x = 10 + (fileira % 2) * 9; x < LARGURA; x += 18) {
      if ((x + fileira) % 3 === 0) {
        ctx.fillStyle = '#5c9e3c';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8bc65a';
        ctx.beginPath();
        ctx.arc(x - 1, y - 1, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#e07a2a';
        ctx.fillRect(x - 1, y, 3, 3);
        ctx.fillStyle = '#4f9a3a';
        ctx.fillRect(x - 2, y - 4, 1, 4);
        ctx.fillRect(x, y - 5, 1, 5);
        ctx.fillRect(x + 2, y - 4, 1, 4);
      }
    }
  }
  return c;
}

/** O corvo, virado para onde voa, com as asas batendo pelo tempo. */
function corvo(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, ms: number) {
  const asa = Math.sin(ms / 70);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(dir, 1);
  ctx.fillStyle = '#2c2a33';
  // a asa de trás
  ctx.beginPath();
  ctx.moveTo(-2, -1);
  ctx.lineTo(-7, -2 - 8 * asa);
  ctx.lineTo(3, -1);
  ctx.fill();
  // o corpo e o rabo
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-7, -1);
  ctx.lineTo(-12, -3);
  ctx.lineTo(-12, 3);
  ctx.lineTo(-7, 2);
  ctx.fill();
  // a cabeça, o bico e o olho
  ctx.beginPath();
  ctx.arc(7, -2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8a33a';
  ctx.beginPath();
  ctx.moveTo(10, -3);
  ctx.lineTo(14, -1.5);
  ctx.lineTo(10, -0.5);
  ctx.fill();
  ctx.fillStyle = '#f5f2e8';
  ctx.fillRect(7, -4, 1.5, 1.5);
  // a asa da frente
  ctx.fillStyle = '#3d3a47';
  ctx.beginPath();
  ctx.moveTo(-1, 0);
  ctx.lineTo(-4, 1 - 9 * asa);
  ctx.lineTo(5, 0);
  ctx.fill();
  ctx.restore();
}

/** O gafanhoto, de lado, com a perna grande de trás encolhendo no pulo. */
function gafanhoto(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, ms: number) {
  const pulo = Math.abs(Math.sin(ms / 180));
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(dir, 1);
  ctx.fillStyle = '#5f9e2f';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 3, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7cbf45';
  ctx.beginPath();
  ctx.arc(6, -1.5, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(7, -3, 1.2, 1.2);
  // as antenas
  ctx.strokeStyle = '#3f6f1f';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(7, -3.5);
  ctx.lineTo(12, -8);
  ctx.moveTo(6, -3.5);
  ctx.lineTo(10, -9);
  ctx.stroke();
  // a perna grande de trás
  ctx.strokeStyle = '#4a8526';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(-6, -5 + 3 * pulo);
  ctx.lineTo(-3 - 5 * pulo, 4);
  ctx.stroke();
  // as perninhas
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(2, 2);
  ctx.lineTo(3, 5);
  ctx.moveTo(4, 2);
  ctx.lineTo(6, 4.5);
  ctx.stroke();
  ctx.restore();
}

/** Uma praga que caiu: gira e despenca, com o "+pontos" subindo. */
export interface Queda {
  x: number;
  y: number;
  tipo: Praga['tipo'];
  dir: number;
  em: number;
  pontos: number;
  /** A dourada: os pontos sobem em dourado. */
  dourada?: boolean;
}

export interface Quadro {
  cenario: HTMLCanvasElement;
  /** O tempo da onda agora (ms), ou null antes de começar. */
  ms: number | null;
  pragas: Praga[];
  abatidas: ReadonlySet<number>;
  quedas: Queda[];
  agora: number;
  mira: { x: number; y: number } | null;
  /** O clarão do último tiro. */
  tiro: { x: number; y: number; em: number } | null;
  /** O multiplicador do combo agora (1, 2 ou 3): aparece no canto quando passa de 1. */
  multiplicador?: number;
}

export function desenhar(ctx: CanvasRenderingContext2D, q: Quadro) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(q.cenario, 0, 0);
  if (q.ms !== null) {
    q.pragas.forEach((p, i) => {
      if (q.abatidas.has(i)) return;
      const pos = posicao(p, q.ms!);
      if (!pos) return;
      const dir = p.vx >= 0 ? 1 : -1;
      if (p.dourada) brilhoDourado(ctx, pos.x, pos.y, q.ms! + i * 41);
      if (p.tipo === 'corvo') corvo(ctx, pos.x, pos.y, dir, q.ms! + i * 37);
      else gafanhoto(ctx, pos.x, pos.y, dir, q.ms! + i * 53);
    });
  }
  // as que caíram
  for (const queda of q.quedas) {
    const s = (q.agora - queda.em) / 1000;
    if (s > 1.2) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - s / 1.2);
    ctx.translate(queda.x, queda.y + 120 * s * s);
    ctx.rotate(queda.dir * s * 6);
    if (queda.tipo === 'corvo') corvo(ctx, 0, 0, queda.dir, 0);
    else gafanhoto(ctx, 0, 0, queda.dir, 0);
    ctx.restore();
    // as penas (ou as folhas) que voam, e os pontos
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - s / 0.8);
    ctx.fillStyle = queda.tipo === 'corvo' ? '#3d3a47' : '#7cbf45';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.fillRect(queda.x + Math.cos(a) * 22 * s, queda.y + Math.sin(a) * 16 * s + 20 * s * s, 2, 1);
    }
    ctx.globalAlpha = Math.max(0, 1 - s / 1.2);
    ctx.fillStyle = queda.dourada ? '#ffd23a' : '#fff8d6';
    ctx.strokeStyle = '#4a3420';
    ctx.lineWidth = 2;
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const texto = `+${queda.pontos}`;
    ctx.strokeText(texto, queda.x, queda.y - 10 - 18 * s);
    ctx.fillText(texto, queda.x, queda.y - 10 - 18 * s);
    ctx.restore();
  }
  // o clarão do tiro: a tela inteira acende um instante, e o ponto do tiro com o anel que abre (19/11/2026)
  if (q.tiro && q.agora - q.tiro.em < 140) {
    const k = (q.agora - q.tiro.em) / 140;
    if (k < 0.35) {
      ctx.fillStyle = `rgba(255, 250, 220, ${0.16 * (1 - k / 0.35)})`;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
    }
    ctx.fillStyle = `rgba(255, 250, 210, ${1 - k})`;
    ctx.beginPath();
    ctx.arc(q.tiro.x, q.tiro.y, 6 - 2 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 220, 140, ${1 - k})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(q.tiro.x, q.tiro.y, 6 + 10 * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  // o combo no canto (só o número: ×2, ×3)
  if (q.multiplicador && q.multiplicador > 1) {
    ctx.save();
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4a3420';
    ctx.fillStyle = q.multiplicador >= 3 ? '#ffd23a' : '#fff8d6';
    ctx.strokeText(`×${q.multiplicador}`, LARGURA - 6, 16);
    ctx.fillText(`×${q.multiplicador}`, LARGURA - 6, 16);
    ctx.restore();
  }
  // a mira
  if (q.mira) {
    const { x, y } = q.mira;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(40, 24, 16, 0.6)';
    desenharMira(ctx, x, y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#fff3e0';
    desenharMira(ctx, x, y);
  }
}

function desenharMira(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.moveTo(x - 11, y);
  ctx.lineTo(x - 4, y);
  ctx.moveTo(x + 4, y);
  ctx.lineTo(x + 11, y);
  ctx.moveTo(x, y - 11);
  ctx.lineTo(x, y - 4);
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x, y + 11);
  ctx.stroke();
}

/** O BRILHO DA DOURADA (19/11/2026): um halo amarelo atrás da praga, com faíscas que giram. */
function brilhoDourado(ctx: CanvasRenderingContext2D, x: number, y: number, ms: number) {
  ctx.save();
  ctx.globalAlpha = 0.45 + 0.2 * Math.sin(ms / 90);
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath();
  ctx.ellipse(x, y, 13, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff6c8';
  for (let k = 0; k < 4; k++) {
    const a = ms / 160 + (k * Math.PI) / 2;
    ctx.fillRect(Math.round(x + Math.cos(a) * 15), Math.round(y + Math.sin(a) * 10), 2, 2);
  }
  ctx.restore();
}

/**
 * O COELHO DA MOITA (19/11/2026): no fim da onda, ele sobe de trás da moita. Alegre (os braços para cima) quando a onda foi
 * boa; rindo (a mão na barriga, os olhos fechados de rir) quando quase tudo fugiu. Por código, sem texto. `s` é o tempo (ms)
 * desde que a cena começou.
 */
export function desenharCoelhoDaMoita(ctx: CanvasRenderingContext2D, w: number, h: number, alegre: boolean, s: number) {
  ctx.clearRect(0, 0, w, h);
  const sobe = Math.min(1, s / 450);
  const cx = Math.round(w / 2);
  const base = h - 8;
  const y = Math.round(base - 34 * sobe + (alegre ? Math.abs(Math.sin(s / 160)) * -3 : Math.sin(s / 70) * 1.5));
  // o coelho (atrás da moita)
  ctx.save();
  ctx.fillStyle = '#f2ece2';
  ctx.strokeStyle = '#4a3420';
  ctx.lineWidth = 1;
  // as orelhas
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + d * 5, y - 22, 3, 9, d * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f2b7b0';
    ctx.beginPath();
    ctx.ellipse(cx + d * 5, y - 22, 1.3, 6, d * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2ece2';
  }
  // o corpo e a cabeça
  ctx.beginPath();
  ctx.ellipse(cx, y + 8, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, y - 6, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // os braços
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f2ece2';
  ctx.beginPath();
  if (alegre) {
    const balanco = Math.sin(s / 120) * 3;
    ctx.moveTo(cx - 8, y + 4);
    ctx.lineTo(cx - 15, y - 10 + balanco);
    ctx.moveTo(cx + 8, y + 4);
    ctx.lineTo(cx + 15, y - 10 - balanco);
  } else {
    ctx.moveTo(cx - 8, y + 4);
    ctx.lineTo(cx - 2, y + 11);
    ctx.moveTo(cx + 8, y + 4);
    ctx.lineTo(cx + 2, y + 11);
  }
  ctx.stroke();
  // o rosto
  ctx.fillStyle = '#2a2a2a';
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1;
  if (alegre) {
    ctx.fillRect(cx - 4, y - 8, 2, 2);
    ctx.fillRect(cx + 2, y - 8, 2, 2);
    ctx.beginPath();
    ctx.arc(cx, y - 4, 3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    // os olhos fechados de rir e a boca aberta
    ctx.beginPath();
    ctx.moveTo(cx - 5, y - 7);
    ctx.lineTo(cx - 3, y - 9);
    ctx.lineTo(cx - 1, y - 7);
    ctx.moveTo(cx + 1, y - 7);
    ctx.lineTo(cx + 3, y - 9);
    ctx.lineTo(cx + 5, y - 7);
    ctx.stroke();
    ctx.fillStyle = '#7a2e2e';
    ctx.beginPath();
    ctx.ellipse(cx, y - 2, 3, 2 + Math.abs(Math.sin(s / 70)), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // a moita, na frente
  ctx.fillStyle = '#4f8a35';
  for (const [dx, r] of [[-16, 10], [0, 13], [16, 10], [-8, 9], [8, 9]] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx, base, r, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = '#6aa64a';
  for (const [dx, dy] of [[-12, -6], [4, -9], [14, -4], [-3, -3]] as const) ctx.fillRect(cx + dx, base + dy, 2, 2);
  // as estrelinhas da alegria
  if (alegre) {
    ctx.fillStyle = '#ffd23a';
    for (let k = 0; k < 3; k++) {
      const a = s / 300 + (k * 2 * Math.PI) / 3;
      ctx.fillRect(Math.round(cx + Math.cos(a) * 24), Math.round(y - 12 + Math.sin(a) * 8), 2, 2);
    }
  }
}
