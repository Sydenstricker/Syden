// O ROLÊ DO COELHO NA SALA (06/11/2026): a turma anda na mesma pista, cada um no próprio computador, e vê os outros como fantasmas.
//
// - A Nina e o Teo estão na Sala 1. A Nina chama o Rolê do coelho pela aba Coletivo; o Teo aceita, e ela começa.
// - O verde é o do servidor; durante a sessão, cada um vê o coelho do outro (meio transparente, com o nome em cima: as posições
//   que o servidor repassa) e a ordem ao vivo. Os dois andam com o piloto automático (o do Teo começa uns segundos depois,
//   para os pontos serem diferentes).
// - No fim, o placar com os pontos que o servidor REFEZ pelos comandos, e as medalhas.
//
//   SITE=http://localhost:5197 API=http://localhost:3147 node e2e/skate-na-sala.mjs   (API de teste, site de desenvolvimento e
//   LiveKit local)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
const API = process.env.API ?? 'http://localhost:3099';
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `skate-sala-${nome}.png`) });

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
  await nina.locator('.minijogo-jogo', { hasText: 'Rolê do coelho' }).click();
  await teo.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await teo.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await nina.locator('.minijogo-espera-lista li', { hasText: 'teo' + s }).waitFor({ timeout: 5000 });
  await nina.getByRole('button', { name: 'Começar' }).click();
  await nina.locator('.skate-caixa:not(.escondida)').waitFor({ timeout: 30000 });
  await teo.locator('.skate-caixa:not(.escondida)').waitFor({ timeout: 30000 });
  ok('a pista abriu para os dois');
  await nina.evaluate(() => (window.skatePilotoAutomatico = true));
  await nina.waitForTimeout(6000);
  await teo.evaluate(() => (window.skatePilotoAutomatico = true));
  await nina.waitForTimeout(9000);
  // o coelho do Teo anda na tela da Nina (as posições que o servidor repassa), e a ordem ao vivo tem os dois
  await foto(nina, 'andando');
  await foto(teo, 'andando-teo');
  (await nina.locator('.skate-ordem li').count()) === 2 ? ok('a ordem ao vivo tem os dois') : falhou('a ordem ao vivo não tem os dois');
  const andou = await nina.evaluate(() => window.skateSessaoDoTeste?.passo ?? 0);
  andou > 300 ? ok(`a sessão da Nina anda (${andou} passos)`) : falhou(`a sessão da Nina não anda: ${andou}`);

  // o minuto, e a folga para fechar o combo
  await nina.locator('.skate-placar li', { hasText: '🥇' }).first().waitFor({ timeout: 150_000 });
  await teo.locator('.skate-placar li', { hasText: '🥇' }).first().waitFor({ timeout: 30_000 });
  const linhas = await nina.locator('.skate-placar li').allInnerTexts();
  const pontos = linhas.map((l) => Number(/([\d.,]+)\s*$/.exec(l)?.[1]?.replace(/[.,]/g, '')));
  const medalhaDoSegundo = pontos[0] === pontos[1] ? '🥇' : '🥈';
  linhas.length === 2 && linhas[0].includes('🥇') && linhas[1].includes(medalhaDoSegundo) && pontos.every((p) => p > 0)
    ? ok('no fim, as medalhas e os pontos que o servidor refez: ' + linhas.map((l) => l.replace(/\s+/g, ' ')).join(' | '))
    : falhou('o placar: ' + linhas.join(' | '));
  // os pontos que a sessão da Nina fez na tela dela são os que o servidor refez
  const meus = await nina.evaluate(() => window.skateSessaoDoTeste?.pontos);
  pontos.includes(meus) ? ok(`os pontos da Nina na tela (${meus}) são os refeitos`) : falhou(`os pontos da Nina (${meus}) não batem com o placar`);
  await foto(nina, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('rolê do coelho na sala');
}
