// A home é o quarto do coelho (web/src/Quarto.tsx), desde 08/10/2026.
//
// O que se confere, num Chrome de verdade: o quarto aparece; passar o mouse num objeto acende o rótulo dele; o clique
// acerta o DESENHO (um ponto da caixa da janela fora da janela não faz nada); o abajur troca dia e noite; os objetos
// levam aonde devem (o pôster abre os coelhos, o fone abre as salas); e o teclado chega aos mesmos objetos.

import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
vigiar(page);
await cadastrar(page, 'quarto' + s);
await dispensarPresentes(page);
await page.locator('.quarto').waitFor({ timeout: 30000 });
ok('a home é o quarto');

const caixa = await page.locator('.quarto').boundingBox();
/** O ponto (x, y) do quarto, em pixels dele (313 × 314), na tela. */
const naTela = (x, y) => [caixa.x + ((x + 0.5) / 313) * caixa.width, caixa.y + ((y + 0.5) / 314) * caixa.height];
const rotulo = () => page.locator('.quarto-rotulo strong').innerText({ timeout: 1500 }).catch(() => '');

// A janela: o meio do vidro é janela; o canto de cima à direita da caixa dela é parede.
await page.mouse.move(...naTela(192, 85));
await page.waitForTimeout(200);
(await rotulo()) === 'Explorar' ? ok('passar o mouse na janela acende "Explorar"') : falhou(`o rótulo na janela foi "${await rotulo()}"`);
await page.mouse.move(...naTela(236, 30));
await page.waitForTimeout(200);
(await page.locator('.quarto-rotulo').count()) === 0
  ? ok('na parede dentro da caixa da janela, nada acende (o clique é pelo desenho)')
  : falhou('acendeu fora do desenho da janela');

// O abajur troca dia e noite.
const antes = await page.locator('.quarto').getAttribute('class');
await page.mouse.click(...naTela(56, 140));
await page.waitForTimeout(300);
const depois = await page.locator('.quarto').getAttribute('class');
antes.includes('de-dia') !== depois.includes('de-dia') ? ok('o abajur troca dia e noite') : falhou('o abajur não trocou');

// O pôster abre os coelhos.
await page.mouse.click(...naTela(122, 60));
(await page.locator('.vila-painel.coelhos').waitFor({ timeout: 5000 }).then(() => true, () => false))
  ? ok('o pôster abre a escolha de coelhos')
  : falhou('o pôster não abriu os coelhos');
await page.keyboard.press('Escape');
await page.locator('.vila-painel.coelhos button[aria-label="Fechar"]').click().catch(() => {});

// O fone abre as salas.
// No arco do fone, e não no meio: o meio é o vão do anel, e ali não há desenho.
await page.mouse.click(...naTela(278, 135));
(await page.locator('.vila-painel[aria-label="Salas de voz"]').waitFor({ timeout: 5000 }).then(() => true, () => false))
  ? ok('o fone abre as salas')
  : falhou('o fone não abriu as salas');

// O teclado chega aos objetos: o foco num deles acende o rótulo.
await page.locator('.quarto-alvo').first().focus();
await page.waitForTimeout(200);
(await rotulo()) ? ok(`o teclado acende os objetos ("${await rotulo()}")`) : falhou('o foco do teclado não acendeu nada');

await page.screenshot({ path: 'e2e/fotos/quarto-home.png' });
await browser.close();
resumo('quarto-home');
