// AS FIGURINHAS NA TELA (04/11/2026): criar uma a partir de uma imagem, mandar, ver grande e sem moldura na conversa, salvar,
// e tirar da coleção. As regras de quem pode o quê (a coleção é de cada um, a chave do anexo, a retirada) moram no teste do
// servidor (server/test/figurinhas.test.ts); aqui é o que a pessoa vê.
//
//   node e2e/figurinhas.mjs   (API de teste na 3099, site na 5174; ver e2e/LEIA.md)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const { browser, contexto } = await abrirNavegador();
const page = vigiar(await contexto.newPage());

await criarConta(page, 'fig');
await dispensarPresentes(page);
await page.locator('button[aria-label="Adicionar comunidade"]').click();
await page.getByText('Criar a minha').click();
await page.getByLabel('Nome da comunidade').fill('Figurinhas ' + Date.now().toString().slice(-4));
await page.locator('.dialog .btn-primary').click();
await page.locator('.channel-name').first().waitFor({ timeout: 20000 });
await page.locator('.channel-name', { hasText: /geral/ }).first().click();
ok('entrou num canal de texto');

// ---------- o seletor abre vazio, com o convite a criar ----------
const botao = page.locator('button[aria-label="Figurinhas"]');
await botao.waitFor({ timeout: 10000 });
await botao.click();
await page.locator('.figurinhas-seletor').waitFor({ timeout: 5000 });
await page.locator('.figurinhas-vazio').waitFor({ timeout: 5000 });
ok('o seletor abre, vazio, dizendo como criar');

// ---------- criar: uma imagem com fundo transparente ----------
const imagem = fs.readFileSync(path.join('web', 'public', 'tamanho', 'coelho.png'));
await page.locator('.figurinhas-seletor input[type=file]').setInputFiles({ name: 'coelho.png', mimeType: 'image/png', buffer: imagem });
await page.locator('.figurinhas-figura img').first().waitFor({ timeout: 10000 });
const carregou = await page.locator('.figurinhas-figura img').first().evaluate((img) => img.complete && img.naturalWidth > 0);
carregou ? ok('a figurinha criada aparece na coleção') : falhou('a figurinha da coleção não carregou (endereço com a chave?)');
const lado = await page.locator('.figurinhas-figura img').first().evaluate((img) => Math.max(img.naturalWidth, img.naturalHeight));
lado <= 512 ? ok(`guardada com ${lado} px no lado maior`) : falhou(`guardada com ${lado} px (devia caber em 512)`);
await page.locator('.figurinhas-seletor').screenshot({ path: path.join(FOTOS, 'figurinhas-seletor.png') });

// ---------- mandar ----------
await page.locator('.figurinhas-figura').first().click();
await page.locator('.figurinhas-seletor').waitFor({ state: 'detached', timeout: 5000 });
const naConversa = page.locator('.figurinha-na-conversa img').last();
await naConversa.waitFor({ timeout: 10000 });
await page.waitForTimeout(500);
const medida = await naConversa.evaluate((img) => ({ ok: img.complete && img.naturalWidth > 0, w: img.getBoundingClientRect().width, h: img.getBoundingClientRect().height }));
medida.ok ? ok('a figurinha chegou na conversa e carregou') : falhou('a figurinha da conversa não carregou');
Math.max(medida.w, medida.h) <= 161 && Math.max(medida.w, medida.h) >= 100
  ? ok(`aparece grande e sem moldura (${Math.round(medida.w)}×${Math.round(medida.h)})`)
  : falhou(`tamanho estranho na conversa: ${medida.w}×${medida.h}`);
const semMoldura = await page.locator('.figurinha-na-conversa').last().evaluate((el) => !el.closest('.attachment-image'));
semMoldura ? ok('não vem embrulhada como foto') : falhou('veio dentro do quadro de imagem comum');
await page.locator('.figurinha-na-conversa').last().hover();
await page.screenshot({ path: path.join(FOTOS, 'figurinhas-conversa.png') });

// ---------- salvar (a própria: a coleção não repete) ----------
await page.locator('.figurinha-salvar').last().click();
await page.locator('.figurinha-salvar', { hasText: 'Salva nas suas figurinhas' }).last().waitFor({ timeout: 5000 });
ok('"Salvar figurinha" responde');
await botao.click();
await page.locator('.figurinhas-figura').first().waitFor({ timeout: 5000 });
await page.waitForTimeout(300);
const quantas = await page.locator('.figurinhas-figura').count();
quantas === 1 ? ok('a mesma imagem não entra duas vezes na coleção') : falhou(`a coleção tem ${quantas}`);

// ---------- tirar ----------
await page.getByRole('button', { name: 'Arrumar' }).click();
await page.locator('.figurinhas-tirar').first().click();
await page.locator('.figurinhas-vazio').waitFor({ timeout: 5000 });
ok('tirar da coleção deixa ela vazia');
const continua = await page.locator('.figurinha-na-conversa img').last().evaluate((img) => img.complete && img.naturalWidth > 0);
continua ? ok('a figurinha já mandada continua na conversa') : falhou('tirar da coleção apagou a da conversa');

const estouro = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
estouro === 0 ? ok('nada estoura a tela para o lado') : falhou(`estourou ${estouro}px`);

await browser.close();
resumo('figurinhas');
