// A PONTE DA TOCA NA SALA (06/11/2026): a turma monta a mesma fase ao mesmo tempo, cada um na própria tela.
//
// - A Nina e o Teo estão na Sala 1. A Nina chama a Ponte pela aba Coletivo e escolhe a fase 1; o Teo aceita, e ela começa.
// - Os dois veem a mesma fase e o mesmo relógio. A Nina monta a ponte de referência (com aço nos apoios) e aperta "Pronto"; o Teo
//   monta a mesma treliça só de madeira, mais barata, e NÃO aperta nada: os 30 s do relógio acabam e a ponte dele vai sozinha.
// - No fim, o placar com as duas pontes que passaram, o Teo em primeiro (a mais barata), e a ponte dele passando na tela da Nina.
//
//   node e2e/ponte-na-sala.mjs   (API de teste, site de desenvolvimento e LiveKit local; SITE=... e API=... para outras portas)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
const API = process.env.API ?? 'http://localhost:3099';
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `ponte-sala-${nome}.png`) });
// a treliça do riacho só de madeira (a de referência sem as duas escoras de aço)
const P = 0;
const M = 1;
const SO_MADEIRA = [
  0, 0, 2, 0, P, 2, 0, 4, 0, P, 4, 0, 6, 0, P,
  1, 1, 3, 1, M, 3, 1, 5, 1, M,
  0, 0, 1, 1, M, 1, 1, 2, 0, M, 2, 0, 3, 1, M, 3, 1, 4, 0, M, 4, 0, 5, 1, M, 5, 1, 6, 0, M,
];

const { browser } = await abrirNavegador();
const pessoa = async () =>
  vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());
try {
  const nina = await pessoa();
  await cadastrar(nina, 'nina' + s);
  await dispensarPresentes(nina);
  await nina.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await nina.locator('.community-choice-option').first().click();
  await nina.locator('form.dialog input').first().fill('Ponte ' + s);
  await nina.locator('form.dialog .btn-primary').click();
  await nina.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await nina.evaluate(async (api) => {
    const r = await fetch(api + '/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Ponte'))?.inviteCode;
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
  await nina.locator('.minijogo-jogo', { hasText: 'Ponte da toca' }).click();
  await nina.locator('.ponte-fase-botao').first().click();
  await teo.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await teo.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await nina.locator('.minijogo-espera-lista li', { hasText: 'teo' + s }).waitFor({ timeout: 5000 });
  await nina.getByRole('button', { name: 'Começar' }).click();
  for (const p of [nina, teo]) await p.locator('.ponte-contagem').waitFor({ timeout: 15000 });
  ok('a fase abriu para os dois, com a contagem');
  for (const p of [nina, teo]) await p.locator('.ponte-contagem').waitFor({ state: 'detached', timeout: 10000 });

  await nina.evaluate(() => window.ponteMontar());
  await teo.evaluate((lista) => window.ponteMontar(lista), SO_MADEIRA);
  const relogios = await Promise.all([nina, teo].map((p) => p.locator('.ponte-relogio').innerText()));
  const seg = relogios.map((r) => Number(r.split(':')[1]));
  Math.abs(seg[0] - seg[1]) <= 1 ? ok(`o mesmo relógio para os dois (${relogios.join(' e ')})`) : falhou(`relógios diferentes: ${relogios.join(' e ')}`);
  await foto(teo, 'montando');
  await nina.getByRole('button', { name: 'Pronto' }).click();
  await nina.locator('.ponte-fim').waitFor({ timeout: 10000 });
  ok('a Nina mandou e vê a ponte dela passando enquanto espera');

  // o Teo não aperta nada: o relógio acaba e a ponte dele vai sozinha
  await nina.locator('.ponte-placar li').nth(1).waitFor({ timeout: 45_000 });
  ok('os 30 s acabaram e a ponte do Teo foi sozinha');
  const linhas = await nina.locator('.ponte-placar li').allInnerTexts();
  linhas.length === 2 && linhas[0].includes('teo' + s) && linhas[0].trim().startsWith('1') && linhas[1].trim().startsWith('2')
    ? ok('no placar, o Teo em primeiro (a mais barata que passou): ' + linhas.map((l) => l.replace(/\s+/g, ' ')).join(' | '))
    : falhou('o placar: ' + linhas.join(' | '));
  const deQuem = await nina.locator('.ponte-de-quem').innerText();
  deQuem.includes('teo' + s) ? ok('na tela da Nina, a ponte vencedora (a do Teo) passando') : falhou(`a tela mostra a ponte de ${deQuem}`);
  await nina.waitForTimeout(3000);
  await foto(nina, 'fim');
  // clicar na linha da Nina mostra a ponte dela
  await nina.locator('.ponte-placar li').nth(1).locator('button').click();
  (await nina.locator('.ponte-de-quem').innerText()).includes('nina' + s) ? ok('clicar na linha troca a ponte na tela') : falhou('a linha não trocou a ponte');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('ponte da toca na sala');
}
