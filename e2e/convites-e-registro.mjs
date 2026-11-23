// CONVITES COM PRAZO E O REGISTRO DE MODERAÇÃO (23/11/2026).
//   Convites: a dona, pelo botão direito no ícone da comunidade, abre "Configurar convite", escolhe 1 uso e gera o link; a
//   Bia entra por ele; a Carol, com o mesmo link, recebe "já foi usado"; o link de sempre continua valendo para ela.
//   Registro: a dona liga o modo lento e o canal de avisos; em Configurações → Ferramentas → Registro de moderação, as duas
//   ações aparecem com o nome dela; a Bia (sem administrar) não chega ao registro.
//
//   node e2e/convites-e-registro.mjs   (API de teste na 3099 e site na 5174)
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

try {
  const dona = await entrar('dona' + s);
  await dona.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await dona.locator('.community-choice-option').first().click();
  await dona.locator('form.dialog input').first().fill('Conv ' + s);
  await dona.locator('form.dialog .btn-primary').click();
  await dona.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const comunidade = (await api(dona, 'GET', '/api/communities')).json.find((c) => c.name === 'Conv ' + s);

  // ---------- convite de 1 uso ----------
  await dona.locator(`.rail-list .rail-item[aria-label*="Conv ${s}"], .rail-list .rail-item[title*="Conv ${s}"]`).first().click({ button: 'right' });
  await dona.getByRole('button', { name: 'Configurar convite' }).click();
  await dona.getByLabel('Limite de usos').selectOption({ label: '1 uso' });
  await dona.getByRole('button', { name: 'Gerar link' }).click();
  await dona.getByText('Link copiado!').first().waitFor({ timeout: 8000 });
  const link = await dona.evaluate(() => navigator.clipboard.readText());
  const codigo = new URL(link).searchParams.get('convite');
  codigo && codigo !== comunidade.inviteCode ? ok('"Configurar convite" gera um link novo, diferente do de sempre') : falhou(`o link gerado: ${link}`);
  (await sim(dona.locator('.expression-row', { hasText: codigo }).waitFor({ timeout: 5000 })))
    ? ok('e ele aparece em "Seus convites"')
    : falhou('o convite não apareceu na lista');
  await dona.keyboard.press('Escape');

  const bia = await entrar('bia' + s, link);
  (await sim(bia.locator('.channel.active').first().waitFor({ timeout: 20000 })))
    ? ok('a Bia entra pelo link de 1 uso')
    : falhou('a Bia não entrou pelo link novo');

  const carol = await entrar('carol' + s);
  const gasto = await api(carol, 'POST', '/api/communities/join', { code: codigo });
  gasto.status === 410 && /máximo de vezes/.test(gasto.json?.error ?? '')
    ? ok('com o mesmo link, a Carol recebe "já foi usado o máximo de vezes"')
    : falhou(`o link gasto respondeu ${gasto.status} ${JSON.stringify(gasto.json)}`);
  const desempre = await api(carol, 'POST', '/api/communities/join', { code: comunidade.inviteCode });
  desempre.status === 200 ? ok('e o link de sempre continua valendo') : falhou(`o link de sempre falhou: ${desempre.status}`);

  // ---------- registro de moderação ----------
  const canais = (await api(dona, 'GET', `/api/communities/${comunidade.id}/channels`)).json;
  const geral = canais.find((c) => c.name === 'geral');
  await api(dona, 'PUT', `/api/channels/${geral.id}/modo-lento`, { segundos: 30 });
  await api(dona, 'PUT', `/api/channels/${geral.id}/avisos`, { ligado: true });
  await dona.locator('button[aria-label="Configurações"]').first().click();
  if (!(await dona.locator('.settings-tab', { hasText: 'Registro de moderação' }).count())) await dona.locator('.settings-tab.settings-grupo').first().click();
  await dona.locator('.settings-tab', { hasText: 'Registro de moderação' }).first().click();
  const linhas = dona.locator('.registro-linha');
  (await sim(linhas.filter({ hasText: 'modo lento' }).first().waitFor({ timeout: 8000 })))
    ? ok('o registro mostra o modo lento ligado pela dona')
    : falhou('o modo lento não apareceu no registro');
  (await linhas.filter({ hasText: 'canal de avisos' }).count()) > 0 ? ok('e o canal de avisos') : falhou('o canal de avisos não apareceu no registro');
  (await linhas.filter({ hasText: 'dona' + s }).count()) >= 2 ? ok('com o nome de quem fez') : falhou('o nome da dona não aparece nas linhas');
  await dona.screenshot({ path: 'e2e/fotos/registro-de-moderacao.png' });
  const daBia = await api(bia, 'GET', `/api/communities/${comunidade.id}/registro`);
  daBia.status === 403 ? ok('quem não administra não lê o registro') : falhou(`a Bia leu o registro: ${daBia.status}`);
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  await browser.close();
  resumo('convites e registro');
}
