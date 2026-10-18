// AS AÇÕES DO GRUPO NA CONVERSA PRIVADA (17/10/2026): o servidor já sabia renomear o grupo, chamar mais alguém e
// sair, e nenhuma tela usava (auditoria do mesmo dia). O teste confere, pela tela da Ana:
//
// - o grupo tem os três botões no cabeçalho; a conversa de duas pessoas só o de chamar alguém;
// - renomear muda o nome no cabeçalho e na lista, sem recarregar;
// - chamar a Duda põe ela no grupo (no servidor);
// - sair tira o grupo da lista da Ana, e ele continua para quem ficou.
//
//   node e2e/grupo-privado.mjs   (API de teste na 3099 e site na 5174)
import { abrirNavegador, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const API = process.env.API ?? 'http://localhost:3099';
const SITE = process.env.SITE ?? 'http://localhost:5174/app/';
const s = Date.now().toString(36).slice(-5);

const pedir = async (metodo, rota, token, corpo) => {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
async function conta(nome) {
  await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
  const r = await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' });
  return { token: r.token, id: r.user.id, nome };
}
const [ana, bia, cid, duda] = await Promise.all(['ana', 'bia', 'cid', 'duda'].map((n) => conta(n + s)));
const comunidade = await pedir('POST', '/api/communities', ana.token, { name: 'Grupo ' + s });
for (const p of [bia, cid, duda]) await pedir('POST', '/api/communities/join', p.token, { code: comunidade.inviteCode });
const grupo = await pedir('POST', '/api/direct', ana.token, { userIds: [bia.id, cid.id], name: 'Turma ' + s });
await pedir('POST', '/api/direct', ana.token, { userIds: [bia.id] }); // e uma conversa de duas pessoas

const { browser } = await abrirNavegador();
try {
  const page = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage());
  await page.addInitScript((tk) => localStorage.setItem('janja.token', tk), ana.token);
  await page.goto(SITE);
  await dispensarPresentes(page);
  // a comunidade aberta: é dela que sai a lista de quem dá para chamar
  await page.locator('.rail-item', { hasText: /^G/ }).first().click();
  await page.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /^Conversas/ }).click();

  // ---------- a conversa de duas pessoas: só chamar alguém ----------
  await page.locator('.direct-row', { hasText: new RegExp('^\\s*bia' + s) }).first().click();
  const cabecalho = page.locator('.main-header');
  await cabecalho.getByRole('button', { name: 'Adicionar pessoa' }).waitFor({ timeout: 10000 });
  (await cabecalho.getByRole('button', { name: 'Sair do grupo' }).count()) === 0
    ? ok('a conversa de duas pessoas tem só o "Adicionar pessoa"')
    : falhou('a conversa de duas pessoas oferece sair do grupo');

  // ---------- o grupo: renomear ----------
  await page.locator('.direct-row', { hasText: 'Turma ' + s }).first().click();
  await cabecalho.getByRole('button', { name: 'Renomear grupo' }).click();
  const renomear = page.getByRole('dialog', { name: 'Renomear grupo' });
  await renomear.getByLabel('Nome do grupo').fill('Squad ' + s);
  await renomear.getByRole('button', { name: 'Salvar' }).click();
  await cabecalho
    .filter({ hasText: 'Squad ' + s })
    .waitFor({ timeout: 5000 })
    .then(() => ok('renomear muda o nome no cabeçalho, sem recarregar'), () => falhou('o cabeçalho não mostrou o nome novo'));
  (await page.locator('.direct-row', { hasText: 'Squad ' + s }).count()) ? ok('e na lista de conversas') : falhou('a lista não mudou de nome');

  // ---------- chamar a Duda ----------
  await cabecalho.getByRole('button', { name: 'Adicionar pessoa' }).click();
  await page.getByRole('dialog', { name: 'Adicionar pessoa' }).locator('.group-person', { hasText: 'duda' + s }).click();
  await page.waitForTimeout(800);
  const daDuda = await pedir('GET', '/api/direct', duda.token);
  daDuda.some((c) => c.id === grupo.id) ? ok('a Duda entrou no grupo') : falhou('a Duda não está no grupo');

  // ---------- sair ----------
  await cabecalho.getByRole('button', { name: 'Sair do grupo' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sair' }).click();
  await page
    .locator('.direct-row', { hasText: 'Squad ' + s })
    .waitFor({ state: 'detached', timeout: 5000 })
    .then(() => ok('saindo, o grupo some da lista da Ana'), () => falhou('o grupo continua na lista da Ana'));
  const daBia = (await pedir('GET', '/api/direct', bia.token)).find((c) => c.id === grupo.id);
  daBia && !daBia.members.some((m) => m.id === ana.id) ? ok('e continua para quem ficou, sem a Ana') : falhou('o grupo da Bia: ' + JSON.stringify(daBia?.members));
} finally {
  await browser.close();
}
resumo('As ações do grupo');
