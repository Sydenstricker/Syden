// Pintar dentro do quarto: a repintura do PixelLab numa janela em volta da silhueta, com o quarto inteiro como
// contexto, colada de volta só dentro da máscara. Usada por moveis.mjs e noite-abajur.mjs.
import { abrir } from '../../imagem.mjs';
import { chamar } from '../../hibrido/pintura.mjs';

const LADO = 512;
const b64img = (b64) => ({ type: 'base64', base64: b64, format: 'png' });

/** Pinta o móvel na silhueta dele em `de` (só onde a máscara deixa) e devolve a imagem inteira. */
export async function pintar(de, { caixa, poligonos, texto }, ocupado) {
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
