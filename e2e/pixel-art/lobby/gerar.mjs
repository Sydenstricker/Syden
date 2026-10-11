// A gente do lobby (pedido de 10/10/2026): "senti falta de variação nos corpos do coelho — cabelo colorido,
// musculoso, magrinho, gordo, feminino" e "não tem pessoas no ambiente além dos coelhos agradecendo, fica pouco
// natural". O salão é ../demonstracao/lobby-1.png; aqui nascem os personagens que o habitam.
//
// A referência de estilo é a turma creme (../agradecendo/turma-1.png): mesma mão, mesmo creme, mesmo contorno.
//
//   node e2e/pixel-art/lobby/gerar.mjs corpos     → corpos-<n>.png   (de pé, cada um com um corpo e um estilo)
//   node e2e/pixel-art/lobby/gerar.mjs conversando → conversando-<n>.png (de pé, de três quartos, conversando)
//   node e2e/pixel-art/lobby/gerar.mjs videogame  → videogame-<n>.png (sentado no chão, jogando, de costas)
//   node e2e/pixel-art/lobby/gerar.mjs fliperama  → fliperama-<n>.png (de pé no fliperama, de costas)
//   node e2e/pixel-art/lobby/gerar.mjs balcao     → balcao-<n>.png    (no balcão, com um copo na mão)
//   node e2e/pixel-art/lobby/gerar.mjs sentados   → sentados-<n>.png  (sentado, conversando e rindo)
//   node e2e/pixel-art/lobby/gerar.mjs celular    → celular-<n>.png   (no sofá, mexendo no celular, já no tamanho do salão)
//
// O gasto vai para ../quarto/custos.jsonl (o chamar() de pintura.mjs).
import path from 'node:path';
import { gravar64, ler64 } from '../quarto/imagem.mjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const REFERENCIA = path.join(AQUI, '..', 'agradecendo', 'turma-1.png');

const saldo = async () =>
  (await (await fetch('https://api.pixellab.ai/v2/balance', { headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}` } })).json())
    .subscription.generations;

const ESTILO = 'cute bunny character in the same style as the reference, long ears with pink inside, bold dark outline, cozy warm pixel art, no background, no text';
const PEDIDOS = {
  corpos: {
    lado: [64, 96],
    texto: `a full body ${ESTILO}, standing, front view, every one with a clearly different body and look: a chubby round bunny, a tall muscular bunny in a tank top, a small skinny bunny, a bunny with a bright pink dyed hair tuft, a bunny with a big bow and a skirt, a bunny with blue curly hair and freckles, a bunny with a long braid, a grey-furred bunny with a beanie, a brown-furred bunny with glasses, a bunny in a cozy oversized sweater`,
  },
  // O segundo lote: no tamanho 64 × 96 a chamada devolve só 4 opções, e as do primeiro foram gordinho,
  // musculoso, magrinho e cabelo rosa. Aqui, o resto da lista.
  corpos2: {
    lado: [64, 96],
    texto: `a full body ${ESTILO}, standing, front view, every one with a clearly different body and look: a bunny girl with a big red bow between the ears and a pleated skirt, a bunny with blue curly hair and freckles, a bunny with a long purple braid and a dress, a curvy bunny with a cropped jacket and long eyelashes`,
  },
  // Os de pé olhavam para quem vê o site, e isso os descolava do salão (relato de 10/10/2026: "parecem colados
  // numa camada à frente do cenário"). Gente conversando olha para quem conversa: de três quartos, virada para
  // a DIREITA; o par se forma espelhando um deles.
  conversando: {
    lado: [64, 96],
    texto: `a full body ${ESTILO}, standing in three-quarter view turned to the RIGHT, looking to the right and chatting with someone off-image, one paw gesturing while talking, every one with a clearly different body and look: a chubby bunny in a sweater, a tall muscular bunny in a tank top, a bunny with a long purple braid and a dress, a bunny with a big red bow and a skirt`,
  },
  videogame: {
    lado: [64, 64],
    texto: `a ${ESTILO}, sitting on the floor cross-legged seen from behind and slightly to the side, holding a game controller and playing, relaxed`,
  },
  fliperama: {
    lado: [64, 96],
    texto: `a full body ${ESTILO}, standing seen from behind, both hands on the buttons of an arcade machine that is not drawn, playing excitedly`,
  },
  // O de cima não alcança a máquina: os coelhos são baixinhos e os botões ficam acima da cabeça (relato de
  // 10/10/2026: "precisa de uma interação melhor com a máquina"). Este sobe num banquinho.
  fliperama2: {
    lado: [64, 96],
    texto: `a full body ${ESTILO}, seen from behind, standing on tiptoes on a small wooden step stool, both arms raised forward and up to reach the joystick and buttons of a tall arcade machine that is not drawn, playing excitedly, the stool is drawn under the feet`,
  },
  // Os do sofá nasciam em 64 px e iam a 27 no salão: o rosto se desfazia na redução (relato de 10/10/2026:
  // "esses dois coelhos estão bem ruins"). Estes nascem quase no tamanho do salão, mexendo no celular.
  celular: {
    lado: [40, 40],
    texto: `a tiny ${ESTILO}, sitting relaxed on a sofa (the sofa is not drawn), seen from the front, looking down at a smartphone held in both paws, the phone screen glows softly, simple readable shapes for a small sprite`,
  },
  balcao: {
    lado: [64, 96],
    texto: `a full body ${ESTILO}, standing, seen from the side three-quarter view, holding a soda cup in one paw and waving with the other, chatting happily`,
  },
  sentados: {
    lado: [64, 64],
    texto: `a ${ESTILO}, sitting down as if on a sofa (the sofa is not drawn), seen from the front, laughing with eyes closed, paws on the knees`,
  },
};

const etapa = process.argv[2];
const pedido = PEDIDOS[etapa];
if (!pedido) {
  console.error('use: gerar.mjs ' + Object.keys(PEDIDOS).join(' | '));
  process.exit(1);
}

const antes = await saldo();
const imagens = await chamar('/generate-image-v2', {
  description: pedido.texto,
  image_size: { width: pedido.lado[0], height: pedido.lado[1] },
  no_background: true,
  reference_images: [
    {
      image: { type: 'base64', base64: ler64(REFERENCIA), format: 'png' },
      size: { width: 256, height: 96 },
      usage_description: 'This is the character style: match the faces, ears, cream fur, outline and pixel scale exactly',
    },
  ],
});
imagens.forEach((b, i) => gravar64(path.join(AQUI, `${etapa}-${i + 1}.png`), b));
console.log(etapa, '→', imagens.length, 'opções');
console.log(`gerações: ${antes} → ${await saldo()}`);
