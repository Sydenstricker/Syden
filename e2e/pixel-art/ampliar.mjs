// Amplia cada PNG de saida/ em 6x, com os pixels nítidos, em grande/ — 64 px não se avalia a olho.
//   node e2e/pixel-art/ampliar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador } from '../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const { browser } = await abrirNavegador();
const page = await browser.newPage({ viewport: { width: 384, height: 384 } });
fs.mkdirSync(path.join(AQUI, 'grande'), { recursive: true });
for (const f of fs.readdirSync(path.join(AQUI, 'saida')).filter((f) => f.endsWith('.png'))) {
  const b64 = fs.readFileSync(path.join(AQUI, 'saida', f)).toString('base64');
  await page.setContent(`<html><body style="margin:0;background:#2b2f38"><img src="data:image/png;base64,${b64}" style="width:384px;height:384px;image-rendering:pixelated;display:block"></body></html>`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(AQUI, 'grande', f) });
}
await browser.close();
