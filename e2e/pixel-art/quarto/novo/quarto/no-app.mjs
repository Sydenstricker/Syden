// O QUARTO NOVO DENTRO DO APP (15/10/2026, só no desenvolvimento): entra numa conta, liga o quarto novo na home pelo botão
// de teste, e confere que (1) o quarto aparece no iframe, (2) passar o mouse no fone mostra o nome da função e clicar
// abre o painel das Salas no app, (3) mexer na janela guarda a arrumação no servidor.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste (banco novo)
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174   (em web/)
//   node e2e/pixel-art/quarto/novo/quarto/no-app.mjs   → fotos/no-app-*.png
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'http://localhost:3099', APP = 'http://localhost:5174/app/', FOTOS = path.join(AQUI, 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const nome = 'quarto' + Date.now().toString(36).slice(-5);
const c = await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste' }) });
if (!c.ok) throw new Error('cadastro: ' + (await c.text()));
const { token } = await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: nome, password: 'segredo123' }) })).json();

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await (await navegador.newContext({ viewport: { width: 1280, height: 960 } })).newPage();
p.on('pageerror', (e) => console.log('ERRO:', String(e)));
await p.addInitScript((tk) => { localStorage.setItem('janja.token', tk); localStorage.setItem('syden:quarto-novo', '1'); localStorage.setItem('syden.status', 'ausente'); }, token);
await p.goto(APP);
const quadro = p.frameLocator('.quarto-novo iframe');
await p.waitForSelector('.quarto-novo iframe', { timeout: 60000 });
const frame = p.frames().find((f) => f.url().includes('quarto-novo')) ?? (await (await p.$('.quarto-novo iframe')).contentFrame());
await frame.waitForFunction(() => window.visitaDoTeste && window.ondeNaParede?.('fone'), null, { timeout: 90000 });
await frame.waitForFunction(() => window.visitaDoTeste().conta, null, { timeout: 30000 }).catch(() => {});
conferir(!!(await frame.evaluate(() => window.visitaDoTeste().conta)), 'o quarto recebeu a conta do app');
// Ausente (escolhido pela pessoa): o coelho do quarto vai dormir.
await frame.waitForFunction(() => window.visitaDoTeste().estado === 'ausente', null, { timeout: 10000 }).catch(() => {});
await p.waitForTimeout(6000);
const ev = await frame.evaluate(() => window.visitaDoTeste());
conferir(ev.estado === 'ausente' && ev.destino === 'cama', 'ausente, o coelho vai para a cama (estado ' + ev.estado + ', indo para ' + ev.destino + ', pose ' + ev.pose + ')');
// Conta nova ganha o presente dos primeiros, que cobre a tela: resgata e segue.
for (let i = 0; i < 3; i++) { const b = p.getByRole('button', { name: 'Resgatar' }); if (await b.isVisible().catch(() => false)) { await b.click(); await p.waitForTimeout(1200); } }
await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(FOTOS, 'no-app-home.png') });

// O fone: o nome da função ao passar o mouse, e o clique abre as Salas do app.
const fo = await frame.evaluate(() => window.ondeNaParede('fone'));
const telaNoFrame = await frame.locator('#tela').boundingBox();
// (a caixa de um elemento dentro do iframe já vem nas coordenadas da página de fora)
const ponto = [telaNoFrame.x + fo[0] * telaNoFrame.width / 512, telaNoFrame.y + fo[1] * telaNoFrame.height / 512];
await p.mouse.move(...ponto); await p.waitForTimeout(300);
const rot = await quadro.locator('#rotulo').textContent();
conferir(!(await quadro.locator('#rotulo').isHidden()) && rot.length > 0, 'o fone mostra o nome da função: ' + rot);
await p.mouse.click(...ponto); await p.waitForTimeout(600);
conferir(await p.locator('.vila-painel').isVisible(), 'clicar no fone abre o painel das Salas no app');
await p.screenshot({ path: path.join(FOTOS, 'no-app-salas.png') });

// A BARRA DE ARRUMAR do app: Editar, trocar a janela, a cor do tapete e pôr a pintura na parede; tudo vai ao servidor.
await p.locator('.vila-painel-fechar').click().catch(() => {});
// (em abas desde 16/10/2026: cada grupo de figuras aparece só com a aba dele aberta)
const aba = (nome) => p.locator('.quarto-novo-abas').getByRole('tab', { name: nome, exact: true }).click();
const figuras = p.locator('.quarto-novo-gaveta .quarto-novo-objeto');
await p.locator('.quarto-novo-linha > button').first().click();
await aba('Janela');
await figuras.nth(1).click(); // a em arco (a figura de cada tipo; a original é a primeira)
await aba('Tapete');
await p.locator('.quarto-novo-cor').nth(2).click(); // o azul
await p.waitForTimeout(600); // a marca volta do quarto, com a arrumação
const corMarcada = await p.locator('.quarto-novo-cor').nth(2).getAttribute('aria-pressed');
await aba('Objetos da parede');
const nObjetos = await figuras.count();
await figuras.nth(4).click(); // a pintura (estava guardada)
await p.waitForTimeout(1800);
conferir(nObjetos >= 5, 'a aba mostra os objetos da parede como figuras (' + nObjetos + ')');
conferir(corMarcada === 'true', 'a cor escolhida fica marcada na barra');
conferir(await figuras.nth(4).getAttribute('aria-pressed') === 'true', 'a pintura fica marcada como posta');
await p.screenshot({ path: path.join(FOTOS, 'no-app-barra.png') });
const guardado = await (await fetch(API + '/api/quarto', { headers: { authorization: 'Bearer ' + token } })).json();
conferir(guardado.arrumacao?.janela?.tipo === 'arco', 'a janela trocada pela barra foi ao servidor (' + guardado.arrumacao?.janela?.tipo + ')');
conferir(guardado.arrumacao?.cores?.tapete === 'azul', 'a cor do tapete foi ao servidor (' + guardado.arrumacao?.cores?.tapete + ')');
conferir(!!guardado.arrumacao?.parede?.pintura, 'a pintura posta foi ao servidor');

await navegador.close();
console.log(falhas.length ? falhas.length + ' falha(s)' : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
