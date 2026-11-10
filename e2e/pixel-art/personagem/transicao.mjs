// AS TRANSIÇÕES (pedido dele em 14/10/2026: "de pé vai direto para sentado"). O PixelLab gera os quadros do meio entre
// dois desenhos do MESMO mascote (interpolation-v2): do parado até a pose (sentado, deitado). Ao contrário, toca ao
// avesso (levantar).
//
//   node e2e/pixel-art/personagem/transicao.mjs sentar south-east baixa-120/south-east.png estados/sentado-2/south-east.png "sitting down"
//   → mascote/transicoes/<nome>/<direção>-<n>.png
//
// COELHO=<corpo> faz a transição de um CORPO BASE: os dois desenhos são lidos de <corpo>/ e a saída vai para
// <corpo>/transicoes/<nome>/.
// MOTOR=v3 (10/11/2026) usa a animação v3 do personagem com o quadro FINAL (end_frame, o "modo de interpolação" de
// /characters/animations), em vez do interpolation-v2: sai a passagem inteira de uma vez (QUADROS=4..16, par; o quadro 0
// é o desenho de partida), por ~3 gerações a direção, contra 10 por PAR de quadros do interpolation-v2 (as fluidas do
// mascote foram três pares encadeados, 30 por direção). PEGAR=0,2 guarda só esses quadros, renumerados (para ter o mesmo
// número de quadros da transição do mascote).
//   COELHO=musculoso MOTOR=v3 QUADROS=6 node e2e/pixel-art/personagem/transicao.mjs sentar-fluido south-east baixa-120/south-east.png estados/sentado-2/south-east.png "sitting down on the floor"
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
// a conexão às vezes cai no meio (ECONNRESET, 10/11/2026): as LEITURAS (GET) tentam de novo; o POST não, para não pagar duas vezes
{ const _f = globalThis.fetch; globalThis.fetch = async (url, op) => { for (let t = 0; ; t++) { try { return await _f(url, op); } catch (e) { if ((op?.method && op.method !== 'GET') || t >= 5) throw e; await esperar(4000); } } }; }
const COELHO = process.env.COELHO || 'mascote';
const b64 = (arq) => fs.readFileSync(path.join(AQUI, COELHO, arq)).toString('base64');
const img = (arq) => ({ image: { type: 'base64', base64: b64(arq), format: 'png' }, size: { width: 120, height: 120 } });

const [nome, direcao, de, para, acao] = process.argv.slice(2);
if (!acao) throw new Error('uso: [COELHO=<corpo>] [MOTOR=v3 QUADROS=n PEGAR=i,j] transicao.mjs <nome> <direção> <de> <para> "<ação>"');
const pasta = path.join(AQUI, COELHO, 'transicoes', nome);
fs.mkdirSync(pasta, { recursive: true });
const antes = await saldo();
const registrar = async (n) => {
  const depois = await saldo();
  fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `personagem/transicao/${COELHO === 'mascote' ? '' : COELHO + '/'}${nome}/${direcao}`, geracoes: +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n');
  console.log(`${n} quadros em ${COELHO}/transicoes/${nome}/${direcao}; custou ${(antes - depois).toFixed(1)} (restam ${depois})`);
};
const baixar = async (url) => {
  for (let t = 0; t < 4; t++) {
    const b = Buffer.from(await (await fetch(url)).arrayBuffer());
    if (b.subarray(1, 4).toString() === 'PNG') return b;
    await esperar(3000); // o erro 500 em JSON no lugar do PNG (animar.mjs)
  }
  return null;
};
const pegar = (lista) => (process.env.PEGAR ? process.env.PEGAR.split(',').map(Number).map((i) => lista[i]) : lista);
if (process.env.MOTOR === 'v3') {
  const PERSONAGEM = JSON.parse(fs.readFileSync(path.join(AQUI, COELHO, 'baixa-120', 'personagem.json'), 'utf8')).id;
  const r = await fetch(API + '/characters/animations', {
    method: 'POST', headers: cab,
    body: JSON.stringify({
      character_id: PERSONAGEM, mode: 'v3', action_description: acao, animation_name: `transicao-${nome}-${direcao}`,
      frame_count: +(process.env.QUADROS || 6), directions: [direcao], keep_first_frame: true,
      custom_start_frame: { type: 'base64', base64: b64(de), format: 'png' }, end_frame: { type: 'base64', base64: b64(para), format: 'png' },
    }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
  const { animation_group_id: grupo } = JSON.parse(t);
  let dir;
  for (let i = 0; ; i++) {
    if (i > 240) throw new Error('demorou demais');
    await esperar(5000);
    const det = await (await fetch(`${API}/characters/${PERSONAGEM}`, { headers: cab })).json();
    dir = (det.animations ?? []).find((a) => a.animation_group_id === grupo)?.directions?.find((d) => d.direction === direcao && d.frames?.length);
    if (dir) break;
  }
  for (const f of fs.readdirSync(pasta)) if (f.startsWith(direcao + '-')) fs.rmSync(path.join(pasta, f));
  const quadros = [];
  for (const url of dir.frames) quadros.push(await baixar(url));
  if (quadros.some((b) => !b)) console.log('algum quadro não veio (erro do PixelLab): conferir a sequência');
  const escolhidos = pegar(quadros).filter(Boolean);
  escolhidos.forEach((b, k) => fs.writeFileSync(path.join(pasta, `${direcao}-${k}.png`), b));
  await registrar(escolhidos.length);
  process.exit(0);
}
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
const escolhidos = pegar(lista);
escolhidos.forEach((q, k) => fs.writeFileSync(path.join(pasta, `${direcao}-${k}.png`), Buffer.from(typeof q === 'string' ? q : q.base64, 'base64')));
await registrar(escolhidos.length);
