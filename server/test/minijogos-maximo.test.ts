/**
 * O MÁXIMO DE JOGADORES (`maximo`, no motor; 03/11/2026, revisão do Tabuleiro da turma). O tabuleiro tem 8 peças: com 9
 * aceitando o convite, jogavam 8 e os 9 eram registrados como quem jogou. Agora, na largada, jogam os primeiros que
 * aceitaram, o nono assiste, e só os 8 entram na estatística da partida.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { io as conectar, type Socket } from 'socket.io-client';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

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

const db = await import('../src/db.js');
const { tabuleiroDaTurma, MAXIMO_DO_TABULEIRO } = await import('../src/minijogo-tabuleiro-da-turma.js');

await criarConta(app, 'primeira-maximo'); // a primeira conta administra o Syden: fica de fora
const contas = [];
for (let i = 0; i < 9; i++) contas.push(await criarConta(app, `pessoa${i}-maximo`));
const chamar = contas.map((c) => comToken(app, c.token));
const comunidade = (await chamar[0]('POST', '/api/communities', { name: 'Turma cheia' })).json();
for (const pessoa of chamar.slice(1)) await pessoa('POST', '/api/communities/join', { code: comunidade.inviteCode });
const canais = (await chamar[0]('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const sala = canais.find((c) => c.type === 'voice')!;
const rota = `/api/channels/${sala.id}/minijogo`;

const ligar = (token: string) =>
  new Promise<Socket>((ok) => {
    const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
    sockets.push(s);
    s.on('connect', () => ok(s));
  });
const entrarNaVoz = (s: Socket, channelId: number) => new Promise((ok) => s.emit('voice:join', { channelId }, ok));
for (const conta of contas) await entrarNaVoz(await ligar(conta.token), sala.id);

test('o tabuleiro tem 8 lugares', () => {
  assert.equal(tabuleiroDaTurma.maximo, MAXIMO_DO_TABULEIRO);
  assert.equal(MAXIMO_DO_TABULEIRO, 8);
});

test('com 9 no convite, jogam os 8 primeiros que aceitaram, e só eles contam como quem jogou', async () => {
  assert.equal((await chamar[0]('POST', rota, { jogo: 'tabuleiro', convidar: true, rodadas: 5 })).statusCode, 200);
  for (const pessoa of chamar.slice(1)) assert.equal((await pessoa('POST', `${rota}/convite`, { resposta: 'jogar' })).statusCode, 200);
  const p = (await chamar[0]('POST', `${rota}/largada`)).json().partida;
  assert.equal(p.participantes.length, 8);
  assert.equal(p.jogadores.length, 8, 'o nono deixa de ser jogador');
  assert.ok(!p.participantes.some((x: { username: string }) => x.username === 'pessoa8-maximo'), 'o último a aceitar fica de fora');
  const doNono = (await chamar[8]('GET', rota)).json().partida;
  assert.equal(doNono.souJogador, false, 'o nono assiste');
  const tabuleiro = db.panoramaDeJogos('2000-01-01T00:00:00.000Z').find((j) => j.jogo === 'tabuleiro')!;
  assert.equal(tabuleiro.pessoas, 8, 'só quem joga entra na estatística');
  assert.equal(tabuleiro.mediaDeJogadores, 8);
});
