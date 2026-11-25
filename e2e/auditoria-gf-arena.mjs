// A AUDITORIA DE GAME FEEL DA ARENA DOS BICHOS (25/11/2026): só olha.
//
// A Gabi abre os Bichos da Toca pelo computador do quarto (Solo, sem chamada), escolhe a Arena com dois robôs, liga o
// piloto automático, e a página monta uma folha de quadros por momento (o golpe saindo da mão, a faísca do acerto, a roda,
// o número do dano nos outros e nela, a arrancada, o suprimento pego, quem cai), em e2e/fotos/auditoria-gf/arena-<momento>.png,
// e mais um trecho seguido com o piloto lutando.
//
//   node e2e/auditoria-gf-arena.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';
import { abrirComputador, folhas, salvar, trecho } from './auditoria-gf-quadros.mjs';

const s = Date.now().toString().slice(-5);
const CANVAS = '.arena .briga-tela canvas';
const VIVOS = `() => {
  const c = window.arenaDoTeste;
  if (!c) return [];
  const t = performance.now();
  const r = c.efeitos.filter((e) => t >= e.em).map((e) =>
    e.tipo === 'numero' && Math.hypot(e.x - c.eu.x, e.y - c.eu.y) < 30 ? 'numero-eu' : e.tipo);
  if (c.eu.acao === 'arrancada') r.push('arrancada-eu');
  if (c.eu.acao === 'golpe') r.push('golpe-eu');
  if (c.eu.acao === 'dor') r.push('dor-eu');
  return r;
}`;

const { browser } = await abrirNavegador();
try {
  const gabi = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(gabi, 'gfa' + s);
  await dispensarPresentes(gabi);
  const painel = await abrirComputador(gabi);
  await painel.locator('.jogos-solo button', { hasText: 'Bichos da Toca' }).dispatchEvent('click');
  const escolha = gabi.locator('.arena-escolha');
  await escolha.waitFor({ timeout: 15000 });
  await escolha.locator('.arena-modos button', { hasText: 'Arena' }).click();
  await escolha.locator('button[aria-label="2"]').click();
  await gabi.locator(CANVAS).waitFor({ timeout: 15000 });
  await gabi.evaluate(() => (window.arenaPilotoAutomatico = true));
  await gabi.waitForTimeout(2500);
  ok('a Arena abriu, com dois robôs e o piloto');

  await gabi.waitForTimeout(6000);
  salvar('arena-trecho.png', await trecho(gabi, { canvas: CANVAS, n: 18, passo: 120, K: 1, col: 3 }));
  ok('o trecho seguido de ~2,2 s');
  const r = await folhas(gabi, {
    canvas: CANVAS,
    vivos: VIVOS,
    tipos: ['golpe-eu', 'faisca', 'roda', 'numero', 'numero-eu', 'dor-eu', 'arrancada-eu', 'pegou', 'caiu'],
    ms: 120000,
    K: 1,
    col: 3,
    max: 18,
  });
  for (const [t, fo] of Object.entries(r)) {
    if (fo.n > 0) {
      salvar(`arena-${t}.png`, fo.png);
      ok(`${t}: ${fo.n} quadros, ~${fo.duracao} ms`);
    } else console.log(`· ${t}: não aconteceu em 120 s`);
  }
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('auditoria-gf-arena');
}
