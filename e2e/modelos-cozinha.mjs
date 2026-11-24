// O EXTINTOR E A CAMPAINHA DA COZINHA (24/11/2026), feitos no Blender (web/scripts/modelos/tocas-cozinha-carrinhos/cozinha.py):
// abre a Cozinha no Solo, põe o extintor na mão do coelho (só na tela) e fotografa. Só fotos, para olhar.
//   node e2e/modelos-cozinha.mjs   (API de teste e site de desenvolvimento)   SUFIXO=antes para a foto de antes
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos', 'modelos', 'tocas-cozinha-carrinhos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const sufixo = process.env.SUFIXO ?? 'depois';

const { browser } = await abrirNavegador();
try {
  const duda = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.locator('.rail-logo').click();
  const quarto = await (await duda.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await duda.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await duda.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = duda.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Cozinha da toca' }).click();
  await duda.locator('.cozinha-3d:not(.carregando) canvas').waitFor({ timeout: 30000 });
  await duda.waitForTimeout(3800);
  await duda.locator('.cozinha').first().screenshot({ path: path.join(FOTOS, `cozinha-${sufixo}.png`) });
  await duda.evaluate(() => {
    window.cozinhaDoTeste.coelho.mao = { tipo: 'extintor' };
  });
  await duda.waitForTimeout(700);
  await duda.locator('.cozinha').first().screenshot({ path: path.join(FOTOS, `cozinha-extintor-na-mao-${sufixo}.png`) });
  ok('a cozinha abriu e o coelho segura o extintor');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('extintor e campainha');
}
