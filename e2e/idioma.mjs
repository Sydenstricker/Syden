// Itens 2 e 13: o idioma se escolhe DENTRO do app, a troca vale na hora, e as letras de qualquer
// alfabeto aparecem certas (fonte de reserva por escrita).

import { CONVITE, SITE, abrirNavegador, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

// ---------- 1. a tela de entrada, em português e em inglês ----------
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: 'pt-BR' });
const page = await ctx.newPage();
vigiar(page);
await page.goto(SITE);
await page.getByText('Cadastre-se').waitFor({ timeout: 20000 });
ok('quem tem o computador em português vê o Syden em português');

// Quem tem o sistema em inglês já cai em inglês, sem mexer em nada.
const emIngles = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-US' });
const pagina2 = await emIngles.newPage();
vigiar(pagina2);
await pagina2.goto(SITE);
await pagina2.getByText('Sign up').first().waitFor({ timeout: 20000 });
const titulo = await pagina2.locator('.auth-card h1').innerText();
titulo === 'Welcome back!' ? ok('quem tem o computador em inglês já entra em inglês: ' + JSON.stringify(titulo)) : falhou('título: ' + titulo);
console.log('  html lang =', await pagina2.evaluate(() => document.documentElement.lang));
await pagina2.screenshot({ path: 'e2e/fotos/idioma-entrada-en.png' });
await emIngles.close();

// ---------- 2. dentro do app: trocar de idioma na hora ----------
await page.getByText('Cadastre-se').click();
await page.getByLabel('Nome de usuário').fill('idi' + s);
await page.getByLabel('Senha').fill('segredo123');
await page.getByLabel('Código de convite').fill(CONVITE);
await page.getByRole('button', { name: 'Cadastrar' }).click();
await page.locator('.vila').waitFor({ timeout: 30000 });
await dispensarPresentes(page);
await page.locator('.rail-list .rail-item').first().click();
await page.locator('.channel-name', { hasText: /geral/ }).first().click();
await page.getByText('Bem-vindo a #geral!').waitFor({ timeout: 20000 });
ok('entrou no app, em português');

await page.locator('.user-panel button[aria-label="Configurações"], button[aria-label="Configurações"]').first().click();
await page.locator('.settings-tab', { hasText: 'Idioma' }).click();
await page.locator('.idiomas').waitFor({ timeout: 8000 });
const escolhas = await page.locator('.idioma .idioma-nativo').allInnerTexts();
console.log('  idiomas prontos:', JSON.stringify(escolhas));
escolhas.length >= 3 ? ok('a aba de Idioma está dentro do app, com os idiomas prontos') : falhou('poucos idiomas: ' + JSON.stringify(escolhas));
await page.screenshot({ path: 'e2e/fotos/idioma-configuracoes.png' });

const quantosFuturos = await page.locator('.idioma-futuro').count();
quantosFuturos > 50
  ? ok(`e mais ${quantosFuturos} idiomas já mapeados, escritos no próprio alfabeto`)
  : falhou(`só ${quantosFuturos} idiomas mapeados`);

// ---------- 3. a troca vale NA HORA, sem recarregar ----------
await page.locator('.idioma', { hasText: 'English' }).click();
await page.waitForTimeout(700);
const abaAgora = await page.locator('.settings-content-inner h2').innerText();
abaAgora === 'Language' ? ok('escolheu English e a tela virou inglês na hora, sem recarregar') : falhou('a tela diz: ' + abaAgora);
const lang = await page.evaluate(() => document.documentElement.lang);
lang === 'en' ? ok('e a página se declara em inglês (html lang=en)') : falhou('html lang = ' + lang);
await page.screenshot({ path: 'e2e/fotos/idioma-em-ingles.png' });

// O que ainda não foi traduzido continua em português, e não vazio.
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const canais = await page.locator('.channel-group-title, .sidebar h3, .channel-group').first().innerText().catch(() => '');
console.log('  barra lateral em inglês:', JSON.stringify(canais.split('\n')[0]));

// ---------- 4. a escolha sobrevive a fechar o app ----------
await page.reload();
await page.locator('.rail-list').waitFor({ timeout: 25000 });
(await page.evaluate(() => document.documentElement.lang)) === 'en'
  ? ok('a escolha continua valendo depois de recarregar')
  : falhou('voltou ao português sozinho');

// ---------- 5. um idioma de outra escrita: fonte e sentido do texto ----------
const fonte = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fonte-idioma').trim());
console.log('  fonte de reserva no inglês:', fonte);
const arabe = await page.evaluate(async () => {
  const mod = await import('/src/i18n/index.ts');
  // O árabe ainda não tem dicionário, mas o motor precisa saber escrever nele quando tiver.
  const idioma = mod.idiomaPorCodigo('ar');
  return { existe: Boolean(idioma), rtl: idioma?.rtl === true, escrita: idioma?.escrita };
});
arabe.existe && arabe.rtl && arabe.escrita === 'arabe'
  ? ok('o árabe já está mapeado como escrita da direita para a esquerda')
  : falhou('árabe: ' + JSON.stringify(arabe));

// A fonte de cada escrita é buscada de verdade quando aquela escrita entra em cena.
const fontes = await page.evaluate(() => [...document.querySelectorAll('link[id^="fonte-"]')].map((l) => l.id));
console.log('  fontes preparadas:', JSON.stringify(fontes));
fontes.length > 0 ? ok('a fonte de reserva do alfabeto é carregada pelo app') : falhou('nenhuma fonte de reserva foi pedida');

await browser.close();
resumo('idioma');
