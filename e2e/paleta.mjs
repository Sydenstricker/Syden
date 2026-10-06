// A paleta em Aparência: D4, Clássica, Grafite e Alto contraste.
//
//   SITE=http://localhost:5174/app/ node e2e/paleta.mjs   (API de teste na 3099)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, locale: 'pt-BR' });
const page = vigiar(await ctx.newPage());
await cadastrar(page, 'paleta' + s);
await dispensarPresentes(page);

// ---------- a paleta ----------

const corDe = (nome) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), nome);
await page.locator('button[aria-label="Configurações"]').first().click();
await page.locator('.settings-tab', { hasText: /Aparência/ }).first().click();
const opcoes = page.locator('.paleta-do-syden [role="radio"]');
await opcoes.first().waitFor({ timeout: 10000 });
(await opcoes.count()) === 4 ? ok('a Aparência oferece quatro paletas') : falhou(`paletas: ${await opcoes.count()}`);
(await page.locator('.paleta-do-syden [aria-checked="true"]').textContent()).startsWith('D4')
  ? ok('e a D4 vem escolhida')
  : falhou('a D4 não veio escolhida');

await page.getByRole('radio', { name: /Clássica/ }).click();
const classica = [await corDe('--bg-main'), await corDe('--accent'), await page.evaluate(() => document.documentElement.dataset.paleta)];
classica.join(' ') === '#313338 #5865f2 classica'
  ? ok('a Clássica volta às cores de antes do rebrand (#313338, #5865f2)')
  : falhou('Clássica: ' + classica.join(' '));
await page.screenshot({ path: 'e2e/fotos/paleta-classica.png' });

await page.reload();
await page.locator('.rail-list').first().waitFor({ timeout: 20000 });
// A abertura fica por cima por dois segundos depois de carregar (ver abertura.ts); a foto espera ela sair.
await page.locator('#abertura').waitFor({ state: 'detached', timeout: 10000 });
(await corDe('--bg-main')) === '#313338' ? ok('e continua depois de recarregar') : falhou('a paleta não sobreviveu ao recarregar');

for (const [nome, rotulo] of [['grafite', /Grafite/], ['contraste', /Alto contraste/]]) {
  await page.locator('button[aria-label="Configurações"]').first().click();
  await page.locator('.settings-tab', { hasText: /Aparência/ }).first().click();
  await page.getByRole('radio', { name: rotulo }).click();
  await page.screenshot({ path: `e2e/fotos/paleta-${nome}.png` });
  (await page.evaluate(() => document.documentElement.dataset.paleta)) === nome ? ok(`a ${nome} entra`) : falhou(`a ${nome} não entrou`);
  await page.keyboard.press('Escape');
}

// A cor própria vai por cima de qualquer paleta, escurecida para o BRANCO caber — e o texto em cima
// dela tem de ser branco. Antes ficava azul-noite sobre fundo escuro.
await page.locator('button[aria-label="Configurações"]').first().click();
await page.locator('.settings-tab', { hasText: /Aparência/ }).first().click();
await page.getByRole('radio', { name: /^D4/ }).click();
await page.locator('.cor-do-syden input[type="color"]').fill('#2e7d32');
(await corDe('--accent-texto')) === '#ffffff'
  ? ok('com uma cor própria, o texto sobre o destaque é branco')
  : falhou('texto sobre a cor própria: ' + (await corDe('--accent-texto')));
await page.getByRole('button', { name: 'Voltar ao padrão' }).click();
(await corDe('--accent-texto')) === '#14161b' ? ok('e volta ao azul-noite da D4 sem ela') : falhou('accent-texto: ' + (await corDe('--accent-texto')));

await browser.close();
resumo('Paleta');
