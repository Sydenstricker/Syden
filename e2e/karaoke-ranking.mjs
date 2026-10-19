// O RANKING DO KARAOKÊ (19/10/2026), na tela: duas pessoas na sala de voz, uma põe a música, e o "Ranking" do karaokê
// mostra quem cantou e a música, com "Músicas cantadas: 1". Antes disso, sozinha na sala, não conta.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste FREIO_CADASTROS_POR_DIA=500
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort   (em web/)
//   LiveKit local: npm run dev:livekit (Docker)
//   node e2e/karaoke-ranking.mjs   → e2e/fotos/karaoke-ranking.png
import { abrirNavegador, falhou, novaAba, novaPessoa, ok, resumo } from './ajuda.mjs';

const API = 'http://localhost:3099', APP = 'http://localhost:5174/app/';
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
const dona = await conta('dona' + sufixo), amiga = await conta('amiga' + sufixo);
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Turma ' + sufixo });
await pedir('POST', '/api/communities/join', amiga, { code: comunidade.inviteCode });
// uma música de 2 s de silêncio, gerada aqui (nada de áudio de ninguém)
const wav = (() => {
  const amostras = 16000 * 2, b = Buffer.alloc(44 + amostras * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + amostras * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(amostras * 2, 40);
  return 'data:audio/wav;base64,' + b.toString('base64');
})();
await pedir('POST', `/api/communities/${comunidade.id}/karaoke`, dona, { title: 'Música de teste', audio: wav, seconds: 2 });

const { browser, contexto } = await abrirNavegador({ permissoes: ['microphone'] });
async function naSala(page, token) {
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
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
}
async function abrirKaraoke(page) {
  await page.locator('.stage-controls button[aria-label="Mais"]').click();
  await page.getByRole('button', { name: 'Karaokê', exact: true }).click();
  await page.locator('.karaoke').waitFor();
}
const ranking = () => pedir('GET', `/api/communities/${comunidade.id}/karaoke/ranking`, dona);

const D = await novaAba(contexto);
await naSala(D, dona);
ok('a dona entrou na Sala 1');
await abrirKaraoke(D);
await D.locator('.karaoke-tocar').first().click();
await D.waitForTimeout(1500);
(await ranking()).total === 0 ? ok('sozinha na sala, não contou') : falhou('contou com a dona sozinha na sala');
await D.getByRole('button', { name: 'Parar' }).click().catch(() => {});

const A = await novaPessoa(browser, { permissoes: ['microphone'] });
await naSala(A, amiga);
ok('a amiga entrou na mesma sala');
await D.waitForTimeout(3500);
// a primeira vez não contou, então o freio de recomeçar não vale: a dona põe de novo, agora com a turma na sala
await D.locator('.karaoke-tocar').first().click();
await D.waitForTimeout(1500);
const r = await ranking();
r.total === 1 && r.cantores[0]?.nome === 'dona' + sufixo ? ok('com a turma na sala, contou para a dona') : falhou('ranking: ' + JSON.stringify(r));
await D.getByRole('button', { name: 'Parar' }).click().catch(() => {});

await D.getByRole('button', { name: 'Ranking' }).click();
await D.locator('.karaoke-ranking').waitFor({ timeout: 8000 }).catch(() => {});
const texto = (await D.locator('.karaoke').textContent()) ?? '';
texto.includes('Músicas cantadas: 1') && texto.includes('dona' + sufixo) && texto.includes('Música de teste')
  ? ok('o painel mostra o total, quem cantou e a música')
  : falhou('o painel do ranking: ' + texto.slice(0, 300));
await D.locator('.karaoke').screenshot({ path: 'e2e/fotos/karaoke-ranking.png' });

await browser.close();
resumo('karaoke-ranking');
