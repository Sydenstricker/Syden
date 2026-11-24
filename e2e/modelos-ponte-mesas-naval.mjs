// OS MODELOS POR SCRIPT NO JOGO (24/11/2026, web/scripts/modelos/ponte-mesas-naval/): fotografa cada um no lugar, no Solo pelo
// computador do quarto, para conferir a escala e o estilo ao lado do que já estava na cena.
//
// - A Ponte: a fase 4 (os pilares de pedra), a 5 (a pedra do meio do rio, com o caminhão) e a 16 (o canal, com o barco
//   passando na ponte de referência); as árvores, os blocos de apoio e a bandeira de chegada aparecem em todas.
// - As mesas: a Mancala (as covas escavadas, com as sementes dentro), o Cinco em linha e as Damas de 10 × 10.
// - A Batalha naval com a frota de guerra (localStorage 'syden:naval-frota' = 'guerra'), nos três mares, com a frota sorteada.
//
//   node e2e/modelos-ponte-mesas-naval.mjs   (API de teste na 3099 e site na 5174; o LiveKit não é preciso)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos', 'modelos', 'ponte-mesas-naval');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

const { browser } = await abrirNavegador();
try {
  const p = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  const naoAchou = [];
  p.on('response', (r) => {
    if (r.status() >= 400 && /cenario\.glb|tabuleiro-|guerra\//.test(r.url())) naoAchou.push(r.url());
  });
  await cadastrar(p, 'modelos' + s);
  await dispensarPresentes(p);

  const computador = async () => {
    await p.locator('.minijogo-topo button[aria-label="Fechar"]').click({ timeout: 2000 }).catch(() => {});
    await p.locator('.rail-logo').click().catch(() => {});
    const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
    await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
    await p.locator('.area-de-trabalho [data-icone="mini-games"]').click();
    await p.locator('.jogos-painel').waitFor();
  };

  // ---------------- a Ponte ----------------
  const ponte = async (n, nome, testar) => {
    await computador();
    await p.locator('.jogos-painel .jogos-solo button', { hasText: 'Ponte da toca' }).click();
    await p.locator('.ponte-fase-botao').first().waitFor({ timeout: 10000 });
    await p.locator('.ponte-fase-botao').nth(n - 1).click();
    await p.locator('.ponte-tela[data-modo="3d"]').waitFor({ timeout: 20000 });
    await p.locator('.ponte-contagem').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
    if (testar) {
      await p.evaluate(() => window.ponteMontar());
      await p.waitForTimeout(300);
      await p.getByRole('button', { name: 'Testar' }).click();
      await p.waitForTimeout(testar);
    } else await p.waitForTimeout(1200);
    await p.locator('.ponte').first().screenshot({ path: path.join(FOTOS, `jogo-ponte-${nome}.png`) });
    ok(`a Ponte, fase ${n} (${nome}), fotografada`);
  };
  await ponte(4, 'pilares');
  await ponte(5, 'pedra', 2600);
  await ponte(16, 'canal-barco', 2900);
  await ponte(16, 'canal-barco-chegando', 1900);

  // ---------------- as mesas ----------------
  const mesa = async (jogo, nome, antes) => {
    await computador();
    await p.locator('.jogos-painel .jogos-solo button', { hasText: jogo }).first().click();
    if (antes) await antes();
    await p.locator('.minijogo-acoes .btn-primary').first().click();
    await p.locator('.mesa3d-caixa:not(.escondida) canvas, .mesa3d-caixa:not(.escondida)').first().waitFor({ timeout: 20000 });
    await p.waitForTimeout(2500);
    await p.locator('.mesa3d-tabuleiro, .mesa3d-caixa').first().screenshot({ path: path.join(FOTOS, `jogo-${nome}.png`) });
    ok(`${jogo} fotografada`);
  };
  await mesa('Mancala', 'mancala');
  await mesa('Cinco em linha', 'gomoku');
  await mesa('Damas', 'damas-10', () => p.getByRole('button', { name: '10 × 10' }).click());

  // ---------------- a Batalha naval, frota de guerra ----------------
  await p.evaluate(() => localStorage.setItem('syden:naval-frota', 'guerra'));
  for (const lado of [8, 10, 12]) {
    await computador();
    await p.locator('.jogos-painel .jogos-solo button', { hasText: 'Batalha naval' }).first().click();
    await p.getByRole('button', { name: `${lado} × ${lado}` }).click().catch(() => {});
    await p.locator('.minijogo-acoes .btn-primary').first().click().catch(() => {});
    await p.locator('.naval-montagem').waitFor({ timeout: 20000 });
    await p.getByRole('button', { name: 'Sortear a frota' }).click();
    await p.waitForTimeout(2500);
    (await p.getByRole('radio', { name: 'Navios de guerra' }).getAttribute('aria-checked')) === 'true'
      ? ok('a frota de guerra está escolhida')
      : falhou('a frota de guerra não ficou escolhida');
    await p.locator('.naval-3d-tela').first().screenshot({ path: path.join(FOTOS, `jogo-naval-guerra-${lado}.png`) });
    ok(`a Batalha naval de ${lado} × ${lado} com a frota de guerra, fotografada`);
  }

  naoAchou.length === 0 ? ok('todos os modelos novos carregaram') : falhou('não carregaram: ' + naoAchou.join(', '));
  erros.length === 0 ? ok('sem erro na página') : falhou('erros: ' + erros.slice(0, 3).join(' | '));
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
}
resumo();
