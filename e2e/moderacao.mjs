// Moderação automática: a dona proíbe uma palavra e põe o #geral em modo lento de 30 s. A Bia vê o
// aviso do modo lento; a mensagem com a palavra é recusada com o motivo, e o texto volta para a caixa;
// a segunda mensagem dentro dos 30 s é barrada pelo modo lento.
//
//   SITE=http://localhost:5174/app/ node e2e/moderacao.mjs   (API de teste na 3099)
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

// ---------- a dona configura ----------
await dona.locator('button[aria-label="Configurações"]').first().click();
await dona.locator('.settings-tab', { hasText: /Moderação/ }).first().click();
await dona.getByLabel('Palavras proibidas').fill('abacaxi');
await dona.locator('.settings-card').filter({ has: dona.getByLabel('Palavras proibidas') }).getByRole('button', { name: 'Salvar' }).click();
await dona.getByText('Salvo.').waitFor({ timeout: 10000 });
await dona.getByLabel(/^Modo lento de/).first().selectOption('30');
await dona.waitForTimeout(800);
ok('a dona proibiu "abacaxi" e pôs o #geral em modo lento de 30 s');
await dona.locator('.settings-content').first().screenshot({ path: 'e2e/fotos/moderacao-config.png' });
await dona.keyboard.press('Escape');

// ---------- a Bia ----------
await bia.locator('.channel-name', { hasText: /^geral$/ }).first().click();
await bia.locator('.composer-modo-lento').waitFor({ timeout: 10000 }).then(
  async () => ok('o aviso de modo lento aparece para a Bia: ' + (await bia.locator('.composer-modo-lento').innerText())),
  () => falhou('a Bia não viu o aviso de modo lento'),
);
const caixa = bia.locator('.composer textarea').first();
await caixa.fill('eu adoro ABACAXI!');
await bia.keyboard.press('Enter');
await bia.getByText('Esta comunidade não permite uma das palavras desta mensagem.').waitFor({ timeout: 10000 }).then(
  () => ok('a palavra proibida foi recusada, com o motivo'),
  () => falhou('a palavra proibida passou ou não houve aviso'),
);
(await caixa.inputValue()) === 'eu adoro ABACAXI!' ? ok('e o texto voltou para a caixa, para editar') : falhou('o texto sumiu: ' + (await caixa.inputValue()));
(await bia.locator('.message', { hasText: 'ABACAXI' }).count()) === 0 ? ok('ninguém vê a mensagem recusada') : falhou('a mensagem recusada apareceu');

await caixa.fill('oi, gente');
await bia.keyboard.press('Enter');
await bia.locator('.message', { hasText: 'oi, gente' }).first().waitFor({ timeout: 10000 });
await caixa.fill('mais uma');
await bia.keyboard.press('Enter');
await bia.getByText(/modo lento: espere/).waitFor({ timeout: 10000 }).then(
  () => ok('a segunda mensagem dentro dos 30 s foi barrada pelo modo lento'),
  () => falhou('o modo lento não barrou'),
);
await bia.screenshot({ path: 'e2e/fotos/moderacao-bia.png' });

await browser.close();
resumo('Moderação');
