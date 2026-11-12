// AS DUAS VERSÕES DA TRANSMISSÃO E O "RECOMENDAR PARA ESTE COMPUTADOR" (12/11/2026). O que só uma transmissão de verdade prova:
//
// 1. Quem transmite no Padrão manda DUAS versões, 1920×1080 a 5 Mbps e 960×540 a 1,8 (eram três: mais 720p e 360p).
// 2. Quem assiste num quadro pequeno recebe a de 540p inteira, com movimento de jogo.
// 3. O botão das Configurações mede a internet até o servidor e a placa, escolhe o modo e diz o porquê.
//
// A tela é um canvas com movimento de jogo (bolinhas andando sobre um quadriculado com texto), na intensidade em que a
// versão antiga de 360p a 800 kbps se segurava (é a régua de 05/10/2026). Com `MEDIR=1`, o teste também passa a versão de
// baixo por vários tetos e imprime o que sai — foi assim que o 1,8 Mbps foi escolhido.
//
//   node e2e/versoes-da-tela.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

const PREPARO = () => {
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
    const W = 1920, H = 1080;
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const ctx = canvas.getContext('2d');
    const bolas = Array.from({ length: 40 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53) % H, vx: ((i % 7) - 3) * 4, vy: ((i % 5) - 2) * 4, r: 6 + (i % 30), h: (i * 37) % 360 }));
    setInterval(() => {
      for (let y = 0; y < H; y += 60) for (let x = 0; x < W; x += 60) {
        ctx.fillStyle = ((x + y) / 60) % 2 < 1 ? '#2b4' : '#3a5';
        ctx.fillRect(x, y, 60, 60);
      }
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      for (let y = 30; y < H; y += 90) ctx.fillText('PLACAR 1234  VIDA 87  MUNIÇÃO 30/90', 20, y);
      for (const b of bolas) {
        b.x = (b.x + b.vx + W) % W;
        b.y = (b.y + b.vy + H) % H;
        ctx.fillStyle = `hsl(${b.h} 80% 55%)`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, 7);
        ctx.fill();
      }
    }, 1000 / 30);
    return canvas.captureStream(30);
  };
};

async function entrar(nome, viewport) {
  const ctx = await browser.newContext({ viewport, permissions: ['microphone'] });
  const page = vigiar(await ctx.newPage());
  await page.addInitScript(PREPARO);
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

/** As versões que a página de quem transmite pede ao navegador: tamanho (pela escala) e teto. */
const versoes = (page) =>
  page.evaluate(() => {
    for (const pc of window.__conexoes) for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue;
      const largura = sender.track.getSettings().width ?? 1920;
      return sender.getParameters().encodings.map((e) => ({ largura: Math.round(largura / (e.scaleResolutionDownBy ?? 1)), kbps: (e.maxBitrate ?? 0) / 1000 }));
    }
    return [];
  });

/** O que sai na versão de baixo agora: altura, quadros, taxa e o motivo do navegador. */
async function versaoDeBaixo(page) {
  const ler = () =>
    page.evaluate(async () => {
      for (const pc of window.__conexoes) for (const sender of pc.getSenders()) {
        if (sender.track?.kind !== 'video') continue;
        const rid = sender.getParameters().encodings[0]?.rid;
        let achado = null;
        (await sender.getStats()).forEach((e) => {
          if (e.type === 'outbound-rtp' && e.kind === 'video' && (!rid || e.rid === rid)) achado = { altura: e.frameHeight, fps: e.framesPerSecond, motivo: e.qualityLimitationReason, bytes: e.bytesSent };
        });
        if (achado) return { ...achado, quando: performance.now() };
      }
      return null;
    });
  const a = await ler();
  await page.waitForTimeout(3000);
  const b = await ler();
  if (!a || !b) return null;
  return { altura: b.altura, fps: Math.round(b.fps ?? 0), motivo: b.motivo, kbps: Math.round(((b.bytes - a.bytes) * 8) / (b.quando - a.quando)) };
}

try {
  const ana = await entrar('ana' + s, { width: 1400, height: 900 });
  // A Bia assiste num quadro pequeno: o servidor manda a ela a versão de baixo, e só ela fica ligada.
  const bia = await entrar('bia' + s, { width: 760, height: 560 });
  ok('as duas entraram na Sala 2');

  await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await ana.locator('.screenshare-option').first().click();
  await bia.locator('.stream-invite', { hasText: 'ana' + s }).getByRole('button', { name: 'Assistir' }).click();
  await bia.locator('.stage-main video').first().waitFor({ timeout: 20000 });
  ok('a Ana transmite e a Bia assiste');

  const v = await versoes(ana);
  v.length === 2 && v[0].largura === 960 && v[0].kbps === 1800 && v[1].largura === 1920 && v[1].kbps === 5000
    ? ok('o Padrão manda duas versões: 960×540 a 1,8 Mbps e 1920×1080 a 5 Mbps')
    : falhou('as versões do Padrão: ' + JSON.stringify(v));

  await ana.waitForTimeout(10000);
  const baixo = await versaoDeBaixo(ana);
  baixo && baixo.altura === 540 && baixo.fps >= 25
    ? ok(`com movimento de jogo, a de baixo se segura em 540p (${baixo.fps} quadros, ${baixo.kbps} kbps)`)
    : falhou('a versão de baixo: ' + JSON.stringify(baixo));
  const chega = await bia.locator('.stage-main video').first().evaluate((el) => `${el.videoWidth}×${el.videoHeight}`);
  const quadro = await bia.locator('.stage-main video').first().evaluate((el) => `${el.clientWidth}×${el.clientHeight} @${devicePixelRatio}`);
  chega === '960×540' ? ok(`e a Bia recebe 960×540 (num quadro de ${quadro})`) : falhou(`a Bia recebe ${chega} num quadro de ${quadro}`);

  // Num quadro grande, a de 1080p: o tamanho do quadro decide (ver maiorQualidade, em qualidadeQueRecebo.ts).
  await bia.setViewportSize({ width: 1600, height: 1000 });
  const grande = await bia
    .waitForFunction(() => document.querySelector('.stage-main video')?.videoWidth === 1920, null, { timeout: 25000, polling: 500 })
    .then(() => true, () => false);
  const quadroGrande = await bia.locator('.stage-main video').first().evaluate((el) => `${el.clientWidth}×${el.clientHeight} → ${el.videoWidth}×${el.videoHeight}`);
  grande ? ok(`num quadro grande, a Bia passa a receber 1920×1080 (${quadroGrande})`) : falhou('no quadro grande: ' + quadroGrande);

  if (process.env.MEDIR) {
    for (const teto of [2200, 1800, 1500, 1200, 800]) {
      await ana.evaluate(async (t) => {
        for (const pc of window.__conexoes) for (const sender of pc.getSenders()) {
          if (sender.track?.kind !== 'video') continue;
          const p = sender.getParameters();
          p.encodings[0].maxBitrate = t * 1000;
          await sender.setParameters(p);
        }
      }, teto);
      await ana.waitForTimeout(9000);
      console.log(`  teto ${teto} kbps →`, JSON.stringify(await versaoDeBaixo(ana)));
    }
  }

  // O botão: mede e escolhe. Contra a API local a internet "sobra"; o modo escolhido depende da placa desta máquina.
  await ana.locator('button[aria-label="Configurações"]').first().click();
  await ana.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
  const botao = ana.getByRole('button', { name: 'Recomendar para este computador' });
  await botao.scrollIntoViewIfNeeded();
  await botao.click();
  const status = ana.locator('.recomendar-modo [role="status"]');
  await status.filter({ hasText: /Recomendado: (Padrão|Fluido)\./ }).waitFor({ timeout: 30000 });
  const texto = (await status.textContent()) ?? '';
  ok('o botão recomenda: ' + texto.trim());
  const escolhido = await ana.locator('.quality-option.selected .quality-title').textContent();
  texto.includes(`Recomendado: ${escolhido}.`) ? ok(`e já deixa o "${escolhido}" escolhido`) : falhou(`recomendou "${texto}", mas está escolhido "${escolhido}"`);
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('as duas versões da transmissão e a recomendação de modo');
}
