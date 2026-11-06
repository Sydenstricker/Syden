// A PONTE DA TOCA NO SOLO (06/11/2026), pelo computador do quarto, sem chamada.
//
// - A Duda abre a Ponte pela seção Solo do computador, escolhe a fase 1 (o riacho): a tela abre DIRETO NO 3D, com a contagem, o
//   vão com a grade e o tráfego (a carroça) esperando na margem desde a montagem, com o selo do peso.
// - Arrasta com o mouse de um apoio até dois pontos adiante: uma peça de pista (o custo sobe para 300).
// - Pelo teclado (2, as setas, Enter) liga uma viga de madeira; o botão direito a apaga, e Ctrl+Z a traz de volta.
// - Com a ponte de referência (window.ponteMontar, só no site de desenvolvimento), "Testar" roda o tráfego aqui mesmo e passa;
//   "Montar" volta. "Pronto" manda a lista; o servidor refaz a simulação, e a tela diz "Passou!" com o custo DELE e "Novo recorde!".
// - A HUD inteira (as peças, os botões, o custo e o relógio) fica DENTRO da tela do jogo.
// - Na fase 5 (a pedra), o caminhão passando na ponte de referência, e a medida do quadro do 3D.
// - Na fase 3 (a ravina), só a pista: ela quebra e cai, e a tela diz o quanto o tráfego andou.
// - Numa tela de celular (em pé), a fase 4: a faixa de baixo cabe dentro da tela do jogo, só com as figuras.
// - O 2D de reserva (localStorage 'ponte2d', só no site de desenvolvimento) abre no lugar do 3D.
//
//   node e2e/ponte.mjs   (API de teste e site de desenvolvimento; SITE=... para outra porta; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

const { browser } = await abrirNavegador();
try {
  const pessoa = async (nome, viewport) => {
    const p = vigiar(await (await browser.newContext({ viewport })).newPage());
    await cadastrar(p, nome + s);
    await dispensarPresentes(p);
    return p;
  };
  const duda = await pessoa('duda', { width: 1400, height: 1000 });
  const foto = (pagina, nome) => pagina.locator('.ponte, .ponte-escolha').first().screenshot({ path: path.join(FOTOS, `ponte-${nome}.png`) });

  /** Abre o computador do quarto e começa a Ponte na fase `n` (1, 2, ...), e espera a tela abrir no `modo` (3d ou 2d). */
  const abrir = async (p, n, modo = '3d', fotoDasFases = false) => {
    await p.locator('.minijogo-topo button[aria-label="Fechar"]').click({ timeout: 2000 }).catch(() => {});
    await p.locator('.rail-logo').click();
    const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
    await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
    const painel = p.locator('.jogos-painel');
    await painel.waitFor();
    await painel.locator('.jogos-solo button', { hasText: 'Ponte da toca' }).click();
    await p.locator('.ponte-fase-botao').first().waitFor({ timeout: 10000 });
    if (fotoDasFases) await foto(p, 'fases');
    await p.locator('.ponte-fase-botao').nth(n - 1).click();
    await p.locator(`.ponte-tela[data-modo="${modo}"]`).waitFor({ timeout: 20000 });
  };
  const custo = async () => Number((await duda.locator('.ponte-custo').innerText()).replace(/\D/g, ''));
  /** O ponto (x, y) da grade na tela, para o mouse. */
  const naTela = async (x, y) => {
    const [px, py] = await duda.evaluate(([a, b]) => window.ponteParaTela(a, b), [x, y]);
    const caixa = await duda.locator('.ponte-tela').boundingBox();
    return [caixa.x + (px / 960) * caixa.width, caixa.y + (py / 540) * caixa.height];
  };
  /** Tudo o que é da HUD dentro da caixa da tela do jogo. */
  const hudDentro = async (p) =>
    p.evaluate(() => {
      const tela = document.querySelector('.ponte-moldura').getBoundingClientRect();
      const fora = [];
      for (const el of document.querySelectorAll('.ponte-barra button, .ponte-relogio, .ponte-custo')) {
        const r = el.getBoundingClientRect();
        if (r.left < tela.left - 0.5 || r.right > tela.right + 0.5 || r.top < tela.top - 0.5 || r.bottom > tela.bottom + 0.5)
          fora.push(el.getAttribute('aria-label') ?? el.className);
      }
      return fora;
    });

  await abrir(duda, 1, '3d', true);
  ok('no quarto, sem chamada, a Ponte abriu na fase 1, direto no 3D');
  await foto(duda, 'contagem');
  await duda.locator('.ponte-contagem').waitFor({ state: 'detached', timeout: 10000 });
  const fora = await hudDentro(duda);
  fora.length === 0 ? ok('as peças, os botões, o custo e o relógio estão dentro da tela do jogo') : falhou('fora da tela do jogo: ' + fora.join(', '));

  // o mouse: arrastar do apoio (0, 0) até (2, 0), com a pista escolhida
  const [ax, ay] = await naTela(0, 0);
  const [bx, by] = await naTela(2, 0);
  await duda.mouse.move(ax, ay);
  await duda.mouse.down();
  await duda.mouse.move((ax + bx) / 2, ay, { steps: 4 });
  await duda.mouse.move(bx, by, { steps: 4 });
  await duda.mouse.up();
  (await custo()) === 300 ? ok('arrastar pôs uma pista de 2 casas (300), com o mouse projetado no plano da ponte') : falhou(`o custo ficou ${await custo()}`);

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
  await duda.waitForFunction(() => document.querySelector('.ponte-custo')?.textContent.replace(/\D/g, '') !== '441');
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
  await duda.locator('.ponte-fim .ponte-tela[data-modo="3d"]').waitFor({ timeout: 15000 });
  await duda.waitForTimeout(2500);
  await foto(duda, 'fim');

  // a fase 5: o caminhão (8) e o carro (4) esperando na fila, e o caminhão passando na ponte de referência
  await abrir(duda, 5);
  await duda.locator('.ponte-contagem').waitFor({ state: 'detached', timeout: 10000 });
  await duda.evaluate(() => window.ponteMontar());
  await duda.waitForTimeout(300);
  await foto(duda, 'fila-do-caminhao');
  await duda.getByRole('button', { name: 'Testar' }).click();
  await duda.waitForFunction(() => {
    const v = window.ponteDoTeste?.veiculos?.[0];
    return v && v.x > 6;
  }, null, { timeout: 20000 });
  await foto(duda, 'caminhao-passando');
  const ms = await duda.evaluate(() => window.ponteCena?.ms ?? -1);
  ms > 0 ? ok(`o quadro do 3D custa ${ms.toFixed(2)} ms para desenhar (média, no Chrome de teste, sem placa)`) : falhou('sem a medida do quadro');
  await duda.waitForFunction(() => window.ponteDoTeste?.terminou, null, { timeout: 30000 });
  (await duda.evaluate(() => window.ponteDoTeste.passou)) ? ok('na fase 5, o caminhão e o carro passaram') : falhou('na fase 5, a ponte de referência caiu');

  // a ravina com só a pista: quebra e cai
  await abrir(duda, 3);
  await duda.locator('.ponte-contagem').waitFor({ state: 'detached', timeout: 10000 });
  await duda.evaluate(() => window.ponteMontar([0, 0, 2, 0, 0, 2, 0, 4, 0, 0, 4, 0, 6, 0, 0, 6, 0, 8, 0, 0, 8, 0, 10, 0, 0]));
  await duda.getByRole('button', { name: 'Testar' }).click();
  await duda.waitForFunction(() => (window.ponteDoTeste?.barras ?? []).some((b) => !b.inteira), null, { timeout: 20000 });
  await duda.waitForTimeout(450);
  await foto(duda, 'quebrando');
  await duda.waitForFunction(() => window.ponteDoTeste?.terminou, null, { timeout: 30000 });
  await foto(duda, 'quebrou');
  await duda.getByRole('button', { name: 'Montar' }).click();
  await duda.getByRole('button', { name: 'Pronto' }).click();
  await duda.locator('.ponte-fim .ponte-resultado.caiu').waitFor({ timeout: 15000 });
  const caiu = await duda.locator('.ponte-fim .ponte-resultado').innerText();
  /% do caminho/.test(caiu) ? ok(`a ponte fraca caiu: "${caiu}"`) : falhou(`o fim disse "${caiu}"`);
  await duda.waitForTimeout(3500);
  await foto(duda, 'caiu');

  // o 2D de reserva
  await duda.evaluate(() => localStorage.setItem('ponte2d', '1'));
  await abrir(duda, 2, '2d');
  await duda.locator('.ponte-contagem').waitFor({ state: 'detached', timeout: 10000 });
  await duda.evaluate(() => window.ponteMontar());
  await duda.waitForTimeout(300);
  await foto(duda, '2d');
  ok('sem o 3D, o 2D de reserva abre no mesmo lugar, com a fila do tráfego');
  await duda.evaluate(() => localStorage.removeItem('ponte2d'));

  // a tela de celular, em pé
  const lia = await pessoa('lia', { width: 390, height: 844 });
  await abrir(lia, 4);
  await lia.locator('.ponte-contagem').waitFor({ state: 'detached', timeout: 10000 });
  const foraNoCelular = await hudDentro(lia);
  foraNoCelular.length === 0 ? ok('no celular, a HUD inteira cabe dentro da tela do jogo') : falhou('no celular, fora da tela do jogo: ' + foraNoCelular.join(', '));
  const linhas = await lia.evaluate(() => {
    const bs = [...document.querySelectorAll('.ponte-barra button')].map((b) => Math.round(b.getBoundingClientRect().top));
    return new Set(bs).size;
  });
  linhas === 1 ? ok('no celular, as peças e os botões numa linha só') : falhou(`no celular, a faixa quebrou em ${linhas} linhas`);
  await lia.evaluate(() => window.ponteMontar());
  await lia.waitForTimeout(300);
  await lia.locator('.ponte').screenshot({ path: path.join(FOTOS, 'ponte-estreita.png') });
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('ponte da toca');
}
