// ONDE O SYDEN ABRE e O ANIVERSÁRIO DO SYDEN (19/10/2026), na tela:
//   1. quem fechou o Syden numa comunidade reabre NO QUARTO (o padrão);
//   2. com "Onde parei" em Minha conta, reabre na comunidade;
//   3. em setembro de 2027, o calendário da comunidade marca o "Aniversário do Syden" no dia 19;
//   4. em 19/09/2027 a festa aparece ao abrir, e fechada não volta no mesmo ano.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste FREIO_CADASTROS_POR_DIA=500
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort   (em web/)
//   node e2e/abrir-e-aniversario-do-syden.mjs   → e2e/fotos/aniversario-do-syden-*.png
import { chromium } from 'playwright-core';

const API = 'http://localhost:3099', APP = 'http://localhost:5174/app/';
const sufixo = Date.now().toString(36).slice(-5);
const pedir = async (metodo, rota, token, corpo) => {
  const r = await fetch(API + rota, { method: metodo, headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
await pedir('POST', '/api/auth/register', null, { username: 'abre' + sufixo, password: 'segredo123', email: 'abre' + sufixo + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
const token = (await pedir('POST', '/api/auth/login', null, { username: 'abre' + sufixo, password: 'segredo123' })).token;
const comunidade = await pedir('POST', '/api/communities', token, { name: 'Abertura ' + sufixo });

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
await contexto.addInitScript((tk) => { if (!localStorage.getItem('janja.token')) localStorage.setItem('janja.token', tk); }, token);
const p = await contexto.newPage();
p.on('pageerror', (e) => console.log('ERRO:', String(e)));
async function fecharFestas() {
  for (let i = 0; i < 6; i++) {
    const r = p.getByRole('button', { name: 'Resgatar' }), f = p.getByRole('button', { name: 'Fechar', exact: true });
    if (await r.isVisible().catch(() => false)) await r.click();
    else if (await f.first().isVisible().catch(() => false)) await f.first().click();
    else if (i > 2) break;
    await p.waitForTimeout(700);
  }
}
// (no quarto, a barra lateral continua com os canais da última comunidade: o sinal de cada lugar é o quarto na tela)
const naComunidade = () => p.locator('.channel-name').first().isVisible().catch(() => false);
const noQuarto = () => p.locator('.quarto-novo, .quarto').first().isVisible().catch(() => false);

// 1. abre a comunidade, recarrega: volta ao quarto
await p.goto(APP);
await p.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).waitFor({ timeout: 60000 });
await fecharFestas();
await p.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).click();
await p.locator('.channel-name').first().waitFor({ timeout: 20000 });
await p.reload();
await p.waitForTimeout(4000);
await fecharFestas();
await p.screenshot({ path: 'e2e/fotos/abrir-no-quarto.png' });
conferir(await noQuarto(), 'fechado na comunidade, reabre no quarto (o padrão)');

// 2. "Onde parei": volta à comunidade
await p.locator('button[aria-label="Configurações"]').first().click();
await p.locator('.settings-tab', { hasText: /Minha conta/ }).first().click();
await p.getByRole('combobox', { name: 'Ao abrir o Syden' }).selectOption('ondeParei');
await p.keyboard.press('Escape');
await p.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).click();
await p.locator('.channel-name').first().waitFor({ timeout: 20000 });
await p.reload();
await p.waitForTimeout(4000);
await fecharFestas();
conferir(!(await noQuarto()) && (await naComunidade()), 'com "Onde parei", reabre na comunidade');

// 3 e 4. o relógio em 19/09/2027
await p.clock.install({ time: new Date(2027, 8, 19, 10, 0) });
await p.reload();
const festa = p.locator('.comemoracao', { hasText: 'Hoje é aniversário do Syden!' });
await festa.waitFor({ timeout: 30000 }).catch(() => {});
conferir(await festa.isVisible(), 'em 19/09/2027, a festa do Syden aparece ao abrir');
conferir(((await festa.textContent().catch(() => '')) ?? '').includes('2026'), 'e diz quando ele nasceu');
await p.clock.runFor(4000); // o relógio falso segura a saída da tela de carregamento
await p.screenshot({ path: 'e2e/fotos/aniversario-do-syden-festa.png' });
await festa.getByRole('button', { name: 'Que legal!' }).click().catch(() => {});
await p.waitForTimeout(3500); // o Syden espera 2 s para subir uma preferência (preferencias.ts)
await p.reload();
await p.waitForTimeout(5000);
conferir(!(await p.locator('.comemoracao', { hasText: 'Hoje é aniversário do Syden!' }).isVisible()), 'fechada, não volta no mesmo ano');
await fecharFestas();

await p.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).click();
await p.getByText('Início', { exact: true }).first().click({ timeout: 30000 });
await p.locator('.bv-atalho', { hasText: 'Calendário' }).click({ timeout: 60000 });
await p.locator('.calendario').waitFor();
const lista = (await p.locator('.calendario-lista').textContent()) ?? '';
conferir(lista.includes('Aniversário do Syden'), 'o calendário de setembro de 2027 marca o aniversário do Syden');
await p.locator('.calendario').screenshot({ path: 'e2e/fotos/aniversario-do-syden-calendario.png' });

await navegador.close();
if (falhas.length) { console.log(`\n${falhas.length} falha(s)`); process.exit(1); }
console.log('\ntudo certo');
