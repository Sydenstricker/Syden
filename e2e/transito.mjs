// O TRÂNSITO DA TOCA NO SOLO (06/11/2026), pelo computador do quarto, sem chamada.
//
// - A Duda abre o Trânsito pela seção Solo do computador: a contagem, e a cidade com os carros chegando.
// - Uma tecla (Q) solta o primeiro carro da rua de cima à esquerda, e ele atravessa: o placar sobe.
// - O piloto automático do site de desenvolvimento (window.transitoPilotoAutomatico) joga o resto do minuto sem batida; no fim,
//   as liberações vão ao servidor, que refaz a partida, e a tela diz "Novo recorde!" com os pontos DELE (iguais aos da tela).
//
//   node e2e/transito.mjs   (API de teste e site de desenvolvimento; SITE=... para outra porta; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.transito, .minijogo-placar, .transito-fim').first().screenshot({ path: path.join(FOTOS, `transito-${nome}.png`) });

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
  await painel.locator('.jogos-solo button', { hasText: 'Trânsito da toca' }).click();
  await duda.locator('.transito-tela').waitFor({ timeout: 10000 });
  ok('no quarto, sem chamada, o Trânsito começou sozinho');
  await foto(duda, 'contagem');

  // a contagem (3 s) e os primeiros carros chegando à faixa
  await duda.waitForFunction(() => (window.transitoDoTeste?.carros ?? []).some((c) => c.entrada === 0 && c.v === 0), null, { timeout: 30000 });
  await foto(duda, 'fila');
  await duda.keyboard.press('q');
  await duda.waitForFunction(() => window.transitoDoTeste.atravessaram >= 1, null, { timeout: 10000 });
  ok('a tecla Q soltou o carro da rua de cima à esquerda, e ele atravessou');

  // um clique na rua solta também (a fila mais cheia, pelo lugar dela na tela)
  const antes = await duda.evaluate(() => window.transitoDoTeste.carros.filter((c) => c.liberado).length + window.transitoDoTeste.atravessaram);
  await duda.waitForFunction(() => (window.transitoDoTeste?.carros ?? []).some((c) => !c.liberado && c.v === 0), null, { timeout: 15000 });
  const alvo = await duda.evaluate(() => {
    const c = window.transitoDoTeste.carros.find((k) => !k.liberado && k.v === 0);
    return { x: (c.x - c.y) * 65, y: (c.x + c.y) * 32.5 };
  });
  const tela = await duda.locator('.transito-tela').boundingBox();
  const { largura, altura } = await duda.evaluate(() => {
    const c = document.querySelector('.transito-tela');
    return { largura: c.width, altura: c.height };
  });
  await duda.mouse.click(tela.x + ((largura / 2 + alvo.x) / largura) * tela.width, tela.y + ((40 + alvo.y) / altura) * tela.height);
  await duda.waitForTimeout(300);
  const depois = await duda.evaluate(() => window.transitoDoTeste.carros.filter((c) => c.liberado).length + window.transitoDoTeste.atravessaram);
  depois > antes ? ok('o clique no carro parado o soltou') : falhou('o clique não soltou ninguém');

  await duda.evaluate(() => (window.transitoPilotoAutomatico = true));
  await duda.waitForTimeout(12000);
  await foto(duda, 'jogando');
  const meio = await duda.evaluate(() => ({ b: window.transitoDoTeste.batidas, a: window.transitoDoTeste.atravessaram }));
  meio.a > 5 ? ok(`o piloto soltou ${meio.a} carros`) : falhou(`o piloto soltou só ${meio.a}`);

  await duda.locator('.transito-fim').waitFor({ timeout: 90_000 });
  const daTela = await duda.evaluate(() => window.transitoDoTeste.pontos);
  const doServidor = Number((await duda.locator('.transito-fim-pontos').innerText()).replace(/\D/g, ''));
  doServidor === daTela ? ok(`o servidor refez a partida e deu os mesmos ${doServidor} pontos`) : falhou(`a tela tinha ${daTela} e o servidor deu ${doServidor}`);
  (await duda.getByText('Novo recorde!').count()) > 0 ? ok('no fim, "Novo recorde!"') : falhou('o fim não disse o recorde');
  await foto(duda, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('trânsito da toca');
}
