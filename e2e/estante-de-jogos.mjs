// A ESTANTE DE JOGOS: fotografa a aba Solo do computador do quarto (as capas), para conferir capa nova.
//
//   node e2e/estante-de-jogos.mjs   (API de teste na 3099 e site na 5174)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const { browser } = await abrirNavegador();
try {
  const p = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1400 } })).newPage());
  await cadastrar(p, 'estante' + Date.now().toString().slice(-5));
  await dispensarPresentes(p);
  await p.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await p.locator('.jogos-painel').waitFor();
  await p.waitForTimeout(800);
  await p.locator('.jogos-painel').screenshot({ path: path.join(FOTOS, 'estante.png') });
  const todos = await p.locator('.jogos-painel .jogos-solo li button').count();
  await p.locator('.jogos-painel .fichario-ficha', { hasText: 'Mesa e cartas' }).click();
  await p.waitForTimeout(300);
  await p.locator('.jogos-painel').screenshot({ path: path.join(FOTOS, 'estante-mesa.png') });
  const mesa = await p.locator('.jogos-painel .jogos-solo li button').allInnerTexts();
  mesa.length < todos && mesa.some((x) => x.includes('Truco')) && !mesa.some((x) => x.includes('Sudoku')) ? ok(`a ficha Mesa e cartas mostra ${mesa.length} de ${todos}: ${mesa.join(', ')}`) : falhou(`a ficha não filtrou: ${mesa.join(', ')}`);
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('estante-de-jogos');
}
