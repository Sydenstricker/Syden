// O CELULAR COMO CÂMERA (23/11/2026, ver web/src/cameraDoCelular.ts): a ana, na chamada pelo computador, abre o QR code;
// o "celular" (outro navegador, com a câmera falsa do Chrome, numa tela de iPhone) abre o endereço; a câmera dele entra
// na chamada como a câmera da ana, e a bia a vê. Depois o celular para, e a câmera some.
//
//   node e2e/celular-como-camera.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone', 'camera'] });
  const page = vigiar(await ctx.newPage());
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

const cameraDaAnaNaBia = (bia) =>
  bia.evaluate(() => {
    const v = [...document.querySelectorAll('video[data-lk-source="camera"]')].find((el) => !el.closest('.tile')?.classList.contains('local'));
    return v ? { largura: v.videoWidth, tocando: !v.paused && v.readyState >= 2 } : null;
  });

try {
  const ana = await entrar('ana' + s);
  const bia = await entrar('bia' + s);

  await ana.locator('.stage-controls button[aria-label="Mais"]').click();
  await ana.locator('button[aria-label="Usar o celular como câmera"]').click();
  const qr = ana.locator('.celular-como-camera svg.celular-qr');
  await qr.waitFor({ timeout: 10000 });
  const endereco = await qr.getAttribute('aria-label');
  /#celular=[\w-]+\.[\w-]+\.[\w-]+$/.test(endereco ?? '')
    ? ok('a ana vê o QR code, com o par e o segredo depois do #')
    : falhou(`o endereço do QR code não tem o formato esperado: ${endereco}`);
  await ana.screenshot({ path: 'e2e/fotos/celular-como-camera-qr.png' });

  // O celular.
  const ctxCel = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, permissions: ['camera'] });
  const cel = vigiar(await ctxCel.newPage());
  // A câmera EM PÉ, como a de um celular de verdade (a falsa do Chromium é deitada): um canvas de 360 × 640 que muda de cor.
  await cel.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas');
      c.width = 360;
      c.height = 640;
      const g = c.getContext('2d');
      let n = 0;
      setInterval(() => {
        g.fillStyle = 'hsl(' + ((n += 7) % 360) + ' 70% 50%)';
        g.fillRect(0, 0, 360, 640);
      }, 66);
      return c.captureStream(15);
    };
  });
  await cel.goto(endereco);
  const aoVivo = cel.locator('.camera-do-celular-estado.ao-vivo');
  (await aoVivo.waitFor({ timeout: 20000 }).then(() => true, () => false))
    ? ok('o celular abre a câmera e liga ao computador')
    : falhou(`o celular não ficou ao vivo: "${await cel.locator('.camera-do-celular-estado').innerText().catch(() => '?')}"`);
  (await cel.evaluate(() => location.hash)) === ''
    ? ok('o segredo sai da barra de endereço do celular')
    : falhou('o segredo ficou na barra de endereço do celular');
  await cel.waitForTimeout(3000);
  await cel.screenshot({ path: 'e2e/fotos/celular-como-camera-celular.png' });

  // A janela do QR sai da frente, e o botão da câmera da ana fica aceso.
  (await ana.locator('.celular-como-camera').waitFor({ state: 'detached', timeout: 10000 }).then(() => true, () => false))
    ? ok('ao vivo, a janela do QR code sai da frente')
    : falhou('a janela do QR code continuou aberta com o celular ao vivo');
  (await ana.locator('.stage-controls button[aria-label="Desligar câmera"]').waitFor({ timeout: 10000 }).then(() => true, () => false))
    ? ok('o botão da câmera da ana fica aceso')
    : falhou('o botão da câmera da ana não acendeu');

  // A bia vê a câmera da ana, cifrada como sempre.
  const vista = await bia
    .waitForFunction(() => {
      const v = [...document.querySelectorAll('video[data-lk-source="camera"]')];
      return v.some((el) => el.videoWidth > 0 && !el.paused && el.readyState >= 2);
    }, null, { timeout: 25000 })
    .then(() => true, () => false);
  vista ? ok(`a bia vê a câmera do celular da ana: ${JSON.stringify(await cameraDaAnaNaBia(bia))}`) : falhou('a bia não recebeu a câmera do celular');
  await bia.screenshot({ path: 'e2e/fotos/celular-como-camera-bia.png' });
  // Em pé, a câmera aparece INTEIRA no quadro (sem cortar pelo meio), na bia e no próprio quadro da ana.
  for (const [quem, pagina] of [['bia', bia], ['ana', ana]]) {
    const inteira = await pagina
      .waitForFunction(() => [...document.querySelectorAll('video[data-lk-source="camera"]')].some((v) => v.videoHeight > v.videoWidth && getComputedStyle(v).objectFit === 'contain'), null, { timeout: 10000 })
      .then(() => true, () => false);
    inteira ? ok('a câmera em pé aparece inteira no quadro (' + quem + ')') : falhou('a câmera em pé saiu cortada no quadro (' + quem + ')');
  }

  // Virar a câmera não derruba nada.
  await cel.locator('.camera-do-celular-botoes button').first().click();
  await cel.waitForTimeout(1500);
  (await cel.locator('.camera-do-celular-estado.ao-vivo').count()) === 1
    ? ok('virar a câmera mantém o celular ao vivo')
    : falhou('virar a câmera derrubou o celular');

  // O celular para: a câmera some da chamada.
  await cel.locator('.camera-do-celular-botoes button.parar').click();
  (await cel.getByText('Pronto. Pode fechar esta página.').waitFor({ timeout: 5000 }).then(() => true, () => false))
    ? ok('parar no celular diz que pode fechar a página')
    : falhou('parar no celular não mostrou o fim');
  (await ana.locator('.stage-controls button[aria-label="Ligar câmera"]').waitFor({ timeout: 10000 }).then(() => true, () => false))
    ? ok('e a câmera da ana sai da chamada')
    : falhou('a câmera da ana continuou ligada depois de o celular parar');
  await ana.waitForTimeout(1000);
  (await ana.locator('.celular-como-camera').count()) === 0
    ? ok('parar de propósito não põe janela nenhuma na frente do computador')
    : falhou('parar no celular abriu uma janela no computador');

  // O mesmo endereço de novo: recusado.
  const cel2 = vigiar(await ctxCel.newPage());
  await cel2.goto(endereco);
  (await cel2.getByText('Este código já foi usado ou venceu. Peça outro no computador.').waitFor({ timeout: 10000 }).then(() => true, () => false))
    ? ok('o mesmo código não serve de novo')
    : falhou(`o código usado foi aceito de novo: "${await cel2.locator('.camera-do-celular-estado').innerText().catch(() => '?')}"`);

  // De novo, e agora desligando pelo botão da câmera do computador. (O menu Mais continua aberto: ele não se fecha sozinho.)
  if (!(await ana.locator('button[aria-label="Usar o celular como câmera"]').isVisible())) await ana.locator('.stage-controls button[aria-label="Mais"]').click();
  await ana.locator('button[aria-label="Usar o celular como câmera"]').click();
  await qr.waitFor({ timeout: 10000 });
  const cel3 = vigiar(await ctxCel.newPage());
  await cel3.goto(await qr.getAttribute('aria-label'));
  await cel3.locator('.camera-do-celular-estado.ao-vivo').waitFor({ timeout: 20000 });
  await ana.locator('.stage-controls button[aria-label="Desligar câmera"]').click();
  (await cel3.getByText('Pronto. Pode fechar esta página.').waitFor({ timeout: 8000 }).then(() => true, () => false))
    ? ok('desligar a câmera no computador solta o celular')
    : falhou('desligar a câmera no computador não soltou o celular');
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  await browser.close();
  resumo('o celular como câmera');
}
