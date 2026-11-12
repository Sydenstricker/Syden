// A MONTAGEM DA BATALHA NAVAL (05/11/2026, pedido dele: "eu quero primeiro colocar os navios antes de jogar"): no Solo contra o
// robô, pela seção Solo do computador do quarto.
//
// - Em 3D: o mar começa vazio, o robô já está pronto; o fantasma verde onde o navio cabe e vermelho onde encosta; tocar põe, R
//   gira, arrastar muda de lugar; "Sortear a frota" completa; "Pronto" começa os tiros, e o mar do robô não mostra navio.
// - Em 2D (Gráficos → 2D): a grade de botões, pelo teclado (Tab + Enter) e pelo clique.
//
//   node e2e/naval-montagem.mjs   (API de teste na 3099 e site na 5174; o LiveKit não é preciso)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

/**
 * Onde a casa aparece na tela da cena 3D: a mesma câmera de naval3d/cena.ts (em (0, 14,4, 10,4), olhando para (0, −0,4, 0,4),
 * 36° na vertical), e a casa no centro dela, no plano da água.
 */
function naTela(caixa, casa) {
  const pos = [0, 14.4, 10.4];
  const alvo = [0, -0.4, 0.4];
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((t, v, i) => t + v * b[i], 0);
  const norm = (a) => a.map((v) => v / Math.hypot(...a));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const f = norm(sub(alvo, pos));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const p = [(casa % 10) - 4.5, 0, Math.floor(casa / 10) - 4.5];
  const d = sub(p, pos);
  const tan = Math.tan((36 * Math.PI) / 360);
  const aspecto = caixa.width / caixa.height;
  const nx = dot(d, r) / (dot(d, f) * tan * aspecto);
  const ny = dot(d, u) / (dot(d, f) * tan);
  return { x: caixa.x + ((nx + 1) / 2) * caixa.width, y: caixa.y + ((1 - ny) / 2) * caixa.height };
}

async function abrirNaval(p, estilo) {
  await p.evaluate((e) => localStorage.setItem('syden:graficos', JSON.stringify({ estilo: e })), estilo);
  await p.reload();
  await p.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await p.locator('.area-de-trabalho [data-icone="mini-games"]').click(); // a área de trabalho do computador (11/11/2026)
  await p.locator('.jogos-painel .jogos-solo button', { hasText: 'Batalha naval' }).first().click();
  const robos = p.locator('.cid-robos-botao').first();
  if (await robos.isVisible({ timeout: 2000 }).catch(() => false)) await robos.click();
  await p.locator('.naval-montagem').waitFor({ timeout: 20000 });
}

/** A frota que a tela mostra na grade (as casas com navio, pelo rótulo). */
const casasComNavio = (p) => p.locator('.naval-montagem .naval-casa[aria-label*="·"]').count();

const { browser } = await abrirNavegador();
try {
  const p = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await cadastrar(p, 'naval' + s);
  await dispensarPresentes(p);

  // ---------- 3D ----------
  await abrirNaval(p, '3d');
  const sit = await p.locator('.duelo-naval .minijogo-situacao').innerText();
  sit.includes('Ponha os seus navios') ? ok('a montagem abre: "Ponha os seus navios no mar."') : falhou(`situação: ${sit}`);
  (await p.locator('.naval-pronto').count()) === 1 ? ok('o robô já está pronto (✓ ao lado dele)') : falhou('o robô não aparece pronto');
  (await casasComNavio(p)) === 0 ? ok('o mar começa vazio') : falhou('o mar não começou vazio');
  ((await p.locator('.naval-botoes .btn-primary').isDisabled()) ? ok : falhou)('"Pronto" fica desligado enquanto falta navio');
  const tela = p.locator('.naval-montagem canvas');
  await tela.waitFor({ timeout: 30000 });
  await p.waitForTimeout(2500);
  const caixa = await tela.boundingBox();
  await p.locator('.naval-montagem').screenshot({ path: path.join(FOTOS, 'naval-montagem-vazio.png') });

  // o de 5 já vem escolhido: o fantasma verde em A1
  let pt = naTela(caixa, 0);
  await p.mouse.move(pt.x, pt.y);
  await p.waitForTimeout(400);
  const verdes = await p.locator('.naval-casa.fantasma-ok').count();
  verdes === 5 ? ok('3D: o fantasma do navio de 5 aparece verde em A1') : falhou(`3D: ${verdes} casas verdes`);
  await p.locator('.naval-montagem').screenshot({ path: path.join(FOTOS, 'naval-montagem-fantasma.png') });
  await p.mouse.click(pt.x, pt.y);
  await p.waitForFunction(() => document.querySelectorAll('.naval-montagem .naval-casa[aria-label*="·"]').length === 5, null, { timeout: 5000 }).catch(() => {});
  (await casasComNavio(p)) === 5 ? ok('3D: tocar põe o navio') : falhou(`3D: depois do toque, ${await casasComNavio(p)} casas com navio`);

  // o de 4, escolhido sozinho, encostando no de 5: vermelho, e o toque não põe
  pt = naTela(caixa, 10);
  await p.mouse.move(pt.x, pt.y);
  await p.waitForTimeout(400);
  const vermelhas = await p.locator('.naval-casa.fantasma-ruim').count();
  vermelhas === 4 ? ok('3D: encostando, o fantasma fica vermelho') : falhou(`3D: ${vermelhas} casas vermelhas`);
  await p.locator('.naval-montagem').screenshot({ path: path.join(FOTOS, 'naval-montagem-vermelho.png') });
  await p.mouse.click(pt.x, pt.y);
  await p.waitForTimeout(500);
  (await casasComNavio(p)) === 5 ? ok('3D: onde encosta, o navio não vai') : falhou('3D: o navio foi parar encostado');
  // em A3, vai
  pt = naTela(caixa, 20);
  await p.mouse.click(pt.x, pt.y);
  await p.waitForTimeout(600);
  (await casasComNavio(p)) === 9 ? ok('3D: o de 4 em A3') : falhou(`3D: ${await casasComNavio(p)} casas com navio`);

  // R gira o próximo (o de 3), e ele vai em pé em J1
  await p.keyboard.press('r');
  pt = naTela(caixa, 9);
  await p.mouse.move(pt.x, pt.y);
  await p.waitForTimeout(400);
  const emPe = await p.locator('.naval-casa.fantasma-ok').evaluateAll((els) => els.map((e) => Number(e.dataset.casa)));
  JSON.stringify(emPe) === '[9,19,29]' ? ok('3D: R gira o fantasma (em pé, J1–J3)') : falhou(`3D: fantasma depois do R: ${emPe}`);
  await p.mouse.click(pt.x, pt.y);
  await p.waitForTimeout(600);

  // arrastar o de 5 de A1 para A6
  const de = naTela(caixa, 0);
  const para = naTela(caixa, 50);
  await p.mouse.move(de.x, de.y);
  await p.mouse.down();
  await p.mouse.move((de.x + para.x) / 2, (de.y + para.y) / 2, { steps: 4 });
  await p.mouse.move(para.x, para.y, { steps: 4 });
  await p.waitForTimeout(300);
  await p.locator('.naval-montagem').screenshot({ path: path.join(FOTOS, 'naval-montagem-arrastando.png') });
  await p.mouse.up();
  await p.waitForTimeout(700);
  const doCinco = await p.locator('.naval-montagem .naval-casa[aria-label*="5 casas"]').evaluateAll((els) => els.map((e) => Number(e.dataset.casa)));
  JSON.stringify(doCinco) === '[50,51,52,53,54]' ? ok('3D: arrastar muda o navio de lugar (A1 → A6)') : falhou(`3D: o de 5 ficou em ${doCinco}`);
  await p.locator('.naval-montagem').screenshot({ path: path.join(FOTOS, 'naval-montagem-tres.png') });

  // "Sortear a frota" completa, e "Pronto" começa a partida
  await p.locator('.naval-botoes button', { hasText: 'Sortear a frota' }).click();
  await p.waitForTimeout(700);
  (await casasComNavio(p)) === 17 ? ok('"Sortear a frota" põe os cinco') : falhou(`depois do sorteio: ${await casasComNavio(p)} casas`);
  await p.waitForTimeout(1500);
  await p.locator('.naval-montagem').screenshot({ path: path.join(FOTOS, 'naval-montagem-sorteada.png') });
  // a frota moderna (05/11/2026): só a aparência, neste aparelho
  await p.locator('.naval-frotas-opcao').nth(1).click();
  await p.waitForTimeout(2500);
  (await p.evaluate(() => localStorage.getItem('syden:naval-frota'))) === 'moderna' ? ok('a frota moderna fica guardada no aparelho') : falhou('a escolha da frota não ficou guardada');
  await p.locator('.duelo-naval').screenshot({ path: path.join(FOTOS, 'naval-montagem-moderna.png') });
  await p.locator('.naval-botoes .btn-primary').click();
  await p.locator('.naval-mares').waitFor({ timeout: 8000 });
  const meus = await p.locator('.naval-mar.meu .naval-navio').count();
  const doRobo = await p.locator('.naval-mar.alvo .naval-navio').count();
  meus === 5 && doRobo === 0 ? ok('"Pronto": os tiros começam; vejo os meus 5 e nenhum do robô') : falhou(`depois do Pronto: ${meus} meus, ${doRobo} do robô`);
  await p.waitForTimeout(2500);
  await p.locator('.duelo-naval').screenshot({ path: path.join(FOTOS, 'naval-montagem-jogo-moderna.png') });
  // uns tiros, para o robô acertar os navios modernos (o fogo e o afundado com os modelos novos)
  for (let k = 0; k < 40; k++) {
    const meusFogos = await p.locator('.naval-mar.meu .naval-casa.fogo').count();
    if (meusFogos >= 4) break;
    const livre = p.locator('.naval-mar.alvo .naval-casa:not([disabled])');
    if (await livre.count()) await livre.nth(k * 3 % (await livre.count())).evaluate((b) => b.click());
    await p.waitForTimeout(1600);
  }
  ok(`no meu mar, ${await p.locator('.naval-mar.meu .naval-casa.fogo').count()} acertos do robô`);
  await p.waitForTimeout(1500);
  await p.locator('.duelo-naval').screenshot({ path: path.join(FOTOS, 'naval-montagem-jogo-moderna-tiros.png') });
  await p.locator('.naval-frotas-opcao').nth(0).click();
  await p.waitForTimeout(2000);
  await p.locator('.duelo-naval').screenshot({ path: path.join(FOTOS, 'naval-montagem-jogo.png') });
  await p.locator('.duelo-desistir').click().catch(() => {});

  // ---------- 2D, pelo teclado ----------
  await abrirNaval(p, '2d');
  (await p.locator('.naval-montagem canvas').count()) === 0 ? ok('2D: sem a cena, a grade') : falhou('2D: a cena 3D apareceu');
  await p.locator('.naval-grade-montagem .naval-casa').nth(0).focus();
  await p.keyboard.press('Enter');
  await p.waitForTimeout(500);
  (await casasComNavio(p)) === 5 ? ok('2D: Enter numa casa põe o navio escolhido') : falhou(`2D: ${await casasComNavio(p)} casas pelo teclado`);
  // o próximo pelo foco: o fantasma aparece na casa focada
  await p.locator('.naval-grade-montagem .naval-casa').nth(40).focus();
  await p.waitForTimeout(200);
  const focoVerde = await p.locator('.naval-casa.fantasma-ok').count();
  focoVerde === 4 ? ok('2D: o fantasma segue o foco do teclado') : falhou(`2D: ${focoVerde} verdes no foco`);
  await p.keyboard.press('r');
  await p.waitForTimeout(200);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(500);
  const doQuatro = await p.locator('.naval-grade-montagem .naval-casa[aria-label*="4 casas"]').evaluateAll((els) => els.map((e) => Number(e.dataset.casa)));
  JSON.stringify(doQuatro) === '[40,50,60,70]' ? ok('2D: R e Enter põem o de 4 em pé') : falhou(`2D: o de 4 ficou em ${doQuatro}`);
  // clique com o mouse
  await p.locator('.naval-grade-montagem .naval-casa').nth(7).click();
  await p.waitForTimeout(500);
  await p.locator('.naval-montagem').screenshot({ path: path.join(FOTOS, 'naval-montagem-2d.png') });
  ok(`2D: ${await casasComNavio(p)} casas com navio depois do clique`);
  await p.locator('.duelo-desistir').click().catch(() => {});

  erros.length ? falhou('erros na página: ' + erros.join(' | ')) : ok('nenhum erro de página');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('naval-montagem');
}
