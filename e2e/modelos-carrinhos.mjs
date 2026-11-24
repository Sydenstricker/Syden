// AS PEÇAS NOSSAS DOS CARRINHOS (24/11/2026): fotografa a largada da Troca (dois cruzamentos) e da Agulha (duas agulhas), com
// as peças feitas no Blender (web/scripts/modelos/tocas-cozinha-carrinhos/carrinhos.py). Só fotos, para olhar.
//   node e2e/modelos-carrinhos.mjs   (API de teste e site de desenvolvimento)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos', 'modelos', 'tocas-cozinha-carrinhos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const sufixo = process.env.SUFIXO ?? 'depois';

const { browser } = await abrirNavegador();
try {
  const lia = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(lia, 'lia' + s);
  await dispensarPresentes(lia);
  for (const [n, nome] of [
    [4, 'troca'],
    [6, 'agulha'],
  ]) {
    await lia.locator('.rail-logo').click();
    const quarto = await (await lia.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
    await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
    await lia.waitForTimeout(1000);
    await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
    await lia.locator('.area-de-trabalho [data-icone="mini-games"]').click();
    const painel = lia.locator('.jogos-painel');
    await painel.waitFor();
    await painel.locator('.jogos-solo button', { hasText: 'Carrinhos da toca' }).click();
    await lia.locator('.carrinhos-escolha').waitFor({ timeout: 10000 });
    await lia.getByRole('button', { name: `Pista ${n}`, exact: true }).click();
    await lia.locator('.carrinhos-robos button', { hasText: '0' }).first().click();
    await lia.getByRole('button', { name: 'Começar' }).click();
    await lia.locator('.carrinhos-caixa:not(.escondida)').waitFor({ timeout: 30000 });
    await lia.waitForTimeout(1500);
    await lia.locator('.carrinhos').first().screenshot({ path: path.join(FOTOS, `carrinhos-${nome}-${sufixo}.png`) });
    ok(`a pista ${nome} abriu`);
    await lia.keyboard.press('Escape');
    await lia.waitForTimeout(500);
    await lia.reload();
    await lia.waitForTimeout(2000);
  }
} catch (e) {
  falhou(e.stack ?? String(e));
  await browser.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(FOTOS, 'carrinhos-erro.png') }).catch(() => {});
} finally {
  await browser.close();
  resumo('peças dos carrinhos');
}
