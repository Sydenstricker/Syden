// O CELULAR COMO CÂMERA PELAS CONFIGURAÇÕES, NO APP (23/11/2026, pedido dele: "aqui já poderia ter um botão para usar o
// celular como câmera"). O botão mora embaixo da prévia do Syden Broadcast, que só existe no app.
//   - FORA DE UMA CHAMADA: Configurações → Voz e vídeo → "Usar o celular como câmera" abre o QR code por cima das
//     Configurações; o "celular" (um Chromium com uma câmera EM PÉ de canvas) abre o endereço; a prévia acende sozinha e
//     mostra a imagem dele (em pé);
//   - entrando numa sala, a imagem do celular entra como a câmera, sem ligar a webcam;
//   - o botão, aceso, desliga o celular.
//
//   API de teste na 3099, site na 5174 e LiveKit local (npm run dev:livekit)
//   node e2e/celular-nas-configuracoes-no-app.mjs
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { abrirNavegador, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const API = 'http://localhost:3099';
const pasta = mkdtempSync(join(tmpdir(), 'syden-celular-'));
const pedir = async (metodo, rota, token, corpo) => {
  const res = await fetch(API + rota, { method: metodo, headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(metodo + ' ' + rota + ': ' + res.status + ' ' + JSON.stringify(j));
  return j;
};
const nome = 'cel' + Date.now().toString(36).slice(-6);
await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
const { token } = await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' });
const comunidade = await pedir('POST', '/api/communities', token, { name: 'Cel ' + nome.slice(-4) });

const env = { ...process.env, SYDEN_URL: 'http://localhost:5174/app/', SYDEN_PASTA_DE_DADOS: join(pasta, 'dados') };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  executablePath: resolve('node_modules/electron/dist/electron.exe'),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', resolve('desktop')],
  env,
});
const page = vigiar(await app.firstWindow());
await app.context().addInitScript((tk) => localStorage.setItem('janja.token', tk), token);
await page.waitForLoadState('domcontentloaded');
await page.reload();
await page.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).click({ timeout: 60000 });
for (let i = 0; i < 6; i++) {
  const f = page.getByRole('button', { name: 'Fechar', exact: true });
  if (await f.first().isVisible().catch(() => false)) await f.first().click();
  else if (i > 2) break;
  await page.waitForTimeout(600);
}

const { browser: navegador } = await abrirNavegador();
try {
  // ---------- fora de uma chamada ----------
  await page.locator('button[aria-label="Configurações"]').first().click();
  await page.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
  const botao = page.locator('.previa-da-camera button', { hasText: 'Usar o celular como câmera' });
  (await botao.waitFor({ timeout: 15000 }).then(() => true, () => false)) ? ok('o botão do celular está embaixo da prévia') : falhou('o botão do celular não apareceu nas Configurações');
  await botao.click();
  const qr = page.locator('.celular-como-camera .celular-qr');
  (await qr.waitFor({ timeout: 10000 }).then(() => true, () => false)) ? ok('o QR code abre por cima das Configurações') : falhou('o QR code não abriu');
  const endereco = await qr.getAttribute('aria-label');

  const cel = vigiar(await (await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['camera'] })).newPage());
  await cel.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas');
      c.width = 360;
      c.height = 640;
      const g = c.getContext('2d');
      let n = 0;
      setInterval(() => {
        g.fillStyle = 'hsl(' + ((n += 7) % 360) + ' 70% 50%)';
        g.fillRect(0, 0, 360, 640);
      }, 66);
      return c.captureStream(15);
    };
  });
  await cel.goto(endereco);
  (await cel.locator('.camera-do-celular-estado.ao-vivo').waitFor({ timeout: 20000 }).then(() => true, () => false))
    ? ok('o celular liga ao computador fora de uma chamada')
    : falhou('o celular não ficou ao vivo');
  (await page.locator('.celular-como-camera').waitFor({ state: 'detached', timeout: 10000 }).then(() => true, () => false))
    ? ok('e a janela do QR code sai da frente')
    : falhou('a janela do QR code ficou aberta');
  const previa = await page
    .waitForFunction(() => {
      const v = document.querySelector('.previa-da-camera video');
      return v && v.videoHeight > v.videoWidth && v.videoWidth > 0;
    }, null, { timeout: 15000 })
    .then(() => true, () => false);
  previa ? ok('a prévia acende sozinha com a imagem do celular (em pé)') : falhou('a prévia não mostrou o celular');
  (await page.locator('.previa-da-camera button[aria-pressed="true"]', { hasText: 'Usar o celular como câmera' }).count()) === 1
    ? ok('o botão do celular fica aceso')
    : falhou('o botão do celular não acendeu');
  await page.screenshot({ path: 'e2e/fotos/celular-nas-configuracoes.png' });

  // ---------- entrando numa chamada ----------
  await page.keyboard.press('Escape');
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  const publicada = await page
    .waitForFunction(() => [...document.querySelectorAll('video[data-lk-source="camera"]')].some((v) => v.videoHeight > v.videoWidth && v.videoWidth > 0), null, { timeout: 20000 })
    .then(() => true, () => false);
  publicada ? ok('entrando na sala, a imagem do celular entra como a câmera') : falhou('a imagem do celular não entrou na chamada');
  (await page.locator('.stage-controls button[aria-label="Desligar câmera"]').count()) === 1 ? ok('com o botão da câmera aceso') : falhou('o botão da câmera não acendeu');

  // ---------- o botão, aceso, desliga ----------
  await page.locator('button[aria-label="Configurações"]').first().click();
  await page.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
  await page.locator('.previa-da-camera button[aria-pressed="true"]', { hasText: 'Usar o celular como câmera' }).click();
  await page.keyboard.press('Escape');
  (await page.locator('.stage-controls button[aria-label="Ligar câmera"]').waitFor({ timeout: 10000 }).then(() => true, () => false))
    ? ok('o botão aceso desliga o celular, e a câmera sai da chamada')
    : falhou('desligar pelo botão não tirou a câmera da chamada');
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  await navegador.close();
  await app.close();
  rmSync(pasta, { recursive: true, force: true });
  resumo('o celular como câmera pelas Configurações, no app');
}
