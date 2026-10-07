// O quarto híbrido: o conceito convertido (conceito-unzoom.png, 313 px) é o cenário, e o PixelLab repinta
// só o que precisa mudar, no estilo do próprio quadro:
//   1. tira o coelho e o gato da cama (eles viram peças à parte, para poderem se mexer);
//   2. troca o quadro da parede direita por um quadro de cortiça (Caixa de ideias);
//   3. troca a planta da mesinha da frente por um vaso de cenouras (Plantar cenoura);
//   4. faz a versão de DIA do quarto inteiro.
// Cada passo grava a sua imagem e é pulado se ela já existe (é pago).
//   node e2e/pixel-art/quarto/hibrido/pintar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../imagem.mjs';
import { nativo } from './pintar-caixas.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const W = 313, H = 314;
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
// As caixas foram marcadas olhando ver-unzoom.png (900 px de largura, 10 px de margem): convertidas aqui.

async function chamar(rota, corpo) {
  const r = await fetch('https://api.pixellab.ai/v2' + rota, { method: 'POST', headers: cab, body: JSON.stringify(corpo) });
  const t = await r.text();
  if (!r.ok) throw new Error(rota + ' ' + r.status + ': ' + t.slice(0, 400));
  let j = JSON.parse(t);
  const trabalho = j.background_job_id;
  if (trabalho) for (let i = 0; ; i++) {
    if (i > 150) throw new Error('demorou demais: ' + trabalho);
    await new Promise((ok) => setTimeout(ok, 4000));
    j = await (await fetch('https://api.pixellab.ai/v2/background-jobs/' + trabalho, { headers: cab })).json();
    if (['completed', 'succeeded'].includes(j.status)) break;
    if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 400));
  }
  fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: 'hibrido' + rota, usage: j.usage ?? null, quando: new Date().toISOString() }) + '\n');
  const lista = j.last_response?.images ?? j.images ?? (j.last_response?.image ? [j.last_response.image] : j.image ? [j.image] : []);
  if (!lista.length) { fs.writeFileSync(path.join(AQUI, 'resposta-sem-imagem.json'), JSON.stringify(j, null, 2).slice(0, 8000)); throw new Error('sem imagem; ver resposta-sem-imagem.json'); }
  return lista.map((im) => (typeof im === 'string' ? im : im.base64));
}


// O preenchimento novo (inpaint-v3) exige o plano Tier 2. O Pro Flash, que o Tier 1 cobre, trabalha numa
// janela de até 256 px: recorta-se a janela em volta do que muda, repinta-se com o quarto inteiro como
// contexto, e cola-se de volta.
async function janela(b64, [x, y, w, h], colar) {
  const p = await abrir();
  return p.evaluate(async ({ b64, x, y, w, h, colar }) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas');
    if (!colar) { c.width = w; c.height = h; c.getContext('2d').drawImage(im, x, y, w, h, 0, 0, w, h); }
    else {
      c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const pedaco = new Image(); pedaco.src = 'data:image/png;base64,' + colar; await pedaco.decode();
      g.clearRect(x, y, w, h); g.drawImage(pedaco, x, y);
    }
    return c.toDataURL('image/png').split(',')[1];
  }, { b64, x, y, w, h, colar });
}
const b64img = (b64) => ({ type: 'base64', base64: b64, format: 'png' });
async function repintar(de, para, caixas, descricao) {
  const destino = path.join(AQUI, para + '.png');
  if (fs.existsSync(destino)) return console.log('já existe:', para);
  const nat = caixas.map(nativo);
  // A janela: a menor de lado múltiplo de 4 que cobre as caixas com folga de 8 px, dentro do quadro.
  const x0 = Math.min(...nat.map((c) => c[0])) - 8, y0 = Math.min(...nat.map((c) => c[1])) - 8;
  const x1 = Math.max(...nat.map((c) => c[2])) + 8, y1 = Math.max(...nat.map((c) => c[3])) + 8;
  // Pelo menos 128 px: o contexto (o quarto inteiro, 313 px) pode ter no máximo 3× a janela.
  const w = Math.min(256, Math.max(128, Math.ceil((x1 - x0) / 4) * 4)), h = Math.min(256, Math.max(128, Math.ceil((y1 - y0) / 4) * 4));
  const x = Math.max(0, Math.min(W - w, x0)), y = Math.max(0, Math.min(H - h, y0));
  const todo = ler64(path.join(AQUI, de + '.png'));
  const recorte = await janela(todo, [x, y, w, h]);
  const masc = await (await abrir()).evaluate(({ w, h, caixas }) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff';
    for (const [a, b, cc, d] of caixas) g.fillRect(a, b, cc - a, d - b);
    return c.toDataURL('image/png').split(',')[1];
  }, { w, h, caixas: nat.map(([a, b, cc, d]) => [a - x, b - y, cc - x, d - y]) });
  const [novo] = await chamar('/inpaint-image-pro-flash', {
    image: b64img(recorte), mask_image: b64img(masc), description: descricao,
    context_image: b64img(todo), bounding_box: { x, y, width: w, height: h }, output_method: 'Modify current layer',
  });
  gravar64(destino, await janela(todo, [x, y, w, h], novo));
  console.log(para, '← janela', w + 'x' + h, 'em', x + ',' + y);
}

await repintar('conceito-unzoom', 'passo1-sem-coelho', [[262, 288, 398, 474], [392, 370, 480, 420]],
  'empty single bed with two cream pillows and a blue-grey plaid blanket, nobody on the bed, cozy pixel art');
await repintar('passo1-sem-coelho', 'passo2-cortica', [[695, 220, 768, 338]],
  'small cork board with a few colorful paper notes pinned on it, hanging on the wall, cozy pixel art');
await repintar('passo2-cortica', 'noite', [[88, 532, 168, 615]],
  'small terracotta flower pot with young carrot plants, green leafy tops and a bit of orange carrot showing, cozy pixel art');

const dia = path.join(AQUI, 'dia.png');
if (!fs.existsSync(dia)) {
  const imagens = await chamar('/edit-images-v2', {
    method: 'edit_with_text',
    edit_images: [{ image: { type: 'base64', base64: ler64(path.join(AQUI, 'noite.png')), format: 'png' }, width: W, height: H }],
    image_size: { width: W, height: H },
    description: 'the same bedroom during a calm sunny afternoon: soft natural daylight from the window, bright blue sky with trees outside, lamps turned off, warm muted colors, keep every object and its position exactly the same',
  });
  imagens.forEach((b, i) => gravar64(path.join(AQUI, i === 0 ? 'dia.png' : `dia-alt${i}.png`), b));
  console.log('dia ←', imagens.length, 'imagem(ns)');
} else console.log('já existe: dia');
await fechar();
