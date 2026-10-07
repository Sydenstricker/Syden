// Experimento: o PRÓPRIO conceito vira pixel art de verdade (grade e paleta limpas), em vez de redesenhar
// peça por peça. Duas rotas do PixelLab: unzoom (acha a grade do desenho e reduz para ela) e
// image-to-pixelart-pro (converte e limpa; ficou mais de 20 minutos sem responder em 07/10/2026 e saiu).
//   node e2e/pixel-art/quarto/hibrido/converter.mjs
import fs from 'node:fs';
import path from 'node:path';
const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const b64 = fs.readFileSync(path.join(AQUI, '..', 'conceito.png')).toString('base64');
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch('https://api.pixellab.ai/v2/balance', { headers: cab })).json()).subscription.generations;
async function chamar(rota, corpo) {
  const r = await fetch('https://api.pixellab.ai/v2' + rota, { method: 'POST', headers: cab, body: JSON.stringify(corpo) });
  const t = await r.text(); if (!r.ok) throw new Error(rota + ' ' + r.status + ': ' + t.slice(0, 400));
  let j = JSON.parse(t);
  const trabalho = j.background_job_id;
  if (trabalho) for (;;) {
    await new Promise((ok) => setTimeout(ok, 4000));
    j = await (await fetch('https://api.pixellab.ai/v2/background-jobs/' + trabalho, { headers: cab })).json();
    if (['completed', 'succeeded'].includes(j.status)) break;
    if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 400));
  }
  return j;
}
const achar = (j) => j.image?.base64 ?? j.last_response?.image?.base64 ?? j.last_response?.images?.[0]?.base64 ?? j.images?.[0]?.base64 ?? j.last_response?.image;
for (const [nome, rota, corpo] of [
  ['unzoom', '/unzoom', { image: { type: 'base64', base64: b64, format: 'png' }, quantize: 0 }],
]) {
  const antes = await saldo();
  try {
    const j = await chamar(rota, corpo);
    const img = achar(j);
    if (!img) { fs.writeFileSync(path.join(AQUI, nome + '-resposta.json'), JSON.stringify(j, null, 2).slice(0, 5000)); console.log(nome, 'sem imagem'); continue; }
    fs.writeFileSync(path.join(AQUI, 'conceito-' + nome + '.png'), Buffer.from(typeof img === 'string' ? img : img.base64, 'base64'));
    console.log(nome, 'ok, gastou', antes - (await saldo()), 'gerações');
  } catch (e) { console.log(nome, 'ERRO', e.message); }
}
