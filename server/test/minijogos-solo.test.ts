/**
 * A PARTIDA SOLO (24/10/2026): os seis jogos que se jogam sozinho aparecem nas duas abas da estante; no Solo a partida é
 * da pessoa, e não da sala. Ela começa sem convite e sem chamada, não ocupa a sala (a turma começa o jogo dela ao mesmo
 * tempo), não aceita jogo que só existe em grupo e não entra na estatística da turma.
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
  const { _partidas, _solos } = await import('../src/minijogos-routes.js');
  for (const p of [..._partidas.values(), ..._solos.values()]) if (p.relogio) clearTimeout(p.relogio);
  await fechar();
});

await criarConta(app, 'primeira-solo'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-solo');
const contaBia = await criarConta(app, 'bia-solo');
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const comunidade = (await bia('POST', '/api/communities', { name: 'Turma do solo' })).json();
await ana('POST', '/api/communities/join', { code: comunidade.inviteCode });
const canais = (await bia('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const sala = canais.find((c) => c.type === 'voice')!;

const ligar = (token: string) =>
  new Promise<Socket>((ok) => {
    const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
    sockets.push(s);
    s.on('connect', () => ok(s));
  });

test('solo: começa na hora, sem convite e sem chamada', async () => {
  const p = (await ana('POST', '/api/minijogo-solo', { jogo: 'monstros' })).json().partida;
  assert.equal(p.solo, true);
  assert.equal(p.convite, null, 'sem convite');
  assert.equal(p.souJogador, true);
  assert.equal(p.rodada, 1, 'o jogo já começou');
  assert.deepEqual((await ana('GET', '/api/minijogo-solo')).json().partida.jogo, 'monstros');
  assert.equal((await bia('GET', '/api/minijogo-solo')).json().partida, null, 'a partida solo é só de quem começou');
  const { _solos } = await import('../src/minijogos-routes.js');
  assert.equal(_solos.get(contaAna.user.id)?.registro, null, 'não entra na estatística da turma');
});

test('solo: uma ação muda a partida de quem joga, e o aviso vai só a essa pessoa', async () => {
  const s = await ligar(contaAna.token);
  const aviso = new Promise((ok) => s.once('minijogo-solo:mudou', ok));
  const r = await ana('POST', '/api/minijogo-solo/acao', { tipo: 'chute', id: 'aboleth' });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().partida.meu.length, 1);
  // O chute pode ter sido o secreto (o aviso vem da revelação) ou não (vem da ação): de um jeito ou de outro, chega.
  await Promise.race([aviso, new Promise((_, falha) => setTimeout(() => falha(new Error('sem aviso')), 3000))]);
});

test('solo: não ocupa a sala — a turma começa o jogo dela ao mesmo tempo', async () => {
  const s = await ligar(contaBia.token);
  await new Promise((ok) => s.emit('voice:join', { channelId: sala.id }, ok));
  const r = await bia('POST', `/api/channels/${sala.id}/minijogo`, { jogo: 'stop', convidar: true, letras: 'ABC', confere: true });
  assert.equal(r.statusCode, 200, 'a sala está livre');
  assert.equal((await ana('GET', '/api/minijogo-solo')).json().partida.jogo, 'monstros', 'e a partida solo segue');
});

test('solo: jogo de grupo não se joga sozinho, e começar outro troca o de antes', async () => {
  assert.equal((await ana('POST', '/api/minijogo-solo', { jogo: 'lobisomem' })).statusCode, 400);
  assert.equal((await ana('POST', '/api/minijogo-solo', { jogo: 'stop' })).statusCode, 400);
  const p = (await ana('POST', '/api/minijogo-solo', { jogo: 'paises' })).json().partida;
  assert.equal(p.jogo, 'paises');
  assert.equal((await ana('DELETE', '/api/minijogo-solo')).statusCode, 200);
  assert.equal((await ana('GET', '/api/minijogo-solo')).json().partida, null);
  assert.equal((await ana('POST', '/api/minijogo-solo/acao', { tipo: 'chute', id: 'BR' })).statusCode, 409, 'sem partida, sem ação');
});
