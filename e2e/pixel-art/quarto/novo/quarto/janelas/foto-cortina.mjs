// A cortina fechada da janela original, de dia e de noite, aberta e fechada (09/11/2026): para conferir que as duas cortinas
// dos lados se fecham até o chão (original-pecas.py).
//   node e2e/pixel-art/quarto/novo/quarto/janelas/foto-cortina.mjs <página.html> <pasta de saída>
import path from 'node:path';
import fs from 'node:fs';
import { abrir, fechar } from '../../../imagem.mjs';
const [pagina, S] = process.argv.slice(2);
fs.mkdirSync(S, { recursive: true });
const p = await abrir();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
await p.setViewportSize({ width: 1240, height: 900 });
await p.goto('file:///' + path.resolve(pagina).replaceAll(String.fromCharCode(92), '/'));
await p.waitForTimeout(3000);
for (const hora of ['dia', 'noite']) {
  await p.click('#' + hora); await p.waitForTimeout(600);
  await p.locator('#tela').screenshot({ path: path.join(S, `cortina-${hora}-aberta.png`) });
  await p.click('#cortina'); await p.waitForTimeout(800);
  await p.locator('#tela').screenshot({ path: path.join(S, `cortina-${hora}-fechada.png`) });
  await p.click('#cortina'); await p.waitForTimeout(400);
}
console.log(erros.join('\n') || 'sem erros');
await fechar();
