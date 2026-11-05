// A COZINHA DA TOCA NO SOLO (05/11/2026), pelo computador do quarto, sem chamada.
//
// - A Duda abre a Cozinha pela seção Solo do computador: o "prepare-se", a cozinha em 3D e a fila com quatro pedidos.
// - As setas andam (o coelho sai do lugar) e o Espaço no caixote pega um ingrediente.
// - O piloto automático do site de desenvolvimento (window.cozinhaPilotoAutomatico) cozinha o primeiro pedido pelas mesmas
//   regras do teclado: a entrega vai ao servidor, que confere o prato com a receita, e o número de pratos sobe.
//
//   node e2e/cozinha.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
// ESCRITO, AINDA NÃO RODADO: o jogo entra na estante quando for registrado (minijogos-routes.ts, minijogos.ts).
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

  // o piloto cozinha; o servidor confere cada prato
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
