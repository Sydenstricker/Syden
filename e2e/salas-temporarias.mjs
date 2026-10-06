// Salas temporárias: a dona liga "criar uma sala para cada pessoa" na Sala 1. A Bia clica na Sala 1 e
// vai parar numa sala só dela, com o nome dela, que aparece também na barra da dona. A Bia sai da
// chamada e a sala some da barra da dona, sem recarregar.
//
//   SITE=http://localhost:5174/app/ node e2e/salas-temporarias.mjs   (API de teste na 3099 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const permissions = ['clipboard-read', 'clipboard-write', 'microphone'];

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

// ---------- a dona liga "cria salas" na Sala 1 ----------
const salaUm = dona.locator('.channel-row', { has: dona.locator('.channel-name', { hasText: /^Sala 1$/ }) }).first();
await salaUm.hover();
const chave = salaUm.getByRole('button', { name: 'Criar uma sala para cada pessoa que entrar: Sala 1' });
await chave.click();
await dona.waitForFunction(() =>
  [...document.querySelectorAll('.channel-actions button[aria-pressed]')].some((b) => b.getAttribute('aria-pressed') === 'true'),
).then(
  () => ok('a dona ligou "criar uma sala para cada pessoa" na Sala 1'),
  () => falhou('a chave não ligou'),
);
await bia.locator('.channel-row svg[aria-label="Entre para criar a sua sala"]').first().waitFor({ timeout: 10000 }).then(
  () => ok('na barra da Bia, a Sala 1 ganha o ícone de criar sala'),
  () => falhou('o ícone da Sala 1 não mudou para a Bia'),
);

// ---------- a Bia entra e ganha a sala dela ----------
await bia.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
const salaDaBia = (page) => page.locator('.channel-name', { hasText: new RegExp(`^bia${s}$`) }).first();
await salaDaBia(bia).waitFor({ timeout: 20000 }).then(
  () => ok('a Bia ganhou uma sala com o nome dela'),
  () => falhou('a sala da Bia não apareceu'),
);
await bia.locator('.stage-controls').waitFor({ timeout: 30000 });
const ativa = await bia.locator('.channel.active .channel-name').first().innerText();
ativa === 'bia' + s ? ok('e a tela dela está na sala nova, não na Sala 1') : falhou('a tela ficou em: ' + ativa);
await dona.waitForFunction(
  (nome) => [...document.querySelectorAll('.voice-member')].some((m) => m.textContent.includes(nome)),
  'bia' + s,
  { timeout: 15000 },
).then(
  () => ok('a dona vê a sala da Bia, com a Bia dentro'),
  () => falhou('a dona não vê a Bia na sala nova'),
);
const ordem = await dona.locator('.channel-name').allInnerTexts();
ordem[ordem.indexOf('Sala 1') + 1] === 'bia' + s ? ok('a sala nova fica logo abaixo da Sala 1') : falhou('ordem das salas: ' + ordem.join(', '));
await dona.locator('.sidebar').screenshot({ path: 'e2e/fotos/salas-temporarias.png' });

// ---------- a Bia sai: a sala some ----------
await bia.locator('.leave-button').click();
await dona.waitForFunction((nome) => ![...document.querySelectorAll('.channel-name')].some((c) => c.textContent === nome), 'bia' + s, { timeout: 15000 }).then(
  () => ok('a Bia saiu e a sala sumiu da barra da dona'),
  () => falhou('a sala ficou depois de esvaziar'),
);

await browser.close();
resumo('Salas temporárias');
