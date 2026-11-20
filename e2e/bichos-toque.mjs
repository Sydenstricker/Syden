// OS BICHOS NO CELULAR (20/11/2026), numa tela de iPhone (390 px).
//
// - SEGURAR a seta da tela anda vários passos (como a tecla segurada), e soltar para.
// - O caderno mostra a roda dos elementos.
// - Na luta, o botão do golpe mostra ×2 ou ½ contra o bicho da frente (a foto).
//
//   node e2e/bichos-toque.mjs   (API de teste e site de desenvolvimento; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.bichos').first().screenshot({ path: path.join(FOTOS, `bichos-toque-${nome}.png`) });

// o mapa vem das regras (uma cópia só para o caminho do teste)
const regras = fs.readFileSync(new URL('../web/src/bichos/regras.ts', import.meta.url), 'utf8');
const MAPA = [...regras.match(/export const MAPA = \[([\s\S]*?)\];/)[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
const andavel = (x, y) => y >= 0 && y < MAPA.length && x >= 0 && x < MAPA[0].length && !'Tr~HC'.includes(MAPA[y][x]);
const TECLA = { c: 'ArrowUp', b: 'ArrowDown', e: 'ArrowLeft', d: 'ArrowRight' };
const PASSO = { c: [0, -1], b: [0, 1], e: [-1, 0], d: [1, 0] };

/** O caminho mais curto (sem pisar no mato nem nas portas, a não ser o destino). */
function caminho(de, ate) {
  const chave = (x, y) => `${x},${y}`;
  const veio = new Map([[chave(de.x, de.y), null]]);
  const fila = [[de.x, de.y]];
  while (fila.length) {
    const [x, y] = fila.shift();
    if (x === ate.x && y === ate.y) break;
    for (const [d, [dx, dy]] of Object.entries(PASSO)) {
      const nx = x + dx, ny = y + dy;
      const destino = nx === ate.x && ny === ate.y;
      if (!andavel(nx, ny) || veio.has(chave(nx, ny))) continue;
      if (!destino && '";hc'.includes(MAPA[ny][nx])) continue;
      veio.set(chave(nx, ny), [x, y, d]);
      fila.push([nx, ny]);
    }
  }
  const dirs = [];
  let k = chave(ate.x, ate.y);
  while (veio.get(k)) {
    const [x, y, d] = veio.get(k);
    dirs.unshift(d);
    k = chave(x, y);
  }
  return dirs;
}

const { browser } = await abrirNavegador();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const eu = vigiar(await ctx.newPage());
  await cadastrar(eu, 'bichot' + s);
  await dispensarPresentes(eu);
  await eu.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await eu.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await eu.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await eu.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = eu.locator('.jogos-painel');
  await painel.waitFor();
  for (let i = 0; i < 4 && !(await eu.locator('.arena-escolha').isVisible()); i++) {
    await painel.locator('.jogos-solo button', { hasText: 'Bichos da Toca' }).click().catch(() => {});
    await eu.waitForTimeout(3000);
  }
  await eu.locator('.arena-modos button', { hasText: 'Aventura' }).tap();
  await eu.locator('.bichos-inicial').waitFor({ timeout: 15000 });
  await eu.locator('.bichos-inicial-cartao', { hasText: 'Bolhim' }).tap();
  await eu.locator('.bichos-tela-campo').waitFor({ timeout: 10000 });
  await eu.waitForTimeout(800);
  const ondeEstou = () => eu.evaluate(() => window.bichosDoTeste);
  const estado = () => eu.evaluate(() => window.bichosEstado);

  // SEGURAR a seta: escolhe o lado com mais casas livres (fora do mato), segura 900 ms
  const de = await ondeEstou();
  const livres = (dx, dy) => {
    let n = 0;
    for (let x = de.x + dx, y = de.y + dy; andavel(x, y) && !'";hc'.includes(MAPA[y][x]); x += dx, y += dy) n++;
    return n;
  };
  const lados = [['d', 1, 0, 'Para a direita'], ['e', -1, 0, 'Para a esquerda'], ['c', 0, -1, 'Para cima'], ['b', 0, 1, 'Para baixo']].map(([d, dx, dy, nome]) => ({ d, nome, n: livres(dx, dy) })).sort((a, b) => b.n - a.n);
  const lado = lados[0];
  const seta = await eu.getByRole('button', { name: lado.nome }).boundingBox();
  const cdp = await ctx.newCDPSession(eu);
  const p = { id: 1, x: seta.x + seta.width / 2, y: seta.y + seta.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await eu.waitForTimeout(900);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await eu.waitForTimeout(600);
  const depois = await ondeEstou();
  const andou = Math.abs(depois.x - de.x) + Math.abs(depois.y - de.y);
  andou >= Math.min(3, lado.n) ? ok(`segurar a seta (${lado.d}, ${lado.n} casas livres) andou ${andou} casas em 900 ms`) : falhou(`segurar a seta andou ${andou} (livres ${lado.n})`);
  await eu.waitForTimeout(800);
  const parado = await ondeEstou();
  parado.x === depois.x && parado.y === depois.y ? ok('soltar o dedo parou o coelho') : falhou('o coelho continuou andando depois de soltar');

  // o caderno com a roda
  await eu.locator('.bichos-caderno-botao').tap();
  await eu.locator('.bichos-roda svg').waitFor({ timeout: 5000 });
  (await eu.locator('.bichos-roda line').count()) === 12 ? ok('o caderno desenha a roda: 6 elementos, 12 setas') : falhou(`setas: ${await eu.locator('.bichos-roda line').count()}`);
  await foto(eu, 'caderno');
  const largura = await eu.evaluate(() => document.documentElement.scrollWidth);
  largura <= 390 ? ok('cabe em 390 px') : falhou(`estouro horizontal: ${largura}px`);
  await eu.locator('.bichos-caderno-topo button').tap();

  // uma luta, para ver o selo da vantagem (pelo teclado: o caminho até o mato)
  async function passo(d) {
    const antes = await ondeEstou();
    await eu.keyboard.press(TECLA[d]);
    await eu.waitForFunction(
      ([x, y]) => window.bichosEstado?.fase === 'batalha' || (window.bichosDoTeste && window.bichosDoTeste.fila === 0 && (window.bichosDoTeste.x !== x || window.bichosDoTeste.y !== y)),
      [antes.x, antes.y],
      { timeout: 5000 },
    );
    await eu.waitForTimeout(160);
    return (await estado()).fase === 'batalha';
  }
  let luta = false;
  for (const d of caminho(await ondeEstou(), { x: 6, y: 11 })) if ((luta = await passo(d))) break;
  for (let i = 0; i < 120 && !luta; i++) luta = await passo(i % 2 ? 'e' : 'd');
  if (!luta) throw new Error('nenhum bicho apareceu');
  await eu.locator('.bichos-golpe').first().waitFor({ timeout: 15000 });
  const e = await estado();
  const outro = e.luta.outro.equipe[e.luta.outro.ativo].especie;
  const selos = await eu.locator('.bichos-golpe-vantagem').allInnerTexts();
  ok(`na luta contra ${outro}, os selos: ${selos.join(' ') || '(nenhum: golpes neutros)'}`);
  await foto(eu, 'luta');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo();
}
