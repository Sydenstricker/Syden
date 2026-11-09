// O GATINHO DA JANELA (09/11/2026, dívida de arte do CLAUDE.md: "um gatinho olhando a janela: deitado, dormindo; clicado,
// ele se espreguiça e senta"). É peça VIVA, como o coelho: um personagem do PixelLab (o esqueleto "cat"), com a pose
// SENTADA de base (8 direções), o ESTADO deitado dormindo, e as passagens por animação v3 com quadro final
// (espreguiçar: do deitado ao sentado; ao contrário, deitar de novo).
//
//   node e2e/pixel-art/personagem/gato.mjs base                 → gato/base/<direção>.png + personagem.json
//   node e2e/pixel-art/personagem/gato.mjs estado dormindo "<edição>"   → gato/estados/dormindo/<direção>.png
//   node e2e/pixel-art/personagem/gato.mjs passagem espreguicar north-east estados/dormindo base "<ação>"
//        → gato/animacoes/espreguicar/<direção>-<n>.png  (do quadro <de> ao <para>, na direção)
//   node e2e/pixel-art/personagem/gato.mjs animar dormindo-respira north-east estados/dormindo "<ação>"
//        → um laço a partir da pose (sem quadro final)
//
// O quadro é 64 (o gato ~40 px, metade do coelho de pé, que tem ~90 num quadro de 120). Sem imagem de estilo (a lição do
// mascote: a referência vira conteúdo); o estilo vai por texto. Cada gasto vai para ../custos.jsonl.
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
// A REDE CAI de vez em quando (09/11/2026: "Connect Timeout" no meio da espera, e o trabalho pago se perdia): as leituras
// (GET) tentam de novo; o pedido que gasta (POST) não, para não pagar duas vezes.
const fetchDaRede = globalThis.fetch;
globalThis.fetch = async (url, op = {}) => {
  for (let i = 0; ; i++) {
    try { return await fetchDaRede(url, op); } catch (e) { if ((op.method ?? 'GET') !== 'GET' || i >= 6) throw e; await new Promise((ok) => setTimeout(ok, 3000 * (i + 1))); }
  }
};
const GATO = path.join(AQUI, 'gato');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const b64 = (arq) => ({ type: 'base64', base64: fs.readFileSync(arq).toString('base64'), format: 'png' });
const QUADRO = Number(process.env.QUADRO || 48);
const DESCRICAO = 'a small cute house cat, orange tabby with soft stripes, cream white chest, muzzle and paws, short round chibi proportions, big round head, small triangle ears with pink inside, long striped tail';

async function pedir(rota, corpo) {
  const r = await fetch(API + rota, { method: 'POST', headers: cab, body: JSON.stringify(corpo) });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
  return JSON.parse(t);
}
async function personagemPronto(id) {
  for (let i = 0; ; i++) {
    if (i > 120) throw new Error('demorou demais');
    await esperar(5000);
    const det = await (await fetch(`${API}/characters/${id}`, { headers: cab })).json();
    if (det.status === 'completed') return det;
    if (['failed', 'error'].includes(det.status)) throw new Error(JSON.stringify(det).slice(0, 600));
  }
}
async function baixarDirecoes(det, pasta) {
  let n = 0;
  for (const [d, v] of Object.entries(det.rotation_urls ?? {})) {
    const url = typeof v === 'string' ? v : v?.url;
    if (url) { fs.writeFileSync(path.join(pasta, d + '.png'), Buffer.from(await (await fetch(url)).arrayBuffer())); n++; }
  }
  return n;
}
// O custo de cada trabalho vem no próprio trabalho (usage); o saldo é dividido com outros agentes e mente quando eles gastam junto.
const usoDe = async (ids) => { let n = 0; for (const id of ids ?? []) { const j = await (await fetch(API + '/background-jobs/' + id, { headers: cab })).json(); n += j.usage?.generations ?? 0; } return n; };
let trabalhos = [];
const gasto = async (peca, antes) => { await esperar(8000); const depois = await saldo(); const uso = await usoDe(trabalhos); return gastoFeito(peca, uso ? uso + 0.001 + depois : antes, depois); };
const gastoFeito = (peca, antes, depois) => fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `personagem/gato/${peca}`, geracoes: +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n');

const [cmd, ...args] = process.argv.slice(2);
const antes = await saldo();

if (cmd === 'base') {
  const pasta = path.join(GATO, 'base');
  fs.mkdirSync(pasta, { recursive: true });
  const { character_id: id } = await pedir('/create-character-pro', {
    method: 'create_with_style',
    description: DESCRICAO + ', sitting upright on the floor, front paws together, tail curled around the paws, calm, eyes open',
    style_description: 'cozy warm isometric pixel art, dark warm brown outline, warm soft palette, soft afternoon light, clean pixel clusters',
    view: 'low top-down',
    image_size: { width: QUADRO, height: QUADRO },
    no_background: true,
    template_id: 'cat',
  });
  const det = await personagemPronto(id);
  fs.writeFileSync(path.join(pasta, 'personagem.json'), JSON.stringify({ id, ...det }, null, 2));
  console.log(await baixarDirecoes(det, pasta), 'direções em gato/base');
  await gasto('base', antes);
} else if (cmd === 'estado') {
  const [nome, edicao] = args;
  const pasta = path.join(GATO, 'estados', nome);
  fs.mkdirSync(pasta, { recursive: true });
  const base = JSON.parse(fs.readFileSync(path.join(GATO, 'base', 'personagem.json'), 'utf8')).id;
  const r = await pedir('/create-character-state', { character_id: base, edit_description: edicao, state_name: nome, no_background: true, use_color_palette_from_reference: true });
  const id = r.character_id ?? r.new_character_id ?? r.id;
  const det = await personagemPronto(id);
  fs.writeFileSync(path.join(pasta, 'estado.json'), JSON.stringify({ id, ...det }, null, 2));
  console.log(await baixarDirecoes(det, pasta), 'direções em gato/estados/' + nome);
  await gasto('estado/' + nome, antes);
} else if (cmd === 'passagem' || cmd === 'animar') {
  // A animação v3 de UMA direção, partindo da pose <de> (custom_start_frame); "passagem" vai até a pose <para>
  // (end_frame). Fica no personagem base (é só onde a animação mora no PixelLab).
  const [nome, direcao, de, para, acao] = cmd === 'passagem' ? args : [args[0], args[1], args[2], null, args[3]];
  const pasta = path.join(GATO, 'animacoes', nome);
  fs.mkdirSync(pasta, { recursive: true });
  const base = JSON.parse(fs.readFileSync(path.join(GATO, 'base', 'personagem.json'), 'utf8')).id;
  const quadro = (p) => b64(path.join(GATO, p, direcao + '.png'));
  const r = await pedir('/characters/animations', {
    character_id: base, mode: 'v3', action_description: acao, animation_name: `${nome}-${direcao}`, frame_count: Number(process.env.QUADROS || 8),
    directions: [direcao], custom_start_frame: quadro(de), ...(para && { end_frame: quadro(para) }), keep_first_frame: true,
  });
  fs.writeFileSync(path.join(pasta, `pedido-${direcao}.json`), JSON.stringify(r, null, 2));
  trabalhos = r.background_job_ids ?? [r.background_job_id].filter(Boolean);
  const grupo = r.animation_group_id;
  let anim;
  for (let i = 0; ; i++) {
    if (i > 240) throw new Error('demorou demais');
    await esperar(5000);
    const det = await (await fetch(`${API}/characters/${base}`, { headers: cab })).json();
    const g = (det.animations ?? []).find((a) => a.animation_group_id === grupo);
    const d = (g?.directions ?? []).find((x) => x.direction === direcao && x.frames?.length);
    if (d) { anim = d; break; }
  }
  for (let k = 0; k < anim.frames.length; k++) fs.writeFileSync(path.join(pasta, `${direcao}-${k}.png`), Buffer.from(await (await fetch(anim.frames[k])).arrayBuffer()));
  console.log(anim.frames.length, 'quadros em gato/animacoes/' + nome);
  await gasto(`animacao/${nome}/${direcao}`, antes);
} else if (cmd === 'recuperar') {
  // Um trabalho já pago cuja espera caiu (a rede): baixa os quadros pelo grupo guardado em pedido-<dir>.json, sem gastar.
  const [nome, direcao] = args, pasta = path.join(GATO, 'animacoes', nome);
  const grupo = JSON.parse(fs.readFileSync(path.join(pasta, `pedido-${direcao}.json`), 'utf8')).animation_group_id;
  const base = JSON.parse(fs.readFileSync(path.join(GATO, 'base', 'personagem.json'), 'utf8')).id;
  let anim;
  for (let i = 0; !anim; i++) {
    if (i > 120) throw new Error('não apareceu');
    const det = await (await fetch(`${API}/characters/${base}`, { headers: cab })).json();
    anim = (det.animations ?? []).find((a) => a.animation_group_id === grupo)?.directions?.find((x) => x.direction === direcao && x.frames?.length);
    if (!anim) await esperar(5000);
  }
  for (let k = 0; k < anim.frames.length; k++) fs.writeFileSync(path.join(pasta, `${direcao}-${k}.png`), Buffer.from(await (await fetch(anim.frames[k])).arrayBuffer()));
  console.log(anim.frames.length, 'quadros recuperados em gato/animacoes/' + nome);
} else throw new Error('uso: gato.mjs base | estado <nome> <edição> | passagem <nome> <dir> <de> <para> <ação> | animar <nome> <dir> <de> <ação>');
console.log('restam', await saldo());
