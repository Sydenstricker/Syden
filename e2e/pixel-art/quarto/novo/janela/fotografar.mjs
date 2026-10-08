// Fotos da janela.html: de dia (vista 1 e vista 2) e de noite.
//   node e2e/pixel-art/quarto/novo/janela/fotografar.mjs   → fotos/*.png
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar } from '../../imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
fs.mkdirSync(path.join(AQUI, 'fotos'), { recursive: true });
const p = await abrir();
await p.setViewportSize({ width: 1100, height: 900 });
await p.goto('file:///' + path.join(AQUI, 'janela.html').replaceAll('\\', '/'));
await p.waitForTimeout(2000);
const foto = (n) => p.screenshot({ path: path.join(AQUI, 'fotos', n + '.png'), fullPage: true });
await foto('dia-vista-1');
await p.click('[data-vista="1"]'); await p.waitForTimeout(300); await foto('dia-vista-2');
await p.click('#b-noite'); await p.waitForTimeout(300); await foto('noite');
await fechar();
