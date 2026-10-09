// Item 6: a aba dos coelhos na tela inicial. Os dois lado a lado, cada um se mexendo do seu jeito ao
// passar o mouse, e a escolha guardada. Desde o rebrand de 05/10/2026 ela troca SÓ o coelho: o ícone da
// barra é o D4, fixo, e o teste confere que ele NÃO muda.
// Desde 08/10/2026 a home é o quarto (Quarto.tsx), e a aba abre pelo PÔSTER do coelho. A estátua da praça, que
// mudava com a escolha, era da vila; no quarto o coelho é o da pintura.

import { abrirNavegador, cadastrar, dispensarPresentes, falhou, novaAba, ok, resumo } from './ajuda.mjs';

const { browser, contexto } = await abrirNavegador();
const page = await novaAba(contexto);

const s = Date.now().toString().slice(-5);
await cadastrar(page, 'coe' + s);
await dispensarPresentes(page);
ok('entrou na tela inicial');

// ---------- 1. o balão dos coelhos ----------
// O botão do pôster é o do teclado (o mouse clica no desenho, pelo quarto): foco e Enter.
const balao = page.getByRole('button', { name: /Coelhos/ });
await balao.waitFor({ state: 'attached', timeout: 8000 });
ok('o quarto tem o pôster dos coelhos');
await balao.focus();
await page.keyboard.press('Enter');
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
  return page.locator(seletor + ' .coelho-palco .coelho-figura').evaluate((el) => {
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
const quieto = await page.locator('.coelho-cartao.our .coelho-palco .coelho-figura').evaluate((el) => getComputedStyle(el).animationName);
quieto === 'none' ? ok('sem o mouse em cima, eles ficam quietos') : falhou('continua animando: ' + quieto);

// ---------- 3. escolher guarda a escolha, e não mexe no ícone ----------
const abrirAba = async () => {
  if (await painel.isVisible().catch(() => false)) return;
  await balao.focus();
  await page.keyboard.press('Enter');
  await painel.waitFor({ timeout: 6000 });
};
const logoAntes = await page.locator('.rail-logo').innerHTML();
await page.locator('.coelho-cartao.big').click();
await page.waitForTimeout(400);
await abrirAba();
(await painel.locator('.coelho-cartao.big.escolhido').count()) === 1 ? ok('o BigChunkus fica em uso') : falhou('a escolha não ficou');
const logoDepois = await page.locator('.rail-logo').innerHTML();
logoDepois === logoAntes ? ok('o ícone da barra lateral continua o mesmo') : falhou('o ícone mudou junto com o coelho');
await page.screenshot({ path: 'e2e/fotos/coelhos-escolhido.png' });

// ---------- 4. a escolha sobrevive a recarregar ----------
await page.reload();
await page.locator('.quarto').waitFor({ timeout: 25000 });
await dispensarPresentes(page);
await abrirAba();
(await painel.locator('.coelho-cartao.big.escolhido').count()) === 1 ? ok('a escolha continua depois de recarregar') : falhou('voltou ao OurBunny sozinho');

// ---------- 5. e dá para voltar ----------
await painel.locator('.coelho-cartao.our').click();
await page.waitForTimeout(400);
await abrirAba();
(await painel.locator('.coelho-cartao.our.escolhido').count()) === 1 ? ok('escolhendo o OurBunny, ele volta a ficar em uso') : falhou('não deu para voltar ao OurBunny');

await browser.close();
resumo('coelhos');
