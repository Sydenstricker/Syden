// OS QUADROS DO MEIO DA OSCILAÇÃO (pedido dele, 11/11/2026: "precisaria de mais animações entre os estados, pois atualmente ele
// pula entre os estados"; "viável somente pelo PixelLab"). A oscilação usa as cabeças das VISTAS VIZINHAS (a sudeste oscila pela
// sul e pela leste, 45° para cada lado), e o PixelLab gera os desenhos entre duas vistas (interpolation-v2, a mesma das portas do
// guarda-roupa). Ele pode girar o ventilador inteiro: a montagem (ventilador-oscilacao.mjs) aproveita só a cabeça de cada quadro.
// As vistas são as de ventilador-giros-limpos/ (a sul sem a haste atravessando a grade, limpa por código).
//
//   node e2e/pixel-art/quarto/novo/quarto/ventilador-entre-vistas.mjs south:south-east south-east:east
//   → avulsos/ventilador-entre/<de>__<para>-<n>.png (170 × 170, como as vistas)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
// a conexão às vezes cai: as LEITURAS tentam de novo; o POST não, para não pagar duas vezes
{ const _f = globalThis.fetch; globalThis.fetch = async (url, op) => { for (let t = 0; ; t++) { try { return await _f(url, op); } catch (e) { if ((op?.method && op.method !== 'GET') || t >= 5) throw e; await esperar(4000); } } }; }
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const VISTAS = path.join(AQUI, 'avulsos', 'ventilador-giros-limpos');
const SAIDA = path.join(AQUI, 'avulsos', 'ventilador-entre');
fs.mkdirSync(SAIDA, { recursive: true });
// A interpolação aceita até 128 px: as vistas (170) vão numa JANELA de 128 que pega o ventilador inteiro em todas elas (as
// cabeças ficam entre x 53 e 118, o fundo da base em 148), e os quadros voltam ao enquadramento de 170 no mesmo lugar.
const V = 170, L = 128, JX = 21, JY = 22;
const recortar = (buf) => { const de = PNG.sync.read(buf), q = new PNG({ width: L, height: L }); for (let y = 0; y < L; y++) de.data.copy(q.data, y * L * 4, ((y + JY) * V + JX) * 4, ((y + JY) * V + JX + L) * 4); return PNG.sync.write(q); };
const devolver = (buf) => { const de = PNG.sync.read(buf), q = new PNG({ width: V, height: V }); for (let y = 0; y < L; y++) de.data.copy(q.data, ((y + JY) * V + JX) * 4, y * L * 4, (y * L + L) * 4); return PNG.sync.write(q); };
// (sem citar efeito nenhum: o PixelLab desenha o que se cita)
const ACAO = process.env.ACAO ?? 'the standing fan slowly turns in place';
const img = (dir) => ({ image: { type: 'base64', base64: recortar(fs.readFileSync(path.join(VISTAS, dir + '.png'))).toString('base64'), format: 'png' }, size: { width: L, height: L } });

for (const par of process.argv.slice(2)) {
  const [de, para] = par.split(':');
  const antes = await saldo();
  const r = await fetch(API + '/interpolation-v2', {
    method: 'POST', headers: cab,
    body: JSON.stringify({ start_image: img(de), end_image: img(para), action: ACAO, image_size: { width: L, height: L }, no_background: true }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
  const { background_job_id: trabalho } = JSON.parse(t);
  let j;
  for (let i = 0; ; i++) {
    if (i > 150) throw new Error('demorou demais');
    await esperar(4000);
    j = await (await fetch(`${API}/background-jobs/${trabalho}`, { headers: cab })).json();
    if (['completed', 'succeeded'].includes(j.status)) break;
    if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 600));
  }
  const lista = j.last_response?.images ?? j.images ?? j.last_response?.frames ?? [];
  if (!lista.length) { fs.writeFileSync(path.join(SAIDA, 'resposta.json'), JSON.stringify(j, null, 2).slice(0, 6000)); throw new Error('sem quadros; ver resposta.json'); }
  lista.forEach((q, k) => fs.writeFileSync(path.join(SAIDA, `${de}__${para}-${k}.png`), devolver(Buffer.from(typeof q === 'string' ? q : q.base64, 'base64'))));
  const depois = await saldo();
  fs.appendFileSync(path.join(AQUI, '..', '..', '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `quarto/ventilador-entre/${de}__${para}`, geracoes: +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n');
  console.log(`${de} → ${para}: ${lista.length} quadros; custou ${(antes - depois).toFixed(1)}; saldo ${depois}`);
}
