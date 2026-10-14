// UMA POSE NOVA DO MESMO MASCOTE (14/10/2026). Sentar e deitar não existem nos modelos de esqueleto do corpo
// "mannequin", e a animação por texto não sai da pose de pé (o "sentado" saía de pé). O caminho é o ESTADO: a mesma
// edição aplicada a todas as direções do personagem, com a paleta dele, salva como um personagem irmão. A animação
// (animar.mjs, com PERSONAGEM=<id do estado>) parte dessa pose.
//
//   node e2e/pixel-art/personagem/estado.mjs sentado "sitting on a low seat, legs bent forward, hands on lap"
//   → mascote/estados/<nome>/<direção>.png + estado.json
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const BASE = JSON.parse(fs.readFileSync(path.join(AQUI, 'mascote', 'baixa-120', 'personagem.json'), 'utf8')).id;

const [nome, edicao] = process.argv.slice(2);
const pasta = path.join(AQUI, 'mascote', 'estados', nome);
fs.mkdirSync(pasta, { recursive: true });
const antes = await saldo();
const r = await fetch(API + '/create-character-state', {
  method: 'POST',
  headers: cab,
  body: JSON.stringify({ character_id: BASE, edit_description: edicao, state_name: nome, no_background: true, use_color_palette_from_reference: true }),
});
const t = await r.text();
if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
const resposta = JSON.parse(t);
const id = resposta.character_id ?? resposta.new_character_id ?? resposta.id;
console.log('estado', id, JSON.stringify(resposta).slice(0, 200));
let det;
for (let i = 0; ; i++) {
  if (i > 120) throw new Error('demorou demais');
  await esperar(5000);
  det = await (await fetch(`${API}/characters/${id}`, { headers: cab })).json();
  if (det.status === 'completed') break;
  if (['failed', 'error'].includes(det.status)) throw new Error(JSON.stringify(det).slice(0, 600));
}
fs.writeFileSync(path.join(pasta, 'estado.json'), JSON.stringify({ id, ...det }, null, 2));
let n = 0;
for (const [d, url] of Object.entries(det.rotation_urls ?? {})) {
  if (url) { fs.writeFileSync(path.join(pasta, d + '.png'), Buffer.from(await (await fetch(url)).arrayBuffer())); n++; }
}
const depois = await saldo();
fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `personagem/estado/${nome}`, geracoes: +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n');
console.log(`${n} direções em mascote/estados/${nome}/; custou ${(antes - depois).toFixed(1)}`);
