// O PALCO DA CHAMADA: tela cheia com as câmeras, fixar qualquer quadro, todos do mesmo tamanho e a transmissão numa
// janela à parte (relato de 04/11/2026: "a tela cheia do Syden não mostra as webcams da chamada; seria legal uma
// opção tipo Meet de pinar a maior tela ou ficar com todas do mesmo tamanho; e pop-out que nem no Discord").
//
// A ana transmite (um canvas, NUNCA a tela real), a cid liga a câmera (a falsa do Chrome) e a bia assiste. Do lado
// da bia:
//   1. clicar na câmera da cid, na faixa de baixo, a leva para o quadro grande (antes não fazia nada);
//   2. "Todos do mesmo tamanho" põe a transmissão e as câmeras na mesma grade, e clicar num quadro volta ao destaque;
//   3. a tela cheia leva o PALCO, com a faixa de câmeras, e o menu do botão direito aparece dentro dela;
//   4. a transmissão abre numa janela à parte, continua aberta quando o palco muda, e vem na camada GRANDE mesmo com
//      o quadro de origem pequeno na faixa (a janela é contada pelo LiveKit, e não só copiada).
//
//   node e2e/palco-da-chamada.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador({ argsExtras: ['--autoplay-policy=no-user-gesture-required'] });
const s = Date.now().toString().slice(-5);

/** No lugar da tela real: um canvas que mexe, em 1280 × 720. */
const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      ctx.fillStyle = `hsl(${(n += 5) % 360} 60% 35%)`;
      ctx.fillRect(0, 0, 1280, 720);
    }, 1000 / 15);
    return canvas.captureStream(15);
  };
};

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone', 'camera'] });
  const page = vigiar(await ctx.newPage());
  await page.addInitScript(TELA_FALSA);
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  // O banco é o de teste (3099), separado do de desenvolvimento: a Sala 2 dele é só deste teste.
  await page.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

const quadroGrande = (page) => page.locator('.stage-focus > .stage-main');

try {
  const ana = await entrar('ana' + s);
  const cid = await entrar('cid' + s);
  const bia = await entrar('bia' + s);

  await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await ana.locator('.screenshare-option').first().click();
  await cid.locator('.stage-controls button[aria-label="Ligar câmera"]').click();
  const convite = bia.locator('.stream-invite', { hasText: 'ana' + s });
  await convite.waitFor({ timeout: 20000 });
  await convite.getByRole('button', { name: 'Assistir' }).click();
  await quadroGrande(bia).locator('video[data-lk-source="screen_share"]').waitFor({ timeout: 20000 });
  const camDaCid = bia.locator('.stage-strip .tile', { has: bia.locator('video[data-lk-source="camera"]') }).first();
  await camDaCid.waitFor({ timeout: 20000 });
  ok('a ana transmite, a cid está com a câmera ligada, e a bia assiste');

  // 1. Fixar a câmera de outra pessoa.
  await camDaCid.click();
  (await quadroGrande(bia).locator('video[data-lk-source="camera"]').waitFor({ timeout: 5000 }).then(() => true, () => false))
    ? ok('clicar na câmera da cid a leva para o quadro grande')
    : falhou('a câmera da cid não foi para o quadro grande');
  (await bia.locator('.stage-strip video[data-lk-source="screen_share"]').count()) === 1
    ? ok('e a transmissão desce para a faixa, sem fechar')
    : falhou('a transmissão sumiu ao fixar a câmera');

  // 4. A janela à parte: aberta com a câmera fixada, a transmissão está pequena na faixa. Precisa vir na camada grande.
  //    Primeiro volta a transmissão para o quadro grande (é lá que fica o botão dela).
  await quadroGrande(bia).locator('.tile').click();
  await quadroGrande(bia).locator('video[data-lk-source="screen_share"]').waitFor({ timeout: 5000 });
  const destacar = quadroGrande(bia).locator('.stream-controls button[aria-label="Abrir em outra janela"]');
  (await destacar.count()) === 1 ? ok('a transmissão tem o botão de abrir em outra janela') : falhou('a transmissão não tem o botão de pop-out');
  const temApi = await bia.evaluate(() => typeof window.documentPictureInPicture?.requestWindow === 'function');
  if (!temApi) {
    falhou('este Chrome não tem a Document Picture-in-Picture API: o pop-out não pôde ser medido');
  } else {
    await quadroGrande(bia).hover();
    await destacar.click();
    const abriu = await bia
      .waitForFunction(() => {
        const v = window.documentPictureInPicture.window?.document.querySelector('video');
        return v && v.videoWidth > 0 && !v.paused;
      }, null, { timeout: 10000 })
      .then(() => true, () => false);
    abriu ? ok('a transmissão abriu numa janela à parte, tocando') : falhou('a janela à parte não abriu com o vídeo tocando');

    // O palco muda (a cid fixada): a janela continua, e a transmissão, agora miniatura na faixa, segue grande nela.
    await camDaCid.click();
    await quadroGrande(bia).locator('video[data-lk-source="camera"]').waitFor({ timeout: 5000 });
    await bia.waitForTimeout(6000);
    const naJanela = await bia.evaluate(() => {
      const v = window.documentPictureInPicture.window?.document.querySelector('video');
      const faixa = document.querySelector('.stage-strip video[data-lk-source="screen_share"]');
      return v ? { altura: v.videoHeight, tocando: !v.paused, naFaixa: faixa?.clientHeight ?? 0 } : null;
    });
    naJanela ? ok('mexer no palco não fecha a janela à parte') : falhou('fixar outra pessoa fechou a janela à parte');
    naJanela && naJanela.altura >= 700
      ? ok(`e ela vem na camada grande (${naJanela.altura}p), com o quadro de origem a ${naJanela.naFaixa}px na faixa`)
      : falhou(`a janela à parte veio na camada pequena: ${JSON.stringify(naJanela)}`);
    // Fixada a cid, a transmissão está na faixa, e o botão dela só existe no quadro grande: ela volta para lá.
    await bia.locator('.stage-strip .tile', { has: bia.locator('video[data-lk-source="screen_share"]') }).click();
    const aceso = quadroGrande(bia).locator('.stream-controls button.ativo[aria-label="Trazer de volta para esta janela"]');
    (await aceso.waitFor({ timeout: 5000 }).then(() => true, () => false))
      ? ok('de volta ao quadro grande, o botão está aceso: a janela é dela')
      : falhou('o botão não ficou aceso com a janela aberta');
    await bia.evaluate(() => window.documentPictureInPicture.window?.close());
    await bia.waitForTimeout(500);
    (await aceso.count()) === 0 ? ok('fechar a janela apaga o botão aceso') : falhou('o botão ficou aceso com a janela fechada');
  }

  // 2. Todos do mesmo tamanho.
  await bia.locator('.stage-controls button[aria-label="Todos do mesmo tamanho"]').click();
  const mosaico = bia.locator('.stage-mosaico > .stage-main');
  await mosaico.first().waitFor({ timeout: 5000 });
  const medidas = await mosaico.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)));
  const temOsDois =
    (await bia.locator('.stage-mosaico video[data-lk-source="screen_share"]').count()) === 1 &&
    (await bia.locator('.stage-mosaico video[data-lk-source="camera"]').count()) >= 1;
  temOsDois && new Set(medidas).size === 1
    ? ok(`"Todos do mesmo tamanho": transmissão e câmeras na mesma grade, ${medidas.length} quadros de ${medidas[0]}px`)
    : falhou(`a grade não igualou: larguras ${medidas.join(', ')}, transmissão e câmera juntas: ${temOsDois}`);
  (await bia.locator('.stage-strip').count()) === 0 ? ok('e não sobra faixa embaixo') : falhou('a faixa continuou na grade');
  (await bia
    .waitForFunction(() => {
      const v = document.querySelector('.stage-mosaico video[data-lk-source="screen_share"]');
      return v && v.videoWidth > 0 && !v.paused && v.readyState >= 2;
    }, null, { timeout: 8000 })
    .then(() => true, () => false))
    ? ok('e a transmissão continua tocando dentro da grade')
    : falhou('na grade a transmissão ficou sem imagem');
  await bia.screenshot({ path: 'e2e/fotos/palco-todos-iguais.png' });
  await bia.locator('.stage-mosaico .tile', { has: bia.locator('video[data-lk-source="screen_share"]') }).click();
  (await quadroGrande(bia).locator('video[data-lk-source="screen_share"]').waitFor({ timeout: 5000 }).then(() => true, () => false))
    ? ok('clicar num quadro da grade volta ao destaque com ele')
    : falhou('clicar na grade não voltou ao destaque');

  // 3. Tela cheia com as câmeras.
  await bia.locator('.stage').hover();
  await bia.locator('.stage > .fullscreen-button').click();
  const cheia = await bia
    .waitForFunction(() => document.fullscreenElement?.classList.contains('stage'), null, { timeout: 5000 })
    .then(() => true, () => false);
  cheia ? ok('a tela cheia leva o palco inteiro') : falhou('a tela cheia não foi para o palco: ' + (await bia.evaluate(() => document.fullscreenElement?.className ?? 'nenhuma')));
  if (cheia) {
    await bia.waitForTimeout(500);
    const camVisivel = await bia.evaluate(() => {
      const v = document.fullscreenElement.querySelector('.stage-strip video[data-lk-source="camera"]');
      if (!v) return false;
      const r = v.getBoundingClientRect();
      return r.width > 100 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.stage-strip') !== null;
    });
    camVisivel ? ok('e a câmera da cid aparece na faixa, dentro da tela cheia') : falhou('na tela cheia a câmera da cid não aparece');
    const botoes = await bia.evaluate(() => document.fullscreenElement.querySelector('.stage-controls') !== null);
    botoes ? ok('com os botões da chamada à mão') : falhou('os botões da chamada ficaram fora da tela cheia');
    await bia.screenshot({ path: 'e2e/fotos/palco-tela-cheia.png' });
    await bia.locator('.stage-strip .tile', { has: bia.locator('video[data-lk-source="camera"]') }).first().click({ button: 'right' });
    const menuDentro = await bia
      .waitForFunction(() => document.fullscreenElement?.querySelector('.person-menu') !== null, null, { timeout: 5000 })
      .then(() => true, () => false);
    menuDentro ? ok('o menu do botão direito abre dentro da tela cheia') : falhou('o menu do botão direito abriu atrás da tela cheia');
    await bia.keyboard.press('Escape');
    await bia.evaluate(() => document.fullscreenElement && document.exitFullscreen());
    (await bia.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5000 }).then(() => true, () => false))
      ? ok('e sai da tela cheia')
      : falhou('não saiu da tela cheia');
  }
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  await browser.close();
  resumo('o palco da chamada');
}
