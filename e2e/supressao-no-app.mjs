// A supressão de ruído NATIVA do app (DPDFNet, desktop/src/ruido), de ponta a ponta.
//
// A Ana usa o APP (Electron), com uma gravação no lugar do microfone; a Bia está no Chrome, entra muda e
// grava o que ouve. Confere-se: o motor que rodou foi o nativo, e não o GTCRN do site; o processo
// nativo deu conta (custo por quadro e nenhuma falta de som); o som chegou à Bia.
//
// E, de propósito, DERRUBA o processo da supressão no meio da chamada: a voz não pode parar, e NENHUM
// outro modelo pode assumir no lugar (decisão do Sydenstricker, 05/10/2026: "não quero iludir o
// usuário"). A voz segue sem supressão, e Configurações tem de dizer que o DPDFNet parou.
//
// Precisa do LiveKit no ar (npm run dev:livekit) e do site servido em http://localhost:5174/app/.
//
//   node e2e/supressao-no-app.mjs voz-com-ruido.wav  (WAV mono de 48 kHz)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron } from 'playwright-core';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const ARQUIVO = process.argv[2] ? path.resolve(process.argv[2]) : null;
// EMPACOTADO=1 testa o app como ele vai para as pessoas (desktop/release/win-unpacked, gerado com
// `npx electron-builder --win --dir --projectDir desktop`): é lá que um arquivo que ficou dentro do
// asar, ou um binário que não foi junto, apareceria.
const EMPACOTADO = Boolean(process.env.EMPACOTADO);
const ELECTRON = EMPACOTADO ? path.resolve('desktop/release/win-unpacked/Syden.exe') : path.resolve('node_modules/electron/dist/electron.exe');
const SITE_DO_APP = process.env.SITE_DO_APP ?? 'http://localhost:5174/app/';

// Pasta de dados nova a cada vez: sem ela, o app abriria logado como a Ana do teste anterior.
const env = { ...process.env, SYDEN_URL: SITE_DO_APP, SYDEN_PASTA_DE_DADOS: fs.mkdtempSync(path.join(os.tmpdir(), 'syden-app-teste-')) };
delete env.ELECTRON_RUN_AS_NODE; // com ela ligada, o Electron sobe como Node puro e não há janela

const app = await _electron.launch({
  executablePath: ELECTRON,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    ...(ARQUIVO ? [`--use-file-for-fake-audio-capture=${ARQUIVO}`] : []),
    '--autoplay-policy=no-user-gesture-required',
    ...(EMPACOTADO ? [] : [path.resolve('desktop')]),
  ],
  env,
});
const ana = vigiar(await app.firstWindow());
if (process.env.DEPURAR) {
  ana.on('console', (m) => console.log('   [ana]', m.type(), m.text().slice(0, 220)));
  app.process().stdout?.on('data', (d) => process.stdout.write('   [main] ' + d));
  app.process().stderr?.on('data', (d) => process.stdout.write('   [main!] ' + d));
}
await ana.waitForLoadState('domcontentloaded');
await criarConta(ana, 'appruido').catch(async (e) => {
  await ana.screenshot({ path: 'e2e/fotos/supressao-no-app-cadastro.png' });
  console.log('   url no app:', ana.url());
  throw e;
});
await dispensarPresentes(ana);
const comunidade = 'App ' + Date.now().toString().slice(-5);
await ana.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await ana.getByText('Criar a minha').click();
await ana.getByLabel('Nome da comunidade').fill(comunidade);
await ana.locator('.dialog .btn-primary').click();
await ana.locator('.channel-list').waitFor({ timeout: 20000 });
await ana.locator('button[aria-label="Configurações"]').first().click();
await ana.locator('.settings-tab', { hasText: /Comunidade/ }).first().click();
await ana.locator('.invite-row input, .invite-row code').first().waitFor({ timeout: 10000 });
const convite = (await ana.locator('.invite-row input').first().inputValue().catch(() => null)) ?? (await ana.locator('.invite-row code').first().innerText());
await ana.keyboard.press('Escape');

const { browser } = await abrirNavegador();
const ctxBia = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
const bia = vigiar(await ctxBia.newPage());
await bia.addInitScript(() => localStorage.setItem('janja.settings', JSON.stringify({ startMuted: true })));
await criarConta(bia, 'appouve');
await dispensarPresentes(bia);
await bia.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await bia.getByText('Entrar com um convite').click();
await bia.getByLabel('Código de convite').fill(convite.trim());
await bia.locator('.dialog .btn-primary').click();
await bia.locator('.channel-list').waitFor({ timeout: 20000 });

for (const page of [bia, ana]) {
  await page.locator(`.rail-list .rail-item[aria-label="${comunidade}"]`).click();
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
}

/** Grava o que chega à Bia, por `segundos`, e devolve as amostras. */
const gravar = (segundos) =>
  bia.evaluate(async (segundos) => {
    const audio = [...document.querySelectorAll('audio')].find((a) => a.srcObject?.getAudioTracks().length);
    if (!audio) return null;
    const ctx = new AudioContext({ sampleRate: 48000 });
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const pedacos = [];
    proc.onaudioprocess = (e) => pedacos.push(Array.from(e.inputBuffer.getChannelData(0)));
    ctx.createMediaStreamSource(audio.srcObject).connect(proc);
    proc.connect(ctx.destination);
    await new Promise((ok) => setTimeout(ok, segundos * 1000));
    await ctx.close();
    return pedacos.flat();
  }, segundos);
const nivel = (x) => {
  const q = 960, db = [];
  for (let i = 0; i + q <= x.length; i += q) {
    let e = 0;
    for (let j = 0; j < q; j++) e += x[i + j] ** 2;
    db.push(10 * Math.log10(e / q + 1e-12));
  }
  db.sort((a, b) => a - b);
  return { pausa: db[Math.floor(db.length * 0.1)], fala: db[Math.floor(db.length * 0.9)] };
};

await ana.waitForTimeout(7000); // o processo nativo sobe, a folga enche e a primeira medida chega
await ana.screenshot({ path: 'e2e/fotos/supressao-no-app.png' });
const medida = await ana.evaluate(() => window.sydenSupressao ?? null);
if (!medida) falhou('nenhuma medida da supressão: ela não montou');
else if (medida.motor !== 'dpdfnet') falhou(`no app, o motor deveria ser o nativo, e foi o ${medida.motor}`);
else {
  ok(`no app, roda o motor nativo (DPDFNet): ${medida.msPorQuadro.toFixed(2)} ms a cada quadro de ${medida.quadroMs} ms`);
  medida.faltas ? falhou(`faltou som do processo nativo ${medida.faltas} vez(es) em 5 s`) : ok('nenhuma falta de som do processo nativo');
}

const x = await gravar(15);
if (!x || x.length < 48000 * 5) falhou('a Bia não recebeu o som da Ana');
else {
  const n = nivel(x);
  n.fala > -60 ? ok(`o som do app chegou à Bia (fala ${n.fala.toFixed(1)} dB, pausas ${n.pausa.toFixed(1)} dB)`) : falhou('chegou silêncio à Bia');
}

// AGORA DERRUBA O PROCESSO NATIVO. O Electron nomeia o processo pelo serviceName.
try {
  const lista = execFileSync('powershell', ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter \"Name='${path.basename(ELECTRON)}'\" | Where-Object { $_.CommandLine -like '*--utility-sub-type=node.mojom.NodeService*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $_.ProcessId }`], { encoding: 'utf8' });
  lista.trim() ? ok(`processo da supressão derrubado de propósito (pid ${lista.trim().split(/\s+/).join(', ')})`) : falhou('não achei o processo da supressão para derrubar');
} catch (e) {
  falhou('não consegui derrubar o processo: ' + String(e).slice(0, 120));
}
await ana.waitForTimeout(3000); // o vigia da ponte espera 1 s de silêncio
await ana.locator('button[aria-label="Configurações"]').first().click();
await ana.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
const aviso = (await ana.locator('.toggle-nota').innerText().catch(() => '')).trim();
aviso === 'DPDFNet parou. Sua voz está saindo sem supressão de ruído.'
  ? ok(`Configurações conta a verdade: "${aviso}"`)
  : falhou(`depois da queda, Configurações diz ${JSON.stringify(aviso)}`);
await ana.locator('.toggle-nota').scrollIntoViewIfNeeded().catch(() => {});
await ana.screenshot({ path: 'e2e/fotos/supressao-no-app-parou.png' });
await ana.keyboard.press('Escape');
const motorDepois = await ana.evaluate(() => window.sydenSupressao?.motor ?? null);
motorDepois === 'gtcrn' ? falhou('o GTCRN assumiu no lugar — não deveria haver modelo de reserva') : ok('nenhum outro modelo assumiu no lugar');
const y = await gravar(6);
y && nivel(y).fala > -60 ? ok(`e a voz continuou chegando à Bia (fala ${nivel(y).fala.toFixed(1)} dB)`) : falhou('depois da queda, a voz parou de chegar');

await browser.close();
await app.close();
resumo('Supressão de ruído no app');
