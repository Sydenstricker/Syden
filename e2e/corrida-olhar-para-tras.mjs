// OLHAR PARA TRÁS NA CORRIDA (05/11/2026): no contra o relógio, segurando Q a câmera vira para trás, e soltando volta.
//
//   node e2e/corrida-olhar-para-tras.mjs   (API de teste na 3099 e site na 5174; o LiveKit não é preciso)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

const { browser } = await abrirNavegador();
try {
  const p = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(p, 'olha' + s);
  await dispensarPresentes(p);
  await p.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await p.locator('.jogos-painel .jogos-solo button', { hasText: 'Corrida dos coelhos' }).click();
  const comandos = await p.locator('.corrida-largada .jogo-comandos').innerText();
  comandos.includes('Olhar para trás') ? ok('na largada, o comando aparece com a tecla') : falhou('comandos: ' + comandos);
  await p.locator('.corrida-largada .btn-primary').click();
  await p.locator('.corrida-tela canvas').waitFor();
  await p.evaluate(() => (window.corridaPilotoAutomatico = true));
  await p.waitForTimeout(7000);
  const canvas = p.locator('.corrida-tela canvas');
  const frente = await canvas.evaluate((c) => c.toDataURL());
  await canvas.screenshot({ path: path.join(FOTOS, 'corrida-frente.png') });
  await p.keyboard.down('q');
  await p.waitForTimeout(300);
  const tras = await canvas.evaluate((c) => c.toDataURL());
  await canvas.screenshot({ path: path.join(FOTOS, 'corrida-olhando-para-tras.png') });
  // a moldura do retrovisor: o canto de cima à esquerda fica escuro
  const canto = await canvas.evaluate((c) => [...c.getContext('2d').getImageData(1, 1, 1, 1).data]);
  await p.keyboard.up('q');
  await p.waitForTimeout(300);
  const cantoDepois = await canvas.evaluate((c) => [...c.getContext('2d').getImageData(1, 1, 1, 1).data]);
  frente !== tras ? ok('segurando Q, a tela muda') : falhou('a tela não mudou com o Q');
  canto.slice(0, 3).join() === '30,24,34' ? ok('com a moldura do retrovisor') : falhou(`o canto era ${canto}`);
  cantoDepois.slice(0, 3).join() !== '30,24,34' ? ok('soltando, a câmera volta para a frente') : falhou('a moldura ficou depois de soltar');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('corrida-olhar-para-tras');
}
