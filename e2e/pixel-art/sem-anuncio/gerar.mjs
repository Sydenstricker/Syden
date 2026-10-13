// AS PEÇAS DA CENA "SEM ANÚNCIOS" NO PIXELLAB (13/10/2026). Pedido do Sydenstricker, olhando a primeira versão: "a parte
// da direita [as janelas de anúncio] está bem legal, mas o cenário e o coelho podem melhorar. Pode usar os créditos do
// PixelLab." As janelas e o proibido continuam desenhados por código (sem-anuncio.py); daqui saem só o coelho, em
// duas poses, e a ilha.
//
// O coelho segue a turma creme do site (../agradecendo/turma-1.png: a mesma do salão), com o cachecol vermelho da
// cena antiga. A ilha segue o salão do fim do site (../demonstracao/lobby-1.png).
//
//   node e2e/pixel-art/sem-anuncio/gerar.mjs incomodado → incomodado-<n>.png (anúncios pipocando em volta)
//   node e2e/pixel-art/sem-anuncio/gerar.mjs feliz      → feliz-<n>.png      (os anúncios sumiram)
//   node e2e/pixel-art/sem-anuncio/gerar.mjs ilha       → ilha-<n>.png
//   node e2e/pixel-art/sem-anuncio/gerar.mjs animar incomodado-1 → animado-incomodado-1-<n>.png (8 quadros)
//   node e2e/pixel-art/sem-anuncio/gerar.mjs animar feliz-4      → animado-feliz-4-<n>.png
//
// A animação veio depois (13/10/2026): com o coelho parado, só balançando 1 pixel, ele disse "o coelho de cachecol
// está travado" ao lado das janelas piscando.
//
// O gasto vai para ../quarto/custos.jsonl (o chamar() de pintura.mjs).
import path from 'node:path';
import { gravar64, ler64 } from '../quarto/imagem.mjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const TURMA = path.join(AQUI, '..', 'agradecendo', 'turma-1.png');
const SALAO = path.join(AQUI, '..', 'demonstracao', 'lobby-1.png');

const saldo = async () =>
  (await (await fetch('https://api.pixellab.ai/v2/balance', { headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}` } })).json())
    .subscription.generations;

const COELHO =
  'a full body cute bunny character in the same style as the reference, long ears with pink inside, cream fur, wearing a cozy red knitted scarf with the ends flowing, bold dark outline, cozy warm pixel art, no background, no text';
const PEDIDOS = {
  incomodado: {
    lado: [64, 96],
    referencia: [TURMA, { width: 256, height: 96 }, 'This is the character style: match the faces, ears, cream fur, outline and pixel scale exactly'],
    texto: `${COELHO}, standing in three-quarter view turned to the RIGHT, looking to the right with an annoyed, fed-up frown, both paws raised in front of the chest as if saying "stop", ears slightly drooping`,
  },
  // O feliz parte do incomodado escolhido (incomodado-1.png): é o MESMO coelho, só mudando a pose.
  feliz: {
    lado: [64, 96],
    referencia: [path.join(AQUI, 'incomodado-1.png'), { width: 64, height: 96 }, 'This is the exact same character: keep the face, ears, fur, red scarf, outline and pixel scale identical, change only the pose and expression'],
    // A primeira leva saiu ~25% menor que a referência; o tamanho vai pedido com todas as letras.
    texto: `${COELHO}, standing in three-quarter view turned to the RIGHT, very happy and relieved, eyes closed in a big smile, both paws raised up in celebration, ears up, EXACTLY the same size as the reference: the character fills the whole height of the canvas, ear tips near the top edge and feet at the bottom edge`,
  },
  ilha: {
    lado: [192, 64],
    referencia: [SALAO, { width: 384, height: 192 }, 'This is the art style: match the warm palette, the soft shading and the pixel scale'],
    texto:
      'a small floating island seen from the side, flat grassy top with a few tiny flowers and little tufts of grass, earthy rocky underside tapering down to a point, with a few hanging roots and vines, cozy warm pixel art, the top surface is flat and wide so characters can stand on it, no background, no characters, no buildings, no text',
  },
};

const ACOES = {
  'incomodado-1':
    'the bunny is annoyed and impatient: it taps one foot on the ground, shakes its head side to side with a frown and waves its raised paws as if saying "stop it", its red scarf flutters, then it goes back to the starting pose',
  'feliz-4':
    'the bunny jumps up and down happily twice with its paws raised in celebration, eyes closed in a big smile, its ears and red scarf bounce with each jump, then it lands back in the starting pose',
};

if (process.argv[2] === 'animar') {
  const base = process.argv[3];
  if (!ACOES[base]) {
    console.error('use: gerar.mjs animar ' + Object.keys(ACOES).join(' | '));
    process.exit(1);
  }
  const antes = await saldo();
  const quadros = await chamar('/animate-with-text-v3', {
    first_frame: { type: 'base64', base64: ler64(path.join(AQUI, base + '.png')) },
    action: ACOES[base],
    frame_count: 8,
    no_background: true,
  });
  quadros.forEach((b, i) => gravar64(path.join(AQUI, `animado-${base}-${i + 1}.png`), b));
  console.log('animar', base, '→', quadros.length, 'quadros');
  console.log(`gerações: ${antes} → ${await saldo()}`);
  process.exit(0);
}

const etapa = process.argv[2];
const pedido = PEDIDOS[etapa];
if (!pedido) {
  console.error('use: gerar.mjs ' + Object.keys(PEDIDOS).join(' | '));
  process.exit(1);
}

const [arquivo, tamanho, uso] = pedido.referencia;
const antes = await saldo();
const imagens = await chamar('/generate-image-v2', {
  description: pedido.texto,
  image_size: { width: pedido.lado[0], height: pedido.lado[1] },
  no_background: true,
  reference_images: [{ image: { type: 'base64', base64: ler64(arquivo), format: 'png' }, ...(tamanho ? { size: tamanho } : {}), usage_description: uso }],
});
imagens.forEach((b, i) => gravar64(path.join(AQUI, `${etapa}-${i + 1}.png`), b));
console.log(etapa, '→', imagens.length, 'opções');
console.log(`gerações: ${antes} → ${await saldo()}`);
