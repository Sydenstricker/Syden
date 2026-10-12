/**
 * Os mini-games depois do primeiro (12/10/2026): Stop, Sudoku, Cinco em linha e Mancala. As regras puras
 * são testadas direto; a sala (quem joga, quem assiste, o que cada um vê) passa pelas rotas, com duas
 * pessoas na sala de voz e uma terceira só na comunidade.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { io as conectar, type Socket } from 'socket.io-client';
import { normalizar, pontuarCategoria } from '../src/minijogo-stop.js';
import { contarSolucoes, gerarSudoku } from '../src/minijogo-sudoku.js';
import { linhaDeCinco, semear } from '../src/minijogo-tabuleiro.js';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

test('Stop: 10 pela resposta única, 5 pela repetida (sem ligar para acento e maiúscula), 0 pela que não vale', () => {
  const respostas = new Map([
    [1, 'Abacaxi'],
    [2, 'abacaxí'],
    [3, 'Amora'],
    [4, 'Abacate'],
  ]);
  const pontos = pontuarCategoria(respostas, (id) => id !== 4);
  assert.deepEqual([...pontos.entries()], [
    [1, 5],
    [2, 5],
    [3, 10],
    [4, 0],
  ]);
  assert.equal(normalizar('  Ábaco  Azul '), 'abaco azul');
});

test('Sudoku: o tabuleiro gerado tem uma solução só, e ela bate com a guardada', () => {
  for (let i = 0; i < 3; i++) {
    const { enigma, solucao } = gerarSudoku();
    assert.ok(enigma.filter((n) => n === 0).length >= 40, 'tem casas para preencher');
    assert.equal(contarSolucoes([...enigma]), 1);
    enigma.forEach((n, j) => n && assert.equal(n, solucao[j]));
    for (let k = 0; k < 9; k++) {
      assert.equal(new Set(solucao.slice(k * 9, k * 9 + 9)).size, 9, 'cada linha tem os nove números');
    }
  }
});

test('Cinco em linha: acha a linha na horizontal e na diagonal, e quatro não bastam', () => {
  const casas = new Array(225).fill(0);
  for (const c of [0, 1, 2, 3]) casas[c] = 1;
  assert.equal(linhaDeCinco(casas, 3), null);
  casas[4] = 1;
  assert.deepEqual(linhaDeCinco(casas, 2), [0, 1, 2, 3, 4]);
  const diagonal = new Array(225).fill(0);
  for (const k of [0, 1, 2, 3, 4]) diagonal[(5 + k) * 15 + (10 - k)] = 2;
  assert.equal(linhaDeCinco(diagonal, 7 * 15 + 8)?.length, 5);
});

test('Mancala: a última no depósito joga de novo; a última numa casa vazia captura a da frente', () => {
  const inicio = () => Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? 0 : 4));
  const a = inicio();
  assert.deepEqual(semear(a, 0, 2), { proximo: 0, acabou: false }, 'casa 2 com 4 sementes termina no depósito (6)');
  assert.equal(a[6], 1);

  const b = inicio();
  b[0] = 1;
  b[1] = 0; // a semente da casa 0 cai na 1, vazia; a da frente (11) tem 4
  assert.deepEqual(semear(b, 0, 0), { proximo: 1, acabou: false });
  assert.equal(b[6], 5, 'leva as 4 da frente e a própria');
  assert.equal(b[11], 0);

  const c = new Array(14).fill(0);
  c[5] = 1;
  c[7] = 3;
  assert.equal(semear(c, 0, 5).acabou, true, 'o lado do primeiro esvaziou');
  assert.equal(c[13], 3, 'o outro guarda o que sobrou');
});

// ------------------------------------------------------------------------------------------------
// Pela sala.
// ------------------------------------------------------------------------------------------------

const { app, fechar } = await servidorDeTeste();
await app.listen({ port: 0, host: '127.0.0.1' });
const endereco = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
const sockets: Socket[] = [];
after(async () => {
  for (const s of sockets) s.disconnect();
  const { _partidas } = await import('../src/minijogos-routes.js');
  for (const p of _partidas.values()) if (p.relogio) clearTimeout(p.relogio);
  await fechar();
});

await criarConta(app, 'primeira-novos'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-novos');
const contaBia = await criarConta(app, 'bia-novos');
const contaCaio = await criarConta(app, 'caio-novos');
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const caio = comToken(app, contaCaio.token);
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma dos jogos' })).json();
for (const pessoa of [bia, caio]) await pessoa('POST', '/api/communities/join', { code: comunidade.inviteCode });
const canais = (await ana('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const sala = canais.find((c) => c.type === 'voice')!;
const rota = `/api/channels/${sala.id}/minijogo`;

const ligar = (token: string) =>
  new Promise<Socket>((ok) => {
    const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
    sockets.push(s);
    s.on('connect', () => ok(s));
  });
const entrarNaVoz = (s: Socket, channelId: number) => new Promise((ok) => s.emit('voice:join', { channelId }, ok));
await entrarNaVoz(await ligar(contaAna.token), sala.id);
await entrarNaVoz(await ligar(contaBia.token), sala.id);

test('Stop pela sala: as respostas dos outros ficam escondidas, o STOP exige tudo preenchido, e a turma contesta', async () => {
  const inicio = await ana('POST', rota, { jogo: 'stop', letras: 'B', confere: true });
  assert.equal(inicio.statusCode, 400, 'uma letra só não dá três rodadas');

  const repetidas = (await ana('POST', rota, { jogo: 'stop', letras: 'BBBB', confere: true })).statusCode;
  assert.equal(repetidas, 400, 'letras repetidas contam uma vez');

  const comecou = (await ana('POST', rota, { jogo: 'stop', letras: 'ABC', confere: true })).json().partida;
  assert.equal(comecou.fase, 'escrevendo');
  assert.equal(comecou.categorias.length, 6);
  const letra = comecou.letra as string;
  const cheia = comecou.categorias.map((_: string, i: number) => `${letra}palavra${i}`);

  assert.equal((await ana('POST', `${rota}/acao`, { tipo: 'stop' })).statusCode, 409, 'sem preencher, não para');
  await ana('POST', `${rota}/acao`, { tipo: 'respostas', respostas: cheia });
  // A Bia repete a primeira e erra a letra na segunda.
  await bia('POST', `${rota}/acao`, { tipo: 'respostas', respostas: [cheia[0], 'Zebra', '', '', '', ''] });
  const visto = (await bia('GET', rota)).json().partida;
  assert.equal(visto.respostas, null, 'enquanto se escreve, ninguém vê as respostas dos outros');
  assert.deepEqual(visto.completos, [contaAna.user.id]);

  assert.equal((await ana('POST', `${rota}/acao`, { tipo: 'stop' })).statusCode, 200);
  // Os 2 s de "parando" (a última palavra digitada chegando) e a conferência abre.
  await new Promise((ok) => setTimeout(ok, 2200));
  const conferindo = (await bia('GET', rota)).json().partida;
  assert.equal(conferindo.fase, 'conferindo');
  assert.equal(conferindo.quemParou, contaAna.user.id);
  const daBia = conferindo.respostas.find((r: { userId: number }) => r.userId === contaBia.user.id).respostas;
  assert.equal(daBia[1].valida, false, '"Zebra" não começa com a letra');

  // A Bia contesta a última da Ana: com um "outro" só, um voto contra basta.
  assert.equal((await bia('POST', `${rota}/acao`, { tipo: 'contestar', categoria: 5, alvo: contaAna.user.id })).statusCode, 200);
  assert.equal((await ana('POST', `${rota}/acao`, { tipo: 'contestar', categoria: 0, alvo: contaAna.user.id })).statusCode, 409, 'a própria, não');
  await ana('POST', `${rota}/acao`, { tipo: 'pronto' });
  const resultado = (await bia('POST', `${rota}/acao`, { tipo: 'pronto' })).json().partida;
  assert.equal(resultado.fase, 'resultado', 'todo mundo pronto: conta na hora');
  const placar = Object.fromEntries(resultado.placar.map((l: { username: string; pontos: number }) => [l.username, l.pontos]));
  // Ana: 5 (repetida com a Bia) + 4 × 10 + 0 (contestada). Bia: 5 da repetida.
  assert.deepEqual(placar, { 'ana-novos': 45, 'bia-novos': 5 });
  assert.equal((await ana('DELETE', rota)).statusCode, 200);
});

test('Cinco em linha pela sala: quem senta joga, quem não senta assiste, e cinco seguidas vencem', async () => {
  const p0 = (await ana('POST', rota, { jogo: 'gomoku' })).json().partida;
  assert.equal(p0.fase, 'esperando');
  assert.equal(p0.jogadores.length, 1);
  assert.equal((await caio('POST', `${rota}/acao`, { tipo: 'sentar' })).statusCode, 403, 'quem não está na sala não senta');
  const p1 = (await bia('POST', `${rota}/acao`, { tipo: 'sentar' })).json().partida;
  assert.equal(p1.fase, 'jogando');

  const vez = p1.vez as 0 | 1;
  const [primeiro, segundo] = vez === 0 ? [ana, bia] : [bia, ana];
  assert.equal((await segundo('POST', `${rota}/acao`, { tipo: 'jogada', casa: 0 })).statusCode, 409, 'fora da vez não joga');
  for (let k = 0; k < 4; k++) {
    await primeiro('POST', `${rota}/acao`, { tipo: 'jogada', casa: k });
    await segundo('POST', `${rota}/acao`, { tipo: 'jogada', casa: 15 + k });
  }
  const fim = (await primeiro('POST', `${rota}/acao`, { tipo: 'jogada', casa: 4 })).json().partida;
  assert.equal(fim.fase, 'fim');
  assert.equal(fim.terminada, true);
  assert.equal(fim.vencedor, vez);
  assert.deepEqual(fim.linha, [0, 1, 2, 3, 4]);
  assert.equal((await ana('DELETE', rota)).statusCode, 200);
});

test('Sudoku pela sala: cada um vê só o próprio tabuleiro, e o número errado conta como erro', async () => {
  const p0 = (await ana('POST', rota, { jogo: 'sudoku' })).json().partida;
  assert.equal(p0.solucao, undefined, 'a solução nunca sai do servidor');
  const casa = (p0.enigma as number[]).indexOf(0);
  const depois = (await ana('POST', `${rota}/acao`, { tipo: 'jogada', casa, valor: 10 })).statusCode;
  assert.equal(depois, 409, 'só de 1 a 9');
  assert.equal((await ana('POST', `${rota}/acao`, { tipo: 'jogada', casa: (p0.enigma as number[]).findIndex((n: number) => n > 0), valor: 1 })).statusCode, 409, 'casa dada não muda');

  // Tenta os nove números na mesma casa: só um é o certo.
  let erros = 0;
  for (let v = 1; v <= 9; v++) {
    const r = (await ana('POST', `${rota}/acao`, { tipo: 'jogada', casa, valor: v })).json().partida;
    if (!r.errados.includes(casa)) break;
    erros++;
  }
  const meu = (await ana('GET', rota)).json().partida;
  const linhaDaAna = meu.corrida.find((l: { userId: number }) => l.userId === contaAna.user.id);
  assert.equal(linhaDaAna.erros, erros);
  assert.equal(linhaDaAna.certas, 1);
  const daBia = (await bia('GET', rota)).json().partida;
  assert.equal(daBia.meu[casa], 0, 'o número da Ana não aparece no tabuleiro da Bia');
  assert.equal((await ana('DELETE', rota)).statusCode, 200);
});
