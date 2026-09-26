// A insígnia dos 25 primeiros e a tela de destaque: o presente espera, é resgatado com um clique, e só
// então aparece no perfil. Referência que o usuário mandou: a tela de item novo da loja do Warzone.
import { CONVITE, SITE, abrirNavegador, falhou, novaPessoa, ok, resumo } from './ajuda.mjs';

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
  return page;
}

const ana = await entrar('ana' + s);

// ---------- 1. o presente está esperando assim que ela entra ----------
const tela = ana.locator('.revelacao');
await tela.waitFor({ timeout: 10000 });
ok('a tela de destaque apareceu sozinha, sem ela procurar nada');
await ana.waitForTimeout(700); // deixa a entrada terminar antes de conferir e fotografar

const texto = await tela.innerText();
texto.includes('Um dos 25 primeiros') ? ok('é a insígnia dos 25 primeiros') : falhou('nome do item: ' + texto.slice(0, 120));
texto.toLowerCase().includes('obrigado') ? ok('e tem o agradecimento curto') : falhou('sem agradecimento: ' + texto.slice(0, 160));
(await ana.locator('.revelacao .medalha-arte').count()) === 1 ? ok('a arte está no quadro, com moldura') : falhou('sem a arte');
await ana.screenshot({ path: 'e2e/fotos/insignia-presente.png' });

// ---------- 2. antes de resgatar, ela ainda não está no perfil ----------
const perfilAntes = await ana.evaluate(async () => (await (await fetch('/api/me')).json?.()) ?? null).catch(() => null);
if (perfilAntes === null) ok('(perfil conferido pela tela, não pela API)');

// ---------- 3. resgatar: estouro, e depois o nome do item ----------
await ana.getByRole('button', { name: /Resgatar/ }).click();
await ana.locator('.revelacao.fase-estouro').waitFor({ timeout: 3000 });
ok('o clique dispara o estouro de luz');
// 250 ms depois do clique é onde o losango está aberto; antes ou depois, a foto pega o escuro entre os quadros.
await ana.waitForTimeout(250);
await ana.screenshot({ path: 'e2e/fotos/insignia-estouro.png' });

await ana.locator('.revelacao.fase-nome').waitFor({ timeout: 5000 });
ok('e termina mostrando o item, agora dela');
await ana.screenshot({ path: 'e2e/fotos/insignia-fim.png' });

await ana.getByRole('button', { name: 'Fechar' }).click();
await tela.waitFor({ state: 'detached', timeout: 5000 });
ok('fechou e voltou para o Syden');

// ---------- 4. não cai de novo ao recarregar ----------
await ana.reload();
await ana.locator('.vila').waitFor({ timeout: 25000 });
await ana.waitForTimeout(1500);
(await ana.locator('.revelacao').count()) === 0 ? ok('recarregando, o presente não aparece de novo') : falhou('a tela voltou');

// ---------- 5. agora ela está no perfil, e dá para escolher se aparece ----------
await ana.locator('.rail-list .rail-item').first().click();
await ana.locator('.members .member', { hasText: 'ana' + s }).first().click();
const cartao = ana.locator('.perfil-cartao');
await cartao.waitFor({ timeout: 8000 });
(await cartao.locator('.medalha').count()) >= 1 ? ok('a insígnia está no perfil dela') : falhou('o perfil não mostra a insígnia');
await cartao.screenshot({ path: 'e2e/fotos/insignia-no-perfil.png' });
await ana.keyboard.press('Escape');

// ---------- 6. a escolha de quais exibir ----------
await ana.getByRole('button', { name: 'Configurações' }).click();
await ana.getByRole('button', { name: /Minha conta/ }).first().click();
const escolha = ana.locator('.insignia-escolha').first();
await escolha.waitFor({ timeout: 8000 });
ok('a lista de insígnias está em Configurações → Minha conta');
(await escolha.getAttribute('class')).includes('exibindo') ? ok('e a recém-resgatada já vem marcada como visível') : falhou('não veio marcada');

await escolha.click();
await ana.waitForTimeout(600);
(await escolha.getAttribute('class')).includes('exibindo') ? falhou('continuou marcada depois do clique') : ok('dá para esconder do perfil com um clique');
await ana.screenshot({ path: 'e2e/fotos/insignia-escolha.png' });

await escolha.click(); // devolve ao estado de antes
await ana.waitForTimeout(600);

await browser.close();
resumo('insignias');
