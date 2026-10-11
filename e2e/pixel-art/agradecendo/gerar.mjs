// O coelho do quarto agradecendo, em pixel art, para o fim do site (pedido de 10/10/2026: "usar o PixelLab
// para gerar arte em pixel art, combinando com o quarto; como referência, o Kung Fu Panda agradecendo").
//
// O GESTO, E NÃO O PERSONAGEM: a referência é a saudação das artes marciais (o punho fechado encostado na
// palma aberta, à frente do peito, e o corpo se curvando). O texto descreve o gesto e não cita filme nem
// personagem de ninguém: quem desenha é o coelho do Syden.
//
// Duas etapas, porque o coelho do quarto está deitado, lendo, e a animação precisa dele DE PÉ e de frente:
//
//   node e2e/pixel-art/agradecendo/gerar.mjs coelho            → coelho-<n>.png (opções de pé, de frente)
//   node e2e/pixel-art/agradecendo/gerar.mjs animar coelho-1   → reverencia-coelho-1-<n>.png (os quadros)
//   node e2e/pixel-art/agradecendo/gerar.mjs folha coelho-1    → web/site/agradecendo.png (a faixa que o site toca)
//
// A referência de estilo é o próprio coelho do quarto (web/src/assets/quarto/coelho.png): mesma mão, mesma
// paleta, mesmo moletom. O gasto de cada chamada vai para ../quarto/custos.jsonl (o chamar() de pintura.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, gravar64, ler64 } from '../quarto/imagem.mjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const RAIZ = path.join(AQUI, '..', '..', '..');
const LADO = 96;

const saldo = async () =>
  (await (await fetch('https://api.pixellab.ai/v2/balance', { headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}` } })).json())
    .subscription.generations;

/** O coelho do quarto num quadro quadrado e maior, sem distorcer: a referência de estilo. */
async function referencia() {
  const p = await abrir();
  const b64 = await p.evaluate(async (b) => {
    const im = new Image();
    im.src = 'data:image/png;base64,' + b;
    await im.decode();
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(im, (128 - im.width * 2) / 2, (128 - im.height * 2) / 2, im.width * 2, im.height * 2);
    return c.toDataURL('image/png').split(',')[1];
  }, ler64(path.join(RAIZ, 'web', 'src', 'assets', 'quarto', 'coelho.png')));
  await fechar();
  return b64;
}

const [etapa, base] = process.argv.slice(2);
const antes = await saldo();

if (etapa === 'coelho') {
  const imagens = await chamar('/generate-image-v2', {
    description:
      'the same cute cream-white bunny character as the reference, long upright ears with soft pink inside, round face with small dark eyes and a tiny smile, wearing the same dark charcoal hoodie, standing upright on two feet, full body, seen from the front facing the viewer, arms relaxed at the sides, calm and friendly, cozy warm pixel art, clean dark outline, no background',
    image_size: { width: LADO, height: LADO },
    no_background: true,
    reference_images: [
      {
        image: { type: 'base64', base64: await referencia(), format: 'png' },
        size: { width: 128, height: 128 },
        usage_description: 'This is the character: match its face, ears, hoodie, colors, outline and pixel scale exactly, but draw it standing and facing the viewer',
      },
    ],
  });
  imagens.forEach((b, i) => gravar64(path.join(AQUI, `coelho-${i + 1}.png`), b));
  console.log('coelho →', imagens.length, 'opções');
} else if (etapa === 'turma') {
  // A TURMA agradecendo, e não um coelho sozinho (pedido de 10/10/2026: "ele sozinho não comunica o espírito
  // de comunidade"). Os mesmos acessórios dos avatares do squad de demonstração (../demonstracao/avatares-*).
  const imagens = await chamar('/generate-image-v2', {
    description:
      'four cute cream-white bunny characters standing side by side in a row, full bodies, seen from the front facing the viewer, the same style as the reference, each with a different gamer accessory: the first wears a headset with a microphone, the second a red cap turned backwards, the third an orange beanie, the fourth round glasses and a dark hoodie, all with long ears with pink inside and friendly smiles, arms relaxed, cozy warm pixel art, clean dark outline, no background',
    image_size: { width: 256, height: 96 },
    no_background: true,
    reference_images: [
      {
        image: { type: 'base64', base64: await referencia(), format: 'png' },
        size: { width: 128, height: 128 },
        usage_description: 'This is the character style: match its face, ears, colors, outline and pixel scale exactly, with cream-white fur',
      },
    ],
  });
  imagens.forEach((b, i) => gravar64(path.join(AQUI, `turma-${i + 1}.png`), b));
  console.log('turma →', imagens.length, 'opções');
} else if (etapa === 'animar' && base) {
  const quadros = await chamar('/animate-with-text-v3', {
    first_frame: { type: 'base64', base64: ler64(path.join(AQUI, base + '.png')) },
    action: base.startsWith('turma')
      ? 'all four bunnies do a respectful thank-you bow together at the same time, in the martial arts style: each one brings its right fist against its open left palm in front of its chest, closes its eyes happily and bows its head and upper body forward, they hold the bow for a moment, then all straighten up again and smile'
      : 'a respectful thank-you bow in the martial arts style: the bunny brings its right fist against its open left palm in front of its chest, closes its eyes happily and bows its head and upper body forward, holds the bow for a moment, then straightens up again and smiles',
    frame_count: 8,
    no_background: true,
  });
  quadros.forEach((b, i) => gravar64(path.join(AQUI, `reverencia-${base}-${i + 1}.png`), b));
  console.log('animar', base, '→', quadros.length, 'quadros');
} else if (etapa === 'folha' && base) {
  // Os quadros numa faixa só, na ORDEM DO TEMPO, com repetições: o curvado dura mais (é o gesto que se quer
  // ler) e há uma pausa de pé antes de recomeçar. O site toca a faixa com steps(), quadro a quadro.
  const ORDEM = [1, 2, 3, 4, 5, 6, 6, 6, 6, 7, 8, 9, 1, 1, 1, 1, 1, 1];
  const p = await abrir();
  const faixa = await p.evaluate(
    async ({ quadros }) => {
      const primeiro = new Image();
      primeiro.src = 'data:image/png;base64,' + quadros[0];
      await primeiro.decode();
      const [lw, lh] = [primeiro.width, primeiro.height];
      const c = document.createElement('canvas');
      c.width = lw * quadros.length;
      c.height = lh;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      // O PELO VOLTA A SER CREME (relato de 10/10/2026: "o coelho ficou moreno? ele não era branco?"). A
      // referência foi o coelho da pintura da NOITE, banhado pela luz do abajur, e o PixelLab tomou a luz
      // pela cor do pelo. Pixel quente com o verde entre 60% e 85% do vermelho é pelo: vira o creme do
      // mascote (#F3E7D3), guardando a luz e a sombra que tinha. O rosa da orelha (verde mais baixo), o
      // moletom e os olhos ficam como estão.
      const CREME = [243, 231, 211];
      const PELO_BASE = 0.3 * 230 + 0.59 * 172 + 0.11 * 137; // o tom principal do pelo gerado, #e6ac89
      const clarear = (d) => {
        for (let k = 0; k < d.length; k += 4) {
          const [r, gg, b] = [d[k], d[k + 1], d[k + 2]];
          if (d[k + 3] < 128 || !(r > gg && gg > b) || r - b < 40) continue;
          const razao = gg / r;
          if (razao < 0.6 || razao > 0.85) continue;
          const luz = (0.3 * r + 0.59 * gg + 0.11 * b) / PELO_BASE;
          for (let c = 0; c < 3; c++) d[k + c] = Math.min(255, Math.round(CREME[c] * luz));
        }
      };
      for (const [i, b] of quadros.entries()) {
        const im = new Image();
        im.src = 'data:image/png;base64,' + b;
        await im.decode();
        g.drawImage(im, i * lw, 0, lw, lh);
        const pedaco = g.getImageData(i * lw, 0, lw, lh);
        clarear(pedaco.data);
        g.putImageData(pedaco, i * lw, 0);
      }
      return { b64: c.toDataURL('image/png').split(',')[1], lw, lh };
    },
    { quadros: ORDEM.map((n) => ler64(path.join(AQUI, `reverencia-${base}-${n}.png`))) },
  );
  await fechar();
  const destino = path.join(RAIZ, 'web', 'site', 'agradecendo.png');
  gravar64(destino, faixa.b64);
  console.log(`folha de ${ORDEM.length} quadros de ${faixa.lw} × ${faixa.lh} px → web/site/agradecendo.png (use steps(${ORDEM.length}) no CSS)`);
} else {
  console.error('use: gerar.mjs coelho | gerar.mjs animar <arquivo sem .png> | gerar.mjs folha reverencia-<base>');
  process.exit(1);
}

console.log(`gerações: ${antes} → ${await saldo()}`);
