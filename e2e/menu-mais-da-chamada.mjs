// O menu "..." da chamada não se fecha quando se clica no que está dentro dele.
//
// O DEFEITO QUE ISTO TRANCA derrubava três funções com uma linha só. A div do menu tinha
// `onClick={() => setAberto(false)}`; como clique borbulha, apertar qualquer botão lá dentro
// desmontava o menu inteiro no mesmo instante. E quase tudo o que mora ali ABRE alguma coisa:
//
//   - a tesoura começava a fechar o clipe e era desmontada antes de ele existir — e o desmonte
//     parava a gravação em rolagem, então cada abertura do menu recomeçava do zero;
//   - o modificador de voz e o efeito visual abriam o submenu deles no mesmo clique em que o menu
//     de cima sumia.
//
// O relato foi "cliquei na tesoura, não vi acontecer nada". Não acontecia mesmo.
//
//   node e2e/menu-mais-da-chamada.mjs
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador({ viewport: { width: 1500, height: 950 }, permissoes: ['microphone'] });
const page = await browser.newPage();
vigiar(page);

await criarConta(page, 'mais');
await dispensarPresentes(page);

const sala = page.locator('.channel-name', { hasText: /Sala/ }).first();
if ((await sala.count()) === 0) {
  falhou('esta comunidade não tem sala de voz; o teste precisa de uma');
  await browser.close();
  resumo('o menu "..." da chamada');
}

await sala.click();
await page.locator('.palco-e-conversa').waitFor({ timeout: 25000 });
ok('entrou numa sala de voz');

const botaoMais = page.locator('.mais-anchor > button').first();
await botaoMais.waitFor({ timeout: 10000 });
await botaoMais.click();
await page.waitForTimeout(400);

(await page.locator('.mais-menu').count()) === 1 ? ok('o menu "..." abriu') : falhou('o menu "..." não abriu');

// ESTA É A MEDIDA DO DEFEITO: clicar num botão de dentro não pode levar o menu embora.
const modificador = page.locator('.mais-menu .voice-effect-anchor > button').first();
if ((await modificador.count()) === 0) {
  falhou('não achei o botão do modificador de voz dentro do menu');
} else {
  await modificador.click();
  await page.waitForTimeout(400);

  (await page.locator('.mais-menu').count()) === 1
    ? ok('clicar dentro do menu NÃO o fecha')
    : falhou('o menu se fechou sozinho ao clique — é o defeito que deixava a tesoura inútil');

  (await page.locator('.voice-effect-menu').count()) === 1
    ? ok('e o submenu do modificador de voz abriu de verdade')
    : falhou('o submenu do modificador de voz não apareceu');
}

await page.screenshot({ path: 'e2e/fotos/menu-mais-da-chamada.png' });

// Clicar FORA continua fechando: é o caminho que sempre funcionou, e o que sobrou no lugar.
await page.locator('.palco, .stage, body').first().click({ position: { x: 20, y: 20 } });
await page.waitForTimeout(400);
(await page.locator('.mais-menu').count()) === 0 ? ok('clicar fora fecha o menu') : falhou('o menu ficou aberto depois de clicar fora');

await browser.close();
resumo('o menu "..." da chamada');
