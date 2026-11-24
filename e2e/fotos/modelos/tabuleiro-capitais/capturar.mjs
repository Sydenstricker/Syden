// Fotos do Tabuleiro da turma e das Capitais com os modelos nossos e sem eles (ANTES=1 bloqueia os GLB: as peças por código).
//   node e2e/fotos/modelos/tabuleiro-capitais/capturar.mjs [tabuleiro|cidades]   (API 3099, site 5174)
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from '../../../ajuda.mjs';

const FOTOS = path.join('e2e', 'fotos', 'modelos', 'tabuleiro-capitais');
const jogo = process.argv[2] ?? 'tabuleiro';
const sufixo = (process.env.SERRA ? 'serra-' : process.env.RIO ? 'rio-' : '') + (process.env.ANTES ? 'antes' : 'depois');
const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador();
let p;
try {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': `10.78.${Number(s) % 250}.${(Number(s) >> 3) % 250}` }, viewport: { width: 1400, height: 1000 } });
  if (process.env.ANTES) await ctx.route(/(tabuleiro3d\/.*\.glb|comum\/.*\.glb|nossos\/aviao\.glb)/, (r) => r.abort());
  p = vigiar(await ctx.newPage());
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await cadastrar(p, 'mod' + s);
  await dispensarPresentes(p);
  await p.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await p.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  await p.locator('.jogos-painel .jogos-solo button', { hasText: jogo === 'cidades' ? 'Capitais' : 'Tabuleiro da turma' }).first().click();
  // as escolhas da largada: o primeiro botão de cada uma, até a cena abrir
  const seletorCena = jogo === 'cidades' ? '.cid-tabuleiro-3d canvas' : '.tab3d canvas';
  if (jogo === 'cidades') await p.locator('.minijogo button', { hasText: 'rodadas' }).first().click();
  if (jogo === 'tabuleiro') {
    if (process.env.SERRA) await p.locator('.minijogo button', { hasText: 'Serra' }).first().click();
    if (process.env.RIO) await p.locator('.minijogo button', { hasText: 'Rio' }).first().click();
    await p.locator('.tab-rodadas-botao').first().click();
  }
  for (let k = 0; k < 12; k++) {
    if (await p.locator(seletorCena).count()) break;
    const b = p.locator('.minijogo button:visible').filter({ hasNotText: /Fechar|Sair|Como jogar|×/ });
    const alvo = p.locator('.cid-robos-botao, .tab-rodadas-botao, .tab-robos-botao, [class*="robos"] button, [class*="rodadas"] button, button:has-text("Começar"), button:has-text("Jogar")').first();
    if (await alvo.isVisible({ timeout: 1500 }).catch(() => false)) await alvo.click().catch(() => {});
    else if (await b.count()) await b.first().click().catch(() => {});
    await p.waitForTimeout(1200);
  }
  await p.locator(seletorCena).waitFor({ timeout: 30000 });
  await p.waitForTimeout(4000);
  const caixa = p.locator(jogo === 'cidades' ? '.cid-tabuleiro-3d' : '.tab3d');
  await caixa.screenshot({ path: path.join(FOTOS, `jogo-${jogo}-geral-${sufixo}.png`) });
  if (jogo === 'tabuleiro') {
    // a câmera do teste: olhando um ponto (troca o método da instância; o jogo não muda)
    const fotos = [['toca', 0, 0, 0.25, 0.75, 3.2], ['praca', 2.45, 0, 0.5, 0.7, 3.6], ['horta', -2.4, 0, -0.3, 0.8, 4.2], ['dourada', null, 0, 0.4, 0.7, 2.6]];
    for (const [nome, x, z, az, el, dist] of fotos) {
      await p.evaluate(([x, z, az, el, dist]) => {
        const c = window.cenaDoTabuleiro;
        c.posicionarCamera = function () {
          let fx = x, fz = z;
          if (fx === null) { fx = this.dourada.position.x; fz = this.dourada.position.z; }
          this.camera.position.set(fx + Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, fz + Math.cos(az) * Math.cos(el) * dist);
          this.camera.lookAt(fx, x === null ? 0.55 : 0.2, fz);
        };
      }, [x, z, az, el, dist]);
      await p.waitForTimeout(2000);
      await caixa.screenshot({ path: path.join(FOTOS, `jogo-${jogo}-${nome}-${sufixo}.png`) });
    }
  } else {
    // o aeroporto: a casa dele, de perto
    const centro = await p.evaluate(() => {
      const c = window.cenaDasCidades;
      const i = c.dados.casas.findIndex((x) => x.nome === 'aeroporto');
      const lote = c.lotes?.[i];
      const o = lote?.grupo ?? lote?.chao ?? null;
      return { i, pos: o ? { x: o.position.x, z: o.position.z } : null, chaves: Object.keys(lote ?? {}) };
    });
    console.log(JSON.stringify(centro));
    if (centro.pos) {
      await p.evaluate(({ x, z }) => (window.cenaDasCidades.focoDeTeste = { x, z, perto: 0.3 }), centro.pos);
      await p.waitForTimeout(2800);
      await caixa.screenshot({ path: path.join(FOTOS, `jogo-${jogo}-aeroporto-${sufixo}.png`) });
    }
  }
  const medida = await p.evaluate((j) => (j === 'cidades' ? window.cenaDasCidades : window.cenaDoTabuleiro).medidaDoTeste(), jogo);
  ok(`quadro: ${JSON.stringify(medida)}`);
  erros.length ? falhou(`erros: ${erros.join(' | ')}`) : ok('sem erro na página');
} catch (e) {
  falhou(e.stack ?? String(e));
  await p?.screenshot({ path: path.join(FOTOS, 'erro.png') }).catch(() => {});
} finally {
  await browser.close();
  resumo('modelos ' + jogo);
}
