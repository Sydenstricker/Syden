// OS MÓVEIS DO SALÃO ISOMÉTRICO (15/10/2026). A receita do quarto (quarto/novo/quarto/avulso.mjs e girar.mjs): cada
// móvel é gerado AVULSO, sem fundo, com um pedaço da base do salão como referência de estilo; a opção escolhida vira as 8
// vistas do MESMO objeto (create-8-direction-object), das quais se usam as 4 diagonais. A lista vem do salão de frente
// (web/src/assets/salao/sala.png): sofá, TV no rack, fliperama, balcão do bar com banquetas, estante, mesinha.
//   node e2e/pixel-art/salao/moveis.mjs opcoes <id>          → moveis/<id>-<n>.png (várias opções numa chamada)
//   node e2e/pixel-art/salao/moveis.mjs girar <id> <n>        → moveis/<id>-giros/<direção>.png
//   node e2e/pixel-art/salao/moveis.mjs estado <id> <nome> "<o que muda>"   → moveis/<id>-<nome>-giros/ (o mesmo objeto,
//   editado: as mesmas vistas e o mesmo enquadramento, como o guarda-roupa aberto do quarto)
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../quarto/imagem.mjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SAIDA = path.join(AQUI, 'moveis');
fs.mkdirSync(SAIDA, { recursive: true });
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const ANGULO = 'isometric pixel art seen from above at the same 2:1 isometric angle as the reference, clean dark outline, warm cozy palette like the reference, the whole piece visible';
export const MOVEIS = {
  sofa: { lado: [160, 136], texto: `ONLY ONE cozy L-shaped corner sofa and nothing else: soft dusty-mauve fabric cushions, a few throw pillows, short wooden legs, ${ANGULO}` },
  tv: { lado: [136, 136], texto: `ONLY ONE low wooden TV stand with a large flat-screen television on top and a small game console beside it, the screen dark and blank, and nothing else, ${ANGULO}` },
  fliperama: { lado: [80, 144], texto: `ONLY ONE retro arcade cabinet machine and nothing else: a tall cabinet with colorful side art, a dark blank screen, joysticks and buttons, ${ANGULO}` },
  balcao: { lado: [160, 136], texto: `ONLY ONE short wooden bar counter and nothing else: a dark wood counter top with a few bottles and glasses on it, panelled front, ${ANGULO}` },
  banqueta: { lado: [56, 80], texto: `ONLY ONE round wooden bar stool with a cushioned top and four tall legs, and nothing else, ${ANGULO}` },
  estante: { lado: [96, 144], texto: `ONLY ONE tall freestanding wooden bookshelf and nothing else: filled with colorful books, a small plant and a few board game boxes, ${ANGULO}` },
  mesinha: { lado: [96, 80], texto: `ONLY ONE low wooden coffee table and nothing else, with two mugs and a small bowl of snacks on it, ${ANGULO}` },
  // O SALÃO 16 × 16 (15/10/2026): o que enche a frente. Móveis LIMPOS (o que vai em cima é objeto à parte, decisão dele).
  'mesa-jogo': { lado: [112, 96], texto: `ONLY ONE round wooden table for board games and nothing else: a sturdy round dark-wood top on one central pedestal leg, the top completely empty, ${ANGULO}` },
  cadeira: { lado: [56, 88], texto: `ONLY ONE simple wooden chair with a cushioned seat and a slatted back, and nothing else, ${ANGULO}` },
  jukebox: { lado: [80, 128], texto: `ONLY ONE retro jukebox music machine and nothing else: rounded wooden top with warm glowing lights, a record selection panel, a speaker grille, ${ANGULO}` },
  microfone: { lado: [88, 120], texto: `ONLY ONE karaoke corner set and nothing else: a microphone on a tall stand next to one wooden floor speaker box, ${ANGULO}` },
  pufao: { lado: [96, 80], texto: `ONLY ONE big soft bean bag chair and nothing else: plump mustard-yellow fabric, ${ANGULO}` },
};

const [modo, id, n, descricao] = process.argv.slice(2);
const m = MOVEIS[id];
if (!m && !(modo === 'estado' && id.startsWith('q:'))) throw new Error('móveis: ' + Object.keys(MOVEIS).join(', '));
if (modo === 'opcoes') {
  // A referência de estilo: o chão e o tijolo da base escolhida (o pedaço de baixo, à esquerda).
  const p = await abrir();
  const ref = await p.evaluate(async (b) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode();
    const c = document.createElement('canvas'); c.width = 160; c.height = 160; c.getContext('2d').drawImage(im, -60, -200);
    return c.toDataURL('image/png').split(',')[1];
  }, ler64(path.join(AQUI, 'base.png')));
  await fechar();
  const imagens = await chamar('/generate-image-v2', {
    description: m.texto, image_size: { width: m.lado[0], height: m.lado[1] }, no_background: true,
    reference_images: [{ image: { type: 'base64', base64: ref, format: 'png' }, size: { width: 160, height: 160 }, usage_description: 'Match this pixel art style, outline, palette, light and pixel scale exactly; draw only the requested piece of furniture' }],
  });
  imagens.forEach((b, i) => gravar64(path.join(SAIDA, `${id}-${i + 1}.png`), b));
  console.log(id, '→', imagens.length, 'opções');
} else if (modo === 'estado') {
  // Um móvel do QUARTO também serve (q:<pasta dos giros>, em quarto/novo/quarto/avulsos/): o criado-mudo limpo, sem a
  // caneca pintada (a caneca é objeto à parte, 15/10/2026).
  const DIR = id.startsWith('q:') ? path.join(AQUI, '..', 'quarto', 'novo', 'quarto', 'avulsos') : SAIDA, base = id.startsWith('q:') ? id.slice(2) : id + '-giros';
  const origem = JSON.parse(fs.readFileSync(path.join(DIR, base, 'objeto.json'), 'utf8'));
  const pasta = path.join(DIR, base.replace(/-giros$/, '') + '-' + n + '-giros');
  fs.mkdirSync(pasta, { recursive: true });
  const antes = await saldo();
  const r = await fetch(`${API}/objects/${origem.id ?? origem.object_id}/states`, { method: 'POST', headers: cab, body: JSON.stringify({ edit_description: descricao, state_name: n }) });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
  const resp = JSON.parse(t), oid = resp.object_id ?? resp.id;
  let det;
  for (let i = 0; ; i++) {
    if (i > 160) throw new Error('demorou demais');
    await esperar(5000);
    det = await (await fetch(`${API}/objects/${oid}`, { headers: cab })).json();
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
  fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `salao/estado/${id}-${n}`, geracoes: +(antes - (await saldo())).toFixed(1), quando: new Date().toISOString() }) + String.fromCharCode(10));
  console.log(id, n, k, 'vistas');
} else if (modo === 'girar') {
  const pasta = path.join(SAIDA, id + '-giros');
  fs.mkdirSync(pasta, { recursive: true });
  const antes = await saldo();
  const r = await fetch(API + '/create-8-direction-object', {
    method: 'POST', headers: cab,
    body: JSON.stringify({ description: m.texto.replace(/^ONLY ONE /, '').split(', isometric')[0], view: 'low top-down', reference_image: { type: 'base64', base64: fs.readFileSync(path.join(SAIDA, `${id}-${n}.png`)).toString('base64'), format: 'png' } }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
  const { object_id: oid } = JSON.parse(t);
  let det;
  for (let i = 0; ; i++) {
    if (i > 160) throw new Error('demorou demais');
    await esperar(5000);
    det = await (await fetch(`${API}/objects/${oid}`, { headers: cab })).json();
    if (['completed', 'review'].includes(det.status)) break;
    if (['failed', 'error'].includes(det.status)) throw new Error(JSON.stringify(det).slice(0, 600));
  }
  fs.writeFileSync(path.join(pasta, 'objeto.json'), JSON.stringify(det, null, 2));
  let k = 0;
  for (const [d, v] of Object.entries(det.rotation_urls ?? {})) {
    const url = typeof v === 'string' ? v : v?.url;
    for (let tentativa = 0; url && tentativa < 4; tentativa++) {
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      // "too_busy" volta como um PNG quebrado: confere a assinatura e pede de novo
      if (buf.slice(1, 4).toString() === 'PNG' && buf.length > 500) { fs.writeFileSync(path.join(pasta, d + '.png'), buf); k++; break; }
      await esperar(4000);
    }
  }
  fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: 'salao/giros/' + id, geracoes: +(antes - (await saldo())).toFixed(1), quando: new Date().toISOString() }) + '\n');
  console.log(id, k, 'vistas');
}
