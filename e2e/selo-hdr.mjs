// O SELO "HDR corrigido" (27/11/2026; web/src/VoiceStage.tsx, correcaoHdr.ts): a ana transmite (um canvas, NUNCA a tela real) e a bia
// assiste. Com o filtro desligado, nenhum selo; a ana liga o filtro no meio da transmissão e o selo aparece para a bia e para ela
// mesma; ela desliga e o selo some. Fotografa o quadro da bia em e2e/fotos/hdr/.
//
//   node e2e/selo-hdr.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import { mkdirSync } from 'node:fs';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador({ argsExtras: ['--autoplay-policy=no-user-gesture-required'] });
const s = Date.now().toString().slice(-5);
mkdirSync('e2e/fotos/hdr', { recursive: true });

const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      ctx.fillStyle = `hsl(${(n += 5) % 360} 60% 35%)`;
      ctx.fillRect(0, 0, 1280, 720);
    }, 1000 / 15);
    return canvas.captureStream(15);
  };
};

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone', 'camera'] });
  const page = vigiar(await ctx.newPage());
  await page.addInitScript(TELA_FALSA);
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

try {
  const ana = await entrar('ana' + s);
  const bia = await entrar('bia' + s);
  await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await ana.locator('.screenshare-option').first().click();
  await bia.locator('.stream-invite', { hasText: 'ana' + s }).getByRole('button', { name: 'Assistir' }).waitFor({ timeout: 20000 });
  await bia.locator('.stream-invite', { hasText: 'ana' + s }).getByRole('button', { name: 'Assistir' }).click();
  await bia.locator('.stage-focus > .stage-main video[data-lk-source="screen_share"]').waitFor({ timeout: 20000 });
  ok('a ana transmite e a bia assiste');

  const selo = (p) => p.locator('.stream-selo-hdr');
  await bia.waitForTimeout(1500);
  (await selo(bia).count()) === 0 ? ok('filtro desligado: a bia não vê o selo') : falhou('o selo apareceu com o filtro desligado');
  await bia.locator('.stage-focus > .stage-main').screenshot({ path: 'e2e/fotos/hdr/selo-1-desligado.png' });

  // a ana liga o filtro no meio da transmissão, pelas Configurações
  await ana.locator('button[aria-label="Configurações"]').first().click();
  await ana.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
  await ana.locator('.filtro-hdr').waitFor({ timeout: 10000 });
  await ana.locator('.filtro-hdr .toggle-row').click();
  await selo(bia).first().waitFor({ timeout: 15000 });
  ok('ligou o filtro: o selo aparece para a bia');
  (await selo(bia).first().innerText()).includes('HDR corrigido') ? ok('o selo diz "HDR corrigido"') : falhou('texto do selo: ' + (await selo(bia).first().innerText()));
  await bia.locator('.stage-focus > .stage-main').screenshot({ path: 'e2e/fotos/hdr/selo-2-ligado.png' });

  await ana.keyboard.press('Escape');
  await ana.locator('.filtro-hdr').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  (await selo(ana).count()) > 0 ? ok('a ana também vê o selo no próprio quadro') : falhou('a ana não vê o selo no próprio quadro');
  await ana.locator('.stage').first().screenshot({ path: 'e2e/fotos/hdr/selo-3-quadro-da-ana.png' }).catch(() => {});

  // desliga: o selo some
  await ana.locator('button[aria-label="Configurações"]').first().click();
  await ana.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
  await ana.locator('.filtro-hdr .toggle-row').click();
  await selo(bia).first().waitFor({ state: 'detached', timeout: 15000 });
  ok('desligou o filtro: o selo some');
} catch (e) {
  falhou('exceção: ' + e.message);
} finally {
  await browser.close();
  resumo();
}
