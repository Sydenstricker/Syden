// O TESTE DA VISITA (15/10/2026): duas contas numa API de teste; a Ana arruma o quarto na página (arrasta a janela para a
// outra parede e troca o tipo), e o Zeca, noutro navegador, visita e vê IGUAL, sem poder mexer em nada.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5181 INVITE_CODE=teste (banco novo)
//   node e2e/pixel-art/quarto/novo/quarto/visita.mjs   → fotos/visita-*.png
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'http://localhost:3099', PORTA = 5181, FOTOS = path.join(AQUI, 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const pagina = fs.readFileSync(path.join(AQUI, 'quarto.html'));
const servidor = http.createServer((_, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(pagina); }).listen(PORTA);

const sufixo = Date.now().toString(36).slice(-5);
async function conta(nome) {
  const c = await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste' }) });
  if (!c.ok) throw new Error('cadastro ' + nome + ': ' + (await c.text()));
  const e = await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: nome, password: 'segredo123' }) })).json();
  return { nome, id: e.user.id };
}
const ana = await conta('ana' + sufixo), zeca = await conta('zeca' + sufixo);

const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
async function abrirComo(quem) {
  const p = await (await navegador.newContext({ viewport: { width: 1240, height: 1000 } })).newPage();
  p.on('pageerror', (e) => console.log('ERRO na página:', String(e)));
  await p.goto('http://localhost:' + PORTA + '/');
  await p.waitForFunction(() => window.visitaDoTeste, null, { timeout: 60000 });
  await p.click('#conta summary');
  await p.fill('#nome', quem.nome); await p.fill('#senha', 'segredo123'); await p.click('#entrar');
  await p.waitForFunction((n) => window.visitaDoTeste().conta?.nome === n, quem.nome);
  return p;
}
const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };

// A Ana arruma: a janela para a parede da esquerda e o tipo em arco.
const pa = await abrirComo(ana);
const r = await pa.locator('#tela').boundingBox();
const em = (x, y) => [r.x + x * r.width / 512, r.y + y * r.height / 512];
await pa.mouse.move(...em(455, 220)); await pa.mouse.down();
for (let i = 1; i <= 20; i++) { await pa.mouse.move(...em(455 - i * 20, 220)); await pa.waitForTimeout(25); }
await pa.mouse.up(); await pa.waitForTimeout(400);
await pa.click('#tipo-janela'); await pa.waitForTimeout(1500); // o envio espera 0,7 s
const daAna = await pa.evaluate(() => window.visitaDoTeste().retrato);
conferir(daAna.janela.parede === 'esquerda' && daAna.janela.tipo === 'arco', 'a Ana pôs a janela em arco na parede da esquerda');
const guardado = await (await fetch(API + '/api/quarto/' + ana.id, { headers: { authorization: 'Bearer ' + (await pa.evaluate(() => JSON.parse(localStorage.getItem('syden-quarto-conta')).token)) } })).json();
conferir(JSON.stringify(guardado.arrumacao.janela) === JSON.stringify(daAna.janela), 'o servidor guardou a janela dela');
await pa.locator('#tela').screenshot({ path: path.join(FOTOS, 'visita-ana.png') });

// O Zeca visita.
const pz = await abrirComo(zeca);
const antesDoZeca = await pz.evaluate(() => window.visitaDoTeste().retrato);
await pz.fill('#visitar-id', String(ana.id)); await pz.click('#visitar');
await pz.waitForFunction(() => window.visitaDoTeste().soVer);
await pz.waitForTimeout(800);
const visto = await pz.evaluate(() => window.visitaDoTeste().retrato);
conferir(JSON.stringify(visto.moveis) === JSON.stringify(daAna.moveis), 'o Zeca vê os móveis onde a Ana pôs');
conferir(JSON.stringify(visto.janela) === JSON.stringify(daAna.janela), 'o Zeca vê a janela da Ana');
conferir(Math.abs(visto.cadeira.u - daAna.cadeira.u) < 0.01 && Math.abs(visto.cadeira.v - daAna.cadeira.v) < 0.01, 'e a cadeira onde ela parou');
await pz.locator('#tela').screenshot({ path: path.join(FOTOS, 'visita-zeca-vendo.png') });
// Visitando, nada se mexe: tenta arrastar a janela de volta.
const rz = await pz.locator('#tela').boundingBox();
const emZ = (x, y) => [rz.x + x * rz.width / 512, rz.y + y * rz.height / 512];
await pz.mouse.move(...emZ(56, 220)); await pz.mouse.down();
for (let i = 1; i <= 20; i++) { await pz.mouse.move(...emZ(56 + i * 20, 220)); await pz.waitForTimeout(25); }
await pz.mouse.up(); await pz.waitForTimeout(1200);
conferir(JSON.stringify((await pz.evaluate(() => window.visitaDoTeste().retrato)).janela) === JSON.stringify(daAna.janela), 'visitando, a janela não sai do lugar');
conferir(await pz.locator('#tipo-janela').isDisabled(), 'visitando, o botão de tipo fica desligado');
const daAnaDepois = await (await fetch(API + '/api/quarto/' + ana.id, { headers: { authorization: 'Bearer ' + (await pz.evaluate(() => JSON.parse(localStorage.getItem('syden-quarto-conta')).token)) } })).json();
conferir(JSON.stringify(daAnaDepois.arrumacao) === JSON.stringify(guardado.arrumacao), 'a visita não mudou o quarto da Ana no servidor');
// E volta ao dele, como estava.
await pz.click('#voltar'); await pz.waitForTimeout(600);
conferir(JSON.stringify((await pz.evaluate(() => window.visitaDoTeste().retrato)).janela) === JSON.stringify(antesDoZeca.janela), 'o Zeca volta ao quarto dele, como estava');

await navegador.close();
servidor.close();
console.log(falhas.length ? falhas.length + ' falha(s)' : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
