// A PONTE DA TOCA NO SOLO (06/11/2026), pelo computador do quarto, sem chamada.
//
// - A Duda abre a Ponte pela seção Solo do computador, escolhe a fase 1 (o riacho): a contagem, e o vão com a grade.
// - Arrasta com o mouse de um apoio até dois pontos adiante: uma peça de pista (o custo sobe para 300).
// - Pelo teclado (2, as setas, Enter) liga uma viga de madeira; o botão direito a apaga, e Ctrl+Z a traz de volta.
// - Com a ponte de referência (window.ponteMontar, só no site de desenvolvimento), "Testar" roda o tráfego aqui mesmo e passa;
//   "Montar" volta. "Pronto" manda a lista; o servidor refaz a simulação, e a tela diz "Passou!" com o custo DELE e "Novo recorde!".
// - Na fase 3 (a ravina), só a pista: ela cai, e a tela diz o quanto o tráfego andou.
//
//   node e2e/ponte.mjs   (API de teste e site de desenvolvimento; SITE=... para outra porta; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.ponte, .ponte-escolha').first().screenshot({ path: path.join(FOTOS, `ponte-${nome}.png`) });

const { browser } = await abrirNavegador();
try {
  const duda = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);

  /** Abre o computador do quarto e começa a Ponte na fase `n` (1, 2, ...). */
  const abrir = async (n) => {
    await duda.locator('.rail-logo').click();
    const quarto = await (await duda.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
    await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
    await duda.waitForTimeout(800);
    await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
    const painel = duda.locator('.jogos-painel');
    await painel.waitFor();
    await painel.locator('.jogos-solo button', { hasText: 'Ponte da toca' }).click();
    await duda.locator('.ponte-fase-botao').first().waitFor({ timeout: 10000 });
    if (n === 1) await foto(duda, 'fases');
    await duda.locator('.ponte-fase-botao').nth(n - 1).click();
    await duda.locator('.ponte-tela').waitFor({ timeout: 10000 });
  };
  const custo = async () => Number((await duda.locator('.ponte-custo').innerText()).replace(/\D/g, ''));
  /** O ponto (x, y) da grade na tela, para o mouse. */
  const naTela = async (x, y) => {
    const [px, py] = await duda.evaluate(([a, b]) => window.ponteParaTela(a, b), [x, y]);
    const caixa = await duda.locator('.ponte-tela').boundingBox();
    return [caixa.x + (px / 960) * caixa.width, caixa.y + (py / 540) * caixa.height];
  };

  await abrir(1);
  ok('no quarto, sem chamada, a Ponte abriu na fase 1');
  await foto(duda, 'contagem');
  await duda.locator('.ponte-contagem').waitFor({ state: 'detached', timeout: 10000 });

  // o mouse: arrastar do apoio (0, 0) até (2, 0), com a pista escolhida
  const [ax, ay] = await naTela(0, 0);
  const [bx, by] = await naTela(2, 0);
  await duda.mouse.move(ax, ay);
  await duda.mouse.down();
  await duda.mouse.move((ax + bx) / 2, ay, { steps: 4 });
  await duda.mouse.move(bx, by, { steps: 4 });
  await duda.mouse.up();
  (await custo()) === 300 ? ok('arrastar pôs uma pista de 2 casas (300)') : falhou(`o custo ficou ${await custo()}`);

  // o teclado: 2 (madeira), o cursor sai do apoio (0, 0), Enter, ↑ →, Enter: madeira de (0, 0) a (1, 1)
  await duda.keyboard.press('2');
  await duda.keyboard.press('Enter');
  await duda.keyboard.press('ArrowUp');
  await duda.keyboard.press('ArrowRight');
  await duda.keyboard.press('Enter');
  await duda.keyboard.press('Backspace'); // larga a corrente
  (await custo()) === 441 ? ok('pelo teclado, uma viga de madeira na diagonal (141)') : falhou(`o custo ficou ${await custo()}`);
  await foto(duda, 'montando');

  // o botão direito apaga a viga; Ctrl+Z a traz de volta
  const [mx, my] = await naTela(0.5, 0.5);
  await duda.mouse.click(mx, my, { button: 'right' });
  (await custo()) === 300 ? ok('o botão direito apagou a viga') : falhou(`depois de apagar, ${await custo()}`);
  await duda.keyboard.press('Control+z');
  (await custo()) === 441 ? ok('Ctrl+Z desfez') : falhou(`depois de desfazer, ${await custo()}`);

  // a ponte de referência, o teste aqui mesmo e a volta à montagem
  await duda.evaluate(() => window.ponteMontar());
  const montada = await custo();
  await duda.getByRole('button', { name: 'Testar' }).click();
  await duda.waitForFunction(() => (window.ponteDoTeste?.veiculos ?? []).some((v) => v.x > 2.5), null, { timeout: 20000 });
  await foto(duda, 'testando');
  await duda.waitForFunction(() => window.ponteDoTeste?.terminou, null, { timeout: 30000 });
  (await duda.evaluate(() => window.ponteDoTeste.passou)) ? ok('no teste, o tráfego passou') : falhou('o teste da ponte de referência caiu');
  await duda.locator('.ponte-resultado.passou').waitFor({ timeout: 5000 });
  await duda.getByRole('button', { name: 'Montar' }).click();
  await duda.locator('.ponte-resultado').waitFor({ state: 'detached', timeout: 5000 });
  ok('"Montar" voltou à montagem');

  await duda.getByRole('button', { name: 'Pronto' }).click();
  await duda.locator('.ponte-fim .ponte-resultado.passou').waitFor({ timeout: 15000 });
  const doServidor = Number((await duda.locator('.ponte-fim .ponte-resultado').innerText()).replace(/\D/g, ''));
  doServidor === montada ? ok(`o servidor refez a simulação: passou, com o custo ${doServidor}`) : falhou(`a tela montou ${montada} e o servidor deu ${doServidor}`);
  (await duda.getByText('Novo recorde!').count()) > 0 ? ok('no fim, "Novo recorde!"') : falhou('o fim não disse o recorde');
  await duda.waitForTimeout(2500);
  await foto(duda, 'fim');

  // a ravina com só a pista: cai
  await duda.locator('.minijogo-topo button[aria-label="Fechar"]').click().catch(() => {});
  await abrir(3);
  await duda.locator('.ponte-contagem').waitFor({ state: 'detached', timeout: 10000 });
  await duda.evaluate(() => window.ponteMontar([0, 0, 2, 0, 0, 2, 0, 4, 0, 0, 4, 0, 6, 0, 0, 6, 0, 8, 0, 0, 8, 0, 10, 0, 0]));
  await duda.getByRole('button', { name: 'Pronto' }).click();
  await duda.locator('.ponte-fim .ponte-resultado.caiu').waitFor({ timeout: 15000 });
  const caiu = await duda.locator('.ponte-fim .ponte-resultado').innerText();
  /% do caminho/.test(caiu) ? ok(`a ponte fraca caiu: "${caiu}"`) : falhou(`o fim disse "${caiu}"`);
  await duda.waitForTimeout(3500);
  await foto(duda, 'caiu');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('ponte da toca');
}
