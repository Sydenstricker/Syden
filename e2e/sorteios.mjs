// Sorteios: a dona cria um sorteio que termina daqui a dois minutos e pouco (o mínimo é 1; o campo corta os segundos), o Syden o
// anuncia no #geral com o 🎉 pronto, a Bia clica no 🎉 e, na hora, o Syden publica que ela ganhou.
// "Sortear de novo" sem mais ninguém para sortear avisa o motivo.
//
//   SITE=http://localhost:5174/app/ node e2e/sorteios.mjs   (API de teste na 3099)
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

// ---------- a dona cria o sorteio ----------
await dona.locator('button[aria-label="Configurações"]').first().click();
await dona.locator('.settings-tab', { hasText: /Sorteios/ }).first().click();
const alvo = new Date(Date.now() + 150_000);
const local = new Date(alvo.getTime() - alvo.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
await dona.getByLabel('Prêmio').fill('Uma caneca do Syden');
await dona.getByLabel('Termina em').fill(local);
await dona.getByRole('button', { name: 'Começar o sorteio' }).click();
await dona.locator('.comandos-lista li', { hasText: 'Uma caneca do Syden' }).waitFor({ timeout: 10000 }).then(
  () => ok('a dona começou o sorteio'),
  () => falhou('o sorteio não apareceu na lista'),
);

// ---------- a Bia participa ----------
await bia.locator('.channel-name', { hasText: /^geral$/ }).first().click();
const anuncio = bia.locator('.message', { hasText: 'Sorteio: Uma caneca do Syden' }).first();
await anuncio.waitFor({ timeout: 15000 }).then(
  () => ok('o Syden anunciou o sorteio no #geral'),
  () => falhou('o anúncio não chegou'),
);
const reacao = anuncio.locator('.reaction-pill', { hasText: '🎉' }).first();
await reacao.click();
await anuncio.locator('.reaction-pill.mine', { hasText: '2' }).first().waitFor({ timeout: 10000 }).then(
  () => ok('a Bia clicou no 🎉 que o Syden deixou pronto'),
  () => falhou('a reação da Bia não contou'),
);
await anuncio.screenshot({ path: 'e2e/fotos/sorteio-anuncio.png' });

// ---------- o resultado ----------
const resultado = bia.locator('.message', { hasText: 'Resultado do sorteio de Uma caneca do Syden' }).first();
await resultado.waitFor({ timeout: 180_000 }).then(
  async () => {
    const texto = await resultado.innerText();
    texto.includes('bia' + s) ? ok('na hora, o Syden sorteou e a Bia ganhou') : falhou('o resultado não nomeia a Bia: ' + texto);
  },
  () => falhou('o resultado não foi publicado'),
);

// A lista da dona só se atualiza ao abrir de novo a seção.
await dona.locator('.settings-tab', { hasText: /Mensagens agendadas/ }).first().click();
await dona.locator('.settings-tab', { hasText: /Sorteios/ }).first().click();
const item = dona.locator('.comandos-lista li', { hasText: 'Uma caneca do Syden' }).first();
await item.getByText('Quem ganhou: bia' + s).waitFor({ timeout: 10000 }).then(
  () => ok('a lista da dona mostra quem ganhou'),
  () => falhou('a lista não mostra a ganhadora'),
);
await item.getByRole('button', { name: 'Sortear de novo' }).click();
await dona.getByText('Não sobrou ninguém para sortear.').waitFor({ timeout: 10000 }).then(
  () => ok('sortear de novo sem mais ninguém explica o porquê'),
  () => falhou('sortear de novo não avisou nada'),
);
await dona.locator('.settings-content').first().screenshot({ path: 'e2e/fotos/sorteios-config.png' });

await browser.close();
resumo('Sorteios');
