// O SALÃO NOVO DENTRO DO APP (15/10/2026, só no desenvolvimento): uma dona, um membro e alguém na voz. Confere que
// (1) o salão isométrico aparece no início da comunidade, com a rota do salão desta comunidade; (2) quem está na call de
// VERDADE aparece no salão; (3) a TV mostra o nome da função e o clique entra na voz; (4) só a dona tem a barra de
// arrumar, e o que ela muda vai ao servidor e chega na hora ao salão aberto do membro; (5) o membro não guarda nada.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste (banco novo)
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174   (em web/)
//   node e2e/pixel-art/salao/no-app.mjs   → fotos/no-app-*.png
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { io } from 'socket.io-client';

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
  await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste' });
  return (await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' })).token;
}
const dona = await conta('dona' + sufixo), membro = await conta('membro' + sufixo), falante = await conta('voz' + sufixo);
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Salão ' + sufixo });
for (const t of [membro, falante]) await pedir('POST', '/api/communities/join', t, { code: comunidade.inviteCode });
// O recado da dona: é ele que abre o início da comunidade sozinho, e é o que o coelho do balcão lê.
await pedir('PUT', `/api/communities/${comunidade.id}/boas-vindas`, dona, { titulo: 'Bem-vindos!', texto: 'Sexta tem karaokê.' });
const canais = await pedir('GET', `/api/communities/${comunidade.id}/channels`, dona);
const sala = (Array.isArray(canais) ? canais : canais.channels).find((c) => c.type === 'voice');
// Alguém na voz, só pelo socket (sem áudio): é o que enche a lista de quem está na call.
const s = io(API, { auth: { token: falante }, transports: ['websocket'] });
await new Promise((ok) => s.on('connect', ok));
await new Promise((ok) => s.emit('voice:join', { channelId: sala.id }, ok));

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
async function abrirSalao(token, quem) {
  const p = await (await navegador.newContext({ viewport: { width: 1280, height: 960 } })).newPage();
  p.on('pageerror', (e) => console.log('ERRO (' + quem + '):', String(e)));
  await p.addInitScript((tk) => { localStorage.setItem('janja.token', tk); localStorage.setItem('syden:quarto-novo', '1'); }, token);
  await p.goto(APP);
  // Conta nova ganha o presente dos primeiros, que cobre a tela: resgata e fecha (ele chega um pouco depois da tela).
  await p.getByRole('button', { name: comunidade.name }).first().waitFor({ timeout: 60000 });
  for (let i = 0; i < 12; i++) {
    const rev = p.locator('.revelacao');
    if (!(await rev.isVisible().catch(() => false))) { if (i > 4) break; await p.waitForTimeout(700); continue; }
    const b = rev.getByRole('button').first();
    if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); else await p.keyboard.press('Escape');
    await p.waitForTimeout(900);
  }
  await p.getByRole('button', { name: comunidade.name }).first().click();
  await p.waitForSelector('.salao-novo iframe', { timeout: 60000 });
  const frame = await (await p.$('.salao-novo iframe')).contentFrame();
  await frame.waitForFunction(() => window.visitaDoTeste && window.visitaDoTeste().conta, null, { timeout: 90000 });
  return { p, frame };
}

const D = await abrirSalao(dona, 'dona');
conferir(true, 'o salão isométrico aparece no início da comunidade');
await D.p.waitForTimeout(2500);
const nomes = await D.frame.locator('#nomes span').allTextContents();
conferir(nomes.includes('voz' + sufixo), 'quem está na call de verdade aparece no salão: ' + JSON.stringify(nomes));
conferir(!(await D.frame.evaluate(() => window.visitaDoTeste().soVer)), 'a dona pode arrumar');
const rec = await D.frame.evaluate(() => window.recadoDoTeste());
conferir((await D.frame.locator('#recado').textContent()).includes('karaokê'), 'o coelho do balcão lê o recado da dona ' + JSON.stringify(rec));
conferir(await D.p.locator('.salao-novo .quarto-novo-barra').isVisible(), 'a dona tem a barra de arrumar');
await D.p.screenshot({ path: path.join(FOTOS, 'no-app-dona.png') });

const M = await abrirSalao(membro, 'membro');
await M.p.waitForTimeout(2500);
conferir(await M.frame.evaluate(() => window.visitaDoTeste().soVer), 'o membro só olha a arrumação');
conferir(!(await M.p.locator('.salao-novo .quarto-novo-barra').isVisible()), 'o membro não tem a barra de arrumar');
// A TV: o nome da função ao passar o mouse, e o clique entra na sala de voz.
const tv = await M.frame.evaluate(() => { const L = window.arrumacaoDoTeste(); return L.tv && window.ondeDoMovel ? window.ondeDoMovel('tv') : null; });
if (tv) {
  const caixa = await M.frame.locator('#tela').boundingBox();
  const ponto = [caixa.x + tv[0] * caixa.width / 512, caixa.y + tv[1] * caixa.height / 512];
  await M.p.mouse.move(...ponto); await M.p.waitForTimeout(300);
  const rot = await M.frame.locator('#rotulo').textContent();
  conferir(!(await M.frame.locator('#rotulo').isHidden()) && rot.length > 0, 'a TV mostra o nome da função para o membro: ' + rot);
  await M.p.screenshot({ path: path.join(FOTOS, 'no-app-membro-tv.png') });
} else conferir(false, 'achar a TV na tela');

// A dona troca a janela pela barra: vai ao servidor e chega ao salão aberto do membro.
await D.p.locator('.salao-novo .quarto-novo-barra > button').first().click();
await D.p.locator('.salao-novo .quarto-novo-barra > button', { hasText: 'Janela' }).click();
await D.p.waitForTimeout(2500);
const guardado = await pedir('GET', `/api/communities/${comunidade.id}/salao`, membro);
conferir(guardado.arrumacao?.janela?.tipo && guardado.arrumacao.janela.tipo !== 'floreira', 'a janela trocada pela dona foi ao servidor (' + guardado.arrumacao?.janela?.tipo + ')');
await M.p.waitForTimeout(1500);
const doMembro = await M.frame.evaluate(() => window.visitaDoTeste().retrato.janela.tipo);
conferir(doMembro === guardado.arrumacao?.janela?.tipo, 'o salão do membro relê na hora (' + doMembro + ')');
await M.p.screenshot({ path: path.join(FOTOS, 'no-app-membro.png') });
// E o servidor recusa o membro, mesmo que ele tente por fora da tela.
const r = await fetch(API + `/api/communities/${comunidade.id}/salao`, { method: 'PUT', headers: { authorization: 'Bearer ' + membro, 'content-type': 'application/json' }, body: JSON.stringify({ moveis: {} }) });
conferir(r.status === 403, 'o servidor recusa o membro (' + r.status + ')');

s.close();
await navegador.close();
console.log(falhas.length ? falhas.length + ' falha(s)' : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
