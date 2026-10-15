// A PAREDE DE TIJOLO MAIS RICA (pedido dele, 15/10/2026: "a parede em tijolo está flat; conseguimos algo mais interessante?
// mesmo que gaste crédito"). Repinta só a FAIXA DE BAIXO da parede da esquerda da base 8 × 8 (o casca16.py espelha a da
// esquerda na da direita e estica as duas): a geometria do salão não muda, e o resto do motor também não.
//   node e2e/pixel-art/salao/parede.mjs   → bases/parede-<n>.png (a base inteira, com a parede repintada)
import fs from 'node:fs';
import path from 'node:path';
import { fechar, ler64, gravar64 } from '../quarto/imagem.mjs';
import { pintar } from '../quarto/novo/quarto/pintar.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
// A parede da esquerda da base: o pé dela vai de (40, 367) a (256, 253); a faixa sobe `alto` px.
const faixa = (alto) => [[40, 367], [256, 253], [256, 253 - alto], [40, 367 - alto]];
const OPCOES = [
  { alto: 78, texto: 'the lower part of the exposed red brick wall covered by dark wooden wainscoting: tall vertical wooden panels with a dark wooden chair rail on top and a baseboard at the floor, warm cozy pub style, clean isometric pixel art matching the wall angle' },
  { alto: 78, semente: 5, texto: 'the lower part of the exposed red brick wall covered by dark wooden wainscoting: square framed wooden panels with a dark wooden chair rail on top and a baseboard at the floor, warm cozy pub style, clean isometric pixel art matching the wall angle' },
  { alto: 60, semente: 11, texto: 'the lower part of the exposed red brick wall with a row of dark green ceramic tiles and a dark wooden rail on top, warm cozy pub style, clean isometric pixel art matching the wall angle' },
];
const base = ler64(path.join(AQUI, 'base.png'));
for (const [i, o] of OPCOES.entries()) {
  const destino = path.join(AQUI, 'bases', `parede-${i + 1}.png`);
  if (fs.existsSync(destino)) { console.log('já existe:', destino); continue; }
  const a = faixa(o.alto), xs = a.map((p) => p[0]), ys = a.map((p) => p[1]);
  gravar64(destino, await pintar(base, { caixa: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], poligonos: [a], texto: o.texto, semente: o.semente }, null));
  console.log('parede', i + 1);
}
await fechar();
