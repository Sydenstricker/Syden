// Contadores: a dona liga "Membros" e "Online agora" nas configurações. Os números aparecem no alto da
// lista de canais, para ela e para a Bia. A Bia fecha o Syden, e o "online" da dona cai sozinho.
//
//   SITE=http://localhost:5174/app/ node e2e/contadores.mjs   (API de teste na 3099)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const permissions = ['clipboard-read', 'clipboard-write'];

async function entrar(nome, url) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions });
  const page = vigiar(await ctx.newPage());
  if (url) {
    await page.goto(url);
    await page.getByLabel('Nome de usuário').fill(nome);
    await page.getByLabel('E-mail').fill(`${nome}@exemplo.test`);
    await page.getByLabel('Senha', { exact: true }).fill('segredo123');
    await page.getByRole('button', { name: 'Cadastrar' }).click();
  } else {
    await cadastrar(page, nome);
  }
  await dispensarPresentes(page);
  return page;
}

// A dona cria uma comunidade dela, e a Bia entra pelo convite.
const dona = await entrar('dona' + s);
await dona.getByRole('button', { name: 'Adicionar comunidade' }).click();
await dona.locator('.community-choice-option').first().click();
await dona.locator('form.dialog input').first().fill('Clã ' + s);
await dona.locator('form.dialog .btn-primary').click();
await dona.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
const linha = dona.locator('.channel-row', { has: dona.locator('.channel-name', { hasText: /^geral$/ }) }).first();
await linha.hover();
await linha.getByRole('button', { name: 'Copiar link: geral' }).click();
const convite = await dona.evaluate(() => navigator.clipboard.readText());
const bia = await entrar('bia' + s, convite);
await bia.locator('.channel.active').first().waitFor({ timeout: 20000 });
ok('a Bia entrou na comunidade da dona');

(await bia.locator('.faixa-de-contadores').count()) === 0 ? ok('sem contador escolhido, a faixa não ocupa lugar') : falhou('a faixa apareceu sem contador');

await dona.locator('button[aria-label="Configurações"]').first().click();
await dona.locator('.settings-tab', { hasText: 'Membros' }).first().click();
await dona.getByLabel('Membros', { exact: true }).check();
await dona.getByLabel('Online agora', { exact: true }).check();
await dona.keyboard.press('Escape');

const contador = (page, texto) => page.locator('.faixa-de-contadores li', { hasText: texto }).first();
await contador(bia, 'Membros: 2').waitFor({ timeout: 10000 }).then(
  () => ok('a Bia vê "Membros: 2" no alto da lista, sem recarregar'),
  () => falhou('o contador de membros não chegou para a Bia'),
);
await contador(dona, 'Online agora: 2').waitFor({ timeout: 10000 }).then(
  () => ok('a dona vê "Online agora: 2"'),
  () => falhou('o contador de online não mostra 2'),
);
await dona.locator('.sidebar').screenshot({ path: 'e2e/fotos/contadores.png' });

await bia.context().close();
await contador(dona, 'Online agora: 1').waitFor({ timeout: 20000 }).then(
  () => ok('a Bia fechou o Syden e o online da dona caiu para 1 sozinho'),
  () => falhou('o online não caiu quando a Bia saiu'),
);

await browser.close();
resumo('Contadores');
