// A TRANSMISSÃO PERSONALIZADA (16/11/2026; ver web/src/telaPersonalizada.ts). Uma pessoa escolhe o modo Personalizado nas
// Configurações (HD a 15 quadros, depois a Nativa a 60), transmite uma "tela" (um canvas no lugar do getDisplayMedia) e o teste
// lê, na conexão de verdade, o que foi pedido ao codificador: o tamanho, os quadros, a taxa, o desempate e as versões. E confere
// que o Syden não mexe em nada durante a transmissão, mesmo com o aperto simulado que no Padrão o faria encolher.
//
//   API de teste na 3099, site na 5174 e LiveKit local (npm run dev:livekit)
//   node e2e/tela-personalizada.mjs
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const TELA = () => {
  window.__conexoes = [];
  const Original = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...args) {
    const pc = new Original(...args);
    window.__conexoes.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = Original.prototype;
  Object.setPrototypeOf(window.RTCPeerConnection, Original);
  navigator.mediaDevices.getDisplayMedia = async (opcoes) => {
    // a "tela" respeita o tamanho pedido, como o navegador faz com a tela de verdade
    const pedido = opcoes?.video ?? {};
    const w = pedido.width?.ideal ?? pedido.width ?? 1920;
    const h = pedido.height?.ideal ?? pedido.height ?? 1080;
    window.__pedidoDaCaptura = { w, h, fps: pedido.frameRate?.ideal ?? pedido.frameRate };
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(w, 2560);
    canvas.height = Math.min(h, 1440);
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      ctx.fillStyle = `hsl(${n++ % 360} 60% 50%)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 16);
    return canvas.captureStream(60);
  };
};

const { browser } = await abrirNavegador();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
const page = vigiar(await ctx.newPage());
await page.addInitScript(TELA);
await criarConta(page, 'tela');
await dispensarPresentes(page);
await page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await page.getByText('Criar a minha').click();
await page.getByLabel('Nome da comunidade').fill('Tela ' + Date.now().toString().slice(-5));
await page.locator('.dialog .btn-primary').click();
await page.locator('.channel-list').waitFor({ timeout: 20000 });

async function escolher(resolucao, quadros) {
  await page.locator('button[aria-label="Configurações"]').first().click();
  await page.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
  await page.locator('.quality-option', { hasText: 'Personalizado' }).click();
  await page.locator('.tela-personalizada .chip-opcao', { hasText: new RegExp('^' + resolucao + '$') }).click();
  await page.locator('.tela-personalizada .chip-opcao', { hasText: new RegExp('^' + quadros + '$') }).click();
  await page.keyboard.press('Escape');
}

const lerEnvio = () =>
  page.evaluate(() => {
    for (const pc of window.__conexoes)
      for (const s of pc.getSenders()) {
        if (s.track?.kind !== 'video') continue;
        const p = s.getParameters();
        return {
          preferencia: p.degradationPreference,
          versoes: p.encodings.map((e) => ({ fps: e.maxFramerate, kbps: e.maxBitrate / 1000, reducao: e.scaleResolutionDownBy })),
          captura: s.track.getSettings(),
          dica: s.track.contentHint,
        };
      }
    return null;
  });

async function transmitir() {
  if (!(await page.locator('.stage-controls').isVisible())) await entrarNaSala();
  await page.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await page.locator('.screenshare-option').first().click();
  await page.locator('.stage-main video').first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(2500);
}
async function parar() {
  await page.locator('.stage-controls button[aria-label="Opções da transmissão"]').click();
  await page.getByRole('menuitem', { name: 'Parar de compartilhar' }).click();
  await page.waitForTimeout(1500);
}

// entrar na sala, com uma segunda tentativa (o site de desenvolvimento recarrega sozinho quando um arquivo muda)
async function entrarNaSala() {
  for (let i = 0; i < 3; i++) {
    await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    if (await page.locator('.stage-controls').waitFor({ timeout: 15000 }).then(() => true, () => false)) return;
  }
  throw new Error('não entrou na sala');
}
await entrarNaSala();

// ---------- HD a 15: coisa calma, segura a nitidez, sem a versão menor ----------
await escolher('HD · 720p', 15);
await transmitir();
const hd = await lerEnvio();
console.log('  HD a 15: ' + JSON.stringify(hd));
const maiorHd = hd.versoes[hd.versoes.length - 1];
maiorHd.fps === 15 && maiorHd.kbps === 1500 ? ok('HD a 15: o codificador recebeu 15 quadros e 1,5 Mbps') : falhou('HD a 15: ' + JSON.stringify(maiorHd));
hd.versoes.length === 1 ? ok('e sem a versão menor (HD já é pequena)') : falhou(`${hd.versoes.length} versões`);
hd.preferencia === 'maintain-resolution' && hd.dica === 'detail' ? ok('e segura a nitidez sob aperto') : falhou(`desempate: ${hd.preferencia} / ${hd.dica}`);
hd.captura.height <= 720 ? ok(`a captura pediu ${hd.captura.width}×${hd.captura.height}`) : falhou(`a captura veio em ${hd.captura.height}p`);

// o aperto simulado do teste do leve (só no site de desenvolvimento): no Padrão isso o levaria ao leve; aqui, nada muda
await page.evaluate(() => (window.apertoDeTeste = 'cpu'));
await page.waitForTimeout(9000);
const depois = await lerEnvio();
JSON.stringify(depois.versoes) === JSON.stringify(hd.versoes) && depois.preferencia === hd.preferencia
  ? ok('com o processador apertado por 9 s, o Syden não mudou nada')
  : falhou('o Syden mexeu: ' + JSON.stringify(depois));
await page.evaluate(() => (window.apertoDeTeste = undefined));
await parar();

// ---------- Full HD a 60: jogo, segura os quadros, com a versão menor a 30 ----------
await escolher('Full HD · 1080p', 60);
await transmitir();
const fhd = await lerEnvio();
console.log('  Full HD a 60: ' + JSON.stringify(fhd));
const maior = fhd.versoes[fhd.versoes.length - 1];
maior.fps === 60 && maior.kbps === 8000 ? ok('Full HD a 60: 60 quadros e 8 Mbps') : falhou('Full HD a 60: ' + JSON.stringify(maior));
fhd.versoes.length === 2 && fhd.versoes[0].fps === 30 ? ok('com a versão menor a 30 para quem tem internet fraca') : falhou('versões: ' + JSON.stringify(fhd.versoes));
fhd.preferencia === 'maintain-framerate' ? ok('e segura os quadros sob aperto') : falhou('desempate: ' + fhd.preferencia);
await parar();

await page.screenshot({ path: 'e2e/fotos/tela-personalizada.png' });
await browser.close();
resumo('a transmissão personalizada');
