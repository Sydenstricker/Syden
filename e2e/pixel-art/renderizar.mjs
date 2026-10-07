// Renderiza desenhos do mascote em PNG com fundo transparente, para servir de referência às ferramentas.
//   node e2e/pixel-art/renderizar.mjs apresentacao ocioso ...   (rodar da raiz do repositório)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador } from '../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const { browser } = await abrirNavegador();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
for (const nome of process.argv.slice(2)) {
  const svg = fs.readFileSync(`web/public/mascote/${nome}.svg`, 'utf8');
  await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:512px;height:512px;display:grid;place-items:center">${svg.replace('<svg', '<svg style="width:100%;height:100%"')}</div></body></html>`);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(AQUI, `ref-${nome}.png`), omitBackground: true });
  console.log('ok', nome);
}
await browser.close();
