// Operações de imagem para o kit do quarto, feitas num Chrome sem janela (o projeto não tem biblioteca
// de imagem, e o canvas do navegador basta: recortar, reduzir, pôr na paleta, montar).
import fs from 'node:fs';
import { abrirNavegador } from '../../ajuda.mjs';

// Uma página só, guardada como PROMESSA: duas chamadas ao mesmo tempo (num Promise.all) abriam dois
// navegadores, e o que não era fechado deixava o processo preso no fim.
let pagina;
export function abrir() {
  pagina ??= abrirNavegador().then(async ({ browser }) => { const p = await browser.newPage(); p._browser = browser; return p; });
  return pagina;
}
export async function fechar() {
  if (pagina) await (await pagina)._browser.close();
  pagina = undefined;
}
export const ler64 = (arquivo) => fs.readFileSync(arquivo).toString('base64');
export const gravar64 = (arquivo, b64) => fs.writeFileSync(arquivo, Buffer.from(b64, 'base64'));

/** Recorta [x,y,w,h] do original, reduz pela escala (vizinho mais próximo não serve: o conceito não é pixel
 *  art de verdade, então a redução é suave) e centraliza numa tela quadrada de `lado` px. */
export async function recortar(origem64, [x, y, w, h], escala, lado) {
  const p = await abrir();
  return p.evaluate(async ({ origem64, x, y, w, h, escala, lado }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + origem64; await img.decode();
    const W = Math.round(w * escala), H = Math.round(h * escala);
    const c = document.createElement('canvas'); c.width = lado ?? W; c.height = lado ?? H;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(img, x, y, w, h, Math.floor((c.width - W) / 2), Math.floor((c.height - H) / 2), W, H);
    return c.toDataURL('image/png').split(',')[1];
  }, { origem64, x, y, w, h, escala, lado });
}

/** Põe cada pixel na cor mais próxima da paleta (distância com peso perceptual simples). Transparência
 *  vira 0 ou 255, sem meio-termo, como pixel art pede. */
export async function naPaleta(img64, paleta) {
  const p = await abrir();
  return p.evaluate(async ({ img64, paleta }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + img64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    const cores = paleta.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    for (let i = 0; i < d.data.length; i += 4) {
      if (d.data[i + 3] < 128) { d.data[i + 3] = 0; continue; }
      d.data[i + 3] = 255;
      let melhor = 0, dist = Infinity;
      for (let k = 0; k < cores.length; k++) {
        const [r, gg, b] = cores[k];
        const dr = d.data[i] - r, dg = d.data[i + 1] - gg, db = d.data[i + 2] - b;
        const rm = (d.data[i] + r) / 2;
        const dd = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
        if (dd < dist) { dist = dd; melhor = k; }
      }
      [d.data[i], d.data[i + 1], d.data[i + 2]] = cores[melhor];
    }
    g.putImageData(d, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  }, { img64, paleta });
}

/** Foto de uma página HTML (para folhas de comparação e para conferir recortes). */
export async function foto(html, arquivo, { largura = 1200, altura = 900 } = {}) {
  const p = await abrir();
  await p.setViewportSize({ width: largura, height: altura });
  await p.setContent(html);
  await p.waitForTimeout(300);
  await p.screenshot({ path: arquivo, fullPage: true });
}
