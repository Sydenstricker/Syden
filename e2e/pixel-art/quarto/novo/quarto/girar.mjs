// AS QUATRO POSIÇÕES DE UM MÓVEL (pedido dele em 14/10/2026: "todo móvel não deveria ter 4 posições?"). A poltrona
// tinha só duas orientações, pintadas uma a uma. Aqui o PixelLab gera as 8 vistas do MESMO móvel a partir de uma delas
// (create-8-direction-object com reference_image), na mesma vista do mascote ("low top-down"); usam-se as 4 diagonais.
//
//   node e2e/pixel-art/quarto/novo/quarto/girar.mjs poltrona avulsos/poltrona-esquerda-4.png
//   → avulsos/<nome>-giros/<direção>.png
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

const [nome, origem, descricao = 'a green wingback armchair with wooden legs'] = process.argv.slice(2);
const pasta = path.join(AQUI, 'avulsos', nome + '-giros');
fs.mkdirSync(pasta, { recursive: true });
const antes = await saldo();
const r = await fetch(API + '/create-8-direction-object', {
  method: 'POST',
  headers: cab,
  body: JSON.stringify({
    description: descricao,
    view: 'low top-down',
    reference_image: { type: 'base64', base64: fs.readFileSync(path.join(AQUI, origem)).toString('base64'), format: 'png' },
  }),
});
const t = await r.text();
if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
const { object_id: id } = JSON.parse(t);
console.log('objeto', id);
let det;
for (let i = 0; ; i++) {
  if (i > 120) throw new Error('demorou demais');
  await esperar(5000);
  det = await (await fetch(`${API}/objects/${id}`, { headers: cab })).json();
  if (['completed', 'review'].includes(det.status)) break;
  if (['failed', 'error'].includes(det.status)) throw new Error(JSON.stringify(det).slice(0, 600));
}
fs.writeFileSync(path.join(pasta, 'objeto.json'), JSON.stringify(det, null, 2));
const rot = det.rotation_urls ?? det.rotations ?? {};
let n = 0;
for (const [d, v] of Object.entries(rot)) {
  const url = typeof v === 'string' ? v : v?.url;
  if (url) { fs.writeFileSync(path.join(pasta, d + '.png'), Buffer.from(await (await fetch(url)).arrayBuffer())); n++; }
}
const depois = await saldo();
fs.appendFileSync(path.join(AQUI, '..', '..', '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `quarto/giros/${nome}`, geracoes: +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n');
console.log(`${n} vistas em avulsos/${nome}-giros/ (status ${det.status}); custou ${(antes - depois).toFixed(1)}`);
