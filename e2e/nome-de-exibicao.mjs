// O NOME DE EXIBIÇÃO DA CONTA (25/10/2026, "atualizei o apelido, mas o chat dele mantém o nome antigo"): o apelido é de
// uma comunidade só e não chega à conversa privada. O nome de exibição, escolhido em Minha conta, vale em todo o Syden:
// a conversa privada de quem está com a tela aberta troca o nome NA HORA, sem recarregar, e o apelido da comunidade
// continua por cima dele lá dentro.
//
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste FREIO_CADASTROS_POR_DIA=500
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort   (em web/)
//   node e2e/nome-de-exibicao.mjs   → e2e/fotos/nome-de-exibicao-*.png
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo } from './ajuda.mjs';

const API = process.env.API ?? 'http://localhost:3099';
const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
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
const esperar = (promessa, certo, errado) => promessa.then(() => ok(certo), () => falhou(errado));

const { browser } = await abrirNavegador();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
try {
  // A Ana usa a tela; o Beto é outra conta, pela API, na mesma comunidade de teste.
  const ana = await criarConta(page, 'ana');
  await dispensarPresentes(page);
  const tokenDaAna = await page.evaluate(() => localStorage.getItem('janja.token'));
  const eu = await pedir('GET', '/api/me', tokenDaAna);
  const betoNome = 'beto' + Date.now().toString().slice(-6);
  await pedir('POST', '/api/auth/register', null, { username: betoNome, password: 'segredo123', email: betoNome + '@exemplo.test', inviteCode: 'teste', nascimento: '1990-01-01' });
  const tokenDoBeto = (await pedir('POST', '/api/auth/login', null, { username: betoNome, password: 'segredo123' })).token;
  const conversa = await pedir('POST', '/api/direct', tokenDoBeto, { userIds: [eu.id] });

  // A conversa privada aberta na tela da Ana, com o nome da conta do Beto.
  await page.reload();
  // As conversas privadas abrem pelo botão "Conversas" na barra da esquerda. O presente de boas-vindas volta depois de
  // recarregar, e por cima de tudo: espera a tela estar de pé e o dispensa de novo.
  const conversas = page.getByRole('button', { name: /^Conversas/ }).first();
  await conversas.waitFor({ timeout: 30_000 });
  await dispensarPresentes(page);
  await conversas.click();
  const naLista = page.locator('.direct-name', { hasText: betoNome }).first();
  await naLista.waitFor({ timeout: 15_000 });
  await naLista.click();

  // O Beto escolhe o nome de exibição (em outra máquina, digamos): a tela da Ana troca sozinha.
  await pedir('PUT', '/api/me/nome-de-exibicao', tokenDoBeto, { nomeDeExibicao: 'Beto da Silva' });
  await esperar(
    page.locator('.direct-name', { hasText: 'Beto da Silva' }).first().waitFor({ timeout: 8000 }),
    'a lista de conversas troca para o nome de exibição, sem recarregar',
    'a lista de conversas continuou com o nome da conta',
  );
  await page.screenshot({ path: path.join(FOTOS, 'nome-de-exibicao-conversa.png') });

  // E a Ana escolhe o dela em Minha conta: o painel do canto e o cartão da conta mostram, com o nome da conta embaixo.
  await page.getByRole('button', { name: 'Configurações' }).first().click();
  await page.getByRole('button', { name: 'Minha conta' }).first().click().catch(() => {});
  const campo = page.getByLabel('Nome de exibição');
  await campo.waitFor({ timeout: 10_000 });
  await campo.fill('Ana Clara');
  await page.getByRole('button', { name: 'Salvar' }).first().click();
  await esperar(
    page.locator('.account-name', { hasText: 'Ana Clara' }).waitFor({ timeout: 8000 }),
    'Minha conta mostra o nome de exibição',
    'Minha conta não mostra o nome de exibição',
  );
  (await page.locator('.account-card .perfil-conta').innerText().catch(() => '')).trim() === ana
    ? ok('e o nome da conta embaixo')
    : falhou('o nome da conta não aparece embaixo em Minha conta');
  await page.screenshot({ path: path.join(FOTOS, 'nome-de-exibicao-minha-conta.png') });
  await page.keyboard.press('Escape');
  await esperar(
    page.locator('.user-panel-name', { hasText: 'Ana Clara' }).waitFor({ timeout: 8000 }),
    'o painel do canto mostra o nome de exibição',
    'o painel do canto ficou com o nome da conta',
  );

  // Vazio volta ao nome da conta.
  await pedir('PUT', '/api/me/nome-de-exibicao', tokenDoBeto, { nomeDeExibicao: '' });
  await esperar(
    page.locator('.direct-name', { hasText: betoNome }).first().waitFor({ timeout: 8000 }),
    'nome de exibição vazio volta ao nome da conta',
    'apagar o nome de exibição não voltou ao nome da conta',
  );
  void conversa;
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('nome de exibição');
}
