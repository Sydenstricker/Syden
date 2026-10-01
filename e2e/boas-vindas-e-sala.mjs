// A tela de boas-vindas da comunidade COBRE a sala de voz, e clicar numa sala a fecha.
//
// OS DOIS DEFEITOS QUE ISTO TRANCA, descritos por quem usa: "cliquei na home, agora a sala está toda
// achatada" e "cliquei na sala para tentar sair da home mas não funcionou; só saiu quando cliquei no X".
//
// Eram duas causas independentes, as duas de uma linha:
//
//   1. O canal de TEXTO tinha `!mostrandoBoasVindas` na condição e o palco da voz não. Os dois
//      moravam na mesma coluna, então ficavam um embaixo do outro e a sala aparecia espremida numa
//      faixa no pé da tela — com a transmissão, as pessoas e os botões todos achatados.
//   2. `selectChannel` não fechava a tela de boas-vindas. Clicar na sala mudava o canal escolhido
//      por baixo de um painel que continuava cobrindo tudo, então o clique não fazia nada visível.
//
// A chamada NÃO CAI em nenhum dos dois casos: quem está na voz continua na voz. O que vai e volta é
// o palco.
//
//   node e2e/boas-vindas-e-sala.mjs
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador({ viewport: { width: 1500, height: 950 }, permissoes: ['microphone'] });
const page = await browser.newPage();
vigiar(page);

await criarConta(page, 'bv');
await dispensarPresentes(page);

const umaSala = page.locator('.channel-name', { hasText: /Sala/ }).first();
if ((await umaSala.count()) === 0) {
  falhou('esta comunidade não tem sala de voz; o teste precisa de uma');
  await browser.close();
  resumo('boas-vindas e sala de voz');
}

await umaSala.click();
await page.locator('.palco-e-conversa').waitFor({ timeout: 20000 });
ok('entrou numa sala de voz e o palco apareceu');

// ---------- abrir as boas-vindas ----------
await page.locator('.inicio-link').first().click();
await page.waitForTimeout(1000);

const comBoasVindas = await page.evaluate(() => ({
  boasVindas: document.querySelectorAll('.bv-blocos').length,
  palco: document.querySelectorAll('.palco-e-conversa').length,
}));

comBoasVindas.boasVindas === 1
  ? ok('a tela de boas-vindas abriu')
  : falhou(`a tela de boas-vindas não abriu (${comBoasVindas.boasVindas})`);

// ESTA É A MEDIDA DO PRIMEIRO DEFEITO. Antes, o palco continuava montado DEBAIXO das boas-vindas, e
// as duas dividiam a altura da coluna. Agora ele sai de cena enquanto o painel está aberto.
comBoasVindas.palco === 0
  ? ok('o palco sai de cena em vez de ficar espremido embaixo')
  : falhou('o palco continua montado junto com as boas-vindas: a sala fica achatada');

await page.screenshot({ path: 'e2e/fotos/boas-vindas-com-sala.png' });

// ---------- clicar na sala fecha as boas-vindas ----------
await umaSala.click();
await page.waitForTimeout(1000);

const depois = await page.evaluate(() => ({
  boasVindas: document.querySelectorAll('.bv-blocos').length,
  palco: document.querySelectorAll('.palco-e-conversa').length,
}));

depois.boasVindas === 0
  ? ok('clicar na sala fecha as boas-vindas — sem precisar achar o X')
  : falhou('as boas-vindas continuaram abertas depois de clicar na sala');

depois.palco === 1 ? ok('e o palco volta inteiro') : falhou('o palco não voltou');

await page.screenshot({ path: 'e2e/fotos/boas-vindas-depois-da-sala.png' });
await browser.close();
resumo('boas-vindas e sala de voz');
