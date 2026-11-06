// OS LOTES VIVOS DO CIDADES EM 3D (05/11/2026, pedido dele: "quadros mais dinâmicos e representativos, com mais vida").
// No Solo contra um robô: abre a partida, joga algumas vezes (comprando o que der) e fotografa o tabuleiro de longe e de
// perto. Depois, pelo gancho do site de desenvolvimento (window.cenaDasCidades), mostra TODAS as situações de uma vez — à
// venda, comprada, 1 a 3 casinhas, o hotel, hipotecada, os transportes com dono — e mede o quadro (ms e chamadas de desenho).
//
//   node e2e/cidades-3d.mjs   (API de teste na 3099 e site de desenvolvimento na 5174; FOTOS=pasta para as fotos)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador();
try {
  const p = vigiar(await (await browser.newContext({
    // o servidor de teste é dividido com outros testes, e o freio de cadastros conta por endereço: este teste tem o seu
    extraHTTPHeaders: { 'X-Forwarded-For': `10.77.${Number(s) % 250}.${(Number(s) >> 3) % 250}` },
    viewport: { width: Number(process.env.LARGURA ?? 1400), height: Number(process.env.ALTURA ?? 1000) } })).newPage());
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
  // os servidores de teste são divididos com outros testes: o freio de endereço (429) pede outra tentativa
  for (let k = 0; ; k++) {
    try {
      await cadastrar(p, 'cid' + s + k);
      break;
    } catch (e) {
      if (k >= 5) throw e;
      await p.waitForTimeout(20000);
    }
  }
  await dispensarPresentes(p);
  await p.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await p.locator('.jogos-painel .jogos-solo button', { hasText: 'Capitais' }).first().click();
  const robos = p.locator('.cid-robos-botao').first();
  if (await robos.isVisible({ timeout: 5000 }).catch(() => false)) await robos.click();
  const rodadas = p.locator('.tab-rodadas-botao').first();
  if (await rodadas.isVisible({ timeout: 2000 }).catch(() => false)) await rodadas.click();
  await p.locator('.cid-tabuleiro-3d canvas').waitFor({ timeout: 30000 });
  await p.waitForFunction(() => !!window.cenaDasCidades, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  const tabuleiro = p.locator('.cid-tabuleiro-3d');
  await tabuleiro.screenshot({ path: path.join(FOTOS, 'cid3d-inicio.png') });
  ok('a cena 3D abriu');

  // algumas jogadas de verdade: os dados, e comprar quando der
  let jogadas = 0;
  for (let t = 0; t < 90 && jogadas < 4; t++) {
    const dados = p.locator('.cid-vez button', { hasText: 'Jogar os dados' });
    const comprar = p.locator('.cid-vez button', { hasText: /^Comprar/ });
    if (await comprar.count()) {
      await comprar.first().click().catch(() => {});
      ok('comprei uma casa');
    } else if (await dados.count()) {
      await dados.first().click().catch(() => {});
      jogadas++;
      await p.waitForTimeout(600);
      await tabuleiro.screenshot({ path: path.join(FOTOS, `cid3d-jogada${jogadas}.png`) });
    }
    await p.waitForTimeout(700);
  }
  jogadas ? ok(`joguei ${jogadas} vezes`) : falhou('não chegou a minha vez');

  // todas as situações de uma vez (a cena congela até o fim do teste)
  await p.evaluate(() => {
    const c = window.cenaDasCidades;
    const ids = c.dados.pecas.map((x) => x.userId);
    const [a, b] = [ids[0], ids[1] ?? ids[0]];
    const pos = [
      [3, a, 0],
      [6, b, 1],
      [7, a, 2],
      [8, b, 3],
      [10, a, 4],
      [11, b, 0, true],
      [13, a, 1],
      [14, b, 3],
      [17, a, 2],
      [18, b, 4],
      [20, a, 0],
      [21, b, 1],
      [23, a, 3],
      [26, b, 4],
      [27, a, 2],
      [29, b, 1],
      [30, a, 3],
      [31, b, 4],
      [5, a, 0],
      [12, b, 0],
      [25, a, 0],
    ].map(([casa, dono, predios, hipotecada]) => ({ casa, dono, predios, hipotecada: !!hipotecada }));
    c.dados.escolhida = 13;
    c.posseDoTeste(pos, 22);
  });
  await p.waitForTimeout(900);
  // e um prédio novo, para ver o pulo
  await p.evaluate(() => {
    const c = window.cenaDasCidades;
    const ids = c.dados.pecas.map((x) => x.userId);
    c.posseDoTeste([...c.dados.posses.filter((x) => x.casa !== 1), { casa: 1, dono: ids[0], predios: 1, hipotecada: false }], 22);
  });
  await p.waitForTimeout(160);
  await tabuleiro.screenshot({ path: path.join(FOTOS, 'cid3d-pulo.png') });
  await p.waitForTimeout(2500);
  await tabuleiro.screenshot({ path: path.join(FOTOS, 'cid3d-longe.png') });
  const medida = await p.evaluate(() => window.cenaDasCidades.medidaDoTeste());
  ok(`quadro: ${medida.msMedio.toFixed(2)} ms em média (p95 ${medida.msP95.toFixed(2)}), ${medida.chamadas} chamadas de desenho, ${medida.triangulos} triângulos, ${medida.geometrias} geometrias, ${medida.texturas} texturas`);

  const perto = [
    ['cima-esq', -2.6, -3.4],
    ['cima-dir', 2.6, -3.4],
    ['dir', 4.3, -0.2],
    ['baixo', 0.6, 3.2],
    ['baixo-esq', -3.4, 3.2],
    ['esq', -4.3, -0.2],
    ['canto-dir-baixo', 4.2, 3.2],
  ];
  for (const [nome, x, z] of perto) {
    await p.evaluate(([x, z]) => (window.cenaDasCidades.focoDeTeste = { x, z, perto: 0.38 }), [x, z]);
    await p.waitForTimeout(2600);
    await tabuleiro.screenshot({ path: path.join(FOTOS, `cid3d-perto-${nome}.png`) });
  }
  ok('fotos de perto');
  erros.length ? falhou(`erros na página: ${erros.join(' | ')}`) : ok('sem erro na página');
} catch (e) {
  falhou(e.stack ?? String(e));
  await browser.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(FOTOS, 'cid3d-erro.png') }).catch(() => {});
} finally {
  await browser.close();
  resumo('cidades-3d');
}
