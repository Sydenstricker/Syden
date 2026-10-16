// OS OBJETOS DA PAREDE DO SALÃO SEM PAREDE (relato de 15/10/2026: cortados, "danificados" e cheios de fiapos ao selecionar).
// Pintado sobre a parede, o objeto sempre traz um pouco da parede repintada em volta, que não casa com a parede de outro
// lugar. Aqui ele é gerado SOZINHO, de fundo transparente, como os móveis (modular), com o recorte que já temos dele
// (parede-salao/<item>/) como referência do ângulo, do tamanho e das cores. O PixelLab devolve várias opções; avulsos.py
// escolhe a mais parecida com o recorte e a põe no lugar dele.
//   node e2e/pixel-art/quarto/novo/quarto/parede/avulsos.mjs <item...>   → parede-salao/<item>/avulso-<n>.png, ref.json
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../../../imagem.mjs';
import { chamar } from '../../../hibrido/pintura.mjs';
import { ITENS } from './itens.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const p = await abrir();
for (const item of process.argv.slice(2)) {
  const d = path.join(AQUI, '..', 'parede-salao', item);
  // a caixa do objeto (a peça está nas coordenadas do quarto: +27 no salão), com folga
  const ref = await p.evaluate(async ({ dia, peca }) => {
    const carregar = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im; };
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    g.drawImage(await carregar(peca), 0, 0); const a = g.getImageData(0, 0, 512, 512).data;
    let x0 = 512, y0 = 512, x1 = 0, y1 = 0;
    for (let k = 0; k < 512 * 512; k++) if (a[k * 4 + 3] > 127) { const x = k % 512, y = (k / 512) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    y0 += 27; y1 += 27;
    x0 = Math.max(0, x0 - 4); y0 = Math.max(0, y0 - 4); x1 = Math.min(511, x1 + 4); y1 = Math.min(511, y1 + 4);
    // múltiplo de 4, que a ferramenta pede
    const w = Math.ceil((x1 - x0 + 1) / 4) * 4, h = Math.ceil((y1 - y0 + 1) / 4) * 4;
    const r = document.createElement('canvas'); r.width = w; r.height = h;
    r.getContext('2d').drawImage(await carregar(dia), x0, y0, w, h, 0, 0, w, h);
    return { x0, y0, w, h, b64: r.toDataURL('image/png').split(',')[1] };
  }, { dia: ler64(path.join(d, 'dia.png')), peca: ler64(path.join(d, 'peca-dia.png')) });
  fs.writeFileSync(path.join(d, 'ref.json'), JSON.stringify({ x0: ref.x0, y0: ref.y0, w: ref.w, h: ref.h }));
  gravar64(path.join(d, 'ref.png'), ref.b64);
  // (o violão, pedido "SMALL ... com parede em volta" para caber na parede, saía pequeno no quadro sozinho: relato de
  // 15/10/2026, "o violão está com falhas e artefatos")
  const PROPRIO = { violao: 'ONLY ONE light wooden acoustic guitar hanging vertically from a small dark wall hook at the top, the guitar FILLS the whole image height from the hook at the top to the bottom of its body, clean dark outline, clean isometric pixel art' };
  const texto = PROPRIO[item] ? PROPRIO[item] + ', isolated on a transparent background, NO wall and NO bricks drawn behind or around it, the same isometric angle as the reference' : ITENS[item].texto.replace(/,?\s*(flat against|set into) the plain cream[^,]*,?/g, ', ').replace(/ONLY/, 'ONLY ONE') + ', isolated on a transparent background, NO wall and NO bricks drawn behind or around it, the same isometric angle as the reference';
  const imagens = await chamar('/generate-image-v2', {
    description: texto, image_size: { width: ref.w, height: ref.h }, no_background: true,
    reference_images: [{ image: { type: 'base64', base64: ref.b64, format: 'png' }, size: { width: ref.w, height: ref.h }, usage_description: 'This exact object, at this exact angle, size and colors: redraw ONLY the object itself, without the brick wall behind it' }],
  });
  imagens.forEach((b, i) => gravar64(path.join(d, `avulso-${i + 1}.png`), b));
  console.log(item, imagens.length, 'opções');
}
await fechar();
