// O SOM DA TELA NO NAVEGADOR (16/11/2026). Relato: a turma assistindo à gravação do Mundial de LoL, "o áudio parecia
// walkie-talkie". O som da aba era publicado com os padrões do microfone: DTX ligado (o Opus para de mandar no que acha que
// é silêncio) e 48 kbps mono. Aqui uma pessoa transmite uma "aba" com som (um oscilador no lugar do getDisplayMedia) e o
// teste lê, na conexão de verdade, como a faixa de som da tela saiu: a taxa máxima, o estéreo e o DTX da negociação.
//
//   API de teste na 3099, site na 5174 e LiveKit local (npm run dev:livekit)
//   node e2e/som-da-tela.mjs
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const TELA_COM_SOM = () => {
  window.__conexoes = [];
  const Original = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...args) {
    const pc = new Original(...args);
    window.__conexoes.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = Original.prototype;
  Object.setPrototypeOf(window.RTCPeerConnection, Original);
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      ctx.fillStyle = `hsl(${n++ % 360} 60% 50%)`;
      ctx.fillRect(0, 0, 1280, 720);
    }, 33);
    const video = canvas.captureStream(30).getVideoTracks()[0];
    const ac = new AudioContext();
    const osc = ac.createOscillator();
    const destino = ac.createMediaStreamDestination();
    destino.channelCount = 2;
    osc.connect(destino);
    osc.start();
    const audio = destino.stream.getAudioTracks()[0];
    window.__somDaTela = audio.id;
    video.getSettings = () => ({ ...MediaStreamTrack.prototype.getSettings.call(video), displaySurface: 'browser' });
    return new MediaStream([video, audio]);
  };
};

const { browser } = await abrirNavegador();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
const page = vigiar(await ctx.newPage());
await page.addInitScript(TELA_COM_SOM);
await criarConta(page, 'som');
await dispensarPresentes(page);
await page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await page.getByText('Criar a minha').click();
await page.getByLabel('Nome da comunidade').fill('Som ' + Date.now().toString().slice(-5));
await page.locator('.dialog .btn-primary').click();
await page.locator('.channel-list').waitFor({ timeout: 20000 });
await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
await page.locator('.stage-controls').waitFor({ timeout: 30000 });
await page.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
await page.locator('.screenshare-option').last().click();
await page.locator('.stage-main video').first().waitFor({ timeout: 25000 });
await page.waitForTimeout(3000);

const saida = await page.evaluate(() => {
  for (const pc of window.__conexoes) {
    for (const t of pc.getTransceivers()) {
      const faixa = t.sender.track;
      if (!faixa || faixa.kind !== 'audio' || !window.__somDaTela || faixa.id !== window.__somDaTela) continue;
      // o DTX do Opus vem na RESPOSTA do servidor (o LiveKit marca usedtx por faixa): as duas descrições contam
      const fmtpDe = (sdp) => {
        const bloco = (sdp ?? '').split('\r\nm=').find((m) => m.includes('a=mid:' + t.mid + '\r\n')) ?? '';
        const opus = /a=rtpmap:(\d+) opus/i.exec(bloco)?.[1];
        return opus ? (new RegExp('a=fmtp:' + opus + ' ([^\\r]*)').exec(bloco)?.[1] ?? '') : '';
      };
      const fmtp = fmtpDe(pc.localDescription?.sdp) + ' / ' + fmtpDe(pc.remoteDescription?.sdp);
      return { maxBitrate: t.sender.getParameters().encodings?.[0]?.maxBitrate, fmtp };
    }
  }
  return null;
});
console.log('  a faixa de som da tela: ' + JSON.stringify(saida));
if (!saida) falhou('não achei a faixa de som da tela');
else {
  saida.maxBitrate >= 128_000 ? ok(`taxa de música: ${saida.maxBitrate / 1000} kbps`) : falhou(`taxa de voz: ${saida.maxBitrate} bps`);
  !/usedtx=1/.test(saida.fmtp) ? ok('sem DTX (o som não corta no que parece silêncio)') : falhou('DTX ligado no som da tela: ' + saida.fmtp);
  /stereo=1/.test(saida.fmtp) ? ok('em estéreo') : falhou('em mono: ' + saida.fmtp);
}
await browser.close();
resumo('o som da tela no navegador');
