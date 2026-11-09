/**
 * A CHAMADA DA CONVERSA PRIVADA (pedido dele, 02/11/2026): voz, câmera e transmissão entre quem conversa, sem comunidade.
 * Quem decide quem entra é o servidor (o token e o voice:join), e é isso que se confere aqui: só quem é da conversa, sem
 * bloqueio com quem já está na chamada, e a regra dos menores; o toque vai para os outros, e a lista da chamada nunca
 * aparece na das comunidades.
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

await criarConta(app, 'primeira-chamada'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-chamada');
const contaBia = await criarConta(app, 'bia-chamada');
const contaCaio = await criarConta(app, 'caio-chamada');
const contaDani = await criarConta(app, 'dani-chamada', 'segredo123', comAnos(16));
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const caio = comToken(app, contaCaio.token);
const dani = comToken(app, contaDani.token);

// Uma comunidade em comum (é o que abre a conversa entre adultos) e a amizade da Ana com a Dani (menor).
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma da chamada' })).json();
for (const quem of [bia, caio, dani]) await quem('POST', '/api/communities/join', { code: comunidade.inviteCode });
await ana('POST', '/api/amigos', { username: 'dani-chamada' });
await dani('POST', `/api/amigos/${contaAna.user.id}/aceitar`);

const conversaAnaBia = (await ana('POST', '/api/direct', { userIds: [contaBia.user.id] })).json() as { id: number };
const conversaAnaDani = (await ana('POST', '/api/direct', { userIds: [contaDani.user.id] })).json() as { id: number };
const grupo = (await ana('POST', '/api/direct', { userIds: [contaBia.user.id, contaCaio.user.id] })).json() as { id: number };

const ligar = (token: string) =>
  new Promise<Socket>((ok) => {
    const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
    sockets.push(s);
    s.on('connect', () => ok(s));
  });
type Toque = { channelId: number; de: { id: number } };
const toques = new Map<number, Toque[]>();
// O "chamando" de quem liga (09/11/2026): o servidor só o manda quando tocou para alguém.
const chamandos = new Map<number, number[]>();
const estados: { channelId: number; members: { userId: number }[] }[] = [];
const dasComunidades: { members: { userId: number }[] }[] = [];
async function online(conta: { token: string; user: { id: number } }) {
  const s = await ligar(conta.token);
  toques.set(conta.user.id, []);
  s.on('chamada:tocando', (t: Toque) => toques.get(conta.user.id)!.push(t));
  chamandos.set(conta.user.id, []);
  s.on('chamada:chamando', (c: { channelId: number }) => chamandos.get(conta.user.id)!.push(c.channelId));
  if (conta === contaBia) {
    s.on('chamada:estado', (e) => estados.push(e));
    s.on('voice:state', (e) => dasComunidades.push(e));
  }
  return s;
}
const entrar = (s: Socket, channelId: number) =>
  new Promise<{ ok: boolean; communityId?: number }>((ok) => s.emit('voice:join', { channelId }, ok));
const esperar = () => new Promise((ok) => setTimeout(ok, 150));
const senha = (quem: typeof ana, channelId: number) => quem('POST', `/api/direct/${channelId}/voice-token`);

const daAna = await online(contaAna);
const daBia = await online(contaBia);
const doCaio = await online(contaCaio);
const daDani = await online(contaDani);

test('quem é da conversa recebe a senha; quem não é, não', async () => {
  const resposta = await senha(ana, conversaAnaBia.id);
  assert.equal(resposta.statusCode, 200);
  assert.equal(resposta.json().channelId, conversaAnaBia.id);
  assert.equal((await senha(caio, conversaAnaBia.id)).statusCode, 404, 'o Caio não é da conversa');
  // O token das salas não serve para a conversa, e vice-versa.
  assert.equal((await ana('POST', `/api/channels/${conversaAnaBia.id}/voice-token`)).statusCode, 404);
});

test('quem liga faz tocar para o outro, e a chamada aparece só para a conversa', async () => {
  assert.equal((await entrar(daAna, conversaAnaBia.id)).ok, true);
  await esperar();
  const [toque] = toques.get(contaBia.user.id)!;
  assert.equal(toque?.channelId, conversaAnaBia.id);
  assert.equal(toque?.de.id, contaAna.user.id);
  assert.equal(toques.get(contaCaio.user.id)!.length, 0, 'o Caio não é da conversa');
  assert.deepEqual(chamandos.get(contaAna.user.id), [conversaAnaBia.id], 'quem liga fica sabendo que tocou');
  const ultimo = estados.filter((e) => e.channelId === conversaAnaBia.id).at(-1);
  assert.deepEqual(ultimo?.members.map((m) => m.userId), [contaAna.user.id]);
  assert.ok(!dasComunidades.some((e) => e.members.some((m) => m.userId === contaAna.user.id)), 'a lista da comunidade não a mostra');
});

test('atender não faz tocar de novo, e quem desliga sai da lista', async () => {
  assert.equal((await entrar(daBia, conversaAnaBia.id)).ok, true);
  await esperar();
  assert.equal(toques.get(contaAna.user.id)!.length, 0);
  assert.equal(toques.get(contaBia.user.id)!.length, 1);
  assert.equal(chamandos.get(contaBia.user.id)!.length, 0, 'quem atende não ouve o chamando');
  daAna.emit('voice:leave');
  daBia.emit('voice:leave');
  await esperar();
  assert.deepEqual(estados.at(-1)?.members, []);
});

test('quem não é da conversa não entra nem pelo socket', async () => {
  assert.equal((await entrar(doCaio, conversaAnaBia.id)).ok, false);
});

test('com bloqueio, quem chega depois não entra na chamada do outro', async () => {
  await caio('POST', '/api/me/bloqueios', { userId: contaBia.user.id });
  assert.equal((await entrar(daBia, grupo.id)).ok, true);
  await esperar();
  assert.equal(toques.get(contaCaio.user.id)!.length, 0, 'não toca para quem bloqueou quem liga');
  assert.equal((await senha(caio, grupo.id)).statusCode, 403);
  assert.equal((await entrar(doCaio, grupo.id)).ok, false);
  // A Ana, sem bloqueio com ninguém, entra.
  assert.equal((await senha(ana, grupo.id)).statusCode, 200);
  daBia.emit('voice:leave');
  await esperar();
  await caio('DELETE', `/api/me/bloqueios/${contaBia.user.id}`);
});

test('menor de idade: com a amizade desfeita, a chamada com quem não é amigo fecha', async () => {
  assert.equal((await entrar(daAna, conversaAnaDani.id)).ok, true);
  assert.equal((await senha(dani, conversaAnaDani.id)).statusCode, 200, 'amigas: entra');
  await ana('DELETE', `/api/amigos/${contaDani.user.id}`);
  assert.equal((await senha(dani, conversaAnaDani.id)).statusCode, 403);
  assert.equal((await entrar(daDani, conversaAnaDani.id)).ok, false);
  daAna.emit('voice:leave');
  await esperar();
});

test('recusar avisa a conversa, só com chamada aberta e sem repetir', async () => {
  const recusas: { channelId: number; userId: number }[] = [];
  daAna.on('chamada:recusada', (r) => recusas.push(r));
  daBia.emit('chamada:recusar', { channelId: conversaAnaBia.id }); // ninguém ligando: ignorado
  await esperar();
  assert.equal(recusas.length, 0);
  await entrar(daAna, conversaAnaBia.id);
  daBia.emit('chamada:recusar', { channelId: conversaAnaBia.id });
  daBia.emit('chamada:recusar', { channelId: conversaAnaBia.id }); // repetido: um aviso só
  doCaio.emit('chamada:recusar', { channelId: conversaAnaBia.id }); // de fora: ignorado
  await esperar();
  assert.deepEqual(recusas, [{ channelId: conversaAnaBia.id, userId: contaBia.user.id }]);
  daAna.emit('voice:leave');
  await esperar();
});

// OS ACHADOS DA REVISÃO (02/11/2026): o bloqueio e a amizade desfeita valem também para quem JÁ está na chamada; quem não
// poderia entrar não vê a chamada; e a transmissão privada se denuncia.
const naChamada = (channelId: number) => estados.filter((e) => e.channelId === channelId).at(-1)?.members.map((m) => m.userId) ?? [];

test('bloquear no meio da chamada tira quem foi bloqueado, e ele deixa de vê-la', async () => {
  assert.equal((await entrar(daAna, conversaAnaBia.id)).ok, true);
  assert.equal((await entrar(daBia, conversaAnaBia.id)).ok, true);
  await esperar();
  assert.deepEqual(naChamada(conversaAnaBia.id), [contaAna.user.id, contaBia.user.id]);
  await ana('POST', '/api/me/bloqueios', { userId: contaBia.user.id });
  await esperar();
  assert.deepEqual(naChamada(conversaAnaBia.id), [], 'a Bia saiu, e a chamada da Ana some da tela dela');
  assert.equal((await entrar(daBia, conversaAnaBia.id)).ok, false, 'e não volta');
  daAna.emit('voice:leave');
  await esperar();
  await ana('DELETE', `/api/me/bloqueios/${contaBia.user.id}`);
});

test('desfazer a amizade com um menor no meio da chamada a encerra', async () => {
  await ana('POST', '/api/amigos', { username: 'dani-chamada' });
  await dani('POST', `/api/amigos/${contaAna.user.id}/aceitar`);
  assert.equal((await entrar(daAna, conversaAnaDani.id)).ok, true);
  const encerradas: number[] = [];
  daAna.on('voice:substituida', ({ channelId }: { channelId: number }) => encerradas.push(channelId));
  assert.equal((await entrar(daDani, conversaAnaDani.id)).ok, true);
  await dani('DELETE', `/api/amigos/${contaAna.user.id}`);
  await esperar();
  // Quem sai é o adulto, nunca a pessoa protegida (a revisão de 02/11/2026: antes saía "quem chegou depois").
  assert.deepEqual(encerradas, [conversaAnaDani.id], 'a Ana, que não é mais amiga da menor, sai');
  daDani.emit('voice:leave');
  await esperar();
});

test('no bloqueio, sai quem foi bloqueado, mesmo tendo chegado antes', async () => {
  assert.equal((await entrar(daBia, conversaAnaBia.id)).ok, true);
  assert.equal((await entrar(daAna, conversaAnaBia.id)).ok, true);
  await esperar();
  await ana('POST', '/api/me/bloqueios', { userId: contaBia.user.id });
  await esperar();
  assert.deepEqual(naChamada(conversaAnaBia.id), [], 'a Bia (bloqueada) saiu; a Ana, que bloqueou, fica');
  const daAnaAgora = await new Promise<{ members: { userId: number }[] }>((ok) => {
    daAna.once('chamada:estado', ok);
    daAna.emit('voice:update', { muted: true });
  });
  assert.deepEqual(daAnaAgora.members.map((m) => m.userId), [contaAna.user.id]);
  daAna.emit('voice:leave');
  await esperar();
  await ana('DELETE', `/api/me/bloqueios/${contaBia.user.id}`);
});

test('quem ainda não entrou não vê o título da janela transmitida', async () => {
  assert.equal((await entrar(daAna, conversaAnaBia.id)).ok, true);
  daAna.emit('voice:update', { screen: true, screenName: 'Minha janela' });
  await esperar();
  const visto = estados.filter((e) => e.channelId === conversaAnaBia.id).at(-1)?.members as { screenName: string | null }[];
  assert.equal(visto[0].screenName, null);
  daAna.emit('voice:leave');
  await esperar();
});

test('apagar a conversa durante a chamada encerra a chamada de quem apagou', async () => {
  assert.equal((await entrar(daBia, conversaAnaBia.id)).ok, true);
  await esperar();
  await bia('POST', `/api/direct/${conversaAnaBia.id}/apagar`);
  await esperar();
  assert.deepEqual(naChamada(conversaAnaBia.id), []);
});

test('a transmissão da chamada privada se denuncia (só quem é da conversa)', async () => {
  const denuncia = { tipo: 'transmissao', alvo: contaAna.user.id, motivo: 'transmissão imprópria', canal: conversaAnaBia.id };
  assert.equal((await bia('POST', '/api/reports', denuncia)).statusCode, 200);
  assert.equal((await caio('POST', '/api/reports', denuncia)).statusCode, 404, 'o Caio não é da conversa');
});

test('quem sai da conversa sai da chamada dela', async () => {
  assert.equal((await entrar(doCaio, grupo.id)).ok, true);
  await esperar();
  await caio('POST', `/api/direct/${grupo.id}/leave`);
  await esperar();
  const doGrupo = estados.filter((e) => e.channelId === grupo.id).at(-1);
  assert.deepEqual(doGrupo?.members, []);
});
