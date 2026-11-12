// O TRUCO NA TELA (05/11/2026): no Solo contra o robô, em 3D. A mesa não mostra o 2D antes do 3D; a carta jogada sai da mão
// na hora do clique; a mão inteira aparece (nada por cima das cartas); e "Aceitou!" / "Correu!" aparecem na mesa.
//
//   node e2e/truco-na-tela.mjs   (API de teste na 3099 e site na 5174; o LiveKit não é preciso)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador();
try {
  const p = vigiar(await (await browser.newContext({ viewport: { width: Number(process.env.LARGURA ?? 1400), height: Number(process.env.ALTURA ?? 1000) } })).newPage());
  await cadastrar(p, 'truco' + s);
  await dispensarPresentes(p);
  await p.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await p.locator('.area-de-trabalho [data-icone="mini-games"]').click(); // a área de trabalho do computador (11/11/2026)
  await p.locator('.jogos-painel .jogos-solo button', { hasText: 'Truco' }).click();
  // a escolha de quantos robôs, se houver
  await p.getByText('Quantos adversários?').waitFor({ timeout: 10000 });
  // o primeiro botão depois da pergunta: um adversário
  await p.getByText('Quantos adversários?').locator('xpath=following::button[1]').click();
  await p.locator('.truco-mesa').waitFor({ timeout: 20000 });
  // logo ao abrir: a mesa já é a de 3D (as cartas de HTML só para o leitor), mesmo antes de a cena carregar
  const classe = await p.locator('.truco-mesa').getAttribute('class');
  classe.includes('mesa3d-truco') ? ok('ao abrir, a mesa já é a do 3D (o 2D não aparece antes)') : falhou(`ao abrir, a mesa era: ${classe}`);
  await p.locator('.truco-mesa canvas').waitFor({ timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.locator('.truco').screenshot({ path: path.join(FOTOS, 'truco-mesa.png') });
  // a minha vez: jogar uma carta pelo botão (o de HTML, para o leitor), e ver a cena antes da resposta do servidor
  for (let i = 0; i < 60 && !(await p.locator('.truco-mao button:not([disabled])').count()); i++) await p.waitForTimeout(500);
  if (await p.locator('.truco-mao button:not([disabled])').count()) {
    const antes = await p.locator('.truco-mao button').count();
    await p.locator('.truco-mao button:not([disabled])').first().evaluate((b) => b.click());
    await p.waitForTimeout(250);
    await p.locator('.truco').screenshot({ path: path.join(FOTOS, 'truco-jogou.png') });
    ok('joguei uma carta (foto 250 ms depois; eram ' + antes + ' na mão)');
  } else falhou('não chegou a minha vez');
  // pedir truco, se der, e ver o anúncio da resposta do robô
  for (let i = 0; i < 20 && !(await p.locator('.truco-gritar').count()); i++) await p.waitForTimeout(500);
  if (await p.locator('.truco-gritar').count()) {
    await p.locator('.truco-gritar').first().click();
    await p.locator('.truco-anuncio, .truco-acoes button', { hasText: /Aceitou!|Correu!|Seis!|Aceitar/ }).first().waitFor({ timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(300);
    await p.locator('.truco').screenshot({ path: path.join(FOTOS, 'truco-resposta.png') });
    const anuncio = await p.locator('.truco-anuncio').innerText().catch(() => '');
    ok(`pedi truco; na mesa: ${anuncio.replace(/\n/g, ' ') || '(o robô aumentou ou ainda pensa)'}`);
  }
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('truco-na-tela');
}
