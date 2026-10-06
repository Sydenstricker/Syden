// Cargos personalizados: a dona cria "Veterano" (separado na lista) e dá à Bia. A Bia aparece num grupo
// "Veterano" na lista de membros, e o cartão de perfil dela mostra a etiqueta. Tirar o cargo desfaz.
//
//   SITE=http://localhost:5174/app/ node e2e/cargos.mjs   (API de teste na 3099)
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

// ---------- a dona cria o cargo e dá à Bia ----------
await dona.locator('button[aria-label="Configurações"]').first().click();
await dona.locator('.settings-tab', { hasText: /Membros/ }).first().click();
await dona.locator('.cargo-novo input[aria-label="Nome do cargo"]').fill('Veterano');
await dona.getByRole('button', { name: 'Criar cargo' }).click();
const linhaDoCargo = dona.locator('.cargo-linha').first();
await linhaDoCargo.waitFor({ timeout: 10000 });
ok('a dona criou o cargo "Veterano"');
await linhaDoCargo.getByLabel('Separado na lista').check();
await dona.getByLabel(`Dar cargo a bia${s}`).selectOption({ label: 'Veterano' });
await dona.locator('.expression-row', { hasText: 'bia' + s }).locator('.cargo-etiqueta', { hasText: 'Veterano' }).waitFor({ timeout: 10000 }).then(
  () => ok('e deu o cargo à Bia'),
  () => falhou('o cargo não apareceu na linha da Bia'),
);
await dona.locator('.settings-content').first().screenshot({ path: 'e2e/fotos/cargos-config.png' });
await dona.keyboard.press('Escape');

// ---------- a Bia vê o grupo e a etiqueta ----------
await bia
  .locator('.members h3', { hasText: /^Veterano — 1$/ })
  .waitFor({ timeout: 10000 })
  .then(
    () => ok('na lista da Bia, um grupo "Veterano — 1", sem recarregar'),
    async () => falhou('grupos: ' + (await bia.locator('.members h3').allTextContents()).join(' | ')),
  );
await bia.locator('.members .member', { hasText: 'bia' + s }).first().click();
await bia.locator('.perfil-cartao .cargo-etiqueta', { hasText: 'Veterano' }).waitFor({ timeout: 5000 }).then(
  () => ok('e o cartão de perfil mostra a etiqueta do cargo'),
  () => falhou('o cartão de perfil não mostrou o cargo'),
);
await bia.locator('.members').screenshot({ path: 'e2e/fotos/cargos-lista.png' });
await bia.keyboard.press('Escape');

// ---------- tirar desfaz ----------
await dona.locator('button[aria-label="Configurações"]').first().click();
await dona.locator('.settings-tab', { hasText: /Membros/ }).first().click();
await dona.getByRole('button', { name: 'Tirar o cargo Veterano' }).click();
await bia
  .waitForFunction(() => ![...document.querySelectorAll('.members h3')].some((h) => h.textContent.startsWith('Veterano')), null, { timeout: 10000 })
  .then(
    () => ok('a dona tirou o cargo, e o grupo sumiu da lista da Bia'),
    () => falhou('o grupo continuou depois de tirar o cargo'),
  );

await browser.close();
resumo('Cargos');
