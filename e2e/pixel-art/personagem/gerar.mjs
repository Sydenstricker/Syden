// O MASCOTE ISOMÉTRICO (14/10/2026, ver README.md): o personagem nasce no PixelLab com as 8 direções, já no tamanho do
// quarto modular (quadro de 96, ~80 px de pé). O CONCEITO é o coelho do recado do salão (quem ele é); o ESTILO é um
// recorte do quarto modular (o contorno, a paleta e a luz de lá).
//
//   node e2e/pixel-art/personagem/gerar.mjs <nome> <vista> <quadro> [estilo]   → mascote/<nome>/<direção>.png
//   vista: "low top-down" (o padrão) ou "high top-down"; quadro: o lado em px (o coelho ocupa ~2/3 dele)
//
// SEM IMAGEM DE ESTILO por padrão: com o recorte do quarto como referência, a ferramenta COPIOU a cama para dentro
// de cada direção (mascote/baixa e mascote/alta, 14/10/2026). O estilo vai por texto; "estilo" no fim liga a imagem.
//
// O gasto vai para ../custos.jsonl, com o saldo antes e depois (o custo desta ferramenta é dinâmico).
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const b64 = (arquivo) => ({ type: 'base64', base64: fs.readFileSync(path.join(AQUI, arquivo)).toString('base64'), format: 'png' });
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

const [nome = 'a', vista = 'low top-down', quadro = '96', comEstilo] = process.argv.slice(2);
const pasta = path.join(AQUI, 'mascote', nome);
fs.mkdirSync(pasta, { recursive: true });

const antes = await saldo();
const r = await fetch(API + '/create-character-pro', {
  method: 'POST',
  headers: cab,
  body: JSON.stringify({
    method: 'create_from_concept',
    description:
      'a cute small bunny character: white fur, long upright ears with pink inside, closed happy eyes, a small smile, wearing a dark charcoal hoodie and dark pants, small feet, chibi proportions, standing relaxed, arms down',
    style_description: 'cozy warm isometric pixel art matching the reference room: same dark brown outline, same warm palette, soft afternoon light',
    view: vista,
    image_size: { width: Number(quadro), height: Number(quadro) },
    concept_image: b64('mascote/conceito.png'),
    ...(comEstilo === 'estilo' && { reference_image: b64('mascote/estilo.png') }),
    no_background: true,
    template_id: 'mannequin',
  }),
});
const t = await r.text();
if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 500));
const { character_id: id, background_job_id: trabalho } = JSON.parse(t);
console.log('personagem', id, 'trabalho', trabalho);

// As direções chegam depois: espera o personagem ficar pronto.
let detalhe;
for (let i = 0; ; i++) {
  if (i > 120) throw new Error('demorou demais');
  await esperar(5000);
  detalhe = await (await fetch(`${API}/characters/${id}`, { headers: cab })).json();
  if (detalhe.status === 'completed') break;
  if (['failed', 'error'].includes(detalhe.status)) throw new Error(JSON.stringify(detalhe).slice(0, 600));
}
fs.writeFileSync(path.join(pasta, 'personagem.json'), JSON.stringify({ id, vista, ...detalhe }, null, 2));

// As imagens de cada direção: o detalhe traz os endereços (o formato exato fica gravado no json, para conferir).
const rot = detalhe.rotation_urls ?? detalhe.rotations ?? {};
let n = 0;
for (const [direcao, valor] of Object.entries(rot)) {
  const url = typeof valor === 'string' ? valor : valor?.url;
  if (!url) continue;
  fs.writeFileSync(path.join(pasta, `${direcao}.png`), Buffer.from(await (await fetch(url)).arrayBuffer()));
  n++;
}
const depois = await saldo();
fs.appendFileSync(
  path.join(AQUI, '..', 'custos.jsonl'),
  JSON.stringify({ ferramenta: 'pixellab', peca: `personagem/mascote/${nome}`, geracoes: +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n',
);
console.log(`${n} direções em mascote/${nome}/; custou ${(antes - depois).toFixed(1)} gerações (restam ${depois})`);
