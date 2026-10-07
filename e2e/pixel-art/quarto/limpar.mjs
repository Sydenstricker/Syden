// Tira das peças escolhidas o que veio junto sem ser pedido (um pedaço de parede, uma planta, um mata-moscas)
// e apara a transparência em volta. Resultado em pecas/<id>.png, e o tamanho de cada uma em pecas/pecas.json.
//   node e2e/pixel-art/quarto/limpar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from './imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');

// A variação escolhida de cada peça, e como limpar:
//   maior: fica só a maior mancha conectada (o objeto), o resto some.
//   caixa [x,y,w,h]: fica só o que está dentro da caixa (para peças feitas de várias manchas, como o varal de fotos).
//   fundo: o fundo escuro em volta do quarto vira transparente (só a casca, gerada com fundo).
//   reduzir: divide o tamanho por um inteiro (pixel art só se reduz assim).
export const ESCOLHAS = {
  casca: { arquivo: 'casca-1', fundo: true },
  cama: { arquivo: 'cama-1', maior: true },
  coelho: { arquivo: 'coelho-8', maior: true },
  estante: { arquivo: 'estante-1', maior: true },
  mesa: { arquivo: 'mesa-1', maior: true },
  fone: { arquivo: 'fone-15', maior: true, reduzir: 2 },
  janela: { arquivo: 'janela-1', caixa: [20, 0, 76, 80], maior: true },
  poster: { arquivo: 'poster-1', maior: true },
  gato: { arquivo: 'gato-1', maior: true },
  tapete: { arquivo: 'tapete-2', maior: true },
  prateleira: { arquivo: 'prateleira-13', maior: true },
  'guarda-roupa': { arquivo: 'guarda-roupa-3', maior: true },
  porta: { arquivo: 'porta-4', caixa: [40, 10, 56, 83], maior: true },
  mural: { arquivo: 'mural-11', caixa: [0, 0, 48, 20] },
  cortica: { arquivo: 'cortica-5', maior: true },
  vaso: { arquivo: 'vaso-16', maior: true },
};

if (process.argv[1]?.endsWith('limpar.mjs')) {
  const p = await abrir();
  fs.mkdirSync(path.join(AQUI, 'pecas'), { recursive: true });
  const medidas = {};
  for (const [id, op] of Object.entries(ESCOLHAS)) {
    const b64 = ler64(path.join(AQUI, 'saida', 'pixellab', op.arquivo + '.png'));
    const r = await p.evaluate(async ({ b64, op }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const W = img.width, H = img.height;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, W, H); const a = d.data;
      const idx = (x, y) => (y * W + x) * 4;
      if (op.fundo) {
        // Inunda a partir das bordas tudo o que for da cor do fundo (escuro e quase cinza).
        const escuro = (i) => a[i] + a[i + 1] + a[i + 2] < 110 && Math.max(a[i], a[i + 1], a[i + 2]) - Math.min(a[i], a[i + 1], a[i + 2]) < 20;
        const fila = []; const visto = new Uint8Array(W * H);
        for (let x = 0; x < W; x++) fila.push([x, 0], [x, H - 1]);
        for (let y = 0; y < H; y++) fila.push([0, y], [W - 1, y]);
        while (fila.length) {
          const [x, y] = fila.pop();
          if (x < 0 || y < 0 || x >= W || y >= H || visto[y * W + x]) continue;
          visto[y * W + x] = 1;
          const i = idx(x, y);
          if (!escuro(i)) continue;
          a[i + 3] = 0;
          fila.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
      }
      for (let i = 0; i < a.length; i += 4) a[i + 3] = a[i + 3] < 128 ? 0 : 255;
      if (op.caixa) {
        const [bx, by, bw, bh] = op.caixa;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < bx || y < by || x >= bx + bw || y >= by + bh) a[idx(x, y) + 3] = 0;
      }
      if (op.maior) {
        const rot = new Int32Array(W * H).fill(-1); const tam = [];
        for (let s = 0; s < W * H; s++) {
          if (rot[s] !== -1 || a[s * 4 + 3] === 0) continue;
          const id = tam.length; let n = 0; const pilha = [s]; rot[s] = id;
          while (pilha.length) {
            const q = pilha.pop(); n++;
            const x = q % W, y = (q / W) | 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              const nq = ny * W + nx;
              if (rot[nq] === -1 && a[nq * 4 + 3]) { rot[nq] = id; pilha.push(nq); }
            }
          }
          tam.push(n);
        }
        const fica = tam.indexOf(Math.max(...tam));
        for (let s = 0; s < W * H; s++) if (rot[s] !== fica) a[s * 4 + 3] = 0;
      }
      g.putImageData(d, 0, 0);
      // Apara.
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a[idx(x, y) + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const k = op.reduzir ?? 1;
      const w = Math.ceil((x1 - x0 + 1) / k), h = Math.ceil((y1 - y0 + 1) / k);
      const o = document.createElement('canvas'); o.width = w; o.height = h;
      const og = o.getContext('2d'); og.imageSmoothingEnabled = false;
      og.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, w, h);
      return { b64: o.toDataURL('image/png').split(',')[1], w, h };
    }, { b64, op });
    gravar64(path.join(AQUI, 'pecas', id + '.png'), r.b64);
    medidas[id] = { w: r.w, h: r.h, de: op.arquivo };
    console.log(id, r.w + 'x' + r.h);
  }
  fs.writeFileSync(path.join(AQUI, 'pecas', 'pecas.json'), JSON.stringify(medidas, null, 2) + '\n');
  await fechar();
}
