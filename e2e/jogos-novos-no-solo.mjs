// OS JOGOS NOVOS DE 05/11/2026 NO SOLO, pela estante do computador do quarto: Tocas e Torres, Futebol dos coelhos e Minigolfe 3D.
// Cada um abre, o piloto automático joga uns segundos, e a foto fica; nenhum erro de página.
//
//   node e2e/jogos-novos-no-solo.mjs   (API de teste na 3099 e site na 5174)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const JOGOS = [
  { nome: 'Tocas e Torres', piloto: 'tocasPilotoAutomatico', tela: 'canvas', foto: 'solo-tocas.png', espera: 12000 },
  { nome: 'Futebol dos coelhos', piloto: 'futebolPilotoAutomatico', tela: 'canvas', foto: 'solo-futebol.png', espera: 8000 },
  { nome: 'Minigolfe 3D', piloto: 'golfe3dPilotoAutomatico', tela: 'canvas', foto: 'solo-golfe3d.png', espera: 9000 },
];
const { browser } = await abrirNavegador();
try {
  for (const j of JOGOS) {
    const p = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
    const erros = [];
    p.on('pageerror', (e) => erros.push(String(e)));
    await cadastrar(p, 'novo' + Date.now().toString().slice(-6));
    await dispensarPresentes(p);
    await p.locator('.rail-logo').click().catch(() => {});
    const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
    await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await p.evaluate((k) => (window[k] = true), j.piloto);
    await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
    await p.locator('.jogos-painel .jogos-solo button', { hasText: j.nome }).evaluate((b) => b.click());
    // escolha que alguns pedem (quantos por time, por exemplo): o primeiro botão da escolha, se houver
    await p.waitForTimeout(1500);
    await p.locator('.minijogo-painel canvas, .minijogo canvas, canvas').first().waitFor({ timeout: 30000 }).catch(async () => {
      const escolha = p.locator('.minijogo-escolha button, .futebol-escolha button').first();
      if (await escolha.count()) await escolha.click();
      await p.locator('canvas').first().waitFor({ timeout: 30000 });
    });
    await p.waitForTimeout(j.espera);
    await p.screenshot({ path: path.join(FOTOS, j.foto) });
    erros.length ? falhou(`${j.nome}: ${erros.join(' | ')}`) : ok(`${j.nome}: abriu e o piloto jogou, sem erro de página`);
    await p.context().close();
  }
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('jogos-novos-no-solo');
}
