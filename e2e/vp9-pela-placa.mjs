// VP9 QUANDO A PLACA CODIFICA (11/10/2026). O automático pergunta ao computador se o VP9 sai pela placa e, se
// sai, transmite em VP9 — com as camadas de tamanho separadas (L1T3), e não com a camada única que o LiveKit usa
// por padrão para tela. Este teste prova o caminho numa transmissão de verdade:
//
// - a transmissão sai em VP9, em mais de uma camada;
// - quem assiste recebe a imagem, em VP9;
// - a nitidez da tela parada continua funcionando (no modo de camada única, o LiveKit forçaria 'motion').
//
// A máquina do teste pode não ter VP9 na placa (NVIDIA não tem): a página "diz" que tem, e o VP9 sai por
// software. O que se prova é o caminho, não a economia — essa depende da placa de quem transmite.
//
//   node e2e/vp9-pela-placa.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

const PREPARO = () => {
  window.__mover = true;
  window.__preferencias = [];
  window.__conexoes = [];
  // Toda conexão WebRTC da página fica à mão, para ler o que está saindo e chegando de verdade.
  const Original = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...args) {
    const pc = new Original(...args);
    window.__conexoes.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = Original.prototype;
  Object.setPrototypeOf(window.RTCPeerConnection, Original);
  // A placa "codifica VP9": é a resposta que faz o automático escolhê-lo.
  const perguntaOriginal = navigator.mediaCapabilities.encodingInfo.bind(navigator.mediaCapabilities);
  navigator.mediaCapabilities.encodingInfo = async (config) =>
    config?.video?.contentType === 'video/VP9' ? { supported: true, smooth: true, powerEfficient: true } : perguntaOriginal(config);
  const setParametersOriginal = RTCRtpSender.prototype.setParameters;
  RTCRtpSender.prototype.setParameters = function (parametros, ...resto) {
    if (this.track?.kind === 'video' && parametros?.degradationPreference) window.__preferencias.push(parametros.degradationPreference);
    return setParametersOriginal.call(this, parametros, ...resto);
  };
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      if (!window.__mover) return;
      ctx.fillStyle = `hsl(${(n += 7) % 360} 70% 50%)`;
      ctx.fillRect(0, 0, 1280, 720);
    }, 1000 / 30);
    ctx.fillStyle = '#345';
    ctx.fillRect(0, 0, 1280, 720);
    return canvas.captureStream(30);
  };
};

/** Os codecs e quantas camadas estão SAINDO (outbound) ou CHEGANDO (inbound) em vídeo, nesta página. */
const medir = (page, direcao) =>
  page.evaluate(async (tipo) => {
    const codecs = new Set();
    let camadas = 0;
    for (const pc of window.__conexoes) {
      if (pc.connectionState === 'closed') continue;
      const relatorio = await pc.getStats();
      const nomes = new Map();
      relatorio.forEach((e) => e.type === 'codec' && nomes.set(e.id, e.mimeType));
      relatorio.forEach((e) => {
        if (e.type !== tipo || e.kind !== 'video') return;
        if ((e.framesEncoded ?? e.framesDecoded ?? 0) === 0) return;
        camadas += 1;
        codecs.add(nomes.get(e.codecId));
      });
    }
    return { codecs: [...codecs], camadas };
  }, direcao);

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const page = vigiar(await ctx.newPage());
  await page.addInitScript(PREPARO);
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

try {
  const ana = await entrar('ana' + s);
  const bia = await entrar('bia' + s);
  ok('as duas entraram na Sala 2');

  await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await ana.locator('.screenshare-option').first().click();
  await bia.locator('.stream-invite', { hasText: 'ana' + s }).getByRole('button', { name: 'Assistir' }).click();
  await bia.locator('.stage-main video').first().waitFor({ timeout: 20000 });
  await ana.waitForTimeout(8000);

  const saindo = await medir(ana, 'outbound-rtp');
  saindo.codecs.length === 1 && saindo.codecs[0] === 'video/VP9'
    ? ok('a Ana transmite em VP9')
    : falhou('o que sai da Ana: ' + JSON.stringify(saindo.codecs));
  saindo.camadas >= 2 ? ok(`em camadas separadas (${saindo.camadas} saindo), e não numa só`) : falhou(`camadas saindo: ${saindo.camadas}`);

  const chegando = await medir(bia, 'inbound-rtp');
  chegando.codecs.includes('video/VP9') ? ok('e a Bia recebe e decodifica o VP9') : falhou('o que chega na Bia: ' + JSON.stringify(chegando));
  const tamanho = await bia.locator('.stage-main video').first().evaluate((v) => v.videoWidth);
  tamanho > 0 ? ok(`a imagem aparece para a Bia (${tamanho} px de largura)`) : falhou('o vídeo da Bia está sem imagem');

  // A nitidez da tela parada sobrevive ao VP9.
  await ana.evaluate(() => (window.__mover = false));
  await ana
    .waitForFunction(() => window.__preferencias.at(-1) === 'maintain-resolution', null, { timeout: 25000, polling: 500 })
    .then(
      () => ok('com a tela parada, o VP9 também passa a manter a resolução'),
      () => falhou('a nitidez da tela parada não ligou com VP9'),
    );
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('VP9 pela placa');
}
