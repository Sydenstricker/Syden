// O BANHEIRO DO SALÃO EM PIXEL ART (09/11/2026, pedido dele: "pode criar o banheiro de fato para o salão? Use o banheiro 3D
// atual como referência, para não destoar"). A arte, toda do PixelLab e toda AVULSA (a regra de 17/10/2026): a casca (o
// cômodo vazio, como a do salão) e cada peça sozinha, sem fundo, com o salão de pixel art de referência de ESTILO e o
// banheiro 3D (web/src/salao3d/, fotografado em ref-3d-dia.png) de referência de CONTEÚDO. As peças nascem no tamanho
// final: o quadro é ~0,56 da foto do 3D (o PixelLab desenha a peça em ~70% do quadro; no primeiro lote, a 0,40, as peças
// sairam pequenas para o cômodo, e a banheira, a pia, o vaso, a porta, o espelho, a prateleira e o tapete foram pedidos de
// novo, 1,4× maiores; ver referencias.py). A montagem é de montar.py.
//   node e2e/pixel-art/salao/banheiro/banheiro.mjs casca            → casca-<n>.png
//   node e2e/pixel-art/salao/banheiro/banheiro.mjs peca <id>        → pecas/<id>-<n>.png (várias opções numa chamada)
// Cada chamada vai ao e2e/pixel-art/custos.jsonl com o que custou (o saldo antes e depois).
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const b64 = (arq) => fs.readFileSync(path.join(AQUI, arq)).toString('base64');
const medida = (arq) => { const b = fs.readFileSync(path.join(AQUI, arq)); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };
const ref = (arq, uso) => ({ image: { type: 'base64', base64: b64(arq), format: 'png' }, size: medida(arq), usage_description: uso });

const ANGULO = 'isometric pixel art seen from above at the same 2:1 isometric angle as the reference, clean dark outline, soft warm cozy shading like the reference, the whole piece visible';
const ESTILO = 'Match this pixel art style exactly: the outline, the palette warmth, the light, the shading and the pixel scale; draw only the requested piece';
const CONTEUDO = 'This is the object to draw (from a 3D render of the same bathroom): keep its shape, colors and parts, but redraw it as pixel art';
// As peças do banheiro 3D (PECAS_DO_BANHEIRO em web/src/salao3d/cena.ts), no tamanho em que vão ao banheiro.
export const PECAS = {
  banheira: { lado: [146, 112], texto: `ONLY ONE white freestanding oval bathtub on little feet and nothing else: filled with light blue water and white soap foam bubbles, a chrome faucet with red and blue knobs at the back end, NO duck, its long side running from the upper left down to the lower right, along the back-right wall, ${ANGULO}` },
  pia: { lado: [128, 124], texto: `ONLY ONE bathroom sink vanity and nothing else: a light blue countertop on a white cabinet with two round yellow knobs, a round white sink bowl with a chrome faucet, a yellow cup with toothbrushes and a small blue soap bottle on the counter, ${ANGULO}` },
  espelho: { lado: [52, 70], texto: `ONLY ONE oval bathroom wall mirror with a thick white rounded frame, light blue glass with a soft diagonal shine, hanging flat on the back-right wall of an isometric room (the wall line slopes down to the right), its face turned toward the lower left, ${ANGULO}` },
  prateleira: { lado: [100, 72], texto: `ONLY ONE small wooden wall shelf and nothing else, on it: a short white candle in a little cup, a small green succulent plant in a teal pot, a light blue bottle and a pink bottle, the shelf fixed to the back-right wall of an isometric room (the wall line slopes down to the right), running along it, ${ANGULO}` },
  vaso: { lado: [78, 84], texto: `ONLY ONE white toilet with the lid closed and nothing else: the white tank at the back against the back-right wall of an isometric room, the bowl facing toward the lower left of the image, ${ANGULO}` },
  tapete: { lado: [96, 56], texto: `ONLY ONE soft pink rounded bath mat lying flat on the floor with a pair of yellow slippers on it and nothing else, ${ANGULO}` },
  toalhas: { lado: [28, 28], texto: `ONLY ONE small stack of folded towels on the floor: a pink towel, a yellow towel and a light blue towel on top, ${ANGULO}` },
  lixo: { lado: [24, 28], texto: `ONLY ONE small blue-gray round bathroom trash bin and nothing else, ${ANGULO}` },
  // (a 20 × 24 o PixelLab devolveu as 64 opções cortadas umas nas outras; a 32 × 32 saem inteiras)
  papel: { lado: [32, 32], texto: `ONLY ONE small stack of two white toilet paper rolls, one standing on top of the other, on the floor and nothing else, ${ANGULO}` },
  // A PORTA DE DENTRO: a mesma porta do banheiro do salão (parede-salao/porta), menor (na escala do banheiro); como lá, desenhada
  // para a parede da direita, e espelhada na montagem para a da esquerda.
  porta: { lado: [64, 136], ref: '../../quarto/novo/quarto/parede-salao/porta/avulso-1.png', texto: `ONLY ONE closed dark wooden door with its wooden frame and nothing else: two raised panels, a small round golden sign with a duck on it, a golden lever handle on the left side, standing on the floor against the back-right wall of an isometric room (the wall line slopes down to the right), its face turned toward the lower left, exactly like the reference door, ${ANGULO}` },
  patinho: { lado: [16, 16], texto: 'ONLY ONE tiny yellow rubber duck with an orange beak, floating, seen from the side and slightly above, cute pixel art with a dark outline' },
};
const CASCA = 'ONE empty small isometric cutaway bathroom room seen from above at a 2:1 isometric angle, exactly the shape of the guide: two walls meeting at the back corner, a dark wooden trim along the top edge of both walls, the lower part of both walls covered in small white square ceramic tiles with light gray grout, warm soft yellow painted plaster above the tiles, a mint green square tiled floor, the floor slab edge in the front, NO furniture, nothing on the floor, nothing on the walls, no window, no door, clean pixel art with crisp regular diagonal lines';

async function chamar(rota, corpo, peca) {
  const antes = await saldo();
  // (o trabalho fica anotado: se a espera acabar antes dele, RETOMAR=<id> busca o resultado sem pagar de novo)
  let j;
  if (process.env.RETOMAR) j = { background_job_id: process.env.RETOMAR };
  else {
    const r = await fetch(API + rota, { method: 'POST', headers: cab, body: JSON.stringify(corpo) });
    const t = await r.text();
    if (!r.ok) throw new Error(rota + ' ' + r.status + ': ' + t.slice(0, 400));
    j = JSON.parse(t);
  }
  const trabalho = j.background_job_id;
  if (trabalho && !process.env.RETOMAR) fs.appendFileSync(path.join(AQUI, 'trabalhos.log'), peca + ' ' + trabalho + '\n');
  if (trabalho) for (let i = 0; ; i++) {
    if (i > 450) throw new Error('demorou demais: ' + trabalho);
    await esperar(4000);
    j = await (await fetch(API + '/background-jobs/' + trabalho, { headers: cab })).json();
    if (['completed', 'succeeded'].includes(j.status)) break;
    if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 400));
  }
  const geracoes = j.usage?.generations ?? +(antes - (await saldo())).toFixed(1);
  fs.appendFileSync(path.join(AQUI, '..', '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: 'salao/banheiro/' + peca, geracoes, quando: new Date().toISOString() }) + '\n');
  console.log(peca, 'custou', geracoes);
  const lista = j.last_response?.images ?? j.images ?? (j.last_response?.image ? [j.last_response.image] : []);
  return lista.map((im) => (typeof im === 'string' ? im : im.base64));
}
const proximo = (pasta, prefixo) => { let n = 1; while (fs.existsSync(path.join(pasta, `${prefixo}-${n}.png`))) n++; return n; };

const [modo, id] = process.argv.slice(2);
if (modo === 'casca') {
  const imgs = await chamar('/generate-image-v2', {
    // (o PixelLab encolhe o cômodo uns 25% dentro do quadro: casca-1 saiu com ~0,75 da casa do salão. GRANDE=1 pede no
    // quadro maior, com o guia ampliado na mesma conta, para o cômodo sair na casa do salão)
    description: CASCA + ', subtle soft shading: darker in the back corner and where the walls meet the floor, small highlights on the tiles, cozy and calm', image_size: process.env.GRANDE ? { width: 432, height: 528 } : { width: 320, height: 392 }, no_background: true,
    reference_images: [
      ref(process.env.GRANDE ? 'guia-grande.png' : 'guia.png', 'Follow EXACTLY this room: the same outline, isometric angle, proportions, wall height, wall lengths (the right wall longer than the left), tile band height and floor slab; repaint it as detailed cozy pixel art'),
      ref('ref/estilo.png', 'Match this pixel art style: outline, palette warmth, shading and pixel scale'),
      ref('ref/cascas.png', 'The same bathroom in 3D, for the materials and colors of the walls and the floor only: ignore every piece of furniture'),
    ],
  }, 'casca');
  let n = proximo(AQUI, 'casca');
  for (const b of imgs) fs.writeFileSync(path.join(AQUI, `casca-${n++}.png`), Buffer.from(b, 'base64'));
} else if (modo === 'peca') {
  const m = PECAS[id];
  if (!m) throw new Error('peças: ' + Object.keys(PECAS).join(', '));
  const pasta = path.join(AQUI, 'pecas');
  fs.mkdirSync(pasta, { recursive: true });
  const imgs = await chamar('/generate-image-v2', {
    description: m.texto, image_size: { width: m.lado[0], height: m.lado[1] }, no_background: true,
    reference_images: [ref('ref/estilo.png', ESTILO), ref(m.ref ?? `ref/${id}.png`, m.ref ? 'This is the door to draw, at a smaller size: keep its angle, wood, panels, sign and handle exactly' : CONTEUDO)],
  }, 'peca/' + id);
  let n = proximo(pasta, id);
  for (const b of imgs) fs.writeFileSync(path.join(pasta, `${id}-${n++}.png`), Buffer.from(b, 'base64'));
  console.log(id, '→', imgs.length, 'opções');
} else throw new Error('modo: casca | peca <id>');
