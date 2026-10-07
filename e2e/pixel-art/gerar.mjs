// O teste de pixel art: o coelho do Syden em três poses, em duas ferramentas, para comparar lado a lado.
//   node gerar.mjs <ferramenta> <pose> [modo]
//   ferramenta: pixellab-bitforge | pixellab-pro | rd-plus | rd-pro
//   pose: parado | cenoura | pipoca
// Cada imagem sai em saida/<ferramenta>-<pose>-<n>.png, e o custo vai para custos.jsonl.
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SAIDA = path.join(AQUI, 'saida');
fs.mkdirSync(SAIDA, { recursive: true });
const REF = fs.readFileSync(path.join(AQUI, 'ref-coelho.png')).toString('base64');
// O bitforge exige a referência de estilo no MESMO tamanho da saída.
const REF64 = fs.readFileSync(path.join(AQUI, 'ref-coelho-64.png')).toString('base64');

const BASE = 'cute round cream-colored bunny head with long ears (pink inside), small dark eyes, tiny pink nose, flat minimal mascot, no body';
const POSES = {
  parado: `${BASE}, gentle smile, front view`,
  cenoura: `${BASE}, happily munching an orange carrot held at its mouth`,
  pipoca: `${BASE}, eating from a red and white striped popcorn bucket`,
};

const [ferramenta, pose, ...resto] = process.argv.slice(2);
const soPreco = resto.includes('--preco');
if (!POSES[pose]) throw new Error('pose: ' + Object.keys(POSES).join(' | '));
const descricao = POSES[pose];

function salvar(base64, n) {
  const arquivo = path.join(SAIDA, `${ferramenta}-${pose}-${n}.png`);
  fs.writeFileSync(arquivo, Buffer.from(base64, 'base64'));
  return arquivo;
}
function anotarCusto(usd, extra = {}) {
  fs.appendFileSync(path.join(AQUI, 'custos.jsonl'), JSON.stringify({ ferramenta, pose, usd, ...extra, quando: new Date().toISOString() }) + '\n');
}

async function pixellab(rota, corpo) {
  const r = await fetch(`https://api.pixellab.ai/v2${rota}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`PixelLab ${r.status}: ${texto.slice(0, 400)}`);
  return JSON.parse(texto);
}

async function esperarTrabalho(id) {
  for (let i = 0; i < 90; i++) {
    await new Promise((ok) => setTimeout(ok, 4000));
    const r = await fetch(`https://api.pixellab.ai/v2/background-jobs/${id}`, { headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}` } });
    const j = await r.json();
    if (j.status === 'completed' || j.status === 'succeeded') return j;
    if (j.status === 'failed' || j.status === 'error') throw new Error('trabalho falhou: ' + JSON.stringify(j).slice(0, 400));
  }
  throw new Error('trabalho demorou demais');
}

async function retro(estilo, extra) {
  const corpo = { prompt: descricao, prompt_style: estilo, width: 64, height: 64, num_images: 1, remove_bg: true, ...extra, ...(soPreco ? { check_cost: true } : {}) };
  const r = await fetch('https://api.retrodiffusion.ai/v2/inferences', {
    method: 'POST',
    headers: { 'X-RD-Token': process.env.RETRO_DIFFUSION_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Retro Diffusion ${r.status}: ${texto.slice(0, 400)}`);
  const aceito = JSON.parse(texto);
  // A geração é ASSÍNCRONA: a resposta só diz "aceito" e o número da tarefa. Sem esperar, a imagem é
  // cobrada e se perde (aconteceu na primeira tentativa).
  if (!aceito.task_id) return aceito;
  fs.appendFileSync(path.join(AQUI, 'tarefas-rd.txt'), aceito.task_id + '\n');
  for (let i = 0; i < 60; i++) {
    await new Promise((ok) => setTimeout(ok, 4000));
    const t = await (await fetch(`https://api.retrodiffusion.ai/v2/inferences/tasks/${aceito.task_id}`, { headers: { 'X-RD-Token': process.env.RETRO_DIFFUSION_KEY } })).json();
    if (t.status === 'succeeded') return t.result;
    if (t.status === 'failed' || t.status === 'error') throw new Error('tarefa falhou: ' + JSON.stringify(t).slice(0, 400));
  }
  throw new Error('tarefa demorou demais: ' + aceito.task_id);
}

if (ferramenta === 'pixellab-bitforge') {
  // O estilo vem da imagem do coelho; a pose, do texto.
  const j = await pixellab('/create-image-bitforge', {
    description: descricao,
    image_size: { width: 64, height: 64 },
    style_image: { type: 'base64', base64: REF64, format: 'png' },
    style_strength: 60,
    no_background: true,
  });
  console.log('salvo:', salvar(j.image.base64, 1), '| custo:', JSON.stringify(j.usage));
  anotarCusto(j.usage?.usd ?? null, { usage: j.usage });
} else if (ferramenta === 'pixellab-pro') {
  // Modo Pro: o coelho como REFERÊNCIA DE PERSONAGEM (é o que mede consistência entre as poses).
  const j = await pixellab('/generate-image-v2', {
    description: descricao,
    image_size: { width: 64, height: 64 },
    no_background: true,
    reference_images: [{ image: { type: 'base64', base64: REF, format: 'png' }, size: { width: 300, height: 320 }, usage_description: 'This is the character. Keep the same face, colors and ear shape.' }],
  });
  const fim = j.background_job_id ? await esperarTrabalho(j.background_job_id) : j;
  const imagens = fim.last_response?.images ?? fim.images ?? fim.result?.images ?? [];
  if (imagens.length === 0) console.log('resposta sem imagem:', JSON.stringify(fim).slice(0, 800));
  imagens.forEach((im, i) => console.log('salvo:', salvar(im.base64 ?? im, i + 1)));
  anotarCusto(fim.usage?.usd ?? j.usage?.usd ?? null, { usage: fim.usage ?? j.usage });
} else if (ferramenta === 'rd-plus' || ferramenta === 'rd-pro') {
  // Plus: parte do desenho do coelho (img2img). Pro: o coelho como referência (só o Pro aceita).
  const extra = ferramenta === 'rd-plus' ? { input_image: REF, strength: 0.75 } : { reference_images: [REF] };
  const j = await retro(ferramenta === 'rd-plus' ? 'rd_plus__default' : 'rd_pro__default', extra);
  if (soPreco) {
    console.log('preço:', JSON.stringify(j));
  } else {
    // A resposta é guardada inteira (menos as imagens) para não perder imagem paga por campo com outro nome.
    fs.writeFileSync(path.join(AQUI, 'ultima-resposta-rd.json'), JSON.stringify(j, (k, v) => (typeof v === 'string' && v.length > 300 ? v.slice(0, 40) + '…(' + v.length + ')' : v), 2));
    const imagens = [...(j.base64_images ?? []), ...(j.output_images ?? [])].filter(Boolean);
    imagens.forEach((b, i) => console.log('salvo:', salvar(typeof b === 'string' ? b : b.base64 ?? b.image, i + 1)));
    for (const u of j.output_urls ?? []) console.log('url:', u);
    console.log('custo:', j.balance_cost, '| saldo:', j.remaining_balance);
    anotarCusto(j.balance_cost, { saldo: j.remaining_balance });
  }
} else {
  throw new Error('ferramenta desconhecida');
}
