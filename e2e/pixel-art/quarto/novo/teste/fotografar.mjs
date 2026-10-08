// Fotos do teste.html para conferir sem abrir o navegador: de dia e de noite, e o pufe levado para perto da janela.
//   node e2e/pixel-art/quarto/novo/teste/fotografar.mjs   → fotos/*.png
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar } from '../../imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const FOTOS = path.join(AQUI, 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const p = await abrir();
await p.setViewportSize({ width: 1240, height: 760 });
await p.goto('file:///' + path.join(AQUI, 'teste.html').replaceAll('\\', '/'));
await p.waitForTimeout(2500);
const foto = (nome) => p.screenshot({ path: path.join(FOTOS, nome + '.png'), fullPage: true });
await foto('dia');
await p.click('#noite'); await p.waitForTimeout(600); await foto('noite');
// Leva o pufe para perto da janela (casa u 2, v 6), arrastando no canvas.
const r = await p.locator('#tela').boundingBox();
const alvo = await p.evaluate(() => { const a = 2 / 8, b = 6.4 / 8, C = { fundo: [256, 238], esquerda: [34, 352], frente: [256, 472], direita: [478, 350] }; return [0, 1].map((k) => C.fundo[k] * (1 - a) * (1 - b) + C.esquerda[k] * a * (1 - b) + C.direita[k] * (1 - a) * b + C.frente[k] * a * b); });
await p.mouse.move(r.x + alvo[0] * r.width / 512, r.y + alvo[1] * r.height / 512); await p.mouse.down(); await p.mouse.up();
await p.waitForTimeout(600); await foto('noite-pufe-janela');
await p.click('#dia'); await p.click('#grade'); await p.waitForTimeout(600); await foto('dia-pufe-janela-grade');
await fechar();
