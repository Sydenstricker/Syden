// A GINCANA DA TOCA NA SALA (06/11/2026): a turma corre o mesmo percurso, cada um no próprio computador.
//
// - A Nina e o Teo estão na Sala 1. A Nina chama a Gincana pela aba Coletivo e escolhe o primeiro percurso; o Teo aceita, e ela
//   começa.
// - Na largada, o percurso em 3D para os dois; durante a corrida, cada um vê o coelho do outro (as posições que o servidor
//   repassa, com o nome em cima) e a ordem ao vivo. Os dois correm com o piloto automático.
// - No fim, a classificação com os tempos que o servidor refez, e as medalhas.
//
//   SITE=http://localhost:5187 API=http://localhost:3137 node e2e/gincana-na-sala.mjs   (API de teste, site de desenvolvimento e
//   LiveKit local)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
const API = process.env.API ?? 'http://localhost:3099';
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `gincana-sala-${nome}.png`) });

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
  await nina.locator('.minijogo-jogo', { hasText: 'Gincana da toca' }).click();
  await nina.locator('.gincana-escolha-sala .gincana-percurso').first().click();
  await teo.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await teo.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await nina.locator('.minijogo-espera-lista li', { hasText: 'teo' + s }).waitFor({ timeout: 5000 });
  await nina.getByRole('button', { name: 'Começar' }).click();
  await nina.locator('.gincana-caixa:not(.escondida)').waitFor({ timeout: 30000 });
  await teo.locator('.gincana-caixa:not(.escondida)').waitFor({ timeout: 30000 });
  ok('o percurso abriu para os dois');
  await nina.evaluate(() => (window.gincanaPilotoAutomatico = true));
  await nina.waitForTimeout(2500);
  await teo.evaluate(() => (window.gincanaPilotoAutomatico = true));
  await nina.waitForTimeout(7000);
  // o coelho do Teo anda na tela da Nina (as posições que o servidor repassa)
  await foto(nina, 'correndo');
  await foto(teo, 'correndo-teo');
  (await nina.locator('.gincana-ordem li').count()) === 2 ? ok('a ordem ao vivo tem os dois') : falhou('a ordem ao vivo não tem os dois');

  await nina.locator('.gincana-classificacao').waitFor({ timeout: 120_000 });
  ok('a Nina chegou e vê a lista');
  await nina.locator('.gincana-classificacao li', { hasText: '🥇' }).first().waitFor({ timeout: 120_000 });
  const linhas = await nina.locator('.gincana-classificacao li').allInnerTexts();
  // com o mesmo piloto automático os dois podem empatar (o que se mexe anda pelo passo, e o plano espera pela mesma
  // plataforma): o empate divide a medalha, e só ele
  const tempos = linhas.map((l) => /\d:\d\d\.\d\d/.exec(l)?.[0]);
  const medalhaDoSegundo = tempos[0] === tempos[1] ? '🥇' : '🥈';
  linhas.length === 2 && linhas[0].includes('🥇') && linhas[1].includes(medalhaDoSegundo) && tempos.every(Boolean)
    ? ok('no fim, as medalhas e os tempos que o servidor refez: ' + linhas.map((l) => l.replace(/\s+/g, ' ')).join(' | '))
    : falhou('a classificação: ' + linhas.join(' | '));
  await foto(nina, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('gincana da toca na sala');
}
