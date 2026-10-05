// "Com tecnologia GTCRN" / "Com tecnologia DPDFNet": Configurações diz qual modelo faz a supressão de
// ruído, como o Discord diz que a dele é do Krisp. Pedido do Sydenstricker em 05/10/2026.
//
// No navegador tem de aparecer o GTCRN; no app (que tem o processo nativo), o DPDFNet. E desligando a
// supressão, a linha some: não se anuncia um modelo que não está rodando.
//
//   node e2e/supressao-com-nome.mjs        (site em http://localhost:5174, app de desenvolvimento)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron } from 'playwright-core';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

async function conferir(page, onde, esperado) {
  await page.locator('button[aria-label="Configurações"]').first().click();
  await page.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
  const nota = page.locator('.toggle-nota');
  await nota.waitFor({ timeout: 10000 }).catch(() => {});
  const texto = (await nota.count()) ? (await nota.innerText()).trim() : null;
  await nota.scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: `e2e/fotos/supressao-com-nome-${onde}.png` });
  texto === `Com tecnologia ${esperado}` ? ok(`${onde}: "${texto}"`) : falhou(`${onde}: esperava "Com tecnologia ${esperado}", veio ${JSON.stringify(texto)}`);
  await page.locator('.toggle-row', { hasText: 'Supressão de ruído' }).locator('.switch').click();
  await page.waitForTimeout(500);
  (await page.locator('.toggle-nota').count()) === 0 ? ok(`${onde}: com a supressão desligada, o nome some`) : falhou(`${onde}: o nome continua com a supressão desligada`);
  await page.locator('.toggle-row', { hasText: 'Supressão de ruído' }).locator('.switch').click();
}

const { browser } = await abrirNavegador();
const site = vigiar(await browser.newPage());
await criarConta(site, 'nomesite');
await dispensarPresentes(site);
await conferir(site, 'navegador', 'GTCRN');
await browser.close();

const env = { ...process.env, SYDEN_URL: 'http://localhost:5174/app/', SYDEN_PASTA_DE_DADOS: fs.mkdtempSync(path.join(os.tmpdir(), 'syden-app-teste-')) };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ executablePath: path.resolve('node_modules/electron/dist/electron.exe'), args: [path.resolve('desktop')], env });
const janela = vigiar(await app.firstWindow());
await criarConta(janela, 'nomeapp');
await dispensarPresentes(janela);
await conferir(janela, 'app', 'DPDFNet');
await app.close();

resumo('O nome do modelo da supressão');
