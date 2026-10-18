// O QUARTO ABRE JÁ ARRUMADO (relato dele, 18/10/2026: "quando abro o quarto inicia uma luz, depois fica como eu deixei").
// A pessoa deixou o abajur apagado (guardado no servidor); ao abrir o app, a cena só pode aparecer com ele apagado — nunca
// o quarto de fábrica, com o abajur aceso, por um instante. O teste vigia a página desde o começo: a cada 50 ms, se o
// quarto está à vista e como está o abajur nele.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174   (em web/)
//   node e2e/pixel-art/quarto/novo/quarto/abre-arrumado.mjs
import { chromium } from 'playwright-core';

const API = 'http://localhost:3099', APP = 'http://localhost:5174/app/';
const nome = 'arrumado' + Date.now().toString(36).slice(-5);
const pedir = async (metodo, rota, token, corpo) => {
  const r = await fetch(API + rota, { method: metodo, headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
  if (!r.ok) throw new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + (await r.text()));
  return r.json().catch(() => ({}));
};
await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
const { token } = await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' });
// a arrumação dele: a de fábrica (só a cama, que é o que o servidor exige ter), com o abajur APAGADO
await pedir('PUT', '/api/quarto', token, { moveis: { cama: { c: [1.5, 7], lado: 0 }, abajur: { c: [0.5, 5.5], lado: 0 } }, abajurApagado: true });

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await (await navegador.newContext({ viewport: { width: 1280, height: 960 } })).newPage();
// A DEMORA DO SERVIDOR DE VERDADE: daqui a arrumação chega no mesmo instante, e o defeito não aparece; com ele, o servidor
// fica na Alemanha (e o ping dele chegou a 400 ms). A arrumação do quarto chega 1,5 s depois de pedida.
await p.context().route('**/api/quarto', async (rota) => { await new Promise((ok) => setTimeout(ok, 1500)); await rota.continue(); });
await p.addInitScript((tk) => { localStorage.setItem('janja.token', tk); localStorage.setItem('syden:quarto-novo', '1'); }, token);
// a vigia, DESDE O PRIMEIRO INSTANTE da página (antes nem o iframe existe): na primeira vez que a cena está à vista E já
// desenhada, o abajur tem de estar apagado
const t0 = Date.now();
await p.goto(APP, { waitUntil: 'commit' });
let primeira = null, quando = 0;
while (Date.now() - t0 < 90000) {
  const el = await p.$('.quarto-novo iframe');
  const visivel = el && (await p.evaluate(() => { const f = document.querySelector('.quarto-novo iframe'); return !!f && getComputedStyle(f).visibility !== 'hidden' && !document.querySelector('.editor-carregando'); }).catch(() => false));
  if (visivel) {
    const frame = await el.contentFrame();
    const e = await frame?.evaluate(() => (window.estadoDoTeste ? window.estadoDoTeste().abajurApagado : undefined)).catch(() => undefined);
    if (e !== undefined) { primeira = e; quando = Date.now() - t0; break; }
  }
  await p.waitForTimeout(30);
}
conferir(primeira !== null, 'o quarto apareceu (' + (quando / 1000).toFixed(1) + ' s depois de abrir o app)');
conferir(primeira === true, 'no primeiro instante à vista, o abajur já está como ele deixou: apagado (veio ' + primeira + ')');
await navegador.close();
console.log(falhas.length ? falhas.length + ' falha(s)' : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
