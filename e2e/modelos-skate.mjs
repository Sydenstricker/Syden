// O POSTE DO ROLÊ (24/11/2026), feito no Blender (web/scripts/modelos/tocas-cozinha-carrinhos/poste.py):
// abre o Rolê no Solo e fotografa a pista com os postes em volta. Só fotos, para olhar.
//   node e2e/modelos-skate.mjs   (API de teste e site de desenvolvimento)   SUFIXO=antes para a foto de antes
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
  await painel.locator('.jogos-solo button', { hasText: 'Rolê do coelho' }).click();
  const comecar = duda.getByRole('button', { name: 'Começar' });
  await comecar.waitFor({ timeout: 10000 }).then(() => comecar.click()).catch(() => {});
  await duda.locator('.skate-caixa:not(.escondida)').waitFor({ timeout: 30000 });
  await duda.waitForTimeout(4000);
  await duda.locator('.minijogo, .skate').first().screenshot({ path: path.join(FOTOS, `skate-${sufixo}.png`) });
  ok('o rolê abriu');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('poste do rolê');
}
