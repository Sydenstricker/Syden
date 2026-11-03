// A BRIGA NA HORTA NA SALA (03/11/2026): a turma contra as mesmas raposas, corvos e o texugo.
//
// - A Duda e o Edu estão na Sala 1. A Duda chama a Briga na horta pela aba Coletivo, o Edu aceita, e ela dá a largada.
// - Os dois ligam o piloto automático (window.brigaPilotoAutomatico, só no site de desenvolvimento): o coelho anda até o
//   inimigo mais perto e bate; sem inimigo, anda para a direita, atrás da seta.
// - Confere: o quadro do servidor chega (os inimigos aparecem na tela), a vida e os pontos andam no placar de cima, as ondas
//   avançam, e a fase acaba com "A horta está salva!", o placar e o troféu da briga no quarto de quem ficou no pódio.
// - Depois, a Duda joga sozinha pela aba Solo, sem convite, e encerra.
//
//   node e2e/briga.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `briga-${nome}.png`) });

const { browser } = await abrirNavegador();
const pessoa = async () =>
  vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());

/** Os pontos de cada um no placar de cima. */
const pontosNaTela = (pagina) => pagina.locator('.briga-hud li strong').allInnerTexts().then((l) => l.map(Number));

try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Briga ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Briga'))?.inviteCode;
  });
  const edu = await pessoa();
  await cadastrar(edu, 'edu' + s);
  await dispensarPresentes(edu);
  await edu.evaluate(
    async (codigo) =>
      fetch('http://localhost:3099/api/communities/join', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
        body: JSON.stringify({ code: codigo }),
      }),
    convite,
  );
  await edu.reload();
  await dispensarPresentes(edu);
  for (const p of [duda, edu]) {
    await p.locator('.rail-item', { hasText: /^B/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('os dois estão na Sala 1');

  await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Briga na horta' }).click();
  await edu.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await duda.locator('.minijogo-espera-lista li', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
  await duda.getByRole('button', { name: 'Começar' }).click();
  for (const p of [duda, edu]) await p.locator('.briga-tela canvas').waitFor({ timeout: 10000 });
  ok('a briga abriu para os dois');

  // o quadro do servidor chega: o placar de cima mostra as duas pessoas
  await duda.locator('.briga-hud li').nth(1).waitFor({ timeout: 10000 });
  ok('o placar de cima tem as duas pessoas');
  await foto(duda, 'comeco');

  for (const p of [duda, edu]) await p.evaluate(() => (window.brigaPilotoAutomatico = true));
  // alguém bate: os pontos sobem
  const fimDosPontos = Date.now() + 30000;
  let pontos = [0, 0];
  while (Date.now() < fimDosPontos && pontos.every((n) => n === 0)) {
    await duda.waitForTimeout(500);
    pontos = await pontosNaTela(duda);
  }
  pontos.some((n) => n > 0) ? ok(`os acertos contam: ${pontos.join(' e ')} pontos`) : falhou('ninguém pontuou em 30 s');
  await foto(duda, 'lutando');

  // a fase inteira (o piloto leva ~2 min sozinho; com dois, menos)
  await duda.locator('.briga-desfecho').waitFor({ timeout: 6 * 60_000 });
  const desfecho = await duda.locator('.briga-desfecho').innerText();
  desfecho.includes('A horta está salva!') ? ok('a fase foi vencida') : falhou(`o fim: ${desfecho}`);
  const final = (await duda.locator('.minijogo-placar li').allInnerTexts()).map((l) => l.replace(/\n/g, ' '));
  final.length === 2 && final[0].includes('🥇') ? ok(`o placar final: ${final.join(' | ')}`) : falhou(`placar final: ${final.join(' | ')}`);
  await foto(duda, 'fim');
  const trofeus = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/corrida-trofeus', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).trofeus;
  });
  trofeus.some((t) => t.pista === 'briga' && t.rivais.length === 1)
    ? ok(`o troféu da briga está no quarto da Duda: ${trofeus.map((t) => `${t.pista} ${t.posicao}º`).join(', ')}`)
    : falhou(`troféus da Duda: ${JSON.stringify(trofeus)}`);

  // sozinha, pela aba Solo
  await duda.locator('.minijogo-acoes').getByRole('button', { name: 'Outros jogos' }).click();
  await duda.waitForTimeout(800);
  if (!(await duda.locator('.minijogo').count())) await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Solo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Briga na horta' }).click();
  await duda.locator('.briga-tela canvas').waitFor({ timeout: 10000 });
  (await edu.locator('.minijogo-convite').count()) === 0 ? ok('no Solo, a briga começa sem convite') : falhou('o Solo convidou a sala');
  // no Solo o quadro vem pelo canal da pessoa
  await duda.locator('.briga-hud li').first().waitFor({ timeout: 10000 });
  const fimSolo = Date.now() + 30000;
  pontos = [0];
  while (Date.now() < fimSolo && pontos.every((n) => n === 0)) {
    await duda.waitForTimeout(500);
    pontos = await pontosNaTela(duda);
  }
  pontos[0] > 0 ? ok(`no Solo, os acertos contam: ${pontos[0]}`) : falhou('no Solo, ninguém pontuou');
  await foto(duda, 'solo');
  await duda.getByRole('button', { name: 'Encerrar partida' }).click();
  await duda.locator('.minijogo-estante').waitFor({ timeout: 10000 });
  ok('encerrar o Solo volta à estante');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('briga');
}
