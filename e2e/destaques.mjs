// Destaques: a dona cria o #destaques e o liga com 1 estrela. A Bia escreve no #geral, a dona dá ⭐, e
// a mensagem aparece no #destaques pelo Syden. A dona apaga a original, e o destaque some na tela da Bia.
//
//   SITE=http://localhost:5174/app/ node e2e/destaques.mjs   (API de teste na 3099)
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

// A dona cria o #destaques pela barra lateral (o primeiro grupo é o dos canais de texto).
await dona.locator('.channel-group-title button[title="Criar canal"]').first().click();
await dona.locator('.channel-input').fill('destaques');
await dona.keyboard.press('Enter');
await dona.locator('.channel-name', { hasText: /^destaques$/ }).first().waitFor({ timeout: 10000 });

await dona.locator('button[aria-label="Configurações"]').first().click();
await dona.locator('.settings-tab', { hasText: 'Destaques' }).first().click();
const seletor = dona.getByLabel('Canal de destaques');
await dona.waitForFunction(() => document.querySelectorAll('select[aria-label="Canal de destaques"] option').length > 2);
const valor = await seletor.evaluate((el) => [...el.options].find((o) => o.textContent.includes('destaques')).value);
await seletor.selectOption(valor);
await dona.locator('.settings-card input[type="number"]').fill('1');
await dona.locator('.settings-card').getByRole('button', { name: 'Salvar' }).click();
await dona.locator('.settings-card').getByText('Salvo.').waitFor({ timeout: 10000 }).then(
  () => ok('a dona ligou os destaques no #destaques, com 1 estrela'),
  () => falhou('os destaques não salvaram'),
);
await dona.locator('.settings-content').first().screenshot({ path: 'e2e/fotos/destaques-config.png' });
await dona.keyboard.press('Escape');

// ---------- a Bia escreve, a dona dá ⭐ ----------
await bia.locator('.channel-name', { hasText: /^geral$/ }).first().click();
await bia.locator('.composer textarea').first().fill('que jogada ' + s);
await bia.keyboard.press('Enter');
await dona.locator('.channel-name', { hasText: /^geral$/ }).first().click();
const original = dona.locator('.message', { hasText: 'que jogada ' + s }).first();
await original.waitFor({ timeout: 15000 });
await original.hover();
await original.locator('button[aria-label="Reagir"]').click();
await dona.locator('.emoji-picker').getByRole('button', { name: '⭐', exact: true }).first().click();

await bia.locator('.channel-name', { hasText: /^destaques$/ }).first().click();
const destaque = bia.locator('.message', { hasText: 'que jogada ' + s }).first();
await destaque.waitFor({ timeout: 15000 }).then(
  async () => {
    const texto = await destaque.innerText();
    texto.includes('⭐ 1') && texto.includes('Syden') ? ok('com a estrela, o Syden publicou o destaque no #destaques') : falhou('destaque estranho: ' + texto);
  },
  () => falhou('o destaque não apareceu no #destaques'),
);
await destaque.screenshot({ path: 'e2e/fotos/destaque.png' });

// ---------- a dona apaga a original; o destaque some na tela da Bia, sem recarregar ----------
await original.hover();
await original.locator('button[aria-label="Apagar mensagem"]').click({ modifiers: ['Shift'] });
await bia.waitForFunction((t) => ![...document.querySelectorAll('.message')].some((m) => m.textContent.includes(t)), 'que jogada ' + s, { timeout: 15000 }).then(
  () => ok('apagada a original, o destaque sumiu da tela da Bia'),
  () => falhou('o destaque continuou depois de a original sair'),
);

await browser.close();
resumo('Destaques');
