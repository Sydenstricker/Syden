// Fatia a moldura escolhida (opcoes/monitor-<n>.png) nas peças que o site usa (web/src/assets/quarto/):
//   monitor.png        — só a moldura, com a tela vazia (o 9-slice do border-image: 12 13 16 13 px, topo/dir./baixo/esq.)
//   monitor-pe.png     — o pescoço e a base, desenhados embaixo da moldura
//   monitor-botoes.png — os enfeites que não podem esticar (a grade de ventilação, o botão, o LED e o botão de força),
//                        numa folha só, tirados da moldura e repostos no lugar pelo CSS
// As medidas são da opção 2 (a escolhida, 10/11/2026); outra opção pede medir de novo (o comentário de cada número diz o quê).
//   node e2e/pixel-art/monitor/fatiar.mjs 2
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../quarto/imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const DESTINO = path.join(AQUI, '..', '..', '..', 'web', 'src', 'assets', 'quarto');
fs.mkdirSync(DESTINO, { recursive: true });
const n = process.argv[2] ?? '2';

const p = await abrir();
const r = await p.evaluate(async (b) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode();
  const W = im.width, H = im.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const dados = g.getImageData(0, 0, W, H); const d = dados.data;
  const original = new Uint8ClampedArray(d);
  const i = (x, y) => (y * W + x) * 4;
  // 1. O magenta (e as franjas dele) vira o buraco; a transparência fica 0 ou 255.
  for (let k = 0; k < d.length; k += 4) {
    if (d[k + 3] > 0 && d[k] > 150 && d[k + 2] > 150 && d[k + 1] < 130) d[k + 3] = 0;
    d[k + 3] = d[k + 3] < 128 ? 0 : 255;
  }
  const copiarColuna = (x, y0, y1, de = 80) => { for (let y = y0; y <= y1; y++) for (let q = 0; q < 4; q++) d[i(x, y) + q] = d[i(de, y) + q]; };
  // 2. Os enfeites saem da moldura (o meio de cada lado precisa ser igual de ponta a ponta para esticar):
  for (let x = 38; x <= 60; x++) copiarColuna(x, 27, 31);   // a grade de ventilação, no alto à esquerda
  for (let x = 36; x <= 45; x++) copiarColuna(x, 94, 104);  // o botão da esquerda
  for (let x = 112; x <= 123; x++) copiarColuna(x, 94, 104); // o LED e o botão de força, à direita
  // 3. A borda de baixo reta: o ressalto onde o pescoço encaixa (x 51..110) vai com o pé.
  for (let x = 38; x <= 122; x++) for (let q = 0; q < 4; q++) d[i(x, 107) + q] = d[i(40, 107) + q];
  g.putImageData(dados, 0, 0);
  const recorte = (fonte, x, y, w, h) => {
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    o.getContext('2d').drawImage(fonte, x, y, w, h, 0, 0, w, h);
    return o;
  };
  const moldura = recorte(c, 25, 24, 111, 84);               // x 25..135, y 24..107
  // O pé e os enfeites saem do ORIGINAL (sem o passo 2), com a mesma transparência limpa.
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
  const g2 = c2.getContext('2d'); const od = new ImageData(original, W, H);
  for (let k = 0; k < od.data.length; k += 4) od.data[k + 3] = od.data[k + 3] < 128 ? 0 : 255;
  g2.putImageData(od, 0, 0);
  const pe = recorte(c2, 50, 107, 62, 21);                    // x 50..111, y 107..127
  // A folha dos enfeites: grade (21 × 5) em 0,0; botão da esquerda (10 × 11) em 0,5; LED e força (12 × 11) em 10,5.
  const folha = document.createElement('canvas'); folha.width = 22; folha.height = 16;
  const gf = folha.getContext('2d');
  gf.drawImage(c2, 38, 27, 21, 5, 0, 0, 21, 5);
  gf.drawImage(c2, 36, 94, 10, 11, 0, 5, 10, 11);
  gf.drawImage(c2, 112, 94, 12, 11, 10, 5, 12, 11);
  const png = (cv) => cv.toDataURL('image/png').split(',')[1];
  return { moldura: png(moldura), pe: png(pe), botoes: png(folha) };
}, ler64(path.join(AQUI, 'opcoes', `monitor-${n}.png`)));
await fechar();
gravar64(path.join(DESTINO, 'monitor.png'), r.moldura);
gravar64(path.join(DESTINO, 'monitor-pe.png'), r.pe);
gravar64(path.join(DESTINO, 'monitor-botoes.png'), r.botoes);
console.log('monitor', n, '→', DESTINO);
