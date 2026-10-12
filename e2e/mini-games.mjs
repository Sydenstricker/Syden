// OS MINI-GAMES (12/10/2026): o "Qual é maior?" na sala de voz, de ponta a ponta, com duas pessoas.
//
// - A Duda entra pelo computador do quarto: Mini-games → escolhe a sala → cai na sala e a partida começa
//   sozinha.
// - O Edu já está na sala: o painel abre sozinho para ele, sem procurar botão.
// - Os dois votam; o servidor revela na hora em que os dois votaram, com os tamanhos e o selo "Maior!".
// - O botão de videogame da barra esconde e mostra o painel; quem começou encerra.
//
//   node e2e/mini-games.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

const { browser } = await abrirNavegador();
const pessoa = async () => vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone', 'camera'] })).newPage());
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
  await painel.screenshot({ path: path.join(FOTOS, 'mini-games-home.png') });
  (await painel.locator('.jogos-de-fora li').count()) >= 5 ? ok('os sites sem anúncio estão no computador') : falhou('faltam os sites de fora');
  await painel.locator('.jogos-do-syden li button', { hasText: 'Sala 1' }).click();
  await duda.locator('.stage-controls').waitFor({ timeout: 30000 });
  await duda.locator('.minijogo-carta').first().waitFor({ timeout: 15000 });
  ok('a Duda escolheu a sala no quarto e a partida começou sozinha');

  await edu.locator('.minijogo-carta').first().waitFor({ timeout: 10000 });
  ok('o painel abriu sozinho para o Edu');
  await edu.locator('.minijogo').screenshot({ path: path.join(FOTOS, 'mini-games-votando.png') });

  await duda.locator('.minijogo-carta').nth(0).click();
  await duda.getByText(/Você votou/).waitFor({ timeout: 5000 });
  (await edu.locator('.minijogo-tamanho').count()) === 0 ? ok('o tamanho não aparece antes de todos votarem') : falhou('o tamanho vazou antes da hora');
  await edu.locator('.minijogo-carta').nth(1).click();

  await duda.locator('.minijogo-selo').waitFor({ timeout: 5000 });
  ok('os dois votaram e a revelação veio na hora, com o "Maior!"');
  (await duda.locator('.minijogo-tamanho').count()) === 2 ? ok('os dois tamanhos aparecem') : falhou('faltam os tamanhos');
  const situacao = await duda.locator('.minijogo-situacao').innerText();
  /Acertou|Errou/.test(situacao) ? ok(`a Duda vê: "${situacao}"`) : falhou('sem resultado: ' + situacao);
  await duda.locator('.minijogo').screenshot({ path: path.join(FOTOS, 'mini-games-revelando.png') });

  // O botão de videogame esconde e mostra o painel.
  await edu.getByRole('button', { name: 'Mini-games' }).click();
  (await edu.locator('.minijogo').count()) === 0 ? ok('o controle esconde o painel') : falhou('o painel não fechou');
  await edu.getByRole('button', { name: 'Mini-games' }).click();
  await edu.locator('.minijogo').waitFor();
  ok('e mostra de novo');

  (await edu.getByRole('button', { name: 'Encerrar partida' }).count()) === 0 ? ok('o Edu, que não começou, não vê "Encerrar"') : falhou('o Edu pode encerrar');
  await duda.getByRole('button', { name: 'Encerrar partida' }).click();
  await edu.locator('.minijogo-carta').first().waitFor({ state: 'detached', timeout: 10000 });
  ok('a Duda encerrou, e a partida sumiu para os dois');
} finally {
  await browser.close();
}
resumo('Mini-games');
