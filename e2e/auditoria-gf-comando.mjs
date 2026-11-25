// A AUDITORIA DE GAME FEEL DO COMANDO CENOURA (25/11/2026): só olha.
//
// A Lia abre o Comando pelo computador do quarto (Solo, sem chamada), liga o piloto automático, e a página monta uma folha
// de quadros para cada momento de impacto (o clarão no cano, a faísca do acerto, a fumaça do bicho, a explosão da granada,
// a pancada que ela leva, o coelhinho solto da gaiola, o pisão e a fumaça grande do dragão), em
// e2e/fotos/auditoria-gf/comando-<momento>.png, e mais um trecho seguido com o piloto lutando.
//
//   node e2e/auditoria-gf-comando.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';
import { abrirComputador, folhas, salvar, trecho } from './auditoria-gf-quadros.mjs';

const s = Date.now().toString().slice(-5);
const CANVAS = '.comando .briga-tela canvas';
const VIVOS = `() => {
  const c = window.comandoDoTeste;
  if (!c) return [];
  const t = performance.now();
  return c.efeitos.filter((e) => t >= e.em).map((e) => e.tipo + (e.pequena ? '-pequena' : '') + (e.grande ? '-grande' : ''));
}`;

const { browser } = await abrirNavegador();
try {
  const lia = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(lia, 'gfc' + s);
  await dispensarPresentes(lia);
  const painel = await abrirComputador(lia);
  await painel.locator('.jogos-solo button', { hasText: 'Comando Cenoura' }).dispatchEvent('click');
  // desde 21/11/2026 há a escolha da fase: a floresta
  const escolha = lia.locator('.corrida-pista-botao').first();
  if (await escolha.waitFor({ timeout: 8000 }).then(() => true, () => false)) {
    const floresta = lia.locator('.corrida-pista-botao', { hasText: /Floresta/ });
    await ((await floresta.count()) ? floresta.first() : escolha).click();
  }
  await lia.locator(CANVAS).waitFor({ timeout: 15000 });
  await lia.evaluate(() => (window.comandoPilotoAutomatico = true));
  await lia.waitForTimeout(3000);
  ok('o Comando abriu, com o piloto');

  const primeira = await folhas(lia, { canvas: CANVAS, vivos: VIVOS, tipos: ['clarao', 'faisca', 'fumaca', 'explosao', 'explosao-pequena', 'pancada', 'solto'], ms: 90000, K: 2 });
  for (const [t, fo] of Object.entries(primeira)) {
    if (fo.n > 0) {
      salvar(`comando-${t}.png`, fo.png);
      ok(`${t}: ${fo.n} quadros, ~${fo.duracao} ms`);
    } else console.log(`· ${t}: não aconteceu em 90 s`);
  }
  salvar('comando-trecho.png', await trecho(lia, { canvas: CANVAS, n: 32, passo: 100, K: 2 }));
  ok('o trecho seguido de 3,2 s');
  // o dragão: o pisão e a fumaça grande
  await lia.waitForFunction(() => window.comandoDoTeste?.linha.ultimo()?.i.some((l) => l[1] === 3), null, { timeout: 240000 }).catch(() => {});
  const chefe = await folhas(lia, { canvas: CANVAS, vivos: VIVOS, tipos: ['pisao', 'fumaca-grande', 'pancada'], ms: 120000, K: 2 });
  for (const [t, fo] of Object.entries(chefe)) {
    if (fo.n > 0) {
      salvar(`comando-chefe-${t}.png`, fo.png);
      ok(`chefe ${t}: ${fo.n} quadros, ~${fo.duracao} ms`);
    } else console.log(`· chefe ${t}: não aconteceu`);
  }
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('auditoria-gf-comando');
}
