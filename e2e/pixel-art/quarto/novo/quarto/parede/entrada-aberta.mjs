// A PORTA DE ENTRADA ABERTA: a fechada escolhida (fechada-3) com SÓ A FOLHA repintada (inpaint-v3, máscara
// mascara-folha.png): o batente, o lampião e o tamanho ficam idênticos, e abrir não troca de porta. Gerar a aberta
// inteira (entrada.mjs aberta) dava um batente de outro tamanho (v1-aberta/).
//   node e2e/pixel-art/quarto/novo/quarto/parede/entrada-aberta.mjs   → parede-salao/entrada/aberta-<n>.png
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const D = path.join(AQUI, '..', 'parede-salao', 'entrada');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const img = (arq) => ({ image: { type: 'base64', base64: fs.readFileSync(path.join(D, arq)).toString('base64'), format: 'png' }, size: { width: 72, height: 148 } });
let usado = 0;
const saidas = [];
for (let vez = 0; vez < Number(process.env.VEZES || 2); vez++) {
  const r = await fetch(API + '/inpaint-v3', { method: 'POST', headers: cab, body: JSON.stringify({
    description: 'the door is OPEN: an open doorway showing a bright warm sunny garden path with green bushes outside, the wooden door leaf swung outward and seen thin edge-on at the right side of the doorway, cozy isometric pixel art',
    inpainting_image: img('fechada-3.png'), mask_image: img('mascara-folha.png'), no_background: false, crop_to_mask: true,
  }) });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 400));
  const trabalho = JSON.parse(t).background_job_id;
  let j = {};
  for (let i = 0; !['completed', 'succeeded'].includes(j.status); i++) {
    if (i > 150) throw new Error('demorou demais');
    await new Promise((ok) => setTimeout(ok, 4000));
    j = await (await fetch(API + '/background-jobs/' + trabalho, { headers: cab })).json();
    if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 400));
  }
  usado += j.usage?.generations ?? 0;
  for (const q of j.last_response?.images ?? (j.last_response?.image ? [j.last_response.image] : [])) saidas.push(typeof q === 'string' ? q : q.base64);
}
saidas.forEach((b, i) => fs.writeFileSync(path.join(D, `aberta-${i + 1}.png`), Buffer.from(b, 'base64')));
fs.appendFileSync(path.join(AQUI, '..', '..', '..', '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: 'salao/porta-de-entrada/aberta (inpaint)', geracoes: usado, quando: new Date().toISOString() }) + '\n');
console.log(saidas.length, 'opções; custou', usado);
