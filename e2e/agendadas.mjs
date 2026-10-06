// Mensagens agendadas e lembretes: a dona agenda uma mensagem para daqui a 1 minuto, e o Syden a
// publica na hora (o agendador confere a cada 30 s). A Bia pede "Lembrar de mim" numa mensagem e recebe a
// confirmação — a entrega na hora é coberta por server/test/agendadas.test.ts (o menor prazo é 20 min).
//
//   SITE=http://localhost:5174/app/ node e2e/agendadas.mjs   (API de teste na 3099)
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
await dona.locator('.settings-tab', { hasText: /Mensagens agendadas/ }).first().click();
// Um minuto e meio à frente, no relógio local (o campo é de hora local, como o de quem usa).
const alvo = new Date(Date.now() + 90_000);
const local = new Date(alvo.getTime() - alvo.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
await dona.getByLabel('Quando').fill(local);
await dona.getByLabel('Texto da mensagem agendada').fill('Lembrem: jogo às 21h!');
await dona.getByRole('button', { name: 'Agendar' }).click();
await dona.locator('.comandos-lista li', { hasText: 'jogo às 21h' }).waitFor({ timeout: 10000 }).then(
  () => ok('a dona agendou a mensagem'),
  () => falhou('a mensagem agendada não apareceu na lista'),
);
await dona.locator('.settings-content').first().screenshot({ path: 'e2e/fotos/agendadas-config.png' });
await dona.keyboard.press('Escape');

await bia.locator('.channel-name', { hasText: /^geral$/ }).first().click();
await bia.locator('.message', { hasText: 'jogo às 21h' }).first().waitFor({ timeout: 180_000 }).then(
  async () => {
    const autor = await bia.locator('.message', { hasText: 'jogo às 21h' }).first().locator('.message-author').innerText();
    autor === 'Syden' ? ok('na hora, o Syden publicou a mensagem agendada') : falhou('publicada, mas por ' + autor);
  },
  () => falhou('a mensagem agendada não foi publicada'),
);

// ---------- lembrete ----------
const mensagem = bia.locator('.message', { hasText: 'jogo às 21h' }).first();
await mensagem.hover();
await mensagem.getByRole('button', { name: 'Lembrar de mim' }).click();
await bia.locator('.lembrete-menu').getByRole('menuitem').first().click();
await bia.getByText(/Combinado: lembro você em/).waitFor({ timeout: 10000 }).then(
  () => ok('a Bia pediu um lembrete e recebeu a confirmação'),
  () => falhou('o lembrete não confirmou'),
);

await browser.close();
resumo('Mensagens agendadas e lembretes');
