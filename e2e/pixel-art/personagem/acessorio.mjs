// O ACESSÓRIO POR REPINTURA (piloto, 09/11/2026: "concordo com um piloto para usar repintura, para validarmos o
// conceito"). O 2D do personagem é todo PixelLab (decisão dele), e o PixelLab não garante que um boné fique no mesmo lugar
// da cabeça se cada pose for desenhada de novo. Então o acessório é PINTADO EM CIMA de cada quadro já pronto do mascote
// (inpaint-v3, máscara só na cabeça), e a CAMADA dele é a diferença entre o quadro repintado e o original: nasce
// encaixada naquele quadro. No jogo, corpo + camadas + cores da pessoa.
//
//   node e2e/pixel-art/personagem/acessorio.mjs <acessório> <animação> <direção> [quadros, ex. 0,1]
//   node e2e/pixel-art/personagem/acessorio.mjs bone parado south-east 0,1
//   → mascote/acessorios/<acessório>/<animação>/<direção>-<n>.png      (a camada, fundo transparente)
//     mascote/acessorios/<acessório>/<animação>/com/<direção>-<n>.png  (o quadro repintado inteiro, para conferir)
//     mascote/acessorios/<acessório>/<animação>/mascara/<direção>-<n>.png
//
// A DESCRIÇÃO de cada acessório mora em ACESSORIOS, abaixo, e é a mesma em todos os quadros: o que muda é só o quadro.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };

const ACESSORIOS = {
  bone: {
    descricao: 'a small red baseball cap worn on top of the bunny head, between the two long upright ears, the ears passing through the cap and staying unchanged, short visor, same pixel art style and outline as the character',
    // a máscara: a parte de cima do crânio (abaixo de onde as orelhas saem), com folga para a aba
    regiao: 'cranio',
  },
};

const [nome, animacao, direcao, quadrosArg] = process.argv.slice(2);
const acessorio = ACESSORIOS[nome];
if (!acessorio || !animacao || !direcao) throw new Error('uso: acessorio.mjs <' + Object.keys(ACESSORIOS).join('|') + '> <animação> <direção> [quadros]');
const origem = path.join(AQUI, 'mascote', 'baixa-120', 'animacoes', animacao);
const todos = fs.readdirSync(origem).filter((f) => new RegExp(`^${direcao}-\\d+\\.png$`).test(f)).map((f) => +f.match(/-(\d+)\.png$/)[1]).sort((a, b) => a - b);
const quadros = quadrosArg ? quadrosArg.split(',').map(Number) : todos;
const destino = path.join(AQUI, 'mascote', 'acessorios', nome, animacao);
for (const p of ['', 'com', 'mascara']) fs.mkdirSync(path.join(destino, p), { recursive: true });

const pelo = (d, i) => d[i + 3] > 200 && d[i] > 200 && d[i + 1] > 190 && d[i + 2] > 200;

/** A máscara do crânio: as linhas em que o pelo já é largo (o crânio, não as orelhas), a metade de cima delas, com folga. */
function mascaraDoCranio(png) {
  const { width: w, height: h, data: d } = png;
  const largura = [];
  for (let y = 0; y < h; y++) {
    // n é QUANTOS pixels de pelo a linha tem, e não a distância de ponta a ponta: as duas orelhas juntas, com o vão
    // no meio, mediam de ponta a ponta tanto quanto o crânio, e a máscara caía nas orelhas (o primeiro teste).
    let l = w, r = -1, n = 0;
    for (let x = 0; x < w; x++) if (pelo(d, (y * w + x) * 4)) { l = Math.min(l, x); r = Math.max(r, x); n++; }
    largura.push(n ? { l, r, n } : null);
  }
  const maior = Math.max(...largura.map((c) => c?.n ?? 0));
  const topo = largura.findIndex((c) => c && c.n >= maior * 0.6);
  let fim = topo; while (largura[fim + 1] && largura[fim + 1].n >= maior * 0.6) fim++;
  const meio = Math.round(topo + (fim - topo) * 0.45);
  const { l, r } = largura[topo];
  const caixa = { x0: Math.max(0, Math.min(l, largura[meio].l) - 4), x1: Math.min(w - 1, Math.max(r, largura[meio].r) + 4), y0: Math.max(0, topo - 8), y1: Math.min(h - 1, meio) };
  const m = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dentro = x >= caixa.x0 && x <= caixa.x1 && y >= caixa.y0 && y <= caixa.y1;
    m.data.set(dentro ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * w + x) * 4);
  }
  return { mascara: m, caixa };
}

const b64 = (png) => PNG.sync.write(png).toString('base64');
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
let usado = 0;
for (const q of quadros) {
  const arquivo = `${direcao}-${q}.png`;
  const base = PNG.sync.read(fs.readFileSync(path.join(origem, arquivo)));
  const { mascara, caixa } = mascaraDoCranio(base);
  fs.writeFileSync(path.join(destino, 'mascara', arquivo), PNG.sync.write(mascara));
  const tamanho = { width: base.width, height: base.height };
  const r = await fetch(API + '/inpaint-v3', { method: 'POST', headers: cab, body: JSON.stringify({
    description: acessorio.descricao,
    inpainting_image: { image: { type: 'base64', base64: b64(base), format: 'png' }, size: tamanho },
    mask_image: { image: { type: 'base64', base64: b64(mascara), format: 'png' }, size: tamanho },
    no_background: true, crop_to_mask: false,
  }) });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 400));
  const trabalho = JSON.parse(t).background_job_id;
  let j = {};
  for (let i = 0; !['completed', 'succeeded'].includes(j.status); i++) {
    if (i > 150) throw new Error('demorou demais');
    await esperar(4000);
    j = await (await fetch(API + '/background-jobs/' + trabalho, { headers: cab })).json();
    if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 400));
  }
  usado += j.usage?.generations ?? 0;
  const imagens = j.last_response?.images ?? (j.last_response?.image ? [j.last_response.image] : []);
  if (!imagens.length) throw new Error('sem imagem: ' + JSON.stringify(j).slice(0, 300));
  const bruto = PNG.sync.read(Buffer.from(typeof imagens[0] === 'string' ? imagens[0] : imagens[0].base64, 'base64'));
  // A resposta pode vir num tamanho diferente do quadro: só serve se vier igual (senão a camada não encaixa).
  if (bruto.width !== base.width || bruto.height !== base.height) throw new Error(`a repintura voltou ${bruto.width}×${bruto.height}, o quadro é ${base.width}×${base.height}`);
  fs.writeFileSync(path.join(destino, 'com', arquivo), PNG.sync.write(bruto));
  // A CAMADA: o que mudou dentro da máscara (com 2 px de folga), com a cor e a opacidade do repintado.
  const camada = new PNG({ width: base.width, height: base.height });
  for (let y = Math.max(0, caixa.y0 - 2); y <= Math.min(base.height - 1, caixa.y1 + 2); y++) for (let x = Math.max(0, caixa.x0 - 2); x <= Math.min(base.width - 1, caixa.x1 + 2); x++) {
    const i = (y * base.width + x) * 4;
    const diferenca = Math.abs(bruto.data[i] - base.data[i]) + Math.abs(bruto.data[i + 1] - base.data[i + 1]) + Math.abs(bruto.data[i + 2] - base.data[i + 2]) + Math.abs(bruto.data[i + 3] - base.data[i + 3]);
    if (diferenca > 24 && bruto.data[i + 3] > 20) camada.data.set(bruto.data.subarray(i, i + 4), i);
  }
  // Os pontinhos soltos (a repintura mexe de leve em pixels em volta) saem: fica o pixel com 2 ou mais vizinhos na camada.
  const tem = (x, y) => x >= 0 && y >= 0 && x < base.width && y < base.height && camada.data[(y * base.width + x) * 4 + 3] > 0;
  const soltos = [];
  for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) {
    if (!tem(x, y)) continue;
    let vizinhos = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && tem(x + dx, y + dy)) vizinhos++;
    if (vizinhos < 2) soltos.push((y * base.width + x) * 4);
  }
  for (const i of soltos) camada.data.fill(0, i, i + 4);
  fs.writeFileSync(path.join(destino, arquivo), PNG.sync.write(camada));
  console.log(`${animacao}/${arquivo}: camada pronta`);
}
fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `personagem/acessorio/${nome}/${animacao}/${direcao}/${quadros.join(',')}`, geracoes: usado, quando: new Date().toISOString() }) + '\n');
console.log(`${quadros.length} quadro(s); custou ${usado} gerações`);
