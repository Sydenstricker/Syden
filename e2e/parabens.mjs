// A FESTA DE ANIVERSÁRIO DO SYDEN (18/10/2026): uma conta com aniversário HOJE abre o Syden e vê a festa (antes da
// revelação da insígnia, uma de cada vez); fecha; recarrega, e ela não aparece de novo (o servidor guardou o ano). Uma
// conta com aniversário amanhã não vê nada.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste FREIO_CADASTROS_POR_DIA=500
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort   (em web/)
//   node e2e/parabens.mjs   → e2e/fotos/parabens.png
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
  if (!r.ok) throw new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
async function conta(nome, dia) {
  await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
  const { token } = await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' });
  await pedir('PUT', '/api/me/aniversario', token, { dia: dia.getDate(), mes: dia.getMonth() + 1 });
  return token;
}
const hoje = new Date(), amanha = new Date(hoje.getTime() + 86400000);
const aniversariante = await conta('niver' + sufixo, hoje), outro = await conta('outro' + sufixo, amanha);

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
async function abrir(token) {
  const p = await (await navegador.newContext({ viewport: { width: 1100, height: 850 } })).newPage();
  await p.addInitScript((tk) => { localStorage.setItem('janja.token', tk); }, token);
  await p.goto(APP);
  await p.locator('.rail-list .rail-item').first().waitFor({ timeout: 60000 });
  await p.waitForTimeout(2500);
  return p;
}

const p = await abrir(aniversariante);
const festa = p.locator('.parabens-do-syden');
conferir(await festa.isVisible(), 'no dia, a festa aparece ao abrir o Syden');
conferir((await festa.textContent()).includes('Feliz aniversário, niver' + sufixo + '!'), 'com o nome da pessoa');
conferir(!(await p.locator('.revelacao').isVisible().catch(() => false)), 'a insígnia espera a festa (uma de cada vez)');
await p.waitForTimeout(1200);
await p.screenshot({ path: path.join(FOTOS, 'parabens.png') });
await festa.getByRole('button').click();
await p.waitForTimeout(800);
conferir(!(await festa.isVisible().catch(() => false)), 'fecha');
const visto = await pedir('GET', '/api/me/aniversario', aniversariante);
conferir(visto.parabensVistoEm === hoje.getFullYear(), 'o servidor guardou o ano (' + visto.parabensVistoEm + ')');
await p.reload();
await p.locator('.rail-list .rail-item').first().waitFor({ timeout: 60000 });
await p.waitForTimeout(2500);
conferir(!(await p.locator('.parabens-do-syden').isVisible().catch(() => false)), 'recarregando, não aparece de novo');

const q = await abrir(outro);
conferir(!(await q.locator('.parabens-do-syden').isVisible().catch(() => false)), 'aniversário amanhã: nada hoje');

await navegador.close();
console.log(falhas.length ? falhas.length + ' falha(s)' : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
