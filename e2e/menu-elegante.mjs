// Item 7: o menu do botão direito numa pessoa, refeito. Perfil, menção, anotação só sua, volume e —
// para quem administra — a moderação separada embaixo.

import { CONVITE, SITE, abrirNavegador, dispensarPresentes, falhou, novaPessoa, ok, resumo } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

async function entrar(nome) {
  // Cada pessoa no seu contexto: duas abas do mesmo contexto entrariam com a mesma conta.
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
await ana.reload(); // para a ana enxergar a bia na lista de pessoas
await ana.locator('.channel-name', { hasText: /geral/ }).first().click();
await ana.locator('.members .member', { hasText: 'bia' + s }).waitFor({ timeout: 20000 });
ok('as duas estão na mesma comunidade');

const naLista = ana.locator('.members .member', { hasText: 'bia' + s });
await naLista.click({ button: 'right' });
const menu = ana.locator('.person-menu');
await menu.waitFor({ timeout: 8000 });
await ana.screenshot({ path: 'e2e/fotos/menu-pessoa-novo.png' });

// ---------- 1. o topo diz quem é ----------
const topo = await menu.locator('.person-menu-topo').innerText();
topo.includes('bia' + s) && topo.includes('Membro') ? ok('o topo mostra o nome e o cargo: ' + JSON.stringify(topo.replace(/\n/g, ' · '))) : falhou('topo: ' + topo);

// ---------- 2. as opções ----------
const opcoes = await menu.locator('[role="menuitem"]').allInnerTexts();
console.log('  opções:', JSON.stringify(opcoes.map((t) => t.split('\n')[0])));
for (const esperada of ['Ver perfil', 'Mencionar na conversa', 'Enviar mensagem', 'Anotar sobre esta pessoa', 'Silenciar só para mim']) {
  opcoes.some((t) => t.includes(esperada)) ? ok(`tem "${esperada}"`) : falhou(`falta "${esperada}"`);
}

// ---------- 3. o teclado anda pelo menu ----------
await ana.keyboard.press('ArrowDown');
await ana.keyboard.press('ArrowDown');
const focado = await ana.evaluate(() => document.activeElement?.textContent ?? '');
focado.length > 0 ? ok('as setas andam pelas opções (parou em: ' + JSON.stringify(focado.split('\n')[0]) + ')') : falhou('o teclado não move o foco');

// ---------- 4. anotar ----------
await menu.getByRole('menuitem', { name: /Anotar sobre esta pessoa/ }).click();
await menu.locator('.person-menu-nota textarea').fill('joga de suporte');
await menu.getByRole('button', { name: 'Guardar' }).click();
await ana.waitForTimeout(300);
await naLista.click({ button: 'right' });
await menu.waitFor({ timeout: 5000 });
(await menu.innerText()).includes('joga de suporte') ? ok('a anotação fica guardada e aparece no menu') : falhou('a anotação sumiu');

// ---------- 5. ver perfil, com a anotação dentro ----------
await menu.getByRole('menuitem', { name: /Ver perfil/ }).click();
const cartao = ana.locator('.perfil-cartao');
await cartao.waitFor({ timeout: 6000 });
const perfil = await cartao.innerText();
perfil.includes('bia' + s) ? ok('"Ver perfil" abre o cartão da pessoa certa') : falhou('cartão errado: ' + perfil.slice(0, 80));
perfil.includes('joga de suporte') ? ok('e a anotação aparece lá dentro') : falhou('a anotação não está no cartão');
await ana.screenshot({ path: 'e2e/fotos/menu-perfil-nota.png' });
await ana.keyboard.press('Escape');
await ana.waitForTimeout(300);

// ---------- 6. mencionar cai no campo de escrever ----------
await naLista.click({ button: 'right' });
await menu.waitFor({ timeout: 5000 });
await menu.getByRole('menuitem', { name: /Mencionar na conversa/ }).click();
await ana.waitForTimeout(400);
const rascunho = await ana.locator('.composer textarea').inputValue();
rascunho.includes('@bia' + s) ? ok('"Mencionar" põe o nome no campo de escrever: ' + JSON.stringify(rascunho)) : falhou('campo: ' + JSON.stringify(rascunho));

// ---------- 7. a anotação é só de quem escreveu ----------
await bia.reload();
await bia.locator('.channel-name', { hasText: /geral/ }).first().click();
await bia.locator('.members .member', { hasText: 'ana' + s }).waitFor({ timeout: 20000 });
await bia.locator('.members .member', { hasText: 'bia' + s }).click();
await bia.locator('.perfil-cartao').waitFor({ timeout: 6000 });
(await bia.locator('.perfil-cartao').innerText()).includes('joga de suporte')
  ? falhou('a anotação da ana vazou para a bia')
  : ok('a anotação não sai do computador de quem escreveu');

// ---------- 8. o menu não escapa pela borda da tela ----------
await bia.keyboard.press('Escape');
await ana.locator('.members .member').last().click({ button: 'right', position: { x: 5, y: 5 } });
await menu.waitFor({ timeout: 5000 });
const dentro = await menu.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1;
});
dentro ? ok('o menu cabe inteiro na tela, mesmo aberto lá embaixo') : falhou('o menu vazou pela borda');

// ---------- 9. quem administra vê a moderação, separada embaixo ----------
// Com o banco limpo, a ana é a dona do Syden (primeiro cadastro): o menu dela tem que ter moderação.
await ana.keyboard.press("Escape");
await ana.waitForTimeout(300);
await naLista.click({ button: "right" });
await menu.waitFor({ timeout: 5000 });
const doDono = await menu.innerText();
// o CSS deixa o título do grupo em maiúsculas, e o innerText vem como está na tela
doDono.toLowerCase().includes("moderação") ? ok("quem administra vê o grupo de moderação separado embaixo") : falhou("sem grupo de moderação");
doDono.includes("Tornar administrador") ? ok("e pode dar o cargo de administrador") : falhou("sem a opção de administrador");
await ana.screenshot({ path: "menu-pessoa-dono.png" });
await browser.close();
resumo('menu-elegante');
