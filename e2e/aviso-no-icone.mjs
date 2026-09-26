// O número vermelho no ícone do Syden: acende com menção e com conversa direta, e apaga quando a pessoa
// olha. No navegador o sinal visível é o título da aba e o favicon redesenhado; no instalador do Windows
// o mesmo número vai para o ícone da barra de tarefas.
import { CONVITE, SITE, abrirNavegador, dispensarPresentes, falhou, novaPessoa, ok, resumo } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

async function entrar(nome) {
  const page = await novaPessoa(browser);
  await page.goto(SITE);
  await page.getByText('Cadastre-se').click();
  await page.getByLabel('Nome de usuário').fill(nome);
  await page.getByLabel('Senha').fill('segredo123');
  await page.getByLabel('Código de convite').fill(CONVITE);
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await page.locator('.vila').waitFor({ timeout: 30000 });
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /geral/ }).first().click();
  await page.getByText('Bem-vindo a #geral!').waitFor({ timeout: 20000 });
  return page;
}

const ana = await entrar('ana' + s);
const bia = await entrar('bia' + s);
ok('as duas entraram no mesmo canal');

const titulo = (page) => page.title();

(await titulo(ana)) === 'Syden' ? ok('sem avisos, o título é só "Syden"') : falhou('título de partida: ' + (await titulo(ana)));

// ---------- 1. conversa no canal, sem chamar ninguém: não acende ----------
// Se acendesse com qualquer mensagem, o número ficaria sempre ligado e deixaria de querer dizer algo.
await ana.locator('.composer textarea').fill('bom dia, pessoal');
await ana.keyboard.press('Enter');
await bia.waitForTimeout(1200);
(await titulo(bia)) === 'Syden' ? ok('conversa solta no canal não acende o aviso') : falhou('acendeu à toa: ' + (await titulo(bia)));

// ---------- 2. menção ao nome: acende ----------
// A bia precisa estar sem foco, como se estivesse em outra janela — é o caso real.
await bia.evaluate(() => Object.defineProperty(document, 'hidden', { value: true, configurable: true }));
await ana.locator('.composer textarea').fill(`@bia${s} olha isso aqui`);
await ana.keyboard.press('Enter');
await bia.waitForTimeout(1500);

const comMencao = await titulo(bia);
comMencao.startsWith('(1)') ? ok('menção ao nome acende o número: ' + comMencao) : falhou('não acendeu: ' + comMencao);

// O favicon foi redesenhado com o selo vermelho.
const favicon = await bia.locator('link[rel~="icon"]').getAttribute('href');
favicon?.startsWith('data:image/png') ? ok('e o ícone da aba ganhou o selo vermelho') : falhou('favicon intacto: ' + favicon?.slice(0, 40));

// ---------- 3. nome parecido não acende para a pessoa errada ----------
await ana.locator('.composer textarea').fill(`@bia${s}zinha teste`);
await ana.keyboard.press('Enter');
await bia.waitForTimeout(1200);
(await titulo(bia)).startsWith('(1)') ? ok('"@bia...zinha" não conta como menção à bia') : falhou('contou errado: ' + (await titulo(bia)));

// ---------- 4. @todos acende para quem está no canal ----------
await ana.locator('.composer textarea').fill('@todos reunião agora');
await ana.keyboard.press('Enter');
await bia.waitForTimeout(1500);
(await titulo(bia)).startsWith('(2)') ? ok('@todos também acende') : falhou('@todos não contou: ' + (await titulo(bia)));

// ---------- 5. abrir o canal apaga ----------
// Voltar para a janela: no navegador de verdade isso dispara o evento; aqui o teste o dispara à mão.
await bia.evaluate(() => {
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await bia.locator('.channel-name', { hasText: /geral/ }).first().click();
await bia.waitForTimeout(1200);
(await titulo(bia)) === 'Syden' ? ok('abrir o canal apaga o aviso') : falhou('continuou aceso: ' + (await titulo(bia)));

await bia.screenshot({ path: 'e2e/fotos/aviso-no-icone.png' });

await browser.close();
resumo('aviso-no-icone');
