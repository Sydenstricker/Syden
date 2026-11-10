// A FOTO DE FRENTE DE CORPO INTEIRO DE CADA COELHO PRONTO (09/11/2026, pedido dele: "eu preciso de uma foto de perfil,
// como eu usei no mascote principal, de todos os avatares"). É a entrada do Meshy para o modelo 3D de cada coelho, no
// formato de personagem/mascote/conceito.png (de frente, corpo inteiro, braços para baixo, fundo transparente): o
// mascote 3D (e2e/3D/Personagens/mascote.glb) saiu daquele desenho. O corpo de pé que já existe (corpos.mjs, 48 × 64, de
// três quartos) é pequeno demais e de lado para o Meshy.
//
// Duas referências: o avatar (quem ele é: rosto, orelhas, cabelo, acessórios, cores) e o corpo de pé dele (corpos.mjs: a
// roupa do pescoço para baixo). A pose de frente vai por texto. (Com o conceito do mascote como referência de pose, a
// primeira tentativa vestiu o coelho com o moletom escuro e as orelhas lilás do mascote.)
//
//   node e2e/pixel-art/avatares/frente.mjs 2        → frente/coelho-02-<n>.png (as opções do coelho 2)
//   node e2e/pixel-art/avatares/frente.mjs todos    → os 16 (pula os que já têm opções)
import fs from 'node:fs';
import path from 'node:path';
import { gravar64, ler64 } from '../quarto/imagem.mjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const AVATARES = path.join(AQUI, '..', '..', '..', 'web', 'public', 'avatares');
const SAIDA = path.join(AQUI, 'frente');
fs.mkdirSync(SAIDA, { recursive: true });

const saldo = async () =>
  (await (await fetch('https://api.pixellab.ai/v2/balance', { headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}` } })).json())
    .subscription.generations;

// a largura e a altura de um PNG, do cabeçalho
const tamanho = (f) => { const b = fs.readFileSync(f); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };

async function gerar(n) {
  const nn = String(n).padStart(2, '0');
  // ROUPA=frente: a roupa vem da 1ª foto de frente deste coelho (frente/coelho-NN-1.png), grande e fiel, e não do corpo de 48 px
  // (com o 14 de estilo, o 01 e o 05 saíram com o moletom escuro DELE: a roupa pequena perdia para a do estilo).
  const corpo = process.env.ROUPA === 'frente' ? path.join(SAIDA, `coelho-${nn}-1.png`) : path.join(AVATARES, `coelho-${nn}-corpo.png`);
  const imagens = await chamar('/generate-image-v2', {
    description:
      'the full body of the exact same bunny character as the first reference, seen straight from the FRONT, standing upright and symmetric, arms relaxed down at the sides, legs slightly apart, both feet visible, ears up and separated (droopy ears stay droopy), the same face, ears, fur color, hair, glasses, hat, headphones, scarf and clothes as the first reference, the clothes continue naturally down the body, the clothes, pants and shoes from the second reference, chibi proportions with a big head, the whole character small enough to fit inside the frame with empty space above the ear tips and below the feet (about three quarters of the frame height), fine detailed pixel art with 1-pixel dark outline, cozy pixel art, flat even light, no shadow, no background, no text',
    image_size: { width: 128, height: 192 },
    no_background: true,
    reference_images: [
      {
        image: { type: 'base64', base64: ler64(path.join(AVATARES, `coelho-${nn}.png`)), format: 'png' },
        size: { width: 256, height: 256 },
        usage_description: 'This is the character (head and shoulders): keep the face, ears, hair, accessories, clothes and colors identical, and draw the whole body',
      },
      // O ESTILO (09/11/2026, relato dele: "o de headset me parece claramente mais bem acabado; tem alguma inconsistência?"):
      // gerado cada um sozinho, o acabamento variava, e os que enchiam o quadro saíam com blocos maiores e cortados (07, 10,
      // 16). O 14 (o de headset e moletom escuro), o mais bem acabado com o 09, vai de referência de ESTILO para os outros (ESTILO=14 no ambiente).
      ...(process.env.ESTILO && Number(process.env.ESTILO) !== n ? [
      {
        image: { type: 'base64', base64: ler64(path.join(SAIDA, `coelho-${String(process.env.ESTILO).padStart(2, '0')}-1.png`)), format: 'png' },
        size: { width: 128, height: 192 },
        usage_description: 'Only the drawing style, level of detail, pixel density, outline, shading and the size of the character in the frame: match it exactly. Do NOT copy this character, its colors or clothes',
      },
      ] : []),
      // (o 16 não tem o corpo de pé: vai só com o avatar)
      ...(fs.existsSync(corpo) ? [
      {
        image: { type: 'base64', base64: ler64(corpo), format: 'png' },
        size: tamanho(corpo),
        usage_description: 'The same character full body, small and seen from three-quarter: copy the clothes, pants, shoes and colors from it, but draw it seen from the front, bigger and with more detail',
      },
      ] : []),
    ],
  });
  // (as novas tentativas não apagam as anteriores: o número segue)
  const jaHa = fs.readdirSync(SAIDA).filter((f) => f.startsWith(`coelho-${nn}-`)).length;
  imagens.forEach((b, i) => gravar64(path.join(SAIDA, `coelho-${nn}-${jaHa + i + 1}.png`), b));
  return imagens.length;
}

const alvo = process.argv[2];
const lista = alvo === 'todos' ? Array.from({ length: 16 }, (_, i) => i + 1) : alvo.split(',').map(Number);
if (!lista.every((n) => n >= 1 && n <= 16)) {
  console.error('use: frente.mjs <1..16[,…]> | todos');
  process.exit(1);
}
const antes = await saldo();
for (const n of lista) {
  if (alvo === 'todos' && fs.existsSync(path.join(SAIDA, `coelho-${String(n).padStart(2, '0')}-1.png`))) continue;
  console.log('coelho', n, '→', await gerar(n), 'opções');
}
console.log(`gerações: ${antes} → ${await saldo()}`);
