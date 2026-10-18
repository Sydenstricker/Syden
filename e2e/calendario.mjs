// O CALENDÁRIO DA COMUNIDADE (18/10/2026), na tela: a dona abre pelo atalho embaixo do salão, marca um evento pelo
// formulário, e o calendário aberto do MEMBRO mostra o evento na hora (sem recarregar); o aniversário do membro aparece
// (com os parabéns ligados); e o membro não tem o "Novo evento".
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste FREIO_CADASTROS_POR_DIA=500
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort   (em web/)
//   node e2e/calendario.mjs   → e2e/fotos/calendario-*.png
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

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
const dona = await conta('dona' + sufixo), membro = await conta('membro' + sufixo);
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Calendário ' + sufixo });
await pedir('POST', '/api/communities/join', membro, { code: comunidade.inviteCode });
// o aniversário do membro, daqui a 3 dias (no mês da tela, se der), e os parabéns ligados
const hoje = new Date(), niver = new Date(hoje.getFullYear(), hoje.getMonth(), Math.min(hoje.getDate() + 3, 28));
await pedir('PUT', '/api/me/aniversario', membro, { dia: niver.getDate(), mes: niver.getMonth() + 1 });
const canais = await pedir('GET', `/api/communities/${comunidade.id}/channels`, dona);
const texto = (Array.isArray(canais) ? canais : canais.channels).find((c) => c.type === 'text');
await pedir('PUT', `/api/communities/${comunidade.id}/aniversarios`, dona, { canalId: texto.id, texto: 'Parabéns, {pessoa}!' });

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
async function abrirCalendario(token, quem) {
  const p = await (await navegador.newContext({ viewport: { width: 1200, height: 950 } })).newPage();
  p.on('pageerror', (e) => console.log('ERRO (' + quem + '):', String(e)));
  await p.addInitScript((tk) => { localStorage.setItem('janja.token', tk); }, token);
  await p.goto(APP);
  await p.getByRole('button', { name: comunidade.name }).first().waitFor({ timeout: 60000 });
  // o presente dos primeiros e a revelação da insígnia cobrem a tela: fecha
  for (let i = 0; i < 6; i++) {
    const r = p.getByRole('button', { name: 'Resgatar' }), f = p.getByRole('button', { name: 'Fechar', exact: true });
    if (await r.isVisible().catch(() => false)) await r.click();
    else if (await f.first().isVisible().catch(() => false)) await f.first().click();
    else if (i > 2) break;
    await p.waitForTimeout(800);
  }
  await p.getByRole('button', { name: comunidade.name }).first().click();
  // sem recado, a comunidade abre nos canais: o salão é o Início, na barra lateral
  await p.getByText('Início', { exact: true }).first().click({ timeout: 30000 });
  await p.locator('.bv-atalho', { hasText: 'Calendário' }).click({ timeout: 60000 });
  await p.locator('.calendario').waitFor();
  return p;
}

const D = await abrirCalendario(dona, 'dona');
const M = await abrirCalendario(membro, 'membro');
conferir(await D.locator('.calendario-novo').isVisible(), 'a dona tem o "Novo evento"');
conferir(!(await M.locator('.calendario-novo').isVisible()), 'o membro não tem');
conferir((await M.locator('.calendario-lista').textContent()).includes('membro' + sufixo), 'o aniversário do membro aparece no calendário');
// a dona marca um evento para daqui a 2 dias, às 20h
const dia = new Date(hoje.getFullYear(), hoje.getMonth(), Math.min(hoje.getDate() + 2, 28));
const iso = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
await D.locator('.calendario-novo input[aria-label="Nome do evento"]').fill('Campeonato de sexta');
await D.locator('.calendario-novo input[type=date]').fill(iso);
await D.locator('.calendario-novo input[type=time]').fill('20:00');
await D.locator('.calendario-novo button[type=submit]').click();
await D.waitForTimeout(1200);
conferir((await D.locator('.calendario-lista').textContent()).includes('Campeonato de sexta'), 'o evento aparece para a dona');
await D.locator('.calendario').screenshot({ path: path.join(FOTOS, 'calendario-dona.png') });
// o membro, com o calendário aberto, recebe na hora
await M.locator('.calendario-lista', { hasText: 'Campeonato de sexta' }).waitFor({ timeout: 8000 }).catch(() => {});
const listaM = await M.locator('.calendario-lista').textContent();
conferir(listaM.includes('Campeonato de sexta') && listaM.includes('20:00'), 'o calendário aberto do membro mostra o evento na hora, às 20:00');
await M.locator('.calendario').screenshot({ path: path.join(FOTOS, 'calendario-membro.png') });
// o dia marcado na grade, e apagar
const marcas = await D.locator('.calendario-dia .calendario-marca.evento').count();
conferir(marcas === 1, 'a grade marca o dia do evento (' + marcas + ')');
await D.locator('.calendario-lista li', { hasText: 'Campeonato de sexta' }).getByRole('button').click();
await M.waitForTimeout(1500);
conferir(!(await M.locator('.calendario-lista').textContent()).includes('Campeonato de sexta'), 'apagado pela dona, some do calendário do membro');

await navegador.close();
console.log(falhas.length ? falhas.length + ' falha(s)' : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
