// Gera as peças do quarto numa ferramenta, com o conceito como referência e a paleta imposta.
//   node e2e/pixel-art/quarto/gerar.mjs <pixellab|rd> <comparacao|todas|id[,id...]> [--preco]
// Saída crua em saida/<ferramenta>/<id>-<n>.png e, posta na paleta, em paleta/<ferramenta>/. Peça que já tem
// saída é pulada: cada chamada é paga e não se refaz igual.
import fs from 'node:fs';
import path from 'node:path';
import { ESCALA, PECAS, COMPARACAO } from './pecas.mjs';
import { CORES } from './paleta.mjs';
import { ler64, gravar64, recortar, naPaleta, fechar } from './imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const [ferramenta, qual = 'comparacao', ...resto] = process.argv.slice(2);
const soPreco = resto.includes('--preco');
if (!['pixellab', 'rd'].includes(ferramenta)) throw new Error('ferramenta: pixellab | rd');
const ids = qual === 'comparacao' ? COMPARACAO : qual === 'todas' ? PECAS.map((p) => p.id) : qual.split(',');
const CRU = path.join(AQUI, 'saida', ferramenta);
const PAL = path.join(AQUI, 'paleta', ferramenta);
fs.mkdirSync(CRU, { recursive: true });
fs.mkdirSync(PAL, { recursive: true });
const CONCEITO = ler64(path.join(AQUI, 'conceito.png'));
const LUZ = 'cozy, calm, soft even daylight, muted warm colors, no strong lamp glow, isometric pixel art, clean pixels';

const custo = (dados) => fs.appendFileSync(path.join(AQUI, 'custos.jsonl'), JSON.stringify({ ferramenta, quando: new Date().toISOString(), ...dados }) + '\n');
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** O recorte da peça no conceito, na densidade do quarto, numa tela de `lado` px. */
async function referencia(id, lado) {
  const p = PECAS.find((x) => x.id === id);
  if (!p?.recorte) return null;
  return recortar(CONCEITO, p.recorte, ESCALA, lado);
}

async function pixellab(peca) {
  // Estilo: o recorte da própria peça (quando o conceito a tem) e de mais duas, todas do mesmo tamanho,
  // porque a saída sai do tamanho da maior.
  const fontes = [peca.recorte ? peca.id : null, ...(peca.estilo ?? []), 'estante', 'cama'].filter(Boolean);
  const unicos = [...new Set(fontes)].slice(0, 3);
  const style_images = [];
  for (const id of unicos) style_images.push({ image: { type: 'base64', base64: await referencia(id, peca.lado), format: 'png' }, width: peca.lado, height: peca.lado });
  const r = await fetch('https://api.pixellab.ai/v2/generate-with-style-v2', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ description: `${peca.descricao}. ${LUZ}`, style_description: 'cozy isometric bedroom pixel art, warm muted palette, soft shading', style_images, no_background: peca.id !== 'casca' }),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`PixelLab ${r.status}: ${texto.slice(0, 500)}`);
  const j = JSON.parse(texto);
  let fim = j;
  if (j.background_job_id) {
    for (let i = 0; ; i++) {
      if (i > 120) throw new Error('trabalho demorou demais: ' + j.background_job_id);
      await espera(4000);
      fim = await (await fetch(`https://api.pixellab.ai/v2/background-jobs/${j.background_job_id}`, { headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}` } })).json();
      if (['completed', 'succeeded'].includes(fim.status)) break;
      if (['failed', 'error'].includes(fim.status)) throw new Error('falhou: ' + JSON.stringify(fim).slice(0, 500));
    }
  }
  const imagens = fim.last_response?.images ?? fim.images ?? fim.result?.images ?? [];
  if (!imagens.length) fs.writeFileSync(path.join(CRU, `${peca.id}-resposta.json`), JSON.stringify(fim, null, 2).slice(0, 20000));
  custo({ peca: peca.id, usage: fim.usage ?? j.usage ?? null, imagens: imagens.length });
  return imagens.map((im) => im.base64 ?? im.image?.base64 ?? im);
}

async function retro(peca) {
  const reference_images = [];
  const propria = await referencia(peca.id, peca.lado);
  if (propria) reference_images.push(propria);
  for (const id of peca.estilo ?? []) reference_images.push(await referencia(id, peca.lado));
  reference_images.push(await recortar(CONCEITO, [0, 0, 1254, 1254], ESCALA, 256));
  const corpo = {
    prompt: `${peca.descricao}. ${LUZ}`,
    prompt_style: ['coelho', 'gato'].includes(peca.id) ? 'rd_pro__default' : 'rd_pro__isometric',
    width: peca.lado, height: peca.lado, num_images: 1,
    remove_bg: peca.id !== 'casca',
    reference_images,
    input_palette: ler64(path.join(AQUI, 'paleta.png')),
    ...(soPreco ? { check_cost: true } : {}),
  };
  const r = await fetch('https://api.retrodiffusion.ai/v2/inferences', { method: 'POST', headers: { 'X-RD-Token': process.env.RETRO_DIFFUSION_KEY, 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Retro Diffusion ${r.status}: ${texto.slice(0, 500)}`);
  let j = JSON.parse(texto);
  if (soPreco) { console.log(peca.id, 'preço:', j.balance_cost); return []; }
  if (j.task_id) {
    fs.appendFileSync(path.join(AQUI, 'tarefas-rd.txt'), `${peca.id} ${j.task_id}\n`);
    for (let i = 0; ; i++) {
      if (i > 90) throw new Error('tarefa demorou demais: ' + j.task_id);
      await espera(4000);
      const t = await (await fetch(`https://api.retrodiffusion.ai/v2/inferences/tasks/${j.task_id}`, { headers: { 'X-RD-Token': process.env.RETRO_DIFFUSION_KEY } })).json();
      if (t.status === 'succeeded') { j = t.result; break; }
      if (['failed', 'error'].includes(t.status)) throw new Error('falhou: ' + JSON.stringify(t).slice(0, 500));
    }
  }
  custo({ peca: peca.id, usd: j.balance_cost, saldo: j.remaining_balance });
  return j.base64_images ?? [];
}

for (const id of ids) {
  const peca = PECAS.find((p) => p.id === id);
  if (!peca) throw new Error('peça desconhecida: ' + id);
  if (!soPreco && fs.readdirSync(CRU).some((f) => f.startsWith(id + '-') && f.endsWith('.png'))) { console.log('já existe:', id); continue; }
  try {
    const imagens = await (ferramenta === 'pixellab' ? pixellab(peca) : retro(peca));
    for (const [i, b64] of imagens.entries()) {
      gravar64(path.join(CRU, `${id}-${i + 1}.png`), b64);
      gravar64(path.join(PAL, `${id}-${i + 1}.png`), await naPaleta(b64, CORES));
    }
    console.log(id, '→', imagens.length, 'imagem(ns)');
  } catch (e) {
    console.log(id, 'ERRO:', e.message);
  }
}
await fechar();
