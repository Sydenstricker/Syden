// O quarto novo, gerado direto em pixel art (não convertido), com o que se aprendeu nos testes anteriores:
// o conceito como referência de ESTILO, a paleta tirada dele (paleta.png) e só a casca primeiro — paredes,
// chão, friso e a janela, que é fixa. Nas duas ferramentas, para comparar.
//   node e2e/pixel-art/quarto/novo/casca.mjs <rd|pixellab>   → casca/<ferramenta>-<n>.png
import fs from 'node:fs';
import path from 'node:path';
import { fechar, ler64, gravar64 } from '../imagem.mjs';
import { chamar } from '../hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SAIDA = path.join(AQUI, 'casca');
fs.mkdirSync(SAIDA, { recursive: true });
const CONCEITO = ler64(path.join(AQUI, '..', 'hibrido', 'conceito-unzoom.png'));
const DESCRICAO = 'empty isometric cutaway bedroom seen from above at a 2:1 isometric angle, two plain plaster walls meeting at the back corner, a thick wooden trim along the top edge of both walls, a warm wooden plank floor, a wooden window with dark grey curtains and blinds on the right wall, a wooden door on the left wall, NO furniture, nothing on the floor, nothing on the walls, cozy and calm, soft afternoon daylight from the window, clean pixel art with crisp regular diagonal lines';
const custo = (dados) => fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ quando: new Date().toISOString(), ...dados }) + '\n');

const ferramenta = process.argv[2];
if (ferramenta === 'rd') {
  const r = await fetch('https://api.retrodiffusion.ai/v2/inferences', {
    method: 'POST', headers: { 'X-RD-Token': process.env.RETRO_DIFFUSION_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: DESCRICAO, prompt_style: 'rd_pro__isometric', width: 256, height: 256, num_images: 2, reference_images: [CONCEITO], input_palette: ler64(path.join(AQUI, 'paleta.png')) }),
  });
  let j = await r.json();
  if (j.task_id) for (;;) {
    await new Promise((ok) => setTimeout(ok, 4000));
    const t = await (await fetch(`https://api.retrodiffusion.ai/v2/inferences/tasks/${j.task_id}`, { headers: { 'X-RD-Token': process.env.RETRO_DIFFUSION_KEY } })).json();
    if (t.status === 'succeeded') { j = t.result; break; }
    if (['failed', 'error'].includes(t.status)) throw new Error(JSON.stringify(t).slice(0, 400));
  }
  (j.base64_images ?? []).forEach((b, i) => gravar64(path.join(SAIDA, `rd-${i + 1}.png`), b));
  custo({ ferramenta: 'rd', peca: 'novo/casca', usd: j.balance_cost, saldo: j.remaining_balance });
  console.log('rd:', (j.base64_images ?? []).length, 'imagens; saldo', j.remaining_balance);
} else if (ferramenta === 'pixellab') {
  const imagens = await chamar('/generate-image-v2', {
    description: DESCRICAO,
    image_size: { width: 256, height: 256 },
    no_background: false,
    reference_images: [{ image: { type: 'base64', base64: CONCEITO, format: 'png' }, size: { width: 313, height: 314 }, usage_description: 'Match this pixel art style, palette, line quality and room proportions exactly, but leave the room completely empty' }],
  });
  imagens.forEach((b, i) => gravar64(path.join(SAIDA, `pixellab-${i + 1}.png`), b));
  console.log('pixellab:', imagens.length, 'imagens');
} else throw new Error('ferramenta: rd | pixellab');
await fechar();
