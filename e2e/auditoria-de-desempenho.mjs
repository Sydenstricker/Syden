// A AUDITORIA DE DESEMPENHO (14/11/2026, pedido dele depois dos relatos de FPS caindo no LoL com o Syden aberto no
// navegador, no segundo monitor, numa chamada sem câmera). Mede o que o navegador de quem JOGA gasta em cada cenário, com
// o Syden à vista COM foco e SEM foco (o segundo monitor: à vista, o jogo com o foco):
//
//   texto · início (o quarto) · salão · voltar ao texto com a cena guardada · chamada só de voz · chamada com a câmera de
//   um amigo · chamada assistindo a transmissão de um amigo em 1080p
//
// Por cenário: núcleos de processador por tipo de processo do navegador (página, placa, áudio/rede, navegador),
// memória (a soma dos processos), quadros de animação por segundo (requestAnimationFrame, em todos os documentos),
// relógios por segundo (setTimeout/setInterval disparados) e tarefas longas (> 50 ms).
//
// "Sem foco" é simulado: document.hasFocus() responde falso em todos os documentos (a página e os iframes do quarto e do
// salão) e o blur é disparado; é o mesmo sinal que o Syden lê. Quem mede e o amigo ficam em navegadores separados, para
// o processador de um não entrar na conta do outro. O microfone falso toca ruído de quarto e voz (a supressão trabalha).
//
//   node e2e/auditoria-de-desempenho.mjs   (API de teste na 3099, site na 5174 — de preferência o build de produção,
//   `vite build` + `vite preview` — e o LiveKit local)   → e2e/fotos/auditoria-de-desempenho.json
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, vigiar } from './ajuda.mjs';

const s = Date.now().toString().slice(-5);
const JANELA_MS = Number(process.env.JANELA_MS ?? 20000);
const ACOMODAR_MS = 6000;
// SO_TRANSMISSAO=1 pula direto à transmissão; SEM_CLIPE=1 desliga o gravador de clipes (para medir o quanto ele custa)
const SO_TRANSMISSAO = !!process.env.SO_TRANSMISSAO, SEM_CLIPE = !!process.env.SEM_CLIPE;

/** Ruído de quarto (~−40 dBFS) com rajadas de "voz" (~−18 dBFS), 30 s, 48 kHz: a supressão nunca fica no "quieto". */
function wavDeQuarto() {
  const taxa = 48000, n = taxa * 30, d = Buffer.alloc(n * 2);
  let marrom = 0;
  for (let i = 0; i < n; i++) {
    marrom = marrom * 0.98 + (Math.random() * 2 - 1) * 0.02;
    const t = i / taxa, fala = Math.sin(2 * Math.PI * 0.7 * t) > 0.2;
    const voz = fala ? 0.12 * Math.sin(2 * Math.PI * (180 + 40 * Math.sin(2 * Math.PI * 3 * t)) * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 9 * t)) : 0;
    d.writeInt16LE(Math.round(Math.max(-1, Math.min(1, marrom * 0.5 + voz)) * 32767), i * 2);
  }
  const c = Buffer.alloc(44);
  c.write('RIFF', 0); c.writeUInt32LE(36 + d.length, 4); c.write('WAVEfmt ', 8); c.writeUInt32LE(16, 16); c.writeUInt16LE(1, 20);
  c.writeUInt16LE(1, 22); c.writeUInt32LE(taxa, 24); c.writeUInt32LE(taxa * 2, 28); c.writeUInt16LE(2, 32); c.writeUInt16LE(16, 34);
  c.write('data', 36); c.writeUInt32LE(d.length, 40);
  const arq = join(tmpdir(), `syden-quarto-${s}.wav`);
  writeFileSync(arq, Buffer.concat([c, d]));
  return arq;
}

/** Em todo documento (a página e os iframes): contadores, e o foco que o teste controla. */
const SONDA = () => {
  const c = (window.__sonda = { raf: 0, relogios: 0, longas: 0, longasMs: 0 });
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => raf((t) => { c.raf++; f(t); });
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  window.setTimeout = (f, ms, ...a) => st(typeof f === 'function' ? (...x) => { c.relogios++; f(...x); } : f, ms, ...a);
  window.setInterval = (f, ms, ...a) => si(typeof f === 'function' ? (...x) => { c.relogios++; f(...x); } : f, ms, ...a);
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { c.longas++; c.longasMs += e.duration; } }).observe({ type: 'longtask', buffered: false });
  } catch {}
  window.__semFoco = false;
  const hf = Document.prototype.hasFocus;
  Document.prototype.hasFocus = function () { return window.__semFoco ? false : hf.call(this); };
};

const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const W = 1920, H = 1080;
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const ctx = canvas.getContext('2d');
    const bolas = Array.from({ length: 40 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53) % H, vx: ((i % 7) - 3) * 4, vy: ((i % 5) - 2) * 4, r: 6 + (i % 30), h: (i * 37) % 360 }));
    setInterval(() => {
      for (let y = 0; y < H; y += 60) for (let x = 0; x < W; x += 60) { ctx.fillStyle = ((x + y) / 60) % 2 < 1 ? '#2b4' : '#3a5'; ctx.fillRect(x, y, 60, 60); }
      for (const b of bolas) { b.x = (b.x + b.vx + W) % W; b.y = (b.y + b.vy + H) % H; ctx.fillStyle = `hsl(${b.h} 80% 55%)`; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }
    }, 1000 / 15);
    return canvas.captureStream(15);
  };
};

async function semFoco(pagina, valor) {
  for (const f of pagina.frames()) {
    await f.evaluate((v) => { window.__semFoco = v; window.dispatchEvent(new Event(v ? 'blur' : 'focus')); }, valor).catch(() => {});
  }
  await pagina.waitForTimeout(1500); // a conferência de foco do Syden roda uma vez por segundo
}

async function lerSondas(pagina) {
  const soma = { raf: 0, relogios: 0, longas: 0, longasMs: 0, porDocumento: [] };
  for (const f of pagina.frames()) {
    const v = await f.evaluate(() => window.__sonda && { ...window.__sonda }).catch(() => null);
    if (!v) continue;
    for (const k of ['raf', 'relogios', 'longas', 'longasMs']) soma[k] += v[k];
    soma.porDocumento.push({ url: f.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 60), raf: v.raf, relogios: v.relogios });
  }
  return soma;
}

/** O processador por tipo de processo (segundos acumulados) e os pids. */
async function processos(cdp) {
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
  return processInfo;
}

function memoriaMb(pids) {
  try {
    const saida = execSync(`powershell -NoProfile -Command "(Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | Measure-Object PrivateMemorySize64 -Sum).Sum"`, { encoding: 'utf8' });
    return Math.round(Number(saida.trim()) / 1048576);
  } catch {
    return null;
  }
}

const resultados = [];
async function medir(nome, eu, cdp, foco) {
  await semFoco(eu, !foco);
  await eu.waitForTimeout(ACOMODAR_MS);
  const a = await processos(cdp), sa = await lerSondas(eu);
  const t0 = Date.now();
  await eu.waitForTimeout(JANELA_MS);
  const b = await processos(cdp), sb = await lerSondas(eu);
  const seg = (Date.now() - t0) / 1000;
  const porTipo = {};
  for (const p of b) {
    const antes = a.find((x) => x.id === p.id)?.cpuTime ?? 0;
    porTipo[p.type] = (porTipo[p.type] ?? 0) + (p.cpuTime - antes) / seg;
  }
  const total = Object.values(porTipo).reduce((x, y) => x + y, 0);
  const linha = {
    cenario: nome,
    foco: foco ? 'com foco' : 'sem foco',
    nucleos: +total.toFixed(3),
    porTipo: Object.fromEntries(Object.entries(porTipo).map(([k, v]) => [k, +v.toFixed(3)])),
    memoriaMb: memoriaMb(b.map((p) => p.id)),
    rafPorSeg: +((sb.raf - sa.raf) / seg).toFixed(1),
    relogiosPorSeg: +((sb.relogios - sa.relogios) / seg).toFixed(1),
    longas: sb.longas - sa.longas,
    longasMs: Math.round(sb.longasMs - sa.longasMs),
    porDocumento: sb.porDocumento.map((d, i) => {
      const antes = sa.porDocumento.find((x) => x.url === d.url);
      return { url: d.url, raf: +((d.raf - (antes?.raf ?? 0)) / seg).toFixed(1), relogios: +((d.relogios - (antes?.relogios ?? 0)) / seg).toFixed(1) };
    }),
  };
  resultados.push(linha);
  const tipos = Object.entries(linha.porTipo).filter(([, v]) => v > 0.005).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ');
  console.log(`${nome.padEnd(34)} ${linha.foco.padEnd(9)} ${linha.nucleos.toFixed(2)} núcleo (${tipos}) · ${linha.memoriaMb} MB · rAF ${linha.rafPorSeg}/s · relógios ${linha.relogiosPorSeg}/s · longas ${linha.longas} (${linha.longasMs} ms)`);
}

async function ambos(nome, eu, cdp) {
  await medir(nome, eu, cdp, true);
  await medir(nome, eu, cdp, false);
  await semFoco(eu, false);
}

const wav = wavDeQuarto();
const navegadores = [];
try {
  // quem joga (medido)
  const { browser: bEu, contexto: cEu } = await abrirNavegador({ viewport: { width: 1600, height: 950 }, permissoes: ['microphone', 'camera'], audioFalso: wav, argsExtras: ['--enable-gpu', '--use-angle=d3d11'] });
  navegadores.push(bEu);
  const eu = vigiar(await cEu.newPage());
  await eu.addInitScript(SONDA);
  // CLIPE_TIPO troca o formato do gravador de clipes (para medir o H.264 pela placa)
  if (process.env.CLIPE_TIPO) await eu.addInitScript((tipo) => { const MR = window.MediaRecorder; window.MediaRecorder = class extends MR { constructor(s, o = {}) { super(s, o.videoBitsPerSecond ? { ...o, mimeType: tipo } : o); console.log('gravador', this.mimeType); } }; window.MediaRecorder.isTypeSupported = MR.isTypeSupported; }, process.env.CLIPE_TIPO);
  if (SEM_CLIPE) await eu.addInitScript(() => { MediaRecorder.prototype.start = function () {}; });
  await cadastrar(eu, 'jogo' + s);
  await dispensarPresentes(eu);
  const cdp = await bEu.newBrowserCDPSession();
  const placa = await eu.evaluate(() => {
    const g = document.createElement('canvas').getContext('webgl2');
    const e = g?.getExtension('WEBGL_debug_renderer_info');
    return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'sem WebGL2';
  });
  console.log('placa do navegador medido:', placa);

  if (!SO_TRANSMISSAO) {
  // 1. texto
  await eu.locator('.rail-item:not(.rail-action)').first().click();
  await eu.locator('.channel-row button.channel').first().click({ timeout: 15000 });
  await eu.waitForTimeout(2000);
  await ambos('texto (canal da comunidade)', eu, cdp);

  // 2. o quarto
  await eu.locator('.rail-logo').click();
  const quarto = await (await eu.waitForSelector('.quarto-novo-caixa:not(.salao-novo) iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 }).catch(() => {});
  await ambos('início (o quarto)', eu, cdp);

  // 3. o salão
  await eu.locator('.rail-item:not(.rail-action)').first().click();
  await eu.locator('.channel.inicio-link').click({ timeout: 15000 });
  await eu.waitForSelector('.salao-novo iframe', { timeout: 30000 }).catch(() => {});
  await eu.waitForTimeout(4000);
  await ambos('salão da comunidade', eu, cdp);

  // 4. de volta ao texto, com a cena guardada
  await eu.locator('.channel-row button.channel').first().click();
  await eu.waitForTimeout(2000);
  await ambos('texto, com o salão guardado', eu, cdp);

  }
  // o amigo, em outro navegador
  const { browser: bAmigo, contexto: cAmigo } = await abrirNavegador({ viewport: { width: 1400, height: 900 }, permissoes: ['microphone', 'camera'], audioFalso: wav });
  navegadores.push(bAmigo);
  const amigo = vigiar(await cAmigo.newPage());
  await amigo.addInitScript(TELA_FALSA);
  await cadastrar(amigo, 'amigo' + s);
  await dispensarPresentes(amigo);
  await amigo.locator('.rail-item:not(.rail-action)').first().click();
  await amigo.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await amigo.locator('.stage-controls').waitFor({ timeout: 30000 });

  // 5. chamada só de voz
  await eu.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await eu.locator('.stage-controls').waitFor({ timeout: 30000 });
  if (!SO_TRANSMISSAO) {
  await eu.waitForTimeout(4000);
  const sup = await eu.evaluate(() => window.sydenSupressao ?? null);
  console.log('supressão de ruído de quem joga:', JSON.stringify(sup));
  await ambos('chamada só de voz', eu, cdp);

  // 6. a câmera do amigo
  await amigo.locator('.stage-controls button[aria-label="Ligar câmera"], .stage-controls button[aria-label="Câmera"]').first().click().catch(() => console.log('(não achei o botão da câmera do amigo)'));
  await eu.locator('.stage video').first().waitFor({ timeout: 20000 }).catch(() => console.log('(a câmera do amigo não apareceu)'));
  await eu.waitForTimeout(3000);
  await ambos('chamada com a câmera do amigo', eu, cdp);
  await amigo.locator('.stage-controls button[aria-label="Desligar câmera"], .stage-controls button[aria-label="Câmera"]').first().click().catch(() => {});

  }
  // 7. assistindo a transmissão do amigo
  await amigo.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await amigo.locator('.screenshare-option').first().click();
  await eu.locator('.stream-invite', { hasText: 'amigo' + s }).getByRole('button', { name: 'Assistir' }).click({ timeout: 20000 });
  await eu.locator('.stage-main video').first().waitFor({ timeout: 20000 });
  await eu.waitForTimeout(5000);
  await ambos('assistindo a transmissão (1080p)', eu, cdp);
} catch (erro) {
  console.log('PAROU:', String(erro?.stack ?? erro).slice(0, 600));
} finally {
  mkdirSync('e2e/fotos', { recursive: true });
  writeFileSync('e2e/fotos/auditoria-de-desempenho.json', JSON.stringify(resultados, null, 2));
  for (const b of navegadores) await b.close().catch(() => {});
}
