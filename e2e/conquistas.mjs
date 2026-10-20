// AS CONQUISTAS DA TURMA (20/10/2026), na tela: com cinco pessoas na comunidade, a dona abre as conquistas pelo atalho
// embaixo do salão; "A turma cresce" mostra 5 com o primeiro degrau cheio e a marca de "Novo"; as 28 aparecem nos cinco
// grupos, sem "faltam" nem barra de progresso; e quem não é membro não vê nada. (As contas de cada uma estão no teste do
// servidor, server/test/conquistas.test.ts.)
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste FREIO_CADASTROS_POR_DIA=500
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort   (em web/)
//   node e2e/conquistas.mjs   → e2e/fotos/conquistas.png
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'http://localhost:3099', APP = 'http://localhost:5174/app/', FOTOS = path.join(AQUI, 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const sufixo = Date.now().toString(36).slice(-5);
const pedir = async (metodo, rota, token, corpo) => {
  const r = await fetch(API + rota, { method: metodo, headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + JSON.stringify(j)), { status: r.status });
  return j;
};
async function conta(nome) {
  await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
  return (await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' })).token;
}
const dona = await conta('dona' + sufixo);
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Conquistas ' + sufixo });
for (let i = 0; i < 4; i++) await pedir('POST', '/api/communities/join', await conta(`amigo${i}` + sufixo), { code: comunidade.inviteCode });
const fora = await conta('fora' + sufixo);

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };

conferir(await pedir('GET', `/api/communities/${comunidade.id}/conquistas`, fora).then(() => false, (e) => e.status === 404), 'quem não é membro recebe 404');

const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await (await navegador.newContext({ viewport: { width: 1200, height: 1000 } })).newPage();
p.on('pageerror', (e) => { console.log('ERRO:', String(e)); falhas.push('erro de JavaScript'); });
await p.addInitScript((tk) => { localStorage.setItem('janja.token', tk); }, dona);
await p.goto(APP);
await p.getByRole('button', { name: comunidade.name }).first().waitFor({ timeout: 60000 });
for (let i = 0; i < 6; i++) {
  const r = p.getByRole('button', { name: 'Resgatar' }), f = p.getByRole('button', { name: 'Fechar', exact: true });
  if (await r.isVisible().catch(() => false)) await r.click();
  else if (await f.first().isVisible().catch(() => false)) await f.first().click();
  else if (i > 2) break;
  await p.waitForTimeout(800);
}
await p.getByRole('button', { name: comunidade.name }).first().click();
await p.getByText('Início', { exact: true }).first().click({ timeout: 30000 });
await p.locator('.bv-atalho', { hasText: 'Conquistas' }).click({ timeout: 60000 });
await p.locator('.conquistas').waitFor();
await p.locator('.conquista').first().waitFor();

const cresce = p.locator('.conquista', { hasText: 'A turma cresce' });
conferir((await cresce.locator('.conquista-valor').textContent()).trim() === '5', '"A turma cresce" mostra 5');
conferir((await cresce.locator('.conquista-degrau[data-cheio]').count()) === 1, 'com o primeiro degrau cheio');
conferir(await cresce.locator('.conquista-novo').isVisible(), 'e a marca de "Novo"');
conferir((await p.locator('.conquista').count()) === 28, 'as 28 conquistas (19 + uma por jogo) aparecem');
conferir((await p.locator('.conquistas-grupo h3').allTextContents()).length === 5, 'nos cinco grupos');
await p.locator('.conquistas').screenshot({ path: path.join(FOTOS, 'conquistas.png') });

// fora da tela, nada de "faltam" nem barra de progresso
const texto = await p.locator('.conquistas').textContent();
conferir(!/falta/i.test(texto) && !(await p.locator('.conquistas progress').count()), 'nada de "faltam" nem barra de progresso');

await navegador.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
