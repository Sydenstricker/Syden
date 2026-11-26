// A CAIXA DE ITEM EM FATIAS (26/11/2026): a auditoria antes de ir ao ar. Pelo computador do quarto, com o piloto automático:
//
// - a Corrida dos coelhos CONTRA O COMPUTADOR (a corrida do Solo que tem caixas), na Horta: folhas de quadros passando
//   pela primeira fileira de caixas, DEPOIS (em fatias) e ANTES (localStorage 'syden.caixaFatias' = 'nao', a figura de frente);
// - o Estoura-balão no Solo, as caixas da arena, depois e antes.
//
//   node e2e/caixa-em-fatias.mjs   (API de teste na 3099 e site na 5174; o LiveKit não é preciso)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = path.join('e2e', 'fotos', 'caixa-em-fatias');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador();

async function abrirJogo(p, nome) {
  await p.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await p.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  await p.locator('.jogos-painel .jogos-solo button', { hasText: nome }).click();
}

/** Copia a tela do jogo a cada `ms` numa grade e salva a folha. */
async function folha(p, arquivo, { quadros = 24, ms = 140, colunas = 6 } = {}) {
  const url = await p.evaluate(
    ({ quadros, ms, colunas }) =>
      new Promise((ok) => {
        const tela = [...document.querySelectorAll('.jogos-painel canvas, .minijogo canvas, canvas')].find((c) => (c.width === 640 && c.height === 360));
        const esc = 1;
        const f = document.createElement('canvas');
        f.width = colunas * 640 * esc;
        f.height = Math.ceil(quadros / colunas) * 360 * esc;
        const g = f.getContext('2d');
        g.imageSmoothingEnabled = false;
        let i = 0;
        const id = setInterval(() => {
          g.drawImage(tela, (i % colunas) * 640 * esc, Math.floor(i / colunas) * 360 * esc, 640 * esc, 360 * esc);
          if (++i >= quadros) {
            clearInterval(id);
            ok(f.toDataURL('image/png'));
          }
        }, ms);
      }),
    { quadros, ms, colunas },
  );
  fs.writeFileSync(path.join(FOTOS, arquivo), Buffer.from(url.split(',')[1], 'base64'));
}

async function corrida(p, sufixo) {
  await abrirJogo(p, 'Corrida dos coelhos');
  await p.locator('.corrida-largada, [role="tab"]').first().waitFor({ timeout: 10000 });
  await p.getByRole('tab', { name: /Contra o computador/ }).click();
  await p.evaluate(() => (window.corridaPilotoAutomatico = true));
  await p.getByRole('button', { name: 'Começar', exact: true }).click();
  await p.locator('.corrida-tela canvas').waitFor({ timeout: 15000 });
  // o semáforo (~3 s) e a reta até a primeira fileira, a 30% da volta (~6 s)
  await p.waitForTimeout(9400);
  await folha(p, `corrida-${sufixo}.png`, { quadros: 30, ms: 110 });
  ok(`corrida: folha ${sufixo}`);
}

async function balao(p, sufixo) {
  await abrirJogo(p, 'Estoura-balão');
  await p.getByRole('button', { name: 'Começar', exact: true }).waitFor({ timeout: 10000 });
  await p.evaluate(() => (window.balaoPilotoAutomatico = true));
  await p.getByRole('button', { name: 'Começar', exact: true }).click();
  await p.waitForTimeout(4500);
  await folha(p, `balao-${sufixo}.png`, { quadros: 24, ms: 250 });
  ok(`balão: folha ${sufixo}`);
}

try {
  for (const [sufixo, ligada] of [['depois', true], ['antes', false]]) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    const p = vigiar(await ctx.newPage());
    await cadastrar(p, (ligada ? 'cxd' : 'cxa') + s);
    await dispensarPresentes(p);
    if (!ligada) await p.evaluate(() => localStorage.setItem('syden.caixaFatias', 'nao'));
    if (!ligada) await p.reload();
    await corrida(p, sufixo);
    await p.keyboard.press('Escape').catch(() => {});
    await p.reload();
    await balao(p, sufixo);
    await ctx.close();
  }
} catch (e) {
  falhou(String(e?.stack ?? e));
} finally {
  await browser.close();
  resumo();
}
