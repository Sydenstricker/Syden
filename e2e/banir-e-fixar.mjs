// BANIR DA COMUNIDADE E FIXAR MENSAGENS (23/11/2026): a dona cria a comunidade e a Bia entra pelo convite.
//   Fixar: a Bia escreve, a dona fixa pelo alfinete da mensagem; a Bia vê o alfinete na hora e a mensagem no painel do
//   cabeçalho, sem o botão de desafixar (ela não administra); a dona desafixa pelo painel.
//   Banir: a dona, pelo botão direito sobre a Bia, bane (a confirmação no próprio menu); a comunidade some para a Bia, e o
//   convite a recusa; a dona vê a Bia em Configurações → Membros → Pessoas banidas e desbane; o convite volta a valer.
//
//   node e2e/banir-e-fixar.mjs   (API de teste na 3099 e site na 5174)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const permissions = ['clipboard-read', 'clipboard-write'];
const sim = (p) => p.then(() => true, () => false);

async function entrar(nome, url) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions });
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

try {
  const dona = await entrar('dona' + s);
  await dona.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await dona.locator('.community-choice-option').first().click();
  await dona.locator('form.dialog input').first().fill('Clã ' + s);
  await dona.locator('form.dialog .btn-primary').click();
  await dona.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const linha = dona.locator('.channel-row', { has: dona.locator('.channel-name', { hasText: /^geral$/ }) }).first();
  await linha.hover();
  await linha.getByRole('button', { name: 'Copiar link: geral' }).click();
  const convite = await dona.evaluate(() => navigator.clipboard.readText());
  const bia = await entrar('bia' + s, convite);
  await bia.locator('.channel.active').first().waitFor({ timeout: 20000 });
  ok('a Bia entrou na comunidade da dona');

  // ---------- fixar ----------
  const caixa = bia.locator('.composer textarea').first();
  await caixa.fill('O IP do servidor do jogo é 10.0.0.1');
  await bia.keyboard.press('Enter');
  const naDona = dona.locator('.message', { hasText: 'O IP do servidor do jogo' }).first();
  await naDona.waitFor({ timeout: 10000 });
  (await bia.locator('.message', { hasText: 'O IP do servidor' }).locator('button[aria-label="Fixar mensagem"]').count()) === 0
    ? ok('quem não administra não tem o alfinete nas mensagens')
    : falhou('a Bia tem o botão de fixar');
  await naDona.hover();
  await naDona.getByRole('button', { name: 'Fixar mensagem' }).click();
  (await sim(bia.locator('.message', { hasText: 'O IP do servidor' }).locator('.mensagem-fixada').waitFor({ timeout: 8000 })))
    ? ok('a dona fixa, e a Bia vê o alfinete na mensagem na hora')
    : falhou('o alfinete não apareceu para a Bia');
  await bia.getByRole('button', { name: 'Mensagens fixadas' }).click();
  const painelBia = bia.locator('.fixadas-painel');
  (await sim(painelBia.getByText('O IP do servidor do jogo é 10.0.0.1').waitFor({ timeout: 5000 })))
    ? ok('a mensagem aparece no painel das fixadas da Bia')
    : falhou('o painel das fixadas da Bia não mostrou a mensagem');
  (await painelBia.locator('button[aria-label="Desafixar mensagem"]').count()) === 0
    ? ok('e sem o botão de desafixar para ela')
    : falhou('a Bia tem o botão de desafixar');
  await bia.screenshot({ path: 'e2e/fotos/fixadas-painel.png' });
  await painelBia.getByRole('button', { name: 'Ir até a mensagem' }).click();
  (await painelBia.count()) === 0 ? ok('"Ir até a mensagem" fecha o painel e leva até ela') : falhou('o painel não fechou ao ir até a mensagem');

  await dona.getByRole('button', { name: 'Mensagens fixadas' }).click();
  await dona.locator('.fixadas-painel button[aria-label="Desafixar mensagem"]').first().click();
  (await sim(dona.locator('.fixadas-painel').getByText('Nenhuma mensagem fixada.').waitFor({ timeout: 5000 })))
    ? ok('a dona desafixa pelo painel')
    : falhou('desafixar pelo painel não esvaziou a lista');
  (await sim(bia.locator('.message', { hasText: 'O IP do servidor' }).locator('.mensagem-fixada').waitFor({ state: 'detached', timeout: 8000 })))
    ? ok('e o alfinete some da mensagem para a Bia')
    : falhou('o alfinete continuou para a Bia');
  await dona.keyboard.press('Escape');

  // ---------- banir ----------
  await dona.locator('.members .member', { hasText: 'bia' + s }).first().click({ button: 'right' });
  await dona.locator('.person-menu').waitFor({ timeout: 5000 });
  await dona.screenshot({ path: 'e2e/fotos/banir-menu.png' });
  await dona.getByRole('menuitem', { name: /Banir da comunidade…/ }).click();
  await dona.screenshot({ path: 'e2e/fotos/banir-confirmacao.png' });
  await dona.locator('.moderacao-da-pessoa').getByRole('button', { name: 'Banir', exact: true }).click();
  (await sim(bia.locator(`.rail-list .rail-item[aria-label="Clã ${s}"]`).waitFor({ state: 'detached', timeout: 10000 })))
    ? ok('banida, a comunidade some da tela da Bia na hora')
    : falhou('a comunidade continuou na tela da Bia');
  const tentar = () =>
    bia.evaluate(async (codigo) => {
      const r = await fetch('http://localhost:3099/api/communities/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem('janja.token') },
        body: JSON.stringify({ code: codigo }),
      });
      return { status: r.status, corpo: await r.json() };
    }, new URL(convite).searchParams.get('convite'));
  const volta = await tentar();
  volta.status === 403 ? ok(`o convite recusa a Bia: "${volta.corpo.error}"`) : falhou(`o convite aceitou a Bia banida: ${JSON.stringify(volta)}`);

  await dona.locator('button[aria-label="Configurações"]').first().click();
  await dona.locator('.settings-tab', { hasText: 'Membros' }).first().click();
  const linhaBanida = dona.locator('.expression-row', { hasText: 'bia' + s });
  (await sim(dona.getByText('Pessoas banidas').waitFor({ timeout: 5000 }))) && (await sim(linhaBanida.waitFor({ timeout: 5000 })))
    ? ok('a dona vê a Bia em Pessoas banidas, com quem baniu e quando')
    : falhou('a lista de banidas não mostrou a Bia');
  await dona.screenshot({ path: 'e2e/fotos/banidos-lista.png' });
  await linhaBanida.getByRole('button', { name: `Desbanir bia${s}` }).click();
  (await sim(dona.getByText('Ninguém foi banido desta comunidade.').waitFor({ timeout: 5000 })))
    ? ok('desbanir tira a Bia da lista')
    : falhou('a Bia continuou na lista depois de desbanir');
  const depois = await tentar();
  depois.status === 200 ? ok('e o convite volta a valer para ela') : falhou(`desbanida, o convite ainda recusa: ${JSON.stringify(depois)}`);
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  await browser.close();
  resumo('banir e fixar');
}
