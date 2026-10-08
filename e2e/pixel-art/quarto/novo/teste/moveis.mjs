// Os móveis do teste, pintados DENTRO da base (pl-512-sem-1), um por vez, de trás para a frente, e depois
// recortados. Pintar no lugar dá ao móvel a mão, a luz e a sombra do quarto; recortar é fácil porque o fundo é
// conhecido: o que mudou em relação ao passo anterior é o móvel (e a sombra dele, separada pela cor).
//   node e2e/pixel-art/quarto/novo/teste/moveis.mjs   → passos/<n>-<id>.png e pecas/<id>.png, pecas/<id>-sombra.png
// O pufe é pintado em três lugares do quarto pronto (as três versões de luz) e não entra no quarto fixo.
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../../imagem.mjs';
import { chamar } from '../../hibrido/pintura.mjs';
import { pontoDoChao, N as NC } from './chao.mjs';
import { FIXOS, PUFES } from './lista.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const PASSOS = path.join(AQUI, 'passos'), PECAS = path.join(AQUI, 'pecas');
fs.mkdirSync(PASSOS, { recursive: true }); fs.mkdirSync(PECAS, { recursive: true });
const LADO = 512;
const b64img = (b64) => ({ type: 'base64', base64: b64, format: 'png' });

/** Pinta o móvel na silhueta dele em `de` (só onde a máscara deixa) e devolve a imagem inteira. */
async function pintar(de, { caixa, poligonos, texto }, ocupado) {
  const p = await abrir();
  // A janela: lado múltiplo de 4, entre 172 (o contexto de 512 pode ter no máximo 3× a janela) e 256.
  const [x0, y0, x1, y1] = caixa;
  const w = Math.min(256, Math.max(172, Math.ceil((x1 - x0 + 16) / 4) * 4)), h = Math.min(256, Math.max(172, Math.ceil((y1 - y0 + 16) / 4) * 4));
  const x = Math.max(0, Math.min(LADO - w, Math.round((x0 + x1 - w) / 2))), y = Math.max(0, Math.min(LADO - h, Math.round((y0 + y1 - h) / 2)));
  const { recorte, mascara } = await p.evaluate(async ({ de, ocupado, poligonos, x, y, w, h }) => {
    const carregar = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im; };
    const im = await carregar(de);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.drawImage(im, x, y, w, h, 0, 0, w, h);
    const recorte = c.toDataURL('image/png').split(',')[1];
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff';
    for (const pol of poligonos) { g.beginPath(); pol.forEach(([a, b], i) => (i ? g.lineTo(a - x, b - y) : g.moveTo(a - x, b - y))); g.closePath(); g.fill(); }
    if (ocupado) { g.globalCompositeOperation = 'destination-out'; g.drawImage(await carregar(ocupado), -x, -y); g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
    // A ferramenta recusa máscara com cinza: o polígono do canvas vem suavizado nas bordas.
    const d = g.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) { const v = d.data[i] > 127 ? 255 : 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    return { recorte, mascara: c.toDataURL('image/png').split(',')[1] };
  }, { de, ocupado, poligonos, x, y, w, h });
  const [novo] = await chamar('/inpaint-image-pro-flash', {
    image: b64img(recorte), mask_image: b64img(mascara), description: texto,
    context_image: b64img(de), bounding_box: { x, y, width: w, height: h }, output_method: 'Modify current layer',
  });
  // Cola de volta SÓ dentro da máscara: fora dela a ferramenta também mexe um pouco, e isso viraria "móvel".
  return p.evaluate(async ({ de, novo, mascara, x, y, w, h }) => {
    const carregar = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im; };
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    g.drawImage(await carregar(de), 0, 0);
    const t = document.createElement('canvas'); t.width = w; t.height = h; const gt = t.getContext('2d');
    gt.drawImage(await carregar(novo), 0, 0, w, h);
    const m = document.createElement('canvas'); m.width = w; m.height = h; const gm = m.getContext('2d');
    gm.drawImage(await carregar(mascara), 0, 0);
    const dt = gt.getImageData(0, 0, w, h), dm = gm.getImageData(0, 0, w, h).data;
    for (let i = 0; i < dt.data.length; i += 4) dt.data[i + 3] = dm[i] > 127 ? 255 : 0;
    gt.putImageData(dt, 0, 0); g.drawImage(t, x, y);
    return c.toDataURL('image/png').split(',')[1];
  }, { de, novo, mascara, x, y, w, h });
}

/** Separa o que mudou de `antes` para `depois`: o móvel (RGBA) e a sombra (só escurecimento, alfa = força). */
async function recortar(antes, depois) {
  const p = await abrir();
  return p.evaluate(async ({ antes, depois, chao }) => {
    const carregar = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im; };
    const ler = async (b) => { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d'); g.drawImage(await carregar(b), 0, 0); return g.getImageData(0, 0, 512, 512); };
    const A = (await ler(antes)).data, D = await ler(depois);
    const noChao = (x, y) => { let dentro = false; for (let i = 0, j = chao.length - 1; i < chao.length; j = i++) { const [xi, yi] = chao[i], [xj, yj] = chao[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro; } return dentro; };
    const N = 512 * 512, tipo = new Uint8Array(N), fator = new Float32Array(N); // 0 nada, 1 móvel, 2 sombra
    for (let k = 0; k < N; k++) {
      const i = k * 4, d = [0, 1, 2].map((c) => D.data[i + c] - A[i + c]);
      if (Math.max(...d.map(Math.abs)) < 14) continue;
      const r = [0, 1, 2].map((c) => (D.data[i + c] + 1) / (A[i + c] + 1));
      const media = (r[0] + r[1] + r[2]) / 3;
      // Sombra escurece por igual. No chão ela pode ser forte (a do pufe no tapete chega a 0,4); fora dele, só
      // fraca: um cobertor cinza sobre a parede clara também escurece por igual (0,43), e é móvel.
      // E a sombra pintada puxa para o azul (0,72 · 0,74 · 0,87 no tapete): no chão a tolerância é maior.
      const [minimo, desvio] = noChao(k % 512, (k / 512) | 0) ? [0.3, 0.22] : [0.55, 0.12];
      if (media < 0.95 && media > minimo && Math.max(...r) - Math.min(...r) < desvio) { tipo[k] = 2; fator[k] = media; } else tipo[k] = 1;
    }
    // Limpeza: pedaços de móvel com menos de 25 pixels são ruído (viram nada); buracos de sombra dentro do móvel, móvel.
    const visto = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      if (tipo[k] !== 1 || visto[k]) continue;
      const fila = [k]; visto[k] = 1;
      for (let q = 0; q < fila.length; q++) {
        const a = fila[q], x = a % 512, y = (a / 512) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const b = (y + dy) * 512 + x + dx;
          if (x + dx >= 0 && x + dx < 512 && y + dy >= 0 && y + dy < 512 && tipo[b] === 1 && !visto[b]) { visto[b] = 1; fila.push(b); }
        }
      }
      if (fila.length < 25) for (const a of fila) tipo[a] = 0;
    }
    // Sombra cercada de móvel é móvel (os furos do cobertor): há móvel a até 4 px em 3 das 4 direções.
    const furo = [];
    for (let k = 0; k < N; k++) if (tipo[k] === 2) {
      const x = k % 512, y = (k / 512) | 0; let viz = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let d = 1; d <= 4; d++) { const xx = x + dx * d, yy = y + dy * d; if (xx >= 0 && xx < 512 && yy >= 0 && yy < 512 && tipo[yy * 512 + xx] === 1) { viz++; break; } }
      if (viz >= 3) furo.push(k);
    }
    for (const k of furo) tipo[k] = 1;
    // Sombra solta (menos de 12 px juntos) é retoque de tábua, não sombra.
    const vistoS = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      if (tipo[k] !== 2 || vistoS[k]) continue;
      const fila = [k]; vistoS[k] = 1;
      for (let q = 0; q < fila.length; q++) {
        const a = fila[q], x = a % 512, y = (a / 512) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const b = (y + dy) * 512 + x + dx;
          if (x + dx >= 0 && x + dx < 512 && y + dy >= 0 && y + dy < 512 && tipo[b] === 2 && !vistoS[b]) { vistoS[b] = 1; fila.push(b); }
        }
      }
      if (fila.length < 12) for (const a of fila) tipo[a] = 0;
    }
    const movel = new ImageData(512, 512), sombra = new ImageData(512, 512);
    for (let k = 0; k < N; k++) {
      const i = k * 4;
      if (tipo[k] === 1) { for (let c = 0; c < 4; c++) movel.data[i + c] = D.data[i + c]; }
      // A sombra fica só no chão: na parede, o que sobrava eram pontinhos soltos de retoque.
      if (tipo[k] === 2 && noChao(k % 512, (k / 512) | 0)) { sombra.data[i + 3] = Math.round((1 - fator[k]) * 255); }
    }
    const png = (img) => { const c = document.createElement('canvas'); c.width = 512; c.height = 512; c.getContext('2d').putImageData(img, 0, 0); return c.toDataURL('image/png').split(',')[1]; };
    return { movel: png(movel), sombra: png(sombra) };
  }, { antes, depois, chao: [[0, 0], [NC, 0], [NC, NC], [0, NC]].map(([u, v]) => pontoDoChao(u, v)) });
}

// O MÓVEL vem da remoção de fundo do PixelLab (1 geração), não da diferença entre os passos: madeira sobre madeira
// e travesseiro branco sobre parede clara quase não mudam de cor, e a diferença perdia a lateral da cama; ela também
// pegava tábuas retocadas em volta (os fiapos da v1). A diferença fica para a SOMBRA, e para achar a área do móvel.
// O que já é de um móvel anterior não entra (a remoção de fundo devolve o vizinho junto). Fica guardado em fundo/.
const FUNDO = path.join(AQUI, 'fundo');
fs.mkdirSync(FUNDO, { recursive: true });
async function limpar(m, antes, depois, movel, ocupado) {
  const p = await abrir();
  const caixa = await p.evaluate(async (b) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode();
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, 512, 512).data; let x0 = 512, y0 = 512, x1 = 0, y1 = 0;
    for (let k = 0; k < 512 * 512; k++) if (d[k * 4 + 3]) { const x = k % 512, y = (k / 512) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return [Math.max(0, x0 - 8), Math.max(0, y0 - 8), Math.min(512, x1 + 9), Math.min(512, y1 + 9)];
  }, movel);
  const arquivo = path.join(FUNDO, m.id + '.png');
  if (!fs.existsSync(arquivo)) {
    const recorte = await p.evaluate(async ({ b, caixa: [x0, y0, x1, y1] }) => {
      const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode();
      const c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0; c.getContext('2d').drawImage(im, -x0, -y0);
      return c.toDataURL('image/png').split(',')[1];
    }, { b: depois, caixa });
    const r = await fetch('https://api.pixellab.ai/v2/remove-background', {
      method: 'POST', headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ image: { type: 'base64', base64: recorte, format: 'png' }, image_size: { width: caixa[2] - caixa[0], height: caixa[3] - caixa[1] }, background_removal_task: 'remove_complex_background', text: m.dica }),
    });
    const t = await r.text();
    if (!r.ok) throw new Error('remove-background ' + m.id + ' ' + r.status + ': ' + t.slice(0, 300));
    const j = JSON.parse(t);
    gravar64(arquivo, j.image?.base64 ?? j.images?.[0]?.base64);
    fs.appendFileSync(path.join(AQUI, '..', '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: 'novo/teste/fundo-' + m.id, usage: j.usage ?? null, quando: new Date().toISOString() }) + '\n');
  }
  return p.evaluate(async ({ antes, depois, fundo, ocupado, caixa: [x0, y0, x1, y1] }) => {
    const carregar = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im; };
    const ler = async (b, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(await carregar(b), 0, 0, w, h); return g.getImageData(0, 0, w, h); };
    const D = await ler(depois, 512, 512), F = (await ler(fundo, x1 - x0, y1 - y0)).data, O = ocupado ? (await ler(ocupado, 512, 512)).data : null;
    const M = new ImageData(512, 512);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = y * 512 + x;
      if (F[((y - y0) * (x1 - x0) + (x - x0)) * 4 + 3] <= 100 || (O && O[k * 4 + 3])) continue;
      for (let c = 0; c < 4; c++) M.data[k * 4 + c] = D.data[k * 4 + c];
      M.data[k * 4 + 3] = 255;
    }
    // A franja: a remoção de fundo deixa 1 px do fundo em volta. Pixel da borda que não mudou é fundo; duas passadas.
    const A = (await ler(antes, 512, 512)).data;
    for (let passada = 0; passada < 2; passada++) {
      const tirar = [];
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const k = y * 512 + x;
        if (!M.data[k * 4 + 3]) continue;
        const borda = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !M.data[((y + dy) * 512 + x + dx) * 4 + 3]);
        if (borda && Math.max(...[0, 1, 2].map((c) => Math.abs(D.data[k * 4 + c] - A[k * 4 + c]))) < 12) tirar.push(k);
      }
      for (const k of tirar) M.data[k * 4 + 3] = 0;
    }
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; c.getContext('2d').putImageData(M, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  }, { antes, depois, fundo: ler64(arquivo), ocupado, caixa });
}

let quarto = ler64(path.join(AQUI, '..', 'bases', 'pl-512-sem-1.png'));
let ocupado = null; // as peças já recortadas, juntas, para a máscara não pintar por cima delas
async function juntar(a, b) {
  if (!a) return b;
  const p = await abrir();
  return p.evaluate(async ({ a, b }) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    for (const x of [a, b]) { const im = new Image(); im.src = 'data:image/png;base64,' + x; await im.decode(); g.drawImage(im, 0, 0); }
    return c.toDataURL('image/png').split(',')[1];
  }, { a, b });
}
// Um argumento numérico para depois de N móveis fixos, para olhar cada passo antes de pagar o seguinte.
const ATE = Number(process.argv[2] ?? Infinity);
let n = 0;
for (const m of FIXOS) {
  if (n >= ATE) break;
  const passo = path.join(PASSOS, `${++n}-${m.id}.png`);
  let depois;
  if (fs.existsSync(passo)) depois = ler64(passo);
  else { depois = await pintar(quarto, m, ocupado); gravar64(passo, depois); console.log('pintado:', m.id); }
  let { movel, sombra } = await recortar(quarto, depois);
  if (!m.deitado) movel = await limpar(m, quarto, depois, movel, ocupado);
  gravar64(path.join(PECAS, m.id + '.png'), movel); gravar64(path.join(PECAS, m.id + '-sombra.png'), sombra);
  // O que fica deitado no chão (o tapete) não ocupa: os outros móveis vão por cima dele.
  quarto = depois; if (!m.deitado) ocupado = await juntar(ocupado, movel);
}
if (n === FIXOS.length) await Promise.all(PUFES.map(async (m) => {
  const passo = path.join(PASSOS, `${m.id}.png`);
  let depois;
  if (fs.existsSync(passo)) depois = ler64(passo);
  else { depois = await pintar(quarto, m, ocupado); gravar64(passo, depois); console.log('pintado:', m.id); }
  let { movel, sombra } = await recortar(quarto, depois);
  if (!m.deitado) movel = await limpar(m, quarto, depois, movel, ocupado);
  gravar64(path.join(PECAS, m.id + '.png'), movel); gravar64(path.join(PECAS, m.id + '-sombra.png'), sombra);
}));
await fechar();
