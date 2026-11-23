// TRAZER A ESTRUTURA DE UM SERVIDOR DO DISCORD (23/11/2026): ao criar uma comunidade, colar o link de um modelo de servidor
// do Discord, ver a prévia (canais de texto, de voz, cargos) e criar. Usa um modelo PÚBLICO de verdade, o "Friends & Family"
// do próprio Discord (o servidor de teste fala com o Discord: precisa de internet). Um link inventado dá o erro certo.
//
//   node e2e/modelo-do-discord.mjs   (API de teste na 3099 e site na 5174)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const MODELO = process.env.MODELO ?? 'https://discord.new/hgM48av5Q69A';
const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

try {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const page = vigiar(await ctx.newPage());
  await cadastrar(page, 'dis' + s);
  await dispensarPresentes(page);

  await page.locator('button[aria-label="Adicionar comunidade"]').click();
  await page.getByRole('button', { name: /Criar a minha/ }).click();
  await page.getByRole('button', { name: 'Trazer de um servidor do Discord' }).click();

  // Um link que não é de modelo.
  const campo = page.locator('form.dialog input').last();
  await campo.fill('https://example.com/nada');
  await page.getByRole('button', { name: 'Ver o que vem' }).click();
  (await page.getByText('Esse link não é de um modelo de servidor do Discord.').waitFor({ timeout: 10000 }).then(() => true, () => false))
    ? ok('um link que não é de modelo dá o erro certo')
    : falhou('o link inválido não deu o erro esperado');

  await campo.fill(MODELO);
  await page.getByRole('button', { name: 'Ver o que vem' }).click();
  await page.locator('form.dialog').getByText('Aguarde…').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
  const previa = page.locator('form.dialog').getByText('Cargos').first();
  (await previa.waitFor({ timeout: 15000 }).then(() => true, () => false))
    ? ok('a prévia aparece com os canais e os cargos')
    : falhou(`a prévia não apareceu: ${(await page.locator('form.dialog').innerText()).slice(0, 300)}`);
  const textoDaPrevia = (await page.locator('form.dialog').innerText()).replace(/\s+/g, ' ');
  ok(`prévia: ${textoDaPrevia.slice(0, 400)}`);
  await page.screenshot({ path: 'e2e/fotos/modelo-do-discord-previa.png' });

  const nome = page.locator('form.dialog input').first();
  if (!(await nome.inputValue())) await nome.fill('Turma ' + s);
  ok(`o nome sugerido: "${await nome.inputValue()}"`);
  await page.locator('form.dialog').getByRole('button', { name: 'Criar', exact: true }).click();
  await page.locator('form.dialog').waitFor({ state: 'detached', timeout: 15000 });
  await page.waitForTimeout(1500);
  const canais = await page.locator('.channel-name').allInnerTexts();
  canais.length > 4
    ? ok(`a comunidade nasceu com os canais do modelo: ${canais.join(', ')}`)
    : falhou(`a comunidade nasceu só com ${canais.length} canais: ${canais.join(', ')}`);
  await page.screenshot({ path: 'e2e/fotos/modelo-do-discord-criada.png' });
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  await browser.close();
  resumo('o modelo do Discord');
}
