// O MICROFONE TRAVADO PELA MODERAÇÃO (21/10/2026, pedido dele: "consigo mutar mas não consigo liberar"), com o LiveKit de
// verdade: a dona trava o microfone da amiga pelo menu, a amiga vê o aviso e não consegue ligar, sair e voltar não destrava,
// o menu passa a oferecer "Liberar microfone", e liberar NÃO liga o microfone de ninguém — a amiga liga quando quiser.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste FREIO_CADASTROS_POR_DIA=500
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort   (em web/)
//   LiveKit local: npm run dev:livekit (Docker)
//   node e2e/microfone-travado.mjs   → e2e/fotos/microfone-travado.png
import { RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { abrirNavegador, falhou, novaPessoa, ok, resumo } from './ajuda.mjs';

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
const nomeDaAmiga = 'amiga' + sufixo;
const dona = await conta('dona' + sufixo), amiga = await conta(nomeDaAmiga);
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Trava ' + sufixo });
await pedir('POST', '/api/communities/join', amiga, { code: comunidade.inviteCode });
// Uma sala própria, e não a "Sala 1": os microfones falsos não bipam numa chamada de verdade.
const nomeDaSala = 'trava-' + sufixo;
const salaId = (await pedir('POST', `/api/communities/${comunidade.id}/channels`, dona, { name: nomeDaSala, type: 'voice' })).id;

const { browser } = await abrirNavegador({ permissoes: ['microphone'] });
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
  await entrar(page);
}
async function entrar(page) {
  await page.locator('.channel-name', { hasText: nomeDaSala }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
}

const livekit = new RoomServiceClient('http://localhost:7880', 'devkey', 'secret');
/** O microfone da amiga, visto pelo LiveKit: 'aberto', 'mudo' ou 'nenhum'. */
async function microfoneDaAmiga() {
  for (const s of await livekit.listRooms()) {
    for (const p of await livekit.listParticipants(s.name)) {
      if (p.name !== nomeDaAmiga) continue;
      const mic = p.tracks.find((t) => t.source === TrackSource.MICROPHONE);
      return !mic ? 'nenhum' : mic.muted ? 'mudo' : 'aberto';
    }
  }
  return 'fora da sala';
}
async function esperarMicrofone(estado, ms = 8000) {
  let agora = '';
  for (let i = 0; i < ms / 500; i++) {
    agora = await microfoneDaAmiga();
    if (estado.includes(agora)) return agora;
    await new Promise((r) => setTimeout(r, 500));
  }
  return agora;
}
const AVISO = 'A moderação silenciou seu microfone';
/** Abre o menu da amiga pela lista da sala, na barra lateral da dona. */
async function menuDaAmiga() {
  await D.keyboard.press('Escape');
  await D.locator('.voice-member', { hasText: nomeDaAmiga }).click({ button: 'right' });
}

// Uma pessoa por contexto: duas abas do mesmo contexto dividem o localStorage, e a dona agiria com a conta da amiga.
const D = await novaPessoa(browser, { permissoes: ['microphone'] }), A = await novaPessoa(browser, { permissoes: ['microphone'] });
await naSala(D, dona);
await naSala(A, amiga);
const botaoDoMic = A.locator('.stage-controls button').first();
if (/Ativar microfone/.test((await botaoDoMic.getAttribute('aria-label')) ?? '')) await botaoDoMic.click();
(await esperarMicrofone(['aberto'])) === 'aberto' ? ok('a amiga está falando') : falhou('o microfone da amiga não abriu: ' + (await microfoneDaAmiga()));

// TRAVAR, pelo menu da dona.
await menuDaAmiga();
await D.getByText('Silenciar microfone para todos').click();
const depois = await esperarMicrofone(['mudo', 'nenhum']);
depois !== 'aberto' ? ok(`travado: o LiveKit vê o microfone ${depois}`) : falhou('o microfone continuou aberto');
(await A.getByText(AVISO).isVisible({ timeout: 5000 }).catch(() => false)) ? ok('a amiga vê o aviso') : falhou('sem o aviso para a amiga');

// A amiga tenta ligar: não liga.
await botaoDoMic.click();
await A.waitForTimeout(2000);
(await microfoneDaAmiga()) !== 'aberto' ? ok('o botão de microfone da amiga não destrava') : falhou('a amiga ligou o microfone travado');

// Sair e voltar não destrava.
await A.locator('.leave-button').click();
await A.waitForTimeout(1500);
await entrar(A);
await A.waitForTimeout(2500);
(await microfoneDaAmiga()) !== 'aberto' && (await A.getByText(AVISO).isVisible().catch(() => false))
  ? ok('sair e voltar da chamada não destrava')
  : falhou('voltou destravada: ' + (await microfoneDaAmiga()));
await A.screenshot({ path: 'e2e/fotos/microfone-travado.png' });

// LIBERAR, pelo mesmo item do menu.
await menuDaAmiga();
const liberar = D.getByText('Liberar microfone');
(await liberar.isVisible({ timeout: 5000 }).catch(() => false)) ? ok('o menu oferece "Liberar microfone"') : falhou('o menu não oferece liberar');
await D.screenshot({ path: 'e2e/fotos/microfone-travado-menu.png' });
await liberar.click();
await A.getByText(AVISO).waitFor({ state: 'hidden', timeout: 8000 }).then(() => ok('o aviso some para a amiga'), () => falhou('o aviso ficou'));
await A.waitForTimeout(1500);
(await microfoneDaAmiga()) !== 'aberto' ? ok('liberar NÃO liga o microfone de ninguém') : falhou('liberar ligou o microfone sozinho');

// Agora ela liga quando quer.
await botaoDoMic.click();
(await esperarMicrofone(['aberto'])) === 'aberto' ? ok('liberado, a amiga liga o microfone') : falhou('liberado e ainda não liga: ' + (await microfoneDaAmiga()));

await menuDaAmiga();
(await D.getByText('Silenciar microfone para todos').isVisible({ timeout: 5000 }).catch(() => false))
  ? ok('o menu volta a oferecer silenciar')
  : falhou('o menu não voltou a "Silenciar"');

// UM CLIENTE MODIFICADO (o console) com a trava: entra na sala com a mesma senha que o app recebe e tenta publicar a voz
// como microfone e como "som da tela" (achado da revisão de 21/10/2026). Quem recusa é o LiveKit, não a tela.
await menuDaAmiga();
await D.getByText('Silenciar microfone para todos').click();
await esperarMicrofone(['mudo', 'nenhum']);
const tentativas = await A.evaluate(async ({ api, sala }) => {
  const { Room, Track, createLocalAudioTrack } = await import('/app/node_modules/.vite/deps/livekit-client.js');
  const token = localStorage.getItem('janja.token');
  const senha = await (await fetch(`${api}/api/channels/${sala}/voice-token`, { method: 'POST', headers: { authorization: 'Bearer ' + token } })).json();
  const room = new Room();
  await room.connect(senha.url, senha.token, { autoSubscribe: false });
  const resultado = {};
  for (const [nome, source] of [['microfone', Track.Source.Microphone], ['som da tela', Track.Source.ScreenShareAudio]]) {
    const faixa = await createLocalAudioTrack();
    try {
      await room.localParticipant.publishTrack(faixa, { source });
      resultado[nome] = 'publicou';
    } catch (e) {
      resultado[nome] = 'recusado: ' + String(e?.message ?? e).slice(0, 60);
    }
  }
  await new Promise((r) => setTimeout(r, 1500));
  await room.disconnect();
  return resultado;
}, { api: API, sala: salaId });
console.log('  console:', JSON.stringify(tentativas));
!Object.values(tentativas).some((v) => v === 'publicou')
  ? ok('pelo console, o LiveKit recusa o microfone travado (como microfone e como som da tela)')
  : falhou('o console publicou a voz travada: ' + JSON.stringify(tentativas));

await browser.close();
resumo('microfone-travado');
