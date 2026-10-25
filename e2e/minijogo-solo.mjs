// A ABA SOLO (24/10/2026): "na aba solo joga sozinho, na coletiva manda convite". Duas pessoas na sala.
//
// - A Duda escolhe Monstros de fantasia na aba Solo: o jogo começa na hora, sem convite, e o Edu não recebe nada.
// - Com a Duda jogando sozinha, o Edu começa um jogo da turma na mesma sala (a partida solo não a ocupa), e o painel
//   da Duda continua no jogo dela; o convite do Edu chega a ela pelo aviso pequeno.
// - Pelo computador do quarto, sem entrar em chamada, a Duda joga Países sozinha.
//
//   node e2e/minijogo-solo.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

const { browser } = await abrirNavegador();
const pessoa = async () =>
  vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());
try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Solo ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Solo'))?.inviteCode;
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
    await p.locator('.rail-item', { hasText: /^S/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('os dois estão na Sala 1');

  // ---- Na sala, aba Solo: começa na hora, sem convite ----
  await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Solo' }).click();
  const solo = await duda.locator('.minijogo-jogo span').allInnerTexts();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  const coletivo = await duda.locator('.minijogo-jogo span').allInnerTexts();
  const nasDuas = ['Qual é o tamanho?', 'Monstros de fantasia', 'Mitologia', 'Países', 'Problemas de xadrez', 'Sudoku'];
  nasDuas.every((n) => solo.includes(n) && coletivo.includes(n))
    ? ok(`os seis jogos estão nas duas abas (Solo: ${solo.length}, Coletivo: ${coletivo.length})`)
    : falhou(`Solo: ${solo.join(', ')} | Coletivo: ${coletivo.join(', ')}`);
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Solo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Monstros de fantasia' }).click();
  await duda.locator('.quiz-busca input').waitFor({ timeout: 10000 });
  ok('Solo: o quiz começou na hora, sem sala de espera');
  await edu.waitForTimeout(1500);
  (await edu.locator('.minijogo-convite').count()) === 0 ? ok('o Edu não recebeu convite nenhum') : falhou('o Edu recebeu convite da partida solo');
  await duda.locator('.quiz-busca input').fill('lich');
  await duda.locator('.quiz-busca li').first().waitFor({ timeout: 5000 });
  await duda.keyboard.press('Enter');
  await duda.locator('.quiz-tabela tbody tr').first().waitFor({ timeout: 5000 });
  ok('Solo: o chute virou linha');

  // ---- A sala continua livre: o Edu chama a turma para o Stop ----
  await edu.getByRole('button', { name: 'Mini-games' }).click();
  await edu.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  await edu.locator('.minijogo-jogo', { hasText: 'Stop' }).click();
  await edu.locator('.minijogo-espera').waitFor({ timeout: 10000 });
  ok('com a Duda jogando sozinha, o Edu começou um jogo da turma na mesma sala');
  await duda.waitForTimeout(1500);
  (await duda.locator('.quiz-tabela').count()) === 1 ? ok('o painel da Duda continua no jogo dela') : falhou('o painel da Duda saiu do jogo solo');
  await duda.locator('.minijogo').screenshot({ path: path.join(FOTOS, 'solo-na-sala.png') });
  await duda.locator('.minijogo-encerrar').click();
  await duda.waitForTimeout(800);

  // ---- Pelo computador do quarto, sem chamada ----
  await duda.locator('.leave-button').click();
  await duda.locator('.rail-logo').click();
  const quarto = await (await duda.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await duda.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  const painel = duda.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Países' }).click();
  await duda.locator('.minijogo-no-quarto .quiz-busca input').waitFor({ timeout: 10000 });
  ok('no quarto, sem chamada, Países começou sozinho');
  await duda.locator('.quiz-busca input').fill('jap');
  await duda.locator('.quiz-busca li').first().waitFor({ timeout: 5000 });
  await duda.keyboard.press('Enter');
  await duda.locator('.quiz-tabela tbody tr').first().waitFor({ timeout: 5000 });
  const caixa = await duda.locator('.minijogo-no-quarto .minijogo').boundingBox();
  const vista = duda.viewportSize();
  caixa.y >= 0 && caixa.y + caixa.height <= vista.height ? ok('o painel cabe na tela do quarto') : falhou(`o painel sai da tela: ${JSON.stringify(caixa)}`);
  await duda.locator('.minijogo-no-quarto .minijogo').screenshot({ path: path.join(FOTOS, 'solo-no-quarto.png') });
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('Mini-games solo');
}
