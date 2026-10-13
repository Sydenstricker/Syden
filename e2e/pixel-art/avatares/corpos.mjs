// O CORPO INTEIRO DOS 16 COELHOS PRONTOS (13/10/2026). No salão da comunidade cada pessoa aparece com o próprio coelho,
// e o coelho pronto é só cabeça e ombros (é um avatar): no sofá ele saía "cortado ao meio" (relato do Sydenstricker,
// que liberou os créditos do PixelLab para isto). Aqui nasce o mesmo coelho DE PÉ, de corpo inteiro — de pé ele
// serve em todos os lugares do salão, do sofá à rodinha de conversa.
//
// Nasce quase no tamanho do salão (as peças de lá têm ~36 × 54): reduzir pixel art desfaz o rosto (lição do lobby).
//
//   node e2e/pixel-art/avatares/corpos.mjs 3        → corpo-3-<n>.png (as opções do coelho 3)
//   node e2e/pixel-art/avatares/corpos.mjs todos    → os 16
//
// O gasto vai para ../quarto/custos.jsonl (o chamar() de pintura.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { gravar64, ler64 } from '../quarto/imagem.mjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const AVATARES = path.join(AQUI, '..', '..', '..', 'web', 'public', 'avatares');

const saldo = async () =>
  (await (await fetch('https://api.pixellab.ai/v2/balance', { headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}` } })).json())
    .subscription.generations;

async function gerar(n) {
  const ref = path.join(AVATARES, `coelho-${String(n).padStart(2, '0')}.png`);
  const imagens = await chamar('/generate-image-v2', {
    description:
      'the full body of the exact same bunny character as the reference, standing, front three-quarter view, relaxed and friendly, arms down, the same face, ears, fur color, hair, glasses, hat, headphones and clothes as the reference, the clothes continue naturally down the body, legs and feet visible, small cute proportions, bold dark outline, cozy warm pixel art, no background, no text',
    image_size: { width: 48, height: 64 },
    no_background: true,
    reference_images: [
      {
        image: { type: 'base64', base64: ler64(ref), format: 'png' },
        size: { width: 256, height: 256 },
        usage_description: 'This is the character (head and shoulders): keep the face, ears, hair, accessories, clothes and colors identical, and draw the whole body',
      },
    ],
  });
  imagens.forEach((b, i) => gravar64(path.join(AQUI, `corpo-${n}-${i + 1}.png`), b));
  return imagens.length;
}

const alvo = process.argv[2];
const lista = alvo === 'todos' ? Array.from({ length: 16 }, (_, i) => i + 1) : [Number(alvo)];
if (!lista.every((n) => n >= 1 && n <= 16)) {
  console.error('use: corpos.mjs <1..16> | todos');
  process.exit(1);
}
const antes = await saldo();
for (const n of lista) {
  if (alvo === 'todos' && fs.existsSync(path.join(AQUI, `corpo-${n}-1.png`))) continue;
  console.log('coelho', n, '→', await gerar(n), 'opções');
}
console.log(`gerações: ${antes} → ${await saldo()}`);
