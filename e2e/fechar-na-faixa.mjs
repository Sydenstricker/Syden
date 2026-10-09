// O X das transmissões na faixa de baixo (pedido de 08/10/2026).
//
// Quem abria uma segunda transmissão via a primeira continuar rodando pequena, na faixa de baixo, baixando vídeo; o
// único jeito de fechá-la era trazê-la para o quadro grande. Agora a transmissão aberta na faixa tem um X.
// A ana e a cid transmitem (um canvas, NUNCA a tela real); a bia abre as duas. Uma fica grande, a outra vai para a
// faixa. A bia clica no X da faixa: aquela volta a ser convite, e a grande continua aberta.

import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

/** No lugar da tela real: um canvas que mexe. */
const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      n++;
      ctx.fillStyle = `hsl(${(n * 3) % 360} 60% 30%)`;
      ctx.fillRect(0, 0, 1280, 720);
    }, 1000 / 15);
    return canvas.captureStream(15);
  };
};

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  vigiar(page);
  await page.addInitScript(TELA_FALSA);
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

async function transmitir(page) {
  await page.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await page.locator('.screenshare-option').first().click();
  await page.locator('.stage-main video').first().waitFor({ timeout: 20000 });
}

const ana = await entrar('ana' + s);
const cid = await entrar('cid' + s);
const bia = await entrar('bia' + s);
await transmitir(ana);
await transmitir(cid);
ok('a ana e a cid estão transmitindo');

for (const quem of ['ana', 'cid']) {
  const convite = bia.locator('.stream-invite', { hasText: quem + s });
  await convite.waitFor({ timeout: 20000 });
  await convite.getByRole('button', { name: 'Assistir' }).click();
}
await bia.locator('.stage-main video').first().waitFor({ timeout: 20000 });
ok('a bia abriu as duas');

const xs = bia.locator('.stage-strip .tile-fechar');
await xs.first().waitFor({ timeout: 10000 }).catch(() => {});
const quantos = await xs.count();
quantos === 1 ? ok('a transmissão que foi para a faixa tem um X') : falhou(`esperava 1 X na faixa, há ${quantos}`);

// O X precisa estar à vista, e não escondido por cima de outra coisa.
const visivel = await xs.first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.tile-fechar') === el;
});
visivel ? ok('e ele está à vista') : falhou('o X está coberto por outra coisa');

await xs.first().click();
await bia.locator('.stage-strip .stream-invite').first().waitFor({ timeout: 10000 });
ok('ao clicar no X, aquela transmissão voltou a ser convite');
(await bia.locator('.stage-main video').count()) > 0
  ? ok('e a do quadro grande continua aberta')
  : falhou('fechar a da faixa fechou também a grande');

await bia.screenshot({ path: 'e2e/fotos/fechar-na-faixa.png' });
await browser.close();
resumo('fechar-na-faixa');
