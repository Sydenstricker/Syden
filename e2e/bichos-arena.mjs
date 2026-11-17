// A ARENA DOS COELHOS NO SOLO (17/11/2026), pelo computador do quarto, sem chamada.
//
// - A Lia abre os Bichos da Toca pela seção Solo do computador: a largada pergunta a aventura ou a Arena, e na Arena quantos
//   robôs (ela escolhe dois, cada um por si). A partida começa na hora, com o quadro do servidor chegando (o placar de cima com
//   os três).
// - Ela anda e bate à mão um pouco (as teclas e o mouse de verdade: D, o clique, Q e o Espaço), e troca o bicho pelo 2.
// - O piloto automático do site de desenvolvimento (window.arenaPilotoAutomatico) joga o resto: o dano aparece, alguém cai, e a
//   partida acaba com o placar.
//
//   SITE=http://localhost:5174 node e2e/bichos-arena.mjs   (API de teste e site de desenvolvimento; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.arena').first().screenshot({ path: path.join(FOTOS, `bichos-arena-${nome}.png`) });

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
  await painel.locator('.jogos-solo button', { hasText: 'Bichos da Toca' }).click();
  // a largada: a aventura ou a Arena
  const escolha = lia.locator('.arena-escolha');
  await escolha.waitFor({ timeout: 15000 });
  const modos = await escolha.locator('.arena-modos button').allInnerTexts();
  modos.some((m) => m.includes('Aventura')) && modos.some((m) => m.includes('Arena')) ? ok(`a largada dos Bichos pergunta o modo: ${modos.join(' | ').replace(/\n/g, ' ')}`) : falhou(`os modos: ${modos.join(' | ')}`);
  await lia.locator('.minijogo').screenshot({ path: path.join(FOTOS, 'bichos-arena-largada.png') });
  await escolha.locator('.arena-modos button', { hasText: 'Arena' }).click();
  await escolha.locator('button[aria-label="2"]').click();
  await lia.locator('.arena .briga-tela canvas').waitFor({ timeout: 15000 });
  await lia.waitForFunction(() => document.querySelectorAll('.arena .briga-hud li').length === 3, null, { timeout: 15000 });
  ok('no quarto, sem chamada, a Arena abriu com dois robôs, e o quadro do servidor chega');
  await lia.waitForTimeout(2500);
  await foto(lia, 'comeco');

  // à mão: andar para a direita, mirar com o mouse e bater; o forte, a arrancada e a troca do bicho
  const canvas = lia.locator('.arena .briga-tela canvas');
  const caixa = await canvas.boundingBox();
  await lia.mouse.move(caixa.x + caixa.width * 0.75, caixa.y + caixa.height * 0.45);
  const antes = await lia.evaluate(() => window.arenaDoTeste.eu.x);
  await lia.keyboard.down('d');
  await lia.mouse.down();
  await lia.waitForTimeout(900);
  await foto(lia, 'andando-e-batendo');
  await lia.mouse.up();
  await lia.keyboard.press('Space');
  await lia.waitForTimeout(120);
  await foto(lia, 'arrancada');
  await lia.keyboard.up('d');
  await lia.keyboard.press('q');
  await lia.waitForTimeout(300);
  await foto(lia, 'golpe-forte');
  await lia.keyboard.press('2');
  await lia.waitForTimeout(400);
  const naMao = await lia.evaluate(() => ({ x: window.arenaDoTeste.eu.x, ativo: window.arenaDoTeste.eu.ativo, balas: window.arenaDoTeste.balas.length }));
  naMao.x - antes > 60 ? ok(`as teclas andam (de ${Math.round(antes)} a ${Math.round(naMao.x)})`) : falhou(`o coelho não andou: ${JSON.stringify(naMao)}`);
  naMao.ativo === 1 ? ok('o 2 trocou o bicho da frente') : falhou(`o bicho da frente: ${naMao.ativo}`);
  const desenhou = await lia.evaluate(() => {
    // o meu coelho está desenhado: pixels de cor no lugar dele (a câmera o segue, então perto do meio da tela)
    const c = document.querySelector('.arena .briga-tela canvas');
    const d = c.getContext('2d').getImageData(c.width / 2 - 40, c.height / 2 - 90, 80, 110).data;
    let claros = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 600) claros++;
    return claros;
  });
  desenhou > 80 ? ok(`o coelho do criador aparece na arena (${desenhou} pixels claros perto do meio)`) : falhou(`o coelho não apareceu: ${desenhou}`);

  await lia.evaluate(() => (window.arenaPilotoAutomatico = true));
  await lia.waitForFunction(() => window.arenaDoTeste?.linha.ultimo()?.j.some((l) => l[0] < 0 && l[8] < 100), null, { timeout: 60000 });
  ok('os golpes acertam os robôs (a vida deles desce)');
  await lia.waitForTimeout(1200);
  await foto(lia, 'lutando');
  await lia.waitForFunction(() => window.arenaDoTeste?.linha.ultimo()?.z.length > 0, null, { timeout: 60000 }).then(
    () => ok('uma zona marcada no chão'),
    () => falhou('nenhuma zona marcada em 60 s'),
  );
  await foto(lia, 'zona');
  await lia.waitForFunction(() => window.arenaDoTeste?.linha.ultimo()?.s.length > 0, null, { timeout: 60000 }).then(
    () => ok('caiu um suprimento'),
    () => falhou('nenhum suprimento em 60 s'),
  );
  await foto(lia, 'suprimento');
  await lia.waitForFunction(() => window.arenaDoTeste?.linha.ultimo()?.j.some((l) => l[7] < 3), null, { timeout: 120000 });
  ok('alguém caiu (perdeu uma vida)');
  await lia.waitForTimeout(500);
  await foto(lia, 'caiu');
  await lia.locator('.arena .minijogo-placar').waitFor({ timeout: 5 * 60_000 });
  const final = (await lia.locator('.minijogo-placar li').allInnerTexts()).map((l) => l.replace(/\n/g, ' '));
  final.length === 3 && !final.join(' ').includes('🥇') ? ok(`no Solo, o placar sem medalha: ${final.join(' | ')}`) : falhou(`placar final: ${final.join(' | ')}`);
  const desfecho = await lia.locator('.arena .briga-desfecho').innerText().catch(() => '');
  ok(`o fim: ${desfecho || '(empate)'}`);
  await foto(lia, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
  await browser.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(FOTOS, 'bichos-arena-erro.png') }).catch(() => {});
} finally {
  await browser.close();
  resumo('bichos-arena');
}
