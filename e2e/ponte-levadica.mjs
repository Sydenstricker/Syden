// A LEVADIÇA DA PONTE DA TOCA (20/11/2026), no Solo, pelo computador do quarto, sem chamada.
//
// - Na fase 1 (o riacho), a faixa de peças NÃO tem a levadiça: ela é só das fases do barco.
// - Na fase 16 (o canal), a faixa tem a levadiça (a 5ª peça), o canal aparece marcado e o barco espera lá atrás.
// - Arrastar com a levadiça escolhida de (4, 0) até (6, 0) põe a peça (o custo sobe 800).
// - Com a ponte de referência (window.ponteMontar), "Testar": a levadiça abre e fica EM PÉ enquanto o barco passa, volta a
//   fechar, a trava prende de novo, e só então o tráfego atravessa. "Pronto": o servidor refaz e diz "Passou!" com o mesmo custo.
// - A fase 17 (o porto, dois canais) no 2D de reserva (localStorage 'ponte2d'), com o barco passando nas duas.
//
//   node e2e/ponte-levadica.mjs   (API de teste e site de desenvolvimento; SITE=... para outra porta; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

const { browser } = await abrirNavegador();
try {
  const p = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(p, 'leva' + s);
  await dispensarPresentes(p);
  const foto = (nome) => p.locator('.ponte, .ponte-escolha').first().screenshot({ path: path.join(FOTOS, `ponte-levadica-${nome}.png`) });

  const abrir = async (n, modo = '3d') => {
    await p.locator('.minijogo-topo button[aria-label="Fechar"]').click({ timeout: 2000 }).catch(() => {});
    await p.locator('.rail-logo').click();
    const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
    await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
    await p.locator('.area-de-trabalho [data-icone="mini-games"]').click();
    const painel = p.locator('.jogos-painel');
    await painel.waitFor();
    await painel.locator('.jogos-solo button', { hasText: 'Ponte da toca' }).click();
    await p.locator('.ponte-fase-botao').first().waitFor({ timeout: 10000 });
    await p.locator('.ponte-fase-botao').nth(n - 1).click();
    await p.locator(`.ponte-tela[data-modo="${modo}"]`).waitFor({ timeout: 20000 });
    await p.locator('.ponte-contagem').waitFor({ state: 'detached', timeout: 10000 });
  };
  /** O custo montado (só o número antes do orçamento). */
  const custo = async () => Number((await p.locator('.ponte-custo').evaluate((el) => el.textContent.replace(el.querySelector('small')?.textContent ?? '', ''))).replace(/\D/g, ''));
  const naTela = async (x, y) => {
    const [px, py] = await p.evaluate(([a, b]) => window.ponteParaTela(a, b), [x, y]);
    const caixa = await p.locator('.ponte-tela').boundingBox();
    return [caixa.x + (px / 960) * caixa.width, caixa.y + (py / 540) * caixa.height];
  };

  await abrir(1);
  (await p.getByRole('radio', { name: 'Levadiça' }).count()) === 0 ? ok('no riacho, a faixa não tem a levadiça') : falhou('a levadiça apareceu numa fase sem canal');

  await abrir(16);
  ok('a fase 16 (o canal) abriu no 3D');
  const botao = p.getByRole('radio', { name: 'Levadiça' });
  (await botao.count()) === 1 ? ok('no canal, a faixa tem a levadiça') : falhou('o canal sem a levadiça na faixa');
  await foto('montagem');
  await botao.click();
  const [ax, ay] = await naTela(4, 0);
  const [bx, by] = await naTela(6, 0);
  // o (4, 0) só é nó depois de uma peça chegar nele: primeiro o pilar até ele
  await p.getByRole('radio', { name: 'Aço' }).click();
  const [px, py] = await naTela(3, -2);
  await p.mouse.move(px, py);
  await p.mouse.down();
  await p.mouse.move(ax, ay, { steps: 8 });
  await p.mouse.up();
  const comPilar = await custo();
  await botao.click();
  await p.mouse.move(ax, ay);
  await p.mouse.down();
  await p.mouse.move(bx, by, { steps: 8 });
  await p.mouse.up();
  (await custo()) - comPilar === 800 ? ok('a levadiça arrastada de (4, 0) a (6, 0): +800') : falhou(`a levadiça somou ${(await custo()) - comPilar}`);

  await p.evaluate(() => window.ponteMontar());
  await p.waitForTimeout(300);
  const montada = await custo();
  await p.getByRole('button', { name: 'Testar' }).click();
  await p.waitForFunction(() => (window.ponteDoTeste?.passo ?? 0) > 150, null, { timeout: 20000 });
  const emPe = await p.evaluate(() => {
    const s = window.ponteDoTeste;
    const l = s.levadicas[0];
    return { abertura: s.abertura, dx: s.nos[l.ponta].x - s.nos[l.eixo].x, dy: s.nos[l.ponta].y - s.nos[l.eixo].y, saiu: s.veiculos.some((v) => v.x > -2.9) };
  });
  Math.abs(emPe.dx) < 0.1 && emPe.dy > 1.8 && !emPe.saiu ? ok('o barco passando: a levadiça em pé, o tráfego esperando') : falhou('com o barco: ' + JSON.stringify(emPe));
  await foto('barco-passando');
  await p.waitForFunction(() => window.ponteDoTeste?.terminou, null, { timeout: 40000 });
  const fim = await p.evaluate(() => ({ passou: window.ponteDoTeste.passou, travas: window.ponteDoTeste.travas.map((t) => t.presa) }));
  fim.passou && fim.travas.every(Boolean) ? ok('fechou, a trava prendeu, e o tráfego passou') : falhou('o fim do teste: ' + JSON.stringify(fim));
  await p.getByRole('button', { name: 'Montar' }).click();
  await p.locator('.ponte-resultado').waitFor({ state: 'detached', timeout: 5000 });
  await p.getByRole('button', { name: 'Pronto' }).click();
  await p.locator('.ponte-fim .ponte-resultado.passou').waitFor({ timeout: 15000 });
  const doServidor = Number((await p.locator('.ponte-fim .ponte-resultado').innerText()).replace(/\D/g, ''));
  doServidor === montada ? ok(`o servidor refez a fase do barco: passou, com o custo ${doServidor}`) : falhou(`a tela montou ${montada} e o servidor deu ${doServidor}`);

  // o porto, no 2D de reserva
  await p.evaluate(() => localStorage.setItem('ponte2d', '1'));
  await abrir(17, '2d');
  await p.evaluate(() => window.ponteMontar());
  await p.waitForTimeout(300);
  await foto('porto-2d-montagem');
  await p.getByRole('button', { name: 'Testar' }).click();
  await p.waitForFunction(() => (window.ponteDoTeste?.passo ?? 0) > 200, null, { timeout: 20000 });
  await foto('porto-2d-barco');
  await p.waitForFunction(() => window.ponteDoTeste?.terminou, null, { timeout: 40000 });
  (await p.evaluate(() => window.ponteDoTeste.passou)) ? ok('no porto (2D), as duas levadiças abriram e o caminhão passou') : falhou('o porto caiu');
  await p.evaluate(() => localStorage.removeItem('ponte2d'));
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('a levadiça da ponte');
}
