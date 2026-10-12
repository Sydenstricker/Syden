// A TELA PARADA PEDE NITIDEZ, E TROCAR DE TELA NÃO DERRUBA (11/10/2026). Duas mudanças da transmissão que só
// uma transmissão de verdade prova:
//
// 1. O Padrão percebe a imagem parada (site, slide, planilha) e passa a manter a RESOLUÇÃO, com o aviso de
//    conteúdo 'detail'; quando volta o movimento, volta a manter os QUADROS ('motion'). Era a pendência
//    "Texto borrado na transmissão" do CLAUDE.md. A medida é o que o navegador manda, lido de fora:
//    cada setParameters e cada contentHint é registrado na página.
// 2. "Trocar para…" e desistir no seletor deixa a transmissão no ar. Antes, a antiga já tinha caído.
//
// A tela é um canvas no lugar do getDisplayMedia. Um canvas só gera quadro quando é pintado — como a captura
// de tela, que só gera quadro quando algo muda —, então "parado" aqui é parado de verdade.
//
//   node e2e/tela-parada.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

const TELA_FALSA = () => {
  window.__mover = true;
  window.__recusar = false;
  window.__preferencias = [];
  window.__dicas = [];
  // O que a página pede ao navegador, registrado: é assim que o teste vê a decisão tomada.
  const original = RTCRtpSender.prototype.setParameters;
  RTCRtpSender.prototype.setParameters = function (parametros, ...resto) {
    if (this.track?.kind === 'video' && parametros?.degradationPreference) window.__preferencias.push(parametros.degradationPreference);
    return original.call(this, parametros, ...resto);
  };
  navigator.mediaDevices.getDisplayMedia = async () => {
    if (window.__recusar) throw new DOMException('Permission denied', 'NotAllowedError');
    const canvas = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      if (!window.__mover) return; // parado: nada é pintado, e nenhum quadro sai
      ctx.fillStyle = `hsl(${(n += 7) % 360} 70% 50%)`;
      ctx.fillRect(0, 0, 1280, 720);
    }, 1000 / 30);
    ctx.fillStyle = '#345';
    ctx.fillRect(0, 0, 1280, 720);
    const fluxo = canvas.captureStream(30);
    const faixa = fluxo.getVideoTracks()[0];
    // O contentHint é uma propriedade da faixa, não do sender: registrado à parte.
    let dica = '';
    Object.defineProperty(faixa, 'contentHint', {
      get: () => dica,
      set: (valor) => {
        dica = valor;
        window.__dicas.push(valor);
      },
    });
    return fluxo;
  };
};

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const page = vigiar(await ctx.newPage());
  await page.addInitScript(TELA_FALSA);
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

const ultima = (page) => page.evaluate(() => window.__preferencias.at(-1) ?? null);
const dica = (page) => page.evaluate(() => window.__dicas.at(-1) ?? null);
/** Espera a última preferência pedida virar `alvo`, por até `ms`. */
const esperar = (page, alvo, ms) =>
  page.waitForFunction((a) => window.__preferencias.at(-1) === a, alvo, { timeout: ms, polling: 500 }).then(
    () => true,
    () => false,
  );

try {
  const ana = await entrar('ana' + s);
  const bia = await entrar('bia' + s);
  ok('as duas entraram na Sala 2');

  await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await ana.locator('.screenshare-option').first().click();
  // Alguém precisa assistir: camada que ninguém vê é pausada, e camada pausada não diz nada da tela.
  await bia.locator('.stream-invite', { hasText: 'ana' + s }).getByRole('button', { name: 'Assistir' }).click();
  await bia.locator('.stage-main video').first().waitFor({ timeout: 20000 });
  ok('a Ana transmite e a Bia assiste');

  // Em movimento, o Padrão é o de jogo.
  await ana.waitForTimeout(9000);
  const emMovimento = await ultima(ana);
  emMovimento === 'maintain-framerate' || emMovimento === null
    ? ok(`em movimento, mantém os quadros (${emMovimento ?? 'o padrão da publicação'})`)
    : falhou('em movimento a transmissão está pedindo ' + emMovimento);

  // Parada: em umas duas ou três conferências (4 s cada), passa a manter a resolução.
  await ana.evaluate(() => (window.__mover = false));
  (await esperar(ana, 'maintain-resolution', 25000))
    ? ok('com a tela parada, passa a manter a resolução (texto nítido)')
    : falhou('a tela parada não ligou a nitidez: ' + (await ultima(ana)));
  (await dica(ana)) === 'detail' ? ok('e avisa o codificador que o conteúdo é de detalhe') : falhou('contentHint: ' + (await dica(ana)));

  // Movimento de novo: volta aos quadros, rápido.
  await ana.evaluate(() => (window.__mover = true));
  (await esperar(ana, 'maintain-framerate', 15000))
    ? ok('voltou o movimento: volta a manter os quadros')
    : falhou('o movimento não desligou a nitidez: ' + (await ultima(ana)));
  (await dica(ana)) === 'motion' ? ok("e o conteúdo volta a ser 'motion'") : falhou('contentHint: ' + (await dica(ana)));

  // Trocar de tela e desistir no seletor: a transmissão continua.
  await ana.evaluate(() => (window.__recusar = true));
  await ana.locator('.stage-controls button[aria-label="Opções da transmissão"]').click();
  await ana.locator('.screenshare-option').first().click();
  await ana.waitForTimeout(3000);
  (await ana.locator('.stage-controls button[aria-label="Opções da transmissão"]').count()) === 1
    ? ok('desistir no "Trocar para…" deixa a transmissão da Ana no ar')
    : falhou('a transmissão caiu ao desistir da troca');
  (await bia.locator('.stage-main video').count()) > 0 ? ok('e a Bia continua vendo') : falhou('a Bia perdeu a imagem');

  // Trocar de verdade: continua no ar, sem a Bia precisar abrir de novo.
  await ana.evaluate(() => (window.__recusar = false));
  await ana.locator('.stage-controls button[aria-label="Opções da transmissão"]').click();
  await ana.locator('.screenshare-option').first().click();
  await ana.waitForTimeout(3000);
  (await bia.locator('.stream-invite', { hasText: 'ana' + s }).count()) === 0 && (await bia.locator('.stage-main video').count()) > 0
    ? ok('trocar de tela não derruba: a Bia segue assistindo sem clicar de novo')
    : falhou('depois da troca, a Bia teve de abrir a transmissão de novo');
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('tela parada e troca de tela');
}
