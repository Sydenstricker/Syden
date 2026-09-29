// O seletor de GIFs na tela.
//
// PRECISA DE UM GIPHY para rodar, e não precisa ser o de verdade. Suba o de mentira que vive no
// scratchpad da sessão (ou qualquer coisa que responda no formato deles) e aponte o servidor de teste
// para ele:
//
//   GIPHY_API_KEY=qualquer-coisa GIFS_ENDERECO=http://127.0.0.1:3199 ... npm run dev:server
//
// Sem GIPHY_API_KEY o botão NÃO APARECE, de propósito, e este teste confere isso também: botão que não
// pode funcionar é pior do que botão nenhum.

import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser, contexto } = await abrirNavegador();
const page = vigiar(await contexto.newPage());

await criarConta(page, 'gif');
await dispensarPresentes(page);
await page.locator('button[aria-label="Adicionar comunidade"]').click();
await page.getByText('Criar a minha').click();
await page.getByLabel('Nome da comunidade').fill('GIFs ' + Date.now().toString().slice(-4));
await page.locator('.dialog .btn-primary').click();
await page.locator('.channel-name').first().waitFor({ timeout: 20000 });
await page.locator('.channel-name', { hasText: /geral/ }).first().click();
ok('entrou numa comunidade com canal de texto');

// ---------- o botão só existe quando há GIF para dar ----------
const botao = page.locator('button[aria-label="GIFs"]');
await botao.waitFor({ timeout: 10000 }).catch(() => {});
if ((await botao.count()) === 0) {
  falhou('o botão de GIF não apareceu — o servidor foi subido sem GIPHY_API_KEY? (ver o cabeçalho deste arquivo)');
  await browser.close();
  resumo('gifs');
  process.exit();
}
ok('o botão de GIF está ao lado do de emoji');

// ---------- a grade abre já com alguma coisa, antes de digitar ----------
await botao.click();
await page.locator('.gif-picker').waitFor({ timeout: 8000 });
await page.locator('.gif-picker-item').first().waitFor({ timeout: 10000 });
const quantos = await page.locator('.gif-picker-item').count();
quantos >= 10 ? ok(`abriu com ${quantos} GIFs, sem ninguém digitar nada`) : falhou(`só ${quantos} GIFs na grade`);

const credito = await page.locator('.gif-picker-rodape').innerText();
/GIPHY/.test(credito) ? ok('o crédito de quem fornece o acervo está na tela: ' + credito) : falhou('sem crédito: ' + credito);

// A grade não pode empurrar a conversa para os lados em tela estreita.
const estouro = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
estouro === 0 ? ok('a grade não estoura a tela para o lado') : falhou(`estourou ${estouro}px`);
await page.screenshot({ path: 'e2e/fotos/gifs-grade.png' });

// ---------- a busca espera a pessoa parar de digitar ----------
// É o que segura a cota: são 100 buscas por hora para o Syden inteiro, e digitar "gatinho" letra por
// letra gastaria oito delas.
const antes = await page.locator('.gif-picker-item img').first().getAttribute('alt');
await page.locator('.gif-picker-busca input').type('gatinho', { delay: 40 });
await page.waitForTimeout(1400);
const depois = await page.locator('.gif-picker-item img').first().getAttribute('alt');
antes !== depois
  ? ok(`digitar trocou os resultados: "${antes}" virou "${depois}"`)
  : falhou(`a busca não mudou nada (continua "${antes}")`);

// ---------- escolher manda para a conversa ----------
await page.locator('.gif-picker-item').first().click();
await page.locator('.gif-picker').waitFor({ state: 'detached', timeout: 5000 });
ok('escolher fecha o painel');

const naConversa = page.locator('.message-gif, .message-text a').last();
await naConversa.waitFor({ timeout: 10000 });
ok('o GIF chegou na conversa');

// ---------- o que vira FIGURA e o que continua LINK ----------
// Endereço do GIPHY vira figura; endereço de qualquer outro lugar continua link, mesmo acabando em
// .gif. Isto é segurança, e não estilo: figura é o Syden mandando o navegador de TODO MUNDO que abrir
// a conversa buscar aquilo, o que entrega o endereço de rede de quem só estava lendo.
const campo = page.locator('textarea').first();
await campo.fill('https://media0.giphy.com/media/exemplo/giphy.gif');
await campo.press('Enter');
await page.locator('.message-gif').last().waitFor({ timeout: 10000 });
ok('endereço do GIPHY, sozinho, aparece como figura');

await campo.fill('https://exemplo.invalido/pegadinha.gif');
await campo.press('Enter');
await page.waitForTimeout(800);
const virouFigura = await page.locator('.message-gif[src*="exemplo.invalido"]').count();
virouFigura === 0
  ? ok('endereço de fora NÃO vira figura, mesmo acabando em .gif')
  : falhou('um endereço de fora virou figura: o navegador de quem lê iria buscar lá');

await page.screenshot({ path: 'e2e/fotos/gifs-na-conversa.png' });

await browser.close();
resumo('gifs');
