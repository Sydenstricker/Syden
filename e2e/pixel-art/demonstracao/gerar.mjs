// A arte da comunidade de demonstração, em pixel art no estilo do quarto (pedido de 10/10/2026: "fazer uma
// comunidade bem feita para mostrar o potencial da customização"; o tema escolhido foi um squad de jogo).
//
// A comunidade inventada se chama "Squad das Sextas". A capa e o ícone são gerados aqui, com um recorte do
// próprio quarto (a mesa com o computador) como referência de estilo: mesma mão, mesma luz, mesma paleta.
// Nada de jogo, marca ou personagem de ninguém — a cena é de um grupo jogando junto, não de um jogo.
//
//   node e2e/pixel-art/demonstracao/gerar.mjs capa    → capa-<n>.png  (a faixa do alto da barra lateral)
//   node e2e/pixel-art/demonstracao/gerar.mjs icone   → icone-<n>.png (o ícone da comunidade)
//   node e2e/pixel-art/demonstracao/gerar.mjs avatares → avatares-<n>.png (o rosto de cada pessoa do squad)
//   node e2e/pixel-art/demonstracao/gerar.mjs jogo     → jogo-<n>.png (a tela de jogo que alguém compartilha na call)
//   node e2e/pixel-art/demonstracao/gerar.mjs lobby    → lobby-<n>.png (o salão onde a turma agradece, no fim do site)
//   node e2e/pixel-art/demonstracao/gerar.mjs animar-jogo → jogo-1-anim-<k>.png (o jogo da call, em movimento)
//
// O gasto vai para ../quarto/custos.jsonl (o chamar() de pintura.mjs).
import path from 'node:path';
import { abrir, fechar, gravar64, ler64 } from '../quarto/imagem.mjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const RAIZ = path.join(AQUI, '..', '..', '..');

const saldo = async () =>
  (await (await fetch('https://api.pixellab.ai/v2/balance', { headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}` } })).json())
    .subscription.generations;

/** A mesa do computador, recortada da pintura da noite: a referência de estilo. */
async function referencia() {
  const p = await abrir();
  const b64 = await p.evaluate(async (b) => {
    const im = new Image();
    im.src = 'data:image/png;base64,' + b;
    await im.decode();
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    c.getContext('2d').drawImage(im, -180, -100);
    return c.toDataURL('image/png').split(',')[1];
  }, ler64(path.join(RAIZ, 'web', 'src', 'assets', 'quarto', 'noite.png')));
  await fechar();
  return b64;
}

const PEDIDOS = {
  capa: {
    lado: [256, 104],
    texto:
      'a wide cozy pixel art banner scene at night: a small group gaming session seen from behind, three glowing monitors on a long wooden desk, headsets, a game controller, snacks and a soda can, warm amber desk lamp light mixed with the cool blue glow of the screens, a window with a night city skyline behind, plants, fairy lights, no people faces visible, no text, no logos, wide horizontal composition',
    fundo: false,
  },
  lobby: {
    lado: [384, 192],
    texto:
      'a cozy pixel art hangout lounge interior at night, seen straight from the front like a stage, wide room: a big comfy sofa with cushions, an arcade cabinet glowing, a large wall screen, a small bar counter with snacks, potted plants, warm string lights across the ceiling, a rug, warm amber lamp light mixed with soft blue screen glow, the floor in the front half of the image is open and empty, no people, no animals, no characters, no text, no logos',
    fundo: false,
  },
  jogo: {
    lado: [256, 144],
    texto:
      'a colorful original pixel art video game screenshot, a side-scrolling platformer level at sunset: floating grass platforms, glowing coins, a small cream bunny hero with a red scarf jumping, little round enemies, mountains and a big orange sun in the background, a simple score bar of hearts at the top, vivid but warm palette, no text, no logos, nothing from existing games',
    fundo: false,
  },
  avatares: {
    lado: [64, 64],
    texto:
      'a pixel art avatar portrait of a cute cream-white bunny with long ears and soft pink inside, head and shoulders, front view, each one with a different gamer accessory such as a headset, a backwards cap, a beanie, round glasses, a hoodie, star sunglasses or a bandana, friendly expression, bold dark outline, plain warm background circle, no text',
    fundo: true,
  },
  icone: {
    lado: [64, 64],
    texto:
      'a single cute game controller icon with two small cream bunny ears on top, centered, bold dark outline, warm amber and night blue colors, simple and readable at small sizes, no text',
    fundo: true,
  },
};

// O jogo da call, ANIMADO (pedido de 10/10/2026: "animar essa imagem, mostrando o jogo na tela"): os quadros
// saem de jogo-1.png, e e2e/call-animada.mjs os toca na tela compartilhada.
//   node e2e/pixel-art/demonstracao/gerar.mjs animar-jogo → jogo-1-anim-<k>.png
if (process.argv[2] === 'animar-jogo') {
  const quadros = await chamar('/animate-with-text-v3', {
    first_frame: { type: 'base64', base64: ler64(path.join(AQUI, 'jogo-1.png')) },
    action:
      'the video game is being played: the cream bunny hero with the red scarf runs to the right and jumps between the floating platforms, the coins spin and sparkle, the little round enemies walk back and forth; the mountains and the sun stay in place',
    frame_count: 8,
    no_background: false,
  });
  quadros.forEach((b, i) => gravar64(path.join(AQUI, `jogo-1-anim-${i + 1}.png`), b));
  console.log('jogo animado →', quadros.length, 'quadros');
  await fechar();
  process.exit(0);
}

const pedido = PEDIDOS[process.argv[2]];
if (!pedido) {
  console.error('use: gerar.mjs capa | icone | avatares | jogo | lobby');
  process.exit(1);
}

const antes = await saldo();
const imagens = await chamar('/generate-image-v2', {
  description: pedido.texto,
  image_size: { width: pedido.lado[0], height: pedido.lado[1] },
  no_background: pedido.fundo,
  reference_images: [
    {
      image: { type: 'base64', base64: await referencia(), format: 'png' },
      size: { width: 128, height: 128 },
      usage_description: 'Match this pixel art style, outline, palette, warm light and pixel scale exactly',
    },
  ],
});
imagens.forEach((b, i) => gravar64(path.join(AQUI, `${process.argv[2]}-${i + 1}.png`), b));
console.log(process.argv[2], '→', imagens.length, 'opções');
console.log(`gerações: ${antes} → ${await saldo()}`);
