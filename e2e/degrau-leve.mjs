// O DEGRAU LEVE DO PADRÃO (12/11/2026; ver proximoLeve e telaEmMovimento em web/src/streamStats.ts). A Ana transmite uma
// "tela" de 1080p (um canvas, NUNCA a tela real) e o processador dela "aperta". O aperto é SIMULADO (window.apertoDeTeste,
// só no site de desenvolvimento): o estrangulamento do Chrome (CDP) não serve, porque uma vez aperta e outra não, e porque
// para a página inteira, e com ela o "jogo" desenhado nela (medido: de 30 para 2 a 5 mudanças por segundo; um vídeo
// tocando caiu a 0,1), o que um jogo de verdade, noutro programa, não sofre. Que o navegador acusa o aperto de processador
// mesmo segurando os 30 quadros foi visto com o estrangulamento a 20× (12/11/2026). Dois perfis, o mesmo aperto:
//
// 1. TELA (CENA=tela): Configurações quase paradas, só o cursor piscando. O aperto leva a transmissão que a Bia recebe a
//    720p, no máximo 15 quadros, em vez de encolher até o texto sumir.
//    Depois a tela vira jogo (quem terminou de ajudar abre o jogo sem parar de transmitir), e o leve sai sozinho.
// 2. JOGO (CENA=jogo): a tela muda a cada quadro. O mesmo aperto NÃO liga o leve: para o jogador, segurar os quadros e
//    encolher a imagem continua o certo.
//
//   node e2e/degrau-leve.mjs              (os dois; API de teste na 3099, site na 5174 e LiveKit local)
//   CENA=jogo node e2e/degrau-leve.mjs    (um só)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

const TELA_FALSA = (cena) => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    const texto = (cursor) => {
      ctx.fillStyle = '#f4f1ea';
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.fillStyle = '#222';
      ctx.font = '14px sans-serif';
      for (let l = 0; l < 60; l++) ctx.fillText('Configurações › Impressoras e scanners › Adicionar dispositivo: instale o Driver Básico (Recomendado) e clique em Avançar.', 20, 20 + l * 17);
      if (cursor) ctx.fillRect(700, 500, 2, 16);
    };
    // Um "jogo": tudo se mexe, a tela muda a cada quadro. A tela de Configurações vira jogo também quando o teste pede
    // (window.virarJogo), como quem termina de ajudar e abre o jogo sem parar de transmitir.
    let t = 0;
    let ligado = true;
    const jogo = () => {
      t++;
      ctx.fillStyle = 'hsl(' + ((t * 3) % 360) + ' 60% 40%)';
      ctx.fillRect(0, 0, 1920, 1080);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = 'hsl(' + ((i * 37 + t * 5) % 360) + ' 80% 60%)';
        ctx.fillRect((i * 97 + t * 13) % 1920, (i * 53 + t * 7) % 1080, 120, 120);
      }
    };
    if (cena === 'jogo') setInterval(jogo, 1000 / 30);
    else {
      // Configurações: parada, com o cursor piscando 3 vezes por segundo (só redesenha quando muda, como a captura).
      texto(ligado);
      setInterval(() => !window.virarJogo && texto((ligado = !ligado)), 333);
      setInterval(() => window.virarJogo && jogo(), 1000 / 30);
    }
    return canvas.captureStream(30);
  };
};

async function entrar(nome, cena) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const page = vigiar(await ctx.newPage());
  await page.addInitScript(TELA_FALSA, cena);
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

/** O que chega na Bia: a altura do vídeo e os quadros por segundo medidos em 4 s. */
async function recebido(page) {
  return page.locator('.stage-main video').first().evaluate(async (v) => {
    const antes = v.getVideoPlaybackQuality().totalVideoFrames;
    await new Promise((r) => setTimeout(r, 4000));
    return { altura: v.videoHeight, fps: (v.getVideoPlaybackQuality().totalVideoFrames - antes) / 4 };
  });
}

async function cenario(cena) {
  const ana = await entrar(`ana${cena}${s}`, cena);
  const bia = await entrar(`bia${cena}${s}`, cena);
  try {
    await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
    await ana.locator('.screenshare-option').first().click();
    await ana.locator('.stage-main video').first().waitFor({ timeout: 20000 });
    const convite = bia.locator('.stream-invite', { hasText: `ana${cena}${s}` });
    await convite.waitFor({ timeout: 20000 });
    await convite.getByRole('button', { name: 'Assistir' }).click();
    await bia.locator('.stage-main video').first().waitFor({ timeout: 20000 });
    await bia.waitForTimeout(10000);
    ok(`[${cena}] antes do aperto, a Bia recebe ${JSON.stringify(await recebido(bia))}; a tela muda ${await ana.evaluate(() => window.quadrosDaTela?.toFixed?.(1))} vezes por segundo`);

    const apertouEm = await ana.evaluate(() => ((window.apertoDeTeste = 'cpu'), Date.now()));

    // A transição: de quarto em quarto de segundo, até o leve ligar (ou 30 s, no jogo).
    const mudancas = [];
    for (let i = 0; i < 120 && !(await ana.evaluate(() => window.transmissaoNoLeve?.ligado)); i++) {
      await ana.waitForTimeout(250);
      if (i % 4 === 3) mudancas.push(await ana.evaluate(() => window.quadrosDaTela?.toFixed?.(1) ?? null));
    }
    const pedido = await ana.evaluate(() => window.transmissaoNoLeve ?? null);
    const ultimo = await recebido(bia);
    if (cena === 'jogo') {
      !pedido?.ligado
        ? ok(`[jogo] com o processador apertado, o leve NÃO ligou (a tela mudando ${mudancas.join(', ')} vezes por segundo); a Bia recebe ${ultimo.altura}p a ${ultimo.fps.toFixed(1)} fps`)
        : falhou(`[jogo] o leve ligou no jogo: ${JSON.stringify(pedido)} (mudanças: ${mudancas.join(', ')})`);
    } else {
      const entrou = pedido ? (pedido.quando - apertouEm) / 1000 : null;
      pedido?.ligado && pedido.preferencia === 'maintain-resolution' && pedido.versoes.every((v) => v.fps <= 15) && entrou <= 5
        ? ok(`[tela] o leve ligou em ${entrou.toFixed(1)} s (a tela mudando ${mudancas.join(', ')} vezes por segundo): ${JSON.stringify(pedido)}`)
        : falhou(`[tela] o leve não ligou em até 5 s (${entrou} s): ${JSON.stringify(pedido)} (mudanças: ${mudancas.join(', ')})`);
      const depois = await recebido(bia);
      depois.altura <= 720 && depois.altura >= 540
        ? ok(`[tela] a Bia recebe ${depois.altura}p a ${depois.fps.toFixed(1)} fps`)
        : falhou(`[tela] a Bia recebe ${JSON.stringify(depois)}`);

      // Abriu o jogo: o aperto continua (simulado, para o desenho não parar), e a tela passa a mudar sempre.
      const virouEm = await ana.evaluate(() => ((window.virarJogo = true), Date.now()));
      const noJogo = [];
      for (let i = 0; i < 60 && (await ana.evaluate(() => window.transmissaoNoLeve?.ligado)); i++) {
        await ana.waitForTimeout(250);
        if (i % 4 === 3) noJogo.push(await ana.evaluate(() => window.quadrosDaTela?.toFixed?.(1) ?? null));
      }
      const saiu = await ana.evaluate(() => window.transmissaoNoLeve ?? null);
      const saiuEm = saiu ? (saiu.quando - virouEm) / 1000 : null;
      saiu && !saiu.ligado && saiu.preferencia === 'maintain-framerate' && saiuEm <= 4
        ? ok(`[tela] virou jogo (a tela mudando ${noJogo.join(', ')} vezes por segundo): o leve saiu sozinho em ${saiuEm.toFixed(1)} s, ${JSON.stringify(saiu)}`)
        : falhou(`[tela] virou jogo e o leve não saiu em até 4 s (${saiuEm} s): ${JSON.stringify(saiu)} (mudanças: ${noJogo.join(', ')})`);
    }
  } finally {
    await ana.context().close();
    await bia.context().close();
  }
}

try {
  for (const cena of process.env.CENA ? [process.env.CENA] : ['tela', 'jogo']) await cenario(cena);
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('o degrau leve do Padrão');
}
