// O CAVALEIRO MONTADO DAS TOCAS E TORRES (24/11/2026), a pose do web/scripts/modelos/tocas-cozinha-carrinhos/cavaleiro.py:
// abre o desafio Ataque relâmpago (dois cavaleiros ao lado do centro), aproxima a câmera e fotografa. Só fotos.
//   node e2e/modelos-tocas.mjs   (API de teste e site de desenvolvimento)   SUFIXO=antes para a foto de antes
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos', 'modelos', 'tocas-cozinha-carrinhos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const sufixo = process.env.SUFIXO ?? 'depois';

const { browser } = await abrirNavegador();
try {
  const duda = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })).newPage());
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.locator('.rail-logo').click();
  const quarto = await (await duda.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await duda.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await duda.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = duda.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Tocas e Torres' }).click();
  await duda.locator('.tocas-desafio-relampago').click({ timeout: 15000 });
  const caixa = duda.locator('.tocas-caixa:not(.carregando)');
  await caixa.waitFor({ timeout: 60000 });
  await duda.waitForTimeout(1500);
  // a câmera mais perto, onde estão os cavaleiros (os dois primeiros 'cavaleiro' do meu exército)
  // só na tela deste teste: os dois cavaleiros vão para o lado direito do centro, à vista
  const alvo = await duda.evaluate(() => {
    const s = window.tocasPartidaDoTeste;
    const c = s.centros[0];
    const cav = s.unidades.filter((x) => x.tipo === 'cavaleiro' && x.dono === 0);
    cav.forEach((u, i) => {
      u.x = u.ax = c.gx + 4.4 + i * 1.4;
      u.rx = 1;
      u.ry = 0.35;
      u.y = u.ay = c.gy + 1.2 + i * 0.6;
    });
    return cav[0] ? { x: cav[0].x, y: cav[0].y } : null;
  });
  const r = await caixa.boundingBox();
  await duda.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  for (let i = 0; i < 12; i++) {
    await duda.mouse.wheel(0, -200);
    await duda.waitForTimeout(60);
  }
  await duda.waitForTimeout(1200);
  await caixa.screenshot({ path: path.join(FOTOS, `tocas-${sufixo}.png`) });
  await duda.screenshot({ path: path.join(FOTOS, `tocas-perto-${sufixo}.png`), clip: { x: r.x + r.width * 0.68, y: r.y + r.height * 0.38, width: r.width * 0.32, height: r.height * 0.42 } });
  ok('as tocas abriram' + (alvo ? ` (um cavaleiro em ${alvo.x.toFixed(1)}, ${alvo.y.toFixed(1)})` : ''));
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('cavaleiro montado');
}
