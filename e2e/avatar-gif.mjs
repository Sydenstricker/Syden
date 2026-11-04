// O AVATAR EM GIF (04/11/2026, pedido dele: "como o Discord faz na lista, para não virar um pisca-pisca"): o GIF vai inteiro
// (sem a tela de recorte), anima grande em Minha conta, fica PARADO na mensagem e na lista de membros, e anima enquanto o
// mouse está na linha. Com "menos movimento", nunca anima.
//
//   node e2e/avatar-gif.mjs   (API de teste na 3099, site na 5174; ver e2e/LEIA.md)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const GIF = path.join('e2e', 'pixel-art', 'personagem', 'blender', 'c', 'varrendo.gif');
const { browser, contexto } = await abrirNavegador();
const page = vigiar(await contexto.newPage());

await criarConta(page, 'gif');
await dispensarPresentes(page);

// ---------- enviar: o GIF vai direto, sem a tela de recorte ----------
await page.locator('button[aria-label="Configurações"]').first().click();
await page.locator('.settings-tab', { hasText: /Minha conta/ }).first().click();
await page.locator('.account-actions input[type=file]').setInputFiles(GIF);
await page.waitForTimeout(300);
(await page.locator('.image-cropper, .cropper').count()) === 0 ? ok('o GIF não passa pela tela de recorte') : falhou('abriu a tela de recorte para o GIF');
const grande = page.locator('.account-card .avatar .avatar-foto');
await grande.waitFor({ timeout: 10000 });
(await grande.evaluate((el) => el.tagName)) === 'IMG' ? ok('em Minha conta (grande), o GIF anima') : falhou('em Minha conta o GIF ficou parado');
await page.keyboard.press('Escape');

// ---------- na conversa: parado, e anima com o mouse na mensagem ----------
await page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await page.getByText('Criar a minha').click();
await page.getByLabel('Nome da comunidade').fill('GIF ' + Date.now().toString().slice(-4));
await page.locator('.dialog .btn-primary').click();
await page.locator('.channel-name', { hasText: /geral/ }).first().click();
await page.locator('.composer textarea, textarea').first().fill('olha o meu avatar');
await page.keyboard.press('Enter');
const mensagem = page.locator('.message').last();
await mensagem.waitFor({ timeout: 10000 });
await page.mouse.move(5, 5);
await page.waitForTimeout(400);
const naMensagem = () => mensagem.locator('.avatar .avatar-foto').evaluate((el) => el.tagName);
(await naMensagem()) === 'CANVAS' ? ok('na mensagem, o GIF fica parado') : falhou(`na mensagem, o avatar é ${await naMensagem()}`);
// o quadro parado não é vazio: o primeiro quadro foi desenhado. O canvas não se lê (o GIF vem do servidor, outra origem, e o
// navegador bloqueia ler os pixels — mostrar, não), então a prova é a foto dele: um círculo vazio comprime em quase nada.
const foto = await mensagem.locator('canvas.avatar-foto').screenshot();
foto.length > 1500 ? ok(`o quadro parado tem o desenho do GIF (foto de ${foto.length} bytes)`) : falhou(`o quadro parado parece vazio (${foto.length} bytes)`);
await mensagem.hover();
await page.waitForTimeout(300);
(await naMensagem()) === 'IMG' ? ok('com o mouse na mensagem, o GIF anima') : falhou('o mouse na mensagem não animou o GIF');
await page.screenshot({ path: path.join(FOTOS, 'avatar-gif-mouse.png') });
await page.mouse.move(5, 5);
await page.waitForTimeout(300);
(await naMensagem()) === 'CANVAS' ? ok('o mouse saiu, o GIF parou de novo') : falhou('o GIF continuou animando depois do mouse sair');

// ---------- na lista de membros: parado, e anima com o mouse na linha ----------
const naLista = page.locator('.member-list .avatar .avatar-foto, .members .avatar .avatar-foto').first();
if (await naLista.count()) {
  (await naLista.evaluate((el) => el.tagName)) === 'CANVAS' ? ok('na lista de membros, parado') : falhou('na lista de membros, animando sem o mouse');
  await naLista.hover();
  await page.waitForTimeout(300);
  (await page.locator('.member-list .avatar .avatar-foto, .members .avatar .avatar-foto').first().evaluate((el) => el.tagName)) === 'IMG'
    ? ok('com o mouse na pessoa da lista, anima')
    : falhou('o mouse na lista não animou');
} else falhou('não achei a lista de membros');

// ---------- menos movimento: nunca anima ----------
await page.emulateMedia({ reducedMotion: 'reduce' });
await mensagem.hover();
await page.waitForTimeout(300);
(await naMensagem()) === 'CANVAS' ? ok('com "menos movimento", nem o mouse anima') : falhou('com "menos movimento", o GIF animou');

await browser.close();
resumo('avatar em GIF');
