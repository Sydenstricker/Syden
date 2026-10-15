// O teste dos objetos da parede e das funções: arrasta o quadro, põe a prateleira e a pintura, liga as funções e
// confere o rótulo e o clique do fone.   node e2e/pixel-art/quarto/novo/quarto/parede/testar.mjs   → parede/fotos/
import path from 'node:path';
import fs from 'node:fs';
import { abrir, fechar } from '../../../imagem.mjs';
const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const S = path.join(AQUI, 'fotos'); fs.mkdirSync(S, { recursive: true });
const p = await abrir();
const erros = []; p.on('pageerror', (e) => erros.push(String(e.stack || e))); p.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
await p.setViewportSize({ width: 1240, height: 1000 });
await p.goto('file:///' + path.join(AQUI, '..', 'quarto.html').replaceAll(String.fromCharCode(92), '/'));
await p.waitForTimeout(3500);
let r = await p.locator('#tela').boundingBox();
const em = (x, y) => [r.x + x * r.width / 512, r.y + y * r.height / 512];
// o quadro de fotos: na parede da esquerda, por volta de (130, 150) na tela de 512
const antes = await p.evaluate(() => JSON.stringify(window.paredeDoTeste().quadro));
await p.mouse.move(...em(150, 150)); await p.mouse.down();
for (let i = 1; i <= 10; i++) { await p.mouse.move(...em(160 - i * 4, 160 - i * 2)); await p.waitForTimeout(25); }
await p.mouse.up(); await p.waitForTimeout(500);
console.log('quadro', antes, '→', JSON.stringify(await p.evaluate(() => window.paredeDoTeste().quadro)));
await p.click('#enfeites button:nth-child(4)'); await p.waitForTimeout(500); // a prateleira
await p.click('#enfeites button:nth-child(5)'); await p.waitForTimeout(500); // a pintura
console.log('parede', JSON.stringify(await p.evaluate(() => window.paredeDoTeste())));
await p.locator('#tela').screenshot({ path: S + '/f-parede.png' });
await p.click('#funcoes'); r = await p.locator('#tela').boundingBox();
const fo = await p.evaluate(() => window.ondeNaParede('fone'));  await p.mouse.move(...em(...fo)); await p.waitForTimeout(300); // o fone
console.log('rótulo no fone:', await p.locator('#rotulo').isVisible() ? await p.locator('#rotulo').textContent() : '(nenhum)');
await p.mouse.click(...em(...fo)); await p.waitForTimeout(300);
console.log('ação:', await p.locator('#acao-teste').textContent());
await p.mouse.move(...em(440, 140)); await p.waitForTimeout(300); // o vidro da janela
console.log('rótulo na janela:', await p.locator('#rotulo').isVisible() ? await p.locator('#rotulo').textContent() : '(nenhum)');
await p.locator('#tela').screenshot({ path: S + '/f-rotulo.png' });
console.log(erros.join(' | ') || 'sem erros');
await fechar();
