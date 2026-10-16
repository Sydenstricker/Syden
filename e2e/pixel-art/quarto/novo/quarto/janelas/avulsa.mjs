// A JANELA DO SALÃO, SEM PAREDE (relato de 15/10/2026: a com cortinas "além de ter mancha, não combina com a estética da
// sala"). Pintada sobre a parede creme do quarto, a janela trazia a parede repintada em volta, e as cortinas cinza-azuladas
// eram frias para a sala de tijolo e madeira. Aqui ela é gerada SOZINHA, de fundo transparente (como os objetos da parede
// do salão, parede/avulsos.mjs), com a de cortinas posta no tijolo como referência do ângulo e do tamanho, e o vidro em
// magenta puro, que vira a máscara da vista. avulsa.py põe a opção escolhida no lugar.
//   node e2e/pixel-art/quarto/novo/quarto/janelas/avulsa.mjs [tipo]   → janelas/<tipo>/avulso-<n>.png, ref.json
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../../../imagem.mjs';
import { chamar } from '../../../hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const VIDRO = 'every glass pane is a flat solid pure magenta color (#FF00FF), nothing visible through it';
export const TIPOS = {
  tijolo: `ONLY ONE tall rustic double window for a cozy brick-walled tavern lounge: a thick dark warm-brown stained wood frame with small square panes, a shallow arch of red bricks above it, a deep wooden sill below, ${VIDRO}, isolated on a transparent background, NO wall and NO bricks around it except the brick arch on top, the same isometric angle as the reference, clean isometric pixel art`,
};
const tipo = process.argv[2] ?? 'tijolo';
const d = path.join(AQUI, tipo); fs.mkdirSync(d, { recursive: true });
const p = await abrir();
// a caixa da janela de cortinas (nas coordenadas do quarto; no salão, 27 px abaixo), com folga, posta no tijolo do salão
const ref = await p.evaluate(async ({ peca, tijolo }) => {
  const carregar = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im; };
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  const pi = await carregar(peca); g.drawImage(pi, 0, 0); const a = g.getImageData(0, 0, 512, 512).data;
  let x0 = 512, y0 = 512, x1 = 0, y1 = 0;
  for (let k = 0; k < 512 * 512; k++) if (a[k * 4 + 3] > 127) { const x = k % 512, y = (k / 512) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  x0 = Math.max(0, x0 - 4); y0 = Math.max(0, y0 - 4); x1 = Math.min(511, x1 + 4); y1 = Math.min(511, y1 + 4);
  const w = Math.ceil((x1 - x0 + 1) / 4) * 4, h = Math.ceil((y1 - y0 + 1) / 4) * 4;
  const r = document.createElement('canvas'); r.width = w; r.height = h; const gr = r.getContext('2d');
  gr.drawImage(await carregar(tijolo), x0, y0 + 27, w, h, 0, 0, w, h);
  gr.drawImage(pi, x0, y0, w, h, 0, 0, w, h);
  return { x0, y0, w, h, b64: r.toDataURL('image/png').split(',')[1] };
}, { peca: ler64(path.join(AQUI, 'cortinas', 'peca-dia.png')), tijolo: ler64(path.join(AQUI, '..', '..', '..', '..', 'salao', 'base-tijolo.png')) });
fs.writeFileSync(path.join(d, 'ref.json'), JSON.stringify({ x0: ref.x0, y0: ref.y0, w: ref.w, h: ref.h }));
gravar64(path.join(d, 'ref.png'), ref.b64);
const imagens = await chamar('/generate-image-v2', {
  description: TIPOS[tipo], image_size: { width: ref.w, height: ref.h }, no_background: true,
  reference_images: [{ image: { type: 'base64', base64: ref.b64, format: 'png' }, size: { width: ref.w, height: ref.h }, usage_description: 'Only the angle, the size and the place of the window on the wall: redraw the window itself in the new style, without the brick wall behind it and without curtains' }],
});
imagens.forEach((b, i) => gravar64(path.join(d, `avulso-${i + 1}.png`), b));
console.log(tipo, imagens.length, 'opções');
await fechar();
