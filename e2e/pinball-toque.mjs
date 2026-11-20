// O PINBALL NO CELULAR (20/11/2026): o MULTITOQUE e o TRANCO pelo toque, numa tela de iPhone (390 px).
//
// - Um dedo na metade esquerda e outro na direita seguram as DUAS palhetas; levantar o da esquerda solta só a esquerda.
// - O botão do tranco aparece depois do primeiro toque na mesa, e um toque nele sacode (o tremor da mesa sobe).
// - O canto de baixo à direita puxa a mola.
//
//   node e2e/pinball-toque.mjs   (API de teste e site de desenvolvimento; não precisa do LiveKit)
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
  await cadastrar(lia, 'liat' + s);
  await dispensarPresentes(lia);
  await lia.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await lia.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await lia.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await lia.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = lia.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Pinball da Horta' }).click();
  // no celular a lista pode demorar a responder (a conexão do socket ainda subindo): tenta de novo
  for (let i = 0; i < 3 && !(await lia.locator('.pinball-escolha').isVisible()); i++) {
    await lia.waitForTimeout(3000);
    if (!(await lia.locator('.pinball-escolha').isVisible())) await painel.locator('.jogos-solo button', { hasText: 'Pinball da Horta' }).click().catch(() => {});
  }
  await lia.locator('.pinball-escolha').waitFor({ timeout: 10000 });
  await lia.getByRole('button', { name: 'Começar' }).click();
  const tela = lia.locator('.pinball-tela');
  await tela.waitFor({ timeout: 10000 });
  await lia.waitForFunction(() => !!window.pinballDoTeste, null, { timeout: 10000 });
  await lia.waitForTimeout(3500); // a contagem

  const r = await tela.boundingBox();
  const cdp = await ctx.newCDPSession(lia);
  const dedo = (id, fx, fy) => ({ id, x: r.x + r.width * fx, y: r.y + r.height * fy });
  const toque = (type, pontos) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pontos });
  const mesa = () => lia.evaluate(() => ({ esq: window.pinballDoTeste.esq, dir: window.pinballDoTeste.dir, tremor: window.pinballDoTeste.tremor, carga: window.pinballDoTeste.carga }));

  // os dois polegares
  const esq = dedo(1, 0.2, 0.85), dir = dedo(2, 0.75, 0.85);
  await toque('touchStart', [esq]);
  await toque('touchStart', [esq, dir]);
  await lia.waitForTimeout(250);
  let m = await mesa();
  if (m.esq > 15 && m.dir > 15) ok(`dois dedos seguram as duas palhetas (esq ${m.esq}, dir ${m.dir})`);
  else falhou(`as duas palhetas não subiram com dois dedos: ${JSON.stringify(m)}`);
  await lia.locator('.pinball').first().screenshot({ path: path.join(FOTOS, 'pinball-toque-dois-dedos.png') });
  // levanta o da esquerda: só a esquerda desce (no touchEnd do CDP, os pontos listados são os que saem)
  await toque('touchEnd', [esq]);
  await lia.waitForTimeout(250);
  m = await mesa();
  if (m.esq < 5 && m.dir > 15) ok('levantar o dedo da esquerda soltou só a esquerda');
  else falhou(`levantar um dedo mexeu na outra palheta: ${JSON.stringify(m)}`);
  await toque('touchEnd', []);
  await lia.waitForTimeout(200);

  // o tranco
  const botao = lia.locator('.pinball-tranco');
  if (await botao.isVisible()) ok('o botão do tranco apareceu depois do toque');
  else falhou('o botão do tranco não apareceu');
  const antes = (await mesa()).tremor;
  await botao.tap();
  await lia.waitForTimeout(80);
  const depois = (await mesa()).tremor;
  if (depois > antes) ok(`o tranco no toque sacudiu a mesa (tremor ${antes} → ${depois})`);
  else falhou(`o tranco não sacudiu: ${antes} → ${depois}`);

  // a mola: o canto de baixo à direita
  const mola = dedo(3, 0.95, 0.9);
  await toque('touchStart', [mola]);
  await lia.waitForTimeout(400);
  m = await mesa();
  await toque('touchEnd', []);
  if (m.carga > 0) ok(`segurar o canto puxa a mola (carga ${m.carga})`);
  else falhou('a mola não carregou no toque');

  const largura = await lia.evaluate(() => document.documentElement.scrollWidth);
  if (largura <= 390) ok('sem estouro horizontal a 390 px');
  else falhou(`estouro horizontal: ${largura}px`);
  await lia.locator('.pinball').first().screenshot({ path: path.join(FOTOS, 'pinball-toque.png') });
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo();
}
