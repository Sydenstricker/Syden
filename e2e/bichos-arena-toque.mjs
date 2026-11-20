// A ARENA NO CELULAR (20/11/2026), numa tela de iPhone (390 px), no Solo contra um robô.
//
// - A largada mostra os cenários em figuras ("?" sorteado de fábrica); a Lia escolhe o 2 (a praia), e a partida vem nela.
// - Tocar o Q sem arrastar mira no adversário visível mais perto (antes, a mira congelava no último ponto).
// - Segurar o Q e arrastar para cima mira para cima (a linha aparece), e soltar dispara.
//
//   node e2e/bichos-arena-toque.mjs   (API de teste e site de desenvolvimento; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

const { browser } = await abrirNavegador();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const lia = vigiar(await ctx.newPage());
  await cadastrar(lia, 'liaa' + s);
  await dispensarPresentes(lia);
  await lia.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await lia.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await lia.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await lia.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = lia.locator('.jogos-painel');
  await painel.waitFor();
  const escolha = lia.locator('.arena-escolha');
  for (let i = 0; i < 4 && !(await escolha.isVisible()); i++) {
    await painel.locator('.jogos-solo button', { hasText: 'Bichos da Toca' }).click().catch(() => {});
    await lia.waitForTimeout(3000);
  }
  await escolha.waitFor({ timeout: 10000 });
  await escolha.locator('.arena-modos button', { hasText: 'Arena' }).click();
  const cenarios = escolha.locator('.arena-cenario');
  (await cenarios.count()) === 5 ? ok('a largada mostra o sorteado e os quatro cenários') : falhou(`cenários: ${await cenarios.count()}`);
  (await cenarios.first().getAttribute('aria-checked')) === 'true' ? ok('o sorteado vem escolhido de fábrica') : falhou('o sorteado não é o de fábrica');
  await cenarios.nth(2).tap();
  await lia.locator('.minijogo').screenshot({ path: path.join(FOTOS, 'bichos-arena-toque-largada.png') });
  const largura = await lia.evaluate(() => document.documentElement.scrollWidth);
  largura <= 390 ? ok('a largada cabe em 390 px') : falhou(`estouro horizontal: ${largura}px`);
  await escolha.locator('button[aria-label="1 × 1"]').tap();
  await lia.locator('.arena .briga-tela canvas').waitFor({ timeout: 15000 });
  await lia.waitForFunction(() => window.arenaMiraDoTeste && document.querySelectorAll('.arena .briga-hud li').length === 2, null, { timeout: 15000 });
  const cenario = await lia.evaluate(() => window.arenaMiraDoTeste.cenario);
  cenario === 'praia' ? ok('a partida veio no cenário escolhido (praia)') : falhou(`o cenário veio ${cenario}`);
  await lia.waitForTimeout(1500);

  // o primeiro toque na arena (o manche) revela os botões e liga a mira do toque
  const tela = await lia.locator('.arena-toque').boundingBox();
  await lia.touchscreen.tap(tela.x + 30, tela.y + tela.height - 30);
  await lia.waitForTimeout(400);
  const mira = await lia.evaluate(() => window.arenaMiraDoTeste);
  const robo = await lia.evaluate(() => [...document.querySelectorAll('.arena .briga-hud li')].length);
  mira.alvoX !== null ? ok(`sem dedo mirando, a mira vai no adversário (${Math.round(mira.alvoX)}, ${Math.round(mira.alvoY)}; eu em ${Math.round(mira.x)}, ${Math.round(mira.y)})`) : falhou(`a mira ficou vazia (${robo} na arena)`);

  // segurar o Q e arrastar para cima: a mira sobe; soltar dispara
  const cdp = await ctx.newCDPSession(lia);
  const e = await lia.locator('.arena-toque-botoes button', { hasText: 'E' }).boundingBox();
  const q = await lia.locator('.arena-toque-botoes button', { hasText: 'Q' }).boundingBox();
  const bx = q.x + q.width / 2, by = q.y + q.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 7, x: bx, y: by }] });
  for (let k = 1; k <= 6; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 7, x: bx, y: by - k * 12 }] });
    await lia.waitForTimeout(30);
  }
  await lia.waitForTimeout(150);
  const arrastando = await lia.evaluate(() => window.arenaMiraDoTeste);
  await lia.locator('.arena').first().screenshot({ path: path.join(FOTOS, 'bichos-arena-toque-mira.png') });
  arrastando.alvoY !== null && arrastando.alvoY < arrastando.y - 40 && Math.abs(arrastando.alvoX - arrastando.x) < 20
    ? ok(`arrastar o Q para cima mira para cima (alvo ${Math.round(arrastando.alvoX)}, ${Math.round(arrastando.alvoY)})`)
    : falhou(`a mira do arraste: ${JSON.stringify(arrastando)}`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await lia.waitForTimeout(300);
  ok(`o botão E existe (${Math.round(e.width)} px)`);
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo();
}
