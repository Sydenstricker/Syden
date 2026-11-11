// OS OBJETOS DE CIMA REFEITOS (10/11/2026, pedido dele: "os itens em cima dos móveis merecem uma melhorada na qualidade" e "a
// suculenta também está muito rudimentar"). Os de pequenos.mjs (09/11) nasceram no tamanho certo, mas pelo
// create-1-direction-object: 64 casas numa chamada, cada uma com pouco cuidado (contorno preto grosso, cores chapadas, a
// planta um borrão verde). Aqui cada peça é pedida SOZINHA pelo generate-image-v2, sem fundo, com a MESA ENFEITADA do quarto
// (avulsos/mesa-teclado-enfeitada-giros, que tem os livros e o vasinho pintados na escala de verdade) como referência de
// estilo, de luz e do tamanho do pixel. O quadro é o tamanho final (nada de reduzir depois).
//   node e2e/pixel-art/objetos/refeitos.mjs <id> [lado=32]   → pequenos/refeitos/<id>-<n>.png
// A escolhida vai para pequenos/escolhidos.json (o caminho relativo a pequenos/), que o montar.mjs já lê.
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SAIDA = path.join(AQUI, 'pequenos', 'refeitos');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const ESTILO = path.join(AQUI, '..', 'quarto', 'novo', 'quarto', 'avulsos', 'mesa-teclado-enfeitada-giros', 'south-west.png');

const COMUM = 'cozy isometric pixel art item, seen from above at the same 3/4 isometric angle as the desk in the reference, soft dark brown 1-pixel outline (not pure black), warm muted cozy palette, light from the upper left with a lit top and a shaded right side, clean readable silhouette, centered with transparent space around it, no table, no floor, no shadow on the ground, no text';
export const OBJETOS = {
  plantinha: 'ONE tiny echeveria succulent rosette with plump pale sage-green pointed leaves arranged in a star-like rosette and pink-tipped edges, in a small round terracotta clay pot with a rim',
  caneca: 'ONE teal ceramic mug with a round handle on the right side, filled with hot brown cocoa',
  livros: 'ONE short stack of three hardcover books lying flat, slightly offset, in muted green, red and blue covers with cream pages visible on the side',
  suco: 'ONE tall clear glass of orange juice with a striped straw and a small orange slice on the rim',
  refrigerante: 'ONE standing red soda can with a silver top and pull tab, a white stripe on the label',
  pipoca: 'ONE red and white striped paper popcorn bucket overflowing with fluffy popcorn',
  retrato: 'ONE small standing wooden picture frame with a photo of green hills and blue sky, propped up on its stand',
  // (a primeira rodada, "dark grey console", saiu escura e com manchas brancas: 10/11/2026)
  videogame: 'ONE small light grey retro home video game console lying flat, with a slot and two colored buttons on top, and one small grey gamepad controller with a cable lying in front of it',
  salgadinho: 'ONE open bag of potato chips lying on its side, with a few golden chips spilling out',
  bolo: 'ONE round chocolate layer cake on a white plate, with red strawberries and cream on top',
};

const [id, ladoTxt] = process.argv.slice(2);
if (!OBJETOS[id]) throw new Error('id: ' + Object.keys(OBJETOS).join(', '));
const lado = +(ladoTxt ?? 32);
fs.mkdirSync(SAIDA, { recursive: true });
const estilo = fs.readFileSync(ESTILO).toString('base64');
const antes = await saldo();
const r = await fetch(API + '/generate-image-v2', {
  method: 'POST', headers: cab,
  body: JSON.stringify({
    description: `${OBJETOS[id]}, ${COMUM}`, image_size: { width: lado, height: lado }, no_background: true,
    reference_images: [{ image: { type: 'base64', base64: estilo, format: 'png' }, size: { width: 113, height: 113 }, usage_description: 'Match this pixel art style, outline color, palette, shading, isometric angle and PIXEL SCALE exactly (the small books and the little potted plant on this desk show the right size and detail for a desk object); draw only the requested object, alone' }],
  }),
});
let j = JSON.parse(await r.text().then((t) => { if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600)); return t; }));
const trabalho = j.background_job_id;
if (trabalho) for (let i = 0; ; i++) {
  if (i > 150) throw new Error('demorou demais: ' + trabalho);
  await esperar(4000);
  try { j = await (await fetch(API + '/background-jobs/' + trabalho, { headers: cab })).json(); } catch { continue; }
  if (['completed', 'succeeded'].includes(j.status)) break;
  if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 600));
}
const depois = await saldo();
const usage = j.usage ?? j.last_response?.usage ?? null;
fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `objetos/pequenos/refeitos/${id} (${lado}px)`, geracoes: usage?.generations ?? null, usage, saldo: [antes, depois], nota: 'o saldo é dividido com outros pedidos ao mesmo tempo', quando: new Date().toISOString() }) + '\n');
const lista = j.last_response?.images ?? j.images ?? [];
const ja = fs.readdirSync(SAIDA).filter((f) => f.startsWith(id + '-')).length;
lista.forEach((im, k) => fs.writeFileSync(path.join(SAIDA, `${id}-${ja + k + 1}.png`), Buffer.from(typeof im === 'string' ? im : im.base64, 'base64')));
console.log(id, lista.length, 'imagens; usage', JSON.stringify(usage), 'saldo', antes, '→', depois);
