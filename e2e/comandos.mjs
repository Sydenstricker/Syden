// Comandos personalizados e a conta do Syden: a dona cadastra "!regras"; a Bia escreve "!regras" e o
// Syden responde no canal, com o ícone D4, o nome "Syden", o selo APP e o nome dela no texto.
//
//   SITE=http://localhost:5174/app/ node e2e/comandos.mjs   (API de teste na 3099)
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

await dona.locator('button[aria-label="Configurações"]').first().click();
await dona.locator('.settings-tab', { hasText: /Comandos/ }).first().click();
await dona.getByLabel('Nome do comando').fill('regras');
await dona.getByLabel('Resposta do comando').fill('Bem-vinda, {pessoa}! Em {comunidade} a regra é uma só: respeito.');
await dona.getByRole('button', { name: 'Salvar comando' }).click();
await dona.locator('.comandos-lista code', { hasText: '!regras' }).waitFor({ timeout: 10000 }).then(
  () => ok('a dona cadastrou o comando !regras'),
  () => falhou('o comando não apareceu na lista'),
);
await dona.locator('.settings-content').first().screenshot({ path: 'e2e/fotos/comandos-config.png' });
await dona.keyboard.press('Escape');

await bia.locator('.channel-name', { hasText: /^geral$/ }).first().click();
await bia.locator('.composer textarea').first().fill('!regras');
await bia.keyboard.press('Enter');
const resposta = bia.locator('.message', { hasText: 'a regra é uma só' }).first();
await resposta.waitFor({ timeout: 10000 }).then(
  () => ok('o Syden respondeu no canal'),
  () => falhou('o Syden não respondeu'),
);
const texto = await resposta.innerText();
texto.includes('bia' + s) ? ok('com o nome de quem pediu no lugar de {pessoa}') : falhou('o {pessoa} não foi trocado: ' + texto);
(await resposta.locator('.selo-app').count()) === 1 && (await resposta.locator('.message-author').innerText()) === 'Syden'
  ? ok('assinado "Syden", com o selo APP')
  : falhou('a resposta não veio como o Syden');
(await resposta.locator('.avatar-app img').count()) === 1 ? ok('e com o ícone D4 no lugar do avatar') : falhou('o avatar do app não apareceu');
await bia.locator('.messages, .message-list').first().screenshot({ path: 'e2e/fotos/comandos-resposta.png' }).catch(() => bia.screenshot({ path: 'e2e/fotos/comandos-resposta.png' }));

await browser.close();
resumo('Comandos');
