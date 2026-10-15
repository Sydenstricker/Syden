// AS ANIMAÇÕES DO MASCOTE (14/10/2026, ver README.md). Saem do PRÓPRIO personagem do PixelLab (o esqueleto dele):
// por isso todas têm o mesmo tamanho e o mesmo pé — o provisório do recado, outro desenho, encolhia o coelho.
//
//   node e2e/pixel-art/personagem/animar.mjs <animação> <modelo> <direções separadas por vírgula>
//   node e2e/pixel-art/personagem/animar.mjs andando walking south-east,south-west,north-east,north-west
//   node e2e/pixel-art/personagem/animar.mjs falando "texto:talking with small hand gestures" south-east,south-west
//
// <modelo> é um modelo de esqueleto do PixelLab (1 geração por direção) ou "texto:<ação>" (animação livre, v3).
// Modelos que existem (conferidos em 14/10/2026, a lista da API vem cortada): walk, walking, idle, breathing-idle,
// sitting, sitting-down, lie-down, getting-up, stand-up, drinking, picking-up, crouched-walking.
//
// Saída: mascote/baixa-120/animacoes/<animação>/<direção>-<n>.png, um arquivo por quadro.
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
// PERSONAGEM=<id> anima a partir de um ESTADO (uma pose do mesmo mascote, estado.mjs): o "digitando" parte do sentado ao
// computador.
const PERSONAGEM = process.env.PERSONAGEM || JSON.parse(fs.readFileSync(path.join(AQUI, 'mascote', 'baixa-120', 'personagem.json'), 'utf8')).id;

const [nome, modelo, direcoes] = process.argv.slice(2);
// O PixelLab ACEITA MENOS DIREÇÕES do que se pede quando há trabalhos demais ao mesmo tempo (14/10/2026: sete pedidos
// em paralelo, e cada um levou só uma parte). Pedir de novo com a MESMA animação acrescenta as que faltaram: o grupo
// fica guardado em grupo.txt na pasta dela.
if (!nome || !modelo || !direcoes) throw new Error('uso: animar.mjs <animação> <modelo|texto:ação> <direções>');
const pasta = path.join(AQUI, 'mascote', 'baixa-120', 'animacoes', nome);
fs.mkdirSync(pasta, { recursive: true });

const antes = await saldo();
const arqGrupo = path.join(pasta, 'grupo.txt');
const grupoAntigo = fs.existsSync(arqGrupo) ? fs.readFileSync(arqGrupo, 'utf8').trim() : null;
const corpo0 = modelo.startsWith('texto:')
  ? { character_id: PERSONAGEM, mode: 'v3', action_description: modelo.slice(6), animation_name: nome, frame_count: 8, directions: direcoes.split(','), keep_first_frame: true }
  : { character_id: PERSONAGEM, mode: 'template', template_animation_id: modelo, animation_name: nome, directions: direcoes.split(',') };
const corpo = { ...corpo0, ...(grupoAntigo && { animation_group_id: grupoAntigo }) };
const r = await fetch(API + '/characters/animations', { method: 'POST', headers: cab, body: JSON.stringify(corpo) });
const t = await r.text();
if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
const resposta = JSON.parse(t);
fs.writeFileSync(path.join(pasta, 'pedido.json'), JSON.stringify(resposta, null, 2));
const grupo = resposta.animation_group_id;
fs.writeFileSync(arqGrupo, grupo);
const aceitas = resposta.directions ?? direcoes.split(',');
const recusadas = direcoes.split(',').filter((d) => !aceitas.includes(d));
if (recusadas.length) console.log('o PixelLab aceitou só', aceitas.join(','), '— pedir de novo depois:', recusadas.join(','));
console.log('animação', grupo, 'trabalhos', JSON.stringify(resposta.background_job_ids ?? resposta.background_job_id ?? '').slice(0, 200));

// Espera a animação aparecer no personagem com todas as direções pedidas (o detalhe agrupa por animação:
// { animation_group_id, directions: [{ direction, frame_count, frames: [url…] }] }).
const pedidas = aceitas;
let anim;
for (let i = 0; ; i++) {
  if (i > 240) throw new Error('demorou demais');
  await esperar(5000);
  const det = await (await fetch(`${API}/characters/${PERSONAGEM}`, { headers: cab })).json();
  const g = (det.animations ?? []).find((a) => a.animation_group_id === grupo);
  const prontas = (g?.directions ?? []).filter((d) => d.frames?.length);
  const novas = prontas.filter((d) => pedidas.includes(d.direction));
  if (i % 6 === 0) console.log('…', novas.length, 'de', pedidas.length, 'direções');
  if (novas.length >= pedidas.length) { anim = prontas; break; } // baixa todas as do grupo, as antigas também
}
fs.writeFileSync(path.join(pasta, 'animacao.json'), JSON.stringify(anim, null, 2));
let n = 0;
for (const d of anim) for (let k = 0; k < d.frames.length; k++) {
  fs.writeFileSync(path.join(pasta, `${d.direction}-${k}.png`), Buffer.from(await (await fetch(d.frames[k])).arrayBuffer()));
  n++;
}
const depois = await saldo();
fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `personagem/animacao/${nome}`, geracoes: +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n');
console.log(`${n} quadros em animacoes/${nome}/; custou ${(antes - depois).toFixed(1)} gerações (restam ${depois})`);
