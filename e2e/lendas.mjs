// LENDAS DA TOCA NO SOLO (16/11/2026), pelo computador do quarto, sem chamada.
//
// - A pessoa abre as Lendas pela seção Solo do computador: o caminho de cinco paradas e as quatro classes.
// - Escolhe a Flecha; os três robôs pegam as outras classes, e o mapa leva à floresta.
// - Na primeira rodada, "Atacar" pede o alvo (os botões A, B, C), e a rodada se resolve na hora: a tela toca os golpes.
// - O piloto automático do site de desenvolvimento (window.lendasPilotoAutomatico) escolhe pelo mesmo caminho até o servidor,
//   e veste o espólio; a aventura vai até o dragão e acaba em "Vitória!" ou "Derrota", com o placar.
//
//   SITE=http://localhost:5303 node e2e/lendas.mjs   (API de teste na 3099; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').first().screenshot({ path: path.join(FOTOS, `lendas-${nome}.png`) });

const { browser } = await abrirNavegador();
try {
  const contexto = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  // o piloto sobrevive a uma recarga da página (o site de desenvolvimento recarrega quando o código muda)
  await contexto.addInitScript(() => {
    if (sessionStorage.getItem('lendasPiloto')) window.lendasPilotoAutomatico = true;
  });
  const eva = vigiar(await contexto.newPage());
  await cadastrar(eva, 'eva' + s);
  await dispensarPresentes(eva);
  await eva.locator('.rail-logo').click();
  const quarto = await (await eva.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await eva.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await eva.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = eva.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Lendas da Toca' }).click();
  await eva.locator('.lendas-cartas').waitFor({ timeout: 15000 });
  (await eva.locator('.lendas-caminho li').count()) === 5 ? ok('o caminho tem as cinco paradas') : falhou('o caminho não tem cinco paradas');
  (await eva.locator('.lendas-carta').count()) === 4 ? ok('as quatro classes') : falhou('não vieram as quatro classes');
  await foto(eva, 'classes');

  await eva.locator('.lendas-carta[data-classe="flecha"]').click();
  await eva.locator('.lendas-acoes').waitFor({ timeout: 15000 });
  const classes = await eva.locator('.lendas-turma .lendas-turma-classe').allInnerTexts();
  new Set(classes).size === 4 ? ok(`a turma tem uma classe de cada: ${classes.join(' ')}`) : falhou(`as classes da turma: ${classes.join(' ')}`);
  await eva.waitForTimeout(800);
  await foto(eva, 'luta');

  // "Atacar" pede o alvo; o B
  await eva.locator('.lendas-acoes [data-acao="atacar"]').click();
  await eva.locator('.lendas-alvos button').first().waitFor({ timeout: 5000 });
  (await eva.locator('.lendas-alvos button').count()) === 3 ? ok('o ataque pede o alvo entre os três inimigos') : falhou('não vieram os três alvos');
  await foto(eva, 'mirando');
  await eva.locator('.lendas-alvos button[data-alvo="1"]').click();
  // todos escolheram (os robôs na hora): a rodada se resolve, e os botões travam enquanto a tela toca
  await eva.waitForFunction(() => document.querySelector('.lendas-acoes [data-acao="atacar"]')?.disabled === true, null, { timeout: 5000 });
  ok('a rodada se resolveu na hora: os botões travaram');
  await eva.waitForTimeout(1500);
  await foto(eva, 'golpes');

  // o piloto até o fim
  await eva.evaluate(() => {
    window.lendasPilotoAutomatico = true;
    sessionStorage.setItem('lendasPiloto', '1');
  });
  await eva.locator('.lendas-peca').waitFor({ timeout: 3 * 60_000 });
  ok('a primeira luta acabou: o espólio, com a peça para vestir');
  await foto(eva, 'espolio');
  // (o relato do caminho a cada 20 s: ajuda a ver onde parou se parar)
  eva.on('framenavigated', (fr) => fr === eva.mainFrame() && console.log('  · a página recarregou'));
  const relato = setInterval(async () => {
    const r = await eva.evaluate(() => ({ lendas: !!document.querySelector('.lendas'), parada: [...document.querySelectorAll('.lendas-caminho li')].findIndex((li) => li.classList.contains('agora')) })).catch(() => null);
    console.log('  ·', JSON.stringify(r));
  }, 20_000);
  await eva.locator('.minijogo-placar').waitFor({ timeout: 10 * 60_000 }).finally(() => clearInterval(relato));
  const titulo = await eva.locator('.minijogo-fim-titulo').innerText();
  /Vitória|Derrota/.test(titulo) ? ok(`a aventura acabou: ${titulo.trim()}`) : falhou(`o fim disse: ${titulo}`);
  (await eva.locator('.minijogo-placar li').count()) === 4 ? ok('o placar tem a turma de quatro') : falhou('o placar não tem os quatro');
  await foto(eva, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
  for (const p of browser.contexts().flatMap((c) => c.pages())) await p.screenshot({ path: path.join(FOTOS, 'lendas-falha.png') }).catch(() => {});
} finally {
  await browser.close();
  resumo('lendas da toca');
}
