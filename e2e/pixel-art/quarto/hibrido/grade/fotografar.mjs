// Fotografa o teste da grade: o pufe no lugar original e longe dele, de noite e de dia, e o original pintado.
//   node e2e/pixel-art/quarto/hibrido/grade/fotografar.mjs   → fotos/*.png
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador } from '../../../../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
fs.mkdirSync(path.join(AQUI, 'fotos'), { recursive: true });
const { browser } = await abrirNavegador();
const p = await browser.newPage({ viewport: { width: 1000, height: 1080 } });
const erros = [];
p.on('pageerror', (e) => erros.push(e.message));
await p.goto(new URL('./grade.html', import.meta.url).href);
await p.waitForTimeout(1500);
const foto = (n) => p.locator('canvas').screenshot({ path: path.join(AQUI, 'fotos', n + '.png') });
await foto('noite-original-solto');
await p.click('#original'); await foto('noite-original-pintado'); await p.click('#original');
await p.click('#arrumar');
for (const [u, v, n] of [[3, 4, 'noite-perto-da-cama'], [7, 4, 'noite-frente'], [5, 7, 'noite-direita']]) {
  console.log(n, await p.evaluate(([u, v]) => window.porPufe(u, v), [u, v]));
  await foto(n);
}
await p.click('#arrumar');
await p.click('#luz');
await p.evaluate(() => window.porPufe(3, 4)); await foto('dia-perto-da-cama');
await p.evaluate(() => window.porPufe(4, 6)); await foto('dia-original-solto');
console.log('erros:', erros.length ? erros : 'nenhum');
await browser.close();
