// O "PODE MODERAR" NO CARGO E O STATUS DA SALA DE VOZ (23/11/2026): a dona cria a comunidade e a Bia entra pelo convite.
//   Pode moderar: sem cargo, a Bia não tem o apagar nem o alfinete na mensagem da dona; a dona dá a ela um cargo com
//   "pode moderar a conversa" (pela API, como a tela de cargos faz), e os dois botões aparecem sozinhos; a Bia fixa.
//   Status da sala: as duas entram na Sala 1; a Bia define o status pelo lápis do palco, a dona o vê embaixo do nome da
//   sala na lista; as duas saem, e o status some sozinho.
//
//   node e2e/moderar-e-status-da-sala.mjs   (API de teste na 3099, site na 5174 e o LiveKit)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const permissions = ['clipboard-read', 'clipboard-write', 'microphone'];
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

/** Chama a API com a sessão da página. */
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
  await dona.locator('form.dialog input').first().fill('Mod ' + s);
  await dona.locator('form.dialog .btn-primary').click();
  await dona.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const linha = dona.locator('.channel-row', { has: dona.locator('.channel-name', { hasText: /^geral$/ }) }).first();
  await linha.hover();
  await linha.getByRole('button', { name: 'Copiar link: geral' }).click();
  const convite = await dona.evaluate(() => navigator.clipboard.readText());
  const bia = await entrar('bia' + s, convite);
  await bia.locator('.channel.active').first().waitFor({ timeout: 20000 });
  ok('a Bia entrou na comunidade da dona');

  // ---------- pode moderar ----------
  await dona.locator('.composer textarea').first().fill('Regras: sem spoiler');
  await dona.keyboard.press('Enter');
  const naBia = bia.locator('.message', { hasText: 'Regras: sem spoiler' }).first();
  await naBia.waitFor({ timeout: 10000 });
  await naBia.hover();
  (await naBia.locator('button[aria-label="Apagar mensagem"], button[aria-label="Fixar mensagem"]').count()) === 0
    ? ok('sem cargo, a Bia não apaga nem fixa a mensagem da dona')
    : falhou('a Bia já podia moderar sem cargo');

  const comunidades = await api(dona, 'GET', '/api/communities');
  const comunidade = comunidades.json.find((c) => c.name === 'Mod ' + s);
  const cargo = await api(dona, 'POST', `/api/communities/${comunidade.id}/cargos`, { nome: 'Moderação', cor: '#4caf50' });
  const mudou = await api(dona, 'PATCH', `/api/communities/${comunidade.id}/cargos/${cargo.json.id}`, { modera: true });
  const biaId = await bia.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).id;
  });
  const deu = await api(dona, 'PUT', `/api/communities/${comunidade.id}/members/${biaId}/cargos/${cargo.json.id}`);
  cargo.status === 200 && mudou.status === 200 && deu.status === 200
    ? ok('a dona dá à Bia um cargo com "pode moderar a conversa"')
    : falhou(`o cargo não foi dado: ${cargo.status} ${mudou.status} ${deu.status}`);
  await naBia.hover();
  (await sim(naBia.locator('button[aria-label="Fixar mensagem"]').waitFor({ timeout: 8000 })))
    ? ok('o alfinete aparece para a Bia na hora, sem recarregar')
    : falhou('o alfinete não apareceu para a Bia');
  (await naBia.locator('button[aria-label="Apagar mensagem"]').count()) > 0 ? ok('e o apagar também') : falhou('o apagar não apareceu');
  await naBia.getByRole('button', { name: 'Fixar mensagem' }).click();
  (await sim(dona.locator('.message', { hasText: 'Regras: sem spoiler' }).locator('.mensagem-fixada').waitFor({ timeout: 8000 })))
    ? ok('a Bia fixa, e a dona vê o alfinete')
    : falhou('a fixação da Bia não chegou à dona');
  const banir = await api(bia, 'POST', `/api/communities/${comunidade.id}/members/${await dona.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).id;
  })}/banir`);
  banir.status === 403 ? ok('e moderar não é administrar: banir continua fora do alcance dela') : falhou(`a Bia conseguiu banir: ${banir.status}`);

  // ---------- status da sala ----------
  for (const p of [dona, bia]) {
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('as duas entraram na Sala 1');
  await bia.getByRole('button', { name: 'Definir status da sala' }).first().click();
  await bia.getByRole('textbox', { name: 'Status da sala' }).fill('ranqueada, não chamar');
  await bia.keyboard.press('Enter');
  const naLista = dona.locator('.status-da-sala', { hasText: 'ranqueada, não chamar' });
  (await sim(naLista.first().waitFor({ timeout: 8000 })))
    ? ok('a Bia define o status pelo lápis, e a dona o vê na hora')
    : falhou('o status não chegou à dona');
  await dona.screenshot({ path: 'e2e/fotos/status-da-sala.png' });
  for (const p of [dona, bia]) await p.locator('button.leave-button').first().click();
  (await sim(naLista.first().waitFor({ state: 'detached', timeout: 8000 })))
    ? ok('as duas saem, e o status some sozinho')
    : falhou('o status ficou com a sala vazia');
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  await browser.close();
  resumo('pode moderar e status da sala');
}
