// UM ESTADO DE UM MÓVEL (pedido dele em 14/10/2026: "o armário precisa de mais estados, como temos na janela"). O
// PixelLab edita o MESMO objeto das 8 vistas (POST /objects/{id}/states) e devolve um objeto novo, irmão dele: as
// portas abertas saem nas mesmas 8 vistas, no mesmo tamanho e com o mesmo pé.
//
//   node e2e/pixel-art/quarto/novo/quarto/estado.mjs guarda-roupa aberto "both doors wide open, showing clothes hanging inside"
//   → avulsos/<móvel>-<estado>-giros/<direção>.png
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

const [movel, estado, descricao] = process.argv.slice(2);
const origem = JSON.parse(fs.readFileSync(path.join(AQUI, 'avulsos', movel + '-giros', 'objeto.json'), 'utf8'));
const pasta = path.join(AQUI, 'avulsos', `${movel}-${estado}-giros`);
fs.mkdirSync(pasta, { recursive: true });
const antes = await saldo();
const r = await fetch(`${API}/objects/${origem.id ?? origem.object_id}/states`, {
  method: 'POST', headers: cab, body: JSON.stringify({ edit_description: descricao, state_name: estado }),
});
const t = await r.text();
if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
const resposta = JSON.parse(t);
const id = resposta.object_id ?? resposta.id ?? resposta.data?.object_id;
console.log('estado', id, JSON.stringify(resposta).slice(0, 200));
let det;
for (let i = 0; ; i++) {
  if (i > 160) throw new Error('demorou demais');
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
fs.appendFileSync(path.join(AQUI, '..', '..', '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `quarto/estado/${movel}-${estado}`, geracoes: +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n');
console.log(`${n} vistas em avulsos/${movel}-${estado}-giros/ (status ${det.status}); custou ${(antes - depois).toFixed(1)}`);
