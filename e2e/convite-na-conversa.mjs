// O LINK DE CONVITE CLICADO NUMA CONVERSA (12/11/2026; ver web/src/linkDeConvite.ts). A Ana cria uma comunidade e manda o
// link dela no #geral; a Bia, que não participa, clica. O que o teste prova:
//
// 1. O clique NÃO abre aba nova (no app, abriria o navegador): a pergunta aparece no próprio Syden.
// 2. "Agora não" fecha sem entrar; clicar no mesmo link de novo pergunta de novo.
// 3. "Entrar na comunidade" entra e leva até ela; clicar no link depois disso vai direto, sem perguntar.
//
//   node e2e/convite-na-conversa.mjs   (API de teste na 3099 e site na 5174)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, SITE, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const NOME = 'Toca ' + s;

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = vigiar(await ctx.newPage());
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^geral$/ }).first().click();
  return { ctx, page };
}

try {
  const ana = await entrar('ana' + s);
  const bia = await entrar('bia' + s);

  const codigo = await ana.page.evaluate(async (nome) => {
    const r = await fetch('http://localhost:3099/api/communities', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
      body: JSON.stringify({ name: nome }),
    });
    return (await r.json()).inviteCode;
  }, NOME);
  codigo ? ok('a Ana criou a comunidade ' + NOME) : falhou('a comunidade não veio com convite');
  const link = `${SITE}/app/?convite=${codigo}`;
  await ana.page.locator('.composer textarea').fill('Vem pra cá: ' + link);
  await ana.page.locator('.composer textarea').press('Enter');

  const noChat = bia.page.locator('.message-text a', { hasText: codigo }).last();
  await noChat.waitFor({ timeout: 15000 });
  ok('a Bia vê o link na conversa');

  const abas = bia.ctx.pages().length;
  await noChat.click();
  const dialogo = bia.page.locator('.convite-comunidade');
  await dialogo.waitFor({ timeout: 10000 });
  await bia.page.waitForTimeout(500);
  bia.ctx.pages().length === abas ? ok('o clique abriu a pergunta no próprio Syden, sem aba nova') : falhou('abriu uma aba nova');
  (await dialogo.textContent()).includes(NOME) ? ok('a pergunta mostra o nome da comunidade') : falhou('sem o nome na pergunta');

  await dialogo.getByRole('button', { name: 'Agora não' }).click();
  await dialogo.waitFor({ state: 'detached', timeout: 5000 });
  (await bia.page.locator('.rail-list .rail-item').count()) === 1 ? ok('"Agora não" não entrou') : falhou('entrou sem querer');

  await noChat.click();
  await dialogo.waitFor({ timeout: 10000 });
  ok('o mesmo link, clicado de novo, pergunta de novo');
  await dialogo.getByRole('button', { name: 'Entrar na comunidade' }).click();
  await dialogo.waitFor({ state: 'detached', timeout: 10000 });
  await bia.page.waitForFunction(() => document.querySelectorAll('.rail-list .rail-item').length === 2, null, { timeout: 10000 });
  ok('"Entrar na comunidade" entrou');

  // Volta à primeira comunidade e clica de novo: agora vai direto, sem pergunta.
  await bia.page.locator('.rail-list .rail-item').first().click();
  await bia.page.locator('.channel-name', { hasText: /^geral$/ }).first().click();
  await noChat.click();
  await bia.page.waitForTimeout(1500);
  const perguntou = await dialogo.count();
  const ativa = await bia.page.locator('.rail-list .rail-item.active, .rail-list .rail-item[aria-current]').getAttribute('aria-label').catch(() => null);
  !perguntou ? ok(`quem já participa vai direto, sem pergunta (${ativa ?? 'comunidade aberta'})`) : falhou('perguntou de novo para quem já participa');
  await bia.page.screenshot({ path: 'e2e/fotos/convite-na-conversa.png' });
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('o link de convite clicado numa conversa');
}
