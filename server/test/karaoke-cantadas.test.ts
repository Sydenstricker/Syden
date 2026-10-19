/**
 * AS VEZES QUE SE CANTOU (19/10/2026): quem põe a música para cantar avisa o servidor, que conta para o ranking da
 * comunidade. Só conta karaokê de verdade: numa sala de voz desta comunidade, com mais alguém, e recomeçar a mesma
 * música antes de ela acabar não conta de novo. Quem exclui a conta sai do ranking, e o total da comunidade fica.
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
  await fechar();
});
const db = await import('../src/db.js');

await criarConta(app, 'primeira-karaoke'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-karaoke');
const contaBia = await criarConta(app, 'bia-karaoke');
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma do karaokê' })).json();
await bia('POST', '/api/communities/join', { code: comunidade.inviteCode });
const sala = ((await ana('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[]).find(
  (c) => c.type === 'voice',
)!;
const audio = 'data:audio/ogg;base64,' + Buffer.concat([Buffer.from('OggS'), Buffer.alloc(200)]).toString('base64');
const musica = (await ana('POST', `/api/communities/${comunidade.id}/karaoke`, { title: 'Parabéns', audio, seconds: 90 })).json();
assert.ok(musica.id, 'a música subiu: ' + JSON.stringify(musica));

const ligar = (token: string) =>
  new Promise<Socket>((ok) => {
    const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
    sockets.push(s);
    s.on('connect', () => ok(s));
  });
const entrarNaVoz = (s: Socket, channelId: number) => new Promise((ok) => s.emit('voice:join', { channelId }, ok));
const cantar = (quem: typeof ana) => quem('POST', `/api/karaoke/${musica.id}/cantada`).then((r) => r.json().contou);
const ranking = () => ana('GET', `/api/communities/${comunidade.id}/karaoke/ranking`).then((r) => r.json());

test('fora da sala, ou sozinha nela, não conta', async () => {
  assert.equal(await cantar(ana), false);
  await entrarNaVoz(await ligar(contaAna.token), sala.id);
  assert.equal(await cantar(ana), false, 'sozinha na sala não é karaokê');
});

test('com a turma na sala conta, e recomeçar a música antes de ela acabar não conta de novo', async () => {
  await entrarNaVoz(await ligar(contaBia.token), sala.id);
  assert.equal(await cantar(ana), true);
  assert.equal(await cantar(ana), false, 'a mesma música, de novo, logo em seguida');
  assert.equal(await cantar(bia), true, 'outra pessoa pondo a mesma música conta');
  const r = await ranking();
  assert.equal(r.total, 2);
  assert.deepEqual(r.musicas.map((m: { title: string; cantadas: number }) => [m.title, m.cantadas]), [['Parabéns', 2]]);
  assert.deepEqual(r.cantores.map((c: { nome: string }) => c.nome).sort(), ['ana-karaoke', 'bia-karaoke']);
});

test('quem não é da comunidade não vê o ranking', async () => {
  const outra = comToken(app, (await criarConta(app, 'de-fora-karaoke')).token);
  assert.equal((await outra('GET', `/api/communities/${comunidade.id}/karaoke/ranking`)).statusCode, 404);
  assert.equal((await outra('POST', `/api/karaoke/${musica.id}/cantada`)).statusCode, 404);
});

test('vai no "Levar seus dados"; quem exclui a conta sai do ranking, e o total da comunidade fica', async () => {
  assert.deepEqual((await bia('GET', '/api/me/dados')).json().conta.karaoke, [{ comunidade: 'Turma do karaokê', cantadas: 1 }]);
  const biaId = (await bia('GET', '/api/me')).json().id as number;
  for (const s of sockets.splice(1)) s.disconnect();
  db.deleteAccount(biaId);
  const r = await ranking();
  assert.deepEqual(r.cantores.map((c: { nome: string }) => c.nome), ['ana-karaoke']);
  assert.equal(r.total, 2);
});
