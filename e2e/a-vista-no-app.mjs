// O APP PAUSA O VÍDEO QUANDO NINGUÉM O VÊ (14/11/2026; desktop/src/a-vista.js). No app, o Electron nunca deixa a página
// "escondida" (o freio de segundo plano desligado), então o vídeo da chamada seguia baixado e decodificado com o app
// minimizado ou atrás de um jogo em tela cheia. Aqui, de ponta a ponta:
//
// 1. A Bia assiste à transmissão da Ana pelo APP: vídeo e som chegando.
// 2. Minimizado: o vídeo para de chegar; o som continua. Restaurado, o vídeo volta.
// 3. Coberto por uma janela em tela cheia de OUTRO programa (o jogo): o vídeo para; o som continua. Descoberto, volta.
// 4. Uma janela pequena na frente (sem cobrir): o vídeo continua.
//
// A Ana transmite pelo Chrome dos testes. Precisa do LiveKit, da API de teste na 3099 e do site na 5174.
//
//   node e2e/a-vista-no-app.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron } from 'playwright-core';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const ELECTRON = path.resolve('node_modules/electron/dist/electron.exe');
const SITE_DO_APP = process.env.SITE_DO_APP ?? 'http://localhost:5174/app/';
const s = Date.now().toString().slice(-5);

/** Guarda as conexões do WebRTC, para contar o que chega. */
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

const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      n++;
      ctx.fillStyle = `hsl(${(n * 7) % 360} 60% 40%)`;
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = '#fff';
      ctx.font = '60px sans-serif';
      ctx.fillText('quadro ' + n, 100, 360);
    }, 1000 / 15);
    return canvas.captureStream(15);
  };
};

/** Bytes de vídeo e de som recebidos por segundo, numa janela de `ms`. */
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
  return { video: Math.round(((b.video - a.video) * 8) / ms), audio: Math.round(((b.audio - a.audio) * 8) / ms) }; // kbps
}

const kbps = (c) => `vídeo ${c.video} kbps, som ${c.audio} kbps`;

/**
 * Uma janela de outro processo: em tela cheia (o jogo) ou pequena. Devolve como fechá-la.
 *
 * Ela é aberta PELO APP (o processo da frente): o Windows não deixa um programa aberto em segundo plano tomar o primeiro
 * plano, e aberta pelo teste ela ficaria atrás, com o Syden ainda em foco. Um jogo de verdade, aberto pela pessoa, vem
 * para a frente.
 */
async function janelaDeOutroPrograma(cheia) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'syden-capa-'));
  fs.writeFileSync(path.join(pasta, 'package.json'), '{"name":"capa","main":"main.js"}');
  fs.writeFileSync(
    path.join(pasta, 'main.js'),
    `const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const w = new BrowserWindow({ fullscreen: ${cheia}, width: 400, height: 260, x: 40, y: 40, backgroundColor: '#303030' });
  w.loadURL('data:text/html,<body style="background:#333"></body>');
  w.focus();
});`,
  );
  const pid = await app.evaluate((_electron, [exe, dir]) => {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.SYDEN_URL;
    return process.mainModule.require('node:child_process').spawn(exe, [dir], { env, stdio: 'ignore' }).pid;
  }, [ELECTRON, pasta]);
  return () => {
    try {
      process.kill(pid);
    } catch {
      // já fechou
    }
  };
}

const env = { ...process.env, SYDEN_URL: SITE_DO_APP, SYDEN_PASTA_DE_DADOS: fs.mkdtempSync(path.join(os.tmpdir(), 'syden-app-teste-')) };
delete env.ELECTRON_RUN_AS_NODE;

let app = null;
let browser = null;
const fechar = [];
try {
  // A Ana, no Chrome, transmite.
  ({ browser } = await abrirNavegador({ permissoes: ['microphone'] }));
  const ctxAna = await browser.newContext({ viewport: { width: 1300, height: 850 }, permissions: ['microphone'] });
  const ana = vigiar(await ctxAna.newPage());
  await ana.addInitScript(TELA_FALSA);
  await cadastrar(ana, 'ana' + s);
  await dispensarPresentes(ana);
  await ana.locator('.rail-list .rail-item').first().click();
  await ana.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await ana.locator('.stage-controls').waitFor({ timeout: 30000 });

  // A Bia, no APP.
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
  ok('a Ana (Chrome) e a Bia (app) estão na Sala 2');

  await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await ana.locator('.screenshare-option').first().click();
  await bia.locator('.stream-invite', { hasText: 'ana' + s }).getByRole('button', { name: 'Assistir' }).click();
  await bia.locator('.stage-main video').first().waitFor({ timeout: 20000 });
  await bia.waitForTimeout(4000);
  const janela = (acao) => app.evaluate(({ BrowserWindow }, a) => {
    const w = BrowserWindow.getAllWindows()[0];
    if (a === 'minimizar') w.minimize();
    else if (a === 'restaurar') w.restore();
    w.focus?.();
  }, acao);
  await janela('restaurar');
  const antes = await chegando(bia);
  antes.video > 100 && antes.audio > 5 ? ok(`à vista, chega tudo (${kbps(antes)})`) : falhou(`à vista, não chega o esperado: ${kbps(antes)}`);

  // Minimizado.
  await janela('minimizar');
  await bia.waitForTimeout(3000);
  const minimizado = await chegando(bia);
  minimizado.video < 20 && minimizado.audio > 5 ? ok(`minimizado, o vídeo para e o som continua (${kbps(minimizado)})`) : falhou(`minimizado: ${kbps(minimizado)}`);
  await janela('restaurar');
  await bia.waitForTimeout(4000);
  const restaurado = await chegando(bia);
  restaurado.video > 100 ? ok(`restaurado, o vídeo volta (${kbps(restaurado)})`) : falhou(`restaurado: ${kbps(restaurado)}`);

  // Coberto por uma janela em tela cheia de outro programa.
  const tirarJogo = await janelaDeOutroPrograma(true);
  fechar.push(tirarJogo);
  await bia.waitForTimeout(5000);
  const coberto = await chegando(bia);
  if (process.env.DEPURAR) {
    console.log(
      '   o que o app vê:',
      await app.evaluate(({ BrowserWindow, screen }, base) => {
        const w = BrowserWindow.getAllWindows()[0];
        const nativo = process.mainModule.require(base + 'native/build/Release/syden_audio.node');
        return JSON.stringify({ frente: nativo.janelaDaFrente?.(), syden: screen.dipToScreenRect(w, w.getBounds()), focada: w.isFocused(), pid: process.pid, aVista: process.mainModule.require(base + 'src/a-vista.js').estaAVista(w) });
      }, path.resolve('desktop').split(path.sep).join('/') + '/'),
    );
  }
  coberto.video < 20 && coberto.audio > 5 ? ok(`coberto por um "jogo" em tela cheia, o vídeo para e o som continua (${kbps(coberto)})`) : falhou(`coberto: ${kbps(coberto)}`);
  tirarJogo();
  await bia.waitForTimeout(5000);
  const descoberto = await chegando(bia);
  descoberto.video > 100 ? ok(`descoberto (sem foco), o vídeo volta (${kbps(descoberto)})`) : falhou(`descoberto: ${kbps(descoberto)}`);

  // Uma janela pequena na frente: o Syden continua à vista.
  const tirarPequena = await janelaDeOutroPrograma(false);
  fechar.push(tirarPequena);
  await bia.waitForTimeout(4000);
  const pequena = await chegando(bia);
  pequena.video > 100 ? ok(`com uma janela pequena na frente, o vídeo continua (${kbps(pequena)})`) : falhou(`janela pequena na frente: ${kbps(pequena)}`);
  tirarPequena();
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  for (const f of fechar) f();
  await app?.close().catch(() => {});
  await browser?.close().catch(() => {});
}
resumo();
