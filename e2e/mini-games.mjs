// OS MINI-GAMES (12/10/2026): os cinco jogos da sala de voz, de ponta a ponta, com duas pessoas.
//
// - A Duda entra pelo computador do quarto: Mini-games → escolhe a sala → cai na sala com a estante aberta.
// - O Edu já está na sala: quando a Duda começa um jogo, o painel abre sozinho para ele.
// - "Qual é maior?": os dois votam, e a revelação vem na hora em que os dois votaram.
// - Stop: os dois escrevem, a Duda aperta STOP, o Edu contesta uma resposta dela, os dois ficam prontos.
// - Sudoku: o mesmo tabuleiro para os dois, e o número da Duda não aparece no do Edu.
// - Cinco em linha: o Edu senta do outro lado, e quem começa faz cinco seguidas.
// - Mancala: o Edu senta e quem começa semeia.
//
//   node e2e/mini-games.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `mini-games-${nome}.png`) });

const { browser } = await abrirNavegador();
const pessoa = async () =>
  vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());
try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Jogos ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', {
      headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') },
    });
    return (await r.json()).find((c) => c.name.startsWith('Jogos'))?.inviteCode;
  });

  // O Edu entra na comunidade e na Sala 1 antes.
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
  await edu.locator('.rail-item', { hasText: /^J/ }).first().click();
  await edu.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await edu.locator('.stage-controls').waitFor({ timeout: 30000 });
  ok('o Edu está na Sala 1');

  // A Duda vai pela home: o computador do quarto.
  await duda.locator('.rail-logo').click(); // o ícone do Syden: a home (o .rail-item seria uma comunidade)
  await duda.locator('.quarto').waitFor({ timeout: 20000 });
  // Os objetos do quarto respondem ao desenho; o botão por baixo é o do teclado (foco + Enter).
  await duda.getByRole('button', { name: /^Mini-games/ }).first().focus();
  await duda.keyboard.press('Enter');
  const painel = duda.locator('.jogos-painel');
  await painel.waitFor();
  (await painel.locator('.jogos-de-fora li').count()) >= 5 ? ok('os sites sem anúncio estão no computador') : falhou('faltam os sites de fora');
  await painel.locator('.jogos-do-syden li button', { hasText: 'Sala 1' }).click();
  await duda.locator('.stage-controls').waitFor({ timeout: 30000 });
  await duda.locator('.minijogo-estante').waitFor({ timeout: 15000 });
  const capas = await duda.locator('.minijogo-jogo').count();
  capas === 5 ? ok('a Duda caiu na sala com a estante aberta: 5 jogos') : falhou(`a estante tem ${capas} jogos`);
  await foto(duda, 'estante');

  const comecar = async (nome) => {
    if ((await duda.locator('.minijogo-estante').count()) === 0) await duda.getByRole('button', { name: 'Mini-games' }).click();
    await duda.locator('.minijogo-jogo', { hasText: nome }).click();
  };
  const encerrar = async () => {
    const botao = duda.getByRole('button', { name: /^(Encerrar partida|Outros jogos)$/ });
    await botao.click();
    await edu.locator('.minijogo').waitFor({ state: 'detached', timeout: 10000 });
  };

  // ---- Qual é maior? ----
  await comecar('Qual é maior?');
  await duda.locator('.minijogo-carta').first().waitFor({ timeout: 15000 });
  await edu.locator('.minijogo-carta').first().waitFor({ timeout: 10000 });
  ok('Qual é maior?: começou, e o painel abriu sozinho para o Edu');
  await duda.locator('.minijogo-carta').nth(0).click();
  await duda.getByText(/Você votou/).waitFor({ timeout: 5000 });
  (await edu.locator('.minijogo-tamanho').count()) === 0 ? ok('o tamanho não aparece antes de todos votarem') : falhou('o tamanho vazou antes da hora');
  await edu.locator('.minijogo-carta').nth(1).click();
  await duda.locator('.minijogo-selo').waitFor({ timeout: 5000 });
  ok('os dois votaram e a revelação veio na hora, com o "Maior!"');
  await foto(duda, 'tamanho');
  (await edu.getByRole('button', { name: 'Encerrar partida' }).count()) === 0 ? ok('o Edu, que não começou, não vê "Encerrar"') : falhou('o Edu pode encerrar');
  await encerrar();
  ok('a Duda encerrou, e a partida sumiu para os dois');

  // ---- Stop ----
  await comecar('Stop');
  await duda.locator('.stop-letra').waitFor({ timeout: 10000 });
  await edu.locator('.stop-letra').waitFor({ timeout: 10000 });
  const letra = (await duda.locator('.stop-letra').innerText()).trim();
  const campos = duda.locator('.stop-campo input');
  const n = await campos.count();
  for (let i = 0; i < n; i++) await campos.nth(i).fill(`${letra}uda${i}`);
  await edu.locator('.stop-campo input').nth(0).fill(`${letra}uda0`); // repete a da Duda: 5 para cada
  await edu.locator('.stop-campo input').nth(1).fill(`${letra}edu`);
  await foto(duda, 'stop-escrevendo');
  await duda.locator('.stop-botao').click();
  await edu.locator('.stop-conferencia').waitFor({ timeout: 10000 });
  ok('Stop: a Duda apertou STOP e a conferência abriu para o Edu');
  // O Edu diz que a última da Duda não vale.
  await edu.locator('.stop-conferencia section').nth(n - 1).locator('.stop-resposta', { hasText: 'duda' }).click();
  await duda.locator('.stop-resposta.nao-vale', { hasText: `uda${n - 1}` }).waitFor({ timeout: 5000 });
  ok('o Edu contestou, e a resposta caiu para a Duda também');
  await foto(duda, 'stop-conferindo');
  await duda.getByRole('button', { name: 'Pronto' }).click();
  await edu.getByRole('button', { name: 'Pronto' }).click();
  await duda.locator('.stop-pontos').first().waitFor({ timeout: 5000 });
  ok('os dois ficaram prontos e os pontos apareceram na hora');
  await foto(duda, 'stop-pontos');
  await encerrar();

  // ---- Sudoku ----
  await comecar('Sudoku');
  await duda.locator('.sudoku-grade').waitFor({ timeout: 10000 });
  await edu.locator('.sudoku-grade').waitFor({ timeout: 10000 });
  const vazia = duda.locator('.sudoku-casa:not(.dada)').first();
  const indice = await vazia.evaluate((el) => [...el.parentElement.children].indexOf(el));
  await vazia.click();
  await duda.keyboard.press('5');
  await duda.locator('.sudoku-casa').nth(indice).filter({ hasText: '5' }).waitFor({ timeout: 5000 });
  ((await edu.locator('.sudoku-casa').nth(indice).innerText()).trim() === '' ? ok : falhou)('Sudoku: o número da Duda não aparece no tabuleiro do Edu');
  (await edu.locator('.sudoku-corrida li').count()) === 2 ? ok('a corrida mostra os dois') : falhou('a corrida não mostra os dois');
  await foto(duda, 'sudoku');
  await encerrar();

  // ---- Cinco em linha ----
  await comecar('Cinco em linha');
  await edu.getByRole('button', { name: 'Jogar' }).click();
  await duda.locator('.gomoku').waitFor({ timeout: 10000 });
  await duda.locator('.duelo-jogador.da-vez').waitFor({ timeout: 10000 });
  const dudaComeca = (await duda.locator('.minijogo-situacao.minha-vez').count()) > 0;
  const [primeiro, segundo] = dudaComeca ? [duda, edu] : [edu, duda];
  for (let k = 0; k < 4; k++) {
    await primeiro.locator('.minha-vez').waitFor();
    await primeiro.locator('.gomoku-casa').nth(7 * 15 + 3 + k).click();
    await segundo.locator('.minha-vez').waitFor();
    await segundo.locator('.gomoku-casa').nth(8 * 15 + 3 + k).click();
  }
  await primeiro.locator('.minha-vez').waitFor();
  await primeiro.locator('.gomoku-casa').nth(7 * 15 + 7).click();
  await duda.locator('.gomoku-casa.na-linha').first().waitFor({ timeout: 5000 });
  ((await duda.locator('.gomoku-casa.na-linha').count()) === 5 ? ok : falhou)('Cinco em linha: cinco seguidas vencem, e a linha aparece');
  await foto(duda, 'cinco-em-linha');
  await encerrar();

  // ---- Mancala ----
  await comecar('Mancala');
  await edu.getByRole('button', { name: 'Jogar' }).click();
  await duda.locator('.mancala').waitFor({ timeout: 10000 });
  await duda.locator('.duelo-jogador.da-vez').waitFor({ timeout: 10000 });
  const quemJoga = (await duda.locator('.minijogo-situacao.minha-vez').count()) > 0 ? duda : edu;
  // A terceira casa (4 sementes) termina no próprio depósito: joga de novo.
  await quemJoga.locator('.mancala-fileira').nth(1).locator('.mancala-casa').nth(2).click();
  await quemJoga.locator('.mancala-deposito.meu .mancala-numero', { hasText: '1' }).waitFor({ timeout: 5000 });
  ((await quemJoga.locator('.minijogo-situacao.minha-vez').count()) > 0 ? ok : falhou)('Mancala: a última semente no depósito dá a vez de novo');
  await foto(duda, 'mancala');
  await encerrar();
} finally {
  await browser.close();
}
resumo('Mini-games');
