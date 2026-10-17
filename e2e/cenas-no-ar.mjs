// O QUARTO NOVO E O SALÃO ISOMÉTRICO NO BUILD DE PRODUÇÃO (lançados em 16/10/2026). Serve web/dist com a política de
// segurança do ar (e2e/politica-de-seguranca.mjs) e confere as duas situações que importam:
//   1. com os cabeçalhos de ANTES do lançamento (frame-ancestors 'none', X-Frame-Options DENY, frame-src sem 'self'),
//      a home mostra o quarto ANTIGO, e não um quadro em branco (web/src/cenaNova.ts);
//   2. com os cabeçalhos ajustados, o quarto novo e o salão isométrico abrem e dizem "pronto", sem nada barrado pela
//      política (o script da cena num arquivo à parte, as imagens em /app/assets/).
//
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:4324 INVITE_CODE=teste DATABASE_PATH=<banco novo>
//   cd web && VITE_API_URL=http://localhost:3099 npm run build
//   node e2e/cenas-no-ar.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';
import { CSP } from './politica-de-seguranca.mjs';

const DIST = new URL('../web/dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PORTA = 4324, SITE = `http://localhost:${PORTA}`, API = 'http://localhost:3099';
// A política do ar, com a API de teste no lugar da de produção.
const DA_API = (csp) => csp.replace('connect-src', `connect-src ${API} ws://localhost:3099`).replace('img-src', `img-src ${API}`);
const DEPOIS = { csp: DA_API(CSP), xfo: 'SAMEORIGIN' };
const ANTES = { csp: DA_API(CSP).replace("frame-src 'self' ", 'frame-src ').replace("frame-ancestors 'self'", "frame-ancestors 'none'"), xfo: 'DENY' };
let cabecalhos = ANTES;

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const servidor = createServer(async (pedido, resposta) => {
  let arquivo = join(DIST, normalize(decodeURIComponent(new URL(pedido.url, SITE).pathname)).replace(/^(\.\.[/\\])+/, ''));
  try {
    if ((await stat(arquivo)).isDirectory()) arquivo = join(arquivo, 'index.html');
    const dados = await readFile(arquivo);
    resposta.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] ?? 'application/octet-stream', 'content-security-policy': cabecalhos.csp, 'x-frame-options': cabecalhos.xfo });
    resposta.end(pedido.method === 'HEAD' ? undefined : dados);
  } catch {
    // o app é uma página só: o que não é arquivo cai no index dele
    try {
      const dados = await readFile(join(DIST, 'app', 'index.html'));
      resposta.writeHead(200, { 'content-type': TIPOS['.html'], 'content-security-policy': cabecalhos.csp, 'x-frame-options': cabecalhos.xfo });
      resposta.end(dados);
    } catch {
      resposta.writeHead(404).end();
    }
  }
});
await new Promise((ok) => servidor.listen(PORTA, ok));

const pedir = async (metodo, rota, token, corpo) => {
  const r = await fetch(API + rota, { method: metodo, headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
const sufixo = Date.now().toString(36).slice(-5);
await pedir('POST', '/api/auth/register', null, { username: 'cena' + sufixo, password: 'segredo123', email: `cena${sufixo}@exemplo.teste`, inviteCode: 'teste' });
const token = (await pedir('POST', '/api/auth/login', null, { username: 'cena' + sufixo, password: 'segredo123' })).token;
const comunidade = await pedir('POST', '/api/communities', token, { name: 'Cena ' + sufixo });

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

async function abrir() {
  const p = await (await navegador.newContext({ viewport: { width: 1280, height: 960 } })).newPage();
  const barrados = [], pedidos = [];
  p.context().on('request', (r) => { if (/\/assets\/cena-/.test(r.url())) pedidos.push(r.url().replace(/.*\/assets\//, '')); });
  p.on('console', (m) => { if (/Content Security Policy|Refused to|X-Frame-Options/i.test(m.text())) barrados.push(m.text().slice(0, 200)); });
  p.on('pageerror', (e) => barrados.push('ERRO: ' + String(e).slice(0, 200)));
  await p.addInitScript((tk) => localStorage.setItem('janja.token', tk), token);
  await p.goto(SITE + '/app/');
  // a conta nova ganha o presente dos primeiros, que cobre a tela: fecha
  for (let i = 0; i < 10; i++) {
    const rev = p.locator('.revelacao');
    if (!(await rev.isVisible().catch(() => false))) { if (i > 4) break; await p.waitForTimeout(700); continue; }
    const b = rev.getByRole('button').first();
    if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); else await p.keyboard.press('Escape');
    await p.waitForTimeout(800);
  }
  return { p, barrados, pedidos };
}

// 1. Os cabeçalhos de antes: o quarto antigo, e nenhum quadro em branco.
cabecalhos = ANTES;
{
  const { p } = await abrir();
  await p.waitForSelector('.home-cena', { timeout: 60000 });
  await p.waitForTimeout(3000);
  const iframe = await p.locator('.home-cena iframe').count();
  const antigo = await p.locator('.home-cena .quarto-cena, .home-cena svg, .home-cena img').count();
  conferir(iframe === 0 && antigo > 0, `com os cabeçalhos de antes, o quarto antigo (iframe: ${iframe}, cena antiga: ${antigo})`);
  await p.screenshot({ path: 'e2e/fotos/cenas-antes.png' }).catch(() => {});
  await p.context().close();
}

// 2. Os cabeçalhos ajustados: o quarto novo e o salão isométrico, sem nada barrado.
cabecalhos = DEPOIS;
{
  const { p, barrados, pedidos } = await abrir();
  await p.waitForSelector('.home-cena iframe', { timeout: 60000 });
  const t0 = Date.now();
  const quarto = await (await p.$('.home-cena iframe')).contentFrame();
  await quarto.waitForFunction(() => window.gpuDoTeste && document.querySelector('#tela'), null, { timeout: 60000 });
  await p.waitForSelector('.editor-entrar button', { timeout: 60000 }); // o Editar só aparece com o "pronto" da cena
  conferir(true, `o quarto novo abriu e disse "pronto" (${((Date.now() - t0) / 1000).toFixed(1)} s; ${await quarto.evaluate(() => window.gpuDoTeste())})`);
  await p.screenshot({ path: 'e2e/fotos/cenas-quarto.png' });
  // as imagens vêm num pacote (2 arquivos por cena, e não ~350), e o do salão é baixado antes de alguém entrar na comunidade
  await p.waitForTimeout(8000);
  const pacotes = [...new Set(pedidos.filter((u) => u.startsWith('cena-pacote-')))];
  conferir(pacotes.length === 2 && new Set(pedidos).size <= 4, `os arquivos das cenas: ${new Set(pedidos).size} (${pacotes.length} pacotes), o do salão já baixado antes de entrar`);
  await p.getByRole('button', { name: comunidade.name }).first().click();
  await p.getByRole('button', { name: 'Início' }).last().click(); // (sem recado, a comunidade abre no #geral)
  await p.waitForSelector('.salao-novo iframe', { timeout: 60000 });
  const salao = await (await p.$('.salao-novo iframe')).contentFrame();
  await salao.waitForFunction(() => window.visitaDoTeste && window.visitaDoTeste().conta, null, { timeout: 90000 });
  conferir(true, 'o salão isométrico abriu, com a conta da comunidade');
  await p.waitForTimeout(2000);
  await p.screenshot({ path: 'e2e/fotos/cenas-salao.png' });
  conferir(barrados.length === 0, 'nada barrado pela política: ' + JSON.stringify(barrados.slice(0, 4)));
}

await navegador.close();
servidor.close();
console.log(falhas.length ? falhas.length + ' falha(s)' : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
