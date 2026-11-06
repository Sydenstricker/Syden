// OS CARRINHOS DA TOCA NA SALA (06/11/2026): a turma corre junto, cada um na sua faixa.
//
// - A Nina e o Teo estão na Sala 1. A Nina chama os Carrinhos pela aba Coletivo; o Teo aceita, e ela começa.
// - Na largada, a pista em 3D para os dois; durante a corrida, cada um vê o carro do outro andando na faixa dele (as posições
//   que o servidor repassa). Os dois correm com o piloto automático.
// - No fim, a classificação com os tempos que o servidor refez, e as medalhas.
//
//   node e2e/carrinhos-na-sala.mjs   (API de teste, site de desenvolvimento e LiveKit local; SITE=... e API=... para outras portas)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
const API = process.env.API ?? 'http://localhost:3099';
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `carrinhos-sala-${nome}.png`) });

const { browser } = await abrirNavegador();
const pessoa = async () =>
  vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());
try {
  const nina = await pessoa();
  await cadastrar(nina, 'nina' + s);
  await dispensarPresentes(nina);
  await nina.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await nina.locator('.community-choice-option').first().click();
  await nina.locator('form.dialog input').first().fill('Pista ' + s);
  await nina.locator('form.dialog .btn-primary').click();
  await nina.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await nina.evaluate(async (api) => {
    const r = await fetch(api + '/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Pista'))?.inviteCode;
  }, API);
  const teo = await pessoa();
  await cadastrar(teo, 'teo' + s);
  await dispensarPresentes(teo);
  await teo.evaluate(
    async ([api, codigo]) =>
      fetch(api + '/api/communities/join', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
        body: JSON.stringify({ code: codigo }),
      }),
    [API, convite],
  );
  await teo.reload();
  await dispensarPresentes(teo);
  for (const p of [nina, teo]) {
    await p.locator('.rail-item', { hasText: /^P/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('os dois estão na Sala 1');

  await nina.getByRole('button', { name: 'Mini-games' }).click();
  await nina.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  await nina.locator('.minijogo-jogo', { hasText: 'Carrinhos da toca' }).click();
  await teo.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await teo.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await nina.locator('.minijogo-espera-lista li', { hasText: 'teo' + s }).waitFor({ timeout: 5000 });
  await nina.getByRole('button', { name: 'Começar' }).click();
  await nina.locator('.carrinhos-caixa:not(.escondida)').waitFor({ timeout: 30000 });
  await teo.locator('.carrinhos-caixa:not(.escondida)').waitFor({ timeout: 30000 });
  ok('a pista abriu para os dois');
  await nina.evaluate(() => (window.carrinhosPilotoAutomatico = true));
  await nina.waitForTimeout(2000);
  await teo.evaluate(() => (window.carrinhosPilotoAutomatico = true));
  await nina.waitForTimeout(6000);
  // o carro do Teo anda na tela da Nina (as posições que o servidor repassa)
  await foto(nina, 'correndo');
  (await nina.locator('.carrinhos-ordem li').count()) === 2 ? ok('a ordem ao vivo tem os dois') : falhou('a ordem ao vivo não tem os dois');

  await nina.locator('.carrinhos-classificacao').waitFor({ timeout: 90_000 });
  ok('a Nina chegou e vê a lista');
  await nina.locator('.carrinhos-classificacao li', { hasText: '🥇' }).waitFor({ timeout: 90_000 });
  const linhas = await nina.locator('.carrinhos-classificacao li').allInnerTexts();
  // (quem tem a janela sem foco fica parado e não perde tempo por isso: a ordem entre os dois é a dos tempos de cada um)
  linhas.length === 2 && linhas[0].includes('🥇') && linhas[1].includes('🥈') && linhas.every((l) => /\d:\d\d\.\d\d/.test(l))
    ? ok('no fim, as medalhas e os tempos que o servidor refez: ' + linhas.map((l) => l.replace(/\s+/g, ' ')).join(' | '))
    : falhou('a classificação: ' + linhas.join(' | '));
  await foto(nina, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('carrinhos da toca na sala');
}
