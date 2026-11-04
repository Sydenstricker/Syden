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
    ctx.fillStyle = '#fff8d6';
    ctx.strokeStyle = '#4a3420';
    ctx.lineWidth = 2;
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const texto = `+${queda.pontos}`;
    ctx.strokeText(texto, queda.x, queda.y - 10 - 18 * s);
    ctx.fillText(texto, queda.x, queda.y - 10 - 18 * s);
    ctx.restore();
  }
  // o clarão do tiro
  if (q.tiro && q.agora - q.tiro.em < 120) {
    ctx.fillStyle = `rgba(255, 250, 210, ${1 - (q.agora - q.tiro.em) / 120})`;
    ctx.beginPath();
    ctx.arc(q.tiro.x, q.tiro.y, 5, 0, Math.PI * 2);
    ctx.fill();
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
