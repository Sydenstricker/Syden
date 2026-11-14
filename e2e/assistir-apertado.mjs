// QUEM ASSISTE SEM FOCO COM O COMPUTADOR APERTADO (14/11/2026; a regra em web/src/apertoDeQuemAssiste.ts). O que só uma
// transmissão de verdade prova, e o quanto economiza:
//
// 1. Sem foco e com o computador folgado, a imagem continua a maior (quem só assiste no segundo monitor não perde nada).
// 2. Sem foco e com o processador apertado (a pressão simulada: ver PRESSAO_FALSA), ela desce à versão de 540p.
// 3. O processador que o navegador de quem ASSISTE gasta, em 1080p e em 540p, sem carga nas duas medidas.
// 4. Folgado por ~20 s, volta à maior; e com o foco, também.
//
// Quem transmite e quem assiste ficam em NAVEGADORES separados, para o processador de quem assiste ser contado sozinho
// (SystemInfo.getProcessInfo soma os processos de um navegador). O Chrome dos testes não tem placa: a transmissão sai em
// VP8 e é decodificada pelo processador, o pior caso, que é o do relato.
//
//   node e2e/assistir-apertado.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const s = Date.now().toString().slice(-5);

const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const W = 1920, H = 1080;
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const ctx = canvas.getContext('2d');
    const bolas = Array.from({ length: 40 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53) % H, vx: ((i % 7) - 3) * 4, vy: ((i % 5) - 2) * 4, r: 6 + (i % 30), h: (i * 37) % 360 }));
    setInterval(() => {
      for (let y = 0; y < H; y += 60) for (let x = 0; x < W; x += 60) {
        ctx.fillStyle = ((x + y) / 60) % 2 < 1 ? '#2b4' : '#3a5';
        ctx.fillRect(x, y, 60, 60);
      }
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      for (let y = 30; y < H; y += 90) ctx.fillText('PLACAR 1234  VIDA 87  MUNIÇÃO 30/90', 20, y);
      for (const b of bolas) {
        b.x = (b.x + b.vx + W) % W;
        b.y = (b.y + b.vy + H) % H;
        ctx.fillStyle = `hsl(${b.h} 80% 55%)`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, 7);
        ctx.fill();
      }
    }, 1000 / 15);
    return canvas.captureStream(15); // 15 e não 30: com 30, o próprio teste saturava a máquina (dois navegadores em VP8 pelo processador)
  };
};

async function entrar(nome, viewport, preparo = null) {
  const { browser, contexto } = await abrirNavegador({ viewport, permissoes: ['microphone'] });
  const page = vigiar(await contexto.newPage());
  await page.addInitScript(TELA_FALSA);
  if (preparo) await page.addInitScript(preparo);
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return { browser, page };
}

/** O tempo de processador somado de todos os processos de um navegador (segundos). */
async function tempoDeProcessador(cdp) {
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
  return processInfo.reduce((soma, p) => soma + p.cpuTime, 0);
}

/** Núcleos de processador que o navegador gastou, em média, durante `ms`. */
async function nucleos(cdp, pagina, ms) {
  const a = await tempoDeProcessador(cdp);
  await pagina.waitForTimeout(ms);
  return (await tempoDeProcessador(cdp) - a) / (ms / 1000);
}

const tamanho = (pagina) => pagina.locator('.stage-main video').first().evaluate((el) => el.videoWidth);
const esperarTamanho = (pagina, largura, ms) =>
  pagina
    .waitForFunction((l) => document.querySelector('.stage-main video')?.videoWidth === l, largura, { timeout: ms, polling: 500 })
    .then(() => true, () => false);

/** A pressão do processador da Bia, controlada pelo teste (window.pressaoDoTeste). A API de verdade foi medida à parte
 * num Chrome real (entrega a leitura sem foco com o microfone aberto); aqui ela é simulada porque o próprio teste, com dois
 * navegadores codificando e decodificando 1080p pelo processador, ocupa de 50% a 97% da máquina, e o computador nunca
 * ficaria folgado. */
const PRESSAO_FALSA = () => {
  window.pressaoDoTeste = 'nominal';
  window.PressureObserver = class {
    constructor(cb) { this.cb = cb; }
    async observe() { this.t = setInterval(() => this.cb([{ state: window.pressaoDoTeste }]), 1000); }
    disconnect() { clearInterval(this.t); }
  };
};
const pressao = (pagina, valor) => pagina.evaluate((v) => (window.pressaoDoTeste = v), valor);

const navegadores = [];
try {
  const ana = await entrar('ana' + s, { width: 1400, height: 900 });
  const bia = await entrar('bia' + s, { width: 1600, height: 1000 }, PRESSAO_FALSA);
  navegadores.push(ana.browser, bia.browser);
  ok('as duas entraram na Sala 2, cada uma no seu navegador');
  const cdpBia = await bia.browser.newBrowserCDPSession();

  await ana.page.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await ana.page.locator('.screenshare-option').first().click();
  await bia.page.locator('.stream-invite', { hasText: 'ana' + s }).getByRole('button', { name: 'Assistir' }).click();
  await bia.page.locator('.stage-main video').first().waitFor({ timeout: 20000 });
  (await esperarTamanho(bia.page, 1920, 60000)) ? ok('a Bia assiste num quadro grande e recebe 1920×1080') : falhou('a Bia não chegou a 1080p: ' + (await tamanho(bia.page)));

  // A Bia perde o foco (o jogo no outro monitor). Folgada, nada muda.
  await bia.page.evaluate(() => {
    document.hasFocus = () => false;
  });
  const perdas = [];
  const espiar = setInterval(() => void bia.page.evaluate(() => window.apertoDeQuemAssiste?.perda).then((p) => perdas.push(p), () => {}), 1000);
  const nucleos1080 = await nucleos(cdpBia, bia.page, 20000);
  clearInterval(espiar);
  console.log('  perda de quadros a cada segundo, sem foco e folgada:', perdas.map((p) => (p == null ? '-' : Math.round(p * 100) + '%')).join(' '));
  (await tamanho(bia.page)) === 1920
    ? ok(`sem foco e folgada, continua em 1080p (o navegador dela gasta ${nucleos1080.toFixed(2)} núcleo)`)
    : falhou('sem foco e folgada, caiu para ' + (await tamanho(bia.page)) + ' ' + (await bia.page.evaluate(() => JSON.stringify(window.apertoDeQuemAssiste))));

  // "fair" por pouco tempo não basta; "serious" desce.
  await pressao(bia.page, 'fair');
  await bia.page.waitForTimeout(3000);
  (await tamanho(bia.page)) === 1920 ? ok('"fair" por 3 s não desce') : falhou('desceu com "fair" por 3 s');
  await pressao(bia.page, 'serious');
  (await esperarTamanho(bia.page, 960, 20000)) ? ok('com o processador apertado, a imagem desceu a 960×540') : falhou('apertado, ficou em ' + (await tamanho(bia.page)));

  // O mesmo quadro, a mesma máquina, a versão de 540p.
  await bia.page.waitForTimeout(2000);
  const nucleos540 = await nucleos(cdpBia, bia.page, 20000);
  (await tamanho(bia.page)) === 960
    ? ok(`em 540p o navegador dela gasta ${nucleos540.toFixed(2)} núcleo, contra ${nucleos1080.toFixed(2)} em 1080p (${(nucleos1080 - nucleos540).toFixed(2)} a menos, ${Math.round((1 - nucleos540 / nucleos1080) * 100)}%)`)
    : falhou('subiu durante a medida: ' + (await tamanho(bia.page)));

  // Folgada, volta depois de ~20 s, e não antes.
  await pressao(bia.page, 'nominal');
  await bia.page.waitForTimeout(12000);
  (await tamanho(bia.page)) === 960 ? ok('folgada há 12 s, ainda na menor') : falhou('voltou antes da folga: ' + (await tamanho(bia.page)));
  (await esperarTamanho(bia.page, 1920, 40000)) ? ok('folgada por ~20 s, voltou a 1920×1080') : falhou('não voltou à maior: ' + (await tamanho(bia.page)));

  // Apertou de novo: fica na menor mesmo folgada; o foco devolve a maior.
  await pressao(bia.page, 'serious');
  const desceuDeNovo = await esperarTamanho(bia.page, 960, 20000);
  await pressao(bia.page, 'nominal');
  await bia.page.waitForTimeout(30000);
  desceuDeNovo && (await tamanho(bia.page)) === 960
    ? ok('apertou de novo depois de voltar: ficou na menor, mesmo folgada por 30 s (sem subir e descer)')
    : falhou(`o segundo aperto: desceu=${desceuDeNovo}, agora ${await tamanho(bia.page)}`);
  await bia.page.evaluate(() => {
    delete document.hasFocus;
  });
  (await esperarTamanho(bia.page, 1920, 20000)) ? ok('com o foco de volta, voltou a 1080p') : falhou('com o foco, ficou em ' + (await tamanho(bia.page)));
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  for (const b of navegadores) await b.close().catch(() => {});
}
resumo();
