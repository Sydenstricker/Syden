// UMA POSE NOVA DO MESMO MASCOTE (14/10/2026). Sentar e deitar não existem nos modelos de esqueleto do corpo
// "mannequin", e a animação por texto não sai da pose de pé (o "sentado" saía de pé). O caminho é o ESTADO: a mesma
// edição aplicada a todas as direções do personagem, com a paleta dele, salva como um personagem irmão. A animação
// (animar.mjs, com PERSONAGEM=<id do estado>) parte dessa pose.
//
//   node e2e/pixel-art/personagem/estado.mjs sentado "sitting on a low seat, legs bent forward, hands on lap"
//   → mascote/estados/<nome>/<direção>.png + estado.json
//
// COELHO=<corpo> faz a pose de um CORPO BASE (orelha-caida, musculoso: corpo-novo.mjs) → <corpo>/estados/<nome>/. A origem
// é o personagem do corpo (<corpo>/baixa-120/personagem.json), a não ser que ORIGEM diga outra:
// ORIGEM=<pasta de um estado com estado.json> (ex.: mascote/estados/sentado-2) parte de uma pose JÁ FEITA, e a edição muda o
// corpo e não a pose (10/11/2026: as poses dos corpos novos saem das do mascote, validadas na cena, com a edição do corpo de
// corpo-novo.mjs; assim o assento, a cama e os braços da poltrona continuam no mesmo lugar).
// SEMENTE=<n> troca a semente (para refazer um que saiu ruim).
//   COELHO=orelha-caida ORIGEM=mascote/estados/sentado-2 node e2e/pixel-art/personagem/estado.mjs sentado-2 "<edição do corpo>"
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
const BASE = process.env.ORIGEM
  ? JSON.parse(fs.readFileSync(path.join(AQUI, process.env.ORIGEM, 'estado.json'), 'utf8')).id
  : JSON.parse(fs.readFileSync(path.join(AQUI, COELHO, 'baixa-120', 'personagem.json'), 'utf8')).id;

const [nome, edicao] = process.argv.slice(2);
if (!nome || !edicao) throw new Error('uso: [COELHO=<corpo>] [ORIGEM=<pasta do estado>] estado.mjs <nome> "<edição>"');
const pasta = path.join(AQUI, COELHO, 'estados', nome);
fs.mkdirSync(pasta, { recursive: true });
const antes = await saldo();
const r = await fetch(API + '/create-character-state', {
  method: 'POST',
  headers: cab,
  body: JSON.stringify({ character_id: BASE, edit_description: edicao, state_name: nome, no_background: true, use_color_palette_from_reference: true, ...(process.env.SEMENTE && { seed: +process.env.SEMENTE }) }),
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
// a edição e a origem ficam guardadas (as do mascote se perderam: o detalhe do PixelLab não as devolve)
fs.writeFileSync(path.join(pasta, 'estado.json'), JSON.stringify({ id, edicao, origem: process.env.ORIGEM || `${COELHO}/baixa-120`, de: BASE, ...det }, null, 2));
let n = 0;
for (const [d, v] of Object.entries(det.rotation_urls ?? {})) {
  const url = typeof v === 'string' ? v : v?.url;
  if (!url) continue;
  // o endereço às vezes devolve um erro 500 em JSON no lugar do PNG (animar.mjs): tenta de novo e avisa
  let b = null;
  for (let t = 0; t < 4 && !b; t++) {
    b = Buffer.from(await (await fetch(url)).arrayBuffer());
    if (b.subarray(1, 4).toString() !== 'PNG') { b = null; await esperar(3000); }
  }
  if (!b) { console.log(`a direção ${d} não veio (erro do PixelLab)`); continue; }
  fs.writeFileSync(path.join(pasta, d + '.png'), b); n++;
}
const depois = await saldo();
fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `personagem/estado/${COELHO === 'mascote' ? '' : COELHO + '/'}${nome}`, geracoes: +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n');
console.log(`${n} direções em ${COELHO}/estados/${nome}/; custou ${(antes - depois).toFixed(1)} (restam ${depois})`);
