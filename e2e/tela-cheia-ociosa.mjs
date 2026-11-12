// NA TELA CHEIA, OS CONTROLES SOMEM COM O MOUSE PARADO (12/11/2026; ver web/src/telaCheiaOciosa.ts). O que o teste prova:
//
// 1. Fora da tela cheia, nada some, por mais que o mouse fique parado.
// 2. Em tela cheia, 3 s parado apagam a barra da chamada e o botão de tela cheia, e o cursor some.
// 3. Mexer o mouse traz tudo de volta na hora.
// 4. Com o mouse em cima da barra, nada some.
//
//   node e2e/tela-cheia-ociosa.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

const opacidade = (page, seletor) => page.locator(seletor).first().evaluate((el) => Number(getComputedStyle(el).opacity));
const ocioso = (page) => page.locator('.stage').evaluate((el) => el.hasAttribute('data-ocioso'));

try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const ana = vigiar(await ctx.newPage());
  await cadastrar(ana, 'ana' + s);
  await dispensarPresentes(ana);
  await ana.locator('.rail-list .rail-item').first().click();
  await ana.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await ana.locator('.stage-controls').waitFor({ timeout: 30000 });
  ok('a Ana entrou na Sala 2');

  await ana.mouse.move(700, 300);
  await ana.waitForTimeout(4000);
  (await ocioso(ana)) ? falhou('fora da tela cheia, os controles sumiram') : ok('fora da tela cheia, 4 s parado não esconde nada');

  await ana.locator('.stage').hover();
  await ana.locator('.stage > .fullscreen-button').click();
  await ana.waitForFunction(() => document.fullscreenElement?.classList.contains('stage'), null, { timeout: 5000 });
  ok('o palco entrou em tela cheia');

  await ana.mouse.move(700, 300);
  await ana.waitForTimeout(1500);
  (await ocioso(ana)) ? falhou('sumiu antes dos 3 s') : ok('com 1,5 s parado, os controles continuam');
  await ana.waitForTimeout(2500);
  const barra = await opacidade(ana, '.stage-controls');
  const cursor = await ana.locator('.stage').evaluate((el) => getComputedStyle(el).cursor);
  (await ocioso(ana)) && barra < 0.05 && cursor === 'none'
    ? ok('depois de 3 s parado, a barra da chamada e o cursor somem')
    : falhou(`depois de 3 s: ocioso=${await ocioso(ana)}, barra=${barra}, cursor=${cursor}`);

  await ana.mouse.move(720, 320);
  await ana.waitForTimeout(400);
  const volta = await opacidade(ana, '.stage-controls');
  !(await ocioso(ana)) && volta > 0.95 ? ok('mexer o mouse traz tudo de volta') : falhou(`depois de mexer: barra=${volta}`);

  const caixa = await ana.locator('.stage-controls').boundingBox();
  await ana.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await ana.waitForTimeout(4500);
  (await ocioso(ana)) ? falhou('com o mouse em cima da barra, ela sumiu') : ok('com o mouse em cima da barra, nada some');

  // O Esc da tela cheia é do navegador e não chega no Chrome de teste: sai pelo botão, que é o caminho da página.
  await ana.locator('.stage > .fullscreen-button').click();
  await ana.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5000 });
  (await ocioso(ana)) ? falhou('saiu da tela cheia e os controles continuaram escondidos') : ok('ao sair da tela cheia, tudo volta');
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('os controles da tela cheia somem com o mouse parado');
}
