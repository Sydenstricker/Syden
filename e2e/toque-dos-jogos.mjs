// OS CONTROLES DE TOQUE E A PAUSA DOS JOGOS SOLO (20/11/2026, a segunda auditoria dos mini-games), num iPhone simulado (390 px).
//
// - O Rolê do coelho no TREINO LIVRE: a alavanca e os quatro botões aparecem; a alavanca empurrada para a frente anda; sem relógio.
// - A pausa (ESC) mostra Continuar, Jogar de novo (R) e Sair; R recomeça do zero; Sair volta à escolha da pista.
// - A Gincana: a alavanca na DIAGONAL liga FRENTE e um lado juntos (o coelho anda em x e em z).
//
//   SITE=http://localhost:5174 node e2e/toque-dos-jogos.mjs   (API de teste e site de desenvolvimento)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

/** Arrasta o "dedo" (o ponteiro) do meio do elemento até (dx, dy) do meio, e o segura lá. */
async function empurrar(pagina, seletor, dx, dy) {
  const caixa = await pagina.locator(seletor).first().boundingBox();
  const cx = caixa.x + caixa.width / 2;
  const cy = caixa.y + caixa.height / 2;
  await pagina.mouse.move(cx, cy);
  await pagina.mouse.down();
  await pagina.mouse.move(cx + dx, cy + dy, { steps: 4 });
}

async function abrirSolo(pagina, nome) {
  await pagina.locator('.rail-logo').click();
  const quarto = await (await pagina.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await pagina.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await pagina.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = pagina.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: nome }).click();
}

const { browser } = await abrirNavegador();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const lia = vigiar(await ctx.newPage());
  await cadastrar(lia, 'toque' + s);
  await dispensarPresentes(lia);

  // ---- o Rolê, treino livre ----
  await abrirSolo(lia, 'Rolê do coelho');
  await lia.locator('.skate-escolha').waitFor({ timeout: 15000 });
  await lia.getByRole('button', { name: 'Treino livre' }).click();
  await lia.locator('.skate-caixa:not(.escondida)').waitFor({ timeout: 30000 });
  (await lia.locator('.skate-toque .alavanca-dos-jogos').count()) === 1 && (await lia.locator('.skate-toque [data-toque]').count()) === 4
    ? ok('no celular, o Rolê tem a alavanca e os quatro botões')
    : falhou('sem os controles de toque no Rolê');
  (await lia.locator('.skate-relogio').count()) === 0 ? ok('o treino livre não tem relógio') : falhou('o treino livre mostra o relógio');
  await lia.waitForFunction(() => (window.skateSessaoDoTeste?.passo ?? 0) > 0, null, { timeout: 10000 });
  const antes = await lia.evaluate(() => ({ x: window.skateSessaoDoTeste.x, z: window.skateSessaoDoTeste.z }));
  await empurrar(lia, '.skate-toque .alavanca-dos-jogos', 0, -50);
  await lia.waitForTimeout(1500);
  await lia.locator('.skate-moldura').screenshot({ path: path.join(FOTOS, 'toque-skate-390.png') });
  await lia.mouse.up();
  const depois = await lia.evaluate(() => ({ x: window.skateSessaoDoTeste.x, z: window.skateSessaoDoTeste.z }));
  Math.hypot(depois.x - antes.x, depois.z - antes.z) > 0.5 ? ok('a alavanca para a frente faz o skate andar') : falhou(`não andou: ${JSON.stringify([antes, depois])}`);

  // ---- a pausa: Continuar, Jogar de novo (R), Sair ----
  await lia.keyboard.press('Escape');
  await lia.locator('.pausa-do-jogo').waitFor();
  (await lia.locator('.pausa-do-jogo button').count()) === 3 ? ok('a pausa tem Continuar, Jogar de novo e Sair') : falhou('a pausa sem os três botões');
  await lia.locator('.skate-moldura').screenshot({ path: path.join(FOTOS, 'toque-pausa-390.png') });
  const passoAntes = await lia.evaluate(() => window.skateSessaoDoTeste.passo);
  await lia.keyboard.press('r');
  await lia.waitForFunction((p) => window.skateSessaoDoTeste && window.skateSessaoDoTeste.passo < p, passoAntes, { timeout: 30000 });
  (await lia.locator('.pausa-do-jogo').count()) === 0 ? ok('R recomeça do zero, sem a pausa') : falhou('a pausa ficou depois do R');
  await lia.locator('.skate-caixa:not(.escondida)').waitFor({ timeout: 30000 });
  await lia.keyboard.press('Escape');
  await lia.getByRole('button', { name: 'Sair' }).click();
  await lia.locator('.skate-escolha').waitFor({ timeout: 10000 });
  ok('Sair volta à escolha da pista');
  await lia.keyboard.press('Escape');
  await lia.waitForTimeout(500);

  // ---- a Gincana: a diagonal ----
  const lia2 = vigiar(await ctx.newPage());
  await lia2.goto(lia.url());
  await dispensarPresentes(lia2);
  await abrirSolo(lia2, 'Gincana da toca');
  await lia2.locator('.gincana-escolha').waitFor({ timeout: 15000 });
  await lia2.getByRole('button', { name: 'Começar' }).click();
  await lia2.locator('.gincana-caixa:not(.escondida)').waitFor({ timeout: 30000 });
  await lia2.waitForFunction(() => (window.gincanaDoTeste?.passo ?? 0) > 0, null, { timeout: 15000 });
  const g0 = await lia2.evaluate(() => ({ x: window.gincanaDoTeste.x, z: window.gincanaDoTeste.z }));
  await empurrar(lia2, '.gincana-toque .alavanca-dos-jogos', 35, -35);
  await lia2.waitForTimeout(400);
  await lia2.locator('.gincana-moldura').screenshot({ path: path.join(FOTOS, 'toque-gincana-390.png') });
  await lia2.mouse.up();
  const g1 = await lia2.evaluate(() => ({ x: window.gincanaDoTeste.x, z: window.gincanaDoTeste.z }));
  Math.abs(g1.x - g0.x) > 0.1 && g1.z - g0.z > 0.1 ? ok('a alavanca na diagonal anda para a frente e para o lado juntos') : falhou(`diagonal: ${JSON.stringify([g0, g1])}`);
} finally {
  await browser.close();
}
resumo();
