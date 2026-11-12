// A GRADE QUE ENCHE O PALCO NUM MONITOR EM PÉ (12/11/2026; ver web/src/gradeDoPalco.ts). A Ana e a Cid transmitem (um
// canvas, NUNCA a tela real); a Bia, numa janela em pé de 1080 × 1920, abre as duas. No lado a lado e no "todos do mesmo
// tamanho", os quadros têm de EMPILHAR e ocupar a largura, em vez de uma fileira estreita no meio de uma tela preta.
//
//   node e2e/grade-em-pe.mjs   (API de teste na 3099, site na 5174 e LiveKit local)

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

async function entrar(nome, W = 1400, H = 900) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, permissions: ['microphone'] });
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
const bia = await entrar('bia' + s, 1080, 1920);
try {
  await transmitir(ana);
  await transmitir(cid);
  for (const quem of ['ana', 'cid']) {
    const convite = bia.locator('.stream-invite', { hasText: quem + s });
    await convite.waitFor({ timeout: 20000 });
    await convite.getByRole('button', { name: 'Assistir' }).click();
  }
  await bia.locator('.stage-main video').first().waitFor({ timeout: 20000 });
  ok('a Bia, com a janela em pé, abriu as duas transmissões');

  const quadros = () =>
    bia.locator('.stage-split > .stage-main').evaluateAll((els) => els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }));

  await bia.locator('.stage-controls button[aria-label^="Ver as 2 transmissões"]').click();
  await bia.waitForTimeout(800);
  const largura = await bia.locator('.stage-split').evaluate((el) => el.clientWidth);
  let q = await quadros();
  q.length === 2 && q[1].y > q[0].y + q[0].h - 2 && q[0].w > largura * 0.9
    ? ok(`lado a lado: as duas empilham e ocupam a largura (${q[0].w}×${q[0].h} cada)`)
    : falhou(`lado a lado: ${JSON.stringify(q)} numa grade de ${largura}`);

  await bia.locator('.stage-controls button[aria-label="Todos do mesmo tamanho"]').click();
  await bia.waitForTimeout(800);
  q = await quadros();
  const colunas = new Set(q.map((r) => r.x)).size;
  const fundo = await bia.locator('.stage-split').evaluate((el) => el.getBoundingClientRect().bottom);
  q.length >= 3 && colunas <= 2 && q.every((r) => r.y + r.h <= fundo + 1) && q[0].w > largura * 0.4
    ? ok(`todos do mesmo tamanho: ${q.length} quadros em ${colunas} coluna(s), ${q[0].w}×${q[0].h}, sem rolar`)
    : falhou(`mosaico: ${JSON.stringify(q)} numa grade de ${largura}`);
  await bia.screenshot({ path: 'e2e/fotos/grade-em-pe.png' });
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('a grade que enche o palco num monitor em pé');
}
