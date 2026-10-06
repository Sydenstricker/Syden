// Níveis e ranking: a dona liga os níveis e cria uma recompensa; a entrada "Ranking" aparece para a Bia
// na hora, e uma mensagem dela já a põe no ranking. A subida de nível em si (pontos ao longo de minutos)
// é coberta por server/test/niveis.test.ts.
//
//   SITE=http://localhost:5174/app/ node e2e/niveis.mjs   (API de teste na 3099)
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

// ---------- a dona liga os níveis e cria uma recompensa ----------
(await bia.locator('.channel', { hasText: 'Ranking' }).count()) === 0 ? ok('com os níveis desligados, não há Ranking') : falhou('Ranking apareceu desligado');
await dona.locator('button[aria-label="Configurações"]').first().click();
await dona.locator('.settings-tab', { hasText: /Membros/ }).first().click();
await dona.locator('.cargo-novo input[aria-label="Nome do cargo"]').fill('Falante');
await dona.getByRole('button', { name: 'Criar cargo' }).click();
await dona.locator('.cargo-linha').first().waitFor({ timeout: 10000 });
await dona.getByLabel('Níveis e ranking ligados').check();
await dona.getByLabel('Cargo da recompensa').waitFor({ timeout: 10000 });
await dona.locator('.configuracao-de-niveis .nivel-numero').fill('3');
await dona.getByLabel('Cargo da recompensa').selectOption({ label: 'Falante' });
await dona.getByRole('button', { name: 'Adicionar recompensa' }).click();
await dona.locator('.configuracao-de-niveis .cargo-linha', { hasText: 'Falante' }).waitFor({ timeout: 10000 }).then(
  () => ok('a dona ligou os níveis e criou a recompensa "nível 3 → Falante"'),
  () => falhou('a recompensa não apareceu'),
);
await dona.locator('.configuracao-de-niveis').screenshot({ path: 'e2e/fotos/niveis-config.png' });
await dona.keyboard.press('Escape');

// ---------- a Bia vê o Ranking sem recarregar, fala, e aparece nele ----------
await bia.locator('.channel', { hasText: 'Ranking' }).waitFor({ timeout: 10000 }).then(
  () => ok('a entrada "Ranking" apareceu para a Bia sem recarregar'),
  () => falhou('o Ranking não apareceu para a Bia'),
);
await bia.locator('.channel-name', { hasText: /^geral$/ }).first().click();
const caixa = bia.locator('.composer textarea').first();
await caixa.fill('oi, gente!');
await bia.keyboard.press('Enter');
await bia.waitForTimeout(1000);
await bia.locator('.channel', { hasText: 'Ranking' }).click();
await bia.locator('.ranking-lista li', { hasText: 'bia' + s }).waitFor({ timeout: 10000 }).then(
  () => ok('uma mensagem e a Bia já está no ranking'),
  () => falhou('a Bia não apareceu no ranking'),
);
const eu = await bia.locator('.ranking-eu strong').textContent();
/1/.test(eu) ? ok('e o topo diz onde ela está: ' + eu) : falhou('o topo do ranking: ' + eu);
await bia.locator('.ranking').screenshot({ path: 'e2e/fotos/niveis-ranking.png' });

await browser.close();
resumo('Níveis');
