// O caminho inteiro de uma ideia: a pessoa escreve na tela inicial, o Syden agradece sozinho, o dono dá
// o joinha quando aquilo vira app de verdade, e do lado dela cai confete + medalha no perfil.
//
// O banco precisa estar limpo: o DONO é o primeiro cadastro. Rodar com e2e/limpo.sh ideias.mjs.

import { CONVITE, SITE, abrirNavegador, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  vigiar(page);
    await page.goto(SITE);
  await page.getByText('Cadastre-se').click();
  await page.getByLabel('Nome de usuário').fill(nome);
  await page.getByLabel('Senha').fill('segredo123');
  await page.getByLabel('Código de convite').fill(CONVITE);
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await page.locator('.vila').waitFor({ timeout: 30000 });
  await dispensarPresentes(page);
  return { page, ctx };
}

// O primeiro cadastro do banco é o dono do Syden.
const dono = await entrar('dono' + s);
const bia = await entrar('bia' + s);
const cid = await entrar('cid' + s);
ok('dono, bia e cid entraram');

// ---------- 1. o dono agora ENXERGA a caixa de ideias (antes ela sumia para ele) ----------
const caixaDoDono = dono.page.locator('.ideias.exemplo');
await caixaDoDono.waitFor({ timeout: 10000 });
const textoDoDono = await caixaDoDono.innerText();
textoDoDono.includes('é isto que os seus amigos veem') || textoDoDono.includes('É isto que os seus amigos veem')
  ? ok('o dono vê a caixa como os amigos veem, com o aviso de que é demonstração')
  : falhou('texto da caixa do dono: ' + textoDoDono.slice(0, 120));
(await dono.page.locator('.ideias.exemplo textarea').isDisabled()) ? ok('e ela é só demonstração, não dá para escrever') : falhou('a caixa do dono aceita escrita');

// ---------- 2. a bia manda uma ideia ----------
const ideia = 'Queria um botão para salvar a jogada, ideia ' + s;
await bia.page.locator('.ideias textarea').fill(ideia);
await bia.page.locator('.ideias').getByRole('button', { name: 'Enviar' }).click();
await bia.page.locator('.ideias-obrigado').waitFor({ timeout: 15000 });
ok('a bia mandou a ideia');

// ---------- 3. o Syden agradece sozinho, na conversa ----------
await bia.page.locator('.direct-rail').click();
await bia.page.locator('.direct-row').first().click();
await bia.page.locator('.message-text').first().waitFor({ timeout: 15000 });
await bia.page.waitForTimeout(800);
const conversaDaBia = await bia.page.locator('.message-text').allInnerTexts();
conversaDaBia.some((t) => t.includes(ideia)) ? ok('a ideia dela está na conversa') : falhou('a ideia não apareceu: ' + JSON.stringify(conversaDaBia));
conversaDaBia.some((t) => t.includes('Recado automático'))
  ? ok('e o agradecimento automático chegou na hora, sem o dono precisar estar acordado')
  : falhou('não veio agradecimento: ' + JSON.stringify(conversaDaBia));
(await bia.page.locator('.composer textarea, .composer input').count()) > 0
  ? ok('a conversa continua aberta: dá para trocar mais ideias por ali')
  : falhou('a conversa ficou sem campo de escrever');

// ---------- 4. o cid também manda uma, e depois FECHA o Syden ----------
const ideiaDoCid = 'Modo escuro automático, ideia ' + s;
await cid.page.locator('.ideias textarea').fill(ideiaDoCid);
await cid.page.locator('.ideias').getByRole('button', { name: 'Enviar' }).click();
await cid.page.locator('.ideias-obrigado').waitFor({ timeout: 15000 });
await cid.ctx.close();
ok('o cid mandou a dele e fechou o app');

// ---------- 5. o dono acolhe as duas ----------
await dono.page.locator('.direct-rail').click();
await dono.page.waitForTimeout(1500);
const conversas = dono.page.locator('.direct-row');
const quantas = await conversas.count();
console.log(`  o dono tem ${quantas} conversas`);
let acolhidas = 0;
for (let i = 0; i < quantas; i++) {
  await conversas.nth(i).click();
  await dono.page.waitForTimeout(1200);
  // A barra de ações da mensagem só aparece com o mouse em cima dela.
  const comIdeia = dono.page.locator('.message', { has: dono.page.locator('button[aria-label="Acolher a ideia"]') });
  const n = await comIdeia.count();
  for (let j = 0; j < n; j++) {
    const mensagem = comIdeia.first();
    await mensagem.hover();
    await mensagem.locator('button[aria-label="Acolher a ideia"]').click();
    await dono.page.waitForTimeout(900);
    acolhidas++;
  }
}
acolhidas === 2 ? ok('o dono achou o joinha nas duas ideias e acolheu') : falhou(`acolheu ${acolhidas} de 2`);
await dono.page.locator('.ideia-acolhida').first().waitFor({ timeout: 8000 });
ok('a mensagem passa a dizer "Ideia acolhida no Syden"');

// ---------- 6. confete na tela da bia, que estava com o app aberto ----------
await bia.page.locator('.comemoracao').waitFor({ timeout: 15000 });
const festa = await bia.page.locator('.comemoracao').innerText();
festa.includes(ideia) ? ok('o confete caiu na tela da bia, com a ideia dela escrita') : falhou('festa sem a ideia: ' + festa.slice(0, 140));
const papeis = await bia.page.locator('canvas.confete').count();
papeis === 1 ? ok('e o confete está desenhado na tela') : falhou('sem confete');
await bia.page.screenshot({ path: 'e2e/fotos/ideia-confete.png' });
await bia.page.locator('.comemoracao .btn-primary').click();
await bia.page.waitForTimeout(600);

// ---------- 7. a medalha no perfil ----------
await bia.page.locator('.rail-list .rail-item').first().click();
await bia.page.waitForTimeout(800);
await bia.page.locator('.members .member', { hasText: 'bia' + s }).click();
// O perfil pode ter várias insígnias (ela também é uma das 25 primeiras): aponta a da contribuição.
const medalha = bia.page.locator('.perfil-cartao .medalha[title*="Ideia acolhida"]');
await medalha.waitFor({ timeout: 8000 });
ok('a medalha de contribuição está no perfil dela: ' + JSON.stringify(await medalha.innerText()));
await bia.page.screenshot({ path: 'e2e/fotos/ideia-medalha.png' });
// Um retrato de perto da medalha, para eu olhar o desenho no tamanho em que ele aparece.
await bia.page.locator('.perfil-cartao').screenshot({ path: 'e2e/fotos/recorte-medalha.png' });
await bia.page.keyboard.press('Escape');

// ---------- 8. o confete não cai duas vezes ----------
await bia.page.reload();
// Ela estava na comunidade, não na tela inicial: o que garante que o app voltou é a barra lateral.
await bia.page.locator('.rail-list').waitFor({ timeout: 25000 });
await bia.page.waitForTimeout(2500);
(await bia.page.locator('.comemoracao').count()) === 0 ? ok('recarregando, o confete não cai de novo') : falhou('a festa voltou sozinha');

// ---------- 9. quem estava offline vê a festa ao voltar ----------
const cidDeVolta = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const pagina = await cidDeVolta.newPage();
vigiar(pagina);
await pagina.goto(SITE);
await pagina.getByLabel('Nome de usuário').fill('cid' + s);
await pagina.getByLabel('Senha').fill('segredo123');
await pagina.getByRole('button', { name: 'Entrar' }).click();
await pagina.locator('.vila').waitFor({ timeout: 30000 });
await dispensarPresentes(pagina);
const festaDoCid = await pagina
  .locator('.comemoracao')
  .waitFor({ timeout: 20000 })
  .then(() => true)
  .catch(() => false);
festaDoCid
  ? ok('quem estava fora na hora do joinha vê o confete ao voltar')
  : falhou('o cid voltou e não viu nada');
if (festaDoCid) {
  const texto = await pagina.locator('.comemoracao').innerText();
  texto.includes(ideiaDoCid) ? ok('e é a ideia dele que está escrita lá') : falhou('ideia errada: ' + texto.slice(0, 120));
}

await browser.close();
resumo('ideias');
