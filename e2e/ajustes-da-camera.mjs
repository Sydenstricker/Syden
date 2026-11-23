// OS AJUSTES DA IMAGEM DA CÂMERA (23/11/2026; ver web/src/ajusteDaCamera.ts). No Chrome (o navegador mexe nos quadros), sem o
// app: Configurações → Voz e vídeo → Testar; o zoom recorta (o quadro da prévia encolhe), o 16:9 deita a imagem, arrastar
// move o enquadramento, o espelho e a luz valem, e numa sala a câmera publicada sai com o ajuste. "Voltar ao padrão" desfaz.
//
//   node e2e/ajustes-da-camera.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['camera', 'microphone'] });
  // uma câmera 4:3 (640 × 480), para o 16:9 mudar alguma coisa de verdade
  await ctx.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (c) => original(c && c.video ? { ...c, video: { ...(typeof c.video === 'object' ? c.video : {}), width: { exact: 640 }, height: { exact: 480 } } } : c);
  });
  const page = vigiar(await ctx.newPage());
  await cadastrar(page, 'ajuste' + s);
  await dispensarPresentes(page);

  const abrirAjustes = async () => {
    await page.locator('button[aria-label="Configurações"]').first().click();
    await page.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
    await page.locator('.ajustes-da-imagem').waitFor({ timeout: 10000 });
  };
  const tamanhoDaPrevia = () => page.evaluate(() => {
    const v = document.querySelector('.previa-da-camera video');
    return v ? [v.videoWidth, v.videoHeight] : null;
  });
  const esperarTamanho = (teste) =>
    page.waitForFunction(new Function('return (' + teste + ')(document.querySelector(".previa-da-camera video"))'), null, { timeout: 8000 }).then(() => true, () => false);

  await abrirAjustes();
  ok('no navegador, sem o app, os ajustes da imagem aparecem embaixo da prévia');
  await page.locator('.previa-da-camera-parada').click();
  await esperarTamanho('(v) => v && v.videoWidth > 0');
  const inteiro = await tamanhoDaPrevia();
  console.log('  a câmera como vem: ' + JSON.stringify(inteiro));

  // zoom 2× pela régua: o quadro sai com metade do tamanho (o recorte não amplia)
  await page.locator('.ajuste-regua', { hasText: 'Zoom' }).locator('input').fill('2');
  (await esperarTamanho(`(v) => v && Math.abs(v.videoWidth - ${inteiro[0] / 2}) <= 2`))
    ? ok(`o zoom 2× recorta o meio: ${JSON.stringify(await tamanhoDaPrevia())}`)
    : falhou(`o zoom não recortou: ${JSON.stringify(await tamanhoDaPrevia())}`);

  // arrastar move o enquadramento
  const xAntes = await page.evaluate(() => JSON.parse(localStorage.getItem('janja.settings') ?? localStorage.getItem('syden.settings') ?? '{}').ajusteDaCamera?.x);
  const caixa = await page.locator('.previa-da-camera video').boundingBox();
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await page.mouse.move(caixa.x + caixa.width / 2 + 120, caixa.y + caixa.height / 2, { steps: 6 });
  await page.mouse.up();
  const ajuste = await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      try {
        const v = JSON.parse(localStorage.getItem(k));
        if (v && v.ajusteDaCamera) return v.ajusteDaCamera;
      } catch {}
    }
    return null;
  });
  ajuste && ajuste.x < 0.5 ? ok(`arrastar para a direita move o enquadramento (o meio foi a x = ${ajuste.x.toFixed(2)})`) : falhou(`arrastar não mexeu: ${JSON.stringify(ajuste)} (antes ${xAntes})`);

  // a rodinha aproxima mais
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.wheel(0, -300);
  (await esperarTamanho(`(v) => v && v.videoWidth < ${inteiro[0] / 2 - 4}`))
    ? ok(`a rodinha do mouse aproxima: ${JSON.stringify(await tamanhoDaPrevia())}`)
    : falhou('a rodinha não aproximou');

  // 16:9 numa câmera 4:3: o quadro deita
  await page.locator('.ajuste-regua', { hasText: 'Zoom' }).locator('input').fill('1');
  await page.getByRole('button', { name: 'Preencher 16:9' }).click();
  (await esperarTamanho('(v) => v && Math.abs(v.videoWidth / v.videoHeight - 16 / 9) < 0.02'))
    ? ok(`"Preencher 16:9" deita a imagem: ${JSON.stringify(await tamanhoDaPrevia())}`)
    : falhou(`o 16:9 não valeu: ${JSON.stringify(await tamanhoDaPrevia())}`);

  await page.locator('.ajuste-espelhar input').check();
  await page.locator('.ajuste-regua', { hasText: 'Claridade' }).locator('input').fill('0.6');
  await page.waitForTimeout(800);
  await page.locator('.previa-da-camera').screenshot({ path: 'e2e/fotos/ajustes-da-camera.png' });

  // numa sala: a câmera publicada sai com o ajuste (16:9)
  await page.keyboard.press('Escape');
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  await page.locator('.stage-controls button[aria-label="Ligar câmera"]').click();
  const naSala = await page
    .waitForFunction(() => [...document.querySelectorAll('video[data-lk-source="camera"]')].some((v) => v.videoWidth > 0 && Math.abs(v.videoWidth / v.videoHeight - 16 / 9) < 0.02), null, { timeout: 20000 })
    .then(() => true, () => false);
  naSala ? ok('numa sala, a câmera publicada sai com o ajuste (16:9)') : falhou('a câmera da sala não saiu ajustada');

  // "Voltar ao padrão" desfaz, e a câmera da sala volta como vem (o processador sai)
  await abrirAjustes();
  await page.getByRole('button', { name: 'Voltar ao padrão' }).click();
  await page.keyboard.press('Escape');
  const voltou = await page
    .waitForFunction(() => [...document.querySelectorAll('video[data-lk-source="camera"]')].some((v) => v.videoWidth > 0 && Math.abs(v.videoWidth / v.videoHeight - 4 / 3) < 0.02), null, { timeout: 15000 })
    .then(() => true, () => false);
  voltou ? ok('"Voltar ao padrão" devolve a câmera como vem (4:3)') : falhou('a câmera não voltou ao tamanho original');
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  await browser.close();
  resumo('ajustes da imagem da câmera');
}
