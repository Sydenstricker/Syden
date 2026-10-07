// Fotografa o quarto híbrido: foto-noite.png (com as áreas de clique acesas e todos os nomes) e, se houver
// a pintura de dia, foto-dia.png.
//   node e2e/pixel-art/quarto/hibrido/fotografar.mjs
import path from 'node:path';
import { abrirNavegador } from '../../../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const { browser } = await abrirNavegador();
const p = await browser.newPage({ viewport: { width: 1000, height: 1100 } });
await p.goto(new URL('./quarto.html', import.meta.url).href);
await p.click('#nomes');
await p.evaluate(() => document.querySelectorAll('svg.areas polygon').forEach((x) => x.classList.add('aceso')));
await p.waitForTimeout(300);
await p.screenshot({ path: path.join(AQUI, 'foto-noite.png'), fullPage: true });
if (await p.$('#luz')) {
  await p.evaluate(() => document.querySelectorAll('svg.areas polygon').forEach((x) => x.classList.remove('aceso')));
  await p.click('#nomes');
  await p.click('#luz');
  await p.waitForTimeout(1800);
  await p.screenshot({ path: path.join(AQUI, 'foto-dia.png'), fullPage: true });
}
await browser.close();
