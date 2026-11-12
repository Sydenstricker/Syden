// A COZINHA DA TOCA NO SOLO (05/11/2026), pelo computador do quarto, sem chamada.
//
// - A Duda abre a Cozinha pela seção Solo do computador: o "prepare-se", a cozinha em 3D e a fila com quatro pedidos.
// - As setas andam (o coelho sai do lugar) e o Espaço no caixote pega um ingrediente.
// - O piloto automático do site de desenvolvimento (window.cozinhaPilotoAutomatico) cozinha o primeiro pedido pelas mesmas
//   regras do teclado: a entrega vai ao servidor, que confere o prato com a receita, e o número de pratos sobe.
//
//   node e2e/cozinha.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
// Rodou em 06/11/2026 com o ponto conferido pelo servidor (o piloto entrega e o servidor aceita).
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.cozinha, .minijogo-placar').first().screenshot({ path: path.join(FOTOS, `cozinha-${nome}.png`) });
const pratos = async (pagina) => Number((await pagina.locator('.cozinha-pratos').innerText()).replace(/\D/g, ''));

const { browser } = await abrirNavegador();
try {
  const duda = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.locator('.rail-logo').click();
  const quarto = await (await duda.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await duda.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await duda.locator('.area-de-trabalho [data-icone="mini-games"]').click(); // a área de trabalho do computador (11/11/2026)
  const painel = duda.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Cozinha da toca' }).click();
  await duda.locator('.cozinha-3d:not(.carregando) canvas').waitFor({ timeout: 30000 });
  ok('no quarto, sem chamada, a Cozinha abriu em 3D');
  const pedidos = await duda.locator('.cozinha-fila li').count();
  pedidos === 4 ? ok('a fila tem quatro pedidos') : falhou(`a fila tem ${pedidos} pedidos`);
  await foto(duda, 'preparo');

  // o "prepare-se" dura 3 s; depois, o teclado
  await duda.waitForTimeout(3500);
  await duda.keyboard.down('ArrowLeft');
  await duda.waitForTimeout(900);
  await duda.keyboard.up('ArrowLeft');
  await duda.keyboard.press('Space');
  await duda.waitForTimeout(300);
  await foto(duda, 'teclado');
  ok('as setas e o Espaço não deram erro na página');

  // O MEDIDOR DO PONTO E A FUMAÇA (06/11/2026): põe à mão, só na tela, o bacon queimando, o bife no ponto, o ovo queimado e a
  // pizza ainda crua no forno (o servidor não sabe deles: é só o desenho), fotografa e limpa.
  await duda.evaluate(() => {
    const k = window.cozinhaDoTeste;
    k.coelho.mao = null;
    const por = (id, item, tempo) => {
      const e = k.estacoes[id];
      e.em = { tipo: 'item', item };
      e.desde = k.relogio - tempo;
    };
    por(1, { ing: 'bacon', estado: 'cru' }, 8000);
    por(2, { ing: 'bife', estado: 'cru' }, 6500);
    por(3, { ing: 'ovo', estado: 'cru' }, 12000);
    por(10, { ing: 'massa', estado: 'picado', com: ['queijo', 'tomate'] }, 2500);
  });
  await duda.waitForTimeout(700);
  await foto(duda, 'ponto');
  ok('o medidor do ponto e a fumaça desenharam sem erro');
  // o bife cru e o bacon e o ovo no prato da montagem, para ver os modelos novos de perto
  await duda.evaluate(() => {
    const k = window.cozinhaDoTeste;
    for (const id of [1, 2, 3, 10]) k.estacoes[id].em = null;
    k.estacoes[4].em = { tipo: 'prato', itens: [{ ing: 'ovo', estado: 'cozido' }, { ing: 'bacon', estado: 'cozido' }] };
    k.estacoes[6].em = { tipo: 'item', item: { ing: 'bife', estado: 'cru' } };
    k.estacoes[9].em = { tipo: 'prato', itens: [{ ing: 'bife', estado: 'cozido' }, { ing: 'alface', estado: 'picado' }, { ing: 'tomate', estado: 'picado' }] };
  });
  await duda.waitForTimeout(500);
  await foto(duda, 'pratos-novos');
  await duda.evaluate(() => {
    const k = window.cozinhaDoTeste;
    for (const id of [4, 6, 9]) k.estacoes[id].em = null;
  });

  // o piloto cozinha; o servidor confere cada prato (e o ponto de cada item cozido, pelo relógio dele)
  await duda.evaluate(() => (window.cozinhaPilotoAutomatico = true));
  await duda.waitForFunction(() => Number(document.querySelector('.cozinha-pratos')?.textContent?.replace(/\D/g, '') ?? 0) >= 2, null, { timeout: 90000 });
  ok(`o piloto entregou ${await pratos(duda)} pratos, e a fila andou`);
  await foto(duda, 'cozinhando');

  // os 3 minutos até o fim, e o placar
  await duda.locator('.minijogo-placar').waitFor({ timeout: 4 * 60_000 });
  ok('no fim dos 3 minutos, o placar');
  await foto(duda, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('cozinha da toca');
}
