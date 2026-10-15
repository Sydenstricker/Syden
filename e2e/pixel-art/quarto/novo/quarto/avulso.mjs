// Móveis AVULSOS: gerados inteiros, sem fundo, fora do quarto, e depois postos nele e repintados só na forma (para a
// luz de lá, como as versões do pufe). Ideia dele em 08/10/2026: pintado dentro do quarto, o guarda-roupa saiu com o
// topo cortado pela máscara, e a estante, embutida na parede (falhas/).
//   node e2e/pixel-art/quarto/novo/quarto/avulso.mjs <id>   → avulsos/<id>-<n>.png (várias opções numa chamada)
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../../imagem.mjs';
import { chamar } from '../../hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SAIDA = path.join(AQUI, 'avulsos');
fs.mkdirSync(SAIDA, { recursive: true });
const ANGULO = 'isometric pixel art seen from above at the same 2:1 isometric angle as the reference, clean outline, warm muted palette, soft afternoon light from the right';
// A poltrona é o primeiro móvel solto que não é redondo: é ela que testa o botão de girar (pedido dele, 08/10/2026).
// Duas orientações pintadas, e não espelhadas: espelhar inverteria o lado da luz, que vem sempre da janela. Num
// quadro de 72 × 88 ela saía menor que o pufe (avulsos/pequenas/); em 120 × 136, do tamanho de uma poltrona.
const POLTRONA = 'a small cozy upholstered armchair with a soft dusty-green fabric seat and wooden legs, the whole piece visible';
export const AVULSOS = {
  'poltrona-esquerda': { lado: [120, 136], texto: `${POLTRONA}, the seat and the front of the armchair facing to the LEFT-front (toward the lower left of the image), ${ANGULO}` },
  'poltrona-direita': { lado: [120, 136], texto: `${POLTRONA}, the seat and the front of the armchair facing to the RIGHT-front (toward the lower right of the image), ${ANGULO}` },
  // A CAMA DE CASAL (pedido dele, 14/10/2026: "essa atual parece de solteiro"; a referência é a cama da home, do conceito):
  // larga, com gavetas embaixo e a colcha xadrez. A primeira de uma coleção de camas para desbloquear.
  'cama-casal': { lado: [150, 136], texto: `ONLY ONE large double bed and nothing else: a wide wooden bed frame with a headboard, a row of wooden drawers along the long side under the mattress, a thick soft checkered blanket in muted grey and beige, two big cream pillows side by side at the headboard, the headboard at the back on the UPPER RIGHT of the image and the foot of the bed toward the LOWER LEFT, the long side with the drawers facing the right-front (toward the lower right of the image), the whole piece visible, ${ANGULO}` },
  // A MESA DO COMPUTADOR e a CADEIRA (pedido dele, 14/10/2026): a mesa é onde ele fica em call; a cadeira é solta e rola
  // com física. A referência é o canto do computador da home (o conceito): mesa de madeira, monitor, teclado, gabinete.
  mesa: { lado: [150, 136], texto: `ONLY ONE wooden computer desk and nothing else: a simple wooden desk with a computer monitor, a keyboard and a mouse on top, a small desktop computer tower on the floor under one side, the front of the desk facing the right-front (toward the lower right of the image), the whole piece visible, no chair, ${ANGULO}` },
  cadeira: { lado: [80, 104], texto: `ONLY ONE office swivel chair and nothing else: a dark grey fabric desk chair with a backrest, armrests, a gas lift and a five-star base with small black caster wheels, the seat facing the left-front (toward the lower left of the image), the whole piece visible, ${ANGULO}` },
  // AS PLANTAS (pedido dele, 15/10/2026: "recheio: plantas"). Uma planta é igual de todos os lados: o mesmo desenho
  // serve às 4 posições.
  'planta-alta': { lado: [72, 120], texto: `ONLY ONE tall leafy monstera houseplant in a round terracotta pot standing on the floor, and nothing else, the whole plant visible from the leaves to the pot, ${ANGULO}` },
  'planta-baixa': { lado: [64, 72], texto: `ONLY ONE small round bushy green fern in a woven wicker basket pot standing on the floor, and nothing else, the whole plant visible, ${ANGULO}` },
  'guarda-roupa': { lado: [64, 160], texto: `a tall freestanding wooden wardrobe with two doors and small round knobs, the whole piece visible from the top cornice to the feet, its doors facing to the right-front, the back against a wall on its left side, ${ANGULO}` },
};

const id = process.argv[2];
const a = AVULSOS[id];
if (!a) throw new Error('avulsos: ' + Object.keys(AVULSOS).join(', '));
// A referência de estilo: a cama e o criado-mudo já pintados no quarto (mesma mão, mesma escala de pixel).
const p = await abrir();
const ref = await p.evaluate(async (b) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode();
  const c = document.createElement('canvas'); c.width = 160; c.height = 160; c.getContext('2d').drawImage(im, -128, -150);
  return c.toDataURL('image/png').split(',')[1];
}, ler64(path.join(AQUI, 'passos', '2-abajur.png')));
await fechar();
const imagens = await chamar('/generate-image-v2', {
  description: a.texto, image_size: { width: a.lado[0], height: a.lado[1] }, no_background: true,
  reference_images: [{ image: { type: 'base64', base64: ref, format: 'png' }, size: { width: 160, height: 160 }, usage_description: 'Match this pixel art style, outline, palette, light and pixel scale exactly; draw only the requested piece of furniture' }],
});
imagens.forEach((b, i) => gravar64(path.join(SAIDA, `${id}-${i + 1}.png`), b));
console.log(id, '→', imagens.length);
