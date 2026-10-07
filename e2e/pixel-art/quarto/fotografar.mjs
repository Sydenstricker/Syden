// Fotografa a página de teste de dia e de noite (com todos os nomes): foto-dia.png e foto-noite.png.
//   node e2e/pixel-art/quarto/fotografar.mjs
import path from 'node:path';
import { abrirNavegador } from '../../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const { browser } = await abrirNavegador();
const p = await browser.newPage({ viewport: { width: 800, height: 900 } });
await p.goto(new URL('./pecas-soltas.html', import.meta.url).href);
await p.waitForTimeout(300);
await p.screenshot({ path: path.join(AQUI, 'foto-dia.png'), fullPage: true });
await p.click('#rotulos');
await p.click('#luz');
await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(AQUI, 'foto-noite.png'), fullPage: true });
await browser.close();
