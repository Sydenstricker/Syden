// O FUNDO DA CÂMERA NO APP (16/11/2026; ver web/src/fundoDaCamera.ts e desktop/src/fundo-camera/).
//
// O app de verdade (o Electron do desktop/, apontado ao site de teste) com a câmera falsa do Chromium tocando um vídeo de gente
// falando para a câmera (e2e/fundo-da-camera/videos, fora do git: node e2e/fundo-da-camera/baixar.mjs). O teste entra numa
// sala, liga a câmera, escolhe o fundo pela tela de Configurações e mede, no quadro que vai para a chamada:
//   - "Apagar": os cantos de cima viram o cinza do fundo apagado e o meio (a pessoa) não;
//   - "Desfocar": os cantos perdem o detalhe (a variação entre pixels vizinhos cai);
//   - "Nenhum": o quadro volta a ser o da câmera;
//   - o processador do processo do modelo (o "fundo da câmera" nas métricas do app).
//
//   API de teste na 3099, site na 5174 e LiveKit local (npm run dev:livekit); ffmpeg no PATH
//   node e2e/fundo-da-camera-no-app.mjs
//
// O PC precisa estar parado: com alguém usando, a janela do teste fica coberta e o app para de mostrar vídeo.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { falhou, ok, resumo, vigiar } from './ajuda.mjs';

const API = 'http://localhost:3099';
const VIDEO = resolve('e2e/fundo-da-camera/videos/mensagem-hackathon.webm');
if (!existsSync(VIDEO)) throw new Error('falta o vídeo de teste: node e2e/fundo-da-camera/baixar.mjs');

const pasta = mkdtempSync(join(tmpdir(), 'syden-fundo-'));
const y4m = join(pasta, 'camera.y4m');
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', '3', '-t', '8', '-i', VIDEO, '-vf', 'fps=15,scale=640:360:force_original_aspect_ratio=increase,crop=640:360', '-pix_fmt', 'yuv420p', y4m]);
if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);

const pedir = async (metodo, rota, token, corpo) => {
  const res = await fetch(API + rota, { method: metodo, headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(metodo + ' ' + rota + ': ' + res.status + ' ' + JSON.stringify(j));
  return j;
};
const nome = 'fundo' + Date.now().toString(36).slice(-6);
await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
const { token } = await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' });
const comunidade = await pedir('POST', '/api/communities', token, { name: 'Fundo ' + nome.slice(-4) });

const env = { ...process.env, SYDEN_URL: 'http://localhost:5174/app/', SYDEN_PASTA_DE_DADOS: join(pasta, 'dados') };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  executablePath: resolve('node_modules/electron/dist/electron.exe'),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`, resolve('desktop')],
  env,
});
const page = vigiar(await app.firstWindow());
page.on('console', (m) => /fundo da câmera/i.test(m.text()) && console.log('  [console]', m.text().slice(0, 200)));
await app.context().addInitScript((tk) => localStorage.setItem('janja.token', tk), token);
await page.waitForLoadState('domcontentloaded');
await page.reload();
await page.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).click({ timeout: 60000 });
for (let i = 0; i < 6; i++) {
  const f = page.getByRole('button', { name: 'Fechar', exact: true });
  if (await f.first().isVisible().catch(() => false)) await f.first().click();
  else if (i > 2) break;
  await page.waitForTimeout(600);
}
await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
await page.locator('.stage-controls').waitFor({ timeout: 30000 });
await page.locator('.stage-controls button[aria-label="Ligar câmera"]').click();
await page.waitForTimeout(3000);
ok('na sala, com a câmera ligada');

/** O quadro que vai para a chamada: a faixa publicada da câmera, lida pela página. */
const medir = () =>
  page.evaluate(async () => {
    const v = [...document.querySelectorAll('video')].find((x) => x.srcObject?.getVideoTracks?.()[0] && x.videoWidth >= 320);
    if (!v) return null;
    const c = new OffscreenCanvas(v.videoWidth, v.videoHeight);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(v, 0, 0);
    const W = c.width, H = c.height;
    const regiao = (x0, y0, x1, y1) => {
      const d = g.getImageData(Math.round(x0 * W), Math.round(y0 * H), Math.round((x1 - x0) * W), Math.round((y1 - y0) * H));
      let cinza = 0, n = 0, detalhe = 0, brilho = 0;
      for (let i = 0; i < d.data.length; i += 4) {
        const [r, gg, b] = [d.data[i], d.data[i + 1], d.data[i + 2]];
        if (Math.abs(r - 41) < 8 && Math.abs(gg - 43) < 8 && Math.abs(b - 48) < 8) cinza++;
        if (i >= 4) detalhe += Math.abs(r - d.data[i - 4]);
        brilho += (r + gg + b) / 3;
        n++;
      }
      return { cinza: cinza / n, detalhe: detalhe / n, brilho: brilho / n };
    };
    return { tamanho: [W, H], cantoEsq: regiao(0, 0, 0.15, 0.25), cantoDir: regiao(0.85, 0, 1, 0.25), meio: regiao(0.42, 0.35, 0.58, 0.6), acima: regiao(0.4, 0.02, 0.6, 0.12) };
  });

const antes = await medir();
console.log('  sem efeito: ' + JSON.stringify(antes));
if (!antes) falhou('não achei o vídeo da própria câmera na tela');

// FOTOS=<pasta>: guarda o quadro que vai para a chamada em cada modo (para mostrar o efeito, como na página do Syden Broadcast)
const FOTOS = process.env.FOTOS;
async function foto(nome) {
  if (!FOTOS) return;
  const dados = await page.evaluate(() => {
    const v = [...document.querySelectorAll('video')].find((x) => x.srcObject?.getVideoTracks?.()[0] && x.videoWidth >= 320);
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    return c.toDataURL('image/jpeg', 0.88).split(',')[1];
  });
  writeFileSync(join(FOTOS, nome + '.jpg'), Buffer.from(dados, 'base64'));
}

async function escolher(nomeDaOpcao) {
  await page.locator('button[aria-label="Configurações"]').first().click();
  await page.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
  const opcao = page.locator('.fundo-da-camera .effect-option', { hasText: new RegExp('^' + nomeDaOpcao + '$') });
  if (!(await opcao.count())) {
    await page.keyboard.press('Escape');
    return false;
  }
  await opcao.click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
  return true;
}

await foto('sem-efeito');
if (!(await escolher('Apagado'))) falhou('a escolha do fundo da câmera não apareceu nas Configurações do app');
else {
  const apagado = await medir();
  console.log('  apagado: ' + JSON.stringify(apagado));
  const cantos = (apagado.cantoEsq.cinza + apagado.cantoDir.cinza) / 2;
  cantos > 0.8 ? ok(`"Apagar": ${Math.round(cantos * 100)}% dos cantos de cima viraram o fundo apagado`) : falhou(`"Apagar": só ${Math.round(cantos * 100)}% dos cantos ficaram apagados`);
  apagado.meio.cinza < 0.2 ? ok(`e a pessoa ficou (${Math.round(apagado.meio.cinza * 100)}% do meio apagado)`) : falhou(`o meio também sumiu (${Math.round(apagado.meio.cinza * 100)}%)`);

  await foto('apagado');
  // o processador do processo do modelo, em 10 s
  const metricas = () => app.evaluate(({ app: a }) => a.getAppMetrics().map((m) => ({ tipo: m.type, nome: m.name ?? m.serviceName, cpu: m.cpu.cumulativeCPUUsage ?? 0 })));
  const m0 = await metricas();
  await page.waitForTimeout(10000);
  const m1 = await metricas();
  const doFundo = (lista) => lista.find((m) => /fundo da câmera/i.test(m.nome ?? ''));
  if (doFundo(m0) && doFundo(m1)) {
    const nucleos = (doFundo(m1).cpu - doFundo(m0).cpu) / 10;
    console.log(`  o processo do modelo gastou ${nucleos.toFixed(2)} núcleo em 10 s`);
    nucleos < 0.5 ? ok(`o modelo custa ${nucleos.toFixed(2)} de um núcleo`) : falhou(`o modelo custa ${nucleos.toFixed(2)} núcleo`);
  } else falhou('não achei o processo do fundo da câmera nas métricas do app: ' + JSON.stringify(m1.map((m) => m.nome)));

  await escolher('Desfocado');
  const desfocado = await medir();
  console.log('  desfocado: ' + JSON.stringify(desfocado));
  // o vídeo tem parede lisa atrás: o que se mede é que o desfoque NÃO puxa a pessoa (cabelo, roupa escura) para o fundo, o
  // que fazia uma sombra em volta da cabeça; o brilho logo acima dela tem de continuar o da parede
  const queda = antes.acima.brilho - desfocado.acima.brilho;
  queda < 25 && desfocado.cantoEsq.cinza < 0.5
    ? ok(`"Desfocar": sem sombra em volta da cabeça (o brilho acima dela foi de ${antes.acima.brilho.toFixed(0)} para ${desfocado.acima.brilho.toFixed(0)})`)
    : falhou(`"Desfocar": o fundo escureceu acima da cabeça, de ${antes.acima.brilho.toFixed(0)} para ${desfocado.acima.brilho.toFixed(0)}`);
  // e o fundo desfocado é o MESMO fundo, no mesmo lugar: o canto de cima continua com o brilho dele. Com o desfoque de cabeça
  // para baixo (16/11/2026), o canto de cima ganhava as almofadas de baixo, e o brilho ia de 229 a 188
  const cantoAntes = (antes.cantoEsq.brilho + antes.cantoDir.brilho) / 2;
  const cantoDepois = (desfocado.cantoEsq.brilho + desfocado.cantoDir.brilho) / 2;
  Math.abs(cantoAntes - cantoDepois) < 20
    ? ok(`e o fundo desfocado fica no lugar (o brilho dos cantos de cima foi de ${cantoAntes.toFixed(0)} para ${cantoDepois.toFixed(0)})`)
    : falhou(`o fundo desfocado mudou de lugar: o brilho dos cantos de cima foi de ${cantoAntes.toFixed(0)} para ${cantoDepois.toFixed(0)}`);
  await page.screenshot({ path: 'e2e/fotos/fundo-da-camera-desfocado.png' });
  await foto('desfocado');

  // "Imagem": uma imagem toda vermelha, escolhida pela tela; os cantos têm de ficar vermelhos e o meio, a pessoa
  const { PNG } = await import('pngjs');
  const png = new PNG({ width: 64, height: 36 });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([220, 20, 30, 255], i);
  await page.locator('button[aria-label="Configurações"]').first().click();
  await page.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
  await page.locator('.fundo-da-camera .effect-option', { hasText: /^Imagem$/ }).click();
  await page.locator('.fundo-da-camera-imagem input[type="file"]').setInputFiles({ name: 'vermelho.png', mimeType: 'image/png', buffer: PNG.sync.write(png) });
  await page.locator('.fundo-da-camera-imagem img').waitFor({ timeout: 5000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
  const comImagem = await page.evaluate(() => {
    const v = [...document.querySelectorAll('video')].find((x) => x.srcObject?.getVideoTracks?.()[0] && x.videoWidth >= 320);
    const c = new OffscreenCanvas(v.videoWidth, v.videoHeight);
    const g = c.getContext('2d');
    g.drawImage(v, 0, 0);
    const vermelho = (x0, y0) => {
      const d = g.getImageData(Math.round(x0 * c.width), Math.round(y0 * c.height), 40, 40).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 70 && d[i + 2] < 80) n++;
      return n / (d.length / 4);
    };
    return { canto: vermelho(0.02, 0.03), meio: vermelho(0.47, 0.45) };
  });
  console.log('  com a imagem: ' + JSON.stringify(comImagem));
  comImagem.canto > 0.8 && comImagem.meio < 0.2 ? ok('"Imagem": o fundo virou a imagem escolhida, e a pessoa ficou na frente') : falhou('"Imagem": ' + JSON.stringify(comImagem));
  await page.screenshot({ path: 'e2e/fotos/fundo-da-camera-imagem.png' });
  if (FOTOS) {
    // para mostrar: uma paisagem desenhada por código (céu de fim de tarde e morros), no lugar do vermelho da medida
    const paisagem = new PNG({ width: 640, height: 360 });
    for (let y = 0; y < 360; y++)
      for (let x = 0; x < 640; x++) {
        const t = y / 360;
        const morro1 = 230 + Math.sin(x / 70) * 22 + Math.sin(x / 23) * 6;
        const morro2 = 280 + Math.sin(x / 110 + 2) * 18;
        let c = [Math.round(255 - t * 90), Math.round(170 - t * 60), Math.round(120 + t * 60)];
        if (Math.hypot(x - 470, y - 175) < 38) c = [255, 226, 160];
        if (y > morro1) c = [70, 96, 92];
        if (y > morro2) c = [44, 66, 62];
        paisagem.data.set([...c, 255], (y * 640 + x) * 4);
      }
    await page.locator('button[aria-label="Configurações"]').first().click();
    await page.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
    await page.locator('.fundo-da-camera-imagem input[type="file"]').setInputFiles({ name: 'paisagem.png', mimeType: 'image/png', buffer: PNG.sync.write(paisagem) });
    await page.waitForTimeout(800);
    const bloco = page.locator('.fundo-da-camera');
    await bloco.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(FOTOS, 'configuracoes.png'), clip: await page.evaluate(() => {
      const a = (document.querySelector('.syden-broadcast') ?? document.querySelector('.fundo-da-camera')).getBoundingClientRect();
      const b = document.querySelector('.fundo-da-camera-imagem').getBoundingClientRect();
      return { x: a.x - 16, y: a.y - 12, width: Math.max(a.width, document.querySelector('.fundo-da-camera').getBoundingClientRect().width) + 32, height: b.bottom - a.y + 28 };
    }) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2500);
    await foto('imagem');
  }

  await escolher('Nenhum');
  const depois = await medir();
  (depois.cantoEsq.cinza + depois.cantoDir.cinza) / 2 < 0.2 ? ok('"Nenhum": a câmera voltou como vem') : falhou('"Nenhum": os cantos continuam apagados');
}

await app.close();
rmSync(pasta, { recursive: true, force: true });
resumo('o fundo da câmera no app');
