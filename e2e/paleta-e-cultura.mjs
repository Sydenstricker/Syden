// A paleta em Aparência e as seções novas da cultura (comida, dança, música, teatro).
//
// A cultura busca as fontes DE VERDADE (Commons e Gutendex) pelo servidor de teste: precisa de
// internet, e o teatro pode levar quase um minuto na primeira busca do dia.
//
//   SITE=http://localhost:5174/app/ node e2e/paleta-e-cultura.mjs   (API de teste na 3099)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, locale: 'pt-BR' });
const page = vigiar(await ctx.newPage());
await cadastrar(page, 'paleta' + s);
await dispensarPresentes(page);

// ---------- a cultura ----------

const abas = page.locator('.cultura-abas [role="tab"]');
await page
  .waitForFunction(() => document.querySelectorAll('.cultura-abas [role="tab"]').length >= 4, null, { timeout: 30000 })
  .then(
    async () => ok(`as abas da cultura chegaram: ${(await abas.allTextContents()).join(', ')}`),
    async () => falhou(`abas da cultura: ${(await abas.allTextContents()).join(', ') || 'nenhuma'}`),
  );

await page.getByRole('tab', { name: 'Comida' }).click();
await page.waitForTimeout(3000);
const pratos = await page.locator('.cultura-imagens img').evaluateAll((imgs) => imgs.filter((i) => i.naturalWidth > 0).length);
pratos >= 3 ? ok(`a comida mostra ${pratos} fotos, servidas pelo Syden`) : falhou(`comida: ${pratos} fotos carregaram`);

const musica = page.getByRole('tab', { name: 'Música' });
if ((await musica.count()) > 0) {
  await musica.click();
  const faixas = page.locator('.cultura-faixas audio');
  const quantas = await faixas.count();
  if (quantas >= 3) {
    ok(`a música traz ${quantas} gravações`);
    const src = await faixas.first().getAttribute('src');
    const preload = await faixas.first().getAttribute('preload');
    preload === 'none' ? ok('e nada baixa antes do play') : falhou('áudio com preload ' + preload);
    // O pedido de trecho é o que deixa avançar a música: o servidor repassa e responde 206.
    const resposta = await page.request.get(src, { headers: { range: 'bytes=0-1023' } });
    const tipo = resposta.headers()['content-type'];
    resposta.status() === 206 && tipo.startsWith('audio/')
      ? ok(`o áudio toca pelo Syden, em trechos (206, ${tipo})`)
      : falhou(`áudio: ${resposta.status()} ${tipo}`);
  } else {
    ok('o Brasil tem poucas gravações hoje: a aba de música vem só com os instrumentos');
  }
} else {
  falhou('a aba de música não apareceu');
}

await page
  .getByRole('tab', { name: 'Teatro' })
  .waitFor({ timeout: 90000 })
  .then(
    async () => {
      await page.getByRole('tab', { name: 'Teatro' }).click();
      const pecas = await page.locator('[role="tabpanel"] .cultura-livros li').count();
      pecas >= 3 ? ok(`o teatro chegou depois, sem segurar as outras: ${pecas} peças`) : falhou(`teatro: ${pecas} peças`);
    },
    () => falhou('a aba de teatro não chegou em 90 s'),
  );
// As capas carregam sob demanda: a foto espera todas chegarem.
await page
  .waitForFunction(() => [...document.querySelectorAll('.cultura img')].every((i) => i.complete), null, { timeout: 20000 })
  .catch(() => null);
const semCapa = await page.locator('[role="tabpanel"] .cultura-capa img').evaluateAll((imgs) => imgs.filter((i) => i.naturalWidth === 0).length);
semCapa === 0 ? ok('as capas das peças carregaram') : falhou(`${semCapa} capas de peça não carregaram`);
await page.locator('.cultura').screenshot({ path: 'e2e/fotos/cultura-secoes.png' });

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
resumo('Paleta e cultura');
