// O CÓDIGO DO LAYOUT E O SALÃO DE CADA COMUNIDADE (10/11/2026, relatos dele: "estou em duas comunidades e elas estão exatamente
// iguais"; "na aba de editar deveria ter código para compartilhar o layout, como já ocorre na configuração dos coelhos"). Confere:
// (1) a segunda comunidade aberta no MESMO navegador nasce com o salão de fábrica, e não com o da primeira (a chave do navegador
// é a mesma para todas); (2) o Editar dá o código do salão da primeira, e colar na segunda deixa a segunda igual, depois do
// Aplicar; (3) o código de um salão não entra num quarto (outro tipo de cena) e lixo dá erro.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste; vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174
//   node e2e/pixel-art/salao/codigo-do-layout.mjs
import { chromium } from 'playwright-core';

const API = 'http://localhost:3099', APP = 'http://localhost:5174/app/';
const sufixo = Date.now().toString(36).slice(-5);
const pedir = async (metodo, rota, token, corpo) => {
  const r = await fetch(API + rota, { method: metodo, headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
await pedir('POST', '/api/auth/register', null, { username: 'dona' + sufixo, password: 'segredo123', email: 'dona' + sufixo + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
const dona = (await pedir('POST', '/api/auth/login', null, { username: 'dona' + sufixo, password: 'segredo123' })).token;
const A = await pedir('POST', '/api/communities', dona, { name: 'Primeira ' + sufixo });
const B = await pedir('POST', '/api/communities', dona, { name: 'Segunda ' + sufixo });
// o recado é o que abre o início (o salão) da comunidade sozinho
for (const c of [A, B]) await pedir('PUT', `/api/communities/${c.id}/boas-vindas`, dona, { titulo: 'Oi', texto: 'Bem-vindos.' });

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await (await navegador.newContext({ viewport: { width: 1400, height: 960 }, permissions: ['clipboard-read', 'clipboard-write'] })).newPage();
p.on('pageerror', (e) => console.log('ERRO:', String(e)));
await p.addInitScript((tk) => { localStorage.setItem('janja.token', tk); localStorage.setItem('syden:quarto-novo', '1'); }, dona);
await p.goto(APP);
await p.getByRole('button', { name: A.name }).first().waitFor({ timeout: 60000 });
for (let i = 0; i < 12; i++) {
  const rev = p.locator('.revelacao');
  if (!(await rev.isVisible().catch(() => false))) { if (i > 4) break; await p.waitForTimeout(700); continue; }
  const b = rev.getByRole('button').first();
  if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); else await p.keyboard.press('Escape');
  await p.waitForTimeout(900);
}
async function abrir(c) {
  const antes = await p.$('.salao-novo iframe');
  await p.getByRole('button', { name: c.name }).first().click();
  // o iframe da comunidade anterior sai e entra o desta (senão o teste pegaria o salão de antes)
  if (antes) await p.waitForFunction((el) => !el.isConnected, antes, { timeout: 30000 }).catch(() => {});
  await p.waitForSelector('.salao-novo iframe', { timeout: 60000 });
  await p.waitForTimeout(500);
  const frame = await (await p.$('.salao-novo iframe')).contentFrame();
  await frame.waitForFunction(() => window.visitaDoTeste && window.visitaDoTeste().conta, null, { timeout: 90000 });
  await p.waitForTimeout(2000);
  return frame;
}
const doServidor = async (c) => {
  // a página manda a arrumação ~0,7 s depois de abrir: espera até 15 s
  for (let i = 0; i < 30; i++) { const a = (await pedir('GET', `/api/communities/${c.id}/salao`, dona)).arrumacao; if (a) return a; await new Promise((ok) => setTimeout(ok, 500)); }
  return null;
};

// 1. a primeira: abre (vira a de fábrica no servidor) e muda o sofá de lugar pelo servidor
await abrir(A);
const deFabrica = await doServidor(A);
conferir(!!deFabrica, 'a primeira ganhou a arrumação de fábrica no servidor');
const mudada = JSON.parse(JSON.stringify(deFabrica));
const [id] = Object.keys(mudada.moveis).filter((k) => k.startsWith('sofa'));
mudada.moveis[id].c = [mudada.moveis[id].c[0] + 2, mudada.moveis[id].c[1]];
await pedir('PUT', `/api/communities/${A.id}/salao`, dona, mudada);
const fA = await abrir(B).then(() => abrir(A));
await fA.waitForFunction((x) => window.visitaDoTeste().retrato.moveis[x.id].c[0] === x.u, { id, u: mudada.moveis[id].c[0] }, { timeout: 15000 }).catch(() => {});

// 2. a segunda foi aberta neste mesmo navegador: tem de ser a de fábrica, e não a da primeira
const deB = await doServidor(B);
conferir(deB && JSON.stringify(deB.moveis[id].c) === JSON.stringify(deFabrica.moveis[id].c), 'a segunda nasceu com o salão de fábrica, e não com o da primeira: ' + JSON.stringify(deB?.moveis[id]?.c));

// 3. o código da primeira
await p.locator('.editor-entrar button:visible').click();
await p.getByRole('button', { name: 'Código do layout' }).click();
const campoDoCodigo = p.locator('.editor-codigo-painel input[readonly]');
await p.waitForFunction(() => document.querySelector('.editor-codigo-painel input[readonly]')?.value.startsWith('SYDL1-'), null, { timeout: 10000 });
const codigo = await campoDoCodigo.inputValue();
conferir(codigo.startsWith('SYDL1-') && codigo.length < 4000, `o código do salão sai (${codigo.length} caracteres)`);
await p.getByRole('button', { name: 'Cancelar' }).click().catch(() => {});

// 4. colar na segunda e aplicar
await abrir(B);
await p.locator('.editor-entrar button:visible').click();
await p.getByRole('button', { name: 'Código do layout' }).click();
await p.locator('.editor-codigo-painel input:not([readonly])').fill('não é código');
await p.locator('.editor-codigo-painel form button').click();
await p.waitForTimeout(500);
conferir((await p.locator('.editor-codigo-painel .form-error').count()) === 1, 'lixo colado avisa');
await p.locator('.editor-codigo-painel input:not([readonly])').fill(codigo);
await p.locator('.editor-codigo-painel form button').click();
await p.locator('.editor-codigo-painel .form-success').waitFor({ timeout: 10000 }).then(() => conferir(true, 'o código colado entra'), () => conferir(false, 'o código colado não entrou'));
await p.getByRole('button', { name: 'Aplicar' }).click();
await p.waitForTimeout(2500);
const deB2 = await doServidor(B);
conferir(JSON.stringify(deB2.moveis[id].c) === JSON.stringify(mudada.moveis[id].c), 'depois do Aplicar, a segunda tem o salão da primeira: ' + JSON.stringify(deB2.moveis[id].c));

await navegador.close();
console.log(falhas.length ? `${falhas.length} falha(s)` : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
