// Fotos do salão (de dia e de noite) e os pontos que o motor calcula nele.
//   node e2e/pixel-art/salao/fotografar.mjs   → fotos/
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar } from '../quarto/imagem.mjs';
const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const S = path.join(AQUI, 'fotos'); fs.mkdirSync(S, { recursive: true });
const p = await abrir();
const erros = []; p.on('pageerror', (e) => erros.push(String(e.stack || e).slice(0, 400)));
await p.setViewportSize({ width: 1240, height: 1000 });
await p.goto('file:///' + path.join(AQUI, 'salao.html').replaceAll(String.fromCharCode(92), '/'));
await p.waitForTimeout(9000);
console.log(erros.join(' | ') || 'sem erros');
console.log(JSON.stringify(await p.evaluate(() => window.pontosDoTeste())));
await p.locator('#tela').screenshot({ path: S + '/s-dia.png' });
await p.click('#noite'); await p.waitForTimeout(800);
await p.locator('#tela').screenshot({ path: S + '/s-noite.png' });
console.log(erros.join(' | ') || 'sem erros');
await fechar();
