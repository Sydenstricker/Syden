// A AUDITORIA DE GAME FEEL DA MASMORRA DA TOCA (25/11/2026): só olha.
//
// O Theo abre a Masmorra pelo computador do quarto (Solo, sem chamada), na Toca do rei-cogumelo, liga o piloto automático,
// e a página monta uma folha de quadros por momento (a faísca do golpe de pá, a fumacinha do bicho que some, as estrelas da
// cenoura, o item que sai do baú, o coração que ele perde), em e2e/fotos/auditoria-gf/masmorra-<momento>.png, e mais um
// trecho seguido no salão dos cogumelos.
//
// Os efeitos da Masmorra moram numa lista fechada no componente: o gancho (GANCHO_DOS_EFEITOS) só os anota, para saber
// quando cada um está vivo. O coração perdido sai do masmorraDoTeste.hp.
//
//   node e2e/auditoria-gf-masmorra.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';
import { GANCHO_DOS_EFEITOS, abrirComputador, folhas, salvar, trecho } from './auditoria-gf-quadros.mjs';

const s = Date.now().toString().slice(-5);
const CANVAS = '.masmorra-tela canvas';
const VIVOS = `() => {
  const t = performance.now();
  const r = (window.__gfEfeitos ?? []).filter(({ o, lista }) => t >= o.em && lista.includes(o)).map(({ o }) => o.tipo);
  const m = window.masmorraDoTeste;
  if (m) {
    if (window.__gfHp !== undefined && m.hp < window.__gfHp) window.__gfDanoEm = t;
    window.__gfHp = m.hp;
  }
  if (t - (window.__gfDanoEm ?? -1e9) < 900) r.push('dano-eu');
  return r;
}`;

const { browser } = await abrirNavegador();
try {
  const contexto = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await contexto.addInitScript(GANCHO_DOS_EFEITOS);
  const theo = vigiar(await contexto.newPage());
  await cadastrar(theo, 'gfm' + s);
  await dispensarPresentes(theo);
  const painel = await abrirComputador(theo);
  await painel.locator('.jogos-solo button', { hasText: 'Masmorra da Toca' }).dispatchEvent('click');
  await theo.locator('.corrida-pista-botao', { hasText: 'Toca do rei-cogumelo' }).click();
  await theo.locator(CANVAS).waitFor({ timeout: 15000 });
  await theo.waitForFunction(() => window.masmorraDoTeste?.fase === 'jogando', null, { timeout: 15000 });
  await theo.evaluate(() => (window.masmorraPilotoAutomatico = true));
  ok('a Masmorra abriu, com o piloto');

  const r = await folhas(theo, { canvas: CANVAS, vivos: VIVOS, tipos: ['faisca', 'puf', 'estrelas', 'item', 'dano-eu'], ms: 150000, K: 1, col: 3, max: 18 });
  for (const [t, fo] of Object.entries(r)) {
    if (fo.n > 0) {
      salvar(`masmorra-${t}.png`, fo.png);
      ok(`${t}: ${fo.n} quadros, ~${fo.duracao} ms`);
    } else console.log(`· ${t}: não aconteceu em 150 s`);
  }
  // o rei-cogumelo (a última sala), com a turma batendo
  await theo.waitForFunction(() => window.masmorraDoTeste?.sala === 6 && window.masmorraDoTeste.bichos > 0, null, { timeout: 240000 }).then(
    async () => {
      await theo.waitForTimeout(1500);
      salvar('masmorra-trecho-rei.png', await trecho(theo, { canvas: CANVAS, n: 18, passo: 150, K: 1, col: 3 }));
      ok('o trecho do rei-cogumelo');
      const fim = await folhas(theo, { canvas: CANVAS, vivos: VIVOS, tipos: ['puf', 'dano-eu'], ms: 120000, K: 1, col: 3, max: 18 });
      for (const [t, fo] of Object.entries(fim)) if (fo.n > 0) salvar(`masmorra-rei-${t}.png`, fo.png), ok(`rei ${t}: ${fo.n} quadros`);
    },
    () => console.log('· o piloto não chegou ao rei em 4 min'),
  );
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('auditoria-gf-masmorra');
}
