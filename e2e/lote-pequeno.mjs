// O LOTE PEQUENO DA AUDITORIA DE DESEMPENHO (15/11/2026), numa chamada de verdade (o LiveKit local e duas pessoas):
//
// - O PING aparece no painel de voz (o número mora fora do useVoice: ping.ts).
// - NO MUDO, o aviso "Você está silenciado!" aparece quando a Ana fala, SEM abrir um segundo microfone (getUserMedia contado).
// - Os CONTEXTOS DE ÁUDIO dos sons da interface dormem 10 s depois do último som (os construídos em sounds.ts, achados pela
//   pilha de quem os criou).
// - As cenas do mascote têm a versão parada.
//
//   node e2e/lote-pequeno.mjs   (API de teste na 3099, site na 5174 em desenvolvimento, LiveKit local)
import { join } from 'node:path';
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
const conferir = (certo, oque) => (certo ? ok(oque) : falhou(oque));

const ana = await conta('ana' + sufixo), bia = await conta('bia' + sufixo);
const comunidade = await pedir('POST', '/api/communities', ana, { name: 'Lote ' + sufixo });
await pedir('POST', '/api/communities/join', bia, { code: comunidade.inviteCode });
const nomeDaSala = 'lote-' + sufixo;
await pedir('POST', `/api/communities/${comunidade.id}/channels`, ana, { name: nomeDaSala, type: 'voice' });

// o microfone falso toca uma canção (variada: a supressão do navegador não a apaga como apagaria um tom parado)
const canção = join(import.meta.dirname, '..', 'web', 'test', 'amostras', 'hoje-e-seu-dia.wav').replaceAll('\\', '/');
const { browser } = await abrirNavegador({ permissoes: ['microphone'], audioFalso: canção });

// em cada página: conta os getUserMedia de áudio e guarda cada AudioContext com a pilha de quem o criou
const SONDA = () => {
  window.__gum = 0;
  const md = navigator.mediaDevices, original = md.getUserMedia.bind(md);
  md.getUserMedia = (c) => { if (c?.audio) window.__gum++; return original(c); };
  window.__ctx = [];
  const AC = window.AudioContext;
  window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ctx.push({ ctx: this, pilha: new Error().stack || '' }); } };
};

async function abrir(token) {
  const page = await novaPessoa(browser, { permissoes: ['microphone'] });
  await page.addInitScript(SONDA);
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
  await page.locator('.channel-name', { hasText: nomeDaSala }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

try {
  const A = await abrir(ana);
  const B = await abrir(bia);
  await A.waitForTimeout(3000);

  // ---- o ping, fora do useVoice ----
  const ping = A.locator('.voice-ping');
  await ping.waitFor({ timeout: 15000 }).catch(() => {});
  conferir(/\d+ ms/.test((await ping.textContent().catch(() => '')) ?? ''), `o ping aparece no painel de voz (${await ping.textContent().catch(() => '?')})`);

  // ---- o mudo: o aviso, sem segundo microfone ----
  const gumAntes = await A.evaluate(() => window.__gum);
  await A.locator('.stage-controls').getByRole('button', { name: 'Silenciar' }).click();
  const aviso = A.getByText('Você está silenciado!');
  const apareceu = await aviso.waitFor({ timeout: 15000 }).then(() => true, () => false);
  conferir(apareceu, 'no mudo, falando, aparece "Você está silenciado!"');
  const gumDepois = await A.evaluate(() => window.__gum);
  conferir(gumDepois === gumAntes, `o aviso não abriu um segundo microfone (getUserMedia de áudio: ${gumAntes} → ${gumDepois})`);
  await A.locator('.stage-controls').getByRole('button', { name: 'Ativar microfone' }).click();

  // ---- os contextos de áudio dos sons: dormem 10 s depois do último ----
  await A.waitForTimeout(13000);
  const contextos = await A.evaluate(() => window.__ctx.map(({ ctx, pilha }) => ({ estado: ctx.state, taxa: ctx.sampleRate, de: (pilha.split('\n').find((l) => /\/src\/(?!.*node_modules)/.test(l) && !/AudioContext|lote/.test(l)) || '').replace(/^.*\/src\//, '').replace(/\?.*$/, '').trim() })));
  console.log('   contextos de áudio da Ana:', contextos);
  const dosSons = contextos.filter((c) => /^(sounds|somDosJogos|soundboard)\.ts/.test(c.de));
  if (!dosSons.length) console.log('   (nenhum som da interface tocou: a conferência do sono não se aplica)');
  else conferir(dosSons.every((c) => c.estado === 'suspended'), `os contextos dos sons da interface dormem (${dosSons.map((c) => c.de + ': ' + c.estado).join(', ')})`);

  // ---- o mascote parado ----
  for (const nome of ['ocioso', 'assistir-junto', 'apresentacao']) {
    const r = await fetch(`http://localhost:5174/app/mascote/${nome}-parado.svg`);
    const texto = r.ok ? await r.text() : '';
    conferir(r.ok && texto.includes('* { animation: none !important; }'), `a cena "${nome}" tem a versão parada`);
  }
  void B;
} finally {
  await browser.close();
}
resumo('lote-pequeno');
