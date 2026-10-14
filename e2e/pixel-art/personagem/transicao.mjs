// AS TRANSIÇÕES (pedido dele em 14/10/2026: "de pé vai direto para sentado"). O PixelLab gera os quadros do meio entre
// dois desenhos do MESMO mascote (interpolation-v2): do parado até a pose (sentado, deitado). Ao contrário, toca ao
// avesso (levantar).
//
//   node e2e/pixel-art/personagem/transicao.mjs sentar south-east baixa-120/south-east.png estados/sentado-2/south-east.png "sitting down"
//   → mascote/transicoes/<nome>/<direção>-<n>.png
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const img = (arq) => ({ image: { type: 'base64', base64: fs.readFileSync(path.join(AQUI, 'mascote', arq)).toString('base64'), format: 'png' }, size: { width: 120, height: 120 } });

const [nome, direcao, de, para, acao] = process.argv.slice(2);
const pasta = path.join(AQUI, 'mascote', 'transicoes', nome);
fs.mkdirSync(pasta, { recursive: true });
const antes = await saldo();
const r = await fetch(API + '/interpolation-v2', {
  method: 'POST',
  headers: cab,
  body: JSON.stringify({ start_image: img(de), end_image: img(para), action: acao, image_size: { width: 120, height: 120 }, no_background: true }),
});
const t = await r.text();
if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
const { background_job_id: trabalho } = JSON.parse(t);
let j;
for (let i = 0; ; i++) {
  if (i > 120) throw new Error('demorou demais');
  await esperar(4000);
  j = await (await fetch(`${API}/background-jobs/${trabalho}`, { headers: cab })).json();
  if (['completed', 'succeeded'].includes(j.status)) break;
  if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 600));
}
const lista = j.last_response?.images ?? j.images ?? j.last_response?.frames ?? [];
if (!lista.length) { fs.writeFileSync(path.join(pasta, 'resposta.json'), JSON.stringify(j, null, 2).slice(0, 6000)); throw new Error('sem quadros; ver resposta.json'); }
lista.forEach((q, k) => fs.writeFileSync(path.join(pasta, `${direcao}-${k}.png`), Buffer.from(typeof q === 'string' ? q : q.base64, 'base64')));
const depois = await saldo();
fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `personagem/transicao/${nome}/${direcao}`, geracoes: +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n');
console.log(`${lista.length} quadros em transicoes/${nome}/${direcao}; custou ${(antes - depois).toFixed(1)}`);
