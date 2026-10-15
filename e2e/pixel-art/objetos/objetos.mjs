// OS OBJETOS DE CIMA (decisão dele, 15/10/2026: "o móvel deve ser uma coisa, os elementos outra"): o que vai no tampo
// de um móvel é peça à parte, para o quarto e o salão. O PADRÃO É SEM ÁLCOOL. A receita é a dos móveis do salão
// (salao/moveis.mjs): avulso com a base do salão de referência, e as 8 vistas do mesmo objeto para os que têm lado
// (a caneca tem asa; o copo e a planta são iguais de todos os lados e ficam com uma vista só).
//   node e2e/pixel-art/objetos/objetos.mjs opcoes <id>        → <id>-<n>.png
//   node e2e/pixel-art/objetos/objetos.mjs girar <id> <n>      → <id>-giros/<direção>.png
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../quarto/imagem.mjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SAIDA = AQUI;
fs.mkdirSync(SAIDA, { recursive: true });
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const ANGULO = 'isometric pixel art seen from above at the same 2:1 isometric angle as the reference, clean dark outline, warm cozy palette like the reference, the whole piece visible';
const PEQUENO = 'a small object meant to sit on top of a table, drawn at the same pixel scale as the reference furniture';
export const MOVEIS = {
  caneca: { lado: [40, 40], texto: `ONLY ONE ceramic coffee mug with a handle and a little steam, and nothing else, ${PEQUENO}, ${ANGULO}` },
  suco: { lado: [40, 48], texto: `ONLY ONE tall glass of orange juice with a striped straw, and nothing else, ${PEQUENO}, ${ANGULO}` },
  refrigerante: { lado: [40, 48], texto: `ONLY ONE red soda can, and nothing else, ${PEQUENO}, ${ANGULO}` },
  plantinha: { lado: [40, 48], texto: `ONLY ONE tiny potted succulent plant in a small terracotta pot, and nothing else, ${PEQUENO}, ${ANGULO}` },
  livros: { lado: [48, 40], texto: `ONLY ONE short stack of three colorful books lying flat, and nothing else, ${PEQUENO}, ${ANGULO}` },
  videogame: { lado: [56, 40], texto: `ONLY ONE small modern game console with one wireless controller beside it, and nothing else, ${PEQUENO}, ${ANGULO}` },
  pipoca: { lado: [48, 40], texto: `ONLY ONE striped bowl full of popcorn, and nothing else, ${PEQUENO}, ${ANGULO}` },
  retrato: { lado: [40, 48], texto: `ONLY ONE small standing wooden picture frame with a tiny photo, and nothing else, ${PEQUENO}, ${ANGULO}` },
};

const [modo, id, n] = process.argv.slice(2);
const m = MOVEIS[id];
if (!m) throw new Error('objetos: ' + Object.keys(MOVEIS).join(', '));
if (modo === 'opcoes') {
  // A referência de estilo: o chão e o tijolo da base escolhida (o pedaço de baixo, à esquerda).
  const p = await abrir();
  const ref = await p.evaluate(async (b) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode();
    const c = document.createElement('canvas'); c.width = 160; c.height = 160; c.getContext('2d').drawImage(im, -60, -200);
    return c.toDataURL('image/png').split(',')[1];
  }, ler64(path.join(AQUI, '..', 'salao', 'base.png')));
  await fechar();
  const imagens = await chamar('/generate-image-v2', {
    description: m.texto, image_size: { width: m.lado[0], height: m.lado[1] }, no_background: true,
    reference_images: [{ image: { type: 'base64', base64: ref, format: 'png' }, size: { width: 160, height: 160 }, usage_description: 'Match this pixel art style, outline, palette, light and pixel scale exactly; draw only the requested piece of furniture' }],
  });
  imagens.forEach((b, i) => gravar64(path.join(SAIDA, `${id}-${i + 1}.png`), b));
  console.log(id, '→', imagens.length, 'opções');
} else if (modo === 'girar') {
  const pasta = path.join(SAIDA, id + '-giros');
  fs.mkdirSync(pasta, { recursive: true });
  const antes = await saldo();
  const r = await fetch(API + '/create-8-direction-object', {
    method: 'POST', headers: cab,
    body: JSON.stringify({ description: m.texto.replace(/^ONLY ONE /, '').split(', isometric')[0], view: 'low top-down', reference_image: { type: 'base64', base64: fs.readFileSync(path.join(SAIDA, `${id}-${n}.png`)).toString('base64'), format: 'png' } }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
  const { object_id: oid } = JSON.parse(t);
  let det;
  for (let i = 0; ; i++) {
    if (i > 160) throw new Error('demorou demais');
    await esperar(5000);
    det = await (await fetch(`${API}/objects/${oid}`, { headers: cab })).json();
    if (['completed', 'review'].includes(det.status)) break;
    if (['failed', 'error'].includes(det.status)) throw new Error(JSON.stringify(det).slice(0, 600));
  }
  fs.writeFileSync(path.join(pasta, 'objeto.json'), JSON.stringify(det, null, 2));
  let k = 0;
  for (const [d, v] of Object.entries(det.rotation_urls ?? {})) {
    const url = typeof v === 'string' ? v : v?.url;
    for (let tentativa = 0; url && tentativa < 4; tentativa++) {
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      // "too_busy" volta como um PNG quebrado: confere a assinatura e pede de novo
      if (buf.slice(1, 4).toString() === 'PNG' && buf.length > 500) { fs.writeFileSync(path.join(pasta, d + '.png'), buf); k++; break; }
      await esperar(4000);
    }
  }
  fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: 'objetos/giros/' + id, geracoes: +(antes - (await saldo())).toFixed(1), quando: new Date().toISOString() }) + '\n');
  console.log(id, k, 'vistas');
}
