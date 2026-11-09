// O SOFÁ QUE AFUNDA, passo 2: para cada vista do sofa-giros e cada assento (assentos.json, de medir.mjs), a MESMA vista com
// só a almofada daquele assento (e o encosto atrás dele) repintada afundada (inpaint-v3, com máscara): o contorno e o resto
// do sofá ficam idênticos, e trocar a vista não aparece, só as almofadas. A vista com os dois ocupados é a junção das duas
// (as máscaras não se encostam), sem gerar de novo.
//   node e2e/pixel-art/salao/sofa-ocupado/afundar.mjs mascaras            → mascara-<vista>-<k>.png (e a folha para conferir)
//   node e2e/pixel-art/salao/sofa-ocupado/afundar.mjs pintar <vista> <k>   → <vista>-<k>.png (a vista com o assento k afundado)
//   node e2e/pixel-art/salao/sofa-ocupado/afundar.mjs juntar               → <vista>-01.png
// Cada pedido vai para e2e/pixel-art/custos.jsonl, com o custo do próprio trabalho.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const GIROS = path.join(AQUI, '..', 'moveis', 'sofa-giros');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const [cmd, vista, k] = process.argv.slice(2);
const py = (codigo, ...args) => execFileSync('py', ['-3', '-c', codigo, ...args], { cwd: AQUI, stdio: 'inherit' });

if (cmd === 'mascaras') {
  // De frente (sudoeste, sudeste): a almofada do assento (uma elipse em volta de onde ele senta) e o pedaço do encosto atrás
  // dele. De costas (noroeste, nordeste): só a aresta de cima do encosto, onde as costas apoiam. Sempre dentro do desenho e
  // sem a borda (2 px para dentro): o contorno não é repintado.
  py(`
import json
import numpy as np
from PIL import Image
j = json.load(open('assentos.json'))
folha = []
for vista, info in j.items():
    im = np.array(Image.open('../moveis/sofa-giros/' + vista + '.png').convert('RGBA'))
    a = im[..., 3] > 127
    dentro = a.copy()
    for _ in range(2):
        d = dentro.copy(); d[1:] &= dentro[:-1]; d[:-1] &= dentro[1:]; d[:, 1:] &= dentro[:, :-1]; d[:, :-1] &= dentro[:, 1:]; dentro = d
    H, W = a.shape; yy, xx = np.mgrid[0:H, 0:W]
    frente = vista.startswith('south')
    atras = 1 if vista in ('south-west', 'north-west') else -1  # (para que lado da tela fica o encosto)
    for k, s in enumerate(info['assentos']):
        x, y = s['x'], s['y'] - s['sobe']
        if frente:
            m = ((xx - (x - 2)) / 15) ** 2 + ((yy - (y - 7)) / 9) ** 2 < 1
            m |= ((xx - (x + atras * 11)) / 12) ** 2 + ((yy - (y - 25)) / 11) ** 2 < 1
        else:
            # a aresta de cima do encosto: as linhas de desenho mais altas perto da coluna do assento
            m = np.zeros_like(a)
            for c in range(x - 12, x + 13):
                if 0 <= c < W and a[:, c].any():
                    t = np.argmax(a[:, c]); m[t:t + 9, c] = True
        m &= dentro
        Image.fromarray((m * 255).astype(np.uint8)).save('mascara-%s-%d.png' % (vista, k))
        v = np.dstack([im[..., :3], np.full((H, W), 255, np.uint8)]).copy()
        v[~a] = (60, 60, 70, 255); v[m] = (v[m] * 0.4 + np.array([255, 0, 255, 255]) * 0.6).astype(np.uint8)
        folha.append(Image.fromarray(v).resize((W * 2, H * 2), Image.NEAREST))
s = Image.new('RGBA', (sum(f.width for f in folha), folha[0].height))
x = 0
for f in folha: s.paste(f, (x, 0)); x += f.width
s.save('mascaras.png')
`);
} else if (cmd === 'pintar') {
  const ler = (f) => ({ image: { type: 'base64', base64: fs.readFileSync(f).toString('base64'), format: 'png' }, size: { width: 170, height: 170 } });
  const frente = vista.startsWith('south');
  const descricao = frente
    ? 'the same sofa, the seat cushion here is SUNK and squashed with a soft deep dent and wrinkles as if someone heavy is sitting on it right now, the backrest cushion behind it pressed back and flattened, same fabric color, same pixel art style, empty seat, no person, no character, no animal'
    : 'the same sofa seen from behind, the top edge of the backrest cushion here is pressed and bent slightly backward as if someone is leaning against it from the other side, same fabric color, same pixel art style, no person, no character';
  const r = await fetch(API + '/inpaint-v3', { method: 'POST', headers: cab, body: JSON.stringify({ description: descricao, inpainting_image: ler(path.join(GIROS, vista + '.png')), mask_image: ler(path.join(AQUI, `mascara-${vista}-${k}.png`)), no_background: true, crop_to_mask: true }) });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 400));
  const trabalho = JSON.parse(t).background_job_id;
  let j = {};
  for (let i = 0; !['completed', 'succeeded'].includes(j.status); i++) {
    if (i > 150) throw new Error('demorou demais');
    await new Promise((ok) => setTimeout(ok, 4000));
    try { j = await (await fetch(API + '/background-jobs/' + trabalho, { headers: cab })).json(); } catch { continue; } // (a rede cai às vezes: tenta de novo)
    if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 400));
  }
  const imgs = (j.last_response?.images ?? (j.last_response?.image ? [j.last_response.image] : [])).map((q) => (typeof q === 'string' ? q : q.base64));
  imgs.forEach((b, i) => fs.writeFileSync(path.join(AQUI, `bruto-${vista}-${k}-${i + 1}.png`), Buffer.from(b, 'base64')));
  fs.appendFileSync(path.join(AQUI, '..', '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `salao/sofa-ocupado/${vista}/${k}`, geracoes: j.usage?.generations ?? null, quando: new Date().toISOString() }) + '\n');
  console.log(imgs.length, 'opções; custou', j.usage?.generations);
} else if (cmd === 'juntar') {
  // A vista final de cada assento: a original com SÓ os pixels da máscara trocados pelos repintados (o resto fica byte a
  // byte), e a dos dois juntos, a soma das duas.
  py(`
import json, glob, os
import numpy as np
from PIL import Image
j = json.load(open('assentos.json'))
for vista, info in j.items():
    base = np.array(Image.open('../moveis/sofa-giros/' + vista + '.png').convert('RGBA'))
    junto = base.copy(); n = 0
    for k in range(len(info['assentos'])):
        b = sorted(glob.glob('bruto-%s-%d-*.png' % (vista, k)))
        escolha = 'escolha-%s-%d.txt' % (vista, k)
        if os.path.exists(escolha): b = ['bruto-%s-%d-%s.png' % (vista, k, open(escolha).read().strip())]
        # (sem repintura aprovada para o assento: a vista sem mudança nele; falhas/ guarda as recusadas, como a do encosto de
        # costas que saiu com um risco branco)
        r = np.array(Image.open(b[0]).convert('RGBA').resize(base.shape[1::-1], Image.NEAREST)) if b else base.copy()
        m = (np.array(Image.open('mascara-%s-%d.png' % (vista, k))) > 127) if b else np.zeros(base.shape[:2], bool)
        m &= r[..., 3] > 127
        v = base.copy(); v[m] = r[m]; v[m, 3] = 255
        Image.fromarray(v).save('%s-%d.png' % (vista, k)); junto[m] = r[m]; junto[m, 3] = 255; n += 1
    if n == len(info['assentos']) and n > 1: Image.fromarray(junto).save('%s-01.png' % vista)
    print(vista, n, 'assentos')
`);
} else throw new Error('uso: afundar.mjs mascaras | pintar <vista> <k> | juntar');
