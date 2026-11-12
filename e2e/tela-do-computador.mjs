// A TELA DO COMPUTADOR DO QUARTO (11/11/2026): a área de trabalho retrô (TelaDoComputador.tsx). Confere que o computador abre
// na área de trabalho (sem a mesa embaixo), que o ícone Mini-games abre a janela com a lista, que o ✕ da janela volta à área de
// trabalho, que o Esc fecha a janela e depois o computador, e que o ícone Troféus abre os troféus. Fotos nos dois temas.
//
//   node e2e/tela-do-computador.mjs   (API de teste na 3099 e site na 5174)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const { browser } = await abrirNavegador();
try {
  for (const tema of ['dark', 'light']) {
    const p = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, colorScheme: tema })).newPage());
    await cadastrar(p, 'pc' + tema[0] + Date.now().toString().slice(-5));
    await dispensarPresentes(p);
    await p.evaluate((tm) => document.documentElement.setAttribute('data-theme', tm), tema);
    await p.locator('.rail-logo').click().catch(() => {});
    const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
    await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const abrir = () => quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
    await abrir();
    const tela = p.locator('.monitor-do-quarto');
    await p.locator('.area-de-trabalho').waitFor();
    (await p.locator('.monitor-mesa').count()) === 0 ? ok(tema + ': sem a mesa embaixo do monitor') : falhou('a mesa ainda está lá');
    (await p.locator('.jogos-painel').count()) === 0 ? ok(tema + ': abre na área de trabalho, sem a lista') : falhou('a lista abriu sem o ícone');
    await p.waitForTimeout(300);
    await tela.screenshot({ path: path.join(FOTOS, `computador-${tema}-1-area.png`) });
    await p.locator('[data-icone="mini-games"]').click();
    await p.locator('.janela-retro .jogos-painel .jogos-solo li button').first().waitFor();
    ok(tema + ': o ícone Mini-games abre a janela com a lista');
    await p.waitForTimeout(300);
    await tela.screenshot({ path: path.join(FOTOS, `computador-${tema}-2-janela.png`) });
    await p.locator('.janela-retro-fechar').click();
    (await p.locator('.janela-retro').count()) === 0 && (await p.locator('.area-de-trabalho').count()) === 1 ? ok(tema + ': o ✕ da janela volta à área de trabalho') : falhou('o ✕ não voltou');
    await p.locator('[data-icone="mini-games"]').click();
    await p.keyboard.press('Escape');
    (await p.locator('.janela-retro').count()) === 0 && (await p.locator('.area-de-trabalho').count()) === 1 ? ok(tema + ': o Esc fecha a janela') : falhou('o Esc não fechou a janela');
    await p.keyboard.press('Escape');
    (await p.locator('.monitor-do-quarto').count()) === 0 ? ok(tema + ': o segundo Esc desliga o computador') : falhou('o Esc não desligou');
    await abrir();
    await p.locator('.barra-retro-desligar').click();
    (await p.locator('.monitor-do-quarto').count()) === 0 ? ok(tema + ': o botão de desligar fecha') : falhou('o botão de desligar não fechou');
    await abrir();
    await p.locator('[data-icone="trofeus"]').click();
    await p.waitForTimeout(800);
    (await p.locator('.monitor-do-quarto').count()) === 0 && (await p.getByRole('dialog').count()) > 0 ? ok(tema + ': o ícone Troféus abre os troféus') : falhou('os troféus não abriram');
    await p.context().close();
  }
  // no celular em pé
  const c = vigiar(await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage());
  await cadastrar(c, 'pcm' + Date.now().toString().slice(-5));
  await dispensarPresentes(c);
  await c.locator('.rail-logo').click().catch(() => {});
  const q = await (await c.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await q.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await c.waitForTimeout(800);
  await q.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await c.locator('[data-icone="mini-games"]').click();
  await c.locator('.janela-retro .jogos-painel').waitFor();
  const larga = await c.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  !larga ? ok('celular: sem estouro horizontal') : falhou('celular: estouro horizontal');
  await c.screenshot({ path: path.join(FOTOS, 'computador-celular.png') });
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('tela-do-computador');
}
