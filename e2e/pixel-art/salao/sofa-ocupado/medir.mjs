// O SOFÁ QUE AFUNDA (09/11/2026, relato dele: "parece que eles se sentam POR CIMA do sofá; talvez uma VARIAÇÃO DO SOFÁ com
// as almofadas reagindo aos corpos"). Passo 1: onde, no desenho de cada vista do sofa-giros, fica o assento de cada lugar
// (LUGARES_NO_SOFA). Monta o salão, gira o sofá nas 4 posições e lê da página os lugares e a caixa do sofá na tela; a vista
// do sofá é desenhada 1:1, então o deslocamento entre a caixa na tela e a caixa do desenho leva o lugar para o desenho.
//   node e2e/pixel-art/salao/sofa-ocupado/medir.mjs   → assentos.json (por vista: [x, y] de cada assento, no desenho)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador } from '../../../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const GIROS = path.join(AQUI, '..', 'moveis', 'sofa-giros');
const ORDEM = ['south-west', 'north-west', 'north-east', 'south-east'];
const pagina = path.join(os.tmpdir(), 'syden-salao-sofa.html');
if (!process.env.SEM_MONTAR) execFileSync(process.execPath, [path.join(AQUI, '..', '..', 'quarto', 'novo', 'quarto', 'montar.mjs'), 'salao'], { env: { ...process.env, MASCOTE: 'pixellab', SAIDA_DA_PAGINA: pagina }, stdio: 'ignore' });
const caixaDoDesenho = (f) => JSON.parse(execFileSync('py', ['-3', '-c', 'import sys,json\nfrom PIL import Image\nprint(json.dumps(list(Image.open(sys.argv[1]).getbbox())))', f]).toString());
const { browser } = await abrirNavegador({ viewport: { width: 1240, height: 1000 } });
const p = await browser.newPage({ viewport: { width: 1240, height: 1000 } });
await p.goto('file:///' + pagina.split(path.sep).join('/'));
await p.waitForFunction(() => window.lugaresDoTeste && document.getElementById('tela')?.width > 0, null, { timeout: 90000 });
await p.waitForTimeout(1000);
await p.evaluate(() => window.pessoasDoTeste([]));
const orig = await p.evaluate(() => JSON.parse(JSON.stringify(window.arrumacaoDoTeste().sofa)));
const saida = {};
for (const lado of [0, 1, 2, 3]) {
  let ok = null;
  for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2]]) { ok = await p.evaluate(([lado, c]) => window.girarDoTeste('sofa', lado, c), [lado, [orig.c[0] + a, orig.c[1] + b]]); if (ok) break; }
  await p.waitForTimeout(200);
  const r = await p.evaluate(() => {
    const L = window.lugaresDoTeste(), cx = window.caixaDoMovelDoTeste('sofa');
    return { cx, assentos: L.lugares.sentar.filter((x) => x.sobre === 'sofa').map((x) => { const [px, py] = L.ponto(x.u, x.v); return { px, py, sobe: x.sobe, olha: x.olha }; }) };
  });
  const cd = caixaDoDesenho(path.join(GIROS, ORDEM[lado] + '.png')), dx = r.cx[0] - cd[0], dy = r.cx[1] - cd[1];
  // (as caixas medem igual? se não, o sofá na tela não é a vista inteira: avisa)
  const igual = r.cx[2] - r.cx[0] === cd[2] - cd[0] && r.cx[3] - r.cx[1] === cd[3] - cd[1];
  saida[ORDEM[lado]] = { assentos: r.assentos.map((a) => ({ x: Math.round(a.px - dx), y: Math.round(a.py - dy), sobe: a.sobe, olha: a.olha })), caixaIgual: igual };
  console.log(ORDEM[lado], JSON.stringify(saida[ORDEM[lado]]), 'na tela', r.cx, 'desenho', cd);
}
await p.evaluate((o) => window.girarDoTeste('sofa', o.lado, o.c), orig);
fs.writeFileSync(path.join(AQUI, 'assentos.json'), JSON.stringify(saida, null, 1));
await browser.close();
