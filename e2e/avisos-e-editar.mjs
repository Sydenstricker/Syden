// O CANAL DE AVISOS E O EDITAR MENSAGEM (23/11/2026): a dona cria a comunidade e a Bia entra pelo convite.
//   Editar: a Bia escreve, edita pelo lápis da mensagem (Enter salva), e a dona vê o texto novo com o "(editada)" na hora;
//   a dona não tem o lápis na mensagem da Bia; Esc desiste sem mudar nada.
//   Avisos: a dona liga o #geral como canal de avisos em Configurações → Moderação; para a Bia, a caixa de escrever vira a
//   nota, o ícone do canal vira o megafone, e ela conversa no tópico de um aviso; a dona desliga e a caixa volta.
//
//   node e2e/avisos-e-editar.mjs   (API de teste na 3099 e site na 5174)
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
  await dona.locator('form.dialog input').first().fill('Avisos ' + s);
  await dona.locator('form.dialog .btn-primary').click();
  await dona.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const linha = dona.locator('.channel-row', { has: dona.locator('.channel-name', { hasText: /^geral$/ }) }).first();
  await linha.hover();
  await linha.getByRole('button', { name: 'Copiar link: geral' }).click();
  const convite = await dona.evaluate(() => navigator.clipboard.readText());
  const bia = await entrar('bia' + s, convite);
  await bia.locator('.channel.active').first().waitFor({ timeout: 20000 });
  ok('a Bia entrou na comunidade da dona');

  // ---------- editar ----------
  await bia.locator('.composer textarea').first().fill('Encontro às 19h no servidor');
  await bia.keyboard.press('Enter');
  const naDona = dona.locator('.message', { hasText: 'Encontro às' }).first();
  await naDona.waitFor({ timeout: 10000 });
  await naDona.hover();
  (await naDona.locator('button[aria-label="Editar mensagem"]').count()) === 0
    ? ok('a dona não tem o lápis na mensagem da Bia')
    : falhou('a dona pode editar a mensagem da Bia');
  const minha = bia.locator('.message', { hasText: 'Encontro às' }).first();
  await minha.hover();
  await minha.getByRole('button', { name: 'Editar mensagem' }).click();
  const caixaDeEditar = bia.locator('.mensagem-edicao textarea');
  await caixaDeEditar.waitFor({ timeout: 5000 });
  await caixaDeEditar.fill('isto não vai ficar');
  await bia.keyboard.press('Escape');
  (await sim(caixaDeEditar.waitFor({ state: 'detached', timeout: 3000 }))) && (await minha.textContent()).includes('19h')
    ? ok('Esc desiste da edição sem mudar nada')
    : falhou('Esc não desistiu da edição');
  await minha.hover();
  await minha.getByRole('button', { name: 'Editar mensagem' }).click();
  await caixaDeEditar.fill('Encontro às 20h no servidor');
  await bia.keyboard.press('Enter');
  (await sim(dona.locator('.message', { hasText: 'Encontro às 20h' }).locator('.mensagem-editada').waitFor({ timeout: 8000 })))
    ? ok('Enter salva, e a dona vê o texto novo com o "(editada)" na hora')
    : falhou('a edição não chegou à dona');
  (await sim(minha.locator('.mensagem-editada').waitFor({ timeout: 5000 }))) && !(await minha.textContent()).includes('19h')
    ? ok('e a própria Bia vê a mensagem trocada')
    : falhou('a mensagem da Bia não trocou na tela dela');
  await dona.screenshot({ path: 'e2e/fotos/mensagem-editada.png' });

  // ---------- canal de avisos ----------
  await dona.locator('button[aria-label="Configurações"]').first().click();
  // a Moderação fica dentro de Ferramentas (recolhidas)
  if (!(await dona.locator('.settings-tab', { hasText: 'Moderação' }).count())) await dona.locator('.settings-tab.settings-grupo').first().click();
  await dona.locator('.settings-tab', { hasText: 'Moderação' }).first().click();
  const marca = dona.locator('.cargo-linha', { hasText: 'geral' }).locator('input[type="checkbox"]').last();
  await marca.waitFor({ timeout: 8000 });
  await marca.click();
  await dona.waitForFunction((el) => el.checked, await marca.elementHandle(), { timeout: 8000 });
  await dona.keyboard.press('Escape');
  (await sim(bia.locator('.canal-de-avisos-nota').waitFor({ timeout: 8000 })))
    ? ok('ligado o canal de avisos, a caixa da Bia vira a nota na hora')
    : falhou('a nota do canal de avisos não apareceu para a Bia');
  (await bia.locator('.composer textarea').count()) === 0 ? ok('e ela não tem onde escrever no canal') : falhou('a Bia ainda tem a caixa no canal de avisos');
  (await bia.locator('.channel-row', { hasText: 'geral' }).locator('svg.lucide-megaphone').count()) > 0
    ? ok('o canal tem o megafone na lista')
    : falhou('o ícone do canal não virou megafone');
  (await dona.locator('.composer textarea').count()) > 0 ? ok('a dona continua escrevendo') : falhou('a dona perdeu a caixa');
  await bia.screenshot({ path: 'e2e/fotos/canal-de-avisos.png' });

  // o tópico continua aberto à turma
  await dona.locator('.composer textarea').first().fill('A reunião mudou para sábado.');
  await dona.keyboard.press('Enter');
  const aviso = bia.locator('.message', { hasText: 'A reunião mudou' }).first();
  await aviso.waitFor({ timeout: 10000 });
  await aviso.hover();
  await aviso.getByRole('button', { name: 'Criar tópico' }).click();
  await bia.getByLabel('Nome do tópico').fill('Dúvidas');
  await bia.locator('.dialog .btn-primary', { hasText: 'Criar tópico' }).click();
  const caixaDoTopico = bia.locator('.thread-panel .composer textarea').first();
  (await sim(caixaDoTopico.waitFor({ timeout: 8000 })))
    ? ok('a Bia abre um tópico no aviso e tem onde escrever nele')
    : falhou('o tópico não abriu com a caixa');
  await caixaDoTopico.fill('Sábado que horas?');
  await bia.keyboard.press('Enter');
  (await sim(bia.locator('.thread-panel .message', { hasText: 'Sábado que horas?' }).waitFor({ timeout: 8000 })))
    ? ok('e a resposta dela entra no tópico')
    : falhou('a resposta no tópico não entrou');

  // desligar devolve a caixa
  await dona.locator('button[aria-label="Configurações"]').first().click();
  // a Moderação fica dentro de Ferramentas (recolhidas)
  if (!(await dona.locator('.settings-tab', { hasText: 'Moderação' }).count())) await dona.locator('.settings-tab.settings-grupo').first().click();
  await dona.locator('.settings-tab', { hasText: 'Moderação' }).first().click();
  await marca.click();
  await dona.waitForFunction((el) => !el.checked, await marca.elementHandle(), { timeout: 8000 });
  await dona.keyboard.press('Escape');
  (await sim(bia.locator('.canal-de-avisos-nota').waitFor({ state: 'detached', timeout: 8000 })))
    ? ok('desligado, a caixa volta para a Bia')
    : falhou('a nota continuou depois de desligar');
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  await browser.close();
  resumo('canal de avisos e editar');
}
