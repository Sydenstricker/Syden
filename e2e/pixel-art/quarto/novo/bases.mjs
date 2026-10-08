// Uma rodada de BASES para o quarto novo: a mesma casca em resoluções maiores, variações de clima, e o Retro
// Diffusion sem a paleta imposta (foi ela que deixou a primeira rodada laranja). A base decide muito do
// resultado, por isso vale ver várias antes de seguir.
//   node e2e/pixel-art/quarto/novo/bases.mjs [id,...]   → bases/<id>-<n>.png (pula o que já existe)
import fs from 'node:fs';
import path from 'node:path';
import { fechar, ler64, gravar64 } from '../imagem.mjs';
import { chamar } from '../hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SAIDA = path.join(AQUI, 'bases');
fs.mkdirSync(SAIDA, { recursive: true });
const CONCEITO = ler64(path.join(AQUI, '..', 'hibrido', 'conceito-unzoom.png'));

const SALA = 'empty isometric cutaway bedroom seen from above at a 2:1 isometric angle, two walls meeting at the back corner, a thick wooden trim along the top edge of both walls, a warm wooden plank floor, a wooden window with dark grey curtains and blinds on the right wall, a wooden door on the left wall, NO furniture, nothing on the floor, nothing on the walls, clean pixel art with crisp regular diagonal lines';
const LUZ_TARDE = 'cozy and calm, soft afternoon daylight from the window';
export const BASES = [
  { id: 'pl-384', ferramenta: 'pixellab', lado: 384, texto: `${SALA}, plain plaster walls, ${LUZ_TARDE}` },
  { id: 'pl-512', ferramenta: 'pixellab', lado: 512, texto: `${SALA}, plain plaster walls, ${LUZ_TARDE}` },
  { id: 'pl-papel', ferramenta: 'pixellab', lado: 256, texto: `${SALA}, walls with a subtle small-pattern wallpaper above tall wooden wainscoting, warm golden late-afternoon light, cozy` },
  { id: 'pl-noite', ferramenta: 'pixellab', lado: 256, texto: `${SALA}, plain plaster walls, night, dark blue night sky and moonlight through the window, dim cozy room` },
  { id: 'rd-pro', ferramenta: 'rd', estilo: 'rd_pro__isometric', lado: 256, n: 2, texto: `${SALA}, plain plaster walls, ${LUZ_TARDE}` },
  { id: 'rd-plus', ferramenta: 'rd', estilo: 'rd_plus__isometric', lado: 384, n: 2, texto: `${SALA}, plain plaster walls, ${LUZ_TARDE}` },
];

const custo = (dados) => fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ quando: new Date().toISOString(), ...dados }) + '\n');
async function rd(b) {
  const corpo = { prompt: b.texto, prompt_style: b.estilo, width: b.lado, height: b.lado, num_images: b.n };
  if (b.estilo.startsWith('rd_pro')) corpo.reference_images = [CONCEITO];
  const r = await fetch('https://api.retrodiffusion.ai/v2/inferences', { method: 'POST', headers: { 'X-RD-Token': process.env.RETRO_DIFFUSION_KEY, 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  let j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  if (j.task_id) for (;;) {
    await new Promise((ok) => setTimeout(ok, 4000));
    const t = await (await fetch(`https://api.retrodiffusion.ai/v2/inferences/tasks/${j.task_id}`, { headers: { 'X-RD-Token': process.env.RETRO_DIFFUSION_KEY } })).json();
    if (t.status === 'succeeded') { j = t.result; break; }
    if (['failed', 'error'].includes(t.status)) throw new Error(JSON.stringify(t).slice(0, 400));
  }
  custo({ ferramenta: 'rd', peca: 'novo/base-' + b.id, usd: j.balance_cost, saldo: j.remaining_balance });
  return j.base64_images ?? [];
}
const pixellab = (b) => chamar('/generate-image-v2', {
  description: b.texto, image_size: { width: b.lado, height: b.lado }, no_background: false,
  reference_images: [{ image: { type: 'base64', base64: CONCEITO, format: 'png' }, size: { width: 313, height: 314 }, usage_description: 'Match this pixel art style, palette, line quality and room proportions, but leave the room completely empty' }],
});

const so = process.argv[2]?.split(',');
await Promise.all(BASES.filter((b) => !so || so.includes(b.id)).map(async (b) => {
  if (fs.readdirSync(SAIDA).some((f) => f.startsWith(b.id + '-'))) return console.log('já existe:', b.id);
  try {
    const imagens = await (b.ferramenta === 'rd' ? rd(b) : pixellab(b));
    imagens.forEach((x, i) => gravar64(path.join(SAIDA, `${b.id}-${i + 1}.png`), x));
    console.log(b.id, '→', imagens.length);
  } catch (e) { console.log(b.id, 'ERRO', e.message); }
}));
await fechar();
