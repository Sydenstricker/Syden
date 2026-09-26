// Item 14 + 3: transmissão de tela só é baixada por quem abriu, e a tela sai em camadas.
//
// Duas pessoas de verdade na mesma sala de voz. A ana transmite (um canvas, NUNCA a tela real do usuário);
// a bia mede, pelo próprio navegador, quantos bytes de vídeo entraram. O teste pergunta três coisas:
//   1. antes de abrir, a bia recebe ~zero (antes desta mudança ela baixava tudo sozinha);
//   2. depois de clicar em "Assistir", o vídeo entra de verdade;
//   3. ao fechar, para de entrar.
// E confere as camadas (simulcast) do lado da ana: sem camadas, quem vê numa miniatura baixa 1080p.

import { CONVITE, SITE, abrirNavegador, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

/** Guarda as conexões WebRTC da página, para depois perguntar ao navegador quantos bytes entraram/saíram. */
const ESPIAO = () => {
  const Original = window.RTCPeerConnection;
  window.__pcs = [];
  window.RTCPeerConnection = class extends Original {
    constructor(...args) {
      super(...args);
      window.__pcs.push(this);
    }
  };
};

/** No lugar da tela real: um canvas que mexe (como um jogo) mais um tom, para haver faixa de som também. */
const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      n++;
      ctx.fillStyle = `hsl(${n % 360} 60% 25%)`;
      ctx.fillRect(0, 0, 1920, 1080);
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `hsl(${(n * 7 + i * 11) % 360} 80% 60%)`;
        ctx.fillRect((n * 17 + i * 151) % 1880, (i * 97 + n * 5) % 1040, 120, 80);
      }
    }, 1000 / 30);
    const stream = canvas.captureStream(30);
    const ctxAudio = new AudioContext();
    const osc = ctxAudio.createOscillator();
    const destino = ctxAudio.createMediaStreamDestination();
    const ganho = ctxAudio.createGain();
    ganho.gain.value = 0.05;
    osc.connect(ganho).connect(destino);
    osc.start();
    stream.addTrack(destino.stream.getAudioTracks()[0]);
    return stream;
  };
};

async function entrar(nome, { abrirSozinha = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  vigiar(page);
    await page.addInitScript(ESPIAO);
  await page.addInitScript(TELA_FALSA);
  if (abrirSozinha) {
    await page.addInitScript(() => {
      localStorage.setItem('janja.settings', JSON.stringify({ abrirTransmissaoSozinha: true }));
    });
  }
  await page.goto(SITE);
  await page.getByText('Cadastre-se').click();
  await page.getByLabel('Nome de usuário').fill(nome);
  await page.getByLabel('Senha').fill('segredo123');
  await page.getByLabel('Código de convite').fill(CONVITE);
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await page.locator('.vila').waitFor({ timeout: 30000 });
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

/** Bytes de vídeo que ENTRARAM nesta página, somando todas as conexões. */
const bytesDeVideoRecebidos = (page) =>
  page.evaluate(async () => {
    let bytes = 0;
    let quadros = 0;
    for (const pc of window.__pcs ?? []) {
      const rel = await pc.getStats();
      rel.forEach((e) => {
        if (e.type === 'inbound-rtp' && e.kind === 'video') {
          bytes += e.bytesReceived ?? 0;
          quadros += e.framesDecoded ?? 0;
        }
      });
    }
    return { bytes, quadros };
  });

async function medir(page, segundos, titulo) {
  const antes = await bytesDeVideoRecebidos(page);
  await page.waitForTimeout(segundos * 1000);
  const depois = await bytesDeVideoRecebidos(page);
  const kbps = ((depois.bytes - antes.bytes) * 8) / segundos / 1000;
  const quadros = depois.quadros - antes.quadros;
  console.log(`  ${titulo}: ${kbps.toFixed(0)} kbps · ${quadros} quadros decodificados em ${segundos}s`);
  return { kbps, quadros };
}

const ana = await entrar('ana' + s);
const bia = await entrar('bia' + s);
ok('as duas entraram na mesma sala de voz');

// ---------- ana transmite ----------
await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
await ana.locator('.screenshare-option').first().click();
await ana.locator('.stage-main video').first().waitFor({ timeout: 20000 });
ok('ana está transmitindo');

// ---------- a bia vê o convite, e nada mais ----------
await bia.locator('.stream-invite', { hasText: 'ana' + s }).waitFor({ timeout: 20000 });
const convite = (await bia.locator('.stream-invite', { hasText: 'ana' + s }).innerText()).replace(/\n/g, ' | ');
console.log('  a bia vê:', JSON.stringify(convite));
convite.includes('ana' + s) ? ok('o convite diz quem está transmitindo') : falhou('o convite não diz quem é');
(await bia.locator('.stage-main').count()) === 0
  ? ok('a transmissão não abriu sozinha na tela da bia')
  : falhou('a transmissão abriu sozinha');

const fechada = await medir(bia, 6, 'com o convite fechado');
fechada.kbps < 50 ? ok('e não está baixando a transmissão') : falhou(`baixando ${fechada.kbps.toFixed(0)} kbps sem ter aberto`);

// ---------- a bia abre ----------
await bia.locator('.stream-invite', { hasText: 'ana' + s }).getByRole('button', { name: 'Assistir' }).click();
await bia.locator('.stage-main video').first().waitFor({ timeout: 20000 });
ok('a bia abriu a transmissão');
const aberta = await medir(bia, 6, 'com a transmissão aberta');
aberta.kbps > 200 && aberta.quadros > 30
  ? ok('agora o vídeo está chegando de verdade')
  : falhou(`vídeo fraco demais: ${aberta.kbps.toFixed(0)} kbps, ${aberta.quadros} quadros`);

// O som da transmissão também acompanha a escolha.
const somRecebido = await bia.evaluate(async () => {
  let bytes = 0;
  for (const pc of window.__pcs ?? []) {
    const rel = await pc.getStats();
    rel.forEach((e) => {
      if (e.type === 'inbound-rtp' && e.kind === 'audio') bytes += e.bytesReceived ?? 0;
    });
  }
  return bytes;
});
console.log(`  som recebido (voz + transmissão): ${(somRecebido / 1024).toFixed(0)} KB`);

// ---------- e fecha ----------
await bia.locator('button[aria-label="Parar de assistir esta transmissão"]').click();
await bia.locator('.stream-invite', { hasText: 'ana' + s }).waitFor({ timeout: 10000 });
ok('a bia fechou e voltou ao convite');
// Só medir depois de assentar: ao cancelar a assinatura, a entrada de estatística daquela faixa desaparece,
// e um par de leituras em cima da troca daria número negativo (o "depois" com menos faixas que o "antes").
await bia.waitForTimeout(3000);
const depoisDeFechar = await medir(bia, 6, 'depois de fechar');
depoisDeFechar.kbps < 50 ? ok('e parou de baixar') : falhou(`continua baixando ${depoisDeFechar.kbps.toFixed(0)} kbps`);

// ---------- e do lado de quem TRANSMITE: sem ninguém olhando, para de codificar ----------
// É o outro lado da moeda, e o que mais interessa para os 57% de processador: o LiveKit (dynacast) desliga
// as camadas que ninguém pediu, então transmitir para uma sala onde ninguém abriu não custa quase nada.
const enviando = async () =>
  ana.evaluate(async () => {
    let bytes = 0;
    let tempo = 0;
    let quadros = 0;
    for (const pc of window.__pcs ?? []) {
      const rel = await pc.getStats();
      rel.forEach((e) => {
        if (e.type === 'outbound-rtp' && e.kind === 'video') {
          bytes += e.bytesSent ?? 0;
          tempo += e.totalEncodeTime ?? 0;
          quadros += e.framesEncoded ?? 0;
        }
      });
    }
    return { bytes, tempo, quadros };
  });
const envioAntes = await enviando();
await ana.waitForTimeout(6000);
const envioDepois = await enviando();
const envioKbps = ((envioDepois.bytes - envioAntes.bytes) * 8) / 6 / 1000;
const envioQuadros = envioDepois.quadros - envioAntes.quadros;
const envioCpu = ((envioDepois.tempo - envioAntes.tempo) / 6) * 100;
console.log(`  ana transmitindo para ninguém: ${envioKbps.toFixed(0)} kbps · ${envioQuadros} quadros codificados · ${envioCpu.toFixed(0)}% de um núcleo`);
envioKbps < 100
  ? ok('sem ninguém olhando, quem transmite também para de gastar')
  : falhou(`continua enviando ${envioKbps.toFixed(0)} kbps para ninguém`);

// ---------- as camadas da transmissão, do lado de quem envia ----------
const camadas = await ana.evaluate(async () => {
  for (const pc of window.__pcs ?? []) {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue;
      const p = sender.getParameters();
      if (!p.encodings || p.encodings.length === 0) continue;
      const rel = await pc.getStats();
      const ativas = [];
      rel.forEach((e) => {
        if (e.type === 'outbound-rtp' && e.kind === 'video') {
          ativas.push({ rid: e.rid ?? '(única)', largura: e.frameWidth ?? null, ativo: e.active ?? null, kbps: null });
        }
      });
      return {
        encodings: p.encodings.map((e) => ({ rid: e.rid, escala: e.scaleResolutionDownBy, kbps: e.maxBitrate ? e.maxBitrate / 1000 : null, ativo: e.active })),
        ativas,
      };
    }
  }
  return null;
});
console.log('  camadas declaradas:', JSON.stringify(camadas?.encodings));
console.log('  camadas no ar:', JSON.stringify(camadas?.ativas));
(camadas?.encodings?.length ?? 0) >= 2
  ? ok(`a tela sai em ${camadas.encodings.length} camadas`)
  : falhou('a tela está saindo numa camada só');

// ---------- quem prefere abrir sozinho continua podendo ----------
const cid = await entrar('cid' + s, { abrirSozinha: true });
const abriuSozinha = await cid
  .locator('.stage-main video')
  .first()
  .waitFor({ timeout: 20000 })
  .then(() => true)
  .catch(() => false);
abriuSozinha
  ? ok('com "abrir sozinha" ligado, a transmissão que já estava no ar abriu sozinha')
  : falhou('a opção "abrir sozinha" não abriu a transmissão');

// ---------- o antes e o depois, medidos ao mesmo tempo ----------
// A cid está com "abrir sozinha" ligado: é exatamente o comportamento antigo do Syden. A bia está com o
// convite fechado: é o novo. Mesma sala, mesma transmissão, mesmos seis segundos.
const [antigo, novo] = await Promise.all([medir(cid, 6, 'jeito antigo (abre sozinha)'), medir(bia, 6, 'jeito novo (convite fechado)')]);
console.log(`  economia por pessoa que não está olhando: ${(antigo.kbps - novo.kbps).toFixed(0)} kbps e ${antigo.quadros - novo.quadros} quadros para decodificar`);
antigo.kbps > 200 && novo.kbps < 50
  ? ok('quem não abriu não gasta nada; quem abriu gasta o mesmo de antes')
  : falhou(`comparação estranha: antigo ${antigo.kbps.toFixed(0)} kbps, novo ${novo.kbps.toFixed(0)} kbps`);

await bia.screenshot({ path: 'e2e/fotos/convite-transmissao.png' });
await browser.close();
resumo('sob-demanda');
