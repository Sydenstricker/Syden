// OS MINI-GAMES (12/10/2026): os cinco jogos da sala de voz, de ponta a ponta, com duas pessoas.
//
// - A Duda entra pelo computador do quarto: Mini-games → escolhe a sala → cai na sala com a estante aberta.
// - O Edu já está na sala: quando a Duda começa um jogo, o painel abre sozinho para ele.
// - "Qual é o tamanho?": os dois aumentam/diminuem o objeto e confirmam, e a revelação vem na hora.
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
  capas === 8 ? ok('a Duda caiu na sala com a estante aberta: 8 jogos') : falhou(`a estante tem ${capas} jogos`);
  await foto(duda, 'estante');

  const comecar = async (nome) => {
    if ((await duda.locator('.minijogo-estante').count()) === 0) await duda.getByRole('button', { name: 'Mini-games' }).click();
    await duda.locator('.minijogo-jogo', { hasText: nome }).click();
  };
  const encerrar = async () => {
    const botao = duda.getByRole('button', { name: /^(Encerrar partida|Outros jogos)$/ });
    await botao.click();
    // Os dois painéis fecham (a partida acabou); só então a estante pode ser aberta de novo.
    await edu.locator('.minijogo').waitFor({ state: 'detached', timeout: 10000 });
    await duda.locator('.minijogo').waitFor({ state: 'detached', timeout: 10000 });
  };

  // ---- Qual é o tamanho? ----
  await comecar('Qual é o tamanho?');
  // Antes de começar, a categoria (como no Size It Up). A Duda escolhe Animais.
  await duda.locator('.tamanho-categorias .minijogo-jogo').first().waitFor({ timeout: 10000 });
  (await duda.locator('.tamanho-categorias .minijogo-jogo').count()) === 4 ? ok('a escolha de categoria abriu, com 4') : falhou('a escolha de categoria não tem as 4');
  await foto(duda, 'tamanho-categorias');
  await duda.locator('.tamanho-categorias .minijogo-jogo', { hasText: 'Animais' }).click();
  await duda.locator('.tamanho-palco').waitFor({ timeout: 15000 });
  await edu.locator('.tamanho-palco').waitFor({ timeout: 10000 });
  ok('Qual é o tamanho?: começou, e o painel abriu sozinho para o Edu');
  // A Duda arrasta o objeto para cima (aumenta): ele cresce em relação à referência.
  const proporcao = async () => {
    const [alvo, ref] = await Promise.all([duda.locator('.tamanho-figura.alvo').boundingBox(), duda.locator('.tamanho-figura:not(.alvo)').boundingBox()]);
    return alvo.height / ref.height;
  };
  const antes = await proporcao();
  const palco = await duda.locator('.tamanho-palco').boundingBox();
  await duda.mouse.move(palco.x + palco.width * 0.75, palco.y + palco.height * 0.8);
  await duda.mouse.down();
  await duda.mouse.move(palco.x + palco.width * 0.75, palco.y + palco.height * 0.3, { steps: 8 });
  await duda.mouse.up();
  const depois = await proporcao();
  depois > antes * 1.5 ? ok('arrastar para cima aumentou o objeto em relação à referência') : falhou(`o objeto não cresceu (${antes.toFixed(2)} → ${depois.toFixed(2)})`);
  await foto(duda, 'tamanho-estimando');
  await duda.getByRole('button', { name: 'Confirmar' }).click();
  await duda.getByText(/Confirmado\./).waitFor({ timeout: 5000 });
  (await edu.locator('.minijogo-tamanho.de-verdade').count()) === 0 ? ok('o tamanho não aparece antes de todos confirmarem') : falhou('o tamanho vazou antes da hora');
  // O Edu arrasta para baixo (diminui).
  const palcoDoEdu = await edu.locator('.tamanho-palco').boundingBox();
  await edu.mouse.move(palcoDoEdu.x + palcoDoEdu.width * 0.75, palcoDoEdu.y + palcoDoEdu.height * 0.3);
  await edu.mouse.down();
  await edu.mouse.move(palcoDoEdu.x + palcoDoEdu.width * 0.75, palcoDoEdu.y + palcoDoEdu.height * 0.7, { steps: 8 });
  await edu.mouse.up();
  await edu.getByRole('button', { name: 'Confirmar' }).click();
  await duda.locator('.minijogo-tamanho.de-verdade').waitFor({ timeout: 5000 });
  (await duda.locator('.tamanho-palpites li').count()) === 2 ? ok('os dois confirmaram, e a revelação trouxe o tamanho e os dois palpites') : falhou('faltam palpites na revelação');
  (await duda.locator('.tamanho-silhueta').count()) === 1 ? ok('o palpite da Duda virou a silhueta sobre o objeto') : falhou('a silhueta do palpite não apareceu');
  await duda.getByText(/^\+\d+ pontos$/).waitFor({ timeout: 5000 });
  await duda.waitForTimeout(800);
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

  // ---- Problemas de xadrez ----
  // O teste lê a solução do mesmo arquivo que o servidor usa, pelo id do problema que a partida mostra.
  const PROBLEMAS = JSON.parse(fs.readFileSync(path.join('server', 'assets', 'problemas-de-xadrez.json'), 'utf8'));
  await comecar('Problemas de xadrez');
  await duda.locator('.xadrez-tabuleiro').waitFor({ timeout: 10000 });
  await edu.locator('.xadrez-tabuleiro').waitFor({ timeout: 10000 });
  await foto(duda, 'xadrez');
  const partidaDaDuda = await duda.evaluate(async () => {
    const token = localStorage.getItem('janja.token');
    const comunidades = await (await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + token } })).json();
    const jogos = comunidades.find((c) => c.name.startsWith('Jogos'));
    const canais = await (await fetch(`http://localhost:3099/api/communities/${jogos.id}/channels`, { headers: { authorization: 'Bearer ' + token } })).json();
    const sala = canais.find((c) => c.name === 'Sala 1');
    return (await (await fetch(`http://localhost:3099/api/channels/${sala.id}/minijogo`, { headers: { authorization: 'Bearer ' + token } })).json()).partida;
  });
  const lances = PROBLEMAS.find(([id]) => id === partidaDaDuda.problema)[2].split(' ');
  for (let i = 1; i < lances.length; i += 2) {
    await duda.getByRole('button', { name: lances[i].slice(0, 2), exact: true }).click();
    await duda.getByRole('button', { name: lances[i].slice(2, 4), exact: true }).click();
    await duda.waitForTimeout(400);
  }
  await duda.locator('.xadrez-jogadores li.acertou.eu').waitFor({ timeout: 5000 });
  ok('Xadrez: a Duda achou a solução clicando no tabuleiro');
  await edu.locator('.xadrez-jogadores li.acertou').waitFor({ timeout: 5000 });
  ok('e o Edu vê que ela acertou');
  await encerrar();

  // ---- Desenha e adivinha ----
  await comecar('Desenha e adivinha');
  await duda.locator('.desenho-quadro').waitFor({ timeout: 10000 });
  await edu.locator('.desenho-quadro').waitFor({ timeout: 10000 });
  const dudaDesenha = (await duda.locator('.desenho-opcoes button').count()) > 0;
  const [artista, palpiteiro] = dudaDesenha ? [duda, edu] : [edu, duda];
  await artista.locator('.desenho-opcoes button').first().waitFor({ timeout: 5000 });
  await artista.locator('.desenho-opcoes button').first().click();
  await artista.locator('.desenho-palavra', { hasText: 'Desenhe:' }).waitFor({ timeout: 5000 });
  const palavra = (await artista.locator('.desenho-palavra').innerText()).replace(/^.*?:\s*/, '').trim();
  // Um rabisco com o mouse: a diagonal do quadro.
  const caixa = await artista.locator('.desenho-quadro').boundingBox();
  await artista.mouse.move(caixa.x + 40, caixa.y + 40);
  await artista.mouse.down();
  for (let k = 1; k <= 20; k++) await artista.mouse.move(caixa.x + 40 + k * 12, caixa.y + 40 + k * 8);
  await artista.mouse.up();
  await palpiteiro.waitForTimeout(400);
  const tinta = await palpiteiro.locator('.desenho-quadro').evaluate((tela) => {
    const d = tela.getContext('2d').getImageData(0, 0, tela.width, tela.height).data;
    let escuros = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 100 && d[i + 1] < 100 && d[i + 2] < 100) escuros++;
    return escuros;
  });
  tinta > 200 ? ok(`Desenho: o rabisco chegou ao outro quadro (${tinta} pontos de tinta)`) : falhou(`o rabisco não chegou (${tinta})`);
  await foto(artista, 'desenho');
  await palpiteiro.locator('.desenho-chute input').fill('banana com abacaxi');
  await palpiteiro.keyboard.press('Enter');
  await artista.locator('.desenho-chutes li', { hasText: 'banana com abacaxi' }).waitFor({ timeout: 5000 });
  ok('o chute errado aparece para quem desenha');
  await palpiteiro.locator('.desenho-chute input').fill(palavra.toUpperCase());
  await palpiteiro.keyboard.press('Enter');
  await artista.getByText(`Era: ${palavra}`).waitFor({ timeout: 5000 });
  ok(`o outro acertou "${palavra}" (em maiúsculas) e a palavra foi revelada`);
  await foto(palpiteiro, 'desenho-acertou');
  await encerrar();

  // ---- Lobisomem: precisa de quatro na sala ----
  const outros = [];
  for (const nome of ['fabi', 'gui']) {
    const p = await pessoa();
    await cadastrar(p, nome + s);
    await dispensarPresentes(p);
    await p.evaluate(
      async (codigo) =>
        fetch('http://localhost:3099/api/communities/join', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
          body: JSON.stringify({ code: codigo }),
        }),
      convite,
    );
    await p.reload();
    await dispensarPresentes(p);
    await p.locator('.rail-item', { hasText: /^J/ }).first().click();
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
    outros.push(p);
  }
  const todos = [duda, edu, ...outros];
  const nomes = ['duda', 'edu', 'fabi', 'gui'].map((n) => n + s);
  await comecar('Lobisomem');
  for (const p of todos) await p.locator('.lobisomem-papel strong').waitFor({ timeout: 15000 });
  const papeis = await Promise.all(todos.map((p) => p.locator('.lobisomem-papel strong').innerText()));
  ([...papeis].sort().join() === ['Da vila', 'Da vila', 'Lobisomem', 'Vidente'].sort().join() ? ok : falhou)(`Lobisomem: cada um recebeu um papel (${papeis.join(', ')})`);
  await foto(duda, 'lobisomem-noite');
  const lobo = papeis.indexOf('Lobisomem');
  const vidente = papeis.indexOf('Vidente');
  const vitima = papeis.indexOf('Da vila');
  await todos[vidente].locator('.lobisomem-jogador', { hasText: nomes[lobo] }).click();
  await todos[vidente].getByText('é lobisomem', { exact: false }).first().waitFor({ timeout: 5000 });
  ok('a vidente descobriu o lobisomem');
  await todos[lobo].locator('.lobisomem-jogador', { hasText: nomes[vitima] }).click();
  await duda.getByText(`Os lobisomens atacaram ${nomes[vitima]}`).waitFor({ timeout: 5000 });
  ok('todos agiram, e o dia amanheceu com a vítima anunciada');
  await duda.locator('.lobisomem.fase-dia').waitFor({ timeout: 12000 });
  for (const [i, p] of todos.entries()) {
    if (i === vitima) continue;
    await p.locator('.lobisomem-jogador', { hasText: nomes[lobo] }).click();
  }
  await duda.getByText('A vila venceu!').waitFor({ timeout: 5000 });
  ok('a vila votou no lobisomem e venceu');
  await foto(duda, 'lobisomem-fim');
} finally {
  await browser.close();
}
resumo('Mini-games');
