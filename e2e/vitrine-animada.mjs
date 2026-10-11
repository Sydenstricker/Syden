// A VITRINE DO GUARDA-ROUPA, ANIMADA (pedido de 10/10/2026: "os elementos dos cards possuem animação também; não
// seria pertinente usar animações nos cards?"). A foto parada escondia justamente o que o guarda-roupa tem de
// melhor: a moldura prisma girando, o ouro brilhando, o nome pulsando e passando pelo arco-íris, o fundo andando.
//
// Fotografa os cartões de perfil do squad de demonstração no Syden local, QUADRO A QUADRO, com o relógio das
// animações na mão: cada animação é pausada e posta no instante exato de cada quadro, e a velocidade de cada uma
// é ajustada para ela dar um número INTEIRO de voltas no laço. Assim o último quadro emenda no primeiro sem salto,
// mesmo com animações de 1,2 s (o coelho) e de 70 s (o fundo cosmos) no mesmo cartão.
//
// Escreve em web/site/capturas/pt-BR/:
//   vitrine.webp         — a animada (WebP animado, pelo ffmpeg);
//   vitrine-parada.webp  — o primeiro quadro, para quem pediu menos movimento (o <picture> de index.html).
//
// Precisa do Syden local com a demonstração caprichada (e2e/caprichar-demonstracao.mjs) e do ffmpeg no PATH:
//   API=http://localhost:3099 APP=http://localhost:5174/ SENHA_DEMO=... node e2e/vitrine-animada.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io } from 'socket.io-client';
import { abrirNavegador, dispensarPresentes } from './ajuda.mjs';

const API = process.env.API ?? 'http://localhost:3099';
const APP = process.env.APP ?? 'http://localhost:5174/';
const SENHA = process.env.SENHA_DEMO;
if (!SENHA) {
  console.error('Falta SENHA_DEMO (a senha das contas da demonstração).');
  process.exit(1);
}
const DESTINO = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'), '..', 'web', 'site', 'capturas', 'pt-BR');
const CARTOES = ['helena', 'rafa', 'clara', 'bento'];
/** O laço: 6 s a 12 quadros por segundo. Cada animação dá um número inteiro de voltas nele. */
const LACO_MS = 6000;
const QUADROS = 72;

const entrar = async (nome) =>
  (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: nome, password: SENHA }) })).json()).token;

// O resto do squad online durante a foto (o cartão diz "Disponível"), conectado como o app conecta.
const conectados = [];
for (const nome of ['kai', ...CARTOES]) {
  const s = io(API, { auth: { token: await entrar(nome) }, transports: ['websocket'] });
  await new Promise((ok) => s.on('connect', ok));
  conectados.push(s);
}

const { browser } = await abrirNavegador({ viewport: { width: 1600, height: 900 } });
const pagina = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const token = await entrar('kai');
await pagina.addInitScript((t) => {
  localStorage.setItem('janja.token', t);
  localStorage.setItem('syden.idioma', 'pt-BR');
}, token);
await pagina.goto(APP, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(1500);
await dispensarPresentes(pagina).catch(() => {});
await pagina.getByText('ranked', { exact: true }).first().click();
await pagina.waitForTimeout(1500);

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'vitrine-'));
/** quadros[k][i]: o quadro i do cartão k, em PNG. */
const quadros = [];
for (const nome of CARTOES) {
  await pagina.locator('.member', { hasText: nome }).first().click();
  const cartao = pagina.locator('.perfil-cartao');
  await cartao.waitFor({ timeout: 5000 });
  await pagina.waitForTimeout(1200);
  // O relógio na mão: todas as animações pausadas, cada uma com a velocidade que fecha o laço.
  const voltas = await pagina.evaluate((laco) => {
    const lista = document.getAnimations();
    window.__animacoes = lista.map((a) => {
      const t = a.effect.getComputedTiming();
      const periodo = (t.duration || 1) * (/alternate/.test(t.direction) ? 2 : 1);
      const n = Math.max(1, Math.round(laco / periodo));
      a.pause();
      return { a, taxa: (n * periodo) / laco };
    });
    return window.__animacoes.length;
  }, LACO_MS);
  const deste = [];
  for (let i = 0; i < QUADROS; i++) {
    await pagina.evaluate((t) => {
      for (const { a, taxa } of window.__animacoes) a.currentTime = t * taxa;
    }, (i * LACO_MS) / QUADROS);
    deste.push(await cartao.screenshot({ animations: 'allow' }));
  }
  quadros.push(deste);
  console.log(`${nome}: ${voltas} animações, ${QUADROS} quadros`);
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(300);
}

// A MONTAGEM, quadro a quadro: os quatro cartões lado a lado, em alturas desencontradas, sobre a noite com o
// brilho âmbar — a mesma vitrine da foto parada de antes, agora com o tempo correndo.
const montar = await browser.newPage();
for (let i = 0; i < QUADROS; i++) {
  const png = await montar.evaluate(async (cartoes) => {
    const imgs = [];
    for (const b of cartoes) {
      const im = new Image();
      im.src = 'data:image/png;base64,' + b;
      await im.decode();
      imgs.push(im);
    }
    const [L, VAO, MARGEM, DESLOCA] = [300, 28, 40, [0, 46, 14, 58]];
    const alturas = imgs.map((im) => (im.height * L) / im.width);
    const W = MARGEM * 2 + L * imgs.length + VAO * (imgs.length - 1);
    const H = Math.round(MARGEM * 2 + Math.max(...alturas.map((a, k) => a + DESLOCA[k])));
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H % 2 ? H + 1 : H;
    const g = c.getContext('2d');
    const fundo = g.createLinearGradient(0, 0, 0, H);
    fundo.addColorStop(0, '#161a22');
    fundo.addColorStop(1, '#1c212b');
    g.fillStyle = fundo;
    g.fillRect(0, 0, W, c.height);
    const brilho = g.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, W * 0.55);
    brilho.addColorStop(0, 'rgba(245,184,61,0.20)');
    brilho.addColorStop(1, 'rgba(245,184,61,0)');
    g.fillStyle = brilho;
    g.fillRect(0, 0, W, c.height);
    g.imageSmoothingQuality = 'high';
    imgs.forEach((im, k) => {
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.55)';
      g.shadowBlur = 30;
      g.shadowOffsetY = 14;
      g.drawImage(im, MARGEM + k * (L + VAO), MARGEM + DESLOCA[k], L, alturas[k]);
      g.restore();
    });
    return c.toDataURL('image/png').split(',')[1];
  }, quadros.map((q) => q[i].toString('base64')));
  fs.writeFileSync(path.join(pasta, `q${String(i).padStart(3, '0')}.png`), Buffer.from(png, 'base64'));
}
await browser.close();
for (const s of conectados) s.close();

fs.mkdirSync(DESTINO, { recursive: true });
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
ffmpeg('-framerate', String(QUADROS / (LACO_MS / 1000)), '-i', path.join(pasta, 'q%03d.png'), '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '78', '-loop', '0', path.join(DESTINO, 'vitrine.webp'));
ffmpeg('-i', path.join(pasta, 'q000.png'), '-c:v', 'libwebp', '-q:v', '88', path.join(DESTINO, 'vitrine-parada.webp'));
fs.rmSync(pasta, { recursive: true });
for (const nome of ['vitrine.webp', 'vitrine-parada.webp']) {
  console.log(`${nome}: ${(fs.statSync(path.join(DESTINO, nome)).size / 1024).toFixed(0)} KB`);
}
