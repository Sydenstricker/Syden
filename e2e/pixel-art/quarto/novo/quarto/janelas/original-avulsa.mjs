// A JANELA ORIGINAL AVULSA (09/11/2026, a dívida de arte de 06/11: "a peça avulsa da janela original; ela traz uma faixa
// de parede creme entre a cortina e o caixilho, que não muda com a cor da parede"). Como os outros tipos (avulsa.mjs): gerada
// SOZINHA, sem fundo, com a pintura da janela original como referência do ângulo e do tamanho, e o vidro em magenta puro.
// Os ESTADOS (a cortina fechada e a janela aberta) partem da avulsa escolhida, como referência, para saírem do mesmo desenho.
//   node janelas/original-avulsa.mjs fechada            → original/avulso-<n>.png, ref.json, ref.png
//   node janelas/original-avulsa.mjs cortina <n>        → original/avulso-cortina-<m>.png   (a partir de avulso-<n>)
//   node janelas/original-avulsa.mjs aberta <n>         → original/avulso-aberta-<m>.png
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../../../imagem.mjs';
import { chamar } from '../../../hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const d = path.join(AQUI, 'original');
const VIDRO = 'every glass pane is a flat solid pure magenta color (#FF00FF), nothing visible through it';
const JANELA = 'ONLY ONE large wide wooden window with many small square panes in a wooden frame, a wide wooden window seat sill below it, long soft cream linen curtains hanging on both sides from a dark wooden curtain rod above, the frame FLUSH with the wall (no deep recess, no wall drawn inside the window)';
const FIM = 'isolated on a transparent background, NO wall, NO ceiling beam and NO floor drawn around it, the same isometric angle as the reference, the window and curtains FILL the whole image, clean dark outline, clean isometric pixel art';
const PEDIDOS = {
  fechada: `${JANELA}, the curtains pulled open to the sides, ${VIDRO}, ${FIM}`,
  cortina: `exactly the same window, same size, same frame and same curtain rod, but with the long cream linen curtains CLOSED, drawn together across the whole window and covering all the glass, ${FIM}`,
  aberta: `exactly the same window, same size, same frame and same curtains, but with its two glass casement sashes swung OPEN inward, the open window gap is a flat solid pure magenta color (#FF00FF), the glass of the open sashes is pale cream, ${FIM}`,
};
const [estado, base] = process.argv.slice(2);
if (!PEDIDOS[estado]) throw new Error('estados: ' + Object.keys(PEDIDOS).join(', '));
const p = await abrir();
let ref;
if (estado === 'fechada') {
  // a caixa da peça original (sem a viga e as pontas da cortina no chão: só da altura da viga para baixo, até o pé da cortina)
  ref = await p.evaluate(async ({ peca, baseImg }) => {
    const carregar = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im; };
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    g.drawImage(await carregar(peca), 0, 0); const a = g.getImageData(0, 0, 512, 512).data;
    let x0 = 512, y0 = 512, x1 = 0, y1 = 0;
    for (let k = 0; k < 512 * 512; k++) if (a[k * 4 + 3] > 127) { const x = k % 512, y = (k / 512) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const w = Math.ceil((x1 - x0 + 1) / 4) * 4, h = Math.ceil((y1 - y0 + 1) / 4) * 4;
    const r = document.createElement('canvas'); r.width = w; r.height = h;
    r.getContext('2d').drawImage(await carregar(baseImg), x0, y0, w, h, 0, 0, w, h);
    return { x0, y0, w, h, b64: r.toDataURL('image/png').split(',')[1] };
  }, { peca: ler64(path.join(d, 'peca-dia.png')), baseImg: ler64(path.join(AQUI, '..', '..', 'bases', 'pl-512-janela-1.png')) });
  fs.writeFileSync(path.join(d, 'ref.json'), JSON.stringify({ x0: ref.x0, y0: ref.y0, w: ref.w, h: ref.h }));
  gravar64(path.join(d, 'ref.png'), ref.b64);
} else {
  const r = JSON.parse(fs.readFileSync(path.join(d, 'ref.json'), 'utf8'));
  ref = { ...r, b64: ler64(path.join(d, `avulso-${base}.png`)) };
}
const imagens = await chamar('/generate-image-v2', {
  description: PEDIDOS[estado], image_size: { width: ref.w, height: ref.h }, no_background: true,
  reference_images: [{ image: { type: 'base64', base64: ref.b64, format: 'png' }, size: { width: ref.w, height: ref.h }, usage_description: estado === 'fechada' ? 'This exact window, at this exact angle, size and colors: redraw ONLY the window and its curtains, without the wall, the ceiling beam and the floor' : 'This exact window: keep its size, angle, frame, sill, curtain rod and colors pixel for pixel, change only what is asked' }],
});
imagens.forEach((b, i) => gravar64(path.join(d, `avulso${estado === 'fechada' ? '' : '-' + estado}-${i + 1}.png`), b));
console.log(estado, imagens.length, 'opções');
await fechar();
