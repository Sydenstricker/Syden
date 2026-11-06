// AS FASES DA BRIGA NA HORTA (06/11/2026): a escolha da fase, e cada uma com o cenário e os bichos dela.
//
// - A Duda entra na Sala 1, abre os Mini-games pela aba Solo e clica na Briga: abre a ESCOLHA DA FASE (as cinco e a campanha).
// - Em cada fase: liga o piloto automático (window.brigaPilotoAutomatico, só no site de desenvolvimento), espera os bichos
//   da fase aparecerem e o placar andar, fotografa a tela do jogo (e2e/fotos/briga-fase-<fase>.png) e encerra.
// - Por último, a campanha: começa pela horta, com o nome "Campanha" na escolha.
//
//   node e2e/briga-fases.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const FASES = [
  ['horta', 'Horta'],
  ['floresta', 'Floresta'],
  ['deserto', 'Deserto'],
  ['neve', 'Neve'],
  ['castelo', 'Castelo'],
];

const { browser } = await abrirNavegador();
const pontosNaTela = (pagina) => pagina.locator('.briga-hud li strong').allInnerTexts().then((l) => l.map(Number));

try {
  const duda = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Fases ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  await duda.locator('.rail-item', { hasText: /^F/ }).first().click().catch(() => {});
  await duda.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await duda.locator('.stage-controls').waitFor({ timeout: 30000 });
  await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Solo' }).click();

  for (const [id, nome] of FASES) {
    await duda.locator('.minijogo-jogo', { hasText: 'Briga na horta' }).click();
    await duda.locator('.corrida-escolha').waitFor({ timeout: 5000 });
    if (id === 'horta') {
      await duda.waitForTimeout(2200);
      await duda.locator('.corrida-escolha').screenshot({ path: path.join(FOTOS, 'briga-escolha.png') });
      const botoes = await duda.locator('.corrida-pista-botao strong').allInnerTexts();
      botoes.length === 6 && botoes.at(-1) === 'Campanha' ? ok(`a escolha: ${botoes.join(', ')}`) : falhou(`a escolha: ${botoes.join(', ')}`);
    }
    await duda.locator('.corrida-pista-botao', { has: duda.locator('strong', { hasText: new RegExp(`^${nome}$`) }) }).click();
    await duda.locator('.briga-tela canvas').waitFor({ timeout: 10000 });
    // o nome da fase aparece no começo
    const titulo = await duda.locator('.briga-titulo').innerText({ timeout: 3000 }).catch(() => '');
    titulo === nome ? ok(`${id}: o nome da fase aparece (${titulo})`) : falhou(`${id}: o título era "${titulo}"`);
    await duda.evaluate(() => (window.brigaPilotoAutomatico = true));
    const fim = Date.now() + 40000;
    let pontos = [0];
    while (Date.now() < fim && pontos.every((n) => n === 0)) {
      await duda.waitForTimeout(500);
      pontos = await pontosNaTela(duda);
    }
    pontos[0] > 0 ? ok(`${id}: os acertos contam (${pontos[0]})`) : falhou(`${id}: ninguém pontuou`);
    await duda.waitForTimeout(1500);
    await duda.locator('.briga-tela').screenshot({ path: path.join(FOTOS, `briga-fase-${id}.png`) });
    // e um pouco depois, com a câmera em outro lugar (o parallax correu)
    await duda.waitForTimeout(6000);
    await duda.locator('.briga-tela').screenshot({ path: path.join(FOTOS, `briga-fase-${id}-2.png`) });
    await duda.getByRole('button', { name: 'Encerrar partida' }).click();
    // encerrar o Solo fecha o painel: abre de novo, na aba Solo
    await duda.waitForTimeout(800);
    if (!(await duda.locator('.minijogo').count())) await duda.getByRole('button', { name: 'Mini-games' }).click();
    await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Solo' }).click();
    await duda.locator('.minijogo-estante').waitFor({ timeout: 10000 });
  }

  await duda.locator('.minijogo-jogo', { hasText: 'Briga na horta' }).click();
  await duda.locator('.corrida-pista-botao', { hasText: 'Campanha' }).click();
  await duda.locator('.briga-tela canvas').waitFor({ timeout: 10000 });
  const titulo = await duda.locator('.briga-titulo').innerText({ timeout: 3000 }).catch(() => '');
  titulo === 'Horta' ? ok('a campanha começa pela horta') : falhou(`a campanha começou em "${titulo}"`);
  await duda.getByRole('button', { name: 'Encerrar partida' }).click();
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('briga-fases');
}
