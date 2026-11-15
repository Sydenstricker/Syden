// O MUDO DA LIVE E A PAUSA DO VÍDEO, NO APP (15/11/2026, relatos de quem usa: "o mute das lives voltou a dar problema" e
// "dependendo do app, em tela cheia, só trava o vídeo"). A pausa da 0.1.10 (desktop/src/a-vista.js) desinscreve o vídeo da
// tela quando o app sai da vista e o reinscreve na volta; o mudo da live nunca tinha sido conferido junto com ela.
//
// A Ana transmite pelo Chrome dos testes (tela falsa com um tom de 440 Hz); a Bia assiste pelo APP e cala a live. Então:
// 1. minimizar e restaurar; 2. cobrir com uma janela em tela cheia de outro programa e descobrir; 3. uma janela
// TRANSPARENTE em tela cheia de outro programa na frente (como a sobreposição de um gravador ou do Game Bar): o Syden
// continua à vista atrás dela. Em cada passo: o vídeo chega? o som da live continua calado?
//
//   node e2e/mudo-e-pausa-no-app.mjs   (LiveKit, API de teste na 3099 e site na 5174)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron } from 'playwright-core';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const ELECTRON = path.resolve('node_modules/electron/dist/electron.exe');
const SITE_DO_APP = process.env.SITE_DO_APP ?? 'http://localhost:5174/app/';
const s = Date.now().toString().slice(-5);

const GUARDAR_CONEXOES = () => {
  window.__conexoes = [];
  const Original = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...args) {
    const pc = new Original(...args);
    window.__conexoes.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = Original.prototype;
  Object.setPrototypeOf(window.RTCPeerConnection, Original);
};
/** A tela falsa: um canvas que mexe e um tom de 440 Hz, para a transmissão ter faixa de som. */
const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      n++;
      ctx.fillStyle = `hsl(${(n * 7) % 360} 60% 40%)`;
      ctx.fillRect(0, 0, 1280, 720);
    }, 1000 / 15);
    const stream = canvas.captureStream(15);
    const a = new AudioContext(), osc = a.createOscillator(), destino = a.createMediaStreamDestination(), g = a.createGain();
    g.gain.value = 0.2;
    osc.connect(g).connect(destino);
    osc.start();
    stream.addTrack(destino.stream.getAudioTracks()[0]);
    return stream;
  };
};

async function chegando(pagina, ms = 3000) {
  const ler = () =>
    pagina.evaluate(async () => {
      const soma = { video: 0, audio: 0 };
      for (const pc of window.__conexoes ?? []) {
        if (pc.connectionState === 'closed') continue;
        (await pc.getStats()).forEach((e) => {
          if (e.type === 'inbound-rtp' && (e.kind === 'video' || e.kind === 'audio')) soma[e.kind] += e.bytesReceived ?? 0;
        });
      }
      return soma;
    });
  const a = await ler();
  await pagina.waitForTimeout(ms);
  const b = await ler();
  return { video: Math.round(((b.video - a.video) * 8) / ms), audio: Math.round(((b.audio - a.audio) * 8) / ms) };
}
const kbps = (c) => `vídeo ${c.video} kbps, som ${c.audio} kbps`;

/** Os <audio> vivos da página: a marca, o volume e o mudo. */
const audios = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('audio')]
      .map((el) => {
        const faixa = el.srcObject instanceof MediaStream ? el.srcObject.getAudioTracks()[0] : null;
        if (!faixa || faixa.readyState !== 'live') return null;
        el.__visto ??= Math.random().toString(36).slice(2, 8);
        return { elemento: el.__visto, volume: el.volume, muted: el.muted, paused: el.paused };
      })
      .filter(Boolean),
  );

/** Uma janela de outro programa (aberta pelo app, para vir à frente): 'cheia', 'pequena' ou 'transparente' (tela cheia). */
async function janelaDeOutroPrograma(tipo) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'syden-capa-'));
  fs.writeFileSync(path.join(pasta, 'package.json'), '{"name":"capa","main":"main.js"}');
  const opcoes =
    tipo === 'transparente'
      ? `{ fullscreen: true, transparent: true, frame: false, backgroundColor: '#00000000', alwaysOnTop: true }`
      : tipo === 'cheia'
        ? `{ fullscreen: true, backgroundColor: '#303030' }`
        : `{ width: 400, height: 260, x: 40, y: 40, backgroundColor: '#303030' }`;
  const corpo = tipo === 'transparente' ? 'data:text/html,<body style="background:transparent"><p style="color:%23fff;font:20px sans-serif;margin:20px">sobreposição</p></body>' : 'data:text/html,<body style="background:%23333"></body>';
  fs.writeFileSync(
    path.join(pasta, 'main.js'),
    `const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => { const w = new BrowserWindow(${opcoes}); ${tipo === 'transparente' ? 'w.setIgnoreMouseEvents(true);' : ''} w.loadURL('${corpo}'); w.focus(); });`,
  );
  const pid = await app.evaluate((_e, [exe, dir]) => {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.SYDEN_URL;
    return process.mainModule.require('node:child_process').spawn(exe, [dir], { env, stdio: 'ignore' }).pid;
  }, [ELECTRON, pasta]);
  return () => { try { process.kill(pid); } catch { /* já fechou */ } };
}

const env = { ...process.env, SYDEN_URL: SITE_DO_APP, SYDEN_PASTA_DE_DADOS: fs.mkdtempSync(path.join(os.tmpdir(), 'syden-app-teste-')) };
delete env.ELECTRON_RUN_AS_NODE;

let app = null, browser = null;
const fechar = [];
try {
  ({ browser } = await abrirNavegador({ permissoes: ['microphone'] }));
  const ctxAna = await browser.newContext({ viewport: { width: 1300, height: 850 }, permissions: ['microphone'] });
  const ana = vigiar(await ctxAna.newPage());
  await ana.addInitScript(TELA_FALSA);
  await cadastrar(ana, 'ana' + s);
  await dispensarPresentes(ana);
  await ana.locator('.rail-list .rail-item').first().click();
  await ana.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await ana.locator('.stage-controls').waitFor({ timeout: 30000 });

  app = await _electron.launch({
    executablePath: ELECTRON,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', path.resolve('desktop')],
    env,
  });
  await app.context().addInitScript(GUARDAR_CONEXOES);
  const bia = vigiar(await app.firstWindow());
  await bia.waitForLoadState('domcontentloaded');
  await bia.reload();
  await cadastrar(bia, 'bia' + s);
  await dispensarPresentes(bia);
  await bia.locator('.rail-list .rail-item').first().click();
  await bia.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await bia.locator('.stage-controls').waitFor({ timeout: 30000 });
  await bia.waitForTimeout(2000);
  const daVoz = new Set((await audios(bia)).map((a) => a.elemento)); // a voz da Ana, antes da transmissão

  await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await ana.locator('.screenshare-option').first().click();
  await bia.locator('.stream-invite', { hasText: 'ana' + s }).getByRole('button', { name: 'Assistir' }).click();
  await bia.locator('.stage-main video').first().waitFor({ timeout: 20000 });
  await bia.waitForTimeout(3000);
  const janela = (acao) => app.evaluate(({ BrowserWindow }, a) => {
    const w = BrowserWindow.getAllWindows()[0];
    if (a === 'minimizar') w.minimize();
    else if (a === 'restaurar') w.restore();
    w.focus?.();
  }, acao);
  await janela('restaurar');

  // cala a live
  const quadro = bia.locator('.stage-main', { has: bia.locator('.stream-controls') }).first();
  await quadro.hover();
  await quadro.locator('.stream-audio > button.stream-info-button').click();
  await bia.waitForTimeout(600);
  const daLive = async () => (await audios(bia)).filter((a) => !daVoz.has(a.elemento));
  const calada = async (oque) => {
    const live = await daLive();
    const botao = await quadro.locator('.stream-audio > button.stream-info-button').getAttribute('aria-pressed').catch(() => '?');
    const tocando = live.filter((a) => a.volume > 0 && !a.muted && !a.paused);
    console.log(`   ${oque}: <audio> da live ${JSON.stringify(live)} · botão aria-pressed ${botao}`);
    live.length && !tocando.length ? ok(`${oque}: a live continua calada`) : falhou(`${oque}: a live ${live.length ? 'VOLTOU A TOCAR' : 'sem <audio>'} (${JSON.stringify(live)})`);
  };
  await calada('calada à vista');

  // 1. minimizar e restaurar
  await janela('minimizar');
  await bia.waitForTimeout(3000);
  const min = await chegando(bia);
  console.log(`   minimizado: ${kbps(min)}`);
  await janela('restaurar');
  await bia.waitForTimeout(4000);
  const rest = await chegando(bia);
  rest.video > 100 ? ok(`restaurado, o vídeo volta (${kbps(rest)})`) : falhou(`restaurado, o vídeo NÃO volta: ${kbps(rest)}`);
  await calada('minimizar e restaurar');

  // 2. coberto e descoberto
  let tirar = await janelaDeOutroPrograma('cheia');
  fechar.push(tirar);
  await bia.waitForTimeout(5000);
  console.log(`   coberto: ${kbps(await chegando(bia))}`);
  tirar();
  await bia.waitForTimeout(5000);
  const desc = await chegando(bia);
  desc.video > 100 ? ok(`descoberto, o vídeo volta (${kbps(desc)})`) : falhou(`descoberto, o vídeo NÃO volta: ${kbps(desc)}`);
  await calada('coberto e descoberto');

  // 3. a sobreposição transparente em tela cheia
  tirar = await janelaDeOutroPrograma('transparente');
  fechar.push(tirar);
  await bia.waitForTimeout(5000);
  const sob = await chegando(bia);
  sob.video > 100
    ? ok(`com uma sobreposição transparente na frente, o vídeo continua (${kbps(sob)})`)
    : falhou(`com uma sobreposição transparente na frente (o Syden à vista atrás dela), o vídeo PAROU: ${kbps(sob)}`);
  tirar();
  await bia.waitForTimeout(4000);
  await calada('depois da sobreposição');
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  for (const f of fechar) f();
  await app?.close().catch(() => {});
  await browser?.close().catch(() => {});
}
resumo('mudo-e-pausa-no-app');
