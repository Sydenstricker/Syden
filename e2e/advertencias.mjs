// Advertir e silenciar: a dona, pelo botão direito sobre a Bia na lista de membros, adverte (a Bia
// recebe o motivo) e silencia por 5 min (a Bia vê o aviso na caixa, a mensagem é recusada e o relógio
// aparece ao lado do nome dela). Tirar o silêncio libera na hora.
//
//   SITE=http://localhost:5174/app/ node e2e/advertencias.mjs   (API de teste na 3099)
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

const menuDaBia = async () => {
  await dona.locator('.members .member', { hasText: 'bia' + s }).first().click({ button: 'right' });
  await dona.locator('.person-menu').waitFor({ timeout: 5000 });
};

// ---------- advertência ----------
await menuDaBia();
await dona.getByRole('menuitem', { name: /Advertir…/ }).click();
await dona.getByLabel('Motivo da advertência').fill('Spam no geral');
await dona.locator('.moderacao-da-pessoa').getByRole('button', { name: 'Advertir' }).click();
await bia.getByText(/Você recebeu uma advertência em .*: Spam no geral/).waitFor({ timeout: 10000 }).then(
  () => ok('a Bia recebeu a advertência, com o motivo'),
  () => falhou('a advertência não chegou à Bia'),
);

// ---------- silêncio ----------
await menuDaBia();
await dona.getByLabel(`Silenciar bia${s} por`).selectOption('5');
await bia.getByText(/Você está em silêncio em .* até/).waitFor({ timeout: 10000 }).then(
  () => ok('a Bia foi avisada do silêncio'),
  () => falhou('o aviso de silêncio não chegou'),
);
await bia.locator('.channel-name', { hasText: /^geral$/ }).first().click();
await bia.getByText(/Você está em silêncio nesta comunidade até/).waitFor({ timeout: 10000 }).then(
  () => ok('a caixa de mensagem diz até quando'),
  () => falhou('a caixa não mostrou o silêncio'),
);
const caixa = bia.locator('.composer textarea').first();
await caixa.fill('posso falar?');
await bia.keyboard.press('Enter');
await bia.getByText(/em silêncio nesta comunidade por mais/).waitFor({ timeout: 10000 }).then(
  () => ok('a mensagem foi recusada pelo silêncio'),
  () => falhou('a mensagem passou durante o silêncio'),
);
(await dona.locator('.members .member', { hasText: 'bia' + s }).locator('.member-silencio').count()) === 1
  ? ok('o relógio de silêncio aparece ao lado do nome da Bia')
  : falhou('a lista de membros não mostrou o silêncio');
await dona.locator('.members').screenshot({ path: 'e2e/fotos/advertencias-lista.png' });

// ---------- tirar o silêncio ----------
await menuDaBia();
await dona.screenshot({ path: 'e2e/fotos/advertencias-menu.png' });
await dona.getByRole('menuitem', { name: /Tirar o silêncio/ }).click();
await bia.getByText(/Seu silêncio em .* acabou/).waitFor({ timeout: 10000 });
await caixa.fill('voltei');
await bia.keyboard.press('Enter');
await bia.locator('.message', { hasText: 'voltei' }).first().waitFor({ timeout: 10000 }).then(
  () => ok('sem o silêncio, a Bia escreve de novo'),
  () => falhou('a Bia continuou sem conseguir escrever'),
);

await browser.close();
resumo('Advertências e silêncio');
