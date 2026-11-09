// O SOFÁ NOVO DO SALÃO (09/11/2026, pedido dele: "crie um sofá novo, vamos testar; ele deve estar PERFEITO"). O de antes
// (moveis/sofa-giros) era um sofá de CANTO de frente e reto de costas, e pequeno para o coelho. Este é feito do zero: um sofá
// de DOIS LUGARES, cada um do tamanho do coelho sentado, gerado numa vista e girado (as 8 vistas do mesmo objeto), para ser
// o mesmo sofá dos quatro lados. O de antes fica guardado.
//   node e2e/pixel-art/salao/sofa-novo/sofa-novo.mjs opcoes            → opcao-<n>.png (várias opções numa chamada)
//   node e2e/pixel-art/salao/sofa-novo/sofa-novo.mjs girar <n>         → giros/<direção>.png (o objeto da opção n, girado; usa
//   opcao-<n>-recorte.png se houver: o girar aceita no máximo 168 px de lado, e a opção tem 176)
//   node e2e/pixel-art/salao/sofa-novo/sofa-novo.mjs girar-retomar <id>  (a espera caiu: busca o objeto já pago)
// Cada pedido vai para e2e/pixel-art/custos.jsonl, com o custo que o próprio PixelLab diz.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const custo = (peca, geracoes) => fs.appendFileSync(path.join(AQUI, '..', '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: 'salao/sofa-novo/' + peca, geracoes, quando: new Date().toISOString() }) + '\n');
const DESCRICAO = 'a cozy straight two-seater loveseat sofa with exactly two wide deep seat cushions side by side and two plump back cushions, low rounded armrests on both ends, soft dusty-mauve fabric, short wooden legs, no pillows, nothing on it';
const ANGULO = 'isometric pixel art seen from above at the same 2:1 isometric angle as the reference, clean dark outline, warm cozy palette like the reference, the whole piece visible';
const [cmd, arg] = process.argv.slice(2);

if (cmd === 'opcoes') {
  // a referência de estilo: o chão e o tijolo da base do salão (como moveis.mjs)
  const ref = execFileSync('py', ['-3', '-c', `
import base64, io
from PIL import Image
im = Image.open(r'${path.join(AQUI, '..', 'base.png')}').convert('RGBA')
c = Image.new('RGBA', (160, 160)); c.paste(im.crop((60, 200, 220, 360)), (0, 0))
b = io.BytesIO(); c.save(b, 'PNG'); print(base64.b64encode(b.getvalue()).decode())`]).toString().trim();
  const r = await fetch(API + '/generate-image-v2', { method: 'POST', headers: cab, body: JSON.stringify({
    description: 'ONLY ONE ' + DESCRICAO + ', ' + ANGULO, image_size: { width: 176, height: 136 }, no_background: true,
    reference_images: [{ image: { type: 'base64', base64: ref, format: 'png' }, size: { width: 160, height: 160 }, usage_description: 'Match this pixel art style, outline, palette, light and pixel scale exactly; draw only the requested piece of furniture' }],
  }) });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 400));
  const trabalho = JSON.parse(t).background_job_id;
  let j = {};
  for (let i = 0; !['completed', 'succeeded'].includes(j.status); i++) {
    if (i > 150) throw new Error('demorou demais');
    await esperar(4000);
    try { j = await (await fetch(API + '/background-jobs/' + trabalho, { headers: cab })).json(); } catch { continue; }
    if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 400));
  }
  const imgs = (j.last_response?.images ?? []).map((q) => (typeof q === 'string' ? q : q.base64));
  const ja = fs.readdirSync(AQUI).filter((f) => /^opcao-\d+\.png$/.test(f)).length;
  imgs.forEach((b, i) => fs.writeFileSync(path.join(AQUI, `opcao-${ja + i + 1}.png`), Buffer.from(b, 'base64')));
  custo('opcoes', j.usage?.generations ?? null);
  console.log(imgs.length, 'opções; custou', j.usage?.generations);
} else if (cmd === 'girar' || cmd === 'girar-retomar') {
  const pasta = path.join(AQUI, 'giros');
  fs.mkdirSync(pasta, { recursive: true });
  let oid = arg, usado = null;
  const antes = await saldo();
  if (cmd === 'girar') {
    const r = await fetch(API + '/create-8-direction-object', { method: 'POST', headers: cab, body: JSON.stringify({ description: DESCRICAO, view: 'low top-down', reference_image: { type: 'base64', base64: fs.readFileSync(path.join(AQUI, fs.existsSync(path.join(AQUI, `opcao-${arg}-recorte.png`)) ? `opcao-${arg}-recorte.png` : `opcao-${arg}.png`)).toString('base64'), format: 'png' } }) });
    const t = await r.text();
    if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
    const j = JSON.parse(t); oid = j.object_id; usado = j.usage?.generations ?? null;
    fs.writeFileSync(path.join(pasta, 'pedido.json'), t);
    console.log('objeto', oid);
  }
  let det;
  for (let i = 0; ; i++) {
    if (i > 480) throw new Error('demorou demais (objeto ' + oid + ')');
    await esperar(5000);
    try { det = await (await fetch(`${API}/objects/${oid}`, { headers: cab })).json(); } catch { continue; }
    if (['completed', 'review'].includes(det.status)) break;
    if (['failed', 'error'].includes(det.status)) throw new Error(JSON.stringify(det).slice(0, 600));
  }
  fs.writeFileSync(path.join(pasta, 'objeto.json'), JSON.stringify(det, null, 2));
  let k = 0;
  for (const [d, v] of Object.entries(det.rotation_urls ?? {})) {
    const url = typeof v === 'string' ? v : v?.url;
    for (let tentativa = 0; url && tentativa < 4; tentativa++) {
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      if (buf.slice(1, 4).toString() === 'PNG' && buf.length > 500) { fs.writeFileSync(path.join(pasta, d + '.png'), buf); k++; break; }
      await esperar(4000);
    }
  }
  if (cmd === 'girar') custo('giros', usado ?? +(antes - (await saldo())).toFixed(1));
  console.log(k, 'vistas; custou', usado);
} else throw new Error('uso: sofa-novo.mjs opcoes | girar <n> | girar-retomar <id>');
