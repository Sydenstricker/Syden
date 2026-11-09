// A PORTA DE ENTRADA DO SALÃO (09/11/2026): monta o salão, e fotografa a porta fechada, alguém chegando (a porta aberta, a
// pessoa na soleira com o nome, o coelho do balcão acenando) e a porta fechada de novo, de dia e de noite.
//   node e2e/pixel-art/salao/porta-de-entrada.mjs        (MASCOTE=pixellab para o desenho do PixelLab)
//   → salao/fotos/entrada-<dia|noite>-<fechada|chegando|depois>.png
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador } from '../../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const pagina = path.join(os.tmpdir(), 'syden-salao-entrada.html');
if (!process.env.SEM_MONTAR) execFileSync(process.execPath, [path.join(AQUI, '..', 'quarto', 'novo', 'quarto', 'montar.mjs'), 'salao'], { env: { ...process.env, SAIDA_DA_PAGINA: pagina }, stdio: 'inherit' });
const { browser } = await abrirNavegador({ viewport: { width: 1240, height: 1000 } });
const p = await browser.newPage({ viewport: { width: 1240, height: 1000 } });
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
await p.goto('file:///' + pagina.replaceAll(path.sep, '/'));
await p.waitForFunction(() => window.chegouDoTeste && document.getElementById('tela')?.width > 0, null, { timeout: 90000 });
await p.waitForTimeout(1500);
const recorte = (caixa) => p.evaluate((caixa) => {
  const c = document.getElementById('tela'), [x0, y0, w, h] = caixa, o = document.createElement('canvas');
  o.width = w * 3; o.height = h * 3; const g = o.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(c, x0, y0, w, h, 0, 0, w * 3, h * 3); return o.toDataURL('image/png').split(',')[1];
}, caixa);
const tela = () => p.evaluate(() => { const c = document.getElementById('tela'); return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.filter((_, i) => i % 4 === 0)); });
fs.mkdirSync(path.join(AQUI, 'fotos'), { recursive: true });
for (const modo of ['dia', 'noite']) {
  await p.click('#' + modo); await p.waitForTimeout(400);
  const antes = await tela();
  await p.evaluate(() => window.chegouDoTeste('Nova'));
  await p.waitForTimeout(700);
  const durante = await tela();
  // a caixa do que mudou (a porta, a pessoa, o coelho do balcão)
  const W = Math.round(Math.sqrt(antes.length)); let x0 = W, y0 = W, x1 = 0, y1 = 0;
  for (let k = 0; k < antes.length; k++) if (Math.abs(antes[k] - durante[k]) > 6) { const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  console.log(modo, 'mudou em', [x0, y0, x1, y1]);
  const caixa = [Math.max(0, x0 - 30), Math.max(0, y0 - 30), Math.min(W, x1 + 30) - Math.max(0, x0 - 30), Math.min(W, y1 + 30) - Math.max(0, y0 - 30)];
  fs.writeFileSync(path.join(AQUI, 'fotos', `entrada-${modo}-chegando.png`), Buffer.from(await recorte(caixa), 'base64'));
  await p.waitForTimeout(5000);
  fs.writeFileSync(path.join(AQUI, 'fotos', `entrada-${modo}-depois.png`), Buffer.from(await recorte(caixa), 'base64'));
}
console.log(erros.length ? 'ERROS: ' + erros.join('\n') : 'sem erros na página');
await browser.close();
