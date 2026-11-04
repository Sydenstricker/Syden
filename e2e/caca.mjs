// A CAÇA ÀS PRAGAS DA HORTA NO SOLO (04/11/2026), pelo computador do quarto, sem chamada.
//
// - A Duda abre a Caça pela seção Solo do computador: o "prepare-se", e as pragas atravessando a horta.
// - Um tiro pelo mouse no céu vazio gasta uma cenoura e não acerta nada.
// - O piloto automático do site de desenvolvimento (window.cacaPilotoAutomatico) mira nas pragas: atira pelo mesmo caminho
//   até o servidor, que confere cada tiro com a conta do voo. Os pontos sobem, e a placa marca as abatidas.
// - Entre as ondas, o placar com "Nesta onda" e "Total"; no fim das cinco, "Novo recorde!".
//
//   node e2e/caca.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.caca, .minijogo-placar').first().screenshot({ path: path.join(FOTOS, `caca-${nome}.png`) });

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
  await painel.screenshot({ path: path.join(FOTOS, 'caca-estante.png') });
  await painel.locator('.jogos-solo button', { hasText: 'Caça às pragas da horta' }).click();
  await duda.locator('.caca-tela').waitFor({ timeout: 10000 });
  ok('no quarto, sem chamada, a Caça começou sozinha');
  await foto(duda, 'preparo');

  // a onda começa (o "prepare-se" dura 3 s), e as pragas aparecem
  await duda.waitForTimeout(4500);
  const municaoAntes = await duda.locator('.caca-cenoura').count();
  municaoAntes > 0 ? ok(`a munição aparece: ${municaoAntes} cenouras`) : falhou('não apareceu a munição');
  // um tiro no céu vazio, bem no alto do canto (as pragas voam mais baixo)
  const caixa = await duda.locator('.caca-tela').boundingBox();
  await duda.mouse.click(caixa.x + 4, caixa.y + 4);
  await duda.waitForTimeout(600);
  const municaoDepois = await duda.locator('.caca-cenoura').count();
  municaoDepois === municaoAntes - 1 ? ok('o tiro gastou uma cenoura') : falhou(`a munição foi de ${municaoAntes} para ${municaoDepois}`);
  await foto(duda, 'onda');

  // o piloto mira nas pragas
  await duda.evaluate(() => (window.cacaPilotoAutomatico = true));
  await duda.locator('.caca-marca.abatida').first().waitFor({ timeout: 20000 });
  ok('o piloto acertou uma praga, e a placa marcou');
  await foto(duda, 'acerto');
  await duda.locator('.caca .golfe-placar').waitFor({ timeout: 40000 });
  const pontos = Number((await duda.locator('.caca .golfe-placar tbody tr td strong').first().innerText()).replace(/\D/g, ''));
  pontos > 0 ? ok(`no placar da onda, os pontos que o servidor contou: ${pontos}`) : falhou('o servidor não contou nenhum ponto');
  await foto(duda, 'placar');

  // as cinco ondas até o fim
  await duda.locator('.minijogo-placar').waitFor({ timeout: 5 * 60_000 });
  (await duda.getByText('Novo recorde!').count()) > 0 ? ok('no fim das cinco ondas, "Novo recorde!"') : falhou('o fim não disse o recorde');
  await foto(duda, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('caça às pragas');
}
