// O RECORTE DE QUALQUER FUNDO NO APP (desktop/src/recorte, 04/11/2026), de ponta a ponta: o app de desktop abre a prévia de uma
// figurinha com uma FOTO, oferece baixar o recorte (dizendo o tamanho), baixa o modelo do servidor do Syden (que o busca na
// origem e confere o sha256, como o app confere de novo), e a prévia passa a sair recortada pelo modelo.
//
// Precisa do servidor de teste na 3099 e do site na 5174 (e2e/LEIA.md), e das fotos do teste de recorte
// (node e2e/recorte-de-fundo/baixar.mjs). A primeira rodada baixa 98 MB da origem para o servidor de teste.
//
//   node e2e/recorte-no-app.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron } from 'playwright-core';
import { criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const GATO = path.join('e2e', 'recorte-de-fundo', 'imagens', 'Cat03.jpg');
if (!fs.existsSync(GATO)) throw new Error('Falta a foto do teste: rode node e2e/recorte-de-fundo/baixar.mjs');

// Pasta de dados nova: sem o modelo baixado, e sem conta de outra rodada.
const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'syden-app-recorte-'));
const env = { ...process.env, SYDEN_URL: process.env.SITE_DO_APP ?? 'http://localhost:5174/app/', SYDEN_PASTA_DE_DADOS: dados };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ executablePath: path.resolve('node_modules/electron/dist/electron.exe'), args: [path.resolve('desktop')], env });
const page = vigiar(await app.firstWindow());
if (process.env.DEPURAR) {
  app.process().stdout?.on('data', (d) => process.stdout.write('   [main] ' + d));
  app.process().stderr?.on('data', (d) => process.stdout.write('   [main!] ' + d));
}
await page.waitForLoadState('domcontentloaded');
await page.setViewportSize?.({ width: 1400, height: 900 }).catch(() => {});

await criarConta(page, 'recorte');
await dispensarPresentes(page);
await page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await page.getByText('Criar a minha').click();
await page.getByLabel('Nome da comunidade').fill('Recorte ' + Date.now().toString().slice(-4));
await page.locator('.dialog .btn-primary').click();
await page.locator('.channel-name', { hasText: /geral/ }).first().click();

await page.locator('button[aria-label="Figurinhas"]').click();
await page.locator('.figurinhas-seletor').waitFor({ timeout: 5000 });
await page.locator('.figurinhas-seletor input[type=file]').setInputFiles(GATO);
await page.locator('.figurinhas-previa-figura img').waitFor({ timeout: 15000 });

// ---------- antes de baixar: o fundo da foto não sai, e o app oferece o recorte com o tamanho ----------
const aviso = page.locator('.figurinhas-previa-aviso');
(await aviso.innerText().catch(() => '')).includes('não é de uma cor só') ? ok('sem o modelo, a foto fica como veio, e a prévia diz') : falhou('o aviso do fundo não liso não apareceu');
const oferta = page.locator('.figurinhas-previa-recorte');
const textoDaOferta = await oferta.innerText().catch(() => '');
/98 MB/.test(textoDaOferta) ? ok('o app oferece recortar qualquer fundo, dizendo os 98 MB antes') : falhou(`a oferta não diz o tamanho: "${textoDaOferta}"`);
await page.screenshot({ path: path.join(FOTOS, 'recorte-no-app-antes.png') });

// ---------- baixar: o andamento aparece, e no fim a oferta some ----------
const inicio = Date.now();
await oferta.locator('button').click();
await page.locator('.figurinhas-previa-recorte button', { hasText: /%/ }).waitFor({ timeout: 60000 }).then(
  () => ok('o botão mostra o andamento do download'),
  () => falhou('o andamento do download não apareceu'),
);
await oferta.waitFor({ state: 'detached', timeout: 10 * 60_000 });
ok(`o modelo baixou e conferiu (${Math.round((Date.now() - inicio) / 1000)} s, contando a busca do servidor na origem)`);
const baixado = path.join(dados, 'modelos', 'birefnet-lite-512-fp16.onnx');
fs.existsSync(baixado) && fs.statSync(baixado).size === 98_451_949 ? ok('o modelo está nos dados do app, do tamanho certo') : falhou('o modelo não ficou nos dados do app');

// ---------- a prévia refeita pelo modelo ----------
const recorte = Date.now();
await page.waitForFunction(() => {
  const img = document.querySelector('.figurinhas-previa-figura img');
  return img && !document.querySelector('.figurinhas-previa-aviso');
}, null, { timeout: 60_000 });
ok(`a prévia saiu recortada pelo modelo, sem aviso (${((Date.now() - recorte) / 1000).toFixed(1)} s, contando abrir o modelo)`);
// o canto da figurinha é transparente: o fundo saiu
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
await page.screenshot({ path: path.join(FOTOS, 'recorte-no-app-depois.png') });

// ---------- e a segunda imagem já vem recortada, sem perguntar ----------
await page.locator('.figurinhas-previa .btn-primary').click();
await page.locator('.figurinhas-figura img').first().waitFor({ timeout: 15000 });
ok('a figurinha recortada entrou na coleção');

await app.close();
fs.rmSync(dados, { recursive: true, force: true });
resumo('recorte no app');
