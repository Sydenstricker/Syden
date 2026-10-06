// Aniversários: a Bia informa o dela (dia e mês) em Minha conta, a dona liga os parabéns da comunidade
// num canal, e o Syden publica. O teste marca o aniversário para HOJE (em UTC, que é o dia do servidor);
// o agendador só anuncia depois do meio-dia UTC, então antes disso o teste para na configuração.
//
//   SITE=http://localhost:5174/app/ node e2e/aniversarios.mjs   (API de teste na 3099)
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

// ---------- a Bia informa o aniversário ----------
const hoje = new Date();
await bia.locator('button[aria-label="Configurações"]').first().click();
await bia.locator('.settings-tab', { hasText: /Minha conta/ }).first().click();
await bia.getByLabel('Mês').selectOption(String(hoje.getUTCMonth() + 1));
await bia.getByLabel('Dia').selectOption(String(hoje.getUTCDate()));
await bia.locator('.settings-card', { hasText: 'nunca o ano' }).getByRole('button', { name: 'Salvar' }).click();
await bia.locator('.settings-card', { hasText: 'nunca o ano' }).getByText('Salvo.').waitFor({ timeout: 10000 }).then(
  () => ok('a Bia salvou o aniversário'),
  () => falhou('o aniversário não salvou'),
);
await bia.locator('.settings-card', { hasText: 'nunca o ano' }).screenshot({ path: 'e2e/fotos/aniversario-conta.png' });
await bia.keyboard.press('Escape');

// ---------- a dona liga os parabéns ----------
await dona.locator('button[aria-label="Configurações"]').first().click();
await dona.locator('.settings-tab', { hasText: /Mensagens agendadas/ }).first().click();
await dona.getByLabel('Canal dos parabéns').selectOption({ index: 1 });
const texto = dona.getByLabel('Texto dos parabéns');
(await texto.inputValue()).includes('{pessoa}') ? ok('o texto já vem com {pessoa}') : falhou('o texto padrão não tem {pessoa}');
await texto.fill('Parabéns, {pessoa}! 🎂');
const cartao = dona.locator('.settings-card', { hasText: 'Use {pessoa}' });
await cartao.getByRole('button', { name: 'Salvar' }).click();
await cartao.getByText('Salvo.').waitFor({ timeout: 10000 }).then(
  () => ok('a dona ligou os parabéns no #geral'),
  () => falhou('os parabéns não salvaram'),
);
await cartao.screenshot({ path: 'e2e/fotos/aniversario-comunidade.png' });
await dona.keyboard.press('Escape');

// ---------- o Syden dá os parabéns ----------
if (hoje.getUTCHours() < 12) {
  ok('antes do meio-dia UTC: o anúncio fica para o teste do servidor (server/test/aniversarios.test.ts)');
} else {
  await bia.locator('.channel-name', { hasText: /^geral$/ }).first().click();
  const parabens = bia.locator('.message', { hasText: `Parabéns, bia${s}!` }).first();
  await parabens.waitFor({ timeout: 90_000 }).then(
    async () => {
      const autor = await parabens.locator('.message-author').innerText();
      autor === 'Syden' ? ok('o Syden deu os parabéns à Bia') : falhou('publicado, mas por ' + autor);
    },
    () => falhou('os parabéns não foram publicados'),
  );
}

await browser.close();
resumo('Aniversários');
