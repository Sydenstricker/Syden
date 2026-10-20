// A CHAMADA DE PONTA A PONTA (20/10/2026), na tela e no servidor de mídia: duas pessoas entram na sala de voz, cada uma
// vê o cadeado em "Voz conectada", o código de segurança dos dois é o mesmo, o LiveKit registra as faixas como
// CIFRADAS (ele só repassa ruído), e mesmo assim cada uma ouve a outra (o bipe do microfone falso chega decifrado).
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste FREIO_CADASTROS_POR_DIA=500
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort   (em web/)
//   LiveKit local: npm run dev:livekit (Docker)
//   node e2e/chamada-cifrada.mjs   → e2e/fotos/chamada-cifrada.png
import { RoomServiceClient } from 'livekit-server-sdk';
import { abrirNavegador, falhou, novaAba, ok, resumo } from './ajuda.mjs';

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
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Cifra ' + sufixo });
await pedir('POST', '/api/communities/join', amiga, { code: comunidade.inviteCode });

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
async function codigo(page) {
  const cadeado = page.locator('.chamada-cifrada');
  await cadeado.waitFor({ timeout: 20000 });
  if ((await cadeado.getAttribute('aria-expanded')) !== 'true') await cadeado.click();
  return (await page.locator('.codigo-de-seguranca code').innerText()).trim();
}
/** O som que chega dos outros, medido nos elementos de áudio da página: o maior volume em 3 s (0 a 1). */
const somQueChega = (page) =>
  page.evaluate(async () => {
    const fontes = [...document.querySelectorAll('audio')].map((a) => a.srcObject).filter((s) => s instanceof MediaStream && s.getAudioTracks().length);
    if (!fontes.length) return -1;
    const ctx = new AudioContext();
    const analisadores = fontes.map((s) => {
      const a = ctx.createAnalyser();
      ctx.createMediaStreamSource(s).connect(a);
      return a;
    });
    let maior = 0;
    const amostra = new Float32Array(2048);
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      for (const a of analisadores) {
        a.getFloatTimeDomainData(amostra);
        for (const v of amostra) maior = Math.max(maior, Math.abs(v));
      }
    }
    await ctx.close();
    return maior;
  });

const D = await novaAba(contexto), A = await novaAba(contexto);
await naSala(D, dona);
await naSala(A, amiga);
ok('as duas entraram na Sala 1');

// O código só fica igual quando cada uma já tem a chave pública da outra: espera até 15 s.
let cd = '', ca = '';
for (let i = 0; i < 15 && (!cd || cd !== ca); i++) {
  [cd, ca] = [await codigo(D), await codigo(A)];
  if (cd !== ca) await D.waitForTimeout(1000);
}
cd && cd === ca ? ok(`o cadeado aparece e o código de segurança é o mesmo para as duas (${cd})`) : falhou(`códigos diferentes: ${cd} / ${ca}`);
await D.screenshot({ path: 'e2e/fotos/chamada-cifrada.png' });

// O LiveKit: as faixas publicadas estão marcadas como cifradas (GCM), ou seja, ele recebe e repassa só ruído.
const livekit = new RoomServiceClient('http://localhost:7880', 'devkey', 'secret');
const salas = await livekit.listRooms();
let faixas = [];
for (const s of salas) {
  const gente = await livekit.listParticipants(s.name);
  if (gente.length === 2) faixas = gente.flatMap((p) => p.tracks);
}
faixas.length && faixas.every((t) => t.encryption !== 0)
  ? ok(`o LiveKit vê ${faixas.length} faixa(s), todas cifradas`)
  : falhou('faixas sem cifra no LiveKit: ' + JSON.stringify(faixas.map((t) => ({ tipo: t.type, cifra: t.encryption }))));

// E mesmo assim o som chega decifrado, nos dois sentidos.
const [ouveD, ouveA] = [await somQueChega(D), await somQueChega(A)];
ouveD > 0.01 && ouveA > 0.01
  ? ok(`cada uma ouve a outra (pico ${ouveD.toFixed(2)} e ${ouveA.toFixed(2)})`)
  : falhou(`som decifrado não chegou: ${ouveD} / ${ouveA}`);

await browser.close();
resumo('chamada-cifrada');
