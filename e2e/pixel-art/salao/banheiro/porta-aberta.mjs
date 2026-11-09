// A PORTA DO BANHEIRO ABERTA (09/11/2026): ao clicar na porta do salão, a folha abre por um instante e a vista passa para o
// banheiro (como no salão 3D). A receita da porta de entrada (quarto/novo/quarto/parede/entrada-aberta.mjs): a peça do salão
// (parede-salao/porta/peca-dia.png) com SÓ A FOLHA repintada (inpaint-v3, a máscara é a folha dentro do batente), para o batente
// e o tamanho ficarem idênticos; pelo vão aparece o banheiro (o piso verde-água e os azulejos brancos). As opções vão para
// aberta/aberta-<n>.png; porta-aberta.py põe a escolhida na parede.
//   node e2e/pixel-art/salao/banheiro/porta-aberta.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar } from '../../quarto/imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const PORTA = path.join(AQUI, '..', '..', 'quarto', 'novo', 'quarto', 'parede-salao', 'porta');
const SAIDA = path.join(AQUI, 'aberta');
fs.mkdirSync(SAIDA, { recursive: true });
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
// A porta na peça (512 × 512): a caixa dela, posta com folga num quadro de 64 × 128; a folha é o quadrilátero dentro do batente.
export const CAIXA = [352, 163, 396, 272], FOLGA = [10, 10], QUADRO = [64, 128];
export const FOLHA = [[10, 12], [33, 24], [33, 100], [10, 92]]; // na caixa
const p = await abrir();
const [imagem, mascara] = await p.evaluate(async ({ b64, CAIXA, FOLGA, QUADRO, FOLHA }) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
  const c = document.createElement('canvas'); c.width = QUADRO[0]; c.height = QUADRO[1];
  const g = c.getContext('2d'); g.drawImage(im, CAIXA[0], CAIXA[1], CAIXA[2] - CAIXA[0], CAIXA[3] - CAIXA[1], FOLGA[0], FOLGA[1], CAIXA[2] - CAIXA[0], CAIXA[3] - CAIXA[1]);
  const m = document.createElement('canvas'); m.width = QUADRO[0]; m.height = QUADRO[1];
  const gm = m.getContext('2d'); gm.fillStyle = '#000'; gm.fillRect(0, 0, QUADRO[0], QUADRO[1]); gm.fillStyle = '#fff';
  gm.beginPath(); FOLHA.forEach(([x, y], i) => gm[i ? 'lineTo' : 'moveTo'](x + FOLGA[0], y + FOLGA[1])); gm.closePath(); gm.fill();
  return [c.toDataURL('image/png').split(',')[1], m.toDataURL('image/png').split(',')[1]];
}, { b64: fs.readFileSync(path.join(PORTA, 'peca-dia.png')).toString('base64'), CAIXA, FOLGA, QUADRO, FOLHA });
await fechar();
fs.writeFileSync(path.join(SAIDA, 'fechada.png'), Buffer.from(imagem, 'base64'));
fs.writeFileSync(path.join(SAIDA, 'mascara.png'), Buffer.from(mascara, 'base64'));
const img = (b) => ({ image: { type: 'base64', base64: b, format: 'png' }, size: { width: QUADRO[0], height: QUADRO[1] } });
const r = await fetch(API + '/inpaint-v3', { method: 'POST', headers: cab, body: JSON.stringify({
  description: 'the door is OPEN: through the open doorway a small bright bathroom inside, a mint green tiled floor and white square tiles on the wall with warm yellow paint above, the dark wooden door leaf swung inward and seen thin edge-on at the right side of the doorway, cozy isometric pixel art',
  inpainting_image: img(imagem), mask_image: img(mascara), no_background: false, crop_to_mask: true,
}) });
const t = await r.text();
if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 400));
const trabalho = JSON.parse(t).background_job_id;
fs.appendFileSync(path.join(AQUI, 'trabalhos.log'), 'porta-aberta ' + trabalho + '\n');
let j = {};
for (let i = 0; !['completed', 'succeeded'].includes(j.status); i++) {
  if (i > 450) throw new Error('demorou demais: ' + trabalho);
  await new Promise((ok) => setTimeout(ok, 4000));
  j = await (await fetch(API + '/background-jobs/' + trabalho, { headers: cab })).json();
  if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 400));
}
const saidas = (j.last_response?.images ?? (j.last_response?.image ? [j.last_response.image] : [])).map((q) => (typeof q === 'string' ? q : q.base64));
let n = 1; while (fs.existsSync(path.join(SAIDA, `aberta-${n}.png`))) n++;
for (const b of saidas) fs.writeFileSync(path.join(SAIDA, `aberta-${n++}.png`), Buffer.from(b, 'base64'));
fs.appendFileSync(path.join(AQUI, '..', '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: 'salao/banheiro/porta-aberta (inpaint)', geracoes: j.usage?.generations ?? null, quando: new Date().toISOString() }) + '\n');
console.log(saidas.length, 'opções; custou', j.usage?.generations);
