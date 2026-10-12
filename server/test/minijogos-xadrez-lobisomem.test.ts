/**
 * Os mini-games do degrau 3 (12/10/2026): os problemas de xadrez do Lichess e o Lobisomem. As regras puras
 * são testadas direto; a sala (quem vê o quê, quem joga quando) passa pelas rotas, com quatro pessoas na
 * sala de voz — o mínimo do Lobisomem.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { io as conectar, type Socket } from 'socket.io-client';
import { maisVotado, papeisPara } from '../src/minijogo-lobisomem.js';
import { casa, confere, jogar, lerFen, PROBLEMAS } from '../src/minijogo-xadrez.js';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

test('xadrez: lê o FEN e move as peças, inclusive roque, en passant e promoção', () => {
  const { casas, vez } = lerFen(INICIAL);
  assert.equal(vez, 'w');
  assert.equal(casas[casa('e1')], 'K');
  assert.equal(casas[casa('d8')], 'q');
  assert.equal(casas.filter((c) => c === '').length, 32);

  const roque = jogar(lerFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1').casas, 'e1g1');
  assert.equal(roque[casa('g1')], 'K');
  assert.equal(roque[casa('f1')], 'R', 'a torre pula para o outro lado do rei');
  assert.equal(roque[casa('h1')], '');
  const grande = jogar(lerFen('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1').casas, 'e8c8');
  assert.equal(grande[casa('d8')], 'r');

  const passant = jogar(lerFen('8/8/8/3pP3/8/8/8/4K2k w - d6 0 1').casas, 'e5d6');
  assert.equal(passant[casa('d6')], 'P');
  assert.equal(passant[casa('d5')], '', 'o peão comido en passant some');

  const promocao = jogar(lerFen('8/4P3/8/8/8/8/8/4K2k w - - 0 1').casas, 'e7e8q');
  assert.equal(promocao[casa('e8')], 'Q');
  assert.ok(confere('e7e8', 'e7e8q'), 'sem a letra, vale a dama');
  assert.ok(!confere('e7e8n', 'e7e8q'));
});

test('xadrez: os 1000 problemas do Lichess andam inteiros, sempre movendo uma peça da vez', () => {
  assert.ok(PROBLEMAS.length >= 400);
  for (const [id, fen, texto] of PROBLEMAS) {
    let { casas, vez } = lerFen(fen);
    for (const lance of texto.split(' ')) {
      const peca = casas[casa(lance.slice(0, 2))];
      assert.ok(peca, `${id}: ${lance} sai de uma casa vazia`);
      assert.equal(peca === peca.toUpperCase() ? 'w' : 'b', vez, `${id}: ${lance} move a peça do outro lado`);
      casas = jogar(casas, lance);
      vez = vez === 'w' ? 'b' : 'w';
    }
  }
});

test('Lobisomem: os papéis crescem com a sala, e empate na votação não tira ninguém', () => {
  assert.deepEqual(papeisPara(4), ['lobisomem', 'vidente', 'aldeao', 'aldeao']);
  assert.deepEqual(papeisPara(5), ['lobisomem', 'vidente', 'anjo', 'aldeao', 'aldeao']);
  assert.equal(papeisPara(8).filter((p) => p === 'lobisomem').length, 2);
  assert.equal(papeisPara(20).filter((p) => p === 'lobisomem').length, 3);
  assert.equal(maisVotado([1, 1, 2]), 1);
  assert.equal(maisVotado([1, 2]), null);
  assert.equal(maisVotado([0, 0, 1]), null, 'a maioria votou em ninguém');
  assert.equal(maisVotado([]), null);
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

await criarConta(app, 'primeira-d3'); // a primeira conta administra o Syden: fica de fora
const contas = [];
for (const nome of ['ana-d3', 'bia-d3', 'caio-d3', 'davi-d3']) contas.push(await criarConta(app, nome));
const [ana, bia, caio, davi] = contas.map((c) => comToken(app, c.token));
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma do degrau 3' })).json();
for (const pessoa of [bia, caio, davi]) await pessoa('POST', '/api/communities/join', { code: comunidade.inviteCode });
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

test('xadrez pela sala: quem joga a solução acerta e ganha o ponto extra; o lance errado encerra a tentativa', async () => {
  await entrarNaVoz(await ligar(contas[0].token), sala.id);
  await entrarNaVoz(await ligar(contas[1].token), sala.id);
  const p0 = (await ana('POST', rota, { jogo: 'xadrez' })).json().partida;
  assert.equal(p0.fase, 'resolvendo');
  assert.equal(p0.casas.length, 64);
  assert.equal(p0.solucao, undefined);
  const [, , texto] = PROBLEMAS.find(([id]) => id === p0.problema)!;
  const lances = texto.split(' ');

  // A Bia joga um lance qualquer que não é o da solução.
  const errado = (await bia('POST', `${rota}/acao`, { tipo: 'lance', lance: lances[1] === 'a1a2' ? 'a2a3' : 'a1a2' })).json().partida;
  assert.equal(errado.estado, 'errou');

  // A Ana joga a solução (os lances ímpares); a resposta do adversário vem sozinha.
  let ultima;
  for (let i = 1; i < lances.length; i += 2) ultima = (await ana('POST', `${rota}/acao`, { tipo: 'lance', lance: lances[i] })).json().partida;
  assert.equal(ultima.fase, 'solucao', 'os dois terminaram: a solução aparece na hora');
  assert.equal(ultima.estado, 'acertou');
  const placar = Object.fromEntries(ultima.placar.map((l: { username: string; pontos: number }) => [l.username, l.pontos]));
  assert.deepEqual(placar, { 'ana-d3': 2, 'bia-d3': 0 });
  assert.equal((await ana('DELETE', rota)).statusCode, 200);
});

test('Lobisomem pela sala: cada um vê só o próprio papel, a noite acaba quando todos agiram, e o dia vota', async () => {
  assert.equal((await ana('POST', rota, { jogo: 'lobisomem' })).statusCode, 400, 'com dois na sala, não dá');
  await entrarNaVoz(await ligar(contas[2].token), sala.id);
  await entrarNaVoz(await ligar(contas[3].token), sala.id);

  const p0 = (await ana('POST', rota, { jogo: 'lobisomem' })).json().partida;
  assert.equal(p0.fase, 'noite');
  const pessoas = [ana, bia, caio, davi];
  const estados = await Promise.all(pessoas.map(async (p) => (await p('GET', rota)).json().partida));
  const papelDe = new Map(estados.map((e, i) => [contas[i].user.id, e.meuPapel as string]));
  assert.deepEqual([...papelDe.values()].sort(), ['aldeao', 'aldeao', 'lobisomem', 'vidente']);
  for (const e of estados) {
    const visiveis = e.jogadores.filter((j: { papel: string | null }) => j.papel !== null);
    assert.equal(visiveis.length, 1, 'com um lobisomem só, cada um vê apenas o próprio papel');
  }

  const id = (papel: string) => [...papelDe.entries()].find(([, p]) => p === papel)![0];
  const quem = (userId: number) => pessoas[contas.findIndex((c) => c.user.id === userId)];
  const lobo = id('lobisomem');
  const vidente = id('vidente');
  const vitima = [...papelDe.entries()].find(([, p]) => p === 'aldeao')![0];

  assert.equal((await quem(vitima)('POST', `${rota}/acao`, { tipo: 'noite', alvo: lobo })).statusCode, 409, 'aldeão dorme');
  const visao = (await quem(vidente)('POST', `${rota}/acao`, { tipo: 'noite', alvo: lobo })).json().partida;
  assert.deepEqual(visao.visoes, [{ alvo: lobo, lobisomem: true }]);
  const manha = (await quem(lobo)('POST', `${rota}/acao`, { tipo: 'noite', alvo: vitima })).json().partida;
  assert.equal(manha.fase, 'amanhecer', 'todos com ação agiram: amanhece na hora');
  assert.equal(manha.mortoDaNoite, vitima);
  assert.equal(manha.jogadores.find((j: { userId: number }) => j.userId === vitima).papel, 'aldeao', 'o papel de quem morre fica aberto');
  assert.equal((await quem(vitima)('POST', `${rota}/acao`, { tipo: 'voto', alvo: lobo })).statusCode, 409, 'quem morreu só assiste');

  // O amanhecer dura alguns segundos; depois a turma vota.
  await new Promise((ok) => setTimeout(ok, 7300));
  const vivos = [...papelDe.keys()].filter((u) => u !== vitima);
  let fim;
  for (const u of vivos) fim = (await quem(u)('POST', `${rota}/acao`, { tipo: 'voto', alvo: lobo })).json().partida;
  assert.equal(fim.fase, 'fim');
  assert.equal(fim.vencedor, 'vila');
  assert.equal(fim.eliminado, lobo);
  assert.ok(fim.jogadores.every((j: { papel: string | null }) => j.papel !== null), 'no fim, todos os papéis aparecem');
  assert.equal((await ana('DELETE', rota)).statusCode, 200);
});
