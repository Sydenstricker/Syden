// O BOLÃO DA COMUNIDADE (15/11/2026, o formato que ele queria), na tela: Ana cria pelo atalho embaixo do salão uma pergunta
// com foto; Ana e Bia dão o palpite de dia e hora pelo calendário (e ninguém vê o dos outros); Ana fecha os palpites e eles
// aparecem na tela aberta de Bia sem recarregar; Ana lança a resposta, e a classificação por distância aparece para Bia.
//   API de teste e vite: ver o topo de e2e/calendario.mjs
//   node e2e/bolao.mjs   → e2e/fotos/bolao-*.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
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
const dona = await conta('dona' + sufixo), ana = await conta('ana' + sufixo), bia = await conta('bia' + sufixo);
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Bolão ' + sufixo });
await pedir('POST', '/api/communities/join', ana, { code: comunidade.inviteCode });
await pedir('POST', '/api/communities/join', bia, { code: comunidade.inviteCode });

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
async function abrirBolao(token, quem, largura = 1200) {
  const p = await (await navegador.newContext({ viewport: { width: largura, height: 950 } })).newPage();
  p.on('pageerror', (e) => console.log('ERRO (' + quem + '):', String(e)));
  p.on('dialog', (d) => d.accept());
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
  await p.getByText('Início', { exact: true }).first().click({ timeout: 30000 });
  await p.locator('.bv-atalho', { hasText: 'Bolão' }).click({ timeout: 60000 });
  await p.locator('.bolao').waitFor();
  return p;
}

// Ana cria o bolão pela tela, com foto
const A = await abrirBolao(ana, 'ana');
await A.locator('.bolao input[type=file]').setInputFiles(path.join(AQUI, '..', 'web', 'public', 'avatares', 'coelho-01-corpo.png'));
await A.locator('.bolao-previa img').waitFor();
await A.getByLabel('Qual é a pergunta?').fill('Quando o Caio chega?');
await A.locator('.bolao-novo').getByRole('button', { name: 'Criar', exact: true }).click();
await A.locator('.bolao-pergunta', { hasText: 'Quando o Caio chega?' }).waitFor({ timeout: 15000 });
conferir(await A.locator('.bolao-foto').evaluate((img) => img.complete && img.naturalWidth > 0), 'a foto da pergunta aparece');

// Bia e Ana palpitam pelo calendário
const B = await abrirBolao(bia, 'bia');
await B.locator('.bolao-abrir', { hasText: 'Quando o Caio chega?' }).click();
await B.locator('.bolao-palpitar input[type=datetime-local]').fill('2026-12-01T09:00');
await B.getByRole('button', { name: 'Palpitar' }).click();
await B.getByText('Seu palpite está salvo').waitFor({ timeout: 10000 });
conferir(true, 'o palpite de Bia fica salvo');
await B.screenshot({ path: path.join(FOTOS, 'bolao-palpite.png') });
await A.locator('.bolao-palpitar input[type=datetime-local]').first().fill('2026-12-01T10:30');
await A.getByRole('button', { name: 'Palpitar' }).click();
await A.getByText('Seu palpite está salvo').waitFor({ timeout: 10000 });
conferir((await A.locator('.bolao-ranking li').count()) === 0, 'aberto, ninguém vê os palpites dos outros');
await A.screenshot({ path: path.join(FOTOS, 'bolao-quem-criou.png') });

// Ana fecha: os palpites aparecem na tela aberta de Bia, sem recarregar (bolao:mudou)
await A.getByRole('button', { name: 'Fechar palpites' }).click();
await B.locator('.bolao-ranking li').nth(1).waitFor({ timeout: 15000 });
conferir((await B.locator('.bolao-ranking li').count()) === 2, 'fechado, Bia vê os dois palpites sem recarregar');

// Ana lança a resposta: a classificação por distância
await A.locator('.bolao-cuidar input[type=datetime-local]').fill('2026-12-01T10:00');
await A.getByRole('button', { name: 'Lançar resposta' }).click();
await B.locator('.bolao-distancia').first().waitFor({ timeout: 15000 });
const linhas = (await B.locator('.bolao-ranking li').allInnerTexts()).map((l) => l.replace(/\s+/g, ' '));
console.log('  classificação:', linhas.join(' | '));
conferir(linhas.length === 2 && /ana/.test(linhas[0]) && /\+30/.test(linhas[0]) && /bia/.test(linhas[1]), 'Ana (30 min depois) ganha de Bia (1 h antes)');
await B.screenshot({ path: path.join(FOTOS, 'bolao-classificacao.png') });

// na tela estreita, nada sai para o lado
await B.setViewportSize({ width: 380, height: 800 });
const C = B;
await C.waitForTimeout(500);
conferir(await C.locator('.bolao').evaluate((d) => d.scrollWidth <= d.clientWidth + 1), 'na tela estreita, nada estoura para o lado');
await C.screenshot({ path: path.join(FOTOS, 'bolao-estreita.png') });

// no calendário: o bolão com prazo aparece no dia em que os palpites fecham, e clicar o abre
const prazo = new Date();
prazo.setHours(23, 30, 0, 0);
if (prazo.getTime() < Date.now() + 60000) prazo.setDate(prazo.getDate() + 1);
await pedir('POST', `/api/communities/${comunidade.id}/boloes`, ana, { pergunta: 'Quem chega primeiro?', fechaEm: prazo.toISOString() });
await A.keyboard.press('Escape');
await A.keyboard.press('Escape');
await A.locator('.bv-atalho', { hasText: 'Calendário' }).click({ timeout: 30000 });
if (prazo.getMonth() !== new Date().getMonth()) await A.getByRole('button', { name: 'Próximo mês' }).click();
const noCalendario = A.locator('.calendario-bolao', { hasText: 'Quem chega primeiro?' });
await noCalendario.waitFor({ timeout: 15000 });
conferir((await A.locator('.calendario-dia .calendario-selo-bolao').allInnerTexts()).includes('B'), 'o dia do prazo ganha o selo B do bolão');
// o bolão já respondido fica registrado no dia da resposta (1/12/2026), mesmo depois de acabar
const meses = (2026 - prazo.getFullYear()) * 12 + 11 - prazo.getMonth();
for (let i = 0; i < meses; i++) await A.getByRole('button', { name: 'Próximo mês' }).click();
await A.locator('.calendario-bolao', { hasText: 'Quando o Caio chega?' }).filter({ hasText: 'Resposta' }).waitFor({ timeout: 15000 });
conferir(true, 'o bolão respondido fica no dia da resposta');
await A.screenshot({ path: path.join(FOTOS, 'bolao-respondido-no-calendario.png') });
for (let i = 0; i < meses; i++) await A.getByRole('button', { name: 'Mês anterior' }).click();
await A.screenshot({ path: path.join(FOTOS, 'bolao-no-calendario.png') });
await noCalendario.locator('button').click();
await A.locator('.bolao-pergunta', { hasText: 'Quem chega primeiro?' }).waitFor({ timeout: 15000 });
conferir(true, 'clicar no bolão do calendário abre o bolão');

await navegador.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
