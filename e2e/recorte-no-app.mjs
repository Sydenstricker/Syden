// O RECORTE DE QUALQUER FUNDO NO APP (desktop/src/recorte, 04/11/2026), de ponta a ponta: o app de desktop, com o modelo DENTRO
// dele, abre a prévia de uma figurinha com uma FOTO e ela já sai recortada pelo modelo, sem aviso e sem pedir nada.
//
// Precisa do servidor de teste na 3099 e do site na 5174 (e2e/LEIA.md), do modelo em desktop/recorte-modelo/
// (node desktop/scripts/baixar-recorte.js) e das fotos do teste de recorte (node e2e/recorte-de-fundo/baixar.mjs).
//
//   node e2e/recorte-no-app.mjs
//   EMPACOTADO=1 node e2e/recorte-no-app.mjs   (o app como vai para as pessoas: desktop/release/win-unpacked, gerado com
//                                               `npx electron-builder --win --dir --projectDir desktop`)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron } from 'playwright-core';
import { criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const GATO = path.join('e2e', 'recorte-de-fundo', 'imagens', 'Cat03.jpg');
if (!fs.existsSync(GATO)) throw new Error('Falta a foto do teste: rode node e2e/recorte-de-fundo/baixar.mjs');
const EMPACOTADO = Boolean(process.env.EMPACOTADO);
const ELECTRON = EMPACOTADO ? path.resolve('desktop/release/win-unpacked/Syden.exe') : path.resolve('node_modules/electron/dist/electron.exe');

const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'syden-app-recorte-'));
const env = { ...process.env, SYDEN_URL: process.env.SITE_DO_APP ?? 'http://localhost:5174/app/', SYDEN_PASTA_DE_DADOS: dados };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ executablePath: ELECTRON, args: EMPACOTADO ? [] : [path.resolve('desktop')], env });
const page = vigiar(await app.firstWindow());
if (process.env.DEPURAR) {
  app.process().stdout?.on('data', (d) => process.stdout.write('   [main] ' + d));
  app.process().stderr?.on('data', (d) => process.stdout.write('   [main!] ' + d));
}
await page.waitForLoadState('domcontentloaded');

await criarConta(page, 'recorte');
await dispensarPresentes(page);
await page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await page.getByText('Criar a minha').click();
await page.getByLabel('Nome da comunidade').fill('Recorte ' + Date.now().toString().slice(-4));
await page.locator('.dialog .btn-primary').click();
await page.locator('.channel-name', { hasText: /geral/ }).first().click();

(await page.evaluate(() => window.sydenDesktop?.recorte?.disponivel())) ? ok(`o app ${EMPACOTADO ? 'empacotado ' : ''}tem o recorte, com o modelo dentro dele`) : falhou('o app diz que não tem o recorte');

// abrir as figurinhas já começa a abrir o modelo
await page.locator('button[aria-label="Figurinhas"]').click();
await page.locator('.figurinhas-seletor').waitFor({ timeout: 5000 });
const inicio = Date.now();
await page.locator('.figurinhas-seletor input[type=file]').setInputFiles(GATO);
await page.locator('.figurinhas-previa-figura img').waitFor({ timeout: 60_000 });
ok(`a prévia da foto saiu em ${((Date.now() - inicio) / 1000).toFixed(1)} s (contando abrir o modelo)`);
(await page.locator('.figurinhas-previa-aviso').count()) === 0 ? ok('sem aviso: o fundo da foto saiu') : falhou(`apareceu um aviso: ${await page.locator('.figurinhas-previa-aviso').innerText()}`);
const canto = await page.evaluate(async () => {
  const img = document.querySelector('.figurinhas-previa-figura img');
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(2, 2, 1, 1).data[3];
});
canto === 0 ? ok('o canto da figurinha ficou transparente') : falhou(`o canto ficou com transparência ${canto}`);
await page.screenshot({ path: path.join(FOTOS, 'recorte-no-app.png') });

// a segunda já não espera abrir o modelo
await page.locator('.figurinhas-previa .btn-secondary').click();
const segunda = Date.now();
await page.locator('.figurinhas-seletor input[type=file]').setInputFiles(GATO);
await page.locator('.figurinhas-previa-figura img').waitFor({ timeout: 30_000 });
ok(`a segunda imagem saiu em ${((Date.now() - segunda) / 1000).toFixed(1)} s`);
await page.locator('.figurinhas-previa .btn-primary').click();
await page.locator('.figurinhas-figura img').first().waitFor({ timeout: 15000 });
ok('a figurinha recortada entrou na coleção');

await app.close();
fs.rmSync(dados, { recursive: true, force: true });
resumo('recorte no app');
