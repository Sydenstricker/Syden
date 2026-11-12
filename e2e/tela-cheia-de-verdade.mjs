// A TELA CHEIA DE VERDADE (12/11/2026, sugestão de quem usa; ver styles.css e telaCheiaOciosa.ts). O que o teste prova,
// com a Ana transmitindo (um canvas, NUNCA a tela real) e a Bia assistindo em tela cheia:
//
// 1. Com a faixa de baixo à vista, ela continua no lugar dela, e os controles somem com o mouse parado (antes, a setinha
//    da faixa, aberta, segurava os controles na tela para sempre).
// 2. Escondida a faixa pela setinha, o quadro da transmissão ocupa a tela inteira: a barra e a setinha flutuam por cima.
// 3. Os botões da barra flutuante continuam clicáveis, e mexer o mouse os traz de volta.
//
//   node e2e/tela-cheia-de-verdade.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      n++;
      ctx.fillStyle = `hsl(${(n * 3) % 360} 60% 30%)`;
      ctx.fillRect(0, 0, 1280, 720);
    }, 1000 / 15);
    return canvas.captureStream(15);
  };
};

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const page = vigiar(await ctx.newPage());
  await page.addInitScript(TELA_FALSA);
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

const ocioso = (page) => page.locator('.stage').evaluate((el) => el.hasAttribute('data-ocioso'));
const caixa = (page, seletor) => page.locator(seletor).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});

try {
  const ana = await entrar('ana' + s);
  const bia = await entrar('bia' + s);
  await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await ana.locator('.screenshare-option').first().click();
  await ana.locator('.stage-main video').first().waitFor({ timeout: 20000 });
  const convite = bia.locator('.stream-invite', { hasText: 'ana' + s });
  await convite.waitFor({ timeout: 20000 });
  await convite.getByRole('button', { name: 'Assistir' }).click();
  await bia.locator('.stage-main video').first().waitFor({ timeout: 20000 });
  ok('a Bia assiste à transmissão da Ana');

  await bia.locator('.stage').hover();
  await bia.locator('.stage > .fullscreen-button').click();
  await bia.waitForFunction(() => document.fullscreenElement?.classList.contains('stage'), null, { timeout: 5000 });
  const tela = await bia.evaluate(() => ({ w: innerWidth, h: innerHeight }));

  // 1. Faixa à vista.
  (await bia.locator('.stage-strip').count()) > 0 ? ok('em tela cheia, a faixa de baixo está à vista') : falhou('sem faixa de baixo');
  await bia.mouse.move(700, 300);
  await bia.waitForTimeout(4000);
  (await ocioso(bia)) ? ok('com a faixa aberta, os controles somem com o mouse parado') : falhou('a setinha aberta segura os controles na tela');

  // 2. Faixa escondida.
  await bia.mouse.move(710, 310);
  await bia.locator('.stage-faixa-botao').click();
  await bia.waitForTimeout(500);
  const quadro = await caixa(bia, '.stage-main');
  quadro.x <= 1 && quadro.y <= 1 && quadro.w >= tela.w - 1 && quadro.h >= tela.h - 1
    ? ok(`com a faixa escondida, a transmissão ocupa a tela inteira (${quadro.w}×${quadro.h})`)
    : falhou(`o quadro não ocupa a tela: ${JSON.stringify(quadro)} em ${JSON.stringify(tela)}`);
  const barra = await caixa(bia, '.stage-controls');
  barra.y + barra.h <= tela.h && barra.y > tela.h - 120 ? ok('a barra flutua embaixo, dentro da tela') : falhou(`barra em ${JSON.stringify(barra)}`);
  const seta = await caixa(bia, '.stage-faixa-botao');
  seta.x + seta.w <= tela.w && seta.y + seta.h <= tela.h ? ok('a setinha fica no canto, dentro da tela') : falhou(`setinha em ${JSON.stringify(seta)}`);

  // 3. Os botões funcionam por cima da imagem.
  const mudo = bia.locator('.stage-controls button').first();
  const antes = await mudo.getAttribute('aria-label');
  await mudo.click();
  await bia.waitForTimeout(500);
  (await mudo.getAttribute('aria-label')) !== antes ? ok('o botão do microfone responde por cima da imagem') : falhou('o botão flutuante não respondeu');
  await mudo.click();

  await bia.mouse.move(700, 300);
  await bia.waitForTimeout(4000);
  (await ocioso(bia)) ? ok('parado, tudo some') : falhou('não sumiu com a faixa escondida');
  await bia.mouse.move(720, 320);
  await bia.waitForTimeout(400);
  !(await ocioso(bia)) ? ok('mexer o mouse traz de volta') : falhou('não voltou');

  await bia.locator('.stage-faixa-botao').click();
  (await bia.locator('.stage-strip').count()) > 0 ? ok('a setinha devolve a faixa') : falhou('a faixa não voltou');
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('a tela cheia de verdade');
}
