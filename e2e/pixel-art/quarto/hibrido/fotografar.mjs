// Fotografa o quarto híbrido: foto-noite.png (todos os contornos e nomes acesos) e foto-dia.png (o mouse sobre
// o coelho).
//   node e2e/pixel-art/quarto/hibrido/fotografar.mjs
import path from 'node:path';
import { abrirNavegador } from '../../../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const { browser } = await abrirNavegador();
const p = await browser.newPage({ viewport: { width: 1000, height: 1100 } });
await p.goto(new URL('./quarto.html', import.meta.url).href);
await p.click('#nomes');
await p.mouse.move(31 + 240 * 3, 70 + 140 * 3);
await p.waitForTimeout(300);
await p.screenshot({ path: path.join(AQUI, 'foto-noite.png'), fullPage: true });
if (await p.$('#luz')) {
  await p.click('#nomes');
  await p.click('#luz');
  await p.mouse.move(31 + 110 * 3, 70 + 120 * 3);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: path.join(AQUI, 'foto-dia.png'), fullPage: true });
}
await browser.close();
