// O ACESSÓRIO POR REPINTURA (piloto do boné em 09/11/2026; virou o método das camadas no mesmo dia: "quero que nosso
// método seja escalável e com qualidade"). O acessório é PINTADO UMA VEZ por corpo e por direção, em cima de um quadro de
// referência (inpaint-v3, máscara só na região dele), e a CAMADA é a diferença entre o repintado e o original. Os outros
// quadros de todas as animações recebem essa mesma camada pelo código, acompanhando a cabeça (acessorio-camadas.py):
// repintar quadro a quadro dava um boné diferente em cada quadro, e tremia.
//
//   COELHO=<corpo> node e2e/pixel-art/personagem/acessorio.mjs <acessório> <origem> <direção> [quadro]
//   node e2e/pixel-art/personagem/acessorio.mjs bone parado south-east 0             (o mascote, a animação "parado")
//   COELHO=orelha-caida node .../acessorio.mjs bandana estado:dormindo south-west    (uma pose parada, estados/)
//   → <corpo>/acessorios/<acessório>/<origem>/<direção>-<n>.png         (a camada, fundo transparente)
//     <corpo>/acessorios/<acessório>/<origem>/com/<direção>-<n>.png     (o quadro repintado inteiro, para conferir)
//     <corpo>/acessorios/<acessório>/<origem>/mascara/<direção>-<n>.png
//
// A DESCRIÇÃO e a REGIÃO de cada acessório moram em ACESSORIOS. Acessório novo é uma entrada aqui.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const COELHO = process.env.COELHO || 'mascote';

const ACESSORIOS = {
  bone: {
    // O BONÉ FICA ENTRE AS DUAS ORELHAS (decisão dele, 09/11/2026, vendo a folha: num quadro as orelhas atravessavam o
    // boné). Acessório de cabeça só é atravessado pelas orelhas quando o desenho dele é para isso (um gorro com furos).
    // Na orelha caída, as orelhas saem de baixo dele, dos lados.
    descricao: 'a small red baseball cap worn on top of the bunny head, sitting BETWEEN the two long ears: the whole cap is in the gap between the ears, both ears stay fully outside the cap on its left and right sides, nothing passes through the cap, short visor, same pixel art style and outline as the character',
    regiao: 'cranio',
  },
  bandana: {
    // A bandana do coelho 16 (a escolhida das fotos de frente): no pescoço, por cima da gola do moletom.
    descricao: 'a small rust red bandana scarf tied around the bunny neck, a triangle of cloth hanging over the top of the hoodie collar with a small knot, same pixel art style and outline as the character',
    regiao: 'pescoco',
  },
};

const [nome, origemArg, direcao, quadroArg] = process.argv.slice(2);
const acessorio = ACESSORIOS[nome];
if (!acessorio || !origemArg || !direcao) throw new Error('uso: [COELHO=<corpo>] acessorio.mjs <' + Object.keys(ACESSORIOS).join('|') + '> <animação|estado:<nome>> <direção> [quadro]');
const ehEstado = origemArg.startsWith('estado:');
const origem = ehEstado ? origemArg.slice(7) : origemArg;
const arquivoBase = ehEstado
  ? path.join(AQUI, COELHO, 'estados', origem, `${direcao}.png`)
  : path.join(AQUI, COELHO, 'baixa-120', 'animacoes', origem, `${direcao}-${quadroArg ?? 0}.png`);
const arquivo = `${direcao}-${ehEstado ? 0 : quadroArg ?? 0}.png`;
const destino = path.join(AQUI, COELHO, 'acessorios', nome, ehEstado ? 'estado-' + origem : origem);
for (const p of ['', 'com', 'mascara']) fs.mkdirSync(path.join(destino, p), { recursive: true });

const pelo = (d, i) => d[i + 3] > 200 && d[i] > 200 && d[i + 1] > 190 && d[i + 2] > 200;

/**
 * As medidas da cabeça no quadro de referência, pelas contas de pixels (o pelo é claro, o moletom escuro):
 * o alto do crânio (a primeira linha em que o pelo já é largo; n é QUANTOS pixels de pelo a linha tem, e não a distância
 * de ponta a ponta: as duas orelhas em pé, com o vão no meio, mediam tanto quanto o crânio) e a gola (a primeira linha,
 * abaixo do crânio, em que o pelo quase acaba).
 */
function medir(png) {
  const { width: w, height: h, data: d } = png;
  const linhas = [];
  for (let y = 0; y < h; y++) {
    let l = w, r = -1, n = 0, ol = w, or = -1;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (pelo(d, i)) { l = Math.min(l, x); r = Math.max(r, x); n++; }
      if (d[i + 3] > 20) { ol = Math.min(ol, x); or = Math.max(or, x); }
    }
    linhas.push({ l, r, n, ol, or });
  }
  const maior = Math.max(...linhas.map((c) => c.n));
  const topo = linhas.findIndex((c) => c.n >= maior * 0.6);
  // A gola: descendo pelo MEIO da cabeça, a primeira linha em que o PELO acaba (três seguidas: a boca é uma linha que não é
  // pelo). Medir pela largura do pelo errava na orelha caída (a orelha continua abaixo da cabeça), e "o primeiro escuro"
  // errava na regata cinza do musculoso (achava o short preto, e a bandana ia para a cintura).
  const cx = Math.round((linhas[topo].l + linhas[topo].r) / 2);
  let gola = topo + 1;
  const semPelo = (y) => !pelo(d, (y * w + cx) * 4);
  while (gola < h - 3 && !(semPelo(gola) && semPelo(gola + 1) && semPelo(gola + 2))) gola++;
  return { w, h, linhas, topo, gola };
}

function mascara(png) {
  const { w, h, linhas, topo, gola } = medir(png);
  let caixa;
  if (acessorio.regiao === 'cranio') {
    const meio = Math.round(topo + (gola - topo) * 0.45);
    let l = w, r = -1;
    for (let y = topo; y <= meio; y++) if (linhas[y].n) { l = Math.min(l, linhas[y].l); r = Math.max(r, linhas[y].r); }
    // A caixa sobe 16 px acima do crânio medido, para a copa do boné caber: com 8, a cabeça redonda da orelha caída (que
    // começa acima do "crânio" medido pela largura) cortou o boné reto em cima (relato dele, 09/11/2026).
    caixa = { x0: l - 4, x1: r + 4, y0: topo - 16, y1: meio };
  } else {
    // o pescoço: a faixa da gola, no meio do que é desenho naquela linha
    const { ol, or } = linhas[gola];
    const cx = Math.round((ol + or) / 2);
    caixa = { x0: cx - 13, x1: cx + 13, y0: gola - 1, y1: gola + 10 };
  }
  caixa = { x0: Math.max(0, caixa.x0), x1: Math.min(w - 1, caixa.x1), y0: Math.max(0, caixa.y0), y1: Math.min(h - 1, caixa.y1) };
  // Acima do crânio, o que é desenho FORA do meio da cabeça fica protegido: são as orelhas em pé, que o boné não cobre (ele
  // fica entre elas). O pedaço de desenho que passa pelo meio é a copa da cabeça (a orelha caída), e pode ser coberto.
  const { d } = { d: png.data };
  const cx = Math.round((linhas[topo].l + linhas[topo].r) / 2);
  const protegido = (x, y) => {
    if (acessorio.regiao !== 'cranio' || y >= topo) return false;
    const op = (xx) => d[(y * w + xx) * 4 + 3] > 20;
    if (!op(x)) return false;
    let a = x, b = x;
    while (a > 0 && op(a - 1)) a--;
    while (b < w - 1 && op(b + 1)) b++;
    return !(a <= cx && cx <= b);
  };
  const m = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dentro = x >= caixa.x0 && x <= caixa.x1 && y >= caixa.y0 && y <= caixa.y1 && !protegido(x, y);
    m.data.set(dentro ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * w + x) * 4);
  }
  return { mascara: m, caixa };
}

const b64 = (png) => PNG.sync.write(png).toString('base64');
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;

const antes = await saldo();
const base = PNG.sync.read(fs.readFileSync(arquivoBase));
const { mascara: m, caixa } = mascara(base);
fs.writeFileSync(path.join(destino, 'mascara', arquivo), PNG.sync.write(m));
// SO_MASCARA=1: só a máscara, sem gastar (para conferir a região antes)
if (process.env.SO_MASCARA) { console.log('máscara', JSON.stringify(caixa)); process.exit(0); }
const tamanho = { width: base.width, height: base.height };
const r = await fetch(API + '/inpaint-v3', { method: 'POST', headers: cab, body: JSON.stringify({
  description: acessorio.descricao,
  inpainting_image: { image: { type: 'base64', base64: b64(base), format: 'png' }, size: tamanho },
  mask_image: { image: { type: 'base64', base64: b64(m), format: 'png' }, size: tamanho },
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
const usado = j.usage?.generations ?? +(antes - (await saldo())).toFixed(1);
fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `personagem/acessorio/${COELHO}/${nome}/${origemArg}/${arquivo}`, geracoes: usado, quando: new Date().toISOString() }) + '\n');
console.log(`${COELHO}/${nome}/${origemArg}/${arquivo}: camada pronta; custou ${usado} gerações`);
