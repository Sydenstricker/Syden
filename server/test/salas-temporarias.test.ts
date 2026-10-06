import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { io as conectar, type Socket } from 'socket.io-client';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// AS SALAS TEMPORÁRIAS (ver salas-temporarias.ts). Entrar e sair da voz passa pelo socket, então aqui o
// servidor sobe numa porta de verdade e as pessoas conectam como o app conecta.
const { app, fechar } = await servidorDeTeste();
await app.listen({ port: 0, host: '127.0.0.1' });
const endereco = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
const sockets: Socket[] = [];
after(async () => {
  for (const s of sockets) s.disconnect();
  await fechar();
});

const { varrerSalasTemporarias } = await import('../src/salas-temporarias.js');

const contaDona = await criarConta(app, 'dona-salas');
const contaAna = await criarConta(app, 'ana-salas');
const contaBia = await criarConta(app, 'bia-salas');
const dona = comToken(app, contaDona.token);
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã das salas' })).json();
await ana('POST', '/api/communities/join', { code: comunidade.inviteCode });
await bia('POST', '/api/communities/join', { code: comunidade.inviteCode });
const canais = () => dona('GET', `/api/communities/${comunidade.id}/channels`).then((r) => r.json() as { id: number; name: string; type: string; temporaria: number }[]);
const criar = (await canais()).find((c) => c.type === 'voice')!;

async function socketDe(token: string): Promise<Socket> {
  const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
  sockets.push(s);
  await new Promise((ok) => s.on('connect', ok));
  return s;
}
const entrarNaVoz = (s: Socket, channelId: number) => new Promise((ok) => s.emit('voice:join', { channelId }, ok));
const sairDaVoz = (s: Socket) => s.emit('voice:leave');
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const temporarias = async () => (await canais()).filter((c) => c.temporaria === 1);

test('só quem administra liga "cria salas", e só em sala de voz', async () => {
  assert.equal((await ana('PUT', `/api/channels/${criar.id}/cria-salas`, { ligado: true })).statusCode, 403);
  const texto = (await canais()).find((c) => c.type === 'text')!;
  assert.equal((await dona('PUT', `/api/channels/${texto.id}/cria-salas`, { ligado: true })).statusCode, 400);
  assert.equal((await dona('PUT', `/api/channels/${criar.id}/cria-salas`, { ligado: true })).json().criaSalas, 1);
});

test('entrar na sala que cria salas dá uma sala nova, com o nome da pessoa; pedir de novo devolve a mesma', async () => {
  const r = await ana('POST', `/api/channels/${criar.id}/voice-token`);
  assert.equal(r.statusCode, 200, r.body);
  const { channelId } = r.json();
  assert.notEqual(channelId, criar.id);
  const salas = await temporarias();
  assert.deepEqual(salas.map((c) => [c.id, c.name]), [[channelId, 'ana-salas']]);
  const ordem = (await canais()).filter((c) => c.type === 'voice').map((c) => c.id);
  assert.equal(ordem[ordem.indexOf(criar.id) + 1], channelId, 'logo abaixo da sala que a criou');
  assert.equal((await ana('POST', `/api/channels/${criar.id}/voice-token`)).json().channelId, channelId, 'não ganha uma segunda');
  // A dona da sala renomeia pelo caminho de sempre.
  assert.equal((await ana('PATCH', `/api/channels/${channelId}`, { name: 'esquadrão' })).statusCode, 200);
  assert.equal((await bia('PATCH', `/api/channels/${channelId}`, { name: 'minha' })).statusCode, 403);
});

test('quando a última pessoa sai, a sala some (e não vai para a lista da lixeira)', async () => {
  const sala = (await temporarias())[0];
  const sAna = await socketDe(contaAna.token);
  const sBia = await socketDe(contaBia.token);
  await entrarNaVoz(sAna, sala.id);
  await entrarNaVoz(sBia, sala.id);
  sairDaVoz(sAna);
  await esperar(150);
  assert.equal((await temporarias()).length, 1, 'ainda tem a Bia');
  sairDaVoz(sBia);
  await esperar(150);
  assert.equal((await temporarias()).length, 0, 'vazia, sumiu');
  const lixeira = (await dona('GET', `/api/communities/${comunidade.id}/lixeira`)).json() as { id: number }[] | { canais?: { id: number }[] };
  const ids = (Array.isArray(lixeira) ? lixeira : lixeira.canais ?? []).map((c) => c.id);
  assert.ok(!ids.includes(sala.id), 'sala temporária não aparece na lixeira');
});

test('quem pegou a senha e nunca conectou: a varredura apaga depois de um minuto, não antes', async () => {
  const { channelId } = (await bia('POST', `/api/channels/${criar.id}/voice-token`)).json();
  const io = { to: () => ({ emit: () => true }) } as never;
  varrerSalasTemporarias(io, Date.now() + 10_000);
  assert.ok((await temporarias()).some((c) => c.id === channelId), 'dentro da folga, fica');
  varrerSalasTemporarias(io, Date.now() + 61_000);
  assert.ok(!(await temporarias()).some((c) => c.id === channelId), 'passada a folga, some');
});

test('limite: sala cheia recusa quem chega, menos quem administra', async () => {
  const { channelId } = (await ana('POST', `/api/channels/${criar.id}/voice-token`)).json();
  assert.equal((await bia('PUT', `/api/channels/${channelId}/limite`, { limite: 1 })).statusCode, 403, 'só a dona da sala');
  assert.equal((await ana('PUT', `/api/channels/${channelId}/limite`, { limite: 1 })).json().limite, 1);
  const sAna = await socketDe(contaAna.token);
  await entrarNaVoz(sAna, channelId);
  const cheia = await bia('POST', `/api/channels/${channelId}/voice-token`);
  assert.equal(cheia.statusCode, 403);
  assert.equal(cheia.json().error, 'Esta sala está cheia.');
  assert.equal((await dona('POST', `/api/channels/${channelId}/voice-token`)).statusCode, 200, 'quem administra passa');
  sairDaVoz(sAna);
});
