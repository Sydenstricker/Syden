// OS DADOS NO CHAT (27/11/2026): "/r 2d6+3" e a janela de dados rolam no servidor e viram um cartão 2D no canal.
//   Confere: o comando /r, a janela (dados de um toque, vantagem), a moeda, a escolha, os times e a iniciativa, a rolagem
//   secreta (a Bia não vê o resultado até a dona revelar) e que a mensagem de dado não tem o lápis de editar.
//   Fotografa o cartão em plena encenação (os números trocando) e depois do resultado, em e2e/fotos/dados/.
//
//   node e2e/dados.mjs   (API de teste na 3099 e site na 5174)
import { mkdirSync } from 'node:fs';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const permissions = ['clipboard-read', 'clipboard-write'];
mkdirSync('e2e/fotos/dados', { recursive: true });

async function entrar(nome, url) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, permissions });
  const page = vigiar(await ctx.newPage());
  if (url) {
    await page.goto(url);
    await page.getByLabel('Nome de usuário').fill(nome);
    await page.getByLabel('E-mail').fill(`${nome}@exemplo.test`);
    await page.getByLabel('Data de nascimento').fill('1990-01-01');
    await page.getByLabel('Senha', { exact: true }).fill('segredo123');
    await page.getByRole('button', { name: 'Cadastrar' }).click();
  } else {
    await cadastrar(page, nome);
  }
  await dispensarPresentes(page);
  return page;
}

async function menuDeDados(page) {
  await page.getByRole('button', { name: 'Enviar arquivo ou fazer enquete' }).click();
  await page.getByRole('menuitem', { name: 'Rolar dados' }).click();
  await page.locator('.dados-dialog').waitFor({ timeout: 5000 });
}

try {
  const dona = await entrar('dona' + s);
  await dona.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await dona.locator('.community-choice-option').first().click();
  await dona.locator('form.dialog input').first().fill('Mesa ' + s);
  await dona.locator('form.dialog .btn-primary').click();
  await dona.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const linha = dona.locator('.channel-row', { has: dona.locator('.channel-name', { hasText: /^geral$/ }) }).first();
  await linha.hover();
  await linha.getByRole('button', { name: 'Copiar link: geral' }).click();
  const convite = await dona.evaluate(() => navigator.clipboard.readText());
  const bia = await entrar('bia' + s, convite);
  await bia.locator('.channel.active').first().waitFor({ timeout: 20000 });
  ok('a Bia entrou na comunidade da dona');

  // ---------- o comando /r ----------
  await dona.locator('.composer textarea').first().fill('/r 4d6dl1+2');
  await dona.keyboard.press('Enter');
  const cartao = dona.locator('.dado-cartao').first();
  await cartao.waitFor({ timeout: 10000 });
  await dona.waitForTimeout(350);
  (await cartao.locator('.dado-forma.rolando').count()) > 0 ? ok('os dados estão rolando na encenação') : falhou('nenhum dado em movimento logo depois de rolar');
  await cartao.screenshot({ path: 'e2e/fotos/dados/01-rolando.png' });
  await dona.waitForTimeout(3500);
  (await cartao.locator('.dado-forma.rolando').count()) === 0 ? ok('a encenação termina') : falhou('os dados continuam rolando');
  const total = Number(await cartao.locator('.dado-total-numero').innerText());
  total >= 5 && total <= 20 ? ok(`4d6dl1+2 deu ${total}`) : falhou(`total fora do possível: ${total}`);
  (await cartao.locator('.dado-forma.descartado').count()) === 1 ? ok('um dado descartado, esmaecido') : falhou('o dado descartado não aparece');
  await cartao.screenshot({ path: 'e2e/fotos/dados/02-resultado.png' });
  // a Bia vê o mesmo cartão, e já com o resultado
  const daBia = bia.locator('.dado-cartao').first();
  await daBia.waitFor({ timeout: 10000 });
  await bia.waitForTimeout(3500);
  Number(await daBia.locator('.dado-total-numero').innerText()) === total ? ok('a Bia vê o mesmo total') : falhou('a Bia vê outro total');
  // dado não se edita
  const msg = dona.locator('.message', { has: dona.locator('.dado-cartao') }).first();
  await msg.hover();
  (await msg.locator('button[aria-label="Editar mensagem"]').count()) === 0 ? ok('a mensagem de dado não tem o lápis') : falhou('dá para editar a mensagem de dado');

  // ---------- a janela: d20 com vantagem ----------
  await menuDeDados(dona);
  await dona.getByRole('button', { name: 'Somar um d20' }).click();
  await dona.getByRole('button', { name: 'Aumentar o modificador' }).click();
  await dona.getByRole('button', { name: 'Aumentar o modificador' }).click();
  (await dona.locator('.dados-dialog input[placeholder="2d6+3"]').inputValue()) === '1d20+2' ? ok('os botões montam 1d20+2') : falhou('a expressão dos botões está errada');
  await dona.locator('.dados-modo label', { hasText: /^Vantagem$/ }).click();
  await dona.screenshot({ path: 'e2e/fotos/dados/03-janela.png' });
  await dona.locator('.dados-dialog .btn-primary').click();
  await dona.locator('.dado-cartao').nth(1).waitFor({ timeout: 10000 });
  await dona.waitForTimeout(3500);
  const d20 = dona.locator('.dado-cartao').nth(1);
  (await d20.locator('.dado-forma').count()) === 2 ? ok('a vantagem rola dois d20') : falhou('a vantagem não mostrou dois d20');
  await d20.screenshot({ path: 'e2e/fotos/dados/04-vantagem.png' });

  // ---------- os sorteios ----------
  await menuDeDados(dona);
  await dona.getByRole('tab', { name: 'Sorteios' }).click();
  await dona.locator('.dados-sorteios label', { hasText: 'Cara ou coroa' }).click();
  await dona.locator('.dados-dialog .btn-primary').click();
  await dona.locator('.dado-cartao.tipo-moeda').waitFor({ timeout: 10000 });
  await dona.waitForTimeout(1800);
  await dona.locator('.dado-cartao.tipo-moeda').screenshot({ path: 'e2e/fotos/dados/05-moeda.png' });
  ok('a moeda foi lançada');

  await menuDeDados(dona);
  await dona.getByRole('tab', { name: 'Sorteios' }).click();
  await dona.locator('.dados-sorteios label', { hasText: 'Escolher um' }).click();
  await dona.locator('.dados-dialog textarea').fill('pizza\nsushi\nhambúrguer\nchurrasco');
  await dona.locator('.dados-dialog .btn-primary').click();
  await dona.locator('.dado-cartao.tipo-escolha').waitFor({ timeout: 10000 });
  await dona.waitForTimeout(5500);
  (await dona.locator('.dado-cartao.tipo-escolha li.escolhida').count()) === 1 ? ok('a roleta parou numa opção') : falhou('a roleta não escolheu');
  await dona.locator('.dado-cartao.tipo-escolha').screenshot({ path: 'e2e/fotos/dados/06-roleta.png' });

  await menuDeDados(dona);
  await dona.getByRole('tab', { name: 'Sorteios' }).click();
  await dona.locator('.dados-sorteios label', { hasText: 'Times' }).click();
  await dona.locator('.dados-dialog textarea').fill('Ana\nBia\nCris\nDan\nEli');
  await dona.locator('.dados-dialog .btn-primary').click();
  await dona.locator('.dado-cartao.tipo-times').waitFor({ timeout: 10000 });
  (await dona.locator('.dado-cartao.tipo-times .dado-time').count()) === 2 ? ok('os times saíram em dois') : falhou('os times não saíram');
  await dona.locator('.dado-cartao.tipo-times').screenshot({ path: 'e2e/fotos/dados/07-times.png' });

  await menuDeDados(dona);
  await dona.getByRole('tab', { name: 'Sorteios' }).click();
  await dona.locator('.dados-sorteios label', { hasText: 'Iniciativa' }).click();
  await dona.locator('.dados-dialog textarea').fill('Ana +3\nBia\nDragão +10');
  await dona.locator('.dados-dialog .btn-primary').click();
  await dona.locator('.dado-cartao.tipo-iniciativa').waitFor({ timeout: 10000 });
  (await dona.locator('.dado-cartao.tipo-iniciativa li').count()) === 3 ? ok('a iniciativa ordenou os três') : falhou('a iniciativa não saiu');
  await dona.locator('.dado-cartao.tipo-iniciativa').screenshot({ path: 'e2e/fotos/dados/08-iniciativa.png' });

  // ---------- a rolagem secreta ----------
  await menuDeDados(dona);
  await dona.locator('.dados-dialog input[placeholder="2d6+3"]').fill('1d20');
  await dona.locator('.dados-dialog .poll-dialog-multi input').check();
  await dona.locator('.dados-dialog .btn-primary').click();
  const secretaDaDona = dona.locator('.dado-cartao.secreta');
  await secretaDaDona.waitFor({ timeout: 10000 });
  await dona.waitForTimeout(3500);
  (await secretaDaDona.getByRole('button', { name: 'Revelar para todos' }).count()) === 1 ? ok('a dona vê o botão de revelar') : falhou('sem botão de revelar');
  const secretaDaBia = bia.locator('.dado-cartao.oculta');
  await secretaDaBia.waitFor({ timeout: 10000 });
  (await secretaDaBia.locator('.dado-total-numero').count()) === 0 ? ok('a Bia não vê o resultado da rolagem secreta') : falhou('o resultado da secreta vazou para a Bia');
  await secretaDaBia.screenshot({ path: 'e2e/fotos/dados/09-secreta-na-bia.png' });
  await secretaDaDona.getByRole('button', { name: 'Revelar para todos' }).click();
  await bia.locator('.dado-cartao.tipo-dados .dado-total-numero').last().waitFor({ timeout: 10000 });
  ok('a rolagem secreta foi revelada e a Bia a vê');
  await bia.waitForTimeout(500);
  await bia.locator('.dado-cartao').last().screenshot({ path: 'e2e/fotos/dados/10-revelada-na-bia.png' });
  // o cartão no canal, em tela larga e no celular
  await dona.waitForTimeout(1500);
  await dona.screenshot({ path: 'e2e/fotos/dados/11-canal.png' });
  await bia.setViewportSize({ width: 390, height: 800 });
  await bia.waitForTimeout(800);
  await bia.screenshot({ path: 'e2e/fotos/dados/12-celular.png' });
  (await bia.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) ? ok('sem rolagem horizontal no celular') : falhou('o cartão estoura a largura no celular');
} catch (e) {
  falhou('exceção: ' + e.message);
} finally {
  await browser.close();
  resumo();
}
