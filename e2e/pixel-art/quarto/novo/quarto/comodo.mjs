// O CÔMODO NO APP (06/11/2026, pedido dele: a cor da parede e do piso, e as três plantas): no Editar, a categoria Cômodo
// troca a planta (o de sempre, em L, o cubículo), a cor da parede e a do piso; nada vai ao servidor até Aplicar; e quem
// visita vê igual. Confere também que, na planta nova, todo móvel está em casa de chão e os de função continuam no quarto.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174   (em web/)
//   node e2e/pixel-art/quarto/novo/quarto/comodo.mjs   → fotos/comodo-*.png   (API=… APP=… para outras portas)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = process.env.API ?? 'http://localhost:3099', APP = process.env.APP ?? 'http://localhost:5174/app/', FOTOS = path.join(AQUI, 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const conta = async (nome) => {
  const c = await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' }) });
  if (!c.ok) throw new Error('cadastro: ' + (await c.text()));
  return (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: nome, password: 'segredo123' }) })).json());
};
const sufixo = Date.now().toString(36).slice(-5);
const ana = await conta('comodo' + sufixo);

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await (await navegador.newContext({ viewport: { width: 1280, height: 960 } })).newPage();
p.on('pageerror', (e) => { console.log('ERRO:', String(e)); falhas.push(String(e)); });
await p.addInitScript((tk) => { localStorage.setItem('janja.token', tk); localStorage.setItem('syden:quarto-novo', '1'); }, ana.token);
await p.goto(APP);
await p.waitForSelector('.quarto-novo iframe', { timeout: 60000 });
const frame = await (await p.$('.quarto-novo iframe')).contentFrame();
await frame.waitForFunction(() => window.visitaDoTeste?.().conta, null, { timeout: 90000 });
await p.waitForTimeout(1500);
for (let i = 0; i < 3; i++) { const b = p.getByRole('button', { name: 'Resgatar' }); if (await b.isVisible().catch(() => false)) { await b.click(); await p.waitForTimeout(1200); } }
await p.keyboard.press('Escape'); await p.waitForTimeout(800);
const doServidor = async () => (await (await fetch(API + '/api/quarto', { headers: { authorization: 'Bearer ' + ana.token } })).json()).arrumacao;

await p.locator('.editor-entrar button:visible').click(); await p.waitForTimeout(500);
await p.locator('.editor-categorias button', { hasText: 'Cômodo' }).first().click();
const item = (nome) => p.locator('.editor-grade .editor-item[aria-label="' + nome + '"]');
conferir((await p.locator('.editor-grade .editor-item').count()) === 3 + 8 + 6, 'o Cômodo tem as 3 plantas, as 8 paredes e os 6 pisos');
conferir((await item('Quadrado').getAttribute('aria-pressed')) === 'true', 'a planta de sempre vem marcada');
await item('Em L').click(); await p.waitForTimeout(1500);
await item('Sálvia').click(); await item('Nogueira').click(); await p.waitForTimeout(1200);
conferir((await item('Em L').getAttribute('aria-pressed')) === 'true', 'a planta em L fica marcada');
conferir((await item('Sálvia').getAttribute('aria-pressed')) === 'true' && (await item('Nogueira').getAttribute('aria-pressed')) === 'true', 'e as cores escolhidas também');
const chao = await frame.evaluate(() => { const a = window.arrumacaoDoTeste(), fora = []; for (const id of Object.keys(a)) if (id !== 'tapete' && a[id].c[0] < 4 && a[id].c[1] < 4) fora.push(id); return { fora, ids: Object.keys(a) }; });
conferir(!chao.fora.length, 'nenhum móvel ficou dentro do pilar do L (' + chao.fora.join(', ') + ')');
conferir(['cama', 'abajur', 'mesa', 'guarda-roupa'].every((id) => chao.ids.includes(id)), 'os móveis de função continuam no quarto');
conferir((await doServidor())?.planta !== 'l', 'antes de Aplicar, a planta não foi ao servidor');
await p.screenshot({ path: path.join(FOTOS, 'comodo-editor.png') });
await p.locator('.editor-fim .editor-aplicar').click(); await p.waitForTimeout(1500);
const a = await doServidor();
conferir(a?.planta === 'l' && a?.cores?.parede === 'salvia' && a?.cores?.piso === 'nogueira', 'Aplicar levou a planta e as cores ao servidor (' + JSON.stringify([a?.planta, a?.cores]) + ')');
conferir(a?.janela?.tipo !== 'original', 'a janela grande, que não cabe no L, virou outra (' + a?.janela?.tipo + ')');
await p.screenshot({ path: path.join(FOTOS, 'comodo-l.png') });

// O CUBÍCULO, e Cancelar volta ao L
await p.locator('.editor-entrar button:visible').click(); await p.waitForTimeout(400);
await p.locator('.editor-categorias button', { hasText: 'Cômodo' }).first().click();
await item('Cubículo').click(); await p.waitForTimeout(1500);
const cub = await frame.evaluate(() => Object.entries(window.arrumacaoDoTeste()).filter(([id, m]) => id !== 'tapete' && (m.c[0] < 2 || m.c[1] < 2)).map(([id]) => id));
conferir(!cub.length, 'no cubículo, nenhum móvel fora das 6 × 6 casas (' + cub.join(', ') + ')');
await p.screenshot({ path: path.join(FOTOS, 'comodo-cubiculo.png') });
await p.locator('.editor-fim .editor-botao', { hasText: 'Cancelar' }).click(); await p.waitForTimeout(1500);
conferir((await frame.evaluate(() => window.plantaDoTeste())) === 'l', 'Cancelar voltou à planta em L');
conferir((await doServidor())?.planta === 'l', 'e o servidor continua com o L');

// QUEM VISITA vê igual: a página do quarto, aberta sozinha, veste a arrumação do servidor
const p2 = await (await navegador.newContext({ viewport: { width: 900, height: 900 } })).newPage();
await p2.goto(APP + 'quarto-novo/');
await p2.waitForFunction(() => typeof window.vestirDoTeste === 'function', null, { timeout: 90000 });
const vista = await p2.evaluate((arr) => { window.vestirDoTeste(arr); return { planta: window.plantaDoTeste(), cores: window.retratoDoTeste().cores }; }, a);
conferir(vista.planta === 'l' && vista.cores.parede === 'salvia' && vista.cores.piso === 'nogueira', 'quem visita vê a mesma planta e as mesmas cores');

await navegador.close();
console.log(falhas.length ? falhas.length + ' falha(s)' : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
