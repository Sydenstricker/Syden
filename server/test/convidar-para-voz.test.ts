/**
 * CONVIDAR PARA A VOZ (29/10/2026, o "Convidar para voz" do Discord): quem está numa sala chama alguém da comunidade, e
 * só essa pessoa recebe o aviso. A lista da tela é sugestão; quem decide é o servidor, e é isso que se confere aqui.
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

const comAnos = (anos: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anos);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
};

await criarConta(app, 'primeira-voz'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-voz');
const contaBia = await criarConta(app, 'bia-voz');
const contaCaio = await criarConta(app, 'caio-voz');
const contaDani = await criarConta(app, 'dani-voz', 'segredo123', comAnos(16));
const contaEdu = await criarConta(app, 'edu-voz'); // de fora da comunidade
const ana = comToken(app, contaAna.token);
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma da voz' })).json();
for (const conta of [contaBia, contaCaio, contaDani]) {
  await comToken(app, conta.token)('POST', '/api/communities/join', { code: comunidade.inviteCode });
}
const canais = (await ana('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const sala = canais.find((c) => c.type === 'voice')!;

const ligar = (token: string) =>
  new Promise<Socket>((ok) => {
    const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
    sockets.push(s);
    s.on('connect', () => ok(s));
  });
type Resposta = { ok: boolean };
const convidar = (s: Socket, userId: number) => new Promise<Resposta>((ok) => s.emit('voice:convidar', { userId }, ok));
/** Os convites que chegam a cada um. */
const recebidos = new Map<number, { de: { id: number }; channelId: number; sala: string; comunidade: string }[]>();
async function online(conta: { token: string; user: { id: number } }) {
  const s = await ligar(conta.token);
  recebidos.set(conta.user.id, []);
  s.on('voice:convite', (c) => recebidos.get(conta.user.id)!.push(c));
  return s;
}
const esperar = () => new Promise((ok) => setTimeout(ok, 150));

const daAna = await online(contaAna);
const daBia = await online(contaBia);
await online(contaDani);
await online(contaEdu);

test('fora de uma sala de voz, não se convida ninguém', async () => {
  assert.deepEqual(await convidar(daAna, contaBia.user.id), { ok: false });
});

test('na sala, o convite chega só a quem foi chamado, com a sala e a comunidade', async () => {
  await new Promise((ok) => daAna.emit('voice:join', { channelId: sala.id }, ok));
  assert.deepEqual(await convidar(daAna, contaBia.user.id), { ok: true });
  await esperar();
  const [convite] = recebidos.get(contaBia.user.id)!;
  assert.equal(convite.de.id, contaAna.user.id);
  assert.equal(convite.channelId, sala.id);
  assert.equal(convite.comunidade, 'Turma da voz');
  assert.equal(recebidos.get(contaEdu.user.id)!.length, 0);
});

test('clicar de novo dentro de um minuto não manda outro aviso', async () => {
  assert.deepEqual(await convidar(daAna, contaBia.user.id), { ok: true });
  await esperar();
  assert.equal(recebidos.get(contaBia.user.id)!.length, 1);
});

test('quem está offline, quem é de fora e quem já está na sala não recebem', async () => {
  assert.equal((await convidar(daAna, contaCaio.user.id)).ok, false, 'o Caio não está online');
  assert.equal((await convidar(daAna, contaEdu.user.id)).ok, false, 'o Edu não é da comunidade');
  assert.equal((await convidar(daAna, contaAna.user.id)).ok, false, 'a si mesma');
  await new Promise((ok) => daBia.emit('voice:join', { channelId: sala.id }, ok));
  assert.equal((await convidar(daAna, contaBia.user.id)).ok, false, 'a Bia já está na sala');
  daBia.emit('voice:leave');
});

test('menor de idade só recebe convite de amigo, e a recusa não conta que é menor', async () => {
  assert.deepEqual(await convidar(daAna, contaDani.user.id), { ok: false });
  await esperar();
  assert.equal(recebidos.get(contaDani.user.id)!.length, 0);
});

test('com bloqueio em qualquer sentido, não há convite', async () => {
  const caio = await online(contaCaio);
  await comToken(app, contaCaio.token)('POST', '/api/me/bloqueios', { userId: contaAna.user.id });
  assert.equal((await convidar(daAna, contaCaio.user.id)).ok, false);
  await esperar();
  assert.equal(recebidos.get(contaCaio.user.id)!.length, 0);
  caio.disconnect();
});
