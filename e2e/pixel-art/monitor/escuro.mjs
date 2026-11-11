// O MONITOR DA MESA, POR CÓDIGO (10/11/2026, relato dele sobre a moldura creme do PixelLab: "esse monitor não parece o mesmo do
// quarto"). A moldura da lista de Mini-games é o MESMO monitor que está na mesa do quarto: as cores são as dele, tiradas da vista
// sudeste da mesa (quarto/novo/quarto/avulsos/mesa-teclado-giros/south-east.png), e a forma é desenhada aqui, sem geração:
// contorno preto, moldura cinza-arroxeada com o realce no alto e à esquerda, a tela afundada (a borda de cima escura, a de baixo
// clara), o LED vermelho no canto de baixo; embaixo, o pé curto, o teclado e o mouse no mousepad.
//   node e2e/pixel-art/monitor/escuro.mjs   → web/src/assets/quarto/monitor.png (o 9-slice: 9 9 13 9) e monitor-mesa.png
// (fatiar.mjs, da moldura creme, ficou de registro: rodá-lo de novo sobrescreve estas imagens.)
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, gravar64 } from '../quarto/imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const DESTINO = path.join(AQUI, '..', '..', '..', 'web', 'src', 'assets', 'quarto');

// As cores do monitor da mesa (contadas no desenho dela)
const COR = {
  contorno: [1, 1, 1], // A
  realce: [101, 91, 106], // B: o alto e a esquerda da moldura
  brilho: [134, 109, 115], // C: o brilho do canto de cima
  moldura: [69, 59, 78], // D: a moldura
  sombra: [65, 54, 73], // E: a direita e o pé da moldura
  borda: [114, 95, 103], // H: a borda clara de baixo da tela
  funda: [60, 49, 67], // J: a borda de cima da tela, afundada
  escuro: [44, 32, 51], // M: a base do pé
  led: [214, 70, 60], // o LED (vermelho, como pediu)
  ledEscuro: [134, 65, 60], // N: o vermelho mais escuro da mesa
};

const W = 40, H = 40, R = 5; // a moldura: 9 de cada lado, 13 embaixo (o LED mora no canto, que não estica)
const TOPO = 9, ESQ = 9, DIR = 9, BAIXO = 13;

function moldura() {
  const px = Array.from({ length: H }, () => Array(W).fill(null));
  const dentro = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const dx = Math.max(R - (x + 0.5), 0, x + 0.5 - (W - R)), dy = Math.max(R - (y + 0.5), 0, y + 0.5 - (H - R));
    return dx * dx + dy * dy <= R * R;
  };
  const buraco = (x, y) => x >= ESQ && x < W - DIR && y >= TOPO && y < H - BAIXO;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!dentro(x, y) || buraco(x, y)) continue;
    const borda = !dentro(x - 1, y) || !dentro(x + 1, y) || !dentro(x, y - 1) || !dentro(x, y + 1);
    // o anel preto em volta da tela
    const anel = x >= ESQ - 1 && x <= W - DIR && y >= TOPO - 1 && y <= H - BAIXO;
    if (borda || anel) { px[y][x] = COR.contorno; continue; }
    // a tela afundada: a borda de cima e a da esquerda escuras, a de baixo e a da direita claras
    const anel2 = x >= ESQ - 2 && x <= W - DIR + 1 && y >= TOPO - 2 && y <= H - BAIXO + 1;
    if (anel2) { px[y][x] = y === TOPO - 2 || x === ESQ - 2 ? COR.funda : COR.borda; continue; }
    // a moldura: o realce encostado no contorno de cima e da esquerda, a sombra no da direita e no de baixo
    if (!dentro(x, y - 2) || !dentro(x - 1, y - 1) && y < H / 2) px[y][x] = COR.realce;
    else if (!dentro(x - 2, y)) px[y][x] = COR.realce;
    else if (!dentro(x + 2, y) || !dentro(x, y + 2)) px[y][x] = COR.sombra;
    else px[y][x] = COR.moldura;
  }
  // o brilho do canto de cima à esquerda
  for (const [x, y] of [[3, 1], [4, 1], [5, 1], [1, 3], [1, 4]]) if (px[y][x] && px[y][x] !== COR.contorno) px[y][x] = COR.brilho;
  // o LED vermelho e o botão, no canto de baixo à direita (o canto não estica)
  const yLed = H - 7;
  px[yLed][W - 7] = COR.led; px[yLed][W - 6] = COR.ledEscuro;
  px[yLed][W - 4] = COR.funda; px[yLed + 1][W - 4] = COR.contorno;
  return px;
}

// EMBAIXO DO MONITOR, A MESA (relato dele, 10/11/2026: "o monitor possui mouse, teclado e está na horizontal"): o pé curto do
// monitor, o teclado na frente e o mouse no mousepad ao lado, de frente e com poucos pixels, nas cores da mesma vista da mesa.
const TECLA = [75, 65, 84], TECLA_ALTA = [101, 91, 106], TECLA_LUZ = [114, 95, 103], RISCO = [12, 5, 10];
function mesa() {
  const w = 160, h = 22;
  const px = Array.from({ length: h }, () => Array(w).fill(null));
  const por = (x, y, cor) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y][x] = cor; };
  // o pé curto: o pescoço (4 linhas) e a base achatada
  for (let y = 0; y < 4; y++) for (let x = 74; x <= 85; x++) por(x, y, x === 74 || x === 85 ? COR.contorno : x === 75 ? COR.moldura : COR.funda);
  for (const [y, a, b] of [[4, 67, 92], [5, 65, 94], [6, 65, 94], [7, 67, 92]]) for (let x = a; x <= b; x++) {
    por(x, y, x === a || x === b || y === 7 || (y === 4 && (x < 75 || x > 84)) ? COR.contorno : y === 5 ? COR.realce : COR.moldura);
  }
  // o teclado: a placa escura com as teclas em três fileiras e a barra de espaço
  const [kx0, kx1, ky0, ky1] = [35, 124, 10, 21];
  for (let y = ky0; y <= ky1; y++) for (let x = kx0; x <= kx1; x++) {
    const canto = (x === kx0 || x === kx1) && (y === ky0 || y === ky1);
    if (canto) continue;
    const borda = x === kx0 || x === kx1 || y === ky0 || y === ky1;
    por(x, y, borda ? COR.contorno : y === ky1 - 1 ? COR.escuro : COR.moldura);
  }
  const tecla = (x, y, largura) => {
    for (let i = 0; i < largura; i++) { por(x + i, y, i === 0 ? TECLA_LUZ : TECLA_ALTA); por(x + i, y + 1, TECLA); }
  };
  for (const [y, inicio] of [[12, 38], [15, 40]]) for (let x = inicio; x + 3 <= kx1 - 2; x += 4) tecla(x, y, 3);
  // a última fileira: teclas curtas nas pontas e a barra de espaço no meio
  for (const x of [38, 42, 46]) tecla(x, 18, 3);
  tecla(51, 18, 47);
  for (const x of [100, 104, 108, 112, 116]) tecla(x, 18, 3);
  // o mousepad e o mouse em cima
  const [mx0, mx1, my0, my1] = [130, 158, 12, 21];
  for (let y = my0; y <= my1; y++) for (let x = mx0; x <= mx1; x++) {
    if ((x === mx0 || x === mx1) && (y === my0 || y === my1)) continue;
    por(x, y, x === mx0 || x === mx1 || y === my0 || y === my1 ? COR.contorno : y === my1 - 1 ? COR.escuro : COR.sombra);
  }
  const [ox0, ox1, oy0, oy1] = [140, 147, 13, 20];
  for (let y = oy0; y <= oy1; y++) for (let x = ox0; x <= ox1; x++) {
    if ((x === ox0 || x === ox1) && (y === oy0 || y === oy1)) continue;
    if ((x === ox0 + 1 || x === ox1 - 1) && y === oy0) continue;
    const borda = x === ox0 || x === ox1 || y === oy0 || y === oy1 || ((x === ox0 + 1 || x === ox1 - 1) && y === oy0 + 1);
    por(x, y, borda ? COR.contorno : y === oy0 + 1 ? TECLA_LUZ : x === ox0 + 1 ? TECLA_ALTA : TECLA);
  }
  for (let y = oy0 + 1; y <= oy0 + 2; y++) por(143, y, RISCO); // os dois botões
  return px;
}

const p = await abrir();
const png = (px) => p.evaluate((px) => {
  const c = document.createElement('canvas'); c.width = px[0].length; c.height = px.length;
  const g = c.getContext('2d'); const im = g.createImageData(c.width, c.height);
  px.forEach((l, y) => l.forEach((cor, x) => { if (!cor) return; const i = (y * c.width + x) * 4; im.data.set([...cor, 255], i); }));
  g.putImageData(im, 0, 0);
  return c.toDataURL('image/png').split(',')[1];
}, px);
gravar64(path.join(DESTINO, 'monitor.png'), await png(moldura()));
gravar64(path.join(DESTINO, 'monitor-mesa.png'), await png(mesa()));
await fechar();
for (const velho of ['monitor-botoes.png', 'monitor-pe.png']) fs.rmSync(path.join(DESTINO, velho), { force: true });
console.log('monitor escuro →', DESTINO);
