// O LOBBY do fim do site: o salão onde a turma se encontra, e cada coelho agradecendo no seu tempo (pedido de
// 10/10/2026: "faltou destaque para o coelho principal; as animações perfeitamente sincronizadas ficam
// artificiais; e estão no fundo cinza da página, sem um ambiente").
//
// Monta as peças cruas em e2e/pixel-art/lobby/pecas/ (quem as leva ao site é ../lobby/montar.mjs):
//   sala.png        — o salão vazio (../demonstracao/lobby-1.png);
//   turma-<n>.png   — cada um dos quatro coelhos da turma, recortado dos quadros da reverência em grupo,
//                     numa faixa própria: assim cada um anima com a sua duração e o seu atraso, e eles
//                     deixam de se curvar todos no mesmo quadro;
//   coelho.png      — o coelho do quarto (o principal), de reverencia-coelho-1-*.png.
// Todas as faixas na mesma ordem do tempo (o curvado dura mais, e há uma pausa de pé), com o pelo creme.
//
//   node e2e/pixel-art/agradecendo/lobby.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, gravar64, ler64 } from '../quarto/imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const RAIZ = path.join(AQUI, '..', '..', '..');
// As peças CRUAS: quem as leva ao site, já na grade e na luz do salão, é ../lobby/montar.mjs.
const DESTINO = path.join(AQUI, '..', 'lobby', 'pecas');
fs.mkdirSync(DESTINO, { recursive: true });

const ORDEM = [1, 2, 3, 4, 5, 6, 6, 6, 6, 7, 8, 9, 1, 1, 1, 1, 1, 1];
/** As colunas de cada coelho dentro do quadro da turma (256 × 96), com folga para a reverência. */
// Todas com 64 de largura (o CSS usa a mesma proporção para as quatro), e sem encostar no vizinho: com o
// terceiro em 134–198, a ponta da orelha do quarto entrava no recorte dele (medido em 10/10/2026).
const COLUNAS = [
  [8, 72],
  [70, 134],
  [128, 192],
  [192, 256],
];

const p = await abrir();
/** Uma faixa: os quadros na ORDEM, cada um recortado em [x0, x1), com o pelo levado ao creme do mascote. */
const faixa = (arquivos, [x0, x1]) =>
  p.evaluate(
    async ({ quadros, x0, x1 }) => {
      const CREME = [243, 231, 211];
      const PELO_BASE = 0.3 * 230 + 0.59 * 172 + 0.11 * 137;
      const imgs = [];
      for (const b of quadros) {
        const im = new Image();
        im.src = 'data:image/png;base64,' + b;
        await im.decode();
        imgs.push(im);
      }
      const fim = x1 ?? imgs[0].width;
      const lw = fim - x0;
      const lh = imgs[0].height;
      const c = document.createElement('canvas');
      c.width = lw * imgs.length;
      c.height = lh;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      imgs.forEach((im, i) => g.drawImage(im, x0, 0, lw, lh, i * lw, 0, lw, lh));
      const d = g.getImageData(0, 0, c.width, c.height);
      for (let k = 0; k < d.data.length; k += 4) {
        const [r, gg, b] = [d.data[k], d.data[k + 1], d.data[k + 2]];
        if (d.data[k + 3] < 128 || !(r > gg && gg > b) || r - b < 40) continue;
        const razao = gg / r;
        if (razao < 0.6 || razao > 0.85) continue;
        const luz = (0.3 * r + 0.59 * gg + 0.11 * b) / PELO_BASE;
        for (let n = 0; n < 3; n++) d.data[k + n] = Math.min(255, Math.round(CREME[n] * luz));
      }
      g.putImageData(d, 0, 0);
      return { b64: c.toDataURL('image/png').split(',')[1], lw, lh };
    },
    { quadros: arquivos.map((a) => ler64(a)), x0, x1 },
  );

const turma = ORDEM.map((n) => path.join(AQUI, `reverencia-turma-1-${n}.png`));
for (const [i, coluna] of COLUNAS.entries()) {
  const f = await faixa(turma, coluna);
  gravar64(path.join(DESTINO, `turma-${i + 1}.png`), f.b64);
  console.log(`turma-${i + 1}.png  ${ORDEM.length} quadros de ${f.lw} × ${f.lh}`);
}
const principal = await faixa(ORDEM.map((n) => path.join(AQUI, `reverencia-coelho-1-${n}.png`)), [0, undefined]);
gravar64(path.join(DESTINO, 'coelho.png'), principal.b64);
console.log(`coelho.png   ${ORDEM.length} quadros de ${principal.lw} × ${principal.lh}`);
fs.copyFileSync(path.join(AQUI, '..', 'demonstracao', 'lobby-1.png'), path.join(DESTINO, 'sala.png'));
console.log('sala.png');
await fechar();
