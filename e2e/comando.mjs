// O COMANDO CENOURA NO SOLO (16/11/2026), pelo computador do quarto, sem chamada.
//
// - A Lia abre o Comando Cenoura pela seção Solo do computador: a fase começa na hora, com o quadro do servidor chegando
//   (o placar de cima com ela).
// - Ela corre e atira à mão um pouco (as teclas de verdade: seta para a direita e X).
// - O piloto automático do site de desenvolvimento (window.comandoPilotoAutomatico) joga o resto: os pontos sobem, as gaiolas
//   abrem, e a fase acaba em "Vitória!" com o placar.
//
//   SITE=http://localhost:5301 node e2e/comando.mjs   (API de teste e site de desenvolvimento; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.comando').first().screenshot({ path: path.join(FOTOS, `comando-${nome}.png`) });
const pontos = (pagina) => pagina.locator('.comando .briga-hud li strong').first().innerText().then(Number).catch(() => 0);

const { browser } = await abrirNavegador();
try {
  const lia = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(lia, 'lia' + s);
  await dispensarPresentes(lia);
  await lia.locator('.rail-logo').click();
  const quarto = await (await lia.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await lia.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await lia.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = lia.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Comando Cenoura' }).click();
  await lia.locator('.comando .briga-tela canvas').waitFor({ timeout: 15000 });
  await lia.locator('.comando .briga-hud li').first().waitFor({ timeout: 10000 });
  ok('no quarto, sem chamada, o Comando Cenoura abriu, e o quadro do servidor chega');
  await lia.waitForTimeout(1500);
  await foto(lia, 'comeco');

  // à mão: correr para a direita atirando, e pular
  await lia.locator('.comando .briga-tela canvas').click();
  await lia.keyboard.down('ArrowRight');
  await lia.keyboard.down('x');
  await lia.waitForTimeout(600);
  await lia.keyboard.press('z');
  await lia.waitForTimeout(250);
  await foto(lia, 'pulando');
  await lia.waitForTimeout(900);
  await lia.keyboard.up('ArrowRight');
  await lia.keyboard.down('ArrowUp');
  await lia.waitForTimeout(500);
  await foto(lia, 'mirando-para-cima');
  await lia.keyboard.up('ArrowUp');
  await lia.keyboard.up('x');
  const naMao = await lia.evaluate(() => ({ x: window.comandoDoTeste?.eu.x ?? 0, tiros: window.comandoDoTeste?.balas.length ?? -1 }));
  naMao.x > 40 ? ok(`as teclas correm (x ${Math.round(naMao.x)})`) : falhou(`o coelho não correu: ${JSON.stringify(naMao)}`);

  await lia.evaluate(() => (window.comandoPilotoAutomatico = true));
  const ate = Date.now() + 40000;
  let p = 0;
  while (Date.now() < ate && p === 0) {
    await lia.waitForTimeout(500);
    p = await pontos(lia);
  }
  p > 0 ? ok(`os acertos contam: ${p} pontos`) : falhou('ninguém pontuou em 40 s');
  await foto(lia, 'lutando');
  // as fotos do meio do caminho: a primeira gaiola, a onda com voadores, o chefe
  await lia.waitForFunction(() => window.comandoDoTeste?.linha.ultimo()?.r[0] > 0, null, { timeout: 120000 });
  ok('a primeira gaiola abriu (reforço)');
  await lia.waitForTimeout(400);
  await foto(lia, 'gaiola');
  await lia.waitForFunction(() => (window.comandoDoTeste?.linha.ultimo()?.o ?? 0) >= 2 && window.comandoDoTeste.linha.ultimo().i.length >= 2, null, { timeout: 120000 });
  await lia.waitForTimeout(1500);
  await foto(lia, 'onda3');
  await lia.waitForFunction(() => window.comandoDoTeste?.linha.ultimo()?.i.some((l) => l[1] === 3), null, { timeout: 180000 });
  await lia.waitForTimeout(2500);
  await foto(lia, 'chefe');
  ok('o dragão apareceu');
  await lia.locator('.comando .briga-desfecho').waitFor({ timeout: 4 * 60_000 });
  const desfecho = await lia.locator('.comando .briga-desfecho').innerText();
  desfecho.includes('Vitória!') ? ok('a fase foi vencida') : falhou(`o fim: ${desfecho}`);
  const final = (await lia.locator('.minijogo-placar li').allInnerTexts()).map((l) => l.replace(/\n/g, ' '));
  final.length === 1 && !final[0].includes('🥇') ? ok(`no Solo, o placar sem medalha: ${final.join(' | ')}`) : falhou(`placar final: ${final.join(' | ')}`);
  await foto(lia, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
  await browser.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(FOTOS, 'comando-erro.png') }).catch(() => {});
} finally {
  await browser.close();
  resumo('comando');
}
