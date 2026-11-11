// O VENTILADOR OSCILANDO (pedido dele, 10/11/2026: o botão direito liga o ventilador, e o terceiro estado é "ligado com a
// cabeça oscilando de um lado para o outro"). O PixelLab anima a vista parada (animate-with-text-v3, o primeiro quadro é ela),
// uma direção por vez, e os quadros saem em avulsos/ventilador-oscilar/<direção>-<n>.png, no enquadramento da vista (170 × 170).
// A montagem (ventilador-quadros.mjs) cola só a CABEÇA de cada quadro sobre o pé e a base da vista parada.
//
//   node e2e/pixel-art/quarto/novo/quarto/ventilador-oscilar.mjs south-west
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
// (sem citar efeito nenhum, nem para proibir: o PixelLab desenha o que se cita)
const ACAO = process.env.ACAO ?? 'the fan head slowly swivels to the left, comes back to the middle, swivels to the right and comes back to the middle, pivoting on top of the pole; the pole and the round base stay perfectly still';

const direcao = process.argv[2];
if (!direcao) { console.error('use: ventilador-oscilar.mjs <direção> [sufixo]'); process.exit(1); }
const sufixo = process.argv[3] ?? '';
const pasta = path.join(AQUI, 'avulsos', 'ventilador-oscilar' + sufixo);
fs.mkdirSync(pasta, { recursive: true });
const vista = path.join(AQUI, 'avulsos', 'ventilador-giros', direcao + '.png');
const antes = await saldo();
const r = await fetch(API + '/animate-with-text-v3', {
  method: 'POST', headers: cab,
  body: JSON.stringify({ first_frame: { type: 'base64', base64: fs.readFileSync(vista).toString('base64') }, action: ACAO, frame_count: 8, no_background: true }),
});
const t = await r.text();
if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
let j = JSON.parse(t);
console.log('trabalho', j.background_job_id); fs.writeFileSync(path.join(pasta, direcao + '-trabalho.txt'), String(j.background_job_id));
const trabalho = j.background_job_id;
if (trabalho) for (let i = 0; ; i++) {
  if (i > 600) throw new Error('demorou demais');
  await esperar(4000);
  j = await (await fetch(`${API}/background-jobs/${trabalho}`, { headers: cab })).json();
  if (['completed', 'succeeded'].includes(j.status)) break;
  if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 600));
}
const lista = j.last_response?.images ?? j.images ?? [];
if (!lista.length) { fs.writeFileSync(path.join(pasta, 'resposta.json'), JSON.stringify(j, null, 2).slice(0, 6000)); throw new Error('sem quadros; ver resposta.json'); }
lista.forEach((q, k) => fs.writeFileSync(path.join(pasta, `${direcao}-${k}.png`), Buffer.from(typeof q === 'string' ? q : q.base64, 'base64')));
const depois = await saldo();
fs.appendFileSync(path.join(AQUI, '..', '..', '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `quarto/ventilador-oscilar${sufixo}/${direcao}`, geracoes: +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n');
console.log(`${lista.length} quadros de ${direcao}; custou ${(antes - depois).toFixed(1)} (saldo ${depois}; pode incluir o gasto de outros trabalhos em paralelo)`);
