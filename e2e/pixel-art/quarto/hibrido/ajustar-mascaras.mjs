// Máscaras do quarto refeitas à mão, pixel a pixel, olhando o quarto do site (relatos de 10/10/2026):
//
//   - COMPUTADOR: o contorno tem de pegar o MOUSEPAD inteiro, com o mouse em cima (o esboço dele em
//     branco). O mousepad é recortado pela cor, crescendo a partir do meio dele até a madeira da mesa; o
//     mouse (x 251–259, y 172–179) entra pelas linhas abaixo. A caixa vai até y 190.
//   - ABAJUR: a luminária inteira — tampa arredondada, corpo, pescoço e base —, lida da pintura (a faixa
//     escura em x 62–66 é a cabeceira da cama, não a luminária).
//   - PUFE: novo. Uma elipse, porque ele é redondo e tem contorno escuro (x 164–216, y 213–254).
//
// A exportação guarda só o MAIOR PEDAÇO de cada máscara: tudo o que se acrescenta aqui tem de encostar
// no resto, senão some em silêncio.
//
// Escreve em mascaras/ (a fonte). Depois: node exportar.mjs, e confira as caixas em objetos.mjs,
// web/src/Quarto.tsx e web/site/index.html (data-caixa), que repetem os números.
//
//   node e2e/pixel-art/quarto/hibrido/ajustar-mascaras.mjs
import path from 'node:path';
import { abrir, fechar, gravar64, ler64 } from '../imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const MASCARAS = path.join(AQUI, 'mascaras');

/** As linhas de uma forma, em pixels do quarto: [y, x inicial, x final] (inclusive). */
const MOUSE = [
  // A ponte até o teclado (o fio): sem ela o mouse seria um pedaço solto.
  [170, 253, 257],
  [171, 253, 258],
  [172, 254, 259],
  [173, 252, 258],
  [174, 252, 259],
  [175, 251, 259],
  [176, 251, 259],
  [177, 251, 259],
  [178, 252, 257],
  [179, 252, 256],
];

const ABAJUR = [
  [131, 54, 58],
  [132, 53, 59],
  [133, 52, 60],
  [134, 52, 60],
  ...Array.from({ length: 15 }, (_, i) => [135 + i, 51, 61]),
  [150, 52, 60],
  [151, 53, 59],
  // O pé: vai até a linha 157 e estreita embaixo (parava em 154 e cortava o pé no meio, 10/10/2026).
  [152, 51, 60],
  [153, 50, 60],
  [154, 50, 60],
  [155, 50, 60],
  [156, 50, 60],
  [157, 52, 60],
];

/** O pufe: a elipse que passa pelo contorno escuro dele. */
const PUFE = (() => {
  const [cx, cy, rx, ry] = [190, 233.5, 26.5, 21];
  const linhas = [];
  for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
    const meia = rx * Math.sqrt(1 - ((y - cy) / ry) ** 2);
    linhas.push([y, Math.round(cx - meia), Math.round(cx + meia)]);
  }
  return linhas;
})();

const p = await abrir();
const pintura = ler64(path.join(AQUI, 'noite.png'));

/**
 * Redesenha uma máscara na caixa `para`: a `antiga` (base64, na caixa `de`, se houver), mais as `linhas`,
 * mais o que crescer da `semente` na pintura pela cor (`crescer`: { semente, limite, caixa }). Com `fechar`,
 * tampa as frestas internas de até 2·fechar pixels (cresce e encolhe de novo): a linha escura entre o
 * teclado e o mousepad ficava de fora e desenhava um contorno por DENTRO do computador.
 */
const redesenhar = ({ antiga, de, para, linhas = [], crescer, fechar = 0 }) =>
  p.evaluate(
    async ({ antiga, de, para, linhas, crescer, fechar, pintura }) => {
      const carregar = async (b64) => {
        const im = new Image();
        im.src = 'data:image/png;base64,' + b64;
        await im.decode();
        return im;
      };
      const w = para[2] - para[0];
      const h = para[3] - para[1];
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      if (antiga) g.drawImage(await carregar(antiga), de[0] - para[0], de[1] - para[1]);
      g.fillStyle = '#000';
      for (const [y, x0, x1] of linhas) g.fillRect(x0 - para[0], y - para[1], x1 - x0 + 1, 1);

      if (crescer) {
        // Cresce da semente pelos vizinhos de cor parecida (soma das diferenças de R, G e B), sem sair da caixa.
        const im = await carregar(pintura);
        const t = document.createElement('canvas');
        t.width = im.width;
        t.height = im.height;
        const tg = t.getContext('2d');
        tg.drawImage(im, 0, 0);
        const d = tg.getImageData(0, 0, im.width, im.height).data;
        const cor = (x, y) => [d[(y * im.width + x) * 4], d[(y * im.width + x) * 4 + 1], d[(y * im.width + x) * 4 + 2]];
        const base = cor(...crescer.semente);
        const [bx0, by0, bx1, by1] = crescer.caixa;
        const visto = new Set();
        const fila = [crescer.semente];
        while (fila.length) {
          const [x, y] = fila.pop();
          const k = y * 1000 + x;
          if (visto.has(k) || x < bx0 || y < by0 || x >= bx1 || y >= by1) continue;
          visto.add(k);
          const [r, gg, b] = cor(x, y);
          if (Math.abs(r - base[0]) + Math.abs(gg - base[1]) + Math.abs(b - base[2]) > crescer.limite) continue;
          g.fillRect(x - para[0], y - para[1], 1, 1);
          fila.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
      }
      if (fechar) {
        const dados = g.getImageData(0, 0, w, h);
        let cheio = Uint8Array.from({ length: w * h }, (_, k) => (dados.data[k * 4 + 3] > 127 ? 1 : 0));
        const passo = (m, valor) => {
          const novo = new Uint8Array(w * h);
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              let todos = true;
              let algum = false;
              for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                  const xx = x + dx;
                  const yy = y + dy;
                  const v = xx >= 0 && yy >= 0 && xx < w && yy < h ? m[yy * w + xx] : 0;
                  if (v) algum = true;
                  else todos = false;
                }
              novo[y * w + x] = valor ? (algum ? 1 : 0) : todos ? 1 : 0;
            }
          return novo;
        };
        const original = cheio;
        for (let i = 0; i < fechar; i++) cheio = passo(cheio, 1);
        for (let i = 0; i < fechar; i++) cheio = passo(cheio, 0);
        // A borda de fora fica como era: o fechamento só pode ACRESCENTAR o que estava dentro.
        for (let k = 0; k < w * h; k++) if (cheio[k] || original[k]) dados.data[k * 4 + 3] = 255;
        g.putImageData(dados, 0, 0);
      }
      return c.toDataURL('image/png').split(',')[1];
    },
    { antiga, de, para, linhas, crescer, fechar, pintura },
  );

const computador = path.join(MASCARAS, 'computador.png');
gravar64(
  computador,
  await redesenhar({
    antiga: ler64(computador),
    de: [211, 115, 268, 173],
    para: [211, 115, 268, 190],
    linhas: MOUSE,
    crescer: { semente: [248, 175], limite: 40, caixa: [226, 166, 268, 190] },
    fechar: 2,
  }),
);

gravar64(path.join(MASCARAS, 'abajur.png'), await redesenhar({ para: [46, 127, 68, 161], linhas: ABAJUR }));
gravar64(path.join(MASCARAS, 'pufe.png'), await redesenhar({ para: [163, 212, 218, 256], linhas: PUFE }));

await fechar();
console.log('mascaras/computador.png (caixa 211,115,268,190), abajur.png e pufe.png refeitas. Agora: node exportar.mjs');
