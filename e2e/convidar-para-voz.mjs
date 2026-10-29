// CONVIDAR PARA VOZ (29/10/2026, pedido dele: o do Discord), com o LiveKit de verdade: a dona entra SOZINHA numa sala e vê
// o "Convidar para voz" embaixo do próprio nome; a lista mostra 5 de quem está online, com "Ver mais"; ela convida a amiga,
// o botão vira o visto, e a amiga recebe o cartão no canto. "Entrar na voz" leva a amiga à sala, e o convite some dos dois
// lados (a dona já não está sozinha). Quem chamou sair da sala apaga o convite que ainda estava aberto.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste FREIO_CADASTROS_POR_DIA=500
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort   (em web/)
//   LiveKit local: npm run dev:livekit (Docker)
//   node e2e/convidar-para-voz.mjs   → e2e/fotos/convidar-para-voz-*.png
import fs from 'node:fs';
import path from 'node:path';
import { io } from 'socket.io-client';
import { abrirNavegador, falhou, novaPessoa, ok, resumo } from './ajuda.mjs';

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
const conferir = (certo, oque) => (certo ? ok(oque) : falhou(oque));

const nomeDaAmiga = 'amiga' + sufixo;
const nomeDaBia = 'bia' + sufixo;
const dona = await conta('dona' + sufixo), amiga = await conta(nomeDaAmiga), bia = await conta(nomeDaBia);
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Convite ' + sufixo });
for (const quem of [amiga, bia]) await pedir('POST', '/api/communities/join', quem, { code: comunidade.inviteCode });
// Uma sala própria, e não a "Sala 1": os microfones falsos não bipam numa chamada de verdade.
const nomeDaSala = 'convite-' + sufixo;
await pedir('POST', `/api/communities/${comunidade.id}/channels`, dona, { name: nomeDaSala, type: 'voice' });
// Mais quatro pessoas online, só pelo socket: com a amiga e a Bia, são seis, e a lista precisa do "Ver mais".
const extras = [];
for (let i = 1; i <= 4; i++) {
  const token = await conta(`extra${i}` + sufixo);
  await pedir('POST', '/api/communities/join', token, { code: comunidade.inviteCode });
  extras.push(io(API, { auth: { token }, transports: ['websocket'] }));
}

const { browser } = await abrirNavegador({ permissoes: ['microphone'] });
async function abrir(token) {
  const page = await novaPessoa(browser, { permissoes: ['microphone'] });
  await page.addInitScript((tk) => { localStorage.setItem('janja.token', tk); }, token);
  await page.goto(APP);
  await page.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).waitFor({ timeout: 60000 });
  for (let i = 0; i < 6; i++) {
    const r = page.getByRole('button', { name: 'Resgatar' }), f = page.getByRole('button', { name: 'Fechar', exact: true });
    if (await r.isVisible().catch(() => false)) await r.click();
    else if (await f.first().isVisible().catch(() => false)) await f.first().click();
    else if (i > 2) break;
    await page.waitForTimeout(800);
  }
  await page.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).click();
  return page;
}

const D = await abrir(dona);
const A = await abrir(amiga);
const B = await abrir(bia);
conferir(!(await D.locator('.convidar-voz').count()), 'fora da sala, não há convite');
await D.locator('.channel-name', { hasText: nomeDaSala }).first().click();
await D.locator('.stage-controls').waitFor({ timeout: 30000 });
await D.locator('.convidar-voz').waitFor({ timeout: 10000 }).catch(() => {});
conferir(await D.locator('.convidar-voz').isVisible(), 'sozinha na sala, a dona vê "Convidar para voz"');

await D.locator('.convidar-voz-abrir').click();
const lista = D.locator('.convidar-voz-lista');
await lista.waitFor();
conferir((await lista.locator('.convidar-voz-pessoa:not(.convidar-voz-mais)').count()) === 5, 'a lista mostra 5 pessoas');
conferir(await lista.locator('.convidar-voz-mais').isVisible(), 'com seis online, aparece o "Ver mais"');
await D.screenshot({ path: path.join(FOTOS, 'convidar-para-voz-lista.png') });
await lista.locator('.convidar-voz-mais').click();
conferir((await lista.locator('.convidar-voz-pessoa').count()) === 6, '"Ver mais" mostra as seis');

const linhaDaAmiga = lista.locator('.convidar-voz-pessoa', { hasText: nomeDaAmiga });
await linhaDaAmiga.locator('.convidar-voz-botao').click();
await linhaDaAmiga.locator('.convidar-voz-botao:disabled').waitFor({ timeout: 5000 }).catch(() => {});
conferir(await linhaDaAmiga.locator('.convidar-voz-botao').isDisabled(), 'convidada, o botão vira o visto');
await lista.locator('.convidar-voz-pessoa', { hasText: nomeDaBia }).locator('.convidar-voz-botao').click();

const cartao = A.locator('.convite-voz');
await cartao.waitFor({ timeout: 5000 }).catch(() => {});
conferir(await cartao.isVisible(), 'a amiga recebe o cartão do convite');
const texto = (await cartao.textContent()) ?? '';
conferir(texto.includes('dona' + sufixo) && texto.includes(nomeDaSala) && texto.includes(comunidade.name), 'o cartão diz quem chamou, a sala e a comunidade');
await A.screenshot({ path: path.join(FOTOS, 'convidar-para-voz-recebido.png') });

await cartao.getByRole('button', { name: 'Entrar na voz' }).click();
await A.locator('.stage-controls').waitFor({ timeout: 30000 }).catch(() => {});
conferir(await A.locator('.stage-controls').isVisible(), '"Entrar na voz" leva a amiga à sala');
await A.waitForTimeout(1000);
conferir(!(await A.locator('.convite-voz').count()), 'o cartão some do lado da amiga');
await D.keyboard.press('Escape');
await D.waitForTimeout(1000);
conferir(!(await D.locator('.convidar-voz').count()), 'com a amiga na sala, o "Convidar para voz" some');
await D.screenshot({ path: path.join(FOTOS, 'convidar-para-voz-juntas.png') });

// A Bia não entrou: o convite dela continua enquanto a dona está na sala, e some quando a dona sai.
await B.locator('.convite-voz').waitFor({ timeout: 5000 }).catch(() => {});
conferir(await B.locator('.convite-voz').isVisible(), 'a Bia, que não entrou, continua com o convite');
await D.locator('.voice-panel button[aria-label="Desconectar"]').click();
await B.waitForTimeout(1500);
conferir(!(await B.locator('.convite-voz').count()), 'a dona saiu da sala: o convite some do lado da Bia');

for (const s of extras) s.disconnect();
await browser.close();
resumo('convidar-para-voz');
