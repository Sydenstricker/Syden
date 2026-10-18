// OS AVISOS QUE NINGUÉM OUVIA (auditoria de 17/10/2026): o servidor avisava e a tela só mudava ao recarregar. O teste
// confere, sem recarregar a página da Ana (a primeira conta, que administra o Syden):
//
// - a Bia denuncia alguém, e o número ao lado de "Uso do servidor" aparece na tela da Ana;
// - com a tela de amigos aberta, o pedido de amizade da Bia chega na hora.
//
// Precisa ser a PRIMEIRA conta de um Syden recém-criado (banco novo), como o ideias.mjs.
//
//   node e2e/avisos-ao-vivo.mjs   (API de teste na 3099 e site na 5174)
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
const ana = await conta('ana' + s);
const bia = await conta('bia' + s);

const { browser } = await abrirNavegador();
try {
  const page = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage());
  await page.addInitScript((tk) => localStorage.setItem('janja.token', tk), ana.token);
  await page.goto(SITE);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  const uso = page.locator('.usage-link');
  await uso.waitFor({ timeout: 30000 });
  (await uso.locator('.usage-denuncias').count()) === 0 ? ok('sem denúncia, sem número') : falhou('já havia número antes da denúncia');

  await pedir('POST', '/api/reports', bia.token, { tipo: 'pessoa', alvo: ana.id, motivo: 'teste do aviso ao vivo' });
  await uso
    .locator('.usage-denuncias', { hasText: '1' })
    .waitFor({ timeout: 8000 })
    .then(() => ok('a denúncia da Bia aparece na hora, ao lado de "Uso do servidor"'), () => falhou('o número não apareceu sem recarregar'));

  // A tela de amigos aberta: na home, o quadro de fotos do quarto. O clique nele chega ao app como a ação "quadro", e é
  // essa mensagem que o teste manda, de dentro do quarto.
  await page.locator('.rail-logo').click();
  const quarto = await (await page.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await page.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'quadro' }, location.origin));
  await page.locator('.tela-com-volta').waitFor({ timeout: 10000 });
  await page.getByRole('tab', { name: /^Pedidos/ }).click();
  await pedir('POST', '/api/amigos', bia.token, { username: ana.nome });
  await page
    .locator('.tela-com-volta .amigos')
    .getByText(bia.nome)
    .first()
    .waitFor({ timeout: 8000 })
    .then(() => ok('o pedido de amizade da Bia chega na tela de amigos aberta'), () => falhou('o pedido não apareceu sem recarregar'));
} finally {
  await browser.close();
}
resumo('Avisos ao vivo');
