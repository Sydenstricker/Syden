// O BOLÃO DA COMUNIDADE (14/11/2026), na tela: o membro cria um bolão pelo atalho embaixo do salão e cadastra um jogo que
// começa em ~25 s; a outra pessoa palpita (e não vê o palpite de ninguém); passada a hora, o palpite fecha, quem criou
// lança o placar, e a classificação aparece na tela aberta da outra pessoa sem recarregar.
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

// Ana cria o bolão e o jogo pela tela
const A = await abrirBolao(ana, 'ana');
await A.getByLabel('Nome do bolão').fill('Copa da turma');
await A.locator('.bolao').getByRole('button', { name: 'Criar', exact: true }).click();
await A.getByRole('tab', { name: 'Jogos' }).waitFor();
const amanha = new Date(Date.now() + 86400000);
await A.getByLabel('Mandante').fill('Flamengo');
await A.getByLabel('Visitante').fill('Palmeiras');
const dois = (n) => String(n).padStart(2, '0');
await A.locator('.bolao').getByLabel('Data').fill(`${amanha.getFullYear()}-${dois(amanha.getMonth() + 1)}-${dois(amanha.getDate())}`);
await A.locator('.bolao').getByLabel('Hora').fill('21:30');
await A.locator('.bolao .calendario-novo').getByRole('button', { name: 'Criar', exact: true }).click();
await A.locator('.bolao-jogo', { hasText: 'Palmeiras' }).waitFor();
conferir(true, 'o jogo cadastrado pelo formulário aparece para quem criou');
// o jogo do teste começa daqui a 45 s (o formulário só marca minutos cheios): pela API, pela mesma conta
const comeca = Date.now() + 45000;
const bolaoId = (await pedir('GET', `/api/communities/${comunidade.id}/boloes`, ana)).boloes[0].id;
await pedir('POST', `/api/communities/${comunidade.id}/boloes/${bolaoId}/jogos`, ana, { casa: 'Brasil', fora: 'Argentina', quando: new Date(comeca).toISOString() });
await A.locator('.bolao-jogo', { hasText: 'Argentina' }).waitFor({ timeout: 10000 });
conferir(true, 'o jogo novo aparece sozinho (bolao:mudou)');

// Bia palpita
const B = await abrirBolao(bia, 'bia');
await B.locator('.bolao-abrir', { hasText: 'Copa da turma' }).click();
await B.getByLabel('Gols de Brasil').fill('2');
await B.getByLabel('Gols de Argentina').fill('1');
await B.locator('.bolao-jogo', { hasText: 'Argentina' }).getByRole('button', { name: 'Palpitar' }).click();
await B.getByText('Seu palpite está salvo').waitFor({ timeout: 10000 });
conferir(true, 'o palpite de Bia fica salvo');
await B.screenshot({ path: path.join(FOTOS, 'bolao-palpite.png') });
// Ana palpita também, e não vê o de Bia antes da hora
await A.getByLabel('Gols de Brasil').fill('1');
await A.getByLabel('Gols de Argentina').fill('1');
await A.locator('.bolao-jogo', { hasText: 'Argentina' }).getByRole('button', { name: 'Palpitar' }).click();
await A.getByText('Seu palpite está salvo').waitFor({ timeout: 10000 });
conferir(!(await A.locator('.bolao-palpites').isVisible()), 'antes da hora, ninguém vê os palpites dos outros');

// passada a hora: Ana lança o placar
await A.waitForTimeout(Math.max(0, comeca - Date.now()) + 1500);
await A.reload();
await A.getByText('Início', { exact: true }).first().click({ timeout: 30000 }).catch(() => {});
await A.locator('.bv-atalho', { hasText: 'Bolão' }).click({ timeout: 60000 });
await A.locator('.bolao-abrir', { hasText: 'Copa da turma' }).click();
await A.locator('.bolao-jogo', { hasText: 'Argentina' }).getByRole('button', { name: 'Lançar placar' }).waitFor({ timeout: 15000 });
await A.getByLabel('Gols de Brasil').fill('2');
await A.getByLabel('Gols de Argentina').fill('1');
await A.locator('.bolao-jogo', { hasText: 'Argentina' }).getByRole('button', { name: 'Lançar placar' }).click();

// a tela aberta de Bia relê sozinha (bolao:mudou)
await B.getByText('+10').first().waitFor({ timeout: 15000 });
conferir(true, 'Bia vê os 10 pontos sem recarregar');
await B.getByRole('tab', { name: 'Classificação' }).click();
const linhas = await B.locator('.bolao-ranking li').allInnerTexts();
console.log('  classificação:', linhas.map((l) => l.replace(/\s+/g, ' ')).join(' | '));
conferir(linhas.length === 2 && /bia/.test(linhas[0]) && /10/.test(linhas[0]), 'Bia lidera com 10');
await B.screenshot({ path: path.join(FOTOS, 'bolao-classificacao.png') });
await A.getByRole('button', { name: /Palpites/ }).click();
conferir((await A.locator('.bolao-palpites li').count()) === 2, 'depois da hora, os palpites de todos aparecem');
await A.screenshot({ path: path.join(FOTOS, 'bolao-jogo.png') });

await navegador.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
