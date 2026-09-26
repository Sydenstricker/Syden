// Item 6: a aba dos coelhos na tela inicial. Os dois lado a lado, cada um se mexendo do seu jeito ao
// passar o mouse, e a escolha valendo no app inteiro (ícone da barra e estátua da praça).

import { CONVITE, SITE, abrirNavegador, dispensarPresentes, falhou, novaAba, ok, resumo } from './ajuda.mjs';

const { browser, contexto } = await abrirNavegador();
const page = await novaAba(contexto);

const s = Date.now().toString().slice(-5);
await page.goto(SITE);
await page.getByText('Cadastre-se').click();
await page.getByLabel('Nome de usuário').fill('coe' + s);
await page.getByLabel('Senha').fill('segredo123');
await page.getByLabel('Código de convite').fill(CONVITE);
await page.getByRole('button', { name: 'Cadastrar' }).click();
await page.locator('.vila').waitFor({ timeout: 30000 });
await dispensarPresentes(page);
ok('entrou na tela inicial');

// ---------- 1. o balão dos coelhos ----------
const balao = page.getByRole('button', { name: /Coelhos/ });
await balao.waitFor({ timeout: 8000 });
ok('a vila tem o balão dos coelhos, em cima da estátua');
await balao.click();
const painel = page.locator('.vila-painel.coelhos');
await painel.waitFor({ timeout: 6000 });

const cartoes = await painel.locator('.coelho-cartao strong').allInnerTexts();
console.log('  coelhos na aba:', JSON.stringify(cartoes));
cartoes.includes('OurBunny') && cartoes.includes('BigChunkus') ? ok('os dois estão lá') : falhou('faltou alguém: ' + JSON.stringify(cartoes));
(await painel.locator('.coelho-cartao.our.escolhido').count()) === 1 ? ok('o OurBunny começa em uso') : falhou('o padrão não é o OurBunny');
await page.screenshot({ path: 'e2e/fotos/coelhos-aba.png' });

// ---------- 2. o hover mexe com cada um, do jeito dele ----------
const animacao = async (seletor) => {
  await page.locator(seletor).hover();
  await page.waitForTimeout(400);
  return page.locator(seletor + ' .coelho-palco img').evaluate((el) => {
    const nome = getComputedStyle(el).animationName;
    const a = el.getBoundingClientRect();
    return { nome, altura: a.height };
  });
};
const our = await animacao('.coelho-cartao.our');
our.nome === 'coelho-pulo' ? ok('o OurBunny pula com o mouse em cima') : falhou('animação do Our: ' + our.nome);
const faisca = await page.locator('.coelho-cartao.our .faisca').first().evaluate((el) => getComputedStyle(el).animationName);
faisca === 'faiscar' ? ok('e solta estrelinhas') : falhou('estrelinha: ' + faisca);

const big = await animacao('.coelho-cartao.big');
big.nome === 'coelho-peso' ? ok('o BigChunkus afunda, como peso pesado') : falhou('animação do Big: ' + big.nome);
const poeira = await page.locator('.coelho-cartao.big .poeira').evaluate((el) => getComputedStyle(el).animationName);
poeira === 'poeirinha' ? ok('e levanta poeira ao cair') : falhou('poeira: ' + poeira);

// Parado, ninguém fica se mexendo à toa.
await page.mouse.move(10, 10);
await page.waitForTimeout(300);
const quieto = await page.locator('.coelho-cartao.our .coelho-palco img').evaluate((el) => getComputedStyle(el).animationName);
quieto === 'none' ? ok('sem o mouse em cima, eles ficam quietos') : falhou('continua animando: ' + quieto);

// ---------- 3. escolher troca o coelho do Syden inteiro ----------
const logoAntes = await page.locator('.rail-logo img').getAttribute('src');
await page.locator('.coelho-cartao.big').click();
await page.waitForTimeout(400);
(await page.locator('.coelho-cartao.big.escolhido').count()) === 1 ? ok('o BigChunkus entrou em uso') : falhou('não marcou a escolha');
const logoDepois = await page.locator('.rail-logo img').getAttribute('src');
logoDepois !== logoAntes ? ok('o ícone da barra lateral trocou junto') : falhou('o ícone não mudou');
(await page.locator('.v-estatua .v-gordo').count()) === 1 ? ok('e a estátua da praça também') : falhou('a estátua não acompanhou');
await page.screenshot({ path: 'e2e/fotos/coelhos-escolhido.png' });

// ---------- 4. a escolha sobrevive a recarregar ----------
await page.reload();
await page.locator('.vila').waitFor({ timeout: 25000 });
await dispensarPresentes(page);
await page.waitForTimeout(600);
(await page.locator('.v-estatua .v-gordo').count()) === 1 ? ok('a escolha continua depois de recarregar') : falhou('voltou ao OurBunny sozinho');

// ---------- 5. e a estátua continua trocando com um clique ----------
await page.locator('.v-estatua').click({ force: true });
await page.waitForTimeout(400);
(await page.locator('.v-estatua .v-gordo').count()) === 0 ? ok('clicar na estátua volta ao OurBunny') : falhou('a estátua não trocou');
await page.getByRole('button', { name: /Coelhos/ }).click();
await page.locator('.vila-painel.coelhos').waitFor({ timeout: 6000 });
(await page.locator('.coelho-cartao.our.escolhido').count()) === 1
  ? ok('e a aba mostra a mesma escolha: é uma só, em todo canto')
  : falhou('a aba discorda da estátua');

await browser.close();
resumo('coelhos');
