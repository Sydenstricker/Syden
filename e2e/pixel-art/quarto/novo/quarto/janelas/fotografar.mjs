// Fotos da janela móvel: a original arrastada para a parede da esquerda (de dia e de noite) e os outros tipos.
//   node e2e/pixel-art/quarto/novo/quarto/janelas/fotografar.mjs   → janelas/fotos/*.png
import path from 'node:path';
import fs from 'node:fs';
import { abrir, fechar } from '../../../imagem.mjs';
const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const S = path.join(AQUI, 'fotos'); fs.mkdirSync(S, { recursive: true });
const p = await abrir();
const erros = []; p.on('pageerror', (e) => erros.push(String(e))); p.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
await p.setViewportSize({ width: 1240, height: 900 });
await p.goto('file:///' + path.join(AQUI, '..', 'quarto.html').replaceAll(String.fromCharCode(92), '/'));
await p.waitForTimeout(3000);
const r = await p.locator('#tela').boundingBox();
const em = (x, y) => [r.x + x * r.width / 512, r.y + y * r.height / 512];
// arrasta a janela original (pega na cortina da direita, 455, 220) para a parede da esquerda
await p.mouse.move(...em(455, 220)); await p.mouse.down();
for (let i = 1; i <= 20; i++) { await p.mouse.move(...em(455 - i * 20, 220)); await p.waitForTimeout(30); }
await p.mouse.up(); await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(() => window.janelaDoTeste())));
await p.locator('#tela').screenshot({ path: S + '/k-esquerda.png' });
await p.click('#noite'); await p.waitForTimeout(800); await p.locator('#tela').screenshot({ path: S + '/k-esquerda-noite.png' });
await p.click('#dia');
for (const n of [1, 2, 3]) { await p.click('#tipo-janela'); await p.waitForTimeout(800); await p.locator('#tela').screenshot({ path: S + '/k-tipo' + n + '.png' }); console.log(JSON.stringify(await p.evaluate(() => window.janelaDoTeste()))); }
await p.click('#noite'); await p.waitForTimeout(800); await p.locator('#tela').screenshot({ path: S + '/k-tipo3-noite.png' });
console.log(erros.join('\n') || 'sem erros');
await fechar();
