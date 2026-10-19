// "ESTOU JOGANDO NESTE AGORA" (19/10/2026), na tela: o membro aperta "Estou aqui" no cartão de um servidor da agenda, e
// a agenda aberta da DONA mostra o nome dele na hora (sem recarregar); "Sair" tira dos dois lados.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste FREIO_CADASTROS_POR_DIA=500
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort   (em web/)
//   node e2e/jogando-agora.mjs   → e2e/fotos/jogando-agora-*.png
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
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Jogando ' + sufixo });
await pedir('POST', '/api/communities/join', membro, { code: comunidade.inviteCode });
await pedir('POST', `/api/communities/${comunidade.id}/jogos`, dona, { nome: 'O survival', jogo: 'Minecraft', endereco: 'mc.exemplo.com:25565' });

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
async function abrirAgenda(token, quem) {
  const p = await (await navegador.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
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
  await p.getByRole('button', { name: comunidade.name }).first().click();
  await p.locator('.jogos-link').click({ timeout: 30000 });
  await p.locator('.jogo-cartao').waitFor();
  return p;
}

const D = await abrirAgenda(dona, 'dona');
const M = await abrirAgenda(membro, 'membro');
conferir(!(await D.locator('.jogo-agora strong').count()), 'ninguém jogando: não aparece lista');
await M.getByRole('button', { name: 'Estou aqui' }).click();
await D.locator('.jogo-agora strong', { hasText: 'membro' + sufixo }).waitFor({ timeout: 5000 }).catch(() => {});
conferir((await D.locator('.jogo-agora').textContent()).includes('membro' + sufixo), 'a agenda aberta da dona mostra o membro, sem recarregar');
conferir(await M.getByRole('button', { name: 'Sair', exact: true }).isVisible(), 'quem marcou vê o "Sair"');
await D.locator('.jogo-cartao').screenshot({ path: path.join(FOTOS, 'jogando-agora-dona.png') });
await M.locator('.jogo-cartao').screenshot({ path: path.join(FOTOS, 'jogando-agora-membro.png') });
await M.getByRole('button', { name: 'Sair', exact: true }).click();
await D.waitForTimeout(1500);
conferir(!(await D.locator('.jogo-agora strong').count()), '"Sair" tira da agenda da dona também');

await navegador.close();
if (falhas.length) { console.log(`\n${falhas.length} falha(s)`); process.exit(1); }
console.log('\ntudo certo');
