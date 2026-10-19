// OS IDIOMAS DA PESSOA (19/10/2026), na tela: o membro escolhe em Configurações → Minha conta um idioma que fala e um
// que estuda; a dona abre o cartão dele e vê os dois, pelo nome na própria língua. E tirar a ficha tira do cartão.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste FREIO_CADASTROS_POR_DIA=500
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort   (em web/)
//   node e2e/idiomas-do-perfil.mjs   → e2e/fotos/idiomas-*.png
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
async function conta(nome) {
  await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
  return (await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' })).token;
}
const dona = await conta('dona' + sufixo), membro = await conta('membro' + sufixo);
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Idiomas ' + sufixo });
await pedir('POST', '/api/communities/join', membro, { code: comunidade.inviteCode });

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
async function abrir(token, quem) {
  const p = await (await navegador.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  p.on('pageerror', (e) => console.log('ERRO (' + quem + '):', String(e)));
  await p.addInitScript((tk) => { localStorage.setItem('janja.token', tk); }, token);
  await p.goto(APP);
  await p.getByRole('button', { name: comunidade.name }).first().waitFor({ timeout: 60000 });
  for (let i = 0; i < 6; i++) {
    const r = p.getByRole('button', { name: 'Resgatar' }), f = p.getByRole('button', { name: 'Fechar', exact: true });
    if (await r.isVisible().catch(() => false)) await r.click();
    else if (await f.first().isVisible().catch(() => false)) await f.first().click();
    else if (i > 2) break;
    await p.waitForTimeout(800);
  }
  return p;
}

// o membro escolhe nas Configurações
const M = await abrir(membro, 'membro');
await M.locator('button[aria-label="Configurações"]').first().click();
await M.locator('.settings-tab', { hasText: /Minha conta/ }).first().click();
await M.getByRole('combobox', { name: 'Idiomas falados: Adicionar' }).selectOption('pt-BR');
await M.locator('.meus-idiomas-ficha', { hasText: 'Português' }).waitFor();
await M.getByRole('combobox', { name: 'Idiomas em estudo: Adicionar' }).selectOption('ja');
await M.locator('.meus-idiomas-ficha', { hasText: '日本語' }).waitFor();
conferir(!(await M.getByRole('combobox', { name: 'Idiomas em estudo: Adicionar' }).locator('option[value="pt-BR"]').count()), 'o idioma falado não aparece para estudar');
await M.locator('.settings-card', { hasText: 'Idiomas falados' }).screenshot({ path: path.join(FOTOS, 'idiomas-configuracoes.png') });
conferir(JSON.stringify(await pedir('GET', '/api/me/idiomas', membro)) === JSON.stringify({ falados: ['pt-BR'], estudo: ['ja'] }), 'o servidor guardou as duas listas');

// a dona abre o cartão do membro
const D = await abrir(dona, 'dona');
await D.getByRole('button', { name: comunidade.name }).first().click();
await D.locator('.member', { hasText: 'membro' + sufixo }).first().click();
const cartao = D.locator('.perfil-cartao');
await cartao.locator('.perfil-idiomas').waitFor({ timeout: 8000 }).catch(() => {});
const texto = (await cartao.textContent()) ?? '';
conferir(texto.includes('Idiomas falados') && texto.includes('Português (Brasil)'), 'o cartão mostra o idioma falado');
conferir(texto.includes('Idiomas em estudo') && texto.includes('日本語'), 'e o idioma em estudo, na própria língua');
await cartao.screenshot({ path: path.join(FOTOS, 'idiomas-cartao.png') });
await D.keyboard.press('Escape');

// tirar a ficha tira do cartão
await M.getByRole('button', { name: 'Tirar: 日本語' }).click();
await M.waitForTimeout(800);
await D.locator('.member', { hasText: 'membro' + sufixo }).first().click();
await D.waitForTimeout(1200);
conferir(!((await D.locator('.perfil-cartao').textContent()) ?? '').includes('日本語'), 'tirada a ficha, o cartão não mostra mais');

await navegador.close();
if (falhas.length) { console.log(`\n${falhas.length} falha(s)`); process.exit(1); }
console.log('\ntudo certo');
