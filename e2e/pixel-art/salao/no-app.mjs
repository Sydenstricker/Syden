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
  await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
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
conferir(await D.p.locator('.editor-entrar button').isVisible(), 'a dona tem o Editar');
await D.p.screenshot({ path: path.join(FOTOS, 'no-app-dona.png') });

const M = await abrirSalao(membro, 'membro');
await M.p.waitForTimeout(2500);
conferir(await M.frame.evaluate(() => window.visitaDoTeste().soVer), 'o membro só olha a arrumação');
conferir(!(await M.p.locator('.editor-entrar button').isVisible()), 'o membro não tem o Editar');
// A TV: o nome da função ao passar o mouse, e o clique entra na sala de voz.
const tv = await M.frame.evaluate(() => { const L = window.arrumacaoDoTeste(); return L.tv && window.ondeDoMovel ? window.ondeDoMovel('tv') : null; });
if (tv) {
  const caixa = await M.frame.locator('#tela').boundingBox();
  const lado = await M.frame.evaluate(() => document.getElementById('tela').width); // 1024 no salão 16 × 16
  const ponto = [caixa.x + tv[0] * caixa.width / lado, caixa.y + tv[1] * caixa.height / lado];
  await M.p.mouse.move(...ponto); await M.p.waitForTimeout(300);
  const rot = await M.frame.locator('#rotulo').textContent();
  conferir(!(await M.frame.locator('#rotulo').isHidden()) && rot.length > 0, 'a TV mostra o nome da função para o membro: ' + rot);
  await M.p.screenshot({ path: path.join(FOTOS, 'no-app-membro-tv.png') });
} else conferir(false, 'achar a TV na tela');

// A dona troca a janela pelo EDITOR (o layout dele, 16/10/2026): vai ao servidor no Aplicar e chega ao salão do membro.
const categoria = (nome) => D.p.locator('.editor-categorias button', { hasText: nome }).first().click();
const itens = D.p.locator('.editor-grade .editor-item');
await D.p.locator('.editor-entrar button').click(); await D.p.waitForTimeout(500);
await categoria('Janela');
await D.p.locator('.editor-grade .editor-item[aria-pressed="false"]').first().click(); // outro tipo de janela
await D.p.waitForTimeout(600);
await D.p.locator('.editor-fim .editor-aplicar').click();
await D.p.waitForTimeout(2500);
const guardado = await pedir('GET', `/api/communities/${comunidade.id}/salao`, membro);
conferir(guardado.arrumacao?.janela?.tipo && guardado.arrumacao.janela.tipo !== 'floreira', 'a janela trocada pela dona foi ao servidor (' + guardado.arrumacao?.janela?.tipo + ')');
await M.p.waitForTimeout(1500);
const doMembro = await M.frame.evaluate(() => window.visitaDoTeste().retrato.janela.tipo);
conferir(doMembro === guardado.arrumacao?.janela?.tipo, 'o salão do membro relê na hora (' + doMembro + ')');
await M.p.screenshot({ path: path.join(FOTOS, 'no-app-membro.png') });
// GUARDAR UM MÓVEL (escolhido, Tirar) E ESCOLHER O PÔSTER (as opções da barrinha): vão ao servidor no Aplicar e chegam
// ao salão aberto do membro.
const primeiroMovel = await D.frame.evaluate(() => Object.keys(window.visitaDoTeste().retrato.moveis).find((id) => ['sofa', 'mesinha', 'poltrona'].includes(id)));
await D.p.locator('.editor-entrar button').click(); await D.p.waitForTimeout(500);
await D.frame.evaluate((id) => window.selecionarDoTeste('m' + id), primeiroMovel); await D.p.waitForTimeout(300);
await D.p.locator('.editor-atalhos button', { hasText: 'Tirar' }).click(); await D.p.waitForTimeout(500);
await D.frame.evaluate(() => window.selecionarDoTeste('pposter')); await D.p.waitForTimeout(400);
await D.frame.locator('#barrinha [data-acao="opcoes"]').click(); await D.p.waitForTimeout(200);
await D.frame.locator('#barrinha .opcoes button').nth(2).click(); // o pôster "fogo"
await D.p.waitForTimeout(400);
await D.p.screenshot({ path: path.join(FOTOS, 'no-app-dona-editor.png') });
await D.p.locator('.editor-fim .editor-aplicar').click();
await D.p.waitForTimeout(2500);
const depois = (await pedir('GET', `/api/communities/${comunidade.id}/salao`, membro)).arrumacao;
conferir(depois.guardados?.includes(primeiroMovel), 'o móvel guardado pela dona foi ao servidor (' + JSON.stringify(depois.guardados) + ')');
conferir(depois.cores?.poster === 'fogo', 'o pôster escolhido foi ao servidor (' + depois.cores?.poster + ')');
conferir(depois.conhecidos?.includes('poster'), 'a arrumação guarda os objetos conhecidos (' + (depois.conhecidos?.length ?? 0) + ')');
await M.p.waitForTimeout(1500);
const doMembro2 = await M.frame.evaluate(() => ({ moveis: Object.keys(window.arrumacaoDoTeste()), cores: window.visitaDoTeste().retrato.cores }));
conferir(!doMembro2.moveis.includes(primeiroMovel) && doMembro2.cores.poster === 'fogo', 'o salão do membro mostra o móvel guardado e o pôster novo');
await M.p.screenshot({ path: path.join(FOTOS, 'no-app-membro-guardado.png') });
// E o servidor recusa o membro, mesmo que ele tente por fora da tela.
const r = await fetch(API + `/api/communities/${comunidade.id}/salao`, { method: 'PUT', headers: { authorization: 'Bearer ' + membro, 'content-type': 'application/json' }, body: JSON.stringify({ moveis: {} }) });
conferir(r.status === 403, 'o servidor recusa o membro (' + r.status + ')');

// O CARGO QUE ARRUMA O SALÃO (18/10/2026): a dona marca no cargo, dá ao membro, e o salão ABERTO dele ganha o Editar sem
// recarregar; o que ele desliga (a jukebox) vai para a turma; e a dona vê quem mexeu por último e desfaz.
const membroId = (await pedir('GET', `/api/communities/${comunidade.id}/members`, dona)).find((m) => m.username === 'membro' + sufixo).id;
const cargo = await pedir('POST', `/api/communities/${comunidade.id}/cargos`, dona, { nome: 'Decoração', cor: '#88aa66' });
await pedir('PUT', `/api/communities/${comunidade.id}/members/${membroId}/cargos/${cargo.id}`, dona);
await pedir('PATCH', `/api/communities/${comunidade.id}/cargos/${cargo.id}`, dona, { arrumaSalao: true });
await M.p.locator('.editor-entrar button').waitFor({ timeout: 15000 }).catch(() => {});
conferir(await M.p.locator('.editor-entrar button').isVisible(), 'o membro com o cargo ganha o Editar, sem recarregar');
conferir(!(await M.frame.evaluate(() => window.visitaDoTeste().soVer)), 'e a página deixa ele arrumar');
await M.frame.evaluate(() => {
  const [x, y] = window.ondeEsta('jukebox'), c = document.getElementById('tela'), q = c.getBoundingClientRect();
  c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: q.left + (x / c.width) * q.width, clientY: q.top + ((y - 8) / c.height) * q.height }));
});
await M.p.waitForTimeout(2500);
const comJukebox = await pedir('GET', `/api/communities/${comunidade.id}/salao`, dona);
conferir(comJukebox.arrumacao.desligados?.includes('jukebox'), 'a jukebox desligada pelo membro vai para a turma (' + JSON.stringify(comJukebox.arrumacao.desligados) + ')');
await D.p.locator('.salao-desfazer').waitFor({ timeout: 15000 }).catch(() => {});
const linha = await D.p.locator('.salao-desfazer').textContent().catch(() => '');
conferir(linha.includes('membro' + sufixo), 'a dona vê quem mexeu por último: ' + linha);
await D.p.screenshot({ path: path.join(FOTOS, 'no-app-dona-desfazer.png') });
await D.p.locator('.salao-desfazer button').click();
await D.p.waitForTimeout(2500);
const desfeito = await pedir('GET', `/api/communities/${comunidade.id}/salao`, dona);
conferir(!desfeito.arrumacao.desligados?.includes('jukebox') && desfeito.arrumacao.cores?.poster === 'fogo', 'desfazer volta ao salão de antes do membro');
conferir(!(await M.frame.evaluate(() => window.visitaDoTeste().retrato.desligados.includes('jukebox'))), 'e o salão aberto do membro relê');

s.close();
await navegador.close();
console.log(falhas.length ? falhas.length + ' falha(s)' : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
