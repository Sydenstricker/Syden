// A PASSAGEM DE UM ESTADO A OUTRO DE UM MÓVEL (pedido dele em 14/10/2026: "a animação das portas do guarda-roupa
// abrindo"). O PixelLab gera os quadros do meio entre o móvel fechado e o aberto (interpolation-v2, a mesma das
// transições do mascote), uma vista por vez: os dois estados são o MESMO objeto (estado.mjs), com o mesmo quadro e o
// mesmo pé, então os quadros do meio caem no lugar. Fechar é a mesma passagem tocada ao avesso.
//
//   node e2e/pixel-art/quarto/novo/quarto/animar-estado.mjs guarda-roupa aberto "the two doors swinging open" south-east
//   → avulsos/<móvel>-<estado>-passagem/<direção>-<n>.png (113 × 113, como as vistas)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

const [movel, estado, acao, direcoes = 'south-east,south-west,north-east,north-west'] = process.argv.slice(2);
const pasta = path.join(AQUI, 'avulsos', `${movel}-${estado}-passagem`);
fs.mkdirSync(pasta, { recursive: true });

// A interpolação pede um quadro de 120: a vista (113) vai no canto de cima à esquerda, com borda vazia, e volta recortada.
const L = 120;
const emQuadro = (arq) => {
  const de = PNG.sync.read(fs.readFileSync(arq)), q = new PNG({ width: L, height: L });
  for (let y = 0; y < de.height; y++) de.data.copy(q.data, (y * L) * 4, (y * de.width) * 4, (y * de.width + de.width) * 4);
  return { image: { type: 'base64', base64: PNG.sync.write(q).toString('base64'), format: 'png' }, size: { width: L, height: L } };
};
const recortar = (buf, w) => {
  const de = PNG.sync.read(buf), q = new PNG({ width: w, height: w });
  for (let y = 0; y < w; y++) de.data.copy(q.data, y * w * 4, y * de.width * 4, (y * de.width + w) * 4);
  return PNG.sync.write(q);
};

for (const direcao of direcoes.split(',')) {
  const a = path.join(AQUI, 'avulsos', movel + '-giros', direcao + '.png'), b = path.join(AQUI, 'avulsos', `${movel}-${estado}-giros`, direcao + '.png');
  const w = PNG.sync.read(fs.readFileSync(a)).width;
  const antes = await saldo();
  const r = await fetch(API + '/interpolation-v2', {
    method: 'POST', headers: cab,
    body: JSON.stringify({ start_image: emQuadro(a), end_image: emQuadro(b), action: acao, image_size: { width: L, height: L }, no_background: true }),
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
  lista.forEach((q, k) => fs.writeFileSync(path.join(pasta, `${direcao}-${k}.png`), recortar(Buffer.from(typeof q === 'string' ? q : q.base64, 'base64'), w)));
  const depois = await saldo();
  fs.appendFileSync(path.join(AQUI, '..', '..', '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `quarto/passagem/${movel}-${estado}/${direcao}`, geracoes: +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n');
  console.log(`${lista.length} quadros de ${direcao}; custou ${(antes - depois).toFixed(1)}`);
}
