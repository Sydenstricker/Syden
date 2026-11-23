// O HISTÓRICO DA MENSAGEM EDITADA E A CORTIÇA DE AVISOS DO QUARTO (23/11/2026).
//   A dona marca o #geral como canal de avisos, escreve um aviso e o edita duas vezes. A Bia, da turma, clica no "(editada)"
//   e vê as versões anteriores. Depois, no quarto, a cortiça abre os avisos, com o aviso de agora; clicar leva ao canal.
//
//   node e2e/historico-e-cortica.mjs   (API de teste na 3099 e site na 5174)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const sim = (p) => p.then(() => true, () => false);

const api = (page, metodo, caminho, corpo) =>
  page.evaluate(
    async ({ metodo, caminho, corpo }) => {
      const r = await fetch('http://localhost:3099' + caminho, {
        method: metodo,
        headers: { Authorization: 'Bearer ' + localStorage.getItem('janja.token'), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      return { status: r.status, json: await r.json().catch(() => null) };
    },
    { metodo, caminho, corpo },
  );

async function entrar(nome) {
  const page = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage());
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  return page;
}

try {
  const dona = await entrar('dona' + s);
  await dona.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await dona.locator('.community-choice-option').first().click();
  await dona.locator('form.dialog input').first().fill('Hist ' + s);
  await dona.locator('form.dialog .btn-primary').click();
  await dona.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const comunidade = (await api(dona, 'GET', '/api/communities')).json.find((c) => c.name === 'Hist ' + s);
  const geral = (await api(dona, 'GET', `/api/communities/${comunidade.id}/channels`)).json.find((c) => c.name === 'geral');
  await api(dona, 'PUT', `/api/channels/${geral.id}/avisos`, { ligado: true });

  const caixa = dona.locator('.composer textarea').first();
  await caixa.fill('reunião às 19h');
  await caixa.press('Enter');
  const msg = dona.locator('.message', { hasText: 'reunião às 19h' }).last();
  await msg.waitFor({ timeout: 10000 });
  const id = Number(await msg.getAttribute('data-mensagem'));
  await api(dona, 'PATCH', `/api/messages/${id}`, { content: 'reunião às 20h' });
  await api(dona, 'PATCH', `/api/messages/${id}`, { content: 'reunião às 21h' });

  const bia = await entrar('bia' + s);
  await api(bia, 'POST', '/api/communities/join', { code: comunidade.inviteCode });
  await bia.reload();
  await dispensarPresentes(bia);
  await bia.locator(`.rail-list .rail-item[aria-label*="Hist ${s}"], .rail-list .rail-item[title*="Hist ${s}"]`).first().click();
  await bia.locator('.channel-name', { hasText: /^geral$/ }).first().click();
  const daBia = bia.locator(`[data-mensagem="${id}"]`);
  (await sim(daBia.getByText('reunião às 21h').waitFor({ timeout: 10000 }))) ? ok('a Bia lê a versão de agora') : falhou('a mensagem editada não chegou à Bia');
  await daBia.locator('.mensagem-editada').click();
  const historico = daBia.locator('.mensagem-historico');
  (await sim(historico.waitFor({ timeout: 8000 }))) ? ok('o "(editada)" abre as versões anteriores') : falhou('o histórico não abriu');
  const textos = await historico.locator('li p').allTextContents();
  JSON.stringify(textos) === JSON.stringify(['reunião às 19h', 'reunião às 20h'])
    ? ok('com as duas versões de antes, na ordem')
    : falhou(`as versões: ${JSON.stringify(textos)}`);
  await daBia.screenshot({ path: 'e2e/fotos/historico-da-mensagem.png' });

  // ---------- a cortiça do quarto ----------
  await bia.locator('.rail-logo').click();
  const quarto = await (await bia.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await bia.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'cortica' }, location.origin));
  const painel = bia.locator('.cortica-de-avisos');
  (await sim(painel.getByText('reunião às 21h').waitFor({ timeout: 10000 })))
    ? ok('a cortiça do quarto mostra o aviso')
    : falhou('a cortiça não mostrou o aviso');
  (await painel.locator(".cortica-aviso-onde").filter({ hasText: `Hist ${s}` }).filter({ hasText: "geral" }).count()) > 0 ? ok('com a comunidade e o canal') : falhou('a origem do aviso não aparece');
  await painel.screenshot({ path: 'e2e/fotos/cortica-de-avisos.png' });
  await painel.locator('li button').first().click();
  (await sim(bia.locator('.channel.active', { hasText: 'geral' }).first().waitFor({ timeout: 10000 })))
    ? ok('clicar no aviso leva ao canal')
    : falhou('clicar no aviso não abriu o canal');
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  await browser.close();
  resumo('histórico e cortiça');
}
