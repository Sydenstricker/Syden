// A LIXEIRA: apagar um canal por engano tem volta, e a volta se acha sem ninguém explicar onde é.
//
// Este teste existe porque a metade que faltava era justamente a que a pessoa usa. O servidor já
// guardava canal apagado por trinta dias, com rota para listar e rota para restaurar — e nenhuma tela
// chegava até elas. Um teste de servidor passando não prova nada sobre isso: ele chama a rota direto.
// O que precisa ser provado é o caminho de dedo, e é o que está aqui.
//
// De quebra, confere a frase do aviso de excluir. Ela dizia "Não dá para desfazer", que era verdade
// até a lixeira existir e virou mentira no mesmo dia — o tipo de texto que ninguém relê.

import { abrirNavegador, criarConta, dispensarPresentes, falhou, novaPessoa, ok, resumo, vigiar } from './ajuda.mjs';

const { browser, contexto } = await abrirNavegador();
const page = vigiar(await contexto.newPage());
const s = Date.now().toString().slice(-6);

// ---------- conta nova, e uma comunidade dela: quem cria é dono, e dono administra ----------
await criarConta(page, 'lix');
await dispensarPresentes(page);

await page.locator('button[aria-label="Adicionar comunidade"]').click();
await page.getByText('Criar a minha').click();
await page.getByLabel('Nome da comunidade').fill('Lixeira ' + s);
await page.locator('.dialog .btn-primary').click();
await page.locator('.channel-name').first().waitFor({ timeout: 20000 });
ok('conta e comunidade criadas — quem criou é dono, e dono administra');

// ---------- um canal para apagar, com uma mensagem dentro ----------
const grupoDeTexto = page
  .locator('.channel-group')
  .filter({ has: page.locator('.channel-name', { hasText: /geral/ }) })
  .first();
await grupoDeTexto.locator('.channel-group-title button').click();
await page.locator('.channel-input').fill('combinados');
await page.locator('.channel-input').press('Enter');
await page.locator('.channel-name', { hasText: 'combinados' }).waitFor({ timeout: 10000 });

await page.locator('.channel-name', { hasText: 'combinados' }).click();
const campo = page.locator('textarea').first();
await campo.fill('o mês inteiro de conversa da turma');
await campo.press('Enter');
await page.getByText('o mês inteiro de conversa da turma').waitFor({ timeout: 10000 });
ok('canal #combinados criado, com uma mensagem dentro');

// ---------- guardar o código, para a segunda pessoa entrar depois ----------
await page.locator('button[aria-label="Configurações"]').first().click();
await page.locator('.settings-tab', { hasText: 'Comunidade' }).click();
const codigo = (await page.locator('.invite-code').first().innerText()).trim();
await page.keyboard.press('Escape');
console.log('  código de convite da comunidade:', codigo);

// ---------- apagar: o aviso não pode mais dizer que não dá para desfazer ----------
const linha = page.locator('.channel-row').filter({ has: page.locator('.channel-name', { hasText: 'combinados' }) });
await linha.hover();
await linha.locator('button[aria-label^="Excluir"]').click();
await page.locator('.dialog').waitFor({ timeout: 8000 });
const aviso = await page.locator('.dialog-body').innerText();
console.log('  aviso:', JSON.stringify(aviso));
/não dá para desfazer/i.test(aviso)
  ? falhou('o aviso ainda diz que não dá para desfazer, e dá: a lixeira guarda por 30 dias')
  : ok('o aviso não mente mais sobre desfazer');
/30 dias/.test(aviso) && /Lixeira/.test(aviso)
  ? ok('e diz o prazo e o caminho até a lixeira')
  : falhou('o aviso não diz o prazo nem onde encontrar a lixeira');

await page.locator('.dialog .btn-danger').click();
await page.locator('.channel-name', { hasText: 'combinados' }).waitFor({ state: 'detached', timeout: 10000 });
ok('o canal saiu da barra lateral');

// ---------- achar a lixeira pelo caminho que o aviso indicou ----------
await page.locator('button[aria-label="Configurações"]').first().click();
await page.locator('.settings-tab', { hasText: 'Comunidade' }).click();
const bloco = page.locator('.settings-block').filter({ hasText: 'Lixeira' });
await bloco.waitFor({ timeout: 8000 });
await bloco.scrollIntoViewIfNeeded();

const itens = await bloco.locator('.amigos-lista li').allInnerTexts();
console.log('  na lixeira:', JSON.stringify(itens));
const detalhe = itens.find((texto) => texto.includes('combinados')) ?? '';
detalhe
  ? ok('o canal apagado está na lixeira, pelo caminho que o aviso indicou')
  : falhou('a lixeira não mostra o canal: ' + JSON.stringify(itens));

/1 mensagem\b/.test(detalhe)
  ? ok('e conta o que se perde sem errar o plural: "1 mensagem", não "1 mensagens"')
  : falhou('a contagem de mensagens saiu errada: ' + JSON.stringify(detalhe));
/30 dias para trazer de volta/.test(detalhe)
  ? ok('e o prazo cheio, porque acabou de ser apagado')
  : falhou('o prazo saiu errado: ' + JSON.stringify(detalhe));

await page.screenshot({ path: 'e2e/fotos/lixeira-com-canal.png' });

// ---------- trazer de volta, com as mensagens dentro ----------
await bloco.getByRole('button', { name: /Trazer de volta/ }).click();
await bloco.getByText('Nada na lixeira.').waitFor({ timeout: 10000 });
ok('restaurou, e a lixeira ficou vazia — sem recarregar a tela');

await page.keyboard.press('Escape');
await page.locator('.channel-name', { hasText: 'combinados' }).waitFor({ timeout: 10000 });
ok('o canal voltou para a barra lateral');

await page.locator('.channel-name', { hasText: 'combinados' }).click();
await page.getByText('o mês inteiro de conversa da turma').waitFor({ timeout: 10000 });
ok('e a mensagem estava lá dentro: as mensagens nunca saíram do banco');

// ---------- quem NÃO administra não vê a lixeira ----------
// A lista conta quantas mensagens cada canal apagado tinha, e isso é informação de dentro dele.
const outro = await novaPessoa(browser);
await criarConta(outro, 'vis');
await dispensarPresentes(outro);
await outro.locator('button[aria-label="Adicionar comunidade"]').click();
await outro.getByText('Entrar com um convite').click();
await outro.getByLabel('Código de convite').fill(codigo);
await outro.locator('.dialog .btn-primary').click();
await outro.locator('.channel-name').first().waitFor({ timeout: 20000 });
await outro.locator('button[aria-label="Configurações"]').first().click();
await outro.locator('.settings-tab', { hasText: 'Comunidade' }).click();
await outro.waitForTimeout(1500);
(await outro.locator('.settings-block', { hasText: 'Lixeira' }).count()) === 0
  ? ok('quem não administra não vê bloco de lixeira nenhum — nem vazio, nem com erro')
  : falhou('a lixeira apareceu para quem não administra a comunidade');

await browser.close();
resumo('lixeira');
